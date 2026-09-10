const fs = require('fs');
const pg = require('pg');
const env = fs.readFileSync('/app/.env', 'utf8');
const m = env.match(/^DATABASE_URL=(.*)$/m);
const pool = new pg.Pool({ connectionString: m[1].trim().replace(/^["']|["']$/g, ''), ssl: { rejectUnauthorized: false } });

(async () => {
  const ids = (await pool.query("select mandante_id from mandantes where razon_social='Test Mandante Mining Corp' and deleted_at is null")).rows.map(r => r.mandante_id);
  if (!ids.length) { console.log('No hay Test Mandante Mining Corp activos.'); await pool.end(); return; }
  console.log('Eliminando mandantes:', ids);

  // find tables that have a mandante_id column
  const cols = (await pool.query("select table_name from information_schema.columns where column_name='mandante_id' and table_schema='public'")).rows.map(r => r.table_name).filter(t => t !== 'mandantes');

  // delete documentos first (they may FK to requisitos)
  const order = ['documentos', 'trabajador_asignaciones', 'vehiculo_asignaciones', 'equipo_asignaciones', 'requisitos_documentales', 'categorias_documentales', 'contratos', 'mandante_gerencias', 'mandante_empresas'];
  const sorted = [...order.filter(t => cols.includes(t)), ...cols.filter(t => !order.includes(t))];

  for (const t of sorted) {
    try { const r = await pool.query(`delete from ${t} where mandante_id = any($1)`, [ids]); console.log(`  ${t}: ${r.rowCount} filas eliminadas`); }
    catch (e) { console.log(`  ${t}: SKIP (${e.message})`); }
  }
  const r = await pool.query('delete from mandantes where mandante_id = any($1)', [ids]);
  console.log(`mandantes eliminados: ${r.rowCount}`);
  await pool.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
