const fs = require('fs');
const pg = require('pg');
const env = fs.readFileSync('/app/.env', 'utf8');
const m = env.match(/^DATABASE_URL=(.*)$/m);
const pool = new pg.Pool({ connectionString: m[1].trim().replace(/^["']|["']$/g, ''), ssl: { rejectUnauthorized: false } });

(async () => {
  const before = (await pool.query('select count(*)::int c from vehiculos')).rows[0].c;
  const r1 = await pool.query("delete from documentos where recurso_tipo='vehiculo'");
  const r2 = await pool.query('delete from vehiculo_asignaciones');
  const r3 = await pool.query('delete from vehiculos');
  console.log(`Documentos de vehiculos eliminados: ${r1.rowCount}`);
  console.log(`Asignaciones de vehiculos eliminadas: ${r2.rowCount}`);
  console.log(`Vehiculos eliminados: ${r3.rowCount} (antes habia ${before})`);
  const after = (await pool.query('select count(*)::int c from vehiculos')).rows[0].c;
  console.log(`Vehiculos restantes: ${after}`);
  await pool.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
