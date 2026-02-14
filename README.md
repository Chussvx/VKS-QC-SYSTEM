# VKS QC System

The VKS Quality Control ecosystem — a suite of interconnected Google Apps Script web applications for managing security operations across 70+ sites in Laos.

## 📁 Projects

### 1. VKS QC Dashboard V1 (`VKS_QC_Dashboard_V1/`)
**Desktop-first command center** for QC supervisors and managers.
- Real-time patrol monitoring with live map
- Incident & complaint management
- Performance analytics & KPI dashboards
- Guard & site management
- QR code generation for checkpoints
- Bilingual support (English + Lao)

### 2. VKS Guard Patrol (`VKS_Guard_Patrol/`)
**Mobile patrol reporting app** for roaming inspectors.
- 7-step evaluation workflow
- Multi-site inspection routes
- Photo evidence capture
- Handover notes & scoring (1-10)
- Lao language primary

### 3. VKS Stationary Guard App (`VKS_Stationary_Guard_App/`)
**Mobile PWA** for fixed-post security guards.
- QR-based check-in / patrol / checkout
- 3×8 hour shift management
- Hourly patrol rounds with quick assessments
- Offline-capable with GPS tracking
- Bilingual support (English + Lao)

## 🛠️ Tech Stack
- **Platform**: Google Apps Script (GAS)
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Database**: Google Sheets
- **Storage**: Google Drive (photos & documents)
- **Deployment**: GAS Web App publishing

## 📊 Architecture
All three apps share a common Google Sheets database with core tables:
- `PTR_Scans` — Patrol tracking records
- `PTR_Sites` — Site master data
- `PTR_Guards` — Guard profiles
- `Incidents` / `Complaints` — Issue tracking
