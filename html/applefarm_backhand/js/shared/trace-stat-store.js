/**
 * 溯源统计共享数据源
 * --------------------------------------------------------------
 * 承载「溯源管理 → 溯源统计」的扫码统计、地域分布、来源渠道、
 * 上链成功率、追溯码状态分布等指标，供后台维护并供大屏
 * （da_trace.html）读取。
 *
 * 【严格空库模式】演示兜底（demo）已彻底删除：
 *   仅保留 auto 一条路径，即从 TraceStore / CertStore / HarvestStore
 *   实时聚合真实业务数据；无任何内置演示种子，无数据即返回零值结构。
 *   setMode 只接受 auto，sourceInfo 恒为 auto / real|empty。
 *
 * 历史存储 key： applefarm_trace_stats_v1（严格空库模式下不再写入）
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
 *   TraceStatStore.recordScan(meta)  → 委托 TraceStore 记录扫码
 *   TraceStatStore.setMode(mode)     → 恒为 auto（保留签名）
 *   TraceStatStore.sourceInfo()      → 当前数据源信息
 *   TraceStatStore.refresh()         → 强制重算并通知
 *   TraceStatStore.subscribe(fn)     → 订阅变更
 *   TraceStatStore.reset()           → 清空缓存并重新聚合
 */

(function(global){
  'use strict';

  var STORAGE_KEY = 'applefarm_trace_stats_v1';  // 历史存储键：严格空库模式下不再写入，仅保留常量兼容旧引用
  var TRACE_KEY = 'smartorchard_trace_v1';
  var CERT_KEY = 'smartorchard_cert_v1';
  var HARVEST_KEY = 'smartorchard_harvest_v1';

  // 严格空库模式：仅保留数据结构的零值模板，不再包含任何演示数值
  var DEFAULT_DATA = {
    totalBatches: 0,
    totalIssued: 0,
    scanTrend: [],
    provinces: [],
    provinceTotal: 0,
    channels: [],
    codeStatus: [],
    chainBlocks: [],
    chainNodes: 0,
    chainConsensus: '',
    chainSuccessRate: 0,
    certificates: [],
    flow: {
      base: [], harvest: [], package: [], channel: [], consumer: [],
      thisWeek: 0, channelCount: 0, avgDuration: null
    },
    passRate: null,
    avgResponse: null,
    traceCoverage: null,
    satisfaction: null
  };

  /* ---------------- 通用工具 ---------------- */

  var subscribers = [];
  var cached = null;
  var bound = false;
  var lastSource = '';
  var lastAt = '';

  function deepClone(o){ return JSON.parse(JSON.stringify(o)); }
  function num(v){ var n = Number(v); return isNaN(n) ? 0 : n; }
  function round1(v){ return Math.round(v * 10) / 10; }
  function round2(v){ return Math.round(v * 100) / 100; }
  function datePart(s){ return String(s || '').slice(0, 10); }
  function ymd(d){
    var p = function(n){ return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function todayStr(){ return ymd(new Date()); }
  function nowStamp(){
    var d = new Date(), p = function(n){ return ('0' + n).slice(-2); };
    return ymd(d) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function parseDate(s){
    var m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }
  /** 取数值型字段均值，无有效值时返回 null（供大屏显示「—」） */
  function avgOf(list, key){
    var sum = 0, n = 0;
    (list || []).forEach(function(x){
      var v = Number(x && x[key]);
      if (!isNaN(v) && v > 0) { sum += v; n++; }
    });
    return n ? round1(sum / n) : null;
  }

  /* ---------------- 真实数据聚合 ---------------- */

  var PROV_RE = /^(北京市|上海市|天津市|重庆市|内蒙古自治区|广西壮族自治区|西藏自治区|宁夏回族自治区|新疆维吾尔自治区|香港特别行政区|澳门特别行政区|[^省]{2,8}省)/;

  /** 地域字符串归一为省级简称，如「甘肃省天水市」→「甘肃」 */
  function provinceOf(region){
    var s = String(region || '');
    var m = s.match(PROV_RE);
    if (!m) return '';
    return m[1].replace(/省|市|自治区|特别行政区|壮族|回族|维吾尔/g, '') || m[1];
  }

  /** 累计上链批次：事件链中建批事件去重 */
  function countOnChainBatches(events, batches){
    var map = {};
    (events || []).forEach(function(e){
      if (e && e.type === 'batch' && e.batchNo) map[e.batchNo] = 1;
    });
    var n = Object.keys(map).length;
    return n || (batches || []).length;
  }

  /** 近 N 日扫码趋势：以今天为终点，缺失日补 0 */
  function buildScanTrend(scans, days){
    var buckets = {};
    (scans || []).forEach(function(s){
      var key = datePart(s && s.at);
      if (key) buckets[key] = (buckets[key] || 0) + 1;
    });
    var out = [], now = new Date();
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      var k = ymd(d);
      out.push({ date: k.slice(5), value: buckets[k] || 0 });
    }
    return out;
  }

  /** 省份扫码分布：按省聚合，取前 12 */
  function buildProvinces(scans){
    var map = {}, order = [];
    (scans || []).forEach(function(s){
      var p = provinceOf(s && s.region);
      if (!p) return;
      if (map[p] === undefined) { map[p] = 0; order.push(p); }
      map[p] += 1;
    });
    return order.map(function(name){ return { name: name, value: map[name] }; })
      .sort(function(a, b){ return b.value - a.value; })
      .slice(0, 12);
  }

  /** 来源渠道：source 归一为四类 */
  function buildChannels(scans){
    var defs = [
      { key:'wechat', name:'微信扫码' },
      { key:'alipay', name:'支付宝' },
      { key:'app',    name:'果园 App' },
      { key:'web',    name:'网页查询' }
    ];
    if (!scans || !scans.length) return [];
    var cnt = { wechat:0, alipay:0, app:0, web:0 };
    scans.forEach(function(s){
      var src = String((s && s.source) || '').toLowerCase();
      if (src === 'alipay') src = 'alipay';
      else if (src === 'app') src = 'app';
      else if (src === 'web' || src === 'pc') src = 'web';
      else src = 'wechat';   /* 历史值 H5 视为微信扫码 */
      cnt[src] += 1;
    });
    var total = scans.length;
    return defs.map(function(d){
      return { name: d.name, value: cnt[d.key], ratio: Math.round(cnt[d.key] * 100 / total) };
    });
  }

  /** 追溯码状态：激活 / 未激活 / 过期 / 作废（生效召回批次下的码） */
  function buildCodeStatus(codes, recalls){
    if (!codes || !codes.length) return [];
    var recalled = {};
    (recalls || []).forEach(function(r){
      if (r && r.status === 'active' && r.batchNo) recalled[r.batchNo] = 1;
    });
    var c = { active:0, inactive:0, expired:0, voided:0 };
    codes.forEach(function(x){
      if (!x) return;
      if (recalled[x.batch]) c.voided += 1;
      else if (x.status === 'active') c.active += 1;
      else if (x.status === 'expired') c.expired += 1;
      else c.inactive += 1;
    });
    var total = codes.length;
    return [
      { name:'已激活', value:c.active,   ratio: Math.round(c.active * 100 / total) },
      { name:'未激活', value:c.inactive, ratio: Math.round(c.inactive * 100 / total) },
      { name:'已过期', value:c.expired,  ratio: Math.round(c.expired * 100 / total) },
      { name:'已作废', value:c.voided,   ratio: Math.round(c.voided * 100 / total) }
    ];
  }

  /** 最近 N 个存证区块（倒序）；时间非法时仅保留日期，避免出现 10:70 这类脏值 */
  function normTime(s){
    var str = String(s || '');
    var m = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{1,2})/);
    if (!m) return str.slice(0, 16);
    var h = +m[4], mi = +m[5];
    if (h > 23 || mi > 59) return m[1] + '-' + m[2] + '-' + m[3];
    var p = function(n){ return ('0' + n).slice(-2); };
    return m[1] + '-' + m[2] + '-' + m[3] + ' ' + p(h) + ':' + p(mi);
  }

  function buildChainBlocks(events, limit){
    if (!events || !events.length) return [];
    return events.slice(-limit).reverse().map(function(e){
      return {
        height: num(e.blockHeight),
        hash: '0x' + String(e.hash || '').slice(0, 4),
        time: normTime(e.chainTime)
      };
    });
  }

  var CERT_ORDER = { normal:0, warning:1, urgent:1, expired:2, revoked:3, pending:4, draft:5 };

  /** 认证证书：真实资质 + 批次关联计数（无关联字段时为 0） */
  function buildCertificates(batches){
    var S = global.CertStore;
    if (!S || typeof S.qualifications !== 'function') return [];
    var list = S.qualifications() || [];
    if (!list.length) return [];
    var out = list.map(function(c){
      var sv = (typeof S.computeStatus === 'function')
        ? S.computeStatus(c)
        : { text:'有效', level:'normal' };
      var n = 0;
      (batches || []).forEach(function(b){
        if (((b && b.certCodes) || []).indexOf(c.certNo) >= 0) n += 1;
      });
      return {
        name: c.type || c.name || '—',
        code: c.certNo || '—',
        batches: n,
        valid: sv.text,
        level: sv.level || 'normal'
      };
    });
    return out.sort(function(a, b){
      var oa = CERT_ORDER[a.level] === undefined ? 9 : CERT_ORDER[a.level];
      var ob = CERT_ORDER[b.level] === undefined ? 9 : CERT_ORDER[b.level];
      return oa - ob || String(a.code).localeCompare(String(b.code));
    }).slice(0, 6);
  }

  /** 渠道客户归类 */
  function classifyChannel(customer){
    var s = String(customer || '');
    if (/超市|直营店|华联/.test(s)) return '商超连锁';
    if (/电商|拼多多|京东|淘宝|天猫/.test(s)) return '电商平台';
    if (/批发市场|农产品市场|雨润|万邦|濛阳/.test(s)) return '批发市场';
    if (/果品|贸易|进出口|经销/.test(s)) return '经销出口';
    return '其他';
  }

  function groupCount(map){
    return Object.keys(map).map(function(k){ return { name:k, value: map[k] }; })
      .sort(function(a, b){ return b.value - a.value; });
  }

  /** 批次流向：基地 → 采收 → 包装 → 渠道 → 消费者 */
  function buildFlow(batches){
    var baseMap = {}, harvestMap = {}, pkgMap = {}, chanMap = {}, custMap = {};
    var signed = 0, durations = [];
    (batches || []).forEach(function(b){
      if (!b) return;
      var base = b.base || '未标注基地';
      baseMap[base] = (baseMap[base] || 0) + 1;

      var grade = b.grade || '未分级';
      harvestMap[grade] = (harvestMap[grade] || 0) + 1;

      var pkg = b.spec || b.product || '未标注规格';
      pkgMap[pkg] = (pkgMap[pkg] || 0) + 1;

      var sm = b.shipment;
      if (sm && sm.customer) {
        var ch = classifyChannel(sm.customer);
        chanMap[ch] = (chanMap[ch] || 0) + 1;
        custMap[sm.customer] = 1;
        var st = String(sm.status || '');
        if (st === 'signed' || st.indexOf('签收') >= 0) signed += 1;
        var d1 = parseDate(b.harvestDate), d2 = parseDate(sm.date);
        if (d1 && d2) durations.push(Math.round((d2 - d1) / 86400000));
      }
    });

    var threshold = ymd(new Date(Date.now() - 6 * 86400000));
    var thisWeek = (batches || []).filter(function(b){
      return datePart(b && b.createdAt) >= threshold;
    }).length;

    var dur = null;
    if (durations.length) {
      var sum = durations.reduce(function(a, x){ return a + x; }, 0);
      dur = round1(sum / durations.length);
    }

    return {
      base: groupCount(baseMap),
      harvest: groupCount(harvestMap),
      package: groupCount(pkgMap),
      channel: groupCount(chanMap),
      consumer: signed ? [{ name:'家庭用户', value:signed }] : [],
      thisWeek: thisWeek,
      channelCount: Object.keys(custMap).length,
      avgDuration: dur
    };
  }

  /** 从业务数据层聚合出与 DEFAULT_DATA 同构的视图 */
  function derive(){
    var T = global.TraceStore;
    if (!T || typeof T.batches !== 'function') return null;
    try {
      var batches = T.batches() || [];
      if (!batches.length) return null;

      var codes = (typeof T.codes === 'function' ? T.codes() : []) || [];
      var scans = (typeof T.scans === 'function' ? T.scans() : []) || [];
      var events = (typeof T.events === 'function' ? T.events() : []) || [];
      var recalls = (typeof T.recalls === 'function' ? T.recalls() : []) || [];
      var stats = (typeof T.stats === 'function' ? T.stats() : {}) || {};
      var chain = (typeof T.chainStats === 'function' ? T.chainStats() : {}) || {};
      var verify = (typeof T.verifyChain === 'function' ? T.verifyChain() : null);

      var activeCodes = 0;
      codes.forEach(function(c){ if (c && c.status === 'active') activeCodes += 1; });

      var covered = {};
      codes.forEach(function(c){ if (c && c.batch) covered[c.batch] = 1; });
      var coveredCount = batches.filter(function(b){ return covered[b && b.batchNo]; }).length;

      var passRate = null;
      if (typeof T.inspectionState === 'function') {
        var passValid = 0;
        batches.forEach(function(b){
          try {
            var st = T.inspectionState(b.batchNo);
            if (st && st.hasValid) passValid += 1;
          } catch(e){}
        });
        passRate = batches.length ? round1(passValid * 100 / batches.length) : null;
      } else if (stats.inspectionRate != null) {
        passRate = round1(num(stats.inspectionRate));
      }

      var chainRate = null;
      if (verify && num(verify.total)) {
        var broken = (verify.broken && verify.broken.length) || 0;
        chainRate = round2((num(verify.total) - broken) * 100 / num(verify.total));
      }

      var provinces = buildProvinces(scans);

      return {
        totalBatches: countOnChainBatches(events, batches),
        totalIssued: codes.length,
        scanTrend: buildScanTrend(scans, 7),
        provinces: provinces,
        provinceTotal: provinces.length,
        channels: buildChannels(scans),
        codeStatus: buildCodeStatus(codes, recalls),
        chainBlocks: buildChainBlocks(events, 5),
        chainNodes: DEFAULT_DATA.chainNodes,
        chainConsensus: DEFAULT_DATA.chainConsensus,
        chainSuccessRate: chainRate,
        certificates: buildCertificates(batches),
        flow: buildFlow(batches),
        passRate: passRate,
        avgResponse: avgOf(scans, 'responseMs'),
        traceCoverage: batches.length ? round1(coveredCount * 100 / batches.length) : null,
        satisfaction: avgOf(typeof T.ratings === 'function' ? T.ratings() : [], 'score')
      };
    } catch (e) {
      console.warn('[TraceStatStore] derive failed', e);
      return null;
    }
  }

  /* ---------------- 模式、缓存与广播 ---------------- */

  // 严格空库模式：模式恒为 auto，不再存在 demo 分支
  function mode(){ return 'auto'; }

  function invalidate(){ cached = null; }

  /** 无真实数据时返回零值同构结构，绝不注入任何演示数据 */
  function emptyView(){ return deepClone(DEFAULT_DATA); }

  /** 统一取数入口：只采用真实数据聚合结果，无数据时返回零值结构 */
  function view(){
    ensureBound();
    if (!cached) {
      cached = derive();
      lastSource = cached ? 'real' : 'empty';
      lastAt = nowStamp();
    }
    return cached || emptyView();
  }

  /** 证书优先从真实 CertStore 取（保留真实数据路径） */
  function certsFromCertStore(){
    var S = global.CertStore;
    if (!S || typeof S.qualifications !== 'function') return null;
    var list = S.qualifications();
    if (!list || !list.length) return null;
    return list.map(function(c){
      var sv = (typeof S.computeStatus === 'function') ? S.computeStatus(c) : { text:'有效', level:'normal' };
      return {
        name: c.type || c.name || '—',
        code: c.certNo || '—',
        batches: 0,
        valid: sv.text,
        level: sv.level || 'normal'
      };
    }).slice(0, 6);
  }

  /* 严格空库模式：本地演示存储（load/save/ensure）已整体移除，
     不再读写 localStorage，也不再向页面注入内置种子数据 */

  function notify(reason){
    subscribers.forEach(function(fn){
      try { fn(reason); } catch(e){ console.warn('[TraceStatStore] subscriber error', e); }
    });
  }

  /** 只广播、不落库：派生数据不写入 localStorage */
  function emit(reason){
    notify(reason);
    try {
      global.dispatchEvent(new CustomEvent('traceStatStoreChange', {
        detail: { reason: reason, source: lastSource, updatedAt: lastAt }
      }));
    } catch(e){}
  }

  function bindSource(){
    if (bound) return;
    var T = global.TraceStore;
    if (!T || typeof T.subscribe !== 'function') return;
    bound = true;
    try {
      T.subscribe(function(){ invalidate(); emit('trace'); });
    } catch(e){}
    var C = global.CertStore;
    if (C && typeof C.subscribe === 'function') {
      try { C.subscribe(function(){ invalidate(); emit('cert'); }); } catch(e){}
    }
    global.addEventListener('storage', function(e){
      if (!e || !e.key) return;
      if (e.key === TRACE_KEY || e.key === CERT_KEY || e.key === HARVEST_KEY) {
        invalidate();
        emit('storage');
      }
    });
  }

  /** 业务数据层可能晚于本文件加载，取数时再补绑一次 */
  function ensureBound(){ if (!bound) bindSource(); }

  /* ---------------- 对外 API ---------------- */

  var TraceStatStore = {
    STORAGE_KEY: STORAGE_KEY,

    overview: function(){
      var d = view();
      var trend = d.scanTrend || [];
      var activated = (d.codeStatus || []).filter(function(x){ return x.name === '已激活'; });
      var activatedVal = activated.length ? num(activated[0].value) : 0;
      var today = trend.length ? num(trend[trend.length - 1].value) : 0;
      var yesterday = trend.length > 1 ? num(trend[trend.length - 2].value) : 0;
      var dod = yesterday ? round1((today - yesterday) * 100 / yesterday) : null;
      var blocks = d.chainBlocks || [];
      return {
        totalBatches: num(d.totalBatches),
        totalIssued: num(d.totalIssued),
        activated: activatedVal,
        activateRate: num(d.totalIssued) ? round1(activatedVal * 100 / num(d.totalIssued)) : null,
        todayScan: today,
        dod: dod,
        provinceTotal: d.provinceTotal == null ? null : num(d.provinceTotal),
        passRate: d.passRate == null ? null : num(d.passRate),
        avgResponse: d.avgResponse == null ? null : num(d.avgResponse),
        traceCoverage: d.traceCoverage == null ? null : num(d.traceCoverage),
        satisfaction: d.satisfaction == null ? null : num(d.satisfaction),
        chainSuccessRate: d.chainSuccessRate == null ? null : num(d.chainSuccessRate),
        chainNodes: d.chainNodes,
        chainHeight: blocks.length ? num(blocks[0].height) : 0
      };
    },
    scanTrend:    function(){ return deepClone(view().scanTrend || []); },
    provinces:    function(){ return deepClone(view().provinces || []); },
    channels:     function(){ return deepClone(view().channels || []); },
    codeStatus:   function(){ return deepClone(view().codeStatus || []); },
    chainBlocks:  function(){ return deepClone(view().chainBlocks || []); },
    certificates: function(){
      var d = view();
      if (Array.isArray(d.certificates) && d.certificates.length) return deepClone(d.certificates);
      var fromStore = certsFromCertStore();
      if (fromStore) return fromStore;
      return [];
    },
    flow:         function(){ return deepClone(view().flow || {}); },

    /** 记录扫码：严格空库模式下仅委托 TraceStore，不再累加演示种子 */
    recordScan: function(meta){
      var T = global.TraceStore;
      if (meta && typeof meta === 'object' && meta.code &&
          T && typeof T.recordScan === 'function') {
        return T.recordScan(meta.code, meta);
      }
      return { ok:false, message:'缺少追溯码，无法记录扫码' };
    },

    setMode: function(m){
      // 严格空库模式：仅接受 auto（恒走真实数据聚合），忽略其他取值
      if (m !== 'auto') return;
      invalidate();
      emit('mode');
    },
    mode: function(){ return mode(); },
    sourceInfo: function(){
      return {
        mode: 'auto',
        source: cached ? 'real' : lastSource,
        updatedAt: lastAt
      };
    },
    refresh: function(){ invalidate(); emit('refresh'); },
    _derive: function(){ return derive(); },

    subscribe: function(fn){
      subscribers.push(fn);
      try { fn('init'); } catch(e){}
      return function unsubscribe(){
        subscribers = subscribers.filter(function(x){ return x !== fn; });
      };
    },
    reset: function(){
      // 严格空库模式：仅清空缓存并重新聚合，不恢复 / 写入任何演示数据
      invalidate();
      emit('reset');
    }
  };

  bindSource();

  global.TraceStatStore = TraceStatStore;
})(window);
