/**
 * Inspectors.js - Inspector Management for QC Dashboard V1
 * 
 * Manages the Inspectors tab with CRUD operations.
 * Also includes one-time migration from Patrol Sheet.
 */

// ===========================================
// MIGRATION FUNCTION (Run Once)
// ===========================================

/**
 * One-time migration: Pull Patrol Names from Patrol Sheet → QC Inspectors tab
 * Run this manually from Apps Script editor
 * @returns {Object} Migration stats
 */
function migrateInspectorsFromPatrolSheet() {
    try {
        Logger.log('Starting Inspector migration from Patrol Sheet...');

        // 1. Read source data (Patrol Sheet → Sites → Column C)
        const patrolSS = SpreadsheetApp.openById(SPREADSHEET_ID_PATROL);
        const sitesSheet = patrolSS.getSheetByName('Sites');

        if (!sitesSheet) {
            throw new Error('Sites sheet not found in Patrol Sheet');
        }

        const lastRow = sitesSheet.getLastRow();
        if (lastRow < 2) {
            return { success: true, added: 0, message: 'No data to migrate' };
        }

        // Read Column C (Patrol Names) starting from row 2
        const sourceData = sitesSheet.getRange(2, 3, lastRow - 1, 1).getValues();
        const patrolNames = sourceData.map(r => r[0]).filter(name => name && name.toString().trim());

        Logger.log('Found ' + patrolNames.length + ' patrol names in Patrol Sheet');

        // 2. Open destination (QC Sheet → Inspectors tab)
        const qcSS = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        let inspectorSheet = qcSS.getSheetByName(SHEET_INSPECTORS);

        // Create sheet if it doesn't exist
        if (!inspectorSheet) {
            inspectorSheet = qcSS.insertSheet(SHEET_INSPECTORS);
            inspectorSheet.appendRow(['id', 'name', 'status', 'createdAt', 'updatedAt']);
            Logger.log('Created Inspectors sheet with headers');
        }

        // 3. Check for existing data to avoid duplicates
        const existingData = inspectorSheet.getDataRange().getValues();
        const existingNames = new Set();
        for (let i = 1; i < existingData.length; i++) {
            if (existingData[i][1]) {
                existingNames.add(existingData[i][1].toString().toLowerCase().trim());
            }
        }

        // 4. Add new inspectors
        const now = new Date();
        const rowsToAdd = [];
        let skipped = 0;

        patrolNames.forEach((name, index) => {
            const normalizedName = name.toString().trim();
            if (existingNames.has(normalizedName.toLowerCase())) {
                skipped++;
                return; // Skip duplicate
            }

            const id = 'INS-' + Utilities.getUuid().substring(0, 8).toUpperCase();
            rowsToAdd.push([
                id,
                normalizedName,
                'active',
                now,
                now
            ]);
            existingNames.add(normalizedName.toLowerCase()); // Prevent dupes within batch
        });

        if (rowsToAdd.length > 0) {
            const nextRow = inspectorSheet.getLastRow() + 1;
            inspectorSheet.getRange(nextRow, 1, rowsToAdd.length, 5).setValues(rowsToAdd);
            Logger.log('Added ' + rowsToAdd.length + ' new inspectors');
        }

        return {
            success: true,
            added: rowsToAdd.length,
            skipped: skipped,
            total: patrolNames.length
        };

    } catch (e) {
        Logger.log('Migration failed: ' + e.message);
        throw e;
    }
}

/**
 * One-time migration: Pull Site_Comments from Patrol Sheet → QC HandoverRecords tab
 * Run this manually from Apps Script editor
 * @returns {Object} Migration stats
 */
function migrateHandoverRecordsFromPatrolSheet() {
    try {
        Logger.log('Starting HandoverRecords migration from Patrol Sheet...');

        // 1. Read source data (Patrol Sheet → Site_Comments)
        const patrolSS = SpreadsheetApp.openById(SPREADSHEET_ID_PATROL);
        const commentsSheet = patrolSS.getSheetByName('Site_Comments');

        if (!commentsSheet) {
            return { success: true, added: 0, message: 'Site_Comments sheet not found - nothing to migrate' };
        }

        const lastRow = commentsSheet.getLastRow();
        if (lastRow < 2) {
            return { success: true, added: 0, message: 'No data to migrate' };
        }

        // Read all data (cols: Timestamp, SiteName, GuardName, Comment)
        const sourceData = commentsSheet.getRange(2, 1, lastRow - 1, 4).getValues();
        Logger.log('Found ' + sourceData.length + ' handover records in Patrol Sheet');

        // 2. Open destination (QC Sheet → HandoverRecords tab)
        const qcSS = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        let handoverSheet = qcSS.getSheetByName(SHEET_HANDOVER_RECORDS);

        // Create sheet if it doesn't exist
        if (!handoverSheet) {
            handoverSheet = qcSS.insertSheet(SHEET_HANDOVER_RECORDS);
            handoverSheet.appendRow(['id', 'timestamp', 'siteName', 'guardName', 'comment', 'syncedAt']);
            Logger.log('Created HandoverRecords sheet with headers');
        }

        // 3. Check for existing data to avoid duplicates (by timestamp)
        const existingData = handoverSheet.getDataRange().getValues();
        const existingTimestamps = new Set();
        for (let i = 1; i < existingData.length; i++) {
            if (existingData[i][1]) {
                const ts = new Date(existingData[i][1]).getTime();
                existingTimestamps.add(ts);
            }
        }

        // 4. Transform and add records
        const now = new Date();
        const rowsToAdd = [];
        let skipped = 0;

        sourceData.forEach((row, index) => {
            const timestamp = row[0];
            if (!timestamp) {
                skipped++;
                return;
            }

            const ts = new Date(timestamp).getTime();
            if (existingTimestamps.has(ts)) {
                skipped++;
                return; // Skip duplicate
            }

            const id = 'HND-' + Utilities.getUuid().substring(0, 8).toUpperCase();
            rowsToAdd.push([
                id,
                timestamp,      // Keep original timestamp
                row[1] || '',   // siteName
                row[2] || '',   // guardName
                row[3] || '',   // comment
                now             // syncedAt
            ]);
            existingTimestamps.add(ts);
        });

        if (rowsToAdd.length > 0) {
            const nextRow = handoverSheet.getLastRow() + 1;
            handoverSheet.getRange(nextRow, 1, rowsToAdd.length, 6).setValues(rowsToAdd);
            Logger.log('Added ' + rowsToAdd.length + ' handover records');
        }

        return {
            success: true,
            added: rowsToAdd.length,
            skipped: skipped,
            total: sourceData.length
        };

    } catch (e) {
        Logger.log('HandoverRecords migration failed: ' + e.message);
        throw e;
    }
}

/**
 * One-time migration: Pull SpecialActivity_Logs from Patrol Sheet → QC SpecialActivityLogs tab
 * Run this manually from Apps Script editor
 * @returns {Object} Migration stats
 */
function migrateSpecialActivityFromPatrolSheet() {
    try {
        Logger.log('Starting SpecialActivityLogs migration from Patrol Sheet...');

        // 1. Read source data (Patrol Sheet → SpecialActivity_Logs)
        const patrolSS = SpreadsheetApp.openById(SPREADSHEET_ID_PATROL);
        const specialSheet = patrolSS.getSheetByName('SpecialActivity_Logs');

        if (!specialSheet) {
            return { success: true, added: 0, message: 'SpecialActivity_Logs sheet not found - nothing to migrate' };
        }

        const lastRow = specialSheet.getLastRow();
        if (lastRow < 2) {
            return { success: true, added: 0, message: 'No data to migrate' };
        }

        // Read all data (13 cols: ID, Timestamp, Type, PatrolName, SiteName, TargetGuard, StartTime, EndTime, Duration, Status, Ratings, PhotoURL, Notes)
        const sourceData = specialSheet.getRange(2, 1, lastRow - 1, 13).getValues();
        Logger.log('Found ' + sourceData.length + ' special activity records in Patrol Sheet');

        // 2. Open destination (QC Sheet → SpecialActivityLogs tab)
        const qcSS = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        let destSheet = qcSS.getSheetByName(SHEET_SPECIAL_ACTIVITY);

        // Create sheet if it doesn't exist
        if (!destSheet) {
            destSheet = qcSS.insertSheet(SHEET_SPECIAL_ACTIVITY);
            destSheet.appendRow(['id', 'timestamp', 'type', 'patrolName', 'siteName', 'targetGuard', 'startTime', 'endTime', 'duration', 'status', 'ratings', 'photoUrl', 'notes', 'syncedAt']);
            Logger.log('Created SpecialActivityLogs sheet with headers');
        }

        // 3. Check for existing data to avoid duplicates (by ID)
        const existingData = destSheet.getDataRange().getValues();
        const existingIds = new Set();
        for (let i = 1; i < existingData.length; i++) {
            if (existingData[i][0]) {
                existingIds.add(existingData[i][0]);
            }
        }

        // 4. Transform and add records
        const now = new Date();
        const rowsToAdd = [];
        let skipped = 0;

        sourceData.forEach((row, index) => {
            const sourceId = row[0];
            if (!sourceId) {
                skipped++;
                return;
            }

            if (existingIds.has(sourceId)) {
                skipped++;
                return; // Skip duplicate
            }

            rowsToAdd.push([
                sourceId,       // Keep original ID
                row[1] || '',   // timestamp
                row[2] || '',   // type
                row[3] || '',   // patrolName
                row[4] || '',   // siteName
                row[5] || '',   // targetGuard
                row[6] || '',   // startTime
                row[7] || '',   // endTime
                row[8] || '',   // duration
                row[9] || '',   // status
                row[10] || '',  // ratings
                row[11] || '',  // photoUrl
                row[12] || '',  // notes
                now             // syncedAt
            ]);
            existingIds.add(sourceId);
        });

        if (rowsToAdd.length > 0) {
            const nextRow = destSheet.getLastRow() + 1;
            destSheet.getRange(nextRow, 1, rowsToAdd.length, 14).setValues(rowsToAdd);
            Logger.log('Added ' + rowsToAdd.length + ' special activity records');
        }

        return {
            success: true,
            added: rowsToAdd.length,
            skipped: skipped,
            total: sourceData.length
        };

    } catch (e) {
        Logger.log('SpecialActivityLogs migration failed: ' + e.message);
        throw e;
    }
}

/**
 * Run all migrations at once (convenience function)
 * Run this manually from Apps Script editor
 */
function migrateAllFromPatrolSheet() {
    Logger.log('=== Starting Full Migration ===');

    const results = {
        inspectors: migrateInspectorsFromPatrolSheet(),
        handoverRecords: migrateHandoverRecordsFromPatrolSheet(),
        specialActivity: migrateSpecialActivityFromPatrolSheet()
    };

    Logger.log('=== Migration Complete ===');
    Logger.log(JSON.stringify(results, null, 2));

    return results;
}

// ===========================================
// SPECIAL ACTIVITY API (Frontend)
// ===========================================

/**
 * Get all special activity logs for the Special Duty page
 * Maps backend field names to V2-compatible names for frontend consistency
 * @returns {string} JSON array of special activity records
 */
function getSpecialActivityLogs() {
    try {
        Logger.log('getSpecialActivityLogs: Starting...');

        const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        Logger.log('getSpecialActivityLogs: Opened spreadsheet');

        const sheet = ss.getSheetByName(SHEET_SPECIAL_ACTIVITY);
        Logger.log('getSpecialActivityLogs: Sheet exists = ' + (sheet !== null));

        if (!sheet) {
            Logger.log('getSpecialActivityLogs: Sheet not found, returning empty array');
            return JSON.stringify([]);
        }

        const lastRow = sheet.getLastRow();
        Logger.log('getSpecialActivityLogs: Last row = ' + lastRow);

        if (lastRow < 2) {
            Logger.log('getSpecialActivityLogs: No data rows, returning empty array');
            return JSON.stringify([]);
        }

        // Read all data (14 cols)
        const data = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
        Logger.log('getSpecialActivityLogs: Read ' + data.length + ' rows');

        // Map to objects with V2-compatible field names
        const logs = data.map(row => ({
            id: row[0] || '',
            timestamp: row[1] ? new Date(row[1]).toISOString() : '',
            type: row[2] || '',
            patrol: row[3] || '',       // V2 name (backend: patrolName)
            site: row[4] || '',         // V2 name (backend: siteName)
            target: row[5] || '',       // V2 name (backend: targetGuard)
            startTime: row[6] || '',
            endTime: row[7] || '',
            duration: row[8] || '',
            status: row[9] || 'Active',
            ratings: row[10] || '',     // JSON string
            photoUrl: row[11] || '',
            notes: row[12] || ''
        }));

        // Sort by timestamp descending (newest first)
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        Logger.log('getSpecialActivityLogs: Success, returning ' + logs.length + ' logs');
        return JSON.stringify(logs);

    } catch (e) {
        Logger.log('getSpecialActivityLogs error: ' + e.message);
        Logger.log('getSpecialActivityLogs stack: ' + e.stack);
        return JSON.stringify([]);
    }
}

// ===========================================
// CRUD FUNCTIONS
// ===========================================

/**
 * Get all inspectors with optional filters
 * @param {Object} filters - { search: string, status: string, page: number, pageSize: number }
 * @returns {Object} { data: [], total: number, page: number, pageSize: number }
 */
function getInspectors(filters) {
    try {
        filters = filters || {};
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        const sheet = ss.getSheetByName(SHEET_INSPECTORS);

        if (!sheet) {
            return JSON.stringify({ data: [], total: 0, page: 1, pageSize: 50 });
        }

        const lastRow = sheet.getLastRow();
        if (lastRow < 2) {
            return JSON.stringify({ data: [], total: 0, page: 1, pageSize: 50 });
        }

        // Read all data
        const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();

        // Map to objects
        let inspectors = data.map(row => ({
            id: row[0],
            name: row[1],
            status: row[2] || 'active',
            createdAt: row[3] ? new Date(row[3]).toISOString() : null,
            updatedAt: row[4] ? new Date(row[4]).toISOString() : null
        }));

        // Apply search filter
        if (filters.search) {
            const term = filters.search.toLowerCase();
            inspectors = inspectors.filter(i =>
                i.name.toLowerCase().includes(term) ||
                i.id.toLowerCase().includes(term)
            );
        }

        // Apply status filter
        if (filters.status && filters.status !== 'all') {
            inspectors = inspectors.filter(i => i.status === filters.status);
        }

        // Pagination
        const total = inspectors.length;
        const page = filters.page || 1;
        const pageSize = filters.pageSize || 50;
        const offset = (page - 1) * pageSize;

        const paginatedData = inspectors.slice(offset, offset + pageSize);

        return JSON.stringify({
            data: paginatedData,
            total: total,
            page: page,
            pageSize: pageSize
        });

    } catch (e) {
        Logger.log('getInspectors error: ' + e.message);
        return JSON.stringify({ data: [], total: 0, page: 1, pageSize: 50, error: e.message });
    }
}

/**
 * Get inspector options for dropdown selects
 * @returns {Array} Array of { id, name } objects
 */
function getInspectorOptions() {
    try {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        const sheet = ss.getSheetByName(SHEET_INSPECTORS);

        if (!sheet) return [];

        const lastRow = sheet.getLastRow();
        if (lastRow < 2) return [];

        const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();

        // Only return active inspectors
        return data
            .filter(row => row[2] !== 'inactive')
            .map(row => ({
                id: row[0],
                name: row[1]
            }));

    } catch (e) {
        Logger.log('getInspectorOptions error: ' + e.message);
        return [];
    }
}

/**
 * Add a new inspector
 * @param {string} name - Inspector name
 * @returns {Object} { success: boolean, id: string, error: string }
 */
function addInspector(name) {
    try {
        // Validation
        const cleanName = (name || '').toString().trim();
        if (!cleanName) {
            return { success: false, error: 'Inspector name cannot be empty' };
        }
        if (cleanName.length < 2) {
            return { success: false, error: 'Inspector name must be at least 2 characters' };
        }

        const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        let sheet = ss.getSheetByName(SHEET_INSPECTORS);

        // Create sheet if doesn't exist
        if (!sheet) {
            sheet = ss.insertSheet(SHEET_INSPECTORS);
            sheet.appendRow(['id', 'name', 'status', 'createdAt', 'updatedAt']);
        }

        // Check for duplicates
        const existingData = sheet.getDataRange().getValues();
        for (let i = 1; i < existingData.length; i++) {
            if (existingData[i][1] && existingData[i][1].toString().toLowerCase().trim() === cleanName.toLowerCase()) {
                return { success: false, error: 'Inspector with this name already exists' };
            }
        }

        // Add new row
        const id = 'INS-' + Utilities.getUuid().substring(0, 8).toUpperCase();
        const now = new Date();

        sheet.appendRow([id, cleanName, 'active', now, now]);

        // Signal update
        setUpdateSignal('inspectors');

        return { success: true, id: id };

    } catch (e) {
        Logger.log('addInspector error: ' + e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Update an existing inspector
 * @param {string} id - Inspector ID
 * @param {Object} updates - { name: string, status: string }
 * @returns {Object} { success: boolean, error: string }
 */
function updateInspector(id, updates) {
    try {
        if (!id) {
            return { success: false, error: 'Inspector ID is required' };
        }

        const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        const sheet = ss.getSheetByName(SHEET_INSPECTORS);

        if (!sheet) {
            return { success: false, error: 'Inspectors sheet not found' };
        }

        // Find the row
        const data = sheet.getDataRange().getValues();
        let targetRow = -1;

        for (let i = 1; i < data.length; i++) {
            if (data[i][0] === id) {
                targetRow = i + 1; // 1-indexed
                break;
            }
        }

        if (targetRow === -1) {
            return { success: false, error: 'Inspector not found' };
        }

        // Update fields
        const now = new Date();

        if (updates.name !== undefined) {
            const cleanName = updates.name.toString().trim();
            if (!cleanName || cleanName.length < 2) {
                return { success: false, error: 'Invalid name' };
            }
            sheet.getRange(targetRow, 2).setValue(cleanName);
        }

        if (updates.status !== undefined) {
            sheet.getRange(targetRow, 3).setValue(updates.status);
        }

        // Update timestamp
        sheet.getRange(targetRow, 5).setValue(now);

        // Signal update
        setUpdateSignal('inspectors');

        return { success: true };

    } catch (e) {
        Logger.log('updateInspector error: ' + e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Delete an inspector (soft delete - sets status to 'inactive')
 * @param {string} id - Inspector ID
 * @returns {Object} { success: boolean, error: string }
 */
function deleteInspector(id) {
    try {
        if (!id) {
            return { success: false, error: 'Inspector ID is required' };
        }

        // Soft delete - just set status to inactive
        return updateInspector(id, { status: 'inactive' });

    } catch (e) {
        Logger.log('deleteInspector error: ' + e.message);
        return { success: false, error: e.message };
    }
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Get a single inspector by ID
 * @param {string} id - Inspector ID
 * @returns {Object} Inspector object or null
 */
function getInspectorById(id) {
    try {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
        const sheet = ss.getSheetByName(SHEET_INSPECTORS);

        if (!sheet) return null;

        const data = sheet.getDataRange().getValues();

        for (let i = 1; i < data.length; i++) {
            if (data[i][0] === id) {
                return {
                    id: data[i][0],
                    name: data[i][1],
                    status: data[i][2],
                    createdAt: data[i][3],
                    updatedAt: data[i][4]
                };
            }
        }

        return null;

    } catch (e) {
        Logger.log('getInspectorById error: ' + e.message);
        return null;
    }
}
