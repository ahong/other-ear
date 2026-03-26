<template>
  <div class="home">
    <!-- 顶部 Tab 导航 -->
    <div class="tab-bar">
      <div
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-item"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span class="tab-label">{{ tab.label }}</span>
      </div>
    </div>

    <!-- 推荐 Tab -->
    <div v-show="activeTab === 'recommend'" class="tab-content page-scroll">
      <!-- 问候语 -->
      <div class="greeting">
        <div class="greeting-text">
          <span class="hi">嗨 👋</span>
          <span class="desc">为你找到了 {{ recommendations.length }} 场演出</span>
        </div>
        <button class="profile-btn" @click="router.push('/questionnaire')">调整偏好</button>
      </div>

      <!-- 搜索栏 -->
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="试试：下个月上海摇滚 / 类似草东"
          @keyup.enter="handleSearch"
        />
        <button class="search-btn" @click="handleSearch">AI 搜</button>
      </div>

      <!-- 推荐卡片列表 -->
      <div class="recommend-list">
        <div
          v-for="show in displayShows"
          :key="show.id"
          class="show-card"
        >
          <!-- 艺人信息 -->
          <div class="card-top">
            <div>
              <div class="card-artist">{{ show.artist }}</div>
              <div class="card-tour">{{ show.tourName }}</div>
            </div>
            <div class="difficulty-badge" :class="getDiffClass(show.difficulty)">
              {{ show.difficulty }}
            </div>
          </div>

          <!-- 演出信息 -->
          <div class="card-meta">
            <span>📍 {{ show.city }} · {{ show.venue }}</span>
            <span>📅 {{ show.date }}</span>
          </div>

          <!-- AI 推荐理由 -->
          <div class="ai-reason">
            <span class="ai-tag">AI</span>
            {{ store.getAIReason(show) }}
          </div>

          <!-- 代表作 -->
          <div class="representative">
            🎤 {{ show.representative }}
          </div>

          <!-- 开票提醒 -->
          <div class="ticket-reminder">
            🎫 开票：{{ show.ticketDate }} ·
            <span :class="getTicketClass(show.ticketDate)">{{ store.getReminderText(show.ticketDate) }}</span>
          </div>

          <!-- 操作按钮 -->
          <div class="card-actions">
            <button
              class="action-btn"
              :class="{ 'in-plan': isInItinerary(show.id) }"
              @click="handleRemind(show)"
            >
              {{ isInItinerary(show.id) ? '✓ 已添加' : '🔔 加入行程' }}
            </button>
            <button class="action-btn secondary" @click="goToGuide(show)">🗺️ 攻略</button>
            <button class="action-btn secondary" @click="openDetail(show)">📋 详情</button>
          </div>
        </div>

        <div v-if="displayShows.length === 0" class="empty-state">
          <div class="empty-icon">🎵</div>
          <p>没有找到相关演出</p>
          <button class="btn-ghost" style="width:auto;padding:0.5rem 1.2rem;font-size:0.8rem" @click="clearSearch">清除搜索</button>
        </div>
      </div>
    </div>

    <!-- 行程 Tab -->
    <div v-show="activeTab === 'itinerary'" class="tab-content page-scroll">
      <div class="section-header">
        <div class="section-title">📅 我的行程</div>
        <div class="section-sub">点击「加入行程」从推荐添加</div>
      </div>

      <div v-if="store.itinerary.length === 0" class="empty-state">
        <div class="empty-icon">📅</div>
        <p>暂无行程</p>
        <p class="empty-sub">去推荐页点击「加入行程」</p>
        <button class="action-btn" style="width:auto;padding:0.5rem 1.5rem;margin-top:0.8rem" @click="activeTab='recommend'">去看演出推荐</button>
      </div>

      <div v-else class="timeline">
        <div
          v-for="item in sortedItinerary"
          :key="item.showId"
          class="timeline-item"
        >
          <div class="timeline-dot"></div>
          <div class="timeline-card">
            <div class="tl-reminder">
              ⏰ {{ store.getReminderText(item.ticketDate) }}
            </div>
            <div class="tl-artist">{{ item.artist }}</div>
            <div class="tl-tour">{{ item.tourName }}</div>
            <div class="tl-meta">{{ item.city }} · {{ item.venue }} · {{ item.date }}</div>
            <div class="tl-actions">
              <button class="action-btn secondary small" @click="goToGuideById(item)">🗺️ 攻略</button>
              <button class="action-btn remove small" @click="removeItinerary(item.showId)">移除</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部全局导航 -->
    <div class="bottom-nav">
      <div class="nav-item active" @click="activeTab = 'recommend'">
        <span>🎸</span><span>推荐</span>
      </div>
      <div class="nav-item" @click="activeTab = 'itinerary'">
        <span>📅</span><span>行程</span>
        <span v-if="store.itinerary.length > 0" class="nav-badge">{{ store.itinerary.length }}</span>
      </div>
      <div class="nav-item" @click="router.push('/guide')">
        <span>🗺️</span><span>攻略</span>
      </div>
      <div class="nav-item" @click="router.push('/memory')">
        <span>📸</span><span>回忆</span>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <transition name="modal">
      <div v-if="detailShow" class="modal-overlay" @click.self="detailShow = null">
        <div class="modal-box">
          <div class="modal-poster">
            <span>🎶 {{ detailShow.artist }}</span>
          </div>
          <div class="modal-info">
            <div class="modal-artist">{{ detailShow.artist }}</div>
            <div class="modal-tour">{{ detailShow.tourName }}</div>
            <div class="modal-meta">
              <div>📍 {{ detailShow.city }} · {{ detailShow.venue }}</div>
              <div>📅 演出日期：{{ detailShow.date }}</div>
              <div>🎫 开票：{{ detailShow.ticketDate }}</div>
              <div>🎤 代表作：{{ detailShow.representative }}</div>
              <div class="modal-diff" :class="getDiffClass(detailShow.difficulty)">{{ detailShow.difficulty }}</div>
            </div>
            <div class="modal-ai-reason">
              <span class="ai-tag">AI 推荐</span>
              {{ store.getAIReason(detailShow) }}
            </div>
          </div>
          <div class="modal-actions">
            <button class="action-btn" @click="handleRemind(detailShow); detailShow = null">
              {{ isInItinerary(detailShow.id) ? '✓ 已在行程' : '🔔 加入行程' }}
            </button>
            <button class="action-btn secondary" @click="detailShow = null">关闭</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/index.js'

const router = useRouter()
const store = useUserStore()
const showToast = inject('showToast')

const tabs = [
  { key: 'recommend', icon: '🎸', label: '推荐' },
  { key: 'itinerary', icon: '📅', label: '行程' }
]

const activeTab = ref('recommend')
const searchQuery = ref('')
const searchResults = ref(null)
const detailShow = ref(null)

const recommendations = computed(() => store.recommendations)

const displayShows = computed(() => {
  return searchResults.value !== null ? searchResults.value : recommendations.value
})

const sortedItinerary = computed(() => {
  return [...store.itinerary].sort((a, b) => new Date(a.date) - new Date(b.date))
})

function isInItinerary(showId) {
  return store.itinerary.some(i => i.showId === showId)
}

function handleRemind(show) {
  if (isInItinerary(show.id)) {
    showToast('已在行程中')
    return
  }
  const ok = store.addToItinerary(show)
  if (ok) showToast(`✓ 已加入行程：${show.artist}`)
}

function removeItinerary(showId) {
  store.removeFromItinerary(showId)
  showToast('已从行程移除')
}

function openDetail(show) {
  detailShow.value = show
}

function goToGuide(show) {
  // 先加入行程，再跳转攻略
  store.addToItinerary(show)
  router.push({ path: '/guide', query: { showId: show.id } })
}

function goToGuideById(item) {
  router.push({ path: '/guide', query: { showId: item.showId } })
}

function handleSearch() {
  const q = searchQuery.value.trim()
  if (!q) { searchResults.value = null; return }
  const lower = q.toLowerCase()
  const results = store.recommendations.filter(s =>
    s.artist.includes(q) ||
    s.tourName.includes(q) ||
    s.city.includes(q) ||
    s.style.includes(q) ||
    lower.includes(s.city) ||
    lower.includes(s.style)
  )
  searchResults.value = results.length > 0 ? results : []
}

function clearSearch() {
  searchQuery.value = ''
  searchResults.value = null
}

function getDiffClass(difficulty) {
  if (difficulty.includes('极')) return 'diff-extreme'
  if (difficulty.includes('高')) return 'diff-high'
  return 'diff-normal'
}

function getTicketClass(ticketDate) {
  const diff = Math.ceil((new Date(ticketDate) - new Date()) / (1000 * 3600 * 24))
  if (diff <= 3 && diff >= 0) return 'urgent'
  return ''
}
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-app);
}

/* Tab 导航 */
.tab-bar {
  display: flex;
  background: #0c0f17;
  border-bottom: 1px solid #1a1e2a;
  flex-shrink: 0;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.65rem 0;
  font-size: 0.72rem;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.15s;
  gap: 0.15rem;
  border-bottom: 2px solid transparent;
}

.tab-item.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.tab-icon {
  font-size: 1rem;
}

/* 内容区 */
.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1rem 80px;
}

/* 问候 */
.greeting {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.greeting-text {
  display: flex;
  flex-direction: column;
}

.hi {
  font-size: 1.2rem;
  font-weight: 700;
}

.desc {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.1rem;
}

.profile-btn {
  background: var(--bg-item);
  border: 1px solid #2a2f3a;
  border-radius: 20px;
  padding: 0.3rem 0.8rem;
  font-size: 0.72rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.profile-btn:active {
  border-color: var(--primary);
  color: var(--primary);
}

/* 搜索栏 */
.search-bar {
  display: flex;
  align-items: center;
  background: var(--bg-item);
  border-radius: 32px;
  padding: 0.55rem 0.8rem 0.55rem 1rem;
  gap: 0.5rem;
  margin-bottom: 1.2rem;
  border: 1px solid #252b36;
}

.search-icon {
  font-size: 0.85rem;
  flex-shrink: 0;
}

.search-bar input {
  background: transparent;
  border: none;
  flex: 1;
  color: var(--text-primary);
  font-size: 0.82rem;
  outline: none;
}

.search-bar input::placeholder {
  color: #55607a;
}

.search-btn {
  background: var(--primary);
  border: none;
  border-radius: 20px;
  padding: 0.28rem 0.8rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #0f1117;
  cursor: pointer;
  flex-shrink: 0;
}

/* 演出卡片 */
.recommend-list {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.show-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 1rem;
  transition: border-color 0.15s;
}

.show-card:active {
  border-color: #3a4050;
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.card-artist {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--accent);
  letter-spacing: -0.2px;
}

.card-tour {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 0.1rem;
}

.difficulty-badge {
  font-size: 0.65rem;
  padding: 0.2rem 0.55rem;
  border-radius: 12px;
  flex-shrink: 0;
  margin-left: 0.5rem;
}

.diff-extreme {
  background: rgba(255, 60, 60, 0.15);
  color: #ff7070;
  border: 1px solid rgba(255, 60, 60, 0.3);
}

.diff-high {
  background: rgba(255, 179, 71, 0.15);
  color: var(--accent);
  border: 1px solid rgba(255, 179, 71, 0.3);
}

.diff-normal {
  background: rgba(100, 200, 120, 0.1);
  color: #80d890;
  border: 1px solid rgba(100, 200, 120, 0.25);
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 0.65rem;
}

.ai-reason {
  background: rgba(255, 107, 107, 0.06);
  border-left: 2px solid var(--primary);
  border-radius: 0 12px 12px 0;
  padding: 0.6rem 0.7rem;
  font-size: 0.75rem;
  line-height: 1.55;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.ai-tag {
  background: var(--primary);
  color: #0f1117;
  font-size: 0.6rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 6px;
  margin-right: 0.4rem;
  vertical-align: middle;
}

.representative {
  font-size: 0.72rem;
  color: rgba(255, 179, 71, 0.8);
  margin-bottom: 0.45rem;
}

.ticket-reminder {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-bottom: 0.7rem;
}

.urgent {
  color: #ff7070;
  font-weight: 600;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  background: var(--primary);
  border: none;
  border-radius: 20px;
  padding: 0.35rem 0.85rem;
  font-size: 0.73rem;
  font-weight: 600;
  color: #0f1117;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.action-btn:active {
  transform: scale(0.95);
}

.action-btn.secondary {
  background: var(--bg-item);
  color: var(--text-secondary);
  border: 1px solid #2a2f3a;
}

.action-btn.in-plan {
  background: #2a4a2a;
  color: #80d890;
  border: 1px solid rgba(100, 200, 120, 0.3);
}

.action-btn.remove {
  background: rgba(255, 60, 60, 0.1);
  color: #ff7070;
  border: 1px solid rgba(255, 60, 60, 0.2);
}

.action-btn.small {
  padding: 0.28rem 0.65rem;
  font-size: 0.68rem;
}

/* 行程时间轴 */
.section-header {
  margin-bottom: 1rem;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 700;
}

.section-sub {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-top: 0.2rem;
}

.timeline {
  position: relative;
  padding-left: 0.5rem;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 12px;
  bottom: 12px;
  width: 2px;
  background: linear-gradient(to bottom, rgba(255,107,107,0.5), rgba(255,107,107,0.1));
  border-radius: 2px;
}

.timeline-item {
  position: relative;
  padding-left: 1.8rem;
  margin-bottom: 1rem;
}

.timeline-dot {
  position: absolute;
  left: 3px;
  top: 8px;
  width: 10px;
  height: 10px;
  background: var(--primary);
  border-radius: 50%;
  box-shadow: 0 0 6px rgba(255, 107, 107, 0.5);
}

.timeline-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 0.85rem;
}

.tl-reminder {
  font-size: 0.7rem;
  color: var(--accent);
  margin-bottom: 0.3rem;
}

.tl-artist {
  font-size: 1rem;
  font-weight: 700;
  color: var(--accent);
}

.tl-tour {
  font-size: 0.85rem;
  color: var(--text-primary);
  margin-top: 0.1rem;
}

.tl-meta {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin: 0.4rem 0 0.6rem;
}

.tl-actions {
  display: flex;
  gap: 0.5rem;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 0.8rem;
}

.empty-sub {
  font-size: 0.75rem;
  margin-top: 0.3rem;
  color: var(--text-muted);
}

/* 底部导航 */
.bottom-nav {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: rgba(12, 15, 23, 0.95);
  backdrop-filter: blur(12px);
  border-top: 1px solid #1a1e2a;
  z-index: 20;
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

.nav-item:first-child {
  color: var(--primary);
}

.nav-item span:first-child {
  font-size: 1rem;
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

/* 详情弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-box {
  background: #181b26;
  border-radius: 28px 28px 20px 20px;
  width: 100%;
  max-width: 380px;
  overflow: hidden;
}

.modal-poster {
  width: 100%;
  height: 130px;
  background: linear-gradient(135deg, #1e2236, #2a1e3a);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  color: var(--accent);
  font-weight: 600;
}

.modal-info {
  padding: 1rem;
}

.modal-artist {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--accent);
  margin-bottom: 0.2rem;
}

.modal-tour {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.8rem;
}

.modal-meta {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 0.8rem;
}

.modal-diff {
  display: inline-block;
  font-size: 0.7rem;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  margin-top: 0.2rem;
}

.modal-ai-reason {
  background: rgba(255, 107, 107, 0.06);
  border-left: 2px solid var(--primary);
  padding: 0.6rem 0.7rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  border-radius: 0 10px 10px 0;
  line-height: 1.5;
}

.modal-actions {
  padding: 0.8rem 1rem 1.2rem;
  display: flex;
  gap: 0.7rem;
}

.modal-actions .action-btn {
  flex: 1;
  padding: 0.6rem 0.5rem;
  font-size: 0.8rem;
  border-radius: 16px;
}

/* 弹窗动画 */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}
.modal-enter-from .modal-box,
.modal-leave-to .modal-box {
  transform: translateY(100%);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
