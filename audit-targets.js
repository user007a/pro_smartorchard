/**
 * 为「使用 store 但未订阅其变更事件」的页面自动注入重绘订阅。
 *
 * 注入位置：页面最后一个 <script> 块之前（页面主脚本末尾），
 *          以独立 IIFE 形式挂载，不依赖 DOMContentLoaded 时序。
 * 注入内容：StoreLive.on('<event>', <renderFn>)，
 *          StoreLive 由 common/js/api.js 提供（所有 store 页面都会加载）。
 *
 * 用法：node audit-targets.js [--dry]
 */
const fs = require('fs');
const path = require('path');

const ROOT = 'd:\\dev\\pro_smartorchard';

const EVENT_OF = {
  SoilStore: 'soilStoreChange',
  CertStore: 'certStoreChange',
  ProductionStore: 'productionStoreChange',
  DeviceStore: 'deviceStoreChange',
  HarvestStore: 'harvestStoreChange',
  TraceStore: 'traceStoreChange',
  SalesStore: 'salesStoreChange',
  MaterialStore: 'materialStoreChange',
  EnterpriseStore: 'enterpriseStoreChange',
  BizStore: 'bizStoreChange',
  MallStore: 'mallStoreChange',
  AdoptionStore: 'adoptionStoreChange',
  DataStore: 'dataStoreChange',
  ModelStore: 'modelStoreChange',
  MobileOpsStore: 'mobileOpsStoreChange',
  VRStore: 'vrStoreChange',
  AlertStore: 'alertStoreChange',
  TraceStatStore: 'traceStatStoreChange',
};

const PLAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'listener-plan.json'), 'utf8'));
const DRY = process.argv.includes('--dry');

let changed = 0;
const skipped = [];

for (const [rel, spec] of Object.entries(PLAN)) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { skipped.push(rel + ' (文件不存在)'); continue; }
  let c = fs.readFileSync(file, 'utf8');

  const missing = spec.stores.filter((s) => {
    const ev = EVENT_OF[s];
    let has = c.includes(`addEventListener('${ev}'`) || c.includes(`${s}.subscribe`);
    if (!has) {
      const aliasRe = new RegExp('(?:var|let|const)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(?:window\\.)?' + s + '\\b', 'g');
      let m;
      while ((m = aliasRe.exec(c)) !== null) {
        // 别名订阅：X.subscribe(...) / X.onChange(...)
        if (new RegExp('\\b' + m[1] + '\\s*\\.\\s*(subscribe|onChange)\\s*\\(').test(c)) { has = true; break; }
      }
    }
    return !has;
  });
  if (!missing.length) { skipped.push(rel + ' (已订阅)'); continue; }

  const fns = spec.fns.filter((f) => new RegExp('function\\s+' + f.replace(/[$]/g, '\\$') + '\\s*\\(').test(c));
  if (!fns.length) { skipped.push(rel + ' (渲染函数未找到: ' + spec.fns.join('/') + ')'); continue; }

  const events = missing.map((s) => EVENT_OF[s]);
  const body = fns.map((f) => `      ${f}();`).join('\n');

  const block =
    `\n/* ============================================================\n` +
    ` * 后端数据到达后自动重绘\n` +
    ` * ------------------------------------------------------------\n` +
    ` * 数据层在「后端预加载完成」与「本地写入」两条路径上都会派发\n` +
    ` * <store>StoreChange 窗口事件；页面若不监听，首次渲染发生在数据\n` +
    ` * 到达之前，界面会一直停在空列表。此处统一订阅后自动重绘。\n` +
    ` * ============================================================ */\n` +
    `(function () {\n` +
    `  if (typeof StoreLive === 'undefined') return;\n` +
    `  StoreLive.on(${JSON.stringify(events)}, function () {\n` +
    `${body}\n` +
    `  });\n` +
    `})();\n`;

  const idx = c.lastIndexOf('</script>');
  if (idx < 0) { skipped.push(rel + ' (无 script 结束标记)'); continue; }
  c = c.slice(0, idx) + block + c.slice(idx);

  if (!DRY) fs.writeFileSync(file, c, 'utf8');
  changed++;
  console.log(`[注入] ${rel}\n         events=${events.join(',')} fns=${fns.join(',')}`);
}

console.log(`\n已处理 ${changed} 个页面`);
if (skipped.length) {
  console.log('跳过：');
  skipped.forEach((s) => console.log('  - ' + s));
}
