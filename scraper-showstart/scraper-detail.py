# 上海演出抓取：100条+详情页信息+字段清洗+JSON存储（上海.json）
import time
import json
import re
from playwright.sync_api import sync_playwright, Locator, Page

# 强制导入验证
try:
    from playwright.sync_api import sync_playwright
    print("✅ Playwright导入成功")
except Exception as e:
    print(f"❌ Playwright导入失败：{e}")
    exit()

# 配置项（上海100条+2026全年+上海.json命名）
CONFIG = {
    "list_url": "https://www.showstart.com/event/list?pageNo=1&pageSize=100&cityCode=21&timeRange=2026-01-01_2026-12-31",
    "chromium_path": "/Users/ahong/Library/Caches/ms-playwright/chromium-1117/chrome-mac/Chromium.app/Contents/MacOS/Chromium",
    "sleep_time": 8,
    "detail_sleep": 3,  # 详情页加载等待时间
    "json_path": "上海.json"  # 上海专属JSON文件名
}

# 存储最终演出数据
performances = []

def safe_get_text(locator: Locator) -> str:
    """安全获取文本，空值返回空字符串"""
    try:
        text = locator.text_content().strip()
        return text if text else ""
    except:
        return ""

def safe_get_html(locator: Locator) -> str:
    """安全获取元素HTML，空值返回空字符串"""
    try:
        html = locator.inner_html().strip()
        return html if html else ""
    except:
        return ""

def extract_event_id(href: str) -> str:
    """从href中提取演出ID，如/event/290021 → 290021"""
    if not href:
        return ""
    # 截取/event/后的数字部分（兼容带参数的href）
    if "/event/" in href:
        id_part = href.split("/event/")[-1].split("?")[0]
        return id_part if id_part.isdigit() else ""
    return ""

def clean_text(text: str, prefix_words: list, remove_suffix: str = "") -> str:
    """
    文本清洗通用函数：
    1. 去除前缀文字+冒号（支持多个前缀）
    2. 去除指定后缀
    3. 去除前后空格
    """
    if not text:
        return ""
    
    # 打印清洗前后对比（方便验证）
    original_text = text
    
    # 1. 去除前缀文字+中文/英文冒号（优先匹配最长前缀）
    prefix_words_sorted = sorted(prefix_words, key=len, reverse=True)
    cleaned_text = text
    for prefix in prefix_words_sorted:
        # 匹配中文冒号「：」和英文冒号「:」
        pattern = re.compile(rf"^{re.escape(prefix)}[:：]", re.UNICODE)
        cleaned_text = pattern.sub("", cleaned_text)
    
    # 2. 去除指定后缀
    if remove_suffix and cleaned_text.endswith(remove_suffix):
        cleaned_text = cleaned_text[:-len(remove_suffix)]
    
    # 3. 去除前后空格
    cleaned_text = cleaned_text.strip()
    
    # 日志输出清洗结果（关键！方便验证）
    if original_text != cleaned_text:
        print(f"🔧 文本清洗：[{original_text}] → [{cleaned_text}]")
    
    return cleaned_text

def extract_value_by_key(text: str, key: str, remove_suffix: str = "") -> str:
    """
    从文本中提取关键词后的内容（兼容中英冒号）
    :param text: 原始文本（如"演出时间：2026-04-15"）
    :param key: 关键词（如"演出时间"）
    :param remove_suffix: 需要去除的后缀文字（如"查看地图"）
    :return: 冒号后的内容（空字符串如果未匹配）
    """
    if not text or not key:
        return ""
    
    # 匹配关键词+中文/英文冒号，提取后面的内容
    pattern = re.compile(rf"{re.escape(key)}[:：](.*)", re.UNICODE | re.DOTALL)
    match = pattern.search(text)
    if match:
        # 提取后去除前后空格
        value = match.group(1).strip()
        # 去除指定后缀
        if remove_suffix and value.endswith(remove_suffix):
            value = value[:-len(remove_suffix)].strip()
        print(f"🔍 关键词匹配：[{key}] → [{value}]")
        return value
    return ""

def get_detail_info(page: Page, event_id: str) -> dict:
    """进入详情页提取信息（按关键词匹配p元素+新增风格标签）"""
    detail_info = {
        "detail_time": "",    # 详情页演出时间（匹配含"演出时间"的p）
        "artist": "",         # 艺人（匹配含"艺人"的p）
        "venue": "",          # 场地（匹配含"场地"的p）
        "address": "",        # 地址（匹配含"地址"的p，去除"查看地图"后缀）
        "styles": [],         # 演出风格标签（div.label下的label数组）
        "content_html": ""    # 演出详情HTML（div.content）
    }
    try:
        # 构建详情页URL
        detail_url = f"https://www.showstart.com/event/{event_id}"
        print(f"ℹ️  访问详情页：{detail_url}")
        
        # 访问详情页
        page.goto(detail_url, wait_until="networkidle", timeout=120000)
        time.sleep(CONFIG["detail_sleep"])
        
        # ========== 1. 提取div.describe下的p元素（按关键词匹配） ==========
        describe_div = page.locator(".describe")
        if describe_div.count() > 0:
            # 获取所有p元素
            describe_ps = describe_div.locator("p").all()
            for p in describe_ps:
                p_text = safe_get_text(p)
                if not p_text:
                    continue
                
                # 匹配演出时间（关键词：演出时间）
                if not detail_info["detail_time"]:
                    detail_info["detail_time"] = extract_value_by_key(p_text, "演出时间")
                # 匹配艺人（关键词：艺人）
                if not detail_info["artist"]:
                    detail_info["artist"] = extract_value_by_key(p_text, "艺人")
                # 匹配场地（关键词：场地）
                if not detail_info["venue"]:
                    detail_info["venue"] = extract_value_by_key(p_text, "场地")
                # 匹配地址（关键词：地址，去除"查看地图"后缀）
                if not detail_info["address"]:
                    detail_info["address"] = extract_value_by_key(p_text, "地址", "查看地图")
        
        # ========== 2. 提取演出风格标签（div.label下的label数组） ==========
        label_div = page.locator(".describe div.label")  # 定位div.label
        if label_div.count() > 0:
            # 获取所有label标签
            label_elements = label_div.locator("label").all()
            styles = []
            for label in label_elements:
                label_text = safe_get_text(label)
                if label_text:
                    styles.append(label_text)
            detail_info["styles"] = styles
            print(f"🎭 演出风格：ID={event_id} → {styles}")
        
        # ========== 3. 提取演出详情HTML ==========
        detail_info["content_html"] = safe_get_html(page.locator("div.content"))
        
        # 日志输出提取结果
        print(f"✅ 详情页提取完成：ID={event_id} | 时间={detail_info['detail_time'][:20]} | 艺人={detail_info['artist'][:10]} | 场地={detail_info['venue'][:10]} | 地址={detail_info['address'][:10]} | 风格数量={len(detail_info['styles'])}")
    
    except Exception as e:
        print(f"❌ 详情页提取失败：ID={event_id} | 错误={str(e)[:50]}")
        # 异常时返回空值，不影响主数据
        detail_info["styles"] = []
    
    return detail_info

def main():
    print("🔍 启动秀动爬虫（上海100条+详情页+地址去查看地图版）")
    print("================================")
    pw, browser, page = None, None, None

    # 步骤1：初始化Playwright
    try:
        pw = sync_playwright().start()
        print("✅ 步骤1：Playwright初始化成功")
    except Exception as e:
        print(f"❌ 步骤1失败：{str(e)[:100]}")
        return

    # 步骤2：启动浏览器
    try:
        browser = pw.chromium.launch(
            executable_path=CONFIG["chromium_path"],
            headless=False,
            args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
        )
        print("✅ 步骤2：Chromium浏览器启动成功")
    except Exception as e:
        print(f"❌ 步骤2失败：{str(e)[:100]}")
        pw.stop()
        return

    # 步骤3：创建页面对象（复用页面访问列表+详情页）
    try:
        page = browser.new_page(viewport={"width": 1920, "height": 1080})
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    except Exception as e:
        print(f"❌ 页面创建失败：{str(e)[:100]}")
        browser.close()
        pw.stop()
        return

    # 步骤4：访问演出列表页（上海2026全年）
    try:
        page.goto(CONFIG["list_url"], wait_until="networkidle", timeout=120000)
        print("✅ 步骤4：上海2026全年演出列表访问成功")
        print(f"ℹ️  等待{CONFIG['sleep_time']}秒，确保演出数据加载...")
        time.sleep(CONFIG["sleep_time"])

        # 滚动页面触发懒加载（确保100条数据全部加载）
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(3)
        page.evaluate("window.scrollTo(0, 0)")
        time.sleep(2)
        print("✅ 页面滚动完成，所有演出链接已加载")
    except Exception as e:
        print(f"❌ 步骤4失败：{str(e)[:100]}")
        page.close()
        browser.close()
        pw.stop()
        return

    # 步骤5：提取列表页基础数据（含字段清洗）
    try:
        print("✅ 步骤5：开始提取列表页演出数据（100条）")
        # 定位核心演出链接
        performance_links = page.locator("a.show-item.item").all()
        link_count = len(performance_links)
        print(f"✅ 匹配到 {link_count} 个演出链接（class=show-item item）")

        if link_count == 0:
            performance_links = page.locator("a[class*='show-item'][class*='item']").all()
            link_count = len(performance_links)
            print(f"⚠️  兜底定位匹配到 {link_count} 个链接")

        # 遍历提取列表页基础字段
        base_performances = []
        for idx, link in enumerate(performance_links, 1):
            # 基础字段初始化
            event_data = {
                "event_id": "",          # 演出ID
                "cover_image": "",       # 演出封面图
                "title": "",             # 演出标题
                "artist": "",            # 艺人（列表页，后续替换）
                "price": "",             # 价格
                "time": "",              # 列表页演出时间（保留）
                "address": "",           # 演出地点（列表页，后续替换）
                "event_url": ""          # 演出链接
            }

            # 1. 提取演出ID（从href截取）
            href = link.get_attribute("href") or ""
            event_data["event_id"] = extract_event_id(href)
            # 2. 演出链接（完整URL）
            event_data["event_url"] = f"https://www.showstart.com{href}" if href.startswith('/') else href or ""
            # 3. 演出封面图（img.el-image__inner的src属性）
            cover_img = link.locator("img.el-image__inner")
            event_data["cover_image"] = cover_img.get_attribute("src") or ""
            # 4. 演出标题（div.title）
            event_data["title"] = safe_get_text(link.locator("div.title"))
            # 5. 艺人（列表页）- 清洗：去除"艺人" + 冒号 + 前后空格
            artist_raw = safe_get_text(link.locator("div.artist"))
            event_data["artist"] = clean_text(artist_raw, ["艺人"])
            # 6. 价格（div.price下的span）
            event_data["price"] = safe_get_text(link.locator("div.price > span"))
            # 7. 列表页时间 - 清洗：去除"时间" + 冒号 + 前后空格
            time_raw = safe_get_text(link.locator("div.time"))
            event_data["time"] = clean_text(time_raw, ["时间"])
            # 8. 列表页地址 - 清洗：去除"地址" + 冒号 + "查看地图" + 前后空格
            address_raw = safe_get_text(link.locator("div.addr"))
            event_data["address"] = clean_text(address_raw, ["地址"], "查看地图")

            # 过滤有效数据：至少有ID+标题
            if event_data["event_id"] and event_data["title"]:
                base_performances.append(event_data)
                print(f"✅ 列表页提取：[{idx}/{link_count}] ID:{event_data['event_id']} | {event_data['title'][:20]}")
            else:
                print(f"⚠️ 列表页过滤：[{idx}/{link_count}] ID/标题缺失")

            # 仅保留前100条，符合需求
            if len(base_performances) >= 100:
                print("✅ 列表页已提取100条数据，停止遍历")
                break

    except Exception as e:
        print(f"❌ 步骤5失败：{str(e)[:100]}")
        import traceback
        traceback.print_exc()
        base_performances = []

    # 步骤6：遍历基础数据，访问详情页补充信息
    try:
        print("\n✅ 步骤6：开始访问详情页提取更多信息...")
        final_performances = []
        seen_ids = set()
        
        for idx, base_data in enumerate(base_performances, 1):
            event_id = base_data["event_id"]
            
            # 去重（按event_id）
            if event_id in seen_ids or not event_id:
                continue
            seen_ids.add(event_id)
            
            # 访问详情页获取信息（按关键词匹配+新增风格）
            detail_info = get_detail_info(page, event_id)
            
            # 合并数据：优先使用详情页字段，缺失则保留列表页
            merged_data = {
                # 列表页基础字段（保留）
                "event_id": event_id,
                "cover_image": base_data["cover_image"],
                "title": base_data["title"],
                "price": base_data["price"],
                "time": base_data["time"],  # 列表页时间（保留）
                "event_url": base_data["event_url"],
                
                # 详情页字段（优先使用，缺失则用列表页）
                "artist": detail_info["artist"] or base_data["artist"],  # 艺人（详情页替换）
                "address": detail_info["address"] or base_data["address"],  # 地址（详情页替换）
                "detail_time": detail_info["detail_time"],  # 详情页时间（新增）
                "venue": detail_info["venue"],  # 场地（新增）
                "styles": detail_info["styles"],  # 演出风格标签数组（新增）
                "content_html": detail_info["content_html"]  # 演出详情HTML
            }
            
            final_performances.append(merged_data)
            
            # 限制100条
            if len(final_performances) >= 100:
                print("✅ 已提取100条含详情的演出数据，停止详情页访问")
                break
        
        print(f"✅ 步骤6完成：共提取 {len(final_performances)} 条含详情的演出数据（已去重）")

    except Exception as e:
        print(f"❌ 步骤6失败：{str(e)[:100]}")
        import traceback
        traceback.print_exc()
        final_performances = []

    # 步骤7：关闭资源
    try:
        page.close()
        browser.close()
        pw.stop()
        print("✅ 步骤7：所有浏览器资源已关闭")
    except Exception as e:
        print(f"⚠️  步骤7警告：{str(e)[:50]}")

    # 步骤8：保存为上海.json（JSON数组格式）
    try:
        print("\n✅ 步骤8：保存为上海.json文件...")
        # 确保数据为JSON数组格式
        json_data = final_performances if final_performances else []
        
        # 写入JSON文件（格式化输出，编码UTF-8）
        with open(CONFIG["json_path"], "w", encoding="utf-8") as f:
            json.dump(json_data, f, ensure_ascii=False, indent=4)
        
        print(f"✅ JSON文件保存成功：{CONFIG['json_path']}")
        print(f"📊 最终保存 {len(json_data)} 条2026年上海演出数据（含详情+风格标签）")

        # 打印前1条数据预览（简化版）
        if json_data:
            print("\n📝 第一条数据预览（关键字段）：")
            first = json_data[0]
            print(f"ID:{first['event_id']} | 标题:{first['title']}")
            print(f"列表页时间:{first['time']} | 详情页时间:{first['detail_time'][:20]}")
            print(f"艺人:{first['artist'][:10]} | 场地:{first['venue'][:10]} | 地址:{first['address'][:10]}")
            print(f"演出风格:{first['styles']}")

    except Exception as e:
        print(f"❌ JSON保存失败：{str(e)[:100]}")
        # 兜底：打印前10条关键数据到终端
        print("\n📝 终端打印前10条关键数据：")
        for idx, item in enumerate(final_performances[:10], 1):
            print(f"{idx}. ID:{item['event_id']} | 标题:{item['title'][:20]} | 艺人:{item['artist'][:10]} | 地址:{item['address'][:10]} | 风格:{item['styles']}")

    print("================================")
    print("🔚 程序执行完毕（上海100条+详情页+地址去查看地图版）")

if __name__ == "__main__":
    main()