// Elimina la desvinculación de PRUEBA (Alex Anselmo Aburto Vera) y reactiva su asignación
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, ssl: { rejectUnauthorized: false } });
  try {
    const list = await pool.query('select desvinculacion_id, asignacion_id, rut, nombre, causal, path, created_at from desvinculaciones order by created_at');
    console.log('DESVINCULACIONES ACTUALES:', JSON.stringify(list.rows, null, 2));

    const doDelete = process.argv.includes('--delete');
    if (!doDelete) { console.log('\n(modo inspección — usa --delete para eliminar)'); return; }

    for (const r of list.rows) {
      // reactivar asignación
      if (r.asignacion_id) {
        const up = await pool.query("update trabajador_asignaciones set estado='activo', fecha_desasignacion=null where asignacion_id=$1", [r.asignacion_id]);
        console.log('Asignación reactivada:', r.asignacion_id, 'rows:', up.rowCount);
      }
      const del = await pool.query('delete from desvinculaciones where desvinculacion_id=$1', [r.desvinculacion_id]);
      console.log('Desvinculación eliminada:', r.desvinculacion_id, 'rows:', del.rowCount);
    }
    console.log('LISTO. Todas las desvinculaciones de prueba eliminadas.');
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await pool.end();
  }
})();
