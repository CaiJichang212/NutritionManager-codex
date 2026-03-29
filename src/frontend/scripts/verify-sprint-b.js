import puppeteer from "puppeteer";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5173";

async function run() {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  const clickButtonByText = async (text) => {
    return await page.evaluate((t) => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes(t));
      if (!btn) return false;
      (btn).click();
      return true;
    }, text);
  };
  const results = [];
  const add = (name, ok, detail = "") => {
    results.push({ name, ok, detail });
    console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` - ${detail}` : ""}`);
  };

  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.click('input[type="tel"]', { clickCount: 3 });
    await page.type('input[type="tel"]', "13800000000");
    await page.click('input[placeholder="请输入验证码"]', { clickCount: 3 });
    await page.type('input[placeholder="请输入验证码"]', "1234");
    await page.click("button.w-full.mt-6");
    await sleep(1500);
    const token = await page.evaluate(() => localStorage.getItem("nm_token"));
    add("登录", Boolean(token), page.url());
  } catch (e) {
    add("登录", false, String(e));
  }

  try {
    await page.goto(`${BASE_URL}/record`, { waitUntil: "domcontentloaded" });
    await clickButtonByText("搜索");
    await page.click('[data-testid="food-search-input"]', { clickCount: 3 });
    await page.type('[data-testid="food-search-input"]', "鸡胸肉");
    await sleep(700);
    const row = await page.$('[data-testid^="food-result-"]');
    if (row) {
      await row.click();
      const addBtn = await page.$('[data-testid="add-food-button"]');
      if (addBtn) {
        await addBtn.click();
        await sleep(600);
      }
    }
    add("准备历史数据（添加记录）", Boolean(row));
  } catch (e) {
    add("准备历史数据（添加记录）", false, String(e));
  }

  try {
    await page.goto(`${BASE_URL}/record`, { waitUntil: "domcontentloaded" });
    await clickButtonByText("历史");
    await sleep(800);
    const hasDate = await page.$('input[type="date"]');
    const hasCopy = await page.$('button');
    const hasSave = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button")).some((b) => b.textContent?.includes("保存")),
    );
    const hasDelete = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button")).some((b) => b.textContent?.includes("删除")),
    );
    add("历史页日期回放控件", Boolean(hasDate));
    add("历史页记录编辑入口（保存）", hasSave);
    add("历史页删除入口", hasDelete);
    add("历史页复制到今天入口", await page.evaluate(() =>
      Array.from(document.querySelectorAll("button")).some((b) => b.textContent?.includes("复制到今天")),
    ));
  } catch (e) {
    add("历史页能力验证", false, String(e));
  }

  await browser.close();
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

run();
