import { Router } from 'express';
import { DepartmentController } from '../controllers/department.controller';
import { authenticate, authorize, authorizeSuperadmin } from '../middleware/auth';

const router = Router();

// Public: the registration form lets candidates pick their department.
router.get('/public', DepartmentController.listPublic);

router.use(authenticate);

// Listing departments is available to admin + superadmin (needed for admin-scoped UI)
router.get('/', authorize('admin'), DepartmentController.list);

// Creating/modifying departments is superadmin-only.
router.post('/', authorizeSuperadmin, DepartmentController.create);

export default router;
