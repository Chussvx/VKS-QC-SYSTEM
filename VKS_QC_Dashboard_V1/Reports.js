/**
 * Reports.gs - Report generation backend
 */

/**
 * Generate report based on type
 */
function generateReport(params) {
  const reportType = params.type;
  const startDate = params.startDate ? new Date(params.startDate) : new Date();
  const endDate = params.endDate ? new Date(params.endDate) : new Date();
  
  const reportTitle = getReportTitle(reportType);
  const ss = SpreadsheetApp.create(`${reportTitle} - ${Utilities.formatDate(new Date(), 'Asia/Vientiane', 'yyyy-MM-dd')}`);
  const sheet = ss.getActiveSheet();
  
  // Generate based on type
  switch (reportType) {
    case 'daily':
      generateDailyReport(sheet, startDate);
      break;
    case 'patrol':
      generatePatrolReport(sheet, startDate, endDate, params);
      break;
    case 'performance':
      generatePerformanceReport(sheet, startDate, endDate, params);
      break;
    case 'incident':
      generateIncidentReport(sheet, startDate, endDate, params);
      break;
    case 'overtime':
      generateOvertimeReportSheet(sheet, startDate, endDate, params);
      break;
    case 'coverage':
      generateCoverageReport(sheet, startDate, endDate, params);
      break;
    default:
      sheet.appendRow(['Report type not recognized']);
  }
  
  return ss.getUrl();
}

/**
 * Get report title
 */
function getReportTitle(type) {
  const titles = {
    'daily': 'Daily Summary Report',
    'patrol': 'Patrol Compliance Report',
    'performance': 'Guard Performance Report',
    'incident': 'Incident Report',
    'overtime': 'Overtime Summary Report',
    'coverage': 'Site Coverage Report'
  };
  return titles[type] || 'Report';
}

/**
 * Daily Summary Report
 */
function generateDailyReport(sheet, date) {
  sheet.setName('Daily Summary');
  
  // Header
  sheet.appendRow(['VKS Security Services']);
  sheet.appendRow(['Daily Summary Report']);
  sheet.appendRow(['Date:', Utilities.formatDate(date, 'Asia/Vientiane', 'yyyy-MM-dd')]);
  sheet.appendRow([]);
  
  // Patrol Status Section
  sheet.appendRow(['== PATROL STATUS ==']);
  sheet.appendRow(['Site', 'Guard', 'Status', 'Completion %', 'Last Scan']);
  
  // Sample data
  const patrols = [
    ['Crowne Plaza Vientiane', 'Somchai K.', 'Complete', '100%', '06:45'],
    ['BCEL Headquarters', 'Khamphone L.', 'Active', '72%', '05:30'],
    ['Australian Embassy', 'Bounmy S.', 'Active', '45%', '04:15']
  ];
  patrols.forEach(row => sheet.appendRow(row));
  
  sheet.appendRow([]);
  
  // Incidents Section
  sheet.appendRow(['== INCIDENTS ==']);
  sheet.appendRow(['Time', 'Site', 'Category', 'Severity', 'Status']);
  sheet.appendRow(['09:15', 'Crowne Plaza', 'Access Control', 'Medium', 'Resolved']);
  
  sheet.appendRow([]);
  
  // Summary Stats
  sheet.appendRow(['== SUMMARY ==']);
  sheet.appendRow(['Total Sites Monitored', 12]);
  sheet.appendRow(['Active Guards', 15]);
  sheet.appendRow(['Patrol Completion Rate', '87%']);
  sheet.appendRow(['Open Incidents', 2]);
  
  // Styling
  sheet.getRange('A1:E1').setFontWeight('bold');
  sheet.setColumnWidths(1, 5, 150);
}

/**
 * Patrol Compliance Report
 */
function generatePatrolReport(sheet, startDate, endDate, params) {
  sheet.setName('Patrol Compliance');
  
  sheet.appendRow(['Patrol Compliance Report']);
  sheet.appendRow(['Period:', Utilities.formatDate(startDate, 'Asia/Vientiane', 'yyyy-MM-dd'), 'to', Utilities.formatDate(endDate, 'Asia/Vientiane', 'yyyy-MM-dd')]);
  sheet.appendRow([]);
  
  sheet.appendRow(['Site', 'Total Shifts', 'Completed', 'Incomplete', 'Compliance %']);
  
  const data = [
    ['Crowne Plaza Vientiane', 30, 28, 2, '93%'],
    ['BCEL Headquarters', 30, 30, 0, '100%'],
    ['Australian Embassy', 30, 27, 3, '90%'],
    ['LXML Mine Compound', 30, 25, 5, '83%']
  ];
  data.forEach(row => sheet.appendRow(row));
  
  sheet.appendRow([]);
  sheet.appendRow(['Overall Compliance', '', '', '', '91.5%']);
}

/**
 * Guard Performance Report
 */
function generatePerformanceReport(sheet, startDate, endDate, params) {
  sheet.setName('Guard Performance');
  
  sheet.appendRow(['Guard Performance Report']);
  sheet.appendRow(['Period:', Utilities.formatDate(startDate, 'Asia/Vientiane', 'yyyy-MM-dd'), 'to', Utilities.formatDate(endDate, 'Asia/Vientiane', 'yyyy-MM-dd')]);
  sheet.appendRow([]);
  
  sheet.appendRow(['Guard Name', 'Shifts Worked', 'On-Time %', 'Completion Rate', 'Avg Score', 'Incidents Reported']);
  
  const data = [
    ['Somchai Khamvong', 22, '95%', '98%', 4.5, 2],
    ['Khamphone Latsamy', 20, '100%', '100%', 4.8, 1],
    ['Bounmy Sisavath', 18, '89%', '92%', 4.2, 0],
    ['Viengkham Phone', 21, '90%', '95%', 4.3, 3]
  ];
  data.forEach(row => sheet.appendRow(row));
}

/**
 * Incident Report
 */
function generateIncidentReport(sheet, startDate, endDate, params) {
  sheet.setName('Incidents');
  
  sheet.appendRow(['Incident Report']);
  sheet.appendRow(['Period:', Utilities.formatDate(startDate, 'Asia/Vientiane', 'yyyy-MM-dd'), 'to', Utilities.formatDate(endDate, 'Asia/Vientiane', 'yyyy-MM-dd')]);
  sheet.appendRow([]);
  
  // Summary by Category
  sheet.appendRow(['== BY CATEGORY ==']);
  sheet.appendRow(['Category', 'Count', 'Critical', 'High', 'Medium', 'Low']);
  sheet.appendRow(['Access Control', 5, 1, 1, 2, 1]);
  sheet.appendRow(['Fire', 1, 0, 1, 0, 0]);
  sheet.appendRow(['Theft', 2, 1, 1, 0, 0]);
  sheet.appendRow(['Medical', 3, 0, 0, 2, 1]);
  
  sheet.appendRow([]);
  
  // Detailed List
  sheet.appendRow(['== DETAILED LIST ==']);
  sheet.appendRow(['ID', 'Date', 'Site', 'Category', 'Severity', 'Status', 'Reporter']);
  sheet.appendRow(['INC-001', '2026-01-14', 'Crowne Plaza', 'Access Control', 'Critical', 'Resolved', 'Somchai K.']);
  sheet.appendRow(['INC-002', '2026-01-13', 'BCEL HQ', 'Fire', 'High', 'Closed', 'Khamphone L.']);
}

/**
 * Overtime Report
 */
function generateOvertimeReportSheet(sheet, startDate, endDate, params) {
  sheet.setName('Overtime Summary');
  
  sheet.appendRow(['Overtime Summary Report']);
  sheet.appendRow(['Period:', Utilities.formatDate(startDate, 'Asia/Vientiane', 'yyyy-MM-dd'), 'to', Utilities.formatDate(endDate, 'Asia/Vientiane', 'yyyy-MM-dd')]);
  sheet.appendRow([]);
  
  sheet.appendRow(['Guard', 'Total OT Hours', 'Approved', 'Pending', 'Rejected']);
  
  const data = [
    ['Somchai Khamvong', 12.5, 10, 2.5, 0],
    ['Khamphone Latsamy', 8, 8, 0, 0],
    ['Bounmy Sisavath', 15, 12, 3, 0],
    ['Viengkham Phone', 6, 4, 0.5, 1.5]
  ];
  data.forEach(row => sheet.appendRow(row));
  
  sheet.appendRow([]);
  sheet.appendRow(['Total', 41.5, 34, 6, 1.5]);
}

/**
 * Site Coverage Report
 */
function generateCoverageReport(sheet, startDate, endDate, params) {
  sheet.setName('Site Coverage');
  
  sheet.appendRow(['Site Coverage Report']);
  sheet.appendRow(['Period:', Utilities.formatDate(startDate, 'Asia/Vientiane', 'yyyy-MM-dd'), 'to', Utilities.formatDate(endDate, 'Asia/Vientiane', 'yyyy-MM-dd')]);
  sheet.appendRow([]);
  
  sheet.appendRow(['Site', 'Required Hours', 'Covered Hours', 'Gap Hours', 'Coverage %']);
  
  const data = [
    ['Crowne Plaza Vientiane', 720, 710, 10, '98.6%'],
    ['BCEL Headquarters', 720, 720, 0, '100%'],
    ['Australian Embassy', 480, 475, 5, '99%'],
    ['LXML Mine Compound', 720, 680, 40, '94.4%']
  ];
  data.forEach(row => sheet.appendRow(row));
  
  sheet.appendRow([]);
  sheet.appendRow(['Total', 2640, 2585, 55, '97.9%']);
}
