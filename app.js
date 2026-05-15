/* ═══════════════════════════════════
   ORBIT RESOLVE — App v3
   Autonomous Operational Execution
   ═══════════════════════════════════ */

const S = {
  view:'request', role:'employee',
  reqState:'idle', lastReq:null, lastOutcome:null,
  charts:{}
};

const ROLES = {
  employee:{ ini:'JD', name:'Jordan Davis',   title:'Software Engineer' },
  manager: { ini:'MR', name:'Maya Rodriguez', title:'Engineering Manager' },
  admin:   { ini:'TC', name:'Tom Chen',       title:'IT Operations Lead' },
  exec:    { ini:'AL', name:'Aisha Lin',      title:'VP of Engineering' }
};

const OPS = [
  { label:'GitHub repo access',      text:'Grant access to core-api repo for platform migration',  esc:false },
  { label:'Okta MFA reset',          text:'Reset Okta MFA token — lost authenticator device',       esc:false },
  { label:'Figma seat provisioning', text:'Provision Figma seat for new hire Sara Malik',           esc:false },
  { label:'Production DB access',    text:'AWS production database access for incident debugging',  esc:true },
];

const STEPS = [
  { t:'Identity verified',    d:'Jordan Davis · Software Engineer · Engineering' },
  { t:'Policy matched',       d:'IT-SW-04 · SaaS Provisioning for Standard Roles' },
  { t:'Risk scored',          d:'Score 8/100 · Low risk · No compliance flags' },
  { t:'Precedent validated',  d:'98 of 100 identical requests auto-approved (90 days)' },
  { t:'Provisioning executed',d:'Okta SCIM → Figma app assigned to jordan.davis@acme.com' },
];

const EXCEPTIONS = [
  {
    id:'OP-9142',
    user:'Sarah Chen', initials:'SC', role:'Senior Engineer', dept:'Platform',
    type:'Privileged Access',
    title:'AWS Production Console Access',
    elapsed:'14 min ago',
    urgency:'high', urgencyLabel:'P1 incident referenced',
    conf:26,
    policyConflict: {
      policy:'PAM-01 · Privileged Access Management',
      rule:'On-call rotation membership required for production systems',
      actual:'Sarah Chen is not on the active PagerDuty rotation for aurora-prod-db-01',
    },
    why:'Sarah referenced ticket INC-4821 (P1 latency spike) but is not currently on-call for this service. Orbit cannot confirm this is an authorized emergency without manager verification.',
    history: { total:12, approved:8, denied:4, note:'4 prior denials were for off-rotation access to this same cluster' },
    impact:'If approved, grants 4-hour temporary read/write access to aurora-prod-db-01. Access auto-revokes at expiry.',
    recommendation:{ action:'Approve with constraints', reasoning:'P1 incident INC-4821 is confirmed active. Recommend granting 2-hour scoped access instead of standard 4-hour window.' },
  },
  {
    id:'OP-9138',
    user:'David Kim', initials:'DK', role:'Procurement Lead', dept:'Finance',
    type:'Vendor Onboarding',
    title:'New Vendor: Anthropic API',
    elapsed:'1 hr ago',
    urgency:'medium', urgencyLabel:'Blocks Q3 roadmap item',
    conf:39,
    policyConflict: {
      policy:'VND-02 · Vendor Security Review',
      rule:'All data-processing vendors require InfoSec sign-off before provisioning',
      actual:'Anthropic API is not on the approved vendor list. Security review has not been initiated.',
    },
    why:'Anthropic processes customer-adjacent data. Org policy requires a completed security questionnaire and DPA before any integration keys are issued.',
    history: { total:3, approved:2, denied:1, note:'David onboarded 2 vendors this quarter (Stripe, Datadog) — both passed review' },
    impact:'If approved without InfoSec review, Acme assumes unassessed data residency and compliance risk. Estimated review time: 5 business days.',
    recommendation:{ action:'Conditional approval', reasoning:'Initiate InfoSec review in parallel. Grant sandbox-only API key immediately so Engineering can begin integration work without production data access.' },
  },
  {
    id:'OP-9135',
    user:'Priya Sharma', initials:'PS', role:'New Hire (Day 3)', dept:'Engineering',
    type:'Software Access Bundle',
    title:'Full Engineering Toolchain Access',
    elapsed:'3 hrs ago',
    urgency:'low', urgencyLabel:'Onboarding — non-blocking',
    conf:52,
    policyConflict: {
      policy:'ONB-01 · New Hire Provisioning',
      rule:'Employees with < 7 days tenure require manager confirmation for access bundles',
      actual:'Priya Sharma joined 3 days ago. Standard 7-day probationary hold applies.',
    },
    why:'Orbit auto-provisions individual tools but the full Engineering bundle (14 tools) triggers the new-hire confirmation gate. This is a standard onboarding friction point, not a risk signal.',
    history: { total:0, approved:0, denied:0, note:'First request — no prior history (new hire)' },
    impact:'If approved, provisions: GitHub, Figma, Linear, Notion, Datadog, Sentry, Slack channels, AWS dev, and 6 others. Standard Engineering baseline.',
    recommendation:{ action:'Approve', reasoning:'Priya's offer letter confirms Software Engineer role. Bundle matches standard Engineering baseline exactly. 100% of similar new-hire bundles were approved by managers in the last 12 months.' },
  }
];

const POLICIES = [
  { name:'SaaS Provisioning',          desc:'Standard tools < $50/mo for eligible roles',       thr:'< $50/mo',     rate:94 },
  { name:'Cloud Quota Adjustment',     desc:'AWS/GCP limit bumps vs. 90-day burn rate',         thr:'≤ 30% bump',   rate:88 },
  { name:'Hardware Refresh',           desc:'Device upgrades based on tenure + device age',     thr:'36-mo cycle',  rate:97 },
  { name:'Expense Reimbursement T1',   desc:'Out-of-pocket within dept travel policy',          thr:'< $200',       rate:99 },
  { name:'Privileged Access (OnCall)', desc:'Temp DB/server access tied to PagerDuty schedule', thr:'On-call only', rate:45 },
  { name:'Contractor Access',          desc:'90-day scoped access for vetted contractors',      thr:'90-day term',  rate:72 },
];

/* ── Nav ── */
function navigate(v) {
  S.view = v;
  document.querySelectorAll('.nav-link').forEach(el => el.classList.toggle('active', el.dataset.view === v));
  render();
}

function setRole(r) {
  S.role = r;
  const u = ROLES[r];
  document.querySelectorAll('.p-tab').forEach(el => el.classList.toggle('active', el.dataset.role === r));
  document.getElementById('avatar').textContent = u.ini;
  document.getElementById('uName').textContent  = u.name;
  document.getElementById('uRole').textContent  = u.title;
  navigate({ employee:'request', manager:'exceptions', admin:'policies', exec:'dashboard' }[r]);
}

function render() {
  const el = document.getElementById('main');
  const w = document.createElement('div');
  w.className = 'view';
  switch(S.view) {
    case 'request':    w.innerHTML = vRequest();    break;
    case 'resolution': w.innerHTML = vResolution(); break;
    case 'exceptions': w.innerHTML = vExceptions(); break;
    case 'policies':   w.innerHTML = vPolicies();   break;
    case 'dashboard':  w.innerHTML = vDashboard();  setTimeout(initChart,50); break;
  }
  el.innerHTML = '';
  el.appendChild(w);
}

/* ═══ EMPLOYEE: Run Operation ═══ */
function vRequest() {
  if (S.reqState === 'evaluating') return vEval();
  if (S.reqState === 'escalated')  return vEscalated();

  const chips = OPS.map(o =>
    `<button class="qchip" onclick="runOp('${o.text.replace(/'/g,"\\'")}',${o.esc})">${o.label}</button>`
  ).join('');

  return `
    <div class="hdr">
      <div class="eyebrow">Operational Autopilot</div>
      <h1 class="h1">What needs to happen?</h1>
      <p class="sub">Describe what you need. Orbit will execute it instantly if policy allows — no manager, no waiting.</p>
    </div>
    <div class="req-box">
      <textarea id="ri" class="req-input" rows="2" placeholder="e.g. I need access to the core-api GitHub repo for the platform migration"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();go()}"></textarea>
      <div class="req-foot">
        <span class="req-hint">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>
          Decision engine active
        </span>
        <button class="btn btn-dark" onclick="go()">Execute<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></button>
      </div>
    </div>
    <div class="quick-row">${chips}</div>

    <div class="card mt-6"><div class="card-body">
      <div class="between" style="margin-bottom:12px">
        <span class="fw6 ts">Today's engine activity</span>
        <span class="latency"><svg class="latency-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>Avg 4.1s</span>
      </div>
      <div class="kv"><span class="kv-label">Autonomously resolved</span><span class="kv-value" style="color:var(--ok)">142</span></div>
      <div class="kv"><span class="kv-label">Escalated to humans</span><span class="kv-value">2</span></div>
      <div class="kv"><span class="kv-label">Manager approvals eliminated</span><span class="kv-value" style="color:var(--ok)">140</span></div>
      <div class="kv"><span class="kv-label">No-touch resolution rate</span><span class="kv-value"><span class="badge b-ok">98.6%</span></span></div>
    </div></div>`;
}

/* ─── Eval Animation ─── */
function vEval() {
  const steps = STEPS.map((s,i) =>
    `<div class="eval-step" id="es${i}"><div class="eval-ico" id="ei${i}"></div><div><div class="eval-title">${s.t}</div><div class="eval-detail" id="ed${i}">Checking...</div></div></div>`
  ).join('');
  setTimeout(runEval, 100);
  return `
    <div class="hdr">
      <div class="eyebrow">Decision Engine</div>
      <h1 class="h1">Executing operation</h1>
      <p class="sub tf">"${S.lastReq}"</p>
    </div>
    ${steps}`;
}

function runEval() {
  let i = 0;
  function tick() {
    if (i > 0) {
      const prev = document.getElementById(`es${i-1}`);
      const pi   = document.getElementById(`ei${i-1}`);
      const pd   = document.getElementById(`ed${i-1}`);
      if(prev){prev.classList.remove('on');prev.classList.add('done')}
      if(pi) pi.innerHTML = chk;
      if(pd) pd.textContent = STEPS[i-1].d;
    }
    if (i >= STEPS.length) { setTimeout(finish, 400); return; }
    const s = document.getElementById(`es${i}`);
    const ic = document.getElementById(`ei${i}`);
    if(s) s.classList.add('on');
    if(ic) ic.innerHTML = '<div class="spin"></div>';
    i++;
    setTimeout(tick, 550);
  }
  tick();
}

const chk = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

function finish() {
  if (S.lastOutcome === 'escalated') { S.reqState = 'escalated'; render(); }
  else { S.reqState = 'resolved'; navigate('resolution'); }
}

/* ─── Escalated ─── */
function vEscalated() {
  return `
    <div class="hdr">
      <div class="eyebrow">Decision Engine</div>
      <h1 class="h1">Exception detected</h1>
      <p class="sub">This operation requires human judgment — routed automatically.</p>
    </div>
    <div class="outcome warn">
      <div class="outcome-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg></div>
      <div>
        <div class="outcome-h">Escalated — manager notified</div>
        <div class="outcome-p">Orbit detected a policy threshold that prevents autonomous execution. Maya Rodriguez can approve this in one click.</div>
      </div>
    </div>
    <div class="card"><div class="card-body">
      <div class="kv"><span class="kv-label">Operation</span><span class="kv-value">${S.lastReq}</span></div>
      <div class="kv"><span class="kv-label">Escalation reason</span><span class="kv-value" style="color:var(--warn)">Privileged access — on-call constraint failed</span></div>
      <div class="kv"><span class="kv-label">Routed to</span><span class="kv-value">Maya Rodriguez · Engineering Manager</span></div>
      <div class="kv"><span class="kv-label">Confidence</span><span class="kv-value"><span class="conf-row"><span class="conf-track"><span class="conf-fill" style="width:26%;background:var(--warn)"></span></span><span class="conf-val" style="color:var(--warn)">26%</span></span></span></div>
    </div></div>
    <div class="mt-4"><button class="btn btn-ghost btn-sm" onclick="S.reqState='idle';render()">Run another operation</button></div>`;
}

/* ─── Contextual resolution data ─── */
const RES_CTX = {
  github: {
    policy:'IT-SC-02', policyName:'Source Control Access', conf:96, action:'GitHub org invite sent via GitHub API',
    reasons:['Employee role (Software Engineer) has baseline access to Engineering org repos','Repository core-api is classified Internal — no elevated clearance required','Team Engineering has 47 active contributors with identical access','No open security incidents on this repository'],
    log:[['Intent parsed','Source control access (GitHub) · Repo: core-api'],['Policy evaluated','IT-SC-02 §2.1 · Org membership + repo classification'],['Confidence scored','96% — exceeds 80% autonomous execution threshold'],['Provisioned','GitHub API → org invite → jordan.davis@acme.com → core-api (write)']]
  },
  mfa: {
    policy:'IT-ID-01', policyName:'Identity Credential Reset', conf:99, action:'Okta MFA token reset via Admin API',
    reasons:['Identity verified via active SSO session (last auth: 12 min ago)','MFA reset is a Tier-0 operation with no cost or access implications','142 identical resets processed autonomously this quarter','Reset does not grant elevated permissions — credential rotation only'],
    log:[['Intent parsed','Credential reset (Okta MFA) · Requester: Jordan Davis'],['Policy evaluated','IT-ID-01 §1.1 · Self-service identity operations'],['Confidence scored','99% — near-deterministic match'],['Executed','Okta Admin API → MFA factor reset → jordan.davis@acme.com']]
  },
  figma: {
    policy:'IT-SW-04', policyName:'SaaS Provisioning', conf:94, action:'Figma seat assigned via Okta SCIM',
    reasons:['Employee role (Software Engineer) is pre-authorized for standard SaaS provisioning','Seat cost ($15/mo) falls below the $50/mo department auto-approval threshold','98 of 100 identical requests were approved by managers in the last 90 days','Application passes SOC 2 Type II security posture requirements'],
    log:[['Intent parsed','SaaS provisioning (Figma) · Requester: Jordan Davis'],['Policy evaluated','IT-SW-04 §3.1 Eligible roles · Cost within threshold'],['Confidence scored','94% — exceeds 80% autonomous execution threshold'],['Provisioned','Okta SCIM API → Figma seat → jordan.davis@acme.com']]
  }
};

function detectCtx(text) {
  const t = (text||'').toLowerCase();
  if (t.includes('github') || t.includes('repo'))  return RES_CTX.github;
  if (t.includes('mfa') || t.includes('okta') || t.includes('reset')) return RES_CTX.mfa;
  return RES_CTX.figma;
}

/* ═══ RESOLUTION ═══ */
function vResolution() {
  const req = S.lastReq || 'Grant access to core-api repo for platform migration';
  const c = detectCtx(req);
  const logHtml = c.log.map(l => `<div class="audit-item"><div class="audit-dot"></div><div><div class="audit-t">${l[0]} · 10:42</div><div class="audit-d">${l[1]}</div></div></div>`).join('');
  const reasonHtml = c.reasons.map(r => `<li>${r}</li>`).join('');

  return `
    <div class="hdr">
      <div class="between">
        <div>
          <div class="eyebrow">OP-9143</div>
          <h1 class="h1">Resolved autonomously</h1>
        </div>
        <div class="row gap-2">
          <span class="latency"><svg class="latency-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>4.2 sec</span>
          <button class="btn btn-ghost btn-sm" onclick="S.reqState='idle';navigate('request')">New operation</button>
        </div>
      </div>
    </div>

    <div class="outcome ok">
      <div class="outcome-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div>
      <div>
        <div class="outcome-h">Auto-provisioned · No manager required</div>
        <div class="outcome-p">Policy validated in 2.1 seconds. Provisioning executed in 4.2 seconds total. Saved ~3.5 hours of wait time vs. manual approval.</div>
      </div>
    </div>

    <div class="card"><div class="card-body">
      <div class="kv"><span class="kv-label">Operation</span><span class="kv-value">${req}</span></div>
      <div class="kv"><span class="kv-label">Policy matched</span><span class="kv-value"><span class="badge b-accent">${c.policy}</span> ${c.policyName}</span></div>
      <div class="kv"><span class="kv-label">Confidence</span><span class="kv-value"><span class="conf-row"><span class="conf-track"><span class="conf-fill" style="width:${c.conf}%"></span></span><span class="conf-val" style="color:var(--ok)">${c.conf}%</span></span></span></div>
      <div class="kv"><span class="kv-label">Action taken</span><span class="kv-value">${c.action}</span></div>
      <div class="kv"><span class="kv-label">Manager approval</span><span class="kv-value" style="color:var(--ok)">Skipped — prior pattern match</span></div>
    </div></div>

    <div class="reason mt-4">
      <div class="reason-label">Why Orbit resolved this autonomously</div>
      <ul class="reason-list">${reasonHtml}</ul>
    </div>

    <div class="mt-6">
      <div class="fw6 ts" style="margin-bottom:14px">Execution log</div>
      ${logHtml}
    </div>`;
}

/* ═══ MANAGER: Exception Review ═══ */
function vExceptions() {
  const urgencyColors = { high:'var(--err)', medium:'var(--warn)', low:'var(--t3)' };
  const urgencyBg     = { high:'var(--err-s)', medium:'var(--warn-s)', low:'var(--raised)' };
  const urgencyBorder = { high:'var(--err-m)', medium:'var(--warn-m)', low:'var(--border)' };
  const confColor = c => c < 35 ? 'var(--err)' : c < 60 ? 'var(--warn)' : 'var(--ok)';

  const cards = EXCEPTIONS.map(e => `
    <div class="exc-card">
      <!-- Header -->
      <div class="exc-header">
        <div class="exc-header-left">
          <div class="exc-avatar">${e.initials}</div>
          <div>
            <div class="exc-title">${e.title}</div>
            <div class="exc-meta">${e.user} · ${e.role} · ${e.dept} · ${e.elapsed}</div>
          </div>
        </div>
        <div class="row gap-2">
          <span class="urgency-pill" style="background:${urgencyBg[e.urgency]};color:${urgencyColors[e.urgency]};border-color:${urgencyBorder[e.urgency]}">${e.urgencyLabel}</span>
          <span class="badge b-warn">${e.id}</span>
        </div>
      </div>

      <!-- Confidence + Type -->
      <div class="exc-strip">
        <div class="exc-strip-item">
          <span class="exc-strip-label">Confidence</span>
          <span class="conf-row" style="width:120px">
            <span class="conf-track"><span class="conf-fill" style="width:${e.conf}%;background:${confColor(e.conf)}"></span></span>
            <span class="conf-val" style="color:${confColor(e.conf)}">${e.conf}%</span>
          </span>
        </div>
        <div class="exc-strip-item">
          <span class="exc-strip-label">Type</span>
          <span class="fw5">${e.type}</span>
        </div>
        <div class="exc-strip-item">
          <span class="exc-strip-label">Prior requests</span>
          <span class="fw5">${e.history.total > 0 ? e.history.approved + '/' + e.history.total + ' approved' : 'None (new hire)'}</span>
        </div>
      </div>

      <!-- Body -->
      <div class="exc-body">
        <!-- Policy Conflict -->
        <div class="exc-section">
          <div class="exc-section-label">Policy conflict</div>
          <div class="policy-conflict">
            <div class="pc-row"><span class="pc-label">Policy</span><span class="pc-value">${e.policyConflict.policy}</span></div>
            <div class="pc-row"><span class="pc-label">Rule</span><span class="pc-value">${e.policyConflict.rule}</span></div>
            <div class="pc-row pc-violation"><span class="pc-label">Violation</span><span class="pc-value">${e.policyConflict.actual}</span></div>
          </div>
        </div>

        <!-- Why Orbit escalated -->
        <div class="exc-section">
          <div class="exc-section-label">Why Orbit escalated this</div>
          <p class="ts tm">${e.why}</p>
        </div>

        ${e.history.note ? `
        <!-- Prior History -->
        <div class="exc-section">
          <div class="exc-section-label">Prior approval history</div>
          <p class="ts tm">${e.history.note}</p>
        </div>` : ''}

        <!-- Operational Impact -->
        <div class="exc-section">
          <div class="exc-section-label">Operational impact</div>
          <p class="ts tm">${e.impact}</p>
        </div>

        <!-- AI Recommendation -->
        <div class="ai-rec">
          <div class="ai-rec-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>
            Orbit recommends: <strong>${e.recommendation.action}</strong>
          </div>
          <p class="ai-rec-text">${e.recommendation.reasoning}</p>
        </div>
      </div>

      <!-- Actions -->
      <div class="exc-actions">
        <button class="btn btn-ok" onclick="approveExc('${e.id}', '${e.recommendation.action}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          ${e.recommendation.action}
        </button>
        <button class="btn btn-err btn-sm" onclick="denyExc('${e.id}')">Deny</button>
        <button class="btn btn-ghost btn-sm" onclick="toast('Clarification requested from ${e.user}.')">Request info</button>
      </div>
    </div>
  `).join('');

  return `
    <div class="hdr">
      <div class="eyebrow">Manager · Exception Review</div>
      <h1 class="h1">3 decisions need you today</h1>
      <p class="sub">Orbit autonomously resolved 139 operations. These exceptions require your judgment because the engine detected ambiguity it cannot resolve alone.</p>
    </div>

    <div class="relief">
      <div class="relief-num">139</div>
      <div>
        <div class="relief-h">Operations resolved without you</div>
        <div class="relief-p">You were not interrupted for any of them. Orbit only surfaces cases where policy conflict, insufficient precedent, or risk thresholds prevent autonomous execution.</div>
      </div>
    </div>

    ${cards}`;
}

function approveExc(id, action) {
  toast(id + ' — ' + action + '. Provisioning initiated.');
  const badge = document.getElementById('reviewBadge');
  if (badge) { const n = parseInt(badge.textContent) - 1; badge.textContent = Math.max(0, n); }
}
function denyExc(id) {
  toast(id + ' denied. Requester notified with policy reasoning.');
}

/* ═══ ADMIN: Policies ═══ */
function vPolicies() {
  const rows = POLICIES.map(p => `
    <div class="pol-row">
      <div><div class="pol-name">${p.name}</div><div class="pol-desc">${p.desc}</div></div>
      <div class="pol-thr">${p.thr}</div>
      <div class="pol-rate">${p.rate}%</div>
      <div><label class="toggle"><input type="checkbox" ${p.rate > 50 ? 'checked' : ''}><div class="toggle-t"></div></label></div>
    </div>`).join('');

  return `
    <div class="hdr">
      <div class="between">
        <div>
          <div class="eyebrow">Admin · Decision Infrastructure</div>
          <h1 class="h1">Policy Engine</h1>
          <p class="sub">These policies power autonomous execution. 88% of all operations resolve without any human.</p>
        </div>
        <button class="btn btn-dark btn-sm">Add policy</button>
      </div>
    </div>

    <div class="pol-table">
      <div class="pol-head"><span>Policy</span><span>Threshold</span><span>Auto-Resolve</span><span>Active</span></div>
      ${rows}
    </div>

    <div class="card mt-6"><div class="card-body">
      <div class="fw6 ts" style="margin-bottom:12px">Engine coverage — May 2026</div>
      <div class="kv"><span class="kv-label">Total operations evaluated</span><span class="kv-value">4,281</span></div>
      <div class="kv"><span class="kv-label">Resolved autonomously</span><span class="kv-value" style="color:var(--ok)">3,784 (88.4%)</span></div>
      <div class="kv"><span class="kv-label">Escalated to humans</span><span class="kv-value">497 (11.6%)</span></div>
      <div class="kv"><span class="kv-label">Manager hours eliminated</span><span class="kv-value" style="color:var(--ok)">342 hrs</span></div>
    </div></div>`;
}

/* ═══ EXEC: Impact ═══ */
function vDashboard() {
  return `
    <div class="hdr">
      <div class="eyebrow">Executive · May 2026</div>
      <h1 class="h1">Operational Impact</h1>
      <p class="sub">Orbit has reduced managerial overhead by 88% across Engineering and Operations this month.</p>
    </div>

    <div class="metrics">
      <div class="m-card"><div class="m-label">Autonomous Resolution Rate</div><div class="m-value">88.4%</div><div class="m-delta">↑ 4.2% vs April</div></div>
      <div class="m-card"><div class="m-label">Manager Hours Eliminated</div><div class="m-value">342 hrs</div><div class="m-delta">↑ 12% vs April</div></div>
      <div class="m-card"><div class="m-label">Median Execution Latency</div><div class="m-value">4.1 sec</div><div class="m-delta">↓ from 3.5 days (manual)</div></div>
    </div>

    <div class="chart-wrap">
      <div class="chart-h">
        <div><div class="chart-t">Autonomous execution vs. human involvement</div><div class="chart-s">Daily volume · All departments</div></div>
        <span class="badge b-ok">88% autonomous</span>
      </div>
      <div class="chart-cv"><canvas id="cx"></canvas></div>
    </div>

    <div class="card mt-4"><div class="card-body">
      <div class="fw6 ts" style="margin-bottom:12px">Top autonomous categories</div>
      <div class="kv"><span class="kv-label">Expense Reimbursement (T1)</span><span class="kv-value"><span class="badge b-ok">99% autonomous</span></span></div>
      <div class="kv"><span class="kv-label">Hardware Refresh</span><span class="kv-value"><span class="badge b-ok">97% autonomous</span></span></div>
      <div class="kv"><span class="kv-label">SaaS Provisioning</span><span class="kv-value"><span class="badge b-ok">94% autonomous</span></span></div>
      <div class="kv"><span class="kv-label">Cloud Quota Adjustment</span><span class="kv-value"><span class="badge b-ok">88% autonomous</span></span></div>
      <div class="kv"><span class="kv-label">Contractor Access</span><span class="kv-value"><span class="badge b-warn">72% autonomous</span></span></div>
    </div></div>`;
}

function initChart() {
  const c = document.getElementById('cx');
  if (!c || S.charts.main) return;
  S.charts.main = new Chart(c, {
    type:'bar',
    data:{
      labels:['May 1','May 5','May 9','May 13','May 15'],
      datasets:[
        { label:'Autonomous', data:[142,165,178,155,144], backgroundColor:'#09090b', borderRadius:4, borderSkipped:false },
        { label:'Human review', data:[18,22,15,12,8], backgroundColor:'#e4e4e7', borderRadius:4, borderSkipped:false }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'bottom', labels:{ boxWidth:10, usePointStyle:true, padding:20, font:{ size:12, family:"'Inter',sans-serif" } } } },
      scales:{
        x:{ grid:{ display:false }, border:{ display:false }, ticks:{ font:{ size:11 } } },
        y:{ beginAtZero:true, grid:{ color:'#f4f4f5' }, border:{ display:false }, ticks:{ font:{ size:11 } } }
      }
    }
  });
}

/* ─── Helpers ─── */
function go() {
  const v = document.getElementById('ri')?.value?.trim();
  if (!v) return;
  const esc = /prod|vendor|admin|security/i.test(v);
  runOp(v, esc);
}

function runOp(text, esc) {
  S.lastReq = text;
  S.lastOutcome = esc ? 'escalated' : 'resolved';
  S.reqState = 'evaluating';
  S.charts = {};
  navigate('request');
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

document.addEventListener('DOMContentLoaded', render);
