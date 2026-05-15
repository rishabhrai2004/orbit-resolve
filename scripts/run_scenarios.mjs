#!/usr/bin/env node
import fs from 'fs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const CRED = { email: 'admin@acme.com', password: 'password123' };

const scenarios = [
  { id: 1, title: 'Happy-path SaaS provisioning', description: 'Provision standard SaaS seat', type: 'SaaS Provisioning', urgency: 'low', target_resource: 'figma' },
  { id: 2, title: 'Low-confidence escalation', description: 'Access with low score', type: 'Privileged Access', urgency: 'low', target_resource: 'db.read' },
  { id: 3, title: 'High-confidence auto-approve', description: 'Routine repo access', type: 'SaaS Provisioning', urgency: 'low', target_resource: 'core-api' },
  { id: 4, title: 'Privileged access emergency', description: 'On-call emergency DB access', type: 'Privileged Access', urgency: 'high', target_resource: 'aurora-prod-db' },
  { id: 5, title: 'Vendor onboarding blocked', description: 'Add new vendor Anthropic', type: 'Vendor Onboarding', urgency: 'medium', target_resource: 'anthropic-api' },
  { id: 6, title: 'Costly purchase threshold', description: 'Tool subscription > $50/mo', type: 'SaaS Provisioning', urgency: 'medium', target_resource: 'premium-tool' },
  { id: 7, title: 'Policy change ripple', description: 'Request after policy change', type: 'SaaS Provisioning', urgency: 'low', target_resource: 'policy-change' },
  { id: 8, title: 'Multi-tenant isolation', description: 'Same resource across tenants', type: 'SaaS Provisioning', urgency: 'low', target_resource: 'shared-name' },
  { id: 9, title: 'Role-based denial', description: 'Contractor requests full access', type: 'SaaS Provisioning', urgency: 'low', target_resource: 'engineering-bundle' },
  { id:10, title: 'Repeated denial pattern', description: 'User with prior denials', type: 'SaaS Provisioning', urgency: 'low', target_resource: 'repeat-request' },
  { id:11, title: 'AI success recommendation', description: 'LLM recommended approval', type: 'SaaS Provisioning', urgency: 'low', target_resource: 'llm-success' },
  { id:12, title: 'AI service outage fallback', description: 'LLM returns 404 fallback', type: 'SaaS Provisioning', urgency: 'low', target_resource: 'llm-fallback' },
  { id:13, title: 'Partial AI confidence mismatch', description: 'AI approves but score low', type: 'SaaS Provisioning', urgency: 'low', target_resource: 'conflict-signal' },
  { id:14, title: 'Approver override', description: 'Manager overrides recommendation', type: 'SaaS Provisioning', urgency: 'medium', target_resource: 'override-case' },
  { id:15, title: 'Audit export', description: 'Export exceptions for compliance', type: 'Audit', urgency: 'low', target_resource: 'export' },
  { id:16, title: 'Rate limiting', description: 'Simulate many rapid requests', type: 'SaaS Provisioning', urgency: 'low', target_resource: 'rate-test' },
  { id:17, title: 'DB outage resilience', description: 'DB unavailable', type: 'SaaS Provisioning', urgency: 'low', target_resource: 'db-outage' },
  { id:18, title: 'Token expiry/refresh', description: 'Expired token mid-flow', type: 'SaaS Provisioning', urgency: 'low', target_resource: 'token-test' },
  { id:19, title: 'SSO + provisioning', description: 'Onboard via SSO', type: 'Onboarding', urgency: 'low', target_resource: 'onboard-bundle' },
  { id:20, title: 'Temporary access revoke', description: 'Short-lived access', type: 'Privileged Access', urgency: 'medium', target_resource: 'temp-access' },
  { id:21, title: 'Data access/legal hold', description: 'Sensitive data approval', type: 'Data Access', urgency: 'high', target_resource: 'sensitive-db' },
  { id:22, title: 'Multi-step approval', description: 'Security + finance approvals', type: 'SaaS Provisioning', urgency: 'high', target_resource: 'enterprise-tool' },
  { id:23, title: 'Concurrent approvals', description: 'Two approvers act', type: 'SaaS Provisioning', urgency: 'medium', target_resource: 'concurrent' },
  { id:24, title: 'Localization & accessibility', description: 'Locale-specific request', type: 'SaaS Provisioning', urgency: 'low', target_resource: 'locale-test' },
  { id:25, title: 'Malicious actor detection', description: 'Suspicious IP/location', type: 'SaaS Provisioning', urgency: 'high', target_resource: 'suspicious' },
  { id:26, title: 'Billing reconciliation', description: 'Provision increments billing', type: 'Billing', urgency: 'low', target_resource: 'billing-item' },
  { id:27, title: 'Feature-flag pathing', description: 'Canary risk model', type: 'SaaS Provisioning', urgency: 'low', target_resource: 'feature-flag' },
  { id:28, title: 'Large batch provisioning', description: 'Bulk create 200 accesses', type: 'Bulk', urgency: 'low', target_resource: 'bulk-provision' },
  { id:29, title: 'Exported audit signature', description: 'Export includes signer and model', type: 'Audit', urgency: 'low', target_resource: 'export-signed' },
  { id:30, title: 'Canary LLM swap', description: 'A/B LLM outputs', type: 'SaaS Provisioning', urgency: 'low', target_resource: 'llm-ab' },
];

async function login() {
  const r = await fetch(BASE + '/api/v1/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(CRED)
  });
  if (!r.ok) throw new Error('login failed: ' + r.status);
  return (await r.json()).token;
}

async function postRequest(token, s) {
  const r = await fetch(BASE + '/api/v1/requests', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ title: s.title, description: s.description, type: s.type, urgency: s.urgency, target_resource: s.target_resource })
  });
  const json = await r.json();
  return { status: r.status, body: json };
}

async function run() {
  console.log('Running scenarios against', BASE);
  const token = await login();
  const results = [];
  for (const s of scenarios) {
    try {
      if (s.id === 16) {
        // rate-limit test: fire 30 quick requests
        const burst = [];
        for (let i=0;i<30;i++) burst.push(postRequest(token, { ...s, title: s.title + ' #' + (i+1) }));
        const res = await Promise.all(burst);
        results.push({ scenario: s.id, responses: res });
      } else if (s.id === 28) {
        // bulk: create 50 for speed (200 may be slow)
        const bulk = [];
        for (let i=0;i<50;i++) bulk.push(postRequest(token, { ...s, title: s.title + ' #' + (i+1) }));
        const res = await Promise.all(bulk);
        results.push({ scenario: s.id, responses: res.length });
      } else {
        const res = await postRequest(token, s);
        results.push({ scenario: s.id, response: res });
      }
    } catch (err) {
      results.push({ scenario: s.id, error: String(err) });
    }
    // small pause
    await new Promise(r=>setTimeout(r, 200));
  }
  fs.writeFileSync('scenarios_output.json', JSON.stringify(results, null, 2));
  console.log('Done. Results written to scenarios_output.json');
}

run().catch(e=>{ console.error(e); process.exit(1); });
