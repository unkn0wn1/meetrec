import { createRouter, createWebHashHistory } from 'vue-router'
import LibraryView from '@/views/LibraryView.vue'
import RecorderView from '@/views/RecorderView.vue'
import RecordingDetailView from '@/views/RecordingDetailView.vue'
import SettingsView from '@/views/SettingsView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'library', component: LibraryView },
    { path: '/record', name: 'record', component: RecorderView },
    { path: '/recordings/:id', name: 'recording', component: RecordingDetailView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})
