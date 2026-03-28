const API_URL = 'https://api.deepseek.com/v1/chat/completions'
const API_KEY = 'sk-0eeffadba2794f069cf9da72dd6b5029'
const TIMEOUT_MS = 8000

/**
 * 解析用户自然语言搜索文本，返回结构化筛选条件
 * @param {string} text - 用户输入，如 "下个月厦门摇滚演出"
 * @returns {Promise<{city:string|null, style:string|null, artist:string|null, startTime:string|null, endTime:string|null, parseStatus:'success'|'invalid', invalidReason:string|null}>}
 */
export async function parseUserSearchText(text) {
  const today = new Date()
  const nowTime = today.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })

  const fallback = { city: null, style: null, artist: null, startTime: null, endTime: null, parseStatus: 'success', invalidReason: null }
  if (!text?.trim()) return fallback

  const prompt = `你是一个专业的演出搜索语义解析助手。

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

【严格解析规则】
1. 当前真实时间：${nowTime}

2. 周定义规则（中国标准）：
   - 一周从【周一】开始，到【周日】结束
   - 用户说"本周"→ 本周一 ~ 本周日
   - 用户说"上周"→ 上周一 ~ 上周日
   - 用户说"下周"→ 下周一 ~ 下周日

3. 时间智能判断规则（核心）：
   - 如果用户明确要查询过去的演出，例如：上个月、上周、昨天、以往、历史、之前、过去、已结束、回顾等
     → 按用户实际意图返回时间段，允许 startTime 早于当前日期
   - 如果用户没有明确指向过去，只是正常询问演出，例如：这个月、近期、这周、接下来、有没有演出
     → startTime 自动 ≥ 当前日期，不返回已过期演出
   - 用户只说"这个月"但今天已在月底 → 自动从今天开始计算

4. 非法内容处理（parseStatus = invalid）：
   - 无效日期（3月42日、2月30日、13月、不存在的时间等）→ invalidReason 说明日期不合法
   - 辱骂、脏话、不文明用语 → invalidReason 说明内容不适当
   - 无意义乱码、与演出完全无关的内容 → invalidReason 说明无法识别需求
   - 无法理解、无法解析的输入 → invalidReason 说明无法解析

5. 格式要求：
   - 时间必须为 YYYY-MM-DD
   - parseStatus = success 时，invalidReason 必须为 null
   - parseStatus = invalid 时，必须给出简短、清晰、礼貌的 invalidReason
   - 只输出标准 JSON，无任何多余文字

用户输入：${text.trim()}`

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

    // 兼容模型偶尔带 markdown 代码块
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(jsonStr)

    // invalid 时直接返回提示，不做搜索
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
