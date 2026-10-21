/**
 * 消费者 H5 · 促销活动数据层
 * --------------------------------------------------------------
 * 统一读取后台「商城管理 / 促销活动管理」维护的活动清单（localStorage['mall_promotions']），
 * 后台未初始化时回退到内置默认清单，保证 H5 端可独立运行。
 *
 * 暴露 API：
 *   MallPromotions.ready        Promise，初始化完成
 *   MallPromotions.all()        全部活动
 *   MallPromotions.onSale()     当前有效活动（已启用且在起止日期内）
 *   MallPromotions.byTarget(t)  按展示位置筛选（order 首页最新活动 / goods 商品页活动）
 *   MallPromotions.get(id)      按活动 ID 取活动
 *   MallPromotions.subscribe(fn) 订阅活动变更（含后台跨标签页更新）
 *   MallPromotions.esc(s)       HTML 转义
 *   MallPromotions.DEFAULT_PROMOTIONS 内置默认清单
 */

(function (global) {
  'use strict';

  var KEY = 'mall_promotions';

  /* 与后台 mall_promotion.html 的 DEFAULT_PROMOTIONS 保持一致
     id 使用 H5 端 activityProducts 的键名，便于弹窗复用
     注：endDate 取未来固定日期，保证首次播种后首页活动位仍可见 */
  var DEFAULT_PROMOTIONS = [
    { id: 'springActivity', title: '春季果树认养特惠活动', subTitle: '认养果树享8折优惠，赠送有机肥料套装',
      price: 1510, original: 1888, img: 'images/apple_spring_orchard.jpg', tag: '限时活动',
      startDate: '2026-03-01', endDate: '2026-12-31', status: 'on', target: 'order' },
    { id: 'groupBuy', title: '花牛苹果拼团特惠', subTitle: '3人成团，立减20元，优质花牛苹果5斤装',
      price: 48, original: 68, img: 'images/apple_groupbuy_boxes.jpg', tag: '拼团',
      startDate: '2026-03-01', endDate: '2026-12-31', status: 'on', target: 'order' }
  ];

  var subs = [];
  var cache = null;

  function today() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

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
    // key 已存在但内容损坏/为空数组时视为「后台主动清空」，不静默回填默认
    if (!list && !keyExists()) {
      list = DEFAULT_PROMOTIONS.map(function (p) { return Object.assign({}, p); });
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* 只读降级 */ }
    }
    cache = list || [];
    return cache;
  }

  function keyExists() {
    try {
      return localStorage.getItem(KEY) !== null;
    } catch (e) {
      return false;
    }
  }

  /* 活动是否在有效期内（未配置日期视为长期有效） */
  function isOnSale(p) {
    if (!p || p.status === 'off') return false;
    var t = today();
    if (p.startDate && t < p.startDate) return false;
    if (p.endDate && t > p.endDate) return false;
    return true;
  }

  function emit() {
    cache = null;
    var list = all();
    subs.forEach(function (fn) {
      try { fn(list); } catch (e) { /* 单个订阅异常不影响其他 */ }
    });
  }

  global.addEventListener('storage', function (e) {
    if (e.key === KEY) emit();
  });

  global.MallPromotions = {
    KEY: KEY,
    DEFAULT_PROMOTIONS: DEFAULT_PROMOTIONS,
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
        if (list[i].id === id) return list[i];
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
    ready: Promise.resolve(all())
  };
})(window);
