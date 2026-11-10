/**
 * 预警管理共享数据源
 * --------------------------------------------------------------
 * 统一管理设备预警 + 农事预警 + 人工上报 + 库存 + 模型预警数据，
 * 提供跨端（后台、大屏、移动端）读取、写入与同步能力。
 *
 * 数据存储：
 *   - localStorage key: applefarm_alert_state_v1
 *   - v3 结构：{ version: 3, alerts: [...], rules: [...], config: { silence, sla, targets } }
 *   - v2 / v1 结构：读取时自动迁移，迁移前带时间戳备份旧 key，迁移失败回退
 *   - 地块主数据：smartorchard_plot_master（与 enterprise_plot.html 共用，只读）
 *
 * 暴露 API：
 *   AlertStore.all()                          → 全部预警数组
 *   AlertStore.byType(type)                   → 按视图分类筛选 (device | farming)
 *   AlertStore.bySource(source)               → 按来源筛选 (device|manual|model|inventory|system)
 *   AlertStore.byCategory(category)           → 按业务分类筛选
 *   AlertStore.byStatus(status)               → 按状态筛选（六态）
 *   AlertStore.byLevel(level)                 → 按级别筛选 (urgent | important | reminder | notice)
 *   AlertStore.byId(id)                       → 按 id 查询
 *   AlertStore.create(alert)                  → 新建预警（dedupeKey 幂等）
 *   AlertStore.transition(id, to, meta)       → 状态流转（六态校验）
 *   AlertStore.updateStatus(id, status, text, line) → 兼容旧调用，内部走流转校验
 *   AlertStore.appendHistory(id, line)        → 追加处理历史并广播
 *   AlertStore.close/ignore/transfer/assign   → 常用流转快捷方法
 *   AlertStore.evaluate(input)                → 规则引擎：命中规则并生成预警
 *   AlertStore.syncSource(source, items)      → 来源幂等同步（库存 / 模型批量比对）
 *   AlertStore.rules()/saveRule()/removeRule()/toggleRule()
 *   AlertStore.config()/saveConfig()
 *   AlertStore.stats()/statsBySource(source)
 *   AlertStore.windowAlerts(hours)/statsWindow(hours)  → 近 N 小时样本
 *   AlertStore.topToday(n)/dailyTrend(days)           → 今日 TopN / 连续趋势
 *   AlertStore.sourceMeta()/categoryMeta()/slaMinutes()
 *   AlertStore.resolvePlot(alert)/aggregateByPlot()   → 地块主数据解析与聚合
 *   AlertStore.subscribe(fn)                  → 订阅变更，返回 unsubscribe
 */

(function(global){
  'use strict';

  var STORAGE_KEY = 'applefarm_alert_state_v1';
  var BACKUP_KEY = 'applefarm_alert_state_v1_backup_v1';
  var VERSION = 3;
  var PLOT_MASTER_KEY = 'smartorchard_plot_master';
  var TARGETS_KEY = 'snzg_alert_targets';

  // ================================================================
  // 字典
  // ================================================================

  // 标准化级别映射
  var LEVEL_MAP = {
    danger:    { key:'urgent',    text:'紧急' },
    critical:  { key:'urgent',    text:'紧急' },
    warning:   { key:'important', text:'重要' },
    medium:    { key:'reminder',  text:'提醒' },
    info:      { key:'notice',    text:'通知' },
    notice:    { key:'notice',    text:'通知' },
    reminder:  { key:'reminder',  text:'提醒' },
    important: { key:'important', text:'重要' },
    urgent:    { key:'urgent',    text:'紧急' }
  };

  // 六态状态机
  var STATUS_TEXT = {
    pending:     '待处理',
    processing:  '处理中',
    closed:      '已闭环',
    ignored:     '已忽略',
    transferred: '已转工单',
    voided:      '已作废'
  };

  // 合法流转表
  var TRANSITIONS = {
    pending:     ['processing', 'closed', 'ignored', 'transferred', 'voided'],
    processing:  ['closed', 'ignored', 'transferred', 'voided'],
    closed:      ['voided'],
    ignored:     ['pending'],
    transferred: ['closed', 'voided'],
    voided:      ['pending']
  };

  // 来源字典（来源视角 Tab 的唯一依据）
  var SOURCES = [
    { key:'device',    text:'设备预警',   color:'#38D6FF', desc:'设备离线 / 故障 / 数据异常 / 维护提醒' },
    { key:'manual',    text:'人工上报',   color:'#8E7CFF', desc:'巡园现场拍照上报的异常与隐患' },
    { key:'model',     text:'模型预警',   color:'#31C9E8', desc:'气象 / 环境 / 病虫害 / 产量模型推演结果' },
    { key:'inventory', text:'库存预警',   color:'#F58A3D', desc:'农资低于安全线 / 临期 / 过期' },
    { key:'system',    text:'系统预警',   color:'#C0D4EA', desc:'农事任务逾期 / 生长物候等系统级提醒' },
    { key:'cert',      text:'资质到期预警', color:'#52D3A0', desc:'企业资质与批次凭证即将到期 / 已过期（联动 CertStore）' }
  ];

  // 业务分类字典
  var CATEGORIES = [
    { key:'device',      text:'设备',     color:'#38D6FF', source:'device' },
    { key:'pest',        text:'病虫害',   color:'#F2B33D', source:'model' },
    { key:'weather',     text:'气象',     color:'#31C9E8', source:'model' },
    { key:'soil',        text:'土壤',     color:'#3E8EF0', source:'model' },
    { key:'growth',      text:'生长',     color:'#2BD46E', source:'system' },
    { key:'environment', text:'环境',     color:'#8E7CFF', source:'model' },
    { key:'yield',       text:'产量',     color:'#E5564B', source:'model' },
    { key:'inventory',   text:'库存',     color:'#F58A3D', source:'inventory' },
    { key:'quality',     text:'质量',     color:'#C0D4EA', source:'system' },
    { key:'manual',      text:'人工上报', color:'#FF8FB1', source:'manual' }
  ];
  var CATEGORY_MAP = {};
  CATEGORIES.forEach(function(c){ CATEGORY_MAP[c.key] = c; });

  // 静默与 SLA 默认配置
  var DEFAULT_SILENCE = { start:'22:00', end:'07:00', scope:'all' };
  var DEFAULT_SLA = {
    urgent:    { respond:'15 分钟', handle:'2 小时',  escalate:'技术总监' },
    important: { respond:'30 分钟', handle:'4 小时',  escalate:'园区主任' },
    reminder:  { respond:'2 小时',  handle:'24 小时', escalate:'值班长' },
    notice:    { respond:'4 小时',  handle:'无时限', escalate:'不升级' }
  };
  var SCOPE_TEXT = { all:'全部预警', notice:'仅通知', reminder:'仅提醒' };
  var SILENCE_KEY = 'snzg_alert_silence';
  var SLA_KEY = 'snzg_alert_sla_config';

  // 看板达标阈值（分钟 / 百分比），可在预警设置页调整
  var DEFAULT_TARGETS = { avgRespond:30, avgHandle:120, avgClose:1440, overdueRate:10 };

  // 基地别名：预警种子 / 人工上报中的简称 → 地块主数据 enterprise 字段
  var BASE_ALIAS = {
    '天水秦州基地': '天水秦州区基地',
    '天水甘谷基地': '天水甘谷县基地',
    '秦州基地':     '天水秦州区基地',
    '甘谷基地':     '天水甘谷县基地',
    '麦积基地':     '天水麦积区基地',
    '麦积区基地':   '天水麦积区基地',
    '清水基地':     '天水清水县基地'
  };
  // 不在天水地块主数据内的外部基地：不伪造品种 / 负责人，统一标记
  var EXTERNAL_BASES = ['青岛莱西基地', '龙口南山基地', '招远基地'];

  function normalizeLevel(level, levelText){
    if (LEVEL_MAP[level]) {
      return { level: LEVEL_MAP[level].key, levelText: LEVEL_MAP[level].text };
    }
    return { level: level || 'notice', levelText: levelText || '通知' };
  }

  function statusTextOf(status){
    return STATUS_TEXT[status] || status || '';
  }

  function levelTextOf(level){
    var m = LEVEL_MAP[level];
    return m ? m.text : '通知';
  }

  function sourceTextOf(source){
    for (var i = 0; i < SOURCES.length; i++) if (SOURCES[i].key === source) return SOURCES[i].text;
    return '系统预警';
  }

  function categoryTextOf(category){
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].key === category) return CATEGORIES[i].text;
    return '';
  }

  function canTransition(from, to){
    if (!from || !to) return false;
    if (from === to) return true;
    var allowed = TRANSITIONS[from];
    return !!(allowed && allowed.indexOf(to) >= 0);
  }

  function pad2(n){ return n < 10 ? '0' + n : '' + n; }
  function nowStamp(){
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function todayStr(){
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function parseStamp(str){
    var m = String(str || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0, 0);
    return isNaN(d.getTime()) ? null : d.getTime();
  }
  function addMinutes(stamp, minutes){
    var t = parseStamp(stamp);
    if (t === null) return null;
    var d = new Date(t + minutes * 60000);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  // 把「15 分钟」「2 小时」「24 小时」「无时限」解析为分钟数
  function slaMinutes(text){
    if (!text) return 0;
    var s = String(text);
    if (s.indexOf('无时限') >= 0) return 0;
    var m = s.match(/(\d+(?:\.\d+)?)\s*(分钟|小时|天|h|min)/);
    if (!m) return 0;
    var n = parseFloat(m[1]);
    if (m[2] === '小时' || m[2] === 'h') return n * 60;
    if (m[2] === '天') return n * 24 * 60;
    return n;
  }

  // ================================================================
  // 时间戳补齐（种子 / 迁移共用，确定性偏移避免刷新跳变）
  // ================================================================

  function hashOffset(seed, mod, min){
    var sum = 0, s = String(seed || '');
    for (var i = 0; i < s.length; i++) sum += s.charCodeAt(i);
    return min + (sum % mod);
  }

  /** 为一条预警补齐 respondDue / handleDue / acceptedAt / closedAt */
  function hydrateTimes(item){
    if (!item || !parseStamp(item.time)) return item;
    var lv = normalizeLevel(item.level, item.levelText).level;
    item.level = lv;
    item.levelText = levelTextOf(lv);
    var sla = DEFAULT_SLA[lv] || DEFAULT_SLA.notice;
    if (!item.respondDue) {
      var rm = slaMinutes(sla.respond);
      item.respondDue = rm ? addMinutes(item.time, rm) : '';
    }
    if (!item.handleDue) {
      var hm = slaMinutes(sla.handle);
      item.handleDue = hm ? addMinutes(item.time, hm) : '';
    }
    var st = item.status === 'completed' ? 'closed' : item.status;
    if ((st === 'processing' || st === 'closed' || st === 'transferred') && !item.acceptedAt) {
      item.acceptedAt = addMinutes(item.time, hashOffset(item.id + 'a', 23, 5));
    }
    if (st === 'closed' && !item.closedAt) {
      var acc = item.acceptedAt || addMinutes(item.time, hashOffset(item.id + 'a', 23, 5));
      var close = addMinutes(acc, hashOffset(item.id + 'c', 240, 60));
      var closeMs = parseStamp(close);
      var nowMs = Date.now();
      if (closeMs !== null && closeMs > nowMs && parseStamp(item.time) <= nowMs) {
        // 当日闭环不能晚于当前时间，压缩到 time 之后 30~90 分钟
        close = addMinutes(item.time, hashOffset(item.id + 'd', 60, 30));
        if (parseStamp(close) > nowMs) close = nowStamp();
      }
      item.closedAt = close;
    }
    return item;
  }

  // ================================================================
  // 地块主数据解析（只读 smartorchard_plot_master）
  // ================================================================

  function normalizeBase(name){
    var b = String(name || '').trim();
    if (!b) return '';
    return BASE_ALIAS[b] || b;
  }

  function extractBase(location){
    var m = String(location || '').match(/^(.+?基地)/);
    return m ? normalizeBase(m[1]) : '';
  }

  function extractSlot(alert){
    alert = alert || {};
    if (alert.plotSlot) return String(alert.plotSlot).toUpperCase();
    var src = String(alert.plot || '') + ' ' + String(alert.location || '');
    var m = src.match(/地块\s*([A-D]\d+)/i);
    return m ? m[1].toUpperCase() : '';
  }

  function readPlotMaster(){
    try {
      var raw = global.localStorage && global.localStorage.getItem(PLOT_MASTER_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch(e){ return []; }
  }

  // 槽位顺序：A1-A4 / B1-B4 / C1-C3 / D1 对应驾驶舱 12 块示意地图
  var SLOT_ORDER = ['A1','A2','A3','A4','B1','B2','B3','B4','C1','C2','C3','D1'];

  /** 槽位序号：取数字部分（A1/B1/C1/D1 均视为该基地第 1 块地） */
  function slotIndexOf(slot){
    var m = String(slot || '').match(/^[A-D]\s*(\d+)$/i);
    if (!m) return -1;
    var n = parseInt(m[1], 10);
    return n > 0 ? n - 1 : -1;
  }

  var plotAliasCache = { sig:'', master:[], table:{} };

  /**
   * 演示别名表：按基地分组，把槽位序号映射到该基地下真实地块编码。
   * 例：天水麦积区基地|A1 → D-001；超出该基地地块数量的槽位视为未匹配。
   */
  function buildPlotAlias(){
    var master = readPlotMaster();
    var sig = master.map(function(p){ return (p.code || '') + '|' + (p.enterprise || ''); }).join(',');
    if (plotAliasCache.sig === sig && plotAliasCache.table) {
      return { master: plotAliasCache.master, table: plotAliasCache.table };
    }
    var byBase = {};
    master.forEach(function(p){
      var b = normalizeBase(p.enterprise);
      if (!b) return;
      (byBase[b] || (byBase[b] = [])).push(p);
    });
    var table = {};
    Object.keys(byBase).forEach(function(b){
      var list = byBase[b].slice().sort(function(x, y){
        return String(x.code || '').localeCompare(String(y.code || ''));
      });
      byBase[b] = list;
      list.forEach(function(p, i){ table[b + '|' + i] = p.code; });
    });
    plotAliasCache = { sig: sig, master: master, table: table };
    return { master: master, table: table };
  }

  /** 解析一条预警对应的标准地块 */
  function resolvePlot(alert){
    alert = alert || {};
    var alias = buildPlotAlias();
    var master = alias.master;
    var code = String(alert.plotCode || '');
    var slot = extractSlot(alert);
    var base = normalizeBase(alert.base || extractBase(alert.location));

    var hit = null;
    if (code) hit = master.filter(function(p){ return p.code === code; })[0] || null;
    if (hit) {
      return { matched:true, plotCode:hit.code, plot:hit, base:normalizeBase(hit.enterprise), slot:slot };
    }
    if (EXTERNAL_BASES.indexOf(base) >= 0) return { matched:false, base:base, slot:slot, reason:'external' };
    if (!master.length) return { matched:false, base:base, slot:slot, reason:'no-master' };
    if (!base) return { matched:false, base:base, slot:slot, reason:'no-base' };
    var idx = slotIndexOf(slot);
    if (idx < 0) return { matched:false, base:base, slot:slot, reason:'no-slot' };
    var target = alias.table[base + '|' + idx];
    if (!target) return { matched:false, base:base, slot:slot, reason:'no-alias' };
    hit = master.filter(function(p){ return p.code === target; })[0] || null;
    if (!hit) return { matched:false, base:base, slot:slot, reason:'no-alias' };
    return { matched:true, plotCode:hit.code, plot:hit, base:base, slot:slot };
  }

  /** 驾驶舱 12 块示意地图的槽位绑定（按主数据编码顺序取前 12 块） */
  function plotSlots(){
    var master = readPlotMaster().slice().sort(function(x, y){
      return String(x.code || '').localeCompare(String(y.code || ''));
    });
    return SLOT_ORDER.map(function(slot, i){
      var p = master[i] || null;
      return { slot: slot, plotCode: p ? p.code : '', plot: p };
    });
  }

  /** 按标准地块聚合预警，未匹配记录单独成桶 */
  function aggregateByPlot(alerts){
    var list = Array.isArray(alerts) ? alerts : [];
    var byCode = {}, unmatchedMap = {}, matchedCount = 0;
    list.forEach(function(a){
      var r = resolvePlot(a);
      if (r.matched) {
        matchedCount++;
        var o = byCode[r.plotCode] || (byCode[r.plotCode] = {
          plotCode: r.plotCode, plot: r.plot, base: r.base, n: 0,
          urgent: 0, important: 0, reminder: 0, notice: 0, titles: []
        });
        o.n++;
        if (o[a.level] !== undefined) o[a.level]++;
        if (o.titles.length < 3) o.titles.push({ level: a.level, title: a.title });
      } else {
        var key = (r.base || '未知基地') + '|' + (r.slot || '未指明地块');
        var u = unmatchedMap[key] || (unmatchedMap[key] = {
          base: r.base || '未知基地', slot: r.slot || '', reason: r.reason, n: 0, titles: []
        });
        u.n++;
        if (u.titles.length < 3) u.titles.push(a.title);
      }
    });
    var unmatched = Object.keys(unmatchedMap).map(function(k){ return unmatchedMap[k]; });
    unmatched.sort(function(x, y){ return y.n - x.n; });
    return {
      total: list.length,
      matchedCount: matchedCount,
      unmatchedCount: list.length - matchedCount,
      byCode: byCode,
      unmatched: unmatched
    };
  }

  // ================================================================
  // 种子数据（设备 23 + 农事 23）
  // ================================================================

  var DEFAULT_ALERTS = (function(){
    var out = [];

    // 设备预警 23 条
    out.push({ id:'DEV001', type:'device', title:'设备离线：水肥一体化设备离线超过30分钟', level:'urgent', levelText:'紧急', device:'水肥一体化控制器-A01', location:'天水麦积区基地 - 地块A1', time:'2026-09-20 10:30', status:'pending', statusText:'待处理', desc:'设备已离线超过30分钟，请检查设备连接状态和网络状况。建议立即联系现场运维人员进行排查。', history:['系统自动生成预警'] });
    out.push({ id:'DEV002', type:'device', title:'数据异常：土壤湿度传感器数值异常', level:'important', levelText:'重要', device:'土壤湿度传感器-S05', location:'天水秦州基地 - 地块B3', time:'2026-09-20 09:15', status:'processing', statusText:'处理中', desc:'传感器数值超出正常范围，请检查传感器是否损坏或需要校准。', history:['系统自动生成预警','技术员已接单处理'] });
    out.push({ id:'DEV003', type:'device', title:'设备离线：气象站设备离线', level:'important', levelText:'重要', device:'气象站-M02', location:'天水甘谷基地 - 中心区域', time:'2026-09-20 08:45', status:'pending', statusText:'待处理', desc:'气象站设备通讯中断，可能影响气象数据采集。', history:['系统自动生成预警'] });
    out.push({ id:'DEV004', type:'device', title:'设备维护提醒：摄像头C03需要清洁', level:'notice', levelText:'通知', device:'监控摄像头-C03', location:'青岛莱西基地 - 地块C2', time:'2026-09-19 17:00', status:'completed', statusText:'已处理', desc:'摄像头镜头积尘过多，建议安排清洁维护。', history:['系统自动生成预警','已完成清洁维护'] });
    out.push({ id:'DEV005', type:'device', title:'数据异常：虫情灯识别异常', level:'reminder', levelText:'提醒', device:'虫情灯-I01', location:'龙口南山基地 - 地块D1', time:'2026-09-19 14:30', status:'completed', statusText:'已处理', desc:'虫情识别准确率下降，建议检查设备状态。', history:['系统自动生成预警','已完成设备检查'] });
    out.push({ id:'DEV006', type:'device', title:'设备离线：灌溉控制器离线', level:'urgent', levelText:'紧急', device:'灌溉控制器-I02', location:'天水麦积区基地 - 地块A2', time:'2026-09-19 12:00', status:'pending', statusText:'待处理', desc:'灌溉控制器离线，可能影响灌溉计划执行。', history:['系统自动生成预警'] });
    out.push({ id:'DEV007', type:'device', title:'电池电量低：太阳能板供电不足', level:'important', levelText:'重要', device:'太阳能板-SP01', location:'天水秦州基地 - 地块B1', time:'2026-09-19 10:20', status:'processing', statusText:'处理中', desc:'太阳能板发电量不足，电池电量低于20%。', history:['系统自动生成预警','已安排检查太阳能板'] });
    out.push({ id:'DEV008', type:'device', title:'设备离线：温湿度传感器离线', level:'important', levelText:'重要', device:'温湿度传感器-T03', location:'青岛莱西基地 - 地块C1', time:'2026-09-18 16:45', status:'completed', statusText:'已处理', desc:'传感器已恢复正常连接。', history:['系统自动生成预警','已恢复连接'] });
    out.push({ id:'DEV009', type:'device', title:'数据异常：风速传感器读数异常', level:'reminder', levelText:'提醒', device:'风速传感器-W01', location:'天水甘谷基地 - 风口区域', time:'2026-09-18 14:30', status:'completed', statusText:'已处理', desc:'风速读数出现异常波动，已完成校准。', history:['系统自动生成预警','已完成校准'] });
    out.push({ id:'DEV010', type:'device', title:'设备维护提醒：土壤传感器需要校准', level:'notice', levelText:'通知', device:'土壤传感器-S01', location:'天水麦积区基地 - 地块A3', time:'2026-09-18 09:00', status:'pending', statusText:'待处理', desc:'土壤传感器已运行超过6个月，建议进行校准。', history:['系统自动生成预警'] });
    out.push({ id:'DEV011', type:'device', title:'设备离线：无人机基站离线', level:'urgent', levelText:'紧急', device:'无人机基站-DJ01', location:'龙口南山基地 - 停机坪', time:'2026-09-17 18:30', status:'pending', statusText:'待处理', desc:'无人机基站通讯中断，影响无人机作业。', history:['系统自动生成预警'] });
    out.push({ id:'DEV012', type:'device', title:'数据异常：光照传感器数值波动', level:'reminder', levelText:'提醒', device:'光照传感器-L01', location:'天水秦州基地 - 地块B2', time:'2026-09-17 15:20', status:'processing', statusText:'处理中', desc:'光照传感器数值波动较大，需要检查。', history:['系统自动生成预警','技术员正在处理'] });
    out.push({ id:'DEV013', type:'device', title:'设备离线：CO2传感器离线', level:'important', levelText:'重要', device:'CO2传感器-C01', location:'青岛莱西基地 - 温室大棚', time:'2026-09-17 11:00', status:'completed', statusText:'已处理', desc:'CO2传感器已恢复正常。', history:['系统自动生成预警','已恢复正常'] });
    out.push({ id:'DEV014', type:'device', title:'设备维护提醒：摄像头C05镜头需要清洁', level:'notice', levelText:'通知', device:'监控摄像头-C05', location:'天水甘谷基地 - 东门区域', time:'2026-09-16 17:30', status:'completed', statusText:'已处理', desc:'摄像头镜头已清洁完毕。', history:['系统自动生成预警','已完成清洁'] });
    out.push({ id:'DEV015', type:'device', title:'数据异常：土壤pH值传感器异常', level:'important', levelText:'重要', device:'pH传感器-P02', location:'天水麦积区基地 - 地块A4', time:'2026-09-16 14:15', status:'pending', statusText:'待处理', desc:'pH传感器读数异常，需要检查校准。', history:['系统自动生成预警'] });
    out.push({ id:'DEV016', type:'device', title:'设备离线：土壤水分传感器离线', level:'important', levelText:'重要', device:'土壤水分传感器-M01', location:'天水秦州基地 - 地块B4', time:'2026-09-16 10:00', status:'processing', statusText:'处理中', desc:'土壤水分传感器离线，正在排查原因。', history:['系统自动生成预警','正在排查'] });
    out.push({ id:'DEV017', type:'device', title:'设备维护提醒：气象站需要维护', level:'notice', levelText:'通知', device:'气象站-M01', location:'天水麦积区基地 - 中心区域', time:'2026-09-15 16:00', status:'pending', statusText:'待处理', desc:'气象站设备运行时间过长，需要进行常规维护。', history:['系统自动生成预警'] });
    out.push({ id:'DEV018', type:'device', title:'数据异常：雨量传感器数值异常', level:'reminder', levelText:'提醒', device:'雨量传感器-R01', location:'天水甘谷基地 - 南门区域', time:'2026-09-15 13:30', status:'completed', statusText:'已处理', desc:'雨量传感器已校准完毕。', history:['系统自动生成预警','已完成校准'] });
    out.push({ id:'DEV019', type:'device', title:'设备离线：摄像头C01离线', level:'urgent', levelText:'紧急', device:'监控摄像头-C01', location:'青岛莱西基地 - 北门区域', time:'2026-09-15 09:45', status:'pending', statusText:'待处理', desc:'监控摄像头离线，影响区域监控。', history:['系统自动生成预警'] });
    out.push({ id:'DEV020', type:'device', title:'设备维护提醒：灌溉控制器需要检修', level:'notice', levelText:'通知', device:'灌溉控制器-I01', location:'龙口南山基地 - 地块D2', time:'2026-09-14 17:00', status:'completed', statusText:'已处理', desc:'灌溉控制器已完成检修。', history:['系统自动生成预警','已完成检修'] });
    out.push({ id:'DEV021', type:'device', title:'数据异常：空气湿度传感器波动', level:'reminder', levelText:'提醒', device:'空气湿度传感器-H01', location:'天水麦积区基地 - 地块A5', time:'2026-09-14 14:20', status:'completed', statusText:'已处理', desc:'空气湿度传感器波动已恢复正常。', history:['系统自动生成预警','已恢复正常'] });
    out.push({ id:'DEV022', type:'device', title:'设备离线：温度传感器离线', level:'important', levelText:'重要', device:'温度传感器-T01', location:'天水秦州基地 - 地块B5', time:'2026-09-14 10:30', status:'processing', statusText:'处理中', desc:'温度传感器离线，正在恢复连接。', history:['系统自动生成预警','正在恢复'] });
    out.push({ id:'DEV023', type:'device', title:'设备维护提醒：虫情灯需要清理', level:'notice', levelText:'通知', device:'虫情灯-I02', location:'青岛莱西基地 - 地块C3', time:'2026-09-13 16:30', status:'pending', statusText:'待处理', desc:'虫情灯收集盒已满，需要清理。', history:['系统自动生成预警'] });

    // 农事预警 23 条
    out.push({ id:'FAR001', type:'farming', title:'病虫害预警：红蜘蛛虫害爆发风险', level:'urgent', levelText:'紧急', location:'天水麦积区基地 - 地块A1、A2、A3', time:'2026-09-20 11:00', status:'pending', statusText:'待处理', desc:'根据监测数据，红蜘蛛虫口密度已达到防治阈值（>5头/叶），预计未来3天内将进入爆发期。建议立即采取防治措施。', srcType:'disease', srcTypeText:'病虫害预警', history:['系统自动生成预警'], threshold:{ current:'8头/叶', limit:'5头/叶', trend:'呈上升趋势' } });
    out.push({ id:'FAR002', type:'farming', title:'气象预警：暴雨将至，建议做好排水准备', level:'important', levelText:'重要', location:'天水秦州基地 - 全部地块', time:'2026-09-20 09:30', status:'processing', statusText:'处理中', desc:'预计未来24小时内将有暴雨，降雨量预计达到50-80mm。请做好果园排水设施检查和加固工作。', srcType:'weather', srcTypeText:'气象预警', history:['系统自动生成预警','已通知现场准备'], threshold:{ current:'80mm', limit:'50mm', trend:'即将发生' } });
    out.push({ id:'FAR003', type:'farming', title:'土壤预警：地块B3土壤湿度超标', level:'important', levelText:'重要', location:'天水甘谷基地 - 地块B3', time:'2026-09-20 08:00', status:'pending', statusText:'待处理', desc:'地块B3土壤湿度超过85%，长期高湿可能导致根系腐烂。建议及时排水降湿。', srcType:'soil', srcTypeText:'土壤预警', history:['系统自动生成预警'], threshold:{ current:'88%', limit:'85%', trend:'持续偏高' } });
    out.push({ id:'FAR004', type:'farming', title:'病虫害预警：白粉病高发期提醒', level:'reminder', levelText:'提醒', location:'青岛莱西基地 - 地块C1、C2', time:'2026-09-19 16:30', status:'completed', statusText:'已处理', desc:'当前气候条件适宜白粉病发生，建议加强监测并及时预防。', srcType:'disease', srcTypeText:'病虫害预警', history:['系统自动生成预警','已完成预防喷施'], threshold:{ current:'3级', limit:'5级', trend:'风险中等' } });
    out.push({ id:'FAR005', type:'farming', title:'生长预警：苹果果实膨大期需加强施肥', level:'notice', levelText:'通知', location:'龙口南山基地 - 地块D1、D2', time:'2026-09-19 14:00', status:'completed', statusText:'已处理', desc:'当前处于苹果果实快速膨大期，需及时补充钾肥和钙肥，促进果实发育。', srcType:'growth', srcTypeText:'生长预警', history:['系统自动生成预警','已完成追肥'], threshold:{ current:'正常', limit:'-', trend:'需关注' } });
    out.push({ id:'FAR006', type:'farming', title:'气象预警：高温预警，请注意防暑降温', level:'important', levelText:'重要', location:'天水麦积区基地 - 全部地块', time:'2026-09-19 11:30', status:'pending', statusText:'待处理', desc:'预计今日最高气温将达到35°C以上，请安排工作人员错峰作业，做好防暑降温措施。', srcType:'weather', srcTypeText:'气象预警', history:['系统自动生成预警'], threshold:{ current:'36°C', limit:'35°C', trend:'持续升高' } });
    out.push({ id:'FAR007', type:'farming', title:'病虫害预警：蚜虫数量超标', level:'important', levelText:'重要', location:'天水秦州基地 - 地块B1、B2', time:'2026-09-18 17:00', status:'processing', statusText:'处理中', desc:'蚜虫监测数据显示数量已超过防治阈值，建议及时喷洒农药进行防治。', srcType:'disease', srcTypeText:'病虫害预警', history:['系统自动生成预警','已安排喷药'], threshold:{ current:'15头/叶', limit:'10头/叶', trend:'快速上升' } });
    out.push({ id:'FAR008', type:'farming', title:'土壤预警：地块A4氮肥含量偏低', level:'notice', levelText:'通知', location:'天水麦积区基地 - 地块A4', time:'2026-09-18 15:00', status:'completed', statusText:'已处理', desc:'土壤检测显示氮肥含量低于适宜范围，建议追施氮肥。', srcType:'soil', srcTypeText:'土壤预警', history:['系统自动生成预警','已完成追肥'], threshold:{ current:'120mg/kg', limit:'150mg/kg', trend:'偏低' } });
    out.push({ id:'FAR009', type:'farming', title:'气象预警：大风预警，检查防风设施', level:'urgent', levelText:'紧急', location:'天水甘谷基地 - 风口区域', time:'2026-09-18 10:30', status:'pending', statusText:'待处理', desc:'预计今日有6-7级大风，阵风可达8级。请检查并加固果园防风设施。', srcType:'weather', srcTypeText:'气象预警', history:['系统自动生成预警'], threshold:{ current:'15m/s', limit:'12m/s', trend:'风速增大' } });
    out.push({ id:'FAR010', type:'farming', title:'生长预警：果树修剪周期提醒', level:'notice', levelText:'通知', location:'青岛莱西基地 - 地块C3', time:'2026-09-17 16:00', status:'pending', statusText:'待处理', desc:'当前是夏季修剪的最佳时期，建议及时进行夏剪，改善通风透光条件。', srcType:'growth', srcTypeText:'生长预警', history:['系统自动生成预警'], threshold:{ current:'正常', limit:'-', trend:'适时进行' } });
    out.push({ id:'FAR011', type:'farming', title:'病虫害预警：斑点落叶病风险', level:'important', levelText:'重要', location:'龙口南山基地 - 地块D1', time:'2026-09-17 14:30', status:'completed', statusText:'已处理', desc:'根据气象条件预测，未来一周斑点落叶病发生风险较高，建议提前预防。', srcType:'disease', srcTypeText:'病虫害预警', history:['系统自动生成预警','已完成预防'], threshold:{ current:'中风险', limit:'高风险', trend:'风险上升' } });
    out.push({ id:'FAR012', type:'farming', title:'土壤预警：地块B4pH值偏低', level:'reminder', levelText:'提醒', location:'天水秦州基地 - 地块B4', time:'2026-09-17 11:00', status:'completed', statusText:'已处理', desc:'土壤pH值为5.2，低于苹果树适宜范围(6.0-7.0)，建议施用石灰进行改良。', srcType:'soil', srcTypeText:'土壤预警', history:['系统自动生成预警','已施石灰改良'], threshold:{ current:'5.2', limit:'6.0', trend:'偏低' } });
    out.push({ id:'FAR013', type:'farming', title:'气象预警：低温预警，做好防寒措施', level:'urgent', levelText:'紧急', location:'天水麦积区基地 - 地块A5', time:'2026-09-16 18:00', status:'pending', statusText:'待处理', desc:'预计夜间最低气温将降至5°C以下，新梢可能受到冻害。请做好防寒保温措施。', srcType:'weather', srcTypeText:'气象预警', history:['系统自动生成预警'], threshold:{ current:'4°C', limit:'5°C', trend:'气温下降' } });
    out.push({ id:'FAR014', type:'farming', title:'病虫害预警：金龟子成虫活跃期', level:'reminder', levelText:'提醒', location:'天水甘谷基地 - 地块B1、B2', time:'2026-09-16 15:30', status:'processing', statusText:'处理中', desc:'金龟子成虫开始活跃，注意监测并采取诱杀措施。', srcType:'disease', srcTypeText:'病虫害预警', history:['系统自动生成预警','正在诱杀'], threshold:{ current:'12头/株', limit:'20头/株', trend:'逐渐增加' } });
    out.push({ id:'FAR015', type:'farming', title:'生长预警：疏果期提醒', level:'notice', levelText:'通知', location:'青岛莱西基地 - 地块C1、C2', time:'2026-09-16 10:00', status:'completed', statusText:'已处理', desc:'当前是疏果的关键时期，请及时进行疏果，保证果实品质。', srcType:'growth', srcTypeText:'生长预警', history:['系统自动生成预警','已完成疏果'], threshold:{ current:'正常', limit:'-', trend:'适时进行' } });
    out.push({ id:'FAR016', type:'farming', title:'土壤预警：地块A1有机质含量偏低', level:'reminder', levelText:'提醒', location:'天水麦积区基地 - 地块A1', time:'2026-09-15 16:30', status:'pending', statusText:'待处理', desc:'土壤有机质含量为1.2%，低于适宜范围(>2.0%)，建议增施有机肥。', srcType:'soil', srcTypeText:'土壤预警', history:['系统自动生成预警'], threshold:{ current:'1.2%', limit:'2.0%', trend:'偏低' } });
    out.push({ id:'FAR017', type:'farming', title:'气象预警：冰雹预警，做好防护准备', level:'urgent', levelText:'紧急', location:'天水秦州基地 - 全部地块', time:'2026-09-15 14:00', status:'completed', statusText:'已处理', desc:'预计未来2小时内有冰雹天气，请立即做好防雹准备。', srcType:'weather', srcTypeText:'气象预警', history:['系统自动生成预警','已过冰雹天气'], threshold:{ current:'有冰雹', limit:'-', trend:'已过' } });
    out.push({ id:'FAR018', type:'farming', title:'病虫害预警：叶螨防治提醒', level:'important', levelText:'重要', location:'龙口南山基地 - 地块D2', time:'2026-09-15 09:30', status:'pending', statusText:'待处理', desc:'叶螨监测数据接近防治阈值，建议及时防治。', srcType:'disease', srcTypeText:'病虫害预警', history:['系统自动生成预警'], threshold:{ current:'4头/叶', limit:'5头/叶', trend:'接近阈值' } });
    out.push({ id:'FAR019', type:'farming', title:'土壤预警：地块C3钾元素缺乏', level:'important', levelText:'重要', location:'青岛莱西基地 - 地块C3', time:'2026-09-14 17:00', status:'processing', statusText:'处理中', desc:'土壤钾元素含量偏低，影响果实品质和抗病能力。建议追施钾肥。', srcType:'soil', srcTypeText:'土壤预警', history:['系统自动生成预警','已追施钾肥'], threshold:{ current:'80mg/kg', limit:'120mg/kg', trend:'偏低' } });
    out.push({ id:'FAR020', type:'farming', title:'生长预警：套袋期提醒', level:'notice', levelText:'通知', location:'天水麦积区基地 - 地块A2、A3', time:'2026-09-14 14:30', status:'completed', statusText:'已处理', desc:'苹果幼果已进入套袋适宜期，请及时安排套袋工作。', srcType:'growth', srcTypeText:'生长预警', history:['系统自动生成预警','已完成套袋'], threshold:{ current:'正常', limit:'-', trend:'适时进行' } });
    out.push({ id:'FAR021', type:'farming', title:'病虫害预警：炭疽病预防提醒', level:'reminder', levelText:'提醒', location:'天水甘谷基地 - 地块B3', time:'2026-09-14 10:00', status:'completed', statusText:'已处理', desc:'当前气候条件适宜炭疽病发生，建议及时喷施保护性药剂。', srcType:'disease', srcTypeText:'病虫害预警', history:['系统自动生成预警','已喷施药剂'], threshold:{ current:'低风险', limit:'中风险', trend:'风险上升' } });
    out.push({ id:'FAR022', type:'farming', title:'气象预警：干旱预警，建议灌溉', level:'important', levelText:'重要', location:'天水秦州基地 - 地块B5', time:'2026-09-13 16:00', status:'pending', statusText:'待处理', desc:'连续10天无有效降雨，土壤墒情不足。建议及时灌溉。', srcType:'weather', srcTypeText:'气象预警', history:['系统自动生成预警'], threshold:{ current:'25%', limit:'35%', trend:'持续下降' } });
    out.push({ id:'FAR023', type:'farming', title:'土壤预警：地块D1盐分累积超标', level:'important', levelText:'重要', location:'龙口南山基地 - 地块D1', time:'2026-09-13 13:30', status:'processing', statusText:'处理中', desc:'土壤盐分含量达到3.5g/kg，超过安全阈值，建议进行冲洗改良。', srcType:'soil', srcTypeText:'土壤预警', history:['系统自动生成预警','正在冲洗'], threshold:{ current:'3.5g/kg', limit:'3.0g/kg', trend:'持续累积' } });

    // 触发时间动态化：按原始时间先后顺序，均匀映射到"最近 30 天"内（今日为第 0 天）。
    // 保证任意日期打开页面时，新用户看到的预警都是近期数据，而非固定的历史月份（PC-B-032）。
    (function dynamicTimes(){
      var order = out.slice().sort(function(a,b){
        return String(b.time || '').localeCompare(String(a.time || ''));
      });
      var total = order.length;
      var now = new Date();
      order.forEach(function(item, i){
        var daysAgo = total > 1 ? Math.round(i / (total - 1) * 29) : 0;
        var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
        var hh = String(item.time || '').substring(11, 13) || '10';
        var mm = String(item.time || '').substring(14, 16) || '00';
        item.time = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + hh + ':' + mm;
      });
      out.sort(function(a,b){ return String(b.time || '').localeCompare(String(a.time || '')); });
    })();

    // 补齐受理 / 闭环 / SLA 截止时间，保证首屏处置时长与超时率有真实样本
    out.forEach(function(item){ hydrateTimes(item); });

    return out;
  })();

  // ================================================================
  // 种子规则（预警设置页落库对象）
  // ================================================================

  var DEFAULT_RULES = (function(){
    function r(code, name, source, category, level, metric, op, value, value2, unit, scopeType, scopeIds, notify, users, status, desc) {
      var sla = DEFAULT_SLA[level];
      return {
        id: code, code: code, name: name,
        source: source, category: category,
        level: level, levelText: levelTextOf(level),
        threshold: { metric: metric, op: op, value: value, value2: value2, unit: unit },
        scope: { type: scopeType, ids: scopeIds || [] },
        notify: notify,
        assignees: users || [],
        respondSla: sla.respond, handleSla: sla.handle, escalateTo: sla.escalate,
        status: status, statusText: status === 'active' ? '启用' : '停用',
        desc: desc,
        createTime: '2026-09-01 09:00', updatedAt: '2026-09-01 09:00'
      };
    }
    var N_ALL = { internal: true, sms: false, push: false };
    var N_SMS = { internal: true, sms: true, push: false };
    var N_ALL3 = { internal: true, sms: true, push: true };
    var out = [];
    out.push(r('W001','低温霜冻预警','model','weather','urgent','temperature','lt',5,null,'°C','all',[],N_SMS,['惠加宁','黄忠坚'],'active','当温度低于5°C时触发预警，提醒做好防寒措施。'));
    out.push(r('W002','设备离线预警','device','device','urgent','offlineMinutes','gt',10,null,'分钟','all',[],{internal:true,sms:false,push:true},['运维组'],'active','设备离线超过10分钟自动触发预警通知。'));
    out.push(r('W003','农资库存告急','inventory','inventory','reminder','stock','lt',null,null,'件','all',[],N_ALL,['仓库管理员'],'active','农资库存低于安全线时自动预警。'));
    out.push(r('W004','农事任务逾期','system','growth','reminder','overdueHours','gt',24,null,'小时','all',[],N_SMS,['任务负责人'],'inactive','农事任务逾期超过24小时触发预警。'));
    out.push(r('W005','病虫害风险预警','model','pest','important','pestCount','gt',5,null,'头/叶','all',[],{internal:true,sms:false,push:true},['植保组'],'active','病虫害监测数据超过阈值时触发预警。'));
    out.push(r('W006','土壤湿度异常','device','soil','notice','soilMoisture','lt',20,null,'%','all',[],N_ALL,['技术员'],'active','土壤湿度低于20%时触发预警。'));
    out.push(r('W007','高温预警','model','weather','urgent','temperature','gt',35,null,'°C','all',[],N_ALL3,['全体员工'],'active','温度超过35°C时触发高温预警。'));
    out.push(r('W008','设备故障预警','device','device','urgent','faultCode','gt',0,null,'码','all',[],{internal:true,sms:true,push:false},['运维组'],'active','设备检测到故障码时自动触发预警。'));
    out.push(r('W009','肥料库存预警','inventory','inventory','reminder','stock','lt',50,null,'kg','all',[],N_ALL,['仓库管理员'],'active','肥料库存低于50kg时触发预警。'));
    out.push(r('W010','暴雨预警','model','weather','important','rainfall','gt',50,null,'mm','all',[],N_SMS,['全体员工'],'active','预计降雨量超过50mm时触发暴雨预警。'));
    out.push(r('W011','灌溉异常预警','device','device','reminder','flowDeviation','gt',10,null,'%','all',[],{internal:true,sms:false,push:true},['技术员'],'inactive','灌溉系统流量异常时触发预警。'));
    out.push(r('W012','农药库存预警','inventory','inventory','reminder','stock','lt',null,null,'件','all',[],N_ALL,['仓库管理员'],'active','农药库存低于安全线时触发预警。'));
    out.push(r('W013','大风预警','model','weather','urgent','windSpeed','gt',15,null,'m/s','all',[],N_ALL3,['全体员工'],'active','风速超过15m/s时触发大风预警。'));
    out.push(r('W014','设备维护提醒','device','device','notice','runtimeHours','gt',5000,null,'h','all',[],N_ALL,['运维组'],'active','设备运行时长超过5000小时提醒维护。'));
    out.push(r('W015','授粉期提醒','system','growth','notice','phenologyStage','eq',1,null,'期','all',[],N_SMS,['技术员'],'active','苹果花期自动提醒授粉。'));
    out.push(r('W016','收获期提醒','system','growth','notice','maturity','gt',90,null,'%','all',[],N_SMS,['采摘组'],'active','果实成熟度超过90%时提醒收获。'));
    out.push(r('W017','土壤肥力预警','device','soil','reminder','soilNutrient','lt',100,null,'mg/kg','all',[],N_ALL,['技术员'],'active','土壤N/P/K含量低于阈值时预警。'));
    out.push(r('W018','冰雹预警','model','weather','urgent','radarEcho','gt',35,null,'dBZ','all',[],N_ALL3,['全体员工'],'active','雷达检测到冰雹回波时触发预警。'));
    out.push(r('W019','包装箱库存预警','inventory','inventory','notice','stock','lt',1000,null,'个','all',[],N_ALL,['仓库管理员'],'inactive','包装箱库存低于1000个时预警。'));
    out.push(r('W020','温湿度异常预警','device','environment','reminder','tempHumidity','gt',0,null,'异常','all',[],{internal:true,sms:false,push:true},['技术员'],'active','温湿度超出正常范围时预警。'));
    out.push(r('W021','鸟害预警','system','pest','notice','birdCount','gt',0,null,'只','all',[],N_ALL,['植保组'],'active','鸟害监测设备触发时预警。'));
    out.push(r('W022','雷电预警','model','weather','urgent','lightning','gt',0,null,'次','all',[],N_ALL3,['全体员工'],'active','检测到雷电活动时触发预警。'));
    out.push(r('W023','仓储温度预警','device','environment','important','temperature','gt',25,null,'°C','all',[],{internal:true,sms:true,push:false},['仓库管理员'],'active','仓储温度超过25°C时触发预警。'));
    out.push(r('W024','资质证书到期预警','cert','quality','important','daysToExpire','lt',90,null,'天','all',[],N_SMS,['质量部','行政部'],'active','企业资质或批次凭证距到期日不足90天时触发预警。'));
    out.push(r('W025','资质证书过期预警','cert','quality','urgent','daysToExpire','lt',0,null,'天','all',[],N_ALL3,['质量部','行政部'],'active','企业资质或批次凭证已过有效期时触发紧急预警。'));
    return out;
  })();

  // ================================================================
  // 持久化
  // ================================================================

  var subscribers = [];
  var inMemory = null;

  function deepClone(obj){
    try { return JSON.parse(JSON.stringify(obj)); } catch(e){ return obj; }
  }

  function readRaw(){
    try { return global.localStorage ? global.localStorage.getItem(STORAGE_KEY) : null; }
    catch(e){ return null; }
  }

  function writeRaw(payload){
    try {
      if (!global.localStorage) return false;
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch(e){ return false; }
  }

  function backupRaw(){
    try {
      var raw = readRaw();
      if (!raw) return;
      var key = BACKUP_KEY;
      // 已有备份时追加时间戳，避免历史备份被覆盖
      if (global.localStorage.getItem(key)) {
        var d = new Date();
        var ts = d.getFullYear() + pad2(d.getMonth()+1) + pad2(d.getDate()) + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
        key = BACKUP_KEY + '_' + ts;
      }
      global.localStorage.setItem(key, raw);
    } catch(e){ /* 备份失败不阻断主流程 */ }
  }

  /** 把一条旧预警补齐为新结构 */
  function migrateAlert(item){
    var out = deepClone(item);
    // 级别归一
    var lv = normalizeLevel(out.level, out.levelText);
    out.level = lv.level;
    out.levelText = lv.levelText;
    // 状态：3 态 → 6 态
    if (out.status === 'completed') { out.status = 'closed'; out.statusText = '已闭环'; }
    else if (out.status === 'pending') { out.status = 'pending'; out.statusText = '待处理'; }
    else if (out.status === 'processing') { out.status = 'processing'; out.statusText = '处理中'; }
    if (!STATUS_TEXT[out.status]) { out.status = 'pending'; out.statusText = '待处理'; }
    out.statusText = statusTextOf(out.status);

    // 业务分类：srcType → category（非法分类回退重算，供来源回退使用）
    var srcTypeMap = { disease:'pest', weather:'weather', soil:'soil', growth:'growth' };
    if (!out.category || !CATEGORY_MAP[out.category]) {
      out.category = srcTypeMap[out.srcType] || (out.type === 'device' ? 'device' : 'quality');
    }
    if (!out.srcType) out.srcType = out.category;

    // 来源：按业务分类的字典归属回退（device→device / pest·weather·soil·environment·yield→model /
    // inventory→inventory / growth·quality→system）；早期迁移把病虫害、气象误标为 system，此处一并纠正
    var catMeta = CATEGORY_MAP[out.category] || null;
    var fallbackSource = catMeta ? catMeta.source : (out.type === 'device' ? 'device' : 'system');
    if (!out.source || (out.source === 'system' && fallbackSource !== 'system')) {
      out.source = fallbackSource;
    }

    // 结构化定位
    if (!out.base) {
      var loc = String(out.location || '');
      var m = loc.match(/^(.+?基地)/);
      out.base = m ? m[1] : (loc.split(' - ')[0] || '');
    }
    out.base = normalizeBase(out.base);
    if (!out.plot) {
      var pm = String(out.location || '').match(/地块([A-Z]?\d+)/);
      out.plot = pm ? pm[0] : '';
    }
    if (!out.plotSlot) out.plotSlot = extractSlot(out);
    if (out.plotCode === undefined) out.plotCode = '';
    if (!out.assignee) out.assignee = '';
    if (!out.operator) out.operator = '';
    if (!out.escalated) out.escalated = false;
    if (!out.history) out.history = [];
    if (!out.targetType) out.targetType = out.type === 'device' ? 'device' : (out.source === 'inventory' ? 'material' : 'plot');
    if (!out.targetId) out.targetId = out.device || out.plot || out.id;
    if (out.ruleId === undefined) out.ruleId = null;
    if (out.dedupeKey === undefined) out.dedupeKey = null;
    // 补齐 SLA 截止与受理 / 闭环时间（确定性偏移，不随刷新跳变）
    hydrateTimes(out);
    return out;
  }

  function migrateRules(arr){
    var out = [];
    (Array.isArray(arr) ? arr : []).forEach(function(rule){
      var r = deepClone(rule);
      if (!r.threshold || typeof r.threshold !== 'object') {
        r.threshold = { metric:'', op:'gt', value:null, value2:null, unit:'' };
      }
      if (!r.scope) r.scope = { type:'all', ids:[] };
      if (!r.assignees) r.assignees = r.users ? String(r.users).split(/[,，]/).map(function(s){return s.trim();}).filter(Boolean) : [];
      if (!r.notify || typeof r.notify !== 'object') {
        var parts = String(r.notify || '').split('+');
        r.notify = { internal: parts.indexOf('站内') >= 0, sms: parts.indexOf('短信') >= 0, push: parts.indexOf('推送') >= 0 };
      }
      if (!r.source) r.source = 'system';
      if (!r.category) r.category = 'growth';
      if (!r.status) { r.status = 'active'; r.statusText = '启用'; }
      out.push(r);
    });
    return out;
  }

  function readConfig(){
    var cfg = { silence: deepClone(DEFAULT_SILENCE), sla: deepClone(DEFAULT_SLA), targets: deepClone(DEFAULT_TARGETS) };
    try {
      var rawS = global.localStorage && global.localStorage.getItem(SILENCE_KEY);
      if (rawS) {
        var s = JSON.parse(rawS);
        if (s && s.start && s.end) cfg.silence = { start: s.start, end: s.end, scope: s.scope || 'all' };
      }
    } catch(e){ /* 使用默认静默配置 */ }
    try {
      var rawL = global.localStorage && global.localStorage.getItem(SLA_KEY);
      if (rawL) {
        var l = JSON.parse(rawL);
        Object.keys(cfg.sla).forEach(function(k){
          if (l && l[k]) {
            if (l[k].respond) cfg.sla[k].respond = l[k].respond;
            if (l[k].handle) cfg.sla[k].handle = l[k].handle;
            if (l[k].escalate) cfg.sla[k].escalate = l[k].escalate;
          }
        });
      }
    } catch(e){ /* 使用默认 SLA 配置 */ }
    try {
      var rawT = global.localStorage && global.localStorage.getItem(TARGETS_KEY);
      if (rawT) {
        var t = JSON.parse(rawT);
        Object.keys(cfg.targets).forEach(function(k){
          var v = Number(t && t[k]);
          if (isFinite(v) && v > 0) cfg.targets[k] = v;
        });
      }
    } catch(e){ /* 使用默认看板阈值 */ }
    return cfg;
  }

  /** 从 localStorage 读取并迁移为 v3 结构（兼容 v2 / v1） */
  function loadFromStorage(){
    var raw = readRaw();
    if (!raw) return null;
    var parsed;
    try { parsed = JSON.parse(raw); } catch(e){
      // JSON 损坏：备份后回退种子数据
      backupRaw();
      return null;
    }
    if (!parsed) return null;

    // v3 / v2 对象结构
    if (!Array.isArray(parsed) && Array.isArray(parsed.alerts)) {
      var isCurrent = parsed.version === VERSION;
      if (!isCurrent) {
        // 旧版本结构升级：先备份（仅对 v2 及以下执行一次）
        backupRaw();
        try { console.info('[AlertStore] 数据从 v' + (parsed.version || 1) + ' 升级到 v' + VERSION); } catch(e){}
      }
      var storedCfg = parsed.config && parsed.config.silence && parsed.config.sla
        ? { silence: parsed.config.silence, sla: parsed.config.sla, targets: parsed.config.targets || null }
        : null;
      var cfg = readConfig();
      if (storedCfg) {
        cfg.silence = storedCfg.silence;
        cfg.sla = storedCfg.sla;
        if (storedCfg.targets) {
          Object.keys(cfg.targets).forEach(function(k){
            var v = Number(storedCfg.targets[k]);
            if (isFinite(v) && v > 0) cfg.targets[k] = v;
          });
        }
      }
      return {
        alerts: parsed.alerts.map(migrateAlert),
        rules: migrateRules(parsed.rules),
        config: cfg
      };
    }
    // v1 结构：裸数组
    if (Array.isArray(parsed)) {
      backupRaw();
      return {
        alerts: parsed.map(migrateAlert),
        rules: deepClone(DEFAULT_RULES),
        config: readConfig()
      };
    }
    return null;
  }

  function saveToStorage(){
    var ok = writeRaw({
      version: VERSION,
      alerts: inMemory.alerts,
      rules: inMemory.rules,
      config: inMemory.config
    });
    if (!ok) {
      console.warn('[AlertStore] 写入 localStorage 失败，本次变更仅存在于内存');
    }
    return ok;
  }

  function defaultState(){
    return {
      alerts: deepClone(DEFAULT_ALERTS).map(migrateAlert),
      rules: deepClone(DEFAULT_RULES),
      config: readConfig()
    };
  }

  function ensureLoaded(){
    if (inMemory) return inMemory;
    var stored = loadFromStorage();
    inMemory = stored && stored.alerts && stored.alerts.length ? stored : defaultState();
    if (!stored) saveToStorage();
    return inMemory;
  }

  function notify(reason){
    subscribers.forEach(function(fn){
      try { fn(reason, inMemory); } catch(e){ console.warn('[AlertStore] subscriber error', e); }
    });
  }

  function broadcast(reason){
    try {
      saveToStorage();
      notify(reason);
      try {
        var evt = new CustomEvent('alertStoreChange', { detail: { reason: reason } });
        global.dispatchEvent(evt);
      } catch(e){}
    } catch(e){ console.warn('[AlertStore] broadcast error', e); }
  }

  // ================================================================
  // 规则引擎与 SLA
  // ================================================================

  function scopeMatches(rule, input){
    var scope = rule.scope || { type:'all', ids:[] };
    if (!scope.type || scope.type === 'all') return true;
    var ids = scope.ids || [];
    if (!ids.length) return true;
    if (scope.type === 'base') return ids.indexOf(input.base) >= 0;
    if (scope.type === 'plot') return ids.indexOf(input.plot) >= 0;
    if (scope.type === 'device') return ids.indexOf(input.device) >= 0;
    return true;
  }

  function compare(value, op, v1, v2){
    if (value === null || value === undefined || isNaN(value)) return false;
    if (op === 'gt') return value > v1;
    if (op === 'gte') return value >= v1;
    if (op === 'lt') return value < v1;
    if (op === 'lte') return value <= v1;
    if (op === 'between') return v2 !== null && v2 !== undefined && value >= v1 && value <= v2;
    if (op === 'eq') return value === v1;
    if (op === 'neq') return value !== v1;
    return false;
  }

  function matchRule(rule, input){
    if (!rule || rule.status !== 'active') return false;
    if (rule.source && input.source && rule.source !== input.source) return false;
    if (rule.category && input.category && rule.category !== input.category) return false;
    if (!scopeMatches(rule, input)) return false;
    var th = rule.threshold || {};
    if (!th.metric) return true;                       // 无指标规则视为来源/分类匹配
    if (th.metric !== input.metric) return false;
    if (th.op === 'any' || th.value === null || th.value === undefined) return true;
    return compare(input.value, th.op, Number(th.value), th.value2 === undefined ? null : Number(th.value2));
  }

  /** 静默时段判定：仅影响"是否推送"，不影响"是否记录" */
  function inSilence(cfg, level){
    var s = (cfg && cfg.silence) || DEFAULT_SILENCE;
    if (s.scope === 'notice' && level !== 'notice') return false;
    if (s.scope === 'reminder' && level !== 'reminder' && level !== 'notice') return false;
    var toMin = function(t){ var p = String(t).split(':'); return (parseInt(p[0],10)||0)*60 + (parseInt(p[1],10)||0); };
    var start = toMin(s.start), end = toMin(s.end);
    if (start === end) return false;
    var now = new Date();
    var cur = now.getHours()*60 + now.getMinutes();
    if (start < end) return cur >= start && cur < end;
    return cur >= start || cur < end;
  }

  function slaFor(level, cfg){
    var sla = (cfg && cfg.sla && cfg.sla[level]) || DEFAULT_SLA[level] || DEFAULT_SLA.notice;
    return { respond: sla.respond, handle: sla.handle, escalate: sla.escalate };
  }

  function nextId(prefix){
    var arr = ensureLoaded().alerts;
    var max = 0;
    arr.forEach(function(a){
      var m = String(a.id||'').match(/(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1],10));
    });
    var n = max + 1;
    return prefix + String(n).padStart(3,'0');
  }

  function nextRuleCode(){
    var arr = ensureLoaded().rules;
    var max = 0;
    arr.forEach(function(r){
      var m = String(r.code||'').match(/(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1],10));
    });
    return 'W' + String(max + 1).padStart(3,'0');
  }

  // ================================================================
  // 统计（支持任意样本数组，供全量与时间窗复用）
  // ================================================================

  var LEVEL_ORDER = { urgent:0, important:1, reminder:2, notice:3 };
  function sortByLevel(arr){
    return (arr || []).slice().sort(function(a, b){
      var la = LEVEL_ORDER[a.level] !== undefined ? LEVEL_ORDER[a.level] : 9;
      var lb = LEVEL_ORDER[b.level] !== undefined ? LEVEL_ORDER[b.level] : 9;
      if (la !== lb) return la - lb;
      return String(b.time || '').localeCompare(String(a.time || ''));
    });
  }

  function computeStats(arr){
    arr = Array.isArray(arr) ? arr : [];
    var s = {
      total: arr.length,
      pending: 0, processing: 0, closed: 0, ignored: 0, transferred: 0, voided: 0,
      urgent: 0, important: 0, reminder: 0, notice: 0,
      device: 0, farming: 0, devicePending: 0, farmingPending: 0,
      bySource: {}, byCategory: {}, byStatus: {}
    };
    SOURCES.forEach(function(src){ s.bySource[src.key] = { total:0, pending:0, processing:0, closed:0, ignored:0, transferred:0, voided:0 }; });
    CATEGORIES.forEach(function(cat){ s.byCategory[cat.key] = { total:0, pending:0, processing:0, closed:0 }; });
    Object.keys(STATUS_TEXT).forEach(function(k){ s.byStatus[k] = 0; });

    arr.forEach(function(x){
      if (s[x.status] !== undefined) s[x.status]++;
      if (s.byStatus[x.status] !== undefined) s.byStatus[x.status]++;
      if (s[x.level] !== undefined) s[x.level]++;
      if (x.type === 'device') s.device++;
      if (x.type === 'farming') s.farming++;
      if (x.type === 'device' && x.status === 'pending') s.devicePending++;
      if (x.type === 'farming' && x.status === 'pending') s.farmingPending++;
      var src = s.bySource[x.source];
      if (src) { src.total++; if (src[x.status] !== undefined) src[x.status]++; }
      var cat = s.byCategory[x.category];
      if (cat) { cat.total++; if (x.status === 'pending') cat.pending++; if (x.status === 'processing') cat.processing++; if (x.status === 'closed') cat.closed++; }
    });

    // completed 保持为 closed 的别名，兼容既有读取方（da_dashboard 等）
    s.completed = s.closed;
    s.closedRate = s.total ? Math.round(s.closed / s.total * 100) : 0;
    s.open = s.pending + s.processing + s.transferred;
    s.rate = s.closedRate;
    s.todayTotal = s.pending + s.processing;
    s.overdue = 0;
    var now = Date.now();
    arr.forEach(function(x){
      if (x.status === 'pending' || x.status === 'processing') {
        if (x.respondDue) {
          var t = parseStamp(x.respondDue);
          if (t !== null && t < now) s.overdue++;
        }
      }
    });
    // 时间窗样本量（页面副标题使用）
    s.sampleSize = arr.length;
    return s;
  }

  // ================================================================
  // 公开 API
  // ================================================================

  var AlertStore = {
    LEVEL: { URGENT:'urgent', IMPORTANT:'important', REMINDER:'reminder', NOTICE:'notice' },
    STATUS: {
      PENDING:'pending', PROCESSING:'processing', CLOSED:'closed',
      IGNORED:'ignored', TRANSFERRED:'transferred', VOIDED:'voided'
    },
    STATUS_TEXT: STATUS_TEXT,
    TRANSITIONS: TRANSITIONS,
    SOURCES: SOURCES,
    CATEGORIES: CATEGORIES,
    SCOPE_TEXT: SCOPE_TEXT,
    STORAGE_KEY: STORAGE_KEY,
    VERSION: VERSION,
    DEFAULT_TARGETS: DEFAULT_TARGETS,

    // ---------- 读取 ----------
    all: function(){
      return deepClone(ensureLoaded().alerts);
    },
    byType: function(type){
      return ensureLoaded().alerts.filter(function(x){ return x.type === type; }).map(deepClone);
    },
    bySource: function(source){
      if (!source) return this.all();
      return ensureLoaded().alerts.filter(function(x){ return x.source === source; }).map(deepClone);
    },
    byCategory: function(category){
      if (!category) return this.all();
      return ensureLoaded().alerts.filter(function(x){ return x.category === category; }).map(deepClone);
    },
    byStatus: function(status){
      return ensureLoaded().alerts.filter(function(x){ return x.status === status; }).map(deepClone);
    },
    byLevel: function(level){
      return ensureLoaded().alerts.filter(function(x){ return x.level === level; }).map(deepClone);
    },
    byId: function(id){
      var item = ensureLoaded().alerts.find(function(x){ return x.id === id; });
      return item ? deepClone(item) : null;
    },
    bySourceAndCategory: function(source, category){
      return ensureLoaded().alerts.filter(function(x){
        return (!source || x.source === source) && (!category || x.category === category);
      }).map(deepClone);
    },

    // ---------- 统计 ----------
    stats: function(){
      return computeStats(ensureLoaded().alerts);
    },

    /** 近 N 小时创建的预警（以 time 为准） */
    windowAlerts: function(hours){
      var h = Number(hours);
      if (!isFinite(h) || h <= 0) return this.all();
      var since = Date.now() - h * 3600 * 1000;
      return ensureLoaded().alerts.filter(function(x){
        var t = parseStamp(x.time);
        return t !== null && t >= since;
      }).map(deepClone);
    },

    /** 近 N 小时统计（结构同 stats） */
    statsWindow: function(hours){
      return computeStats(this.windowAlerts(hours));
    },

    /** 今日 TopN：默认只含待处理 / 处理中 / 已转工单 */
    topToday: function(n, statuses){
      n = n || 10;
      var allowed = statuses || ['pending','processing','transferred'];
      var today = todayStr();
      var arr = ensureLoaded().alerts.filter(function(x){
        return String(x.time || '').slice(0,10) === today && allowed.indexOf(x.status) >= 0;
      });
      return sortByLevel(arr).slice(0, n).map(deepClone);
    },

    /** 连续 N 天趋势（无数据补 0，日期连续） */
    dailyTrend: function(days){
      days = days || 7;
      var buckets = {};
      var now = new Date();
      for (var i = days - 1; i >= 0; i--) {
        var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        var key = d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate());
        buckets[key] = { date: key, urgent:0, important:0, reminder:0, notice:0, total:0 };
      }
      ensureLoaded().alerts.forEach(function(x){
        var d = String(x.time || '').slice(0,10);
        if (!buckets[d]) return;
        if (buckets[d][x.level] !== undefined) buckets[d][x.level]++;
        buckets[d].total++;
      });
      return Object.keys(buckets).sort().map(function(k){ return buckets[k]; });
    },

    /** 字典（含颜色），驾驶舱 / 后台 / 移动端共用 */
    sourceMeta: function(){ return deepClone(SOURCES); },
    categoryMeta: function(){ return deepClone(CATEGORIES); },

    /** SLA 时限：kind = respond | handle，返回分钟数；无时限返回 null */
    slaMinutes: function(level, kind){
      var cfg = ensureLoaded().config;
      var sla = (cfg.sla && cfg.sla[level]) || DEFAULT_SLA[level] || DEFAULT_SLA.notice;
      var m = slaMinutes(kind === 'handle' ? sla.handle : sla.respond);
      return m > 0 ? m : null;
    },

    /**
     * 处置时效指标（全部由真实时间戳实算）
     * avgResp = acceptedAt - time；avgHandle = closedAt - acceptedAt；avgClose = closedAt - time
     */
    slaMetrics: function(alerts){
      var list = Array.isArray(alerts) ? alerts : ensureLoaded().alerts;
      var now = Date.now();
      var overdue = 0, transferred = 0;
      var respSum = 0, respN = 0, handleSum = 0, handleN = 0, closeSum = 0, closeN = 0;
      list.forEach(function(x){
        var isOpen = x.status === 'pending' || x.status === 'processing' || x.status === 'transferred';
        if (x.status === 'transferred') transferred++;
        var due = parseStamp(x.respondDue);
        if (isOpen && due !== null && due < now) overdue++;
        var t0 = parseStamp(x.time);
        var tAcc = parseStamp(x.acceptedAt);
        var tCls = parseStamp(x.closedAt);
        if (t0 !== null && tAcc !== null && tAcc >= t0) { respSum += tAcc - t0; respN++; }
        if (tAcc !== null && tCls !== null && tCls >= tAcc) { handleSum += tCls - tAcc; handleN++; }
        if (t0 !== null && tCls !== null && tCls >= t0) { closeSum += tCls - t0; closeN++; }
      });
      var total = list.length;
      var over = total ? Math.round(overdue / total * 100) : 0;
      var esc = total ? Math.round(transferred / total * 100) : 0;
      var onTime = Math.max(0, 100 - over - esc);
      return {
        total: total,
        onTime: onTime,
        over: over,
        esc: esc,
        avgResp: respN ? Math.round(respSum / respN / 60000) : null,
        avgHandle: handleN ? Math.round(handleSum / handleN / 60000) : null,
        avgClose: closeN ? Math.round(closeSum / closeN / 60000) : null,
        avg: closeN ? Math.round(closeSum / closeN / 60000) : null,
        sampleResp: respN,
        sampleHandle: handleN,
        sampleClose: closeN
      };
    },

    /** 地块主数据（只读）与解析 / 聚合 */
    plotMaster: function(){ return deepClone(readPlotMaster()); },
    plotSlots: function(){ return deepClone(plotSlots()); },
    resolvePlot: resolvePlot,
    aggregateByPlot: aggregateByPlot,
    normalizeBase: normalizeBase,

    /** 按来源统计（预警总览来源 Tab 使用） */
    statsBySource: function(source){
      var arr = source ? ensureLoaded().alerts.filter(function(x){ return x.source === source; }) : ensureLoaded().alerts;
      var s = {
        total: arr.length, pending:0, processing:0, closed:0, ignored:0, transferred:0, voided:0,
        urgent:0, important:0, reminder:0, notice:0, overdue:0,
        avgResponseMinutes: null, respondedCount: 0
      };
      var resp = [];
      var now = Date.now();
      arr.forEach(function(x){
        if (s[x.status] !== undefined) s[x.status]++;
        if (s[x.level] !== undefined) s[x.level]++;
        if ((x.status === 'pending' || x.status === 'processing') && x.respondDue) {
          var t = parseStamp(x.respondDue);
          if (t !== null && t < now) s.overdue++;
        }
        if (x.acceptedAt && x.time) {
          var a = parseStamp(x.acceptedAt), b = parseStamp(x.time);
          if (a !== null && b !== null && a >= b) { resp.push((a - b)/60000); s.respondedCount++; }
        }
      });
      s.completed = s.closed;
      s.closedRate = s.total ? Math.round(s.closed / s.total * 100) : 0;
      s.rate = s.closedRate;
      s.open = s.pending + s.processing + s.transferred;
      s.avgResponseMinutes = resp.length ? Math.round(resp.reduce(function(a,b){ return a+b; },0) / resp.length) : null;
      return s;
    },

    /** 按分类统计（模型 Tab 的气象/环境/病虫害/产量二级筛选使用） */
    statsByCategory: function(category){
      var arr = ensureLoaded().alerts.filter(function(x){ return x.category === category; });
      var s = { total: arr.length, pending:0, processing:0, closed:0, ignored:0, transferred:0, voided:0 };
      arr.forEach(function(x){ if (s[x.status] !== undefined) s[x.status]++; });
      s.completed = s.closed;
      return s;
    },

    topN: function(n, filter){
      n = n || 3;
      var arr = ensureLoaded().alerts.slice();
      if (filter === 'pending') arr = arr.filter(function(x){ return x.status === 'pending'; });
      else if (filter && filter.source) arr = arr.filter(function(x){ return x.source === filter.source; });
      arr.sort(function(a,b){
        var lvOrder = { urgent:0, important:1, reminder:2, notice:3 };
        var la = lvOrder[a.level] !== undefined ? lvOrder[a.level] : 9;
        var lb = lvOrder[b.level] !== undefined ? lvOrder[b.level] : 9;
        if (la !== lb) return la - lb;
        return (b.time || '').localeCompare(a.time || '');
      });
      return arr.slice(0, n).map(deepClone);
    },

    levelDistribution: function(source){
      var arr = source ? ensureLoaded().alerts.filter(function(x){ return x.source === source; }) : ensureLoaded().alerts;
      var dist = { urgent:0, important:0, reminder:0, notice:0 };
      arr.forEach(function(x){ if (dist[x.level] !== undefined) dist[x.level]++; });
      return dist;
    },

    /** 按日分箱（近 N 天真实趋势） */
    typeTrend: function(days, source){
      days = days || 30;
      var arr = source ? ensureLoaded().alerts.filter(function(x){ return x.source === source; }) : ensureLoaded().alerts;
      var buckets = {};
      var now = new Date();
      for (var i = days - 1; i >= 0; i--) {
        var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        var key = d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate());
        buckets[key] = { date: key, device:0, farming:0, manual:0, model:0, inventory:0, system:0, cert:0, total:0 };
      }
      arr.forEach(function(x){
        var d = String(x.time || '').substring(0,10);
        if (!d || !buckets[d]) return;
        if (buckets[d][x.source] !== undefined) buckets[d][x.source]++;
        buckets[d].total++;
      });
      return Object.keys(buckets).sort().map(function(k){ return buckets[k]; });
    },

    // ---------- 写入 ----------
    /**
     * 新建预警（dedupeKey 幂等）
     * @returns {{ok:boolean, id?:string, message?:string, silenced?:boolean}}
     */
    create: function(input){
      if (!input || !input.title) return { ok:false, message:'预警标题不能为空' };
      var state = ensureLoaded();

      if (input.dedupeKey) {
        var exist = state.alerts.find(function(x){ return x.dedupeKey === input.dedupeKey; });
        if (exist) {
          // 已存在且仍在生效范围 → 更新当前值，不重复创建
          if (exist.status === 'pending' || exist.status === 'processing') {
            if (input.threshold) exist.threshold = input.threshold;
            if (input.value !== undefined && exist.value !== input.value) exist.value = input.value;
            exist.updatedAt = nowStamp();
            broadcast('created:' + exist.id);
            return { ok:true, id: exist.id, deduped:true, message:'已存在同源预警，已更新当前值' };
          }
          return { ok:true, id: exist.id, deduped:true, message:'已存在同源预警，未重复创建' };
        }
      }

      var lvl = normalizeLevel(input.level, input.levelText);
      var sla = input.respondSla && input.handleSla
        ? { respond: input.respondSla, handle: input.handleSla, escalate: input.escalateTo || slaFor(lvl.level, state.config).escalate }
        : slaFor(lvl.level, state.config);
      var base = input.base || '';
      var plot = input.plot || '';
      var device = input.device || '';
      var location = input.location || (base ? base + (plot ? ' - ' + plot : '') : (device || ''));
      var time = input.time || nowStamp();
      var silenced = inSilence(state.config, lvl.level);

      var alert = {
        id: input.id || nextId(prefixOf(input)),
        type: input.type || typeOf(input),
        source: input.source || 'system',
        category: input.category || 'growth',
        title: input.title,
        level: lvl.level,
        levelText: lvl.levelText,
        status: 'pending',
        statusText: '待处理',
        location: location,
        base: base,
        plot: plot,
        plotSlot: input.plotSlot || extractSlot({ plot: plot, location: location }),
        plotCode: input.plotCode || '',
        device: device,
        deviceId: input.deviceId || '',
        targetType: input.targetType || '',
        targetId: input.targetId || '',
        time: time,
        desc: input.desc || '',
        history: input.history ? deepClone(input.history) : ['系统自动生成预警'],
        assignee: input.assignee || '',
        operator: input.operator || '',
        acceptedAt: '',
        closedAt: '',
        respondDue: addMinutes(time, slaMinutes(sla.respond)),
        handleDue: slaMinutes(sla.handle) ? addMinutes(time, slaMinutes(sla.handle)) : '',
        escalated: false,
        dedupeKey: input.dedupeKey || null,
        ruleId: input.ruleId || null,
        threshold: input.threshold || null,
        silenced: silenced,
        notify: input.notify || null,
        value: input.value !== undefined ? input.value : null,
        updatedAt: nowStamp()
      };
      state.alerts.unshift(alert);
      broadcast('created:' + alert.id);
      return { ok:true, id: alert.id, silenced: silenced, message: silenced ? '静默时段内生成，已抑制推送' : '预警已生成' };
    },

    /** 状态流转（六态校验） */
    transition: function(id, to, meta){
      meta = meta || {};
      var state = ensureLoaded();
      var item = state.alerts.find(function(x){ return x.id === id; });
      if (!item) return { ok:false, message:'预警不存在' };
      if (!STATUS_TEXT[to]) return { ok:false, message:'未知状态：' + to };
      if (!canTransition(item.status, to)) {
        return { ok:false, message:'不允许从「' + statusTextOf(item.status) + '」流转到「' + statusTextOf(to) + '」' };
      }
      var from = item.status;
      item.status = to;
      item.statusText = statusTextOf(to);
      var stamp = meta.time || nowStamp();
      var parts = [];
      if (meta.action) parts.push(meta.action);
      if (meta.operator) { parts.push(meta.operator); item.operator = meta.operator; }
      if (meta.assignee) { parts.push('受理人：' + meta.assignee); item.assignee = meta.assignee; }
      if (meta.note) parts.push('（' + meta.note + '）');
      if (to === 'processing' && !item.acceptedAt) item.acceptedAt = stamp;
      if (to === 'closed' && !item.closedAt) item.closedAt = stamp;
      if (to === 'transferred') item.escalated = true;
      item.history = item.history || [];
      if (meta.historyLine) {
        item.history.push(meta.historyLine);
      } else if (parts.length) {
        item.history.push(stamp + ' ' + parts.join(' '));
      }
      item.updatedAt = stamp;
      broadcast('status:' + id);
      return { ok:true, id:id, from:from, to:to, message:'状态已更新为' + statusTextOf(to) };
    },

    /** 兼容旧调用：更新状态（内部走流转校验） */
    updateStatus: function(id, status, statusText, historyLine){
      var state = ensureLoaded();
      var item = state.alerts.find(function(x){ return x.id === id; });
      if (!item) return false;
      // 旧数据里的 completed 归一为 closed
      var to = status === 'completed' ? 'closed' : status;
      if (!canTransition(item.status, to)) {
        // 非法流转时保留原状态，仅追加历史，避免旧页面调用报错
        if (historyLine) {
          item.history = item.history || [];
          item.history.push(historyLine);
          broadcast('history:' + id);
        }
        return false;
      }
      var res = this.transition(id, to, { historyLine: historyLine || '' });
      return res.ok;
    },

    appendHistory: function(id, line){
      var state = ensureLoaded();
      var item = state.alerts.find(function(x){ return x.id === id; });
      if (!item) return false;
      item.history = item.history || [];
      item.history.push(line);
      broadcast('history:' + id);
      return true;
    },

    close: function(id, meta){ return this.transition(id, 'closed', meta); },
    ignore: function(id, meta){ return this.transition(id, 'ignored', meta); },
    transfer: function(id, meta){ return this.transition(id, 'transferred', meta); },
    assign: function(id, assignee, meta){
      meta = meta || {};
      meta.assignee = assignee;
      var state = ensureLoaded();
      var item = state.alerts.find(function(x){ return x.id === id; });
      if (!item) return { ok:false, message:'预警不存在' };
      item.assignee = assignee;
      item.history = item.history || [];
      item.history.push(nowStamp() + ' 指派受理人：' + assignee);
      broadcast('assigned:' + id);
      return { ok:true, message:'已指派给 ' + assignee };
    },
    void: function(id, meta){ return this.transition(id, 'voided', meta); },
    reopen: function(id, meta){ return this.transition(id, 'pending', meta); },

    /**
     * 规则引擎：命中规则则生成预警
     * @returns {{hit:boolean, ruleId?:string, alertId?:string, message:string}}
     */
    evaluate: function(input){
      var state = ensureLoaded();
      var rules = state.rules || [];
      for (var i = 0; i < rules.length; i++) {
        var rule = rules[i];
        if (!matchRule(rule, input)) continue;
        var sla = slaFor(rule.level, state.config);
        var res = this.create({
          id: input.id,
          type: input.type || typeOf(input),
          source: input.source || rule.source,
          category: input.category || rule.category,
          title: input.title || rule.name,
          desc: input.desc || rule.desc,
          level: rule.level,
          base: input.base,
          plot: input.plot,
          device: input.device,
          deviceId: input.deviceId,
          targetType: input.targetType,
          targetId: input.targetId,
          threshold: input.threshold,
          value: input.value,
          dedupeKey: input.dedupeKey,
          ruleId: rule.code,
          respondSla: rule.respondSla || sla.respond,
          handleSla: rule.handleSla || sla.handle,
          escalateTo: rule.escalateTo || sla.escalate,
          notify: rule.notify,
          assignee: (rule.assignees && rule.assignees[0]) || ''
        });
        return { hit:true, ruleId: rule.code, ruleName: rule.name, alertId: res.id, silenced: res.silenced, message: res.message };
      }
      return { hit:false, message:'未命中启用的规则' };
    },

    /**
     * 来源幂等同步（库存 / 模型批量比对）
     * items: [{ dedupeKey, title, desc, level, category, base, plot, value, threshold, targetType, targetId, ruleId }]
     * keyPrefix: 可选，限定「自动关闭」的 dedupeKey 前缀，避免同一来源下多个页面互相清空
     */
    syncSource: function(source, items, keyPrefix){
      var state = ensureLoaded();
      var list = Array.isArray(items) ? items : [];
      var created = 0, closed = 0, updated = 0;
      var seen = {};
      var self = this;

      list.forEach(function(it){
        if (!it || !it.dedupeKey) return;
        seen[it.dedupeKey] = true;
        var exist = state.alerts.find(function(x){ return x.dedupeKey === it.dedupeKey; });
        if (exist) {
          if (exist.status === 'pending' || exist.status === 'processing') {
            if (it.threshold) exist.threshold = it.threshold;
            if (it.value !== undefined) exist.value = it.value;
            exist.updatedAt = nowStamp();
            updated++;
          }
          return;
        }
        var res = self.create({
          id: it.id,
          type: it.type || typeOf({ source: source }),
          source: source,
          category: it.category || 'inventory',
          title: it.title,
          desc: it.desc,
          level: it.level,
          base: it.base,
          plot: it.plot,
          plotSlot: it.plotSlot,
          plotCode: it.plotCode,
          device: it.device,
          deviceId: it.deviceId,
          targetType: it.targetType,
          targetId: it.targetId,
          threshold: it.threshold,
          value: it.value,
          dedupeKey: it.dedupeKey,
          ruleId: it.ruleId || null
        });
        if (res.ok && !res.deduped) created++;
      });

      // 清单中已消失的同源预警 → 自动关闭
      var stale = state.alerts.filter(function(x){
        return x.source === source && x.dedupeKey && !seen[x.dedupeKey] &&
          (!keyPrefix || x.dedupeKey.indexOf(keyPrefix) === 0) &&
          (x.status === 'pending' || x.status === 'processing');
      });
      stale.forEach(function(x){
        x.status = 'closed';
        x.statusText = '已闭环';
        x.closedAt = nowStamp();
        x.history = x.history || [];
        x.history.push(nowStamp() + ' 来源恢复后自动关闭');
        closed++;
      });

      if (created || closed || updated) broadcast('sync:' + source);
      return { ok:true, created: created, closed: closed, updated: updated };
    },

    // ---------- 规则 ----------
    rules: function(){
      return deepClone(ensureLoaded().rules || []);
    },
    rule: function(id){
      var r = ensureLoaded().rules.find(function(x){ return x.id === id || x.code === id; });
      return r ? deepClone(r) : null;
    },
    saveRule: function(rule){
      var state = ensureLoaded();
      if (!rule || !rule.name) return { ok:false, message:'规则名称不能为空' };
      var id = rule.id || rule.code || nextRuleCode();
      var idx = state.rules.findIndex(function(x){ return x.id === id || x.code === id; });
      var now = nowStamp();
      var payload = deepClone(rule);
      payload.id = id;
      payload.code = rule.code || id;
      payload.level = normalizeLevel(payload.level, payload.levelText).level;
      payload.levelText = levelTextOf(payload.level);
      payload.status = payload.status || 'active';
      payload.statusText = payload.status === 'active' ? '启用' : '停用';
      payload.updatedAt = now;
      if (!payload.createTime) payload.createTime = now;
      if (idx >= 0) {
        state.rules[idx] = payload;
      } else {
        state.rules.unshift(payload);
      }
      broadcast('rule:' + id);
      return { ok:true, id:id, message: idx >= 0 ? '规则已更新' : '规则已创建' };
    },
    removeRule: function(id){
      var state = ensureLoaded();
      var before = state.rules.length;
      state.rules = state.rules.filter(function(x){ return x.id !== id && x.code !== id; });
      if (state.rules.length === before) return { ok:false, message:'规则不存在' };
      broadcast('rule-removed:' + id);
      return { ok:true, message:'规则已删除' };
    },
    toggleRule: function(id, status){
      var state = ensureLoaded();
      var rule = state.rules.find(function(x){ return x.id === id || x.code === id; });
      if (!rule) return { ok:false, message:'规则不存在' };
      rule.status = status || (rule.status === 'active' ? 'inactive' : 'active');
      rule.statusText = rule.status === 'active' ? '启用' : '停用';
      rule.updatedAt = nowStamp();
      broadcast('rule:' + rule.id);
      return { ok:true, message: rule.statusText };
    },

    // ---------- 配置 ----------
    config: function(){
      return deepClone(ensureLoaded().config);
    },
    saveConfig: function(patch){
      var state = ensureLoaded();
      if (patch && patch.silence) {
        state.config.silence = Object.assign({}, state.config.silence, patch.silence);
        try { global.localStorage.setItem(SILENCE_KEY, JSON.stringify(state.config.silence)); } catch(e){}
      }
      if (patch && patch.sla) {
        Object.keys(state.config.sla).forEach(function(k){
          if (patch.sla[k]) state.config.sla[k] = Object.assign({}, state.config.sla[k], patch.sla[k]);
        });
        try { global.localStorage.setItem(SLA_KEY, JSON.stringify(state.config.sla)); } catch(e){}
      }
      if (patch && patch.targets) {
        var bad = null;
        Object.keys(state.config.targets).forEach(function(k){
          if (patch.targets[k] === undefined || patch.targets[k] === null || patch.targets[k] === '') return;
          var v = Number(patch.targets[k]);
          if (!isFinite(v) || v <= 0) { bad = k; return; }
          state.config.targets[k] = v;
        });
        if (bad) return { ok:false, message:'看板阈值必须为正数：' + bad };
        try { global.localStorage.setItem(TARGETS_KEY, JSON.stringify(state.config.targets)); } catch(e){}
      }
      broadcast('config');
      return { ok:true, message:'配置已保存' };
    },
    /** 静默是否生效（仅影响推送） */
    isSilenced: function(level){
      return inSilence(ensureLoaded().config, level);
    },
    slaOf: function(level){
      return slaFor(level, ensureLoaded().config);
    },

    // ---------- 其他 ----------
    /**
     * 导出 CSV（原生 Blob，不引入第三方库）
     * @param rows   [{...}] 数据行
     * @param cols   [{ key, title }] 列定义
     * @param filename 文件名（不含扩展名）
     */
    exportCsv: function(rows, cols, filename){
      try {
        if (!global.document || !global.Blob || !global.URL || !global.URL.createObjectURL) return false;
        var lines = [];
        lines.push(cols.map(function(c){ return '"' + String(c.title).replace(/"/g,'""') + '"'; }).join(','));
        (Array.isArray(rows) ? rows : []).forEach(function(r){
          lines.push(cols.map(function(c){
            var v = r[c.key];
            if (v === null || v === undefined) v = '';
            if (typeof v === 'object') v = JSON.stringify(v);
            return '"' + String(v).replace(/"/g,'""') + '"';
          }).join(','));
        });
        var content = '\ufeff' + lines.join('\r\n');   // BOM 保证 Excel 中文不乱码
        var blob = new global.Blob([content], { type:'text/csv;charset=utf-8;' });
        var url = global.URL.createObjectURL(blob);
        var a = global.document.createElement('a');
        a.href = url;
        a.download = (filename || 'alert-export') + '.csv';
        global.document.body.appendChild(a);
        a.click();
        global.document.body.removeChild(a);
        setTimeout(function(){ global.URL.revokeObjectURL(url); }, 1000);
        return true;
      } catch(e){
        console.warn('[AlertStore] exportCsv failed', e);
        return false;
      }
    },

    subscribe: function(fn){
      subscribers.push(fn);
      try { fn('init', ensureLoaded()); } catch(e){}
      return function unsubscribe(){
        subscribers = subscribers.filter(function(x){ return x !== fn; });
      };
    },
    reset: function(){
      inMemory = defaultState();
      saveToStorage();
      broadcast('reset');
    },
    resetAlerts: function(){
      inMemory.alerts = deepClone(DEFAULT_ALERTS).map(migrateAlert);
      saveToStorage();
      broadcast('reset');
    },
    _syncFromExternal: function(){
      var stored = loadFromStorage();
      if (stored && stored.alerts && stored.alerts.length) {
        inMemory = stored;
        notify('sync');
      }
    }
  };

  function prefixOf(input){
    if (input.source === 'device') return 'DEV';
    if (input.source === 'manual') return 'MAN';
    if (input.source === 'inventory') return 'INV';
    if (input.source === 'model') return 'MDL';
    return 'SYS';
  }
  function typeOf(input){
    if (input.source === 'device') return 'device';
    if (input.source === 'inventory') return 'inventory';
    if (input.source === 'manual') return 'manual';
    if (input.source === 'model') return 'model';
    return 'farming';
  }

  // 跨标签页同步：监听 storage 事件
  global.addEventListener('storage', function(e){
    if (e.key === STORAGE_KEY) AlertStore._syncFromExternal();
  });

  global.AlertStore = AlertStore;
})(typeof window !== 'undefined' ? window : this);
