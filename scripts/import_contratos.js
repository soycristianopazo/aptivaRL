const fs = require('fs');
const pg = require('pg');

const env = fs.readFileSync('/app/.env', 'utf8');
const m = env.match(/^DATABASE_URL=(.*)$/m);
const DATABASE_URL = m ? m[1].trim().replace(/^["']|["']$/g, '') : process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5, ssl: { rejectUnauthorized: false } });

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
const clean = (s) => (s || '').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
const digits = (s) => (s || '').replace(/[^0-9kK]/g, '');
function fmtRut(raw) { const d = digits(raw); if (d.length < 2) return raw; const dv = d.slice(-1); let body = d.slice(0, -1); let out = ''; while (body.length > 3) { out = '.' + body.slice(-3) + out; body = body.slice(0, -3); } return body + out + '-' + dv; }
const toDate = (s) => { const t = (s || '').trim().slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null; };

(async () => {
  const text = fs.readFileSync('/tmp/contratistas.csv', 'utf8');
  const rows = parseCSV(text);
  const header = rows.shift().map((h) => h.trim());
  const idx = (n) => header.indexOf(n);
  const I = { mand: idx('MANDANTE'), rutEmp: idx('RUT_EMPRESA'), emp: idx('EMPRESA'), fant: idx('NOMBRE_FANTASIA'), oc: idx('NUMERO_ACUERDO'), desc: idx('DESCRIPCION_CONTRATO'), ini: idx('FECHA_INICIO'), fin: idx('FECHA_TERMINO'), lim: idx('LIMITE_CONTINGENTE'), estado: idx('ESTADO_CONTRATO') };

  const holding = (await pool.query('select holding_id from holdings limit 1')).rows[0];
  const holdingId = holding ? holding.holding_id : null;

  const mres = await pool.query('select mandante_id, razon_social from mandantes where deleted_at is null');
  const mandMap = new Map(mres.rows.map((r) => [r.razon_social.trim().toLowerCase(), r.mandante_id]));

  const empByRut = new Map((await pool.query('select empresa_id, rut from empresas_grupo where deleted_at is null')).rows.map((r) => [digits(r.rut), r.empresa_id]));

  let empCreated = 0, links = 0, contr = 0, skipC = 0, skipMand = new Set();

  for (const r of rows) {
    if (!r || r.length < header.length) continue;
    const mandName = (r[I.mand] || '').trim();
    const mandanteId = mandMap.get(mandName.toLowerCase());
    if (!mandanteId) { skipMand.add(mandName); continue; }

    // upsert empresa by RUT digits
    const rd = digits(r[I.rutEmp]);
    let empId = empByRut.get(rd);
    if (!empId) {
      const rsName = clean(r[I.emp]) || clean(r[I.fant]);
      const ins = await pool.query('insert into empresas_grupo (holding_id, razon_social, rut, nombre_fantasia) values ($1,$2,$3,$4) returning empresa_id', [holdingId, rsName, fmtRut(r[I.rutEmp]), clean(r[I.fant]) || null]);
      empId = ins.rows[0].empresa_id; empByRut.set(rd, empId); empCreated++;
    }

    // link mandante_empresas (active)
    const lk = await pool.query('insert into mandante_empresas (mandante_id, empresa_id, activo) values ($1,$2,true) on conflict (mandante_id, empresa_id) do update set activo=true returning (xmax=0) as inserted', [mandanteId, empId]);
    if (lk.rows[0] && lk.rows[0].inserted) links++;

    // contrato
    const oc = clean(r[I.oc]) || `OC-${Math.random().toString(36).slice(2, 8)}`;
    const exists = await pool.query('select contrato_id from contratos where mandante_id=$1 and empresa_id=$2 and numero_oc=$3 and deleted_at is null limit 1', [mandanteId, empId, oc]);
    if (exists.rows[0]) { skipC++; continue; }
    const estado = (r[I.estado] || '').trim() === '1' ? 'vigente' : 'pendiente';
    const lim = parseInt(r[I.lim], 10) || 0;
    await pool.query('insert into contratos (numero_oc, mandante_id, empresa_id, limite_contingente, fecha_inicio, fecha_termino, estado, observaciones) values ($1,$2,$3,$4,$5,$6,$7,$8)',
      [oc, mandanteId, empId, lim, toDate(r[I.ini]), toDate(r[I.fin]), estado, clean(r[I.desc]) || null]);
    contr++;
  }

  console.log(`Empresas del grupo creadas: ${empCreated}`);
  console.log(`Asociaciones mandante-empresa nuevas: ${links}`);
  console.log(`Contratos creados: ${contr}`);
  console.log(`Contratos ya existentes (omitidos): ${skipC}`);
  if (skipMand.size) console.log('Mandantes no encontrados:', [...skipMand]);
  await pool.end();
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
