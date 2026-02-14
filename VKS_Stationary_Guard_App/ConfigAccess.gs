/**
 * Public Accessor for Frontend to fetch latest config
 * Useful for self-healing stale sessions
 */
function getSiteConfig(siteIdOrCode) {
    try {
        const sites = getTableData('Sites');
        const canonicalSiteId = resolveSiteId(siteIdOrCode, sites);
        const siteInfo = sites.find(s => s.code === canonicalSiteId) || {};
        
        // Default
        let result = {
            checkpoints: 4,
            rounds: 7,
            shiftStart: '',
            shiftEnd: ''
        };

        const configs = getTableData('Site_Config');
        const config = configs.find(c => 
            String(c.code || '').toUpperCase() === String(canonicalSiteId).toUpperCase() ||
            String(c.siteId) === canonicalSiteId
        );

        if (config) {
            if (config.checkpoints) result.checkpoints = parseInt(config.checkpoints);
            if (config.rounds) result.rounds = parseInt(config.rounds);
            if (config.shiftStart) result.shiftStart = config.shiftStart;
            if (config.shiftEnd) result.shiftEnd = config.shiftEnd;
        } else {
            // Fallback to Sites sheet columns if Site_Config missing
            if (siteInfo.checkpointTarget) result.checkpoints = parseInt(siteInfo.checkpointTarget) || 4;
            if (siteInfo.roundsTarget) result.rounds = parseInt(siteInfo.roundsTarget) || 7;
        }
        
        return { success: true, data: result };
    } catch (e) {
        return { success: false, message: e.toString() };
    }
}
