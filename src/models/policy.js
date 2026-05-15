/* Policy Model */
import db from '../db.js';
import { v4 as uuidv4 } from 'uuid';

export const createPolicy = async (data) => {
  const { org_id, name, description, threshold, auto_approval_rate } = data;
  const id = uuidv4();

  const result = await db.query(
    `INSERT INTO policies 
     (id, org_id, name, description, threshold, auto_approval_rate, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING *`,
    [id, org_id, name, description, threshold, auto_approval_rate]
  );
  return result.rows[0];
};

export const getPolicyById = async (id, org_id) => {
  const result = await db.query(
    'SELECT * FROM policies WHERE id = $1 AND org_id = $2',
    [id, org_id]
  );
  return result.rows[0];
};

export const listPolicies = async (org_id, limit = 50) => {
  const result = await db.query(
    `SELECT * FROM policies WHERE org_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [org_id, limit]
  );
  return result.rows;
};

export const updatePolicy = async (id, org_id, updates) => {
  const allowed = ['name', 'description', 'threshold', 'auto_approval_rate'];
  const entries = Object.entries(updates).filter(([key, value]) => allowed.includes(key) && value !== undefined);

  if (entries.length === 0) {
    return getPolicyById(id, org_id);
  }

  const fields = entries.map(([key], i) => `${key}=$${i + 1}`).join(', ');
  const values = entries.map(([, value]) => value);

  const result = await db.query(
    `UPDATE policies SET ${fields}, updated_at=NOW() 
     WHERE id=$${values.length + 1} AND org_id=$${values.length + 2}
     RETURNING *`,
    [...values, id, org_id]
  );
  return result.rows[0];
};

export const deletePolicy = async (id, org_id) => {
  await db.query('DELETE FROM policies WHERE id = $1 AND org_id = $2', [id, org_id]);
};
