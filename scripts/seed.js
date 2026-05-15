/* Seed Database with Demo Data */
import db from '../src/db.js';
import * as userModel from '../src/models/user.js';
import * as orgModel from '../src/models/organization.js';
import * as policyModel from '../src/models/policy.js';
import * as requestModel from '../src/models/request.js';
import { logAction } from '../src/models/auditLog.js';
import path from 'path';
import { fileURLToPath } from 'url';

export const seed = async () => {
  try {
    console.log('Seeding database...');

    await db.query(`
      TRUNCATE TABLE audit_logs, exceptions, requests, policies, users, organizations
      RESTART IDENTITY CASCADE;
    `);

    // Create demo org
    const org = await orgModel.createOrganization('Acme Corp', null);
    console.log('✓ Created organization:', org.name);

    const admin = await userModel.createUser('admin@acme.com', 'password123', 'Avery Patel', 'admin', org.id);

    const managers = [];
    for (const person of [
      ['maya@acme.com', 'Maya Rodriguez'],
      ['victor@acme.com', 'Victor Stone'],
      ['lena@acme.com', 'Lena Hoffmann'],
    ]) {
      managers.push(await userModel.createUser(person[0], 'password123', person[1], 'manager', org.id));
    }

    const employees = [];
    for (const person of [
      ['jordan@acme.com', 'Jordan Davis'],
      ['priya@acme.com', 'Priya Sharma'],
      ['sarah@acme.com', 'Sarah Chen'],
      ['omar@acme.com', 'Omar Patel'],
      ['nina@acme.com', 'Nina Brooks'],
      ['leo@acme.com', 'Leo Martinez'],
      ['emma@acme.com', 'Emma Wilson'],
      ['david@acme.com', 'David Kim'],
    ]) {
      employees.push(await userModel.createUser(person[0], 'password123', person[1], 'employee', org.id));
    }

    console.log('✓ Created Acme roster: 8 employees, 3 managers, 1 admin');

    // Create demo policies
    const policies = [
      {
        name: 'SaaS Provisioning',
        description: 'Standard tools < $50/mo for eligible roles',
        threshold: '< $50/mo',
        auto_approval_rate: 94,
      },
      {
        name: 'Cloud Quota Adjustment',
        description: 'AWS/GCP limit bumps vs. 90-day burn rate',
        threshold: '<= 30% bump',
        auto_approval_rate: 88,
      },
      {
        name: 'Hardware Refresh',
        description: 'Device upgrades based on tenure + device age',
        threshold: '36-mo cycle',
        auto_approval_rate: 97,
      },
      {
        name: 'Privileged Access (OnCall)',
        description: 'Temp DB/server access tied to PagerDuty schedule',
        threshold: 'On-call only',
        auto_approval_rate: 45,
      },
    ];

    for (const policy of policies) {
      await policyModel.createPolicy({
        org_id: org.id,
        ...policy,
      });
    }

    console.log('✓ Created demo policies');

    const demoRequests = [
      {
        user: employees[0],
        title: 'GitHub repo access',
        description: 'Grant access to core-api repo for platform migration',
        type: 'Source Control Access',
        role: 'employee',
        urgency: 'low',
        confidence: 92,
        status: 'approved',
      },
      {
        user: employees[1],
        title: 'Figma seat for onboarding',
        description: 'Provision Figma seat for product discovery sprint',
        type: 'SaaS Provisioning',
        role: 'employee',
        urgency: 'low',
        confidence: 88,
        status: 'approved',
      },
      {
        user: employees[2],
        title: 'AWS Production Console Access',
        description: 'AWS production database access for incident debugging',
        type: 'Privileged Access',
        role: 'employee',
        urgency: 'high',
        confidence: 24,
        status: 'pending',
        exception: {
          policy: 'PAM-01 · Privileged Access Management',
          rule: 'On-call membership and short expiry required',
          issue: 'Requester is not on the active PagerDuty rotation and no expiry was supplied',
        },
      },
      {
        user: employees[7],
        title: 'New Vendor: Anthropic API',
        description: 'Create production API keys for Anthropic vendor integration',
        type: 'Vendor Onboarding',
        role: 'employee',
        urgency: 'medium',
        confidence: 42,
        status: 'pending',
        exception: {
          policy: 'VND-02 · Vendor Security Review',
          rule: 'InfoSec sign-off and DPA required before production keys',
          issue: 'Security review has not been started for this vendor',
        },
      },
      {
        user: managers[0],
        title: 'Okta MFA reset',
        description: 'Reset Okta MFA token - lost authenticator device',
        type: 'Account Recovery',
        role: 'manager',
        urgency: 'medium',
        confidence: 96,
        status: 'approved',
      },
      {
        user: employees[4],
        title: 'Travel expense reimbursement',
        description: 'Reimburse $84 customer onsite taxi receipt',
        type: 'Expense Reimbursement',
        role: 'employee',
        urgency: 'low',
        confidence: 91,
        status: 'approved',
      },
    ];

    for (const [index, item] of demoRequests.entries()) {
      const result = await db.query(
        `INSERT INTO requests
         (id, org_id, user_id, title, description, type, requestor_role, urgency, status, confidence, created_at, updated_at, approved_at)
         VALUES
         (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8::varchar, $9, NOW() - ($10 || ' hours')::interval, NOW(), CASE WHEN $8::text = 'approved' THEN NOW() ELSE NULL END)
         RETURNING *`,
        [org.id, item.user.id, item.title, item.description, item.type, item.role, item.urgency, item.status, item.confidence, (index + 1) * 4]
      );

      const request = result.rows[0];
      if (item.exception) {
        await requestModel.createException({
          org_id: org.id,
          request_id: request.id,
          reason: {
            summary: 'Seeded demo exception',
            blockers: [{ severity: 'high', code: 'DEMO_REVIEW', message: item.exception.issue }],
          },
          policy_conflict: {
            policy: item.exception.policy,
            rule: item.exception.rule,
            actual: item.exception.issue,
          },
          recommendation: {
            action: 'Manager review',
            reasoning: item.exception.issue,
            next_steps: ['Validate business justification', 'Constrain scope', 'Record approval rationale'],
          },
          user_id: item.user.id,
        });
      }

      await logAction(org.id, item.user.id, item.status === 'approved' ? 'REQUEST_AUTO_APPROVED' : 'REQUEST_REVIEW_REQUIRED', 'request', request.id, {
        seeded: true,
        confidence: item.confidence,
      });
    }

    console.log('✓ Created demo requests');

    console.log('\n✓ Seeding completed successfully');
    console.log('\n Demo credentials:');
    console.log('   Email: admin@acme.com | Password: password123');
    console.log('   Email: jordan@acme.com | Password: password123');

    // --- Additional tenant for multi-tenant verification ---
    const org2 = await orgModel.createOrganization('Beta Labs', null);
    console.log('✓ Created organization:', org2.name);

    const admin2 = await userModel.createUser('admin@beta.com', 'password123', 'Beta Admin', 'admin', org2.id);
    const eng2 = await userModel.createUser('sam@beta.com', 'password123', 'Sam Lee', 'employee', org2.id);

    await policyModel.createPolicy({
      org_id: org2.id,
      name: 'Beta SaaS Policy',
      description: 'Beta org SaaS policy',
      threshold: '< $100/mo',
      auto_approval_rate: 90,
    });

    await db.query(
      `INSERT INTO requests (id, org_id, user_id, title, description, type, requestor_role, urgency, status, confidence, created_at)
       VALUES (gen_random_uuid(), $1, $2, 'Beta - Tool Access', 'Requesting access to beta tool', 'SaaS Provisioning', 'Employee', 'low', 'pending', 33, NOW())`,
      [org2.id, eng2.id]
    );

    console.log('✓ Created Beta tenant demo users and requests');
  } catch (err) {
    console.error('✗ Seed failed:', err);
    throw err;
  }
};

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  seed()
    .then(async () => {
      await db.end();
      console.log('\nDone');
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await db.end();
      process.exit(1);
    });
}

export default seed;
