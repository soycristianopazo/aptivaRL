require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const fs = require('fs');
const normRut = (s) => (s || '').toString().replace(/[^0-9kK]/g, '').toUpperCase();
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, ssl: { rejectUnauthorized: false } });
  const rows = JSON.parse(fs.readFileSync('/tmp/finiq.json', 'utf8'));
  try {
    const ctr = (await pool.query('select numero_oc from contratos where deleted_at is null')).rows;
    const ctrNums = new Set(ctr.map(c => normRut(c.numero_oc)));
    const bad = rows.filter(r => !ctrNums.has(normRut(r.num_digits)));
    // agrupar tambien Ayrthon (sin asignacion)
    const targets = new Set(bad.map(r=>r.rut_raw)); targets.add('287178786');
    console.log('RUTs a investigar:', targets.size);
    for (const rut of targets) {
      const t = (await pool.query('select trabajador_id, nombre, apellido from trabajadores where regexp_replace(rut,\'[^0-9kK]\',\'\',\'g\')=$1', [normRut(rut)])).rows[0];
      if (!t) { console.log(rut, '-> trabajador NO encontrado'); continue; }
      const a = (await pool.query(`select a.estado, c.numero_oc, m.razon_social man, e.razon_social emp
        from trabajador_asignaciones a join contratos c on c.contrato_id=a.contrato_id
        join mandantes m on m.mandante_id=c.mandante_id join empresas_grupo e on e.empresa_id=c.empresa_id
        where a.trabajador_id=$1`, [t.trabajador_id])).rows;
      const fr = rows.filter(r=>normRut(r.rut_raw)===normRut(rut));
      console.log(rut, t.nombre, t.apellido, '| finiq num:', fr.map(x=>x.num_raw+' ('+x.mandante+')').join(' ; '));
      console.log('   asignaciones DB:', JSON.stringify(a));
    }
  } catch (e) { console.error('ERROR:', e.message); }
  finally { await pool.end(); }
})();
