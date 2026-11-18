import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Connection pool. Credentials come from environment variables only —
 * nothing is hardcoded, and the pool is created lazily so a missing
 * database never crashes the process at import time.
 */
export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'batloung_farm',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  dateStrings: true,
  decimalNumbers: true,
});

/**
 * Verifies connectivity without terminating the application.
 * Returns a status object the health endpoint can report.
 */
export const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return { connected: true, message: 'Database connection established.' };
  } catch (error) {
    return {
      connected: false,
      message: `Database unavailable: ${error.message}. The API is running but data requests will fail until the database is reachable.`,
    };
  }
};

/**
 * Runs a callback inside a single transaction.
 * Commits on success, rolls back on any thrown error, always releases.
 */
export const withTransaction = async (callback) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export default pool;
