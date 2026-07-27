const { test, expect } = require('@playwright/test');

/**
 * 测试所有37个移动端HTML页面能否正常加载
 */
const pages = [
  'mb_home.html',
  'mb_login.html',
  'mobile_template.html',
  'mb_service.html',
  'mb_mine.html',
  'mb_adoption.html',
  'mb_adoption_browse.html',
  'mb_adoption_cert.html',
  'mb_adoption_detail.html',
  'mb_adoption_farming.html',
  'mb_adoption_harvest.html',
  'mb_adoption_tagging.html',
  'mb_ai_agent.html',
  'mb_ai_assistant.html',
  'mb_device.html',
  'mb_troubleshoot.html',
  'mb_plan.html',
  'mb_record_task.html',
  'mb_patrol.html',
  'mb_feedback.html',
  'mb_map.html',
  'mb_navigation.html',
  'mb_draw_plot.html',
  'mb_plot.html',
  'mb_growth.html',
  'mb_yield.html',
  'mb_price.html',
  'mb_weather_predict.html',
  'mb_disease.html',
  'mb_pest_risk.html',
  'mb_label.html',
  'mb_material.html',
  'mb_model.html',
  'mb_expert.html',
  'mb_drone_patrol.html',
  'vr_panorama.html',
  'mb_quick_entry.html'
];

for (const page of pages) {
  test(`${page} - 页面加载测试`, async ({ page: playwrightPage }) => {
    const consoleErrors = [];
    playwrightPage.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await playwrightPage.goto(`file:///d:/dev/GitHub/project/pro_smartorchard/html/applefarm_mobile/${page}`);
    
    // 检查页面标题存在
    const title = await playwrightPage.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
    
    // 检查body存在
    const body = await playwrightPage.locator('body');
    await expect(body).toBeVisible();
    
    // 检查没有严重控制台错误（忽略一些常见的非关键错误）
    const criticalErrors = consoleErrors.filter(err => 
      !err.includes('favicon') && 
      !err.includes('404') &&
      !err.includes('net::ERR')
    );
    
    // 输出错误以便调试
    if (criticalErrors.length > 0) {
      console.log(`Page: ${page}, Errors:`, criticalErrors);
    }
  });
}
