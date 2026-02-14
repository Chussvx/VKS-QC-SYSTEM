/**
 * Test_Handover.js - Debug handover data flow
 * Run these functions from Apps Script Editor to diagnose issues
 */

/**
 * 🧪 STEP 1: Test raw sheet connection
 * Run this first to verify access to Site_Comments sheet
 */
function testHandover_Step1_Connection() {
    Logger.log('🔵 [Handover] STEP 1: Testing connection to Site_Comments...');

    try {
        const patrolId = SPREADSHEET_ID_PATROL;
        Logger.log('🔵 [Handover] SPREADSHEET_ID_PATROL: ' + patrolId);

        const ss = SpreadsheetApp.openById(patrolId);
        Logger.log('🔵 [Handover] Opened spreadsheet: ' + ss.getName());

        const sheet = ss.getSheetByName('Site_Comments');
        if (!sheet) {
            Logger.log('🔴 [Handover] ERROR: Site_Comments sheet NOT FOUND!');
            return { success: false, error: 'Sheet not found' };
        }

        Logger.log('🟢 [Handover] Site_Comments sheet FOUND!');

        const lastRow = sheet.getLastRow();
        const lastCol = sheet.getLastColumn();
        Logger.log('🔵 [Handover] Sheet dimensions: ' + lastRow + ' rows x ' + lastCol + ' columns');

        return {
            success: true,
            rows: lastRow,
            columns: lastCol,
            sheetName: sheet.getName()
        };

    } catch (e) {
        Logger.log('🔴 [Handover] ERROR: ' + e.message);
        Logger.log('🔴 [Handover] Stack: ' + e.stack);
        return { success: false, error: e.message };
    }
}

/**
 * 🧪 STEP 2: Test raw data retrieval
 * Run after Step 1 passes
 */
function testHandover_Step2_RawData() {
    Logger.log('🔵 [Handover] STEP 2: Getting raw data...');

    try {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PATROL);
        const sheet = ss.getSheetByName('Site_Comments');

        const data = sheet.getDataRange().getValues();
        Logger.log('🔵 [Handover] Total rows (including header): ' + data.length);

        if (data.length <= 1) {
            Logger.log('🟡 [Handover] WARNING: No data rows found (only header)');
            return { success: true, rowCount: 0, hasData: false };
        }

        // Log header
        Logger.log('🔵 [Handover] Header row: ' + JSON.stringify(data[0]));

        // Log first 3 data rows
        for (let i = 1; i <= Math.min(3, data.length - 1); i++) {
            Logger.log('🔵 [Handover] Row ' + i + ': ' + JSON.stringify(data[i]));
        }

        // Log last row
        const lastIdx = data.length - 1;
        Logger.log('🔵 [Handover] Last row (' + lastIdx + '): ' + JSON.stringify(data[lastIdx]));

        return {
            success: true,
            rowCount: data.length - 1,
            hasData: true,
            header: data[0],
            sampleFirstRow: data[1],
            sampleLastRow: data[lastIdx]
        };

    } catch (e) {
        Logger.log('🔴 [Handover] ERROR: ' + e.message);
        return { success: false, error: e.message };
    }
}

/**
 * 🧪 STEP 3: Test getHandoverRecords function
 * Run after Step 2 passes
 */
function testHandover_Step3_GetRecords() {
    Logger.log('🔵 [Handover] STEP 3: Testing getHandoverRecords()...');

    try {
        // Test with empty filters (should return all records)
        const filters = { date: '', siteId: '' };
        Logger.log('🔵 [Handover] Calling getHandoverRecords with filters: ' + JSON.stringify(filters));

        const results = getHandoverRecords(filters);

        Logger.log('🔵 [Handover] Results count: ' + (results ? results.length : 'null'));

        if (!results || results.length === 0) {
            Logger.log('🟡 [Handover] WARNING: No results returned!');
            return { success: true, count: 0, records: [] };
        }

        // Log first 3 records
        Logger.log('🟢 [Handover] First record: ' + JSON.stringify(results[0]));
        if (results.length > 1) {
            Logger.log('🟢 [Handover] Second record: ' + JSON.stringify(results[1]));
        }

        Logger.log('🟢 [Handover] SUCCESS! Retrieved ' + results.length + ' records');

        return {
            success: true,
            count: results.length,
            sampleRecords: results.slice(0, 3)
        };

    } catch (e) {
        Logger.log('🔴 [Handover] ERROR: ' + e.message);
        Logger.log('🔴 [Handover] Stack: ' + e.stack);
        return { success: false, error: e.message };
    }
}

/**
 * 🧪 STEP 4: Test date parsing in data
 * Run if Step 3 shows 0 records to diagnose date issues
 */
function testHandover_Step4_DateParsing() {
    Logger.log('🔵 [Handover] STEP 4: Testing date parsing...');

    try {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PATROL);
        const sheet = ss.getSheetByName('Site_Comments');
        const data = sheet.getDataRange().getValues();

        if (data.length <= 1) {
            Logger.log('🔴 [Handover] No data to parse');
            return { success: false, error: 'No data' };
        }

        let validDates = 0;
        let invalidDates = 0;
        let samples = [];

        for (let i = 1; i < Math.min(10, data.length); i++) {
            const row = data[i];
            const rawDate = row[0];
            const isDateObj = rawDate instanceof Date;

            let parsedDate = null;
            let isValid = false;

            if (isDateObj) {
                parsedDate = rawDate;
                isValid = !isNaN(rawDate.getTime());
            } else if (rawDate) {
                parsedDate = new Date(rawDate);
                isValid = !isNaN(parsedDate.getTime());
            }

            if (isValid) {
                validDates++;
            } else {
                invalidDates++;
            }

            samples.push({
                row: i,
                raw: String(rawDate),
                isDateObj: isDateObj,
                parsed: parsedDate ? parsedDate.toISOString() : 'null',
                valid: isValid
            });

            Logger.log('🔵 [Handover] Row ' + i + ': raw=' + rawDate + ', isDate=' + isDateObj + ', valid=' + isValid);
        }

        Logger.log('🟢 [Handover] Date parsing complete. Valid: ' + validDates + ', Invalid: ' + invalidDates);

        return {
            success: true,
            validDates: validDates,
            invalidDates: invalidDates,
            samples: samples
        };

    } catch (e) {
        Logger.log('🔴 [Handover] ERROR: ' + e.message);
        return { success: false, error: e.message };
    }
}

/**
 * 🧪 RUN ALL TESTS
 * Master function to run all diagnostic steps
 */
function testHandover_RunAll() {
    Logger.log('');
    Logger.log('========================================');
    Logger.log('🧪 HANDOVER DIAGNOSTIC - FULL TEST');
    Logger.log('========================================');
    Logger.log('');

    const results = {};

    // Step 1
    results.step1 = testHandover_Step1_Connection();
    if (!results.step1.success) {
        Logger.log('🔴 STOPPED AT STEP 1');
        return results;
    }

    // Step 2
    results.step2 = testHandover_Step2_RawData();
    if (!results.step2.success || !results.step2.hasData) {
        Logger.log('🔴 STOPPED AT STEP 2');
        return results;
    }

    // Step 3
    results.step3 = testHandover_Step3_GetRecords();

    // Step 4 (only if Step 3 returns 0 records)
    if (results.step3.count === 0) {
        results.step4 = testHandover_Step4_DateParsing();
    }

    Logger.log('');
    Logger.log('========================================');
    Logger.log('🧪 DIAGNOSTIC COMPLETE');
    Logger.log('========================================');
    Logger.log(JSON.stringify(results, null, 2));

    return results;
}
