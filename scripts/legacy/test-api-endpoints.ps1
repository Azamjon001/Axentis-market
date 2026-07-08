# Test API endpoints
Write-Host "Testing /api/users/count..."
try {
    $response1 = Invoke-RestMethod -Uri "http://axentis.uz/api/users/count" -Method Get -ErrorAction Stop
    Write-Host "✅ SUCCESS: /api/users/count returned:" -ForegroundColor Green
    Write-Host ($response1 | ConvertTo-Json)
} catch {
    Write-Host "❌ FAILED: /api/users/count - $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)"
}

Write-Host "`nTesting /api/companies..."
try {
    $response2 = Invoke-RestMethod -Uri "http://axentis.uz/api/companies" -Method Get -ErrorAction Stop
    Write-Host "✅ SUCCESS: /api/companies returned $($response2.Count) companies" -ForegroundColor Green
    if ($response2.Count -gt 0) {
        Write-Host "First company: $($response2[0].name)"
    }
} catch {
    Write-Host "❌ FAILED: /api/companies - $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)"
}
