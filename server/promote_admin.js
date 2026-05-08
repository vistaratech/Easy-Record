import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_i3brTPcZh9aI@ep-wandering-resonance-aq4avptn.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query("UPDATE users SET is_admin = true WHERE email = 'info.vistaratech@gmail.com'");
    console.log('Update result:', res.rowCount, 'rows updated');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
