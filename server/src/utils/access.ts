import pool from '../config/database';
import { RowDataPacket } from 'mysql2';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

/**
 * Resolve which student a request is about and check the caller may see them.
 * - students may only ever read their own records (any requested id is ignored unless it is theirs)
 * - department admins may read students in their own department
 * - superadmins may read anyone
 */
export async function resolveStudentAccess(req: AuthRequest, requestedId?: string): Promise<number> {
  const actorId = req.userId;
  if (!actorId) throw new AppError('Not authenticated', 401);

  const parsed = requestedId ? parseInt(requestedId) : NaN;
  const studentId = Number.isNaN(parsed) ? actorId : parsed;

  if (req.userRole === 'student') {
    if (studentId !== actorId) throw new AppError('Forbidden: you can only view your own records', 403);
    return studentId;
  }

  if (req.userRole === 'admin' && studentId !== actorId) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT department_id FROM users WHERE id = ?`,
      [studentId]
    );
    if (rows.length === 0) throw new AppError('Student not found', 404);
    if (Number(rows[0].department_id) !== Number(req.userDepartmentId)) {
      throw new AppError('Forbidden: student belongs to another department', 403);
    }
  }

  return studentId;
}

/** Department filter for admins; superadmins are unrestricted. */
export function departmentScope(req: AuthRequest): number | null {
  if (req.userRole === 'admin') return req.userDepartmentId ?? -1;
  return null;
}
