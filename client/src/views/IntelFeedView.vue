<script setup>
import { ref, computed, onMounted } from "vue";
import VueMultiselect from "vue-multiselect";

// Posts list and auth/notice states
const posts = ref([]);
const isAuthenticated = ref(false);
const loginNotice = ref("");
const errorMessage = ref("");

// Check if user is logged in using the auth route
async function checkAuth() {
  try {
    const res = await fetch("/api/auth/me");
    isAuthenticated.value = res.ok;
  } catch {
    isAuthenticated.value = false;
  }
}

// Load posts from Express + MongoDB when the page opens
async function loadPosts() {
  try {
    const res = await fetch("/api/intel");
    const data = await res.json();
    if (res.ok && data.posts) {
      posts.value = data.posts;
    }
  } catch (error) {
    console.error("Could not load posts from server:", error);
  }
}

onMounted(() => {
  checkAuth();
  loadPosts();
});

// Filter dropdown selections
const selectedType = ref("All");
const selectedCompany = ref("All");
const selectedRole = ref("All");

// Get unique companies (case-insensitive)
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

// Same lists with "All" on top, for the searchable dropdowns
const companyChoices = computed(() => ["All", ...companyOptions.value]);
const roleChoices = computed(() => ["All", ...roleOptions.value]);
const typeChoices = ["All", "Experience", "Interview questions"];

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

// Toggle upvote and save to MongoDB
async function toggleUpvote(post) {
  if (!isAuthenticated.value) {
    loginNotice.value = "Please log in first to upvote helpful posts.";
    return;
  }

  try {
    const res = await fetch(`/api/intel/${post.id}/upvote`, {
      method: "POST",
    });
    const data = await res.json();

    if (res.status === 401 || !res.ok) {
      isAuthenticated.value = false;
      loginNotice.value = data.error || "Please log in first to upvote posts.";
      return;
    }

    post.upvotes = data.upvotes;
    post.upvoted = data.upvoted;
  } catch (error) {
    console.error("Error upvoting post:", error);
  }
}

// Delete a post created by the current user
async function deletePost(post) {
  if (!confirm("Delete your post? This cannot be undone.")) return;

  try {
    const res = await fetch(`/api/intel/${post.id}`, {
      method: "DELETE",
    });
    const data = await res.json();

    if (res.status === 401) {
      isAuthenticated.value = false;
      loginNotice.value = "Please log in again to delete your post.";
      return;
    }

    if (!res.ok) {
      loginNotice.value = data.error || "Could not delete post.";
      return;
    }

    posts.value = posts.value.filter((p) => p.id !== post.id);

    // If the deleted post was the last one for a selected filter option, reset filter
    if (
      selectedCompany.value !== "All" &&
      !companyOptions.value.includes(selectedCompany.value)
    ) {
      selectedCompany.value = "All";
    }
    if (
      selectedRole.value !== "All" &&
      !roleOptions.value.includes(selectedRole.value)
    ) {
      selectedRole.value = "All";
    }
  } catch (error) {
    console.error("Error deleting post:", error);
  }
}

// Form inputs for sharing a new post
const showForm = ref(false);
const formType = ref("Experience");
const formCompany = ref("");
const formRole = ref("");
const formTitle = ref("");
const formBody = ref("");
const isSubmitting = ref(false);

function openShareForm() {
  if (!isAuthenticated.value) {
    loginNotice.value =
      "Please log in first to share your interview experience.";
    return;
  }
  loginNotice.value = "";
  showForm.value = true;
}

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
  errorMessage.value = "";
}

// Publish new post to MongoDB
async function publishPost() {
  if (!canPublish.value || isSubmitting.value) return;

  const questionList = [];
  let experienceText = "";

  if (formType.value === "Experience") {
    experienceText = formBody.value.trim();
  } else {
    const rawLines = formBody.value.split("\n");
    for (const line of rawLines) {
      if (line.trim() !== "") {
        questionList.push(line.trim());
      }
    }
  }

  isSubmitting.value = true;
  errorMessage.value = "";

  try {
    const res = await fetch("/api/intel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: formType.value,
        company: formCompany.value.trim(),
        role: formRole.value.trim(),
        title: formTitle.value.trim(),
        questions: questionList,
        experience: experienceText,
      }),
    });

    const data = await res.json();

    if (res.status === 401) {
      isAuthenticated.value = false;
      showForm.value = false;
      loginNotice.value =
        "Your session expired. Please log in again to publish your post.";
      isSubmitting.value = false;
      return;
    }

    if (!res.ok) {
      errorMessage.value = data.error || "Could not publish post.";
      isSubmitting.value = false;
      return;
    }

    // Add the new post from MongoDB to the top of our list
    posts.value.unshift(data.post);

    // Reset filters so the new post shows up right away
    selectedType.value = "All";
    selectedCompany.value = "All";
    selectedRole.value = "All";

    resetForm();
  } catch (error) {
    errorMessage.value = "Network error. Please try again.";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="bg-body-tertiary min-vh-100 p-3 p-lg-4 text-start">
    <div class="container-xl px-0">
      <!-- Header -->
      <header
        class="card rounded-4 p-3 p-sm-4 mb-3 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3"
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
          @click="openShareForm"
        >
          <i class="bi bi-plus-lg me-2"></i>Share your experience
        </button>
      </header>

      <!-- Login Notice Banner (shown when logged-out user clicks Share or Upvote) -->
      <div
        v-if="loginNotice"
        class="alert alert-warning rounded-4 d-flex justify-content-between align-items-center py-2 px-3 mb-3 small"
      >
        <span>
          <i class="bi bi-info-circle me-2"></i>{{ loginNotice }}
          <RouterLink to="/login" class="fw-semibold text-dark ms-1"
            >Log in here</RouterLink
          >
        </span>
        <button
          type="button"
          class="btn-close btn-sm"
          @click="loginNotice = ''"
        ></button>
      </div>

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

        <div v-if="errorMessage" class="alert alert-danger py-2 small">
          {{ errorMessage }}
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
            :disabled="!canPublish || isSubmitting"
            @click="publishPost"
          >
            {{ isSubmitting ? "Publishing..." : "Publish post" }}
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
                <VueMultiselect
                  id="filter-type"
                  v-model="selectedType"
                  :options="typeChoices"
                  :allow-empty="false"
                  :searchable="false"
                  :show-labels="false"
                  placeholder="All"
                />
              </div>
              <div class="col-12 col-sm-4">
                <label
                  for="filter-company"
                  class="form-label small fw-semibold mb-1"
                  >Company</label
                >
                <VueMultiselect
                  id="filter-company"
                  v-model="selectedCompany"
                  :options="companyChoices"
                  :allow-empty="false"
                  :show-labels="false"
                  placeholder="All"
                />
              </div>
              <div class="col-12 col-sm-4">
                <label
                  for="filter-role"
                  class="form-label small fw-semibold mb-1"
                  >Role</label
                >
                <VueMultiselect
                  id="filter-role"
                  v-model="selectedRole"
                  :options="roleChoices"
                  :allow-empty="false"
                  :show-labels="false"
                  placeholder="All"
                />
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
            @click="openShareForm"
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
                  <div class="fw-semibold small">
                    Anonymous student
                    <span v-if="p.isOwner" class="text-primary fw-normal"
                      >(You)</span
                    >
                  </div>
                  <div class="text-secondary small">{{ p.date }}</div>
                </div>
              </div>

              <div class="d-flex align-items-center gap-2">
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
                <button
                  v-if="p.isOwner"
                  type="button"
                  class="btn btn-link btn-sm text-danger text-decoration-none p-0 ms-1"
                  title="Delete your post"
                  @click="deletePost(p)"
                >
                  <i class="bi bi-trash"></i>
                </button>
              </div>
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
