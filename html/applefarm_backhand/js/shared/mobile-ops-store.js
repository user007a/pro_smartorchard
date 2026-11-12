/**
 * 移动端运营统一数据层
 * ------------------------------------------------------------------
 * 归口「移动端运营」三个分组（用户服务 / 消息与同步 / 智能与知识）背后的
 * 全部 localStorage 键，供后台 8 个页面、移动端作业页与 H5 消费者端共用：
 *
 *   feedbacks        意见反馈      smartorchard_feedbacks        移动端 mb_feedback / H5 h5_settings
 *   expertQuestions  专家咨询      smartorchard_expert_questions 移动端 mb_expert
 *   staff            作业人员账号  mb_staff_accounts             后台维护 / 移动端 mb_login 校验
 *   messages         消息推送      mb_messages                   后台维护 / 移动端 mb_home 消费
 *   news             资讯管理      mb_news                       后台维护 / 移动端 mb_home、mb_news 消费
 *   syncQueue        离线同步队列  smartorchard_sync_queue       移动端 MobileStore.enqueue
 *   aiConfig         AI 助手配置   mb_ai_config                  移动端 mb_ai_assistant 消费
 *   diseaseRules     识别规则      mb_disease_rules              移动端 mb_disease 消费
 *   faultKb          故障知识库    mb_fault_kb                   移动端 mb_troubleshoot 消费
 *   audit            操作审计      smartorchard_mobile_ops_audit 后台写操作留痕
 *
 * 设计约定：
 *   1. 读取时统一补齐 source / operator / createdAt 等公共字段（normalize），
 *      不要求历史数据先迁移；写入时由 store 统一落盘。
 *   2. 账号密码只落 SHA-256 摘要（pwdHash），兼容历史明文 pwd 登录。
 *   3. 同页写入即时广播，跨标签页通过 storage 事件同步，页面无需轮询。
 */
window.MobileOpsStore = (function () {
  'use strict';

  /* ============================================================
   * 后端桥接依赖自动加载（策略 A：出入口映射）
   * ============================================================ */
  var depsReady = (function ensureDeps() {
    if (typeof document === 'undefined') return Promise.resolve();
    var selfEl = document.currentScript;
    if (!selfEl || !selfEl.src) return Promise.resolve();
    var baseDir = selfEl.src.replace(/[^\/]*$/, '');
    var deps = [
      { name: 'Api', src: baseDir + '../../../common/js/api.js' },
      { name: 'MobileOpsMapper', src: baseDir + 'mobile-ops-mapper.js' }
    ];
    var pending = deps.filter(function (d) { return !window[d.name]; });
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

  function backendApi() {
    if (typeof window.Api !== 'object' && typeof window.Api !== 'function') return null;
    if (!window.Api.get || !window.Api.create) return null;
    if (typeof window.MobileOpsMapper === 'undefined') return null;
    return window.Api;
  }
  function backendEnabled() {
    var api = backendApi();
    if (!api) return false;
    try { return !!api.isLoggedIn(); } catch (e) { return false; }
  }
  function preloadFromBackend() {
    var writeMark0 = global.__STRICT_DB_WRITES__ || 0;
    if (backendLoadPromise) return backendLoadPromise;
    backendLoadPromise = Promise.resolve(depsReady).then(function () {
      var api = backendApi();
      if (!api || !api.isLoggedIn || !api.isLoggedIn()) return { ok: false, message: '未登录或依赖未就绪' };
      return api.get('mobile-ops/aggregate');
    }).then(function (res) {
      if (res && res.ok && res.data) {
        // 严格模式：预加载在途期间用户保存过数据，保留本地结果，避免陈旧快照覆盖
        if (typeof global.__STRICT_DB_WRITES__ === "number" && global.__STRICT_DB_WRITES__ !== writeMark0) return res;
        var agg = window.MobileOpsMapper.toAggregate(res.data);
        var map = {
          feedbacks: agg.feedbacks, expertQuestions: agg.expertQuestions, staff: agg.staff,
          messages: agg.messages, news: agg.news, syncQueue: agg.syncQueue,
          diseaseRules: agg.diseaseRules, faultKb: agg.faultKb,
        };
        Object.keys(map).forEach(function (k) {
          writeList(KEYS[k], map[k] || []);
        });
        if (true) { // 严格模式：空库也以后端结果为准
          writeObj(KEYS.aiConfig, { categories: agg.aiCategories || [], hotQuestions: agg.aiQuestions || [] });
        }
      }
      return res;
    }).catch(function (err) {
      console.warn('[MobileOpsStore] 后端预加载失败，降级 localStorage', err);
      return { ok: false, message: err && err.message };
    });
  }
  function persistToBackend() {
    var api = backendApi();
    if (!api || !backendEnabled()) return Promise.resolve({ ok: false, message: '未登录或依赖未就绪' });
    var ai = readObj(KEYS.aiConfig) || {};
    var agg = {
      feedbacks: readList(KEYS.feedbacks), expertQuestions: readList(KEYS.expertQuestions),
      staff: readList(KEYS.staff), messages: readList(KEYS.messages), news: readList(KEYS.news),
      syncQueue: readList(KEYS.syncQueue), diseaseRules: readList(KEYS.diseaseRules), faultKb: readList(KEYS.faultKb),
      aiCategories: ai.categories || [], aiQuestions: ai.hotQuestions || [], deleted: {},
    };
    var body = window.MobileOpsMapper.fromAggregate(agg);
    return api.create('mobile-ops/aggregate', body);
  }
  function schedulePersist(reason) {
    if (!backendEnabled()) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      persistTimer = null;
      persistToBackend().catch(function (e) { console.warn('[MobileOpsStore] 后端持久化失败', e); });
    }, 300);
  }

  var KEYS = {
    feedbacks: 'smartorchard_feedbacks',
    expertQuestions: 'smartorchard_expert_questions',
    staff: 'mb_staff_accounts',
    messages: 'mb_messages',
    news: 'mb_news',
    syncQueue: 'smartorchard_sync_queue',
    aiConfig: 'mb_ai_config',
    diseaseRules: 'mb_disease_rules',
    faultKb: 'mb_fault_kb',
    audit: 'smartorchard_mobile_ops_audit'
  };

  var SOURCE_TEXT = {
    mobile: '移动端',
    h5: 'H5消费者端',
    pc: 'PC后台',
    system: '系统生成'
  };

  /* 资讯分类字典（后台维护 / 移动端筛选共用） */
  var NEWS_CATEGORIES = ['notice', 'training', 'technology', 'policy'];

  var NEWS_CATEGORY_TEXT = {
    notice: '公告',
    training: '培训',
    technology: '技术',
    policy: '政策'
  };

  var CURRENT_USER_KEY = 'smartorchard_current_user';

  /* ================= 基础读写 ================= */

  function rawGet(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function rawSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      emit(key);
      if (typeof schedulePersist === 'function') schedulePersist(key);
      return true;
    } catch (e) {
      return false;
    }
  }

  function readList(key) {
    var v = rawGet(key);
    return Array.isArray(v) ? v : [];
  }

  function writeList(key, list) {
    return rawSet(key, Array.isArray(list) ? list : []);
  }

  function readObj(key) {
    var v = rawGet(key);
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null;
  }

  function writeObj(key, obj) {
    return rawSet(key, obj || {});
  }

  function nextId(list, prefix) {
    var max = 0;
    (list || []).forEach(function (it) {
      var n = parseInt(String(it && it.id).replace(/\D/g, ''), 10);
      if (isFinite(n) && n > max) max = n;
    });
    return prefix ? prefix + (max + 1) : max + 1;
  }

  function now() {
    var d = new Date();
    var p = function (n) { return n < 10 ? '0' + n : String(n); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  /* 支持传实体名（feedbacks）或真实键名（smartorchard_feedbacks） */
  function resolve(key) {
    return KEYS[key] || key;
  }

  function push(key, item, idPrefix) {
    key = resolve(key);
    var list = readList(key);
    var row = Object.assign({}, item);
    if (row.id == null || row.id === '') row.id = nextId(list, idPrefix);
    if (!row.createdAt) row.createdAt = now();
    if (!row.source) row.source = item.source || 'pc';
    if (!row.operator) row.operator = item.operator || operatorName();
    list.unshift(row);
    writeList(key, list);
    return row;
  }

  function patch(key, id, changes) {
    key = resolve(key);
    var list = readList(key);
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) {
        list[i] = Object.assign({}, list[i], changes, { updatedAt: now() });
        writeList(key, list);
        return list[i];
      }
    }
    return null;
  }

  function remove(key, id) {
    key = resolve(key);
    var list = readList(key);
    var next = list.filter(function (it) { return String(it.id) !== String(id); });
    if (next.length === list.length) return false;
    writeList(key, next);
    return true;
  }

  function findById(key, id) {
    key = resolve(key);
    var list = readList(key);
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return list[i];
    }
    return null;
  }

  /* ================= 操作人 / 订阅 / 审计 ================= */

  function currentUser() {
    try {
      return JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  function operatorName() {
    var u = currentUser();
    return (u && (u.name || u.nickname)) || '系统管理员';
  }

  var listeners = [];
  var storageBound = false;

  function emit(key) {
    listeners.forEach(function (fn) {
      try { fn(key); } catch (e) { /* 单个订阅者异常不影响其他订阅者 */ }
    });
    // 窗口事件：页面在未持有 Store 引用时也能感知数据变化并重绘
    try {
      global.dispatchEvent(new CustomEvent('mobileOpsStoreChange', { detail: { reason: key } }));
    } catch (e) { /* ignore */ }
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    if (!storageBound) {
      storageBound = true;
      window.addEventListener('storage', function (e) {
        if (e.key) emit(e.key);
      });
    }
    return function () {
      listeners = listeners.filter(function (f) { return f !== fn; });
    };
  }

  function audit(action, entity, targetId, detail) {
    var list = readList(KEYS.audit);
    list.unshift({
      id: nextId(list, 'LOG'),
      action: action,
      entity: entity,
      targetId: targetId == null ? '' : String(targetId),
      detail: detail || '',
      operator: operatorName(),
      time: now()
    });
    writeList(KEYS.audit, list.slice(0, 300));
  }

  /* ================= 密码摘要 ================= */

  /* SHA-256（ASCII），与 trace-store 同实现；仅用于原型内避免明文落盘 */
  function hashPwd(s) {
    s = String(s == null ? '' : s);
    function ror(x, n) { return (x >>> n) | (x << (32 - n)); }
    var h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
      h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    var bytes = [];
    for (var i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 0xff);
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    var bl = s.length * 8;
    bytes.push((bl >>> 24) & 0xff); bytes.push((bl >>> 16) & 0xff);
    bytes.push((bl >>> 8) & 0xff); bytes.push(bl & 0xff);
    var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    for (var off = 0; off < bytes.length; off += 64) {
      var w = [];
      for (var k = 0; k < 16; k++) {
        w[k] = (bytes[off + k * 4] << 24) | (bytes[off + k * 4 + 1] << 16) |
          (bytes[off + k * 4 + 2] << 8) | bytes[off + k * 4 + 3];
      }
      for (var j = 16; j < 64; j++) {
        var s0 = ror(w[j - 15], 7) ^ ror(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        var s1 = ror(w[j - 2], 17) ^ ror(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      var a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, hh = h7;
      for (var q = 0; q < 64; q++) {
        var S1 = ror(e, 6) ^ ror(e, 11) ^ ror(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (hh + S1 + ch + K[q] + w[q]) | 0;
        var S0 = ror(a, 2) ^ ror(a, 13) ^ ror(a, 22);
        var mj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + mj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + hh) | 0;
    }
    function hex(n) { return (n < 0 ? n + 0x100000000 : n).toString(16).padStart(8, '0'); }
    return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h5) + hex(h6) + hex(h7);
  }

  /** 账号密码校验：新数据比摘要，历史数据兼容明文 */
  function verifyPwd(account, pwd) {
    if (!account) return false;
    if (account.pwdHash) return hashPwd(pwd) === account.pwdHash;
    return String(account.pwd == null ? '' : account.pwd) === String(pwd);
  }

  /* ================= 字段归一 ================= */

  function str(v) { return v == null ? '' : String(v); }

  function parseTime(v) {
    if (!v) return NaN;
    if (v instanceof Date) return v.getTime();
    var n = typeof v === 'number' ? v : NaN;
    if (isFinite(n)) return n;
    var d = new Date(String(v).replace(/-/g, '/').replace('T', ' ').replace(/\..*$/, ''));
    return d.getTime();
  }

  function normalizeFeedback(f) {
    return Object.assign({
      source: 'mobile',
      operator: '',
      operatorId: '',
      contact: '',
      status: 'pending'
    }, f, {
      source: f.source || 'mobile',
      operator: f.operator || (f.source === 'h5' ? 'H5消费者' : '移动端用户')
    });
  }

  function normalizeQuestion(q) {
    return Object.assign({
      source: 'mobile',
      operator: '',
      status: 'pending'
    }, q, {
      source: q.source || 'mobile',
      operator: q.operator || '移动端用户'
    });
  }

  function normalizeStaff(s) {
    return Object.assign({
      status: 'active',
      role: '果农'
    }, s, {
      status: s.status === 'disabled' ? 'disabled' : 'active'
    });
  }

  function normalizeMessage(m) {
    return Object.assign({
      target: 'mobile',
      enabled: true,
      publisher: '系统管理员',
      source: 'pc'
    }, m, {
      enabled: m.enabled !== false
    });
  }

  function normalizeSync(it) {
    return Object.assign({
      status: 'pending',
      retry: 0,
      queuedAt: it.createdAt || ''
    }, it, {
      status: it.status || 'pending'
    });
  }

  /* 资讯：补齐分类 / 状态 / 置顶 / 阅读量等公共字段，兼容历史数据 */
  function normalizeNews(it) {
    return Object.assign({
      category: 'notice',
      status: 'published',
      top: false,
      viewCount: 0,
      author: '系统管理员',
      source: '',
      summary: '',
      content: '',
      cover: '',
      publishTime: it.createdAt || '',
      publisher: '系统管理员'
    }, it, {
      category: NEWS_CATEGORIES.indexOf(it.category) >= 0 ? it.category : 'notice',
      status: it.status === 'offline' ? 'offline' : 'published',
      top: it.top === true,
      viewCount: Math.max(0, parseInt(it.viewCount, 10) || 0)
    });
  }

  function normalize(entity, item) {
    if (entity === 'feedbacks') return normalizeFeedback(item);
    if (entity === 'expertQuestions') return normalizeQuestion(item);
    if (entity === 'staff') return normalizeStaff(item);
    if (entity === 'messages') return normalizeMessage(item);
    if (entity === 'news') return normalizeNews(item);
    if (entity === 'syncQueue') return normalizeSync(item);
    return item;
  }

  function list(entity) {
    return readList(KEYS[entity]).map(function (it) {
      return normalize(entity, it);
    });
  }

  /**
   * 历史数据一次性归一：
   *   1. 账号明文密码 → pwdHash（仅当可确定原值时）
   *   2. 反馈/咨询补 source、operator
   *   3. 同步队列补 status
   * 返回 true 表示有落盘变更。
   */
  function ready() {
    var changed = false;

    var staff = readList(KEYS.staff);
    if (staff.some(function (s) { return s && s.pwd && !s.pwdHash; })) {
      staff = staff.map(function (s) {
        if (!s || !s.pwd || s.pwdHash) return s;
        var next = Object.assign({}, s, { pwdHash: hashPwd(s.pwd) });
        delete next.pwd;
        return next;
      });
      changed = writeList(KEYS.staff, staff) || changed;
    }

    var fb = readList(KEYS.feedbacks);
    if (fb.some(function (f) { return f && (!f.source || !f.operator); })) {
      changed = writeList(KEYS.feedbacks, fb.map(normalizeFeedback)) || changed;
    }

    var qs = readList(KEYS.expertQuestions);
    if (qs.some(function (q) { return q && (!q.source || !q.operator); })) {
      changed = writeList(KEYS.expertQuestions, qs.map(normalizeQuestion)) || changed;
    }

    var queue = readList(KEYS.syncQueue);
    if (queue.some(function (it) { return it && !it.status; })) {
      changed = writeList(KEYS.syncQueue, queue.map(normalizeSync)) || changed;
    }

    return changed;
  }

  /* ================= 资讯专用接口 ================= */

  /**
   * 资讯编号：NEWS-YYYYMMDD-NNN（按当天已有条数递增，不与历史冲突）
   */
  function nextNewsId(list, publishTime) {
    var day = String(publishTime || now()).replace(/\D/g, '').slice(0, 8) || '00000000';
    var prefix = 'NEWS-' + day + '-';
    var max = 0;
    (list || []).forEach(function (it) {
      if (it && typeof it.id === 'string' && it.id.indexOf(prefix) === 0) {
        var n = parseInt(it.id.slice(prefix.length), 10);
        if (isFinite(n) && n > max) max = n;
      }
    });
    var p = function (n) { return n < 10 ? '00' + n : n < 100 ? '0' + n : String(n); };
    return prefix + p(max + 1);
  }

  /**
   * 资讯列表（默认仅已发布；置顶优先，其次按发布时间倒序）
   * @param {Object} opt { publishedOnly, category, keyword, limit }
   */
  function newsList(opt) {
    opt = opt || {};
    var rows = list('news');
    if (opt.publishedOnly !== false) {
      rows = rows.filter(function (n) { return n.status === 'published'; });
    }
    if (opt.category) {
      rows = rows.filter(function (n) { return n.category === opt.category; });
    }
    if (opt.keyword) {
      var kw = String(opt.keyword).toLowerCase();
      rows = rows.filter(function (n) {
        var hay = ((n.title || '') + ' ' + (n.summary || '') + ' ' + (n.content || '')).toLowerCase();
        return hay.indexOf(kw) >= 0;
      });
    }
    rows.sort(function (a, b) {
      if (a.top !== b.top) return a.top ? -1 : 1;
      return parseTime(b.publishTime || b.createdAt) - parseTime(a.publishTime || a.createdAt);
    });
    if (opt.limit > 0) rows = rows.slice(0, opt.limit);
    return rows;
  }

  function newsOf(id) {
    var row = findById(KEYS.news, id);
    return row ? normalizeNews(row) : null;
  }

  /**
   * 新增 / 更新资讯（统一校验）
   * @param {Object} data { id?, category, title, summary, content, cover, author, source, publishTime, status, top }
   * @returns {Object} { ok, id, msg }
   */
  function saveNews(data) {
    data = data || {};
    var title = String(data.title || '').trim();
    var content = String(data.content || '').trim();

    if (!title) return { ok: false, msg: '请填写资讯标题' };
    if (title.length > 40) return { ok: false, msg: '资讯标题不能超过 40 字' };
    if (!content) return { ok: false, msg: '请填写资讯正文' };

    var category = NEWS_CATEGORIES.indexOf(data.category) >= 0 ? data.category : 'notice';
    var publishTime = String(data.publishTime || '').trim() || now();
    var cover = String(data.cover || '');
    if (cover && cover.length > 400000) {
      return { ok: false, msg: '封面图过大（上限 300KB），请更换后重试' };
    }

    var all = readList(KEYS.news);
    var payload = {
      category: category,
      title: title,
      summary: String(data.summary || '').trim(),
      content: content,
      cover: cover,
      author: String(data.author || '').trim() || operatorName(),
      source: String(data.source || '').trim(),
      publishTime: publishTime,
      status: data.status === 'offline' ? 'offline' : 'published',
      top: data.top === true,
      publisher: operatorName(),
      updatedAt: now()
    };

    if (data.id) {
      var exists = all.some(function (it) { return String(it.id) === String(data.id); });
      if (!exists) return { ok: false, msg: '未找到该资讯，可能已被删除' };
      var row = patch(KEYS.news, data.id, payload);
      return row ? { ok: true, id: row.id, msg: '资讯已更新' } : { ok: false, msg: '资讯更新失败' };
    }

    payload.id = nextNewsId(all, publishTime);
    payload.viewCount = 0;
    payload.createdAt = now();
    all.unshift(payload);
    if (!writeList(KEYS.news, all)) {
      return { ok: false, msg: '本地存储写入失败，资讯未能保存' };
    }
    return { ok: true, id: payload.id, msg: '资讯已发布' };
  }

  /** 上下架：published ↔ offline */
  function toggleNews(id) {
    var row = newsOf(id);
    if (!row) return { ok: false, msg: '未找到该资讯' };
    var next = row.status === 'published' ? 'offline' : 'published';
    var ok = patch(KEYS.news, id, { status: next });
    if (!ok) return { ok: false, msg: '状态切换失败' };
    return { ok: true, status: next, msg: next === 'published' ? '资讯已发布' : '资讯已下架' };
  }

  /** 置顶 / 取消置顶 */
  function toggleNewsTop(id) {
    var row = newsOf(id);
    if (!row) return { ok: false, msg: '未找到该资讯' };
    var next = !row.top;
    var ok = patch(KEYS.news, id, { top: next });
    if (!ok) return { ok: false, msg: '置顶操作失败' };
    return { ok: true, top: next, msg: next ? '已置顶' : '已取消置顶' };
  }

  /** 删除资讯（不存在时返回失败，不静默） */
  function removeNews(id) {
    var row = newsOf(id);
    if (!row) return { ok: false, msg: '未找到该资讯' };
    var ok = remove(KEYS.news, id);
    return ok ? { ok: true, msg: '资讯已删除' } : { ok: false, msg: '资讯删除失败' };
  }

  /**
   * 阅读量 +1（按会话去重：同一浏览器会话内同一条资讯仅计一次）
   * @returns {boolean} 是否实际累加
   */
  function increaseNewsView(id) {
    var row = newsOf(id);
    if (!row) return false;
    var flag = 'mb_news_read';
    var read = [];
    try {
      var raw = sessionStorage.getItem(flag);
      var parsed = raw ? JSON.parse(raw) : [];
      read = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      read = [];
    }
    if (read.indexOf(String(id)) >= 0) return false;
    read.push(String(id));
    try {
      sessionStorage.setItem(flag, JSON.stringify(read.slice(-200)));
    } catch (e) { /* 配额不足时忽略，不影响展示 */ }
    var ok = patch(KEYS.news, id, { viewCount: (row.viewCount || 0) + 1 });
    return !!ok;
  }

  /* ================= 派生指标 ================= */

  function ratio(n, d) {
    return d > 0 ? Math.round((n / d) * 1000) / 10 : 0;
  }

  function avgMinutes(pairs) {
    var vals = pairs.filter(function (v) { return isFinite(v) && v >= 0; }).sort(function (a, b) { return a - b; });
    if (!vals.length) return 0;
    var sum = vals.reduce(function (a, b) { return a + b; }, 0);
    return Math.round(sum / vals.length);
  }

  function stats() {
    var fb = list('feedbacks');
    var pendingFb = fb.filter(function (f) { return f.status === 'pending'; }).length;
    var processingFb = fb.filter(function (f) { return f.status === 'processing'; }).length;
    var passedFb = fb.filter(function (f) { return f.status === 'passed'; }).length;
    var rejectedFb = fb.filter(function (f) { return f.status === 'rejected'; }).length;
    var handleMin = avgMinutes(fb.map(function (f) {
      var end = parseTime(f.reviewTime || f.updatedAt);
      var start = parseTime(f.createTime || f.createdAt);
      return (isFinite(end) && isFinite(start)) ? (end - start) / 60000 : NaN;
    }));

    var qs = list('expertQuestions');
    var pendingQ = qs.filter(function (q) { return q.status !== 'replied'; }).length;
    var repliedQ = qs.length - pendingQ;
    var replyMin = avgMinutes(qs.map(function (q) {
      var end = parseTime(q.replyTime);
      var start = parseTime(q.time || q.createdAt);
      return (isFinite(end) && isFinite(start)) ? (end - start) / 60000 : NaN;
    }));

    var staff = list('staff');
    var activeStaff = staff.filter(function (s) { return s.status !== 'disabled'; }).length;

    var msgs = list('messages');
    var enabledMsg = msgs.filter(function (m) { return m.enabled !== false; }).length;

    var queue = list('syncQueue');
    var pendingSync = queue.filter(function (it) { return it.status !== 'synced'; }).length;
    var oldestHours = 0;
    queue.forEach(function (it) {
      if (it.status === 'synced') return;
      var t = parseTime(it.queuedAt || it.createdAt);
      if (!isFinite(t)) return;
      oldestHours = Math.max(oldestHours, (Date.now() - t) / 3600000);
    });

    var ai = readObj(KEYS.aiConfig) || {};
    var rules = list('diseaseRules');
    var kb = list('faultKb');

    var news = list('news');
    var pubNews = news.filter(function (n) { return n.status === 'published'; });
    var totalViews = news.reduce(function (sum, n) { return sum + (n.viewCount || 0); }, 0);
    var monthPrefix = now().slice(0, 7);
    var monthNew = news.filter(function (n) {
      return String(n.publishTime || n.createdAt || '').slice(0, 7) === monthPrefix;
    }).length;

    return {
      feedback: {
        total: fb.length, pending: pendingFb, processing: processingFb,
        closed: passedFb + rejectedFb, passed: passedFb, rejected: rejectedFb,
        passRate: ratio(passedFb, passedFb + rejectedFb),
        avgHandleMin: handleMin,
        fromMobile: fb.filter(function (f) { return f.source === 'mobile'; }).length,
        fromH5: fb.filter(function (f) { return f.source === 'h5'; }).length
      },
      expert: {
        total: qs.length, pending: pendingQ, replied: repliedQ,
        replyRate: ratio(repliedQ, qs.length),
        avgReplyMin: replyMin
      },
      staff: { total: staff.length, active: activeStaff, disabled: staff.length - activeStaff },
      message: { total: msgs.length, enabled: enabledMsg, disabled: msgs.length - enabledMsg },
      news: {
        total: news.length,
        published: pubNews.length,
        offline: news.length - pubNews.length,
        totalViews: totalViews,
        monthNew: monthNew,
        top: news.filter(function (n) { return n.top === true; }).length
      },
      sync: {
        total: queue.length, pending: pendingSync,
        synced: queue.length - pendingSync,
        syncRate: ratio(queue.length - pendingSync, queue.length),
        oldestHours: Math.round(oldestHours * 10) / 10
      },
      ai: {
        categories: (ai.categories || []).length,
        questions: (ai.hotQuestions || []).length
      },
      disease: {
        total: rules.length,
        enabled: rules.filter(function (r) { return r.enabled !== false; }).length
      },
      faultKb: {
        total: kb.length,
        enabled: kb.filter(function (k) { return k.enabled !== false; }).length
      },
      todo: pendingFb + pendingQ + pendingSync
    };
  }

  return {
    KEYS: KEYS,
    SOURCE_TEXT: SOURCE_TEXT,
    NEWS_CATEGORIES: NEWS_CATEGORIES,
    NEWS_CATEGORY_TEXT: NEWS_CATEGORY_TEXT,
    now: now,
    readList: readList,
    writeList: writeList,
    readObj: readObj,
    writeObj: writeObj,
    list: list,
    push: push,
    patch: patch,
    remove: remove,
    findById: findById,
    nextId: nextId,
    subscribe: subscribe,
    audit: audit,
    currentUser: currentUser,
    operatorName: operatorName,
    hashPwd: hashPwd,
    verifyPwd: verifyPwd,
    normalize: normalize,
    ready: ready,
    stats: stats,
    nextNewsId: nextNewsId,
    newsList: newsList,
    newsOf: newsOf,
    saveNews: saveNews,
    toggleNews: toggleNews,
    toggleNewsTop: toggleNewsTop,
    removeNews: removeNews,
    increaseNewsView: increaseNewsView,
    _preload: function () { if (typeof preloadFromBackend === 'function') preloadFromBackend(); }
  };
})();

// 异步触发后端预加载
setTimeout(function () {
  try { window.MobileOpsStore._preload(); } catch (e) {}
}, 0);
