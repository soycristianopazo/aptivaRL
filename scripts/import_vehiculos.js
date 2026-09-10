const fs = require('fs');
const crypto = require('crypto');
const pg = require('pg');
const env = fs.readFileSync('/app/.env', 'utf8');
const getEnv = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : process.env[k]; };
const DATABASE_URL = getEnv('DATABASE_URL');
const SUPABASE_URL = (getEnv('SUPABASE_URL') || '').replace(/\/$/, '');
const SECRET = getEnv('SUPABASE_SECRET_KEY');
const BUCKET = getEnv('STORAGE_BUCKET') || 'documentos';
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 4, ssl: { rejectUnauthorized: false } });

const DRY = process.argv.includes('--dry');
const LIMIT = (() => { const a = process.argv.find(x => x.startsWith('--limit=')); return a ? parseInt(a.split('=')[1], 10) : 0; })();

// Fijos (confirmados con el usuario): todos a Maquinarias y Construcciones Rio Loa / mandante Rio Loa / contrato 4540003219
const EMPRESA_ID = 'c86d684a-2136-4a88-857a-67d8d8618962';
const MANDANTE_ID = '4550ef51-4829-4c65-aaed-a81de1a5dbe7';
const CONTRATO_ID = '7e4d0591-5ed2-478f-85cb-5e8a17c8af53';

function parseCSV(text) {
  const rows = []; let f = '', row = [], q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else { if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else if (c === '\r') {} else f += c; }
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const nn = (v) => { const s = (v == null ? '' : String(v)).trim(); return (s === '' || s === 'NULL') ? null : s; };
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
const toDate = (s) => { const t = (s || '').trim().slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null; const [y, mo, d] = t.split('-').map(Number); if (!y || !mo || !d || mo > 12 || d > 31) return null; return t; };
const absUrl = (u) => { u = (u || '').trim(); if (!u) return null; if (u.startsWith('http')) return u; return 'https://rioloa.legav.cl/' + u.replace(/^(\.\.\/)+/, '').replace(/^\/+/, ''); };

async function storageUpload(path, bytes, contentType) {
  const enc = path.split('/').map(encodeURIComponent).join('/');
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${enc}`, { method: 'POST', headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': contentType || 'application/octet-stream', 'x-upsert': 'true' }, body: bytes });
  if (!r.ok) throw new Error(`storage ${r.status}: ${(await r.text()).slice(0, 120)}`);
  return r.json().catch(() => ({}));
}

(async () => {
  const rows = parseCSV(fs.readFileSync(process.argv.find(a => a.endsWith('.csv')) || '/tmp/tipo2.csv', 'utf8'));
  const h = rows.shift().map(x => x.trim());
  const ix = (n) => h.indexOf(n);
  const I = { vid: ix('ID_VEHICULO'), pat: ix('PATENTE'), anho: ix('ANHO'), modelo: ix('MODELO'), tipo: ix('TIPO_VEHICULO'), marca: ix('MARCA'), doc: ix('DOCUMENTO'), url: ix('URL_REPOSITORIO'), mime: ix('TIPO_ARCHIVO'), peso: ix('PESO'), vhasta: ix('VIGENCIA_HASTA') };

  // requisitos vehiculo Rio Loa por nombre
  const reqRows = (await pool.query("select requisito_id, nombre from requisitos_documentales where mandante_id=$1 and tipo_recurso='vehiculo' and activo=true", [MANDANTE_ID])).rows;
  const reqByName = new Map(reqRows.map(r => [norm(r.nombre), r.requisito_id]));

  let data = rows.filter(r => r && r.length >= h.length);
  if (LIMIT) data = data.slice(0, LIMIT);

  // 1) vehiculos unicos por ID_VEHICULO (o por patente)
  const vehById = new Map();
  for (const r of data) {
    const patente = nn(r[I.pat]); if (!patente) continue;
    const key = nn(r[I.vid]) || patente;
    if (!vehById.has(key)) vehById.set(key, { patente, anho: nn(r[I.anho]), modelo: nn(r[I.modelo]), tipo: nn(r[I.tipo]), marca: nn(r[I.marca]) });
  }

  let vehCreated = 0, vehExist = 0, asigCreated = 0;
  const patToId = new Map();
  for (const [, v] of vehById) {
    let row = (await pool.query('select vehiculo_id from vehiculos where empresa_id=$1 and patente=$2 and deleted_at is null', [EMPRESA_ID, v.patente])).rows[0];
    if (!row) {
      if (DRY) { vehCreated++; patToId.set(v.patente, 'dry'); }
      else {
        const id = crypto.randomUUID();
        await pool.query('insert into vehiculos (vehiculo_id, empresa_id, patente, tipo, marca, modelo, anio) values ($1,$2,$3,$4,$5,$6,$7)', [id, EMPRESA_ID, v.patente, v.tipo, v.marca, v.modelo, v.anho ? parseInt(v.anho, 10) || null : null]);
        patToId.set(v.patente, id); vehCreated++; row = { vehiculo_id: id };
      }
    } else { patToId.set(v.patente, row.vehiculo_id); vehExist++; }
    if (!DRY && row) {
      const ex = (await pool.query("select 1 from vehiculo_asignaciones where vehiculo_id=$1 and contrato_id=$2 and estado='activo'", [row.vehiculo_id, CONTRATO_ID])).rows[0];
      if (!ex) { await pool.query("insert into vehiculo_asignaciones (vehiculo_id, empresa_id, mandante_id, contrato_id, estado) values ($1,$2,$3,$4,'activo')", [row.vehiculo_id, EMPRESA_ID, MANDANTE_ID, CONTRATO_ID]); asigCreated++; }
    }
  }

  // 2) documentos
  let okMatch = 0, noReq = 0, uploaded = 0, dupSkip = 0, errDl = 0, noVeh = 0;
  const noReqS = new Set();
  for (const r of data) {
    const url = absUrl(nn(r[I.url])); if (!url) continue;
    const patente = nn(r[I.pat]); const vid = patToId.get(patente);
    if (!vid) { noVeh++; continue; }
    const rid = reqByName.get(norm(r[I.doc]));
    if (!rid) { noReq++; if (noReqS.size < 15) noReqS.add(r[I.doc]); continue; }
    okMatch++;
    if (DRY) continue;
    const ex = (await pool.query('select 1 from documentos where recurso_tipo=$1 and recurso_id=$2 and requisito_id=$3 and mandante_id=$4 and deleted_at is null limit 1', ['vehiculo', vid, rid, MANDANTE_ID])).rows[0];
    if (ex) { dupSkip++; continue; }
    let bytes, ct;
    try { const resp = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30000) }); if (!resp.ok) throw new Error('HTTP ' + resp.status); bytes = Buffer.from(await resp.arrayBuffer()); ct = nn(r[I.mime]) || resp.headers.get('content-type') || 'application/pdf'; }
    catch (e) { errDl++; if (errDl <= 8) console.log('  download fail:', url, e.message); continue; }
    const ext = (url.split('.').pop() || 'pdf').split('?')[0].slice(0, 5);
    const path = `vehiculo/${vid}/${crypto.randomUUID()}.${ext}`;
    try { await storageUpload(path, bytes, ct); } catch (e) { errDl++; if (errDl <= 8) console.log('  upload fail:', e.message); continue; }
    await pool.query('insert into documentos (recurso_tipo, recurso_id, requisito_id, mandante_id, bucket, path, nombre_archivo, mime, tamano, fecha_vencimiento, estado) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      ['vehiculo', vid, rid, MANDANTE_ID, BUCKET, path, url.split('/').pop(), ct, parseInt(r[I.peso], 10) || bytes.length, toDate(r[I.vhasta]), 'aprobado']);
    uploaded++;
    if (uploaded % 50 === 0) console.log(`  ... subidos ${uploaded}`);
  }

  console.log(`\n${DRY ? '[DRY RUN] ' : ''}Vehiculos: creados ${vehCreated}, existentes ${vehExist} | Asignaciones nuevas: ${asigCreated}`);
  console.log(`Documentos: coinciden ${okMatch}, subidos ${uploaded}, duplicados ${dupSkip}, sin requisito ${noReq}, sin vehiculo ${noVeh}, errores ${errDl}`);
  if (noReqS.size) console.log('Ejemplos sin requisito:', [...noReqS]);
  await pool.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
