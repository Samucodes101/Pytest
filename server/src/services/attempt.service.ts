import { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import pool from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logActivity } from '../utils/activity';

/** Seconds of network/clock slack allowed after the deadline before answers are frozen. */
export const SUBMIT_GRACE_SECONDS = 30;

export type AnswerMap = Record<string, string>;
export type ResultStatus = 'passed' | 'failed' | 'above_average';

const VALID_OPTIONS = new Set(['a', 'b', 'c', 'd']);

/** Fisher–Yates shuffle; returns a new array. */
export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

/** Keep only answers to known questions with a valid option letter. */
export function sanitizeAnswers(raw: unknown, questionIds: Set<number>): AnswerMap {
  const clean: AnswerMap = {};
  if (!raw || typeof raw !== 'object') return clean;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number(key);
    const option = String(value ?? '').toLowerCase();
    if (questionIds.has(id) && VALID_OPTIONS.has(option)) clean[String(id)] = option;
  }
  return clean;
}

export function classify(percentage: number, passMark: number, aboveAverage: number): ResultStatus {
  if (percentage >= aboveAverage) return 'above_average';
  if (percentage >= passMark) return 'passed';
  return 'failed';
}

export function deadlineOf(startedAt: Date | string | null, durationMinutes: number): Date | null {
  if (!startedAt) return null;
  return new Date(new Date(startedAt).getTime() + durationMinutes * 60 * 1000);
}

/**
 * Grade and close an attempt. Runs inside the caller's transaction and expects
 * the assignment row to already be locked with SELECT ... FOR UPDATE.
 */
export async function finalizeAttempt(
  conn: PoolConnection,
  assignment: RowDataPacket,
  answers: AnswerMap,
  opts: { autoSubmitted: boolean; violations: number; reason: string }
) {
  const [questions] = await conn.execute<RowDataPacket[]>(
    `SELECT id, correct_answer, marks FROM questions WHERE exam_id = ? ORDER BY order_index`,
    [assignment.exam_id]
  );

  let totalMarks = 0;
  let obtainedMarks = 0;
  const graded = questions.map((q) => {
    const marks = Number(q.marks || 1);
    const selected = answers[String(q.id)] ?? null;
    const isCorrect = selected !== null && selected === q.correct_answer;
    const marksObtained = isCorrect ? marks : 0;
    totalMarks += marks;
    obtainedMarks += marksObtained;
    return { questionId: q.id as number, selected, isCorrect, marksObtained };
  });

  const percentage = totalMarks > 0 ? Number(((obtainedMarks / totalMarks) * 100).toFixed(2)) : 0;
  const status = classify(percentage, Number(assignment.pass_mark), Number(assignment.average_threshold));

  const now = new Date();
  const durationSeconds = Number(assignment.duration_minutes) * 60;
  const timeTaken = assignment.started_at
    ? Math.min(durationSeconds, Math.max(0, Math.round((now.getTime() - new Date(assignment.started_at).getTime()) / 1000)))
    : null;

  const [insert] = await conn.execute<ResultSetHeader>(
    `INSERT INTO results (assignment_id, exam_id, user_id, total_marks, obtained_marks, percentage, status,
                          time_taken_seconds, auto_submitted, violations)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      assignment.id,
      assignment.exam_id,
      assignment.user_id,
      totalMarks,
      obtainedMarks,
      percentage,
      status,
      timeTaken,
      opts.autoSubmitted,
      opts.violations,
    ]
  );
  const resultId = insert.insertId;

  for (const g of graded) {
    await conn.execute(
      `INSERT INTO user_answers (result_id, question_id, selected_answer, is_correct, marks_obtained)
       VALUES (?, ?, ?, ?, ?)`,
      [resultId, g.questionId, g.selected, g.isCorrect, g.marksObtained]
    );
  }

  await conn.execute(
    `UPDATE exam_assignments
     SET status = 'completed', completed_at = NOW(), saved_answers = ?, violations = ?
     WHERE id = ?`,
    [JSON.stringify(answers), opts.violations, assignment.id]
  );

  await logActivity(
    assignment.user_id,
    'student',
    opts.autoSubmitted ? 'result.auto_submit' : 'result.submit',
    'result',
    resultId,
    { exam_id: assignment.exam_id, percentage, reason: opts.reason, violations: opts.violations },
    conn
  );

  return { resultId, obtainedMarks, totalMarks, percentage, status, autoSubmitted: opts.autoSubmitted };
}

/**
 * Lock an assignment (with its exam settings) for the current transaction.
 * Only the assignment row is locked (FOR UPDATE OF ea): locking the shared exam
 * row too would make every candidate of the same exam queue behind each other.
 */
export async function lockAssignment(conn: PoolConnection, assignmentId: number, userId: number) {
  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT ea.*, e.title, e.description, e.pass_mark, e.average_threshold, e.duration_minutes, e.total_marks,
            e.shuffle_questions, e.max_violations, e.is_active
     FROM exam_assignments ea
     JOIN exams e ON ea.exam_id = e.id
     WHERE ea.id = ? AND ea.user_id = ?
     FOR UPDATE OF ea`,
    [assignmentId, userId]
  );
  if (rows.length === 0) throw new AppError('Assignment not found', 404);
  return rows[0];
}

/** Run a callback in a transaction, always releasing the connection. */
export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Close attempts whose time ran out while the candidate was away, grading the
 * last autosave. Without this, an abandoned attempt would stay "in progress"
 * until the candidate happened to reopen it.
 */
export async function closeExpiredAttempts(): Promise<number> {
  const [expired] = await pool.execute<RowDataPacket[]>(
    `SELECT ea.id, ea.user_id
     FROM exam_assignments ea JOIN exams e ON e.id = ea.exam_id
     WHERE ea.status = 'in_progress'
       AND ea.started_at < DATE_SUB(NOW(), INTERVAL (e.duration_minutes * 60 + ?) SECOND)`,
    [SUBMIT_GRACE_SECONDS]
  );

  let closed = 0;
  for (const row of expired) {
    try {
      await withTransaction(async (conn) => {
        const a = await lockAssignment(conn, row.id, row.user_id);
        if (a.status !== 'in_progress') return; // closed by the candidate in the meantime
        const [questions] = await conn.execute<RowDataPacket[]>(`SELECT id FROM questions WHERE exam_id = ?`, [a.exam_id]);
        const answers = sanitizeAnswers(parseJson<AnswerMap>(a.saved_answers, {}), new Set(questions.map((q) => Number(q.id))));
        await finalizeAttempt(conn, a, answers, { autoSubmitted: true, violations: Number(a.violations || 0), reason: 'time_expired' });
        closed++;
      });
    } catch (error) {
      console.error(`Failed to close expired attempt ${row.id}:`, error);
    }
  }
  return closed;
}
