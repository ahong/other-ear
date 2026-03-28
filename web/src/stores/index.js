import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { allShows } from '../assets/data/index.js'
import { clearReasonCache } from '../utils/deepseek.js'

// ============ 兼容旧行程数据的字段映射 ============
// 真实数据字段：event_id, title, artist, venue, time, price, styles, cover_image, event_url
// 行程存储字段沿用：showId, artist, tourName, city, venue, date, ticketDate ...

// ============ 用户偏好 Store ============
export const useUserStore = defineStore('user', () => {
  const profile = ref(loadFromStorage('oe_profile', {
    cities: [],
    genres: [],
    artists: [],
    hasCompleted: false
  }))

  const itinerary = ref(loadFromStorage('oe_itinerary', []))
  const memories = ref(loadFromStorage('oe_memories', []))

  function saveProfile(data) {
    profile.value = { ...data, hasCompleted: true }
    saveToStorage('oe_profile', profile.value)
    clearReasonCache()  // 偏好变更，清除旧的推荐理由缓存
  }

  function addToItinerary(show) {
    const id = show.event_id ?? show.id ?? show.showId
    if (!itinerary.value.some(i => i.showId === id)) {
      itinerary.value.push({
        showId: id,
        artist: show.artist,
        tourName: show.title ?? show.tourName ?? '',
        city: show.city,
        venue: show.venue,
        date: show.time ?? show.date ?? '',
        ticketDate: show.ticketDate ?? '',
        price: show.price ?? '',
        cover_image: show.cover_image ?? '',
        event_url: show.event_url ?? '',
        styles: show.styles ?? [],
        address: show.address ?? '',
        addedAt: Date.now()
      })
      saveToStorage('oe_itinerary', itinerary.value)
      return true
    }
    return false
  }

  function removeFromItinerary(showId) {
    itinerary.value = itinerary.value.filter(i => i.showId !== showId)
    saveToStorage('oe_itinerary', itinerary.value)
  }

  function addMemory(memory) {
    memories.value.unshift(memory)
    saveToStorage('oe_memories', memories.value)
  }

  // 根据用户偏好从真实数据中推荐演出
  // 总分 = 偏好分 + 专场分 + 时间分
  // 偏好分：钟爱艺人命中(100) + 风格命中(30) + 城市命中(5)
  // 专场分：每位钟爱艺人只对【时间最近的1场单人专场】+200，其余场次不加
  // 时间分：timeScore = max(0, 50 - daysDiff * 0.5)，过期演出 0 分
  const recommendations = computed(() => {
    const prefs = profile.value
    const now = Date.now()

    // 将 artists 数组中的艺人名拆分（兼容 "A/B" 格式），构建扁平集合
    const artistSet = new Set(
      prefs.artists.flatMap(a => a.split('/').map(n => n.trim()))
    )

    // 辅助：解析演出时间戳
    function parseShowTs(show) {
      if (!show.time) return NaN
      return new Date(show.time.replace(/\//g, '-')).getTime()
    }

    // 第一步：找出每位钟爱艺人"时间最近的未过期单人专场"的 event_id
    // 结构：Map<artistName, event_id>
    const soloFeaturedId = new Map()
    for (const show of allShows) {
      const showArtists = (show.artist || '').split('/').map(n => n.trim())
      if (showArtists.length !== 1) continue           // 非单人专场跳过
      const name = showArtists[0]
      if (!artistSet.has(name)) continue               // 非钟爱艺人跳过
      const ts = parseShowTs(show)
      if (isNaN(ts) || ts < now) continue              // 过期/无日期跳过
      // 保留最近的一场（ts 最小 = 距今最近）
      const existing = soloFeaturedId.get(name)
      if (!existing || ts < parseShowTs(allShows.find(s => s.event_id === existing))) {
        soloFeaturedId.set(name, show.event_id)
      }
    }

    return allShows
      .map(show => {
        // ── 偏好分 ──────────────────────────────────
        let prefScore = 0
        const showArtists = (show.artist || '').split('/').map(n => n.trim())
        const artistHit = showArtists.some(n => artistSet.has(n))
        if (artistHit) prefScore += 100
        const styleMatch = (show.styles || []).some(s => prefs.genres.includes(s))
        if (styleMatch) prefScore += 30
        if (prefs.cities.includes(show.city)) prefScore += 5

        // ── 专场分 ──────────────────────────────────
        // 仅对每位钟爱艺人"时间最近的那1场单人专场"加 200 分
        const soloScore = soloFeaturedId.has(showArtists[0]) &&
          soloFeaturedId.get(showArtists[0]) === show.event_id ? 200 : 0

        // ── 时间分 ──────────────────────────────────
        let timeScore = 0
        const showTs = parseShowTs(show)
        if (!isNaN(showTs)) {
          const daysDiff = (showTs - now) / (1000 * 3600 * 24)
          timeScore = daysDiff >= 0 ? Math.max(0, 50 - daysDiff * 0.5) : 0
        }

        const score = prefScore + soloScore + timeScore
        return { ...show, score, _timeScore: timeScore }
      })
      // 总分降序；同分时时间分更高（即更近）的优先
      .sort((a, b) => b.score - a.score || b._timeScore - a._timeScore)
  })

  function getAIReason(show) {
    const prefs = profile.value
    if (prefs.artists.includes(show.artist)) {
      return `因为你喜欢 ${show.artist}，这场现场绝对不能错过！`
    }
    const matchedStyle = (show.styles || []).find(s => prefs.genres.includes(s))
    if (matchedStyle) {
      return `根据你喜欢的「${matchedStyle}」风格，${show.artist} 的现场值得期待。`
    }
    if (prefs.cities.includes(show.city)) {
      return `${show.city} 本地演出，${show.artist} 带来精彩现场。`
    }
    return `独立乐迷口碑推荐：${show.artist} 现场张力十足。`
  }

  function getReminderText(ticketDate) {
    if (!ticketDate) return ''
    const diff = Math.ceil((new Date(ticketDate) - new Date()) / (1000 * 3600 * 24))
    if (diff > 3) return `${diff} 天后开票`
    if (diff === 3) return '3 天后开票'
    if (diff === 1) return '明天开票！'
    if (diff === 0) return '今天开票！'
    if (diff < 0) return '已开票'
    return `${diff} 天后开票`
  }

  return {
    profile,
    itinerary,
    memories,
    recommendations,
    saveProfile,
    addToItinerary,
    removeFromItinerary,
    addMemory,
    getAIReason,
    getReminderText
  }
})

// ============ 工具函数 ============
function loadFromStorage(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}
