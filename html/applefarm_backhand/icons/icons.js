/* ============================================
 * icons/icons.js — 图标库转发别名（唯一数据源：js/icons.js）
 * ============================================
 * 本文件与 js/icons.js 曾为两份同名实现。后台页面统一引用 js/icons.js，
 * 移动端页面以 `../applefarm_backhand/icons/icons.js` 引用本文件。
 *
 * 处理方式：保留本文件作为转发入口，按「引用者所在目录」解析到 js/icons.js，
 * 避免维护两份图标定义（全仓库仅保留单一数据源）。
 * ============================================ */
(function () {
  'use strict';

  /* 本文件位于 <root>/applefarm_backhand/icons/，目标为同级父目录的 js/icons.js，
     即从 icons/ 上溯一级。用绝对路径拼接以兼容任意深度的引用页面。 */
  function resolveSrc() {
    var here = document.currentScript && document.currentScript.src;
    if (!here) return null;
    var base = here.substring(0, here.lastIndexOf('/'));      // .../applefarm_backhand/icons
    var root = base.substring(0, base.lastIndexOf('/'));     // .../applefarm_backhand
    return root + '/js/icons.js';
  }

  var SRC = resolveSrc();
  if (!SRC) return;

  if (document.querySelector('script[data-icons-alias]')) return;

  // 页面解析阶段：同步写入，保证紧随其后的内联脚本能立刻用到 Icons
  if (document.readyState === 'loading') {
    document.write('<script src="' + SRC + '" data-icons-alias="1"><\/script>');
  } else {
    var s = document.createElement('script');
    s.src = SRC;
    s.setAttribute('data-icons-alias', '1');
    document.head.appendChild(s);
  }
})();