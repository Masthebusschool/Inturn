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

      <p v-if="matchingResumeName" class="matching-source">
        Matching against: {{ matchingResumeName }}
      </p>

      <div v-if="activeFilters.length > 0" class="active-filter-tags">
        <button
          v-for="filter in activeFilters"
          :key="filter.key"
          class="active-filter-tag"
          type="button"
          :aria-label="'Remove filter: ' + filter.label"
          @click="removeSearchFilter(filter)"
        >
          {{ filter.label }}
          <span aria-hidden="true">×</span>
        </button>

        <button
          class="clear-filters"
          type="button"
          @click="clearSearchFilters"
        >
          Clear all
        </button>
      </div>

      <section class="results-panel">
        <header class="results-header">
          <div>
            <h2>Search Results</h2>

            <p v-if="loading">{{ loadingMessage }}</p>

            <p v-else-if="error">Results unavailable</p>

            <p v-else>
              {{ filteredJobs.length }} matches on this page ·
              {{ total }} jobs found by keyword
            </p>

            <p v-if="!loading && !error">
              Sort and filters apply to the results.
            </p>

            <p v-else-if="!loading && !error && resumeSkills.length === 0">
              Upload your resume to rank jobs by match.
            </p>
          </div>

          <div class="sort-control">
          <label for="job-sort">Sort by</label>

          <select id="job-sort" v-model="sortBy">
            <option value="skills">Best Skill Match</option>
            <option value="closing-earliest">Closing Date: Earliest first</option>
            <option value="closing-latest">Closing Date: Latest first</option>
            <option value="pay-highest">Monthly Pay: Highest first</option>
            <option value="pay-lowest">Monthly Pay: Lowest first</option>
            <option value="company-az">Company Name: A-Z</option>
            <option value="company-za">Company Name: Z-A</option>
          </select>
        </div>

          <span class="source-label">MyCareersFuture</span>
        </header>

        <div class="results-body">
          <div v-if="loading" class="message" role="status">
            <p>{{ loadingMessage }}</p>
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
            <h3>No matching jobs</h3>
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
                {{ filters.skills.length }} selected skills matched
              </p>

              <!-- resume skill match -->
              <div
                v-if="resumeSkills.length > 0"
                class="resume-match"
              >
                <template v-if="getMatchPercentage(job) !== null">
                  <strong>
                    {{ getMatchPercentage(job) }}% skills matched
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
            class="page-button"
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
              placeholder="Page"
              required
            />

            <button class="page-button" type="submit">
              Go
            </button>
          </form>

          <button
            class="page-button"
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

import JobsFilter from "./JobsFilter.vue";
import JobsSelect from "./JobsSelect.vue";

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
  max-width: 1100px;
}

.jobs-view,
.jobs-view * {
  box-sizing: border-box;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 8px;
}

.header-title {
  font-size: 1.15rem;
  font-weight: 700;
  margin-bottom: 0.15rem;
}

.header-subtitle {
  font-size: 0.8rem;
  margin-bottom: 0;
}

@media (max-width: 576px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }
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
  border-radius: 12px;
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
  border-radius: 16px;
  background: #f3f3f3;
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

.matching-source {
  margin: 0 0 14px;
  color: #526079;
  font-size: 13px;
}

.active-filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.active-filter-tag {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: none;
  border-radius: 20px;
  background: #ccf7e7;
  color: #075b46;
  font-size: 13px;
}

.active-filter-tag:hover {
  background: #a7efd6;
}

.active-filter-tag span {
  font-size: 18px;
}

.clear-filters {
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #2459ce;
  font-size: 13px;
}

.sort-control {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.sort-control label {
  color: #526079;
  font-size: 13px;
}

.sort-control select {
  max-width: 100%;
  padding: 10px 12px;
  border: 1px solid #dce3f0;
  border-radius: 10px;
  background: #f5f8ff;
  color: #17234b;
  font: inherit;
  font-size: 13px;
}

.resume-match {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding: 9px 12px;
  border-radius: 10px;
  background: #ccf7e7;
  color: #075b46;
  font-size: 12px;
}

.page-jump {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.page-jump label {
  color: #526079;
  font-size: 13px;
}

.page-jump input {
  width: 85px;
  padding: 9px 10px;
  border: 1px solid #dce3f0;
  border-radius: 8px;
  background: #f5f8ff;
  color: #17234b;
  font: inherit;
  font-size: 13px;
}
</style>