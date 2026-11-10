/**
 * 批量校验 HTML 页内联 <script> 的语法
 * 用法：node html/applefarm_backhand/js/shared/_html-syntax-check.js a.html b.html ...
 *        node ... --all   （校验 html/applefarm_backhand 下全部页面）
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const args = process.argv.slice(2);
let files = [];

function collectHtml(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) collectHtml(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

if (args.includes('--all')) {
  const roots = [
    path.join(__dirname, '..', '..'),
    path.join(__dirname, '..', '..', 'applefarm_mobile'),
    path.join(__dirname, '..', '..', 'applefarm_dataanlye')
  ];
  for (const r of roots) {
    if (fs.existsSync(r)) collectHtml(r, files);
  }
} else {
  files = args.map((a) => path.resolve(a));
}

let bad = 0, checked = 0;

for (const f of files) {
  if (!fs.existsSync(f)) { console.log('MISSING ' + f); bad++; continue; }
  const html = fs.readFileSync(f, 'utf8');
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, i = 0;
  while ((m = re.exec(html)) !== null) {
    i++;
    const code = m[1];
    if (!code.trim()) continue;
    checked++;
    try {
      new vm.Script(code, { filename: f + '#inline' + i });
    } catch (e) {
      bad++;
      console.log('SYNTAX ERROR  ' + path.relative(process.cwd(), f) + '  inline#' + i);
      console.log('   ' + String(e.message).split('\n')[0]);
    }
  }
}

console.log('检查文件 ' + files.length + ' 个，内联脚本 ' + checked + ' 段，错误 ' + bad + ' 处');
process.exit(bad ? 1 : 0);
