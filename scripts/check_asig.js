require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, ssl: { rejectUnauthorized: false } });
  try {
    const tot = await pool.query('select count(*)::int c from trabajador_asignaciones');
    const act = await pool.query("select count(*)::int c from trabajador_asignaciones where estado='activo'");
    const inact = await pool.query("select estado, count(*)::int c from trabajador_asignaciones group by estado");
    console.log('TOTAL asignaciones:', tot.rows[0].c);
    console.log('ACTIVAS:', act.rows[0].c);
    console.log('POR ESTADO:', JSON.stringify(inact.rows));
    // Byron
    const b = await pool.query("select trabajador_id, nombre, apellido, rut from trabajadores where rut like '%21.991.826%' or rut like '%21991826%'");
    console.log('BYRON:', JSON.stringify(b.rows));
    for (const w of b.rows) {
      const a = await pool.query('select asignacion_id, contrato_id, estado, fecha_desasignacion from trabajador_asignaciones where trabajador_id=$1', [w.trabajador_id]);
      console.log('  asignaciones:', JSON.stringify(a.rows));
    }
    // reactivada test worker
    const alex = await pool.query("select asignacion_id, estado, fecha_desasignacion from trabajador_asignaciones where asignacion_id='2e09d92f-206e-4160-8da6-89ff57fec9c1'");
    console.log('ALEX asignacion (reactivada):', JSON.stringify(alex.rows));
  } catch (e) { console.error('ERROR:', e.message); }
  finally { await pool.end(); }
})();
