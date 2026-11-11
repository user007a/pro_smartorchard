/**
 * 经营分析共享数据源
 * --------------------------------------------------------------
 * 承载「经营分析」菜单下的收入构成、成本结构、基地利润、
 * 应收周转、经营指标，以及认养续费率、客户排行等口径，
 * 供后台维护并供大屏（da_business.html）读取。
 *
 * 存储 key： applefarm_biz_v1
 *
 * 暴露 API：
 *   BizStore.revenueMix()       → 收入构成
 *   BizStore.revenueTarget()    → 营收目标与完成率
 *   BizStore.costStructure()    → 成本结构（五类科目）
 *   BizStore.baseProfit()       → 各基地利润分解
 *   BizStore.receivable()       → 应收账款账龄
 *   BizStore.metrics()          → 经营指标（毛利/周转/坪效/人均）
 *   BizStore.customerRank()     → 客户/渠道排行（按回款金额）
 *   BizStore.channelMix()       → 销售渠道占比
 *   BizStore.adoption()         → 认养订单与续费率
 *   BizStore.revenueTrend()     → 近 12 月营收趋势
 *   BizStore.summary()          → 顶部汇总
 *   BizStore.setRevenueMix / setRevenueTarget / setReceivable / setMetrics → 维护
 *   BizStore.subscribe(fn) / reset()
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
      { name: 'BizMapper', src: baseDir + 'biz-mapper.js' }
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
    if (typeof global.BizMapper === 'undefined') return null;
    return global.Api;
  }
  function backendEnabled() {
    var api = backendApi();
    if (!api) return false;
    try { return !!api.isLoggedIn(); } catch (e) { return false; }
  }
  function preloadFromBackend() {
    if (backendLoadPromise) return backendLoadPromise;
    backendLoadPromise = Promise.resolve(depsReady).then(function () {
      var api = backendApi();
      if (!api || !api.isLoggedIn || !api.isLoggedIn()) return { ok: false, message: '未登录或依赖未就绪' };
      return api.get('biz/aggregate');
    }).then(function (res) {
      if (res && res.ok && res.data) {
        var agg = global.BizMapper.toAggregate(res.data);
        var e = ensure();
        if (agg.revenueMix && agg.revenueMix.length) e.revenueMix = agg.revenueMix;
        if (agg.costStructure && agg.costStructure.length) e.costStructure = agg.costStructure;
        if (agg.baseProfit && agg.baseProfit.length) e.baseProfit = agg.baseProfit;
        if (agg.metrics && agg.metrics.length) e.metrics = agg.metrics;
        if (agg.receivable && agg.receivable.aging && agg.receivable.aging.length) e.receivable.aging = agg.receivable.aging;
        if (agg.customerRank && agg.customerRank.length) e.customerRank = agg.customerRank;
        save();
        notify('backend-loaded');
      }
      return res;
    }).catch(function (err) {
      console.warn('[BizStore] 后端预加载失败，降级 localStorage', err);
      return { ok: false, message: err && err.message };
    });
  }
  function persistToBackend() {
    var api = backendApi();
    if (!api || !backendEnabled()) return Promise.resolve({ ok: false, message: '未登录或依赖未就绪' });
    var e = ensure();
    var agg = {
      revenueMix: e.revenueMix || [], costStructure: e.costStructure || [],
      baseProfit: e.baseProfit || [], metrics: e.metrics || [],
      receivable: { aging: (e.receivable && e.receivable.aging) || [] }, customerRank: e.customerRank || [],
    };
    var body = global.BizMapper.fromAggregate(agg);
    return api.create('biz/aggregate', body);
  }
  function schedulePersist(reason) {
    if (!backendEnabled()) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      persistTimer = null;
      persistToBackend().catch(function (e) { console.warn('[BizStore] 后端持久化失败', e); });
    }, 300);
  }

  var STORAGE_KEY = 'applefarm_biz_v1';

  var DEFAULT_DATA = {
    schemaVersion: 3,
    fiscalYear: '2026 财年',

    // 收入构成（万元，合计须等于 totalRevenue）
    // 口径：与利润报表地块汇总 / 报表总览一致（2026 年 753.10 万元）
    revenueMix: [
      { name:'认养收入', value:291.58, ratio:38.7, channel:'企业 / 家庭果园' },
      { name:'批发收入', value:256.45, ratio:34.1, channel:'产地批发 / 商超直供' },
      { name:'零售收入', value:107.29, ratio:14.2, channel:'电商 / 门店' },
      { name:'观光采摘', value:65.76,  ratio:8.7,  channel:'园区采摘 / 研学' },
      { name:'其他收入', value:32.02,  ratio:4.3,  channel:'技术服务 / 代储' }
    ],
    totalRevenue: 753.1,
    revenueTarget: 960,

    // 近 12 月营收趋势（万元，合计须等于 totalRevenue）
    revenueTrend: [
      { month:'1月', value:50.53 }, { month:'2月', value:54.07 }, { month:'3月', value:60.19 },
      { month:'4月', value:66.91 }, { month:'5月', value:75.06 }, { month:'6月', value:81.26 },
      { month:'7月', value:74.35 }, { month:'8月', value:68.24 }, { month:'9月', value:73.43 },
      { month:'10月', value:62.29 }, { month:'11月', value:47.17 }, { month:'12月', value:39.59 }
    ],

    // 成本结构（五类科目，万元；名称与成本科目配置对齐）
    costStructure: [
      { name:'农资投入', value:125.38, ratio:28.5 },
      { name:'人工用工', value:115.26, ratio:26.2 },
      { name:'设备维护', value:104.70, ratio:23.8 },
      { name:'采收物流', value:56.31,  ratio:12.8 },
      { name:'其他费用', value:38.29,  ratio:8.7 }
    ],
    totalCost: 439.94,

    // 各基地利润分解（万元）— 由利润报表地块数据按基地主数据聚合，合计 = 净利润
    baseProfit: [
      { base:'天水秦州基地',     profit:104.79, revenue:237.83, cost:133.04, rate:44.1 },
      { base:'天水清水县基地',   profit:84.42,  revenue:197.60, cost:113.18, rate:42.7 },
      { base:'天水武山县基地',   profit:81.80,  revenue:210.60, cost:128.80, rate:38.8 },
      { base:'天水张家川县基地', profit:42.15,  revenue:107.07, cost:64.92,  rate:39.4 }
    ],

    // 应收账款账龄（万元）
    receivable: {
      balance: 412,
      over60: 14,
      aging: [
        { name:'30 天以内', value:186, ratio:45 },
        { name:'31-60 天',   value:168, ratio:41 },
        { name:'61-90 天',   value:42,  ratio:10 },
        { name:'90 天以上',  value:16,  ratio:4 }
      ],
      turnoverDays: 38,
      badDebt: 0
    },

    // 经营指标
    metrics: [
      { name:'毛利率',     value:41.6, unit:'%',  qoq: 1.2,  better:'up' },
      { name:'净利率',     value:41.6, unit:'%',  qoq: 0.6,  better:'up' },
      { name:'应收周转',   value:38,   unit:'天', qoq:-3,   better:'down' },
      { name:'库存周转',   value:12,   unit:'天', qoq:5,    better:'down' },
      { name:'坪效产值',   value:1.86, unit:'万元/亩', qoq:0.08, better:'up' },
      { name:'人均产值',   value:118,  unit:'万元/人', qoq:9,  better:'up' }
    ],

    // 销售渠道占比（按营收口径，与收入构成一致，保证同一金额只有一处口径）
    channelMix: [
      { name:'认养收入', value:38.7 },
      { name:'批发收入', value:34.1 },
      { name:'零售收入', value:14.2 },
      { name:'观光采摘', value:8.7 },
      { name:'其他收入', value:4.3 }
    ],

    // 客户/渠道排行（按回款金额，万元；与销售管理客户回款排行同源）
    customerRank: [
      { rank:1,  name:'北京XX超市',  amount:86.5, type:'批发客户' },
      { rank:2,  name:'上海XX电商',  amount:82.8, type:'批发客户' },
      { rank:3,  name:'武汉XX超市',  amount:78.4, type:'批发客户' },
      { rank:4,  name:'无锡XX电商',  amount:74.2, type:'批发客户' },
      { rank:5,  name:'成都XX电商',  amount:61.8, type:'批发客户' },
      { rank:6,  name:'苏州XX电商',  amount:54.5, type:'批发客户' },
      { rank:7,  name:'广州XX水果店', amount:24.9, type:'批发客户' },
      { rank:8,  name:'深圳XX电商',  amount:24.7, type:'批发客户' },
      { rank:9,  name:'青岛XX超市',  amount:22.6, type:'批发客户' },
      { rank:10, name:'郭女士',      amount:19.7, type:'认养客户' }
    ],

    // 认养（金额口径与收入构成中的「认养收入」一致）
    adoption: {
      orders: 1377,
      amount: 291.58,
      renewRate: 76.4,
      renewed: 1052,
      avgPrice: 2118
    },

    // 近 5 年营收/净利对比（万元）
    yearly: [
      { year:'2021', revenue:1820, profit:268 },
      { year:'2022', revenue:2050, profit:318 },
      { year:'2023', revenue:2280, profit:362 },
      { year:'2024', revenue:2460, profit:398 },
      { year:'2025', revenue:2656, profit:428 }
    ],

    // 其他
    netProfit: 313.16,
    netProfitYoy: -26.8,
    grossProfit: 313.16,
    repurchaseRate: 62,
    avgOrderValue: 328,
    totalOrders: 69
  };

  /* ---------------- 读写与广播 ---------------- */

  var subscribers = [];
  var inMemory = null;

  function deepClone(o){ return JSON.parse(JSON.stringify(o)); }

  function load(){
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      return (obj && typeof obj === 'object') ? obj : null;
    } catch(e){ return null; }
  }

  function save(){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemory)); } catch(e){} }

  function ensure(){
    if (inMemory) return inMemory;
    var stored = load();
    if (stored) {
      var base = deepClone(DEFAULT_DATA);
      Object.keys(base).forEach(function(k){ if (stored[k] === undefined) stored[k] = base[k]; });
      // P0/P1 口径迁移：旧版本按 2025 / 2656 万口径存储，升级时重置财务与结构字段
      if (stored.schemaVersion !== 3) {
        ['fiscalYear','revenueMix','totalRevenue','revenueTarget','revenueTrend',
         'costStructure','totalCost','baseProfit','channelMix','customerRank',
         'totalOrders','adoption','netProfit','netProfitYoy','grossProfit','metrics'].forEach(function(k){ stored[k] = base[k]; });
        stored.schemaVersion = 3;
        inMemory = stored;
        save();
        return inMemory;
      }
      inMemory = stored;
    } else {
      inMemory = deepClone(DEFAULT_DATA);
      save();
    }
    if (typeof depsReady !== 'undefined') preloadFromBackend();
    return inMemory;
  }

  function notify(reason){
    subscribers.forEach(function(fn){
      try { fn(reason); } catch(e){ console.warn('[BizStore] subscriber error', e); }
    });
  }

  function broadcast(reason){
    save();
    notify(reason);
    try {
      window.dispatchEvent(new CustomEvent('bizStoreChange', { detail:{ reason: reason } }));
    } catch(e){}
    if (typeof schedulePersist === 'function') schedulePersist(reason);
  }

  /* ---------------- 对外 API ---------------- */

  var BizStore = {
    STORAGE_KEY: STORAGE_KEY,

    revenueMix:    function(){ return deepClone(ensure().revenueMix); },
    revenueTarget: function(){ return deepClone(ensure()); },
    costStructure: function(){ return deepClone(ensure().costStructure); },
    baseProfit:    function(){ return deepClone(ensure().baseProfit); },
    receivable:    function(){ return deepClone(ensure().receivable); },
    metrics:       function(){ return deepClone(ensure().metrics); },
    channelMix:    function(){ return deepClone(ensure().channelMix); },
    customerRank:  function(){ return deepClone(ensure().customerRank); },
    adoption:      function(){ return deepClone(ensure().adoption); },
    revenueTrend:  function(){ return deepClone(ensure().revenueTrend); },
    yearly:        function(){ return deepClone(ensure().yearly); },

    /* 按月度营收曲线分摊某类收入，返回 12 个月序列（合计 = 该类收入年度金额） */
    revenueTrendByName: function(name){
      var d = ensure();
      var item = d.revenueMix.filter(function(x){ return String(x.name||'').indexOf(name) >= 0; })[0];
      var trend = d.revenueTrend || [];
      var total = trend.reduce(function(s,x){ return s + (Number(x.value)||0); }, 0);
      if (!item || !trend.length || !total) return [];
      var amount = Number(item.value) || 0;
      return trend.map(function(x){
        var v = Math.round((Number(x.value)||0) / total * amount * 100) / 100;
        return { month: x.month, value: v };
      });
    },

    summary: function(){
      var d = ensure();
      var mixSum = d.revenueMix.reduce(function(s, x){ return s + (x.value || 0); }, 0);
      var costSum = d.costStructure.reduce(function(s, x){ return s + (x.value || 0); }, 0);
      var profitSum = d.baseProfit.reduce(function(s, x){ return s + (x.profit || 0); }, 0);
      return {
        fiscalYear: d.fiscalYear,
        totalRevenue: d.totalRevenue,
        revenueTarget: d.revenueTarget,
        completeRate: d.revenueTarget ? Math.round(d.totalRevenue / d.revenueTarget * 1000) / 10 : 0,
        mixSum: Math.round(mixSum * 10) / 10,
        totalCost: Math.round(costSum * 10) / 10,
        budgetDiff: d.totalCost ? Math.round((costSum - d.totalCost) / d.totalCost * 1000) / 10 : 0,
        baseProfitSum: Math.round(profitSum * 10) / 10,
        netProfit: d.netProfit,
        netProfitYoy: d.netProfitYoy,
        netRate: d.totalRevenue ? Math.round(d.netProfit / d.totalRevenue * 1000) / 10 : 0,
        repurchaseRate: d.repurchaseRate,
        avgOrderValue: d.avgOrderValue,
        totalOrders: d.totalOrders,
        receivableBalance: d.receivable.balance,
        turnoverDays: d.receivable.turnoverDays
      };
    },

    setRevenueMix: function(list){
      var d = ensure();
      var clean = deepClone(list);
      var total = clean.reduce(function(s, x){ return s + (Number(x.value) || 0); }, 0);
      d.totalRevenue = Math.round(total * 10) / 10;
      d.revenueMix = clean.map(function(x){
        x.value = Math.round((Number(x.value) || 0) * 10) / 10;
        x.ratio = d.totalRevenue ? Math.round(x.value / d.totalRevenue * 1000) / 10 : 0;
        return x;
      });
      /* 认养收入变动时反向同步认养口径，保证两处始终同值 */
      var adoptItem = d.revenueMix.filter(function(x){ return String(x.name||'').indexOf('认养') >= 0; })[0];
      if (adoptItem) {
        d.adoption = Object.assign({}, d.adoption, { amount: adoptItem.value });
      }
      broadcast('revenueMix');
      return d.totalRevenue;
    },
    setRevenueTarget: function(value){
      var d = ensure();
      var n = Number(value);
      if (!isFinite(n) || n <= 0) return d.revenueTarget;
      d.revenueTarget = Math.round(n * 10) / 10;
      broadcast('revenueTarget');
      return d.revenueTarget;
    },
    setReceivable: function(obj){
      var d = ensure();
      d.receivable = Object.assign({}, d.receivable, obj);
      broadcast('receivable');
      return true;
    },
    setMetrics: function(list){
      var d = ensure();
      d.metrics = deepClone(list);
      broadcast('metrics');
      return true;
    },

    /* 认养口径：金额与收入构成中的「认养收入」同源同值（写入时双向同步） */
    setAdoption: function(obj){
      var d = ensure();
      obj = obj || {};
      var amount = Number(obj.amount);
      var ad = Object.assign({}, d.adoption);
      if (isFinite(amount) && amount >= 0) ad.amount = Math.round(amount * 10) / 10;
      if (isFinite(Number(obj.renewRate))) ad.renewRate = Math.round(Number(obj.renewRate) * 10) / 10;
      if (isFinite(Number(obj.renewed))) ad.renewed = Math.round(Number(obj.renewed));
      if (isFinite(Number(obj.avgPrice))) ad.avgPrice = Math.round(Number(obj.avgPrice));
      /* 订单数由金额与均价推导，保证「金额 = 订单数 × 均价」恒成立 */
      if (isFinite(Number(obj.orders))) ad.orders = Math.round(Number(obj.orders));
      else if (ad.amount > 0 && ad.avgPrice > 0) ad.orders = Math.round(ad.amount * 10000 / ad.avgPrice);
      d.adoption = ad;
      /* 金额回写收入构成中的「认养收入」，保证两处始终同值 */
      var mix = d.revenueMix.map(function(x){
        if (String(x.name || '').indexOf('认养') >= 0) {
          x.value = ad.amount;
          return x;
        }
        return x;
      });
      var mixTotal = mix.reduce(function(s, x){ return s + (Number(x.value) || 0); }, 0);
      d.revenueMix = mix.map(function(x){
        x.ratio = mixTotal ? Math.round((Number(x.value) || 0) / mixTotal * 1000) / 10 : 0;
        return x;
      });
      d.totalRevenue = Math.round(mixTotal * 10) / 10;
      broadcast('adoption');
      return deepClone(d.adoption);
    },

    /* 财务汇总：由利润报表地块聚合写入，统一年度营收 / 成本 / 净利与净利率 */
    setFinanceSummary: function(obj){
      var d = ensure();
      obj = obj || {};
      var rev = Number(obj.totalRevenue),
          cost = Number(obj.totalCost),
          profit = Number(obj.netProfit);
      if (isFinite(rev) && rev > 0) d.totalRevenue = Math.round(rev * 100) / 100;
      if (isFinite(cost) && cost >= 0) d.totalCost = Math.round(cost * 100) / 100;
      if (isFinite(profit)) d.netProfit = Math.round(profit * 100) / 100;
      d.grossProfit = d.netProfit;
      var netRate = d.totalRevenue ? Math.round(d.netProfit / d.totalRevenue * 1000) / 10 : 0;
      (d.metrics || []).forEach(function(m){
        var name = String(m.name || '');
        if (name === '毛利率' || name === '净利率') m.value = netRate;
      });
      broadcast('finance');
      return {
        totalRevenue: d.totalRevenue,
        totalCost: d.totalCost,
        netProfit: d.netProfit,
        netRate: netRate
      };
    },

    /* 基地利润：由利润报表按基地主数据聚合写入，合计与净利润保持一致 */
    setBaseProfit: function(list){
      var d = ensure();
      if (!Array.isArray(list) || !list.length) return deepClone(d.baseProfit);
      d.baseProfit = deepClone(list).map(function(x){
        return {
          base: String(x.base || '未命名基地'),
          profit: Math.round((Number(x.profit) || 0) * 100) / 100,
          revenue: Math.round((Number(x.revenue) || 0) * 100) / 100,
          cost: Math.round((Number(x.cost) || 0) * 100) / 100,
          rate: Math.round((Number(x.rate) || 0) * 10) / 10
        };
      });
      broadcast('baseProfit');
      return deepClone(d.baseProfit);
    },

    subscribe: function(fn){
      subscribers.push(fn);
      try { fn('init'); } catch(e){}
      return function unsubscribe(){
        subscribers = subscribers.filter(function(x){ return x !== fn; });
      };
    },
    reset: function(){
      inMemory = deepClone(DEFAULT_DATA);
      save();
      broadcast('reset');
    },
    _syncFromExternal: function(){
      var stored = load();
      if (stored) { inMemory = stored; notify('sync'); }
    }
  };

  window.addEventListener('storage', function(e){
    if (e.key === STORAGE_KEY) BizStore._syncFromExternal();
  });

  global.BizStore = BizStore;
})(window);