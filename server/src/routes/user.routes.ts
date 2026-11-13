import { Router } from 'express';
import { z } from 'zod';
import { UserController } from '../controllers/user.controller';
import { authenticate, authorize, authorizeSuperadmin } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';

const router = Router();

const accountSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  department_id: z.coerce.number().int().positive().nullable().optional(),
});

const statusSchema = z.object({ is_active: z.boolean() });

router.use(authenticate);

// Admin + superadmin routes
router.post('/', authorize('admin'), validateRequest(accountSchema), UserController.createStudent);
router.patch('/:id/status', authorize('admin'), validateRequest(statusSchema), UserController.setStatus);

// Superadmin-only routes (must precede /:id and /search to avoid shadowing)
router.post('/admin', authorizeSuperadmin, validateRequest(accountSchema), UserController.createAdmin);
router.get('/admin', authorizeSuperadmin, UserController.getAllAdmins);

// Shared routes (controllers enforce per-record access)
router.get('/search', authorize('admin'), UserController.searchStudents);
router.get('/stats/:id?', UserController.getStudentStats);
router.get('/:id', UserController.getStudentById);
router.get('/', authorize('admin'), UserController.getAllStudents);

export default router;
