<template>
  <div class="recommend">
    <!-- 内容区 -->
    <div class="page-content page-scroll">
      <!-- 问候语 -->
      <div class="greeting">
        <div class="greeting-text">
          <span class="hi">嗨 👋</span>
          <span class="desc">为你找到了 {{ baseList.length }} 场演出</span>
        </div>
        <button class="profile-btn" @click="router.push('/questionnaire')">调整偏好</button>
      </div>

      <!-- 搜索栏 -->
      <div class="search-bar" :class="{ 'search-loading': searching }">
        <span class="search-icon">{{ searching ? '⏳' : '🔍' }}</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="试试：下个月厦门摇滚演出"
          :disabled="searching"
          @keyup.enter="handleSearch"
        />
        <button class="search-btn" :disabled="searching" @click="handleSearch">
          {{ searching ? 'AI 解析中' : '搜索' }}
        </button>
      </div>

      <!-- 推荐卡片列表 -->
      <div class="recommend-list">
        <div
          v-for="show in displayShows"
          :key="show.event_id"
          class="show-card"
        >
          <!-- 封面图 -->
          <div v-if="show.cover_image" class="card-cover">
            <img :src="show.cover_image" :alt="show.artist" loading="lazy" />
          </div>

          <div class="card-body">
            <div class="card-top">
              <div class="card-title-group">
                <div class="card-artist">{{ show.artist }}</div>
                <div class="card-tour">{{ show.title }}</div>
              </div>
              <div v-if="show.styles?.length" class="style-badges">
                <span v-for="s in show.styles.slice(0,2)" :key="s" class="style-badge">{{ s }}</span>
              </div>
            </div>

            <div class="card-meta">
              <span>📍 {{ show.city }} · {{ show.venue }}</span>
              <span>📅 {{ show.time }}</span>
              <span v-if="show.price" class="price-tag">{{ show.price }}</span>
            </div>

            <div class="ai-reason">
              <span class="ai-tag">AI</span>
              {{ getAIReason(show) }}
            </div>

            <div class="card-actions">
              <button
                class="action-btn"
                :class="{ 'in-plan': isInItinerary(show.event_id) }"
                @click="handleRemind(show)"
              >
                {{ isInItinerary(show.event_id) ? '✓ 已添加' : '🔔 加入行程' }}
              </button>
              <button class="action-btn secondary" @click="openDetail(show)">📋 详情</button>
              <a v-if="show.event_url" :href="show.event_url" target="_blank" class="action-btn secondary">🎫 购票</a>
            </div>
          </div>
        </div>

        <!-- 加载更多提示 -->
        <div v-if="!isAllLoaded" class="load-more">
          <span v-if="loadingMore" class="loading-dots">加载中<span class="dots">...</span></span>
          <span v-else class="load-hint">↓ 继续滚动加载更多</span>
        </div>
        <div v-else-if="displayShows.length > 0" class="load-end">
          ✓ 已显示全部 {{ baseList.length }} 场演出
        </div>

        <div v-if="displayShows.length === 0" class="empty-state">
          <div class="empty-icon">🎵</div>
          <p>{{ searchResults !== null ? '暂无匹配演出' : '没有找到相关演出' }}</p>
          <button class="btn-ghost" style="width:auto;padding:0.5rem 1.2rem;font-size:0.8rem" @click="clearSearch">清除搜索</button>
        </div>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <transition name="modal">
      <div v-if="detailShow" class="modal-overlay" @click.self="detailShow = null">
        <div class="modal-box">
          <div class="modal-poster">
            <img v-if="detailShow.cover_image" :src="detailShow.cover_image" :alt="detailShow.artist" />
            <span v-else>🎶 {{ detailShow.artist }}</span>
          </div>
          <div class="modal-info">
            <div class="modal-artist">{{ detailShow.artist }}</div>
            <div class="modal-tour">{{ detailShow.title }}</div>
            <div class="modal-meta">
              <div>📍 {{ detailShow.city }} · {{ detailShow.venue }}</div>
              <div>📅 {{ detailShow.time }}</div>
              <div v-if="detailShow.price">🎫 {{ detailShow.price }}</div>
              <div v-if="detailShow.styles?.length">🎵 {{ detailShow.styles.join(' / ') }}</div>
            </div>
            <div class="modal-ai-reason">
              <span class="ai-tag">AI 推荐</span>
              {{ getAIReason(detailShow) }}
            </div>
          </div>
          <div class="modal-actions">
            <button class="action-btn" @click="handleRemind(detailShow); detailShow = null">
              {{ isInItinerary(detailShow.event_id) ? '✓ 已在行程' : '🔔 加入行程' }}
            </button>
            <a v-if="detailShow.event_url" :href="detailShow.event_url" target="_blank" class="action-btn secondary">🎫 秀动购票</a>
            <button class="action-btn secondary" @click="detailShow = null">关闭</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, inject, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/index.js'
import { getRecommendationReason } from '../utils/deepseek.js'
import { parseUserSearchText } from '../utils/aiSearchParser.js'
import { allShows } from '../assets/data/index.js'

const router = useRouter()
const store = useUserStore()
const showToast = inject('showToast')

const searchQuery = ref('')
const searchResults = ref(null)
const detailShow = ref(null)
const searching = ref(false)   // AI 解析中

// ============ 分页加载 ============
const PAGE_SIZE = 10
const page = ref(1)
const loadingMore = ref(false)

const recommendations = computed(() => store.recommendations)

// 当前展示的全量列表（搜索时用搜索结果，否则用推荐结果）
const baseList = computed(() =>
  searchResults.value !== null ? searchResults.value : recommendations.value
)

// 实际展示的分页切片
const displayShows = computed(() => baseList.value.slice(0, page.value * PAGE_SIZE))

// 是否已全部加载
const isAllLoaded = computed(() => displayShows.value.length >= baseList.value.length)

// 滚动加载更多
function loadMore() {
  if (loadingMore.value || isAllLoaded.value) return
  loadingMore.value = true
  setTimeout(() => {
    page.value++
    loadingMore.value = false
  }, 400)
}

// 监听滚动容器（.page-content）触底
let scrollEl = null
function onScroll() {
  if (!scrollEl) return
  const { scrollTop, clientHeight, scrollHeight } = scrollEl
  if (scrollHeight - scrollTop - clientHeight < 80) {
    loadMore()
  }
}

onMounted(() => {
  scrollEl = document.querySelector('.recommend .page-content')
  scrollEl?.addEventListener('scroll', onScroll, { passive: true })
})

onUnmounted(() => {
  scrollEl?.removeEventListener('scroll', onScroll)
})

// 切换搜索/推荐时重置分页
function resetPage() { page.value = 1 }

function isInItinerary(showId) {
  return store.itinerary.some(i => i.showId === showId)
}

function handleRemind(show) {
  if (isInItinerary(show.event_id)) {
    showToast('已在行程中')
    return
  }
  const ok = store.addToItinerary(show)
  if (ok) showToast(`✓ 已加入行程：${show.artist}`)
}

function openDetail(show) {
  detailShow.value = show
}

async function handleSearch() {
  const q = searchQuery.value.trim()
  if (!q) { searchResults.value = null; resetPage(); return }

  searching.value = true
  try {
    // 第一步：AI 解析自然语言
    const filter = await parseUserSearchText(q)
    const hasFilter = filter.city || filter.style || filter.artist || filter.startTime || filter.endTime

    if (hasFilter) {
      // 第二步：按结构化条件筛选全量演出数据（allShows，不受偏好排序影响）
      const results = allShows.filter(s => {
        // city：精确匹配（city 字段由 index.js 注入）
        if (filter.city && s.city !== filter.city) return false

        // style：styles 数组中任意一项与 filter.style 互相包含
        if (filter.style) {
          const matched = (s.styles || []).some(
            st => st.includes(filter.style) || filter.style.includes(st)
          )
          if (!matched) return false
        }

        // artist：按 / 拆分后模糊匹配
        if (filter.artist) {
          const showArtists = (s.artist || '').split('/').map(n => n.trim())
          const matched = showArtists.some(
            n => n.includes(filter.artist) || filter.artist.includes(n)
          )
          if (!matched) return false
        }

        // time：show.time 格式为 "2026/03/27 20:00"，统一转为 "YYYY-MM-DD" 再比较
        if (filter.startTime || filter.endTime) {
          if (!s.time) return false
          // 取日期部分（前10字符），将 / 替换为 -
          const showDate = s.time.slice(0, 10).replace(/\//g, '-')
          if (filter.startTime && showDate < filter.startTime) return false
          if (filter.endTime   && showDate > filter.endTime)   return false
        }

        return true
      })
      searchResults.value = results
    } else {
      // AI 未解析出有效条件，降级到关键字搜索
      const lower = q.toLowerCase()
      const results = allShows.filter(s =>
        s.artist?.includes(q) ||
        s.title?.includes(q) ||
        s.city?.includes(q) ||
        (s.styles || []).some(st => st.includes(q)) ||
        lower.includes(s.city) ||
        (s.styles || []).some(st => lower.includes(st))
      )
      searchResults.value = results
    }
  } catch {
    // 兜底：关键字搜索
    const q2 = searchQuery.value.trim()
    searchResults.value = allShows.filter(s =>
      s.artist?.includes(q2) || s.title?.includes(q2) || s.city?.includes(q2)
    )
  } finally {
    searching.value = false
    resetPage()
  }
}

function clearSearch() {
  searchQuery.value = ''
  searchResults.value = null
  resetPage()
}

// ============ AI 推荐理由 ============
// reasonMap: event_id → { status: 'loading'|'done'|'error', text: string }
const reasonMap = ref({})

// 获取某场演出的展示文案
function getAIReason(show) {
  const entry = reasonMap.value[show.event_id]
  if (!entry || entry.status === 'loading') return 'AI 正在为你推荐…'
  if (entry.status === 'error') return store.getAIReason(show)
  return entry.text || store.getAIReason(show)
}

// 对一批演出异步拉取推荐理由（已有缓存的跳过）
async function fetchReasons(shows) {
  const prefs = store.profile
  const userPrefs = {
    cities: prefs.cities,
    genres: prefs.genres,
    artists: prefs.artists,
  }

  for (const show of shows) {
    const id = show.event_id
    if (reasonMap.value[id]) continue   // 已有缓存，跳过

    // 设置加载中占位
    reasonMap.value = { ...reasonMap.value, [id]: { status: 'loading', text: '' } }

    // 异步请求（不阻塞其他卡片）
    getRecommendationReason(userPrefs, show).then(text => {
      reasonMap.value = {
        ...reasonMap.value,
        [id]: text
          ? { status: 'done', text }
          : { status: 'error', text: '' }
      }
    })
  }
}

// 每次 displayShows 变化时，对新增卡片触发 AI 理由请求
watch(displayShows, (shows) => {
  fetchReasons(shows)
}, { immediate: true })
</script>

<style scoped>
.recommend {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-app);
}

.page-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1rem 1.5rem;
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

.search-bar.search-loading {
  opacity: 0.7;
  pointer-events: none;
}

.search-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
  overflow: hidden;
  transition: border-color 0.15s;
}

.show-card:active {
  border-color: #3a4050;
}

/* 封面图 */
.card-cover {
  width: 100%;
  height: 160px;
  overflow: hidden;
  background: #1a1e2a;
}

.card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.card-body {
  padding: 0.85rem 1rem 1rem;
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
  gap: 0.5rem;
}

.card-title-group {
  flex: 1;
  min-width: 0;
}

.card-artist {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--accent);
  letter-spacing: -0.2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-tour {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-top: 0.15rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 风格标签 */
.style-badges {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex-shrink: 0;
}

.style-badge {
  font-size: 0.62rem;
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
  background: rgba(255, 179, 71, 0.12);
  color: var(--accent);
  border: 1px solid rgba(255, 179, 71, 0.25);
  white-space: nowrap;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.73rem;
  color: var(--text-secondary);
  margin-bottom: 0.65rem;
}

.price-tag {
  color: #80d890;
  font-weight: 500;
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

.card-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
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
  text-decoration: none;
  display: inline-flex;
  align-items: center;
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

/* 加载更多 */
.load-more {
  text-align: center;
  padding: 1.2rem 0 0.5rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.load-end {
  text-align: center;
  padding: 1rem 0 0.5rem;
  font-size: 0.72rem;
  color: var(--text-muted);
  opacity: 0.6;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.loading-dots .dots {
  animation: blink 1s infinite;
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
  height: 180px;
  background: linear-gradient(135deg, #1e2236, #2a1e3a);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  color: var(--accent);
  font-weight: 600;
  overflow: hidden;
}

.modal-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
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
