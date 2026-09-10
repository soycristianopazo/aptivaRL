require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, ssl: { rejectUnauthorized: false } });
  try {
    const m = await pool.query("select trabajador_id, nombre, apellido, rut from trabajadores where rut like '%21.572.347%'");
    console.log('MATIAS:', JSON.stringify(m.rows));
    for (const w of m.rows) {
      const a = await pool.query('select asignacion_id, contrato_id, estado, fecha_desasignacion from trabajador_asignaciones where trabajador_id=$1', [w.trabajador_id]);
      console.log('  asignaciones:', JSON.stringify(a.rows));
      const d = await pool.query("select count(*)::int c from documentos where recurso_tipo='trabajador' and recurso_id=$1", [w.trabajador_id]);
      console.log('  documentos:', d.rows[0].c);
    }
    // how many inactive workers still have documents
    const docCount = await pool.query(`select count(distinct recurso_id)::int c from documentos where recurso_tipo='trabajador'`);
    console.log('Trabajadores con documentos (total):', docCount.rows[0].c);
  } catch (e) { console.error('ERROR:', e.message); }
  finally { await pool.end(); }
})();
