'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ShieldCheck, XCircle, Clock, Loader2 } from 'lucide-react';

const LOGO = '/logo-aptiva.png';

const ESTADO = {
  ACREDITADO: { label: 'Acreditado', bg: 'bg-emerald-500', ring: 'ring-emerald-200', text: 'text-emerald-600', icon: ShieldCheck },
  EN_REVISION: { label: 'En revisión', bg: 'bg-amber-500', ring: 'ring-amber-200', text: 'text-amber-600', icon: Clock },
  BLOQUEADO: { label: 'Bloqueado', bg: 'bg-red-500', ring: 'ring-red-200', text: 'text-red-600', icon: XCircle },
};
const CHIPS = [
  ['aprobado', 'Aprobados', 'bg-emerald-50 text-emerald-700'],
  ['por_vencer', 'Por vencer', 'bg-orange-50 text-orange-700'],
  ['vencido', 'Vencidos', 'bg-red-50 text-red-700'],
  ['en_revision', 'En revisión', 'bg-blue-50 text-blue-700'],
  ['rechazado', 'Rechazados', 'bg-red-50 text-red-600'],
  ['faltante', 'Faltantes', 'bg-slate-100 text-slate-600'],
];
const pctColor = (p) => (p >= 90 ? '#10b981' : p >= 60 ? '#f59e0b' : '#ef4444');

export default function ValidarPage() {
  const params = useParams();
  const id = params?.id;
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/public/expediente/${id}`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'No se pudo validar');
        if (alive) setState({ loading: false, data: d, error: null });
      } catch (e) {
        if (alive) setState({ loading: false, data: null, error: e.message });
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const d = state.data;
  const est = d ? (ESTADO[d.estadoGlobal] || ESTADO.EN_REVISION) : null;
  const now = new Date();

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center pb-10 px-4" style={{ fontFamily: 'Montserrat, sans-serif', paddingTop: 'calc(7.5rem + env(safe-area-inset-top))' }}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-4">
          <img src={LOGO} alt="Aptiva" className="h-8 invert-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </div>

        {state.loading && (
          <div className="bg-white rounded-2xl shadow-sm p-10 flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" /> Validando…
          </div>
        )}

        {state.error && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <XCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">No se pudo validar</p>
            <p className="text-sm text-slate-400 mt-1">{state.error}</p>
          </div>
        )}

        {d && est && (
          <div className="space-y-4">
            <div className={`rounded-2xl shadow-sm overflow-hidden bg-white ring-1 ${est.ring}`}>
              <div className={`${est.bg} px-5 py-5 text-white flex items-center gap-3`}>
                <est.icon className="h-9 w-9 shrink-0" />
                <div>
                  <p className="text-xs uppercase tracking-wide opacity-90">Estado de acreditación</p>
                  <p className="text-2xl font-bold leading-tight">{est.label}</p>
                </div>
              </div>
              <div className="p-5">
                <h1 className="text-xl font-bold text-slate-800">{d.nombre} {d.apellido}</h1>
                <div className="mt-2 grid grid-cols-2 gap-y-1.5 gap-x-3 text-sm">
                  <div><span className="text-slate-400">RUT</span><p className="font-medium text-slate-700">{d.rut}</p></div>
                  <div><span className="text-slate-400">Cargo</span><p className="font-medium text-slate-700">{d.cargo || '—'}</p></div>
                  <div className="col-span-2"><span className="text-slate-400">Empresa</span><p className="font-medium text-slate-700">{d.empresa}</p></div>
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <div className="relative shrink-0" style={{ width: 84, height: 84 }}>
                    <div className="rounded-full" style={{ width: 84, height: 84, background: `conic-gradient(${pctColor(d.pctTotal)} ${d.pctTotal * 3.6}deg, #e2e8f0 0deg)` }} />
                    <div className="absolute inset-[9px] rounded-full bg-white flex flex-col items-center justify-center">
                      <span className="text-lg font-bold" style={{ color: pctColor(d.pctTotal) }}>{d.pctTotal}%</span>
                      <span className="text-[9px] text-slate-400 -mt-0.5">cumple</span>
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-1.5">
                    {CHIPS.map(([k, label, cls]) => (
                      <div key={k} className={`rounded-lg px-2 py-1.5 ${cls}`}>
                        <div className="text-base font-bold leading-none">{d.docSummary?.[k] || 0}</div>
                        <div className="text-[10px] font-medium mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {(d.perMandante || []).length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Cumplimiento por mandante</p>
                <div className="space-y-3">
                  {d.perMandante.map((m, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1 gap-2">
                        <span className="text-slate-700 truncate">{m.mandante} <span className="text-xs text-slate-400">· {m.contrato}</span></span>
                        <span className="font-semibold shrink-0" style={{ color: pctColor(m.pct) }}>{m.pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${m.pct}%`, background: pctColor(m.pct) }} /></div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{m.ok}/{m.total} obligatorios</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-center text-xs text-slate-400">
              Validación en terreno · Aptiva RL · Holding Río Loa<br />
              {now.toLocaleString('es-CL', { timeZone: 'America/Santiago' })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
