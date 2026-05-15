/* Audit Log Model */
import db from '../db.js';
import { v4 as uuidv4 } from 'uuid';

export const logAction = async (org_id, user_id, action, entity_type, entity_id, details = null, ip_address = null) => {
  const id = uuidv4();
  await db.query(
    `INSERT INTO audit_logs 
     (id, org_id, user_id, action, entity_type, entity_id, details, ip_address, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
    [id, org_id, user_id, action, entity_type, entity_id, JSON.stringify(details), ip_address]
  );
  return id;
};

export const listAuditLogs = async (org_id, filters = {}, limit = 100, offset = 0) => {
  let query = 'SELECT * FROM audit_logs WHERE org_id = $1';
  const params = [org_id];
  let paramCount = 1;

  if (filters.action) {
    paramCount++;
    query += ` AND action = $${paramCount}`;
    params.push(filters.action);
  }

  if (filters.entity_type) {
    paramCount++;
    query += ` AND entity_type = $${paramCount}`;
    params.push(filters.entity_type);
  }

  if (filters.user_id) {
    paramCount++;
    query += ` AND user_id = $${paramCount}`;
    params.push(filters.user_id);
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
  params.push(limit, offset);

  const result = await db.query(query, params);
  return result.rows;
};
