// src/routes/results.js
import { Router } from 'express';
import { getDb } from '../config/firebase.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = Router();

router.get('/', authenticate, authorize('admin','teacher'), async (req, res) => {
  try {
    const { courseId, testId } = req.query;
    let q = getDb().collection('results').orderBy('submittedAt','desc');
    if (courseId) q = getDb().collection('results').where('courseId','==',courseId).orderBy('submittedAt','desc');
    if (testId) q = getDb().collection('results').where('testId','==',testId).orderBy('submittedAt','desc');
    const snap = await q.get();
    res.json({ results: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/mine', authenticate, async (req, res) => {
  try {
    const snap = await getDb().collection('results').where('studentId','==',req.user.uid).orderBy('submittedAt','desc').get();
    res.json({ results: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
