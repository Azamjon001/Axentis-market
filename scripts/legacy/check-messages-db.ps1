# Check Company Messages in Database

Write-Host "🔍 Checking company_messages table in database..." -ForegroundColor Cyan

$SERVER = "root@109.123.253.238"
$APP_DIR = "/root/onlineshop2"

Write-Host "" -ForegroundColor Green
Write-Host "📊 Company IDs in database:" -ForegroundColor Yellow
ssh $SERVER "cd $APP_DIR; docker-compose exec -T db psql -U postgres -d azaton -c 'SELECT id, company_name FROM companies ORDER BY id;'"

Write-Host "" -ForegroundColor Green
Write-Host "📨 Messages in company_messages table:" -ForegroundColor Yellow
ssh $SERVER "cd $APP_DIR; docker-compose exec -T db psql -U postgres -d azaton -c 'SELECT * FROM company_messages ORDER BY created_at DESC LIMIT 20;'"

Write-Host "" -ForegroundColor Green
Write-Host "📈 Message count per company:" -ForegroundColor Yellow
ssh $SERVER "cd $APP_DIR; docker-compose exec -T db psql -U postgres -d azaton -c 'SELECT company_id, COUNT(*) as message_count FROM company_messages GROUP BY company_id ORDER BY company_id;'"

Write-Host "" -ForegroundColor Green
Write-Host "✅ Database check complete!" -ForegroundColor Green
