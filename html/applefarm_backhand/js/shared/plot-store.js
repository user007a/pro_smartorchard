/**
 * plot-store.js — 地块主数据统一数据层
 * --------------------------------------------------------------
 * 严格空库模式：地块的唯一真值源是 MySQL `sf_plot` 表，不落 localStorage。
 * 过去各消费方（土壤 / 采收 / 认养 / 设备 / 预警 / 数据运营 / 后台地块管理 /
 * 移动端 / 大屏）各自去读 localStorage 的 `smartorchard_plot_master`，
 * 而该键在全项目已无任何写入方，导致地块一律读空。本层把这 6 条支线
 * 统一收敛到 `Api.get('plot')`，并统一字段口径，避免各页面各写一套映射。
 *
 * 字段口径（唯一标准，其它层只做别名转换，不再自行解析 sf_plot）：
 *   id / code / name / base / enterprise / variety / area / trees / year
 *   manager / status / statusText / lng / lat / auditStatus / reviewer
 *   reviewRemark / reviewTime / source / boundary / remark
 *
 *   说明：sf_plot 无「基地名称 / 负责人 / 种植株数」列，这三项存 remark
 *   JSON 承载（与后台地块管理页的历史约定一致），读取时还原。
 *
 * 对外 API：
 *   PlotStore.ready             首屏加载完成的 Promise（页面可 await）
 *   PlotStore.load()            强制重新拉取，返回 Promise
 *   PlotStore.plots()           地块列表（统一字段）
 *   PlotStore.bases()           基地名列表 string[]
 *   PlotStore.basesWithCount()  基地 + 地块数 [{ name, plotCount }]
 *   PlotStore.plotOf(code)      按地块编号取
 *   PlotStore.plotOfId(id)      按 id 或编号取
 *   PlotStore.plotLabel(code)   "D-001 · 东区1号地"
 *   PlotStore.pendingReview()   待审核的手绘地块
 *   PlotStore.create(data) / update(id, data) / remove(id)
 *   PlotStore.subscribe(fn)     订阅变更，返回取消订阅函数
 */
(function (global) {
  'use strict';

  /* 防止被多次注入执行（页面 <script> 与 Store 动态注入可能同时存在） */
  if (global.PlotStore) return;

  var STATUS_TEXT = {
    normal: '正常', warning: '需施肥', danger: '病虫害',
    fallow: '休耕', maintain: '维护中'
  };

  /* ============================================================
   * 后端依赖自动加载（与 soil-store / harvest-store 同策略）
   * ============================================================ */
  var depsReady = (function ensureDeps() {
    if (typeof document === 'undefined') return Promise.resolve();
    var selfEl = document.currentScript;
    if (!selfEl || !selfEl.src) return Promise.resolve();
    var baseDir = selfEl.src.replace(/[^\/]*$/, '');
    var deps = [
      { name: 'Api', src: baseDir + '../../../common/js/api.js' }
    ];
    var pending = deps.filter(function (d) { return !global[d.name]; });
    if (!pending.length) return Promise.resolve();
    return Promise.all(pending.map(function (d) {
      return new Promise(function (resolve) {
        var s = document.createElement('script');
        s.src = d.src; s.async = false; s.onload = resolve; s.onerror = resolve;
        (document.head || document.documentElement).appendChild(s);
      });
    })).then(function () { return true; });
  })();

  function backendApi() {
    if (typeof global.Api !== 'object' && typeof global.Api !== 'function') return null;
    if (!global.Api.get) return null;
    return global.Api;
  }
  function backendEnabled() {
    var api = backendApi();
    if (!api) return false;
    try { return !!api.isLoggedIn(); } catch (e) { return false; }
  }

  /* ============================================================
   * 内存快照
   * ============================================================ */
  var plots = [];          // 统一字段的地块数组
  var baseList = [];       // 真实基地列表 [{ id, code, name }]
  var byCode = {};
  var byId = {};
  var loaded = false;
  var loadPromise = null;
  var subscribers = [];

  function num(v, def) {
    var n = parseFloat(v);
    return isNaN(n) ? (def === undefined ? 0 : def) : n;
  }
  function text(v) { return v == null ? '' : String(v); }

  /** 解析 remark 中的扩展 JSON（基地名 / 株数 / 负责人） */
  function readRemark(row) {
    var ext = {};
    try { ext = JSON.parse(row.remark || '{}') || {}; } catch (e) { ext = {}; }
    if (typeof ext !== 'object' || ext === null) ext = {};
    return ext;
  }

  /** 解析边界多边形顶点，容错：非法 JSON 返回空数组 */
  function readBoundary(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    try {
      var arr = JSON.parse(v);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  /** sf_plot 行 → 统一字段地块 */
  function mapRow(row, baseNameById) {
    var ext = readRemark(row);
    var baseName = row.base_id ? (baseNameById[row.base_id] || '') : '';
    var base = baseName || text(ext.enterprise);
    var auditStatus = text(row.audit_status);
    return {
      id: text(row.id),
      code: text(row.code),
      name: text(row.name),
      base: base,
      enterprise: base,                       // 旧字段名别名
      baseId: row.base_id == null ? '' : text(row.base_id),
      variety: text(row.variety_code || ext.variety),
      area: num(row.area),
      trees: num(ext.trees),
      year: text(row.plant_year),
      manager: text(ext.manager),
      status: text(row.plot_status) || 'normal',
      statusText: STATUS_TEXT[row.plot_status] || '正常',
      lng: row.lng == null ? null : num(row.lng),
      lat: row.lat == null ? null : num(row.lat),
      auditStatus: auditStatus,
      reviewStatus: auditStatus,             // 旧字段名别名
      reviewer: text(row.reviewer),
      reviewRemark: text(row.review_remark),
      reviewTime: text(row.review_time),
      source: text(row.source) || 'backend',
      boundary: readBoundary(row.boundary),
      remark: text(row.remark),
      plotType: text(row.plot_type),
      drawTime: text(row.draw_time)
    };
  }

  function reindex() {
    byCode = {};
    byId = {};
    plots.forEach(function (p) {
      if (p.code) byCode[p.code] = p;
      if (p.id) byId[p.id] = p;
    });
  }

  function notify(reason) {
    subscribers.forEach(function (fn) {
      try { fn(reason); } catch (e) { /* 单个订阅者异常不影响其它 */ }
    });
    // 窗口事件：地块台账是多页面基础数据源，页面需据此重绘下拉与名称
    try {
      global.dispatchEvent(new CustomEvent('plotStoreChange', { detail: { reason: reason } }));
    } catch (e) { /* ignore */ }
  }

  /* ============================================================
   * 加载
   * ============================================================ */
  function load() {
    if (loadPromise) return loadPromise;
    loadPromise = Promise.resolve(depsReady).then(function () {
      var api = backendApi();
      if (!api || !backendEnabled()) return { ok: false, message: '未登录或依赖未就绪' };
      return Promise.all([
        api.get('plot', { page: 1, size: 500, sort: 'id', order: 'asc' }),
        api.get('base', { page: 1, size: 500, sort: 'id', order: 'asc' })
      ]).then(function (rs) {
        var plotRes = rs[0], baseRes = rs[1];
        var baseNameById = {};
        var bases = [];
        if (baseRes && baseRes.ok && baseRes.data && Array.isArray(baseRes.data.list)) {
          baseList = baseRes.data.list;
          baseList.forEach(function (b) {
            baseNameById[b.id] = b.name || b.base_name || '';
            bases.push({ id: text(b.id), code: text(b.code), name: text(b.name || b.base_name) });
          });
        } else {
          baseList = [];
        }
        var rows = (plotRes && plotRes.ok && plotRes.data && Array.isArray(plotRes.data.list))
          ? plotRes.data.list : [];
        plots = rows.map(function (r) { return mapRow(r, baseNameById); });
        reindex();
        loaded = true;
        notify('loaded');
        return { ok: true, data: { list: plots, bases: bases } };
      });
    }).catch(function (err) {
      console.warn('[PlotStore] 地块加载失败', err);
      return { ok: false, message: err && err.message };
    }).finally(function () {
      loadPromise = null;
    });
    return loadPromise;
  }

  var ready = Promise.resolve(depsReady).then(function () {
    if (backendEnabled()) return load();
    return { ok: false, message: '未登录' };
  });

  /* ============================================================
   * 读取（同步读内存快照）
   * ============================================================ */
  function plotList() { return plots.slice(); }

  function plotOf(code) {
    var c = text(code);
    if (!c) return null;
    return byCode[c] || null;
  }

  function plotOfId(id) {
    var k = text(id).trim();
    if (!k) return null;
    return byId[k] || byCode[k] || null;
  }

  function bases() {
    var seen = {}, out = [];
    plots.forEach(function (p) {
      if (p.base && !seen[p.base]) { seen[p.base] = 1; out.push(p.base); }
    });
    return out.sort();
  }

  function basesWithCount() {
    var map = {};
    plots.forEach(function (p) {
      if (!p.base) return;
      map[p.base] = (map[p.base] || 0) + 1;
    });
    return Object.keys(map).sort().map(function (name) {
      return { name: name, plotCount: map[name] };
    });
  }

  function plotLabel(code) {
    var c = text(code);
    if (!c) return '';
    var hit = byCode[c];
    return hit && hit.name ? c + ' · ' + hit.name : c;
  }

  /** 待审核的手绘地块（移动端现场绘制、尚未并入总表） */
  function pendingReview() {
    return plots.filter(function (p) {
      return p.auditStatus === 'pending' || p.auditStatus === 'rejected';
    });
  }

  /* ============================================================
   * 写入（统一走 Api，成功后刷新快照）
   * ============================================================ */
  function create(data) {
    var api = backendApi();
    if (!api || !backendEnabled()) {
      return Promise.resolve({ ok: false, message: '未登录或依赖未就绪' });
    }
    return api.create('plot', data).then(function (res) {
      if (res && res.ok) load();
      return res;
    });
  }

  function update(id, data) {
    var api = backendApi();
    if (!api || !backendEnabled()) {
      return Promise.resolve({ ok: false, message: '未登录或依赖未就绪' });
    }
    return api.update('plot', id, data).then(function (res) {
      if (res && res.ok) load();
      return res;
    });
  }

  function remove(id) {
    var api = backendApi();
    if (!api || !backendEnabled()) {
      return Promise.resolve({ ok: false, message: '未登录或依赖未就绪' });
    }
    return api.remove('plot', id).then(function (res) {
      if (res && res.ok) load();
      return res;
    });
  }

  global.PlotStore = {
    ready: ready,
    load: load,
    plots: plotList,
    plotList: plotList,
    plotOf: plotOf,
    plotOfId: plotOfId,
    bases: bases,
    basesWithCount: basesWithCount,
    plotLabel: plotLabel,
    pendingReview: pendingReview,
    baseList: function () { return baseList.slice(); },
    isLoaded: function () { return loaded; },
    create: create,
    update: update,
    remove: remove,
    subscribe: function (fn) {
      subscribers.push(fn);
      return function () { subscribers = subscribers.filter(function (x) { return x !== fn; }); };
    }
  };

  /* 脚本装载后自动拉取一次，页面渲染时快照通常已就绪 */
  if (typeof document !== 'undefined') load();
})(typeof window !== 'undefined' ? window : this);
