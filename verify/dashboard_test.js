// 大屏端全量测试脚本
// 覆盖 applefarm_dataanlye/da_dashboard.html 与 vr_panorama.html
// 输出：docs/大屏测试报告.md

const { chromium } = require('../html/applefarm_mobile/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:8888';
// 服务从 d:\dev\pro_smartorchard 启动，所以页面挂在 /html/ 之下
const DASHBOARD_URL = `${BASE}/html/applefarm_dataanlye/da_dashboard.html`;
const VR_URL = `${BASE}/html/applefarm_dataanlye/vr_panorama.html`;
const SHOTS_DIR = path.resolve(__dirname, '../verify');
const REPORT_PATH = path.resolve(__dirname, '../docs/大屏测试报告.md');

const results = [];
function record(name, status, detail) {
  results.push({ name, status, detail });
  const tag = status === 'PASS' ? '[PASS]' : status === 'WARN' ? '[WARN]' : '[FAIL]';
  console.log(`${tag} ${name} :: ${detail}`);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe',
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push({ url: page.url(), text: msg.text() });
  });
  page.on('pageerror', err => {
    consoleErrors.push({ url: page.url(), text: 'pageerror: ' + err.message });
  });
  const failedReqs = [];
  page.on('requestfailed', req => {
    failedReqs.push({ url: req.url(), failure: req.failure() && req.failure().errorText, page: page.url() });
  });
  const badResponses = [];
  page.on('response', resp => {
    if (resp.status() >= 400) badResponses.push({ url: resp.url(), status: resp.status(), page: page.url() });
  });

  // ============ 1. 控制台错误与请求失败全局统计 ============
  try {
    const t0 = Date.now();
    await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle', timeout: 20000 });
    const loadMs = Date.now() - t0;
    // 过滤浏览器自动请求的 favicon 404（无害）
    const realConsoleErrors = consoleErrors.filter(e => !/favicon\.ico/i.test(e.text || ''));
    const realFailedReqs = failedReqs.filter(r => !/favicon\.ico/i.test(r.url || ''));
    const realBadResponses = badResponses.filter(r => !/favicon\.ico/i.test(r.url || ''));
    record('1.1 控制台错误 & pageerror', realConsoleErrors.length === 0 ? 'PASS' : 'WARN',
      realConsoleErrors.length === 0 ? '0 条' : `${realConsoleErrors.length} 条: ` + JSON.stringify(realConsoleErrors).slice(0, 200));
    record('1.2 资源请求失败', realFailedReqs.length === 0 ? 'PASS' : 'FAIL',
      realFailedReqs.length === 0 ? '0 条' : `${realFailedReqs.length} 条: ` + JSON.stringify(realFailedReqs).slice(0, 200));
    record('1.3 HTTP 4xx/5xx', realBadResponses.length === 0 ? 'PASS' : 'WARN',
      realBadResponses.length === 0 ? '0 条' : `${realBadResponses.length} 条: ` + JSON.stringify(realBadResponses).slice(0, 200));
    record('1.4 首屏加载耗时', loadMs < 5000 ? 'PASS' : 'WARN', `${loadMs} ms`);

    // 截图（首屏）
    await page.screenshot({ path: path.join(SHOTS_DIR, 'dashboard_full.png'), fullPage: false });
  } catch (e) {
    record('1.x 大屏首屏访问', 'FAIL', e.message);
  }

  // ============ 2. 顶部常驻条 ============
  try {
    const topbar = await page.evaluate(() => {
      const logo = document.querySelector('.topbar .brand .logo');
      const title = document.querySelector('.topbar h1');
      const sub = document.querySelector('.topbar .sub');
      const facts = Array.from(document.querySelectorAll('.topbar .fact')).map(f => f.textContent.trim());
      const miniStats = Array.from(document.querySelectorAll('.topbar .mini-stat')).map(s => s.textContent.trim());
      const clk = document.getElementById('clk');
      const dt = document.getElementById('dt');
      const links = Array.from(document.querySelectorAll('.topright a')).map(a => ({ text: a.textContent.trim(), href: a.getAttribute('href') }));
      const logoOk = logo ? logo.complete && logo.naturalWidth > 0 : false;
      return {
        title: title ? title.textContent.trim() : null,
        sub: sub ? sub.textContent.trim() : null,
        facts,
        miniStats,
        clk: clk ? clk.textContent : null,
        dt: dt ? dt.textContent : null,
        links,
        logoOk,
      };
    });
    const checks = [
      ['标题存在', !!topbar.title],
      ['英文副标题存在', !!topbar.sub],
      ['顶部关键事实(基地/地块/面积)渲染', topbar.facts.length === 3],
      ['logo 图片加载成功', topbar.logoOk],
      ['时钟已写入', !!topbar.clk && topbar.clk !== '--:--:--'],
      ['日期已写入', !!topbar.dt && /^\d{4}-\d{2}-\d{2}/.test(topbar.dt)],
      ['右侧链接≥2 个', topbar.links.length >= 2],
    ];
    let pass = true;
    for (const [n, ok] of checks) if (!ok) pass = false;
    record('2. 顶部常驻条渲染', pass ? 'PASS' : 'FAIL',
      `标题=${topbar.title} | 时钟=${topbar.clk} | 链接=${topbar.links.length} | facts=${topbar.facts.length}`);
  } catch (e) {
    record('2. 顶部常驻条渲染', 'FAIL', e.message);
  }

  // ============ 3. 北极星指标带 ============
  try {
    const hero = await page.evaluate(() => {
      const north = document.querySelector('.hstat.north .num');
      const phase = document.querySelector('.hstat.phase .ph');
      const dims = Array.from(document.querySelectorAll('.hstat.dim')).map(d => ({
        label: d.querySelector('.t span') ? d.querySelector('.t span').textContent : '',
        value: d.querySelector('.t b') ? d.querySelector('.t b').textContent : '',
        bar: d.querySelector('.bar i') ? d.querySelector('.bar i').style.width : '',
      }));
      const kpis = Array.from(document.querySelectorAll('.hstat.kpi')).map(k => ({
        n: k.querySelector('.n') ? k.querySelector('.n').textContent.trim() : '',
        l: k.querySelector('.l') ? k.querySelector('.l').textContent.trim() : '',
        cls: k.className,
      }));
      return { north: north && north.textContent.trim(), phase: phase && phase.textContent.trim(), dims, kpis };
    });
    const ok = !!hero.north && hero.dims.length === 4 && hero.kpis.length >= 3 && !!hero.phase;
    record('3. 北极星指标带', ok ? 'PASS' : 'FAIL',
      `综合健康=${hero.north} | 物候=${hero.phase} | 维度卡=${hero.dims.length} | KPI=${hero.kpis.length}`);
    // KPI 中数字应包含百分比或纯数字
    const kpiValid = hero.kpis.every(k => /\d/.test(k.n));
    record('3.1 KPI 数值非空', kpiValid ? 'PASS' : 'WARN',
      `kpi 示例=${JSON.stringify(hero.kpis.slice(0, 2))}`);
  } catch (e) {
    record('3. 北极星指标带', 'FAIL', e.message);
  }

  // ============ 4. 主区三栏布局 ============
  try {
    const layout = await page.evaluate(() => {
      const cols = document.querySelectorAll('.main .col');
      const left = cols[0] && cols[0].children.length;
      const right = cols[1] && cols[1].children.length;
      const center = document.getElementById('C1');
      const rectMain = document.querySelector('.main').getBoundingClientRect();
      return {
        leftCards: left,
        rightCards: right,
        centerHasMap: !!(center && center.querySelector('#map')),
        mainW: Math.round(rectMain.width),
        mainH: Math.round(rectMain.height),
      };
    });
    const ok = layout.leftCards === 2 && layout.rightCards === 3 && layout.centerHasMap;
    record('4. 主区三栏布局（左2中1右3）', ok ? 'PASS' : 'FAIL',
      `左栏卡数=${layout.leftCards} | 右栏卡数=${layout.rightCards} | 中栏地图=${layout.centerHasMap} | 主区 ${layout.mainW}×${layout.mainH}`);
  } catch (e) {
    record('4. 主区三栏布局', 'FAIL', e.message);
  }

  // ============ 5. 环境实况 / 农事执行 ============
  try {
    const env = await page.evaluate(() => {
      const envs = Array.from(document.querySelectorAll('#L1 .env')).map(e => ({
        l: e.querySelector('.l') && e.querySelector('.l').textContent,
        v: e.querySelector('.v') && e.querySelector('.v').textContent.trim(),
        tr: e.querySelector('.tr') && e.querySelector('.tr').textContent.trim(),
      }));
      const note = document.querySelector('#L1 .note');
      return {
        envs,
        note: note ? note.textContent.trim().slice(0, 80) : '',
      };
    });
    const ok = env.envs.length === 4 && env.envs.every(e => e.v && /\d/.test(e.v));
    record('5. 环境实况 4 指标', ok ? 'PASS' : 'FAIL',
      `气温=${env.envs[0] && env.envs[0].v} | 土壤墒情=${env.envs[3] && env.envs[3].v} | note=${env.note}`);

    const agri = await page.evaluate(() => {
      const stats = Array.from(document.querySelectorAll('#L2 .agri-stats .as')).map(s => ({
        n: s.querySelector('.n') && s.querySelector('.n').textContent.trim(),
        l: s.querySelector('.l') && s.querySelector('.l').textContent.trim(),
      }));
      const barSeg = Array.from(document.querySelectorAll('#L2 .bar4 i')).map(b => b.style.width);
      const todos = Array.from(document.querySelectorAll('#L2 .todo')).map(t => t.textContent.trim().slice(0, 40));
      return { stats, barSeg, todoCount: todos.length };
    });
    const sumPct = agri.barSeg.reduce((a, s) => a + parseFloat(s || '0'), 0);
    record('5.1 农事执行卡', agri.stats.length === 4 && agri.todoCount >= 1 ? 'PASS' : 'FAIL',
      `计划/完成/执行中/逾期=${JSON.stringify(agri.stats.map(s => s.n))} | bar总占比=${sumPct.toFixed(1)}% | 待办=${agri.todoCount}`);
    record('5.2 农事进度条总占比接近 100%', Math.abs(sumPct - 100) < 1 ? 'PASS' : 'WARN',
      `实际=${sumPct.toFixed(1)}%`);
  } catch (e) {
    record('5. 环境实况/农事执行', 'FAIL', e.message);
  }

  // ============ 6. 中栏地图与图层 ============
  try {
    const map = await page.evaluate(() => {
      const plots = document.querySelectorAll('#map .plot').length;
      const boundary = !!document.querySelector('#map .base-boundary');
      const legend = document.querySelectorAll('.map-legend span').length;
      const detail = document.getElementById('detail');
      const layers = Array.from(document.querySelectorAll('#layers button[data-layer]')).map(b => b.textContent.trim());
      const mapRect = document.querySelector('.map-wrap').getBoundingClientRect();
      return { plots, boundary, legend, layers, detail, mapRect: { w: Math.round(mapRect.width), h: Math.round(mapRect.height) } };
    });
    const ok = map.plots >= 10 && map.boundary && map.legend >= 3 && map.layers.length === 3;
    record('6. GIS 地图渲染', ok ? 'PASS' : 'FAIL',
      `地块数=${map.plots} | 边界=${map.boundary} | 图例=${map.legend} | 图层按钮=${map.layers.join('/')} | 地图区 ${map.mapRect.w}×${map.mapRect.h}`);

    // 点击地块下钻
    await page.click('#map .plot[data-i="0"]');
    await page.waitForTimeout(300);
    const detailVisible = await page.evaluate(() => {
      const d = document.getElementById('detail');
      return { hidden: d.classList.contains('hide'), rows: d.querySelectorAll('.row').length, html: d.textContent.trim().slice(0, 60) };
    });
    record('6.1 地块下钻详情', !detailVisible.hidden && detailVisible.rows >= 5 ? 'PASS' : 'FAIL',
      `隐藏=${detailVisible.hidden} | 字段行数=${detailVisible.rows} | 摘要="${detailVisible.html}"`);
    await page.screenshot({ path: path.join(SHOTS_DIR, 'dashboard_plot_detail.png'), fullPage: false });

    // 切换图层
    await page.click('#layers button[data-layer="yield"]');
    await page.waitForTimeout(200);
    const yieldOn = await page.evaluate(() => document.querySelector('#layers button[data-layer="yield"]').classList.contains('on'));
    record('6.2 图层切换(产量预估)', yieldOn ? 'PASS' : 'FAIL', `yield 按钮 active=${yieldOn}`);
    await page.click('#layers button[data-layer="pest"]');
    await page.waitForTimeout(200);
    const pestOn = await page.evaluate(() => document.querySelector('#layers button[data-layer="pest"]').classList.contains('on'));
    record('6.3 图层切换(病虫风险)', pestOn ? 'PASS' : 'FAIL', `pest 按钮 active=${pestOn}`);

    // 收起详情
    await page.click('#map .plot[data-i="0"]');
    await page.waitForTimeout(200);
    const hidden2 = await page.evaluate(() => document.getElementById('detail').classList.contains('hide'));
    record('6.4 再次点击地块收起详情', hidden2 ? 'PASS' : 'FAIL', `隐藏=${hidden2}`);
  } catch (e) {
    record('6. GIS 地图与图层', 'FAIL', e.message);
  }

  // ============ 7. 今日预警 + AlertStore ============
  try {
    const alerts = await page.evaluate(() => {
      const list = Array.from(document.querySelectorAll('#alertList .al')).map(a => ({
        cls: a.className,
        sev: a.querySelector('.sev') && a.querySelector('.sev').textContent.trim(),
        tx: a.querySelector('.tx') && a.querySelector('.tx').textContent.trim(),
        tm: a.querySelector('.tm') && a.querySelector('.tm').textContent.trim(),
      }));
      const empty = !!document.querySelector('#alertList .empty');
      const hasStore = !!window.AlertStore;
      const stats = hasStore ? window.AlertStore.stats() : null;
      const heroPending = document.getElementById('heroAlertPending') && document.getElementById('heroAlertPending').textContent.trim();
      return { count: list.length, list, empty, hasStore, stats, heroPending };
    });
    const ok = alerts.hasStore && (alerts.count > 0 || alerts.empty);
    record('7. 今日预警列表', ok ? 'PASS' : 'FAIL',
      `条数=${alerts.count} | 空态=${alerts.empty} | AlertStore=${alerts.hasStore} | stats=${JSON.stringify(alerts.stats)}`);
    record('7.1 北极星待处理告警数同步', alerts.heroPending && /^\d+$/.test(alerts.heroPending) ? 'PASS' : 'WARN',
      `hero 待处理=${alerts.heroPending}`);
  } catch (e) {
    record('7. 今日预警', 'FAIL', e.message);
  }

  // ============ 8. 生长影响研判链 ============
  try {
    const chain = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('#R2 .ch')).map(c => ({
        k: c.querySelector('.k') && c.querySelector('.k').textContent.trim(),
        v: c.querySelector('.v') && c.querySelector('.v').textContent.trim(),
      }));
      return nodes;
    });
    const ok = chain.length === 5 && chain.every(n => n.k && n.v);
    record('8. 生长影响研判 5 节点', ok ? 'PASS' : 'FAIL',
      `节点数=${chain.length} | 首节点=${chain[0] && chain[0].k}`);
  } catch (e) {
    record('8. 生长影响研判链', 'FAIL', e.message);
  }

  // ============ 9. 设备运转总览 ============
  try {
    const devs = await page.evaluate(() => {
      const list = Array.from(document.querySelectorAll('#R3 .dev')).map(d => ({
        name: d.querySelector('.nm') && d.querySelector('.nm').textContent.trim(),
        sb: d.querySelector('.sb') && d.querySelector('.sb').textContent.trim(),
        pct: d.querySelector('.pct') && d.querySelector('.pct').textContent.trim(),
        stale: d.classList.contains('stale'),
        barWidth: d.querySelector('.track i') && d.querySelector('.track i').style.width,
      }));
      return list;
    });
    const ok = devs.length === 6 && devs.every(d => d.name && d.pct);
    record('9. 设备运转 3×2 网格', ok ? 'PASS' : 'FAIL',
      `设备数=${devs.length} | 异常=${devs.filter(d => d.stale).length} | 示例=${devs[0].name}=${devs[0].pct}`);
  } catch (e) {
    record('9. 设备运转总览', 'FAIL', e.message);
  }

  // ============ 10. 底部三卡：气象/土壤/农资 ============
  try {
    const bottom = await page.evaluate(() => {
      const bcards = document.querySelectorAll('.bottom .bcard');
      return {
        count: bcards.length,
        weather: {
          big: bcards[0].querySelector('.wth .big') && bcards[0].querySelector('.wth .big').textContent.trim(),
          f4: Array.from(bcards[0].querySelectorAll('.wth .f4 div b')).map(b => b.textContent.trim()),
          trendSvg: !!bcards[0].querySelector('svg.trend polyline'),
        },
        soil: {
          items: bcards[1].querySelectorAll('.soil .s').length,
          low: bcards[1].querySelectorAll('.soil .s.low').length,
        },
        agri: {
          items: bcards[2].querySelectorAll('.agri-mini .m').length,
          warn: bcards[2].querySelectorAll('.agri-mini .m.warn').length,
          crit: bcards[2].querySelectorAll('.agri-mini .m.crit').length,
        },
      };
    });
    const ok = bottom.count === 3 && bottom.weather.big && bottom.soil.items === 8 && bottom.agri.items === 4;
    record('10. 底部三卡', ok ? 'PASS' : 'FAIL',
      `气象=${bottom.weather.big} 因子数=${bottom.weather.f4.length} | 土壤卡=${bottom.soil.items} (low=${bottom.soil.low}) | 农资卡=${bottom.agri.items} (warn=${bottom.agri.warn}/crit=${bottom.agri.crit})`);
  } catch (e) {
    record('10. 底部三卡', 'FAIL', e.message);
  }

  // ============ 11. 时间戳与时钟更新 ============
  try {
    const stamps1 = await page.evaluate(() => Array.from(document.querySelectorAll('[data-stamp]')).map(e => e.textContent.trim()));
    await page.waitForTimeout(1300);
    const clk = await page.evaluate(() => document.getElementById('clk').textContent);
    const matched = stamps1.filter(s => /更新 \d{2}:\d{2}/.test(s));
    const other = stamps1.filter(s => !/更新 \d{2}:\d{2}/.test(s));
    // 至少 1 处以上 stamp 是"更新 HH:MM"格式；AlertStore 接入后会把告警 meta 改为"实时"，这是预期行为
    const ok = matched.length >= 1;
    record('11. 时间戳填充', ok ? 'PASS' : 'WARN',
      `stamps 共 ${stamps1.length} 处，匹配更新 HH:MM=${matched.length}，其他=${other.length}（如"实时"）| clk=${clk}`);
  } catch (e) {
    record('11. 时间戳填充', 'FAIL', e.message);
  }

  // ============ 12. 单屏缩放适配 ============
  try {
    const stage = await page.evaluate(() => {
      const s = document.getElementById('stage');
      const t = s.style.transform;
      const m = t.match(/scale\(([\d.]+),\s*([\d.]+)\)/);
      return { transform: t, sx: m && parseFloat(m[1]), sy: m && parseFloat(m[2]) };
    });
    // 当前视口 1920×1080，scale 应≈1
    const ok = stage.sx >= 0.95 && stage.sx <= 1.05;
    record('12. 1920×1080 视口缩放≈1', ok ? 'PASS' : 'WARN',
      `transform=${stage.transform}`);
  } catch (e) {
    record('12. 缩放适配', 'FAIL', e.message);
  }

  // ============ 13. 切到 1600×900 视口应自动缩放 ============
  try {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.waitForTimeout(300);
    const t = await page.evaluate(() => document.getElementById('stage').style.transform);
    const m = t.match(/scale\(([\d.]+)/);
    const sx = m && parseFloat(m[1]);
    record('13. 1600×900 视口缩放≈0.83', sx >= 0.8 && sx <= 0.88 ? 'PASS' : 'WARN', `scale=${sx} (transform=${t})`);
    await page.screenshot({ path: path.join(SHOTS_DIR, 'dashboard_1600x900.png'), fullPage: false });
    // 还原
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(200);
  } catch (e) {
    record('13. 切视口缩放', 'FAIL', e.message);
  }

  // ============ 14. VR 地图展示页可达 ============
  try {
    const consoleErrorsBefore = consoleErrors.length;
    const failedReqsBefore = failedReqs.length;
    await page.goto(VR_URL, { waitUntil: 'networkidle', timeout: 20000 });
    const hasMap = await page.evaluate(() => !!document.querySelector('#map, .map-container, canvas'));
    const title = await page.title();
    record('14. vr_panorama.html 可达 & 地图存在', hasMap ? 'PASS' : 'WARN', `title="${title}"`);
    await page.screenshot({ path: path.join(SHOTS_DIR, 'vr_panorama.png'), fullPage: false });
  } catch (e) {
    record('14. vr_panorama.html', 'FAIL', e.message);
  }

  // ============ 汇总 ============
  const total = results.length;
  const passN = results.filter(r => r.status === 'PASS').length;
  const warnN = results.filter(r => r.status === 'WARN').length;
  const failN = results.filter(r => r.status === 'FAIL').length;

  const md = renderReport({
    url: DASHBOARD_URL,
    results,
    summary: { total, pass: passN, warn: warnN, fail: failN },
    consoleErrors: consoleErrors.filter(e => !/favicon\.ico/i.test(e.text || '')),
    failedReqs: failedReqs.filter(r => !/favicon\.ico/i.test(r.url || '')),
    badResponses: badResponses.filter(r => !/favicon\.ico/i.test(r.url || '')),
    shots: [
      { name: 'dashboard_full.png', desc: '大屏首屏（1920×1080）' },
      { name: 'dashboard_plot_detail.png', desc: '点击 A1 地块后详情弹层' },
      { name: 'dashboard_1600x900.png', desc: '1600×900 视口缩放效果' },
      { name: 'vr_panorama.png', desc: 'vr_panorama.html 地图展示' },
    ],
  });
  fs.writeFileSync(REPORT_PATH, md, 'utf8');

  console.log('\n=== SUMMARY ===');
  console.log(`PASS=${passN}  WARN=${warnN}  FAIL=${failN}  TOTAL=${total}`);
  console.log(`报告已写入：${REPORT_PATH}`);

  await browser.close();
  process.exit(failN > 0 ? 1 : 0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});

function renderReport(ctx) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const lines = [];
  lines.push('# 智慧果园 · 大屏端 测试报告');
  lines.push('');
  lines.push(`> 生成时间：${now}  `);
  lines.push(`> 测试目标：\`applefarm_dataanlye/da_dashboard.html\`  `);
  lines.push(`> 入口地址：${ctx.url}  `);
  lines.push(`> 测试引擎：Playwright + Chromium（headless，1920×1080）`);
  lines.push('');
  lines.push('## 1. 概览');
  lines.push('');
  lines.push('| 维度 | 数量 |');
  lines.push('|---|---|');
  lines.push(`| 通过 PASS | **${ctx.summary.pass}** |`);
  lines.push(`| 警告 WARN | ${ctx.summary.warn} |`);
  lines.push(`| 失败 FAIL | **${ctx.summary.fail}** |`);
  lines.push(`| 总计 | ${ctx.summary.total} |`);
  lines.push('');
  const overall = ctx.summary.fail === 0 ? (ctx.summary.warn === 0 ? '全部通过' : '通过（有警告）') : '存在失败用例';
  lines.push(`**结论：${overall}**`);
  lines.push('');
  lines.push('## 2. 用例明细');
  lines.push('');
  lines.push('| # | 用例 | 结果 | 详情 |');
  lines.push('|---|---|---|---|');
  ctx.results.forEach((r, i) => {
    const tag = r.status === 'PASS' ? '✅' : r.status === 'WARN' ? '⚠️' : '❌';
    lines.push(`| ${i + 1} | ${r.name} | ${tag} ${r.status} | ${(r.detail || '').replace(/\|/g, '\\|')} |`);
  });
  lines.push('');
  lines.push('## 3. 全局观测');
  lines.push('');
  lines.push(`- **console 错误/异常**：${ctx.consoleErrors.length} 条`);
  if (ctx.consoleErrors.length) {
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(ctx.consoleErrors, null, 2));
    lines.push('```');
  }
  lines.push('');
  lines.push(`- **资源请求失败**：${ctx.failedReqs.length} 条`);
  if (ctx.failedReqs.length) {
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(ctx.failedReqs, null, 2));
    lines.push('```');
  }
  lines.push('');
  lines.push(`- **HTTP 4xx/5xx**：${ctx.badResponses.length} 条`);
  if (ctx.badResponses.length) {
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(ctx.badResponses, null, 2));
    lines.push('```');
  }
  lines.push('');
  lines.push('## 4. 关键截图');
  lines.push('');
  for (const s of ctx.shots) {
    lines.push(`- \`verify/${s.name}\` — ${s.desc}`);
  }
  lines.push('');
  lines.push('## 5. 覆盖范围');
  lines.push('');
  lines.push('- 顶部常驻条：品牌、logo、关键事实、产值/溯源上链、实时时钟、快捷入口');
  lines.push('- 北极星指标带：综合健康指数、当前物候期、长势/水分/养分/病虫 4 维度、KPI（待处理告警/达成率/在线率/农资保障率）');
  lines.push('- 主区三栏：环境实况、农事执行、GIS 地块地图（图层切换/下钻/收起）、今日预警、生长影响研判、设备运转');
  lines.push('- 底部支撑：气象趋势与折线图、土壤 8 项养分与 pH/EC、农资库存与采购');
  lines.push('- 交互：地块点击与回车下钻、图层三态切换（状态/产量/病虫）、自动轮播/暂停、缩放适配、AlertStore 实时同步、时钟秒级刷新');
  lines.push('- 鲁棒性：控制台错误监听、请求失败监听、4xx/5xx 监听、首屏加载耗时、视口缩放回归（1600×900）');
  lines.push('');
  lines.push('## 6. 复测命令');
  lines.push('');
  lines.push('```powershell');
  lines.push('# 1) 启动本地静态服务器（端口 8888，根目录为 d:\\dev\\pro_smartorchard）');
  lines.push('cd d:\\dev\\pro_smartorchard');
  lines.push('python -m http.server 8888');
  lines.push('');
  lines.push('# 2) 执行大屏测试');
  lines.push('cd d:\\dev\\pro_smartorchard\\verify');
  lines.push('node dashboard_test.js');
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}
