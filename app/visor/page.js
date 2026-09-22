'use client';

import { useEffect, useState, useRef } from 'react';
import logoRioLoa from '@/assets/logo-rioloa.png';

const API = '/api';
const QKEY = 'visor_queue';

export default function VisorPage() {
  const [tipo, setTipo] = useState('ingreso');
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);
  const [log, setLog] = useState([]);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [punto, setPunto] = useState(null);      // objeto punto resuelto
  const [estado, setEstado] = useState('loading'); // loading | ok | error
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef(null);
  const focus = () => inputRef.current && inputRef.current.focus();

  const readQueue = () => { try { return JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch { return []; } };
  const writeQueue = (q) => { localStorage.setItem(QKEY, JSON.stringify(q)); setPending(q.length); };

  const loadLog = async () => { try { const r = await fetch(`${API}/public/accesos`); const d = await r.json(); setLog(d.accesos || []); setOnline(true); } catch { setOnline(false); } };

  const flush = async () => {
    let q = readQueue();
    if (!q.length) return;
    const rest = [];
    for (const item of q) {
      try {
        const r = await fetch(`${API}/public/acceso`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
        if (!r.ok) rest.push(item);
      } catch { rest.push(item); }
    }
    writeQueue(rest);
    if (rest.length < q.length) loadLog();
  };

  // Resuelve el punto de acceso desde la URL (?punto=slug). Con timeout + reintentos
  // automáticos para tolerar redes/PDA inestables (una petición colgada no deja el visor pegado).
  const resolvePunto = async () => {
    let slug = '';
    try { slug = new URLSearchParams(window.location.search).get('punto') || ''; } catch {}
    slug = slug.trim();
    if (!slug) { setEstado('error'); setErrorMsg('La URL no indica el punto de acceso. Solicite a Administración el enlace correcto para este visor (debe incluir ?punto=…).'); return; }
    for (let intento = 1; intento <= 4; intento++) {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 8000);
      try {
        const r = await fetch(`${API}/public/punto?slug=${encodeURIComponent(slug)}`, { signal: ctrl.signal, cache: 'no-store' });
        clearTimeout(to);
        const d = await r.json();
        if (r.ok) { setPunto(d.punto); setEstado('ok'); setTimeout(focus, 50); return; }
        // Punto inexistente/inactivo o petición inválida: no reintentar
        setEstado('error'); setErrorMsg(d.error || 'No se pudo validar el punto de acceso.'); return;
      } catch (e) {
        clearTimeout(to);
        if (intento < 4) { await new Promise((res) => setTimeout(res, 700 * intento)); continue; }
        setEstado('error'); setErrorMsg('No se pudo validar el punto de acceso (sin conexión o tiempo de espera agotado). Verifique el enlace e intente nuevamente.');
      }
    }
  };

  useEffect(() => {
    setPending(readQueue().length);
    resolvePunto();
    loadLog();
    const on = () => { setOnline(true); flush(); };
    const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    const iv = setInterval(() => { flush(); }, 15000);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); clearInterval(iv); };
  }, []); // eslint-disable-line

  const registrar = async () => {
    const value = val.trim();
    if (!value || busy || !punto) return;
    setBusy(true);
    const payload = { raw: value, tipo, punto_id: punto.id, punto_nombre: punto.nombre, marcado_at: new Date().toISOString() };
    try {
      const r = await fetch(`${API}/public/acceso`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      setLast(d); setVal(''); setOnline(true); loadLog(); flush();
    } catch (e) {
      // Sin conexión: guardar localmente para subir después
      const q = readQueue(); q.push(payload); writeQueue(q);
      setOnline(false);
      setLast({ offline: true, rut_limpio: value, tipo });
      setVal('');
    } finally { setBusy(false); setTimeout(focus, 50); }
  };

  const fhora = (s) => { try { return new Date(s).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
  const okIngreso = tipo === 'ingreso';

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0e4f57] via-[#0c454c] to-[#08343a] flex items-center justify-center p-0 sm:p-6">
      <div className="w-full sm:max-w-[420px] min-h-screen sm:min-h-0 sm:h-[880px] sm:max-h-[94vh] bg-slate-100 sm:rounded-[2.2rem] sm:border-[10px] sm:border-slate-900 sm:shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white px-5 pt-5 pb-3 border-b flex flex-col items-center gap-1">
          <img src={logoRioLoa.src} alt="Río Loa" className="h-9 w-auto" />
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Control de acceso</p>
          {estado === 'ok' && (
            <div className="w-full flex items-center justify-center gap-2 mt-1">
              <span className="text-sm font-bold text-slate-800 text-center truncate">{punto.nombre}{punto.ubicacion ? ` · ${punto.ubicacion}` : ''}</span>
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${online ? 'bg-emerald-500' : 'bg-red-500'}`} title={online ? 'En línea' : 'Sin conexión'} />
            </div>
          )}
          {estado === 'ok' && pending > 0 && <p className="text-[11px] text-amber-600 font-medium">{pending} marca(s) pendiente(s) de subir</p>}
        </div>

        {estado === 'loading' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-400">
            <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-[#1c9dd7] animate-spin mb-3" />
            <p className="text-sm">Validando punto de acceso…</p>
          </div>
        )}

        {estado === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="h-16 w-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-3xl mb-4">⚠</div>
            <p className="text-lg font-bold text-slate-800 mb-2">Punto de acceso no válido</p>
            <p className="text-sm text-slate-500 leading-snug">{errorMsg}</p>
            <button onClick={() => { setEstado('loading'); resolvePunto(); }} className="mt-5 h-11 px-6 rounded-xl bg-[#1c9dd7] text-white font-semibold active:bg-[#1789bf]">Reintentar</button>
          </div>
        )}

        {estado === 'ok' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={() => { setTipo('ingreso'); focus(); }} className={`rounded-2xl border-2 py-5 font-bold text-base transition-all ${okIngreso ? 'border-emerald-500 bg-emerald-500 text-white shadow-lg' : 'border-slate-200 bg-white text-slate-400'}`}><span className="block text-2xl mb-0.5">↓</span>INGRESO</button>
              <button onClick={() => { setTipo('salida'); focus(); }} className={`rounded-2xl border-2 py-5 font-bold text-base transition-all ${!okIngreso ? 'border-[#1c9dd7] bg-[#1c9dd7] text-white shadow-lg' : 'border-slate-200 bg-white text-slate-400'}`}><span className="block text-2xl mb-0.5">↑</span>SALIDA</button>
            </div>

            <div className="bg-white rounded-2xl border p-4">
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Escanee la cédula (QR/2D) o digite el RUT</label>
              <form onSubmit={(e) => { e.preventDefault(); registrar(); }} className="space-y-2.5">
                <input ref={inputRef} autoComplete="off" autoCapitalize="off" spellCheck={false} value={val} onChange={(e) => setVal(e.target.value)} placeholder="Esperando lectura…" className="w-full h-12 rounded-xl border border-slate-300 px-4 text-lg outline-none focus:ring-2 focus:ring-[#1c9dd7]" />
                <button type="submit" disabled={busy} className={`w-full h-12 rounded-xl font-semibold text-white text-base ${okIngreso ? 'bg-emerald-600 active:bg-emerald-700' : 'bg-[#1c9dd7] active:bg-[#1789bf]'} disabled:opacity-60`}>{busy ? 'Registrando…' : 'Registrar'}</button>
              </form>
              <p className="text-[11px] text-slate-400 mt-2 leading-snug">El lector 2D actúa como teclado: al escanear se registra automáticamente. El RUT se limpia solo. Se registra sin importar el estado de acreditación.</p>
            </div>

            {last && last.offline && <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-center"><div className="h-14 w-14 mx-auto rounded-full flex items-center justify-center text-2xl mb-2 bg-amber-400 text-white">⏳</div><p className="font-bold text-amber-700">Guardado sin conexión</p><p className="text-sm text-slate-500">{last.rut_limpio} · {last.tipo}</p><p className="text-xs text-slate-400 mt-1">Se subirá automáticamente al recuperar conexión.</p></div>}
            {last && !last.offline && (
              <div className={`rounded-2xl border-2 p-4 text-center ${last.encontrado ? (last.tipo === 'ingreso' ? 'border-emerald-300 bg-emerald-50' : 'border-sky-300 bg-sky-50') : 'border-amber-300 bg-amber-50'}`}>
                <div className={`h-16 w-16 mx-auto rounded-full flex items-center justify-center text-3xl mb-2 ${last.encontrado ? (last.tipo === 'ingreso' ? 'bg-emerald-500 text-white' : 'bg-[#1c9dd7] text-white') : 'bg-amber-400 text-white'}`}>{last.encontrado ? '✓' : '!'}</div>
                {last.encontrado
                  ? <><p className="text-lg font-bold text-slate-800 leading-tight">{last.trabajador.nombre} {last.trabajador.apellido}</p><p className="text-sm text-slate-500">{last.trabajador.rut}{last.trabajador.cargo ? ` · ${last.trabajador.cargo}` : ''}</p></>
                  : <><p className="text-lg font-bold text-amber-700">RUT no registrado</p><p className="text-sm text-slate-500">{last.rut_limpio}</p></>}
                <p className={`mt-2 inline-block text-sm font-semibold px-3 py-1 rounded-full ${last.tipo === 'ingreso' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-[#1789bf]'}`}>{last.tipo === 'ingreso' ? 'INGRESO' : 'SALIDA'} · {fhora(last.hora)}</p>
                {last.auto_ingreso && <p className="text-[11px] text-slate-500 mt-1">Se registró un ingreso automático previo (no tenía ingreso abierto).</p>}
              </div>
            )}

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2 px-1">Últimos movimientos</p>
              <div className="space-y-1.5">
                {log.length === 0 && <p className="text-sm text-slate-400 px-1">Sin registros</p>}
                {log.map((a) => (
                  <div key={a.id} className="flex items-center gap-2.5 rounded-xl border bg-white px-3 py-2">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${a.tipo === 'ingreso' ? 'bg-emerald-500' : 'bg-[#1c9dd7]'}`} />
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-800 truncate">{a.nombre || a.rut}</p>{a.punto_nombre && <p className="text-[10px] text-slate-400 truncate">{a.punto_nombre}</p>}</div>
                    <div className="text-right shrink-0"><span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${a.tipo === 'ingreso' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-[#1789bf]'}`}>{a.tipo}</span><p className="text-[10px] text-slate-400 mt-0.5">{fhora(a.marcado_at || a.created_at)}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white border-t px-4 py-2 text-center text-[10px] text-slate-400">Holding Río Loa · Plataforma Aptiva</div>
      </div>
    </div>
  );
}
