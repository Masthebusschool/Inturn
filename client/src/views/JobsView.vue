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
      :jobs="filterOptionsJobs"
      :result-count="total"
      @update:model-value="updateFilters"
      @close="showFilters = false"
    />

    <div v-else>
      <header class="page-header">
        <div>
          <h1 class="header-title">Job Discovery</h1>
          <p class="header-subtitle">
            Live internship and job listings from public job boards, sort and filter to your needs.
          </p>
        </div>
      </header>

      <div
        v-if="!matchingResumeLoading && !matchingResumeName" class="resume-notice" role="status"
      >
        You have no resume available for job matching.
        Results will not be tailored to your skills.
        <RouterLink to="/resumes">
          Upload your resume here
        </RouterLink>.
      </div>

      <form class="card-inturn search-bar" @submit.prevent="searchJobs">
        <label for="job-search">Search Internships</label>

        <input
          id="job-search"
          v-model.trim="searchInput"
          type="search"
          class="input-inturn"
          placeholder="Search internships..."
          :disabled="loading"
        />

        <button
          class="btn-primary-inturn"
          type="submit"
          :disabled="loading"
        >
          Search
        </button>

        <button
          class="btn-secondary-inturn"
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

      <p v-if="matchingResumeName" class="matching-source">
        Matching against (latest viewed resume available): {{ matchingResumeName }}
      </p>

      <div v-if="activeFilters.length > 0" class="active-filter-tags">
        <button
          v-for="filter in activeFilters"
          :key="filter.key"
          class="chip-inturn is-active"
          type="button"
          :aria-label="'Remove filter: ' + filter.label"
          @click="removeSearchFilter(filter)"
        >
          {{ filter.label }}
          <span aria-hidden="true">×</span>
        </button>

        <button
          class="btn-link-inturn"
          type="button"
          @click="clearSearchFilters"
        >
          Clear all
        </button>
      </div>

      <section class="card-inturn results-panel">
        <header class="results-header">
          <div>
            <h2 class="section-title mb-0">Search Results</h2>

            <p v-if="loading">{{ loadingMessage }}</p>

            <p v-else-if="error">Results unavailable</p>

            <p v-else>
              {{ filteredJobs.length }} matches on this page ·
              {{ total }} internships found by keyword
            </p>

            <p v-if="!loading && !error">
              Sort and filters apply to the results.
            </p>

          </div>

          <div class="sort-control">
          <label for="job-sort">Sort by</label>

          <select id="job-sort" v-model="sortBy" class="input-inturn">
            <option value="skills">Best Skill Match</option>
            <option value="closing-earliest">Closing Date: Earliest first</option>
            <option value="closing-latest">Closing Date: Latest first</option>
            <option value="pay-highest">Monthly Pay: Highest first</option>
            <option value="pay-lowest">Monthly Pay: Lowest first</option>
            <option value="company-az">Company Name: A-Z</option>
            <option value="company-za">Company Name: Z-A</option>
          </select>
        </div>

          <span class="badge rounded-pill bg-success-subtle text-success-emphasis">MyCareersFuture</span>
        </header>

        <div class="results-body">
          <div v-if="loading" class="message" role="status">
            <p>{{ loadingMessage }}</p>
          </div>

          <div v-else-if="error" class="message" role="alert">
            <h3>Unable to load internships</h3>
            <p>{{ error }}</p>

            <button
              class="btn-neutral-inturn"
              type="button"
              @click="loadJobs"
            >
              Try again
            </button>
          </div>

          <div v-else-if="filteredJobs.length === 0" class="message">
            <h3>No matching internships</h3>
            <p>
              Try another keyword, change your filters, or check the next page.
            </p>

            <button
              v-if="activeFilterCount > 0"
              class="btn-secondary-inturn"
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
              class="card-inturn job-card"
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
                  class="btn-sm-inturn"
                  :class="isSaved(job.uuid) ? 'btn-primary-inturn' : 'btn-secondary-inturn'"
                  :aria-pressed="isSaved(job.uuid)"
                  :disabled="!savedStateReady || isSaving(job.uuid)"
                  type="button"
                  @click="toggleSaved(job.uuid)"
                >
                  {{isSaving(job.uuid) ? "Updating..." : isSaved(job.uuid) ? "Saved" : "Save"}}
                </button>
              </div>

              <!-- filters skill match -->
              <p
                v-if="filters.skills.length > 0"
                class="resume-match"
              >
                {{ getSelectedSkillMatchCount(job) }} of
                {{ filters.skills.length }} filtered skills matched
              </p>

              <!-- resume skill match -->
              <div
                v-if="resumeSkills.length > 0"
                class="resume-match"
              >
                <template v-if="getMatchPercentage(job) !== null">
                  <strong>
                    {{ getMatchPercentage(job) }}% skills matched with resume
                  </strong>

                  <span>
                    {{ getMatchCount(job) }} of
                    {{ getJobSkillNames(job).length }} listed skills
                  </span>
                </template>

                <span v-else>
                  No listed skills available for comparison
                </span>
              </div>

              <div class="job-info">
                <span class="tag-inturn">{{ getEmployment(job) }}</span>
                <span class="tag-inturn">{{ getSalary(job) }}</span>
                <span class="tag-inturn">{{ getExperience(job) }}</span>
              </div>

              <div
                v-if="job.skills && job.skills.length > 0"
                class="card-muted-inturn skills-box"
              >
                <p class="skills-heading">Required skills</p>

                <div class="skill-list">
                  <span
                    v-for="skill in job.skills.slice(0, 6)"
                    :key="skill.uuid || skill.skill"
                    class="tag-inturn"
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

        <p
          v-if="!loading && !error && !hasNextPage"
          class="message"
        >
          You have reached the end of the available search results.
        </p>

        <nav
          v-if="!loading && !error && totalPages > 1"
          class="page-controls"
          aria-label="Job result pages"
        >
          <button
            class="btn-neutral-inturn btn-sm-inturn"
            type="button"
            :disabled="page === 0"
            @click="changePage(page - 1)"
          >
            Previous
          </button>

          <span>Page {{ page + 1 }} of {{ totalPages }}</span>

          <form class="page-jump" @submit.prevent="goToPage">
            <label for="page-number">Go to page</label>

            <input
              id="page-number"
              v-model="pageInput"
              type="number"
              min="1"
              :max="totalPages"
              step="1"
              class="input-inturn"
              placeholder="Page"
              required
            />

            <button class="btn-neutral-inturn btn-sm-inturn" type="submit">
              Go
            </button>
          </form>

          <button
            class="btn-neutral-inturn btn-sm-inturn"
            type="button"
            :disabled="loading || !hasNextPage"
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

import JobsFilter from "../components/jobs/JobsFilter.vue";
import JobsSelect from "../components/jobs/JobsSelect.vue";

import { matchingResumeLoading } from "../stores/jobMatch.js";
import { useJobsView } from "../helpers/useJobsView.js";

const {
  searchInput,
  jobs,
  filteredJobs,
  filterOptionsJobs,
  total,
  totalPages,
  page,
  pageInput,
  hasNextPage,
  loading,
  loadingMessage,
  error,
  updatedAt,
  selectedJob,
  showFilters,
  filters,
  sortBy,
  resumeSkills,
  matchingResumeName,
  activeFilters,
  activeFilterCount,
  saveMessage,
  savedStateReady,
  loadJobs,
  updateFilters,
  removeSearchFilter,
  clearSearchFilters,
  searchJobs,
  changePage,
  goToPage,
  selectJob,
  getCompany,
  getLocation,
  getEmployment,
  getSalary,
  getExperience,
  getJobSkillNames,
  getMatchCount,
  getMatchPercentage,
  getSelectedSkillMatchCount,
  isSaved,
  toggleSaved,
  isSaving,
} = useJobsView();
</script>

<style scoped>
.jobs-view {
  width: 100%;
  min-width: 0;
}

.jobs-view,
.jobs-view * {
  box-sizing: border-box;
}

.search-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 1.5rem;
}

.search-bar label {
  color: var(--inturn-text-soft);
  font-size: 13px;
  font-weight: 600;
}

.search-bar input {
  flex: 1;
  width: auto;
  min-width: 150px;
}

/* Header and body have their own padding */
.results-panel {
  padding: 0;
}

.results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
  padding: 1.25rem;
  border-bottom: 1px solid var(--inturn-border);
}

.results-header p {
  margin: 7px 0 0;
  color: var(--inturn-text-muted);
  font-size: 13px;
  line-height: 1.6;
}

.results-body {
  padding: 1.25rem;
}

.job-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.job-card {
  min-width: 0;
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
  font-size: 18px;
  line-height: 1.5;
  word-wrap: break-word;
}

.job-title-button {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--inturn-primary-hover);
  font: inherit;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}

.job-title-button:hover {
  text-decoration: underline;
}

.company-name {
  margin: 5px 0;
  color: var(--inturn-text-soft);
  font-size: 13px;
  line-height: 1.5;
  word-wrap: break-word;
}

.job-location {
  margin: 0;
  color: var(--inturn-text-muted);
  font-size: 12px;
  line-height: 1.5;
  word-wrap: break-word;
}

.job-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.skills-box {
  margin-top: 16px;
}

.skills-heading {
  margin: 0 0 10px;
  color: var(--inturn-text-soft);
  font-size: 12px;
  font-weight: 600;
}

.skill-list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.more-skills {
  color: var(--inturn-text-muted);
  font-size: 12px;
}

.job-footer {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
  color: var(--inturn-text-muted);
  font-size: 12px;
}

/* Skill match result (green = good news) */
.resume-match {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 12px 0 0;
  padding: 0.4rem 0.75rem;
  border-radius: var(--r-sm);
  background: var(--bs-success-bg-subtle);
  color: var(--bs-success-text-emphasis);
  font-size: 12px;
}

.matching-source {
  margin: 0 0 14px;
  color: var(--inturn-text-soft);
  font-size: 13px;
}

.active-filter-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}

.sort-control {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.sort-control label {
  color: var(--inturn-text-soft);
  font-size: 13px;
}

.sort-control select {
  width: auto;
  max-width: 100%;
}

.page-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--inturn-border);
}

.page-controls span {
  color: var(--inturn-text-muted);
  font-size: 13px;
}

.page-jump {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.page-jump label {
  color: var(--inturn-text-soft);
  font-size: 13px;
}

.page-jump input {
  width: 85px;
}

.message {
  padding: 36px 16px;
  color: var(--inturn-text-muted);
  text-align: center;
}

.message h3 {
  margin: 0 0 12px;
  color: var(--inturn-text);
  font-size: 18px;
}

.message p {
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.6;
}

.save-message {
  margin-top: 14px;
  color: var(--bs-success-text-emphasis);
  font-size: 13px;
}

.resume-notice {
  width: 100%;
  margin-bottom: 20px;
  padding: 14px 18px;
  border: 1px solid #fecaca;
  border-radius: 12px;
  background: #fff1f2;
  color: #b91c1c;
  font-size: 14px;
  line-height: 1.6;
}

.resume-notice a {
  color: inherit;
  font-weight: 600;
  text-decoration: underline;
}

.resume-notice a:hover {
  color: #7f1d1d;
}
</style>
