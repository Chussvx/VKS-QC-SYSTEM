/**
 * Gemini.js - AI Analytics with Structured Visual Output
 * 
 * Returns InsightCard JSON arrays + bundled reference data.
 * Frontend renders cards with clickable references that expand
 * to show actual source records (scans, incidents, sites, guards).
 * 
 * Features:
 * 1. Daily Briefing - Operational summary with references
 * 2. Deep Analysis - On-demand topic analysis (patrols/inspections/incidents/sites)
 * 3. Risk Patterns - Weekly pattern detection across incidents
 */

// ===========================================
// CORE API UTILITY
// ===========================================

/**
 * Call Gemini API
 * @param {string} prompt
 * @param {Object} options - { temperature, maxTokens }
 * @returns {string|null}
 */
function callGemini(prompt, options) {
    options = options || {};
    var temperature = options.temperature || 0.7;
    var maxTokens = options.maxTokens || 2048;

    var url = GEMINI_ENDPOINT + GEMINI_MODEL + ':generateContent?key=' + GEMINI_API_KEY;

    var payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: temperature,
            maxOutputTokens: maxTokens,
            responseMimeType: 'application/json'
        }
    };

    try {
        var response = UrlFetchApp.fetch(url, {
            method: 'post',
            contentType: 'application/json',
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        });
        var code = response.getResponseCode();
        var body = JSON.parse(response.getContentText());

        if (code !== 200) {
            Logger.log('Gemini API error (' + code + '): ' + JSON.stringify(body));
            return null;
        }

        if (body.candidates && body.candidates.length > 0) {
            var parts = body.candidates[0].content.parts;
            if (parts && parts.length > 0) return parts[0].text;
        }
        Logger.log('Gemini returned no candidates');
        return null;
    } catch (e) {
        Logger.log('Gemini fetch error: ' + e.message);
        return null;
    }
}

/**
 * Parse Gemini response as JSON — strips code fences if present
 * @param {string} raw
 * @returns {Object|null}
 */
function parseGeminiJSON_(raw) {
    if (!raw) return null;
    try {
        // Strip markdown code fences
        var cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        return JSON.parse(cleaned);
    } catch (e) {
        Logger.log('parseGeminiJSON_ failed: ' + e.message + ' | Raw: ' + raw.substring(0, 200));
        return null;
    }
}

// ===========================================
// INSIGHT CARD PROMPT SCHEMA
// ===========================================

var INSIGHT_SCHEMA_INSTRUCTIONS = ''
    + 'RESPONSE FORMAT: Return a JSON array of insight objects. Each object must have:\n'
    + '- "icon": emoji (🛡️ ⚠️ 📈 📉 🔴 💡 ✅ 🏢 👤 📋)\n'
    + '- "title": short English title (max 10 words)\n'
    + '- "titleLo": same title in Lao language\n'
    + '- "detail": 1-2 sentence English explanation with specific numbers & names\n'
    + '- "detailLo": same explanation in Lao language\n'
    + '- "trend": "improving" or "declining" or "stable"\n'
    + '- "severity": "good" or "warning" or "critical"\n'
    + '- "metrics": array of {"label":"...", "value":"...", "delta":"..."} (delta optional)\n'
    + '- "refKeys": array of reference key strings that appear in this insight. Use the EXACT ref keys provided in AVAILABLE REFERENCES section below.\n\n'
    + 'RULES:\n'
    + '- Return ONLY valid JSON array. No text before or after.\n'
    + '- Be specific with numbers and site names — don\'t generalize.\n'
    + '- If data looks healthy, say so with severity "good" — don\'t invent problems.\n'
    + '- Include 3-5 insight objects.\n';

// ===========================================
// 1. DAILY BRIEFING
// ===========================================

/**
 * Generate daily briefing with structured output + references
 * Designed for time trigger at 06:00 AM
 * @returns {Object} { success, insights[], references{} }
 */
function generateDailyBriefing() {
    try {
        var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        var yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        var yesterdayStr = Utilities.formatDate(yesterday, 'Asia/Vientiane', 'yyyy-MM-dd');
        var todayStr = Utilities.formatDate(new Date(), 'Asia/Vientiane', 'yyyy-MM-dd');

        // --- Collect data + build references ---
        var refs = {};
        var summary = { date: yesterdayStr, scans: {}, incidents: {}, complaints: {}, handovers: {}, inspections: {}, sites: {} };

        // 1. Scans
        var lateScans = [];
        var scanStats = { total: 0, onTime: 0, late: 0 };
        var scansSheet = ss.getSheetByName(SHEET_SCANS);
        if (scansSheet && scansSheet.getLastRow() > 1) {
            var scansData = scansSheet.getDataRange().getValues();
            var sH = scansData[0];
            var sitesByScans = {};

            for (var i = scansData.length - 1; i >= 1; i--) {
                var scanDate = scansData[i][sH.indexOf('timestamp')];
                if (!scanDate) continue;
                var scanStr = Utilities.formatDate(new Date(scanDate), 'Asia/Vientiane', 'yyyy-MM-dd');
                if (scanStr < yesterdayStr) break;
                if (scanStr === yesterdayStr) {
                    scanStats.total++;
                    var status = (scansData[i][sH.indexOf('status')] || '').toString().toLowerCase();
                    if (status === 'on_time') scanStats.onTime++;
                    if (status === 'late') {
                        scanStats.late++;
                        var siteId = (scansData[i][sH.indexOf('siteId')] || '').toString();
                        sitesByScans[siteId] = (sitesByScans[siteId] || 0) + 1;
                        if (lateScans.length < 10) {
                            lateScans.push({
                                guard: (scansData[i][sH.indexOf('guardId')] || 'Unknown').toString(),
                                time: Utilities.formatDate(new Date(scanDate), 'Asia/Vientiane', 'HH:mm'),
                                site: siteId,
                                checkpoint: (scansData[i][sH.indexOf('checkpointId')] || '').toString()
                            });
                        }
                    }
                }
            }
            summary.scans = scanStats;

            // Build late scans reference
            if (lateScans.length > 0) {
                refs['scans:late'] = {
                    type: 'table',
                    label: scanStats.late + ' Late Scans',
                    columns: ['Guard', 'Time', 'Site', 'Checkpoint'],
                    rows: lateScans.map(function (s) { return [s.guard, s.time, s.site, s.checkpoint]; }),
                    nav: { page: 'patrol-status' }
                };
            }
        }

        // 2. Incidents
        var incidentList = [];
        var incStats = { total: 0, critical: 0, resolved: 0, categories: {} };
        var incSheet = ss.getSheetByName(SHEET_INCIDENTS);
        if (incSheet && incSheet.getLastRow() > 1) {
            var incData = incSheet.getDataRange().getValues();
            var iH = incData[0];

            for (var j = 1; j < incData.length; j++) {
                var incDate = incData[j][iH.indexOf('createdAt')];
                if (!incDate) continue;
                var incStr = Utilities.formatDate(new Date(incDate), 'Asia/Vientiane', 'yyyy-MM-dd');
                if (incStr === yesterdayStr) {
                    incStats.total++;
                    var sev = (incData[j][iH.indexOf('severity')] || '').toString().toLowerCase();
                    if (sev === 'critical' || sev === 'high') incStats.critical++;
                    var incSt = (incData[j][iH.indexOf('status')] || '').toString().toLowerCase();
                    if (incSt === 'completed' || incSt === 'resolved') incStats.resolved++;
                    var cat = (incData[j][iH.indexOf('category')] || 'Other').toString();
                    incStats.categories[cat] = (incStats.categories[cat] || 0) + 1;

                    if (incidentList.length < 10) {
                        incidentList.push({
                            title: (incData[j][iH.indexOf('title')] || '').toString(),
                            severity: sev,
                            category: cat,
                            site: (incData[j][iH.indexOf('location')] || incData[j][iH.indexOf('siteId')] || '').toString(),
                            status: incSt,
                            time: Utilities.formatDate(new Date(incDate), 'Asia/Vientiane', 'HH:mm')
                        });
                    }
                }
            }
            summary.incidents = incStats;

            if (incidentList.length > 0) {
                refs['incidents:yesterday'] = {
                    type: 'table',
                    label: incStats.total + ' Incidents',
                    columns: ['Title', 'Severity', 'Category', 'Site', 'Status', 'Time'],
                    rows: incidentList.map(function (inc) {
                        return [inc.title, inc.severity, inc.category, inc.site, inc.status, inc.time];
                    }),
                    nav: { page: 'incidents' }
                };
            }
        }

        // 3. Complaints
        var cmpStats = { total: 0, resolved: 0 };
        var cmpSheet = ss.getSheetByName(SHEET_COMPLAINTS);
        if (cmpSheet && cmpSheet.getLastRow() > 1) {
            var cmpData = cmpSheet.getDataRange().getValues();
            var cH = cmpData[0];
            for (var k = 1; k < cmpData.length; k++) {
                var cmpDate = cmpData[k][cH.indexOf('createdAt')];
                if (!cmpDate) continue;
                var cmpStr = Utilities.formatDate(new Date(cmpDate), 'Asia/Vientiane', 'yyyy-MM-dd');
                if (cmpStr === yesterdayStr) {
                    cmpStats.total++;
                    var cmpSt = (cmpData[k][cH.indexOf('status')] || '').toString().toLowerCase();
                    if (cmpSt === 'completed' || cmpSt === 'resolved') cmpStats.resolved++;
                }
            }
        }
        summary.complaints = cmpStats;

        // 4. Handovers
        var hoStats = { total: 0 };
        var hoSheet = ss.getSheetByName(SHEET_HANDOVER_RECORDS);
        if (hoSheet && hoSheet.getLastRow() > 1) {
            var hoData = hoSheet.getDataRange().getValues();
            var hH = hoData[0];
            for (var m = hoData.length - 1; m >= 1; m--) {
                var hoDate = hoData[m][hH.indexOf('timestamp')];
                if (!hoDate) continue;
                var hoStr = Utilities.formatDate(new Date(hoDate), 'Asia/Vientiane', 'yyyy-MM-dd');
                if (hoStr < yesterdayStr) break;
                if (hoStr === yesterdayStr) hoStats.total++;
            }
        }
        summary.handovers = hoStats;

        // 5. Inspections
        var insStats = { total: 0, avgScore: 0 };
        var insSheet = ss.getSheetByName(SHEET_INSPECTION_LOGS);
        if (insSheet && insSheet.getLastRow() > 1) {
            var insData = insSheet.getDataRange().getValues();
            var inH = insData[0];
            var scoreSum = 0, scoreCount = 0;
            for (var n = insData.length - 1; n >= 1; n--) {
                var insDate = insData[n][inH.indexOf('timestamp')];
                if (!insDate) continue;
                var insStr = Utilities.formatDate(new Date(insDate), 'Asia/Vientiane', 'yyyy-MM-dd');
                if (insStr < yesterdayStr) break;
                if (insStr === yesterdayStr) {
                    insStats.total++;
                    var score = parseFloat(insData[n][inH.indexOf('score')]);
                    if (!isNaN(score)) { scoreSum += score; scoreCount++; }
                }
            }
            if (scoreCount > 0) insStats.avgScore = (scoreSum / scoreCount).toFixed(1);
        }
        summary.inspections = insStats;

        // 6. Active sites
        var siteCount = 0;
        var sitesSheet = ss.getSheetByName(SHEET_SITES);
        if (sitesSheet && sitesSheet.getLastRow() > 1) {
            var sitesData = sitesSheet.getDataRange().getValues();
            var stH = sitesData[0];
            for (var p = 1; p < sitesData.length; p++) {
                if ((sitesData[p][stH.indexOf('status')] || '').toString().toLowerCase() === 'active') siteCount++;
            }
        }
        summary.sites = { active: siteCount };

        // Build available ref keys list for prompt
        var refKeysList = Object.keys(refs).map(function (k) { return '"' + k + '"'; }).join(', ');

        // --- Build prompt ---
        var onTimeRate = scanStats.total > 0 ? Math.round((scanStats.onTime / scanStats.total) * 100) : 100;
        var catList = Object.keys(incStats.categories).map(function (c) { return c + ': ' + incStats.categories[c]; }).join(', ');

        var prompt = 'You are a VKS Security operations analyst. Generate a structured daily briefing from ' + yesterdayStr + '.\n\n'
            + 'OPERATIONAL DATA:\n'
            + '- Active Sites: ' + siteCount + '\n'
            + '- Scans: ' + scanStats.total + ' total (On-time: ' + scanStats.onTime + ', Late: ' + scanStats.late + ', Rate: ' + onTimeRate + '%)\n'
            + '- Incidents: ' + incStats.total + ' new (' + incStats.critical + ' critical/high), ' + incStats.resolved + ' resolved' + (catList ? ', Types: ' + catList : '') + '\n'
            + '- Complaints: ' + cmpStats.total + ' new, ' + cmpStats.resolved + ' resolved\n'
            + '- Handovers: ' + hoStats.total + ' recorded\n'
            + '- Inspections: ' + insStats.total + ' completed, Avg Score: ' + (insStats.avgScore || 'N/A') + '/10\n\n'
            + 'AVAILABLE REFERENCES (use these exact keys in refKeys):\n'
            + (refKeysList || 'None') + '\n\n'
            + INSIGHT_SCHEMA_INSTRUCTIONS;

        var aiText = callGemini(prompt, { temperature: 0.5, maxTokens: 1500 });
        var insights = parseGeminiJSON_(aiText);

        if (!insights || !Array.isArray(insights)) {
            Logger.log('Gemini briefing parse failed. Raw: ' + (aiText || 'null').substring(0, 300));
            return { success: false, error: 'AI response parsing failed' };
        }

        // Store result
        var result = { insights: insights, references: refs };
        saveBriefing_('daily', todayStr, JSON.stringify(result), JSON.stringify(summary));

        Logger.log('Daily briefing generated: ' + insights.length + ' insights');
        return { success: true, insights: insights, references: refs, date: yesterdayStr };

    } catch (e) {
        Logger.log('generateDailyBriefing error: ' + e.message);
        return { success: false, error: e.message };
    }
}

// ===========================================
// 2. DEEP ANALYSIS (On-Demand by Topic)
// ===========================================

/**
 * Analyze a specific performance topic with structured output
 * Called on-demand from the AI Analysis tab
 * @param {string} topic - 'patrols' | 'inspections' | 'incidents' | 'sites'
 * @returns {Object} { success, insights[], references{} }
 */
function analyzePerformanceTopic(topic) {
    try {
        if (!topic) return { success: false, error: 'No topic provided' };

        // Check cache (5 min)
        var cacheKey = 'ai_topic_' + topic;
        var cache = CacheService.getScriptCache();
        var cached = cache.get(cacheKey);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) { /* cache parse failed, regenerate */ }
        }

        var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        var today = new Date();
        var thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
        var refs = {};
        var dataContext = '';

        // --- Topic-specific data collection ---
        if (topic === 'patrols') {
            var scanSheet = ss.getSheetByName(SHEET_SCANS);
            if (scanSheet && scanSheet.getLastRow() > 1) {
                var sData = scanSheet.getDataRange().getValues();
                var sH = sData[0];
                var stats = { total: 0, onTime: 0, late: 0, bySite: {}, byDay: {} };
                var latestLate = [];

                for (var i = sData.length - 1; i >= 1; i--) {
                    var ts = sData[i][sH.indexOf('timestamp')];
                    if (!ts || new Date(ts) < thirtyDaysAgo) break;
                    stats.total++;
                    var st = (sData[i][sH.indexOf('status')] || '').toString().toLowerCase();
                    if (st === 'on_time') stats.onTime++;
                    if (st === 'late') {
                        stats.late++;
                        var sid = (sData[i][sH.indexOf('siteId')] || 'Unknown').toString();
                        stats.bySite[sid] = (stats.bySite[sid] || 0) + 1;
                        if (latestLate.length < 15) {
                            latestLate.push([
                                (sData[i][sH.indexOf('guardId')] || '').toString(),
                                Utilities.formatDate(new Date(ts), 'Asia/Vientiane', 'yyyy-MM-dd HH:mm'),
                                sid,
                                (sData[i][sH.indexOf('checkpointId')] || '').toString()
                            ]);
                        }
                    }
                    var day = Utilities.formatDate(new Date(ts), 'Asia/Vientiane', 'yyyy-MM-dd');
                    stats.byDay[day] = (stats.byDay[day] || 0) + 1;
                }

                var rate = stats.total > 0 ? Math.round((stats.onTime / stats.total) * 100) : 100;
                dataContext = 'PATROL DATA (30 days):\n'
                    + '- Total scans: ' + stats.total + '\n'
                    + '- On-time: ' + stats.onTime + ' (' + rate + '%)\n'
                    + '- Late: ' + stats.late + '\n'
                    + '- Late by site: ' + JSON.stringify(stats.bySite) + '\n';

                if (latestLate.length > 0) {
                    refs['scans:recent_late'] = {
                        type: 'table', label: 'Recent Late Scans',
                        columns: ['Guard', 'Date/Time', 'Site', 'Checkpoint'],
                        rows: latestLate,
                        nav: { page: 'patrol-status' }
                    };
                }

                // Top problematic sites reference
                var sortedSites = Object.keys(stats.bySite).sort(function (a, b) { return stats.bySite[b] - stats.bySite[a]; });
                if (sortedSites.length > 0) {
                    refs['sites:late_ranking'] = {
                        type: 'table', label: 'Sites by Late Count',
                        columns: ['Site', 'Late Scans'],
                        rows: sortedSites.slice(0, 10).map(function (s) { return [s, stats.bySite[s].toString()]; }),
                        nav: { page: 'sites' }
                    };
                }
            }

        } else if (topic === 'inspections') {
            var insSheet = ss.getSheetByName(SHEET_INSPECTION_LOGS);
            if (insSheet && insSheet.getLastRow() > 1) {
                var inData = insSheet.getDataRange().getValues();
                var inH = inData[0];
                var inspRecords = [];
                var bySite = {}, byRoute = {};

                for (var j = inData.length - 1; j >= 1; j--) {
                    var inTs = inData[j][inH.indexOf('timestamp')];
                    if (!inTs || new Date(inTs) < thirtyDaysAgo) break;
                    var sc = parseFloat(inData[j][inH.indexOf('score')]) || 0;
                    var site = (inData[j][inH.indexOf('siteName')] || 'Unknown').toString();
                    var route = (inData[j][inH.indexOf('route')] || 'Unknown').toString();

                    bySite[site] = bySite[site] || { scores: [], count: 0 };
                    bySite[site].scores.push(sc);
                    bySite[site].count++;
                    byRoute[route] = (byRoute[route] || 0) + 1;

                    if (inspRecords.length < 15) {
                        inspRecords.push([
                            Utilities.formatDate(new Date(inTs), 'Asia/Vientiane', 'yyyy-MM-dd'),
                            site, route, sc.toFixed(1),
                            (inData[j][inH.indexOf('guardName')] || '').toString(),
                            (inData[j][inH.indexOf('status')] || '').toString()
                        ]);
                    }
                }

                // Build site averages
                var siteAvgs = Object.keys(bySite).map(function (s) {
                    var avg = bySite[s].scores.reduce(function (a, b) { return a + b; }, 0) / bySite[s].scores.length;
                    return [s, avg.toFixed(1), bySite[s].count.toString()];
                }).sort(function (a, b) { return parseFloat(a[1]) - parseFloat(b[1]); });

                dataContext = 'INSPECTION DATA (30 days):\n'
                    + '- Total inspections: ' + inspRecords.length + '+\n'
                    + '- Sites inspected: ' + Object.keys(bySite).length + '\n'
                    + '- Site averages (lowest first): ' + JSON.stringify(siteAvgs.slice(0, 5)) + '\n'
                    + '- Routes: ' + JSON.stringify(byRoute) + '\n';

                if (inspRecords.length > 0) {
                    refs['inspections:recent'] = {
                        type: 'table', label: 'Recent Inspections',
                        columns: ['Date', 'Site', 'Route', 'Score', 'Guard', 'Status'],
                        rows: inspRecords,
                        nav: { page: 'inspection-logs' }
                    };
                }
                if (siteAvgs.length > 0) {
                    refs['inspections:site_scores'] = {
                        type: 'table', label: 'Site Score Rankings',
                        columns: ['Site', 'Avg Score', 'Count'],
                        rows: siteAvgs,
                        nav: { page: 'performance' }
                    };
                }
            }

        } else if (topic === 'incidents') {
            var incSheet = ss.getSheetByName(SHEET_INCIDENTS);
            if (incSheet && incSheet.getLastRow() > 1) {
                var iData = incSheet.getDataRange().getValues();
                var iH = iData[0];
                var incRecords = [];
                var byCat = {}, bySev = {}, bySiteInc = {};

                for (var q = 1; q < iData.length; q++) {
                    var iTs = iData[q][iH.indexOf('createdAt')];
                    if (!iTs || new Date(iTs) < thirtyDaysAgo) continue;
                    var cat = (iData[q][iH.indexOf('category')] || 'Other').toString();
                    var sev2 = (iData[q][iH.indexOf('severity')] || 'medium').toString();
                    var loc = (iData[q][iH.indexOf('location')] || iData[q][iH.indexOf('siteId')] || 'Unknown').toString();
                    byCat[cat] = (byCat[cat] || 0) + 1;
                    bySev[sev2] = (bySev[sev2] || 0) + 1;
                    bySiteInc[loc] = (bySiteInc[loc] || 0) + 1;

                    if (incRecords.length < 15) {
                        incRecords.push([
                            Utilities.formatDate(new Date(iTs), 'Asia/Vientiane', 'yyyy-MM-dd'),
                            (iData[q][iH.indexOf('title')] || '').toString(),
                            cat, sev2, loc,
                            (iData[q][iH.indexOf('status')] || '').toString()
                        ]);
                    }
                }

                dataContext = 'INCIDENT DATA (30 days):\n'
                    + '- Total: ' + incRecords.length + '+\n'
                    + '- By category: ' + JSON.stringify(byCat) + '\n'
                    + '- By severity: ' + JSON.stringify(bySev) + '\n'
                    + '- By site: ' + JSON.stringify(bySiteInc) + '\n';

                if (incRecords.length > 0) {
                    refs['incidents:recent'] = {
                        type: 'table', label: 'Recent Incidents',
                        columns: ['Date', 'Title', 'Category', 'Severity', 'Location', 'Status'],
                        rows: incRecords,
                        nav: { page: 'incidents' }
                    };
                }
            }

        } else if (topic === 'sites') {
            var stSheet = ss.getSheetByName(SHEET_SITES);
            if (stSheet && stSheet.getLastRow() > 1) {
                var stData = stSheet.getDataRange().getValues();
                var stH = stData[0];
                var siteRecords = [];
                var activeCount = 0, inactiveCount = 0;

                for (var r = 1; r < stData.length; r++) {
                    var stStatus = (stData[r][stH.indexOf('status')] || '').toString().toLowerCase();
                    if (stStatus === 'active') activeCount++;
                    else inactiveCount++;
                    if (siteRecords.length < 20) {
                        siteRecords.push([
                            (stData[r][stH.indexOf('code')] || '').toString(),
                            (stData[r][stH.indexOf('nameEN')] || '').toString(),
                            (stData[r][stH.indexOf('type')] || '').toString(),
                            (stData[r][stH.indexOf('route')] || '').toString(),
                            stStatus
                        ]);
                    }
                }

                dataContext = 'SITES DATA:\n'
                    + '- Active: ' + activeCount + ', Inactive: ' + inactiveCount + '\n'
                    + '- Total: ' + (activeCount + inactiveCount) + '\n';

                if (siteRecords.length > 0) {
                    refs['sites:all'] = {
                        type: 'table', label: 'All Sites',
                        columns: ['Code', 'Name', 'Type', 'Route', 'Status'],
                        rows: siteRecords,
                        nav: { page: 'sites' }
                    };
                }
            }
        }

        if (!dataContext) {
            return { success: false, error: 'No data found for topic: ' + topic };
        }

        var refKeysList = Object.keys(refs).map(function (k) { return '"' + k + '"'; }).join(', ');

        var prompt = 'You are a VKS Security operations analyst analyzing ' + topic + ' performance.\n\n'
            + dataContext + '\n'
            + 'AVAILABLE REFERENCES (use these exact keys in refKeys):\n'
            + (refKeysList || 'None') + '\n\n'
            + INSIGHT_SCHEMA_INSTRUCTIONS;

        var aiText = callGemini(prompt, { temperature: 0.5, maxTokens: 1500 });
        var insights = parseGeminiJSON_(aiText);

        if (!insights || !Array.isArray(insights)) {
            return { success: false, error: 'AI response parsing failed', raw: (aiText || '').substring(0, 200) };
        }

        var result = { success: true, insights: insights, references: refs, topic: topic };

        // Cache for 5 minutes
        try {
            cache.put(cacheKey, JSON.stringify(result), 300);
        } catch (e) { /* cache too large, skip */ }

        return result;

    } catch (e) {
        Logger.log('analyzePerformanceTopic error: ' + e.message);
        return { success: false, error: e.message };
    }
}

// ===========================================
// 3. RISK PATTERNS (Weekly)
// ===========================================

/**
 * Weekly risk pattern analysis with structured output
 * Designed for time trigger on Monday 07:00 AM
 * @returns {Object} { success, insights[], references{} }
 */
function generateWeeklyPatterns() {
    try {
        var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        var today = new Date();
        var thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
        var todayStr = Utilities.formatDate(today, 'Asia/Vientiane', 'yyyy-MM-dd');
        var refs = {};

        // Collect incidents
        var incRecords = [];
        var incSheet = ss.getSheetByName(SHEET_INCIDENTS);
        if (incSheet && incSheet.getLastRow() > 1) {
            var iData = incSheet.getDataRange().getValues();
            var iH = iData[0];

            for (var i = 1; i < iData.length; i++) {
                var ts = iData[i][iH.indexOf('createdAt')] || iData[i][iH.indexOf('incidentTime')];
                if (ts && new Date(ts) >= thirtyDaysAgo) {
                    incRecords.push([
                        Utilities.formatDate(new Date(ts), 'Asia/Vientiane', 'yyyy-MM-dd HH:mm'),
                        (iData[i][iH.indexOf('title')] || '').toString(),
                        (iData[i][iH.indexOf('category')] || 'Unknown').toString(),
                        (iData[i][iH.indexOf('severity')] || 'medium').toString(),
                        (iData[i][iH.indexOf('location')] || iData[i][iH.indexOf('siteId')] || 'Unknown').toString(),
                        (iData[i][iH.indexOf('status')] || '').toString()
                    ]);
                }
            }
        }

        // Collect complaints
        var cmpRecords = [];
        var cmpSheet = ss.getSheetByName(SHEET_COMPLAINTS);
        if (cmpSheet && cmpSheet.getLastRow() > 1) {
            var cData = cmpSheet.getDataRange().getValues();
            var cH = cData[0];

            for (var j = 1; j < cData.length; j++) {
                var cTs = cData[j][cH.indexOf('createdAt')];
                if (cTs && new Date(cTs) >= thirtyDaysAgo) {
                    cmpRecords.push([
                        Utilities.formatDate(new Date(cTs), 'Asia/Vientiane', 'yyyy-MM-dd'),
                        (cData[j][cH.indexOf('category')] || 'Unknown').toString(),
                        (cData[j][cH.indexOf('severity')] || 'medium').toString(),
                        (cData[j][cH.indexOf('location')] || cData[j][cH.indexOf('siteId')] || 'Unknown').toString(),
                        (cData[j][cH.indexOf('status')] || '').toString()
                    ]);
                }
            }
        }

        if (incRecords.length === 0 && cmpRecords.length === 0) {
            var noDataResult = {
                insights: [{
                    icon: '✅', title: 'No Incidents in 30 Days', titleLo: 'ບໍ່ມີເຫດການໃນ 30 ວັນ',
                    detail: 'Operations appear stable with no incidents or complaints recorded.',
                    detailLo: 'ການດຳເນີນງານມີຄວາມສະຖຽນ',
                    trend: 'stable', severity: 'good', metrics: [], refKeys: []
                }],
                references: {}
            };
            saveBriefing_('patterns', todayStr, JSON.stringify(noDataResult), '{}');
            return { success: true, insights: noDataResult.insights, references: {} };
        }

        // Build references
        if (incRecords.length > 0) {
            refs['incidents:30day'] = {
                type: 'table', label: incRecords.length + ' Incidents (30d)',
                columns: ['Date', 'Title', 'Category', 'Severity', 'Location', 'Status'],
                rows: incRecords.slice(0, 20),
                nav: { page: 'incidents' }
            };
        }
        if (cmpRecords.length > 0) {
            refs['complaints:30day'] = {
                type: 'table', label: cmpRecords.length + ' Complaints (30d)',
                columns: ['Date', 'Category', 'Severity', 'Location', 'Status'],
                rows: cmpRecords.slice(0, 20),
                nav: { page: 'complaints' }
            };
        }

        var refKeysList = Object.keys(refs).map(function (k) { return '"' + k + '"'; }).join(', ');

        var prompt = 'You are a VKS Security risk analyst. Analyze 30-day incident and complaint data for PATTERNS.\n\n'
            + 'INCIDENTS (' + incRecords.length + ' total, showing up to 20):\n'
            + JSON.stringify(incRecords.slice(0, 20)) + '\n\n'
            + 'COMPLAINTS (' + cmpRecords.length + ' total, showing up to 20):\n'
            + JSON.stringify(cmpRecords.slice(0, 20)) + '\n\n'
            + 'AVAILABLE REFERENCES (use these exact keys in refKeys):\n'
            + refKeysList + '\n\n'
            + 'FOCUS ON: recurring locations, time-of-day patterns, category trends, escalating severity.\n\n'
            + INSIGHT_SCHEMA_INSTRUCTIONS;

        var aiText = callGemini(prompt, { temperature: 0.4, maxTokens: 1500 });
        var insights = parseGeminiJSON_(aiText);

        if (!insights || !Array.isArray(insights)) {
            return { success: false, error: 'AI response parsing failed' };
        }

        var result = { insights: insights, references: refs };
        saveBriefing_('patterns', todayStr, JSON.stringify(result),
            JSON.stringify({ incidents: incRecords.length, complaints: cmpRecords.length }));

        Logger.log('Weekly patterns: ' + incRecords.length + ' incidents, ' + cmpRecords.length + ' complaints analyzed');
        return { success: true, insights: insights, references: refs };

    } catch (e) {
        Logger.log('generateWeeklyPatterns error: ' + e.message);
        return { success: false, error: e.message };
    }
}

// ===========================================
// STORAGE & RETRIEVAL
// ===========================================

/**
 * Save briefing to AI_Briefings sheet
 * @private
 */
function saveBriefing_(type, date, content, rawData) {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    var sheet = ss.getSheetByName('AI_Briefings');

    if (!sheet) {
        sheet = ss.insertSheet('AI_Briefings');
        sheet.appendRow(['id', 'type', 'date', 'content', 'rawData', 'generatedAt']);
    }

    var id = 'AI-' + type.toUpperCase() + '-' + date.replace(/-/g, '');
    var now = new Date();

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
        if (data[i][0] === id) {
            sheet.getRange(i + 1, 4).setValue(content);
            sheet.getRange(i + 1, 5).setValue(rawData);
            sheet.getRange(i + 1, 6).setValue(now);
            return;
        }
    }
    sheet.appendRow([id, type, date, content, rawData, now]);
}

/**
 * Get latest daily briefing (structured)
 * @returns {Object|null} { success, insights[], references{}, date }
 */
function getAIBriefing() {
    try {
        var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        var sheet = ss.getSheetByName('AI_Briefings');
        if (!sheet || sheet.getLastRow() <= 1) return null;

        var data = sheet.getDataRange().getValues();
        for (var i = data.length - 1; i >= 1; i--) {
            if (data[i][1] === 'daily') {
                var content = data[i][3];
                try {
                    var parsed = JSON.parse(content);
                    return {
                        success: true,
                        insights: parsed.insights || [],
                        references: parsed.references || {},
                        date: data[i][2],
                        generatedAt: data[i][5] ? Utilities.formatDate(new Date(data[i][5]), 'Asia/Vientiane', 'HH:mm') : ''
                    };
                } catch (e) {
                    // Legacy plain text format — return as single insight
                    return {
                        success: true,
                        insights: [{ icon: '📋', title: 'Daily Briefing', titleLo: 'ສະຫຼຸບປະຈຳວັນ', detail: content, detailLo: '', trend: 'stable', severity: 'good', metrics: [], refKeys: [] }],
                        references: {},
                        date: data[i][2],
                        generatedAt: data[i][5] ? Utilities.formatDate(new Date(data[i][5]), 'Asia/Vientiane', 'HH:mm') : ''
                    };
                }
            }
        }
        return null;
    } catch (e) {
        Logger.log('getAIBriefing error: ' + e.message);
        return null;
    }
}

/**
 * Get latest risk patterns (structured)
 * @returns {Object|null} { success, insights[], references{} }
 */
function getAIPatternAnalysis() {
    try {
        var ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        var sheet = ss.getSheetByName('AI_Briefings');
        if (!sheet || sheet.getLastRow() <= 1) return null;

        var data = sheet.getDataRange().getValues();
        for (var i = data.length - 1; i >= 1; i--) {
            if (data[i][1] === 'patterns') {
                var content = data[i][3];
                try {
                    var parsed = JSON.parse(content);
                    return {
                        success: true,
                        insights: parsed.insights || [],
                        references: parsed.references || {},
                        date: data[i][2],
                        generatedAt: data[i][5] ? Utilities.formatDate(new Date(data[i][5]), 'Asia/Vientiane', 'dd/MM/yyyy HH:mm') : ''
                    };
                } catch (e) {
                    return null;
                }
            }
        }
        return null;
    } catch (e) {
        Logger.log('getAIPatternAnalysis error: ' + e.message);
        return null;
    }
}

/**
 * Manual regeneration triggers (called from frontend)
 */
function regenerateDailyBriefing() {
    return generateDailyBriefing();
}

function regenerateWeeklyPatterns() {
    return generateWeeklyPatterns();
}

/**
 * Diagnostic: Test Gemini API connectivity
 */
function testGeminiConnection() {
    Logger.log('=== Gemini API Test ===');
    Logger.log('Model: ' + GEMINI_MODEL);
    try {
        var response = UrlFetchApp.fetch(
            GEMINI_ENDPOINT + GEMINI_MODEL + ':generateContent?key=' + GEMINI_API_KEY,
            {
                method: 'post', contentType: 'application/json',
                payload: JSON.stringify({
                    contents: [{ parts: [{ text: 'Say hello in 3 words' }] }],
                    generationConfig: { maxOutputTokens: 32 }
                }),
                muteHttpExceptions: true
            }
        );
        var code = response.getResponseCode();
        Logger.log('Status: ' + code);
        Logger.log('Response: ' + response.getContentText().substring(0, 300));
        return { status: code };
    } catch (e) {
        Logger.log('ERROR: ' + e.message);
        return { error: e.message };
    }
}
