# VKS QC Dashboard - Complete GAS File Structure

## All Files (Flat - GAS Compatible)

### Backend Files (.gs)
| File | Functions |
|------|-----------|
| `Code.gs` | `doGet()`, `include()` |
| `Auth.gs` | `getCurrentUser()`, `checkPermission()`, `changePassword()`, `logout()` |
| `Data.gs` | `getData()`, `saveData()`, `deleteData()`, `getById()`, `getOptions()` |
| `Dashboard.gs` | `getDashboardKPIs()`, `getActiveAlerts()`, `getRecentActivity()`, `escalateAlert()` |
| `Reports.gs` | `generateReport()`, `getReportData()`, `generateBundleZIP()` |
| `Export.gs` | `exportToCSV()`, `exportToPDF()`, `printQRSheet()` |
| `Utils.gs` | `formatDate()`, `calculateSLA()`, `generateUUID()`, `validateEmail()` |

### Core HTML Files
| File | Purpose |
|------|---------|
| `Index.html` | SPA shell with includes |
| `Styles.html` | CSS variables + utilities |
| `Sidebar.html` | 16-page navigation |
| `Header.html` | Clock, user, actions |
| `JavaScript.html` | Router, modals, API |

### Page Content Files
| File | Key Features |
|------|--------------|
| `Page_Dashboard.html` | 5 KPI cards, map, alerts feed, activity chart |
| `Page_SiteMap.html` | Leaflet map, markers, filter panel |
| `Page_PatrolStatus.html` | Live table, status badges, filters |
| `Page_InspectionLogs.html` | Inspection table, photos, export |
| `Page_HandoverRecords.html` | Timeline feed, handover notes |
| `Page_GuardActivity.html` | Scan table, timeline view toggle |
| `Page_Incidents.html` | Stats cards, table, filters |
| `Page_Complaints.html` | Stats cards, table, filters |
| `Page_Performance.html` | KPIs, charts, coverage gaps |
| `Page_Reports.html` | 8 report type cards |
| `Page_Guards.html` | Roster table, filters |
| `Page_Sites.html` | Sites table, Route A/B |
| `Page_Calendar.html` | Month grid, shift colors |
| `Page_Overtime.html` | OT table, approval buttons |
| `Page_QRGenerator.html` | Site select, checkpoint list |
| `Page_Settings.html` | Sections, toggles, thresholds |

### Modal Template Files
| File | Contains |
|------|----------|
| `Modal_Dashboard.html` | Alert detail |
| `Modal_Incidents.html` | Add/View incident forms |
| `Modal_Complaints.html` | Add/View complaint forms |
| `Modal_Guards.html` | Add/Edit guard form |
| `Modal_Sites.html` | Add/Edit site form |
| `Modal_Calendar.html` | Add/Edit shift form |
| `Modal_Overtime.html` | OT detail, approve/reject |
| `Modal_QRGenerator.html` | Add checkpoint, QR preview, print layout |
| `Modal_Settings.html` | Password change, logout confirm |
| `Modal_Reports.html` | 8 report config modals |

---

## Google Sheets Structure

| Sheet | Columns |
|-------|---------|
| `Users` | ID, Email, Name, Role, Avatar, Phone |
| `Sites` | ID, Name, Address, Route, Lat, Lng, Type, Status, GuardCount, CheckpointCount |
| `Guards` | ID, Name, Phone, Email, SiteID, Status, StartDate, Photo |
| `Incidents` | ID, Date, SiteID, GuardID, Category, Severity, Priority, Status, DueDate, Description, Reporter, ActionBy |
| `Complaints` | ID, Date, SiteID, Type, Severity, Priority, Status, DueDate, Description, CustomerName, CustomerPhone |
| `InspectionLogs` | ID, Date, SiteID, InspectorID, GuardID, Route, CommScore, UniformScore, Notes, Photos |
| `SiteComments` | ID, Date, SiteID, InspectorID, Comment, LogID |
| `GuardActivity` | ID, Timestamp, GuardID, SiteID, CheckpointID, Round, Lat, Lng, Status |
| `Schedules` | ID, Date, ShiftType, SiteID, GuardID, Status, Notes, Recurring |
| `Overtime` | ID, Date, GuardID, SiteID, ScheduledHours, ActualHours, OTHours, Rate, Status, ApprovedBy, Reason |
| `QRCheckpoints` | ID, SiteID, Name, Location, Required, Sequence |
| `CalendarEvents` | ID, Date, Title, Type, SiteID, Description |
| `Settings` | Key, Value, UpdatedAt, UpdatedBy |
| `ActivityLog` | Timestamp, UserEmail, Action, Details |

---

## Naming Convention

| Type | Prefix | Example |
|------|--------|---------|
| Backend | (none) | `Code.gs`, `Auth.gs` |
| Core HTML | (none) | `Styles.html`, `Index.html` |
| Page content | `Page_` | `Page_Dashboard.html` |
| Modal template | `Modal_` | `Modal_Incidents.html` |

---

## Status Badge Colors

| Status | Color | Used In |
|--------|-------|---------|
| Active/Normal | 🟢 Green | Guards, Sites, Patrols |
| Warning/Pending | 🟡 Yellow | Patrols, OT, Alerts |
| Alert/Critical | 🔴 Red | Incidents, Late, Overdue |
| Inactive/Gray | ⚪ Gray | Guards, Sites, Offline |
| Info | 🔵 Blue | Complete, Approved |
| Special | 🟣 Purple | Night shift, Priority |

---

## Permission Levels

| Role | CRUD | Export | Admin |
|------|------|--------|-------|
| Admin | ✅ | ✅ | ✅ |
| Supervisor | ✅ | ✅ | ❌ |
| Inspector | View + Create | ❌ | ❌ |
| Guard | View own | ❌ | ❌ |
| Viewer | View only | ❌ | ❌ |
