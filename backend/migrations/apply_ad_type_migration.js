const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'onlineshop',
  password: 'malikovka30',
  port: 5432,
});

async function applyMigration() {
  try {
    console.log('📋 Applying migration: add_ad_type_to_advertisements...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'add_ad_type_to_advertisements.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🔧 Executing migration SQL...');
    await pool.query(migrationSQL);
    
    console.log('✅ Migration applied successfully!');
    console.log('');
    console.log('📊 New columns added:');
    console.log('  - ad_type (VARCHAR): company or product');
    console.log('  - product_id (INTEGER): FK to products table');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

applyMigration();
