/* ============================================================
 * 企业驾驶舱统一数据层 EnterpriseStore
 * 存储键：applefarm_enterprise_v1
 * 说明：企业管理驾驶舱的唯一取数来源，页面只负责渲染。
 * ============================================================ */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'applefarm_enterprise_v1';
  var VERSION = 2;

  /* ============================================================
   * 后端桥接依赖自动加载（策略 A：出入口映射）
   * ------------------------------------------------------------
   * 依赖：common/js/api.js（统一请求）与 enterprise-mapper.js（映射层）。
   * 基于 document.currentScript.src 计算本脚本目录再拼接，避免跨层级 404。
   * ============================================================ */
  var depsReady = (function ensureDeps() {
    if (typeof document === 'undefined') return Promise.resolve();
    var selfEl = document.currentScript;
    if (!selfEl || !selfEl.src) return Promise.resolve();
    var baseDir = selfEl.src.replace(/[^\/]*$/, ''); // 去掉文件名，保留目录
    var deps = [
      { name: 'Api', src: baseDir + '../../../common/js/api.js' },
      { name: 'EnterpriseMapper', src: baseDir + 'enterprise-mapper.js' }
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
  var persistPending = null;

  function backendApi() {
    if (typeof global.Api !== 'object' && typeof global.Api !== 'function') return null;
    if (!global.Api.get || !global.Api.create) return null;
    if (typeof global.EnterpriseMapper === 'undefined') return null;
    return global.Api;
  }

  function backendEnabled() {
    var api = backendApi();
    if (!api) return false;
    try { return !!api.isLoggedIn(); } catch (e) { return false; }
  }

  /** 从后端聚合接口拉取企业数据，成功后合并进内存并通知 */
  function preloadFromBackend() {
    if (backendLoadPromise) return backendLoadPromise;
    backendLoadPromise = Promise.resolve(depsReady).then(function () {
      var api = backendApi();
      if (!api || !api.isLoggedIn || !api.isLoggedIn()) return { ok: false, message: '未登录或依赖未就绪' };
      return api.get('enterprise/aggregate');
    }).then(function (res) {
      if (res && res.ok && res.data) {
        var agg = global.EnterpriseMapper.toAggregate(res.data);
        // 后端数据合并进 store 内存（保留 DEFAULT_DATA 里的派生/展示兜底字段）
        memory = mergeDefaults(DEFAULT_DATA, backendAggToStore(agg));
        backendReady = true;
        global.EnterpriseStore._refs = res.data.refs || null;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(memory)); } catch (e) { /* ignore */ }
        broadcast('backend-sync');
      } else if (res && res._unauthorized) {
        backendReady = false;
      }
      return res;
    }).catch(function (err) {
      console.warn('[EnterpriseStore] 后端预加载失败，回退本地缓存', err);
      backendReady = false;
      return { ok: false, message: err && err.message };
    }).finally(function () {
      backendLoadPromise = null;
    });
    return backendLoadPromise;
  }

  /** 把 mapper 产出的聚合对象映射回 store 的 DEFAULT_DATA 结构 */
  function backendAggToStore(agg) {
    var out = clone(DEFAULT_DATA);
    if (agg.enterprise) {
      out.profile = {
        name: agg.enterprise.name || out.profile.name,
        brand: out.profile.brand,
        location: out.profile.location,
        foundedDate: agg.enterprise.establishDate || out.profile.foundedDate,
        positioning: out.profile.positioning,
        vision: out.profile.vision,
      };
      out.enterprise = agg.enterprise; // 保留完整企业字段，供信息页使用
    }
    if (agg.business && agg.business.length) {
      out.business = agg.business.map(function (b) {
        return { name: b.name, icon: b.icon || '🌿' };
      });
    }
    if (agg.staff && agg.staff.length) {
      out.staff = agg.staff.map(function (s) {
        return { k: s.role, v: s.count, c: STAFF_COLOR[s.role] || '#38D6FF' };
      });
    }
    if (agg.experts && agg.experts.length) {
      out.experts = agg.experts.map(function (e) {
        return { name: e.name, title: e.title };
      });
    }
    if (agg.timelines && agg.timelines.length) {
      out.timeline = agg.timelines.map(function (t) {
        return { year: t.year, title: t.title, short: t.short };
      });
    }
    if (agg.operations && agg.operations.length) {
      // operation 表是 label/value/unit 结构，映射回 operation 关键指标
      var op = {};
      agg.operations.forEach(function (o) {
        if (o.label === '年度总产值') op.totalOutputValue = o.value;
        else if (o.label === '年总产量') op.totalOutput = o.value;
        else if (o.label === '核心区面积') op.coreArea = o.value;
        else if (o.label === '服务农户') op.serviceHouseholds = o.value;
      });
      if (Object.keys(op).length) out.operation = mergeDefaults(out.operation, op);
    }
    if (agg.bases && agg.bases.length) {
      out.bases = agg.bases.map(function (b) {
        return { id: b.id, name: b.name, area: b.area, plots: b.plots, x: b.x, y: b.y, star: b.star || 0 };
      });
    }
    if (agg.plots && agg.plots.length) {
      out.plots = agg.plots; // 地块台账（新增，供 enterprise_plot 页使用）
    }
    return out;
  }

  /** 把 store 内存对象转成 mapper 需要的聚合对象，推送后端 */
  function storeToBackendAgg(data) {
    return {
      enterprise: data.enterprise || {
        name: data.profile.name,
        establishDate: data.profile.foundedDate,
      },
      business: (data.business || []).map(function (b, i) {
        return { id: i + 1, name: b.name, icon: b.icon };
      }),
      staff: (data.staff || []).map(function (s, i) {
        return { id: i + 1, role: s.k, count: s.v };
      }),
      experts: (data.experts || []).map(function (e, i) {
        return { id: i + 1, name: e.name, title: e.title };
      }),
      timelines: (data.timeline || []).map(function (t, i) {
        return { id: i + 1, year: t.year, title: t.title, short: t.short };
      }),
      operations: operationToRows(data.operation),
      bases: (data.bases || []).map(function (b) {
        return { id: b.id, name: b.name, area: b.area };
      }),
      plots: (data.plots || []).map(function (p) {
        return { id: p.id, name: p.name, baseId: p.baseId, area: p.area };
      }),
      deleted: {},
    };
  }

  function operationToRows(op) {
    if (!op) return [];
    var rows = [];
    if (op.totalOutputValue != null) rows.push({ id: 1, label: '年度总产值', value: op.totalOutputValue, unit: '万元' });
    if (op.totalOutput != null) rows.push({ id: 2, label: '年总产量', value: op.totalOutput, unit: '吨' });
    if (op.coreArea != null) rows.push({ id: 3, label: '核心区面积', value: op.coreArea, unit: '亩' });
    if (op.serviceHouseholds != null) rows.push({ id: 4, label: '服务农户', value: op.serviceHouseholds, unit: '户' });
    return rows;
  }

  /** 持久化到后端（防抖，合并连续写） */
  function persistToBackend(data) {
    persistPending = data;
    if (persistTimer) return;
    persistTimer = setTimeout(function () {
      persistTimer = null;
      var snapshot = persistPending;
      persistPending = null;
      if (!snapshot) return;
      Promise.resolve(depsReady).then(function () {
        var api = backendApi();
        if (!api || !api.isLoggedIn || !api.isLoggedIn()) return null;
        var ctx = global.EnterpriseMapper.buildContext(global.EnterpriseStore._refs);
        var payload = global.EnterpriseMapper.fromAggregate(storeToBackendAgg(snapshot), ctx);
        return api.create('enterprise/aggregate', payload).then(function (res) {
          if (res && res.ok) {
            backendReady = true;
            refreshRefs();
          } else if (res && res._unauthorized) {
            backendReady = false;
          } else {
            console.warn('[EnterpriseStore] 后端持久化失败', res && res.message);
          }
        });
      }).catch(function (err) {
        console.warn('[EnterpriseStore] 后端持久化异常', err);
      });
    }, 300);
  }

  function refreshRefs() {
    Promise.resolve(depsReady).then(function () {
      var api = backendApi();
      if (!api || !api.get) return null;
      return api.get('enterprise/aggregate').then(function (res) {
        if (res && res.ok && res.data && res.data.refs) {
          global.EnterpriseStore._refs = res.data.refs;
        }
      });
    }).catch(function () { /* ignore */ });
  }

  var STAFF_COLOR = { '管理': '#38D6FF', '技术': '#2E8FE8', '作业': '#31C9E8', '销售': '#4E7FD6', '后勤': '#8AA0BE', '其他': '#8AA0BE' };

  var DEFAULT_DATA = {
    version: VERSION,
    fiscalYear: '2026',
    updatedAt: '2026-11-10',
    caliber: {
      outputValue: '苹果产业产值口径（含未销售库存）',
      output: '2026 年苹果产量',
      baseArea: '对外展示口径，基地/地块台账补齐后自动对齐'
    },
    reference: {
      enterpriseTotalOutputValue: 12860,
      annualCapacity: 3600,
      modelEstimate: 450
    },
    profile: {
      name: '天水花牛苹果（集团）有限责任公司',
      brand: '数农智果',
      location: '甘肃 · 天水 · 麦积区',
      foundedDate: '2010-10-11',
      positioning: '国家级苹果现代农业产业园',
      vision: '数字赋能 · 绿色兴农'
    },
    operation: {
      totalOutputValue: 2512,
      totalOutput: 3260,
      totalArea: 2450,
      coreArea: 1650,
      serviceHouseholds: 3860,
      techManagedArea: 12000
    },
    certSeedCount: 10,
    bases: [
      { id: 'MJ', name: '麦积基地', area: 520, plots: 32, x: 300, y: 150, star: 1, baseStatus: 'active', address: '甘肃省天水市麦积区', managerName: '惠加宁', phone: '133-0791-2585', baseImages: [] },
      { id: 'QZ', name: '秦州基地', area: 430, plots: 24, x: 424, y: 196, star: 0, baseStatus: 'active', address: '甘肃省天水市秦州区', managerName: '黄忠坚', phone: '139-7941-2180', baseImages: [] },
      { id: 'QA', name: '秦安基地', area: 380, plots: 21, x: 216, y: 214, star: 0, baseStatus: 'active', address: '甘肃省天水市秦安县', managerName: '徐水应', phone: '138-7941-8637', baseImages: [] },
      { id: 'GG', name: '甘谷基地', area: 310, plots: 17, x: 136, y: 250, star: 0, baseStatus: 'active', address: '甘肃省天水市甘谷县', managerName: '陈小忠', phone: '187-7941-7899', baseImages: [] },
      { id: 'ZC', name: '张川基地', area: 240, plots: 13, x: 120, y: 140, star: 0, baseStatus: 'active', address: '甘肃省天水市张家川县', managerName: '朱泉龙', phone: '182-9645-2648', baseImages: [] },
      { id: 'QS', name: '清水基地', area: 190, plots: 10, x: 576, y: 120, star: 0, baseStatus: 'active', address: '甘肃省天水市清水县', managerName: '廖春亮', phone: '137-6767-9075', baseImages: [] },
      { id: 'LX', name: '陇西基地', area: 220, plots: 6, x: 722, y: 164, star: 0, baseStatus: 'active', address: '甘肃省定西市陇西县', managerName: '李建明', phone: '139-7043-2567', baseImages: [] },
      { id: 'WS', name: '武山基地', area: 160, plots: 3, x: 474, y: 288, star: 0, baseStatus: 'active', address: '甘肃省天水市武山县', managerName: '李根', phone: '130-3058-7809', baseImages: [] }
    ],
    plotHealth: [
      { k: '健康', v: 98, c: '#2bd46e' },
      { k: '预警', v: 21, c: '#F2B33D' },
      { k: '风险', v: 7, c: '#E5564B' }
    ],
    staff: [
      { k: '管理', v: 18, c: '#38D6FF' },
      { k: '技术', v: 42, c: '#2E8FE8' },
      { k: '作业', v: 198, c: '#31C9E8' },
      { k: '销售', v: 28, c: '#4E7FD6' }
    ],
    experts: [
      { name: '贾福昌', title: '首席农业专家' },
      { name: '李文清', title: '农业技术总监' },
      { name: '王建国', title: '数字农业专家' },
      { name: '张淑芬', title: '质量与品牌总监' }
    ],
    varieties: [
      { k: '富士', v: 1826, p: 56, c: '#38D6FF' },
      { k: '王林', v: 587, p: 18, c: '#2E8FE8' },
      { k: '花牛', v: 456, p: 14, c: '#31C9E8' },
      { k: '红星', v: 261, p: 8, c: '#4E7FD6' },
      { k: '其他', v: 130, p: 4, c: '#8AA0BE' }
    ],
    value5: [['2022', 1580], ['2023', 1795], ['2024', 2040], ['2025', 2231], ['2026', 2512]],
    yield5: [['2022', 2180], ['2023', 2460], ['2024', 2790], ['2025', 3010], ['2026', 3260]],
    business: [
      { name: '种植基地', icon: '🌿' },
      { name: '贮藏加工', icon: '📦' },
      { name: '品牌销售', icon: '🛒' },
      { name: '农资服务', icon: '🧪' },
      { name: '冷链物流', icon: '🚚' }
    ],
    timeline: [
      { year: '2010', title: '公司成立', short: '麦积区注册成立' },
      { year: '2012', title: '地理标志保护', short: '花牛苹果获保护' },
      { year: '2016', title: '中国农发基金注资', short: '战略股东加入' },
      { year: '2018', title: '“潘苹果”品牌发布', short: 'O2O 网络建立' },
      { year: '2024', title: '国家级龙头企业', short: '8 基地 126 地块' },
      { year: '2025', title: '首次出口马尔代夫', short: '品牌国际化', current: true }
    ],
    events: [
      { date: '2026-09', text: '数据大屏升级，八大驾驶舱全线互通', hot: true },
      { date: '2026-08', text: '区块链存证突破 10 万批次' },
      { date: '2026-07', text: '果园认养业务上线一周年' },
      { date: '2026-06', text: '苹果现代农业产业园二期投产' },
      { date: '2026-05', text: '央视《乡村振兴》栏目专题报道' }
    ],
    outcomes: {
      netProfit: 465,
      netProfitYoy: 18.2,
      adoptionRevenue: 291.58,
      adoptionYoy: 24.5,
      qoq: 6.8,
      netRate: 18.5,
      adoptionOrders: 1377,
      renewRate: 76.4
    }
  };

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function isObject(v) {
    return v && typeof v === 'object' && !Array.isArray(v);
  }

  function mergeDefaults(def, saved) {
    if (Array.isArray(def)) return Array.isArray(saved) ? saved : clone(def);
    if (isObject(def)) {
      var out = {};
      var k;
      for (k in def) {
        if (Object.prototype.hasOwnProperty.call(def, k)) {
          out[k] = mergeDefaults(def[k], isObject(saved) ? saved[k] : undefined);
        }
      }
      if (isObject(saved)) {
        for (k in saved) {
          if (Object.prototype.hasOwnProperty.call(saved, k) && !Object.prototype.hasOwnProperty.call(out, k)) {
            out[k] = saved[k];
          }
        }
      }
      return out;
    }
    return saved === undefined ? def : saved;
  }

  function backupCorrupt(raw) {
    try {
      if (raw) localStorage.setItem(STORAGE_KEY + '_backup_' + Date.now(), raw);
    } catch (ignore) {}
  }

  function readStore() {
    var raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return clone(DEFAULT_DATA);
      var parsed = JSON.parse(raw);
      if (!isObject(parsed)) throw new Error('invalid data');
      var merged = mergeDefaults(DEFAULT_DATA, parsed);
      /* 口径迁移：旧版认养营收/订单数（918 万 / 3260 单）与经营分析口径不一致，升级时重置 */
      if (parsed.version !== VERSION) {
        merged.outcomes = clone(DEFAULT_DATA.outcomes);
        merged.version = VERSION;
      }
      return merged;
    } catch (e) {
      backupCorrupt(raw);
      return clone(DEFAULT_DATA);
    }
  }

  var memory = null;

  var preloadTriggered = false;

  function ensure() {
    if (!memory) memory = readStore();
    // 首次调用时异步触发后端预加载（登录态 + 依赖就绪才生效，失败回退本地缓存）
    if (!preloadTriggered && backendEnabled()) {
      preloadTriggered = true;
      Promise.resolve(depsReady).then(function () {
        preloadFromBackend();
      });
    }
    return memory;
  }

  var subscribers = [];

  function broadcast(reason) {
    for (var i = 0; i < subscribers.length; i++) {
      try { subscribers[i](ensure(), reason); } catch (ignore) {}
    }
    try {
      window.dispatchEvent(new CustomEvent('enterpriseStoreChange', { detail: { reason: reason } }));
    } catch (ignore) {}
  }

  function persist(next, reason) {
    next.version = VERSION;
    next.updatedAt = new Date().toISOString().slice(0, 10);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      try { console.error('[EnterpriseStore] 写入失败', e); } catch (ignore) {}
      return { ok: false, error: '本地存储写入失败，请检查浏览器存储空间或隐私模式' };
    }
    memory = next;
    // 后端持久化（防抖），登录态 + 依赖就绪才生效，失败静默回退本地缓存
    if (backendEnabled()) persistToBackend(next);
    broadcast(reason || 'update');
    return { ok: true, data: clone(next) };
  }

  function data() {
    return clone(ensure());
  }

  function profile() {
    return clone(ensure().profile);
  }

  function operation() {
    return clone(ensure().operation);
  }

  function bases() {
    return clone(ensure().bases);
  }

  /** 基地台账（对齐 enterprise_base.html 的字段口径） */
  function baseLedger() {
    return clone(ensure().bases).map(function (b) {
      return {
        id: b.id,
        code: b.id,                     // 台账用 code 作编号（MJ/QZ...）
        name: b.name,
        address: b.address || '',
        area: b.area,
        manager: b.managerName || '',
        phone: b.phone || '',
        status: b.baseStatus || 'active',
        baseImages: b.baseImages || [],
      };
    });
  }

  /** 新增/更新基地（台账 CRUD） */
  function saveBase(item) {
    var next = ensure();
    var list = next.bases || [];
    var code = item.code || item.id;
    if (!code) return { ok: false, message: '缺少基地编号' };
    if (!item.name) return { ok: false, message: '缺少基地名称' };
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === code || list[i].code === code) { idx = i; break; }
    }
    var row = {
      id: code, code: code, name: item.name,
      area: Number(item.area) || 0,
      baseStatus: item.status || item.baseStatus || 'active',
      address: item.address || '',
      managerId: item.managerId || null,
      managerName: item.manager || item.managerName || '',
      phone: item.phone || '',
      baseImages: item.baseImages || [],
      plots: (idx >= 0 ? list[idx].plots : 0) || 0,
      x: (idx >= 0 ? list[idx].x : 0) || 0,
      y: (idx >= 0 ? list[idx].y : 0) || 0,
      star: (idx >= 0 ? list[idx].star : 0) || 0,
    };
    if (idx >= 0) list[idx] = row; else list.push(row);
    var r = persist(next, 'base-save');
    return { ok: !!r.ok, data: row, message: r.ok ? '已保存' : r.error };
  }

  /** 删除基地（台账 CRUD） */
  function removeBase(id) {
    var next = ensure();
    var list = next.bases || [];
    var before = list.length;
    next.bases = list.filter(function (b) { return b.id !== id && b.code !== id; });
    if (next.bases.length === before) return { ok: false, message: '基地不存在' };
    var r = persist(next, 'base-remove');
    return { ok: !!r.ok, message: r.ok ? '已删除' : r.error };
  }

  function plotHealth() {
    return clone(ensure().plotHealth);
  }

  function staff() {
    return clone(ensure().staff);
  }

  function staffTotal() {
    return ensure().staff.reduce(function (s, x) { return s + (Number(x.v) || 0); }, 0);
  }

  function technicalRatio() {
    var list = ensure().staff;
    var total = staffTotal();
    if (!total) return 0;
    var technical = 0;
    for (var i = 0; i < list.length; i++) {
      if (list[i].k === '技术' || list[i].k === '管理') technical += Number(list[i].v) || 0;
    }
    return Math.round(technical / total * 1000) / 10;
  }

  function experts() {
    return clone(ensure().experts);
  }

  function varieties() {
    return clone(ensure().varieties);
  }

  function value5() {
    return clone(ensure().value5);
  }

  function yield5() {
    return clone(ensure().yield5);
  }

  function business() {
    return clone(ensure().business);
  }

  function timeline() {
    return clone(ensure().timeline);
  }

  function events() {
    return clone(ensure().events);
  }

  function certCount() {
    try {
      if (global.CertStore && typeof global.CertStore.qualifications === 'function') {
        return global.CertStore.qualifications().length;
      }
    } catch (ignore) {}
    return ensure().certSeedCount;
  }

  function renewRate() {
    /* 经营汇总优先取 BizStore，认养订单明细仅作兜底 */
    try {
      if (global.BizStore && typeof global.BizStore.adoption === 'function') {
        var a = global.BizStore.adoption();
        if (a && typeof a.renewRate === 'number') return a.renewRate;
      }
    } catch (ignore) {}
    try {
      var obj = JSON.parse(localStorage.getItem('applefarm_adoption_v1') || 'null');
      var list = obj && Array.isArray(obj.orders) ? obj.orders : [];
      list = list.filter(function (o) {
        return o && ['paid', 'completed', 'refunded'].indexOf(o.status) >= 0;
      });
      if (list.length) {
        var renewed = list.filter(function (o) {
          return o.renew || Number(o.renewCount) > 0;
        }).length;
        return Math.round(renewed / list.length * 1000) / 10;
      }
    } catch (ignore) {}
    return ensure().outcomes.renewRate;
  }

  /* 认养经营口径：统一取 BizStore，与经营分析驾驶舱的收入构成「认养收入」同源同值 */
  function adoptionView() {
    var fallback = ensure().outcomes;
    try {
      if (global.BizStore && typeof global.BizStore.adoption === 'function') {
        var a = global.BizStore.adoption();
        if (a) {
          return {
            amount: Number(a.amount) || 0,
            orders: Number(a.orders) || 0,
            renewRate: Number(a.renewRate) || 0
          };
        }
      }
    } catch (ignore) {}
    return {
      amount: Number(fallback.adoptionRevenue) || 0,
      orders: Number(fallback.adoptionOrders) || 0,
      renewRate: Number(fallback.renewRate) || 0
    };
  }

  function foundedYears() {
    var d = ensure().profile.foundedDate;
    var y = parseInt(String(d).slice(0, 4), 10);
    if (!y) return 0;
    return Math.max(0, new Date().getFullYear() - y);
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function metrics() {
    var d = ensure();
    var area = 0, plots = 0, health = 0;
    d.bases.forEach(function (b) {
      area += Number(b.area) || 0;
      plots += Number(b.plots) || 0;
    });
    d.plotHealth.forEach(function (h) {
      if (h.k === '健康') health += Number(h.v) || 0;
    });
    var outputValue = Number(d.operation.totalOutputValue) || 0;
    var output = Number(d.operation.totalOutput) || 0;
    var v5 = d.value5 || [];
    var y5 = d.yield5 || [];
    var valuePrev = v5.length > 1 ? Number(v5[v5.length - 2][1]) : 0;
    var yieldFirst = y5.length ? Number(y5[0][1]) : 0;
    var yieldLast = y5.length ? Number(y5[y5.length - 1][1]) : 0;
    return {
      baseCount: d.bases.length,
      totalArea: area,
      plotCount: plots,
      healthCount: health,
      healthRate: plots ? round1(health / plots * 100) : 0,
      varietyCount: d.varieties.length,
      avgPlotArea: plots ? round1(area / plots) : 0,
      outputValue: outputValue,
      output: output,
      yieldPerMu: area ? Math.round(output / area * 100) / 100 : 0,
      valuePerTon: output ? Math.floor(outputValue * 10000 / output) : 0,
      outputYoy: valuePrev ? round1((outputValue / valuePrev - 1) * 100) : 0,
      value5Growth: v5.length && Number(v5[0][1]) ? round1((outputValue / Number(v5[0][1]) - 1) * 100) : 0,
      yield5Growth: yieldFirst ? round1((yieldLast / yieldFirst - 1) * 100) : 0,
      coreArea: Number(d.operation.coreArea) || 0,
      serviceHouseholds: Number(d.operation.serviceHouseholds) || 0,
      techManagedAreaText: formatArea(d.operation.techManagedArea),
      certCount: certCount(),
      staffTotal: staffTotal(),
      technicalRatio: technicalRatio(),
      foundedYears: foundedYears(),
      varietyNames: d.varieties.map(function (v) { return v.k; }).join(' · ')
    };
  }

  function formatArea(area) {
    var n = Number(area) || 0;
    if (n >= 10000) return (Math.round(n / 1000) / 10) + ' 万亩';
    return n + ' 亩';
  }

  function outcomes() {
    var d = ensure();
    var m = metrics();
    var o = clone(d.outcomes);
    var ad = adoptionView();
    o.totalOutputValue = m.outputValue;
    o.outputYoy = m.outputYoy;
    o.output = m.output;
    o.netRate = d.outcomes.netRate;
    o.certCount = m.certCount;
    o.adoptionRevenue = ad.amount;
    o.adoptionOrders = ad.orders;
    o.renewRate = ad.renewRate;
    o.fiscalYear = d.fiscalYear;
    return o;
  }

  function update(patch) {
    var next = ensure();
    if (!isObject(patch)) return { ok: false, error: '更新数据格式不正确' };
    var key;
    for (key in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        next[key] = isObject(patch[key]) && isObject(next[key])
          ? mergeDefaults(next[key], patch[key])
          : patch[key];
      }
    }
    return persist(next, 'update');
  }

  function reset() {
    return persist(clone(DEFAULT_DATA), 'reset');
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return function () {};
    subscribers.push(fn);
    return function () {
      subscribers = subscribers.filter(function (x) { return x !== fn; });
    };
  }

  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY) {
      memory = null;
      broadcast('storage');
    }
  });

  global.EnterpriseStore = {
    STORAGE_KEY: STORAGE_KEY,
    VERSION: VERSION,
    data: data,
    profile: profile,
    enterprise: function () { return clone(ensure().enterprise || null); },
    operation: operation,
    bases: bases,
    baseLedger: baseLedger,
    saveBase: saveBase,
    removeBase: removeBase,
    plots: function () { return clone(ensure().plots || []); },
    plotHealth: plotHealth,
    staff: staff,
    staffTotal: staffTotal,
    technicalRatio: technicalRatio,
    experts: experts,
    varieties: varieties,
    value5: value5,
    yield5: yield5,
    business: business,
    timeline: timeline,
    events: events,
    outcomes: outcomes,
    metrics: metrics,
    certCount: certCount,
    renewRate: renewRate,
    adoptionView: adoptionView,
    update: update,
    reset: reset,
    subscribe: subscribe
  };
})(window);
