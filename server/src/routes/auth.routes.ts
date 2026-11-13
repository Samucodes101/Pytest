import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { rateLimit } from '../middleware/security';
import { z } from 'zod';

const router = Router();

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password,
  department_id: z.number().int().positive().nullable().optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: password,
});

// 10 login attempts per 15 minutes per IP + email: slows password guessing
// without locking out a whole office that shares one IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => `${req.ip}:${String(req.body?.email || '').toLowerCase()}`,
});

router.post('/register', rateLimit({ windowMs: 60 * 60 * 1000, max: 20 }), validateRequest(registerSchema), AuthController.register);
router.post('/login', loginLimiter, validateRequest(loginSchema), AuthController.login);
router.get('/me', authenticate, AuthController.me);
router.put('/password', authenticate, validateRequest(changePasswordSchema), AuthController.changePassword);

export default router;
