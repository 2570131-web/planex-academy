// src/routes/enrollments.js
import { Router } from 'express';
import { getDb, ts, arrayUnion, arrayRemove } from '../config/firebase.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = Router();

router.get('/', authenticate, authorize('admin','teacher'), async (req, res) => {
  try {
    const { courseId, studentId } = req.query;

    let q = getDb().collection('enrollments');

    // ✅ Apply filters safely (NO orderBy)
    if (courseId) {
      q = q.where('courseId', '==', courseId);
    }

    if (studentId) {
      q = q.where('studentId', '==', studentId);
    }

    const snap = await q.get();

    const enrollments = [];

snap.forEach(doc => {
  enrollments.push({
    id: doc.id,
    ...doc.data()
  });
});

res.json({ enrollments });

  } catch (e) {
    console.error("🔥 ENROLLMENT ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/mine', authenticate, async (req, res) => {
  try {
    const snap = await getDb().collection('enrollments').where('studentId','==',req.user.uid).get();
    res.json({ enrollments: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const { courseId, studentId } = req.body;
    const sid = req.user.role === 'admin' ? studentId : req.user.uid;
    if (!courseId||!sid) return res.status(400).json({ error: 'courseId and studentId required' });
    const dup = await db.collection('enrollments').where('studentId','==',sid).where('courseId','==',courseId).limit(1).get();
    if (!dup.empty) return res.status(409).json({ error: 'Already enrolled' });
    const [courseDoc, studentDoc] = await Promise.all([
      db.collection('courses').doc(courseId).get(),
      db.collection('users').doc(sid).get(),
    ]);
    if (!courseDoc.exists) return res.status(404).json({ error: 'Course not found' });
    const enrollment = {
      courseId, courseName: courseDoc.data().title, courseFee: courseDoc.data().fee||0,
      studentId: sid, studentName: studentDoc.data()?.name||'',
      progress: 0, enrolledAt: ts(),
    };
    const ref = await db.collection('enrollments').add(enrollment);
    await db.collection('payments').add({
    enrollmentId: ref.id,
    studentId: sid,
    studentName: studentDoc.data()?.name || '',
    courseId,
    courseName: courseDoc.data().title,
    amount: courseDoc.data().fee || 0,
    status: 'pending',
    createdAt: ts()
    });
    await db.collection('users').doc(sid).update({ enrolledCourses: arrayUnion(courseId) });
    res.status(201).json({ enrollment: { id: ref.id, ...enrollment } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const doc = await getDb().collection('enrollments').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    const { studentId, courseId } = doc.data();
    await getDb().collection('enrollments').doc(req.params.id).delete();
    await getDb().collection('users').doc(studentId).update({ enrolledCourses: arrayRemove(courseId) });
    res.json({ message: 'Removed' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
