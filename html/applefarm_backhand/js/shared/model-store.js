/**
 * 智慧果园 · 六大模型统一数据源
 * --------------------------------------------------------------
 * 承载后台「模型中心」中生长、物候、气象、病虫害、产量、价格 六个模型页
 * 的顶部 KPI、图表数据与列表数据，作为上述模型数据的唯一来源。
 *
 * 存储 key： applefarm_models_v1
 *
 * 暴露 API：
 *   ModelStore.KEYS                 → 模型键名数组 ['growth','phenology','weather','pest','yield','price']
 *   ModelStore.all()                → 全部模型深拷贝（对象，按 KEYS 归位）
 *   ModelStore.get(key)             → 单个模型深拷贝，key 非法时返回 null
 *   ModelStore.patch(key, partial)  → 浅合并顶层字段后写回并广播，返回最新模型深拷贝
 *   ModelStore.replace(key, obj)    → 整体替换指定模型并广播
 *   ModelStore.field(path)          → 按点号路径取标量值，如 'yield.kpi.0.value'
 *   ModelStore.subscribe(fn)        → 订阅变更，返回 unsubscribe（fn 会先收到一次 'init'）
 *   ModelStore.reset()              → 恢复六个模型的默认数据
 *
 * 模型对象统一结构：
 *   { key, name, statusText, updatedAt, kpi:[], charts:{}, lists:{}, meta:{} }
 *   - kpi[] 项：{ label, value, unit, trend:{ text, tone, color }, tone }
 *     value 保留页面原始数字字符串，unit 为单独拆分的单位文本，trend 保留原文案与颜色语义
 *   - 折线/柱状图统一为 { categories:[], series:[{ name, data:[] }] }
 *   - 饼图/环图统一为 { items:[{ name, value }] }
 *
 * 约定：后台为唯一数据源，移动端 / H5 / 大屏等其余端只读本 store，
 * 不得再各自硬编码模型数据；如需写入，仅允许后台页面调用 patch / replace。
 */

(function(global){
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
      { name: 'Api', src: baseDir + '../../../common/js/api.js' },
      { name: 'ModelMapper', src: baseDir + 'model-mapper.js' }
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
  /* 本 store 局部写入标记：竞态守卫只看自身写入，避免多 store 页面共享全局计数器互相误丢预加载 */
  var localWriteMark = 0;
  var persistTimer = null;

  function backendApi() {
    if (typeof global.Api !== 'object' && typeof global.Api !== 'function') return null;
    if (!global.Api.get || !global.Api.create) return null;
    if (typeof global.ModelMapper === 'undefined') return null;
    return global.Api;
  }
  function backendEnabled() {
    var api = backendApi();
    if (!api) return false;
    try { return !!api.isLoggedIn(); } catch (e) { return false; }
  }
  function preloadFromBackend() {
    var writeMark0 = localWriteMark;
    if (backendLoadPromise) return backendLoadPromise;
    backendLoadPromise = Promise.resolve(depsReady).then(function () {
      var api = backendApi();
      if (!api || !api.isLoggedIn || !api.isLoggedIn()) return { ok: false, message: '未登录或依赖未就绪' };
      return api.get('model/aggregate');
    }).then(function (res) {
      if (res && res.ok && res.data) {
        // 严格模式：预加载在途期间用户保存过数据，保留本地结果，避免陈旧快照覆盖
        if (localWriteMark !== writeMark0) return res;
        var models = global.ModelMapper.toAggregate(res.data);
        var e = ensure();
        var defs = defaults();
        KEYS.forEach(function (k) {
          // 空库无快照时保留默认空结构（kpi/lists/charts 均为空），
          // 不能退化成 []，否则页面读取 model.kpi / model.lists 会报错。
          // 有快照时用其覆盖默认顶层字段，缺失的脚手架（如 meta）仍由默认补齐。
          e[k] = models[k] ? Object.assign({}, defs[k], models[k]) : defs[k];
        });
        save();
        notify('backend-loaded');
      }
      return res;
    }).catch(function (err) {
      console.warn('[ModelStore] 后端预加载失败，降级 localStorage', err);
      return { ok: false, message: err && err.message };
    });
  }
  function persistToBackend() {
    var api = backendApi();
    if (!api || !backendEnabled()) return Promise.resolve({ ok: false, message: '未登录或依赖未就绪' });
    var e = ensure();
    var body = { models: global.ModelMapper.fromAggregate(e) };
    return api.create('model/aggregate', body);
  }
  function schedulePersist(reason) {
    if (!backendEnabled()) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      persistTimer = null;
      persistToBackend().catch(function (e) { console.warn('[ModelStore] 后端持久化失败', e); });
    }, 300);
  }

  var STORAGE_KEY = 'applefarm_models_v1';
  var KEYS = ['growth', 'phenology', 'weather', 'pest', 'yield', 'price'];
  var UPDATED_AT = '';
  /* 种子版本：演示数据按月滚动维护，版本号变化时把「已随时间失效」的数据块刷新到新种子
     （当前只刷新气象口径与地块关联字段，其余模型保留后台已保存的编辑结果） */
  var SEED_VERSION = '2026-11-10';

  var TONE_COLOR = {
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--error)',
    muted: 'var(--text-tertiary)'
  };

  /* ---------------- 通用小工具 ---------------- */

  function deepClone(o){ return JSON.parse(JSON.stringify(o)); }

  // 生成顶部 KPI 项，trend 保留原始文案与颜色语义
  function kpi(label, value, unit, trendText, trendTone, tone, extra){
    var t = trendTone || 'muted';
    var item = {
      label: label,
      value: value,
      unit: unit || '',
      trend: { text: trendText, tone: t, color: TONE_COLOR[t] || TONE_COLOR.muted },
      tone: tone
    };
    if (extra) {
      Object.keys(extra).forEach(function(k){ item[k] = extra[k]; });
    }
    return item;
  }

  var MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

  // MM-DD → 月份小数（与 model_phenology.html 同一换算口径）
  function mmddToMonthFloat(text, fallback){
    var m = /^(\d{1,2})-(\d{1,2})$/.exec(String(text || '').trim());
    if (!m) return fallback;
    var month = Math.min(12, Math.max(1, parseInt(m[1], 10)));
    var day = Math.min(31, Math.max(1, parseInt(m[2], 10)));
    return month - 1 + (day - 1) / 30;
  }

  /* ---------------- 1. 生长模型 ---------------- */

  var DEFAULT_GROWTH = {
    key: 'growth',
    name: '生长模型',
    statusText: '运行中',
    updatedAt: UPDATED_AT,
    kpi: [],
    charts: {
      tempTrend: {
        categories: [],
        series: []
      },
      stageDistribution: {
        items: []
      },
      gantt: {
        categories: [],
        series: []
      }
    },
    lists: {
      advice: [],
      alerts: [],
      alertCount: 0
    },
    /* 大屏物候生长驾驶舱所需的生长看板数据（后台唯一数据源） */
    dashboard: {
      vigorIndex: null,         /* 长势指数 0-100，无数据 */
      maturityHitRate: null,    /* 成熟度预测吻合率 %，无数据 */
      lastSampledAt: ''
    },
    gdd: {
      unit: '℃·d',
      cumulative: 0,            /* 生育期积温累计 */
      weeklyAvg: 0,             /* 近 12 周周均增量 */
      compareNormal: '',        /* 较常年同期 */
      weeks: [],
      weekly: []
    },
    keyMetrics: [],
    growthCurves: {
      weeks: [],
      metrics: [
        { key: 'diameter', name: '果实横径', unit: 'mm',     ylab: '果实横径' },
        { key: 'height',   name: '株高',     unit: 'cm',     ylab: '株高' },
        { key: 'firmness', name: '果实硬度', unit: 'kg/cm²', ylab: '果实硬度' }
      ],
      series: []
    },
    meta: {
      title: '生长模型',
      subtitle: '积温驱动 · 生育期跟踪与农事建议',
      icon: 'plant',
      badge: '模型运行中',
      tabs: [
        { key: 'monitor', label: '生长监测' },
        { key: 'gantt', label: '生育期甘特' },
        { key: 'advice', label: '建议与报警' }
      ]
    }
  };

  /* ---------------- 2. 物候模型 ---------------- */

  var DEFAULT_STAGES = [];

  var PHENOLOGY_VARIETIES = ['花牛苹果（早熟）', '花牛苹果（晚熟）', '金帅'];
  var PHENOLOGY_OFFSETS = { '花牛苹果（早熟）': -0.3, '花牛苹果（晚熟）': 0, '金帅': 0.2 };

  // 年历图系列由物候期配置 + 品种偏移换算（与页面渲染逻辑一致）
  function buildCalendarSeries(stages){
    return stages.map(function(s){
      var start = mmddToMonthFloat(s.start, 0);
      var end = mmddToMonthFloat(s.end, 12);
      return {
        name: s.name,
        color: s.color,
        data: PHENOLOGY_VARIETIES.map(function(v){
          var off = PHENOLOGY_OFFSETS[v] || 0;
          return [Math.max(0, start + off), Math.min(12, end + off)];
        })
      };
    });
  }

  var DEFAULT_PHENOLOGY = {
    key: 'phenology',
    name: '物候模型',
    statusText: '运行中',
    updatedAt: UPDATED_AT,
    kpi: [],
    charts: {
      calendar: {
        categories: MONTHS.slice(),
        series: buildCalendarSeries(DEFAULT_STAGES)
      }
    },
    lists: {
      stages: deepClone(DEFAULT_STAGES),
      deviations: [],
      tasks: []
    },
    meta: {
      title: '物候模型',
      subtitle: '物候年历 · 期配置与农时偏差预警',
      icon: 'seed',
      badge: '模型运行中',
      today: '',
      todayMarker: null,
      months: MONTHS.slice(),
      varieties: PHENOLOGY_VARIETIES.slice(),
      offsets: deepClone(PHENOLOGY_OFFSETS),
      storageKey: 'snzg_phenology_stages',
      tabs: [
        { key: 'calendar', label: '物候年历' },
        { key: 'config', label: '物候期配置' },
        { key: 'task', label: '农时与任务' }
      ]
    }
  };

  /* ---------------- 3. 气象模型 ---------------- */

  var DEFAULT_WEATHER = {
    key: 'weather',
    name: '气象模型',
    statusText: '运行中',
    updatedAt: UPDATED_AT,
    kpi: [],
    charts: {
      tempTrend: {
        categories: [],
        series: []
      }
    },
    lists: {
      forecast: [],
      riskProbability: [],
      indexes: [],
      historyCompare: [],
      extremeWarnings: []
    },
    meta: {
      title: '气象模型',
      subtitle: '天气预报 · 气象风险与极端天气预警',
      icon: 'sun',
      badge: '模型运行中',
      /* P1-03：补齐大屏气象趋势所需字段，缺失时大屏显示“暂无数据” */
      extended: {
        observedAt: '',
        precipitation: null,    /* 今日降水量 mm */
        sunshineHours: null,    /* 今日日照时数 h */
        rainProbability: null,  /* 明日降水概率 % */
        tempDrop: null,         /* 未来 48h 降温幅度 ℃ */
        humidity: null,
        windSpeed: null,
        rainfall: null
      },
      tabs: [
        { key: 'forecast', label: '实时与预报' },
        { key: 'index', label: '指数与预警' }
      ]
    }
  };

  /* ---------------- 4. 病虫害模型 ---------------- */

  var DEFAULT_PEST = {
    key: 'pest',
    name: '病虫害模型',
    statusText: '运行中',
    updatedAt: UPDATED_AT,
    kpi: [],
    charts: {
      riskTrend3: {
        categories: [],
        series: []
      },
      riskTrend7: {
        categories: [],
        series: []
      }
    },
    lists: {
      pestTypes: [],
      factors: [],
      treatment: {
        title: '⚠ 防治建议',
        desc: '',
        meta: [],
        action: '采纳建议',
        pestName: ''
      },
      plots: [],
      basePlots: [],
      riskLegend: [
        { label: '高风险', color: '#ff5d63' },
        { label: '中风险', color: '#f5b53d' },
        { label: '低风险', color: '#2bd46e' },
        { label: '蓄水池', color: '#9fd0ff' }
      ]
    },
    meta: {
      title: '病虫害模型',
      subtitle: '风险地图 · 模型推演与防治建议',
      icon: 'bug',
      badge: '模型运行中',
      mapViewBox: '0 0 900 720',
      mapImage: 'images/gis_base.jpg',
      baseBoundary: '238,30 892,34 896,688 430,704 210,652 182,470 228,290 214,130',
      water: { cx: 186, cy: 606, rx: 38, ry: 24, label: '蓄水池' },
      facility: { x: 40, y: 50, width: 96, height: 46, rx: 10, label: '分选中心' },
      riskLevelRule: '风险等级由指数推导：≥70 高 · 40-69 中 · <40 低',
      tabs: [
        { key: 'map', label: '风险地图' },
        { key: 'trend', label: '趋势与清单' }
      ]
    }
  };

  /* ---------------- 5. 产量模型 ---------------- */

  var DEFAULT_YIELD = {
    key: 'yield',
    name: '产量模型',
    statusText: '运行中',
    updatedAt: UPDATED_AT,
    kpi: [],
    charts: {
      baseYield: {
        categories: [],
        series: []
      },
      yieldCompare: {
        categories: [],
        series: []
      },
      fruitSize: {
        categories: [],
        series: []
      }
    },
    lists: {
      baseYield: [],
      factors: [],
      plots: [],
      deviationNote: {
        formula: '偏差率 =（模型预估 − 上年度实采）÷ 上年度实采 × 100%。',
        rule: '着色口径：|偏差| ≤ 3% 绿色（模型可信）、3% ~ 7% 黄色（需复核）、> 7% 红色（建议校准模型参数）。'
      }
    },
    meta: {
      title: '产量模型',
      subtitle: '多因子融合 · 产量预估与偏差复核',
      icon: 'chartBar',
      badge: '模型运行中',
      deviationThresholds: { success: 3, warning: 7 },
      tabs: [
        { key: 'overview', label: '产量总览' },
        { key: 'compare', label: '预估与偏差' },
        { key: 'plot', label: '地块下钻' }
      ]
    }
  };

  /* ---------------- 6. 价格模型 ---------------- */

  var DEFAULT_PRICE = {
    key: 'price',
    name: '价格模型',
    statusText: '运行中',
    updatedAt: UPDATED_AT,
    kpi: [],
    charts: {
      priceTrend: {
        categories: [],
        series: []
      }
    },
    lists: {
      varieties: [],
      simulate: {
        title: '🎮 调整参数查看预测',
        basePrice: null,
        params: [],
        elasticity: { yield: -0.03, supply: -0.05, demand: 0.04 },
        result: '',
        resultLabel: '模拟预测价格',
        hint: '基于弹性系数 · 实时计算'
      },
      saleWindow: {
        title: '⚠ 销售建议',
        time: '',
        desc: '',
        countdown: []
      },
      specs: [],
      factors: []
    },
    meta: {
      title: '价格模型',
      subtitle: '价格趋势 · 情景模拟与销售时机建议',
      icon: 'wallet',
      badge: '模型运行中',
      tabs: [
        { key: 'trend', label: '价格预测' },
        { key: 'strategy', label: '销售策略' }
      ]
    }
  };

  /* ---------------- 读写与广播 ---------------- */

  var subscribers = [];
  var inMemory = null;

  function defaults(){
    return {
      growth: deepClone(DEFAULT_GROWTH),
      phenology: deepClone(DEFAULT_PHENOLOGY),
      weather: deepClone(DEFAULT_WEATHER),
      pest: deepClone(DEFAULT_PEST),
      yield: deepClone(DEFAULT_YIELD),
      price: deepClone(DEFAULT_PRICE)
    };
  }

  // localStorage 读写容错：不可用或数据损坏时不抛错
  function safeGet(key){
    try { return localStorage.getItem(key); } catch(e){ return null; }
  }

  function safeSet(key, value){
    try { localStorage.setItem(key, value); return true; } catch(e){ return false; }
  }

  function load(){
    var raw = safeGet(STORAGE_KEY);
    if (!raw) return null;
    try {
      var obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
      return obj;
    } catch(e){ return null; }
  }

  function save(){
    safeSet(STORAGE_KEY, JSON.stringify(inMemory));
  }

  // 单个模型容错合并：缺失字段补默认值，类型损坏的数据块整体回落
  function mergeModel(base, item){
    var out = Object.assign({}, base, item);
    if (!Array.isArray(out.kpi)) out.kpi = base.kpi;
    ['charts', 'lists', 'meta'].forEach(function(f){
      var v = out[f];
      if (!v || typeof v !== 'object' || Array.isArray(v)) out[f] = base[f];
    });
    if (!out.key) out.key = base.key;
    if (!out.name) out.name = base.name;
    return out;
  }

  function ensure(){
    if (inMemory) return inMemory;
    var base = defaults();
    var stored = load();
    if (stored) {
      // 逐键校正：缺失或结构损坏的模型回落到默认值，新增字段自动补齐
      KEYS.forEach(function(k){
        var item = stored[k];
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          stored[k] = base[k];
        } else {
          stored[k] = mergeModel(base[k], item);
        }
      });
      // 种子版本升级：把随时间失效的数据块（气象口径）刷新到新种子，其余保留用户编辑结果
      if (stored.__seedVersion !== SEED_VERSION) {
        stored.weather = base.weather;
        stored.__seedVersion = SEED_VERSION;
      }
      inMemory = stored;
    } else {
      inMemory = base;
      save();
    }
    if (typeof depsReady !== 'undefined') preloadFromBackend();
    return inMemory;
  }

  function notify(reason){
    subscribers.forEach(function(fn){
      try { fn(reason); } catch(e){ console.warn('[ModelStore] subscriber error', e); }
    });
    // 窗口事件统一在 notify 里派发：后端预加载（backend-loaded）与本地写入两条路径都会触发
    try {
      window.dispatchEvent(new CustomEvent('modelStoreChange', { detail:{ reason: reason } }));
    } catch(e){}
  }

  function broadcast(reason){
    if (reason !== 'backend-loaded') localWriteMark++;
    save();
    notify(reason);
    if (typeof schedulePersist === 'function') schedulePersist(reason);
  }

  function isKey(key){
    return KEYS.indexOf(key) >= 0;
  }

  /* ---------------- 派生计算：物候期快照 / 病虫害风险等级 ---------------- */

  // MM-DD → 月日序数（月×100+日），同年内可直接比较大小
  function mmddOrdinal(text){
    var m = /^(\d{1,2})-(\d{1,2})$/.exec(String(text || '').trim());
    if (!m) return null;
    var mo = Math.min(12, Math.max(1, parseInt(m[1], 10)));
    var d = Math.min(31, Math.max(1, parseInt(m[2], 10)));
    return mo * 100 + d;
  }

  function ordinalToUtc(year, ord){
    return Date.UTC(year, Math.floor(ord / 100) - 1, ord % 100);
  }

  function pad2(n){ return ('0' + n).slice(-2); }

  /* ---------------- 对外 API ---------------- */

  var ModelStore = {
    STORAGE_KEY: STORAGE_KEY,
    KEYS: KEYS.slice(),

    /**
     * 物候期快照：以 phenology.lists.stages 为唯一真源派生
     * 大屏、移动端、后台首页统一读取本方法，禁止各自硬编码当前物候期
     * @param {Date|string} [date] 传入日期时按该日期计算，缺省为今天
     * @returns {object|null} { today, currentStage, stageStart, stageEnd, progress, nextStage, harvestWindow }
     */
    phenologySnapshot: function(date){
      var model = ensure().phenology;
      var stages = (model.lists && model.lists.stages) || [];
      if (!stages.length) return null;

      var dt = date ? new Date(date) : new Date();
      if (isNaN(dt.getTime())) dt = new Date();
      var year = dt.getFullYear();
      var now = (dt.getMonth() + 1) * 100 + dt.getDate();

      var idx = -1;
      for (var i = 0; i < stages.length; i++) {
        var s = mmddOrdinal(stages[i].start);
        var e = mmddOrdinal(stages[i].end);
        if (s === null || e === null) continue;
        if (now >= s && now <= e) { idx = i; break; }
      }
      if (idx < 0) {
        // 落在配置空档时，取最近一个已开始的物候期
        idx = 0;
        for (var j = 0; j < stages.length; j++) {
          var sj = mmddOrdinal(stages[j].start);
          if (sj !== null && sj <= now) idx = j;
        }
      }

      var st = stages[idx];
      var start = mmddOrdinal(st.start);
      var end = mmddOrdinal(st.end);
      var progress = 0;
      if (start !== null && end !== null && end > start) {
        var t0 = ordinalToUtc(year, start);
        var t1 = ordinalToUtc(year, end);
        var tn = Date.UTC(year, dt.getMonth(), dt.getDate());
        progress = Math.max(0, Math.min(100, Math.round((tn - t0) / (t1 - t0) * 100)));
      }

      var harvestIndex = -1;
      for (var k = 0; k < stages.length; k++) {
        if (String(stages[k].name).indexOf('采收') >= 0) { harvestIndex = k; break; }
      }
      var harvestWindow = { start: '', end: '', isOpen: false, daysLeft: 0 };
      if (harvestIndex >= 0) {
        var hs = mmddOrdinal(stages[harvestIndex].start);
        var he = mmddOrdinal(stages[harvestIndex].end);
        var daysLeft = 0;
        if (he !== null) {
          var todayUtc = Date.UTC(year, dt.getMonth(), dt.getDate());
          daysLeft = Math.max(0, Math.round((ordinalToUtc(year, he) - todayUtc) / 86400000));
        }
        harvestWindow = {
          start: stages[harvestIndex].start || '',
          end: stages[harvestIndex].end || '',
          isOpen: hs !== null && he !== null && now >= hs && now <= he,
          daysLeft: daysLeft
        };
      }

      return {
        today: pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate()),
        year: year,
        currentStage: st.name,
        stageStart: st.start,
        stageEnd: st.end,
        progress: progress,
        nextStage: (stages[(idx + 1) % stages.length] || {}).name || '',
        harvestWindow: harvestWindow
      };
    },

    /**
     * 病虫害风险等级归一：兼容 level 字符串与 riskIndex 数值
     * 规则与 pest.meta.riskLevelRule 一致：≥70 高 · 40-69 中 · <40 低
     */
    riskLevelOf: function(value){
      if (value === 'low' || value === 'medium' || value === 'high') return value;
      var n = Number(value);
      if (isNaN(n)) return 'low';
      return n >= 70 ? 'high' : (n >= 40 ? 'medium' : 'low');
    },

    /**
     * 综合健康指数：Σ(地块 health × 面积) / Σ面积
     * 口径版本 v1（面积加权），仅统计已建模地块，返回值带样本数，供大屏直接展示
     * @returns {{value:number, sampleCount:number, totalArea:number, updatedAt:string, method:string}}
     */
    healthIndex: function(){
      var model = ensure().pest;
      var plots = (model.lists && model.lists.plots) || [];
      var wsum = 0, asum = 0, updatedAt = '';
      plots.forEach(function(p){
        var a = Number(p.area) || 0;
        var h = Number(p.health);
        if (!a || isNaN(h)) return;
        wsum += h * a;
        asum += a;
        if (p.updated && p.updated > updatedAt) updatedAt = p.updated;
      });
      return {
        value: asum ? Math.round(wsum / asum * 10) / 10 : 0,
        sampleCount: plots.length,
        totalArea: Math.round(asum * 10) / 10,
        updatedAt: updatedAt || model.updatedAt || '',
        method: 'area-weighted'
      };
    },

    /**
     * 四维健康评分（P1-01）：长势 / 水分 / 养分 / 病虫
     * 每项均可追溯到模型或原始检测数据；无数据的维度返回 available=false（前端显示“未检测”）
     * 权重版本 v1：长势 30% / 水分 20% / 养分 20% / 病虫 30%
     * @param {{soilMoist?:number}} [opts] 土壤含水率原始读数（来自 DeviceStore）
     */
    healthDimensions: function(opts){
      var o = opts || {};
      var g = ensure().growth;
      var p = ensure().pest;
      var plots = (p.lists && p.lists.plots) || [];
      var soil = (typeof global.SoilStore !== 'undefined' && global.SoilStore) ? global.SoilStore.summary() : null;

      var growth = g && g.dashboard && typeof g.dashboard.vigorIndex === 'number'
        ? g.dashboard.vigorIndex : null;

      var water = (typeof o.soilMoist === 'number' && isFinite(o.soilMoist))
        ? Math.max(0, Math.min(100, Math.round(o.soilMoist / 60 * 100))) : null;

      function cap(v, max){ return Math.max(0, Math.min(1, v / max)); }
      var nutrient = null;
      if (soil && soil.sampleCount > 0) {
        nutrient = Math.round(100 * (
          0.4 * cap(Number(soil.organicMatter) || 0, 2.5) +
          0.2 * cap(Number(soil.availableN) || 0, 80) +
          0.2 * cap(Number(soil.availableP) || 0, 30) +
          0.2 * cap(Number(soil.availableK) || 0, 200)
        ));
      }

      var pest = null;
      if (plots.length) {
        var wsum = 0, asum = 0;
        plots.forEach(function(x){
          var a = Number(x.area) || 0;
          var r = Number(x.riskIndex);
          if (!a || isNaN(r)) return;
          wsum += r * a; asum += a;
        });
        if (asum) pest = Math.max(0, Math.min(100, Math.round(100 - wsum / asum)));
      }

      function item(key, name, value, source){
        return { key: key, name: name, value: value, source: source, available: value !== null };
      }
      return {
        version: 'v1',
        weights: { growth: 0.3, water: 0.2, nutrient: 0.2, pest: 0.3 },
        items: [
          item('growth', '长势', growth, '生长模型 · 长势指数'),
          item('water', '水分', water, '土壤墒情仪 · 含水率/60%'),
          item('nutrient', '养分', nutrient, '土壤检测报告 · 有机质与速效氮磷钾'),
          item('pest', '病虫', pest, '病虫害模型 · 100−面积加权风险指数')
        ]
      };
    },

    all: function(){ return deepClone(ensure()); },

    get: function(key){
      if (!isKey(key)) return null;
      return deepClone(ensure()[key]);
    },

    patch: function(key, partial){
      if (!isKey(key) || !partial || typeof partial !== 'object') return null;
      var d = ensure();
      d[key] = Object.assign({}, d[key], partial);
      broadcast('patch:' + key);
      return deepClone(d[key]);
    },

    replace: function(key, obj){
      if (!isKey(key) || !obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
      var d = ensure();
      d[key] = Object.assign({ key: key, name: d[key].name }, obj);
      broadcast('replace:' + key);
      return deepClone(d[key]);
    },

    /**
     * 点号路径取值：'yield.kpi.0.value' → '450'
     * 为保持模型结构统一，顶层未命中时会依次到 lists / charts 下再找一次，
     * 因此 'price.saleWindow.title' 与 'price.lists.saleWindow.title' 等效。
     */
    field: function(path){
      if (!path || typeof path !== 'string') return undefined;
      var parts = path.split('.');
      var key = parts[0];
      if (!isKey(key)) return undefined;
      var model = ensure()[key];
      var rest = parts.slice(1);

      function walk(node, segs){
        var cur = node;
        for (var i = 0; i < segs.length; i++) {
          if (cur === null || cur === undefined) return undefined;
          cur = cur[segs[i]];
        }
        return cur;
      }

      var found = walk(model, rest);
      if (found !== undefined) return found;
      var inLists = walk(model.lists || {}, rest);
      if (inLists !== undefined) return inLists;
      var inCharts = walk(model.charts || {}, rest);
      if (inCharts !== undefined) return inCharts;
      return undefined;
    },

    subscribe: function(fn){
      subscribers.push(fn);
      try { fn('init'); } catch(e){}
      return function unsubscribe(){
        subscribers = subscribers.filter(function(x){ return x !== fn; });
      };
    },

    reset: function(){
      inMemory = defaults();
      save();
      broadcast('reset');
    },

    _syncFromExternal: function(){
      inMemory = null;
      ensure();
      notify('sync');
    },

    /**
     * 视图辅助：把模型 KPI 渲染到页面顶部指标带
     * @param {string} selector 指标带容器选择器，如 '.patrol-stats'
     * @param {string} key 模型键名
     * 只覆盖 stat-value / stat-label / stat-trend 的文本，不动卡片结构与内联样式。
     * 严格空库：kpi 无对应项的卡片显示 '--' 并清空趋势文案，不保留 HTML 写死的演示值。
     */
    hydrateKpi: function(selector, key){
      var model = ModelStore.get(key);
      if (!model) return;
      var root = document.querySelector(selector);
      if (!root) return;
      var cards = root.querySelectorAll('.patrol-stat-card');
      cards.forEach(function(card, i){
        var item = model.kpi[i];
        var value = card.querySelector('.stat-value');
        var label = card.querySelector('.stat-label');
        var trend = card.querySelector('.stat-trend');
        if (!item) {
          if (value) value.textContent = '--';
          if (trend) trend.textContent = '';
          return;
        }
        if (value) {
          value.innerHTML = String(item.value) +
            (item.unit ? '<small style="font-size:16px;font-weight:400;">' + item.unit + '</small>' : '');
        }
        if (label && item.label) label.textContent = item.label;
        if (trend) {
          trend.textContent = (item.trend && item.trend.text) || '';
          if (item.trend && item.trend.color) trend.style.color = item.trend.color;
        }
      });
    }
  };

  window.addEventListener('storage', function(e){
    if (e.key === STORAGE_KEY) ModelStore._syncFromExternal();
  });

  global.ModelStore = ModelStore;
})(window);
