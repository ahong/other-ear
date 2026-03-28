import { compressToBase64, ocrImageBase64 } from './tencentOcr.js'

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_KEY = 'sk-0eeffadba2794f069cf9da72dd6b5029'
const TIMEOUT_MS = 30000

/**
 * 识别演出订单/票根截图，提取结构化演出信息
 * 流程：图片压缩 → 腾讯云 OCR 提取文本 → DeepSeek 结构化解析
 *
 * @param {File} file - 用户上传的图片（jpg/png/webp）
 * @returns {Promise<{ data: Array, error: string|null }>}
 *   data 每项结构：{ artist, title, city, venue, showDate, status }
 *   status 只保留 "completed"，"refunded" 已过滤
 *   error 非 null 时包含可展示的错误文案
 */
export async function recognizeShowFromImage(file) {
  // ── Step 1: 压缩图片并转 Base64 ──────────────────────────────────────
  let imageBase64
  try {
    imageBase64 = await compressToBase64(file)
  } catch {
    return { data: [], error: '图片读取失败，请重试' }
  }

  // ── Step 2: 腾讯云 OCR 识别文本 ──────────────────────────────────────
  let ocrText
  try {
    ocrText = await ocrImageBase64(imageBase64)
  } catch (e) {
    const msg = e?.message || ''
    return { data: [], error: `OCR 识别失败：${msg || '请检查网络连接后重试'}` }
  }

  if (!ocrText.trim()) {
    return { data: [], error: '图片中未识别到文字，请上传清晰的票根截图' }
  }

  // ── Step 3: DeepSeek 结构化提取 ──────────────────────────────────────
  const prompt = [
    '你是一个演出票根/订单信息提取助手。下面是从票根截图中 OCR 识别出的文字，请从中提取演出信息。',
    '',
    '【OCR 识别文字】',
    ocrText,
    '',
    '严格返回如下 JSON 数组，不要有任何多余文字、解释或 markdown：',
    '[',
    '  {',
    '    "artist": "艺人/乐队名",',
    '    "title": "演出名称",',
    '    "city": "城市名",',
    '    "venue": "场馆名",',
    '    "showDate": "YYYY-MM-DD",',
    '    "price": 199,',
    '    "status": "completed 或 refunded"',
    '  }',
    ']',
    '',
    '规则：',
    '- 若文字中有多场演出，每场单独一个对象',
    '- showDate 格式必须为 YYYY-MM-DD，无法识别时填 ""',
    '- price 为实际支付金额（数字类型，单位元），无法识别时填 0',
    '- status 只能为 "completed" 或 "refunded"，已退款/退票填 "refunded"，其余填 "completed"',
    '- 无法识别的字段填空字符串 ""',
    '- 只输出 JSON 数组，不要任何其他内容',
  ].join('\n')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0,
      }),
    })

    if (!res.ok) return { data: [], error: `AI 解析失败（${res.status}），请重试` }

    const resData = await res.json()
    const raw = resData?.choices?.[0]?.message?.content?.trim() || ''
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(jsonStr)

    if (!Array.isArray(parsed)) return { data: [], error: 'AI 返回格式异常，请重试' }

    // 过滤已退款，只保留 completed
    const data = parsed.filter(item => item.status !== 'refunded')
    return { data, error: null }
  } catch (e) {
    const isTimeout = e?.name === 'AbortError'
    return { data: [], error: isTimeout ? 'AI 解析超时，请重试' : 'AI 解析失败，请重试' }
  } finally {
    clearTimeout(timer)
  }
}
