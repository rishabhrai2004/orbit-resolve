/* Seed Database with Demo Data */
import db from '../src/db.js';
import * as userModel from '../src/models/user.js';
import * as orgModel from '../src/models/organization.js';
import * as policyModel from '../src/models/policy.js';

export const seed = async () => {
  try {
    console.log('Seeding database...');

    // Create demo org
    const org = await orgModel.createOrganization('Acme Corp', null);
    console.log('✓ Created organization:', org.name);

    // Create demo users
    const admin = await userModel.createUser('admin@acme.com', 'password123', 'Admin User', 'admin', org.id);
    const manager1 = await userModel.createUser('maya@acme.com', 'password123', 'Maya Rodriguez', 'manager', org.id);
    const manager2 = await userModel.createUser('tom@acme.com', 'password123', 'Tom Chen', 'admin', org.id);
    const employee = await userModel.createUser('jordan@acme.com', 'password123', 'Jordan Davis', 'employee', org.id);

    console.log('✓ Created demo users');

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
        threshold: '≤ 30% bump',
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

    // Create demo requests
    await db.query(
      `INSERT INTO requests (id, org_id, user_id, title, description, type, requestor_role, urgency, status, confidence, created_at)
       VALUES 
         (gen_random_uuid(), $1, $2, 'GitHub repo access', 'Grant access to core-api repo for platform migration', 'SaaS Provisioning', 'Software Engineer', 'low', 'pending', 52, NOW()),
         (gen_random_uuid(), $1, $3, 'Okta MFA reset', 'Reset Okta MFA token — lost authenticator device', 'Account Recovery', 'Senior Engineer', 'medium', 'approved', 75, NOW()),
         (gen_random_uuid(), $1, $4, 'AWS Production Console Access', 'AWS production database access for incident debugging', 'Privileged Access', 'Senior Engineer', 'high', 'pending', 26, NOW())`,
      [org.id, employee.id, manager1.id, manager1.id]
    );

    console.log('✓ Created demo requests');

    console.log('\n✓ Seeding completed successfully');
    console.log('\n Demo credentials:');
    console.log('   Email: admin@acme.com | Password: password123');
    console.log('   Email: jordan@acme.com | Password: password123');
  } catch (err) {
    console.error('✗ Seed failed:', err);
    throw err;
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
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
