import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RowDataPacket } from 'mysql2';
import pool from '../config/database';

export interface AuthRequest extends Request {
  user?: { id: number; email: string; role: string; department_id?: number | null };
  userId?: number;
  userRole?: string;
  userDepartmentId?: number | null;
}

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production');
    }
    return 'dev-only-insecure-secret';
  }
  return secret;
};

/**
 * Verify the bearer token, then reload the user from the database so that a
 * deactivated account, a changed role or a moved department takes effect on
 * the very next request instead of when the token expires.
 */
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];
  let decoded: { id: number };
  try {
    decoded = jwt.verify(token, getJwtSecret()) as { id: number };
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
    return;
  }

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, email, role, department_id, is_active FROM users WHERE id = ?`,
      [decoded.id]
    );
    const user = rows[0];
    if (!user) {
      res.status(401).json({ message: 'Account no longer exists' });
      return;
    }
    if (user.is_active === 0 || user.is_active === false) {
      res.status(401).json({ message: 'Account is deactivated' });
      return;
    }

    req.user = { id: user.id, email: user.email, role: user.role, department_id: user.department_id ?? null };
    req.userId = user.id;
    req.userRole = user.role;
    req.userDepartmentId = user.department_id ?? null;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Authorize by role. Superadmins are granted access to any role-protected route,
 * so a superadmin can do anything an admin can.
 */
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }
    if (req.user.role === 'superadmin' || roles.includes(req.user.role)) {
      next();
      return;
    }
    res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
  };
};

/** Restrict to superadmin only. */
export const authorizeSuperadmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Not authenticated' });
    return;
  }
  if (req.user.role === 'superadmin') {
    next();
    return;
  }
  res.status(403).json({ message: 'Forbidden: Superadmin access required' });
};
