const fs = require('fs');
const pg = require('pg');
const env = fs.readFileSync('/app/.env', 'utf8');
const m = env.match(/^DATABASE_URL=(.*)$/m);
const pool = new pg.Pool({ connectionString: m[1].trim().replace(/^["']|["']$/g, ''), ssl: { rejectUnauthorized: false } });

const titleCase = (s) => s == null ? s : String(s).trim().toLowerCase().replace(/([\p{L}][\p{L}'’-]*)/gu, (w) => w.charAt(0).toUpperCase() + w.slice(1)) || null;

(async () => {
  // 1) Normalizar nombres/apellidos/cargos de trabajadores
  const tr = (await pool.query('select trabajador_id, nombre, apellido, cargo from trabajadores')).rows;
  let n = 0;
  for (const t of tr) {
    const nn = titleCase(t.nombre), na = titleCase(t.apellido), nc = titleCase(t.cargo);
    if (nn !== t.nombre || na !== t.apellido || nc !== t.cargo) {
      await pool.query('update trabajadores set nombre=$1, apellido=$2, cargo=$3 where trabajador_id=$4', [nn, na, nc, t.trabajador_id]);
      n++;
    }
  }
  console.log(`Trabajadores normalizados: ${n}`);

  // 2) Deduplicar empresas por nombre: conservar la de mayor uso y fusionar el resto (reasignando todas las referencias)
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.\s]/g, '').replace(/sa$/, '').trim();
  const emp = (await pool.query('select empresa_id, razon_social, rut from empresas_grupo where deleted_at is null')).rows;
  const score = async (id) => {
    const c = (await pool.query('select count(*)::int c from contratos where empresa_id=$1', [id])).rows[0].c;
    const t = (await pool.query('select count(*)::int c from trabajadores where empresa_id=$1', [id])).rows[0].c;
    const a = (await pool.query('select count(*)::int c from trabajador_asignaciones where empresa_id=$1', [id])).rows[0].c;
    return c + t + a;
  };
  const groups = {};
  for (const e of emp) { (groups[norm(e.razon_social)] = groups[norm(e.razon_social)] || []).push(e); }
  const refTables = ['contratos', 'trabajadores', 'trabajador_asignaciones', 'vehiculos', 'equipos', 'vehiculo_asignaciones', 'equipo_asignaciones', 'usuarios_perfiles'];
  let del = 0;
  for (const key of Object.keys(groups)) {
    const list = groups[key];
    if (list.length < 2) continue;
    const scored = [];
    for (const e of list) scored.push({ e, s: await score(e.empresa_id) });
    scored.sort((a, b) => b.s - a.s);
    const keep = scored[0].e;
    for (let i = 1; i < scored.length; i++) {
      const dupe = scored[i].e;
      for (const tbl of refTables) await pool.query(`update ${tbl} set empresa_id=$1 where empresa_id=$2`, [keep.empresa_id, dupe.empresa_id]).catch(() => {});
      // evitar violar unique(mandante_id, empresa_id): borrar links del duplicado
      await pool.query('delete from mandante_empresas where empresa_id=$1', [dupe.empresa_id]);
      await pool.query('delete from empresas_grupo where empresa_id=$1', [dupe.empresa_id]);
      console.log(`  Fusionada: ${dupe.razon_social} (${dupe.rut}) -> ${keep.razon_social} (${keep.rut})`);
      del++;
    }
  }
  console.log(`Empresas duplicadas eliminadas: ${del}`);
  const rest = (await pool.query('select razon_social, rut from empresas_grupo where deleted_at is null order by razon_social')).rows;
  console.log('Empresas restantes:', rest.map((r) => `${r.razon_social} (${r.rut})`));
  await pool.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
