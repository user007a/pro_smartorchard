/**
 * 农资共享仓库（农资管理模块）· 严格空库模式
 * ------------------------------------------------------------
 * 让"农资信息 / 农资库存 / 农资出入库 / 农资退货 / 农资使用"共享同一份数据。
 *
 * 严格空库约束：
 *   - 不内置任何演示种子数据，SEED 恒为空；
 *   - 数据一律来自 /api/material/aggregate，后端返回空数组时本地也必须为空；
 *   - 后端不可用或鉴权失败时明确报错，禁止静默降级到浏览器本地演示数据；
 *   - 业务数据不落浏览器磁盘（由 html/common/js/api.js 的严格模式闸门把
 *     localStorage 业务键重定向到页面生命周期内的内存镜像），刷新后只能由 API 重拉；
 *   - 预加载在途期间若用户已保存数据，跳过陈旧快照覆盖（竞态保护）。
 *
 * 用法：
 *   MaterialStore.all()                     获取农资主数据（含当前库存）
 *   MaterialStore.get('M-001' | 'NPK复合肥') 按编号或名称查询单个农资
 *   MaterialStore.stockOf(identifier)       查询当前库存（未登记返回 null）
 *   MaterialStore.statusOf(identifier)      查询库存状态 normal/danger/high
 *   MaterialStore.applyDelta(identifier, ±n) 增减库存，不足时为 ok:false
 *   MaterialStore.setStock(identifier, n)   直接设置库存（盘点用）
 *   MaterialStore.reset()                   清空本地镜像并重新从 API 拉取
 */
(function (global) {
  'use strict';

  /* ============================================================
   * 后端桥接依赖自动加载（策略 A：出入口映射）
   * ============================================================ */
  var depsReady = (function ensureDeps() {
    if (typeof document === 'undefined') return Promise.resolve();
    var selfEl = document.currentScript;
    if (!selfEl || !selfEl.src) return Promise.resolve();
    var baseDir = selfEl.src.replace(/[^\/]*$/, '');
    var deps = [
      { name: 'Api', src: baseDir + '../common/js/api.js' },
      { name: 'MaterialMapper', src: baseDir + 'material-mapper.js' }
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

  var backendLoadPromise = null;
  var persistTimer = null;

  function backendApi() {
    if (typeof global.Api !== 'object' && typeof global.Api !== 'function') return null;
    if (!global.Api.get || !global.Api.create) return null;
    if (typeof global.MaterialMapper === 'undefined') return null;
    return global.Api;
  }
  function backendEnabled() {
    var api = backendApi();
    if (!api) return false;
    try { return !!api.isLoggedIn(); } catch (e) { return false; }
  }
  function preloadFromBackend() {
    if (backendLoadPromise) return backendLoadPromise;
    /* 严格模式：记录预加载开始时的本地写入水位，返回时若用户已保存过数据则跳过覆盖 */
    var writeMark0 = global.__STRICT_DB_WRITES__ || 0;
    backendLoadPromise = Promise.resolve(depsReady).then(function () {
      var api = backendApi();
      if (!api || !api.isLoggedIn || !api.isLoggedIn()) return { ok: false, message: '未登录或依赖未就绪' };
      return api.get('material/aggregate');
    }).then(function (res) {
      if (res && res.ok && res.data) {
        if (typeof global.__STRICT_DB_WRITES__ === 'number' && global.__STRICT_DB_WRITES__ !== writeMark0) return res;
        var agg = global.MaterialMapper.toAggregate(res.data);
        /* 无条件以后端为准：空库返回空数组时，本地演示数据也必须被清掉 */
        persistList(agg.materials || [], true);
      }
      return res;
    }).catch(function (err) {
      /* 严格模式：禁止降级到浏览器本地演示数据，只报错 */
      console.error('[MaterialStore] 数据服务未连接，已禁止降级到本地数据', err);
      return { ok: false, message: err && err.message };
    });
  }
  function persistToBackend() {
    var api = backendApi();
    if (!api || !backendEnabled()) return Promise.resolve({ ok: false, message: '未登录或依赖未就绪' });
    var body = global.MaterialMapper.fromAggregate({ materials: load(), deleted: {} });
    return api.create('material/aggregate', body);
  }
  function schedulePersist(reason) {
    if (!backendEnabled()) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      persistTimer = null;
      persistToBackend().catch(function (e) { console.warn('[MaterialStore] 后端持久化失败', e); });
    }, 300);
  }

  var STORAGE_KEY = 'smartorchard_material_store_v1';
  var VERSION = 1;

  /* 严格空库模式：不内置任何演示种子数据，主数据一律来自 /api/material/aggregate。
     dailyUse = 日均消耗量，leadDays = 采购提前期（天），用于库存页折算可覆盖天数与补货建议。 */
  var SEED = [];

  function clone(list) {
    return list.map(function (m) { return Object.assign({}, m); });
  }

  /**
   * 直接读取 localStorage 中的库存数据（不做内存缓存）。
   * 每次调用都重新解析，保证多标签页 / 跨页面写入后本页读到的始终是最新值。
   */
  function readStored() {
    var raw = null;
    try { raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.version === VERSION && Array.isArray(parsed.materials)) {
        return parsed.materials;
      }
    } catch (e) { /* 数据损坏则走初始化分支 */ }
    return null;
  }

  function persistList(list, fromBackend) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, materials: list }));
      }
    } catch (e) { /* 隐私模式 / file:// 场景下忽略持久化失败 */ }
    /* 预加载写入是「读取后端」的结果，不能再回写后端，避免读-写循环 */
    if (!fromBackend && typeof schedulePersist === 'function') schedulePersist();
  }

  /** 取当前库存列表；无数据（空库）时返回空数组，绝不播种演示数据 */
  function load() {
    var stored = readStored();
    if (stored) return stored;
    return clone(SEED);
  }

  function findIn(list, identifier) {
    if (identifier === null || identifier === undefined) return null;
    var key = String(identifier).trim();
    if (!key) return null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].code === key || list[i].name === key) return list[i];
    }
    return null;
  }

  function find(identifier) {
    return findIn(load(), identifier);
  }

  function statusOfStock(stock, safety) {
    if (stock > safety * 1.5) return 'high';
    if (stock <= safety) return 'danger';
    return 'normal';
  }

  /* 正式品类字典：只允许这三类，禁止用其它品类顶替（P0-05） */
  var TYPE_META = [
    { key: 'fertilizer', name: '化肥' },
    { key: 'pesticide', name: '农药' },
    { key: 'tool', name: '工具' }
  ];

  var MaterialStore = {
    TYPE_META: TYPE_META,
    all: function () { return load(); },
    get: function (identifier) { return find(identifier); },
    stockOf: function (identifier) { var m = find(identifier); return m ? m.stock : null; },
    safetyOf: function (identifier) { var m = find(identifier); return m ? m.safety : null; },
    statusOf: function (identifier) { var m = find(identifier); return m ? statusOfStock(m.stock, m.safety) : null; },

    /**
     * 品类汇总（P0-05 / P1-05）
     * - 库存与安全库存按品类求和
     * - 覆盖天数 = 品类可用库存 / Σ dailyUse，无日均消耗时为 null
     * - 未在档案中定义的品类不返回，前端显示“未配置”
     */
    categoryStats: function () {
      var list = load();
      return TYPE_META.map(function (t) {
        var rows = list.filter(function (x) { return x.type === t.key; });
        var stock = 0, safety = 0, daily = 0, okCount = 0;
        rows.forEach(function (x) {
          stock += Number(x.stock) || 0;
          safety += Number(x.safety) || 0;
          daily += Number(x.dailyUse) || 0;
          if ((Number(x.stock) || 0) >= (Number(x.safety) || 0)) okCount++;
        });
        return {
          key: t.key,
          name: t.name,
          configured: rows.length > 0,
          skuCount: rows.length,
          okCount: okCount,
          stock: stock,
          safety: safety,
          dailyUse: Math.round(daily * 10) / 10,
          safe: rows.length > 0 && stock >= safety,
          rate: safety > 0 ? Math.round(stock / safety * 1000) / 10 : null,
          days: daily > 0 ? Math.round(stock / daily * 10) / 10 : null
        };
      });
    },

    /** 农资保障率 = 库存达标的品类数 / 已配置品类数 */
    guaranteeRate: function () {
      var cats = this.categoryStats().filter(function (c) { return c.configured; });
      var safe = cats.filter(function (c) { return c.safe; }).length;
      return {
        rate: cats.length ? Math.round(safe / cats.length * 1000) / 10 : 0,
        safeCount: safe,
        totalCount: cats.length,
        categories: cats
      };
    },

    /** 增减库存；库存不足时返回 ok:false 且不改动数据 */
    applyDelta: function (identifier, delta) {
      var list = load();
      var m = findIn(list, identifier);
      if (!m) return { ok: false, stock: null, message: '未找到该农资，库存未变动' };
      var next = m.stock + delta;
      if (next < 0) return { ok: false, stock: m.stock, message: '库存不足，当前库存：' + m.stock + m.unit };
      m.stock = next;
      persistList(list);
      return { ok: true, stock: m.stock };
    },

    /** 直接设置库存（库存盘点用） */
    setStock: function (identifier, value) {
      var list = load();
      var m = findIn(list, identifier);
      if (!m) return { ok: false, stock: null, message: '未找到该农资' };
      m.stock = Math.max(0, parseInt(value, 10) || 0);
      persistList(list);
      return { ok: true, stock: m.stock };
    },

    reset: function () { persistList([], true); backendLoadPromise = null; preloadFromBackend(); return []; }
  };

  global.MaterialStore = MaterialStore;
  if (typeof depsReady !== 'undefined') preloadFromBackend();
})(window);
