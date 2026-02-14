/**
 * Patrol.gs - Patrol Status and Guard Activity backend
 * 
 * Functions for live patrol tracking and checkpoint scans.
 */

/**
 * Get current patrol status for all active sites
 * Shows live tracking of guards and their progress
 */
/**
 * Get current patrol status for all active sites
 * Shows live tracking of guards and their progress
 */
function getPatrolStatus() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const sitesSheet = ss.getSheetByName(SHEET_SITES);
    const shiftsSheet = ss.getSheetByName(SHEET_SHIFTS);
    const guardsSheet = ss.getSheetByName(SHEET_GUARDS);
    const checkpointsSheet = ss.getSheetByName(SHEET_CHECKPOINTS);

    // Read Scans from QC Sheet (Guard App now writes here)
    const scansSheet = ss.getSheetByName(SHEET_SCANS);

    // Get today's date for filtering
    const today = new Date();
    const todayStr = Utilities.formatDate(today, 'Asia/Vientiane', 'yyyy-MM-dd');



    // 0. Get Settings for Patrol Config
    const settings = getSettings();
    const POINTS_PER_ROUND = parseInt(settings.pointsPerRound) || 4;
    const TOTAL_ROUNDS = parseInt(settings.patrolRounds) || 7;

    // 1. Load Active Sites AND create multi-key lookup
    const sitesData = sitesSheet.getDataRange().getValues();
    const sitesHeaders = sitesData[0];
    const siteIdIdx = getCIIndex(sitesHeaders, ['id']);
    const siteCodeIdx = getCIIndex(sitesHeaders, ['code', 'site code', 'site_code', 'sitecode']);
    const siteNameENIdx = getCIIndex(sitesHeaders, ['nameEN']);
    const siteStatusIdx = getCIIndex(sitesHeaders, ['status']);
    const siteTypeIdx = getCIIndex(sitesHeaders, ['type']);

    const sites = sitesData.slice(1)
      .map(row => {
        const site = {};
        sitesHeaders.forEach((h, i) => site[h] = row[i]);
        // ENSURE LOWERCASE NORMALIZED KEYS
        site.id = String(row[siteIdIdx] || '').trim();
        site.code = String(row[siteCodeIdx] || '').trim();
        site.nameEN = row[siteNameENIdx];
        site.type = row[siteTypeIdx];
        site.status = String(row[siteStatusIdx] || '').trim().toLowerCase(); // Normalize Status
        return site;
      });

    // Create a lookup that maps MULTIPLE keys to canonical site.id
    // Keys include: id, code, and any VKS-pattern found in nameEN
    const siteKeyToId = {};
    sites.forEach(site => {
      // Primary: site.id (normalize to Upper)
      siteKeyToId[String(site.id).toUpperCase()] = site.id;
      // Secondary: site.code
      if (site.code) siteKeyToId[String(site.code).toUpperCase()] = site.id;
      // Tertiary: Extract VKS-pattern from nameEN
      const nameEN = String(site.nameEN || '');
      const vksMatch = nameEN.match(/VKS(-\w+)?-\d+/i) || nameEN.match(/VKS\d+-\d+/i);
      if (vksMatch) siteKeyToId[vksMatch[0].toUpperCase()] = site.id;
    });

    // Helper to normalize any siteId from scans to canonical site.id
    const normalizeSiteId = (scanSiteId) => {
      if (!scanSiteId) return '';
      const key = String(scanSiteId).trim().toUpperCase();
      return siteKeyToId[key] || scanSiteId;
    };

    // Helper to robustly parse scan date
    const parseScanDate = (val) => {
      if (!val) return null;
      if (val instanceof Date) return Utilities.formatDate(val, 'Asia/Vientiane', 'yyyy-MM-dd');

      // Handle string formats like "1/20/2026 11:32:30" or "2026-01-20T..."
      try {
        const dateOnly = String(val).split(' ')[0].split('T')[0];
        if (dateOnly.includes('/')) {
          // Handle M/D/YYYY or D/M/YYYY (best effort)
          const parts = dateOnly.split('/');
          if (parts[2].length === 4) {
            const month = parts[0].padStart(2, '0');
            const day = parts[1].padStart(2, '0');
            return `${parts[2]}-${month}-${day}`;
          }
        }
        return dateOnly;
      } catch (e) { return null; }
    };

    // Filter for Display: Only specific statuses (e.g., 'active')
    const activeSites = sites.filter(s => s.status === 'active');

    // 2. Load Guards Lookup
    const guardsData = guardsSheet.getDataRange().getValues();
    const guardsHeaders = guardsData[0];
    const gNameIdx = getCIIndex(guardsHeaders, ['name']);
    const gEmpIdIdx = getCIIndex(guardsHeaders, ['empId']);
    const gPhoneIdx = getCIIndex(guardsHeaders, ['phone', 'contact', 'mobile']);
    const guards = {};
    guardsData.slice(1).forEach(row => {
      const gId = String(row[0] || '').trim();
      const guardInfo = {
        id: gId,
        name: row[gNameIdx],
        empId: String(row[gEmpIdIdx] || '').trim(),
        phone: String(row[gPhoneIdx] || '').trim()
      };
      guards[gId] = guardInfo;
      if (guardInfo.empId) guards[guardInfo.empId] = guardInfo;
    });

    // 3. Load Checkpoint counts per site
    const cpData = checkpointsSheet.getDataRange().getValues();
    const checkpointCounts = {};
    cpData.slice(1).forEach(row => {
      const rawCid = String(row[1] || '').trim();
      const sId = normalizeSiteId(rawCid);
      checkpointCounts[sId] = (checkpointCounts[sId] || 0) + 1;
    });

    // 4. Load Today's Scans
    const scansData = scansSheet.getDataRange().getValues();
    const scansHeaders = scansData[0];
    const tsIdx = getCIIndex(scansHeaders, ['timestamp']);
    const siteIdScanIdx = getCIIndex(scansHeaders, ['siteId']);
    const guardIdScanIdx = getCIIndex(scansHeaders, ['guardId']);
    const statusScanIdx = getCIIndex(scansHeaders, ['status']);

    const siteGuardActivity = {};

    scansData.slice(1).forEach(row => {
      const tsValue = row[tsIdx];
      const scanDate = parseScanDate(tsValue);
      if (scanDate !== todayStr) return;

      const scanSiteIdRaw = String(row[siteIdScanIdx] || '').trim();
      const scanSiteId = normalizeSiteId(scanSiteIdRaw);
      const guardId = String(row[guardIdScanIdx] || '').trim();
      const status = String(row[statusScanIdx] || '').toUpperCase().trim();

      if (!scanSiteId || !guardId) return;

      // Init bucket for this site and guard
      if (!siteGuardActivity[scanSiteId]) siteGuardActivity[scanSiteId] = {};
      if (!siteGuardActivity[scanSiteId][guardId]) {
        siteGuardActivity[scanSiteId][guardId] = {
          guardId: guardId,
          scannedCount: 0,
          uniqueCheckpoints: new Set(),
          lastScan: null,
          checkin: null,
          shiftType: 'Ad-hoc',
          startTime: '00:00',
          endTime: 'Finish'
        };
      }
      const entry = siteGuardActivity[scanSiteId][guardId];

      if (status === 'PATROL') {
        entry.scannedCount++;
        // Also track unique if needed, but for now we follow scannedCount logic
        if (!entry.lastScan || tsValue > entry.lastScan) {
          entry.lastScan = tsValue;
        }
      }

      if (status === 'CHECKIN') {
        entry.checkin = tsValue;
        // Determine shift logic (simplified for multi-guard)
        const h = new Date(tsValue).getHours();
        if (h >= 6 && h < 14) { entry.shiftType = 'Morning'; entry.startTime = '06:00'; entry.endTime = '14:00'; }
        else if (h >= 14 && h < 22) { entry.shiftType = 'Evening'; entry.startTime = '14:00'; entry.endTime = '22:00'; }
        else { entry.shiftType = 'Night'; entry.startTime = '22:00'; entry.endTime = '06:00'; }
      }
    });

    // Generate Results
    const results = [];
    activeSites.forEach(site => {
      const activities = siteGuardActivity[site.id];
      const totalCheckpoints = checkpointCounts[site.id] || 0;

      if (!activities || Object.keys(activities).length === 0) {
        // No guards online -> One Offline Row
        // Use site-specific targets if available, otherwise fallback to global settings
        const siteCheckpointTarget = parseInt(site.checkpointTarget) || POINTS_PER_ROUND;
        const siteRoundsTarget = parseInt(site.roundsTarget) || TOTAL_ROUNDS;

        results.push({
          siteId: String(site.id),
          siteName: String(site.nameEN || ''),
          siteCode: String(site.code || ''),
          siteType: String(site.type || ''),
          guardId: null, guardName: null, guardPhone: null,
          shiftType: null, shiftDisplay: null,
          scannedCheckpoints: 0, totalCheckpoints: Number(totalCheckpoints),
          currentRound: 0, totalRounds: Number(siteRoundsTarget),
          roundProgress: '0/' + siteCheckpointTarget,
          checkinTime: null, lastScan: null,
          status: 'offline',
          _version: 'v2.0-MULTI'
        });
      } else {
        // One row per active guard
        Object.values(activities).forEach(act => {
          let status = 'active';

          // Use site-specific targets if available
          const siteCheckpointTarget = parseInt(site.checkpointTarget) || POINTS_PER_ROUND;
          const siteRoundsTarget = parseInt(site.roundsTarget) || TOTAL_ROUNDS;

          const progress = totalCheckpoints > 0 ? act.scannedCount / totalCheckpoints : 0;

          if (progress >= 1) { // Logic check: Is it total checkpoints or total ROUNDS?
            // Assuming totalCheckpoints is checkpoints PER ROUND (from sheet count)
            status = 'active';
          }

          // Check constraints
          if (act.lastScan) {
            const timeSinceLastScan = (Date.now() - new Date(act.lastScan).getTime()) / 60000;
            if (timeSinceLastScan > 60) status = 'late';
          }

          // Calculate Rounds
          const completedRounds = Math.floor(act.scannedCount / siteCheckpointTarget);
          const pointsInCurrentRound = act.scannedCount % siteCheckpointTarget;

          // Status overrides
          if (completedRounds >= siteRoundsTarget) status = 'complete';

          results.push({
            siteId: String(site.id),
            siteName: String(site.nameEN || ''),
            siteCode: String(site.code || ''),
            siteType: String(site.type || ''),
            guardId: String(act.guardId),
            guardName: guards[act.guardId] ? String(guards[act.guardId].name) : `Unknown (${act.guardId})`,
            guardEmpId: guards[act.guardId] ? String(guards[act.guardId].empId) : null,
            guardPhone: guards[act.guardId] ? String(guards[act.guardId].phone) : null,
            shiftType: String(act.shiftType),
            shiftDisplay: `${act.startTime} - ${act.endTime}`,
            scannedCheckpoints: Number(act.scannedCount),
            totalCheckpoints: Number(totalCheckpoints),
            currentRound: Number(completedRounds),
            totalRounds: Number(siteRoundsTarget),
            roundProgress: `${pointsInCurrentRound}/${siteCheckpointTarget}`,
            checkinTime: act.checkin ? Utilities.formatDate(new Date(act.checkin), 'Asia/Vientiane', 'HH:mm') : null,
            lastScan: act.lastScan ? Utilities.formatDate(new Date(act.lastScan), 'Asia/Vientiane', 'HH:mm') : 'Waiting',
            status: status,
            _version: 'v2.0-MULTI'
          });
        });
      }
    });

    // Sort: late first (0), then active (1), then complete (2), then offline (3)
    // Within status, sort by Site Name
    const statusOrder = { late: 0, active: 1, complete: 2, offline: 3 };
    results.sort((a, b) => {
      const sA = statusOrder[a.status];
      const sB = statusOrder[b.status];
      if (sA !== sB) return sA - sB;
      return a.siteName.localeCompare(b.siteName);
    });

    return results;
  } catch (e) {
    Logger.log('Error in getPatrolStatus: ' + e.message + '\n' + e.stack);
    throw e;
  }
}

/**
 * Get guard activity timeline for a specific date
 */


/**
 * Get timeline view for a guard
 */
function getGuardTimeline(guardId, date) {
  return getGuardActivity({ guardId: guardId, date: date });
}

/**
 * Get scan details
 */
function getScanDetails(scanId) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const sheet = ss.getSheetByName(SHEET_SCANS);

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const row = data.slice(1).find(r => r[0] === scanId);

    if (!row) throw new Error('Scan not found');

    const scan = {};
    headers.forEach((h, i) => scan[h] = row[i]);

    return scan;
  } catch (e) {
    Logger.log('Error in getScanDetails: ' + e.message);
    throw e;
  }
}

/**
 * Helper: Get time ago string
 */
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return diffMins + 'm ago';

  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return diffHrs + 'h ago';

  const diffDays = Math.floor(diffHrs / 24);
  return diffDays + 'd ago';
}

/**
 * SIGNALING: Real-time update check
 */

/**
 * Get the latest signal timestamps for scans, inspections, handovers, and incidents
 * Uses Developer Metadata for cross-app communication
 */
function getUpdateSignals() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const meta = ss.getDeveloperMetadata();

    // Helper to extract numeric signal value
    const getVal = (key) => {
      const match = meta.filter(m => m.getKey() === key).pop();
      return match ? (parseInt(match.getValue()) || 0) : 0;
    };

    return {
      lastScan: getVal('LAST_SCAN_SIGNAL'),
      lastMaster: getVal('LAST_MASTER_SIGNAL'),
      lastSite: getVal('LAST_SITE_SIGNAL'),
      lastGuard: getVal('LAST_GUARD_SIGNAL')
    };
  } catch (e) {
    Logger.log('Signal Fetch Error: ' + e.message);
    return { lastScan: 0, lastMaster: 0, lastSite: 0, lastGuard: 0 };
  }
}

/**
 * Trigger a refresh signal for frontend listeners
 * @param {string} type - 'scan', 'sites', 'guards'
 */
function setUpdateSignal(type) {
  try {
    const keyMap = {
      'scan': 'LAST_SCAN_SIGNAL',
      'sites': 'LAST_SITE_SIGNAL',
      'guards': 'LAST_GUARD_SIGNAL'
    };
    const key = keyMap[type] || 'LAST_MASTER_SIGNAL';

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const now = Date.now().toString();

    ss.addDeveloperMetadata(key, now, SpreadsheetApp.DeveloperMetadataVisibility.DOCUMENT);

    // Cleanup old signals
    const allMeta = ss.getDeveloperMetadata().filter(function (m) {
      return m.getKey() === key;
    });
    if (allMeta.length > 5) {
      allMeta.slice(0, allMeta.length - 1).forEach(function (m) {
        m.remove();
      });
    }

    return true;
  } catch (e) {
    Logger.log('Signal Set Error: ' + e.message);
    return false;
  }
}
