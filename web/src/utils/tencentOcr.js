const SCF_OCR_URL = 'https://1258253596-dbg8me1y8t.ap-guangzhou.tencentscf.com/api/ocr'

// ── 压缩图片到 ≤1MB（腾讯云 OCR 推荐） ──────────────────────────────────

/**
 * 将 File 压缩后转为纯 Base64（不含 data: 前缀）
 * 超过 1MB 时等比缩放，始终输出 JPEG
 */
export function compressToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const MAX_SIZE = 1024 * 1024 // 1MB
        let { width, height } = img
        const canvas = document.createElement('canvas')
        let quality = 0.85

        // 若原始 base64 超 1MB，则按比例缩放
        const rawBase64Len = (e.target.result.length - 'data:image/jpeg;base64,'.length) * 0.75
        if (rawBase64Len > MAX_SIZE) {
          const ratio = Math.sqrt(MAX_SIZE / rawBase64Len)
          width = Math.floor(width * ratio)
          height = Math.floor(height * ratio)
          quality = 0.8
        }

        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(dataUrl.split(',')[1]) // 返回纯 base64
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

// ── 主函数 ────────────────────────────────────────────────────────────────

/**
 * 调用云函数 OCR 识别图片，返回拼接后的纯文本
 * @param {string} imageBase64 - 纯 Base64 字符串（不含 data: 前缀）
 * @returns {Promise<string>} 识别到的所有文字，失败时抛出异常
 */
export async function ocrImageBase64(imageBase64) {
  const res = await fetch(SCF_OCR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64 }),
  })

  if (!res.ok) {
    throw new Error(`云函数请求失败：HTTP ${res.status}`)
  }

  const data = await res.json()

  if (data?.code !== 0) {
    throw new Error(`OCR 错误：${data?.message || data?.error || `code=${data?.code}`}`)
  }

  const words = data?.words ?? []
  return words.join('\n')
}
