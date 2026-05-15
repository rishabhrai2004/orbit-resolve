import * as requestModel from './src/models/request.js';

const fakeDb = {
  async query(sql, params) {
    // return different counts based on user_id param
    const userId = params && params[0];
    if (userId === 'u1') return { rows: [{ count: 0 }] };
    if (userId === 'u2') return { rows: [{ count: 60 }] };
    if (userId === 'u3') return { rows: [{ count: 1000 }] };
    return { rows: [{ count: 0 }] };
  }
};

(async () => {
  const r1 = { user_id: 'u1', urgency: 'low', type: 'SaaS Provisioning' };
  const score1 = await requestModel.calculateRiskScore(r1, fakeDb);
  console.log('Score1 (expected 25):', score1);

  const r2 = { user_id: 'u2', urgency: 'high', type: 'Privileged Access' };
  const score2 = await requestModel.calculateRiskScore(r2, fakeDb);
  console.log('Score2 (expected 45):', score2);

  const r3 = { user_id: 'u3', urgency: 'high', type: 'Privileged Access' };
  const score3 = await requestModel.calculateRiskScore(r3, fakeDb);
  console.log('Score3 (clamped):', score3);

  process.exit(0);
})();
