// src/routes/assignments.js
import { Router } from 'express';
import { getDb, ts } from '../config/firebase.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const { courseId } = req.query;
    let q = getDb().collection('assignments').orderBy('createdAt','desc');
    if (courseId) q = getDb().collection('assignments').where('courseId','==',courseId).orderBy('createdAt','desc');
    const snap = await q.get();
    res.json({ assignments: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, authorize('admin','teacher'), async (req, res) => {
  try {
    const { title, courseId, description, dueDate, maxMarks=100 } = req.body;
    if (!title||!courseId) return res.status(400).json({ error: 'title and courseId required' });
    const data = { title, courseId, description:'', dueDate:'', maxMarks:+maxMarks, createdBy: req.user.uid, createdAt: ts() };
    Object.assign(data, { description: description||'', dueDate: dueDate||'' });
    const ref = await getDb().collection('assignments').add(data);
    res.status(201).json({ assignment: { id: ref.id, ...data } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, authorize('admin','teacher'), async (req, res) => {
  try { await getDb().collection('assignments').doc(req.params.id).update({ ...req.body, updatedAt: ts() }); res.json({ message: 'Updated' }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, authorize('admin','teacher'), async (req, res) => {
  try { await getDb().collection('assignments').doc(req.params.id).delete(); res.json({ message: 'Deleted' }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Student submits assignment
router.post('/:id/submit', authenticate, authorize('student'), async (req, res) => {
  try {
    const { submissionUrl, note='' } = req.body;
    const data = { assignmentId: req.params.id, studentId: req.user.uid, studentName: req.user.name, submissionUrl: submissionUrl||'', note, status:'submitted', submittedAt: ts() };
    const ref = await getDb().collection('submittedAssignments').add(data);
    res.status(201).json({ submission: { id: ref.id, ...data } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Grade submission
router.patch('/submissions/:id/grade', authenticate, authorize('admin','teacher'), async (req, res) => {
  try {
    const { marks, feedback='' } = req.body;
    await getDb().collection('submittedAssignments').doc(req.params.id).update({ marks:+marks, feedback, status:'graded', gradedAt: ts() });
    res.json({ message: 'Graded' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
