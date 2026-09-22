import { createRouter, createWebHashHistory } from 'vue-router'
import RecorderView from '@/views/RecorderView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'recorder', component: RecorderView },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})
