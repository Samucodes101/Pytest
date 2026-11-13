import { Router } from 'express';
import { z } from 'zod';
import { ResultController } from '../controllers/result.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';

const router = Router();

const submitSchema = z.object({
  assignmentId: z.coerce.number().int().positive(),
  answers: z
    .array(
      z.object({
        questionId: z.coerce.number().int().positive(),
        selectedAnswer: z.string().max(1).nullable().optional(),
      })
    )
    .max(1000),
  violations: z.coerce.number().int().min(0).optional(),
});

router.use(authenticate);

// Student routes
router.post('/submit', validateRequest(submitSchema), ResultController.submitExam);

// Static/child routes must precede /:resultId to avoid shadowing
router.get('/student/:studentId?', ResultController.getStudentResults);

// Admin routes
router.get('/', authorize('admin'), ResultController.getAllResults);
router.get('/export/:examId', authorize('admin'), ResultController.exportResults);

// Param routes last
router.get('/:resultId', ResultController.getResult);

export default router;
