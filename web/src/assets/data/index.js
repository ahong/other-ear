import beijing from './beijing.json'
import shanghai from './shanghai.json'
import guangzhou from './guangzhou.json'
import shenzhen from './shenzhen.json'
import hangzhou from './hangzhou.json'
import xiamen from './xiamen.json'
import fuzhou from './fuzhou.json'
import quanzhou from './quanzhou.json'
import putian from './putian.json'

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

// 所有演出平铺，并注入 city 字段（从 venue 字段中提取城市名）
export const allShows = Object.entries(CITY_DATA_MAP).flatMap(([city, list]) =>
  list.map(show => ({ ...show, city }))
)

// 从真实数据中提取所有不重复风格（过滤掉空值，按出现频率排序）
const styleCount = {}
allShows.forEach(show => {
  (show.styles || []).forEach(s => {
    styleCount[s] = (styleCount[s] || 0) + 1
  })
})
export const ALL_STYLES = Object.entries(styleCount)
  .sort((a, b) => b[1] - a[1])
  .map(([s]) => s)

// 从真实数据中提取所有不重复艺人（过滤掉空值，按出现频率排序）
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
