# Check axentis.uz specific config
$hk = "SHA256:eL0Ano2eSH/4Pl2jxzVH8zHYeGMbNCVOB5yrq0C64lE"

Write-Host "Reading /etc/nginx/sites-available/axentis.uz config..." -ForegroundColor Cyan
$config = & "C:\Windows\Temp\plink.exe" "root@109.123.253.238" -pw "Supreme001" -hostkey $hk -batch "cat /etc/nginx/sites-available/axentis.uz" 2>&1 | Select-Object -Last 80

$config | ForEach-Object { Write-Host $_ }
