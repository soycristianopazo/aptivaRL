import pg from 'pg';
import crypto from 'crypto';
import { ensureAuthUser, ensureBucket } from './supabase.js';

const { Pool } = pg;
const g = globalThis;

export const pool =
  g.__aptivaPool ||
  new Pool({ connectionString: process.env.DATABASE_URL, max: 5, ssl: { rejectUnauthorized: false } });
if (!g.__aptivaPool) g.__aptivaPool = pool;

export async function query(text, params) { return pool.query(text, params); }
export const uuid = () => crypto.randomUUID();

let schemaPromise = null;
export function ensureSchema() {
  if (!schemaPromise) schemaPromise = init().catch((e) => { schemaPromise = null; throw e; });
  return schemaPromise;
}

const DDL = `
create extension if not exists pgcrypto;

create table if not exists tipos_vehiculo (
  id serial primary key,
  nombre text unique not null
);

create table if not exists holdings (
  holding_id uuid primary key default gen_random_uuid(),
  nombre text not null, rut text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table if not exists empresas_grupo (
  empresa_id uuid primary key default gen_random_uuid(),
  holding_id uuid references holdings(holding_id),
  razon_social text not null, rut text unique, nombre_fantasia text,
  direccion text, region text, comuna text,
  activo boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table if not exists roles (
  role_id uuid primary key default gen_random_uuid(),
  codigo text unique not null, nombre text not null, descripcion text
);

create table if not exists usuarios_perfiles (
  perfil_id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  email text not null, nombre text not null,
  role_codigo text not null references roles(codigo),
  empresa_id uuid references empresas_grupo(empresa_id),
  mandante_id uuid,
  activo boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists mandantes (
  mandante_id uuid primary key default gen_random_uuid(),
  razon_social text not null, rut text not null,
  direccion text, region text, comuna text,
  activo boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table if not exists mandante_empresas (
  id uuid primary key default gen_random_uuid(),
  mandante_id uuid not null references mandantes(mandante_id) on delete cascade,
  empresa_id uuid not null references empresas_grupo(empresa_id) on delete cascade,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique(mandante_id, empresa_id)
);

create table if not exists mandante_gerencias (
  gerencia_id uuid primary key default gen_random_uuid(),
  mandante_id uuid not null references mandantes(mandante_id) on delete cascade,
  nombre text not null, activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists contratos (
  contrato_id uuid primary key default gen_random_uuid(),
  numero_oc text not null,
  mandante_id uuid not null references mandantes(mandante_id),
  empresa_id uuid not null references empresas_grupo(empresa_id),
  gerencia_id uuid references mandante_gerencias(gerencia_id),
  limite_contingente int not null default 0,
  fecha_inicio date, fecha_termino date,
  estado text not null default 'vigente' check (estado in ('pendiente','vigente','finalizado','suspendido')),
  observaciones text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table if not exists trabajadores (
  trabajador_id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas_grupo(empresa_id),
  rut text unique not null,
  nombre text not null, apellido text not null,
  cargo text, genero text, region text, comuna text, telefono text,
  estado text not null default 'activo' check (estado in ('activo','inactivo')),
  email text, nacionalidad text, fecha_nacimiento date, direccion text,
  tipo_contrato text, fecha_ingreso date, fecha_termino_laboral date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table if not exists trabajador_asignaciones (
  asignacion_id uuid primary key default gen_random_uuid(),
  trabajador_id uuid not null references trabajadores(trabajador_id) on delete cascade,
  empresa_id uuid not null references empresas_grupo(empresa_id),
  mandante_id uuid not null references mandantes(mandante_id),
  contrato_id uuid not null references contratos(contrato_id),
  gerencia_id uuid references mandante_gerencias(gerencia_id),
  fecha_asignacion date not null default current_date, fecha_desasignacion date,
  estado text not null default 'activo' check (estado in ('activo','inactivo')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists uq_trab_contrato_activo on trabajador_asignaciones (trabajador_id, contrato_id) where estado = 'activo';

create table if not exists vehiculos (
  vehiculo_id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas_grupo(empresa_id),
  patente text unique not null, tipo text, marca text, modelo text, anio int,
  num_motor text, num_chasis text,
  estado text not null default 'activo' check (estado in ('activo','inactivo')),
  observaciones text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists vehiculo_asignaciones (
  asignacion_id uuid primary key default gen_random_uuid(),
  vehiculo_id uuid not null references vehiculos(vehiculo_id) on delete cascade,
  empresa_id uuid not null references empresas_grupo(empresa_id),
  mandante_id uuid not null references mandantes(mandante_id),
  contrato_id uuid not null references contratos(contrato_id),
  fecha_asignacion date not null default current_date, fecha_desasignacion date,
  estado text not null default 'activo',
  created_at timestamptz not null default now()
);
create unique index if not exists uq_veh_mandante_activo on vehiculo_asignaciones (vehiculo_id, mandante_id) where estado = 'activo';

create table if not exists equipos (
  equipo_id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas_grupo(empresa_id),
  codigo_interno text not null, tipo text, marca text, modelo text, anio int, num_serie text,
  estado text not null default 'activo' check (estado in ('activo','inactivo')),
  observaciones text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique(empresa_id, codigo_interno)
);
create table if not exists equipo_asignaciones (
  asignacion_id uuid primary key default gen_random_uuid(),
  equipo_id uuid not null references equipos(equipo_id) on delete cascade,
  empresa_id uuid not null references empresas_grupo(empresa_id),
  mandante_id uuid not null references mandantes(mandante_id),
  contrato_id uuid not null references contratos(contrato_id),
  fecha_asignacion date not null default current_date, fecha_desasignacion date,
  estado text not null default 'activo',
  created_at timestamptz not null default now()
);
create unique index if not exists uq_equ_mandante_activo on equipo_asignaciones (equipo_id, mandante_id) where estado = 'activo';

create table if not exists categorias_documentales (
  categoria_id uuid primary key default gen_random_uuid(),
  mandante_id uuid not null references mandantes(mandante_id) on delete cascade,
  tipo_recurso text not null check (tipo_recurso in ('empresa','trabajador','vehiculo','equipo')),
  nombre text not null, descripcion text, orden int not null default 0, activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists requisitos_documentales (
  requisito_id uuid primary key default gen_random_uuid(),
  mandante_id uuid not null references mandantes(mandante_id) on delete cascade,
  tipo_recurso text not null check (tipo_recurso in ('empresa','trabajador','vehiculo','equipo')),
  categoria_id uuid references categorias_documentales(categoria_id),
  nombre text not null, descripcion text,
  obligatorio boolean not null default true,
  tiene_vencimiento boolean not null default false,
  transversal boolean not null default false,
  dias_alerta int not null default 30,
  orden int not null default 0, activo boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists documentos (
  documento_id uuid primary key default gen_random_uuid(),
  recurso_tipo text not null check (recurso_tipo in ('empresa','trabajador','vehiculo','equipo')),
  recurso_id uuid not null,
  requisito_id uuid references requisitos_documentales(requisito_id),
  mandante_id uuid references mandantes(mandante_id),
  bucket text, path text, nombre_archivo text, mime text, tamano bigint,
  fecha_emision date, fecha_vencimiento date,
  estado text not null default 'pendiente' check (estado in ('pendiente','en_revision','aprobado','rechazado','vencido')),
  subido_por uuid, fecha_subida timestamptz default now(),
  observacion_revisor text, revisado_por uuid, fecha_revision timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index if not exists idx_doc_recurso on documentos (recurso_tipo, recurso_id);
create index if not exists idx_doc_requisito on documentos (requisito_id);

create table if not exists revisiones_documentales (
  revision_id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references documentos(documento_id) on delete cascade,
  estado text not null, observacion text, revisado_por uuid,
  created_at timestamptz not null default now()
);

create table if not exists auditoria (
  auditoria_id uuid primary key default gen_random_uuid(),
  usuario text, usuario_id uuid, accion text not null, entidad text, entidad_id uuid,
  valores_anteriores jsonb, valores_nuevos jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_entidad on auditoria (entidad, entidad_id);
`;

async function enableRLS() {
  const tables = ['holdings','empresas_grupo','roles','usuarios_perfiles','mandantes','mandante_empresas','mandante_gerencias','contratos','trabajadores','trabajador_asignaciones','vehiculos','vehiculo_asignaciones','equipos','equipo_asignaciones','categorias_documentales','requisitos_documentales','documentos','revisiones_documentales','auditoria'];
  for (const t of tables) {
    try {
      await pool.query(`alter table ${t} enable row level security;`);
      await pool.query(`do $$ begin if not exists (select 1 from pg_policies where tablename='${t}' and policyname='p_service') then create policy p_service on ${t} for all to authenticated, service_role using (true) with check (true); end if; end $$;`);
    } catch (e) { /* ignore */ }
  }
}

async function init() {
  await pool.query(DDL);
  // Migration: mandantes can represent faenas that share a RUT, so RUT must not be unique.
  await pool.query('alter table mandantes drop constraint if exists mandantes_rut_key').catch(() => {});
  await pool.query('alter table categorias_documentales add column if not exists descripcion text').catch(() => {});
  await pool.query('alter table requisitos_documentales add column if not exists transversal boolean not null default false').catch(() => {});
  // Un trabajador puede estar en muchos contratos (incluso del mismo mandante); solo se evita duplicar el mismo contrato activo.
  await pool.query('drop index if exists uq_trab_mandante_activo').catch(() => {});
  await pool.query("create unique index if not exists uq_trab_contrato_activo on trabajador_asignaciones (trabajador_id, contrato_id) where estado = 'activo'").catch(() => {});
  await enableRLS();
  await ensureBucket().catch(() => {});

  const roles = [
    ['SUPER_ADMIN_HOLDING', 'Super Administrador Holding', 'Acceso total a todo el sistema'],
    ['ADMIN_EMPRESA', 'Administrador Empresa', 'Administra recursos de su empresa del holding'],
    ['USUARIO_MANDANTE', 'Usuario Mandante', 'Visualiza únicamente su mandante'],
    ['REVISOR', 'Revisor Documental', 'Revisa, aprueba o rechaza documentos'],
  ];
  for (const [codigo, nombre, desc] of roles) {
    await pool.query('insert into roles (codigo, nombre, descripcion) values ($1,$2,$3) on conflict (codigo) do nothing', [codigo, nombre, desc]);
  }

  const { rows: cnt } = await pool.query('select count(*)::int c from empresas_grupo');
  if (cnt[0].c === 0) await seedBusiness();

  const { rows: pc } = await pool.query('select count(*)::int c from usuarios_perfiles');
  if (pc[0].c === 0) await seedUsers();

  const { rows: vr } = await pool.query("select count(*)::int c from requisitos_documentales where tipo_recurso in ('vehiculo','equipo')");
  if (vr[0].c === 0) await seedRecursoReqs();
}

async function seedRecursoReqs() {
  const mandantes = (await pool.query('select mandante_id from mandantes order by created_at')).rows;
  const defs = {
    vehiculo: [
      { cat: 'Documentación Legal', reqs: [['Permiso de Circulación', true, true, 30], ['SOAP', true, true, 30], ['Revisión Técnica', true, true, 30]] },
      { cat: 'Estándar Mandante', reqs: [['Check List Vehículo', true, true, 180], ['Certificación GPS', false, true, 365]] },
    ],
    equipo: [
      { cat: 'Documentación Técnica', reqs: [['Certificado de Mantención', true, true, 180], ['Manual de Operación', false, false, 0]] },
      { cat: 'Estándar Mandante', reqs: [['Check List Equipo', true, true, 180], ['Certificación Operativa', true, true, 365]] },
    ],
  };
  for (const m of mandantes) {
    for (const tipo of Object.keys(defs)) {
      let ordC = 0;
      for (const c of defs[tipo]) {
        const catId = uuid();
        await pool.query('insert into categorias_documentales (categoria_id, mandante_id, tipo_recurso, nombre, orden) values ($1,$2,$3,$4,$5)', [catId, m.mandante_id, tipo, c.cat, ordC++]);
        let ordR = 0;
        for (const [nombre, oblig, venc, dias] of c.reqs) {
          await pool.query('insert into requisitos_documentales (requisito_id, mandante_id, tipo_recurso, categoria_id, nombre, obligatorio, tiene_vencimiento, dias_alerta, orden) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [uuid(), m.mandante_id, tipo, catId, nombre, oblig, venc, dias, ordR++]);
        }
      }
    }
  }
  const vehs = (await pool.query('select vehiculo_id, empresa_id from vehiculos')).rows;
  for (const v of vehs) {
    const c = (await pool.query('select contrato_id, mandante_id from contratos where empresa_id=$1 limit 1', [v.empresa_id])).rows[0];
    if (c) { try { await pool.query('insert into vehiculo_asignaciones (vehiculo_id, empresa_id, mandante_id, contrato_id) values ($1,$2,$3,$4)', [v.vehiculo_id, v.empresa_id, c.mandante_id, c.contrato_id]); } catch {} }
  }
  const equs = (await pool.query('select equipo_id, empresa_id from equipos')).rows;
  for (const q of equs) {
    const c = (await pool.query('select contrato_id, mandante_id from contratos where empresa_id=$1 limit 1', [q.empresa_id])).rows[0];
    if (c) { try { await pool.query('insert into equipo_asignaciones (equipo_id, empresa_id, mandante_id, contrato_id) values ($1,$2,$3,$4)', [q.equipo_id, q.empresa_id, c.mandante_id, c.contrato_id]); } catch {} }
  }
  console.log('[seed] vehiculo/equipo requisitos created');
}

async function seedBusiness() {
  const holdingId = uuid();
  await pool.query('insert into holdings (holding_id, nombre, rut) values ($1,$2,$3)', [holdingId, 'Holding Río Loa', '76.111.222-3']);

  const empresas = [
    { id: uuid(), rs: 'RL Maquinarias y Servicios S.A.', rut: '76.201.001-1', ff: 'RL Maquinarias', region: 'Antofagasta', comuna: 'Calama' },
    { id: uuid(), rs: 'Maquinarias y Construcciones Río Loa S.A.', rut: '76.201.002-K', ff: 'MC Río Loa', region: 'Antofagasta', comuna: 'Calama' },
    { id: uuid(), rs: 'Empresa de Muellaje Río Loa S.A.', rut: '76.201.003-8', ff: 'Muellaje Río Loa', region: 'Antofagasta', comuna: 'Mejillones' },
  ];
  for (const e of empresas) {
    await pool.query('insert into empresas_grupo (empresa_id, holding_id, razon_social, rut, nombre_fantasia, region, comuna) values ($1,$2,$3,$4,$5,$6,$7)', [e.id, holdingId, e.rs, e.rut, e.ff, e.region, e.comuna]);
  }

  const mandantes = [
    { id: uuid(), rs: 'Minera Sierra Gorda SCM', rut: '77.500.100-2', region: 'Antofagasta', comuna: 'Sierra Gorda' },
    { id: uuid(), rs: 'Puerto Mejillones S.A.', rut: '77.500.200-9', region: 'Antofagasta', comuna: 'Mejillones' },
  ];
  for (const m of mandantes) {
    await pool.query('insert into mandantes (mandante_id, razon_social, rut, region, comuna) values ($1,$2,$3,$4,$5)', [m.id, m.rs, m.rut, m.region, m.comuna]);
  }

  const gerData = { [mandantes[0].id]: ['Gerencia Operaciones', 'Gerencia Mantenimiento', 'Gerencia HSEC', 'Gerencia Proyectos'], [mandantes[1].id]: ['Gerencia Operaciones Portuarias', 'Gerencia Mantenimiento', 'Gerencia HSEC'] };
  const gerencias = {};
  for (const mid of Object.keys(gerData)) {
    gerencias[mid] = [];
    for (const nombre of gerData[mid]) { const gid = uuid(); await pool.query('insert into mandante_gerencias (gerencia_id, mandante_id, nombre) values ($1,$2,$3)', [gid, mid, nombre]); gerencias[mid].push({ gid, nombre }); }
  }

  const me = [[mandantes[0].id, empresas[0].id], [mandantes[0].id, empresas[1].id], [mandantes[1].id, empresas[0].id], [mandantes[1].id, empresas[2].id]];
  for (const [mid, eid] of me) await pool.query('insert into mandante_empresas (mandante_id, empresa_id) values ($1,$2) on conflict do nothing', [mid, eid]);

  const contratos = [
    { id: uuid(), oc: 'OC-1001', mid: mandantes[0].id, eid: empresas[0].id, gid: gerencias[mandantes[0].id][0].gid, limite: 60, estado: 'vigente' },
    { id: uuid(), oc: 'OC-1002', mid: mandantes[0].id, eid: empresas[1].id, gid: gerencias[mandantes[0].id][1].gid, limite: 30, estado: 'vigente' },
    { id: uuid(), oc: 'OC-2001', mid: mandantes[1].id, eid: empresas[0].id, gid: gerencias[mandantes[1].id][0].gid, limite: 20, estado: 'vigente' },
  ];
  for (const c of contratos) {
    await pool.query("insert into contratos (contrato_id, numero_oc, mandante_id, empresa_id, gerencia_id, limite_contingente, fecha_inicio, fecha_termino, estado) values ($1,$2,$3,$4,$5,$6, current_date - interval '90 days', current_date + interval '275 days', $7)", [c.id, c.oc, c.mid, c.eid, c.gid, c.limite, c.estado]);
  }

  const nombres = [['Juan','Pérez'],['María','González'],['Pedro','Rojas'],['Ana','Muñoz'],['Luis','Fuentes'],['Carla','Díaz'],['Jorge','Soto'],['Paola','Castro'],['Diego','Araya'],['Fernanda','Vega']];
  const cargos = ['Operador de Equipo','Conductor','Mantenedor','Supervisor','Prevencionista','Ayudante','Operador de Grúa','Bodeguero','Eléctrico','Soldador'];
  const trabajadores = [];
  for (let i = 0; i < 10; i++) {
    const id = uuid();
    const emp = empresas[i % 3].id;
    const rut = `1${(1000000 + i * 111111)}-${i % 10}`;
    await pool.query('insert into trabajadores (trabajador_id, empresa_id, rut, nombre, apellido, cargo, genero, region, comuna, telefono) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [id, emp, rut, nombres[i][0], nombres[i][1], cargos[i], i % 2 === 0 ? 'M' : 'F', 'Antofagasta', 'Calama', `+5695${1000000 + i}`]);
    trabajadores.push({ id, emp });
  }

  const asig = [];
  const emp0Workers = trabajadores.filter((t) => t.emp === empresas[0].id);
  const emp1Workers = trabajadores.filter((t) => t.emp === empresas[1].id);
  emp0Workers.forEach((t, idx) => {
    asig.push({ tid: t.id, eid: empresas[0].id, mid: mandantes[0].id, cid: contratos[0].id, gid: contratos[0].gid });
    if (idx < 2) asig.push({ tid: t.id, eid: empresas[0].id, mid: mandantes[1].id, cid: contratos[2].id, gid: contratos[2].gid });
  });
  emp1Workers.forEach((t) => asig.push({ tid: t.id, eid: empresas[1].id, mid: mandantes[0].id, cid: contratos[1].id, gid: contratos[1].gid }));
  for (const a of asig) await pool.query('insert into trabajador_asignaciones (trabajador_id, empresa_id, mandante_id, contrato_id, gerencia_id) values ($1,$2,$3,$4,$5)', [a.tid, a.eid, a.mid, a.cid, a.gid]);

  const vehs = [['ABCD-12','Camioneta','Toyota','Hilux',2022],['EFGH-34','Camión','Volvo','FMX',2021],['IJKL-56','Bus','Mercedes','OF-1721',2020],['MNOP-78','Camioneta','Ford','Ranger',2023]];
  for (let i = 0; i < vehs.length; i++) { const v = vehs[i]; await pool.query('insert into vehiculos (empresa_id, patente, tipo, marca, modelo, anio) values ($1,$2,$3,$4,$5,$6)', [empresas[i % 3].id, v[0], v[1], v[2], v[3], v[4]]); }
  const equs = [['EQ-001','Excavadora','Caterpillar','336',2021],['EQ-002','Grúa','Liebherr','LTM 1050',2019],['EQ-003','Generador','Cummins','C150',2022]];
  for (let i = 0; i < equs.length; i++) { const e = equs[i]; await pool.query('insert into equipos (empresa_id, codigo_interno, tipo, marca, modelo, anio) values ($1,$2,$3,$4,$5,$6)', [empresas[i % 3].id, e[0], e[1], e[2], e[3], e[4]]); }

  const catDefs = [
    { nombre: 'Documentos Laborales', reqs: [['Contrato de Trabajo', true, false, 0], ['Anexo de Contrato', false, false, 0], ['Certificado de Antecedentes', true, true, 180]] },
    { nombre: 'Salud Ocupacional', reqs: [['Examen Preocupacional', true, true, 365], ['Examen Altura Geográfica', true, true, 365], ['Examen Psicosensotécnico', true, true, 365]] },
    { nombre: 'Competencias', reqs: [['Licencia de Conducir', false, true, 30], ['Curso de Inducción', true, true, 365]] },
  ];
  const reqsByMandante = {};
  for (const m of mandantes) {
    reqsByMandante[m.id] = [];
    let ordC = 0;
    for (const cat of catDefs) {
      const catId = uuid();
      await pool.query('insert into categorias_documentales (categoria_id, mandante_id, tipo_recurso, nombre, orden) values ($1,$2,$3,$4,$5)', [catId, m.id, 'trabajador', cat.nombre, ordC++]);
      let ordR = 0;
      for (const [nombre, oblig, venc, dias] of cat.reqs) {
        const rid = uuid();
        await pool.query('insert into requisitos_documentales (requisito_id, mandante_id, tipo_recurso, categoria_id, nombre, obligatorio, tiene_vencimiento, dias_alerta, orden) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [rid, m.id, 'trabajador', catId, nombre, oblig, venc, dias, ordR++]);
        reqsByMandante[m.id].push({ rid, nombre, oblig, venc });
      }
    }
  }

  const estados = ['aprobado', 'aprobado', 'en_revision', 'rechazado', 'vencido', 'pendiente'];
  let si = 0;
  for (const a of asig.slice(0, 8)) {
    const reqs = reqsByMandante[a.mid];
    for (let k = 0; k < reqs.length; k++) {
      const req = reqs[k];
      const estado = estados[(si + k) % estados.length];
      if (estado === 'pendiente') continue;
      let venc = 'null';
      if (req.venc) venc = estado === 'vencido' ? "current_date - interval '10 days'" : "current_date + interval '200 days'";
      await pool.query(
        `insert into documentos (recurso_tipo, recurso_id, requisito_id, mandante_id, nombre_archivo, mime, estado, fecha_emision, fecha_vencimiento)
         values ('trabajador', $1, $2, $3, $4, 'application/pdf', $5, current_date - interval '30 days', ${venc})`,
        [a.tid, req.rid, a.mid, `${req.nombre}.pdf`, estado]
      );
    }
    si++;
  }

  console.log('[seed] business data created');
}

async function seedUsers() {
  const { rows: emp } = await pool.query('select empresa_id from empresas_grupo order by created_at limit 1');
  const empresaId = emp[0]?.empresa_id || null;
  const { rows: man } = await pool.query('select mandante_id from mandantes order by created_at limit 1');
  const mandanteId = man[0]?.mandante_id || null;

  const users = [
    { email: 'admin@aptivarl.com', pass: 'Aptiva2025!', nombre: 'Administrador Holding', rol: 'SUPER_ADMIN_HOLDING', empresa_id: null, mandante_id: null },
    { email: 'empresa@aptivarl.com', pass: 'Aptiva2025!', nombre: 'Admin RL Maquinarias', rol: 'ADMIN_EMPRESA', empresa_id: empresaId, mandante_id: null },
    { email: 'revisor@aptivarl.com', pass: 'Aptiva2025!', nombre: 'Revisor Documental', rol: 'REVISOR', empresa_id: null, mandante_id: null },
    { email: 'mandante@aptivarl.com', pass: 'Aptiva2025!', nombre: 'Usuario Minera Sierra Gorda', rol: 'USUARIO_MANDANTE', empresa_id: null, mandante_id: mandanteId },
  ];
  for (const u of users) {
    try {
      const authId = await ensureAuthUser(u.email, u.pass, { nombre: u.nombre, rol: u.rol });
      await pool.query(
        'insert into usuarios_perfiles (auth_user_id, email, nombre, role_codigo, empresa_id, mandante_id) values ($1,$2,$3,$4,$5,$6) on conflict (auth_user_id) do nothing',
        [authId, u.email, u.nombre, u.rol, u.empresa_id, u.mandante_id]
      );
    } catch (e) { console.warn('[seedUsers]', u.email, e.message); }
  }
  console.log('[seed] users created');
}
