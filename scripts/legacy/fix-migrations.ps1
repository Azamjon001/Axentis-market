# Rename migration files with proper ordering

$migrationsDir = "backend\migrations"

# Define the proper order for migrations
$createFiles = @(
    "create_advertisements_table.sql",
    "create_aggressive_discounts_table.sql",
    "create_categories_table.sql",
    "create_company_ratings_table.sql",
    "create_discounts_table.sql",
    "create_notifications_table.sql",
    "create_payment_cards_table.sql",
    "create_referral_agents_table.sql",
    "create_reviews_table.sql"
)

$addFiles = @(
    "add_ad_type_to_advertisements.sql",
    "add_admin_message_to_advertisements.sql",
    "add_brand_to_products.sql",
    "add_cancelled_status_to_ads.sql",
    "add_card_subtype_to_orders_and_sales.sql",
    "add_color_size_to_products.sql",
    "add_company_location_coordinates.sql",
    "add_company_privacy.sql",
    "add_company_products_description.sql",
    "add_company_stats.sql",
    "add_deleted_status_to_ads.sql",
    "add_delivery_address_and_admin_revenue.sql",
    "add_delivery_cost_to_orders.sql",
    "add_delivery_details_to_orders.sql",
    "add_delivery_enabled_to_companies.sql",
    "add_likes_dislikes_to_reviews.sql",
    "add_markup_profit_to_orders.sql",
    "add_markup_profit_to_sales.sql",
    "add_monthly_amount_to_custom_expenses.sql",
    "add_product_description.sql",
    "add_referral_to_companies.sql",
    "add_timer_to_discounts.sql"
)

$updateFiles = @(
    "update_payment_cards_full_data.sql"
)

# Rename create files (001-xxx)
$counter = 1
foreach ($file in $createFiles) {
    $oldPath = Join-Path $migrationsDir $file
    $newPath = Join-Path $migrationsDir ("{0:D3}_{1}" -f $counter, $file)
    
    if (Test-Path $oldPath) {
        Rename-Item -Path $oldPath -NewName (Split-Path $newPath -Leaf)
        Write-Host "Renamed: $file -> $(Split-Path $newPath -Leaf)" -ForegroundColor Green
        $counter++
    }
}

# Rename add files (101-xxx)
$counter = 101
foreach ($file in $addFiles) {
    $oldPath = Join-Path $migrationsDir $file
    $newPath = Join-Path $migrationsDir ("{0:D3}_{1}" -f $counter, $file)
    
    if (Test-Path $oldPath) {
        Rename-Item -Path $oldPath -NewName (Split-Path $newPath -Leaf)
        Write-Host "Renamed: $file -> $(Split-Path $newPath -Leaf)" -ForegroundColor Green
        $counter++
    }
}

# Rename update files (201-xxx)
$counter = 201
foreach ($file in $updateFiles) {
    $oldPath = Join-Path $migrationsDir $file
    $newPath = Join-Path $migrationsDir ("{0:D3}_{1}" -f $counter, $file)
    
    if (Test-Path $oldPath) {
        Rename-Item -Path $oldPath -NewName (Split-Path $newPath -Leaf)
        Write-Host "Renamed: $file -> $(Split-Path $newPath -Leaf)" -ForegroundColor Green
        $counter++
    }
}

Write-Host "`nMigration files renamed successfully!" -ForegroundColor Cyan
