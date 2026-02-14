// Export.gs - CSV, PDF, and print export functions

/**
 * Export data to a new Google Sheet
 * @param {string} type - Data type to export
 * @param {object} filters - Optional filters
 * @returns {string} URL of the new spreadsheet
 */
function exportToSheet(type, filters = {}) {
  const data = getData(type, filters);
  if (!data.length) {
    throw new Error('No data to export');
  }
  
  const fileName = 'VKS_QC_Export_' + type + '_' + formatDateForFile(new Date());
  const ss = SpreadsheetApp.create(fileName);
  const sheet = ss.getActiveSheet();
  
  // Add headers
  const headers = Object.keys(data[0]);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  
  // Add data rows
  const rows = data.map(item => headers.map(h => item[h]));
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  
  // Auto-resize columns
  headers.forEach((_, i) => sheet.autoResizeColumn(i + 1));
  
  logActivity('EXPORT', type + ' to Sheet: ' + ss.getId());
  return ss.getUrl();
}

/**
 * Export data to CSV format (returns content as string)
 * @param {string} type - Data type
 * @param {object} filters - Optional filters
 * @returns {string} CSV content
 */
function exportToCSV(type, filters = {}) {
  const data = getData(type, filters);
  if (!data.length) {
    throw new Error('No data to export');
  }
  
  const headers = Object.keys(data[0]);
  let csv = headers.join(',') + '\n';
  
  data.forEach(row => {
    const values = headers.map(h => {
      let val = row[h] || '';
      // Escape quotes and wrap in quotes if contains comma
      val = String(val).replace(/"/g, '""');
      if (val.includes(',') || val.includes('\n')) {
        val = '"' + val + '"';
      }
      return val;
    });
    csv += values.join(',') + '\n';
  });
  
  return csv;
}

/**
 * Export inspections data for payroll
 * @param {object} filters - Date range, site filters
 * @returns {string} Sheet URL
 */
function exportInspections(filters) {
  return exportToSheet('inspections', filters);
}

/**
 * Export overtime data for payroll processing
 * @param {string} period - Pay period (e.g., "2026-01")
 * @param {object} filters - Additional filters
 * @returns {string} Sheet URL
 */
function exportOTReport(period, filters = {}) {
  // Add period filter
  const [year, month] = period.split('-');
  filters.dateFrom = new Date(year, month - 1, 1).toISOString();
  filters.dateTo = new Date(year, month, 0).toISOString();
  
  const data = getData('overtime', filters);
  
  // Calculate totals
  let totalHours = 0;
  data.forEach(ot => {
    totalHours += parseFloat(ot.OTHours) || 0;
  });
  
  // Create export with summary
  const fileName = 'VKS_OT_Report_' + period;
  const ss = SpreadsheetApp.create(fileName);
  const sheet = ss.getActiveSheet();
  
  // Summary section
  sheet.getRange(1, 1).setValue('Overtime Report - ' + period);
  sheet.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  sheet.getRange(2, 1).setValue('Total OT Hours:');
  sheet.getRange(2, 2).setValue(totalHours.toFixed(2));
  sheet.getRange(3, 1).setValue('Records:');
  sheet.getRange(3, 2).setValue(data.length);
  
  // Data section
  if (data.length > 0) {
    const headers = ['Date', 'Guard', 'Site', 'OT Hours', 'Rate', 'Status', 'Approved By'];
    sheet.getRange(5, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    
    const rows = data.map(ot => [
      ot.Date,
      ot.GuardID,
      ot.SiteID,
      ot.OTHours,
      ot.Rate || '1.5x',
      ot.Status,
      ot.ApprovedBy || ''
    ]);
    sheet.getRange(6, 1, rows.length, headers.length).setValues(rows);
  }
  
  logActivity('EXPORT', 'OT Report: ' + period);
  return ss.getUrl();
}

/**
 * Export guard activity (checkpoint scans)
 * @param {object} filters - Date, site, guard filters
 * @returns {string} Sheet URL
 */
function exportActivity(filters) {
  return exportToSheet('activity', filters);
}

/**
 * Generate QR code as base64 image
 * @param {string} content - Content to encode
 * @param {number} size - Size in pixels
 * @returns {string} Base64 image data
 */
function generateQRCode(content, size = 200) {
  const url = 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encodeURIComponent(content);
  const response = UrlFetchApp.fetch(url);
  const blob = response.getBlob();
  return 'data:image/png;base64,' + Utilities.base64Encode(blob.getBytes());
}

/**
 * Generate print sheet with multiple QR codes
 * @param {Array} checkpointIds - IDs of checkpoints to print
 * @param {string} layout - Layout type (3x3, 2x3, 2x2)
 * @returns {string} PDF URL or base64
 */
function printQRSheet(checkpointIds, layout = '2x3') {
  const checkpoints = checkpointIds.map(id => getById('checkpoints', id)).filter(cp => cp);
  
  if (!checkpoints.length) {
    throw new Error('No checkpoints found');
  }
  
  // Create HTML template for print
  let html = '<html><head><style>';
  html += 'body { font-family: Arial, sans-serif; }';
  html += '.qr-container { display: grid; gap: 10mm; padding: 10mm; }';
  
  if (layout === '3x3') {
    html += '.qr-container { grid-template-columns: repeat(3, 1fr); }';
    html += '.qr-item { width: 30mm; }';
  } else if (layout === '2x3') {
    html += '.qr-container { grid-template-columns: repeat(2, 1fr); }';
    html += '.qr-item { width: 50mm; }';
  } else {
    html += '.qr-container { grid-template-columns: repeat(2, 1fr); }';
    html += '.qr-item { width: 80mm; }';
  }
  
  html += '.qr-item { text-align: center; border: 1px dashed #ccc; padding: 5mm; }';
  html += '.qr-item img { max-width: 100%; }';
  html += '.qr-name { font-weight: bold; margin-top: 2mm; }';
  html += '.qr-site { font-size: 10pt; color: #666; }';
  html += '</style></head><body>';
  
  html += '<div class="qr-container">';
  checkpoints.forEach(cp => {
    const content = 'VKS-CP-' + cp.SiteID + '-' + cp.ID;
    const qrImage = generateQRCode(content, 200);
    html += '<div class="qr-item">';
    html += '<img src="' + qrImage + '" alt="QR">';
    html += '<div class="qr-name">' + cp.Name + '</div>';
    html += '<div class="qr-site">' + cp.SiteID + '</div>';
    html += '</div>';
  });
  html += '</div></body></html>';
  
  // Return as HTML for client-side printing
  return html;
}

/**
 * Download all QR codes for a site as ZIP
 * @param {string} siteId - Site ID
 * @returns {string} Download URL
 */
function downloadQRBundle(siteId) {
  const checkpoints = getData('checkpoints', { site: siteId });
  
  if (!checkpoints.length) {
    throw new Error('No checkpoints found for this site');
  }
  
  // Create folder in Drive
  const folderName = 'VKS_QR_' + siteId + '_' + formatDateForFile(new Date());
  const folder = DriveApp.createFolder(folderName);
  
  // Generate and save each QR code
  checkpoints.forEach(cp => {
    const content = 'VKS-CP-' + cp.SiteID + '-' + cp.ID;
    const url = 'https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=' + encodeURIComponent(content);
    const response = UrlFetchApp.fetch(url);
    const blob = response.getBlob().setName(cp.Name.replace(/[^a-zA-Z0-9]/g, '_') + '.png');
    folder.createFile(blob);
  });
  
  logActivity('EXPORT', 'QR Bundle for site: ' + siteId);
  return folder.getUrl();
}

// Helper function
function formatDateForFile(date) {
  return Utilities.formatDate(date, 'GMT+7', 'yyyyMMdd_HHmm');
}
