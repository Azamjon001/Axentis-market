# ============================================================================
# СКРИПТ ДЛЯ ОПРЕДЕЛЕНИЯ IP АДРЕСА
# ============================================================================
# Запустите в PowerShell: .\get-ip.ps1

Write-Host "================================" -ForegroundColor Cyan
Write-Host "🔍 ПОИСК IP АДРЕСА ДЛЯ EXPO" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Получаем все IP адреса
$networkAdapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.InterfaceAlias -notlike "*Loopback*" -and 
    $_.IPAddress -ne "127.0.0.1"
}

Write-Host "📡 Найденные сетевые интерфейсы:" -ForegroundColor Yellow
Write-Host ""

$wifiAdapter = $null
$ethernetAdapter = $null

foreach ($adapter in $networkAdapters) {
    $interfaceName = $adapter.InterfaceAlias
    $ip = $adapter.IPAddress
    
    # Определяем тип интерфейса
    if ($interfaceName -like "*Wi-Fi*" -or $interfaceName -like "*Беспроводная*" -or $interfaceName -like "*Wireless*") {
        Write-Host "✅ WiFi: " -ForegroundColor Green -NoNewline
        Write-Host "$ip " -ForegroundColor White -NoNewline
        Write-Host "($interfaceName)" -ForegroundColor Gray
        $wifiAdapter = $adapter
    }
    elseif ($interfaceName -like "*Ethernet*" -or $interfaceName -like "*Local Area Connection*") {
        Write-Host "🔌 Ethernet: " -ForegroundColor Blue -NoNewline
        Write-Host "$ip " -ForegroundColor White -NoNewline
        Write-Host "($interfaceName)" -ForegroundColor Gray
        $ethernetAdapter = $adapter
    }
    elseif ($interfaceName -like "*Docker*" -or $interfaceName -like "*vEthernet*") {
        Write-Host "🐳 Docker/VM: " -ForegroundColor Magenta -NoNewline
        Write-Host "$ip " -ForegroundColor White -NoNewline
        Write-Host "($interfaceName)" -ForegroundColor Gray
    }
    else {
        Write-Host "❓ Другое: " -ForegroundColor DarkGray -NoNewline
        Write-Host "$ip " -ForegroundColor White -NoNewline
        Write-Host "($interfaceName)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Определяем какой IP использовать
$recommendedIP = $null
$connectionType = ""

if ($wifiAdapter) {
    $recommendedIP = $wifiAdapter.IPAddress
    $connectionType = "WiFi"
}
elseif ($ethernetAdapter) {
    $recommendedIP = $ethernetAdapter.IPAddress
    $connectionType = "Ethernet"
}

if ($recommendedIP) {
    Write-Host "🎯 РЕКОМЕНДУЕМЫЙ IP АДРЕС:" -ForegroundColor Green
    Write-Host ""
    Write-Host "   $recommendedIP" -ForegroundColor Yellow -NoNewline
    Write-Host " (подключение: $connectionType)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📱 ДЛЯ EXPO (Homepage/config.js):" -ForegroundColor Cyan
    Write-Host ""
    $expoConfig = "export const API_BASE_URL = 'http://$($recommendedIP):3000';"
    Write-Host $expoConfig -ForegroundColor White
    Write-Host ""
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "💻 ДЛЯ ВЕБ (.env):" -ForegroundColor Cyan
    Write-Host ""
    $viteApiUrl = "VITE_API_URL=http://$($recommendedIP):3000/api"
    $viteSocketUrl = "VITE_SOCKET_URL=http://$($recommendedIP):3000"
    Write-Host $viteApiUrl -ForegroundColor White
    Write-Host $viteSocketUrl -ForegroundColor White
    Write-Host ""
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🔥 FIREWALL:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Чтобы разрешить доступ к порту 3000, выполните:" -ForegroundColor Gray
    Write-Host ""
    $firewallCmd = "New-NetFirewallRule -DisplayName 'Backend Dev' -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow"
    Write-Host $firewallCmd -ForegroundColor White
    Write-Host ""
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "✅ Готово! Используйте IP адрес выше." -ForegroundColor Green
    Write-Host ""
    
    # Копируем в буфер обмена если доступно
    try {
        "http://$($recommendedIP):3000" | Set-Clipboard
        Write-Host "📋 URL скопирован в буфер обмена!" -ForegroundColor Green
        Write-Host ""
    } catch {
        # Clipboard не доступен
    }
}
else {
    Write-Host "❌ Не удалось определить активное подключение" -ForegroundColor Red
    Write-Host ""
    Write-Host "Убедитесь что вы подключены к WiFi или Ethernet" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Нажмите любую клавишу для выхода..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
