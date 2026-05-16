import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.warn('⚠ DATABASE_URL not set - database operations will fail');
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgresql://localhost/orbit_resolve',
  min: parseInt(process.env.DB_POOL_MIN || '2'),
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased for remote connections
  ssl: (process.env.DATABASE_URL || process.env.POSTGRES_URL)?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

const query = (text, params) => pool.query(text, params);

const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export default {
  query,
  transaction,
  pool,
  end: () => pool.end(),
};
