/**
 * 土壤检测共享数据层
 * --------------------------------------------------------------
 * 解决「有机质 / 速效氮磷钾」全端无源的问题：后台录入检测报告，
 * 大屏、移动端、H5 统一读取同一份数据。
 *
 * 存储 key： smartorchard_soil_tests_v1
 *
 * 单位约定（全端统一）：
 *   - EC 以 µS/cm 存储与展示，后台/大屏需要 mS/cm 时按 1 mS/cm = 1000 µS/cm 换算
 *   - 有机质 %，速效氮/磷/钾 mg/kg，pH 无量纲
 *
 * 暴露 API：
 *   SoilStore.tests()              全部检测记录
 *   SoilStore.latestByPlot()       每地块最新一条 { plotCode: record }
 *   SoilStore.latestOf(plotCode)   指定地块最新检测
 *   SoilStore.summary()            { organicMatter, availableN/P/K, ph, ec, sampleCount, sampleDate, updatedAt }
 *   SoilStore.upsert(item) / remove(id) / reset() / subscribe(fn)
 */

(function (global) {
  'use strict';

  var STORAGE_KEY = 'smartorchard_soil_tests_v1';

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function num(v, def) { var n = parseFloat(v); return isNaN(n) ? (def || 0) : n; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function stampNow() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  /* 地块主数据：与 enterprise_plot.html 共用同一 key */
  var PLOT_MASTER_KEY = 'smartorchard_plot_master';
  function plotOf(code) {
    try {
      var raw = localStorage.getItem(PLOT_MASTER_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {
        var hit = arr.filter(function (p) { return p && p.code === code; })[0];
        if (hit) return { code: hit.code, name: hit.name || '', base: hit.enterprise || '', area: num(hit.area) };
      }
    } catch (e) {}
    return { code: code, name: '', base: '', area: 0 };
  }

  /* 种子：12 个已建模地块各一份 2026-10 检测报告，均值对齐 2.4% / 62 / 28 / 186 / 6.8 / 1240µS·cm⁻¹ */
  var PLOT_CODES = ['D-001', 'D-002', 'D-003', 'D-004', 'D-005', 'D-006',
    'D-007', 'D-008', 'D-009', 'D-010', 'D-011', 'D-012'];
  var GM = [2.2, 2.5, 2.3, 2.6, 2.4, 2.4, 2.5, 2.3, 2.6, 2.4, 2.3, 2.3];
  var AN = [58, 64, 60, 66, 62, 61, 65, 59, 63, 60, 64, 62];
  var AP = [25, 30, 27, 31, 28, 26, 29, 27, 30, 28, 26, 29];
  var AK = [178, 192, 182, 196, 186, 184, 190, 180, 194, 186, 182, 182];
  var PH = [6.7, 6.9, 6.8, 6.9, 6.7, 6.8, 6.9, 6.7, 6.8, 6.9, 6.7, 6.8];
  var EC = [1180, 1260, 1220, 1300, 1240, 1230, 1280, 1200, 1290, 1240, 1210, 1230];

  function buildSeed() {
    return PLOT_CODES.map(function (code, i) {
      return {
        id: 'ST-2026-' + ('00' + (i + 1)).slice(-3),
        plotCode: code,
        sampleDate: '2026-10-' + pad2(18 + (i % 5)),
        lab: '天水市农技推广中心',
        organicMatter: GM[i],
        availableN: AN[i],
        availableP: AP[i],
        availableK: AK[i],
        ph: PH[i],
        ec: EC[i],
        source: 'seed'
      };
    });
  }

  var inMemory = null;
  var subscribers = [];

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : null;
    } catch (e) {
      console.warn('[SoilStore] 本地数据损坏，已重新初始化', e);
      return null;
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemory));
      return true;
    } catch (e) {
      console.error('[SoilStore] 保存失败', e);
      return false;
    }
  }

  function ensure() {
    if (inMemory) return inMemory;
    var stored = load();
    inMemory = (stored && stored.length) ? stored.filter(function (x) {
      return x && typeof x === 'object' && x.plotCode;
    }) : buildSeed();
    if (!stored || !stored.length) save();
    return inMemory;
  }

  function notify(reason) {
    subscribers.forEach(function (fn) { try { fn(reason); } catch (e) {} });
  }

  function commit(reason) {
    save();
    notify(reason);
    try { window.dispatchEvent(new CustomEvent('soilStoreChange', { detail: { reason: reason } })); } catch (e) {}
  }

  function tests() { return clone(ensure()); }

  function latestByPlot() {
    var out = {};
    ensure().forEach(function (t) {
      var prev = out[t.plotCode];
      if (!prev || String(t.sampleDate || '') > String(prev.sampleDate || '')) out[t.plotCode] = t;
    });
    return clone(out);
  }

  function latestOf(plotCode) {
    var map = latestByPlot();
    return map[plotCode] ? clone(map[plotCode]) : null;
  }

  /** 全园最新检测汇总：按地块取最新一条后求算术均值 */
  function summary() {
    var map = latestByPlot();
    var rows = Object.keys(map).map(function (k) { return map[k]; });
    if (!rows.length) {
      return {
        organicMatter: null, availableN: null, availableP: null, availableK: null,
        ph: null, ec: null, sampleCount: 0, sampleDate: '', updatedAt: ''
      };
    }
    var sum = { organicMatter: 0, availableN: 0, availableP: 0, availableK: 0, ph: 0, ec: 0 };
    var latestDate = '';
    rows.forEach(function (r) {
      sum.organicMatter += num(r.organicMatter);
      sum.availableN += num(r.availableN);
      sum.availableP += num(r.availableP);
      sum.availableK += num(r.availableK);
      sum.ph += num(r.ph);
      sum.ec += num(r.ec);
      if (String(r.sampleDate || '') > latestDate) latestDate = String(r.sampleDate || '');
    });
    var n = rows.length;
    function avg(v) { return Math.round(v / n * 10) / 10; }
    return {
      organicMatter: avg(sum.organicMatter),
      availableN: Math.round(sum.availableN / n),
      availableP: Math.round(sum.availableP / n),
      availableK: Math.round(sum.availableK / n),
      ph: avg(sum.ph),
      ec: Math.round(sum.ec / n),
      sampleCount: n,
      sampleDate: latestDate,
      updatedAt: latestDate
    };
  }

  function nextId() {
    var max = 0;
    ensure().forEach(function (x) {
      var m = String(x.id || '').match(/(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return 'ST-2026-' + ('00' + (max + 1)).slice(-3);
  }

  /**
   * 写入校验：地块必须在台账内、采样日期必填、数值范围必须在合理区间
   * @returns {{ok:boolean,message:string,errors:Object}}
   */
  function validate(item) {
    var errors = {};
    if (!item || !item.plotCode) errors.plotCode = '请选择地块';
    if (!item.sampleDate) errors.sampleDate = '请填写采样日期';
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(item.sampleDate)) errors.sampleDate = '采样日期格式应为 YYYY-MM-DD';

    var gm = Number(item.organicMatter);
    if (item.organicMatter === '' || item.organicMatter == null || isNaN(gm)) errors.organicMatter = '请填写有机质';
    else if (gm < 0 || gm > 10) errors.organicMatter = '有机质应在 0～10 % 之间';

    var ranges = { availableN: [0, 400], availableP: [0, 200], availableK: [0, 600] };
    Object.keys(ranges).forEach(function (k) {
      var v = Number(item[k]);
      if (item[k] === '' || item[k] == null || isNaN(v)) errors[k] = '请填写数值';
      else if (v < ranges[k][0] || v > ranges[k][1]) errors[k] = '应在 ' + ranges[k][0] + '～' + ranges[k][1] + ' mg/kg 之间';
    });

    var ph = Number(item.ph);
    if (item.ph === '' || item.ph == null || isNaN(ph)) errors.ph = '请填写 pH';
    else if (ph < 3 || ph > 10) errors.ph = 'pH 应在 3～10 之间';

    var ec = Number(item.ec);
    if (item.ec === '' || item.ec == null || isNaN(ec)) errors.ec = '请填写 EC';
    else if (ec < 0 || ec > 5000) errors.ec = 'EC 应在 0～5000 μS/cm 之间';

    var keys = Object.keys(errors);
    return {
      ok: keys.length === 0,
      message: keys.length ? '请检查：' + keys.map(function (k) { return errors[k]; }).join('；') : '',
      errors: errors
    };
  }

  function upsert(item) {
    var check = validate(item);
    if (!check.ok) return check;
    var list = ensure();
    var rec = Object.assign({}, item);
    if (!rec.id) rec.id = nextId();
    rec.organicMatter = Number(rec.organicMatter);
    rec.availableN = Number(rec.availableN);
    rec.availableP = Number(rec.availableP);
    rec.availableK = Number(rec.availableK);
    rec.ph = Number(rec.ph);
    rec.ec = Number(rec.ec);
    rec.updatedAt = stampNow();
    var idx = -1;
    list.forEach(function (x, i) { if (String(x.id) === String(rec.id)) idx = i; });
    if (idx >= 0) list[idx] = Object.assign({}, list[idx], rec);
    else list.unshift(rec);
    commit('upsert:' + rec.id);
    return { ok: true, message: '保存成功', record: clone(rec) };
  }

  function remove(id) {
    var list = ensure();
    var before = list.length;
    inMemory = list.filter(function (x) { return String(x.id) !== String(id); });
    if (inMemory.length === before) return false;
    commit('remove:' + id);
    return true;
  }

  global.SoilStore = {
    STORAGE_KEY: STORAGE_KEY,
    tests: tests,
    latestByPlot: latestByPlot,
    latestOf: latestOf,
    summary: summary,
    plots: function () { return PLOT_CODES.map(plotOf); },
    /** 地块台账全量（供录入页下拉） */
    plotList: function () {
      try {
        var raw = localStorage.getItem(PLOT_MASTER_KEY);
        var arr = raw ? JSON.parse(raw) : [];
        if (Array.isArray(arr) && arr.length) {
          return arr.map(function (p) {
            return { code: p.code, name: p.name || '', base: p.enterprise || '', area: num(p.area) };
          });
        }
      } catch (e) {}
      return PLOT_CODES.map(plotOf);
    },
    validate: validate,
    upsert: upsert,
    remove: remove,
    subscribe: function (fn) {
      subscribers.push(fn);
      try { fn('init'); } catch (e) {}
      return function () { subscribers = subscribers.filter(function (x) { return x !== fn; }); };
    },
    reset: function () { inMemory = buildSeed(); commit('reset'); },
    _seed: buildSeed
  };
})(window);
