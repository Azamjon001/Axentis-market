const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'azaton_user',
  password: process.env.DB_PASSWORD || 'your_secure_password_here',
  database: process.env.DB_NAME || 'azaton',
});

async function applyMigration() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // First migration: add ad_type and product_id
    console.log('📋 Applying migration 1: add_ad_type_to_advertisements.sql');
    const migration1Path = path.join(__dirname, 'migrations', 'add_ad_type_to_advertisements.sql');
    const migration1SQL = fs.readFileSync(migration1Path, 'utf8');
    await client.query(migration1SQL);
    console.log('✅ Migration 1 applied successfully!');
    
    // Second migration: add cancelled status
    console.log('📋 Applying migration 2: add_cancelled_status_to_ads.sql');
    const migration2Path = path.join(__dirname, 'migrations', 'add_cancelled_status_to_ads.sql');
    const migration2SQL = fs.readFileSync(migration2Path, 'utf8');
    await client.query(migration2SQL);
    console.log('✅ Migration 2 applied successfully!');
    
    console.log('');
    console.log('📊 Database schema updates:');
    console.log('  ✓ ad_type (VARCHAR): company or product');
    console.log('  ✓ product_id (INTEGER): FK to products table');
    console.log('  ✓ status: added cancelled option');
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
