// src/routes/settings.js
import { Router } from 'express';
import { getDb, ts } from '../config/firebase.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = Router();

router.get('/', async (_req, res) => {
  try {
    const doc = await getDb().collection('settings').doc('site').get();
    res.json({ settings: doc.exists ? doc.data() : {} });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    await getDb().collection('settings').doc('site').set({ ...req.body, updatedAt: ts() }, { merge: true });
    res.json({ message: 'Settings saved' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Testimonials
router.get('/testimonials', async (_req, res) => {
  try {
    const snap = await getDb().collection('testimonials').orderBy('createdAt','desc').get();
    res.json({ testimonials: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/testimonials', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, role, text, rating=5 } = req.body;
    const ref = await getDb().collection('testimonials').add({ name, role, text, rating:+rating, createdAt: ts() });
    res.status(201).json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/testimonials/:id', authenticate, authorize('admin'), async (req, res) => {
  try { await getDb().collection('testimonials').doc(req.params.id).delete(); res.json({ message: 'Deleted' }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Toppers / Results
router.get('/toppers', async (_req, res) => {
  try {
    const snap = await getDb().collection('toppers').orderBy('rank','asc').get();
    res.json({ toppers: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/toppers', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, score, rank, course, classNum, year } = req.body;
    const ref = await getDb().collection('toppers').add({ name, score, rank:+rank, course, classNum, year, createdAt: ts() });
    res.status(201).json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/toppers/:id', authenticate, authorize('admin'), async (req, res) => {
  try { await getDb().collection('toppers').doc(req.params.id).delete(); res.json({ message: 'Deleted' }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
