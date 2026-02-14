/**
 * Sites.gs - Site management backend
 * 
 * CRUD operations for sites and related data.
 * Auto-syncs from VKS Patrol Dashboard
 */

// ===========================================
// SYNC FROM PATROL DASHBOARD
// ===========================================

/**
 * Sync Sites from Patrol Dashboard to QC Master
 * Reads Route A (Col A) and Route B (Col B) from Patrol Dashboard Sites tab
 * Creates entries in QC Master Sites tab with auto-generated IDs
 * @returns {Object} Sync stats {added, updated, total}
 */
function syncSitesFromPatrol() {
  try {
    const now = new Date().toISOString();

    // 1. Read source data (Patrol Dashboard)
    const patrolSS = SpreadsheetApp.openById(SPREADSHEET_ID_PATROL);
    const patrolSitesSheet = patrolSS.getSheetByName('Sites');
    if (!patrolSitesSheet) throw new Error('Patrol Sites sheet not found');

    const sourceData = patrolSitesSheet.getDataRange().getValues();

    // Extract unique sites from Cols A (Route A) & B (Route B)
    const sourceSites = [];
    let orderA = 0, orderB = 0;

    for (let i = 1; i < sourceData.length; i++) {
      const routeA = sourceData[i][0] ? sourceData[i][0].toString().trim() : '';
      const routeB = sourceData[i][1] ? sourceData[i][1].toString().trim() : '';

      if (routeA) {
        orderA++;
        sourceSites.push({ name: routeA, route: 'A', order: orderA });
      }
      if (routeB) {
        orderB++;
        sourceSites.push({ name: routeB, route: 'B', order: orderB });
      }
    }

    // 2. Read/create destination (QC Master Sites tab)
    const qcSS = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    let destSheet = qcSS.getSheetByName(SHEET_SITES);

    if (!destSheet) {
      destSheet = qcSS.insertSheet(SHEET_SITES);
      destSheet.appendRow(COLUMNS.sites);
      destSheet.getRange(1, 1, 1, COLUMNS.sites.length).setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
      destSheet.setFrozenRows(1);
    }

    // 3. Index existing sites by name to avoid duplicates
    const destData = destSheet.getDataRange().getValues();
    const existingNames = new Map(); // name -> rowIndex (1-based)

    // COLUMNS.sites: id, code, nameEN, nameLO, type, route, address, district, province, lat, lng, contactName, contactPhone, contactEmail, status, notes, createdAt, updatedAt
    // nameEN is at index 2
    for (let i = 1; i < destData.length; i++) {
      const name = destData[i][2] ? destData[i][2].toString().trim() : '';
      if (name) {
        existingNames.set(name, i + 1); // Store 1-based row number
      }
    }

    // 4. Process source sites
    let added = 0;
    let updated = 0;
    const rowsToAdd = [];

    sourceSites.forEach(site => {
      if (existingNames.has(site.name)) {
        // Update existing - just update the updatedAt timestamp
        const rowNum = existingNames.get(site.name);
        destSheet.getRange(rowNum, 18).setValue(now); // updatedAt is column 18
        updated++;
      } else {
        // Add new site
        const newId = 'SITE-' + site.route + '-' + Utilities.getUuid().substring(0, 6).toUpperCase();
        const code = 'VKS-' + site.route + '-' + String(site.order).padStart(3, '0');

        // Map to COLUMNS.sites schema:
        // id, code, nameEN, nameLO, type, route, address, district, province, lat, lng, contactName, contactPhone, contactEmail, status, notes, createdAt, updatedAt
        const newRow = [
          newId,           // id
          code,            // code
          site.name,       // nameEN
          '',              // nameLO (empty - edit later)
          'Other',         // type (default)
          site.route,      // route (A or B)
          '',              // address (empty - edit later)
          '',              // district (empty)
          'Vientiane',     // province (default)
          '',              // lat (empty)
          '',              // lng (empty)
          '',              // contactName (empty)
          '',              // contactPhone (empty)
          '',              // contactEmail (empty)
          'active',        // status (default)
          '',              // notes (empty)
          '',              // checkpointTarget
          '',              // roundsTarget
          '',              // patrolConditions
          '12h',           // shiftType (default)
          '06:00',         // shiftStart
          '18:00',         // shiftEnd
          now,             // createdAt
          now              // updatedAt
        ];

        rowsToAdd.push(newRow);
        existingNames.set(site.name, -1); // Mark as added to prevent dupes in same batch
        added++;
      }
    });

    // 5. Batch append new rows
    if (rowsToAdd.length > 0) {
      const nextRow = destSheet.getLastRow() + 1;
      destSheet.getRange(nextRow, 1, rowsToAdd.length, COLUMNS.sites.length).setValues(rowsToAdd);
    }

    Logger.log(`Sites Sync Complete: Added ${added}, Updated ${updated}, Total ${sourceSites.length}`);
    return { success: true, added: added, updated: updated, total: sourceSites.length };

  } catch (e) {
    Logger.log('Sites Sync Failed: ' + e.message);
    throw e;
  }
}

/**
 * Auto-sync handler for Sites - called by time trigger
 */
function autoSyncSites() {
  try {
    const result = syncSitesFromPatrol();
    if (result.added > 0) {
      Logger.log(`[Auto-Sync Sites] Added ${result.added} new sites`);
    }
  } catch (e) {
    Logger.log('[Auto-Sync Sites Error] ' + e.message);
  }
}

/**
 * Setup 1-minute auto-sync for Sites
 * Run once manually to enable
 */
function setupSitesAutoSync() {
  // Remove existing
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'autoSyncSites') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Create new 1-minute trigger
  ScriptApp.newTrigger('autoSyncSites')
    .timeBased()
    .everyMinutes(1)
    .create();

  Logger.log('âœ… Sites auto-sync enabled (1-minute interval)');
  return { success: true, message: 'Sites auto-sync trigger created' };
}

/**
 * Remove Sites auto-sync trigger
 */
function removeSitesAutoSync() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'autoSyncSites') {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  Logger.log(`Removed ${removed} Sites auto-sync trigger(s)`);
  return { success: true, removed: removed };
}

// ===========================================
// GPS EXTRACTION FROM INSPECTION LOGS
// ===========================================

/**
 * Extract GPS coordinates from InspectionLogs and update Sites/Locations
 * Cross-references by siteName column
 * @returns {Object} Update stats
 */
function extractGPSFromInspectionLogs() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);

    // 1. Read InspectionLogs
    const logsSheet = ss.getSheetByName(SHEET_INSPECTION_LOGS);
    if (!logsSheet) throw new Error('InspectionLogs sheet not found');

    const logsData = logsSheet.getDataRange().getValues();
    // InspectionLogs columns: timestamp(0), patrolName(1), route(2), siteName(3), ..., gps(18)

    // Build GPS map by siteName (use latest GPS for each site)
    const gpsMap = new Map(); // siteName -> {lat, lng, timestamp}

    for (let i = logsData.length - 1; i >= 1; i--) {
      const siteName = logsData[i][3] ? logsData[i][3].toString().trim() : '';
      const gpsRaw = logsData[i][18] ? logsData[i][18].toString() : '';
      const timestamp = logsData[i][0];

      if (siteName && gpsRaw && !gpsMap.has(siteName)) {
        // Parse GPS - formats: "lat,lng" or "lat, lng" or URL with coords
        const coords = parseGPSString(gpsRaw);
        if (coords) {
          gpsMap.set(siteName, { ...coords, timestamp });
        }
      }
    }

    Logger.log('Found GPS for ' + gpsMap.size + ' sites');

    // 2. Update Sites tab
    const sitesSheet = ss.getSheetByName(SHEET_SITES);
    let sitesUpdated = 0;

    if (sitesSheet) {
      const sitesData = sitesSheet.getDataRange().getValues();
      // Sites columns: id(0), code(1), nameEN(2), ..., lat(9), lng(10), ...

      for (let i = 1; i < sitesData.length; i++) {
        const siteName = sitesData[i][2] ? sitesData[i][2].toString().trim() : '';

        if (siteName && gpsMap.has(siteName)) {
          const coords = gpsMap.get(siteName);
          const currentLat = sitesData[i][9];
          const currentLng = sitesData[i][10];

          // Only update if empty or different
          if (!currentLat || !currentLng) {
            sitesSheet.getRange(i + 1, 10).setValue(coords.lat);  // lat is column 10 (index 9)
            sitesSheet.getRange(i + 1, 11).setValue(coords.lng);  // lng is column 11 (index 10)
            sitesSheet.getRange(i + 1, 18).setValue(new Date().toISOString()); // updatedAt
            sitesUpdated++;
          }
        }
      }
    }

    // 3. Update Locations tab (add lat/lng columns if needed or store in location description)
    const locSheet = ss.getSheetByName(SHEET_LOCATIONS);
    let locsUpdated = 0;

    if (locSheet) {
      const locData = locSheet.getDataRange().getValues();
      // Locations: id(0), route(1), name(2), location(3), required(4), qrStatus(5), generatedAt(6), lastSynced(7)

      for (let i = 1; i < locData.length; i++) {
        const siteName = locData[i][2] ? locData[i][2].toString().trim() : '';

        if (siteName && gpsMap.has(siteName)) {
          const coords = gpsMap.get(siteName);
          const currentLocation = locData[i][3] ? locData[i][3].toString() : '';

          // Add GPS to location description if not already there
          if (!currentLocation.includes(coords.lat.toString())) {
            const gpsText = `GPS: ${coords.lat}, ${coords.lng}`;
            const newLocation = currentLocation ? currentLocation + ' | ' + gpsText : gpsText;
            locSheet.getRange(i + 1, 4).setValue(newLocation); // location column
            locSheet.getRange(i + 1, 8).setValue(new Date().toISOString()); // lastSynced
            locsUpdated++;
          }
        }
      }
    }

    Logger.log(`GPS Extraction Complete: ${sitesUpdated} sites updated, ${locsUpdated} locations updated`);
    return { success: true, sitesUpdated, locsUpdated, gpsFound: gpsMap.size };

  } catch (e) {
    Logger.log('GPS Extraction Failed: ' + e.message);
    throw e;
  }
}

/**
 * Parse GPS string into lat/lng coordinates
 * Handles formats: "lat,lng", "lat, lng", Google Maps URLs, etc.
 */
function parseGPSString(gpsStr) {
  if (!gpsStr) return null;

  const str = gpsStr.toString().trim();

  // Format: "17.9757,102.6331" or "17.9757, 102.6331"
  const simpleMatch = str.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
  if (simpleMatch) {
    const lat = parseFloat(simpleMatch[1]);
    const lng = parseFloat(simpleMatch[2]);

    // Validate Laos coordinates (roughly 13-23 lat, 100-108 lng)
    if (lat >= 13 && lat <= 23 && lng >= 100 && lng <= 108) {
      return { lat, lng };
    }
    // Swap if reversed
    if (lng >= 13 && lng <= 23 && lat >= 100 && lat <= 108) {
      return { lat: lng, lng: lat };
    }
    // Accept anyway if within broader range
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }

  // Google Maps URL: https://maps.google.com/?q=17.9757,102.6331
  const mapsMatch = str.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (mapsMatch) {
    return { lat: parseFloat(mapsMatch[1]), lng: parseFloat(mapsMatch[2]) };
  }

  // Google Maps embed: @17.9757,102.6331
  const atMatch = str.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }

  return null;
}

/**
 * Get all sites with optional filters
 * Reads from QC Master Sites tab (synced from Patrol Dashboard)
 * @param {Object} filters - Filter options
 * @returns {Array} Site objects
 */
function getSites(filters) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const sitesSheet = ss.getSheetByName(SHEET_SITES);
    if (!sitesSheet) {
      Logger.log('Sites sheet not found: ' + SHEET_SITES);
      return [];
    }

    const data = sitesSheet.getDataRange().getValues();
    if (data.length <= 1) {
      Logger.log('Sites sheet is empty (only headers), returning empty array');
      return [];
    }

    // Robust header mapping
    const headers = data[0];
    const idx = {
      id: getCIIndex(headers, ['id']),
      code: getCIIndex(headers, ['code', 'site code', 'vks code']),
      nameEN: getCIIndex(headers, ['nameEN', 'name_en', 'site name']),
      nameLO: getCIIndex(headers, ['nameLO', 'name_lo']),
      type: getCIIndex(headers, ['type']),
      route: getCIIndex(headers, ['route']),
      address: getCIIndex(headers, ['address']),
      district: getCIIndex(headers, ['district', 'zone']),
      province: getCIIndex(headers, ['province']),
      lat: getCIIndex(headers, ['lat', 'latitude']),
      lng: getCIIndex(headers, ['lng', 'longitude']),
      contactName: getCIIndex(headers, ['contactName', 'contact']),
      contactPhone: getCIIndex(headers, ['contactPhone', 'phone']),
      contactEmail: getCIIndex(headers, ['contactEmail', 'email']),
      status: getCIIndex(headers, ['status']),
      notes: getCIIndex(headers, ['notes']),
      checkpointTarget: getCIIndex(headers, ['checkpointTarget', 'checkpoints']),
      roundsTarget: getCIIndex(headers, ['roundsTarget', 'rounds']),
      patrolConditions: getCIIndex(headers, ['patrolConditions']),
      shiftType: getCIIndex(headers, ['shiftType']),
      shiftStart: getCIIndex(headers, ['shiftStart']),
      shiftEnd: getCIIndex(headers, ['shiftEnd']),
      createdAt: getCIIndex(headers, ['createdAt', 'created']),
      updatedAt: getCIIndex(headers, ['updatedAt', 'updated'])
    };

    let sites = [];

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const id = idx.id !== -1 ? String(row[idx.id] || '').trim() : '';
      const nameEN = idx.nameEN !== -1 ? String(row[idx.nameEN] || '').trim() : '';

      // Skip empty rows or rows that were read incorrectly
      if ((!id || id === 'undefined') && (!nameEN || nameEN === 'undefined')) continue;

      const siteStatus = idx.status !== -1 ? String(row[idx.status] || 'active').toLowerCase() : 'active';

      // Skip soft-deleted sites — they stay in the sheet but are hidden everywhere
      if (siteStatus === 'deleted') continue;

      sites.push({
        id: id,
        code: idx.code !== -1 ? String(row[idx.code] || '').trim() : '',
        nameEN: nameEN,
        nameLO: idx.nameLO !== -1 ? String(row[idx.nameLO] || '').trim() : '',
        type: idx.type !== -1 ? (row[idx.type] || 'Other') : 'Other',
        route: idx.route !== -1 ? (row[idx.route] || '') : '',
        address: idx.address !== -1 ? (row[idx.address] || '') : '',
        district: idx.district !== -1 ? (row[idx.district] || '') : '',
        province: idx.province !== -1 ? (row[idx.province] || '') : '',
        lat: idx.lat !== -1 ? (row[idx.lat] || '') : '',
        lng: idx.lng !== -1 ? (row[idx.lng] || '') : '',
        contactName: idx.contactName !== -1 ? (row[idx.contactName] || '') : '',
        contactPhone: idx.contactPhone !== -1 ? (row[idx.contactPhone] || '') : '',
        contactEmail: idx.contactEmail !== -1 ? (row[idx.contactEmail] || '') : '',
        status: idx.status !== -1 ? String(row[idx.status] || 'active').toLowerCase() : 'active',
        notes: idx.notes !== -1 ? (row[idx.notes] || '') : '',
        checkpointTarget: idx.checkpointTarget !== -1 ? (row[idx.checkpointTarget] || 0) : 0,
        roundsTarget: idx.roundsTarget !== -1 ? (row[idx.roundsTarget] instanceof Date ? row[idx.roundsTarget].toISOString() : String(row[idx.roundsTarget] || 0)) : 0,
        patrolConditions: idx.patrolConditions !== -1 ? (row[idx.patrolConditions] || '') : '',
        shiftType: idx.shiftType !== -1 ? (row[idx.shiftType] || '12h') : '12h',
        shiftStart: idx.shiftStart !== -1 ? (row[idx.shiftStart] instanceof Date ? row[idx.shiftStart].toISOString() : String(row[idx.shiftStart] || '06:00')) : '06:00',
        shiftEnd: idx.shiftEnd !== -1 ? (row[idx.shiftEnd] instanceof Date ? row[idx.shiftEnd].toISOString() : String(row[idx.shiftEnd] || '18:00')) : '18:00',
        createdAt: idx.createdAt !== -1 ? (row[idx.createdAt] instanceof Date ? row[idx.createdAt].toISOString() : String(row[idx.createdAt] || '')) : '',
        updatedAt: idx.updatedAt !== -1 ? (row[idx.updatedAt] instanceof Date ? row[idx.updatedAt].toISOString() : String(row[idx.updatedAt] || '')) : '',
        guardCount: 0,
        checkpointCount: 0
      });
    }

    // Apply filters
    if (filters) {
      if (filters.route) {
        sites = sites.filter(s => s.route === filters.route);
      }
      if (filters.status) {
        sites = sites.filter(s => s.status === filters.status);
      }
      if (filters.type) {
        sites = sites.filter(s => s.type === filters.type);
      }
      if (filters.search) {
        const search = filters.search.toLowerCase();
        sites = sites.filter(s =>
          (s.code && s.code.toLowerCase().includes(search)) ||
          (s.nameEN && s.nameEN.toLowerCase().includes(search)) ||
          (s.nameLO && s.nameLO.toLowerCase().includes(search)) ||
          (s.address && s.address.toLowerCase().includes(search))
        );
      }
    }

    // Populate checkpoint counts from Checkpoints sheet (Refactored - Option B)
    try {
      const checkpointsSheet = ss.getSheetByName(SHEET_CHECKPOINTS);
      if (checkpointsSheet && checkpointsSheet.getLastRow() > 1) {
        const cpData = checkpointsSheet.getDataRange().getValues();
        const cpHeaders = cpData[0];
        const siteIdIdx = getCIIndex(cpHeaders, ['siteId', 'site_id', 'siteid']);

        if (siteIdIdx !== -1) {
          // Count checkpoints per site
          const cpCounts = {};
          for (let i = 1; i < cpData.length; i++) {
            const cpSiteId = String(cpData[i][siteIdIdx] || '').trim();
            if (cpSiteId) {
              cpCounts[cpSiteId] = (cpCounts[cpSiteId] || 0) + 1;
            }
          }

          // Assign counts to sites
          sites.forEach(site => {
            site.checkpointCount = cpCounts[site.id] || 0;
          });
        }
      }
    } catch (cpErr) {
      Logger.log('Warning: Could not load checkpoint counts: ' + cpErr.message);
    }

    Logger.log('getSites returning ' + sites.length + ' sites');

    // CRITICAL FIX: Force JSON serialization to remove any non-transmissible types (like Date objects or undefined)
    // google.script.run will return null if any part of the object is not serializable.
    try {
      const cleanSites = JSON.parse(JSON.stringify(sites));
      Logger.log('Serialization check passed. Returning clean data.');
      return cleanSites;
    } catch (serializeErr) {
      Logger.log('SERIALIZATION FAILED: ' + serializeErr.message);
      // Fallback: Try to map manually efficiently if bulk sanitize fails
      return sites.map(s => ({
        id: String(s.id),
        code: String(s.code),
        nameEN: String(s.nameEN),
        status: String(s.status),
        type: String(s.type),
        route: String(s.route),
        // Minimal set if full fails
      }));
    }

  } catch (e) {
    Logger.log('Error in getSites: ' + e.message);
    throw e;
  }
}


/**
 * Get single site detail by ID
 * Reads from QC Master Sites tab
 * @param {string} siteId - Site ID
 * @returns {Object} Site object with full details
 */
function getSiteDetail(siteId) {
  try {
    if (!siteId) {
      throw new Error('Site ID is required');
    }

    // Read from QC Master Sites tab
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const sheet = ss.getSheetByName(SHEET_SITES);
    if (!sheet) throw new Error('Sites sheet not found in QC Master');

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Dynamic header mapping (matches getSites pattern)
    const idx = {
      id: getCIIndex(headers, ['id']),
      code: getCIIndex(headers, ['code', 'site code', 'vks code']),
      nameEN: getCIIndex(headers, ['nameEN', 'name_en', 'site name']),
      nameLO: getCIIndex(headers, ['nameLO', 'name_lo']),
      type: getCIIndex(headers, ['type']),
      route: getCIIndex(headers, ['route']),
      address: getCIIndex(headers, ['address']),
      district: getCIIndex(headers, ['district', 'zone']),
      province: getCIIndex(headers, ['province']),
      lat: getCIIndex(headers, ['lat', 'latitude']),
      lng: getCIIndex(headers, ['lng', 'longitude']),
      contactName: getCIIndex(headers, ['contactName', 'contact']),
      contactPhone: getCIIndex(headers, ['contactPhone', 'phone']),
      contactEmail: getCIIndex(headers, ['contactEmail', 'email']),
      status: getCIIndex(headers, ['status']),
      notes: getCIIndex(headers, ['notes']),
      checkpointTarget: getCIIndex(headers, ['checkpointTarget', 'checkpoints']),
      roundsTarget: getCIIndex(headers, ['roundsTarget', 'rounds']),
      patrolConditions: getCIIndex(headers, ['patrolConditions']),
      shiftType: getCIIndex(headers, ['shiftType']),
      shiftStart: getCIIndex(headers, ['shiftStart']),
      shiftEnd: getCIIndex(headers, ['shiftEnd']),
      createdAt: getCIIndex(headers, ['createdAt', 'created']),
      updatedAt: getCIIndex(headers, ['updatedAt', 'updated'])
    };

    // Find by ID
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowId = idx.id !== -1 ? String(row[idx.id] || '').trim() : '';

      if (rowId === siteId) {
        const site = {
          id: rowId,
          code: idx.code !== -1 ? String(row[idx.code] || '').trim() : '',
          nameEN: idx.nameEN !== -1 ? String(row[idx.nameEN] || '').trim() : '',
          nameLO: idx.nameLO !== -1 ? String(row[idx.nameLO] || '').trim() : '',
          type: idx.type !== -1 ? (row[idx.type] || 'Other') : 'Other',
          route: idx.route !== -1 ? (row[idx.route] || '') : '',
          address: idx.address !== -1 ? (row[idx.address] || '') : '',
          district: idx.district !== -1 ? (row[idx.district] || '') : '',
          province: idx.province !== -1 ? (row[idx.province] || '') : '',
          lat: idx.lat !== -1 ? (row[idx.lat] || '') : '',
          lng: idx.lng !== -1 ? (row[idx.lng] || '') : '',
          contactName: idx.contactName !== -1 ? (row[idx.contactName] || '') : '',
          contactPhone: idx.contactPhone !== -1 ? (row[idx.contactPhone] || '') : '',
          contactEmail: idx.contactEmail !== -1 ? (row[idx.contactEmail] || '') : '',
          status: idx.status !== -1 ? String(row[idx.status] || 'active').toLowerCase() : 'active',
          notes: idx.notes !== -1 ? (row[idx.notes] || '') : '',
          checkpointTarget: idx.checkpointTarget !== -1 ? (row[idx.checkpointTarget] || 0) : 0,
          roundsTarget: idx.roundsTarget !== -1 ? (row[idx.roundsTarget] instanceof Date ? row[idx.roundsTarget].toISOString() : String(row[idx.roundsTarget] || 0)) : 0,
          patrolConditions: idx.patrolConditions !== -1 ? (row[idx.patrolConditions] || '') : '',
          shiftType: idx.shiftType !== -1 ? (row[idx.shiftType] || '12h') : '12h',
          shiftStart: idx.shiftStart !== -1 ? (row[idx.shiftStart] instanceof Date ? row[idx.shiftStart].toISOString() : String(row[idx.shiftStart] || '06:00')) : '06:00',
          shiftEnd: idx.shiftEnd !== -1 ? (row[idx.shiftEnd] instanceof Date ? row[idx.shiftEnd].toISOString() : String(row[idx.shiftEnd] || '18:00')) : '18:00',
          createdAt: idx.createdAt !== -1 ? (row[idx.createdAt] instanceof Date ? row[idx.createdAt].toISOString() : String(row[idx.createdAt] || '')) : '',
          updatedAt: idx.updatedAt !== -1 ? (row[idx.updatedAt] instanceof Date ? row[idx.updatedAt].toISOString() : String(row[idx.updatedAt] || '')) : '',
          guardCount: 0,
          checkpointCount: 0,
          incidentCount: 0 // Placeholder
        };

        // CRITICAL FIX: Force JSON serialization
        try {
          const cleanSite = JSON.parse(JSON.stringify(site));
          return cleanSite;
        } catch (e) {
          Logger.log('getSiteDetail serialization error: ' + e.message);
          // Fallback
          site.createdAt = String(site.createdAt);
          site.updatedAt = String(site.updatedAt);
          return site;
        }
      }
    }

    throw new Error('Site not found: ' + siteId);


  } catch (e) {
    Logger.log('Error in getSiteDetail: ' + e.message);
    throw e;
  }
}

/**
 * Get site detail WITH guards and inspectors in one call (Performance optimized)
 * Combines getSiteDetail() and getGuardsBySite() to reduce network calls
 * @param {string} siteId - Site ID
 * @returns {Object} Site object with guards and inspectors included
 */
function getSiteDetailWithGuards(siteId) {
  try {
    // Get site detail first
    const site = getSiteDetail(siteId);

    // Get guards for this site
    const guardsData = getGuardsBySite(siteId);

    // Merge into single response
    site.guards = guardsData.guards || [];
    site.inspectors = guardsData.inspectors || [];
    site.totalPersonnel = site.guards.length + site.inspectors.length;

    return site;
  } catch (e) {
    Logger.log('Error in getSiteDetailWithGuards: ' + e.message);
    throw e;
  }
}

/**
 * Save site (create or update)
 * @param {Object} data - Site data
 * @returns {Object} Result with success status and ID
 */
function saveSite(data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const sheet = ss.getSheetByName(SHEET_SITES);

    const now = new Date().toISOString();
    const isEdit = !!data.id;

    if (isEdit) {
      // Update existing site
      const allData = sheet.getDataRange().getValues();
      const headers = allData[0];
      const rowIndex = allData.findIndex((row, i) => i > 0 && row[0] === data.id);

      if (rowIndex === -1) {
        throw new Error('Site not found');
      }

      // Update row
      headers.forEach((header, colIndex) => {
        if (data.hasOwnProperty(header) && header !== 'id' && header !== 'createdAt') {
          sheet.getRange(rowIndex + 1, colIndex + 1).setValue(data[header]);
        }
      });
      sheet.getRange(rowIndex + 1, headers.indexOf('updatedAt') + 1).setValue(now);

      // Also update Locations tab if name changed
      syncSiteToLocations_(data.nameEN, data.route, now);

      // Audit Fix: Invalidate cache after update
      CacheService.getScriptCache().remove('vks_site_options_all');

      return { success: true, id: data.id };
    } else {
      // Create new site
      const newId = 'SITE-' + (data.route || 'X') + '-' + Utilities.getUuid().substring(0, 6).toUpperCase();
      const headers = COLUMNS.sites;

      const newRow = headers.map(header => {
        if (header === 'id') return newId;
        if (header === 'createdAt') return now;
        if (header === 'updatedAt') return now;
        return data[header] || '';
      });

      sheet.appendRow(newRow);

      // Also add to Locations tab for QR Generator
      addSiteToLocations_(data.nameEN, data.route, now);

      // Audit Fix: Invalidate cache after create
      CacheService.getScriptCache().remove('vks_site_options_all');

      return { success: true, id: newId };
    }
  } catch (e) {
    Logger.log('Error in saveSite: ' + e.message);
    throw e;
  }
}

/**
 * INTERNAL: Sync site to Locations tab (update existing)
 */
function syncSiteToLocations_(siteName, route, timestamp) {
  try {
    if (!siteName) return;

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    let locSheet = ss.getSheetByName(SHEET_LOCATIONS);
    if (!locSheet) return;

    const data = locSheet.getDataRange().getValues();
    // Locations: id, route, name, location, required, qrStatus, generatedAt, lastSynced

    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === siteName) {
        // Update route and lastSynced
        if (route) locSheet.getRange(i + 1, 2).setValue(route);
        locSheet.getRange(i + 1, 8).setValue(timestamp);
        return;
      }
    }
  } catch (e) {
    Logger.log('syncSiteToLocations_ error: ' + e.message);
  }
}

/**
 * INTERNAL: Add new site to Locations tab
 */
function addSiteToLocations_(siteName, route, timestamp) {
  try {
    if (!siteName) return;

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    let locSheet = ss.getSheetByName(SHEET_LOCATIONS);

    // Create Locations sheet if not exists
    if (!locSheet) {
      locSheet = ss.insertSheet(SHEET_LOCATIONS);
      locSheet.appendRow(COLUMNS.locations);
      locSheet.getRange(1, 1, 1, COLUMNS.locations.length).setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
      locSheet.setFrozenRows(1);
    }

    // Check if already exists
    const data = locSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === siteName) return; // Already exists
    }

    // Add new location
    const newId = 'LOC-' + Utilities.getUuid().substring(0, 8).toUpperCase();
    // id, route, name, location, required, qrStatus, generatedAt, lastSynced
    locSheet.appendRow([
      newId,
      route || '',
      siteName,
      '', // location description
      'Yes', // required
      'pending', // qrStatus
      '', // generatedAt
      timestamp
    ]);
  } catch (e) {
    Logger.log('addSiteToLocations_ error: ' + e.message);
  }
}

/**
 * Soft-delete site by ID
 * Sets status to 'deleted' instead of removing the row.
 * Deleted sites are excluded from getSites, getSiteOptions, and SiteMap.
 * @param {string} siteId - Site ID
 * @returns {Object} Result
 */
function deleteSite(siteId) {
  try {
    if (!siteId) throw new Error('Site ID is required');

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const sheet = ss.getSheetByName(SHEET_SITES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Find row by ID
    const rowIndex = data.findIndex((row, i) => i > 0 && String(row[0]).trim() === siteId);
    if (rowIndex === -1) {
      throw new Error('Site not found');
    }

    // Find status and updatedAt column indices
    const statusIdx = getCIIndex(headers, ['status']);
    const updatedIdx = getCIIndex(headers, ['updatedAt', 'updated']);

    if (statusIdx === -1) {
      throw new Error('Status column not found in Sites sheet');
    }

    // Soft-delete: set status to 'deleted'
    const rowNum = rowIndex + 1;
    sheet.getRange(rowNum, statusIdx + 1).setValue('deleted');
    if (updatedIdx !== -1) {
      sheet.getRange(rowNum, updatedIdx + 1).setValue(new Date().toISOString());
    }
    SpreadsheetApp.flush();

    // Invalidate caches
    try {
      CacheService.getScriptCache().remove('vks_site_options_all');
    } catch (e) { /* ignore */ }

    // Notify of update
    setUpdateSignal('sites');

    Logger.log('Soft-deleted site: ' + siteId);
    return { success: true };
  } catch (e) {
    Logger.log('Error in deleteSite: ' + e.message);
    throw e;
  }
}

/**
 * Get site checkpoints
 * @param {string} siteId - Site ID
 * @returns {Array} Checkpoint objects
 */
function getSiteCheckpoints(siteId) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const sheet = ss.getSheetByName(SHEET_CHECKPOINTS);

    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    return data.slice(1)
      .filter(row => row[1] === siteId)
      .map(row => {
        const cp = {};
        headers.forEach((h, i) => cp[h] = row[i]);
        return cp;
      })
      .sort((a, b) => a.sequence - b.sequence);
  } catch (e) {
    Logger.log('Error in getSiteCheckpoints: ' + e.message);
    throw e;
  }
}

/**
 * Save site patrol configuration
 * @param {string} siteId - Site ID
 * @param {Object} config - Config data {checkpointTarget, roundsTarget, shiftType, shiftStart, shiftEnd, patrolConditions}
 */
function saveSitePatrolConfig(siteId, config) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const sheet = ss.getSheetByName(SHEET_SITES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const rowIndex = data.findIndex((row, i) => i > 0 && row[0] === siteId);
    if (rowIndex === -1) throw new Error('Site not found');

    const now = new Date().toISOString();

    // Default values for 8h shift if missing (Failsafe)
    if (config.shiftType === '8h') {
      if (!config.shiftStart) config.shiftStart = '06:00';
      if (!config.shiftEnd) config.shiftEnd = '14:00';
    }

    // Update mapping
    const updates = {
      checkpointTarget: config.checkpointTarget,
      roundsTarget: config.roundsTarget,
      shiftType: config.shiftType,
      shiftStart: config.shiftStart,
      shiftEnd: config.shiftEnd,
      patrolConditions: config.patrolConditions,
      updatedAt: now
    };

    const rowNum = rowIndex + 1;
    Object.keys(updates).forEach(key => {
      const colIdx = getCIIndex(headers, [key]);
      if (colIdx !== -1) {
        sheet.getRange(rowNum, colIdx + 1).setValue(updates[key]);
      }
    });

    // Notify of update
    setUpdateSignal('sites');

    // CRITICAL: Invalidate site options cache so QR Generator sees updated checkpointTarget
    try {
      CacheService.getScriptCache().remove('vks_site_options_all');
    } catch (e) {
      Logger.log('Cache clear failed: ' + e.message);
    }

    // SYNC TO PATROL DASHBOARD
    // We need to fetch the full site name and CODE first
    try {
      const siteName = headers.indexOf('nameEN') > -1 ? data[rowIndex][headers.indexOf('nameEN')] : '';
      const codeIdx = getCIIndex(headers, ['code', 'site code']);
      const siteCode = codeIdx > -1 ? data[rowIndex][codeIdx] : ''; // Get VKS-A-XXX

      if (siteName) {
        const syncData = {
          id: siteId,
          code: siteCode, // NEW: Pass Code
          nameEN: siteName,
          roundsTarget: config.roundsTarget,
          checkpointTarget: config.checkpointTarget,
          shiftType: config.shiftType,
          shiftStart: config.shiftStart,
          shiftEnd: config.shiftEnd
        };
        syncToPatrolDashboard(syncData);
      }
    } catch (e) {
      Logger.log('Sync to Patrol Dashboard failed silently: ' + e.message);
    }

    return { success: true };
  } catch (e) {
    Logger.log('Error in saveSitePatrolConfig: ' + e.message);
    throw e;
  }
}


/**
 * Get dropdown options for site selection
 * Reads from VKS Patrol Dashboard's Sites tab (Route A = Col A, Route B = Col B)
 * @returns {Array} Options for dropdown [{value, label}]
 */
/**
 * Sync locations from Patrol Sheet to QC Master (Phase 7)
 * Reads Patrol Dashboard Sites tab -> Writes to QC Master Locations tab
 * Preserves QR status, adds new sites
 * @returns {Object} Sync stats
 */
/**
 * Sync locations from Patrol Sheet to QC Master (Phase 7 - Refined)
 * Reads Patrol Dashboard Sites tab -> Writes to QC Master Locations tab
 * Merges new sites while preserving local edits (Location, Required, QR Status)
 * @returns {Object} Sync stats
 */
function syncLocationsFromPatrol() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);

    // 1. Map Site Names to Ids from SHEET_SITES (Master)
    const siteSheet = ss.getSheetByName(SHEET_SITES);
    const siteMapping = new Map(); // name -> {id, route}

    if (siteSheet) {
      const sData = siteSheet.getDataRange().getValues();
      const sHeaders = sData[0];
      const sIdx = {
        id: getCIIndex(sHeaders, ['id']),
        name: getCIIndex(sHeaders, ['nameEN', 'name_en', 'site name']),
        route: getCIIndex(sHeaders, ['route'])
      };

      for (let i = 1; i < sData.length; i++) {
        const name = String(sData[i][sIdx.name] || '').trim();
        const id = String(sData[i][sIdx.id] || '').trim();
        if (name) siteMapping.set(name.toLowerCase(), { id: id, route: sData[i][sIdx.route] });
      }
    }

    // 2. Read source data (Patrol Dashboard)
    const patrolSS = SpreadsheetApp.openById(SPREADSHEET_ID_PATROL);
    const patrolSheet = patrolSS.getSheetByName('Sites');
    if (!patrolSheet) throw new Error('Patrol Sites sheet not found');

    const sourceData = patrolSheet.getDataRange().getValues();
    const sourceSites = [];
    const now = new Date().toISOString();

    // Extract unique sites from Cols A & B (Route A & B)
    for (let i = 1; i < sourceData.length; i++) {
      const routeA = sourceData[i][0] ? sourceData[i][0].toString().trim() : '';
      const routeB = sourceData[i][1] ? sourceData[i][1].toString().trim() : '';

      if (routeA) sourceSites.push({ name: routeA, route: 'A' });
      if (routeB) sourceSites.push({ name: routeB, route: 'B' });
    }

    let locSheet = ss.getSheetByName(SHEET_LOCATIONS);
    if (!locSheet) {
      locSheet = ss.insertSheet(SHEET_LOCATIONS);
      locSheet.appendRow(COLUMNS.locations);
    }

    const locData = locSheet.getDataRange().getValues();
    const locHeaders = locData[0];
    const locIdx = {
      id: getCIIndex(locHeaders, ['id']),
      siteId: getCIIndex(locHeaders, ['siteId']),
      siteName: getCIIndex(locHeaders, ['siteName']),
      updatedAt: getCIIndex(locHeaders, ['updatedAt'])
    };

    // Index existing rows by SiteName to detect updates
    const existingMap = new Map();
    for (let i = 1; i < locData.length; i++) {
      const name = String(locData[i][locIdx.siteName] || '').trim().toLowerCase();
      if (name) existingMap.set(name, i + 1);
    }

    let added = 0;
    let updated = 0;

    sourceSites.forEach(sourceSite => {
      const siteKey = sourceSite.name.toLowerCase();
      const siteInfo = siteMapping.get(siteKey) || { id: '', route: sourceSite.route };

      if (existingMap.has(siteKey)) {
        const rowIdx = existingMap.get(siteKey);
        // Update SiteId (if missing) and UpdatedAt
        if (locIdx.siteId !== -1) locSheet.getRange(rowIdx, locIdx.siteId + 1).setValue(siteInfo.id);
        if (locIdx.updatedAt !== -1) locSheet.getRange(rowIdx, locIdx.updatedAt + 1).setValue(now);
        updated++;
      } else {
        // New Location Row: ['id', 'siteId', 'siteName', 'code', 'name', 'type', 'order', 'required', 'qrStatus', 'driveUrl', 'generatedAt', 'updatedAt']
        const newId = 'LOC-' + Utilities.getUuid().substring(0, 8).toUpperCase();
        const newRow = COLUMNS.locations.map(h => {
          if (h === 'id') return newId;
          if (h === 'siteId') return siteInfo.id;
          if (h === 'siteName') return sourceSite.name;
          if (h === 'name') return 'General Checkpoint'; // Sample location
          if (h === 'required') return 'Yes';
          if (h === 'qrStatus') return 'pending';
          if (h === 'updatedAt') return now;
          return '';
        });
        locSheet.appendRow(newRow);
        added++;
      }
    });

    return { success: true, added: added, updated: updated, total: sourceSites.length };

  } catch (e) {
    Logger.log('Sync Failed: ' + e.message);
    throw e;
  }
}

/**
 * Get dropdown options for site selection
 * Reads from Locations tab first, falls back to Sites tab
 * @returns {Array} Options for dropdown [{value, label, route}]
 */
/**
 * Get site options strictly from Locations tab
 */
/**
 * Get dropdown options for site selection
 * 
 * Performance: Uses CacheService to store the site list for 10 minutes.
 * Robustness: Normalizes names and ensures all sites from the master list are included.
 */
function getSiteOptions() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'vks_site_options_all';
  const cached = cache.get(cacheKey);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      Logger.log('[getSiteOptions] Cache error: ' + e.message);
    }
  }

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);

    // 1. Get ALL sites from the master list (Source of Truth)
    const siteSheet = ss.getSheetByName(SHEET_SITES);
    const options = [];
    const seenIds = new Set();

    if (siteSheet && siteSheet.getLastRow() > 1) {
      const sData = siteSheet.getDataRange().getValues();
      const headers = sData[0];

      // Dynamic column lookup
      const idIdx = getCIIndex(headers, ['id', 'siteId']);
      const nameIdx = getCIIndex(headers, ['nameEN', 'name']);
      const routeIdx = getCIIndex(headers, ['route']);
      const cpTargetIdx = getCIIndex(headers, ['checkpointTarget', 'checkpoint target', 'checkpoints']);
      const statusIdx = getCIIndex(headers, ['status']); // NEW: Status lookup

      for (let i = 1; i < sData.length; i++) {
        const id = String(sData[i][idIdx] || '').trim();
        const nameEN = String(sData[i][nameIdx] || '').trim();
        const route = String(sData[i][routeIdx] || '').trim();
        const cpTarget = cpTargetIdx > -1 ? (parseInt(sData[i][cpTargetIdx]) || 0) : 0;

        // Status Check (Default to active)
        let status = statusIdx > -1 ? String(sData[i][statusIdx] || 'active').trim().toLowerCase() : 'active';
        if (!status) status = 'active';

        if (!id || !nameEN) continue;
        if (status !== 'active') continue; // FILTER: Exclude inactive
        if (seenIds.has(id)) continue;

        options.push({
          value: id,
          label: nameEN,
          route: route,
          id: id,
          checkpointTarget: cpTarget
        });
        seenIds.add(id);
      }
    }

    // 2. Add "All Locations" and metadata shortcuts (Prepend)
    const finalOptions = [
      { value: 'all-locations', label: '--- ALL LOCATIONS ---', route: '', checkpointTarget: 0 },
      ...options.sort((a, b) => a.label.localeCompare(b.label))
    ];

    // 3. Cache the result for 10 minutes (600 seconds)
    try {
      cache.put(cacheKey, JSON.stringify(finalOptions), 600);
    } catch (e) {
      Logger.log('[getSiteOptions] Caching too large: ' + e.message);
    }

    return finalOptions;

  } catch (e) {
    Logger.log('Error in getSiteOptions: ' + e.message);
    return [{ value: 'all-locations', label: 'All Locations (Fallback)', route: '' }];
  }
}

/**
 * Get checkpoints/sites for display in QR Generator
 * Reads from Locations tab
 */
function getCheckpointsBySite(siteId) {
  // Default to 'all-locations' if undefined/null
  if (!siteId || siteId === 'undefined' || siteId === 'null') {
    siteId = 'all-locations';
  }

  Logger.log('[getCheckpointsBySite] Called with siteId: ' + siteId);

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    // OPTION B: Read from CHECKPOINTS tab (New Standard)
    const sheet = ss.getSheetByName(SHEET_CHECKPOINTS);

    if (!sheet) {
      Logger.log('[getCheckpointsBySite] Sheet not found: ' + SHEET_CHECKPOINTS);
      return [];
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      Logger.log('[getCheckpointsBySite] No data rows (only header)');
      return [];
    }

    // Build Site Name & Route Lookup Map for richer return data
    const siteNameMap = {};
    const siteRouteMap = {};
    const sitesSheet = ss.getSheetByName(SHEET_SITES);
    if (sitesSheet) {
      const sitesData = sitesSheet.getDataRange().getValues();
      // Sites: id(0), code(1), nameEN(2), ..., route(5)
      for (let s = 1; s < sitesData.length; s++) {
        const sid = String(sitesData[s][0] || '').trim();
        const scode = String(sitesData[s][1] || '').trim();
        const sname = String(sitesData[s][2] || '').trim(); // nameEN
        const sroute = String(sitesData[s][5] || '').trim(); // route

        if (sid) {
          siteNameMap[sid] = sname;
          siteRouteMap[sid] = sroute;
        }
        if (scode && scode !== sid) { // Also map by code
          siteNameMap[scode] = sname;
          siteRouteMap[scode] = sroute;
        }
      }
    }

    // Checkpoints Tab Link:
    // 0: id, 1: siteId, 2: name, 3: location, 4: sequence, 5: required, 6: qrStatus, 7: driveUrl, 8: generatedAt
    const headers = data[0];
    const idx = {
      id: 0,
      siteId: 1,
      name: 2,
      location: 3, // Description
      sequence: 4,
      required: 5,
      qrStatus: 6,
      driveUrl: 7,
      generatedAt: 8
    };

    // Safety check if column mapping is string-based
    if (typeof headers[0] === 'string') {
      idx.id = getCIIndex(headers, ['id']);
      idx.siteId = getCIIndex(headers, ['siteId', 'site_id']);
      idx.name = getCIIndex(headers, ['name', 'checkpoint_name']);
      idx.location = getCIIndex(headers, ['location', 'description', 'notes']);
      idx.sequence = getCIIndex(headers, ['sequence', 'order']);
      idx.required = getCIIndex(headers, ['required']);
      idx.qrStatus = getCIIndex(headers, ['qrStatus', 'status']);
      idx.driveUrl = getCIIndex(headers, ['driveUrl', 'url']);
      idx.generatedAt = getCIIndex(headers, ['generatedAt']);
    }

    const items = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowSiteId = String(row[idx.siteId] || '').trim();
      const rowId = String(row[idx.id] || '').trim();

      let match = false;

      if (siteId === 'all-locations') {
        match = true;
      } else if (rowSiteId === siteId || rowId === siteId) {
        match = true;
      }

      if (match) {

        items.push({
          id: rowId || 'CP-' + i,
          siteId: rowSiteId,
          siteName: siteNameMap[rowSiteId] || rowSiteId || 'Unknown Site',
          route: siteRouteMap[rowSiteId] || '', // Include Route
          locationName: String(row[idx.location] || '').trim(),
          name: String(row[idx.name] || '').trim(),
          sequence: row[idx.sequence] || i,
          required: row[idx.required] === 'Yes' || row[idx.required] === true,
          qrStatus: String(row[idx.qrStatus] || 'pending').toLowerCase(),
          driveUrl: String(row[idx.driveUrl] || '').trim(),
          generatedAt: row[idx.generatedAt] || '',
          code: String(row[idx.location] || '').trim(),
          type: 'Standard'
        });
      }
    }

    Logger.log('[getCheckpointsBySite] Returning ' + items.length + ' items');
    return items;

  } catch (e) {
    Logger.log('[getCheckpointsBySite] ERROR: ' + e.message);
    throw e;
  }
}


/**
 * Save Checkpoint or Location Update
 * Routes to correct sheet based on ID prefix
 */
function saveCheckpoint(data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);

    // OPTION B: SEPARATE STORAGE
    // If it's a Map Marker (Location), it goes to Locations tab.
    // If it's a Patrol Point (Checkpoint), it goes to Checkpoints tab.

    // Heuristic: If it has GPS in the name/code or purely numeric ID, likely a map location.
    // But for VKS QC, we want "Point 1, Point 2" to be Checkpoints.

    // For now, FORCE all new saves from the modal to go to CHECKPOINTS tab.
    // We assume the User Interface calling this is the Checkpoint Manager.

    let sheet = ss.getSheetByName(SHEET_CHECKPOINTS);
    if (!sheet) {
      // Create if missing
      sheet = ss.insertSheet(SHEET_CHECKPOINTS);
      // Add headers if empty
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['id', 'siteId', 'name', 'location', 'sequence', 'required', 'qrStatus', 'driveUrl', 'generatedAt']);
      }
    }

    const isUpdate = data.id && data.id.length > 0;
    const now = new Date();

    if (isUpdate) {
      const values = sheet.getDataRange().getValues();
      const idx = values.findIndex(r => r[0] === data.id);

      if (idx !== -1) {
        // Found in Checkpoints tab - Update it
        // Columns: id(0), siteId(1), name(2), location(3), sequence(4), required(5)
        sheet.getRange(idx + 1, 2).setValue(data.siteId);
        sheet.getRange(idx + 1, 3).setValue(data.name);
        sheet.getRange(idx + 1, 4).setValue(data.location || ''); // Description/Note
        sheet.getRange(idx + 1, 5).setValue(data.sequence || (idx));
        sheet.getRange(idx + 1, 6).setValue(data.required ? 'Yes' : 'No');
        // We preserve QR info (columns 6,7,8) usually
        return { success: true, message: 'Checkpoint updated', id: data.id };
      } else {
        // Not found in Checkpoints... might be in Locations?
        // If migrating, we could check Locations, delete there, move here.
        // For now, let's assume if ID provided but not found, it's an error OR we create new.
        throw new Error('Checkpoint ID not found in Checkpoints tab');
      }
    } else {
      // CREATE NEW CHECKPOINT
      const newId = 'CP-' + Utilities.getUuid().substring(0, 8).toUpperCase();
      // id, siteId, name, location, sequence, required, qrStatus, driveUrl, generatedAt
      sheet.appendRow([
        newId,
        data.siteId,
        data.name,
        data.location || '',
        data.sequence || sheet.getLastRow(),
        data.required ? 'Yes' : 'No',
        'pending',
        '',
        ''
      ]);
      return { success: true, message: 'Checkpoint created', id: newId };
    }
  } catch (e) {
    Logger.log('Save Failed: ' + e.message);
    throw e;
  }
}

/**
 * Delete a checkpoint by ID
 * Removes the row from the Checkpoints sheet and trashes the Drive QR file if present
 * @param {string} cpId - Checkpoint ID (e.g. "CP-B5A5EA9F")
 * @returns {Object} { success: boolean, message: string }
 */
function deleteCheckpoint(cpId) {
  if (!cpId) throw new Error('Checkpoint ID is required');

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const sheet = ss.getSheetByName(SHEET_CHECKPOINTS);
    if (!sheet) throw new Error('Checkpoints sheet not found');

    const data = sheet.getDataRange().getValues();
    // Column 0 = id
    let rowIdx = -1;
    let driveUrl = '';

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(cpId).trim()) {
        rowIdx = i + 1; // 1-based row number for sheet operations
        driveUrl = String(data[i][7] || '').trim(); // driveUrl column
        break;
      }
    }

    if (rowIdx === -1) {
      throw new Error('Checkpoint not found: ' + cpId);
    }

    // Trash the Drive QR image if it exists
    if (driveUrl) {
      try {
        // Extract file ID from Drive URL
        var fileIdMatch = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (fileIdMatch && fileIdMatch[1]) {
          var file = DriveApp.getFileById(fileIdMatch[1]);
          file.setTrashed(true);
          Logger.log('[deleteCheckpoint] Trashed Drive file: ' + fileIdMatch[1]);
        }
      } catch (driveErr) {
        // Non-fatal: log but don't block deletion
        Logger.log('[deleteCheckpoint] Could not trash Drive file: ' + driveErr.message);
      }
    }

    // Delete the row
    sheet.deleteRow(rowIdx);
    Logger.log('[deleteCheckpoint] Deleted checkpoint ' + cpId + ' at row ' + rowIdx);

    return { success: true, message: 'Checkpoint deleted' };
  } catch (e) {
    Logger.log('[deleteCheckpoint] ERROR: ' + e.message);
    throw e;
  }
}

/**
 * Update Location status to 'generated' when QR is created
 */
function generateQRForLocation(locId) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);

    // 1. Try Checkpoints Tab First (Standard)
    let sheet = ss.getSheetByName(SHEET_CHECKPOINTS);
    let foundInCheckpoints = false;
    let rowIdx = -1;
    let headers = [];
    let data = [];

    if (sheet) {
      data = sheet.getDataRange().getValues();
      rowIdx = data.findIndex(r => r[0] === locId);
      if (rowIdx !== -1) {
        foundInCheckpoints = true;
        headers = data[0];
      }
    }

    // 2. Fallback to Locations Tab (Legacy/Map)
    if (!foundInCheckpoints) {
      sheet = ss.getSheetByName(SHEET_LOCATIONS);
      if (!sheet) throw new Error('Neither Checkpoints nor Locations sheet found');
      data = sheet.getDataRange().getValues();
      rowIdx = data.findIndex(r => r[0] === locId);
      if (rowIdx === -1) throw new Error('Location/Checkpoint not found: ' + locId);
      headers = data[0];
    }

    // Map Columns based on sheet type
    const isCheckpoint = foundInCheckpoints;
    const idx = {
      name: isCheckpoint ? 2 : getCIIndex(headers, ['name', 'location']), // Checkpoint col 2 is name
      siteId: isCheckpoint ? 1 : getCIIndex(headers, ['siteId']), // Checkpoint col 1 is siteId
      qrStatus: isCheckpoint ? 6 : getCIIndex(headers, ['qrStatus', 'status']), // Checkpoint col 6
      generatedAt: isCheckpoint ? 8 : getCIIndex(headers, ['generatedAt']), // Checkpoint col 8
      driveUrl: isCheckpoint ? 7 : getCIIndex(headers, ['driveUrl', 'url']) // Checkpoint col 7
    };

    const locationName = data[rowIdx][idx.name];
    const siteId = data[rowIdx][idx.siteId];

    // 0. Lookup Site Name AND Route for QR Content Decision
    const sitesSheet = ss.getSheetByName(SHEET_SITES);
    let siteName = 'Uncategorized';
    let siteRoute = ''; // Will be 'A', 'B', or empty

    if (sitesSheet && siteId) {
      const sitesData = sitesSheet.getDataRange().getValues();
      const sHeaders = sitesData[0];
      // Standard VKS columns: ID(0), code(1), nameEN(2), nameLO(3), type(4), route(5)
      const sIdIdx = 0;
      const sCodeIdx = 1; // VKS Code like "VKS-B-001"
      const sNameIdx = 2; // nameEN
      const sRouteIdx = 5; // route column

      // Match against BOTH id AND code (checkpoints may use either)
      const normalizedSiteId = String(siteId).trim().toUpperCase();
      const siteRow = sitesData.find(r => {
        const rowId = String(r[sIdIdx] || '').trim().toUpperCase();
        const rowCode = String(r[sCodeIdx] || '').trim().toUpperCase();
        return rowId === normalizedSiteId || rowCode === normalizedSiteId;
      });

      if (siteRow) {
        siteName = String(siteRow[sNameIdx] || 'Uncategorized').trim();
        siteRoute = String(siteRow[sRouteIdx] || '').trim().toUpperCase();
        Logger.log('[QR] Matched site: ' + siteName + ', Route: ' + siteRoute);
      } else {
        Logger.log('[QR] No site match found for siteId: ' + siteId);
      }
    }

    // Route-Based QR Content (PDF Links for A/B, Guard App for others)
    // Route-Based QR Content: Embed route in URL, handle redirect in Guard App
    // This allows the Guard App to serve BOTH tracking (scan) and info (redirect) purposes

    // Use the configured Guard App URL (from Config.gs)
    const targetBaseUrl = GUARD_APP_URL || ScriptApp.getService().getUrl();

    // Construct QR Content with all necessary parameters
    qrContent = `${targetBaseUrl}?type=info&locId=${encodeURIComponent(locId)}&cpName=${encodeURIComponent(locationName)}&siteId=${encodeURIComponent(siteId || '')}&route=${encodeURIComponent(siteRoute)}`;

    Logger.log('[QR] Generated content with route [' + siteRoute + ']: ' + qrContent);

    // Sanitize Site Name for Folder
    siteName = siteName.replace(/[\\/:*?"<>|]/g, '_');

    // 1. Fetch QR Image Blob
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qrContent)}`;
    const response = UrlFetchApp.fetch(qrApiUrl);
    // Sanitize Checkpoint Name for File
    const safeName = locationName.replace(/[\\/:*?"<>|]/g, '_');
    const blob = response.getBlob().setName(`${safeName}.png`);

    // 2. Save to Google Drive (Organized by Site)
    const rootFolder = DriveApp.getFolderById(FOLDER_ID_QR);
    let siteFolder;

    // Check if Site Folder exists
    const folderIter = rootFolder.getFoldersByName(siteName);
    if (folderIter.hasNext()) {
      siteFolder = folderIter.next();
    } else {
      siteFolder = rootFolder.createFolder(siteName);
    }

    // Check for existing file in Site Folder to replace
    const existing = siteFolder.getFilesByName(blob.getName());
    while (existing.hasNext()) {
      existing.next().setTrashed(true); // Delete existing to replace
    }

    const file = siteFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const driveUrl = file.getUrl();

    // Force thumbnail URL for better embedding
    // const thumbUrl = `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w1000`;

    // 3. Update Spreadsheet
    const timestamp = new Date().toISOString();

    // Using explicit column indexes for Checkpoints to be safe, or flexible for Locations
    if (isCheckpoint) {
      sheet.getRange(rowIdx + 1, 7).setValue('generated'); // Col 7 (1-based G) is qrStatus... wait.
      // Checkpoints: id(1), siteId(2), name(3), loc(4), seq(5), req(6), qrStatus(7), driveUrl(8), genAt(9)
      // Array index 6 is Column 7. Correct.
      sheet.getRange(rowIdx + 1, 7).setValue('generated');
      sheet.getRange(rowIdx + 1, 8).setValue(driveUrl);
      sheet.getRange(rowIdx + 1, 9).setValue(timestamp);
    } else {
      // Legacy flexible update
      if (idx.qrStatus !== -1) sheet.getRange(rowIdx + 1, idx.qrStatus + 1).setValue('generated');
      if (idx.generatedAt !== -1) sheet.getRange(rowIdx + 1, idx.generatedAt + 1).setValue(timestamp);
      if (idx.driveUrl !== -1) sheet.getRange(rowIdx + 1, idx.driveUrl + 1).setValue(driveUrl);
    }

    return {
      success: true,
      timestamp: timestamp,
      driveUrl: driveUrl,
      fileName: blob.getName()
    };

  } catch (e) {
    Logger.log('generateQRForLocation Failed: ' + e.message);
    throw e;
  }
}

/**
 * Get standard location presets for checkpoints
 * @returns {Array} Options [{value, label}]
 */
function getStandardLocations() {
  const locations = [
    'Main Entrance',
    'Back Entrance',
    'Emergency Exit',
    'Reception / Lobby',
    'Security Control Room',
    'Loading Dock',
    'Parking Gate',
    'Perimeter Fence',
    'Server Room',
    'Generator Room',
    'Manager Office',
    'Warehouse Zone A',
    'Warehouse Zone B',
    'Production Line',
    'Storage Area',
    'Patrol Point 1',
    'Patrol Point 2',
    'Patrol Point 3',
    'Patrol Point 4',
    'Patrol Point 5'
  ];

  return locations.map(loc => ({
    value: loc,
    label: loc
  }));
}

/**
 * Get patrol name options for inspector dropdown
 * Primary source: Inspectors sheet (QC) — filtered by status = 'active'
 * Fallback: Patrol Dashboard Sites tab column C (if Inspectors sheet empty)
 * @returns {Array} Options [{value, label}]
 */
function getPatrolNameOptions() {
  try {
    const names = [];
    const addedNames = new Set();

    // PRIMARY: Read from Inspectors sheet (master list with status)
    try {
      const qcSS = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
      const inspSheet = qcSS.getSheetByName(SHEET_INSPECTORS);
      if (inspSheet && inspSheet.getLastRow() > 1) {
        const lastCol = Math.max(inspSheet.getLastColumn(), 4);
        const inspData = inspSheet.getRange(2, 1, inspSheet.getLastRow() - 1, lastCol).getValues();
        // Find Shift column by header (robust against column reordering)
        const inspHeaders = inspSheet.getRange(1, 1, 1, lastCol).getValues()[0];
        var shiftColIdx = -1;
        for (var hi = 0; hi < inspHeaders.length; hi++) {
          if (String(inspHeaders[hi]).trim().toLowerCase() === 'shift') { shiftColIdx = hi; break; }
        }
        var shiftNumToName = { '1': 'morning', '2': 'evening', '3': 'night' };
        for (let i = 0; i < inspData.length; i++) {
          const name = String(inspData[i][1] || '').trim();
          const status = String(inspData[i][2] || 'active').trim().toLowerCase();
          if (name && status === 'active' && !addedNames.has(name)) {
            // Resolve shift: column value → 'morning'/'evening'/'night'
            var rawShift = shiftColIdx >= 0 ? String(inspData[i][shiftColIdx] || '').trim() : '';
            var resolvedShift = shiftNumToName[rawShift] || '';
            if (!resolvedShift && rawShift) {
              var sm = rawShift.match(/\b([123])\b/);
              if (sm) resolvedShift = shiftNumToName[sm[1]] || '';
            }
            if (!resolvedShift) resolvedShift = 'morning'; // Default
            names.push({ value: name, label: name, shift: resolvedShift });
            addedNames.add(name);
          }
        }
      }
    } catch (inspErr) {
      Logger.log('[getPatrolNameOptions] Inspectors sheet error: ' + inspErr.message);
    }

    // FALLBACK: If Inspectors sheet returned nothing, use Patrol SS Sites tab
    if (names.length === 0) {
      try {
        const patrolSS = SpreadsheetApp.openById(SPREADSHEET_ID_PATROL);
        const sitesSheet = patrolSS.getSheetByName('Sites');
        if (sitesSheet) {
          const data = sitesSheet.getDataRange().getValues();
          for (let i = 1; i < data.length; i++) {
            const patrolName = data[i][2] ? data[i][2].toString().trim() : '';
            if (patrolName && !addedNames.has(patrolName)) {
              names.push({ value: patrolName, label: patrolName });
              addedNames.add(patrolName);
            }
          }
        }
      } catch (fallbackErr) {
        Logger.log('[getPatrolNameOptions] Fallback error: ' + fallbackErr.message);
      }
    }

    names.sort((a, b) => a.label.localeCompare(b.label));
    Logger.log('[getPatrolNameOptions] Returning ' + names.length + ' inspectors');
    return names;
  } catch (e) {
    Logger.log('Error in getPatrolNameOptions: ' + e.message);
    return [];
  }
}


/**
 * DEBUG FUNCTION: Check connection to QC Spreadsheet and Locations tab
 */
function debugQRConnection(siteIdToCheck) {
  const result = {
    spreadsheetId: SPREADSHEET_ID_QC,
    ssFound: false,
    locationsTab: { name: SHEET_LOCATIONS, found: false, rows: 0, firstRow: [] },
    sitesTab: { name: SHEET_SITES, found: false, rows: 0 },
    siteOptionsCount: 0,
    checkpointsAllCount: 0,
    targetSite: siteIdToCheck || 'all-locations',
    targetSiteCount: 0,
    error: null
  };

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    result.ssFound = !!ss;

    const locSheet = ss.getSheetByName(SHEET_LOCATIONS);
    if (locSheet) {
      result.locationsTab.found = true;
      const data = locSheet.getDataRange().getValues();
      result.locationsTab.rows = data.length;
      result.locationsTab.firstRow = data.length > 0 ? data[0] : [];
    }

    const sitesSheet = ss.getSheetByName(SHEET_SITES);
    if (sitesSheet) {
      result.sitesTab.found = true;
      result.sitesTab.rows = sitesSheet.getLastRow();
    }

    // Check Options
    const opts = getSiteOptions();
    result.siteOptionsCount = opts.length;

    // Check All Locations
    const all = getCheckpointsBySite('all-locations');
    result.checkpointsAllCount = all.length;

    // Check Target Site if provided
    if (siteIdToCheck) {
      const target = getCheckpointsBySite(siteIdToCheck);
      result.targetSiteCount = target.length;
    } else {
      result.targetSiteCount = result.checkpointsAllCount;
    }

    return result;

  } catch (e) {
    result.error = e.message + '\n' + e.stack;
    return result;
  }
}

/**
 * Bulk generate placeholder checkpoints for a site
 * @param {string} siteId - Target site ID
 * @param {number} count - Number of checkpoints to create
 * @returns {Object} Result stats
 */
function bulkGenerateCheckpoints(siteId, count) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const sheet = ss.getSheetByName(SHEET_CHECKPOINTS);
    if (!sheet) throw new Error('Checkpoints sheet not found');

    // Get site name for the checkpoints
    const siteDetail = getSiteDetail(siteId);
    const siteName = siteDetail ? siteDetail.nameEN : 'Unknown Site';

    const now = new Date().toISOString();
    let createdCount = 0;

    // Get existing checkpoint count for this site to set proper sequence
    const existingData = sheet.getDataRange().getValues();
    const headers = existingData[0];
    const siteIdIdx = getCIIndex(headers, ['siteId', 'site_id']);
    let existingCount = 0;
    for (let i = 1; i < existingData.length; i++) {
      if (String(existingData[i][siteIdIdx]) === siteId) existingCount++;
    }

    for (let i = 0; i < count; i++) {
      const newId = 'CP-' + Utilities.getUuid().substring(0, 8).toUpperCase();
      // Use COLUMNS.checkpoints schema: ['id', 'siteId', 'name', 'location', 'sequence', 'required', 'createdAt']
      const row = COLUMNS.checkpoints.map(h => {
        switch (h) {
          case 'id': return newId;
          case 'siteId': return siteId;
          case 'name': return 'Checkpoint ' + (existingCount + i + 1);
          case 'location': return siteName;
          case 'sequence': return existingCount + i + 1;
          case 'required': return 'Yes';
          case 'createdAt': return now;
          default: return '';
        }
      });

      sheet.appendRow(row);
      createdCount++;
    }

    return { success: true, created: createdCount };
  } catch (e) {
    Logger.log('Bulk Generate Failed: ' + e.message);
    throw e;
  }
}

/**
 * Get the deployed Guard App URL for QR generation
 * @returns {string} URL
 */
function getGuardAppUrl() {
  return GUARD_APP_URL || ScriptApp.getService().getUrl(); // Fallback to current if missing
}

// =====================================================
// GUARD ACTIVITY FUNCTIONS
// =====================================================

/**
 * Get guards who have checked in at a specific site
 * Combines data from Scans (regular guards) and InspectionLogs (inspectors)
 * @param {string} siteId - Site ID
 * @returns {Object} { guards: [...], inspectors: [...] }
 */
function getGuardsBySite(siteId) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);

    // Get site name for matching InspectionLogs (which uses siteName not siteId)
    const siteDetail = getSiteDetail(siteId);
    const siteName = siteDetail ? siteDetail.nameEN : '';

    const result = {
      guards: [],      // Regular guards from Scans
      inspectors: []   // Inspectors from InspectionLogs
    };

    // === REGULAR GUARDS from Scans (now reading from QC Sheet) ===
    const scansSheet = ss.getSheetByName(SHEET_SCANS);
    if (scansSheet && scansSheet.getLastRow() > 1) {
      const scansData = scansSheet.getDataRange().getValues();
      const scansHeaders = scansData[0];
      const sIdx = {
        guardId: getCIIndex(scansHeaders, ['guardId', 'guard_id']),
        siteId: getCIIndex(scansHeaders, ['siteId', 'site_id']),
        timestamp: getCIIndex(scansHeaders, ['timestamp', 'scanTime']),
        status: getCIIndex(scansHeaders, ['status'])
      };

      // Aggregate by guardId
      const guardMap = {};
      for (let i = 1; i < scansData.length; i++) {
        const row = scansData[i];
        const gSiteId = String(row[sIdx.siteId] || '').trim();
        if (gSiteId !== siteId) continue;

        const guardId = String(row[sIdx.guardId] || '').trim();
        if (!guardId) continue;

        if (!guardMap[guardId]) {
          guardMap[guardId] = { id: guardId, totalCheckins: 0, lastCheckin: null, onTimeCount: 0 };
        }
        guardMap[guardId].totalCheckins++;

        const ts = row[sIdx.timestamp];
        if (ts && (!guardMap[guardId].lastCheckin || new Date(ts) > guardMap[guardId].lastCheckin)) {
          guardMap[guardId].lastCheckin = new Date(ts);
        }

        const status = String(row[sIdx.status] || '').toLowerCase();
        if (status === 'on_time' || status === 'ontime') guardMap[guardId].onTimeCount++;
      }

      // Enrich with guard names from Guards sheet
      const guardsSheet = ss.getSheetByName(SHEET_GUARDS);
      const guardNameMap = {};
      if (guardsSheet && guardsSheet.getLastRow() > 1) {
        const guardsData = guardsSheet.getDataRange().getValues();
        for (let i = 1; i < guardsData.length; i++) {
          const gid = String(guardsData[i][0] || '');
          const name = String(guardsData[i][1] || '') + ' ' + String(guardsData[i][2] || '');
          guardNameMap[gid] = name.trim();
        }
      }

      // Build result array
      Object.keys(guardMap).forEach(gid => {
        const g = guardMap[gid];
        const name = guardNameMap[gid] || 'Guard ' + gid.substring(0, 6);
        const initials = getInitials(name);
        result.guards.push({
          id: gid,
          name: name,
          initials: initials,
          type: 'guard',
          totalCheckins: g.totalCheckins,
          lastCheckin: g.lastCheckin ? g.lastCheckin.toISOString() : null,
          onTimeRate: g.totalCheckins > 0 ? Math.round((g.onTimeCount / g.totalCheckins) * 100) : 0
        });
      });

      // Sort by total check-ins descending
      result.guards.sort((a, b) => b.totalCheckins - a.totalCheckins);
    }

    // === INSPECTORS from InspectionLogs ===
    const logsSheet = ss.getSheetByName(SHEET_INSPECTION_LOGS);
    if (logsSheet && logsSheet.getLastRow() > 1 && siteName) {
      const logsData = logsSheet.getDataRange().getValues();
      const logsHeaders = logsData[0];
      const lIdx = {
        patrolName: getCIIndex(logsHeaders, ['patrolName', 'patrol_name', 'inspector']),
        siteName: getCIIndex(logsHeaders, ['siteName', 'site_name', 'site']),
        timestamp: getCIIndex(logsHeaders, ['timestamp', 'date']),
        score: getCIIndex(logsHeaders, ['score'])
      };

      const inspectorMap = {};
      for (let i = 1; i < logsData.length; i++) {
        const row = logsData[i];
        const logSiteName = String(row[lIdx.siteName] || '').trim();

        // Match by site name (partial match for flexibility)
        if (!logSiteName.toLowerCase().includes(siteName.toLowerCase().substring(0, 10))) continue;

        const inspectorName = String(row[lIdx.patrolName] || '').trim();
        if (!inspectorName) continue;

        if (!inspectorMap[inspectorName]) {
          inspectorMap[inspectorName] = { name: inspectorName, totalVisits: 0, lastVisit: null, avgScore: 0, scores: [] };
        }
        inspectorMap[inspectorName].totalVisits++;

        const ts = row[lIdx.timestamp];
        if (ts && (!inspectorMap[inspectorName].lastVisit || new Date(ts) > inspectorMap[inspectorName].lastVisit)) {
          inspectorMap[inspectorName].lastVisit = new Date(ts);
        }

        const score = parseFloat(row[lIdx.score]) || 0;
        if (score > 0) inspectorMap[inspectorName].scores.push(score);
      }

      // Build result array
      Object.keys(inspectorMap).forEach(name => {
        const insp = inspectorMap[name];
        const avgScore = insp.scores.length > 0 ? (insp.scores.reduce((a, b) => a + b, 0) / insp.scores.length).toFixed(1) : 0;
        result.inspectors.push({
          id: 'insp-' + name.replace(/\s+/g, '-').toLowerCase(),
          name: name,
          initials: getInitials(name),
          type: 'inspector',
          totalVisits: insp.totalVisits,
          lastVisit: insp.lastVisit ? insp.lastVisit.toISOString() : null,
          avgScore: avgScore
        });
      });

      result.inspectors.sort((a, b) => b.totalVisits - a.totalVisits);
    }

    return result;
  } catch (e) {
    Logger.log('Error in getGuardsBySite: ' + e.message);
    return { guards: [], inspectors: [] };
  }
}

/**
 * Get detailed stats for a specific guard at a specific site
 * @param {string} guardId - Guard ID or inspector name
 * @param {string} siteId - Site ID
 * @param {string} guardType - 'guard' or 'inspector'
 */
function getGuardStats(guardId, siteId, guardType) {
  try {
    Logger.log('getGuardStats called: guardId=' + guardId + ' siteId=' + siteId + ' type=' + guardType);

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);

    // Get site name - try getSiteDetail first, fallback to Sites sheet
    let siteName = '';
    const siteDetail = getSiteDetail(siteId);
    if (siteDetail) {
      siteName = siteDetail.nameEN;
      Logger.log('Site found via getSiteDetail: ' + siteName);
    } else {
      // Fallback: search Sites sheet directly
      const sitesSheet = ss.getSheetByName(SHEET_SITES);
      if (sitesSheet && sitesSheet.getLastRow() > 1) {
        const sitesData = sitesSheet.getDataRange().getValues();
        for (let i = 1; i < sitesData.length; i++) {
          if (String(sitesData[i][0]) === siteId) {
            siteName = String(sitesData[i][2] || '') || String(sitesData[i][1] || ''); // NameEN or NameLO
            Logger.log('Site found via fallback: ' + siteName);
            break;
          }
        }
      }
    }

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const result = {
      guardId: guardId,
      siteId: siteId,
      siteName: siteName,
      name: '',
      initials: '',
      type: guardType,
      totalCheckins: 0,
      weeklyCheckins: 0,
      monthlyCheckins: 0,
      lastCheckin: null,
      onTimeRate: 0,
      otherSites: []
    };

    if (guardType === 'guard') {
      // === REGULAR GUARD from Scans (now reading from QC Sheet) ===
      const scansSheet = ss.getSheetByName(SHEET_SCANS);
      if (!scansSheet || scansSheet.getLastRow() <= 1) return result;

      const scansData = scansSheet.getDataRange().getValues();
      const scansHeaders = scansData[0];
      const sIdx = {
        guardId: getCIIndex(scansHeaders, ['guardId', 'guard_id']),
        siteId: getCIIndex(scansHeaders, ['siteId', 'site_id']),
        timestamp: getCIIndex(scansHeaders, ['timestamp', 'scanTime']),
        status: getCIIndex(scansHeaders, ['status'])
      };

      let onTimeCount = 0;
      const otherSitesMap = {};

      // Get guard name
      const guardsSheet = ss.getSheetByName(SHEET_GUARDS);
      if (guardsSheet && guardsSheet.getLastRow() > 1) {
        const guardsData = guardsSheet.getDataRange().getValues();
        for (let i = 1; i < guardsData.length; i++) {
          if (String(guardsData[i][0]) === guardId) {
            result.name = (String(guardsData[i][1] || '') + ' ' + String(guardsData[i][2] || '')).trim();
            break;
          }
        }
      }
      if (!result.name) result.name = 'Guard ' + guardId.substring(0, 6);
      result.initials = getInitials(result.name);

      Logger.log('Searching scans: guardId=' + guardId + ' siteId=' + siteId);
      Logger.log('Column indices: guardId=' + sIdx.guardId + ', siteId=' + sIdx.siteId);
      let matchCount = 0;

      for (let i = 1; i < scansData.length; i++) {
        const row = scansData[i];
        const gId = String(row[sIdx.guardId] || '').trim();
        if (gId !== guardId) continue;

        const scanSiteId = String(row[sIdx.siteId] || '').trim();

        matchCount++;
        if (matchCount <= 3) {
          Logger.log('Match #' + matchCount + ': gId=' + gId + ' scanSiteId=' + scanSiteId + ' looking for siteId=' + siteId);
        }

        const ts = row[sIdx.timestamp] ? new Date(row[sIdx.timestamp]) : null;
        const status = String(row[sIdx.status] || '').toLowerCase();

        if (scanSiteId === siteId) {
          result.totalCheckins++;
          if (ts && ts >= startOfWeek) result.weeklyCheckins++;
          if (ts && ts >= startOfMonth) result.monthlyCheckins++;
          if (ts && (!result.lastCheckin || ts > new Date(result.lastCheckin))) {
            result.lastCheckin = ts.toISOString();
          }
          if (status === 'on_time' || status === 'ontime') onTimeCount++;
        } else if (scanSiteId) {
          // Track other sites
          if (!otherSitesMap[scanSiteId]) otherSitesMap[scanSiteId] = 0;
          otherSitesMap[scanSiteId]++;
        }
      }

      Logger.log('Total guardId matches: ' + matchCount + ', total for this site: ' + result.totalCheckins);

      result.onTimeRate = result.totalCheckins > 0 ? Math.round((onTimeCount / result.totalCheckins) * 100) : 0;

      // Get site names for other sites (with safe error handling)
      Object.keys(otherSitesMap).forEach(sid => {
        try {
          const sd = getSiteDetail(sid);
          result.otherSites.push({
            siteId: sid,
            siteName: sd ? (sd.nameEN || sd.nameLO || sid) : sid,
            visits: otherSitesMap[sid]
          });
        } catch (e) {
          // Site not found - use raw ID as name
          result.otherSites.push({
            siteId: sid,
            siteName: sid,
            visits: otherSitesMap[sid]
          });
        }
      });
      result.otherSites.sort((a, b) => b.visits - a.visits);
      result.otherSites = result.otherSites.slice(0, 5); // Top 5

    } else if (guardType === 'inspector') {
      // === INSPECTOR from InspectionLogs ===
      const inspectorName = guardId.replace('insp-', '').replace(/-/g, ' ');
      result.name = inspectorName;
      result.initials = getInitials(inspectorName);

      const logsSheet = ss.getSheetByName(SHEET_INSPECTION_LOGS);
      if (!logsSheet || logsSheet.getLastRow() <= 1) return result;

      const logsData = logsSheet.getDataRange().getValues();
      const logsHeaders = logsData[0];
      const lIdx = {
        patrolName: getCIIndex(logsHeaders, ['patrolName', 'patrol_name', 'inspector']),
        siteName: getCIIndex(logsHeaders, ['siteName', 'site_name', 'site']),
        timestamp: getCIIndex(logsHeaders, ['timestamp', 'date']),
        score: getCIIndex(logsHeaders, ['score'])
      };

      const otherSitesMap = {};
      const scores = [];

      for (let i = 1; i < logsData.length; i++) {
        const row = logsData[i];
        const logInspector = String(row[lIdx.patrolName] || '').trim().toLowerCase();
        if (!logInspector.includes(inspectorName.toLowerCase().substring(0, 5))) continue;

        const logSiteName = String(row[lIdx.siteName] || '').trim();
        const ts = row[lIdx.timestamp] ? new Date(row[lIdx.timestamp]) : null;
        const score = parseFloat(row[lIdx.score]) || 0;

        const isThisSite = siteName && logSiteName.toLowerCase().includes(siteName.toLowerCase().substring(0, 10));

        if (isThisSite) {
          result.totalCheckins++;
          if (ts && ts >= startOfWeek) result.weeklyCheckins++;
          if (ts && ts >= startOfMonth) result.monthlyCheckins++;
          if (ts && (!result.lastCheckin || ts > new Date(result.lastCheckin))) {
            result.lastCheckin = ts.toISOString();
          }
          if (score > 0) scores.push(score);
        } else if (logSiteName) {
          if (!otherSitesMap[logSiteName]) otherSitesMap[logSiteName] = 0;
          otherSitesMap[logSiteName]++;
        }
      }

      result.onTimeRate = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) : 0; // Avg score as "rate"

      Object.keys(otherSitesMap).forEach(sn => {
        result.otherSites.push({ siteId: '', siteName: sn, visits: otherSitesMap[sn] });
      });
      result.otherSites.sort((a, b) => b.visits - a.visits);
      result.otherSites = result.otherSites.slice(0, 5);
    }

    return result;
  } catch (e) {
    Logger.log('Error in getGuardStats: ' + e.message + ' | guardId=' + guardId + ' siteId=' + siteId + ' type=' + guardType);
    // Return partial result instead of throwing to prevent UI errors
    const safeGuardId = String(guardId || '');
    const isInspector = safeGuardId.startsWith('insp-');
    return {
      guardId: guardId,
      siteId: siteId,
      siteName: '',
      name: isInspector ? safeGuardId.replace('insp-', '').replace(/-/g, ' ') : (safeGuardId ? 'Guard ' + safeGuardId.substring(0, 6) : 'Unknown'),
      initials: '?',
      type: guardType || 'guard',
      totalCheckins: 0,
      weeklyCheckins: 0,
      monthlyCheckins: 0,
      lastCheckin: null,
      onTimeRate: 0,
      otherSites: []
    };
  }
}

/**
 * Get initials from a name (e.g., "John Doe" -> "JD")
 */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}
