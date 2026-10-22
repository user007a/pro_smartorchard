/* ============================================================
 * h5-auth.js — H5 消费者端统一登录态与未登录拦截
 *
 * 数据源（与既有 H5 页面保持一致，不新增 key）：
 *   sessionStorage['isLoggedIn']  登录标记 'true'
 *   sessionStorage['loginUser']   登录用户名
 *   sessionStorage['loginRole']   角色（普通会员）
 *   sessionStorage['loginUserProfile']  { phone, registered }
 *   localStorage['smartorchard_current_user'] { name, role, phone, loginAt }
 *
 * 原型无后端，凭据校验在本机完成；生产环境须改为服务端校验并由服务端颁发令牌。
 * ============================================================ */
window.H5Auth = (function () {
  var PROFILE_KEY = 'loginUserProfile';
  var CURRENT_USER_KEY = 'smartorchard_current_user';

  function readSession(key) {
    try { return sessionStorage.getItem(key) || ''; } catch (e) { return ''; }
  }
  function writeSession(key, value) {
    try { sessionStorage.setItem(key, value); } catch (e) { /* 隐私模式忽略 */ }
  }
  function dropSession(key) {
    try { sessionStorage.removeItem(key); } catch (e) {}
  }

  /* ---------- 登录态读取 ---------- */

  /** 是否已登录（以 isLoggedIn + loginUser 双条件为准，避免脏标记） */
  function isLoggedIn() {
    return readSession('isLoggedIn') === 'true' && !!readSession('loginUser');
  }

  /** 当前登录用户名；未登录返回空串 */
  function currentUser() {
    return isLoggedIn() ? readSession('loginUser') : '';
  }

  /** 当前登录用户资料（手机号、注册时间等） */
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

  /* ---------- 登录态写入 / 清除 ---------- */

  /**
   * 写入登录态
   * @param {string} user  用户名（同时作为 C 端订单/地址归属标识）
   * @param {object} [info] { phone, role, nickname, registered }
   */
  function login(user, info) {
    info = info || {};
    var phone = info.phone || '';
    writeSession('isLoggedIn', 'true');
    writeSession('loginUser', user);
    writeSession('loginRole', info.role || '普通会员');

    var merged = profile();
    if (phone) merged.phone = phone;
    if (info.nickname) merged.nickname = info.nickname;
    merged.registered = merged.registered || info.registered ||
      new Date().toISOString().slice(0, 10);
    writeSession(PROFILE_KEY, JSON.stringify(merged));

    try {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({
        name: user,
        role: info.role || '普通会员',
        phone: phone,
        loginAt: new Date().toISOString()
      }));
    } catch (e) { /* 隐私模式忽略 */ }
  }

  /** 清除登录态（保留订单/地址/收藏等业务数据） */
  function logout() {
    ['isLoggedIn', 'loginUser', 'loginRole', PROFILE_KEY].forEach(dropSession);
    try { localStorage.removeItem(CURRENT_USER_KEY); } catch (e) {}
  }

  /* ---------- 未登录拦截 ---------- */

  /** 当前页面文件名（不含路径与 query） */
  function currentPage() {
    var path = location.pathname.split('/').pop();
    return path || 'index.html';
  }

  /**
   * 页面级未登录拦截：未登录时跳转登录页并带上回跳地址。
   * 用法：在 <head> 内同步引入本脚本后调用 H5Auth.require();
   */
  function require() {
    if (isLoggedIn()) return true;
    redirectToLogin();
    return false;
  }

  /**
   * 操作级未登录拦截（下单、结算、发布动态等）。
   * 返回 true 表示已放行；false 表示已跳转登录页，调用方应立即 return。
   */
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
    // 只允许站内相对路径，禁止 //host 与绝对 URL 造成的开放重定向
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
    displayName: displayName,
    maskedPhone: maskedPhone,
    profile: profile,
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