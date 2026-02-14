/**
 * PatrolSync.gs - Sync logic for Patrol Dashboard
 * 
 * Handles pushing configuration from QC Dashboard to Patrol Dashboard
 * so that the Guard App can read updated settings.
 */

/**
 * Sync specific site settings to Patrol Dashboard
 * @param {Object} siteData - Site data object including config
 * @returns {boolean} success
 */
function syncToPatrolDashboard(siteData) {
  try {
    if (!siteData) {
        console.error('syncToPatrolDashboard called without data. Did you mean to run debug_triggerSyncManual?');
        return false;
    }
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PATROL);
    let sheet = ss.getSheetByName(SHEET_SITE_CONFIG);
    
    // Auto-create if missing
    if (!sheet) {
      console.log('Creating Site_Config sheet in Patrol Dashboard...');
      sheet = ss.insertSheet(SHEET_SITE_CONFIG);
      // HEADERS: siteId, code, name, ...
      const headers = ['siteId', 'code', 'name', 'rounds', 'checkpoints', 'shiftType', 'shiftStart', 'shiftEnd', 'updatedAt'];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#fbbc04'); 
      sheet.setFrozenRows(1);
    }
    
    // Check if 'code' header exists (Migration for existing sheet)
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    let codeColIndex = headers.indexOf('code');
    
    if (codeColIndex === -1) {
       // Insert 'code' column after siteId (index 0 -> insert at 2)
       sheet.insertColumnAfter(1);
       sheet.getRange(1, 2).setValue('code').setFontWeight('bold').setBackground('#fbbc04');
       codeColIndex = 1; // 0-based index
    }
    
    const data = sheet.getDataRange().getValues();
    // Re-map column indices based on headers
    // We rely on column names now for safety
    const idx = {
       id: headers.indexOf('siteId'),
       code: headers.indexOf('code'),
       name: headers.indexOf('name'),
       rounds: headers.indexOf('rounds'), 
       checks: headers.indexOf('checkpoints'),
       type: headers.indexOf('shiftType'),
       start: headers.indexOf('shiftStart'),
       end: headers.indexOf('shiftEnd'),
       updated: headers.indexOf('updatedAt')
    };
    
    const targetName = siteData.nameEN;
    const targetCode = siteData.code;
    let rowIndex = -1;
    
    // Match logic: Try Code first, then Name
    for (let i = 1; i < data.length; i++) {
        const rowCode = idx.code > -1 ? data[i][idx.code] : '';
        const rowName = idx.name > -1 ? data[i][idx.name] : '';
        
        if ((targetCode && String(rowCode) === String(targetCode)) || 
            (String(rowName) === String(targetName))) {
            rowIndex = i + 1;
            break;
        }
    }
    
    const timestamp = new Date().toISOString();
    
    if (rowIndex === -1) {
        // Append new
        // Construct row based on header order
        const newRow = new Array(headers.length).fill('');
        if (idx.id > -1) newRow[idx.id] = siteData.id;
        if (idx.code > -1) newRow[idx.code] = siteData.code || '';
        if (idx.name > -1) newRow[idx.name] = siteData.nameEN;
        if (idx.rounds > -1) newRow[idx.rounds] = siteData.roundsTarget;
        if (idx.checks > -1) newRow[idx.checks] = siteData.checkpointTarget;
        if (idx.type > -1) newRow[idx.type] = siteData.shiftType;
        if (idx.start > -1) newRow[idx.start] = siteData.shiftStart;
        if (idx.end > -1) newRow[idx.end] = siteData.shiftEnd;
        if (idx.updated > -1) newRow[idx.updated] = timestamp;
        
        sheet.appendRow(newRow);
        console.log('Synced (Appended) config to Patrol DB for: ' + targetName);
    } else {
        // Update existing (Cols 3-8: rounds, cp, type, start, end, updated)
        // 1-based indexing for getRange
        if (idx.code > -1) sheet.getRange(rowIndex, idx.code + 1).setValue(siteData.code);
        if (idx.rounds > -1) sheet.getRange(rowIndex, idx.rounds + 1).setValue(siteData.roundsTarget);
        if (idx.checks > -1) sheet.getRange(rowIndex, idx.checks + 1).setValue(siteData.checkpointTarget);
        if (idx.type > -1) sheet.getRange(rowIndex, idx.type + 1).setValue(siteData.shiftType);
        if (idx.start > -1) sheet.getRange(rowIndex, idx.start + 1).setValue(siteData.shiftStart);
        if (idx.end > -1) sheet.getRange(rowIndex, idx.end + 1).setValue(siteData.shiftEnd);
        if (idx.updated > -1) sheet.getRange(rowIndex, idx.updated + 1).setValue(timestamp);
        console.log('Synced (Updated) config to Patrol DB for: ' + targetName);
    }
    
    return true;
    
  } catch (e) {
    console.error('syncToPatrolDashboard failed: ' + e.message);
    // Non-blocking error - we don't want to fail the local save if sync fails
    return false;
  }
}
