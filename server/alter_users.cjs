require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  await client.connect();
  try {
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE, 
      ADD COLUMN IF NOT EXISTS password VARCHAR(255), 
      ADD COLUMN IF NOT EXISTS name VARCHAR(255), 
      ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE,
      ALTER COLUMN phone DROP NOT NULL;
    `);
    console.log('Successfully altered users table');
  } catch (err) {
    console.error('Error altering table:', err);
  } finally {
    await client.end();
  }
}

main();
