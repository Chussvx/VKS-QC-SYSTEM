// VKS Guard App Database Configuration
// DUAL-SOURCE SETUP:
// - QC Master: Read Sites configuration (checkpointTarget, roundsTarget, etc.)
// - Patrol Dashboard: Write Scans, Guards, etc.

const QC_MASTER_ID = '1jVeiXS7wl8-eA1DSgiMOsgElZCL0ILGMficC1mrZFyI';
const PATROL_DASHBOARD_ID = '199tZWltRfX1t4-WYqXlz7z89seGkZuB7eV4RlsbLhl0';

// Legacy alias - default for writes
const SPREADSHEET_ID = PATROL_DASHBOARD_ID;

/**
 * GENERIC: Get all rows from a sheet as an array of objects
 * Uses QC Master for Sites/Locations, Patrol Dashboard for others
 */
function getTableData(sheetName) {
  try {
    // Sites config comes from QC Master
    const sourceId = (sheetName === 'Sites' || sheetName === 'Site_Config' || sheetName === 'Locations' || sheetName === 'Guards') 
      ? QC_MASTER_ID 
      : PATROL_DASHBOARD_ID;
    
    const ss = SpreadsheetApp.openById(sourceId);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    const headers = data[0];
    const rows = data.slice(1);

    return rows.map(row => {
      let obj = {};
      headers.forEach((header, index) => {
        // Normalize header: Trim whitespace
        const cleanHeader = String(header).trim();
        if (cleanHeader) {
            obj[cleanHeader] = row[index];
        }
      });
      return obj;
    });
  } catch (e) {
    console.error('DB Read Error: ' + e.message);
    return [];
  }
}

/**
 * GENERIC: Append a row object to a sheet
 * ENHANCED: Automatically adds missing column headers
 */
function appendRecord(sheetName, recordObj) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      const newHeaders = ['TIMESTAMP', 'ID', ...Object.keys(recordObj)];
      sheet.appendRow(newHeaders);
    }

    let headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
    let headers = headerRange.getValues()[0];

    // SMART SCHEMA: Check if any keys in recordObj are missing from headers
    const newColumns = Object.keys(recordObj).filter(key =>
      !headers.includes(key) && key !== 'TIMESTAMP' && key !== 'ID'
    );

    if (newColumns.length > 0) {
      console.log(`Adding missing columns to ${sheetName}: ${newColumns.join(', ')}`);
      const nextCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextCol, 1, newColumns.length).setValues([newColumns]);
      // Refresh headers
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }

    // Map object to header order
    const row = headers.map(header => {
      const hUpper = String(header).toUpperCase();
      if (hUpper === 'TIMESTAMP' && !recordObj[header] && !recordObj[hUpper] && !recordObj[header.toLowerCase()]) return new Date();
      if (hUpper === 'ID' && !recordObj[header] && !recordObj[hUpper] && !recordObj[header.toLowerCase()]) return Utilities.getUuid();

      return (recordObj[header] !== undefined) ? recordObj[header] :
        (recordObj[hUpper] !== undefined ? recordObj[hUpper] :
          (recordObj[header.toLowerCase()] !== undefined ? recordObj[header.toLowerCase()] : ''));
    });

    sheet.appendRow(row);

    // SIGNAL: Notify monitoring dashboards that data has changed
    try {
      const signalKey = (sheetName === 'Scans') ? 'LAST_SCAN_SIGNAL' : 'LAST_MASTER_SIGNAL';
      const qcSS = SpreadsheetApp.openById(SPREADSHEET_ID);
      qcSS.addDeveloperMetadata(signalKey, Date.now().toString(), SpreadsheetApp.DeveloperMetadataVisibility.DOCUMENT);

      // Keep only the latest metadata to prevent bloat
      const oldMeta = qcSS.getDeveloperMetadata().filter(m => m.getKey() === signalKey);
      if (oldMeta.length > 5) {
        oldMeta.slice(0, oldMeta.length - 1).forEach(m => m.remove());
      }
    } catch (e) {
      console.error('Signal Error: ' + e.message);
    }

    return { success: true };
  } catch (e) {
    console.error(`Append Error [${sheetName}]: ${e.message}`);
    return { success: false, error: e.message };
  }
}
