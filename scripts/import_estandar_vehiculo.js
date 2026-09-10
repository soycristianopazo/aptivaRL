// Importa estándar documental de VEHÍCULOS para el mandante Río Loa (idempotente)
require('dotenv').config();
const fs = require('fs');
const crypto = require('crypto');
const { Client } = require('pg');

// Parser CSV simple con soporte de comillas y comas dentro de campos
function parseCSV(text) {
  const rows = [];
  let field = '', row = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') { if (field !== '' || row.length) { row.push(field); rows.push(row); row = []; field = ''; } if (c === '\r' && text[i + 1] === '\n') i++; }
      else field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

(async () => {
  const csvPath = process.argv[2] || '/tmp/estandar_veh.csv';
  const rows = parseCSV(fs.readFileSync(csvPath, 'utf8'));
  const header = rows.shift();
  const idx = (name) => header.indexOf(name);
  const iNombre = idx('NOMBRE'), iDesc = idx('DESCRIPCION'), iIndef = idx('INDEFINIDO'), iReq = idx('REQUERIDO'), iTrans = idx('TRANSVERSAL');

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Mandante Río Loa
  let m = (await client.query("select mandante_id, razon_social from mandantes where deleted_at is null and razon_social='Río Loa' limit 1")).rows[0];
  if (!m) m = (await client.query("select mandante_id, razon_social from mandantes where deleted_at is null and razon_social ilike '%Río Loa%' order by razon_social limit 1")).rows[0];
  if (!m) { console.error('No se encontró mandante Río Loa'); process.exit(1); }
  console.log('Mandante:', m.razon_social, m.mandante_id);

  // Categoría vehículo (idempotente)
  const catNombre = 'Estándar Vehículo';
  let cat = (await client.query("select categoria_id from categorias_documentales where mandante_id=$1 and tipo_recurso='vehiculo' and nombre=$2 and activo=true limit 1", [m.mandante_id, catNombre])).rows[0];
  if (!cat) {
    const cid = crypto.randomUUID();
    await client.query('insert into categorias_documentales (categoria_id, mandante_id, tipo_recurso, nombre, descripcion) values ($1,$2,$3,$4,$5)', [cid, m.mandante_id, 'vehiculo', catNombre, 'Estándar de acreditación de vehículos']);
    cat = { categoria_id: cid };
    console.log('Categoría creada:', catNombre);
  } else console.log('Categoría existente:', catNombre);

  let inserted = 0, skipped = 0;
  for (const r of rows) {
    const nombre = (r[iNombre] || '').trim();
    if (!nombre) continue;
    const descripcion = (r[iDesc] || '').trim() || null;
    const obligatorio = (r[iReq] || '').trim().toLowerCase() === 'on';
    const tiene_vencimiento = (r[iIndef] || '').trim().toLowerCase() !== 'on'; // INDEFINIDO on = sin vencimiento
    const transversal = (r[iTrans] || '').trim().toLowerCase() === 'on';
    const exists = (await client.query("select 1 from requisitos_documentales where mandante_id=$1 and tipo_recurso='vehiculo' and nombre=$2 and activo=true limit 1", [m.mandante_id, nombre])).rows[0];
    if (exists) { skipped++; continue; }
    const rid = crypto.randomUUID();
    await client.query('insert into requisitos_documentales (requisito_id, mandante_id, tipo_recurso, categoria_id, nombre, descripcion, obligatorio, tiene_vencimiento, transversal, dias_alerta) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [rid, m.mandante_id, 'vehiculo', cat.categoria_id, nombre, descripcion, obligatorio, tiene_vencimiento, transversal, 30]);
    inserted++;
  }
  console.log(`Requisitos vehículo -> nuevos: ${inserted}, omitidos (ya existían): ${skipped}`);
  await client.end();
})().catch((e) => { console.error(e); process.exit(1); });
