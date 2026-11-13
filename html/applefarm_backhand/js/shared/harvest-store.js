/**
 * harvest-store.js — 采收管理共享数据源
 * ---------------------------------------------------------------
 * 承载「采收计划 / 采收记录 / 采后处理 / 储藏 / 发货」五个环节的唯一数据，
 * 统一落地 localStorage['smartorchard_harvest_v1']，供采收管理各页共享，
 * 避免每页各持一份 mock 导致数量对不上、状态互不感知。
 *
 * 设计约定（与 material-store.js / production-store.js 保持一致）：
 *   - 数量统一为「数字 + 单位」（qty / unit），展示层再格式化；
 *   - 状态流转只走 advance()，内置流程表 + 守卫，页面不再自行改状态；
 *   - 地块与基地以统一地块数据层 PlotStore（后端 sf_plot）为唯一来源，
 *     采收记录不再自带一份地块主数据；
 *   - 追溯码沿用溯源编码页的 SNZG-YYYYMMDD-NNNN 规则，并回写该页存储键。
 *
 * 对外 API：
 *   HarvestStore.plans() / records() / processes() / storages() / shipments()
 *   HarvestStore.get(entity, id)
 *   HarvestStore.savePlan(plan)                 → { ok, item, message }
 *   HarvestStore.saveRecord(record)             → { ok, item, message }
 *   HarvestStore.remove(entity, id)             → { ok, message }
 *   HarvestStore.advance(entity, id, to)        → { ok, item, message }
 *   HarvestStore.planStats(planId)
 *   HarvestStore.generateTraceCode(recordId)
 *   HarvestStore.reconcile()
 *   HarvestStore.bases() / plots() / varieties() / grades() / slots()
 *   HarvestStore.subscribe(fn) / reset()
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'smartorchard_harvest_v1';
  // v2：处理单补齐操作人/备注字段、库位改由处理单显式指定，需重新播种
  var VERSION = 2;
  var TRACE_CODE_KEY = 'smartorchard_trace_codes';

  /* ============================================================
   * 后端桥接依赖自动加载（策略 A：出入口映射）
   * ------------------------------------------------------------
   * 依赖：common/js/api.js（统一请求）与 harvest-mapper.js（映射层）。
   * 基于 document.currentScript.src 计算本脚本目录再拼接，避免跨层级 404。
   * ============================================================ */
  var depsReady = (function ensureDeps() {
    if (typeof document === 'undefined') return Promise.resolve();
    var selfEl = document.currentScript;
    if (!selfEl || !selfEl.src) return Promise.resolve();
    var baseDir = selfEl.src.replace(/[^\/]*$/, ''); // 去掉文件名，保留目录
    var deps = [
      { name: 'Api', src: baseDir + '../../../common/js/api.js' },
      { name: 'HarvestMapper', src: baseDir + 'harvest-mapper.js' },
      { name: 'PlotStore', src: baseDir + 'plot-store.js' }
    ];
    var pending = deps.filter(function (d) { return !global[d.name]; });
    if (!pending.length) return Promise.resolve();
    return Promise.all(pending.map(function (d) {
      return new Promise(function (resolve) {
        var s = document.createElement('script');
        s.src = d.src;
        s.async = false;
        s.onload = resolve;
        s.onerror = resolve; // 依赖加载失败不阻塞原型运行
        (document.head || document.documentElement).appendChild(s);
      });
    })).then(function () { return true; });
  })();

  /* 后端桥接状态 */
  var backendReady = false;
  var backendLoadPromise = null;
  var persistTimer = null;

  function backendApi() {
    if (typeof global.Api !== 'object' && typeof global.Api !== 'function') return null;
    if (!global.Api.get || !global.Api.create) return null;
    if (typeof global.HarvestMapper === 'undefined') return null;
    return global.Api;
  }

  function backendEnabled() {
    var api = backendApi();
    if (!api) return false;
    try { return !!api.isLoggedIn(); } catch (e) { return false; }
  }

  /** 从后端聚合接口拉取采收数据，成功后合并进内存并通知 */
  function preloadFromBackend() {
    var writeMark0 = global.__STRICT_DB_WRITES__ || 0;
    if (backendLoadPromise) return backendLoadPromise;
    backendLoadPromise = Promise.resolve(depsReady).then(function () {
      var api = backendApi();
      if (!api || !api.isLoggedIn || !api.isLoggedIn()) return { ok: false, message: '未登录或依赖未就绪' };
      return api.get('harvest/aggregate');
    }).then(function (res) {
      if (res && res.ok && res.data) {
        // 严格模式：预加载在途期间用户保存过数据，保留本地结果，避免陈旧快照覆盖
        if (typeof global.__STRICT_DB_WRITES__ === "number" && global.__STRICT_DB_WRITES__ !== writeMark0) return res;
        var agg = global.HarvestMapper.toAggregate(res.data);
        // 后端数据合并进 store 内存（空数组时保留默认种子兜底）
        var base = defaults();
        var keys = ['plans', 'records', 'processes', 'shipments'];
        var merged = {};
        keys.forEach(function (k) {
          var backList = agg[k];
          merged[k] = backList || [];
        });
        inMemory = merged;
        // storages 为派生数据，由 processes + shipments 重算
        rebuildStorages();
        save();
        notify('backend-loaded');
        backendReady = true;
      }
      return res;
    }).catch(function (e) {
      console.warn('[HarvestStore] 后端预加载失败，降级 localStorage', e);
      return { ok: false, message: e && e.message };
    });
  }

  /** 持久化到后端：防抖 300ms，全量 upsert 4 张表 */
  function persistToBackend() {
    var api = backendApi();
    if (!api || !backendEnabled()) return Promise.resolve({ ok: false, message: '未登录或依赖未就绪' });
    var ctx = { baseIdByName: {}, plotIdByCode: {}, planIdByCode: {}, processIdByCode: {} };
    var agg = {
      plans: clone(ensure().plans || []),
      records: clone(ensure().records || []),
      processes: clone(ensure().processes || []),
      shipments: clone(ensure().shipments || []),
      deleted: {},
    };
    var body = global.HarvestMapper.fromAggregate(agg, ctx);
    return api.create('harvest/aggregate', body);
  }

  /** 调度后端持久化（防抖） */
  function schedulePersist(reason) {
    if (!backendEnabled()) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      persistTimer = null;
      persistToBackend().catch(function (e) {
        console.warn('[HarvestStore] 后端持久化失败', e);
      });
    }, 300);
  }

  /* ============================================================
   * 枚举字典
   * ============================================================ */

  var PLAN_STATUS = {
    pending:   { text: '待执行', tag: 'pending' },
    executing: { text: '执行中', tag: 'processing' },
    completed: { text: '已完成', tag: 'completed' },
    cancelled: { text: '已取消', tag: 'inactive' }
  };

  var RECORD_STATUS = {
    pending:    { text: '待处理', tag: 'pending' },
    processing: { text: '处理中', tag: 'processing' },
    completed:  { text: '已完成', tag: 'normal' }
  };

  var PROCESS_STATUS = {
    grading:   { text: '分级中', tag: 'processing' },
    packaging: { text: '包装中', tag: 'processing' },
    stored:    { text: '已入库', tag: 'stored' },
    exported:  { text: '已出库', tag: 'exported' },
    abnormal:  { text: '异常',    tag: 'abnormal' }
  };

  var STORAGE_STATUS = {
    normal:   { text: '在库正常', tag: 'normal' },
    warning:  { text: '温控预警', tag: 'warning' },
    exported: { text: '已出库',   tag: 'exported' }
  };

  var SHIPMENT_STATUS = {
    pending:  { text: '待发货', tag: 'pending' },
    shipped:  { text: '已发货', tag: 'processing' },
    transit:  { text: '运输中', tag: 'exported' },
    signed:   { text: '已签收', tag: 'normal' },
    abnormal: { text: '异常',   tag: 'abnormal' }
  };

  /** 状态流程表：键为当前状态，值为允许流转到的下一状态 */
  var FLOW = {
    plans: {
      pending:   ['executing', 'cancelled'],
      executing: ['completed', 'cancelled'],
      completed: [],
      cancelled: []
    },
    records: {
      pending:    ['processing'],
      processing: ['completed'],
      completed:  []
    },
    processes: {
      grading:   ['packaging', 'abnormal'],
      packaging: ['stored', 'abnormal'],
      stored:    ['exported'],
      exported:  [],
      abnormal:  ['grading']
    },
    storages: {
      normal:   ['warning', 'exported'],
      warning:  ['normal', 'exported'],
      exported: []
    },
    shipments: {
      pending:  ['shipped', 'abnormal'],
      shipped:  ['transit', 'abnormal'],
      transit:  ['signed', 'abnormal'],
      signed:   [],
      abnormal: ['pending']
    }
  };

  var STATUS_MAP = {
    plans: PLAN_STATUS,
    records: RECORD_STATUS,
    processes: PROCESS_STATUS,
    storages: STORAGE_STATUS,
    shipments: SHIPMENT_STATUS
  };

  function statusName(entity, status) {
    var map = STATUS_MAP[entity] || {};
    return map[status] ? map[status].text : String(status || '');
  }

  var GRADES = [
    { code: 'level1', name: '一级' },
    { code: 'level2', name: '二级' },
    { code: 'level3', name: '三级' }
  ];

  var VARIETIES = ['花牛苹果', '红富士', '金帅', '秦冠', '嘎啦', '红星', '国光'];

  /** 库位主数据：A/B/C/D 四个冷库区，编号统一为「X区-00N」 */
  /* 严格空库模式：库位主数据来自后端 sf_storage_location，不内置演示库位 */
  var SLOTS = [];

  /* ============================================================
   * 工具函数
   * ============================================================ */

  function num(v, def) {
    var n = parseFloat(v);
    return isNaN(n) ? (def || 0) : n;
  }

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function pad(n, len) {
    var s = String(n);
    while (s.length < len) s = '0' + s;
    return s;
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2);
  }

  function stampNow() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2) +
      ' ' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2);
  }

  function isDate(v) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))) return false;
    return !isNaN(Date.parse(String(v) + 'T00:00:00'));
  }

  function isDateTime(v) {
    if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(String(v || ''))) return false;
    return !isNaN(Date.parse(String(v).replace('T', ' ')));
  }

  /** 时间归一化：datetime-local 控件值为 T 分隔，统一转空格分隔后再做字符串比较 */
  function normalizeTime(v) {
    return String(v || '').trim().replace('T', ' ');
  }

  function datePart(v) { return String(v || '').slice(0, 10); }

  function text(v) { return String(v == null ? '' : v).trim(); }

  /* ============================================================
   * 地块主数据：统一来自 PlotStore（sf_plot）
   * ============================================================ */

  /** 地块列表：统一字段口径，来源为 PlotStore 的 sf_plot 快照 */
  function plots() {
    if (!global.PlotStore) return [];
    return global.PlotStore.plots().map(function (p) {
      return {
        code: p.code || '',
        name: p.name || '',
        base: p.base || '',
        enterprise: p.base || '',
        variety: p.variety || '',
        area: num(p.area, 0),
        trees: num(p.trees, 0),
        manager: p.manager || '',
        status: p.status || 'normal'
      };
    }).filter(function (p) { return !!p.code; });
  }

  function plotOf(code) {
    var c = text(code);
    var hit = plots().filter(function (p) { return p.code === c; })[0];
    return hit || null;
  }

  /** 基地列表：取自地块实际归属，避免基地下拉与数据脱节 */
  function bases() {
    var seen = {};
    var out = [];
    plots().forEach(function (p) {
      if (p.base && !seen[p.base]) { seen[p.base] = 1; out.push(p.base); }
    });
    return out.sort();
  }

  function varieties() { return VARIETIES.slice(); }

  function grades() { return GRADES.map(function (g) { return Object.assign({}, g); }); }

  function gradeName(code) {
    var hit = GRADES.filter(function (g) { return g.code === code; })[0];
    return hit ? hit.name : '';
  }

  function slots() { return SLOTS.map(function (s) { return Object.assign({}, s); }); }

  function slotOf(id) {
    var hit = SLOTS.filter(function (s) { return s.id === id; })[0];
    return hit || null;
  }

  /* ============================================================
   * 种子数据
   * ============================================================ */

  // [序号, 批次号, 计划名称, 地块, 计划量, 负责人, 开始, 结束, 状态, 备注]
  var PLAN_SEED = [];

  // [序号, 计划号, 地块, 采收量, 等级, 采收人, 开始, 结束, 状态, 追溯码, 备注]
  var RECORD_SEED = [];

  // 采后处理单：[处理单号后缀, 记录号后缀, 状态, 操作人, 备注]
  // 状态口径：exported 已出库 / stored 已入库（产生库位）/ packaging 包装中 / grading 分级中
  var PROCESS_SEED = [];

  // 发货单：[单号后缀, 来源处理单, 客户, 电话, 地址, 关联订单, 数量, 发货日期, 物流公司, 物流单号, 状态, 操作人, 备注]
  // 口径：仅「已入库」批次可发货；数量不超过来源批次量；pending 发货单尚未出库、不占用库存
  var SHIPMENT_SEED = [];

  /* ============================================================
   * 种子构建
   * ============================================================ */

  function buildPlans() {
    return PLAN_SEED.map(function (r) {
      var plot = plotOf(r[3]);
      return {
        id: 'HS-2026-' + r[0],
        batchNo: r[1],
        name: r[2],
        base: plot ? plot.base : '',
        plot: r[3],
        plotName: plot ? plot.name : '',
        variety: plot ? plot.variety : '',
        plannedQty: r[4],
        actualQty: 0,
        unit: 'kg',
        manager: r[5],
        startTime: r[6],
        endTime: r[7],
        status: r[8],
        remark: r[9],
        createdAt: r[6],
        updatedAt: r[6]
      };
    });
  }

  function buildRecords(plans) {
    var planMap = {};
    plans.forEach(function (p) { planMap[p.id] = p; });
    return RECORD_SEED.map(function (r) {
      var plan = planMap[r[1]];
      var plot = plotOf(r[2]);
      return {
        id: 'HSR-2026-' + r[0],
        planId: r[1],
        batchNo: plan ? plan.batchNo : '',
        base: plot ? plot.base : '',
        plot: r[2],
        plotName: plot ? plot.name : '',
        variety: plot ? plot.variety : '',
        qty: r[3],
        unit: 'kg',
        level: r[4],
        levelName: gradeName(r[4]),
        harvesters: r[5],
        startTime: r[6],
        endTime: r[7],
        status: r[8],
        traceCode: r[9],
        remark: r[10],
        createdAt: r[6],
        updatedAt: r[6]
      };
    });
  }

  function buildProcesses(records) {
    var recMap = {};
    records.forEach(function (r) { recMap[r.id] = r; });
    return PROCESS_SEED.map(function (r) {
      var rec = recMap['HSR-2026-' + r[1]];
      var base = rec ? rec.startTime : '2026-09-01 08:00';
      // 处理时间取采收结束之后 1 小时，保证「采收 → 处理」时序不倒挂
      var t = addHour(rec ? rec.endTime : base, 1);
      return {
        id: 'PP-2026-' + r[0],
        recordId: rec ? rec.id : '',
        batchNo: rec ? rec.batchNo : '',
        plot: rec ? rec.plot : '',
        plotName: rec ? rec.plotName : '',
        grade: rec ? rec.levelName : '',
        qty: rec ? rec.qty : 0,
        unit: rec ? rec.unit : 'kg',
        variety: rec ? rec.variety : '',
        status: r[2],
        location: '',
        operator: r[3],
        remark: r[4],
        inTime: '',
        createdAt: t,
        updatedAt: t
      };
    });
  }

  function buildShipments(processes) {
    var procMap = {};
    processes.forEach(function (p) { procMap[p.id] = p; });
    return SHIPMENT_SEED.map(function (r) {
      var proc = procMap[r[1]];
      return {
        id: 'FH-2026-' + r[0],
        sourceId: r[1],
        batchNo: proc ? proc.batchNo : '',
        customer: r[2],
        phone: r[3],
        address: r[4],
        orderNo: r[5],
        qty: r[6],
        unit: 'kg',
        date: r[7],
        logistics: r[8],
        tracking: r[9],
        status: r[10],
        operator: r[11],
        remark: r[12],
        createdAt: r[7] + ' 09:00',
        updatedAt: r[7] + ' 09:00'
      };
    });
  }

  /**
   * 库位库存由「已入库处理单 − 已发货数量」推导。
   * 口径：仅 status === 'stored' 的处理单产生库位；
   *      待发货（pending）发货单尚未出库，不占用库位。
   * 库位分配：优先用处理单上的 location（入库时人工指定），
   *          未指定时按容量优先自动分配空库位，保证一库位一批次。
   */
  function buildStorages(processes, shipments) {
    var shipped = {};
    shipments.forEach(function (s) {
      // 待发货单尚未出库，不占用库存
      if (s.status === 'pending') return;
      shipped[s.sourceId] = (shipped[s.sourceId] || 0) + num(s.qty);
    });
    var used = {};
    var out = [];
    processes.forEach(function (p) {
      if (p.status !== 'stored') return;
      var remain = num(p.qty) - num(shipped[p.id]);
      if (remain <= 0) return;
      var slot = slotOf(p.location);
      if (slot && used[slot.id]) slot = null;
      if (!slot) {
        slot = SLOTS.filter(function (s) { return !used[s.id] && s.capacity >= remain; })[0]
          || SLOTS.filter(function (s) { return !used[s.id]; })[0]
          || SLOTS[out.length % SLOTS.length];
      }
      used[slot.id] = 1;
      var temp = Number((2.4 + (out.length % 5) * 0.3).toFixed(1));
      var humi = 86 + (out.length % 4);
      var inTime = p.inTime || addHour(p.createdAt, 2);
      out.push({
        id: slot.id,
        zone: slot.zone,
        type: slot.type,
        base: '',
        batchId: p.id,
        batchNo: p.batchNo,
        plot: p.plot,
        plotName: p.plotName,
        variety: p.variety || '',
        grade: p.grade,
        qty: remain,
        unit: p.unit || 'kg',
        capacity: slot.capacity,
        temp: temp,
        humidity: humi,
        inTime: inTime,
        expire: addDays(inTime, 110),
        status: (temp >= 0 && temp <= 4 && humi >= 80 && humi <= 95) ? 'normal' : 'warning',
        remark: '',
        createdAt: inTime,
        updatedAt: inTime
      });
    });
    return out;
  }

  /** 处理单/发货单变更后重建派生库存，保证储藏页与上游始终一致 */
  function rebuildStorages() {
    var d = ensure();
    var storages = buildStorages(d.processes || [], d.shipments || []);
    var plotMap = {};
    (d.records || []).forEach(function (r) { plotMap[r.batchNo] = r.base; });
    storages.forEach(function (s) { s.base = plotMap[s.batchNo] || ''; });
    d.storages = storages;
    return storages;
  }

  function addHour(timeStr, hours) {
    var t = new Date(String(timeStr || '').replace(' ', 'T'));
    if (isNaN(t.getTime())) return String(timeStr || '');
    t.setTime(t.getTime() + hours * 3600000);
    return t.getFullYear() + '-' + pad(t.getMonth() + 1, 2) + '-' + pad(t.getDate(), 2) +
      ' ' + pad(t.getHours(), 2) + ':' + pad(t.getMinutes(), 2);
  }

  function addDays(timeStr, days) {
    var t = new Date(String(timeStr || '').replace(' ', 'T'));
    if (isNaN(t.getTime())) return '';
    t.setTime(t.getTime() + days * 86400000);
    return t.getFullYear() + '-' + pad(t.getMonth() + 1, 2) + '-' + pad(t.getDate(), 2);
  }

  /* ============================================================
   * 读写与持久化
   * ============================================================ */

  var inMemory = null;
  var subscribers = [];
  var lastError = '';

  function defaults() {
    var plans = buildPlans();
    var records = buildRecords(plans);
    var processes = buildProcesses(records);
    var shipments = buildShipments(processes);
    var storages = buildStorages(processes, shipments);
    // 库位归属基地取自批次地块
    var plotMap = {};
    records.forEach(function (r) { plotMap[r.batchNo] = r.base; });
    storages.forEach(function (s) { s.base = plotMap[s.batchNo] || ''; });
    return {
      version: VERSION,
      plans: plans,
      records: records,
      processes: processes,
      storages: storages,
      shipments: shipments
    };
  }

  function load() {
    var raw;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    if (!raw) return null;
    try {
      var obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('数据结构异常');
      if (obj.version !== VERSION) return null;
      return obj;
    } catch (e) {
      try { localStorage.setItem(STORAGE_KEY + '_corrupt', raw); } catch (e2) {}
      console.warn('[HarvestStore] 本地数据损坏，已备份并重新初始化', e);
      return null;
    }
  }

  function save() {
    try {
      global.__STRICT_DB_INTERNAL_WRITE__ = true;

      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemory)); } finally { global.__STRICT_DB_INTERNAL_WRITE__ = false; }
      lastError = '';
      return true;
    } catch (e) {
      lastError = e && e.name === 'QuotaExceededError'
        ? '本地存储空间不足，数据未保存'
        : '数据保存失败：' + (e && e.message ? e.message : '浏览器存储不可用');
      console.error('[HarvestStore]', lastError);
      return false;
    }
  }

  function ensure() {
    if (inMemory) return inMemory;
    var stored = load();
    var base = defaults();
    if (stored) {
      Object.keys(base).forEach(function (k) {
        if (k === 'version') { stored.version = VERSION; return; }
        if (!Array.isArray(stored[k])) { stored[k] = base[k]; return; }
        var seen = {};
        stored[k] = stored[k].filter(function (x) {
          if (!x || typeof x !== 'object' || !x.id) return false;
          var id = String(x.id);
          if (seen[id]) return false;
          seen[id] = 1;
          return true;
        });
      });
      inMemory = stored;
    } else {
      inMemory = base;
      save();
    }
    recompute();
    // 触发后端预加载（异步，不阻塞首次渲染；未登录时静默降级）
    preloadFromBackend();
    return inMemory;
  }

  /** 重算全部计划的实采完成量（读档后调用，保证与采收记录一致） */
  function recompute() {
    var list = ensure().plans || [];
    list.forEach(function (p) {
      var stats = planStats(p.id);
      p.actualQty = stats.actualQty;
    });
  }

  function notify(reason) {
    subscribers.forEach(function (fn) {
      try { fn(reason); } catch (e) { console.warn('[HarvestStore]', e); }
    });
    // 窗口事件统一在 notify 里派发：后端预加载（backend-loaded）与本地写入两条路径都会触发
    try {
      window.dispatchEvent(new CustomEvent('harvestStoreChange', { detail: { reason: reason } }));
    } catch (e) {}
  }

  function commit(reason) {

    /* 用户主动写入：计入预加载竞态计数 */

    global.__STRICT_DB_WRITES__ = (global.__STRICT_DB_WRITES__ || 0) + 1;
    var ok = save();
    notify(reason);
    // 后端持久化（防抖，未登录/依赖未就绪时静默跳过）
    schedulePersist(reason);
    return ok;
  }

  /* ============================================================
   * 编号生成
   * ============================================================ */

  var ID_PREFIX = {
    plans: ['HS-2026-', 3],
    records: ['HSR-2026-', 3]
  };

  function nextId(entity) {
    var cfg = ID_PREFIX[entity];
    if (!cfg) return String(Date.now());
    var list = ensure()[entity] || [];
    var max = 0;
    list.forEach(function (x) {
      var m = String(x.id || '').match(/(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return cfg[0] + pad(max + 1, cfg[1]);
  }

  /** 批次号 PC-YYYYMMDD-NNN：按计划开始日期归组序号 */
  function nextBatchNo(dateStr) {
    var day = datePart(dateStr) || todayStr();
    var compact = day.replace(/-/g, '');
    var max = 0;
    (ensure().plans || []).forEach(function (p) {
      if (datePart(p.startTime) !== day) return;
      var m = String(p.batchNo || '').match(/(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return 'PC-' + compact + '-' + pad(max + 1, 3);
  }

  /** 处理单号 PP-YYYY-NNN */
  function nextProcessId() {
    var max = 0;
    (ensure().processes || []).forEach(function (p) {
      var m = String(p.id || '').match(/(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return 'PP-' + new Date().getFullYear() + '-' + pad(max + 1, 3);
  }

  /** 发货单号 FH-YYYY-NNN */
  function nextShipmentId() {
    var max = 0;
    (ensure().shipments || []).forEach(function (s) {
      var m = String(s.id || '').match(/(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return 'FH-' + new Date().getFullYear() + '-' + pad(max + 1, 3);
  }

  /** 某处理单的在库量（已出库/在途的发货单不占库存，待发货单尚未出库） */
  function inStockOfProcess(processId) {
    var p = get('processes', processId);
    if (!p) return 0;
    var used = 0;
    (ensure().shipments || []).forEach(function (s) {
      if (s.sourceId !== processId) return;
      if (s.status === 'pending') return;
      used += num(s.qty);
    });
    return Math.max(0, num(p.qty) - used);
  }

  /** 某处理单还可新建发货单的数量（含已占用但未发货的待发单） */
  function allocatableOfProcess(processId) {
    var p = get('processes', processId);
    if (!p) return 0;
    var used = 0;
    (ensure().shipments || []).forEach(function (s) {
      if (s.sourceId === processId) used += num(s.qty);
    });
    return Math.max(0, num(p.qty) - used);
  }

  /** 已完成采收记录中尚未建立处理单的，供「新建处理单」下拉 */
  function processableRecords() {
    var made = {};
    (ensure().processes || []).forEach(function (p) { made[p.recordId] = 1; });
    return (ensure().records || []).filter(function (r) {
      return r.status === 'completed' && !made[r.id];
    });
  }

  /** 追溯码 SNZG-YYYYMMDD-NNNN：与溯源编码页同规则 */
  function nextTraceCode(dateStr) {
    var day = datePart(dateStr) || todayStr();
    var compact = day.replace(/-/g, '');
    var prefix = 'SNZG-' + compact + '-';
    var max = 0;
    (ensure().records || []).forEach(function (r) {
      var c = String(r.traceCode || '');
      if (c.indexOf(prefix) !== 0) return;
      var m = c.match(/(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    try {
      var raw = localStorage.getItem(TRACE_CODE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list)) {
        list.forEach(function (x) {
          var c = String((x && x.code) || '');
          if (c.indexOf(prefix) !== 0) return;
          var m = c.match(/(\d+)$/);
          if (m) max = Math.max(max, parseInt(m[1], 10));
        });
      }
    } catch (e) {}
    return prefix + pad(max + 1, 4);
  }

  /* ============================================================
   * 校验与守卫
   * ============================================================ */

  function requireField(errors, label, value) {
    if (!text(value)) errors.push('请填写' + label);
  }

  function validatePlan(plan) {
    var e = [];
    if (!plan || typeof plan !== 'object') return '计划数据为空';
    requireField(e, '计划名称', plan.name);
    requireField(e, '计划负责人', plan.manager);
    if (!text(plan.plot)) {
      e.push('请选择采收地块');
    } else if (!plotOf(plan.plot)) {
      e.push('所选地块不存在：' + plan.plot);
    }
    var qty = num(plan.plannedQty, -1);
    if (!(qty > 0)) e.push('预计采收量必须大于 0');
    if (!isDateTime(plan.startTime)) e.push('计划开始时间格式不正确');
    if (!isDateTime(plan.endTime)) e.push('计划结束时间格式不正确');
    if (isDateTime(plan.startTime) && isDateTime(plan.endTime) && normalizeTime(plan.endTime) < normalizeTime(plan.startTime)) {
      e.push('计划结束时间不能早于开始时间');
    }
    return e[0] || '';
  }

  function validateRecord(rec) {
    var e = [];
    if (!rec || typeof rec !== 'object') return '采收记录为空';
    var plan = rec.planId ? get('plans', rec.planId) : null;
    if (!plan) {
      e.push('关联计划不存在，请重新选择');
    } else if (plan.status === 'cancelled') {
      e.push('关联计划已取消，无法登记采收记录');
    }
    requireField(e, '所属基地', rec.base);
    if (!text(rec.plot)) {
      e.push('请选择采收地块');
    } else if (!plotOf(rec.plot)) {
      e.push('所选地块不存在：' + rec.plot);
    } else if (plan && text(plan.plot) && plan.plot !== rec.plot) {
      e.push('采收地块与关联计划的地块不一致');
    }
    requireField(e, '品种', rec.variety);
    if (!(num(rec.qty) > 0)) e.push('采收量必须大于 0');
    if (!GRADES.some(function (g) { return g.code === rec.level; })) e.push('请选择苹果等级');
    requireField(e, '采收人', rec.harvesters);
    if (!isDateTime(rec.startTime)) e.push('采收开始时间格式不正确');
    if (!isDateTime(rec.endTime)) e.push('采收结束时间格式不正确');
    if (isDateTime(rec.startTime) && isDateTime(rec.endTime) && normalizeTime(rec.endTime) < normalizeTime(rec.startTime)) {
      e.push('采收结束时间不能早于开始时间');
    }
    if (plan && isDateTime(rec.startTime) && isDateTime(plan.startTime) && normalizeTime(rec.startTime) < normalizeTime(plan.startTime)) {
      e.push('采收开始时间不能早于计划开始时间');
    }
    if (plan && isDateTime(rec.endTime) && isDateTime(plan.endTime) && normalizeTime(rec.endTime) > normalizeTime(plan.endTime)) {
      e.push('采收结束时间不能晚于计划结束时间');
    }
    return e[0] || '';
  }

  /** 状态流转守卫：返回空串表示允许 */
  function transitionGuard(entity, item, to) {
    var e = [];
    if (!item) return '数据不存在或已被删除';
    if (entity === 'plans') {
      if (to === 'executing') {
        if (!item.batchNo) e.push('计划缺少批次号，无法开始执行');
        if (!(num(item.plannedQty) > 0)) e.push('计划量必须大于 0 才能开始执行');
      }
      if (to === 'completed') {
        var stats = planStats(item.id);
        if (!(stats.actualQty > 0)) e.push('尚无已完成的采收记录，不能完成计划');
      }
      if (to === 'cancelled') {
        var done = (ensure().records || []).filter(function (r) {
          return r.planId === item.id && r.status === 'completed';
        });
        if (done.length) e.push('该计划已有已完成的采收记录，不能取消');
      }
    }
    if (entity === 'records') {
      if (!(num(item.qty) > 0)) e.push('采收量必须大于 0');
      var plan = item.planId ? get('plans', item.planId) : null;
      if (plan && plan.status === 'cancelled') e.push('关联计划已取消，无法推进记录状态');
      if (to === 'completed' && !item.endTime) e.push('请先填写采收结束时间');
    }
    return e[0] || '';
  }

  function canTransition(entity, from, to) {
    if (!from || !to || from === to) return false;
    var allow = (FLOW[entity] || {})[from];
    return !!allow && allow.indexOf(to) >= 0;
  }

  /* ============================================================
   * 派生：计划完成度与批次对账
   * ============================================================ */

  function planStats(planId) {
    var records = (ensure().records || []).filter(function (r) { return r.planId === planId; });
    var done = records.filter(function (r) { return r.status === 'completed'; });
    var planned = num(get('plans', planId) ? get('plans', planId).plannedQty : 0);
    var actual = done.reduce(function (s, r) { return s + num(r.qty); }, 0);
    return {
      recordCount: records.length,
      completedCount: done.length,
      plannedQty: planned,
      actualQty: actual,
      rate: planned > 0 ? Math.round(actual / planned * 100) : 0
    };
  }

  /** 回写计划实际完成量 */
  function rollup(planId) {
    if (!planId) return;
    var list = ensure().plans || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) !== String(planId)) continue;
      var stats = planStats(planId);
      list[i].actualQty = stats.actualQty;
      list[i].updatedAt = stampNow();
      return;
    }
  }

  /**
   * 批次级对账：按链路环节拆分数量，差异归因到具体环节。
   *
   * 口径说明：
   *   harvested 实采量   —— 来自采收记录
   *   processed 处理量   —— 来自采后处理单
   *   inProcess 处理中量 —— 已建处理单但尚未入库（grading / packaging）
   *   stored     在库量   —— 已入库且尚未发运
   *   shipped    已发量   —— 已出库（不含待发货单）
   *   pending    待发量   —— 待发货单占用（尚未出库，不扣库存）
   *
   * 校验规则：
   *   实采 = 处理 + 未建处理单量（未建处理单的批次在 pendingProcess 中体现）
   *   处理 = 在库 + 已发 + 处理中
   *   在库 + 已发 = 已入库处理量
   */
  function reconcile() {
    var d = ensure();
    var map = {};

    function bucket(key) {
      if (!map[key]) {
        map[key] = {
          batchNo: key,
          harvested: 0, processed: 0, inProcess: 0,
          stored: 0, shipped: 0, pending: 0
        };
      }
      return map[key];
    }

    (d.records || []).forEach(function (r) {
      bucket(r.batchNo || r.id).harvested += num(r.qty);
    });
    (d.processes || []).forEach(function (p) {
      var row = bucket(p.batchNo || p.id);
      row.processed += num(p.qty);
      // 未入库的处理单视为「处理中」
      if (p.status !== 'stored' && p.status !== 'exported') row.inProcess += num(p.qty);
    });
    (d.storages || []).forEach(function (s) {
      bucket(s.batchNo || s.id).stored += num(s.qty);
    });
    (d.shipments || []).forEach(function (s) {
      var row = bucket(s.batchNo || s.id);
      if (s.status === 'pending') row.pending += num(s.qty);
      else row.shipped += num(s.qty);
    });

    return Object.keys(map).map(function (k) {
      var row = map[k];
      // 实采 → 处理 的缺口（尚未建处理单）
      row.pendingProcess = row.harvested - row.processed;
      // 处理 → 入库/发运 的缺口
      row.balance = row.processed - row.stored - row.shipped - row.inProcess;
      // 是否异常：任一环节缺口不为 0 即标红
      row.abnormal = row.pendingProcess !== 0 || row.balance !== 0;
      return row;
    });
  }

  /* ============================================================
   * 写操作
   * ============================================================ */

  function get(entity, id) {
    var list = ensure()[entity] || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return clone(list[i]);
    }
    return null;
  }

  function all(entity) { return clone(ensure()[entity] || []); }

  function findIndexById(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return i;
    }
    return -1;
  }

  /** 保存采收计划：新建时自动补编号与批次号，编辑时保留原编号 */
  function savePlan(plan) {
    var invalid = validatePlan(plan);
    if (invalid) return { ok: false, item: null, message: invalid };
    var list = ensure().plans || [];
    var isNew = !plan.id || findIndexById(list, plan.id) < 0;
    var plot = plotOf(plan.plot);
    var item = {
      id: isNew ? nextId('plans') : plan.id,
      batchNo: plan.batchNo || (isNew ? nextBatchNo(plan.startTime) : (get('plans', plan.id) || {}).batchNo),
      name: text(plan.name),
      base: plot ? plot.base : text(plan.base),
      plot: plan.plot,
      plotName: plot ? plot.name : '',
      variety: plot ? plot.variety : text(plan.variety),
      plannedQty: num(plan.plannedQty),
      actualQty: isNew ? 0 : num((get('plans', plan.id) || {}).actualQty),
      unit: 'kg',
      manager: text(plan.manager),
      startTime: String(plan.startTime).replace('T', ' '),
      endTime: String(plan.endTime).replace('T', ' '),
      status: isNew ? 'pending' : (plan.status || (get('plans', plan.id) || {}).status),
      remark: text(plan.remark),
      createdAt: isNew ? stampNow() : ((get('plans', plan.id) || {}).createdAt || stampNow()),
      updatedAt: stampNow()
    };
    if (!item.batchNo) return { ok: false, item: null, message: '批次号生成失败，请重试' };
    var idx = findIndexById(list, item.id);
    if (idx >= 0) list[idx] = item; else list.unshift(item);
    commit('plans:' + item.id);
    return { ok: true, item: clone(item), message: '' };
  }

  /** 保存采收记录：批次号继承自关联计划，实采量回写计划完成度 */
  function saveRecord(rec) {
    var invalid = validateRecord(rec);
    if (invalid) return { ok: false, item: null, message: invalid };
    var list = ensure().records || [];
    var isNew = !rec.id || findIndexById(list, rec.id) < 0;
    var plan = get('plans', rec.planId);
    var plot = plotOf(rec.plot);
    var prev = isNew ? null : get('records', rec.id);
    var item = {
      id: isNew ? nextId('records') : rec.id,
      planId: rec.planId,
      batchNo: plan ? plan.batchNo : text(rec.batchNo),
      base: plot ? plot.base : text(rec.base),
      plot: rec.plot,
      plotName: plot ? plot.name : '',
      variety: plot ? plot.variety : text(rec.variety),
      qty: num(rec.qty),
      unit: 'kg',
      level: rec.level,
      levelName: gradeName(rec.level),
      harvesters: text(rec.harvesters),
      startTime: String(rec.startTime).replace('T', ' '),
      endTime: String(rec.endTime || '').replace('T', ' '),
      status: isNew ? 'pending' : (rec.status || (prev || {}).status),
      traceCode: prev ? (prev.traceCode || '') : '',
      remark: text(rec.remark),
      createdAt: isNew ? stampNow() : ((prev || {}).createdAt || stampNow()),
      updatedAt: stampNow()
    };
    var idx = findIndexById(list, item.id);
    if (idx >= 0) list[idx] = item; else list.unshift(item);
    // 计划一旦有采收记录即进入执行中，避免计划状态永远停留在「待执行」
    var p = get('plans', item.planId);
    if (p && p.status === 'pending') {
      var pList = ensure().plans;
      var pIdx = findIndexById(pList, p.id);
      if (pIdx >= 0) { pList[pIdx].status = 'executing'; pList[pIdx].updatedAt = stampNow(); }
    }
    rollup(item.planId);
    commit('records:' + item.id);
    return { ok: true, item: clone(item), message: '' };
  }

  /* ---------------- 采后处理 ---------------- */

  /** 为已完成的采收记录建立处理单（同一记录只能建一张） */
  function createProcess(recordId, opts) {
    opts = opts || {};
    var rec = get('records', recordId);
    if (!rec) return { ok: false, item: null, message: '采收记录不存在' };
    if (rec.status !== 'completed') return { ok: false, item: null, message: '仅已完成的采收记录可建立处理单' };
    var existed = (ensure().processes || []).filter(function (p) { return p.recordId === recordId; })[0];
    if (existed) return { ok: false, item: clone(existed), message: '该记录已建立处理单 ' + existed.id };
    var qty = num(opts.qty, rec.qty);
    if (!(qty > 0)) return { ok: false, item: null, message: '处理量必须大于 0' };
    if (qty > num(rec.qty)) return { ok: false, item: null, message: '处理量不能超过采收量 ' + rec.qty + ' kg' };
    var item = {
      id: nextProcessId(),
      recordId: rec.id,
      batchNo: rec.batchNo,
      plot: rec.plot,
      plotName: rec.plotName,
      variety: rec.variety || '',
      grade: rec.levelName,
      qty: qty,
      unit: 'kg',
      status: 'grading',
      location: '',
      inTime: '',
      operator: text(opts.operator),
      remark: text(opts.remark),
      createdAt: stampNow(),
      updatedAt: stampNow()
    };
    ensure().processes.unshift(item);
    rebuildStorages();
    commit('processes-add:' + item.id);
    return { ok: true, item: clone(item), message: '' };
  }

  /** 入库：要求处理单已包装完成，校验库位容量与入库时序 */
  function inboundProcess(id, opts) {
    opts = opts || {};
    var item = get('processes', id);
    if (!item) return { ok: false, item: null, message: '处理单不存在或已被删除' };
    if (!canTransition('processes', item.status, 'stored')) {
      var cur = statusName('processes', item.status);
      return { ok: false, item: item, message: '「' + cur + '」不能直接入库，请先完成包装' };
    }
    var qty = num(opts.qty, item.qty);
    if (!(qty > 0)) return { ok: false, item: item, message: '入库数量必须大于 0' };
    if (qty > num(item.qty)) return { ok: false, item: item, message: '入库数量不能超过处理量 ' + item.qty + ' kg' };
    var slot = slotOf(opts.slot);
    if (!slot) return { ok: false, item: item, message: '请选择有效的库位' };
    var used = 0;
    (ensure().storages || []).forEach(function (s) {
      if (s.id === slot.id && s.batchId !== id) used += num(s.qty);
    });
    if (used + qty > slot.capacity) {
      return { ok: false, item: item, message: '库位 ' + slot.id + ' 容量不足：已占用 ' + used + ' kg，容量 ' + slot.capacity + ' kg' };
    }
    var time = normalizeTime(opts.time) || stampNow();
    if (normalizeTime(time) < normalizeTime(item.createdAt)) {
      return { ok: false, item: item, message: '入库时间不能早于处理单创建时间' };
    }
    var list = ensure().processes;
    var idx = findIndexById(list, id);
    list[idx].qty = qty;
    list[idx].status = 'stored';
    list[idx].location = slot.id;
    list[idx].inTime = time;
    list[idx].operator = text(opts.operator) || list[idx].operator;
    list[idx].remark = text(opts.remark) || list[idx].remark;
    list[idx].updatedAt = stampNow();
    rebuildStorages();
    commit('processes-inbound:' + id);
    return { ok: true, item: clone(list[idx]), message: '' };
  }

  /* ---------------- 储藏 / 发货 ---------------- */

  /** 储藏出库：生成已发货状态的发货单，库存随之扣减 */
  function outboundStorage(storageId, opts) {
    opts = opts || {};
    var st = (ensure().storages || []).filter(function (s) { return String(s.id) === String(storageId); })[0];
    if (!st) return { ok: false, item: null, message: '库位不存在或该批次已全部出库' };
    var qty = num(opts.qty);
    if (!(qty > 0)) return { ok: false, item: null, message: '出库数量必须大于 0' };
    if (qty > num(st.qty)) return { ok: false, item: null, message: '出库数量不能超过在库量 ' + st.qty + ' kg' };
    var customer = text(opts.customer);
    if (!customer) return { ok: false, item: null, message: '请填写收货方' };
    var time = normalizeTime(opts.time) || stampNow();
    var ship = {
      id: nextShipmentId(),
      sourceId: st.batchId,
      batchNo: st.batchNo,
      customer: customer,
      phone: text(opts.phone),
      address: text(opts.address),
      orderNo: text(opts.orderNo),
      qty: qty,
      unit: 'kg',
      date: datePart(time),
      logistics: text(opts.logistics),
      tracking: text(opts.tracking),
      status: 'shipped',
      operator: text(opts.operator),
      remark: text(opts.remark),
      shippedAt: time,
      signPerson: '',
      signTime: '',
      createdAt: time,
      updatedAt: time
    };
    ensure().shipments.unshift(ship);
    rebuildStorages();
    commit('shipments-outbound:' + ship.id);
    return { ok: true, item: clone(ship), message: '' };
  }

  /** 新建发货单：来源批次须已入库，数量不超过可分配量 */
  function saveShipment(ship) {
    var proc = get('processes', ship && ship.sourceId);
    if (!proc) return { ok: false, item: null, message: '请选择有效的来源批次' };
    if (proc.status !== 'stored') return { ok: false, item: null, message: '仅已入库的批次可发货' };
    var allocatable = allocatableOfProcess(proc.id);
    if (!(allocatable > 0)) return { ok: false, item: null, message: '该批次已无可发数量' };
    var qty = num(ship.qty);
    if (!(qty > 0)) return { ok: false, item: null, message: '发货数量必须大于 0' };
    if (qty > allocatable) return { ok: false, item: null, message: '发货数量不能超过可发量 ' + allocatable + ' kg' };
    if (!text(ship.customer)) return { ok: false, item: null, message: '请填写客户名称' };
    if (!text(ship.address)) return { ok: false, item: null, message: '请填写收货地址' };
    var date = normalizeTime(ship.date) || todayStr();
    var item = {
      id: nextShipmentId(),
      sourceId: proc.id,
      batchNo: proc.batchNo,
      customer: text(ship.customer),
      phone: text(ship.phone),
      address: text(ship.address),
      orderNo: text(ship.orderNo),
      qty: qty,
      unit: 'kg',
      date: datePart(date),
      logistics: text(ship.logistics),
      tracking: text(ship.tracking),
      status: 'pending',
      operator: text(ship.operator),
      remark: text(ship.remark),
      shippedAt: '',
      signPerson: '',
      signTime: '',
      createdAt: stampNow(),
      updatedAt: stampNow()
    };
    ensure().shipments.unshift(item);
    rebuildStorages();
    commit('shipments-add:' + item.id);
    return { ok: true, item: clone(item), message: '' };
  }

  /** 确认发货：待发货 → 已发货，必须填写物流单号 */
  function confirmShipment(id, opts) {
    opts = opts || {};
    var item = get('shipments', id);
    if (!item) return { ok: false, item: null, message: '发货单不存在或已被删除' };
    if (!canTransition('shipments', item.status, 'shipped')) {
      return { ok: false, item: item, message: '「' + statusName('shipments', item.status) + '」不能确认发货' };
    }
    if (!text(opts.tracking)) return { ok: false, item: item, message: '请填写物流单号' };
    var time = normalizeTime(opts.time) || stampNow();
    var list = ensure().shipments;
    var idx = findIndexById(list, id);
    list[idx].status = 'shipped';
    list[idx].logistics = text(opts.logistics) || list[idx].logistics;
    list[idx].tracking = text(opts.tracking);
    list[idx].shippedAt = time;
    list[idx].remark = text(opts.remark) || list[idx].remark;
    list[idx].updatedAt = stampNow();
    rebuildStorages();
    commit('shipments-confirm:' + id);
    return { ok: true, item: clone(list[idx]), message: '' };
  }

  /** 签收：运输中 → 已签收，记录签收人与签收时间 */
  function signShipment(id, opts) {
    /* 用户主动写入：计入预加载竞态计数 */
    global.__STRICT_DB_WRITES__ = (global.__STRICT_DB_WRITES__ || 0) + 1;
    opts = opts || {};
    var item = get('shipments', id);
    if (!item) return { ok: false, item: null, message: '发货单不存在或已被删除' };
    if (!canTransition('shipments', item.status, 'signed')) {
      return { ok: false, item: item, message: '「' + statusName('shipments', item.status) + '」不能签收，请先确认发货并转运输中' };
    }
    if (!text(opts.person)) return { ok: false, item: item, message: '请填写签收人' };
    var time = normalizeTime(opts.time) || stampNow();
    if (item.shippedAt && normalizeTime(time) < normalizeTime(item.shippedAt)) {
      return { ok: false, item: item, message: '签收时间不能早于发货时间' };
    }
    var list = ensure().shipments;
    var idx = findIndexById(list, id);
    list[idx].status = 'signed';
    list[idx].signPerson = text(opts.person);
    list[idx].signTime = time;
    list[idx].remark = text(opts.remark) || list[idx].remark;
    list[idx].updatedAt = stampNow();
    rebuildStorages();
    commit('shipments-sign:' + id);
    return { ok: true, item: clone(list[idx]), message: '' };
  }

  /** 删除：关闭闭环上的悬空引用，避免出现「关联计划不存在」 */
  function remove(entity, id) {
    /* 用户主动写入：计入预加载竞态计数 */
    global.__STRICT_DB_WRITES__ = (global.__STRICT_DB_WRITES__ || 0) + 1;
    var d = ensure();
    if (!Array.isArray(d[entity])) return { ok: false, message: '未知的数据集合：' + entity };
    var idx = findIndexById(d[entity], id);
    if (idx < 0) return { ok: false, message: '数据不存在或已被删除' };
    if (entity === 'plans') {
      var used = (d.records || []).filter(function (r) { return r.planId === id; });
      if (used.length) return { ok: false, message: '该计划下已有 ' + used.length + ' 条采收记录，不能删除' };
    }
    if (entity === 'records') {
      var used2 = (d.processes || []).filter(function (p) { return p.recordId === id; });
      if (used2.length) return { ok: false, message: '该记录已生成采后处理单，不能删除' };
    }
    if (entity === 'processes') {
      var used3 = (d.shipments || []).filter(function (s) { return s.sourceId === id; });
      if (used3.length) return { ok: false, message: '该处理单已有 ' + used3.length + ' 张发货单，不能删除' };
    }
    d[entity].splice(idx, 1);
    commit(entity + '-remove:' + id);
    return { ok: true, message: '' };
  }

  /** 唯一状态流转入口：校验流程合法性 + 业务守卫 */
  function advance(entity, id, to, patch) {
    /* 用户主动写入：计入预加载竞态计数 */
    global.__STRICT_DB_WRITES__ = (global.__STRICT_DB_WRITES__ || 0) + 1;
    var item = get(entity, id);
    if (!item) return { ok: false, item: null, message: '数据不存在或已被删除' };
    if (!canTransition(entity, item.status, to)) {
      var map = STATUS_MAP[entity] || {};
      var cur = map[item.status] ? map[item.status].text : item.status;
      var next = map[to] ? map[to].text : to;
      return { ok: false, item: item, message: '「' + cur + '」不能直接变更为「' + next + '」' };
    }
    var guard = transitionGuard(entity, item, to);
    if (guard) return { ok: false, item: item, message: guard };
    var list = ensure()[entity];
    var idx = findIndexById(list, id);
    list[idx].status = to;
    applyPatch(list[idx], patch);
    list[idx].updatedAt = stampNow();
    if (entity === 'records') rollup(list[idx].planId);
    if (entity === 'processes' || entity === 'shipments') rebuildStorages();
    commit(entity + ':' + id + '→' + to);
    return { ok: true, item: clone(list[idx]), message: '' };
  }

  /** 仅更新非状态字段（如备注、操作人），状态仍只能走 advance */
  function updateProcess(id, patch) {
    var list = ensure().processes || [];
    var idx = findIndexById(list, id);
    if (idx < 0) return { ok: false, item: null, message: '处理单不存在或已被删除' };
    applyPatch(list[idx], patch);
    list[idx].updatedAt = stampNow();
    commit('processes-update:' + id);
    return { ok: true, item: clone(list[idx]), message: '' };
  }

  function applyPatch(target, patch) {
    if (!patch || typeof patch !== 'object') return;
    Object.keys(patch).forEach(function (k) {
      if (k === 'id' || k === 'status') return;
      target[k] = patch[k];
    });
  }

  /** 生成追溯码：沿用溯源编码页规则，并回写该页存储键 */
  function generateTraceCode(recordId) {
    var rec = get('records', recordId);
    if (!rec) return { ok: false, code: '', message: '采收记录不存在' };
    if (rec.traceCode) return { ok: false, code: rec.traceCode, message: '该记录已生成追溯码' };
    if (!(num(rec.qty) > 0)) return { ok: false, code: '', message: '采收量为 0，不能生成追溯码' };
    var code = nextTraceCode(rec.startTime);
    var list = ensure().records;
    var idx = findIndexById(list, recordId);
    list[idx].traceCode = code;
    list[idx].updatedAt = stampNow();
    // 回写溯源编码页，保证扫码侧能查到该码
    try {
      var raw = localStorage.getItem(TRACE_CODE_KEY);
      var codes = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(codes)) codes = [];
      codes.push({
        code: code,
        batch: rec.batchNo || '',
        time: stampNow() + ':00',
        status: 'inactive',
        order: '',
        template: '标准版履历模板',
        queries: 0
      });
      localStorage.setItem(TRACE_CODE_KEY, JSON.stringify(codes));
    } catch (e) {
      console.warn('[HarvestStore] 追溯码回写溯源编码页失败', e);
    }
    commit('records-trace:' + recordId);
    return { ok: true, code: code, message: '' };
  }

  /* ============================================================
   * 跨页同步：storage 事件触发重载
   * ============================================================ */

  function reload() {
    inMemory = null;
    ensure();
    notify('storage');
  }

  function bindStorageEvent() {
    if (global.__harvestStoreBound) return;
    global.__harvestStoreBound = true;
    try {
      global.addEventListener('storage', function (e) {
        if (!e.key || e.key === STORAGE_KEY) reload();
      });
    } catch (e) {}
  }

  /* ============================================================
   * 对外 API
   * ============================================================ */

  var HarvestStore = {
    STORAGE_KEY: STORAGE_KEY,
    VERSION: VERSION,
    PLAN_STATUS: PLAN_STATUS,
    RECORD_STATUS: RECORD_STATUS,
    PROCESS_STATUS: PROCESS_STATUS,
    STORAGE_STATUS: STORAGE_STATUS,
    SHIPMENT_STATUS: SHIPMENT_STATUS,
    FLOW: FLOW,

    plans: function () { return all('plans'); },
    records: function () { return all('records'); },
    processes: function () { return all('processes'); },
    storages: function () { return all('storages'); },
    shipments: function () { return all('shipments'); },

    /**
     * 采收量汇总（P0-07）
     * 口径：仅 status==='completed' 的记录，按结束时间归属区间
     * @param {string} [startDate] YYYY-MM-DD 含
     * @param {string} [endDate]   YYYY-MM-DD 含
     */
    summarizeRecords: function (startDate, endDate) {
      var list = all('records').filter(function (r) {
        if (r.status !== 'completed') return false;
        var d = String(r.endTime || r.startTime || '').slice(0, 10);
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
      });
      var kg = 0;
      list.forEach(function (r) { kg += num(r.qty); });
      return {
        kg: Math.round(kg * 10) / 10,
        tons: Math.round(kg / 1000 * 100) / 100,
        count: list.length,
        hasData: list.length > 0,
        startDate: startDate || '',
        endDate: endDate || ''
      };
    },

    /** 本月采收量：无完成记录时 hasData=false，前端显示空态而非 0.0t */
    monthSummary: function (ym) {
      var now = new Date();
      var m = ym || (now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2));
      var y = m.slice(0, 4), mo = m.slice(5, 7);
      var days = new Date(Number(y), Number(mo), 0).getDate();
      return this.summarizeRecords(m + '-01', m + '-' + ('0' + days).slice(-2));
    },

    /** 本季采收量：固定 2026-09-01 ~ 2026-12-31（与采收管理季口径一致） */
    seasonSummary: function () {
      return this.summarizeRecords('2026-09-01', '2026-12-31');
    },

    get: get,
    all: all,
    savePlan: savePlan,
    saveRecord: saveRecord,
    createProcess: createProcess,
    inboundProcess: inboundProcess,
    outboundStorage: outboundStorage,
    saveShipment: saveShipment,
    confirmShipment: confirmShipment,
    signShipment: signShipment,
    processableRecords: processableRecords,
    allocatableOfProcess: allocatableOfProcess,
    inStockOfProcess: inStockOfProcess,
    rebuildStorages: rebuildStorages,
    updateProcess: updateProcess,
    remove: remove,
    advance: advance,
    planStats: planStats,
    rollup: rollup,
    reconcile: reconcile,
    generateTraceCode: generateTraceCode,
    nextBatchNo: nextBatchNo,
    nextTraceCode: nextTraceCode,

    plots: plots,
    plotOf: plotOf,
    bases: bases,
    varieties: varieties,
    grades: grades,
    gradeName: gradeName,
    slots: slots,
    slotOf: slotOf,

    statusText: function (entity, status) {
      return statusName(entity, status);
    },
    statusTag: function (entity, status) {
      var map = STATUS_MAP[entity] || {};
      return map[status] ? map[status].tag : 'pending';
    },
    canTransition: canTransition,
    validate: {
      plan: validatePlan,
      record: validateRecord
    },

    stampNow: stampNow,
    today: todayStr,
    lastError: function () { return lastError; },

    subscribe: function (fn) {
      subscribers.push(fn);
      try { fn('init'); } catch (e) {}
      return function () { subscribers = subscribers.filter(function (x) { return x !== fn; }); };
    },
    reset: function () {
      inMemory = defaults();
      commit('reset');
    },
    _defaults: defaults
  };

  bindStorageEvent();
  global.HarvestStore = HarvestStore;
})(window);
