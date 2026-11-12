/**
 * 为每个「需订阅」页面提取：store 读取点所归属的渲染函数。
 * 做法：在页面源码里定位 Store.xxx() 调用所在的函数名，即该函数是数据消费者。
 */
const fs = require('fs');
const path = require('path');

const ROOT = 'd:\\dev\\pro_smartorchard';

const PAGES = JSON.parse(fs.readFileSync(path.join(ROOT, 'needs-subscribe.json'), 'utf8'));

for (const [rel, stores] of Object.entries(PAGES)) {
  const file = path.join(ROOT, rel);
  const c = fs.readFileSync(file, 'utf8');
  const lines = c.split(/\r?\n/);

  // 建立「行号 → 所属函数」索引
  const fnStack = [];
  const fnAt = [];
  lines.forEach((line, i) => {
    const m = /function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(line);
    if (m) fnStack.push({ name: m[1], indent: line.match(/^\s*/)[0].length });
    fnAt.push(fnStack.length ? fnStack[fnStack.length - 1].name : '');
  });

  const consumers = new Set();
  stores.forEach((s) => {
    const patterns = [
      new RegExp('\\b' + s + '\\s*\\.\\s*([A-Za-z_$][\\w$]*)'),
      new RegExp('\\b' + s + '\\b'),
    ];
    lines.forEach((line, i) => {
      if (!patterns[0].test(line) && !patterns[1].test(line)) return;
      // 排除仅仅是声明/赋值行（如 const S = window.AdoptionStore;）
      if (/(var|let|const)\s+\w+\s*=\s*window\./.test(line)) return;
      if (/window\.\w*Store\s*=/.test(line)) return;
      if (fnAt[i]) consumers.add(fnAt[i]);
    });
  });

  const allFns = [...new Set([...c.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))];
  console.log(`${rel}\n    stores: ${stores.join(',')}\n    consumers: ${[...consumers].join(', ') || '-'}`);
}
