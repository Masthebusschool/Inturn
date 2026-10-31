<template>
  <section class="filter-panel">
    <header class="filter-header">
      <button
        class="back-button"
        type="button"
        @click="emit('close')"
      >
        ← Back
      </button>

      <div class="heading">
        <h2>Filter Jobs</h2>
        <p>Find opportunities that suit your needs.</p>
      </div>

      <button
        class="reset-button"
        type="button"
        @click="resetFilters"
      >
        Reset All
      </button>
    </header>

    <div class="active-summary">
      <div class="summary-counts">
        <strong>{{ activeFilters.length }} active filters</strong>
      </div>

      <div v-if="activeFilters.length > 0" class="filter-tags">
        <button
          v-for="filter in activeFilters"
          :key="filter.key"
          class="filter-tag"
          type="button"
          @click="removeFilter(filter)"
        >
          {{ filter.label }}
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <p v-else class="empty-summary">
        All jobs on this page are included.
      </p>
    </div>

    <!-- Location -->
    <section class="filter-section">
      <h3>Location</h3>
      <p class="section-description">Choose a region.</p>

      <div class="options">
        <button
          class="option"
          :class="{ selected: modelValue.location === '' }"
          :aria-pressed="modelValue.location === ''"
          type="button"
          @click="changeLocation('')"
        >
          All Locations
        </button>

        <button
          v-for="location in locations"
          :key="location"
          class="option"
          :class="{ selected: modelValue.location === location }"
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
    <section class="filter-section">
      <h3>Skills</h3>

      <p class="section-description">
        Jobs will include at least one selected skill. Ranked from most to least number of skills selected
      </p>

      <label for="skill-search" class="input-label">
        Find or add a skill
      </label>

      <div class="skill-search-row">
        <input
          id="skill-search"
          v-model.trim="skillSearch"
          type="search"
          placeholder="Search or add a skill, e.g. Python..."
          @keydown.enter.prevent="addCustomSkill"
        />

        <button
          class="add-skill-button"
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
          class="option skill-option"
          :class="{ selected: modelValue.skills.includes(skill) }"
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
    <section class="filter-section">
      <h3>Job Category</h3>

      <p class="section-description">
        Choose the type of work you are interested in.
      </p>

      <div class="options">
        <button
          class="option"
          :class="{ selected: modelValue.category === '' }"
          :aria-pressed="modelValue.category === ''"
          type="button"
          @click="changeCategory('')"
        >
          All Categories
        </button>

        <button
          v-for="category in categories"
          :key="category"
          class="option"
          :class="{ selected: modelValue.category === category }"
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
    <section class="filter-section">
      <h3>Monthly Pay Range</h3>

      <p class="section-description">
        Enter amounts in SGD. Leave either field blank for no limit.
        Jobs whose advertised monthly pay overlaps your range are included.
      </p>

      <label for="minimum-pay" class="input-label">
        Minimum monthly pay
      </label>

      <input
        id="minimum-pay"
        type="number"
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
        class="show-results"
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

// Category options from the current API page.
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

// Skill options, filtered by the skill search field.
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
  return (
    value !== undefined &&
    value !== null &&
    String(value).trim() !== ""
  );
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

  return (
    hasPayValue(minimum) &&
    hasPayValue(maximum) &&
    Number(minimum) > Number(maximum)
  );
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

  // Copy the array instead of changing props.
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
  max-width: 720px;
  margin: 0 auto;
  padding: 24px;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  background: #f6f8ff;
  color: #17234b;
}

.filter-panel,
.filter-panel * {
  box-sizing: border-box;
}

.filter-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 24px;
}

.heading {
  flex: 1;
  min-width: 160px;
}

.heading h2 {
  margin: 0;
  font-size: 23px;
}

.heading p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
}

button,
input {
  font: inherit;
}

button {
  cursor: pointer;
}

.back-button,
.reset-button {
  padding: 9px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #2459ce;
  font-size: 14px;
  font-weight: 600;
}

.back-button:hover,
.reset-button:hover {
  background: #e6edff;
}

.active-summary {
  margin-bottom: 22px;
  padding: 16px;
  border-radius: 14px;
  background: #eaf0ff;
}

.summary-counts {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 13px;
}

.summary-counts strong {
  color: #2459ce;
}

.summary-counts span {
  color: #086b56;
}

.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.filter-tag {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: 100%;
  padding: 7px 11px;
  border: none;
  border-radius: 20px;
  background: #c8f7e7;
  color: #075b46;
  font-size: 13px;
  text-align: left;
  word-wrap: break-word;
}

.filter-tag:hover {
  background: #a7efd6;
}

.filter-tag span {
  font-size: 17px;
}

.empty-summary {
  margin: 12px 0 0;
  color: #526079;
  font-size: 13px;
}

.filter-section {
  margin-bottom: 20px;
  padding: 22px;
  border: 1px solid #e9edf5;
  border-radius: 16px;
  background: white;
}

.filter-section h3 {
  margin: 0;
  font-size: 18px;
}

.section-description {
  margin: 8px 0 18px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
}

.options {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  padding: 9px 13px;
  border: 1px solid #dfe7fa;
  border-radius: 10px;
  background: #edf3ff;
  color: #234b94;
  font-size: 14px;
  line-height: 1.4;
  text-align: left;
  word-wrap: break-word;
}

.option:hover {
  background: #dfeaff;
}

.option.selected {
  border-color: #2563eb;
  background: #2563eb;
  color: white;
}

.input-label {
  display: block;
  margin-bottom: 8px;
  color: #526079;
  font-size: 13px;
  font-weight: 600;
}

input {
  width: 100%;
  margin-bottom: 16px;
  padding: 12px 14px;
  border: 1px solid #dce3f0;
  border-radius: 10px;
  background: #f5f8ff;
  color: #17234b;
  font-size: 14px;
}

.skill-options {
  max-height: 240px;
  overflow-y: auto;
  padding: 4px;
}

.skill-option.selected {
  border-color: #81dfbd;
  background: #ccf7e7;
  color: #075b46;
}

.empty-message {
  color: #64748b;
  font-size: 14px;
}

.filter-footer p {
  margin: 0 0 14px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
}

.show-results {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background: #2563eb;
  color: white;
  font-weight: 600;
}

.show-results:hover {
  background: #1d4ed8;
}

.pay-error {
  margin: 0;
  color: #b42318;
  font-size: 13px;
  line-height: 1.6;
}

.show-results:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
  min-width: 150px;
  margin-bottom: 0;
}

.add-skill-button {
  padding: 12px 14px;
  border: none;
  border-radius: 10px;
  background: #2563eb;
  color: white;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.add-skill-button:hover:not(:disabled) {
  background: #1d4ed8;
}

.add-skill-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>