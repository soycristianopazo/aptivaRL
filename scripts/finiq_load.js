require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const fs = require('fs');
const crypto = require('crypto');

const normRut = (s) => (s || '').toString().replace(/[^0-9kK]/g, '').toUpperCase();
const uuid = () => crypto.randomUUID();
const SUPA = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SECRET = process.env.SUPABASE_SECRET_KEY;
const BUCKET = process.env.STORAGE_BUCKET || 'documentos';

const mimeOf = (url) => {
  const ext = (url.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return 'application/octet-stream';
};

async function upload(path, bytes, contentType) {
  const enc = path.split('/').map(encodeURIComponent).join('/');
  const r = await fetch(`${SUPA}/storage/v1/object/${BUCKET}/${enc}`, {
    method: 'POST',
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': contentType, 'x-upsert': 'true' },
    body: bytes,
  });
  if (!r.ok) throw new Error('upload ' + r.status + ' ' + (await r.text()));
}

(async () => {
  const RUN = process.argv.includes('--run');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4, ssl: { rejectUnauthorized: false } });
  let rows = JSON.parse(fs.readFileSync('/tmp/finiq.json', 'utf8'));
  rows = rows.filter(r => (r.url || '').startsWith('http')); // omitir SIN ARCHIVO
  try {
    const trab = (await pool.query('select trabajador_id, rut, cargo from trabajadores where deleted_at is null')).rows;
    const trabByRut = new Map();
    trab.forEach(t => { const k = normRut(t.rut); if (!trabByRut.has(k)) trabByRut.set(k, []); trabByRut.get(k).push(t); });

    const ctr = (await pool.query(`select c.contrato_id, c.numero_oc, c.empresa_id, c.mandante_id, e.rut emp_rut, e.razon_social empresa, m.razon_social mandante
      from contratos c join empresas_grupo e on e.empresa_id=c.empresa_id join mandantes m on m.mandante_id=c.mandante_id where c.deleted_at is null`)).rows;
    const ctrByNum = new Map();
    ctr.forEach(c => { const k = normRut(c.numero_oc); if (!ctrByNum.has(k)) ctrByNum.set(k, []); ctrByNum.get(k).push(c); });

    const asig = (await pool.query("select asignacion_id, trabajador_id, contrato_id from trabajador_asignaciones")).rows;
    const asigByPair = new Map();
    asig.forEach(a => asigByPair.set(a.trabajador_id + '|' + a.contrato_id, a));

    // idempotencia por (trabajador_id | nombre_archivo)
    const existing = new Set((await pool.query('select trabajador_id, nombre_archivo from desvinculaciones')).rows.map(r => r.trabajador_id + '|' + r.nombre_archivo));

    const deactivated = new Set(); // asignacion_id ya desactivada en esta corrida
    let ok = 0, skipExist = 0, noAsig = 0, errors = 0, noContrato = 0, noTrab = 0;
    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx];
      const t = trabByRut.get(normRut(r.rut_raw));
      if (!t) { noTrab++; continue; }
      const tid = t[0].trabajador_id;
      let cands = ctrByNum.get(normRut(r.num_raw)) || [];
      if (cands.length === 0) { noContrato++; console.log('SIN CONTRATO', r.rut_raw, r.num_raw); continue; }
      let ctrMatch = cands;
      if (cands.length > 1) {
        const byEmp = cands.filter(c => normRut(c.emp_rut) === normRut(r.rut_empresa));
        if (byEmp.length) ctrMatch = byEmp.concat(cands.filter(c => !byEmp.includes(c)));
      }
      let a = null, contrato = null;
      for (const c of ctrMatch) { const cand = asigByPair.get(tid + '|' + c.contrato_id); if (cand) { a = cand; contrato = c; break; } }
      if (!contrato) contrato = ctrMatch[0];
      const fname = r.url.split('/').pop();
      const idemKey = tid + '|' + fname;
      if (existing.has(idemKey)) { skipExist++; continue; }
      if (!a) noAsig++;

      if (!RUN) { ok++; continue; }
      try {
        const resp = await fetch(r.url);
        if (!resp.ok) throw new Error('download ' + resp.status);
        const bytes = Buffer.from(await resp.arrayBuffer());
        const mime = mimeOf(r.url);
        const safe = fname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `desvinculacion/${tid}/${uuid()}-${safe}`;
        await upload(path, bytes, mime);
        const did = uuid();
        const causal = (r.causal || '').toUpperCase();
        await pool.query(`insert into desvinculaciones
          (desvinculacion_id, trabajador_id, asignacion_id, contrato_id, empresa_id, mandante_id, rut, nombre, cargo, contrato_numero, empresa_nombre, mandante_nombre, tipo, causal, bucket, path, nombre_archivo, mime, tamano, created_at)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
          [did, tid, a ? a.asignacion_id : null, contrato.contrato_id, contrato.empresa_id, contrato.mandante_id,
           t[0].rut, r.nombre, t[0].cargo || null, contrato.numero_oc, contrato.empresa, contrato.mandante,
           'finiquito', causal, BUCKET, path, fname, mime, bytes.length, r.fecha || null]);
        existing.add(idemKey);
        // desactivar asignacion una sola vez por corrida (rows vienen mas recientes primero)
        if (a && !deactivated.has(a.asignacion_id)) {
          const fdes = (r.fecha || '').slice(0, 10) || null;
          await pool.query("update trabajador_asignaciones set estado='inactivo', fecha_desasignacion=$2 where asignacion_id=$1", [a.asignacion_id, fdes]);
          deactivated.add(a.asignacion_id);
        }
        ok++;
        if (ok % 25 === 0) console.log('  procesados', ok);
      } catch (e) { errors++; console.log('ERROR', r.rut_raw, r.nombre, '->', e.message); }
    }
    console.log('\n==== RESUMEN', RUN ? '(EJECUTADO)' : '(DRY-RUN)', '====');
    console.log('Cargados OK:', ok, '| histórico sin baja de asignación:', noAsig);
    console.log('Ya existían (idempotencia):', skipExist);
    console.log('Sin trabajador:', noTrab, '| sin contrato:', noContrato, '| errores:', errors);
    console.log('Asignaciones desactivadas:', deactivated.size);
  } catch (e) { console.error('FATAL:', e.message); }
  finally { await pool.end(); }
})();
