<template>
  <div class="main-layout">
    <!-- 内容区：子路由在此渲染 -->
    <div class="layout-content">
      <router-view v-slot="{ Component, route }">
        <transition :name="transitionName" mode="out-in">
          <component :is="Component" :key="route.path" />
        </transition>
      </router-view>
    </div>

    <!-- 持久化底部导航，始终存在 -->
    <div class="bottom-nav">
      <div
        class="nav-item"
        :class="{ active: currentRoute === '/recommend' }"
        @click="navigate('/recommend')"
      >
        <span class="nav-icon">🎸</span>
        <span>推荐</span>
      </div>
      <div
        class="nav-item"
        :class="{ active: currentRoute === '/itinerary' }"
        @click="navigate('/itinerary')"
      >
        <span class="nav-icon">📅</span>
        <span>行程</span>
        <span v-if="store.itinerary.length > 0" class="nav-badge">{{ store.itinerary.length }}</span>
      </div>
      <div
        class="nav-item nav-item-agent"
        :class="{ active: agentOpen }"
        @click="agentOpen = true"
      >
        <span class="nav-icon agent-icon">✦</span>
        <span>Agent</span>
      </div>
      <div
        class="nav-item"
        :class="{ active: currentRoute === '/guide' }"
        @click="navigate('/guide')"
      >
        <span class="nav-icon">🗺️</span>
        <span>攻略</span>
      </div>
      <div
        class="nav-item"
        :class="{ active: currentRoute === '/memory' }"
        @click="navigate('/memory')"
      >
        <span class="nav-icon">📸</span>
        <span>回忆</span>
      </div>
    </div>

    <!-- Agent 面板：从底部弹出 -->
    <transition name="agent-slide-up">
      <div v-if="agentOpen" class="agent-overlay">
        <AgentView @close="agentOpen = false" />
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../stores/index.js'
import AgentView from './AgentView.vue'

const route = useRoute()
const router = useRouter()
const store = useUserStore()

const currentRoute = computed(() => route.path)
const agentOpen = ref(false)

// Tab 顺序，用于判断滑动方向
const tabOrder = ['/recommend', '/itinerary', '/guide', '/memory']
const transitionName = ref('tab-slide-left')

let prevIndex = tabOrder.indexOf(route.path)

watch(
  () => route.path,
  (newPath) => {
    const newIndex = tabOrder.indexOf(newPath)
    if (newIndex === -1 || prevIndex === -1) {
      transitionName.value = 'tab-fade'
    } else {
      transitionName.value = newIndex > prevIndex ? 'tab-slide-left' : 'tab-slide-right'
    }
    prevIndex = newIndex
  }
)

function navigate(path) {
  if (route.path !== path) {
    router.push(path)
  }
}
</script>

<style scoped>
.main-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-app);
  overflow: hidden;
}

.layout-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* 底部导航 */
.bottom-nav {
  flex-shrink: 0;
  display: flex;
  background: rgba(12, 15, 23, 0.98);
  backdrop-filter: blur(16px);
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
  transition: color 0.2s;
  user-select: none;
}

.nav-icon {
  font-size: 1rem;
  line-height: 1;
}

.nav-item.active {
  color: var(--primary);
}

.nav-item:active {
  opacity: 0.7;
}

.nav-badge {
  position: absolute;
  top: 4px;
  right: calc(50% - 18px);
  background: var(--primary);
  color: #0f1117;
  font-size: 0.55rem;
  font-weight: 700;
  min-width: 14px;
  height: 14px;
  border-radius: 7px;
  padding: 0 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

/* Agent 中间按钮 */
.nav-item-agent {
  color: var(--primary);
}

.agent-icon {
  font-size: 1.1rem;
  line-height: 1;
  font-style: normal;
}

/* Tab 切换动画：向左滑（前进） */
.tab-slide-left-enter-active,
.tab-slide-left-leave-active {
  transition: all 0.22s ease;
  position: absolute;
  width: 100%;
  height: 100%;
}
.tab-slide-left-enter-from {
  transform: translateX(30px);
  opacity: 0;
}
.tab-slide-left-leave-to {
  transform: translateX(-30px);
  opacity: 0;
}

/* Tab 切换动画：向右滑（后退） */
.tab-slide-right-enter-active,
.tab-slide-right-leave-active {
  transition: all 0.22s ease;
  position: absolute;
  width: 100%;
  height: 100%;
}
.tab-slide-right-enter-from {
  transform: translateX(-30px);
  opacity: 0;
}
.tab-slide-right-leave-to {
  transform: translateX(30px);
  opacity: 0;
}

/* 淡入淡出（非 tab 间跳转） */
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: opacity 0.18s ease;
  position: absolute;
  width: 100%;
  height: 100%;
}
.tab-fade-enter-from,
.tab-fade-leave-to {
  opacity: 0;
}

/* Agent overlay */
.agent-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 200;
  background: var(--bg-app);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Agent 从底部弹出动画 */
.agent-slide-up-enter-active,
.agent-slide-up-leave-active {
  transition: transform 0.32s cubic-bezier(0.32, 0.72, 0, 1);
}
.agent-slide-up-enter-from,
.agent-slide-up-leave-to {
  transform: translateY(100%);
}
.agent-slide-up-enter-to,
.agent-slide-up-leave-from {
  transform: translateY(0);
}
</style>
