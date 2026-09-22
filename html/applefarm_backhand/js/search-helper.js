/**
 * search-helper.js — 全站搜索栏通用助手
 * smartSearch(): 触发页面自身的筛选/渲染函数（按优先级探测）
 * smartReset():  重置搜索栏内全部输入/下拉，并重新触发筛选
 * 由批量脚本注入到含搜索栏的页面；页面若已有同名函数则不冲突。
 */
(function () {
  var FN_PRIORITY = [
    'handleSearch', 'search', 'filterData', 'applyFilter', 'doSearch',
    'searchData', 'filterByStatus', 'renderTable', 'renderCertTable',
    'renderQueryTable', 'renderPlotTable'
  ];

  function pickFn() {
    for (var i = 0; i < FN_PRIORITY.length; i++) {
      var n = FN_PRIORITY[i];
      if (typeof window[n] === 'function') return window[n];
    }
    return null;
  }

  window.smartSearch = function () {
    var fn = pickFn();
    if (fn) { fn(); return; }
    if (window.Toast && Toast.show) Toast.show('提示', '当前页面暂无筛选逻辑');
  };

  window.smartReset = function () {
    var bar = document.querySelector('.search-bar') || document.querySelector('.search-section');
    if (bar) {
      bar.querySelectorAll('input[type="text"], input[type="search"]').forEach(function (i) { i.value = ''; });
      bar.querySelectorAll('input[type="date"]').forEach(function (i) { i.value = ''; });
      bar.querySelectorAll('select').forEach(function (s) { s.selectedIndex = 0; });
    }
    var fn = pickFn();
    if (fn) fn();
  };
})();
