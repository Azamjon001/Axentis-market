# ============================================================================
# ОБНОВЛЕНИЕ КОНФИГУРАЦИИ С HTTPS URL
# ============================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$HttpsUrl
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ОБНОВЛЕНИЕ HTTPS КОНФИГУРАЦИИ" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Удаление trailing slash
$HttpsUrl = $HttpsUrl.TrimEnd('/')

# Проверка формата HTTPS
if (-not $HttpsUrl.StartsWith("https://")) {
    Write-Host "❌ ОШИБКА: URL должен начинаться с https://" -ForegroundColor Red
    Write-Host "Пример: https://abc123.ngrok-free.app" -ForegroundColor Yellow
    exit 1
}

Write-Host "🔗 HTTPS URL: $HttpsUrl" -ForegroundColor Green
Write-Host ""

# Функция обновления config.js
function Update-ConfigFile {
    param($FilePath, $NewUrl)
    
    if (Test-Path $FilePath) {
        $content = Get-Content $FilePath -Raw
        $content = $content -replace "export const API_BASE_URL = '.*?';", "export const API_BASE_URL = '$NewUrl';"
        Set-Content $FilePath $content -NoNewline
        Write-Host "✅ Обновлен: $FilePath" -ForegroundColor Green
    }
}

# Обновление конфигураций
Write-Host "📝 Обновление конфигурационных файлов..." -ForegroundColor Yellow
Write-Host ""

Update-ConfigFile "Homepage\config.js" $HttpsUrl
Update-ConfigFile "Homepage2\config.js" $HttpsUrl

Write-Host ""
Write-Host "🔧 Обновление CORS в backend..." -ForegroundColor Yellow

# Обновление .env для backend
$envPath = "backend\.env"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath
    $updated = $false
    
    for ($i = 0; $i -lt $envContent.Length; $i++) {
        if ($envContent[$i] -match "^ALLOWED_ORIGINS=") {
            # Добавляем новый URL к существующим
            if ($envContent[$i] -notmatch [regex]::Escape($HttpsUrl)) {
                $envContent[$i] = $envContent[$i] + ",$HttpsUrl"
                $updated = $true
            }
        }
    }
    
    if ($updated) {
        Set-Content $envPath $envContent
        Write-Host "✅ Добавлен $HttpsUrl в ALLOWED_ORIGINS" -ForegroundColor Green
        Write-Host ""
        Write-Host "⚠️  ВАЖНО: Перезапустите backend:" -ForegroundColor Yellow
        Write-Host "   docker-compose restart backend" -ForegroundColor White
    } else {
        Write-Host "ℹ️  URL уже есть в ALLOWED_ORIGINS" -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ КОНФИГУРАЦИЯ ОБНОВЛЕНА!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Следующие шаги:" -ForegroundColor Cyan
Write-Host "1. Перезапустите backend: docker-compose restart backend" -ForegroundColor White
Write-Host "2. Пересоберите APK: cd Homepage && eas build --platform android" -ForegroundColor White
Write-Host ""
