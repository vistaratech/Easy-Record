const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  try {
    console.log('Adding permission columns to users table...');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS can_create_registers BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS can_create_templates BOOLEAN DEFAULT FALSE;
    `);
    console.log('✅ Successfully updated users table');
  } catch (err) {
    console.error('❌ Error altering table:', err);
  } finally {
    await client.end();
  }
}

main();
