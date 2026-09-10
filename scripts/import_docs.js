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

function parseCSV(text) {
  const rows = []; let f = '', row = [], q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else { if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else if (c === '\r') {} else f += c; }
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const digits = (s) => (s || '').replace(/[^0-9kK]/g, '');
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
const toDate = (s) => { const t = (s || '').trim().slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null; const [y, m, d] = t.split('-').map(Number); if (!y || !m || !d || m > 12 || d > 31) return null; return t; };

async function storageUpload(path, bytes, contentType) {
  const enc = path.split('/').map(encodeURIComponent).join('/');
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${enc}`, { method: 'POST', headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': contentType || 'application/octet-stream', 'x-upsert': 'true' }, body: bytes });
  if (!r.ok) throw new Error(`storage ${r.status}: ${(await r.text()).slice(0, 120)}`);
  return r.json().catch(() => ({}));
}
async function ensureBucket() {
  await fetch(`${SUPABASE_URL}/storage/v1/bucket`, { method: 'POST', headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: 20971520 }) }).catch(() => {});
}

(async () => {
  const rows = parseCSV(fs.readFileSync('/tmp/carga.csv', 'utf8'));
  const header = rows.shift().map(h => h.trim());
  const ix = (n) => header.indexOf(n);
  const I = { mand: ix('MANDANTE'), rut: ix('RUT_TRABAJADOR'), doc: ix('DOCUMENTO'), cat: ix('CATEGORIA_DOCUMENTAL'), url: ix('URL_REPOSITORIO'), type: ix('TYPE'), peso: ix('PESO'), fini: ix('FECHA_INICIO'), fter: ix('FECHA_TERMINO') };

  const mandMap = new Map((await pool.query('select mandante_id, razon_social from mandantes where deleted_at is null')).rows.map(r => [norm(r.razon_social), r.mandante_id]));
  const trabMap = new Map((await pool.query('select trabajador_id, rut from trabajadores')).rows.map(r => [digits(r.rut), r.trabajador_id]));
  // requisitos por mandante: key mandanteId|normNombre -> requisito_id ; y mandanteId|normCat|normNombre
  const reqRows = (await pool.query("select r.requisito_id, r.mandante_id, r.nombre, cat.nombre as categoria from requisitos_documentales r left join categorias_documentales cat on cat.categoria_id=r.categoria_id where r.tipo_recurso='trabajador' and r.activo=true")).rows;
  const reqByName = new Map(); const reqByCatName = new Map();
  for (const r of reqRows) { reqByName.set(`${r.mandante_id}|${norm(r.nombre)}`, r.requisito_id); reqByCatName.set(`${r.mandante_id}|${norm(r.categoria)}|${norm(r.nombre)}`, r.requisito_id); }

  let data = rows.filter(r => r && r.length >= header.length);
  if (LIMIT) data = data.slice(0, LIMIT);

  let okMatch = 0, noMand = 0, noTrab = 0, noReq = 0, uploaded = 0, dupSkip = 0, errDl = 0;
  const noReqSamples = new Set(); const noTrabSamples = new Set();
  if (!DRY) await ensureBucket();

  for (const r of data) {
    const mid = mandMap.get(norm(r[I.mand]));
    if (!mid) { noMand++; continue; }
    const tid = trabMap.get(digits(r[I.rut]));
    if (!tid) { noTrab++; if (noTrabSamples.size < 8) noTrabSamples.add(`${r[I.rut]} ${r[I.mand]}`); continue; }
    let rid = reqByCatName.get(`${mid}|${norm(r[I.cat])}|${norm(r[I.doc])}`) || reqByName.get(`${mid}|${norm(r[I.doc])}`);
    if (!rid) { noReq++; if (noReqSamples.size < 15) noReqSamples.add(`${r[I.mand]} / ${r[I.cat]} / ${r[I.doc]}`); continue; }
    okMatch++;
    if (DRY) continue;

    // idempotencia: ya existe documento para (trab, req, mand)
    const ex = await pool.query('select 1 from documentos where recurso_tipo=$1 and recurso_id=$2 and requisito_id=$3 and mandante_id=$4 and deleted_at is null limit 1', ['trabajador', tid, rid, mid]);
    if (ex.rows.length) { dupSkip++; continue; }

    // descargar
    let bytes, ct;
    try {
      const resp = await fetch(r[I.url], { redirect: 'follow', signal: AbortSignal.timeout(30000) });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const ab = await resp.arrayBuffer(); bytes = Buffer.from(ab); ct = r[I.type] || resp.headers.get('content-type') || 'application/pdf';
    } catch (e) { errDl++; if (errDl <= 5) console.log('  download fail:', r[I.url], e.message); continue; }

    const ext = (r[I.url].split('.').pop() || 'pdf').split('?')[0].slice(0, 5);
    const path = `trabajador/${tid}/${crypto.randomUUID()}.${ext}`;
    try { await storageUpload(path, bytes, ct); } catch (e) { errDl++; if (errDl <= 8) console.log('  upload fail:', e.message); continue; }

    await pool.query('insert into documentos (recurso_tipo, recurso_id, requisito_id, mandante_id, bucket, path, nombre_archivo, mime, tamano, fecha_emision, fecha_vencimiento, estado) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      ['trabajador', tid, rid, mid, BUCKET, path, r[I.url].split('/').pop(), ct, parseInt(r[I.peso], 10) || bytes.length, toDate(r[I.fini]), toDate(r[I.fter]), 'aprobado']);
    uploaded++;
    if (uploaded % 100 === 0) console.log(`  ... subidos ${uploaded}`);
  }

  console.log(`\n${DRY ? '[DRY RUN] ' : ''}Filas procesadas: ${data.length}`);
  console.log(`Coinciden (mandante+trabajador+requisito): ${okMatch}`);
  console.log(`Sin mandante: ${noMand} | Sin trabajador: ${noTrab} | Sin requisito: ${noReq}`);
  if (!DRY) console.log(`Subidos: ${uploaded} | Duplicados omitidos: ${dupSkip} | Errores descarga/subida: ${errDl}`);
  if (noReqSamples.size) console.log('Ejemplos sin requisito:', [...noReqSamples]);
  if (noTrabSamples.size) console.log('Ejemplos sin trabajador:', [...noTrabSamples]);
  await pool.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
