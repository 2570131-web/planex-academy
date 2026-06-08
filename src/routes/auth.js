// src/routes/auth.js
import { Router } from 'express';
import { getAdmin, getDb, ts } from '../config/firebase.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { uid, email, name, role = 'student', phone = '', classNum = '', subject = '' } = req.body;
    if (!uid || !email || !name) return res.status(400).json({ error: 'uid, email, name required' });
    const db = getDb();
    const existing = await db.collection('users').doc(uid).get();
    if (existing.exists) return res.status(409).json({ error: 'Already registered' });
    if (role === 'admin') {
      const admins = await db.collection('users').where('role','==','admin').limit(1).get();
      if (!admins.empty) return res.status(403).json({ error: 'Admin already exists' });
    }
    const data = { uid, email, name, role, phone, classNum, subject, isActive: true, enrolledCourses: [], createdAt: ts(), updatedAt: ts() };
    await db.collection('users').doc(uid).set(data);
    await getAdmin().auth().setCustomUserClaims(uid, { role });
    res.status(201).json({ user: { id: uid, ...data } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/me', authenticate, async (req, res) => {
  const doc = await getDb().collection('users').doc(req.user.uid).get();
  res.json({ user: { id: doc.id, ...doc.data() } });
});

router.post('/logout', authenticate, async (req, res) => {
  await getAdmin().auth().revokeRefreshTokens(req.user.uid).catch(() => {});
  res.json({ message: 'Logged out' });
});

export default router;
