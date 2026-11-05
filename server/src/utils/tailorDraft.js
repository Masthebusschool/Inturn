// Pure helpers for the tailoring chat and draft re-scoring: sanitising the editable draft, picking
// which draft section a weak requirement belongs to, and deterministic guards on the model's
// suggestions. No AI, DB or env here, so every guard is testable and the model can't talk past it.
import { randomUUID } from 'node:crypto';
import { wordsOf, evidenceFound } from './skillGapScoring.js';
import { canonical, normalize, ALIASES } from './skillNormalize.js';

export const OVERRIDE_VALUES = ['confirmed_have', 'confirmed_missing'];

const MAX_TEXT = 1500;
const MAX_SKILLS = 60;
const MAX_ENTRIES = 15;
const MAX_BULLETS = 15;
const MAX_TARGETS = 6;
const MAX_SUGGESTIONS = 4;

const clip = (v) => (typeof v === 'string' ? v.trim().slice(0, MAX_TEXT) : '');
const objs = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);
const clipList = (v, max) => (Array.isArray(v) ? v.map(clip).filter(Boolean).slice(0, max) : []);

export function cleanDraft(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  return {
    summary: clip(d.summary),
    skills: clipList(d.skills, MAX_SKILLS),
    experience: objs(d.experience).slice(0, MAX_ENTRIES).map((e) => ({
      title: clip(e.title), company: clip(e.company), bullets: clipList(e.bullets, MAX_BULLETS),
    })),
    projects: objs(d.projects).slice(0, MAX_ENTRIES).map((p) => ({
      name: clip(p.name), bullets: clipList(p.bullets, MAX_BULLETS),
    })),
  };
}

// Education isn't part of the editable draft; it comes from the saved profile so the scorer still sees it.
export function draftToProfile(draft, education) {
  const d = draft || {};
  return {
    summary: d.summary || '',
    skills: d.skills || [],
    experience: (d.experience || []).map((e) => ({ title: e.title, company: e.company, bullets: e.bullets })),
    projects: (d.projects || []).map((p) => ({ name: p.name, bullets: p.bullets })),
    education: education || [],
  };
}

export function cleanOverrides(raw, validKeys) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (validKeys.has(k) && OVERRIDE_VALUES.includes(v)) out[k] = v;
  }
  return out;
}

// Labelled with the section ids that suggestions must target.
export function draftPromptText(draft) {
  const d = draft || {};
  const lines = [];
  if (d.summary) lines.push(`[summary] ${d.summary}`);
  if (d.skills?.length) lines.push(`[skills] ${d.skills.join(', ')}`);
  (d.experience || []).forEach((e, i) => {
    lines.push(`[experience:${i}] ${[e.title, e.company].filter(Boolean).join(' — ')}`);
    (e.bullets || []).forEach((b) => lines.push(`  - ${b}`));
  });
  (d.projects || []).forEach((p, i) => {
    lines.push(`[project:${i}] ${p.name || ''}`.trimEnd());
    (p.bullets || []).forEach((b) => lines.push(`  - ${b}`));
  });
  return lines.join('\n');
}

const STOPWORDS = new Set([
  'and', 'the', 'for', 'with', 'from', 'that', 'this', 'have', 'has', 'are', 'was', 'any', 'all', 'you', 'our',
  'your', 'use', 'using', 'used', 'such', 'into', 'will', 'can', 'able', 'work', 'working', 'experience', 'knowledge',
  'skills', 'strong', 'good', 'understanding', 'ability',
]);
const contentWords = (s) => [...new Set(wordsOf(s).split(' ').filter((w) => w.length >= 3 && !STOPWORDS.has(w)))];

// Group weak requirements by the draft section they live in: one rewrite of a section can lift
// several co-located gaps, so the model should reason per section, not per skill.
export function resolveFocus(requirements, focusKeys, sections) {
  const byKey = new Map((requirements || []).map((r) => [r.key, r]));
  const targets = [];
  const seen = new Set();
  for (const k of focusKeys || []) {
    const r = byKey.get(k);
    if (!r || r.verdict === 'met' || seen.has(k)) continue;
    seen.add(k);
    targets.push(r);
    if (targets.length >= MAX_TARGETS) break;
  }

  const nonEdu = sections.filter((s) => s.kind !== 'education');
  const entrySecs = nonEdu.filter((s) => s.kind === 'experience' || s.kind === 'project');
  const summary = nonEdu.find((s) => s.kind === 'summary');
  const secWords = new Map(nonEdu.map((s) => [s.id, wordsOf(s.text)]));
  const entryWordSets = new Map(entrySecs.map((s) => [s.id, new Set(secWords.get(s.id).split(' '))]));

  const groups = [];
  const ungrounded = [];
  for (const t of targets) {
    let sec = t.evidence ? nonEdu.find((s) => evidenceFound(secWords.get(s.id), t.evidence)) : null;
    if (!sec) {
      const words = contentWords(t.text);
      let best = 0;
      for (const s of entrySecs) {
        const hits = words.filter((w) => entryWordSets.get(s.id).has(w)).length;
        if (hits > best) { best = hits; sec = s; }
      }
    }
    if (!sec && summary && (t.category === 'soft_skill' || t.category === 'responsibility')) sec = summary;
    if (!sec) { ungrounded.push(t); continue; }
    let g = groups.find((x) => x.sectionId === sec.id);
    if (!g) { g = { sectionId: sec.id, sectionText: sec.text, targets: [] }; groups.push(g); }
    g.targets.push(t);
  }
  return { targets, groups, ungrounded };
}

const PLACEHOLDER_RES = [
  /\[[^\]]*[A-Za-z][^\]]*\]/, // [Company Name], [X], [insert metric]
  /\{\{[^}]*\}\}/,
  /\b(?:TODO|TBD)\b/,
  /_{3,}/,
  /\binsert (?:your |the |a |an )?\w+/i,
  /(?:^|[^\w])[XNY]{1,2} ?%/, // "by X%"
  /<[^<>]*\b(?:insert|your|company|name|number|metric|tool)\b[^<>]*>/i, // plain "<50ms" must not match
];

// Backstop for the prompt rule: a line with a hole in it is never safe to paste.
export function hasPlaceholder(text) {
  const s = String(text ?? '');
  return PLACEHOLDER_RES.some((re) => re.test(s));
}

const hasWord = (haystackWords, words) => Boolean(words) && ` ${haystackWords} `.includes(` ${words} `);

// Skills whose words never appear in supportText (e.g. a profileSnapshot): the AI made them up.
// Same rule cleanSuggestions applies to the skills field.
export function unsupportedSkills(skills, supportText) {
  const supportWords = wordsOf(supportText);
  return (Array.isArray(skills) ? skills : []).filter((sk) => !hasWord(supportWords, wordsOf(sk)));
}

// Named products/languages the model likes to "helpfully" add (live test: it slipped PostgreSQL into a
// summary as "a standard pairing"). Practices (CI/CD, REST, OOP) are left out on purpose, and so are
// words that are also plain English (go, react, express, spring, swift, excel) to avoid false rejects.
const TECH_TERMS = [
  'python', 'java', 'javascript', 'typescript', 'golang', 'rust', 'kotlin', 'ruby', 'php', 'scala', 'cplusplus', 'csharp',
  'matlab', 'dart', 'sql', 'mysql', 'postgresql', 'sqlite', 'mongodb', 'redis', 'cassandra', 'dynamodb', 'elasticsearch',
  'firebase', 'supabase', 'snowflake', 'bigquery', 'angular', 'vue', 'svelte', 'nextjs', 'nuxtjs', 'nodejs', 'django',
  'flask', 'fastapi', 'laravel', 'dotnet', 'aspnet', 'tensorflow', 'pytorch', 'keras', 'pandas', 'numpy', 'scikit learn',
  'spark', 'hadoop', 'kafka', 'rabbitmq', 'graphql', 'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform', 'ansible',
  'jenkins', 'github actions', 'gitlab', 'circleci', 'nginx', 'linux', 'heroku', 'vercel', 'netlify', 'selenium', 'cypress',
  'pytest', 'junit', 'tableau', 'power bi', 'figma', 'tailwind', 'webpack',
];

// normalize() keeps "node.js"/"c++" as single tokens; per-token aliases make "Postgres" support "PostgreSQL".
const techWords = (s) => normalize(s).split(' ').map((t) => (ALIASES[t] ? normalize(ALIASES[t]) : t)).join(' ');

// Named technologies in `text` that the student never stated (supportTech = techWords of everything they did state).
// Returned as written in `text` when possible ("PostgreSQL", not "postgresql") since the student sees them.
export function unsupportedTech(text, supportTech) {
  const words = techWords(text);
  return TECH_TERMS
    .filter((t) => hasWord(words, t) && !hasWord(supportTech, t))
    .map((t) => new RegExp(`\\b${t.replace(/ /g, '\\s+')}\\b`, 'i').exec(text)?.[0] || t);
}

// Deterministic guards on the model's raw suggestions. Rejects rather than repairs: a sentence with a
// hole cut out of it is broken. supportText = everything the student has stated (saved profile, their
// draft, their chat messages); `unsupportedTerms` lets the caller tell the student what was left out and why.
export function cleanSuggestions(raw, draft, { validKeys, supportText }) {
  const rejected = { placeholder: 0, unmatched: 0, unsupported: 0 };
  const unsupportedTerms = [];
  const supportWords = wordsOf(supportText);
  const supportSet = new Set(supportWords.split(' '));
  const supportTech = techWords(supportText);
  const suggestions = [];
  const have = new Set((draft.skills || []).map(canonical));

  for (const item of Array.isArray(raw) ? raw : []) {
    if (suggestions.length >= MAX_SUGGESTIONS) break;
    if (!item || typeof item !== 'object') continue;
    const sectionId = typeof item.sectionId === 'string' ? item.sectionId.trim() : '';
    const field = item.field;
    const requirementKeys = (Array.isArray(item.requirementKeys) ? item.requirementKeys : []).filter((k) => validKeys.has(k));

    // A whole new role/project: no `text`, its content is title/company/bullets.
    if (field === 'entry') {
      const kind = /^(experience|project):new$/.exec(sectionId)?.[1];
      if (!kind) { rejected.unmatched++; continue; }
      const title = clip(item.title);
      const company = kind === 'experience' ? clip(item.company) : '';
      const bullets = clipList(item.bullets, MAX_BULLETS);
      if (!title || !bullets.length) continue;
      if ([title, company, ...bullets].some(hasPlaceholder)) { rejected.placeholder++; continue; }

      const existing = ((kind === 'experience' ? draft.experience : draft.projects) || [])
        .map((e) => ({ title: kind === 'experience' ? e.title : e.name, company: e.company }));
      const pending = suggestions.filter((s) => s.sectionId === sectionId);
      if (existing.length + pending.length >= MAX_ENTRIES) { rejected.unmatched++; continue; }
      // Already in the draft: the model should have targeted that entry with a "bullet" instead.
      const same = (e) => wordsOf(e.title) === wordsOf(title) && (kind !== 'experience' || wordsOf(e.company) === wordsOf(company));
      if (existing.some(same) || pending.some(same)) { rejected.unmatched++; continue; }

      // Token-level, not whole-phrase: "CCA Attendance Telegram Bot" passes when the student said "a Telegram bot
      // for my CCA that tracks attendance", while a made-up employer whose words they never said is rejected.
      const unsupportedNames = [title, company].filter((n) => n && wordsOf(n).split(' ').some((t) => !supportSet.has(t)));
      if (unsupportedNames.length) { rejected.unsupported++; unsupportedTerms.push(...unsupportedNames); continue; }

      const inventedTech = unsupportedTech([title, company, ...bullets].join('\n'), supportTech);
      if (inventedTech.length) { rejected.unsupported++; unsupportedTerms.push(...inventedTech); continue; }

      suggestions.push({
        id: randomUUID().slice(0, 8), sectionId, field, original: '', text: '', title, company, bullets, requirementKeys,
      });
      continue;
    }

    let text = clip(item.text);
    if (!text) continue;
    if (hasPlaceholder(text)) { rejected.placeholder++; continue; }

    let original = '';

    if (field === 'summary' && sectionId === 'summary') {
      original = draft.summary || '';
    } else if (field === 'skills' && sectionId === 'skills') {
      const kept = [];
      let unsupported = false;
      for (const s of text.split(',').map((x) => x.trim()).filter(Boolean)) {
        const c = canonical(s);
        if (have.has(c) || kept.some((k) => canonical(k) === c)) continue;
        if (!hasWord(supportWords, wordsOf(s))) { unsupported = true; unsupportedTerms.push(s); continue; }
        kept.push(s);
      }
      if (unsupported) rejected.unsupported++;
      if (!kept.length) continue;
      text = kept.join(', ');
    } else if (field === 'bullet') {
      const m = /^(experience|project):(\d+)$/.exec(sectionId);
      const entry = m && (m[1] === 'experience' ? draft.experience : draft.projects)?.[Number(m[2])];
      if (!entry) { rejected.unmatched++; continue; }
      const asked = clip(item.original);
      if (asked) {
        const match = (entry.bullets || []).find((b) => wordsOf(b) === wordsOf(asked));
        if (!match) { rejected.unmatched++; continue; }
        original = match; // exact stored text so the client can swap it in place
        if (wordsOf(text) === wordsOf(match)) continue;
      }
    } else {
      rejected.unmatched++;
      continue;
    }
    if (field !== 'skills') {
      const invented = unsupportedTech(text, supportTech);
      if (invented.length) { rejected.unsupported++; unsupportedTerms.push(...invented); continue; }
    }

    suggestions.push({
      id: randomUUID().slice(0, 8),
      sectionId,
      field,
      original,
      text,
      requirementKeys,
    });
  }
  return { suggestions, rejected, unsupportedTerms: [...new Set(unsupportedTerms)] };
}

// Section ids a brand-new entry can target: only kinds still under the entry cap.
export function newEntryIds(draft) {
  const d = draft || {};
  return [['experience:new', d.experience], ['project:new', d.projects]]
    .filter(([, list]) => (Array.isArray(list) ? list.length : 0) < MAX_ENTRIES)
    .map(([id]) => id);
}

// Targets the reply and suggestions never touched. Errs toward asking: a redundant question is
// safe, a silently dropped requirement is the bug. A target the student already spoke about in an
// EARLIER message ("I've never used Kubernetes") is not re-asked: that answer is the reason for silence.
export function droppedTargets(targets, reply, suggestions, earlierStudentText = '') {
  const replyWords = wordsOf(reply);
  const earlierWords = wordsOf(earlierStudentText);
  const mentioned = (words, t) => hasWord(words, wordsOf(t.text))
    || hasWord(words, wordsOf(String(t.key).replace(/-\d+$/, '').replace(/-/g, ' ')));
  return targets.filter((t) => {
    if (suggestions.some((s) => s.requirementKeys.includes(t.key))) return false;
    if (t.evidence && suggestions.some((s) => s.field === 'bullet' && s.original && evidenceFound(wordsOf(s.original), t.evidence))) return false;
    return !mentioned(replyWords, t) && !mentioned(earlierWords, t);
  });
}

const LEAD_ASK = 'I also need to check these before I can help with them:';
const LEAD_NEXT = 'Next, so nothing gets skipped:';

// For the chat history sent back to the model: collapse a follow-up block to one line. Left verbatim, the model
// copied it as a template (live test: it re-listed every unmet job requirement in that exact format).
export function compactForHistory(text) {
  const s = String(text || '');
  const at = Math.min(...[LEAD_ASK, LEAD_NEXT].map((l) => s.indexOf(l)).filter((i) => i >= 0));
  if (!Number.isFinite(at)) return s;
  const asked = [...s.slice(at).matchAll(/^• (.+?) — /gm)].map((m) => m[1]);
  return `${s.slice(0, at).trim()}${asked.length ? `\n(also asked the student about: ${asked.join('; ')})` : ''}`.trim();
}

export function followUpFor(dropped, hasSuggestions) {
  const lead = hasSuggestions ? LEAD_NEXT : LEAD_ASK;
  const lines = dropped.map((t) => {
    const why = t.evidence
      ? `your draft's "${t.evidence}" is related but doesn't fully show it`
      : 'nothing in your draft shows this yet';
    return `• ${t.text} — ${why}. Have you actually used or done this? Tell me where (which role or project) and how, and I'll work it in truthfully.`;
  });
  return `${lead}\n${lines.join('\n')}`;
}
