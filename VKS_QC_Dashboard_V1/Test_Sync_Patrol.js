/**
 * Debug function to trigger sync manually
 */
function debug_triggerSyncManual() {
  try {
    const targetCode = 'VKS-A-001';
    console.log('Searching for site with code: ' + targetCode);
    
    // Use existing getSites to find the ID
    const sites = getSites({});
    const site = sites.find(s => s.code === targetCode);
    
    if (!site) {
      console.log('ERROR: Site not found!');
      return;
    }
    
    console.log('FOUND SITE: ' + site.nameEN);
    
    // Simulate data object
    const siteData = {
        id: site.id,
        code: site.code, // NEW: Include Code
        nameEN: site.nameEN,
        roundsTarget: site.roundsTarget,
        checkpointTarget: site.checkpointTarget,
        shiftType: site.shiftType,
        shiftStart: site.shiftStart,
        shiftEnd: site.shiftEnd
    };
    
    console.log('Attempting sync manually...');
    const result = syncToPatrolDashboard(siteData);
    console.log('Sync Result: ' + result);

  } catch (e) {
    console.log('DEBUG SYNC ERROR: ' + e.message);
  }
}

/**
 * UTILITY: Wipe the Site_Config sheet to start fresh
 * Run this if columns get messed up
 */
function debug_resetPatrolConfig() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PATROL);
    const sheet = ss.getSheetByName(SHEET_SITE_CONFIG);
    if (sheet) {
      ss.deleteSheet(sheet);
      console.log('Deleted existing Site_Config sheet.');
    } else {
      console.log('Site_Config sheet not found.');
    }
    console.log('Ready to re-sync.');
  } catch (e) {
    console.log('RESET ERROR: ' + e.message);
  }
}
