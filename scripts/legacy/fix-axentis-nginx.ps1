# Fix CORRECT nginx config file (axentis.uz, not default)
$hk = "SHA256:eL0Ano2eSH/4Pl2jxzVH8zHYeGMbNCVOB5yrq0C64lE"

Write-Host "Fixing /etc/nginx/sites-available/axentis.uz config..." -ForegroundColor Yellow

$fixCmd = "cp /etc/nginx/sites-available/axentis.uz /etc/nginx/sites-available/axentis.uz.backup && sed -i 's@location /api/ {@location /api {@' /etc/nginx/sites-available/axentis.uz && sed -i 's@proxy_pass http://127.0.0.1:3000/;@proxy_pass http://127.0.0.1:3000;@' /etc/nginx/sites-available/axentis.uz && nginx -t && systemctl reload nginx && echo 'SUCCESS: Nginx reloaded with correct config'"

Write-Host "Applying fix..." -ForegroundColor Cyan
$result = & "C:\Windows\Temp\plink.exe" "root@109.123.253.238" -pw "Supreme001" -hostkey $hk -batch $fixCmd 2>&1 | Select-Object -Last 25

$result | ForEach-Object { Write-Host $_ }

Write-Host "`nVerifying updated config..." -ForegroundColor Cyan
$verify = & "C:\Windows\Temp\plink.exe" "root@109.123.253.238" -pw "Supreme001" -hostkey $hk -batch "grep -A2 'location /api' /etc/nginx/sites-available/axentis.uz" 2>&1 | Select-Object -Last 10

Write-Host "Updated config:" -ForegroundColor Green
$verify | ForEach-Object { Write-Host $_ }

Start-Sleep -Seconds 3

Write-Host "`nтЬЕ FINAL TEST - Testing API endpoints..." -ForegroundColor Cyan
try {
    $test1 = Invoke-RestMethod -Uri "http://axentis.uz/api/users/count" -Method Get -ErrorAction Stop
    Write-Host "тЬЕтЬЕтЬЕ /api/users/count SUCCESS! Response: $($test1 | ConvertTo-Json)" -ForegroundColor Green
    
    $test2 = Invoke-RestMethod -Uri "http://axentis.uz/api/companies" -Method Get -ErrorAction Stop  
    Write-Host "тЬЕтЬЕтЬЕ /api/companies SUCCESS! Returned $($test2.Count) companies" -ForegroundColor Green
    
    Write-Host "`nтЬЕтЬЕтЬЕ ALL FIXED! Backend is working correctly!" -ForegroundColor Green -BackgroundColor Black
} catch {
    Write-Host "тЬХ Still failing: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
}
