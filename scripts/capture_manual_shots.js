// Captura screenshots reales por PERFIL para los manuales.
// Requiere puppeteer-core (temporal). node scripts/capture_manual_shots.js
const puppeteer = require('puppeteer-core');
const path = require('path');
const BASE = 'http://localhost:3000';
const CHROME = '/usr/bin/google-chrome';
const OUT = '/app/public/manual';
const MID_SQM = '80eee7c1-f817-4f25-a303-09ca108f3824';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiLogin(email, password) {
  const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return r.json();
}

async function clickNav(page, text) {
  const els = await page.$x(`//nav//*[normalize-space(text())='${text}']`);
  if (els[0]) { await els[0].click(); return true; }
  return false;
}

async function login(page, email, password) {
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 45000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(1000);
  await page.waitForSelector('input[type="password"]', { timeout: 20000 });
  await page.type('input[placeholder="usuario@aptivarl.com"]', email, { delay: 8 });
  await page.type('input[type="password"]', password, { delay: 8 });
  const [b] = await page.$x(`//button[contains(.,'Ingresar')]`);
  await b.click();
  await page.waitForFunction(() => !document.querySelector('input[type="password"]'), { timeout: 25000 });
  await sleep(3000);
}

async function capture(page, id, shot) {
  const file = path.join(OUT, id, shot + '.png');
  try {
    if (shot === 'dashboard') await clickNav(page, 'Dashboard');
    else if (shot === 'mandantes') await clickNav(page, 'Mandantes');
    else if (shot === 'trabajadores') await clickNav(page, 'Trabajadores');
    else if (shot === 'pendientes') await clickNav(page, 'Pendientes de Revisión');
    else if (shot === 'vencimientos') await clickNav(page, 'Vencimientos');
    else if (shot === 'usuarios') await clickNav(page, 'Usuarios');
    else if (shot === 'acceso') await clickNav(page, 'Control de Acceso');
    else if (shot === 'finiquitados') await clickNav(page, 'Personal Finiquitado');
    else if (shot === 'ficha_doc') {
      await clickNav(page, 'Trabajadores'); await sleep(2600);
      const [acc] = await page.$x(`//button[normalize-space(.)='Acceder']`);
      if (acc) { await acc.click(); await sleep(3200); }
    }
    await sleep(2400);
    await page.screenshot({ path: file });
    console.log('  OK', id, shot);
  } catch (e) { console.log('  ERR', id, shot, e.message); }
}

const JOBS = [
  { id: 'super_admin', email: 'admin@aptivarl.com', shots: ['dashboard', 'mandantes', 'trabajadores', 'ficha_doc', 'usuarios', 'acceso'] },
  { id: 'rrhh', email: 'pmiranda@rioloa.cl', shots: ['trabajadores', 'ficha_doc', 'pendientes', 'vencimientos', 'finiquitados'] },
  { id: 'prevencion', email: 'ymarchant@rioloa.cl', shots: ['dashboard', 'trabajadores', 'ficha_doc', 'pendientes', 'vencimientos'] },
  { id: 'visor', email: 'visor.tmp@rioloa.cl', shots: ['dashboard', 'ficha_doc', 'vencimientos'] },
];

(async () => {
  const adm = await apiLogin('admin@aptivarl.com', 'Aptiva2025!');
  let visorId = null;
  try {
    const r = await fetch(`${BASE}/api/usuarios`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adm.token}` }, body: JSON.stringify({ email: 'visor.tmp@rioloa.cl', password: 'Aptiva2025!', nombre: 'Visor Demo', role_codigo: 'MANDANTE_VISOR', mandantes: [MID_SQM] }) });
    const j = await r.json(); visorId = j.perfil?.perfil_id; console.log('visor temp:', r.status, visorId || j.error);
  } catch (e) { console.log('visor create err', e.message); }

  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  const page = await b.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1.4 });

  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 45000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' }); await sleep(1500);
  await page.screenshot({ path: path.join(OUT, 'login.png') }); console.log('  OK login (compartido)');

  for (const job of JOBS) {
    console.log('== ' + job.id + ' ==');
    try {
      await login(page, job.email, 'Aptiva2025!');
      for (const s of job.shots) await capture(page, job.id, s);
    } catch (e) { console.log('  login err', job.id, e.message); }
  }
  await b.close();

  if (visorId) {
    try { const r = await fetch(`${BASE}/api/usuarios/${visorId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adm.token}` } }); console.log('visor delete:', r.status); } catch (e) { console.log('del err', e.message); }
  }
  console.log('DONE'); process.exit(0);
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
