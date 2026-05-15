/* Authentication & JWT Middleware */
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev-secret-key';

export const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, org_id: user.org_id, role: user.role },
    SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '7d' }
  );
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, SECRET);
  } catch (err) {
    throw new Error(`Invalid token: ${err.message}`);
  }
};

export const authenticate = (req, res, next) => {
  try {
    const auth = req.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = auth.slice(7);
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
};

export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};
