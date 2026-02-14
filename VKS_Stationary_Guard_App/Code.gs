function doGet(e) {
  // 1. Dual-Purpose Router
  // 1. Dual-Purpose Router
  
  // If ?type=info, check for Route Redirect or serve Public Marketing Page
  if (e.parameter && e.parameter.type === 'info') {
    
    // Check for Route-based PDF Redirect (vks-bmad logic)
    const route = (e.parameter.route || '').toUpperCase();
    if (route === 'A' || route === 'B') {
        const targetPdf = (route === 'A') 
            ? 'https://drive.google.com/file/d/1LjlKVsZL5lZAFm8rt8u8Rygv05KZqW5n/view'
            : 'https://drive.google.com/file/d/1nBZIgER9P5v8zjztfP9oX0npNFSgMwsl/view';
            
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VKS Security Service</title>
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+Lao:wght@400;700&display=swap" rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
    <script>
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        vks: {
                            navy: "#0F172A", 
                            "navy-light": "#1E293B",
                            gold: "#C5A059", 
                            "gold-hover": "#B08D45",
                        },
                        "background-light": "#F8F9FA",
                        "text-secondary": "#64748B",
                        "border-light": "#E2E8F0",
                    },
                    fontFamily: {
                        display: ["Inter", "sans-serif"],
                        lao: ["Noto Sans Lao", "sans-serif"],
                    },
                    boxShadow: {
                        'tactical': '0 4px 6px -1px rgba(15, 23, 42, 0.05), 0 2px 4px -1px rgba(15, 23, 42, 0.03)',
                    }
                },
            },
        };
    </script>
    <style>
        body { min-height: 100vh; font-family: 'Inter', 'Noto Sans Lao', sans-serif; }
        .clip-octagon { clip-path: polygon(29% 0, 71% 0, 100% 29%, 100% 71%, 71% 100%, 29% 100%, 0 71%, 0 29%); }
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24 }
        .btn-active:active { transform: scale(0.95); transition: transform 0.1s ease; }
    </style>
</head>
<body class="bg-background-light text-slate-800 min-h-screen font-display flex flex-col items-center selection:bg-vks-navy selection:text-vks-gold transition-colors duration-200">
    
    <!-- Background Decorations -->
    <div class="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
        <div class="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] border-[2px] border-vks-navy/5 clip-octagon transform rotate-12"></div>
        <div class="absolute top-20 left-1/2 -translate-x-1/2 w-[550px] h-[550px] border-[1px] border-vks-navy/5 clip-octagon transform -rotate-6"></div>
        <div class="absolute -bottom-20 -right-20 w-96 h-96 rounded-full border-[30px] border-vks-navy/5 opacity-30 blur-3xl"></div>
    </div>

    <main class="w-full max-w-md px-6 py-12 flex flex-col flex-grow relative z-10 justify-center">
        <header class="flex flex-col items-center text-center mb-10">
            <div class="w-24 h-24 mb-6 transform hover:scale-105 transition-transform duration-300">
                <img src="https://drive.google.com/thumbnail?id=1o7UGoZhLBG43hm-5eao8UYB4YjeQ_IhT&sz=w200" alt="VKS Logo" class="w-full h-full object-cover clip-octagon shadow-lg">
            </div>
            <h1 class="font-lao text-2xl md:text-3xl font-bold text-vks-navy mb-2 leading-relaxed tracking-tight">
                ວຽງຄຳ ບໍລິການຄວາມປອດໄພ
            </h1>
            <h2 class="text-vks-gold font-bold text-sm tracking-[0.2em] uppercase mb-8 border-b-2 border-vks-gold/20 pb-2">
                Viengkham Security Service
            </h2>
            <div class="inline-flex items-center px-4 py-1.5 rounded-full border border-vks-navy/10 bg-white shadow-sm">
                <span class="material-symbols-outlined text-vks-gold text-[18px] mr-2" style="font-variation-settings: 'FILL' 1;">verified</span>
                <span class="text-vks-navy text-xs font-bold uppercase tracking-wide">Official Site Document</span>
            </div>
        </header>

        <div class="space-y-4 w-full">
            <!-- Site Info Card -->
            <a href="${targetPdf}" target="_top" class="block group relative bg-white rounded-xl p-5 border border-border-light shadow-tactical hover:border-vks-navy/30 transition-all duration-300 transform active:scale-[0.98]">
                <div class="absolute left-0 top-4 bottom-4 w-1 bg-vks-gold rounded-r-md opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4">
                        <div class="flex-shrink-0 w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center group-hover:bg-vks-gold/10 transition-colors">
                            <span class="material-symbols-outlined text-vks-navy text-2xl group-hover:text-vks-gold transition-colors">menu_book</span>
                        </div>
                        <div class="flex flex-col text-left">
                            <h3 class="text-base font-bold text-vks-navy">Site Information</h3>
                            <p class="text-[11px] text-text-secondary uppercase tracking-wider font-medium mb-1 font-lao">ຂໍ້ມູນສະຖານທີ່</p>
                            <p class="text-sm font-bold text-vks-gold tracking-wide">View Details</p>
                        </div>
                    </div>
                    <div class="flex-shrink-0 w-10 h-10 bg-vks-navy hover:bg-vks-navy-light rounded-lg flex items-center justify-center shadow-md transition-all duration-200">
                        <span class="material-symbols-outlined text-white text-xl">visibility</span>
                    </div>
                </div>
            </a>
        </div>

        <footer class="w-full mt-12 flex flex-col items-center opacity-80">
            <div class="w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-6"></div>
            <p class="text-[10px] text-gray-400 uppercase tracking-[0.2em] font-bold text-center">
                Licensed & Certified Security Provider
            </p>
        </footer>
    </main>
</body>
</html>`;
        
        return HtmlService.createHtmlOutput(html)
            .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    return HtmlService.createTemplateFromFile('PublicPage')
      .evaluate()
      .setTitle('VKS Security Services')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // If requesting manifest.json for PWA
  if (e.parameter.p === 'manifest') {
    return ContentService.createTextOutput(JSON.stringify(getManifest()))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Default: Serve the Guard App
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('VKS Guard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
    .getContent();
}

function getManifest() {
  return {
    "name": "VKS Stationary Guard",
    "short_name": "VKS Guard",
    "start_url": "?v=1",
    "display": "standalone",
    "background_color": "#ffffff",
    "theme_color": "#15803d",
    "icons": [
      {
        "src": "https://cdn-icons-png.flaticon.com/512/9203/9203764.png",
        "sizes": "192x192",
        "type": "image/png"
      }
    ]
  };
}

/**
 * Backend Logic
 */

// Helper to normalize site IDs (QR content -> Canonical Site Code)
function resolveSiteId(rawInput, sites) {
  if (!rawInput) return '';
  if (!sites || sites.length === 0) sites = getTableData('Sites');

  const normalizedInput = String(rawInput).trim().toUpperCase();

  // 1. Direct match on ID or Code
  const directMatch = sites.find(s =>
    String(s.id).toUpperCase() === normalizedInput ||
    String(s.code).toUpperCase() === normalizedInput
  );
  if (directMatch) return directMatch.code; // PREFER CODE (e.g., VKS-A-001)

  // 2. Contains Match (e.g., "VKS25-061" inside "Some Name VKS25-061")
  // Extract VKS pattern: VKS followed by numbers/dashes
  const vksMatch = normalizedInput.match(/VKS\d+[-]\d+/);
  if (vksMatch) {
    const extracted = vksMatch[0];
    const partialMatch = sites.find(s => String(s.nameEN || '').toUpperCase().includes(extracted));
    if (partialMatch) return partialMatch.code;
  }

  // 3. Fallback: Check if NameEN *contains* the raw input (e.g., raw is just the code part)
  const nameMatch = sites.find(s => String(s.nameEN).toUpperCase().includes(normalizedInput));
  if (nameMatch) return nameMatch.code;

  return rawInput; // Return raw if no match found
}

// HAVERSINE FORMULA (Skill: vks-backend-patterns)
function getDistanceKm(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function validateGeofence(meta, siteConfig) {
  // FALLBACK 1: Skip if site has no GPS
  if (!siteConfig || !siteConfig.lat || !siteConfig.lng) {
    console.log('[Geo] Site GPS missing, skipping fence');
    return { valid: true, skipped: true };
  }

  // FALLBACK 2: Skip if guard GPS unavailable or invalid
  if (!meta || !meta.lat || !meta.lng) {
    console.log('[Geo] Guard GPS unavailable');
    return { valid: true, skipped: true };
  }

  const dist = getDistanceKm(meta.lat, meta.lng, siteConfig.lat, siteConfig.lng);
  if (dist === null) return { valid: true, skipped: true };

  const thresholdKm = 0.150; // 150m (allows for GPS drift)

  // TEMPORARILY DISABLED as per user request
  return { valid: true, skipped: true, message: 'Geofencing disabled' };

  /*
  if (dist > thresholdKm) {
    return {
      valid: false,
      distance: Math.round(dist * 1000), // meters
      message: 'Too far: ' + Math.round(dist * 1000) + 'm away'
    };
  }
  return { valid: true, distance: Math.round(dist * 1000) };
  */
}

function processScan(qrContent, guardIdentifier, locationId, scanType, meta) {
  if (!qrContent) return { success: false, message: 'Empty QR' };

  let canonicalSiteId = '';
  let checkpointNum = '';
  let extractedLocId = '';

  // Cache Sites data once for performance
  const sites = getTableData('Sites');

  // 1. Detect Dual-Purpose URL Format
  if (qrContent.includes('?type=info')) {
    const locIdMatch = qrContent.match(/locId=([^&]+)/);
    const cpNameMatch = qrContent.match(/cpName=([^&]+)/);
    const siteIdMatch = qrContent.match(/siteId=([^&]+)/);
    // Legacy fallback for old QRs
    const legacySiteMatch = qrContent.match(/site=([^&]+)/);

    extractedLocId = locIdMatch ? decodeURIComponent(locIdMatch[1]) : '';
    const cpName = cpNameMatch ? decodeURIComponent(cpNameMatch[1]) : (legacySiteMatch ? decodeURIComponent(legacySiteMatch[1]) : '');
    const siteIdFromQR = siteIdMatch ? decodeURIComponent(siteIdMatch[1]) : '';

    // Use siteId from QR directly if available, otherwise try to resolve
    canonicalSiteId = siteIdFromQR || resolveSiteId(cpName || extractedLocId, sites);
    checkpointNum = extractedLocId; // For URL format, locId is the checkpoint identifier
  }
  // 2. Legacy Format: VKS|SITE|POINT
  else {
    const parts = qrContent.split('|');
    if (parts[0] !== 'VKS') {
      return { success: false, message: 'Invalid QR Code Format' };
    }
    const rawQrLocation = parts[1];
    checkpointNum = parseInt(parts[2]) || '';
    canonicalSiteId = resolveSiteId(rawQrLocation, sites);
  }

  // guardIdentifier can be a string (ID) or an object (Profile)
  let guardId = (typeof guardIdentifier === 'object') ? guardIdentifier.empId : guardIdentifier;

  let dynCheckpoints = 4; // Default
  let dynRounds = 7;      // Default
  let dynTiming = '06:00-14:00';
  let siteConfig = null;
  let siteInfo = null; // Declared here so it's accessible throughout the function

  try {
    const configs = getTableData('Site_Config'); // defined in Database.js
    // 'sites' is already loaded above
    // Try to find site info by Code OR ID (e.g. if canonical is UUID)
    siteInfo = sites.find(s => s.code === canonicalSiteId || s.id === canonicalSiteId);

    if (siteInfo) {
      // 1. Try "DEFAULT_TIMING" (Legacy)
      if (siteInfo.DEFAULT_TIMING) dynTiming = siteInfo.DEFAULT_TIMING;

      // 2. Try shiftStart / shiftEnd columns (Standard)
      if (siteInfo.shiftStart || siteInfo.shiftEnd) {
        // Helper to format time (handles Date objects or Strings)
        const fmt = (val) => {
          if (!val) return null;
          if (val instanceof Date) return val.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          return String(val).substring(0, 5); // Assume HH:mm...
        };

        const s = fmt(siteInfo.shiftStart) || '06:00';
        const e = fmt(siteInfo.shiftEnd) || '18:00';
        dynTiming = `${s}-${e}`;
      }
      
      // 3. Read checkpointTarget and roundsTarget from Sites table (QC Master)
      if (siteInfo.checkpointTarget) dynCheckpoints = parseInt(siteInfo.checkpointTarget) || 4;
      if (siteInfo.roundsTarget) dynRounds = parseInt(siteInfo.roundsTarget) || 7;
    }

    // Try to match by CODE first (VKS-A-001), then ID, then Name (Legacy Site_Config fallback)
    siteConfig = configs.find(c =>
      String(c.code || '').toUpperCase() === String(canonicalSiteId).toUpperCase() || // MATCH BY CODE
      String(c.siteId) === canonicalSiteId
    );

    if (siteConfig) {
      // Site_Config overrides if present (legacy support)
      if (siteConfig.checkpoints) dynCheckpoints = parseInt(siteConfig.checkpoints);
      if (siteConfig.rounds) dynRounds = parseInt(siteConfig.rounds);
      if (siteConfig.shiftStart && siteConfig.shiftEnd) {
        dynTiming = `${siteConfig.shiftStart}-${siteConfig.shiftEnd}`;
      }
    }

    // Merge Lat/Lng from Sites table if missing in Site_Config but available in Sites
    if (siteInfo && (!siteConfig || !siteConfig.lat)) {
      if (!siteConfig) siteConfig = {};
      siteConfig.lat = siteInfo.lat;
      siteConfig.lng = siteInfo.lng;
    }

  } catch (e) {
    console.warn('Failed to load Site_Config:', e);
  }

  // === GEOFENCING CHECK ===
  // Only check if we have meta GPS data
  if (meta && meta.lat && meta.lng) {
    const geoResult = validateGeofence(meta, siteConfig || {});
    if (!geoResult.valid) {
      console.warn(`Geofence failed: ${geoResult.message}`);
      return { success: false, message: geoResult.message };
    }
  }
  // ========================

  // AUTO-REGISTRATION for CHECKIN
  if (scanType === 'CHECKIN') {
    if (typeof guardIdentifier === 'object') {
      ensureGuardExists(guardIdentifier);
    }

    // === SMART SHIFT CALCULATION ===
    let calculatedShift = null;

    // Determine dynamic timing based on current time + 30m buffer
    if (siteConfig && siteConfig.shiftType === '8h' && siteConfig.shiftStart) {
       const now = new Date();
       const effectiveTime = new Date(now.getTime() + 30 * 60000); // Add 30 mins
       const effHour = effectiveTime.getHours();
       
       // Normalize shiftStart to string (Handle Date objects from Sheets)
       let startStr = '';
       if (siteConfig.shiftStart instanceof Date) {
           startStr = siteConfig.shiftStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
       } else {
           startStr = String(siteConfig.shiftStart);
       }

       // Parse Base Start (e.g. 06)
       let baseStart = parseInt(startStr.split(':')[0]);
       if (isNaN(baseStart)) baseStart = 6;
       
       // Calculate which 8h slot we are in relative to base
       // (effHour - base + 24) % 24 gives hours since base start
       let relative = (effHour - baseStart + 24) % 24;
       let slotIndex = Math.floor(relative / 8); // 0, 1, 2
       
       let actualStart = (baseStart + slotIndex * 8) % 24;
       let actualEnd = (actualStart + 8) % 24;
       
       dynTiming = `${String(actualStart).padStart(2,'0')}:00-${String(actualEnd).padStart(2,'0')}:00`;
       
       // Update Shift Number (1, 2, 3) based on slot
       if (baseStart === 6) {
           calculatedShift = slotIndex + 1; 
       }
    }
    // ===============================

    const shift = calculatedShift || determineShift(new Date());
    const isOT = meta ? !!meta.isOT : false;

    // Final Safety / Fallback
    dynCheckpoints = parseInt(dynCheckpoints) || 4;
    dynRounds = parseInt(dynRounds) || 7;

    // CHECKIN records should NOT have round or checkpointId
    const record = {
      guardId: guardId,
      checkpointId: '',
      siteId: canonicalSiteId, // Normalized
      lat: meta ? meta.lat : '',
      lng: meta ? meta.lng : '',
      accuracy: meta ? (meta.accuracy || '') : '',
      status: 'CHECKIN',
      round: ''
    };

    appendRecord('Scans', record);
    return {
      success: true,
      action: 'CHECKIN_COMPLETE',
      locationId: canonicalSiteId, // Return normalized ID for frontend state
      locationName: (siteInfo && siteInfo.nameEN) ? siteInfo.nameEN : ((siteConfig && siteConfig.name) ? siteConfig.name : canonicalSiteId),
      shift: record.shift || determineShift(new Date()),
      shiftTiming: dynTiming,
      isOT: isOT,
      checkpointTarget: dynCheckpoints,
      roundsTarget: dynRounds
    };
  }

  // PATROL SCAN LOGIC
  if (scanType === 'PATROL') {
    // Restriction removed as per user request (Step 417)
    // We allow scanning points even if site ID technically mismatches (e.g. sub-sites)

    /*
    // Normalize both for comparison
    if (canonicalSiteId !== locationId && resolveSiteId(locationId, []) !== canonicalSiteId) {
      return { success: false, message: 'Wrong Location! You are checked in at ' + locationId };
    }
    */

    // SERVER-SIDE DEDUP: Prevent duplicate patrol scans (offline replays, race conditions)
    try {
      const existingScans = getTableData('Scans');
      const roundNum = meta ? meta.roundNumber : '';
      const isDuplicate = existingScans.some(scan => 
        scan.guardId === guardId && 
        scan.checkpointId === checkpointNum && 
        scan.status === 'PATROL' &&
        String(scan.roundNumber || scan.round) === String(roundNum) &&
        // Same day only (prevent blocking across shifts)
        scan.timestamp && new Date(scan.timestamp).toDateString() === new Date().toDateString()
      );
      if (isDuplicate) {
        console.warn('Server dedup: duplicate patrol scan blocked', guardId, checkpointNum, roundNum);
        // Still return success so frontend doesn't error — data already saved
        return {
          success: true,
          action: 'ALREADY_SAVED',
          checkpoint: checkpointNum,
          totalCheckpoints: dynCheckpoints
        };
      }
    } catch (dedupErr) {
      console.warn('Dedup check failed (non-blocking):', dedupErr);
    }

    const record = {
      guardId: guardId,
      checkpointId: checkpointNum,
      siteId: canonicalSiteId, // Use normalized canonical ID
      lat: meta ? meta.lat : '',
      lng: meta ? meta.lng : '',
      accuracy: meta ? (meta.accuracy || '') : '',
      status: 'PATROL',
      assessment: meta ? meta.assessment : '',
      note: meta ? meta.note : '',
      photo: meta ? meta.photo : '',
      roundNumber: meta ? meta.roundNumber : '',
      pointInRound: meta ? meta.pointInRound : '',
      round: meta ? meta.roundNumber : ''
    };

    appendRecord('Scans', record);

    return {
      success: true,
      action: 'SCAN_SAVED',
      checkpoint: checkpointNum,
      totalCheckpoints: dynCheckpoints
    };
  }

  return { success: false, message: 'Unknown Scan Type' };
}


/**
 * Public function to register a guard from the app frontend.
 */
function registerGuard(profile) {
  try {
    ensureGuardExists(profile);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * Ensures a guard exists in the Guards sheet.
 * Deduplicates based on Employee ID (empId).
 */
function ensureGuardExists(profile) {
  if (!profile || !profile.empId) return;

  const guards = getTableData('Guards');
  // Use empId for unique identification
  const existingGuard = guards.find(g => String(g.empId) === String(profile.empId));

  if (!existingGuard) {
    console.log("Auto-registering new guard: " + profile.empId);
    appendRecord('Guards', {
      name: profile.name || '',
      surname: profile.surname || '',
      empId: profile.empId || '',
      phone: profile.phone || '',
      status: 'active',
      createdAt: new Date().toISOString()
    });
  }
}

function determineShift(date) {
  const hour = date.getHours();
  if (hour >= 6 && hour < 14) return 1;
  if (hour >= 14 && hour < 22) return 2;
  return 3;
}

function getGuardList() {
  const guards = getTableData('Guards');
  if (guards.length > 0) {
    return guards.map(g => ({
      id: g.id,
      name: g.name,
      surname: g.surname || '',
      empId: g.empId || ''
    }));
  }
  return [];
}
function submitCheckoutReport(reportData) {
  try {
    // Resolve Canonical Site ID
    const sites = getTableData('Sites');
    const canonicalSiteId = resolveSiteId(reportData.locationId, sites);

    // Map to QC Dashboard Scans columns
    const record = {
      guardId: reportData.guardId,
      checkpointId: '',
      siteId: canonicalSiteId, // Normalized
      lat: reportData.lat || '',
      lng: reportData.lng || '',
      accuracy: reportData.accuracy || '',
      status: 'CHECKOUT',
      assessment: '',
      note: reportData.notes || '',
      photo: reportData.photoBase64 || '', // Store base64 like patrol scans do
      roundNumber: '',
      pointInRound: '',
      round: (reportData.completedRounds || '') + '/' + (reportData.totalRounds || '')
    };

    appendRecord('Scans', record);
    return { success: true };
  } catch (e) {
    console.error("submitCheckoutReport error:", e);
    return { success: false, message: e.toString() };
  }
}

/**
 * Resolves Site Name from a given location/site code
 * Used for frontend display during check-in
 */
function resolveSiteName(code) {
    if (!code) return '';
    try {
        const sites = getTableData('Sites');
        const canonicalCode = resolveSiteId(code, sites);
        const site = sites.find(s => s.code === canonicalCode);
        return site ? (site.nameEN || site.name) : code;
    } catch (e) {
        return code;
    }
}

/**
 * TEST TOOLS FOR MULTI-GUARD SIMULATION
 */

function test_registerGuards() {
  const testGuards = [
    { name: 'Test Guard 1', surname: 'Beta', empId: 'TEST001', phone: '2011111111' },
    { name: 'Test Guard 2', surname: 'Gamma', empId: 'TEST002', phone: '2022222222' }
  ];

  testGuards.forEach(g => ensureGuardExists(g));
  return { success: true, message: 'Test Guards Registered' };
}

function test_performCheckin(guardId, siteId) {
  // Simulate a checkin scan
  // Format: VKS|SiteCode
  const qrContent = `VKS|${siteId}`;
  return processScan(qrContent, guardId, null, 'CHECKIN', {
    lat: 17.9, lng: 102.6, accuracy: 10
  });
}

function test_performPatrol(guardId, siteId, pointNum) {
  // Simulate a patrol scan
  // Format: VKS|SiteCode|PointNum
  const qrContent = `VKS|${siteId}|${pointNum}`;
  // Meta must match what processScan expects
  const meta = {
    lat: 17.9,
    lng: 102.6,
    accuracy: 10,
    assessment: 'Safe',
    note: 'Test Patrol Scan',
    photo: '',
    roundNumber: 1, // Simplified
    pointInRound: pointNum
  };

  return processScan(qrContent, guardId, siteId, 'PATROL', meta);
}
