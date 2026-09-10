require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, ssl: { rejectUnauthorized: false } });
  try {
    // conflictos: mismo trabajador+contrato con una activa y otra inactiva
    const conf = await pool.query(`
      select trabajador_id, contrato_id,
             count(*) filter (where estado='activo')::int act,
             count(*) filter (where estado='inactivo')::int inact
      from trabajador_asignaciones
      group by trabajador_id, contrato_id
      having count(*) filter (where estado='activo') > 0 and count(*) filter (where estado='inactivo') > 0`);
    console.log('CONFLICTOS (activa+inactiva mismo trab/contrato):', conf.rows.length);
    console.log(JSON.stringify(conf.rows, null, 2));

    const doIt = process.argv.includes('--run');
    if (!doIt) { console.log('\n(inspección — usa --run para reactivar las que no generan conflicto)'); return; }

    // Reactivar solo las inactivas que NO tengan ya una activa del mismo trab+contrato
    const r = await pool.query(`
      update trabajador_asignaciones a
      set estado='activo', fecha_desasignacion=null
      where a.estado='inactivo'
        and not exists (
          select 1 from trabajador_asignaciones b
          where b.trabajador_id=a.trabajador_id and b.contrato_id=a.contrato_id and b.estado='activo'
        )
      returning a.asignacion_id`);
    console.log('REACTIVADAS:', r.rowCount);

    const rest = await pool.query("select count(*)::int c from trabajador_asignaciones where estado='inactivo'");
    console.log('INACTIVAS restantes (por conflicto):', rest.rows[0].c);
    const act = await pool.query("select count(*)::int c from trabajador_asignaciones where estado='activo'");
    console.log('ACTIVAS totales:', act.rows[0].c);
  } catch (e) { console.error('ERROR:', e.message); }
  finally { await pool.end(); }
})();
