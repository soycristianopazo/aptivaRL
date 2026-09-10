// Seed tipos_vehiculo desde el CSV DB_LEGAV_TIPO_VEHICULO.csv (idempotente)
require('dotenv').config();
const fs = require('fs');
const { Client } = require('pg');

function parseCSV(text) {
  const rows = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  for (const line of lines) {
    const m = line.match(/"([^"]*)"\s*,\s*"([^"]*)"/);
    if (m) rows.push([m[1], m[2]]);
  }
  return rows;
}

(async () => {
  const csvPath = process.argv[2] || '/tmp/tipo_veh.csv';
  const text = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(text).slice(1); // skip header
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query('create table if not exists tipos_vehiculo (id serial primary key, nombre text unique not null)');
  let inserted = 0;
  for (const [, nombre] of rows) {
    const n = (nombre || '').trim();
    if (!n) continue;
    const r = await client.query('insert into tipos_vehiculo (nombre) values ($1) on conflict (nombre) do nothing', [n]);
    inserted += r.rowCount;
  }
  const total = (await client.query('select count(*)::int c from tipos_vehiculo')).rows[0].c;
  console.log(`Tipos vehiculo -> nuevos: ${inserted}, total en BD: ${total}`);
  await client.end();
})().catch((e) => { console.error(e); process.exit(1); });
