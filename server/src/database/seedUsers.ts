import bcrypt from 'bcryptjs';
import pool from '../config/database';

const PASSWORD = 'password123';

interface SeedUser {
  name: string;
  email: string;
  role: 'superadmin' | 'admin' | 'student';
  department_code?: string;
}

const users: SeedUser[] = [
  { name: 'Super Admin', email: 'superadmin@example.com', role: 'superadmin' },
  { name: 'Admin User', email: 'admin@example.com', role: 'admin', department_code: 'CSC' },
  { name: 'John Doe', email: 'john@example.com', role: 'student', department_code: 'CSC' },
  { name: 'Jane Smith', email: 'jane@example.com', role: 'student', department_code: 'BUS' },
  { name: 'Bob Wilson', email: 'bob@example.com', role: 'student', department_code: 'ENG' },
  { name: 'Alice Johnson', email: 'alice@example.com', role: 'student', department_code: 'CSC' },
  { name: 'Charlie Brown', email: 'charlie@example.com', role: 'student', department_code: 'BUS' },
];

async function getDepartmentId(code?: string): Promise<number | null> {
  if (!code) return null;
  const [rows]: any = await pool.execute(
    `SELECT id FROM departments WHERE code = ?`,
    [code]
  );
  return rows[0] ? rows[0].id : null;
}

async function seedUsers() {
  try {
    console.log('Hashing password and seeding users...');

    const hashedPassword = await bcrypt.hash(PASSWORD, 10);

    for (const user of users) {
      const departmentId = await getDepartmentId(user.department_code);
      await pool.execute(
        `INSERT INTO users (name, email, password, role, department_id)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           password = VALUES(password),
           role = VALUES(role),
           department_id = VALUES(department_id)`,
        [user.name, user.email, hashedPassword, user.role, departmentId]
      );
      console.log(`✓ Upserted ${user.role}: ${user.email}`);
    }

    console.log('✓ User seeding completed successfully!');
    console.log(`All users password: "${PASSWORD}"`);
    console.log(`Superadmin login: superadmin@example.com / ${PASSWORD}`);
    process.exit(0);
  } catch (error) {
    console.error('✗ Seeding error:', error);
    process.exit(1);
  }
}

seedUsers();