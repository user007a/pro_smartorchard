/**
 * 修复验证：h5_trace_detail.html 不应再抛 JS 异常
 * 同时验证 7 种 type 参数 + 默认无参场景
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:8888/html/applefarm_h5';
const CHROMIUM_PATH = 'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';
const SCREENSHOT_DIR = 'd:\\dev\\pro_smartorchard\\verify\\h5_screenshots';
const RESULT_FILE = 'd:\\dev\\pro_smartorchard\\verify\\h5_fix_verify_result.json';

const TYPES = ['', 'planting', 'pruning', 'bagging', 'fertilizer', 'testing', 'harvest', 'coldchain', 'invalid_xxx'];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM_PATH,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  const results = [];
  for (const t of TYPES) {
    const page = await context.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    const url = `${BASE_URL}/h5_trace_detail.html${t ? '?type=' + t : ''}`;
    let httpStatus = null;
    try {
      const r = await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      httpStatus = r ? r.status() : null;
      await page.waitForTimeout(300);
    } catch (e) {
      errs.push('navigation: ' + e.message);
    }
    const snapshot = await page.evaluate(() => ({
      title: document.getElementById('pageTitle') ? document.getElementById('pageTitle').textContent : null,
      date: document.getElementById('pageDate') ? document.getElementById('pageDate').textContent : null,
      infoDate: document.getElementById('infoDate') ? document.getElementById('infoDate').textContent : null,
      infoLocation: document.getElementById('infoLocation') ? document.getElementById('infoLocation').textContent : null,
      infoWorker: document.getElementById('infoWorker') ? document.getElementById('infoWorker').textContent : null,
      infoType: document.getElementById('infoType') ? document.getElementById('infoType').textContent : null,
      pageImgSrc: document.getElementById('pageImg') ? document.getElementById('pageImg').getAttribute('src') : null,
      pageDesc: document.getElementById('pageDesc') ? document.getElementById('pageDesc').textContent.slice(0, 40) : null,
      tagCount: document.getElementById('pageTags') ? document.getElementById('pageTags').querySelectorAll('.mb-tag').length : 0,
    }));
    const fileSafe = (t || 'default').replace(/[^a-z0-9_]/gi, '_');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `fix_${fileSafe}.png`), fullPage: false });
    results.push({ type: t || '(no type)', url, httpStatus, errors: errs, snapshot });
    await page.close();
  }

  fs.writeFileSync(RESULT_FILE, JSON.stringify(results, null, 2), 'utf8');
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });