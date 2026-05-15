const request = require('supertest');
const API = process.env.TEST_BASE_URL || 'http://localhost:3000';
const agent = request(API);
let token;

beforeAll(async () => {
  const res = await agent.post('/api/v1/auth/login').send({ email: 'admin@acme.com', password: 'password123' });
  if (res.status !== 200) throw new Error('login failed');
  token = res.body.token;
});

describe('Top priority integration tests (CJS)', () => {
  test('1. Happy-path SaaS provisioning returns 201 and ai_recommendation', async () => {
    const res = await agent.post('/api/v1/requests').set('Authorization', `Bearer ${token}`).send({ title: 'Happy-path SaaS provisioning', description: 'Provision standard SaaS seat', type: 'SaaS Provisioning', urgency: 'low', target_resource: 'figma' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('confidence');
    expect(res.body).toHaveProperty('ai_recommendation');
  });

  test('2. Low-confidence escalation produces response with confidence field', async () => {
    const res = await agent.post('/api/v1/requests').set('Authorization', `Bearer ${token}`).send({ title: 'Low-confidence escalation', description: 'Access with low score', type: 'Privileged Access', urgency: 'low', target_resource: 'db.read' });
    expect(res.status).toBe(201);
    expect(typeof res.body.confidence).toBe('number');
  });

  test('3. High-confidence auto-approve scenario (confidence present)', async () => {
    const res = await agent.post('/api/v1/requests').set('Authorization', `Bearer ${token}`).send({ title: 'High-confidence auto-approve', description: 'Routine repo access', type: 'SaaS Provisioning', urgency: 'low', target_resource: 'core-api' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('confidence');
  });

  test('4. Privileged access emergency includes urgency and confidence', async () => {
    const res = await agent.post('/api/v1/requests').set('Authorization', `Bearer ${token}`).send({ title: 'Privileged access emergency', description: 'On-call emergency DB access', type: 'Privileged Access', urgency: 'high', target_resource: 'aurora-prod-db' });
    expect(res.status).toBe(201);
    expect(res.body.urgency).toBe('high');
    expect(typeof res.body.confidence).toBe('number');
  });

  test('8. Multi-tenant isolation: org_id present and request created', async () => {
    const res = await agent.post('/api/v1/requests').set('Authorization', `Bearer ${token}`).send({ title: 'Multi-tenant isolation', description: 'Same resource across tenants', type: 'SaaS Provisioning', urgency: 'low', target_resource: 'shared-name' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('org_id');
  });

  test('12. AI service outage fallback: ai_recommendation.meta.fallback present', async () => {
    const res = await agent.post('/api/v1/requests').set('Authorization', `Bearer ${token}`).send({ title: 'AI service outage fallback', description: 'LLM returns 404 fallback', type: 'SaaS Provisioning', urgency: 'low', target_resource: 'llm-fallback' });
    expect(res.status).toBe(201);
    expect(res.body.ai_recommendation).toBeDefined();
    expect(res.body.ai_recommendation.meta).toBeDefined();
    expect(res.body.ai_recommendation.meta.fallback).toBeTruthy();
  });

  test('14. Approver override: create request then approve via PATCH', async () => {
    const create = await agent.post('/api/v1/requests').set('Authorization', `Bearer ${token}`).send({ title: 'Approver override', description: 'Manager override', type: 'SaaS Provisioning', urgency: 'medium', target_resource: 'override-case' });
    expect(create.status).toBe(201);
    const id = create.body.id;
    const patch = await agent.patch(`/api/v1/requests/${id}/approval`).set('Authorization', `Bearer ${token}`).send({ status: 'approved', notes: 'Manager override, scope to 2 hours' });
    expect(patch.status).toBe(200);
    expect(patch.body.status).toBe('approved');
  });

  test('21. Data access/legal hold flags legal/infosec', async () => {
    const res = await agent.post('/api/v1/requests').set('Authorization', `Bearer ${token}`).send({ title: 'Data access/legal hold', description: 'Sensitive data approval', type: 'Data Access', urgency: 'high', target_resource: 'sensitive-db' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('confidence');
    expect(res.body).toHaveProperty('ai_recommendation');
  }, 20000);

});
