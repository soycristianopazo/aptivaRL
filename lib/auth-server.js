import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const SECRET = process.env.JWT_SECRET || 'aptiva_dev_secret';

export function hashPassword(p) {
  return bcrypt.hash(p, 10);
}
export function verifyPassword(p, h) {
  return bcrypt.compare(p, h);
}
export function signToken(user) {
  return jwt.sign(
    { sub: user.user_id, role: user.role, email: user.email },
    SECRET,
    { expiresIn: '7d' }
  );
}
export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}
export function getAuth(request) {
  const h = request.headers.get('authorization') || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  return t ? verifyToken(t) : null;
}
