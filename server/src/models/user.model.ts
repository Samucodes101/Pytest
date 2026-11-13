import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export type Role = 'superadmin' | 'admin' | 'student';

export interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  role: Role;
  department_id: number | null;
  avatar: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role?: Role;
  department_id?: number | null;
}

const PUBLIC_COLUMNS =
  'id, name, email, role, department_id, avatar, is_active, created_at, updated_at';

export const UserModel = {
  async findByEmail(email: string): Promise<User | null> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM users WHERE email = ?', [email]);
    return (rows[0] as User) || null;
  },

  async findById(id: number): Promise<Omit<User, 'password'> | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?`,
      [id]
    );
    return (rows[0] as Omit<User, 'password'>) || null;
  },

  async create(user: CreateUserInput): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (name, email, password, role, department_id) VALUES (?, ?, ?, ?, ?)',
      [user.name, user.email, user.password, user.role || 'student', user.department_id ?? null]
    );
    return result.insertId;
  },

  async findAll(params: {
    page?: number;
    limit?: number;
    role?: string;
    departmentId?: number | null;
  }): Promise<{ users: Omit<User, 'password'>[]; total: number }> {
    const { page = 1, limit = 20, role, departmentId } = params;
    const offset = (page - 1) * limit;
    let where = ' WHERE 1=1';
    const values: (string | number | null)[] = [];

    if (role) {
      where += ' AND role = ?';
      values.push(role);
    }

    if (departmentId !== undefined && departmentId !== null) {
      where += ' AND department_id = ?';
      values.push(departmentId);
    }

    const query = `SELECT ${PUBLIC_COLUMNS} FROM users${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const countQuery = `SELECT COUNT(*) as total FROM users${where}`;

    const [rows] = await pool.execute<RowDataPacket[]>(query, [...values, limit, offset]);
    const [countRows] = await pool.execute<RowDataPacket[]>(countQuery, values);

    return {
      users: rows as Omit<User, 'password'>[],
      total: (countRows[0] as { total: number }).total,
    };
  },
};