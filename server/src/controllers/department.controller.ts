import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { DepartmentModel } from '../models/department.model';
import { logActivity } from '../utils/activity';

export const DepartmentController = {
  async listPublic(_req: Request, res: Response, next: NextFunction) {
    try {
      const departments = await DepartmentModel.findAll();
      res.json({ success: true, data: departments.map((d) => ({ id: d.id, name: d.name })) });
    } catch (error) {
      next(error);
    }
  },

  async list(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const departments = await DepartmentModel.findAll();
      res.json({ success: true, data: departments });
    } catch (error) {
      next(error);
    }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, code } = req.body;
      if (!name || String(name).trim().length < 2) throw new AppError('Department name is required', 400);

      const departmentId = await DepartmentModel.create(name, code);
      const department = await DepartmentModel.findById(departmentId);

      await logActivity(req.userId!, 'superadmin', 'department.create', 'department', departmentId, {
        name,
        code,
      });

      res.status(201).json({ success: true, data: department });
    } catch (error) {
      next(error);
    }
  },
};