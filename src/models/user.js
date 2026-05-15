/* User Model */
import db from '../db.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export const createUser = async (email, password, name, role, org_id) => {
  const id = uuidv4();
  const hashedPassword = await bcrypt.hash(password, 12);

  const result = await db.query(
    `INSERT INTO users (id, email, password_hash, name, role, org_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING id, email, name, role, org_id, created_at`,
    [id, email, hashedPassword, name, role, org_id]
  );
  return result.rows[0];
};

export const getUserByEmail = async (email) => {
  const result = await db.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0];
};

export const getUserById = async (id) => {
  const result = await db.query(
    'SELECT id, email, name, role, org_id, created_at, updated_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0];
};

export const verifyPassword = async (plain, hashed) => {
  return bcrypt.compare(plain, hashed);
};

export const updateUser = async (id, updates) => {
  const fields = Object.keys(updates).map((key, i) => `${key}=$${i + 1}`).join(', ');
  const values = Object.values(updates);

  const result = await db.query(
    `UPDATE users SET ${fields}, updated_at=NOW() WHERE id=$${values.length + 1} RETURNING *`,
    [...values, id]
  );
  return result.rows[0];
};

export const listOrgUsers = async (org_id, limit = 50, offset = 0) => {
  const result = await db.query(
    `SELECT id, email, name, role, created_at FROM users 
     WHERE org_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [org_id, limit, offset]
  );
  return result.rows;
};
