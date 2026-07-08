# Deploy Latest Changes to VPS
# This script helps deploy the latest version with translations and analytics improvements

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🚀 DEPLOY TO VPS - AXENTIS MARKET" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$VPS_HOST = "109.123.253.238"
$VPS_USER = "root"
$VPS_PASSWORD = "Supreme001"
$PROJECT_PATH = "/root/Axentis-market"

# Check git status
Write-Host "✅ Verifying local repository status..." -ForegroundColor Green
$gitStatus = git status --porcelain
$latestCommit = git log -1 --pretty=format:"%h - %s"
$remoteStatus = git status -sb

Write-Host "   Latest commit: " -NoNewline -ForegroundColor Gray
Write-Host "$latestCommit" -ForegroundColor White
Write-Host "   $remoteStatus" -ForegroundColor Gray

if ($gitStatus) {
    Write-Host ""
    Write-Host "⚠️  Warning: You have uncommitted changes!" -ForegroundColor Yellow
    Write-Host "$gitStatus" -ForegroundColor DarkGray
    Write-Host ""
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "  📋 DEPLOYMENT INSTRUCTIONS" -ForegroundColor Magenta
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host ""

Write-Host "OPTION 1: Manual Deployment (Recommended)" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""
Write-Host "1. Connect to VPS:" -ForegroundColor Cyan
Write-Host "   ssh root@$VPS_HOST" -ForegroundColor White
Write-Host "   Password: " -NoNewline -ForegroundColor DarkGray
Write-Host "$VPS_PASSWORD" -ForegroundColor White
Write-Host ""

Write-Host "2. Run deployment script:" -ForegroundColor Cyan
Write-Host "   cd $PROJECT_PATH" -ForegroundColor White
Write-Host "   bash deploy-vps.sh" -ForegroundColor White
Write-Host ""

Write-Host "OR run commands manually:" -ForegroundColor Yellow
Write-Host "   cd $PROJECT_PATH && git pull origin main" -ForegroundColor White
Write-Host "   docker-compose build frontend --no-cache" -ForegroundColor White
Write-Host "   docker-compose up -d --force-recreate frontend" -ForegroundColor White
Write-Host "   docker ps" -ForegroundColor White
Write-Host ""

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  📝 CHANGES IN THIS DEPLOYMENT (Commit 8ed4dbe)" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Analytics Panel Improvements:" -ForegroundColor Yellow
Write-Host "  ✓ Changed 'Sarflangan' card: orange → blue" -ForegroundColor Green
Write-Host "    (No longer looks like red/error)" -ForegroundColor DarkGray
Write-Host "  ✓ Enhanced period selector with visible label" -ForegroundColor Green
Write-Host "  ✓ Added chart descriptions:" -ForegroundColor Green
Write-Host "    - Purchases dynamics: 'Changes over time'" -ForegroundColor DarkGray
Write-Host "    - Top 5 products: 'Most purchased'" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Excel Import Panel - Full Uzbek Translation:" -ForegroundColor Yellow
Write-Host "  ✓ All field labels translated (uz/ru)" -ForegroundColor Green
Write-Host "  ✓ Column mapping instructions translated" -ForegroundColor Green
Write-Host "  ✓ Progress messages during import translated" -ForegroundColor Green
Write-Host "  ✓ Dark mode support added" -ForegroundColor Green
Write-Host ""
Write-Host "  Bug Fixes:" -ForegroundColor Yellow
Write-Host "  ✓ Fixed CompanyPanel JSX syntax error" -ForegroundColor Green
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host ""

# Copy deployment commands to clipboard
try {
    $deployCommands = @"
cd $PROJECT_PATH
bash deploy-vps.sh
"@
    $deployCommands | Set-Clipboard
    Write-Host ">> Deployment commands copied to clipboard!" -ForegroundColor Green
    Write-Host "   Paste them after SSH connection" -ForegroundColor DarkGray
} catch {
    Write-Host "TIP: Manual copy commands if needed" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Visit after deployment: " -NoNewline
Write-Host "https://axentis.uz/#/analytics" -ForegroundColor Cyan
Write-Host ""

