/**
 * mobile-data.js — 移动端统一数据层（严格空库 · 只读后端）
 * --------------------------------------------------------------
 * 移动端所有业务页面统一经由本文件读库，页面内不得再出现任何硬编码演示数据。
 *
 * 设计约定：
 *   1. 唯一数据源 = 后端 REST（/api/<resource>，resource = sf_ 表名去前缀）。
 *      页面拿到的每一行都来自数据库；库中无数据时页面显示「暂无数据」空状态。
 *   2. list() 返回同步可用的内存快照；ready 预加载完成后触发一次全量广播，
 *      页面通过 subscribe() 重渲染。首次渲染为空态属正常（预加载在途）。
 *   3. 登录用户信息来自后端签发的 JWT（sf_mb_staff_account），不含任何本地造数。
 *   4. 统一空态与占位：empty() / dash()，保证「无数据」不伪装成「有数据」。
 *
 * 暴露 API：
 *   MobileData.ready              预加载完成 Promise
 *   MobileData.list(resource, params)   → 行数组（同步读快照）
 *   MobileData.rows(resource, params)   → Promise<行数组>
 *   MobileData.one(resource, id)        → 单行（同步）
 *   MobileData.reload(resource?)        → 失效缓存并重载
 *   MobileData.subscribe(fn)             → 订阅变更，返回 unsubscribe
 *   MobileData.user()                   → 当前登录用户（JWT 解出）
 *   MobileData.baseName()               → 当前用户所属基地名称
 *   MobileData.empty(msg)               → 空态 HTML
 *   MobileData.dash()                   → 占位「--」
 *   MobileData.esc(s)                   → HTML 转义
 *   MobileData.num(v, digits)           → 数值格式化
 *   MobileData.by(rows, key)            → 按字段分组
 *   MobileData.mapBy(rows, key)         → 字段 → 行 的映射
 *   MobileData.today()                  → 'YYYY-MM-DD'
 *   MobileData.dateText(v)              → 日期友好化
 */
(function (global) {
  'use strict';

  /* ============================================================
   * Api 依赖自动加载
   * ============================================================ */
  var depsReady = (function ensureDeps() {
    if (typeof document === 'undefined') return Promise.resolve();
    var selfEl = document.currentScript;
    if (!selfEl || !selfEl.src) return Promise.resolve();
    var baseDir = selfEl.src.replace(/[^\/]*$/, '');
    var deps = [{ name: 'Api', src: baseDir + '../../common/js/api.js' }];
    var pending = deps.filter(function (d) { return !global[d.name]; });
    if (!pending.length) return Promise.resolve();
    return Promise.all(pending.map(function (d) {
      return new Promise(function (resolve) {
        var s = document.createElement('script');
        s.src = d.src; s.async = false; s.onload = resolve; s.onerror = resolve;
        (document.head || global.document.documentElement).appendChild(s);
      });
    })).then(function () { return true; });
  })();

  /* ============================================================
   * 预加载资源清单（移动端首屏与高频页共用）
   * ============================================================ */
  var PRELOAD = [
    'base', 'plot', 'soil_test',
    'farming_plan', 'farming_task', 'farming_record',
    'patrol_checkin', 'patrol_abnormal', 'patrol_route',
    'material_info', 'material_io',
    'label_type', 'label_stock', 'label_record',
    'device', 'device_type', 'device_measure', 'device_log',
    'alert_record',
    'mb_message', 'mb_news', 'mb_staff_account', 'mb_expert_consult',
    'mb_disease_rule', 'mb_fault_kb', 'mb_ai_category', 'mb_ai_question',
    'adoption_tree', 'adoption_order', 'adoption_harvest', 'adoption_farming', 'adoption_cert',
    'vr_scene', 'vr_hotspot',
    'sales_price_policy', 'pest_risk', 'yield_forecast', 'phenology_stage'
  ];

  var cache = {};       // key -> 行数组
  var inflight = {};    // key -> Promise
  var listeners = [];
  var loaded = false;

  /* ============================================================
   * 工具
   * ============================================================ */
  function authed() {
    try {
      return !!(global.Api && typeof global.Api.isLoggedIn === 'function' && global.Api.isLoggedIn());
    } catch (e) { return false; }
  }

  function cacheKey(resource, params) {
    if (!params) return resource;
    var keys = Object.keys(params).sort();
    if (!keys.length) return resource;
    return resource + '?' + keys.map(function (k) { return k + '=' + params[k]; }).join('&');
  }

  function emit(reason) {
    listeners.forEach(function (fn) {
      try { fn(reason); } catch (e) { /* 单个订阅者异常不影响其他 */ }
    });
    try {
      global.dispatchEvent(new CustomEvent('mobileDataChange', { detail: { reason: reason } }));
    } catch (e) { /* ignore */ }
  }

  /* ============================================================
   * 读取
   * ============================================================ */
  function rows(resource, params) {
    var k = cacheKey(resource, params);
    return global.Api.get(resource, Object.assign({ size: 500 }, params || {})).then(function (res) {
      var list = (res && res.ok && res.data && Array.isArray(res.data.list)) ? res.data.list : [];
      cache[k] = list;
      return list;
    }).catch(function (e) {
      console.warn('[MobileData] 读取失败：' + resource, e);
      cache[k] = [];
      return [];
    });
  }

  /** 同步读快照（预加载完成后有值） */
  function list(resource, params) {
    var k = cacheKey(resource, params);
    if (Object.prototype.hasOwnProperty.call(cache, k)) return cache[k];
    return [];
  }

  function one(resource, id) {
    var list2 = list(resource);
    for (var i = 0; i < list2.length; i++) {
      if (String(list2[i].id) === String(id)) return list2[i];
    }
    return null;
  }

  /** 失效缓存并重载；不传 resource 则全量重载 */
  function reload(resource) {
    if (resource) {
      Object.keys(cache).forEach(function (k) {
        if (k === resource || k.indexOf(resource + '?') === 0) delete cache[k];
      });
    } else {
      cache = {};
    }
    return preload().then(function () { emit('reload:' + (resource || 'all')); });
  }

  /* ============================================================
   * 预加载
   * ============================================================ */
  function preload() {
    return Promise.resolve(depsReady).then(function () {
      if (!authed()) {
        loaded = true;
        emit('unauthenticated');
        return { ok: false, message: '未登录' };
      }
      return Promise.all(PRELOAD.map(function (res) {
        var k = cacheKey(res, null);
        if (Object.prototype.hasOwnProperty.call(cache, k)) return Promise.resolve(cache[k]);
        return rows(res).then(function (list2) {
          cache[k] = list2;
          return list2;
        });
      })).then(function () {
        loaded = true;
        emit('preload');
        return { ok: true };
      });
    }).catch(function (e) {
      console.warn('[MobileData] 预加载失败', e);
      loaded = true;
      emit('preload-error');
      return { ok: false, message: e && e.message };
    });
  }

  var ready = preload();

  /* ============================================================
   * 当前登录用户（来自后端签发的 JWT，源头 sf_mb_staff_account）
   * ============================================================ */
  function decodeToken(token) {
    try {
      var parts = String(token || '').split('.');
      if (parts.length < 2) return null;
      var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      return JSON.parse(decodeURIComponent(escape(global.atob(b64))));
    } catch (e) { return null; }
  }

  function user() {
    var token = '';
    try { token = global.localStorage.getItem('smartorchard_token') || ''; } catch (e) { token = ''; }
    var payload = decodeToken(token);
    if (!payload) return null;
    // 会话内补充后端返回的完整用户信息（手机号、所属基地等）
    var extra = {};
    try {
      extra = JSON.parse(global.sessionStorage.getItem('smartorchard_user_info') || '{}');
    } catch (e) { extra = {}; }
    return Object.assign({}, extra, {
      id: payload.id,
      account: payload.account || '',
      realName: payload.realName || extra.realName || '',
      role: payload.role || extra.role || '',
      phone: extra.phone || '',
      baseId: extra.baseId || '',
      isExpert: extra.isExpert
    });
  }

  /** 当前用户所属基地名称（sf_base.name） */
  function baseName() {
    var u = user();
    if (!u || !u.baseId) return '';
    var bases = list('base');
    for (var i = 0; i < bases.length; i++) {
      if (String(bases[i].id) === String(u.baseId)) return bases[i].name || '';
    }
    return '';
  }

  /* ============================================================
   * 展示辅助
   * ============================================================ */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function dash() { return '--'; }

  /** 统一空态：复用设计系统 .mb-empty.no-data 结构 */
  function empty(msg, desc) {
    return '<div class="mb-empty no-data">' +
      '<div class="mb-empty-icon">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
        '</svg>' +
      '</div>' +
      '<div class="mb-empty-title">' + esc(msg || '暂无数据') + '</div>' +
      (desc ? '<div class="mb-empty-desc">' + esc(desc) + '</div>' : '') +
    '</div>';
  }

  /** 行内空态（列表 / 卡片内的简短提示） */
  function inlineEmpty(msg) {
    return '<div class="mb-list-empty">' + esc(msg || '暂无数据') + '</div>';
  }

  function num(v, digits) {
    var n = parseFloat(v);
    if (isNaN(n)) return null;
    if (digits == null) return n;
    return Number(n.toFixed(digits));
  }

  function by(rows2, key) {
    var map = {};
    (rows2 || []).forEach(function (r) {
      var k = String(r[key] == null ? '' : r[key]);
      if (!map[k]) map[k] = [];
      map[k].push(r);
    });
    return map;
  }

  function mapBy(rows2, key) {
    var map = {};
    (rows2 || []).forEach(function (r) { map[String(r[key] == null ? '' : r[key])] = r; });
    return map;
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function dateText(v) {
    if (!v) return '';
    var s = String(v).replace('T', ' ').slice(0, 16);
    var d = new Date(s.replace(/-/g, '/'));
    if (isNaN(d.getTime())) return s;
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function dateTimeText(v) {
    if (!v) return '';
    return String(v).replace('T', ' ').slice(0, 16);
  }

  /* ============================================================
   * 导出
   * ============================================================ */
  var MobileData = {
    ready: ready,
    list: list,
    rows: rows,
    one: one,
    reload: reload,
    subscribe: function (fn) {
      if (typeof fn !== 'function') return function () {};
      listeners.push(fn);
      return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
    },
    user: user,
    baseName: baseName,
    esc: esc,
    dash: dash,
    empty: empty,
    inlineEmpty: inlineEmpty,
    num: num,
    by: by,
    mapBy: mapBy,
    today: today,
    dateText: dateText,
    dateTimeText: dateTimeText,
    isLoaded: function () { return loaded; },
    _emit: emit
  };

  global.MobileData = MobileData;
})(window);
