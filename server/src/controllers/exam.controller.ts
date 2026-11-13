import { Response, NextFunction } from 'express';
import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { Role } from '../models/user.model';
import { logActivity } from '../utils/activity';
import { resolveStudentAccess, departmentScope } from '../utils/access';
import {
  SUBMIT_GRACE_SECONDS,
  deadlineOf,
  finalizeAttempt,
  lockAssignment,
  parseJson,
  sanitizeAnswers,
  shuffle,
  withTransaction,
  AnswerMap,
} from '../services/attempt.service';

interface QuestionInput {
  id?: number;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: 'a' | 'b' | 'c' | 'd';
  marks: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  topic?: string | null;
}

/** Load an exam the caller may manage (department admins only see their own department). */
async function findManagedExam(req: AuthRequest, examId: number | string) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, title, department_id, duration_minutes FROM exams WHERE id = ? AND is_active = TRUE`,
    [examId]
  );
  if (rows.length === 0) throw new AppError('Exam not found', 404);
  const exam = rows[0];
  const scope = departmentScope(req);
  if (scope !== null && Number(exam.department_id) !== Number(scope)) {
    throw new AppError('Forbidden: Exam belongs to another department', 403);
  }
  return exam;
}

/** Public shape of a question for candidates: never includes the correct answer. */
function toCandidateQuestion(q: RowDataPacket) {
  return {
    id: q.id,
    question_text: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    marks: q.marks,
  };
}

export const ExamController = {
  async createExam(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const {
        title, description, subject, department_id, pass_mark, average_threshold, duration_minutes,
        shuffle_questions, show_answers, max_violations, questions,
      } = req.body as Record<string, any> & { questions: QuestionInput[] };
      const actorRole = (req.userRole || 'student') as Role;

      // Department admins are locked to their department.
      let departmentId: number | null = department_id ?? null;
      if (actorRole === 'admin') {
        if (!req.userDepartmentId) throw new AppError('Admin has no department assigned', 403);
        departmentId = req.userDepartmentId;
      }

      const totalMarks = questions.reduce((sum, q) => sum + Number(q.marks || 1), 0);

      const examId = await withTransaction(async (conn) => {
        const [result] = await conn.execute<ResultSetHeader>(
          `INSERT INTO exams (title, description, subject, department_id, pass_mark, average_threshold, duration_minutes,
                              total_marks, total_questions, shuffle_questions, show_answers, max_violations, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            title, description ?? null, subject ?? null, departmentId, pass_mark, average_threshold, duration_minutes,
            totalMarks, questions.length, shuffle_questions, show_answers, max_violations, req.userId,
          ]
        );

        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          await conn.execute(
            `INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_answer, marks, difficulty, topic, order_index)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [result.insertId, q.text, q.optionA, q.optionB, q.optionC, q.optionD, q.correctAnswer, q.marks || 1, q.difficulty || 'medium', q.topic || null, i]
          );
        }
        return result.insertId;
      });

      await logActivity(req.userId!, actorRole, 'exam.create', 'exam', examId, {
        title,
        department_id: departmentId,
        questions: questions.length,
      });

      res.status(201).json({ success: true, data: { id: examId } });
    } catch (error) {
      next(error);
    }
  },

  async getExams(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page = '1', limit = '20', subject, search } = req.query;
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
      const offset = (pageNum - 1) * limitNum;

      const conditions: string[] = ['e.is_active = TRUE'];
      const filterParams: any[] = [];

      const scope = departmentScope(req);
      if (scope !== null) {
        conditions.push('e.department_id = ?');
        filterParams.push(scope);
      }

      // Candidates only see exams that have been assigned to them.
      if (req.userRole === 'student') {
        conditions.push('e.id IN (SELECT exam_id FROM exam_assignments WHERE user_id = ?)');
        filterParams.push(req.userId);
      }

      if (subject) {
        conditions.push('e.subject = ?');
        filterParams.push(subject);
      }

      if (search) {
        conditions.push('(e.title LIKE ? OR e.subject LIKE ? OR e.description LIKE ?)');
        const searchTerm = `%${search}%`;
        filterParams.push(searchTerm, searchTerm, searchTerm);
      }

      const where = `WHERE ${conditions.join(' AND ')}`;

      const [exams] = await pool.query<RowDataPacket[]>(
        `SELECT e.id, e.title, e.description, e.subject, e.department_id, d.name AS department_name, e.pass_mark,
                e.average_threshold, e.duration_minutes, e.total_marks, e.total_questions, e.created_by, e.created_at,
                (SELECT COUNT(*) FROM exam_assignments ea WHERE ea.exam_id = e.id) AS assigned_count,
                (SELECT COUNT(*) FROM results r WHERE r.exam_id = e.id) AS attempt_count
         FROM exams e
         LEFT JOIN departments d ON e.department_id = d.id
         ${where}
         ORDER BY e.created_at DESC LIMIT ? OFFSET ?`,
        [...filterParams, limitNum, offset]
      );

      const [countResult] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM exams e ${where}`, filterParams);

      res.json({
        success: true,
        data: exams,
        pagination: { total: (countResult[0] as any).total, page: pageNum, limit: limitNum },
      });
    } catch (error) {
      next(error);
    }
  },

  async getExamDetails(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const isStudent = req.userRole === 'student';

      const params: any[] = [id];
      let where = `e.id = ? AND e.is_active = TRUE`;
      const scope = departmentScope(req);
      if (scope !== null) {
        where += ' AND e.department_id = ?';
        params.push(scope);
      }

      const [exams] = await pool.execute<RowDataPacket[]>(
        `SELECT e.*, d.name AS department_name
         FROM exams e LEFT JOIN departments d ON e.department_id = d.id
         WHERE ${where}`,
        params
      );
      if (exams.length === 0) throw new AppError('Exam not found', 404);

      if (isStudent) {
        // Candidates get the exam overview and their own assignment, never the
        // question paper: questions are only released when the timed attempt starts.
        const [assignment] = await pool.execute<RowDataPacket[]>(
          `SELECT ea.id, ea.status, ea.assigned_at, ea.started_at, ea.due_date, ea.completed_at, r.id AS result_id
           FROM exam_assignments ea LEFT JOIN results r ON r.assignment_id = ea.id
           WHERE ea.exam_id = ? AND ea.user_id = ?`,
          [id, req.userId!]
        );
        if (assignment.length === 0) throw new AppError('Exam not found', 404);
        res.json({ success: true, data: { ...exams[0], questions: [], assignment: assignment[0] } });
        return;
      }

      const [questions] = await pool.execute<RowDataPacket[]>(
        `SELECT id, question_text, option_a, option_b, option_c, option_d, correct_answer, marks, difficulty, topic, order_index,
                (SELECT COUNT(*) FROM user_answers ua WHERE ua.question_id = questions.id) AS answer_count
         FROM questions WHERE exam_id = ? ORDER BY order_index`,
        [id]
      );

      res.json({ success: true, data: { ...exams[0], questions } });
    } catch (error) {
      next(error);
    }
  },

  async updateExam(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const {
        title, description, subject, department_id, pass_mark, average_threshold, duration_minutes,
        shuffle_questions, show_answers, max_violations, questions,
      } = req.body as Record<string, any> & { questions?: QuestionInput[] };
      const actorRole = (req.userRole || 'student') as Role;

      const existingExam = await findManagedExam(req, id);
      const departmentId: number | null =
        actorRole === 'admin' ? req.userDepartmentId ?? null : department_id ?? existingExam.department_id ?? null;

      await withTransaction(async (conn) => {
        await conn.execute(
          `UPDATE exams SET title = ?, description = ?, subject = ?, department_id = ?, pass_mark = ?, average_threshold = ?,
                            duration_minutes = ?, shuffle_questions = ?, show_answers = ?, max_violations = ?
           WHERE id = ?`,
          [title, description ?? null, subject ?? null, departmentId, pass_mark, average_threshold, duration_minutes,
           shuffle_questions, show_answers, max_violations, id]
        );

        if (!Array.isArray(questions)) return;

        // Update questions in place so that candidates' recorded answers (which
        // reference question ids) survive an edit. Only questions removed from the
        // paper are deleted, and only if nobody has answered them yet.
        const [current] = await conn.execute<RowDataPacket[]>(
          `SELECT q.id, (SELECT COUNT(*) FROM user_answers ua WHERE ua.question_id = q.id) AS answer_count
           FROM questions q WHERE q.exam_id = ?`,
          [id]
        );
        const currentIds = new Map(current.map((q) => [Number(q.id), Number(q.answer_count)]));
        const keptIds = new Set(questions.filter((q) => q.id && currentIds.has(Number(q.id))).map((q) => Number(q.id)));

        for (const [qid, answerCount] of currentIds) {
          if (keptIds.has(qid)) continue;
          if (answerCount > 0) {
            throw new AppError('A question that candidates have already answered cannot be removed. Edit it instead, or create a new exam.', 409);
          }
          await conn.execute(`DELETE FROM questions WHERE id = ?`, [qid]);
        }

        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const values = [q.text, q.optionA, q.optionB, q.optionC, q.optionD, q.correctAnswer, q.marks || 1, q.difficulty || 'medium', q.topic || null, i];
          if (q.id && keptIds.has(Number(q.id))) {
            await conn.execute(
              `UPDATE questions SET question_text = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_answer = ?,
                                    marks = ?, difficulty = ?, topic = ?, order_index = ?
               WHERE id = ? AND exam_id = ?`,
              [...values, q.id, id]
            );
          } else {
            await conn.execute(
              `INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_answer, marks, difficulty, topic, order_index, exam_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [...values, id]
            );
          }
        }

        const totalMarks = questions.reduce((sum, q) => sum + Number(q.marks || 1), 0);
        await conn.execute(`UPDATE exams SET total_questions = ?, total_marks = ? WHERE id = ?`, [questions.length, totalMarks, id]);
      });

      await logActivity(req.userId!, actorRole, 'exam.update', 'exam', Number(id), {
        title,
        department_id: departmentId,
        questions: questions?.length,
      });

      res.json({ success: true, message: 'Exam updated' });
    } catch (error) {
      next(error);
    }
  },

  async deleteExam(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const existingExam = await findManagedExam(req, id);

      // Soft delete: results and audit history keep pointing at a real row.
      await pool.execute(`UPDATE exams SET is_active = FALSE WHERE id = ?`, [id]);

      await logActivity(req.userId!, req.userRole!, 'exam.delete', 'exam', Number(id), { title: existingExam.title });

      res.json({ success: true, message: 'Exam deleted' });
    } catch (error) {
      next(error);
    }
  },

  async assignExam(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { examId, studentIds, dueDate } = req.body as { examId: number; studentIds: number[]; dueDate?: string | null };
      const exam = await findManagedExam(req, examId);

      // Only students (in the admin's department, for department admins) can be assigned.
      const placeholders = studentIds.map(() => '?').join(',');
      const scope = departmentScope(req);
      const [eligible] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM users WHERE role = 'student' AND is_active = TRUE AND id IN (${placeholders})
         ${scope !== null ? 'AND department_id = ?' : ''}`,
        scope !== null ? [...studentIds, scope] : studentIds
      );
      if (eligible.length !== new Set(studentIds).size) {
        throw new AppError('One or more selected candidates are not eligible for this exam', 400);
      }

      const due = dueDate ? new Date(dueDate) : null;
      let created = 0;
      for (const { id: studentId } of eligible) {
        // Re-assigning only updates the due date: it never reopens a completed attempt.
        const [result] = await pool.execute<ResultSetHeader>(
          `INSERT INTO exam_assignments (exam_id, user_id, due_date) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE due_date = VALUES(due_date)`,
          [examId, studentId, due]
        );
        if (result.affectedRows === 1) created++;
      }

      await logActivity(req.userId!, req.userRole!, 'exam.assign', 'exam', Number(examId), {
        exam_title: exam.title,
        studentCount: eligible.length,
        newAssignments: created,
        due_date: due ? due.toISOString() : null,
      });

      res.status(201).json({ success: true, data: { assigned: eligible.length, created } });
    } catch (error) {
      next(error);
    }
  },

  /** Admin view of who an exam is assigned to and how far each candidate got. */
  async getExamAssignments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await findManagedExam(req, id);

      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT ea.id, ea.user_id, u.name, u.email, ea.status, ea.assigned_at, ea.started_at, ea.due_date, ea.completed_at,
                ea.violations, r.id AS result_id, r.percentage, r.status AS result_status, r.auto_submitted, r.time_taken_seconds
         FROM exam_assignments ea
         JOIN users u ON u.id = ea.user_id
         LEFT JOIN results r ON r.assignment_id = ea.id
         WHERE ea.exam_id = ?
         ORDER BY u.name`,
        [id]
      );
      res.json({ success: true, data: rows });
    } catch (error) {
      next(error);
    }
  },

  /** Allow a candidate to retake: removes their result and reopens the assignment. */
  async resetAssignment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const assignmentId = Number(req.params.assignmentId);
      const [rows] = await pool.execute<RowDataPacket[]>(`SELECT id, exam_id, user_id FROM exam_assignments WHERE id = ?`, [assignmentId]);
      if (rows.length === 0) throw new AppError('Assignment not found', 404);
      const exam = await findManagedExam(req, rows[0].exam_id);

      await withTransaction(async (conn) => {
        await conn.execute(`DELETE FROM results WHERE assignment_id = ?`, [assignmentId]);
        await conn.execute(
          `UPDATE exam_assignments
           SET status = 'pending', started_at = NULL, completed_at = NULL, question_order = NULL,
               saved_answers = NULL, violations = 0, last_saved_at = NULL
           WHERE id = ?`,
          [assignmentId]
        );
      });

      await logActivity(req.userId!, req.userRole!, 'exam.reset_attempt', 'exam_assignment', assignmentId, {
        exam_title: exam.title,
        student_id: rows[0].user_id,
      });

      res.json({ success: true, message: 'Attempt reset' });
    } catch (error) {
      next(error);
    }
  },

  async getStudentAssignments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const studentId = await resolveStudentAccess(req, req.params.studentId);

      const [assignments] = await pool.execute<RowDataPacket[]>(
        `SELECT
          ea.id, ea.exam_id, ea.status, ea.assigned_at, ea.started_at, ea.due_date, ea.completed_at,
          e.title, e.description, e.subject, e.duration_minutes, e.total_marks, e.total_questions, e.pass_mark,
          r.id as result_id, r.obtained_marks, r.percentage, r.status as result_status
         FROM exam_assignments ea
         JOIN exams e ON ea.exam_id = e.id
         LEFT JOIN results r ON ea.id = r.assignment_id
         WHERE ea.user_id = ? AND e.is_active = TRUE
         ORDER BY ea.assigned_at DESC`,
        [studentId]
      );

      res.json({ success: true, data: assignments });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Start (or resume) a timed attempt. The server records the start time once,
   * fixes a per-candidate question order, and returns the deadline so the
   * countdown survives page refreshes and cannot be extended from the browser.
   */
  async startAttempt(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const assignmentId = Number(req.params.assignmentId);
      if (req.userRole !== 'student') throw new AppError('Only candidates can take exams', 403);

      const payload = await withTransaction(async (conn) => {
        const a = await lockAssignment(conn, assignmentId, req.userId!);
        if (!a.is_active) throw new AppError('This exam is no longer available', 410);
        if (a.status === 'completed') {
          const [r] = await conn.execute<RowDataPacket[]>(`SELECT id FROM results WHERE assignment_id = ?`, [assignmentId]);
          return { completed: true, resultId: r[0]?.id ?? null };
        }

        const [questions] = await conn.execute<RowDataPacket[]>(
          `SELECT id, question_text, option_a, option_b, option_c, option_d, marks FROM questions WHERE exam_id = ? ORDER BY order_index`,
          [a.exam_id]
        );
        if (questions.length === 0) throw new AppError('This exam has no questions yet', 409);

        if (!a.started_at) {
          if (a.due_date && new Date(a.due_date).getTime() < Date.now()) {
            throw new AppError('The due date for this exam has passed', 410);
          }
          const ids = questions.map((q) => Number(q.id));
          const order = a.shuffle_questions ? shuffle(ids) : ids;
          await conn.execute(
            `UPDATE exam_assignments SET status = 'in_progress', started_at = NOW(), question_order = ?, saved_answers = ? WHERE id = ?`,
            [JSON.stringify(order), JSON.stringify({}), assignmentId]
          );
          const [[fresh]] = await conn.query<RowDataPacket[]>(`SELECT started_at FROM exam_assignments WHERE id = ?`, [assignmentId]);
          a.started_at = fresh.started_at;
          a.question_order = order;
          a.saved_answers = {};
          await logActivity(req.userId!, 'student', 'exam.start', 'exam_assignment', assignmentId, { exam_id: a.exam_id }, conn);
        }

        const deadline = deadlineOf(a.started_at, Number(a.duration_minutes))!;
        const questionIds = new Set(questions.map((q) => Number(q.id)));
        const saved = sanitizeAnswers(parseJson<AnswerMap>(a.saved_answers, {}), questionIds);

        // Time ran out while the candidate was away: grade what was autosaved.
        if (Date.now() > deadline.getTime() + SUBMIT_GRACE_SECONDS * 1000) {
          const graded = await finalizeAttempt(conn, a, saved, {
            autoSubmitted: true,
            violations: Number(a.violations || 0),
            reason: 'time_expired',
          });
          return { completed: true, resultId: graded.resultId };
        }

        // Questions added after the attempt started go to the end of the order.
        const order = parseJson<number[]>(a.question_order, []).filter((id) => questionIds.has(id));
        for (const q of questions) if (!order.includes(Number(q.id))) order.push(Number(q.id));
        const byId = new Map(questions.map((q) => [Number(q.id), q]));

        return {
          completed: false,
          assignmentId,
          exam: {
            id: a.exam_id,
            title: a.title,
            description: a.description,
            duration_minutes: a.duration_minutes,
            total_marks: a.total_marks,
            max_violations: a.max_violations,
          },
          questions: order.map((qid) => toCandidateQuestion(byId.get(qid)!)),
          savedAnswers: saved,
          violations: Number(a.violations || 0),
          startedAt: new Date(a.started_at).toISOString(),
          deadline: deadline.toISOString(),
          serverNow: new Date().toISOString(),
        };
      });

      res.json({ success: true, data: payload });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Autosave in-progress answers and the integrity-violation counter. If the
   * exam's violation limit is exceeded the attempt is closed immediately.
   */
  async saveProgress(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const assignmentId = Number(req.params.assignmentId);
      const { answers, violations } = req.body as { answers: AnswerMap; violations: number };

      const payload = await withTransaction(async (conn) => {
        const a = await lockAssignment(conn, assignmentId, req.userId!);
        if (a.status !== 'in_progress') throw new AppError('This attempt is not in progress', 409);

        const deadline = deadlineOf(a.started_at, Number(a.duration_minutes))!;
        if (Date.now() > deadline.getTime() + SUBMIT_GRACE_SECONDS * 1000) {
          throw new AppError('Time is up: answers can no longer be changed', 410);
        }

        const [questions] = await conn.execute<RowDataPacket[]>(`SELECT id FROM questions WHERE exam_id = ?`, [a.exam_id]);
        const clean = sanitizeAnswers(answers, new Set(questions.map((q) => Number(q.id))));
        // The counter only ever goes up, so a tampered client cannot clear it.
        const violationCount = Math.max(Number(a.violations || 0), Number(violations || 0));

        await conn.execute(
          `UPDATE exam_assignments SET saved_answers = ?, violations = ?, last_saved_at = NOW() WHERE id = ?`,
          [JSON.stringify(clean), violationCount, assignmentId]
        );

        const limit = Number(a.max_violations || 0);
        if (limit > 0 && violationCount > limit) {
          const graded = await finalizeAttempt(conn, a, clean, {
            autoSubmitted: true,
            violations: violationCount,
            reason: 'violation_limit',
          });
          return { saved: true, autoSubmitted: true, resultId: graded.resultId };
        }

        return { saved: true, autoSubmitted: false, savedAt: new Date().toISOString() };
      });

      res.json({ success: true, data: payload });
    } catch (error) {
      next(error);
    }
  },
};
