/* Orbit Resolve - API connected SaaS prototype */

const API_BASE = '/api/v1';

const S = {
  view: 'request',
  role: 'employee',
  reqState: 'idle',
  evalComplete: false,
  apiComplete: false,
  lastReq: null,
  lastResult: null,
  aiRec: null,
  requests: [],
  exceptions: [],
  policies: [],
  users: [],
  auditLogs: [],
  stats: {},
  charts: {},
  busy: false,
};

const ROLES = {
  employee: { ini: 'JD', name: 'Jordan Davis', title: 'Software Engineer' },
  manager: { ini: 'MR', name: 'Maya Rodriguez', title: 'Engineering Manager' },
  admin: { ini: 'AP', name: 'Avery Patel', title: 'IT Operations Admin' },
  exec: { ini: 'AL', name: 'Aisha Lin', title: 'VP of Engineering' },
};

const OPS = [
  { label: 'GitHub repo access', text: 'Grant access to core-api repo for platform migration' },
  { label: 'Okta MFA reset', text: 'Reset Okta MFA token for my lost authenticator device' },
  { label: 'Figma seat', text: 'Provision a Figma seat for product design collaboration' },
  { label: 'Production DB access', text: 'AWS production database access for incident debugging' },
];

const FALLBACK_POLICIES = [
  { name: 'SaaS Provisioning', description: 'Standard tools below monthly cost threshold', threshold: '$50/month', auto_approval_rate: 80 },
  { name: 'Privileged Access', description: 'Temporary production access tied to incident context', threshold: 'On-call + expiry', auto_approval_rate: 90 },
  { name: 'Vendor Security Review', description: 'DPA and InfoSec approval before production keys', threshold: 'Review required', auto_approval_rate: 88 },
];

const h = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const pct = (value) => Math.max(0, Math.min(100, Number(value) || 0));

const fmtDate = (value) => {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const ago = (value) => {
  if (!value) return 'Just now';
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff) || diff < 0) return 'Just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} day ago`;
};

const authHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    window.location.href = '/login.html';
    throw new Error('Session expired');
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  }
  return data;
}

async function refreshData() {
  const safe = (promise, fallback) => promise.catch((err) => {
    console.warn(err.message || err);
    return fallback;
  });

  const [requests, policies, stats, exceptions, users] = await Promise.all([
    safe(api('/requests?limit=50'), { requests: [] }),
    safe(api('/policies?limit=50'), { policies: [] }),
    safe(api('/admin/stats'), {}),
    safe(api('/requests/exceptions/list?limit=50'), { exceptions: [] }),
    safe(api('/users?limit=100'), { users: [] }),
  ]);

  S.requests = requests.requests || [];
  S.policies = policies.policies || [];
  S.stats = stats || {};
  S.exceptions = exceptions.exceptions || [];
  S.users = users.users || [];
  updateReviewBadge();
}

function updateReviewBadge() {
  const badge = document.getElementById('reviewBadge');
  if (badge) badge.textContent = S.exceptions.length;
}

function iconCheck(size = 14) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`;
}

function iconArrow(size = 12) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
}

function iconClock(size = 12) {
  return `<svg class="latency-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;
}

function navigate(v) {
  S.view = v;
  S.charts = {};
  document.querySelectorAll('.nav-link').forEach((el) => el.classList.toggle('active', el.dataset.view === v));
  render();
}

function setRole(r) {
  S.role = r;
  const u = ROLES[r];
  document.querySelectorAll('.p-tab').forEach((el) => el.classList.toggle('active', el.dataset.role === r));
  document.getElementById('avatar').textContent = u.ini;
  document.getElementById('uName').textContent = u.name;
  document.getElementById('uRole').textContent = u.title;
  navigate({ employee: 'request', manager: 'exceptions', admin: 'team', exec: 'dashboard' }[r]);
}

function render() {
  const el = document.getElementById('main');
  const w = document.createElement('div');
  w.className = 'view';

  if (S.view === 'request') w.innerHTML = vRequest();
  if (S.view === 'resolution') w.innerHTML = vResolution();
  if (S.view === 'exceptions') w.innerHTML = vExceptions();
  if (S.view === 'policies') w.innerHTML = vPolicies();
  if (S.view === 'team') w.innerHTML = vTeam();
  if (S.view === 'dashboard') w.innerHTML = vDashboard();

  el.innerHTML = '';
  el.appendChild(w);
  bindView();
  if (S.view === 'dashboard') setTimeout(initChart, 50);
}

function bindView() {
  document.querySelectorAll('[data-action="execute"]').forEach((el) => el.addEventListener('click', go));
  document.querySelectorAll('[data-run]').forEach((el) => el.addEventListener('click', () => runOp(el.dataset.run)));
  document.querySelectorAll('[data-action="new-operation"]').forEach((el) => el.addEventListener('click', () => {
    S.reqState = 'idle';
    S.lastResult = null;
    navigate('request');
  }));
  document.querySelectorAll('[data-action="copy-ai"]').forEach((el) => el.addEventListener('click', copyAIRec));
  document.querySelectorAll('[data-action="add-policy"]').forEach((el) => el.addEventListener('click', openPolicyModal));
  document.querySelectorAll('[data-action="invite-user"]').forEach((el) => el.addEventListener('click', openInviteModal));
  document.querySelectorAll('[data-action="refresh"]').forEach((el) => el.addEventListener('click', async () => {
    await refreshData();
    render();
    toast('Live data refreshed');
  }));
  document.querySelectorAll('[data-exc-approve]').forEach((el) => el.addEventListener('click', () => decideException(el.dataset.excApprove, el.dataset.exceptionId, 'approved')));
  document.querySelectorAll('[data-exc-deny]').forEach((el) => el.addEventListener('click', () => decideException(el.dataset.excDeny, el.dataset.exceptionId, 'denied')));
  document.querySelectorAll('[data-action="audit"]').forEach((el) => el.addEventListener('click', openAuditModal));

  const input = document.getElementById('ri');
  if (input) {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        go();
      }
    });
  }
}

function vRequest() {
  if (S.reqState === 'evaluating') return vEval();
  if (S.reqState === 'escalated') return vEscalated();

  const approved = Number(S.stats.approved_count || 0);
  const pending = Number(S.stats.pending_count || S.stats.pending_exceptions || 0);
  const total = Number(S.stats.request_count || approved + pending || 1);
  const rate = Number(S.stats.autonomous_rate || Math.round((approved / total) * 1000) / 10 || 0);
  const chips = OPS.map((o) => `<button class="qchip" type="button" data-run="${h(o.text)}">${h(o.label)}</button>`).join('');

  return `
    <div class="hdr">
      <div class="eyebrow">Operational Autopilot</div>
      <h1 class="h1">What needs to happen?</h1>
      <p class="sub">Describe the operation. Orbit evaluates policy, confidence, precedent, and execution scope before approving or escalating.</p>
    </div>
    <div class="req-box">
      <textarea id="ri" class="req-input" rows="2" placeholder="e.g. I need access to the core-api GitHub repo for the platform migration"></textarea>
      <div class="req-foot">
        <span class="req-hint">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>
          Live policy engine
        </span>
        <button class="btn btn-dark" type="button" data-action="execute">Execute${iconArrow()}</button>
      </div>
    </div>
    <div class="quick-row">${chips}</div>

    <div class="card mt-6"><div class="card-body">
      <div class="between stack-sm" style="margin-bottom:12px">
        <span class="fw6 ts">Current workspace activity</span>
        <button class="btn btn-ghost btn-sm" type="button" data-action="refresh">Refresh</button>
      </div>
      <div class="kv"><span class="kv-label">Autonomously approved</span><span class="kv-value" style="color:var(--ok)">${h(approved)}</span></div>
      <div class="kv"><span class="kv-label">Waiting for review</span><span class="kv-value">${h(pending)}</span></div>
      <div class="kv"><span class="kv-label">Manager hours eliminated</span><span class="kv-value" style="color:var(--ok)">${h(S.stats.manager_hours_eliminated || Math.round(approved * 3.5))} hrs</span></div>
      <div class="kv"><span class="kv-label">Autonomous rate</span><span class="kv-value"><span class="badge b-ok">${h(rate)}%</span></span></div>
    </div></div>`;
}

function vEval() {
  setTimeout(runEval, 80);
  const steps = [
    ['Identity verified', 'Checking requester role and tenant boundary'],
    ['Intent classified', 'Matching operation type and target resource'],
    ['Policy evaluated', 'Comparing thresholds, blockers, and history'],
    ['Decision recorded', 'Writing request, exception, and audit state'],
    ['Execution planned', 'Preparing connector action or review handoff'],
  ];
  const html = steps.map((s, i) => `
    <div class="eval-step" id="es${i}">
      <div class="eval-ico" id="ei${i}"></div>
      <div><div class="eval-title">${h(s[0])}</div><div class="eval-detail" id="ed${i}">${h(s[1])}</div></div>
    </div>`).join('');

  return `
    <div class="hdr">
      <div class="eyebrow">Decision Engine</div>
      <h1 class="h1">Evaluating operation</h1>
      <p class="sub tf">"${h(S.lastReq)}"</p>
    </div>
    ${html}`;
}

function runEval() {
  if (S.reqState !== 'evaluating') return;
  let i = 0;
  function tick() {
    if (S.reqState !== 'evaluating') return;
    if (i > 0) {
      const prev = document.getElementById(`es${i - 1}`);
      const pi = document.getElementById(`ei${i - 1}`);
      if (prev) prev.classList.add('done');
      if (pi) pi.innerHTML = iconCheck(10);
    }
    if (i >= 5) {
      S.evalComplete = true;
      finishIfReady();
      return;
    }
    const s = document.getElementById(`es${i}`);
    const ic = document.getElementById(`ei${i}`);
    if (s) s.classList.add('on');
    if (ic) ic.innerHTML = '<div class="spin"></div>';
    i += 1;
    setTimeout(tick, 420);
  }
  tick();
}

function finishIfReady() {
  if (!S.evalComplete || !S.apiComplete) return;
  const status = S.lastResult?.decision?.status || S.lastResult?.status;
  if (status === 'approved') {
    S.reqState = 'resolved';
    navigate('resolution');
  } else {
    S.reqState = 'escalated';
    navigate('request');
  }
}

function vResolution() {
  const result = S.lastResult || {};
  const decision = result.decision || {};
  const policy = decision.policy || {};
  const req = result.title || S.lastReq || 'Operation';
  const confidence = pct(decision.confidence || result.confidence);
  const reasons = (decision.reasons || ['Policy threshold passed', 'Audit record created']).map((r) => `<li>${h(r)}</li>`).join('');
  const provision = result.provisioning?.result || {};
  const action = provision.action || decision.execution?.action || 'Provisioning queued';

  const log = [
    ['Intent parsed', `${decision.type || result.type || 'Operation'} - ${req}`],
    ['Policy evaluated', `${policy.code || 'POLICY'} - ${policy.name || 'Matched policy'}`],
    ['Confidence scored', `${confidence}% against ${decision.threshold || 80}% threshold`],
    ['Execution queued', `${action}${provision.external_ref ? ` (${provision.external_ref})` : ''}`],
  ].map((l) => `<div class="audit-item"><div class="audit-dot"></div><div><div class="audit-t">${h(l[0])} - ${fmtDate(result.updated_at || result.created_at)}</div><div class="audit-d">${h(l[1])}</div></div></div>`).join('');

  return `
    <div class="hdr">
      <div class="between stack-sm">
        <div>
          <div class="eyebrow">${h(result.id || 'Operation')}</div>
          <h1 class="h1">Resolved autonomously</h1>
        </div>
        <div class="row gap-2 wrap">
          <span class="latency">${iconClock()}${h(decision.execution?.latency_ms ? `${decision.execution.latency_ms / 1000}s` : 'Queued')}</span>
          <button class="btn btn-ghost btn-sm" type="button" data-action="new-operation">New operation</button>
        </div>
      </div>
    </div>

    <div class="outcome ok">
      <div class="outcome-icon">${iconCheck(16)}</div>
      <div>
        <div class="outcome-h">Auto-approved and audit-ready</div>
        <div class="outcome-p">The request cleared policy gates, confidence threshold, and execution constraints. A deterministic connector event was recorded for the audit trail.</div>
      </div>
    </div>

    <div class="card"><div class="card-body">
      <div class="kv"><span class="kv-label">Operation</span><span class="kv-value">${h(req)}</span></div>
      <div class="kv"><span class="kv-label">Policy matched</span><span class="kv-value"><span class="badge b-accent">${h(policy.code || 'POLICY')}</span> ${h(policy.name || 'Matched policy')}</span></div>
      <div class="kv"><span class="kv-label">Confidence</span><span class="kv-value">${confidenceBar(confidence, 'var(--ok)')}</span></div>
      <div class="kv"><span class="kv-label">Action taken</span><span class="kv-value">${h(action)}</span></div>
      <div class="kv"><span class="kv-label">Connector reference</span><span class="kv-value">${h(provision.external_ref || 'Audit-only simulation')}</span></div>
      ${S.aiRec ? `<div class="kv"><span class="kv-label">Recommendation</span><span class="kv-value">${h(S.aiRec.text || '')}</span></div>` : ''}
    </div></div>

    <div class="reason mt-4">
      <div class="reason-label">Why Orbit resolved this</div>
      <ul class="reason-list">${reasons}</ul>
    </div>

    <div class="mt-6">
      <div class="fw6 ts" style="margin-bottom:14px">Execution log</div>
      ${log}
    </div>`;
}

function vEscalated() {
  const result = S.lastResult || {};
  const decision = result.decision || {};
  const blockers = decision.blockers || [];
  const firstBlocker = blockers[0]?.message || 'Confidence did not meet the automation threshold';
  const blockerHtml = blockers.length
    ? blockers.map((b) => `<li>${h(b.message)}</li>`).join('')
    : '<li>Manager review required before execution.</li>';
  const confidence = pct(decision.confidence || result.confidence);

  return `
    <div class="hdr">
      <div class="eyebrow">Decision Engine</div>
      <h1 class="h1">Exception detected</h1>
      <p class="sub">Orbit created a review item instead of pretending a risky operation was safe.</p>
    </div>
    <div class="outcome warn">
      <div class="outcome-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg></div>
      <div>
        <div class="outcome-h">Escalated for review</div>
        <div class="outcome-p">${h(firstBlocker)}</div>
      </div>
    </div>
    <div class="card"><div class="card-body">
      <div class="kv"><span class="kv-label">Operation</span><span class="kv-value">${h(result.title || S.lastReq)}</span></div>
      <div class="kv"><span class="kv-label">Policy</span><span class="kv-value">${h(decision.policy?.code || 'POLICY')} - ${h(decision.policy?.name || 'Review gate')}</span></div>
      <div class="kv"><span class="kv-label">Confidence</span><span class="kv-value">${confidenceBar(confidence, confidence < 50 ? 'var(--err)' : 'var(--warn)')}</span></div>
      <div class="kv"><span class="kv-label">Routed to</span><span class="kv-value">Operations review queue</span></div>
    </div></div>
    <div class="reason mt-4 warn-reason">
      <div class="reason-label">Review blockers</div>
      <ul class="reason-list">${blockerHtml}</ul>
    </div>
    <div class="mt-4 row gap-2 wrap">
      <button class="btn btn-dark btn-sm" type="button" data-action="new-operation">Run another operation</button>
      <button class="btn btn-ghost btn-sm" type="button" data-action="refresh">Refresh review queue</button>
    </div>`;
}

function confidenceBar(value, color) {
  const width = pct(value);
  return `<span class="conf-row"><span class="conf-track"><span class="conf-fill" style="width:${width}%;background:${color}"></span></span><span class="conf-val" style="color:${color}">${width}%</span></span>`;
}

function vExceptions() {
  const cards = S.exceptions.map(exceptionCard).join('');
  const approved = Number(S.stats.approved_count || 0);

  return `
    <div class="hdr">
      <div class="between stack-sm">
        <div>
          <div class="eyebrow">Manager - Exception Review</div>
          <h1 class="h1">${S.exceptions.length} decisions need review</h1>
          <p class="sub">Only unresolved policy conflicts appear here. Approvals and denials write back to the request and exception trail.</p>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" data-action="refresh">Refresh</button>
      </div>
    </div>

    <div class="relief">
      <div class="relief-num">${h(approved)}</div>
      <div>
        <div class="relief-h">Operations approved automatically</div>
        <div class="relief-p">The review queue is reserved for policy conflict, missing scope, sensitive data, or confidence below the automation threshold.</div>
      </div>
    </div>

    ${cards || emptyState('No review items', 'Run a high-risk operation such as production database access to see the review workflow.')}`;
}

function exceptionCard(e) {
  const rec = typeof e.recommendation === 'string' ? safeJson(e.recommendation) : e.recommendation || {};
  const conflict = typeof e.policy_conflict === 'string' ? safeJson(e.policy_conflict) : e.policy_conflict || {};
  const reason = typeof e.reason === 'string' ? safeJson(e.reason) : e.reason || {};
  const blockers = reason.blockers || [];
  const urgency = e.urgency || 'medium';
  const urgencyClass = urgency === 'high' ? 'b-err' : urgency === 'low' ? 'b-accent' : 'b-warn';
  const actual = conflict.actual || blockers.map((b) => b.message).join('; ') || 'Policy threshold requires review';

  return `
    <div class="exc-card">
      <div class="exc-header">
        <div class="exc-header-left">
          <div class="exc-avatar">${h((e.requestor_name || 'OR').split(' ').map((p) => p[0]).join('').slice(0, 2))}</div>
          <div>
            <div class="exc-title">${h(e.title || 'Operation review')}</div>
            <div class="exc-meta">${h(e.requestor_name || 'Requester')} - ${h(e.type || 'Operation')} - ${ago(e.created_at)}</div>
          </div>
        </div>
        <div class="row gap-2 wrap">
          <span class="badge ${urgencyClass}">${h(urgency)}</span>
          <span class="badge b-warn">${h(String(e.id || '').slice(0, 8))}</span>
        </div>
      </div>
      <div class="exc-body">
        <div class="exc-section">
          <div class="exc-section-label">Policy conflict</div>
          <div class="policy-conflict">
            <div class="pc-row"><span class="pc-label">Policy</span><span class="pc-value">${h(conflict.policy || 'Policy gate')}</span></div>
            <div class="pc-row"><span class="pc-label">Rule</span><span class="pc-value">${h(conflict.rule || 'Automation threshold')}</span></div>
            <div class="pc-row pc-violation"><span class="pc-label">Issue</span><span class="pc-value">${h(actual)}</span></div>
          </div>
        </div>
        <div class="ai-rec">
          <div class="ai-rec-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>
            Recommendation: <strong>${h(rec.action || 'Manager review')}</strong>
          </div>
          <p class="ai-rec-text">${h(rec.reasoning || 'Review the request, constrain scope, and record rationale.')}</p>
        </div>
      </div>
      <div class="exc-actions">
        <button class="btn btn-ok" type="button" data-exc-approve="${h(e.request_id)}" data-exception-id="${h(e.id)}">${iconCheck()} Approve</button>
        <button class="btn btn-err btn-sm" type="button" data-exc-deny="${h(e.request_id)}" data-exception-id="${h(e.id)}">Deny</button>
      </div>
    </div>`;
}

function vPolicies() {
  const policies = S.policies.length ? S.policies : FALLBACK_POLICIES;
  const rows = policies.map((p) => `
    <div class="pol-row">
      <div><div class="pol-name">${h(p.name)}</div><div class="pol-desc">${h(p.description)}</div></div>
      <div class="pol-thr">${h(p.threshold || 'n/a')}</div>
      <div class="pol-rate">${h(p.auto_approval_rate ?? 0)}%</div>
      <div><span class="status-dot ${Number(p.auto_approval_rate || 0) >= 70 ? 'on' : ''}"></span></div>
    </div>`).join('');

  return `
    <div class="hdr">
      <div class="between stack-sm">
        <div>
          <div class="eyebrow">Admin - Decision Infrastructure</div>
          <h1 class="h1">Policy Engine</h1>
          <p class="sub">Policy rows are loaded from the API and used by the decision engine when requests are evaluated.</p>
        </div>
        <div class="row gap-2 wrap">
          <button class="btn btn-ghost btn-sm" type="button" data-action="refresh">Refresh</button>
          <button class="btn btn-dark btn-sm" type="button" data-action="add-policy">Add policy</button>
        </div>
      </div>
    </div>

    <div class="pol-table">
      <div class="pol-head"><span>Policy</span><span>Threshold</span><span>Auto-Resolve</span><span>Active</span></div>
      ${rows}
    </div>

    <div class="card mt-6"><div class="card-body">
      <div class="fw6 ts" style="margin-bottom:12px">Engine coverage</div>
      <div class="kv"><span class="kv-label">Total operations evaluated</span><span class="kv-value">${h(S.stats.request_count || 0)}</span></div>
      <div class="kv"><span class="kv-label">Resolved autonomously</span><span class="kv-value" style="color:var(--ok)">${h(S.stats.approved_count || 0)} (${h(S.stats.autonomous_rate || 0)}%)</span></div>
      <div class="kv"><span class="kv-label">Escalated to humans</span><span class="kv-value">${h(S.stats.pending_count || 0)}</span></div>
      <div class="kv"><span class="kv-label">Average confidence</span><span class="kv-value">${h(S.stats.avg_confidence || 0)}%</span></div>
    </div></div>`;
}

function vTeam() {
  const users = S.users;
  const counts = users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {});
  const rows = users.map((user) => `
    <div class="team-row">
      <div class="team-person">
        <div class="team-avatar">${h(initials(user.name || user.email))}</div>
        <div>
          <div class="team-name">${h(user.name)}</div>
          <div class="team-email">${h(user.email)}</div>
        </div>
      </div>
      <span class="badge ${roleBadge(user.role)}">${h(user.role)}</span>
      <span class="team-date">${h(fmtDate(user.created_at))}</span>
    </div>`).join('');

  return `
    <div class="hdr">
      <div class="between stack-sm">
        <div>
          <div class="eyebrow">Admin - Workspace</div>
          <h1 class="h1">Team Access</h1>
          <p class="sub">Demo tenant roster with 8 employees, 3 managers, and 1 admin. These roles drive approval permissions and policy context.</p>
        </div>
        <div class="row gap-2 wrap">
          <button class="btn btn-ghost btn-sm" type="button" data-action="refresh">Refresh</button>
          <button class="btn btn-dark btn-sm" type="button" data-action="invite-user">Invite user</button>
        </div>
      </div>
    </div>

    <div class="metrics">
      <div class="m-card"><div class="m-label">Employees</div><div class="m-value">${h(counts.employee || 0)}</div><div class="m-delta muted">requesters</div></div>
      <div class="m-card"><div class="m-label">Managers</div><div class="m-value">${h(counts.manager || 0)}</div><div class="m-delta muted">approvers</div></div>
      <div class="m-card"><div class="m-label">Admins</div><div class="m-value">${h((counts.admin || 0) + (counts.exec || 0))}</div><div class="m-delta muted">workspace owners</div></div>
    </div>

    <div class="team-table">
      <div class="team-head"><span>User</span><span>Role</span><span>Joined</span></div>
      ${rows || emptyState('No users found', 'Invite a teammate to build out the demo workspace.')}
    </div>`;
}

function vDashboard() {
  const approved = Number(S.stats.approved_count || 0);
  const pending = Number(S.stats.pending_count || 0);
  const total = Number(S.stats.request_count || approved + pending || 0);
  const rate = Number(S.stats.autonomous_rate || 0);
  const topTypes = Object.entries(S.requests.reduce((acc, r) => {
    acc[r.type || 'Operation'] = (acc[r.type || 'Operation'] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return `
    <div class="hdr">
      <div class="between stack-sm">
        <div>
          <div class="eyebrow">Executive - Live Impact</div>
          <h1 class="h1">Operational Impact</h1>
          <p class="sub">Impact is calculated from request status, policy confidence, and audit-backed workflow outcomes.</p>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" data-action="refresh">Refresh</button>
      </div>
    </div>

    <div class="metrics">
      <div class="m-card"><div class="m-label">Autonomous Resolution Rate</div><div class="m-value">${h(rate)}%</div><div class="m-delta">${h(total)} evaluated</div></div>
      <div class="m-card"><div class="m-label">Manager Hours Eliminated</div><div class="m-value">${h(S.stats.manager_hours_eliminated || 0)}</div><div class="m-delta">3.5h avoided per auto-approval</div></div>
      <div class="m-card"><div class="m-label">Workspace Members</div><div class="m-value">${h(S.users.length || S.stats.user_count || 0)}</div><div class="m-delta muted">${h(S.exceptions.length)} open reviews</div></div>
    </div>

    <div class="chart-wrap">
      <div class="chart-h stack-sm">
        <div><div class="chart-t">Autonomous execution vs. review</div><div class="chart-s">Daily request volume from API data</div></div>
        <span class="badge b-ok">${h(rate)}% autonomous</span>
      </div>
      <div class="chart-cv"><canvas id="cx"></canvas></div>
    </div>

    <div class="card mt-4"><div class="card-body">
      <div class="fw6 ts" style="margin-bottom:12px">Top operation categories</div>
      ${topTypes.length ? topTypes.map(([type, count]) => `<div class="kv"><span class="kv-label">${h(type)}</span><span class="kv-value"><span class="badge b-accent">${h(count)} requests</span></span></div>`).join('') : '<div class="empty-inline">No request volume yet.</div>'}
    </div></div>`;
}

function initChart() {
  const c = document.getElementById('cx');
  if (!c || S.charts.main || !window.Chart) return;
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  const labels = days.map((d) => d.toLocaleDateString([], { month: 'short', day: 'numeric' }));
  const approved = days.map((d) => countForDay(d, 'approved'));
  const review = days.map((d) => S.requests.filter((r) => sameDay(r.created_at, d) && r.status !== 'approved').length);

  S.charts.main = new Chart(c, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Autonomous', data: approved, backgroundColor: '#09090b', borderRadius: 4, borderSkipped: false },
        { label: 'Human review', data: review, backgroundColor: '#d4d4d8', borderRadius: 4, borderSkipped: false },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, padding: 20, font: { size: 12, family: "'Inter',sans-serif" } } } },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11 } } },
        y: { beginAtZero: true, grid: { color: '#f4f4f5' }, border: { display: false }, ticks: { precision: 0, font: { size: 11 } } },
      },
    },
  });
}

function sameDay(value, d) {
  const date = new Date(value);
  return date.getFullYear() === d.getFullYear() && date.getMonth() === d.getMonth() && date.getDate() === d.getDate();
}

function countForDay(d, status) {
  return S.requests.filter((r) => sameDay(r.created_at, d) && r.status === status).length;
}

function inferUrgency(text) {
  return /\bprod\b|production|vendor|security|legal|sensitive|incident|p1|admin|database/i.test(text) ? 'high' : 'low';
}

function inferType(text) {
  if (/\bprod\b|production|database|aws|privileged|admin/i.test(text)) return 'Privileged Access';
  if (/vendor|dpa|anthropic|openai/i.test(text)) return 'Vendor Onboarding';
  if (/github|repo|repository/i.test(text)) return 'Source Control Access';
  if (/mfa|okta|authenticator|reset/i.test(text)) return 'Account Recovery';
  return 'SaaS Provisioning';
}

function go() {
  const v = document.getElementById('ri')?.value?.trim();
  if (!v || S.busy) return;
  runOp(v);
}

async function runOp(text) {
  S.lastReq = text;
  S.reqState = 'evaluating';
  S.evalComplete = false;
  S.apiComplete = false;
  S.lastResult = null;
  S.aiRec = null;
  S.busy = true;
  navigate('request');

  try {
    const data = await api('/requests', {
      method: 'POST',
      body: JSON.stringify({
        title: text,
        description: text,
        type: inferType(text),
        urgency: inferUrgency(text),
        target_resource: text,
      }),
    });
    S.lastResult = data;
    S.aiRec = data.ai_recommendation || null;
    await refreshData();
  } catch (err) {
    S.lastResult = {
      title: text,
      status: 'pending',
      decision: {
        status: 'pending',
        confidence: 0,
        blockers: [{ message: err.message || 'Unable to reach decision engine' }],
        policy: { code: 'SYS', name: 'Service availability' },
      },
    };
    toast(err.message || 'Request failed');
  } finally {
    S.busy = false;
    S.apiComplete = true;
    finishIfReady();
  }
}

async function decideException(requestId, exceptionId, status) {
  void exceptionId;
  try {
    await api(`/requests/${encodeURIComponent(requestId)}/approval`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes: `${status} from manager review queue` }),
    });
    await refreshData();
    render();
    toast(`Request ${status}. Audit trail updated.`);
  } catch (err) {
    toast(err.message || 'Decision failed');
  }
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function copyAIRec() {
  const ai = S.aiRec;
  if (!ai) return toast('No recommendation to copy');
  navigator.clipboard?.writeText(ai.text || '').then(() => toast('Copied recommendation')).catch(() => toast('Copy failed'));
}

function openPolicyModal() {
  const content = `
    <form class="modal-form" id="policyForm">
      <label>Policy name<input name="name" required placeholder="SaaS Provisioning" /></label>
      <label>Description<textarea name="description" rows="3" required placeholder="Standard SaaS access for approved roles"></textarea></label>
      <label>Threshold<input name="threshold" required placeholder="$50/month" /></label>
      <label>Auto-approval threshold<input name="auto_approval_rate" required type="number" min="1" max="100" value="80" /></label>
      <div class="modal-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-close-modal>Cancel</button>
        <button class="btn btn-dark btn-sm" type="submit">Create policy</button>
      </div>
    </form>`;
  showModal('Add Policy', content);
  document.getElementById('policyForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api('/policies', {
        method: 'POST',
        body: JSON.stringify({
          name: String(form.get('name') || ''),
          description: String(form.get('description') || ''),
          threshold: String(form.get('threshold') || ''),
          auto_approval_rate: Number(form.get('auto_approval_rate') || 80),
        }),
      });
      closeModal();
      await refreshData();
      render();
      toast('Policy created');
    } catch (err) {
      toast(err.message || 'Policy creation failed');
    }
  });
}

function openInviteModal() {
  const content = `
    <form class="modal-form" id="inviteForm">
      <label>Name<input name="name" required placeholder="Taylor Morgan" /></label>
      <label>Email<input name="email" type="email" required placeholder="taylor@acme.com" /></label>
      <label>Role
        <select name="role" required>
          <option value="employee">Employee</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
          <option value="exec">Exec</option>
        </select>
      </label>
      <div class="modal-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-close-modal>Cancel</button>
        <button class="btn btn-dark btn-sm" type="submit">Create demo user</button>
      </div>
    </form>`;
  showModal('Invite User', content);
  document.getElementById('inviteForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const data = await api('/users/invite', {
        method: 'POST',
        body: JSON.stringify({
          name: String(form.get('name') || ''),
          email: String(form.get('email') || ''),
          role: String(form.get('role') || 'employee'),
        }),
      });
      closeModal();
      await refreshData();
      render();
      toast(`Demo user created. Temp password: ${data.tempPassword}`);
    } catch (err) {
      toast(err.message || 'Invite failed');
    }
  });
}

async function openAuditModal() {
  try {
    const data = await api('/admin/audit-logs?limit=50');
    const logs = data.logs || [];
    const rows = logs.map((log) => `
      <div class="audit-modal-row">
        <div>
          <div class="audit-t">${h(log.action)}</div>
          <div class="audit-d">${h(log.entity_type || 'entity')} ${h(log.entity_id || '')}</div>
        </div>
        <div class="audit-date">${h(fmtDate(log.created_at))}</div>
      </div>`).join('');
    showModal('Audit History', rows || emptyState('No audit events', 'Create a request to populate the audit trail.'));
  } catch (err) {
    toast(err.message || 'Could not load audit history');
  }
}

function showModal(title, content) {
  closeModal();
  const wrap = document.createElement('div');
  wrap.id = 'modalRoot';
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal-box">
      <div class="modal-head">
        <div class="modal-title">${h(title)}</div>
        <button class="btn btn-ghost btn-sm" type="button" data-close-modal>Close</button>
      </div>
      <div class="modal-body">${content}</div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.querySelectorAll('[data-close-modal]').forEach((el) => el.addEventListener('click', closeModal));
  wrap.addEventListener('click', (event) => {
    if (event.target === wrap) closeModal();
  });
}

function closeModal() {
  document.getElementById('modalRoot')?.remove();
}

function emptyState(title, body) {
  return `<div class="empty-state"><div class="empty-title">${h(title)}</div><div class="empty-body">${h(body)}</div></div>`;
}

function initials(value) {
  return String(value || 'U')
    .split(/\s+|@/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function roleBadge(role) {
  if (role === 'admin' || role === 'exec') return 'b-accent';
  if (role === 'manager') return 'b-warn';
  return 'b-ok';
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

async function startApp() {
  if (!localStorage.getItem('auth_token')) {
    window.location.href = '/login.html';
    return;
  }

  document.querySelectorAll('.nav-link').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      navigate(el.dataset.view);
    });
  });
  document.querySelectorAll('.p-tab').forEach((el) => {
    el.addEventListener('click', () => setRole(el.dataset.role));
  });

  const auditBtn = document.createElement('button');
  auditBtn.className = 'audit-fab';
  auditBtn.type = 'button';
  auditBtn.dataset.action = 'audit';
  auditBtn.textContent = 'Audit';
  auditBtn.addEventListener('click', openAuditModal);
  document.body.appendChild(auditBtn);

  await refreshData();
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
