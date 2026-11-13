/**
 * _check.js — 移动端页面自检（开发辅助，不参与运行）
 * 1. 解析每个 .html 中无 src 的内联 <script>，用 vm.Script 校验语法
 * 2. 扫描「演示数据」类残留文案
 * 用法：cd html/applefarm_mobile && node _check.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const DEMO_PATTERN = /演示数据|演示账号|以下为演示|示例数据|模拟数据/g;

let syntaxErrors = 0;
let demoHits = 0;
const issues = [];

function checkFile(file) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');

  // 内联脚本语法
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const body = m[2] || '';
    if (!body.trim()) continue;
    const offset = html.slice(0, m.index).split('\n').length;
    try {
      new vm.Script(body, { filename: rel });
    } catch (e) {
      syntaxErrors++;
      issues.push('SYNTAX  ' + rel + ':' + offset + '  ' + e.message);
    }
  }

  // 演示数据残留
  const lines = html.split('\n');
  lines.forEach(function (line, i) {
    DEMO_PATTERN.lastIndex = 0;
    if (DEMO_PATTERN.test(line)) {
      demoHits++;
      issues.push('DEMO    ' + rel + ':' + (i + 1) + '  ' + line.trim().slice(0, 80));
    }
  });
}

function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (d) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) {
      if (d.name === 'node_modules') return;
      walk(p);
    } else if (/\.html$/i.test(d.name)) {
      checkFile(p);
    }
  });
}

walk(ROOT);
issues.forEach(function (s) { console.log(s); });
console.log('\n共 ' + issues.length + ' 项，其中语法错误 ' + syntaxErrors + ' 处');
process.exit(syntaxErrors ? 1 : 0);
