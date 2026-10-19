import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/jobs', name: 'jobs', component: () => import('../views/JobsView.vue') },
  { path: '/skill-gap', name: 'skill-gap', component: () => import('../views/SkillGapView.vue') },
  { path: '/mock-interview', name: 'mock-interview', component: () => import('../views/MockInterviewView.vue') },
  { path: '/intel', name: 'intel', component: () => import('../views/IntelFeedView.vue') },
  { path: '/shortlist', name: 'shortlist', component: () => import('../views/ShortlistView.vue') },
  // meta.fullPage: shown without the sidebar (see App.vue)
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { fullPage: true } },
  { path: '/signup', name: 'signup', component: () => import('../views/SignupView.vue'), meta: { fullPage: true } },
  { path: '/onboarding', name: 'onboarding', component: () => import('../views/OnboardingView.vue'), meta: { fullPage: true } },
  { path: '/profile', name: 'profile', component: () => import('../views/ProfileView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({ history: createWebHistory(), routes })

export default router
