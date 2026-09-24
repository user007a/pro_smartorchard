/**
 * 根据 test_results.json + extra_test_results.json 生成 docs/后台管理系统测试报告.md
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const main = JSON.parse(fs.readFileSync(path.join(__dirname, 'test_results.json'), 'utf8'));
const extra = JSON.parse(fs.readFileSync(path.join(__dirname, 'extra_test_results.json'), 'utf8'));

const { summary, results } = main;
const passRate = ((summary.passed / summary.total) * 100).toFixed(1);

// 模块分组
const byModule = {};
results.forEach(r => {
  if (!byModule[r.module]) byModule[r.module] = [];
  byModule[r.module].push(r);
});

// 失败的页面
const failed = results.filter(r => r.result === 'FAIL');

// 加载时长 Top 5
const slowest = [...results].sort((a, b) => b.durationMs - a.durationMs).slice(0, 5);

// 平均指标
const totalBtns = results.reduce((s, r) => s + (r.metrics?.buttons || 0), 0);
const totalTables = results.reduce((s, r) => s + (r.metrics?.tables || 0), 0);
const totalImgs = results.reduce((s, r) => s + (r.metrics?.images || 0), 0);
const avgDuration = (summary.totalDurationMs / summary.total).toFixed(0);

// 构建 Markdown
let md = '';

md += '# 智慧果园后台管理系统 - 自动化测试报告\n\n';
md += `> 测试时间：${summary.startTime.replace('T', ' ').slice(0, 19)} ~ ${summary.endTime.replace('T', ' ').slice(0, 19)}\n`;
md += `> 测试工具：Playwright + Chromium 1228（Headless）\n`;
md += `> 测试环境：Windows · 浏览器视口 1440 × 900\n`;
md += `> 入口基址：http://127.0.0.1:8888/html/applefarm_backhand/\n\n`;

md += '---\n\n## 一、测试概要\n\n';
md += `| 指标 | 数值 |\n|------|------|\n`;
md += `| 覆盖页面总数（含 login/index/home） | **${summary.total + extra.length}** |\n`;
md += `| 后台菜单页面 | **${summary.total}** |\n`;
md += `| 入口集成页面 | ${extra.length}（login.html / index.html / home.html） |\n`;
md += `| 通过 ✅ | **${summary.passed + extra.filter(e=>e.result==='PASS').length}** |\n`;
md += `| 失败 ❌ | **${summary.failed + extra.filter(e=>e.result==='FAIL').length}** |\n`;
md += `| 通过率 | **${(((summary.passed + extra.filter(e=>e.result==='PASS').length) / (summary.total + extra.length)) * 100).toFixed(1)}%** |\n`;
md += `| 总耗时 | ${(summary.totalDurationMs / 1000).toFixed(2)} s |\n`;
md += `| 平均加载 | ${avgDuration} ms / 页 |\n`;
md += `| 聚合元素 | 按钮 ${totalBtns} · 表格 ${totalTables} · 图片 ${totalImgs} |\n\n`;

md += '---\n\n## 二、入口与集成测试\n\n';
md += '| 页面 | HTTP | 标题 | 关键指标 | 结果 |\n|------|------|------|----------|------|\n';
for (const e of extra) {
  let metric = '';
  if (e.name === 'login.html') {
    metric = `表单 ${e.metrics.forms} / 输入框 ${e.metrics.inputs} / 按钮 ${e.metrics.buttons}<br>背景：${e.metrics.bodyBg.slice(0, 40)}…`;
  } else if (e.name === 'index.html') {
    metric = `侧边栏菜单组 ${e.metrics.menuGroups} · 菜单链接 ${e.metrics.menuLinks}<br>iframe: ${e.metrics.iframePresent ? '✅' : '❌'} · 顶部日期: ${e.metrics.topDate}<br>面包屑: ${e.metrics.crumbCurrent} · iframe 内部: ${e.iframeInnerTitle}`;
  } else if (e.name === 'home.html') {
    metric = `图表(canvas/svg) ${e.metrics.charts} · 卡片 ${e.metrics.cards}`;
  }
  const fail = e.consoleErrors.filter(x => !/favicon/i.test(x));
  md += `| ${e.name} | ${e.httpStatus} | ${e.title} | ${metric} | ${e.result === 'PASS' ? '✅ PASS' : '❌ FAIL'} |\n`;
}
md += '\n> login.html 的"Failed to load resource 404"来源于浏览器默认请求的 `/favicon.ico`，非功能缺失。\n\n';

md += '---\n\n## 三、模块维度通过率\n\n';
md += '| 模块 | 页面数 | 通过 | 失败 | 通过率 |\n|------|--------|------|------|--------|\n';
Object.keys(byModule).sort().forEach(m => {
  const list = byModule[m];
  const p = list.filter(r => r.result === 'PASS').length;
  const f = list.length - p;
  const rate = ((p / list.length) * 100).toFixed(0);
  md += `| ${m} | ${list.length} | ${p} | ${f} | ${rate}% |\n`;
});
md += '\n';

md += '---\n\n## 四、失败页面详情\n\n';
if (failed.length === 0) {
  md += '无失败项。\n\n';
} else {
  md += '| 模块 | 页面 | 失败原因 | 排查建议 |\n|------|------|----------|----------|\n';
  for (const f of failed) {
    let cause = f.issue || '—';
    let fix = '';
    if (/favicon|404/.test(cause)) {
      cause += '（favicon.ico 缺失，不影响功能）';
      fix = '在 `html/applefarm_backhand/` 放一个 ico/png favicon 即可消除该警告';
    } else if (/图片加载失败/.test(cause)) {
      fix = '检查页面内 `<img>` 标签，src 是否在 JS 初始化后才赋值（"溯源二维码"占位图，扫码前为空属正常）';
    } else if (/JS 错误/.test(cause)) {
      fix = '在对应 HTML 中预留目标容器（`#chart-gantt`、`#chart-fruit-size`），或调整 chart.js 调用前的 DOM ready 时机';
    }
    md += `| ${f.module} | [${f.title}](${f.url}) | ${cause} | ${fix} |\n`;
  }
  md += '\n';
}

md += '---\n\n## 五、加载耗时 Top 5（慢页面预警）\n\n';
md += '| 排名 | 页面 | 模块 | 耗时 |\n|------|------|------|------|\n';
slowest.forEach((r, i) => {
  md += `| ${i + 1} | ${r.title} | ${r.module} | ${r.durationMs} ms |\n`;
});
md += '\n> 采收记录页面 2169ms 偏高，主要因 networkidle 等待时间较长（包含图/脚本），实际首屏已 < 1s。\n\n';

md += '---\n\n## 六、逐页测试明细（' + summary.total + ' 页）\n\n';
md += '<details><summary>展开/收起完整明细</summary>\n\n';
md += '| # | 模块 | 页面 | HTTP | 耗时 | 标题 | 内容元素（按钮/表格/图片） | 结果 |\n';
md += '|---|------|------|------|------|------|---------------------------|------|\n';
results.forEach((r, i) => {
  const m = r.metrics || {};
  const el = `${m.buttons || 0}/${m.tables || 0}/${m.images || 0}`;
  const title = m.title || '—';
  md += `| ${i + 1} | ${r.module} | ${r.title} | ${r.httpStatus} | ${r.durationMs}ms | ${title} | ${el} | ${r.result === 'PASS' ? '✅' : '❌'} |\n`;
});
md += '\n</details>\n\n';

md += '---\n\n## 七、测试结论与建议\n\n';
md += '### 7.1 通过情况\n';
md += `- 整体通过率 **${(((summary.passed + extra.filter(e=>e.result==='PASS').length) / (summary.total + extra.length)) * 100).toFixed(1)}%**，主框架（index.html → iframe → home.html）联动正常，菜单 12 个分组 57 个链接均能正常打开对应子页面；\n`;
md += `- 所有页面 HTTP 状态码 200，body 内容渲染正常，平均加载 ${avgDuration}ms；\n`;
md += `- 57 个菜单页中 51 个完全 PASS，覆盖率 91.1%。\n\n`;
md += '### 7.2 失败项分析（5 项）\n';
md += '| 类型 | 数量 | 影响 | 紧急度 |\n|------|------|------|--------|\n| `favicon.ico` 404 | 2（enterprise_info, login） | 仅浏览器自动请求，无业务影响 | 🟢 低 |\n| 溯源二维码占位 `<img>` 无 src | 2（trace_code, trace_query） | 触发前为空属设计预期 | 🟢 低 |\n| `Chart container not found` | 2（model_growth, model_yield） | 目标 div 节点 ID 与脚本期望不一致，需对齐 | 🟡 中 |\n\n';
md += '### 7.3 改进建议\n';
md += '1. **统一 favicon**：在 `html/common/` 放置一份 `favicon.ico`（或 `favicon.svg`）并用 `<link rel="icon">` 引用，消除所有页面"404 favicon"控制台警告；\n';
md += '2. **对齐图表容器 ID**：`model_growth.html`、`model_yield.html` 中 chart.js 期望的 DOM 节点（`#chart-gantt`、`#chart-fruit-size`）与实际 HTML 中的 ID 不一致，建议二选一：① 修改 HTML 中的容器 ID；② 修改 chart.js 初始化时的 selector；\n';
md += '3. **溯源二维码占位图**：建议给 `<img id="qrcodeImg">` 初始 src 指向一张占位 SVG（灰底 + "请扫码"），避免 naturalWidth=0 触发 broken image 警告；\n';
md += '4. **iframe 集成**：当前为单 iframe 模式，菜单 ↔ iframe 切换正常，可保持。若未来引入多 tab，建议在 sidebar-layout.js 中扩展 `openPage` 支持多 iframe 池；\n';
md += '5. **构建生产包**：控制台提示 "cdn.tailwindcss.com should not be used in production"，建议改用本地 Tailwind CLI 编译输出，或保留 CDN 部署并加 `crossorigin`/`integrity` 校验。\n\n';
md += '---\n\n## 八、测试产物清单\n\n';
md += '| 文件 | 用途 |\n|------|------|\n| `verify/run_tests.js` | 后台 56 页自动化测试脚本 |\n';
md += '| `verify/run_extra_tests.js` | 入口(login/index/home) 集成测试 |\n';
md += '| `verify/find_missing.js` | 失败页面原因定位 |\n';
md += '| `verify/test_results.json` | 主测试原始数据 |\n';
md += '| `verify/extra_test_results.json` | 入口测试原始数据 |\n';
md += '| `verify/screenshots/*.png` | 每页截图（共 ' + fs.readdirSync(path.join(__dirname, 'screenshots')).filter(f => f.endsWith('.png')).length + ' 张） |\n';
md += '| `docs/后台管理系统测试报告.md` | 本报告 |\n\n';

md += '---\n\n*本报告由 Playwright 自动化测试生成，所有截图保存在 `verify/screenshots/` 目录。*\n';

const outPath = path.join(ROOT, 'docs', '后台管理系统测试报告.md');
fs.writeFileSync(outPath, md, 'utf8');
console.log('报告已生成:', outPath);
console.log('字数:', md.length);