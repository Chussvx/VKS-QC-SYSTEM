/**
 * ------------------------------------------------------------------
 * SITE MAP DATA - Aggregated Stats for Site Detail Modal
 * Fetches site coordinates and aggregates performance data 
 * from Inspection Logs per site.
 * ------------------------------------------------------------------
 * Adapted from VKS Patrol Dashboard V2's SiteMap_Data.gs
 */

/**
 * Lightweight: Return only site name + coordinates (no aggregation).
 * Used by Inspector Routes page to avoid the heavy getSiteMapAggregatedData call.
 * @returns {Array} [{name, lat, lng, address}, ...]
 */
function getSiteCoordinates() {
    try {
        var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        var sheet = ss.getSheetByName(SHEET_SITES);
        if (!sheet) return [];

        var data = sheet.getDataRange().getValues();
        if (data.length <= 1) return [];

        var sites = [];
        for (var i = 1; i < data.length; i++) {
            var row = data[i];
            var name = row[SITE_IDX.nameEN] || row[SITE_IDX.nameLO];
            var lat = parseFloat(row[SITE_IDX.lat]);
            var lng = parseFloat(row[SITE_IDX.lng]);

            if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && name) {
                // Only include active sites (skip inactive/decommissioned)
                var siteStatus = (row[SITE_IDX.status] || '').toString().trim().toLowerCase();
                if (siteStatus && siteStatus !== 'active') continue;

                sites.push({
                    name: name,
                    lat: lat,
                    lng: lng,
                    address: row[SITE_IDX.address] || ''
                });
            }
        }
        Logger.log('[getSiteCoordinates] Returning ' + sites.length + ' sites');
        return sites;
    } catch (e) {
        Logger.log('[getSiteCoordinates] Error: ' + e.message);
        return [];
    }
}

// Column Indices for Inspection Logs (matches COLUMNS.inspectionLogs in Config.gs)
var LOG_IDX = {
    timestamp: 0,
    patrolName: 1,
    route: 2,
    siteName: 3,
    guardName: 4,
    shift: 5,
    startTime: 6,
    finishTime: 7,
    duration: 8,
    score: 9,
    status: 10,
    flashlight: 11,
    uniform: 12,
    defenseTools: 13,
    logbook: 14,
    gates: 15,
    lighting: 16,
    fireSafety: 17,
    gps: 18,
    patrolLogs: 19,
    details: 20,
    issues: 21
};

// Column Indices for Sites sheet
var SITE_IDX = {
    id: 0,
    code: 1,
    nameEN: 2,
    nameLO: 3,
    type: 4,
    route: 5,
    address: 6,
    district: 7,
    province: 8,
    lat: 9,
    lng: 10,
    status: 14
};

/**
 * Helper: Check if a value indicates "OK" / passed
 */
function isCheckOK(val) {
    if (!val) return false;
    var v = val.toString().trim().toLowerCase();
    return v === '✓' || v === 'yes' || v === 'ok' || v === 'ດີ' || v === 'ຄົບ' ||
        v.includes('ດີ') || v.includes('ok') || v.includes('yes') || v.includes('ຖືກຕ້ອງ');
}

/**
 * Main function: Get aggregated site data with DETAILED breakdowns
 * @param {number} daysBack - Number of days to look back (default: 30)
 * @returns {Array} - Array of site objects with aggregated stats
 */
function getSiteMapAggregatedData(daysBack) {
    try {
        daysBack = daysBack || 30;

        Logger.log('🔵 [SiteMap] Starting getSiteMapAggregatedData, daysBack: ' + daysBack);

        // 1. Open QC Master spreadsheet
        var ssQC = SpreadsheetApp.openById(SPREADSHEET_ID_QC);

        // 2. Fetch Sites
        var siteSheet = ssQC.getSheetByName(SHEET_SITES);
        var sites = siteSheet ? siteSheet.getDataRange().getValues() : [];
        Logger.log('🔵 [SiteMap] Sites loaded: ' + sites.length + ' rows');

        // 3. Fetch Inspection Logs (local copy)
        var logSheet = ssQC.getSheetByName(SHEET_INSPECTION_LOGS);
        var logs = logSheet ? logSheet.getDataRange().getValues() : [];
        Logger.log('🔵 [SiteMap] InspectionLogs loaded: ' + logs.length + ' rows');

        // 4. Also try external Patrol Logs if local is empty
        if (logs.length <= 1) {
            try {
                var ssPatrol = SpreadsheetApp.openById(SPREADSHEET_ID_PATROL);
                var patrolLogSheet = ssPatrol.getSheetByName(SHEET_PATROL_LOGS);
                logs = patrolLogSheet ? patrolLogSheet.getDataRange().getValues() : [];
                Logger.log('🔵 [SiteMap] External Patrol Logs loaded: ' + logs.length + ' rows');
            } catch (e) {
                Logger.log('⚠️ [SiteMap] Could not access external Patrol logs: ' + e.message);
            }
        }

        // 5. Fetch Handover Comments
        var comments = [];
        try {
            var ssPatrol = SpreadsheetApp.openById(SPREADSHEET_ID_PATROL);
            var commentSheet = ssPatrol.getSheetByName(SHEET_PATROL_COMMENTS);
            comments = commentSheet ? commentSheet.getDataRange().getValues() : [];
        } catch (e) {
            Logger.log('⚠️ [SiteMap] Could not access Site_Comments: ' + e.message);
        }

        // Skip headers
        if (logs.length > 1) logs = logs.slice(1);
        if (sites.length > 1) sites = sites.slice(1);
        if (comments.length > 1) comments = comments.slice(1);

        // Cutoff date
        var cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);

        // 6. Build Sites Map with detailed tracking
        var sitesMap = {};
        var validSiteCount = 0;

        sites.forEach(function (row) {
            var name = row[SITE_IDX.nameEN] || row[SITE_IDX.nameLO];
            var lat = parseFloat(row[SITE_IDX.lat]);
            var lng = parseFloat(row[SITE_IDX.lng]);

            if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && name) {
                // Only include active sites
                var siteStatus = (row[SITE_IDX.status] || '').toString().trim().toLowerCase();
                if (siteStatus && siteStatus !== 'active') return;

                validSiteCount++;
                sitesMap[name] = {
                    id: row[SITE_IDX.id] || row[SITE_IDX.code],
                    name: name,
                    address: row[SITE_IDX.address] || '',
                    lat: lat,
                    lng: lng,
                    status: 'active',
                    statusLabel: 'Active',

                    // Basic Stats
                    stats: {
                        patrols: 0,
                        sleep: 0,
                        issues: 0,
                        avgScore: 0,
                        totalScore: 0,
                        countScore: 0,
                        avgDuration: 0,
                        totalDuration: 0
                    },

                    // Last Visit Info
                    lastVisit: {
                        timestamp: null,
                        timeAgo: 'Never',
                        inspector: 'N/A',
                        score: null
                    },

                    // Guard Equipment Compliance (detailed)
                    equipment: {
                        uniform: { ok: 0, issues: 0, rate: 0 },
                        flashlight: { ok: 0, issues: 0, rate: 0 },
                        defenseTools: { ok: 0, issues: 0, rate: 0 },
                        logbook: { ok: 0, issues: 0, rate: 0 }
                    },

                    // Guard Behavior (detailed)
                    behavior: {
                        sleeping: { total: 0, incidents: 0, rate: 0 },
                        offPosition: { total: 0, incidents: 0, rate: 0 }
                    },

                    // Site Security (detailed)
                    security: {
                        gates: { ok: 0, issues: 0, rate: 0 },
                        lighting: { ok: 0, issues: 0, rate: 0 },
                        fireSafety: { ok: 0, issues: 0, rate: 0 },
                        camera: { ok: 0, issues: 0, rate: 0 }
                    },

                    // Special Activities
                    specialActivities: {
                        onboarding: 0,
                        stationary: 0
                    },

                    // Recent Activity (last 5)
                    recentActivity: [],

                    // Latest Handover Note
                    lastHandover: null,

                    // Overall rates (calculated later)
                    overallEquipmentRate: 0,
                    overallDisciplineRate: 0,
                    overallSecurityRate: 0
                };
            }
        });

        Logger.log('🟡 [SiteMap] Sites processed: ' + validSiteCount + ' valid');

        // 7. Aggregate Inspection Logs
        logs.forEach(function (row, index) {
            try {
                var ts = new Date(row[LOG_IDX.timestamp]);
                var siteName = row[LOG_IDX.siteName];

                if (ts >= cutoffDate && sitesMap[siteName]) {
                    var site = sitesMap[siteName];
                    var s = site.stats;
                    s.patrols++;

                    // Score
                    var score = parseFloat(row[LOG_IDX.score]);
                    if (!isNaN(score)) {
                        s.totalScore += score;
                        s.countScore++;
                    }

                    // Duration
                    var duration = parseFloat(row[LOG_IDX.duration]) || 0;
                    s.totalDuration += duration;

                    // Last Visit
                    if (!site.lastVisit.timestamp || ts > site.lastVisit.timestamp) {
                        site.lastVisit.timestamp = ts;
                        site.lastVisit.inspector = row[LOG_IDX.patrolName] || 'Unknown';
                        site.lastVisit.score = score || null;
                    }

                    // === GUARD EQUIPMENT ===
                    if (row[LOG_IDX.uniform]) {
                        if (isCheckOK(row[LOG_IDX.uniform])) site.equipment.uniform.ok++;
                        else site.equipment.uniform.issues++;
                    }
                    if (row[LOG_IDX.flashlight]) {
                        if (isCheckOK(row[LOG_IDX.flashlight])) site.equipment.flashlight.ok++;
                        else site.equipment.flashlight.issues++;
                    }
                    if (row[LOG_IDX.defenseTools]) {
                        if (isCheckOK(row[LOG_IDX.defenseTools])) site.equipment.defenseTools.ok++;
                        else site.equipment.defenseTools.issues++;
                    }
                    if (row[LOG_IDX.logbook]) {
                        if (isCheckOK(row[LOG_IDX.logbook])) site.equipment.logbook.ok++;
                        else site.equipment.logbook.issues++;
                    }

                    // === GUARD BEHAVIOR ===
                    var issuesStr = (row[LOG_IDX.issues] || '').toString().toLowerCase();
                    site.behavior.sleeping.total++;
                    site.behavior.offPosition.total++;

                    if (issuesStr.includes('ນອນຫຼັບ') || issuesStr.includes('😴') || issuesStr.includes('sleep')) {
                        site.behavior.sleeping.incidents++;
                        s.sleep++;
                    }
                    if (issuesStr.includes('ບໍ່ຢູ່ຈຸດ') || issuesStr.includes('❌') || issuesStr.includes('off position')) {
                        site.behavior.offPosition.incidents++;
                    }

                    // === SITE SECURITY ===
                    if (row[LOG_IDX.gates]) {
                        if (isCheckOK(row[LOG_IDX.gates])) site.security.gates.ok++;
                        else site.security.gates.issues++;
                    }
                    if (row[LOG_IDX.lighting]) {
                        if (isCheckOK(row[LOG_IDX.lighting])) site.security.lighting.ok++;
                        else site.security.lighting.issues++;
                    }
                    if (row[LOG_IDX.fireSafety]) {
                        if (isCheckOK(row[LOG_IDX.fireSafety])) site.security.fireSafety.ok++;
                        else site.security.fireSafety.issues++;
                    }
                    // Camera from issues field
                    if (issuesStr.includes('ກ້ອງ') || issuesStr.includes('camera')) {
                        site.security.camera.issues++;
                    } else {
                        site.security.camera.ok++;
                    }

                    // === ISSUES COUNT ===
                    var statusStr = (row[LOG_IDX.status] || '').toString().toLowerCase();
                    if (statusStr.includes('issue') || statusStr.includes('incident') || issuesStr.length > 5) {
                        s.issues++;
                    }

                    // === RECENT ACTIVITY ===
                    if (site.recentActivity.length < 5) {
                        try {
                            site.recentActivity.push({
                                timestamp: ts.toISOString(),
                                type: 'Patrol',
                                inspector: (row[LOG_IDX.patrolName] || 'Unknown').toString(),
                                score: score || 0,
                                duration: duration,
                                // Full data for inspection log modal (with safe access)
                                guardName: row.length > LOG_IDX.guardName ? (row[LOG_IDX.guardName] || 'N/A').toString() : 'N/A',
                                shift: row.length > LOG_IDX.shift ? (row[LOG_IDX.shift] || 'N/A').toString() : 'N/A',
                                startTime: row.length > LOG_IDX.startTime ? (row[LOG_IDX.startTime] || '').toString() : '',
                                finishTime: row.length > LOG_IDX.finishTime ? (row[LOG_IDX.finishTime] || '').toString() : '',
                                status: row.length > LOG_IDX.status ? (row[LOG_IDX.status] || 'N/A').toString() : 'N/A',
                                flashlight: row.length > LOG_IDX.flashlight ? (row[LOG_IDX.flashlight] || 'N/A').toString() : 'N/A',
                                uniform: row.length > LOG_IDX.uniform ? (row[LOG_IDX.uniform] || 'N/A').toString() : 'N/A',
                                defenseTools: row.length > LOG_IDX.defenseTools ? (row[LOG_IDX.defenseTools] || 'N/A').toString() : 'N/A',
                                logbook: row.length > LOG_IDX.logbook ? (row[LOG_IDX.logbook] || 'N/A').toString() : 'N/A',
                                gates: row.length > LOG_IDX.gates ? (row[LOG_IDX.gates] || 'N/A').toString() : 'N/A',
                                lighting: row.length > LOG_IDX.lighting ? (row[LOG_IDX.lighting] || 'N/A').toString() : 'N/A',
                                fireSafety: row.length > LOG_IDX.fireSafety ? (row[LOG_IDX.fireSafety] || 'N/A').toString() : 'N/A',
                                details: row.length > LOG_IDX.details ? (row[LOG_IDX.details] || '').toString() : '',
                                issues: row.length > LOG_IDX.issues ? (row[LOG_IDX.issues] || '').toString() : ''
                            });
                        } catch (activityErr) {
                            // Skip this activity if error
                            Logger.log('Activity push error: ' + activityErr.message);
                        }
                    }
                }
            } catch (e) {
                // Skip bad rows silently
            }
        });

        // 8. Get Latest Handover Comment
        comments.forEach(function (row) {
            var siteName = row[1]; // Site column
            var comment = row[2]; // Comment column
            var timestamp = new Date(row[0]); // Timestamp

            if (sitesMap[siteName]) {
                if (!sitesMap[siteName].lastHandover || timestamp > new Date(sitesMap[siteName].lastHandover.timestamp)) {
                    sitesMap[siteName].lastHandover = {
                        timestamp: timestamp.toISOString(),
                        guard: row[3] || 'Unknown',
                        comment: (comment || '').toString().substring(0, 150)
                    };
                }
            }
        });

        // 9. Calculate Rates and Finalize
        var result = [];
        var now = new Date();

        for (var key in sitesMap) {
            var site = sitesMap[key];

            // Average Score
            if (site.stats.countScore > 0) {
                site.stats.avgScore = parseFloat((site.stats.totalScore / site.stats.countScore).toFixed(1));
            }

            // Average Duration
            if (site.stats.patrols > 0) {
                site.stats.avgDuration = Math.round(site.stats.totalDuration / site.stats.patrols);
            }

            // Calculate Equipment Rates
            for (var eq in site.equipment) {
                var total = site.equipment[eq].ok + site.equipment[eq].issues;
                site.equipment[eq].rate = total > 0 ? Math.round((site.equipment[eq].ok / total) * 100) : 100;
            }

            // Calculate Behavior Rates (inverted - we want GOOD rate)
            site.behavior.sleeping.rate = site.behavior.sleeping.total > 0
                ? Math.round(((site.behavior.sleeping.total - site.behavior.sleeping.incidents) / site.behavior.sleeping.total) * 100)
                : 100;
            site.behavior.offPosition.rate = site.behavior.offPosition.total > 0
                ? Math.round(((site.behavior.offPosition.total - site.behavior.offPosition.incidents) / site.behavior.offPosition.total) * 100)
                : 100;

            // Calculate Security Rates
            for (var sec in site.security) {
                var secTotal = site.security[sec].ok + site.security[sec].issues;
                site.security[sec].rate = secTotal > 0 ? Math.round((site.security[sec].ok / secTotal) * 100) : 100;
            }

            // Calculate Time Ago for last visit
            if (site.lastVisit.timestamp) {
                var diffMs = now - site.lastVisit.timestamp;
                var diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                var diffDays = Math.floor(diffHours / 24);

                if (diffDays > 0) {
                    site.lastVisit.timeAgo = diffDays + 'd ago';
                } else if (diffHours > 0) {
                    site.lastVisit.timeAgo = diffHours + 'h ago';
                } else {
                    site.lastVisit.timeAgo = 'Just now';
                }
            }

            // Calculate Overall Compliance Scores
            var equipmentRates = [];
            for (var eqKey in site.equipment) {
                equipmentRates.push(site.equipment[eqKey].rate);
            }
            var securityRates = [];
            for (var secKey in site.security) {
                securityRates.push(site.security[secKey].rate);
            }

            site.overallEquipmentRate = equipmentRates.length > 0
                ? Math.round(equipmentRates.reduce(function (a, b) { return a + b; }, 0) / equipmentRates.length)
                : 100;

            site.overallSecurityRate = securityRates.length > 0
                ? Math.round(securityRates.reduce(function (a, b) { return a + b; }, 0) / securityRates.length)
                : 100;

            site.overallDisciplineRate = Math.round((site.behavior.sleeping.rate + site.behavior.offPosition.rate) / 2);

            // Determine Status Badge with explanation
            site.statusReason = '';

            // Default to active (green) unless there are problems
            site.status = 'active';
            site.statusLabel = 'Active';

            // Check for alert conditions (highest priority - red)
            if (site.stats.sleep > 2) {
                site.status = 'alert';
                site.statusLabel = 'Alert';
                site.statusReason = 'Multiple sleeping incidents (' + site.stats.sleep + ' in 30 days)';
            } else if (site.stats.issues > 3) {
                site.status = 'alert';
                site.statusLabel = 'Alert';
                site.statusReason = 'High issue count (' + site.stats.issues + ' issues in 30 days)';
            }
            // Check for idle (gray) - no recent patrols
            else if (site.stats.patrols === 0) {
                site.status = 'idle';
                site.statusLabel = 'No Recent Patrols';
                site.statusReason = 'No patrol data in last 30 days';
            }
            // Check for warning conditions (orange/yellow)
            else if (site.overallEquipmentRate < 80) {
                site.status = 'warning';
                site.statusLabel = 'Equipment Issue';
                site.statusReason = 'Equipment compliance below 80% (' + site.overallEquipmentRate + '%)';
            } else if (site.overallSecurityRate < 80) {
                site.status = 'warning';
                site.statusLabel = 'Security Issue';
                site.statusReason = 'Security compliance below 80% (' + site.overallSecurityRate + '%)';
            } else if (site.overallDisciplineRate < 80) {
                site.status = 'warning';
                site.statusLabel = 'Discipline Issue';
                site.statusReason = 'Discipline compliance below 80% (' + site.overallDisciplineRate + '%)';
            }

            // Clean up temp fields
            delete site.stats.totalScore;
            delete site.stats.countScore;
            delete site.stats.totalDuration;

            // Ensure lastVisit.timestamp is string for JSON serialization
            if (site.lastVisit && site.lastVisit.timestamp instanceof Date) {
                site.lastVisit.timestamp = site.lastVisit.timestamp.toISOString();
            }

            // Sort recentActivity by timestamp descending (newest first)
            if (site.recentActivity && site.recentActivity.length > 0) {
                site.recentActivity.sort(function (a, b) {
                    return new Date(b.timestamp) - new Date(a.timestamp);
                });
            }

            result.push(site);
        }

        // Sort by issues (most issues first)
        result.sort(function (a, b) {
            return b.stats.issues - a.stats.issues;
        });

        Logger.log('🟢 [SiteMap] SUCCESS: Returning ' + result.length + ' sites with aggregated data');

        return result;

    } catch (error) {
        Logger.log('🔴 [SiteMap] FATAL ERROR: ' + error.message);
        Logger.log('🔴 [SiteMap] Stack: ' + error.stack);
        throw new Error('SiteMap Error: ' + error.message);
    }
}
