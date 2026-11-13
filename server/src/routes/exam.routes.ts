import { Router } from 'express';
import { z } from 'zod';
import { ExamController } from '../controllers/exam.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';

const router = Router();

const questionSchema = z.object({
  id: z.number().int().positive().optional(),
  text: z.string().trim().min(1, 'Question text is required').max(5000),
  optionA: z.string().trim().min(1).max(500),
  optionB: z.string().trim().min(1).max(500),
  optionC: z.string().trim().min(1).max(500),
  optionD: z.string().trim().min(1).max(500),
  correctAnswer: z.enum(['a', 'b', 'c', 'd']),
  marks: z.coerce.number().positive().max(100).default(1),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  topic: z.string().trim().max(100).nullable().optional(),
});

const examSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(5000).nullable().optional(),
    subject: z.string().trim().max(100).nullable().optional(),
    department_id: z.number().int().positive().nullable().optional(),
    pass_mark: z.coerce.number().min(0).max(100).default(50),
    average_threshold: z.coerce.number().min(0).max(100).default(75),
    duration_minutes: z.coerce.number().int().min(1).max(600).default(60),
    shuffle_questions: z.boolean().default(true),
    show_answers: z.boolean().default(true),
    max_violations: z.coerce.number().int().min(0).max(50).default(0),
    questions: z.array(questionSchema).min(1, 'Add at least one question').max(500),
  })
  .refine((e) => e.average_threshold >= e.pass_mark, {
    message: 'The above-average threshold must be at least the pass mark',
    path: ['average_threshold'],
  });

const assignSchema = z.object({
  examId: z.coerce.number().int().positive(),
  studentIds: z.array(z.coerce.number().int().positive()).min(1, 'Select at least one candidate').max(1000),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
});

const progressSchema = z.object({
  answers: z.record(z.string(), z.string()).default({}),
  violations: z.coerce.number().int().min(0).default(0),
});

router.use(authenticate);

// Admin only
router.post('/', authorize('admin'), validateRequest(examSchema), ExamController.createExam);
router.put('/:id', authorize('admin'), validateRequest(examSchema), ExamController.updateExam);
router.delete('/:id', authorize('admin'), ExamController.deleteExam);
router.post('/assign', authorize('admin'), validateRequest(assignSchema), ExamController.assignExam);
router.get('/:id/assignments', authorize('admin'), ExamController.getExamAssignments);
router.post('/assignments/:assignmentId/reset', authorize('admin'), ExamController.resetAssignment);

// Candidate attempt lifecycle
router.post('/assignments/:assignmentId/start', ExamController.startAttempt);
router.put('/assignments/:assignmentId/progress', validateRequest(progressSchema), ExamController.saveProgress);

// Student assignments (must precede /:id to avoid route shadowing)
router.get('/assignments/:studentId?', ExamController.getStudentAssignments);

// All authenticated users
router.get('/', ExamController.getExams);
router.get('/:id', ExamController.getExamDetails);

export default router;
