# ============================================================================
# NGROK HTTPS TUNNEL - Автоматический запуск
# ============================================================================

# ИНСТРУКЦИЯ:
# 1. Зарегистрируйтесь: https://ngrok.com/signup (бесплатно)
# 2. Получите authtoken: https://dashboard.ngrok.com/get-started/your-authtoken  
# 3. Замените YOUR_AUTHTOKEN_HERE на ваш токен
# 4. Запустите этот скрипт: .\start-ngrok.ps1

$NGROK_AUTHTOKEN = "39NAssMa0comx5Bb5XSySBSsQZG_75aRqE9wJfLspsVs5DP75"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  NGROK HTTPS TUNNEL SETUP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Проверка токена
if ($NGROK_AUTHTOKEN -eq "YOUR_AUTHTOKEN_HERE") {
    Write-Host "❌ ОШИБКА: Вы не указали authtoken!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Пожалуйста:" -ForegroundColor Yellow
    Write-Host "1. Зарегистрируйтесь: https://ngrok.com/signup" -ForegroundColor White
    Write-Host "2. Получите токен: https://dashboard.ngrok.com/get-started/your-authtoken" -ForegroundColor White
    Write-Host "3. Откройте start-ngrok.ps1 и замените YOUR_AUTHTOKEN_HERE на ваш токен" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Настройка ngrok
Write-Host "⚙️  Настройка ngrok..." -ForegroundColor Yellow
& "$env:TEMP\ngrok\ngrok.exe" config add-authtoken $NGROK_AUTHTOKEN

Write-Host "✅ Authtoken установлен!" -ForegroundColor Green
Write-Host ""

# Проверка Docker
Write-Host "🐳 Проверка Docker backend..." -ForegroundColor Yellow
$dockerStatus = docker ps --filter "name=backend" --format "{{.Status}}"

if ($dockerStatus) {
    Write-Host "✅ Backend работает: $dockerStatus" -ForegroundColor Green
} else {
    Write-Host "⚠️  Backend не запущен. Запускаю..." -ForegroundColor Yellow
    docker-compose up -d backend
    Start-Sleep -Seconds 5
}

Write-Host ""
Write-Host "🚀 Запуск HTTPS туннеля..." -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ⚡ NGROK URL БУДЕТ ПОКАЗАН НИЖЕ ⚡" -ForegroundColor Green  
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Запуск ngrok
& "$env:TEMP\ngrok\ngrok.exe" http 3000
