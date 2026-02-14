/**
 * ============================================
 * VKS Authentication & Activity Logging Backend
 * ============================================
 * Copy these functions into your Code.gs in the GAS editor.
 * Requires: VKS_Users and VKS_ActivityLog tabs already created.
 * ============================================
 */

// ─── CONFIGURATION ────────────────────────────────
var AUTH_SHEETS = {
  USERS: 'VKS_Users',
  ACTIVITY_LOG: 'VKS_ActivityLog'
};

// ─── UTILITY: Simple SHA-256 hash (server-side, UTF-8) ───
function hashPassword(password) {
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
  var hash = '';
  for (var i = 0; i < rawHash.length; i++) {
    var byte = rawHash[i];
    if (byte < 0) byte += 256;
    var hex = byte.toString(16);
    if (hex.length === 1) hex = '0' + hex;
    hash += hex;
  }
  return hash;
}

// ─── UTILITY: Generate random password ────────────
function generatePassword() {
  var chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  var pwd = 'VKS-';
  for (var i = 0; i < 6; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

// ─── UTILITY: Generate UUID ──────────────────────
function generateUUID() {
  return Utilities.getUuid();
}

// ─── ENSURE AUTH TABS EXIST ──────────────────────
function ensureAuthTabs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // VKS_Users
  var usersSheet = ss.getSheetByName(AUTH_SHEETS.USERS);
  if (!usersSheet) {
    usersSheet = ss.insertSheet(AUTH_SHEETS.USERS);
    usersSheet.appendRow(['ID', 'Name', 'Surname', 'Email', 'PasswordHash', 'Role', 'Status', 'CreatedAt', 'CreatedBy', 'LastLogin']);
    usersSheet.setFrozenRows(1);
  }
  
  // VKS_ActivityLog
  var logSheet = ss.getSheetByName(AUTH_SHEETS.ACTIVITY_LOG);
  if (!logSheet) {
    logSheet = ss.insertSheet(AUTH_SHEETS.ACTIVITY_LOG);
    logSheet.appendRow(['Timestamp', 'UserID', 'UserName', 'Action', 'Page', 'Target', 'Details']);
    logSheet.setFrozenRows(1);
  }
  
  return { success: true };
}

// ─── SEED ADMIN ACCOUNT ─────────────────────────
// Run this ONCE manually from the GAS editor to create the admin account.
function seedAdminAccount() {
  ensureAuthTabs();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(AUTH_SHEETS.USERS);
  var data = sheet.getDataRange().getValues();
  
  // Check if admin already exists
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][3]).toLowerCase() === 'joussvx2@gmail.com') {
      Logger.log('Admin account already exists.');
      return { success: false, message: 'Admin already exists' };
    }
  }
  
  var password = 'VKS@admin2024';
  var pwdHash = hashPassword(password);
  
  Logger.log('Admin password hash: ' + pwdHash);
  
  sheet.appendRow([
    generateUUID(),
    'Admin',
    'VKS',
    'Joussvx2@gmail.com',
    pwdHash,
    'admin',
    'active',
    new Date().toISOString(),
    'system',
    ''
  ]);
  
  SpreadsheetApp.flush();
  Logger.log('Admin account seeded successfully. Password: ' + password);
  return { success: true, message: 'Admin account created. Password: ' + password };
}

// ─── VALIDATE LOGIN ─────────────────────────────
function validateLogin(email, passwordHash) {
  try {
    ensureAuthTabs();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(AUTH_SHEETS.USERS);
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    
    var emailLower = String(email || '').trim().toLowerCase();
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rowEmail = String(row[3] || '').trim().toLowerCase();
      
      if (rowEmail === emailLower) {
        // Found user
        var status = String(row[6] || '').toLowerCase();
        if (status !== 'active') {
          return { success: false, message: 'Account is deactivated. Contact admin.' };
        }
        
        var storedHash = String(row[4] || '');
        
        // The client sends SHA-256(password) via browser crypto
        // The server stores SHA-256(password) via GAS Utilities
        // Both use UTF-8, so they should match for ASCII passwords.
        // If they don't match, try re-hashing server-side for comparison.
        var serverHash = hashPassword(passwordHash); // Double-hash fallback
        
        if (passwordHash === storedHash || serverHash === storedHash) {
          // Update LastLogin
          sheet.getRange(i + 1, 10).setValue(new Date().toISOString());
          SpreadsheetApp.flush();
          
          // If double-hash matched, update stored hash to match client format
          if (passwordHash !== storedHash && serverHash === storedHash) {
            // Migrate: store client-side hash so next login is direct match
            // Don't do this — it would break. Leave as-is.
            Logger.log('Login via server-rehash fallback for user: ' + email);
          }
          
          // Log the login
          logActivity(String(row[0]), 'LOGIN', 'System', 'Authentication', 'Login successful');
          
          return {
            success: true,
            user: {
              userId: String(row[0]),
              name: String(row[1] || ''),
              surname: String(row[2] || ''),
              email: String(row[3] || ''),
              role: String(row[5] || 'user')
            }
          };
        } else {
          Logger.log('Hash mismatch for ' + email + ': client=' + passwordHash.substring(0,8) + '... stored=' + storedHash.substring(0,8) + '... serverRehash=' + serverHash.substring(0,8) + '...');
          return { success: false, message: 'Incorrect password.' };
        }
      }
    }
    
    return { success: false, message: 'Email not found.' };
  } catch (e) {
    Logger.log('validateLogin error: ' + e.toString());
    return { success: false, message: 'Login failed. Please try again.' };
  }
}

// ─── CREATE USER (Admin Only) ───────────────────
function createUser(adminUserId, userData) {
  try {
    // Verify admin
    if (!isAdmin(adminUserId)) {
      return { success: false, message: 'Unauthorized. Admin access required.' };
    }
    
    var name = String(userData.name || '').trim();
    var surname = String(userData.surname || '').trim();
    var email = String(userData.email || '').trim();
    
    if (!name || !surname) {
      return { success: false, message: 'Name and Surname are required.' };
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(AUTH_SHEETS.USERS);
    
    // Check duplicate email if provided
    if (email) {
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][3]).trim().toLowerCase() === email.toLowerCase()) {
          return { success: false, message: 'A user with this email already exists.' };
        }
      }
    }
    
    var plainPassword = generatePassword();
    var pwdHash = hashPassword(plainPassword);
    var userId = generateUUID();
    
    // Generate email-like login if none provided
    var loginEmail = email || (name.toLowerCase() + '.' + surname.toLowerCase() + '@vks.local');
    
    sheet.appendRow([
      userId,
      name,
      surname,
      loginEmail,
      pwdHash,
      'user',
      'active',
      new Date().toISOString(),
      adminUserId,
      ''
    ]);
    
    SpreadsheetApp.flush();
    
    logActivity(adminUserId, 'CREATE', 'User Management', 'User: ' + name + ' ' + surname, 'Created new user account');
    
    return {
      success: true,
      message: 'User created successfully.',
      credentials: {
        userId: userId,
        loginEmail: loginEmail,
        password: plainPassword
      }
    };
  } catch (e) {
    Logger.log('createUser error: ' + e.toString());
    return { success: false, message: 'Failed to create user.' };
  }
}

// ─── GET ALL USERS (Admin Only) ─────────────────
function getUsers(adminUserId) {
  try {
    if (!isAdmin(adminUserId)) {
      return { success: false, message: 'Unauthorized.' };
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(AUTH_SHEETS.USERS);
    var data = sheet.getDataRange().getValues();
    
    var users = [];
    for (var i = 1; i < data.length; i++) {
      users.push({
        userId: String(data[i][0] || ''),
        name: String(data[i][1] || ''),
        surname: String(data[i][2] || ''),
        email: String(data[i][3] || ''),
        role: String(data[i][5] || 'user'),
        status: String(data[i][6] || 'active'),
        createdAt: String(data[i][7] || ''),
        lastLogin: String(data[i][9] || '')
      });
    }
    
    return { success: true, users: users };
  } catch (e) {
    Logger.log('getUsers error: ' + e.toString());
    return { success: false, message: 'Failed to load users.' };
  }
}

// ─── UPDATE USER (Admin Only) ───────────────────
function updateUser(adminUserId, userId, updates) {
  try {
    if (!isAdmin(adminUserId)) {
      return { success: false, message: 'Unauthorized.' };
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(AUTH_SHEETS.USERS);
    var data = sheet.getDataRange().getValues();
    
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === userId) {
        if (updates.name) sheet.getRange(i + 1, 2).setValue(updates.name);
        if (updates.surname) sheet.getRange(i + 1, 3).setValue(updates.surname);
        if (updates.status) sheet.getRange(i + 1, 7).setValue(updates.status);
        SpreadsheetApp.flush();
        
        logActivity(adminUserId, 'UPDATE', 'User Management', 'User: ' + (updates.name || data[i][1]), 'Updated user profile');
        return { success: true, message: 'User updated.' };
      }
    }
    
    return { success: false, message: 'User not found.' };
  } catch (e) {
    Logger.log('updateUser error: ' + e.toString());
    return { success: false, message: 'Failed to update user.' };
  }
}

// ─── RESET USER PASSWORD (Admin Only) ───────────
function resetUserPassword(adminUserId, userId) {
  try {
    if (!isAdmin(adminUserId)) {
      return { success: false, message: 'Unauthorized.' };
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(AUTH_SHEETS.USERS);
    var data = sheet.getDataRange().getValues();
    
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === userId) {
        var newPassword = generatePassword();
        var newHash = hashPassword(newPassword);
        sheet.getRange(i + 1, 5).setValue(newHash);
        SpreadsheetApp.flush();
        
        logActivity(adminUserId, 'UPDATE', 'User Management', 'User: ' + data[i][1] + ' ' + data[i][2], 'Password reset by admin');
        return { success: true, password: newPassword };
      }
    }
    
    return { success: false, message: 'User not found.' };
  } catch (e) {
    Logger.log('resetUserPassword error: ' + e.toString());
    return { success: false, message: 'Failed to reset password.' };
  }
}

// ─── CHANGE MY PASSWORD ─────────────────────────
function changeMyPassword(userId, oldPasswordHash, newPasswordHash) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(AUTH_SHEETS.USERS);
    var data = sheet.getDataRange().getValues();
    
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === userId) {
        var storedHash = String(data[i][4] || '');
        if (oldPasswordHash !== storedHash) {
          return { success: false, message: 'Current password is incorrect.' };
        }
        
        sheet.getRange(i + 1, 5).setValue(newPasswordHash);
        SpreadsheetApp.flush();
        
        logActivity(userId, 'UPDATE', 'Settings', 'Password', 'Changed own password');
        return { success: true, message: 'Password changed successfully.' };
      }
    }
    
    return { success: false, message: 'User not found.' };
  } catch (e) {
    Logger.log('changeMyPassword error: ' + e.toString());
    return { success: false, message: 'Failed to change password.' };
  }
}

// ─── IS ADMIN CHECK ─────────────────────────────
function isAdmin(userId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(AUTH_SHEETS.USERS);
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === userId && String(data[i][5]).toLowerCase() === 'admin') {
      return true;
    }
  }
  return false;
}

// ─── LOG ACTIVITY ───────────────────────────────
function logActivity(userId, action, page, target, details) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(AUTH_SHEETS.ACTIVITY_LOG);
    if (!sheet) return;
    
    // Get user name
    var userName = 'System';
    var usersSheet = ss.getSheetByName(AUTH_SHEETS.USERS);
    if (usersSheet) {
      var usersData = usersSheet.getDataRange().getValues();
      for (var i = 1; i < usersData.length; i++) {
        if (String(usersData[i][0]) === userId) {
          userName = String(usersData[i][1]) + ' ' + String(usersData[i][2]);
          break;
        }
      }
    }
    
    sheet.appendRow([
      new Date().toISOString(),
      userId,
      userName.trim(),
      action,
      page,
      target || '',
      details || ''
    ]);
    SpreadsheetApp.flush();
  } catch (e) {
    Logger.log('logActivity error: ' + e.toString());
  }
}

// ─── GET ACTIVITY LOGS (Admin Only) ─────────────
function getActivityLogs(adminUserId, filters) {
  try {
    if (!isAdmin(adminUserId)) {
      return { success: false, message: 'Unauthorized.' };
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(AUTH_SHEETS.ACTIVITY_LOG);
    if (!sheet) return { success: true, logs: [] };
    
    var data = sheet.getDataRange().getValues();
    var logs = [];
    
    for (var i = data.length - 1; i >= 1; i--) {
      var row = data[i];
      var log = {
        timestamp: String(row[0] || ''),
        userId: String(row[1] || ''),
        userName: String(row[2] || ''),
        action: String(row[3] || ''),
        page: String(row[4] || ''),
        target: String(row[5] || ''),
        details: String(row[6] || '')
      };
      
      // Apply filters
      if (filters) {
        if (filters.action && log.action !== filters.action) continue;
        if (filters.userId && log.userId !== filters.userId) continue;
        if (filters.page && log.page !== filters.page) continue;
        if (filters.startDate) {
          var logDate = new Date(log.timestamp);
          var startDate = new Date(filters.startDate);
          if (logDate < startDate) continue;
        }
        if (filters.endDate) {
          var logDate2 = new Date(log.timestamp);
          var endDate = new Date(filters.endDate);
          endDate.setHours(23, 59, 59, 999);
          if (logDate2 > endDate) continue;
        }
      }
      
      logs.push(log);
      
      // Limit to 500 most recent
      if (logs.length >= 500) break;
    }
    
    return { success: true, logs: logs };
  } catch (e) {
    Logger.log('getActivityLogs error: ' + e.toString());
    return { success: false, message: 'Failed to load activity logs.' };
  }
}

// ─── TEMPORARY: RESET ADMIN PASSWORD ─────────────
// Run this ONCE from the GAS editor, then DELETE this function.
function resetAdminPassword() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(AUTH_SHEETS.USERS);
  var data = sheet.getDataRange().getValues();
  
  var newPassword = 'VKS@admin2024';
  var newHash = hashPassword(newPassword);
  
  for (var i = 1; i < data.length; i++) {
    var email = String(data[i][3] || '').trim().toLowerCase();
    if (email === 'joussvx2@gmail.com') {
      sheet.getRange(i + 1, 5).setValue(newHash);
      SpreadsheetApp.flush();
      Logger.log('✅ Admin password reset to: ' + newPassword);
      Logger.log('   Hash stored: ' + newHash);
      return;
    }
  }
  
  Logger.log('❌ Admin account not found with email joussvx2@gmail.com');
}
