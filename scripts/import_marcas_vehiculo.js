const fs = require('fs');
const pg = require('pg');
const env = fs.readFileSync('/app/.env', 'utf8');
const m = env.match(/^DATABASE_URL=(.*)$/m);
const pool = new pg.Pool({ connectionString: m[1].trim().replace(/^["']|["']$/g, ''), ssl: { rejectUnauthorized: false } });

function parseCSV(text) {
  const rows = []; let f = '', row = [], q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else { if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else if (c === '\r') {} else f += c; }
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}

(async () => {
  const rows = parseCSV(fs.readFileSync(process.argv[2] || '/tmp/marcas.csv', 'utf8'));
  const h = rows.shift();
  const iNom = h.indexOf('DESCRIPCION');
  await pool.query('create table if not exists marcas_vehiculo (id serial primary key, nombre text unique not null)');
  let ins = 0;
  for (const r of rows) {
    const n = (r[iNom] || '').trim();
    if (!n) continue;
    ins += (await pool.query('insert into marcas_vehiculo (nombre) values ($1) on conflict (nombre) do nothing', [n])).rowCount;
  }
  const total = (await pool.query('select count(*)::int c from marcas_vehiculo')).rows[0].c;
  console.log(`Marcas -> nuevas: ${ins}, total en BD: ${total}`);
  await pool.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
