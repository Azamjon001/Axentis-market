const { Client } = require('pg');

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

    const migration = `ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;`;
    
    await client.query(migration);
    console.log('✅ Migration applied successfully: Added brand column to products table');
    
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
