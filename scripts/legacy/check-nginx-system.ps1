# Check nginx status on VPS
$hk = "SHA256:eL0Ano2eSH/4Pl2jxzVH8zHYeGMbNCVOB5yrq0C64lE"

Write-Host "Checking system nginx..." -ForegroundColor Cyan
$nginxCheck = & "C:\Windows\Temp\plink.exe" "root@109.123.253.238" -pw "Supreme001" -hostkey $hk -batch "systemctl status nginx 2>&1 | head -20" 2>&1 | Select-Object -Last 25

$nginxCheck | ForEach-Object { Write-Host $_ }

Write-Host "`nChecking which process is listening on port 80..." -ForegroundColor Cyan  
$port80 = & "C:\Windows\Temp\plink.exe" "root@109.123.253.238" -pw "Supreme001" -hostkey $hk -batch "lsof -i :80 2>&1 || netstat -tlnp | grep :80" 2>&1 | Select-Object -Last 15

$port80 | ForEach-Object { Write-Host $_ }

Write-Host "`nTesting backend directly on port 3000..." -ForegroundColor Cyan
$direct = & "C:\Windows\Temp\plink.exe" "root@109.123.253.238" -pw "Supreme001" -hostkey $hk -batch "curl -s http://localhost:3000/api/users/count" 2>&1 | Select-Object -Last 5

Write-Host "Direct backend response:" -ForegroundColor Green
$direct | ForEach-Object { Write-Host $_ }
