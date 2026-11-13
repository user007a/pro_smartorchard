/* ============================================================
 * 企业驾驶舱统一数据层 EnterpriseStore
 * 存储键：applefarm_enterprise_v1
 * 说明：企业管理驾驶舱的唯一取数来源，页面只负责渲染。
 * ============================================================ */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'applefarm_enterprise_v1';
  var VERSION = 3;

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
  // 预加载竞态保护：记录「预加载请求在途期间」是否发生过本地写入，避免陈旧快照覆盖未推送的新增/编辑
  var preloadInFlight = false;
  var localWritesDuringPreload = 0;

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
    preloadInFlight = true;
    localWritesDuringPreload = 0;
    backendLoadPromise = Promise.resolve(depsReady).then(function () {
      var api = backendApi();
      if (!api || !api.isLoggedIn || !api.isLoggedIn()) return { ok: false, message: '未登录或依赖未就绪' };
      return api.get('enterprise/aggregate');
    }).then(function (res) {
      if (res && res.ok && res.data) {
        var agg = global.EnterpriseMapper.toAggregate(res.data);
        // 竞态保护：若预加载请求在途期间用户做了本地增删改（如刚新增基地），
        // 以本地数据为准，不要用页面加载时的陈旧快照覆盖，否则会「保存成功却看不到新增内容」。
        if (localWritesDuringPreload > 0) {
          backendReady = true;
          global.EnterpriseStore._refs = res.data.refs || global.EnterpriseStore._refs;
          // 不覆盖 memory / localStorage，本地变更稍后由 persistToBackend 推送到后端
        } else {
          // 后端数据合并进 store 内存（保留 DEFAULT_DATA 里的派生/展示兜底字段）
          memory = mergeDefaults(emptyByShape(DEFAULT_DATA), backendAggToStore(agg));
          backendReady = true;
          global.EnterpriseStore._refs = res.data.refs || null;
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(memory)); } catch (e) { /* ignore */ }
          broadcast('backend-sync');
        }
      } else if (res && res._unauthorized) {
        backendReady = false;
      }
      return res;
    }).catch(function (err) {
      console.warn('[EnterpriseStore] 后端预加载失败，回退本地缓存', err);
      backendReady = false;
      return { ok: false, message: err && err.message };
    }).finally(function () {
      preloadInFlight = false;
      backendLoadPromise = null;
    });
    return backendLoadPromise;
  }

  /** 把 mapper 产出的聚合对象映射回 store 的 DEFAULT_DATA 结构 */
  function backendAggToStore(agg) {
    var out = emptyByShape(DEFAULT_DATA);
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
      // operation 表是 label/value/unit 结构；按关键词匹配关键指标，
      // 兼容「年总产量 / 验证年产量 / 年度总产值」等各种后台自定义命名。
      var op = {};
      agg.operations.forEach(function (o) {
        var label = String(o.label || '');
        var val = Number(o.value);
        if (!isFinite(val)) return;
        if (!op.totalOutputValue && /产值|营收|销售收入/.test(label)) op.totalOutputValue = val;
        else if (!op.totalOutput && /产量|产出/.test(label)) op.totalOutput = val;
        else if (!op.coreArea && /核心/.test(label) && /面积|亩/.test(label + (o.unit || ''))) op.coreArea = val;
        else if (!op.serviceHouseholds && /农户|合作社/.test(label)) op.serviceHouseholds = val;
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
    fiscalYear: '',
    updatedAt: '',
    caliber: {
      outputValue: '苹果产业产值口径（含未销售库存）',
      output: '2026 年苹果产量',
      baseArea: '对外展示口径，基地/地块台账补齐后自动对齐'
    },
    reference: {
      enterpriseTotalOutputValue: 0,
      annualCapacity: 0,
      modelEstimate: 0
    },
    profile: {
      name: '',
      brand: '',
      location: '',
      foundedDate: '',
      positioning: '',
      vision: ''
    },
    operation: {
      totalOutputValue: 0,
      totalOutput: 0,
      totalArea: 0,
      coreArea: 0,
      serviceHouseholds: 0,
      techManagedArea: 0
    },
    certSeedCount: 0,
    bases: [],
    plotHealth: [],
    staff: [],
    experts: [],
    varieties: [],
    value5: [],
    yield5: [],
    business: [],
    timeline: [],
    events: [],
    outcomes: {
      netProfit: 0,
      netProfitYoy: 0,
      adoptionRevenue: 0,
      adoptionYoy: 0,
      qoq: 0,
      netRate: 0,
      adoptionOrders: 0,
      renewRate: 0
    }
  };

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /* 严格空库模式：按 DEFAULT_DATA 的形状生成「全空」骨架。
     数组清空、数值归零、字符串置空，只保留字段结构，避免页面在
     空库下仍显示内置的演示记录 / 演示指标。 */
  function emptyByShape(v) {
    if (Array.isArray(v)) return [];
    if (v && typeof v === 'object') {
      var o = {};
      for (var k in v) {
        if (Object.prototype.hasOwnProperty.call(v, k)) o[k] = emptyByShape(v[k]);
      }
      return o;
    }
    if (typeof v === 'number') return 0;
    if (typeof v === 'boolean') return false;
    return v === null ? null : '';
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
      if (!raw) return emptyByShape(DEFAULT_DATA);
      var parsed = JSON.parse(raw);
      if (!isObject(parsed)) throw new Error('invalid data');
      var merged = mergeDefaults(emptyByShape(DEFAULT_DATA), parsed);
      /* 版本迁移：旧版本曾把演示企业画像 / 基地 / 人员等写进本地缓存，
         严格空库模式下这些值必须丢弃，只保留字段结构，数据一律来自数据库。 */
      if (parsed.version !== VERSION) {
        merged = mergeDefaults(emptyByShape(DEFAULT_DATA), { version: VERSION });
      }
      return merged;
    } catch (e) {
      backupCorrupt(raw);
      return emptyByShape(DEFAULT_DATA);
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
    // 预加载请求在途期间发生的本地写入：标记计数，供其返回时跳过「陈旧快照覆盖」
    if (preloadInFlight) localWritesDuringPreload++;
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

  /* 地块健康分布：优先取 store 内已存的三档统计；为空时按地块台账
     plotStatus（normal/warning/danger）实时派生，保证大屏永远反映数据库现状。 */
  function plotHealth() {
    var saved = ensure().plotHealth;
    if (Array.isArray(saved) && saved.length) return clone(saved);
    var plots = ensure().plots || [];
    var normal = 0, warning = 0, danger = 0;
    plots.forEach(function (p) {
      var s = String(p.plotStatus || '').toLowerCase();
      if (s === 'warning' || s === 'maintain') warning++;
      else if (s === 'danger' || s === 'fallow') danger++;
      else normal++;
    });
    return [
      { k: '健康', v: normal, c: '#2bd46e' },
      { k: '预警', v: warning, c: '#F2B33D' },
      { k: '风险', v: danger, c: '#E5564B' }
    ];
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

  /* 主栽品种构成：数据库无「品种产量」明细，按地块台账的品种编码聚合
     种植面积（亩），面积占比即品种结构；无品种字段时返回空数组。 */
  function varieties() {
    var saved = ensure().varieties;
    if (Array.isArray(saved) && saved.length) return clone(saved);
    var plots = ensure().plots || [];
    var map = {}, order = [], total = 0;
    plots.forEach(function (p) {
      var k = String(p.varietyCode || '').trim();
      if (!k) return;
      if (!map[k]) { map[k] = 0; order.push(k); }
      map[k] += Number(p.area) || 0;
      total += Number(p.area) || 0;
    });
    if (!order.length || !total) return [];
    var COL = ['#38D6FF', '#2E8FE8', '#31C9E8', '#4E7FD6', '#6E8ED0', '#8AA0BE'];
    return order.map(function (k, i) {
      return { k: k, v: Math.round(map[k] * 10) / 10, c: COL[i % COL.length], p: Math.round(map[k] / total * 1000) / 10 };
    });
  }

  /* 近 5 年产值 / 产量：数据库未建年度历史表，只有当年经营指标时
     返回单点序列（当前年度），由页面按单柱/单点渲染；无数据返回空数组。 */
  function value5() {
    var saved = ensure().value5;
    if (Array.isArray(saved) && saved.length) return clone(saved);
    var v = Number(ensure().operation.totalOutputValue) || 0;
    if (!v) return [];
    return [[String(currentYear()), v]];
  }

  function yield5() {
    var saved = ensure().yield5;
    if (Array.isArray(saved) && saved.length) return clone(saved);
    var v = Number(ensure().operation.totalOutput) || 0;
    if (!v) return [];
    return [[String(currentYear()), v]];
  }

  function currentYear() {
    return new Date().getFullYear();
  }

  function business() {
    return clone(ensure().business);
  }

  function timeline() {
    return clone(ensure().timeline);
  }

  /* 企业大事记：数据库无独立「大事记」表，按发展历程（sf_enterprise_timeline）
     倒序取最近若干条作为大事记；无历程数据时返回空数组。 */
  function events() {
    var saved = ensure().events;
    if (Array.isArray(saved) && saved.length) return clone(saved);
    var tl = ensure().timeline || [];
    return tl.slice().sort(function (a, b) {
      return String(b.year || '').localeCompare(String(a.year || ''));
    }).slice(0, 5).map(function (t) {
      return { date: String(t.year || ''), text: (t.title || '') + (t.short ? '，' + t.short : ''), hot: false };
    });
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
    var ph = plotHealth();
    ph.forEach(function (h) {
      if (h.k === '健康') health += Number(h.v) || 0;
    });
    var outputValue = Number(d.operation.totalOutputValue) || 0;
    var output = Number(d.operation.totalOutput) || 0;
    var v5 = value5();
    var y5 = yield5();
    var valuePrev = v5.length > 1 ? Number(v5[v5.length - 2][1]) : 0;
    var yieldFirst = y5.length ? Number(y5[0][1]) : 0;
    var yieldLast = y5.length ? Number(y5[y5.length - 1][1]) : 0;
    var vars = varieties();
    return {
      baseCount: d.bases.length,
      totalArea: area,
      plotCount: plots,
      healthCount: health,
      healthRate: plots ? round1(health / plots * 100) : 0,
      varietyCount: vars.length,
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
      varietyNames: vars.map(function (v) { return v.k; }).join(' · ')
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
    /* 财务口径（净利润 / 净利率 / 环比）：统一取经营分析 BizStore，与 da_business 同源 */
    try {
      if (global.BizStore && typeof global.BizStore.summary === 'function') {
        var s = global.BizStore.summary();
        if (s) {
          if (Number(s.netProfit)) o.netProfit = Number(s.netProfit);
          if (Number(s.netRate)) o.netRate = Number(s.netRate);
          if (Number(s.netProfitYoy)) o.netProfitYoy = Number(s.netProfitYoy);
          if (Number(s.totalRevenue)) o.totalRevenue = Number(s.totalRevenue);
        }
      }
    } catch (ignore) {}
    o.certCount = m.certCount;
    o.adoptionRevenue = ad.amount;
    o.adoptionOrders = ad.orders;
    o.renewRate = ad.renewRate;
    o.fiscalYear = d.fiscalYear || String(new Date().getFullYear());
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
    return persist(emptyByShape(DEFAULT_DATA), 'reset');
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
