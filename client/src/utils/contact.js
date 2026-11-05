// Contact links are a modular list ({ label, value }) on a resume's contact.

export const LEGACY_LINKS = [['linkedin', 'LinkedIn'], ['github', 'GitHub'], ['portfolio', 'Portfolio']]

// Resumes saved before contact.links existed keep these in linkedin/github/portfolio.
export function contactLinks(c) {
  const links = (c?.links || []).filter((l) => l?.value)
  if (links.length) return links
  return LEGACY_LINKS.filter(([key]) => c?.[key]).map(([key, label]) => ({ label, value: c[key] }))
}

export const contactLine = (c) =>
  [c?.phone, c?.email, ...contactLinks(c).map((l) => `${l.label}: ${l.value}`)].filter(Boolean).join(' · ')
