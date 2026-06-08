// ═══════════════════════════════════════════════════════
//  Planex Academy v2 — Backend API  |  src/index.js
// ═══════════════════════════════════════════════════════
import express from 'express';
import cors from 'cors';
import messageRoutes from './routes/messages.js'; 
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { initFirebase } from './config/firebase.js';

// Route imports
import authRoutes          from './routes/auth.js';
import userRoutes          from './routes/users.js';
import courseRoutes        from './routes/courses.js';
import materialRoutes      from './routes/materials.js';
import testRoutes          from './routes/tests.js';
import enrollmentRoutes    from './routes/enrollments.js';
import settingsRoutes      from './routes/settings.js';
import analyticsRoutes     from './routes/analytics.js';
import notificationRoutes  from './routes/notifications.js';
import attendanceRoutes    from './routes/attendance.js';
import paymentRoutes       from './routes/payments.js';
import assignmentRoutes    from './routes/assignments.js';
import resultRoutes        from './routes/results.js';

dotenv.config();
initFirebase();

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security ──────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ── CORS ──────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    const allowed = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(s => s.trim());
    if (!origin || allowed.includes(origin) || allowed.includes('*')) return cb(null, true);
    cb(new Error('CORS not allowed'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

// ── Rate limiting ─────────────────────────────────────
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many requests. Try again later.' },
}));

// ── Body parsing ──────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Logging ───────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// ── Health check ──────────────────────────────────────
app.get('/health', (_req, res) => res.json({
  status: 'ok', app: 'Planex Academy API v2',
  timestamp: new Date().toISOString(),
}));

// ── API Routes ────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/courses',       courseRoutes);
app.use('/api/materials',     materialRoutes);
app.use('/api/tests',         testRoutes);
app.use('/api/enrollments',   enrollmentRoutes);
app.use('/api/settings',      settingsRoutes);
app.use('/api/analytics',     analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/attendance',    attendanceRoutes);
app.use('/api/payments',      paymentRoutes);
app.use('/api/assignments',   assignmentRoutes);
app.use('/api/results',       resultRoutes);
app.use('/api/messages',      messageRoutes);

// ── 404 ───────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Global error handler ──────────────────────────────
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  console.error(`[${status}]`, err.message);
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀  Planex Academy API  →  http://localhost:${PORT}`);
  console.log(`📋  Health check       →  http://localhost:${PORT}/health\n`);
});

export default app;
