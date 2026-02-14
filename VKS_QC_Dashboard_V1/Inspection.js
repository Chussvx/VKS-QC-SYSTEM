/**
 * Inspection.gs - Inspection log retrieval
 * 
 * Guard Patrol app writes directly to QC Sheet 'InspectionLogs' tab.
 * This file provides read/query functions for the QC Dashboard.
 * 
 * REMOVED (Feb 2026): Auto-sync from Patrol SS is no longer needed.
 * Guard Patrol app (Code.gs) writes directly to QC Sheet InspectionLogs.
 */

/**
 * Get the operational date for a timestamp.
 * Logs before 05:30 AM are attributed to the previous day (Night Shift).
 * This aligns with PatrolPlans.js shift boundaries:
 *   Morning:   05:30 – 13:59
 *   Afternoon: 14:00 – 21:59
 *   Night:     22:00 – 05:29 (crosses midnight, belongs to previous day)
 * @param {Date} dateObj - The timestamp
 * @returns {Date} Midnight of the operational day
 */
function getOperationalDate_(dateObj) {
  var d = new Date(dateObj);
  var hours = d.getHours();
  var minutes = d.getMinutes();
  // Before 05:30 → previous operational day
  if (hours < 5 || (hours === 5 && minutes < 30)) {
    d.setDate(d.getDate() - 1);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}


/**
 * Get inspection logs with optional filters
 * Reads from LOCAL 'InspectionLogs' tab (Synced)
 * @param {Object} filters - Filter options
 * @returns {Array} Inspection log objects
 */
function getInspectionLogs(filters) {
  Logger.log('getInspectionLogs (Local) called with filters: ' + JSON.stringify(filters));

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const sheet = ss.getSheetByName(SHEET_INSPECTION_LOGS);

    if (!sheet) {
      Logger.log('Local InspectionLogs sheet not found');
      return JSON.stringify(getSampleInspectionLogs());
    }

    const lastRow = sheet.getLastRow();
    // If empty or just header
    if (lastRow < 2) return JSON.stringify(getSampleInspectionLogs());

    // Date range support for batch loading
    // Uses OPERATIONAL dates (05:30 cutoff) to align with PatrolPlans shift logic.
    // Logs before 05:30 AM belong to the previous operational day.
    let filterStartDate = null;
    let filterEndDate = null;

    if (filters && filters.batchStartDate && filters.batchEndDate) {
      // Batch mode: specific date range
      filterStartDate = new Date(filters.batchStartDate);
      filterEndDate = new Date(filters.batchEndDate);
      filterEndDate.setHours(23, 59, 59, 999); // End of day
    } else if (filters && filters.startDate && filters.endDate) {
      // Performance page mode: specific date range
      filterStartDate = new Date(filters.startDate);
      filterEndDate = new Date(filters.endDate);
      filterEndDate.setHours(23, 59, 59, 999); // End of day
    } else if (!filters || !filters.startDate) {
      // Initial load: default to last 30 days for fast response
      filterEndDate = new Date();
      filterStartDate = new Date();
      filterStartDate.setDate(filterStartDate.getDate() - 30);
    }

    // Expand raw timestamp window by 1 day to capture early-morning logs
    // (e.g., 04:00 AM on Feb 11 operationally belongs to Feb 10)
    let rawStartDate = null;
    if (filterStartDate) {
      rawStartDate = new Date(filterStartDate);
      rawStartDate.setDate(rawStartDate.getDate() - 1);
    }
    // End date needs +1 day buffer: a Night Shift log at 04:00 on endDate+1
    // operationally belongs to endDate
    let rawEndDate = null;
    if (filterEndDate) {
      rawEndDate = new Date(filterEndDate);
      rawEndDate.setDate(rawEndDate.getDate() + 1);
      rawEndDate.setHours(5, 30, 0, 0); // Only need up to 05:30 of next day
    }

    // Read all data (we'll filter by date, no arbitrary row limit)
    const data = sheet.getRange(2, 1, lastRow - 1, 24).getValues();

    // Column indices (0-based) - Matching Config.gs schema
    const idx = {
      timestamp: 0, patrolName: 1, route: 2, siteName: 3, guardName: 4, shift: 5,
      startTime: 6, finishTime: 7, duration: 8, score: 9, status: 10,
      flashlight: 11, uniform: 12, defenseTools: 13, logbook: 14, gates: 15,
      lighting: 16, fireSafety: 17, gps: 18, patrolLogs: 19, details: 20, issues: 21,
      handoverComment: 22, syncedAt: 23
    };

    const logs = [];

    // Iterate backwards (newest first)
    for (let i = data.length - 1; i >= 0; i--) {
      const row = data[i];
      try {
        const timestamp = row[idx.timestamp];
        if (!timestamp) continue;

        const dateObj = new Date(timestamp);
        const isValidDate = !isNaN(dateObj.getTime());

        // Step 1: Quick pre-filter using expanded raw timestamp window
        if (isValidDate && rawStartDate && dateObj < rawStartDate) continue;
        if (isValidDate && rawEndDate && dateObj > rawEndDate) continue;

        // Step 2: Compute operational date (05:30 cutoff)
        const opDate = isValidDate ? getOperationalDate_(dateObj) : null;
        const opDateStr = opDate ? Utilities.formatDate(opDate, 'Asia/Vientiane', 'yyyy-MM-dd') : null;

        // Step 3: Filter by operational date against the user's requested range
        if (opDate && filterStartDate) {
          const filterStartMidnight = new Date(filterStartDate);
          filterStartMidnight.setHours(0, 0, 0, 0);
          if (opDate < filterStartMidnight) continue;
        }
        if (opDate && filterEndDate) {
          const filterEndMidnight = new Date(filterEndDate);
          filterEndMidnight.setHours(23, 59, 59, 999);
          if (opDate > filterEndMidnight) continue;
        }

        const statusText = row[idx.status] ? row[idx.status].toString() : '';
        const hasIssue = statusText.toLowerCase().includes('issue') ||
          (row[idx.issues] && row[idx.issues].toString().length > 2);

        logs.push({
          id: 'log-' + (isValidDate ? dateObj.getTime() : i) + '-' + i,
          timestamp: isValidDate ? dateObj.toISOString() : null,
          localDate: isValidDate ? Utilities.formatDate(dateObj, 'Asia/Vientiane', 'yyyy-MM-dd') : null,
          operationalDate: opDateStr,
          dateDisplay: isValidDate ? Utilities.formatDate(dateObj, 'Asia/Vientiane', 'MMM dd, yyyy') : 'N/A',
          timeDisplay: isValidDate ? Utilities.formatDate(dateObj, 'Asia/Vientiane', 'HH:mm') : 'N/A',

          inspectorName: row[idx.patrolName] || 'Unknown',
          route: row[idx.route] || '',
          siteName: row[idx.siteName] || 'Unknown',
          siteId: row[idx.siteName] || '',
          guardName: row[idx.guardName] || 'Unknown',
          score: parseFloat(row[idx.score]) || 0,
          status: hasIssue ? 'has_issues' : 'normal',
          statusText: statusText,
          notes: row[idx.details] || '',
          photos: (row[idx.patrolLogs] && row[idx.patrolLogs].toString().toLowerCase() !== 'no photo')
            ? [row[idx.patrolLogs].toString()]
            : [], // Ensure string and filter "No Photo"

          // Added for Full Popup Detail (V2 Port)
          duration: row[idx.duration] ? row[idx.duration].toString() : '',
          timeRange: row[idx.startTime] && row[idx.finishTime] ?
            `${formatTimeValue(row[idx.startTime])} - ${formatTimeValue(row[idx.finishTime])}` : '',
          shift: row[idx.shift] || '',
          checks: {
            uniform: row[idx.uniform],
            defenseTools: row[idx.defenseTools],
            flashlight: row[idx.flashlight],
            logbook: row[idx.logbook],
            gates: row[idx.gates],
            lighting: row[idx.lighting],
            fireSafety: row[idx.fireSafety]
          },
          gps: row[idx.gps] || '',
          issues: row[idx.issues] || '',
          handoverComment: row[idx.handoverComment] || ''
        });

      } catch (err) {
        Logger.log('Error processing row ' + i + ': ' + err.message);
        continue;
      }
    }

    // Apply route filter
    if (filters && filters.route && filters.route !== '') {
      const routeFilter = filters.route.toUpperCase();
      const filteredLogs = logs.filter(l => {
        const logRoute = (l.route || '').toString().toUpperCase();
        return logRoute === routeFilter || logRoute.includes(routeFilter);
      });
      logs.length = 0;
      filteredLogs.forEach(l => logs.push(l));
    }

    if (filters && filters.search) {
      const term = filters.search.toLowerCase();
      return logs.filter(l =>
        l.siteName.toLowerCase().includes(term) ||
        l.guardName.toLowerCase().includes(term) ||
        l.inspectorName.toLowerCase().includes(term)
      );
    }

    // Return JSON string to avoid Google.script.run serialization issues
    return JSON.stringify(logs);

  } catch (e) {
    Logger.log('Critical Error in getInspectionLogs: ' + e.toString());
    // Return empty array string on error
    return JSON.stringify(getSampleInspectionLogs());
  }
}

/**
 * Helper to format time values (handles Date objects and strings)
 */
function formatTimeValue(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Vientiane', 'HH:mm');
  }
  return val ? val.toString() : '';
}

/**
 * Get sample inspection logs for testing
 */
function getSampleInspectionLogs() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  return [
    {
      id: 'insp-001',
      timestamp: today,
      dateDisplay: Utilities.formatDate(today, 'Asia/Vientiane', 'MMM dd, yyyy'),
      timeDisplay: '14:30',
      siteId: 'site-001',
      siteName: 'Crowne Plaza Vientiane',
      inspectorId: 'guard-001',
      inspectorName: 'Somchai K.',
      route: 'A',
      guardId: 'guard-002',
      guardName: 'Khamphone L.',
      score: 4.8,
      status: 'normal',
      notes: 'All checkpoints verified. Guard in proper uniform.',
      photos: []
    },
    {
      id: 'insp-002',
      timestamp: today,
      dateDisplay: Utilities.formatDate(today, 'Asia/Vientiane', 'MMM dd, yyyy'),
      timeDisplay: '11:15',
      siteId: 'site-002',
      siteName: 'BCEL Headquarters',
      inspectorId: 'guard-003',
      inspectorName: 'Viengkham P.',
      route: 'B',
      guardId: 'guard-004',
      guardName: 'Bounmy S.',
      score: 3.2,
      status: 'has_issues',
      notes: 'Guard found sleeping. Written warning issued.',
      photos: []
    },
    {
      id: 'insp-003',
      timestamp: yesterday,
      dateDisplay: Utilities.formatDate(yesterday, 'Asia/Vientiane', 'MMM dd, yyyy'),
      timeDisplay: '09:45',
      siteId: 'site-003',
      siteName: 'Australian Embassy',
      inspectorId: 'guard-001',
      inspectorName: 'Somchai K.',
      route: 'Special',
      guardId: 'guard-005',
      guardName: 'Thongkham V.',
      score: 5.0,
      status: 'normal',
      notes: 'Excellent performance. All protocols followed.',
      photos: []
    }
  ];
}

/**
 * Get single inspection detail
 */
function getInspectionDetail(logId) {
  const logs = getInspectionLogs({});
  return logs.find(l => l.id === logId);
}

/**
 * Export inspection logs to spreadsheet
 */
function exportInspectionLogs(filters) {
  try {
    const logs = getInspectionLogs(filters);

    const ss = SpreadsheetApp.create('Inspection Logs Export - ' + new Date().toISOString().split('T')[0]);
    const sheet = ss.getActiveSheet();

    // Headers
    sheet.appendRow(['Date', 'Time', 'Site', 'Inspector', 'Route', 'Guard Evaluated', 'Score', 'Status', 'Notes']);

    // Data
    logs.forEach(log => {
      sheet.appendRow([
        log.dateDisplay,
        log.timeDisplay,
        log.siteName,
        log.inspectorName,
        log.route,
        log.guardName,
        log.score,
        log.status,
        log.notes
      ]);
    });

    return ss.getUrl();
  } catch (e) {
    Logger.log('Error in exportInspectionLogs: ' + e.message);
    throw e;
  }
}
