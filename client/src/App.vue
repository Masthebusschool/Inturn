<template>
  <nav class="navbar navbar-expand-lg bg-dark" data-bs-theme="dark">
    <div class="container">
      <RouterLink class="navbar-brand" to="/">Inturn</RouterLink>
      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#mainNav"
        aria-controls="mainNav"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="mainNav">
        <ul class="navbar-nav me-auto">
          <li class="nav-item"><RouterLink class="nav-link" active-class="active" to="/jobs">Jobs</RouterLink></li>
          <li class="nav-item"><RouterLink class="nav-link" active-class="active" to="/skill-gap">Skill Gap</RouterLink></li>
          <li class="nav-item"><RouterLink class="nav-link" active-class="active" to="/profile">Profile</RouterLink></li>
          <li class="nav-item"><RouterLink class="nav-link" active-class="active" to="/resumes">Resumes</RouterLink></li>
          <li class="nav-item"><RouterLink class="nav-link" active-class="active" to="/mock-interview">Mock Interview</RouterLink></li>
          <li class="nav-item"><RouterLink class="nav-link" active-class="active" to="/intel">Interview Intel</RouterLink></li>
          <li class="nav-item"><RouterLink class="nav-link" active-class="active" to="/shortlist">Shortlist</RouterLink></li>
        </ul>
        <ul class="navbar-nav">
          <li class="nav-item"><RouterLink class="nav-link" active-class="active" to="/login">Log in</RouterLink></li>
          <li class="nav-item"><RouterLink class="nav-link" active-class="active" to="/signup">Sign up</RouterLink></li>
        </ul>
      </div>
    </div>
  </nav>
  <main class="container-fluid px-3 px-md-4 px-xl-5 py-4"><RouterView /></main>
</template>
