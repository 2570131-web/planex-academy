// src/routes/materials.js
import { Router } from 'express';
import { getDb, ts } from '../config/firebase.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const user = req.user;

    let materials = [];

    // ✅ ADMIN → see all
    if (user.role === 'admin') {
      const snap = await db.collection('materials')
        .orderBy('createdAt', 'desc')
        .get();

      materials = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    // ✅ TEACHER → only assigned courses
    else if (user.role === 'teacher') {
      const courseSnap = await db.collection('courses')
        .where('teacherId', '==', user.uid)
        .get();

      const courseIds = courseSnap.docs.map(d => d.id);

      if (courseIds.length === 0) return res.json({ materials: [] });

      const snap = await db.collection('materials')
        .where('courseId', 'in', courseIds)
        .get();

      materials = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    // ✅ STUDENT → only enrolled courses
    else if (user.role === 'student') {
      const enrollSnap = await db.collection('enrollments')
        .where('studentId', '==', user.uid)
        .get();

      const courseIds = enrollSnap.docs.map(d => d.data().courseId);

      if (courseIds.length === 0) return res.json({ materials: [] });

      const snap = await db.collection('materials')
        .where('courseId', 'in', courseIds)
        .get();

      materials = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    res.json({ materials });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', authenticate, authorize('admin','teacher'), async (req, res) => {
  try {
    const { title, courseId, type, url, description='' } = req.body;
    if (!title||!courseId||!type||!url) return res.status(400).json({ error: 'title,courseId,type,url required' });
    const data = { title, courseId, type, url, description, uploadedBy: req.user.uid, uploaderName: req.user.name||req.user.email, role: req.user.role, createdAt: ts() };
    const ref = await getDb().collection('materials').add(data);
    res.status(201).json({ material: { id: ref.id, ...data } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, authorize('admin','teacher'), async (req, res) => {
  try { await getDb().collection('materials').doc(req.params.id).update({ ...req.body, updatedAt: ts() }); res.json({ message: 'Updated' }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, authorize('admin','teacher'), async (req, res) => {
  try { await getDb().collection('materials').doc(req.params.id).delete(); res.json({ message: 'Deleted' }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
