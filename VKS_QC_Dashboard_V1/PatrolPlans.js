/**
 * PatrolPlans.js - Patrol Planning & Compliance Engine
 * 
 * Features:
 * - CRUD for daily patrol plans (date + shift + route + sites)
 * - Compliance matching against InspectionLogs (4-way key: date + shift + route + siteName)
 * - Copy plans: per-shift, full-day, weekly repeat
 * - Analytics: compliance stats over date ranges
 */

// ===========================================
// SHEET AUTO-CREATION
// ===========================================

/**
 * Ensure PatrolPlans sheet exists, create if not
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function ensurePatrolPlansSheet_() {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    let sheet = ss.getSheetByName(SHEET_PATROL_PLANS);

    if (!sheet) {
        sheet = ss.insertSheet(SHEET_PATROL_PLANS);
        const headers = COLUMNS.patrolPlans;
        sheet.appendRow(headers);
        sheet.getRange(1, 1, 1, headers.length)
            .setFontWeight('bold')
            .setBackground('#4285f4')
            .setFontColor('#ffffff');
        sheet.setFrozenRows(1);
        Logger.log('[PatrolPlans] Created new PatrolPlans sheet');
    }

    return sheet;
}

// ===========================================
// CRUD OPERATIONS
// ===========================================

/**
 * Get all patrol plans for a given date
 * @param {string} date - YYYY-MM-DD
 * @returns {Array} Plan objects grouped by shift and route
 */
function getPatrolPlans(date) {
    try {
        if (!date) throw new Error('Date is required');

        const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        const sheet = ss.getSheetByName(SHEET_PATROL_PLANS);
        if (!sheet || sheet.getLastRow() <= 1) return [];

        const data = sheet.getDataRange().getValues();
        const headers = data[0];
        const dateIdx = headers.indexOf('date');
        const plans = [];

        for (var i = 1; i < data.length; i++) {
            var row = data[i];
            var rowDate = row[dateIdx];

            // Normalize date comparison: handle Date objects and strings
            var rowDateStr = '';
            if (rowDate instanceof Date) {
                rowDateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
            } else {
                rowDateStr = String(rowDate || '').trim();
            }

            if (rowDateStr === date) {
                plans.push({
                    id: String(row[0] || ''),
                    date: rowDateStr,
                    shift: (function (s) { s = s.toLowerCase(); return s === 'afternoon' ? 'evening' : s; })(String(row[headers.indexOf('shift')] || '')),
                    route: String(row[headers.indexOf('route')] || '').toUpperCase(),
                    siteId: String(row[headers.indexOf('siteId')] || ''),
                    siteName: String(row[headers.indexOf('siteName')] || ''),
                    createdBy: String(row[headers.indexOf('createdBy')] || ''),
                    createdAt: String(row[headers.indexOf('createdAt')] || '')
                });
            }
        }

        return plans;
    } catch (e) {
        Logger.log('[PatrolPlans] getPatrolPlans error: ' + e.message);
        throw e;
    }
}

/**
 * Save patrol plan entries (bulk) with dedup protection
 * @param {string} date - YYYY-MM-DD
 * @param {string} shift - morning/evening/night
 * @param {string} route - A or B
 * @param {Array} siteIds - Array of site IDs to plan
 * @param {string} userId - Current user ID
 * @returns {Object} Result with count of added entries
 */
function savePatrolPlans(date, shift, route, siteIds, userId) {
    try {
        if (!date || !shift || !route || !siteIds || !siteIds.length) {
            throw new Error('Date, shift, route, and at least one site are required');
        }

        shift = shift.toLowerCase();
        route = route.toUpperCase();
        var now = new Date().toISOString();

        var sheet = ensurePatrolPlansSheet_();
        var data = sheet.getDataRange().getValues();
        var headers = data[0];
        var dateIdx = headers.indexOf('date');
        var shiftIdx = headers.indexOf('shift');
        var routeIdx = headers.indexOf('route');
        var siteIdIdx = headers.indexOf('siteId');

        // Build set of existing (date+shift+route+siteId) for dedup
        var existing = {};
        for (var i = 1; i < data.length; i++) {
            var rowDate = data[i][dateIdx];
            var rowDateStr = '';
            if (rowDate instanceof Date) {
                rowDateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
            } else {
                rowDateStr = String(rowDate || '').trim();
            }

            if (rowDateStr === date) {
                var key = rowDateStr + '|' + String(data[i][shiftIdx] || '').toLowerCase() + '|' +
                    String(data[i][routeIdx] || '').toUpperCase() + '|' +
                    String(data[i][siteIdIdx] || '');
                existing[key] = true;
            }
        }

        // Resolve site names from Sites sheet
        var siteNames = getSiteNamesById_(siteIds);

        // Build rows to add (skip duplicates)
        var rowsToAdd = [];
        var skipped = 0;

        for (var j = 0; j < siteIds.length; j++) {
            var sid = siteIds[j];
            var key = date + '|' + shift + '|' + route + '|' + sid;

            if (existing[key]) {
                skipped++;
                continue;
            }

            var newId = 'PP-' + Utilities.getUuid().substring(0, 8).toUpperCase();
            rowsToAdd.push([
                newId,                      // id
                date,                       // date
                shift,                      // shift
                route,                      // route
                sid,                        // siteId
                siteNames[sid] || sid,      // siteName
                userId || '',               // createdBy
                now                         // createdAt
            ]);
        }

        // Batch append
        if (rowsToAdd.length > 0) {
            var nextRow = sheet.getLastRow() + 1;
            sheet.getRange(nextRow, 1, rowsToAdd.length, COLUMNS.patrolPlans.length)
                .setValues(rowsToAdd);
            SpreadsheetApp.flush();
        }

        Logger.log('[PatrolPlans] Saved ' + rowsToAdd.length + ' plans, skipped ' + skipped + ' dupes');
        return { success: true, added: rowsToAdd.length, skipped: skipped };
    } catch (e) {
        Logger.log('[PatrolPlans] savePatrolPlans error: ' + e.message);
        throw e;
    }
}

/**
 * Delete a single patrol plan entry
 * @param {string} planId - Plan entry ID
 * @returns {Object} Result
 */
function deletePatrolPlan(planId) {
    try {
        if (!planId) throw new Error('Plan ID is required');

        var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        var sheet = ss.getSheetByName(SHEET_PATROL_PLANS);
        if (!sheet) throw new Error('PatrolPlans sheet not found');

        var data = sheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
            if (String(data[i][0]).trim() === planId) {
                sheet.deleteRow(i + 1);
                SpreadsheetApp.flush();
                Logger.log('[PatrolPlans] Deleted plan: ' + planId);
                return { success: true };
            }
        }

        throw new Error('Plan not found: ' + planId);
    } catch (e) {
        Logger.log('[PatrolPlans] deletePatrolPlan error: ' + e.message);
        throw e;
    }
}

/**
 * Delete multiple patrol plan entries (batch)
 * @param {Array} planIds - Array of plan entry IDs
 * @returns {Object} Result with count
 */
function deletePatrolPlans(planIds) {
    try {
        if (!planIds || !planIds.length) throw new Error('Plan IDs are required');

        var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        var sheet = ss.getSheetByName(SHEET_PATROL_PLANS);
        if (!sheet) throw new Error('PatrolPlans sheet not found');

        var data = sheet.getDataRange().getValues();
        var idSet = {};
        for (var k = 0; k < planIds.length; k++) {
            idSet[String(planIds[k]).trim()] = true;
        }

        // Collect row indices to delete (1-indexed), bottom-to-top
        var rowsToDelete = [];
        for (var i = data.length - 1; i >= 1; i--) {
            if (idSet[String(data[i][0]).trim()]) {
                rowsToDelete.push(i + 1);
            }
        }

        // Delete from bottom up to preserve indices
        for (var j = 0; j < rowsToDelete.length; j++) {
            sheet.deleteRow(rowsToDelete[j]);
        }

        if (rowsToDelete.length > 0) SpreadsheetApp.flush();

        Logger.log('[PatrolPlans] Batch deleted ' + rowsToDelete.length + ' of ' + planIds.length + ' requested');
        return { success: true, deleted: rowsToDelete.length };
    } catch (e) {
        Logger.log('[PatrolPlans] deletePatrolPlans error: ' + e.message);
        throw e;
    }
}

/**
 * Clear all plans for a specific date + shift + route
 * @param {string} date - YYYY-MM-DD
 * @param {string} shift - morning/evening/night
 * @param {string} route - A or B
 * @returns {Object} Result with count
 */
function clearPatrolPlans(date, shift, route) {
    try {
        if (!date || !shift || !route) throw new Error('Date, shift, and route are required');

        shift = shift.toLowerCase();
        route = route.toUpperCase();

        var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        var sheet = ss.getSheetByName(SHEET_PATROL_PLANS);
        if (!sheet) return { success: true, deleted: 0 };

        var data = sheet.getDataRange().getValues();
        var headers = data[0];
        var dateIdx = headers.indexOf('date');
        var shiftIdx = headers.indexOf('shift');
        var routeIdx = headers.indexOf('route');

        // Find rows to delete (collect from bottom to top to preserve indices)
        var rowsToDelete = [];
        for (var i = data.length - 1; i >= 1; i--) {
            var rowDate = data[i][dateIdx];
            var rowDateStr = '';
            if (rowDate instanceof Date) {
                rowDateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
            } else {
                rowDateStr = String(rowDate || '').trim();
            }

            if (rowDateStr === date &&
                String(data[i][shiftIdx] || '').toLowerCase() === shift &&
                String(data[i][routeIdx] || '').toUpperCase() === route) {
                rowsToDelete.push(i + 1);
            }
        }

        // Delete from bottom up
        for (var j = 0; j < rowsToDelete.length; j++) {
            sheet.deleteRow(rowsToDelete[j]);
        }

        if (rowsToDelete.length > 0) SpreadsheetApp.flush();

        Logger.log('[PatrolPlans] Cleared ' + rowsToDelete.length + ' plans for ' + date + ' ' + shift + ' ' + route);
        return { success: true, deleted: rowsToDelete.length };
    } catch (e) {
        Logger.log('[PatrolPlans] clearPatrolPlans error: ' + e.message);
        throw e;
    }
}

// ===========================================
// COPY PLANS
// ===========================================

/**
 * Copy patrol plans with 3 modes: shift, day, weekly
 * @param {string} fromDate - Source date YYYY-MM-DD
 * @param {Object} options - Copy options
 *   mode: 'shift' | 'day' | 'weekly'
 *   shift: 'morning' (only for mode='shift')
 *   route: 'A' (optional filter)
 *   toDate: 'YYYY-MM-DD' (for mode='shift' or 'day')
 *   weekdays: [1, 4] (for mode='weekly', 0=Sun..6=Sat)
 *   weeksAhead: 4 (for mode='weekly')
 * @param {string} userId - Current user ID
 * @returns {Object} Result
 */
function copyPatrolPlans(fromDate, options, userId) {
    try {
        if (!fromDate || !options || !options.mode) {
            throw new Error('Source date and copy mode are required');
        }

        // Get source plans
        var allPlans = getPatrolPlans(fromDate);
        if (allPlans.length === 0) {
            return { success: false, message: 'No plans found for source date' };
        }

        // Filter by shift/route if specified
        var sourcePlans = allPlans;
        if (options.mode === 'shift' && options.shift) {
            sourcePlans = sourcePlans.filter(function (p) {
                return p.shift === options.shift.toLowerCase();
            });
        }
        if (options.route) {
            sourcePlans = sourcePlans.filter(function (p) {
                return p.route === options.route.toUpperCase();
            });
        }

        if (sourcePlans.length === 0) {
            return { success: false, message: 'No matching plans found to copy' };
        }

        var totalAdded = 0;
        var totalSkipped = 0;

        if (options.mode === 'shift' || options.mode === 'day') {
            // Single target date
            if (!options.toDate) throw new Error('Target date is required');

            // Group by shift+route and bulk save
            var groups = {};
            sourcePlans.forEach(function (p) {
                var gKey = p.shift + '|' + p.route;
                if (!groups[gKey]) groups[gKey] = { shift: p.shift, route: p.route, siteIds: [] };
                groups[gKey].siteIds.push(p.siteId);
            });

            var groupKeys = Object.keys(groups);
            for (var i = 0; i < groupKeys.length; i++) {
                var g = groups[groupKeys[i]];
                var result = savePatrolPlans(options.toDate, g.shift, g.route, g.siteIds, userId);
                totalAdded += result.added;
                totalSkipped += result.skipped;
            }
        } else if (options.mode === 'weekly') {
            // Repeat on selected weekdays for N weeks
            if (!options.weekdays || !options.weekdays.length) {
                throw new Error('Weekdays are required for weekly repeat');
            }
            var weeksAhead = options.weeksAhead || 4;

            // Generate target dates
            var targetDates = [];
            var startDate = new Date(fromDate + 'T12:00:00'); // noon to avoid DST issues

            for (var w = 0; w < weeksAhead * 7; w++) {
                var d = new Date(startDate);
                d.setDate(d.getDate() + w + 1); // start from day after source

                if (options.weekdays.indexOf(d.getDay()) !== -1) {
                    var dateStr = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
                    // Cap at 30 days ahead from today
                    var today = new Date();
                    var diffDays = Math.floor((d - today) / (1000 * 60 * 60 * 24));
                    if (diffDays <= 30) {
                        targetDates.push(dateStr);
                    }
                }
            }

            // Copy to each target date
            var groups = {};
            sourcePlans.forEach(function (p) {
                var gKey = p.shift + '|' + p.route;
                if (!groups[gKey]) groups[gKey] = { shift: p.shift, route: p.route, siteIds: [] };
                groups[gKey].siteIds.push(p.siteId);
            });

            for (var t = 0; t < targetDates.length; t++) {
                var groupKeys = Object.keys(groups);
                for (var g = 0; g < groupKeys.length; g++) {
                    var gr = groups[groupKeys[g]];
                    var result = savePatrolPlans(targetDates[t], gr.shift, gr.route, gr.siteIds, userId);
                    totalAdded += result.added;
                    totalSkipped += result.skipped;
                }
            }
        }

        Logger.log('[PatrolPlans] Copy complete: ' + totalAdded + ' added, ' + totalSkipped + ' skipped');
        return { success: true, added: totalAdded, skipped: totalSkipped, targetDates: options.mode === 'weekly' ? targetDates.length : 1 };
    } catch (e) {
        Logger.log('[PatrolPlans] copyPatrolPlans error: ' + e.message);
        throw e;
    }
}

// ===========================================
// COMPLIANCE ENGINE
// ===========================================

/**
 * Get patrol compliance for a specific date
 * Compares PatrolPlans against InspectionLogs using 4-way key: date + shift + route + siteName
 * Falls back to external Patrol SS if local InspectionLogs is empty (same pattern as SiteMap_Data.js)
 * @param {string} date - YYYY-MM-DD
 * @returns {Object} { plans, visited, missed, unplanned, summary }
 */
function getPatrolCompliance(date) {
    try {
        if (!date) {
            Logger.log('[PatrolPlans] getPatrolCompliance called with no date');
            return { date: '', plans: [], visited: [], missed: [], unplanned: [], summary: { totalPlanned: 0, totalVisited: 0, totalMissed: 0, totalUnplanned: 0, complianceRate: 0 } };
        }

        Logger.log('[PatrolPlans] getPatrolCompliance START for date: ' + date);

        // 1. Get plans for this date
        var plans = getPatrolPlans(date);
        Logger.log('[PatrolPlans] Plans found: ' + plans.length);

        // 2. Load inspector shift map (name → shift)
        //    NOTE: This is the INSPECTOR's assigned shift, not the guard's.
        //    Used as last-resort fallback only (Strategy 4), after timestamp.
        var inspectorShiftMap = {};
        var siteIdMap = getSiteIdMap_(); // Load Site Name -> ID map
        var shiftNumToName = { '1': 'morning', '2': 'evening', '3': 'night' };
        try {
            var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
            var inspSheet = ss.getSheetByName(SHEET_INSPECTORS);
            if (inspSheet && inspSheet.getLastRow() > 1) {
                var inspData = inspSheet.getDataRange().getValues();
                var inspHeaders = inspData[0];
                var nameIdx = -1, shiftIdx = -1;
                for (var h = 0; h < inspHeaders.length; h++) {
                    var hdr = String(inspHeaders[h]).trim().toLowerCase();
                    if (hdr === 'name') nameIdx = h;
                    if (hdr === 'shift') shiftIdx = h;
                }
                if (nameIdx >= 0 && shiftIdx >= 0) {
                    for (var r = 1; r < inspData.length; r++) {
                        var iName = String(inspData[r][nameIdx] || '').trim();
                        var iShift = String(inspData[r][shiftIdx] || '').trim();
                        // Include ALL inspectors (even deactivated) — historical logs should still match
                        if (iName && iShift) {
                            var resolvedShift = shiftNumToName[iShift] || '';
                            if (!resolvedShift) {
                                var shiftMatch = iShift.match(/\b([123])\b/);
                                if (shiftMatch) resolvedShift = shiftNumToName[shiftMatch[1]] || '';
                            }
                            if (!resolvedShift) resolvedShift = extractShiftFromText_(iShift) || 'morning';
                            inspectorShiftMap[iName.toLowerCase()] = resolvedShift;
                        }
                    }
                }
                Logger.log('[PatrolPlans] Inspector shift map loaded: ' + Object.keys(inspectorShiftMap).length + ' inspectors');
            }
        } catch (inspErr) {
            Logger.log('[PatrolPlans] Inspectors load error: ' + inspErr.message);
        }

        // 3. Get InspectionLogs from QC Sheet (Guard Patrol writes directly here)
        //    Read ±1 day buffer (date-1 to date+1) for cross-midnight night shift coverage.
        //    The effectiveDate logic below will filter to only the requested date.
        var dayLogs = [];
        var datePrev = getPrevDate_(date);
        var dateNext = getNextDate_(date);
        try {
            var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
            var logSheet = ss.getSheetByName(SHEET_INSPECTION_LOGS);
            var logData = [];

            if (logSheet && logSheet.getLastRow() > 1) {
                logData = logSheet.getDataRange().getValues();
                Logger.log('[PatrolPlans] InspectionLogs rows: ' + logData.length);
            }

            // NIGHT SHIFT CROSS-MIDNIGHT: Night shift 21:30–06:30 spans two calendar days.
            // For a plan on date X, we need logs from X-1 to X+1, then use effectiveDate
            // to determine which plan date each log actually belongs to.
            // The ±1 day buffer ensures we capture all relevant night shift logs.

            for (var i = 1; i < logData.length; i++) {
                var ts = logData[i][0]; // timestamp column 0
                if (!ts) continue;

                var tsDate;
                if (ts instanceof Date) {
                    tsDate = ts;
                } else {
                    tsDate = new Date(ts);
                    if (isNaN(tsDate.getTime())) continue;
                }

                var logDate = Utilities.formatDate(tsDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');

                // ±1 day buffer: skip logs outside the date-1 to date+1 window
                if (logDate < datePrev || logDate > dateNext) continue;

                var patrolName = String(logData[i][1] || '').trim();

                // Determine shift using HYBRID approach:
                //   Operational shift windows (with overlaps):
                //     Shift 1 (Morning):   05:30 – 14:30
                //     Shift 2 (evening): 13:30 – 22:30
                //     Shift 3 (Night):     21:30 – 06:29 (crosses midnight)
                //
                //   Non-overlapping zones → timestamp is authoritative:
                //     06:30–13:29 → Morning only
                //     14:31–21:29 → evening only
                //     22:31–05:29 → Night only
                //
                //   Overlap zones → inspector's assigned shift decides:
                //     05:30–06:29 → Morning OR Night
                //     13:30–14:30 → Morning OR evening
                //     21:30–22:30 → evening OR Night
                var rawShift = String(logData[i][5] || '').trim();
                var logShift = '';
                var winningStrategy = '';

                // Step 1: Get time in minutes
                var tz = Session.getScriptTimeZone();
                var hStr = Utilities.formatDate(tsDate, tz, 'HH');
                var mStr = Utilities.formatDate(tsDate, tz, 'mm');
                var tMin = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);

                // Step 2: Determine if we're in an overlap zone
                var inspAssigned = inspectorShiftMap[patrolName.toLowerCase()] || '';

                if (tMin >= 330 && tMin < 390) {
                    // 05:30–06:29: Morning/Night overlap
                    if (inspAssigned === 'morning') {
                        logShift = 'morning';
                        winningStrategy = 'hybrid-morning';
                    } else {
                        logShift = 'night'; // Night or unknown default
                        winningStrategy = inspAssigned ? 'hybrid-night' : 'hybrid-default';
                    }
                } else if (tMin >= 810 && tMin <= 870) {
                    // 13:30–14:30: Morning/evening overlap
                    if (inspAssigned === 'evening') {
                        logShift = 'evening';
                        winningStrategy = 'hybrid-evening';
                    } else if (inspAssigned === 'morning') {
                        logShift = 'morning';
                        winningStrategy = 'hybrid-morning';
                    } else {
                        logShift = 'evening'; // Default to evening
                        winningStrategy = 'hybrid-default';
                    }
                } else if (tMin >= 1290 && tMin <= 1350) {
                    // 21:30–22:30: evening/Night overlap
                    if (inspAssigned === 'evening') {
                        logShift = 'evening';
                        winningStrategy = 'hybrid-evening';
                    } else {
                        logShift = 'night'; // Night or unknown default
                        winningStrategy = inspAssigned ? 'hybrid-night' : 'hybrid-default';
                    }
                } else {
                    // Non-overlapping zone: timestamp only
                    logShift = getShiftFromTime_(tsDate);
                    winningStrategy = 'timestamp';
                }

                // Fallback strategies (only if above produced nothing)
                // Strategy F1: Column 5 as Lao/text shift name
                if (!logShift && rawShift) {
                    logShift = extractShiftFromText_(rawShift);
                    if (logShift) winningStrategy = 'col5-text';
                }

                // Strategy F2: Column 5 as number (1/2/3)
                if (!logShift) {
                    logShift = shiftNumToName[rawShift] || '';
                    if (logShift) { winningStrategy = 'col5-exact'; }
                    if (!logShift) {
                        var match = rawShift.match(/\b([123])\b/);
                        if (match) {
                            logShift = shiftNumToName[match[1]] || '';
                            if (logShift) winningStrategy = 'col5-regex';
                        }
                    }
                }

                // Strategy F3: Extract shift from patrol name/route text
                if (!logShift) {
                    if (patrolName) logShift = extractShiftFromText_(patrolName);
                    if (!logShift) {
                        var routeText = String(logData[i][2] || '');
                        if (routeText) logShift = extractShiftFromText_(routeText);
                    }
                    if (logShift) winningStrategy = 'name-text';
                }

                // Strategy F4: Inspector sheet lookup by name
                if (!logShift) {
                    logShift = inspectorShiftMap[patrolName.toLowerCase()];
                    if (logShift) winningStrategy = 'inspector-map';
                }

                // Determine the effective plan date for this log
                var effectiveDate = logDate;
                if (logShift === 'night') {
                    // Early morning hours (00:00–06:29) belong to PREVIOUS day's night plan
                    var hourMin = parseInt(Utilities.formatDate(tsDate, Session.getScriptTimeZone(), 'HH'), 10) * 60 +
                        parseInt(Utilities.formatDate(tsDate, Session.getScriptTimeZone(), 'mm'), 10);
                    if (hourMin < 390) { // Before 06:30 (390 min)
                        effectiveDate = getPrevDate_(logDate); // Belongs to yesterday's night plan
                    }
                }

                // Only include logs whose effective date matches the requested date
                if (effectiveDate !== date) continue;

                // Convert timestamp to string for serialization
                var tsStr = Utilities.formatDate(tsDate, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

                var routeRaw = String(logData[i][2] || '');

                dayLogs.push({
                    timestamp: tsStr,
                    patrolName: patrolName,
                    route: extractRouteKey_(routeRaw),
                    routeRaw: routeRaw,
                    siteName: String(logData[i][3] || '').trim(),
                    siteId: siteIdMap[String(logData[i][3] || '').trim().toLowerCase()] || '', // Resolve ID
                    guardName: String(logData[i][4] || '').trim(),
                    shift: logShift,
                    shiftRaw: rawShift,
                    shiftStrategy: winningStrategy,
                    score: String(logData[i][9] || '')
                });
            }
        } catch (logErr) {
            Logger.log('[PatrolPlans] InspectionLogs read error: ' + logErr.message);
            // Continue with empty logs — plans still render
        }

        Logger.log('[PatrolPlans] DayLogs matched: ' + dayLogs.length);

        // 4. Match plans against logs using 3-tier matching:
        //    Tier 1: Exact 4-way match (date + shift + route + siteName) → VISITED
        //    Tier 2: Partial match (same site, different shift/route) → PARTIAL
        //    Tier 3: No match at all → MISSED
        //    Remaining unmatched logs → UNPLANNED
        var shiftOrder = { morning: 0, evening: 1, night: 2 };
        plans.sort(function (a, b) {
            return (shiftOrder[a.shift] || 0) - (shiftOrder[b.shift] || 0);
        });

        // Sort logs by timestamp (earliest first)
        dayLogs.sort(function (a, b) {
            return (a.timestamp || '').localeCompare(b.timestamp || '');
        });

        // Detect multi-shift sites: same siteName+route across different shifts
        var siteShiftCount = {};
        for (var ms = 0; ms < plans.length; ms++) {
            var msKey = plans[ms].siteName.trim().toLowerCase() + '|' + plans[ms].route;
            if (!siteShiftCount[msKey]) siteShiftCount[msKey] = new Set();
            siteShiftCount[msKey].add(plans[ms].shift);
        }
        var multiShiftSites = {};
        for (var msk in siteShiftCount) {
            if (siteShiftCount[msk].size > 1) multiShiftSites[msk] = true;
        }

        var visited = [];
        var partial = [];
        var missed = [];
        var matchedLogIndices = {};
        var matchedPlanIndices = {};

        // --- TIER 1: Exact 4-way match (site + shift + route) ---
        for (var p = 0; p < plans.length; p++) {
            var plan = plans[p];
            var planSiteName = plan.siteName.trim().toLowerCase();
            var planKey = planSiteName + '|' + plan.route;
            var isMultiShift = !!multiShiftSites[planKey];

            for (var l = 0; l < dayLogs.length; l++) {
                if (matchedLogIndices[l]) continue;
                var log = dayLogs[l];
                var logSiteName = log.siteName.trim().toLowerCase();
                var isSiteMatch = (log.siteId && plan.siteId && log.siteId === plan.siteId) || (logSiteName === planSiteName);

                if (isSiteMatch &&
                    log.shift === plan.shift &&
                    log.route === plan.route) {
                    visited.push({
                        planId: plan.id,
                        siteId: plan.siteId,
                        siteName: plan.siteName,
                        shift: plan.shift,
                        route: plan.route,
                        patrolName: log.patrolName,
                        timestamp: log.timestamp,
                        score: log.score,
                        status: 'visited',
                        multiShift: isMultiShift
                    });
                    matchedLogIndices[l] = true;
                    matchedPlanIndices[p] = true;
                    break;
                }
            }
        }


        // TIER 2 (Partial) removed — visits with wrong shift/route are now Unplanned


        // --- TIER 3: Remaining unmatched plans → MISSED ---
        for (var p3 = 0; p3 < plans.length; p3++) {
            if (matchedPlanIndices[p3]) continue;
            var plan3 = plans[p3];
            var planKey3 = plan3.siteName.trim().toLowerCase() + '|' + plan3.route;
            missed.push({
                planId: plan3.id,
                siteId: plan3.siteId,
                siteName: plan3.siteName,
                shift: plan3.shift,
                route: plan3.route,
                status: 'missed',
                multiShift: !!multiShiftSites[planKey3]
            });
        }

        // 5. Find unplanned visits (truly unmatched logs — not near-misses)
        var unplanned = [];
        for (var u = 0; u < dayLogs.length; u++) {
            if (matchedLogIndices[u]) continue;

            var uLog = dayLogs[u];

            if (uLog.siteName) {
                unplanned.push({
                    siteName: uLog.siteName,
                    shift: uLog.shift,
                    route: uLog.route,
                    patrolName: uLog.patrolName,
                    timestamp: uLog.timestamp,
                    score: uLog.score,
                    status: 'unplanned'
                });
            }
        }

        // 6. Build summary
        //    Compliance: visited = 100% credit (partial removed)
        var totalPlanned = plans.length;
        var totalVisited = visited.length;
        var totalPartial = 0; // Partial removed — kept for backward compatibility
        var totalMissed = missed.length;
        var totalUnplanned = unplanned.length;
        var complianceRate = totalPlanned > 0
            ? Math.round((totalVisited / totalPlanned) * 100)
            : 0;

        Logger.log('[PatrolPlans] getPatrolCompliance DONE: ' + totalPlanned + ' planned, ' +
            totalVisited + ' visited, ' + totalMissed + ' missed, ' + totalUnplanned + ' unplanned');

        return {
            date: date,
            plans: plans,
            visited: visited,
            partial: partial,
            missed: missed,
            unplanned: unplanned,
            allLogs: dayLogs, // Debug info
            summary: {
                totalPlanned: totalPlanned,
                totalVisited: totalVisited,
                totalPartial: totalPartial,
                totalMissed: totalMissed,
                totalUnplanned: totalUnplanned,
                complianceRate: complianceRate
            }
        };
    } catch (e) {
        Logger.log('[PatrolPlans] getPatrolCompliance FATAL error: ' + e.message + ' | Stack: ' + e.stack);
        // Return empty result instead of throwing — prevents infinite loading
        return {
            date: date || '',
            plans: [],
            visited: [],
            partial: [],
            missed: [],
            unplanned: [],
            summary: { totalPlanned: 0, totalVisited: 0, totalPartial: 0, totalMissed: 0, totalUnplanned: 0, complianceRate: 0 }
        };
    }
}

/**
 * Get compliance stats for a date range (Analytics)
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Object} { dailyStats[], overallSummary }
 */
function getPatrolComplianceRange(startDate, endDate, route) {
    try {
        if (!startDate || !endDate) throw new Error('Start and end dates are required');

        var start = new Date(startDate + 'T00:00:00');
        var end = new Date(endDate + 'T23:59:59');
        var diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

        if (diffDays > 31) {
            throw new Error('Date range cannot exceed 31 days');
        }

        var filterRoute = (route && route !== 'ALL') ? route.toUpperCase() : '';

        var dailyStats = [];
        var overallPlanned = 0;
        var overallVisited = 0;
        var overallPartial = 0;
        var overallMissed = 0;
        var overallUnplanned = 0;

        // Per-inspector stats
        var inspectorStats = {};

        // Shift-level aggregation
        var shiftStats = {
            morning: { planned: 0, visited: 0, missed: 0 },
            evening: { planned: 0, visited: 0, missed: 0 },
            night: { planned: 0, visited: 0, missed: 0 }
        };

        // Most missed sites tracking
        var missedSiteCount = {};

        for (var d = 0; d < diffDays; d++) {
            var current = new Date(start);
            current.setDate(current.getDate() + d);
            var dateStr = Utilities.formatDate(current, Session.getScriptTimeZone(), 'yyyy-MM-dd');

            var compliance = getPatrolCompliance(dateStr);

            // Apply route filter
            var plans = compliance.plans || [];
            var visited = compliance.visited || [];
            var partialVisits = compliance.partial || [];
            var missed = compliance.missed || [];
            var unplanned = compliance.unplanned || [];

            if (filterRoute) {
                plans = plans.filter(function (p) { return p.route === filterRoute; });
                visited = visited.filter(function (v) { return v.route === filterRoute; });
                partialVisits = partialVisits.filter(function (pv) { return pv.route === filterRoute; });
                missed = missed.filter(function (m) { return m.route === filterRoute; });
                unplanned = unplanned.filter(function (u) { return u.route === filterRoute; });
            }

            // Per-day shift breakdown
            var dayShifts = {
                morning: { planned: 0, visited: 0, missed: 0 },
                evening: { planned: 0, visited: 0, missed: 0 },
                night: { planned: 0, visited: 0, missed: 0 }
            };

            // Count planned per shift from plans
            plans.forEach(function (p) {
                var s = p.shift || 'morning';
                if (dayShifts[s]) dayShifts[s].planned++;
                if (shiftStats[s]) shiftStats[s].planned++;
            });

            // Count visited per shift
            visited.forEach(function (v) {
                var s = v.shift || 'morning';
                if (dayShifts[s]) dayShifts[s].visited++;
                if (shiftStats[s]) shiftStats[s].visited++;
            });

            // Count missed per shift + track site names
            missed.forEach(function (m) {
                var s = m.shift || 'morning';
                if (dayShifts[s]) dayShifts[s].missed++;
                if (shiftStats[s]) shiftStats[s].missed++;

                // Track most missed sites
                var siteKey = (m.siteName || '').trim();
                if (siteKey) {
                    if (!missedSiteCount[siteKey]) missedSiteCount[siteKey] = { name: m.siteName, count: 0, route: m.route };
                    missedSiteCount[siteKey].count++;
                }
            });

            // Build day summary from filtered data
            var dayPlanned = plans.length;
            var dayVisited = visited.length;
            var dayPartial = partialVisits.length;
            var dayMissed = missed.length;
            var dayUnplanned = unplanned.length;
            var dayRate = dayPlanned > 0 ? Math.round(((dayVisited + (dayPartial * 0.5)) / dayPlanned) * 100) : 0;

            dailyStats.push({
                date: dateStr,
                summary: {
                    totalPlanned: dayPlanned,
                    totalVisited: dayVisited,
                    totalPartial: dayPartial,
                    totalMissed: dayMissed,
                    totalUnplanned: dayUnplanned,
                    complianceRate: dayRate
                },
                shifts: dayShifts
            });

            overallPlanned += dayPlanned;
            overallVisited += dayVisited;
            overallPartial += dayPartial;
            overallMissed += dayMissed;
            overallUnplanned += dayUnplanned;

            // Track per-inspector
            visited.forEach(function (v) {
                var name = v.patrolName || 'Unknown';
                if (!inspectorStats[name]) {
                    inspectorStats[name] = { visited: 0, shifts: {} };
                }
                inspectorStats[name].visited++;
                inspectorStats[name].shifts[dateStr + '|' + v.shift] = true;
            });

            unplanned.forEach(function (u) {
                var name = u.patrolName || 'Unknown';
                if (!inspectorStats[name]) {
                    inspectorStats[name] = { visited: 0, unplannedVisits: 0, shifts: {} };
                }
                inspectorStats[name].unplannedVisits = (inspectorStats[name].unplannedVisits || 0) + 1;
            });
        }

        // Format inspector stats
        var inspectorList = Object.keys(inspectorStats).map(function (name) {
            return {
                name: name,
                sitesVisited: inspectorStats[name].visited,
                shiftsWorked: Object.keys(inspectorStats[name].shifts).length
            };
        }).sort(function (a, b) { return b.sitesVisited - a.sitesVisited; });

        // Format most missed sites (top 10)
        var mostMissedSites = Object.keys(missedSiteCount).map(function (key) {
            return missedSiteCount[key];
        }).sort(function (a, b) { return b.count - a.count; }).slice(0, 10);

        return {
            startDate: startDate,
            endDate: endDate,
            dailyStats: dailyStats,
            inspectors: inspectorList,
            shiftStats: shiftStats,
            mostMissedSites: mostMissedSites,
            overallSummary: {
                totalPlanned: overallPlanned,
                totalVisited: overallVisited,
                totalPartial: overallPartial,
                totalMissed: overallMissed,
                totalUnplanned: overallUnplanned,
                complianceRate: overallPlanned > 0
                    ? Math.round(((overallVisited + (overallPartial * 0.5)) / overallPlanned) * 100)
                    : 0
            }
        };
    } catch (e) {
        Logger.log('[PatrolPlans] getPatrolComplianceRange error: ' + e.message);
        throw e;
    }
}

/**
 * Get compliance-annotated route data for a specific inspector across a date range.
 * Reuses getPatrolCompliance() per day (inherits ±1 day buffer, shift detection, 3-tier matching).
 * Returns enriched logs + missed plans for map rendering.
 *
 * @param {string} inspector - Inspector name
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {string} JSON string of { logs, missedPlans, summary }
 */
function getInspectorRouteCompliance(inspector, startDate, endDate) {
    try {
        if (!inspector || !startDate || !endDate) {
            return JSON.stringify({ logs: [], missedPlans: [], summary: {} });
        }

        Logger.log('[PatrolPlans] getInspectorRouteCompliance: ' + inspector + ' | ' + startDate + ' → ' + endDate);

        var inspectorNorm = inspector.trim().toLowerCase();
        var start = new Date(startDate + 'T00:00:00');
        var end = new Date(endDate + 'T23:59:59');
        var diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

        if (diffDays > 31) throw new Error('Date range cannot exceed 31 days');

        // Also read the full InspectionLogs once for the enriched fields (gps, timeDisplay, etc.)
        // that getPatrolCompliance doesn't return
        var fullLogMap = {};
        try {
            var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
            var logSheet = ss.getSheetByName(SHEET_INSPECTION_LOGS);
            if (logSheet && logSheet.getLastRow() > 1) {
                var logData = logSheet.getDataRange().getValues();
                var tz = Session.getScriptTimeZone();
                for (var i = 1; i < logData.length; i++) {
                    var ts = logData[i][0];
                    if (!ts) continue;
                    var tsDate = (ts instanceof Date) ? ts : new Date(ts);
                    if (isNaN(tsDate.getTime())) continue;

                    var pName = String(logData[i][1] || '').trim();
                    if (pName.toLowerCase() !== inspectorNorm) continue;

                    var logDateStr = Utilities.formatDate(tsDate, tz, 'yyyy-MM-dd');
                    // Include logs from startDate-1 to endDate+1 for cross-midnight coverage
                    var bufferStart = getPrevDate_(startDate);
                    var bufferEnd = getNextDate_(endDate);
                    if (logDateStr < bufferStart || logDateStr > bufferEnd) continue;

                    var tsStr = Utilities.formatDate(tsDate, tz, 'yyyy-MM-dd HH:mm:ss');
                    var siteName = String(logData[i][3] || '').trim();

                    // Create a unique key for matching with compliance results
                    var logKey = tsStr + '|' + siteName.toLowerCase();
                    fullLogMap[logKey] = {
                        gps: logData[i][18] || '',
                        timeDisplay: Utilities.formatDate(tsDate, tz, 'HH:mm'),
                        dateDisplay: Utilities.formatDate(tsDate, tz, 'MMM dd, yyyy'),
                        inspectorName: pName,
                        guardName: String(logData[i][4] || '').trim(),
                        score: parseFloat(logData[i][9]) || 0,
                        shift: String(logData[i][5] || '').trim(),
                        issues: String(logData[i][21] || ''),
                        status: String(logData[i][10] || '')
                    };
                }
            }
        } catch (readErr) {
            Logger.log('[PatrolPlans] fullLogMap read error: ' + readErr.message);
        }

        // Iterate each day — reuse getPatrolCompliance per day
        var allLogs = [];
        var allMissedPlans = [];
        var totalVisited = 0, totalPartial = 0, totalMissed = 0, totalPlanned = 0;

        for (var d = 0; d < diffDays; d++) {
            var current = new Date(start);
            current.setDate(current.getDate() + d);
            var dateStr = Utilities.formatDate(current, Session.getScriptTimeZone(), 'yyyy-MM-dd');

            var compliance = getPatrolCompliance(dateStr);

            // Visited logs for this inspector
            (compliance.visited || []).forEach(function (v) {
                if ((v.patrolName || '').trim().toLowerCase() === inspectorNorm) {
                    // Try exact key (plan siteName) first, then fallback to timestamp-only search
                    var key = (v.timestamp || '') + '|' + (v.siteName || '').trim().toLowerCase();
                    var enriched = fullLogMap[key];
                    // Fallback: search by timestamp prefix if plan siteName differs from log siteName
                    if (!enriched) {
                        var tsPrefix = (v.timestamp || '') + '|';
                        for (var fk in fullLogMap) {
                            if (fk.indexOf(tsPrefix) === 0) { enriched = fullLogMap[fk]; break; }
                        }
                    }
                    enriched = enriched || {};
                    allLogs.push({
                        siteName: v.siteName,
                        timestamp: v.timestamp,
                        patrolName: v.patrolName,
                        route: v.route,
                        shift: v.shift,
                        score: enriched.score || v.score || 0,
                        complianceStatus: 'visited',
                        gps: enriched.gps || '',
                        timeDisplay: enriched.timeDisplay || '',
                        dateDisplay: enriched.dateDisplay || '',
                        guardName: enriched.guardName || v.guardName || '',
                        inspectorName: enriched.inspectorName || v.patrolName || '',
                        mismatch: null
                    });
                }
            });

            // Partial logs for this inspector
            (compliance.partial || []).forEach(function (p) {
                if ((p.patrolName || '').trim().toLowerCase() === inspectorNorm) {
                    var key = (p.timestamp || '') + '|' + (p.siteName || '').trim().toLowerCase();
                    var enriched = fullLogMap[key];
                    if (!enriched) {
                        var tsPrefix = (p.timestamp || '') + '|';
                        for (var fk in fullLogMap) {
                            if (fk.indexOf(tsPrefix) === 0) { enriched = fullLogMap[fk]; break; }
                        }
                    }
                    enriched = enriched || {};
                    allLogs.push({
                        siteName: p.siteName,
                        timestamp: p.timestamp,
                        patrolName: p.patrolName,
                        route: p.route,
                        shift: p.shift,
                        score: enriched.score || p.score || 0,
                        complianceStatus: 'partial',
                        gps: enriched.gps || '',
                        timeDisplay: enriched.timeDisplay || '',
                        dateDisplay: enriched.dateDisplay || '',
                        guardName: enriched.guardName || p.guardName || '',
                        inspectorName: enriched.inspectorName || p.patrolName || '',
                        mismatch: p.mismatch || '',
                        actualShift: p.actualShift || '',
                        actualRoute: p.actualRoute || ''
                    });
                }
            });

            // Unplanned logs for this inspector (visited but not in plan)
            (compliance.unplanned || []).forEach(function (u) {
                if ((u.patrolName || '').trim().toLowerCase() === inspectorNorm) {
                    var key = (u.timestamp || '') + '|' + (u.siteName || '').trim().toLowerCase();
                    var enriched = fullLogMap[key];
                    if (!enriched) {
                        var tsPrefix = (u.timestamp || '') + '|';
                        for (var fk in fullLogMap) {
                            if (fk.indexOf(tsPrefix) === 0) { enriched = fullLogMap[fk]; break; }
                        }
                    }
                    enriched = enriched || {};
                    allLogs.push({
                        siteName: u.siteName,
                        timestamp: u.timestamp,
                        patrolName: u.patrolName,
                        route: u.route,
                        shift: u.shift,
                        score: enriched.score || u.score || 0,
                        complianceStatus: 'unplanned',
                        gps: enriched.gps || '',
                        timeDisplay: enriched.timeDisplay || '',
                        dateDisplay: enriched.dateDisplay || '',
                        guardName: enriched.guardName || u.guardName || '',
                        inspectorName: enriched.inspectorName || u.patrolName || '',
                        mismatch: null
                    });
                }
            });

            // Missed plans — these are sites the inspector should have visited
            // We can't filter missed plans by inspector directly (plans don't have inspector field),
            // so we include all missed plans for context
            (compliance.missed || []).forEach(function (m) {
                allMissedPlans.push({
                    siteName: m.siteName,
                    shift: m.shift,
                    route: m.route,
                    date: dateStr,
                    complianceStatus: 'missed'
                });
            });

            // Aggregate counts
            var dayPlans = (compliance.plans || []);
            totalPlanned += dayPlans.length;
            totalVisited += (compliance.visited || []).length;
            totalPartial += (compliance.partial || []).length;
            totalMissed += (compliance.missed || []).length;
        }

        // Derive inspector's active shifts from their actual patrol logs
        var inspectorShifts = {};
        allLogs.forEach(function (log) {
            if (log.shift) inspectorShifts[log.shift.toLowerCase()] = true;
        });

        // Filter missed plans to only include the inspector's shift(s)
        if (Object.keys(inspectorShifts).length > 0) {
            allMissedPlans = allMissedPlans.filter(function (m) {
                return inspectorShifts[(m.shift || '').toLowerCase()];
            });
            totalMissed = allMissedPlans.length;
        }

        // Sort logs by timestamp
        allLogs.sort(function (a, b) {
            return new Date(a.timestamp) - new Date(b.timestamp);
        });

        var complianceRate = totalPlanned > 0
            ? Math.round(((totalVisited + (totalPartial * 0.5)) / totalPlanned) * 100)
            : 0;

        Logger.log('[PatrolPlans] getInspectorRouteCompliance DONE: ' +
            allLogs.length + ' logs, ' + allMissedPlans.length + ' missed plans, ' +
            complianceRate + '% compliance');

        return JSON.stringify({
            logs: allLogs,
            missedPlans: allMissedPlans,
            summary: {
                totalPlanned: totalPlanned,
                totalVisited: totalVisited,
                totalPartial: totalPartial,
                totalMissed: totalMissed,
                complianceRate: complianceRate
            }
        });

    } catch (e) {
        Logger.log('[PatrolPlans] getInspectorRouteCompliance error: ' + e.message);
        return JSON.stringify({
            logs: [],
            missedPlans: [],
            summary: { totalPlanned: 0, totalVisited: 0, totalPartial: 0, totalMissed: 0, complianceRate: 0 }
        });
    }
}

// ===========================================
// HELPERS
// ===========================================

/**
 * Compute shift from a timestamp using operational time ranges
 * Non-overlapping boundaries (based on midpoints):
 *   Morning:   05:30 – 13:59
 *   evening: 14:00 – 21:59
 *   Night:     22:00 – 05:29
 * @param {Date|string} timestamp
 * @returns {string} 'morning' | 'evening' | 'night'
 */
function getShiftFromTime_(timestamp) {
    var d = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (isNaN(d.getTime())) return 'morning'; // Fallback

    var tz = Session.getScriptTimeZone();
    var hourStr = Utilities.formatDate(d, tz, 'HH');
    var minStr = Utilities.formatDate(d, tz, 'mm');
    var totalMin = parseInt(hourStr, 10) * 60 + parseInt(minStr, 10);

    // Operational shift windows (user-defined):
    //   Morning:   06:30 (390) to 13:59 (839)
    //   evening: 14:00 (840) to 21:29 (1289)
    //   Night:     21:30 (1290) to 06:29 (389) — crosses midnight
    if (totalMin >= 390 && totalMin < 840) return 'morning';
    if (totalMin >= 840 && totalMin < 1290) return 'evening';
    return 'night';
}

/**
 * Extract shift name from text containing Lao shift keywords.
 * Detects shift from inspector/patrol names like "ສາຍ B ພາກແລງ - ..."
 * or shift column values that may contain text.
 * @param {string} text - Text to search for shift keywords
 * @returns {string} 'morning'|'evening'|'night' or '' if not found
 */
function extractShiftFromText_(text) {
    if (!text) return '';
    // Must use ພາກ prefix to avoid matching personal names containing ຄຳ etc.
    // ພາກເຊົ້າ = morning
    if (/\u0E9E\u0EB2\u0E81\u0EC0\u0E8A\u0EBB\u0EC9\u0EB2/.test(text)) return 'morning';
    // ພາກແລງ = evening, ພາກບ່າຍ = evening
    if (/\u0E9E\u0EB2\u0E81\u0EC1\u0EA5\u0E87|\u0E9E\u0EB2\u0E81\u0E9A\u0EC8\u0EB2\u0E8D/.test(text)) return 'evening';
    // ພາກຄໍາ = night, ພາກຄຳ = night
    if (/\u0E9E\u0EB2\u0E81\u0E84\u0ECD\u0EB2|\u0E9E\u0EB2\u0E81\u0E84\u0EB3/.test(text)) return 'night';
    // English fallbacks
    var lower = text.toLowerCase();
    if (lower.indexOf('morning') >= 0) return 'morning';
    if (lower.indexOf('evening') >= 0) return 'evening';
    if (lower.indexOf('night') >= 0 || lower.indexOf('evening') >= 0) return 'night';
    return '';
}

/**
 * Extract single-letter route key (A or B) from a full route description string.
 * Handles formats like "ສາຍ B ພາກຕ້ - ສະຫວນ ຄຳເລົາ" → "B",
 * "Route A" → "A", or already-clean "A", "B".
 * @param {string} routeStr - Raw route string from inspection logs
 * @returns {string} Uppercase single-letter route key, or raw value if no match
 */
function extractRouteKey_(routeStr) {
    var s = (routeStr || '').trim();
    if (!s) return '';

    // Already a single letter?
    var upper = s.toUpperCase();
    if (upper === 'A' || upper === 'B') return upper;

    // Look for standalone A or B in the string (word boundary match)
    // Match patterns like "Route A", "ສາຍ A", "สาย B", etc.
    var match = s.match(/\b([AB])\b/i);
    if (match) return match[1].toUpperCase();

    // Fallback: return the uppercase raw value
    return upper;
}

/**
 * Get the next date in YYYY-MM-DD format
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string} YYYY-MM-DD + 1 day
 */
function getNextDate_(dateStr) {
    var parts = dateStr.split('-');
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    d.setDate(d.getDate() + 1);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * Get the previous date in YYYY-MM-DD format
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string} YYYY-MM-DD - 1 day
 */
function getPrevDate_(dateStr) {
    var parts = dateStr.split('-');
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    d.setDate(d.getDate() - 1);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * Get site names by IDs (batch lookup)
 * @param {Array} siteIds - Array of site IDs
 * @returns {Object} Map of siteId → siteName
 */
function getSiteNamesById_(siteIds) {
    var names = {};
    try {
        var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        var sheet = ss.getSheetByName(SHEET_SITES);
        if (!sheet) return names;

        var data = sheet.getDataRange().getValues();
        var headers = data[0];
        var idIdx = getCIIndex(headers, ['id']);
        var nameIdx = getCIIndex(headers, ['nameEN', 'name_en', 'site name']);

        var idSet = {};
        for (var j = 0; j < siteIds.length; j++) {
            idSet[siteIds[j]] = true;
        }

        for (var i = 1; i < data.length; i++) {
            var rowId = String(data[i][idIdx] || '').trim();
            if (idSet[rowId]) {
                names[rowId] = String(data[i][nameIdx] || '').trim();
            }
        }
    } catch (e) {
        Logger.log('[PatrolPlans] getSiteNamesById_ error: ' + e.message);
    }
    return names;
}

/**
 * Build a map of Normalized Name -> Site ID
 * Used for robust matching of logs to plans
 * @returns {Object} Map { "normalized name": "siteId" }
 */
function getSiteIdMap_() {
    var map = {};
    try {
        var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        var sheet = ss.getSheetByName(SHEET_SITES);
        if (!sheet) return map;

        var data = sheet.getDataRange().getValues();
        var headers = data[0];
        // Find ID column
        var idIdx = -1;
        for (var h = 0; h < headers.length; h++) {
            if (String(headers[h]).toLowerCase() === 'id') { idIdx = h; break; }
        }

        // Find Name columns (EN and LA)
        var nameEnIdx = -1;
        var nameLaIdx = -1;
        for (var h = 0; h < headers.length; h++) {
            var hdr = String(headers[h]).toLowerCase();
            if (hdr === 'nameen' || hdr === 'name_en' || hdr === 'site name') nameEnIdx = h;
            if (hdr === 'namela' || hdr === 'name_la' || hdr === 'lao name') nameLaIdx = h;
        }

        if (idIdx === -1) return map;

        for (var i = 1; i < data.length; i++) {
            var rowId = String(data[i][idIdx] || '').trim();
            if (!rowId) continue;

            // Index English Name
            if (nameEnIdx >= 0) {
                var nameEn = String(data[i][nameEnIdx] || '').trim().toLowerCase();
                if (nameEn) map[nameEn] = rowId;
            }
            // Index Lao Name
            if (nameLaIdx >= 0) {
                var nameLa = String(data[i][nameLaIdx] || '').trim().toLowerCase();
                if (nameLa) map[nameLa] = rowId;
            }
        }
    } catch (e) {
        Logger.log('[PatrolPlans] getSiteIdMap_ error: ' + e.message);
    }
    return map;
}

/**
 * Get active sites filtered by route (for the "Add Sites" picker)
 * @param {string} route - A or B
 * @returns {Array} [{id, nameEN, route}]
 */
function getSitesByRoute(route) {
    try {
        route = (route || '').toUpperCase();
        var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        var sheet = ss.getSheetByName(SHEET_SITES);
        if (!sheet) return [];

        var data = sheet.getDataRange().getValues();
        var headers = data[0];
        var idIdx = getCIIndex(headers, ['id']);
        var nameIdx = getCIIndex(headers, ['nameEN', 'name_en', 'site name']);
        var routeIdx = getCIIndex(headers, ['route']);
        var statusIdx = getCIIndex(headers, ['status']);

        var sites = [];
        for (var i = 1; i < data.length; i++) {
            var row = data[i];
            var siteStatus = statusIdx !== -1 ? String(row[statusIdx] || 'active').toLowerCase() : 'active';
            var siteRoute = routeIdx !== -1 ? String(row[routeIdx] || '').toUpperCase() : '';

            if (siteStatus === 'deleted' || siteStatus === 'inactive') continue;
            if (route && siteRoute !== route) continue;

            var id = String(row[idIdx] || '').trim();
            var name = String(row[nameIdx] || '').trim();
            if (!id || !name) continue;

            sites.push({
                id: id,
                nameEN: name,
                route: siteRoute
            });
        }

        sites.sort(function (a, b) { return a.nameEN.localeCompare(b.nameEN); });
        return sites;
    } catch (e) {
        Logger.log('[PatrolPlans] getSitesByRoute error: ' + e.message);
        return [];
    }
}
