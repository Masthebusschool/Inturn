// Pure helpers for the Skill Gap workspace (no Vue, no fetch).

export const BAND_META = {
  strong: { label: 'Strong match', variant: 'success' },
  moderate: { label: 'Moderate match', variant: 'warning' },
  emerging: { label: 'Emerging match', variant: 'info' },
  low: { label: 'Low match', variant: 'danger' },
}

// Same thresholds as the server's bandFor, without the must-have cap.
export const rawBand = (score) => (score >= 75 ? 'strong' : score >= 50 ? 'moderate' : score >= 25 ? 'emerging' : 'low')

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '')

export function capInfo(score, band, requirements = []) {
  const capped = rawBand(score) === 'strong' && band === 'moderate'
  const blockers = capped
    ? requirements.filter((r) => r.tier === 'required' && r.importance === 'high' && r.verdict === 'missing')
    : []
  return { capped, blockers }
}

export const CATEGORY_LABELS = {
  technical: 'Technical skills',
  domain: 'Domain knowledge',
  qualification: 'Qualifications',
  responsibility: 'Responsibilities',
  soft_skill: 'Soft skills',
  other: 'Other',
}

export function categoryBreakdown(requirements = []) {
  const total = requirements.reduce((n, r) => n + (r.mark || 0), 0)
  return Object.keys(CATEGORY_LABELS).flatMap((category) => {
    const rows = requirements.filter((r) => (CATEGORY_LABELS[r.category] ? r.category : 'other') === category)
    if (!rows.length) return []
    const possible = rows.reduce((n, r) => n + (r.mark || 0), 0)
    const earned = rows.reduce((n, r) => n + (r.earned || 0), 0)
    return [{
      category,
      label: CATEGORY_LABELS[category],
      earned,
      possible,
      coverage: possible ? Math.round((earned / possible) * 100) : 0,
      share: total ? Math.round((possible / total) * 100) : 0,
    }]
  })
}

const MAX_ENTRIES = 15 // mirrors the server's cleanDraft cap

// Mirrors the server's wordsOf so client matching agrees with server matching.
export const normWords = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export function cloneDraft(src) {
  const s = src || {}
  return {
    summary: s.summary || '',
    skills: [...(s.skills || [])],
    experience: (s.experience || []).map((e) => ({ title: e.title || '', company: e.company || '', bullets: [...(e.bullets || [])] })),
    projects: (s.projects || []).map((p) => ({ name: p.name || '', bullets: [...(p.bullets || [])] })),
  }
}

// Stable string for "did anything the server cares about change?".
export function draftKey(draft, overrides) {
  const o = overrides || {}
  return JSON.stringify([draft, Object.keys(o).sort().map((k) => [k, o[k]])])
}

const contains = (hay, evidence) => {
  const frags = String(evidence ?? '').split(/\.{3}|…/).map(normWords).filter(Boolean)
  if (!frags.length) return false
  const h = ` ${normWords(hay)} `
  return frags.every((f) => h.includes(` ${f} `))
}

export function fieldIdForEvidence(draft, evidence) {
  if (!draft || !evidence) return null
  if (contains(draft.summary, evidence)) return 'summary'
  if (contains((draft.skills || []).join(' '), evidence)) return 'skills'
  for (const [kind, list, nameKey] of [['experience', draft.experience, 'title'], ['project', draft.projects, 'name']]) {
    for (let i = 0; i < (list || []).length; i++) {
      const e = list[i]
      for (let j = 0; j < e.bullets.length; j++) if (contains(e.bullets[j], evidence)) return `${kind}:${i}:bullet:${j}`
      if (contains(`${e[nameKey]} ${e.company || ''}`, evidence)) return `${kind}:${i}:head`
    }
  }
  return null
}

const NEW_NOTE = 'The original line had changed, so this was added as a new bullet.'

export function applySuggestion(draft, s) {
  const next = cloneDraft(draft)
  if (s.field === 'summary') {
    next.summary = s.text
    return { draft: next, fieldId: 'summary', note: '' }
  }
  if (s.field === 'skills') {
    const have = new Set(next.skills.map((x) => x.toLowerCase()))
    for (const x of s.text.split(',').map((t) => t.trim()).filter(Boolean)) {
      if (!have.has(x.toLowerCase())) { have.add(x.toLowerCase()); next.skills.push(x) }
    }
    return { draft: next, fieldId: 'skills', note: '' }
  }
  if (s.field === 'entry') {
    const kind = String(s.sectionId || '').split(':')[0]
    if (kind !== 'experience' && kind !== 'project') return { draft: next, fieldId: null, note: 'That suggestion could not be added.' }
    const list = kind === 'experience' ? next.experience : next.projects
    const title = String(s.title || '').trim()
    const company = kind === 'experience' ? String(s.company || '').trim() : ''
    const bullets = (s.bullets || []).map((b) => String(b).trim()).filter(Boolean)
    const i = list.findIndex((e) => normWords(kind === 'experience' ? e.title : e.name) === normWords(title)
      && (kind !== 'experience' || normWords(e.company) === normWords(company)))
    if (i >= 0) return { draft: next, fieldId: `${kind}:${i}:head`, note: 'That entry is already in your draft.' }
    if (list.length >= MAX_ENTRIES) return { draft: next, fieldId: null, note: `Your draft already has the maximum of ${MAX_ENTRIES} ${kind === 'experience' ? 'roles' : 'projects'}.` }
    list.push(kind === 'experience' ? { title, company, bullets } : { name: title, bullets })
    return { draft: next, fieldId: `${kind}:${list.length - 1}:head`, note: '' }
  }
  const [kind, idx] = s.sectionId.split(':')
  const entry = (kind === 'experience' ? next.experience : next.projects)[Number(idx)]
  if (!entry) return { draft: next, fieldId: null, note: 'That section no longer exists in your draft.' }
  const at = (j) => ({ draft: next, fieldId: `${kind === 'experience' ? 'experience' : 'project'}:${idx}:bullet:${j}` })
  if (s.original) {
    let j = entry.bullets.indexOf(s.original)
    if (j < 0) j = entry.bullets.findIndex((b) => normWords(b) === normWords(s.original))
    if (j >= 0) {
      entry.bullets[j] = s.text
      return { ...at(j), note: '' }
    }
    entry.bullets.push(s.text)
    return { ...at(entry.bullets.length - 1), note: NEW_NOTE }
  }
  entry.bullets.push(s.text)
  return { ...at(entry.bullets.length - 1), note: '' }
}

export function sectionLabel(draft, sectionId) {
  if (sectionId === 'summary') return 'Summary'
  if (sectionId === 'skills') return 'Skills'
  const [kind, idx] = sectionId.split(':')
  if (idx === 'new') return kind === 'experience' ? 'New experience' : 'New project'
  if (kind === 'experience') {
    const e = draft?.experience?.[Number(idx)]
    return e ? `Experience · ${e.title}${e.company ? ' — ' + e.company : ''}` : 'Experience'
  }
  const p = draft?.projects?.[Number(idx)]
  return p ? `Project · ${p.name}` : 'Project'
}

export function draftToText(d) {
  if (!d) return ''
  const out = []
  if (d.summary) out.push(d.summary, '')
  if (d.skills?.length) out.push('SKILLS', d.skills.join(', '), '')
  if (d.experience?.length) {
    out.push('EXPERIENCE')
    for (const e of d.experience) {
      out.push(`${e.title}${e.company ? ' — ' + e.company : ''}`)
      for (const b of e.bullets || []) out.push(`- ${b}`)
      out.push('')
    }
  }
  if (d.projects?.length) {
    out.push('PROJECTS')
    for (const p of d.projects) {
      out.push(p.name)
      for (const b of p.bullets || []) out.push(`- ${b}`)
      out.push('')
    }
  }
  return out.join('\n').trim()
}
