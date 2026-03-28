import beijing from './city/beijing.json'
import shanghai from './city/shanghai.json'
import guangzhou from './city/guangzhou.json'
import shenzhen from './city/shenzhen.json'
import hangzhou from './city/hangzhou.json'
import xiamen from './city/xiamen.json'
import fuzhou from './city/fuzhou.json'
import quanzhou from './city/quanzhou.json'
import putian from './city/putian.json'

// 艺人维度演出数据
import artistErshoulMeigui from './artists/二手玫瑰.json'
import artistFazi from './artists/法兹乐队.json'
import artistShengYinWanju from './artists/声音玩具.json'
import artistTongYang from './artists/痛仰.json'
import artistWannengQingnian from './artists/万能青年旅店.json'
import artistXiaoHe from './artists/小河.json'
import artistXinkuzi from './artists/新裤子.json'
import artistDecaJoins from './artists/deca joins.json'

// 城市名 → 数据映射（与爬虫文件对应）
const CITY_DATA_MAP = {
  '北京': beijing,
  '上海': shanghai,
  '广州': guangzhou,
  '深圳': shenzhen,
  '杭州': hangzhou,
  '厦门': xiamen,
  '福州': fuzhou,
  '泉州': quanzhou,
  '莆田': putian,
}

// 从 venue 字段提取城市名（格式："城市名 场馆名"）
function extractCityFromVenue(venue) {
  if (!venue) return ''
  const spaceIdx = venue.indexOf(' ')
  return spaceIdx > 0 ? venue.slice(0, spaceIdx) : venue
}

// 城市维度：注入 city 字段
const cityShows = Object.entries(CITY_DATA_MAP).flatMap(([city, list]) =>
  list.map(show => ({ ...show, city }))
)

// 艺人维度：从 venue 提取 city
const ARTIST_DATA_LIST = [
  artistErshoulMeigui,
  artistFazi,
  artistShengYinWanju,
  artistTongYang,
  artistWannengQingnian,
  artistXiaoHe,
  artistXinkuzi,
  artistDecaJoins,
]

const artistShows = ARTIST_DATA_LIST.flat().map(show => ({
  ...show,
  city: extractCityFromVenue(show.venue),
}))

// 合并 + 全局去重
// 优先用 event_id；无 id 时用 title+time+venue 兜底
const seenIds = new Set()
const seenFallback = new Set()

const allShowsRaw = [...cityShows, ...artistShows]
export const allShows = allShowsRaw.filter(show => {
  if (show.event_id) {
    if (seenIds.has(show.event_id)) return false
    seenIds.add(show.event_id)
    return true
  }
  // 兜底去重
  const key = `${show.title}|${show.time}|${show.venue}`
  if (seenFallback.has(key)) return false
  seenFallback.add(key)
  return true
})

// 从全量去重数据中提取所有不重复风格（按出现频率排序）
const styleCount = {}
allShows.forEach(show => {
  (show.styles || []).forEach(s => {
    styleCount[s] = (styleCount[s] || 0) + 1
  })
})
export const ALL_STYLES = Object.entries(styleCount)
  .sort((a, b) => b[1] - a[1])
  .map(([s]) => s)

// 从全量去重数据中提取所有不重复艺人（按出现频率排序）
const artistCount = {}
allShows.forEach(show => {
  if (show.artist) {
    artistCount[show.artist] = (artistCount[show.artist] || 0) + 1
  }
})
export const ALL_ARTISTS = Object.entries(artistCount)
  .sort((a, b) => b[1] - a[1])
  .map(([name]) => name)

// 爬虫覆盖的城市列表
export const SCRAPED_CITIES = Object.keys(CITY_DATA_MAP)
