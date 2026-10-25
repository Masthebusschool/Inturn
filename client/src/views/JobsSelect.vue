<template>
  <section class="jobs-select">
    <header class="page-header">
      <button
        class="back-button"
        type="button"
        @click="emit('close')"
      >
        ← Back to Jobs
      </button>

      <button
        class="save-button"
        :class="{ saved: saved }"
        :aria-pressed="saved"
        type="button"
        @click="emit('save', job.uuid)"
      >
        {{ saved ? "Saved" : "Save Job" }}
      </button>
    </header>

    <!-- Job heading -->
    <section class="job-banner">
      <p class="company-name">{{ companyName }}</p>

      <h1>{{ job.title }}</h1>

      <p class="job-location">{{ location }}</p>

      <div class="job-tags">
        <span
          v-for="type in employmentTypes"
          :key="type.id || type.employmentType"
          class="info-tag"
        >
          {{ type.employmentType }}
        </span>

        <span class="info-tag">{{ salary }}</span>
      </div>

      <p class="source-note">Source: MyCareersFuture</p>
    </section>

    <!-- Job information -->
    <section class="detail-section">
      <h2>Job Information</h2>

      <div class="job-facts">
        <div>
          <span>Minimum experience</span>
          <strong>{{ experience }}</strong>
        </div>

        <div v-if="job.metadata && job.metadata.newPostingDate">
          <span>Posted</span>
          <strong>{{ job.metadata.newPostingDate }}</strong>
        </div>

        <div v-if="job.metadata && job.metadata.expiryDate">
          <span>Closing date</span>
          <strong>{{ job.metadata.expiryDate }}</strong>
        </div>

        <div v-if="job.metadata && job.metadata.jobPostId">
          <span>Listing reference</span>
          <strong>{{ job.metadata.jobPostId }}</strong>
        </div>

        <div v-if="job.numberOfVacancies">
          <span>Vacancies</span>
          <strong>{{ job.numberOfVacancies }}</strong>
        </div>
      </div>
    </section>

    <!-- Employer's description -->
    <section class="detail-section">
      <h2>About This Role</h2>

      <p class="job-description">
        {{
          description ||
          "Read the full description on MyCareersFuture."
        }}
      </p>
    </section>

    <!-- Resume skills -->
    <section class="detail-section">
      <h2>Skills and Resume Match</h2>

      <p v-if="jobSkills.length === 0" class="section-description">
        No structured skills were provided for this listing.
      </p>

      <template v-else>
        <div v-if="resumeSkills.length > 0" class="match-summary">
          <strong>
            {{ matchedSkills.length }} of {{ jobSkills.length }}
            listed skills matched
          </strong>

          <p>
            Compared against the resume skills supplied by your application.
          </p>
        </div>

        <p v-else class="section-description">
          Resume skills have not been connected yet. The job's listed
          skills are shown below.
        </p>

        <div class="skill-list">
          <span
            v-for="skill in jobSkills"
            :key="skill"
            class="skill-tag"
            :class="{
              matched:
                resumeSkills.length > 0 && hasResumeSkill(skill)
            }"
          >
            {{ skill }}

            <span v-if="resumeSkills.length > 0">
              {{
                hasResumeSkill(skill)
                  ? "✓ Matched"
                  : "Not matched"
              }}
            </span>
          </span>
        </div>

        <p v-if="resumeSkills.length > 0" class="small-note">
          This compares skill names without considering letter case.
          Different wording may not match. This is not an interview
          prediction.
        </p>
      </template>
    </section>

    <!-- Application questions -->
    <section class="detail-section">
      <h2>Application Questions</h2>

      <p
        v-if="loadingQuestions"
        class="section-description"
        role="status"
      >
        Checking for available questions...
      </p>

      <div v-else-if="questionError">
        <p class="section-description">{{ questionError }}</p>

        <button
          class="secondary-button"
          type="button"
          @click="loadQuestions"
        >
          Try again
        </button>
      </div>

      <template v-else-if="questions.length > 0">
        <p class="section-description">
          Prepare draft answers here. Complete the official questions on
          the application website when you apply.
        </p>

        <div
          v-for="(question, index) in questions"
          :key="index"
          class="question-box"
        >
          <label :for="'answer-' + index">
            {{ index + 1 }}. {{ question }}
          </label>

          <textarea
            :id="'answer-' + index"
            v-model="answers[index]"
            rows="4"
            placeholder="Draft your answer..."
          ></textarea>
        </div>

        <p class="small-note">
          Answers are not submitted or transferred to MyCareersFuture.
          Copy your drafts before going back or refreshing this page.
        </p>
      </template>

      <p v-else class="section-description">
        No readable application questions are available through this API
        response. The official application site may show additional
        questions.
      </p>
    </section>

    <!-- Apply link -->
    <footer class="apply-footer">
      <a
        v-if="applicationUrl"
        class="apply-button"
        :href="applicationUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        Apply on MyCareersFuture ↗
      </a>

      <p v-else class="section-description">
        An official listing link is not available for this job.
      </p>

      <p class="small-note">
        Opens the original listing in a new tab. Sign in and follow the
        application instructions there.
      </p>
    </footer>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import axios from "axios";

const props = defineProps({
  job: {
    type: Object,
    required: true,
  },
  resumeSkills: {
    type: Array,
    required: true,
  },
  saved: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(["close", "save"]);

const questions = ref([]);
const answers = ref([]);
const loadingQuestions = ref(false);
const questionError = ref("");

const companyName = computed(() => {
  const job = props.job;

  if (job.metadata && job.metadata.isHideEmployerName) {
    return "Company undisclosed";
  }

  if (job.postedCompany && job.postedCompany.name) {
    return job.postedCompany.name;
  }

  return "Company not specified";
});

const location = computed(() => {
  const job = props.job;

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
});

const employmentTypes = computed(() => {
  return props.job.employmentTypes || [];
});

const salary = computed(() => {
  const job = props.job;

  if (job.metadata && job.metadata.isHideSalary) {
    return "Salary not disclosed";
  }

  if (!job.salary) {
    return "Salary not disclosed";
  }

  const minimum = job.salary.minimum;
  const maximum = job.salary.maximum;
  let text = "";

  if (minimum > 0 && maximum > 0) {
    if (minimum === maximum) {
      text = "S$" + minimum;
    } else {
      text = "S$" + minimum + " – S$" + maximum;
    }
  } else if (minimum > 0) {
    text = "From S$" + minimum;
  } else if (maximum > 0) {
    text = "Up to S$" + maximum;
  } else {
    return "Salary not disclosed";
  }

  if (job.salary.type && job.salary.type.salaryType) {
    text += " / " + job.salary.type.salaryType;
  }

  return text;
});

const experience = computed(() => {
  const years = props.job.minimumYearsExperience;

  if (years === null || years === undefined || years === "") {
    return "Not specified";
  }

  if (years === 0) {
    return "No minimum experience";
  }

  if (years === 1) {
    return "1 year";
  }

  return years + " years";
});

// Basic text conversion for common HTML formatting.
// Vue displays the result as text using {{ description }}.
const description = computed(() => {
  let text = props.job.description || "";

  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<li[^>]*>/gi, "• ");
  text = text.replace(/<[^>]*>/g, "");
  text = text.replace(/&nbsp;/gi, " ");
  text = text.replace(/&amp;/gi, "&");
  text = text.replace(/&lt;/gi, "<");
  text = text.replace(/&gt;/gi, ">");
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/g, "'");

  return text.trim();
});

const jobSkills = computed(() => {
  const skills = [];
  const source = props.job.skills || [];

  for (let i = 0; i < source.length; i++) {
    const skill = source[i].skill;

    if (skill && !skills.includes(skill)) {
      skills.push(skill);
    }
  }

  return skills;
});

function hasResumeSkill(skill) {
  const keyword = skill.trim().toLowerCase();

  for (let i = 0; i < props.resumeSkills.length; i++) {
    const resumeSkill = props.resumeSkills[i];

    if (
      typeof resumeSkill === "string" &&
      resumeSkill.trim().toLowerCase() === keyword
    ) {
      return true;
    }
  }

  return false;
}

const matchedSkills = computed(() => {
  const skills = [];

  for (let i = 0; i < jobSkills.value.length; i++) {
    if (hasResumeSkill(jobSkills.value[i])) {
      skills.push(jobSkills.value[i]);
    }
  }

  return skills;
});

const applicationUrl = computed(() => {
  if (!props.job.metadata) {
    return "";
  }

  const link = props.job.metadata.jobDetailsUrl;

  if (typeof link !== "string") {
    return "";
  }

  if (
    link.startsWith("https://www.mycareersfuture.gov.sg/job/") ||
    link.startsWith("https://mycareersfuture.gov.sg/job/")
  ) {
    return link;
  }

  return "";
});

async function loadQuestions() {
  if (loadingQuestions.value) {
    return;
  }

  loadingQuestions.value = true;
  questionError.value = "";
  questions.value = [];
  answers.value = [];

  try {
    const response = await axios.get(
      "/api/mcf/v2/jobs/" +
        props.job.uuid +
        "/screening-questions"
    );

    if (!Array.isArray(response.data)) {
      throw new Error("Question format not supported");
    }

    const questionList = [];

    for (let i = 0; i < response.data.length; i++) {
      const item = response.data[i];
      let text = "";

      if (typeof item === "string") {
        text = item;
      } else if (item && typeof item.question === "string") {
        text = item.question;
      } else if (item && typeof item.questionText === "string") {
        text = item.questionText;
      }

      if (text.trim() !== "") {
        questionList.push(text);
      }
    }

    if (response.data.length > 0 && questionList.length === 0) {
      throw new Error("Question format not supported");
    }

    questions.value = questionList;

    for (let i = 0; i < questionList.length; i++) {
      answers.value.push("");
    }
  } catch (err) {
    console.error(err);

    questionError.value =
      "Questions could not be displayed. Check the official listing when applying.";
  }

  loadingQuestions.value = false;
}

onMounted(() => {
  loadQuestions();
});
</script>

<style scoped>
.jobs-select {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  color: #17234b;
  font-family: Arial, sans-serif;
}

.jobs-select,
.jobs-select * {
  box-sizing: border-box;
}

button,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}

.back-button {
  padding: 9px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #2459ce;
  font-size: 14px;
  font-weight: 600;
}

.back-button:hover {
  background: #e6edff;
}

.save-button,
.secondary-button {
  padding: 10px 14px;
  border: 1px solid #dfe7fa;
  border-radius: 10px;
  background: #edf3ff;
  color: #234b94;
  font-size: 13px;
  font-weight: 600;
}

.save-button:hover,
.secondary-button:hover {
  background: #dfeaff;
}

.save-button.saved {
  border-color: #81dfbd;
  background: #ccf7e7;
  color: #075b46;
}

.job-banner {
  padding: 24px;
  border: 1px solid #dce8f5;
  border-radius: 18px;
  background: #eaf8f5;
}

.company-name {
  margin: 0 0 8px;
  color: #2459ce;
  font-size: 14px;
  word-wrap: break-word;
}

.job-banner h1 {
  margin: 0;
  font-size: 26px;
  line-height: 1.4;
  word-wrap: break-word;
}

.job-location {
  margin: 10px 0 0;
  color: #526079;
  font-size: 13px;
  line-height: 1.6;
}

.job-tags,
.skill-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.info-tag {
  padding: 7px 10px;
  border-radius: 8px;
  background: white;
  color: #234b94;
  font-size: 12px;
  line-height: 1.5;
}

.source-note {
  margin: 16px 0 0;
  color: #64748b;
  font-size: 12px;
}

.detail-section {
  margin-top: 20px;
  padding: 22px;
  border: 1px solid #e9edf5;
  border-radius: 16px;
  background: white;
}

.detail-section h2 {
  margin: 0 0 16px;
  font-size: 18px;
}

.job-facts > div {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid #e9edf5;
  font-size: 13px;
  line-height: 1.6;
}

.job-facts span {
  color: #64748b;
}

.job-facts strong {
  word-wrap: break-word;
}

.job-description {
  margin: 0;
  color: #526079;
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-line;
  word-wrap: break-word;
}

.section-description {
  margin: 0 0 14px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.7;
}

.match-summary {
  padding: 16px;
  border-radius: 12px;
  background: #eaf0ff;
  color: #2459ce;
  font-size: 14px;
}

.match-summary p {
  margin: 8px 0 0;
  color: #526079;
  font-size: 12px;
  line-height: 1.6;
}

.skill-tag {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 100%;
  padding: 9px 12px;
  border: 1px solid #dfe7fa;
  border-radius: 10px;
  background: #edf3ff;
  color: #234b94;
  font-size: 13px;
  word-wrap: break-word;
}

.skill-tag.matched {
  border-color: #81dfbd;
  background: #ccf7e7;
  color: #075b46;
}

.skill-tag span {
  font-size: 11px;
}

.question-box {
  margin-top: 18px;
}

.question-box label {
  display: block;
  margin-bottom: 9px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.6;
}

.question-box textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #dce3f0;
  border-radius: 10px;
  background: #f5f8ff;
  color: #17234b;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
}

.small-note {
  margin: 14px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.7;
}

.apply-footer {
  margin-top: 22px;
  text-align: center;
}

.apply-button {
  display: block;
  width: 100%;
  padding: 15px;
  border-radius: 12px;
  background: #086b56;
  color: white;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  text-decoration: none;
}

.apply-button:hover {
  background: #075b46;
}
</style>