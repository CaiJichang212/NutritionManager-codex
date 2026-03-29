import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5173";
const DEFAULT_IMAGE_FILE = path.resolve(process.cwd(), "mvp-login-fail.png");

function ensureImageFile() {
  const target = process.env.IMAGE_FILE || DEFAULT_IMAGE_FILE;
  if (fs.existsSync(target)) return target;
  const tmpFile = path.join(os.tmpdir(), "nm-sprint-c-upload.png");
  const png1x1 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAgMBgNf4x1EAAAAASUVORK5CYII=";
  fs.writeFileSync(tmpFile, Buffer.from(png1x1, "base64"));
  return tmpFile;
}

async function run() {
  const imageFile = ensureImageFile();
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  const results = [];
  const add = (name, ok, detail = "") => {
    results.push({ name, ok, detail });
    console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` - ${detail}` : ""}`);
  };
  const clickByTestId = async (id) =>
    page.evaluate((testId) => {
      const el = document.querySelector(`[data-testid="${testId}"]`);
      if (!el) return false;
      (el).click();
      return true;
    }, id);

  try {
    const loginRes = await fetch("http://127.0.0.1:8000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "13800000000", code: "1234" }),
    });
    const loginData = await loginRes.json();
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.evaluate((token) => localStorage.setItem("nm_token", token), loginData.access_token);
    const ok = await page.evaluate(() => Boolean(localStorage.getItem("nm_token")));
    add("登录", ok, "API注入Token");
  } catch (e) {
    add("登录", false, String(e));
  }

  try {
    await page.goto(`${BASE_URL}/record`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="tab-scan"]', { timeout: 5000 });
    await clickByTestId("tab-scan");
    const hasCameraBtn = await page.$('[data-testid="scan-camera-btn"]');
    add("扫码页摄像头入口存在", Boolean(hasCameraBtn));
    const switched = await page.$('[data-testid="scan-code-input"]');
    await sleep(300);
    await page.click('[data-testid="scan-code-input"]', { clickCount: 3 });
    await page.type('[data-testid="scan-code-input"]', "690000001");
    await clickByTestId("scan-recognize-btn");
    await page.waitForSelector('[data-testid="add-food-button"]', { timeout: 5000 });
    add("扫码识别可打开食物详情", switched);
    await page.evaluate(() => {
      const modal = document.querySelector("div.fixed.inset-0");
      const btn = modal?.querySelector("button");
      if (btn) (btn).click();
    });
    await sleep(200);
  } catch (e) {
    add("扫码识别可打开食物详情", false, String(e));
  }

  try {
    await clickByTestId("tab-photo");
    await page.waitForSelector('[data-testid="upload-file-input"]', { timeout: 3000 });
    const input = await page.$('[data-testid="upload-file-input"]');
    if (!input) throw new Error("未找到上传输入框");
    await input.uploadFile(imageFile);
    await page.waitForSelector('[data-testid="add-food-button"]', { timeout: 5000 });
    add("上传图片识别可打开食物详情", true, path.basename(imageFile));
  } catch (e) {
    add("上传图片识别可打开食物详情", false, String(e));
  }

  await browser.close();
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

run();
