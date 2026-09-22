require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, ssl: { rejectUnauthorized: false } });
  try {
    const docs = ['008f633a-c462-4c59-a3e5-6b432da89bbc', 'e55c0827-4c36-4584-92ea-5b4d402c9301'];
    const d = await pool.query('delete from documentos where documento_id = any($1::uuid[])', [docs]);
    console.log('Documentos de prueba eliminados:', d.rowCount);
    const perfiles = (await pool.query("select perfil_id, auth_user_id, email from usuarios_perfiles where email in ('qa_visor@rioloa.cl','qa_apr@rioloa.cl')")).rows;
    console.log('Perfiles QA encontrados:', perfiles.map((p) => p.email));
    for (const p of perfiles) {
      await pool.query('delete from usuario_mandantes where perfil_id=$1', [p.perfil_id]);
      await pool.query('delete from usuarios_perfiles where perfil_id=$1', [p.perfil_id]);
    }
    console.log('Perfiles QA eliminados de BD:', perfiles.length, '(nota: cuentas Supabase Auth a limpiar aparte si es necesario)');
  } catch (e) { console.error('ERROR:', e.message); process.exitCode = 1; }
  finally { await pool.end(); }
})();
