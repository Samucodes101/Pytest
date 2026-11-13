import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface Department {
  id: number;
  name: string;
  code: string | null;
  created_at: Date;
  updated_at: Date;
}

export const DepartmentModel = {
  async findAll(): Promise<Department[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, name, code, created_at, updated_at FROM departments ORDER BY name ASC'
    );
    return rows as Department[];
  },

  async findById(id: number): Promise<Department | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, name, code, created_at, updated_at FROM departments WHERE id = ?',
      [id]
    );
    return (rows[0] as Department) || null;
  },

  async create(name: string, code?: string): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO departments (name, code) VALUES (?, ?)',
      [name, code ?? null]
    );
    return result.insertId;
  },
};