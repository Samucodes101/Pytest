import { Request, Response, NextFunction } from 'express';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2';
import { AuthRequest } from '../middleware/auth';
import { Role } from '../models/user.model';
import { AppError } from '../middleware/errorHandler';
import { resolveStudentAccess, departmentScope } from '../utils/access';

export const AnalyticsController = {
  async getDashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const role = req.userRole as Role;
      const deptId = req.userDepartmentId ?? null;

      // Total students (department-scoped for admins)
      const studentWhere = role === 'admin' ? 'AND u.department_id = ?' : '';
      const studentParams: any[] = role === 'admin' ? [deptId ?? -1] : [];

      const [studentCount] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM users u WHERE u.role = 'student' ${studentWhere}`,
        studentParams
      );

      // Total exams (department-scoped for admins)
      const examWhere = role === 'admin' ? 'AND department_id = ?' : '';
      const examParams: any[] = role === 'admin' ? [deptId ?? -1] : [];
      const [examCount] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM exams WHERE is_active = TRUE ${examWhere}`,
        examParams
      );

      // Exams currently being written (live attempts) and assignments still outstanding.
      const [liveRows] = await pool.execute<RowDataPacket[]>(
        `SELECT
           SUM(CASE WHEN ea.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
           SUM(CASE WHEN ea.status = 'pending' THEN 1 ELSE 0 END) AS pending,
           ROUND(AVG(r.percentage), 2) AS average_score
         FROM exam_assignments ea
         JOIN exams e ON ea.exam_id = e.id
         LEFT JOIN results r ON r.assignment_id = ea.id
         WHERE e.is_active = TRUE ${role === 'admin' ? 'AND e.department_id = ?' : ''}`,
        examParams
      );
      const live = liveRows[0] as any;

      // Pass/Fail rates (department-scoped for admins)
      const joinSql = role === 'admin' ? 'WHERE e.department_id = ?' : '';
      const resultParams: any[] = role === 'admin' ? [deptId ?? -1] : [];
      const [passFailStats] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          SUM(CASE WHEN r.status = 'passed' THEN 1 ELSE 0 END) as passed,
          SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN r.status = 'above_average' THEN 1 ELSE 0 END) as above_average,
          COUNT(*) as total
         FROM results r
         JOIN exams e ON r.exam_id = e.id
         ${joinSql}`,
        resultParams
      );

      const stats = passFailStats[0] as any;
      // "Above average" results are passes too.
      const passed = Number(stats.passed || 0) + Number(stats.above_average || 0);
      const failed = Number(stats.failed || 0);
      const total = Number(stats.total || 0);
      const passRate = total > 0 ? ((passed / total) * 100).toFixed(2) : '0.00';
      const failRate = total > 0 ? ((failed / total) * 100).toFixed(2) : '0.00';

      // Historical rates (prior 30 days) for trend calculation
      const [historical] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          SUM(CASE WHEN r.status IN ('passed', 'above_average') THEN 1 ELSE 0 END) as passed,
          SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END) as failed,
          COUNT(*) as total
         FROM results r
         JOIN exams e ON r.exam_id = e.id
         ${joinSql ? `${joinSql} AND` : 'WHERE'} r.completed_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        resultParams
      );
      const hist = historical[0] as any;
      const histPassed = Number(hist?.passed || 0);
      const histFailed = Number(hist?.failed || 0);
      const histTotal = Number(hist?.total || 0);

      const histPassRate = histTotal > 0 ? (histPassed / histTotal) * 100 : parseFloat(passRate);
      const histFailRate = histTotal > 0 ? (histFailed / histTotal) * 100 : parseFloat(failRate);

      res.json({
        success: true,
        data: {
          totalStudents: Number((studentCount[0] as any).total || 0),
          totalExams: Number((examCount[0] as any).total || 0),
          totalResults: total,
          passedCount: Number(stats.passed || 0),
          failedCount: failed,
          aboveAverageCount: Number(stats.above_average || 0),
          passRate,
          failRate,
          inProgressCount: Number(live?.in_progress || 0),
          pendingCount: Number(live?.pending || 0),
          averageScore: Number(live?.average_score || 0),
          passRateTrend: parseFloat(passRate) - histPassRate,
          failRateTrend: parseFloat(failRate) - histFailRate,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getScoreDistribution(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const role = req.userRole as Role;
      const deptId = req.userDepartmentId ?? null;
      const filter = role === 'admin' ? 'AND e.department_id = ?' : '';
      const params: any[] = role === 'admin' ? [deptId ?? -1] : [];

      const [distribution] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          SUM(CASE WHEN r.percentage >= 90 THEN 1 ELSE 0 END) as 'A (90-100)',
          SUM(CASE WHEN r.percentage >= 80 AND r.percentage < 90 THEN 1 ELSE 0 END) as 'B (80-89)',
          SUM(CASE WHEN r.percentage >= 70 AND r.percentage < 80 THEN 1 ELSE 0 END) as 'C (70-79)',
          SUM(CASE WHEN r.percentage >= 60 AND r.percentage < 70 THEN 1 ELSE 0 END) as 'D (60-69)',
          SUM(CASE WHEN r.percentage < 60 THEN 1 ELSE 0 END) as 'F (Below 60)'
         FROM results r
         JOIN exams e ON r.exam_id = e.id
         WHERE 1=1 ${filter}`,
        params
      );

      const data = distribution[0] as any;

      res.json({
        success: true,
        data: [
          { grade: 'A (90-100)', count: data['A (90-100)'] || 0 },
          { grade: 'B (80-89)', count: data['B (80-89)'] || 0 },
          { grade: 'C (70-79)', count: data['C (70-79)'] || 0 },
          { grade: 'D (60-69)', count: data['D (60-69)'] || 0 },
          { grade: 'F (Below 60)', count: data['F (Below 60)'] || 0 },
        ],
      });
    } catch (error) {
      next(error);
    }
  },

  async getSubjectPerformance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const role = req.userRole as Role;
      const deptId = req.userDepartmentId ?? null;
      const filter = role === 'admin' ? 'WHERE e.department_id = ?' : '';
      const params: any[] = role === 'admin' ? [deptId ?? -1] : [];

      const [performance] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          e.subject,
          COUNT(DISTINCT r.id) as total_attempts,
          ROUND(AVG(r.percentage), 2) as average_score,
          MAX(r.percentage) as highest_score,
          MIN(r.percentage) as lowest_score,
          SUM(CASE WHEN r.status IN ('passed', 'above_average') THEN 1 ELSE 0 END) as pass_count
         FROM results r
         JOIN exams e ON r.exam_id = e.id
         ${filter}
         GROUP BY e.subject
         ORDER BY average_score DESC`,
        params
      );

      res.json({ success: true, data: performance });
    } catch (error) {
      next(error);
    }
  },

  async getScoreTrends(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const role = req.userRole as Role;
      const deptId = req.userDepartmentId ?? null;
      const filter = role === 'admin' ? 'AND e.department_id = ?' : '';
      const params: any[] = role === 'admin' ? [deptId ?? -1] : [];

      const [trends] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          DATE(r.completed_at) as date,
          COUNT(*) as exam_count,
          ROUND(AVG(r.percentage), 2) as average_percentage,
          MAX(r.percentage) as highest_score,
          MIN(r.percentage) as lowest_score
         FROM results r
         JOIN exams e ON r.exam_id = e.id
         WHERE r.completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) ${filter}
         GROUP BY DATE(r.completed_at)
         ORDER BY date ASC`,
        params
      );

      res.json({ success: true, data: trends });
    } catch (error) {
      next(error);
    }
  },

  async getTopPerformers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { limit = '10' } = req.query;
      const role = req.userRole as Role;
      const deptId = req.userDepartmentId ?? null;
      const filter = role === 'admin' ? 'AND u.department_id = ?' : '';
      const params: any[] = role === 'admin' ? [deptId ?? -1] : [];

      const [performers] = await pool.query<RowDataPacket[]>(
        `SELECT 
          u.id, u.name, u.email,
          COUNT(DISTINCT r.exam_id) as exams_taken,
          ROUND(AVG(r.percentage), 2) as average_percentage,
          SUM(CASE WHEN r.status IN ('passed', 'above_average') THEN 1 ELSE 0 END) as passed_count
         FROM users u
         JOIN results r ON u.id = r.user_id
         WHERE u.role = 'student' ${filter}
         GROUP BY u.id
         ORDER BY average_percentage DESC, exams_taken DESC
         LIMIT ?`,
        [...params, parseInt(limit as string)]
      );

      res.json({ success: true, data: performers });
    } catch (error) {
      next(error);
    }
  },

  async getExamStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { examId } = req.params;
      const role = req.userRole as Role;
      const deptId = req.userDepartmentId ?? null;
      const filter = role === 'admin' ? 'AND e.department_id = ?' : '';
      const params: any[] = role === 'admin' ? [examId, deptId ?? -1] : [examId];

      const [stats] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          e.id, e.title, e.subject,
          COUNT(DISTINCT r.id) as total_attempts,
          COUNT(DISTINCT r.user_id) as total_students,
          ROUND(AVG(r.percentage), 2) as average_score,
          SUM(CASE WHEN r.status = 'passed' THEN 1 ELSE 0 END) as passed,
          SUM(CASE WHEN r.status = 'above_average' THEN 1 ELSE 0 END) as above_average,
          SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END) as failed
         FROM exams e
         LEFT JOIN results r ON e.id = r.exam_id
         WHERE e.id = ? ${filter}
         GROUP BY e.id`,
        params
      );

      if (stats.length === 0) {
        return res.status(404).json({ success: false, message: 'Exam not found' });
      }

      res.json({ success: true, data: stats[0] });
    } catch (error) {
      next(error);
    }
  },

  async getStudentPerformanceTrend(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const studentId = await resolveStudentAccess(req, req.params.studentId);

      const [trend] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          e.title as exam_name,
          r.percentage,
          r.status,
          r.completed_at,
          r.obtained_marks,
          r.total_marks
         FROM results r
         JOIN exams e ON r.exam_id = e.id
         WHERE r.user_id = ?
         ORDER BY r.completed_at ASC`,
        [studentId]
      );

      res.json({ success: true, data: trend });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Classical item analysis for one exam:
   * - difficulty index p = share of candidates who answered correctly
   * - discrimination index D = p(upper 27%) - p(lower 27%), ranked by total score
   * - the most popular wrong option (a hint for misleading distractors)
   */
  async getItemAnalysis(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { examId } = req.params;
      const scope = departmentScope(req);
      const [exams] = await pool.execute<RowDataPacket[]>(
        `SELECT id, title FROM exams WHERE id = ? ${scope !== null ? 'AND department_id = ?' : ''}`,
        scope !== null ? [examId, scope] : [examId]
      );
      if (exams.length === 0) throw new AppError('Exam not found', 404);

      const [questions] = await pool.execute<RowDataPacket[]>(
        `SELECT id, question_text, correct_answer, difficulty, topic, order_index FROM questions WHERE exam_id = ? ORDER BY order_index`,
        [examId]
      );
      const [results] = await pool.execute<RowDataPacket[]>(
        `SELECT id, percentage FROM results WHERE exam_id = ? ORDER BY percentage DESC`,
        [examId]
      );
      const [answers] = await pool.execute<RowDataPacket[]>(
        `SELECT ua.result_id, ua.question_id, ua.selected_answer, ua.is_correct
         FROM user_answers ua JOIN results r ON r.id = ua.result_id
         WHERE r.exam_id = ?`,
        [examId]
      );

      const n = results.length;
      const groupSize = Math.max(1, Math.round(n * 0.27));
      const upper = new Set(results.slice(0, groupSize).map((r) => r.id));
      const lower = new Set(results.slice(-groupSize).map((r) => r.id));

      const items = questions.map((q) => {
        const qa = answers.filter((a) => a.question_id === q.id);
        const correct = qa.filter((a) => a.is_correct).length;
        const optionCounts: Record<string, number> = { a: 0, b: 0, c: 0, d: 0, blank: 0 };
        for (const a of qa) {
          const key = a.selected_answer || 'blank';
          optionCounts[key] = (optionCounts[key] || 0) + 1;
        }

        const pGroup = (ids: Set<number>) => {
          const inGroup = qa.filter((a) => ids.has(a.result_id));
          return inGroup.length ? inGroup.filter((a) => a.is_correct).length / inGroup.length : 0;
        };

        const wrongOptions = ['a', 'b', 'c', 'd'].filter((o) => o !== q.correct_answer);
        const topDistractor = wrongOptions.reduce((best, o) => (optionCounts[o] > optionCounts[best] ? o : best), wrongOptions[0]);
        const difficultyIndex = qa.length ? correct / qa.length : null;
        const discrimination = n >= 2 ? Number((pGroup(upper) - pGroup(lower)).toFixed(2)) : null;

        let flag: string | null = null;
        if (difficultyIndex !== null) {
          if (difficultyIndex > 0.9) flag = 'too_easy';
          else if (difficultyIndex < 0.2) flag = 'too_hard';
          else if (discrimination !== null && discrimination < 0) flag = 'negative_discrimination';
        }

        return {
          question_id: q.id,
          number: Number(q.order_index) + 1,
          question_text: q.question_text,
          topic: q.topic,
          tagged_difficulty: q.difficulty,
          correct_answer: q.correct_answer,
          responses: qa.length,
          correct,
          difficulty_index: difficultyIndex !== null ? Number(difficultyIndex.toFixed(2)) : null,
          discrimination_index: discrimination,
          option_counts: optionCounts,
          top_distractor: optionCounts[topDistractor] > 0 ? topDistractor : null,
          flag,
        };
      });

      res.json({ success: true, data: { exam: exams[0], candidates: n, items } });
    } catch (error) {
      next(error);
    }
  },
};
