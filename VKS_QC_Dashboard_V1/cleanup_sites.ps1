$path = 'd:\VKS Company\VKS QC DASHBOARD V1\Sites.gs'
$lines = Get-Content $path
# Keep 0 to 886 (Line 1 to 887) - End of new function body
# Skip 887 to 1003 (Line 888 to 1004) - The legacy code block
# Keep 1004 to End - Start of saveCheckpoint
$newContent = $lines[0..886] + $lines[1004..($lines.Count - 1)]
$newContent | Set-Content $path -Encoding UTF8
Write-Host "Cleanup complete."
