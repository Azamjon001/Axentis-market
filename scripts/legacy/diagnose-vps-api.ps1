# Test backend API from inside Docker network
$hk = "SHA256:eL0Ano2eSH/4Pl2jxzVH8zHYeGMbNCVOB5yrq0C64lE"

Write-Host "Testing backend health endpoint..." -ForegroundColor Cyan
$healthCmd = "cd /root/Axentis-market && docker exec onlineshop2-backend wget -q -O - http://localhost:3000/health"
$health = & "C:\Windows\Temp\plink.exe" "root@109.123.253.238" -pw "Supreme001" -hostkey $hk -batch $healthCmd 2>&1 | Select-Object -Last 5

Write-Host "Health response:" -ForegroundColor Green
$health | ForEach-Object { Write-Host $_ }

Write-Host "`nTesting /api/users/count..." -ForegroundColor Cyan
$countCmd = "cd /root/Axentis-market && docker exec onlineshop2-backend wget -q -O - http://localhost:3000/api/users/count"
$count = & "C:\Windows\Temp\plink.exe" "root@109.123.253.238" -pw "Supreme001" -hostkey $hk -batch $countCmd 2>&1 | Select-Object -Last 5

Write-Host "Users count response:" -ForegroundColor Green
$count | ForEach-Object { Write-Host $_ }

Write-Host "`nChecking if nginx container exists..." -ForegroundColor Cyan
$nginxCmd = "docker ps --filter 'name=nginx' --format '{{.Names}}'"
$nginx = & "C:\Windows\Temp\plink.exe" "root@109.123.253.238" -pw "Supreme001" -hostkey $hk -batch $nginxCmd 2>&1 | Select-Object -Last 10

Write-Host "Nginx containers:" -ForegroundColor Green
$nginx | ForEach-Object { Write-Host $_ }
