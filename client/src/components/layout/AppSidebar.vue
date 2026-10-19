<script setup>
import { useRouter } from 'vue-router'
import { authStore } from '../../stores/auth.js'

const router = useRouter()

// Site-wide navigation. Each icon is a 16x16 outline path drawn in white.
const links = [
  { to: '/profile', label: 'Profile', icon: 'M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5.5 6.5c0-2.6 2.5-4.5 5.5-4.5s5.5 1.9 5.5 4.5' },
  { to: '/shortlist', label: 'Applications Board', icon: 'M5.5 2h5v1.5h-5zM4 3H3v11.5h10V3h-1M5.5 7.5h5M5.5 10h5M5.5 12.5h3' },
  { to: '/jobs', label: 'Job Discovery', icon: 'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM1.5 8h13M8 1.5c-2 2-2.8 4-2.8 6.5S6 12.5 8 14.5M8 1.5c2 2 2.8 4 2.8 6.5S10 12.5 8 14.5' },
  { to: '/intel', label: 'Interview Intel', icon: 'M1.5 2.5h13v8h-13zM8 10.5v3M5 14.5h6M4 5h4M4 7.5h7' },
  { to: '/mock-interview', label: 'Mock Interview', icon: 'M8 1.5a2 2 0 0 0-2 2v4a2 2 0 0 0 4 0v-4a2 2 0 0 0-2-2ZM3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.5' },
  { to: '/skill-gap', label: 'Skill Gap Analysis', icon: 'M3 1.5h7l3 3v10H3zM10 1.5v3h3M5.5 8h5M5.5 10.5h5M5.5 13h3' },
]

async function handleLogout() {
  await authStore.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <span class="brand-logo">Logo</span>
      <span class="brand-name">Inturn</span>
    </div>

    <nav aria-label="Main">
      <ul class="nav-list">
        <li v-for="link in links" :key="link.to">
          <RouterLink :to="link.to" class="nav-item" active-class="active">
            <svg class="nav-icon" viewBox="0 0 16 16" aria-hidden="true">
              <path :d="link.icon" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>{{ link.label }}</span>
          </RouterLink>
        </li>
      </ul>
    </nav>

    <div class="sidebar-footer">
      <button v-if="authStore.isLoggedIn" type="button" class="nav-item footer-button" @click="handleLogout">
        <svg class="nav-icon" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M6 2.5H3v11h3M10.5 5l3 3-3 3M13.5 8H6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>Log out</span>
      </button>
      <RouterLink v-else-if="authStore.checked" :to="{ name: 'login' }" class="nav-item">
        <svg class="nav-icon" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M10 2.5h3v11h-3M2.5 8h7.5M7 5l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>Log in</span>
      </RouterLink>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  width: 220px;
  min-height: 100vh;
  position: sticky;
  top: 0;
  background: #4e8be6;
  color: #fff;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding: 1.25rem 1.25rem 2.5rem;
}

.brand-logo {
  font-size: 0.75rem;
  font-weight: 600;
}

.brand-name {
  font-size: 1.6rem;
  font-weight: 700;
}

.nav-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 1.25rem;
  color: #fff;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  background: none;
  border: none;
  text-align: left;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.12);
}

.nav-item.active {
  background: #3c70b3;
  font-weight: 600;
}

.nav-item:focus-visible {
  outline: 2px solid #fff;
  outline-offset: -2px;
}

.nav-icon {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
}

.sidebar-footer {
  margin-top: auto;
  padding-bottom: 1rem;
}

/* Phones: the sidebar becomes a scrollable bar across the top */
@media (max-width: 767.98px) {
  .sidebar {
    flex-direction: row;
    align-items: center;
    width: 100%;
    min-height: 0;
    overflow-x: auto;
    z-index: 10;
  }

  .brand {
    padding: 0.75rem 1rem;
    flex-shrink: 0;
  }

  .brand-logo {
    display: none;
  }

  .brand-name {
    font-size: 1.25rem;
  }

  nav,
  .nav-list {
    display: flex;
  }

  .nav-item {
    white-space: nowrap;
    padding: 0.9rem 0.85rem;
  }

  .sidebar-footer {
    margin-top: 0;
    padding-bottom: 0;
  }
}
</style>
