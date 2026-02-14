# VKS QC Dashboard - Complete Sheet Schemas

## Spreadsheet Configuration

| Sheet | Constant | Purpose |
|-------|----------|---------|
| Guards | `SHEET_GUARDS` | Guard personnel records |
| Sites | `SHEET_SITES` | Client site information |
| Checkpoints | `SHEET_CHECKPOINTS` | Patrol checkpoints |
| Locations | `SHEET_LOCATIONS` | QR code locations |
| Scans | `SHEET_SCANS` | Guard scan records |
| Shifts | `SHEET_SHIFTS` | Shift scheduling |
| Overtime | `SHEET_OVERTIME` | OT tracking |
| Incidents | `SHEET_INCIDENTS` | Security incidents |
| Complaints | `SHEET_COMPLAINTS` | Client complaints |
| InspectionLogs | `SHEET_INSPECTION_LOGS` | QC inspection records |
| Settings | `SHEET_SETTINGS` | App configuration |
| Users | `SHEET_USERS` | Dashboard users |
| ActivityLog | `SHEET_ACTIVITY_LOG` | Audit trail |

---

## Guards Tab

| Column | Type | Description |
|--------|------|-------------|
| id | String | Guard ID |
| name | String | First name |
| surname | String | Last name |
| empId | String | Employee ID |
| phone | String | Phone number |
| email | String | Email address |
| siteId | String | Assigned site |
| status | Enum | active/on_leave/off_duty/terminated |
| photo | String | Photo URL |
| startDate | Date | Employment start |
| createdAt | DateTime | Record created |
| updatedAt | DateTime | Last updated |

---

## Sites Tab

| Column | Type | Description |
|--------|------|-------------|
| id | String | Site ID |
| code | String | Short code |
| nameEN | String | Name (English) |
| nameLO | String | Name (Lao) |
| type | Enum | Hotel/Office/Residential/etc |
| route | String | Patrol route (A/B/Special) |
| address | String | Street address |
| district | String | District |
| province | String | Province |
| lat | Number | Latitude |
| lng | Number | Longitude |
| contactName | String | Client contact |
| contactPhone | String | Contact phone |
| contactEmail | String | Contact email |
| status | Enum | active/inactive |
| notes | Text | Notes |
| checkpointTarget | Number | Target checkpoints per round |
| roundsTarget | Number | Target rounds per shift |
| patrolConditions | Text | Patrol requirements |
| shiftType | String | Morning/Evening/Night |
| shiftStart | Time | Shift start time |
| shiftEnd | Time | Shift end time |
| createdAt | DateTime | Record created |
| updatedAt | DateTime | Last updated |

---

## Locations Tab (QR Checkpoints)

| Column | Type | Description |
|--------|------|-------------|
| id | String | Location ID |
| siteId | String | Parent site |
| siteName | String | Site name (cached) |
| code | String | Location code |
| name | String | Location name |
| type | String | Location type |
| order | Number | Sequence order |
| required | Boolean | Required checkpoint? |
| qrStatus | Enum | pending/generated/printed |
| driveUrl | String | QR image URL |
| generatedAt | DateTime | QR generation time |
| updatedAt | DateTime | Last updated |

---

## Checkpoints Tab

| Column | Type | Description |
|--------|------|-------------|
| id | String | Checkpoint ID |
| siteId | String | Parent site |
| name | String | Checkpoint name |
| location | String | Physical location |
| sequence | Number | Order in patrol |
| required | Boolean | Required? |
| createdAt | DateTime | Record created |

---

## Scans Tab

| Column | Type | Description |
|--------|------|-------------|
| id | String | Scan ID |
| guardId | String | Guard who scanned |
| checkpointId | String | Checkpoint scanned |
| siteId | String | Site |
| timestamp | DateTime | Scan time |
| lat | Number | Latitude |
| lng | Number | Longitude |
| accuracy | Number | GPS accuracy (m) |
| status | Enum | on_time/late/missed/gps_mismatch |
| round | Number | Round number |

---

## Shifts Tab

| Column | Type | Description |
|--------|------|-------------|
| id | String | Shift ID |
| guardId | String | Assigned guard |
| siteId | String | Site |
| date | Date | Shift date |
| shiftType | Enum | Morning/Evening/Night |
| startTime | Time | Start time |
| endTime | Time | End time |
| status | Enum | scheduled/confirmed/absent/completed |
| notes | Text | Notes |
| createdAt | DateTime | Record created |

---

## Overtime Tab

| Column | Type | Description |
|--------|------|-------------|
| id | String | OT ID |
| guardId | String | Guard |
| siteId | String | Site |
| date | Date | OT date |
| scheduledHrs | Number | Scheduled hours |
| actualHrs | Number | Actual hours |
| otHrs | Number | OT hours |
| rate | Number | OT rate |
| status | Enum | pending/approved/rejected |
| approvedBy | String | Approval by |
| approvedAt | DateTime | Approval time |
| notes | Text | Notes |

---

## Incidents Tab (NEW)

| Column | Type | Description |
|--------|------|-------------|
| id | String | INC-YYYYMMDD-XXXX |
| title | String | Incident title |
| description | Text | Full details |
| siteId | String | Site reference |
| category | Enum | theft/fire/medical/vandalism/access |
| severity | Enum | critical/high/medium/low |
| status | Enum | waiting/in_progress/resolved/closed |
| incidentTime | DateTime | When occurred |
| reportedTime | DateTime | When reported |
| reportedBy | String | Reporter name |
| reportedTo | String | Who received |
| responseTime | DateTime | Response arrival |
| respondedBy | String | First responder |
| resolvedTime | DateTime | Resolution time |
| injuries | Boolean | Any injuries |
| propertyDamage | Boolean | Any damage |
| estimatedLoss | Number | Loss value |
| authoritiesNotified | Boolean | Called police/fire |
| policeReportNo | String | Report number |
| cctvAvailable | Boolean | CCTV exists |
| photos | String | Drive folder link |
| witnesses | String | Witness names |
| immediateActions | Text | Actions taken |
| notes | Text | Additional notes |
| dueDate | DateTime | SLA deadline |
| createdAt | DateTime | Record created |
| updatedAt | DateTime | Last updated |

---

## Complaints Tab (NEW)

| Column | Type | Description |
|--------|------|-------------|
| id | String | CMP-YYYYMMDD-XXXX |
| customerName | String | Complainant |
| customerPhone | String | Contact phone |
| customerType | Enum | client/guard/staff/public |
| siteId | String | Site reference |
| guardId | String | Guard involved |
| category | Enum | service/behavior/billing/punctuality/uniform |
| severity | Enum | light/medium/severe |
| priority | Enum | p1/p2/p3/p4 |
| status | Enum | waiting/in_progress/resolved/closed |
| description | Text | Problem details |
| resolution | Text | How resolved |
| disciplinaryAction | String | Action taken |
| notifiedBy | String | Staff notified |
| recordedBy | String | Staff logged |
| assignedTo | String | Staff assigned |
| approvedBy | String | Manager approval |
| timestamp | DateTime | When logged |
| dueDate | DateTime | SLA deadline |
| completionDate | DateTime | When closed |
| createdAt | DateTime | Record created |
| updatedAt | DateTime | Last updated |

---

## InspectionLogs Tab

| Column | Type | Description |
|--------|------|-------------|
| timestamp | DateTime | Inspection time |
| patrolName | String | Patrol name |
| route | String | Route |
| siteName | String | Site |
| guardName | String | Guard inspected |
| shift | String | Shift type |
| startTime | Time | Start |
| finishTime | Time | Finish |
| duration | Number | Duration (min) |
| score | Number | Score (0-100) |
| status | String | Status |
| flashlight | Boolean | Has flashlight |
| uniform | Boolean | Proper uniform |
| defenseTools | Boolean | Has tools |
| logbook | Boolean | Logbook OK |
| gates | Boolean | Gates secured |
| lighting | Boolean | Lighting OK |
| fireSafety | Boolean | Fire safety OK |
| gps | String | GPS status |
| patrolLogs | Text | Log summary |
| details | Text | Details |
| issues | Text | Issues found |
| handoverComment | Text | Handover notes |
| syncedAt | DateTime | Sync time |

---

## Settings Tab

| Column | Type | Description |
|--------|------|-------------|
| key | String | Setting key |
| value | String | Setting value |
| description | String | Description |
| updatedAt | DateTime | Last updated |

---

## Users Tab

| Column | Type | Description |
|--------|------|-------------|
| id | String | User ID |
| email | String | Email |
| name | String | Display name |
| role | Enum | admin/qc/viewer |
| status | Enum | active/inactive |
| lastLogin | DateTime | Last login |

---

## ActivityLog Tab

| Column | Type | Description |
|--------|------|-------------|
| id | String | Log ID |
| userId | String | User |
| action | String | CREATE/UPDATE/DELETE |
| entity | String | Entity type |
| entityId | String | Entity ID |
| details | Text | Details |
| timestamp | DateTime | When |

---

## SLA Rules

| Type | Severity | Response Time |
|------|----------|---------------|
| **Incidents** | | |
| | Critical | 4 hours |
| | High | 24 hours |
| | Medium | 72 hours |
| | Low | 168 hours |
| **Complaints** | | |
| | P1 | 4 hours |
| | P2 | 24 hours |
| | P3 | 72 hours |
| | P4 | 168 hours |
