import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  // DB_SSL_CA: the provider's CA certificate (PEM), for hosts like Aiven that use their own CA.
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true, ca: process.env.DB_SSL_CA?.replace(/\\n/g, '\n') || undefined } : undefined,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'exam_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
});

export default pool;