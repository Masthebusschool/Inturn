// Resume analyzer: turns the resume text from POST /api/resume into skills and a score.
// Plain functions with no database or HTTP, so they are easy to unit test.
//


/**
 * Finds the skills mentioned in the resume.
 * @param {string} text resume text, one line per line of the PDF
 * @returns {Array<{ name: string, category: string, evidenced: boolean }>}
 *   evidenced = also shown in Experience or Projects, not only listed under Skills
 *   e.g. [{ name: 'JavaScript', category: 'Programming', evidenced: true }]
 */
export function extractSkills(text) {
  return [];
}

// ---------------------------------------------------------------------------
// Resume review: simple rule-based checks, no AI.
// Every check returns the same shape, so the analysis page can show any of them:
//   { category, label, passed, points, maxPoints, suggestion }
//   category is 'Contact' or 'Structure' (the report groups checks by it)
//   suggestion is shown when passed is false
// ---------------------------------------------------------------------------

/**
 * Is this line a section heading such as "EDUCATION" or "Work Experience:"?
 * A heading is a short line (at most 5 words) that contains one of the keywords,
 * so a sentence like "I have experience in teaching" does not count.
 * @param {string} line one line of the resume
 * @param {string[]} keywords lowercase words, e.g. ['education']
 */
function isSectionHeading(line, keywords) {
  const words = line.replace(/[:|]/g, ' ').trim().toLowerCase().split(/\s+/);
  if (words.length > 5) return false;
  return keywords.some((keyword) => words.includes(keyword));
}

/**
 * Does the resume have a heading that matches any of the keywords?
 * Use it for the other section checks too, e.g. hasSection(text, ['skills']).
 * @param {string} text resume text, one line per line of the PDF
 * @param {string[]} keywords lowercase words
 */
function hasSection(text, keywords) {
  return text.split('\n').some((line) => isSectionHeading(line, keywords));
}

// Contact: a Singapore phone number, e.g. +65 9123 4567, 65-81234567 or 91234567.
// Eight digits starting with 3, 6, 8 or 9, with an optional +65 in front.
function checkPhone(text) {
  const maxPoints = 10;
  const hasPhone = /(?<!\d)(?:\+?65[\s-]?)?[3689]\d{3}[\s-]?\d{4}(?!\d)/.test(text);

  return {
    category: 'Contact',
    label: 'Phone number',
    passed: hasPhone,
    points: hasPhone ? maxPoints : 0,
    maxPoints,
    suggestion: 'Add a phone number recruiters can call, e.g. +65 9123 4567',
  };
}

// One rule: does the resume have an email address?
// Every rule returns the same shape, so the page can show any of them.
function checkEmail(text) {
  const maxPoints = 10;
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text);

  return {
    label: 'Email address',
    passed: hasEmail,
    points: hasEmail ? maxPoints : 0,
    maxPoints,
    suggestion: 'Add an email address so recruiters can contact you',
  };
}



// Structure: an Education section, e.g. a heading "EDUCATION" or "Educational Background".
function checkEducationSection(text) {
  const maxPoints = 10;
  const hasEducation = hasSection(text, ['education', 'educational']);

  return {
    category: 'Structure',
    label: 'Education section',
    passed: hasEducation,
    points: hasEducation ? maxPoints : 0,
    maxPoints,
    suggestion: 'Add an Education section with your school, course and graduation year',
  };
}

function checkexperienceSection(text) {
  const maxPoints = 10;
  const hasExperience = hasSection(text, ['experience', 'Experience']);

  return {
    category: 'Structure',
    label: 'Experience section',
    passed: hasExperience,
    points: hasExperience ? maxPoints : 0,
    maxPoints,
    suggestion: 'Add your experience',
  };
}

function checkLinkedin(text){
  const maxPoints = 10;
  const hasLinkedin = hasSection(text,['LinkedIn','linkedin','LinkedIn'])
  return {
    category: 'Contact',
    label: 'Linkedin',
    passed: hasLinkedin,
    points: hasLinkedin ? maxPoints : 0,
    maxPoints,
    suggestion: 'Add your Linkedin URL, recruiters can get to know you better',
  }
}

function checkSkill(text){
  const maxPoints = 10;
  const hasSkill = hasSection(text,['skill','skills','Skill','Skills'])
  return {
    category: 'Structure',
    label: 'Skill',
    passed: hasSkill,
    points: hasSkill ? maxPoints : 0,
    maxPoints,
    suggestion: 'Add your skills',
  }
}

/**
 * Scores the resume with a list of checks.
 * @param {string} text resume text, one line per line of the PDF
 * @returns {{ score: number|null, checks: Array<{
 *   category: string, label: string, passed: boolean, points: number, maxPoints: number, suggestion: string
 * }> }}
 *   score is 0-100 (null until there are checks)
 */
export function reviewResume(text) {
  // Add each new check to this list.
  // TODO(Ruirong): Contact: email (move checkEmail here from client/src/stores/resume.js),
  //   LinkedIn/GitHub link. Structure: Experience or Projects section, Skills section.
  const checks = [
    checkPhone(text),
    checkEducationSection(text),
    checkLinkedin(text),
    checkexperienceSection(text),
    checkSkill(text)
  ];

  if (checks.length === 0) return { score: null, checks };

  // Score = points earned out of all possible points, as a percentage (0-100)
  const earned = checks.reduce((sum, check) => sum + check.points, 0);
  const possible = checks.reduce((sum, check) => sum + check.maxPoints, 0);
  const score = Math.round((earned / possible) * 100);

  return { score, checks };
}
