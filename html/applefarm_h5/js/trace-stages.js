/**
 * 消费者 H5 · 溯源展示环节数据层
 * --------------------------------------------------------------
 * 严格空库模式：环节清单与详情全部来自后端 sf_trace_stage（resource='trace_stage'），
 * 由后台「溯源配置 › C 端展示配置」维护；后端无数据时返回空数组，不内置任何环节。
 *
 * 暴露 API（签名与既有 H5 页面保持一致）：
 *   TraceStages.ready          Promise，初始化完成（成功时带环节数组）
 *   TraceStages.all()          全部环节（按 order 排序）
 *   TraceStages.onSale()       启用中的环节（enabled ≠ false）
 *   TraceStages.get(key)       按 key 取环节
 *   TraceStages.subscribe(fn)  订阅环节变更
 *   TraceStages.esc(s)         HTML 转义
 */
(function (global) {
  'use strict';

  /* 后端桥接（h5-data.js → common/js/api.js）按需注入：
     本脚本可能在 h5-data.js 之前被加载，因此不能依赖全局已就绪。 */
  var depsReady = (function ensureDeps() {
    if (typeof document === 'undefined') return Promise.resolve();
    if (global.H5Data) return Promise.resolve();
    var selfEl = document.currentScript;
    if (!selfEl || !selfEl.src) return Promise.resolve();
    var baseDir = selfEl.src.replace(/[^\/]*$/, '');
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = baseDir + 'h5-data.js';
      s.async = false;
      s.onload = resolve; s.onerror = resolve;
      (document.head || document.documentElement).appendChild(s);
    }).then(function () { return true; });
  })();

  var subs = [];
  var cache = null;
  var loadPromise = null;

  function text(v) { return v == null ? '' : String(v); }
  function pick(r, camel, snake) {
    return r[camel] != null ? r[camel] : (r[snake] != null ? r[snake] : '');
  }
  function splitTags(v) {
    if (Array.isArray(v)) return v.map(function (t) { return text(t).trim(); }).filter(Boolean);
    return text(v).split(/[,，;；]/).map(function (t) { return t.trim(); }).filter(Boolean);
  }

  /* 后端 sf_trace_stage 行 → H5 环节结构 */
  function fromRow(r) {
    r = r || {};
    var title = text(pick(r, 'stageName', 'stage_name') || r.name);
    var status = text(pick(r, 'status', 'status') || 'active');
    return {
      key: text(pick(r, 'stageCode', 'stage_code') || r.key),
      title: title,
      name: title,
      icon: text(pick(r, 'stageIcon', 'stage_icon') || r.icon),
      img: text(pick(r, 'stageImg', 'stage_img') || r.img),
      desc: text(pick(r, 'stageDesc', 'stage_desc') || r.desc),
      detail: text(pick(r, 'stageDetail', 'stage_detail')),
      operator: text(pick(r, 'stageOperator', 'stage_operator')),
      location: text(pick(r, 'stageLocation', 'stage_location')),
      tags: splitTags(pick(r, 'stageTags', 'stage_tags')),
      dayOffset: Number(pick(r, 'dayOffset', 'day_offset')) || 0,
      enabled: status !== 'off' && status !== 'inactive' && status !== 'disabled',
      order: Number(pick(r, 'sortOrder', 'sort_order') || r.order) || 0
    };
  }

  function normalize(list) {
    if (!Array.isArray(list)) return null;
    var out = list.map(fromRow).filter(function (s) { return s && s.key; });
    out.sort(function (a, b) { return a.order - b.order; });
    return out;
  }

  function load() {
    if (loadPromise) return loadPromise;
    loadPromise = depsReady.then(function () {
      var d = global.H5Data;
      return (d && typeof d.list === 'function') ? d.list('trace_stage') : [];
    }).then(function (list) {
      cache = normalize(list);
      emit();
      return all();
    }).catch(function () {
      cache = null;
      emit();
      return all();
    });
    return loadPromise;
  }

  function all() {
    return cache ? cache.slice() : [];
  }

  function emit() {
    subs.forEach(function (fn) {
      try { fn(all()); } catch (e) { /* 单个订阅异常不影响其他 */ }
    });
  }

  global.TraceStages = {
    KEY: 'trace_stage',
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
