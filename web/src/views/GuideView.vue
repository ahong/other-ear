<template>
  <div class="guide page-scroll">
    <!-- 页头 -->
    <div class="guide-header">
      <div class="header-title">🗺️ 行程攻略</div>
    </div>

    <!-- 空状态 -->
    <div v-if="itinerary.length === 0" class="empty-state">
      <div class="empty-icon">🗺️</div>
      <p>还没有行程</p>
      <p class="empty-sub">在推荐页加入行程后，这里会生成专属攻略</p>
      <button class="action-btn" @click="router.push('/recommend')">去看演出推荐</button>
    </div>

    <!-- 攻略列表 -->
    <div v-else class="guide-list">
      <div
        v-for="(item, index) in itinerary"
        :key="item.showId"
        class="guide-card"
        :class="{ expanded: expandedId === item.showId }"
      >
        <!-- 卡头（点击展开/收起） -->
        <div class="guide-card-header" @click="toggleExpand(item.showId)">
          <div class="guide-card-left">
            <div class="guide-artist">{{ item.artist }}</div>
            <div class="guide-tour">{{ item.tourName }}</div>
            <div class="guide-meta">{{ item.city }} · {{ item.venue }} · {{ item.date }}</div>
          </div>
          <div class="expand-icon" :class="{ rotated: expandedId === item.showId }">▼</div>
        </div>

        <!-- 攻略时间轴（展开内容） -->
        <transition name="expand">
          <div v-if="expandedId === item.showId" class="guide-body">
            <!-- AI 提示 / 加载状态 -->
            <div class="ai-tip">
              <template v-if="loadingIds.has(item.showId)">
                ⏳ AI 正在生成攻略…
              </template>
              <template v-else>
                🤖 AI 已为你生成 {{ item.city }} 观演攻略，包含交通/住宿/美食推荐
              </template>
            </div>

            <div v-if="!loadingIds.has(item.showId)" class="guide-timeline">
              <div class="timeline-line"></div>
              <div
                v-for="(step, si) in getGuideItems(item)"
                :key="si"
                class="guide-step"
              >
                <div class="step-dot" :class="`dot-${si % 4}`"></div>
                <div class="step-card">
                  <div class="step-header">
                    <span class="step-title" :class="`title-${si % 4}`">{{ step.title }}</span>
                    <span class="step-time">⏰ {{ step.time }}</span>
                  </div>
                  <div class="step-place">📍 {{ step.place }}</div>
                  <div class="step-content">{{ step.content }}</div>
                </div>
              </div>
            </div>

            <!-- 开票提醒 -->
            <!-- <div class="ticket-box">
              <div class="ticket-label">🎫 开票信息</div>
              <div class="ticket-info">
                {{ item.ticketDate }}
                <span class="ticket-status" :class="getTicketClass(item.ticketDate)">
                  · {{ store.getReminderText(item.ticketDate) }}
                </span>
              </div>
            </div> -->

            <!-- 快速操作 -->
            <div class="guide-actions">
              <button class="action-btn" @click="copyGuide(item)">📋 复制攻略</button>
              <button class="action-btn secondary" @click="removeAndClose(item.showId)">移出行程</button>
            </div>
          </div>
        </transition>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '../stores/index.js'
import { generateShowGuide } from '../utils/deepseek.js'
import { allShows } from '../assets/data/index.js'

const router = useRouter()
const route = useRoute()
const store = useUserStore()
const showToast = inject('showToast')

const itinerary = computed(() => {
  return [...store.itinerary].sort((a, b) => {
    const ta = a.date ? (new Date(a.date.replace(/\//g, '-')).getTime() || Infinity) : Infinity
    const tb = b.date ? (new Date(b.date.replace(/\//g, '-')).getTime() || Infinity) : Infinity
    return ta - tb
  })
})
const expandedId = ref(null)

// showId -> AI 生成的 timeline 数组（address 映射为 place）
const guideCache = ref(new Map())
// 正在加载中的 showId 集合
const loadingIds = ref(new Set())

onMounted(() => {
  const targetId = route.query.showId ? parseInt(route.query.showId) : null
  if (targetId && itinerary.value.some(i => i.showId === targetId)) {
    expandedId.value = targetId
    fetchGuide(itinerary.value.find(i => i.showId === targetId))
  } else if (itinerary.value.length > 0) {
    expandedId.value = itinerary.value[0].showId
    fetchGuide(itinerary.value[0])
  }
})

async function fetchGuide(item) {
  const id = item.showId
  if (guideCache.value.has(id) || loadingIds.value.has(id)) return
  loadingIds.value = new Set([...loadingIds.value, id])

  // item.address 可能因旧存量数据缺失，从原始数据源补全
  const rawShow = allShows.find(s => s.event_id === id)
  const address = item.address || rawShow?.address || ''

  const timeline = await generateShowGuide({
    title: item.tourName,
    artist: item.artist,
    city: item.city,
    venue: item.venue,
    address,
    time: item.date,
  })
  // 将 address 字段映射为模板使用的 place 字段
  const mapped = timeline.map(s => ({ ...s, place: s.address || s.place || '' }))
  const next = new Map(guideCache.value)
  next.set(id, mapped.length > 0 ? mapped : null)
  guideCache.value = next
  const nextLoading = new Set(loadingIds.value)
  nextLoading.delete(id)
  loadingIds.value = nextLoading
}

function toggleExpand(id) {
  if (expandedId.value === id) {
    expandedId.value = null
  } else {
    expandedId.value = id
    const item = itinerary.value.find(i => i.showId === id)
    if (item) fetchGuide(item)
  }
}

function getGuideItems(item) {
  const id = item.showId
  // AI 已返回数据
  if (guideCache.value.has(id) && guideCache.value.get(id)) {
    return guideCache.value.get(id)
  }
  // 兜底生成
  return [
    { time: '14:00', place: `${item.city}高铁/机场`, title: '抵达', content: `乘坐交通工具前往${item.city}` },
    { time: '17:00', place: `${item.venue}附近`, title: '住宿', content: '提前预订周边酒店/青旅' },
    { time: '18:30', place: `${item.city}特色餐厅`, title: '美食', content: '探索当地特色美食' },
    { time: '20:00', place: item.venue, title: '演出', content: `${item.artist} · ${item.tourName}` }
  ]
}

function getTicketClass(ticketDate) {
  const diff = Math.ceil((new Date(ticketDate) - new Date()) / (1000 * 3600 * 24))
  if (diff <= 3 && diff >= 0) return 'urgent'
  if (diff < 0) return 'past'
  return ''
}

function copyGuide(item) {
  const steps = getGuideItems(item)
  const text = `🗺️ ${item.artist} - ${item.tourName}\n📍 ${item.city} · ${item.venue}\n📅 ${item.date}\n\n` +
    steps.map(s => `⏰ ${s.time} | ${s.title}\n📍 ${s.place}\n${s.content}`).join('\n\n')

  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('攻略已复制到剪贴板'))
  } else {
    showToast('复制成功（演示）')
  }
}

function removeAndClose(showId) {
  store.removeFromItinerary(showId)
  if (expandedId.value === showId) expandedId.value = null
  showToast('已移出行程')
}
</script>

<style scoped>
.guide {
  background: var(--bg-app);
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 1.5rem;
}

/* 页头 */
.guide-header {
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

/* 列表 */
.guide-list {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

/* 攻略卡片 */
.guide-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 20px;
  overflow: hidden;
  transition: border-color 0.2s;
}

.guide-card.expanded {
  border-color: rgba(255, 107, 107, 0.3);
}

.guide-card-header {
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.guide-card-header:active {
  background: rgba(255, 255, 255, 0.02);
}

.guide-artist {
  font-size: 1rem;
  font-weight: 800;
  color: var(--accent);
}

.guide-tour {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 0.15rem;
}

.guide-meta {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 0.3rem;
}

.expand-icon {
  color: var(--text-muted);
  font-size: 0.7rem;
  transition: transform 0.3s ease;
  flex-shrink: 0;
}

.expand-icon.rotated {
  transform: rotate(180deg);
}

/* 展开内容 */
.guide-body {
  padding: 0 1rem 1rem;
  border-top: 1px solid #1e2129;
}

.ai-tip {
  background: rgba(255, 107, 107, 0.06);
  border-left: 2px solid var(--primary);
  border-radius: 0 10px 10px 0;
  padding: 0.55rem 0.7rem;
  font-size: 0.73rem;
  color: var(--text-muted);
  margin: 0.8rem 0;
  line-height: 1.5;
}

/* 时间轴 */
.guide-timeline {
  position: relative;
  padding-left: 1.2rem;
  margin-bottom: 1rem;
}

.timeline-line {
  position: absolute;
  left: 4px;
  top: 10px;
  bottom: 10px;
  width: 2px;
  background: linear-gradient(to bottom, rgba(255,107,107,0.6), rgba(255,107,107,0.1));
  border-radius: 2px;
}

.guide-step {
  position: relative;
  padding-left: 1.2rem;
  margin-bottom: 0.8rem;
}

.guide-step:last-child {
  margin-bottom: 0;
}

.step-dot {
  position: absolute;
  left: -4px;
  top: 7px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot-0 { background: #FF6B6B; box-shadow: 0 0 5px rgba(255,107,107,0.4); }
.dot-1 { background: #FFB347; box-shadow: 0 0 5px rgba(255,179,71,0.4); }
.dot-2 { background: #7B9CFF; box-shadow: 0 0 5px rgba(123,156,255,0.4); }
.dot-3 { background: #80d890; box-shadow: 0 0 5px rgba(128,216,144,0.4); }

.step-card {
  background: var(--bg-item);
  border-radius: 12px;
  padding: 0.65rem 0.75rem;
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.3rem;
}

.step-title {
  font-size: 0.82rem;
  font-weight: 700;
}

.title-0 { color: #ff9090; }
.title-1 { color: var(--accent); }
.title-2 { color: #99b0ff; }
.title-3 { color: #80d890; }

.step-time {
  font-size: 0.68rem;
  color: var(--text-muted);
}

.step-place {
  font-size: 0.73rem;
  color: var(--text-secondary);
  margin-bottom: 0.2rem;
}

.step-content {
  font-size: 0.72rem;
  color: var(--text-muted);
}

/* 开票 */
.ticket-box {
  background: rgba(255, 179, 71, 0.06);
  border: 1px solid rgba(255, 179, 71, 0.15);
  border-radius: 12px;
  padding: 0.65rem 0.75rem;
  margin-bottom: 0.8rem;
}

.ticket-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 0.2rem;
}

.ticket-info {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.ticket-status {
  font-weight: 600;
}

.urgent { color: #ff7070; }
.past { color: var(--text-muted); }

/* 操作 */
.guide-actions {
  display: flex;
  gap: 0.6rem;
}

.action-btn {
  flex: 1;
  background: var(--primary);
  border: none;
  border-radius: 20px;
  padding: 0.45rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #0f1117;
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}

.action-btn.secondary {
  background: var(--bg-item);
  color: var(--text-secondary);
  border: 1px solid #2a2f3a;
}

.action-btn:active {
  transform: scale(0.95);
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-muted);
}

.empty-icon { font-size: 2.5rem; margin-bottom: 0.8rem; }
.empty-sub { font-size: 0.75rem; margin-top: 0.3rem; color: var(--text-muted); }
.action-btn.single {
  display: inline-block;
  margin-top: 1rem;
  padding: 0.5rem 1.5rem;
  width: auto;
  font-size: 0.8rem;
}

/* 展开动画 */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}
.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}
.expand-enter-to,
.expand-leave-from {
  max-height: 600px;
  opacity: 1;
}

</style>
