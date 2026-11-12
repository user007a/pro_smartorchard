/**
 * 消费者 H5 · 促销活动数据层
 * --------------------------------------------------------------
 * 严格空库模式：活动清单来自后端 sf_mall_promotion（resource='promotion'），
 * 不再读写 localStorage、不内置默认播种。
 *
 * 暴露 API（签名与既有 H5 页面保持一致）：
 *   MallPromotions.ready        Promise，初始化完成
 *   MallPromotions.all()        全部活动
 *   MallPromotions.onSale()     当前有效活动（启用且在起止日期内）
 *   MallPromotions.byTarget(t)  按展示位置筛选
 *   MallPromotions.get(id)      按活动 ID 取活动
 *   MallPromotions.isOnSale(p)  是否有效
 *   MallPromotions.subscribe(fn)
 *   MallPromotions.esc(s)       HTML 转义
 */
(function (global) {
  'use strict';

  var subs = [];
  var cache = [];
  var loadPromise = null;

  function H5Data() { return global.H5Data; }

  function today() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function load() {
    if (loadPromise) return loadPromise;
    var d = H5Data();
    loadPromise = (d && typeof d.list === 'function')
      ? d.list('promotion')
      : Promise.resolve([]);
    loadPromise = loadPromise.then(function (list) {
      cache = Array.isArray(list) ? list : [];
      emit();
      return cache;
    }).catch(function () {
      cache = [];
      return cache;
    });
    return loadPromise;
  }

  function all() { return cache; }

  /* 活动是否在有效期内（未配置日期视为长期有效） */
  function isOnSale(p) {
    if (!p || p.status === 'off') return false;
    if (p.status === 'ended' || p.status === 'stopped') return false;
    var t = today();
    if (p.startDate && t < p.startDate) return false;
    if (p.endDate && t > p.endDate) return false;
    return true;
  }

  function emit() {
    var list = all();
    subs.forEach(function (fn) {
      try { fn(list); } catch (e) { /* 单个订阅异常不影响其他 */ }
    });
  }

  global.MallPromotions = {
    KEY: 'promotion',
    all: all,
    onSale: function () {
      return all().filter(isOnSale);
    },
    byTarget: function (target) {
      return this.onSale().filter(function (p) { return (p.target || 'order') === target; });
    },
    get: function (id) {
      var list = all();
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id || list[i].title === id) return list[i];
      }
      return null;
    },
    isOnSale: isOnSale,
    subscribe: function (fn) {
      if (typeof fn === 'function') subs.push(fn);
    },
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    ready: load()
  };
})(window);
