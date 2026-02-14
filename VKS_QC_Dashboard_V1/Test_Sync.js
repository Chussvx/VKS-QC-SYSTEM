/**
 * Force sync sites from Patrol Dashboard to QC Master
 */
function forceSyncSites() {
  try {
    console.log('Starting manual sync...');
    const result = syncSitesFromPatrol();
    console.log('Sync Result: ' + JSON.stringify(result));
    
    // Also trigger update signal for frontend
    setUpdateSignal('sites');
    console.log('Signal triggered.');
    
    return result;
  } catch (e) {
    console.log('Sync Failed: ' + e.message);
    throw e;
  }
}
