import { createRouter, createWebHistory } from 'vue-router'

import JobsView from '../views/JobsView.vue'
import SkillGapView from '../views/SkillGapView.vue'
import MockInterviewView from '../views/MockInterviewView.vue'
import IntelFeedView from '../views/IntelFeedView.vue'
import KanbanView from '../views/KanbanView.vue'
import LoginView from '../views/LoginView.vue'
import SignupView from '../views/SignupView.vue'
import OnboardingView from '../views/OnboardingView.vue'
import ProfileView from '../views/ProfileView.vue'
import ResumeAnalysisView from '../views/ResumeAnalysisView.vue'
import ResumesView from '../views/ResumesView.vue'
import ResumeEditorView from '../views/ResumeEditorView.vue'

const routes = [
  { path: '/', name: 'home', component: KanbanView },
  { path: '/jobs', name: 'jobs', component: JobsView },
  { path: '/skill-gap', name: 'skill-gap', component: SkillGapView },
  { path: '/mock-interview', name: 'mock-interview', component: MockInterviewView },
  { path: '/intel', name: 'intel', component: IntelFeedView },
// meta.fullPage: shown without the sidebar (see App.vue)
  { path: '/login', name: 'login', component: LoginView, meta: { fullPage: true } },
  { path: '/signup', name: 'signup', component: SignupView, meta: { fullPage: true } },
  { path: '/onboarding', name: 'onboarding', component: OnboardingView, meta: { fullPage: true } },

  { path: '/profile', name: 'profile', component: ProfileView },
  { path: '/profile/resume-analysis', name: 'resume-analysis', component: ResumeAnalysisView },
  { path: '/resumes', name: 'resumes', component: ResumesView },
  { path: '/resumes/:id', name: 'resume-editor', component: ResumeEditorView, props: true },

  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({ history: createWebHistory(), routes })

export default router
