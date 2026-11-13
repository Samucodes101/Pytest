import fs from 'fs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/** DB_SSL_CA may hold the PEM text itself or a path to the .pem file. */
function readCa(value: string | undefined) {
  if (!value) return undefined;
  if (value.includes('BEGIN CERTIFICATE')) return value.replace(/\\n/g, '\n');
  return fs.readFileSync(value, 'utf8');
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  // DB_SSL_CA: the provider's CA certificate, for hosts like Aiven that use their own CA.
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true, ca: readCa(process.env.DB_SSL_CA) } : undefined,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'exam_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
});

export default pool;