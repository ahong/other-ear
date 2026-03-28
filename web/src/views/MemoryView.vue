<template>
  <div class="memory page-scroll">
    <!-- 页头 -->
    <div class="memory-header">
      <div class="header-title">📸 我的演出回忆</div>
    </div>

    <!-- 上传票根 -->
    <div class="section upload-section">
      <div
        class="upload-card"
        :style="recognizing ? 'opacity:0.6;pointer-events:none' : ''"
        @click="triggerUpload"
      >
        <div class="upload-icon">{{ recognizing ? '⏳' : '📷' }}</div>
        <div class="upload-text">
          <div class="upload-title">{{ uploadTitle }}</div>
          <div class="upload-desc">AI 自动识别演出记录，生成你的演出人生</div>
        </div>
        <div class="upload-arrow">+</div>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          style="display:none"
          @change="handleFileChange"
        />
      </div>
      <!-- 上传区局部 Toast -->
      <transition name="upload-toast">
        <div v-if="uploadToast.visible" class="upload-toast">{{ uploadToast.text }}</div>
      </transition>
    </div>

    <!-- 有数据状态 -->
    <template v-if="hasData">
      <!-- 音乐人格 -->
      <div class="section">
        <div class="memory-card">
          <div class="card-title">🧠 我的音乐人格</div>
          <template v-if="analyzing">
            <div class="empty-block">
              <div class="empty-big">⏳</div>
              <p>AI 正在分析你的音乐偏好…</p>
            </div>
          </template>
          <template v-else>
            <div class="tags-wrap">
              <span v-for="tag in personalityTags" :key="tag" class="m-tag">{{ tag }}</span>
            </div>
            <p class="personality-desc">{{ personalityDesc }}</p>
          </template>
        </div>
      </div>

      <!-- 年度总结 -->
      <div class="section">
        <div class="memory-card">
          <div class="card-title">📊 {{ currentYear }} 年度演出总结</div>
          <div class="stat-grid">
            <div v-for="stat in yearStats" :key="stat.label" class="stat-item">
              <div class="stat-value">{{ stat.value }}</div>
              <div class="stat-label">{{ stat.label }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 巡演城市足迹 -->
      <div class="section">
        <div class="memory-card">
          <div class="card-title">🗺️ 巡演足迹城市</div>
          <div class="city-grid">
            <div
              v-for="city in allCities"
              :key="city.name"
              class="city-item"
              :class="{ visited: city.visited }"
            >
              {{ city.name }}
              <span v-if="city.visited" class="city-check">✓</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 历史记录 -->
      <div class="section" style="padding-bottom:1.5rem">
        <div class="memory-card">
          <div class="card-title">📀 历史演出记录</div>
          <div class="history-list">
            <div
              v-for="item in allHistoryItems"
              :key="`${item.artist}-${item.date}`"
              class="history-item"
            >
              <div class="history-left">
                <div class="history-artist">{{ item.artist }}</div>
                <div class="history-tour">{{ item.tourName }}</div>
                <div v-if="item.price > 0" class="history-price">¥{{ item.price }}</div>
              </div>
              <div class="history-date">{{ item.date }}</div>
            </div>
          </div>
          <!-- 累计消费 -->
          <div v-if="totalSpent > 0" class="history-total">
            💰 累计观演消费：<span class="total-amount">¥{{ totalSpent }}</span> 元
          </div>
        </div>
      </div>
    </template>

    <!-- 空状态 -->
    <template v-else>
      <!-- 音乐人格空 -->
      <div class="section">
        <div class="memory-card">
          <div class="card-title">🧠 我的音乐人格</div>
          <div class="empty-block">
            <div class="empty-big">🎧</div>
            <p>还没有音乐人格数据</p>
            <p class="empty-sub">记录 3 场以上演出后，AI 会生成你的音乐人格</p>
          </div>
        </div>
      </div>

      <!-- 年度总结空 -->
      <div class="section">
        <div class="memory-card">
          <div class="card-title">📊 年度演出总结</div>
          <div class="empty-block">
            <div class="empty-big">📈</div>
            <p>今年还没有记录演出</p>
            <p class="empty-sub">去看一场现场吧</p>
          </div>
        </div>
      </div>

      <!-- 城市足迹空 -->
      <div class="section">
        <div class="memory-card">
          <div class="card-title">🗺️ 巡演足迹城市</div>
          <div class="empty-block">
            <div class="empty-big">🌍</div>
            <p>你还没有巡演足迹</p>
            <p class="empty-sub">添加一次巡演行程开始记录</p>
          </div>
        </div>
      </div>

      <!-- 历史记录空 -->
      <div class="section" style="padding-bottom:1.5rem">
        <div class="memory-card">
          <div class="card-title">📀 历史演出记录</div>
          <div class="empty-block">
            <div class="empty-big">🎫</div>
            <p>还没有演出记录</p>
            <p class="empty-sub">上传票根或添加行程</p>
            <button class="add-btn" @click="router.push('/recommend')">去添加演出</button>
          </div>
        </div>
      </div>
    </template>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/index.js'
import { recognizeShowFromImage } from '../utils/showRecognizer.js'
import { analyzeMyShows } from '../utils/deepseek.js'

const router = useRouter()
const store = useUserStore()
const fileInputRef = ref(null)
const recognizing = ref(false)

// ── 上传区局部 Toast ────────────────────────────────────────────────────────
const uploadToast = reactive({ visible: false, text: '', timer: null })
function showUploadToast(text) {
  clearTimeout(uploadToast.timer)
  uploadToast.text = text
  uploadToast.visible = true
  uploadToast.timer = setTimeout(() => { uploadToast.visible = false }, 2200)
}

const currentYear = new Date().getFullYear()

// ── 数据源：来自 store.memories（已持久化） ──────────────────────────────
const myShows = computed(() => store.memories)

const hasData = computed(() => myShows.value.length > 0)

// 历史记录：按日期倒序
const allHistoryItems = computed(() =>
  [...myShows.value]
    .map(m => ({
      artist: m.artist,
      tourName: m.tourName || m.title || '',
      date: m.date || m.showDate || '',
      city: m.city || '',
      price: m.price || 0,
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
)

// 累计消费：只统计有价格数据（price > 0）的场次
const totalSpent = computed(() =>
  allHistoryItems.value.reduce((sum, item) => sum + (Number(item.price) || 0), 0)
)

// ── AI 分析结果 ────────────────────────────────────────────────────────────
const analysisResult = ref(null)
const analyzing = ref(false)

async function runAnalysis() {
  if (myShows.value.length === 0) { analysisResult.value = null; return }
  analyzing.value = true
  const result = await analyzeMyShows(myShows.value)
  analysisResult.value = result
  analyzing.value = false
}

// 页面加载时分析一次；myShows 变化（新增记录）后重新分析
onMounted(runAnalysis)
watch(myShows, runAnalysis, { deep: true })

// ── 音乐人格 ──────────────────────────────────────────────────────────────
const personalityTags = computed(
  () => analysisResult.value?.musicPersonality?.tags?.slice(0, 4) ?? []
)
const personalityDesc = computed(
  () => analysisResult.value?.musicPersonality?.summary ?? ''
)

// ── 年度统计 ──────────────────────────────────────────────────────────────
const yearStats = computed(() => {
  const ys = analysisResult.value?.yearSummary
  return [
    { label: '看过演出', value: ys ? `${ys.totalShows} 场` : '-' },
    { label: '去过城市', value: ys ? `${ys.totalCities} 个` : '-' },
    { label: '最常看',   value: ys?.mostSeenArtist || '-' },
    { label: '常去场馆', value: ys?.mostVisitedVenue || '-' },
  ]
})

// ── 城市足迹 ──────────────────────────────────────────────────────────────
const visitedCitySet = computed(() => {
  const aiCities = analysisResult.value?.cities ?? []
  const localCities = myShows.value.map(s => s.city).filter(Boolean)
  return new Set([...aiCities, ...localCities])
})

const allCities = computed(() => {
  // 固定展示城市网格 + AI 返回的城市（去重合并）
  const base = ['北京', '上海', '成都', '广州', '杭州', '南京', '西安', '武汉', '深圳', '厦门', '重庆', '长沙']
  const extra = [...visitedCitySet.value].filter(c => !base.includes(c))
  const allCityNames = [...new Set([...base, ...extra])]

  // 按城市统计观演场次和最近演出时间
  const cityStats = {}
  for (const show of myShows.value) {
    const city = show.city
    if (!city) continue
    if (!cityStats[city]) cityStats[city] = { count: 0, latestTs: 0 }
    cityStats[city].count++
    const ts = new Date(show.date || show.showDate || '').getTime()
    if (!isNaN(ts) && ts > cityStats[city].latestTs) cityStats[city].latestTs = ts
  }

  return allCityNames
    .map(c => ({
      name: c,
      visited: visitedCitySet.value.has(c),
      _count: cityStats[c]?.count ?? 0,
      _latestTs: cityStats[c]?.latestTs ?? 0,
    }))
    .sort((a, b) => {
      // 已去过的城市排前，未去过的排后
      if (a.visited !== b.visited) return a.visited ? -1 : 1
      // 同为已去过：场次多的排前，场次相同则最近演出时间更近的排前
      if (b._count !== a._count) return b._count - a._count
      return b._latestTs - a._latestTs
    })
})

// ── 文件上传 ──────────────────────────────────────────────────────────────
// 上传卡片标题（分步提示）
const uploadStatus = ref('idle') // 'idle' | 'ocr' | 'ai'
const uploadTitle = computed(() => {
  if (uploadStatus.value === 'ocr') return 'OCR 正在识别票根文字…'
  if (uploadStatus.value === 'ai') return 'AI 正在提取演出信息…'
  return '上传票根截图'
})

function triggerUpload() {
  if (recognizing.value) return
  fileInputRef.value?.click()
}

async function handleFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  e.target.value = ''

  recognizing.value = true
  uploadStatus.value = 'ocr'
  showUploadToast('OCR 正在识别票根文字…')

  // recognizeShowFromImage 内部：Step1 压缩 → Step2 OCR → Step3 DeepSeek
  // 在 OCR 完成、进入 DeepSeek 前切换提示（通过 setTimeout 近似模拟，实际由函数内部控制）
  const aiHintTimer = setTimeout(() => {
    if (recognizing.value) {
      uploadStatus.value = 'ai'
      showUploadToast('AI 正在提取演出信息…')
    }
  }, 4000)

  const { data: completed, error } = await recognizeShowFromImage(file)

  clearTimeout(aiHintTimer)
  recognizing.value = false
  uploadStatus.value = 'idle'

  if (error) {
    showUploadToast(error)
    return
  }
  if (completed.length === 0) {
    showUploadToast('未识别到有效演出记录，请重试')
    return
  }

  const existing = store.memories
  let addedCount = 0
  for (const r of completed) {
    const isDup = existing.some(
      m => m.artist === r.artist && (m.date === r.showDate || m.showDate === r.showDate)
    )
    if (!isDup) {
      store.addMemory({
        artist: r.artist,
        tourName: r.title || '',
        date: r.showDate || '',
        city: r.city || '',
        venue: r.venue || '',
        price: r.price || 0,
        status: r.status,
      })
      addedCount++
    }
  }

  if (addedCount > 0) {
    showUploadToast(`成功添加 ${addedCount} 场演出记录`)
  } else {
    showUploadToast('演出记录已存在，无需重复添加')
  }
}
</script>

<style scoped>
.memory {
  background: var(--bg-app);
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

/* 页头 */
.memory-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.2rem 0.8rem;
  position: sticky;
  top: 0;
  background: var(--bg-app);
  z-index: 10;
  border-bottom: 1px solid #1a1e2a;
}

.back-btn {
  background: var(--bg-item);
  border: 1px solid #2a2f3a;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-title {
  font-size: 1rem;
  font-weight: 700;
}

/* 区块 */
.section {
  padding: 0.8rem 1rem 0;
}

/* 上传卡片 */
.upload-card {
  background: var(--bg-card);
  border: 1px dashed rgba(255, 107, 107, 0.35);
  border-radius: 18px;
  padding: 1rem 1.1rem;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  cursor: pointer;
  transition: all 0.15s;
}

.upload-card:active {
  background: rgba(255, 107, 107, 0.05);
  border-color: rgba(255, 107, 107, 0.6);
}

.upload-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.upload-text {
  flex: 1;
}

.upload-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.upload-desc {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-top: 0.15rem;
}

.upload-arrow {
  width: 28px;
  height: 28px;
  background: var(--primary);
  color: #0f1117;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: 700;
  flex-shrink: 0;
}

/* 通用卡片 */
.memory-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 1rem;
}

.card-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
}

/* 标签 */
.tags-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 0.75rem;
}

.m-tag {
  background: #1e2535;
  border: 1px solid rgba(123, 156, 255, 0.2);
  color: #99b0ff;
  padding: 0.25rem 0.7rem;
  border-radius: 20px;
  font-size: 0.75rem;
}

.personality-desc {
  font-size: 0.76rem;
  color: var(--text-muted);
  line-height: 1.6;
}

/* 年度统计 */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.7rem;
}

.stat-item {
  background: var(--bg-item);
  border-radius: 12px;
  padding: 0.7rem;
  text-align: center;
}

.stat-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--accent);
}

.stat-label {
  font-size: 0.68rem;
  color: var(--text-muted);
  margin-top: 0.2rem;
}

/* 城市足迹 */
.city-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.55rem;
}

.city-item {
  background: var(--bg-item);
  border: 1px solid #2a2f3a;
  border-radius: 10px;
  padding: 0.55rem 0.4rem;
  text-align: center;
  font-size: 0.78rem;
  color: var(--text-muted);
  position: relative;
}

.city-item.visited {
  background: rgba(255, 107, 107, 0.08);
  border-color: rgba(255, 107, 107, 0.3);
  color: #ffaaaa;
}

.city-check {
  position: absolute;
  top: 4px;
  right: 6px;
  font-size: 0.6rem;
  color: var(--primary);
}

/* 历史记录 */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-item);
  border-radius: 12px;
  padding: 0.65rem 0.75rem;
}

.history-artist {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.history-tour {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 0.1rem;
}

.history-date {
  font-size: 0.72rem;
  color: var(--accent);
  flex-shrink: 0;
}

.history-price {
  font-size: 0.7rem;
  color: #80d890;
  margin-top: 0.15rem;
}

.history-total {
  margin-top: 0.75rem;
  padding-top: 0.65rem;
  border-top: 1px solid #1e2129;
  font-size: 0.75rem;
  color: var(--text-muted);
  text-align: right;
}

.total-amount {
  color: #80d890;
  font-weight: 700;
  font-size: 0.82rem;
}

/* 空状态 */
.empty-block {
  text-align: center;
  padding: 1.5rem 1rem;
}

.empty-big {
  font-size: 2rem;
  margin-bottom: 0.6rem;
}

.empty-block p {
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.empty-sub {
  font-size: 0.72rem !important;
  color: var(--text-muted) !important;
  margin-top: 0.3rem;
}

.add-btn {
  margin-top: 0.9rem;
  background: var(--primary);
  border: none;
  border-radius: 20px;
  padding: 0.45rem 1.2rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #0f1117;
  cursor: pointer;
}

/* 上传区块（作为局部 Toast 的定位基准） */
.upload-section {
  position: relative;
}

/* 上传区局部 Toast */
.upload-toast {
  position: absolute;
  bottom: -2.2rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(42, 47, 58, 0.95);
  backdrop-filter: blur(8px);
  padding: 0.4rem 1.1rem;
  border-radius: 30px;
  font-size: 0.78rem;
  color: #eef2ff;
  z-index: 100;
  white-space: nowrap;
  pointer-events: none;
  border: 1px solid rgba(255, 107, 107, 0.2);
  max-width: 90%;
  text-align: center;
}

.upload-toast-enter-active,
.upload-toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.upload-toast-enter-from,
.upload-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-4px);
}

.add-btn:active {
  transform: scale(0.96);
}

</style>
