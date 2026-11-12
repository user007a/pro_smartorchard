/**
 * 审计：各页面引入的脚本清单（判断能否使用 StoreLive 助手）
 */
const fs = require('fs');
const path = require('path');

const ROOT = 'd:\\dev\\pro_smartorchard';
const HTML_ROOT = path.join(ROOT, 'html');

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
  const scripts = [...c.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
  const hasCommon = scripts.some((s) => s.includes('common-functions.js'));
  const sharedStores = scripts.filter((s) => s.includes('shared/') || s.includes('js/material-store'));
  const flags = [];
  if (!hasCommon) flags.push('NO-common-functions');
  if (!sharedStores.length) flags.push('no-shared-store-script');
  console.log(`${rel}\n    stores: ${sharedStores.join(', ') || '-'}  ${flags.join(' | ')}`);
}
