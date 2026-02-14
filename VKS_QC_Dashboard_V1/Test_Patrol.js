/**
 * Debug function to inspect Patrol Dashboard structure
 */
function debug_inspectPatrolStructure() {
  try {
    console.log('=== INSPECTING PATROL SPREADSHEET ===');
    console.log('ID: ' + SPREADSHEET_ID_PATROL);

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PATROL);
    console.log('Name: ' + ss.getName());

    const sitesSheet = ss.getSheetByName('Sites');
    if (!sitesSheet) {
      console.log('ERROR: "Sites" sheet not found in Patrol SS');
      return;
    }

    console.log('"Sites" sheet found.');

    // Get headers (Row 1)
    const headers = sitesSheet.getRange(1, 1, 1, sitesSheet.getLastColumn()).getValues()[0];
    console.log('HEADERS: ' + JSON.stringify(headers));

    // List ALL sheets
    const sheets = ss.getSheets();
    console.log('Total Sheets: ' + sheets.length);

    sheets.forEach(sheet => {
      const name = sheet.getName();
      const lastCol = sheet.getLastColumn();
      if (lastCol > 0) {
        const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
        console.log('SHEET: "' + name + '" -> Headers: ' + JSON.stringify(headers));
      } else {
        console.log('SHEET: "' + name + '" -> (Empty)');
      }
    });

  } catch (e) {
    console.log('DEBUG PATROL ERROR: ' + e.message);
  }
}

/**
 * Debug: Inspect actual column values for today's InspectionLogs
 * Run this to see what column 5 (shift) actually contains
 */
function debug_inspectTodayLogs() {
  var date = '2026-02-12';
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
  var sheet = ss.getSheetByName(SHEET_INSPECTION_LOGS);
  if (!sheet) { Logger.log('No InspectionLogs sheet'); return; }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  Logger.log('HEADERS: ' + JSON.stringify(headers));

  var results = [];
  for (var i = 1; i < data.length; i++) {
    var ts = data[i][0];
    if (!ts) continue;
    var d = ts instanceof Date ? ts : new Date(ts);
    if (isNaN(d.getTime())) continue;
    var logDate = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    if (logDate !== date) continue;

    results.push({
      row: i + 1,
      col0_timestamp: Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      col1_patrolName: String(data[i][1] || ''),
      col2_route: String(data[i][2] || ''),
      col3_siteName: String(data[i][3] || ''),
      col4_guardName: String(data[i][4] || ''),
      col5_shift: String(data[i][5] || ''),
      col5_type: typeof data[i][5],
      col5_raw: data[i][5]
    });
  }

  Logger.log('Found ' + results.length + ' logs for ' + date);
  results.forEach(function (r) {
    Logger.log(JSON.stringify(r));
  });
}

/**
 * Debug: Full shift classification diagnostic for a specific date.
 * Shows every log with its timestamp, col5 raw value, detected shift,
 * winning strategy, and effective date.
 * Run in GAS editor → View → Logs to see output.
 */
function debug_shiftClassification() {
  var date = '2026-02-12';
  var tz = Session.getScriptTimeZone();
  var shiftNumToName = { '1': 'morning', '2': 'evening', '3': 'night' };

  Logger.log('========================================');
  Logger.log('  SHIFT CLASSIFICATION DEBUG: ' + date);
  Logger.log('  Timezone: ' + tz);
  Logger.log('========================================');

  // Load inspector shift map
  var inspectorShiftMap = {};
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    var inspSheet = ss.getSheetByName(SHEET_INSPECTORS);
    if (inspSheet && inspSheet.getLastRow() > 1) {
      var inspData = inspSheet.getDataRange().getValues();
      var inspHeaders = inspData[0];
      var nameIdx = -1, shiftIdx = -1;
      for (var h = 0; h < inspHeaders.length; h++) {
        var hdr = String(inspHeaders[h]).trim().toLowerCase();
        if (hdr === 'name') nameIdx = h;
        if (hdr === 'shift') shiftIdx = h;
      }
      if (nameIdx >= 0 && shiftIdx >= 0) {
        for (var r = 1; r < inspData.length; r++) {
          var iName = String(inspData[r][nameIdx] || '').trim();
          var iShift = String(inspData[r][shiftIdx] || '').trim();
          if (iName && iShift) {
            var resolved = shiftNumToName[iShift] || extractShiftFromText_(iShift) || 'morning';
            inspectorShiftMap[iName.toLowerCase()] = resolved;
          }
        }
      }
    }
  } catch (e) { Logger.log('Inspector map error: ' + e.message); }
  Logger.log('Inspector shift map: ' + JSON.stringify(inspectorShiftMap));

  // Read logs with ±1 day buffer
  var datePrev = getPrevDate_(date);
  var dateNext = getNextDate_(date);
  var ss2 = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
  var logSheet = ss2.getSheetByName(SHEET_INSPECTION_LOGS);
  if (!logSheet) { Logger.log('No InspectionLogs sheet!'); return; }

  var logData = logSheet.getDataRange().getValues();
  Logger.log('Total rows in InspectionLogs: ' + (logData.length - 1));

  var counts = { morning: 0, evening: 0, night: 0 };
  var stratCounts = {};
  var logNum = 0;

  for (var i = 1; i < logData.length; i++) {
    var ts = logData[i][0];
    if (!ts) continue;
    var tsDate = (ts instanceof Date) ? ts : new Date(ts);
    if (isNaN(tsDate.getTime())) continue;

    var logDate = Utilities.formatDate(tsDate, tz, 'yyyy-MM-dd');
    if (logDate < datePrev || logDate > dateNext) continue;

    var patrolName = String(logData[i][1] || '').trim();
    var rawShift = String(logData[i][5] || '').trim();
    var siteName = String(logData[i][3] || '').trim();
    var timeStr = Utilities.formatDate(tsDate, tz, 'HH:mm:ss');

    // Run all strategies and show which one wins
    var strategies = {};

    // S1: Timestamp
    strategies['1_timestamp'] = getShiftFromTime_(tsDate);

    // S2: Col5 exact
    strategies['2_col5_exact'] = shiftNumToName[rawShift] || '';
    if (!strategies['2_col5_exact']) {
      var match = rawShift.match(/\b([123])\b/);
      strategies['2_col5_regex'] = match ? (shiftNumToName[match[1]] || '') : '';
    }

    // S3: Col5 text
    strategies['3_col5_text'] = rawShift ? extractShiftFromText_(rawShift) : '';

    // S4: Inspector map
    strategies['4_inspector_map'] = inspectorShiftMap[patrolName.toLowerCase()] || '';

    // S5: Name text
    strategies['5_name_text'] = patrolName ? extractShiftFromText_(patrolName) : '';

    // Determine winner (same order as production code: name→inspector→col5→timestamp)
    var logShift = '', winStrat = '';
    if (strategies['5_name_text']) { logShift = strategies['5_name_text']; winStrat = 'name-text'; }
    else if (strategies['4_inspector_map']) { logShift = strategies['4_inspector_map']; winStrat = 'inspector-map'; }
    else if (strategies['3_col5_text']) { logShift = strategies['3_col5_text']; winStrat = 'col5-text'; }
    else if (strategies['2_col5_exact']) { logShift = strategies['2_col5_exact']; winStrat = 'col5-exact'; }
    else if (strategies['2_col5_regex']) { logShift = strategies['2_col5_regex']; winStrat = 'col5-regex'; }
    else if (strategies['1_timestamp']) { logShift = strategies['1_timestamp']; winStrat = 'timestamp'; }

    // Effective date
    var effectiveDate = logDate;
    if (logShift === 'night') {
      var hourMin = parseInt(Utilities.formatDate(tsDate, tz, 'HH'), 10) * 60 +
        parseInt(Utilities.formatDate(tsDate, tz, 'mm'), 10);
      if (hourMin < 390) effectiveDate = getPrevDate_(logDate);
    }

    if (effectiveDate !== date) continue;

    logNum++;
    counts[logShift] = (counts[logShift] || 0) + 1;
    stratCounts[winStrat] = (stratCounts[winStrat] || 0) + 1;

    Logger.log('#' + logNum + ' | ' + timeStr + ' | SHIFT=' + logShift + ' (via ' + winStrat + ')' +
      ' | col5="' + rawShift + '"' +
      ' | site="' + siteName.substring(0, 30) + '"' +
      ' | inspector="' + patrolName.substring(0, 25) + '"' +
      ' | effDate=' + effectiveDate);
  }

  Logger.log('========================================');
  Logger.log('  SUMMARY for ' + date);
  Logger.log('  Morning: ' + (counts.morning || 0));
  Logger.log('  evening: ' + (counts.evening || 0));
  Logger.log('  Night: ' + (counts.night || 0));
  Logger.log('  Strategy usage: ' + JSON.stringify(stratCounts));
  Logger.log('========================================');
}

/**
 * Debug matching for a specific site
 * Usage: debug_inspectMatching('2026-02-13', 'Cosi')
 */
function debug_inspectMatching() {
  var date = '2026-02-13';
  var keyword = 'Cosi'; // adjust as needed

  Logger.log('=== DEBUG MATCHING ===');
  Logger.log('Date: ' + date);
  Logger.log('Keyword: "' + keyword + '"');

  function logChars(str) {
    var codes = [];
    for (var i = 0; i < str.length; i++) codes.push(str.charCodeAt(i));
    return str + ' [' + codes.join(',') + ']';
  }

  // 1. Get Plans
  var plans = getPatrolPlans(date);
  Logger.log('Total Plans: ' + plans.length);
  var targetPlans = plans.filter(function (p) { return p.siteName.indexOf(keyword) >= 0; });

  Logger.log('--- MATCHING PLANS (' + targetPlans.length + ') ---');
  targetPlans.forEach(function (p) {
    Logger.log('PLAN: Site="' + logChars(p.siteName) + '" | Shift=' + p.shift + ' | Route=' + p.route + ' | ID=' + p.siteId);
  });

  // 2. Get Logs
  var comp = getPatrolCompliance(date);

  // Check visited
  var visited = comp.visited.filter(function (l) { return l.siteName.indexOf(keyword) >= 0; });
  // Check missed (these are plans)
  var missed = comp.missed.filter(function (p) { return p.siteName.indexOf(keyword) >= 0; });
  // Check partial (these are logs)
  var partial = comp.partial.filter(function (l) { return l.siteName.indexOf(keyword) >= 0; });
  // Check unplanned (these are logs)
  var unplanned = comp.unplanned.filter(function (l) { return l.siteName.indexOf(keyword) >= 0; });

  Logger.log('--- COMPLIANCE RESULTS ---');
  Logger.log('Visited: ' + visited.length);
  visited.forEach(function (l) { Logger.log('  [VISITED] ' + logChars(l.siteName) + ' (' + l.shift + ') ID=' + l.siteId); });

  Logger.log('Missed: ' + missed.length);
  missed.forEach(function (p) { Logger.log('  [MISSED PLAN] ' + logChars(p.siteName) + ' (' + p.shift + ') Route=' + p.route + ' ID=' + p.siteId); });

  Logger.log('Partial: ' + partial.length);
  partial.forEach(function (l) { Logger.log('  [PARTIAL LOG] ' + logChars(l.siteName) + ' (' + l.shift + ') Route=' + l.route + ' mismatch=' + l.mismatch + ' ID=' + l.siteId); });

  Logger.log('Unplanned: ' + unplanned.length);
  unplanned.forEach(function (l) { Logger.log('  [UNPLANNED LOG] ' + logChars(l.siteName) + ' (' + l.shift + ') Route=' + l.route + ' ID=' + l.siteId); });
}
