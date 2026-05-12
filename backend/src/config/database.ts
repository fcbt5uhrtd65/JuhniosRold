import { Pool, PoolClient, PoolConfig } from 'pg';
import { env } from './env';

// ============================================================
// PostgreSQL Connection Pool — Juhnios Rold Backend
// ============================================================

const poolConfig: PoolConfig = env.DB.URL
  ? {
      connectionString: env.DB.URL,
      ssl: env.DB.SSL ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }
  : {
      host: env.DB.HOST,
      port: env.DB.PORT,
      user: env.DB.USER,
      password: env.DB.PASSWORD,
      database: env.DB.NAME,
      ssl: env.DB.SSL ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

export const pool = new Pool(poolConfig);

// Test database connection
pool.on('connect', () => {
  if (env.NODE_ENV === 'development') {
    console.log('[DB] New client connected to PostgreSQL');
  }
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err);
  process.exit(-1);
});

export const testConnection = async (): Promise<void> => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT NOW() as now, current_database() as db');
    console.log(`[DB] Connected to PostgreSQL — Database: ${result.rows[0].db} — Time: ${result.rows[0].now}`);
  } finally {
    client.release();
  }
};

// Helper: run a query with auto-release
export const query = async <T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number | null }> => {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  if (env.NODE_ENV === 'development') {
    console.log(`[DB] Query executed in ${duration}ms — rows: ${result.rowCount}`);
  }

  return { rows: result.rows as T[], rowCount: result.rowCount };
};

// Helper: run queries inside a transaction
export const withTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
