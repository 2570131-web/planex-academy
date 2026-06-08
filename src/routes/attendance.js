import { Router } from 'express';
import { getDb, ts } from '../config/firebase.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

/**
 * 🔹 Mark attendance for a session
 */
router.post('/', authenticate, authorize('admin','teacher'), async (req, res) => {
  try {
    const { courseId, date, records } = req.body;

    if (!courseId || !date || !Array.isArray(records) || !records.length) {
      return res.status(400).json({ error: 'courseId, date, records required' });
    }

    const db = getDb();

    const existing = await db.collection('attendance')
      .where('courseId','==',courseId)
      .where('date','==',date)
      .limit(1)
      .get();

    if (!existing.empty) {
      await existing.docs[0].ref.update({
        records,
        updatedBy: req.user.uid,
        updatedAt: ts()
      });
    } else {
      await db.collection('attendance').add({
        courseId,
        date,
        records,
        markedBy: req.user.uid,
        createdAt: ts()
      });
    }

    res.json({ message: 'Attendance saved' });

  } catch (e) {
    console.error("POST /attendance Error:", e);
    res.status(500).json({ error: e.message });
  }
});


/**
 * 🔹 Get attendance for a course
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { courseId, studentId, date } = req.query;

    let q = getDb().collection('attendance');

    if (courseId) {
      q = q.where('courseId', '==', courseId);
    }

    q = q.orderBy('date', 'desc');

    const snap = await q.get();

    let data = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    // Filter by student
    if (studentId) {
      data = data.map(session => ({
        ...session,
        records: Array.isArray(session.records)
          ? session.records.filter(r => r.studentId === studentId)
          : []
      })).filter(s => s.records.length);
    }

    // Filter by date
    if (date) {
      data = data.filter(s => s.date === date);
    }

    res.json({ attendance: data });

  } catch (e) {
    console.error("GET /attendance Error:", e);
    res.status(500).json({ error: e.message });
  }
});


/**
 * 🔹 Student's own attendance summary
 */
router.get('/mine', authenticate, async (req, res) => {
  try {
    const { courseId } = req.query;

    let q = getDb().collection('attendance');

    if (courseId) {
      q = q.where('courseId', '==', courseId);
    }

    q = q.orderBy('date', 'desc');

    const snap = await q.get();

    const uid = req.user.uid;

    let present = 0, absent = 0, late = 0;
    const sessions = [];

    snap.docs.forEach(d => {
      const data = d.data();

      const record = Array.isArray(data.records)
        ? data.records.find(r => r.studentId === uid)
        : null;

      if (record) {
        sessions.push({
          date: data.date,
          status: record.status,
          courseId: data.courseId
        });

        if (record.status === 'present') present++;
        else if (record.status === 'absent') absent++;
        else if (record.status === 'late') late++;
      }
    });

    const total = present + absent + late;

    res.json({
      summary: {
        present,
        absent,
        late,
        total,
        percentage: total
          ? Math.round(((present + late) / total) * 100)
          : 0
      },
      sessions
    });

  } catch (e) {
    console.error("GET /attendance/mine Error:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;