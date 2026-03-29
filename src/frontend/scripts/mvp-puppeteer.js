import puppeteer from "puppeteer";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

async function run() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  page.on("console", (msg) => {
    const text = msg.text();
    if (text) {
      console.log(`[CONSOLE] ${text}`);
    }
  });
  page.on("pageerror", (err) => {
    console.log(`[PAGEERROR] ${err.message}`);
  });
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("login")) {
      console.log(`[REQ] ${url}`);
    }
  });
  page.on("response", (res) => {
    const url = res.url();
    if (url.includes("login")) {
      console.log(`[RES] ${res.status()} ${url}`);
    }
  });

  const results = [];
  const record = (name, ok, detail = "") => {
    results.push({ name, ok, detail });
    const status = ok ? "PASS" : "FAIL";
    console.log(`[${status}] ${name}${detail ? ` - ${detail}` : ""}`);
  };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const clickByText = async (tag, text) => {
    await page.waitForFunction(
      (t, s) => Array.from(document.querySelectorAll(t)).some((el) => el.textContent && el.textContent.includes(s)),
      { timeout: 10000 },
      tag,
      text,
    );
    await page.evaluate(
      (t, s) => {
        const el = Array.from(document.querySelectorAll(t)).find((node) => node.textContent && node.textContent.includes(s));
        if (el) (el).click();
      },
      tag,
      text,
    );
  };
  const waitText = async (text) => {
    await page.waitForFunction(
      (s) => document.body && document.body.innerText.includes(s),
      { timeout: 10000 },
      text,
    );
  };

  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
    await page.waitForSelector('input[type="tel"]');
    await page.click('input[type="tel"]', { clickCount: 3 });
    await page.type('input[type="tel"]', "13800000000");
    await page.click('input[placeholder="请输入验证码"]', { clickCount: 3 });
    await page.type('input[placeholder="请输入验证码"]', "1234");
    await page.waitForSelector("button.w-full.mt-6");
    const btnText = await page.evaluate(() => {
      const btn = document.querySelector("button.w-full.mt-6");
      return btn ? btn.textContent : "";
    });
    console.log(`[INFO] 登录按钮文本: ${btnText || "N/A"}`);
    await page.click("button.w-full.mt-6");
    await sleep(1500);
    const hasDashboard = await page.evaluate(() => document.body && document.body.innerText.includes("今日热量"));
    const hasError = await page.evaluate(() => document.body && document.body.innerText.includes("登录失败"));
    const currentUrl = page.url();
    const token = await page.evaluate(() => localStorage.getItem("nm_token"));
    if (hasDashboard) {
      record("登录并进入首页", true);
    } else if (hasError) {
      await page.screenshot({ path: "mvp-login-fail.png", fullPage: true });
      record("登录并进入首页", false, `登录失败提示出现 (${currentUrl})`);
    } else if (token) {
      record("登录获取Token", true, "已拿到Token但未自动跳转");
    } else {
      await page.screenshot({ path: "mvp-login-unknown.png", fullPage: true });
      record("登录并进入首页", false, `未进入首页 (${currentUrl})`);
    }

    const res = await fetch("http://127.0.0.1:8000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "13800000000", code: "1234" }),
    });
    const data = await res.json();
    if (data?.access_token) {
      await page.evaluate((t) => localStorage.setItem("nm_token", t), data.access_token);
    }
  } catch (err) {
    record("登录并进入首页", false, err.message || String(err));
  }

  try {
    await page.goto(`${BASE_URL}/record`, { waitUntil: "domcontentloaded" });
    const snapshot = await page.evaluate(() => document.body?.innerText?.slice(0, 120) || "");
    console.log(`[INFO] /record 页面摘要: ${snapshot.replace(/\n+/g, " ")}`);
    await page.waitForSelector('input[placeholder="搜索食物名称、品牌..."]');
    await page.click('input[placeholder="搜索食物名称、品牌..."]', { clickCount: 3 });
    await page.type('input[placeholder="搜索食物名称、品牌..."]', "鸡胸肉");
    await sleep(800);
    await clickByText("div", "鸡胸肉");
    await waitText("食物详情");
    await clickByText("button", "添加到");
    await sleep(500);
    record("搜索食物并添加记录", true);
  } catch (err) {
    record("搜索食物并添加记录", false, err.message || String(err));
  }

  try {
    await page.goto(`${BASE_URL}/nutrition`, { waitUntil: "domcontentloaded" });
    await waitText("营养数据中心");
    await waitText("健康评估");
    record("营养页展示健康评估", true);
  } catch (err) {
    record("营养页展示健康评估", false, err.message || String(err));
  }

  try {
    await page.goto(`${BASE_URL}/profile`, { waitUntil: "domcontentloaded" });
    await waitText("个人中心");
    await waitText("身体数据");
    record("个人中心加载", true);
  } catch (err) {
    record("个人中心加载", false, err.message || String(err));
  }

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

run();
