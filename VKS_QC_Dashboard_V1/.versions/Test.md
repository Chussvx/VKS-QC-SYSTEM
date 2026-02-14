# Deploy & Test Log

## [Test Track] - Saved Versions
**Status**: ⚡ Active Development
**Deployment (TEST)**: [Launch TEST](https://script.google.com/macros/s/AKfycbz89Z7UA_cdEZXb4Fp02Us8w_5PHiJVTEuiMZ_NRjj71ix6gLvpLzoKlORRUa9rPiwOdQ/exec)
**ID**: `AKfycbz89Z7UA_cdEZXb4Fp02Us8w_5PHiJVTEuiMZ_NRjj71ix6gLvpLzoKlORRUa9rPiwOdQ`
**Current Version**: v203 (Cached Loading)

### Latest Changes (v140)
- **Feature**: Separate `Incidents` and `Complaints` tabs (previously combined in `Issues`)
- **Added**: `Migration.gs` - auto-creates new tabs on first load, migrates/deletes old Issues tab
- **Added**: `Modal_IncidentForm.html` - 3-tab form (Details, Response, Evidence)
- **Added**: `Modal_ComplaintForm.html` - 2-tab form (Issue Details, Reporter Info)
- **Updated**: `Issues.gs` - complete rewrite for separate tabs with new schemas
- **Updated**: `Config.gs` - added SHEET_INCIDENTS, SHEET_COMPLAINTS constants
- **Updated**: `Code.gs` - calls initializeSheets() on load for auto-migration
- **Docs**: `docs/SHEET_SCHEMAS.md` - full schema documentation for all 13 tabs

### v139 (Previous)
- **SUCCESS**: Deployed v135 stable code as version @139 on TEST track
- **Status**: ✅ Inspection logs and popup working correctly

---

## Older Logs

### [v137] - Syntax Fix
- **Fix**: Removed accidental markdown formatting (```) at end of file.

### [v136] - Missing Data Implementation
- **Added**: Duration (e.g., 0 min), Start-Finish Time, GPS Map Button.
- **Added**: Raw Inspector Score (e.g., 4.5) alongside Pass %.
- **Fix**: Photos now use preview-friendly URLs.

### [v135] - Refinements: Shift/Ratings/Photos
- **Shift**: Split "Shift 1 (Permanent)" into Name and Badge.
- **Ratings**: Regex extraction for Comm/Uniform scores.
- **Photos**: Removed "No photos available" text, replaced with clean UI placeholder.

### [v134] - Fix Modal Layout
- **UI Bug Fix**: Solved the "exploded" modal issue where header/footer were detached.
- **Structure**: All modal content is now inside a single `.card` wrapper.

### [v133] - Fix Popup Data Logic
- **Bug Fix**: "Sleeping" checked as 'No' now shows green check (logic inverted for negative questions).
- **Refinement**: Connected 'Checks Passed' % to real data.

### [v132] - Tailwind Integration
- **System**: Added `TailwindJS` include to `Index.html`.
- **Feature**: Complete Popup makeover using real Tailwind utility classes.

### [v131] - Fix Popup UI
- **UI**: Implemented manual Tailwind-like classes (`.tw-grid`, `.tw-p-4`) in `Modal_Inspection.html`.
- **Refactor**: Updated `Page_InspectionLogs.html` to generate cleaner HTML structure.

### [v130] - Fix Popup ID
- **Fix**: Resolved `TypeError: null` when opening inspection popup.

### [v129] - Initial Test Deployment
- Established dedicated "TEST" deployment ID.
- Verified Popup Port functionality.
