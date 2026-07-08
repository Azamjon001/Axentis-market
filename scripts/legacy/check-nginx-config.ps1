# Check nginx configuration on VPS
$hk = "SHA256:eL0Ano2eSH/4Pl2jxzVH8zHYeGMbNCVOB5yrq0C64lE"

Write-Host "Checking nginx sites-enabled..." -ForegroundColor Cyan
$sitesEnabled = & "C:\Windows\Temp\plink.exe" "root@109.123.253.238" -pw "Supreme001" -hostkey $hk -batch "ls -la /etc/nginx/sites-enabled/" 2>&1 | Select-Object -Last 20

$sitesEnabled | ForEach-Object { Write-Host $_ }

Write-Host "`nChecking nginx default config..." -ForegroundColor Cyan
$defaultConfig = & "C:\Windows\Temp\plink.exe" "root@109.123.253.238" -pw "Supreme001" -hostkey $hk -batch "cat /etc/nginx/sites-enabled/default" 2>&1 | Select-Object -Last 100

$defaultConfig | ForEach-Object { Write-Host $_ }
