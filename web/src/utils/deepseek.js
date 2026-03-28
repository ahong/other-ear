const API_URL = 'https://api.deepseek.com/v1/chat/completions'
const API_KEY = 'sk-0eeffadba2794f069cf9da72dd6b5029'
const TIMEOUT_MS = 50000

// 推荐理由缓存有效期：7天（毫秒）
const REASON_CACHE_TTL = 7 * 24 * 60 * 60 * 1000
const REASON_CACHE_KEY = 'oe_reason_cache'

function loadReasonCache() {
  try {
    return JSON.parse(localStorage.getItem(REASON_CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveReasonCache(cache) {
  try {
    localStorage.setItem(REASON_CACHE_KEY, JSON.stringify(cache))
  } catch {}
}

/** 清除所有推荐理由缓存（用户重新提交偏好问卷时调用） */
export function clearReasonCache() {
  try {
    localStorage.removeItem(REASON_CACHE_KEY)
  } catch {}
}

/**
 * 调用 DeepSeek API 生成演出推荐理由（带 localStorage 缓存，7天有效）
 * @param {Object} userPrefs - 用户偏好 { cities: string[], genres: string[], artists: string[] }
 * @param {Object} show      - 演出信息 { title, artist, styles, city, time, price, event_id }
 * @returns {Promise<string>} 一句推荐语，失败时返回空字符串
 */
export async function getRecommendationReason(userPrefs, show) {
  const id = show.event_id
  if (id) {
    const cache = loadReasonCache()
    const entry = cache[id]
    if (entry && entry.text && Date.now() - entry.savedAt < REASON_CACHE_TTL) {
      return entry.text
    }
  }

  const prompt = buildPrompt(userPrefs, show)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 80,
        temperature: 0.7,
      }),
    })

    if (!res.ok) return ''

    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content?.trim() || ''

    if (text && id) {
      const cache = loadReasonCache()
      cache[id] = { text, savedAt: Date.now() }
      saveReasonCache(cache)
    }

    return text
  } catch {
    return ''
  } finally {
    clearTimeout(timer)
  }
}

function buildPrompt(userPrefs, show) {
  const { cities = [], genres = [], artists = [] } = userPrefs
  const { title, artist, styles = [], city, time, price } = show

  return [
    '你是一个资深独立音乐乐迷，请根据用户偏好和当前演出信息，写一句50字的推荐理由，让用户觉得当前演出很适合他。',
    '要像朋友安利演出一样，不要使用官方介绍语气，不要像广告。',
    '可以提到音乐风格、现场氛围、情绪感受等，可以使用"如果你喜欢…你可能会喜欢…"等等这类句式，但不要每次都用同一个句式。',
    '',
    `用户偏好城市：${cities.join('、') || '不限'}`,
    `用户喜欢风格：${genres.join('、') || '不限'}`,
    `用户钟爱艺人：${artists.join('、') || '不限'}`,
    '',
    `演出名称：${title || '未知'}`,
    `演出艺人：${artist || '未知'}`,
    `演出风格：${styles.join('、') || '未知'}`,
    `演出城市：${city || '未知'}`,
    `演出时间：${time || '未知'}`,
    `票价：${price || '未知'}`,
    '',
    '直接输出推荐语',
  ].join('\n')
}

/**
 * 调用 DeepSeek API 生成观演攻略时间线
 * @param {Object} show - 演出信息 { title, artist, city, venue, address, time }
 * @returns {Promise<Array>} 时间线数组，失败时返回空数组
 */
export async function generateShowGuide(show) {
  const { title, artist, city, venue, address, time } = show
  const prompt = [
    '你是一个演出观演攻略生成助手。请根据以下演出信息，生成一份当天的观演时间线攻略。',
    '',
    `演出名称：${title || '未知'}`,
    `演出艺人：${artist || '未知'}`,
    `演出城市：${city || '未知'}`,
    `演出场地：${venue || '未知'}`,
    `演出地址：${address || '未知'}`,
    `演出时间：${time || '未知'}`,
    '',
    '严格返回如下 JSON 数组，共4个节点，不要有任何多余文字、解释或 markdown：',
    '[',
    '  { "time": "14:00", "title": "抵达", "address": "交通枢纽或入城建议", "content": "如何抵达城市/场地的建议" },',
    '  { "time": "17:00", "title": "住宿", "address": "推荐住宿区域", "content": "住宿选择建议" },',
    '  { "time": "18:30", "title": "美食", "address": "推荐餐厅或美食街", "content": "当地特色美食推荐" },',
    '  { "time": "20:00", "title": "演出", "address": "场地完整地址", "content": "观演注意事项或氛围描述" }',
    ']',
    '',
    '只输出 JSON 数组，time/title/address/content 四个字段必须存在，内容结合城市和场地实际情况填写。',
  ].join('\n')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.5,
      }),
    })

    if (!res.ok) return []

    const data = await res.json()
    const raw = data?.choices?.[0]?.message?.content?.trim() || ''
    // 兼容模型偶尔包裹 markdown 代码块
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(jsonStr)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 调用 DeepSeek API 分析用户演出记录，生成回忆数据
 * @param {Array} myShows - 演出记录数组，每项包含 { artist, title, city, venue, showDate }
 * @returns {Promise<Object|null>} 分析结果，失败时返回 null
 *   结构：{ musicPersonality: { tags, summary }, yearSummary: { totalShows, totalCities, mostSeenArtist, mostVisitedVenue }, cities }
 */
export async function analyzeMyShows(myShows) {
  if (!myShows || myShows.length === 0) return null

  const showList = myShows
    .map((s, i) => `${i + 1}. 艺人：${s.artist || '未知'}，演出：${s.title || s.tourName || '未知'}，城市：${s.city || '未知'}，场馆：${s.venue || '未知'}，日期：${s.showDate || s.date || '未知'}`)
    .join('\n')

  const prompt = [
    '你是一个音乐数据分析助手。请根据以下用户的演出观看记录，生成一份回忆分析报告。',
    '',
    '用户演出记录：',
    showList,
    '',
    '严格返回如下 JSON 对象，不要有任何多余文字、解释或 markdown：',
    '{',
    '  "musicPersonality": {',
    '    "tags": ["风格标签1", "风格标签2"],',
    '    "summary": "100字以内的音乐偏好总结"',
    '  },',
    '  "yearSummary": {',
    '    "totalShows": 总场数,',
    '    "totalCities": 城市数量,',
    '    "mostSeenArtist": "最常看的艺人",',
    '    "mostVisitedVenue": "最常去的场馆"',
    '  },',
    '  "cities": ["城市1", "城市2"]',
    '}',
    '',
    '规则：',
    '- tags 最多4个，从常见独立音乐风格中选：独立摇滚、华语 indie、Livehouse、民谣、后朋克、电子、实验、噪音、爵士、嘻哈',
    '- summary 结合艺人和城市特征描述用户的乐迷类型，100字以内',
    '- yearSummary 统计所有记录（不限年份）',
    '- cities 为所有出现过的城市去重列表',
    '- 只输出 JSON，不要任何其他内容',
  ].join('\n')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.3,
      }),
    })

    if (!res.ok) return null

    const data = await res.json()
    const raw = data?.choices?.[0]?.message?.content?.trim() || ''
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(jsonStr)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

