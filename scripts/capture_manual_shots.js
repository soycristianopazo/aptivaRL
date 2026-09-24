// Captura screenshots reales de la plataforma para los manuales.
// Ejecutar: node scripts/capture_manual_shots.js
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const OUT = '/app/public/manual';
const BASE = 'http://localhost:3000';
const CHROME = fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : '/root/bin/chromium';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickText(page, text) {
  const els = await page.$x(`//nav//*[normalize-space(text())='${text}']`);
  let el = els[0];
  if (!el) { const e2 = await page.$x(`//*[normalize-space(text())='${text}']`); el = e2[0]; }
  if (el) { await el.click(); return true; }
  return false;
}

async function login(page, email, password) {
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(1200);
  await page.waitForSelector('input[placeholder="usuario@aptivarl.com"]', { timeout: 20000 });
  await page.type('input[placeholder="usuario@aptivarl.com"]', email, { delay: 10 });
  await page.type('input[type="password"]', password, { delay: 10 });
  const [btn] = await page.$x(`//button[contains(.,'Ingresar')]`);
  await btn.click();
  await page.waitForFunction(() => !document.querySelector('input[type="password"]'), { timeout: 25000 });
  await sleep(3500);
}

async function shot(page, name) {
  try { await page.screenshot({ path: path.join(OUT, name + '.png') }); console.log('  saved', name); }
  catch (e) { console.log('  shot err', name, e.message); }
}

async function nav(page, text, name) {
  try {
    const ok = await clickText(page, text);
    if (!ok) { console.log('  nav miss', text); return false; }
    await sleep(2800);
    await shot(page, name);
    return true;
  } catch (e) { console.log('  nav err', text, e.message); return false; }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.4 });

  // ===== Super Admin Holding =====
  console.log('== Super Admin ==');
  await login(page, 'admin@aptivarl.com', 'Aptiva2025!');
  await shot(page, 'dashboard');
  await nav(page, 'Mandantes', 'mandantes');
  await nav(page, 'Trabajadores', 'trabajadores');
  // abrir ficha del primer trabajador
  try {
    const row = await page.$('table tbody tr');
    if (row) { await row.click(); await sleep(3200); await shot(page, 'ficha_doc'); }
  } catch (e) { console.log('  ficha err', e.message); }
  await nav(page, 'Pendientes de Revisión', 'pendientes');
  await nav(page, 'Vencimientos', 'vencimientos');
  await nav(page, 'Usuarios', 'usuarios');
  await nav(page, 'Control de Acceso', 'acceso');
  // sidebar completo (recorta franja izquierda del dashboard)
  await nav(page, 'Dashboard', '_dash2');
  try { await page.screenshot({ path: path.join(OUT, 'sidebar_holding.png'), clip: { x: 0, y: 0, width: 250, height: 900 } }); console.log('  saved sidebar_holding'); } catch (e) { console.log(e.message); }

  // ===== RR.HH. =====
  console.log('== RR.HH. (pmiranda) ==');
  try {
    await login(page, 'pmiranda@rioloa.cl', 'Aptiva2025!');
    await sleep(1500);
    try { await page.screenshot({ path: path.join(OUT, 'sidebar_rrhh.png'), clip: { x: 0, y: 0, width: 250, height: 900 } }); console.log('  saved sidebar_rrhh'); } catch (e) {}
    await nav(page, 'Personal Finiquitado', 'finiquitados');
  } catch (e) { console.log('  rrhh err', e.message); }

  await browser.close();
  console.log('DONE');
  process.exit(0);
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
