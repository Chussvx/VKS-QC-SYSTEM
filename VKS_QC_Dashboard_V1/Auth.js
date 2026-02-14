// Auth.gs - User authentication and permissions

/**
 * Get current logged-in user info
 * @returns {Object} User object with name, role, email, avatar
 */
function getCurrentUser() {
  const email = Session.getActiveUser().getEmail();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName('Users');
  
  if (!userSheet) {
    return { name: 'Guest', role: 'Viewer', email: email, avatar: '' };
  }
  
  const users = userSheet.getDataRange().getValues();
  const headers = users[0];
  const emailCol = headers.indexOf('Email');
  const nameCol = headers.indexOf('Name');
  const roleCol = headers.indexOf('Role');
  const avatarCol = headers.indexOf('Avatar');
  
  for (let i = 1; i < users.length; i++) {
    if (users[i][emailCol] === email) {
      return {
        id: users[i][headers.indexOf('ID')],
        name: users[i][nameCol] || 'User',
        role: users[i][roleCol] || 'Staff',
        email: email,
        avatar: users[i][avatarCol] || ''
      };
    }
  }
  
  return { name: email.split('@')[0], role: 'Guest', email: email, avatar: '' };
}

/**
 * Check if user has permission for an action
 * @param {string} action - Action to check (view, create, edit, delete, export)
 * @param {string} resource - Resource type (incidents, guards, sites, etc.)
 * @returns {boolean} Has permission
 */
function checkPermission(action, resource) {
  const user = getCurrentUser();
  const role = user.role;
  
  // Role-based permissions matrix
  const permissions = {
    'Admin': ['view', 'create', 'edit', 'delete', 'export'],
    'QC Lead': ['view', 'create', 'edit', 'export'],
    'Supervisor': ['view', 'create', 'edit'],
    'Staff': ['view', 'create'],
    'Viewer': ['view'],
    'Guest': ['view']
  };
  
  const allowed = permissions[role] || permissions['Guest'];
  return allowed.includes(action);
}

/**
 * Log user activity
 * @param {string} action - Action performed
 * @param {string} details - Additional details
 */
function logActivity(action, details) {
  const user = getCurrentUser();
  const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ActivityLog');
  
  if (logSheet) {
    logSheet.appendRow([
      new Date(),
      user.email,
      user.name,
      action,
      details
    ]);
  }
}
