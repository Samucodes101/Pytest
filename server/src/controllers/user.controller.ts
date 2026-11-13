
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { UserModel, Role } from '../models/user.model';
import { DepartmentModel } from '../models/department.model';
import { logActivity } from '../utils/activity';
import { resolveStudentAccess, departmentScope } from '../utils/access';

export const UserController = {
  /** Create a student. Admins create students within their own department. */
  async createStudent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, email, password, department_id } = req.body;
      const actorRole = (req.userRole || 'student') as Role;
      const actorDept = req.userDepartmentId ?? null;

      // Department-scoped admins can only create users in their own department.
      let departmentId = department_id ?? null;
      if (actorRole === 'admin') {
        if (!actorDept) throw new AppError('Admin has no department assigned', 403);
        departmentId = actorDept;
      } else if (departmentId) {
        const department = await DepartmentModel.findById(Number(departmentId));
        if (!department) throw new AppError('Department not found', 404);
      }

      const existing = await UserModel.findByEmail(email);
      if (existing) throw new AppError('Email already registered', 409);

      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = await UserModel.create({
        name,
        email,
        password: hashedPassword,
        role: 'student',
        department_id: departmentId,
      });

      const user = await UserModel.findById(userId);

      await logActivity(req.userId!, actorRole, 'user.create_student', 'user', userId, {
        email,
        department_id: departmentId,
      });

      res.status(201).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  },

  /** Create an admin, scoped to a department. Superadmin only. */
  async createAdmin(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, email, password, department_id } = req.body;

      if (!department_id) {
        throw new AppError('department_id is required when creating an admin', 400);
      }

      const department = await DepartmentModel.findById(Number(department_id));
      if (!department) throw new AppError('Department not found', 404);

      const existing = await UserModel.findByEmail(email);
      if (existing) throw new AppError('Email already registered', 409);

      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = await UserModel.create({
        name,
        email,
        password: hashedPassword,
        role: 'admin',
        department_id: department.id,
      });

      const user = await UserModel.findById(userId);

      await logActivity(req.userId!, 'superadmin', 'user.create_admin', 'user', userId, {
        email,
        department_id: department.id,
      });

      res.status(201).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  },

  /** List all admins. Superadmin only (profile-wide view of admins). */
  async getAllAdmins(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page = '1', limit = '20' } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      const [admins] = await pool.query<RowDataPacket[]>(
        `SELECT u.id, u.name, u.email, u.role, u.department_id, d.name as department_name, u.is_active, u.created_at
         FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE u.role = 'admin'
         ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
        [parseInt(limit as string), offset]
      );

      const [countResult] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM users WHERE role = 'admin'`
      );

      res.json({
        success: true,
        data: admins,
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

  /** List students. Department-scoped for admins; profile-wide for superadmin. */
  async getAllStudents(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page = '1', limit = '20' } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      const actorRole = req.userRole as Role;
      const actorDept = req.userDepartmentId ?? null;

      let where = `WHERE u.role = 'student'`;
      const params: (string | number)[] = [];

      if (actorRole === 'admin') {
        where += ` AND u.department_id = ?`;
        params.push(actorDept ?? -1);
      }

      const [users] = await pool.query<RowDataPacket[]>(
        `SELECT u.id, u.name, u.email, u.department_id, d.name as department_name, u.is_active, u.created_at,
                (SELECT COUNT(*) FROM results r WHERE r.user_id = u.id) AS exams_taken,
                (SELECT ROUND(AVG(r.percentage), 2) FROM results r WHERE r.user_id = u.id) AS average_percentage
         FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         ${where}
         ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
        [...params, parseInt(limit as string), offset]
      );

      const [countResult] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM users u ${where}`,
        params
      );

      res.json({
        success: true,
        data: users,
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

  async getStudentStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const studentId = await resolveStudentAccess(req, req.params.id);

      const [results] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          COUNT(DISTINCT exam_id) as exams_taken,
          SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'above_average' THEN 1 ELSE 0 END) as above_average,
          ROUND(AVG(percentage), 2) as average_percentage,
          MAX(percentage) as highest_score,
          MIN(percentage) as lowest_score
         FROM results WHERE user_id = ?`,
        [studentId]
      );

      res.json({ success: true, data: results[0] || {} });
    } catch (error) {
      next(error);
    }
  },

  async searchStudents(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { q } = req.query;
      if (!q) return res.status(400).json({ success: false, message: 'Query required' });

      const searchTerm = `%${q}%`;
      const actorRole = req.userRole as Role;
      const actorDept = req.userDepartmentId ?? null;

      let where = `u.role = 'student' AND (u.name LIKE ? OR u.email LIKE ?)`;
      if (actorRole === 'student') throw new AppError('Forbidden', 403);
      const params: (string | number)[] = [searchTerm, searchTerm];

      if (actorRole === 'admin') {
        where += ` AND u.department_id = ?`;
        params.push(actorDept ?? -1);
      }

      const [users] = await pool.execute<RowDataPacket[]>(
        `SELECT u.id, u.name, u.email, u.department_id, d.name as department_name, u.is_active, u.created_at
         FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE ${where}
         LIMIT 20`,
        params
      );

      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  },

  async getStudentById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const studentId = await resolveStudentAccess(req, req.params.id);

      const [users] = await pool.execute<RowDataPacket[]>(
        `SELECT u.id, u.name, u.email, u.department_id, d.name as department_name, u.avatar, u.is_active, u.created_at, u.updated_at
         FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE u.id = ? AND u.role = 'student'`,
        [studentId]
      );

      if (users.length === 0) throw new AppError('Student not found', 404);

      res.json({ success: true, data: users[0] });
    } catch (error) {
      next(error);
    }
  },

  /** Activate or deactivate an account. Deactivated users are signed out on their next request. */
  async setStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const targetId = parseInt(req.params.id);
      const { is_active } = req.body as { is_active: boolean };
      if (targetId === req.userId) throw new AppError('You cannot deactivate your own account', 400);

      const [rows] = await pool.execute<RowDataPacket[]>(`SELECT id, role, department_id, email FROM users WHERE id = ?`, [targetId]);
      if (rows.length === 0) throw new AppError('User not found', 404);
      const target = rows[0];

      // Admins manage students in their own department; only the superadmin manages admins.
      if (target.role === 'superadmin') throw new AppError('The superadmin account cannot be deactivated', 403);
      if (target.role === 'admin' && req.userRole !== 'superadmin') throw new AppError('Forbidden', 403);
      const scope = departmentScope(req);
      if (scope !== null && Number(target.department_id) !== Number(scope)) throw new AppError('Forbidden', 403);

      await pool.execute(`UPDATE users SET is_active = ? WHERE id = ?`, [is_active, targetId]);
      await logActivity(req.userId!, req.userRole!, is_active ? 'user.activate' : 'user.deactivate', 'user', targetId, {
        email: target.email,
      });

      res.json({ success: true, data: { id: targetId, is_active } });
    } catch (error) {
      next(error);
    }
  },
};
