# Fix nginx configuration on VPS
$hk = "SHA256:eL0Ano2eSH/4Pl2jxzVH8zHYeGMbNCVOB5yrq0C64lE"

Write-Host "Creating backup of nginx config..." -ForegroundColor Cyan
& "C:\Windows\Temp\plink.exe" "root@109.123.253.238" -pw "Supreme001" -hostkey $hk -batch "cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S)" 2>&1 | Out-Null

Write-Host "Fixing location /api/ -> /api in nginx config..." -ForegroundColor Yellow
$fixCmd = @"
sed -i 's|location /api/ {|location /api {|' /etc/nginx/sites-available/default && \
sed -i 's|proxy_pass http://127.0.0.1:3000/;|proxy_pass http://127.0.0.1:3000;|' /etc/nginx/sites-available/default && \
nginx -t && systemctl reload nginx
"@

Write-Host "Applying fix..." -ForegroundColor Cyan
$result = & "C:\Windows\Temp\plink.exe" "root@109.123.253.238" -pw "Supreme001" -hostkey $hk -batch $fixCmd 2>&1 | Select-Object -Last 20

$result | ForEach-Object { Write-Host $_ }

Start-Sleep -Seconds 2

Write-Host "`nTesting API endpoint after fix..." -ForegroundColor Cyan
try {
    $test = Invoke-RestMethod -Uri "http://axentis.uz/api/users/count" -Method Get -ErrorAction Stop
    Write-Host "тЬЕ SUCCESS! Response: $($test | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "тЬХ Still failing: $($_.Exception.Message)" -ForegroundColor Red
}
