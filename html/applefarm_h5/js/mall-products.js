/**
 * 消费者 H5 · 商品数据层
 * --------------------------------------------------------------
 * 严格空库模式：商品清单来自后端 sf_mall_product（通用 CRUD resource='product'），
 * 通过 js/h5-data.js 拉取并做 snake→camel 映射；不再读写 localStorage、不内置默认播种。
 *
 * 暴露 API（签名与既有 H5 页面保持一致）：
 *   MallProducts.ready        Promise，初始化完成
 *   MallProducts.all()        全部商品
 *   MallProducts.onSale()     在售商品
 *   MallProducts.byCat(cat)   按分类筛选
 *   MallProducts.byVariety(v) 按品种筛选
 *   MallProducts.get(id)      按 SKU 取商品
 *   MallProducts.subscribe(fn) 订阅商品变更
 *   MallProducts.esc(s)       HTML 转义
 *   MallProducts.label(p)     卡片角标文案
 *   MallProducts.labelType(p) 角标样式
 */
(function (global) {
  'use strict';

  var TAG_TYPE = { 热销: 'error', 推荐: 'warning', 礼盒: 'info', 认养: 'default', 热门: 'success', 优惠: 'warning' };
  var VARIETY_LABEL = { huaniu: '花牛苹果', gala: '嘎拉苹果', mixed: '混装礼盒' };

  var subs = [];
  var cache = [];
  var loadPromise = null;

  function H5Data() { return global.H5Data; }

  function load() {
    if (loadPromise) return loadPromise;
    var d = H5Data();
    loadPromise = (d && typeof d.list === 'function')
      ? d.list('product')
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

  function emit() {
    subs.forEach(function (fn) {
      try { fn(all()); } catch (e) { /* 单个订阅异常不影响其他 */ }
    });
  }

  global.MallProducts = {
    KEY: 'product',
    all: all,
    onSale: function () {
      return all().filter(function (p) { return p.status !== 'off'; });
    },
    byCat: function (cat) {
      return all().filter(function (p) { return p.cat === cat; });
    },
    byVariety: function (v) {
      return all().filter(function (p) { return p.variety === v; });
    },
    specOf: function (p) {
      return (p && p.spec) || '标准装';
    },
    varietyLabel: function (v) {
      return VARIETY_LABEL[v] || '';
    },
    get: function (id) {
      var list = all();
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) return list[i];
      }
      return null;
    },
    subscribe: function (fn) {
      if (typeof fn === 'function') subs.push(fn);
    },
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    label: function (p) {
      return p.tag || '';
    },
    labelType: function (p) {
      return TAG_TYPE[p.tag] || 'default';
    },
    ready: load()
  };
})(window);
