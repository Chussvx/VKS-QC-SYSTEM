/**
 * Debug_Patrol.gs
 * Diagnostic tool for VKS Dashboard Data Linkage
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('VKS Debug')
    .addItem('Run Diagnostics', 'debugPatrolData')
    .addItem('Run Robot Test (E2E)', 'testScanBasedAssignment')
    .addToUi();
}

function debugPatrolData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName('Debug_Log');
  if (!logSheet) {
    logSheet = ss.insertSheet('Debug_Log');
  } else {
    logSheet.clear();
  }
  
  const log = [];
  log.push(['TIMESTAMP', 'CATEGORY', 'MESSAGE', 'DETAILS']);
  
  const addLog = (cat, msg, det = '') => {
    log.push([new Date(), cat, msg, det]);
    console.log(`[${cat}] ${msg} ${det}`);
  };

  try {
    addLog('INIT', 'Starting Diagnostics', 'Spreadsheet ID: ' + ss.getId());
    
    // 1. ANALYZE HEADERS
    const sheetsToCheck = ['Sites', 'Guards', 'Scans'];
    const headersMap = {};
    
    sheetsToCheck.forEach(name => {
      const sheet = ss.getSheetByName(name);
      if (!sheet) {
        addLog('ERROR', `Sheet '${name}' NOT FOUND`);
        return;
      }
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      headersMap[name] = headers;
      addLog('HEADERS', `Sheet '${name}' Headers`, JSON.stringify(headers));
      
      // Chech for leading/trailing spaces
      const badHeaders = headers.filter(h => h !== h.trim());
      if (badHeaders.length > 0) {
        addLog('WARN', `Sheet '${name}' has whitespace in headers!`, JSON.stringify(badHeaders));
      }
    });

    // 2. ANALYZE SITE MAPPING LOGIC
    const sitesSheet = ss.getSheetByName('Sites');
    const siteData = sitesSheet.getDataRange().getValues();
    const siteHeaders = siteData[0];
    
    // Re-implement getCIIndex locally to test it exactly
    const getCIIndex = (headers, names) => {
      const lowerHeaders = headers.map(h => String(h).trim().toLowerCase());
      for (const name of names) {
        const idx = lowerHeaders.indexOf(name.toLowerCase());
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const siteIdIdx = getCIIndex(siteHeaders, ['id']);
    const siteCodeIdx = getCIIndex(siteHeaders, ['code', 'site code', 'site_code']);
    const siteNameIdx = getCIIndex(siteHeaders, ['nameEN']);
    const siteStatusIdx = getCIIndex(siteHeaders, ['status']);

    addLog('MAPPING', 'Site Column Indexes', `ID:${siteIdIdx}, Code:${siteCodeIdx}, Name:${siteNameIdx}`);

    const siteKeyToId = {};
    const siteIdToInfo = {}; // New lookup for details
    
    const sites = siteData.slice(1).map(row => {
      const id = String(row[siteIdIdx] || '').trim();
      const code = String(row[siteCodeIdx] || '').trim();
      const name = String(row[siteNameIdx] || '');
      
      // LOGIC REPLICATION
      siteKeyToId[id.toUpperCase()] = id;
      if (code) siteKeyToId[code.toUpperCase()] = id;
      
      // Store info for logging
      siteIdToInfo[id] = { name, code, status: row[siteStatusIdx] }; // Include Raw Status
      
      return { id, code, name };
    });
    
    // 2.1 ANALYZE SITE STATUSES
    const statusCounts = {};
    siteData.slice(1).forEach(r => {
      const rawSt = String(r[siteStatusIdx]).trim().toLowerCase();
      statusCounts[rawSt] = (statusCounts[rawSt] || 0) + 1;
    });
    addLog('STATUS', 'Site Status Counts', JSON.stringify(statusCounts));
    
    addLog('MAPPING', 'Site Map Keys (Sample 10)', JSON.stringify(Object.keys(siteKeyToId).slice(0, 10)));

    // 2.5 GUARD LOOKUP PREP
    const guardsSheet = ss.getSheetByName('Guards');
    const guardsData = guardsSheet.getDataRange().getValues();
    const gEmpIdIdx = getCIIndex(guardsData[0], ['empId']);
    const gIdIdx = getCIIndex(guardsData[0], ['id']);
    const validGuardIds = new Set();
    guardsData.slice(1).forEach(r => {
      if(r[gIdIdx]) validGuardIds.add(String(r[gIdIdx]).trim());
      if(r[gEmpIdIdx]) validGuardIds.add(String(r[gEmpIdIdx]).trim());
    });

    // 3. ANALYZE SCANS
    const scansSheet = ss.getSheetByName('Scans');
    const scansData = scansSheet.getDataRange().getValues();
    const scHeaders = scansData[0];
    const scSiteIdx = getCIIndex(scHeaders, ['siteId']);
    const scGuardIdx = getCIIndex(scHeaders, ['guardId']);
    const scDateIdx = getCIIndex(scHeaders, ['timestamp']);
    const scStatusIdx = getCIIndex(scHeaders, ['status']); // New Status Index

    // 3. ANALYZE LAST 5 SCANS (FORENSIC DETAIL)
    addLog('FORENSIC', 'Analyzing Last 5 Scans', '--------------------------------');
    
    // Get last 5 rows, reverse order
    const last5 = scansData.slice(-5).reverse();
    const lastRowIdx = scansData.length;

    last5.forEach((row, i) => {
       const rowNum = lastRowIdx - i;
       const ts = row[scDateIdx];
       
       const rawSite = String(row[scSiteIdx] || '').trim();
       const rawGuard = String(row[scGuardIdx] || '').trim();
       const rawStatus = String(row[scStatusIdx] || '').trim();
       
       // CHECKS
       const siteId = siteKeyToId[rawSite.toUpperCase()];
       const guardValid = validGuardIds.has(rawGuard);
       
       let result = '✅ MATCH';
       if (!siteId) result = '❌ UNKNOWN SITE';
       else if (!guardValid) result = '❌ UNKNOWN GUARD';
       
       const timeStr = ts instanceof Date ? Utilities.formatDate(ts, 'Asia/Vientiane', 'HH:mm:ss') : String(ts);
       
       addLog('SCAN #' + rowNum, `${timeStr} | ${result}`, 
         `Guard: "${rawGuard}"Raw / ${guardValid ? 'Valid' : 'Invalid'} | ` +
         `Site: "${rawSite}" -> ${siteId ? siteId : 'None'} | ` +
         `Status: "${rawStatus}"`
       );
    });

    // 4. SIMULATE DASHBOARD LOGIC (Check Linkage)
    addLog('LOGIC', 'Simulating Dashboard Ad-Hoc Logic', '--------------------------------');
    
    // a. Build adHocShifts same as Patrol.gs
    const adHocShifts = {};
    const todayStr = Utilities.formatDate(new Date(), 'Asia/Vientiane', 'yyyy-MM-dd');
    
    scansData.slice(1).forEach(row => {
      const ts = row[scDateIdx];
      let rowDate = '';
      try { rowDate = Utilities.formatDate(new Date(ts), 'Asia/Vientiane', 'yyyy-MM-dd'); } catch(e){}
      
      if (rowDate === todayStr) {
         const rawStatus = String(row[scStatusIdx] || '').toUpperCase().trim();
         if (rawStatus === 'CHECKIN') {
            const rawSite = String(row[scSiteIdx] || '').trim().toUpperCase();
            const siteId = siteKeyToId[rawSite] || rawSite; // Resolve ID
            const guardId = String(row[scGuardIdx] || '').trim();
            
            adHocShifts[siteId] = { guardId: guardId, source: rawSite };
         }
      }
    });
    
    addLog('LOGIC', 'Detected Ad-Hoc Shifts KEYS', JSON.stringify(Object.keys(adHocShifts)));
    
    // b. Check if SITE-A-E2E3F3 exists in this map
    const testSiteId = 'SITE-A-E2E3F3'; // From previous log
    const match = adHocShifts[testSiteId];
    
    if (match) {
      addLog('LOGIC', `✅ ${testSiteId} has active shift`, JSON.stringify(match));
      // Verify Guard Name
      const gInfo = guardsData.slice(1).find(r => String(r[gEmpIdIdx]).trim() === match.guardId);
      addLog('LOGIC', 'Guard Lookup', gInfo ? `Found: ${gInfo[1]}` : `❌ Guard ${match.guardId} not found in Guards sheet`);
    } else {
      addLog('LOGIC', `❌ ${testSiteId} NOT found in Ad-Hoc Shifts`, 'Check timestamp or mapping');
    }

    // 5. REAL API CHECK
    addLog('API_CHECK', 'Calling actual getPatrolStatus()', '--------------------------------');
    try {
      const apiResult = getPatrolStatus();
      const targetSite = apiResult.find(s => s.siteId === 'SITE-A-E2E3F3' || s.siteCode === 'VKS-A-001');
      
      if (targetSite) {
        addLog('API_RESULT', `Status for ${targetSite.siteName}`, 
          `Status: ${targetSite.status} | Guard: ${targetSite.guardName} | Shift: ${targetSite.shiftType}`
        );
        addLog('API_DUMP', 'Full Object', JSON.stringify(targetSite));
      } else {
        addLog('API_RESULT', '❌ Site SITE-A-E2E3F3 NOT FOUND in API Response', 'Check activeSites filter');
      }
    } catch(e) {
      addLog('API_FAIL', 'getPatrolStatus Error', e.message);
    }
    
    // 6. ACTIVITY API CHECK (V25 Wrapper)
    addLog('ACT_CHECK', 'Testing getGuardActivity() V25...', '--------------------------------');
    try {
      const filters = { date: Utilities.formatDate(new Date(), 'Asia/Vientiane', 'yyyy-MM-dd') };
      const response = getGuardActivity(filters);
      
      if (response && response.version) {
         addLog('ACT_VER', 'Backend Version', response.version);
         if (response.debug) addLog('ACT_DEBUG', 'Backend Logs', response.debug.join(' | '));
         
         if (response.success) {
            const acts = response.data || [];
            addLog('ACT_RESULT', `Returned ${acts.length} events`, '');
            
            if (acts.length > 0) {
               addLog('ACT_SAMPLE', 'First Event JSON', JSON.stringify(acts[0]));
            } else {
               addLog('ACT_EMPTY', 'No events found', 'Try checking in today.');
            }
         } else {
            addLog('ACT_FAIL', 'Backend Error Flag', response.error);
         }
      } else {
         addLog('ACT_WARN', 'Legacy Response (Not V25 Wrapper)', 'Check deployment version.');
         // Fallback check
         if (Array.isArray(response)) {
            addLog('ACT_RESULT', `Returned ${response.length} Legacy events`, '');
         }
      }
    } catch (e) {
      addLog('ACT_FAIL', 'getGuardActivity Error', e.message + '\n' + e.stack);
    }


  } catch (e) {
    addLog('CRITICAL', 'Script Error', e.message + '\n' + e.stack);
  } finally {
    // Write log to sheet
    if (log.length > 1) {
      logSheet.getRange(1, 1, log.length, 4).setValues(log);
      logSheet.autoResizeColumns(1, 4);
    }
  }
}

// ==========================================
// 4. SITE OPTIONS DIAGNOSTIC
// ==========================================
function debugSiteOptions() {
  const log = [];
  function addLog(label, msg) { 
    const line = `[${label}] ${msg}`;
    log.push(line); 
    console.log(line); 
  }
  
  try {
    addLog('INIT', 'Starting debugSiteOptions... (V36 CHECK)');
    const opts = getSiteOptions();
    addLog('RESULT', `Returned ${opts.length} options`);
    
    // Check first 5 items
    opts.slice(0, 5).forEach((o, i) => {
       addLog(`ITEM_${i}`, JSON.stringify(o));
    });
    
    // Check for serialization issues
    try {
      const json = JSON.stringify(opts);
      addLog('SERIALIZE', `Success. JSON Length: ${json.length}`);
    } catch (e) {
      addLog('SERIALIZE', `FAILED: ${e.message}`);
    }
    
    // Manual Check of Sheets
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    
    const locSheet = ss.getSheetByName(SHEET_LOCATIONS);
    if (locSheet) {
      addLog('SHEET_LOC', `Found. LastRow: ${locSheet.getLastRow()}`);
      if (locSheet.getLastRow() > 1) {
        addLog('SHEET_LOC', 'First Data Row: ' + JSON.stringify(locSheet.getRange(2, 1, 1, 3).getValues()[0]));
      }
    } else {
      addLog('SHEET_LOC', 'NOT FOUND');
    }
    
    const siteSheet = ss.getSheetByName(SHEET_SITES);
    if (siteSheet) {
      addLog('SHEET_SITES', `Found. LastRow: ${siteSheet.getLastRow()}`);
      if (siteSheet.getLastRow() > 1) {
         addLog('SHEET_SITES', 'First Data Row: ' + JSON.stringify(siteSheet.getRange(2, 1, 1, 3).getValues()[0]));
      }
    } else {
      addLog('SHEET_SITES', 'NOT FOUND');
    }

    // 3. MAPPING DIAGNOSTIC
    addLog('MAP_DEBUG', 'Checking Name Mapping (Sites vs Locations)...');
    try {
      const siteSheet = ss.getSheetByName(SHEET_SITES);
      const locSheet = ss.getSheetByName(SHEET_LOCATIONS);
      
      const sites = siteSheet.getDataRange().getValues().slice(1);
      const locs = locSheet.getDataRange().getValues().slice(1);
      
      const siteNames = sites.map(s => (s[2]||'').trim().toLowerCase()); // nameEN
      
      // Check first 3 Locations
      locs.slice(0, 3).forEach((row, i) => {
         const lName = (row[2]||'').trim();
         const lNameLower = lName.toLowerCase();
         const matchIdx = siteNames.indexOf(lNameLower);
         
         if (matchIdx !== -1) {
            addLog(`MAP_TEST_${i}`, `✅ "${lName}" -> Found SITE ID: ${sites[matchIdx][0]}`);
         } else {
            addLog(`MAP_TEST_${i}`, `❌ "${lName}" -> NOT FOUND in Sites. Closest match?`);
            // Simple fuzzy check
            const closest = siteNames.find(s => s.includes(lNameLower) || lNameLower.includes(s));
            if (closest) addLog(`MAP_TEST_${i}`, `   Maybe: "${closest}"?`);
         }
      });
      
    } catch(e) {
      addLog('MAP_ERR', e.message);
    }

    return log.join('\n');
    
  } catch (e) {
    addLog('ERROR', e.message + '\n' + e.stack);
    return log.join('\n');
  }
}
