/**
 * 消费者 H5 · 商品数据层
 * --------------------------------------------------------------
 * 统一读取后台「商城管理 / 商品管理」维护的商品清单（localStorage['mall_products']），
 * 后台未初始化时回退到内置默认清单，保证 H5 端可独立运行。
 *
 * 暴露 API：
 *   MallProducts.ready       Promise，初始化完成
 *   MallProducts.all()       全部商品
 *   MallProducts.onSale()    在售商品
 *   MallProducts.byCat(cat)  按分类筛选（fruit / gift / adopt）
 *   MallProducts.get(id)     按 SKU 取商品
 *   MallProducts.subscribe(fn) 订阅商品变更（含后台跨标签页更新）
 *   MallProducts.esc(s)      HTML 转义
 *   MallProducts.label(p)     卡片角标文案
 *   MallProducts.labelType(p) 角标样式
 */

(function (global) {
  'use strict';

  var KEY = 'mall_products';

  /* 与后台 mall_product.html 的 H5_DEFAULT_PRODUCTS 保持一致
     variety：品种筛选维度（解决多标签同 data-cat 无法区分的问题）
     spec：包装规格，下单时随商品写入订单，避免所有 SKU 都记成「5斤装」 */
  var DEFAULT_PRODUCTS = [
    { id: 'redFuji',  name: '花牛苹果 5斤装',   desc: '脆甜多汁 · 新鲜采摘', price: 68,   original: 88,   img: 'images/thumb_redfuji.jpg', cat: 'fruit', variety: 'huaniu', spec: '5斤装',  status: 'on',  tag: '热销' },
    { id: 'gala',     name: '嘎拉苹果 5斤装',   desc: '酸甜可口 · 皮薄肉嫩', price: 58,   original: 78,   img: 'images/thumb_gala.jpg',    cat: 'fruit', variety: 'gala',   spec: '5斤装',  status: 'on',  tag: '推荐' },
    { id: 'giftBox',  name: '精品礼盒装 8斤',   desc: '送礼佳品 · 品质保证', price: 168,  original: 198,  img: 'images/thumb_giftbox.jpg', cat: 'gift',  variety: 'mixed', spec: '8斤装',  status: 'on',  tag: '礼盒' },
    { id: 'adopt3yr', name: '认养果树3年套餐',  desc: '专属果树 · 全程溯源', price: 1888, original: 0,    img: 'images/thumb_tree.jpg',    cat: 'adopt', variety: 'huaniu', spec: '3年套餐', status: 'on',  tag: '认养' },
    { id: 'adopt1',   name: '花牛苹果认养1棵',  desc: '3年认养 · 专属标识', price: 1888, original: 0,    img: 'images/thumb_tree.jpg',    cat: 'adopt', variety: 'huaniu', spec: '1棵/3年', status: 'on',  tag: '热门' },
    { id: 'adopt2',   name: '花牛苹果认养2棵',  desc: '3年认养 · 优惠价',   price: 3588, original: 0,    img: 'images/thumb_tree.jpg',    cat: 'adopt', variety: 'huaniu', spec: '2棵/3年', status: 'off', tag: '优惠' }
  ];

  var TAG_TYPE = { 热销: 'error', 推荐: 'warning', 礼盒: 'info', 认养: 'default', 热门: 'success', 优惠: 'warning' };

  /* 品种筛选维度 → 中文标签（商城分类标签使用） */
  var VARIETY_LABEL = { huaniu: '花牛苹果', gala: '嘎拉苹果', mixed: '混装礼盒' };

  var subs = [];
  var cache = null;

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var v = JSON.parse(raw);
      return Array.isArray(v) && v.length ? v : null;
    } catch (e) {
      return null;
    }
  }

  function all() {
    if (cache) return cache;
    var list = read();
    if (!list) {
      list = DEFAULT_PRODUCTS.map(function (p) { return Object.assign({}, p); });
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* 只读降级 */ }
    }
    cache = list;
    return cache;
  }

  function invalidate() {
    cache = null;
  }

  function emit() {
    invalidate();
    subs.forEach(function (fn) {
      try { fn(all()); } catch (e) { /* 单个订阅异常不影响其他 */ }
    });
  }

  global.addEventListener('storage', function (e) {
    if (e.key === KEY) emit();
  });

  global.MallProducts = {
    KEY: KEY,
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
    ready: Promise.resolve(all())
  };
})(window);
