<template>
  <section class="filter-panel">
    <header class="page-header filter-header">
      <button
        class="btn-neutral-inturn"
        type="button"
        @click="emit('close')"
      >
        ← Back
      </button>

      <div class="heading">
        <h2 class="header-title">Filter Internships</h2>
        <p class="header-subtitle">Find opportunities that suit your needs.</p>
      </div>

      <button
        class="btn-neutral-inturn"
        type="button"
        @click="resetFilters"
      >
        Reset All
      </button>
    </header>

    <div class="card-inturn active-summary">
      <div class="summary-counts">
        <strong>{{ activeFilters.length }} active filters</strong>
      </div>

      <div v-if="activeFilters.length > 0" class="filter-tags">
        <button
          v-for="filter in activeFilters"
          :key="filter.key"
          class="chip-inturn is-active"
          type="button"
          @click="removeFilter(filter)"
        >
          {{ filter.label }}
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <p v-else class="empty-summary">
        All internships on this page are included.
      </p>
    </div>

    <!-- Location -->
    <section class="card-inturn filter-section">
      <h3 class="section-title mb-0">Location</h3>
      <p class="section-description">Choose a region.</p>

      <div class="options">
        <button
          class="chip-inturn"
          :class="{ 'is-active': modelValue.location === '' }"
          :aria-pressed="modelValue.location === ''"
          type="button"
          @click="changeLocation('')"
        >
          All Locations
        </button>

        <button
          v-for="location in locations"
          :key="location"
          class="chip-inturn"
          :class="{ 'is-active': modelValue.location === location }"
          :aria-pressed="modelValue.location === location"
          type="button"
          @click="changeLocation(location)"
        >
          {{ location }}
          <span v-if="modelValue.location === location">✓</span>
        </button>
      </div>
    </section>

    <!-- Skills -->
    <section class="card-inturn filter-section">
      <h3 class="section-title mb-0">Skills</h3>

      <p class="section-description">
        Internships will include at least one selected skill. Ranked from most to least number of skills selected
      </p>

      <label for="skill-search" class="input-label">
        Find or add a skill
      </label>

      <div class="skill-search-row">
        <input
          id="skill-search"
          v-model.trim="skillSearch"
          type="search"
          class="input-inturn"
          placeholder="Search or add a skill, e.g. Python..."
          @keydown.enter.prevent="addCustomSkill"
        />

        <button
          class="btn-primary-inturn"
          type="button"
          :disabled="!skillSearch.trim()"
          @click="addCustomSkill"
        >
          Add skill
        </button>
      </div>

      <div class="options skill-options">
        <button
          v-for="skill in availableSkills"
          :key="skill"
          class="chip-inturn"
          :class="{ 'is-active': modelValue.skills.includes(skill) }"
          :aria-pressed="modelValue.skills.includes(skill)"
          type="button"
          @click="toggleSkill(skill)"
        >
          {{ skill }}
          <span v-if="modelValue.skills.includes(skill)">✓</span>
        </button>
      </div>

      <p v-if="availableSkills.length === 0" class="empty-message">
        No suggested skills found. Use Add skill to add your own.
      </p>
    </section>

    <!-- Category -->
    <section class="card-inturn filter-section">
      <h3 class="section-title mb-0">Job Category</h3>

      <p class="section-description">
        Choose the type of work you are interested in.
      </p>

      <div class="options">
        <button
          class="chip-inturn"
          :class="{ 'is-active': modelValue.category === '' }"
          :aria-pressed="modelValue.category === ''"
          type="button"
          @click="changeCategory('')"
        >
          All Categories
        </button>

        <button
          v-for="category in categories"
          :key="category"
          class="chip-inturn"
          :class="{ 'is-active': modelValue.category === category }"
          :aria-pressed="modelValue.category === category"
          type="button"
          @click="changeCategory(category)"
        >
          {{ category }}
          <span v-if="modelValue.category === category">✓</span>
        </button>
      </div>
    </section>

    <!-- Pay range -->
    <section class="card-inturn filter-section">
      <h3 class="section-title mb-0">Monthly Pay Range</h3>

      <p class="section-description">
        Enter amounts in SGD. Leave either field blank for no limit.
        Internships whose advertised monthly pay overlaps your range are included.
      </p>

      <label for="minimum-pay" class="input-label">
        Minimum monthly pay
      </label>

      <input
        id="minimum-pay"
        type="number"
        class="input-inturn pay-input"
        min="0"
        step="any"
        placeholder="For example, 2000"
        :value="modelValue.minSalary ?? ''"
        @input="changePay('minSalary', $event.target.value)"
      />

      <label for="maximum-pay" class="input-label">
        Maximum monthly pay
      </label>

      <input
        id="maximum-pay"
        type="number"
        class="input-inturn pay-input"
        min="0"
        step="any"
        placeholder="For example, 5000"
        :value="modelValue.maxSalary ?? ''"
        @input="changePay('maxSalary', $event.target.value)"
      />

      <p class="section-description">
        Hidden, unavailable and non-monthly salaries are excluded when a pay
        filter is selected.
      </p>

      <p v-if="payRangeInvalid" class="pay-error" role="alert">
        Enter valid non-negative amounts. Minimum pay cannot exceed maximum pay.
      </p>
    </section>

    <footer class="filter-footer">
      <p>Search results are reflected from the filters chosen.</p>

      <button
        class="btn-primary-inturn w-100"
        type="button"
        :disabled="payRangeInvalid"
        @click="emit('close')"
      >
        Show All Results
      </button>
    </footer>
  </section>
</template>

<script setup>
import { ref, computed } from "vue";

const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
  },
  jobs: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(["update:modelValue", "close"]);

const skillSearch = ref("");

const locations = [
  "Central",
  "East",
  "North",
  "North-East",
  "West",
  "Islandwide",
];

// Category options from API page.
const categories = computed(() => {
  const values = [];

  for (let i = 0; i < props.jobs.length; i++) {
    const job = props.jobs[i];

    if (job.categories) {
      for (let j = 0; j < job.categories.length; j++) {
        const category = job.categories[j].category;

        if (category && !values.includes(category)) {
          values.push(category);
        }
      }
    }
  }

  const selected = props.modelValue.category;

  if (selected && !values.includes(selected)) {
    values.push(selected);
  }

  return values.sort();
});

// Skill options
const availableSkills = computed(() => {
  const values = [];

  for (let i = 0; i < props.jobs.length; i++) {
    const job = props.jobs[i];

    if (job.skills) {
      for (let j = 0; j < job.skills.length; j++) {
        const skill = job.skills[j].skill;

        if (skill && !values.includes(skill)) {
          values.push(skill);
        }
      }
    }
  }

  // Keep selected skills available after changing API pages.
  for (let i = 0; i < props.modelValue.skills.length; i++) {
    const skill = props.modelValue.skills[i];

    if (!values.includes(skill)) {
      values.push(skill);
    }
  }

  const results = [];
  const keyword = skillSearch.value.toLowerCase();

  for (let i = 0; i < values.length; i++) {
    if (values[i].toLowerCase().includes(keyword)) {
      results.push(values[i]);
    }
  }

  return results.sort();
});

// Tags for the selected filters.
function hasPayValue(value) {
  return (value !== undefined && value !== null && String(value).trim() !== "");
}

const payRangeInvalid = computed(() => {
  const minimum = props.modelValue.minSalary;
  const maximum = props.modelValue.maxSalary;

  if (hasPayValue(minimum)) {
    const amount = Number(minimum);

    if (!Number.isFinite(amount) || amount < 0) {
      return true;
    }
  }

  if (hasPayValue(maximum)) {
    const amount = Number(maximum);

    if (!Number.isFinite(amount) || amount < 0) {
      return true;
    }
  }

  return (hasPayValue(minimum) && hasPayValue(maximum) && Number(minimum) > Number(maximum));
});

// Tags appear only for selected filters.
const activeFilters = computed(() => {
  const tags = [];

  if (props.modelValue.location) {
    tags.push({
      key: "location",
      type: "location",
      label: props.modelValue.location,
    });
  }

  if (props.modelValue.category) {
    tags.push({
      key: "category",
      type: "category",
      label: props.modelValue.category,
    });
  }

  for (let i = 0; i < props.modelValue.skills.length; i++) {
    const skill = props.modelValue.skills[i];

    tags.push({
      key: "skill-" + skill,
      type: "skill",
      label: skill,
    });
  }

  if (hasPayValue(props.modelValue.minSalary)) {
    tags.push({
      key: "minSalary",
      type: "minSalary",
      label: "Minimum S$" + props.modelValue.minSalary + "/month",
    });
  }

  if (hasPayValue(props.modelValue.maxSalary)) {
    tags.push({
      key: "maxSalary",
      type: "maxSalary",
      label: "Maximum S$" + props.modelValue.maxSalary + "/month",
    });
  }

  return tags;
});

// Preserve all filter fields whenever one field changes.
function updateFilter(field, value) {
  const updatedFilters = {
    location: props.modelValue.location ?? "",
    category: props.modelValue.category ?? "",
    skills: props.modelValue.skills ?? [],
    minSalary: props.modelValue.minSalary ?? "",
    maxSalary: props.modelValue.maxSalary ?? "",
  };

  updatedFilters[field] = value;

  emit("update:modelValue", updatedFilters);
}

function changeLocation(location) {
  if (props.modelValue.location === location) {
    updateFilter("location", "");
  } else {
    updateFilter("location", location);
  }
}

function changeCategory(category) {
  if (props.modelValue.category === category) {
    updateFilter("category", "");
  } else {
    updateFilter("category", category);
  }
}

function toggleSkill(skill) {
  const selectedSkills = [];

  for (let i = 0; i < props.modelValue.skills.length; i++) {
    selectedSkills.push(props.modelValue.skills[i]);
  }

  const index = selectedSkills.indexOf(skill);

  if (index === -1) {
    selectedSkills.push(skill);
  } else {
    selectedSkills.splice(index, 1);
  }

  updateFilter("skills", selectedSkills);
}

function changePay(field, value) {
  updateFilter(field, value);
}

function removeFilter(filter) {
  if (filter.type === "skill") {
    toggleSkill(filter.label);
  } else {
    updateFilter(filter.type, "");
  }
}

function resetFilters() {
  skillSearch.value = "";

  emit("update:modelValue", {
    location: "",
    category: "",
    skills: [],
    minSalary: "",
    maxSalary: "",
  });
}

function addCustomSkill() {
  const skill = skillSearch.value.trim();

  if (!skill) {
    return;
  }

  const selectedSkills = [];
  let alreadySelected = false;

  for (const selected of props.modelValue.skills) {
    selectedSkills.push(selected);

    if (selected.toLowerCase() === skill.toLowerCase()) {
      alreadySelected = true;
    }
  }

  if (!alreadySelected) {
    selectedSkills.push(skill);
    updateFilter("skills", selectedSkills);
  }

  skillSearch.value = "";
}
</script>

<style scoped>
.filter-panel {
  width: 100%;
}

.filter-panel,
.filter-panel * {
  box-sizing: border-box;
}

.filter-header {
  flex-wrap: wrap;
}

.heading {
  flex: 1;
  min-width: 160px;
}

.active-summary {
  margin-bottom: 1.25rem;
}

.summary-counts {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 13px;
}

.summary-counts strong {
  color: var(--inturn-primary-hover);
}

.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.empty-summary {
  margin: 12px 0 0;
  color: var(--inturn-text-muted);
  font-size: 13px;
}

.filter-section {
  margin-bottom: 1.25rem;
}

.section-description {
  margin: 8px 0 18px;
  color: var(--inturn-text-muted);
  font-size: 13px;
  line-height: 1.5;
}

.options {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.input-label {
  display: block;
  margin-bottom: 8px;
  color: var(--inturn-text-soft);
  font-size: 13px;
  font-weight: 600;
}

.pay-input {
  margin-bottom: 16px;
}

.skill-options {
  max-height: 240px;
  overflow-y: auto;
  padding: 4px;
}

.empty-message {
  color: var(--inturn-text-muted);
  font-size: 14px;
}

.filter-footer p {
  margin: 0 0 14px;
  color: var(--inturn-text-muted);
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
}

.pay-error {
  margin: 0;
  color: var(--inturn-danger);
  font-size: 13px;
  line-height: 1.6;
}

.skill-search-row {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.skill-search-row input {
  flex: 1;
  width: auto;
  min-width: 150px;
}
</style>
