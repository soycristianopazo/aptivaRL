require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const fs = require('fs');

const SUPA = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SECRET = process.env.SUPABASE_SECRET_KEY;
const normRut = (s) => (s || '').toString().replace(/[^0-9kK]/g, '').toUpperCase();

// CSV parser simple (comillas dobles)
function parseCSV(text) {
  const rows = []; let i = 0, field = '', row = [], inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (c === '"') { inQ = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function findAuthUserId(email) {
  const r = await fetch(`${SUPA}/auth/v1/admin/users?page=1&per_page=500`, { headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` } });
  const b = await r.json();
  const users = b.users || b || [];
  const u = users.find((x) => (x.email || '').toLowerCase() === email.toLowerCase());
  return u ? u.id : null;
}
async function ensureAuthUser(email, password, meta) {
  const r = await fetch(`${SUPA}/auth/v1/admin/users`, {
    method: 'POST', headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.toLowerCase(), password, email_confirm: true, user_metadata: meta }),
  });
  const b = await r.json();
  if (b && b.id) return b.id;
  const existing = await findAuthUserId(email);
  if (existing) return existing;
  throw new Error('no auth id for ' + email + ' -> ' + JSON.stringify(b).slice(0, 120));
}

(async () => {
  const RUN = process.argv.includes('--run');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4, ssl: { rejectUnauthorized: false } });
  try {
    // schema idempotente
    await pool.query(`create table if not exists usuario_mandantes (
      id uuid primary key default gen_random_uuid(),
      perfil_id uuid not null references usuarios_perfiles(perfil_id) on delete cascade,
      mandante_id uuid not null references mandantes(mandante_id) on delete cascade,
      created_at timestamptz not null default now(), unique(perfil_id, mandante_id))`);
    const roles = [
      ['MANDANTE_ADMIN', 'Administrador Mandante', 'Ve todo de su mandante, carga y aprueba/rechaza documentos y gestiona usuarios del mandante'],
      ['MANDANTE_VISOR', 'Visor Mandante', 'Solo lectura de su mandante'],
      ['MANDANTE_RRHH', 'RRHH Mandante', 'Ve, carga y revisa documentos de trabajadores de su mandante'],
      ['MANDANTE_PREVENCION', 'Prevención Mandante', 'Ve, carga y revisa documentos de vehículos, equipos y seguridad de su mandante'],
    ];
    for (const [c, n, d] of roles) await pool.query('insert into roles (codigo, nombre, descripcion) values ($1,$2,$3) on conflict (codigo) do nothing', [c, n, d]);

    const raw = fs.readFileSync('/tmp/tipo_usuario.csv', 'utf8');
    const rows = parseCSV(raw);
    const hdr = rows[0];
    const idx = {}; hdr.forEach((h, i) => { idx[h.replace(/"/g, '').trim()] = i; });
    const data = rows.slice(1).filter((r) => r.length > 3);

    // mandantes DB por RUT normalizado
    const dbMand = (await pool.query('select mandante_id, razon_social, rut from mandantes where deleted_at is null')).rows;
    const mandByRut = new Map(); dbMand.forEach((m) => mandByRut.set(normRut(m.rut), m));

    // agrupar por usuario (email)
    const users = new Map();
    const mandanteMisses = new Set();
    for (const r of data) {
      const email = (r[idx['E_MAIL']] || '').trim().toLowerCase();
      if (!email) continue;
      if (!users.has(email)) users.set(email, { email, nombre: (r[idx['NOMBRE_COMPLETO']] || '').trim(), tipos: [], mandRuts: new Set() });
      const u = users.get(email);
      u.tipos.push((r[idx['ID_TIPO_MANDANTE']] || '').trim());
      const mr = normRut(r[idx['RUT_MANDANTE']]);
      if (mandByRut.has(mr)) u.mandRuts.add(mr); else mandanteMisses.add((r[idx['MANDANTE']] || '') + ' [' + r[idx['RUT_MANDANTE']] + ']');
    }

    const CAT = { '1': 'MANDANTE_ADMIN', '2': 'MANDANTE_VISOR', '3': 'MANDANTE_RRHH', '4': 'MANDANTE_PREVENCION' };
    const mapRole = (tipos) => {
      const cnt = {};
      tipos.forEach((t) => { const r = CAT[t] || 'MANDANTE_VISOR'; cnt[r] = (cnt[r] || 0) + 1; });
      return Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
    };

    console.log('Usuarios únicos:', users.size);
    console.log('Mandantes CSV sin match en DB:', [...mandanteMisses]);
    const plan = [...users.values()].map((u) => ({ email: u.email, nombre: u.nombre, role: mapRole(u.tipos), mandantes: u.mandRuts.size }));
    console.table(plan);

    if (!RUN) { console.log('\n(DRY-RUN — usa --run para crear cuentas y perfiles)'); return; }

    let created = 0, linked = 0;
    for (const u of users.values()) {
      const role = mapRole(u.tipos);
      const authId = await ensureAuthUser(u.email, 'Aptiva2025!', { nombre: u.nombre, rol: role });
      // perfil INACTIVO (sin acceso a la plataforma aún)
      await pool.query(
        `insert into usuarios_perfiles (auth_user_id, email, nombre, role_codigo, activo)
         values ($1,$2,$3,$4,false)
         on conflict (auth_user_id) do update set nombre=excluded.nombre, role_codigo=excluded.role_codigo`,
        [authId, u.email, u.nombre, role]
      );
      const perfil = (await pool.query('select perfil_id from usuarios_perfiles where auth_user_id=$1', [authId])).rows[0];
      created++;
      for (const mr of u.mandRuts) {
        const m = mandByRut.get(mr);
        await pool.query('insert into usuario_mandantes (perfil_id, mandante_id) values ($1,$2) on conflict do nothing', [perfil.perfil_id, m.mandante_id]);
        linked++;
      }
    }
    console.log(`\nLISTO. Perfiles creados/actualizados: ${created} | enlaces usuario-mandante: ${linked}`);
    console.log('Perfiles quedan INACTIVOS (sin acceso a la plataforma). Contraseña temporal: Aptiva2025!');
  } catch (e) { console.error('ERROR:', e.message); }
  finally { await pool.end(); }
})();
