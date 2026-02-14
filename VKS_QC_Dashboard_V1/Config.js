/**
 * Config.gs - Application configuration and constants
 * 
 * Contains spreadsheet IDs, sheet names, and global settings.
 */

// ===========================================
// SPREADSHEET IDs
// ===========================================

/**
 * VKS Guard Patrol Sheet (READ-ONLY)
 * Source: VKS Guard Patrol App
 * Contains: Inspection logs, evaluations, photos, handover notes
 */
const SPREADSHEET_ID_PATROL = '199tZWltRfX1t4-WYqXlz7z89seGkZuB7eV4RlsbLhl0';

/**
 * VKS QC Master Sheet (READ/WRITE)
 * Source: This app + VKS Stationary Guard App
 * Contains: Guards, Sites, Checkpoints, Scans, Shifts, OT, Issues
 * 
 * ⚠️ CRITICAL: UPDATE THIS ID BEFORE DEPLOYMENT!
 * 1. Create a new Google Sheet for QC data
 * 2. Copy the spreadsheet ID from the URL
 * 3. Replace 'YOUR_QC_SPREADSHEET_ID_HERE' below
 *    URL format: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit
 */
const SPREADSHEET_ID_QC = '1jVeiXS7wl8-eA1DSgiMOsgElZCL0ILGMficC1mrZFyI'; // Re-verifying if this stays same or changes based on Script ID context

/**
 * QR Codes Storage Folder
 */
const FOLDER_ID_QR = '1RJyHS2QKMzKh42eKf1-vqUGXFt9OfBy6';

/**
 * VKS Stationary Guard App URL (for QR Codes)
 * Target: Deployed Web App URL of the Guard App
 * Used by: QR Generator to create smart redirect links
 */
const GUARD_APP_URL = 'https://script.google.com/macros/s/AKfycbxvM98b3m_GkvtKm8wpBDWZKqt0Bj-G-KFpajSDy1mNlZg7PZxd030fPVF5yyliyT_7uQ/exec';

// ===========================================
// GEMINI AI API
// ===========================================
const GEMINI_API_KEY = 'AIzaSyBTPdonh2OYLdagSUUlh8KJpe81tT9s-BA';
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';

// ===========================================
// SHEET NAMES - Guard Patrol (External)
// ===========================================
const SHEET_PATROL_LOGS = 'Logs';
const SHEET_PATROL_COMMENTS = 'Site_Comments';
const SHEET_SITE_CONFIG = 'Site_Config'; // New config sheet in Patrol DB

// ===========================================
// SHEET NAMES - QC Master (Internal)
// ===========================================
const SHEET_GUARDS = 'Guards';
const SHEET_SITES = 'Sites';
const SHEET_CHECKPOINTS = 'Checkpoints';
const SHEET_SCANS = 'Scans';
const SHEET_SHIFTS = 'Shifts';
const SHEET_OVERTIME = 'Overtime';
const SHEET_ISSUES = 'Issues';  // DEPRECATED - migrating to separate tabs
const SHEET_INCIDENTS = 'Incidents';  // NEW - security events
const SHEET_COMPLAINTS = 'Complaints';  // NEW - client complaints
const SHEET_LOCATIONS = 'Locations';
const SHEET_INSPECTION_LOGS = 'InspectionLogs';
const SHEET_SETTINGS = 'Settings';
const SHEET_USERS = 'Users';
const SHEET_ACTIVITY_LOG = 'ActivityLog';
const SHEET_PATROL_PLANS = 'PatrolPlans';

// NEW: Migration target tabs
const SHEET_INSPECTORS = 'Inspectors';
const SHEET_HANDOVER_RECORDS = 'HandoverRecords';
const SHEET_SPECIAL_ACTIVITY = 'SpecialActivityLogs';

// ===========================================
// COLUMN DEFINITIONS
// ===========================================

const COLUMNS = {
  guards: ['id', 'name', 'surname', 'empId', 'phone', 'email', 'siteId', 'status', 'photo', 'startDate', 'createdAt', 'updatedAt'],
  sites: ['id', 'code', 'nameEN', 'nameLO', 'type', 'route', 'address', 'district', 'province', 'lat', 'lng', 'contactName', 'contactPhone', 'contactEmail', 'status', 'notes', 'checkpointTarget', 'roundsTarget', 'patrolConditions', 'shiftType', 'shiftStart', 'shiftEnd', 'createdAt', 'updatedAt'],
  locations: ['id', 'siteId', 'siteName', 'code', 'name', 'type', 'order', 'required', 'qrStatus', 'driveUrl', 'generatedAt', 'updatedAt'],
  checkpoints: ['id', 'siteId', 'name', 'location', 'sequence', 'required', 'createdAt'],
  scans: ['id', 'guardId', 'checkpointId', 'siteId', 'timestamp', 'lat', 'lng', 'accuracy', 'status', 'round'],
  // 22 columns matching Patrol Dashboard
  inspectionLogs: [
    'timestamp', 'patrolName', 'route', 'siteName', 'guardName', 'shift',
    'startTime', 'finishTime', 'duration', 'score', 'status',
    'flashlight', 'uniform', 'defenseTools', 'logbook', 'gates',
    'lighting', 'fireSafety', 'gps', 'patrolLogs', 'details', 'issues',
    'handoverComment', 'syncedAt' // Local only
  ],
  shifts: ['id', 'guardId', 'siteId', 'date', 'shiftType', 'startTime', 'endTime', 'status', 'notes', 'createdAt'],
  overtime: ['id', 'guardId', 'siteId', 'date', 'scheduledHrs', 'actualHrs', 'otHrs', 'rate', 'status', 'approvedBy', 'approvedAt', 'notes'],
  issues: ['id', 'type', 'category', 'severity', 'priority', 'location', 'reportDate', 'incidentTime', 'description', 'reporterName', 'reporterType', 'guardId', 'status', 'dueDate', 'resolvedAt', 'resolution', 'createdAt', 'updatedAt'],
  settings: ['key', 'value', 'description', 'updatedAt'],
  users: ['id', 'email', 'name', 'role', 'status', 'lastLogin'],
  activityLog: ['id', 'userId', 'action', 'entity', 'entityId', 'details', 'timestamp'],
  // NEW: Migration target columns
  inspectors: ['id', 'name', 'status', 'shift', 'createdAt', 'updatedAt'],
  handoverRecords: ['id', 'timestamp', 'siteName', 'guardName', 'comment', 'syncedAt'],
  specialActivity: ['id', 'timestamp', 'type', 'patrolName', 'siteName', 'targetGuard', 'startTime', 'endTime', 'duration', 'status', 'ratings', 'photoUrl', 'notes', 'syncedAt'],
  patrolPlans: ['id', 'date', 'shift', 'route', 'siteId', 'siteName', 'createdBy', 'createdAt']
};

// ===========================================
// STATUS DEFINITIONS
// ===========================================

const STATUS = {
  guard: {
    ACTIVE: 'active',
    ON_LEAVE: 'on_leave',
    OFF_DUTY: 'off_duty',
    TERMINATED: 'terminated'
  },
  site: {
    ACTIVE: 'active',
    INACTIVE: 'inactive'
  },
  scan: {
    ON_TIME: 'on_time',
    LATE: 'late',
    MISSED: 'missed',
    GPS_MISMATCH: 'gps_mismatch'
  },
  shift: {
    SCHEDULED: 'scheduled',
    CONFIRMED: 'confirmed',
    ABSENT: 'absent',
    COMPLETED: 'completed'
  },
  overtime: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected'
  },
  issue: {
    WAITING: 'waiting',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed'
  }
};

// ===========================================
// SHIFT TYPES
// ===========================================

const SHIFT_TYPES = {
  MORNING: { name: 'Morning', start: '06:00', end: '14:00', icon: '🌅' },
  EVENING: { name: 'Evening', start: '14:00', end: '22:00', icon: '🌆' },
  NIGHT: { name: 'Night', start: '22:00', end: '06:00', icon: '🌙' }
};

// ===========================================
// SITE TYPES
// ===========================================

const SITE_TYPES = [
  'Hotel', 'Office', 'Residential', 'Warehouse', 'Bank',
  'School', 'Restaurant', 'NGO', 'Construction', 'Retail',
  'Embassy', 'Other'
];

// ===========================================
// PATROL ROUTES
// ===========================================

const ROUTES = {
  A: { name: 'Route A', description: 'Eastern Circuit' },
  B: { name: 'Route B', description: 'Western Circuit' },
  SPECIAL: { name: 'Special', description: 'Embassy/VIP sites' }
};

// ===========================================
// SLA RULES
// ===========================================

const SLA = {
  incident: {
    light: { priority: 'high', hours: 24 },
    medium: { priority: 'critical', hours: 12 },
    severe: { priority: 'critical', hours: 4 }
  },
  complaint: {
    light: { priority: 'low', days: 7 },
    medium: { priority: 'medium', days: 5 },
    severe: { priority: 'high', days: 3 }
  }
};
