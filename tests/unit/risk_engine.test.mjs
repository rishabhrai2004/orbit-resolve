import { describe, expect, test } from '@jest/globals';
import { classifyRequest, estimateResourceCost, evaluateRequest } from '../../src/services/riskEngine.js';

const fakeDb = {
  async query(sql) {
    if (sql.includes('FROM policies')) {
      return { rows: [] };
    }
    return { rows: [{ total: 12, approved: 11, denied: 1 }] };
  },
};

describe('risk engine', () => {
  test('does not mistake product work for production access', () => {
    const type = classifyRequest({
      title: 'Provision a Figma seat for product design collaboration',
      type: 'SaaS Provisioning',
      target_resource: 'figma',
    });

    expect(type).toBe('SaaS Provisioning');
  });

  test('estimates common SaaS costs deterministically', () => {
    expect(estimateResourceCost('figma')).toBe(15);
    expect(estimateResourceCost('unknown-app')).toBe(35);
  });

  test('auto-approves low-risk SaaS when policy gates pass', async () => {
    const decision = await evaluateRequest({
      org_id: 'org-1',
      user_id: 'user-1',
      title: 'Provision a Figma seat',
      description: 'Provision a Figma seat',
      type: 'SaaS Provisioning',
      target_resource: 'figma',
      urgency: 'low',
      requestor_role: 'employee',
    }, fakeDb);

    expect(decision.status).toBe('approved');
    expect(decision.blockers).toHaveLength(0);
  });
});
