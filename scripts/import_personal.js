const fs = require('fs');
const pg = require('pg');
const env = fs.readFileSync('/app/.env', 'utf8');
const m = env.match(/^DATABASE_URL=(.*)$/m);
const pool = new pg.Pool({ connectionString: m[1].trim().replace(/^["']|["']$/g, ''), ssl: { rejectUnauthorized: false } });

function parseCSV(text) {
  const rows = []; let field = '', row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else { if (c === '"') inQ = true; else if (c === ',') { row.push(field); field = ''; } else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; } else if (c === '\r') {} else field += c; }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const clean = (s) => { const v = (s || '').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim(); return (!v || v.toUpperCase() === 'NULL') ? null : v; };
const digits = (s) => (s || '').replace(/[^0-9kK]/g, '');
function fmtRut(raw) { const d = digits(raw); if (d.length < 2) return raw; const dv = d.slice(-1); let body = d.slice(0, -1); let out = ''; while (body.length > 3) { out = '.' + body.slice(-3) + out; body = body.slice(0, -3); } return body + out + '-' + dv; }
const toDate = (s) => { const t = (s || '').trim().slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null; };

(async () => {
  const text = fs.readFileSync('/tmp/personal.csv', 'utf8');
  const rows = parseCSV(text);
  const header = rows.shift().map((h) => h.trim());
  const ix = (n) => header.indexOf(n);
  const I = {
    mand: ix('MANDANTE'), rutEmp: ix('RUT_EMPRESA'), emp: ix('EMPRESA'), fant: ix('NOMBRE_FANTASIA'),
    oc: ix('NUMERO_ACUERDO'), desc: ix('DESCRIPCION_CONTRATO'), cini: ix('FECHA_INICIO'), cfin: ix('FECHA_TERMINO'), cest: ix('ESTADO_CONTRATO'),
    activo: ix('PERSONAL_ACTIVO'), rutT: ix('RUT_TRABAJADOR'), nom: ix('NOMBRE'), ape: ix('APELLIDO'), cargo: ix('CARGO'),
    email: ix('E_EMAIL'), fono: ix('FONO'), sexo: ix('SEXO'), comuna: ix('COMUNA'), fasig: ix('FECHA_ASIGNACION'),
  };

  const holding = (await pool.query('select holding_id from holdings limit 1')).rows[0];
  const holdingId = holding ? holding.holding_id : null;
  const mandMap = new Map((await pool.query('select mandante_id, razon_social from mandantes where deleted_at is null')).rows.map((r) => [r.razon_social.trim().toLowerCase(), r.mandante_id]));
  const empByRut = new Map((await pool.query('select empresa_id, rut from empresas_grupo where deleted_at is null')).rows.map((r) => [digits(r.rut), r.empresa_id]));

  let empCreated = 0, ctrCreated = 0, trabCreated = 0, asigCreated = 0, asigDup = 0, empMismatch = 0, skipMand = new Set();
  const trabByRut = new Map(); // rutDigits -> {id, empresa_id}
  const ctrCache = new Map();  // key -> contrato_id

  for (const r of rows) {
    if (!r || r.length < header.length) continue;
    const mandName = clean(r[I.mand]);
    const mandanteId = mandName && mandMap.get(mandName.toLowerCase());
    if (!mandanteId) { if (mandName) skipMand.add(mandName); continue; }

    // empresa
    const rd = digits(r[I.rutEmp]);
    let empId = empByRut.get(rd);
    if (!empId) {
      const ins = await pool.query('insert into empresas_grupo (holding_id, razon_social, rut, nombre_fantasia) values ($1,$2,$3,$4) returning empresa_id', [holdingId, clean(r[I.emp]) || clean(r[I.fant]) || 'Empresa', fmtRut(r[I.rutEmp]), clean(r[I.fant])]);
      empId = ins.rows[0].empresa_id; empByRut.set(rd, empId); empCreated++;
    }
    // ensure mandante-empresa link
    await pool.query('insert into mandante_empresas (mandante_id, empresa_id, activo) values ($1,$2,true) on conflict (mandante_id, empresa_id) do update set activo=true', [mandanteId, empId]);

    // contrato (match or create)
    const oc = clean(r[I.oc]) || `OC-${rd}`;
    const ckey = `${mandanteId}|${empId}|${oc}`;
    let ctrId = ctrCache.get(ckey);
    if (!ctrId) {
      const ex = await pool.query('select contrato_id from contratos where mandante_id=$1 and empresa_id=$2 and numero_oc=$3 and deleted_at is null limit 1', [mandanteId, empId, oc]);
      if (ex.rows[0]) ctrId = ex.rows[0].contrato_id;
      else {
        const estado = (r[I.cest] || '').trim() === '1' ? 'vigente' : 'pendiente';
        const ins = await pool.query('insert into contratos (numero_oc, mandante_id, empresa_id, fecha_inicio, fecha_termino, estado, observaciones) values ($1,$2,$3,$4,$5,$6,$7) returning contrato_id', [oc, mandanteId, empId, toDate(r[I.cini]), toDate(r[I.cfin]), estado, clean(r[I.desc])]);
        ctrId = ins.rows[0].contrato_id; ctrCreated++;
      }
      ctrCache.set(ckey, ctrId);
    }

    // trabajador (upsert by RUT)
    const trd = digits(r[I.rutT]);
    if (!trd) continue;
    let trab = trabByRut.get(trd);
    if (!trab) {
      const ex = await pool.query('select trabajador_id, empresa_id from trabajadores where rut=$1', [fmtRut(r[I.rutT])]);
      if (ex.rows[0]) trab = { id: ex.rows[0].trabajador_id, empresa_id: ex.rows[0].empresa_id };
      else {
        const sexo = (clean(r[I.sexo]) || '').toUpperCase();
        const genero = sexo === 'M' ? 'M' : sexo === 'F' ? 'F' : null;
        const ins = await pool.query('insert into trabajadores (empresa_id, rut, nombre, apellido, cargo, genero, comuna, telefono, email) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning trabajador_id', [empId, fmtRut(r[I.rutT]), clean(r[I.nom]) || 'S/N', clean(r[I.ape]) || 'S/A', clean(r[I.cargo]), genero, clean(r[I.comuna]), clean(r[I.fono]), clean(r[I.email])]);
        trab = { id: ins.rows[0].trabajador_id, empresa_id: empId }; trabCreated++;
      }
      trabByRut.set(trd, trab);
    }

    // assignment (worker must be in same empresa as contract)
    if (trab.empresa_id !== empId) { empMismatch++; continue; }
    const exA = await pool.query('select asignacion_id from trabajador_asignaciones where trabajador_id=$1 and contrato_id=$2', [trab.id, ctrId]);
    if (exA.rows[0]) { asigDup++; continue; }
    const estadoA = (r[I.activo] || '').trim() === '1' ? 'activo' : 'inactivo';
    await pool.query('insert into trabajador_asignaciones (trabajador_id, empresa_id, mandante_id, contrato_id, estado, fecha_asignacion) values ($1,$2,$3,$4,$5,$6)', [trab.id, empId, mandanteId, ctrId, estadoA, toDate(r[I.fasig]) || null]);
    asigCreated++;
  }

  console.log(`Empresas creadas: ${empCreated}`);
  console.log(`Contratos creados (faltantes): ${ctrCreated}`);
  console.log(`Trabajadores creados: ${trabCreated}`);
  console.log(`Asignaciones creadas: ${asigCreated}`);
  console.log(`Asignaciones duplicadas (omitidas): ${asigDup}`);
  console.log(`Filas omitidas por empresa distinta del trabajador: ${empMismatch}`);
  if (skipMand.size) console.log('Mandantes no encontrados:', [...skipMand]);
  await pool.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
