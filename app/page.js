'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  LayoutDashboard, Building2, FileSignature, Users, Truck, Wrench, ShieldCheck, FileClock,
  CalendarClock, Building, UserCog, History, LogOut, Search, Plus, ChevronRight, Upload,
  CheckCircle2, XCircle, AlertTriangle, Clock, Menu,
} from 'lucide-react';

const LOGO = '/logo-aptiva.png';
const YEAR = new Date().getFullYear();
const API = '/api';

const roleLabel = { SUPER_ADMIN_HOLDING: 'Super Admin Holding', ADMIN_EMPRESA: 'Admin Empresa', USUARIO_MANDANTE: 'Usuario Mandante', REVISOR: 'Revisor Documental' };

const semaforo = {
  ACREDITADO: { c: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Acreditado' },
  EN_REVISION: { c: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500', label: 'En revisión' },
  BLOQUEADO: { c: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500', label: 'Bloqueado' },
};
const docEstado = {
  aprobado: 'bg-emerald-100 text-emerald-700', en_revision: 'bg-blue-100 text-blue-700', rechazado: 'bg-red-100 text-red-700',
  vencido: 'bg-red-100 text-red-700', pendiente: 'bg-slate-100 text-slate-600', faltante: 'bg-slate-100 text-slate-500',
};

export default function App() {
  const [token, setToken] = useState(null);
  const [profile, setProfile] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('aptiva_token');
    if (!t) { setBooting(false); return; }
    setToken(t);
    fetch(`${API}/me`, { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setProfile(d.profile))
      .catch(() => localStorage.removeItem('aptiva_token'))
      .finally(() => setBooting(false));
  }, []);

  const onLogin = (t, p) => { localStorage.setItem('aptiva_token', t); setToken(t); setProfile(p); };
  const onLogout = () => { localStorage.removeItem('aptiva_token'); setToken(null); setProfile(null); };

  if (booting) return <div className="min-h-screen flex items-center justify-center bg-slate-100"><img src={LOGO} alt="Aptiva" className="h-10 animate-pulse" /></div>;
  if (!token || !profile) return <Login onLogin={onLogin} />;
  return <Shell token={token} profile={profile} onLogout={onLogout} />;
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      toast.success('Sesión iniciada');
      onLogin(d.token, d.profile);
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen grid lg:grid-cols-5 bg-white">
      <div className="lg:col-span-3 relative hidden lg:flex flex-col justify-between p-12 bg-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, #2563eb55, transparent 40%), radial-gradient(circle at 80% 60%, #1e40af55, transparent 45%)' }} />
        <div className="relative bg-white rounded-xl px-5 py-3 w-fit shadow-lg"><img src={LOGO} alt="Aptiva" className="h-9" /></div>
        <div className="relative space-y-4 max-w-lg">
          <h1 className="text-4xl font-bold leading-tight">Gestión documental y acreditación de recursos</h1>
          <p className="text-slate-300">Plataforma corporativa multiempresa del <strong>Holding Río Loa</strong>. Controla en tiempo real qué recursos están acreditados para operar en cada mandante y contrato.</p>
          <div className="flex gap-8 pt-4">
            <div><div className="text-3xl font-bold text-blue-400">Multi</div><div className="text-sm text-slate-400">Empresa · Mandante · Contrato</div></div>
            <div><div className="text-3xl font-bold text-blue-400">RLS</div><div className="text-sm text-slate-400">Seguridad por rol</div></div>
          </div>
        </div>
        <div className="relative text-xs text-slate-400">© DoSoft {YEAR}</div>
      </div>
      <div className="lg:col-span-2 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <img src={LOGO} alt="Aptiva" className="h-10 mb-8 lg:hidden" />
          <h2 className="text-2xl font-bold text-slate-900">Iniciar sesión</h2>
          <p className="text-slate-500 mb-6 text-sm">Accede con tu cuenta corporativa</p>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Correo</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@aptivarl.com" /></div>
            <div className="space-y-1.5"><Label>Contraseña</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === 'Enter' && submit()} /></div>
            <Button className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading} onClick={submit}>{loading ? 'Ingresando…' : 'Ingresar'}</Button>
          </div>
          <div className="mt-6 rounded-lg bg-slate-50 border p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-700">Cuentas demo (contraseña: Aptiva2025!)</p>
            <p>admin@aptivarl.com · Super Admin</p>
            <p>empresa@aptivarl.com · Admin Empresa</p>
            <p>revisor@aptivarl.com · Revisor · mandante@aptivarl.com · Mandante</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const NAV = [
  { group: '', items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  { group: 'Operación', items: [{ id: 'mandantes', label: 'Mandantes', icon: Building2 }, { id: 'contratos', label: 'Contratos', icon: FileSignature }] },
  { group: 'Recursos', items: [{ id: 'trabajadores', label: 'Trabajadores', icon: Users }, { id: 'vehiculos', label: 'Vehículos', icon: Truck }, { id: 'equipos', label: 'Equipos', icon: Wrench }] },
  { group: 'Acreditación', items: [{ id: 'revision', label: 'Pendientes de Revisión', icon: FileClock }, { id: 'vencimientos', label: 'Vencimientos', icon: CalendarClock }] },
  { group: 'Administración', items: [{ id: 'empresas', label: 'Empresas', icon: Building }, { id: 'usuarios', label: 'Usuarios', icon: UserCog }, { id: 'auditoria', label: 'Auditoría', icon: History }] },
];

function Shell({ token, profile, onLogout }) {
  const [view, setView] = useState('dashboard');
  const [detail, setDetail] = useState(null); // {type,id}
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const api = useCallback(async (path, opts = {}) => {
    const isForm = opts.body instanceof FormData;
    const res = await fetch(`${API}${path}`, { ...opts, headers: { ...(isForm ? {} : { 'Content-Type': 'application/json' }), Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error');
    return data;
  }, [token]);

  const go = (v) => { setDetail(null); setView(v); setSidebarOpen(false); };
  const openDetail = (type, id) => setDetail({ type, id });

  const isSuper = profile.role_codigo === 'SUPER_ADMIN_HOLDING';
  const canManage = ['SUPER_ADMIN_HOLDING', 'ADMIN_EMPRESA'].includes(profile.role_codigo);
  const ctx = { api, profile, isSuper, canManage, openDetail, go };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Sidebar */}
      <aside className={`fixed z-40 inset-y-0 left-0 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center px-4 bg-white border-b border-slate-200">
          <img src={LOGO} alt="Aptiva RL" className="h-8" />
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {NAV.map((sec, i) => (
            <div key={i}>
              {sec.group && <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{sec.group}</p>}
              <div className="space-y-0.5">
                {sec.items.map((it) => (
                  <button key={it.id} onClick={() => go(it.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${view === it.id && !detail ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}>
                    <it.icon className="h-4 w-4 shrink-0" />{it.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-800 text-[10px] text-slate-500">© DoSoft {YEAR}</div>
      </aside>

      {/* Main */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}><Menu className="h-5 w-5" /></button>
            <div className="text-sm text-slate-400 flex items-center gap-1">
              <span className="text-slate-600 font-medium capitalize">{view}</span>
              {detail && <><ChevronRight className="h-4 w-4" /><span className="text-slate-600">Detalle</span></>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block"><p className="text-sm font-medium text-slate-800">{profile.nombre}</p><p className="text-xs text-slate-400">{roleLabel[profile.role_codigo]}</p></div>
            <div className="h-9 w-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">{profile.nombre?.charAt(0)}</div>
            <button onClick={onLogout} className="text-slate-400 hover:text-red-500"><LogOut className="h-5 w-5" /></button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          {detail?.type === 'mandante' && <MandanteDetail {...ctx} id={detail.id} onBack={() => setDetail(null)} />}
          {detail?.type === 'contrato' && <ContratoDetail {...ctx} id={detail.id} onBack={() => setDetail(null)} />}
          {detail?.type === 'trabajador' && <TrabajadorDetail {...ctx} id={detail.id} onBack={() => setDetail(null)} />}
          {!detail && view === 'dashboard' && <Dashboard {...ctx} />}
          {!detail && view === 'mandantes' && <Mandantes {...ctx} />}
          {!detail && view === 'contratos' && <Contratos {...ctx} />}
          {!detail && view === 'trabajadores' && <Trabajadores {...ctx} />}
          {!detail && view === 'vehiculos' && <SimpleResource {...ctx} kind="vehiculos" />}
          {!detail && view === 'equipos' && <SimpleResource {...ctx} kind="equipos" />}
          {!detail && view === 'revision' && <Revision {...ctx} />}
          {!detail && view === 'vencimientos' && <Vencimientos {...ctx} />}
          {!detail && view === 'empresas' && <Empresas {...ctx} />}
          {!detail && view === 'usuarios' && <Usuarios {...ctx} />}
          {!detail && view === 'auditoria' && <Auditoria {...ctx} />}
        </main>

        <footer className="border-t bg-white px-6 py-3 flex items-center justify-center gap-2 text-xs text-slate-400">
          <span>©DoSoft {YEAR}</span><img src={LOGO} alt="Aptiva" className="h-4 opacity-60" />
        </footer>
      </div>
      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />}
    </div>
  );
}

/* ------------ shared UI ------------ */
function PageHead({ title, sub, action }) {
  return <div className="flex items-end justify-between mb-5 gap-4 flex-wrap"><div><h1 className="text-xl font-bold text-slate-900">{title}</h1>{sub && <p className="text-sm text-slate-500">{sub}</p>}</div>{action}</div>;
}
function Kpi({ label, value, icon: Icon, color }) {
  return <Card><CardContent className="p-4 flex items-center gap-3"><div className={`h-11 w-11 rounded-lg flex items-center justify-center ${color}`}><Icon className="h-5 w-5" /></div><div><div className="text-2xl font-bold text-slate-900">{value ?? 0}</div><div className="text-xs text-slate-500">{label}</div></div></CardContent></Card>;
}
function SemBadge({ estado }) { const s = semaforo[estado] || semaforo.EN_REVISION; return <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${s.c}`}><span className={`h-2 w-2 rounded-full ${s.dot}`} />{s.label}</span>; }
function useData(api, path, dep = []) {
  const [data, setData] = useState(null);
  const reload = useCallback(() => { api(path).then(setData).catch((e) => toast.error(e.message)); }, [api, path]);
  useEffect(() => { reload(); }, dep); // eslint-disable-line
  return [data, reload];
}
function Table({ columns, rows, onRow, empty = 'Sin registros' }) {
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500"><tr>{columns.map((c) => <th key={c.key} className="text-left font-medium px-4 py-2.5 whitespace-nowrap">{c.label}</th>)}</tr></thead>
          <tbody className="divide-y">
            {(rows || []).map((r, i) => (
              <tr key={i} className={`hover:bg-slate-50 ${onRow ? 'cursor-pointer' : ''}`} onClick={() => onRow && onRow(r)}>
                {columns.map((c) => <td key={c.key} className="px-4 py-2.5 whitespace-nowrap">{c.render ? c.render(r) : r[c.key]}</td>)}
              </tr>
            ))}
            {rows && rows.length === 0 && <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400">{empty}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------ Dashboard ------------ */
function Dashboard({ api }) {
  const [data] = useData(api, '/dashboard');
  const s = data?.stats || {};
  const totalAcr = (s.trabajadores_acreditados || 0) + (s.trabajadores_bloqueados || 0) + (s.trabajadores_revision || 0) || 1;
  return (
    <div>
      <PageHead title="Dashboard ejecutivo" sub="Estado en tiempo real del Holding Río Loa" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Kpi label="Mandantes activos" value={s.mandantes} icon={Building2} color="bg-blue-50 text-blue-600" />
        <Kpi label="Contratos vigentes" value={s.contratos_vigentes} icon={FileSignature} color="bg-indigo-50 text-indigo-600" />
        <Kpi label="Trabajadores" value={s.trabajadores} icon={Users} color="bg-slate-100 text-slate-600" />
        <Kpi label="Acreditados" value={s.trabajadores_acreditados} icon={CheckCircle2} color="bg-emerald-50 text-emerald-600" />
        <Kpi label="Bloqueados" value={s.trabajadores_bloqueados} icon={XCircle} color="bg-red-50 text-red-600" />
        <Kpi label="Docs. por revisar" value={s.docs_pendientes} icon={FileClock} color="bg-amber-50 text-amber-600" />
        <Kpi label="Docs. por vencer (30d)" value={s.docs_por_vencer} icon={CalendarClock} color="bg-orange-50 text-orange-600" />
        <Kpi label="Docs. vencidos" value={s.docs_vencidos} icon={AlertTriangle} color="bg-red-50 text-red-600" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle className="text-base">Estado de acreditación</CardTitle><CardDescription>Distribución de trabajadores</CardDescription></CardHeader><CardContent className="space-y-3">
          {[['ACREDITADO', s.trabajadores_acreditados], ['EN_REVISION', s.trabajadores_revision], ['BLOQUEADO', s.trabajadores_bloqueados]].map(([k, v]) => (
            <div key={k}><div className="flex justify-between text-sm mb-1"><SemBadge estado={k} /><span className="font-medium">{v || 0}</span></div><Progress value={((v || 0) / totalAcr) * 100} className="h-2" /></div>
          ))}
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Acreditación por mandante</CardTitle></CardHeader><CardContent className="space-y-3">
          {Object.entries(data?.acreditacion_por_mandante || {}).map(([m, v]) => (
            <div key={m}><p className="text-sm font-medium text-slate-700 mb-1">{m}</p><div className="flex gap-1 h-3 rounded overflow-hidden">
              <div className="bg-emerald-500" style={{ width: `${(v.ACREDITADO || 0) * 20 + 2}%` }} title={`Acreditados: ${v.ACREDITADO}`} />
              <div className="bg-amber-500" style={{ width: `${(v.EN_REVISION || 0) * 20 + 2}%` }} />
              <div className="bg-red-500" style={{ width: `${(v.BLOQUEADO || 0) * 20 + 2}%` }} />
            </div><p className="text-xs text-slate-400 mt-1">🟢 {v.ACREDITADO || 0} · 🟡 {v.EN_REVISION || 0} · 🔴 {v.BLOQUEADO || 0}</p></div>
          ))}
          {!Object.keys(data?.acreditacion_por_mandante || {}).length && <p className="text-sm text-slate-400">Sin datos</p>}
        </CardContent></Card>
      </div>
    </div>
  );
}

/* ------------ Mandantes ------------ */
function Mandantes({ api, openDetail, canManage }) {
  const [data, reload] = useData(api, '/mandantes');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ razon_social: '', rut: '', region: '', comuna: '' });
  const save = async () => { try { await api('/mandantes', { method: 'POST', body: JSON.stringify(f) }); toast.success('Mandante creado'); setOpen(false); setF({ razon_social: '', rut: '', region: '', comuna: '' }); reload(); } catch (e) { toast.error(e.message); } };
  return (
    <div>
      <PageHead title="Mandantes" sub="Empresas clientes del Holding" action={canManage && <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nuevo mandante</Button>} />
      <Table onRow={(r) => openDetail('mandante', r.mandante_id)} columns={[
        { key: 'razon_social', label: 'Razón Social', render: (r) => <span className="font-medium text-slate-800">{r.razon_social}</span> },
        { key: 'rut', label: 'RUT' }, { key: 'region', label: 'Región' },
        { key: 'contratos_count', label: 'Contratos' },
        { key: 'activo', label: 'Estado', render: (r) => <Badge variant={r.activo ? 'default' : 'secondary'} className={r.activo ? 'bg-emerald-100 text-emerald-700' : ''}>{r.activo ? 'Activo' : 'Inactivo'}</Badge> },
        { key: 'x', label: '', render: () => <ChevronRight className="h-4 w-4 text-slate-300" /> },
      ]} rows={data?.mandantes} />
      <Dialog open={open} onOpenChange={setOpen}><DialogContent>
        <DialogHeader><DialogTitle>Nuevo mandante</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Razón social</Label><Input value={f.razon_social} onChange={(e) => setF({ ...f, razon_social: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>RUT</Label><Input value={f.rut} onChange={(e) => setF({ ...f, rut: e.target.value })} placeholder="77.123.456-7" /></div>
            <div className="space-y-1.5"><Label>Región</Label><Input value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Comuna</Label><Input value={f.comuna} onChange={(e) => setF({ ...f, comuna: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button className="bg-blue-600 hover:bg-blue-700" onClick={save}>Crear</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}

function MandanteDetail({ api, id, onBack, openDetail }) {
  const [data, reload] = useData(api, `/mandantes/${id}`, [id]);
  if (!data) return <p className="text-slate-400">Cargando…</p>;
  const { mandante, empresas, gerencias, contratos, requisitos, trabajadores } = data;
  const reqByCat = {};
  (requisitos || []).forEach((r) => { const k = r.categoria || 'Sin categoría'; (reqByCat[k] = reqByCat[k] || []).push(r); });
  return (
    <div>
      <button onClick={onBack} className="text-sm text-blue-600 mb-3">← Volver a Mandantes</button>
      <PageHead title={mandante.razon_social} sub={`RUT ${mandante.rut} · ${mandante.comuna || ''}, ${mandante.region || ''}`} />
      <Tabs defaultValue="resumen">
        <TabsList className="flex-wrap h-auto"><TabsTrigger value="resumen">Resumen</TabsTrigger><TabsTrigger value="empresas">Empresas</TabsTrigger><TabsTrigger value="contratos">Contratos</TabsTrigger><TabsTrigger value="trabajadores">Trabajadores</TabsTrigger><TabsTrigger value="estandar">Estándar Documental</TabsTrigger></TabsList>
        <TabsContent value="resumen"><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label="Empresas Holding" value={empresas.length} icon={Building} color="bg-blue-50 text-blue-600" />
          <Kpi label="Contratos" value={contratos.length} icon={FileSignature} color="bg-indigo-50 text-indigo-600" />
          <Kpi label="Trabajadores" value={trabajadores.length} icon={Users} color="bg-slate-100 text-slate-600" />
          <Kpi label="Requisitos doc." value={requisitos.length} icon={ShieldCheck} color="bg-emerald-50 text-emerald-600" />
        </div></TabsContent>
        <TabsContent value="empresas"><Table columns={[{ key: 'razon_social', label: 'Empresa del Holding' }, { key: 'rut', label: 'RUT' }, { key: 'comuna', label: 'Comuna' }]} rows={empresas} empty="Sin empresas habilitadas" /></TabsContent>
        <TabsContent value="contratos"><Table onRow={(r) => openDetail('contrato', r.contrato_id)} columns={[
          { key: 'numero_oc', label: 'N° OC', render: (r) => <span className="font-medium">{r.numero_oc}</span> }, { key: 'empresa', label: 'Empresa' },
          { key: 'dotacion', label: 'Dotación', render: (r) => `${r.dotacion} / ${r.limite_contingente}` },
          { key: 'estado', label: 'Estado', render: (r) => <Badge className="bg-emerald-100 text-emerald-700">{r.estado}</Badge> },
        ]} rows={contratos} /></TabsContent>
        <TabsContent value="trabajadores"><Table onRow={(r) => openDetail('trabajador', r.trabajador_id)} columns={[{ key: 'nombre', label: 'Nombre', render: (r) => `${r.nombre} ${r.apellido}` }, { key: 'rut', label: 'RUT' }, { key: 'cargo', label: 'Cargo' }]} rows={trabajadores} /></TabsContent>
        <TabsContent value="estandar">
          <p className="text-sm text-slate-500 mb-3">Requisitos documentales para <strong>Trabajadores</strong> de este mandante.</p>
          {Object.entries(reqByCat).map(([cat, reqs]) => (
            <div key={cat} className="mb-4"><h3 className="font-semibold text-slate-700 mb-2">{cat}</h3>
              <Table columns={[
                { key: 'nombre', label: 'Documento' },
                { key: 'obligatorio', label: 'Obligatorio', render: (r) => r.obligatorio ? <Badge className="bg-blue-100 text-blue-700">Sí</Badge> : <Badge variant="secondary">No</Badge> },
                { key: 'tiene_vencimiento', label: 'Vence', render: (r) => r.tiene_vencimiento ? `Sí · alerta ${r.dias_alerta}d` : 'No' },
              ]} rows={reqs} />
            </div>
          ))}
          {!requisitos.length && <p className="text-slate-400">Sin requisitos configurados.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------ Contratos ------------ */
function Contratos({ api, openDetail, canManage }) {
  const [data] = useData(api, '/contratos');
  return (
    <div>
      <PageHead title="Contratos" sub="Contratos comerciales por mandante y empresa" />
      <Table onRow={(r) => openDetail('contrato', r.contrato_id)} columns={[
        { key: 'numero_oc', label: 'N° OC', render: (r) => <span className="font-medium">{r.numero_oc}</span> },
        { key: 'mandante', label: 'Mandante' }, { key: 'empresa', label: 'Empresa Holding' }, { key: 'gerencia', label: 'Gerencia' },
        { key: 'dotacion', label: 'Dotación', render: (r) => <span className={r.dotacion >= r.limite_contingente ? 'text-red-600 font-medium' : ''}>{r.dotacion} / {r.limite_contingente}</span> },
        { key: 'estado', label: 'Estado', render: (r) => <Badge className="bg-emerald-100 text-emerald-700">{r.estado}</Badge> },
      ]} rows={data?.contratos} />
    </div>
  );
}
function ContratoDetail({ api, id, onBack }) {
  const [data] = useData(api, `/contratos/${id}`, [id]);
  if (!data) return <p className="text-slate-400">Cargando…</p>;
  const c = data.contrato; const pct = c.limite_contingente ? Math.min(100, (c.dotacion / c.limite_contingente) * 100) : 0;
  const dias = c.fecha_termino ? Math.round((new Date(c.fecha_termino) - new Date()) / 86400000) : null;
  return (
    <div>
      <button onClick={onBack} className="text-sm text-blue-600 mb-3">← Volver</button>
      <PageHead title={`Contrato ${c.numero_oc}`} sub={`${c.mandante} · ${c.empresa}`} />
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-2"><CardContent className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div><p className="text-slate-400">Gerencia</p><p className="font-medium">{c.gerencia || '—'}</p></div>
            <div><p className="text-slate-400">Inicio</p><p className="font-medium">{c.fecha_inicio?.slice(0, 10) || '—'}</p></div>
            <div><p className="text-slate-400">Término</p><p className="font-medium">{c.fecha_termino?.slice(0, 10) || '—'}</p></div>
            <div><p className="text-slate-400">Días restantes</p><p className="font-medium">{dias ?? '—'}</p></div>
            <div><p className="text-slate-400">Estado</p><Badge className="bg-emerald-100 text-emerald-700">{c.estado}</Badge></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-sm text-slate-400 mb-1">Dotación</p><p className="text-2xl font-bold">{c.dotacion} <span className="text-base text-slate-400">/ {c.limite_contingente}</span></p>
          <Progress value={pct} className="h-2 mt-2" />
          {c.dotacion >= c.limite_contingente && <p className="text-xs text-red-600 mt-2 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />Límite de contingente alcanzado</p>}
        </CardContent></Card>
      </div>
      <h3 className="font-semibold text-slate-700 mb-2">Trabajadores asignados</h3>
      <Table columns={[{ key: 'nombre', label: 'Nombre', render: (r) => `${r.nombre} ${r.apellido}` }, { key: 'rut', label: 'RUT' }, { key: 'cargo', label: 'Cargo' }]} rows={data.trabajadores} />
    </div>
  );
}

/* ------------ Trabajadores ------------ */
function Trabajadores({ api, openDetail, canManage, isSuper }) {
  const [q, setQ] = useState('');
  const [data, reload] = useData(api, `/trabajadores`);
  const [empresas] = useData(api, '/empresas');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ empresa_id: '', rut: '', nombre: '', apellido: '', cargo: '', telefono: '' });
  const search = async () => { try { const d = await api(`/trabajadores?q=${encodeURIComponent(q)}`); reload.__set?.(d); } catch {} };
  const [rows, setRows] = useState(null);
  useEffect(() => { setRows(data?.trabajadores || null); }, [data]);
  const doSearch = async () => { const d = await api(`/trabajadores?q=${encodeURIComponent(q)}`); setRows(d.trabajadores); };
  const save = async () => { try { await api('/trabajadores', { method: 'POST', body: JSON.stringify(f) }); toast.success('Trabajador creado'); setOpen(false); setF({ empresa_id: '', rut: '', nombre: '', apellido: '', cargo: '', telefono: '' }); reload(); } catch (e) { toast.error(e.message); } };
  return (
    <div>
      <PageHead title="Trabajadores" sub="Ficha única por trabajador (una empresa del Holding)" action={canManage && <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nuevo trabajador</Button>} />
      <div className="flex gap-2 mb-3 max-w-md"><div className="relative flex-1"><Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" /><Input className="pl-9" placeholder="Buscar por nombre, RUT, cargo…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()} /></div><Button variant="outline" onClick={doSearch}>Buscar</Button></div>
      <Table onRow={(r) => openDetail('trabajador', r.trabajador_id)} columns={[
        { key: 'nombre', label: 'Nombre', render: (r) => <span className="font-medium text-slate-800">{r.nombre} {r.apellido}</span> },
        { key: 'rut', label: 'RUT' }, { key: 'cargo', label: 'Cargo' }, { key: 'empresa', label: 'Empresa Holding' },
        { key: 'estado', label: 'Estado', render: (r) => <Badge className="bg-emerald-100 text-emerald-700">{r.estado}</Badge> },
        { key: 'x', label: '', render: () => <ChevronRight className="h-4 w-4 text-slate-300" /> },
      ]} rows={rows} />
      <Dialog open={open} onOpenChange={setOpen}><DialogContent>
        <DialogHeader><DialogTitle>Nuevo trabajador</DialogTitle><DialogDescription>Pertenece a una única empresa del Holding.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          {isSuper && <div className="space-y-1.5"><Label>Empresa del Holding</Label><Select value={f.empresa_id} onValueChange={(v) => setF({ ...f, empresa_id: v })}><SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger><SelectContent>{(empresas?.empresas || []).map((e) => <SelectItem key={e.empresa_id} value={e.empresa_id}>{e.razon_social}</SelectItem>)}</SelectContent></Select></div>}
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Nombre</Label><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></div><div className="space-y-1.5"><Label>Apellido</Label><Input value={f.apellido} onChange={(e) => setF({ ...f, apellido: e.target.value })} /></div></div>
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>RUT</Label><Input value={f.rut} onChange={(e) => setF({ ...f, rut: e.target.value })} /></div><div className="space-y-1.5"><Label>Cargo</Label><Input value={f.cargo} onChange={(e) => setF({ ...f, cargo: e.target.value })} /></div></div>
          <div className="space-y-1.5"><Label>Teléfono</Label><Input value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button className="bg-blue-600 hover:bg-blue-700" onClick={save}>Crear</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}

function TrabajadorDetail({ api, id, onBack, canManage }) {
  const [data, reload] = useData(api, `/trabajadores/${id}`, [id]);
  const [upload, setUpload] = useState(null); // {requisito, mandante_id}
  if (!data) return <p className="text-slate-400">Cargando…</p>;
  const { trabajador: t, asignaciones, acreditacion, historial } = data;
  return (
    <div>
      <button onClick={onBack} className="text-sm text-blue-600 mb-3">← Volver</button>
      <Card className="mb-4"><CardContent className="p-5 flex items-center gap-4 flex-wrap">
        <div className="h-16 w-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-bold">{t.nombre?.charAt(0)}</div>
        <div className="flex-1"><h1 className="text-xl font-bold text-slate-900">{t.nombre} {t.apellido}</h1><p className="text-slate-500 text-sm">RUT {t.rut} · {t.cargo || '—'}</p><p className="text-slate-400 text-sm">{t.empresa}</p></div>
        <div className="flex gap-2 flex-wrap">{acreditacion.map((a) => <div key={a.mandante_id} className="text-center"><p className="text-xs text-slate-400 mb-1">{a.mandante}</p><SemBadge estado={a.estado} /></div>)}</div>
      </CardContent></Card>
      <Tabs defaultValue="documentacion">
        <TabsList className="flex-wrap h-auto"><TabsTrigger value="documentacion">Documentación</TabsTrigger><TabsTrigger value="asignaciones">Asignaciones</TabsTrigger><TabsTrigger value="info">Información</TabsTrigger><TabsTrigger value="historial">Historial</TabsTrigger></TabsList>
        <TabsContent value="documentacion">
          {acreditacion.length === 0 && <p className="text-slate-400">Sin asignaciones a mandantes.</p>}
          {acreditacion.map((a) => (
            <Card key={a.mandante_id} className="mb-4"><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-base flex items-center gap-2">{a.mandante} <span className="text-xs text-slate-400 font-normal">· {a.contrato}</span></CardTitle><div className="flex items-center gap-2"><span className="text-xs text-slate-500">{a.docs_ok}/{a.docs_total} obligatorios</span><SemBadge estado={a.estado} /></div></div></CardHeader>
              <CardContent><div className="divide-y">
                {a.detalle.map((d) => (
                  <div key={d.requisito_id} className="flex items-center justify-between py-2 gap-2">
                    <div className="flex items-center gap-2 min-w-0"><span className="text-sm text-slate-700 truncate">{d.nombre}</span>{d.obligatorio && <span className="text-[10px] text-blue-600 border border-blue-200 rounded px-1">Oblig.</span>}</div>
                    <div className="flex items-center gap-2">
                      {d.fecha_vencimiento && <span className="text-xs text-slate-400">vence {String(d.fecha_vencimiento).slice(0, 10)}</span>}
                      <Badge className={`${docEstado[d.estado] || ''} border-0`}>{d.estado}</Badge>
                      {canManage && <Button size="sm" variant="outline" className="h-7" onClick={() => setUpload({ requisito: d, mandante_id: a.mandante_id })}><Upload className="h-3.5 w-3.5 mr-1" />Cargar</Button>}
                    </div>
                  </div>
                ))}
              </div></CardContent>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="asignaciones"><Table columns={[{ key: 'mandante', label: 'Mandante' }, { key: 'numero_oc', label: 'Contrato' }, { key: 'gerencia', label: 'Gerencia' }, { key: 'estado', label: 'Estado', render: (r) => <Badge className={r.estado === 'activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'}>{r.estado}</Badge> }]} rows={asignaciones} /></TabsContent>
        <TabsContent value="info"><Card><CardContent className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {[['RUT', t.rut], ['Nombre', `${t.nombre} ${t.apellido}`], ['Cargo', t.cargo], ['Género', t.genero], ['Región', t.region], ['Comuna', t.comuna], ['Teléfono', t.telefono], ['Empresa', t.empresa]].map(([k, v]) => <div key={k}><p className="text-slate-400">{k}</p><p className="font-medium">{v || '—'}</p></div>)}
        </CardContent></Card></TabsContent>
        <TabsContent value="historial"><Table columns={[{ key: 'created_at', label: 'Fecha', render: (r) => new Date(r.created_at).toLocaleString('es-CL') }, { key: 'accion', label: 'Acción' }, { key: 'usuario', label: 'Usuario' }]} rows={historial} empty="Sin eventos" /></TabsContent>
      </Tabs>
      {upload && <UploadDialog api={api} recurso_tipo="trabajador" recurso_id={id} requisito={upload.requisito} mandante_id={upload.mandante_id} onClose={() => setUpload(null)} onDone={() => { setUpload(null); reload(); }} />}
    </div>
  );
}

function UploadDialog({ api, recurso_tipo, recurso_id, requisito, mandante_id, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [emision, setEmision] = useState('');
  const [venc, setVenc] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!file) return toast.error('Selecciona un archivo');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('recurso_tipo', recurso_tipo); fd.append('recurso_id', recurso_id);
      fd.append('requisito_id', requisito.requisito_id); fd.append('mandante_id', mandante_id);
      if (emision) fd.append('fecha_emision', emision); if (venc) fd.append('fecha_vencimiento', venc);
      await api('/documentos/upload', { method: 'POST', body: fd });
      toast.success('Documento cargado (en revisión)'); onDone();
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}><DialogContent>
      <DialogHeader><DialogTitle>Cargar documento</DialogTitle><DialogDescription>{requisito.nombre}</DialogDescription></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5"><Label>Archivo (PDF o imagen)</Label><Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Fecha emisión</Label><Input type="date" value={emision} onChange={(e) => setEmision(e.target.value)} /></div><div className="space-y-1.5"><Label>Fecha vencimiento</Label><Input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} /></div></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button className="bg-blue-600 hover:bg-blue-700" disabled={loading} onClick={submit}>{loading ? 'Subiendo…' : 'Subir'}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}

/* ------------ Vehiculos / Equipos ------------ */
function SimpleResource({ api, kind, canManage, isSuper }) {
  const [data, reload] = useData(api, `/${kind}`);
  const [empresas] = useData(api, '/empresas');
  const [open, setOpen] = useState(false);
  const isVeh = kind === 'vehiculos';
  const [f, setF] = useState({});
  const save = async () => { try { await api(`/${kind}`, { method: 'POST', body: JSON.stringify(f) }); toast.success('Creado'); setOpen(false); setF({}); reload(); } catch (e) { toast.error(e.message); } };
  const rows = data?.[kind];
  return (
    <div>
      <PageHead title={isVeh ? 'Vehículos' : 'Equipos'} sub={`Cada ${isVeh ? 'vehículo' : 'equipo'} pertenece a una empresa del Holding`} action={canManage && <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nuevo</Button>} />
      <Table columns={isVeh ? [
        { key: 'patente', label: 'Patente', render: (r) => <span className="font-medium">{r.patente}</span> }, { key: 'tipo', label: 'Tipo' }, { key: 'marca', label: 'Marca' }, { key: 'modelo', label: 'Modelo' }, { key: 'anio', label: 'Año' }, { key: 'empresa', label: 'Empresa' },
      ] : [
        { key: 'codigo_interno', label: 'Código', render: (r) => <span className="font-medium">{r.codigo_interno}</span> }, { key: 'tipo', label: 'Tipo' }, { key: 'marca', label: 'Marca' }, { key: 'modelo', label: 'Modelo' }, { key: 'anio', label: 'Año' }, { key: 'empresa', label: 'Empresa' },
      ]} rows={rows} />
      <Dialog open={open} onOpenChange={setOpen}><DialogContent>
        <DialogHeader><DialogTitle>Nuevo {isVeh ? 'vehículo' : 'equipo'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {isSuper && <div className="space-y-1.5"><Label>Empresa del Holding</Label><Select value={f.empresa_id} onValueChange={(v) => setF({ ...f, empresa_id: v })}><SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger><SelectContent>{(empresas?.empresas || []).map((e) => <SelectItem key={e.empresa_id} value={e.empresa_id}>{e.razon_social}</SelectItem>)}</SelectContent></Select></div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{isVeh ? 'Patente' : 'Código interno'}</Label><Input onChange={(e) => setF({ ...f, [isVeh ? 'patente' : 'codigo_interno']: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Tipo</Label><Input onChange={(e) => setF({ ...f, tipo: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Marca</Label><Input onChange={(e) => setF({ ...f, marca: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Modelo</Label><Input onChange={(e) => setF({ ...f, modelo: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Año</Label><Input type="number" onChange={(e) => setF({ ...f, anio: Number(e.target.value) })} /></div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button className="bg-blue-600 hover:bg-blue-700" onClick={save}>Crear</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}

/* ------------ Revisión / Vencimientos ------------ */
function Revision({ api, profile }) {
  const [data, reload] = useData(api, '/documentos/pendientes');
  const [rej, setRej] = useState(null);
  const [obs, setObs] = useState('');
  const canReview = ['SUPER_ADMIN_HOLDING', 'REVISOR'].includes(profile.role_codigo);
  const act = async (docId, estado, observacion) => { try { await api(`/documentos/${docId}/revision`, { method: 'POST', body: JSON.stringify({ estado, observacion }) }); toast.success(estado === 'aprobado' ? 'Aprobado' : 'Rechazado'); reload(); } catch (e) { toast.error(e.message); } };
  return (
    <div>
      <PageHead title="Pendientes de revisión" sub="Documentos cargados esperando aprobación" />
      <Table columns={[
        { key: 'requisito', label: 'Documento', render: (r) => <span className="font-medium">{r.requisito || r.nombre_archivo}</span> },
        { key: 'trab', label: 'Trabajador', render: (r) => `${r.trab_nombre || ''} ${r.trab_apellido || ''}` },
        { key: 'mandante', label: 'Mandante' },
        { key: 'fecha_subida', label: 'Cargado', render: (r) => new Date(r.fecha_subida).toLocaleDateString('es-CL') },
        { key: 'acc', label: 'Acciones', render: (r) => canReview ? <div className="flex gap-2"><Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700" onClick={() => act(r.documento_id, 'aprobado')}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Aprobar</Button><Button size="sm" variant="outline" className="h-7 text-red-600 border-red-200" onClick={() => { setRej(r); setObs(''); }}><XCircle className="h-3.5 w-3.5 mr-1" />Rechazar</Button></div> : <span className="text-xs text-slate-400">Sin permiso</span> },
      ]} rows={data?.documentos} empty="No hay documentos pendientes" />
      <Dialog open={!!rej} onOpenChange={() => setRej(null)}><DialogContent>
        <DialogHeader><DialogTitle>Rechazar documento</DialogTitle><DialogDescription>Indica el motivo del rechazo</DialogDescription></DialogHeader>
        <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observación…" rows={3} />
        <DialogFooter><Button variant="outline" onClick={() => setRej(null)}>Cancelar</Button><Button className="bg-red-600 hover:bg-red-700" onClick={() => { act(rej.documento_id, 'rechazado', obs); setRej(null); }}>Rechazar</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
function Vencimientos({ api }) {
  const [dias, setDias] = useState(30);
  const [data, reload] = useData(api, `/vencimientos?dias=30`);
  const [rows, setRows] = useState(null);
  useEffect(() => { setRows(data?.documentos || null); }, [data]);
  const load = async (d) => { setDias(d); const r = await api(`/vencimientos?dias=${d}`); setRows(r.documentos); };
  return (
    <div>
      <PageHead title="Vencimientos" sub="Documentos aprobados próximos a vencer" action={<div className="flex gap-2">{[15, 30, 60, 90].map((d) => <Button key={d} size="sm" variant={dias === d ? 'default' : 'outline'} className={dias === d ? 'bg-blue-600' : ''} onClick={() => load(d)}>{d}d</Button>)}</div>} />
      <Table columns={[
        { key: 'requisito', label: 'Documento' },
        { key: 'trab', label: 'Trabajador', render: (r) => `${r.trab_nombre || ''} ${r.trab_apellido || ''}` },
        { key: 'mandante', label: 'Mandante' },
        { key: 'fecha_vencimiento', label: 'Vence', render: (r) => String(r.fecha_vencimiento).slice(0, 10) },
        { key: 'dias_restantes', label: 'Días', render: (r) => <Badge className={r.dias_restantes < 0 ? 'bg-red-100 text-red-700' : r.dias_restantes <= 15 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100'}>{r.dias_restantes < 0 ? 'Vencido' : `${r.dias_restantes} días`}</Badge> },
      ]} rows={rows} empty="Sin vencimientos en el rango" />
    </div>
  );
}

/* ------------ Empresas / Usuarios / Auditoria ------------ */
function Empresas({ api, isSuper }) {
  const [data, reload] = useData(api, '/empresas');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ razon_social: '', rut: '', nombre_fantasia: '', region: '', comuna: '' });
  const save = async () => { try { await api('/empresas', { method: 'POST', body: JSON.stringify(f) }); toast.success('Empresa creada'); setOpen(false); setF({ razon_social: '', rut: '', nombre_fantasia: '', region: '', comuna: '' }); reload(); } catch (e) { toast.error(e.message); } };
  return (
    <div>
      <PageHead title="Empresas del Holding" sub="Se pueden agregar nuevas empresas al grupo" action={isSuper && <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nueva empresa</Button>} />
      <Table columns={[{ key: 'razon_social', label: 'Razón Social', render: (r) => <span className="font-medium">{r.razon_social}</span> }, { key: 'rut', label: 'RUT' }, { key: 'comuna', label: 'Comuna' }, { key: 'trabajadores_count', label: 'Trabajadores' }]} rows={data?.empresas} />
      <Dialog open={open} onOpenChange={setOpen}><DialogContent>
        <DialogHeader><DialogTitle>Nueva empresa del Holding</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Razón social</Label><Input value={f.razon_social} onChange={(e) => setF({ ...f, razon_social: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>RUT</Label><Input value={f.rut} onChange={(e) => setF({ ...f, rut: e.target.value })} /></div><div className="space-y-1.5"><Label>Nombre fantasía</Label><Input value={f.nombre_fantasia} onChange={(e) => setF({ ...f, nombre_fantasia: e.target.value })} /></div></div>
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Región</Label><Input value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} /></div><div className="space-y-1.5"><Label>Comuna</Label><Input value={f.comuna} onChange={(e) => setF({ ...f, comuna: e.target.value })} /></div></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button className="bg-blue-600 hover:bg-blue-700" onClick={save}>Crear</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
function Usuarios({ api, isSuper }) {
  const [data, reload] = useData(api, isSuper ? '/usuarios' : '/me');
  const [empresas] = useData(api, '/empresas');
  const [mandantes] = useData(api, '/mandantes');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ email: '', password: '', nombre: '', role_codigo: 'ADMIN_EMPRESA', empresa_id: '', mandante_id: '' });
  const save = async () => { try { await api('/usuarios', { method: 'POST', body: JSON.stringify(f) }); toast.success('Usuario creado'); setOpen(false); reload(); } catch (e) { toast.error(e.message); } };
  if (!isSuper) return <div><PageHead title="Usuarios" /><p className="text-slate-400">Solo el Super Administrador puede gestionar usuarios.</p></div>;
  return (
    <div>
      <PageHead title="Usuarios y permisos" sub="Cuentas gestionadas con Supabase Auth" action={<Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nuevo usuario</Button>} />
      <Table columns={[{ key: 'nombre', label: 'Nombre', render: (r) => <span className="font-medium">{r.nombre}</span> }, { key: 'email', label: 'Correo' }, { key: 'role_codigo', label: 'Rol', render: (r) => <Badge variant="secondary">{roleLabel[r.role_codigo]}</Badge> }, { key: 'empresa', label: 'Empresa' }, { key: 'mandante', label: 'Mandante' }]} rows={data?.usuarios} />
      <Dialog open={open} onOpenChange={setOpen}><DialogContent>
        <DialogHeader><DialogTitle>Nuevo usuario</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Nombre</Label><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Correo</Label><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div><div className="space-y-1.5"><Label>Contraseña</Label><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div></div>
          <div className="space-y-1.5"><Label>Rol</Label><Select value={f.role_codigo} onValueChange={(v) => setF({ ...f, role_codigo: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SUPER_ADMIN_HOLDING">Super Admin Holding</SelectItem><SelectItem value="ADMIN_EMPRESA">Admin Empresa</SelectItem><SelectItem value="USUARIO_MANDANTE">Usuario Mandante</SelectItem><SelectItem value="REVISOR">Revisor Documental</SelectItem></SelectContent></Select></div>
          {f.role_codigo === 'ADMIN_EMPRESA' && <div className="space-y-1.5"><Label>Empresa</Label><Select value={f.empresa_id} onValueChange={(v) => setF({ ...f, empresa_id: v })}><SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger><SelectContent>{(empresas?.empresas || []).map((e) => <SelectItem key={e.empresa_id} value={e.empresa_id}>{e.razon_social}</SelectItem>)}</SelectContent></Select></div>}
          {f.role_codigo === 'USUARIO_MANDANTE' && <div className="space-y-1.5"><Label>Mandante</Label><Select value={f.mandante_id} onValueChange={(v) => setF({ ...f, mandante_id: v })}><SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger><SelectContent>{(mandantes?.mandantes || []).map((m) => <SelectItem key={m.mandante_id} value={m.mandante_id}>{m.razon_social}</SelectItem>)}</SelectContent></Select></div>}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button className="bg-blue-600 hover:bg-blue-700" onClick={save}>Crear</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
function Auditoria({ api }) {
  const [data] = useData(api, '/auditoria');
  return (
    <div>
      <PageHead title="Auditoría" sub="Trazabilidad de operaciones importantes" />
      <Table columns={[
        { key: 'created_at', label: 'Fecha', render: (r) => new Date(r.created_at).toLocaleString('es-CL') },
        { key: 'usuario', label: 'Usuario' }, { key: 'accion', label: 'Acción', render: (r) => <Badge variant="secondary">{r.accion}</Badge> },
        { key: 'entidad', label: 'Entidad' },
      ]} rows={data?.eventos} empty="Sin eventos" />
    </div>
  );
}
