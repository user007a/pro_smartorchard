/**
 * icons.js — 全站统一图标库（对齐 demo：iconify + Remix Icon）
 *
 * demo/ 使用 iconify 加载 Remix Icon（ri:*）。本文件把图标收敛成语义常量，
 * 页面统一用 Icons.icon('edit') 或 <i data-uicon="edit"></i> 渲染，
 * 避免各处手写 SVG / 图标名不一致。
 *
 * 依赖：https://code.iconify.design/3/3.1.1/iconify.min.js（需在页面引入）
 */
(function (global) {
  'use strict';

  /** 语义图标表（全部取自 demo 实际使用的 Remix Icon） */
  var ICONS = {
    // 导航 / 通用
    home: 'ri:home-4-line',
    dashboard: 'ri:dashboard-3-line',
    menu: 'ri:menu-fold-line',
    search: 'ri:search-line',
    refresh: 'ri:refresh-line',
    settings: 'ri:settings-3-line',
    config: 'ri:settings-4-line',
    close: 'ri:close-line',
    arrowRight: 'ri:arrow-right-s-line',
    arrowUp: 'ri:arrow-up-line',
    check: 'ri:check-line',
    notification: 'ri:notification-3-line',

    // 数据 / 图表
    chartBar: 'ri:bar-chart-box-line',
    chartTree: 'ri:node-tree',
    table: 'ri:table-alt-line',
    grid: 'ri:layout-grid-line',
    fileList: 'ri:file-list-3-line',

    // 操作
    add: 'ri:add-line',
    edit: 'ri:edit-box-line',
    delete: 'ri:delete-bin-line',
    stack: 'ri:stack-line',
    expand: 'ri:expand-up-down-line',
    download: 'ri:download-2-line',
    upload: 'ri:upload-2-line',
    scan: 'ri:qr-scan-2-line',
    print: 'ri:printer-line',
    filter: 'ri:filter-3-line',

    // 业务语义
    plant: 'ri:plant-line',
    seed: 'ri:seedling-line',
    sun: 'ri:sun-line',
    drop: 'ri:drop-line',
    temp: 'ri:temp-hot-line',
    bug: 'ri:bug-line',
    flask: 'ri:flask-line',
    truck: 'ri:truck-line',
    box: 'ri:box-3-line',
    store: 'ri:store-2-line',
    wallet: 'ri:wallet-3-line',
    device: 'ri:device-line',
    camera: 'ri:camera-line',
    drone: 'ri:rocket-line',
    map: 'ri:map-pin-line',
    shield: 'ri:shield-check-line',
    alert: 'ri:error-warning-line',
    warning: 'ri:alert-line',
    success: 'ri:checkbox-circle-line',
    fail: 'ri:close-circle-line',
    clock: 'ri:time-line',
    calendar: 'ri:calendar-line',
    user: 'ri:user-settings-line',
    team: 'ri:team-line',
    phone: 'ri:smartphone-line',
    key: 'ri:shield-keyhole-line',
    magic: 'ri:magic-line',
    medal: 'ri:vip-crown-2-line',
    tag: 'ri:price-tag-3-line',
    link: 'ri:link-m',
    eye: 'ri:eye-line',
    eyeOff: 'ri:eye-off-line',
    star: 'ri:star-line',
    info: 'ri:information-line'
  };

  /**
   * 渲染图标 HTML
   * @param {string} name 语义名，如 'edit'
   * @param {string} cls  附加 class（尺寸/颜色由页面的 CSS 控制）
   */
  function icon(name, cls) {
    var id = ICONS[name] || (name.indexOf(':') > -1 ? name : 'ri:question-line');
    return '<span class="iconify' + (cls ? ' ' + cls : '') + '" data-icon="' + id + '"></span>';
  }

  /** 把容器内所有 [data-uicon] 占位替换为真实图标 */
  function mount(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('[data-uicon]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.dataset.uiconDone === '1') continue;
      el.dataset.uiconDone = '1';
      var name = el.getAttribute('data-uicon');
      var id = ICONS[name] || name;
      el.classList.add('iconify');
      el.setAttribute('data-icon', id);
    }
    if (global.Iconify && global.Iconify.scan) global.Iconify.scan(scope);
  }

  global.Icons = { map: ICONS, icon: icon, mount: mount };

  // 首屏自动挂载 + iconify 异步就绪后再扫一次
  function boot() {
    mount(document);
    if (global.Iconify && global.Iconify.scan) global.Iconify.scan(document);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  window.addEventListener('load', boot);
})(window);
