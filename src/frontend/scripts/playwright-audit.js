import { chromium } from "playwright";

async function isVisible(page, selector) {
  try {
    return await page.locator(selector).first().isVisible();
  } catch {
    return false;
  }
}

async function run() {
  const base = process.env.BASE_URL || "http://127.0.0.1:5173";
  const results = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const push = (module, item, status, evidence = "") => {
    results.push({ module, item, status, evidence });
  };

  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="tel"]', "13800000000");
  await page.fill('input[placeholder="请输入验证码"]', "1234");
  await page.click("button.w-full.mt-6");
  await page.waitForTimeout(1200);
  push("用户系统", "手机号验证码登录", page.url().includes("/login") ? "fail" : "pass", page.url());

  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.removeItem("nm_token"));

  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await page.click('button:has-text("立即注册")');
  await page.click("button.w-full.mt-6");
  const step1Visible = await isVisible(page, "text=完善基本信息");
  if (step1Visible) {
    await page.click('button:has-text("下一步")');
  }
  const step2Visible = await isVisible(page, "text=设置健康目标");
  push(
    "用户系统",
    "注册两步流程（基本信息+目标设置）",
    step1Visible && step2Visible ? "pass" : "partial",
    `step1=${step1Visible},step2=${step2Visible}`,
  );

  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="tel"]', "13800000000");
  await page.fill('input[placeholder="请输入验证码"]', "1234");
  await page.click("button.w-full.mt-6");
  await page.waitForTimeout(1200);

  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  const hasCal = await isVisible(page, "text=今日热量");
  const hasMacro = await isVisible(page, "text=三大营养素");
  push("营养数据中心", "首页热量进度+三大营养素", hasCal && hasMacro ? "pass" : "fail");

  await page.goto(`${base}/record`, { waitUntil: "domcontentloaded" });
  const tabs = ["扫码", "拍照", "搜索", "历史"];
  const tabExist = [];
  for (const t of tabs) {
    tabExist.push(await isVisible(page, `button:has-text("${t}")`));
  }
  push("食物识别与记录", "统一识别入口四个Tab", tabExist.every(Boolean) ? "pass" : "partial", JSON.stringify(tabExist));

  await page.fill('[data-testid="food-search-input"]', "鸡胸肉");
  await page.waitForTimeout(600);
  const firstFood = page.locator('[data-testid^="food-result-"]').first();
  const hasFood = await firstFood.isVisible().catch(() => false);
  if (hasFood) {
    await firstFood.click();
    const addVisible = await isVisible(page, '[data-testid="add-food-button"]');
    if (addVisible) await page.click('[data-testid="add-food-button"]');
    push("食物识别与记录", "手动搜索->食物详情->添加记录", addVisible ? "pass" : "partial");
  } else {
    push("食物识别与记录", "手动搜索->食物详情->添加记录", "fail", "无搜索结果");
  }

  await page.click('button:has-text("扫码")');
  const hasScanBtn = await isVisible(page, 'button:has-text("开始扫描")');
  const hasScanInputCount = await page.locator('input[type="file"]').count();
  push(
    "食物识别与记录",
    "扫码识别真实能力",
    hasScanBtn && hasScanInputCount === 0 ? "missing" : "pass",
    `scanBtn=${hasScanBtn},fileInput=${hasScanInputCount}`,
  );

  await page.click('button:has-text("拍照")');
  const hasPhotoBtn = await isVisible(page, 'button:has-text("拍照识别")');
  const hasUploadInputCount = await page.locator('input[type="file"]').count();
  push(
    "食物识别与记录",
    "拍照/上传真实识别能力",
    hasPhotoBtn && hasUploadInputCount === 0 ? "missing" : "pass",
    `photoBtn=${hasPhotoBtn},fileInput=${hasUploadInputCount}`,
  );

  await page.click('button:has-text("历史")');
  const hasHistoryList = await isVisible(page, "text=最近食用");
  push("食物识别与记录", "历史记录页面", hasHistoryList ? "partial" : "fail", "界面存在，但未见按日期/编辑/删除/复制能力");

  await page.goto(`${base}/nutrition`, { waitUntil: "domcontentloaded" });
  const hasHealthScore = await isVisible(page, "text=健康评估");
  const hasNutrientDetail = await isVisible(page, "text=营养素详情");
  push("营养数据中心", "营养详情页（评估+详情）", hasHealthScore && hasNutrientDetail ? "pass" : "partial");

  await page.goto(`${base}/profile`, { waitUntil: "domcontentloaded" });
  const hasBodyEdit = await isVisible(page, "text=身体数据");
  push("用户系统", "个人信息展示与身体数据编辑入口", hasBodyEdit ? "pass" : "fail");
  push("用户系统", "账户安全（改密/绑定）", "missing", "仅入口文案，未见实际流程");

  await page.goto(`${base}/ai`, { waitUntil: "domcontentloaded" });
  const quickQ = await isVisible(page, "text=快捷问题");
  await page.click('button:has-text("今天应该吃什么？")').catch(() => {});
  await page.waitForTimeout(1000);
  const aiResponded = await isVisible(page, "text=晚餐建议");
  push("智能助手", "基础问答与快捷问题", quickQ && aiResponded ? "pass" : "partial", "当前为前端预置回复，未验证后端AI服务");

  await page.goto(`${base}/reports`, { waitUntil: "domcontentloaded" });
  const hasWeekly = await isVisible(page, "text=周报");
  const hasShareBtn = await isVisible(page, 'button:has-text("分享报告")');
  push("数据报告", "日报/周报/月报展示", hasWeekly ? "partial" : "fail", "页面为静态示例数据，未见自动生成与真实历史数据");
  push("数据报告", "分享与导出", hasShareBtn ? "missing" : "missing", "按钮存在，未见真实分享/导出能力");

  await page.goto(`${base}/record`, { waitUntil: "domcontentloaded" });
  await page.fill('[data-testid="food-search-input"]', "鸡胸肉");
  await page.waitForTimeout(500);
  if (await page.locator('[data-testid^="food-result-"]').first().isVisible().catch(() => false)) {
    await page.locator('[data-testid^="food-result-"]').first().click();
    const hasScoreDim = await isVisible(page, "text=评分维度");
    const hasNOVA = await isVisible(page, "text=NOVA");
    push("健康评估系统", "基础评分与NOVA展示", hasScoreDim && hasNOVA ? "pass" : "partial");
    const hasPopulationEval = await isVisible(page, "text=糖尿病");
    push("健康评估系统", "特定人群评估（减脂/增肌/糖尿病/高血压/过敏）", hasPopulationEval ? "partial" : "missing");
    const hasAltRecommend = await isVisible(page, "text=替代");
    push("健康评估系统", "低分食品替代推荐", hasAltRecommend ? "partial" : "missing");
  }

  await page.goto(`${base}/social`, { waitUntil: "domcontentloaded" });
  const hasCheckin = await isVisible(page, "text=今日打卡");
  const hasAchieve = await isVisible(page, "text=成就系统");
  const hasRank = await isVisible(page, "text=好友榜单");
  push("社交激励", "打卡/成就/榜单/动态页面入口", hasCheckin && hasAchieve && hasRank ? "partial" : "fail", "多为前端演示数据");
  const hasAddFriendBtn = await isVisible(page, 'button:has-text("添加好友")');
  if (hasAddFriendBtn) await page.click('button:has-text("添加好友")');
  const friendModal = await isVisible(page, 'input[placeholder*="好友"]');
  push("社交激励", "好友添加与互动真实流程", friendModal ? "partial" : "missing", "按钮点击无业务流程");

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
