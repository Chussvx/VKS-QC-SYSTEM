/**
 * Setup.gs - One-time setup functions
 * 
 * Run these functions manually to initialize the application.
 */

/**
 * Creates a BRAND NEW VKS QC Master spreadsheet.
 * Use this ONLY when starting a fresh project.
 */
function createQCMasterSheet() {
  const ss = SpreadsheetApp.create('VKS QC Master');
  const ssId = ss.getId();
  
  Logger.log('Created NEW spreadsheet with ID: ' + ssId);
  Logger.log('URL: ' + ss.getUrl());
  
  // Initialize all sheets
  createAllSheets_(ss);
  
  // Add sample data for testing
  addSampleData_(ss);
  
  // Delete default Sheet1 if it exists and we have other sheets
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }
  
  Logger.log('===========================================');
  Logger.log('Setup complete!');
  Logger.log('IMPORTANT: Copy this ID to Config.gs:');
  Logger.log('const SPREADSHEET_ID_QC = \'' + ssId + '\';');
  Logger.log('===========================================');
  
  return ssId;
}

/**
 * Updates your EXISTING QC Master spreadsheet (the one in Config.gs).
 * Run this if you are missing tabs like "Locations" or "InspectionLogs".
 */
function updateExistingMasterSheet() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    Logger.log('Updating existing spreadsheet: ' + ss.getName());
    
    createAllSheets_(ss);
    
    Logger.log('Update complete! All required tabs are now present.');
    return true;
  } catch (e) {
    Logger.log('ERROR: Could not find spreadsheet. Check SPREADSHEET_ID_QC in Config.gs');
    Logger.log('Error: ' + e.message);
    return false;
  }
}

/**
 * Test function to check connection to Patrol Dashboard
 */
function testPatrolConnection() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PATROL);
    Logger.log('CONNECTED: ' + ss.getName());
    return { success: true };
  } catch (e) {
    Logger.log('FAILED: ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * INTERNAL: Creates all required sheets if they don't exist
 */
function createAllSheets_(ss) {
  const required = [
    { name: SHEET_GUARDS, columns: COLUMNS.guards },
    { name: SHEET_SITES, columns: COLUMNS.sites },
    { name: SHEET_CHECKPOINTS, columns: COLUMNS.checkpoints },
    { name: SHEET_SCANS, columns: COLUMNS.scans },
    { name: SHEET_SHIFTS, columns: COLUMNS.shifts },
    { name: SHEET_OVERTIME, columns: COLUMNS.overtime },
    { name: SHEET_ISSUES, columns: COLUMNS.issues },
    { name: SHEET_SETTINGS, columns: COLUMNS.settings },
    { name: SHEET_USERS, columns: COLUMNS.users },
    { name: SHEET_ACTIVITY_LOG, columns: COLUMNS.activityLog },
    { name: SHEET_LOCATIONS, columns: COLUMNS.locations },
    { name: SHEET_INSPECTION_LOGS, columns: COLUMNS.inspectionLogs }
  ];

  required.forEach(item => {
    createSheetWithHeaders_(ss, item.name, item.columns);
  });

  addDefaultSettings_(ss);
}

/**
 * Internal helper to create a single sheet with formatted headers
 */
function createSheetWithHeaders_(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  // Update/Set headers (Row 1)
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format header row
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  
  // Auto-resize columns
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }
  
  Logger.log('Verified sheet: ' + sheetName);
  return sheet;
}

/**
 * Adds default settings if the settings sheet is empty
 */
function addDefaultSettings_(ss) {
  const sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet || sheet.getLastRow() > 1) return; // Already has settings

  const now = new Date().toISOString();
  const settings = [
    ['language', 'en', 'Application language (en/lo)', now],
    ['theme', 'light', 'UI theme (light/dark)', now],
    ['timezone', 'Asia/Vientiane', 'Default timezone', now],
    ['otRate', '15', 'Default overtime hourly rate (USD)', now],
    ['lateThreshold', '15', 'Minutes before scan marked as late', now],
    ['missedThreshold', '30', 'Minutes before scan marked as missed', now],
    ['gpsRadius', '100', 'Allowed GPS radius in meters', now]
  ];
  
  if (sheet.getMaxRows() < settings.length + 1) {
    sheet.insertRowsAfter(1, settings.length);
  }
  
  sheet.getRange(2, 1, settings.length, 4).setValues(settings);
  Logger.log('Added default settings');
}

/**
 * Adds sample data for testing
 */
function addSampleData_(ss) {
  const now = new Date().toISOString();
  
  // Sample Sites
  const sitesSheet = ss.getSheetByName(SHEET_SITES);
  if (sitesSheet && sitesSheet.getLastRow() <= 1) {
    const sampleSites = [
      ['site-001', 'VKS25-001', 'Central Plaza', 'ຊັນທຣັລ ພາຊາ', 'Office', 'A', 'Kaysone Road, Xaysettha', 'Xaysettha', 'Vientiane', '17.9757', '102.6331', 'Mr. Kham', '+856 20 55551111', 'kham@example.com', 'active', '', now, now],
      ['site-002', 'VKS25-002', 'Landmark Tower', 'ແລນມາກ ທາວເວີ', 'Hotel', 'A', 'Samsenthai Road', 'Sisattanak', 'Vientiane', '17.9637', '102.6140', 'Ms. Souk', '+856 20 55552222', 'souk@example.com', 'active', '', now, now]
    ];
    sitesSheet.getRange(2, 1, sampleSites.length, sampleSites[0].length).setValues(sampleSites);
  }
  Logger.log('Sample data verified');
}

/**
 * FIX: Set permissions for the Sidebar Logo to Public
 * Run this once via console or editor to ensure the logo is visible.
 */
function fixLogoPermissions() {
  const fileId = '1o7UGoZhLBG43hm-5eao8UYB4YjeQ_IhT';
  try {
    const file = DriveApp.getFileById(fileId);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    console.log('✅ Permissions updated to Public.');
    // console.log('Thumbnail Link:', file.getThumbnailLink()); // Removed invalid method
    
    // Return a direct link structure that works well for <img> tags
    return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000';
  } catch (e) {
    console.error('❌ Error fixing permissions:', e.toString());
    return 'Error: ' + e.toString();
  }
}
