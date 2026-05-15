/* Organization Model */
import db from '../db.js';
import { v4 as uuidv4 } from 'uuid';

export const createOrganization = async (name, owner_id) => {
  const id = uuidv4();
  const result = await db.query(
    `INSERT INTO organizations (id, name, owner_id, created_at)
     VALUES ($1, $2, $3, NOW())
     RETURNING id, name, owner_id, created_at`,
    [id, name, owner_id]
  );
  return result.rows[0];
};

export const getOrgById = async (id) => {
  const result = await db.query(
    'SELECT id, name, owner_id, subscription_status, subscription_tier, created_at FROM organizations WHERE id = $1',
    [id]
  );
  return result.rows[0];
};

export const updateOrgSubscription = async (org_id, status, tier) => {
  const result = await db.query(
    `UPDATE organizations SET subscription_status = $1, subscription_tier = $2 WHERE id = $3 RETURNING *`,
    [status, tier, org_id]
  );
  return result.rows[0];
};

export const getOrgStats = async (org_id) => {
  const result = await db.query(
    `SELECT 
       (SELECT COUNT(*) FROM users WHERE org_id = $1) as user_count,
       (SELECT COUNT(*) FROM requests WHERE org_id = $1) as request_count,
       (SELECT COUNT(*) FROM requests WHERE org_id = $1 AND status = 'approved') as approved_count,
       (SELECT COUNT(*) FROM requests WHERE org_id = $1 AND status = 'pending') as pending_count,
       (SELECT COUNT(*) FROM requests WHERE org_id = $1 AND status = 'denied') as denied_count,
       (SELECT COALESCE(ROUND(AVG(confidence)), 0) FROM requests WHERE org_id = $1) as avg_confidence,
       (SELECT COUNT(*) FROM exceptions WHERE org_id = $1 AND status = 'pending') as pending_exceptions`,
    [org_id]
  );
  const row = result.rows[0];
  const requestCount = Number(row.request_count || 0);
  const approvedCount = Number(row.approved_count || 0);
  return {
    ...row,
    autonomous_rate: requestCount ? Math.round((approvedCount / requestCount) * 1000) / 10 : 0,
    manager_hours_eliminated: Math.round(approvedCount * 3.5),
  };
};
