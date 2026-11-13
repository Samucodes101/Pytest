import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Admin only
router.get('/dashboard', authorize('admin'), AnalyticsController.getDashboardStats);
router.get('/distribution', authorize('admin'), AnalyticsController.getScoreDistribution);
router.get('/subject-performance', authorize('admin'), AnalyticsController.getSubjectPerformance);
router.get('/trends', authorize('admin'), AnalyticsController.getScoreTrends);
router.get('/top-performers', authorize('admin'), AnalyticsController.getTopPerformers);
router.get('/exam/:examId', authorize('admin'), AnalyticsController.getExamStats);
router.get('/exam/:examId/items', authorize('admin'), AnalyticsController.getItemAnalysis);

// Student - own performance
router.get('/student/:studentId?', AnalyticsController.getStudentPerformanceTrend);

export default router;
