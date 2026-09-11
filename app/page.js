'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RTooltip, Legend, AreaChart, Area,
} from 'recharts';
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
import { ConfirmDialogHost, confirmDialog } from '@/components/confirm-dialog';
import { toast } from 'sonner';
import {
  LayoutDashboard, Building2, FileSignature, Users, Truck, Wrench, ShieldCheck, FileClock,
  CalendarClock, Building, UserCog, History, LogOut, Search, Plus, ChevronRight, ChevronDown, Upload,
  CheckCircle2, XCircle, AlertTriangle, Clock, Menu, Bell, Download, BarChart3, Trash2, Eye, ExternalLink, Printer, X, FolderOpen, QrCode, Copy, Settings, UserMinus,
} from 'lucide-react';
import logoAptiva from '@/assets/logo-aptiva.png';
import loginBg from '@/assets/login-bg.jpg';
import faviconAptiva from '@/assets/favicon-aptiva.png';

const LOGO = logoAptiva.src;
const LOGIN_BG = loginBg.src;
const FAVICON = faviconAptiva.src;
const YEAR = new Date().getFullYear();
const API = '/api';

// Fechas: formato DD-MM-AAAA (fechas tipo date sin desfase de zona) y fecha/hora en horario de Chile
const fdate = (d) => {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  const parts = s.split('-');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return s;
};
const fdatetime = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return String(d); }
};
const fdateCL = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return fdate(d); }
};
// Validador de RUT chileno (módulo 11)
const validarRut = (rut) => {
  if (!rut) return false;
  const c = String(rut).replace(/[.\-\s]/g, '').toUpperCase();
  if (!/^\d{7,8}[0-9K]$/.test(c)) return false;
  const cuerpo = c.slice(0, -1); const dv = c.slice(-1);
  let suma = 0, mul = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) { suma += parseInt(cuerpo[i], 10) * mul; mul = mul === 7 ? 2 : mul + 1; }
  const res = 11 - (suma % 11);
  const dvCalc = res === 11 ? '0' : res === 10 ? 'K' : String(res);
  return dv === dvCalc;
};
const formatRut = (rut) => {
  const c = String(rut || '').replace(/[.\-\s]/g, '').toUpperCase();
  if (c.length < 2) return rut;
  const dv = c.slice(-1); let body = c.slice(0, -1), out = '';
  while (body.length > 3) { out = '.' + body.slice(-3) + out; body = body.slice(0, -3); }
  return body + out + '-' + dv;
};


const roleLabel = { SUPER_ADMIN_HOLDING: 'Super Admin Holding', ADMIN_EMPRESA: 'Admin Empresa', USUARIO_MANDANTE: 'Usuario Mandante', REVISOR: 'Revisor Documental', MANDANTE_ADMIN: 'Administrador', MANDANTE_VISOR: 'Visor', MANDANTE_RRHH: 'RRHH', MANDANTE_PREVENCION: 'Prevención' };
// Color por importancia/jerarquía del rol (más alto = más privilegios)
const roleColor = {
  SUPER_ADMIN_HOLDING: 'bg-purple-100 text-purple-700 border-purple-200',
  ADMIN_EMPRESA: 'bg-rose-100 text-rose-700 border-rose-200',
  MANDANTE_ADMIN: 'bg-amber-100 text-amber-700 border-amber-200',
  REVISOR: 'bg-blue-100 text-blue-700 border-blue-200',
  MANDANTE_RRHH: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  MANDANTE_PREVENCION: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  MANDANTE_VISOR: 'bg-slate-100 text-slate-600 border-slate-200',
  USUARIO_MANDANTE: 'bg-slate-100 text-slate-600 border-slate-200',
};
const roleBadgeClass = (code) => `border font-medium ${roleColor[code] || 'bg-slate-100 text-slate-600 border-slate-200'}`;

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

  if (booting) return <div className="min-h-screen flex items-center justify-center bg-slate-100"><img src={FAVICON} alt="Aptiva" className="h-12 w-12 animate-spin" style={{ animationDuration: '1.1s' }} /></div>;
  if (!token || !profile) return <><Login onLogin={onLogin} /><ConfirmDialogHost /></>;
  return <><Shell token={token} profile={profile} onLogout={onLogout} /><ConfirmDialogHost /></>;
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
      <div className="lg:col-span-3 relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${LOGIN_BG})` }} />
        <div className="absolute inset-0 bg-slate-950/75" />
        <div className="relative"><img src={LOGO} alt="Aptiva" className="h-16 w-auto" style={{ filter: 'brightness(0) invert(1)' }} /></div>
        <div className="relative space-y-4 max-w-lg">
          <h1 className="text-4xl font-bold leading-tight">Gestión documental y acreditación de recursos</h1>
          <p className="text-slate-200">Plataforma corporativa multiempresa del <strong>Holding Río Loa</strong>. Controla en tiempo real qué recursos están acreditados para operar en cada mandante y contrato.</p>
        </div>
        <div className="relative" />
      </div>
      <div className="lg:col-span-2 flex flex-col p-6 sm:p-10">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm">
            <img src={LOGO} alt="Aptiva" className="h-10 mb-8 lg:hidden" />
            <h2 className="text-2xl font-bold text-slate-900">Iniciar sesión</h2>
            <p className="text-slate-500 mb-6 text-sm">Accede con tu cuenta corporativa</p>
            <div className="space-y-4">
              <div className="space-y-1.5"><Label>Correo</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@aptivarl.com" /></div>
              <div className="space-y-1.5"><Label>Contraseña</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === 'Enter' && submit()} /></div>
              <Button className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading} onClick={submit}>{loading ? 'Ingresando…' : 'Ingresar'}</Button>
            </div>
          </div>
        </div>
        <div className="text-center text-xs text-slate-400">© DoSoft {YEAR}</div>
      </div>
    </div>
  );
}

const NAV = [
  { group: '', items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  { group: 'Operación', items: [{ id: 'mandantes', label: 'Mandantes', icon: Building2 }, { id: 'contratos', label: 'Contratos', icon: FileSignature }] },
  { group: 'Recursos', items: [{ id: 'trabajadores', label: 'Trabajadores', icon: Users }, { id: 'vehiculos', label: 'Vehículos', icon: Truck }, { id: 'equipos', label: 'Equipos', icon: Wrench }] },
  { group: 'Acreditación', items: [{ id: 'revision', label: 'Pendientes de Revisión', icon: FileClock }, { id: 'vencimientos', label: 'Vencimientos', icon: CalendarClock }, { id: 'desvinculaciones', label: 'Personal Finiquitado', icon: UserMinus }] },
  { group: 'Administración', items: [{ id: 'empresas', label: 'Empresas', icon: Building }, { id: 'usuarios', label: 'Usuarios', icon: UserCog }, { id: 'mantenedores', label: 'Mantenedores', icon: Settings, super: true }, { id: 'auditoria', label: 'Auditoría', icon: History }] },
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
        <div className="h-16 flex items-center justify-center px-4 bg-white border-b border-slate-200">
          <img src={LOGO} alt="Aptiva RL" className="h-11 w-auto" />
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {NAV.map((sec, i) => (
            <div key={i}>
              {sec.group && <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{sec.group}</p>}
              <div className="space-y-0.5">
                {sec.items.filter((it) => !it.super || isSuper).map((it) => (
                  <button key={it.id} onClick={() => go(it.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${view === it.id && !detail ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}>
                    <it.icon className="h-4 w-4 shrink-0" />{it.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
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
            <NotificationsBell api={api} onGo={go} />
            <div className="text-right hidden sm:block"><p className="text-sm font-medium text-slate-800">{profile.nombre}</p><p className="text-xs text-slate-400">{roleLabel[profile.role_codigo]}</p></div>
            <div className="h-9 w-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">{profile.nombre?.charAt(0)}</div>
            <button onClick={onLogout} className="text-slate-400 hover:text-red-500"><LogOut className="h-5 w-5" /></button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          {detail?.type === 'mandante' && <MandanteDetail {...ctx} id={detail.id} onBack={() => setDetail(null)} />}
          {detail?.type === 'contrato' && <ContratoDetail {...ctx} id={detail.id} onBack={() => setDetail(null)} />}
          {detail?.type === 'trabajador' && <TrabajadorDetail {...ctx} id={detail.id} onBack={() => setDetail(null)} />}
          {(detail?.type === 'vehiculo' || detail?.type === 'equipo') && <RecursoDetail {...ctx} tipo={detail.type} id={detail.id} onBack={() => setDetail(null)} />}
          {!detail && view === 'dashboard' && <Dashboard {...ctx} />}
          {!detail && view === 'mandantes' && <Mandantes {...ctx} />}
          {!detail && view === 'contratos' && <Contratos {...ctx} />}
          {!detail && view === 'trabajadores' && <Trabajadores {...ctx} />}
          {!detail && view === 'vehiculos' && <SimpleResource {...ctx} kind="vehiculos" />}
          {!detail && view === 'equipos' && <SimpleResource {...ctx} kind="equipos" />}
          {!detail && view === 'revision' && <Revision {...ctx} />}
          {!detail && view === 'vencimientos' && <Vencimientos {...ctx} />}
          {!detail && view === 'desvinculaciones' && <Desvinculaciones {...ctx} />}
          {!detail && view === 'empresas' && <Empresas {...ctx} />}
          {!detail && view === 'usuarios' && <Usuarios {...ctx} />}
          {!detail && view === 'mantenedores' && isSuper && <Mantenedores {...ctx} />}
          {!detail && view === 'auditoria' && <Auditoria {...ctx} />}
        </main>

        <footer className="border-t bg-white px-6 py-3 flex items-center justify-center gap-2 text-xs text-slate-400">
          <span>©DoSoft {YEAR}</span>
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
function DetailHeader({ icon, title, subtitle, meta = [], badge, actions }) {
  return (
    <div className="rounded-xl border bg-white shadow-sm p-5 mb-5 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">{icon}</div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 leading-tight">{title}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-slate-500">
            {subtitle && <span>{subtitle}</span>}
            {meta.filter((m) => m && m.value != null && m.value !== '').map((m, i) => <span key={i}><span className="text-slate-400">{m.label}:</span> <span className="font-medium text-slate-600">{m.value}</span></span>)}
            {badge}
          </div>
        </div>
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
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
function Table({ columns, rows, onRow, empty = 'Sin registros', pageSize = 15 }) {
  const [page, setPage] = useState(1);
  const all = rows || [];
  const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
  const cur = Math.min(page, totalPages);
  useEffect(() => { if (page !== cur) setPage(cur); }, [cur, page]);
  const start = (cur - 1) * pageSize;
  const pageRows = all.slice(start, start + pageSize);
  const cols = onRow
    ? [...columns, { key: '__acceder', label: '', render: (r) => <Button size="sm" variant="outline" className="h-7 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => onRow(r)}>Acceder <ChevronRight className="h-3.5 w-3.5 ml-0.5" /></Button> }]
    : columns;
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500"><tr>{cols.map((c) => <th key={c.key} className="text-left font-medium px-4 py-2.5 whitespace-nowrap">{c.label}</th>)}</tr></thead>
          <tbody className="divide-y">
            {pageRows.map((r, i) => (
              <tr key={start + i} className="hover:bg-slate-50">
                {cols.map((c) => <td key={c.key} className="px-4 py-2.5 whitespace-nowrap">{c.render ? c.render(r) : r[c.key]}</td>)}
              </tr>
            ))}
            {all.length === 0 && <tr><td colSpan={cols.length} className="px-4 py-8 text-center text-slate-400">{empty}</td></tr>}
          </tbody>
        </table>
      </div>
      {all.length > pageSize && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t bg-slate-50 text-sm">
          <span className="text-slate-500">Mostrando {start + 1}–{Math.min(start + pageSize, all.length)} de {all.length}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>Anterior</Button>
            <span className="text-slate-600">{cur} / {totalPages}</span>
            <Button size="sm" variant="outline" className="h-7" disabled={cur >= totalPages} onClick={() => setPage(cur + 1)}>Siguiente</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------ Dashboard ------------ */
function csvDownload(filename, headers, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

function NotificationsBell({ api, onGo }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { api('/notificaciones').then(setData).catch(() => {}); }, [api]);
  const total = data?.total || 0;
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative text-slate-500 hover:text-slate-800">
        <Bell className="h-5 w-5" />
        {total > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] rounded-full h-4 min-w-4 px-1 flex items-center justify-center">{total > 99 ? '99+' : total}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-white border rounded-lg shadow-xl z-50 max-h-[70vh] overflow-y-auto">
            <div className="p-3 border-b font-medium text-slate-800 text-sm">Notificaciones</div>
            <div className="p-2 space-y-1 text-sm">
              {data?.pendientes_revision > 0 && <button onClick={() => { setOpen(false); onGo('revision'); }} className="w-full text-left px-2 py-2 rounded hover:bg-slate-50 flex items-center gap-2"><FileClock className="h-4 w-4 text-amber-500" />{data.pendientes_revision} documento(s) por revisar</button>}
              {(data?.vencidos || []).map((v) => <div key={v.documento_id} className="px-2 py-2 rounded hover:bg-slate-50"><p className="text-slate-700 truncate">{v.documento}</p><p className="text-xs text-slate-500 truncate">{v.recurso}</p><p className="text-xs text-red-600">Vencido · {v.mandante}</p></div>)}
              {(data?.por_vencer || []).map((v) => <div key={v.documento_id} className="px-2 py-2 rounded hover:bg-slate-50"><p className="text-slate-700 truncate">{v.documento}</p><p className="text-xs text-slate-500 truncate">{v.recurso}</p><p className="text-xs text-amber-600">Vence en {v.dias_restantes}d · {v.mandante}</p></div>)}
              {total === 0 && <p className="text-slate-400 px-2 py-4 text-center">Sin alertas</p>}
            </div>
            <button onClick={() => { setOpen(false); onGo('vencimientos'); }} className="w-full text-center p-2 text-blue-600 text-sm border-t hover:bg-slate-50">Ver vencimientos</button>
          </div>
        </>
      )}
    </div>
  );
}

const estadoBar = { aprobado: 'bg-emerald-500', en_revision: 'bg-blue-500', rechazado: 'bg-red-500', vencido: 'bg-red-600', pendiente: 'bg-slate-400' };
const ACR_COLORS = { ACREDITADO: '#10b981', EN_REVISION: '#f59e0b', BLOQUEADO: '#ef4444' };
const DOC_COLORS = { aprobado: '#10b981', en_revision: '#3b82f6', rechazado: '#ef4444', vencido: '#dc2626', pendiente: '#94a3b8', faltante: '#cbd5e1' };
const MESES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mesLabel = (m) => { const [y, mo] = String(m || '').split('-'); return mo ? `${MESES_ABR[Number(mo) - 1]} ${String(y).slice(2)}` : m; };
const docLabel = (e) => String(e || '').replace('_', ' ');

function ChartTip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white shadow-lg px-3 py-2 text-xs">
      {label != null && <p className="font-semibold text-slate-700 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="capitalize">{p.name}</span>
          <span className="ml-auto font-semibold text-slate-800">{p.value}{unit}</span>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, desc, icon: Icon, className = '', children, right }) {
  return (
    <Card className={`shadow-sm ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">{Icon && <Icon className="h-4 w-4 text-slate-400" />}{title}</CardTitle>
            {desc && <CardDescription>{desc}</CardDescription>}
          </div>
          {right}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function KpiCard({ label, value, icon: Icon, accent = 'blue', hint }) {
  const map = {
    blue: 'from-blue-500/10 to-blue-500/0 text-blue-600 ring-blue-100',
    indigo: 'from-indigo-500/10 to-indigo-500/0 text-indigo-600 ring-indigo-100',
    slate: 'from-slate-500/10 to-slate-500/0 text-slate-600 ring-slate-100',
    emerald: 'from-emerald-500/10 to-emerald-500/0 text-emerald-600 ring-emerald-100',
    red: 'from-red-500/10 to-red-500/0 text-red-600 ring-red-100',
    amber: 'from-amber-500/10 to-amber-500/0 text-amber-600 ring-amber-100',
    orange: 'from-orange-500/10 to-orange-500/0 text-orange-600 ring-orange-100',
  };
  const c = map[accent] || map.blue;
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${c} ring-1 flex items-center justify-center shrink-0`}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <div className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{(value ?? 0).toLocaleString('es-CL')}</div>
          <div className="text-xs text-slate-500 mt-1 truncate">{label}</div>
          {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function DonutAcreditacion({ s }) {
  const data = [
    { name: 'Acreditado', key: 'ACREDITADO', value: s.trabajadores_acreditados || 0 },
    { name: 'En revisión', key: 'EN_REVISION', value: s.trabajadores_revision || 0 },
    { name: 'Bloqueado', key: 'BLOQUEADO', value: s.trabajadores_bloqueados || 0 },
  ];
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-2">
      <div className="relative h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="none">
              {data.map((d) => <Cell key={d.key} fill={ACR_COLORS[d.key]} />)}
            </Pie>
            <RTooltip content={<ChartTip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-slate-900 tabular-nums">{total.toLocaleString('es-CL')}</span>
          <span className="text-xs text-slate-400">trabajadores</span>
        </div>
      </div>
      <div className="space-y-2">
        {data.map((d) => (
          <div key={d.key} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 rounded-full" style={{ background: ACR_COLORS[d.key] }} />
            <span className="text-slate-600">{d.name}</span>
            <span className="ml-auto font-semibold text-slate-800 tabular-nums">{d.value.toLocaleString('es-CL')}</span>
            <span className="text-xs text-slate-400 w-10 text-right">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocsEstadoChart({ rows }) {
  const data = (rows || []).map((d) => ({ estado: docLabel(d.estado), raw: d.estado, c: d.c })).sort((a, b) => b.c - a.c);
  if (!data.length) return <p className="text-sm text-slate-400">Sin documentos</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 46)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="estado" width={92} tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} className="capitalize" />
        <RTooltip content={<ChartTip />} cursor={{ fill: '#f8fafc' }} />
        <Bar dataKey="c" name="Documentos" radius={[0, 6, 6, 0]} barSize={22}>
          {data.map((d, i) => <Cell key={i} fill={DOC_COLORS[d.raw] || '#94a3b8'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function TendenciaChart({ rows }) {
  const data = (rows || []).map((r) => ({ mes: mesLabel(r.mes), c: r.c }));
  const empty = data.every((d) => !d.c);
  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ left: -12, right: 12, top: 8, bottom: 4 }}>
          <defs>
            <linearGradient id="gradVenc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={36} />
          <RTooltip content={<ChartTip />} />
          <Area type="monotone" dataKey="c" name="Vencen" stroke="#f97316" strokeWidth={2.5} fill="url(#gradVenc)" dot={{ r: 3, fill: '#f97316' }} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
      {empty && <p className="text-center text-xs text-slate-400 -mt-6">Sin vencimientos en los próximos 6 meses</p>}
    </div>
  );
}

function MandanteStackedChart({ acr }) {
  const data = Object.entries(acr || {}).map(([m, v]) => ({
    mandante: m.length > 26 ? m.slice(0, 25) + '…' : m,
    Acreditado: v.ACREDITADO || 0, 'En revisión': v.EN_REVISION || 0, Bloqueado: v.BLOQUEADO || 0,
  })).sort((a, b) => (b.Acreditado + b['En revisión'] + b.Bloqueado) - (a.Acreditado + a['En revisión'] + a.Bloqueado));
  if (!data.length) return <p className="text-sm text-slate-400">Sin datos</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="mandante" width={170} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
        <RTooltip content={<ChartTip />} cursor={{ fill: '#f8fafc' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
        <Bar dataKey="Acreditado" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={16} />
        <Bar dataKey="En revisión" stackId="a" fill="#f59e0b" barSize={16} />
        <Bar dataKey="Bloqueado" stackId="a" fill="#ef4444" radius={[0, 6, 6, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function VencBadge({ dias }) {
  const d = Number(dias);
  const cls = d < 0 ? 'bg-red-100 text-red-700' : d <= 15 ? 'bg-orange-100 text-orange-700' : d <= 30 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600';
  const txt = d < 0 ? `Vencido ${Math.abs(d)}d` : `${d}d`;
  return <Badge className={`${cls} border-0`}>{txt}</Badge>;
}

function pctColor(p) { return p >= 90 ? '#10b981' : p >= 60 ? '#f59e0b' : '#ef4444'; }
function RadialPct({ pct, size = 96 }) {
  const c = pctColor(pct);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="rounded-full" style={{ width: size, height: size, background: `conic-gradient(${c} ${pct * 3.6}deg, #e2e8f0 0deg)` }} />
      <div className="absolute inset-[10px] rounded-full bg-white flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums" style={{ color: c }}>{pct}%</span>
        <span className="text-[10px] text-slate-400 -mt-0.5">cumple</span>
      </div>
    </div>
  );
}

const EXP_TIPO = { trabajador: { icon: Users, label: 'Trabajador' }, vehiculo: { icon: Truck, label: 'Vehículo' }, equipo: { icon: Wrench, label: 'Equipo' } };

function computeExpediente(acreditacion) {
  const now = new Date();
  let tot = 0, ok = 0;
  const docSummary = { aprobado: 0, por_vencer: 0, vencido: 0, en_revision: 0, rechazado: 0, faltante: 0 };
  const perMandante = [];
  (acreditacion || []).forEach((a) => {
    tot += a.docs_total || 0; ok += a.docs_ok || 0;
    const pct = a.docs_total ? Math.round((a.docs_ok / a.docs_total) * 100) : 100;
    perMandante.push({ mandante: a.mandante, contrato: a.contrato, estado: a.estado, ok: a.docs_ok || 0, total: a.docs_total || 0, pct });
    (a.detalle || []).forEach((d) => {
      let st = d.estado;
      if (st === 'aprobado' && d.fecha_vencimiento) {
        const dias = Math.ceil((new Date(d.fecha_vencimiento) - now) / 86400000);
        if (dias < 0) st = 'vencido'; else if (dias <= 30) st = 'por_vencer';
      }
      if (st === 'pendiente') st = 'en_revision';
      if (docSummary[st] !== undefined) docSummary[st]++;
    });
  });
  const pctTotal = tot ? Math.round((ok / tot) * 100) : 100;
  const estadoGlobal = perMandante.some((m) => m.estado === 'BLOQUEADO') ? 'BLOQUEADO'
    : perMandante.some((m) => m.estado === 'EN_REVISION') ? 'EN_REVISION' : 'ACREDITADO';
  return { pctTotal, ok, tot, docSummary, perMandante, estadoGlobal };
}

function printExpediente({ tipo, info, asignaciones, exp }) {
  const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const titulo = tipo === 'trabajador' ? `${info.nombre} ${info.apellido}` : (info.patente || info.codigo_interno);
  const metaMap = tipo === 'trabajador'
    ? [['RUT', info.rut], ['Cargo', info.cargo], ['Empresa', info.empresa]]
    : [['Tipo', info.tipo], ['Marca/Modelo', [info.marca, info.modelo, info.anio].filter(Boolean).join(' ')], ['Empresa', info.empresa]];
  const meta = metaMap.map(([k, v]) => `<span style="margin-right:18px"><b>${esc(k)}:</b> ${esc(v || '—')}</span>`).join('');
  const asigRows = (asignaciones || []).map((a) => `<tr><td>${esc(a.mandante)}</td><td>${esc(a.numero_oc)}</td><td>${esc(a.gerencia || '—')}</td><td>${esc(a.estado)}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#888">Sin asignaciones</td></tr>';
  const manRows = exp.perMandante.map((m) => `<tr><td>${esc(m.mandante)}</td><td>${esc(m.contrato)}</td><td>${esc(m.estado)}</td><td style="text-align:right">${m.ok}/${m.total}</td><td style="text-align:right"><b>${m.pct}%</b></td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#888">Sin datos</td></tr>';
  const ds = exp.docSummary;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Expediente ${esc(titulo)}</title>
  <style>body{font-family:Arial,Helvetica,sans-serif;color:#1e293b;padding:32px;max-width:820px;margin:auto}
  h1{font-size:22px;margin:0 0 4px}.meta{color:#475569;font-size:13px;margin-bottom:18px}
  h2{font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin-top:26px}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}th,td{border:1px solid #e2e8f0;padding:7px 9px;text-align:left}th{background:#f8fafc}
  .big{font-size:40px;font-weight:800}.chips span{display:inline-block;border:1px solid #e2e8f0;border-radius:8px;padding:6px 12px;margin:0 8px 8px 0;font-size:13px}
  .foot{margin-top:36px;color:#94a3b8;font-size:11px;text-align:center}</style></head>
  <body onload="window.print()">
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div><h1>${esc(titulo)}</h1><div class="meta">${meta}</div></div>
    <div style="text-align:right"><div class="big" style="color:${pctColor(exp.pctTotal)}">${exp.pctTotal}%</div><div style="font-size:12px;color:#64748b">Cumplimiento · ${esc(exp.estadoGlobal)}</div></div>
  </div>
  <h2>Resumen documental</h2>
  <div class="chips"><span>Aprobados: <b>${ds.aprobado}</b></span><span>Por vencer: <b>${ds.por_vencer}</b></span><span>Vencidos: <b>${ds.vencido}</b></span><span>En revisión: <b>${ds.en_revision}</b></span><span>Rechazados: <b>${ds.rechazado}</b></span><span>Faltantes: <b>${ds.faltante}</b></span></div>
  <h2>Cumplimiento por mandante</h2>
  <table><thead><tr><th>Mandante</th><th>Contrato</th><th>Estado</th><th style="text-align:right">Oblig.</th><th style="text-align:right">%</th></tr></thead><tbody>${manRows}</tbody></table>
  <h2>Asignaciones</h2>
  <table><thead><tr><th>Mandante</th><th>Contrato</th><th>Gerencia</th><th>Estado</th></tr></thead><tbody>${asigRows}</tbody></table>
  <div class="foot">Aptiva RL · Holding Río Loa · Expediente generado ${new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</div>
  </body></html>`;
  const w = window.open('', '_blank');
  if (!w) { toast.error('Permite las ventanas emergentes para imprimir'); return; }
  w.document.write(html); w.document.close();
}

const DOC_CHIP = {
  aprobado: { label: 'Aprobados', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
  por_vencer: { label: 'Por vencer', cls: 'bg-orange-50 text-orange-700 ring-orange-100' },
  vencido: { label: 'Vencidos', cls: 'bg-red-50 text-red-700 ring-red-100' },
  en_revision: { label: 'En revisión', cls: 'bg-blue-50 text-blue-700 ring-blue-100' },
  rechazado: { label: 'Rechazados', cls: 'bg-red-50 text-red-600 ring-red-100' },
  faltante: { label: 'Faltantes', cls: 'bg-slate-50 text-slate-600 ring-slate-200' },
};

function Expediente({ api, openDetail }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [openList, setOpenList] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [sel, setSel] = useState(null); // {tipo, id, label}
  const [detail, setDetail] = useState(null);
  const [loadingDet, setLoadingDet] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    let alive = true; setLoadingList(true);
    const t = setTimeout(async () => {
      try { const d = await api(`/buscar?q=${encodeURIComponent(q.trim())}`); if (alive) { setResults(d.resultados || []); setOpenList(true); } }
      catch { if (alive) setResults([]); }
      finally { if (alive) setLoadingList(false); }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [q, api]);

  const pick = async (r) => {
    setSel(r); setOpenList(false); setQ(r.label); setDetail(null); setLoadingDet(true);
    try {
      const path = r.tipo === 'trabajador' ? `/trabajadores/${r.id}` : r.tipo === 'vehiculo' ? `/vehiculos/${r.id}` : `/equipos/${r.id}`;
      const d = await api(path);
      setDetail({ tipo: r.tipo, info: d.trabajador || d.recurso, asignaciones: d.asignaciones || [], acreditacion: d.acreditacion || [] });
    } catch (e) { toast.error(e.message); } finally { setLoadingDet(false); }
  };
  const clear = () => { setSel(null); setDetail(null); setQ(''); setResults([]); };

  const exp = detail ? computeExpediente(detail.acreditacion) : null;
  const info = detail?.info;
  const tipoMeta = detail ? EXP_TIPO[detail.tipo] : null;
  const titulo = detail ? (detail.tipo === 'trabajador' ? `${info.nombre} ${info.apellido}` : (info.patente || info.codigo_interno)) : '';
  const metaItems = detail ? (detail.tipo === 'trabajador'
    ? [{ label: 'RUT', value: info.rut }, { label: 'Cargo', value: info.cargo || '—' }, { label: 'Empresa', value: info.empresa }]
    : [{ label: 'Tipo', value: info.tipo || '—' }, { label: 'Detalle', value: [info.marca, info.modelo, info.anio].filter(Boolean).join(' ') || '—' }, { label: 'Empresa', value: info.empresa }]) : [];

  return (
    <Card className="mb-4 shadow-sm border-slate-200 overflow-visible">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><FolderOpen className="h-4 w-4 text-blue-600" />Expediente</CardTitle>
        <CardDescription>Busca por RUT, nombre, patente o código para ver el expediente completo</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative max-w-xl">
          <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
          <Input className="pl-9 pr-9 h-11" placeholder="Ej: 12.345.678-9, Juan Pérez, ABCD-12…" value={q}
            onChange={(e) => setQ(e.target.value)} onFocus={() => results.length && setOpenList(true)}
            onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) pick(results[0]); if (e.key === 'Escape') setOpenList(false); }} />
          {q && <button onClick={clear} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>}
          {openList && (results.length > 0 || loadingList) && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setOpenList(false)} />
              <div className="absolute z-40 mt-1 w-full bg-white border rounded-lg shadow-xl max-h-80 overflow-y-auto">
                {loadingList && <div className="px-3 py-3 text-sm text-slate-400">Buscando…</div>}
                {results.map((r) => {
                  const Ic = EXP_TIPO[r.tipo].icon;
                  return (
                    <button key={`${r.tipo}-${r.id}`} onClick={() => pick(r)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-left border-b last:border-0">
                      <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0"><Ic className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-800 truncate">{r.label}</p><p className="text-xs text-slate-400 truncate">{r.sub}{r.extra ? ` · ${r.extra}` : ''}</p></div>
                      <span className="text-[10px] uppercase tracking-wide text-slate-400 shrink-0">{EXP_TIPO[r.tipo].label}</span>
                    </button>
                  );
                })}
                {!loadingList && !results.length && <div className="px-3 py-3 text-sm text-slate-400">Sin coincidencias</div>}
              </div>
            </>
          )}
        </div>

        {loadingDet && <div className="mt-4 h-40 rounded-xl bg-slate-50 animate-pulse" />}

        {detail && exp && !loadingDet && (
          <div className="mt-4 rounded-xl border bg-gradient-to-br from-slate-50 to-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-14 w-14 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 text-lg font-bold">
                  {detail.tipo === 'trabajador' ? (info.nombre?.charAt(0) || '?') : <tipoMeta.icon className="h-6 w-6" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-slate-800 truncate">{titulo}</h3>
                    <SemBadge estado={exp.estadoGlobal} />
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">{tipoMeta.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-sm text-slate-500">
                    {metaItems.map((m) => <span key={m.label}><span className="text-slate-400">{m.label}:</span> <span className="font-medium text-slate-600">{m.value}</span></span>)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <RadialPct pct={exp.pctTotal} />
                <div className="flex flex-col gap-2">
                  <Button size="sm" variant="outline" onClick={() => printExpediente({ ...detail, exp })}><Printer className="h-4 w-4 mr-1" />Imprimir</Button>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => openDetail(detail.tipo, sel.id)}>Ver ficha<ChevronRight className="h-4 w-4 ml-0.5" /></Button>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {Object.entries(DOC_CHIP).map(([k, v]) => (
                <div key={k} className={`rounded-lg ring-1 px-3 py-2 ${v.cls}`}>
                  <div className="text-xl font-bold tabular-nums">{exp.docSummary[k] || 0}</div>
                  <div className="text-[11px] font-medium">{v.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid lg:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Cumplimiento por mandante</p>
                <div className="space-y-2.5">
                  {exp.perMandante.length === 0 && <p className="text-sm text-slate-400">Sin asignaciones a mandantes</p>}
                  {exp.perMandante.map((m, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between text-sm mb-1 gap-2">
                        <span className="text-slate-700 truncate">{m.mandante} <span className="text-xs text-slate-400">· {m.contrato}</span></span>
                        <span className="font-semibold tabular-nums shrink-0" style={{ color: pctColor(m.pct) }}>{m.pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${m.pct}%`, background: pctColor(m.pct) }} /></div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{m.ok}/{m.total} obligatorios · {m.estado.replace('_', ' ').toLowerCase()}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Asignaciones ({detail.asignaciones.length})</p>
                <div className="rounded-lg border bg-white divide-y max-h-56 overflow-y-auto">
                  {detail.asignaciones.length === 0 && <p className="text-sm text-slate-400 px-3 py-3">Sin asignaciones</p>}
                  {detail.asignaciones.map((a) => (
                    <div key={a.asignacion_id || `${a.mandante}-${a.numero_oc}`} className="px-3 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0"><p className="text-sm text-slate-700 truncate">{a.mandante}</p><p className="text-xs text-slate-400 truncate">{a.numero_oc}{a.gerencia ? ` · ${a.gerencia}` : ''}</p></div>
                      <Badge className={`${a.estado === 'activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'} border-0 shrink-0`}>{a.estado}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Dashboard({ api, openDetail }) {
  const [empresas] = useData(api, '/empresas');
  const [mandantes] = useData(api, '/mandantes');
  const [fEmp, setFEmp] = useState('all');
  const [fMan, setFMan] = useState('all');
  const [data, setData] = useState(null);
  useEffect(() => {
    const qs = new URLSearchParams();
    if (fEmp !== 'all') qs.set('empresa_id', fEmp);
    if (fMan !== 'all') qs.set('mandante_id', fMan);
    setData(null);
    api(`/dashboard?${qs.toString()}`).then(setData).catch((e) => toast.error(e.message));
  }, [api, fEmp, fMan]);

  const s = data?.stats || {};
  const docsEstado = data?.docs_por_estado || [];
  const proximos = data?.proximos_vencimientos || [];
  const exportar = () => {
    const rows = Object.entries(data?.acreditacion_por_mandante || {}).map(([m, v]) => [m, v.ACREDITADO || 0, v.EN_REVISION || 0, v.BLOQUEADO || 0]);
    csvDownload('acreditacion_por_mandante.csv', ['Mandante', 'Acreditados', 'En revisión', 'Bloqueados'], rows);
  };

  return (
    <div>
      <PageHead title="Dashboard ejecutivo" sub="Estado en tiempo real del Holding Río Loa"
        action={<Button variant="outline" onClick={exportar} disabled={!data}><Download className="h-4 w-4 mr-1" />Exportar</Button>} />
      <Expediente api={api} openDetail={openDetail} />
      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={fEmp} onValueChange={setFEmp}><SelectTrigger className="w-56"><SelectValue placeholder="Empresa" /></SelectTrigger><SelectContent><SelectItem value="all">Todas las empresas</SelectItem>{(empresas?.empresas || []).map((e) => <SelectItem key={e.empresa_id} value={e.empresa_id}>{e.razon_social}</SelectItem>)}</SelectContent></Select>
        <Select value={fMan} onValueChange={setFMan}><SelectTrigger className="w-56"><SelectValue placeholder="Mandante" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los mandantes</SelectItem>{(mandantes?.mandantes || []).map((m) => <SelectItem key={m.mandante_id} value={m.mandante_id}>{m.razon_social}</SelectItem>)}</SelectContent></Select>
        {(fEmp !== 'all' || fMan !== 'all') && <Button variant="ghost" onClick={() => { setFEmp('all'); setFMan('all'); }}>Limpiar</Button>}
      </div>
      {!data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <Card key={i}><CardContent className="p-4 h-[76px] animate-pulse bg-slate-50" /></Card>)}</div>
          <div className="grid lg:grid-cols-2 gap-4">{Array.from({ length: 2 }).map((_, i) => <Card key={i}><CardContent className="h-[260px] animate-pulse bg-slate-50 m-2 rounded" /></Card>)}</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <KpiCard label="Mandantes activos" value={s.mandantes} icon={Building2} accent="blue" />
            <KpiCard label="Contratos vigentes" value={s.contratos_vigentes} icon={FileSignature} accent="indigo" />
            <KpiCard label="Trabajadores" value={s.trabajadores} icon={Users} accent="slate" />
            <KpiCard label="Acreditados" value={s.trabajadores_acreditados} icon={CheckCircle2} accent="emerald" />
            <KpiCard label="Bloqueados" value={s.trabajadores_bloqueados} icon={XCircle} accent="red" />
            <KpiCard label="Docs. por revisar" value={s.docs_pendientes} icon={FileClock} accent="amber" />
            <KpiCard label="Docs. por vencer (30d)" value={s.docs_por_vencer} icon={CalendarClock} accent="orange" />
            <KpiCard label="Docs. vencidos" value={s.docs_vencidos} icon={AlertTriangle} accent="red" />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <ChartCard title="Estado de acreditación" desc="Distribución de trabajadores">
              <DonutAcreditacion s={s} />
            </ChartCard>
            <ChartCard title="Documentos por estado" icon={BarChart3}>
              <DocsEstadoChart rows={docsEstado} />
            </ChartCard>
            <ChartCard title="Tendencia de vencimientos" desc="Documentos que vencen en los próximos 6 meses" icon={CalendarClock}>
              <TendenciaChart rows={data?.tendencia_vencimientos} />
            </ChartCard>
            <ChartCard title="Acreditación por mandante" desc="Trabajadores por estado" icon={Building2}>
              <MandanteStackedChart acr={data?.acreditacion_por_mandante} />
            </ChartCard>
            <ChartCard className="lg:col-span-2" title="Próximos vencimientos" desc="Documentos vencidos o por vencer (90 días), ordenados por urgencia" icon={FileClock}>
              <Table
                pageSize={10}
                empty="Sin vencimientos próximos"
                onRow={openDetail ? (r) => openDetail(r.recurso_tipo, r.recurso_id) : undefined}
                columns={[
                  { key: 'recurso', label: 'Recurso', render: (r) => <span className="font-medium text-slate-800">{r.recurso}</span> },
                  { key: 'tipo', label: 'Tipo', render: (r) => <Badge className="bg-slate-100 text-slate-600 border-0 capitalize">{r.recurso_tipo}</Badge> },
                  { key: 'documento', label: 'Documento' },
                  { key: 'mandante', label: 'Mandante' },
                  { key: 'fecha_vencimiento', label: 'Vence', render: (r) => fdate(r.fecha_vencimiento) },
                  { key: 'dias_restantes', label: 'Urgencia', render: (r) => <VencBadge dias={r.dias_restantes} /> },
                ]}
                rows={proximos}
              />
            </ChartCard>
          </div>
        </>
      )}
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

function DocViewerModal({ api, doc, onClose }) {
  const [state, setState] = useState({ loading: true, url: null, mime: null, nombre: null, error: null });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api(`/documentos/${doc.documento_id}/url`);
        if (alive) setState({ loading: false, url: r.url, mime: r.mime, nombre: r.nombre_archivo, error: null });
      } catch (e) {
        if (alive) setState({ loading: false, url: null, mime: null, nombre: null, error: e.message });
      }
    })();
    return () => { alive = false; };
  }, [doc, api]);
  const isImg = (state.mime || '').startsWith('image/');
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw]">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{doc.nombre}</DialogTitle>
          <DialogDescription className="truncate">{state.nombre || 'Documento cargado'}</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-slate-50 overflow-hidden" style={{ height: '70vh' }}>
          {state.loading && <div className="h-full flex items-center justify-center text-slate-400 text-sm">Cargando documento…</div>}
          {state.error && <div className="h-full flex items-center justify-center text-red-500 text-sm">{state.error}</div>}
          {!state.loading && !state.error && state.url && (
            isImg
              ? <div className="h-full w-full flex items-center justify-center overflow-auto bg-white"><img src={state.url} alt={doc.nombre} className="max-h-full max-w-full object-contain" /></div>
              : <iframe src={state.url} title={doc.nombre} className="w-full h-full" />
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          {state.url && <a href={state.url} target="_blank" rel="noreferrer"><Button variant="outline"><ExternalLink className="h-4 w-4 mr-1" />Abrir en pestaña</Button></a>}
          {state.url && <a href={state.url} download={state.nombre || true}><Button className="bg-blue-600 hover:bg-blue-700"><Download className="h-4 w-4 mr-1" />Descargar</Button></a>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FiniquitoViewerModal({ api, row, onClose }) {
  const [state, setState] = useState({ loading: true, url: null, error: null });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api(`/desvinculaciones/${row.desvinculacion_id}/url`);
        if (alive) setState({ loading: false, url: r.url, error: null });
      } catch (e) {
        if (alive) setState({ loading: false, url: null, error: e.message });
      }
    })();
    return () => { alive = false; };
  }, [row, api]);
  const isImg = (row.mime || '').startsWith('image/');
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw]">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{row.nombre}</DialogTitle>
          <DialogDescription className="truncate">{row.causal} · {row.nombre_archivo}</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-slate-50 overflow-hidden" style={{ height: '70vh' }}>
          {state.loading && <div className="h-full flex items-center justify-center text-slate-400 text-sm">Cargando documento…</div>}
          {state.error && <div className="h-full flex items-center justify-center text-red-500 text-sm">{state.error}</div>}
          {!state.loading && !state.error && state.url && (
            isImg
              ? <div className="h-full w-full flex items-center justify-center overflow-auto bg-white"><img src={state.url} alt={row.nombre} className="max-h-full max-w-full object-contain" /></div>
              : <iframe src={state.url} title={row.nombre} className="w-full h-full" />
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          {state.url && <a href={state.url} download={row.nombre_archivo || true}><Button className="bg-blue-600 hover:bg-blue-700"><Download className="h-4 w-4 mr-1" />Descargar</Button></a>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function DesvinculacionInfoModal({ asig, trabajador, onClose, onVerArchivo }) {
  const oc = (asig.desv_contrato || asig.numero_oc || '').replace(/^\s*(Contrato|OC|PO|N°)\s+/i, '');
  const filas = [
    ['Trabajador', trabajador],
    ['Empresa', asig.desv_empresa || '—'],
    ['Mandante', asig.desv_mandante || asig.mandante || '—'],
    ['Contrato', oc || '—'],
    ['Tipo', asig.desv_tipo === 'anexo_traslado' ? 'Anexo de traslado' : 'Finiquito'],
    ['Causal', asig.desv_causal || '—'],
    ['Fecha', asig.desv_fecha ? fdatetime(asig.desv_fecha) : '—'],
    ['Archivo', asig.desv_archivo || '—'],
  ];
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detalle de la desvinculación</DialogTitle>
          <DialogDescription>Información registrada al momento del finiquito.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filas.map(([k, v]) => (
            <div key={k} className={k === 'Causal' || k === 'Archivo' ? 'sm:col-span-2' : ''}>
              <p className="text-xs text-slate-400">{k}</p>
              <p className="text-sm text-slate-800 break-words">{v}</p>
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          {asig.desvinculacion_id && <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onVerArchivo}><Eye className="h-4 w-4 mr-1" />Ver documento</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function DocsPorCategoria({ detalle, canManage, onCargar, api }) {
  const grupos = {};
  const orden = [];
  (detalle || []).forEach((d) => {
    const k = d.categoria || 'Sin categoría';
    if (!grupos[k]) { grupos[k] = []; orden.push(k); }
    grupos[k].push(d);
  });
  const [abiertas, setAbiertas] = useState({});
  const [verDoc, setVerDoc] = useState(null);
  const toggle = (cat) => setAbiertas((s) => ({ ...s, [cat]: !s[cat] }));
  const puedeVer = (d) => !!d.documento_id && ['aprobado', 'en_revision', 'vencido', 'rechazado', 'pendiente'].includes(d.estado);
  return (
    <div className="space-y-2">
      {orden.map((cat) => {
        const items = grupos[cat];
        const ok = items.filter((x) => x.estado === 'aprobado').length;
        const falta = items.some((x) => x.obligatorio && ['faltante', 'vencido', 'rechazado'].includes(x.estado));
        const open = !!abiertas[cat];
        const accent = falta ? 'border-l-red-400' : ok === items.length ? 'border-l-emerald-400' : 'border-l-amber-400';
        return (
          <div key={cat} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <button onClick={() => toggle(cat)} className={`w-full flex items-center justify-between px-3 py-2.5 text-left bg-slate-100 hover:bg-slate-200/70 border-l-4 ${accent} transition-colors`}>
              <div className="flex items-center gap-2 min-w-0">
                <ChevronRight className={`h-4 w-4 text-slate-500 transition-transform ${open ? 'rotate-90' : ''}`} />
                <span className="text-xs font-bold uppercase tracking-wide text-slate-700 truncate">{cat}</span>
                <span className={`h-2 w-2 rounded-full ${falta ? 'bg-red-400' : ok === items.length ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              </div>
              <span className="text-[11px] font-medium text-slate-500 shrink-0">{ok}/{items.length}</span>
            </button>
            {open && (
              <div className="divide-y border-t bg-white">
                {items.map((d) => (
                  <div key={d.requisito_id} className="flex items-center justify-between py-2 px-3 gap-2">
                    <div className="flex items-center gap-2 min-w-0"><span className="text-sm text-slate-700 truncate">{d.nombre}</span>{d.obligatorio && <span className="text-[10px] text-blue-600 border border-blue-200 rounded px-1">Oblig.</span>}</div>
                    <div className="flex items-center gap-2">
                      {d.fecha_vencimiento && <span className="text-xs text-slate-400">vence {fdate(d.fecha_vencimiento)}</span>}
                      <Badge className={`${docEstado[d.estado] || ''} border-0`}>{d.estado}</Badge>
                      {puedeVer(d) && api && <Button size="sm" variant="outline" className="h-7" onClick={() => setVerDoc(d)}><Eye className="h-3.5 w-3.5 mr-1" />Ver</Button>}
                      {canManage && <Button size="sm" variant="outline" className="h-7" onClick={() => onCargar(d)}><Upload className="h-3.5 w-3.5 mr-1" />Cargar</Button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {verDoc && <DocViewerModal api={api} doc={verDoc} onClose={() => setVerDoc(null)} />}
    </div>
  );
}

function SiNo({ on }) {
  return on
    ? <span className="inline-block px-3 py-1 rounded text-xs font-medium bg-emerald-400 text-white">SI</span>
    : <span className="inline-block px-3 py-1 rounded text-xs font-medium bg-[#a97e6f] text-white">NO</span>;
}

function CascadeDelete({ api, tipo, id, nombre, onDone, className }) {
  const [open, setOpen] = useState(false);
  const [deps, setDeps] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const openDlg = async () => {
    setOpen(true); setDeps(null); setLoading(true);
    try { setDeps(await api(`/${tipo}/${id}/dependencias`)); } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  const confirm = async () => {
    setBusy(true);
    try { await api(`/${tipo}/${id}`, { method: 'DELETE' }); toast.success('Eliminado correctamente'); setOpen(false); onDone && onDone(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <>
      <Button variant="outline" className={`text-red-600 border-red-200 hover:bg-red-50 ${className || ''}`} onClick={openDlg}><Trash2 className="h-4 w-4 mr-1" />Eliminar</Button>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="h-5 w-5" />Eliminar definitivamente</DialogTitle>
          <DialogDescription>Vas a eliminar <strong className="text-slate-700">{nombre}</strong>. Esta acción es permanente y no se puede deshacer.</DialogDescription></DialogHeader>
        <div className="text-sm">
          {loading && <p className="text-slate-400">Calculando dependencias…</p>}
          {!loading && deps && (deps.total > 0 ? (
            <div className="rounded-lg border border-red-100 bg-red-50 p-3">
              <p className="font-medium text-red-700 mb-2">También se eliminarán en cascada:</p>
              <ul className="space-y-1">{deps.items.map((it, k) => <li key={k} className="flex justify-between gap-4"><span className="text-slate-600">{it.label}</span><span className="font-semibold text-red-600">{it.count}</span></li>)}</ul>
            </div>
          ) : <p className="text-slate-500">No tiene datos asociados. Se eliminará solo el registro.</p>)}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button className="bg-red-600 hover:bg-red-700" disabled={busy || loading} onClick={confirm}>{busy ? 'Eliminando…' : 'Sí, eliminar todo'}</Button></DialogFooter>
      </DialogContent></Dialog>
    </>
  );
}

function EstandarDocumental({ id, api, categorias, requisitos, canManage, reload, mandante }) {
  const [catOpen, setCatOpen] = useState(false);
  const [cf, setCf] = useState({ categoria_id: null, nombre: '', descripcion: '' });
  const [reqOpen, setReqOpen] = useState(false);
  const [q, setQ] = useState('');
  const [selCat, setSelCat] = useState(null);
  const [tipoRec, setTipoRec] = useState('trabajador');
  const [rf, setRf] = useState({ requisito_id: null, nombre: '', descripcion: '', obligatorio: true, tiene_vencimiento: true, transversal: false, dias_alerta: 30 });

  const fmt = (d) => fdateCL(d);

  const openNewCat = () => { setCf({ categoria_id: null, nombre: '', descripcion: '' }); setCatOpen(true); };
  const openEditCat = (c) => { setCf({ categoria_id: c.categoria_id, nombre: c.nombre, descripcion: c.descripcion || '' }); setCatOpen(true); };
  const saveCat = async () => {
    if (!cf.nombre) return;
    try {
      if (cf.categoria_id) { await api(`/categorias/${cf.categoria_id}`, { method: 'PUT', body: JSON.stringify({ nombre: cf.nombre, descripcion: cf.descripcion }) }); toast.success('Categoría actualizada'); }
      else { await api('/categorias', { method: 'POST', body: JSON.stringify({ mandante_id: id, tipo_recurso: tipoRec, nombre: cf.nombre, descripcion: cf.descripcion || cf.nombre }) }); toast.success('Categoría creada'); }
      setCatOpen(false); reload();
    } catch (e) { toast.error(e.message); }
  };
  const delCat = async (cid) => { try { await api(`/categorias/${cid}`, { method: 'DELETE' }); toast.success('Categoría eliminada'); reload(); } catch (e) { toast.error(e.message); } };

  const openNewReq = () => { setRf({ requisito_id: null, nombre: '', descripcion: '', obligatorio: true, tiene_vencimiento: true, transversal: false, dias_alerta: 30 }); setReqOpen(true); };
  const openEditReq = (r) => { setRf({ requisito_id: r.requisito_id, nombre: r.nombre, descripcion: r.descripcion || '', obligatorio: r.obligatorio, tiene_vencimiento: r.tiene_vencimiento, transversal: r.transversal, dias_alerta: r.dias_alerta || 30 }); setReqOpen(true); };
  const saveReq = async () => {
    try {
      const payload = { nombre: rf.nombre, descripcion: rf.descripcion, obligatorio: rf.obligatorio, tiene_vencimiento: rf.tiene_vencimiento, transversal: rf.transversal, dias_alerta: Number(rf.dias_alerta) };
      if (rf.requisito_id) { await api(`/requisitos/${rf.requisito_id}`, { method: 'PUT', body: JSON.stringify(payload) }); toast.success('Documento actualizado'); }
      else { await api('/requisitos', { method: 'POST', body: JSON.stringify({ ...payload, mandante_id: id, tipo_recurso: tipoRec, categoria_id: selCat.categoria_id }) }); toast.success('Documento agregado'); }
      setReqOpen(false); reload();
    } catch (e) { toast.error(e.message); }
  };
  const delReq = async (rid) => { try { await api(`/requisitos/${rid}`, { method: 'DELETE' }); toast.success('Documento eliminado'); reload(); } catch (e) { toast.error(e.message); } };

  // Level 2: documents of a selected category
  if (selCat) {
    const docs = (requisitos || []).filter((r) => r.categoria_id === selCat.categoria_id)
      .filter((r) => !q || r.nombre?.toLowerCase().includes(q.toLowerCase()) || (r.descripcion || '').toLowerCase().includes(q.toLowerCase()));
    return (
      <div>
        <button onClick={() => { setSelCat(null); setQ(''); }} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mb-4"><ChevronRight className="h-4 w-4 rotate-180" />Volver a categorías</button>
        <div className="mb-5 rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-4 shadow-sm flex items-center gap-3 max-w-2xl">
          <div className="h-10 w-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center"><FileClock className="h-5 w-5" /></div>
          <div>
            <p className="text-base font-semibold text-slate-800">{selCat.nombre}</p>
            {selCat.descripcion && <p className="text-sm text-slate-500">{selCat.descripcion}</p>}
          </div>
        </div>
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <Input className="h-10 w-72 rounded-lg" placeholder="Buscar documento…" value={q} onChange={(e) => setQ(e.target.value)} />
          {canManage && <Button className="bg-emerald-500 hover:bg-emerald-600 rounded-lg shadow-sm" onClick={openNewReq}><Plus className="h-4 w-4 mr-1" />Agregar</Button>}
        </div>
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <Table columns={[
          { key: 'nombre', label: 'Nombre', render: (r) => <span className="font-medium">{r.nombre}</span> },
          { key: 'descripcion', label: 'Descripción', render: (r) => r.descripcion || '—' },
          { key: 'obligatorio', label: 'Requerido', render: (r) => <SiNo on={r.obligatorio} /> },
          { key: 'tiene_vencimiento', label: 'Indefinido', render: (r) => <SiNo on={!r.tiene_vencimiento} /> },
          { key: 'transversal', label: 'Transversal', render: (r) => <SiNo on={r.transversal} /> },
          { key: 'x', label: 'Acción', render: (r) => canManage ? (
            <div className="flex gap-1">
              <Button size="sm" className="h-7 bg-amber-400 hover:bg-amber-500 text-white" onClick={() => openEditReq(r)}>Editar</Button>
              <Button size="sm" variant="ghost" className="text-red-500 h-7" onClick={() => delReq(r.requisito_id)}>Eliminar</Button>
            </div>
          ) : null },
        ]} rows={docs} empty="Sin documentos en esta categoría" />
        </div>

        <Dialog open={reqOpen} onOpenChange={setReqOpen}><DialogContent>
          <DialogHeader><DialogTitle>{rf.requisito_id ? 'Editar documento' : 'Agregar documento'}</DialogTitle><DialogDescription>Categoría: {selCat.nombre}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nombre</Label><Input value={rf.nombre} onChange={(e) => setRf({ ...rf, nombre: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Descripción</Label><Input value={rf.descripcion} onChange={(e) => setRf({ ...rf, descripcion: e.target.value })} /></div>
            <div className="flex gap-6 flex-wrap">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rf.obligatorio} onChange={(e) => setRf({ ...rf, obligatorio: e.target.checked })} />Requerido</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!rf.tiene_vencimiento} onChange={(e) => setRf({ ...rf, tiene_vencimiento: !e.target.checked })} />Indefinido</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rf.transversal} onChange={(e) => setRf({ ...rf, transversal: e.target.checked })} />Transversal</label>
            </div>
            {rf.tiene_vencimiento && <div className="space-y-1.5"><Label>Días de alerta antes de vencer</Label><Input type="number" value={rf.dias_alerta} onChange={(e) => setRf({ ...rf, dias_alerta: e.target.value })} /></div>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setReqOpen(false)}>Cancelar</Button><Button className="bg-emerald-500 hover:bg-emerald-600" onClick={saveReq}>{rf.requisito_id ? 'Guardar' : 'Agregar'}</Button></DialogFooter>
        </DialogContent></Dialog>
      </div>
    );
  }

  // Level 1: categories list
  const cats = (categorias || []).filter((c) => (c.tipo_recurso || 'trabajador') === tipoRec).filter((c) => !q || c.nombre?.toLowerCase().includes(q.toLowerCase()) || (c.descripcion || '').toLowerCase().includes(q.toLowerCase()));
  const TIPOS = [['trabajador', 'Trabajadores'], ['vehiculo', 'Vehículos'], ['equipo', 'Equipos'], ['contrato', 'Contratos']];
  return (
    <div>
      <div className="inline-flex rounded-lg border bg-slate-100 p-1 mb-4">
        {TIPOS.map(([val, label]) => (
          <button key={val} onClick={() => { setTipoRec(val); setSelCat(null); setQ(''); }}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${tipoRec === val ? 'bg-white shadow-sm font-semibold text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>{label}</button>
        ))}
      </div>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <Input className="h-9 w-64" placeholder="Buscar categoría…" value={q} onChange={(e) => setQ(e.target.value)} />
        {canManage && <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={openNewCat}><Plus className="h-4 w-4 mr-1" />Agregar Categoría</Button>}
      </div>
      <Table columns={[
        { key: 'nombre', label: 'Nombre', render: (r) => <span className="font-medium">{r.nombre}</span> },
        { key: 'descripcion', label: 'Descripción', render: (r) => r.descripcion || '—' },
        { key: 'docs_count', label: 'Documentos', render: (r) => <Badge variant="secondary">{r.docs_count || 0}</Badge> },
        { key: 'created_at', label: 'Fecha Registro', render: (r) => fmt(r.created_at) },
        { key: 'x', label: 'Acción', render: (r) => (
          <div className="flex gap-2">
            <Button size="sm" className="h-7 bg-blue-500 hover:bg-blue-600" onClick={() => { setSelCat(r); setQ(''); }}>Definir Documentos</Button>
            {canManage && <Button size="sm" className="h-7 bg-amber-400 hover:bg-amber-500 text-white" onClick={() => openEditCat(r)}>Editar</Button>}
            {canManage && <Button size="sm" variant="ghost" className="text-red-500 h-7" onClick={() => delCat(r.categoria_id)}>Eliminar</Button>}
          </div>
        ) },
      ]} rows={cats} empty="Sin categorías configuradas" />

      <Dialog open={catOpen} onOpenChange={setCatOpen}><DialogContent>
        <DialogHeader><DialogTitle>{cf.categoria_id ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle><DialogDescription>Estándar documental de {mandante.razon_social}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Nombre</Label><Input value={cf.nombre} onChange={(e) => setCf({ ...cf, nombre: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Descripción</Label><Input value={cf.descripcion} onChange={(e) => setCf({ ...cf, descripcion: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setCatOpen(false)}>Cancelar</Button><Button className="bg-emerald-500 hover:bg-emerald-600" onClick={saveCat}>{cf.categoria_id ? 'Guardar' : 'Crear'}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}

function MandanteDetail({ api, id, onBack, openDetail, canManage, isSuper }) {
  const [data, reload] = useData(api, `/mandantes/${id}`, [id]);
  const [allEmp] = useData(api, '/empresas');
  const [edit, setEdit] = useState(false);
  const [ef, setEf] = useState({});
  const [addEmp, setAddEmp] = useState('');
  const [newGer, setNewGer] = useState('');
  if (!data) return <p className="text-slate-400">Cargando…</p>;
  const { mandante, empresas, gerencias, contratos, requisitos, categorias, trabajadores } = data;
  const noAsoc = (allEmp?.empresas || []).filter((e) => !empresas.some((x) => x.empresa_id === e.empresa_id));

  const openEdit = () => { setEf({ razon_social: mandante.razon_social, rut: mandante.rut, region: mandante.region, comuna: mandante.comuna, direccion: mandante.direccion }); setEdit(true); };
  const saveEdit = async () => { try { await api(`/mandantes/${id}`, { method: 'PUT', body: JSON.stringify(ef) }); toast.success('Mandante actualizado'); setEdit(false); reload(); } catch (e) { toast.error(e.message); } };
  const toggleActivo = async () => { try { await api(`/mandantes/${id}`, { method: 'PUT', body: JSON.stringify({ activo: !mandante.activo }) }); toast.success(mandante.activo ? 'Mandante desactivado' : 'Mandante activado'); reload(); } catch (e) { toast.error(e.message); } };
  const linkEmp = async () => { if (!addEmp) return; try { await api('/mandantes/empresas', { method: 'POST', body: JSON.stringify({ mandante_id: id, empresa_id: addEmp }) }); toast.success('Empresa habilitada'); setAddEmp(''); reload(); } catch (e) { toast.error(e.message); } };
  const unlinkEmp = async (eid) => { try { await api(`/mandantes/${id}/empresas/${eid}`, { method: 'DELETE' }); toast.success('Empresa deshabilitada'); reload(); } catch (e) { toast.error(e.message); } };
  const addGer = async () => { if (!newGer) return; try { await api('/mandantes/gerencias', { method: 'POST', body: JSON.stringify({ mandante_id: id, nombre: newGer }) }); setNewGer(''); reload(); } catch (e) { toast.error(e.message); } };

  return (
    <div>
      <button onClick={onBack} className="text-sm text-blue-600 mb-3">← Volver a Mandantes</button>
      <DetailHeader
        icon={<Building2 className="h-7 w-7" />}
        title={mandante.razon_social}
        meta={[{ label: 'RUT', value: mandante.rut }, { label: 'Ubicación', value: [mandante.comuna, mandante.region].filter(Boolean).join(', ') || '—' }]}
        badge={<Badge className={mandante.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}>{mandante.activo ? 'Activo' : 'Inactivo'}</Badge>}
        actions={canManage && <><Button variant="outline" onClick={openEdit}>Editar</Button><Button variant="outline" className={mandante.activo ? 'text-red-600 border-red-200' : 'text-emerald-600 border-emerald-200'} onClick={toggleActivo}>{mandante.activo ? 'Desactivar' : 'Activar'}</Button>{isSuper && <CascadeDelete api={api} tipo="mandantes" id={id} nombre={mandante.razon_social} onDone={onBack} />}</>}
      />
      <Tabs defaultValue="resumen">
        <TabsList className="flex flex-wrap h-auto gap-0 bg-transparent p-0 mb-6 border-b border-slate-200 rounded-none w-full justify-start">{['resumen','empresas','gerencias','contratos','trabajadores','estandar'].map((v) => <TabsTrigger key={v} value={v} className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-slate-500 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:text-slate-700">{{resumen:'Resumen',empresas:'Empresas',gerencias:'Gerencias',contratos:'Contratos',trabajadores:'Trabajadores',estandar:'Estándar Documental'}[v]}</TabsTrigger>)}</TabsList>
        <TabsContent value="resumen"><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label="Empresas Holding" value={empresas.length} icon={Building} color="bg-blue-50 text-blue-600" />
          <Kpi label="Contratos" value={contratos.length} icon={FileSignature} color="bg-indigo-50 text-indigo-600" />
          <Kpi label="Trabajadores" value={trabajadores.length} icon={Users} color="bg-slate-100 text-slate-600" />
          <Kpi label="Requisitos doc." value={requisitos.length} icon={ShieldCheck} color="bg-emerald-50 text-emerald-600" />
        </div></TabsContent>
        <TabsContent value="empresas">
          {canManage && <div className="flex gap-2 mb-3 max-w-md"><Select value={addEmp} onValueChange={setAddEmp}><SelectTrigger><SelectValue placeholder="Habilitar empresa del Holding…" /></SelectTrigger><SelectContent>{noAsoc.map((e) => <SelectItem key={e.empresa_id} value={e.empresa_id}>{e.razon_social}</SelectItem>)}</SelectContent></Select><Button className="bg-blue-600 hover:bg-blue-700" onClick={linkEmp}>Agregar</Button></div>}
          <Table columns={[{ key: 'razon_social', label: 'Empresa del Holding' }, { key: 'rut', label: 'RUT' }, { key: 'comuna', label: 'Comuna' }, { key: 'x', label: '', render: (r) => canManage ? <Button size="sm" variant="ghost" className="text-red-500 h-7" onClick={() => unlinkEmp(r.empresa_id)}>Quitar</Button> : null }]} rows={empresas} empty="Sin empresas habilitadas" />
        </TabsContent>
        <TabsContent value="gerencias">
          {canManage && <div className="flex gap-2 mb-3 max-w-md"><Input placeholder="Nueva gerencia…" value={newGer} onChange={(e) => setNewGer(e.target.value)} /><Button className="bg-blue-600 hover:bg-blue-700" onClick={addGer}>Agregar</Button></div>}
          <Table columns={[{ key: 'nombre', label: 'Gerencia' }, { key: 'activo', label: 'Estado', render: (r) => <Badge className="bg-emerald-100 text-emerald-700">{r.activo ? 'Activa' : 'Inactiva'}</Badge> }]} rows={gerencias} empty="Sin gerencias" />
        </TabsContent>
        <TabsContent value="contratos"><Table onRow={(r) => openDetail('contrato', r.contrato_id)} columns={[
          { key: 'numero_oc', label: 'N° OC', render: (r) => <span className="font-medium">{r.numero_oc}</span> }, { key: 'empresa', label: 'Empresa' },
          { key: 'dotacion', label: 'Dotación', render: (r) => `${r.dotacion} / ${r.limite_contingente}` },
          { key: 'estado', label: 'Estado', render: (r) => <Badge className="bg-emerald-100 text-emerald-700">{r.estado}</Badge> },
        ]} rows={contratos} /></TabsContent>
        <TabsContent value="trabajadores"><Table onRow={(r) => openDetail('trabajador', r.trabajador_id)} columns={[{ key: 'nombre', label: 'Nombre', render: (r) => `${r.nombre} ${r.apellido}` }, { key: 'rut', label: 'RUT' }, { key: 'cargo', label: 'Cargo' }]} rows={trabajadores} /></TabsContent>
        <TabsContent value="estandar">
          <EstandarDocumental id={id} api={api} categorias={categorias} requisitos={requisitos} canManage={canManage} reload={reload} mandante={mandante} />
        </TabsContent>
      </Tabs>

      <Dialog open={edit} onOpenChange={setEdit}><DialogContent>
        <DialogHeader><DialogTitle>Editar mandante</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Razón social</Label><Input value={ef.razon_social || ''} onChange={(e) => setEf({ ...ef, razon_social: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>RUT</Label><Input value={ef.rut || ''} onChange={(e) => setEf({ ...ef, rut: e.target.value })} /></div><div className="space-y-1.5"><Label>Región</Label><Input value={ef.region || ''} onChange={(e) => setEf({ ...ef, region: e.target.value })} /></div></div>
          <div className="space-y-1.5"><Label>Comuna</Label><Input value={ef.comuna || ''} onChange={(e) => setEf({ ...ef, comuna: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setEdit(false)}>Cancelar</Button><Button className="bg-blue-600 hover:bg-blue-700" onClick={saveEdit}>Guardar</Button></DialogFooter>
      </DialogContent></Dialog>
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
function ContratoDetail({ api, id, onBack, canManage, isSuper, openDetail }) {
  const [data, reload] = useData(api, `/contratos/${id}`, [id]);
  const [trabajadores] = useData(api, '/trabajadores');
  const [edit, setEdit] = useState(false);
  const [ef, setEf] = useState({});
  const [asignOpen, setAsignOpen] = useState(false);
  const [asig, setAsig] = useState('');
  const [crearOpen, setCrearOpen] = useState(false);
  const [upload, setUpload] = useState(null);
  const [nf, setNf] = useState({ rut: '', nombre: '', apellido: '', cargo: '', genero: '', telefono: '', region: '', comuna: '' });
  if (!data) return <p className="text-slate-400">Cargando…</p>;
  const c = data.contrato; const pct = c.limite_contingente ? Math.min(100, (c.dotacion / c.limite_contingente) * 100) : 0;
  const dias = c.fecha_termino ? Math.round((new Date(c.fecha_termino) - new Date()) / 86400000) : null;
  const asignadosIds = new Set((data.trabajadores || []).map((t) => t.trabajador_id));
  const disponibles = (trabajadores?.trabajadores || []).filter((t) => t.empresa_id === c.empresa_id && !asignadosIds.has(t.trabajador_id));
  const openEdit = () => { setEf({ numero_oc: c.numero_oc, limite_contingente: c.limite_contingente, estado: c.estado, observaciones: c.observaciones || '', fecha_inicio: c.fecha_inicio?.slice(0, 10) || '', fecha_termino: c.fecha_termino?.slice(0, 10) || '' }); setEdit(true); };
  const save = async () => { try { await api(`/contratos/${id}`, { method: 'PUT', body: JSON.stringify({ ...ef, limite_contingente: Number(ef.limite_contingente) }) }); toast.success('Contrato actualizado'); setEdit(false); reload(); } catch (e) { toast.error(e.message); } };
  const doAsignar = async () => { if (!asig) return; try { await api('/trabajadores/asignar', { method: 'POST', body: JSON.stringify({ trabajador_id: asig, contrato_id: id }) }); toast.success('Trabajador asignado'); setAsignOpen(false); setAsig(''); reload(); } catch (e) { toast.error(e.message); } };
  const doCrear = async () => {
    if (!nf.rut || !nf.nombre || !nf.apellido) { toast.error('RUT, nombre y apellido son obligatorios'); return; }
    try {
      const res = await api('/trabajadores', { method: 'POST', body: JSON.stringify({ ...nf, empresa_id: c.empresa_id }) });
      const tid = res.trabajador?.trabajador_id;
      if (tid) await api('/trabajadores/asignar', { method: 'POST', body: JSON.stringify({ trabajador_id: tid, contrato_id: id }) });
      toast.success('Trabajador creado y asignado'); setCrearOpen(false); setNf({ rut: '', nombre: '', apellido: '', cargo: '', genero: '', telefono: '', region: '', comuna: '' }); reload();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <div>
      <button onClick={onBack} className="text-sm text-blue-600 mb-3">← Volver</button>
      <DetailHeader
        icon={<FileSignature className="h-7 w-7" />}
        title={`Contrato ${c.numero_oc}`}
        meta={[{ label: 'Mandante', value: c.mandante }, { label: 'Empresa', value: c.empresa }]}
        badge={<Badge className="bg-emerald-100 text-emerald-700">{c.estado}</Badge>}
        actions={canManage && <><Button variant="outline" onClick={openEdit}>Editar</Button>{isSuper && <CascadeDelete api={api} tipo="contratos" id={id} nombre={`Contrato ${c.numero_oc}`} onDone={onBack} />}</>}
      />
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-2"><CardContent className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div><p className="text-slate-400">Gerencia</p><p className="font-medium">{c.gerencia || '—'}</p></div>
            <div><p className="text-slate-400">Inicio</p><p className="font-medium">{fdate(c.fecha_inicio)}</p></div>
            <div><p className="text-slate-400">Término</p><p className="font-medium">{fdate(c.fecha_termino)}</p></div>
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
      <Card className="mb-4"><CardHeader className="pb-2"><div className="flex items-center justify-between gap-2 flex-wrap">
        <div><CardTitle className="text-base flex items-center gap-2"><FileClock className="h-4 w-4 text-slate-400" />Documentos del contrato</CardTitle><CardDescription>Estándar documental del contrato · {c.mandante}</CardDescription></div>
        {data.documentacion && (data.documentacion.docs_total > 0 || (data.documentacion.detalle || []).length > 0) && <div className="flex items-center gap-2"><span className="text-xs text-slate-500">{data.documentacion.docs_ok}/{data.documentacion.docs_total} obligatorios</span><Badge className={`border-0 ${data.documentacion.estado === 'ACREDITADO' ? 'bg-emerald-100 text-emerald-700' : data.documentacion.estado === 'EN_REVISION' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{data.documentacion.estado === 'ACREDITADO' ? 'Al día' : data.documentacion.estado === 'EN_REVISION' ? 'En revisión' : 'Pendiente'}</Badge></div>}
      </div></CardHeader><CardContent>
        {(data.documentacion?.detalle || []).length === 0
          ? <p className="text-sm text-slate-400">No hay estándar documental configurado para contratos de este mandante. Configúralo en el mandante → Estándar Documental → Contratos.</p>
          : <DocsPorCategoria detalle={data.documentacion.detalle} canManage={canManage} api={api} onCargar={(d) => setUpload({ requisito: d })} />}
      </CardContent></Card>
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <h3 className="font-semibold text-slate-700">Trabajadores asignados</h3>
        {canManage && <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setAsignOpen(true)}><Plus className="h-4 w-4 mr-1" />Asignar trabajador</Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => setCrearOpen(true)}><Plus className="h-4 w-4 mr-1" />Crear trabajador</Button>
        </div>}
      </div>
      <Table columns={[{ key: 'nombre', label: 'Nombre', render: (r) => `${r.nombre} ${r.apellido}` }, { key: 'rut', label: 'RUT' }, { key: 'cargo', label: 'Cargo' }]} rows={data.trabajadores} onRow={(r) => openDetail && openDetail('trabajador', r.trabajador_id)} />

      <Dialog open={asignOpen} onOpenChange={setAsignOpen}><DialogContent>
        <DialogHeader><DialogTitle>Asignar trabajador al contrato</DialogTitle><DialogDescription>Solo trabajadores de {c.empresa}. Un trabajador puede estar en varios contratos.</DialogDescription></DialogHeader>        <div className="space-y-1.5"><Label>Trabajador</Label>
          <Select value={asig} onValueChange={setAsig}><SelectTrigger><SelectValue placeholder="Selecciona un trabajador…" /></SelectTrigger>
            <SelectContent>{disponibles.length === 0 ? <div className="px-3 py-2 text-sm text-slate-400">No hay trabajadores disponibles de esta empresa</div> : disponibles.map((t) => <SelectItem key={t.trabajador_id} value={t.trabajador_id}>{t.nombre} {t.apellido} · {t.rut}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setAsignOpen(false)}>Cancelar</Button><Button className="bg-blue-600 hover:bg-blue-700" disabled={!asig} onClick={doAsignar}>Asignar</Button></DialogFooter>
      </DialogContent></Dialog>

      <Dialog open={crearOpen} onOpenChange={setCrearOpen}><DialogContent>
        <DialogHeader><DialogTitle>Crear trabajador y asignar</DialogTitle><DialogDescription>Se creará en {c.empresa} y se asignará a este contrato.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>RUT</Label><Input value={nf.rut} onChange={(e) => setNf({ ...nf, rut: e.target.value })} className={nf.rut && !validarRut(nf.rut) ? 'border-red-400' : ''} />{nf.rut && !validarRut(nf.rut) && <p className="text-xs text-red-500">RUT inválido</p>}</div><div className="space-y-1.5"><Label>Cargo</Label><Input value={nf.cargo} onChange={(e) => setNf({ ...nf, cargo: e.target.value })} /></div></div>
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Nombre</Label><Input value={nf.nombre} onChange={(e) => setNf({ ...nf, nombre: e.target.value })} /></div><div className="space-y-1.5"><Label>Apellido</Label><Input value={nf.apellido} onChange={(e) => setNf({ ...nf, apellido: e.target.value })} /></div></div>
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Teléfono</Label><Input value={nf.telefono} onChange={(e) => setNf({ ...nf, telefono: e.target.value })} /></div><div className="space-y-1.5"><Label>Comuna</Label><Input value={nf.comuna} onChange={(e) => setNf({ ...nf, comuna: e.target.value })} /></div></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setCrearOpen(false)}>Cancelar</Button><Button className="bg-blue-600 hover:bg-blue-700" disabled={!validarRut(nf.rut)} onClick={doCrear}>Crear y asignar</Button></DialogFooter>
      </DialogContent></Dialog>
      <Dialog open={edit} onOpenChange={setEdit}><DialogContent>
        <DialogHeader><DialogTitle>Editar contrato</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>N° OC</Label><Input value={ef.numero_oc || ''} onChange={(e) => setEf({ ...ef, numero_oc: e.target.value })} /></div><div className="space-y-1.5"><Label>Límite contingente</Label><Input type="number" value={ef.limite_contingente || 0} onChange={(e) => setEf({ ...ef, limite_contingente: e.target.value })} /></div></div>
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Inicio</Label><Input type="date" value={ef.fecha_inicio || ''} onChange={(e) => setEf({ ...ef, fecha_inicio: e.target.value })} /></div><div className="space-y-1.5"><Label>Término</Label><Input type="date" value={ef.fecha_termino || ''} onChange={(e) => setEf({ ...ef, fecha_termino: e.target.value })} /></div></div>
          <div className="space-y-1.5"><Label>Estado</Label><Select value={ef.estado} onValueChange={(v) => setEf({ ...ef, estado: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pendiente">Pendiente</SelectItem><SelectItem value="vigente">Vigente</SelectItem><SelectItem value="finalizado">Finalizado</SelectItem><SelectItem value="suspendido">Suspendido</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Observaciones</Label><Textarea value={ef.observaciones || ''} onChange={(e) => setEf({ ...ef, observaciones: e.target.value })} rows={2} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setEdit(false)}>Cancelar</Button><Button className="bg-blue-600 hover:bg-blue-700" onClick={save}>Guardar</Button></DialogFooter>
      </DialogContent></Dialog>
      {upload && <UploadDialog api={api} recurso_tipo="contrato" recurso_id={id} requisito={upload.requisito} mandante_id={c.mandante_id} onClose={() => setUpload(null)} onDone={() => { setUpload(null); reload(); }} />}
    </div>
  );
}

/* ------------ Trabajadores ------------ */
function Trabajadores({ api, openDetail, canManage, isSuper }) {
  const [q, setQ] = useState('');
  const [empresas] = useData(api, '/empresas');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ empresa_id: '', rut: '', nombre: '', apellido: '', cargo: '', telefono: '' });
  const [rows, setRows] = useState(null);
  const fetchList = useCallback(async (query) => {
    try { const d = await api(`/trabajadores${query && query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`); setRows(d.trabajadores || []); } catch (e) { toast.error(e.message); }
  }, [api]);
  useEffect(() => { const t = setTimeout(() => fetchList(q), 300); return () => clearTimeout(t); }, [q, fetchList]);
  const save = async () => { try { await api('/trabajadores', { method: 'POST', body: JSON.stringify(f) }); toast.success('Trabajador creado'); setOpen(false); setF({ empresa_id: '', rut: '', nombre: '', apellido: '', cargo: '', telefono: '' }); fetchList(q); } catch (e) { toast.error(e.message); } };
  return (
    <div>
      <PageHead title="Trabajadores" sub="Ficha única por trabajador (una empresa del Holding)" action={canManage && <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nuevo trabajador</Button>} />
      <div className="mb-3 max-w-md"><div className="relative"><Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" /><Input className="pl-9" placeholder="Buscar por nombre, RUT, cargo…" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
      <Table onRow={(r) => openDetail('trabajador', r.trabajador_id)} columns={[
        { key: 'nombre', label: 'Nombre', render: (r) => <span className="font-medium text-slate-800">{r.nombre} {r.apellido}</span> },
        { key: 'rut', label: 'RUT' }, { key: 'cargo', label: 'Cargo' }, { key: 'empresa', label: 'Empresa Holding' },
        { key: 'estado', label: 'Estado', render: (r) => r.vinculado ? <Badge className="bg-emerald-100 text-emerald-700">activo</Badge> : <Badge className="bg-slate-100 text-slate-500">inactivo</Badge> },
        { key: 'x', label: '', render: () => <ChevronRight className="h-4 w-4 text-slate-300" /> },
      ]} rows={rows} />
      <Dialog open={open} onOpenChange={setOpen}><DialogContent>
        <DialogHeader><DialogTitle>Nuevo trabajador</DialogTitle><DialogDescription>Pertenece a una única empresa del Holding.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          {isSuper && <div className="space-y-1.5"><Label>Empresa del Holding</Label><Select value={f.empresa_id} onValueChange={(v) => setF({ ...f, empresa_id: v })}><SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger><SelectContent>{(empresas?.empresas || []).map((e) => <SelectItem key={e.empresa_id} value={e.empresa_id}>{e.razon_social}</SelectItem>)}</SelectContent></Select></div>}
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Nombre</Label><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></div><div className="space-y-1.5"><Label>Apellido</Label><Input value={f.apellido} onChange={(e) => setF({ ...f, apellido: e.target.value })} /></div></div>
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>RUT</Label><Input value={f.rut} onChange={(e) => setF({ ...f, rut: e.target.value })} className={f.rut && !validarRut(f.rut) ? 'border-red-400' : ''} />{f.rut && !validarRut(f.rut) && <p className="text-xs text-red-500">RUT inválido</p>}</div><div className="space-y-1.5"><Label>Cargo</Label><Input value={f.cargo} onChange={(e) => setF({ ...f, cargo: e.target.value })} /></div></div>
          <div className="space-y-1.5"><Label>Teléfono</Label><Input value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button className="bg-blue-600 hover:bg-blue-700" disabled={!validarRut(f.rut)} onClick={save}>Crear</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}

const CAUSALES = [
  'ARTÍCULO 159 - N°1 MUTUO ACUERDO DE LAS PARTES',
  'ARTÍCULO 159 - N°2 RENUNCIA DEL TRABAJADOR',
  'ARTÍCULO 159 - N°3 MUERTE DEL TRABAJADOR',
  'ARTÍCULO 159 - N°4 VENCIMIENTO DEL PLAZO CONVENIDO EN EL CONTRATO',
  'ARTÍCULO 159 - N°5 CONCLUSIÓN DEL TRABAJO O SERVICIO QUE DIO ORIGEN AL CONTRATO',
  'ARTÍCULO 159 - N°6 CASO FORTUITO O FUERZA MAYOR',
  'ARTÍCULO 160 - N°1 CONDUCTAS INDEBIDAS DE CARÁCTER GRAVE',
  'ARTÍCULO 160 - N°2 NEGOCIACIONES QUE EJECUTE EL TRABAJADOR DENTRO DEL GIRO DEL NEGOCIO',
  'ARTÍCULO 160 - N°3 NO CONCURRENCIA DEL TRABAJADOR A SUS LABORES SIN CAUSA JUSTIFICADA',
  'ARTÍCULO 160 - N°4 ABANDONO DEL TRABAJO POR PARTE DEL TRABAJADOR',
  'ARTÍCULO 160 - N°5 ACTOS, OMISIONES O IMPRUDENCIAS TEMERARIAS',
  'ARTÍCULO 160 - N°6 PERJUICIO MATERIAL CAUSADO INTENCIONALMENTE',
  'ARTÍCULO 160 - N°7 INCUMPLIMIENTO GRAVE DE LAS OBLIGACIONES QUE IMPONE EL CONTRATO',
  'ARTÍCULO 161 - N°1 NECESIDADES DE LA EMPRESA',
  'ARTÍCULO 163 BIS',
  'ANEXO DE TRASLADO',
  'ART. 161 INCISO 2: DESAHUCIO DEL EMPLEADOR',
];

function DesvincularDialog({ api, trabajadorId, asignacion, onClose, onDone }) {
  const [causal, setCausal] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const esTraslado = causal === 'ANEXO DE TRASLADO';
  const submit = async () => {
    if (!causal) { toast.error('Selecciona una causal'); return; }
    if (!file) { toast.error('Adjunta el archivo'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('El archivo no puede superar los 2 MB'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('asignacion_id', asignacion.asignacion_id);
      fd.append('causal', causal); fd.append('tipo', esTraslado ? 'anexo_traslado' : 'finiquito');
      await api(`/trabajadores/${trabajadorId}/desvincular`, { method: 'POST', body: fd });
      toast.success('Trabajador desvinculado del contrato'); onDone();
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Desvincular trabajador</DialogTitle><DialogDescription>Contrato {asignacion.numero_oc} · {asignacion.mandante}. Se liberará de este contrato y quedará registrado en el histórico.</DialogDescription></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5"><Label>Causal / Tipo</Label>
          <Select value={causal} onValueChange={setCausal}><SelectTrigger><SelectValue placeholder="Selecciona causal" /></SelectTrigger><SelectContent className="max-h-72">{CAUSALES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="space-y-1.5"><Label>{esTraslado ? 'Archivo Anexo de Traslado' : 'Archivo Finiquito'}</Label><Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /><p className="text-xs text-slate-400">El archivo no puede superar los 2 MB.</p></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button className="bg-amber-500 hover:bg-amber-600" disabled={loading} onClick={submit}>{loading ? 'Procesando…' : 'Desvincular'}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}

function TrabajadorDetail({ api, id, onBack, canManage, isSuper }) {
  const [data, reload] = useData(api, `/trabajadores/${id}`, [id]);
  const [contratos] = useData(api, '/contratos');
  const [upload, setUpload] = useState(null);
  const [edit, setEdit] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [ef, setEf] = useState({});
  const [asig, setAsig] = useState('');
  const [desvincular, setDesvincular] = useState(null);
  const [verHistDoc, setVerHistDoc] = useState(null);
  const [verDesv, setVerDesv] = useState(null);
  const [verDesvFile, setVerDesvFile] = useState(null);
  if (!data) return <p className="text-slate-400">Cargando…</p>;
  const { trabajador: t, asignaciones, acreditacion, historial, historialDocumental } = data;
  const contratosEmp = (contratos?.contratos || []).filter((c) => c.empresa_id === t.empresa_id);
  const openEdit = () => { setEf({ nombre: t.nombre, apellido: t.apellido, cargo: t.cargo, telefono: t.telefono, region: t.region, comuna: t.comuna, email: t.email }); setEdit(true); };
  const saveEdit = async () => { try { await api(`/trabajadores/${id}`, { method: 'PUT', body: JSON.stringify(ef) }); toast.success('Trabajador actualizado'); setEdit(false); reload(); } catch (e) { toast.error(e.message); } };
  const desactivar = async () => { if (!(await confirmDialog({ title: '¿Desactivar trabajador?', description: 'El trabajador quedará inactivo en la plataforma.', confirmText: 'Desactivar' }))) return; try { await api(`/trabajadores/${id}`, { method: 'DELETE' }); toast.success('Trabajador desactivado'); onBack(); } catch (e) { toast.error(e.message); } };
  const doAsignar = async () => { if (!asig) return; try { await api('/trabajadores/asignar', { method: 'POST', body: JSON.stringify({ trabajador_id: id, contrato_id: asig }) }); toast.success('Asignado a contrato'); setAsig(''); reload(); } catch (e) { toast.error(e.message); } };
  return (
    <div>
      <button onClick={onBack} className="text-sm text-blue-600 mb-3">← Volver</button>
      <DetailHeader
        icon={<span className="text-xl font-bold">{t.nombre?.charAt(0)}</span>}
        title={`${t.nombre} ${t.apellido}`}
        meta={[{ label: 'RUT', value: t.rut }, { label: 'Cargo', value: t.cargo || '—' }, { label: 'Empresa', value: t.empresa }]}
        actions={<><Button variant="outline" onClick={() => setQrOpen(true)}><QrCode className="h-4 w-4 mr-1" />QR</Button>{canManage && <><Button variant="outline" onClick={openEdit}>Editar</Button><Button variant="outline" className="text-red-600 border-red-200" onClick={desactivar}>Desactivar</Button>{isSuper && <CascadeDelete api={api} tipo="trabajadores" id={id} nombre={`${t.nombre} ${t.apellido}`} onDone={onBack} />}</>}</>}
      />
      {acreditacion.length > 0 && <div className="flex gap-3 flex-wrap mb-4 -mt-2">{acreditacion.map((a) => <div key={a.mandante_id} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5"><span className="text-xs text-slate-500">{a.mandante}</span><SemBadge estado={a.estado} /></div>)}</div>}
      <Tabs defaultValue="documentacion">
        <TabsList className="flex-wrap h-auto"><TabsTrigger value="documentacion">Documentación</TabsTrigger><TabsTrigger value="asignaciones">Asignaciones</TabsTrigger>{historialDocumental?.length > 0 && <TabsTrigger value="dochist">Doc. histórica</TabsTrigger>}<TabsTrigger value="info">Información</TabsTrigger><TabsTrigger value="historial">Historial</TabsTrigger></TabsList>
        <TabsContent value="documentacion">
          {acreditacion.length === 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3.5 text-red-700">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Sin asignaciones a mandantes activas</p>
                <p className="text-xs text-red-600/80 mt-0.5">Este trabajador no está vinculado a ningún contrato activo.{historialDocumental?.length > 0 ? ' Revisa la pestaña “Doc. histórica” para ver sus documentos anteriores.' : ''}</p>
              </div>
            </div>
          )}
          {acreditacion.map((a) => (
            <Card key={a.mandante_id} className="mb-4"><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-base flex items-center gap-2">{a.mandante} <span className="text-xs text-slate-400 font-normal">· {a.contrato}</span></CardTitle><div className="flex items-center gap-2"><span className="text-xs text-slate-500">{a.docs_ok}/{a.docs_total} obligatorios</span><SemBadge estado={a.estado} /></div></div></CardHeader>
              <CardContent><DocsPorCategoria detalle={a.detalle} mandanteId={a.mandante_id} canManage={canManage} api={api} onCargar={(d) => setUpload({ requisito: d, mandante_id: a.mandante_id })} /></CardContent>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="asignaciones">
          {canManage && <div className="flex gap-2 mb-3 max-w-lg"><Select value={asig} onValueChange={setAsig}><SelectTrigger><SelectValue placeholder="Asignar a contrato de su empresa…" /></SelectTrigger><SelectContent>{contratosEmp.map((c) => <SelectItem key={c.contrato_id} value={c.contrato_id}>{c.numero_oc} · {c.mandante}</SelectItem>)}</SelectContent></Select><Button className="bg-blue-600 hover:bg-blue-700" onClick={doAsignar}>Asignar</Button></div>}
          <Table columns={[{ key: 'mandante', label: 'Mandante' }, { key: 'numero_oc', label: 'Contrato' }, { key: 'gerencia', label: 'Gerencia' }, { key: 'estado', label: 'Estado', render: (r) => <Badge className={r.estado === 'activo' ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-rose-100 text-rose-700 border-0'}>{r.estado === 'activo' ? 'activo' : 'desvinculado'}</Badge> }, { key: 'acc', label: '', render: (r) => <div className="flex justify-end gap-2">{r.estado !== 'activo' && r.desvinculacion_id && <Button size="sm" variant="outline" className="h-7 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => setVerDesv(r)}><Eye className="h-3.5 w-3.5 mr-1" />Ver desvinculación</Button>}{canManage && r.estado === 'activo' && <Button size="sm" variant="outline" className="h-7 text-amber-700 border-amber-200" onClick={() => setDesvincular(r)}>Desvincular</Button>}</div> }]} rows={asignaciones} />
        </TabsContent>
        {historialDocumental?.length > 0 && (
          <TabsContent value="dochist">
            <p className="text-sm text-slate-500 mb-3">Documentos que el trabajador tuvo mientras estuvo vinculado (ya finiquitado de estos mandantes). Se conservan segmentados por mandante, empresa y contrato.</p>
            {historialDocumental.map((h) => {
              const cats = {};
              (h.detalle || []).forEach((d) => { (cats[d.categoria] = cats[d.categoria] || []).push(d); });
              return (
                <Card key={h.mandante_id} className="mb-4">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="text-base flex items-center gap-2">{h.mandante}<Badge className="bg-slate-100 text-slate-500 border-0">Finiquitado</Badge></CardTitle>
                      <span className="text-xs text-slate-500">{h.docs_total} documento{h.docs_total === 1 ? '' : 's'}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(h.contratos || []).map((c) => (
                        <div key={c.contrato_id} className="text-xs rounded-md border bg-slate-50 px-2.5 py-1.5">
                          <span className="font-medium text-slate-700">{c.empresa}</span>
                          <span className="text-slate-400"> · Contrato </span><span className="tabular-nums text-slate-600">{(c.numero_oc || '').replace(/^\s*(Contrato|OC|PO|N°)\s+/i, '')}</span>
                          {c.causal && <span className="block text-slate-500 mt-0.5">{c.tipo === 'anexo_traslado' ? 'Traslado' : 'Finiquito'}: {c.causal}{c.fecha_finiquito ? ` · ${fdate(c.fecha_finiquito)}` : ''}</span>}
                        </div>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {h.docs_total === 0 && <p className="text-sm text-slate-400">No se cargaron documentos para este mandante.</p>}
                    {Object.keys(cats).map((cat) => (
                      <div key={cat} className="mb-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">{cat}</p>
                        <div className="divide-y rounded-lg border">
                          {cats[cat].map((d) => (
                            <div key={d.documento_id} className="flex items-center justify-between gap-2 px-3 py-2">
                              <div className="min-w-0">
                                <p className="text-sm text-slate-700 truncate">{d.requisito}</p>
                                <p className="text-xs text-slate-400 truncate">{d.nombre_archivo}{d.fecha_vencimiento ? ` · Vence ${fdate(d.fecha_vencimiento)}` : ''}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge className={`border-0 ${d.estado === 'aprobado' ? 'bg-emerald-100 text-emerald-700' : (d.estado === 'vencido' || d.estado === 'rechazado') ? 'bg-red-100 text-red-700' : d.estado === 'en_revision' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{d.estado}</Badge>
                                <Button size="sm" variant="outline" className="h-7" onClick={() => setVerHistDoc({ documento_id: d.documento_id, nombre: d.requisito })}><Eye className="h-3.5 w-3.5 mr-1" />Ver</Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        )}
        <TabsContent value="info"><Card><CardContent className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {[['RUT', t.rut], ['Nombre', `${t.nombre} ${t.apellido}`], ['Cargo', t.cargo], ['Género', t.genero], ['Región', t.region], ['Comuna', t.comuna], ['Teléfono', t.telefono], ['Empresa', t.empresa]].map(([k, v]) => <div key={k}><p className="text-slate-400">{k}</p><p className="font-medium">{v || '—'}</p></div>)}
        </CardContent></Card></TabsContent>
        <TabsContent value="historial"><Table columns={[{ key: 'created_at', label: 'Fecha', render: (r) => fdatetime(r.created_at) }, { key: 'accion', label: 'Acción' }, { key: 'usuario', label: 'Usuario' }]} rows={historial} empty="Sin eventos" /></TabsContent>
      </Tabs>
      <Dialog open={edit} onOpenChange={setEdit}><DialogContent>
        <DialogHeader><DialogTitle>Editar trabajador</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Nombre</Label><Input value={ef.nombre || ''} onChange={(e) => setEf({ ...ef, nombre: e.target.value })} /></div><div className="space-y-1.5"><Label>Apellido</Label><Input value={ef.apellido || ''} onChange={(e) => setEf({ ...ef, apellido: e.target.value })} /></div></div>
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Cargo</Label><Input value={ef.cargo || ''} onChange={(e) => setEf({ ...ef, cargo: e.target.value })} /></div><div className="space-y-1.5"><Label>Teléfono</Label><Input value={ef.telefono || ''} onChange={(e) => setEf({ ...ef, telefono: e.target.value })} /></div></div>
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Región</Label><Input value={ef.region || ''} onChange={(e) => setEf({ ...ef, region: e.target.value })} /></div><div className="space-y-1.5"><Label>Comuna</Label><Input value={ef.comuna || ''} onChange={(e) => setEf({ ...ef, comuna: e.target.value })} /></div></div>
          <div className="space-y-1.5"><Label>Email</Label><Input value={ef.email || ''} onChange={(e) => setEf({ ...ef, email: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setEdit(false)}>Cancelar</Button><Button className="bg-blue-600 hover:bg-blue-700" onClick={saveEdit}>Guardar</Button></DialogFooter>
      </DialogContent></Dialog>
      {upload && <UploadDialog api={api} recurso_tipo="trabajador" recurso_id={id} requisito={upload.requisito} mandante_id={upload.mandante_id} onClose={() => setUpload(null)} onDone={() => { setUpload(null); reload(); }} />}
      {qrOpen && <QRDialog id={id} titulo={`${t.nombre} ${t.apellido}`} rut={t.rut} onClose={() => setQrOpen(false)} />}
      {desvincular && <DesvincularDialog api={api} trabajadorId={id} asignacion={desvincular} onClose={() => setDesvincular(null)} onDone={() => { setDesvincular(null); reload(); }} />}
      {verHistDoc && <DocViewerModal api={api} doc={verHistDoc} onClose={() => setVerHistDoc(null)} />}
      {verDesv && <DesvinculacionInfoModal asig={verDesv} trabajador={`${t.nombre} ${t.apellido}`} onClose={() => setVerDesv(null)} onVerArchivo={() => { setVerDesvFile(verDesv); setVerDesv(null); }} />}
      {verDesvFile && <FiniquitoViewerModal api={api} row={{ desvinculacion_id: verDesvFile.desvinculacion_id, nombre: `${t.nombre} ${t.apellido}`, causal: verDesvFile.desv_causal, nombre_archivo: verDesvFile.desv_archivo, mime: verDesvFile.desv_mime }} onClose={() => setVerDesvFile(null)} />}
    </div>
  );
}

function QRDialog({ id, titulo, rut, onClose }) {
  const [img, setImg] = useState(null);
  const [url, setUrl] = useState('');
  useEffect(() => {
    let alive = true;
    const u = `${window.location.origin}/validar/${id}`;
    setUrl(u);
    (async () => {
      try {
        const QR = (await import('qrcode')).default;
        const dataUrl = await QR.toDataURL(u, { width: 320, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } });
        if (alive) setImg(dataUrl);
      } catch (e) { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [id]);
  const copy = async () => { try { await navigator.clipboard.writeText(url); toast.success('Enlace copiado'); } catch { toast.error('No se pudo copiar'); } };
  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-sm w-[92vw] overflow-hidden">
      <DialogHeader><DialogTitle>Expediente QR</DialogTitle><DialogDescription>Escanea para validar en terreno · {titulo}</DialogDescription></DialogHeader>
      <div className="flex flex-col items-center gap-3 min-w-0">
        <div className="rounded-xl border bg-white p-4 flex items-center justify-center">
          {img ? <img src={img} alt="QR expediente" className="block w-full max-w-[220px] h-auto" /> : <div className="h-56 w-56 flex items-center justify-center text-slate-400 text-sm">Generando…</div>}
        </div>
        <div className="text-center w-full min-w-0">
          <p className="text-sm font-medium text-slate-700 truncate">{titulo}</p>
          <p className="text-xs text-slate-400">{rut}</p>
        </div>
        <div className="w-full min-w-0 flex items-center gap-2 bg-slate-50 border rounded-lg px-2 py-1.5">
          <span className="text-xs text-slate-500 truncate flex-1 min-w-0">{url}</span>
          <button onClick={copy} className="text-slate-400 hover:text-slate-700 shrink-0"><Copy className="h-4 w-4" /></button>
        </div>
      </div>
      <DialogFooter className="gap-2 flex-wrap sm:justify-center">
        <Button variant="outline" onClick={onClose}>Cerrar</Button>
        {url && <a href={url} target="_blank" rel="noreferrer"><Button variant="outline"><ExternalLink className="h-4 w-4 mr-1" />Abrir</Button></a>}
        {img && <a href={img} download={`QR_${(rut || id)}.png`}><Button className="bg-blue-600 hover:bg-blue-700"><Download className="h-4 w-4 mr-1" />Descargar</Button></a>}
      </DialogFooter>
    </DialogContent></Dialog>
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
function SimpleResource({ api, kind, canManage, isSuper, openDetail }) {
  const [data, reload] = useData(api, `/${kind}`);
  const [empresas] = useData(api, '/empresas');
  const [tiposVeh] = useData(api, '/tipos-vehiculo');
  const [marcasVeh] = useData(api, '/marcas-vehiculo');
  const [open, setOpen] = useState(false);
  const isVeh = kind === 'vehiculos';
  const [f, setF] = useState({});
  const save = async () => { try { await api(`/${kind}`, { method: 'POST', body: JSON.stringify(f) }); toast.success('Creado'); setOpen(false); setF({}); reload(); } catch (e) { toast.error(e.message); } };
  const rows = data?.[kind];
  return (
    <div>
      <PageHead title={isVeh ? 'Vehículos' : 'Equipos'} sub={`Cada ${isVeh ? 'vehículo' : 'equipo'} pertenece a una empresa del Holding`} action={canManage && <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nuevo</Button>} />
      <Table columns={isVeh ? [
        { key: 'patente', label: 'Patente', render: (r) => <span className="font-medium">{r.patente}</span> }, { key: 'numero_interno', label: 'Nº INT', render: (r) => r.numero_interno || <span className="text-slate-300">—</span> }, { key: 'tipo', label: 'Tipo' }, { key: 'marca', label: 'Marca' }, { key: 'modelo', label: 'Modelo' }, { key: 'anio', label: 'Año' }, { key: 'empresa', label: 'Empresa' },
      ] : [
        { key: 'codigo_interno', label: 'Código', render: (r) => <span className="font-medium">{r.codigo_interno}</span> }, { key: 'tipo', label: 'Tipo' }, { key: 'marca', label: 'Marca' }, { key: 'modelo', label: 'Modelo' }, { key: 'anio', label: 'Año' }, { key: 'empresa', label: 'Empresa' },
      ]} rows={rows} onRow={(r) => openDetail(isVeh ? 'vehiculo' : 'equipo', isVeh ? r.vehiculo_id : r.equipo_id)} />
      <Dialog open={open} onOpenChange={setOpen}><DialogContent>
        <DialogHeader><DialogTitle>Nuevo {isVeh ? 'vehículo' : 'equipo'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {isSuper && <div className="space-y-1.5"><Label>Empresa del Holding</Label><Select value={f.empresa_id} onValueChange={(v) => setF({ ...f, empresa_id: v })}><SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger><SelectContent>{(empresas?.empresas || []).map((e) => <SelectItem key={e.empresa_id} value={e.empresa_id}>{e.razon_social}</SelectItem>)}</SelectContent></Select></div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{isVeh ? 'Patente' : 'Código interno'}</Label><Input onChange={(e) => setF({ ...f, [isVeh ? 'patente' : 'codigo_interno']: e.target.value })} /></div>
            {isVeh && <div className="space-y-1.5"><Label>Nº Interno</Label><Input placeholder="Ej: 101" onChange={(e) => setF({ ...f, numero_interno: e.target.value })} /></div>}
            <div className="space-y-1.5"><Label>Tipo</Label>{isVeh
              ? <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}><SelectTrigger><SelectValue placeholder="Selecciona tipo" /></SelectTrigger><SelectContent className="max-h-72">{(tiposVeh?.tipos || []).map((t) => <SelectItem key={t.id} value={t.nombre}>{t.nombre}</SelectItem>)}</SelectContent></Select>
              : <Input onChange={(e) => setF({ ...f, tipo: e.target.value })} />}</div>
            <div className="space-y-1.5"><Label>Marca</Label>{isVeh
              ? <Select value={f.marca} onValueChange={(v) => setF({ ...f, marca: v })}><SelectTrigger><SelectValue placeholder="Selecciona marca" /></SelectTrigger><SelectContent className="max-h-72">{(marcasVeh?.marcas || []).map((mm) => <SelectItem key={mm.id} value={mm.nombre}>{mm.nombre}</SelectItem>)}</SelectContent></Select>
              : <Input onChange={(e) => setF({ ...f, marca: e.target.value })} />}</div>
            <div className="space-y-1.5"><Label>Modelo</Label><Input onChange={(e) => setF({ ...f, modelo: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Año</Label><Input type="number" onChange={(e) => setF({ ...f, anio: Number(e.target.value) })} /></div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button className="bg-blue-600 hover:bg-blue-700" onClick={save}>Crear</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}

/* ------------ Recurso (Vehículo/Equipo) detail ------------ */
function RecursoDetail({ api, tipo, id, onBack, canManage, isSuper }) {
  const [data, reload] = useData(api, `/${tipo}s/${id}`, [tipo, id]);
  const [contratos] = useData(api, '/contratos');
  const [tiposVeh] = useData(api, '/tipos-vehiculo');
  const [marcasVeh] = useData(api, '/marcas-vehiculo');
  const [upload, setUpload] = useState(null);
  const [asig, setAsig] = useState('');
  const [edit, setEdit] = useState(false);
  const [ef, setEf] = useState({});
  if (!data) return <p className="text-slate-400">Cargando…</p>;
  const { recurso: r, asignaciones, acreditacion } = data;
  const titulo = tipo === 'vehiculo' ? r.patente : r.codigo_interno;
  const contratosEmp = (contratos?.contratos || []).filter((c) => c.empresa_id === r.empresa_id);
  const openEdit = () => { setEf({ [tipo === 'vehiculo' ? 'patente' : 'codigo_interno']: titulo, numero_interno: r.numero_interno || '', tipo: r.tipo || '', marca: r.marca || '', modelo: r.modelo || '', anio: r.anio || '' }); setEdit(true); };
  const saveEdit = async () => { try { await api(`/${tipo}s/${id}`, { method: 'PUT', body: JSON.stringify({ ...ef, anio: ef.anio ? Number(ef.anio) : null }) }); toast.success(`${tipo === 'vehiculo' ? 'Vehículo' : 'Equipo'} actualizado`); setEdit(false); reload(); } catch (e) { toast.error(e.message); } };
  const doAsignar = async () => { if (!asig) return; try { await api(`/${tipo}s/asignar`, { method: 'POST', body: JSON.stringify({ recurso_id: id, contrato_id: asig }) }); toast.success('Asignado a contrato'); setAsig(''); reload(); } catch (e) { toast.error(e.message); } };
  return (
    <div>
      <button onClick={onBack} className="text-sm text-blue-600 mb-3">← Volver</button>
      <DetailHeader
        icon={tipo === 'vehiculo' ? <Truck className="h-7 w-7" /> : <Wrench className="h-7 w-7" />}
        title={titulo}
        meta={[{ label: 'Tipo', value: r.tipo || '—' }, { label: 'Detalle', value: [r.marca, r.modelo, r.anio].filter(Boolean).join(' ') || '—' }, { label: 'Empresa', value: r.empresa }]}
        actions={<>{canManage && <Button variant="outline" onClick={openEdit}>Editar</Button>}{isSuper && <CascadeDelete api={api} tipo={`${tipo}s`} id={id} nombre={titulo} onDone={onBack} />}</>}
      />
      {acreditacion.length > 0 && <div className="flex gap-3 flex-wrap mb-4 -mt-2">{acreditacion.map((a) => <div key={a.mandante_id} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5"><span className="text-xs text-slate-500">{a.mandante}</span><SemBadge estado={a.estado} /></div>)}</div>}
      <Tabs defaultValue="documentacion">
        <TabsList><TabsTrigger value="documentacion">Documentación</TabsTrigger><TabsTrigger value="asignaciones">Asignaciones</TabsTrigger><TabsTrigger value="info">Información</TabsTrigger></TabsList>
        <TabsContent value="documentacion">
          {acreditacion.length === 0 && <p className="text-slate-400">Sin asignaciones a mandantes. Asigna este {tipo} a un contrato para ver sus requisitos documentales.</p>}
          {acreditacion.map((a) => (
            <Card key={a.mandante_id} className="mb-4"><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-base flex items-center gap-2">{a.mandante} <span className="text-xs text-slate-400 font-normal">· {a.contrato}</span></CardTitle><div className="flex items-center gap-2"><span className="text-xs text-slate-500">{a.docs_ok}/{a.docs_total} obligatorios</span><SemBadge estado={a.estado} /></div></div></CardHeader>
              <CardContent><DocsPorCategoria detalle={a.detalle} mandanteId={a.mandante_id} canManage={canManage} api={api} onCargar={(d) => setUpload({ requisito: d, mandante_id: a.mandante_id })} /></CardContent>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="asignaciones">
          {canManage && <div className="flex gap-2 mb-3 max-w-lg"><Select value={asig} onValueChange={setAsig}><SelectTrigger><SelectValue placeholder="Asignar a contrato de su empresa…" /></SelectTrigger><SelectContent>{contratosEmp.map((c) => <SelectItem key={c.contrato_id} value={c.contrato_id}>{c.numero_oc} · {c.mandante}</SelectItem>)}</SelectContent></Select><Button className="bg-blue-600 hover:bg-blue-700" onClick={doAsignar}>Asignar</Button></div>}
          <Table columns={[{ key: 'mandante', label: 'Mandante' }, { key: 'numero_oc', label: 'Contrato' }, { key: 'estado', label: 'Estado', render: (x) => <Badge className={x.estado === 'activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'}>{x.estado}</Badge> }]} rows={asignaciones} />
        </TabsContent>
        <TabsContent value="info"><Card><CardContent className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {Object.entries({ [tipo === 'vehiculo' ? 'Patente' : 'Código']: titulo, Tipo: r.tipo, Marca: r.marca, Modelo: r.modelo, Año: r.anio, Empresa: r.empresa, Estado: r.estado }).map(([k, v]) => <div key={k}><p className="text-slate-400">{k}</p><p className="font-medium">{v || '—'}</p></div>)}
        </CardContent></Card></TabsContent>
      </Tabs>
      {upload && <UploadDialog api={api} recurso_tipo={tipo} recurso_id={id} requisito={upload.requisito} mandante_id={upload.mandante_id} onClose={() => setUpload(null)} onDone={() => { setUpload(null); reload(); }} />}
      <Dialog open={edit} onOpenChange={setEdit}><DialogContent>
        <DialogHeader><DialogTitle>Editar {tipo === 'vehiculo' ? 'vehículo' : 'equipo'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>{tipo === 'vehiculo' ? 'Patente' : 'Código interno'}</Label><Input value={ef[tipo === 'vehiculo' ? 'patente' : 'codigo_interno'] || ''} onChange={(e) => setEf({ ...ef, [tipo === 'vehiculo' ? 'patente' : 'codigo_interno']: e.target.value })} /></div>
          {tipo === 'vehiculo' && <div className="space-y-1.5"><Label>Nº Interno</Label><Input value={ef.numero_interno || ''} onChange={(e) => setEf({ ...ef, numero_interno: e.target.value })} /></div>}
          <div className="space-y-1.5"><Label>Tipo</Label>{tipo === 'vehiculo'
            ? <Select value={ef.tipo} onValueChange={(v) => setEf({ ...ef, tipo: v })}><SelectTrigger><SelectValue placeholder="Selecciona tipo" /></SelectTrigger><SelectContent className="max-h-72">{(tiposVeh?.tipos || []).map((t) => <SelectItem key={t.id} value={t.nombre}>{t.nombre}</SelectItem>)}</SelectContent></Select>
            : <Input value={ef.tipo || ''} onChange={(e) => setEf({ ...ef, tipo: e.target.value })} />}</div>
          <div className="space-y-1.5"><Label>Marca</Label>{tipo === 'vehiculo'
            ? <Select value={ef.marca} onValueChange={(v) => setEf({ ...ef, marca: v })}><SelectTrigger><SelectValue placeholder="Selecciona marca" /></SelectTrigger><SelectContent className="max-h-72">{(marcasVeh?.marcas || []).map((mm) => <SelectItem key={mm.id} value={mm.nombre}>{mm.nombre}</SelectItem>)}</SelectContent></Select>
            : <Input value={ef.marca || ''} onChange={(e) => setEf({ ...ef, marca: e.target.value })} />}</div>
          <div className="space-y-1.5"><Label>Modelo</Label><Input value={ef.modelo || ''} onChange={(e) => setEf({ ...ef, modelo: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Año</Label><Input type="number" value={ef.anio || ''} onChange={(e) => setEf({ ...ef, anio: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setEdit(false)}>Cancelar</Button><Button className="bg-blue-600 hover:bg-blue-700" onClick={saveEdit}>Guardar</Button></DialogFooter>
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
        { key: 'fecha_subida', label: 'Cargado', render: (r) => fdateCL(r.fecha_subida) },
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
function VencKpi({ label, value, accent, icon: Icon }) {
  const map = {
    red: 'from-red-500/10 to-red-500/0 text-red-600 ring-red-100',
    orange: 'from-orange-500/10 to-orange-500/0 text-orange-600 ring-orange-100',
    amber: 'from-amber-500/10 to-amber-500/0 text-amber-600 ring-amber-100',
    slate: 'from-slate-500/10 to-slate-500/0 text-slate-600 ring-slate-100',
  };
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${map[accent]} ring-1 flex items-center justify-center shrink-0`}><Icon className="h-5 w-5" /></div>
        <div><div className="text-2xl font-bold text-slate-900 tabular-nums">{(value || 0).toLocaleString('es-CL')}</div><div className="text-xs text-slate-500">{label}</div></div>
      </CardContent>
    </Card>
  );
}

const VENC_TIPO_LABEL = { trabajador: 'Trabajador', vehiculo: 'Vehículo', equipo: 'Equipo', contrato: 'Contrato' };

function Desvinculaciones({ api }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let alive = true; setRows(null);
    const t = setTimeout(() => { api(`/desvinculaciones${q.trim().length >= 2 ? `?q=${encodeURIComponent(q.trim())}` : ''}`).then((d) => { if (alive) setRows(d.desvinculaciones || []); }).catch((e) => toast.error(e.message)); }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [api, q]);
  const [verDoc, setVerDoc] = useState(null);
  const verArchivo = (r) => setVerDoc(r);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const pageSize = 12;
  const all = rows || [];
  const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
  const cur = Math.min(page, totalPages);
  const start = (cur - 1) * pageSize;
  const pageRows = all.slice(start, start + pageSize);
  useEffect(() => { setPage(1); setOpen(null); }, [q, rows]);
  const cleanOC = (s) => (s || '').replace(/^\s*(Contrato|OC|PO|N°)\s+/i, '').trim();
  return (
    <div>
      <PageHead title="Personal Finiquitado" sub="Histórico de desvinculaciones (finiquitos y anexos de traslado)"
        action={<Button variant="outline" onClick={() => csvDownload('personal_finiquitado.csv', ['Empresa', 'Contrato', 'RUT', 'Nombre', 'Cargo', 'Causal', 'Tipo', 'Fecha'], (rows || []).map((r) => [r.empresa_nombre || '', r.contrato_numero || '', r.rut || '', r.nombre || '', r.cargo || '', r.causal || '', r.tipo, fdatetime(r.created_at)]))} disabled={!rows}><Download className="h-4 w-4 mr-1" />Exportar</Button>} />
      <div className="mb-3 max-w-sm"><div className="relative"><Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" /><Input className="pl-9" placeholder="Buscar por nombre, RUT, contrato, causal…" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="w-8" />
              <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">RUT</th>
              <th className="text-left font-medium px-3 py-2.5">Nombre</th>
              <th className="text-left font-medium px-3 py-2.5">Cargo</th>
              <th className="text-left font-medium px-3 py-2.5">Causal</th>
              <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">Archivo</th>
              <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows === null && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Cargando…</td></tr>}
            {rows !== null && all.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Sin desvinculaciones registradas</td></tr>}
            {pageRows.map((r) => {
              const isOpen = open === r.desvinculacion_id;
              return (
                <Fragment key={r.desvinculacion_id}>
                  <tr className="hover:bg-slate-50 cursor-pointer align-top" onClick={() => setOpen(isOpen ? null : r.desvinculacion_id)}>
                    <td className="pl-3 py-3 text-slate-400">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                    <td className="px-3 py-3 whitespace-nowrap tabular-nums text-slate-600">{r.rut}</td>
                    <td className="px-3 py-3 font-medium text-slate-800">{r.nombre}</td>
                    <td className="px-3 py-3 text-slate-600">{r.cargo}</td>
                    <td className="px-3 py-3 text-slate-600"><div className="flex items-start gap-1">{r.tipo === 'anexo_traslado' ? <Badge className="bg-blue-100 text-blue-700 border-0 shrink-0">Traslado</Badge> : null}<span>{r.causal}</span></div></td>
                    <td className="px-3 py-3"><Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={(e) => { e.stopPropagation(); verArchivo(r); }}><Eye className="h-3.5 w-3.5 mr-1" />VER</Button></td>
                    <td className="px-3 py-3 whitespace-nowrap tabular-nums text-slate-500">{fdatetime(r.created_at)}</td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-slate-50/70">
                      <td />
                      <td colSpan={6} className="px-3 pb-4 pt-1">
                        <div className="rounded-lg border bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Origen de la desvinculación</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div><p className="text-xs text-slate-400">Empresa</p><p className="text-sm text-slate-800">{r.empresa_nombre || '—'}</p></div>
                            <div><p className="text-xs text-slate-400">Mandante</p><p className="text-sm text-slate-800">{r.mandante_nombre || '—'}</p></div>
                            <div><p className="text-xs text-slate-400">Contrato</p><p className="text-sm text-slate-800 tabular-nums">{cleanOC(r.contrato_numero) || '—'}</p></div>
                            <div><p className="text-xs text-slate-400">Tipo</p><p className="text-sm text-slate-800">{r.tipo === 'anexo_traslado' ? 'Anexo de traslado' : 'Finiquito'}</p></div>
                            <div className="sm:col-span-2 lg:col-span-4"><p className="text-xs text-slate-400">Archivo</p><p className="text-sm text-slate-800 break-all">{r.nombre_archivo || '—'}</p></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {all.length > pageSize && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t bg-slate-50 text-sm">
            <span className="text-slate-500">Mostrando {start + 1}–{Math.min(start + pageSize, all.length)} de {all.length}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>Anterior</Button>
              <span className="text-slate-600">{cur} / {totalPages}</span>
              <Button size="sm" variant="outline" className="h-7" disabled={cur >= totalPages} onClick={() => setPage(cur + 1)}>Siguiente</Button>
            </div>
          </div>
        )}
      </div>
      {verDoc && <FiniquitoViewerModal api={api} row={verDoc} onClose={() => setVerDoc(null)} />}
    </div>
  );
}

function Vencimientos({ api }) {
  const [dias, setDias] = useState(30);
  const [rows, setRows] = useState(null);
  const [fEmp, setFEmp] = useState('all');
  const [fMan, setFMan] = useState('all');
  const [fTipo, setFTipo] = useState('all');
  const [q, setQ] = useState('');
  const [empresas] = useData(api, '/empresas');
  const [mandantes] = useData(api, '/mandantes');
  useEffect(() => {
    let alive = true; setRows(null);
    api(`/vencimientos?dias=${dias}`).then((r) => { if (alive) setRows(r.documentos || []); }).catch((e) => toast.error(e.message));
    return () => { alive = false; };
  }, [api, dias]);

  const filtered = (rows || []).filter((r) =>
    (fEmp === 'all' || r.empresa_id === fEmp) &&
    (fMan === 'all' || r.mandante === (mandantes?.mandantes || []).find((m) => m.mandante_id === fMan)?.razon_social) &&
    (fTipo === 'all' || r.recurso_tipo === fTipo) &&
    (!q.trim() || `${r.recurso || ''} ${r.requisito || ''}`.toLowerCase().includes(q.trim().toLowerCase()))
  );
  const kpis = {
    vencidos: filtered.filter((r) => r.dias_restantes < 0).length,
    semana: filtered.filter((r) => r.dias_restantes >= 0 && r.dias_restantes <= 7).length,
    treinta: filtered.filter((r) => r.dias_restantes >= 0 && r.dias_restantes <= 30).length,
    total: filtered.length,
  };
  const hasFilters = fEmp !== 'all' || fMan !== 'all' || fTipo !== 'all' || q.trim();

  return (
    <div>
      <PageHead title="Vencimientos" sub="Documentos aprobados próximos a vencer" action={<div className="flex gap-2 items-center flex-wrap">{[15, 30, 60, 90].map((d) => <Button key={d} size="sm" variant={dias === d ? 'default' : 'outline'} className={dias === d ? 'bg-blue-600' : ''} onClick={() => setDias(d)}>{d}d</Button>)}<Button size="sm" variant="outline" onClick={() => csvDownload('vencimientos.csv', ['Documento', 'Recurso', 'Tipo', 'Mandante', 'Empresa', 'Vence', 'Dias'], filtered.map((r) => [r.requisito || '', r.recurso || '', VENC_TIPO_LABEL[r.recurso_tipo] || r.recurso_tipo, r.mandante || '', r.empresa || '', fdate(r.fecha_vencimiento), r.dias_restantes]))}><Download className="h-4 w-4 mr-1" />CSV</Button></div>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <VencKpi label="Vencidos" value={kpis.vencidos} accent="red" icon={AlertTriangle} />
        <VencKpi label="Vence ≤ 7 días" value={kpis.semana} accent="orange" icon={Clock} />
        <VencKpi label="Vence ≤ 30 días" value={kpis.treinta} accent="amber" icon={CalendarClock} />
        <VencKpi label={`Total en rango (${dias}d)`} value={kpis.total} accent="slate" icon={FileClock} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-sm"><Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" /><Input className="pl-9" placeholder="Buscar recurso o documento…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select value={fTipo} onValueChange={setFTipo}><SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los tipos</SelectItem><SelectItem value="trabajador">Trabajadores</SelectItem><SelectItem value="vehiculo">Vehículos</SelectItem><SelectItem value="equipo">Equipos</SelectItem><SelectItem value="contrato">Contratos</SelectItem></SelectContent></Select>
        <Select value={fEmp} onValueChange={setFEmp}><SelectTrigger className="w-52"><SelectValue placeholder="Empresa" /></SelectTrigger><SelectContent><SelectItem value="all">Todas las empresas</SelectItem>{(empresas?.empresas || []).map((e) => <SelectItem key={e.empresa_id} value={e.empresa_id}>{e.razon_social}</SelectItem>)}</SelectContent></Select>
        <Select value={fMan} onValueChange={setFMan}><SelectTrigger className="w-52"><SelectValue placeholder="Mandante" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los mandantes</SelectItem>{(mandantes?.mandantes || []).map((m) => <SelectItem key={m.mandante_id} value={m.mandante_id}>{m.razon_social}</SelectItem>)}</SelectContent></Select>
        {hasFilters && <Button variant="ghost" onClick={() => { setFEmp('all'); setFMan('all'); setFTipo('all'); setQ(''); }}>Limpiar</Button>}
      </div>

      <Table columns={[
        { key: 'requisito', label: 'Documento' },
        { key: 'recurso', label: 'Recurso', render: (r) => <span className="font-medium text-slate-800">{r.recurso}</span> },
        { key: 'tipo', label: 'Tipo', render: (r) => <Badge className="bg-slate-100 text-slate-600 border-0">{VENC_TIPO_LABEL[r.recurso_tipo] || r.recurso_tipo}</Badge> },
        { key: 'mandante', label: 'Mandante' },
        { key: 'empresa', label: 'Empresa' },
        { key: 'fecha_vencimiento', label: 'Vence', render: (r) => fdate(r.fecha_vencimiento) },
        { key: 'dias_restantes', label: 'Días', render: (r) => <Badge className={r.dias_restantes < 0 ? 'bg-red-100 text-red-700' : r.dias_restantes <= 7 ? 'bg-orange-100 text-orange-700' : r.dias_restantes <= 15 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100'}>{r.dias_restantes < 0 ? `Vencido ${Math.abs(r.dias_restantes)}d` : `${r.dias_restantes} días`}</Badge> },
      ]} rows={rows === null ? null : filtered} empty="Sin vencimientos en el rango" />
    </div>
  );
}

/* ------------ Mantenedores (catálogos, solo Super Admin) ------------ */
function CatalogoTab({ api, endpoint, dataKey, singular }) {
  const [data, reload] = useData(api, `/${endpoint}`);
  const items = data?.[dataKey] || [];
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [nombre, setNombre] = useState('');
  const openNew = () => { setEditItem(null); setNombre(''); setOpen(true); };
  const openEdit = (it) => { setEditItem(it); setNombre(it.nombre); setOpen(true); };
  const save = async () => {
    const n = nombre.trim(); if (!n) { toast.error('Ingresa un nombre'); return; }
    try {
      if (editItem) await api(`/${endpoint}/${editItem.id}`, { method: 'PUT', body: JSON.stringify({ nombre: n }) });
      else await api(`/${endpoint}`, { method: 'POST', body: JSON.stringify({ nombre: n }) });
      toast.success('Guardado'); setOpen(false); reload();
    } catch (e) { toast.error(e.message); }
  };
  const del = async (it) => { if (!(await confirmDialog({ title: 'Eliminar registro', description: `¿Eliminar "${it.nombre}"? Esta acción no se puede deshacer.`, confirmText: 'Eliminar' }))) return; try { await api(`/${endpoint}/${it.id}`, { method: 'DELETE' }); toast.success('Eliminado'); reload(); } catch (e) { toast.error(e.message); } };
  const filtered = items.filter((it) => !q || it.nombre.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Input className="h-9 w-64" placeholder={`Buscar ${singular}…`} value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="text-xs text-slate-400">{filtered.length} registros</span>
        </div>
        <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Agregar</Button>
      </div>
      <Table pageSize={15} empty={`Sin ${singular}s`} columns={[
        { key: 'nombre', label: 'Nombre', render: (r) => <span className="font-medium text-slate-800">{r.nombre}</span> },
        { key: 'acc', label: '', render: (r) => <div className="flex justify-end gap-2"><Button size="sm" variant="outline" className="h-7" onClick={() => openEdit(r)}>Editar</Button><Button size="sm" variant="outline" className="h-7 text-red-600 border-red-200" onClick={() => del(r)}><Trash2 className="h-3.5 w-3.5" /></Button></div> },
      ]} rows={filtered} />
      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{editItem ? 'Editar' : 'Agregar'} {singular}</DialogTitle></DialogHeader>
        <div className="space-y-1.5"><Label>Nombre</Label><Input value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} autoFocus /></div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button className="bg-blue-600 hover:bg-blue-700" onClick={save}>Guardar</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}

function Mantenedores({ api }) {
  const [tab, setTab] = useState('marcas');
  const TABS = [['marcas', 'Marcas de vehículo'], ['tipos', 'Tipos de vehículo']];
  return (
    <div>
      <PageHead title="Mantenedores" sub="Catálogos del sistema · solo Super Admin" />
      <div className="inline-flex rounded-lg border bg-slate-100 p-1 mb-4">
        {TABS.map(([val, label]) => (
          <button key={val} onClick={() => setTab(val)} className={`px-4 py-1.5 text-sm rounded-md transition-colors ${tab === val ? 'bg-white shadow-sm font-semibold text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>{label}</button>
        ))}
      </div>
      {tab === 'marcas' && <CatalogoTab api={api} endpoint="marcas-vehiculo" dataKey="marcas" singular="marca" />}
      {tab === 'tipos' && <CatalogoTab api={api} endpoint="tipos-vehiculo" dataKey="tipos" singular="tipo" />}
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
  const [open, setOpen] = useState(false);
  const empty = { perfil_id: null, email: '', password: '', nombre: '', telefono: '', role_codigo: 'MANDANTE_VISOR', empresa_id: '', mandante_id: '', activo: true, mandantes: [] };
  const [f, setF] = useState(empty);
  const editing = !!f.perfil_id;
  const roles = data?.roles || [];
  const mandAll = data?.mandantesAll || [];
  const openNew = () => { setF(empty); setOpen(true); };
  const openEdit = (r) => { setF({ perfil_id: r.perfil_id, email: r.email, password: '', nombre: r.nombre || '', telefono: r.telefono || '', role_codigo: r.role_codigo, empresa_id: r.empresa_id || '', mandante_id: r.mandante_id || '', activo: r.activo, mandantes: (r.mandantes || []).map((m) => m.mandante_id) }); setOpen(true); };
  const toggleMand = (id) => setF((s) => ({ ...s, mandantes: s.mandantes.includes(id) ? s.mandantes.filter((x) => x !== id) : [...s.mandantes, id] }));
  const save = async () => {
    try {
      if (editing) { await api(`/usuarios/${f.perfil_id}`, { method: 'PUT', body: JSON.stringify(f) }); toast.success('Usuario actualizado'); }
      else { await api('/usuarios', { method: 'POST', body: JSON.stringify(f) }); toast.success('Usuario creado'); }
      setOpen(false); reload();
    } catch (e) { toast.error(e.message); }
  };
  const del = async (r) => { if (!(await confirmDialog({ title: 'Eliminar usuario', description: `¿Eliminar al usuario ${r.nombre} (${r.email})? Esta acción no se puede deshacer.`, confirmText: 'Eliminar' }))) return; try { await api(`/usuarios/${r.perfil_id}`, { method: 'DELETE' }); toast.success('Usuario eliminado'); reload(); } catch (e) { toast.error(e.message); } };
  if (!isSuper) return <div><PageHead title="Usuarios" /><p className="text-slate-400">Solo el Super Administrador puede gestionar usuarios.</p></div>;
  const showMand = !['SUPER_ADMIN_HOLDING', 'ADMIN_EMPRESA'].includes(f.role_codigo);
  return (
    <div>
      <PageHead title="Usuarios y permisos" sub="Cuentas gestionadas con Supabase Auth" action={<Button className="bg-blue-600 hover:bg-blue-700" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nuevo usuario</Button>} />
      <Table columns={[
        { key: 'nombre', label: 'Nombre', render: (r) => <div><p className="font-medium text-slate-800">{r.nombre}</p><p className="text-xs text-slate-400">{r.email}</p></div> },
        { key: 'telefono', label: 'Teléfono', render: (r) => r.telefono || <span className="text-slate-300">—</span> },
        { key: 'role_codigo', label: 'Rol', render: (r) => <Badge variant="outline" className={roleBadgeClass(r.role_codigo)}>{roleLabel[r.role_codigo] || r.role_codigo}</Badge> },
        { key: 'mandantes', label: 'Mandantes', render: (r) => (r.mandantes && r.mandantes.length) ? <span className="text-slate-600" title={r.mandantes.map((m) => m.razon_social).join(', ')}>{r.mandantes.length === 1 ? r.mandantes[0].razon_social : `${r.mandantes.length} mandantes`}</span> : (r.mandante || <span className="text-slate-300">—</span>) },
        { key: 'activo', label: 'Estado', render: (r) => r.activo ? <Badge className="bg-emerald-100 text-emerald-700 border-0">Activo</Badge> : <Badge className="bg-slate-100 text-slate-500 border-0">Inactivo</Badge> },
        { key: 'acc', label: '', render: (r) => <div className="flex justify-end gap-2"><Button size="sm" variant="outline" className="h-7" onClick={() => openEdit(r)}><Settings className="h-3.5 w-3.5 mr-1" />Editar</Button><Button size="sm" variant="outline" className="h-7 text-red-600 border-red-200 hover:bg-red-50" onClick={() => del(r)}><Trash2 className="h-3.5 w-3.5" /></Button></div> },
      ]} rows={data?.usuarios} />
      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div className="space-y-1.5"><Label>Nombre</Label><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Correo</Label><Input value={f.email} disabled={editing} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Teléfono</Label><Input value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>{editing ? 'Nueva contraseña (opcional)' : 'Contraseña'}</Label><Input type="password" value={f.password} placeholder={editing ? 'Dejar en blanco para no cambiar' : ''} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Rol</Label><Select value={f.role_codigo} onValueChange={(v) => setF({ ...f, role_codigo: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{roles.map((r) => <SelectItem key={r.codigo} value={r.codigo}>{roleLabel[r.codigo] || r.nombre}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Estado</Label><Select value={f.activo ? 'si' : 'no'} onValueChange={(v) => setF({ ...f, activo: v === 'si' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="si">Activo</SelectItem><SelectItem value="no">Inactivo</SelectItem></SelectContent></Select></div>
          </div>
          {f.role_codigo === 'ADMIN_EMPRESA' && <div className="space-y-1.5"><Label>Empresa</Label><Select value={f.empresa_id} onValueChange={(v) => setF({ ...f, empresa_id: v })}><SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger><SelectContent>{(empresas?.empresas || []).map((e) => <SelectItem key={e.empresa_id} value={e.empresa_id}>{e.razon_social}</SelectItem>)}</SelectContent></Select></div>}
          {showMand && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between"><Label>Mandantes asignados</Label><span className="text-xs text-slate-400">{f.mandantes.length} seleccionados</span></div>
              <div className="border rounded-lg max-h-52 overflow-y-auto divide-y">
                {mandAll.map((m) => (
                  <label key={m.mandante_id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm">
                    <input type="checkbox" checked={f.mandantes.includes(m.mandante_id)} onChange={() => toggleMand(m.mandante_id)} className="h-4 w-4 rounded border-slate-300" />
                    <span className="text-slate-700">{m.razon_social}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-400">Define qué información podrá ver el usuario.</p>
            </div>
          )}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button className="bg-blue-600 hover:bg-blue-700" onClick={save}>{editing ? 'Guardar' : 'Crear'}</Button></DialogFooter>
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
        { key: 'created_at', label: 'Fecha', render: (r) => fdatetime(r.created_at) },
        { key: 'usuario', label: 'Usuario' }, { key: 'accion', label: 'Acción', render: (r) => <Badge variant="secondary">{r.accion}</Badge> },
        { key: 'entidad', label: 'Entidad' },
      ]} rows={data?.eventos} empty="Sin eventos" />
    </div>
  );
}
