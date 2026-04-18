const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS entitlements (
      id SERIAL PRIMARY KEY,
      person TEXT NOT NULL,
      year INTEGER NOT NULL,
      total_days INTEGER NOT NULL DEFAULT 0,
      UNIQUE(person, year)
    );

    CREATE TABLE IF NOT EXISTS holidays (
      id SERIAL PRIMARY KEY,
      person TEXT NOT NULL,
      year INTEGER NOT NULL,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      is_public BOOLEAN NOT NULL DEFAULT FALSE,
      UNIQUE(person, date)
    );
  `);
}

module.exports = { pool, init };
