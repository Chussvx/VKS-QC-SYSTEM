@echo off
echo Starting VKS QC Dashboard V1 Deployment...
echo.
echo This will deploy the UI/UX enhanced version to Google Apps Script
echo.

cd /d "D:\VKS Company\VKS QC DASHBOARD V1"

echo Checking clasp authentication...
npx @google/clasp show-file-status
if %errorlevel% neq 0 (
    echo ERROR: Authentication failed. Please run: npx @google/clasp login
    pause
    exit /b 1
)

echo.
echo Clearing deploy cache to force fresh push...
del /f /q ".deploy-cache.json" 2>nul

echo Starting deployment...
npx @google/clasp push --force

if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo   DEPLOYMENT SUCCESSFUL!
    echo ============================================
    echo   UI/UX enhancements deployed:
    echo   - Loading states added
    echo   - Error handling improved
    echo   - User-friendly messages
    echo   - Visual feedback enhanced
    echo ============================================
) else (
    echo.
    echo ============================================
    echo   DEPLOYMENT FAILED!
    echo ============================================
    echo Please check the error messages above
)

echo.
pause