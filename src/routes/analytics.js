// src/routes/analytics.js
import { Router } from 'express';
import { getDb } from '../config/firebase.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = Router();

router.get('/dashboard', authenticate, authorize('admin'), async (req, res) => {
  try {
    const db = getDb();
    const [students, teachers, courses, enrollments, results, payments] = await Promise.all([
      db.collection('users').where('role','==','student').get(),
      db.collection('users').where('role','==','teacher').get(),
      db.collection('courses').get(),
      db.collection('enrollments').get(),
      db.collection('results').get(),
      db.collection('payments').get(),
    ]);
    const allE = enrollments.docs.map(d => d.data());
    const paid = allE.filter(e => e.paymentStatus === 'paid');
    const allR = results.docs.map(d => d.data());
    const avgScore = allR.length ? Math.round(allR.reduce((s,r) => s+r.percentage,0)/allR.length) : 0;
    const allP = payments.docs.map(d => d.data());
    const totalRevenue = allP.filter(p => p.status==='paid').reduce((s,p) => s+(p.amount||0), 0);

    const courseCount = {};
    allE.forEach(e => { courseCount[e.courseName] = (courseCount[e.courseName]||0)+1; });
    const topCourses = Object.entries(courseCount).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,count])=>({name,count}));

    const monthlyRevenue = [];
    const now = new Date();
    for (let i=5; i>=0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      const label = d.toLocaleString('default',{month:'short'});
      monthlyRevenue.push({ month: label, revenue: 0 });
    }

    res.json({
      overview: {
        totalStudents: students.size, totalTeachers: teachers.size,
        totalCourses: courses.size, totalEnrollments: enrollments.size,
        paidEnrollments: paid.length, pendingPayments: allE.length-paid.length,
        avgTestScore: avgScore, totalTestsSubmitted: results.size,
        totalRevenue,
      },
      topCourses, monthlyRevenue,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
