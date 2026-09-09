import { NextResponse } from 'next/server';
import { query, ensureSchema, uuid } from '@/lib/db';
import { hashPassword, verifyPassword, signToken, getAuth } from '@/lib/auth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

async function getUser(request) {
  const a = getAuth(request);
  if (!a) return null;
  const r = await query(
    'select user_id, email, full_name, role, company_id, rut from users where user_id=$1',
    [a.sub]
  );
  return r.rows[0] || null;
}
const isAdmin = (u) => u && (u.role === 'admin' || u.role === 'superadmin');

export async function GET(request, { params }) {
  try {
    await ensureSchema();
    const p = (await params)?.path || [];
    if (p.length === 0 || p[0] === 'health') return json({ ok: true, service: 'aptiva-rl' });

    if (p[0] === 'auth' && p[1] === 'me') {
      const u = await getUser(request);
      if (!u) return json({ error: 'No autorizado' }, 401);
      return json({ user: u });
    }

    const u = await getUser(request);
    if (!u) return json({ error: 'No autorizado' }, 401);

    if (p[0] === 'stats') {
      const courses = (await query('select count(*)::int c from courses')).rows[0].c;
      const my = (await query('select status, count(*)::int c from enrollments where user_id=$1 group by status', [u.user_id])).rows;
      const byStatus = { enrolled: 0, in_progress: 0, completed: 0 };
      my.forEach((r) => { byStatus[r.status] = r.c; });
      const out = {
        total_courses: courses,
        my_enrolled: (byStatus.enrolled || 0) + (byStatus.in_progress || 0),
        my_completed: byStatus.completed || 0,
        my_total: my.reduce((a, r) => a + r.c, 0),
      };
      if (isAdmin(u)) {
        out.total_users = (await query('select count(*)::int c from users')).rows[0].c;
        out.total_companies = (await query('select count(*)::int c from companies')).rows[0].c;
        out.total_completions = (await query("select count(*)::int c from enrollments where status='completed'")).rows[0].c;
      }
      return json(out);
    }

    if (p[0] === 'companies') {
      const r = await query('select c.*, (select count(*)::int from users u where u.company_id=c.company_id) as users_count from companies c order by c.created_at desc');
      return json({ companies: r.rows });
    }

    if (p[0] === 'users') {
      if (!isAdmin(u)) return json({ error: 'No autorizado' }, 403);
      const r = await query('select u.user_id, u.email, u.full_name, u.rut, u.role, u.company_id, u.created_at, c.name as company_name from users u left join companies c on c.company_id=u.company_id order by u.created_at desc');
      return json({ users: r.rows });
    }

    if (p[0] === 'courses') {
      if (p[1]) {
        const r = await query('select * from courses where course_id=$1', [p[1]]);
        if (!r.rows[0]) return json({ error: 'Curso no encontrado' }, 404);
        return json({ course: r.rows[0] });
      }
      const r = await query('select course_id, title, description, category, duration_minutes, pass_score, jsonb_array_length(lessons) as lessons_count, jsonb_array_length(quiz) as quiz_count, created_at from courses order by created_at desc');
      return json({ courses: r.rows });
    }

    if (p[0] === 'enrollments') {
      const { searchParams } = new URL(request.url);
      const all = searchParams.get('all') === '1' && isAdmin(u);
      const base = `select e.enrollment_id, e.user_id, e.course_id, e.status, e.progress, e.score, e.completed_at, e.created_at,
        c.title as course_title, c.category, c.duration_minutes, c.pass_score,
        us.full_name as user_name, us.email as user_email
        from enrollments e
        join courses c on c.course_id=e.course_id
        join users us on us.user_id=e.user_id`;
      const r = all
        ? await query(base + ' order by e.created_at desc')
        : await query(base + ' where e.user_id=$1 order by e.created_at desc', [u.user_id]);
      return json({ enrollments: r.rows });
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
    const body = await request.json().catch(() => ({}));

    if (p[0] === 'auth' && p[1] === 'register') {
      const { email, password, full_name, rut } = body;
      if (!email || !password || !full_name) return json({ error: 'Faltan campos obligatorios' }, 400);
      const exists = await query('select 1 from users where email=$1', [email.toLowerCase()]);
      if (exists.rows.length) return json({ error: 'El correo ya est\u00e1 registrado' }, 409);
      const hash = await hashPassword(password);
      const id = uuid();
      await query('insert into users (user_id, email, password_hash, full_name, rut, role) values ($1,$2,$3,$4,$5,$6)', [id, email.toLowerCase(), hash, full_name, rut || null, 'worker']);
      const u = (await query('select user_id, email, full_name, role, company_id, rut from users where user_id=$1', [id])).rows[0];
      return json({ token: signToken(u), user: u }, 201);
    }

    if (p[0] === 'auth' && p[1] === 'login') {
      const { email, password } = body;
      const r = await query('select * from users where email=$1', [(email || '').toLowerCase()]);
      const u = r.rows[0];
      if (!u || !(await verifyPassword(password || '', u.password_hash))) return json({ error: 'Credenciales inv\u00e1lidas' }, 401);
      const safe = { user_id: u.user_id, email: u.email, full_name: u.full_name, role: u.role, company_id: u.company_id, rut: u.rut };
      return json({ token: signToken(safe), user: safe });
    }

    const u = await getUser(request);
    if (!u) return json({ error: 'No autorizado' }, 401);

    if (p[0] === 'companies') {
      if (!isAdmin(u)) return json({ error: 'No autorizado' }, 403);
      const { name, rut } = body;
      if (!name) return json({ error: 'Nombre requerido' }, 400);
      const id = uuid();
      await query('insert into companies (company_id, name, rut) values ($1,$2,$3)', [id, name, rut || null]);
      return json({ company: (await query('select * from companies where company_id=$1', [id])).rows[0] }, 201);
    }

    if (p[0] === 'users') {
      if (!isAdmin(u)) return json({ error: 'No autorizado' }, 403);
      const { email, password, full_name, rut, role, company_id } = body;
      if (!email || !password || !full_name) return json({ error: 'Faltan campos obligatorios' }, 400);
      const exists = await query('select 1 from users where email=$1', [email.toLowerCase()]);
      if (exists.rows.length) return json({ error: 'El correo ya est\u00e1 registrado' }, 409);
      const hash = await hashPassword(password);
      const id = uuid();
      const finalRole = ['worker', 'admin', 'superadmin'].includes(role) ? role : 'worker';
      await query('insert into users (user_id, email, password_hash, full_name, rut, role, company_id) values ($1,$2,$3,$4,$5,$6,$7)', [id, email.toLowerCase(), hash, full_name, rut || null, finalRole, company_id || u.company_id || null]);
      const nu = (await query('select user_id, email, full_name, rut, role, company_id from users where user_id=$1', [id])).rows[0];
      return json({ user: nu }, 201);
    }

    if (p[0] === 'courses') {
      if (!isAdmin(u)) return json({ error: 'No autorizado' }, 403);
      const { title, description, category, duration_minutes, lessons, quiz, pass_score } = body;
      if (!title) return json({ error: 'T\u00edtulo requerido' }, 400);
      const id = uuid();
      await query('insert into courses (course_id, title, description, category, duration_minutes, lessons, quiz, pass_score, company_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id, title, description || '', category || 'General', duration_minutes || 30, JSON.stringify(lessons || []), JSON.stringify(quiz || []), pass_score || 70, u.company_id || null]);
      return json({ course: (await query('select * from courses where course_id=$1', [id])).rows[0] }, 201);
    }

    if (p[0] === 'enrollments' && !p[1]) {
      const { course_id, user_id } = body;
      if (!course_id) return json({ error: 'course_id requerido' }, 400);
      const targetUser = isAdmin(u) && user_id ? user_id : u.user_id;
      const existing = await query('select * from enrollments where user_id=$1 and course_id=$2', [targetUser, course_id]);
      if (existing.rows.length) return json({ enrollment: existing.rows[0] });
      const id = uuid();
      await query('insert into enrollments (enrollment_id, user_id, course_id, status, progress) values ($1,$2,$3,$4,$5)', [id, targetUser, course_id, 'enrolled', 0]);
      return json({ enrollment: (await query('select * from enrollments where enrollment_id=$1', [id])).rows[0] }, 201);
    }

    if (p[0] === 'enrollments' && p[1] && p[2] === 'complete') {
      const enr = (await query('select * from enrollments where enrollment_id=$1', [p[1]])).rows[0];
      if (!enr) return json({ error: 'Inscripci\u00f3n no encontrada' }, 404);
      if (enr.user_id !== u.user_id && !isAdmin(u)) return json({ error: 'No autorizado' }, 403);
      const score = Number.isFinite(body.score) ? Math.round(body.score) : 100;
      const course = (await query('select pass_score from courses where course_id=$1', [enr.course_id])).rows[0];
      const passed = score >= (course?.pass_score || 70);
      await query('update enrollments set status=$1, progress=$2, score=$3, completed_at=$4 where enrollment_id=$5', [passed ? 'completed' : 'in_progress', passed ? 100 : Math.max(enr.progress, 50), score, passed ? new Date() : null, p[1]]);
      return json({ enrollment: (await query('select * from enrollments where enrollment_id=$1', [p[1]])).rows[0], passed });
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
    const u = await getUser(request);
    if (!u) return json({ error: 'No autorizado' }, 401);
    const body = await request.json().catch(() => ({}));

    if (p[0] === 'courses' && p[1]) {
      if (!isAdmin(u)) return json({ error: 'No autorizado' }, 403);
      const { title, description, category, duration_minutes, lessons, quiz, pass_score } = body;
      await query('update courses set title=coalesce($1,title), description=coalesce($2,description), category=coalesce($3,category), duration_minutes=coalesce($4,duration_minutes), lessons=coalesce($5,lessons), quiz=coalesce($6,quiz), pass_score=coalesce($7,pass_score) where course_id=$8', [title ?? null, description ?? null, category ?? null, duration_minutes ?? null, lessons ? JSON.stringify(lessons) : null, quiz ? JSON.stringify(quiz) : null, pass_score ?? null, p[1]]);
      return json({ course: (await query('select * from courses where course_id=$1', [p[1]])).rows[0] });
    }
    return json({ error: 'No encontrado' }, 404);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function DELETE(request, { params }) {
  try {
    await ensureSchema();
    const p = (await params)?.path || [];
    const u = await getUser(request);
    if (!u) return json({ error: 'No autorizado' }, 401);
    if (!isAdmin(u)) return json({ error: 'No autorizado' }, 403);

    if (p[0] === 'courses' && p[1]) {
      await query('delete from courses where course_id=$1', [p[1]]);
      return json({ ok: true });
    }
    if (p[0] === 'users' && p[1]) {
      await query('delete from users where user_id=$1', [p[1]]);
      return json({ ok: true });
    }
    return json({ error: 'No encontrado' }, 404);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
