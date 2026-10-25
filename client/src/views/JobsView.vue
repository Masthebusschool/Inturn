<template>
  <section class="jobs-view">
    <JobsSelect
      v-if="selectedJob"
      :key="selectedJob.uuid"
      :job="selectedJob"
      :resume-skills="resumeSkills"
      :saved="isSaved(selectedJob.uuid)"
      @close="selectedJob = null"
      @save="toggleSaved"
    />

    <JobsFilter
      v-else-if="showFilters"
      :model-value="filters"
      :jobs="jobs"
      :result-count="filteredJobs.length"
      @update:model-value="updateFilters"
      @close="showFilters = false"
    />

    <div v-else>
      <h1 class="h3">Jobs</h1>

      <p class="text-body-secondary">
        Live internship and job listings from public job boards, searchable by
        keyword, role, and location.
      </p>

      <form class="search-bar" @submit.prevent="searchJobs">
        <label for="job-search">Search jobs</label>

        <input
          id="job-search"
          v-model.trim="searchInput"
          type="search"
          placeholder="Search jobs or internships..."
          :disabled="loading"
        />

        <button
          class="search-button"
          type="submit"
          :disabled="loading"
        >
          Search
        </button>

        <button
          class="filter-button"
          type="button"
          :disabled="loading"
          @click="showFilters = true"
        >
          Filters
          <span v-if="activeFilterCount > 0">
            ({{ activeFilterCount }})
          </span>
        </button>
      </form>

      <section class="results-panel">
        <header class="results-header">
          <div>
            <h2>Search Results</h2>

            <p v-if="loading">Loading opportunities...</p>

            <p v-else-if="error">Results unavailable</p>

            <p v-else>
              {{ filteredJobs.length }} matches on this page ·
              {{ total }} jobs found by keyword
            </p>

            <p v-if="!loading && !error && resumeSkills.length > 0">
              Ranked by resume skill matches within this results page.
            </p>

            <p v-else-if="!loading && !error">
              Connect your resume skills to rank jobs by match.
            </p>
          </div>

          <span class="source-label">MyCareersFuture</span>
        </header>

        <div class="results-body">
          <div v-if="loading" class="message" role="status">
            <p>Loading jobs. Please wait...</p>
          </div>

          <div v-else-if="error" class="message" role="alert">
            <h3>Unable to load jobs</h3>
            <p>{{ error }}</p>

            <button
              class="search-button"
              type="button"
              @click="loadJobs"
            >
              Try again
            </button>
          </div>

          <div v-else-if="filteredJobs.length === 0" class="message">
            <h3>No matching jobs on this page</h3>
            <p>
              Try another keyword, change your filters, or check the next page.
            </p>

            <button
              v-if="activeFilterCount > 0"
              class="filter-button"
              type="button"
              @click="showFilters = true"
            >
              Change filters
            </button>
          </div>

          <div v-else class="job-list">
            <article
              v-for="job in filteredJobs"
              :key="job.uuid"
              class="job-card"
            >
              <div class="job-header">
                <div class="job-heading">
                  <h3>
                    <button
                      class="job-title-button"
                      type="button"
                      @click="selectJob(job)"
                    >
                      {{ job.title }}
                    </button>
                  </h3>

                  <p class="company-name">{{ getCompany(job) }}</p>

                  <p class="job-location">{{ getLocation(job) }}</p>
                </div>

                <button
                  class="save-button"
                  :class="{ saved: isSaved(job.uuid) }"
                  :aria-pressed="isSaved(job.uuid)"
                  type="button"
                  @click="toggleSaved(job.uuid)"
                >
                  {{ isSaved(job.uuid) ? "Saved" : "Save" }}
                </button>
              </div>

              <p v-if="resumeSkills.length > 0" class="resume-match">
                {{ getMatchCount(job) }} resume skills matched
              </p>

              <div class="job-info">
                <span>{{ getEmployment(job) }}</span>
                <span>{{ getSalary(job) }}</span>
                <span>{{ getExperience(job) }}</span>
              </div>

              <div
                v-if="job.skills && job.skills.length > 0"
                class="skills-box"
              >
                <p class="skills-heading">Required skills</p>

                <div class="skill-list">
                  <span
                    v-for="skill in job.skills.slice(0, 6)"
                    :key="skill.uuid || skill.skill"
                    class="skill"
                  >
                    {{ skill.skill }}
                  </span>

                  <span
                    v-if="job.skills.length > 6"
                    class="more-skills"
                  >
                    +{{ job.skills.length - 6 }} more
                  </span>
                </div>
              </div>

              <footer v-if="job.metadata" class="job-footer">
                <span v-if="job.metadata.newPostingDate">
                  Posted {{ job.metadata.newPostingDate }}
                </span>

                <span v-if="job.metadata.expiryDate">
                  Closes {{ job.metadata.expiryDate }}
                </span>
              </footer>
            </article>
          </div>
        </div>

        <nav
          v-if="!loading && !error && totalPages > 1"
          class="page-controls"
          aria-label="Job result pages"
        >
          <button
            class="page-button"
            type="button"
            :disabled="page === 0"
            @click="changePage(page - 1)"
          >
            Previous
          </button>

          <span>Page {{ page + 1 }} of {{ totalPages }}</span>

          <button
            class="page-button"
            type="button"
            :disabled="page + 1 >= totalPages"
            @click="changePage(page + 1)"
          >
            Next
          </button>
        </nav>
      </section>

      <p v-if="saveMessage" class="save-message" role="status">
        {{ saveMessage }}
      </p>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import axios from "axios";
import JobsFilter from "./JobsFilter.vue";
import JobsSelect from "./JobsSelect.vue";

const apiUrl = "/api/mcf/v2/jobs";
const storageKey = "inturn-saved-job-ids";
const jobsPerPage = 10;

const searchInput = ref("");
const searchKeyword = ref("");
const jobs = ref([]);
const total = ref(0);
const page = ref(0);
const loading = ref(false);
const error = ref("");

const selectedJob = ref(null);

// Populate this with actual extracted or user-confirmed resume skills.
const resumeSkills = ref([]);

function selectJob(job) {
  selectedJob.value = job;
}

const savedJobs = ref([]);
const saveMessage = ref("");
const showFilters = ref(false);

const filters = ref({
  location: "",
  category: "",
  skills: [],
});

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(total.value / jobsPerPage));
});

const activeFilterCount = computed(() => {
  let count = filters.value.skills.length;

  if (filters.value.location !== "") {
    count++;
  }

  if (filters.value.category !== "") {
    count++;
  }

  return count;
});

const filteredJobs = computed(() => {
  const results = [];

  for (let i = 0; i < jobs.value.length; i++) {
    const job = jobs.value[i];
    let matches = true;

    // Location filter
    if (filters.value.location !== "") {
      let locationMatches = false;

      const addressHidden =
        job.metadata && job.metadata.isHideCompanyAddress;

      if (!addressHidden && job.address && job.address.districts) {
        for (let j = 0; j < job.address.districts.length; j++) {
          if (
            job.address.districts[j].region ===
            filters.value.location
          ) {
            locationMatches = true;
          }
        }
      }

      if (!locationMatches) {
        matches = false;
      }
    }

    // Category filter
    if (filters.value.category !== "") {
      let categoryMatches = false;

      if (job.categories) {
        for (let j = 0; j < job.categories.length; j++) {
          if (
            job.categories[j].category === filters.value.category
          ) {
            categoryMatches = true;
          }
        }
      }

      if (!categoryMatches) {
        matches = false;
      }
    }

    // Job must include every skill selected in JobsFilter.
    for (let j = 0; j < filters.value.skills.length; j++) {
      let skillMatches = false;

      if (job.skills) {
        for (let k = 0; k < job.skills.length; k++) {
          if (job.skills[k].skill === filters.value.skills[j]) {
            skillMatches = true;
          }
        }
      }

      if (!skillMatches) {
        matches = false;
      }
    }

    if (matches) {
      results.push(job);
    }
  }

  // Rank the filtered jobs by resume skill matches.
  // Higher counts appear first.
  // Jobs with equal counts keep their original API order.
  for (let i = 1; i < results.length; i++) {
    const currentJob = results[i];
    const currentCount = getMatchCount(currentJob);

    let position = i - 1;

    while (
      position >= 0 &&
      getMatchCount(results[position]) < currentCount
    ) {
      results[position + 1] = results[position];
      position--;
    }

    results[position + 1] = currentJob;
  }

  return results;
});

function updateFilters(newFilters) {
  filters.value = newFilters;
}

async function loadJobs() {
  if (loading.value) {
    return;
  }

  loading.value = true;
  error.value = "";

  try {
    const response = await axios.get(apiUrl, {
      params: {
        search: searchKeyword.value,
        page: page.value,
        limit: jobsPerPage,
        sortBy: "new_posting_date",
      },
    });

    if (
      !response.data ||
      !Array.isArray(response.data.results) ||
      typeof response.data.total !== "number"
    ) {
      throw new Error("Unexpected API response");
    }

    jobs.value = response.data.results;
    total.value = response.data.total;
  } catch (err) {
    console.error(err);

    jobs.value = [];
    total.value = 0;
    error.value = "Jobs could not be loaded. Please try again.";
  }

  loading.value = false;
}

function searchJobs() {
  if (loading.value) {
    return;
  }

  searchKeyword.value = searchInput.value;
  page.value = 0;
  loadJobs();
}

function changePage(newPage) {
  if (
    loading.value ||
    newPage < 0 ||
    newPage >= totalPages.value
  ) {
    return;
  }

  page.value = newPage;
  loadJobs();
}

function getCompany(job) {
  if (job.metadata && job.metadata.isHideEmployerName) {
    return "Company undisclosed";
  }

  if (job.postedCompany && job.postedCompany.name) {
    return job.postedCompany.name;
  }

  return "Company not specified";
}

function getLocation(job) {
  if (job.metadata && job.metadata.isHideCompanyAddress) {
    return "Location not disclosed";
  }

  if (!job.address) {
    return "Location not specified";
  }

  if (job.address.isOverseas) {
    if (typeof job.address.overseasCountry === "string") {
      return job.address.overseasCountry;
    }

    return "Overseas";
  }

  if (job.address.street) {
    if (job.address.block) {
      return job.address.block + " " + job.address.street;
    }

    return job.address.street;
  }

  if (job.address.districts && job.address.districts.length > 0) {
    return job.address.districts[0].location;
  }

  return "Singapore";
}

function getEmployment(job) {
  if (!job.employmentTypes || job.employmentTypes.length === 0) {
    return "Employment type not specified";
  }

  let employment = "";

  for (let i = 0; i < job.employmentTypes.length; i++) {
    if (i > 0) {
      employment += " / ";
    }

    employment += job.employmentTypes[i].employmentType;
  }

  return employment;
}

function getSalary(job) {
  if (job.metadata && job.metadata.isHideSalary) {
    return "Salary not disclosed";
  }

  if (!job.salary) {
    return "Salary not disclosed";
  }

  const minimum = job.salary.minimum;
  const maximum = job.salary.maximum;
  let salary = "";

  if (minimum > 0 && maximum > 0) {
    if (minimum === maximum) {
      salary = "S$" + minimum;
    } else {
      salary = "S$" + minimum + " – S$" + maximum;
    }
  } else if (minimum > 0) {
    salary = "From S$" + minimum;
  } else if (maximum > 0) {
    salary = "Up to S$" + maximum;
  } else {
    return "Salary not disclosed";
  }

  if (job.salary.type && job.salary.type.salaryType) {
    salary += " / " + job.salary.type.salaryType;
  }

  return salary;
}

function getExperience(job) {
  const years = job.minimumYearsExperience;

  if (years === null || years === undefined || years === "") {
    return "Experience not specified";
  }

  if (years === 0) {
    return "No minimum experience";
  }

  if (years === 1) {
    return "1 year experience";
  }

  return years + " years experience";
}

function getMatchCount(job) {
  if (!job.skills || resumeSkills.value.length === 0) {
    return 0;
  }

  const matchedSkills = [];

  for (let i = 0; i < job.skills.length; i++) {
    const jobSkill = job.skills[i].skill;

    if (typeof jobSkill === "string") {
      const skillName = jobSkill.trim().toLowerCase();

      for (let j = 0; j < resumeSkills.value.length; j++) {
        const resumeSkill = resumeSkills.value[i];

        if (typeof resumeSkill === "string" && resumeSkill.trim().toLowerCase() === skillName
        && !matchedSkills.includes(skillName)) {
          matchedSkills.push(skillName);
        }
      }
    }
  }

  return matchedSkills.length;

}

function isSaved(jobId) {
  return savedJobs.value.includes(jobId);
}

function toggleSaved(jobId) {
  const index = savedJobs.value.indexOf(jobId);

  if (index === -1) {
    savedJobs.value.push(jobId);
    saveMessage.value = "Job saved.";
  } else {
    savedJobs.value.splice(index, 1);
    saveMessage.value = "Job removed from saved jobs.";
  }

  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify(savedJobs.value)
    );
  } catch (err) {
    console.error(err);
    saveMessage.value =
      "Your selection changed, but could not be stored in this browser.";
  }
}

onMounted(() => {
  try {
    const storedJobs = localStorage.getItem(storageKey);

    if (storedJobs) {
      const parsedJobs = JSON.parse(storedJobs);

      if (Array.isArray(parsedJobs)) {
        savedJobs.value = parsedJobs;
      }
    }
  } catch (err) {
    console.error(err);
    savedJobs.value = [];
  }

  loadJobs();
});
</script>

<style scoped>
.jobs-view {
  width: 100%;
  min-width: 0;
  padding: 24px;
  background: #f6f8ff;
  color: #17234b;
  font-family: Arial, sans-serif;
}

.jobs-view,
.jobs-view * {
  box-sizing: border-box;
}

.h3 {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 600;
  line-height: 1.3;
}

.text-body-secondary {
  margin: 0 0 24px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.6;
}

button,
input {
  font: inherit;
}

button {
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.search-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  width: 100%;
  margin-bottom: 24px;
  padding: 14px;
  border: 1px solid #dce3f0;
  border-radius: 14px;
  background: white;
}

.search-bar label {
  color: #526079;
  font-size: 13px;
  font-weight: 600;
}

.search-bar input {
  flex: 1;
  min-width: 150px;
  padding: 12px 14px;
  border: 1px solid #dce3f0;
  border-radius: 10px;
  background: #f5f8ff;
  color: #17234b;
  font-size: 14px;
}

.search-button,
.filter-button,
.page-button {
  padding: 11px 18px;
  border: 1px solid transparent;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
}

.search-button {
  background: #2563eb;
  color: white;
}

.search-button:hover:not(:disabled) {
  background: #1d4ed8;
}

.filter-button,
.page-button {
  border-color: #dfe7fa;
  background: #edf3ff;
  color: #234b94;
}

.filter-button:hover:not(:disabled),
.page-button:hover:not(:disabled) {
  background: #dfeaff;
}

.results-panel {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  background: white;
}

.results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
  padding: 22px;
  border-bottom: 1px solid #e9edf5;
}

.results-header h2 {
  margin: 0;
  font-size: 20px;
}

.results-header p {
  margin: 7px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.source-label {
  padding: 7px 11px;
  border-radius: 20px;
  background: #ccf7e7;
  color: #075b46;
  font-size: 12px;
  font-weight: 600;
}

.results-body {
  padding: 18px;
}

.job-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.job-card {
  min-width: 0;
  padding: 22px;
  border: 1px solid #e9edf5;
  border-radius: 16px;
  background: white;
}

.job-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.job-heading {
  flex: 1;
  min-width: 0;
}

.job-heading h3 {
  margin: 0;
  color: #2459ce;
  font-size: 18px;
  line-height: 1.5;
  word-wrap: break-word;
}

.company-name {
  margin: 5px 0;
  color: #526079;
  font-size: 13px;
  line-height: 1.5;
  word-wrap: break-word;
}

.job-location {
  margin: 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
  word-wrap: break-word;
}

.save-button {
  padding: 8px 12px;
  border: 1px solid #dfe7fa;
  border-radius: 8px;
  background: #edf3ff;
  color: #234b94;
  font-size: 12px;
  font-weight: 600;
}

.save-button:hover {
  background: #dfeaff;
}

.save-button.saved {
  border-color: #81dfbd;
  background: #ccf7e7;
  color: #075b46;
}

.job-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.job-info span {
  padding: 7px 10px;
  border-radius: 8px;
  background: #edf3ff;
  color: #234b94;
  font-size: 12px;
  line-height: 1.5;
}

.skills-box {
  margin-top: 16px;
  padding: 14px;
  border-radius: 10px;
  background: #edf3ff;
}

.skills-heading {
  margin: 0 0 10px;
  color: #234b94;
  font-size: 12px;
  font-weight: 600;
}

.skill-list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.skill {
  max-width: 100%;
  padding: 6px 10px;
  border: 1px solid #d6f1e6;
  border-radius: 8px;
  background: #effcf6;
  color: #075b46;
  font-size: 12px;
  line-height: 1.5;
  word-wrap: break-word;
}

.more-skills {
  color: #526079;
  font-size: 12px;
}

.job-footer {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
  color: #64748b;
  font-size: 12px;
}

.page-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 18px 22px;
  border-top: 1px solid #e9edf5;
}

.page-controls span {
  color: #64748b;
  font-size: 13px;
}

.message {
  padding: 36px 16px;
  color: #64748b;
  text-align: center;
}

.message h3 {
  margin: 0 0 12px;
  color: #17234b;
  font-size: 18px;
}

.message p {
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.6;
}

.save-message {
  margin-top: 14px;
  color: #075b46;
  font-size: 13px;
}

.job-title-button {
  padding: 0;
  border: none;
  background: transparent;
  color: #2459ce;
  font: inherit;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}

.job-title-button:hover {
  text-decoration: underline;
}

.resume-match {
  display: inline-block;
  margin: 12px 0 0;
  padding: 7px 10px;
  border-radius: 8px;
  background: #ccf7e7;
  color: #075b46;
  font-size: 12px;
  font-weight: 600;
}
</style>