require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const fs = require('fs');

const normRut = (s) => (s || '').toString().replace(/[^0-9kK]/g, '').toUpperCase();

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, ssl: { rejectUnauthorized: false } });
  const rows = JSON.parse(fs.readFileSync('/tmp/finiq.json', 'utf8'));
  try {
    const trab = (await pool.query('select trabajador_id, rut, nombre, apellido from trabajadores where deleted_at is null')).rows;
    const trabByRut = new Map();
    trab.forEach(t => { const k = normRut(t.rut); if (!trabByRut.has(k)) trabByRut.set(k, []); trabByRut.get(k).push(t); });

    const ctr = (await pool.query('select c.contrato_id, c.numero_oc, c.empresa_id, e.rut as emp_rut, e.razon_social from contratos c join empresas_grupo e on e.empresa_id=c.empresa_id where c.deleted_at is null')).rows;
    const ctrByNum = new Map();
    ctr.forEach(c => { const k = normRut(c.numero_oc); if (!ctrByNum.has(k)) ctrByNum.set(k, []); ctrByNum.get(k).push(c); });

    const asig = (await pool.query('select asignacion_id, trabajador_id, contrato_id, estado from trabajador_asignaciones')).rows;
    const asigByPair = new Map();
    asig.forEach(a => asigByPair.set(a.trabajador_id + '|' + a.contrato_id, a));

    let okRut = 0, noRut = 0, okCtr = 0, noCtr = 0, okAsig = 0, noAsig = 0, matched = 0;
    const problems = [];
    for (const r of rows) {
      const t = trabByRut.get(normRut(r.rut_raw));
      if (!t) { noRut++; problems.push('SIN TRABAJADOR: ' + r.rut_raw + ' ' + r.nombre); continue; }
      okRut++;
      const tid = t[0].trabajador_id;
      let cands = ctrByNum.get(normRut(r.num_raw)) || [];
      if (cands.length === 0) { noCtr++; problems.push('SIN CONTRATO: num=' + r.num_raw + ' rut=' + r.rut_raw + ' ' + r.nombre + ' (emp ' + r.empresa + ')'); continue; }
      okCtr++;
      // priorizar por empresa, pero conservar el resto como fallback
      let ctrMatch = cands;
      if (cands.length > 1) {
        const byEmp = cands.filter(c => normRut(c.emp_rut) === normRut(r.rut_empresa));
        if (byEmp.length) ctrMatch = byEmp.concat(cands.filter(c => !byEmp.includes(c)));
      }
      // buscar asignacion en cualquiera de los contratos candidatos (prioriza activa)
      let a = null;
      for (const c of ctrMatch) { const cand = asigByPair.get(tid + '|' + c.contrato_id); if (cand) { a = cand; break; } }
      if (!a) { noAsig++; problems.push('SIN ASIGNACION: rut=' + r.rut_raw + ' ' + r.nombre + ' contrato=' + r.num_raw); continue; }
      okAsig++; matched++;
    }
    console.log('TOTAL filas:', rows.length);
    console.log('RUT encontrado:', okRut, '| sin RUT:', noRut);
    console.log('Contrato encontrado:', okCtr, '| sin contrato:', noCtr);
    console.log('Asignacion encontrada (MATCH FINAL):', matched, '| sin asignacion:', noAsig);
    console.log('\n--- PROBLEMAS (primeros 40) ---');
    problems.slice(0, 40).forEach(p => console.log(' ', p));
    console.log('\nTotal problemas:', problems.length);
  } catch (e) { console.error('ERROR:', e.message); }
  finally { await pool.end(); }
})();
