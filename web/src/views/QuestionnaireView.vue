<template>
  <div class="questionnaire page-scroll">
    <!-- 顶部栏 -->
    <div class="q-header">
      <button class="back-btn" @click="router.back()">←</button>
      <!-- <span class="q-badge">🎧 构建你的声纹</span> -->
      <span class="artist-count" :class="{ enough: selectedArtists.length >= 5 }">
        🎸 {{ selectedArtists.length }}/5+ 音乐人
      </span>
    </div>

    <!-- 进度条 -->
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: progressWidth }"></div>
    </div>

    <!-- Section 1: 城市 -->
    <div class="section">
      <div class="section-header">
        <div class="section-title">📍 你的演出城市圈</div>
        <div class="section-desc">多选，AI 将优先推送这些城市的演出</div>
      </div>
      <div v-if="locating" class="locating-hint">
        <span class="locating-dot"></span>定位中…
      </div>
      <div v-else class="bubbles-grid">
        <div
          v-for="city in sortedCities"
          :key="city"
          class="bubble"
          :class="{ selected: selectedCities.includes(city) }"
          @click="toggleCity(city)"
        >{{ city }}</div>
      </div>
    </div>

    <div class="divider"></div>

    <!-- Section 2: 风格 -->
    <div class="section">
      <div class="section-header">
        <div class="section-title">🎵 音乐风格</div>
        <div class="section-desc">多选，为你解锁相应领域的音乐人</div>
      </div>
      <div class="bubbles-grid">
        <div
          v-for="genre in GENRES"
          :key="genre"
          class="bubble"
          :class="{ selected: selectedGenres.includes(genre) }"
          @click="toggleGenre(genre)"
        >{{ genre }}</div>
      </div>
    </div>

    <div class="divider"></div>

    <!-- Section 3: 艺人 -->
    <div class="section">
      <div class="section-header">
        <div class="section-title">🎤 钟爱的音乐人</div>
        <div class="section-desc">点击添加，至少选 5 位（可跨风格）</div>
      </div>

      <div v-if="selectedGenres.length === 0" class="empty-artists">
        👆 请先选择音乐风格，AI 将为你推荐相关音乐人
      </div>

      <div v-else class="artists-grid">
        <div
          v-for="artist in artistsPool"
          :key="artist.name"
          class="artist-card"
          :class="{ selected: selectedArtists.some(a => a.name === artist.name) }"
          @click="toggleArtist(artist)"
        >
          <div class="artist-name">{{ artist.name }}</div>
          <div class="artist-sub">{{ artist.sub }}</div>
          <div v-if="selectedArtists.some(a => a.name === artist.name)" class="check-mark">✓</div>
        </div>
      </div>

      <!-- 已选预览 -->
      <div v-if="selectedArtists.length > 0" class="selected-preview">
        <span class="preview-label">已选：</span>
        <span
          v-for="a in selectedArtists"
          :key="a.name"
          class="preview-tag"
          @click="toggleArtist(a)"
        >{{ a.name }} ×</span>
      </div>
      <div v-else class="selected-preview muted">
        ✨ 还没有选择音乐人，点击上方艺人加入
      </div>
    </div>

    <!-- 底部按钮区 -->
    <div class="bottom-actions">
      <button
        class="btn-primary"
        :disabled="selectedArtists.length < 5"
        :class="{ disabled: selectedArtists.length < 5 }"
        @click="handleComplete"
      >
        {{ selectedArtists.length < 5 ? `再选 ${5 - selectedArtists.length} 位音乐人` : '✨ 完成，进入另一只耳' }}
      </button>
      <button class="btn-ghost" @click="router.back()">← 返回</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/index.js'
import { ALL_STYLES, allShows, SCRAPED_CITIES, ALL_ARTISTS } from '../assets/data/index.js'
import { genreHotMap, artistHotMap } from '../assets/data/hotData.js'
const router = useRouter()
const store = useUserStore()
const showToast = inject('showToast')

// ============ 数据 ============
// 城市列表：爬虫城市 + 额外热门城市去重合并
const EXTRA_CITIES = ['成都', '武汉']
const CITIES = [...new Set([...SCRAPED_CITIES, ...EXTRA_CITIES])]

// 热门城市（固定顺序，排在定位城市/省会之后）
const HOT_CITIES = ['泉州', '深圳', '广州', '杭州', '上海', '北京', '成都', '武汉']

// 城市 → 省会映射（同城市跳过）
const CITY_TO_CAPITAL = {
  '北京': '北京', '上海': '上海', '天津': '天津', '重庆': '重庆',
  '广州': '广州', '深圳': '广州', '珠海': '广州', '东莞': '广州', '佛山': '广州',
  '杭州': '杭州', '宁波': '杭州', '温州': '杭州', '绍兴': '杭州',
  '南京': '南京', '苏州': '南京', '无锡': '南京', '常州': '南京',
  '成都': '成都', '绵阳': '成都', '德阳': '成都',
  '武汉': '武汉', '宜昌': '武汉',
  '西安': '西安', '咸阳': '西安',
  '厦门': '福州', '福州': '福州', '泉州': '福州',
  '长沙': '长沙', '株洲': '长沙',
  '沈阳': '沈阳', '大连': '沈阳',
  '哈尔滨': '哈尔滨', '长春': '长春',
  '济南': '济南', '青岛': '济南',
  '郑州': '郑州', '洛阳': '郑州',
  '南昌': '南昌', '昆明': '昆明', '贵阳': '贵阳',
  '南宁': '南宁', '海口': '海口', '太原': '太原',
  '兰州': '兰州', '西宁': '西宁', '银川': '银川',
  '乌鲁木齐': '乌鲁木齐', '拉萨': '拉萨', '呼和浩特': '呼和浩特',
  '石家庄': '石家庄', '合肥': '合肥', '南宁': '南宁',
}

// 定位状态
const locatedCity = ref('')   // 解析出的城市名
const locating = ref(true)    // 定位中

// 排好序的城市列表（计算属性）
const sortedCities = computed(() => {
  const all = [...CITIES]
  const loc = locatedCity.value
  if (!loc || !all.includes(loc)) return all.slice(0, 10)

  const capital = CITY_TO_CAPITAL[loc]
  const result = []

  // 1. 定位城市
  result.push(loc)
  // 2. 省会（不重复）
  if (capital && capital !== loc && all.includes(capital)) {
    result.push(capital)
  }
  // 3. 热门城市（按 HOT_CITIES 顺序，不重复）
  for (const c of HOT_CITIES) {
    if (!result.includes(c) && all.includes(c)) result.push(c)
  }
  // 4. 其余城市
  for (const c of all) {
    if (!result.includes(c)) result.push(c)
  }
  return result.slice(0, 10)
})

// 逆地理编码：经纬度 → 城市名
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh-CN`,
      { headers: { 'Accept-Language': 'zh-CN' } }
    )
    const data = await res.json()
    const addr = data.address || {}
    // 依次尝试 city / town / county / state
    return addr.city || addr.town || addr.county || addr.state || ''
  } catch {
    return ''
  }
}

// 从完整地名中提取出与 CITIES 匹配的城市
function matchCity(raw) {
  if (!raw) return ''
  // 精确匹配
  if (CITIES.includes(raw)) return raw
  // 去掉"市""区"等后缀再匹配
  const stripped = raw.replace(/[市区县]$/, '')
  if (CITIES.includes(stripped)) return stripped
  // 包含匹配
  return CITIES.find(c => raw.includes(c) || c.includes(stripped)) || ''
}

onMounted(async () => {
  if (!navigator.geolocation) {
    locating.value = false
    return
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const raw = await reverseGeocode(pos.coords.latitude, pos.coords.longitude)
      const city = matchCity(raw)
      if (city) {
        locatedCity.value = city
        if (selectedCities.value.length === 0) {
          selectedCities.value = [city]
        }
      } else {
        // 逆地理编码成功但未匹配到城市，降级到厦门
        locatedCity.value = '厦门'
        if (selectedCities.value.length === 0) {
          selectedCities.value = ['厦门']
        }
      }
      locating.value = false
    },
    () => {
      // 定位失败，默认厦门
      locatedCity.value = '厦门'
      if (selectedCities.value.length === 0) {
        selectedCities.value = ['厦门']
      }
      locating.value = false
    },
    { timeout: 6000, maximumAge: 60000 }
  )
})

// 风格列表：来自真实数据，按出现频率排序
// 风格列表：按 genreHotMap 热度降序排列
const EXCLUDED_GENRES = new Set(['动漫', '节奏布鲁斯', '极端金属', '世界音乐', '实验'])
const GENRES = [...ALL_STYLES]
  .filter(s => !EXCLUDED_GENRES.has(s))
  .sort((a, b) => (genreHotMap[b] ?? 0) - (genreHotMap[a] ?? 0))

// 13 位优先艺人：sub 为唯一显示标签，genres 为允许匹配的风格键集合
// genres 值必须严格匹配 ALL_STYLES 实际存在的粗粒度枚举（摇滚/民谣/独立/朋克）
// 旧数据（allShows）对这些艺人完全无效，所有逻辑只使用此处定义的字段
const PRIORITY_ARTISTS = [
  { name: '万能青年旅店', sub: '独立摇滚',    genres: ['摇滚'] },
  { name: '二手玫瑰乐队',     sub: '民谣摇滚',    genres: ['摇滚'] },
  { name: '痛仰',         sub: '硬摇滚',      genres: ['摇滚'] },
  { name: '新裤子',       sub: '朋克摇滚',    genres: ['摇滚'] },
  { name: '草东没有派对', sub: '另类摇滚',    genres: ['摇滚'] },
  { name: 'deca joins',   sub: '独立/慵懒',   genres: ['独立'] },
  { name: '声音玩具',     sub: '独立摇滚',    genres: ['独立', '摇滚'] },
  { name: '海朋森',       sub: '后朋克/独立', genres: ['独立', '后朋克'] },
  { name: '法兹乐队',     sub: '后朋克/独立',      genres: ['后朋克', '独立'] },
  { name: '五条人',       sub: '民谣摇滚',    genres: ['民谣'] },
  { name: '张玮玮',       sub: '民谣',        genres: ['民谣'] },
  { name: '小河',         sub: '实验民谣',    genres: ['民谣'] },
  { name: '周云蓬',       sub: '民谣',        genres: ['民谣'] },
]
// 快速查找表：指定艺人名 → 配置项（同时兼容 allShows 中"二手玫瑰乐队"的别名）
const PRIORITY_MAP = new Map([
  ...PRIORITY_ARTISTS.map(a => [a.name, a]),
  ['二手玫瑰乐队', PRIORITY_ARTISTS.find(a => a.name === '二手玫瑰')],
])

// 根据选中风格，从真实演出数据中聚合艺人池
// 每个艺人记录：{ name, sub(风格标签), genre(用于 toggleGenre 清除判断) }
const artistsPool = computed(() => {
  if (selectedGenres.value.length === 0) return []
  const selected = new Set(selectedGenres.value)

  // ── 1. 指定艺人：完全基于 PRIORITY_MAP，绝不读取 allShows ──
  const priority = PRIORITY_ARTISTS
    .filter(a => a.genres.some(g => selected.has(g)))
    .map(a => ({
      name: a.name,
      sub: a.sub,
      // genre 取第一个与用户已选有交集的风格键，供 toggleGenre 清除逻辑使用
      genre: a.genres.find(g => selected.has(g)),
    }))

  // ── 2. 普通艺人：来自 allShows，跳过已在指定列表中的名字 ──
  const normalMap = new Map()
  allShows.forEach(show => {
    if (!show.artist) return
    const matchedGenre = (show.styles || []).find(s => selected.has(s))
    if (!matchedGenre) return
    const sub = (show.styles || []).join('/')
    show.artist.split('/').map(n => n.trim()).filter(n => n).forEach(name => {
      // 指定艺人名在此管道中完全跳过
      if (!normalMap.has(name) && !PRIORITY_MAP.has(name)) {
        normalMap.set(name, { name, sub, genre: matchedGenre })
      }
    })
  })

  const normal = Array.from(normalMap.values())
    .filter(a => a.name.length <= 16)
    .sort((a, b) => (artistHotMap[b.name] ?? 0) - (artistHotMap[a.name] ?? 0))
    .slice(0, 20)

  return [...priority, ...normal]
})

// ============ 状态 ============
const selectedCities = ref([...store.profile.cities])
const selectedGenres = ref([...store.profile.genres])
// 从已保存数据中还原已选艺人信息
// 指定艺人：使用 PRIORITY_MAP 中的 sub/genres，绝不读取 allShows
// 普通艺人：从 allShows 还原
const selectedArtists = ref(store.profile.artists.map(name => {
  const priority = PRIORITY_MAP.get(name)
  if (priority) {
    return { name, sub: priority.sub, genre: priority.genres[0] || '' }
  }
  const show = allShows.find(s => s.artist === name)
  return {
    name,
    sub: show ? (show.styles || []).join('/') : '',
    genre: show ? (show.styles || [])[0] || '' : ''
  }
}))

// ============ 计算属性 ============
const progressWidth = computed(() => {
  const c = (selectedCities.value.length > 0 ? 33 : 0)
    + (selectedGenres.value.length > 0 ? 33 : 0)
    + (selectedArtists.value.length >= 5 ? 34 : Math.min(34, selectedArtists.value.length * 6.8))
  return `${c}%`
})

// ============ 操作 ============
function toggleCity(city) {
  const idx = selectedCities.value.indexOf(city)
  if (idx >= 0) {
    selectedCities.value.splice(idx, 1)
  } else {
    selectedCities.value.push(city)
  }
}

function toggleGenre(genre) {
  const idx = selectedGenres.value.indexOf(genre)
  if (idx >= 0) {
    selectedGenres.value.splice(idx, 1)
    // 清理不再属于选中风格的艺人
    const before = selectedArtists.value.length
    selectedArtists.value = selectedArtists.value.filter(a =>
      selectedGenres.value.includes(a.genre)
    )
    if (selectedArtists.value.length < before) {
      showToast('已移除不符合当前风格的音乐人')
    }
  } else {
    selectedGenres.value.push(genre)
  }
}

function toggleArtist(artist) {
  const idx = selectedArtists.value.findIndex(a => a.name === artist.name)
  if (idx >= 0) {
    selectedArtists.value.splice(idx, 1)
    showToast(`移除 ${artist.name}`)
  } else {
    selectedArtists.value.push(artist)
    showToast(`✓ 添加 ${artist.name}`)
  }
}

function handleComplete() {
  if (selectedArtists.value.length < 5) {
    showToast(`请至少选择 5 位音乐人，当前 ${selectedArtists.value.length} 位`)
    return
  }
  store.saveProfile({
    cities: selectedCities.value,
    genres: selectedGenres.value,
    artists: selectedArtists.value.map(a => a.name),
    hasCompleted: true
  })
  showToast('🎉 声纹构建完成！')
  setTimeout(() => router.push('/home'), 500)
}
</script>

<style scoped>
.questionnaire {
  background: var(--bg-app);
  min-height: 100%;
  padding-bottom: 140px;
}

/* 顶部栏 */
.q-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.2rem 0.5rem;
  position: sticky;
  top: 0;
  background: var(--bg-app);
  z-index: 10;
}

.back-btn {
  background: transparent;
  border: 1px solid #3a4050;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s;
}

.back-btn:active {
  border-color: var(--primary);
}

.q-badge {
  font-size: 0.78rem;
  background: var(--bg-item);
  padding: 0.2rem 0.8rem;
  border-radius: 20px;
  color: var(--text-secondary);
}

.artist-count {
  font-size: 0.75rem;
  color: var(--text-muted);
  transition: color 0.2s;
}

.artist-count.enough {
  color: var(--accent);
}

/* 进度条 */
.progress-bar {
  height: 3px;
  background: #1e2129;
  margin: 0.6rem 1.2rem 0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #FFB347, #FF6B6B);
  border-radius: 4px;
  transition: width 0.4s ease;
}

/* Section */
.section {
  padding: 1.2rem 1.2rem 0;
}

.section-header {
  margin-bottom: 0.9rem;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.section-desc {
  font-size: 0.72rem;
  color: var(--text-muted);
}

/* 分隔线 */
.divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, #252b36, transparent);
  margin: 1.2rem 1.2rem 0;
}

/* 定位中提示 */
.locating-hint {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.82rem;
  color: var(--text-muted);
  padding: 0.6rem 0;
}

.locating-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary);
  animation: pulse-dot 1.2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(0.6); }
}

/* 泡泡 */
.bubbles-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.bubble {
  background: var(--bg-item);
  border: 1px solid transparent;
  border-radius: 40px;
  padding: 0.45rem 1rem;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s ease;
  color: var(--text-secondary);
  user-select: none;
}

.bubble:active {
  transform: scale(0.94);
}

.bubble.selected {
  background: rgba(255, 107, 107, 0.15);
  border-color: rgba(255, 107, 107, 0.5);
  color: #ff9090;
  font-weight: 500;
}

/* 艺人卡片 */
.empty-artists {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--text-muted);
  font-size: 0.82rem;
  background: var(--bg-item);
  border-radius: 16px;
  border: 1px dashed #2a2f3a;
}

.artists-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.65rem;
}

.artist-card {
  background: var(--bg-item);
  border: 1px solid #2a2f3a;
  border-radius: 16px;
  padding: 0.85rem 0.5rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
  user-select: none;
}

.artist-card:active {
  transform: scale(0.96);
}

.artist-card.selected {
  background: rgba(255, 107, 107, 0.12);
  border-color: rgba(255, 107, 107, 0.45);
}

.artist-card .artist-name {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
}

.artist-card.selected .artist-name {
  color: #ffaaaa;
}

.artist-sub {
  font-size: 0.65rem;
  color: var(--text-muted);
  margin-top: 0.2rem;
}

.check-mark {
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 0.7rem;
  color: var(--primary);
  font-weight: 700;
}

/* 已选预览 */
.selected-preview {
  margin-top: 0.9rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.72rem;
}

.selected-preview.muted {
  color: var(--text-muted);
}

.preview-label {
  color: var(--text-muted);
}

.preview-tag {
  background: rgba(255, 107, 107, 0.15);
  border: 1px solid rgba(255, 107, 107, 0.3);
  color: #ff9090;
  padding: 0.2rem 0.6rem;
  border-radius: 20px;
  cursor: pointer;
  transition: background 0.1s;
}

.preview-tag:active {
  background: rgba(255, 107, 107, 0.3);
}

/* 底部 */
.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 390px;
  z-index: 100;
  padding: 1rem 1.2rem calc(1.2rem + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  background: rgba(10, 10, 10, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  box-sizing: border-box;
}
</style>
