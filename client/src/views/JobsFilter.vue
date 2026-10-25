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
        <span>{{ resultCount }} matches on this page</span>
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
        Jobs must include every skill you select.
      </p>

      <label for="skill-search" class="input-label">
        Find a skill
      </label>

      <input
        id="skill-search"
        v-model.trim="skillSearch"
        type="search"
        placeholder="Search Python, SQL, communication..."
      />

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
        No skills found.
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

    <footer class="filter-footer">
      <p>Search results are reflected from the filters chosen.</p>

      <button
        class="show-results"
        type="button"
        @click="emit('close')"
      >
        Show {{ resultCount }} Results
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
  resultCount: {
    type: Number,
    required: true,
  },
});

const emit = defineEmits(["update:modelValue", "close"]);

const skillSearch = ref("");

// Region options from the current API page.
const locations = computed(() => {
  const values = [];

  for (let i = 0; i < props.jobs.length; i++) {
    const job = props.jobs[i];

    const addressHidden =
      job.metadata && job.metadata.isHideCompanyAddress;

    if (!addressHidden && job.address && job.address.districts) {
      for (let j = 0; j < job.address.districts.length; j++) {
        const region = job.address.districts[j].region;

        if (region && !values.includes(region)) {
          values.push(region);
        }
      }
    }
  }

  // Keep a selected region visible after changing API pages.
  const selected = props.modelValue.location;

  if (selected && !values.includes(selected)) {
    values.push(selected);
  }

  return values.sort();
});

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
const activeFilters = computed(() => {
  const tags = [];

  if (props.modelValue.location !== "") {
    tags.push({
      key: "location",
      type: "location",
      label: props.modelValue.location,
    });
  }

  if (props.modelValue.category !== "") {
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

  return tags;
});

function changeLocation(location) {
  let selectedLocation = location;

  if (props.modelValue.location === location) {
    selectedLocation = "";
  }

  emit("update:modelValue", {
    location: selectedLocation,
    category: props.modelValue.category,
    skills: props.modelValue.skills,
  });
}

function changeCategory(category) {
  let selectedCategory = category;

  if (props.modelValue.category === category) {
    selectedCategory = "";
  }

  emit("update:modelValue", {
    location: props.modelValue.location,
    category: selectedCategory,
    skills: props.modelValue.skills,
  });
}

function toggleSkill(skill) {
  const selectedSkills = [];

  // Copy the skills instead of changing props directly.
  for (let i = 0; i < props.modelValue.skills.length; i++) {
    selectedSkills.push(props.modelValue.skills[i]);
  }

  const index = selectedSkills.indexOf(skill);

  if (index === -1) {
    selectedSkills.push(skill);
  } else {
    selectedSkills.splice(index, 1);
  }

  emit("update:modelValue", {
    location: props.modelValue.location,
    category: props.modelValue.category,
    skills: selectedSkills,
  });
}

function removeFilter(filter) {
  if (filter.type === "location") {
    changeLocation("");
  } else if (filter.type === "category") {
    changeCategory("");
  } else {
    toggleSkill(filter.label);
  }
}

function resetFilters() {
  skillSearch.value = "";

  emit("update:modelValue", {
    location: "",
    category: "",
    skills: [],
  });
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
</style>