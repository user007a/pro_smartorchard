/**
 * 消费者 H5 · 优惠券数据层
 * --------------------------------------------------------------
 * 统一读取后台「商城管理 / 优惠券管理」维护的券清单（localStorage['mall_coupons']），
 * 消除购物车（h5_cart.html）与结算页（h5_checkout.html）两处重复定义的口径漂移。
 *
 * 暴露 API：
 *   MallCoupons.ready        Promise，初始化完成
 *   MallCoupons.all()        全部启用中的券
 *   MallCoupons.get(code)    按券码取券
 *   MallCoupons.calc(subtotal, code)  按券规则计算优惠金额
 *   MallCoupons.selected()   当前已选券码（localStorage['h5_coupon_code']）
 *   MallCoupons.select(code) 选中券码
 *   MallCoupons.clear()      清除已选券
 *   MallCoupons.subscribe(fn)
 */

(function (global) {
  'use strict';

  var KEY = 'mall_coupons';
  var SELECTED_KEY = 'h5_coupon_code';

  /* 与后台 mall_coupon.html 的 DEFAULT_COUPONS 保持一致 */
  var DEFAULT_COUPONS = [
    { code: 'cash10',    name: '满100减10', type: 'cash',    value: 10, min: 100, status: 'on', desc: '订单满 100 元可用' },
    { code: 'cash30',    name: '满200减30', type: 'cash',    value: 30, min: 200, status: 'on', desc: '订单满 200 元可用' },
    { code: 'percent9',  name: '9折优惠券', type: 'percent', value: 9,  min: 0,   status: 'on', desc: '无门槛，全场 9 折' }
  ];

  var subs = [];
  var cache = null;

  function all() {
    if (cache) return cache;
    var list = null;
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (Array.isArray(v) && v.length) list = v;
    } catch (e) { list = null; }
    if (!list) {
      list = DEFAULT_COUPONS.map(function (c) { return Object.assign({}, c); });
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* 只读降级 */ }
    }
    cache = list.filter(function (c) { return c.status !== 'off'; });
    return cache;
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

  global.MallCoupons = {
    KEY: KEY,
    all: all,
    get: function (code) {
      var list = all();
      for (var i = 0; i < list.length; i++) {
        if (list[i].code === code) return list[i];
      }
      return null;
    },
    calc: function (subtotal, code) {
      var c = this.get(code);
      if (!c) return 0;
      var amount = Number(subtotal) || 0;
      if (amount < (Number(c.min) || 0)) return 0;
      var d = c.type === 'cash'
        ? Number(c.value) || 0
        : Math.round(amount * (1 - (Number(c.value) || 0) / 10));
      return Math.max(0, Math.min(d, amount));
    },
    selected: function () {
      try { return localStorage.getItem(SELECTED_KEY) || ''; } catch (e) { return ''; }
    },
    select: function (code) {
      try { localStorage.setItem(SELECTED_KEY, code || ''); } catch (e) { /* 忽略 */ }
    },
    clear: function () {
      try { localStorage.removeItem(SELECTED_KEY); } catch (e) { /* 忽略 */ }
    },
    subscribe: function (fn) {
      if (typeof fn === 'function') subs.push(fn);
    },
    ready: Promise.resolve(all())
  };
})(window);
