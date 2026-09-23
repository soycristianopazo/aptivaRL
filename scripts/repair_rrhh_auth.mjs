// Repara cuentas de Supabase Auth de usuarios cuyo perfil existe en usuarios_perfiles
// pero no pueden iniciar sesión (Auth user faltante / password distinta / auth_user_id desincronizado).
// Uso: node scripts/repair_rrhh_auth.mjs correo1 [correo2 ...]
// (con variables de entorno de /app/.env cargadas)
import { query } from '../lib/db.js';
import { adminCreateUser, adminFindUserByEmail, adminUpdateUser, authSignIn } from '../lib/supabase.js';

const PASSWORD = 'Aptiva2025!';
const emails = process.argv.slice(2).map((e) => e.toLowerCase());
if (!emails.length) { console.log('Indica al menos un correo.'); process.exit(1); }

for (const email of emails) {
  console.log(`\n=== ${email} ===`);
  const prof = (await query('select perfil_id, nombre, role_codigo, auth_user_id from usuarios_perfiles where lower(email)=$1', [email])).rows[0];
  if (!prof) { console.log('  ✗ No existe perfil en usuarios_perfiles'); continue; }
  console.log(`  perfil: ${prof.nombre} · ${prof.role_codigo} · auth_user_id=${prof.auth_user_id || '(vacío)'}`);

  let authId = null;
  const existing = await adminFindUserByEmail(email);
  if (existing) {
    authId = existing.id;
    console.log(`  Auth user encontrado (${authId}); actualizando password + confirmando email…`);
    await adminUpdateUser(authId, { password: PASSWORD, email_confirm: true });
  } else {
    console.log('  Auth user NO existe; creándolo…');
    const created = await adminCreateUser(email, PASSWORD, { nombre: prof.nombre, rol: prof.role_codigo });
    authId = created.id || created.user?.id;
    console.log(`  Auth user creado (${authId})`);
  }

  if (authId && prof.auth_user_id !== authId) {
    await query('update usuarios_perfiles set auth_user_id=$1 where perfil_id=$2', [authId, prof.perfil_id]);
    console.log('  auth_user_id del perfil sincronizado.');
  }
  await query('update usuarios_perfiles set activo=true where perfil_id=$1', [prof.perfil_id]);

  // Verificación
  try {
    const s = await authSignIn(email, PASSWORD);
    console.log(s?.access_token ? '  ✓ LOGIN OK con Aptiva2025!' : '  ✗ Login sin token');
  } catch (e) { console.log('  ✗ Login falló:', e.message); }
}
process.exit(0);
