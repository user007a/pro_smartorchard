/**
 * 消费者 H5 · 溯源展示环节数据层
 * --------------------------------------------------------------
 * 严格空库模式：环节清单来自后端 sf_trace_stage（resource='trace_stage'），
 * 不再读写 localStorage、不内置默认播种。DEFAULT 仅作为渲染兜底（无后端数据时）。
 *
 * 环节 key 为固定 7 值之一：
 *   planting 种植管理 / pruning 修剪疏果 / bagging 套袋保护 / fertilizer 施肥喷药
 *   testing 农残检测 / harvest 采摘入库 / coldchain 冷链配送
 *
 * 暴露 API（签名与既有 H5 页面保持一致）：
 *   TraceStages.ready          Promise，初始化完成
 *   TraceStages.all()          全部环节（按 order 排序）
 *   TraceStages.onSale()       启用中的环节（enabled ≠ false）
 *   TraceStages.get(key)       按 key 取环节
 *   TraceStages.subscribe(fn)  订阅环节变更
 *   TraceStages.esc(s)         HTML 转义
 *   TraceStages.DEFAULT        内置兜底清单
 */
(function (global) {
  'use strict';

  /* 渲染兜底（后端无数据时保留环节视觉结构，不落库） */
  var DEFAULT_STAGES = [
    { key: 'planting',   name: '种植管理', title: '种植管理', icon: '🌱', img: 'images/trace_planting.jpg',   desc: 'A1区花牛苹果果园，有机种植，施用有机肥', enabled: true, order: 1 },
    { key: 'pruning',    name: '修剪疏果', title: '修剪疏果', icon: '✂️', img: 'images/trace_pruning.jpg',    desc: '采用开心形整形，去除过密枝条，保证通风透光', enabled: true, order: 2 },
    { key: 'bagging',    name: '套袋保护', title: '套袋保护', icon: '🛡️', img: 'images/trace_bagging.jpg',    desc: '使用双层纸袋套袋，防止虫害和农药污染', enabled: true, order: 3 },
    { key: 'fertilizer', name: '施肥喷药', title: '施肥喷药', icon: '🌿', img: 'images/trace_fertilizer.jpg', desc: '使用生物有机肥和绿色农药，确保果实安全', enabled: true, order: 4 },
    { key: 'testing',    name: '农残检测', title: '农残检测', icon: '🔬', img: 'images/trace_testing.jpg',    desc: '采摘前第三方农残检测，全部指标未检出', enabled: true, order: 5 },
    { key: 'harvest',    name: '采摘入库', title: '采摘入库', icon: '🍎', img: 'images/trace_harvest.jpg',    desc: '人工采摘，精选一级果，全程冷链保鲜', enabled: true, order: 6 },
    { key: 'coldchain',  name: '冷链配送', title: '冷链配送', icon: '🚚', img: 'images/trace_coldchain.jpg',  desc: '全程冷链配送，运输温度维持 2-8°C', enabled: true, order: 7 }
  ];

  var VALID_KEYS = DEFAULT_STAGES.map(function (s) { return s.key; });

  var subs = [];
  var cache = null;
  var loadPromise = null;

  /* 后端 sf_trace_stage 行（snake_case）→ H5 环节结构 */
  function fromRow(r) {
    var title = String(r.stageName || r.stage_name || r.name || '');
    return {
      key: r.stageCode || r.stage_code || r.key,
      title: title,
      name: title,
      icon: String(r.stageIcon || r.stage_icon || r.icon || ''),
      img: '',
      desc: String(r.stageDesc || r.stage_desc || r.desc || ''),
      enabled: !(r.status === 'off' || r.status === 'inactive'),
      order: Number(r.sortOrder || r.sort_order || r.order) || 0
    };
  }

  function normalize(list) {
    if (!Array.isArray(list)) return null;
    var out = list.map(function (s) { return fromRow(s); })
      .filter(function (s) { return s && s.key && VALID_KEYS.indexOf(s.key) >= 0; });
    out.sort(function (a, b) { return a.order - b.order; });
    return out.length ? out : null;
  }

  function H5Data() { return global.H5Data; }

  function load() {
    if (loadPromise) return loadPromise;
    var d = H5Data();
    loadPromise = (d && typeof d.list === 'function')
      ? d.list('trace_stage')
      : Promise.resolve([]);
    loadPromise = loadPromise.then(function (list) {
      cache = normalize(list);
      emit();
      return all();
    }).catch(function () {
      cache = null;
      return all();
    });
    return loadPromise;
  }

  function all() {
    if (cache) return cache;
    /* 后端无数据时回退兜底清单（仅内存，不落库） */
    return DEFAULT_STAGES.map(function (s) {
      var o = Object.assign({}, s);
      o.title = s.name;
      return o;
    });
  }

  function emit() {
    subs.forEach(function (fn) {
      try { fn(all()); } catch (e) { /* 单个订阅异常不影响其他 */ }
    });
  }

  global.TraceStages = {
    KEY: 'trace_stage',
    DEFAULT: DEFAULT_STAGES,
    all: all,
    onSale: function () {
      return all().filter(function (s) { return s.enabled !== false; });
    },
    get: function (key) {
      var list = all();
      for (var i = 0; i < list.length; i++) {
        if (list[i].key === key) return list[i];
      }
      return null;
    },
    subscribe: function (fn) {
      if (typeof fn === 'function') subs.push(fn);
    },
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    ready: load()
  };
})(window);
