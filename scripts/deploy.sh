#!/usr/bin/env node
/* Production Deployment Script */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Orbit Resolve Production Deployment\n');

// Checks
const checks = [
  {
    name: 'Node.js version',
    check: () => {
      const version = execSync('node --version').toString().trim();
      const major = parseInt(version.split('.')[0].slice(1));
      return major >= 18 ? '✓' : '✗';
    },
  },
  {
    name: '.env file exists',
    check: () => fs.existsSync('.env') ? '✓' : '✗',
  },
  {
    name: 'Database connection',
    check: () => {
      try {
        execSync('npm run migrate --silent', { stdio: 'ignore' });
        return '✓';
      } catch {
        return '✗';
      }
    },
  },
];

console.log('Pre-deployment checks:');
for (const check of checks) {
  const result = check.check();
  console.log(`${result} ${check.name}`);
}

// Build
console.log('\nBuilding...');
execSync('npm ci --only=production', { stdio: 'inherit' });

// Run migrations
console.log('\nRunning migrations...');
execSync('npm run migrate', { stdio: 'inherit' });

console.log('\n✓ Deployment ready!');
console.log('\nNext steps:');
console.log('  1. npm start');
console.log('  2. Monitor logs at /var/log/orbit-resolve.log');
console.log('  3. Health check: curl http://localhost:3000/health');
