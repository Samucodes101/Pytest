// Idempotent schema migration. Safe to run repeatedly: every step checks
// information_schema first and only adds what is missing.
import fs from 'fs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/** DB_SSL_CA may hold the PEM text itself or a path to the .pem file. */
function readCa(value) {
  if (!value) return undefined;
  if (value.includes('BEGIN CERTIFICATE')) return value.replace(/\\n/g, '\n');
  return fs.readFileSync(value, 'utf8');
}

const c = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  // DB_SSL_CA: the provider's CA certificate, for hosts like Aiven that use their own CA.
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true, ca: readCa(process.env.DB_SSL_CA) } : undefined,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'exam_system',
});

async function hasColumn(table, column) {
  const [rows] = await c.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].n > 0;
}

async function hasTable(table) {
  const [rows] = await c.query(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows[0].n > 0;
}

async function hasIndex(table, index) {
  const [rows] = await c.query(
    `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, index]
  );
  return rows[0].n > 0;
}

async function createTable(name, ddl) {
  if (await hasTable(name)) {
    console.log(`SKIP (exists): ${name}`);
  } else {
    await c.query(ddl);
    console.log(`ADDED: ${name}`);
  }
}

// 1. Departments table
await createTable('departments', `
  CREATE TABLE departments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(20) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_department_name (name)
  )
`);

// Seed departments (upsert)
const departments = [
  ['General', 'GEN'],
  ['Computer Science', 'CSC'],
  ['Business Administration', 'BUS'],
  ['Engineering', 'ENG'],
];
for (const [name, code] of departments) {
  await c.query(
    `INSERT INTO departments (name, code) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE code = VALUES(code)`,
    [name, code]
  );
}
console.log('✓ Departments seeded');

// 2. users.department_id / users.is_active
if (await hasColumn('users', 'department_id')) {
  console.log('SKIP (exists): users.department_id');
} else {
  await c.query(`ALTER TABLE users ADD COLUMN department_id INT NULL`);
  await c.query(`ALTER TABLE users ADD INDEX idx_department_id (department_id)`);
  await c.query(`ALTER TABLE users ADD CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL`);
  console.log('ADDED: users.department_id');
}

// 3. exams.department_id
if (await hasColumn('exams', 'department_id')) {
  console.log('SKIP (exists): exams.department_id');
} else {
  await c.query(`ALTER TABLE exams ADD COLUMN department_id INT NULL`);
  await c.query(`ALTER TABLE exams ADD INDEX idx_department_id (department_id)`);
  await c.query(`ALTER TABLE exams ADD CONSTRAINT fk_exams_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL`);
  console.log('ADDED: exams.department_id');
}

// 4. Activity logs table
await createTable('activity_logs', `
  CREATE TABLE activity_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    user_role VARCHAR(20) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NULL,
    entity_id INT NULL,
    details JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_entity (entity),
    INDEX idx_created_at (created_at)
  )
`);

// 5. Organisation settings (branding) table
await createTable('settings', `
  CREATE TABLE settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )
`);

const defaultSettings = [
  ['org_name', 'PyTest'],
  ['org_tagline', 'Customizable Examination System'],
  ['logo_url', '/pgl-logo.png'],
  ['primary_color', '#1E5269'],
  ['allow_registration', 'true'],
];
for (const [key, value] of defaultSettings) {
  await c.query(`INSERT IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`, [key, value]);
}
// Use the bundled company logo where none has been set yet.
await c.query(`UPDATE settings SET setting_value = '/pgl-logo.png' WHERE setting_key = 'logo_url' AND (setting_value IS NULL OR setting_value = '')`);
console.log('✓ Default settings seeded');

// 6. Add 'superadmin' to users.role enum
const [roleCol] = await c.query(
  `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'`
);
if (roleCol[0] && roleCol[0].COLUMN_TYPE?.includes('superadmin')) {
  console.log('SKIP (exists): users.role includes superadmin');
} else {
  await c.query(`ALTER TABLE users MODIFY role ENUM('superadmin','admin','student') DEFAULT 'student'`);
  console.log('ADDED: users.role superadmin');
}

// 7. Column migrations (legacy + exam-integrity features)
const migrations = [
  { table: 'users', column: 'is_active', ddl: `ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE` },
  { table: 'exams', column: 'subject', ddl: `ALTER TABLE exams ADD COLUMN subject VARCHAR(100) NULL` },
  { table: 'exams', column: 'average_threshold', ddl: `ALTER TABLE exams ADD COLUMN average_threshold DECIMAL(5,2) DEFAULT 75.00` },
  { table: 'exams', column: 'total_questions', ddl: `ALTER TABLE exams ADD COLUMN total_questions INT DEFAULT 0` },
  { table: 'exams', column: 'shuffle_questions', ddl: `ALTER TABLE exams ADD COLUMN shuffle_questions BOOLEAN DEFAULT TRUE` },
  { table: 'exams', column: 'show_answers', ddl: `ALTER TABLE exams ADD COLUMN show_answers BOOLEAN DEFAULT TRUE` },
  { table: 'exams', column: 'max_violations', ddl: `ALTER TABLE exams ADD COLUMN max_violations INT DEFAULT 0` },
  { table: 'questions', column: 'order_index', ddl: `ALTER TABLE questions ADD COLUMN order_index INT NOT NULL DEFAULT 0` },
  { table: 'questions', column: 'difficulty', ddl: `ALTER TABLE questions ADD COLUMN difficulty ENUM('easy','medium','hard') DEFAULT 'medium'` },
  { table: 'questions', column: 'topic', ddl: `ALTER TABLE questions ADD COLUMN topic VARCHAR(100) NULL` },
  { table: 'exam_assignments', column: 'started_at', ddl: `ALTER TABLE exam_assignments ADD COLUMN started_at TIMESTAMP NULL` },
  { table: 'exam_assignments', column: 'due_date', ddl: `ALTER TABLE exam_assignments ADD COLUMN due_date TIMESTAMP NULL` },
  { table: 'exam_assignments', column: 'completed_at', ddl: `ALTER TABLE exam_assignments ADD COLUMN completed_at TIMESTAMP NULL` },
  { table: 'exam_assignments', column: 'question_order', ddl: `ALTER TABLE exam_assignments ADD COLUMN question_order JSON NULL` },
  { table: 'exam_assignments', column: 'saved_answers', ddl: `ALTER TABLE exam_assignments ADD COLUMN saved_answers JSON NULL` },
  { table: 'exam_assignments', column: 'violations', ddl: `ALTER TABLE exam_assignments ADD COLUMN violations INT DEFAULT 0` },
  { table: 'exam_assignments', column: 'last_saved_at', ddl: `ALTER TABLE exam_assignments ADD COLUMN last_saved_at TIMESTAMP NULL` },
  { table: 'results', column: 'assignment_id', ddl: `ALTER TABLE results ADD COLUMN assignment_id INT NULL` },
  { table: 'results', column: 'time_taken_seconds', ddl: `ALTER TABLE results ADD COLUMN time_taken_seconds INT NULL` },
  { table: 'results', column: 'auto_submitted', ddl: `ALTER TABLE results ADD COLUMN auto_submitted BOOLEAN DEFAULT FALSE` },
  { table: 'results', column: 'violations', ddl: `ALTER TABLE results ADD COLUMN violations INT DEFAULT 0` },
  { table: 'user_answers', column: 'marks_obtained', ddl: `ALTER TABLE user_answers ADD COLUMN marks_obtained DECIMAL(5,2) DEFAULT 0` },
];

for (const m of migrations) {
  if (await hasColumn(m.table, m.column)) {
    console.log(`SKIP (exists): ${m.table}.${m.column}`);
  } else {
    await c.query(m.ddl);
    console.log(`ADDED: ${m.table}.${m.column}`);
  }
}

// Ensure unique assignment (exam_id, user_id) so ON DUPLICATE KEY UPDATE works.
if (await hasIndex('exam_assignments', 'unique_assignment')) {
  console.log('SKIP (exists): exam_assignments unique_assignment');
} else {
  await c.query(`ALTER TABLE exam_assignments ADD UNIQUE KEY unique_assignment (exam_id, user_id)`);
  console.log('ADDED: exam_assignments unique_assignment (exam_id, user_id)');
}

// One result per assignment: blocks double-submission races at the database level.
if (await hasIndex('results', 'unique_result_assignment')) {
  console.log('SKIP (exists): results unique_result_assignment');
} else {
  await c.query(`ALTER TABLE results ADD UNIQUE KEY unique_result_assignment (assignment_id)`);
  console.log('ADDED: results unique_result_assignment (assignment_id)');
}

// Legacy rows created before departments existed: place them in "General" so
// department-scoped admins can see them.
const [[general]] = await c.query(`SELECT id FROM departments WHERE code = 'GEN'`);
if (general) {
  const [u] = await c.query(`UPDATE users SET department_id = ? WHERE department_id IS NULL AND role <> 'superadmin'`, [general.id]);
  const [e] = await c.query(`UPDATE exams SET department_id = ? WHERE department_id IS NULL`, [general.id]);
  console.log(`✓ Backfilled department for ${u.affectedRows} user(s) and ${e.affectedRows} exam(s)`);
}

console.log('\nMigration complete.');
await c.end();
