/**
 * api.js — 统一后端请求封装
 * --------------------------------------------------------------
 * 提供给所有端（后台 / H5 / 移动端）共享的 fetch 封装，
 * 替代原型中 localStorage 读写，对接 server/ 后端 REST 接口。
 *
 * 用法：
 *   Api.get('device', { page: 1, size: 20 })
 *   Api.getOne('device', 3)
 *   Api.create('device', { name: '...' })
 *   Api.update('device', 3, { status: 'offline' })
 *   Api.remove('device', 3)
 *   Api.login({ username, password })            // 后台
 *   Api.mobileLogin({ account, password })       // 移动端
 *   Api.memberLogin({ phone, password })         // H5 会员
 *   Api.dicts()                                  // 字典
 */
(function (global) {
  'use strict';

  /* ============================================================
   * 严格空库模式 · 后台端本地业务数据闸门
   * ------------------------------------------------------------
   * 目的：保证「页面显示的内容」严格等于「数据库里的内容」。
   *
   * 做法：后台管理端（含 iframe 子页）把业务数据的 localStorage
   * 读写「重定向」到一份仅存在于当前页面生命周期的内存镜像：
   *   - 刷新页面后镜像清空，数据只能由后端 API 重新拉取；
   *   - 运行时的增删改依旧即时生效（不破坏页面功能）；
   *   - 首次加载时清理磁盘上历史遗留的演示数据，避免旧缓存
   *     掩盖真实接口行为，从而影响业务驱动测试的判断。
   *
   * 放行：鉴权 token、会话信息、用户偏好等纯客户端状态（仍落磁盘）。
   * sessionStorage 不受影响；H5 / 移动端 / 大屏也不受影响。
   * ============================================================ */
  (function enableStrictDbGuard() {
    if (typeof global.Storage === 'undefined' || !global.localStorage || !global.location) return;
    if (!/\/(applefarm_backhand|applefarm_mobile|applefarm_h5|applefarm_dataanlye)\//.test(global.location.pathname)) return;
    if (global.__STRICT_DB_GUARD__) return;
    global.__STRICT_DB_GUARD__ = true;

    var ALLOW_EXACT = [
      'smartorchard_token', 'snzg_logged_in', 'snzg_user',
      'snzg_remember', 'snzg_login_lock', 'snzg_notification', 'snzg_2fa',
      /* 纯 UI 偏好：不产生业务记录，允许落盘以保留界面状态 */
      'sidebar-collapsed', 'sidebar-tabs'
    ];
    var ALLOW_PREFIX = ['snzg_avatar_', 'snzg_alert_'];
    function allowed(key) {
      var k = String(key);
      if (ALLOW_EXACT.indexOf(k) >= 0) return true;
      for (var i = 0; i < ALLOW_PREFIX.length; i++) {
        if (k.indexOf(ALLOW_PREFIX[i]) === 0) return true;
      }
      return false;
    }

    var proto = global.Storage.prototype;
    var rawGet = proto.getItem;
    var rawSet = proto.setItem;
    var rawRemove = proto.removeItem;
    var rawKey = proto.key;
    var memory = Object.create(null); // 本页生命周期内的业务数据镜像

    // 一次性清理磁盘上历史遗留的本地业务数据（用原生方法，绕过闸门）
    try {
      var stale = [];
      for (var i = 0; i < global.localStorage.length; i++) {
        var k = rawKey.call(global.localStorage, i);
        if (k && !allowed(k)) stale.push(k);
      }
      stale.forEach(function (k) { rawRemove.call(global.localStorage, k); });
      if (stale.length) {
        try { console.info('[严格模式] 已清理历史本地业务数据 ' + stale.length + ' 项'); } catch (ignore) {}
      }
    } catch (e) { /* 隐私模式下忽略 */ }

    // 业务键：只读写内存镜像，不再落磁盘
    proto.getItem = function (key) {
      if (this === global.localStorage && !allowed(key)) {
        return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
      }
      return rawGet.call(this, key);
    };
    proto.setItem = function (key, value) {
      if (this === global.localStorage && !allowed(key)) {
        memory[key] = String(value);
        // 记录「本地业务写入」次数：供各 store 的预加载做竞态判断，
        // 避免页面加载时的陈旧后端快照覆盖用户刚保存的数据。
        //
        // 注意：store 自身的内部落盘（save() 把内存快照写回本地）也会经过
        // 这里，若一并计数，预加载回来时会误判「用户在途写过数据」而放弃
        // 后端快照 —— 表现为「库里明明有数据，页面却是空的」。
        // 因此 store 落盘时会置 __STRICT_DB_INTERNAL_WRITE__ 标记，
        // 标记期间的写入不计入竞态计数。
        if (!global.__STRICT_DB_INTERNAL_WRITE__) {
          global.__STRICT_DB_WRITES__ = (global.__STRICT_DB_WRITES__ || 0) + 1;
        }
        return;
      }
      return rawSet.call(this, key, value);
    };
    proto.removeItem = function (key) {
      if (this === global.localStorage && !allowed(key)) {
        delete memory[key];
        return;
      }
      return rawRemove.call(this, key);
    };
    global.__STRICT_DB_ALLOWED__ = allowed;
  })();

  var BASE_URL = global.SMARTORCHARD_API_BASE || '/api';
  var TOKEN_KEY = 'smartorchard_token';

  /* ============================================================
   * Store 变更订阅助手（StoreLive）
   * ------------------------------------------------------------
   * 各数据层（Store）在「后端数据异步到达」与「本地写入」两条路径上
   * 都会派发 `<store>StoreChange` 窗口事件。页面若不监听，首次渲染
   * 发生在数据到达之前，界面就会一直停在空列表，必须手动刷新。
   *
   * 用法：
   *   StoreLive.on('salesStoreChange', refreshAll);
   *   StoreLive.on(['soilStoreChange', 'plotStoreChange'], refresh);
   *
   * 约定：
   *   - 回调异常不影响其它订阅者；
   *   - 重复订阅同一「事件 + 回调」组合会被忽略，避免重复渲染。
   *
   * 本文件是所有端的公共请求层，各端 store 均依赖它，故助手挂在此处，
   * 保证「用到 store 的页面」一定具备该能力。
   * ============================================================ */
  var StoreLive = (function () {
    'use strict';
    var bound = Object.create(null);

    function on(events, handler) {
      if (typeof handler !== 'function') return;
      var list = Array.isArray(events) ? events : [events];
      list.forEach(function (ev) {
        if (!ev || bound[ev + '::' + handler]) return;
        bound[ev + '::' + handler] = 1;
        global.addEventListener(ev, function () {
          try {
            handler();
          } catch (e) {
            console.warn('[StoreLive] 订阅回调异常 @' + ev, e);
          }
        });
      });
    }

    return { on: on };
  })();
  global.StoreLive = StoreLive;


  /* ---------- token 管理 ---------- */
  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(token) {
    try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
  }
  function clearToken() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }

  /* ---------- 底层请求 ---------- */
  function request(method, path, body) {
    var url = BASE_URL + path;
    var options = {
      method: method,
      headers: { 'Content-Type': 'application/json' },
    };
    var token = getToken();
    if (token) options.headers['Authorization'] = 'Bearer ' + token;
    if (body !== undefined && body !== null) {
      options.body = JSON.stringify(body);
    }

    return fetch(url, options).then(function (resp) {
      return resp.json().catch(function () {
        return { ok: false, message: '响应解析失败（HTTP ' + resp.status + '）' };
      }).then(function (json) {
        if (resp.status === 401) {
          clearToken();
          json._unauthorized = true;
        }
        return json;
      });
    }).catch(function (err) {
      return { ok: false, message: '网络请求失败：' + err.message };
    });
  }

  function qs(params) {
    if (!params) return '';
    var parts = [];
    for (var k in params) {
      if (params[k] === undefined || params[k] === null || params[k] === '') continue;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
    }
    return parts.length ? '?' + parts.join('&') : '';
  }

  var Api = {
    /* ---------- 通用 CRUD ---------- */
    get: function (resource, params) {
      return request('GET', '/' + resource + qs(params));
    },
    getOne: function (resource, id) {
      return request('GET', '/' + resource + '/' + id);
    },
    create: function (resource, data) {
      return request('POST', '/' + resource, data);
    },
    update: function (resource, id, data) {
      return request('PUT', '/' + resource + '/' + id, data);
    },
    remove: function (resource, id) {
      return request('DELETE', '/' + resource + '/' + id);
    },

    /* ---------- 鉴权 ---------- */
    login: function (credentials) {
      return request('POST', '/auth/login', credentials).then(function (r) {
        if (r.ok && r.data && r.data.token) setToken(r.data.token);
        return r;
      });
    },
    mobileLogin: function (credentials) {
      return request('POST', '/auth/mobile-login', credentials).then(function (r) {
        if (r.ok && r.data && r.data.token) setToken(r.data.token);
        return r;
      });
    },
    memberLogin: function (credentials) {
      return request('POST', '/auth/member-login', credentials).then(function (r) {
        if (r.ok && r.data && r.data.token) setToken(r.data.token);
        return r;
      });
    },
    logout: function () {
      clearToken();
    },

    /**
     * 标记一段「内部落盘」：store 把内存快照写回 localStorage 时调用。
     *
     * 严格模式下业务数据不落磁盘，store 的内部保存只走内存镜像。
     * 但这类写入不应被当成「用户主动改数据」，否则 store 预加载的
     * 竞态守卫会误判并放弃后端快照（表现为「库里明明有数据，页面却是空的」）。
     *
     * store 与本文件均为动态注入，存在加载时序差，故这里直接操作全局标记位，
     * 不要求 store 依赖 Api 已就绪。
     *
     * 用法：Api.internalWrite(function () { localStorage.setItem(k, v); });
     */
    internalWrite: function (fn) {
      if (typeof fn !== 'function') return;
      var prev = global.__STRICT_DB_INTERNAL_WRITE__;
      global.__STRICT_DB_INTERNAL_WRITE__ = true;
      try {
        fn();
      } finally {
        global.__STRICT_DB_INTERNAL_WRITE__ = prev;
      }
    },

    /* ---------- 元数据 ---------- */
    dicts: function () {
      return request('GET', '/meta/dicts');
    },
    dict: function (code) {
      return request('GET', '/meta/dicts/' + code);
    },
    menus: function () {
      return request('GET', '/meta/menus');
    },

    /* ---------- token 工具 ---------- */
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
    isLoggedIn: function () { return !!getToken(); },
  };

  global.Api = Api;
  if (typeof module !== 'undefined' && module.exports) module.exports = Api;
})(typeof window !== 'undefined' ? window : globalThis);
