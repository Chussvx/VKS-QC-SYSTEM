/**
 * Guards.gs - Guard management backend
 * 
 * CRUD operations for guards.
 */

/**
 * Get all guards with optional filters
 * @param {Object} filters - Filter options
 * @returns {Array} Guard objects
 */
function getGuards(filters) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const sheet = ss.getSheetByName(SHEET_GUARDS);
    
    if (!sheet) {
      throw new Error('Guards sheet not found. Run Setup first.');
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // 1. Map rows to objects
    let guards = rows.map(row => {
      const guard = {};
      headers.forEach((header, i) => {
        guard[header] = row[i];
      });
      return guard;
    });

    // 2. [NEW] DYNAMIC OVERRIDE: Check for Active Scans
    // We want to override the static 'siteId' if the guard has checked in today.
    try {
      const scansSheet = ss.getSheetByName('Scans');
      const sitesSheet = ss.getSheetByName('Sites');
      
      if (scansSheet && sitesSheet) {
          const scansData = scansSheet.getDataRange().getValues();
          const sitesData = sitesSheet.getDataRange().getValues();
          const todayStr = Utilities.formatDate(new Date(), 'Asia/Vientiane', 'yyyy-MM-dd');

          // Helper: Get Index (Copy of Patrol.gs logic)
          const getIdx = (hdrs, names) => {
             const lower = hdrs.map(h => String(h).trim().toLowerCase());
             for(const n of names) { const i = lower.indexOf(n.toLowerCase()); if(i!==-1) return i; }
             return -1;
          };

          const scHeaders = scansData[0];
          const scSiteIdx = getIdx(scHeaders, ['siteId']);
          const scGuardIdx = getIdx(scHeaders, ['guardId']);
          const scDateIdx = getIdx(scHeaders, ['timestamp']);
          const scStatusIdx = getIdx(scHeaders, ['status']);

          // Build Map: Guard -> Latest Site ID
          const activeAssignments = {}; // { guardId: { siteId: '...', source: 'scan' } }
          
          // Site Key Map (for normalizing VKS-A-001 -> SITE-UUID)
          const siteKeyToId = {};
          const sHeaders = sitesData[0];
          const sIdIdx = sHeaders.indexOf('id');
          const sCodeIdx = sHeaders.indexOf('code');
          
          sitesData.slice(1).forEach(s => {
             if(s[sIdIdx]) siteKeyToId[String(s[sIdIdx]).toUpperCase()] = s[sIdIdx];
             if(s[sCodeIdx]) siteKeyToId[String(s[sCodeIdx]).toUpperCase()] = s[sIdIdx];
          });

          // Process Scans
          scansData.slice(1).forEach(row => {
             let dStr = '';
             try { dStr = Utilities.formatDate(new Date(row[scDateIdx]), 'Asia/Vientiane', 'yyyy-MM-dd'); }catch(e){}
             
             if (dStr === todayStr) {
                 const status = String(row[scStatusIdx] || '').toUpperCase().trim();
                 if (status === 'CHECKIN') {
                     const rawGuard = String(row[scGuardIdx] || '').trim();
                     const rawSite = String(row[scSiteIdx] || '').trim();
                     const siteId = siteKeyToId[rawSite.toUpperCase()] || rawSite;
                     
                     if (rawGuard && siteId) {
                        activeAssignments[rawGuard] = siteId;
                     }
                 }
             }
          });

          // Apply Overrides
          guards.forEach(g => {
              // Check by ID or EmpID
              const activeSite = activeAssignments[g.id] || activeAssignments[g.empId];
              if (activeSite) {
                 g.siteId = activeSite;
                 g.status = 'active'; // Force status active if scanning
              }
          });
      }
    } catch (e) {
      Logger.log('Dynamic Guard Override Failed: ' + e.message);
      // Continue with static data on error
    }
    
    // Apply filters
    if (filters) {
      if (filters.siteId) {
        guards = guards.filter(g => g.siteId === filters.siteId);
      }
      if (filters.status) {
        guards = guards.filter(g => g.status === filters.status);
      }
      if (filters.search) {
        const search = filters.search.toLowerCase();
        guards = guards.filter(g => 
          g.name.toLowerCase().includes(search) ||
          g.empId.toLowerCase().includes(search)
        );
      }
    }
    
    return guards;
  } catch (e) {
    Logger.log('Error in getGuards: ' + e.message);
    throw e;
  }
}

/**
 * Get single guard detail by ID
 * @param {string} guardId - Guard ID
 * @returns {Object} Guard object with full details
 */
function getGuardDetail(guardId) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const sheet = ss.getSheetByName(SHEET_GUARDS);
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    const idIdx = headers.indexOf('id');
    const empIdIdx = headers.indexOf('empId');
    
    const row = rows.find(r => 
      (idIdx !== -1 && String(r[idIdx]) === String(guardId)) || 
      (empIdIdx !== -1 && String(r[empIdIdx]) === String(guardId))
    );
    
    if (!row) {
      throw new Error('Guard not found: ' + guardId);
    }
    
    const guard = {};
    headers.forEach((header, i) => {
      guard[header] = row[i];
    });
    
    // Get assigned site info
    if (guard.siteId) {
      try {
        const sitesSheet = ss.getSheetByName(SHEET_SITES);
        const sitesData = sitesSheet.getDataRange().getValues();
        const siteRow = sitesData.slice(1).find(r => r[0] === guard.siteId);
        if (siteRow) {
          guard.siteName = siteRow[2]; // nameEN
        }
      } catch (e) {
        // Site not found, ignore
      }
    }
    
    return guard;
  } catch (e) {
    Logger.log('Error in getGuardDetail: ' + e.message);
    throw e;
  }
}

/**
 * Save guard (create or update)
 * @param {Object} data - Guard data
 * @returns {Object} Result with success status
 */
function saveGuard(data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const sheet = ss.getSheetByName(SHEET_GUARDS);
    
    const now = new Date().toISOString();
    const isEdit = !!data.id;
    
    if (isEdit) {
      // Update existing
      const allData = sheet.getDataRange().getValues();
      const headers = allData[0];
      const rowIndex = allData.findIndex((row, i) => i > 0 && row[0] === data.id);
      
      if (rowIndex === -1) {
        throw new Error('Guard not found');
      }
      
      headers.forEach((header, colIndex) => {
        if (data.hasOwnProperty(header) && header !== 'id' && header !== 'createdAt') {
          sheet.getRange(rowIndex + 1, colIndex + 1).setValue(data[header]);
        }
      });
      sheet.getRange(rowIndex + 1, headers.indexOf('updatedAt') + 1).setValue(now);
      
      // Modernization: Invalidate cache and trigger signal
      CacheService.getScriptCache().remove('vks_guard_options');
      if (typeof setUpdateSignal === 'function') setUpdateSignal('guards');
      
      return { success: true, id: data.id };
    } else {
      // Create new
      const newId = 'guard-' + Utilities.getUuid().substring(0, 8);
      const headers = COLUMNS.guards;
      
      const newRow = headers.map(header => {
        if (header === 'id') return newId;
        if (header === 'createdAt') return now;
        if (header === 'updatedAt') return now;
        if (header === 'status') return data.status || 'active';
        return data[header] || '';
      });
      
      sheet.appendRow(newRow);
      
      // Modernization: Invalidate cache and trigger signal
      CacheService.getScriptCache().remove('vks_guard_options');
      if (typeof setUpdateSignal === 'function') setUpdateSignal('guards');
      
      return { success: true, id: newId };
    }
  } catch (e) {
    Logger.log('Error in saveGuard: ' + e.message);
    throw e;
  }
}

/**
 * Update guard status
 * @param {string} guardId - Guard ID
 * @param {string} status - New status
 * @returns {Object} Result
 */
function updateGuardStatus(guardId, status) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const sheet = ss.getSheetByName(SHEET_GUARDS);
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rowIndex = data.findIndex((row, i) => i > 0 && row[0] === guardId);
    
    if (rowIndex === -1) {
      throw new Error('Guard not found');
    }
    
    const statusCol = headers.indexOf('status') + 1;
    const updatedCol = headers.indexOf('updatedAt') + 1;
    
    sheet.getRange(rowIndex + 1, statusCol).setValue(status);
    sheet.getRange(rowIndex + 1, updatedCol).setValue(new Date().toISOString());
    
    // Modernization: Invalidate cache and trigger signal
    CacheService.getScriptCache().remove('vks_guard_options');
    if (typeof setUpdateSignal === 'function') setUpdateSignal('guards');
    
    return { success: true };
  } catch (e) {
    Logger.log('Error in updateGuardStatus: ' + e.message);
    throw e;
  }
}

/**
 * Get dropdown options for guard selection
 * @returns {Array} Options for dropdown
 */
/**
 * Get dropdown options for guard selection
 * Performance: Uses CacheService for 10-minute caching.
 * @returns {Array} Options for dropdown
 */
function getGuardOptions() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'vks_guard_options';
  const cached = cache.get(cacheKey);
  
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      Logger.log('[GuardOptions] Cache error: ' + e.message);
    }
  }

  try {
    const guards = getGuards({ status: 'active' });
    const opts = guards.map(g => ({
      value: g.id,
      label: g.empId + ' - ' + g.name
    }));

    // Cache for 10 minutes (600 seconds)
    try {
      cache.put(cacheKey, JSON.stringify(opts), 600);
    } catch (e) {
      Logger.log('[GuardOptions] Caching too large: ' + e.message);
    }

    return opts;
  } catch (e) {
    Logger.log('Error in getGuardOptions: ' + e.message);
    return [];
  }
}
