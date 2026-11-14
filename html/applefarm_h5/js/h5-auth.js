/* ============================================================
 * h5-auth.js — H5 消费者端统一登录态与未登录拦截
 *
 * 数据源（严格空库模式）：
 *   登录态 = 后端签发的 smartorchard_token（由 common/js/api.js 管理）。
 *   会话快照（昵称/手机号/等级）在登录成功后写入 sessionStorage，
 *   仅供本会话内的 profile()/displayName()/maskedPhone() 同步读取；
 *   会员档案（积分/等级等）由后端 sf_mall_member 提供，见 H5Auth.fetchMember()。
 *
 * 保留 localStorage 键：
 *   smartorchard_token   —— 登录令牌（Api 自动管理）
 * 不再使用业务键 localStorage（订单/地址/购物车/收藏等一律走后端 API）。
 * ============================================================ */
window.H5Auth = (function () {
  'use strict';

  var PROFILE_KEY = 'loginUserProfile';
  var TOKEN_KEY = 'smartorchard_token';

  /* 依赖加载：确保 window.Api 可用（登录与令牌管理都走 Api） */
  var depsReady = (function ensureApi() {
    if (typeof document === 'undefined') return Promise.resolve();
    if (typeof window.Api === 'object' || typeof window.Api === 'function') return Promise.resolve();
    var selfEl = document.currentScript;
    var baseDir = selfEl && selfEl.src ? selfEl.src.replace(/[^\/]*$/, '') : '';
    var src = baseDir + '../../common/js/api.js';
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = src; s.async = false; s.onload = resolve; s.onerror = resolve;
      (document.head || document.documentElement).appendChild(s);
    });
  })();

  function readSession(key) {
    try { return sessionStorage.getItem(key) || ''; } catch (e) { return ''; }
  }
  function writeSession(key, value) {
    try { sessionStorage.setItem(key, value); } catch (e) { /* 隐私模式忽略 */ }
  }
  function dropSession(key) {
    try { sessionStorage.removeItem(key); } catch (e) {}
  }
  function readToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }

  /* ---------- 登录态读取 ---------- */

  /** 是否已登录：优先 Api.isLoggedIn()（持有后端 token），降级读 token */
  function isLoggedIn() {
    if (typeof window.Api === 'object' && typeof window.Api.isLoggedIn === 'function') {
      return window.Api.isLoggedIn();
    }
    return !!readToken();
  }

  /** 当前登录用户名；未登录返回空串 */
  function currentUser() {
    return isLoggedIn() ? (profile().nickname || readSession('loginUser') || profile().phone || '') : '';
  }

  /** 当前登录用户资料（手机号、昵称、等级等，登录时由后端响应快照） */
  function profile() {
    try { return JSON.parse(readSession(PROFILE_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }

  /** 展示名：优先资料昵称，其次用户名 */
  function displayName() {
    var p = profile();
    return p.nickname || currentUser() || '';
  }

  /** 脱敏手机号，未登录返回空串 */
  function maskedPhone() {
    var p = profile();
    var phone = p.phone || '';
    if (phone.length === 11) return phone.substr(0, 3) + '****' + phone.substr(7);
    return phone;
  }

  /** 当前会员 id（来自登录快照）；未登录返回 null */
  function memberId() {
    var p = profile();
    return p.memberId != null ? p.memberId : null;
  }

  /** 异步获取后端会员档案（sf_mall_member），用于积分/等级等实时数据 */
  function fetchMember() {
    return depsReady.then(function () {
      if (typeof window.Api !== 'object' || !window.Api.get) return Promise.resolve(null);
      var mid = memberId();
      var phone = profile().phone || '';
      if (!mid && !phone) return Promise.resolve(null);
      if (mid) {
        return window.Api.get('mall_member', { size: 500 }).then(function (r) {
          var list = (r && r.ok && r.data && r.data.list) || [];
          for (var i = 0; i < list.length; i++) {
            if (String(list[i].id) === String(mid)) return list[i];
          }
          return null;
        });
      }
      return window.Api.get('mall_member', { phone: phone, size: 10 }).then(function (r) {
        var list = (r && r.ok && r.data && r.data.list) || [];
        return list[0] || null;
      });
    });
  }

  /* ---------- 登录态写入 / 清除 ---------- */

  /**
   * 登录：调用后端 H5 会员登录接口，成功后 token 由 Api 自动写入
   * smartorchard_token；本方法把昵称/手机号/等级快照到 sessionStorage。
   * @param {string} user    登录手机号
   * @param {object} [info]  { phone, password, nickname, role, level }
   * @returns {Promise<{ok:boolean,message?:string,data?:object}>}
   */
  function login(user, info) {
    info = info || {};
    var phone = info.phone || user || '';
    var password = info.password || '';

    return depsReady.then(function () {
      if (typeof window.Api !== 'object' || typeof window.Api.memberLogin !== 'function') {
        return { ok: false, message: '登录服务未就绪，请刷新后重试' };
      }
      return window.Api.memberLogin({ phone: phone, password: password }).then(function (r) {
        if (r && r.ok) {
          var u = (r.data && r.data.user) || {};
          var merged = {
            phone: u.phone || phone,
            nickname: u.nickname || info.nickname || '',
            level: u.level || info.level || 'normal',
            memberId: u.id != null ? u.id : null
          };
          writeSession('isLoggedIn', 'true');
          writeSession('loginUser', merged.nickname || phone);
          writeSession('loginRole', info.role || '普通会员');
          writeSession(PROFILE_KEY, JSON.stringify(merged));
        }
        return r || { ok: false, message: '登录失败' };
      });
    });
  }

  /** 清除登录态（token + 会话快照；业务数据保留在后端） */
  function logout() {
    if (typeof window.Api === 'object' && typeof window.Api.logout === 'function') {
      try { window.Api.logout(); } catch (e) { /* 忽略 */ }
    } else {
      try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
    }
    ['isLoggedIn', 'loginUser', 'loginRole', PROFILE_KEY].forEach(dropSession);
  }

  /* ---------- 未登录拦截 ---------- */

  /** 当前页面文件名（不含路径与 query） */
  function currentPage() {
    var path = location.pathname.split('/').pop();
    return path || 'index.html';
  }

  /** 页面级未登录拦截：未登录时跳转登录页并带上回跳地址 */
  function require() {
    if (isLoggedIn()) return true;
    redirectToLogin();
    return false;
  }

  /** 操作级未登录拦截（下单、结算、发布动态等） */
  function requireAction(message) {
    if (isLoggedIn()) return true;
    redirectToLogin(message);
    return false;
  }

  /** 跳转登录页；传入 message 时在登录页顶部提示 */
  function redirectToLogin(message) {
    var back = currentPage() + location.search;
    var url = 'h5_login.html?redirect=' + encodeURIComponent(back);
    if (message) url += '&reason=' + encodeURIComponent(message);
    location.replace(url);
  }

  /** 读取登录页传来的回跳地址，缺省回商城首页 */
  function consumeRedirect(fallback) {
    var params = new URLSearchParams(location.search);
    var back = params.get('redirect') || fallback || 'h5_store.html';
    if (/^https?:/i.test(back) || back.indexOf('//') === 0) back = fallback || 'h5_store.html';
    if (!/\.html(\?|$)/.test(back)) back = 'h5_store.html';
    return back;
  }

  /** 读取登录页传来的提示文案 */
  function consumeReason() {
    try {
      return new URLSearchParams(location.search).get('reason') || '';
    } catch (e) { return ''; }
  }

  return {
    isLoggedIn: isLoggedIn,
    currentUser: currentUser,
    getCurrentUser: currentUser,
    displayName: displayName,
    maskedPhone: maskedPhone,
    profile: profile,
    memberId: memberId,
    fetchMember: fetchMember,
    login: login,
    logout: logout,
    require: require,
    requireAction: requireAction,
    redirectToLogin: redirectToLogin,
    consumeRedirect: consumeRedirect,
    consumeReason: consumeReason
  };
})();

/* ============================================================
 * 跨页拦截约定
 *   1. h5_login.html 自身不拦截；
 *   2. 游客可读页面（首页 / 商城 / 溯源 / 社区浏览）不加门禁，仅在「我的」提示登录；
 *   3. 需登录的页面在 <head> 内同步引入本脚本并调用 H5Auth.require()。
 * ============================================================ */