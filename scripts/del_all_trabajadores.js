const fs = require('fs');
const pg = require('pg');
const env = fs.readFileSync('/app/.env', 'utf8');
const m = env.match(/^DATABASE_URL=(.*)$/m);
const pool = new pg.Pool({ connectionString: m[1].trim().replace(/^["']|["']$/g, ''), ssl: { rejectUnauthorized: false } });

(async () => {
  const before = (await pool.query('select count(*)::int c from trabajadores')).rows[0].c;
  const r1 = await pool.query("delete from documentos where recurso_tipo='trabajador'");
  const r2 = await pool.query('delete from trabajador_asignaciones');
  const r3 = await pool.query('delete from trabajadores');
  console.log(`Documentos de trabajadores eliminados: ${r1.rowCount}`);
  console.log(`Asignaciones eliminadas: ${r2.rowCount}`);
  console.log(`Trabajadores eliminados: ${r3.rowCount} (antes había ${before})`);
  const after = (await pool.query('select count(*)::int c from trabajadores')).rows[0].c;
  console.log(`Trabajadores restantes: ${after}`);
  await pool.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
