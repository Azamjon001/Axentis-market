# Update Backend on Ubuntu Server - Fix Company Messages Display Issue

Write-Host "🚀 Updating backend on server 109.123.253.238..." -ForegroundColor Cyan

# Define server details
$SERVER = "root@109.123.253.238"
$APP_DIR = "/root/onlineshop2"

Write-Host "📤 Uploading updated company_messages.go..." -ForegroundColor Yellow
scp backend/routes/handlers/company_messages.go ${SERVER}:${APP_DIR}/backend/routes/handlers/

Write-Host "🔄 Restarting backend container..." -ForegroundColor Yellow
ssh $SERVER "cd $APP_DIR; docker-compose restart backend"

Write-Host "" -ForegroundColor Green
Write-Host "✅ Backend updated and restarted!" -ForegroundColor Green
Write-Host "" -ForegroundColor Green

Write-Host "📊 Waiting 5 seconds then showing logs..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

Write-Host "📋 Backend logs (last 50 lines):" -ForegroundColor Cyan
ssh $SERVER "cd $APP_DIR; docker-compose logs --tail=50 backend"

Write-Host "" -ForegroundColor Green
Write-Host "💡 Test the message system now!" -ForegroundColor Yellow
Write-Host "   1. Send a message to all companies via admin panel" -ForegroundColor Gray
Write-Host "   2. Check the logs to see company IDs that received messages" -ForegroundColor Gray
Write-Host "   3. Open CompanyInboxPanel with one of those company IDs" -ForegroundColor Gray
Write-Host "   4. Check logs for the GET request with company ID" -ForegroundColor Gray

