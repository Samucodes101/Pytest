import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { UserModel, Role } from '../models/user.model';
import { DepartmentModel } from '../models/department.model';

export const AuthController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, password, department_id } = req.body;

      if (department_id) {
        const department = await DepartmentModel.findById(Number(department_id));
        if (!department) throw new AppError('Department not found', 400);
      }

      // Public registration always creates a student.
      const result = await AuthService.register({
        name,
        email,
        password,
        role: 'student',
        department_id: department_id ?? null,
      });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await UserModel.findById(req.userId!);
      if (!user) throw new AppError('User not found', 404);
      const department = user.department_id ? await DepartmentModel.findById(user.department_id) : null;
      res.json({ success: true, data: { ...user, department_name: department?.name ?? null } });
    } catch (error) {
      next(error);
    }
  },

  async changePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword } = req.body;
      await AuthService.changePassword(req.userId!, req.userRole as Role, currentPassword, newPassword);
      res.json({ success: true, message: 'Password updated' });
    } catch (error) {
      next(error);
    }
  },
};
