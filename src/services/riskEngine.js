/* Risk Scoring & Decision Engine Service */
import db from '../db.js';

const DEFAULT_POLICIES = {
  'SaaS Provisioning': {
    code: 'IT-SW-04',
    name: 'SaaS Provisioning',
    threshold: '$50/month, eligible role',
    auto_approval_rate: 80,
    baseConfidence: 78,
    execution: 'SCIM / IdP provisioning queued',
  },
  'Source Control Access': {
    code: 'IT-SC-02',
    name: 'Source Control Access',
    threshold: 'Internal repositories only',
    auto_approval_rate: 82,
    baseConfidence: 84,
    execution: 'Git provider team membership queued',
  },
  'Account Recovery': {
    code: 'IT-ID-01',
    name: 'Identity Credential Reset',
    threshold: 'Verified active SSO session',
    auto_approval_rate: 75,
    baseConfidence: 91,
    execution: 'Identity provider reset queued',
  },
  'Hardware Refresh': {
    code: 'OPS-HW-03',
    name: 'Hardware Refresh',
    threshold: '36-month replacement cycle',
    auto_approval_rate: 78,
    baseConfidence: 72,
    execution: 'Procurement workflow queued',
  },
  'Expense Reimbursement': {
    code: 'FIN-EXP-01',
    name: 'Expense Reimbursement T1',
    threshold: '$200 within department policy',
    auto_approval_rate: 72,
    baseConfidence: 86,
    execution: 'Expense reimbursement queued',
  },
  'Cloud Quota Adjustment': {
    code: 'CLOUD-LIM-02',
    name: 'Cloud Quota Adjustment',
    threshold: '30% over 90-day burn rate',
    auto_approval_rate: 80,
    baseConfidence: 70,
    execution: 'Cloud quota request queued',
  },
  'Vendor Onboarding': {
    code: 'VND-02',
    name: 'Vendor Security Review',
    threshold: 'InfoSec sign-off required',
    auto_approval_rate: 88,
    baseConfidence: 46,
    execution: 'Security review task created',
  },
  'Privileged Access': {
    code: 'PAM-01',
    name: 'Privileged Access Management',
    threshold: 'On-call membership and short expiry',
    auto_approval_rate: 90,
    baseConfidence: 44,
    execution: 'Temporary privileged access request staged',
  },
  'Data Access': {
    code: 'DATA-07',
    name: 'Sensitive Data Access',
    threshold: 'Legal / InfoSec approval required',
    auto_approval_rate: 92,
    baseConfidence: 38,
    execution: 'Data governance review created',
  },
};

const ROLE_CONFIDENCE = {
  employee: 0,
  manager: 5,
  admin: 6,
  exec: 4,
};

const RESOURCE_COSTS = {
  figma: 15,
  slack: 8,
  notion: 12,
  linear: 10,
  github: 0,
  repo: 0,
  datadog: 15,
  sentry: 26,
  jira: 8,
  zoom: 16,
  anthropic: 250,
  openai: 250,
  aws: 0,
};

const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(n)));

const norm = (value) => String(value || '').toLowerCase();

const hasAny = (text, terms) => terms.some((term) => text.includes(term));

const parseMoneyThreshold = (threshold) => {
  const match = String(threshold || '').match(/\$?\s*(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
};

export const classifyRequest = (request = {}) => {
  const text = norm(`${request.title} ${request.description} ${request.type} ${request.target_resource}`);

  if (/\bprod\b/.test(text) || hasAny(text, ['production', 'privileged', 'admin console', 'root', 'database access', 'db access', 'aurora'])) {
    return 'Privileged Access';
  }
  if (hasAny(text, ['legal hold', 'sensitive data', 'customer data', 'pii', 'gdpr', 'hipaa'])) {
    return 'Data Access';
  }
  if (hasAny(text, ['vendor', 'dpa', 'security review', 'anthropic api', 'openai api'])) {
    return 'Vendor Onboarding';
  }
  if (hasAny(text, ['quota', 'limit bump', 'rate limit', 'aws limit', 'gcp limit'])) {
    return 'Cloud Quota Adjustment';
  }
  if (hasAny(text, ['laptop', 'hardware', 'device', 'monitor', 'refresh'])) {
    return 'Hardware Refresh';
  }
  if (hasAny(text, ['expense', 'reimburse', 'receipt', 'travel'])) {
    return 'Expense Reimbursement';
  }
  if (hasAny(text, ['mfa', 'okta', 'authenticator', 'password reset', 'credential reset'])) {
    return 'Account Recovery';
  }
  if (hasAny(text, ['github', 'repo', 'repository', 'source control', 'gitlab'])) {
    return 'Source Control Access';
  }
  return 'SaaS Provisioning';
};

export const estimateResourceCost = (resource = '') => {
  const text = norm(resource);
  for (const [key, cost] of Object.entries(RESOURCE_COSTS)) {
    if (text.includes(key)) return cost;
  }
  return 35;
};

const getRequestHistory = async (request, dbClient = db) => {
  const result = await dbClient.query(
    `SELECT
       COUNT(*)::int as total,
       COUNT(*) FILTER (WHERE status = 'approved')::int as approved,
       COUNT(*) FILTER (WHERE status = 'denied')::int as denied
     FROM requests
     WHERE user_id = $1`,
    [request.user_id]
  );

  const row = result.rows[0] || {};
  return {
    total: Number(row.total || row.count || 0),
    approved: Number(row.approved || 0),
    denied: Number(row.denied || 0),
  };
};

const findPolicy = async (orgId, type, dbClient = db) => {
  const result = await dbClient.query(
    `SELECT *
     FROM policies
     WHERE org_id = $1
       AND (LOWER(name) = LOWER($2) OR LOWER(name) LIKE LOWER($3) OR LOWER($2) LIKE '%' || LOWER(name) || '%')
     ORDER BY auto_approval_rate DESC NULLS LAST
     LIMIT 1`,
    [orgId, type, `%${type.split(' ')[0]}%`]
  );

  return result.rows[0] || null;
};

export const buildRecommendation = (decision) => {
  if (decision.status === 'approved') {
    return {
      action: 'Auto-approve and execute',
      reasoning: decision.reasons.join('; '),
      next_steps: ['Provision requested resource', 'Write audit event', 'Notify requester'],
    };
  }

  return {
    action: decision.blockers.some((b) => b.severity === 'critical') ? 'Escalate before approval' : 'Manager review',
    reasoning: [...decision.blockers.map((b) => b.message), ...decision.reasons.slice(0, 2)].join('; '),
    next_steps: [
      'Validate business justification',
      'Apply least-privilege scope and expiry',
      'Record approver rationale before execution',
    ],
  };
};

export const evaluateRequest = async (request, dbClient = db) => {
  const type = classifyRequest(request);
  const catalogPolicy = DEFAULT_POLICIES[type] || DEFAULT_POLICIES['SaaS Provisioning'];
  const storedPolicy = request.org_id ? await findPolicy(request.org_id, type, dbClient) : null;
  const policy = {
    ...catalogPolicy,
    ...(storedPolicy || {}),
    code: catalogPolicy.code,
    name: storedPolicy?.name || catalogPolicy.name,
    threshold: storedPolicy?.threshold || catalogPolicy.threshold,
    historical_auto_approval_rate: storedPolicy?.auto_approval_rate ?? null,
    auto_approval_rate: catalogPolicy.auto_approval_rate,
  };

  const text = norm(`${request.title} ${request.description} ${request.target_resource}`);
  const history = await getRequestHistory(request, dbClient);
  const blockers = [];
  const reasons = [];
  let confidence = policy.baseConfidence;

  if (history.total >= 10) {
    const rate = history.approved / Math.max(history.total, 1);
    confidence += rate >= 0.85 ? 10 : rate >= 0.65 ? 5 : -8;
    reasons.push(`${history.approved}/${history.total} prior requests approved for this requester`);
  } else {
    confidence -= 4;
    reasons.push('Limited requester history, using policy and resource signals');
  }

  confidence += ROLE_CONFIDENCE[request.requestor_role] || 0;

  if (request.urgency === 'high') confidence -= type === 'Privileged Access' ? 8 : 3;
  if (request.urgency === 'low') confidence += 4;

  if (['SaaS Provisioning', 'Source Control Access', 'Account Recovery', 'Expense Reimbursement'].includes(type)) {
    reasons.push(`${policy.code} is eligible for autonomous execution when thresholds pass`);
  }

  if (type === 'SaaS Provisioning') {
    const cost = estimateResourceCost(request.target_resource || request.title);
    const limit = parseMoneyThreshold(policy.threshold) || 50;
    if (cost > limit) {
      confidence -= 30;
      blockers.push({
        severity: 'high',
        code: 'COST_THRESHOLD',
        message: `Estimated recurring cost $${cost}/mo exceeds policy threshold $${limit}/mo`,
      });
    } else {
      confidence += 6;
      reasons.push(`Estimated recurring cost $${cost}/mo is within the $${limit}/mo threshold`);
    }
  }

  if (type === 'Source Control Access' && hasAny(text, ['core-api', 'internal', 'migration'])) {
    confidence += 8;
    reasons.push('Repository appears internal and tied to an active engineering project');
  }

  if (type === 'Account Recovery') {
    confidence += 5;
    reasons.push('Credential reset rotates identity factors without granting new privileges');
  }

  if (type === 'Privileged Access') {
    const hasIncident = hasAny(text, ['inc-', 'incident', 'p1', 'sev1', 'on-call', 'oncall']);
    const hasScope = hasAny(text, ['read-only', '2 hour', '2-hour', '4 hour', 'temporary', 'expires']);
    if (!hasIncident) {
      blockers.push({
        severity: 'critical',
        code: 'NO_INCIDENT_CONTEXT',
        message: 'Privileged production access lacks confirmed incident or on-call context',
      });
      confidence -= 26;
    }
    if (!hasScope) {
      blockers.push({
        severity: 'high',
        code: 'NO_EXPIRY_SCOPE',
        message: 'Privileged request does not specify temporary scope or expiry',
      });
      confidence -= 14;
    }
    if (hasIncident && hasScope) {
      confidence += 12;
      reasons.push('Incident context and temporary scope were detected');
    }
  }

  if (type === 'Vendor Onboarding') {
    blockers.push({
      severity: 'high',
      code: 'SECURITY_REVIEW_REQUIRED',
      message: 'New data-processing vendors require InfoSec review and DPA before production keys',
    });
    confidence -= 18;
  }

  if (type === 'Data Access') {
    blockers.push({
      severity: 'critical',
      code: 'DATA_GOVERNANCE_REQUIRED',
      message: 'Sensitive data access requires legal or InfoSec approval',
    });
    confidence -= 22;
  }

  if (hasAny(text, ['new hire', 'day 1', 'day 2', 'day 3', 'full engineering bundle'])) {
    blockers.push({
      severity: 'medium',
      code: 'NEW_HIRE_CONFIRMATION',
      message: 'New-hire access bundles require manager confirmation',
    });
    confidence -= 16;
  }

  confidence = clamp(confidence);
  const threshold = policy.auto_approval_rate || 80;
  const status = confidence >= threshold && blockers.length === 0 ? 'approved' : 'pending';
  const decision = {
    type,
    status,
    confidence,
    threshold,
    policy,
    blockers,
    reasons,
    execution: {
      action: policy.execution,
      simulated: true,
      latency_ms: status === 'approved' ? 4200 : null,
    },
    history,
    routed_to: status === 'pending' ? 'manager' : null,
  };

  decision.recommendation = buildRecommendation(decision);
  return decision;
};

export const calculateConfidenceScore = evaluateRequest;

export const shouldAutoApprove = (decisionOrRequest, policy) => {
  const threshold = Number(policy?.auto_approval_rate || decisionOrRequest.threshold || 80);
  return Number(decisionOrRequest.confidence || 0) >= threshold && !(decisionOrRequest.blockers || []).length;
};
