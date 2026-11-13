/**
 * 智慧果园 · 模型数据只读绑定
 * --------------------------------------------------------------
 * 移动端 / 大屏等只读端用它在页面上绑定 ModelStore 中的字段，
 * 不再各自硬编码模型数据。后台修改模型数据后，本页刷新即同步；
 * 同源多标签页下会随 storage 事件自动刷新。
 *
 * 用法：
 *   <span data-mf="yield.kpi.0.value" data-mf-suffix=" 吨">450 吨</span>
 *   <span data-mf="price.saleWindow.title" data-mf-prefix="最佳窗口 "></span>
 *   <span data-mf="pest.kpi.0.value" data-mf-fallback="--"></span>
 *
 * 依赖：js/shared/model-store.js（必须先引入）
 */
(function(){
  'use strict';

  function render(){
    if (!window.ModelStore) return;
    var nodes = document.querySelectorAll('[data-mf]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var path = el.getAttribute('data-mf');
      var value = window.ModelStore.field(path);
      if (value === undefined || value === null || value === '') {
        /* 严格空库模式：库中无该模型数据时清空占位文案，
           禁止保留 HTML 里写死的演示值。未显式指定 fallback 时统一显示「--」。 */
        var fb = el.getAttribute('data-mf-fallback');
        el.textContent = (fb === null || fb === undefined) ? '--' : fb;
        continue;
      }
      el.textContent = (el.getAttribute('data-mf-prefix') || '') + value + (el.getAttribute('data-mf-suffix') || '');
    }
  }

  function boot(){
    render();
    if (window.ModelStore && window.ModelStore.subscribe) {
      window.ModelStore.subscribe(function(){ render(); });
    }
  }

  window.ModelBind = { render: render };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
