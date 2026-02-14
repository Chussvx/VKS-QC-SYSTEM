$path = 'd:\VKS Company\VKS QC DASHBOARD V1\Sites.gs'
$lines = Get-Content $path
# Keep 0 to 1051 (Lines 1 to 1052)
# Remove 1052 to 1157 (Lines 1053 to 1158) - The legacy duplicates
# Keep 1158 to End (Lines 1159+)
$newContent = $lines[0..1051] + $lines[1158..($lines.Count - 1)]
$newContent | Set-Content $path -Encoding UTF8
Write-Host "Duplicate cleanup complete."
