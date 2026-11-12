/**
 * 精确分类：对每个未订阅页面，判断其「列表/主体渲染数据」是否来自 store。
 * 做法：找出把 store 数据塞进渲染容器（innerHTML / textContent / .map -> 行）的代码块。
 */
const fs = require('fs');
const path = require('path');

const ROOT = 'd:\\dev\\pro_smartorchard';

const EVENT_OF = {
  SoilStore: 'soilStoreChange', CertStore: 'certStoreChange', ProductionStore: 'productionStoreChange',
  DeviceStore: 'deviceStoreChange', HarvestStore: 'harvestStoreChange', TraceStore: 'traceStoreChange',
  SalesStore: 'salesStoreChange', MaterialStore: 'materialStoreChange', EnterpriseStore: 'enterpriseStoreChange',
  BizStore: 'bizStoreChange', MallStore: 'mallStoreChange', AdoptionStore: 'adoptionStoreChange',
  DataStore: 'dataStoreChange', ModelStore: 'modelStoreChange', MobileOpsStore: 'mobileOpsStoreChange',
  VRStore: 'vrStoreChange', AlertStore: 'alertStoreChange', TraceStatStore: 'traceStatStoreChange',
};

const NEEDS = JSON.parse(fs.readFileSync(path.join(ROOT, 'needs-subscribe.json'), 'utf8'));

for (const [rel, stores] of Object.entries(NEEDS)) {
  const file = path.join(ROOT, rel);
  const c = fs.readFileSync(file, 'utf8');
  const lines = c.split(/\r?\n/);

  // 记录每个函数体内是否出现 store 读取 + 是否出现 DOM 写入
  let cur = null;
  const fnInfo = new Map();
  for (const line of lines) {
    const fm = /function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(line);
    if (fm) { cur = fm[1]; if (!fnInfo.has(cur)) fnInfo.set(cur, { store: false, dom: false, storeNames: [] }); }
    if (!cur) continue;
    const info = fnInfo.get(cur);
    if (/innerHTML|textContent|\.html\s*=|appendChild|insertAdjacentHTML/.test(line)) info.dom = true;
    for (const s of stores) {
      if (new RegExp('\\b' + s + '\\s*\\.').test(line)) { info.store = true; info.storeNames.push(s); }
    }
  }

  // 别名形式
  const aliases = {};
  for (const s of stores) {
    const am = new RegExp('(?:var|let|const)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(?:window\\.)?' + s + '\\b').exec(c);
    if (am) aliases[am[1]] = s;
  }
  if (Object.keys(aliases).length) {
    for (const line of lines) {
      for (const [alias, s] of Object.entries(aliases)) {
        if (new RegExp('\\b' + alias + '\\s*\\.').test(line)) {
          for (const [name, info] of fnInfo) {
            // 粗略：只要该函数体内出现过别名读取即认为消费 store
          }
        }
      }
    }
  }

  const consumers = [...fnInfo.entries()].filter(([n, i]) => i.store && i.dom).map(([n]) => n);
  const storeOnly = [...fnInfo.entries()].filter(([n, i]) => i.store && !i.dom).map(([n]) => n);
  console.log(`${rel}\n    渲染消费store: ${consumers.join(', ') || '-'}\n    仅读取store: ${storeOnly.join(', ') || '-'}`);
}
