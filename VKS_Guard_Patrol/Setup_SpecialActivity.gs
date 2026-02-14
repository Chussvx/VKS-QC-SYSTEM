function setupSpecialActivitySheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = "SpecialActivity_Logs";
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    // Columns: ID, Timestamp, Type, PatrolName, SiteName, TargetGuard, StartTime, EndTime, Duration, Status, Ratings, PhotoURL, Notes
    var headers = [
      "ID",
      "Timestamp",
      "Type",
      "PatrolName",
      "SiteName",
      "TargetGuard",
      "StartTime", 
      "EndTime", 
      "Duration", 
      "Status", 
      "Ratings", 
      "PhotoURL", 
      "Notes"
    ];
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    console.log("Created " + sheetName + " tab.");
  } else {
    console.log(sheetName + " tab already exists.");
  }
}

function testSetup() {
  setupSpecialActivitySheet();
}
