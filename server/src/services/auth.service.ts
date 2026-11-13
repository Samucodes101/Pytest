import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import pool from '../config/database';
import { UserModel, Role } from '../models/user.model';
import { AppError } from '../middleware/errorHandler';
import { logActivity } from '../utils/activity';
import { getJwtSecret } from '../middleware/auth';
import { getSettings } from '../controllers/settings.controller';

export const AuthService = {
  async register(data: {
    name: string;
    email: string;
    password: string;
    role?: Role;
    department_id?: number | null;
  }) {
    const settings = await getSettings();
    if (settings.allow_registration === 'false') {
      throw new AppError('Self-registration is disabled. Ask an administrator to create your account.', 403);
    }

    const existing = await UserModel.findByEmail(data.email);
    if (existing) throw new AppError('Email already registered', 409);

    // Only allow student self-registration through the public register endpoint.
    const role: Role = data.role || 'student';

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const userId = await UserModel.create({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role,
      department_id: data.department_id ?? null,
    });

    const token = this.generateToken(userId, data.email, role, data.department_id ?? null);
    const user = await UserModel.findById(userId);

    await logActivity(userId, role, 'auth.register', 'user', userId, { email: data.email });

    return { user, token };
  },

  async login(email: string, password: string) {
    const user = await UserModel.findByEmail(email);
    if (!user) throw new AppError('Invalid credentials', 401);

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new AppError('Invalid credentials', 401);

    if (user.is_active === false) throw new AppError('Account is deactivated', 403);

    const token = this.generateToken(user.id, user.email, user.role, user.department_id);
    const { password: _, ...userWithoutPassword } = user;

    await logActivity(user.id, user.role, 'auth.login', 'user', user.id, { email: user.email });

    return { user: userWithoutPassword, token };
  },

  async changePassword(userId: number, role: Role, currentPassword: string, newPassword: string) {
    const [rows] = await pool.execute<any[]>(`SELECT password FROM users WHERE id = ?`, [userId]);
    if (!rows[0]) throw new AppError('User not found', 404);

    const isValid = await bcrypt.compare(currentPassword, rows[0].password);
    if (!isValid) throw new AppError('Current password is incorrect', 400);

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.execute(`UPDATE users SET password = ? WHERE id = ?`, [hashed, userId]);
    await logActivity(userId, role, 'auth.change_password', 'user', userId);
  },

  generateToken(
    id: number,
    email: string,
    role: Role,
    department_id?: number | null
  ): string {
    const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];
    return jwt.sign(
      { id, email, role, department_id: department_id ?? null },
      getJwtSecret(),
      { expiresIn }
    );
  },
};

export { pool };