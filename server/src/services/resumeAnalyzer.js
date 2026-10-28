// Resume analyzer: scores one resume from My Resumes (the Resume model) and says what to improve.
// Plain functions with no database or HTTP, so they are easy to unit test.
//
// The resume object looks like:
//   contact:    { fullName, phone, email, linkedin, github, portfolio }
//   summary:    string
//   skills:     [string]
//   experience: [{ title, company, startDate, endDate, current, bullets: [string], skills: [string] }]
//   projects:   [{ name, bullets: [string], skills: [string] }]
//   education:  [{ school, degree, field, startDate, endDate }]
//
// Every check returns the same shape, so the analysis page can show any of them:
//   { category, label, passed, points, maxPoints, suggestion }
//   category is 'Contact', 'Structure' or 'Content' (the report groups checks by it)
//   suggestion is shown when passed is false
// Simple rule-based checks, no AI.

/** Builds a check result: full points when passed, none otherwise. */
function result(category, label, passed, maxPoints, suggestion) {
  return { category, label, passed, points: passed ? maxPoints : 0, maxPoints, suggestion };
}

/** Text with something in it after trimming, e.g. not '' or '   '. */
function filled(value) {
  return String(value ?? '').trim() !== '';
}


// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

// A Singapore phone number, e.g. +65 9123 4567, 65-81234567 or 91234567.
// Eight digits starting with 3, 6, 8 or 9, with an optional +65 in front.
function checkPhone(resume) {
  const phone = String(resume.contact?.phone ?? '').trim();
  const passed = /^(?:\+?65[\s-]?)?[3689]\d{3}[\s-]?\d{4}$/.test(phone);
  return result('Contact', 'Phone number', passed, 10,
    'Add a Singapore phone number recruiters can call, e.g. +65 9123 4567');
}

function checkEmail(resume) {
  const email = String(resume.contact?.email ?? '').trim();
  const passed = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
  return result('Contact', 'Email address', passed, 10,
    'Add an email address so recruiters can contact you');
}

// A LinkedIn profile link, e.g. linkedin.com/in/your-name
function checkLinkedin(resume) {
  const linkedin = String(resume.contact?.linkedin ?? '').toLowerCase();
  const passed = linkedin.includes('linkedin.com/in/');
  return result('Contact', 'LinkedIn profile', passed, 10,
    'Add your LinkedIn URL (linkedin.com/in/...), so recruiters can get to know you better');
}

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

function checkEducation(resume) {
  const passed = (resume.education ?? []).some((e) => filled(e.school));
  return result('Structure', 'Education section', passed, 10,
    'Add an Education section with your school, course and graduation year');
}

function checkExperience(resume) {
  const passed = (resume.experience ?? []).some((e) => filled(e.title) || filled(e.company));
  return result('Structure', 'Experience section', passed, 10,
    'Add your internships, part-time jobs or CCA roles under Experience');
}

function checkSkills(resume) {
  const passed = (resume.skills ?? []).filter(filled).length >= 3;
  return result('Structure', 'Skills section', passed, 10,
    'List at least 3 skills, e.g. the tools and languages you have used');
}


/**
 * Scores the resume with a list of checks.
 * @param {object} resume one resume from My Resumes (see the shape at the top)
 * @returns {{ score: number|null, checks: Array<{
 *   category: string, label: string, passed: boolean, points: number, maxPoints: number, suggestion: string
 * }> }}
 *   score is 0-100 (null until there are checks)
 */
export function reviewResume(resume) {
  // Add each new check to this list.
  const checks = [
    checkPhone(resume),
    checkEmail(resume),
    checkLinkedin(resume),
    checkEducation(resume),
    checkExperience(resume),
    checkSkills(resume),
    
    
  ];

  if (checks.length === 0) return { score: null, checks };

  // Score = points earned out of all possible points, as a percentage (0-100)
  const earned = checks.reduce((sum, check) => sum + check.points, 0);
  const possible = checks.reduce((sum, check) => sum + check.maxPoints, 0);
  const score = Math.round((earned / possible) * 100);

  return { score, checks };
}
