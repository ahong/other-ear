<template>
  <div class="app-shell">
    <router-view v-slot="{ Component, route }">
      <!-- 顶层路由（Splash/Questionnaire/MainLayout）之间切换用 page 过渡 -->
      <transition name="page" mode="out-in">
        <component :is="Component" :key="route.matched[0]?.path ?? route.path" />
      </transition>
    </router-view>

    <!-- 全局 Toast -->
    <transition name="toast">
      <div v-if="toast.visible" class="global-toast" :class="toast.position">{{ toast.text }}</div>
    </transition>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import { provide } from 'vue'

const toast = reactive({ visible: false, text: '', position: 'bottom', timer: null })

function showToast(text, position = 'bottom') {
  clearTimeout(toast.timer)
  toast.text = text
  toast.position = position
  toast.visible = true
  toast.timer = setTimeout(() => { toast.visible = false }, 2200)
}

provide('showToast', showToast)
</script>

<style scoped>
.global-toast {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(42, 47, 58, 0.95);
  backdrop-filter: blur(8px);
  padding: 0.5rem 1.2rem;
  border-radius: 30px;
  font-size: 0.78rem;
  color: #eef2ff;
  z-index: 9999;
  white-space: nowrap;
  pointer-events: none;
  border: 1px solid rgba(255, 107, 107, 0.2);
  max-width: 80%;
  text-align: center;
  /* 默认底部 */
  bottom: 36px;
  top: auto;
}

.global-toast.top {
  top: 22%;
  bottom: auto;
}
</style>
