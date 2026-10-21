/**
 * 溯源统计共享数据源
 * --------------------------------------------------------------
 * 承载「溯源管理 → 溯源统计」的扫码统计、地域分布、来源渠道、
 * 上链成功率、追溯码状态分布等指标，供后台维护并供大屏
 * （da_trace.html）读取。
 *
 * 存储 key： applefarm_trace_stats_v1
 *
 * 暴露 API：
 *   TraceStatStore.overview()        → 顶部汇总指标
 *   TraceStatStore.scanTrend()       → 近 7 日扫码趋势
 *   TraceStatStore.provinces()       → 省份扫码分布
 *   TraceStatStore.channels()        → 扫码来源渠道占比
 *   TraceStatStore.codeStatus()      → 追溯码状态分布
 *   TraceStatStore.chainBlocks()     → 区块链存证区块
 *   TraceStatStore.certificates()    → 认证证书批次统计
 *   TraceStatStore.flow()            → 批次流向五级数据
 *   TraceStatStore.recordScan(n)     → 累加扫码量
 *   TraceStatStore.subscribe(fn)     → 订阅变更
 *   TraceStatStore.reset()           → 恢复默认数据
 */

(function(global){
  'use strict';

  var STORAGE_KEY = 'applefarm_trace_stats_v1';

  var DEFAULT_DATA = {
    // 累计上链批次 / 激活码 / 发码总量
    totalBatches: 108420,
    totalIssued: 155300,

    // 近 7 日扫码趋势（累计量）
    scanTrend: [
      { date:'10-15', value:10120 }, { date:'10-16', value:10480 }, { date:'10-17', value:11020 },
      { date:'10-18', value:10860 }, { date:'10-19', value:11520 }, { date:'10-20', value:11640 },
      { date:'10-21', value:12860 }
    ],

    // 省份扫码分布（近 30 日累计）
    provinces: [
      { name:'广东', value:1680 }, { name:'浙江', value:1420 }, { name:'江苏', value:1180 },
      { name:'北京', value:980 },  { name:'上海', value:940 },  { name:'山东', value:860 },
      { name:'河南', value:820 },  { name:'四川', value:760 },  { name:'湖北', value:680 },
      { name:'福建', value:620 },  { name:'新疆', value:560 },  { name:'陕西', value:520 }
    ],
    provinceTotal: 31,

    // 扫码来源渠道
    channels: [
      { name:'微信扫码', value:7970, ratio:62 },
      { name:'支付宝',   value:2315, ratio:18 },
      { name:'果园 App', value:1672, ratio:13 },
      { name:'网页查询', value:900,  ratio:7 }
    ],

    // 追溯码状态（累加总数需等于 totalIssued）
    codeStatus: [
      { name:'已激活', value:96300, ratio:62 },
      { name:'未激活', value:32600, ratio:21 },
      { name:'已过期', value:17100, ratio:11 },
      { name:'已作废', value:9300,  ratio:6 }
    ],

    // 区块链存证区块
    chainBlocks: [
      { height:108420, hash:'0x3f8a', time:'2026-10-21 10:12' },
      { height:108410, hash:'0x9d2c', time:'2026-10-21 09:48' },
      { height:108400, hash:'0x71be', time:'2026-10-21 09:24' },
      { height:108392, hash:'0x2adf', time:'2026-10-21 09:02' },
      { height:108381, hash:'0xc40e', time:'2026-10-21 08:40' }
    ],
    chainNodes: 6,
    chainConsensus: 'Raft',
    chainSuccessRate: 99.96,

    // 认证证书覆盖批次
    certificates: [
      { name:'有机认证', code:'CN-ORG-2024-0913', batches:18240, valid:'有效' },
      { name:'绿色食品', code:'GF-3201-2023-118', batches:32600, valid:'有效' },
      { name:'HACCP 危害分析', code:'CN-HACCP-2022-0457', batches:41800, valid:'有效' },
      { name:'地理标志产品', code:'GI-MJAP-2021-0022', batches:26400, valid:'有效' },
      { name:'ISO9001 质量管理', code:'CN-ISO-2020-3310', batches:52900, valid:'有效' },
      { name:'GAP 良好农业规范', code:'CN-GAP-2023-0761', batches:22150, valid:'有效' }
    ],

    // 批次流向：基地 → 采收 → 包装 → 渠道 → 消费者
    flow: {
      base:     [ {name:'麦积', value:46200}, {name:'秦州', value:35800}, {name:'甘谷', value:26420} ],
      harvest:  [ {name:'一级果', value:70000}, {name:'二级果', value:34420}, {name:'加工果', value:4000} ],
      package:  [ {name:'礼盒装', value:32000}, {name:'电商箱装', value:52000}, {name:'散装', value:24420} ],
      channel:  [ {name:'商超连锁', value:38600}, {name:'电商平台', value:41200}, {name:'产地直发', value:16800}, {name:'批发市场', value:11820} ],
      consumer: [ {name:'家庭用户', value:74200}, {name:'礼品馈赠', value:34220} ],
      thisWeek: 2860,
      channelCount: 12,
      avgDuration: 4.2
    },

    // 质量指标
    passRate: 99.6,
    avgResponse: 0.8,
    traceCoverage: 89.2,
    satisfaction: 4.9
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
      try { fn(reason); } catch(e){ console.warn('[TraceStatStore] subscriber error', e); }
    });
  }

  function broadcast(reason){
    save();
    notify(reason);
    try {
      window.dispatchEvent(new CustomEvent('traceStatStoreChange', { detail:{ reason: reason } }));
    } catch(e){}
  }

  /* ---------------- 对外 API ---------------- */

  var TraceStatStore = {
    STORAGE_KEY: STORAGE_KEY,

    overview: function(){
      var d = ensure();
      var activated = (d.codeStatus.find(function(x){ return x.name === '已激活'; }) || {}).value || 0;
      var today = d.scanTrend.length ? d.scanTrend[d.scanTrend.length - 1].value : 0;
      var yesterday = d.scanTrend.length > 1 ? d.scanTrend[d.scanTrend.length - 2].value : 0;
      var dod = yesterday ? Math.round((today - yesterday) / yesterday * 1000) / 10 : 0;
      return {
        totalBatches: d.totalBatches,
        totalIssued: d.totalIssued,
        activated: activated,
        activateRate: d.totalIssued ? Math.round(activated / d.totalIssued * 1000) / 10 : 0,
        todayScan: today,
        dod: dod,
        provinceTotal: d.provinceTotal,
        passRate: d.passRate,
        avgResponse: d.avgResponse,
        traceCoverage: d.traceCoverage,
        satisfaction: d.satisfaction,
        chainSuccessRate: d.chainSuccessRate,
        chainNodes: d.chainNodes,
        chainHeight: d.chainBlocks.length ? d.chainBlocks[0].height : 0
      };
    },
    scanTrend:    function(){ return deepClone(ensure().scanTrend); },
    provinces:    function(){ return deepClone(ensure().provinces); },
    channels:     function(){ return deepClone(ensure().channels); },
    codeStatus:   function(){ return deepClone(ensure().codeStatus); },
    chainBlocks:  function(){ return deepClone(ensure().chainBlocks); },
    certificates: function(){ return deepClone(ensure().certificates); },
    flow:         function(){ return deepClone(ensure().flow); },

    /** 累加扫码量：同步今日值与趋势末点 */
    recordScan: function(n){
      var d = ensure();
      n = Number(n) || 0;
      if (n <= 0) return 0;
      if (d.scanTrend.length) {
        d.scanTrend[d.scanTrend.length - 1].value += n;
      }
      broadcast('scan');
      return d.scanTrend.length ? d.scanTrend[d.scanTrend.length - 1].value : n;
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
    if (e.key === STORAGE_KEY) TraceStatStore._syncFromExternal();
  });

  global.TraceStatStore = TraceStatStore;
})(window);