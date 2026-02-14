/**
 * Compare_Locations.js - Utility to compare locations between Patrol Sheet and QC Sheet
 * Run these functions from Apps Script editor to find missing data
 */

/**
 * Compare locations between Patrol Sheet Sites tab and QC Sheet Sites tab
 * Returns list of locations missing in QC Sheet
 */
function compareLocations() {
    Logger.log('=== Comparing Locations ===');

    // 1. Read from Patrol Sheet (Sites tab - Route A & Route B)
    const patrolSS = SpreadsheetApp.openById(SPREADSHEET_ID_PATROL);
    const patrolSites = patrolSS.getSheetByName('Sites');

    if (!patrolSites) {
        Logger.log('ERROR: Sites tab not found in Patrol Sheet');
        return { error: 'Sites tab not found in Patrol Sheet' };
    }

    const patrolLastRow = patrolSites.getLastRow();
    const patrolData = patrolLastRow > 1 ? patrolSites.getRange(2, 1, patrolLastRow - 1, 2).getValues() : [];

    // Get Route A and Route B locations
    const patrolRouteA = patrolData.map(r => r[0]).filter(String).map(s => s.toString().trim());
    const patrolRouteB = patrolData.map(r => r[1]).filter(String).map(s => s.toString().trim());
    const patrolLocations = [...new Set([...patrolRouteA, ...patrolRouteB])]; // Unique locations

    Logger.log('Patrol Sheet - Route A: ' + patrolRouteA.length + ' locations');
    Logger.log('Patrol Sheet - Route B: ' + patrolRouteB.length + ' locations');
    Logger.log('Patrol Sheet - Total Unique: ' + patrolLocations.length + ' locations');

    // 2. Read from QC Sheet (Sites tab)
    const qcSS = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const qcSites = qcSS.getSheetByName('Sites');

    if (!qcSites) {
        Logger.log('ERROR: Sites tab not found in QC Sheet');
        return { error: 'Sites tab not found in QC Sheet' };
    }

    const qcLastRow = qcSites.getLastRow();
    // Assuming QC Sites has columns: id, code, nameEN, nameLO, ...
    // Read nameEN (column 3) for comparison
    const qcData = qcLastRow > 1 ? qcSites.getRange(2, 1, qcLastRow - 1, 4).getValues() : [];

    const qcLocations = qcData.map(r => {
        // Return nameEN or code for comparison
        return (r[2] || r[1] || '').toString().trim();
    }).filter(String);

    Logger.log('QC Sheet - Total: ' + qcLocations.length + ' locations');

    // 3. Find differences
    const qcSet = new Set(qcLocations.map(s => s.toLowerCase()));

    const missingInQC = patrolLocations.filter(loc => !qcSet.has(loc.toLowerCase()));
    const extraInQC = qcLocations.filter(loc => {
        const patrolSet = new Set(patrolLocations.map(s => s.toLowerCase()));
        return !patrolSet.has(loc.toLowerCase());
    });

    Logger.log('');
    Logger.log('=== RESULTS ===');
    Logger.log('Missing in QC Sheet (' + missingInQC.length + '):');
    missingInQC.forEach(loc => Logger.log('  - ' + loc));

    Logger.log('');
    Logger.log('Extra in QC Sheet (not in Patrol - ' + extraInQC.length + '):');
    extraInQC.forEach(loc => Logger.log('  - ' + loc));

    return {
        patrolCount: patrolLocations.length,
        qcCount: qcLocations.length,
        missingInQC: missingInQC,
        extraInQC: extraInQC,
        patrolRouteA: patrolRouteA,
        patrolRouteB: patrolRouteB,
        qcLocations: qcLocations
    };
}

/**
 * Sync missing locations from Patrol Sheet to QC Sheet
 * Run this after compareLocations() to add missing locations
 */
function syncMissingLocations() {
    const comparison = compareLocations();

    if (comparison.error) {
        Logger.log('Cannot sync - comparison failed');
        return comparison;
    }

    if (comparison.missingInQC.length === 0) {
        Logger.log('No missing locations to sync!');
        return { success: true, added: 0, message: 'All locations already in sync' };
    }

    Logger.log('');
    Logger.log('=== Syncing ' + comparison.missingInQC.length + ' missing locations ===');

    const qcSS = SpreadsheetApp.openById(SPREADSHEET_ID_QC);
    const qcSites = qcSS.getSheetByName('Sites');

    const now = new Date();
    const rowsToAdd = [];

    comparison.missingInQC.forEach((location, index) => {
        // Determine route based on which array contains the location
        const isRouteA = comparison.patrolRouteA.some(loc => loc.toLowerCase() === location.toLowerCase());
        const isRouteB = comparison.patrolRouteB.some(loc => loc.toLowerCase() === location.toLowerCase());

        let route = '';
        if (isRouteA && isRouteB) {
            route = 'A'; // If in both, default to A
            Logger.log('  + ' + location + ' → Route A (found in both A and B)');
        } else if (isRouteA) {
            route = 'A';
            Logger.log('  + ' + location + ' → Route A');
        } else if (isRouteB) {
            route = 'B';
            Logger.log('  + ' + location + ' → Route B');
        } else {
            route = ''; // Unknown
            Logger.log('  + ' + location + ' → Route UNKNOWN (not found in A or B!)');
        }

        // Generate ID
        const id = 'SITE-' + Utilities.getUuid().substring(0, 8).toUpperCase();

        // Row data matching exact QC Sites schema (24 columns)
        rowsToAdd.push([
            id,             // id
            '',             // code
            location,       // nameEN
            '',             // nameLO
            'External',     // type
            route,          // route (A or B)
            '',             // address
            '',             // district
            '',             // province
            '',             // lat
            '',             // lng
            '',             // contactName
            '',             // contactPhone
            '',             // contactEmail
            'active',       // status
            'Migrated from Patrol Sheet',  // notes
            '',             // checkpointTarget
            '',             // roundsTarget
            '',             // patrolConditions
            '',             // shiftType
            '',             // shiftStart
            '',             // shiftEnd
            now,            // createdAt
            now             // updatedAt
        ]);
    });

    if (rowsToAdd.length > 0) {
        const nextRow = qcSites.getLastRow() + 1;
        qcSites.getRange(nextRow, 1, rowsToAdd.length, 24).setValues(rowsToAdd);
        Logger.log('Added ' + rowsToAdd.length + ' locations to QC Sites');
    }

    return {
        success: true,
        added: rowsToAdd.length,
        locations: comparison.missingInQC
    };
}
