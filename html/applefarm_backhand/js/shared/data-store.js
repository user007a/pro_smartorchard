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
 *   DataStore.highlights()         → 成果亮点列表（底部绝对量口径）
 *   DataStore.coverage()           → 覆盖地块规划口径 + 台账实际数
 *   DataStore.ops()                → 系统运维信息（上线/最近故障/手动天数）
 *   DataStore.lastUpdatedAt()      → 最近一次数据变更时间
 *   DataStore.heartbeat(id)        → 记录数据源心跳时间
 *   DataStore.recalcCollections()  → 按本地原始记录重算归集量
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

  // 成果亮点（驾驶舱底部绝对量口径，可后台维护）
  var DEFAULT_HIGHLIGHTS = [
    { id:'HL01', item:'全年节水', value:8600, unit:'吨', desc:'滴灌与水肥一体化替代传统漫灌' },
    { id:'HL02', item:'全年节肥', value:42,   unit:'吨', desc:'测土配方施肥，按需供给' },
    { id:'HL03', item:'全年减药', value:1.8,  unit:'吨', desc:'绿色防控与生物农药替代' },
    { id:'HL04', item:'优质果率', value:86,   unit:'%',  desc:'分级分选后一级果占比' }
  ];

  // 数字化覆盖地块：planned 为规划口径（可维护），ledgerFallback 为台账未落库时的兜底值
  var DEFAULT_COVERAGE = { planned: 126, ledgerFallback: 23 };

  // 系统运行信息：按上线/最近故障日期计算稳定运行天数，manualUptimeDays 可人工覆盖
  var DEFAULT_OPS = { onlineSince: '2025-10-20', lastDowntime: '', manualUptimeDays: null };

  /* ---------------- 读写与广播 ---------------- */

  var subscribers = [];
  var inMemory = null;

  function deepClone(o){ return JSON.parse(JSON.stringify(o)); }

  // 归集记录 / 里程碑自增编号（DC01、MS01 …）
  function nextId(list, prefix){
    var max = 0;
    list.forEach(function(x){
      var m = String(x.id || '').match(new RegExp('^' + prefix + '(\\d+)$'));
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    var n = max + 1;
    return prefix + (n < 10 ? '0' + n : String(n));
  }

  function defaults(){
    return {
      sources: deepClone(DEFAULT_SOURCES),
      collections: deepClone(DEFAULT_COLLECTIONS),
      collectionTrend: deepClone(DEFAULT_COLLECTION_TREND),
      models: deepClone(DEFAULT_MODELS),
      modelCalls: deepClone(DEFAULT_MODEL_CALLS),
      achievements: deepClone(DEFAULT_ACHIEVEMENTS),
      milestones: deepClone(DEFAULT_MILESTONES),
      highlights: deepClone(DEFAULT_HIGHLIGHTS),
      coverage: deepClone(DEFAULT_COVERAGE),
      ops: deepClone(DEFAULT_OPS),
      updatedAt: new Date().toISOString()
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
      stored.coverage = Object.assign({}, base.coverage, stored.coverage || {});
      stored.ops = Object.assign({}, base.ops, stored.ops || {});
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
    if (inMemory) inMemory.updatedAt = new Date().toISOString();
    save();
    notify(reason);
    try {
      window.dispatchEvent(new CustomEvent('dataStoreChange', { detail:{ reason: reason } }));
    } catch(e){}
  }

  /* ---------------- 口径与派生计算 ---------------- */

  function readJson(key, fallback){
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch(e){ return fallback; }
  }

  /** 地块台账实际条数：优先取地块管理落库数据，未落库时使用兜底值 */
  function plotLedgerCount(fallback){
    var arr = readJson('smartorchard_plot_master', null);
    if (Array.isArray(arr) && arr.length){
      var valid = arr.filter(function(x){ return x && x.code; }).length;
      return valid || arr.length;
    }
    return Number(fallback) || 0;
  }

  /** 稳定运行天数：人工值优先，其次按最近故障/上线日期计算；无有效日期返回 null */
  function uptimeDaysOf(ops){
    ops = ops || {};
    if (ops.manualUptimeDays !== null && ops.manualUptimeDays !== undefined && ops.manualUptimeDays !== ''){
      var m = Number(ops.manualUptimeDays);
      if (isFinite(m)) return Math.max(0, Math.round(m));
    }
    var base = ops.lastDowntime || ops.onlineSince || '';
    if (!base) return null;
    var t = new Date(String(base).replace(/-/g, '/')).getTime();
    if (!isFinite(t)) return null;
    return Math.max(0, Math.floor((Date.now() - t) / 86400000));
  }

  /** 按本地原始记录计数，用于「按原始记录重算」预览 */
  function rawCollectionCount(category){
    function countList(key){
      var v = readJson(key, null);
      if (Array.isArray(v)) return v.length;
      if (v && typeof v === 'object') return Object.keys(v).length;
      return 0;
    }
    if (category === '农事') return countList('smartorchard_farming_records');
    if (category === '设备'){
      var d = readJson('applefarm_device_v1', null);
      return d && Array.isArray(d.logs) ? d.logs.length : 0;
    }
    if (category === '销售') return countList('h5_orders') + countList('h5_sales_orders');
    if (category === '溯源'){
      var t = readJson('smartorchard_trace_v1', null);
      if (!t || typeof t !== 'object') return 0;
      return ['batches', 'codes', 'scanLogs'].reduce(function(s, k){
        var v = t[k];
        if (Array.isArray(v)) return s + v.length;
        if (v && typeof v === 'object') return s + Object.keys(v).length;
        return s;
      }, 0);
    }
    return 0; // 环境数据暂无本地原始记录可计数
  }

  /* ---------------- 汇总计算 ---------------- */

  function summary(){
    var d = ensure();
    var totalAmount = d.collections.reduce(function(s, x){ return s + (x.amount || 0); }, 0);
    // 合格率按归集量加权，避免小样本来源拉平整体质量
    var weightedRate = totalAmount > 0
      ? d.collections.reduce(function(s, x){ return s + (x.amount || 0) * (x.rate || 0); }, 0) / totalAmount
      : (d.collections.length
        ? d.collections.reduce(function(s, x){ return s + (x.rate || 0); }, 0) / d.collections.length
        : 0);
    var totalCalls = d.models.reduce(function(s, x){ return s + (x.calls || 0); }, 0);
    var avgHit = d.models.length
      ? d.models.reduce(function(s, x){ return s + (x.hitRate || 0); }, 0) / d.models.length
      : 0;
    var avgResp = d.models.length
      ? d.models.reduce(function(s, x){ return s + (x.response || 0); }, 0) / d.models.length
      : 0;
    var onlineModels = d.models.filter(function(x){ return x.status === 'online'; }).length;
    var onlineSources = d.sources.filter(function(x){ return x.status === 'online'; }).length;
    var warningSources = d.sources.filter(function(x){ return x.status === 'warning'; }).length;
    var offlineSources = d.sources.filter(function(x){ return x.status === 'offline'; }).length;
    var coverage = d.coverage || DEFAULT_COVERAGE;
    return {
      totalAmount: totalAmount,
      totalAmountYi: Math.round(totalAmount / 100000000 * 100) / 100,
      avgRate: Math.round(weightedRate * 10) / 10,
      totalCalls: totalCalls,
      totalCallsWan: Math.round(totalCalls / 10000 * 10) / 10,
      avgHit: Math.round(avgHit * 10) / 10,
      avgResp: Math.round(avgResp),
      onlineModels: onlineModels,
      modelTotal: d.models.length,
      onlineSources: onlineSources,
      warningSources: warningSources,
      offlineSources: offlineSources,
      sourceTotal: d.sources.length,
      plotCoverage: Number(coverage.planned) || 0,
      plotLedger: plotLedgerCount(coverage.ledgerFallback),
      uptimeDays: uptimeDaysOf(d.ops)
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

    /* ---- 数据归集维护（归集明细 → 驾驶舱累计归集量/合格率/占比） ---- */
    upsertCollection: function(item){
      var d = ensure();
      item = item || {};
      var source = String(item.source || '').trim();
      var amount = Number(item.amount);
      var yoy = Number(item.yoy);
      var rate = Number(item.rate);
      if (!source) return { ok:false, message:'请填写数据来源' };
      if (!isFinite(amount) || amount < 0) return { ok:false, message:'归集量需为不小于 0 的数字' };
      if (!isFinite(rate) || rate < 0 || rate > 100) return { ok:false, message:'合格率需在 0 ~ 100 之间' };
      if (!isFinite(yoy)) yoy = 0;
      var dup = d.collections.filter(function(x){ return x.source === source && x.id !== item.id; })[0];
      if (dup) return { ok:false, message:'数据来源「' + source + '」已存在' };

      var idx = d.collections.findIndex(function(x){ return x.id === item.id; });
      var payload = {
        id: item.id || nextId(d.collections, 'DC'),
        source: source,
        amount: Math.round(amount),
        yoy: Math.round(yoy * 10) / 10,
        rate: Math.round(rate * 10) / 10,
        category: String(item.category || '其他').trim() || '其他'
      };
      if (idx >= 0) d.collections[idx] = Object.assign({}, d.collections[idx], payload);
      else d.collections.push(payload);
      broadcast('collection:' + payload.id);
      return { ok:true, item: payload };
    },
    removeCollection: function(id){
      var d = ensure();
      d.collections = d.collections.filter(function(x){ return x.id !== id; });
      broadcast('collection-remove:' + id);
      return true;
    },

    /* ---- 提质增效维护（成效项 → 驾驶舱提质增效对比） ---- */
    updateAchievement: function(id, patch){
      var d = ensure();
      var item = d.achievements.filter(function(x){ return x.id === id; })[0];
      if (!item) return { ok:false, message:'成效项不存在' };
      patch = patch || {};
      var before = patch.before === undefined ? Number(item.before) : Number(patch.before);
      var after = patch.after === undefined ? Number(item.after) : Number(patch.after);
      if (!isFinite(before) || before <= 0) return { ok:false, message:'实施前基准需大于 0' };
      if (!isFinite(after) || after < 0) return { ok:false, message:'实施后数值需为不小于 0 的数字' };
      item.before = Math.round(before * 10) / 10;
      item.after = Math.round(after * 10) / 10;
      // 变化幅度统一由实施前后推导，避免与大屏口径不一致
      item.delta = Math.round((item.after - item.before) * 10) / 10;
      if (patch.desc !== undefined) item.desc = String(patch.desc || '').trim();
      broadcast('achievement:' + id);
      return { ok:true, item: item };
    },

    /* ---- 数字化里程碑维护（里程碑 → 驾驶舱成果时间轴） ---- */
    upsertMilestone: function(item){
      var d = ensure();
      item = item || {};
      var date = String(item.date || '').trim();
      var title = String(item.title || '').trim();
      if (!/^\d{4}-\d{2}(-\d{2})?$/.test(date)) return { ok:false, message:'日期格式应为 YYYY-MM 或 YYYY-MM-DD' };
      if (!title) return { ok:false, message:'请填写里程碑标题' };

      var idx = d.milestones.findIndex(function(x){ return x.id === item.id; });
      var payload = {
        id: item.id || nextId(d.milestones, 'MS'),
        date: date,
        title: title,
        desc: String(item.desc || '').trim(),
        status: item.status || 'done'
      };
      if (idx >= 0) d.milestones[idx] = Object.assign({}, d.milestones[idx], payload);
      else d.milestones.push(payload);
      // 统一按时间升序存储，驾驶舱时间轴与后台页签口径一致
      d.milestones.sort(function(a, b){ return String(a.date).localeCompare(String(b.date)); });
      broadcast('milestone:' + payload.id);
      return { ok:true, item: payload };
    },
    removeMilestone: function(id){
      var d = ensure();
      d.milestones = d.milestones.filter(function(x){ return x.id !== id; });
      broadcast('milestone-remove:' + id);
      return true;
    },

    /* ---- 成果亮点维护（绝对量口径，替代大屏硬编码） ---- */
    highlights: function(){ return deepClone(ensure().highlights); },
    upsertHighlight: function(item){
      var d = ensure();
      item = item || {};
      var name = String(item.item || '').trim();
      var value = Number(item.value);
      if (!name) return { ok:false, message:'请填写亮点名称' };
      if (!isFinite(value) || value < 0) return { ok:false, message:'亮点数值需为不小于 0 的数字' };
      var idx = d.highlights.findIndex(function(x){ return x.id === item.id; });
      var payload = {
        id: item.id || nextId(d.highlights, 'HL'),
        item: name,
        value: Math.round(value * 100) / 100,
        unit: String(item.unit || '').trim(),
        desc: String(item.desc || '').trim()
      };
      if (idx >= 0) d.highlights[idx] = Object.assign({}, d.highlights[idx], payload);
      else d.highlights.push(payload);
      broadcast('highlight:' + payload.id);
      return { ok:true, item: payload };
    },
    removeHighlight: function(id){
      var d = ensure();
      d.highlights = d.highlights.filter(function(x){ return x.id !== id; });
      broadcast('highlight-remove:' + id);
      return true;
    },

    /* ---- 数字化覆盖地块口径（规划口径可维护，台账口径自动统计） ---- */
    coverage: function(){
      var d = ensure();
      return { planned: Number(d.coverage.planned) || 0, ledger: plotLedgerCount(d.coverage.ledgerFallback) };
    },
    setCoverage: function(patch){
      var d = ensure();
      patch = patch || {};
      var planned = patch.planned === undefined ? d.coverage.planned : Number(patch.planned);
      var fallback = patch.ledgerFallback === undefined ? d.coverage.ledgerFallback : Number(patch.ledgerFallback);
      if (!isFinite(planned) || planned < 0) return { ok:false, message:'规划地块数需为不小于 0 的数字' };
      if (!isFinite(fallback) || fallback < 0) return { ok:false, message:'台账兜底数需为不小于 0 的数字' };
      d.coverage.planned = Math.round(planned);
      d.coverage.ledgerFallback = Math.round(fallback);
      broadcast('coverage');
      return { ok:true, coverage: DataStore.coverage() };
    },

    /* ---- 系统运维信息（稳定运行天数口径） ---- */
    ops: function(){ return deepClone(ensure().ops); },
    setOps: function(patch){
      var d = ensure();
      patch = patch || {};
      var dateRe = /^\d{4}-\d{2}-\d{2}$/;
      if (patch.onlineSince !== undefined){
        var since = String(patch.onlineSince || '').trim();
        if (since && !dateRe.test(since)) return { ok:false, message:'上线日期格式应为 YYYY-MM-DD' };
        d.ops.onlineSince = since;
      }
      if (patch.lastDowntime !== undefined){
        var down = String(patch.lastDowntime || '').trim();
        if (down && !dateRe.test(down)) return { ok:false, message:'最近故障日期格式应为 YYYY-MM-DD' };
        d.ops.lastDowntime = down;
      }
      if (patch.manualUptimeDays !== undefined){
        var manual = patch.manualUptimeDays;
        if (manual === null || manual === '') d.ops.manualUptimeDays = null;
        else {
          var n = Number(manual);
          if (!isFinite(n) || n < 0) return { ok:false, message:'手动天数需为不小于 0 的数字' };
          d.ops.manualUptimeDays = Math.round(n);
        }
      }
      broadcast('ops');
      return { ok:true, ops: DataStore.ops(), uptimeDays: uptimeDaysOf(d.ops) };
    },

    /* ---- 趋势与调用量维护（后台可编辑，驾驶舱只读） ---- */
    upsertCollectionTrend: function(list){
      var d = ensure();
      if (!Array.isArray(list) || list.length !== 12) return { ok:false, message:'归集趋势需为 12 个月数据' };
      for (var i = 0; i < list.length; i++){
        var v = Number(list[i] && list[i].value);
        if (!isFinite(v) || v < 0) return { ok:false, message:'第 ' + (i + 1) + ' 个月数值无效' };
      }
      var next = list.map(function(x, idx){
        return { month: String((x && x.month) || (idx + 1) + '月'), value: Math.round(Number(x && x.value) * 10) / 10 };
      });
      d.collectionTrend = next;
      broadcast('collectionTrend');
      return { ok:true, list: deepClone(next) };
    },
    upsertModelCalls: function(list){
      var d = ensure();
      if (!Array.isArray(list) || list.length !== 14) return { ok:false, message:'模型调用量需为 14 天数据' };
      for (var i = 0; i < list.length; i++){
        var v = Number(list[i] && list[i].value);
        if (!isFinite(v) || v < 0) return { ok:false, message:'第 ' + (i + 1) + ' 天数值无效' };
      }
      var next = list.map(function(x, idx){
        return { date: String((x && x.date) || ''), value: Math.round(Number(x && x.value) * 10) / 10 };
      });
      d.modelCalls = next;
      broadcast('modelCalls');
      return { ok:true, list: deepClone(next) };
    },

    /* ---- 数据源心跳（后台手动记录采集任务存活时间） ---- */
    heartbeat: function(id){
      var d = ensure();
      var item = d.sources.filter(function(x){ return x.id === id; })[0];
      if (!item) return { ok:false, message:'数据源不存在' };
      var now = new Date();
      function pad(n){ return n < 10 ? '0' + n : String(n); }
      item.lastHeartbeatAt = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
        ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
      broadcast('source-heartbeat:' + id);
      return { ok:true, lastHeartbeatAt: item.lastHeartbeatAt };
    },

    /* ---- 按本地原始记录重算归集量（预览 / 可显式应用） ---- */
    recalcCollections: function(apply){
      var d = ensure();
      var items = d.collections.map(function(x){
        var count = rawCollectionCount(x.category);
        return {
          id: x.id,
          source: x.source,
          category: x.category,
          current: x.amount,
          count: count,
          next: count > 0 ? count : x.amount,
          skipped: count <= 0
        };
      });
      if (apply){
        var changed = false;
        items.forEach(function(it){
          if (it.skipped) return;
          var row = d.collections.filter(function(x){ return x.id === it.id; })[0];
          if (row && row.amount !== it.next){ row.amount = it.next; changed = true; }
        });
        if (changed) broadcast('collection-recalc');
      }
      return { ok:true, applied: !!apply, items: items };
    },

    lastUpdatedAt: function(){ return ensure().updatedAt || ''; },

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