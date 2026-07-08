# Get Docker status from VPS
$hk = "SHA256:eL0Ano2eSH/4Pl2jxzVH8zHYeGMbNCVOB5yrq0C64lE"
$tempFile = [System.IO.Path]::GetTempFileName()

# Run docker ps command
$command = "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
& "C:\Windows\Temp\plink.exe" "root@109.123.253.238" -pw "Supreme001" -hostkey $hk -batch $command > $tempFile 2>&1

# Display output
Write-Host "`n=== Docker Containers on VPS ===" -ForegroundColor Cyan
Get-Content $tempFile | Select-Object -Skip 1 | ForEach-Object {
    if ($_ -match '\S') {
        Write-Host $_
    }
}

# Cleanup
Remove-Item $tempFile -ErrorAction SilentlyContinue
