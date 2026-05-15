/* Database Migration Script */
import db from '../src/db.js';
import path from 'path';
import { fileURLToPath } from 'url';

export const migrate = async () => {
  try {
    console.log('Running database migrations...');

    await db.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
    `);

    // Organizations
    await db.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        owner_id UUID,
        subscription_status VARCHAR(50) DEFAULT 'trial',
        subscription_tier VARCHAR(50) DEFAULT 'starter',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Users
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'employee',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);
    `);

    // Policies
    await db.query(`
      CREATE TABLE IF NOT EXISTS policies (
        id UUID PRIMARY KEY,
        org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        threshold VARCHAR(255),
        auto_approval_rate INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_policies_org ON policies(org_id);
    `);

    // Requests
    await db.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id UUID PRIMARY KEY,
        org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        policy_id UUID REFERENCES policies(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(100),
        requestor_role VARCHAR(50),
        target_resource VARCHAR(255),
        urgency VARCHAR(50),
        status VARCHAR(50) DEFAULT 'pending',
        confidence INT DEFAULT 0,
        approver_id UUID REFERENCES users(id),
        approval_notes TEXT,
        approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_requests_org ON requests(org_id);
      CREATE INDEX IF NOT EXISTS idx_requests_user ON requests(user_id);
      CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
    `);

    // Exceptions
    await db.query(`
      CREATE TABLE IF NOT EXISTS exceptions (
        id UUID PRIMARY KEY,
        org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
        reason TEXT,
        policy_conflict JSONB,
        recommendation JSONB,
        status VARCHAR(50) DEFAULT 'pending',
        resolved_by UUID REFERENCES users(id),
        resolution_notes TEXT,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_exceptions_org ON exceptions(org_id);
      CREATE INDEX IF NOT EXISTS idx_exceptions_status ON exceptions(status);
    `);

    // Audit Logs
    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY,
        org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100),
        entity_id UUID,
        details JSONB,
        ip_address INET,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(org_id);
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
    `);

    console.log('✓ Migrations completed successfully');
  } catch (err) {
    console.error('✗ Migration failed:', err);
    throw err;
  }
};

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  migrate()
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export default migrate;
