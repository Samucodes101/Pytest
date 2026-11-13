import { Request, Response, NextFunction } from 'express';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2';
import { AuthRequest } from '../middleware/auth';

export const ActivityController = {
  /** Profile-wide audit/activity feed. Superadmin only. */
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page = '1', limit = '20', userRole, action, userId } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      let where = ' WHERE 1=1';
      const params: (string | number)[] = [];

      if (userRole) {
        where += ' AND a.user_role = ?';
        params.push(userRole as string);
      }
      if (action) {
        where += ' AND a.action = ?';
        params.push(action as string);
      }
      if (userId) {
        where += ' AND a.user_id = ?';
        params.push(parseInt(userId as string));
      }

      const query = `SELECT a.id, a.user_id, u.name as user_name, u.email as user_email,
                            a.user_role, a.action, a.entity, a.entity_id, a.details, a.created_at
                     FROM activity_logs a
                     LEFT JOIN users u ON a.user_id = u.id${where}
                     ORDER BY a.created_at DESC LIMIT ? OFFSET ?`;

      const countQuery = `SELECT COUNT(*) as total FROM activity_logs a${where}`;

      const [logs] = await pool.query<RowDataPacket[]>(query, [...params, parseInt(limit as string), offset]);
      const [countResult] = await pool.query<RowDataPacket[]>(countQuery, params);

      res.json({
        success: true,
        data: logs,
        pagination: {
          total: (countResult[0] as any).total,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /** Abstract, profile-wide operational analysis. Superadmin only. */
  async abstractAnalysis(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const [departments] = await pool.query<RowDataPacket[]>(
        `SELECT d.id, d.name,
                COUNT(DISTINCT CASE WHEN u.role = 'admin' THEN u.id END) as admins,
                COUNT(DISTINCT CASE WHEN u.role = 'student' THEN u.id END) as students
         FROM departments d
         LEFT JOIN users u ON u.department_id = d.id
         GROUP BY d.id, d.name
         ORDER BY d.name ASC`
      );

      const [activitySummary] = await pool.query<RowDataPacket[]>(
        `SELECT user_role, action, COUNT(*) as count
         FROM activity_logs
         GROUP BY user_role, action
         ORDER BY count DESC`
      );

      const [roleCounts] = await pool.query<RowDataPacket[]>(
        `SELECT role, COUNT(*) as count FROM users GROUP BY role`
      );

      const [examActivity] = await pool.query<RowDataPacket[]>(
        `SELECT e.department_id, d.name as department_name,
                COUNT(*) as exams,
                SUM(CASE WHEN e.is_active = TRUE THEN 1 ELSE 0 END) as active_exams
         FROM exams e
         LEFT JOIN departments d ON e.department_id = d.id
         GROUP BY e.department_id, d.name
         ORDER BY exams DESC`
      );

      res.json({
        success: true,
        data: {
          departments,
          activitySummary,
          roleCounts,
          examActivity,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};