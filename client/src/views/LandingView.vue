<script setup>
// checklist beside the headline
const highlights = [
  'Listings from MyCareersFuture',
  'One board for every application',
  'Interview questions from real students',
  'Free to use, no subscriptions or payments'
];

// feature cards, one per main part of the app
const features = [
  {
    icon: 'bi-search',
    title: 'Job Discovery',
    text: 'Browse internships pulled from MyCareersFuture and save the ones you like in one click.'
  },
  {
    icon: 'bi-kanban',
    title: 'Tracker Board',
    text: 'Move each application from Saved to Offered, with deadlines and a prep checklist on every card.'
  },
  {
    icon: 'bi-graph-up-arrow',
    title: 'Skill Gap Analysis',
    text: 'Compare your resume against a job and see which skills you still need to work on.'
  },
  {
    icon: 'bi-chat-square-quote',
    title: 'Interview Intel',
    text: 'Read real interview questions shared by other students and practise them in your journal.'
  }
];

// how it works, in order
const steps = [
  { title: 'Create your free account', text: 'Sign up and tell us your education level, skills and the industries you are interested in.' },
  { title: 'Find and save internships', text: 'Search the listings and save the roles that fit you onto your tracker board.' },
  { title: 'Track and prepare', text: 'Follow each application through the pipeline and tick off your prep checklist as you go.' }
];

// sample card shown beside the steps, made up for the preview
const sampleTasks = [
  { text: 'Research the company', done: true },
  { text: 'Tailor resume', done: true },
  { text: 'Prepare STAR stories', done: false }
];
</script>

<template>
  <div class="text-start">
    <!-- Navbar -->
    <nav class="navbar navbar-expand bg-white border rounded-4 px-3 mb-5">
      <RouterLink to="/" class="navbar-brand d-flex align-items-center gap-2 fw-bold">
        <img src="../assets/logogogo.jpg" alt="" width="36" height="36" class="rounded-circle" />
        Inturn
      </RouterLink>
      <div class="ms-auto d-flex gap-2">
        <RouterLink to="/login" class="btn btn-outline-primary">Log in</RouterLink>
        <RouterLink to="/signup" class="btn btn-primary">Sign up</RouterLink>
      </div>
    </nav>

    <!-- Hero Banner -->
    <section class="row align-items-center g-4 mb-5">
      <div class="col-lg-7">
        <span class="badge text-bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-3 mb-3" style="font-size: 0.85em;">
          "Built for students in Singapore - By students in Singapore"
        </span>
        <h1 class="display-5 fw-bold mb-3">
          Land your next internship, <span class="text-primary">one step at a time</span>
        </h1>
        <p class="lead text-secondary mb-4">
          Inturn brings internship listings, application tracking and interview prep altogether,
          so you always know what to do next.
        </p>
        <div class="d-flex flex-wrap gap-2">
          <RouterLink to="/signup" class="btn btn-primary btn-lg px-4">Get started for free</RouterLink>
          <RouterLink to="/login" class="btn btn-outline-secondary btn-lg px-4">I have an account</RouterLink>
        </div>
      </div>

      <!-- quick highlights beside the headline, shown as a ticked checklist -->
      <div class="col-lg-5">
        <div class="card border-0 shadow-sm rounded-4 p-4">
          <h2 class="h5 fw-semibold mb-3">How Inturn's Got You Covered :)</h2>
          <ul class="list-group list-group-flush">
            <li v-for="(item, index) in highlights" :key="item" class="list-group-item px-0">
              <div class="form-check mb-0">
                <!-- click.prevent keeps it ticked (clicking the label is stopped too) without greying it out like disabled would -->
                <input class="form-check-input" type="checkbox" :id="'highlight-' + index" checked v-on:click.prevent />
                <label class="form-check-label" :for="'highlight-' + index">{{ item }}</label>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section class="mb-5">
      <div class="text-center mb-4">
        <p class="text-primary text-uppercase fw-semibold small mb-1">Why Inturn</p>
        <h2 class="fw-bold">Everything you need in one place</h2>
      </div>

      <div class="row g-3">
        <div v-for="feature in features" :key="feature.title" class="col-sm-6 col-lg-3">
          <div class="card h-100 border-0 shadow-sm rounded-4 p-3">
            <div class="card-body">
              <i class="bi fs-2 text-primary" :class="feature.icon"></i>
              <h3 class="h5 fw-semibold mt-3">{{ feature.title }}</h3>
              <p class="text-secondary small mb-0">{{ feature.text }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- How it works: steps on the left, a sample tracker card on the right -->
    <section class="row align-items-center g-4 mb-5">
      <div class="col-lg-6">
        <p class="text-primary text-uppercase fw-semibold small mb-1">How it works</p>
        <h2 class="fw-bold mb-4">Three simple steps</h2>

        <div v-for="(step, index) in steps" :key="step.title" class="d-flex gap-3 mb-4">
          <span class="badge rounded-pill bg-primary fs-6 px-3 py-2 align-self-start">{{ index + 1 }}</span>
          <div>
            <h3 class="h6 fw-semibold mb-1">{{ step.title }}</h3>
            <p class="text-secondary small mb-0">{{ step.text }}</p>
          </div>
        </div>
      </div>

      <div class="col-md-8 col-lg-5 offset-lg-1">
        <div class="card border-0 shadow rounded-4 p-4">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <h3 class="h6 fw-semibold mb-0">Your Dream Internship Role</h3>
              <p class="small text-secondary mb-0">Your Dream Company</p>
            </div>
            <span class="badge text-bg-info">Interview</span>
          </div>

          <div class="d-flex justify-content-between small text-secondary mb-1">
            <span>Checklist</span>
            <span>2 / 3 Prep</span>
          </div>
          <div class="progress mb-3" role="progressbar" aria-label="Checklist progress" aria-valuenow="67" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-bar" style="width: 67%"></div>
          </div>

          <ul class="list-group list-group-flush">
            <li v-for="task in sampleTasks" :key="task.text" class="list-group-item px-0 d-flex align-items-center gap-2">
              <i class="bi" :class="task.done ? 'bi-check-square-fill text-primary' : 'bi-square text-secondary'"></i>
              <span :class="{ 'text-decoration-line-through text-secondary': task.done }">{{ task.text }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Call to action -->
    <section class="bg-primary text-white text-center rounded-4 p-5 mb-5">
      <h2 class="fw-bold mb-2">Ready to start your internship hunt?</h2>
      <p class="mb-4 opacity-75">Create a free account and set up your board in a few minutes.</p>
      <RouterLink to="/signup" class="btn btn-light btn-lg px-4 fw-semibold">Create my account</RouterLink>
      <p class="small mt-3 mb-0 opacity-75">Free for students, no payments, no subscriptions :)</p>
    </section>

    <!-- Footer -->
    <footer class="border-top pt-4">
      <div class="row g-4">
        <div class="col-md-6">
          <p class="fw-bold mb-1">Inturn</p>
          <p class="text-secondary small mb-0">
            Your goto site for helping students find, track and prepare for internships in Singapore.
          </p>
        </div>
        <div class="col-6 col-md-3">
          <p class="fw-semibold small mb-2">Platform</p>
          <ul class="list-unstyled small d-flex flex-column gap-1 mb-0">
            <li><RouterLink to="/jobs" class="link-secondary text-decoration-none">Job Discovery</RouterLink></li>
            <li><RouterLink to="/applications" class="link-secondary text-decoration-none">Tracker Board</RouterLink></li>
            <li><RouterLink to="/intel" class="link-secondary text-decoration-none">Interview Intel</RouterLink></li>
          </ul>
        </div>
        <div class="col-6 col-md-3">
          <p class="fw-semibold small mb-2">Account</p>
          <ul class="list-unstyled small d-flex flex-column gap-1 mb-0">
            <li><RouterLink to="/login" class="link-secondary text-decoration-none">Log in</RouterLink></li>
            <li><RouterLink to="/signup" class="link-secondary text-decoration-none">Sign up</RouterLink></li>
          </ul>
        </div>
      </div>
      <p class="text-secondary small text-center mt-4 mb-0">&copy; {{ new Date().getFullYear() }} Inturn</p>
    </footer>
  </div>
</template>
