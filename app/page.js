'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  GraduationCap, LayoutDashboard, BookOpen, Award, Users, Building2, LogOut,
  Clock, CheckCircle2, PlayCircle, Plus, Trash2, ShieldCheck, HardHat, Printer, X,
} from 'lucide-react';

const HERO = 'https://images.unsplash.com/photo-1516216628859-9bccecab13ca?auto=format&fit=crop&w=1400&q=80';

const roleLabel = { superadmin: 'Super Admin', admin: 'Administrador', worker: 'Trabajador' };
const catColor = (c) => ({ Seguridad: 'bg-red-100 text-red-700', Salud: 'bg-emerald-100 text-emerald-700', General: 'bg-slate-100 text-slate-700' }[c] || 'bg-blue-100 text-blue-700');

export default function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('aptiva_token') : null;
    if (!t) { setBooting(false); return; }
    setToken(t);
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setUser(d.user))
      .catch(() => { localStorage.removeItem('aptiva_token'); setToken(null); })
      .finally(() => setBooting(false));
  }, []);

  const onLogin = (t, u) => { localStorage.setItem('aptiva_token', t); setToken(t); setUser(u); };
  const onLogout = () => { localStorage.removeItem('aptiva_token'); setToken(null); setUser(null); };

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-teal-700">
          <GraduationCap className="h-6 w-6 animate-pulse" />
          <span className="font-medium">Cargando Aptiva RL…</span>
        </div>
      </div>
    );
  }
  if (!token || !user) return <AuthScreen onLogin={onLogin} />;
  return <Dashboard token={token} user={user} onLogout={onLogout} />;
}

/* ------------------------------ AUTH ------------------------------ */
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', full_name: '', rut: '' });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setLoading(true);
    try {
      const url = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      toast.success(mode === 'login' ? 'Sesión iniciada' : 'Cuenta creada');
      onLogin(data.token, data.user);
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <div className="relative hidden lg:block">
        <img src={HERO} alt="Trabajadores en faena" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-teal-900/40" />
        <div className="relative h-full flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-teal-500 flex items-center justify-center"><HardHat className="h-6 w-6" /></div>
            <span className="text-2xl font-bold tracking-tight">Aptiva <span className="text-teal-400">RL</span></span>
          </div>
          <div className="space-y-4 max-w-md">
            <h1 className="text-4xl font-bold leading-tight">Capacitación y certificación de competencias laborales</h1>
            <p className="text-slate-200">Forma, evalúa y certifica a tu fuerza de trabajo con trazabilidad total. Cumplimiento y seguridad en un solo lugar.</p>
            <div className="flex gap-6 pt-2">
              <Stat n="+120" l="Cursos" /><Stat n="98%" l="Cumplimiento" /><Stat n="24/7" l="Acceso" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="h-10 w-10 rounded-xl bg-teal-600 flex items-center justify-center text-white"><HardHat className="h-6 w-6" /></div>
            <span className="text-2xl font-bold">Aptiva <span className="text-teal-600">RL</span></span>
          </div>
          <Card className="border-slate-200 shadow-xl shadow-slate-200/50">
            <CardHeader>
              <CardTitle className="text-2xl">{mode === 'login' ? 'Bienvenido de vuelta' : 'Crear cuenta'}</CardTitle>
              <CardDescription>{mode === 'login' ? 'Ingresa tus credenciales para continuar' : 'Regístrate como trabajador para acceder a tus cursos'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === 'register' && (
                <>
                  <div className="space-y-1.5"><Label>Nombre completo</Label><Input value={form.full_name} onChange={set('full_name')} placeholder="Juan Pérez" /></div>
                  <div className="space-y-1.5"><Label>RUT (opcional)</Label><Input value={form.rut} onChange={set('rut')} placeholder="12.345.678-9" /></div>
                </>
              )}
              <div className="space-y-1.5"><Label>Correo electrónico</Label><Input type="email" value={form.email} onChange={set('email')} placeholder="tu@empresa.cl" /></div>
              <div className="space-y-1.5"><Label>Contraseña</Label><Input type="password" value={form.password} onChange={set('password')} placeholder="••••••••" onKeyDown={(e) => e.key === 'Enter' && submit()} /></div>
              <Button className="w-full bg-teal-600 hover:bg-teal-700" onClick={submit} disabled={loading}>
                {loading ? 'Procesando…' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </Button>
              <p className="text-sm text-center text-slate-500">
                {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
                <button className="text-teal-600 font-medium hover:underline" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
                  {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
                </button>
              </p>
              {mode === 'login' && (
                <div className="rounded-lg bg-teal-50 border border-teal-100 p-3 text-xs text-teal-800">
                  <p className="font-semibold mb-1">Cuenta demo (Super Admin)</p>
                  <p>admin@aptivarl.com · Aptiva2025!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
const Stat = ({ n, l }) => (<div><div className="text-2xl font-bold text-teal-400">{n}</div><div className="text-xs text-slate-300 uppercase tracking-wide">{l}</div></div>);

/* ------------------------------ DASHBOARD ------------------------------ */
function Dashboard({ token, user, onLogout }) {
  const [view, setView] = useState('dashboard');
  const [stats, setStats] = useState({});
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [activeCourse, setActiveCourse] = useState(null);
  const [cert, setCert] = useState(null);

  const admin = user.role === 'admin' || user.role === 'superadmin';
  const api = useCallback(async (path, opts = {}) => {
    const res = await fetch(`/api${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error');
    return data;
  }, [token]);

  const refresh = useCallback(async () => {
    try {
      const [s, c, e] = await Promise.all([api('/stats'), api('/courses'), api('/enrollments')]);
      setStats(s); setCourses(c.courses || []); setEnrollments(e.enrollments || []);
      if (admin) {
        const [us, co] = await Promise.all([api('/users'), api('/companies')]);
        setUsers(us.users || []); setCompanies(co.companies || []);
      }
    } catch (err) { toast.error(err.message); }
  }, [api, admin]);

  useEffect(() => { refresh(); }, [refresh]);

  const enrollmentByCourse = Object.fromEntries(enrollments.map((e) => [e.course_id, e]));

  const nav = [
    { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
    { id: 'courses', label: admin ? 'Cursos' : 'Catálogo', icon: BookOpen },
    { id: 'learning', label: 'Mi aprendizaje', icon: Award },
    ...(admin ? [{ id: 'users', label: 'Usuarios', icon: Users }, { id: 'companies', label: 'Empresas', icon: Building2 }] : []),
  ];

  const openCourse = async (courseId) => {
    try {
      let enr = enrollmentByCourse[courseId];
      if (!enr) { const r = await api('/enrollments', { method: 'POST', body: JSON.stringify({ course_id: courseId }) }); enr = r.enrollment; await refresh(); }
      const { course } = await api(`/courses/${courseId}`);
      setActiveCourse({ course, enrollment: enr });
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="hidden md:flex w-64 flex-col bg-slate-900 text-slate-300 fixed inset-y-0">
        <div className="h-16 flex items-center gap-2 px-6 border-b border-slate-800">
          <div className="h-9 w-9 rounded-lg bg-teal-500 flex items-center justify-center text-white"><HardHat className="h-5 w-5" /></div>
          <span className="text-lg font-bold text-white">Aptiva <span className="text-teal-400">RL</span></span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((n) => (
            <button key={n.id} onClick={() => setView(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${view === n.id ? 'bg-teal-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}>
              <n.icon className="h-4 w-4" />{n.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-9 w-9 rounded-full bg-teal-600 flex items-center justify-center text-white text-sm font-semibold">{(user.full_name || 'U').charAt(0)}</div>
            <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white truncate">{user.full_name}</p><p className="text-xs text-slate-400">{roleLabel[user.role]}</p></div>
            <button onClick={onLogout} className="text-slate-400 hover:text-white"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </aside>

      <div className="flex-1 md:ml-64">
        <header className="md:hidden h-16 bg-slate-900 text-white flex items-center justify-between px-4">
          <span className="font-bold">Aptiva <span className="text-teal-400">RL</span></span>
          <button onClick={onLogout}><LogOut className="h-5 w-5" /></button>
        </header>
        <div className="md:hidden flex overflow-x-auto gap-2 p-3 bg-white border-b">
          {nav.map((n) => (<button key={n.id} onClick={() => setView(n.id)} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm ${view === n.id ? 'bg-teal-600 text-white' : 'bg-slate-100'}`}>{n.label}</button>))}
        </div>

        <main className="p-6 max-w-6xl mx-auto">
          {view === 'dashboard' && <DashboardView stats={stats} courses={courses} enrollments={enrollments} user={user} admin={admin} onOpen={openCourse} onGo={setView} />}
          {view === 'courses' && <CoursesView courses={courses} admin={admin} api={api} refresh={refresh} enrollmentByCourse={enrollmentByCourse} onOpen={openCourse} />}
          {view === 'learning' && <LearningView enrollments={enrollments} onOpen={openCourse} onCert={setCert} />}
          {view === 'users' && admin && <UsersView users={users} companies={companies} api={api} refresh={refresh} />}
          {view === 'companies' && admin && <CompaniesView companies={companies} api={api} refresh={refresh} />}
        </main>
      </div>

      {activeCourse && (
        <CoursePlayer data={activeCourse} api={api} onClose={() => setActiveCourse(null)}
          onCompleted={async (result) => { await refresh(); setActiveCourse(null); if (result.passed) { setCert(result.certData); toast.success('¡Curso aprobado!'); } else { toast.error('No alcanzaste el puntaje mínimo. Intenta de nuevo.'); } }} user={user} />
      )}
      {cert && <CertificateModal cert={cert} user={user} onClose={() => setCert(null)} />}
    </div>
  );
}

/* ------------------------------ VIEWS ------------------------------ */
function SectionTitle({ title, sub, action }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div><h1 className="text-2xl font-bold text-slate-900">{title}</h1>{sub && <p className="text-slate-500 mt-1">{sub}</p>}</div>
      {action}
    </div>
  );
}

function DashboardView({ stats, courses, enrollments, user, admin, onOpen, onGo }) {
  const cards = admin
    ? [
        { label: 'Cursos activos', value: stats.total_courses ?? 0, icon: BookOpen, color: 'text-blue-600 bg-blue-50' },
        { label: 'Usuarios', value: stats.total_users ?? 0, icon: Users, color: 'text-teal-600 bg-teal-50' },
        { label: 'Empresas', value: stats.total_companies ?? 0, icon: Building2, color: 'text-purple-600 bg-purple-50' },
        { label: 'Certificaciones', value: stats.total_completions ?? 0, icon: Award, color: 'text-amber-600 bg-amber-50' },
      ]
    : [
        { label: 'Cursos disponibles', value: stats.total_courses ?? 0, icon: BookOpen, color: 'text-blue-600 bg-blue-50' },
        { label: 'En progreso', value: stats.my_enrolled ?? 0, icon: PlayCircle, color: 'text-amber-600 bg-amber-50' },
        { label: 'Completados', value: stats.my_completed ?? 0, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
        { label: 'Certificados', value: stats.my_completed ?? 0, icon: Award, color: 'text-teal-600 bg-teal-50' },
      ];
  return (
    <div>
      <SectionTitle title={`Hola, ${(user.full_name || '').split(' ')[0]} 👋`} sub="Este es el resumen de tu actividad en Aptiva RL." />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <Card key={c.label} className="border-slate-200">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${c.color}`}><c.icon className="h-6 w-6" /></div>
              <div><div className="text-2xl font-bold text-slate-900">{c.value}</div><div className="text-sm text-slate-500">{c.label}</div></div>
            </CardContent>
          </Card>
        ))}
      </div>
      <SectionTitle title="Cursos destacados" action={<Button variant="outline" onClick={() => onGo('courses')}>Ver todo</Button>} />
      <div className="grid md:grid-cols-3 gap-4">
        {courses.slice(0, 3).map((c) => (
          <Card key={c.course_id} className="border-slate-200 overflow-hidden group">
            <div className="h-2 bg-gradient-to-r from-teal-500 to-blue-500" />
            <CardContent className="p-5">
              <Badge className={`${catColor(c.category)} border-0 mb-3`}>{c.category}</Badge>
              <h3 className="font-semibold text-slate-900 mb-1 line-clamp-2">{c.title}</h3>
              <p className="text-sm text-slate-500 line-clamp-2 mb-4">{c.description}</p>
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{c.duration_minutes} min</span>
                <Button size="sm" variant="ghost" className="text-teal-600" onClick={() => onOpen(c.course_id)}>Comenzar</Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {courses.length === 0 && <p className="text-slate-500">Aún no hay cursos.</p>}
      </div>
    </div>
  );
}

function CoursesView({ courses, admin, api, refresh, enrollmentByCourse, onOpen }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <SectionTitle title={admin ? 'Gestión de cursos' : 'Catálogo de cursos'} sub={admin ? 'Crea y administra el contenido formativo.' : 'Inscríbete y avanza a tu ritmo.'}
        action={admin && <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nuevo curso</Button>} />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((c) => {
          const enr = enrollmentByCourse[c.course_id];
          return (
            <Card key={c.course_id} className="border-slate-200 flex flex-col">
              <div className="h-2 bg-gradient-to-r from-teal-500 to-blue-500" />
              <CardContent className="p-5 flex-1 flex flex-col">
                <div className="flex items-start justify-between mb-2">
                  <Badge className={`${catColor(c.category)} border-0`}>{c.category}</Badge>
                  {admin && <button onClick={async () => { if (confirm('¿Eliminar curso?')) { await api(`/courses/${c.course_id}`, { method: 'DELETE' }); toast.success('Curso eliminado'); refresh(); } }} className="text-slate-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>}
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">{c.title}</h3>
                <p className="text-sm text-slate-500 line-clamp-3 mb-4 flex-1">{c.description}</p>
                <div className="flex items-center gap-3 text-xs text-slate-400 mb-4">
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{c.duration_minutes} min</span>
                  <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{c.lessons_count} lecciones</span>
                  {c.quiz_count > 0 && <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />Evaluación</span>}
                </div>
                {enr?.status === 'completed'
                  ? <Button variant="outline" className="w-full text-emerald-600 border-emerald-200" onClick={() => onOpen(c.course_id)}><CheckCircle2 className="h-4 w-4 mr-1" />Completado</Button>
                  : <Button className="w-full bg-teal-600 hover:bg-teal-700" onClick={() => onOpen(c.course_id)}>{enr ? 'Continuar' : 'Inscribirme'}</Button>}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {open && <CourseFormDialog api={api} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); refresh(); }} />}
    </div>
  );
}

function LearningView({ enrollments, onOpen, onCert }) {
  return (
    <div>
      <SectionTitle title="Mi aprendizaje" sub="Tu progreso y certificaciones." />
      {enrollments.length === 0 && <p className="text-slate-500">Aún no te has inscrito en cursos. Ve al catálogo para comenzar.</p>}
      <div className="space-y-3">
        {enrollments.map((e) => (
          <Card key={e.enrollment_id} className="border-slate-200">
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-slate-900">{e.course_title}</h3>
                  <Badge className={`${catColor(e.category)} border-0`}>{e.category}</Badge>
                </div>
                <Progress value={e.progress} className="h-2 mt-2 max-w-md" />
                <p className="text-xs text-slate-500 mt-1">{e.status === 'completed' ? `Aprobado con ${e.score}%` : e.status === 'in_progress' ? 'En progreso' : 'Inscrito'}</p>
              </div>
              <div className="flex gap-2">
                {e.status === 'completed'
                  ? <Button variant="outline" className="text-teal-600 border-teal-200" onClick={() => onCert({ course_title: e.course_title, completed_at: e.completed_at, score: e.score, enrollment_id: e.enrollment_id })}><Award className="h-4 w-4 mr-1" />Certificado</Button>
                  : <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => onOpen(e.course_id)}><PlayCircle className="h-4 w-4 mr-1" />{e.status === 'in_progress' ? 'Continuar' : 'Comenzar'}</Button>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function UsersView({ users, companies, api, refresh }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ email: '', password: '', full_name: '', rut: '', role: 'worker', company_id: '' });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target?.value ?? e }));
  const save = async () => {
    try { await api('/users', { method: 'POST', body: JSON.stringify(f) }); toast.success('Usuario creado'); setOpen(false); setF({ email: '', password: '', full_name: '', rut: '', role: 'worker', company_id: '' }); refresh(); }
    catch (e) { toast.error(e.message); }
  };
  return (
    <div>
      <SectionTitle title="Usuarios" sub="Administra trabajadores y administradores." action={<Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nuevo usuario</Button>} />
      <Card className="border-slate-200"><CardContent className="p-0">
        <div className="divide-y">
          {users.map((u) => (
            <div key={u.user_id} className="flex items-center gap-4 p-4">
              <div className="h-10 w-10 rounded-full bg-teal-600 text-white flex items-center justify-center font-semibold">{(u.full_name || 'U').charAt(0)}</div>
              <div className="flex-1 min-w-0"><p className="font-medium text-slate-900 truncate">{u.full_name}</p><p className="text-sm text-slate-500 truncate">{u.email}</p></div>
              <div className="hidden sm:block text-sm text-slate-500">{u.company_name || '—'}</div>
              <Badge variant="secondary">{roleLabel[u.role]}</Badge>
            </div>
          ))}
        </div>
      </CardContent></Card>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent>
        <DialogHeader><DialogTitle>Nuevo usuario</DialogTitle><DialogDescription>Crea una cuenta y asigna su rol.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Nombre completo</Label><Input value={f.full_name} onChange={set('full_name')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Correo</Label><Input value={f.email} onChange={set('email')} /></div>
            <div className="space-y-1.5"><Label>RUT</Label><Input value={f.rut} onChange={set('rut')} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Contraseña</Label><Input type="password" value={f.password} onChange={set('password')} /></div>
            <div className="space-y-1.5"><Label>Rol</Label>
              <Select value={f.role} onValueChange={set('role')}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="worker">Trabajador</SelectItem><SelectItem value="admin">Administrador</SelectItem><SelectItem value="superadmin">Super Admin</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Empresa</Label>
            <Select value={f.company_id} onValueChange={set('company_id')}><SelectTrigger><SelectValue placeholder="Selecciona empresa" /></SelectTrigger>
              <SelectContent>{companies.map((c) => <SelectItem key={c.company_id} value={c.company_id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button className="bg-teal-600 hover:bg-teal-700" onClick={save}>Crear</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}

function CompaniesView({ companies, api, refresh }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', rut: '' });
  const save = async () => { try { await api('/companies', { method: 'POST', body: JSON.stringify(f) }); toast.success('Empresa creada'); setOpen(false); setF({ name: '', rut: '' }); refresh(); } catch (e) { toast.error(e.message); } };
  return (
    <div>
      <SectionTitle title="Empresas" sub="Organizaciones registradas en la plataforma." action={<Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nueva empresa</Button>} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {companies.map((c) => (
          <Card key={c.company_id} className="border-slate-200"><CardContent className="p-5">
            <div className="h-11 w-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3"><Building2 className="h-6 w-6" /></div>
            <h3 className="font-semibold text-slate-900">{c.name}</h3>
            <p className="text-sm text-slate-500">{c.rut || 'Sin RUT'}</p>
            <p className="text-xs text-slate-400 mt-2">{c.users_count} usuarios</p>
          </CardContent></Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent>
        <DialogHeader><DialogTitle>Nueva empresa</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Nombre</Label><Input value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>RUT</Label><Input value={f.rut} onChange={(e) => setF((s) => ({ ...s, rut: e.target.value }))} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button className="bg-teal-600 hover:bg-teal-700" onClick={save}>Crear</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}

/* ------------------------------ COURSE FORM ------------------------------ */
function CourseFormDialog({ api, onClose, onSaved }) {
  const [f, setF] = useState({ title: '', description: '', category: 'Seguridad', duration_minutes: 30, pass_score: 70, lessonsText: '', quizText: '' });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target?.value ?? e }));
  const save = async () => {
    try {
      const lessons = f.lessonsText.split('\n\n').map((b) => { const [title, ...rest] = b.split('\n'); return { title: (title || '').trim(), content: rest.join('\n').trim() }; }).filter((l) => l.title);
      const quiz = f.quizText.split('\n').map((line) => { const parts = line.split('|').map((x) => x.trim()); if (parts.length < 3) return null; const q = parts[0]; const answerIdx = Number(parts[parts.length - 1]); const options = parts.slice(1, -1); return { question: q, options, answer: Number.isFinite(answerIdx) ? answerIdx : 0 }; }).filter(Boolean);
      await api('/courses', { method: 'POST', body: JSON.stringify({ ...f, duration_minutes: Number(f.duration_minutes), pass_score: Number(f.pass_score), lessons, quiz }) });
      toast.success('Curso creado'); onSaved();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Nuevo curso</DialogTitle><DialogDescription>Define el contenido y la evaluación.</DialogDescription></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5"><Label>Título</Label><Input value={f.title} onChange={set('title')} /></div>
        <div className="space-y-1.5"><Label>Descripción</Label><Textarea value={f.description} onChange={set('description')} rows={2} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>Categoría</Label>
            <Select value={f.category} onValueChange={set('category')}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Seguridad">Seguridad</SelectItem><SelectItem value="Salud">Salud</SelectItem><SelectItem value="General">General</SelectItem></SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label>Duración (min)</Label><Input type="number" value={f.duration_minutes} onChange={set('duration_minutes')} /></div>
          <div className="space-y-1.5"><Label>Puntaje mín. (%)</Label><Input type="number" value={f.pass_score} onChange={set('pass_score')} /></div>
        </div>
        <div className="space-y-1.5">
          <Label>Lecciones</Label>
          <Textarea value={f.lessonsText} onChange={set('lessonsText')} rows={5} placeholder={'Título de la lección\nContenido de la lección…\n\nOtra lección\nSu contenido…'} />
          <p className="text-xs text-slate-400">Separa cada lección con una línea en blanco. Primera línea = título.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Preguntas de evaluación (opcional)</Label>
          <Textarea value={f.quizText} onChange={set('quizText')} rows={3} placeholder={'¿Pregunta? | Opción A | Opción B | Opción C | 0'} />
          <p className="text-xs text-slate-400">Formato por línea: pregunta | opción1 | opción2 | … | índice_respuesta_correcta (empezando en 0).</p>
        </div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button className="bg-teal-600 hover:bg-teal-700" onClick={save}>Guardar curso</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}

/* ------------------------------ COURSE PLAYER ------------------------------ */
function CoursePlayer({ data, api, onClose, onCompleted, user }) {
  const { course, enrollment } = data;
  const lessons = Array.isArray(course.lessons) ? course.lessons : [];
  const quiz = Array.isArray(course.quiz) ? course.quiz : [];
  const [step, setStep] = useState(0);
  const totalSteps = lessons.length + (quiz.length ? 1 : 0);
  const inQuiz = quiz.length > 0 && step >= lessons.length;
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const finishNoQuiz = async () => {
    setSubmitting(true);
    try {
      const r = await api(`/enrollments/${enrollment.enrollment_id}/complete`, { method: 'POST', body: JSON.stringify({ score: 100 }) });
      onCompleted({ passed: r.passed, certData: { course_title: course.title, completed_at: r.enrollment.completed_at, score: r.enrollment.score, enrollment_id: enrollment.enrollment_id } });
    } catch (e) { toast.error(e.message); } finally { setSubmitting(false); }
  };
  const submitQuiz = async () => {
    setSubmitting(true);
    try {
      let correct = 0; quiz.forEach((q, i) => { if (answers[i] === q.answer) correct++; });
      const score = Math.round((correct / quiz.length) * 100);
      const r = await api(`/enrollments/${enrollment.enrollment_id}/complete`, { method: 'POST', body: JSON.stringify({ score }) });
      onCompleted({ passed: r.passed, certData: { course_title: course.title, completed_at: r.enrollment.completed_at, score, enrollment_id: enrollment.enrollment_id } });
    } catch (e) { toast.error(e.message); } finally { setSubmitting(false); }
  };

  const progressPct = Math.round(((step + 1) / totalSteps) * 100);

  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="pr-6">{course.title}</DialogTitle>
        <Progress value={progressPct} className="h-1.5 mt-2" />
      </DialogHeader>

      {!inQuiz && lessons[step] && (
        <div className="py-2">
          <div className="flex items-center gap-2 text-sm text-teal-600 font-medium mb-2"><BookOpen className="h-4 w-4" />Lección {step + 1} de {lessons.length}</div>
          <h3 className="text-xl font-bold text-slate-900 mb-3">{lessons[step].title}</h3>
          <p className="text-slate-600 leading-relaxed whitespace-pre-line">{lessons[step].content}</p>
        </div>
      )}

      {inQuiz && (
        <div className="py-2 space-y-5">
          <div className="flex items-center gap-2 text-sm text-amber-600 font-medium"><ShieldCheck className="h-4 w-4" />Evaluación · puntaje mínimo {course.pass_score}%</div>
          {quiz.map((q, i) => (
            <div key={i} className="space-y-2">
              <p className="font-medium text-slate-900">{i + 1}. {q.question}</p>
              <div className="space-y-1.5">
                {q.options.map((opt, oi) => (
                  <button key={oi} onClick={() => setAnswers((a) => ({ ...a, [i]: oi }))}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition ${answers[i] === oi ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-slate-200 hover:bg-slate-50'}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <DialogFooter className="flex-row justify-between sm:justify-between">
        <Button variant="outline" onClick={() => (step > 0 ? setStep(step - 1) : onClose())}>{step > 0 ? 'Anterior' : 'Cerrar'}</Button>
        {inQuiz
          ? <Button className="bg-teal-600 hover:bg-teal-700" disabled={submitting || Object.keys(answers).length < quiz.length} onClick={submitQuiz}>{submitting ? 'Enviando…' : 'Finalizar evaluación'}</Button>
          : step < totalSteps - 1
            ? <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setStep(step + 1)}>Siguiente</Button>
            : <Button className="bg-teal-600 hover:bg-teal-700" disabled={submitting} onClick={finishNoQuiz}>{submitting ? 'Guardando…' : 'Completar curso'}</Button>}
      </DialogFooter>
    </DialogContent></Dialog>
  );
}

/* ------------------------------ CERTIFICATE ------------------------------ */
function CertificateModal({ cert, user, onClose }) {
  const date = cert.completed_at ? new Date(cert.completed_at) : new Date();
  const folio = (cert.enrollment_id || '').slice(0, 8).toUpperCase();
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4 print:bg-white print:p-0" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden print:rounded-none print:max-w-none" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-2 p-3 border-b print:hidden">
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Imprimir</Button>
          <Button size="sm" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div id="certificate" className="p-10 text-center relative">
          <div className="absolute inset-4 border-4 border-teal-600/20 rounded-xl pointer-events-none" />
          <div className="absolute inset-6 border border-teal-600/20 rounded-lg pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-11 w-11 rounded-xl bg-teal-600 flex items-center justify-center text-white"><HardHat className="h-6 w-6" /></div>
              <span className="text-2xl font-bold text-slate-900">Aptiva <span className="text-teal-600">RL</span></span>
            </div>
            <p className="uppercase tracking-[0.3em] text-xs text-slate-400 mb-6">Certificado de aprobación</p>
            <p className="text-slate-500">Se certifica que</p>
            <h2 className="text-3xl font-bold text-slate-900 my-2">{user.full_name}</h2>
            {user.rut && <p className="text-slate-500 text-sm mb-4">RUT {user.rut}</p>}
            <p className="text-slate-500">ha aprobado satisfactoriamente el curso</p>
            <h3 className="text-xl font-semibold text-teal-700 mt-2 mb-6">“{cert.course_title}”</h3>
            <div className="flex items-center justify-center gap-10 mt-8 text-sm">
              <div><p className="font-semibold text-slate-900">{cert.score}%</p><p className="text-slate-400 text-xs uppercase tracking-wide">Puntaje</p></div>
              <div><p className="font-semibold text-slate-900">{date.toLocaleDateString('es-CL')}</p><p className="text-slate-400 text-xs uppercase tracking-wide">Fecha</p></div>
              <div><p className="font-semibold text-slate-900">N° {folio}</p><p className="text-slate-400 text-xs uppercase tracking-wide">Folio</p></div>
            </div>
            <div className="flex items-center justify-center gap-2 mt-8 text-teal-600"><Award className="h-5 w-5" /><span className="text-sm font-medium">Certificación válida · Aptiva RL</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
