/**
 * Debug function to check specific site settings
 */
function debug_checkSiteSettings() {
  try {
    const targetCode = 'VKS-A-001'; // From user screenshot
    console.log('Searching for site with code: ' + targetCode);
    
    // Use existing getSites to find the ID
    const sites = getSites({});
    const site = sites.find(s => s.code === targetCode);
    
    if (!site) {
      console.log('ERROR: Site not found!');
      return;
    }
    
    console.log('FOUND SITE: ' + site.nameEN);
    console.log('ID: ' + site.id);
    console.log('---------------------------');
    console.log('DASHBOARD VALUES (FROM SHEET):');
    console.log('Checkpoint Target: ' + site.checkpointTarget);
    console.log('Rounds Target: ' + site.roundsTarget);
    console.log('Shift Type: ' + site.shiftType);
    console.log('Shift Start: ' + site.shiftStart);
    console.log('Shift End: ' + site.shiftEnd);
    console.log('Updated At: ' + site.updatedAt);
    console.log('---------------------------');
    
    // Check actual checkpoints count in Checkpoints sheet
    const checkpoints = getSiteCheckpoints(site.id);
    console.log('ACTUAL CHECKPOINTS DEFINED: ' + checkpoints.length);
    if (checkpoints.length > 0) {
      console.log('First CP: ' + JSON.stringify(checkpoints[0]));
    }
    
  } catch (e) {
    console.log('DEBUG ERROR: ' + e.message);
  }
}
