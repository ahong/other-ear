<template>
  <div class="itinerary">
    <div class="page-content page-scroll">
      <div class="section-header">
        <div class="section-title">📅 我的行程</div>
        <div class="section-sub">点击「加入行程」从推荐添加</div>
      </div>

      <div v-if="store.itinerary.length === 0" class="empty-state">
        <div class="empty-icon">📅</div>
        <p>暂无行程</p>
        <p class="empty-sub">去推荐页点击「加入行程」</p>
        <button class="action-btn" style="width:auto;padding:0.5rem 1.5rem;margin-top:0.8rem" @click="router.push('/recommend')">去看演出推荐</button>
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
              ⏰ · <span v-if="formatMMDD(item.date)">{{ formatMMDD(item.date) }}</span> {{ store.getReminderText(item.ticketDate) }}
            </div>
            <div class="tl-artist">{{ item.artist }}</div>
            <div class="tl-tour">{{ item.tourName }}</div>
            <div class="tl-meta">{{ item.city }} · {{ item.venue }} · {{ item.date }}</div>
            <div class="tl-actions">
              <button class="action-btn secondary small" @click="goToGuide(item)">🗺️ 攻略</button>
              <button class="action-btn remove small" @click="removeItinerary(item.showId)">移除</button>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/index.js'

const router = useRouter()
const store = useUserStore()
const showToast = inject('showToast')

function parseDate(dateStr) {
  if (!dateStr) return Infinity
  return new Date(dateStr.replace(/\//g, '-')).getTime() || Infinity
}

function formatMMDD(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr.replace(/\//g, '-'))
  if (isNaN(d.getTime())) return ''
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}/${dd}`
}

const sortedItinerary = computed(() => {
  return [...store.itinerary].sort((a, b) => parseDate(a.date) - parseDate(b.date))
})

function removeItinerary(showId) {
  store.removeFromItinerary(showId)
  showToast('已从行程移除')
}

function goToGuide(item) {
  router.push({ path: '/guide', query: { showId: item.showId } })
}
</script>

<style scoped>
.itinerary {
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
  font-size: 1rem;
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

.action-btn.remove {
  background: rgba(255, 60, 60, 0.1);
  color: #ff7070;
  border: 1px solid rgba(255, 60, 60, 0.2);
}

.action-btn.small {
  padding: 0.28rem 0.65rem;
  font-size: 0.68rem;
}

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
</style>
