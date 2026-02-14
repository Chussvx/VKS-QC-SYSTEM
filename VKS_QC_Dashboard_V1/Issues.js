/**
 * Issues.gs - Incidents and Complaints backend
 * 
 * Uses separate tabs: 'Incidents' and 'Complaints'
 * Sheet constants defined in Config.gs: SHEET_INCIDENTS, SHEET_COMPLAINTS
 */

/**
 * Build a lookup map of siteId -> siteName
 * Uses same column detection as getSites() for consistency
 * @returns {Object} Map where keys are siteId and values are siteName
 */
function buildSiteLookupMap_() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    var sheet = ss.getSheetByName('Sites');
    var lookup = {};

    if (sheet && sheet.getLastRow() > 1) {
      var data = sheet.getDataRange().getValues();
      var headers = data[0];

      // Find ID column - try multiple possible names
      var idCol = -1;
      var nameCol = -1;

      for (var h = 0; h < headers.length; h++) {
        var header = String(headers[h]).toLowerCase().trim();
        // ID column detection
        if (idCol === -1 && header === 'id') idCol = h;
        // Name column detection - try multiple variations
        if (nameCol === -1 && (header === 'nameen' || header === 'name_en' || header === 'site name' || header === 'name' || header === 'sitename')) {
          nameCol = h;
        }
      }

      // Log for debugging
      Logger.log('buildSiteLookupMap_: idCol=' + idCol + ', nameCol=' + nameCol + ', headers: ' + JSON.stringify(headers));

      if (idCol === -1 || nameCol === -1) {
        Logger.log('buildSiteLookupMap_: Could not find id or name columns');
        return {};
      }

      for (var r = 1; r < data.length; r++) {
        var id = String(data[r][idCol] || '').trim();
        var name = String(data[r][nameCol] || '').trim() || 'Unknown Site';
        if (id) {
          lookup[id] = name;
          // Also map by name for cases where siteName was saved instead of siteId
          lookup[name] = name;
        }
      }

      Logger.log('buildSiteLookupMap_: Built lookup with ' + Object.keys(lookup).length + ' entries');
    }
    return lookup;
  } catch (e) {
    Logger.log('Error building site lookup: ' + e.message);
    return {};
  }
}

/**
 * Get incidents with stats
 * Reads from Incidents sheet, falls back to sample data if empty
 */
function getIncidents(filters) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    var sheet = ss.getSheetByName(SHEET_INCIDENTS);

    var incidents = [];

    if (sheet && sheet.getLastRow() > 1) {
      var data = sheet.getDataRange().getValues();
      var headers = data[0];

      for (var r = 1; r < data.length; r++) {
        var row = data[r];
        var inc = {};
        for (var c = 0; c < headers.length; c++) {
          inc[headers[c]] = row[c];
        }

        // Add display fields - resolve siteName from siteId
        if (!inc.siteName && inc.siteId) {
          if (!siteLookup) var siteLookup = buildSiteLookupMap_();
          inc.siteName = siteLookup[inc.siteId] || inc.siteId || 'Unknown Site';
        } else {
          inc.siteName = inc.siteName || 'Unknown Site';
        }
        inc.reporterName = inc.reportedBy || 'Unknown';

        // Format dates
        if (inc.incidentTime instanceof Date) {
          inc.dateDisplay = Utilities.formatDate(inc.incidentTime, 'Asia/Vientiane', 'MMM dd, yyyy');
          inc.timeDisplay = Utilities.formatDate(inc.incidentTime, 'Asia/Vientiane', 'HH:mm');
        } else if (inc.reportedTime instanceof Date) {
          inc.dateDisplay = Utilities.formatDate(inc.reportedTime, 'Asia/Vientiane', 'MMM dd, yyyy');
          inc.timeDisplay = Utilities.formatDate(inc.reportedTime, 'Asia/Vientiane', 'HH:mm');
        } else {
          inc.dateDisplay = 'N/A';
          inc.timeDisplay = 'N/A';
        }

        // Calculate live SLA status from dueDate
        inc.slaStatus = calculateSLAStatus(inc);
        inc.slaDue = formatSLADue(inc);

        incidents.push(inc);
      }
    }

    // If no data, return inline sample
    if (incidents.length === 0) {
      var now = new Date();
      incidents = [
        {
          id: 'INC-SAMPLE-001',
          title: 'Sample Incident (No Data)',
          description: 'No incidents in sheet. Create one using +New Incident.',
          siteId: 'site-001',
          siteName: 'Sample Site',
          category: 'access',
          severity: 'medium',
          status: 'waiting',
          reportedBy: 'System',
          dateDisplay: Utilities.formatDate(now, 'Asia/Vientiane', 'MMM dd, yyyy'),
          timeDisplay: Utilities.formatDate(now, 'Asia/Vientiane', 'HH:mm'),
          slaStatus: 'on_track',
          slaDue: 'N/A'
        }
      ];
    }

    // Calculate stats
    var critical = 0, overdue = 0, resolved = 0;
    for (var i = 0; i < incidents.length; i++) {
      if (incidents[i].severity === 'critical') critical++;
      if (incidents[i].slaStatus === 'overdue') overdue++;
      if (incidents[i].status === 'resolved' || incidents[i].status === 'closed') resolved++;
    }

    var stats = {
      total: incidents.length,
      critical: critical,
      overdue: overdue,
      resolved: resolved,
      resolvedRate: incidents.length > 0 ? Math.round((resolved / incidents.length) * 100) : 0
    };

    // Build result structure
    var result = { incidents: incidents, stats: stats };

    // CRITICAL: JSON serialization to prevent Date object null returns
    // See VKS Debugging Patterns - Serialization Safety
    result = JSON.parse(JSON.stringify(result));

    Logger.log('getIncidents returning ' + incidents.length + ' incidents');
    return result;
  } catch (e) {
    Logger.log('Error in getIncidents: ' + e.message + ' | Stack: ' + e.stack);
    // Return error placeholder but never null
    return {
      incidents: [{
        id: 'INC-ERROR',
        title: 'Error loading incidents',
        description: String(e.message || 'Unknown error'),
        siteName: '-',
        category: '-',
        severity: 'low',
        status: 'waiting',
        reportedBy: '-',
        dateDisplay: '-',
        timeDisplay: '-',
        slaStatus: '-',
        slaDue: '-'
      }],
      stats: { total: 0, critical: 0, overdue: 0, resolvedRate: 0 }
    };
  }
}

/**
 * Get complaints with stats
 * Reads from Complaints sheet, falls back to sample data if empty
 */
function getComplaints(filters) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    var sheet = ss.getSheetByName(SHEET_COMPLAINTS);

    var complaints = [];

    if (sheet && sheet.getLastRow() > 1) {
      var data = sheet.getDataRange().getValues();
      var headers = data[0];

      for (var r = 1; r < data.length; r++) {
        var row = data[r];
        var cmp = {};
        for (var c = 0; c < headers.length; c++) {
          cmp[headers[c]] = row[c];
        }

        // Add display fields - resolve siteName from siteId
        if (!cmp.siteName && cmp.siteId) {
          if (!siteLookup) var siteLookup = buildSiteLookupMap_();
          cmp.siteName = siteLookup[cmp.siteId] || cmp.siteId || 'Unknown Site';
        } else {
          cmp.siteName = cmp.siteName || 'Unknown Site';
        }

        // Format dates
        if (cmp.timestamp instanceof Date) {
          cmp.dateDisplay = Utilities.formatDate(cmp.timestamp, 'Asia/Vientiane', 'MMM dd, yyyy');
          cmp.timeDisplay = Utilities.formatDate(cmp.timestamp, 'Asia/Vientiane', 'HH:mm');
        } else {
          cmp.dateDisplay = 'N/A';
          cmp.timeDisplay = 'N/A';
        }

        // Default values
        cmp.isOverdue = false;
        cmp.dueDisplay = cmp.dueDate instanceof Date
          ? Utilities.formatDate(cmp.dueDate, 'Asia/Vientiane', 'MMM dd, HH:mm')
          : '-';

        complaints.push(cmp);
      }
    }

    // If no data, return inline sample
    if (complaints.length === 0) {
      var now = new Date();
      complaints = [
        {
          id: 'CMP-SAMPLE-001',
          customerName: 'Sample Customer (No Data)',
          siteId: 'site-001',
          siteName: 'Sample Site',
          category: 'service',
          severity: 'medium',
          priority: 'p2',
          status: 'waiting',
          description: 'No complaints in sheet. Create one using +New Case.',
          dateDisplay: Utilities.formatDate(now, 'Asia/Vientiane', 'MMM dd, yyyy'),
          timeDisplay: Utilities.formatDate(now, 'Asia/Vientiane', 'HH:mm'),
          dueDisplay: 'N/A',
          isOverdue: false
        }
      ];
    }

    // Calculate stats
    var waiting = 0, inProgress = 0, resolved = 0;
    for (var i = 0; i < complaints.length; i++) {
      if (complaints[i].status === 'waiting') waiting++;
      if (complaints[i].status === 'in_progress') inProgress++;
      if (complaints[i].status === 'resolved' || complaints[i].status === 'closed') resolved++;
    }

    var stats = {
      total: complaints.length,
      waiting: waiting,
      inProgress: inProgress,
      resolved: resolved,
      resolvedRate: complaints.length > 0 ? Math.round((resolved / complaints.length) * 100) : 0
    };

    // Build result structure
    var result = { complaints: complaints, stats: stats };

    // CRITICAL: JSON serialization to prevent Date object null returns
    // See VKS Debugging Patterns - Serialization Safety
    result = JSON.parse(JSON.stringify(result));

    return result;
  } catch (e) {
    Logger.log('Error in getComplaints: ' + e.message);
    return {
      complaints: [{
        id: 'CMP-ERROR',
        customerName: 'Error loading complaints',
        description: e.message,
        siteName: '-',
        category: '-',
        severity: 'low',
        status: 'waiting',
        priority: 'p4',
        dateDisplay: '-',
        timeDisplay: '-',
        dueDisplay: '-',
        isOverdue: false
      }],
      stats: { total: 1, waiting: 1, inProgress: 0, resolvedRate: 0 }
    };
  }
}

/**
 * Save incident to Incidents tab
 */
function saveIncident(data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    let sheet = ss.getSheetByName(SHEET_INCIDENTS);

    if (!sheet) {
      // Create sheet with headers
      sheet = ss.insertSheet(SHEET_INCIDENTS);
      sheet.appendRow([
        'id', 'title', 'description', 'location', 'siteId', 'category', 'severity', 'status',
        'incidentTime', 'reportedTime', 'reportedBy', 'reportedTo',
        'responseTime', 'respondedBy', 'resolvedTime',
        'injuries', 'propertyDamage', 'estimatedLoss', 'authoritiesNotified',
        'policeReportNo', 'cctvAvailable', 'photos', 'witnesses',
        'immediateActions', 'notes', 'dueDate', 'createdAt', 'updatedAt'
      ]);
    }

    const now = new Date();
    const isEdit = !!data.id;

    if (isEdit) {
      // Update existing
      const allData = sheet.getDataRange().getValues();
      for (let i = 1; i < allData.length; i++) {
        if (allData[i][0] === data.id) {
          // Update row
          const headers = allData[0];
          const row = headers.map(h => data[h] !== undefined ? data[h] : allData[i][headers.indexOf(h)]);
          row[headers.indexOf('updatedAt')] = now;
          sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
          setUpdateSignal('master');
          return { success: true, id: data.id };
        }
      }
    }

    // Create new
    const newId = 'INC-' + Utilities.formatDate(now, 'Asia/Vientiane', 'yyyyMMdd') + '-' +
      Math.random().toString(36).substr(2, 4).toUpperCase();

    // Normalize p1/p2/p3/p4 → critical/high/medium/low (frontend sends priority codes as severity)
    const priorityToSeverity = { 'p1': 'critical', 'p2': 'high', 'p3': 'medium', 'p4': 'low' };
    const normalizedSeverity = priorityToSeverity[data.severity] || data.severity || 'medium';

    const dueDate = calculateDueDate(normalizedSeverity, data.incidentTime || now);

    // SCHEMA MIGRATION: Ensure location column exists for existing sheets
    const existingHeaders = sheet.getDataRange().getValues()[0];
    if (existingHeaders.indexOf('location') === -1) {
      sheet.getRange(1, existingHeaders.length + 1).setValue('location');
    }

    // Build row dynamically based on current headers (safe for schema changes)
    const currentHeaders = sheet.getDataRange().getValues()[0];
    const newRow = currentHeaders.map(h => {
      switch (h) {
        case 'id': return newId;
        case 'title': return data.title || '';
        case 'description': return data.description || '';
        case 'location': return data.location || '';
        case 'siteId': return data.siteId || '';
        case 'category': return data.category || '';
        case 'severity': return normalizedSeverity;
        case 'status': return 'waiting';
        case 'incidentTime':
          return (data.incidentTime && typeof data.incidentTime === 'string') ? new Date(data.incidentTime) : (data.incidentTime || now);
        case 'reportedTime':
          return (data.reportedTime && typeof data.reportedTime === 'string') ? new Date(data.reportedTime) : (data.reportedTime || now);
        case 'reportedBy': return data.reportedBy || '';
        case 'reportedTo': return data.reportedTo || '';
        case 'responseTime':
          return (data.responseTime && typeof data.responseTime === 'string') ? new Date(data.responseTime) : (data.responseTime || '');
        case 'respondedBy': return data.respondedBy || '';
        case 'resolvedTime': return '';
        case 'injuries': return data.injuries || false;
        case 'propertyDamage': return data.propertyDamage || false;
        case 'estimatedLoss': return data.estimatedLoss || 0;
        case 'authoritiesNotified': return data.authoritiesNotified || false;
        case 'policeReportNo': return data.policeReportNo || '';
        case 'cctvAvailable': return data.cctvAvailable || false;
        case 'photos': return '';  // Populated after upload
        case 'witnesses': return data.witnesses || '';
        case 'immediateActions': return data.immediateActions || '';
        case 'notes': return data.notes || '';
        case 'dueDate': return dueDate;
        case 'createdAt': return now;
        case 'updatedAt': return now;
        default: return data[h] !== undefined ? data[h] : '';
      }
    });

    sheet.appendRow(newRow);

    // Upload photos to Drive if provided
    var photoData = data.photos;
    if (photoData && Array.isArray(photoData) && photoData.length > 0) {
      var photoUrls = uploadEvidence(photoData, newId);
      if (photoUrls) {
        var photosCol = currentHeaders.indexOf('photos') + 1;
        if (photosCol > 0) {
          var lastRow = sheet.getLastRow();
          sheet.getRange(lastRow, photosCol).setValue(photoUrls);
        }
      }
    }

    setUpdateSignal('master');
    return { success: true, id: newId };
  } catch (e) {
    Logger.log('Error in saveIncident: ' + e.message);
    throw e;
  }
}

/**
 * Save complaint to Complaints tab
 */
function saveComplaint(data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    let sheet = ss.getSheetByName(SHEET_COMPLAINTS);

    if (!sheet) {
      // Create sheet with headers
      sheet = ss.insertSheet(SHEET_COMPLAINTS);
      sheet.appendRow([
        'id', 'customerName', 'customerPhone', 'customerType', 'siteId', 'guardId',
        'category', 'severity', 'priority', 'status', 'description', 'resolution',
        'disciplinaryAction', 'notifiedBy', 'recordedBy', 'assignedTo', 'approvedBy',
        'timestamp', 'dueDate', 'completionDate', 'createdAt', 'updatedAt'
      ]);
    }

    // SCHEMA MIGRATION: Ensure new columns exist
    const headers = sheet.getDataRange().getValues()[0];
    const newColumns = ['customerEmail', 'evidence', 'followUpDate'];
    const missingColumns = newColumns.filter(col => headers.indexOf(col) === -1);

    if (missingColumns.length > 0) {
      sheet.getRange(1, headers.length + 1, 1, missingColumns.length).setValues([missingColumns]);
    }

    // Refresh headers for mapping
    const currentHeaders = sheet.getDataRange().getValues()[0];

    const now = new Date();
    const isEdit = !!data.id;

    if (isEdit) {
      const allData = sheet.getDataRange().getValues();
      for (let i = 1; i < allData.length; i++) {
        if (allData[i][0] === data.id) {
          // Dynamic update based on headers (including new ones)
          const row = currentHeaders.map(h => {
            if (h === 'updatedAt') return now;

            // Specific overrides for mapped fields
            if (h === 'resolution' && (data.resolutionNotes !== undefined || data.resolution !== undefined)) {
              return data.resolution || data.resolutionNotes || '';
            }
            if (h === 'timestamp' && (data.complaintTime || data.timestamp)) {
              return new Date(data.complaintTime || data.timestamp);
            }

            // Check direct data match
            if (data[h] !== undefined) return data[h];

            // Preserve existing value
            const idx = currentHeaders.indexOf(h);
            return (idx !== -1 && idx < allData[i].length) ? allData[i][idx] : '';
          });

          sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
          setUpdateSignal('master');
          return { success: true, id: data.id };
        }
      }
    }

    // Create new
    const newId = 'CMP-' + Utilities.formatDate(now, 'Asia/Vientiane', 'yyyyMMdd') + '-' +
      Math.random().toString(36).substr(2, 4).toUpperCase();

    // Derive severity from priority if not explicitly provided
    // P1=Critical, P2=High, P3=Medium, P4=Low
    const priorityToSeverity = { 'p1': 'critical', 'p2': 'high', 'p3': 'medium', 'p4': 'low' };
    const severity = data.severity || priorityToSeverity[data.priority] || 'medium';

    // Calculate due date based on severity
    const dueDate = calculateDueDate(severity, now);

    // Build row dynamically based on headers to ensure alignment
    const newRow = currentHeaders.map(h => {
      switch (h) {
        case 'id': return newId;
        case 'timestamp': return (data.timestamp || data.complaintTime) ? new Date(data.timestamp || data.complaintTime) : now;
        case 'createdAt': return now;
        case 'updatedAt': return now;
        case 'dueDate': return dueDate;
        case 'status': return 'waiting';
        case 'severity': return severity;
        case 'resolution': return data.resolution || data.resolutionNotes || '';
        case 'customerType': return data.customerType || 'client';
        case 'priority': return data.priority || 'p3';
        case 'recordedBy': return data.recordedBy || Session.getActiveUser().getEmail();

        // Explicit generic mapping for fields
        case 'customerName': return data.customerName || '';
        case 'customerPhone': return data.customerPhone || '';
        case 'siteId': return data.siteId || '';
        case 'guardId': return data.guardId || '';
        case 'category': return data.category || '';
        case 'description': return data.description || '';
        case 'notifiedBy': return data.notifiedBy || '';

        // New fields
        case 'customerEmail': return data.customerEmail || '';
        case 'evidence': return '';  // Populated after upload
        case 'followUpDate': return data.followUpDate ? new Date(data.followUpDate) : '';

        // Default fallback
        default: return data[h] !== undefined ? data[h] : '';
      }
    });

    sheet.appendRow(newRow);

    // Upload evidence photos to Drive if provided
    var evidenceData = data.evidence;
    if (evidenceData && Array.isArray(evidenceData) && evidenceData.length > 0) {
      var evidenceUrls = uploadEvidence(evidenceData, newId);
      if (evidenceUrls) {
        var evidenceCol = currentHeaders.indexOf('evidence') + 1;
        if (evidenceCol > 0) {
          var lastRow = sheet.getLastRow();
          sheet.getRange(lastRow, evidenceCol).setValue(evidenceUrls);
        }
      }
    }

    setUpdateSignal('master');
    return { success: true, id: newId };
  } catch (e) {
    Logger.log('Error in saveComplaint: ' + e.message);
    throw e;
  }
}

/**
 * Update incident status
 */
function updateIncidentStatus(id, status) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const sheet = ss.getSheetByName(SHEET_INCIDENTS);
    if (!sheet) throw new Error('Incidents sheet not found');

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const statusCol = headers.indexOf('status') + 1;
    const resolvedTimeCol = headers.indexOf('resolvedTime') + 1;
    const updatedAtCol = headers.indexOf('updatedAt') + 1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        sheet.getRange(i + 1, statusCol).setValue(status);
        sheet.getRange(i + 1, updatedAtCol).setValue(new Date());
        if (status === 'resolved' || status === 'closed') {
          sheet.getRange(i + 1, resolvedTimeCol).setValue(new Date());
        }
        setUpdateSignal('master');
        return { success: true };
      }
    }
    throw new Error('Incident not found');
  } catch (e) {
    Logger.log('Error updating incident status: ' + e.message);
    throw e;
  }
}

/**
 * Update complaint status
 */
function updateComplaintStatus(id, status) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const sheet = ss.getSheetByName(SHEET_COMPLAINTS);
    if (!sheet) throw new Error('Complaints sheet not found');

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const statusCol = headers.indexOf('status') + 1;
    const completionDateCol = headers.indexOf('completionDate') + 1;
    const updatedAtCol = headers.indexOf('updatedAt') + 1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        sheet.getRange(i + 1, statusCol).setValue(status);
        sheet.getRange(i + 1, updatedAtCol).setValue(new Date());
        if (status === 'resolved' || status === 'closed') {
          sheet.getRange(i + 1, completionDateCol).setValue(new Date());
        }
        setUpdateSignal('master');
        return { success: true };
      }
    }
    throw new Error('Complaint not found');
  } catch (e) {
    Logger.log('Error updating complaint status: ' + e.message);
    throw e;
  }
}

/**
 * Upload evidence photos to Google Drive
 * @param {Array} photos - Array of {name, type, base64} objects
 * @param {string} caseId - e.g. 'INC-20260210-AB12' or 'CMP-20260210-XY98'
 * @returns {string} Comma-separated Drive view URLs, or empty string
 */
function uploadEvidence(photos, caseId) {
  try {
    if (!photos || !Array.isArray(photos) || photos.length === 0) return '';

    // Build folder path: QC_Uploads / 2026 / 02
    var now = new Date();
    var year = now.getFullYear().toString();
    var month = ('0' + (now.getMonth() + 1)).slice(-2);

    var rootFolders = DriveApp.getFoldersByName('QC_Uploads');
    var rootFolder;
    if (rootFolders.hasNext()) {
      rootFolder = rootFolders.next();
    } else {
      rootFolder = DriveApp.createFolder('QC_Uploads');
    }

    var yearFolders = rootFolder.getFoldersByName(year);
    var yearFolder;
    if (yearFolders.hasNext()) {
      yearFolder = yearFolders.next();
    } else {
      yearFolder = rootFolder.createFolder(year);
    }

    var monthFolders = yearFolder.getFoldersByName(month);
    var monthFolder;
    if (monthFolders.hasNext()) {
      monthFolder = monthFolders.next();
    } else {
      monthFolder = yearFolder.createFolder(month);
    }

    var urls = [];
    photos.forEach(function (photo, idx) {
      try {
        // Extract raw base64 data from data URL
        var base64Data = photo.base64.split(',')[1];
        var mimeType = photo.type || 'image/jpeg';
        var ext = mimeType.indexOf('png') > -1 ? '.png' : '.jpg';
        var fileName = caseId + '_Evidence_' + (idx + 1) + ext;

        var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
        var file = monthFolder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        urls.push('https://drive.google.com/uc?export=view&id=' + file.getId());
      } catch (photoErr) {
        Logger.log('Error uploading photo ' + idx + ': ' + photoErr.message);
      }
    });

    return urls.join(',');
  } catch (e) {
    Logger.log('Error in uploadEvidence: ' + e.message);
    return '';
  }
}

/**
 * Calculate SLA due date based on severity
 */
function calculateDueDate(severity, startDate) {
  const hours = {
    'critical': 4,
    'high': 24,
    'medium': 72,
    'low': 168,
    'p1': 4,
    'p2': 24,
    'p3': 72,
    'p4': 168
  };

  const h = hours[severity] || 72;
  const due = new Date(startDate);
  due.setHours(due.getHours() + h);
  return due;
}

/**
 * Calculate SLA status
 */
function calculateSLAStatus(issue) {
  if (issue.status === 'resolved' || issue.status === 'closed') return 'completed';

  const now = new Date();
  const due = new Date(issue.dueDate);

  if (now > due) return 'overdue';

  const hoursLeft = (due - now) / 3600000;
  if (hoursLeft < 4) return 'at_risk';

  return 'on_track';
}

/**
 * Format SLA due display
 */
function formatSLADue(issue) {
  if (!issue.dueDate) return '-';
  const due = new Date(issue.dueDate);
  return Utilities.formatDate(due, 'Asia/Vientiane', 'MMM dd, HH:mm');
}

/**
 * Check if overdue
 */
function checkIfOverdue(issue) {
  if (issue.status === 'resolved' || issue.status === 'closed') return false;
  if (!issue.dueDate) return false;
  return new Date() > new Date(issue.dueDate);
}

/**
 * Format due date display
 */
function formatDueDate(issue) {
  if (issue.status === 'resolved' || issue.status === 'closed') return 'Completed';
  if (!issue.dueDate) return '-';

  var due = new Date(issue.dueDate);
  var now = new Date();
  var diff = due - now;

  if (diff < 0) {
    var hours = Math.abs(Math.floor(diff / 3600000));
    return 'Overdue (' + hours + 'h)';
  }

  return Utilities.formatDate(due, 'Asia/Vientiane', 'MMM dd, HH:mm');
}


/**
 * Export incidents
 */
function exportIncidents(filters) {
  const data = getIncidents(filters);
  const ss = SpreadsheetApp.create('Incidents Export - ' + new Date().toISOString().split('T')[0]);
  const sheet = ss.getActiveSheet();

  sheet.appendRow(['ID', 'Date', 'Site', 'Category', 'Severity', 'Status', 'Reporter', 'Description']);
  data.incidents.forEach(inc => {
    sheet.appendRow([inc.id, inc.dateDisplay, inc.siteName, inc.category, inc.severity, inc.status, inc.reportedBy, inc.description]);
  });

  return ss.getUrl();
}

/**
 * Export complaints
 */
function exportComplaints(filters) {
  const data = getComplaints(filters);
  const ss = SpreadsheetApp.create('Complaints Export - ' + new Date().toISOString().split('T')[0]);
  const sheet = ss.getActiveSheet();

  sheet.appendRow(['ID', 'Date', 'Customer', 'Site', 'Category', 'Priority', 'Status', 'Due Date']);
  data.complaints.forEach(c => {
    sheet.appendRow([c.id, c.dateDisplay, c.customerName, c.siteName, c.category, c.priority, c.status, c.dueDisplay]);
  });

  return ss.getUrl();
}

/**
 * Resolve an incident - updates status and resolution fields
 * @param {Object} data - Resolution data {id, status, resolution, rootCause, preventiveMeasures, resolvedBy, resolvedTime}
 * @returns {Object} {success: boolean, error?: string}
 */
function resolveIncident(data) {
  try {
    if (!data || !data.id) {
      return { success: false, error: 'Missing incident ID' };
    }

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    var sheet = ss.getSheetByName(SHEET_INCIDENTS);

    if (!sheet) {
      return { success: false, error: 'Incidents sheet not found' };
    }

    var allData = sheet.getDataRange().getValues();
    var headers = allData[0];

    // Find column indices
    var colMap = {};
    for (var h = 0; h < headers.length; h++) {
      colMap[headers[h]] = h;
    }

    // Find row with matching ID
    for (var r = 1; r < allData.length; r++) {
      if (allData[r][colMap['id']] === data.id) {
        // Update fields
        if (colMap['status'] !== undefined) {
          sheet.getRange(r + 1, colMap['status'] + 1).setValue(data.status || 'resolved');
        }
        if (colMap['resolution'] !== undefined) {
          sheet.getRange(r + 1, colMap['resolution'] + 1).setValue(data.resolution || '');
        } else {
          // Add column if missing
          var newCol = sheet.getLastColumn() + 1;
          sheet.getRange(1, newCol).setValue('resolution');
          sheet.getRange(r + 1, newCol).setValue(data.resolution || '');
        }
        if (colMap['rootCause'] !== undefined) {
          sheet.getRange(r + 1, colMap['rootCause'] + 1).setValue(data.rootCause || '');
        }
        if (colMap['preventiveMeasures'] !== undefined) {
          sheet.getRange(r + 1, colMap['preventiveMeasures'] + 1).setValue(data.preventiveMeasures || '');
        }
        if (colMap['resolvedTime'] !== undefined) {
          sheet.getRange(r + 1, colMap['resolvedTime'] + 1).setValue(data.resolvedTime ? new Date(data.resolvedTime) : new Date());
        }
        if (colMap['resolvedBy'] !== undefined) {
          sheet.getRange(r + 1, colMap['resolvedBy'] + 1).setValue(data.resolvedBy || '');
        }
        if (colMap['updatedAt'] !== undefined) {
          sheet.getRange(r + 1, colMap['updatedAt'] + 1).setValue(new Date());
        }

        setUpdateSignal('master');
        Logger.log('Resolved incident: ' + data.id);
        return { success: true };
      }
    }

    return { success: false, error: 'Incident not found: ' + data.id };
  } catch (e) {
    Logger.log('Error in resolveIncident: ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Resolve a complaint - updates status and resolution fields
 * @param {Object} data - Resolution data {id, status, resolution, disciplinaryAction, approvedBy, resolvedTime}
 * @returns {Object} {success: boolean, error?: string}
 */
function resolveComplaint(data) {
  try {
    if (!data || !data.id) {
      return { success: false, error: 'Missing complaint ID' };
    }

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    var sheet = ss.getSheetByName(SHEET_COMPLAINTS);

    if (!sheet) {
      return { success: false, error: 'Complaints sheet not found' };
    }

    var allData = sheet.getDataRange().getValues();
    var headers = allData[0];

    // Find column indices
    var colMap = {};
    for (var h = 0; h < headers.length; h++) {
      colMap[headers[h]] = h;
    }

    // Find row with matching ID
    for (var r = 1; r < allData.length; r++) {
      if (allData[r][colMap['id']] === data.id) {
        // Update fields
        if (colMap['status'] !== undefined) {
          sheet.getRange(r + 1, colMap['status'] + 1).setValue(data.status || 'resolved');
        }
        if (colMap['resolution'] !== undefined) {
          sheet.getRange(r + 1, colMap['resolution'] + 1).setValue(data.resolution || '');
        } else {
          // Add column if missing
          var newCol = sheet.getLastColumn() + 1;
          sheet.getRange(1, newCol).setValue('resolution');
          sheet.getRange(r + 1, newCol).setValue(data.resolution || '');
        }
        if (colMap['disciplinaryAction'] !== undefined) {
          sheet.getRange(r + 1, colMap['disciplinaryAction'] + 1).setValue(data.disciplinaryAction || '');
        }
        if (colMap['approvedBy'] !== undefined) {
          sheet.getRange(r + 1, colMap['approvedBy'] + 1).setValue(data.approvedBy || '');
        }
        if (colMap['completionDate'] !== undefined) {
          sheet.getRange(r + 1, colMap['completionDate'] + 1).setValue(data.resolvedTime ? new Date(data.resolvedTime) : new Date());
        }
        if (colMap['updatedAt'] !== undefined) {
          sheet.getRange(r + 1, colMap['updatedAt'] + 1).setValue(new Date());
        }

        setUpdateSignal('master');
        Logger.log('Resolved complaint: ' + data.id);
        return { success: true };
      }
    }

    return { success: false, error: 'Complaint not found: ' + data.id };
  } catch (e) {
    Logger.log('Error in resolveComplaint: ' + e.message);
    return { success: false, error: e.message };
  }
}

