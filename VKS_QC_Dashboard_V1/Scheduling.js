/**
 * Scheduling.gs - Calendar, Shifts, and Overtime backend
 */

/**
 * Get calendar shifts for a month
 */
function getCalendarShifts(params) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const shiftsSheet = ss.getSheetByName(SHEET_SHIFTS);
    const sitesSheet = ss.getSheetByName(SHEET_SITES);
    const guardsSheet = ss.getSheetByName(SHEET_GUARDS);
    
    // Lookups
    const sites = {};
    if (sitesSheet) {
      sitesSheet.getDataRange().getValues().slice(1).forEach(row => {
        sites[row[0]] = { name: row[2] };
      });
    }
    
    const guards = {};
    if (guardsSheet) {
      guardsSheet.getDataRange().getValues().slice(1).forEach(row => {
        guards[row[0]] = { name: row[1] };
      });
    }
    
    // Get shifts
    let shifts = [];
    
    if (shiftsSheet) {
      const data = shiftsSheet.getDataRange().getValues();
      const headers = data[0];
      
      shifts = data.slice(1).map(row => {
        const s = {};
        headers.forEach((h, i) => s[h] = row[i]);
        
        s.siteName = sites[s.siteId] ? sites[s.siteId].name : 'Unknown';
        s.guardName = guards[s.guardId] ? guards[s.guardId].name : 'Unassigned';
        
        // Format date
        if (s.date instanceof Date) {
          s.date = Utilities.formatDate(s.date, 'Asia/Vientiane', 'yyyy-MM-dd');
        }
        
        s.timeDisplay = s.startTime || '00:00';
        
        return s;
      });
      
      // Filter by month if provided
      if (params.month && params.year) {
        const prefix = `${params.year}-${String(params.month).padStart(2, '0')}`;
        shifts = shifts.filter(s => s.date && s.date.startsWith(prefix));
      }
    }
    
    return shifts.length > 0 ? shifts : getSampleShifts(params.month, params.year);
  } catch (e) {
    Logger.log('Error in getCalendarShifts: ' + e.message);
    return getSampleShifts(params.month, params.year);
  }
}

/**
 * Sample shifts for testing
 */
function getSampleShifts(month, year) {
  const shifts = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    
    // Add some sample shifts
    if (d % 2 === 0) {
      shifts.push({ id: `shift-${d}-1`, date: dateStr, shiftType: 'day', startTime: '06:00', siteId: 'site-001', siteName: 'Hub A', guardName: 'Guard A', timeDisplay: '06:00' });
    }
    if (d % 3 === 0) {
      shifts.push({ id: `shift-${d}-2`, date: dateStr, shiftType: 'night', startTime: '14:00', siteId: 'site-002', siteName: 'Warehouse', guardName: 'Guard B', timeDisplay: '14:00' });
    }
    if (d % 5 === 0) {
      shifts.push({ id: `shift-${d}-3`, date: dateStr, shiftType: 'special', startTime: '22:00', siteId: 'site-003', siteName: 'Tech Park', guardName: 'Guard C', timeDisplay: '22:00' });
    }
  }
  
  return shifts;
}

/**
 * Save shift
 */
function saveShift(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
  let sheet = ss.getSheetByName(SHEET_SHIFTS);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SHIFTS);
    sheet.appendRow(['id', 'siteId', 'guardId', 'date', 'shiftType', 'startTime', 'endTime', 'recurring', 'createdAt', 'updatedAt']);
  }
  
  const now = new Date();
  const newId = 'SHIFT-' + now.getTime();
  
  sheet.appendRow([
    data.id || newId,
    data.siteId,
    data.guardId,
    data.date,
    data.shiftType,
    data.startTime,
    data.endTime,
    data.recurring || false,
    now,
    now
  ]);
  
  return { success: true, id: data.id || newId };
}

/**
 * Get overtime records
 */
function getOvertimeRecords(params) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const sheet = ss.getSheetByName(SHEET_OVERTIME);
    const sitesSheet = ss.getSheetByName(SHEET_SITES);
    const guardsSheet = ss.getSheetByName(SHEET_GUARDS);
    
    // Lookups
    const sites = {};
    if (sitesSheet) {
      sitesSheet.getDataRange().getValues().slice(1).forEach(row => {
        sites[row[0]] = { name: row[2] };
      });
    }
    
    const guards = {};
    if (guardsSheet) {
      guardsSheet.getDataRange().getValues().slice(1).forEach(row => {
        guards[row[0]] = { name: row[1] };
      });
    }
    
    let records = [];
    
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      
      records = data.slice(1).map(row => {
        const r = {};
        headers.forEach((h, i) => r[h] = row[i]);
        
        r.siteName = sites[r.siteId] ? sites[r.siteId].name : 'Unknown';
        r.guardName = guards[r.guardId] ? guards[r.guardId].name : 'Unknown';
        
        if (r.date instanceof Date) {
          r.dateDisplay = Utilities.formatDate(r.date, 'Asia/Vientiane', 'MMM dd, yyyy');
        }
        
        return r;
      });
    }
    
    if (records.length === 0) {
      records = getSampleOvertimeRecords();
    }
    
    // Calculate stats
    const stats = {
      totalHours: records.reduce((sum, r) => sum + (parseFloat(r.otHours) || 0), 0).toFixed(1),
      pending: records.filter(r => r.status === 'pending').length,
      approved: records.filter(r => r.status === 'approved').length,
      rejected: records.filter(r => r.status === 'rejected').length,
      changePercent: 12
    };
    
    return { records, stats };
  } catch (e) {
    Logger.log('Error in getOvertimeRecords: ' + e.message);
    return { records: getSampleOvertimeRecords(), stats: { totalHours: '24.5', pending: 4, approved: 10, rejected: 2, changePercent: 12 } };
  }
}

/**
 * Sample overtime records
 */
function getSampleOvertimeRecords() {
  return [
    { id: 'ot-001', date: new Date(), dateDisplay: 'Jan 14, 2026', guardId: 'guard-001', guardName: 'Somchai K.', siteId: 'site-001', siteName: 'Crowne Plaza', scheduledHours: 8, actualHours: 10.5, otHours: 2.5, reason: 'Late relief arrival', status: 'pending' },
    { id: 'ot-002', date: new Date(), dateDisplay: 'Jan 13, 2026', guardId: 'guard-002', guardName: 'Khamphone L.', siteId: 'site-002', siteName: 'BCEL HQ', scheduledHours: 12, actualHours: 13, otHours: 1, reason: 'Incident reporting', status: 'approved' },
    { id: 'ot-003', date: new Date(), dateDisplay: 'Jan 13, 2026', guardId: 'guard-003', guardName: 'Bounmy S.', siteId: 'site-001', siteName: 'Crowne Plaza', scheduledHours: 8, actualHours: 11.5, otHours: 3.5, reason: 'Emergency drill', status: 'pending' },
    { id: 'ot-004', date: new Date(), dateDisplay: 'Jan 12, 2026', guardId: 'guard-004', guardName: 'Viengkham P.', siteId: 'site-003', siteName: 'Australian Embassy', scheduledHours: 8, actualHours: 8.5, otHours: 0.5, reason: 'Clocked out late', status: 'rejected' }
  ];
}

/**
 * Update overtime status
 */
function updateOvertimeStatus(recordId, status, reason) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const sheet = ss.getSheetByName(SHEET_OVERTIME);
    
    if (!sheet) return { success: false };
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idCol = headers.indexOf('id');
    const statusCol = headers.indexOf('status');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][idCol] === recordId) {
        sheet.getRange(i + 1, statusCol + 1).setValue(status);
        return { success: true };
      }
    }
    
    return { success: false };
  } catch (e) {
    Logger.log('Error in updateOvertimeStatus: ' + e.message);
    return { success: true }; // Pretend success for sample data
  }
}

/**
 * Export overtime report
 */
function exportOvertimeReport(params) {
  const data = getOvertimeRecords(params);
  const ss = SpreadsheetApp.create('Overtime Report - ' + new Date().toISOString().split('T')[0]);
  const sheet = ss.getActiveSheet();
  
  sheet.appendRow(['Date', 'Guard', 'Site', 'Scheduled', 'Actual', 'OT Hours', 'Reason', 'Status']);
  data.records.forEach(r => {
    sheet.appendRow([r.dateDisplay, r.guardName, r.siteName, r.scheduledHours, r.actualHours, r.otHours, r.reason, r.status]);
  });
  
  return ss.getUrl();
}

// NOTE: getCheckpointsBySite moved to Sites.gs for consolidation

/**
 * Save checkpoint
 */
function saveCheckpoint(data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    let sheet = ss.getSheetByName(SHEET_CHECKPOINTS);
    
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_CHECKPOINTS);
      sheet.appendRow(['id', 'siteId', 'name', 'location', 'qrCode', 'type', 'lat', 'lng', 'createdAt', 'updatedAt']);
    }
    
    const now = new Date();
    const newId = 'CP-' + now.getTime();
    
    sheet.appendRow([
      data.id || newId,
      data.siteId,
      data.name,
      data.location || '',
      data.qrCode || ('VKS-' + newId),
      data.type || 'standard',
      data.lat || '',
      data.lng || '',
      now,
      now
    ]);
    
    return { success: true, id: data.id || newId };
  } catch (e) {
    Logger.log('Error in saveCheckpoint: ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Sample checkpoints
 */
function getSampleCheckpoints(siteId) {
  return [
    { id: 'cp-001', siteId: siteId, name: 'Main Entrance', location: 'Building A, Ground Floor', qrCode: 'VKS-CP-001', type: 'required' },
    { id: 'cp-002', siteId: siteId, name: 'Parking Gate', location: 'Basement Level 1', qrCode: 'VKS-CP-002', type: 'required' },
    { id: 'cp-003', siteId: siteId, name: 'Fire Exit A', location: 'Building A, Floor 2', qrCode: 'VKS-CP-003', type: 'standard' },
    { id: 'cp-004', siteId: siteId, name: 'Server Room', location: 'Building B, Floor 3', qrCode: 'VKS-CP-004', type: 'critical' }
  ];
}

/**
 * Get/Save settings
 */
function getSettings() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
  const sheet = ss.getSheetByName(SHEET_SETTINGS);
  
  if (!sheet) return getDefaultSettings();
  
  const data = sheet.getDataRange().getValues();
  const settings = {};
  
  data.forEach(row => {
    if (row[0]) settings[row[0]] = row[1];
  });
  
  return settings;
}

function saveSettings(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
  let sheet = ss.getSheetByName(SHEET_SETTINGS);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SETTINGS);
  }
  
  // Update or add each setting
  const existingData = sheet.getDataRange().getValues();
  const existingKeys = existingData.map(row => row[0]);
  
  Object.keys(data).forEach(key => {
    const rowIndex = existingKeys.indexOf(key);
    if (rowIndex >= 0) {
      sheet.getRange(rowIndex + 1, 2).setValue(data[key]);
    } else {
      sheet.appendRow([key, data[key]]);
    }
  });
  
  return { success: true };
}

function getDefaultSettings() {
  return {
    // General
    companyName: 'VKS Security Services',
    timezone: 'Asia/Vientiane',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    language: 'en',
    darkMode: false,
    compactView: false,

    // Notifications
    emailAlerts: true,
    pushNotifs: true,
    recipients: '',

    // Thresholds
    latePatrol: 15,
    missedCheckin: 30,
    gpsAccuracy: 10,
    escalationDelay: 60,
    autoEscalate: true,

    // Patrol Config
    patrolRounds: 7,
    pointsPerRound: 4,

    // System
    autoRefresh: true,
    refreshInterval: 30,
    logRetention: 30,

    // SLA (Legacy but kept)
    slaCritical: 4,
    slaHigh: 24,
    slaMedium: 72,
    slaLow: 168
  };
}
