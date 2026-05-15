/* Constants & Enums */

export const ROLES = {
  EMPLOYEE: 'employee',
  MANAGER: 'manager',
  ADMIN: 'admin',
  EXEC: 'exec',
};

export const REQUEST_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DENIED: 'denied',
  PROVISIONING: 'provisioning',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export const REQUEST_TYPES = {
  SAAS_PROVISIONING: 'SaaS Provisioning',
  HARDWARE_REFRESH: 'Hardware Refresh',
  CLOUD_QUOTA: 'Cloud Quota Adjustment',
  PRIVILEGED_ACCESS: 'Privileged Access',
  CONTRACTOR_ACCESS: 'Contractor Access',
  EXPENSE_REIMBURSEMENT: 'Expense Reimbursement',
  VENDOR_ONBOARDING: 'Vendor Onboarding',
};

export const URGENCY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
};

export const SUBSCRIPTION_TIERS = {
  STARTER: 'starter',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
};

export const SUBSCRIPTION_STATUSES = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
};

export const EXCEPTION_REASONS = {
  POLICY_VIOLATION: 'Policy violation',
  OUT_OF_BAND: 'Out of band request',
  CONFLICTING_ROLES: 'Conflicting roles',
  MISSING_APPROVAL: 'Missing required approval',
  COMPLIANCE_FLAG: 'Compliance flag',
};

export const AUDIT_ACTIONS = {
  USER_CREATED: 'USER_CREATED',
  USER_INVITED: 'USER_INVITED',
  ROLE_UPDATED: 'ROLE_UPDATED',
  REQUEST_CREATED: 'REQUEST_CREATED',
  REQUEST_APPROVED: 'REQUEST_APPROVED',
  REQUEST_DENIED: 'REQUEST_DENIED',
  EXCEPTION_CREATED: 'EXCEPTION_CREATED',
  EXCEPTION_RESOLVED: 'EXCEPTION_RESOLVED',
  POLICY_CREATED: 'POLICY_CREATED',
  POLICY_UPDATED: 'POLICY_UPDATED',
  POLICY_DELETED: 'POLICY_DELETED',
  SUBSCRIPTION_ACTIVATED: 'SUBSCRIPTION_ACTIVATED',
  SUBSCRIPTION_CANCELLED: 'SUBSCRIPTION_CANCELLED',
};
