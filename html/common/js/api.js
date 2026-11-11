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

  var BASE_URL = global.SMARTORCHARD_API_BASE || '/api';
  var TOKEN_KEY = 'smartorchard_token';

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
