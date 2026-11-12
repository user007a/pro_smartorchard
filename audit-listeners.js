/**
 * 审计：找出「使用了 store 但未订阅其变更事件」的页面，并列出候选渲染函数。
 * 一次性排查脚本，修复完成后可删除。
 */
const fs = require('fs');
const path = require('path');

const ROOT = 'd:\\dev\\pro_smartorchard';
const HTML_ROOT = path.join(ROOT, 'html');

const MAP = {
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

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const files = walk(HTML_ROOT, []);
const rows = [];
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  const missing = [];
  for (const [store, ev] of Object.entries(MAP)) {
    if (!new RegExp('\\b' + store + '\\b').test(c)) continue;
    // 直接订阅：Store.subscribe(...) 或 addEventListener('ev')
    let has = c.includes(`addEventListener('${ev}'`) || c.includes(`${store}.subscribe`);
    // 别名订阅：const S = window.Store; ... S.subscribe(...)
    if (!has) {
      const aliasRe = new RegExp('(?:var|let|const)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(?:window\\.)?' + store + '\\b', 'g');
      let m;
      while ((m = aliasRe.exec(c)) !== null) {
        if (new RegExp('\\b' + m[1] + '\\s*\\.\\s*subscribe\\s*\\(').test(c)) { has = true; break; }
      }
    }
    if (!has) missing.push(store);
  }
  if (!missing.length) continue;

  const fns = [...c.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]);
  const cands = [...new Set(fns.filter((f) => /^(render|refresh|reload|load|paint|draw|update|sync|apply)[A-Za-z0-9_]*$/.test(f)))];
  rows.push({
    page: path.relative(ROOT, f),
    missing,
    cands,
  });
}

rows.sort((a, b) => a.page.localeCompare(b.page));
for (const r of rows) {
  console.log(`${r.page}\n    missing: ${r.missing.join(', ')}\n    renders: ${r.cands.join(', ') || '(none)'}`);
}
console.log(`TOTAL ${rows.length}`);
