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
 *   BizStore.setRevenueMix / setReceivable / setMetrics → 维护
 *   BizStore.subscribe(fn) / reset()
 */

(function(global){
  'use strict';

  var STORAGE_KEY = 'applefarm_biz_v1';

  var DEFAULT_DATA = {
    fiscalYear: '2025 财年',

    // 收入构成（万元，合计须等于 totalRevenue）
    revenueMix: [
      { name:'鲜果销售', value:1221.8, ratio:46, channel:'商超 / 电商 / 批发' },
      { name:'认养收入', value:690.6,  ratio:26, channel:'企业 / 家庭果园' },
      { name:'农资服务', value:425.0,  ratio:16, channel:'统一配供 / 技术托管' },
      { name:'冷链代储', value:318.7,  ratio:12, channel:'预冷 / 分选 / 直发' }
    ],
    totalRevenue: 2656,
    revenueTarget: 2460,

    // 近 12 月营收趋势（万元）
    revenueTrend: [
      { month:'1月', value:186 }, { month:'2月', value:178 }, { month:'3月', value:224 },
      { month:'4月', value:238 }, { month:'5月', value:266 }, { month:'6月', value:294 },
      { month:'7月', value:326 }, { month:'8月', value:358 }, { month:'9月', value:402 },
      { month:'10月', value:448 }, { month:'11月', value:512 }, { month:'12月', value:486 }
    ],

    // 成本结构（五类科目，万元）
    costStructure: [
      { name:'农资投入', value:519.7, ratio:32 },
      { name:'人工用工', value:454.7, ratio:28 },
      { name:'物流配送', value:259.8, ratio:16 },
      { name:'包装耗材', value:194.9, ratio:12 },
      { name:'其他费用', value:194.9, ratio:12 }
    ],
    totalCost: 1624,

    // 各基地利润分解（万元）
    baseProfit: [
      { base:'麦积', profit:128.4, revenue:642, cost:513.6, rate:20.0 },
      { base:'秦州', profit:96.2,  revenue:521, cost:424.8, rate:18.5 },
      { base:'秦安', profit:78.5,  revenue:448, cost:369.5, rate:17.5 },
      { base:'甘谷', profit:61.7,  revenue:372, cost:310.3, rate:16.6 },
      { base:'武山', profit:43.6,  revenue:318, cost:274.4, rate:13.7 }
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
      { name:'毛利率',     value:42.0, unit:'%',  qoq: 1.2,  better:'up' },
      { name:'净利率',     value:18.5, unit:'%',  qoq: 0.6,  better:'up' },
      { name:'应收周转',   value:38,   unit:'天', qoq:-3,   better:'down' },
      { name:'库存周转',   value:12,   unit:'天', qoq:5,    better:'down' },
      { name:'坪效产值',   value:1.86, unit:'万元/亩', qoq:0.08, better:'up' },
      { name:'人均产值',   value:118,  unit:'万元/人', qoq:9,  better:'up' }
    ],

    // 销售渠道占比
    channelMix: [
      { name:'线上商城', value:32 },
      { name:'社区团购', value:24 },
      { name:'商超直供', value:18 },
      { name:'产地批发', value:18 },
      { name:'果树认养', value:8 }
    ],

    // 客户/渠道排行（按回款金额，万元）
    customerRank: [
      { rank:1,  name:'天水华联超市',        amount:86.4, type:'商超' },
      { rank:2,  name:'京东生鲜·西北仓',     amount:78.2, type:'电商' },
      { rank:3,  name:'兰州正大果业',        amount:64.8, type:'批发' },
      { rank:4,  name:'西安永辉超市',        amount:58.6, type:'商超' },
      { rank:5,  name:'美团团好货',          amount:52.4, type:'电商' },
      { rank:6,  name:'中信建投·企业认养',   amount:46.2, type:'认养' },
      { rank:7,  name:'天水邮政电商',        amount:40.9, type:'电商' },
      { rank:8,  name:'拼多多果园直营',      amount:36.5, type:'电商' },
      { rank:9,  name:'宝鸡果品批发市场',    amount:32.1, type:'批发' },
      { rank:10, name:'认养个人会员 TOP',    amount:24.0, type:'认养' }
    ],

    // 认养
    adoption: {
      orders: 3260,
      amount: 690.6,
      renewRate: 76.4,
      renewed: 2491,
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
    netProfit: 428,
    netProfitYoy: 7.5,
    grossProfit: 1032,
    repurchaseRate: 62,
    avgOrderValue: 328,
    totalOrders: 26520
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
      inMemory = stored;
    } else {
      inMemory = deepClone(DEFAULT_DATA);
      save();
    }
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
      d.revenueMix = deepClone(list);
      d.totalRevenue = Math.round(d.revenueMix.reduce(function(s, x){ return s + (x.value || 0); }, 0) * 10) / 10;
      broadcast('revenueMix');
      return d.totalRevenue;
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