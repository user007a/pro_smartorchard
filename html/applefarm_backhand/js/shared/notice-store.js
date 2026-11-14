/**
 * NoticeStore — 系统通知共享数据层
 * --------------------------------------------------------------
 * 系统设置「系统通知」tab 维护，首页「系统通知」面板展示，
 * 桥接后端 sf_system_notice 表（唯一键 notice_code）。
 * 存储 key：smartorchard_system_notice_v1（严格模式下仅内存镜像）
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'smartorchard_system_notice_v1';
  var VERSION = 1;

  /* 后端桥接依赖自动加载 */
  var depsReady = (function ensureDeps() {
    if (typeof document === 'undefined') return Promise.resolve();
    var selfEl = document.currentScript;
    if (!selfEl || !selfEl.src) return Promise.resolve();
    var baseDir = selfEl.src.replace(/[^\/]*$/, '');
    var deps = [
      { name: 'Api', src: baseDir + '../../../common/js/api.js' },
      { name: 'NoticeMapper', src: baseDir + 'notice-mapper.js' }
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
  /* 本 store 局部写入标记：竞态守卫只看自身写入，避免首页多 store 共享全局计数器互相误丢预加载 */
  var localWriteMark = 0;
  var persistTimer = null;
  var inMemory = null;
  var subscribers = [];
  /* 删除必须显式上报 deleted 清单，后端才触发逻辑删除 */
  var pendingDeletes = [];

  function backendApi() {
    if (typeof global.Api !== 'object' && typeof global.Api !== 'function') return null;
    if (!global.Api.get || !global.Api.create) return null;
    if (typeof global.NoticeMapper === 'undefined') return null;
    return global.Api;
  }
  function backendEnabled() {
    var api = backendApi();
    if (!api) return false;
    try { return !!api.isLoggedIn(); } catch (e) { return false; }
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function stampNow() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' +
      pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }
  function load() {
    try { var raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function save() {
    global.__STRICT_DB_INTERNAL_WRITE__ = true;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemory)); } catch (e) {}
    finally { global.__STRICT_DB_INTERNAL_WRITE__ = false; }
  }

  function ensure() {
    if (inMemory) return inMemory;
    var stored = load();
    inMemory = (stored && Array.isArray(stored)) ? stored : [];
    if (!stored) save();
    preloadFromBackend();
    return inMemory;
  }

  function preloadFromBackend() {
    var writeMark0 = localWriteMark;
    if (backendLoadPromise) return backendLoadPromise;
    backendLoadPromise = Promise.resolve(depsReady).then(function () {
      var api = backendApi();
      if (!api || !api.isLoggedIn || !api.isLoggedIn()) return { ok: false, message: '未登录或依赖未就绪' };
      return api.get('notice/aggregate');
    }).then(function (res) {
      if (res && res.ok && res.data) {
        // 严格模式：预加载在途期间本 store 有过本地写入，保留本地结果，避免陈旧快照覆盖
        if (localWriteMark !== writeMark0) return res;
        var agg = global.NoticeMapper.toAggregate(res.data);
        inMemory = agg.notices || [];
        save();
        notify('backend-loaded');
      }
      return res;
    }).catch(function (err) {
      console.warn('[NoticeStore] 后端预加载失败', err);
      return { ok: false, message: err && err.message };
    });
    return backendLoadPromise;
  }

  function persistToBackend() {
    var api = backendApi();
    if (!api || !backendEnabled()) return Promise.resolve({ ok: false, message: '未登录或依赖未就绪' });
    var sent = pendingDeletes.slice();
    var body = global.NoticeMapper.fromAggregate({ notices: ensure(), deleted: { notices: sent } });
    return api.create('notice/aggregate', body).then(function (res) {
      if (res && res.ok) {
        pendingDeletes = pendingDeletes.filter(function (code) { return sent.indexOf(code) === -1; });
      }
      return res;
    });
  }
  function schedulePersist(reason) {
    if (!backendEnabled()) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      persistTimer = null;
      persistToBackend().catch(function (e) { console.warn('[NoticeStore] 后端持久化失败', e); });
    }, 300);
  }

  function notify(reason) {
    subscribers.forEach(function (fn) { try { fn(reason); } catch (e) {} });
    try { global.dispatchEvent(new CustomEvent('noticeStoreChange', { detail: { reason: reason } })); } catch (e) {}
  }
  function commit(reason) {
    global.__STRICT_DB_WRITES__ = (global.__STRICT_DB_WRITES__ || 0) + 1;
    localWriteMark++;
    save();
    notify(reason || 'change');
    if (reason !== 'backend-loaded') schedulePersist(reason);
    return true;
  }

  var api = {
    STORAGE_KEY: STORAGE_KEY,
    VERSION: VERSION,
    notices: function () { return clone(ensure()); },
    notice: function (code) {
      var n = ensure().find(function (x) { return x.code === code || x.id === code; });
      return n ? clone(n) : null;
    },
    saveNotice: function (item) {
      if (!item || !item.title || !String(item.title).trim()) return { ok: false, message: '请填写通知标题' };
      var d = ensure();
      var code = item.code || item.id || ('SN-' + Date.now());
      var idx = d.findIndex(function (x) { return x.code === code || x.id === code; });
      var prev = idx >= 0 ? d[idx] : null;
      var row = {
        id: code, code: code,
        title: String(item.title).trim(),
        content: item.content || '',
        type: item.type || '',
        status: item.status || 'active',
        createdAt: (prev && prev.createdAt) || stampNow(),
        updatedAt: stampNow(),
      };
      if (idx >= 0) d[idx] = row; else d.unshift(row);
      commit('notice');
      return { ok: true, notice: clone(row) };
    },
    removeNotice: function (code) {
      var d = ensure();
      var target = d.find(function (x) { return x.code === code || x.id === code; });
      if (!target) return { ok: false, message: '通知不存在' };
      inMemory = d.filter(function (x) { return x !== target; });
      if (pendingDeletes.indexOf(target.code) === -1) pendingDeletes.push(target.code);
      commit('notice');
      return { ok: true };
    },
    reload: function () {
      backendLoadPromise = null;
      return preloadFromBackend();
    },
    subscribe: function (fn) {
      if (typeof fn === 'function') subscribers.push(fn);
      return function () { subscribers = subscribers.filter(function (x) { return x !== fn; }); };
    },
  };

  global.NoticeStore = api;
  ensure();
})(window);