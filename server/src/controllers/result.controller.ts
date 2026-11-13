import { Response, NextFunction } from 'express';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../utils/activity';
import { resolveStudentAccess, departmentScope } from '../utils/access';
import {
  SUBMIT_GRACE_SECONDS,
  deadlineOf,
  finalizeAttempt,
  lockAssignment,
  parseJson,
  sanitizeAnswers,
  withTransaction,
  AnswerMap,
} from '../services/attempt.service';

export const ResultController = {
  /**
   * Final submission. Answers sent within the time limit (plus a short grace
   * period for network latency) are graded as submitted; anything later is
   * ignored and the last autosave from before the deadline is graded instead.
   */
  async submitExam(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { assignmentId, answers, violations } = req.body as {
        assignmentId: number;
        answers: { questionId: number; selectedAnswer: string | null }[];
        violations?: number;
      };
      if (req.userRole !== 'student') throw new AppError('Only candidates can submit exams', 403);

      const result = await withTransaction(async (conn) => {
        const a = await lockAssignment(conn, assignmentId, req.userId!);
        if (a.status === 'completed') throw new AppError('Exam already submitted', 409);

        const [questions] = await conn.execute<RowDataPacket[]>(`SELECT id FROM questions WHERE exam_id = ?`, [a.exam_id]);
        const questionIds = new Set(questions.map((q) => Number(q.id)));

        const submitted: Record<string, string> = {};
        for (const ans of answers) {
          if (ans.selectedAnswer) submitted[String(ans.questionId)] = ans.selectedAnswer;
        }

        const deadline = deadlineOf(a.started_at, Number(a.duration_minutes));
        const late = deadline !== null && Date.now() > deadline.getTime() + SUBMIT_GRACE_SECONDS * 1000;
        const graded = late
          ? sanitizeAnswers(parseJson<AnswerMap>(a.saved_answers, {}), questionIds)
          : sanitizeAnswers(submitted, questionIds);

        return finalizeAttempt(conn, a, graded, {
          autoSubmitted: late,
          violations: Math.max(Number(a.violations || 0), Number(violations || 0)),
          reason: late ? 'late_submission' : 'candidate_submit',
        });
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      if (error?.code === 'ER_DUP_ENTRY') {
        next(new AppError('Exam already submitted', 409));
        return;
      }
      next(error);
    }
  },

  async getResult(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { resultId } = req.params;

      const [results] = await pool.execute<RowDataPacket[]>(
        `SELECT r.*, e.title AS exam_title, e.subject, e.pass_mark, e.average_threshold, e.duration_minutes,
                e.show_answers, e.department_id, u.name AS student_name, u.email AS student_email
         FROM results r
         JOIN exams e ON r.exam_id = e.id
         JOIN users u ON r.user_id = u.id
         WHERE r.id = ?`,
        [resultId]
      );
      if (results.length === 0) throw new AppError('Result not found', 404);
      const result = results[0];

      // Students see their own results; admins see their department's; superadmin sees all.
      if (req.userRole === 'student' && result.user_id !== req.userId) throw new AppError('Result not found', 404);
      const scope = departmentScope(req);
      if (scope !== null && Number(result.department_id) !== Number(scope)) throw new AppError('Result not found', 404);

      const [answers] = await pool.execute<RowDataPacket[]>(
        `SELECT ua.id, ua.question_id, ua.selected_answer, ua.is_correct, ua.marks_obtained,
                q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.marks, q.topic, q.difficulty
         FROM user_answers ua
         JOIN questions q ON ua.question_id = q.id
         WHERE ua.result_id = ?
         ORDER BY q.order_index`,
        [resultId]
      );

      // When the exam hides answers, candidates get their score but not the key.
      const hideKey = req.userRole === 'student' && !result.show_answers;
      const visibleAnswers = hideKey
        ? answers.map(({ correct_answer, is_correct, marks_obtained, ...rest }) => rest)
        : answers;

      res.json({ success: true, data: { ...result, answers: visibleAnswers, answers_hidden: hideKey } });
    } catch (error) {
      next(error);
    }
  },

  async getStudentResults(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const studentId = await resolveStudentAccess(req, req.params.studentId);
      const { page = '1', limit = '20', search } = req.query;
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));

      let where = `WHERE r.user_id = ?`;
      const params: any[] = [studentId];
      if (search) {
        where += ` AND (e.title LIKE ? OR e.subject LIKE ? OR r.status LIKE ?)`;
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      const [results] = await pool.query<RowDataPacket[]>(
        `SELECT r.*, e.title as exam_title, e.subject
         FROM results r JOIN exams e ON r.exam_id = e.id
         ${where}
         ORDER BY r.completed_at DESC LIMIT ? OFFSET ?`,
        [...params, limitNum, (pageNum - 1) * limitNum]
      );
      const [countResult] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM results r JOIN exams e ON r.exam_id = e.id ${where}`,
        params
      );

      res.json({
        success: true,
        data: results,
        pagination: { total: (countResult[0] as any).total, page: pageNum, limit: limitNum },
      });
    } catch (error) {
      next(error);
    }
  },

  async getAllResults(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page = '1', limit = '20', status, examId, search } = req.query;
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));

      const conditions: string[] = ['1=1'];
      const params: any[] = [];

      if (status) {
        conditions.push('r.status = ?');
        params.push(status);
      }
      if (examId) {
        conditions.push('r.exam_id = ?');
        params.push(examId);
      }
      if (search) {
        conditions.push('(u.name LIKE ? OR u.email LIKE ? OR e.title LIKE ? OR r.status LIKE ?)');
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      // Department admins only see results for exams in their department.
      const scope = departmentScope(req);
      if (scope !== null) {
        conditions.push('e.department_id = ?');
        params.push(scope);
      }

      const where = `WHERE ${conditions.join(' AND ')}`;

      const [results] = await pool.query<RowDataPacket[]>(
        `SELECT r.*, e.title as exam_title, u.name as student_name, u.email as student_email
         FROM results r
         JOIN exams e ON r.exam_id = e.id
         JOIN users u ON r.user_id = u.id
         ${where} ORDER BY r.completed_at DESC LIMIT ? OFFSET ?`,
        [...params, limitNum, (pageNum - 1) * limitNum]
      );

      const [countResult] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM results r
         JOIN exams e ON r.exam_id = e.id
         JOIN users u ON r.user_id = u.id ${where}`,
        params
      );

      res.json({
        success: true,
        data: results,
        pagination: { total: (countResult[0] as any).total, page: pageNum, limit: limitNum },
      });
    } catch (error) {
      next(error);
    }
  },

  async exportResults(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { examId } = req.params;

      const conditions: string[] = ['e.id = ?'];
      const params: any[] = [examId];
      const scope = departmentScope(req);
      if (scope !== null) {
        conditions.push('e.department_id = ?');
        params.push(scope);
      }

      const [exams] = await pool.execute<RowDataPacket[]>(
        `SELECT e.title FROM exams e WHERE ${conditions.join(' AND ')}`,
        params
      );
      if (exams.length === 0) throw new AppError('Exam not found', 404);

      const [results] = await pool.execute<RowDataPacket[]>(
        `SELECT r.*, u.name, u.email
         FROM results r
         JOIN users u ON r.user_id = u.id
         WHERE r.exam_id = ?
         ORDER BY r.percentage DESC`,
        [examId]
      );

      const headers = [
        'Rank', 'Candidate Name', 'Email', 'Total Marks', 'Obtained Marks', 'Percentage', 'Status',
        'Time Taken (mins)', 'Auto Submitted', 'Integrity Violations', 'Completed At',
      ];
      const rows = results.map((r: any, idx: number) => [
        idx + 1,
        r.name,
        r.email,
        r.total_marks,
        r.obtained_marks,
        r.percentage,
        r.status,
        r.time_taken_seconds != null ? (r.time_taken_seconds / 60).toFixed(1) : '',
        r.auto_submitted ? 'Yes' : 'No',
        r.violations ?? 0,
        new Date(r.completed_at).toISOString(),
      ]);

      await logActivity(req.userId!, req.userRole!, 'result.export', 'exam', Number(examId), { rowCount: rows.length });

      res.json({ success: true, data: { headers, rows, examTitle: exams[0].title } });
    } catch (error) {
      next(error);
    }
  },
};
