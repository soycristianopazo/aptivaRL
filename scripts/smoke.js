const BASE = 'http://localhost:3000/api';
(async () => {
  const h = await (await fetch(`${BASE}/health`)).json();
  console.log('health:', h);
  const lr = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@aptivarl.com', password: 'Aptiva2025!' }) });
  const ld = await lr.json();
  console.log('login status:', lr.status, 'user:', ld.user);
  if (!ld.token) return;
  const t = ld.token;
  const auth = { Authorization: `Bearer ${t}` };
  const courses = await (await fetch(`${BASE}/courses`, { headers: auth })).json();
  console.log('courses count:', (courses.courses || []).length, (courses.courses||[]).map(c=>c.title));
  const stats = await (await fetch(`${BASE}/stats`, { headers: auth })).json();
  console.log('stats:', stats);
})();
