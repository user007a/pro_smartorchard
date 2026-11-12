/**
 * 语法校验：抽取所有 HTML 内联 <script> 与独立 .js 文件，用 vm 编译检查语法。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = 'd:\\dev\\pro_smartorchard';
const HTML_ROOT = path.join(ROOT, 'html');

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(HTML_ROOT, []);
const errors = [];
let checked = 0;

// 1. 独立 js 文件
for (const f of files) {
  if (!f.endsWith('.js')) continue;
  const src = fs.readFileSync(f, 'utf8');
  try {
    new vm.Script(src, { filename: f });
    checked++;
  } catch (e) {
    errors.push({ file: path.relative(ROOT, f), line: e.lineNumber, msg: e.message });
  }
}

// 2. HTML 内联 script
for (const f of files) {
  if (!f.endsWith('.html')) continue;
  const c = fs.readFileSync(f, 'utf8');
  const re = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  let idx = 0;
  while ((m = re.exec(c)) !== null) {
    const code = m[1];
    if (!code.trim()) continue;
    // 计算起始行号
    const line = c.slice(0, m.index).split(/\r?\n/).length;
    try {
      new vm.Script(code, { filename: path.relative(ROOT, f) + '#inline' + idx });
      checked++;
    } catch (e) {
      errors.push({ file: path.relative(ROOT, f), line, msg: e.message });
    }
    idx++;
  }
}

console.log(`已校验 ${checked} 个脚本单元`);
if (errors.length) {
  console.log(`\n发现 ${errors.length} 处语法错误：`);
  for (const e of errors) {
    console.log(`  ${e.file}:${e.line}\n    ${e.msg}`);
  }
  process.exit(1);
} else {
  console.log('全部通过');
}
