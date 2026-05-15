/* Risk Scoring & Decision Engine Service */
import db from '../db.js';

export const calculateConfidenceScore = async (request) => {
  // Score 0-100 indicating confidence in auto-approval
  let score = 50;

  // User history factor (-20 to +20)
  const userHistory = await db.query(
    `SELECT COUNT(*) as count FROM requests 
     WHERE user_id = $1 AND status IN ('approved', 'denied')`,
    [request.user_id]
  );
  const totalRequests = parseInt(userHistory.rows[0].count);
  if (totalRequests > 50) score += 15;
  else if (totalRequests > 20) score += 10;
  else if (totalRequests > 5) score += 5;

  // Approval rate (0 to +15)
  const approvalRate = await db.query(
    `SELECT COUNT(CASE WHEN status = 'approved' THEN 1 END)::float / COUNT(*) * 100 as rate 
     FROM requests WHERE user_id = $1`,
    [request.user_id]
  );
  const rate = parseFloat(approvalRate.rows[0].rate || 0);
  if (rate > 90) score += 15;
  else if (rate > 75) score += 10;

  // Request type adjustment (-15 to +15)
  const typeScores = {
    'SaaS Provisioning': 15,
    'Hardware Refresh': 10,
    'Expense Reimbursement': 12,
    'Contractor Access': 5,
    'Privileged Access': -15,
    'Production DB Access': -20,
  };
  score += typeScores[request.type] || 0;

  // Urgency adjustment (-10 to +10)
  if (request.urgency === 'high') score += 10;
  if (request.urgency === 'low') score -= 5;

  // Role-based adjustment (-5 to +10)
  const roleScores = {
    'employee': 0,
    'manager': 5,
    'admin': 10,
    'exec': 5,
  };
  score += roleScores[request.requestor_role] || 0;

  return Math.max(0, Math.min(100, score));
};

export const checkPolicyViolation = async (request, policy) => {
  // Compare request against policy thresholds
  if (policy.threshold) {
    // Parse threshold and request data
    if (policy.name === 'SaaS Provisioning' && request.target_resource) {
      // Check cost threshold
      const cost = await estimateResourceCost(request.target_resource);
      if (cost > parseFloat(policy.threshold)) {
        return {
          violated: true,
          reason: `Cost ${cost} exceeds threshold ${policy.threshold}`,
        };
      }
    }
  }

  return { violated: false };
};

export const estimateResourceCost = async (resource) => {
  // In production, integrate with actual resource APIs
  const costEstimates = {
    'figma': 12,
    'datadog': 15,
    'stripe': 0,
    'github': 0,
    'slack': 8,
  };

  for (const [key, cost] of Object.entries(costEstimates)) {
    if (resource.toLowerCase().includes(key)) {
      return cost;
    }
  }
  return 50;
};

export const shouldAutoApprove = (request, policy) => {
  if (!policy) return false;
  return request.confidence >= policy.auto_approval_rate;
};
