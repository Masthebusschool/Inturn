import { createRouter, createWebHistory } from 'vue-router'

import HomeView from '../views/HomeView.vue'
import JobsView from '../views/JobsView.vue'
import SkillGapView from '../views/SkillGapView.vue'
import MockInterviewView from '../views/MockInterviewView.vue'
import IntelFeedView from '../views/IntelFeedView.vue'
import ShortlistView from '../views/ShortlistView.vue'
import LoginView from '../views/LoginView.vue'
import SignupView from '../views/SignupView.vue'
import OnboardingView from '../views/OnboardingView.vue'
import ProfileView from '../views/ProfileView.vue'
import ResumeAnalysisView from '../views/ResumeAnalysisView.vue'

const routes = [
  { path: '/', component: HomeView },
  { path: '/jobs', component: JobsView },
  { path: '/skill-gap', component: SkillGapView },
  { path: '/mock-interview', component: MockInterviewView },
  { path: '/intel', component: IntelFeedView },
  { path: '/shortlist', component: ShortlistView },
// meta.fullPage: shown without the sidebar (see App.vue)
  { path: '/login', component: LoginView, meta: { fullPage: true } },
  { path: '/signup', component: SignupView, meta: { fullPage: true } },
  { path: '/onboarding', component: OnboardingView, meta: { fullPage: true } },

  { path: '/profile', component: ProfileView },
  { path: '/profile/resume-analysis', component: ResumeAnalysisView },

  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({ history: createWebHistory(), routes })

export default router
