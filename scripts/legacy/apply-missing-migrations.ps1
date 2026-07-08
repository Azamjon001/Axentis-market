# Скрипт для применения недостающих миграций
Write-Host "🔧 Применение миграций для базы данных..." -ForegroundColor Cyan

# Настройки подключения (измените при необходимости)
$env:PGPASSWORD = "your_secure_password_here"
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_USER = "azaton_user"
$DB_NAME = "azaton"

$migrationsDir = "backend\migrations"

if (-not (Test-Path $migrationsDir)) {
    Write-Host "❌ Папка с миграциями не найдена: $migrationsDir" -ForegroundColor Red
    exit 1
}

Write-Host "`n📝 Применение критических миграций..." -ForegroundColor Yellow

$criticalMigrations = @(
    "006_create_notifications_table.sql",
    "124_create_company_messages_table.sql",
    "126_add_expo_push_token_to_users.sql"
)

foreach ($migration in $criticalMigrations) {
    $filePath = Join-Path $migrationsDir $migration
    
    if (Test-Path $filePath) {
        Write-Host "`n🔄 Применение: $migration" -ForegroundColor Cyan
        
        try {
            & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $filePath
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✅ Миграция применена успешно" -ForegroundColor Green
            } else {
                Write-Host "  ⚠️ Миграция завершилась с предупреждениями (возможно, уже применена)" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "  ❌ Ошибка при применении миграции: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "  ⚠️ Файл миграции не найден: $migration" -ForegroundColor Yellow
    }
}

Write-Host "`n✅ Процесс применения миграций завершен!" -ForegroundColor Green
Write-Host "💡 Запустите check-database.ps1 для проверки результата" -ForegroundColor Cyan

Remove-Item Env:\PGPASSWORD
