import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/jobs', name: 'jobs', component: () => import('../views/JobsView.vue') },
  { path: '/skill-gap', name: 'skill-gap', component: () => import('../views/SkillGapView.vue') },
  { path: '/profile', name: 'profile', component: () => import('../views/ProfileView.vue') },
  { path: '/mock-interview', name: 'mock-interview', component: () => import('../views/MockInterviewView.vue') },
  { path: '/intel', name: 'intel', component: () => import('../views/IntelFeedView.vue') },
  { path: '/shortlist', name: 'shortlist', component: () => import('../views/ShortlistView.vue') },
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
  { path: '/signup', name: 'signup', component: () => import('../views/SignupView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({ history: createWebHistory(), routes })

export default router
