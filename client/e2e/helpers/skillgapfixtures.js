// Fixture builders for mocked Skill Gap API responses.
// Shapes mirror server/src/models/SkillGapResult.js and the responses built in
// server/src/routes/skillgap.js - keep both in sync if either changes.

// one requirement per verdict, so every score-report group (missing/partial/met) has a row
export const REQUIREMENTS = [
    { key: 'python', text: 'Proficiency in Python', tier: 'required', category: 'technical', importance: 'high', verdict: 'met', reason: 'The profile lists Python.', evidence: 'Python', weight: 1, mark: 34, earned: 34 },
    { key: 'sql', text: 'Comfortable writing SQL', tier: 'required', category: 'technical', importance: 'high', verdict: 'missing', reason: 'No SQL experience found in the profile.', evidence: '', weight: 1, mark: 33, earned: 0 },
    { key: 'rest-api', text: 'Understanding of REST API design', tier: 'preferred', category: 'technical', importance: 'medium', verdict: 'partial', reason: 'Some API experience, but not REST-specific.', evidence: 'built internal tools', weight: 1, mark: 33, earned: 15 },
];

// a successful POST /api/skillgap response's `result`
export function buildResult(overrides = {}) {
    return {
        _id: 'e2e-result-1',
        job: { title: 'Software Engineering Intern', company: 'Acme Corp' },
        atsScore: 62,
        band: 'moderate',
        requirements: REQUIREMENTS,
        eligibility: [{ key: 'authorized', text: 'Authorized to work in Singapore' }],
        ungradedCount: 0,
        matchedSkills: ['Python'],
        missingSkills: ['SQL'],
        recommendations: ['Add a project that uses SQL.'],
        tailoredResume: { summary: 'Undergraduate with Python experience.', skills: ['Python'], experience: [], projects: [] },
        draftResume: null,
        overrides: {},
        draftScore: null,
        tailorChat: [],
        createdAt: new Date().toISOString(),
        label: '',
        sourceResume: null,
        ...overrides,
    };
}

// a POST /api/skillgap/:id/rescore response's `score`, as if the student self-confirmed having
// the one missing requirement (SQL) and it was re-graded as met
export function buildRescoredScore(overrides = {}) {
    return {
        atsScore: 82,
        band: 'strong',
        requirements: REQUIREMENTS.map((r) => (r.key === 'sql' ? { ...r, verdict: 'met', earned: r.mark } : r)),
        matchedSkills: ['Python', 'SQL'],
        missingSkills: [],
        recommendations: [],
        ungradedCount: 0,
        scoredAt: new Date().toISOString(),
        ...overrides,
    };
}

// a POST /api/skillgap/:id/tailor response: the user's message echoed back plus a scripted reply
export function buildTailorReply({ userMessage, reply, suggestions = [] }) {
    const now = new Date().toISOString();
    return {
        messages: [
            { role: 'user', text: userMessage, focusKeys: [], asking: false, suggestions: [], createdAt: now },
            { role: 'assistant', text: reply, focusKeys: [], asking: false, suggestions, createdAt: now },
        ],
        meta: {},
    };
}

// a chat suggestion for a whole new draft entry - the only suggestion type with an "Add" button
// instead of "Apply" (see client/src/lib/skillgap.js applySuggestion's `field === 'entry'` case)
export function buildEntrySuggestion(overrides = {}) {
    return {
        id: 'e2e-sugg-1',
        sectionId: 'project:new',
        field: 'entry',
        title: 'Campus Event Finder',
        company: '',
        bullets: [
            'Built a Flask REST API in Python backed by Postgres.',
            'Let students search campus events by date and location.',
        ],
        requirementKeys: ['sql', 'rest-api'],
        ...overrides,
    };
}
