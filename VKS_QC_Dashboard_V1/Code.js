// Code.gs - Main Google Apps Script entry point
// 
// NOTE: CRUD operations are in Data.gs, Auth in Auth.gs
// This file contains only: doGet, include, and dashboard stats helpers

/**
 * Serves the web app
 */
function doGet(e) {
  // Auto-initialize sheets on first load (creates Incidents/Complaints if missing)
  initializeSheets();
  
  // Public Info Page (for QR scans by non-app users)
  if (e.parameter.type === 'info') {
    return HtmlService.createTemplateFromFile('Page_PublicInfo')
      .evaluate()
      .setTitle('VKS Site Information')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('VKS Quality Control Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Include helper for HTML templates
 * Usage: <?!= include('Components/Styles'); ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// =====================================================
// DASHBOARD STATS (Local helpers - not duplicated)
// =====================================================

/**
 * Get dashboard statistics (uses active spreadsheet)
 */
function getDashboardStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  return {
    totalSites: getSheetRowCount(ss, 'Sites'),
    onDuty: getActiveGuardCount(ss),
    latePatrols: getLatePatrolCount(ss),
    liveIssues: getOpenIssueCount(ss),
    qualityScore: calculateQualityScore(ss)
  };
}

function getSheetRowCount(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  return sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;
}

function getActiveGuardCount(ss) {
  const sheet = ss.getSheetByName('Guards');
  if (!sheet) return 0;
  
  const data = sheet.getDataRange().getValues();
  const statusCol = data[0].indexOf('Status');
  
  return data.slice(1).filter(row => row[statusCol] === 'On Duty').length;
}

function getLatePatrolCount(ss) {
  // Implement based on your patrol tracking logic
  return 0;
}

function getOpenIssueCount(ss) {
  let count = 0;
  
  // Use new Incidents tab
  const incidents = ss.getSheetByName('Incidents');
  if (incidents && incidents.getLastRow() > 1) {
    const data = incidents.getDataRange().getValues();
    const statusCol = data[0].indexOf('status');
    if (statusCol >= 0) {
      count += data.slice(1).filter(row => row[statusCol] !== 'resolved' && row[statusCol] !== 'closed').length;
    }
  }
  
  // Use new Complaints tab
  const complaints = ss.getSheetByName('Complaints');
  if (complaints && complaints.getLastRow() > 1) {
    const data = complaints.getDataRange().getValues();
    const statusCol = data[0].indexOf('status');
    if (statusCol >= 0) {
      count += data.slice(1).filter(row => row[statusCol] !== 'resolved' && row[statusCol] !== 'closed').length;
    }
  }
  
  return count;
}

function calculateQualityScore(ss) {
  // Implement based on your quality metrics
  return 9.4;
}
