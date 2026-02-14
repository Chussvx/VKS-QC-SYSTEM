/**
 * Test function to verify sheet connectivity and data presence
 */
function test_checkSitesData() {
  try {
    const qcId = SPREADSHEET_ID_QC;
    const ss = SpreadsheetApp.openById(qcId);
    console.log('Connected to Spreadsheet: ' + ss.getName());
    
    const sheet = ss.getSheetByName(SHEET_SITES);
    if (!sheet) {
      console.log('Error: SHEET_SITES ("' + SHEET_SITES + '") NOT FOUND');
      return;
    }
    
    const data = sheet.getDataRange().getValues();
    console.log('SHEET_SITES found. Row count (including header): ' + data.length);
    
    if (data.length > 1) {
      console.log('Header columns: ' + data[0].join(', '));
      console.log('First data row: ' + data[1].join(', '));
    } else {
      console.log('SHEET_SITES is empty (headers only or truly empty)');
    }
    
    // Also check Patrol Dashboard connectivity
    const patrolSS = SpreadsheetApp.openById(SPREADSHEET_ID_PATROL);
    console.log('Connected to Patrol Spreadsheet: ' + patrolSS.getName());
    
  } catch (e) {
    console.log('Connectivity Test FAILED: ' + e.message);
  }
}
