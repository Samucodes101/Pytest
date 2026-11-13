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

dotenv.config();

// Fail fast: in production a missing JWT_SECRET stops the server at boot rather than at first sign-in.
getJwtSecret();

const app = express();
const PORT = process.env.PORT || 5000;

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/settings', settingsRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Every minute, grade attempts whose deadline passed while the candidate was away.
const sweep = () =>
  closeExpiredAttempts()
    .then((n) => n > 0 && console.log(`Closed ${n} expired attempt(s)`))
    .catch((error) => console.error('Expired-attempt sweep failed:', error));
setInterval(sweep, 60_000).unref();
sweep();

export default app;