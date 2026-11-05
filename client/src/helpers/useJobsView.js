import {ref, computed, watch, onMounted, onUnmounted} from "vue";
import axios from "axios";
import { resumeSkills, matchingResumeName} from "../stores/jobMatch.js";

export function useJobsView() {
  const jobsPerPage = 10;

  const searchInput = ref("");
  const searchKeyword = ref("");

  const jobs = ref([]);
  const filterOptionsJobs = ref([]);

  const total = ref(0);
  const page = ref(0);
  const pageInput = ref("");

  const loading = ref(false);
  const loadingMessage = ref("Loading internships...");
  const error = ref("");
  const updatedAt = ref("");

  const selectedJob = ref(null);
  const showFilters = ref(false);

  const saveMessage = ref("");

  const trackedJobs = ref([]);
  const savingJobIds = ref([]);
  const savedStateReady = ref(false);

  let notificationTimer;

  const filters = ref({
    location: "",
    category: "",
    skills: [],
    minSalary: "",
    maxSalary: "",
  });

  const sortBy = ref("skills");

  // The server already filtered, ranked and paginated these jobs.
  const filteredJobs = computed(() => jobs.value);

  const totalPages = computed(() => {
    return Math.ceil(total.value / jobsPerPage);
  });

  const hasNextPage = computed(() => {
    return page.value + 1 < totalPages.value;
  });

  function hasPayValue(value) {
    return (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    );
  }

  const activeFilters = computed(() => {
    const tags = [];

    if (filters.value.location) {
      tags.push({
        key: "location",
        type: "location",
        label: filters.value.location,
      });
    }

    if (filters.value.category) {
      tags.push({
        key: "category",
        type: "category",
        label: filters.value.category,
      });
    }

    for (const skill of filters.value.skills) {
      tags.push({
        key: "skill-" + skill,
        type: "skill",
        value: skill,
        label: skill,
      });
    }

    if (hasPayValue(filters.value.minSalary)) {
      tags.push({
        key: "minSalary",
        type: "minSalary",
        label:
          "Minimum S$" +
          filters.value.minSalary +
          "/month",
      });
    }

    if (hasPayValue(filters.value.maxSalary)) {
      tags.push({
        key: "maxSalary",
        type: "maxSalary",
        label:
          "Maximum S$" +
          filters.value.maxSalary +
          "/month",
      });
    }

    return tags;
  });

  const activeFilterCount = computed(() => {
    return activeFilters.value.length;
  });

  let controller;
  let timer;
  let requestVersion = 0;
  let disposed = false;

  async function loadJobs() {
    if (disposed) return;

    clearTimeout(timer);

    const version = ++requestVersion;

    controller?.abort();

    const currentController = new AbortController();
    controller = currentController;

    loading.value = true;
    loadingMessage.value = "Loading internships...";
    error.value = "";

    try {
      const response = await axios.post(
        "/api/jobs/search",
        {
          search: searchKeyword.value,
          ...filters.value,
          resumeSkills: resumeSkills.value,
          sortBy: sortBy.value,
          page: page.value,
          limit: jobsPerPage,
        },
        {
          signal: currentController.signal,
          withCredentials: true,
          timeout: 60000,
        }
      );

      if (
        version !== requestVersion ||
        disposed
      ) {
        return;
      }

      const data = response.data;

      if (
        !Array.isArray(data.results) ||
        !Number.isInteger(data.total) ||
        data.total < 0 ||
        !Number.isInteger(data.page) ||
        data.page < 0
      ) {
        throw new Error("Unexpected internship response.");
      }

      jobs.value = data.results;
      total.value = data.total;
      page.value = data.page;

      filterOptionsJobs.value =
        Array.isArray(data.filterOptionsJobs)
          ? data.filterOptionsJobs
          : [];

      updatedAt.value = data.updatedAt || "";
    } catch (err) {
      if (
        version !== requestVersion ||
        disposed ||
        axios.isCancel(err)
      ) {
        return;
      }

      jobs.value = [];
      total.value = 0;

      const serverMessage = err.response?.data?.error;
      const status = err.response?.status;

      if (typeof serverMessage === "string") {
        error.value = serverMessage;
      } else if (err.code === "ECONNABORTED") {
        error.value =
          "Loading internships took too long. Please try again.";
      } else if (status) {
        error.value =
          `Internships request failed: HTTP ${status}.`;
      } else {
        error.value =
          err.message ||
          "Could not connect to the internships server.";
      }
    } finally {
      if (
        version === requestVersion &&
        !disposed
      ) {
        loading.value = false;
      }
    }
  }

  function restartSearch() {
    page.value = 0;
    pageInput.value = "";

    clearTimeout(timer);

    requestVersion++;
    controller?.abort();

    loading.value = true;
    loadingMessage.value = "Updating results...";
    error.value = "";

    timer = setTimeout(loadJobs, 250);
  }

  // Changes restart pagination at page 1.
  watch(
    [filters, sortBy, resumeSkills],
    restartSearch,
    { deep: true }
  );

  function updateFilters(value) {
    filters.value = {
      location: value.location ?? "",
      category: value.category ?? "",
      skills: value.skills ?? [],
      minSalary: value.minSalary ?? "",
      maxSalary: value.maxSalary ?? "",
    };
  }

  function removeSearchFilter(filter) {
    if (filter.type === "skill") {
      const index = filters.value.skills.indexOf(
        filter.value
      );

      if (index !== -1) {
        filters.value.skills.splice(index, 1);
      }
    } else {
      filters.value[filter.type] = "";
    }
  }

  function clearSearchFilters() {
    filters.value = {
      location: "",
      category: "",
      skills: [],
      minSalary: "",
      maxSalary: "",
    };
  }

  function searchJobs() {
    searchKeyword.value = searchInput.value.trim();
    page.value = 0;
    pageInput.value = "";
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

  function goToPage() {
    const value = Number(pageInput.value);

    if (
      Number.isInteger(value) &&
      value >= 1 &&
      value <= totalPages.value
    ) {
      changePage(value - 1);
      pageInput.value = "";
    }
  }

  async function selectJob(job) {
    loading.value = true;
    error.value = "";

    try {
      const response = await axios.get(
        "/api/jobs/" + job.uuid,
        { withCredentials: true }
      );

      if (!disposed) {
        selectedJob.value = response.data;
      }
    } catch {
      if (!disposed) {
        error.value =
          "Could not open internship details. Please try again.";
      }
    } finally {
      if (!disposed) {
        loading.value = false;
      }
    }
  }

  function getCompany(job) {
    if (job.metadata?.isHideEmployerName) {
      return "Company undisclosed";
    }

    return (
      job.postedCompany?.name ||
      "Company not specified"
    );
  }

  function getLocation(job) {
    if (job.metadata?.isHideCompanyAddress) {
      return "Location not disclosed";
    }

    const address = job.address;

    if (!address) return "Location not specified";

    if (address.isOverseas) {
      return typeof address.overseasCountry === "string"
        ? address.overseasCountry
        : "Overseas";
    }

    if (address.street) {
      return [address.block, address.street]
        .filter(Boolean)
        .join(" ");
    }

    return (
      address.districts?.[0]?.location ||
      "Singapore"
    );
  }

  function getEmployment(job) {
    return (
      (job.employmentTypes || [])
        .map((item) => item.employmentType)
        .join(" / ") ||
      "Employment type not specified"
    );
  }

  function getSalary(job) {
    if (job.metadata?.isHideSalary || !job.salary) {
      return "Salary not disclosed";
    }

    const minimum = Number(job.salary.minimum);
    const maximum = Number(job.salary.maximum);

    let text = "";

    if (minimum > 0 && maximum > 0) {
      text =
        minimum === maximum
          ? "S$" + minimum
          : "S$" + minimum + " – S$" + maximum;
    } else if (minimum > 0) {
      text = "From S$" + minimum;
    } else if (maximum > 0) {
      text = "Up to S$" + maximum;
    } else {
      return "Salary not disclosed";
    }

    const period = job.salary.type?.salaryType;

    return period ? text + " / " + period : text;
  }

  function getExperience(job) {
    const years = job.minimumYearsExperience;

    if (
      years === undefined ||
      years === null ||
      years === ""
    ) {
      return "Experience not specified";
    }

    if (years === 0) return "No minimum experience";
    if (years === 1) return "1 year experience";

    return years + " years experience";
  }

  function getJobSkillNames(job) {
    const names = [];

    for (const item of job.skills || []) {
      if (typeof item.skill === "string") {
        const name = item.skill.trim().toLowerCase();

        if (name && !names.includes(name)) {
          names.push(name);
        }
      }
    }

    return names;
  }

  function countMatchingSkills(job, selectedSkills) {
    const available = getJobSkillNames(job);
    const matches = [];

    for (const skill of selectedSkills) {
      if (typeof skill === "string") {
        const name = skill.trim().toLowerCase();

        if (
          available.includes(name) &&
          !matches.includes(name)
        ) {
          matches.push(name);
        }
      }
    }

    return matches.length;
  }

  // The server computes this with the same alias-aware skill matching it sorts "Best Skill
  // Match" by (see server/src/utils/skillNormalize.js), so the badge always agrees with the
  // order jobs are actually returned in. Don't recompute it client-side with plain string
  // comparison — that disagreed with the real sort and looked like results were ordered by
  // raw match count instead of percentage.
  function getMatchCount(job) {
    return job.matchCount ?? 0;
  }

  function getTotalSkillCount(job) {
    return job.totalSkillCount ?? 0;
  }

  function getSelectedSkillMatchCount(job) {
    return countMatchingSkills(
      job,
      filters.value.skills
    );
  }

  function getMatchPercentage(job) {
    return typeof job.matchPercentage === "number" ? job.matchPercentage : null;
  }

  function notify(message) {
  clearTimeout(notificationTimer);

  saveMessage.value = message;

  notificationTimer = setTimeout(() => {
    saveMessage.value = "";}, 10000);
  }

  function isSaved(jobId) {
    return trackedJobs.value.some(
      (application) => application.jobId === jobId
    );
  }

  function isSaving(jobId) {
    return savingJobIds.value.includes(jobId);
  }

  async function loadSavedJobs() {
    savedStateReady.value = false;

    try {
      const response = await axios.get(
        "/api/applications/discovery-saved",
        { withCredentials: true }
      );

      if (!Array.isArray(response.data)) {
        throw new Error("Unexpected saved-jobs response");
      }

      if (!disposed) {
        trackedJobs.value = response.data;
        savedStateReady.value = true;
      }
    } catch (error) {
      if (disposed) return;

      notify(
        error.response?.status === 401
          ? "Please sign in to save internships to your tracker."
          : "Could not load your saved internships. Refresh to try again."
      );
    }
  }

  async function toggleSaved(jobId) {
    if (!savedStateReady.value || isSaving(jobId)) {
      return;
    }

    savingJobIds.value.push(jobId);

    try {
      const existing = trackedJobs.value.find(
        (application) => application.jobId === jobId
      );

      if (existing) {
        if (existing.status !== "Saved") {
          notify(
            "This internship has moved beyond Saved. Manage it from the tracker board."
          );

          return;
        }

        await axios.delete(
          "/api/applications/discovery-saved/" + jobId,
          { withCredentials: true }
        );

        if (disposed) return;

        trackedJobs.value = trackedJobs.value.filter(
          (application) => application.jobId !== jobId
        );

        notify("Internship removed from Saved on your tracker board.");
      } else {
        const job =
          selectedJob.value?.uuid === jobId
            ? selectedJob.value
            : jobs.value.find((item) => item.uuid === jobId);

        if (!job) {
          notify("Internship information is unavailable. Please try again.");
          return;
        }

        const response = await axios.post(
          "/api/applications/discovery-saved",
          { job },
          { withCredentials: true }
        );

        if (disposed) return;

        trackedJobs.value = trackedJobs.value.filter(
          (application) => application.jobId !== jobId
        );

        trackedJobs.value.push(response.data);

        notify(
          response.data.status === "Saved"
            ? "Internship saved to your tracker board."
            : "This internship is already on your tracker board."
        );
      }
    } catch (error) {
      if (disposed) return;

      notify(
        error.response?.data?.error ||
          "Could not update the tracker board. Please try again."
      );

      if (error.response?.status === 409) {
        await loadSavedJobs();
      }
    } finally {
      if (!disposed) {
        savingJobIds.value = savingJobIds.value.filter(
          (id) => id !== jobId
        );
      }
    }
  }

  onMounted(() => {
    loadSavedJobs();
    loadJobs();
  });

  onUnmounted(() => {
    disposed = true;

    clearTimeout(timer);
    clearTimeout(notificationTimer);

    controller?.abort();
  });

  return {
    searchInput,
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
    getTotalSkillCount,
    getMatchPercentage,
    getSelectedSkillMatchCount,
    isSaved,
    toggleSaved,
    isSaving, 
  };
}