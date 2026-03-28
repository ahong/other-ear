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
 * 追问专用语义解析：基于上一轮 filter 上下文，理解相对语义（附近城市、换个风格、5月等）
 * @param {string} text       - 用户追问文本，如 "看看附近城市" "换个风格" "5月的呢"
 * @param {Object} prevFilter - 上一轮完整 filter { city, artist, style, startTime, endTime }
 * @returns {Promise<{city, artist, style, startTime, endTime, parseStatus, invalidReason}>}
 */
export async function parseFollowUpQuery(text, prevFilter) {
  const today = new Date()
  const nowTime = today.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })

  const fallback = {
    city: prevFilter?.city ?? null,
    style: prevFilter?.style ?? null,
    artist: prevFilter?.artist ?? null,
    startTime: prevFilter?.startTime ?? null,
    endTime: prevFilter?.endTime ?? null,
    parseStatus: 'success',
    invalidReason: null,
  }

  if (!text?.trim()) return fallback

  const prompt = `你是一个专业的演出搜索语义解析助手，支持多轮上下文理解。

【已有上下文（上一轮搜索条件）】
城市：${prevFilter?.city ?? '无'}
艺人：${prevFilter?.artist ?? '无'}
风格：${prevFilter?.style ?? '无'}
开始时间：${prevFilter?.startTime ?? '无'}
结束时间：${prevFilter?.endTime ?? '无'}

【当前用户追问】
${text.trim()}

【当前真实时间】
${nowTime}

请结合上下文，输出完整的新搜索条件。

输出格式：
{
  "city": null | 字符串,
  "artist": null | 字符串,
  "style": null | 字符串,
  "startTime": null | "YYYY-MM-DD",
  "endTime": null | "YYYY-MM-DD",
  "parseStatus": "success" | "invalid",
  "invalidReason": null | 字符串
}

解析规则：
1. 一周从周一到周日计算。
2. 用户说"附近城市"，指上文城市的周边城市，保留上文风格、艺人、时间段，仅将 city 改为附近城市名。
3. 用户说"换个风格/其他风格"，保留上文城市、艺人、时间段，将 style 置为 null（不限风格）或用户指定的新风格。
4. 用户说"5月/下个月/再下个月"等时间，仅更新 startTime/endTime，其余字段继承上文。
5. 用户明确查历史则允许过去时间，正常搜索默认从今天开始。
6. 无效日期、脏话、无意义内容返回 invalid 并给出简短礼貌的 invalidReason。
7. 只输出标准 JSON，无任何多余文字。`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)

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
        max_tokens: 200,
        temperature: 0,
      }),
    })

    if (!res.ok) return fallback

    const data = await res.json()
    const raw = data?.choices?.[0]?.message?.content?.trim() || ''
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(jsonStr)

    if (parsed.parseStatus === 'invalid') {
      return { city: null, style: null, artist: null, startTime: null, endTime: null, parseStatus: 'invalid', invalidReason: parsed.invalidReason ?? null }
    }

    return {
      city:          parsed.city      ?? null,
      style:         parsed.style     ?? null,
      artist:        parsed.artist    ?? null,
      startTime:     parsed.startTime ?? null,
      endTime:       parsed.endTime   ?? null,
      parseStatus:   'success',
      invalidReason: null,
    }
  } catch {
    return fallback
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 根据上一轮搜索上下文动态生成3条追问建议
 * @param {Object} filter  - 上一轮解析出的 filter { city, style, artist, startTime, endTime }
 * @param {number} count   - 搜索结果数量
 * @returns {Promise<string[]>} 3条追问文本，失败时返回空数组
 */
export async function generateFollowUpQuestions(filter, count) {
  const nowTime = new Date().toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })

  const params = [
    filter.city      ? `城市：${filter.city}`            : null,
    filter.style     ? `风格：${filter.style}`           : null,
    filter.artist    ? `艺人：${filter.artist}`          : null,
    filter.startTime ? `开始时间：${filter.startTime}`   : null,
    filter.endTime   ? `结束时间：${filter.endTime}`     : null,
  ].filter(Boolean).join('，') || '无特定条件'

  const prompt = `你是一个专业的演出推荐AI助手。
用户刚刚完成一次演出搜索，请根据上下文生成3条自然、合理、绝不重复的追问建议。

【基本信息】
当前真实时间：${nowTime}
用户上一轮搜索条件：${params}
本次搜索结果数量：${count}

【核心铁律】
1. 绝对禁止出现任何与用户已使用条件完全相同的追问。
2. 如果用户已经指定了【下个月】，严禁出现"下个月""下个月的呢"这类相同时间段追问，必须改为：
   - 再下个月
   - 下下个月
   - 之后的月份
   - 后续演出
3. 如果用户已经指定【本周】，严禁再追问本周，必须改为：
   - 下周
   - 下下周
4. 如果用户已经指定【4月】，严禁再追问4月，必须改为：
   - 5月
   - 6月
   - 之后月份
5. 已指定城市 → 不重复同一城市
6. 已指定风格 → 不重复同一风格
7. 已指定艺人 → 不重复同一艺人

【智能方向】
- 结果 > 20 条：精筛选 → 只看音乐节？只看周末？只看热门艺人？
- 结果 < 10 条：扩范围 → 看看附近城市？换个风格？看再下个月？
- 结果 = 0 条：兜底推荐 → 推荐近期热门？看看全风格？

【格式要求】
- 口语化、简短（10字内）
- 只返回 JSON 数组，无多余内容
["追问1","追问2","追问3"]`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)

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
        max_tokens: 120,
        temperature: 0.8,
      }),
    })

    if (!res.ok) return []

    const data = await res.json()
    const raw = data?.choices?.[0]?.message?.content?.trim() || ''
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(jsonStr)
    return Array.isArray(parsed) ? parsed.slice(0, 3) : []
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

