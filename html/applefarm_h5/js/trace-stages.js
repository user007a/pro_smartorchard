/**
 * 消费者 H5 · 溯源展示环节数据层
 * --------------------------------------------------------------
 * 统一读取后台「溯源配置 - C 端展示配置」维护的环节清单（localStorage['h5_trace_stages']），
 * 后台未初始化时回退到内置默认清单，保证 H5 端可独立运行。
 *
 * 环节 key 为固定 7 值之一（与 h5_trace_detail.html 的详情内容一一对应，不可增删）：
 *   planting 种植管理 / pruning 修剪疏果 / bagging 套袋保护 / fertilizer 施肥喷药
 *   testing 农残检测 / harvest 采摘入库 / coldchain 冷链配送
 *
 * 暴露 API：
 *   TraceStages.ready          Promise，初始化完成
 *   TraceStages.all()          全部环节（按 order 排序）
 *   TraceStages.onSale()       启用中的环节（enabled ≠ false，按 order 排序）
 *   TraceStages.get(key)       按 key 取环节
 *   TraceStages.subscribe(fn)  订阅环节变更（含后台跨标签页更新）
 *   TraceStages.esc(s)         HTML 转义
 *   TraceStages.DEFAULT        内置默认清单
 */

(function (global) {
  'use strict';

  var KEY = 'h5_trace_stages';

  /* 与后台 trace_config.html「C端溯源展示」Tab 的 DEFAULT_CSTAGES 保持一致 */
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

  function normalize(list) {
    if (!Array.isArray(list)) return null;
    // 过滤非法 key，并按 order 升序
    var out = list.filter(function (s) {
      return s && typeof s === 'object' && VALID_KEYS.indexOf(s.key) >= 0;
    }).map(function (s) {
      // 后台「C 端溯源展示」写入的字段名为 title，此处兼容 name，保证两端字段名可互换
      var title = String(s.title || s.name || '');
      return {
        key: s.key,
        title: title,
        name: title,
        icon: String(s.icon || ''),
        img: String(s.img || ''),
        desc: String(s.desc || ''),
        enabled: s.enabled !== false,
        order: Number(s.order) || 0
      };
    });
    out.sort(function (a, b) { return a.order - b.order; });
    return out.length ? out : null;
  }

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return normalize(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }

  function all() {
    if (cache) return cache;
    var list = read();
    if (!list) {
      list = DEFAULT_STAGES.map(function (s) {
        var o = Object.assign({}, s);
        o.title = s.name;   // 与后台字段名对齐
        return o;
      });
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* 只读降级 */ }
    }
    cache = list;
    return cache;
  }

  function invalidate() {
    cache = null;
  }

  function emit() {
    invalidate();
    subs.forEach(function (fn) {
      try { fn(all()); } catch (e) { /* 单个订阅异常不影响其他 */ }
    });
  }

  global.addEventListener('storage', function (e) {
    if (e.key === KEY) emit();
  });

  global.TraceStages = {
    KEY: KEY,
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
    ready: Promise.resolve(all())
  };
})(window);