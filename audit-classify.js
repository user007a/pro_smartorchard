/**
 * 判定每个页面是「读 store」还是「自己调 API」：
 *   - 若页面存在 Api.get(...) 调用且取数函数负责渲染，则页面自取数，无需订阅 store 事件；
 *   - 若页面的渲染数据来自 Store.xxx()，则必须订阅 store 事件。
 */
const fs = require('fs');
const path = require('path');

const ROOT = 'd:\\dev\\pro_smartorchard';
const HTML_ROOT = path.join(ROOT, 'html');

const EVENT_OF = {
  SoilStore: 'soilStoreChange', CertStore: 'certStoreChange', ProductionStore: 'productionStoreChange',
  DeviceStore: 'deviceStoreChange', HarvestStore: 'harvestStoreChange', TraceStore: 'traceStoreChange',
  SalesStore: 'salesStoreChange', MaterialStore: 'materialStoreChange', EnterpriseStore: 'enterpriseStoreChange',
  BizStore: 'bizStoreChange', MallStore: 'mallStoreChange', AdoptionStore: 'adoptionStoreChange',
  DataStore: 'dataStoreChange', ModelStore: 'modelStoreChange', MobileOpsStore: 'mobileOpsStoreChange',
  VRStore: 'vrStoreChange', AlertStore: 'alertStoreChange', TraceStatStore: 'traceStatStoreChange',
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
for (const f of files.sort()) {
  const c = fs.readFileSync(f, 'utf8');
  const rel = path.relative(ROOT, f);

  const missing = [];
  for (const [store, ev] of Object.entries(EVENT_OF)) {
    if (!new RegExp('\\b' + store + '\\b').test(c)) continue;
    const has = c.includes(`addEventListener('${ev}'`) || c.includes(`${store}.subscribe`);
    if (!has) missing.push(store);
  }
  if (!missing.length) continue;

  // 页面是否自己调 API 取数（自有取数链路的页面不依赖 store 事件）
  const selfFetch = /\bApi\.get\s*\(/.test(c);
  // 页面从 store 读取数据：直接调用 Store.xxx() 或通过别名 X = window.StoreName
  // 注意只统计「读」用法；仅有写用法（save/upsert/remove）不算依赖 store 事件
  const READ_ONLY_STORE = {
    SoilStore: ['tests', 'latest', 'summary', 'plotList', 'plots'],
    CertStore: ['certs', 'qualifications', 'batchCerts', 'get', 'filter', 'stats'],
    ProductionStore: ['plans', 'tasks', 'records', 'standards', 'get', 'routeList', 'patrolPlans', 'checkins', 'sorties', 'flightLogs', 'anomalies'],
    DeviceStore: ['devices', 'get', 'list', 'types', 'maintains', 'logs', 'spares', 'assets', 'commands'],
    HarvestStore: ['records', 'plans', 'processes', 'shipments', 'get'],
    TraceStore: ['codes', 'batches', 'templates', 'get'],
    SalesStore: ['customers', 'orders', 'payments', 'shipments', 'afterSales', 'pricePolicies', 'promotions', 'targets', 'statements'],
    MaterialStore: ['materials', 'list', 'get', 'find'],
    EnterpriseStore: ['enterprise', 'get', 'staff'],
    BizStore: ['revenueMix', 'costStructure', 'get'],
    MallStore: ['products', 'members', 'orders', 'coupons', 'promotions', 'afterSales', 'invoices', 'posts', 'claims', 'settings'],
    AdoptionStore: ['farmings', 'trees', 'orders', 'harvests', 'certs', 'photos', 'get'],
    DataStore: ['sources', 'collections', 'achievements', 'milestones', 'highlights', 'get'],
    ModelStore: ['get', 'config', 'phases', 'risk', 'weather', 'price', 'yield'],
    MobileOpsStore: ['feedbacks', 'expertQuestions', 'staff', 'messages', 'news', 'syncQueue'],
    VRStore: ['scenes', 'scene', 'hotspots'],
    AlertStore: ['alerts', 'rules', 'get'],
    TraceStatStore: ['certificates', 'flow', 'provinces', 'stats'],
  };
  const readsStore = missing.filter((s) => {
    const direct = new RegExp('\\b' + s + '\\s*\\.\\s*([A-Za-z_$][\\w$]*)', 'g');
    let hit = false;
    let m;
    while ((m = direct.exec(c)) !== null) {
      const fn = m[1];
      const allowed = READ_ONLY_STORE[s] || [];
      // 写方法名判定
      const isWrite = /^(save|upsert|remove|update|delete|add|create|replace|set|patch|reset|migrate|clear|submit|approve|reject|revoke|renew|advance|put)/i.test(fn);
      if (!isWrite && (allowed.length === 0 || allowed.includes(fn))) { hit = true; break; }
    }
    if (hit) return true;
    // 别名形式：const S = window.AdoptionStore;
    const aliasRe = new RegExp('(?:var|let|const)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*window\\.' + s + '\\b');
    const am = aliasRe.exec(c);
    if (!am) return false;
    const alias = am[1];
    const allowed = READ_ONLY_STORE[s] || [];
    const aliasRe2 = new RegExp('\\b' + alias + '\\s*\\.\\s*([A-Za-z_$][\\w$]*)', 'g');
    while ((m = aliasRe2.exec(c)) !== null) {
      const fn = m[1];
      const isWrite = /^(save|upsert|remove|update|delete|add|create|replace|set|patch|reset|migrate|clear|submit|approve|reject|revoke|renew|advance|put)/i.test(fn);
      if (!isWrite && (allowed.length === 0 || allowed.includes(fn))) return true;
    }
    return false;
  });

  const tag = selfFetch && !readsStore.length ? 'SELF-FETCH(无需订阅)' : 'READS-STORE(需订阅)';
  console.log(`${rel}\n    ${tag}  missing=[${missing.join(',')}]  readsStore=[${readsStore.join(',')}]`);
}
