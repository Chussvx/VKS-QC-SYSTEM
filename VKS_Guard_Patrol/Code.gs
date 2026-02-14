// Code.gs
// ===========================================
// CONFIGURATION - Direct Write to QC Sheet
// ===========================================
const QC_SHEET_ID = '1jVeiXS7wl8-eA1DSgiMOsgElZCL0ILGMficC1mrZFyI';

// Tab names in QC Sheet
const TAB_INSPECTION_LOGS = 'InspectionLogs';
const TAB_HANDOVER_RECORDS = 'HandoverRecords';
const TAB_SPECIAL_ACTIVITY = 'SpecialActivityLogs';
const TAB_INSPECTORS = 'Inspectors';
const TAB_SITES = 'Sites';  // For Route A/B locations

// Legacy tab names (Patrol Sheet - for reference only)
// const TAB_LOGS = 'Logs';
// const TAB_SITE_COMMENTS = 'Site_Comments';
// const TAB_SPECIAL = 'SpecialActivity_Logs';

function doGet() {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Patrol Daily Check')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  try {
    return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
  } catch (e) {
    console.error("Include failed for: " + filename, e);
    return "<!-- Include failed for: " + filename + " -->";
  }
}

// --- API: Get Site Comments for Handover Popup ---
// Returns latest comment for each site (within 48 hours)
// NOW READS FROM QC Sheet HandoverRecords tab
function getSiteComments() {
  try {
    const ss = SpreadsheetApp.openById(QC_SHEET_ID);
    let commentSheet = ss.getSheetByName(TAB_HANDOVER_RECORDS);
    
    // Return empty if sheet doesn't exist
    if (!commentSheet) {
      console.log("HandoverRecords sheet not found in QC Sheet");
      return {};
    }
    
    // OPTIMIZED: Scan only last 500 rows (Tail Read)
    const lastRow = commentSheet.getLastRow();
    
    // If we have less than 2 rows (header + 1), return empty
    if (lastRow < 2) return {}; 

    // Calculate start row: Max of 2 (skip header) or (lastRow - 500)
    const startRow = Math.max(2, lastRow - 500); 
    const numRows = (lastRow - startRow) + 1;
    
    // Read columns: id, timestamp, siteName, guardName, comment (cols 1-5)
    // New schema: [id, timestamp, siteName, guardName, comment, syncedAt]
    const data = commentSheet.getRange(startRow, 1, numRows, 5).getValues();
    
    const comments = {};
    const now = new Date().getTime();
    const maxAge = 48 * 60 * 60 * 1000; // 48 hours in ms
    
    // Scan from bottom (newest) to top
    for (let i = data.length - 1; i >= 0; i--) {
      // Column mapping: 0=id, 1=timestamp, 2=siteName, 3=guardName, 4=comment
      const siteName = data[i][2];
      if (!siteName || comments[siteName]) continue; // Skip empty or already have newer
      
      // Safety check for valid date
      let timestamp;
      if (data[i][1] instanceof Date) {
        timestamp = data[i][1];
      } else {
         timestamp = new Date(data[i][1]);
      }
      
      const age = now - timestamp.getTime();
      
      if (age <= maxAge) {
        comments[siteName] = {
          timestamp: timestamp.toISOString(),
          guard: data[i][3] || "Unknown",
          comment: data[i][4] || ""
        };
      }
    }
    
    console.log("Fetched comments from QC HandoverRecords for " + Object.keys(comments).length + " sites");
    return comments;
  } catch (e) {
    console.error("Failed to fetch site comments from QC Sheet", e);
    return {};
  }
}

// --- API: Save Handover Comment ---
// NOW WRITES TO QC Sheet HandoverRecords tab
function saveSiteComment(siteName, guardName, comment, customTime) {
  try {
    if (!siteName || !comment || comment.trim() === "") return { success: false };
    
    const lock = LockService.getScriptLock();
    try {
        lock.waitLock(10000); // 10s wait for comment lock
    } catch(e) {
        console.warn("Could not get lock for comment save, proceeding anyway");
    }

    const ss = SpreadsheetApp.openById(QC_SHEET_ID);
    let commentSheet = ss.getSheetByName(TAB_HANDOVER_RECORDS);
    if (!commentSheet) {
      commentSheet = ss.insertSheet(TAB_HANDOVER_RECORDS);
      commentSheet.appendRow(['id', 'timestamp', 'siteName', 'guardName', 'comment', 'syncedAt']);
    }
    
    const timestamp = customTime ? new Date(customTime) : new Date();
    const id = 'HND-' + Utilities.getUuid().substring(0, 8).toUpperCase();
    
    // New schema: [id, timestamp, siteName, guardName, comment, syncedAt]
    commentSheet.appendRow([id, timestamp, siteName, guardName, comment, null]);
    SpreadsheetApp.flush();
    lock.releaseLock();
    
    console.log("Saved handover comment to QC HandoverRecords: " + id);
    return { success: true, id: id };
  } catch (e) {
    console.error("Failed to save site comment to QC Sheet", e);
    return { success: false, error: e.toString() };
  }
}

// --- API: Get Dropdown Data (WITH 2-MINUTE CACHING) ---
// NOW: Routes from QC Sheet Sites tab (with status filtering), Patrol Names from QC Inspectors
function getFormConfig() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'vks_patrol_config_v5'; // v5: Production with QC integration
  const cached = cache.get(cacheKey);
  
  // Return cached data if available (2-minute cache)
  if (cached) {
    try {
      const data = JSON.parse(cached);
      console.log("Serving config from CACHE (v5 - QC Production)");
      data.isCached = true;
      return data;
    } catch (e) {
      console.error("Cache parse error", e);
      cache.remove(cacheKey);
    }
  }
  
  console.log("=== getFormConfig - Reading FRESH data from QC Sheet ===");

  // 1. Read Sites from QC Sheet (NEW: Unified Data Source)
  let routeA = [];
  let routeB = [];
  let sitesSource = 'QC_Sites';
  let debugInfo = { step: 'init' };
  
  try {
    const qcSS = SpreadsheetApp.openById(QC_SHEET_ID);
    debugInfo.step = 'opened_qc_sheet';
    
    const siteSheet = qcSS.getSheetByName(TAB_SITES);
    debugInfo.step = 'got_sites_tab';
    debugInfo.tabExists = !!siteSheet;
    
    if (siteSheet && siteSheet.getLastRow() > 1) {
      const lastRow = siteSheet.getLastRow();
      debugInfo.rowCount = lastRow;
      
      // Read headers and normalize to lowercase for matching
      const rawHeaders = siteSheet.getRange(1, 1, 1, siteSheet.getLastColumn()).getValues()[0];
      const headers = rawHeaders.map(h => String(h).toLowerCase().trim());
      debugInfo.headers = headers.join(', ');
      
      // Case-insensitive header lookup
      const nameIdx = headers.indexOf('nameen');
      const routeIdx = headers.indexOf('route');
      const statusIdx = headers.indexOf('status');
      
      debugInfo.columnMapping = { nameEN: nameIdx, route: routeIdx, status: statusIdx };
      console.log("QC Sites - Column Mapping: nameEN=" + nameIdx + ", route=" + routeIdx + ", status=" + statusIdx);
      console.log("QC Sites - Headers found: " + headers.join(', '));
      
      if (nameIdx > -1 && routeIdx > -1) {
        debugInfo.step = 'reading_data';
        const data = siteSheet.getRange(2, 1, lastRow - 1, rawHeaders.length).getValues();
        
        let activeCount = 0;
        let inactiveCount = 0;
        
        for (let i = 0; i < data.length; i++) {
          const name = String(data[i][nameIdx] || '').trim();
          const route = String(data[i][routeIdx] || '').trim().toUpperCase();
          let status = statusIdx > -1 ? String(data[i][statusIdx] || 'active').trim().toLowerCase() : 'active';
          if (!status) status = 'active'; // Default to active if empty
          
          // Skip inactive sites
          if (status !== 'active') {
            inactiveCount++;
            continue;
          }
          if (!name) continue;
          
          activeCount++;
          
          // Categorize by route (flexible matching)
          const routeUpper = route.toUpperCase();
          if (routeUpper === 'A' || routeUpper.includes('ROUTE A') || routeUpper === 'ROUTE_A') {
            routeA.push(name);
          } else if (routeUpper === 'B' || routeUpper.includes('ROUTE B') || routeUpper === 'ROUTE_B') {
            routeB.push(name);
          } else {
            // If no route specified or unknown, add to BOTH routes
            routeA.push(name);
            routeB.push(name);
          }
        }
        
        debugInfo.step = 'success';
        debugInfo.activeCount = activeCount;
        debugInfo.inactiveCount = inactiveCount;
        console.log("QC Sites loaded: Route A=" + routeA.length + ", Route B=" + routeB.length + " (Active: " + activeCount + ", Skipped Inactive: " + inactiveCount + ")");
      } else {
        debugInfo.step = 'missing_columns';
        throw new Error("Required columns not found: nameEN=" + nameIdx + ", route=" + routeIdx);
      }
    } else {
      debugInfo.step = 'empty_or_missing_tab';
      throw new Error("Sites tab empty or not found");
    }
  } catch (e) {
    console.error("Failed to read sites from QC Sheet: " + e.message, e);
    debugInfo.error = e.message;
    debugInfo.step = 'fallback';
    sitesSource = 'Patrol_Fallback';
    
    // FALLBACK: Read from container-bound Patrol Sheet
    const patrolSS = SpreadsheetApp.getActiveSpreadsheet();
    let siteSheet = patrolSS.getSheetByName('Sites') 
      || patrolSS.getSheetByName('Route A') 
      || patrolSS.getSheetByName('Location list');
    
    if (siteSheet) {
      const lastRow = siteSheet.getLastRow();
      const range = lastRow > 1 ? siteSheet.getRange(2, 1, lastRow - 1, 2).getValues() : [];
      routeA = range.map(r => r[0]).filter(String);
      routeB = range.map(r => r[1]).filter(String);
      console.log("Fallback - Patrol Sites loaded: Route A=" + routeA.length + ", Route B=" + routeB.length);
    }
  }
  
  console.log("Route A count: " + routeA.length);
  console.log("Route B count: " + routeB.length);

  // 2. Read Patrol Names (Inspectors) from QC Sheet Inspectors tab
  let patrolNames = [];
  try {
    const qcSS = SpreadsheetApp.openById(QC_SHEET_ID);
    const inspectorSheet = qcSS.getSheetByName(TAB_INSPECTORS);
    
    if (inspectorSheet) {
      const inspectorLastRow = inspectorSheet.getLastRow();
      if (inspectorLastRow > 1) {
        // Schema: [id, name, status] - read cols 2 and 3
        const inspectorData = inspectorSheet.getRange(2, 2, inspectorLastRow - 1, 2).getValues();
        // Only include active inspectors
        patrolNames = inspectorData
          .filter(row => row[1] !== 'inactive')
          .map(row => row[0])
          .filter(String);
      }
    }
    console.log("Patrol Names (Inspectors) from QC: " + patrolNames.length);
  } catch (e) {
    console.error("Failed to read inspectors from QC Sheet", e);
    // No fallback - inspectors must come from QC
  }

  // Get current site comments for handover popups (Don't cache this as it needs to be live)
  const currentComments = getSiteComments();

  const config = {
    routeA: routeA,
    routeB: routeB,
    patrolNames: patrolNames,
    currentComments: currentComments,
    sitesSource: sitesSource,
    inspectorsSource: 'QC_Inspectors',
    debugInfo: debugInfo
  };
  
  // Cache for 2 minutes (120 seconds) for production
  try {
    cache.put(cacheKey, JSON.stringify(config), 120);
    console.log("Config cached for 2 minutes");
  } catch(e) {
    console.warn("Cache put failed (probably too large)", e);
  }

  return config;
}

// --- API: Individual Photo Upload ---
function uploadPatrolPhoto(photoData, photoMime, fileName) {
  try {
    const FOLDER_ID = '1WMmdSqDeUP3GmDVJ1pxAr-_3Sj05tfl9';
    const folder = DriveApp.getFolderById(FOLDER_ID);
    
    const blob = Utilities.newBlob(Utilities.base64Decode(photoData), photoMime, fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return { success: true, url: file.getUrl() };
  } catch (e) {
    console.error("Photo upload failed:", e);
    return { success: false, error: e.toString() };
  }
}

// --- API: Submit Report ---
// NOW WRITES TO QC Sheet InspectionLogs tab
function processForm(formData) {
  try {
    const FOLDER_ID = '1WMmdSqDeUP3GmDVJ1pxAr-_3Sj05tfl9'; // Specific Folder ID
    const ss = SpreadsheetApp.openById(QC_SHEET_ID);
    const logSheet = ss.getSheetByName(TAB_INSPECTION_LOGS);
    
    if (!logSheet) {
      return { success: false, error: "Sheet 'InspectionLogs' not found in QC Sheet." };
    }
    
    // Log incoming data for debugging
    console.log("Processing Form Data:", JSON.stringify(formData));
    
    // 0. SECURITY: Rate Limiting (Spam Protection) - IMPROVED
    const lock = LockService.getScriptLock();
    // specific user key if logged in, or generic fingerprint if anonymous
    const userKey = Session.getTemporaryActiveUserKey() || "anonymous"; 
    // Bind limit to USER + PATROL NAME to prevent anonymous blocking
    const rateKey = "rate_limit_" + userKey + "_" + (formData.patrolName || "unknown").replace(/\s+/g, '');
    
    const cache = CacheService.getScriptCache();
    if (cache.get(rateKey)) {
      return { success: false, error: "ໄວເກີນໄປ! ກະລຸນາລໍຖ້າ 5 ວິນາທີ ກ່ອນສົ່ງລາຍງານຖັດໄປ." };
    }
    // Set 5s cooldown (Reduced from 10s)
    cache.put(rateKey, "true", 5);

    // 0. SECURITY: Server-Side Validation (Anti-Tamper)
    // Ensure siteName actually exists in our database
    const config = getFormConfig(); // Uses cache, so it's fast
    const validSites = [...(config.routeA || []), ...(config.routeB || [])];
    
    // Normalize logic: trim and loose compare
    const submittedSite = (formData.siteName || "").trim();
    if (!submittedSite || !validSites.includes(submittedSite)) {
       console.error("Security Alert: Invalid Site Name submitted: " + submittedSite);
       return { success: false, error: "ຊື່ສະຖານທີ່ບໍ່ຖືກຕ້ອງ ຫຼຶ ບໍ່ມີໃນລະບົບ (Security Check Failed)" };
    }

    // Defensive check for missing fields
    formData.startTimeManual = formData.startTimeManual || "00:00";
    formData.finishTime = formData.finishTime || "00:00";
    formData.equip_flashlight = formData.equip_flashlight || "No";
    formData.equip_uniform = formData.equip_uniform || "No";
    formData.equip_defense = formData.equip_defense || "No";
    formData.logbookStatus = formData.logbookStatus || "No";
    formData.check_gates = formData.check_gates || "No";
    formData.check_lights = formData.check_lights || "No";
    formData.check_fire = formData.check_fire || "No";
    
    // 1. Handle Duration Calculation (Using dual manual inputs)
    const startTimeSys = new Date(parseInt(formData.startTime));
    const now = new Date();
    
    let durationMins = 0;
    if (formData.startTimeManual && formData.finishTime) {
      const parseTime = (t) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };
      
      const startTotal = parseTime(formData.startTimeManual);
      const finishTotal = parseTime(formData.finishTime);
      let diff = finishTotal - startTotal;
      if (diff < 0) diff += 1440; // Midnight cross
      durationMins = diff;
    }
    
    // 2. Handle Photo URLs
    let photoUrlString = "No Photo";
    if (formData.photoUrls && formData.photoUrls.length > 0) {
      photoUrlString = formData.photoUrls.join("\n");
    }

    // 3. Prepare Row Data (21-column layout)
    const rowData = [
      now,                        // A: Timestamp
      formData.patrolName,        // B: Patrol Name
      formData.route,             // C: Route
      formData.siteName,          // D: Site
      formData.guardName,         // E: Target Guard Name
      formData.shift + " (" + formData.empType + ")", // F: Shift
      formData.startTimeManual,   // G: Start Time (Manual)
      formData.finishTime,        // H: Finish Time (Manual)
      durationMins + " min",      // I: Duration
      // J: Score - Average of Communication + Uniform ratings
      ((parseFloat(formData.ratingCommunication) || 3) + (parseFloat(formData.ratingUniform) || 3)) / 2,
      formData.siteStatus,        // K: Status (Normal/Issue)
      // Equipment Checks (L-N) - ✓ = has item, — = not verified
      formData.equip_flashlight,  // L: Flashlight
      formData.equip_uniform,     // M: Uniform
      formData.equip_defense,     // N: Defense Tools
      formData.logbookStatus,     // O: Logbook
      // Perimeter Checks (P-R) - ✓ = OK, — = not verified
      formData.check_gates,       // P: Gates/Doors
      formData.check_lights,      // Q: Lights
      formData.check_fire,        // R: Fire Safety
      formData.gpsLocation,       // S: GPS Link
      photoUrlString,             // T: Photo URLs
      // U: Notes/Details - Include ratings for Dashboard V2 parsing
      (formData.ratingCommunication && formData.ratingUniform 
        ? "[Ratings | Comm: " + formData.ratingCommunication + "/5, Unif: " + formData.ratingUniform + "/5] " 
        : "") + (formData.notes || ""),
      formData.issues,            // V: Issues Found (comma-separated or "ບໍ່ມີບັນຫາ")
      formData.handoverComment || "" // W: Handover Comment (Archived historically)
    ];

    try {
        lock.waitLock(30000); // Wait for lock
        logSheet.appendRow(rowData);
        SpreadsheetApp.flush(); // Force write
        lock.releaseLock();
    } catch (e) {
        return { success: false, error: "System Busy. Please try again." };
    }
    
    // 4. Save Handover Comment (for next patrol guard to see)
    if (formData.handoverComment && formData.handoverComment.trim() !== "") {
      saveSiteComment(formData.siteName, formData.patrolName, formData.handoverComment, now);
    }
    
    return { success: true };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// --- API: Admin Dashboard Data ---
function getDashboardData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ss.getSheetByName('Logs');
    
    if (!logSheet) return []; // Return empty if no logs sheet
    
    const data = logSheet.getDataRange().getValues();
    if (data.length <= 1) return []; // Only headers or empty
    
    // Remove headers
    data.shift(); 
    // Return last 20 rows
    return data.reverse().slice(0, 20); 
  } catch (e) {
    console.error("Dashboard data load failed", e);
    return [];
  }
}


// --- API: Submit Special Activity (Stationary/Onboarding) ---
// NOW WRITES TO QC Sheet SpecialActivityLogs tab
function submitSpecialActivity(data) {
  try {
    const ss = SpreadsheetApp.openById(QC_SHEET_ID);
    let sheet = ss.getSheetByName(TAB_SPECIAL_ACTIVITY);
    
    // Auto-create sheet if missing
    if (!sheet) {
      try {
          sheet = ss.insertSheet(TAB_SPECIAL_ACTIVITY);
          sheet.appendRow([
            "id", "timestamp", "type", "patrolName", "siteName", "targetGuard",
            "startTime", "endTime", "duration", "status", "ratings", "photoUrl", "notes", "syncedAt"
          ]);
      } catch(e) {
          // If insert failed (maybe it exists now?), try fetching again
          sheet = ss.getSheetByName(TAB_SPECIAL_ACTIVITY); 
      }
    }

    // --- CRITICAL SECTION: LOCK & WRITE ---
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000); // Wait up to 30s
    } catch (e) {
      return { success: false, error: "Server busy. Please try again." };
    }

    const id = Utilities.getUuid();
    const timestamp = new Date();
    
    // Parse Start/End Times
    const startTime = data.startTime ? new Date(data.startTime) : timestamp;
    const endTime = data.endTime ? new Date(data.endTime) : timestamp;
    const durationMin = Math.round((endTime - startTime) / 60000); 

    // Prepare Row Data (Photo stored as "Pending..." first)
    const rowData = [
      id,
      timestamp,
      data.type,
      data.patrol,
      data.site,
      data.target,
      startTime.toLocaleTimeString(),
      endTime.toLocaleTimeString(),
      durationMin + " min",
      data.status,
      data.ratings, 
      (data.photo && data.photo.startsWith('data:image')) ? "Pending Upload..." : "No Photo",
      data.notes
    ];
    
    sheet.appendRow(rowData);
    SpreadsheetApp.flush(); // FORCE WRITE TO DISK
    const lastRow = sheet.getLastRow(); // Capture the row index we just wrote
    
    lock.releaseLock(); 
    // --- END CRITICAL SECTION ---

    // --- ASYNC PHOTO UPLOAD (Optimized) ---
    // Perform upload after releasing lock so we don't block other users
    if (data.photo && data.photo.startsWith('data:image')) {
      try {
        const mime = data.photo.split(';')[0].split(':')[1];
        const base64 = data.photo.split(',')[1];
        const fileName = `Special_${data.type}_${id}.jpg`;
        const uploadRes = uploadPatrolPhoto(base64, mime, fileName);
        
        // Update the specific cell (Column L = 12)
        if (uploadRes.success) {
          sheet.getRange(lastRow, 12).setValue(uploadRes.url); 
        } else {
          sheet.getRange(lastRow, 12).setValue("Upload Failed"); 
        }
      } catch(uploadErr) {
        console.error("Post-write upload failed", uploadErr);
        sheet.getRange(lastRow, 12).setValue("Upload Error"); 
      }
    }

    return { success: true, id: id };

  } catch (e) {
    console.error("submitSpecialActivity Failed", e);
    throw e; // Frontend handles failure
  }
}
