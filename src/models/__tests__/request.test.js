import { calculateRiskScore } from '../request.js';
import db from '../../db.js';

jest.mock('../../db.js', () => ({
  query: jest.fn(),
}));

describe('calculateRiskScore', () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  test('SaaS low urgency produces expected score', async () => {
    // history count 0
    db.query.mockResolvedValueOnce({ rows: [{ count: 0 }] });
    const req = { user_id: 'u1', urgency: 'low', type: 'SaaS Provisioning' };
    const score = await calculateRiskScore(req);
    expect(score).toBe(25); // baseline 50 -10 (low) -15 (SaaS)
  });

  test('Privileged high urgency with heavy history reduces score differently', async () => {
    // history count 60
    db.query.mockResolvedValueOnce({ rows: [{ count: 60 }] });
    const req = { user_id: 'u2', urgency: 'high', type: 'Privileged Access' };
    const score = await calculateRiskScore(req);
    // baseline 50 -20 (>10) -10 (>50) +10 (high) +15 (privileged) => 45
    expect(score).toBe(45);
  });

  test('score is clamped between 0 and 100', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ count: 1000 }] });
    const req = { user_id: 'u3', urgency: 'high', type: 'Privileged Access' };
    const score = await calculateRiskScore(req);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
