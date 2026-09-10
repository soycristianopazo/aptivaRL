import { NextResponse } from 'next/server';
import { query, ensureSchema, uuid } from '@/lib/db';
import { authSignIn, getAuthUser, adminCreateUser, storageUpload, storageSignedUrl, BUCKET } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

async function getProfile(request) {
  const h = request.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  const authUser = await getAuthUser(token);
  if (!authUser?.id) return null;
  const r = await query('select * from usuarios_perfiles where auth_user_id=$1 and activo=true', [authUser.id]);
  return r.rows[0] || null;
}
const isSuper = (p) => p?.role_codigo === 'SUPER_ADMIN_HOLDING';
const canManage = (p) => p && ['SUPER_ADMIN_HOLDING', 'ADMIN_EMPRESA'].includes(p.role_codigo);

const titleCase = (s) => {
  if (s == null) return s;
  return String(s).trim().toLowerCase().replace(/([\p{L}][\p{L}'’-]*)/gu, (w) => w.charAt(0).toUpperCase() + w.slice(1)) || null;
};
// Valida RUT chileno (módulo 11). Acepta con o sin puntos/guión.
function validarRut(rut) {
  if (!rut) return false;
  const clean = String(rut).replace(/[.\-\s]/g, '').toUpperCase();
  if (!/^\d{7,8}[0-9K]$/.test(clean)) return false;
  const cuerpo = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let suma = 0, mul = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) { suma += parseInt(cuerpo[i], 10) * mul; mul = mul === 7 ? 2 : mul + 1; }
  const res = 11 - (suma % 11);
  const dvCalc = res === 11 ? '0' : res === 10 ? 'K' : String(res);
  return dv === dvCalc;
}
function fmtRutStr(rut) {
  const clean = String(rut || '').replace(/[.\-\s]/g, '').toUpperCase();
  if (clean.length < 2) return rut;
  const dv = clean.slice(-1); let body = clean.slice(0, -1), out = '';
  while (body.length > 3) { out = '.' + body.slice(-3) + out; body = body.slice(0, -3); }
  return body + out + '-' + dv;
}

const RECURSO_META = {
  trabajadores: { rt: 'trabajador', table: 'trabajadores', col: 'trabajador_id' },
  vehiculos: { rt: 'vehiculo', table: 'vehiculos', col: 'vehiculo_id' },
  equipos: { rt: 'equipo', table: 'equipos', col: 'equipo_id' },
};

async function depCounts(tipo, id) {
  const c = async (sql, args) => (await query(sql, args)).rows[0].c;
  const items = [];
  if (tipo === 'mandantes') {
    items.push({ label: 'Contratos', count: await c('select count(*)::int c from contratos where mandante_id=$1', [id]) });
    items.push({ label: 'Categorías documentales', count: await c('select count(*)::int c from categorias_documentales where mandante_id=$1', [id]) });
    items.push({ label: 'Documentos requeridos (estándar)', count: await c('select count(*)::int c from requisitos_documentales where mandante_id=$1', [id]) });
    items.push({ label: 'Empresas asociadas', count: await c('select count(*)::int c from mandante_empresas where mandante_id=$1', [id]) });
    items.push({ label: 'Gerencias', count: await c('select count(*)::int c from mandante_gerencias where mandante_id=$1', [id]) });
    items.push({ label: 'Asignaciones de trabajadores', count: await c('select count(*)::int c from trabajador_asignaciones where mandante_id=$1', [id]) });
    items.push({ label: 'Asignaciones de vehículos', count: await c('select count(*)::int c from vehiculo_asignaciones where mandante_id=$1', [id]) });
    items.push({ label: 'Asignaciones de equipos', count: await c('select count(*)::int c from equipo_asignaciones where mandante_id=$1', [id]) });
    items.push({ label: 'Documentos cargados', count: await c('select count(*)::int c from documentos where mandante_id=$1', [id]) });
  } else if (tipo === 'contratos') {
    items.push({ label: 'Asignaciones de trabajadores', count: await c('select count(*)::int c from trabajador_asignaciones where contrato_id=$1', [id]) });
    items.push({ label: 'Asignaciones de vehículos', count: await c('select count(*)::int c from vehiculo_asignaciones where contrato_id=$1', [id]) });
    items.push({ label: 'Asignaciones de equipos', count: await c('select count(*)::int c from equipo_asignaciones where contrato_id=$1', [id]) });
  } else if (RECURSO_META[tipo]) {
    const m = RECURSO_META[tipo];
    items.push({ label: 'Asignaciones a contratos', count: await c(`select count(*)::int c from ${m.rt}_asignaciones where ${m.col}=$1`, [id]) });
    items.push({ label: 'Documentos cargados', count: await c('select count(*)::int c from documentos where recurso_tipo=$1 and recurso_id=$2', [m.rt, id]) });
  }
  return items.filter((i) => i.count > 0);
}

async function cascadeDelete(tipo, id) {
  if (tipo === 'mandantes') {
    await query('delete from documentos where mandante_id=$1', [id]);
    await query('delete from documentos where requisito_id in (select requisito_id from requisitos_documentales where mandante_id=$1)', [id]);
    await query('delete from trabajador_asignaciones where mandante_id=$1', [id]);
    await query('delete from vehiculo_asignaciones where mandante_id=$1', [id]);
    await query('delete from equipo_asignaciones where mandante_id=$1', [id]);
    await query('delete from requisitos_documentales where mandante_id=$1', [id]);
    await query('delete from categorias_documentales where mandante_id=$1', [id]);
    await query('delete from contratos where mandante_id=$1', [id]);
    await query('delete from mandante_gerencias where mandante_id=$1', [id]);
    await query('delete from mandante_empresas where mandante_id=$1', [id]);
    await query('delete from mandantes where mandante_id=$1', [id]);
  } else if (tipo === 'contratos') {
    await query('delete from trabajador_asignaciones where contrato_id=$1', [id]);
    await query('delete from vehiculo_asignaciones where contrato_id=$1', [id]);
    await query('delete from equipo_asignaciones where contrato_id=$1', [id]);
    await query('delete from contratos where contrato_id=$1', [id]);
  } else if (RECURSO_META[tipo]) {
    const m = RECURSO_META[tipo];
    await query('delete from documentos where recurso_tipo=$1 and recurso_id=$2', [m.rt, id]);
    await query(`delete from ${m.rt}_asignaciones where ${m.col}=$1`, [id]);
    await query(`delete from ${m.table} where ${m.col}=$1`, [id]);
  }
}


async function audit(p, accion, entidad, entidad_id, nuevos) {
  try { await query('insert into auditoria (usuario, usuario_id, accion, entidad, entidad_id, valores_nuevos) values ($1,$2,$3,$4,$5,$6)', [p?.email || 'sistema', p?.auth_user_id || null, accion, entidad, entidad_id || null, nuevos ? JSON.stringify(nuevos) : null]); } catch {}
}

/* ------- Accreditation per mandante for a trabajador ------- */
async function acreditacionTrabajador(trabajadorId) {
  const asigs = (await query(
    `select a.mandante_id, m.razon_social as mandante, a.contrato_id, c.numero_oc
     from trabajador_asignaciones a join mandantes m on m.mandante_id=a.mandante_id
     join contratos c on c.contrato_id=a.contrato_id where a.trabajador_id=$1 and a.estado='activo'`, [trabajadorId])).rows;
  const out = [];
  for (const a of asigs) {
    const reqs = (await query("select r.*, cat.nombre as categoria, cat.orden as cat_orden from requisitos_documentales r left join categorias_documentales cat on cat.categoria_id=r.categoria_id where r.mandante_id=$1 and r.tipo_recurso='trabajador' and r.activo=true order by cat.orden nulls last, r.orden", [a.mandante_id])).rows;
    const docs = (await query('select * from documentos where recurso_tipo=$1 and recurso_id=$2 and mandante_id=$3 and deleted_at is null', ['trabajador', trabajadorId, a.mandante_id])).rows;
    let bloqueado = false, revision = false, obligTotal = 0, okCount = 0;
    const detalle = [];
    for (const req of reqs) {
      const doc = docs.filter((d) => d.requisito_id === req.requisito_id).sort((x, y) => new Date(y.created_at) - new Date(x.created_at))[0];
      let estado = 'faltante';
      if (doc) {
        estado = doc.estado;
        if (doc.estado === 'aprobado' && doc.fecha_vencimiento && new Date(doc.fecha_vencimiento) < new Date()) estado = 'vencido';
      }
      if (req.obligatorio) {
        obligTotal++;
        if (['faltante', 'vencido', 'rechazado'].includes(estado)) bloqueado = true;
        else if (['en_revision', 'pendiente'].includes(estado)) revision = true;
        else if (estado === 'aprobado') okCount++;
      }
      detalle.push({ requisito_id: req.requisito_id, nombre: req.nombre, categoria: req.categoria || 'Sin categoría', obligatorio: req.obligatorio, estado, fecha_vencimiento: doc?.fecha_vencimiento || null, documento_id: doc?.documento_id || null });
    }
    const estadoGlobal = bloqueado ? 'BLOQUEADO' : revision ? 'EN_REVISION' : 'ACREDITADO';
    out.push({ mandante_id: a.mandante_id, mandante: a.mandante, contrato: a.numero_oc, estado: estadoGlobal, docs_ok: okCount, docs_total: obligTotal, detalle });
  }
  return out;
}

async function acreditacionRecurso(tipo, recursoId) {
  const map = { vehiculo: { tbl: 'vehiculo_asignaciones', col: 'vehiculo_id' }, equipo: { tbl: 'equipo_asignaciones', col: 'equipo_id' }, trabajador: { tbl: 'trabajador_asignaciones', col: 'trabajador_id' } };
  const T = map[tipo];
  const asigs = (await query(
    `select a.mandante_id, m.razon_social as mandante, a.contrato_id, c.numero_oc
     from ${T.tbl} a join mandantes m on m.mandante_id=a.mandante_id
     join contratos c on c.contrato_id=a.contrato_id where a.${T.col}=$1 and a.estado='activo'`, [recursoId])).rows;
  const out = [];
  for (const a of asigs) {
    const reqs = (await query('select r.*, cat.nombre as categoria, cat.orden as cat_orden from requisitos_documentales r left join categorias_documentales cat on cat.categoria_id=r.categoria_id where r.mandante_id=$1 and r.tipo_recurso=$2 and r.activo=true order by cat.orden nulls last, r.orden', [a.mandante_id, tipo])).rows;
    const docs = (await query('select * from documentos where recurso_tipo=$1 and recurso_id=$2 and mandante_id=$3 and deleted_at is null', [tipo, recursoId, a.mandante_id])).rows;
    let bloqueado = false, revision = false, obligTotal = 0, okCount = 0;
    const detalle = [];
    for (const req of reqs) {
      const doc = docs.filter((d) => d.requisito_id === req.requisito_id).sort((x, y) => new Date(y.created_at) - new Date(x.created_at))[0];
      let estado = 'faltante';
      if (doc) { estado = doc.estado; if (doc.estado === 'aprobado' && doc.fecha_vencimiento && new Date(doc.fecha_vencimiento) < new Date()) estado = 'vencido'; }
      if (req.obligatorio) { obligTotal++; if (['faltante', 'vencido', 'rechazado'].includes(estado)) bloqueado = true; else if (['en_revision', 'pendiente'].includes(estado)) revision = true; else if (estado === 'aprobado') okCount++; }
      detalle.push({ requisito_id: req.requisito_id, nombre: req.nombre, categoria: req.categoria || 'Sin categoría', obligatorio: req.obligatorio, estado, fecha_vencimiento: doc?.fecha_vencimiento || null, documento_id: doc?.documento_id || null });
    }
    out.push({ mandante_id: a.mandante_id, mandante: a.mandante, contrato: a.numero_oc, estado: bloqueado ? 'BLOQUEADO' : revision ? 'EN_REVISION' : 'ACREDITADO', docs_ok: okCount, docs_total: obligTotal, detalle });
  }
  return out;
}

export async function GET(request, { params }) {
  try {
    await ensureSchema();
    const p = (await params)?.path || [];
    const { searchParams } = new URL(request.url);
    if (p.length === 0 || p[0] === 'health') return json({ ok: true, service: 'aptiva-rl' });

    const profile = await getProfile(request);
    if (!profile) return json({ error: 'No autorizado' }, 401);

    if (p[0] === 'me') return json({ profile });
    if (p[0] === 'roles') return json({ roles: (await query('select * from roles order by nombre')).rows });

    // Dependency preview for cascade delete (Super Admin): /api/<tipo>/:id/dependencias
    if (p[1] && p[2] === 'dependencias' && ['mandantes', 'contratos', 'trabajadores', 'vehiculos', 'equipos'].includes(p[0])) {
      if (!canManage(profile)) return json({ error: 'No autorizado' }, 403);
      const items = await depCounts(p[0], p[1]);
      return json({ items, total: items.reduce((s, i) => s + i.count, 0) });
    }

    if (p[0] === 'usuarios' && isSuper(profile)) {
      const r = await query('select up.perfil_id, up.email, up.nombre, up.role_codigo, up.activo, e.razon_social as empresa, m.razon_social as mandante from usuarios_perfiles up left join empresas_grupo e on e.empresa_id=up.empresa_id left join mandantes m on m.mandante_id=up.mandante_id order by up.created_at');
      return json({ usuarios: r.rows });
    }

    if (p[0] === 'empresas') {
      const r = await query('select e.*, (select count(*)::int from trabajadores t where t.empresa_id=e.empresa_id and t.deleted_at is null) as trabajadores_count from empresas_grupo e where e.deleted_at is null order by e.razon_social');
      return json({ empresas: r.rows });
    }

    if (p[0] === 'mandantes' && !p[1]) {
      let sql = 'select m.*, (select count(*)::int from contratos c where c.mandante_id=m.mandante_id and c.deleted_at is null) as contratos_count from mandantes m where m.deleted_at is null';
      const args = [];
      if (profile.role_codigo === 'USUARIO_MANDANTE') { sql += ' and m.mandante_id=$1'; args.push(profile.mandante_id); }
      sql += ' order by m.razon_social';
      return json({ mandantes: (await query(sql, args)).rows });
    }

    if (p[0] === 'mandantes' && p[1]) {
      const mid = p[1];
      const mandante = (await query('select * from mandantes where mandante_id=$1', [mid])).rows[0];
      if (!mandante) return json({ error: 'No encontrado' }, 404);
      const empresas = (await query('select e.* from mandante_empresas me join empresas_grupo e on e.empresa_id=me.empresa_id where me.mandante_id=$1 and me.activo=true', [mid])).rows;
      const gerencias = (await query('select * from mandante_gerencias where mandante_id=$1 order by nombre', [mid])).rows;
      const contratos = (await query('select c.*, e.razon_social as empresa, (select count(*)::int from trabajador_asignaciones a where a.contrato_id=c.contrato_id and a.estado=\'activo\') as dotacion from contratos c join empresas_grupo e on e.empresa_id=c.empresa_id where c.mandante_id=$1 and c.deleted_at is null order by c.numero_oc', [mid])).rows;
      const requisitos = (await query('select r.*, cat.nombre as categoria from requisitos_documentales r left join categorias_documentales cat on cat.categoria_id=r.categoria_id where r.mandante_id=$1 and r.activo=true order by r.tipo_recurso, r.orden', [mid])).rows;
      const categorias = (await query("select c.*, (select count(*)::int from requisitos_documentales r where r.categoria_id=c.categoria_id and r.activo=true) as docs_count from categorias_documentales c where c.mandante_id=$1 and c.activo=true order by c.orden", [mid])).rows;
      const trabajadores = (await query("select distinct t.trabajador_id, t.nombre, t.apellido, t.rut, t.cargo from trabajador_asignaciones a join trabajadores t on t.trabajador_id=a.trabajador_id where a.mandante_id=$1 and a.estado='activo'", [mid])).rows;
      return json({ mandante, empresas, gerencias, contratos, requisitos, categorias, trabajadores });
    }

    if (p[0] === 'contratos' && !p[1]) {
      let sql = "select c.*, m.razon_social as mandante, e.razon_social as empresa, g.nombre as gerencia, (select count(*)::int from trabajador_asignaciones a where a.contrato_id=c.contrato_id and a.estado='activo') as dotacion from contratos c join mandantes m on m.mandante_id=c.mandante_id join empresas_grupo e on e.empresa_id=c.empresa_id left join mandante_gerencias g on g.gerencia_id=c.gerencia_id where c.deleted_at is null";
      const args = [];
      if (profile.role_codigo === 'ADMIN_EMPRESA') { sql += ` and c.empresa_id=$${args.length + 1}`; args.push(profile.empresa_id); }
      if (profile.role_codigo === 'USUARIO_MANDANTE') { sql += ` and c.mandante_id=$${args.length + 1}`; args.push(profile.mandante_id); }
      sql += ' order by c.numero_oc';
      return json({ contratos: (await query(sql, args)).rows });
    }

    if (p[0] === 'contratos' && p[1]) {
      const c = (await query('select c.*, m.razon_social as mandante, e.razon_social as empresa, g.nombre as gerencia from contratos c join mandantes m on m.mandante_id=c.mandante_id join empresas_grupo e on e.empresa_id=c.empresa_id left join mandante_gerencias g on g.gerencia_id=c.gerencia_id where c.contrato_id=$1', [p[1]])).rows[0];
      if (!c) return json({ error: 'No encontrado' }, 404);
      const trabajadores = (await query("select t.trabajador_id, t.nombre, t.apellido, t.rut, t.cargo from trabajador_asignaciones a join trabajadores t on t.trabajador_id=a.trabajador_id where a.contrato_id=$1 and a.estado='activo'", [p[1]])).rows;
      c.dotacion = trabajadores.length;
      return json({ contrato: c, trabajadores });
    }

    if (p[0] === 'trabajadores' && !p[1]) {
      const search = searchParams.get('q');
      const empresaFilter = searchParams.get('empresa_id');
      let sql = 'select t.*, e.razon_social as empresa from trabajadores t join empresas_grupo e on e.empresa_id=t.empresa_id where t.deleted_at is null';
      const args = [];
      if (profile.role_codigo === 'ADMIN_EMPRESA') { args.push(profile.empresa_id); sql += ` and t.empresa_id=$${args.length}`; }
      else if (empresaFilter) { args.push(empresaFilter); sql += ` and t.empresa_id=$${args.length}`; }
      if (search) { args.push(`%${search}%`); sql += ` and (t.nombre ilike $${args.length} or t.apellido ilike $${args.length} or t.rut ilike $${args.length} or t.cargo ilike $${args.length})`; }
      sql += ' order by t.apellido, t.nombre limit 500';
      return json({ trabajadores: (await query(sql, args)).rows });
    }

    if (p[0] === 'trabajadores' && p[1]) {
      const t = (await query('select t.*, e.razon_social as empresa from trabajadores t join empresas_grupo e on e.empresa_id=t.empresa_id where t.trabajador_id=$1', [p[1]])).rows[0];
      if (!t) return json({ error: 'No encontrado' }, 404);
      const asignaciones = (await query('select a.*, m.razon_social as mandante, c.numero_oc, g.nombre as gerencia from trabajador_asignaciones a join mandantes m on m.mandante_id=a.mandante_id join contratos c on c.contrato_id=a.contrato_id left join mandante_gerencias g on g.gerencia_id=a.gerencia_id where a.trabajador_id=$1 order by a.created_at desc', [p[1]])).rows;
      const acreditacion = await acreditacionTrabajador(p[1]);
      const historial = (await query("select * from auditoria where entidad='trabajador' and entidad_id=$1 order by created_at desc limit 50", [p[1]])).rows;
      return json({ trabajador: t, asignaciones, acreditacion, historial });
    }

    if (p[0] === 'vehiculos' && p[1]) {
      const v = (await query('select v.*, e.razon_social as empresa from vehiculos v join empresas_grupo e on e.empresa_id=v.empresa_id where v.vehiculo_id=$1', [p[1]])).rows[0];
      if (!v) return json({ error: 'No encontrado' }, 404);
      const asignaciones = (await query('select a.*, m.razon_social as mandante, c.numero_oc from vehiculo_asignaciones a join mandantes m on m.mandante_id=a.mandante_id join contratos c on c.contrato_id=a.contrato_id where a.vehiculo_id=$1 order by a.created_at desc', [p[1]])).rows;
      const acreditacion = await acreditacionRecurso('vehiculo', p[1]);
      return json({ recurso: v, asignaciones, acreditacion });
    }
    if (p[0] === 'vehiculos') return json({ vehiculos: (await query('select v.*, e.razon_social as empresa from vehiculos v join empresas_grupo e on e.empresa_id=v.empresa_id where v.deleted_at is null order by v.patente')).rows });
    if (p[0] === 'equipos' && p[1]) {
      const q = (await query('select q.*, e.razon_social as empresa from equipos q join empresas_grupo e on e.empresa_id=q.empresa_id where q.equipo_id=$1', [p[1]])).rows[0];
      if (!q) return json({ error: 'No encontrado' }, 404);
      const asignaciones = (await query('select a.*, m.razon_social as mandante, c.numero_oc from equipo_asignaciones a join mandantes m on m.mandante_id=a.mandante_id join contratos c on c.contrato_id=a.contrato_id where a.equipo_id=$1 order by a.created_at desc', [p[1]])).rows;
      const acreditacion = await acreditacionRecurso('equipo', p[1]);
      return json({ recurso: q, asignaciones, acreditacion });
    }
    if (p[0] === 'equipos') return json({ equipos: (await query('select q.*, e.razon_social as empresa from equipos q join empresas_grupo e on e.empresa_id=q.empresa_id where q.deleted_at is null order by q.codigo_interno')).rows });

    if (p[0] === 'documentos' && p[1] === 'pendientes') {
      const r = await query("select d.*, r.nombre as requisito, t.nombre as trab_nombre, t.apellido as trab_apellido, m.razon_social as mandante from documentos d left join requisitos_documentales r on r.requisito_id=d.requisito_id left join trabajadores t on t.trabajador_id=d.recurso_id left join mandantes m on m.mandante_id=d.mandante_id where d.estado='en_revision' and d.deleted_at is null order by d.fecha_subida desc");
      return json({ documentos: r.rows });
    }
    if (p[0] === 'documentos' && p[1] && p[2] === 'url') {
      const d = (await query('select * from documentos where documento_id=$1', [p[1]])).rows[0];
      if (!d?.path) return json({ error: 'Sin archivo' }, 404);
      return json({ url: await storageSignedUrl(d.path, 900) });
    }

    if (p[0] === 'vencimientos') {
      const dias = Number(searchParams.get('dias') || 30);
      const r = await query(`select d.*, r.nombre as requisito, t.nombre as trab_nombre, t.apellido as trab_apellido, m.razon_social as mandante,
        (d.fecha_vencimiento - current_date) as dias_restantes from documentos d
        left join requisitos_documentales r on r.requisito_id=d.requisito_id
        left join trabajadores t on t.trabajador_id=d.recurso_id
        left join mandantes m on m.mandante_id=d.mandante_id
        where d.fecha_vencimiento is not null and d.deleted_at is null and d.estado='aprobado'
        and d.fecha_vencimiento <= current_date + ($1 || ' days')::interval order by d.fecha_vencimiento`, [dias]);
      return json({ documentos: r.rows });
    }

    if (p[0] === 'auditoria') return json({ eventos: (await query('select * from auditoria order by created_at desc limit 200')).rows });

    if (p[0] === 'notificaciones') {
      const rows = (await query(`select d.documento_id, d.recurso_tipo, d.recurso_id, d.fecha_vencimiento, coalesce(r.nombre, d.nombre_archivo) as documento, coalesce(r.dias_alerta,30) as dias_alerta, m.razon_social as mandante, (d.fecha_vencimiento - current_date) as dias_restantes from documentos d left join requisitos_documentales r on r.requisito_id=d.requisito_id left join mandantes m on m.mandante_id=d.mandante_id where d.deleted_at is null and d.estado='aprobado' and d.fecha_vencimiento is not null and d.fecha_vencimiento <= current_date + (coalesce(r.dias_alerta,30) || ' days')::interval order by d.fecha_vencimiento`)).rows;
      const vencidos = rows.filter((x) => x.dias_restantes < 0);
      const por_vencer = rows.filter((x) => x.dias_restantes >= 0);
      const pendientes_revision = (await query("select count(*)::int c from documentos where estado='en_revision' and deleted_at is null")).rows[0].c;
      return json({ vencidos, por_vencer, pendientes_revision, total: vencidos.length + por_vencer.length + pendientes_revision });
    }

    if (p[0] === 'dashboard') {
      const empF = searchParams.get('empresa_id') || null;
      const manF = searchParams.get('mandante_id') || null;
      const q1 = async (s, a = []) => (await query(s, a)).rows[0].c;
      const stats = {};
      stats.mandantes = manF ? 1 : await q1("select count(*)::int c from mandantes where activo=true and deleted_at is null");
      { let s = "select count(*)::int c from contratos where estado='vigente' and deleted_at is null"; const a = []; if (empF) { a.push(empF); s += ` and empresa_id=$${a.length}`; } if (manF) { a.push(manF); s += ` and mandante_id=$${a.length}`; } stats.contratos_vigentes = await q1(s, a); }
      if (manF) {
        { const a = [manF]; let s = "select count(distinct a.trabajador_id)::int c from trabajador_asignaciones a join trabajadores t on t.trabajador_id=a.trabajador_id where a.estado='activo' and a.mandante_id=$1 and t.deleted_at is null"; if (empF) { a.push(empF); s += ` and a.empresa_id=$${a.length}`; } stats.trabajadores = await q1(s, a); }
        { const a = [manF]; let s = "select count(distinct a.vehiculo_id)::int c from vehiculo_asignaciones a where a.estado='activo' and a.mandante_id=$1"; if (empF) { a.push(empF); s += ` and a.empresa_id=$${a.length}`; } stats.vehiculos = await q1(s, a); }
        { const a = [manF]; let s = "select count(distinct a.equipo_id)::int c from equipo_asignaciones a where a.estado='activo' and a.mandante_id=$1"; if (empF) { a.push(empF); s += ` and a.empresa_id=$${a.length}`; } stats.equipos = await q1(s, a); }
      } else {
        const ea = empF ? [empF] : []; const w = empF ? ' and empresa_id=$1' : '';
        stats.trabajadores = await q1(`select count(*)::int c from trabajadores where estado='activo' and deleted_at is null${w}`, ea);
        stats.vehiculos = await q1(`select count(*)::int c from vehiculos where deleted_at is null${w}`, ea);
        stats.equipos = await q1(`select count(*)::int c from equipos where deleted_at is null${w}`, ea);
      }
      const dw = manF ? ' and mandante_id=$1' : ''; const da = manF ? [manF] : [];
      stats.docs_pendientes = await q1(`select count(*)::int c from documentos where estado='en_revision' and deleted_at is null${dw}`, da);
      stats.docs_por_vencer = await q1(`select count(*)::int c from documentos where estado='aprobado' and fecha_vencimiento between current_date and current_date + interval '30 days' and deleted_at is null${dw}`, da);
      stats.docs_vencidos = await q1(`select count(*)::int c from documentos where deleted_at is null and ((estado='vencido') or (estado='aprobado' and fecha_vencimiento < current_date))${dw}`, da);
      const docs_por_estado = (await query(`select case when estado='aprobado' and fecha_vencimiento is not null and fecha_vencimiento < current_date then 'vencido' else estado end as estado, count(*)::int c from documentos where deleted_at is null${dw} group by 1`, da)).rows;

      const asigRows = (await query("select a.trabajador_id, a.empresa_id, a.mandante_id, m.razon_social as mandante from trabajador_asignaciones a join mandantes m on m.mandante_id=a.mandante_id join trabajadores t on t.trabajador_id=a.trabajador_id where a.estado='activo' and t.deleted_at is null")).rows
        .filter((r) => (!empF || r.empresa_id === empF) && (!manF || r.mandante_id === manF));
      const reqRows = (await query("select mandante_id, requisito_id, obligatorio from requisitos_documentales where tipo_recurso='trabajador' and activo=true")).rows;
      const docRows = (await query("select recurso_id, mandante_id, requisito_id, estado, fecha_vencimiento from documentos where recurso_tipo='trabajador' and deleted_at is null")).rows;
      const reqByMand = {}; reqRows.forEach((r) => { (reqByMand[r.mandante_id] = reqByMand[r.mandante_id] || []).push(r); });
      const dkey = (rid, mid, reqid) => `${rid}|${mid}|${reqid}`;
      const docMap = {}; docRows.forEach((d) => { const k = dkey(d.recurso_id, d.mandante_id, d.requisito_id); if (!docMap[k]) docMap[k] = d; });
      const now = new Date(); const rank = { ACREDITADO: 0, EN_REVISION: 1, BLOQUEADO: 2 };
      const porMandante = {}; const perWorst = {};
      for (const a of asigRows) {
        let bloq = false, rev = false;
        for (const req of (reqByMand[a.mandante_id] || [])) {
          if (!req.obligatorio) continue;
          const d = docMap[dkey(a.trabajador_id, a.mandante_id, req.requisito_id)];
          let estado = d ? d.estado : 'faltante';
          if (d && d.estado === 'aprobado' && d.fecha_vencimiento && new Date(d.fecha_vencimiento) < now) estado = 'vencido';
          if (['faltante', 'vencido', 'rechazado'].includes(estado)) bloq = true;
          else if (['en_revision', 'pendiente'].includes(estado)) rev = true;
        }
        const eg = bloq ? 'BLOQUEADO' : rev ? 'EN_REVISION' : 'ACREDITADO';
        porMandante[a.mandante] = porMandante[a.mandante] || { ACREDITADO: 0, EN_REVISION: 0, BLOQUEADO: 0 };
        porMandante[a.mandante][eg]++;
        const cur = perWorst[a.trabajador_id];
        if (cur === undefined || rank[eg] > rank[cur]) perWorst[a.trabajador_id] = eg;
      }
      let acreditados = 0, bloqueados = 0, revision = 0;
      Object.values(perWorst).forEach((v) => { if (v === 'BLOQUEADO') bloqueados++; else if (v === 'EN_REVISION') revision++; else acreditados++; });
      stats.trabajadores_acreditados = acreditados; stats.trabajadores_bloqueados = bloqueados; stats.trabajadores_revision = revision;
      return json({ stats, acreditacion_por_mandante: porMandante, docs_por_estado });
    }

    return json({ error: 'No encontrado' }, 404);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function POST(request, { params }) {
  try {
    await ensureSchema();
    const p = (await params)?.path || [];

    if (p[0] === 'auth' && p[1] === 'login') {
      const { email, password } = await request.json().catch(() => ({}));
      try {
        const session = await authSignIn(email, password);
        if (!session?.access_token) return json({ error: 'Credenciales inválidas' }, 401);
        const prof = (await query('select * from usuarios_perfiles where auth_user_id=$1', [session.user?.id])).rows[0];
        if (!prof) return json({ error: 'Usuario sin perfil asignado' }, 403);
        return json({ token: session.access_token, refresh_token: session.refresh_token, profile: prof });
      } catch (e) {
        return json({ error: 'Credenciales inválidas' }, 401);
      }
    }

    // multipart upload handled separately (documentos/upload uses formData)
    if (p[0] === 'documentos' && p[1] === 'upload') {
      const profile = await getProfile(request);
      if (!profile) return json({ error: 'No autorizado' }, 401);
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return json({ error: 'Archivo requerido' }, 400);
      const recurso_tipo = form.get('recurso_tipo') || 'trabajador';
      const recurso_id = form.get('recurso_id');
      const requisito_id = form.get('requisito_id');
      const mandante_id = form.get('mandante_id');
      const fecha_emision = form.get('fecha_emision') || null;
      const fecha_vencimiento = form.get('fecha_vencimiento') || null;
      const safe = (file.name || 'archivo').replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${recurso_tipo}/${recurso_id}/${uuid()}-${safe}`;
      const bytes = Buffer.from(await file.arrayBuffer());
      await storageUpload({ path, bytes, contentType: file.type });
      const id = uuid();
      await query(
        `insert into documentos (documento_id, recurso_tipo, recurso_id, requisito_id, mandante_id, bucket, path, nombre_archivo, mime, tamano, fecha_emision, fecha_vencimiento, estado, subido_por)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'en_revision',$13)`,
        [id, recurso_tipo, recurso_id, requisito_id || null, mandante_id || null, BUCKET, path, file.name, file.type, file.size, fecha_emision || null, fecha_vencimiento || null, profile.auth_user_id]
      );
      await audit(profile, 'cargar_documento', recurso_tipo, recurso_id, { requisito_id, nombre_archivo: file.name });
      return json({ documento: (await query('select * from documentos where documento_id=$1', [id])).rows[0] }, 201);
    }

    const profile = await getProfile(request);
    if (!profile) return json({ error: 'No autorizado' }, 401);
    const body = await request.json().catch(() => ({}));

    if (p[0] === 'documentos' && p[1] && p[2] === 'revision') {
      if (!['SUPER_ADMIN_HOLDING', 'REVISOR'].includes(profile.role_codigo)) return json({ error: 'No autorizado' }, 403);
      const { estado, observacion } = body;
      if (!['aprobado', 'rechazado'].includes(estado)) return json({ error: 'Estado inválido' }, 400);
      await query('update documentos set estado=$1, observacion_revisor=$2, revisado_por=$3, fecha_revision=now(), updated_at=now() where documento_id=$4', [estado, observacion || null, profile.auth_user_id, p[1]]);
      await query('insert into revisiones_documentales (documento_id, estado, observacion, revisado_por) values ($1,$2,$3,$4)', [p[1], estado, observacion || null, profile.auth_user_id]);
      const d = (await query('select * from documentos where documento_id=$1', [p[1]])).rows[0];
      await audit(profile, estado === 'aprobado' ? 'aprobar_documento' : 'rechazar_documento', d.recurso_tipo, d.recurso_id, { documento_id: p[1], estado });
      return json({ documento: d });
    }

    if (!canManage(profile) && !['mandantes', 'contratos'].includes(p[0])) {
      // allow only managers for most creates
    }

    if (p[0] === 'usuarios') {
      if (!isSuper(profile)) return json({ error: 'No autorizado' }, 403);
      const { email, password, nombre, role_codigo, empresa_id, mandante_id } = body;
      if (!email || !password || !nombre || !role_codigo) return json({ error: 'Faltan campos' }, 400);
      const authUser = await adminCreateUser(email, password, { nombre, rol: role_codigo });
      const authId = authUser.id || authUser.user?.id;
      const id = uuid();
      await query('insert into usuarios_perfiles (perfil_id, auth_user_id, email, nombre, role_codigo, empresa_id, mandante_id) values ($1,$2,$3,$4,$5,$6,$7)', [id, authId, email.toLowerCase(), nombre, role_codigo, empresa_id || null, mandante_id || null]);
      await audit(profile, 'crear_usuario', 'usuario', id, { email, role_codigo });
      return json({ perfil: (await query('select * from usuarios_perfiles where perfil_id=$1', [id])).rows[0] }, 201);
    }

    if (p[0] === 'empresas') {
      if (!isSuper(profile)) return json({ error: 'No autorizado' }, 403);
      const { razon_social, rut, nombre_fantasia, region, comuna, direccion } = body;
      if (!razon_social) return json({ error: 'Razón social requerida' }, 400);
      const holding = (await query('select holding_id from holdings limit 1')).rows[0];
      const id = uuid();
      await query('insert into empresas_grupo (empresa_id, holding_id, razon_social, rut, nombre_fantasia, region, comuna, direccion) values ($1,$2,$3,$4,$5,$6,$7,$8)', [id, holding?.holding_id || null, razon_social, rut || null, nombre_fantasia || null, region || null, comuna || null, direccion || null]);
      await audit(profile, 'crear_empresa', 'empresa', id, { razon_social });
      return json({ empresa: (await query('select * from empresas_grupo where empresa_id=$1', [id])).rows[0] }, 201);
    }

    if (p[0] === 'mandantes' && !p[1]) {
      if (!canManage(profile)) return json({ error: 'No autorizado' }, 403);
      const { razon_social, rut, region, comuna, direccion } = body;
      if (!razon_social || !rut) return json({ error: 'Razón social y RUT requeridos' }, 400);
      const id = uuid();
      await query('insert into mandantes (mandante_id, razon_social, rut, region, comuna, direccion) values ($1,$2,$3,$4,$5,$6)', [id, razon_social, rut, region || null, comuna || null, direccion || null]);
      await audit(profile, 'crear_mandante', 'mandante', id, { razon_social, rut });
      return json({ mandante: (await query('select * from mandantes where mandante_id=$1', [id])).rows[0] }, 201);
    }

    if (p[0] === 'mandantes' && p[1] === 'empresas') {
      if (!canManage(profile)) return json({ error: 'No autorizado' }, 403);
      const { mandante_id, empresa_id } = body;
      await query('insert into mandante_empresas (mandante_id, empresa_id) values ($1,$2) on conflict (mandante_id, empresa_id) do update set activo=true', [mandante_id, empresa_id]);
      return json({ ok: true }, 201);
    }
    if (p[0] === 'mandantes' && p[1] === 'gerencias') {
      if (!canManage(profile)) return json({ error: 'No autorizado' }, 403);
      const { mandante_id, nombre } = body;
      const id = uuid();
      await query('insert into mandante_gerencias (gerencia_id, mandante_id, nombre) values ($1,$2,$3)', [id, mandante_id, nombre]);
      return json({ gerencia: (await query('select * from mandante_gerencias where gerencia_id=$1', [id])).rows[0] }, 201);
    }

    if (p[0] === 'requisitos') {
      if (!canManage(profile)) return json({ error: 'No autorizado' }, 403);
      const { mandante_id, tipo_recurso, categoria_id, nombre, descripcion, obligatorio, tiene_vencimiento, transversal, dias_alerta } = body;
      const id = uuid();
      await query('insert into requisitos_documentales (requisito_id, mandante_id, tipo_recurso, categoria_id, nombre, descripcion, obligatorio, tiene_vencimiento, transversal, dias_alerta) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [id, mandante_id, tipo_recurso || 'trabajador', categoria_id || null, nombre, descripcion || null, obligatorio !== false, !!tiene_vencimiento, !!transversal, dias_alerta || 30]);
      return json({ requisito: (await query('select * from requisitos_documentales where requisito_id=$1', [id])).rows[0] }, 201);
    }
    if (p[0] === 'categorias') {
      if (!canManage(profile)) return json({ error: 'No autorizado' }, 403);
      const { mandante_id, tipo_recurso, nombre, descripcion } = body;
      const id = uuid();
      await query('insert into categorias_documentales (categoria_id, mandante_id, tipo_recurso, nombre, descripcion) values ($1,$2,$3,$4,$5)', [id, mandante_id, tipo_recurso || 'trabajador', nombre, descripcion || null]);
      return json({ categoria: (await query('select * from categorias_documentales where categoria_id=$1', [id])).rows[0] }, 201);
    }

    if (p[0] === 'contratos') {
      if (!canManage(profile)) return json({ error: 'No autorizado' }, 403);
      const { numero_oc, mandante_id, empresa_id, gerencia_id, limite_contingente, fecha_inicio, fecha_termino, estado, observaciones } = body;
      if (!numero_oc || !mandante_id || !empresa_id) return json({ error: 'Faltan campos' }, 400);
      const rel = await query('select 1 from mandante_empresas where mandante_id=$1 and empresa_id=$2 and activo=true', [mandante_id, empresa_id]);
      if (!rel.rows.length) return json({ error: 'La empresa no está habilitada para este mandante' }, 400);
      const id = uuid();
      await query('insert into contratos (contrato_id, numero_oc, mandante_id, empresa_id, gerencia_id, limite_contingente, fecha_inicio, fecha_termino, estado, observaciones) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [id, numero_oc, mandante_id, empresa_id, gerencia_id || null, limite_contingente || 0, fecha_inicio || null, fecha_termino || null, estado || 'vigente', observaciones || null]);
      await audit(profile, 'crear_contrato', 'contrato', id, { numero_oc });
      return json({ contrato: (await query('select * from contratos where contrato_id=$1', [id])).rows[0] }, 201);
    }

    if (p[0] === 'trabajadores' && !p[1]) {
      if (!canManage(profile)) return json({ error: 'No autorizado' }, 403);
      const { empresa_id, rut, nombre, apellido, cargo, genero, region, comuna, telefono, email } = body;
      const empId = profile.role_codigo === 'ADMIN_EMPRESA' ? profile.empresa_id : empresa_id;
      if (!empId || !rut || !nombre || !apellido) return json({ error: 'Faltan campos obligatorios' }, 400);
      if (!validarRut(rut)) return json({ error: 'RUT inválido. Verifica el número y dígito verificador.' }, 400);
      const rutFmt = fmtRutStr(rut);
      const dup = await query('select 1 from trabajadores where rut=$1', [rutFmt]);
      if (dup.rows.length) return json({ error: 'Ya existe un trabajador con ese RUT' }, 409);
      const id = uuid();
      await query('insert into trabajadores (trabajador_id, empresa_id, rut, nombre, apellido, cargo, genero, region, comuna, telefono, email) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [id, empId, rutFmt, titleCase(nombre), titleCase(apellido), titleCase(cargo), genero || null, region || null, comuna || null, telefono || null, email || null]);
      await audit(profile, 'crear_trabajador', 'trabajador', id, { rut: rutFmt, nombre, apellido });
      return json({ trabajador: (await query('select * from trabajadores where trabajador_id=$1', [id])).rows[0] }, 201);
    }

    if (p[0] === 'trabajadores' && p[1] === 'asignar') {
      if (!canManage(profile)) return json({ error: 'No autorizado' }, 403);
      const { trabajador_id, contrato_id } = body;
      const c = (await query('select * from contratos where contrato_id=$1', [contrato_id])).rows[0];
      const t = (await query('select * from trabajadores where trabajador_id=$1', [trabajador_id])).rows[0];
      if (!c || !t) return json({ error: 'Datos inválidos' }, 400);
      if (c.empresa_id !== t.empresa_id) return json({ error: 'El trabajador solo puede asignarse a contratos de su empresa' }, 400);
      try {
        const id = uuid();
        await query('insert into trabajador_asignaciones (asignacion_id, trabajador_id, empresa_id, mandante_id, contrato_id, gerencia_id) values ($1,$2,$3,$4,$5,$6)', [id, trabajador_id, t.empresa_id, c.mandante_id, contrato_id, c.gerencia_id]);
        await audit(profile, 'asignar_trabajador', 'trabajador', trabajador_id, { contrato_id, mandante_id: c.mandante_id });
        return json({ asignacion: (await query('select * from trabajador_asignaciones where asignacion_id=$1', [id])).rows[0] }, 201);
      } catch (e) {
        if (/uq_trab_contrato_activo/.test(e.message)) return json({ error: 'El trabajador ya está asignado a este contrato' }, 409);
        throw e;
      }
    }

    if ((p[0] === 'vehiculos' || p[0] === 'equipos') && p[1] === 'asignar') {
      if (!canManage(profile)) return json({ error: 'No autorizado' }, 403);
      const veh = p[0] === 'vehiculos';
      const { recurso_id, contrato_id } = body;
      const c = (await query('select * from contratos where contrato_id=$1', [contrato_id])).rows[0];
      const r = (await query(`select * from ${veh ? 'vehiculos' : 'equipos'} where ${veh ? 'vehiculo_id' : 'equipo_id'}=$1`, [recurso_id])).rows[0];
      if (!c || !r) return json({ error: 'Datos inválidos' }, 400);
      if (c.empresa_id !== r.empresa_id) return json({ error: `El ${veh ? 'vehículo' : 'equipo'} solo puede asignarse a contratos de su empresa` }, 400);
      try {
        const id = uuid();
        await query(`insert into ${veh ? 'vehiculo_asignaciones' : 'equipo_asignaciones'} (asignacion_id, ${veh ? 'vehiculo_id' : 'equipo_id'}, empresa_id, mandante_id, contrato_id) values ($1,$2,$3,$4,$5)`, [id, recurso_id, r.empresa_id, c.mandante_id, contrato_id]);
        await audit(profile, veh ? 'asignar_vehiculo' : 'asignar_equipo', p[0].slice(0, -1), recurso_id, { contrato_id });
        return json({ ok: true, asignacion_id: id }, 201);
      } catch (e) {
        if (/uq_veh_mandante_activo|uq_equ_mandante_activo/.test(e.message)) return json({ error: `El ${veh ? 'vehículo' : 'equipo'} ya tiene una asignación activa con este mandante` }, 409);
        throw e;
      }
    }

    if (p[0] === 'vehiculos' && !p[1]) {
      if (!canManage(profile)) return json({ error: 'No autorizado' }, 403);
      const { empresa_id, patente, tipo, marca, modelo, anio, num_motor, num_chasis } = body;
      const empId = profile.role_codigo === 'ADMIN_EMPRESA' ? profile.empresa_id : empresa_id;
      if (!empId || !patente) return json({ error: 'Empresa y patente requeridas' }, 400);
      const id = uuid();
      await query('insert into vehiculos (vehiculo_id, empresa_id, patente, tipo, marca, modelo, anio, num_motor, num_chasis) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id, empId, patente, tipo || null, marca || null, modelo || null, anio || null, num_motor || null, num_chasis || null]);
      return json({ vehiculo: (await query('select * from vehiculos where vehiculo_id=$1', [id])).rows[0] }, 201);
    }
    if (p[0] === 'equipos' && !p[1]) {
      if (!canManage(profile)) return json({ error: 'No autorizado' }, 403);
      const { empresa_id, codigo_interno, tipo, marca, modelo, anio, num_serie } = body;
      const empId = profile.role_codigo === 'ADMIN_EMPRESA' ? profile.empresa_id : empresa_id;
      if (!empId || !codigo_interno) return json({ error: 'Empresa y código requeridos' }, 400);
      const id = uuid();
      await query('insert into equipos (equipo_id, empresa_id, codigo_interno, tipo, marca, modelo, anio, num_serie) values ($1,$2,$3,$4,$5,$6,$7,$8)', [id, empId, codigo_interno, tipo || null, marca || null, modelo || null, anio || null, num_serie || null]);
      return json({ equipo: (await query('select * from equipos where equipo_id=$1', [id])).rows[0] }, 201);
    }

    return json({ error: 'No encontrado' }, 404);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function PUT(request, { params }) {
  try {
    await ensureSchema();
    const p = (await params)?.path || [];
    const profile = await getProfile(request);
    if (!profile) return json({ error: 'No autorizado' }, 401);
    if (!canManage(profile)) return json({ error: 'No autorizado' }, 403);
    const body = await request.json().catch(() => ({}));
    const build = (allowed) => { const cols = []; const vals = []; let i = 1; for (const k of allowed) { if (body[k] !== undefined) { cols.push(`${k}=$${i++}`); vals.push(body[k]); } } return { cols, vals, i }; };

    if (p[0] === 'mandantes' && p[1]) {
      const { cols, vals, i } = build(['razon_social', 'rut', 'direccion', 'region', 'comuna', 'activo']);
      if (!cols.length) return json({ error: 'Nada que actualizar' }, 400);
      vals.push(p[1]);
      await query(`update mandantes set ${cols.join(', ')}, updated_at=now() where mandante_id=$${i}`, vals);
      await audit(profile, 'editar_mandante', 'mandante', p[1], body);
      return json({ mandante: (await query('select * from mandantes where mandante_id=$1', [p[1]])).rows[0] });
    }
    if (p[0] === 'contratos' && p[1]) {
      const { cols, vals, i } = build(['numero_oc', 'limite_contingente', 'fecha_inicio', 'fecha_termino', 'estado', 'observaciones', 'gerencia_id']);
      if (!cols.length) return json({ error: 'Nada que actualizar' }, 400);
      vals.push(p[1]);
      await query(`update contratos set ${cols.join(', ')}, updated_at=now() where contrato_id=$${i}`, vals);
      await audit(profile, 'editar_contrato', 'contrato', p[1], body);
      return json({ contrato: (await query('select * from contratos where contrato_id=$1', [p[1]])).rows[0] });
    }
    if (p[0] === 'trabajadores' && p[1]) {
      ['nombre', 'apellido', 'cargo'].forEach((k) => { if (body[k] != null) body[k] = titleCase(body[k]); });
      const { cols, vals, i } = build(['nombre', 'apellido', 'cargo', 'genero', 'region', 'comuna', 'telefono', 'email', 'direccion', 'estado']);
      if (!cols.length) return json({ error: 'Nada que actualizar' }, 400);
      vals.push(p[1]);
      await query(`update trabajadores set ${cols.join(', ')}, updated_at=now() where trabajador_id=$${i}`, vals);
      await audit(profile, 'editar_trabajador', 'trabajador', p[1], body);
      return json({ trabajador: (await query('select * from trabajadores where trabajador_id=$1', [p[1]])).rows[0] });
    }
    if (p[0] === 'requisitos' && p[1]) {
      const { cols, vals, i } = build(['nombre', 'descripcion', 'obligatorio', 'tiene_vencimiento', 'transversal', 'dias_alerta', 'orden', 'activo', 'categoria_id']);
      if (!cols.length) return json({ error: 'Nada que actualizar' }, 400);
      vals.push(p[1]);
      await query(`update requisitos_documentales set ${cols.join(', ')}, updated_at=now() where requisito_id=$${i}`, vals);
      return json({ requisito: (await query('select * from requisitos_documentales where requisito_id=$1', [p[1]])).rows[0] });
    }
    if (p[0] === 'categorias' && p[1]) {
      const { cols, vals, i } = build(['nombre', 'descripcion', 'orden', 'activo']);
      if (!cols.length) return json({ error: 'Nada que actualizar' }, 400);
      vals.push(p[1]);
      await query(`update categorias_documentales set ${cols.join(', ')} where categoria_id=$${i}`, vals);
      return json({ categoria: (await query('select * from categorias_documentales where categoria_id=$1', [p[1]])).rows[0] });
    }
    return json({ error: 'No encontrado' }, 404);
  } catch (e) { return json({ error: e.message }, 500); }
}

export async function DELETE(request, { params }) {
  try {
    await ensureSchema();
    const p = (await params)?.path || [];
    const profile = await getProfile(request);
    if (!profile) return json({ error: 'No autorizado' }, 401);
    if (!canManage(profile)) return json({ error: 'No autorizado' }, 403);

    // Super Admin Holding: borrado en cascada sin importar dependencias
    if (isSuper(profile) && p[1] && !p[2] && ['mandantes', 'contratos', 'trabajadores', 'vehiculos', 'equipos'].includes(p[0])) {
      await cascadeDelete(p[0], p[1]);
      await audit(profile, 'eliminar_cascada', p[0], p[1], null);
      return json({ ok: true, cascada: true });
    }

    if (p[0] === 'requisitos' && p[1]) { await query('update requisitos_documentales set activo=false where requisito_id=$1', [p[1]]); return json({ ok: true }); }
    if (p[0] === 'categorias' && p[1]) { await query('update categorias_documentales set activo=false where categoria_id=$1', [p[1]]); return json({ ok: true }); }
    if (p[0] === 'mandantes' && p[1] && p[2] === 'empresas' && p[3]) { await query('update mandante_empresas set activo=false where mandante_id=$1 and empresa_id=$2', [p[1], p[3]]); return json({ ok: true }); }
    if (p[0] === 'trabajadores' && p[1]) { await query("update trabajadores set deleted_at=now(), estado='inactivo' where trabajador_id=$1", [p[1]]); await audit(profile, 'desactivar_trabajador', 'trabajador', p[1], null); return json({ ok: true }); }
    if (p[0] === 'mandantes' && p[1]) { await query("update mandantes set deleted_at=now(), activo=false, updated_at=now() where mandante_id=$1", [p[1]]); await audit(profile, 'eliminar_mandante', 'mandante', p[1], null); return json({ ok: true }); }
    return json({ error: 'No encontrado' }, 404);
  } catch (e) { return json({ error: e.message }, 500); }
}
