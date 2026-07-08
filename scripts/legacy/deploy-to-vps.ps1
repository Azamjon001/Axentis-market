# Deploy Latest Changes to VPS - Axentis Market
# Commit: 8ed4dbe - Multilingual Excel import + Analytics improvements

param(
    [switch]$ShowChanges
)

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  DEPLOY TO VPS - AXENTIS MARKET" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# VPS Configuration
$VPS_HOST = "109.123.253.238"
$VPS_USER = "root"
$VPS_PASSWORD = "Supreme001"
$PROJECT_PATH = "/root/Axentis-market"

# Check git status
Write-Host "Checking local repository status..." -ForegroundColor Yellow
$latestCommit = git log -1 --pretty=format:"%h - %s"
Write-Host "Latest commit: $latestCommit" -ForegroundColor Green
Write-Host ""

# Display deployment instructions
Write-Host "===============================================" -ForegroundColor Magenta
Write-Host "  DEPLOYMENT INSTRUCTIONS" -ForegroundColor Magenta
Write-Host "===============================================" -ForegroundColor Magenta
Write-Host ""

Write-Host "Step 1: Connect to VPS" -ForegroundColor Cyan
Write-Host "  ssh root@$VPS_HOST" -ForegroundColor White
Write-Host "  Password: $VPS_PASSWORD" -ForegroundColor Gray
Write-Host ""

Write-Host "Step 2: Navigate and deploy" -ForegroundColor Cyan
Write-Host "  cd $PROJECT_PATH" -ForegroundColor White
Write-Host "  git pull origin main" -ForegroundColor White
Write-Host "  docker-compose build frontend --no-cache" -ForegroundColor White
Write-Host "  docker-compose up -d --force-recreate frontend" -ForegroundColor White
Write-Host ""

Write-Host "Step 3: Verify" -ForegroundColor Cyan
Write-Host "  docker ps" -ForegroundColor White
Write-Host ""

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  CHANGES IN THIS VERSION" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Analytics Panel:" -ForegroundColor Yellow
Write-Host "  + Blue color for expenses card (not red-like)" -ForegroundColor Green
Write-Host "  + Period selector with visible label" -ForegroundColor Green
Write-Host "  + Chart descriptions added" -ForegroundColor Green
Write-Host ""

Write-Host "Excel Import Panel:" -ForegroundColor Yellow
Write-Host "  + Full Uzbek translation" -ForegroundColor Green
Write-Host "  + Dark mode support" -ForegroundColor Green
Write-Host "  + Import progress messages translated" -ForegroundColor Green
Write-Host ""

Write-Host "===============================================" -ForegroundColor Magenta
Write-Host ""

# Copy commands to clipboard
$commands = @"
cd $PROJECT_PATH
git pull origin main
docker-compose build frontend --no-cache
docker-compose up -d --force-recreate frontend
docker ps
"@

try {
    $commands | Set-Clipboard
    Write-Host "Commands copied to clipboard!" -ForegroundColor Green
    Write-Host "Paste them after connecting via SSH" -ForegroundColor Gray
} catch {
    # Silently ignore clipboard errors
}

Write-Host ""
Write-Host "After deployment, visit: https://axentis.uz" -ForegroundColor Cyan
Write-Host ""
