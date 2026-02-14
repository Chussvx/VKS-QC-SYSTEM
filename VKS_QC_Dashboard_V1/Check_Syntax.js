/**
 * Check_Syntax.gs - Utility functions for debugging syntax issues
 * 
 * Run these from the Apps Script editor to validate HTML/JS content
 */

/**
 * Validates that all script tags in HTML files are properly closed
 * Run this from the Apps Script editor: validateHtmlSyntax()
 */
function validateHtmlSyntax() {
  const htmlFiles = [
    'Page_InspectionLogs',
    'Page_PatrolStatus', 
    'Page_Dashboard',
    'Modal_Inspection',
    'JavaScript'
  ];
  
  const results = [];
  
  htmlFiles.forEach(function(fileName) {
    try {
      const template = HtmlService.createTemplateFromFile(fileName);
      const html = template.evaluate().getContent();
      
      // Count script tags
      const openScripts = (html.match(/<script>/gi) || []).length;
      const closeScripts = (html.match(/<\/script>/gi) || []).length;
      
      // Count template literals (backticks)
      const backticks = (html.match(/`/g) || []).length;
      
      results.push({
        file: fileName,
        status: openScripts === closeScripts ? 'OK' : 'MISMATCH',
        openScripts: openScripts,
        closeScripts: closeScripts,
        backticks: backticks,
        backticksBalanced: backticks % 2 === 0
      });
      
    } catch (e) {
      results.push({
        file: fileName,
        status: 'ERROR',
        error: e.message
      });
    }
  });
  
  Logger.log('=== HTML Syntax Check Results ===');
  results.forEach(function(r) {
    Logger.log(JSON.stringify(r, null, 2));
  });
  
  return results;
}

/**
 * Test if a specific HTML file can be evaluated without errors
 */
function testHtmlFile(fileName) {
  try {
    const template = HtmlService.createTemplateFromFile(fileName || 'Page_InspectionLogs');
    const html = template.evaluate().getContent();
    Logger.log('✅ ' + fileName + ' - OK (' + html.length + ' bytes)');
    return { success: true, size: html.length };
  } catch (e) {
    Logger.log('❌ ' + fileName + ' - ERROR: ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Quick test for the inspection logs page specifically
 */
function testInspectionLogs() {
  return testHtmlFile('Page_InspectionLogs');
}

/**
 * Test all main pages
 */
function testAllPages() {
  const pages = [
    'Index',
    'Page_Dashboard',
    'Page_InspectionLogs',
    'Page_PatrolStatus',
    'Page_Sites',
    'Page_Guards',
    'Modal_Inspection'
  ];
  
  const results = {};
  pages.forEach(function(page) {
    results[page] = testHtmlFile(page);
  });
  
  Logger.log('=== All Pages Test Complete ===');
  return results;
}
