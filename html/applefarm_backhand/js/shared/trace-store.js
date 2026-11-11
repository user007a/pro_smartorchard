/**
 * 智慧果园 - 溯源主数据 Store
 * ------------------------------------------------------------
 * 唯一数据源：批次 / 检测报告 / 追溯码 / 事件存证 / 扫码日志 /
 *            标签模板 / 打印任务 / 库存预占 / 召回 / 监管报送 / 审计
 *
 * 依赖（可选）：window.HarvestStore（采收记录、采后处理、储藏、发货）
 * 存储：localStorage['smartorchard_trace_v1']
 *
 * 对外：window.TraceStore
 */
(function (global) {
  'use strict';

  /* ============================================================
   * 后端桥接依赖自动加载（策略 A：出入口映射）
   * ------------------------------------------------------------
   * 依赖：common/js/api.js（统一请求）与 trace-mapper.js（映射层）。
   * 基于 document.currentScript.src 计算本脚本目录再拼接，避免跨层级 404。
   * ============================================================ */
  var depsReady = (function ensureDeps() {
    if (typeof document === 'undefined') return Promise.resolve();
    var selfEl = document.currentScript;
    if (!selfEl || !selfEl.src) return Promise.resolve();
    var baseDir = selfEl.src.replace(/[^\/]*$/, '');
    var deps = [
      { name: 'Api', src: baseDir + '../../../common/js/api.js' },
      { name: 'TraceMapper', src: baseDir + 'trace-mapper.js' }
    ];
    var pending = deps.filter(function (d) { return !global[d.name]; });
    if (!pending.length) return Promise.resolve();
    return Promise.all(pending.map(function (d) {
      return new Promise(function (resolve) {
        var s = document.createElement('script');
        s.src = d.src;
        s.async = false;
        s.onload = resolve;
        s.onerror = resolve;
        (document.head || document.documentElement).appendChild(s);
      });
    })).then(function () { return true; });
  })();

  var backendReady = false;
  var backendLoadPromise = null;
  var persistTimer = null;

  function backendApi() {
    if (typeof global.Api !== 'object' && typeof global.Api !== 'function') return null;
    if (!global.Api.get || !global.Api.create) return null;
    if (typeof global.TraceMapper === 'undefined') return null;
    return global.Api;
  }

  function backendEnabled() {
    var api = backendApi();
    if (!api) return false;
    try { return !!api.isLoggedIn(); } catch (e) { return false; }
  }

  /** 从后端聚合接口拉取溯源数据，成功后合并进内存并通知 */
  function preloadFromBackend() {
    if (backendLoadPromise) return backendLoadPromise;
    backendLoadPromise = Promise.resolve(depsReady).then(function () {
      var api = backendApi();
      if (!api || !api.isLoggedIn || !api.isLoggedIn()) return { ok: false, message: '未登录或依赖未就绪' };
      return api.get('trace/aggregate');
    }).then(function (res) {
      if (res && res.ok && res.data) {
        var agg = global.TraceMapper.toAggregate(res.data);
        var d = ensure();
        // 后端数据合并进 store 内存（空数组时保留默认种子兜底）
        d.batches = (agg.batches && agg.batches.length) ? agg.batches : d.batches;
        d.codes = (agg.codes && agg.codes.length) ? agg.codes : d.codes;
        d.events = (agg.events && agg.events.length) ? agg.events : d.events;
        d.scans = (agg.scans && agg.scans.length) ? agg.scans : d.scans;
        d.labelTemplates = (agg.labelTemplates && agg.labelTemplates.length) ? agg.labelTemplates : d.labelTemplates;
        d.inspections = (agg.inspections && agg.inspections.length) ? agg.inspections : d.inspections;
        d.labelStock = (agg.labelStock && Object.keys(agg.labelStock).length) ? agg.labelStock : d.labelStock;
        d.printJobs = (agg.printJobs && agg.printJobs.length) ? agg.printJobs : d.printJobs;
        d.recalls = (agg.recalls && agg.recalls.length) ? agg.recalls : d.recalls;
        d.showTemplates = (agg.showTemplates && agg.showTemplates.length) ? agg.showTemplates : d.showTemplates;
        save();
        commit('backend-loaded');
        backendReady = true;
      }
      return res;
    }).catch(function (e) {
      console.warn('[TraceStore] 后端预加载失败，降级 localStorage', e);
      return { ok: false, message: e && e.message };
    });
  }

  /** 持久化到后端：防抖 300ms，全量 upsert 8 张表 */
  function persistToBackend() {
    var api = backendApi();
    if (!api || !backendEnabled()) return Promise.resolve({ ok: false, message: '未登录或依赖未就绪' });
    var d = ensure();
    var agg = {
      batches: clone(d.batches || []),
      codes: clone(d.codes || []),
      events: clone(d.events || []),
      scans: clone(d.scans || []),
      labelTemplates: clone(d.labelTemplates || []),
      inspections: clone(d.inspections || []),
      labelStock: clone(d.labelStock || {}),
      printJobs: clone(d.printJobs || []),
      recalls: clone(d.recalls || []),
      showTemplates: clone(d.showTemplates || []),
      deleted: {},
    };
    var body = global.TraceMapper.fromAggregate(agg);
    return api.create('trace/aggregate', body);
  }

  /** 调度后端持久化（防抖） */
  function schedulePersist(reason) {
    if (!backendEnabled()) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      persistTimer = null;
      persistToBackend().catch(function (e) {
        console.warn('[TraceStore] 后端持久化失败', e);
      });
    }, 300);
  }

  var VERSION = 3;
  var KEY = 'smartorchard_trace_v1';
  var LEGACY_BATCH_KEY = 'smartorchard_trace_batches';
  var LEGACY_CODE_KEY = 'smartorchard_trace_codes';
  var MOBILE_LABEL_STOCK_KEY = 'smartorchard_label_stock';

  var COMPANY = '天水花牛苹果（集团）有限责任公司';
  var CONTRACT_ADDRESS = '0x7a3f9c2e18b4d6a05e7f31c9d2b8a6f4e0c5d713';
  var CHAIN_NODE = '蚂蚁链 · 天水农产品溯源节点';
  var TSA = '国家授时中心可信时间戳';

  var VARIETY_PRODUCT = {
    '花牛苹果': '花牛苹果',
    '金帅': '金帅苹果',
    '秦冠': '秦冠苹果'
  };

  // 与 trace_batch.html 保持一致的地块主数据
  var PLOT_SOURCE = [
    { code: 'D-001', name: '东区1号地', base: '天水麦积区基地', variety: '花牛苹果' },
    { code: 'D-002', name: '东区2号地', base: '天水麦积区基地', variety: '花牛苹果' },
    { code: 'D-003', name: '西区1号地', base: '天水麦积区基地', variety: '金帅' },
    { code: 'D-004', name: '北区1号地', base: '天水秦州基地', variety: '花牛苹果' },
    { code: 'D-005', name: '南区1号地', base: '天水秦州基地', variety: '花牛苹果' },
    { code: 'D-006', name: '中区1号地', base: '甘肃吉县苹果园', variety: '花牛苹果' },
    { code: 'D-007', name: '南区2号地', base: '甘肃麦积区苹果园', variety: '花牛苹果' },
    { code: 'D-008', name: '西区2号地', base: '天水麦积区苹果基地', variety: '花牛苹果' },
    { code: 'D-009', name: '北区2号地', base: '甘肃麦积区苹果基地', variety: '花牛苹果' },
    { code: 'D-010', name: '东区3号地', base: '天水麦积区苹果基地', variety: '金帅' },
    { code: 'D-011', name: '南区3号地', base: '甘肃麦积区苹果园', variety: '花牛苹果' },
    { code: 'D-012', name: '西区3号地', base: '天水麦积区苹果基地', variety: '秦冠' },
    { code: 'D-013', name: '北区3号地', base: '甘肃麦积区苹果基地', variety: '花牛苹果' },
    { code: 'D-014', name: '中区2号地', base: '甘肃吉县苹果园', variety: '花牛苹果' },
    { code: 'D-015', name: '东区4号地', base: '天水麦积区苹果基地', variety: '花牛苹果' },
    { code: 'D-016', name: '南区4号地', base: '甘肃麦积区苹果园', variety: '金帅' },
    { code: 'D-017', name: '西区4号地', base: '天水麦积区苹果基地', variety: '花牛苹果' },
    { code: 'D-018', name: '北区4号地', base: '甘肃麦积区苹果基地', variety: '花牛苹果' },
    { code: 'D-019', name: '中区3号地', base: '甘肃吉县苹果园', variety: '花牛苹果' },
    { code: 'D-020', name: '东区5号地', base: '天水麦积区苹果基地', variety: '秦冠' },
    { code: 'D-021', name: '东区6号地', base: '甘肃吉县苹果园', variety: '花牛苹果' },
    { code: 'D-022', name: '西区5号地', base: '天水张家川县基地', variety: '金帅' }
  ];

  // 兜底批次（HarvestStore 不可用时）
  var BATCH_FALLBACK = [
    ['PC-20260901-001', 'D-001', 'HS-2026-001', 'PP-2026-001', '2026-09-01', '一级', 1250, '5kg/箱', 'shipped', 2],
    ['PC-20260902-002', 'D-002', 'HS-2026-002', 'PP-2026-002', '2026-09-02', '一级', 890, '5kg/箱', 'shipped', 2],
    ['PC-20260903-003', 'D-003', 'HS-2026-003', 'PP-2026-003', '2026-09-03', '二级', 1560, '4kg/箱', 'packed', 2],
    ['PC-20260904-004', 'D-004', 'HS-2026-004', 'PP-2026-004', '2026-09-04', '一级', 780, '5kg/箱', 'packed', 1],
    ['PC-20260905-005', 'D-005', 'HS-2026-005', 'PP-2026-005', '2026-09-05', '二级', 1100, '5kg/箱', 'packed', 1],
    ['PC-20260906-006', 'D-006', 'HS-2026-006', 'PP-2026-006', '2026-09-06', '三级', 920, '4kg/箱', 'packed', 1],
    ['PC-20260907-007', 'D-007', 'HS-2026-007', 'PP-2026-007', '2026-09-07', '一级', 1340, '5kg/箱', 'packed', 1],
    ['PC-20260908-008', 'D-008', 'HS-2026-008', 'PP-2026-008', '2026-09-08', '二级', 650, '5kg/箱', 'packed', 1],
    ['PC-20260909-009', 'D-009', 'HS-2026-009', 'PP-2026-009', '2026-09-09', '一级', 1420, '4kg/箱', 'stored', 1],
    ['PC-20260910-010', 'D-010', 'HS-2026-010', 'PP-2026-010', '2026-09-10', '二级', 870, '4kg/箱', 'stored', 1],
    ['PC-20260911-011', 'D-011', 'HS-2026-011', 'PP-2026-011', '2026-09-11', '一级', 1680, '5kg/箱', 'stored', 1],
    ['PC-20260912-012', 'D-012', 'HS-2026-012', 'PP-2026-012', '2026-09-12', '三级', 720, '6kg/箱', 'stored', 1],
    ['PC-20260913-013', 'D-013', 'HS-2026-013', 'PP-2026-013', '2026-09-13', '一级', 1200, '5kg/箱', 'stored', 1],
    ['PC-20260914-014', 'D-014', 'HS-2026-014', 'PP-2026-014', '2026-09-14', '二级', 980, '5kg/箱', 'stored', 1],
    ['PC-20260915-015', 'D-015', 'HS-2026-015', 'PP-2026-015', '2026-09-15', '一级', 1550, '4kg/箱', 'stored', 1],
    ['PC-20260916-016', 'D-016', 'HS-2026-016', 'PP-2026-016', '2026-09-16', '二级', 830, '4kg/箱', 'pending', 1],
    ['PC-20260917-017', 'D-017', 'HS-2026-017', 'PP-2026-017', '2026-09-17', '一级', 1120, '5kg/箱', 'pending', 1],
    ['PC-20260918-018', 'D-018', 'HS-2026-018', 'PP-2026-018', '2026-09-18', '三级', 690, '5kg/箱', 'pending', 1],
    ['PC-20260919-019', 'D-019', 'HS-2026-019', 'PP-2026-019', '2026-09-19', '一级', 1380, '4kg/箱', 'pending', 1],
    ['PC-20260920-020', 'D-020', 'HS-2026-020', 'PP-2026-020', '2026-09-20', '二级', 950, '6kg/箱', 'pending', 1]
  ];

  // 追溯码样例（与历史页面保持一致）
  var CODE_SEED = [
    ['SNZG-20260901-0001', 'PC-20260901-001', '2026-09-01 16:20:00', 'active', 'SN20260614102', '标准版履历模板', 156, '2026-09-22 14:30:00'],
    ['SNZG-20260901-0002', 'PC-20260901-001', '2026-09-01 16:35:00', 'active', 'SN20260611105', '标准版履历模板', 98, '2026-09-21 11:20:00'],
    ['SNZG-20260902-0003', 'PC-20260902-002', '2026-09-02 15:10:00', 'active', 'SN20260608108', '有机认证版模板', 134, '2026-09-22 09:15:00'],
    ['SNZG-20260902-0004', 'PC-20260902-002', '2026-09-02 15:25:00', 'active', 'SN20260602114', '有机认证版模板', 87, '2026-09-20 16:40:00'],
    ['SNZG-20260903-0005', 'PC-20260903-003', '2026-09-03 17:00:00', 'inactive', '', '精简版履历模板', 0, ''],
    ['SNZG-20260903-0006', 'PC-20260903-003', '2026-09-03 17:12:00', 'inactive', '', '精简版履历模板', 0, ''],
    ['SNZG-20260904-0007', 'PC-20260904-004', '2026-09-04 16:40:00', 'inactive', '', '标准版履历模板', 0, ''],
    ['SNZG-20260905-0008', 'PC-20260905-005', '2026-09-05 16:05:00', 'active', 'SN20260530117', '标准版履历模板', 112, '2026-09-19 10:05:00'],
    ['SNZG-20260906-0009', 'PC-20260906-006', '2026-09-06 15:48:00', 'inactive', '', '精简版履历模板', 0, ''],
    ['SNZG-20260907-0010', 'PC-20260907-007', '2026-09-07 17:20:00', 'inactive', '', '标准版履历模板', 0, ''],
    ['SNZG-20260908-0011', 'PC-20260908-008', '2026-09-08 16:30:00', 'inactive', '', '标准版履历模板', 0, ''],
    ['SNZG-20260909-0012', 'PC-20260909-009', '2026-09-09 15:55:00', 'inactive', '', '精简版履历模板', 0, ''],
    ['SNZG-20260910-0013', 'PC-20260910-010', '2026-09-10 16:15:00', 'inactive', '', '精简版履历模板', 0, ''],
    ['SNZG-20260911-0014', 'PC-20260911-011', '2026-09-11 17:05:00', 'inactive', '', '标准版履历模板', 0, ''],
    ['SNZG-20260912-0015', 'PC-20260912-012', '2026-09-12 16:50:00', 'active', 'SN20260527120', '品牌故事版模板', 76, '2026-09-21 15:25:00'],
    ['SNZG-20260913-0016', 'PC-20260913-013', '2026-09-13 15:35:00', 'inactive', '', '标准版履历模板', 0, ''],
    ['SNZG-20260914-0017', 'PC-20260914-014', '2026-09-14 16:45:00', 'inactive', '', '标准版履历模板', 0, ''],
    ['SNZG-20260915-0018', 'PC-20260915-015', '2026-09-15 17:15:00', 'inactive', '', '精简版履历模板', 0, ''],
    ['SNZG-20260916-0019', 'PC-20260916-016', '2026-09-16 15:20:00', 'inactive', '', '精简版履历模板', 0, ''],
    ['SNZG-20260917-0020', 'PC-20260917-017', '2026-09-17 16:25:00', 'active', 'SN20260526121', '标准版履历模板', 64, '2026-09-20 09:35:00'],
    ['SNZG-20260918-0021', 'PC-20260918-018', '2026-09-18 17:30:00', 'expired', '', '标准版履历模板', 42, '2026-09-22 14:00:00'],
    ['SNZG-20260919-0022', 'PC-20260919-019', '2026-09-19 16:10:00', 'expired', '', '精简版履历模板', 29, '2026-09-21 10:20:00'],
    ['SNZG-20260920-0023', 'PC-20260920-020', '2026-09-20 15:40:00', 'inactive', '', '标准版履历模板', 0, '']
  ];

  var TEMPLATE_SEED = [
    {
      id: 'TPL-STD', name: '标准版履历模板', version: 3, status: 'active',
      layout: { size: '60×40mm', material: '铜版纸', fields: ['产品名称', '批次号', '追溯码', '二维码', '检测结论', '产地'] },
      versions: [
        { version: 1, at: '2026-07-01', note: '初版：产品 + 追溯码' },
        { version: 2, at: '2026-08-10', note: '增加检测结论与产地' },
        { version: 3, at: '2026-09-01', note: '增加短链二维码容错等级 H' }
      ]
    },
    {
      id: 'TPL-ORG', name: '有机认证版模板', version: 2, status: 'active',
      layout: { size: '60×60mm', material: '防水合成纸', fields: ['产品名称', '批次号', '追溯码', '二维码', '有机认证', '检测报告编号'] },
      versions: [
        { version: 1, at: '2026-07-15', note: '初版' },
        { version: 2, at: '2026-08-20', note: '增加检测报告编号' }
      ]
    },
    {
      id: 'TPL-LITE', name: '精简版履历模板', version: 1, status: 'active',
      layout: { size: '40×30mm', material: '热敏纸', fields: ['产品名称', '批次号', '二维码'] },
      versions: [{ version: 1, at: '2026-07-01', note: '初版' }]
    }
  ];

  var LABEL_STOCK_SEED = {
    '花牛苹果专用标签（双层纸袋型）': 12500,
    '花牛苹果专用标签（透气膜袋型）': 8200,
    '秦冠专用标签': 6800
  };

  var INSPECTION_INSTITUTIONS = [
    '甘肃省农产品质量安全检测中心',
    '天水市食品药品检验检测中心',
    '华测检测认证集团股份有限公司',
    '谱尼测试集团股份有限公司'
  ];

  var INSPECTION_ITEMS = [
    { name: '敌敌畏', result: '未检出', unit: 'mg/kg', limit: '≤0.2', qualified: true },
    { name: '毒死蜱', result: '0.02', unit: 'mg/kg', limit: '≤1.0', qualified: true },
    { name: '氯氰菊酯', result: '未检出', unit: 'mg/kg', limit: '≤2.0', qualified: true },
    { name: '铅（Pb）', result: '0.01', unit: 'mg/kg', limit: '≤0.1', qualified: true },
    { name: '镉（Cd）', result: '0.005', unit: 'mg/kg', limit: '≤0.05', qualified: true }
  ];

  /* ============================================================
   * 基础工具
   * ============================================================ */
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function num(v, d) { var n = Number(v); return isNaN(n) ? (d == null ? 0 : d) : n; }
  function text(v) { return v == null ? '' : String(v); }
  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
  function datePart(v) {
    var m = text(v).match(/(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
  }
  function compactDate(v) { return datePart(v).replace(/-/g, ''); }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2);
  }
  function nowStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2) +
      ' ' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2);
  }
  function shiftDate(dateStr, days) {
    var d = new Date(text(dateStr).replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1/$2/$3'));
    if (isNaN(d.getTime())) return datePart(dateStr) || todayStr();
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2);
  }
  function addMinutes(date, mins) { var d = new Date(date.getTime() + mins * 60000); return d; }
  function fmtDateTime(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2) +
      ' ' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2);
  }
  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }
  function plotOf(code) {
    var c = text(code);
    for (var i = 0; i < PLOT_SOURCE.length; i++) if (PLOT_SOURCE[i].code === c) return PLOT_SOURCE[i];
    return { code: c, name: '', base: '', variety: '' };
  }
  function productOf(variety) {
    var v = text(variety);
    if (VARIETY_PRODUCT[v]) return VARIETY_PRODUCT[v];
    if (v.indexOf('金帅') >= 0) return '金帅苹果';
    if (v.indexOf('秦冠') >= 0) return '秦冠苹果';
    return '花牛苹果';
  }
  function specOf(product) {
    if (product.indexOf('金帅') >= 0) return '4kg/箱';
    if (product.indexOf('秦冠') >= 0) return '6kg/箱';
    return '5kg/箱';
  }
  function stableStringify(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) {
      var arr = [];
      for (var i = 0; i < v.length; i++) arr.push(stableStringify(v[i]));
      return '[' + arr.join(',') + ']';
    }
    var keys = Object.keys(v).sort();
    var parts = [];
    for (var j = 0; j < keys.length; j++) parts.push(JSON.stringify(keys[j]) + ':' + stableStringify(v[keys[j]]));
    return '{' + parts.join(',') + '}';
  }

  /* SHA-256（ASCII），用于事件链与短码 */
  function sha256(s) {
    function ror(x, n) { return (x >>> n) | (x << (32 - n)); }
    var h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
      h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    var bytes = [];
    for (var i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 0xff);
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    var bl = s.length * 8;
    bytes.push((bl >>> 24) & 0xff); bytes.push((bl >>> 16) & 0xff);
    bytes.push((bl >>> 8) & 0xff); bytes.push(bl & 0xff);
    var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    for (var off = 0; off < bytes.length; off += 64) {
      var w = [];
      for (var k = 0; k < 16; k++) {
        w[k] = (bytes[off + k * 4] << 24) | (bytes[off + k * 4 + 1] << 16) |
          (bytes[off + k * 4 + 2] << 8) | bytes[off + k * 4 + 3];
      }
      for (var j = 16; j < 64; j++) {
        var s0 = ror(w[j - 15], 7) ^ ror(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        var s1 = ror(w[j - 2], 17) ^ ror(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      var a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, hh = h7;
      for (var q = 0; q < 64; q++) {
        var S1 = ror(e, 6) ^ ror(e, 11) ^ ror(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (hh + S1 + ch + K[q] + w[q]) | 0;
        var S0 = ror(a, 2) ^ ror(a, 13) ^ ror(a, 22);
        var mj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + mj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + hh) | 0;
    }
    function hex(n) { return (n < 0 ? n + 0x100000000 : n).toString(16).padStart(8, '0'); }
    return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h5) + hex(h6) + hex(h7);
  }

  function hashEvent(prevHash, payload) {
    return sha256(text(prevHash) + '|' + stableStringify(payload || {}));
  }
  function shortCodeOf(code) { return sha256(text(code)).slice(0, 8); }

  /* ============================================================
   * 种子构建
   * ============================================================ */
  function buildBatchFromRecord(r, procs, shipsByProc) {
    var plot = plotOf(r.plot);
    var proc = null;
    for (var i = 0; i < procs.length; i++) {
      if (procs[i].recordId === r.id || (procs[i].batchNo && procs[i].batchNo === r.batchNo)) { proc = procs[i]; break; }
    }
    var ships = (proc && shipsByProc[proc.id]) || [];
    var status = 'pending';
    var activeShip = null;
    for (var s = 0; s < ships.length; s++) {
      if (ships[s].status && ships[s].status !== 'pending') { activeShip = ships[s]; }
    }
    if (activeShip) status = 'shipped';
    else if (proc && (proc.status === 'stored' || proc.status === 'exported')) status = 'stored';
    else if (proc && proc.status === 'packaging') status = 'packed';
    else if (r.planId && r.status === 'completed') status = 'packed';
    var product = productOf(r.variety || (plot && plot.variety));
    return {
      id: 'BAT-' + r.batchNo,
      batchNo: r.batchNo,
      sourceRecordId: r.id,
      planNo: r.planId || '',
      processNo: proc ? proc.id : '',
      plotCode: r.plot || plot.code,
      plotName: r.plotName || plot.name,
      base: r.base || plot.base,
      variety: r.variety || plot.variety,
      product: product,
      spec: specOf(product),
      grade: r.levelName || r.level || '',
      harvestDate: datePart(r.startTime) || datePart(r.endTime),
      quantity: num(r.qty),
      status: status,
      codeCount: r.traceCode ? 1 : 0,
      traceCodes: r.traceCode ? [r.traceCode] : [],
      remark: r.remark || (proc ? proc.remark : '') || '',
      shipment: activeShip ? {
        id: activeShip.id, customer: activeShip.customer || activeShip.receiver || '',
        date: activeShip.date || activeShip.shipDate || '', status: activeShip.status,
        logistics: activeShip.logistics || activeShip.company || '',
        trackingNo: activeShip.trackingNo || ''
      } : null,
      createdAt: r.startTime || '',
      updatedAt: r.endTime || r.startTime || ''
    };
  }

  function seedBatches() {
    var hs = global.HarvestStore;
    if (hs && typeof hs.records === 'function') {
      try {
        var records = hs.records() || [];
        if (records.length) {
          var procs = (typeof hs.processes === 'function' && hs.processes()) || [];
          var ships = (typeof hs.shipments === 'function' && hs.shipments()) || [];
          var byProc = {};
          for (var i = 0; i < ships.length; i++) {
            var sid = ships[i].sourceId || ships[i].processId || '';
            if (!byProc[sid]) byProc[sid] = [];
            byProc[sid].push(ships[i]);
          }
          var out = [];
          for (var j = 0; j < records.length; j++) {
            if (!records[j].batchNo) continue;
            out.push(buildBatchFromRecord(records[j], procs, byProc));
          }
          if (out.length) return out;
        }
      } catch (e) { /* 忽略，使用兜底 */ }
    }
    var list = [];
    for (var k = 0; k < BATCH_FALLBACK.length; k++) {
      var b = BATCH_FALLBACK[k];
      var p = plotOf(b[1]);
      var product = productOf(p.variety);
      list.push({
        id: 'BAT-' + b[0], batchNo: b[0], sourceRecordId: '', planNo: b[2], processNo: b[3],
        plotCode: b[1], plotName: p.name, base: p.base, variety: p.variety,
        product: product, spec: b[7], grade: b[5], harvestDate: b[4], quantity: b[6],
        status: b[8], codeCount: b[9], traceCodes: [], remark: '', shipment: null,
        createdAt: b[4] + ' 08:00:00', updatedAt: b[4] + ' 17:00:00'
      });
    }
    return list;
  }

  function buildInspection(batchNo, harvestDate, mode, seq) {
    var inst = INSPECTION_INSTITUTIONS[seq % INSPECTION_INSTITUTIONS.length];
    var reportNo = 'JC-2026-' + pad(9100 + seq, 4);
    var sample = shiftDate(harvestDate, -1);
    var issue = harvestDate;
    var validUntil = mode === 'expired' ? '2026-08-20' : '2026-12-31';
    var status = mode === 'expired' ? 'expired' : (mode === 'revoked' ? 'revoked' : 'valid');
    return {
      id: 'INS-' + batchNo,
      batchNo: batchNo,
      reportNo: reportNo,
      institution: inst,
      reportType: seq % 3 === 0 ? '质量安全检测' : '农药残留检测',
      sampleDate: sample,
      issueDate: issue,
      validUntil: validUntil,
      conclusion: '合格',
      items: clone(INSPECTION_ITEMS),
      attachment: {
        name: '检测报告_' + reportNo + '.pdf',
        size: 482000 + seq * 1024,
        type: 'application/pdf',
        uploadedAt: issue + ' 18:00:00'
      },
      cma: '',
      cnas: '',
      status: status,
      operator: '质检员',
      createdAt: issue + ' 18:00:00',
      updatedAt: issue + ' 18:00:00'
    };
  }

  function seedInspections(batches) {
    var out = [];
    for (var i = 0; i < batches.length; i++) {
      var b = batches[i];
      var no = b.batchNo;
      // 无报告批次：用于演示检测门禁；新采收批次也默认待补录
      if (no === 'PC-20260907-007' || no === 'PC-20261015-021' || no === 'PC-20261018-022') continue;
      var mode = 'valid';
      if (no === 'PC-20260903-003' || no === 'PC-20260910-010' || no === 'PC-20260918-018') mode = 'expired';
      if (no === 'PC-20260904-004' || no === 'PC-20260920-020') mode = 'revoked';
      out.push(buildInspection(no, b.harvestDate, mode, i + 1));
    }
    return out;
  }

  function seedCodes(batches) {
    var batchMap = {};
    for (var i = 0; i < batches.length; i++) batchMap[batches[i].batchNo] = batches[i];
    var out = [];
    for (var j = 0; j < CODE_SEED.length; j++) {
      var c = CODE_SEED[j];
      var b = batchMap[c[1]];
      var firstScanAt = '';
      if (c[6] > 0) firstScanAt = shiftDate(datePart(c[2]), 2) + ' 10:20:00';
      out.push({
        code: c[0], shortCode: shortCodeOf(c[0]), batch: c[1], time: c[2], status: c[3],
        order: c[4], template: c[5], queries: c[6], firstScanAt: firstScanAt,
        lastQuery: c[7] || '', createdAt: c[2],
        batchNo: c[1], product: b ? b.product : '', plotCode: b ? b.plotCode : ''
      });
      if (b) {
        if (!b.traceCodes) b.traceCodes = [];
        if (b.traceCodes.indexOf(c[0]) < 0) b.traceCodes.push(c[0]);
      }
    }
    return out;
  }

  function seedScans(codes) {
    var out = [];
    var regions = ['甘肃省天水市', '甘肃省兰州市', '陕西省西安市', '浙江省杭州市', '广东省深圳市'];
    var idx = 0;
    for (var i = 0; i < codes.length; i++) {
      var c = codes[i];
      if (!c.queries) continue;
      var base = datePart(c.lastQuery) || datePart(c.time);
      var n = Math.min(3, c.queries > 100 ? 3 : 2);
      for (var j = 0; j < n; j++) {
        var region = regions[(idx + j) % regions.length];
        out.push({
          id: 'SCN-' + pad(out.length + 1, 5),
          code: c.code,
          at: base + ' ' + pad(9 + j, 2) + ':' + pad(10 + idx * 3, 2) + ':00',
          source: j === 0 ? 'H5' : 'PC',
          region: region,
          device: j === 0 ? 'iPhone · Safari' : '微信扫码',
          result: c.status === 'expired' ? 'risk' : 'normal',
          riskFlag: c.status === 'expired' ? 'expired' : '',
          riskReason: c.status === 'expired' ? '追溯码已过期仍被查询' : ''
        });
        idx++;
      }
    }
    // 一条异地高频异常样例
    out.push({
      id: 'SCN-' + pad(out.length + 1, 5),
      code: 'SNZG-20260901-0001',
      at: '2026-09-23 02:16:00',
      source: 'H5',
      region: '广东省深圳市',
      device: 'Android · Chrome',
      result: 'risk',
      riskFlag: 'channel',
      riskReason: '短时间内异地高频查询，疑似窜货'
    });
    return out;
  }

  function seedTemplates() { return clone(TEMPLATE_SEED); }

  /* 溯源展示模板（C端履历展示模板，区别于标签打印模板） */
  var SHOW_TEMPLATE_SEED = [
    { id: 'ST-001', name: '标准版履历模板', product: '花牛苹果', modules: ['基地介绍','种植管理','施肥喷药','农残检测','采摘入库'], boundBatches: ['PC-20260901-001'], createTime: '2026-08-25', status: 'active', desc: '适用于一般批次溯源，包含核心农事与检测环节' },
    { id: 'ST-002', name: '精简版履历模板', product: '花牛苹果', modules: ['基地介绍','采摘入库'], boundBatches: ['PC-20260911-011'], createTime: '2026-08-28', status: 'active', desc: '精简展示，仅保留产地与采收信息' },
    { id: 'ST-003', name: '有机认证版模板', product: '花牛苹果', modules: ['基地介绍','种植管理','施肥喷药','农残检测','企业认证'], boundBatches: ['PC-20260902-002'], createTime: '2026-09-02', status: 'active', desc: '有机产品专用，突出检测与认证' },
    { id: 'ST-004', name: '礼盒装版模板', product: '礼盒装苹果', modules: ['基地介绍','采摘入库','冷链配送'], boundBatches: [], createTime: '2026-09-03', status: 'active', desc: '礼品套装专用模板' },
    { id: 'ST-005', name: '认养农业版模板', product: '花牛苹果', modules: ['基地介绍','种植管理','采摘入库'], boundBatches: [], createTime: '2026-09-13', status: 'active', desc: '认养果树所产果实使用' },
    { id: 'ST-006', name: '秦冠专属版模板', product: '秦冠苹果', modules: ['基地介绍','种植管理','采摘入库'], boundBatches: ['PC-20260920-020'], createTime: '2026-09-18', status: 'active', desc: '秦冠品种专用' },
    { id: 'ST-007', name: '金帅专属版模板', product: '金帅苹果', modules: ['基地介绍','种植管理','采摘入库'], boundBatches: ['PC-20260910-010'], createTime: '2026-09-08', status: 'active', desc: '金帅品种专用' },
    { id: 'ST-008', name: '果园直发版模板', product: '花牛苹果', modules: ['基地介绍','采摘入库','冷链配送'], boundBatches: [], createTime: '2026-09-19', status: 'active', desc: '果园直发批次使用' }
  ];
  function seedShowTemplates() { return clone(SHOW_TEMPLATE_SEED); }
  function seedStock() {
    var stored = readJSON(MOBILE_LABEL_STOCK_KEY, null);
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) return clone(stored);
    return clone(LABEL_STOCK_SEED);
  }

  function seedPrintJobs() {
    return [
      {
        id: 'PJ-20260901-001', batchNo: 'PC-20260901-001', labelName: '花牛苹果专用标签（双层纸袋型）',
        templateId: 'TPL-STD', templateVersion: 3, qty: 2, operator: '管理员',
        status: 'printed', reprintOf: '', reason: '', createdAt: '2026-09-01 17:40:00',
        codes: ['SNZG-20260901-0001', 'SNZG-20260901-0002']
      },
      {
        id: 'PJ-20260905-002', batchNo: 'PC-20260905-005', labelName: '花牛苹果专用标签（透气膜袋型）',
        templateId: 'TPL-STD', templateVersion: 3, qty: 1, operator: '包装组',
        status: 'reprinted', reprintOf: 'PJ-20260905-001', reason: '首次打印条码偏移',
        createdAt: '2026-09-05 18:10:00', codes: ['SNZG-20260905-0008']
      },
      {
        id: 'PJ-20260912-003', batchNo: 'PC-20260912-012', labelName: '秦冠专用标签',
        templateId: 'TPL-LITE', templateVersion: 1, qty: 1, operator: '包装组',
        status: 'scrapped', reprintOf: '', reason: '标签受潮报废',
        createdAt: '2026-09-12 17:25:00', codes: ['SNZG-20260912-0015']
      }
    ];
  }

  function seedRecalls() {
    return [{
      id: 'RC-20260921-001', batchNo: 'PC-20260920-020', reason: '检测报告被撤销，主动召回',
      scope: '已发货 950kg', operator: '质量负责人', status: 'active', createdAt: '2026-09-21 09:30:00'
    }];
  }

  function seedChannelAlerts() {
    return [
      {
        id: 'CA-20260923-001', level: 'high', type: '窜货预警', code: 'SNZG-20260901-0001',
        batchNo: 'PC-20260901-001', region: '广东省深圳市', message: '授权销售区域为甘肃/陕西，深圳出现高频扫码',
        at: '2026-09-23 02:16:00', status: 'open'
      },
      {
        id: 'CA-20260922-002', level: 'medium', type: '重复扫码', code: 'SNZG-20260918-0021',
        batchNo: 'PC-20260918-018', region: '甘肃省天水市', message: '同一码 10 分钟内被查询 18 次',
        at: '2026-09-22 14:05:00', status: 'open'
      }
    ];
  }

  function seedRegulatoryReports() {
    return [{
      id: 'RG-20260922-001', batchNo: 'PC-20260901-001', type: '农产品质量安全追溯报送',
      period: '2026-09', status: 'submitted', submittedAt: '2026-09-22 10:00:00',
      receiver: '天水市农业农村局', operator: '管理员'
    }];
  }

  function seedApiKeys() {
    return [{
      id: 'AK-001', name: '监管平台只读接口', keyMasked: 'sk_live_••••••••3f7a',
      scope: 'trace:read, report:read', calls: 1284, status: 'active', createdAt: '2026-08-01 09:00:00',
      lastUsedAt: '2026-09-22 16:20:00'
    }];
  }

  function seedCodeSegments() {
    return [
      {
        id: 'SEG-2026-09A', prefix: 'SNZG-202609', total: 5000, used: 23,
        status: 'active', risk: 'low', allocatedAt: '2026-09-01 08:00:00'
      },
      {
        id: 'SEG-2026-10A', prefix: 'SNZG-202610', total: 3000, used: 0,
        status: 'frozen', risk: 'medium', allocatedAt: '2026-10-01 08:00:00'
      }
    ];
  }

  /* 事件链构建 */
  function buildEvents(batches, inspections, codes, scans) {
    var events = [];
    var lastHash = '0'.repeat(64);
    var height = 1847300;

    function push(batchNo, code, type, title, summary, payload, time) {
      var prevHash = lastHash;
      var hash = hashEvent(prevHash, payload);
      height += 1;
      var ev = {
        id: 'EV-' + height, batchNo: batchNo || '', code: code || '', type: type,
        title: title, summary: summary, payload: payload || {},
        hash: hash, prevHash: prevHash, blockHeight: height,
        txId: '0x' + sha256(hash + '|' + height), chainTime: time || nowStr(),
        status: 'confirmed', contract: CONTRACT_ADDRESS, node: CHAIN_NODE, tsa: TSA
      };
      lastHash = hash;
      events.push(ev);
      return ev;
    }

    for (var i = 0; i < batches.length; i++) {
      var b = batches[i];
      push(b.batchNo, '', 'batch', '批次建立', b.batchNo + ' · ' + b.plotName,
        { batchNo: b.batchNo, plotCode: b.plotCode, harvestDate: b.harvestDate, quantity: b.quantity, processNo: b.processNo },
        b.createdAt || (b.harvestDate + ' 08:00:00'));
      var ins = null;
      for (var j = 0; j < inspections.length; j++) if (inspections[j].batchNo === b.batchNo) { ins = inspections[j]; break; }
      if (ins) {
        push(b.batchNo, '', 'inspection', '检测报告', ins.reportNo + ' · ' + ins.conclusion,
          { reportNo: ins.reportNo, institution: ins.institution, conclusion: ins.conclusion, validUntil: ins.validUntil, status: ins.status },
          ins.issueDate + ' 18:00:00');
      }
      for (var k = 0; k < codes.length; k++) {
        var c = codes[k];
        if (c.batch !== b.batchNo) continue;
        push(b.batchNo, c.code, 'code', '追溯码赋码', c.code,
          { code: c.code, batch: c.batch, shortUrl: shortUrlOf(c), template: c.template }, c.time);
        if (c.status === 'active') {
          push(b.batchNo, c.code, 'activate', '追溯码激活', c.code + ' 已激活',
            { code: c.code, batch: c.batch, order: c.order }, c.firstScanAt || c.time);
        }
        if (c.firstScanAt) {
          push(b.batchNo, c.code, 'scan', '首次扫码', c.code + ' · ' + c.firstScanAt,
            { code: c.code, firstScanAt: c.firstScanAt, queries: c.queries }, c.firstScanAt);
        }
      }
      if (b.shipment) {
        push(b.batchNo, '', 'shipment', '批次出库', b.shipment.customer + ' · ' + b.shipment.id,
          { batchNo: b.batchNo, shipment: b.shipment }, b.shipment.date + ' 09:00:00');
      }
    }
    for (var s = 0; s < scans.length; s++) {
      if (scans[s].result !== 'risk') continue;
      push('', scans[s].code, 'risk', '扫码异常', scans[s].riskReason,
        { code: scans[s].code, region: scans[s].region, riskFlag: scans[s].riskFlag, at: scans[s].at }, scans[s].at);
    }
    return events;
  }

  function seedAudit() {
    return [
      { id: 'AUD-0001', at: '2026-09-01 17:40:00', actor: '管理员', action: '生成追溯码', target: 'PC-20260901-001', detail: '生成 2 个追溯码' },
      { id: 'AUD-0002', at: '2026-09-07 18:05:00', actor: '质检员', action: '检测报告缺失', target: 'PC-20260907-007', detail: '批次无有效检测报告，赋码已拦截' },
      { id: 'AUD-0003', at: '2026-09-21 09:30:00', actor: '质量负责人', action: '发起召回', target: 'PC-20260920-020', detail: '检测报告撤销，主动召回' }
    ];
  }

  function shortUrlOf(codeRec) {
    var c = typeof codeRec === 'string' ? codeRec : (codeRec && codeRec.code);
    var sc = typeof codeRec === 'object' && codeRec && codeRec.shortCode ? codeRec.shortCode : shortCodeOf(c);
    var base = 'https://t.snzg.cn';
    var cfg = (inMemory && inMemory.config) || {};
    if (cfg.shortLinkBase) base = String(cfg.shortLinkBase).replace(/\/+$/, '');
    return base + '/' + sc;
  }

  function buildSeed() {
    var batches = seedBatches();
    var inspections = seedInspections(batches);
    var codes = seedCodes(batches);
    // 回填批次码数
    for (var i = 0; i < batches.length; i++) {
      var n = 0;
      for (var j = 0; j < codes.length; j++) if (codes[j].batch === batches[i].batchNo) n++;
      batches[i].codeCount = n;
    }
    var scans = seedScans(codes);
    var events = buildEvents(batches, inspections, codes, scans);
    var templates = seedTemplates();
    var stock = seedStock();
    var printJobs = seedPrintJobs();

    var data = {
      version: VERSION,
      batches: batches,
      inspections: inspections,
      codes: codes,
      labelTemplates: templates,
      labelStock: stock,
      labelReservations: [],
      printJobs: printJobs,
      events: events,
      scans: scans,
      showTemplates: seedShowTemplates(),
      auditLogs: seedAudit(),
      recalls: seedRecalls(),
      channelAlerts: seedChannelAlerts(),
      regulatoryReports: seedRegulatoryReports(),
      apiKeys: seedApiKeys(),
      codeSegments: seedCodeSegments(),
      config: {
        inspectionRequired: true,
        showInspection: true,
        showVideo: true,
        showVr: true,
        showEnvironment: true,
        shortLinkBase: 'https://t.snzg.cn',
        baseVideoUrl: '',
        company: COMPANY,
        contractAddress: CONTRACT_ADDRESS,
        chainNode: CHAIN_NODE,
        tsa: TSA
      }
    };
    mergeLegacy(data);
    // 种子事件需要引用 config 中的短链域名
    inMemory = data;
    data.events = buildEvents(data.batches, data.inspections, data.codes, data.scans);
    return data;
  }

  function mergeLegacy(data) {
    var lb = readJSON(LEGACY_BATCH_KEY, null);
    if (Array.isArray(lb)) {
      for (var i = 0; i < lb.length; i++) {
        var b = lb[i];
        if (!b || !b.batchNo) continue;
        var exists = false;
        for (var j = 0; j < data.batches.length; j++) if (data.batches[j].batchNo === b.batchNo) { exists = true; break; }
        if (exists) continue;
        var p = plotOf(b.plotCode);
        var product = productOf(p.variety);
        data.batches.push({
          id: b.id || ('BAT-' + b.batchNo), batchNo: b.batchNo, sourceRecordId: '',
          planNo: b.planNo || '', processNo: b.processNo || '', plotCode: b.plotCode || '',
          plotName: p.name || '', base: p.base || '', variety: p.variety || '', product: product,
          spec: b.spec || specOf(product), grade: b.grade || '', harvestDate: b.harvestDate || '',
          quantity: num(b.quantity), status: b.status || 'pending', codeCount: num(b.traceCount),
          traceCodes: [], remark: b.remark || '', shipment: null,
          createdAt: b.harvestDate || '', updatedAt: b.harvestDate || ''
        });
      }
    }
    var lc = readJSON(LEGACY_CODE_KEY, null);
    if (Array.isArray(lc)) {
      for (var k = 0; k < lc.length; k++) {
        var c = lc[k];
        if (!c || !c.code) continue;
        var has = false;
        for (var m = 0; m < data.codes.length; m++) if (data.codes[m].code === c.code) { has = true; break; }
        if (has) continue;
        data.codes.push({
          code: c.code, shortCode: c.shortCode || shortCodeOf(c.code), batch: c.batch || '',
          time: c.time || nowStr(), status: c.status || 'inactive', order: c.order || '',
          template: c.template || '标准版履历模板', queries: num(c.queries), firstScanAt: c.firstScanAt || '',
          lastQuery: c.lastQuery || '', createdAt: c.time || nowStr(), batchNo: c.batch || '',
          product: '', plotCode: ''
        });
      }
    }
  }

  /* ============================================================
   * 持久化
   * ============================================================ */
  var inMemory = null;
  var subscribers = [];

  function load() {
    var obj = readJSON(KEY, null);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    if (obj.version !== VERSION) return null;
    return obj;
  }
  function save() {
    if (!inMemory) return false;
    try {
      localStorage.setItem(KEY, JSON.stringify(inMemory));
      return true;
    } catch (e) {
      console.warn('[TraceStore] 本地存储写入失败', e);
      return false;
    }
  }
  function ensure() {
    if (inMemory) return inMemory;
    var stored = load();
    if (stored) {
      inMemory = stored;
      // 兼容旧版本缺字段
      if (!inMemory.labelTemplates) inMemory.labelTemplates = seedTemplates();
      if (!inMemory.labelStock) inMemory.labelStock = seedStock();
      if (!inMemory.labelReservations) inMemory.labelReservations = [];
      if (!inMemory.printJobs) inMemory.printJobs = seedPrintJobs();
      if (!inMemory.recalls) inMemory.recalls = seedRecalls();
      if (!inMemory.showTemplates) inMemory.showTemplates = seedShowTemplates();
      if (!inMemory.channelAlerts) inMemory.channelAlerts = seedChannelAlerts();
      if (!inMemory.regulatoryReports) inMemory.regulatoryReports = seedRegulatoryReports();
      if (!inMemory.apiKeys) inMemory.apiKeys = seedApiKeys();
      if (!inMemory.codeSegments) inMemory.codeSegments = seedCodeSegments();
      if (!inMemory.auditLogs) inMemory.auditLogs = seedAudit();
      if (!inMemory.config) inMemory.config = {};
      inMemory.config.inspectionRequired = true;
      return inMemory;
    }
    inMemory = buildSeed();
    save();
    // 首次初始化后尝试从后端预加载（异步，不阻塞）
    if (typeof depsReady !== 'undefined') {
      preloadFromBackend();
    }
    return inMemory;
  }
  function commit(reason) {
    var ok = save();
    for (var i = 0; i < subscribers.length; i++) {
      try { subscribers[i](reason); } catch (e) { console.warn('[TraceStore]', e); }
    }
    try {
      global.dispatchEvent(new CustomEvent('traceStoreChange', { detail: { reason: reason, saved: ok } }));
    } catch (e) {}
    // 变更后调度后端持久化（防抖）
    if (typeof schedulePersist === 'function' && reason !== 'backend-loaded') {
      schedulePersist(reason);
    }
    return ok;
  }
  function subscribe(fn) {
    if (typeof fn === 'function') subscribers.push(fn);
    return function () {
      var i = subscribers.indexOf(fn);
      if (i >= 0) subscribers.splice(i, 1);
    };
  }
  function reset() {
    inMemory = buildSeed();
    save();
    commit('reset');
    return inMemory;
  }

  function audit(action, target, detail) {
    var d = ensure();
    d.auditLogs = d.auditLogs || [];
    var prev = d.auditLogs[d.auditLogs.length - 1];
    var at = nowStr();
    var body = { at: at, actor: '管理员', action: action, target: target, detail: detail };
    var ev = {
      id: 'AUD-' + pad(d.auditLogs.length + 1, 4),
      at: at, actor: '管理员', action: action, target: target, detail: detail,
      prevHash: prev ? prev.hash || '' : '',
      hash: sha256(stableStringify(body) + (prev ? prev.hash || '' : ''))
    };
    d.auditLogs.push(ev);
    if (d.auditLogs.length > 300) d.auditLogs = d.auditLogs.slice(-300);
    return ev;
  }

  /* ============================================================
   * 批次
   * ============================================================ */
  function batches() { return clone(ensure().batches || []); }
  function batch(key) {
    var d = ensure();
    var k = text(key);
    for (var i = 0; i < d.batches.length; i++) {
      if (d.batches[i].batchNo === k || d.batches[i].id === k) return clone(d.batches[i]);
    }
    return null;
  }
  function saveBatch(obj) {
    var d = ensure();
    if (!obj || !obj.batchNo) return { ok: false, message: '批次号不能为空' };
    var idx = -1;
    for (var i = 0; i < d.batches.length; i++) if (d.batches[i].batchNo === obj.batchNo) { idx = i; break; }
    var p = plotOf(obj.plotCode);
    var product = obj.product || productOf(obj.variety || p.variety);
    var next = {
      id: obj.id || ('BAT-' + obj.batchNo),
      batchNo: obj.batchNo,
      sourceRecordId: obj.sourceRecordId || '',
      planNo: obj.planNo || '',
      processNo: obj.processNo || '',
      plotCode: obj.plotCode || p.code,
      plotName: obj.plotName || p.name,
      base: obj.base || p.base,
      variety: obj.variety || p.variety,
      product: product,
      spec: obj.spec || specOf(product),
      grade: obj.grade || '',
      harvestDate: obj.harvestDate || '',
      quantity: num(obj.quantity),
      status: obj.status || 'pending',
      codeCount: idx >= 0 ? num(d.batches[idx].codeCount) : num(obj.codeCount),
      traceCodes: idx >= 0 ? (d.batches[idx].traceCodes || []) : (obj.traceCodes || []),
      remark: obj.remark || '',
      shipment: obj.shipment || (idx >= 0 ? d.batches[idx].shipment : null),
      createdAt: idx >= 0 ? d.batches[idx].createdAt : (obj.createdAt || nowStr()),
      updatedAt: nowStr()
    };
    if (idx >= 0) d.batches[idx] = next; else d.batches.push(next);
    audit(idx >= 0 ? '编辑批次' : '新建批次', next.batchNo, next.plotName + ' / ' + next.product);
    commit('batch');
    return { ok: true, batch: clone(next) };
  }
  function removeBatch(key) {
    var d = ensure();
    var k = text(key), idx = -1;
    for (var i = 0; i < d.batches.length; i++) if (d.batches[i].batchNo === k || d.batches[i].id === k) { idx = i; break; }
    if (idx < 0) return { ok: false, message: '批次不存在' };
    var codes = codesOfBatch(d.batches[idx].batchNo);
    if (codes.length) return { ok: false, message: '该批次已生成追溯码，不能删除' };
    d.batches.splice(idx, 1);
    audit('删除批次', k, '');
    commit('batch');
    return { ok: true };
  }

  function harvestCandidates() {
    var d = ensure();
    var hs = global.HarvestStore;
    if (!hs || typeof hs.records !== 'function') return [];
    var records = [];
    try { records = hs.records() || []; } catch (e) { return []; }
    var exists = {};
    for (var i = 0; i < d.batches.length; i++) {
      exists[d.batches[i].batchNo] = true;
      if (d.batches[i].sourceRecordId) exists[d.batches[i].sourceRecordId] = true;
    }
    var out = [];
    for (var j = 0; j < records.length; j++) {
      var r = records[j];
      if (!r || !r.batchNo) continue;
      if (exists[r.batchNo] || exists[r.id]) continue;
      var p = plotOf(r.plot);
      var product = productOf(r.variety || p.variety);
      out.push({
        recordId: r.id, batchNo: r.batchNo, plotCode: r.plot, plotName: r.plotName || p.name,
        base: r.base || p.base, variety: r.variety || p.variety, product: product,
        quantity: num(r.qty), grade: r.levelName || '', harvestDate: datePart(r.startTime),
        planNo: r.planId || '', traceCode: r.traceCode || ''
      });
    }
    return out;
  }
  function createBatchFromHarvest(recordId) {
    var d = ensure();
    var list = harvestCandidates();
    var hit = null;
    for (var i = 0; i < list.length; i++) if (list[i].recordId === recordId || list[i].batchNo === recordId) { hit = list[i]; break; }
    if (!hit) return { ok: false, message: '采收记录不存在或已建批' };
    var procNo = '';
    try {
      var procs = (global.HarvestStore.processes && global.HarvestStore.processes()) || [];
      for (var j = 0; j < procs.length; j++) if (procs[j].recordId === hit.recordId) { procNo = procs[j].id; break; }
    } catch (e) {}
    var res = saveBatch({
      batchNo: hit.batchNo, sourceRecordId: hit.recordId, planNo: hit.planNo, processNo: procNo,
      plotCode: hit.plotCode, plotName: hit.plotName, base: hit.base, variety: hit.variety,
      product: hit.product, grade: hit.grade, harvestDate: hit.harvestDate, quantity: hit.quantity,
      status: 'pending', remark: '由采收记录 ' + hit.recordId + ' 自动建批'
    });
    if (res.ok) {
      appendEvent({
        batchNo: hit.batchNo, type: 'batch', title: '采收建批',
        summary: hit.batchNo + ' · ' + hit.plotName,
        payload: { sourceRecordId: hit.recordId, batchNo: hit.batchNo, harvestDate: hit.harvestDate, quantity: hit.quantity }
      });
    }
    return res;
  }

  /* ============================================================
   * 检测报告
   * ============================================================ */
  function inspections() { return clone(ensure().inspections || []); }
  function inspectionsOf(batchNo) {
    var d = ensure();
    var out = [];
    for (var i = 0; i < d.inspections.length; i++) {
      if (!batchNo || d.inspections[i].batchNo === batchNo) out.push(clone(d.inspections[i]));
    }
    out.sort(function (a, b) { return text(b.issueDate).localeCompare(text(a.issueDate)); });
    return out;
  }
  function inspectionState(batchNo) {
    var list = inspectionsOf(batchNo);
    var today = todayStr();
    var valid = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (it.status === 'valid' && it.conclusion === '合格' && (!it.validUntil || it.validUntil >= today)) valid.push(it);
    }
    var latest = list[0] || null;
    var message = '检测报告有效，可赋码';
    if (!list.length) message = '未上传检测报告，禁止生成追溯码';
    else if (!valid.length) {
      if (latest && latest.status === 'expired') message = '检测报告已过期，请重新检测后赋码';
      else if (latest && latest.status === 'revoked') message = '检测报告已撤销，禁止赋码';
      else if (latest && latest.conclusion !== '合格') message = '检测结论不合格，禁止赋码';
      else message = '无仍在有效期内的合格检测报告，禁止赋码';
    }
    return {
      required: true,
      count: list.length,
      hasValid: valid.length > 0,
      canCode: valid.length > 0,
      latest: valid[0] || latest,
      all: list,
      message: message
    };
  }
  function saveInspection(obj) {
    var d = ensure();
    if (!obj || !obj.batchNo) return { ok: false, message: '请选择批次' };
    if (!obj.reportNo) return { ok: false, message: '请填写检测报告编号' };
    if (!obj.institution) return { ok: false, message: '请填写检测机构' };
    if (!obj.conclusion) return { ok: false, message: '请选择检测结论' };
    var today = todayStr();
    var status = obj.status || 'valid';
    if (!obj.status) {
      if (obj.validUntil && obj.validUntil < today) status = 'expired';
      else if (obj.conclusion !== '合格') status = 'invalid';
      else status = 'valid';
    }
    var items = clone(obj.items || INSPECTION_ITEMS);
    var record = {
      id: obj.id || ('INS-' + obj.batchNo + '-' + obj.reportNo),
      batchNo: obj.batchNo,
      reportNo: obj.reportNo,
      institution: obj.institution,
      reportType: obj.reportType || '农药残留检测',
      sampleDate: obj.sampleDate || '',
      issueDate: obj.issueDate || today,
      validUntil: obj.validUntil || '',
      conclusion: obj.conclusion,
      items: items,
      attachment: obj.attachment || null,
      cma: obj.cma || '',
      cnas: obj.cnas || '',
      status: status,
      operator: obj.operator || '管理员',
      createdAt: obj.createdAt || nowStr(),
      updatedAt: nowStr()
    };
    var idx = -1;
    for (var i = 0; i < d.inspections.length; i++) {
      if (d.inspections[i].id === record.id) { idx = i; break; }
    }
    if (idx >= 0) d.inspections[idx] = record; else d.inspections.push(record);
    appendEvent({
      batchNo: record.batchNo, type: 'inspection', title: '检测报告',
      summary: record.reportNo + ' · ' + record.conclusion + ' · ' + record.institution,
      payload: {
        reportNo: record.reportNo, institution: record.institution, conclusion: record.conclusion,
        validUntil: record.validUntil, status: record.status, attachment: record.attachment ? record.attachment.name : ''
      }
    });
    audit('上传检测报告', record.batchNo, record.reportNo + ' / ' + record.conclusion);
    commit('inspection');
    return { ok: true, inspection: clone(record) };
  }
  function removeInspection(id) {
    var d = ensure();
    var idx = -1;
    for (var i = 0; i < d.inspections.length; i++) if (d.inspections[i].id === id) { idx = i; break; }
    if (idx < 0) return { ok: false, message: '报告不存在' };
    var rec = d.inspections.splice(idx, 1)[0];
    audit('撤销检测报告', rec.batchNo, rec.reportNo);
    commit('inspection');
    return { ok: true };
  }

  /* ============================================================
   * 追溯码
   * ============================================================ */
  function codes() { return clone(ensure().codes || []); }
  function code(codeStr) {
    var d = ensure();
    var k = text(codeStr);
    for (var i = 0; i < d.codes.length; i++) {
      if (d.codes[i].code === k || d.codes[i].shortCode === k) return clone(d.codes[i]);
    }
    return null;
  }
  function codeByShort(short) {
    var d = ensure();
    var k = text(short);
    for (var i = 0; i < d.codes.length; i++) if (d.codes[i].shortCode === k) return clone(d.codes[i]);
    return null;
  }
  function codesOfBatch(batchNo) {
    var d = ensure();
    var out = [];
    for (var i = 0; i < d.codes.length; i++) if (!batchNo || d.codes[i].batch === batchNo) out.push(clone(d.codes[i]));
    return out;
  }
  function nextCodeSeq() {
    var d = ensure();
    var max = 0;
    for (var i = 0; i < d.codes.length; i++) {
      var m = text(d.codes[i].code).match(/(\d{4})$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return max + 1;
  }
  function generateCodes(batchNo, count, opts) {
    var d = ensure();
    var b = null;
    for (var i = 0; i < d.batches.length; i++) if (d.batches[i].batchNo === batchNo) { b = d.batches[i]; break; }
    if (!b) return { ok: false, message: '批次不存在' };
    var gate = inspectionState(batchNo);
    if (!gate.canCode) return { ok: false, message: gate.message, gate: gate };
    var n = Math.max(1, Math.min(500, parseInt(count, 10) || 1));
    var seq = nextCodeSeq();
    var dateCode = compactDate(b.harvestDate) || compactDate(nowStr());
    var created = [];
    for (var j = 0; j < n; j++) {
      var no = 'SNZG-' + dateCode + '-' + pad(seq + j, 4);
      var c = {
        code: no, shortCode: shortCodeOf(no), batch: b.batchNo, time: nowStr(),
        status: 'inactive', order: '', template: (opts && opts.template) || '标准版履历模板',
        queries: 0, firstScanAt: '', lastQuery: '', createdAt: nowStr(),
        batchNo: b.batchNo, product: b.product, plotCode: b.plotCode
      };
      d.codes.push(c);
      created.push(c);
      b.traceCodes = b.traceCodes || [];
      b.traceCodes.push(no);
      appendEvent({
        batchNo: b.batchNo, code: no, type: 'code', title: '追溯码赋码', summary: no,
        payload: { code: no, batch: b.batchNo, shortUrl: shortUrlOf(c), template: c.template }
      });
    }
    b.codeCount = (b.codeCount || 0) + n;
    b.updatedAt = nowStr();
    audit('生成追溯码', b.batchNo, '生成 ' + n + ' 个追溯码');
    commit('code');
    return { ok: true, codes: clone(created), batch: clone(b) };
  }
  function updateCode(codeStr, patch) {
    var d = ensure();
    for (var i = 0; i < d.codes.length; i++) {
      if (d.codes[i].code === codeStr) {
        var keys = Object.keys(patch || {});
        for (var j = 0; j < keys.length; j++) d.codes[i][keys[j]] = patch[keys[j]];
        d.codes[i].updatedAt = nowStr();
        commit('code');
        return { ok: true, code: clone(d.codes[i]) };
      }
    }
    return { ok: false, message: '追溯码不存在' };
  }

  function recordScan(codeStr, meta) {
    var d = ensure();
    var c = null, idx = -1;
    for (var i = 0; i < d.codes.length; i++) {
      if (d.codes[i].code === codeStr || d.codes[i].shortCode === codeStr) { c = d.codes[i]; idx = i; break; }
    }
    if (!c) return { ok: false, message: '追溯码不存在' };
    var firstScan = !c.firstScanAt;
    var at = nowStr();
    if (firstScan) c.firstScanAt = at;
    c.queries = num(c.queries) + 1;
    c.lastQuery = at;
    if (c.status === 'inactive') c.status = 'active';
    var region = (meta && meta.region) || '甘肃省天水市';
    var riskFlag = (meta && meta.riskFlag) || '';
    var riskReason = (meta && meta.riskReason) || '';
    if (!riskFlag && c.queries >= 200) {
      riskFlag = 'frequency';
      riskReason = '查询次数异常偏高（≥200 次）';
    }
    if (!riskFlag && c.status === 'expired') {
      riskFlag = 'expired';
      riskReason = '追溯码已过期仍被查询';
    }
    var scan = {
      id: 'SCN-' + pad((d.scans || []).length + 1, 5),
      code: c.code, at: at, source: (meta && meta.source) || 'H5', region: region,
      device: (meta && meta.device) || 'H5 扫码',
      result: riskFlag ? 'risk' : (firstScan ? 'first' : 'normal'),
      riskFlag: riskFlag, riskReason: riskReason
    };
    d.scans = d.scans || [];
    d.scans.push(scan);
    if (d.scans.length > 1000) d.scans = d.scans.slice(-1000);
    if (firstScan) {
      appendEvent({
        batchNo: c.batch, code: c.code, type: 'scan', title: '首次扫码',
        summary: c.code + ' 首次被查询', payload: { code: c.code, region: region, source: scan.source, at: at }
      });
    }
    if (riskFlag) {
      appendEvent({
        batchNo: c.batch, code: c.code, type: 'risk', title: '扫码异常',
        summary: riskReason, payload: { code: c.code, region: region, riskFlag: riskFlag, at: at }
      });
      if (riskFlag === 'channel' || riskFlag === 'frequency') {
        d.channelAlerts = d.channelAlerts || [];
        d.channelAlerts.push({
          id: 'CA-' + pad(d.channelAlerts.length + 1, 3), level: 'high', type: '异常扫码',
          code: c.code, batchNo: c.batch, region: region, message: riskReason, at: at, status: 'open'
        });
      }
    }
    d.codes[idx] = c;
    commit('scan');
    return {
      ok: true, firstScan: firstScan, queries: c.queries, lastQuery: c.lastQuery,
      risk: !!riskFlag, riskReason: riskReason, codeRecord: clone(c)
    };
  }

  /* ============================================================
   * 事件存证
   * ============================================================ */
  function events() { return clone(ensure().events || []); }
  function appendEvent(obj) {
    var d = ensure();
    d.events = d.events || [];
    var last = d.events.length ? d.events[d.events.length - 1] : null;
    var prevHash = last ? last.hash : '0'.repeat(64);
    var payload = obj.payload || {};
    var hash = hashEvent(prevHash, payload);
    var height = last ? num(last.blockHeight) + 1 : 1847301;
    var ev = {
      id: 'EV-' + height,
      batchNo: obj.batchNo || '',
      code: obj.code || '',
      type: obj.type || 'event',
      title: obj.title || '溯源事件',
      summary: obj.summary || '',
      payload: payload,
      hash: hash,
      prevHash: prevHash,
      blockHeight: height,
      txId: '0x' + sha256(hash + '|' + height),
      chainTime: obj.chainTime || nowStr(),
      status: 'confirmed',
      contract: CONTRACT_ADDRESS,
      node: CHAIN_NODE,
      tsa: TSA
    };
    d.events.push(ev);
    return clone(ev);
  }
  function verifyEvent(id) {
    var d = ensure();
    var ev = null, idx = -1;
    for (var i = 0; i < d.events.length; i++) {
      if (d.events[i].id === id || d.events[i].txId === id) { ev = d.events[i]; idx = i; break; }
    }
    if (!ev) return { ok: false, reason: '事件不存在' };
    var expect = hashEvent(ev.prevHash, ev.payload);
    if (expect !== ev.hash) return { ok: false, reason: '事件哈希与原文不一致，数据可能被篡改', event: clone(ev) };
    var prev = idx > 0 ? d.events[idx - 1] : null;
    if (prev && prev.hash !== ev.prevHash) {
      return { ok: false, reason: '与前序事件哈希不连续，链条断裂', event: clone(ev) };
    }
    return { ok: true, reason: '链上验证通过', event: clone(ev) };
  }
  function verifyChain() {
    var d = ensure();
    var broken = [];
    for (var i = 0; i < d.events.length; i++) {
      var ev = d.events[i];
      var expect = hashEvent(ev.prevHash, ev.payload);
      if (expect !== ev.hash) broken.push({ id: ev.id, reason: '哈希不一致' });
      else if (i > 0 && ev.prevHash !== d.events[i - 1].hash) broken.push({ id: ev.id, reason: '前序哈希不连续' });
    }
    return {
      ok: broken.length === 0, total: d.events.length, broken: broken,
      checkedAt: nowStr(), contract: CONTRACT_ADDRESS, node: CHAIN_NODE, tsa: TSA
    };
  }
  function chainStats() {
    var d = ensure();
    var evs = d.events || [];
    return {
      total: evs.length,
      latestHeight: evs.length ? evs[evs.length - 1].blockHeight : 0,
      latestTime: evs.length ? evs[evs.length - 1].chainTime : '',
      latestHash: evs.length ? evs[evs.length - 1].hash : '',
      types: evs.reduce(function (acc, e) { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {}),
      contract: CONTRACT_ADDRESS, node: CHAIN_NODE, tsa: TSA
    };
  }

  /* ============================================================
   * 扫码日志 / 风控
   * ============================================================ */
  function scans() { return clone(ensure().scans || []); }
  function recalls() { return clone(ensure().recalls || []); }
  function createRecall(obj) {
    var d = ensure();
    if (!obj || !obj.batchNo) return { ok: false, message: '请选择批次' };
    if (!obj.reason) return { ok: false, message: '请填写召回原因' };
    var rec = {
      id: 'RC-' + compactDate(nowStr()) + '-' + pad((d.recalls || []).length + 1, 3),
      batchNo: obj.batchNo, reason: obj.reason, scope: obj.scope || '全部',
      operator: obj.operator || '管理员', status: 'active', createdAt: nowStr()
    };
    d.recalls = d.recalls || [];
    d.recalls.push(rec);
    appendEvent({
      batchNo: rec.batchNo, type: 'recall', title: '发起召回',
      summary: rec.reason, payload: { recallId: rec.id, batchNo: rec.batchNo, reason: rec.reason, scope: rec.scope }
    });
    audit('发起召回', rec.batchNo, rec.reason);
    commit('recall');
    return { ok: true, recall: clone(rec) };
  }
  function closeRecall(id) {
    var d = ensure();
    for (var i = 0; i < d.recalls.length; i++) {
      if (d.recalls[i].id === id) {
        d.recalls[i].status = 'closed';
        d.recalls[i].closedAt = nowStr();
        audit('关闭召回', d.recalls[i].batchNo, id);
        commit('recall');
        return { ok: true };
      }
    }
    return { ok: false, message: '召回记录不存在' };
  }
  function channelAlerts() { return clone(ensure().channelAlerts || []); }
  function closeAlert(id) {
    var d = ensure();
    for (var i = 0; i < d.channelAlerts.length; i++) {
      if (d.channelAlerts[i].id === id) {
        d.channelAlerts[i].status = 'closed';
        d.channelAlerts[i].closedAt = nowStr();
        commit('alert');
        return { ok: true };
      }
    }
    return { ok: false, message: '预警不存在' };
  }
  function regulatoryReports() { return clone(ensure().regulatoryReports || []); }
  function submitRegulatory(batchNo, operator) {
    var d = ensure();
    var b = batch(batchNo);
    if (!b) return { ok: false, message: '批次不存在' };
    var rep = {
      id: 'RG-' + compactDate(nowStr()) + '-' + pad((d.regulatoryReports || []).length + 1, 3),
      batchNo: batchNo, type: '农产品质量安全追溯报送', period: (b.harvestDate || '').slice(0, 7),
      status: 'submitted', submittedAt: nowStr(), receiver: '天水市农业农村局',
      operator: operator || '管理员'
    };
    d.regulatoryReports = d.regulatoryReports || [];
    d.regulatoryReports.push(rep);
    appendEvent({
      batchNo: batchNo, type: 'regulatory', title: '监管报送',
      summary: batchNo + ' 已报送天水市农业农村局',
      payload: { reportId: rep.id, batchNo: batchNo, period: rep.period }
    });
    audit('监管报送', batchNo, rep.id);
    commit('regulatory');
    return { ok: true, report: clone(rep) };
  }
  function apiKeys() { return clone(ensure().apiKeys || []); }
  function createApiKey(name) {
    var d = ensure();
    if (!name) return { ok: false, message: '请输入应用名称' };
    var raw = 'sk_live_' + sha256(name + nowStr()).slice(0, 24);
    var rec = {
      id: 'AK-' + pad((d.apiKeys || []).length + 1, 3), name: name,
      keyMasked: raw.slice(0, 10) + '••••••••' + raw.slice(-4),
      scope: 'trace:read, report:read', calls: 0, status: 'active',
      createdAt: nowStr(), lastUsedAt: ''
    };
    d.apiKeys = d.apiKeys || [];
    d.apiKeys.push(rec);
    audit('生成 API Key', name, rec.id);
    commit('apiKey');
    return { ok: true, key: raw, record: clone(rec) };
  }
  function codeSegments() { return clone(ensure().codeSegments || []); }
  function freezeSegment(id) {
    var d = ensure();
    for (var i = 0; i < d.codeSegments.length; i++) {
      if (d.codeSegments[i].id === id) {
        d.codeSegments[i].status = d.codeSegments[i].status === 'frozen' ? 'active' : 'frozen';
        audit('码段状态变更', id, d.codeSegments[i].status);
        commit('segment');
        return { ok: true, segment: clone(d.codeSegments[i]) };
      }
    }
    return { ok: false, message: '码段不存在' };
  }
  function riskSummary() {
    var d = ensure();
    var openAlerts = (d.channelAlerts || []).filter(function (a) { return a.status === 'open'; });
    var riskScans = (d.scans || []).filter(function (s) { return s.result === 'risk'; });
    var activeRecalls = (d.recalls || []).filter(function (r) { return r.status === 'active'; });
    return {
      openAlerts: openAlerts.length,
      riskScans: riskScans.length,
      activeRecalls: activeRecalls.length,
      frozenSegments: (d.codeSegments || []).filter(function (s) { return s.status === 'frozen'; }).length,
      alerts: clone(openAlerts),
      scans: clone(riskScans.slice(-20)),
      recalls: clone(activeRecalls)
    };
  }

  /* ============================================================
   * 标签 / 库存 / 打印
   * ============================================================ */
  function templates() { return clone(ensure().labelTemplates || []); }

  /* 溯源展示模板 CRUD */
  function showTemplates() { return clone(ensure().showTemplates || []); }
  function showTemplate(id) {
    var list = ensure().showTemplates || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id || list[i].name === id) return clone(list[i]);
    return null;
  }
  function saveShowTemplate(obj) {
    var d = ensure();
    if (!obj || !obj.name) return { ok: false, message: '请填写模板名称' };
    var idx = -1;
    for (var i = 0; i < d.showTemplates.length; i++) if (d.showTemplates[i].id === obj.id) { idx = i; break; }
    if (idx >= 0) {
      d.showTemplates[idx] = Object.assign({}, d.showTemplates[idx], obj);
      commit('show-template');
      return { ok: true, template: clone(d.showTemplates[idx]) };
    }
    var rec = Object.assign({ id: obj.id || ('ST-' + (d.showTemplates.length + 1)), createTime: nowStr().slice(0, 10) }, obj);
    d.showTemplates.unshift(rec);
    commit('show-template');
    return { ok: true, template: clone(rec) };
  }
  function removeShowTemplate(id) {
    var d = ensure();
    var before = d.showTemplates.length;
    d.showTemplates = d.showTemplates.filter(function (t) { return t.id !== id; });
    if (d.showTemplates.length === before) return { ok: false, message: '模板不存在' };
    commit('show-template');
    return { ok: true };
  }
  function template(id) {
    var list = ensure().labelTemplates || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id || list[i].name === id) return clone(list[i]);
    return null;
  }
  function saveTemplate(obj) {
    var d = ensure();
    if (!obj || !obj.name) return { ok: false, message: '请填写模板名称' };
    var idx = -1;
    for (var i = 0; i < d.labelTemplates.length; i++) if (d.labelTemplates[i].id === obj.id || d.labelTemplates[i].name === obj.name) { idx = i; break; }
    if (idx >= 0) {
      var old = d.labelTemplates[idx];
      var next = Object.assign({}, old, obj);
      if (obj.bumpVersion) {
        next.version = num(old.version) + 1;
        next.versions = (old.versions || []).concat([{ version: next.version, at: nowStr(), note: obj.note || '新建版本' }]);
      }
      next.updatedAt = nowStr();
      d.labelTemplates[idx] = next;
      audit('更新标签模板', next.name, 'v' + next.version);
      commit('template');
      return { ok: true, template: clone(next) };
    }
    var rec = {
      id: obj.id || ('TPL-' + (d.labelTemplates.length + 1)),
      name: obj.name, version: 1, status: obj.status || 'active',
      layout: obj.layout || { size: '60×40mm', material: '铜版纸', fields: ['产品名称', '批次号', '追溯码', '二维码'] },
      versions: [{ version: 1, at: nowStr(), note: '初版' }],
      createdAt: nowStr(), updatedAt: nowStr()
    };
    d.labelTemplates.push(rec);
    audit('新建标签模板', rec.name, 'v1');
    commit('template');
    return { ok: true, template: clone(rec) };
  }

  function stock(name) {
    var d = ensure();
    var reservations = d.labelReservations || [];
    function summary(n) {
      var total = num(d.labelStock[n]);
      var reserved = 0;
      for (var i = 0; i < reservations.length; i++) {
        if (reservations[i].name === n && reservations[i].status === 'active') reserved += num(reservations[i].qty);
      }
      return { name: n, stock: total, reserved: reserved, available: Math.max(0, total - reserved), unit: '张' };
    }
    if (name) return summary(name);
    var out = {};
    var keys = Object.keys(d.labelStock || {});
    for (var i = 0; i < keys.length; i++) out[keys[i]] = summary(keys[i]);
    return out;
  }
  function syncMobileStock() {
    try { localStorage.setItem(MOBILE_LABEL_STOCK_KEY, JSON.stringify(ensure().labelStock)); } catch (e) {}
  }
  function setStock(name, qty) {
    var d = ensure();
    if (!name) return { ok: false, message: '标签名称不能为空' };
    d.labelStock[name] = Math.max(0, parseInt(qty, 10) || 0);
    syncMobileStock();
    audit('调整标签库存', name, String(d.labelStock[name]));
    commit('stock');
    return { ok: true, stock: stock(name) };
  }
  function reserveStock(name, qty, meta) {
    var d = ensure();
    var n = Math.max(1, parseInt(qty, 10) || 1);
    var s = stock(name);
    if (s.available < n) return { ok: false, message: '可用库存不足，当前可用 ' + s.available + ' 张' };
    d.labelReservations = d.labelReservations || [];
    var rec = {
      id: 'RSV-' + compactDate(nowStr()) + '-' + pad(d.labelReservations.length + 1, 3),
      name: name, qty: n, status: 'active', at: nowStr(),
      ref: (meta && meta.ref) || '', operator: (meta && meta.operator) || '管理员'
    };
    d.labelReservations.push(rec);
    audit('预占标签库存', name, n + ' 张 / ' + rec.ref);
    commit('reserve');
    return { ok: true, reservation: clone(rec), stock: stock(name) };
  }
  function releaseReservation(id) {
    var d = ensure();
    for (var i = 0; i < d.labelReservations.length; i++) {
      if (d.labelReservations[i].id === id) {
        d.labelReservations[i].status = 'released';
        d.labelReservations[i].releasedAt = nowStr();
        audit('释放标签预占', d.labelReservations[i].name, id);
        commit('reserve');
        return { ok: true };
      }
    }
    return { ok: false, message: '预占记录不存在' };
  }
  function consumeStock(name, qty) {
    var d = ensure();
    var n = Math.max(1, parseInt(qty, 10) || 1);
    var total = num(d.labelStock[name]);
    if (total < n) return { ok: false, message: '标签库存不足，当前库存 ' + total + ' 张' };
    d.labelStock[name] = total - n;
    var remain = n;
    var reservations = d.labelReservations || [];
    for (var i = 0; i < reservations.length && remain > 0; i++) {
      var r = reservations[i];
      if (r.name !== name || r.status !== 'active') continue;
      var take = Math.min(num(r.qty), remain);
      r.qty = num(r.qty) - take;
      remain -= take;
      if (r.qty <= 0) {
        r.status = 'consumed';
        r.consumedAt = nowStr();
      }
    }
    syncMobileStock();
    audit('扣减标签库存', name, n + ' 张');
    commit('stock');
    return { ok: true, stock: stock(name) };
  }
  function printJobs() { return clone(ensure().printJobs || []); }
  function createPrintJob(obj) {
    var d = ensure();
    if (!obj || !obj.batchNo) return { ok: false, message: '请选择批次' };
    var labelName = obj.labelName || Object.keys(d.labelStock || {})[0];
    if (!labelName) return { ok: false, message: '请选择标签' };
    var qty = Math.max(1, parseInt(obj.qty, 10) || 1);
    var tpl = template(obj.templateId) || template(obj.template) || null;
    if (obj.consume !== false) {
      var res = consumeStock(labelName, qty);
      if (!res.ok) return res;
    }
    var rec = {
      id: 'PJ-' + compactDate(nowStr()) + '-' + pad((d.printJobs || []).length + 1, 3),
      batchNo: obj.batchNo,
      labelName: labelName,
      templateId: tpl ? tpl.id : (obj.templateId || ''),
      templateVersion: tpl ? tpl.version : num(obj.templateVersion),
      qty: qty,
      operator: obj.operator || '管理员',
      status: obj.reprintOf ? 'reprinted' : 'printed',
      reprintOf: obj.reprintOf || '',
      reason: obj.reason || '',
      createdAt: nowStr(),
      codes: obj.codes ? clone(obj.codes) : []
    };
    d.printJobs = d.printJobs || [];
    d.printJobs.push(rec);
    appendEvent({
      batchNo: rec.batchNo, type: 'label', title: rec.reprintOf ? '标签重打' : '标签打印',
      summary: rec.labelName + ' × ' + rec.qty,
      payload: {
        jobId: rec.id, batchNo: rec.batchNo, labelName: rec.labelName, qty: rec.qty,
        templateId: rec.templateId, templateVersion: rec.templateVersion, reprintOf: rec.reprintOf
      }
    });
    audit(rec.reprintOf ? '标签重打' : '标签打印', rec.batchNo, rec.labelName + ' × ' + rec.qty);
    commit('print');
    return { ok: true, job: clone(rec) };
  }
  function reprintJob(id, reason) {
    var d = ensure();
    var job = null;
    for (var i = 0; i < d.printJobs.length; i++) if (d.printJobs[i].id === id) { job = d.printJobs[i]; break; }
    if (!job) return { ok: false, message: '打印任务不存在' };
    if (!reason) return { ok: false, message: '重打必须填写原因' };
    return createPrintJob({
      batchNo: job.batchNo, labelName: job.labelName, templateId: job.templateId,
      qty: job.qty, operator: '管理员', reprintOf: job.id, reason: reason, codes: job.codes
    });
  }
  function scrapJob(id, reason) {
    var d = ensure();
    for (var i = 0; i < d.printJobs.length; i++) {
      if (d.printJobs[i].id === id) {
        d.printJobs[i].status = 'scrapped';
        d.printJobs[i].scrapReason = reason || '标签报废';
        d.printJobs[i].scrappedAt = nowStr();
        appendEvent({
          batchNo: d.printJobs[i].batchNo, type: 'label', title: '标签报废',
          summary: d.printJobs[i].labelName + ' × ' + d.printJobs[i].qty,
          payload: { jobId: id, reason: d.printJobs[i].scrapReason }
        });
        audit('标签报废', d.printJobs[i].batchNo, id + ' / ' + d.printJobs[i].scrapReason);
        commit('print');
        return { ok: true, job: clone(d.printJobs[i]) };
      }
    }
    return { ok: false, message: '打印任务不存在' };
  }

  /* ============================================================
   * 基地环境 / 证据包 / 配置 / 统计
   * ============================================================ */
  function stringSeed(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }
  function environmentOf(batchNo) {
    var b = batch(batchNo) || {};
    var seed = stringSeed(b.base || b.batchNo || 'base');
    var now = new Date();
    var weatherAt = fmtDateTime(addMinutes(now, -(seed % 18 + 4)));
    var soilAt = fmtDateTime(addMinutes(now, -(seed % 25 + 6)));
    var harvest = b.harvestDate || todayStr();
    return {
      batchNo: b.batchNo || batchNo,
      base: b.base || '',
      plotName: b.plotName || '',
      vrUrl: 'vr_panorama.html?base=' + encodeURIComponent(b.base || ''),
      videoUrl: (ensure().config.baseVideoUrl || ''),
      videoAvailable: !!ensure().config.baseVideoUrl,
      weather: {
        temp: (12 + seed % 9).toFixed(1),
        humidity: 52 + seed % 28,
        rainfall: (seed % 9) / 2,
        wind: (1 + seed % 5).toFixed(1),
        condition: ['晴', '多云', '阴', '晴间多云'][seed % 4],
        updatedAt: weatherAt,
        source: '基地气象站 WS-' + pad(seed % 6 + 1, 2)
      },
      soil: {
        temp: (11 + seed % 7).toFixed(1),
        moisture: 18 + seed % 16,
        ph: (6.2 + (seed % 8) / 10).toFixed(1),
        ec: 1150 + seed % 181,
        updatedAt: soilAt,
        source: '土壤墒情仪 SM-' + pad(seed % 5 + 1, 2)
      },
      captures: [
        { key: 'planting', name: '种植管理', file: 'trace_planting.jpg', time: shiftDate(harvest, -35) + ' 09:20:00' },
        { key: 'pruning', name: '修剪疏果', file: 'trace_pruning.jpg', time: shiftDate(harvest, -18) + ' 10:10:00' },
        { key: 'bagging', name: '套袋保护', file: 'trace_bagging.jpg', time: shiftDate(harvest, -9) + ' 08:40:00' },
        { key: 'testing', name: '采前检测', file: 'trace_testing.jpg', time: shiftDate(harvest, -1) + ' 15:30:00' },
        { key: 'harvest', name: '采摘入库', file: 'trace_harvest.jpg', time: harvest + ' 11:20:00' }
      ],
      updatedAt: weatherAt
    };
  }
  function config() { var d = ensure(); d.config.inspectionRequired = true; return clone(d.config); }
  function saveConfig(patch) {
    var d = ensure();
    var keys = Object.keys(patch || {});
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] === 'inspectionRequired') continue; // 强制开启，不允许关闭
      d.config[keys[i]] = patch[keys[i]];
    }
    d.config.inspectionRequired = true;
    audit('更新溯源配置', 'config', keys.join(','));
    commit('config');
    return { ok: true, config: clone(d.config) };
  }

  function exportEvidence(batchNo) {
    var b = batch(batchNo);
    if (!b) return null;
    var d = ensure();
    var ins = inspectionsOf(batchNo);
    var cs = codesOfBatch(batchNo);
    var evs = [];
    for (var i = 0; i < d.events.length; i++) if (d.events[i].batchNo === batchNo) evs.push(clone(d.events[i]));
    var ss = [];
    for (var j = 0; j < d.scans.length; j++) {
      for (var k = 0; k < cs.length; k++) if (d.scans[j].code === cs[k].code) { ss.push(clone(d.scans[j])); break; }
    }
    var jobs = [];
    for (var m = 0; m < d.printJobs.length; m++) if (d.printJobs[m].batchNo === batchNo) jobs.push(clone(d.printJobs[m]));
    return {
      exportedAt: nowStr(),
      company: COMPANY,
      batch: b,
      inspections: ins,
      codes: cs,
      events: evs,
      scans: ss,
      printJobs: jobs,
      environment: environmentOf(batchNo),
      chain: { contract: CONTRACT_ADDRESS, node: CHAIN_NODE, tsa: TSA, verified: verifyChain().ok }
    };
  }

  function stats() {
    var d = ensure();
    var codeList = d.codes || [];
    var active = 0, expired = 0;
    for (var i = 0; i < codeList.length; i++) {
      if (codeList[i].status === 'active') active++;
      if (codeList[i].status === 'expired') expired++;
    }
    var valid = 0;
    for (var j = 0; j < d.batches.length; j++) if (inspectionState(d.batches[j].batchNo).hasValid) valid++;
    var totalQueries = 0;
    for (var k = 0; k < codeList.length; k++) totalQueries += num(codeList[k].queries);
    return {
      batches: d.batches.length,
      codes: codeList.length,
      activeCodes: active,
      expiredCodes: expired,
      queries: totalQueries,
      scans: (d.scans || []).length,
      inspectionsValid: valid,
      inspectionsTotal: d.batches.length,
      inspectionRate: d.batches.length ? Math.round(valid * 100 / d.batches.length) : 0,
      events: (d.events || []).length,
      openAlerts: (d.channelAlerts || []).filter(function (a) { return a.status === 'open'; }).length,
      activeRecalls: (d.recalls || []).filter(function (r) { return r.status === 'active'; }).length,
      printJobs: (d.printJobs || []).length,
      stock: stock()
    };
  }

  /* ============================================================
   * 导出
   * ============================================================ */
  var api = {
    VERSION: VERSION,
    KEY: KEY,
    COMPANY: COMPANY,
    init: ensure,
    subscribe: subscribe,
    reset: reset,
    // 批次
    batches: batches, batch: batch, saveBatch: saveBatch, removeBatch: removeBatch,
    harvestCandidates: harvestCandidates, createBatchFromHarvest: createBatchFromHarvest,
    // 检测
    inspections: inspections, inspectionsOf: inspectionsOf, inspectionState: inspectionState,
    saveInspection: saveInspection, removeInspection: removeInspection,
    // 追溯码
    codes: codes, code: code, codeByShort: codeByShort, codesOfBatch: codesOfBatch,
    generateCodes: generateCodes, updateCode: updateCode, recordScan: recordScan,
    shortCodeOf: shortCodeOf, shortUrlOf: shortUrlOf,
    // 存证
    events: events, appendEvent: appendEvent, verifyEvent: verifyEvent,
    verifyChain: verifyChain, chainStats: chainStats,
    // 扫码 / 风控
    scans: scans, recalls: recalls, createRecall: createRecall, closeRecall: closeRecall,
    channelAlerts: channelAlerts, closeAlert: closeAlert,
    regulatoryReports: regulatoryReports, submitRegulatory: submitRegulatory,
    apiKeys: apiKeys, createApiKey: createApiKey,
    codeSegments: codeSegments, freezeSegment: freezeSegment, riskSummary: riskSummary,
    // 标签
    templates: templates, template: template, saveTemplate: saveTemplate,
    stock: stock, setStock: setStock, reserveStock: reserveStock,
    releaseReservation: releaseReservation, consumeStock: consumeStock,
    printJobs: printJobs, createPrintJob: createPrintJob,
    reprintJob: reprintJob, scrapJob: scrapJob,
    // 溯源展示模板
    showTemplates: showTemplates, showTemplate: showTemplate,
    saveShowTemplate: saveShowTemplate, removeShowTemplate: removeShowTemplate,
    // 环境 / 配置 / 审计
    environmentOf: environmentOf, config: config, saveConfig: saveConfig,
    audit: audit, auditLogs: function () { return clone(ensure().auditLogs || []); },
    exportEvidence: exportEvidence, stats: stats
  };

  global.TraceStore = api;
  ensure();
})(window);
