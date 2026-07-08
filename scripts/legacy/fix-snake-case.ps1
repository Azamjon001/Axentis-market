# Fix snake_case to camelCase in all component files

$files = @(
    "src/components/BarcodeSearchPanel.tsx",
    "src/components/CompanyProfilePage.tsx",
    "src/components/CompanyProfile.tsx",
    "src/components/DigitalWarehouse.tsx",
    "src/components/DemoPaymentPage.tsx",
    "src/components/DirectPriceUpdate.tsx",
    "src/components/HomePage.tsx",
    "src/components/LikesPage.tsx"
)

$replacements = @{
    "\.markup_percent" = ".markupPercent"
    "\.selling_price" = ".sellingPrice"
    "\.markup_amount" = ".markupAmount"
    "\.available_for_customers" = ".availableForCustomers"
    "\.has_color_options" = ".hasColorOptions"
}

foreach ($file in $files) {
    $fullPath = Join-Path "c:\Users\malik\OneDrive\Desktop\online shop2" $file
    
    if (Test-Path $fullPath) {
        Write-Host "Processing $file..."
        $content = Get-Content $fullPath -Raw
        $modified = $false
        
        foreach ($pattern in $replacements.Keys) {
            $replacement = $replacements[$pattern]
            if ($content -match [regex]::Escape($pattern)) {
                $content = $content -replace [regex]::Escape($pattern), $replacement
                $modified = $true
            }
        }
        
        if ($modified) {
            Set-Content $fullPath -Value $content -NoNewline
            Write-Host "  ✅ Updated $file"
        } else {
            Write-Host "  ⏭️  No changes needed in $file"
        }
    } else {
        Write-Host "  ❌ File not found: $file"
    }
}

Write-Host "`n✅ All files processed!"
