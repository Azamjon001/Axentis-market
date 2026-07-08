# ============================================================================
# REBUILD BACKEND ON VPS
# ============================================================================
# Запуск: .\rebuild-vps.ps1
# Или с паролем: .\rebuild-vps.ps1 -Password "твой_пароль"
# ============================================================================

param(
    [string]$Server = "root@109.123.253.238",
    [string]$Password = "",
    [string]$AppDir = "/root/onlineshop2"
)

Write-Host "🚀 Starting VPS backend rebuild..." -ForegroundColor Cyan
Write-Host "   Server: $Server" -ForegroundColor Gray
Write-Host "   AppDir: $AppDir" -ForegroundColor Gray
Write-Host ""

# Build the SSH commands to run on VPS
$commands = @"
set -e
echo '=== Current directory ==='
cd $AppDir && pwd

echo ''
echo '=== Git pull latest code ==='
git pull origin main

echo ''
echo '=== Docker container status ==='
docker ps -a | grep -E 'backend|postgres|frontend' || echo 'No matching containers'

echo ''
echo '=== Stopping backend ==='
docker compose stop backend 2>/dev/null || docker-compose stop backend 2>/dev/null || true

echo ''
echo '=== Rebuilding backend image (no cache) ==='
docker compose build --no-cache backend 2>/dev/null || docker-compose build --no-cache backend

echo ''
echo '=== Starting all services ==='
docker compose up -d 2>/dev/null || docker-compose up -d

echo ''
echo '=== Waiting 15 seconds for startup... ==='
sleep 15

echo ''
echo '=== Backend logs (last 60 lines) ==='
docker compose logs --tail=60 backend 2>/dev/null || docker-compose logs --tail=60 backend

echo ''
echo '=== API Health Tests ==='
echo -n 'Health check: '
curl -sf http://localhost:3000/health && echo 'OK' || echo 'FAILED'
echo -n 'Users count: '
curl -sf http://localhost:3000/api/users/count && echo '' || echo 'FAILED'
echo -n 'Companies list: '
curl -sf 'http://localhost:3000/api/companies' | head -c 200 && echo '...' || echo 'FAILED'

echo ''
echo '=== DONE! ==='
"@

if ($Password -ne "") {
    # If sshpass is available (Linux/WSL)
    Write-Host "📤 Uploading and running rebuild script via SSH..." -ForegroundColor Yellow
    $commands | ssh "${Server}" "bash -s"
} else {
    # Save commands to a temp script and show instructions
    $scriptPath = "$env:TEMP\vps_rebuild.sh"
    $commands | Out-File -FilePath $scriptPath -Encoding UTF8 -NoNewline
    
    Write-Host "📋 Commands saved to: $scriptPath" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  RUN THESE COMMANDS ON YOUR VPS (via SSH):" -ForegroundColor Green  
    Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  ssh root@109.123.253.238" -ForegroundColor White
    Write-Host ""
    Write-Host "  Then paste these commands:" -ForegroundColor White
    Write-Host ""
    Write-Host "  cd /root/onlineshop2" -ForegroundColor Yellow
    Write-Host "  git pull origin main" -ForegroundColor Yellow
    Write-Host "  docker compose stop backend" -ForegroundColor Yellow
    Write-Host "  docker compose build --no-cache backend" -ForegroundColor Yellow
    Write-Host "  docker compose up -d" -ForegroundColor Yellow
    Write-Host "  sleep 15 && docker compose logs --tail=60 backend" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Or upload and run the full script:" -ForegroundColor White
    Write-Host "  scp '$scriptPath' root@109.123.253.238:/tmp/rebuild.sh" -ForegroundColor Gray
    Write-Host "  ssh root@109.123.253.238 'bash /tmp/rebuild.sh'" -ForegroundColor Gray
    Write-Host ""
}
