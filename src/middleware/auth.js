// src/middleware/auth.js
import { getAdmin, getDb } from '../config/firebase.js';

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });
    const decoded  = await getAdmin().auth().verifyIdToken(header.split('Bearer ')[1]);
    const userDoc  = await getDb().collection('users').doc(decoded.uid).get();
    if (!userDoc.exists) return res.status(401).json({ error: 'User profile not found' });
    req.user = { uid: decoded.uid, ...userDoc.data() };
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: `Access denied. Requires: ${roles.join(' or ')}` });
    next();
  };
}

export function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false, allowUnknown: true });
    if (error) return res.status(400).json({ error: 'Validation failed', details: error.details.map(d => d.message) });
    next();
  };
}
