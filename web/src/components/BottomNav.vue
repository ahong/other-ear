<template>
  <div class="bottom-nav">
    <div
      class="nav-item"
      :class="{ active: route.path === '/recommend' }"
      @click="router.push('/recommend')"
    >
      <span>🎸</span><span>推荐</span>
    </div>
    <div
      class="nav-item"
      :class="{ active: route.path === '/itinerary' }"
      @click="router.push('/itinerary')"
    >
      <span>📅</span><span>行程</span>
      <span v-if="store.itinerary.length > 0" class="nav-badge">{{ store.itinerary.length }}</span>
    </div>
    <div
      class="nav-item"
      :class="{ active: route.path === '/guide' }"
      @click="router.push('/guide')"
    >
      <span>🗺️</span><span>攻略</span>
    </div>
    <div
      class="nav-item"
      :class="{ active: route.path === '/memory' }"
      @click="router.push('/memory')"
    >
      <span>📸</span><span>回忆</span>
    </div>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../stores/index.js'

const route = useRoute()
const router = useRouter()
const store = useUserStore()
</script>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  display: flex;
  background: rgba(12, 15, 23, 0.95);
  backdrop-filter: blur(12px);
  border-top: 1px solid #1a1e2a;
  z-index: 100;
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.55rem 0 0.65rem;
  font-size: 0.65rem;
  color: var(--text-muted);
  cursor: pointer;
  gap: 0.15rem;
  position: relative;
  transition: color 0.15s;
}

.nav-item span:first-child {
  font-size: 1rem;
}

.nav-item.active {
  color: var(--primary);
}

.nav-item:active {
  color: var(--primary);
}

.nav-badge {
  position: absolute;
  top: 4px;
  right: calc(50% - 16px);
  background: var(--primary);
  color: #0f1117;
  font-size: 0.55rem;
  font-weight: 700;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
</style>
