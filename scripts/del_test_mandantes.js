const BASE = 'http://localhost:3000/api';
const TARGETS = ['Test Edited', 'Test Mandante Mining Corp', 'Test Mandante Playwright', 'Updated Mandante Name'];

(async () => {
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

  const mand = (await (await fetch(`${BASE}/mandantes`, { headers: auth })).json()).mandantes || [];
  for (const name of TARGETS) {
    const m = mand.find((x) => (x.razon_social || '').trim().toLowerCase() === name.toLowerCase());
    if (!m) { console.log('NOT FOUND:', name); continue; }
    const r = await fetch(`${BASE}/mandantes/${m.mandante_id}`, { method: 'DELETE', headers: auth });
    console.log(r.status === 200 ? 'DELETED:' : `FAIL(${r.status}):`, name);
  }
  const after = (await (await fetch(`${BASE}/mandantes`, { headers: auth })).json()).mandantes || [];
  console.log('\nRemaining mandantes:', after.length);
})();
