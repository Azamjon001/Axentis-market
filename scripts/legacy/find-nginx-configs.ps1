# Find all nginx configs
$hk = "SHA256:eL0Ano2eSH/4Pl2jxzVH8zHYeGMbNCVOB5yrq0C64lE"

Write-Host "Finding all nginx config files..." -ForegroundColor Cyan
$configs = & "C:\Windows\Temp\plink.exe" "root@109.123.253.238" -pw "Supreme001" -hostkey $hk -batch "find /etc/nginx -name '*.conf' -o -name 'default' -o -name 'axentis*' 2>/dev/null" 2>&1 | Select-Object -Last 30

$configs | ForEach-Object { Write-Host $_ }

Write-Host "`nChecking /etc/nginx/sites-available/..." -ForegroundColor Cyan
$sitesAvail = & "C:\Windows\Temp\plink.exe" "root@109.123.253.238" -pw "Supreme001" -hostkey $hk -batch "ls -l /etc/nginx/sites-available/" 2>&1 | Select-Object -Last 20

$sitesAvail | ForEach-Object { Write-Host $_ }

Write-Host "`nGrepping for 'server_name axentis' in nginx configs..." -ForegroundColor Cyan
$grep = & "C:\Windows\Temp\plink.exe" "root@109.123.253.238" -pw "Supreme001" -hostkey $hk -batch "grep -r 'server_name.*axentis' /etc/nginx/ 2>/dev/null || echo 'No matches'" 2>&1 | Select-Object -Last 20

$grep | ForEach-Object { Write-Host $_ }
