<script setup>
import { ref, computed } from "vue";

// Sample posts for the feed (Using simple readable dates instead of complex math)
const posts = ref([
  {
    id: 1,
    type: "Experience",
    company: "GovTech",
    role: "Full-Stack Engineering Intern",
    title: "My GovTech technical interview experience",
    questions: [],
    experience:
      "The interview was conversational and focused more on how I made engineering decisions than getting a perfect answer. I walked through one of my projects, then discussed API design, testing, and a production bug I had fixed.",
    upvotes: 42,
    upvoted: false,
    date: "24 Oct 2026",
  },
  {
    id: 2,
    type: "Interview questions",
    company: "Grab",
    role: "Software Engineering Intern",
    title: "Questions from my Grab engineering interview",
    experience: "",
    questions: [
      "Explain how you would design a food-order status tracker, including real-time updates and failure states",
      "Tell me about a disagreement in a team project and what you learned from it",
    ],
    upvotes: 31,
    upvoted: false,
    date: "23 Oct 2026",
  },
  {
    id: 3,
    type: "Experience",
    company: "Shopee",
    role: "Product Management Intern",
    title: "How my Shopee PM intern interviews went",
    questions: [],
    experience:
      "Two rounds: a behavioural chat about a project I led, then a product case on improving seller onboarding. They cared most about how I structured my thinking and used data to back my choices.",
    upvotes: 27,
    upvoted: false,
    date: "22 Oct 2026",
  },
  {
    id: 4,
    type: "Interview questions",
    company: "DBS",
    role: "Data Analyst Intern",
    title: "SQL and case questions from DBS",
    experience: "",
    questions: [
      "Write a query using a window function to rank customers by monthly spend",
      "Weekly active users dropped 10% last week. How would you investigate?",
      "Explain the difference between an INNER JOIN and a LEFT JOIN with an example",
    ],
    upvotes: 19,
    upvoted: false,
    date: "20 Oct 2026",
  },
]);

// Filter dropdown selections
const selectedType = ref("All");
const selectedCompany = ref("All");
const selectedRole = ref("All");

// Get unique companies (case-insensitive so "GovTech" and "govtech" don't duplicate)
const companyOptions = computed(() => {
  const list = [];
  for (const p of posts.value) {
    const clean = p.company.trim();
    const lowerList = list.map((item) => item.toLowerCase());
    if (clean !== "" && !lowerList.includes(clean.toLowerCase())) {
      list.push(clean);
    }
  }
  return list.sort();
});

// Get unique roles (case-insensitive)
const roleOptions = computed(() => {
  const list = [];
  for (const p of posts.value) {
    const clean = p.role.trim();
    const lowerList = list.map((item) => item.toLowerCase());
    if (clean !== "" && !lowerList.includes(clean.toLowerCase())) {
      list.push(clean);
    }
  }
  return list.sort();
});

// Filter the posts based on selected dropdowns
const filteredPosts = computed(() => {
  return posts.value.filter((p) => {
    const matchType =
      selectedType.value === "All" || p.type === selectedType.value;
    const matchCompany =
      selectedCompany.value === "All" ||
      p.company.trim().toLowerCase() === selectedCompany.value.toLowerCase();
    const matchRole =
      selectedRole.value === "All" ||
      p.role.trim().toLowerCase() === selectedRole.value.toLowerCase();
    return matchType && matchCompany && matchRole;
  });
});

function toggleUpvote(post) {
  if (post.upvoted) {
    post.upvoted = false;
    post.upvotes--;
  } else {
    post.upvoted = true;
    post.upvotes++;
  }
}

// Form inputs for sharing a new post
const showForm = ref(false);
const formType = ref("Experience");
const formCompany = ref("");
const formRole = ref("");
const formTitle = ref("");
const formBody = ref("");

// Check that all fields have real text (not just spaces)
const canPublish = computed(() => {
  return (
    formCompany.value.trim() !== "" &&
    formRole.value.trim() !== "" &&
    formTitle.value.trim() !== "" &&
    formBody.value.trim() !== ""
  );
});

function resetForm() {
  showForm.value = false;
  formType.value = "Experience";
  formCompany.value = "";
  formRole.value = "";
  formTitle.value = "";
  formBody.value = "";
}

function publishPost() {
  if (!canPublish.value) return;

  const questionList = [];
  let experienceText = "";

  if (formType.value === "Experience") {
    experienceText = formBody.value.trim();
  } else {
    // Split textarea by new lines and trim each question
    const rawLines = formBody.value.split("\n");
    for (const line of rawLines) {
      if (line.trim() !== "") {
        questionList.push(line.trim());
      }
    }
  }

  // Format today's date simply (e.g. "24 Oct 2026")
  const today = new Date().toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  posts.value.unshift({
    id: Date.now(),
    type: formType.value,
    company: formCompany.value.trim(),
    role: formRole.value.trim(),
    title: formTitle.value.trim(),
    experience: experienceText,
    questions: questionList,
    upvotes: 0,
    upvoted: false,
    date: today,
  });

  // Reset filters so the new post shows up right away
  selectedType.value = "All";
  selectedCompany.value = "All";
  selectedRole.value = "All";

  resetForm();
}
</script>

<template>
  <div class="bg-body-tertiary min-vh-100 p-3 p-lg-4 text-start">
    <div class="container-xl px-0">
      <!-- Header -->
      <header
        class="card rounded-4 p-3 p-sm-4 mb-4 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3"
      >
        <div>
          <div class="text-primary text-uppercase fw-bold small">
            Community knowledge
          </div>
          <h1 class="h3 fw-semibold mb-1">Interview Intel</h1>
          <p class="text-secondary small mb-0">
            Learn from real interview experiences shared by students.
          </p>
        </div>
        <button
          class="btn btn-inturn rounded-3 fw-semibold px-3 py-2"
          @click="showForm = true"
        >
          <i class="bi bi-plus-lg me-2"></i>Share your experience
        </button>
      </header>

      <!-- Share Form -->
      <section v-if="showForm" class="card rounded-4 p-3 p-sm-4 mb-3">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <div class="text-primary text-uppercase fw-bold small">
              Help the next candidate
            </div>
            <h2 class="h4 fw-semibold mt-1 mb-3">Share interview intel</h2>
          </div>
          <button
            class="btn btn-link btn-sm text-secondary text-decoration-none p-0"
            @click="resetForm"
          >
            Cancel
          </button>
        </div>

        <div class="row g-3">
          <div class="col-12 col-md-4">
            <label for="post-type" class="form-label small fw-semibold mb-1"
              >Post type</label
            >
            <select
              id="post-type"
              v-model="formType"
              class="form-select bg-body-tertiary rounded-3"
            >
              <option>Experience</option>
              <option>Interview questions</option>
            </select>
          </div>
          <div class="col-12 col-md-4">
            <label for="post-company" class="form-label small fw-semibold mb-1"
              >Company</label
            >
            <input
              id="post-company"
              v-model="formCompany"
              maxlength="80"
              class="form-control bg-body-tertiary rounded-3"
              placeholder="e.g. GovTech"
            />
          </div>
          <div class="col-12 col-md-4">
            <label for="post-role" class="form-label small fw-semibold mb-1"
              >Role</label
            >
            <input
              id="post-role"
              v-model="formRole"
              maxlength="80"
              class="form-control bg-body-tertiary rounded-3"
              placeholder="e.g. Engineering Intern"
            />
          </div>
          <div class="col-12">
            <label for="post-title" class="form-label small fw-semibold mb-1"
              >Title</label
            >
            <input
              id="post-title"
              v-model="formTitle"
              maxlength="120"
              class="form-control bg-body-tertiary rounded-3"
              placeholder="Give your post a clear title"
            />
          </div>
          <div class="col-12">
            <label for="post-body" class="form-label small fw-semibold mb-1">
              {{
                formType === "Experience"
                  ? "What would you like others to know?"
                  : "Which questions were you asked? (one per line)"
              }}
            </label>
            <textarea
              id="post-body"
              v-model="formBody"
              maxlength="2000"
              class="form-control bg-body-tertiary rounded-3"
              rows="5"
              placeholder="Write your post details here..."
            ></textarea>
          </div>
        </div>

        <div
          class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4"
        >
          <span class="small text-secondary"
            >Keep personal or confidential information out of your post.</span
          >
          <button
            class="btn btn-inturn rounded-3 fw-semibold px-4 py-2"
            :disabled="!canPublish"
            @click="publishPost"
          >
            Publish post
          </button>
        </div>
      </section>

      <!-- Filters -->
      <section class="card rounded-4 p-3 p-sm-4 mb-3">
        <div class="row g-3 align-items-center">
          <div class="col-12 col-md-4">
            <div class="fw-semibold">Explore the community</div>
            <div class="text-secondary small">
              {{ filteredPosts.length }}
              {{ filteredPosts.length === 1 ? "post" : "posts" }}
            </div>
          </div>
          <div class="col-12 col-md-8">
            <div class="row g-3">
              <div class="col-12 col-sm-4">
                <label
                  for="filter-type"
                  class="form-label small fw-semibold mb-1"
                  >Post type</label
                >
                <select
                  id="filter-type"
                  v-model="selectedType"
                  class="form-select bg-body-tertiary rounded-3"
                >
                  <option>All</option>
                  <option>Experience</option>
                  <option>Interview questions</option>
                </select>
              </div>
              <div class="col-12 col-sm-4">
                <label
                  for="filter-company"
                  class="form-label small fw-semibold mb-1"
                  >Company</label
                >
                <select
                  id="filter-company"
                  v-model="selectedCompany"
                  class="form-select bg-body-tertiary rounded-3"
                >
                  <option>All</option>
                  <option v-for="c in companyOptions" :key="c">{{ c }}</option>
                </select>
              </div>
              <div class="col-12 col-sm-4">
                <label
                  for="filter-role"
                  class="form-label small fw-semibold mb-1"
                  >Role</label
                >
                <select
                  id="filter-role"
                  v-model="selectedRole"
                  class="form-select bg-body-tertiary rounded-3"
                >
                  <option>All</option>
                  <option v-for="r in roleOptions" :key="r">{{ r }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Empty State 1: No posts exist at all -->
      <div
        v-if="posts.length === 0"
        class="card rounded-4 p-5 text-center mb-3"
      >
        <i class="bi bi-chat-left-dots fs-1 text-secondary mb-2"></i>
        <h3 class="h5 fw-semibold mb-1">No community intel shared yet</h3>
        <p class="text-secondary small mb-3">
          Be the first to share your interview experience or questions to help
          other students!
        </p>
        <div>
          <button
            class="btn btn-inturn rounded-3 fw-semibold px-4 py-2"
            @click="showForm = true"
          >
            <i class="bi bi-plus-lg me-2"></i>Share your experience
          </button>
        </div>
      </div>

      <!-- Empty State 2: Posts exist, but none match the selected filters -->
      <div
        v-else-if="filteredPosts.length === 0"
        class="card rounded-4 p-5 text-center mb-3"
      >
        <i class="bi bi-funnel fs-1 text-secondary mb-2"></i>
        <h3 class="h6 fw-semibold mb-1">No posts match these filters</h3>
        <p class="text-secondary small mb-3">
          Try changing your filter selection or reset to view all community
          posts.
        </p>
        <div>
          <button
            class="btn btn-outline-secondary btn-sm rounded-3 px-3"
            @click="
              selectedType = 'All';
              selectedCompany = 'All';
              selectedRole = 'All';
            "
          >
            Reset filters
          </button>
        </div>
      </div>

      <!-- Feed Posts -->
      <template v-else>
        <article
          v-for="p in filteredPosts"
          :key="p.id"
          class="card rounded-4 p-3 p-sm-4 mb-3 d-flex flex-column flex-sm-row gap-3"
        >
          <button
            type="button"
            class="btn upvote-btn rounded-3 d-flex flex-row flex-sm-column align-items-center justify-content-center gap-2 gap-sm-0 align-self-start px-3 py-2 flex-shrink-0"
            :class="
              p.upvoted ? 'upvote-active' : 'btn-outline-secondary text-dark'
            "
            :aria-pressed="p.upvoted"
            @click="toggleUpvote(p)"
          >
            <i class="bi bi-arrow-up fs-5"></i>
            <strong>{{ p.upvotes }}</strong>
            <span class="small">Upvote</span>
          </button>

          <div class="flex-grow-1 min-w-0 text-break">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div class="d-flex align-items-center gap-2">
                <span
                  class="rounded-circle bg-primary-subtle text-primary d-inline-flex align-items-center justify-content-center flex-shrink-0"
                  style="width: 36px; height: 36px"
                >
                  <i class="bi bi-person-fill"></i>
                </span>
                <div>
                  <div class="fw-semibold small">Anonymous student</div>
                  <div class="text-secondary small">{{ p.date }}</div>
                </div>
              </div>
              <span
                class="badge rounded-pill px-3 py-2"
                :class="
                  p.type === 'Experience'
                    ? 'bg-success-subtle text-success'
                    : 'bg-primary-subtle text-primary'
                "
              >
                {{ p.type }}
              </span>
            </div>

            <div class="d-flex flex-wrap gap-2 my-2">
              <span
                class="badge bg-body-secondary text-dark fw-normal px-2 py-1"
                >{{ p.company }}</span
              >
              <span
                class="badge bg-body-secondary text-dark fw-normal px-2 py-1"
                >{{ p.role }}</span
              >
            </div>

            <h3 class="h5 fw-semibold mb-2">{{ p.title }}</h3>
            <ul
              v-if="p.questions && p.questions.length > 0"
              class="text-secondary small ps-3 mb-0"
            >
              <li v-for="(q, index) in p.questions" :key="index">{{ q }}</li>
            </ul>
            <p v-else class="text-secondary small mb-0">{{ p.experience }}</p>
          </div>
        </article>
      </template>
    </div>
  </div>
</template>

<style scoped>
.btn-inturn {
  background-color: #4a86e8;
  color: #fff;
  border: 0;
}
.btn-inturn:hover {
  background-color: #3a74d4;
  color: #fff;
}
.btn-inturn:disabled {
  background-color: #9db9ea;
  color: #fff;
}
.upvote-btn {
  min-width: 72px;
}
.upvote-active {
  background-color: #e1edfd;
  border: 1px solid #4a86e8;
  color: #4a86e8;
}
</style>
