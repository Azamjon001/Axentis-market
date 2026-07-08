# Скрипт для проверки наличия таблиц в базе данных PostgreSQL
Write-Host "🔍 Проверка таблиц в базе данных..." -ForegroundColor Cyan

# Настройки подключения (измените при необходимости)
$env:PGPASSWORD = "your_secure_password_here"
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_USER = "azaton_user"
$DB_NAME = "azaton"

Write-Host "`n📊 Проверка существующих таблиц..." -ForegroundColor Yellow

# Проверяем наличие критических таблиц
$tables = @(
    "notifications",
    "company_messages",
    "users",
    "companies",
    "products"
)

foreach ($table in $tables) {
    $query = "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table');"
    $result = & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c $query
    
    if ($result -match "t") {
        Write-Host "  ✅ Таблица '$table' существует" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Таблица '$table' НЕ НАЙДЕНА!" -ForegroundColor Red
    }
}

Write-Host "`n📋 Список всех таблиц в базе данных:" -ForegroundColor Yellow
$query = "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
& psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c $query

Write-Host "`n💡 Если таблицы 'notifications' или 'company_messages' не найдены," -ForegroundColor Yellow
Write-Host "   выполните миграции с помощью команд:" -ForegroundColor Yellow
Write-Host "   cd backend/migrations" -ForegroundColor Cyan
Write-Host "   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f 006_create_notifications_table.sql" -ForegroundColor Cyan
Write-Host "   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f 124_create_company_messages_table.sql" -ForegroundColor Cyan

Remove-Item Env:\PGPASSWORD
