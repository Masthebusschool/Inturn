// Picks the job details we need out of one MyCareersFuture API job.
// The result is spread straight into a new Application.
export function jobFromMcf(mcfJob) {
  // MCF has two companies: 1. the one hiring, 2. the agency who posted job.
  // Use the hiring company -> if there isn't one, use the poster -> if neither, an empty object.
  let company = {};
  if (mcfJob.hiringCompany) {
    company = mcfJob.hiringCompany;
  } else if (mcfJob.postedCompany) {
    company = mcfJob.postedCompany;
  }

  return {
    mcfUuid: mcfJob.uuid,
    title: mcfJob.title,
    companyName: company.name,
    companyLogoUrl: company.logoUploadPath,

    // MCF: [{ skill: 'Python', uuid: '...' }]  ->  ours: ['Python']
    skills: (mcfJob.skills ?? []).map((s) => s.skill),

    salaryMin: mcfJob.salary?.minimum,
    salaryMax: mcfJob.salary?.maximum,

    // MCF keeps dates and the job link inside `metadata`
    expiryDate: mcfJob.metadata?.expiryDate,
    jobDetailsUrl: mcfJob.metadata?.jobDetailsUrl,
  };
}

// Picks the job details out of a form the student filled in by hand (e.g. a LinkedIn posting).
// Only these fields are taken, so the form can't set status, mcfUuid, etc.
export function jobFromForm(form) {
  let skills = [];
      for (const skill of form.skills ?? []) {
      const cleaned = skill.trim(); // remove spaces at the start/end
      if (cleaned === '') continue; // skip blanks
      if (skills.includes(cleaned)) continue; // skip duplicates
      skills.push(cleaned);
  }

  let job = {
    title: form.title,
    companyName: form.companyName,
    jobDetailsUrl: form.jobDetailsUrl,
    expiryDate: form.expiryDate,
    salaryMin: form.salaryMin,
    salaryMax: form.salaryMax,
  };

  return job;
}