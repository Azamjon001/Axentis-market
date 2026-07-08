# Deploy Purchase Feature to VPS
$VPS_IP = "109.123.253.238"
$VPS_USER = "root"
$VPS_PASSWORD = "Supreme001"
$PROJECT_DIR = "/root/Axentis-market"

Write-Host "=== Deploying Purchase Feature to VPS ===" -ForegroundColor Cyan
Write-Host ""

# Create SSH command script
$sshScript = @"
cd $PROJECT_DIR
echo "📥 Pulling latest code..."
git pull origin main
echo ""
echo "🛑 Stopping containers..."
docker-compose down
echo ""
echo "🔨 Rebuilding containers..."
docker-compose build --no-cache
echo ""
echo "🚀 Starting containers..."
docker-compose up -d
echo ""
echo "✅ Deployment complete!"
docker ps
"@

# Execute via plink (if available) or ssh
try {
    Write-Host "Connecting to VPS..." -ForegroundColor Yellow
    
    # Use plink if available, otherwise ssh
    if (Get-Command plink -ErrorAction SilentlyContinue) {
        Write-Host "Using plink..." -ForegroundColor Green
        echo y | plink -batch -pw "$VPS_PASSWORD" "$VPS_USER@$VPS_IP" $sshScript
    } else {
        Write-Host "Using ssh (you may need to enter password)..." -ForegroundColor Green
        ssh "$VPS_USER@$VPS_IP" $sshScript
    }
    
    Write-Host ""
    Write-Host "✅ Deployment completed!" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
}
