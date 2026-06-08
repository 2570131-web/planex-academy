// src/routes/users.js
import { Router } from 'express';
import { getAdmin, getDb, ts } from '../config/firebase.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role, limit = 200 } = req.query;
    let q = getDb().collection('users').orderBy('createdAt','desc').limit(+limit);
    if (role) q = getDb().collection('users').where('role','==',role).orderBy('createdAt','desc').limit(+limit);
    const snap = await q.get();
    res.json({ users: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'student' && req.user.uid !== req.params.id)
      return res.status(403).json({ error: 'Access denied' });
    const doc = await getDb().collection('users').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    res.json({ user: { id: doc.id, ...doc.data() } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { email, password, name, role, phone='', classNum='', subject='' } = req.body;
    if (!email||!password||!name||!role) return res.status(400).json({ error: 'email, password, name, role required' });
    const authUser = await getAdmin().auth().createUser({ email, password, displayName: name });
    const data = { uid: authUser.uid, email, name, role, phone, classNum, subject, isActive: true, enrolledCourses: [], createdAt: ts(), updatedAt: ts() };
    await getDb().collection('users').doc(authUser.uid).set(data);
    await getAdmin().auth().setCustomUserClaims(authUser.uid, { role });
    res.status(201).json({ user: { id: authUser.uid, ...data } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'student' && req.user.uid !== req.params.id)
      return res.status(403).json({ error: 'Access denied' });
    const updates = { ...req.body, updatedAt: ts() };
    if (updates.role && req.user.role !== 'admin') delete updates.role;
    await getDb().collection('users').doc(req.params.id).update(updates);
    if (req.body.role) await getAdmin().auth().setCustomUserClaims(req.params.id, { role: req.body.role });
    res.json({ message: 'Updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    if (req.params.id === req.user.uid) return res.status(400).json({ error: 'Cannot delete yourself' });
    await getAdmin().auth().deleteUser(req.params.id).catch(() => {});
    const db = getDb();
    await db.collection('users').doc(req.params.id).delete();
    const snap = await db.collection('enrollments').where('studentId','==',req.params.id).get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/toggle', authenticate, authorize('admin'), async (req, res) => {
  try {
    const doc = await getDb().collection('users').doc(req.params.id).get();
    const newStatus = !doc.data().isActive;
    await getDb().collection('users').doc(req.params.id).update({ isActive: newStatus, updatedAt: ts() });
    res.json({ isActive: newStatus });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
