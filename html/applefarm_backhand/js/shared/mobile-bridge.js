/**
 * 移动端 → PC 端数据桥接
 * --------------------------------------------------------------
 * 移动端（applefarm_mobile/js/mobile-store.js）把现场作业写入 localStorage，
 * 本文件让 PC 端页面读取同一份数据，打通 FLOW-004 / FLOW-010 / FLOW-011 跨端闭环。
 *
 * 读取的移动端存储键：
 *   smartorchard_farming_records  农事记录（记农事）
 *   smartorchard_patrol_records   巡查打卡 / 异常上报
 *   smartorchard_plots            手绘地块
 *   smartorchard_adoption_tags    认养挂牌
 *   smartorchard_material_logs    农资领用
 *   smartorchard_label_records    标签领用
 *
 * 暴露 API：
 *   MobileBridge.farmingRecords()  → 映射为 PC 端农事记录结构
 *   MobileBridge.patrolRecords()   → 巡查打卡记录
 *   MobileBridge.abnormalReports() → 巡查异常上报
 *   MobileBridge.plots()           → 手绘地块
 *   MobileBridge.adoptionTags()    → 认养挂牌
 *   MobileBridge.hasMobileData()   → 是否存在移动端数据
 *   MobileBridge.sourceTag(item)   → 数据来源角标文案
 *   MobileBridge.formatGps(gps)    → 定位格式化
 */

(function (global) {
  'use strict';

  var KEYS = {
    farming: 'smartorchard_farming_records',
    patrol: 'smartorchard_patrol_records',
    plots: 'smartorchard_plots',
    adoptionTag: 'smartorchard_adoption_tags',
    material: 'smartorchard_material_logs',
    labelRecords: 'smartorchard_label_records'
  };

  // 移动端农事类型 → PC 端类型枚举
  var TYPE_MAP = {
    '疏果': 'tool', '套袋': 'tool', '环剥': 'tool', '除草': 'tool', '授粉': 'tool',
    '修剪': 'tool', '疏花疏果': 'tool',
    '喷药': 'pesticide', '病虫害防治': 'pesticide', '杀菌': 'pesticide',
    '灌溉': 'irrigation', '浇水': 'irrigation',
    '施肥': 'fertilizer', '追肥': 'fertilizer', '基肥': 'fertilizer'
  };

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return Array.isArray(v) ? v : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso || '').slice(0, 10);
    var p = function (n) { return n < 10 ? '0' + n : n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function fmtTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var p = function (n) { return n < 10 ? '0' + n : n; };
    return p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /** 移动端农事记录 → PC 端表格结构 */
  function farmingRecords() {
    return read(KEYS.farming, []).map(function (r, idx) {
      var typeName = r.taskType || '其他';
      return {
        id: r.id || ('MOB-' + idx),
        base: r.base || '天水麦积区基地',
        plot: r.plot || '未指定',
        type: TYPE_MAP[typeName] || 'tool',
        typeName: typeName,
        executor: r.operator || '现场人员',
        date: fmtDate(r.createTime),
        time: fmtTime(r.createTime),
        status: 'pending',
        source: 'mobile',
        remark: r.remark || '',
        gps: r.gps || null,
        hasPhoto: !!r.photo
      };
    });
  }

  function patrolRecords() {
    return read(KEYS.patrol, []).filter(function (r) { return !r.kind; });
  }

  function abnormalReports() {
    return read(KEYS.patrol, []).filter(function (r) { return r.kind === 'abnormal'; });
  }

  function plots() {
    // 兼容旧键（mb_draw_plot 早期写入的 'plots'）
    var legacy = read('plots', []);
    var shared = read(KEYS.plots, []);
    var seen = {};
    var out = [];
    shared.concat(legacy).forEach(function (p) {
      if (!p || seen[p.id]) return;
      seen[p.id] = true;
      out.push(p);
    });
    return out;
  }

  function adoptionTags() {
    // 排除农事记录绑定（非挂牌条目）
    return read(KEYS.adoptionTag, []).filter(function (t) { return t && t.kind !== 'farming_bind'; });
  }

  function farmingBinds() {
    return read(KEYS.adoptionTag, []).filter(function (t) { return t && t.kind === 'farming_bind'; });
  }

  function materialLogs() {
    return read(KEYS.material, []);
  }

  function labelRecords() {
    return read(KEYS.labelRecords, []);
  }

  function hasMobileData() {
    return farmingRecords().length > 0 ||
           abnormalReports().length > 0 ||
           plots().length > 0 ||
           adoptionTags().length > 0;
  }

  function sourceTag(item) {
    if (!item || item.source !== 'mobile') return '';
    return '<span class="source-tag">移动端</span>';
  }

  function formatGps(gps) {
    if (!gps || typeof gps.lat !== 'number') return '无定位';
    return '北纬' + gps.lat.toFixed(4) + '°，东经' + gps.lng.toFixed(4) + '°';
  }

  global.MobileBridge = {
    KEYS: KEYS,
    farmingRecords: farmingRecords,
    patrolRecords: patrolRecords,
    abnormalReports: abnormalReports,
    plots: plots,
    adoptionTags: adoptionTags,
    farmingBinds: farmingBinds,
    materialLogs: materialLogs,
    labelRecords: labelRecords,
    hasMobileData: hasMobileData,
    sourceTag: sourceTag,
    formatGps: formatGps
  };
})(window);
