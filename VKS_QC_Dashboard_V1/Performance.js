/**
 * Performance.js - Performance analytics backend
 * 
 * Aggregation functions for the Performance Page.
 * Returns metrics from: InspectionLogs, Guards, Sites, Incidents, Complaints, HandoverRecords, SpecialActivityLogs
 */

// ===========================================
// 1. INSPECTION PERFORMANCE
// ===========================================

/**
 * Get inspection performance metrics
 * @param {Object} dateRange - { start: string, end: string }
 * @param {string} routeFilter - 'A', 'B', or '' for all
 * @returns {Object} { total, avgScore, passRate, scatterData }
 */
function getInspectionPerformance(dateRange, routeFilter) {
    try {
        // getInspectionLogs returns JSON string, need to parse it
        const logsRaw = getInspectionLogs({
            startDate: dateRange.start,
            endDate: dateRange.end,
            route: routeFilter === 'all' ? '' : routeFilter
        });
        const logs = typeof logsRaw === 'string' ? JSON.parse(logsRaw) : (logsRaw || []);

        const total = logs.length;

        // Calculate average score (0-100 scale)
        const scores = logs.filter(l => l.score !== undefined && l.score !== '').map(l => parseFloat(l.score) || 0);
        const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

        // Pass rate: status === 'completed' (no issues)
        const passed = logs.filter(l => l.status === 'completed').length;
        const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

        // Scatter data for chart
        const scatterData = logs.map(l => {
            const ts = new Date(l.timestamp);
            const hour = ts.getHours();

            // Determine shift based on hour:
            // Shift 1: 06:00-13:59 (6-13)
            // Shift 2: 14:00-21:59 (14-21)
            // Shift 3: 22:00-05:59 (22-23, 0-5)
            let shift = 1;
            if (hour >= 6 && hour < 14) {
                shift = 1;
            } else if (hour >= 14 && hour < 22) {
                shift = 2;
            } else {
                shift = 3;
            }

            return {
                date: ts.toISOString().split('T')[0], // Use ISO date for proper grouping
                day: ts.toISOString().split('T')[0],
                hour: hour,
                minute: ts.getMinutes(),
                shift: shift,
                siteName: l.siteName || '',
                route: l.route || '',
                inspector: l.inspectorName || '',
                type: 'inspection'
            };
        });

        // Calculate trend vs previous period
        const periodDays = Math.ceil((new Date(dateRange.end) - new Date(dateRange.start)) / 86400000);
        const prevStart = new Date(dateRange.start);
        prevStart.setDate(prevStart.getDate() - periodDays);

        const prevLogsRaw = getInspectionLogs({
            startDate: prevStart.toISOString().split('T')[0],
            endDate: dateRange.start
        });
        const prevLogs = typeof prevLogsRaw === 'string' ? JSON.parse(prevLogsRaw) : (prevLogsRaw || []);

        const trendPercent = prevLogs.length > 0
            ? Math.round(((total - prevLogs.length) / prevLogs.length) * 100)
            : 0;

        // NEW V2 Metrics:
        // 1. Average per day (periodDays already calculated above, add 1 for inclusive counting)
        const totalPeriodDays = periodDays + 1; // Include both start and end dates
        const avgPerDay = totalPeriodDays > 0 ? parseFloat((total / totalPeriodDays).toFixed(1)) : 0;

        // 2. Compliance rate (% of days with at least 1 inspection)
        const daysWithActivity = {};
        scatterData.forEach(d => {
            daysWithActivity[d.date] = true;
        });
        const activeDays = Object.keys(daysWithActivity).length;
        const complianceRate = totalPeriodDays > 0 ? Math.min(100, Math.round((activeDays / totalPeriodDays) * 100)) : 0;

        // 3. Most active shift
        const shiftCounts = { 1: 0, 2: 0, 3: 0 };
        scatterData.forEach(d => {
            if (d.shift && shiftCounts[d.shift] !== undefined) {
                shiftCounts[d.shift]++;
            }
        });

        let mostActiveShift = 1;
        let maxShiftCount = shiftCounts[1];
        for (let s = 2; s <= 3; s++) {
            if (shiftCounts[s] > maxShiftCount) {
                maxShiftCount = shiftCounts[s];
                mostActiveShift = s;
            }
        }

        return {
            total,
            avgScore,
            passRate,
            trend: trendPercent,
            scatterData,
            // New V2 metrics
            avgPerDay,
            periodDays: totalPeriodDays,
            complianceRate,
            activeDays,
            mostActiveShift,
            shiftCounts
        };
    } catch (e) {
        Logger.log('getInspectionPerformance error: ' + e.toString());
        return {
            total: 0, avgScore: 0, passRate: 0, trend: 0, scatterData: [],
            avgPerDay: 0, periodDays: 0, complianceRate: 0, activeDays: 0, mostActiveShift: 1, shiftCounts: { 1: 0, 2: 0, 3: 0 }
        };
    }
}

// ===========================================
// 2. GUARD PERFORMANCE
// ===========================================

/**
 * Get guard performance metrics
 * @param {Object} dateRange - { start: string, end: string }
 * @param {string} shiftFilter - 'morning', 'evening', 'night', or '' for all
 * @returns {Object} { activeGuards, onTimeRate, avgScansPerDay, topPerformers }
 */
function getGuardPerformance(dateRange, shiftFilter) {
    try {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);

        // Get active guards
        const guards = getGuards({ status: 'active' });

        // Get scans in date range
        const scansSheet = ss.getSheetByName(SHEET_SCANS);
        if (!scansSheet) {
            return { activeGuards: guards.length, onTimeRate: 0, avgScansPerDay: 0, topPerformers: [] };
        }

        const scansData = scansSheet.getDataRange().getValues();
        if (scansData.length < 2) {
            return { activeGuards: guards.length, onTimeRate: 0, avgScansPerDay: 0, topPerformers: [] };
        }

        const headers = scansData[0];
        const timestampIdx = headers.indexOf('timestamp');
        const statusIdx = headers.indexOf('status');
        const guardIdIdx = headers.indexOf('guardId');

        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59);

        // Filter scans by date and shift
        const scans = scansData.slice(1).filter(row => {
            const ts = new Date(row[timestampIdx]);
            if (isNaN(ts.getTime())) return false;
            if (ts < startDate || ts > endDate) return false;

            // Apply shift filter
            if (shiftFilter && shiftFilter !== 'all') {
                const hour = ts.getHours();
                if (shiftFilter === 'morning' && (hour < 6 || hour >= 14)) return false;
                if (shiftFilter === 'evening' && (hour < 14 || hour >= 22)) return false;
                if (shiftFilter === 'night' && (hour >= 6 && hour < 22)) return false;
            }

            return true;
        });

        const totalScans = scans.length;
        const onTimeScans = scans.filter(s => s[statusIdx] === 'on_time').length;
        const onTimeRate = totalScans > 0 ? Math.round((onTimeScans / totalScans) * 100) : 0;

        // Calculate avg scans per day
        const daysInRange = Math.max(1, Math.ceil((endDate - startDate) / 86400000));
        const avgScansPerDay = Math.round(totalScans / daysInRange);

        // Calculate top performers (by on-time rate)
        const guardScans = {};
        scans.forEach(s => {
            const gid = s[guardIdIdx];
            if (!guardScans[gid]) guardScans[gid] = { total: 0, onTime: 0 };
            guardScans[gid].total++;
            if (s[statusIdx] === 'on_time') guardScans[gid].onTime++;
        });

        // Build guard name lookup
        const guardNameMap = {};
        guards.forEach(g => { guardNameMap[g.id] = g.name + ' ' + (g.surname || ''); });

        const rankings = Object.entries(guardScans)
            .filter(([gid, stats]) => stats.total >= 5) // Minimum 5 scans to qualify
            .map(([gid, stats]) => ({
                guardId: gid,
                name: guardNameMap[gid] || gid,
                onTimeRate: Math.round((stats.onTime / stats.total) * 100),
                totalScans: stats.total
            }))
            .sort((a, b) => b.onTimeRate - a.onTimeRate || b.totalScans - a.totalScans)
            .slice(0, 3);

        return {
            activeGuards: guards.length,
            onTimeRate,
            avgScansPerDay,
            topPerformers: rankings
        };
    } catch (e) {
        Logger.log('getGuardPerformance error: ' + e.toString());
        return { activeGuards: 0, onTimeRate: 0, avgScansPerDay: 0, topPerformers: [] };
    }
}

// ===========================================
// 3. SITE PERFORMANCE
// ===========================================

/**
 * Get site coverage and performance metrics
 * @param {Object} dateRange - { start: string, end: string }
 * @param {string} routeFilter - 'A', 'B', or '' for all
 * @returns {Object} { totalSites, visitedSites, coverageGap, coveragePercent, uncovered }
 */
function getSitePerformance(dateRange, routeFilter) {
    try {
        // Get all sites
        const allSites = getSites({
            status: 'active',
            route: routeFilter === 'all' ? '' : routeFilter
        });

        // Get inspection logs in date range (returns JSON string)
        const logsRaw = getInspectionLogs({
            startDate: dateRange.start,
            endDate: dateRange.end
        });
        const logs = typeof logsRaw === 'string' ? JSON.parse(logsRaw) : (logsRaw || []);

        // Get unique visited site names
        const visitedSiteNames = [...new Set(logs.map(l => (l.siteName || '').toLowerCase().trim()))];

        // Find uncovered sites
        const uncoveredSites = allSites.filter(s => {
            const siteName = (s.nameEN || s.name || '').toLowerCase().trim();
            return !visitedSiteNames.includes(siteName);
        });

        const totalSites = allSites.length;
        const visitedCount = totalSites - uncoveredSites.length;

        return {
            totalSites,
            visitedSites: visitedCount,
            coverageGap: uncoveredSites.length,
            coveragePercent: totalSites > 0 ? Math.round((visitedCount / totalSites) * 100) : 0,
            uncovered: uncoveredSites.slice(0, 10).map(s => ({
                id: s.id,
                name: s.nameEN || s.name,
                route: s.route || ''
            }))
        };
    } catch (e) {
        Logger.log('getSitePerformance error: ' + e.toString());
        return { totalSites: 0, visitedSites: 0, coverageGap: 0, coveragePercent: 0, uncovered: [] };
    }
}

// ===========================================
// 4. ISSUE PERFORMANCE
// ===========================================

/**
 * Get issue tracking metrics
 * @param {Object} dateRange - { start: string, end: string }
 * @param {string} typeFilter - 'incidents', 'complaints', or '' for all
 * @returns {Object} { openIssues, slaMet, avgResolutionHours, recent, trend }
 */
function getIssuePerformance(dateRange, typeFilter) {
    try {
        let incidents = [];
        let complaints = [];

        if (typeFilter !== 'complaints') {
            const result = getIncidents({ startDate: dateRange.start, endDate: dateRange.end });
            // getIncidents returns { incidents: [], stats: {} }
            incidents = result.incidents || [];
        }

        if (typeFilter !== 'incidents') {
            const result = getComplaints({ startDate: dateRange.start, endDate: dateRange.end });
            // getComplaints returns { complaints: [], stats: {} }
            complaints = result.complaints || [];
        }

        const all = [...incidents.map(i => ({ ...i, issueType: 'incident' })),
        ...complaints.map(c => ({ ...c, issueType: 'complaint' }))];

        // Open issues
        const openIssues = all.filter(i =>
            i.status === 'waiting' || i.status === 'in_progress'
        ).length;

        // Resolved issues
        const resolved = all.filter(i => i.status === 'completed');

        // SLA met calculation
        const slaMet = resolved.filter(i => {
            if (!i.dueDate || !i.resolvedAt) return true; // No SLA defined = assume met
            return new Date(i.resolvedAt) <= new Date(i.dueDate);
        }).length;

        const slaPercent = resolved.length > 0 ? Math.round((slaMet / resolved.length) * 100) : 100;

        // Average resolution time (in hours)
        const resolutionTimes = resolved.map(i => {
            const created = new Date(i.createdAt || i.reportDate);
            const resolvedAt = new Date(i.resolvedAt);
            if (isNaN(created.getTime()) || isNaN(resolvedAt.getTime())) return null;
            return (resolvedAt - created) / 3600000; // hours
        }).filter(t => t !== null && t >= 0);

        const avgResolution = resolutionTimes.length > 0
            ? Math.round((resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length) * 10) / 10
            : 0;

        // Recent issues (for timeline)
        const recent = all
            .sort((a, b) => new Date(b.createdAt || b.reportDate) - new Date(a.createdAt || a.reportDate))
            .slice(0, 5)
            .map(i => ({
                id: i.id,
                type: i.issueType,
                severity: i.severity,
                description: (i.description || '').substring(0, 100),
                status: i.status,
                createdAt: i.createdAt || i.reportDate
            }));

        // 7-day trend
        const trend = calculate7DayTrend_(all);

        return {
            openIssues,
            slaMet: slaPercent,
            avgResolutionHours: avgResolution,
            recent,
            trend
        };
    } catch (e) {
        Logger.log('getIssuePerformance error: ' + e.toString());
        return { openIssues: 0, slaMet: 100, avgResolutionHours: 0, recent: [], trend: [] };
    }
}

/**
 * Calculate 7-day issue trend
 * @private
 */
function calculate7DayTrend_(issues) {
    const trend = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dayStr = date.toISOString().split('T')[0];

        const count = issues.filter(issue => {
            const created = new Date(issue.createdAt || issue.reportDate);
            return created.toISOString().split('T')[0] === dayStr;
        }).length;

        trend.push({
            date: dayStr,
            day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()],
            count
        });
    }

    return trend;
}

// ===========================================
// 5. HANDOVER METRICS
// ===========================================

/**
 * Get handover quality metrics
 * @param {Object} dateRange - { start: string, end: string }
 * @returns {Object} { totalEntries, avgPerDay, completenessRate }
 */
function getHandoverMetrics(dateRange) {
    try {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        const sheet = ss.getSheetByName(SHEET_HANDOVER_RECORDS);

        if (!sheet) {
            return { totalEntries: 0, avgPerDay: 0, completenessRate: 0 };
        }

        const data = sheet.getDataRange().getValues();
        if (data.length < 2) {
            return { totalEntries: 0, avgPerDay: 0, completenessRate: 0 };
        }

        const headers = data[0];
        const timestampIdx = headers.indexOf('timestamp');
        const commentIdx = headers.indexOf('comment');

        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59);

        const entries = data.slice(1).filter(row => {
            const ts = new Date(row[timestampIdx]);
            return !isNaN(ts.getTime()) && ts >= startDate && ts <= endDate;
        });

        const totalEntries = entries.length;
        const daysInRange = Math.max(1, Math.ceil((endDate - startDate) / 86400000));
        const avgPerDay = Math.round((totalEntries / daysInRange) * 10) / 10;

        // Completeness: entries with non-empty comments
        const withComments = entries.filter(row =>
            row[commentIdx] && String(row[commentIdx]).trim().length > 10
        ).length;

        const completenessRate = totalEntries > 0 ? Math.round((withComments / totalEntries) * 100) : 0;

        return {
            totalEntries,
            avgPerDay,
            completenessRate
        };
    } catch (e) {
        Logger.log('getHandoverMetrics error: ' + e.toString());
        return { totalEntries: 0, avgPerDay: 0, completenessRate: 0 };
    }
}

// ===========================================
// 6. SPECIAL DUTY METRICS
// ===========================================

/**
 * Get special duty (stationary/onboarding) metrics
 * @param {Object} dateRange - { start: string, end: string }
 * @returns {Object} { stationaryCount, onboardingCount, totalHours, byType }
 */
function getSpecialDutyMetrics(dateRange) {
    try {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        const sheet = ss.getSheetByName(SHEET_SPECIAL_ACTIVITY);

        if (!sheet) {
            return { stationaryCount: 0, onboardingCount: 0, totalHours: 0, byType: [] };
        }

        const data = sheet.getDataRange().getValues();
        if (data.length < 2) {
            return { stationaryCount: 0, onboardingCount: 0, totalHours: 0, byType: [] };
        }

        const headers = data[0];
        const timestampIdx = headers.indexOf('timestamp');
        const typeIdx = headers.indexOf('type');
        const durationIdx = headers.indexOf('duration');

        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59);

        const activities = data.slice(1).filter(row => {
            const ts = new Date(row[timestampIdx]);
            return !isNaN(ts.getTime()) && ts >= startDate && ts <= endDate;
        });

        const stationary = activities.filter(a => String(a[typeIdx]).toLowerCase() === 'stationary');
        const onboarding = activities.filter(a => String(a[typeIdx]).toLowerCase() === 'onboarding');

        // Calculate total hours
        let totalMinutes = 0;
        activities.forEach(a => {
            const dur = parseInt(a[durationIdx]) || 0;
            totalMinutes += dur;
        });

        return {
            stationaryCount: stationary.length,
            onboardingCount: onboarding.length,
            totalHours: Math.round((totalMinutes / 60) * 10) / 10,
            byType: [
                { type: 'Stationary', count: stationary.length },
                { type: 'Onboarding', count: onboarding.length }
            ]
        };
    } catch (e) {
        Logger.log('getSpecialDutyMetrics error: ' + e.toString());
        return { stationaryCount: 0, onboardingCount: 0, totalHours: 0, byType: [] };
    }
}

// ===========================================
// 7. SCATTER DATA (Combined)
// ===========================================

/**
 * Get scatter chart data combining inspections and special activities
 * @param {Object} dateRange - { start: string, end: string }
 * @param {string} activityType - 'all', 'regular', 'Stationary', 'Onboarding'
 * @returns {Array} Scatter data points
 */
function getScatterData(dateRange, activityType) {
    try {
        const points = [];

        // Get inspection logs
        if (activityType === 'all' || activityType === 'regular') {
            // getInspectionLogs returns JSON string
            const logsRaw = getInspectionLogs({
                startDate: dateRange.start,
                endDate: dateRange.end
            });
            const logs = typeof logsRaw === 'string' ? JSON.parse(logsRaw) : (logsRaw || []);

            logs.forEach(l => {
                const ts = new Date(l.timestamp);
                if (isNaN(ts.getTime())) return;

                const hour = ts.getHours();
                let shift = 1; // Morning (06-14)
                if (hour >= 14 && hour < 22) shift = 2; // Evening
                if (hour >= 22 || hour < 6) shift = 3; // Night

                points.push({
                    date: ts.toISOString().split('T')[0],
                    time: ts.getHours() + (ts.getMinutes() / 60),
                    hour: ts.getHours(),
                    minute: ts.getMinutes(),
                    shift,
                    type: 'regular',
                    siteName: l.siteName || '',
                    inspector: l.inspectorName || ''
                });
            });
        }

        // Get special activities
        if (activityType === 'all' || activityType === 'Stationary' || activityType === 'Onboarding') {
            const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
            const sheet = ss.getSheetByName(SHEET_SPECIAL_ACTIVITY);

            if (sheet) {
                const data = sheet.getDataRange().getValues();
                if (data.length >= 2) {
                    const headers = data[0];
                    const timestampIdx = headers.indexOf('timestamp');
                    const typeIdx = headers.indexOf('type');
                    const siteIdx = headers.indexOf('siteName');
                    const patrolIdx = headers.indexOf('patrolName');

                    const startDate = new Date(dateRange.start);
                    const endDate = new Date(dateRange.end);
                    endDate.setHours(23, 59, 59);

                    data.slice(1).forEach(row => {
                        const ts = new Date(row[timestampIdx]);
                        if (isNaN(ts.getTime()) || ts < startDate || ts > endDate) return;

                        const type = String(row[typeIdx] || '');
                        if (activityType !== 'all' && activityType.toLowerCase() !== type.toLowerCase()) return;

                        const hour = ts.getHours();
                        let shift = 1;
                        if (hour >= 14 && hour < 22) shift = 2;
                        if (hour >= 22 || hour < 6) shift = 3;

                        points.push({
                            date: ts.toISOString().split('T')[0],
                            time: ts.getHours() + (ts.getMinutes() / 60),
                            hour: ts.getHours(),
                            minute: ts.getMinutes(),
                            shift,
                            type: type.toLowerCase(),
                            siteName: row[siteIdx] || '',
                            inspector: row[patrolIdx] || ''
                        });
                    });
                }
            }
        }

        return points;
    } catch (e) {
        Logger.log('getScatterData error: ' + e.toString());
        return [];
    }
}

// ===========================================
// HELPER: Get all performance data at once
// ===========================================

/**
 * Get all performance metrics in one call (for initial page load)
 * @param {Object} dateRange - { start: string, end: string }
 * @returns {Object} All performance data
 */
function getAllPerformanceData(dateRange) {
    try {
        // Default to current month if no date range
        if (!dateRange || !dateRange.start) {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            dateRange = {
                start: start.toISOString().split('T')[0],
                end: end.toISOString().split('T')[0]
            };
        }

        const inspectionData = getInspectionPerformance(dateRange, '');

        // Get combined scatter data including special activities
        const combinedScatterData = getScatterData(dateRange, 'all');

        return {
            inspections: inspectionData,
            guards: getGuardPerformance(dateRange, ''),
            sites: getSitePerformance(dateRange, ''),
            issues: getIssuePerformance(dateRange, ''),
            handovers: getHandoverMetrics(dateRange),
            specialDuties: getSpecialDutyMetrics(dateRange),
            // Combined scatter data with both inspections and special activities
            combinedScatterData: combinedScatterData,
            dateRange
        };
    } catch (e) {
        Logger.log('getAllPerformanceData error: ' + e.toString());
        return { error: e.toString() };
    }
}

// ===========================================
// 8. ROUTE INSPECTION COUNTS (Polar Area Chart)
// ===========================================

/**
 * Get inspection counts per site, grouped by route
 * Used for Polar Area Chart visualization
 * @param {Object} dateRange - { start: string, end: string }
 * @returns {Object} { routeA: [{siteName, count}], routeB: [{siteName, count}] }
 */
function getRouteInspectionCounts(dateRange) {
    try {
        // Get all active sites with route info
        const allSites = getSites({ status: 'active' });

        // Get inspection logs in date range
        const logsRaw = getInspectionLogs({
            startDate: dateRange.start,
            endDate: dateRange.end
        });
        const logs = typeof logsRaw === 'string' ? JSON.parse(logsRaw) : (logsRaw || []);

        // Create site name -> route lookup (case insensitive)
        const siteRouteMap = {};
        allSites.forEach(s => {
            const name = (s.nameEN || s.name || '').toLowerCase().trim();
            if (name) {
                siteRouteMap[name] = s.route || '';
            }
        });

        // Count inspections per site
        const siteCounts = {};
        logs.forEach(log => {
            const siteName = (log.siteName || '').toLowerCase().trim();
            if (!siteName) return;

            if (!siteCounts[siteName]) {
                siteCounts[siteName] = {
                    siteName: log.siteName || siteName, // Keep original casing for display
                    count: 0,
                    route: siteRouteMap[siteName] || ''
                };
            }
            siteCounts[siteName].count++;
        });

        // Also add sites with 0 inspections from master list
        allSites.forEach(s => {
            const name = (s.nameEN || s.name || '').toLowerCase().trim();
            if (name && !siteCounts[name]) {
                siteCounts[name] = {
                    siteName: s.nameEN || s.name,
                    count: 0,
                    route: s.route || ''
                };
            }
        });

        // Split by route, sort by count descending
        const routeA = [];
        const routeB = [];

        Object.values(siteCounts).forEach(site => {
            if (site.route === 'A') {
                routeA.push({ siteName: site.siteName, count: site.count });
            } else if (site.route === 'B') {
                routeB.push({ siteName: site.siteName, count: site.count });
            }
            // Sites without route are excluded from charts
        });

        // Sort by count descending for better visual impact
        routeA.sort((a, b) => b.count - a.count);
        routeB.sort((a, b) => b.count - a.count);

        return {
            routeA,
            routeB,
            routeATotal: routeA.reduce((sum, s) => sum + s.count, 0),
            routeBTotal: routeB.reduce((sum, s) => sum + s.count, 0)
        };
    } catch (e) {
        Logger.log('getRouteInspectionCounts error: ' + e.toString());
        return { routeA: [], routeB: [], routeATotal: 0, routeBTotal: 0 };
    }
}
