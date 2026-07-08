# Full Docker Rebuild - VPS Deployment Helper
# Commit: 41cfc3a - Smart duplicate product merging

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  FULL DOCKER REBUILD - AXENTIS MARKET" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

$VPS_HOST = "109.123.253.238"
$VPS_PASSWORD = "Supreme001"
$PROJECT_PATH = "/root/Axentis-market"

Write-Host "Latest commit:" -ForegroundColor Yellow
$latestCommit = git log -1 --pretty=format:"%h - %s"
Write-Host "  $latestCommit" -ForegroundColor Green
Write-Host ""

Write-Host "===============================================" -ForegroundColor Magenta
Write-Host "  DEPLOYMENT INSTRUCTIONS" -ForegroundColor Magenta
Write-Host "===============================================" -ForegroundColor Magenta
Write-Host ""

Write-Host "Step 1: Connect to VPS" -ForegroundColor Cyan
Write-Host "  ssh root@$VPS_HOST" -ForegroundColor White
Write-Host "  Password: $VPS_PASSWORD" -ForegroundColor Gray
Write-Host ""

Write-Host "Step 2: Run full rebuild script" -ForegroundColor Cyan
Write-Host "  cd $PROJECT_PATH" -ForegroundColor White
Write-Host "  bash full-rebuild-vps.sh" -ForegroundColor White
Write-Host ""

Write-Host "OR manually run these commands:" -ForegroundColor Yellow
Write-Host "  cd $PROJECT_PATH" -ForegroundColor White
Write-Host "  git pull origin main" -ForegroundColor White
Write-Host "  docker-compose down" -ForegroundColor White
Write-Host "  docker-compose build --no-cache" -ForegroundColor White
Write-Host "  docker-compose up -d" -ForegroundColor White
Write-Host "  docker ps" -ForegroundColor White
Write-Host ""

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  NEW FEATURE: Smart Duplicate Detection" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "How it works:" -ForegroundColor Yellow
Write-Host "  + Products are matched by key characteristics:" -ForegroundColor Green
Write-Host "    - Name (case-insensitive)" -ForegroundColor Gray
Write-Host "    - Price (0.01 tolerance)" -ForegroundColor Gray
Write-Host "    - Barcode (if present)" -ForegroundColor Gray
Write-Host "    - Barid (if present)" -ForegroundColor Gray
Write-Host ""
Write-Host "  + When duplicate found:" -ForegroundColor Green
Write-Host "    - Quantity is ADDED (not replaced)" -ForegroundColor Gray
Write-Host "    - Single product record maintained" -ForegroundColor Gray
Write-Host ""
Write-Host "  + Works in all scenarios:" -ForegroundColor Green
Write-Host "    - Manual product addition" -ForegroundColor Gray
Write-Host "    - Excel file import" -ForegroundColor Gray
Write-Host "    - CSV/TXT file import" -ForegroundColor Gray
Write-Host ""

Write-Host "Example:" -ForegroundColor Yellow
Write-Host "  1st Add: Name='iPhone 15', Price=5000000, Qty=10" -ForegroundColor White
Write-Host "           Result: New product created with Qty=10" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  2nd Add: Name='iPhone 15', Price=5000000, Qty=5" -ForegroundColor White
Write-Host "           Result: Quantity updated: 10 + 5 = 15" -ForegroundColor DarkGray
Write-Host "           (No duplicate product created!)" -ForegroundColor Green
Write-Host ""

Write-Host "===============================================" -ForegroundColor Magenta
Write-Host ""

# Copy commands to clipboard
$commands = @"
cd $PROJECT_PATH
bash full-rebuild-vps.sh
"@

try {
    $commands | Set-Clipboard
    Write-Host "Commands copied to clipboard!" -ForegroundColor Green
    Write-Host "Paste after SSH connection" -ForegroundColor Gray
} catch {
    # Silently ignore
}

Write-Host ""
Write-Host "After deployment, test at: https://axentis.uz" -ForegroundColor Cyan
Write-Host ""
