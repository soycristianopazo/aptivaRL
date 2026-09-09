import pg from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const { Pool } = pg;
const g = globalThis;

export const pool =
  g.__aptivaPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    ssl: { rejectUnauthorized: false },
  });

if (!g.__aptivaPool) g.__aptivaPool = pool;

export async function query(text, params) {
  return pool.query(text, params);
}

const uuid = () => crypto.randomUUID();

let schemaPromise = null;
export function ensureSchema() {
  if (!schemaPromise) schemaPromise = initSchema().catch((e) => { schemaPromise = null; throw e; });
  return schemaPromise;
}

async function initSchema() {
  await pool.query(`
    create table if not exists companies (
      company_id uuid primary key,
      name text not null,
      rut text,
      created_at timestamptz not null default now()
    );
    create table if not exists users (
      user_id uuid primary key,
      email text unique not null,
      password_hash text not null,
      full_name text not null,
      rut text,
      role text not null default 'worker',
      company_id uuid references companies(company_id) on delete set null,
      created_at timestamptz not null default now()
    );
    create table if not exists courses (
      course_id uuid primary key,
      title text not null,
      description text,
      category text,
      duration_minutes int not null default 30,
      lessons jsonb not null default '[]'::jsonb,
      quiz jsonb not null default '[]'::jsonb,
      pass_score int not null default 70,
      company_id uuid,
      created_at timestamptz not null default now()
    );
    create table if not exists enrollments (
      enrollment_id uuid primary key,
      user_id uuid not null references users(user_id) on delete cascade,
      course_id uuid not null references courses(course_id) on delete cascade,
      status text not null default 'enrolled',
      progress int not null default 0,
      score int,
      completed_at timestamptz,
      created_at timestamptz not null default now(),
      unique(user_id, course_id)
    );
  `);

  // Seed a superadmin if there are no users yet
  const { rows } = await pool.query('select count(*)::int as c from users');
  if (rows[0].c === 0) {
    const companyId = uuid();
    await pool.query('insert into companies (company_id, name, rut) values ($1,$2,$3)', [companyId, 'Aptiva RL Demo', '76.000.000-0']);
    const hash = await bcrypt.hash('Aptiva2025!', 10);
    await pool.query(
      'insert into users (user_id, email, password_hash, full_name, role, company_id) values ($1,$2,$3,$4,$5,$6)',
      [uuid(), 'admin@aptivarl.com', hash, 'Administrador Aptiva', 'superadmin', companyId]
    );

    const sampleCourses = [
      {
        title: 'Inducci\u00f3n de Seguridad Minera',
        description: 'Fundamentos de seguridad para el ingreso a faenas mineras: riesgos, EPP y protocolos.',
        category: 'Seguridad',
        duration_minutes: 45,
        lessons: [
          { title: 'Introducci\u00f3n a la seguridad en faena', content: 'La seguridad es responsabilidad de todos. Conoce las zonas de riesgo, la se\u00f1al\u00e9tica y las v\u00edas de evacuaci\u00f3n antes de iniciar cualquier actividad.' },
          { title: 'Elementos de Protecci\u00f3n Personal (EPP)', content: 'Casco, lentes, protecci\u00f3n auditiva, guantes y calzado de seguridad son obligatorios. Verifica su estado antes de cada turno.' },
          { title: 'Protocolo ante emergencias', content: 'Ante una emergencia mant\u00e9n la calma, da la alarma, dirige a la zona segura y sigue las instrucciones del l\u00edder de emergencia.' },
        ],
        quiz: [
          { question: '\u00bfCu\u00e1l de los siguientes es un EPP obligatorio en faena?', options: ['Casco de seguridad', 'Gorra deportiva', 'Aud\u00edfonos de m\u00fasica'], answer: 0 },
          { question: '\u00bfQu\u00e9 debes hacer primero ante una emergencia?', options: ['Correr sin rumbo', 'Mantener la calma y dar la alarma', 'Ignorar la se\u00f1al'], answer: 1 },
        ],
        pass_score: 70,
      },
      {
        title: 'Trabajo en Altura',
        description: 'Prevenci\u00f3n de ca\u00eddas y uso correcto de arn\u00e9s y sistemas de detenci\u00f3n.',
        category: 'Seguridad',
        duration_minutes: 60,
        lessons: [
          { title: '\u00bfQu\u00e9 es trabajo en altura?', content: 'Se considera trabajo en altura toda tarea realizada a m\u00e1s de 1,8 metros sobre el nivel del piso.' },
          { title: 'Uso del arn\u00e9s de seguridad', content: 'Inspecciona el arn\u00e9s, ajusta correctamente las correas y conecta el mosquet\u00f3n a un punto de anclaje certificado.' },
        ],
        quiz: [
          { question: '\u00bfA partir de qu\u00e9 altura se considera trabajo en altura?', options: ['0,5 m', '1,8 m', '5 m'], answer: 1 },
        ],
        pass_score: 70,
      },
      {
        title: 'Primeros Auxilios B\u00e1sicos',
        description: 'Acciones iniciales de respuesta ante accidentes y lesiones comunes.',
        category: 'Salud',
        duration_minutes: 30,
        lessons: [
          { title: 'Evaluaci\u00f3n inicial', content: 'Eval\u00faa la escena, la seguridad y el estado de conciencia de la persona antes de actuar.' },
          { title: 'Manejo de heridas', content: 'Controla el sangrado con presi\u00f3n directa y protege la herida con material limpio.' },
        ],
        quiz: [
          { question: '\u00bfQu\u00e9 se eval\u00faa primero al asistir a un accidentado?', options: ['La seguridad de la escena', 'El color de su ropa', 'La hora del d\u00eda'], answer: 0 },
        ],
        pass_score: 70,
      },
    ];
    for (const c of sampleCourses) {
      await pool.query(
        'insert into courses (course_id, title, description, category, duration_minutes, lessons, quiz, pass_score, company_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [uuid(), c.title, c.description, c.category, c.duration_minutes, JSON.stringify(c.lessons), JSON.stringify(c.quiz), c.pass_score, companyId]
      );
    }
  }
}

export { uuid };
