<template>
  <div class="memory page-scroll">
    <!-- 页头 -->
    <div class="memory-header">
      <div class="header-title">📸 我的演出回忆</div>
    </div>

    <!-- 上传票根 -->
    <div class="section">
      <div
        class="upload-card"
        @click="triggerUpload"
      >
        <div class="upload-icon">📷</div>
        <div class="upload-text">
          <div class="upload-title">上传票根截图</div>
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
    </div>

    <!-- 有数据状态 -->
    <template v-if="hasData">
      <!-- 音乐人格 -->
      <div class="section">
        <div class="memory-card">
          <div class="card-title">🧠 我的音乐人格</div>
          <div class="tags-wrap">
            <span v-for="tag in personalityTags" :key="tag" class="m-tag">{{ tag }}</span>
          </div>
          <p class="personality-desc">{{ personalityDesc }}</p>
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
              </div>
              <div class="history-date">{{ item.date }}</div>
            </div>
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
import { ref, computed, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/index.js'

const router = useRouter()
const store = useUserStore()
const showToast = inject('showToast')
const fileInputRef = ref(null)

const currentYear = new Date().getFullYear()

// 固定历史演出数据（模拟）
const fixedHistory = [
  { artist: '万能青年旅店', tourName: '冀西南林路行', date: '2025-10-15', city: '北京' },
  { artist: '草东没有派对', tourName: '瓦合巡演', date: '2025-08-20', city: '上海' },
  { artist: 'deca joins', tourName: '夜间独白', date: '2025-06-18', city: '成都' },
  { artist: '法兹乐队', tourName: '折叠故事', date: '2025-04-05', city: '厦门' },
  { artist: '声音玩具', tourName: '劳动之余', date: '2024-11-10', city: '南京' },
]

// 上传的回忆
const uploadedMemories = computed(() => store.memories)

// 是否有数据：固定历史 + 上传的
const hasData = computed(() => fixedHistory.length > 0 || uploadedMemories.value.length > 0)

// 所有历史记录
const allHistoryItems = computed(() => {
  const fromMemories = uploadedMemories.value.map(m => ({
    artist: m.artist,
    tourName: m.tourName || m.name || '',
    date: m.date,
    city: m.city || ''
  }))
  return [...fromMemories, ...fixedHistory].sort((a, b) => new Date(b.date) - new Date(a.date))
})

// 音乐人格标签
const personalityTags = computed(() => {
  const genres = store.profile.genres || []
  const tags = new Set(['Livehouse', '华语 indie'])
  if (genres.includes('摇滚')) tags.add('独立摇滚')
  if (genres.includes('后朋克')) tags.add('后朋克')
  if (genres.includes('民谣')) tags.add('实验民谣')
  if (genres.includes('电子')) tags.add('电子实验')
  if (genres.includes('独立')) tags.add('独立慵懒')
  return Array.from(tags).slice(0, 5)
})

const personalityDesc = computed(() => {
  return '你偏好 Livehouse 小场演出，喜欢文学气质和情绪表达浓烈的乐队，经常跨城市追巡演，是典型的「巡演漫游型乐迷」。'
})

// 年度统计
const yearStats = computed(() => {
  const yearItems = allHistoryItems.value.filter(i => i.date.startsWith(String(currentYear - 1)))
  const cities = new Set(yearItems.map(i => i.city).filter(Boolean))
  const artistCounts = {}
  yearItems.forEach(i => { artistCounts[i.artist] = (artistCounts[i.artist] || 0) + 1 })
  const favArtist = Object.entries(artistCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '万能青年旅店'

  return [
    { label: '看过演出', value: `${allHistoryItems.value.length} 场` },
    { label: '去过城市', value: `${Math.max(cities.size, 5)} 个` },
    { label: '最常看', value: favArtist },
    { label: '常去场馆', value: '疆进酒' }
  ]
})

// 城市足迹
const visitedCities = computed(() => {
  const set = new Set(allHistoryItems.value.map(i => i.city).filter(Boolean))
  set.add('北京'); set.add('上海'); set.add('成都'); set.add('武汉'); set.add('南京')
  return set
})

const allCities = computed(() => {
  const list = ['北京', '上海', '成都', '广州', '杭州', '南京', '西安', '武汉', '深圳', '厦门', '成都', '重庆']
  const unique = [...new Set(list)]
  return unique.map(c => ({ name: c, visited: visitedCities.value.has(c) }))
})

// 文件上传
function triggerUpload() {
  fileInputRef.value?.click()
}

function handleFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  showToast('AI 识别中...')
  setTimeout(() => {
    const mockData = [
      { artist: '草东没有派对', tourName: '瓦合巡演', date: '2025-12-01', city: '上海' },
      { artist: '万能青年旅店', tourName: '冀西南林路行', date: '2025-10-15', city: '北京' },
      { artist: 'deca joins', tourName: '夜间独白', date: '2025-09-20', city: '成都' }
    ]
    const result = mockData[Math.floor(Math.random() * mockData.length)]
    store.addMemory(result)
    showToast(`✓ 识别成功：${result.artist} - ${result.tourName}`)
    e.target.value = ''
  }, 1200)
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

.add-btn:active {
  transform: scale(0.96);
}

</style>
