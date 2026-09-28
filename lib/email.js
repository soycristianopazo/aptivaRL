import { query } from './db.js';

const EMAIL_BASE_URL = 'https://integrations.emergentagent.com';
const KEY = process.env.EMERGENT_EMAIL_KEY;
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'Aptiva RL - Holding Rio Loa';
const REPLY_TO = process.env.EMAIL_REPLY_TO;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || `${FROM_NAME} <onboarding@resend.dev>`;

export const emailConfigured = () => !!(RESEND_API_KEY || KEY);

const escapeHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Best-effort structural safety gate (defense in depth). No forms/inputs; links must be https/safe.
export function assertSafeEmail(subject, html) {
  if (/<\s*(form|input|textarea|select)\b/i.test(html)) throw new Error('El correo no puede contener formularios ni campos de entrada');
  const urls = [...String(html).matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const u of urls) {
    const low = (u || '').trim().toLowerCase();
    if (low.startsWith('mailto:') || low.startsWith('tel:') || low.startsWith('cid:') || low.startsWith('#')) continue;
    if (!low.startsWith('https://')) throw new Error(`Los enlaces del correo deben ser https absolutos: ${u}`);
  }
}

export async function sendEmail({ to, subject, html, replyTo, cc }) {
  assertSafeEmail(subject, html);
  const toArr = Array.isArray(to) ? to : [to];
  const ccArr = Array.isArray(cc) && cc.length ? cc : undefined;
  // Preferimos la cuenta propia de Resend del cliente si está configurada.
  if (RESEND_API_KEY) {
    const payload = { from: RESEND_FROM, to: toArr, subject, html };
    if (ccArr) payload.cc = ccArr;
    if (replyTo || REPLY_TO) payload.reply_to = replyTo || REPLY_TO;
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      throw new Error(`No se pudo enviar el correo (Resend ${resp.status}): ${t.slice(0, 200)}`);
    }
    return (await resp.json().catch(() => ({})))?.id || null;
  }
  if (!KEY) throw new Error('El envío de correos aún no está configurado.');
  const payload = { to: toArr, subject, html, from_name: FROM_NAME };
  if (ccArr) payload.cc = ccArr;
  if (replyTo || REPLY_TO) payload.contact_email = replyTo || REPLY_TO;
  const resp = await fetch(`${EMAIL_BASE_URL}/api/v1/email/send`, {
    method: 'POST',
    headers: { 'X-Email-Key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`No se pudo enviar el correo (${resp.status}): ${t.slice(0, 200)}`);
  }
  return (await resp.json().catch(() => ({})))?.id || null;
}

const diasLabel = (d) => {
  const n = Number(d);
  if (Number.isNaN(n)) return '—';
  if (n < 0) return `Venció, hace ${Math.abs(n)}d`;
  if (n === 0) return 'Vence hoy';
  return `${n} días`;
};

// Devuelve las filas del reporte agrupadas por mandante para un conjunto de mandantes.
// Incluye documentos aprobados con vencimiento <= hoy + 30 días (esto abarca todos los vencidos).
export async function buildVencimientosPorMandante(mandanteIds) {
  if (!Array.isArray(mandanteIds) || mandanteIds.length === 0) return [];
  const rows = (await query(`
    select d.documento_id, d.recurso_tipo, d.mandante_id,
      m.razon_social as mandante,
      coalesce(r.nombre, d.nombre_archivo) as documento,
      (d.fecha_vencimiento - current_date)::int as dias_restantes,
      d.fecha_vencimiento,
      t.rut as trab_rut, nullif(trim(concat(t.nombre,' ',t.apellido)),'') as trab_nombre,
      v.patente, nullif(trim(concat(coalesce(v.marca,''),' ',coalesce(v.modelo,''))),'') as veh_nombre,
      q.codigo_interno, q.tipo as equ_tipo,
      coalesce(tc.numero_oc, vc.numero_oc, qc.numero_oc) as contrato
    from documentos d
    left join requisitos_documentales r on r.requisito_id=d.requisito_id
    left join mandantes m on m.mandante_id=d.mandante_id
    left join trabajadores t on t.trabajador_id=d.recurso_id and d.recurso_tipo='trabajador'
    left join vehiculos v on v.vehiculo_id=d.recurso_id and d.recurso_tipo='vehiculo'
    left join equipos q on q.equipo_id=d.recurso_id and d.recurso_tipo='equipo'
    left join lateral (select ct.numero_oc from trabajador_asignaciones a join contratos ct on ct.contrato_id=a.contrato_id where a.trabajador_id=d.recurso_id and a.mandante_id=d.mandante_id and a.estado='activo' order by a.created_at desc limit 1) tc on d.recurso_tipo='trabajador'
    left join lateral (select ct.numero_oc from vehiculo_asignaciones a join contratos ct on ct.contrato_id=a.contrato_id where a.vehiculo_id=d.recurso_id and a.mandante_id=d.mandante_id and a.estado='activo' order by a.created_at desc limit 1) vc on d.recurso_tipo='vehiculo'
    left join lateral (select ct.numero_oc from equipo_asignaciones a join contratos ct on ct.contrato_id=a.contrato_id where a.equipo_id=d.recurso_id and a.mandante_id=d.mandante_id and a.estado='activo' order by a.created_at desc limit 1) qc on d.recurso_tipo='equipo'
    where d.deleted_at is null and d.estado='aprobado' and d.fecha_vencimiento is not null
      and coalesce(r.tiene_vencimiento, true) = true
      and d.recurso_tipo in ('trabajador','vehiculo','equipo')
      and d.fecha_vencimiento <= current_date + interval '30 days'
      and d.mandante_id = any($1::uuid[])
      and (
        (d.recurso_tipo='trabajador' and exists (select 1 from trabajador_asignaciones a where a.trabajador_id=d.recurso_id and a.mandante_id=d.mandante_id and a.estado='activo'))
        or (d.recurso_tipo='vehiculo' and exists (select 1 from vehiculo_asignaciones a where a.vehiculo_id=d.recurso_id and a.mandante_id=d.mandante_id and a.estado='activo'))
        or (d.recurso_tipo='equipo' and exists (select 1 from equipo_asignaciones a where a.equipo_id=d.recurso_id and a.mandante_id=d.mandante_id and a.estado='activo'))
      )
    order by d.mandante_id, (d.fecha_vencimiento - current_date), d.fecha_vencimiento
  `, [mandanteIds])).rows;

  const byMandante = new Map();
  for (const r of rows) {
    if (!byMandante.has(r.mandante_id)) byMandante.set(r.mandante_id, { mandante_id: r.mandante_id, mandante: r.mandante, rows: [] });
    const rut = r.trab_rut || r.patente || r.codigo_interno || '—';
    let nombre = '—';
    if (r.recurso_tipo === 'trabajador') nombre = r.trab_nombre || '—';
    else if (r.recurso_tipo === 'vehiculo') nombre = `Vehículo · ${r.veh_nombre || r.patente || ''}`.trim();
    else if (r.recurso_tipo === 'equipo') nombre = `Equipo · ${r.equ_tipo || r.codigo_interno || ''}`.trim();
    byMandante.get(r.mandante_id).rows.push({
      rut,
      nombre,
      documento: r.documento || '—',
      dias_restantes: r.dias_restantes,
      dias_label: diasLabel(r.dias_restantes),
      contrato: r.contrato || '—',
      mandante: r.mandante || '—',
    });
  }
  return [...byMandante.values()];
}

// Construye el HTML del correo para un mandante.
export function renderVencimientosEmail({ encargado, mandante, rows }) {
  const cellTh = 'style="border:1px solid #d0d7de;padding:6px 8px;background:#0f4c81;color:#fff;font-size:12px;text-align:left;font-weight:600"';
  const cellTd = 'style="border:1px solid #d0d7de;padding:6px 8px;font-size:12px;color:#24292f"';
  const cellTdV = 'style="border:1px solid #d0d7de;padding:6px 8px;font-size:12px;color:#b42318;font-weight:600"';
  const cellTdOk = 'style="border:1px solid #d0d7de;padding:6px 8px;font-size:12px;color:#9a6700;font-weight:600"';
  const headers = ['ID', 'RUT', 'Nombre', 'Documento', 'Días Por Vencer', 'Contrato', 'Mandante'];
  const trHead = `<tr>${headers.map((h) => `<th ${cellTh}>${escapeHtml(h)}</th>`).join('')}</tr>`;
  const body = rows.map((r, i) => {
    const diasCell = r.dias_restantes < 0 ? cellTdV : cellTdOk;
    return `<tr>
      <td ${cellTd}>${i + 1}</td>
      <td ${cellTd}>${escapeHtml(r.rut)}</td>
      <td ${cellTd}>${escapeHtml(r.nombre)}</td>
      <td ${cellTd}>${escapeHtml(r.documento)}</td>
      <td ${diasCell}>${escapeHtml(r.dias_label)}</td>
      <td ${cellTd}>${escapeHtml(r.contrato)}</td>
      <td ${cellTd}>${escapeHtml(r.mandante)}</td>
    </tr>`;
  }).join('');
  const table = `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin:16px 0">${trHead}${body}</table>`;
  const logoUrl = `${(process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '')}/manual/logo-rioloa-email.png`;
  const header = logoUrl.startsWith('https://')
    ? `<tr><td style="padding:16px 20px 10px;border-bottom:3px solid #1c9dd7"><img src="${logoUrl}" alt="Aptiva RL - Holding Río Loa" height="42" style="height:42px;width:auto;display:block;border:0" /></td></tr>`
    : `<tr><td style="padding:16px 20px 10px;border-bottom:3px solid #1c9dd7;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:18px;color:#0f4c81">Aptiva RL · Holding Río Loa</td></tr>`;
  const total = rows.length;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:900px">
    ${header}
    <tr><td style="font-family:Arial,Helvetica,sans-serif;color:#24292f;padding:20px">
    <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#0f4c81">Alerta de documentos por vencer y vencidos</p>
    <p style="margin:0 0 14px;font-size:13px;color:#64748b">${escapeHtml(mandante)} · ${total} documento(s)</p>
    <p style="margin:0 0 12px">Estimado(a) ${escapeHtml(encargado)},</p>
    <p style="margin:0 0 12px">Junto con saludar, le informamos el listado de documentos próximos a vencer y vencidos.</p>
    <p style="margin:0 0 12px">Agradeceremos tomar las acciones necesarias para su renovación o actualización, con el fin de evitar eventuales restricciones o bloqueos de acceso a faena.</p>
    ${table}
    <p style="margin:12px 0 0">Quedamos atentos ante cualquier consulta.</p>
    <p style="margin:12px 0 0">Atentamente,</p>
    <p style="margin:4px 0 0;font-weight:600">${escapeHtml(FROM_NAME)}</p>
  </td></tr></table>`;
}

// Usuarios marcados para recibir copia (CC) de las alertas.
// global = ve todo (RR.HH. global / Super Admin Holding) -> copia de todos los mandantes;
// el resto solo recibe copia de los mandantes que tenga asignados.
export async function getCopiaUsuarios() {
  return (await query(`
    select up.perfil_id, up.nombre, up.email, up.role_codigo,
      (up.role_codigo in ('MANDANTE_RRHH','SUPER_ADMIN_HOLDING')) as global,
      coalesce((select array_agg(um.mandante_id) from usuario_mandantes um where um.perfil_id=up.perfil_id), '{}') as mandante_ids
    from usuarios_perfiles up
    where up.copia_email=true and up.activo=true and up.email is not null
  `)).rows;
}

// Construye la lista de correos (uno por mandante con documentos) para un administrador.
// excludeEmail = correo del destinatario principal (para no duplicarlo en copia).
export async function buildCorreosParaAdmin({ encargado, mandanteIds, excludeEmail }) {
  const grupos = await buildVencimientosPorMandante(mandanteIds);
  const conDocs = grupos.filter((g) => g.rows.length > 0);
  const copia = await getCopiaUsuarios();
  const exclude = (excludeEmail || '').toLowerCase();
  return conDocs.map((g) => {
    const seen = new Set();
    const cc = [];
    for (const u of copia) {
      const em = (u.email || '').toLowerCase();
      if (!em || em === exclude || seen.has(em)) continue;
      const aplica = u.global || (Array.isArray(u.mandante_ids) && u.mandante_ids.includes(g.mandante_id));
      if (aplica) { seen.add(em); cc.push({ nombre: u.nombre, email: u.email }); }
    }
    return {
      mandante_id: g.mandante_id,
      mandante: g.mandante,
      count: g.rows.length,
      subject: `Documentos por vencer y vencidos · ${g.mandante}`,
      rows: g.rows,
      cc,
      cc_emails: cc.map((x) => x.email),
      html: renderVencimientosEmail({ encargado, mandante: g.mandante, rows: g.rows }),
    };
  });
}
