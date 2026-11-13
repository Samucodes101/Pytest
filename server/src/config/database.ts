import fs from 'fs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/** DB_SSL_CA may hold the PEM text itself or a path to the .pem file. */
function readCa(value: string | undefined) {
  if (!value) return undefined;
  if (value.includes('BEGIN CERTIFICATE')) return value.replace(/\\n/g, '\n');
  if (fs.existsSync(value)) return fs.readFileSync(value, 'utf8');
  throw new Error('DB_SSL_CA must be the full certificate text (including the BEGIN/END CERTIFICATE lines) or a path to the .pem file');
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

// Some hosted MySQL services (e.g. Aiven) default to ANSI mode, which changes how
// quotes and || behave. Use MySQL's standard mode so queries behave the same everywhere.
pool.on('connection', (conn) => {
  conn.query(
    "SET SESSION sql_mode = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'"
  );
});

export default pool;