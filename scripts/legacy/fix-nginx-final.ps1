# Fix nginx configuration - updated version
$hk = "SHA256:eL0Ano2eSH/4Pl2jxzVH8zHYeGMbNCVOB5yrq0C64lE"

Write-Host "Fixing nginx config and reloading..." -ForegroundColor Yellow

$fixCmd = "cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup && sed -i 's@location /api/ {@location /api {@' /etc/nginx/sites-available/default && sed -i 's@proxy_pass http://127.0.0.1:3000/;@proxy_pass http://127.0.0.1:3000;@' /etc/nginx/sites-available/default && nginx -t && systemctl reload nginx && echo 'SUCCESS: Nginx reloaded'"

Write-Host "Applying fix..." -ForegroundColor Cyan
$result = & "C:\Windows\Temp\plink.exe" "root@109.123.253.238" -pw "Supreme001" -hostkey $hk -batch $fixCmd 2>&1 | Select-Object -Last 25

$result | ForEach-Object { Write-Host $_ }

Start-Sleep -Seconds 3

Write-Host "`nTesting API endpoints..." -ForegroundColor Cyan
try {
    $test1 = Invoke-RestMethod -Uri "http://axentis.uz/api/users/count" -Method Get -ErrorAction Stop
    Write-Host "тЬЕ /api/users/count SUCCESS! Response: $($test1 | ConvertTo-Json)" -ForegroundColor Green
    
    $test2 = Invoke-RestMethod -Uri "http://axentis.uz/api/companies" -Method Get -ErrorAction Stop  
    Write-Host "тЬЕ /api/companies SUCCESS! Returned $($test2.Count) companies" -ForegroundColor Green
} catch {
    Write-Host "тЬХ Still failing: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
}
