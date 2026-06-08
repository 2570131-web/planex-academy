// src/routes/courses.js
import { Router } from 'express';
import { getDb, ts } from '../config/firebase.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { active } = req.query;
    const db = getDb();

    let q = db.collection('courses');

    // ✅ Apply filter
    if (active === 'true') {
      q = q.where('isActive', '==', true);
    }

    // ✅ Apply sorting AFTER filter
    q = q.orderBy('createdAt', 'desc');

    const snap = await q.get();

    res.json({
      courses: snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }))
    });

  } catch (e) {
    console.error("COURSE FETCH ERROR:", e); // VERY IMPORTANT
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await getDb().collection('courses').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    const [mats, tests, enrolls] = await Promise.all([
      getDb().collection('materials').where('courseId','==',req.params.id).get(),
      getDb().collection('tests').where('courseId','==',req.params.id).get(),
      getDb().collection('enrollments').where('courseId','==',req.params.id).get(),
    ]);
    res.json({ course: { id: doc.id, ...doc.data(), materialsCount: mats.size, testsCount: tests.size, enrolledCount: enrolls.size } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, authorize('admin','teacher'), async (req, res) => {
  try {
    const { title,subject,classRange,description='',fee=0,duration='',teacherId='',teacherName='',isActive=true,thumbnail='' } = req.body;
    if (!title||!subject||!classRange) return res.status(400).json({ error: 'title, subject, classRange required' });
    const data = { title,subject,classRange,description,fee:+fee,duration,teacherId,teacherName,isActive,thumbnail, createdBy: req.user.uid, createdAt: ts(), updatedAt: ts() };
    const ref = await getDb().collection('courses').add(data);
    res.status(201).json({ course: { id: ref.id, ...data } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, authorize('admin','teacher'), async (req, res) => {
  try {
    await getDb().collection('courses').doc(req.params.id).update({ ...req.body, updatedAt: ts() });
    res.json({ message: 'Updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const db = getDb();
    const [mats,tests,enrolls] = await Promise.all([
      db.collection('materials').where('courseId','==',req.params.id).get(),
      db.collection('tests').where('courseId','==',req.params.id).get(),
      db.collection('enrollments').where('courseId','==',req.params.id).get(),
    ]);
    const batch = db.batch();
    batch.delete(db.collection('courses').doc(req.params.id));
    [...mats.docs,...tests.docs,...enrolls.docs].forEach(d => batch.delete(d.ref));
    await batch.commit();
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
