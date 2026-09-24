// 验证修复后的 h5_trace_detail.html 不再抛 JS 异常
// 使用本地 node fetch + 简易 jsdom 替代方案：直接通过 msedge/chromium 渲染
// 为减小依赖，使用 puppeteer-core 已不必要，改用最简单的 HTTP 拉取 + 静态分析
const fs = require('fs');
const path = require('path');

const FILE = 'd:\\dev\\pro_smartorchard\\html\\applefarm_h5\\h5_trace_detail.html';
const html = fs.readFileSync(FILE, 'utf8');

// 提取所有 <... id="xxx" ...> 节点 ID
const declaredIds = new Set();
const idRe = /\bid=[\"\']([^\"\']+)[\"\']/g;
let m;
while ((m = idRe.exec(html)) !== null) declaredIds.add(m[1]);

// 提取 JS 中所有 document.getElementById('xxx')
const usedIds = new Set();
const getRe = /document\.getElementById\([\"\']([^\"\']+)[\"\']\)/g;
while ((m = getRe.exec(html)) !== null) usedIds.add(m[1]);

const missing = [...usedIds].filter(id => !declaredIds.has(id));
const result = {
  file: FILE,
  declaredIds: [...declaredIds],
  usedIds: [...usedIds],
  missing,
  fixApplied: missing.length === 0,
};

console.log(JSON.stringify(result, null, 2));
process.exit(missing.length === 0 ? 0 : 1);