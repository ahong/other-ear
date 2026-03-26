const API_URL = 'https://api.deepseek.com/v1/chat/completions'
const API_KEY = 'sk-0eeffadba2794f069cf9da72dd6b5029'
const TIMEOUT_MS = 10000

/**
 * 调用 DeepSeek API 生成演出推荐理由
 * @param {Object} userPrefs - 用户偏好 { cities: string[], genres: string[], artists: string[] }
 * @param {Object} show      - 演出信息 { title, artist, styles, city, time, price }
 * @returns {Promise<string>} 一句推荐语，失败时返回空字符串
 */
export async function getRecommendationReason(userPrefs, show) {
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
    return data?.choices?.[0]?.message?.content?.trim() || ''
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
    '你是一个音乐演出推荐助手，请用一句话（20字以内）告诉用户为什么这场演出适合他，语气自然亲切，不要说废话。',
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
    '直接输出推荐语，不要加任何前缀或解释。',
  ].join('\n')
}

/**
 * 调用 DeepSeek API 生成观演攻略时间线
 * @param {Object} show - 演出信息 { title, artist, city, venue, time }
 * @returns {Promise<Array>} 时间线数组，失败时返回空数组
 */
export async function generateShowGuide(show) {
  const { title, artist, city, venue, time } = show
  const prompt = [
    '你是一个演出观演攻略生成助手。请根据以下演出信息，生成一份当天的观演时间线攻略。',
    '',
    `演出名称：${title || '未知'}`,
    `演出艺人：${artist || '未知'}`,
    `演出城市：${city || '未知'}`,
    `演出场地：${venue || '未知'}`,
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
