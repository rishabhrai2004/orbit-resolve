/* Deterministic integration adapter layer.
   These adapters deliberately simulate provider calls in local/dev mode while preserving
   the shape a real connector would return. */
import db from '../db.js';

const providerEvent = (provider, action, target, extra = {}) => ({
  provider,
  action,
  target,
  status: 'queued',
  simulated: true,
  external_ref: `${provider.toUpperCase()}-${Buffer.from(`${action}:${target}`).toString('hex').slice(0, 12)}`,
  timestamp: new Date().toISOString(),
  ...extra,
});

export const grantGitHubAccess = async (user, repo) => (
  providerEvent('github', 'grant_repo_access', repo, {
    subject: user.email,
    permission: 'write',
  })
);

export const resetOktaMFA = async (user) => (
  providerEvent('okta', 'reset_mfa_factor', user.email, {
    expires_in_minutes: 15,
  })
);

export const grantAWSAccess = async (user, resource, duration = 2, accessLevel = 'read-only') => (
  providerEvent('aws', 'stage_temporary_access', resource, {
    subject: user.email,
    duration_hours: duration,
    access_level: accessLevel,
  })
);

export const provisionSaaSSeat = async (user, app) => (
  providerEvent('idp', 'assign_saas_app', app, {
    subject: user.email,
  })
);

export const createReviewTask = async (request, reason) => (
  providerEvent('workflow', 'create_review_task', request.id, {
    reason,
    owner_queue: 'operations-review',
  })
);

export const executeProvisioning = async (request, user = { email: 'user@org.com' }) => {
  const type = request.decision_type || request.type;
  let result;

  if (type === 'Source Control Access') {
    result = await grantGitHubAccess(user, request.target_resource || request.title);
  } else if (type === 'Account Recovery') {
    result = await resetOktaMFA(user);
  } else if (type === 'Privileged Access') {
    result = await grantAWSAccess(user, request.target_resource || request.title);
  } else if (type === 'Vendor Onboarding' || type === 'Data Access') {
    result = await createReviewTask(request, type);
  } else {
    result = await provisionSaaSSeat(user, request.target_resource || request.title);
  }

  await db.query(
    'UPDATE requests SET updated_at = NOW() WHERE id = $1',
    [request.id]
  );

  return { success: true, result };
};
