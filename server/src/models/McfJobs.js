// Picks the job details we need out of one MyCareersFuture API job
// The result is spread straight into a new Application

// MCF's description is an HTML string; convert it to plain text for scoring/display,
// same conversion JobsSelect.vue already does client-side for the detail modal.
function htmlToText(html) {
  let text = html || '';
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '• ');
  text = text.replace(/<[^>]*>/g, '');
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/g, "'");
  return text.trim();
}

export function jobFromMcf(mcfJob) {
  // MCF has two companies, the one actually hiring and the agency that posted the job
  // use the hiring company, if there isn't one use the poster, if neither use an empty object
  let company;
  if (mcfJob.hiringCompany) {
    company = mcfJob.hiringCompany;
  } else if (mcfJob.postedCompany) {
    company = mcfJob.postedCompany;
  } else {
    company = {};
  }

  // MCF gives [{ skill: 'Python', uuid: '...' }], we only keep the names ['Python']
  const skills = [];
  if (mcfJob.skills) {
    mcfJob.skills.forEach(s => {
      skills.push(s.skill);
    });
  }

  // salary and metadata might be missing, so use empty objects instead
  let salary = {};
  if (mcfJob.salary) salary = mcfJob.salary;

  let metadata = {}; // MCF keeps the dates and job link inside metadata
  if (mcfJob.metadata) metadata = mcfJob.metadata;

  return {
    mcfUuid: mcfJob.uuid,
    title: mcfJob.title,
    companyName: company.name,
    companyLogoUrl: company.logoUploadPath,
    skills: skills,
    salaryMin: salary.minimum,
    salaryMax: salary.maximum,
    expiryDate: metadata.expiryDate,
    jobDetailsUrl: metadata.jobDetailsUrl,
    description: htmlToText(mcfJob.description),
  };
}

// Picks the job details out of a form the student filled in by hand, e.g. a LinkedIn posting
// Only these fields are taken, so the form can't set mcfUuid, user etc
export function jobFromForm(form) {
  // clean up the skills the student typed in
  const skills = [];
  let formSkills = [];
  if (form.skills) formSkills = form.skills;

  formSkills.forEach(skill => {
    const cleaned = skill.trim(); // remove spaces at the start and end
    if (cleaned === '') return; // skip blanks
    if (skills.includes(cleaned)) return; // skip duplicates
    skills.push(cleaned);
  });

  const details = {
    title: form.title,
    companyName: form.companyName,
    jobDetailsUrl: form.jobDetailsUrl,
    expiryDate: form.expiryDate,
    salaryMin: form.salaryMin,
    salaryMax: form.salaryMax,
    skills: skills,
  };

  // which column it starts in, the schema's enum rejects anything else
  if (form.status) {
    details.status = form.status;

    // if it's past Saved, they've already applied
    if (form.status !== 'Saved') {
      details.appliedDate = new Date();
    }
  }

  // interview date only makes sense for Interview cards
  if (form.status === 'Interview' && form.interviewAt) {
    details.interviewAt = form.interviewAt;
  }

  return details;
}