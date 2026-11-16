import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import examRoutes from './routes/exam.routes';
import resultRoutes from './routes/result.routes';
import analyticsRoutes from './routes/analytics.routes';
import departmentRoutes from './routes/department.routes';
import activityRoutes from './routes/activity.routes';
import settingsRoutes from './routes/settings.routes';
import { errorHandler } from './middleware/errorHandler';
import { securityHeaders } from './middleware/security';
import { getJwtSecret } from './middleware/auth';
import { closeExpiredAttempts } from './services/attempt.service';
import pool, { dbConfigProblem } from './config/database';

dotenv.config();

const onVercel = Boolean(process.env.VERCEL);

// Configuration problems found at startup. Locally a missing JWT_SECRET stops the
// server straight away; on Vercel the app still starts so /api/health can say what is wrong.
const configProblems: string[] = [];
if (dbConfigProblem) configProblems.push(dbConfigProblem);
try {
  getJwtSecret();
} catch (error) {
  if (!onVercel) throw error;
  configProblems.push((error as Error).message);
}

const app = express();
const PORT = process.env.PORT || 5000;

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Reports configuration and database status. Shows only whether settings are present, never their values.
app.get('/api/health', async (_req, res) => {
  const names = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_SSL', 'DB_SSL_CA', 'JWT_SECRET', 'NODE_ENV', 'CORS_ORIGIN'];
  const settings = Object.fromEntries(names.map((n) => [n, Boolean(process.env[n]?.trim())]));
  let database: { ok: boolean; error?: string } = { ok: true };
  try {
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out connecting to the database')), 8000)),
    ]);
  } catch (error: any) {
    database = { ok: false, error: [error?.code, error?.message].filter(Boolean).join(': ') };
  }
  const ok = database.ok && configProblems.length === 0;
  res.status(ok ? 200 : 500).json({ status: ok ? 'ok' : 'error', problems: configProblems, database, settings, timestamp: new Date().toISOString() });
});

// Grade attempts whose deadline passed while the candidate was away.
let lastSweep = 0;
const sweep = () =>
  closeExpiredAttempts()
    .then((n) => n > 0 && console.log(`Closed ${n} expired attempt(s)`))
    .catch((error) => console.error('Expired-attempt sweep failed:', error));

// On Vercel the app only runs while handling requests, so the sweep piggybacks
// on incoming traffic (at most once a minute) instead of using a timer.
if (onVercel) {
  app.use(async (_req, _res, next) => {
    if (Date.now() - lastSweep > 60_000) {
      lastSweep = Date.now();
      await sweep();
    }
    next();
  });
}

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/settings', settingsRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

app.use(errorHandler);

if (!onVercel) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  setInterval(sweep, 60_000).unref();
  sweep();
}

export default app;