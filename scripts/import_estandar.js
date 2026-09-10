const fs = require('fs');
const pg = require('pg');

// Load DATABASE_URL from /app/.env
const env = fs.readFileSync('/app/.env', 'utf8');
const m = env.match(/^DATABASE_URL=(.*)$/m);
const DATABASE_URL = m ? m[1].trim().replace(/^["']|["']$/g, '') : process.env.DATABASE_URL;

const { Pool } = pg;
const pool = new Pool({ connectionString: DATABASE_URL, max: 5, ssl: { rejectUnauthorized: false } });

// Minimal CSV parser (handles quoted fields with commas)
function parseCSV(text) {
  const rows = [];
  let field = '', row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const clean = (s) => (s || '').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();

(async () => {
  const text = fs.readFileSync('/tmp/estandar.csv', 'utf8');
  const rows = parseCSV(text);
  const header = rows.shift().map((h) => h.trim());
  const idx = (name) => header.indexOf(name);
  const iMand = idx('MANDANTE'), iCat = idx('CATEGORIA'), iDescCat = idx('DESCRIPCION_CATEGORIA'),
    iDoc = idx('DOCUMENTO'), iDescDoc = idx('DESCRIPCION_DOCUMENTO'),
    iIndef = idx('INDEFINIDO'), iReq = idx('REQUERIDO');

  // Map mandante razon_social -> mandante_id
  const mres = await pool.query('select mandante_id, razon_social from mandantes where deleted_at is null');
  const mandMap = new Map(mres.rows.map((r) => [r.razon_social.trim().toLowerCase(), r.mandante_id]));

  const catCache = new Map(); // key: mandanteId|catNombre -> categoria_id
  const catOrden = new Map(); // mandanteId -> next orden
  const reqOrden = new Map(); // mandanteId|catId -> next orden

  let cats = 0, reqs = 0, skippedMand = new Set(), skippedReq = 0;

  for (const r of rows) {
    if (!r || r.length < header.length) continue;
    const mandName = (r[iMand] || '').trim();
    const catNombre = clean(r[iCat]);
    const docNombre = clean(r[iDoc]);
    if (!mandName || !catNombre || !docNombre) continue;

    const mandanteId = mandMap.get(mandName.toLowerCase());
    if (!mandanteId) { skippedMand.add(mandName); continue; }

    // Get or create categoria
    const ckey = `${mandanteId}|${catNombre.toLowerCase()}`;
    let catId = catCache.get(ckey);
    if (!catId) {
      const ex = await pool.query('select categoria_id from categorias_documentales where mandante_id=$1 and tipo_recurso=$2 and lower(nombre)=lower($3) limit 1', [mandanteId, 'trabajador', catNombre]);
      if (ex.rows[0]) { catId = ex.rows[0].categoria_id; }
      else {
        const ord = catOrden.get(mandanteId) || 0; catOrden.set(mandanteId, ord + 1);
        const ins = await pool.query('insert into categorias_documentales (mandante_id, tipo_recurso, nombre, orden) values ($1,$2,$3,$4) returning categoria_id', [mandanteId, 'trabajador', catNombre, ord]);
        catId = ins.rows[0].categoria_id; cats++;
      }
      catCache.set(ckey, catId);
    }

    // Requisito exists?
    const rex = await pool.query('select requisito_id from requisitos_documentales where mandante_id=$1 and tipo_recurso=$2 and categoria_id=$3 and lower(nombre)=lower($4) limit 1', [mandanteId, 'trabajador', catId, docNombre]);
    if (rex.rows[0]) { skippedReq++; continue; }

    const obligatorio = (r[iReq] || '').trim().toLowerCase() === 'on';
    const indef = (r[iIndef] || '').trim().toLowerCase() === 'on';
    const tieneVenc = !indef; // INDEFINIDO=on => no vence
    const descripcion = clean(r[iDescDoc]) || null;
    const rkey = `${mandanteId}|${catId}`;
    const ord = reqOrden.get(rkey) || 0; reqOrden.set(rkey, ord + 1);

    await pool.query('insert into requisitos_documentales (mandante_id, tipo_recurso, categoria_id, nombre, descripcion, obligatorio, tiene_vencimiento, dias_alerta, orden) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [mandanteId, 'trabajador', catId, docNombre, descripcion, obligatorio, tieneVenc, 30, ord]);
    reqs++;
  }

  console.log(`Categorías creadas: ${cats}`);
  console.log(`Requisitos creados: ${reqs}`);
  console.log(`Requisitos ya existentes (omitidos): ${skippedReq}`);
  if (skippedMand.size) console.log('Mandantes del CSV no encontrados en BD:', [...skippedMand]);
  await pool.end();
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
