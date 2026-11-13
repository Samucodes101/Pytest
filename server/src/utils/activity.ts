import pool from '../config/database';
import { PoolConnection } from 'mysql2/promise';
import { Role } from '../models/user.model';

/**
 * Record an activity/audit entry.
 * - userRole must be one of the user roles, defaulting to 'student'.
 */
export async function logActivity(
  userId: number,
  userRole: string,
  action: string,
  entity?: string,
  entityId?: number,
  details?: Record<string, unknown>,
  /**
   * Pass the open transaction's connection when logging from inside one.
   * Borrowing a second pooled connection while holding the first can exhaust
   * the pool under load and deadlock every request.
   */
  conn?: PoolConnection
): Promise<void> {
  const role: Role = ['superadmin', 'admin', 'student'].includes(userRole)
    ? (userRole as Role)
    : 'student';

  try {
    await (conn ?? pool).execute(
      `INSERT INTO activity_logs (user_id, user_role, action, entity, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        role,
        action,
        entity ?? null,
        entityId ?? null,
        details ? JSON.stringify(details) : null,
      ]
    );
  } catch (error) {
    // Never let audit logging break the primary operation.
    console.error('Failed to log activity:', error);
  }
}