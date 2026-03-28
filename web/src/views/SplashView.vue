<template>
  <div class="splash page-scroll">
    <canvas ref="canvasRef" class="sound-canvas" />

    <div class="splash-content">
      <div class="logo-wrap">
        <div class="logo-en">KEEP ONE EAR FOR LIVE</div>
        <div class="logo-cn">另一只耳</div>
      </div>

      <p class="sub-text">懂你口味的演出推荐 AI</p>

      <button class="enter-btn" @click="handleEnter">
        看看它懂不懂你
        <span class="btn-arrow">→</span>
      </button>

      <p v-if="hasProfile" class="already-done" @click="goHome">
        已有偏好，直接进入 →
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/index.js'

const router = useRouter()
const store = useUserStore()
const canvasRef = ref(null)
const hasProfile = ref(store.profile.hasCompleted)

let animId = null
let timeOffset = 0

function handleEnter() {
  router.push('/questionnaire')
}

function goHome() {
  router.push('/home')
}

// Canvas 声场动画
function initCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')

  function resize() {
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
  }

  function draw() {
    const w = canvas.width
    const h = canvas.height
    if (!w || !h) { animId = requestAnimationFrame(draw); return }

    ctx.clearRect(0, 0, w, h)

    // 渐变背景
    const grad = ctx.createLinearGradient(0, 0, w, h)
    grad.addColorStop(0, '#03050a')
    grad.addColorStop(1, '#0d111c')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)

    // 主波形组
    for (let i = 0; i < 7; i++) {
      ctx.beginPath()
      const yOff = h * (0.15 + i * 0.11)
      const amp = 16 + Math.sin(timeOffset * 0.7 + i * 0.8) * 7
      for (let x = 0; x <= w; x += 4) {
        const y = yOff + Math.sin(x * 0.014 + timeOffset + i * 0.6) * amp
          + Math.cos(x * 0.009 + timeOffset * 1.1) * 6
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = `rgba(255, ${120 + i * 8}, ${80 - i * 5}, ${0.25 + i * 0.04})`
      ctx.lineWidth = 1.2
      ctx.stroke()
    }

    // 次波形（反向）
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      const yBase = h * 0.55 + i * 18
      for (let x = 0; x <= w; x += 5) {
        const y = yBase + Math.sin(x * 0.022 + timeOffset * 1.4 + i) * 11
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = `rgba(255, 179, 71, 0.18)`
      ctx.lineWidth = 0.8
      ctx.stroke()
    }

    // 扩散圆环
    const cx = w / 2, cy = h * 0.42
    const rb = 36 + Math.sin(timeOffset * 0.9) * 9
    for (let r = 0; r < 4; r++) {
      ctx.beginPath()
      ctx.arc(cx, cy, rb + r * 32, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255, 107, 107, ${0.13 - r * 0.025})`
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // 粒子光点
    for (let p = 0; p < 24; p++) {
      const px = ((p * 43 + timeOffset * 18) % w + w) % w
      const py = h * 0.28 + Math.sin(p * 0.4 + timeOffset * 2.2) * 22
      ctx.beginPath()
      ctx.arc(px, py, 1.2, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 200, 120, ${0.35 + Math.sin(p + timeOffset) * 0.2})`
      ctx.fill()
    }

    timeOffset += 0.022
    animId = requestAnimationFrame(draw)
  }

  resize()
  draw()

  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  return ro
}

let ro = null
onMounted(() => {
  ro = initCanvas()
})

onUnmounted(() => {
  if (animId) cancelAnimationFrame(animId)
  if (ro) ro.disconnect()
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&display=swap');
.splash {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: #03050a;
  overflow: hidden;
}

.sound-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.splash-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 2.5rem;
  text-align: center;
}

.logo-wrap {
  margin-bottom: 1rem;
}

.logo-cn {
  font-family: 'ZCOOL KuaiLe', cursive;
  font-size: 4.2rem;
  font-weight: 800;
  background: linear-gradient(135deg, #FFB347 0%, #FF6B6B 60%, #ff4f8b 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  letter-spacing: 0.02em;
  line-height: 1.1;
}

.logo-en {
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.28em;
  color: rgba(255, 107, 107, 0.5);
  margin-bottom: 1rem;
}

.sub-text {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-bottom: 6.4rem;
  line-height: 1.5;
  letter-spacing: 0.5em;
}

.enter-btn {
  background: linear-gradient(135deg, #FF6B6B, #ff4f8b);
  border: none;
  border-radius: 40px;
  padding: 0.85rem 2.5rem;
  font-weight: 700;
  font-size: 1.05rem;
  color: #fff;
  cursor: pointer;
  letter-spacing: 0.02em;
  box-shadow: 0 4px 20px rgba(255, 107, 107, 0.4), 0 0 0 1px rgba(255, 107, 107, 0.15);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  justify-content: center;
}

.enter-btn:active {
  transform: scale(0.97);
  box-shadow: 0 2px 12px rgba(255, 107, 107, 0.3);
}

.btn-arrow {
  font-size: 1.1rem;
}

.already-done {
  margin-top: 1rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.already-done:active {
  color: var(--primary);
}
</style>
