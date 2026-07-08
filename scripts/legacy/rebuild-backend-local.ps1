# ============================================================================
# ПЕРЕСБОРКА BACKEND С ИСПРАВЛЕНИЯМИ (ЛОКАЛЬНО В DOCKER)
# ============================================================================

Write-Host "🔨 Пересборка backend Docker образа..." -ForegroundColor Cyan

# Останавливаем контейнеры
docker compose down

# Пересобираем backend образ (без кэша чтобы подхватить изменения)
docker compose build --no-cache backend

Write-Host "✅ Backend пересобран!" -ForegroundColor Green

# Запускаем контейнеры
Write-Host "🚀 Запуск контейнеров..." -ForegroundColor Cyan
docker compose up -d

Write-Host "⏳ Ожидание запуска сервисов (10 секунд)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Выполняем миграцию для генерации access_key
Write-Host "🔑 Генерация ключей доступа для компаний..." -ForegroundColor Cyan
Get-Content "backend\migrations\999_generate_missing_access_keys.sql" | docker exec -i onlineshop2-postgres psql -U onlineshop2_user -d onlineshop2

Write-Host "" -ForegroundColor White
Write-Host "✨ ВСЁ ГОТОВО!" -ForegroundColor Green
Write-Host "📊 Проверка: Открыт http://localhost:5173" -ForegroundColor Yellow
Write-Host "🔐 Админ-панель → Управление компаниями → Должны быть видны ключи доступа" -ForegroundColor Yellow
