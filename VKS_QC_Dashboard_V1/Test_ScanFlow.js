/**
 * Test_ScanFlow.gs
 * End-to-End Simulation of the "Scan-Based Assignment" feature.
 */

function testScanBasedAssignment() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const guardsSheet = ss.getSheetByName('Guards');
  const scansSheet = ss.getSheetByName('Scans');
  
  // 1. SETUP: Create a Test Guard (simulates filling the App form)
  const testGuard = {
    id: 'TEST-BOT-001',
    name: 'Robot',
    surname: 'Verifier',
    empId: 'R2D2',
    status: 'Active'
  };
  
  // Check if guard exists, if not append
  const guardsData = guardsSheet.getDataRange().getValues();
  const empIdIdx = 3; // 'empId' is usually col D (index 3) based on debug logs
  let guardExists = false;
  
  for(let i=1; i<guardsData.length; i++) {
    if(String(guardsData[i][empIdIdx]) === testGuard.empId) {
      guardExists = true;
      break;
    }
  }
  
  if (!guardExists) {
    console.log('... Registering Test Guard (R2D2)');
    // Matches headers: id, name, surname, empId, phone, email, siteId, ...
    guardsSheet.appendRow([
      testGuard.id, 
      testGuard.name, 
      testGuard.surname, 
      testGuard.empId, 
      '00000000', 
      'bot@vks.la', 
      '', 
      'Active'
    ]);
  } else {
    console.log('... Test Guard (R2D2) already exists');
  }
  
  // 2. ACTION: Simulate a CHECKIN Scan (simulates scanning QR code)
  console.log('... Simulating CHECKIN Scan at VKS-A-001');
  const scanTime = new Date();
  const siteId = 'VKS-A-001'; // The site we are testing
  
  // Matches headers: id, guardId, checkpointId, siteId, timestamp, ... status
  scansSheet.appendRow([
    Utilities.getUuid(),
    testGuard.empId, // Scans use empId
    '', // No checkpoint for checkin
    siteId,
    scanTime,
    '0.0', '0.0', // lat, lng
    '10', // accuracy
    'CHECKIN', // STATUS (Critical)
    '', '', '', ''
  ]);
  
  // 3. VERIFY: Call the Dashboard Backend Logic
  console.log('... Verifying Dashboard Status...');
  
  // Re-run the core logic
  const dashboardData = getPatrolStatus();
  
  // Find our site
  const siteStatus = dashboardData.find(s => s.siteCode === siteId || s.siteId === siteId); // Robust finding
  
  // 4. REPORT
  if (!siteStatus) {
    console.error('FAILURE: Site VKS-A-001 not found in Dashboard Data');
    return;
  }
  
  console.log('--- TEST RESULTS ---');
  console.log('Site:', siteStatus.siteName);
  console.log('Status:', siteStatus.status); // Should be 'active'
  console.log('Assigned Guard:', siteStatus.guardName); // Should be 'Robot'
  console.log('Shift Type:', siteStatus.shiftType); // Should be 'Ad-hoc'
  
  if (siteStatus.status === 'active' && siteStatus.guardName.includes('Robot')) {
    console.log('SUCCESS: Scan-Based Assignment is WORKING.');
  } else {
    console.error('FAILURE: Dashboard did not update correctly.');
    console.log('Expected: active / Robot');
    console.log(`Got: ${siteStatus.status} / ${siteStatus.guardName}`);
  }
}
