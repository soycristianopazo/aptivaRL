const BASE = 'http://localhost:3000/api';
(async () => {
  const h = await (await fetch(`${BASE}/health`)).json();
  console.log('health:', h);
  // give schema+seed time (auth admin calls)
  await new Promise((r) => setTimeout(r, 1000));
  for (let i = 0; i < 40; i++) {
    const lr = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@aptivarl.com', password: 'Aptiva2025!' }) });
    const ld = await lr.json();
    if (lr.status === 200) {
      console.log('LOGIN OK role:', ld.profile?.role_codigo, 'nombre:', ld.profile?.nombre);
      const t = ld.token; const auth = { Authorization: `Bearer ${t}` };
      const dash = await (await fetch(`${BASE}/dashboard`, { headers: auth })).json();
      console.log('dashboard stats:', dash.stats);
      const mand = await (await fetch(`${BASE}/mandantes`, { headers: auth })).json();
      console.log('mandantes:', (mand.mandantes || []).map((m) => m.razon_social));
      const trab = await (await fetch(`${BASE}/trabajadores`, { headers: auth })).json();
      console.log('trabajadores count:', (trab.trabajadores || []).length);
      const tid = trab.trabajadores?.[0]?.trabajador_id;
      if (tid) { const ficha = await (await fetch(`${BASE}/trabajadores/${tid}`, { headers: auth })).json(); console.log('acreditacion ejemplo:', JSON.stringify(ficha.acreditacion)); }
      return;
    }
    console.log(`try ${i}: status ${lr.status} ${ld.error || ''}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log('LOGIN never succeeded');
})();
