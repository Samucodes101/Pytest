import { Router } from 'express';
import { ActivityController } from '../controllers/activity.controller';
import { authenticate, authorizeSuperadmin } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(authorizeSuperadmin);

// Profile-wide audit/activity feed
router.get('/', ActivityController.list);

// Abstract, profile-wide operational analysis
router.get('/abstract-analysis', ActivityController.abstractAnalysis);

export default router;