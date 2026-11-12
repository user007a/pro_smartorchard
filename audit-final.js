/**
 * 输出每个待订阅页面的「store 读取表达式」与「渲染入口候选」，供人工确认。
 */
const fs = require('fs');
const path = require('path');

const ROOT = 'd:\\dev\\pro_smartorchard';
const NEEDS = JSON.parse(fs.readFileSync(path.join(ROOT, 'needs-subscribe.json'), 'utf8'));

for (const [rel, stores] of Object.entries(NEEDS)) {
  const file = path.join(ROOT, rel);
  const c = fs.readFileSync(file, 'utf8');
  const lines = c.split(/\r?\n/);

  // 找 store 读取表达式（Store.xxx() 或 别名.xxx()）
  const exprs = new Set();
  for (const s of stores) {
    for (const m of c.matchAll(new RegExp('\\b' + s + '\\s*\\.\\s*([A-Za-z_$][\\w$]*)\\s*\\(', 'g'))) {
      exprs.add(s + '.' + m[1] + '()');
    }
    const am = new RegExp('(?:var|let|const)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(?:window\\.)?' + s + '\\b').exec(c);
    if (am) {
      for (const m of c.matchAll(new RegExp('\\b' + am[1] + '\\s*\\.\\s*([A-Za-z_$][\\w$]*)\\s*\\(', 'g'))) {
        exprs.add(am[1] + '.' + m[1] + '()');
      }
    }
  }

  // 找 DOM 渲染函数
  const renderFns = [];
  for (const m of c.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = m[1];
    if (!/render|refresh|reload|load|paint|draw|sync|update|apply|list|table|stats/i.test(name)) continue;
    // 取函数体前 60 行，看是否含 store 读取或 API 调用
    const start = c.indexOf(m[0]);
    const body = c.slice(start, start + 3000);
    const hasStore = stores.some((s) => new RegExp('\\b' + s + '\\b|\\b[A-Za-z_$]+\\s*\\.\\s*(farmings|harvests|trees|orders|certs|photos|reservations|materials|customers|orders|payments|shipments|afterSales|pricePolicies|promotions|targets|statements|products|members|coupons|afterSales|invoices|posts|claims|settings|tests|plans|tasks|records|standards|devices|alerts|rules|scenes)\\s*\\(').test(body));
    const hasApi = /Api\.get\s*\(/.test(body);
    const hasDom = /innerHTML|textContent/.test(body);
    if (hasDom && (hasStore || hasApi)) renderFns.push(name + (hasStore ? '[S]' : '[A]'));
  }

  console.log(`${rel}`);
  console.log(`   reads: ${[...exprs].slice(0, 10).join(', ') || '-'}`);
  console.log(`   candidates: ${renderFns.join(', ') || '-'}`);
}
