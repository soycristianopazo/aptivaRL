require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, ssl: { rejectUnauthorized: false } });
  try {
    const byEmp = await pool.query(`select e.razon_social, a.estado, count(*)::int c
      from trabajador_asignaciones a join empresas_grupo e on e.empresa_id=a.empresa_id
      group by e.razon_social, a.estado order by e.razon_social, a.estado`);
    console.log('POR EMPRESA/ESTADO:'); byEmp.rows.forEach(r=>console.log(`  ${r.razon_social} | ${r.estado} | ${r.c}`));
    // trabajadores unicos activos vs inactivos
    const distinctActive = await pool.query("select count(distinct trabajador_id)::int c from trabajador_asignaciones where estado='activo'");
    const distinctInactive = await pool.query("select count(distinct trabajador_id)::int c from trabajador_asignaciones where estado='inactivo'");
    const onlyInactive = await pool.query(`select count(*)::int c from (select trabajador_id from trabajador_asignaciones group by trabajador_id having bool_and(estado='inactivo')) x`);
    console.log('Trabajadores con >=1 activa:', distinctActive.rows[0].c);
    console.log('Trabajadores con alguna inactiva:', distinctInactive.rows[0].c);
    console.log('Trabajadores SOLO inactivas (no aparecen como activos):', onlyInactive.rows[0].c);
  } catch (e) { console.error('ERROR:', e.message); }
  finally { await pool.end(); }
})();
