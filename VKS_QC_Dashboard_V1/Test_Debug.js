/**
 * Debug function to test getSites() directly
 */
function debug_getSites() {
  try {
    console.log('=== DEBUG getSites() ===');
    console.log('SPREADSHEET_ID_QC: ' + SPREADSHEET_ID_QC);
    console.log('SHEET_SITES constant: ' + SHEET_SITES);

    // Direct check
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    console.log('Spreadsheet name: ' + ss.getName());

    const sheet = ss.getSheetByName(SHEET_SITES);
    if (!sheet) {
      console.log('ERROR: Sheet "' + SHEET_SITES + '" NOT FOUND!');
      console.log('Available sheets: ' + ss.getSheets().map(s => s.getName()).join(', '));
      return;
    }

    const lastRow = sheet.getLastRow();
    console.log('Sheet "' + SHEET_SITES + '" found. Last row: ' + lastRow);

    if (lastRow > 1) {
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      console.log('Headers: ' + headers.join(', '));

      // Get first data row
      const firstDataRow = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0];
      console.log('First data row: ' + firstDataRow.join(' | '));
    }

    // Now call actual getSites
    console.log('--- Calling getSites({}) ---');
    const sites = getSites({});
    console.log('getSites returned ' + sites.length + ' sites');

    if (sites.length > 0) {
      console.log('First site: ' + JSON.stringify(sites[0]));
    }

  } catch (e) {
    console.log('DEBUG ERROR: ' + e.message);
    console.log('Stack: ' + e.stack);
  }
}

/**
 * Test getGuardStats with hardcoded params from console log
 * Run this from Apps Script editor to verify backend works
 */
function test_getGuardStats() {
  console.log('=== TEST getGuardStats ===');
  const guardId = 'TEST001';
  const siteId = 'SITE-A-E2E3F3';
  const guardType = 'guard';

  console.log('Calling getGuardStats with: guardId=' + guardId + ' siteId=' + siteId + ' type=' + guardType);

  const result = getGuardStats(guardId, siteId, guardType);

  console.log('RESULT:');
  console.log(JSON.stringify(result, null, 2));
}

/**
 * DEBUG: Inspect PatrolPlans sheet for a specific date
 * Run from Apps Script editor to see raw shift values
 */
function debug_patrolPlans() {
  var testDate = '2026-02-12';
  console.log('=== DEBUG PatrolPlans for ' + testDate + ' ===');

  // 1. Raw sheet data
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
  var sheet = ss.getSheetByName(SHEET_PATROL_PLANS);
  if (!sheet || sheet.getLastRow() <= 1) {
    console.log('ERROR: PatrolPlans sheet not found or empty');
    return;
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  console.log('Headers: ' + headers.join(' | '));

  var dateIdx = headers.indexOf('date');
  var shiftIdx = headers.indexOf('shift');
  var routeIdx = headers.indexOf('route');
  var siteNameIdx = headers.indexOf('siteName');
  console.log('Column indices - date:', dateIdx, 'shift:', shiftIdx, 'route:', routeIdx, 'siteName:', siteNameIdx);

  // Find matching rows
  var matches = [];
  for (var i = 1; i < data.length; i++) {
    var rowDate = data[i][dateIdx];
    var rowDateStr = '';
    if (rowDate instanceof Date) {
      rowDateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } else {
      rowDateStr = String(rowDate || '').trim();
    }
    if (rowDateStr === testDate) {
      matches.push({
        row: i + 1,
        date: rowDateStr,
        shift: String(data[i][shiftIdx] || ''),
        shiftRaw: JSON.stringify(data[i][shiftIdx]),
        route: String(data[i][routeIdx] || ''),
        siteName: String(data[i][siteNameIdx] || '')
      });
    }
  }

  console.log('Found ' + matches.length + ' plans for ' + testDate);

  // Group by shift
  var byShift = {};
  matches.forEach(function (m) {
    var key = m.shift.toLowerCase() + '|' + m.route;
    if (!byShift[key]) byShift[key] = 0;
    byShift[key]++;
    // Log first few for each shift
    if (byShift[key] <= 3) {
      console.log('  Row ' + m.row + ': shift="' + m.shift + '" (raw=' + m.shiftRaw + ') route=' + m.route + ' site=' + m.siteName);
    }
  });
  console.log('Distribution (shift|route → count): ' + JSON.stringify(byShift));

  // 2. Also test getPatrolCompliance output
  console.log('\n=== getPatrolCompliance(' + testDate + ') ===');
  var result = getPatrolCompliance(testDate);
  console.log('Plans: ' + (result.plans || []).length);
  console.log('Visited: ' + (result.visited || []).length);
  console.log('Missed: ' + (result.missed || []).length);

  var planShifts = {};
  (result.plans || []).forEach(function (p) {
    var k = p.shift + '|' + p.route;
    planShifts[k] = (planShifts[k] || 0) + 1;
  });
  console.log('Plan distribution: ' + JSON.stringify(planShifts));
}

/**
 * DEBUG: Check night shift logs between Feb 11-13 on both routes
 * Run from Apps Script editor
 */
function debug_nightShiftLogs() {
  var dates = ['2026-02-11', '2026-02-12', '2026-02-13'];
  console.log('=== DEBUG Night Shift Logs (Feb 11-13) ===');

  dates.forEach(function (date) {
    console.log('\n--- ' + date + ' ---');
    var result = getPatrolCompliance(date);

    // Filter night shift from visited/logs
    var nightVisited = (result.visited || []).filter(function (v) { return v.shift === 'night'; });
    var nightMissed = (result.missed || []).filter(function (m) { return m.shift === 'night'; });
    var nightPlans = (result.plans || []).filter(function (p) { return p.shift === 'night'; });
    var nightUnplanned = (result.unplanned || []).filter(function (u) { return u.shift === 'night'; });

    // Split by route
    var routeA_visited = nightVisited.filter(function (v) { return v.route === 'A'; });
    var routeB_visited = nightVisited.filter(function (v) { return v.route === 'B'; });
    var routeA_plans = nightPlans.filter(function (p) { return p.route === 'A'; });
    var routeB_plans = nightPlans.filter(function (p) { return p.route === 'B'; });
    var routeA_missed = nightMissed.filter(function (m) { return m.route === 'A'; });
    var routeB_missed = nightMissed.filter(function (m) { return m.route === 'B'; });

    console.log('Night Plans:  Route A=' + routeA_plans.length + '  Route B=' + routeB_plans.length);
    console.log('Night Visited: Route A=' + routeA_visited.length + '  Route B=' + routeB_visited.length);
    console.log('Night Missed:  Route A=' + routeA_missed.length + '  Route B=' + routeB_missed.length);
    console.log('Night Unplanned: ' + nightUnplanned.length);

    // Show details for visited
    nightVisited.forEach(function (v) {
      console.log('  ✅ Route ' + v.route + ' | ' + v.siteName + ' | by: ' + (v.patrolName || '?') + ' | at: ' + (v.timestamp || '?'));
    });

    // Show first 3 missed
    nightMissed.slice(0, 3).forEach(function (m) {
      console.log('  ❌ Route ' + m.route + ' | ' + m.siteName);
    });
    if (nightMissed.length > 3) console.log('  ... and ' + (nightMissed.length - 3) + ' more missed');
  });
}
