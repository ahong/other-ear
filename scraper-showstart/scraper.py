# 厦门演出抓取：100条数据+JSON存储（hangzhou.json）+2026全年
import time
import json
from playwright.sync_api import sync_playwright, Locator

# 强制导入验证
try:
    from playwright.sync_api import sync_playwright
    print("✅ Playwright导入成功")
except Exception as e:
    print(f"❌ Playwright导入失败：{e}")
    exit()

# 配置项（厦门100条+2026全年+hangzhou.json命名）
CONFIG = {
    "target_url": "https://www.showstart.com/event/list?pageNo=1&pageSize=100&cityCode=571&timeRange=2026-01-01_2026-12-31",
    "chromium_path": "/Users/ahong/Library/Caches/ms-playwright/chromium-1117/chrome-mac/Chromium.app/Contents/MacOS/Chromium",
    "sleep_time": 8,
    "json_path": "hangzhou.json"  # 按城市名命名JSON文件
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

def extract_event_id(href: str) -> str:
    """从href中提取演出ID，如/event/290021 → 290021"""
    if not href:
        return ""
    # 截取/event/后的数字部分（兼容带参数的href）
    if "/event/" in href:
        id_part = href.split("/event/")[-1].split("?")[0]
        return id_part if id_part.isdigit() else ""
    return ""

def main():
    print("🔍 启动秀动爬虫（厦门100条数据+2026全年+hangzhou.json版）")
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

    # 步骤3：访问厦门演出页面（2026全年）
    try:
        page = browser.new_page(viewport={"width": 1920, "height": 1080})
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        page.goto(CONFIG["target_url"], wait_until="networkidle", timeout=120000)
        print("✅ 步骤3：厦门2026全年演出页面访问成功")
        print(f"ℹ️  等待{CONFIG['sleep_time']}秒，确保演出数据加载...")
        time.sleep(CONFIG["sleep_time"])

        # 滚动页面触发懒加载（确保100条数据全部加载）
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(3)
        page.evaluate("window.scrollTo(0, 0)")
        time.sleep(2)
        print("✅ 页面滚动完成，所有演出链接已加载")
    except Exception as e:
        print(f"❌ 步骤3失败：{str(e)[:100]}")
        if page: page.close()
        if browser: browser.close()
        pw.stop()
        return

    # 步骤4：精准提取100条演出数据
    try:
        print("✅ 步骤4：开始提取厦门演出数据（100条）")
        # 定位核心演出链接
        performance_links = page.locator("a.show-item.item").all()
        link_count = len(performance_links)
        print(f"✅ 匹配到 {link_count} 个演出链接（class=show-item item）")

        if link_count == 0:
            performance_links = page.locator("a[class*='show-item'][class*='item']").all()
            link_count = len(performance_links)
            print(f"⚠️  兜底定位匹配到 {link_count} 个链接")

        # 遍历提取指定字段（目标100条）
        for idx, link in enumerate(performance_links, 1):
            # 基础字段初始化
            event_data = {
                "event_id": "",          # 演出ID
                "cover_image": "",       # 演出封面图
                "title": "",             # 演出标题
                "artist": "",            # 艺人
                "price": "",             # 价格
                "time": "",              # 演出时间
                "address": "",           # 演出地点
                "event_url": ""          # 演出链接（备用）
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
            # 5. 艺人（div.artist）
            event_data["artist"] = safe_get_text(link.locator("div.artist"))
            # 6. 价格（div.price下的span）
            event_data["price"] = safe_get_text(link.locator("div.price > span"))
            # 7. 时间（div.time）
            event_data["time"] = safe_get_text(link.locator("div.time"))
            # 8. 演出地点（div.addr）
            event_data["address"] = safe_get_text(link.locator("div.addr"))

            # 过滤有效数据：至少有ID+标题
            if event_data["event_id"] and event_data["title"]:
                performances.append(event_data)
                print(f"✅ [{idx}/{link_count}] ID:{event_data['event_id']} | {event_data['title'][:20]}... | {event_data['price']}")
            else:
                print(f"⚠️ [{idx}/{link_count}] 过滤无效数据（ID/标题缺失）")

            # 仅保留前100条，符合需求
            if len(performances) >= 100:
                print("✅ 已提取100条数据，停止遍历")
                break

        # 去重（按event_id，确保数据唯一性）
        unique_performances = []
        seen_ids = set()
        for perf in performances:
            if perf["event_id"] not in seen_ids and perf["event_id"]:
                seen_ids.add(perf["event_id"])
                unique_performances.append(perf)
        # 强制保留前100条
        final_performances = unique_performances[:100]
        print(f"✅ 步骤4完成：共提取 {len(final_performances)} 条厦门演出数据（已去重）")

    except Exception as e:
        print(f"❌ 步骤4失败：{str(e)[:100]}")
        import traceback
        traceback.print_exc()
        final_performances = []

    # 步骤5：关闭资源
    try:
        if page: page.close()
        if browser: browser.close()
        if pw: pw.stop()
        print("✅ 步骤5：所有资源已关闭")
    except Exception as e:
        print(f"⚠️  步骤5警告：{str(e)[:50]}")

    # 步骤6：保存为hangzhou.json（JSON数组格式）
    try:
        print("✅ 步骤6：保存为hangzhou.json文件...")
        # 确保数据为JSON数组格式
        json_data = final_performances if final_performances else []
        
        # 写入JSON文件（格式化输出，编码UTF-8）
        with open(CONFIG["json_path"], "w", encoding="utf-8") as f:
            json.dump(json_data, f, ensure_ascii=False, indent=4)
        
        print(f"✅ JSON文件保存成功：{CONFIG['json_path']}")
        print(f"📊 最终保存 {len(json_data)} 条2026年厦门演出数据（JSON数组格式）")

        # 打印前2条数据预览
        if json_data:
            print("\n📝 前2条数据预览：")
            for i, item in enumerate(json_data[:2]):
                print(f"{i+1}. ID:{item['event_id']} | 标题:{item['title']} | 艺人:{item['artist']} | 价格:{item['price']}")

    except Exception as e:
        print(f"❌ JSON保存失败：{str(e)[:100]}")
        # 兜底：打印所有数据到终端
        print("\n📝 终端打印所有有效数据：")
        for idx, item in enumerate(final_performances, 1):
            print(f"{idx}. ID:{item['event_id']} | 标题:{item['title']} | 艺人:{item['artist']} | 价格:{item['price']} | 地点:{item['address']}")

    print("================================")
    print("🔚 程序执行完毕（厦门100条JSON版）")

if __name__ == "__main__":
    main()