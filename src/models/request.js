/* Request/Exception Model */
import db from '../db.js';
import { v4 as uuidv4 } from 'uuid';

export const createRequest = async (data) => {
  const {
    org_id, user_id, title, description, type,
    requestor_role, target_resource, urgency, policy_id
  } = data;

  const id = uuidv4();
  const result = await db.query(
    `INSERT INTO requests 
     (id, org_id, user_id, title, description, type, requestor_role, 
      target_resource, urgency, policy_id, status, confidence, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', 0, NOW())
     RETURNING *`,
    [id, org_id, user_id, title, description, type, requestor_role, 
     target_resource, urgency, policy_id]
  );
  return result.rows[0];
};

export const applyDecision = async (id, org_id, decision) => {
  const status = decision.status || 'pending';
  const approvedAt = status === 'approved' ? 'NOW()' : 'NULL';
  const notes = decision.recommendation
    ? `${decision.recommendation.action}: ${decision.recommendation.reasoning}`
    : null;

  const result = await db.query(
    `UPDATE requests
     SET status = $1,
         confidence = $2,
         policy_id = COALESCE($3, policy_id),
         approval_notes = $4,
         approved_at = ${approvedAt},
         updated_at = NOW()
     WHERE id = $5 AND org_id = $6
     RETURNING *`,
    [status, decision.confidence || 0, decision.policy?.id || null, notes, id, org_id]
  );
  return result.rows[0];
};

export const getRequestById = async (id, org_id) => {
  const result = await db.query(
    `SELECT * FROM requests WHERE id = $1 AND org_id = $2`,
    [id, org_id]
  );
  return result.rows[0];
};

export const listRequests = async (org_id, filters = {}, limit = 50, offset = 0) => {
  let query = 'SELECT * FROM requests WHERE org_id = $1';
  const params = [org_id];
  let paramCount = 1;

  if (filters.status) {
    paramCount++;
    query += ` AND status = $${paramCount}`;
    params.push(filters.status);
  }

  if (filters.urgency) {
    paramCount++;
    query += ` AND urgency = $${paramCount}`;
    params.push(filters.urgency);
  }

  if (filters.type) {
    paramCount++;
    query += ` AND type = $${paramCount}`;
    params.push(filters.type);
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
  params.push(limit, offset);

  const result = await db.query(query, params);
  return result.rows;
};

export const updateRequestStatus = async (id, org_id, status, approver_id = null, notes = null) => {
  const approvedAt = status === 'approved' ? 'NOW()' : 'NULL';
  const result = await db.query(
    `UPDATE requests 
     SET status = $1, approver_id = $2, approval_notes = $3, approved_at = ${approvedAt}, updated_at = NOW()
     WHERE id = $4 AND org_id = $5
     RETURNING *`,
    [status, approver_id, notes, id, org_id]
  );
  return result.rows[0];
};

export const calculateRiskScore = async (request, dbClient = db) => {
  const history = await dbClient.query(
    `SELECT
       COUNT(*)::int as total,
       COUNT(*) FILTER (WHERE status = 'approved')::int as approved,
       COUNT(*) FILTER (WHERE status = 'denied')::int as denied
     FROM requests
     WHERE user_id = $1`,
    [request.user_id]
  );

  const row = history.rows[0] || {};
  const total = Number(row.total || row.count || 0);
  const approved = Number(row.approved || 0);
  const denied = Number(row.denied || 0);
  let score = 58;

  if (total > 0) {
    const approvalRate = approved / total;
    if (approvalRate >= 0.9) score += 14;
    else if (approvalRate >= 0.7) score += 8;
    else if (denied > approved) score -= 14;
  } else {
    score -= 6;
  }

  if (total > 10) score += 6;
  if (total > 50) score += 6;

  if (request.urgency === 'high') score -= 6;
  if (request.urgency === 'low') score += 4;

  const typeScores = {
    'Account Recovery': 22,
    'SaaS Provisioning': 18,
    'Source Control Access': 16,
    'Expense Reimbursement': 16,
    'Hardware Refresh': 8,
    'Cloud Quota Adjustment': 2,
    'Vendor Onboarding': -18,
    'Privileged Access': -24,
    'Data Access': -28,
  };
  score += typeScores[request.type] || 0;

  const text = `${request.title || ''} ${request.description || ''} ${request.target_resource || ''}`.toLowerCase();
  if (/\bprod\b|production|root|admin|sensitive|pii|legal hold/.test(text)) score -= 18;
  if (/mfa|okta|github|figma|repo|receipt/.test(text)) score += 8;

  return Math.max(0, Math.min(100, Math.round(score)));
};

export const setRequestConfidence = async (id, org_id, confidence) => {
  const result = await db.query(
    `UPDATE requests SET confidence = $1, updated_at = NOW() WHERE id = $2 AND org_id = $3 RETURNING *`,
    [confidence, id, org_id]
  );
  return result.rows[0];
};

export const createException = async (data) => {
  const {
    org_id, request_id, reason, policy_conflict, 
    recommendation, user_id
  } = data;

  const id = uuidv4();
  const result = await db.query(
    `INSERT INTO exceptions 
     (id, org_id, request_id, reason, policy_conflict, recommendation, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
     RETURNING *`,
    [id, org_id, request_id, JSON.stringify(reason), 
     JSON.stringify(policy_conflict), JSON.stringify(recommendation)]
  );
  return result.rows[0];
};

export const listExceptions = async (org_id, limit = 50, offset = 0) => {
  const result = await db.query(
    `SELECT e.*, r.title, r.type, r.urgency, u.name as requestor_name
     FROM exceptions e
     JOIN requests r ON e.request_id = r.id
     JOIN users u ON r.user_id = u.id
     WHERE e.org_id = $1 AND e.status = 'pending'
     ORDER BY e.created_at DESC LIMIT $2 OFFSET $3`,
    [org_id, limit, offset]
  );
  return result.rows;
};
