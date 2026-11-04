// Form <-> plain-object mappers for resume experience/project entries, shared by the
// resume editor and the Profile page.

export const lines = (t) => (t || '').split('\n').map((x) => x.trim()).filter(Boolean)
export const csv = (t) => (t || '').split(',').map((x) => x.trim()).filter(Boolean)

let keySeq = 0
export const nextKey = () => `k${++keySeq}`

export const expToForm = (e = {}) => ({
  key: e._id || nextKey(), title: e.title || '', company: e.company || '', location: e.location || '',
  startDate: e.startDate || '', endDate: e.endDate || '', current: !!e.current,
  bulletsText: (e.bullets || []).join('\n'), skillsText: (e.skills || []).join(', '),
})
export const projToForm = (p = {}) => ({
  key: p._id || nextKey(), name: p.name || '', startDate: p.startDate || '', endDate: p.endDate || '',
  bulletsText: (p.bullets || []).join('\n'), skillsText: (p.skills || []).join(', '),
})

export const expFromForm = ({ title, company, location, startDate, endDate, current, bulletsText, skillsText }) => ({
  title, company, location, startDate, endDate: current ? '' : endDate, current,
  bullets: lines(bulletsText), skills: csv(skillsText),
})
export const projFromForm = ({ name, startDate, endDate, bulletsText, skillsText }) => ({
  name, startDate, endDate, bullets: lines(bulletsText), skills: csv(skillsText),
})
