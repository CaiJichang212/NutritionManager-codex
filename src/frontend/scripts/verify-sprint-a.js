import puppeteer from "puppeteer";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5173";

async function run() {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
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
    await page.goto(`${BASE_URL}/profile`, { waitUntil: "domcontentloaded" });
    const hasHealthCard = await page.evaluate(() => document.body.innerText.includes("健康信息"));
    add("健康信息模块可见", hasHealthCard);

    const clicked = await page.evaluate(() => {
      const healthTitle = Array.from(document.querySelectorAll("h3")).find((h) => h.textContent?.includes("健康信息"));
      const container = healthTitle?.closest("div.bg-white");
      const btn = container ? Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("修改")) : null;
      if (btn) {
        (btn).click();
        return true;
      }
      return false;
    });
    if (clicked) {
      await sleep(300);
      const hasSave = await page.evaluate(() =>
        Array.from(document.querySelectorAll("button")).some((b) => b.textContent?.includes("保存")),
      );
      add("健康信息可编辑", hasSave);
    } else {
      add("健康信息可编辑", false, "未找到修改按钮");
    }
  } catch (e) {
    add("健康信息编辑", false, String(e));
  }

  try {
    await page.goto(`${BASE_URL}/profile`, { waitUntil: "domcontentloaded" });
    const opened = await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll("div"))
        .find((d) => d.className?.toString().includes("cursor-pointer") && d.textContent?.includes("账户安全"));
      if (row) {
        (row).click();
        return true;
      }
      return false;
    });
    if (opened) {
      await sleep(400);
      const hasBind = await page.$('input[placeholder="手机号"]');
      const hasPwd = await page.$('input[placeholder="旧密码"]');
      add("账户安全面板", Boolean(hasBind) && Boolean(hasPwd));
    } else {
      add("账户安全面板", false, "未找到账户安全入口");
    }
  } catch (e) {
    add("账户安全面板", false, String(e));
  }

  await browser.close();
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

run();
