import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Splash',
    component: () => import('../views/SplashView.vue'),
  },
  {
    path: '/questionnaire',
    name: 'Questionnaire',
    component: () => import('../views/QuestionnaireView.vue'),
  },
  {
    // 带底部导航的主布局
    path: '/',
    component: () => import('../views/MainLayout.vue'),
    children: [
      {
        path: 'recommend',
        name: 'Recommend',
        component: () => import('../views/RecommendView.vue'),
      },
      {
        path: 'itinerary',
        name: 'Itinerary',
        component: () => import('../views/ItineraryView.vue'),
      },
      {
        path: 'guide',
        name: 'Guide',
        component: () => import('../views/GuideView.vue'),
      },
      {
        path: 'memory',
        name: 'Memory',
        component: () => import('../views/MemoryView.vue'),
      },
    ],
  },
  {
    path: '/home',
    redirect: '/recommend',
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

export default router
