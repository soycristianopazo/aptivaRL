// Supabase REST helpers (Auth + Storage) — Node 20 compatible (no SDK).
const URL_ = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const PUB = process.env.SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
export const BUCKET = process.env.STORAGE_BUCKET || 'documentos';

async function readResp(r) {
  const t = await r.text();
  let b;
  try { b = t ? JSON.parse(t) : null; } catch { b = t; }
  if (!r.ok) {
    const m = typeof b === 'string' ? b : JSON.stringify(b);
    const e = new Error(`Supabase ${r.status}: ${m}`);
    e.status = r.status; e.body = b;
    throw e;
  }
  return b;
}

/* ---------------- Auth ---------------- */
export async function authSignIn(email, password) {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: PUB, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: (email || '').toLowerCase(), password }),
  });
  return readResp(r);
}

export async function adminCreateUser(email, password, user_metadata = {}) {
  const r = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.toLowerCase(), password, email_confirm: true, user_metadata }),
  });
  return readResp(r);
}

export async function adminDeleteUser(id) {
  const r = await fetch(`${URL_}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` },
  });
  if (!r.ok && r.status !== 404) throw new Error('adminDeleteUser ' + r.status);
  return true;
}

export async function adminUpdateUser(id, payload) {
  const r = await fetch(`${URL_}/auth/v1/admin/users/${id}`, {
    method: 'PUT',
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readResp(r);
}


export async function adminFindUserByEmail(email) {
  const r = await fetch(`${URL_}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` },
  });
  const b = await readResp(r);
  const users = b.users || b || [];
  return users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase()) || null;
}

// Ensure an auth user exists; returns its uuid.
export async function ensureAuthUser(email, password, user_metadata = {}) {
  try {
    const u = await adminCreateUser(email, password, user_metadata);
    return u.id || u.user?.id;
  } catch (e) {
    const existing = await adminFindUserByEmail(email);
    if (existing) return existing.id;
    throw e;
  }
}

const tokenCache = new Map();
export async function getAuthUser(token) {
  if (!token) return null;
  const c = tokenCache.get(token);
  if (c && c.exp > Date.now()) return c.user;
  const r = await fetch(`${URL_}/auth/v1/user`, {
    headers: { apikey: PUB, Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!r.ok) return null;
  const u = await r.json();
  tokenCache.set(token, { user: u, exp: Date.now() + 60000 });
  return u;
}

/* ---------------- Storage ---------------- */
export async function ensureBucket(id = BUCKET) {
  try {
    const r = await fetch(`${URL_}/storage/v1/bucket`, {
      method: 'POST',
      headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: id, public: false, file_size_limit: 20971520 }),
    });
    if (!r.ok && r.status !== 409) {
      const t = await r.text();
      if (!/already exists/i.test(t)) console.warn('bucket create:', r.status, t);
    }
  } catch (e) { console.warn('ensureBucket', e.message); }
}

export async function storageUpload({ path, bytes, contentType, bucket = BUCKET }) {
  const enc = path.split('/').map(encodeURIComponent).join('/');
  const r = await fetch(`${URL_}/storage/v1/object/${bucket}/${enc}`, {
    method: 'POST',
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': contentType || 'application/octet-stream', 'x-upsert': 'true' },
    body: bytes,
  });
  return readResp(r);
}

export async function storageSignedUrl(path, expiresIn = 900, bucket = BUCKET) {
  const enc = path.split('/').map(encodeURIComponent).join('/');
  const r = await fetch(`${URL_}/storage/v1/object/sign/${bucket}/${enc}`, {
    method: 'POST',
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn }),
  });
  const b = await readResp(r);
  const rel = b.signedURL || b.signedUrl;
  return rel.startsWith('http') ? rel : `${URL_}/storage/v1${rel}`;
}
