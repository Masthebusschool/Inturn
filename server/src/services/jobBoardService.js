// Job board service.
// MyCareersFuture: https://api.mycareersfuture.gov.sg/v2/jobs
// Adzuna: https://api.adzuna.com/v1/api/jobs/{country}/search/{page}?app_id=...&app_key=...
//   uses ADZUNA_APP_ID / ADZUNA_APP_KEY, read from process.env inside the functions.
// Node's built-in global `fetch` is enough; no axios needed.

export async function searchCareersFuture(params) {
  throw new Error('jobBoardService.searchCareersFuture not implemented yet');
}

export async function searchAdzuna(params) {
  throw new Error('jobBoardService.searchAdzuna not implemented yet');
}

export async function searchJobs(params) {
  throw new Error('jobBoardService.searchJobs not implemented yet');
}
