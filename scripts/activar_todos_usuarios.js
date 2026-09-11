require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, ssl: { rejectUnauthorized: false } });
  try {
    const before = await pool.query('select count(*) filter (where activo=false)::int as inactivos, count(*)::int as total from usuarios_perfiles');
    console.log('Antes:', before.rows[0]);
    const res = await pool.query("update usuarios_perfiles set activo=true, updated_at=now() where activo=false");
    console.log('Perfiles activados:', res.rowCount);
    const after = await pool.query('select count(*) filter (where activo=true)::int as activos, count(*)::int as total from usuarios_perfiles');
    console.log('Despues:', after.rows[0]);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
