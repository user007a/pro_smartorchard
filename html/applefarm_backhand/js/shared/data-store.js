/**
 * 数据运营共享数据源
 * --------------------------------------------------------------
 * 承载「数据运营」菜单下的数据源接入、数据归集、模型监控、成效记录，
 * 供后台页面维护，并通过 localStorage 供大屏端（da_results.html）读取。
 *
 * 存储 key： applefarm_data_ops_v1
 *
 * 暴露 API：
 *   DataStore.sources()            → 数据源接入配置列表
 *   DataStore.collections()        → 数据归集统计列表
 *   DataStore.models()             → 模型运行监控列表
 *   DataStore.achievements()       → 提质增效记录列表
 *   DataStore.milestones()         → 数字化里程碑列表
 *   DataStore.summary()            → 顶部汇总指标
 *   DataStore.collectionTrend()    → 近 12 月归集趋势
 *   DataStore.modelCalls()         → 近 14 天模型调用量
 *   DataStore.upsertSource(item)   → 新增/更新数据源
 *   DataStore.removeSource(id)     → 删除数据源
 *   DataStore.upsertModel(item)    → 新增/更新模型监控记录
 *   DataStore.subscribe(fn)        → 订阅变更，返回 unsubscribe
 *   DataStore.reset()              → 恢复默认数据
 */

(function(global){
  'use strict';

  var STORAGE_KEY = 'applefarm_data_ops_v1';

  /* ---------------- 默认数据 ---------------- */

  // 数据源接入配置
  var DEFAULT_SOURCES = [
    { id:'DS01', name:'农事记录数据源', type:'业务库', protocol:'REST API', endpoint:'/api/v1/farming/records', freq:'5分钟', status:'online', statusText:'运行中', updatedAt:'2026-10-21 09:30' },
    { id:'DS02', name:'设备实时数据源', type:'IoT 网关', protocol:'MQTT', endpoint:'mqtt://iot-gw:1883/sensor', freq:'实时', status:'online', statusText:'运行中', updatedAt:'2026-10-21 10:12' },
    { id:'DS03', name:'销售订单数据源', type:'业务库', protocol:'REST API', endpoint:'/api/v1/sales/orders', freq:'15分钟', status:'online', statusText:'运行中', updatedAt:'2026-10-21 10:05' },
    { id:'DS04', name:'溯源批次数据源', type:'区块链', protocol:'WebSocket', endpoint:'wss://chain-gw/blocks', freq:'实时', status:'warning', statusText:'延迟偏高', updatedAt:'2026-10-21 09:58' },
    { id:'DS05', name:'环境气象数据源', type:'IoT 网关', protocol:'MQTT', endpoint:'mqtt://iot-gw:1883/weather', freq:'10分钟', status:'online', statusText:'运行中', updatedAt:'2026-10-21 10:10' },
    { id:'DS06', name:'移动端回传数据源', type:'移动端', protocol:'HTTPS', endpoint:'/api/v1/mobile/upload', freq:'实时', status:'offline', statusText:'已离线', updatedAt:'2026-10-21 08:12' }
  ];

  // 数据归集统计
  var DEFAULT_COLLECTIONS = [
    { id:'DC01', source:'农事记录', amount:86420000, yoy:18.4, rate:99.5, category:'农事' },
    { id:'DC02', source:'设备数据', amount:124800000, yoy:32.6, rate:99.1, category:'设备' },
    { id:'DC03', source:'销售数据', amount:12360000, yoy:12.8, rate:98.7, category:'销售' },
    { id:'DC04', source:'溯源数据', amount:31580000, yoy:24.5, rate:99.6, category:'溯源' },
    { id:'DC05', source:'环境数据', amount:31240000, yoy:16.2, rate:98.9, category:'环境' }
  ];

  // 近 12 月归集趋势（万条）
  var DEFAULT_COLLECTION_TREND = [
    { month:'1月', value:1680 }, { month:'2月', value:1720 }, { month:'3月', value:1850 },
    { month:'4月', value:1910 }, { month:'5月', value:2020 }, { month:'6月', value:2110 },
    { month:'7月', value:2240 }, { month:'8月', value:2380 }, { month:'9月', value:2560 },
    { month:'10月', value:2680 }, { month:'11月', value:2760 }, { month:'12月', value:2820 }
  ];

  // 模型运行监控
  var DEFAULT_MODELS = [
    { id:'MD01', name:'产量预测模型', calls:326000, hitRate:92.4, response:184, version:'v3.2', status:'online', statusText:'在线' },
    { id:'MD02', name:'价格预测模型', calls:241000, hitRate:89.7, response:210, version:'v2.8', status:'online', statusText:'在线' },
    { id:'MD03', name:'物候预测模型', calls:183000, hitRate:94.1, response:156, version:'v2.1', status:'online', statusText:'在线' },
    { id:'MD04', name:'病虫害识别模型', calls:368000, hitRate:96.3, response:128, version:'v4.0', status:'online', statusText:'在线' },
    { id:'MD05', name:'气象预测模型', calls:166000, hitRate:91.2, response:96,  version:'v3.5', status:'online', statusText:'在线' }
  ];

  // 近 14 天模型调用量（万次）
  var DEFAULT_MODEL_CALLS = [
    { date:'10-08', value:7.8 }, { date:'10-09', value:8.2 }, { date:'10-10', value:8.9 },
    { date:'10-11', value:8.4 }, { date:'10-12', value:9.1 }, { date:'10-13', value:9.4 },
    { date:'10-14', value:8.8 }, { date:'10-15', value:9.2 }, { date:'10-16', value:9.6 },
    { date:'10-17', value:9.0 }, { date:'10-18', value:9.3 }, { date:'10-19', value:9.5 },
    { date:'10-20', value:9.1 }, { date:'10-21', value:9.2 }
  ];

  // 提质增效记录（实施前 → 实施后）
  var DEFAULT_ACHIEVEMENTS = [
    { id:'AC01', item:'节水', before:100, after:68,  unit:'%', delta:-32, desc:'滴灌精准灌溉替代漫灌' },
    { id:'AC02', item:'节肥', before:100, after:74,  unit:'%', delta:-26, desc:'测土配方 + 水肥一体化' },
    { id:'AC03', item:'减药', before:100, after:62,  unit:'%', delta:-38, desc:'绿色防控 + 生物农药' },
    { id:'AC04', item:'增产', before:100, after:115, unit:'%', delta:15,  desc:'树体改造 + 适时补肥' },
    { id:'AC05', item:'减损', before:100, after:79,  unit:'%', delta:-21, desc:'预冷分选 + 冷链直发' }
  ];

  // 数字化里程碑
  var DEFAULT_MILESTONES = [
    { id:'MS01', date:'2025-12', title:'通过数字农业建设项目验收', desc:'完成基础设施建设与设备部署', status:'done' },
    { id:'MS02', date:'2026-03', title:'果树认养数字化上线', desc:'认养全流程线上化管理', status:'done' },
    { id:'MS03', date:'2026-06', title:'AI 病虫害识别模型上线', desc:'图像识别准确率达 96.3%', status:'done' },
    { id:'MS04', date:'2026-08', title:'溯源上链突破 10 万批次', desc:'区块链存证稳定运行', status:'done' },
    { id:'MS05', date:'2026-10', title:'数据运营中心上线', desc:'八大驾驶舱数据全面打通', status:'done' }
  ];

  /* ---------------- 读写与广播 ---------------- */

  var subscribers = [];
  var inMemory = null;

  function deepClone(o){ return JSON.parse(JSON.stringify(o)); }

  function defaults(){
    return {
      sources: deepClone(DEFAULT_SOURCES),
      collections: deepClone(DEFAULT_COLLECTIONS),
      collectionTrend: deepClone(DEFAULT_COLLECTION_TREND),
      models: deepClone(DEFAULT_MODELS),
      modelCalls: deepClone(DEFAULT_MODEL_CALLS),
      achievements: deepClone(DEFAULT_ACHIEVEMENTS),
      milestones: deepClone(DEFAULT_MILESTONES)
    };
  }

  function load(){
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return null;
      return obj;
    } catch(e){ return null; }
  }

  function save(){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemory)); } catch(e){}
  }

  function ensure(){
    if (inMemory) return inMemory;
    var stored = load();
    var base = defaults();
    if (stored) {
      // 逐键合并，保证新增字段在旧数据上也能补齐默认值
      Object.keys(base).forEach(function(k){ if (stored[k] === undefined) stored[k] = base[k]; });
      inMemory = stored;
    } else {
      inMemory = base;
      save();
    }
    return inMemory;
  }

  function notify(reason){
    subscribers.forEach(function(fn){
      try { fn(reason); } catch(e){ console.warn('[DataStore] subscriber error', e); }
    });
  }

  function broadcast(reason){
    save();
    notify(reason);
    try {
      window.dispatchEvent(new CustomEvent('dataStoreChange', { detail:{ reason: reason } }));
    } catch(e){}
  }

  /* ---------------- 汇总计算 ---------------- */

  function summary(){
    var d = ensure();
    var totalAmount = d.collections.reduce(function(s, x){ return s + (x.amount || 0); }, 0);
    var avgRate = d.collections.length
      ? d.collections.reduce(function(s, x){ return s + (x.rate || 0); }, 0) / d.collections.length
      : 0;
    var totalCalls = d.models.reduce(function(s, x){ return s + (x.calls || 0); }, 0);
    var avgHit = d.models.length
      ? d.models.reduce(function(s, x){ return s + (x.hitRate || 0); }, 0) / d.models.length
      : 0;
    var avgResp = d.models.length
      ? d.models.reduce(function(s, x){ return s + (x.response || 0); }, 0) / d.models.length
      : 0;
    var onlineModels = d.models.filter(function(x){ return x.status === 'online'; }).length;
    var onlineSources = d.sources.filter(function(x){ return x.status === 'online'; }).length;
    return {
      totalAmount: totalAmount,
      totalAmountYi: Math.round(totalAmount / 100000000 * 100) / 100,
      avgRate: Math.round(avgRate * 10) / 10,
      totalCalls: totalCalls,
      totalCallsWan: Math.round(totalCalls / 10000 * 10) / 10,
      avgHit: Math.round(avgHit * 10) / 10,
      avgResp: Math.round(avgResp),
      onlineModels: onlineModels,
      modelTotal: d.models.length,
      onlineSources: onlineSources,
      sourceTotal: d.sources.length,
      plotCoverage: 126,
      uptimeDays: 386
    };
  }

  /* ---------------- 对外 API ---------------- */

  var DataStore = {
    STORAGE_KEY: STORAGE_KEY,

    sources: function(){ return deepClone(ensure().sources); },
    collections: function(){ return deepClone(ensure().collections); },
    collectionTrend: function(){ return deepClone(ensure().collectionTrend); },
    models: function(){ return deepClone(ensure().models); },
    modelCalls: function(){ return deepClone(ensure().modelCalls); },
    achievements: function(){ return deepClone(ensure().achievements); },
    milestones: function(){ return deepClone(ensure().milestones); },
    summary: function(){ return summary(); },

    upsertSource: function(item){
      var d = ensure();
      var idx = d.sources.findIndex(function(x){ return x.id === item.id; });
      if (idx >= 0) d.sources[idx] = Object.assign({}, d.sources[idx], item);
      else d.sources.push(item);
      broadcast('source:' + item.id);
      return true;
    },
    removeSource: function(id){
      var d = ensure();
      d.sources = d.sources.filter(function(x){ return x.id !== id; });
      broadcast('source-remove:' + id);
      return true;
    },
    upsertModel: function(item){
      var d = ensure();
      var idx = d.models.findIndex(function(x){ return x.id === item.id; });
      if (idx >= 0) d.models[idx] = Object.assign({}, d.models[idx], item);
      else d.models.push(item);
      broadcast('model:' + item.id);
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
      inMemory = defaults();
      save();
      broadcast('reset');
    },
    _syncFromExternal: function(){
      var stored = load();
      if (stored) { inMemory = stored; notify('sync'); }
    }
  };

  window.addEventListener('storage', function(e){
    if (e.key === STORAGE_KEY) DataStore._syncFromExternal();
  });

  global.DataStore = DataStore;
})(window);