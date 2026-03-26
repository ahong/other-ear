import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { allShows } from '../assets/data/index.js'

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
  // 优先级：艺人完全匹配(100) > 风格匹配(30) > 城市匹配(5) > 兜底(0)
  const recommendations = computed(() => {
    const prefs = profile.value
    // 将 artists 数组中的艺人名拆分（兼容 "A/B" 格式），构建扁平集合
    const artistSet = new Set(
      prefs.artists.flatMap(a => a.split('/').map(n => n.trim()))
    )

    return allShows
      .map(show => {
        let score = 0
        // 第一优先级：艺人完全匹配（show.artist 拆分后任意一个命中）
        const showArtists = (show.artist || '').split('/').map(n => n.trim())
        if (showArtists.some(n => artistSet.has(n))) score += 100
        // 第二优先级：音乐风格匹配
        const styleMatch = (show.styles || []).some(s => prefs.genres.includes(s))
        if (styleMatch) score += 30
        // 第三优先级：城市匹配
        if (prefs.cities.includes(show.city)) score += 5
        return { ...show, score }
      })
      .sort((a, b) => b.score - a.score)
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
