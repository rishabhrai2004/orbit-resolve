import axios from 'axios';

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL;
const GEMINI_ENDPOINT = process.env.GEMINI_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta2/models';

if (!GEMINI_KEY) {
  console.warn('GEMINI_API_KEY not set — AI features disabled');
}

const extractText = (data) => {
  // Try common shapes returned by generative APIs
  if (!data) return '';
  if (data.output && Array.isArray(data.output) && data.output.length) {
    return data.output.map(o => (o.content || o.text || o)).join('\n');
  }
  if (data.candidates && Array.isArray(data.candidates) && data.candidates[0]) {
    return data.candidates[0].content || data.candidates[0].output || data.candidates[0].text || '';
  }
  if (typeof data === 'string') return data;
  return JSON.stringify(data);
};

export async function generateRecommendation(orgId, request) {
  if (!GEMINI_KEY || !GEMINI_MODEL) {
    return { text: 'AI not configured', meta: {} };
  }

  const prompt = `Organization: ${orgId}\nRequest Title: ${request.title}\nType: ${request.type}\nUrgency: ${request.urgency}\nDescription: ${request.description || ''}\nProvide a concise risk assessment (score 0-100) and a short recommendation for approval or denial.`;

  const isApiKey = GEMINI_KEY && GEMINI_KEY.startsWith('AIza');

  // Try a small set of candidate model names (configured model first)
  const fallbackModels = (process.env.GEMINI_FALLBACK_MODELS || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  const candidates = [GEMINI_MODEL, ...fallbackModels].filter(Boolean);
  let finalResp = null;
  let usedModel = null;
  let lastError = null;

  for (const candidate of candidates) {
    let url = `${GEMINI_ENDPOINT}/${encodeURIComponent(candidate)}:generate`;
    if (isApiKey) url += `?key=${encodeURIComponent(GEMINI_KEY)}`;

    try {
      const resp = await axios.post(
        url,
        {
          prompt: { text: prompt },
          maxOutputTokens: 512,
        },
        {
          headers: isApiKey
            ? { 'Content-Type': 'application/json' }
            : { Authorization: `Bearer ${GEMINI_KEY}`, 'Content-Type': 'application/json' },
          timeout: Number(process.env.AI_TIMEOUT_MS || 1500),
        }
      );

      finalResp = resp.data;
      usedModel = candidate;
      break;
    } catch (err) {
      lastError = err;
      // continue to next candidate
    }
  }

  if (finalResp) {
    const text = extractText(finalResp);
    return { text, meta: { model: usedModel } };
  }

  // All external attempts failed — produce a deterministic fallback recommendation
  const errMsg = lastError && lastError.response ? `${lastError.response.status} ${lastError.response.statusText}` : lastError?.message || 'unknown error';
  console.warn('AI generation failed for all candidates:', errMsg);

  const score = request?.confidence ?? null;
  const reasons = [];
  if (typeof score === 'number') {
    if (score >= 70) reasons.push('High confidence — auto-approval suggested');
    else if (score >= 40) reasons.push('Moderate confidence — manager review suggested');
    else reasons.push('Low confidence — recommend denial or additional validation');
  } else {
    reasons.push('Insufficient scoring data — manual review advised');
  }
  if (request.urgency === 'high') reasons.push('Urgency flagged');

  const fallbackRecommendation = {
    action: typeof score === 'number' ? (score >= 70 ? 'Auto-approve' : score >= 40 ? 'Manager review' : 'Deny or validate') : 'Manual review',
    reasoning: reasons.join('; '),
    confidence: score ?? 'n/a',
    next_steps: [
      'Verify requester identity and business justification',
      'Confirm policy owner sign-off if unsure',
      'If granting, scope access and set short expiry'
    ]
  };

  const fallbackText = `Fallback recommendation (no AI): ${fallbackRecommendation.action} — ${fallbackRecommendation.reasoning} (confidence=${fallbackRecommendation.confidence})`;

  return { text: fallbackText, meta: { error: errMsg, fallback: fallbackRecommendation } };
}

export default { generateRecommendation };
