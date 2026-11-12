/**
 * 消费者 H5 · 优惠券数据层
 * --------------------------------------------------------------
 * 严格空库模式：券清单来自后端 sf_mall_coupon（resource='coupon'），
 * 已选券码仅作为跨页会话状态存放 sessionStorage（非业务落库）。
 *
 * 暴露 API（签名与既有 H5 页面保持一致）：
 *   MallCoupons.ready        Promise，初始化完成
 *   MallCoupons.all()        全部启用中的券
 *   MallCoupons.get(code)    按券码取券
 *   MallCoupons.calc(subtotal, code)  按券规则计算优惠金额
 *   MallCoupons.selected()   当前已选券码（sessionStorage['h5_coupon_code']）
 *   MallCoupons.select(code) 选中券码
 *   MallCoupons.clear()      清除已选券
 *   MallCoupons.subscribe(fn)
 */
(function (global) {
  'use strict';

  var SELECTED_KEY = 'h5_coupon_code';

  var subs = [];
  var cache = [];
  var loadPromise = null;

  function H5Data() { return global.H5Data; }

  function load() {
    if (loadPromise) return loadPromise;
    var d = H5Data();
    loadPromise = (d && typeof d.list === 'function')
      ? d.list('coupon')
      : Promise.resolve([]);
    loadPromise = loadPromise.then(function (list) {
      cache = (Array.isArray(list) ? list : []).filter(function (c) { return c.status !== 'off'; });
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
    var list = all();
    subs.forEach(function (fn) {
      try { fn(list); } catch (e) { /* 单个订阅异常不影响其他 */ }
    });
  }

  function todayIso() { return new Date().toISOString().slice(0, 10); }
  function couponUsable(c) {
    if (!c || c.status === 'off') return false;
    var t = todayIso();
    if (c.validFrom && t < c.validFrom) return false;
    if (c.validTo && t > c.validTo) return false;
    if (c.totalQty > 0 && c.issuedQty >= c.totalQty) return false;
    return true;
  }

  global.MallCoupons = {
    KEY: 'coupon',
    all: function () {
      return all().filter(couponUsable);
    },
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
      try { return sessionStorage.getItem(SELECTED_KEY) || ''; } catch (e) { return ''; }
    },
    select: function (code) {
      try { sessionStorage.setItem(SELECTED_KEY, code || ''); } catch (e) { /* 忽略 */ }
    },
    clear: function () {
      try { sessionStorage.removeItem(SELECTED_KEY); } catch (e) { /* 忽略 */ }
    },
    subscribe: function (fn) {
      if (typeof fn === 'function') subs.push(fn);
    },
    ready: load()
  };
})(window);
