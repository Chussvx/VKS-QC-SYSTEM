/**
 * Migration.gs - Auto-create sheets and migrate data on deploy
 * 
 * Handles:
 * - Creating Incidents tab if missing
 * - Creating Complaints tab if missing
 * - Migrating data from Issues tab (if exists)
 * - Deleting Issues tab after migration
 */

/**
 * Initialize sheets on app load
 * Called from doGet() to ensure schema is up-to-date
 */
function initializeSheets() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    
    // Create Incidents tab if missing
    createIncidentsSheet(ss);
    
    // Create Complaints tab if missing
    createComplaintsSheet(ss);
    
    // Migrate from Issues tab if it exists
    migrateFromIssuesTab(ss);
    
    Logger.log('Sheet initialization complete');
  } catch (e) {
    Logger.log('Error in initializeSheets: ' + e.message);
  }
}

/**
 * Create Incidents sheet with headers
 */
function createIncidentsSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_INCIDENTS);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_INCIDENTS);
    const headers = [
      'id', 'title', 'description', 'siteId', 'category', 'severity', 'status',
      'incidentTime', 'reportedTime', 'reportedBy', 'reportedTo', 
      'responseTime', 'respondedBy', 'resolvedTime',
      'injuries', 'propertyDamage', 'estimatedLoss', 'authoritiesNotified',
      'policeReportNo', 'cctvAvailable', 'photos', 'witnesses',
      'immediateActions', 'notes', 'dueDate', 'createdAt', 'updatedAt'
    ];
    sheet.appendRow(headers);
    
    // Format header row
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#22c55e')
      .setFontColor('#ffffff');
    
    sheet.setFrozenRows(1);
    Logger.log('Created Incidents sheet');
  }
  
  return sheet;
}

/**
 * Create Complaints sheet with headers
 */
function createComplaintsSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_COMPLAINTS);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_COMPLAINTS);
    const headers = [
      'id', 'customerName', 'customerPhone', 'customerType', 'siteId', 'guardId',
      'category', 'severity', 'priority', 'status', 'description', 'resolution',
      'disciplinaryAction', 'notifiedBy', 'recordedBy', 'assignedTo', 'approvedBy',
      'timestamp', 'dueDate', 'completionDate', 'createdAt', 'updatedAt'
    ];
    sheet.appendRow(headers);
    
    // Format header row
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#3b82f6')
      .setFontColor('#ffffff');
    
    sheet.setFrozenRows(1);
    Logger.log('Created Complaints sheet');
  }
  
  return sheet;
}

/**
 * Migrate data from old Issues tab to new Incidents/Complaints tabs
 */
function migrateFromIssuesTab(ss) {
  const issuesSheet = ss.getSheetByName(SHEET_ISSUES);
  
  if (!issuesSheet) {
    Logger.log('No Issues sheet to migrate');
    return;
  }
  
  // Check if Issues has data (more than just header)
  if (issuesSheet.getLastRow() <= 1) {
    // Empty sheet - safe to delete
    ss.deleteSheet(issuesSheet);
    Logger.log('Deleted empty Issues sheet');
    return;
  }
  
  // Has data - migrate then delete
  const data = issuesSheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  const typeCol = headers.indexOf('type');
  if (typeCol < 0) {
    Logger.log('Issues sheet has no type column, cannot migrate');
    return;
  }
  
  let incidentCount = 0;
  let complaintCount = 0;
  
  const incidentsSheet = ss.getSheetByName(SHEET_INCIDENTS);
  const complaintsSheet = ss.getSheetByName(SHEET_COMPLAINTS);
  
  rows.forEach(row => {
    const type = row[typeCol];
    
    if (type === 'incident') {
      // Map old columns to new Incidents schema
      incidentsSheet.appendRow([
        row[headers.indexOf('id')] || '',
        row[headers.indexOf('title')] || '',
        row[headers.indexOf('description')] || '',
        row[headers.indexOf('siteId')] || '',
        row[headers.indexOf('category')] || '',
        row[headers.indexOf('severity')] || 'medium',
        row[headers.indexOf('status')] || 'waiting',
        row[headers.indexOf('timestamp')] || new Date(),  // incidentTime
        row[headers.indexOf('timestamp')] || new Date(),  // reportedTime
        row[headers.indexOf('reporterId')] || '',  // reportedBy
        '',  // reportedTo
        '',  // responseTime
        '',  // respondedBy
        row[headers.indexOf('resolvedAt')] || '',  // resolvedTime
        false,  // injuries
        false,  // propertyDamage
        0,  // estimatedLoss
        false,  // authoritiesNotified
        '',  // policeReportNo
        false,  // cctvAvailable
        '',  // photos
        '',  // witnesses
        '',  // immediateActions
        '',  // notes
        row[headers.indexOf('dueDate')] || '',
        row[headers.indexOf('createdAt')] || new Date(),
        new Date()  // updatedAt
      ]);
      incidentCount++;
    } else if (type === 'complaint') {
      // Map old columns to new Complaints schema
      complaintsSheet.appendRow([
        row[headers.indexOf('id')] || '',
        row[headers.indexOf('customerName')] || '',
        '',  // customerPhone
        'client',  // customerType
        row[headers.indexOf('siteId')] || '',
        '',  // guardId
        row[headers.indexOf('category')] || '',
        row[headers.indexOf('severity')] || 'medium',
        row[headers.indexOf('priority')] || 'p3',
        row[headers.indexOf('status')] || 'waiting',
        row[headers.indexOf('description')] || '',
        '',  // resolution
        '',  // disciplinaryAction
        '',  // notifiedBy
        '',  // recordedBy
        '',  // assignedTo
        '',  // approvedBy
        row[headers.indexOf('timestamp')] || new Date(),
        row[headers.indexOf('dueDate')] || '',
        '',  // completionDate
        row[headers.indexOf('createdAt')] || new Date(),
        new Date()  // updatedAt
      ]);
      complaintCount++;
    }
  });
  
  Logger.log('Migrated ' + incidentCount + ' incidents and ' + complaintCount + ' complaints');
  
  // Delete old Issues sheet after successful migration
  ss.deleteSheet(issuesSheet);
  Logger.log('Deleted old Issues sheet after migration');
}

/**
 * Manual migration trigger (run from Apps Script editor)
 */
function runMigration() {
  initializeSheets();
  SpreadsheetApp.getActive().toast('Migration complete!', 'Success', 5);
}
