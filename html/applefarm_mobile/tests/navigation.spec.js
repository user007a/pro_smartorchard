const { test, expect } = require('@playwright/test');

/**
 * 测试移动端页面导航功能
 */
test.describe('移动端页面导航测试', () => {
  
  test('mb_home.html - 底部导航栏存在且可点击', async ({ page }) => {
    await page.goto('file:///d:/dev/GitHub/project/pro_smartorchard/html/applefarm_mobile/mb_home.html');
    
    // 检查底部导航栏存在
    const tabBar = await page.locator('.mb-tab-bar, .mb-tab-item').first();
    await expect(tabBar).toBeVisible();
    
    // 检查首页、我的等导航项
    const navItems = await page.locator('.mb-tab-item').count();
    expect(navItems).toBeGreaterThanOrEqual(3);
  });

  test('mb_service.html - 服务页面导航正常', async ({ page }) => {
    await page.goto('file:///d:/dev/GitHub/project/pro_smartorchard/html/applefarm_mobile/mb_service.html');
    
    // 检查服务网格存在
    const serviceGrid = await page.locator('.service-grid, .service-item').first();
    await expect(serviceGrid).toBeVisible();
    
    // 检查底部导航
    const navItems = await page.locator('.mb-tab-item').count();
    expect(navItems).toBeGreaterThanOrEqual(3);
  });

  test('mb_login.html - 登录页面Tab切换正常', async ({ page }) => {
    await page.goto('file:///d:/dev/GitHub/project/pro_smartorchard/html/applefarm_mobile/mb_login.html');
    
    // 检查Tab存在
    const tabs = await page.locator('.tab-item');
    await expect(tabs).toHaveCount(3);
    
    // 点击验证码登录Tab
    await page.click('.tab-item[data-tab="2"]');
    
    // 检查验证码输入框出现
    const phoneInput = await page.locator('#phone');
    await expect(phoneInput).toBeVisible();
  });

  test('mb_mine.html - 个人中心页面正常加载', async ({ page }) => {
    await page.goto('file:///d:/dev/GitHub/project/pro_smartorchard/html/applefarm_mobile/mb_mine.html');
    
    // 检查用户信息区域
    const profileSection = await page.locator('.profile-section, .avatar');
    await expect(profileSection.first()).toBeVisible();
    
    // 检查底部导航
    const navItems = await page.locator('.mb-tab-item');
    await expect(navItems).toHaveCount(5);
  });
});
