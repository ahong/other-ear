<template>
  <div class="agent-page">
    <!-- 顶部栏 -->
    <div class="agent-header">
      <button class="back-btn" @click="emit('close')">←</button>
      <div class="header-title">🤖 AI 助手</div>
      <div class="header-placeholder"></div>
    </div>

    <!-- 消息列表区域 -->
    <div class="messages-area page-scroll" ref="messagesEl">
      <!-- 欢迎占位（无消息时显示） -->
      <div v-if="messages.length === 0" class="welcome-block">
        <div class="welcome-icon">🎧</div>
        <div class="welcome-title">你好，我是 AI 助手</div>
        <div class="welcome-desc">告诉我你想看什么风格、哪个城市、哪位艺人的演出，我来帮你找</div>
        <div class="welcome-hints">
          <div class="hint-item" @click="fillHint('下个月厦门摇滚演出')">下个月厦门摇滚演出</div>
          <div class="hint-item" @click="fillHint('痛仰乐队')">痛仰乐队</div>
          <div class="hint-item" @click="fillHint('北京民谣')">北京民谣</div>
        </div>
      </div>

      <!-- 消息列表 -->
      <div v-for="(msg, idx) in messages" :key="idx" class="msg-row" :class="msg.role">
        <!-- 用户消息 -->
        <div v-if="msg.role === 'user'" class="bubble user-bubble">{{ msg.text }}</div>

        <!-- AI 消息 -->
        <div v-else class="ai-msg">
          <!-- 思考中 -->
          <div v-if="msg.status === 'thinking'" class="bubble ai-bubble thinking">
            <span class="dot-loader"><span></span><span></span><span></span></span>
          </div>

          <!-- 文字回复（无结果 / 错误） -->
          <div v-else-if="msg.status === 'text'" class="bubble ai-bubble">{{ msg.text }}</div>

          <!-- 搜索结果为空（带追问胶囊） -->
          <div v-else-if="msg.status === 'results-empty'">
            <div class="bubble ai-bubble">{{ msg.text }}</div>
            <div v-if="msg.followUps && msg.followUps.length" class="followup-bar">
              <div
                v-for="(q, qi) in msg.followUps"
                :key="qi"
                class="followup-chip"
                @click="sendFollowUp(q, msg.lastFilter)"
              >{{ q }}</div>
            </div>
            <div v-else-if="msg.followUpsLoading" class="followup-bar followup-loading">
              <div class="followup-chip followup-chip-ghost"></div>
              <div class="followup-chip followup-chip-ghost"></div>
              <div class="followup-chip followup-chip-ghost"></div>
            </div>
          </div>

          <!-- 票根扫描中 -->
          <div v-else-if="msg.status === 'ticket-scanning'" class="bubble ai-bubble thinking">
            <span class="dot-loader"><span></span><span></span><span></span></span>
            <span class="scanning-text">{{ msg.scanStep === 'ai' ? 'AI 正在提取演出信息…' : 'OCR 正在识别票根文字…' }}</span>
          </div>

          <!-- 票根识别失败 -->
          <div v-else-if="msg.status === 'ticket-error'" class="bubble ai-bubble ticket-error-bubble">
            <span class="ticket-error-icon">⚠️</span> {{ msg.text }}
          </div>

          <!-- 票根识别成功 -->
          <div v-else-if="msg.status === 'ticket-done'">
            <div class="bubble ai-bubble result-header">
              {{ msg.addedCount > 0
                ? `已添加 ${msg.addedCount} 场演出到「我的演出回忆」`
                : '演出记录已存在，无需重复添加' }}
            </div>
            <div class="ticket-results">
              <div
                v-for="(item, i) in msg.results"
                :key="i"
                class="ticket-card"
                :class="{ 'ticket-card-dup': !item.isNew }"
              >
                <div class="ticket-card-top">
                  <div class="ticket-artist">{{ item.artist }}</div>
                  <span class="ticket-badge" :class="item.isNew ? 'badge-new' : 'badge-dup'">
                    {{ item.isNew ? '已添加' : '已存在' }}
                  </span>
                </div>
                <div v-if="item.tourName" class="ticket-tour">{{ item.tourName }}</div>
                <div class="ticket-meta">
                  <span v-if="item.date">📅 {{ item.date }}</span>
                  <span v-if="item.city">📍 {{ item.city }}<span v-if="item.venue"> · {{ item.venue }}</span></span>
                  <span v-if="item.price > 0" class="ticket-price">¥{{ item.price }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="msg.status === 'results'">
            <div class="bubble ai-bubble result-header">{{ msg.text }}</div>

            <!-- 轮播容器 -->
            <div class="carousel-outer">
              <div
                class="carousel-wrap"
                @touchstart="onTouchStart($event, msg)"
                @touchend="onTouchEnd($event, msg)"
              >
                <!--
                  key 使用固定槽位下标（非 event_id），确保 Vue 始终复用已有 DOM
                  不因数据变化销毁/重建节点，transition 动画全程生效
                  track 的 translateX 基于 activeIndex，中间卡片始终居中
                -->
                <div
                  class="carousel-track"
                  :style="{ transform: `translateX(calc(10% - ${msg.activeIndex} * 80%))` }"
                >
                  <div
                    v-for="(show, slideIdx) in msg.visibleShows"
                    :key="slideIdx"
                    class="carousel-slide"
                    :class="{ 'slide-active': slideIdx === msg.activeIndex, 'slide-inactive': slideIdx !== msg.activeIndex }"
                  >
                    <div class="show-card">
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
                            <span v-for="s in show.styles.slice(0, 2)" :key="s" class="style-badge">{{ s }}</span>
                          </div>
                        </div>
                        <div class="card-meta">
                          <span>📍 {{ show.city }} · {{ show.venue }}</span>
                          <span>📅 {{ show.time }}</span>
                          <span v-if="show.price" class="price-tag">{{ show.price }}</span>
                        </div>
                        <div v-if="!isShowEnded(show)" class="ai-reason">
                          <span class="ai-tag">AI</span>
                          {{ getShowReason(show) }}
                        </div>
                        <div class="card-actions">
                          <button
                            v-if="isShowEnded(show)"
                            class="action-btn ended"
                            disabled
                          >已结束</button>
                          <button
                            v-else
                            class="action-btn"
                            :class="{ 'in-plan': isInItinerary(show.event_id) }"
                            @click="handleAddItinerary(show)"
                          >
                            {{ isInItinerary(show.event_id) ? '✓ 已添加' : '🔔 加入行程' }}
                          </button>
                          <a v-if="show.event_url" :href="show.event_url" target="_blank" class="action-btn secondary">🎫 购票</a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div><!-- /carousel-outer -->

            <!-- 追问建议胶囊 -->
            <div v-if="msg.followUps && msg.followUps.length" class="followup-bar">
              <div
                v-for="(q, qi) in msg.followUps"
                :key="qi"
                class="followup-chip"
                @click="sendFollowUp(q, msg.lastFilter)"
              >{{ q }}</div>
            </div>
            <!-- 追问加载中（生成过程） -->
            <div v-else-if="msg.followUpsLoading" class="followup-bar followup-loading">
              <div class="followup-chip followup-chip-ghost"></div>
              <div class="followup-chip followup-chip-ghost"></div>
              <div class="followup-chip followup-chip-ghost"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部输入栏 -->
    <div class="input-bar">
      <button class="img-btn" @click="openImagePicker">
        <span>📷</span>
      </button>
      <input
        ref="ticketFileInputRef"
        type="file"
        accept="image/*"
        style="display:none"
        @change="handleTicketFile"
      />
      <input
        class="chat-input"
        type="text"
        placeholder="输入消息…"
        v-model="inputText"
        :disabled="isSearching"
        @keyup.enter="sendMessage"
      />
      <button class="send-btn" @click="sendMessage" :disabled="isSearching">
        {{ isSearching ? '…' : '发送' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick, inject } from 'vue'
import { useUserStore } from '../stores/index.js'
import { parseUserSearchText } from '../utils/aiSearchParser.js'
import { getRecommendationReason, generateFollowUpQuestions, parseFollowUpQuery } from '../utils/deepseek.js'
import { allShows } from '../assets/data/index.js'
import { recognizeShowFromImage } from '../utils/showRecognizer.js'

const emit = defineEmits(['close'])
const store = useUserStore()
const showToast = inject('showToast')

const inputText = ref('')
const isSearching = ref(false)
const messages = ref([])
const messagesEl = ref(null)

// ── 繁简归一（与 RecommendView 完全一致）──
const TRAD_SIMP_MAP = {
  '醬': '酱', '樂': '乐', '學': '学', '國': '国', '來': '来', '愛': '爱',
  '藝': '艺', '無': '无', '聲': '声', '華': '华', '語': '语', '電': '电',
  '體': '体', '驗': '验', '藍': '蓝', '點': '点', '飛': '飞', '廣': '广',
}
function normStr(s) {
  if (!s) return ''
  return s.replace(/[醬樂學國來愛藝無聲華語電體驗藍點飛廣]/g, ch => TRAD_SIMP_MAP[ch] || ch).toLowerCase()
}

// ── 搜索算法（与 RecommendView 完全一致）──
function runSearch(filter, rawQuery) {
  const hasFilter = filter.city || filter.style || filter.artist || filter.startTime || filter.endTime

  if (hasFilter) {
    // AND 匹配：所有非空维度必须同时满足
    function matchesAll(s) {
      if (filter.city) {
        // city 可能是字符串或字符串数组（追问"附近城市"时返回数组）
        const cityList = Array.isArray(filter.city) ? filter.city : [filter.city]
        const sc = normStr(s.city)
        const sv = normStr(s.venue || '')
        const cityHit = cityList.some(c => {
          const fc = normStr(c)
          return sc.includes(fc) || sv.includes(fc)
        })
        if (!cityHit) return false
      }
      if (filter.style) {
        const fs = normStr(filter.style)
        const hit = (s.styles || []).some(st => normStr(st).includes(fs) || fs.includes(normStr(st)))
        if (!hit) return false
      }
      if (filter.artist) {
        const fa = normStr(filter.artist)
        const raw = normStr(s.artist || '')
        const wholeMatch = raw.includes(fa) || fa.includes(raw)
        const splitMatch = (s.artist || '').split(/[/×]/).map(n => normStr(n.trim())).some(
          n => n.includes(fa) || fa.includes(n)
        )
        if (!wholeMatch && !splitMatch) return false
      }
      if (filter.startTime || filter.endTime) {
        if (!s.time) return false
        const showDate = s.time.slice(0, 10).replace(/\//g, '-')
        if (filter.startTime && showDate < filter.startTime) return false
        if (filter.endTime   && showDate > filter.endTime)   return false
      }
      return true
    }

    // title 加分：仅用于已通过 AND 过滤后的排序（契合度高的排更前）
    function titleBonus(s) {
      if (!filter.artist && !filter.style) return 0
      const keywords = [filter.artist, filter.style].filter(Boolean).map(normStr)
      const titleN = normStr(s.title || '')
      return keywords.some(k => titleN.includes(k)) ? 1 : 0
    }

    function showTimestamp(s) {
      if (!s.time) return Infinity
      return new Date(s.time.replace(/\//g, '-')).getTime() || Infinity
    }

    return allShows
      .filter(matchesAll)
      .sort((a, b) => titleBonus(b) - titleBonus(a) || showTimestamp(a) - showTimestamp(b))
      .map(s => s)
  } else {
    const lower = rawQuery.toLowerCase()
    return allShows.filter(s =>
      s.artist?.includes(rawQuery) ||
      s.title?.includes(rawQuery) ||
      s.city?.includes(rawQuery) ||
      (s.styles || []).some(st => st.includes(rawQuery)) ||
      lower.includes(s.city) ||
      (s.styles || []).some(st => lower.includes(st))
    )
  }
}

// ── 推荐理由（全局响应式 map，key = event_id）──
// 使用 reactive 确保 Vue 能追踪深层变化，视图自动更新
const reasonMap = reactive({})

function getShowReason(show) {
  if (isShowEnded(show)) return ''
  const entry = reasonMap[show.event_id]
  if (!entry || entry.status === 'loading') return 'AI 正在为你推荐…'
  if (entry.status === 'error') return store.getAIReason(show)
  return entry.text || store.getAIReason(show)
}

// 按需触发单条推荐理由：切换到该卡片时调用
// - 已有结果（done/loading）直接跳过
// - localStorage 缓存由 getRecommendationReason 内部处理，命中缓存则同步返回
async function fetchReasonForShow(show) {
  if (!show) return
  if (isShowEnded(show)) return   // 已结束演出不调用 AI
  const id = show.event_id
  if (reasonMap[id]?.status === 'done' || reasonMap[id]?.status === 'loading') return

  reasonMap[id] = { status: 'loading', text: '' }

  const prefs = store.profile
  const userPrefs = { cities: prefs.cities, genres: prefs.genres, artists: prefs.artists }

  const text = await getRecommendationReason(userPrefs, show)
  reasonMap[id] = text ? { status: 'done', text } : { status: 'error', text: '' }
}

// ── 行程 ──
function isInItinerary(showId) {
  return store.itinerary.some(i => i.showId === showId)
}

// 判断演出是否已结束（演出日期 < 今天）
function isShowEnded(show) {
  if (!show?.time) return false
  const showDate = show.time.slice(0, 10).replace(/\//g, '-')
  const today = new Date().toISOString().slice(0, 10)
  return showDate < today
}

function handleAddItinerary(show) {
  if (isInItinerary(show.event_id)) {
    showToast?.('已在行程中')
    return
  }
  const ok = store.addToItinerary(show)
  if (ok) showToast?.(`✓ 已加入行程：${show.artist}`)
}

// ── 轮播 touch 手势 ──
let touchStartX = 0

function onTouchStart(e, _msg) {
  touchStartX = e.touches[0].clientX
}

function onTouchEnd(e, msg) {
  const dx = e.changedTouches[0].clientX - touchStartX
  if (Math.abs(dx) < 30) return
  if (dx < 0 && msg.activeIndex < msg.visibleShows.length - 1) {
    setActiveIndex(msg, msg.activeIndex + 1)
  } else if (dx > 0 && msg.activeIndex > 0) {
    setActiveIndex(msg, msg.activeIndex - 1)
  }
}

// ── 分页虚拟轮播核心 ──
//
// 设计原则：
// - key 使用 slideIdx（下标），Vue 永远复用已有 DOM，不因数据变化重建节点
// - track 的 translateX(calc(10% - activeIndex*80%)) 驱动滑动，transition 全程生效
// - visibleShows 追加式增长（初始20，临近末尾自动追加20）
// - allShows 存全量结果，visibleShows 是其前缀切片
//
// 为何 key=slideIdx 不会重复：
// - visibleShows 只追加不删减，slideIdx 0..n 与 DOM 节点一一对应
// - 追加时新 DOM 在尾部创建，已有节点 key 不变，动画不中断

const PAGE_SIZE = 20
const LOAD_AHEAD = 2  // 距末尾还剩几张时触发预加载

function setActiveIndex(msg, newIndex) {
  msg.activeIndex = newIndex

  // 临近末尾时追加下一批
  if (newIndex >= msg.visibleShows.length - LOAD_AHEAD &&
      msg.visibleShows.length < msg.allShows.length) {
    const nextEnd = Math.min(msg.visibleShows.length + PAGE_SIZE, msg.allShows.length)
    msg.visibleShows = msg.allShows.slice(0, nextEnd)
  }

  // 懒加载当前卡片 AI 推荐理由
  fetchReasonForShow(msg.allShows[newIndex])
}

// ── 滚动到底部 ──
async function scrollToBottom() {
  await nextTick()
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
}

// ── 发送 ──
async function sendMessage() {
  const q = inputText.value.trim()
  if (!q || isSearching.value) return
  inputText.value = ''

  // 1. 添加用户消息
  messages.value.push({ role: 'user', text: q })
  await scrollToBottom()

  // 2. 添加 thinking 占位
  isSearching.value = true
  const thinkingIdx = messages.value.length
  messages.value.push({ role: 'ai', status: 'thinking' })
  await scrollToBottom()

  try {
    // 3. AI 解析
    const filter = await parseUserSearchText(q)

    // invalid：将 invalidReason 直接作为 AI 回复消息展示
    if (filter.parseStatus === 'invalid') {
      messages.value[thinkingIdx] = {
        role: 'ai',
        status: 'text',
        text: filter.invalidReason || '这个我看不懂，你可以换个说法，比如「上海摇滚演出」「下个月北京」「痛仰乐队」',
      }
      return
    }

    // 4. 搜索
    const results = runSearch(filter, q)

    if (results.length === 0) {
      const emptyMsg = {
        role: 'ai',
        status: 'results-empty',
        text: '没找到相关演出，换个关键词试试？比如「上海电子」「下个月北京演出」',
        followUps: [],
        followUpsLoading: true,
        lastFilter: filter,   // 保存本轮 filter 供追问继承
      }
      messages.value[thinkingIdx] = emptyMsg

      generateFollowUpQuestions(filter, 0).then(qs => {
        const m = messages.value[thinkingIdx]
        if (m && m.status === 'results-empty') {
          messages.value.splice(thinkingIdx, 1, {
            ...m,
            followUps: Array.isArray(qs) && qs.length ? qs : [],
            followUpsLoading: false,
          })
        }
      })
    } else {
      const allShows = results
      const aiMsg = {
        role: 'ai',
        status: 'results',
        text: `为你找到 ${results.length} 场演出：`,
        allShows,                                          // 全量结果（不渲染）
        visibleShows: allShows.slice(0, PAGE_SIZE),        // 已渲染批次（初始20）
        activeIndex: 0,
        followUps: [],
        followUpsLoading: true,
        lastFilter: filter,                                // 保存本轮 filter 供追问继承
      }
      messages.value[thinkingIdx] = aiMsg
      fetchReasonForShow(allShows[0])

      // 异步生成追问建议（不阻塞主流程）
      generateFollowUpQuestions(filter, results.length).then(qs => {
        const m = messages.value[thinkingIdx]
        if (m && m.status === 'results') {
          // 用 splice 替换整个对象，确保 Vue 3 响应式追踪到变化
          messages.value.splice(thinkingIdx, 1, {
            ...m,
            followUps: Array.isArray(qs) && qs.length ? qs : [],
            followUpsLoading: false,
          })
        }
      })
    }
  } catch {
    messages.value[thinkingIdx] = {
      role: 'ai',
      status: 'text',
      text: '搜索出了点问题，请稍后再试',
    }
  } finally {
    isSearching.value = false
    await scrollToBottom()
  }
}

// ── 快捷提示 ──
function fillHint(text) {
  inputText.value = text
  sendMessage()
}

// ── 追问点击：基于上一轮上下文用专用解析，直接执行搜索 ──
async function sendFollowUp(text, lastFilter) {
  if (isSearching.value) return

  // 1. 显示用户追问气泡（原始追问文本）
  messages.value.push({ role: 'user', text })
  await scrollToBottom()

  // 2. 添加 thinking 占位
  isSearching.value = true
  const thinkingIdx = messages.value.length
  messages.value.push({ role: 'ai', status: 'thinking' })
  await scrollToBottom()

  try {
    // 3. 上下文感知解析（传入上一轮 filter，让 AI 理解相对含义）
    const filter = await parseFollowUpQuery(text, lastFilter)

    // invalid：直接展示原因
    if (filter.parseStatus === 'invalid') {
      messages.value[thinkingIdx] = {
        role: 'ai',
        status: 'text',
        text: filter.invalidReason || '这个我看不懂，你可以换个说法',
      }
      return
    }

    // 4. 搜索（逻辑与 sendMessage 完全一致）
    const results = runSearch(filter, text)

    if (results.length === 0) {
      const emptyMsg = {
        role: 'ai',
        status: 'results-empty',
        text: '没找到相关演出，换个关键词试试？比如「上海电子」「下个月北京演出」',
        followUps: [],
        followUpsLoading: true,
        lastFilter: filter,
      }
      messages.value[thinkingIdx] = emptyMsg

      generateFollowUpQuestions(filter, 0).then(qs => {
        const m = messages.value[thinkingIdx]
        if (m && m.status === 'results-empty') {
          messages.value.splice(thinkingIdx, 1, {
            ...m,
            followUps: Array.isArray(qs) && qs.length ? qs : [],
            followUpsLoading: false,
          })
        }
      })
    } else {
      const allShows = results
      const aiMsg = {
        role: 'ai',
        status: 'results',
        text: `为你找到 ${results.length} 场演出：`,
        allShows,
        visibleShows: allShows.slice(0, PAGE_SIZE),
        activeIndex: 0,
        followUps: [],
        followUpsLoading: true,
        lastFilter: filter,
      }
      messages.value[thinkingIdx] = aiMsg
      fetchReasonForShow(allShows[0])

      generateFollowUpQuestions(filter, results.length).then(qs => {
        const m = messages.value[thinkingIdx]
        if (m && m.status === 'results') {
          messages.value.splice(thinkingIdx, 1, {
            ...m,
            followUps: Array.isArray(qs) && qs.length ? qs : [],
            followUpsLoading: false,
          })
        }
      })
    }
  } catch {
    messages.value[thinkingIdx] = {
      role: 'ai',
      status: 'text',
      text: '搜索出了点问题，请稍后再试',
    }
  } finally {
    isSearching.value = false
    await scrollToBottom()
  }
}

// ── 票根识别 ──
const ticketFileInputRef = ref(null)

function openImagePicker() {
  ticketFileInputRef.value?.click()
}

async function handleTicketFile(e) {
  const file = e.target.files[0]
  if (!file) return
  e.target.value = ''

  // 1. 添加「用户操作」消息（仅展示图片图标 + 文案，不改变现有用户气泡样式）
  messages.value.push({ role: 'user', text: '📷 识别票根截图' })
  await scrollToBottom()

  // 2. 添加扫描中占位消息
  const scanIdx = messages.value.length
  messages.value.push({ role: 'ai', status: 'ticket-scanning', scanStep: 'ocr' })
  await scrollToBottom()

  // OCR 约 4 秒后切换到 AI 步骤文案
  const stepTimer = setTimeout(() => {
    if (messages.value[scanIdx]?.status === 'ticket-scanning') {
      messages.value[scanIdx] = { ...messages.value[scanIdx], scanStep: 'ai' }
    }
  }, 4000)

  const { data: completed, error } = await recognizeShowFromImage(file)
  clearTimeout(stepTimer)

  // 3. 失败
  if (error) {
    messages.value[scanIdx] = { role: 'ai', status: 'ticket-error', text: error }
    await scrollToBottom()
    return
  }
  if (completed.length === 0) {
    messages.value[scanIdx] = {
      role: 'ai', status: 'ticket-error',
      text: '未识别到有效演出记录，请上传清晰的票根截图',
    }
    await scrollToBottom()
    return
  }

  // 4. 去重 + 写入 store（与 MemoryView 完全相同的逻辑）
  const existing = store.memories
  const results = []
  for (const r of completed) {
    const isDup = existing.some(
      m => m.artist === r.artist && (m.date === r.showDate || m.showDate === r.showDate)
    )
    const memory = {
      artist: r.artist,
      tourName: r.title || '',
      date: r.showDate || '',
      city: r.city || '',
      venue: r.venue || '',
      price: r.price || 0,
      status: r.status,
    }
    if (!isDup) {
      store.addMemory(memory)
      results.push({ ...memory, isNew: true })
    } else {
      results.push({ ...memory, isNew: false })
    }
  }

  const addedCount = results.filter(r => r.isNew).length

  // 5. 展示成功结果气泡
  messages.value[scanIdx] = {
    role: 'ai',
    status: 'ticket-done',
    addedCount,
    totalCount: results.length,
    results,
  }
  await scrollToBottom()
}
</script>

<style scoped>
.agent-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-app);
  overflow: hidden;
}

/* 顶部栏 */
.agent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.2rem 0.8rem;
  background: var(--bg-app);
  border-bottom: 1px solid #1a1e2a;
  flex-shrink: 0;
  z-index: 10;
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
  flex-shrink: 0;
}

.header-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.header-placeholder {
  width: 32px;
}

/* 消息列表区域 */
.messages-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  padding: 1.2rem 1rem;
}

/* 欢迎占位 */
.welcome-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem 1.5rem 2rem;
  text-align: center;
}

.welcome-icon {
  font-size: 2.8rem;
  margin-bottom: 0.9rem;
}

.welcome-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.4rem;
}

.welcome-desc {
  font-size: 0.78rem;
  color: var(--text-muted);
  line-height: 1.6;
  max-width: 240px;
  margin-bottom: 1.2rem;
}

.welcome-hints {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.hint-item {
  background: var(--bg-item);
  border: 1px solid #2a2f3a;
  border-radius: 20px;
  padding: 0.35rem 0.85rem;
  font-size: 0.73rem;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
  transition: border-color 0.15s;
}

.hint-item:active {
  border-color: var(--primary);
  color: var(--primary);
}

/* 消息行 */
.msg-row {
  margin-bottom: 0.85rem;
  display: flex;
}

.msg-row.user {
  justify-content: flex-end;
}

.msg-row.ai {
  justify-content: flex-start;
  flex-direction: column;
}

/* 气泡 */
.bubble {
  max-width: 82%;
  padding: 0.65rem 0.9rem;
  border-radius: 18px;
  font-size: 0.84rem;
  line-height: 1.55;
  word-break: break-word;
}

.user-bubble {
  background: var(--primary);
  color: #0f1117;
  font-weight: 500;
  border-bottom-right-radius: 6px;
}

.ai-bubble {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-bottom-left-radius: 6px;
}

.result-header {
  margin-bottom: 0.7rem;
  font-size: 0.78rem;
  color: var(--text-muted);
  background: transparent;
  border: none;
  padding: 0 0.2rem;
}

/* 思考中动画 */
.thinking {
  padding: 0.7rem 1rem;
}

.dot-loader {
  display: flex;
  gap: 4px;
  align-items: center;
  height: 16px;
}

.dot-loader span {
  width: 6px;
  height: 6px;
  background: var(--text-muted);
  border-radius: 50%;
  animation: dotBounce 1.2s infinite;
}

.dot-loader span:nth-child(2) { animation-delay: 0.2s; }
.dot-loader span:nth-child(3) { animation-delay: 0.4s; }

@keyframes dotBounce {
  0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

/* 轮播外层：负责裁剪，让左右预览卡片只露出一小条 */
.carousel-outer {
  overflow: hidden;
  padding: 4px 0;
}

/* 轮播容器 */
.carousel-wrap {
  width: 100%;
  overflow: visible;
  touch-action: pan-y;
}

/*
  轮播 track：translateX(calc(10% - activeIndex * 80%)) 驱动滑动
  key=slideIdx 确保 DOM 节点复用，transition 全程有效
*/
.carousel-track {
  display: flex;
  transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  will-change: transform;
}

/* 每张卡片固定 80% 宽，transition 由自身驱动 */
.carousel-slide {
  flex: 0 0 80%;
  width: 80%;
  padding: 0 6px;
  box-sizing: border-box;
  transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s ease;
  will-change: transform, opacity;
}

/* 激活态（中间槽 slot[1]）：全尺寸，全亮 */
.slide-active {
  transform: scale(1);
  opacity: 1;
}

/* 非激活态（左右槽 slot[0]/[2]）：缩小变暗 */
.slide-inactive {
  transform: scale(0.93);
  opacity: 0.45;
}

/* ── 演出卡片（与推荐页完全一致）── */
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

.action-btn.ended {
  background: #1e2028;
  color: #555a68;
  border: 1px solid #2a2f3a;
  cursor: not-allowed;
  opacity: 0.7;
}

/* 底部输入栏 */
.input-bar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 1rem;
  background: rgba(12, 15, 23, 0.98);
  backdrop-filter: blur(16px);
  border-top: 1px solid #1a1e2a;
  flex-shrink: 0;
}

.img-btn {
  width: 36px;
  height: 36px;
  background: var(--bg-item);
  border: 1px solid #2a2f3a;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 0.15s;
}

.img-btn:active {
  border-color: var(--primary);
}

.chat-input {
  flex: 1;
  background: var(--bg-item);
  border: 1px solid #2a2f3a;
  border-radius: 20px;
  padding: 0.45rem 0.9rem;
  font-size: 0.85rem;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.15s;
}

.chat-input:focus {
  border-color: #3a4255;
}

.chat-input::placeholder {
  color: var(--text-muted);
}

.chat-input:disabled {
  opacity: 0.6;
}

.send-btn {
  background: var(--primary);
  border: none;
  border-radius: 20px;
  padding: 0.45rem 0.95rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #0f1117;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── 票根识别气泡 ── */
.scanning-text {
  margin-left: 0.6rem;
  font-size: 0.8rem;
  color: var(--text-muted);
  vertical-align: middle;
}

.ticket-error-bubble {
  color: #ffaaaa;
}

.ticket-error-icon {
  margin-right: 0.25rem;
}

.ticket-results {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.2rem;
}

.ticket-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 0.75rem 0.9rem;
}

.ticket-card-dup {
  opacity: 0.55;
}

.ticket-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.2rem;
}

.ticket-artist {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--accent);
}

.ticket-badge {
  font-size: 0.62rem;
  font-weight: 600;
  padding: 0.1rem 0.5rem;
  border-radius: 10px;
  flex-shrink: 0;
}

.badge-new {
  background: rgba(255, 107, 107, 0.15);
  color: var(--primary);
  border: 1px solid rgba(255, 107, 107, 0.3);
}

.badge-dup {
  background: var(--bg-item);
  color: var(--text-muted);
  border: 1px solid #2a2f3a;
}

.ticket-tour {
  font-size: 0.76rem;
  color: var(--text-secondary);
  margin-bottom: 0.3rem;
}

.ticket-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.72rem;
  color: var(--text-muted);
}

.ticket-price {
  color: #80d890;
  font-weight: 500;
}

/* ── 追问建议胶囊 ── */
.followup-bar {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.55rem 0.2rem 0.1rem;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.followup-bar::-webkit-scrollbar {
  display: none;
}

.followup-chip {
  flex-shrink: 0;
  background: var(--bg-item);
  border: 1px solid #2a2f3a;
  border-radius: 20px;
  padding: 0.32rem 0.8rem;
  font-size: 0.73rem;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  transition: border-color 0.15s, color 0.15s;
}

.followup-chip:active {
  border-color: var(--primary);
  color: var(--primary);
}

/* 加载骨架态 */
.followup-chip-ghost {
  width: 72px;
  height: 28px;
  padding: 0;
  background: linear-gradient(90deg, #1a1e2a 25%, #22283a 50%, #1a1e2a 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  cursor: default;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
