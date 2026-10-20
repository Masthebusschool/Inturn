// Pure, deterministic scoring for the judge-based skill-gap analysis. No AI, DB or env here:
// the AI parses the JD and grades each requirement; everything that decides the NUMBER lives
// in this file so the same verdicts always give the same score.
import { canonical } from './skillNormalize.js';

export const TIER_BASE = { required: 1.0, preferred: 0.25 };
export const IMPORTANCE_MUL = { high: 1.0, medium: 0.8, low: 0.6 };
// A soft skill is judgement-heavy and nearly always "ticked", so it carries little weight.
export const CATEGORY_MUL = {
  technical: 1.0, domain: 1.0, qualification: 1.0, responsibility: 0.6, other: 0.5, soft_skill: 0.3,
};
export const CREDIT = { met: 1, partial: 0.5, missing: 0 };

export const CATEGORIES = ['technical', 'domain', 'soft_skill', 'responsibility', 'qualification', 'other'];
export const TIERS = ['required', 'preferred'];
export const IMPORTANCES = ['high', 'medium', 'low'];
export const VERDICTS = ['met', 'partial', 'missing'];
// Categories that count as learnable skills (matched/missing lists, skill to-do list).
export const SKILL_CATEGORIES = ['technical', 'domain', 'soft_skill'];

const DEGREE_RE = /\b(degree|bachelor'?s?|master'?s?|ph\.?d|doctorate|diploma|b\.?sc|m\.?sc|b\.?eng|m\.?eng|field of study|major in)\b/i;

export function requirementWeight({ tier, importance, category } = {}) {
  const t = TIER_BASE[tier] ?? 0.25;
  const i = IMPORTANCE_MUL[importance] ?? 0.8;
  const c = CATEGORY_MUL[category] ?? 0.5;
  return t * i * c;
}

// Largest-remainder (Hamilton): whole marks that sum to EXACTLY `total`. minEach reserves a
// mark per requirement so no real requirement is worth 0 (a gap always costs something).
export function apportionMarks(weights, total = 100, minEach = 1) {
  const n = weights.length;
  if (n === 0) return [];
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum <= 0 || total <= 0) return weights.map(() => 0);
  const floor = minEach > 0 && minEach * n <= total ? minEach : 0;
  const pool = total - floor * n;
  const exact = weights.map((w) => floor + (pool * w) / sum);
  const marks = exact.map((e) => Math.floor(e));
  let remaining = total - marks.reduce((s, m) => s + m, 0);
  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => (b.frac !== a.frac ? b.frac - a.frac : a.i - b.i));
  for (let k = 0; remaining > 0 && k < order.length; k++, remaining--) marks[order[k].i]++;
  return marks;
}

// A missing high-importance must-have caps "strong" at "moderate" (the number stays honest).
export function bandFor(score, hasMissingHighRequired) {
  let band = score >= 75 ? 'strong' : score >= 50 ? 'moderate' : score >= 25 ? 'emerging' : 'low';
  if (hasMissingHighRequired && band === 'strong') band = 'moderate';
  return band;
}

// Backstop behind the parser's isEligibility tag. Every pattern is anchored to eligibility
// wording so "high availability" / "communication skills" / "able to work in a team" never match.
// Enrollment wording is kept separate: "Currently pursuing a Bachelor's in CS" is a degree
// requirement the judge can grade, so it must not beat the degree rule in cleanRequirements.
const ENROLLMENT_RE = /\b(currently enrolled|must be enrolled|currently (?:pursuing|studying)|pursuing a|returning to (?:school|university|campus)|rising (?:sophomore|junior|senior)|full-?time student|enrolled in (?:a|an)|penultimate year|matriculated)\b/i;
const KNOCKOUT_RES = [
  /\b(work authori[sz]|authori[sz]\w*\s+to work|right to work|employment eligib|legally (?:authori[sz]|entitled) to work|eligib\w* to work|work permit|valid work pass)/i,
  /\b(sponsorship|require[s]?\s+a\s+visa|visa status|work visa|h-?1b|opt|cpt|will not sponsor|unable to (?:provide|offer)\s+(?:visa\s+)?sponsor|employment pass|s[- ]pass)\b/i,
  /\b(u\.?s\.?\s+citizen|singapore(?:an)? citizen|citizens? (?:only|of)|citizenship\s+(?:required|status)|permanent resident|pr holders?|security clearance|clearance required|local (?:citizens?|candidates? only))\b/i,
  /\b(minimum\s+(?:cumulative\s+)?(?:gpa|cap)|gpa\s+(?:of|above|at least)\s*\d|cap\s+(?:of|above|at least)\s*\d|grade point average|cgpa\s+(?:of|above|at least)?\s*\d|second[- ]upper|honou?rs (?:degree )?classification)/i,
  /\b(expected graduation|graduat\w*\s+(?:by|in|between)|class of 20\d\d|anticipated graduation|graduating in)\b/i,
  /\b(on-?site|in-?person|must relocat|must be (?:located|based)|based in \w+|relocation required|hybrid (?:role|schedule|work)|work(?:ing)? from (?:the )?office|report(?:ing)? to (?:the )?office)\b/i,
  /\b(able to (?:commit|start|intern)|able to work (?:full|part|\d|at least|on-?site|from)|commit(?:ment)?s? to (?:a |the |your )?(?:full |entire |required )?(?:\d+[- ]?(?:month|week)|internship|placement|period)|commit (?:full|part)[- ]?time|(?:full|part)[- ]?time (?:internship |work )?commitment|commitment of \d|internship (?:period|duration)|(?:\d+|two|three|four|five) (?:working |full )?days (?:a|per) week|available (?:from|between|to (?:work|start|commit)|for the (?:full|entire))|full-?time availability|immediate availability|start(?:ing)? date)\b/i,
  /\bnotice period\b/i,
];

const isKnockout = (s) => KNOCKOUT_RES.some((re) => re.test(s));

export function looksLikeEligibility(text) {
  const s = String(text ?? '');
  return isKnockout(s) || ENROLLMENT_RE.test(s);
}

const keyOf = (s) => canonical(s).replace(/\s+/g, '-');

// Lowercase + trim, map common synonyms, fall back when not in the allowed list.
function enumOf(v, allowed, fallback, synonyms = {}) {
  const s = String(v ?? '').trim().toLowerCase();
  if (allowed.includes(s)) return s;
  const u = s.replace(/[\s-]+/g, '_');
  if (allowed.includes(u)) return u;
  return synonyms[s] ?? fallback;
}

const TIER_SYN = { must: 'required', 'must-have': 'required', 'must have': 'required', 'nice to have': 'preferred', 'nice-to-have': 'preferred', optional: 'preferred' };

export function cleanRequirements(raw) {
  const out = [];
  const indexByKey = new Map();
  (Array.isArray(raw) ? raw : []).forEach((item, i) => {
    if (!item || typeof item !== 'object') return;
    const text = typeof item.text === 'string' ? item.text.trim() : '';
    if (!text) return;

    const tier = enumOf(item.tier, TIERS, 'required', TIER_SYN);
    const category = enumOf(item.category, CATEGORIES, 'other');
    let importance = enumOf(item.importance, IMPORTANCES, 'medium');
    const key = keyOf(typeof item.key === 'string' ? item.key : '') || keyOf(text) || `req-${i + 1}`;

    const isSkill = category === 'technical' || category === 'domain';
    const isDegree = !isSkill && DEGREE_RE.test(text);

    // A skill is always scored; a hard knockout (work auth, GPA, citizenship...) always goes to the
    // checklist even when it mentions a degree; otherwise a degree is scored; otherwise trust the tag.
    let isEligibility;
    if (isSkill) isEligibility = false;
    else if (isKnockout(text)) isEligibility = true;
    else if (isDegree) isEligibility = false;
    else isEligibility = item.isEligibility === true || ENROLLMENT_RE.test(text);

    let alternativeGroup = typeof item.alternativeGroup === 'string' ? keyOf(item.alternativeGroup) || null : null;
    // A candidate holds one degree, so every scored degree ask ("Degree in CS", "Currently pursuing a
    // degree") is an alternative of the others, whatever category the parser gave it.
    if (isDegree && !isEligibility) alternativeGroup = 'degree';

    // Parsers tag nearly everything 'high'; a soft skill must not be able to trigger the band cap.
    if (['soft_skill', 'responsibility', 'other'].includes(category) && importance === 'high') importance = 'medium';

    const req = { key, text, tier, category, importance, alternativeGroup, isEligibility };
    const at = indexByKey.get(key);
    if (at === undefined) {
      indexByKey.set(key, out.length);
      out.push(req);
    } else if (requirementWeight(req) > requirementWeight(out[at])) {
      out[at] = req;
    }
  });
  return out;
}

const IMP_RANK = { high: 3, medium: 2, low: 1 };

export function collapseAlternatives(reqs) {
  const groups = new Map(); // insertion order = first appearance
  for (const r of reqs || []) {
    if (!r || r.isEligibility) continue;
    const gid = r.alternativeGroup ? `g:${r.alternativeGroup}` : `solo:${r.key}`;
    if (!groups.has(gid)) groups.set(gid, []);
    groups.get(gid).push(r);
  }
  const units = [];
  const usedKeys = new Set();
  for (const members of groups.values()) {
    const rep = members
      .slice()
      .sort((a, b) => requirementWeight(b) - requirementWeight(a) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))[0];
    const unit = {
      key: rep.key,
      text: [...new Set(members.map((m) => m.text))].join(' or '),
      tier: members.some((m) => m.tier === 'required') ? 'required' : 'preferred',
      category: rep.category,
      importance: members.reduce((best, m) => (IMP_RANK[m.importance] > IMP_RANK[best] ? m.importance : best), members[0].importance),
      alternativeGroup: rep.alternativeGroup ?? null,
      isEligibility: false,
    };
    unit.weight = Math.round(requirementWeight(unit) * 10000) / 10000;
    // Keys must be unique so priors/caches can be looked up by key.
    let k = unit.key;
    for (let n = 2; usedKeys.has(k); n++) k = `${unit.key}-${n}`;
    unit.key = k;
    usedKeys.add(k);
    units.push(unit);
  }
  return units;
}

// ─── Profile rendering ───────────────────────────────────────────────────────

const str = (v) => (v == null ? '' : String(v).trim());
const list = (v) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const range = (a, b) => {
  const s = str(a);
  const e = str(b);
  return s || e ? `${s || '?'} – ${e || '?'}` : '';
};

// Internal: structured entries so the labelled text and the plain section text stay in sync.
function profileEntries(profile) {
  const p = profile || {};
  const entries = [];
  const summary = str(p.summary);
  if (summary) entries.push({ id: 'summary', kind: 'summary', label: 'SUMMARY', head: '', bullets: [], extra: '', body: summary });
  const skills = list(p.skills);
  if (skills.length) entries.push({ id: 'skills', kind: 'skills', label: 'SKILLS', head: '', bullets: [], extra: '', body: skills.join(', ') });

  (Array.isArray(p.experience) ? p.experience : []).forEach((e, i) => {
    if (!e) return;
    const dates = range(e.startDate, e.current ? 'Present' : e.endDate);
    const head = [[str(e.title), str(e.company)].filter(Boolean).join(' — '), dates && `(${dates})`].filter(Boolean).join(' ');
    const sk = list(e.skills);
    entries.push({ id: `experience:${i}`, kind: 'experience', label: 'EXPERIENCE', head, bullets: list(e.bullets), extra: sk.length ? `Skills: ${sk.join(', ')}` : '' });
  });
  (Array.isArray(p.projects) ? p.projects : []).forEach((e, i) => {
    if (!e) return;
    const sk = list(e.skills);
    entries.push({ id: `project:${i}`, kind: 'project', label: 'PROJECT', head: str(e.name), bullets: list(e.bullets), extra: sk.length ? `Skills: ${sk.join(', ')}` : '' });
  });
  (Array.isArray(p.education) ? p.education : []).forEach((e, i) => {
    if (!e) return;
    const what = [str(e.degree), str(e.field)].filter(Boolean).join(', ');
    const dates = range(e.startDate, e.endDate);
    const head = [[what, str(e.school)].filter(Boolean).join(' — '), dates && `(${dates})`].filter(Boolean).join(' ');
    entries.push({ id: `education:${i}`, kind: 'education', label: 'EDUCATION', head, bullets: [], extra: '' });
  });

  return entries
    .map((en) => ({ ...en, text: en.body ?? [en.head, ...en.bullets, en.extra].filter(Boolean).join('\n') }))
    .filter((en) => en.text);
}

export function profileSections(profile) {
  return profileEntries(profile).map(({ id, kind, text }) => ({ id, kind, text }));
}

export function profileToText(profile) {
  return profileEntries(profile)
    .map((en) => {
      if (en.kind === 'summary') return `SUMMARY:\n${en.text}`;
      if (en.kind === 'skills') return `SKILLS: ${en.text}`;
      return [`${en.label}: ${en.head}`.trimEnd(), ...en.bullets.map((b) => `- ${b}`), en.extra].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

// ─── Evidence checks ─────────────────────────────────────────────────────────

export function wordsOf(s) {
  return String(s ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

// Whole-word containment, so a skill "r"/"c" never matches inside "science". The model
// sometimes elides with "...", so every fragment must be found, not the whole string.
// The judge reads profileToText, so it sometimes copies our own "SKILLS:" / "EXPERIENCE:" label
// into the quote; those labels aren't profile content, so drop them before matching.
const LABEL_RE = /^\s*(?:SUMMARY|SKILLS|EXPERIENCE|PROJECT|EDUCATION)\s*:\s*/i;

export function evidenceFound(haystackWords, evidence) {
  const frags = String(evidence ?? '').replace(LABEL_RE, '').split(/\.{3}|…/).map(wordsOf).filter(Boolean);
  if (frags.length === 0) return false;
  const hay = ` ${haystackWords} `;
  return frags.every((f) => hay.includes(` ${f} `));
}

const allWords = (sections) => wordsOf(sections.map((s) => s.text).join(' '));
const isUngraded = (j) => !j || j.ungraded === true;

// The judge isn't deterministic run-to-run: a proven match whose evidence is still present must not wobble down.
export function preserveMetVerdicts(units, judged, sections, priorByKey) {
  if (!priorByKey || priorByKey.size === 0) return judged.slice();
  const hay = allWords(sections);
  return judged.map((j, i) => {
    const prior = priorByKey.get(units[i].key);
    if (prior?.verdict !== 'met') return j;
    if (!isUngraded(j) && j.verdict === 'met') return j;
    if (!evidenceFound(hay, prior.evidence)) return j;
    return {
      verdict: 'met',
      reason: prior.reason || 'Still met — the evidence for this is still in your profile.',
      evidence: prior.evidence,
    };
  });
}

// Mirror image: a prior gap only upgrades when the cited evidence is NEW text. Evidence that
// already existed when the previous run called it a gap means the flip is judge noise.
export function preserveGapVerdicts(units, judged, previousProfileText, priorByKey) {
  if (!previousProfileText || !priorByKey || priorByKey.size === 0) return judged.slice();
  const prevWords = wordsOf(previousProfileText);
  return judged.map((j, i) => {
    const prior = priorByKey.get(units[i].key);
    if (!prior || (prior.verdict !== 'partial' && prior.verdict !== 'missing')) return j;
    if (isUngraded(j) || !(CREDIT[j.verdict] > CREDIT[prior.verdict])) return j;
    if (!evidenceFound(prevWords, j.evidence)) return j;
    return {
      verdict: prior.verdict,
      reason: prior.reason || j.reason,
      evidence: prior.verdict === 'partial' ? prior.evidence || '' : '',
    };
  });
}

// Deterministic backstop applied last: credit needs evidence that physically exists, and a
// degree/school line alone can't prove a specific skill.
export function groundVerdicts(units, judged, sections) {
  const all = allWords(sections);
  const eduWords = sections.filter((s) => s.kind === 'education').map((s) => wordsOf(s.text));
  const nonEdu = wordsOf(sections.filter((s) => s.kind !== 'education').map((s) => s.text).join(' '));
  return judged.map((j, i) => {
    if (isUngraded(j) || j.verdict === 'missing') return j;
    if (!evidenceFound(all, j.evidence)) {
      const verdict = j.verdict === 'met' ? 'partial' : 'missing';
      return {
        verdict,
        reason: `${j.reason || ''} (Downgraded: the quoted evidence wasn't found in your profile.)`.trim(),
        evidence: verdict === 'partial' ? j.evidence : '',
      };
    }
    if (['technical', 'domain'].includes(units[i].category)
      && eduWords.some((w) => evidenceFound(w, j.evidence))
      && !evidenceFound(nonEdu, j.evidence)) {
      return { verdict: 'missing', reason: 'A degree or school name alone does not demonstrate this specific skill.', evidence: '' };
    }
    return j;
  });
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

export function scoreRequirements(units, judged) {
  if (!units.length) return { requirements: [], atsScore: 0, band: 'low' };
  const marks = apportionMarks(units.map((u) => u.weight), 100, 1);
  const requirements = units.map((u, i) => {
    const j = judged[i] || {};
    const verdict = VERDICTS.includes(j.verdict) ? j.verdict : 'missing';
    return {
      ...u,
      verdict,
      reason: j.reason || '',
      evidence: j.evidence || '',
      mark: marks[i],
      earned: marks[i] * CREDIT[verdict],
    };
  });
  const atsScore = Math.round(requirements.reduce((s, r) => s + r.earned, 0));
  const hasMissingHighRequired = requirements.some((r) => r.tier === 'required' && r.importance === 'high' && r.verdict === 'missing');
  return { requirements, atsScore, band: bandFor(atsScore, hasMissingHighRequired) };
}

export function summarizeGap(requirements) {
  const matchedSkills = requirements.filter((r) => SKILL_CATEGORIES.includes(r.category) && r.verdict === 'met').map((r) => r.text);
  const missingSkills = requirements.filter((r) => SKILL_CATEGORIES.includes(r.category) && r.verdict === 'missing').map((r) => r.text);
  const gaps = requirements
    .filter((r) => r.verdict !== 'met')
    .sort((a, b) => (b.mark - b.earned) - (a.mark - a.earned) || (a.tier === 'required' ? 0 : 1) - (b.tier === 'required' ? 0 : 1))
    .slice(0, 6);
  const recommendations = gaps.length
    ? gaps.map((r) => (r.verdict === 'missing'
      ? `Show evidence of "${r.text}"${r.tier === 'required' ? ' (required)' : ''}: add a project or experience bullet where you actually used it.`
      : `Strengthen "${r.text}": ${r.reason || 'add a bullet that demonstrates it directly.'}`))
    : ['Strong alignment — keep this evidence prominent on your resume.'];
  return { matchedSkills, missingSkills, recommendations };
}
