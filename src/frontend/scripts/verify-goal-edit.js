import puppeteer from "puppeteer";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5173";

async function run() {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  let goalPayload = null;
  page.on("request", (req) => {
    if (req.url().includes("/api/users/goal") && req.method() === "PUT") {
      try {
        goalPayload = JSON.parse(req.postData() || "{}");
      } catch {
        goalPayload = { raw: req.postData() };
      }
    }
  });
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
    await sleep(1200);
    const ok = await page.evaluate(() => Boolean(localStorage.getItem("nm_token")));
    add("登录", ok, page.url());
  } catch (e) {
    add("登录", false, String(e));
  }

  try {
    await page.goto(`${BASE_URL}/profile`, { waitUntil: "domcontentloaded" });
    const clicked = await page.evaluate(() => {
      const title = Array.from(document.querySelectorAll("h3")).find((h) => h.textContent?.includes("健康目标"));
      const card = title?.closest("div.bg-white");
      const btn = card ? Array.from(card.querySelectorAll("button")).find((b) => b.textContent?.includes("修改")) : null;
      if (!btn) return false;
      btn.click();
      return true;
    });
    add("健康目标进入编辑态", clicked);

    if (!clicked) throw new Error("未找到健康目标修改按钮");
    await sleep(300);

    const hasInputs = await page.$$eval('input[placeholder="目标体重(kg)"], input[placeholder="周目标(kg/周)"]', (nodes) => nodes.length === 2);
    add("健康目标编辑输入框出现", hasInputs);

    await page.click('input[placeholder="目标体重(kg)"]', { clickCount: 3 });
    await page.type('input[placeholder="目标体重(kg)"]', "62");
    await page.click('input[placeholder="周目标(kg/周)"]', { clickCount: 3 });
    await page.type('input[placeholder="周目标(kg/周)"]', "0.6");
    await sleep(200);
    const weeklyInputValue = await page.$eval('input[placeholder="周目标(kg/周)"]', (el) => el.value);
    add("周目标输入值正确", weeklyInputValue === "0.6", weeklyInputValue);

    const saved = await page.evaluate(() => {
      const title = Array.from(document.querySelectorAll("h3")).find((h) => h.textContent?.includes("健康目标"));
      const card = title?.closest("div.bg-white");
      const btn = card ? Array.from(card.querySelectorAll("button")).find((b) => b.textContent?.includes("保存")) : null;
      if (!btn) return false;
      btn.click();
      return true;
    });
    await sleep(800);
    add("健康目标保存动作触发", saved);
    add("健康目标请求参数正确", Boolean(goalPayload && Math.abs((goalPayload.weekly_target || 0) - 0.6) < 0.01), JSON.stringify(goalPayload || {}));

    const persisted = await page.evaluate(async () => {
      const token = localStorage.getItem("nm_token");
      if (!token) return false;
      const res = await fetch("http://127.0.0.1:8000/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return false;
      const data = await res.json();
      return Math.abs((data.target_weight || 0) - 62) < 0.01 && Math.abs((data.weekly_target || 0) - 0.6) < 0.01;
    });
    add("健康目标保存后后端数据更新", persisted);
  } catch (e) {
    add("健康目标修改流程", false, String(e));
  }

  await browser.close();
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

run();
