const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  // 同时输出 HTML 报告（默认）和 JUnit/XML，便于生成 Markdown 摘要
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never', alwaysReport: true }],
    ['junit', { outputFile: 'playwright-report/junit-results.xml' }],
  ],
  use: {
    baseURL: 'file://' + __dirname,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'iPhone-Chromium',
      // 使用 iPhone 13 的视口 + 移动端 UA，但强制 Chromium，避免依赖未安装的 WebKit
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
      },
    },
    {
      name: 'Android',
      use: {
        viewport: { width: 360, height: 640 },
        userAgent:
          'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36',
      },
    },
  ],
  // 测试通过 file:// 协议直接打开 HTML，不需要 webServer
  webServer: undefined,
});
