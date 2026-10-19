// Single choke point for Gemini calls: error classification, retries, serialization and spacing.
// Keys are read from process.env inside the functions, never at import time.
// Keys stay server-side only and are never sent to the client.
import { GoogleGenAI } from '@google/genai';

export class AIServiceError extends Error {
  constructor(message, status = 502, code = 'ai_upstream') {
    super(message);
    this.name = 'AIServiceError';
    this.status = status;
    this.code = code;
  }
}

const DEFAULT_MODEL = 'gemini-flash-latest';

const ERRORS = {
  ai_daily_quota: [429, "You've used today's free Gemini quota. It resets at midnight Pacific time — please try again after that."],
  ai_minute_quota: [429, 'Gemini is rate-limiting requests (per-minute limit). Wait a minute and try again.'],
  ai_overloaded: [503, 'Gemini is overloaded right now (high demand). Please try again in a moment.'],
  ai_timeout: [504, 'Gemini took too long to respond. Please try again.'],
  ai_upstream: [502, 'Gemini hit an internal error. Please try again in a moment.'],
  ai_bad_response: [502, 'Gemini returned an unreadable response. Please try again.'],
  ai_rejected: [502, 'Gemini rejected the request'],
  ai_not_configured: [503, 'GEMINI_API_KEY is not set. Add it to server/.env to enable AI features.'],
};

// `detail` must already be redacted; only ai_rejected shows it to the user.
export function aiError(code, detail) {
  const [status, message] = ERRORS[code] || ERRORS.ai_upstream;
  const text = code === 'ai_rejected' ? `${message}: ${String(detail || 'unknown error').slice(0, 200)}` : message;
  return new AIServiceError(text, status, ERRORS[code] ? code : 'ai_upstream');
}

const envStr = (name) => (process.env[name] || '').trim();

function envInt(name, def) {
  const v = envStr(name);
  if (!v) return def;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

export function modelFor(purpose = 'default') {
  const base = envStr('GEMINI_MODEL') || DEFAULT_MODEL;
  if (purpose === 'parse') return envStr('GEMINI_PARSE_MODEL') || base;
  if (purpose === 'judge') return envStr('GEMINI_JUDGE_MODEL') || base;
  return base;
}

// "7s" / "7.05s" -> ms
const delayToMs = (s) => {
  const m = /^(\d+(?:\.\d+)?)s$/.exec(String(s || '').trim());
  return m ? Math.round(Number(m[1]) * 1000) : undefined;
};

function parseBody(message) {
  if (typeof message !== 'string') return null;
  try {
    return JSON.parse(message);
  } catch {
    const a = message.indexOf('{');
    const b = message.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    try {
      return JSON.parse(message.slice(a, b + 1));
    } catch {
      return null;
    }
  }
}

// Pure: maps any thrown SDK/network error to { code, retryDelayMs?, detail }.
export function classifyGeminiError(err) {
  const strs = [err?.message, err?.cause?.message, err?.cause?.code, err?.code].filter((x) => typeof x === 'string');
  const lower = strs.join(' ').toLowerCase();
  const body = parseBody(err?.message);
  const apiMsg = typeof body?.error?.message === 'string' ? body.error.message : undefined;
  const status = Number.isInteger(err?.status)
    ? err.status
    : Number.isInteger(body?.error?.code)
      ? body.error.code
      : undefined;
  const detail = apiMsg || err?.message || String(err);
  const codeStr = [err?.code, err?.cause?.code].filter((x) => typeof x === 'string').join(' ');

  // Our httpOptions.timeout aborts fetch; network failures surface as "fetch failed" + cause.code.
  if (
    ['AbortError', 'TimeoutError'].includes(err?.name) ||
    status === 408 ||
    status === 504 ||
    (status === undefined &&
      (/TIMEOUT|ECONNRESET|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|UND_ERR/i.test(codeStr) ||
        /fetch failed|socket hang up|network|aborted|timed out|deadline/.test(lower)))
  ) {
    return { code: 'ai_timeout', detail };
  }

  // Text fallbacks only when the status is missing (the SDK sometimes strips it) — a known 4xx/5xx
  // whose message merely mentions "quota"/"unavailable" must keep its own class.
  const noStatus = status === undefined;
  if (status === 429 || (noStatus && /resource_exhausted|quota|rate limit|too many requests/.test(lower))) {
    let daily = false;
    let minute = false;
    let retryDelayMs;
    const details = Array.isArray(body?.error?.details) ? body.error.details : [];
    for (const d of details) {
      const ms = delayToMs(d?.retryDelay);
      if (ms !== undefined) retryDelayMs = ms;
      for (const v of Array.isArray(d?.violations) ? d.violations : []) {
        const id = String(v?.quotaId || '').toLowerCase();
        if (id.includes('perday')) daily = true;
        else if (id.includes('perminute')) minute = true;
      }
    }
    if (lower.includes('perday') || lower.includes('per day')) daily = true;
    if (lower.includes('perminute') || lower.includes('per minute')) minute = true;
    // A zero allowance never recovers by waiting.
    if (/limit:\s*0(\D|$)/.test(lower)) daily = true;
    if (daily) return { code: 'ai_daily_quota', detail };
    return { code: 'ai_minute_quota', retryDelayMs, detail };
  }

  if (status === 503 || ((noStatus || status >= 500) && /overloaded|high demand|unavailable/.test(lower))) {
    return { code: 'ai_overloaded', detail };
  }
  if (status >= 500) return { code: 'ai_upstream', detail };
  if (status >= 400 && status < 500) return { code: 'ai_rejected', detail };
  return { code: 'ai_upstream', detail };
}

// ---- serialization + spacing: never two Gemini requests in flight ----
let queue = Promise.resolve();
let lastEndAt = 0;

function enqueue(task) {
  const run = queue.then(task);
  queue = run.catch(() => {}); // a failure must not poison later calls
  return run;
}

const sleep = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

const OVERLOAD_DELAYS = [2000, 6000, 15000];

// thinkingLevel ('MINIMAL'|'LOW'|'MEDIUM'|'HIGH', Gemini 3+ models): omitted = the model's default.
export function callGemini({ model, contents, responseSchema, temperature, thinkingLevel }) {
  const apiKey = envStr('GEMINI_API_KEY');
  if (!apiKey) return Promise.reject(aiError('ai_not_configured'));
  const useModel = model || modelFor('default');
  const redact = (s) => String(s).split(apiKey).join('[redacted]');
  const spacing = envInt('GEMINI_MIN_SPACING_MS', 6000);
  const timeout = envInt('GEMINI_REQUEST_TIMEOUT_MS', 90000);

  // The whole call (all attempts + parse) is one queued task.
  return enqueue(async () => {
    // attempts: 1 = the SDK never retries; this gateway owns retries.
    const client = new GoogleGenAI({ apiKey, httpOptions: { timeout, retryOptions: { attempts: 1 } } });
    let attempt = 0;
    let waitMs = 0;
    let minuteRetries = 0;
    let overloadRetries = 0;
    let timeoutRetries = 0;
    for (;;) {
      attempt += 1;
      await sleep(Math.max(waitMs, lastEndAt + spacing - Date.now(), 0));
      let response;
      try {
        response = await client.models.generateContent({
          model: useModel,
          contents,
          config: {
            responseMimeType: 'application/json',
            responseSchema,
            ...(temperature !== undefined && { temperature }),
            ...(thinkingLevel && { thinkingConfig: { thinkingLevel } }),
          },
        });
      } catch (err) {
        const c = classifyGeminiError(err);
        const detail = redact(c.detail);
        console.error(`[aiGateway] ${useModel} attempt ${attempt} -> ${c.code}: ${detail.slice(0, 300)}`);
        if (c.code === 'ai_minute_quota' && minuteRetries < 1) {
          minuteRetries += 1;
          waitMs = Math.min(c.retryDelayMs ?? 10000, 20000);
        } else if ((c.code === 'ai_overloaded' || c.code === 'ai_upstream') && overloadRetries < OVERLOAD_DELAYS.length) {
          waitMs = OVERLOAD_DELAYS[overloadRetries];
          overloadRetries += 1;
        } else if (c.code === 'ai_timeout' && timeoutRetries < 1) {
          timeoutRetries += 1;
          waitMs = 1000;
        } else {
          throw aiError(c.code, detail);
        }
        continue;
      } finally {
        lastEndAt = Date.now(); // spacing is measured from the END of the previous request
      }
      const text = response?.text;
      if (!text || !text.trim()) throw aiError('ai_bad_response');
      try {
        return JSON.parse(text);
      } catch {
        throw aiError('ai_bad_response');
      }
    }
  });
}
