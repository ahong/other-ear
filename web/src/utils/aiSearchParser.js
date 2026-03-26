const API_URL = 'https://api.deepseek.com/v1/chat/completions'
const API_KEY = 'sk-0eeffadba2794f069cf9da72dd6b5029'
const TIMEOUT_MS = 8000

/**
 * 解析用户自然语言搜索文本，返回结构化筛选条件
 * @param {string} text - 用户输入，如 "下个月厦门摇滚演出"
 * @returns {Promise<{city:string|null, style:string|null, artist:string|null, startTime:string|null, endTime:string|null}>}
 */
export async function parseUserSearchText(text) {
  const fallback = { city: null, style: null, artist: null, startTime: null, endTime: null }
  if (!text?.trim()) return fallback

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  const prompt = `今天是 ${todayStr}。
用户搜索：「${text.trim()}」

请从用户输入中提取演出筛选条件，严格返回以下 JSON，不要有任何多余文字或 markdown：
{
  "city": "城市名或null",
  "style": "音乐风格或null",
  "artist": "艺人名或null",
  "startTime": "YYYY-MM-DD或null",
  "endTime": "YYYY-MM-DD或null"
}

规则：
- city：提取中国城市名（如厦门、上海、深圳），没有则 null
- style：提取音乐风格（如摇滚、HipHop、民谣、电子、爵士），没有则 null
- artist：提取艺人/乐队名，没有则 null
- startTime/endTime：根据时间描述推算具体日期范围，今天是 ${todayStr}
  - "下个月" → 下个自然月的第一天到最后一天
  - "这个月" → 本月第一天到最后一天
  - "本周末" → 最近的周六到周日
  - "4月份" → 对应年份4月1日到4月30日
  - "明天" → 明天当天
  - 没有时间信息则均为 null
- 只返回 JSON，不要解释`

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
        max_tokens: 200,
        temperature: 0,
      }),
    })

    if (!res.ok) return fallback

    const data = await res.json()
    const raw = data?.choices?.[0]?.message?.content?.trim() || ''

    // 提取 JSON（兼容模型偶尔带 markdown 代码块的情况）
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(jsonStr)

    return {
      city:      parsed.city      ?? null,
      style:     parsed.style     ?? null,
      artist:    parsed.artist    ?? null,
      startTime: parsed.startTime ?? null,
      endTime:   parsed.endTime   ?? null,
    }
  } catch {
    return fallback
  } finally {
    clearTimeout(timer)
  }
}
