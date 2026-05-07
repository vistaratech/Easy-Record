const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://neondb_owner:npg_1YQoPKwz0mTe@ep-lively-feather-a88x59gq-pooler.eastus2.azure.neon.tech/neondb?sslmode=require'
});

async function main() {
  await client.connect();
  try {
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE, 
      ADD COLUMN IF NOT EXISTS password VARCHAR(255), 
      ADD COLUMN IF NOT EXISTS name VARCHAR(255), 
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
