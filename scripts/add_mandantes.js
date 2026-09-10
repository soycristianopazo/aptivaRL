const BASE = 'http://localhost:3000/api';

const DATA = [
  { rut: '78229090-8', razon_social: 'Río Loa', direccion: 'Avenida Industrial 7363', comuna: 'Antofagasta', region: 'Antofagasta' },
  { rut: '96718010-6', razon_social: 'CBB Cales S.A', direccion: 'Carretera Panamericana Norte Km 1352', comuna: 'La Negra', region: 'Antofagasta' },
  { rut: '96676520-8', razon_social: 'Puerto de Mejillones S.A', direccion: 'Av. Longitudinal 5500', comuna: 'Mejillones', region: 'Antofagasta' },
  { rut: '76004976-k', razon_social: 'Empresa Electrica Angamos Spa', direccion: 'Camino Chacaya', comuna: 'Mejillones', region: 'Antofagasta' },
  { rut: '76102677-1', razon_social: 'HMC Gold SCM', direccion: 'CAMINO COMBARBALA RUTA D-605 KM 3', comuna: 'Punitaqui', region: 'Coquimbo' },
  { rut: '73968300-9', razon_social: 'Empresa Portuaria Antofagasta', direccion: 'Avda. Grecia S/N', comuna: 'Antofagasta', region: 'Antofagasta' },
  { rut: '76167759-4', razon_social: 'RL Maquinarias y Servicios', direccion: 'Av. Vespucio Norte 1561, Of. 1101', comuna: 'Vitacura', region: 'Metropolitana' },
  { rut: '79626800-k', razon_social: 'SQM Salar', direccion: 'Longitudinal Norte, Sector: Portezuelo Las Bombas', comuna: 'Quillagua', region: 'Antofagasta' },
  { rut: '85066600-8', razon_social: 'Albemarle Limitada', direccion: 'Av Hector Gomez Cobo 975 Lote 4 Sector La Negra', comuna: 'Antofagasta', region: 'Antofagasta' },
  { rut: '96567040-8', razon_social: 'Compañía Minera Teck Quebrada Blanca S.A', direccion: 'AV. ISIDORA GOYENECHEA 2800, OF. 802', comuna: 'Las Condes', region: 'Metropolitana' },
  { rut: '78229090-8', razon_social: 'Maquinarias y construcciones Rio Loa S.A', direccion: 'Av. Vespucio Norte 1561, Of. 1101', comuna: 'Vitacura', region: 'Metropolitana' },
  { rut: '99511240-k', razon_social: 'Antofagasta Terminal Internacional S.A', direccion: 'MANUEL ANTONIO MATTA 1839 OF 701', comuna: 'Antofagasta', region: 'Antofagasta' },
  { rut: '92176000-0', razon_social: 'ACEROS AZA', direccion: 'La Unión 3070, Renca', comuna: 'Renca', region: 'Metropolitana' },
  { rut: '76167759-4', razon_social: 'Cuadrilla Spot', direccion: 'Av. industrial 7363', comuna: 'Antofagasta', region: 'Antofagasta' },
];

(async () => {
  // trigger schema+seed
  await fetch(`${BASE}/health`).catch(() => {});
  let token = null;
  for (let i = 0; i < 30; i++) {
    const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@aptivarl.com', password: 'Aptiva2025!' }) });
    const d = await r.json();
    if (r.status === 200) { token = d.token; break; }
    await new Promise((res) => setTimeout(res, 2000));
  }
  if (!token) { console.log('LOGIN FAILED'); process.exit(1); }
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const existing = (await (await fetch(`${BASE}/mandantes`, { headers: auth })).json()).mandantes || [];
  const byName = new Set(existing.map((m) => (m.razon_social || '').trim().toLowerCase()));

  let created = 0, skipped = 0;
  for (const m of DATA) {
    if (byName.has(m.razon_social.trim().toLowerCase())) { skipped++; console.log('SKIP (exists):', m.razon_social); continue; }
    const r = await fetch(`${BASE}/mandantes`, { method: 'POST', headers: auth, body: JSON.stringify(m) });
    const d = await r.json().catch(() => ({}));
    if (r.status === 201) { created++; console.log('OK:', m.razon_social); }
    else { console.log('FAIL', r.status, m.razon_social, d.error || ''); }
  }
  console.log(`\nDONE. created=${created} skipped=${skipped}`);
})();
