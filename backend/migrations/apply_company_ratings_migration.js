const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'onlineshop2_user',
  password: 'your_secure_password_here',
  database: 'onlineshop2',
});

async function applyMigration() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    const migration = `
      -- Таблица для хранения оценок компаний пользователями
      CREATE TABLE IF NOT EXISTS company_ratings (
          id SERIAL PRIMARY KEY,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          user_phone VARCHAR(50) NOT NULL,
          rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (company_id, user_phone)
      );

      CREATE INDEX IF NOT EXISTS idx_company_ratings_company_id ON company_ratings(company_id);
      CREATE INDEX IF NOT EXISTS idx_company_ratings_user_phone ON company_ratings(user_phone);
    `;
    
    await client.query(migration);
    console.log('✅ Migration applied successfully: Created company_ratings table');
    
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
