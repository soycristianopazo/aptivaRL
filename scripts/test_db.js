// Quick Supabase Postgres connectivity test
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    ssl: { rejectUnauthorized: false },
  });
  try {
    const r = await pool.query('select version(), current_database(), now()');
    console.log('CONNECTED OK');
    console.log(JSON.stringify(r.rows[0], null, 2));
    const t = await pool.query(
      "select table_name from information_schema.tables where table_schema='public' order by table_name"
    );
    console.log('PUBLIC TABLES:', t.rows.map((x) => x.table_name));
  } catch (e) {
    console.error('CONNECTION FAILED:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
