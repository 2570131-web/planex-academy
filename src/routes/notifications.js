// src/routes/notifications.js
import { Router } from 'express';
import { getDb, ts } from '../config/firebase.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = Router();

router.get('/', authenticate, async (req, res) => {
  try {
    // Fetch notifications for this user's uid OR role OR 'all'
    const targets = [req.user.uid, req.user.role, 'all'];
    const snaps = await Promise.all(
      targets.map(t => getDb().collection('notifications').where('targetId','==',t).orderBy('createdAt','desc').limit(10).get())
    );
    const seen = new Set();
    const notifications = [];
    snaps.forEach(snap => snap.docs.forEach(d => {
      if (!seen.has(d.id)) { seen.add(d.id); notifications.push({ id: d.id, ...d.data() }); }
    }));
    notifications.sort((a,b) => (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    res.json({ notifications: notifications.slice(0, 20) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { title, message, targetId='all' } = req.body;
    if (!title||!message) return res.status(400).json({ error: 'title and message required' });
    const ref = await getDb().collection('notifications').add({ title, message, targetId, read:false, createdAt: ts() });
    res.status(201).json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/read', authenticate, async (req, res) => {
  try { await getDb().collection('notifications').doc(req.params.id).update({ read: true }); res.json({ message: 'Marked read' }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try { await getDb().collection('notifications').doc(req.params.id).delete(); res.json({ message: 'Deleted' }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
