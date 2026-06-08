// src/routes/tests.js
import { Router } from 'express';
import { getDb, ts } from '../config/firebase.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const user = req.user;
    let tests = [];

    // ✅ ADMIN → all tests
    if (user.role === 'admin') {
      const snap = await db.collection('tests')
        .orderBy('createdAt', 'desc')
        .get();

      tests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    // ✅ TEACHER → only assigned courses
    else if (user.role === 'teacher') {
      const courseSnap = await db.collection('courses')
        .where('teacherId', '==', user.uid)
        .get();

      const courseIds = courseSnap.docs.map(d => d.id);

      if (courseIds.length === 0) return res.json({ tests: [] });

      const snap = await db.collection('tests')
        .where('courseId', 'in', courseIds)
        .get();

      tests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    // ✅ STUDENT → enrolled courses only
    else if (user.role === 'student') {
      const enrollSnap = await db.collection('enrollments')
        .where('studentId', '==', user.uid)
        .get();

      const courseIds = enrollSnap.docs.map(d => d.data().courseId);

      if (courseIds.length === 0) return res.json({ tests: [] });

      const snap = await db.collection('tests')
        .where('courseId', 'in', courseIds)
        .get();

      tests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    // ✅ HIDE ANSWERS FOR STUDENTS
    if (user.role === 'student') {
      tests = tests.map(t => ({
        ...t,
        questions: t.questions?.map(q => ({
          id: q.id,
          text: q.text,
          options: q.options,
          marks: q.marks
        }))
      }));
    }

    res.json({ tests });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const doc = await getDb().collection('tests').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    const data = { id: doc.id, ...doc.data() };
    if (req.user?.role === 'student')
      data.questions = data.questions?.map(q => ({ id:q.id,text:q.text,options:q.options,marks:q.marks }));
    res.json({ test: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, authorize('admin','teacher'), async (req, res) => {
  try {
    const { title, courseId, duration=30, questions=[], passingMarks } = req.body;
    if (!title||!courseId||!questions.length) return res.status(400).json({ error: 'title,courseId,questions required' });
    const totalMarks = questions.reduce((s,q) => s+(q.marks||1), 0);
    const data = { title, courseId, duration:+duration, questions, totalMarks, passingMarks: passingMarks||Math.ceil(totalMarks*0.5), isActive:true, createdBy: req.user.uid, creatorRole: req.user.role, createdAt: ts() };
    const ref = await getDb().collection('tests').add(data);
    res.status(201).json({ test: { id: ref.id, ...data } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, authorize('admin','teacher'), async (req, res) => {
  try { await getDb().collection('tests').doc(req.params.id).update({ ...req.body, updatedAt: ts() }); res.json({ message: 'Updated' }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, authorize('admin','teacher'), async (req, res) => {
  try { await getDb().collection('tests').doc(req.params.id).delete(); res.json({ message: 'Deleted' }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Student submits test
router.post('/:id/submit', authenticate, authorize('student'), async (req, res) => {
  try {
    const { answers, timeTaken=0 } = req.body;
    const db = getDb();
    const testDoc = await db.collection('tests').doc(req.params.id).get();
    if (!testDoc.exists) return res.status(404).json({ error: 'Test not found' });
    const existing = await db.collection('results').where('testId','==',req.params.id).where('studentId','==',req.user.uid).limit(1).get();
    if (!existing.empty) return res.status(409).json({ error: 'Already submitted' });
    const test = testDoc.data();
    let score = 0;
    const evaluated = test.questions.map(q => {
      const sa = answers[q.id];
      const correct = sa === q.correctAnswer;
      if (correct) score += (q.marks||1);
      return { questionId:q.id, studentAnswer:sa, correctAnswer:q.correctAnswer, correct, marks:correct?(q.marks||1):0 };
    });
    const percentage = Math.round((score/test.totalMarks)*100);
    const result = { testId:req.params.id, testTitle:test.title, courseId:test.courseId, studentId:req.user.uid, studentName:req.user.name, score, totalMarks:test.totalMarks, percentage, passed:score>=test.passingMarks, timeTaken, evaluated, submittedAt: ts() };
    const ref = await db.collection('results').add(result);
    res.json({ result: { id: ref.id, ...result } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
