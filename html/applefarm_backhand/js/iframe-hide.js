/**
 * iframe-hide.js - 子页面在 iframe 中运行时自动隐藏自身导航栏
 *
 * 当页面被 index.html 的 <iframe> 加载时：
 * - 隐藏侧边栏(.sidebar)、顶栏(.topbar)、遮罩(.sidebar-overlay)
 * - 让 .main-wrapper 撑满全屏，只显示业务内容
 *
 * 使用方式：在所有子页面 </body> 前引入
 *   <script src="js/iframe-hide.js"></script>
 */
(function () {
  'use strict';

  // 只在 iframe 中生效，正常打开时不做任何事
  if (window.self === window.top) return;

  // ===== 隐藏导航元素 =====
  var hideSelectors = [
    '.sidebar',          // 侧边栏
    '.topbar',           // 顶部导航栏
    '.sidebar-overlay'   // 侧边栏遮罩层
  ];

  hideSelectors.forEach(function (selector) {
    var els = document.querySelectorAll(selector);
    for (var i = 0; i < els.length; i++) {
      els[i].style.display = 'none';
    }
  });

  // ===== 调整布局：让 main-wrapper 撑满 =====
  // .app-layout 原本是 flex 容器（sidebar + main-wrapper 并排）
  // 隐藏 sidebar 后，main-wrapper 需要撑满
  var appLayout = document.querySelector('.app-layout');
  if (appLayout) {
    appLayout.style.display = 'block';
    appLayout.style.padding = '0';
    appLayout.style.margin = '0';
  }

  var mainWrapper = document.querySelector('.main-wrapper');
  if (mainWrapper) {
    mainWrapper.style.width = '100%';
    mainWrapper.style.marginLeft = '0';
    mainWrapper.style.paddingTop = '0';       // 顶栏已隐藏，不需要 padding-top
    mainWrapper.style.height = 'auto';
    mainWrapper.classList.remove('sidebar-collapsed');
  }

  // ===== 隐藏汉堡菜单按钮（移动端）=====
  var hamburger = document.querySelector('.topbar-hamburger');
  if (hamburger) hamburger.style.display = 'none';

})();
