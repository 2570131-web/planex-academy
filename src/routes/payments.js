// src/routes/payments.js
import { Router } from 'express';
import { getDb, ts } from '../config/firebase.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = Router();

router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { status, search } = req.query;

    let query = getDb().collection('payments');

    // 🔹 FILTER BY STATUS
    if (status && status !== 'all') {
      query = query.where('status', '==', status);
    }

    const snap = await query.orderBy('createdAt', 'desc').get();

    let payments = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 🔹 SEARCH FILTER (client-side fallback)
    if (search) {
      const s = search.toLowerCase();
      payments = payments.filter(p =>
        (p.studentName || '').toLowerCase().includes(s) ||
        (p.courseName || '').toLowerCase().includes(s) ||
        (p.invoiceNumber || '').toLowerCase().includes(s)
      );
    }

    res.json({ payments });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/mine', authenticate, async (req, res) => {
  try {
    const snap = await getDb().collection('payments').where('studentId','==',req.user.uid).orderBy('createdAt','desc').get();
    res.json({ payments: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { enrollmentId, courseId, courseName, amount, method='pending' } = req.body;
    const data = {
      enrollmentId, courseId, courseName, amount:+amount,
      studentId: req.user.uid, studentName: req.user.name,
      method, status:'pending',
      invoiceNumber: `INV-${Date.now()}`,
      createdAt: ts(),
    };
    const ref = await getDb().collection('payments').add(data);
    res.status(201).json({ payment: { id: ref.id, ...data } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/approve', authenticate, authorize('admin'), async (req, res) => {
  try {
    const paymentRef = getDb().collection('payments').doc(req.params.id);
    const paymentDoc = await paymentRef.get();

    await paymentRef.update({
      status: 'paid',
      approvedBy: req.user.uid,
      approvedAt: ts()
    });

    const enrollmentId = paymentDoc.data().enrollmentId;

    if (enrollmentId) {
      await getDb().collection('enrollments').doc(enrollmentId).update({
        paymentStatus: 'paid'
      });
    }

    res.json({ message: 'Payment approved' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id/reject', authenticate, authorize('admin'), async (req, res) => {
  try {
    await getDb().collection('payments').doc(req.params.id).update({ status:'failed', rejectedAt: ts() });
    res.json({ message: 'Payment rejected' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
