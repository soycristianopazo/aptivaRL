// Contenido y generación (en el navegador) de los manuales de usuario de la
// Plataforma Aptiva — Holding Río Loa. Cada manual es una guía práctica paso a
// paso por perfil. El PDF se genera con jsPDF (import dinámico, solo cliente).

export const MANUALES = [
  {
    id: 'super_admin',
    perfil: 'Super Administrador Holding',
    codigo: 'SUPER_ADMIN_HOLDING',
    color: '#1c9dd7',
    resumen:
      'Perfil con acceso total a la plataforma. Administra las tres empresas del Holding, todos los mandantes y contratos, usuarios, mantenedores, control de acceso y reportes.',
    secciones: [
      {
        titulo: '1. Ingreso a la plataforma',
        pasos: [
          'Abra la plataforma en su navegador e ingrese con su correo corporativo y contraseña.',
          'Presione "Ingresar". Si las credenciales son correctas se abrirá el Dashboard.',
          'En el menú lateral izquierdo encontrará todas las secciones agrupadas por Operación, Recursos, Acreditación y Administración.',
        ],
      },
      {
        titulo: '2. Dashboard',
        pasos: [
          'El Dashboard muestra los indicadores generales del Holding: mandantes activos, contratos vigentes, trabajadores, acreditados, bloqueados, documentos por revisar, por vencer y vencidos.',
          'Use los filtros de Empresa y Mandante (arriba) para acotar los indicadores; presione "Limpiar" para volver a la vista global.',
          'En "Expediente" busque cualquier trabajador, vehículo o equipo por nombre, RUT o patente y abra su ficha o imprima su expediente.',
          'Revise los gráficos de Estado de acreditación, Documentos por estado, Tendencia de vencimientos y Próximos vencimientos.',
        ],
      },
      {
        titulo: '3. Empresas del Holding',
        pasos: [
          'Vaya a Administración → Empresas para ver las tres empresas del Holding.',
          'Cada empresa agrupa a sus trabajadores, vehículos y equipos.',
        ],
      },
      {
        titulo: '4. Mandantes y Contratos',
        pasos: [
          'En Operación → Mandantes revise cada mandante, sus contratos, categorías documentales, requisitos y usuarios asignados.',
          'Abra un mandante para gestionar sus categorías y requisitos (documentos exigidos) y ver la pestaña "Usuarios Holding Río Loa".',
          'En Operación → Contratos revise el detalle de cada contrato y su dotación (trabajadores, vehículos y equipos asignados).',
        ],
      },
      {
        titulo: '5. Trabajadores, Vehículos y Equipos',
        pasos: [
          'En Recursos → Trabajadores puede crear, editar, desactivar y asignar trabajadores a contratos, además de cargar y revisar sus documentos.',
          'En Recursos → Vehículos y Equipos administre el parque, asigne mandantes, defina operador/conductor y su vigencia, y gestione la disponibilidad (Disponible, En mantención, Fuera de servicio).',
          'Genere el código QR de cualquier trabajador, vehículo o equipo con el botón "QR"; al escanearlo se abre el expediente público de validación en terreno.',
        ],
      },
      {
        titulo: '6. Acreditación documental',
        pasos: [
          'En la ficha de cada recurso, pestaña "Documentación", cargue documentos por requisito y mandante con el botón "Cargar" (indique la fecha de vencimiento cuando corresponda).',
          'Los estados de un documento son: Faltante, En revisión, Aprobado, Rechazado y Vencido.',
          'En Acreditación → Pendientes de Revisión apruebe o rechace los documentos cargados (al rechazar indique el motivo).',
          'En Acreditación → Vencimientos filtre por tramos (Vencidos, 1-15, 16-30, 31-60, 61-90 y más de 90 días), abra el documento y exporte el listado a Excel.',
          'En Acreditación → Personal Finiquitado registre y consulte las desvinculaciones (finiquito o anexo de traslado).',
        ],
      },
      {
        titulo: '7. Usuarios',
        pasos: [
          'En Administración → Usuarios cree, edite y elimine usuarios de la plataforma.',
          'Defina nombre, correo, teléfono, rol y estado (activo/inactivo).',
          'Asigne uno o varios mandantes a los perfiles de mandante (Administrador, RR.HH., Visor y Prevención).',
          'No es posible eliminar el propio usuario con el que está conectado.',
        ],
      },
      {
        titulo: '8. Control de Acceso',
        pasos: [
          'En Administración → Control de Acceso administre los Puntos de acceso (porterías/visores) en la pestaña "Puntos de acceso".',
          'Cree un punto con su nombre y ubicación; el sistema genera automáticamente su URL de visor.',
          'Use el botón "Copiar URL" para obtener el enlace del visor de ese punto (formato /visor?punto=nombre-del-punto) y ábralo en la PDA de la portería.',
          'En la pestaña "Reporte" consulte todos los ingresos y salidas con filtros por fecha, punto y trabajador/RUT, y expórtelos a Excel.',
          'El visor registra ingresos y salidas sin importar el estado de acreditación; si se marca una salida sin ingreso previo, el sistema crea el ingreso automáticamente.',
        ],
      },
      {
        titulo: '9. Mantenedores y Auditoría',
        pasos: [
          'En Administración → Mantenedores configure los catálogos base de la plataforma.',
          'En Administración → Auditoría revise el registro de acciones realizadas por los usuarios.',
        ],
      },
    ],
  },
  {
    id: 'prevencion',
    perfil: 'Prevención / APR (Mandante)',
    codigo: 'MANDANTE_PREVENCION',
    color: '#16a34a',
    resumen:
      'Perfil de Prevención de Riesgos (APR) de un mandante. Puede ver y cargar documentos —principalmente de vehículos, equipos y seguridad— de sus mandantes asignados. No aprueba ni rechaza documentos y no realiza desvinculaciones.',
    secciones: [
      {
        titulo: '1. Ingreso y alcance',
        pasos: [
          'Ingrese con su correo y contraseña. Verá únicamente la información de los mandantes que le fueron asignados.',
          'El menú muestra Dashboard, Recursos (Trabajadores, Vehículos, Equipos) y Acreditación. No verá las secciones de Administración (Empresas, Usuarios, Mantenedores ni Auditoría).',
        ],
      },
      {
        titulo: '2. Dashboard',
        pasos: [
          'Revise los indicadores acotados a sus mandantes: recursos acreditados, bloqueados, documentos por vencer y vencidos.',
          'Use el buscador de Expediente para ubicar rápidamente un trabajador, vehículo o equipo.',
        ],
      },
      {
        titulo: '3. Consulta de recursos',
        pasos: [
          'En Recursos → Vehículos y Equipos abra la ficha para ver documentación, asignaciones, operador y disponibilidad.',
          'En Recursos → Trabajadores consulte la ficha y su estado de acreditación por mandante.',
        ],
      },
      {
        titulo: '4. Carga de documentos',
        pasos: [
          'Abra la ficha del recurso y vaya a la pestaña "Documentación".',
          'Ubique el requisito correspondiente (por mandante) y presione "Cargar".',
          'Seleccione el archivo (PDF/imagen), indique la fecha de vencimiento cuando aplique y presione "Subir".',
          'El documento quedará "En revisión" hasta que RR.HH. o un administrador lo apruebe o rechace.',
          'Nota: su perfil carga documentos pero no puede aprobarlos, rechazarlos ni desvincular personal.',
        ],
      },
      {
        titulo: '5. Vencimientos',
        pasos: [
          'En Acreditación → Vencimientos revise los documentos próximos a vencer o vencidos de sus mandantes.',
          'Filtre por tramo de días, abra el documento para revisarlo y exporte el listado a Excel si lo necesita.',
          'Coordine con anticipación la renovación de los documentos que estén por vencer.',
        ],
      },
    ],
  },
  {
    id: 'visor',
    perfil: 'Visor (Mandante)',
    codigo: 'MANDANTE_VISOR',
    color: '#7c3aed',
    resumen:
      'Perfil de solo lectura de un mandante. Consulta información, fichas y acreditación de sus mandantes asignados. No carga, no revisa ni desvincula, y no tiene acceso al documento "Contrato de trabajo".',
    secciones: [
      {
        titulo: '1. Ingreso y alcance',
        pasos: [
          'Ingrese con su correo y contraseña. Verá solo la información de los mandantes asignados a su perfil.',
          'El menú muestra Dashboard, Recursos y Acreditación en modo consulta. No verá las secciones de Administración.',
          'Su perfil es de solo lectura: no aparecerán botones para cargar, aprobar, rechazar ni desvincular.',
        ],
      },
      {
        titulo: '2. Dashboard y Expediente',
        pasos: [
          'Consulte los indicadores de sus mandantes en el Dashboard.',
          'Use el buscador de Expediente para encontrar un trabajador, vehículo o equipo y ver su cumplimiento documental.',
          'Puede imprimir el expediente de un recurso desde el botón "Imprimir".',
        ],
      },
      {
        titulo: '3. Consulta de fichas y documentos',
        pasos: [
          'En Recursos → Trabajadores, Vehículos o Equipos abra una ficha para ver su documentación y estado de acreditación por mandante.',
          'Podrá visualizar los documentos disponibles y su estado (Aprobado, En revisión, Vencido, etc.).',
          'Importante: el documento "Contrato de trabajo" no está disponible para este perfil en ningún mandante.',
        ],
      },
      {
        titulo: '4. Vencimientos',
        pasos: [
          'En Acreditación → Vencimientos consulte los documentos por vencer y vencidos de sus mandantes.',
          'Filtre por tramo de días y exporte el listado a Excel para su seguimiento.',
        ],
      },
    ],
  },
  {
    id: 'rrhh',
    perfil: 'RR.HH. (Mandante)',
    codigo: 'MANDANTE_RRHH',
    color: '#ea580c',
    resumen:
      'Perfil de Recursos Humanos de un mandante. Puede ver, cargar y revisar (aprobar/rechazar) documentos de trabajadores, y realizar desvinculaciones (finiquitos) dentro de sus mandantes asignados.',
    secciones: [
      {
        titulo: '1. Ingreso y alcance',
        pasos: [
          'Ingrese con su correo y contraseña. Verá únicamente los mandantes asignados a su perfil.',
          'El menú muestra Dashboard, Recursos y Acreditación (incluida Pendientes de Revisión y Personal Finiquitado). No verá las secciones de Administración.',
        ],
      },
      {
        titulo: '2. Trabajadores',
        pasos: [
          'En Recursos → Trabajadores consulte y busque personal de sus mandantes.',
          'Abra la ficha de un trabajador para ver su documentación, asignaciones y acreditación por mandante.',
        ],
      },
      {
        titulo: '3. Carga de documentos',
        pasos: [
          'En la ficha del trabajador, pestaña "Documentación", presione "Cargar" en el requisito correspondiente.',
          'Adjunte el archivo, indique la fecha de vencimiento cuando aplique y presione "Subir".',
          'El documento quedará "En revisión" a la espera de aprobación.',
        ],
      },
      {
        titulo: '4. Revisión de documentos',
        pasos: [
          'En Acreditación → Pendientes de Revisión verá los documentos cargados que esperan revisión.',
          'Presione "Aprobar" si el documento es correcto.',
          'Presione "Rechazar" e indique el motivo si el documento no cumple; el responsable deberá volver a cargarlo.',
        ],
      },
      {
        titulo: '5. Vencimientos',
        pasos: [
          'En Acreditación → Vencimientos revise los documentos próximos a vencer o vencidos de sus mandantes.',
          'Filtre por tramo de días, abra el documento y exporte el listado a Excel.',
          'Gestione con anticipación las renovaciones para evitar bloqueos de acreditación.',
        ],
      },
      {
        titulo: '6. Personal Finiquitado (Desvinculación)',
        pasos: [
          'En Acreditación → Personal Finiquitado registre la desvinculación de un trabajador.',
          'Adjunte el documento de respaldo (finiquito o anexo de traslado) e indique la causal cuando corresponda.',
          'La asignación del trabajador al contrato quedará marcada como inactiva y podrá consultar el histórico de finiquitos.',
        ],
      },
    ],
  },
];

// Genera y descarga el PDF de un manual usando jsPDF (import dinámico).
export async function generarManualPDF(manual) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 48;
  const contentW = pageW - marginX * 2;
  let y = 0;

  const hexToRgb = (hex) => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const [cr, cg, cb] = hexToRgb(manual.color || '#1c9dd7');

  const footer = () => {
    const page = doc.internal.getNumberOfPages();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Holding Río Loa · Plataforma Aptiva', marginX, pageH - 24);
    doc.text(`Página ${page}`, pageW - marginX, pageH - 24, { align: 'right' });
  };

  const ensureSpace = (needed) => {
    if (y + needed > pageH - 48) {
      footer();
      doc.addPage();
      y = 56;
    }
  };

  // Encabezado de portada
  doc.setFillColor(cr, cg, cb);
  doc.rect(0, 0, pageW, 96, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Manual de Usuario', marginX, 46);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(manual.perfil, marginX, 70);
  doc.setFontSize(9);
  doc.text('Plataforma Aptiva · Holding Río Loa', marginX, 86);
  y = 128;

  // Resumen
  doc.setTextColor(60);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(11);
  const resumenLines = doc.splitTextToSize(manual.resumen, contentW);
  doc.text(resumenLines, marginX, y);
  y += resumenLines.length * 15 + 10;

  doc.setDrawColor(cr, cg, cb);
  doc.setLineWidth(1.5);
  doc.line(marginX, y, marginX + contentW, y);
  y += 24;

  // Secciones
  manual.secciones.forEach((sec) => {
    ensureSpace(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(cr, cg, cb);
    const titleLines = doc.splitTextToSize(sec.titulo, contentW);
    doc.text(titleLines, marginX, y);
    y += titleLines.length * 17 + 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(40);
    sec.pasos.forEach((paso) => {
      const lines = doc.splitTextToSize(paso, contentW - 16);
      ensureSpace(lines.length * 14 + 6);
      // viñeta
      doc.setFillColor(cr, cg, cb);
      doc.circle(marginX + 3, y - 3.5, 2, 'F');
      doc.text(lines, marginX + 16, y);
      y += lines.length * 14 + 6;
    });
    y += 12;
  });

  footer();

  const fileName = `Manual_${manual.perfil.replace(/[^\w]+/g, '_')}.pdf`;
  doc.save(fileName);
}
