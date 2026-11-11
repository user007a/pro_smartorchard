/**
 * VrStore — VR全景共享数据层
 * --------------------------------------------------------------
 * 承载「VR全景」菜单的场景主数据，桥接后端 sf_vr_scene 表。
 * 存储 key： smartorchard_vr_scenes_v1
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'smartorchard_vr_scenes_v1';
  var VERSION = 1;

  /* 后端桥接依赖自动加载 */
  var depsReady = (function ensureDeps() {
    if (typeof document === 'undefined') return Promise.resolve();
    var selfEl = document.currentScript;
    if (!selfEl || !selfEl.src) return Promise.resolve();
    var baseDir = selfEl.src.replace(/[^\/]*$/, '');
    var deps = [
      { name: 'Api', src: baseDir + '../../../common/js/api.js' },
      { name: 'VrMapper', src: baseDir + 'vr-mapper.js' }
    ];
    var pending = deps.filter(function (d) { return !global[d.name]; });
    if (!pending.length) return Promise.resolve();
    return Promise.all(pending.map(function (d) {
      return new Promise(function (resolve) {
        var s = document.createElement('script');
        s.src = d.src; s.async = false; s.onload = resolve; s.onerror = resolve;
        (document.head || document.documentElement).appendChild(s);
      });
    })).then(function () { return true; });
  })();

  var backendLoadPromise = null;
  var persistTimer = null;
  var inMemory = null;
  var subscribers = [];

  function backendApi() {
    if (typeof global.Api !== 'object' && typeof global.Api !== 'function') return null;
    if (!global.Api.get || !global.Api.create) return null;
    if (typeof global.VrMapper === 'undefined') return null;
    return global.Api;
  }
  function backendEnabled() {
    var api = backendApi();
    if (!api) return false;
    try { return !!api.isLoggedIn(); } catch (e) { return false; }
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load() {
    try { var raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemory)); return true; } catch (e) { return false; } }

  /* 种子（从后端加载为空时的兜底） */
  function seed() { return []; }

  function ensure() {
    if (inMemory) return inMemory;
    var stored = load();
    inMemory = (stored && Array.isArray(stored)) ? stored : seed();
    if (!stored) save();
    if (typeof depsReady !== 'undefined') preloadFromBackend();
    return inMemory;
  }

  function preloadFromBackend() {
    if (backendLoadPromise) return backendLoadPromise;
    backendLoadPromise = Promise.resolve(depsReady).then(function () {
      var api = backendApi();
      if (!api || !api.isLoggedIn || !api.isLoggedIn()) return { ok: false, message: '未登录或依赖未就绪' };
      return api.get('vr/aggregate');
    }).then(function (res) {
      if (res && res.ok && res.data) {
        var agg = global.VrMapper.toAggregate(res.data);
        if (agg.scenes && agg.scenes.length) { inMemory = agg.scenes; save(); notify('backend-loaded'); }
      }
      return res;
    }).catch(function (err) {
      console.warn('[VrStore] 后端预加载失败，降级 localStorage', err);
      return { ok: false, message: err && err.message };
    });
  }
  function persistToBackend() {
    var api = backendApi();
    if (!api || !backendEnabled()) return Promise.resolve({ ok: false, message: '未登录或依赖未就绪' });
    var body = global.VrMapper.fromAggregate({ scenes: ensure(), deleted: {} });
    return api.create('vr/aggregate', body);
  }
  function schedulePersist(reason) {
    if (!backendEnabled()) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      persistTimer = null;
      persistToBackend().catch(function (e) { console.warn('[VrStore] 后端持久化失败', e); });
    }, 300);
  }

  function notify(reason) {
    subscribers.forEach(function (fn) { try { fn(reason); } catch (e) {} });
    try { global.dispatchEvent(new CustomEvent('vrStoreChange', { detail: { reason: reason } })); } catch (e) {}
  }
  function commit(reason) {
    save();
    notify(reason || 'change');
    if (typeof schedulePersist === 'function' && reason !== 'backend-loaded') schedulePersist(reason);
    return true;
  }

  var api = {
    STORAGE_KEY: STORAGE_KEY,
    VERSION: VERSION,
    scenes: function () { return clone(ensure()); },
    scene: function (id) { var s = ensure().find(function (x) { return x.id === id || x.code === id; }); return s ? clone(s) : null; },
    saveScene: function (item) {
      var d = ensure();
      if (!item || !item.name) return { ok: false, message: '请填写场景名称' };
      var code = item.code || item.id;
      if (!code) code = 'VR-' + String(d.length + 1).padStart(3, '0');
      var idx = d.findIndex(function (x) { return x.code === code || x.id === code; });
      var row = Object.assign({ code: code, id: code }, item);
      if (idx >= 0) d[idx] = row; else d.unshift(row);
      commit('scene');
      return { ok: true, scene: clone(row) };
    },
    removeScene: function (id) {
      var d = ensure();
      var before = d.length;
      inMemory = d.filter(function (x) { return x.id !== id && x.code !== id; });
      if (inMemory.length === before) return { ok: false, message: '场景不存在' };
      commit('scene');
      return { ok: true };
    },
    subscribe: function (fn) { if (typeof fn === 'function') subscribers.push(fn); return function () { subscribers = subscribers.filter(function (x) { return x !== fn; }); }; },
    reset: function () { inMemory = seed(); commit('reset'); return clone(inMemory); }
  };

  global.VrStore = api;
  ensure();
})(window);
