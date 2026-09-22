// Manuales de usuario de la Plataforma Aptiva (Holding Río Loa).
// Documento HTML con diseño profesional: portada, infografías y "capturas"
// simuladas con datos ficticios pero realistas. Se ve en pantalla y se exporta
// a PDF mediante la vista de impresión del navegador (Guardar como PDF).
//
// Contexto clave: TODOS los usuarios son personal de Holding Río Loa. Los
// "mandantes" son los CLIENTES de Río Loa (ej. Albemarle, SQM, CBB Cales) a los
// que cada usuario está asignado (uno o varios).

export const MANUALES = [
  {
    id: 'super_admin',
    perfil: 'Super Administrador Holding',
    rolCorto: 'Super Admin',
    color: '#1c9dd7',
    alcance:
      'Personal de Holding Río Loa con acceso total a la plataforma. Administra las tres empresas de Río Loa, todos los mandantes (clientes) y sus contratos, usuarios, control de acceso, mantenedores y reportes.',
    puede: [
      'Ver y gestionar TODOS los mandantes (clientes) y contratos',
      'Crear y administrar usuarios de Río Loa y sus mandantes asignados',
      'Cargar, aprobar y rechazar documentos',
      'Configurar puntos de acceso (porterías) y ver el reporte de ingresos/salidas',
      'Acceder a Empresas, Mantenedores y Auditoría',
    ],
    noPuede: ['Eliminar el propio usuario con el que está conectado'],
    secciones: [
      { titulo: 'Ingreso a la plataforma', extra: 'login', pasos: [
        'Abra la plataforma en su navegador e ingrese con su correo corporativo de Río Loa y su contraseña.',
        'Presione «Ingresar». Si los datos son correctos se abre el Dashboard.',
        'El menú lateral izquierdo agrupa todo por: Operación, Recursos, Acreditación y Administración.',
      ] },
      { titulo: 'Dashboard', extra: 'dashboard', pasos: [
        'Muestra los indicadores del Holding: mandantes activos, contratos vigentes, trabajadores, acreditados, bloqueados y documentos por revisar, por vencer y vencidos.',
        'Use los filtros de Empresa y Mandante para acotar; presione «Limpiar» para volver a la vista global.',
        'En «Expediente» busque cualquier trabajador, vehículo o equipo por nombre, RUT o patente, abra su ficha o imprima su expediente.',
      ] },
      { titulo: 'Empresas, Mandantes y Contratos', extra: 'mandantes', pasos: [
        'Administración → Empresas: las tres empresas de Río Loa que agrupan a sus trabajadores, vehículos y equipos.',
        'Operación → Mandantes: cada cliente de Río Loa, con sus contratos, categorías, requisitos (documentos exigidos) y usuarios asignados.',
        'Operación → Contratos: detalle y dotación de cada contrato (trabajadores, vehículos y equipos asignados).',
      ] },
      { titulo: 'Trabajadores, Vehículos y Equipos', extra: 'recursos', pasos: [
        'Recursos → Trabajadores: cree, edite, desactive y asigne trabajadores a contratos; cargue y revise sus documentos.',
        'Recursos → Vehículos y Equipos: administre el parque, asigne mandantes, defina operador/conductor y gestione la disponibilidad (Disponible, En mantención, Fuera de servicio).',
        'Botón «QR»: genera el código de trabajador, vehículo o equipo; al escanearlo se abre el expediente público de validación en terreno.',
      ] },
      { titulo: 'Acreditación documental', extra: 'estados', pasos: [
        'En la ficha de cada recurso, pestaña «Documentación», presione «Cargar» en el requisito correspondiente (indique la fecha de vencimiento cuando aplique).',
        'Acreditación → Pendientes de Revisión: apruebe o rechace los documentos cargados (al rechazar, indique el motivo).',
        'Acreditación → Vencimientos: filtre por tramos de días, abra el documento y exporte a Excel.',
        'Acreditación → Personal Finiquitado: registre y consulte las desvinculaciones (finiquito o anexo de traslado).',
      ] },
      { titulo: 'Usuarios', extra: 'usuarios', pasos: [
        'Administración → Usuarios: cree, edite y elimine usuarios.',
        'Defina nombre, correo, teléfono, rol y estado (activo/inactivo).',
        'Asigne uno o varios mandantes (clientes) a los perfiles de mandante: Administrador, RR.HH., Visor y Prevención.',
      ] },
      { titulo: 'Control de Acceso (Porterías)', extra: 'acceso', pasos: [
        'Administración → Control de Acceso → pestaña «Puntos de acceso»: cree cada portería/visor con su nombre y ubicación.',
        'El sistema genera automáticamente la URL del visor; use «Copiar URL» y ábrala en la PDA de la portería.',
        'Pestaña «Reporte»: consulte todos los ingresos y salidas con filtros por fecha, punto y trabajador/RUT, y expórtelos a Excel.',
        'El visor registra ingresos y salidas SIN importar el estado de acreditación; si se marca una salida sin ingreso previo, el sistema crea el ingreso automáticamente.',
      ] },
      { titulo: 'Mantenedores y Auditoría', pasos: [
        'Administración → Mantenedores: configure los catálogos base de la plataforma.',
        'Administración → Auditoría: revise el registro de acciones realizadas por los usuarios.',
      ] },
    ],
  },
  {
    id: 'prevencion',
    perfil: 'Prevención / APR',
    rolCorto: 'Prevención',
    color: '#16a34a',
    alcance:
      'Personal de Prevención de Riesgos (APR) de Holding Río Loa, asignado a uno o varios mandantes (clientes). Ve y carga documentos —principalmente de vehículos, equipos y seguridad—. No aprueba ni rechaza documentos y no realiza desvinculaciones.',
    puede: [
      'Ver los recursos y su acreditación de sus mandantes asignados',
      'Cargar documentos (vehículos, equipos y seguridad)',
      'Consultar y exportar Vencimientos',
    ],
    noPuede: [
      'Aprobar o rechazar documentos',
      'Desvincular (finiquitar) personal',
      'Ver Administración (Empresas, Usuarios, Mantenedores, Auditoría)',
    ],
    secciones: [
      { titulo: 'Ingreso y alcance', extra: 'login', pasos: [
        'Ingrese con su correo y contraseña de Río Loa. Verá únicamente los mandantes (clientes) que le fueron asignados.',
        'El menú muestra Dashboard, Recursos y Acreditación. No verá las secciones de Administración.',
      ] },
      { titulo: 'Dashboard y Expediente', extra: 'dashboard', pasos: [
        'Revise los indicadores acotados a sus mandantes: recursos acreditados, bloqueados y documentos por vencer o vencidos.',
        'Use el buscador «Expediente» para ubicar rápidamente un trabajador, vehículo o equipo.',
      ] },
      { titulo: 'Consulta de recursos', extra: 'recursos', pasos: [
        'Recursos → Vehículos y Equipos: abra la ficha para ver documentación, asignaciones, operador y disponibilidad.',
        'Recursos → Trabajadores: consulte la ficha y su estado de acreditación por mandante.',
      ] },
      { titulo: 'Carga de documentos', extra: 'ficha', pasos: [
        'Abra la ficha del recurso y vaya a la pestaña «Documentación».',
        'Ubique el requisito correspondiente (por mandante) y presione «Cargar».',
        'Adjunte el archivo (PDF/imagen), indique la fecha de vencimiento cuando aplique y presione «Subir».',
        'El documento queda «En revisión» hasta que RR.HH. o un administrador lo apruebe o rechace.',
      ] },
      { titulo: 'Vencimientos', extra: 'vencimientos', pasos: [
        'Acreditación → Vencimientos: revise los documentos próximos a vencer o vencidos de sus mandantes.',
        'Filtre por tramo de días, abra el documento y exporte a Excel.',
        'Coordine con anticipación la renovación de lo que esté por vencer.',
      ] },
    ],
  },
  {
    id: 'visor',
    perfil: 'Visor',
    rolCorto: 'Visor',
    color: '#7c3aed',
    alcance:
      'Personal de Holding Río Loa con acceso de SOLO LECTURA a uno o varios mandantes (clientes). Consulta información, fichas y acreditación. No carga, no revisa ni desvincula, y no tiene acceso al documento «Contrato de trabajo».',
    puede: [
      'Consultar fichas, documentos y acreditación de sus mandantes asignados',
      'Buscar y ver expedientes; imprimir el expediente de un recurso',
      'Consultar y exportar Vencimientos',
    ],
    noPuede: [
      'Cargar, aprobar o rechazar documentos',
      'Desvincular personal',
      'Ver el documento «Contrato de trabajo»',
      'Ver Administración',
    ],
    secciones: [
      { titulo: 'Ingreso y alcance', extra: 'login', pasos: [
        'Ingrese con su correo y contraseña de Río Loa. Verá solo los mandantes (clientes) asignados a su perfil.',
        'El menú muestra Dashboard, Recursos y Acreditación en modo consulta. No verá Administración.',
        'Su perfil es de solo lectura: no aparecerán botones para cargar, aprobar, rechazar ni desvincular.',
      ] },
      { titulo: 'Dashboard y Expediente', extra: 'dashboard', pasos: [
        'Consulte los indicadores de sus mandantes en el Dashboard.',
        'Use el buscador «Expediente» para encontrar un trabajador, vehículo o equipo y ver su cumplimiento documental.',
        'Puede imprimir el expediente de un recurso desde el botón «Imprimir».',
      ] },
      { titulo: 'Consulta de fichas y documentos', extra: 'ficha', pasos: [
        'Recursos → Trabajadores, Vehículos o Equipos: abra una ficha para ver su documentación y estado por mandante.',
        'Podrá visualizar los documentos disponibles y su estado (Aprobado, En revisión, Vencido, etc.).',
        'Importante: el documento «Contrato de trabajo» no está disponible para este perfil en ningún mandante.',
      ] },
      { titulo: 'Vencimientos', extra: 'vencimientos', pasos: [
        'Acreditación → Vencimientos: consulte los documentos por vencer y vencidos de sus mandantes.',
        'Filtre por tramo de días y exporte a Excel para su seguimiento.',
      ] },
    ],
  },
  {
    id: 'rrhh',
    perfil: 'RR.HH.',
    rolCorto: 'RR.HH.',
    color: '#ea580c',
    alcance:
      'Personal de Recursos Humanos de Holding Río Loa, asignado a uno o varios mandantes (clientes). Ve, carga y revisa (aprueba/rechaza) documentos de trabajadores, y realiza desvinculaciones (finiquitos).',
    puede: [
      'Ver y buscar personal de sus mandantes asignados',
      'Cargar documentos de trabajadores',
      'Aprobar o rechazar documentos en Pendientes de Revisión',
      'Registrar desvinculaciones (finiquitos)',
      'Consultar y exportar Vencimientos',
    ],
    noPuede: [
      'Ver Administración (Empresas, Usuarios, Mantenedores, Auditoría)',
      'Gestionar mandantes de otros clientes no asignados',
    ],
    secciones: [
      { titulo: 'Ingreso y alcance', extra: 'login', pasos: [
        'Ingrese con su correo y contraseña de Río Loa. Verá únicamente los mandantes (clientes) asignados a su perfil.',
        'El menú muestra Dashboard, Recursos y Acreditación (incluye Pendientes de Revisión y Personal Finiquitado). No verá Administración.',
      ] },
      { titulo: 'Trabajadores', extra: 'trabajadores', pasos: [
        'Recursos → Trabajadores: consulte y busque personal de sus mandantes.',
        'Abra la ficha de un trabajador para ver documentación, asignaciones y acreditación por mandante.',
      ] },
      { titulo: 'Carga de documentos', extra: 'ficha', pasos: [
        'En la ficha del trabajador, pestaña «Documentación», presione «Cargar» en el requisito correspondiente.',
        'Adjunte el archivo, indique la fecha de vencimiento cuando aplique y presione «Subir».',
        'El documento queda «En revisión» a la espera de aprobación.',
      ] },
      { titulo: 'Revisión de documentos', extra: 'revision', pasos: [
        'Acreditación → Pendientes de Revisión: verá los documentos que esperan revisión.',
        'Presione «Aprobar» si el documento es correcto.',
        'Presione «Rechazar» e indique el motivo si no cumple; el responsable deberá volver a cargarlo.',
      ] },
      { titulo: 'Vencimientos', extra: 'vencimientos', pasos: [
        'Acreditación → Vencimientos: revise lo próximo a vencer o vencido de sus mandantes.',
        'Filtre por tramo de días, abra el documento y exporte a Excel.',
      ] },
      { titulo: 'Personal Finiquitado (Desvinculación)', extra: 'finiquito', pasos: [
        'Acreditación → Personal Finiquitado: registre la desvinculación de un trabajador.',
        'Adjunte el documento de respaldo (finiquito o anexo de traslado) e indique la causal cuando corresponda.',
        'La asignación al contrato queda inactiva y podrá consultar el histórico de finiquitos.',
      ] },
    ],
  },
];

/* ============================ Infografías / capturas simuladas ============================ */
// Datos ficticios pero realistas. Mandantes = clientes reales de Río Loa.

const chip = (txt, bg, fg) => `<span class="md-chip" style="background:${bg};color:${fg}">${txt}</span>`;

const EXTRAS = {
  login: () => `
    <div class="md-shot">
      <div class="md-shot-cap">Pantalla de inicio de sesión</div>
      <div class="md-login">
        <div class="md-login-side"><div class="md-wm md-wm-lg"><span>RÍO</span><b>LOA</b></div><p>Gestión documental y acreditación de recursos · Holding Río Loa</p></div>
        <div class="md-login-form">
          <h4>Iniciar sesión</h4>
          <label>Correo</label><div class="md-input">jperez@rioloa.cl</div>
          <label>Contraseña</label><div class="md-input">••••••••</div>
          <div class="md-btn md-btn-blue" style="text-align:center">Ingresar</div>
        </div>
      </div>
    </div>`,

  dashboard: () => `
    <div class="md-shot">
      <div class="md-shot-cap">Dashboard · indicadores del Holding</div>
      <div class="md-kpis">
        ${[['Mandantes activos','14'],['Contratos vigentes','19'],['Trabajadores','324'],['Acreditados','188'],['Bloqueados','96'],['Docs. por vencer','40']]
          .map(([l,v])=>`<div class="md-kpi"><div class="md-kpi-v">${v}</div><div class="md-kpi-l">${l}</div></div>`).join('')}
      </div>
      <div class="md-note">Filtros de <b>Empresa</b> y <b>Mandante</b> permiten acotar los números a un cliente específico.</div>
    </div>`,

  mandantes: () => `
    <div class="md-shot">
      <div class="md-shot-cap">Mandantes · clientes de Río Loa</div>
      <div class="md-mand">
        ${['Albemarle Limitada','SQM Salar S.A.','CBB Cales S.A.','HMC Gold SCM','Aceros AZA S.A.','Minera El Abra']
          .map(m=>`<div class="md-mand-card"><span class="md-dot"></span>${m}</div>`).join('')}
      </div>
      <div class="md-note">Cada mandante es un <b>cliente</b> de Holding Río Loa con sus contratos y requisitos documentales propios.</div>
    </div>`,

  recursos: () => `
    <div class="md-shot">
      <div class="md-shot-cap">Recursos → Trabajadores</div>
      <table class="md-tbl">
        <thead><tr><th>Trabajador</th><th>RUT</th><th>Empresa Río Loa</th><th>Acreditación</th></tr></thead>
        <tbody>
          <tr><td>Juan Pérez Soto</td><td>12.345.678-9</td><td>Maq. y Construcciones Río Loa</td><td>${chip('Acreditado','#dcfce7','#166534')}</td></tr>
          <tr><td>María González Rojas</td><td>9.876.543-2</td><td>Muellaje Río Loa</td><td>${chip('Bloqueado','#fee2e2','#991b1b')}</td></tr>
          <tr><td>Pedro Muñoz Díaz</td><td>15.222.333-4</td><td>RL Maquinarias y Servicios</td><td>${chip('En revisión','#e0f2fe','#075985')}</td></tr>
        </tbody>
      </table>
    </div>`,

  trabajadores: () => EXTRAS.recursos(),

  estados: () => `
    <div class="md-info">
      <div class="md-info-title">Estados de un documento</div>
      <div class="md-states">
        <div class="md-state">${chip('Faltante','#f1f5f9','#475569')}<span>Aún no se ha cargado</span></div>
        <div class="md-state">${chip('En revisión','#e0f2fe','#075985')}<span>Cargado, esperando aprobación</span></div>
        <div class="md-state">${chip('Aprobado','#dcfce7','#166534')}<span>Válido y vigente</span></div>
        <div class="md-state">${chip('Rechazado','#fee2e2','#991b1b')}<span>No cumple, recargar</span></div>
        <div class="md-state">${chip('Vencido','#ffedd5','#9a3412')}<span>Venció, renovar</span></div>
      </div>
      <div class="md-flow">
        <span>Cargar</span><i>→</i><span>En revisión</span><i>→</i><span>Aprobado</span><i>→</i><span>Vencido (renovar)</span>
      </div>
    </div>`,

  ficha: () => `
    <div class="md-shot">
      <div class="md-shot-cap">Ficha del recurso → pestaña «Documentación»</div>
      <div class="md-doc">
        <div class="md-doc-h">Albemarle Limitada · Requisitos</div>
        <div class="md-doc-row"><span>Examen preocupacional</span>${chip('Aprobado','#dcfce7','#166534')}<span class="md-mini-btn">Cargar</span></div>
        <div class="md-doc-row"><span>Inducción de seguridad</span>${chip('En revisión','#e0f2fe','#075985')}<span class="md-mini-btn">Cargar</span></div>
        <div class="md-doc-row"><span>Licencia de conducir clase D</span>${chip('Vencido','#ffedd5','#9a3412')}<span class="md-mini-btn">Cargar</span></div>
        <div class="md-doc-row"><span>Curso de altura física</span>${chip('Faltante','#f1f5f9','#475569')}<span class="md-mini-btn">Cargar</span></div>
      </div>
    </div>`,

  revision: () => `
    <div class="md-shot">
      <div class="md-shot-cap">Acreditación → Pendientes de Revisión</div>
      <table class="md-tbl">
        <thead><tr><th>Trabajador</th><th>Documento</th><th>Mandante</th><th>Acción</th></tr></thead>
        <tbody>
          <tr><td>Juan Pérez Soto</td><td>Examen preocupacional</td><td>Albemarle</td><td><span class="md-mini-btn md-ok">Aprobar</span> <span class="md-mini-btn md-no">Rechazar</span></td></tr>
          <tr><td>Pedro Muñoz Díaz</td><td>Inducción de seguridad</td><td>SQM Salar</td><td><span class="md-mini-btn md-ok">Aprobar</span> <span class="md-mini-btn md-no">Rechazar</span></td></tr>
        </tbody>
      </table>
      <div class="md-note">Al <b>rechazar</b> se solicita el motivo; el responsable deberá volver a cargar el documento.</div>
    </div>`,

  vencimientos: () => `
    <div class="md-shot">
      <div class="md-shot-cap">Acreditación → Vencimientos</div>
      <div class="md-tramos">
        ${['Vencidos','1-15 días','16-30','31-60','61-90','+90'].map((t,i)=>`<span class="md-tramo ${i===0?'md-tramo-red':''}">${t}</span>`).join('')}
      </div>
      <table class="md-tbl">
        <thead><tr><th>Recurso</th><th>Documento</th><th>Mandante</th><th>Vence en</th></tr></thead>
        <tbody>
          <tr><td>Camión CVYY-75</td><td>Revisión técnica</td><td>CBB Cales</td><td>${chip('Vencido','#fee2e2','#991b1b')}</td></tr>
          <tr><td>María González Rojas</td><td>Examen altura</td><td>Albemarle</td><td>${chip('8 días','#ffedd5','#9a3412')}</td></tr>
          <tr><td>Grúa EQ-014</td><td>Certificación GPS</td><td>SQM Salar</td><td>${chip('45 días','#fef9c3','#854d0e')}</td></tr>
        </tbody>
      </table>
    </div>`,

  usuarios: () => `
    <div class="md-shot">
      <div class="md-shot-cap">Administración → Usuarios (personal de Río Loa)</div>
      <table class="md-tbl">
        <thead><tr><th>Usuario</th><th>Rol</th><th>Mandantes asignados</th><th>Estado</th></tr></thead>
        <tbody>
          <tr><td>Ana Torres Vega</td><td>${chip('RR.HH.','#ffedd5','#9a3412')}</td><td>Albemarle, SQM Salar</td><td>${chip('Activo','#dcfce7','#166534')}</td></tr>
          <tr><td>Luis Rojas Pinto</td><td>${chip('Prevención','#dcfce7','#166534')}</td><td>CBB Cales</td><td>${chip('Activo','#dcfce7','#166534')}</td></tr>
          <tr><td>Carla Díaz Soto</td><td>${chip('Visor','#ede9fe','#5b21b6')}</td><td>HMC Gold, Aceros AZA</td><td>${chip('Activo','#dcfce7','#166534')}</td></tr>
        </tbody>
      </table>
      <div class="md-note">Un usuario de Río Loa puede estar asignado a <b>uno o varios</b> mandantes (clientes).</div>
    </div>`,

  acceso: () => `
    <div class="md-info">
      <div class="md-info-title">Control de Acceso en portería (visor)</div>
      <div class="md-acc">
        <div class="md-phone">
          <div class="md-phone-top"><div class="md-wm"><span>RÍO</span><b>LOA</b></div><small>CONTROL DE ACCESO</small><div class="md-phone-pt">Portería Principal · Mejillones</div></div>
          <div class="md-phone-btns"><div class="md-phone-in">↓ INGRESO</div><div class="md-phone-out">↑ SALIDA</div></div>
          <div class="md-input" style="text-align:center">Escanee la cédula o digite el RUT</div>
        </div>
        <div class="md-acc-txt">
          <div class="md-flow"><span>Escanear cédula / RUT</span><i>→</i><span>Ingreso o Salida</span><i>→</i><span>Registro</span></div>
          <ul>
            <li>Cada portería tiene su propia URL (ej. <code>/visor?punto=porteria-principal</code>).</li>
            <li>Registra <b>sin importar</b> el estado de acreditación.</li>
            <li>Si se marca una salida sin ingreso previo, el sistema crea el ingreso automáticamente.</li>
          </ul>
        </div>
      </div>
    </div>`,

  finiquito: () => `
    <div class="md-shot">
      <div class="md-shot-cap">Acreditación → Personal Finiquitado</div>
      <div class="md-doc">
        <div class="md-doc-h">Registrar desvinculación</div>
        <div class="md-doc-row"><span>Trabajador: Pedro Muñoz Díaz · 15.222.333-4</span></div>
        <div class="md-doc-row"><span>Documento de respaldo (finiquito / anexo)</span><span class="md-mini-btn">Adjuntar</span></div>
        <div class="md-doc-row"><span>Causal: Término de contrato</span></div>
      </div>
      <div class="md-note">La asignación al contrato queda <b>inactiva</b>; el histórico de finiquitos queda disponible para consulta.</div>
    </div>`,
};

/* ============================ Estilos + armado del documento ============================ */

function estilos(acc) {
  return `
  .manualdoc{--acc:${acc};font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;background:#fff;}
  .manualdoc *{box-sizing:border-box;}
  .manualdoc .md-page{max-width:820px;margin:0 auto;padding:0 6px 28px;}
  .manualdoc h2{font-size:17px;color:var(--acc);margin:26px 0 10px;padding-bottom:6px;border-bottom:2px solid var(--acc);break-after:avoid;}
  .manualdoc p{font-size:12.5px;line-height:1.55;margin:0 0 8px;}
  /* Portada */
  .manualdoc .md-cover{background:linear-gradient(135deg,#0f4d55,#0a3940);color:#fff;border-radius:14px;padding:26px 26px 22px;margin-bottom:18px;}
  .manualdoc .md-wm{display:inline-flex;align-items:baseline;font-weight:800;letter-spacing:1px;font-size:20px;color:#0f4d55;}
  .manualdoc .md-wm span{color:#0f4d55;} .manualdoc .md-wm b{color:#1c9dd7;}
  .manualdoc .md-cover .md-wm{background:#fff;padding:4px 12px;border-radius:8px;}
  .manualdoc .md-wm-lg{font-size:26px;}
  .manualdoc .md-cover h1{font-size:26px;margin:16px 0 4px;font-weight:800;}
  .manualdoc .md-cover .md-badge{display:inline-block;background:var(--acc);color:#fff;font-weight:700;font-size:13px;padding:5px 14px;border-radius:999px;margin-top:6px;}
  .manualdoc .md-cover .md-sub{opacity:.85;font-size:12px;margin-top:12px;}
  .manualdoc .md-who{background:#fff;border:1px solid #e2e8f0;border-left:5px solid var(--acc);border-radius:10px;padding:14px 16px;margin:14px 0;break-inside:avoid;}
  .manualdoc .md-who .md-who-t{font-weight:700;color:var(--acc);font-size:13px;margin-bottom:4px;}
  .manualdoc .md-clientes{background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px 16px;margin:14px 0;font-size:12px;color:#075985;break-inside:avoid;}
  .manualdoc .md-cando{display:flex;gap:12px;margin:12px 0;break-inside:avoid;}
  .manualdoc .md-cando>div{flex:1;border-radius:10px;padding:12px 14px;}
  .manualdoc .md-can{background:#f0fdf4;border:1px solid #bbf7d0;}
  .manualdoc .md-cannot{background:#fef2f2;border:1px solid #fecaca;}
  .manualdoc .md-cando h5{margin:0 0 8px;font-size:12px;}
  .manualdoc .md-can h5{color:#166534;} .manualdoc .md-cannot h5{color:#991b1b;}
  .manualdoc .md-cando ul{margin:0;padding:0;list-style:none;}
  .manualdoc .md-cando li{font-size:11.5px;line-height:1.5;padding-left:18px;position:relative;margin-bottom:4px;}
  .manualdoc .md-can li:before{content:'✓';position:absolute;left:0;color:#16a34a;font-weight:700;}
  .manualdoc .md-cannot li:before{content:'✕';position:absolute;left:0;color:#dc2626;font-weight:700;}
  /* Secciones y pasos */
  .manualdoc .md-sec{break-inside:avoid;}
  .manualdoc ol.md-steps{margin:0 0 10px;padding:0;list-style:none;counter-reset:step;}
  .manualdoc ol.md-steps li{position:relative;padding:0 0 10px 34px;font-size:12.5px;line-height:1.5;counter-increment:step;}
  .manualdoc ol.md-steps li:before{content:counter(step);position:absolute;left:0;top:-1px;width:22px;height:22px;border-radius:50%;background:var(--acc);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;}
  /* Capturas simuladas */
  .manualdoc .md-shot{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin:10px 0 16px;background:#fff;break-inside:avoid;box-shadow:0 1px 2px rgba(0,0,0,.04);}
  .manualdoc .md-shot-cap{background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:10.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px;padding:6px 12px;}
  .manualdoc .md-shot>*:not(.md-shot-cap){margin:12px;}
  .manualdoc .md-tbl{width:calc(100% - 24px);border-collapse:collapse;font-size:11.5px;}
  .manualdoc .md-tbl th{background:#f1f5f9;text-align:left;padding:7px 9px;color:#475569;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;}
  .manualdoc .md-tbl td{padding:7px 9px;border-top:1px solid #eef2f7;}
  .manualdoc .md-chip{display:inline-block;font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:999px;}
  .manualdoc .md-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
  .manualdoc .md-kpi{background:#f8fafc;border:1px solid #eef2f7;border-radius:8px;padding:10px;text-align:center;}
  .manualdoc .md-kpi-v{font-size:20px;font-weight:800;color:var(--acc);}
  .manualdoc .md-kpi-l{font-size:10.5px;color:#64748b;margin-top:2px;}
  .manualdoc .md-note{font-size:11px;color:#64748b;background:#f8fafc;border-radius:8px;padding:8px 12px;}
  .manualdoc .md-mand{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
  .manualdoc .md-mand-card{display:flex;align-items:center;gap:7px;font-size:11.5px;background:#f8fafc;border:1px solid #eef2f7;border-radius:8px;padding:8px 10px;}
  .manualdoc .md-dot{width:8px;height:8px;border-radius:50%;background:var(--acc);display:inline-block;}
  .manualdoc .md-doc{border:1px solid #eef2f7;border-radius:8px;overflow:hidden;}
  .manualdoc .md-doc-h{background:#f1f5f9;font-weight:700;font-size:11.5px;padding:7px 10px;color:#334155;}
  .manualdoc .md-doc-row{display:flex;align-items:center;gap:10px;padding:7px 10px;border-top:1px solid #eef2f7;font-size:11.5px;}
  .manualdoc .md-doc-row>span:first-child{flex:1;}
  .manualdoc .md-mini-btn{font-size:10.5px;font-weight:700;color:#fff;background:var(--acc);border-radius:6px;padding:3px 10px;}
  .manualdoc .md-mini-btn.md-ok{background:#16a34a;} .manualdoc .md-mini-btn.md-no{background:#dc2626;}
  /* Infografías */
  .manualdoc .md-info{border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin:10px 0 16px;break-inside:avoid;}
  .manualdoc .md-info-title{font-weight:700;color:var(--acc);font-size:13px;margin-bottom:10px;}
  .manualdoc .md-states{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;}
  .manualdoc .md-state{display:flex;align-items:center;gap:8px;font-size:11.5px;color:#475569;}
  .manualdoc .md-flow{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:11px;}
  .manualdoc .md-flow span{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:999px;padding:4px 11px;font-weight:600;color:#334155;}
  .manualdoc .md-flow i{color:var(--acc);font-style:normal;font-weight:800;}
  .manualdoc .md-tramos{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;}
  .manualdoc .md-tramo{font-size:10.5px;font-weight:700;color:#475569;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:4px 10px;}
  .manualdoc .md-tramo-red{background:#fee2e2;border-color:#fecaca;color:#991b1b;}
  .manualdoc .md-acc{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;}
  .manualdoc .md-phone{width:170px;border:6px solid #0f172a;border-radius:20px;overflow:hidden;background:#f8fafc;}
  .manualdoc .md-phone-top{background:#fff;padding:10px;text-align:center;border-bottom:1px solid #e2e8f0;}
  .manualdoc .md-phone-top small{display:block;font-size:8px;letter-spacing:1px;color:#94a3b8;margin-top:2px;}
  .manualdoc .md-phone-pt{font-size:10px;font-weight:700;margin-top:5px;color:#334155;}
  .manualdoc .md-phone-btns{display:flex;gap:6px;padding:10px;}
  .manualdoc .md-phone-in{flex:1;background:#16a34a;color:#fff;font-size:10px;font-weight:700;text-align:center;padding:12px 0;border-radius:8px;}
  .manualdoc .md-phone-out{flex:1;background:#fff;border:1px solid #e2e8f0;color:#94a3b8;font-size:10px;font-weight:700;text-align:center;padding:12px 0;border-radius:8px;}
  .manualdoc .md-phone .md-input{margin:0 10px 10px;font-size:9px;color:#94a3b8;}
  .manualdoc .md-acc-txt{flex:1;min-width:220px;}
  .manualdoc .md-acc-txt ul{margin:10px 0 0;padding-left:16px;font-size:11.5px;line-height:1.55;color:#475569;}
  .manualdoc .md-acc-txt code,.manualdoc code{background:#f1f5f9;border-radius:4px;padding:1px 5px;font-size:11px;color:#0f4d55;}
  .manualdoc .md-input{background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:8px 12px;font-size:11.5px;color:#64748b;margin-bottom:8px;}
  .manualdoc .md-login{display:flex;}
  .manualdoc .md-login-side{flex:1;background:linear-gradient(135deg,#0f4d55,#0a3940);color:#fff;padding:16px;}
  .manualdoc .md-login-side p{font-size:11px;opacity:.85;margin-top:12px;}
  .manualdoc .md-login-form{flex:1;padding:16px;}
  .manualdoc .md-login-form h4{margin:0 0 10px;font-size:14px;color:#334155;}
  .manualdoc .md-login-form label{display:block;font-size:10.5px;color:#64748b;margin-bottom:3px;}
  .manualdoc .md-btn{font-size:12px;font-weight:700;color:#fff;border-radius:8px;padding:9px 0;margin-top:4px;}
  .manualdoc .md-btn-blue{background:#1c9dd7;}
  .manualdoc .md-foot{border-top:1px solid #e2e8f0;margin-top:22px;padding-top:8px;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between;}
  @media print{
    @page{size:A4;margin:14mm;}
    body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .manualdoc .md-page{max-width:none;padding:0;}
    .md-print-hint{display:none !important;}
  }`;
}

function bodyContenido(m) {
  const cando = `
    <div class="md-cando">
      <div class="md-can"><h5>Lo que puede hacer</h5><ul>${m.puede.map((x) => `<li>${x}</li>`).join('')}</ul></div>
      ${m.noPuede && m.noPuede.length ? `<div class="md-cannot"><h5>Lo que no puede hacer</h5><ul>${m.noPuede.map((x) => `<li>${x}</li>`).join('')}</ul></div>` : ''}
    </div>`;

  const secciones = m.secciones.map((s, i) => `
    <div class="md-sec">
      <h2>${i + 1}. ${s.titulo}</h2>
      <ol class="md-steps">${s.pasos.map((p) => `<li>${p}</li>`).join('')}</ol>
      ${s.extra && EXTRAS[s.extra] ? EXTRAS[s.extra]() : ''}
    </div>`).join('');

  return `
  <div class="md-page">
    <div class="md-cover">
      <div class="md-wm md-wm-lg"><span>RÍO</span><b>LOA</b></div>
      <h1>Manual de Usuario</h1>
      <span class="md-badge">Perfil: ${m.perfil}</span>
      <div class="md-sub">Plataforma Aptiva · Holding Río Loa</div>
    </div>

    <div class="md-who">
      <div class="md-who-t">¿Quién usa este manual?</div>
      <p style="margin:0">${m.alcance}</p>
    </div>

    <div class="md-clientes">
      <b>Sobre los mandantes:</b> los mandantes son los <b>clientes</b> de Holding Río Loa (por ejemplo Albemarle, SQM, CBB Cales). Usted es <b>personal de Río Loa</b> y ve únicamente los mandantes que tiene asignados.
    </div>

    ${cando}

    ${secciones}

    <div class="md-foot"><span>Holding Río Loa · Plataforma Aptiva</span><span>Manual de ${m.perfil}</span></div>
  </div>`;
}

// HTML listo para inyectar en un contenedor (preview en pantalla)
export function manualPreviewHTML(m) {
  return `<div class="manualdoc"><style>${estilos(m.color)}</style>${bodyContenido(m)}</div>`;
}

// Abre la vista de impresión en una nueva ventana para «Guardar como PDF»
export function descargarManualPDF(m) {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>Manual - ${m.perfil} - Aptiva Río Loa</title>
    <style>${estilos(m.color)} body{background:#f1f5f9;margin:0;padding:18px;} 
    .md-print-hint{max-width:820px;margin:0 auto 14px;background:#0f4d55;color:#fff;border-radius:10px;padding:12px 16px;font-family:'Segoe UI',Arial,sans-serif;font-size:12.5px;display:flex;align-items:center;gap:12px;}
    .md-print-hint button{margin-left:auto;background:#1c9dd7;color:#fff;border:0;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer;}
    </style></head>
    <body>
      <div class="md-print-hint">📄 Para guardar como PDF, elija <b style="margin:0 4px">Guardar como PDF</b> como destino de impresión.<button onclick="window.print()">Imprimir / Guardar PDF</button></div>
      ${manualPreviewHTML(m)}
      <script>window.addEventListener('load',function(){setTimeout(function(){try{window.focus();window.print();}catch(e){}},500);});<\/script>
    </body></html>`;
  const w = window.open('', '_blank');
  if (!w) throw new Error('popup-bloqueado');
  w.document.open();
  w.document.write(html);
  w.document.close();
}
