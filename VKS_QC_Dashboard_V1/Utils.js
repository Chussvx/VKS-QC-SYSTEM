// Utils.gs - Helper functions

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @param {string} format - 'short', 'long', 'time', 'datetime'
 * @returns {string} Formatted date
 */
function formatDate(date, format = 'short') {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const tz = 'GMT+7';
  switch (format) {
    case 'short':
      return Utilities.formatDate(d, tz, 'dd/MM/yyyy');
    case 'long':
      return Utilities.formatDate(d, tz, 'dd MMMM yyyy');
    case 'time':
      return Utilities.formatDate(d, tz, 'HH:mm');
    case 'datetime':
      return Utilities.formatDate(d, tz, 'dd/MM/yyyy HH:mm');
    case 'iso':
      return d.toISOString();
    default:
      return Utilities.formatDate(d, tz, format);
  }
}

/**
 * Format time ago (relative time)
 * @param {Date|string} date - Date to compare
 * @returns {string} "5 min ago", "2 hours ago", etc.
 */
function timeAgo(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const seconds = Math.floor((now - d) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
  if (seconds < 604800) return Math.floor(seconds / 86400) + ' days ago';
  return formatDate(d, 'short');
}

/**
 * Calculate SLA due date based on type and severity
 * @param {string} type - 'incident' or 'complaint'
 * @param {string} severity - 'light', 'medium', 'severe'
 * @param {Date} createdAt - Creation time
 * @returns {object} { priority, dueDate }
 */
function calculateSLA(type, severity, createdAt = new Date()) {
  const created = new Date(createdAt);
  let hoursToAdd, priority;
  
  if (type === 'incident') {
    switch (severity) {
      case 'severe':
        hoursToAdd = 4;
        priority = 'Critical';
        break;
      case 'medium':
        hoursToAdd = 12;
        priority = 'Critical';
        break;
      case 'light':
      default:
        hoursToAdd = 24;
        priority = 'High';
    }
  } else { // complaint
    switch (severity) {
      case 'severe':
        hoursToAdd = 72; // 3 days
        priority = 'High';
        break;
      case 'medium':
        hoursToAdd = 120; // 5 days
        priority = 'Medium';
        break;
      case 'light':
      default:
        hoursToAdd = 168; // 7 days
        priority = 'Low';
    }
  }
  
  const dueDate = new Date(created.getTime() + hoursToAdd * 60 * 60 * 1000);
  return { priority, dueDate };
}

/**
 * Check if SLA is overdue
 * @param {Date|string} dueDate - SLA due date
 * @returns {boolean} Is overdue
 */
function isOverdue(dueDate) {
  if (!dueDate) return false;
  return new Date() > new Date(dueDate);
}

/**
 * Generate UUID
 * @returns {string} UUID
 */
function generateUUID() {
  return Utilities.getUuid();
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Is valid
 */
function validateEmail(email) {
  if (!email) return false;
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
}

/**
 * Validate phone format
 * @param {string} phone - Phone to validate
 * @returns {boolean} Is valid
 */
function validatePhone(phone) {
  if (!phone) return false;
  // Allow various formats: +856, 020, etc.
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  return /^[\+]?[0-9]{8,15}$/.test(cleaned);
}

/**
 * Sanitize string for safe display
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitize(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Parse query parameters from URL
 * @param {string} url - URL with parameters
 * @returns {object} Parameter key-value pairs
 */
function parseQueryParams(url) {
  const params = {};
  const queryString = url.split('?')[1];
  if (!queryString) return params;
  
  queryString.split('&').forEach(pair => {
    const [key, value] = pair.split('=');
    params[decodeURIComponent(key)] = decodeURIComponent(value || '');
  });
  
  return params;
}

/**
 * Calculate overtime rate
 * @param {Date} date - Work date
 * @param {number} startHour - Start hour (0-23)
 * @returns {number} Rate multiplier (1.0, 1.5, 2.0, 3.0)
 */
function calculateOTRate(date, startHour) {
  const d = new Date(date);
  const dayOfWeek = d.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Check if holiday (would need holidays sheet)
  const isHoliday = false; // TODO: Check holidays sheet
  
  if (isHoliday) return 3.0;
  if (dayOfWeek === 0 || dayOfWeek === 6) return 2.0;
  if (startHour >= 22 || startHour < 6) return 1.5 * 1.25; // Night + OT
  return 1.5;
}

/**
 * Get shift type based on hour
 * @param {number} hour - Hour of day (0-23)
 * @returns {string} 'morning', 'evening', 'night'
 */
function getShiftType(hour) {
  if (hour >= 6 && hour < 14) return 'morning';
  if (hour >= 14 && hour < 22) return 'evening';
  return 'night';
}

/**
 * Calculate distance between two GPS coordinates (in meters)
 * @param {number} lat1 - Latitude 1
 * @param {number} lon1 - Longitude 1
 * @param {number} lat2 - Latitude 2
 * @param {number} lon2 - Longitude 2
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Check if GPS location is within acceptable range of checkpoint
 * @param {number} scanLat - Scan latitude
 * @param {number} scanLon - Scan longitude
 * @param {number} checkpointLat - Checkpoint latitude
 * @param {number} checkpointLon - Checkpoint longitude
 * @param {number} threshold - Acceptable distance in meters
 * @returns {boolean} Is within range
 */
function isWithinRange(scanLat, scanLon, checkpointLat, checkpointLon, threshold = 50) {
  const distance = calculateDistance(scanLat, scanLon, checkpointLat, checkpointLon);
  return distance <= threshold;
}

/**
 * Get setting value from Settings sheet
 * @param {string} key - Setting key
 * @param {any} defaultValue - Default if not found
 * @returns {any} Setting value
 */
function getSetting(key, defaultValue = null) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Settings');
  if (!sheet) return defaultValue;
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      return data[i][1];
    }
  }
  return defaultValue;
}

/**
 * Set setting value in Settings sheet
 * @param {string} key - Setting key
 * @param {any} value - Value to set
 */
function setSetting(key, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Settings');
  
  if (!sheet) {
    sheet = ss.insertSheet('Settings');
    sheet.appendRow(['Key', 'Value', 'UpdatedAt', 'UpdatedBy']);
  }
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      sheet.getRange(i + 1, 3).setValue(new Date());
      sheet.getRange(i + 1, 4).setValue(Session.getActiveUser().getEmail());
      return;
    }
  }
  
  // Add new setting
  sheet.appendRow([key, value, new Date(), Session.getActiveUser().getEmail()]);
}
/**
 * Helper to get header index (case-insensitive)
 * @param {string[]} headers - Array of sheet headers
 * @param {string[]} names - Possible names for the column
 * @returns {number} Column index (0-based) or -1
 */
function getCIIndex(headers, names) {
  if (!headers || !names) return -1;
  const lowerHeaders = headers.map(h => String(h).trim().toLowerCase());
  for (const name of names) {
    const idx = lowerHeaders.indexOf(name.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}
