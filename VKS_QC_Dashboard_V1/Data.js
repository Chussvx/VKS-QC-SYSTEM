// Data.gs - Generic CRUD operations for all data types

// Sheet name mapping
// NOTE: Incidents and Complaints have dedicated handlers in Issues.gs
const SHEET_MAP = {
  'users': 'Users',
  'sites': 'Sites',
  'guards': 'Guards',
  'inspections': 'InspectionLogs',
  'handovers': 'HandoverRecords',
  'activity': 'GuardActivity',
  'overtime': 'Overtime',
  'calendar': 'CalendarEvents',
  'checkpoints': 'QRCheckpoints',
  'settings': 'Settings'
};

/**
 * Get handover records for a specific date/site
 * Reads from QC HandoverRecords sheet (synced data)
 * Schema: id(0), timestamp(1), siteName(2), guardName(3), comment(4), syncedAt(5)
 * Falls back to Patrol Site_Comments if QC sheet doesn't exist
 * @param {Object} filters - {startDate, endDate, siteId, date}
 * @returns {Array} Handover record objects
 */
function getHandoverRecords(filters) {
  try {
    const ssQC = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const sitesSheet = ssQC.getSheetByName(SHEET_SITES);

    // 1. Resolve Site ID to Name (if filtering by site)
    let filterSiteName = null;
    if (filters.siteId && sitesSheet) {
      const siteData = sitesSheet.getDataRange().getValues().slice(1);
      // Schema: id(0), code(1), nameEN(2)...
      const siteRow = siteData.find(r => String(r[0]) === String(filters.siteId));
      if (siteRow) filterSiteName = siteRow[2];
    }

    // 2. Try QC HandoverRecords sheet first (synced data with correct schema)
    let dataSheet = ssQC.getSheetByName(SHEET_HANDOVER_RECORDS || 'HandoverRecords');
    // Column indices for QC HandoverRecords: id(0), timestamp(1), siteName(2), guardName(3), comment(4), syncedAt(5)
    let COL_TIMESTAMP = 1;
    let COL_SITE = 2;
    let COL_GUARD = 3;
    let COL_COMMENT = 4;

    if (!dataSheet) {
      // Fallback: read from Patrol Site_Comments (legacy)
      Logger.log('HandoverRecords sheet not found in QC, falling back to Patrol Site_Comments');
      const ssPatrol = SpreadsheetApp.openById(SPREADSHEET_ID_PATROL);
      dataSheet = ssPatrol.getSheetByName('Site_Comments');
      // Column indices for Site_Comments: Timestamp(0), SiteName(1), GuardName(2), Comment(3)
      COL_TIMESTAMP = 0;
      COL_SITE = 1;
      COL_GUARD = 2;
      COL_COMMENT = 3;
    }

    if (!dataSheet) {
      Logger.log('No handover data sheet found');
      return [];
    }

    const data = dataSheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const rows = data.slice(1); // Skip header
    const results = [];

    // Date Range Filter - supports startDate/endDate or legacy 'date' parameter
    let startDate = null;
    let endDate = null;

    // New date range format
    if (filters.startDate && filters.startDate.trim() !== '') {
      startDate = new Date(filters.startDate);
      startDate.setHours(0, 0, 0, 0);
    }
    if (filters.endDate && filters.endDate.trim() !== '') {
      endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999); // End of day
    }
    // Legacy single date format (backward compatibility)
    if (!startDate && !endDate && filters.date && filters.date.trim() !== '') {
      startDate = new Date(filters.date);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setHours(23, 59, 59, 999);
    }

    // Scan backwards (newest first) - limit to 1000 results
    const maxResults = 1000;
    for (let i = rows.length - 1; i >= 0 && results.length < maxResults; i--) {
      const row = rows[i];
      // Use the correct timestamp column
      if (!row[COL_TIMESTAMP]) continue;

      const date = row[COL_TIMESTAMP] instanceof Date ? row[COL_TIMESTAMP] : new Date(row[COL_TIMESTAMP]);
      if (isNaN(date.getTime())) continue;

      // Date Range Filter — filter by actual timestamp, NOT syncedAt
      if (startDate && date < startDate) continue;
      if (endDate && date > endDate) continue;

      // Site Filter
      const rowSiteName = row[COL_SITE] ? String(row[COL_SITE]).trim() : '';
      if (filterSiteName && rowSiteName !== filterSiteName) continue;

      results.push({
        id: row[0] || ('log_' + date.getTime() + '_' + i),
        timestamp: date.toISOString(),
        timeDisplay: Utilities.formatDate(date, 'Asia/Vientiane', 'HH:mm'),
        displayDate: Utilities.formatDate(date, 'Asia/Vientiane', 'dd/MM/yyyy'),
        type: 'checkin',
        siteId: filters.siteId || '',
        siteName: rowSiteName,
        outgoingGuard: row[COL_GUARD] ? String(row[COL_GUARD]) : 'Unknown',
        incomingGuard: '-',
        notes: row[COL_COMMENT] ? String(row[COL_COMMENT]) : ''
      });
    }

    Logger.log('getHandoverRecords: Returning ' + results.length + ' records (filtered by timestamp col ' + COL_TIMESTAMP + ')');
    return results;

  } catch (e) {
    Logger.log('Error in getHandoverRecords: ' + e.message);
    console.error(e);
    return [];
  }
}

// Legacy function removed or kept as empty stub if needed
function getSampleHandoverRecords(dateStr, guards, sites) { return []; }


/**
 * Get data from a sheet
 * @param {string} type - Data type (incidents, guards, sites, etc.)
 * @param {Object} filters - Optional filters {status:'', site:'', dateFrom:'', dateTo:'', search:''}
 * @returns {Array} Array of objects
 */
function getData(type, filters = {}) {
  const sheetName = SHEET_MAP[type];
  if (!sheetName) throw new Error('Unknown data type: ' + type);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0];
  let result = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  // Apply filters
  if (filters.status) {
    result = result.filter(r => r.Status === filters.status);
  }
  if (filters.site) {
    result = result.filter(r => r.SiteID === filters.site || r.Site === filters.site);
  }
  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom);
    result = result.filter(r => new Date(r.Date) >= from);
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo);
    result = result.filter(r => new Date(r.Date) <= to);
  }
  if (filters.search) {
    const term = filters.search.toLowerCase();
    result = result.filter(r =>
      Object.values(r).some(v =>
        String(v).toLowerCase().includes(term)
      )
    );
  }

  return result;
}

/**
 * Get single record by ID
 * @param {string} type - Data type
 * @param {string} id - Record ID
 * @returns {Object|null} Record or null
 */
function getById(type, id) {
  const data = getData(type);
  return data.find(r => r.ID === id) || null;
}

/**
 * Save data (create or update)
 * @param {string} type - Data type
 * @param {Object} data - Data to save
 * @returns {Object} {success: boolean, id: string}
 */
function saveData(type, data) {
  const sheetName = SHEET_MAP[type];
  if (!sheetName) throw new Error('Unknown data type: ' + type);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  if (data.ID) {
    // Update existing
    const allData = sheet.getDataRange().getValues();
    const idCol = headers.indexOf('ID');

    for (let i = 1; i < allData.length; i++) {
      if (allData[i][idCol] === data.ID) {
        data.UpdatedAt = new Date();
        data.UpdatedBy = Session.getActiveUser().getEmail();
        const row = headers.map(h => data[h] !== undefined ? data[h] : allData[i][headers.indexOf(h)]);
        sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
        logActivity('UPDATE', type + ':' + data.ID);

        // Trigger signaling
        if (type === 'guards') setUpdateSignal('guards');
        if (type === 'sites') setUpdateSignal('sites');
        if (type === 'handovers' || type === 'incidents' || type === 'complaints') setUpdateSignal('master');

        return { success: true, id: data.ID };
      }
    }
  }

  // Create new
  data.ID = Utilities.getUuid();
  data.CreatedAt = new Date();
  data.CreatedBy = Session.getActiveUser().getEmail();
  const row = headers.map(h => data[h] || '');
  sheet.appendRow(row);
  logActivity('CREATE', type + ':' + data.ID);

  // Trigger signaling
  if (type === 'guards') setUpdateSignal('guards');
  if (type === 'sites') setUpdateSignal('sites');
  if (type === 'handovers' || type === 'incidents' || type === 'complaints') setUpdateSignal('master');

  return { success: true, id: data.ID };
}

/**
 * Delete record by ID
 * @param {string} type - Data type
 * @param {string} id - Record ID
 * @returns {Object} {success: boolean}
 */
function deleteData(type, id) {
  const sheetName = SHEET_MAP[type];
  if (!sheetName) throw new Error('Unknown data type: ' + type);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);

  const data = sheet.getDataRange().getValues();
  const idCol = data[0].indexOf('ID');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === id) {
      sheet.deleteRow(i + 1);
      logActivity('DELETE', type + ':' + id);
      return { success: true };
    }
  }

  throw new Error('Record not found');
}

/**
 * Get options for dropdowns (sites, guards, etc.)
 * @param {string} type - Data type
 * @returns {Array} [{id, name}, ...]
 */
function getOptions(type) {
  const data = getData(type);
  return data.map(r => ({
    id: r.ID,
    name: r.Name || r.Title || r.ID
  }));
}

/**
 * Get site details by name (for map display)
 * @param {string} siteName - Site name to search for
 * @returns {Object} Site details including lat/lng
 */
function getSiteByName(siteName) {
  try {
    const ssQC = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const sitesSheet = ssQC.getSheetByName(SHEET_SITES);

    if (!sitesSheet) {
      Logger.log('Sites sheet not found');
      return null;
    }

    const data = sitesSheet.getDataRange().getValues();
    if (data.length <= 1) return null;

    const headers = data[0];
    const rows = data.slice(1);

    // Find column indices
    const nameENIdx = headers.indexOf('nameEN');
    const nameLOIdx = headers.indexOf('nameLO');
    const latIdx = headers.indexOf('lat');
    const lngIdx = headers.indexOf('lng');
    const contactNameIdx = headers.indexOf('contactName');
    const contactPhoneIdx = headers.indexOf('contactPhone');
    const addressIdx = headers.indexOf('address');

    // Search for matching site (case-insensitive, partial match)
    const searchName = siteName.toLowerCase().trim();

    for (const row of rows) {
      const nameEN = row[nameENIdx] ? String(row[nameENIdx]).toLowerCase() : '';
      const nameLO = row[nameLOIdx] ? String(row[nameLOIdx]) : '';

      if (nameEN.includes(searchName) || searchName.includes(nameEN) ||
        nameLO.includes(siteName) || siteName.includes(nameLO)) {
        return {
          nameEN: row[nameENIdx] || '',
          nameLO: row[nameLOIdx] || '',
          lat: parseFloat(row[latIdx]) || null,
          lng: parseFloat(row[lngIdx]) || null,
          contactName: row[contactNameIdx] || '',
          contactPhone: row[contactPhoneIdx] || '',
          address: row[addressIdx] || ''
        };
      }
    }

    Logger.log('Site not found: ' + siteName);
    return null;

  } catch (e) {
    Logger.log('Error in getSiteByName: ' + e.message);
    return null;
  }
}
