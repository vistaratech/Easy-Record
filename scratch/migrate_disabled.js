import dotenv from 'dotenv';
dotenv.config();
import pool from '../server/db/pool.js';

async function migrate() {
  try {
    console.log('Adding disabled column to users table...');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE;');
    console.log('Successfully added disabled column!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
