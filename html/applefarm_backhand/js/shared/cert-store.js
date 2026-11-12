/**
 * cert-store.js — 证书管理共享数据源
 * ---------------------------------------------------------------
 * 承载「企业资质证书」与「批次凭证」两类证书的唯一数据，
 * 统一落地 localStorage['smartorchard_cert_v1']，供以下页面共享：
 *   - 证书管理      cert_manage.html
 *   - 农产品合格证  cert_issue.html
 *   - 企业信息      enterprise_info.html（资质证书区块）
 *   - 溯源查询      trace_query.html（批次证书展示）
 *   - 数据大屏      da_overview.html / da_trace.html（资质状态）
 * 避免各页各持一份 mock 导致证书数量、状态、发证机构口径互相对不上。
 *
 * 设计约定（与 harvest-store.js / trace-store.js / production-store.js 保持一致）：
 *   - 证书分两类：category = qualification（企业资质）/ batch（批次凭证），
 *     企业资质无「关联批次 / 客户」，批次凭证必须有批次号；
 *   - status 只表达人工状态，真实展示状态由 computeStatus() 按有效期实时派生；
 *   - 状态流转只走 advance()，内置流程表 + 守卫；
 *   - 证书编号统一规则：企业资质 PREFIX-YYYY-NNNN，批次凭证 PREFIX-YYYYMMDD-NNNN；
 *   - 所有写操作写入 auditLogs（操作人 / 时间 / 动作 / 明细），支持监管追溯。
 *
 * 对外 API：
 *   CertStore.certs() / get(id) / qualifications() / batchCerts()
 *   CertStore.saveCert(cert)                → { ok, item, message }
 *   CertStore.remove(id)                    → { ok, message }
 *   CertStore.advance(id, to, patch)        → { ok, item, message }
 *   CertStore.submit(id, operator)          草稿 → 待审核
 *   CertStore.approve(id, operator)         待审核 → 已生效
 *   CertStore.reject(id, reason, operator)  待审核 → 草稿（驳回）
 *   CertStore.revoke(id, reason, operator)  任意态 → 已撤销
 *   CertStore.renew(id, validEnd, operator) 续期（重置有效期 + 回到已生效）
 *   CertStore.filter(opts)                  按类型 / 状态 / 关键词 / 日期区间筛选
 *   CertStore.stats()                       统计与到期预警汇总
 *   CertStore.computeStatus(cert)           实时展示状态（含剩余天数）
 *   CertStore.nextCertNo(category, type, dateStr)
 *   CertStore.harvestGuard(batchNo)         合格证开具前置校验
 *   CertStore.subscribe(fn) / reset()
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'smartorchard_cert_v1';
  // v2：合并企业资质 + 批次凭证两类模型，状态机改为人工状态 + 实时派生展示状态
  var VERSION = 2;
  var LEGACY_ISSUED_KEY = 'smartorchard_issued_certs';
  var USAGE_RECORD_KEY = 'smartorchard_material_usage_records';

  /* ============================================================
   * 后端桥接依赖自动加载（策略 A：出入口映射）
   * ------------------------------------------------------------
   * 依赖：common/js/api.js（统一请求）与 cert-mapper.js（映射层）。
   * 基于 document.currentScript.src 计算本脚本目录再拼接，避免跨层级 404。
   * ============================================================ */
  var depsReady = (function ensureDeps() {
    if (typeof document === 'undefined') return Promise.resolve();
    var selfEl = document.currentScript;
    if (!selfEl || !selfEl.src) return Promise.resolve();
    var baseDir = selfEl.src.replace(/[^\/]*$/, ''); // 去掉文件名，保留目录
    var deps = [
      { name: 'Api', src: baseDir + '../../../common/js/api.js' },
      { name: 'CertMapper', src: baseDir + 'cert-mapper.js' }
    ];
    var pending = deps.filter(function (d) { return !global[d.name]; });
    if (!pending.length) return Promise.resolve();
    return Promise.all(pending.map(function (d) {
      return new Promise(function (resolve) {
        var s = document.createElement('script');
        s.src = d.src;
        s.async = false;
        s.onload = resolve;
        s.onerror = resolve; // 依赖加载失败不阻塞原型运行
        (document.head || document.documentElement).appendChild(s);
      });
    })).then(function () { return true; });
  })();

  /* 后端桥接状态 */
  var backendReady = false;
  var backendLoadPromise = null;
  var persistTimer = null;
  var persistPending = null;

  function backendApi() {
    if (typeof global.Api !== 'object' && typeof global.Api !== 'function') return null;
    if (!global.Api.get || !global.Api.create) return null;
    if (typeof global.CertMapper === 'undefined') return null;
    return global.Api;
  }

  function backendEnabled() {
    var api = backendApi();
    if (!api) return false;
    try { return !!api.isLoggedIn(); } catch (e) { return false; }
  }

  /** 从后端聚合接口拉取证书数据，成功后合并进内存并通知 */
  function preloadFromBackend() {
    var writeMark0 = global.__STRICT_DB_WRITES__ || 0;
    if (backendLoadPromise) return backendLoadPromise;
    backendLoadPromise = Promise.resolve(depsReady).then(function () {
      var api = backendApi();
      if (!api || !api.isLoggedIn || !api.isLoggedIn()) return { ok: false, message: '未登录或依赖未就绪' };
      return api.get('cert/aggregate');
    }).then(function (res) {
      if (res && res.ok && res.data) {
        // 严格模式：预加载在途期间用户保存过数据，保留本地结果，避免陈旧快照覆盖
        if (typeof global.__STRICT_DB_WRITES__ === "number" && global.__STRICT_DB_WRITES__ !== writeMark0) return res;
        var agg = global.CertMapper.toAggregate(res.data);
        var list = agg.certs || [];
        if (true) { // 严格模式：空库也以后端结果为准
          var base = defaults();
          // 后端数据合并进 store 内存（保留 DEFAULT_DATA 里的派生/展示兜底字段）
          var merged = list.map(function (c, i) {
            var tpl = base.certs[i] || {};
            return mergeCert(tpl, c);
          });
          inMemory = { version: VERSION, certs: merged };
          save(); // 回写 localStorage，保持兜底副本同步
          notify('backend-loaded');
          backendReady = true;
        }
      }
      return res;
    }).catch(function (e) {
      console.warn('[CertStore] 后端预加载失败，降级 localStorage', e);
      return { ok: false, message: e && e.message };
    });
  }

  /** 合并：以默认模板补齐派生/展示字段，后端字段优先 */
  function mergeCert(tpl, backend) {
    var out = clone(tpl || {});
    if (!backend) return out;
    Object.keys(backend).forEach(function (k) {
      if (backend[k] !== undefined && backend[k] !== null && backend[k] !== '') {
        out[k] = backend[k];
      } else if (backend[k] === null && k === 'attachments') {
        out[k] = [];
      }
    });
    // 后端无 auditLogs，保留默认模板的初始化日志
    if (!out.auditLogs || !out.auditLogs.length) {
      out.auditLogs = [{ at: backend.createdAt || stampNow(), actor: backend.operator || '系统', action: '建档', detail: '导入' + (backend.type || '') }];
    }
    return out;
  }

  /** 从后端数据映射回 store 结构（供 preload 用，已由 toAggregate 完成） */

  /** 持久化到后端：防抖 300ms，全量 upsert sf_cert */
  function persistToBackend() {
    var api = backendApi();
    if (!api || !backendEnabled()) return Promise.resolve({ ok: false, message: '未登录或依赖未就绪' });
    var agg = {
      version: VERSION,
      certs: clone(ensure().certs || []),
      deleted: { certs: persistPending && persistPending.deleted ? persistPending.deleted : [] },
    };
    var body = global.CertMapper.fromAggregate(agg);
    return api.create('cert/aggregate', body);
  }

  /** 调度后端持久化（防抖） */
  function schedulePersist(reason) {
    if (!backendEnabled()) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      persistTimer = null;
      persistToBackend().catch(function (e) {
        console.warn('[CertStore] 后端持久化失败', e);
      });
    }, 300);
  }

  /* ============================================================
   * 枚举字典
   * ============================================================ */

  /** 证书类型字典：category 区分企业资质与批次凭证，prefix 为编号前缀 */
  var CERT_TYPES = [
    // ---- 企业资质（主体是企业） ----
    { code: 'organic',       name: '有机产品认证',        category: 'qualification', prefix: 'ORG',   issueOrg: '中国绿色食品发展中心' },
    { code: 'green_food',    name: '绿色食品认证',        category: 'qualification', prefix: 'GRN',   issueOrg: '中国绿色食品发展中心' },
    { code: 'haccp',         name: 'HACCP 体系认证',      category: 'qualification', prefix: 'HACCP', issueOrg: '中国质量认证中心' },
    { code: 'gap',           name: 'GAP 良好农业规范',    category: 'qualification', prefix: 'GAP',   issueOrg: '中国质量认证中心' },
    { code: 'iso9001',       name: 'ISO9001 体系认证',    category: 'qualification', prefix: 'ISO',   issueOrg: '中国质量认证中心' },
    { code: 'geographic',    name: '农产品地理标志',      category: 'qualification', prefix: 'GI',    issueOrg: '国家知识产权局' },
    { code: 'national',      name: '国家重点龙头企业',    category: 'qualification', prefix: 'NAT',   issueOrg: '农业农村部产业化办公室' },
    { code: 'export',        name: '出口质量备案',        category: 'qualification', prefix: 'EXP',   issueOrg: '海关总署进出口食品安全局' },
    { code: 'blockchain',    name: '区块链溯源试点',      category: 'qualification', prefix: 'BLK',   issueOrg: '甘肃省农业农村厅' },
    // ---- 批次凭证（主体是批次） ----
    { code: 'quality_cert',  name: '质量合格证',          category: 'batch', prefix: 'ZH', issueOrg: '天水花牛苹果（集团）有限责任公司' },
    { code: 'inspection',    name: '检测报告',            category: 'batch', prefix: 'JC', issueOrg: '第三方检测机构' },
    { code: 'origin',        name: '原产地证明',          category: 'batch', prefix: 'YD', issueOrg: '天水花牛苹果（集团）有限责任公司' },
    { code: 'adoption',      name: '认养证书',            category: 'batch', prefix: 'RY', issueOrg: '天水花牛苹果（集团）有限责任公司' }
  ];

  /** 人工状态流转表 */
  var STATUS = {
    draft:    { text: '草稿',   tag: 'draft' },
    pending:  { text: '待审核', tag: 'pending' },
    active:   { text: '已生效', tag: 'enabled' },
    revoked:  { text: '已撤销', tag: 'disabled' }
  };

  /** 状态流程表：键为当前状态，值为允许流转到的下一状态 */
  var FLOW = {
    draft:   ['pending', 'revoked'],
    pending: ['active', 'draft', 'revoked'],
    active:  ['revoked'],
    revoked: []
  };

  /** 到期阈值：90 天进入预警，30 天内进入紧急预警 */
  var WARN_DAYS = 90;
  var URGENT_DAYS = 30;

  var BATCH_TYPES = CERT_TYPES.filter(function (t) { return t.category === 'batch'; });
  var QUALIFICATION_TYPES = CERT_TYPES.filter(function (t) { return t.category === 'qualification'; });

  var DEPARTMENTS = ['质量部', '生产部', '仓储部', '销售部', '财务部', '行政部'];

  /* ============================================================
   * 工具函数
   * ============================================================ */

  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function text(v) { return v == null ? '' : String(v).trim(); }
  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
  function num(v, d) { var n = Number(v); return isNaN(n) ? (d == null ? 0 : d) : n; }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2);
  }
  function stampNow() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2) +
      ' ' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2);
  }
  function dateOnly(v) { return text(v).slice(0, 10); }
  function isDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(text(v)); }
  function daysBetween(from, to) {
    var a = new Date(dateOnly(from) + 'T00:00:00');
    var b = new Date(dateOnly(to) + 'T00:00:00');
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
    return Math.round((b - a) / 86400000);
  }
  function shiftDate(dateStr, days) {
    var d = new Date(dateOnly(dateStr) + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2);
  }
  function esc(s) {
    return text(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function typeOf(code) {
    var hit = CERT_TYPES.filter(function (t) { return t.code === code; })[0];
    return hit || null;
  }
  function typeName(code) {
    var t = typeOf(code);
    return t ? t.name : (text(code) || '未分类');
  }
  function typeNameOf(cert) {
    return typeName(cert && cert.typeCode);
  }
  function prefixOf(typeCode) {
    var t = typeOf(typeCode);
    return t ? t.prefix : 'CERT';
  }
  function categoryOf(cert) {
    if (cert && cert.category) return cert.category;
    var t = typeOf(cert && cert.typeCode);
    return t ? t.category : 'batch';
  }

  /* ============================================================
   * 种子数据
   * ============================================================ */

  /** 企业资质种子：来自企业信息页「资质证书」区块（数据最完整：图片 / 机构 / 发证日期 / 有效期） */
  var QUALIFICATION_SEED = [];

  /** 批次凭证种子：来自原证书管理页 mockCertData 的批次类记录 */
  var BATCH_SEED = [];

  function buildQualifications() {
    return QUALIFICATION_SEED.map(function (r, i) {
      return {
        id: 'CERT-Q' + pad(i + 1, 3),
        certNo: r.certNo,
        category: 'qualification',
        typeCode: r.typeCode,
        type: r.name,
        sourceNo: r.no,
        issueOrg: r.issueOrg,
        issueDate: r.issueDate,
        validStart: r.issueDate,
        validEnd: r.validEnd,
        status: 'active',
        scope: r.scope,
        owner: '质量部',
        attachments: r.img ? [{ name: r.name + '扫描件.jpg', size: 0, type: 'image/jpeg', url: r.img, uploadedAt: r.issueDate + ' 09:00:00' }] : [],
        topShow: r.topShow === true,
        sort: r.sort,
        batchNo: '',
        customer: '',
        product: '',
        conclusion: '',
        tester: '',
        reportNo: '',
        qrUrl: '',
        traceCode: '',
        stamp: '',
        renewNote: '',
        revokeReason: '',
        operator: '',
        createdAt: r.issueDate + ' 09:00:00',
        updatedAt: r.issueDate + ' 09:00:00',
        auditLogs: [{ at: r.issueDate + ' 09:00:00', actor: '系统初始化', action: '建档', detail: '导入' + r.name + '（' + r.no + '）' }]
      };
    });
  }

  function buildBatchCerts() {
    return BATCH_SEED.map(function (r, i) {
      var t = typeOf(r[0]);
      return {
        id: 'CERT-B' + pad(i + 1, 3),
        certNo: r[2],
        category: 'batch',
        typeCode: r[0],
        type: r[1],
        sourceNo: '',
        issueOrg: t ? t.issueOrg : '',
        issueDate: r[5],
        validStart: r[5],
        validEnd: r[6],
        status: 'active',
        scope: '',
        owner: '质量部',
        attachments: [],
        topShow: false,
        sort: i + 1,
        batchNo: r[3],
        customer: r[4],
        product: '花牛苹果',
        conclusion: '合格',
        tester: '',
        reportNo: r[0] === 'inspection' ? r[2] : '',
        qrUrl: '',
        traceCode: '',
        stamp: '',
        renewNote: '',
        revokeReason: '',
        operator: '',
        createdAt: r[5] + ' 17:30:00',
        updatedAt: r[5] + ' 17:30:00',
        auditLogs: [{ at: r[5] + ' 17:30:00', actor: '', action: '签发', detail: '签发' + r[1] + '，关联批次 ' + r[3] }]
      };
    });
  }

  /** 迁移旧版「已签发合格证」数据（localStorage.smartorchard_issued_certs） */
  function migrateIssuedCerts(list) {
    var raw;
    try { raw = localStorage.getItem(LEGACY_ISSUED_KEY); } catch (e) { return list; }
    if (!raw) return list;
    var arr;
    try { arr = JSON.parse(raw); } catch (e) { return list; }
    if (!Array.isArray(arr)) return list;
    var exist = {};
    list.forEach(function (c) { exist[c.certNo] = 1; });
    arr.forEach(function (c) {
      if (!c || !c.certNo || exist[c.certNo]) return;
      var parts = text(c.validity).split(' 至 ');
      list.push({
        id: 'CERT-B' + pad(list.length + 1, 3),
        certNo: c.certNo,
        category: 'batch',
        typeCode: 'quality_cert',
        type: '质量合格证',
        sourceNo: '',
        issueOrg: '天水花牛苹果（集团）有限责任公司',
        issueDate: parts[0] || todayStr(),
        validStart: parts[0] || todayStr(),
        validEnd: parts[1] || shiftDate(parts[0] || todayStr(), 365),
        status: 'active',
        scope: '',
        owner: '质量部',
        attachments: [],
        topShow: false,
        sort: list.length + 1,
        batchNo: text(c.batchNo),
        customer: text(c.supplier) || '未指定',
        product: text(c.product) || '花牛苹果',
        conclusion: text(c.conclusion) || '合格',
        tester: text(c.tester) || '',
        reportNo: '',
        qrUrl: '',
        traceCode: '',
        stamp: '',
        renewNote: '',
        revokeReason: '',
        operator: '',
        createdAt: stampNow(),
        updatedAt: stampNow(),
        auditLogs: [{ at: stampNow(), actor: '系统迁移', action: '迁移', detail: '自合格证签发页迁移' }]
      });
      exist[c.certNo] = 1;
    });
    return list;
  }

  /* ============================================================
   * 读写与持久化
   * ============================================================ */

  var inMemory = null;
  var subscribers = [];
  var lastError = '';

  function defaults() {
    var list = buildQualifications().concat(buildBatchCerts());
    migrateIssuedCerts(list);
    return { version: VERSION, certs: list };
  }

  function load() {
    var raw;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    if (!raw) return null;
    try {
      var obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('数据结构异常');
      if (obj.version !== VERSION) return null;
      return obj;
    } catch (e) {
      try { localStorage.setItem(STORAGE_KEY + '_corrupt', raw); } catch (e2) {}
      console.warn('[CertStore] 本地数据损坏，已备份并重新初始化', e);
      return null;
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemory));
      lastError = '';
      return true;
    } catch (e) {
      lastError = e && e.name === 'QuotaExceededError'
        ? '本地存储空间不足，数据未保存'
        : '数据保存失败：' + (e && e.message ? e.message : '浏览器存储不可用');
      console.error('[CertStore]', lastError);
      return false;
    }
  }

  function ensure() {
    if (inMemory) return inMemory;
    var stored = load();
    if (stored) {
      var base = defaults();
      if (!Array.isArray(stored.certs)) stored.certs = base.certs;
      var seen = {};
      stored.certs = stored.certs.filter(function (x) {
        if (!x || typeof x !== 'object' || !x.id) return false;
        if (seen[x.id]) return false;
        seen[x.id] = 1;
        return true;
      });
      // 补齐后续版本新增的字段，避免旧数据缺字段导致渲染异常
      stored.certs.forEach(function (x) {
        var tpl = base.certs.filter(function (b) { return b.id === x.id; })[0] || {};
        Object.keys(tpl).forEach(function (k) {
          if (x[k] === undefined) x[k] = tpl[k];
        });
      });
      stored.version = VERSION;
      inMemory = stored;
    } else {
      inMemory = defaults();
      save();
    }
    // 触发后端预加载（异步，不阻塞首次渲染；未登录时静默降级）
    preloadFromBackend();
    return inMemory;
  }

  function notify(reason) {
    subscribers.forEach(function (fn) {
      try { fn(reason); } catch (e) { console.warn('[CertStore]', e); }
    });
  }

  function commit(reason) {
    var ok = save();
    notify(reason);
    // 后端持久化（防抖，未登录/依赖未就绪时静默跳过）
    schedulePersist(reason);
    try {
      window.dispatchEvent(new CustomEvent('certStoreChange', { detail: { reason: reason, saved: ok } }));
    } catch (e) {}
    return ok;
  }

  /* ============================================================
   * 读取
   * ============================================================ */

  function certs() { return clone(ensure().certs || []); }

  function get(id) {
    var list = ensure().certs || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return clone(list[i]);
    }
    return null;
  }

  function getByNo(certNo) {
    var list = ensure().certs || [];
    for (var i = 0; i < list.length; i++) {
      if (text(list[i].certNo) === text(certNo)) return clone(list[i]);
    }
    return null;
  }

  function qualifications() {
    return certs().filter(function (c) { return categoryOf(c) === 'qualification'; });
  }

  function batchCerts() {
    return certs().filter(function (c) { return categoryOf(c) === 'batch'; });
  }

  function certsOfBatch(batchNo) {
    var b = text(batchNo);
    if (!b) return [];
    return certs().filter(function (c) { return text(c.batchNo) === b; });
  }

  /* ============================================================
   * 状态派生与统计
   * ============================================================ */

  /** 实时展示状态：以人工状态为基准，再按有效期派生即将到期 / 已过期 */
  function computeStatus(cert) {
    if (!cert) return { cls: 'enabled', text: '有效', days: null, level: 'normal' };
    if (cert.status === 'revoked') return { cls: 'disabled', text: '已撤销', days: null, level: 'revoked' };
    if (cert.status === 'draft') return { cls: 'draft', text: '草稿', days: null, level: 'draft' };
    if (cert.status === 'pending') return { cls: 'pending', text: '待审核', days: null, level: 'pending' };
    var days = daysBetween(todayStr(), cert.validEnd);
    if (days === null) return { cls: 'enabled', text: '有效', days: null, level: 'normal' };
    if (days < 0) return { cls: 'error', text: '已过期', days: days, level: 'expired' };
    if (days <= URGENT_DAYS) return { cls: 'urgent', text: '即将到期', days: days, level: 'urgent' };
    if (days <= WARN_DAYS) return { cls: 'warning', text: '即将到期', days: days, level: 'warning' };
    return { cls: 'enabled', text: '有效', days: days, level: 'normal' };
  }

  /** 剩余天数（负数为已过期天数） */
  function remainDays(cert) {
    if (!cert) return null;
    return daysBetween(todayStr(), cert.validEnd);
  }

  /** 状态筛选用的语义分组 */
  function statusGroup(cert) {
    var s = computeStatus(cert);
    if (cert.status === 'draft') return 'draft';
    if (cert.status === 'pending') return 'pending';
    if (cert.status === 'revoked') return 'revoked';
    if (s.level === 'expired') return 'expired';
    if (s.level === 'urgent' || s.level === 'warning') return 'expiring';
    return 'valid';
  }

  /** 统计与到期预警汇总：与列表筛选口径完全一致 */
  function stats(list) {
    var arr = Array.isArray(list) ? list : certs();
    var out = {
      total: arr.length,
      qualification: 0,
      batch: 0,
      valid: 0,
      expiring: 0,
      expired: 0,
      revoked: 0,
      pending: 0,
      draft: 0,
      urgent: 0
    };
    arr.forEach(function (c) {
      if (categoryOf(c) === 'qualification') out.qualification++; else out.batch++;
      var g = statusGroup(c);
      if (g === 'valid') out.valid++;
      else if (g === 'expiring') { out.expiring++; if (computeStatus(c).level === 'urgent') out.urgent++; }
      else if (g === 'expired') out.expired++;
      else if (g === 'revoked') out.revoked++;
      else if (g === 'pending') out.pending++;
      else if (g === 'draft') out.draft++;
    });
    return out;
  }

  /**
   * 筛选：支持类型 / 分类 / 状态语义组 / 关键词 / 有效期区间
   * opts = { typeCode, category, status, keyword, dateFrom, dateTo }
   */
  function filter(opts) {
    opts = opts || {};
    var arr = certs();
    var kw = text(opts.keyword).toLowerCase();
    var from = dateOnly(opts.dateFrom);
    var to = dateOnly(opts.dateTo);

    return arr.filter(function (c) {
      if (opts.category && categoryOf(c) !== opts.category) return false;
      if (opts.typeCode && c.typeCode !== opts.typeCode) return false;
      if (opts.status && statusGroup(c) !== opts.status) return false;
      if (from && dateOnly(c.validEnd) < from) return false;
      if (to && dateOnly(c.validStart) > to) return false;
      if (kw) {
        var hay = [c.certNo, c.type, c.batchNo, c.customer, c.issueOrg, c.sourceNo, c.product, c.scope, c.tester, c.reportNo]
          .map(function (x) { return text(x).toLowerCase(); }).join(' ');
        if (hay.indexOf(kw) === -1) return false;
      }
      return true;
    });
  }

  /** 到期预警清单：用于预警中心与首页提醒 */
  function expiringList(days) {
    var limit = days == null ? WARN_DAYS : days;
    return certs().filter(function (c) {
      var d = remainDays(c);
      return d !== null && d <= limit;
    });
  }

  /* ============================================================
   * 编号生成
   * ============================================================ */

  /** 证书编号：企业资质 PREFIX-YYYY-NNNN，批次凭证 PREFIX-YYYYMMDD-NNNN */
  function nextCertNo(category, typeCode, dateStr) {
    var prefix = prefixOf(typeCode);
    var list = ensure().certs || [];
    var day = dateOnly(dateStr) || todayStr();
    var year = day.slice(0, 4);
    var compact = day.replace(/-/g, '');
    // 批次凭证按 YYYYMMDD 分段，企业资质按 YYYY 分段，序号各自独立
    var pattern = category === 'qualification'
      ? new RegExp('^' + prefix + '-' + year + '-(\\d+)$')
      : new RegExp('^' + prefix + '-' + compact + '-(\\d+)$');
    var max = 0;
    list.forEach(function (c) {
      var m = text(c.certNo).match(pattern);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    var seq = pad(max + 1, 4);
    return category === 'qualification'
      ? prefix + '-' + year + '-' + seq
      : prefix + '-' + compact + '-' + seq;
  }

  /* ============================================================
   * 校验
   * ============================================================ */

  function validate(cert) {
    var e = [];
    if (!cert || typeof cert !== 'object') return '证书数据为空';
    if (!text(cert.typeCode)) e.push('请选择证书类型');
    else if (!typeOf(cert.typeCode)) e.push('证书类型不存在：' + cert.typeCode);

    var cat = categoryOf(cert);
    if (cat === 'batch') {
      if (!text(cert.batchNo)) e.push('请填写关联批次号');
    } else {
      if (!text(cert.issueOrg)) e.push('请填写发证机构');
      if (!text(cert.issueDate)) e.push('请填写发证日期');
    }
    if (!text(cert.validStart)) e.push('请填写有效期开始日期');
    if (!text(cert.validEnd)) e.push('请填写有效期截止日期');
    if (text(cert.validStart) && text(cert.validEnd) && dateOnly(cert.validEnd) < dateOnly(cert.validStart)) {
      e.push('有效期截止日期不能早于开始日期');
    }
    if (cert.conclusion && text(cert.conclusion) !== '合格') {
      e.push('检测结论为「' + text(cert.conclusion) + '」，不允许作为有效证书归档');
    }
    if (cat === 'batch' && text(cert.typeCode) === 'quality_cert' && !text(cert.tester)) {
      e.push('质量合格证必须填写检测人');
    }
    return e[0] || '';
  }

  /** 编号查重 */
  function duplicateNo(certNo, exceptId) {
    var list = ensure().certs || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === exceptId) continue;
      if (text(list[i].certNo) === text(certNo)) return list[i];
    }
    return null;
  }

  /* ============================================================
   * 写操作
   * ============================================================ */

  function findIndexById(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return i;
    }
    return -1;
  }

  function pushAudit(cert, actor, action, detail) {
    if (!Array.isArray(cert.auditLogs)) cert.auditLogs = [];
    cert.auditLogs.push({ at: stampNow(), actor: text(actor) || '系统', action: action, detail: detail });
  }

  /**
   * 保存证书：新建时自动生成编号与 id，编辑保留原编号；
   * 已生效 / 已撤销证书的关键字段锁定，需先「撤销」后另建新证。
   */
  function saveCert(cert) {
    var invalid = validate(cert);
    if (invalid) return { ok: false, item: null, message: invalid };

    var list = ensure().certs || [];
    var isNew = !cert.id || findIndexById(list, cert.id) < 0;
    var prev = isNew ? null : get(cert.id);
    var cat = categoryOf(cert);

    if (prev && (prev.status === 'active' || prev.status === 'revoked')) {
      // 已生效 / 已撤销证书锁定身份类字段，避免引用断裂；
      // 发证日期、有效期、扫描件、认证范围仍可维护（对应换证、续期场景）
      var locked = ['certNo', 'typeCode', 'batchNo'];
      if (cat === 'batch') locked.push('conclusion');
      var changed = locked.filter(function (k) {
        return text(prev[k]) !== text(cert[k]);
      });
      if (changed.length) {
        return { ok: false, item: null, message: '该证书已' + (prev.status === 'revoked' ? '撤销' : '生效') + '，' + '证书编号 / 证书类型 / 关联批次不可修改' };
      }
    }

    var typeCode = text(cert.typeCode);
    var tpl = typeOf(typeCode);
    var certNo = text(cert.certNo) || (isNew ? nextCertNo(cat, typeCode, cert.issueDate || cert.validStart) : (prev || {}).certNo);
    var dup = duplicateNo(certNo, isNew ? '' : cert.id);
    if (dup) return { ok: false, item: null, message: '证书编号已存在：' + certNo };

    var item = {
      id: isNew ? nextId(cat) : cert.id,
      certNo: certNo,
      category: cat,
      typeCode: typeCode,
      type: tpl ? tpl.name : text(cert.type),
      sourceNo: text(cert.sourceNo),
      issueOrg: text(cert.issueOrg) || (tpl ? tpl.issueOrg : ''),
      issueDate: dateOnly(cert.issueDate),
      validStart: dateOnly(cert.validStart),
      validEnd: dateOnly(cert.validEnd),
      status: isNew ? (cert.status || 'active') : (cert.status || (prev || {}).status),
      scope: text(cert.scope),
      owner: text(cert.owner) || '质量部',
      attachments: Array.isArray(cert.attachments) ? clone(cert.attachments) : [],
      topShow: cert.topShow === true,
      sort: num(cert.sort, (prev || {}).sort || list.length + 1),
      batchNo: text(cert.batchNo),
      customer: text(cert.customer),
      product: text(cert.product),
      variety: text(cert.variety),
      netWeight: text(cert.netWeight),
      grade: text(cert.grade),
      conclusion: text(cert.conclusion),
      tester: text(cert.tester),
      reportNo: text(cert.reportNo),
      qrUrl: text(cert.qrUrl),
      traceCode: text(cert.traceCode),
      stamp: text(cert.stamp),
      renewNote: text(cert.renewNote),
      revokeReason: text(cert.revokeReason),
      operator: text(cert.operator),
      createdAt: isNew ? (text(cert.createdAt) || stampNow()) : ((prev || {}).createdAt || stampNow()),
      updatedAt: stampNow(),
      auditLogs: prev ? clone(prev.auditLogs || []) : []
    };
    if (!item.auditLogs.length) {
      item.auditLogs = [{ at: stampNow(), actor: text(cert.operator) || '系统', action: '建档', detail: '新建' + item.type + ' ' + item.certNo }];
    }

    var idx = findIndexById(list, item.id);
    if (idx >= 0) {
      list[idx] = item;
      pushAudit(list[idx], cert.operator, '编辑', '更新证书信息');
    } else {
      list.unshift(item);
      pushAudit(item, cert.operator, '建档', '新建' + item.type + ' ' + item.certNo);
    }
    commit('cert-save:' + item.id);
    return { ok: true, item: clone(item), message: '' };
  }

  function nextId(category) {
    var list = ensure().certs || [];
    var prefix = category === 'qualification' ? 'CERT-Q' : 'CERT-B';
    var max = 0;
    list.forEach(function (c) {
      var m = text(c.id).match(/(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return prefix + pad(max + 1, 3);
  }

  /** 唯一状态流转入口 */
  function advance(id, to, patch) {
    var item = get(id);
    if (!item) return { ok: false, item: null, message: '数据不存在或已被删除' };
    var from = item.status;
    var allowed = FLOW[from] || [];
    if (allowed.indexOf(to) === -1) {
      return {
        ok: false, item: item,
        message: '「' + (STATUS[from] ? STATUS[from].text : from) + '」不能直接变更为「' + (STATUS[to] ? STATUS[to].text : to) + '」'
      };
    }
    var list = ensure().certs;
    var idx = findIndexById(list, id);
    var target = list[idx];
    target.status = to;
    if (patch && typeof patch === 'object') {
      Object.keys(patch).forEach(function (k) {
        if (k === 'id' || k === 'status') return;
        target[k] = patch[k];
      });
    }
    target.updatedAt = stampNow();
    pushAudit(target, (patch && patch.operator) || target.operator, '状态流转',
      (STATUS[from] ? STATUS[from].text : from) + ' → ' + (STATUS[to] ? STATUS[to].text : to));
    commit('cert:' + id + '→' + to);
    return { ok: true, item: clone(target), message: '' };
  }

  /** 草稿 → 待审核 */
  function submit(id, operator) {
    return advance(id, 'pending', { operator: operator });
  }

  /** 待审核 → 已生效 */
  function approve(id, operator) {
    return advance(id, 'active', { operator: operator });
  }

  /** 待审核 → 草稿（驳回），必须填原因 */
  function reject(id, reason, operator) {
    if (!text(reason)) return { ok: false, item: null, message: '请填写驳回原因' };
    var r = advance(id, 'draft', { operator: operator, renewNote: text(reason) });
    if (r.ok) {
      var list = ensure().certs;
      var idx = findIndexById(list, id);
      if (idx >= 0) {
        list[idx].renewNote = text(reason);
        pushAudit(list[idx], operator, '驳回', text(reason));
        commit('cert-reject:' + id);
      }
    }
    return r;
  }

  /** 作废：必须填原因并记录操作人 */
  function revoke(id, reason, operator) {
    if (!text(reason)) return { ok: false, item: null, message: '请填写作废原因' };
    var r = advance(id, 'revoked', { operator: operator, revokeReason: text(reason) });
    if (r.ok) {
      var list = ensure().certs;
      var idx = findIndexById(list, id);
      if (idx >= 0) {
        list[idx].revokeReason = text(reason);
        list[idx].updatedAt = stampNow();
        pushAudit(list[idx], operator, '作废', text(reason));
        commit('cert-revoke:' + id);
      }
    }
    return r;
  }

  /** 续期：更新有效期并回到已生效 */
  function renew(id, validEnd, operator, note) {
    var item = get(id);
    if (!item) return { ok: false, item: null, message: '数据不存在或已被删除' };
    if (!isDate(validEnd)) return { ok: false, item: null, message: '请填写正确的续期截止日期' };
    if (dateOnly(validEnd) < todayStr()) return { ok: false, item: null, message: '续期截止日期不能早于今天' };
    var list = ensure().certs;
    var idx = findIndexById(list, id);
    var target = list[idx];
    var oldEnd = target.validEnd;
    target.validEnd = dateOnly(validEnd);
    target.validStart = target.validStart || todayStr();
    target.status = 'active';
    target.renewNote = text(note);
    target.operator = text(operator);
    target.updatedAt = stampNow();
    pushAudit(target, operator, '续期', '有效期 ' + oldEnd + ' → ' + target.validEnd + (note ? '；' + text(note) : ''));
    commit('cert-renew:' + id);
    return { ok: true, item: clone(target), message: '' };
  }

  /** 删除：已生效 / 已撤销证书禁止删除，仅草稿可删 */
  function remove(id) {
    var list = ensure().certs;
    var idx = findIndexById(list, id);
    if (idx < 0) return { ok: false, message: '数据不存在或已被删除' };
    var item = list[idx];
    if (item.status !== 'draft') {
      return { ok: false, message: '仅草稿状态证书可删除，已生效证书请使用「作废」' };
    }
    list.splice(idx, 1);
    commit('cert-remove:' + id);
    return { ok: true, message: '' };
  }

  /* ============================================================
   * 合格证开具前置校验
   * ============================================================ */

  /** 读取物资使用记录（可选来源），用于安全间隔期校验 */
  function usageRecords() {
    try {
      var raw = localStorage.getItem(USAGE_RECORD_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  /**
   * 合格证开具前置校验：
   *   1. 批次必须存在于采收管理（HarvestStore）且采收已完成；
   *   2. 批次必须存在有效且结论合格的检测报告（TraceStore）；
   *   3. 若有农资使用记录，安全间隔期必须已过；
   *   4. 该批次不能重复开具同类型合格证。
   */
  function harvestGuard(batchNo, opts) {
    opts = opts || {};
    var b = text(batchNo);
    if (!b) return { ok: false, message: '请选择批次号' };

    var record = null;
    var harvestStore = global.HarvestStore;
    if (harvestStore && typeof harvestStore.records === 'function') {
      var recs = harvestStore.records();
      for (var i = 0; i < recs.length; i++) {
        if (text(recs[i].batchNo) === b) { record = recs[i]; break; }
      }
      if (!record) {
        return { ok: false, message: '批次 ' + b + ' 不存在于采收管理，无法开具合格证' };
      }
      if (record.status && record.status !== 'completed') {
        return { ok: false, message: '批次 ' + b + ' 采收尚未完成（当前：' + record.status + '），不能开具合格证' };
      }
    }

    var traceStore = global.TraceStore;
    if (traceStore && typeof traceStore.inspectionState === 'function') {
      var st = traceStore.inspectionState(b);
      if (st && !st.canCode) {
        return { ok: false, message: st.message || ('批次 ' + b + ' 无有效合格检测报告，不能开具合格证') };
      }
    }

    var usages = usageRecords();
    if (usages.length && record) {
      var harvestDate = dateOnly(record.startTime || record.harvestDate || '');
      var plot = text(record.plot);
      var latest = null;
      usages.forEach(function (u) {
        if (plot && text(u.plot) && text(u.plot) !== plot) return;
        var d = dateOnly(u.time || u.useDate);
        if (!d) return;
        if (!latest || d > latest.date) latest = { date: d, days: num(u.safetyInterval, 0) };
      });
      if (latest && harvestDate) {
        var safeDate = shiftDate(latest.date, latest.days);
        if (safeDate && safeDate > harvestDate) {
          return { ok: false, message: '地块 ' + plot + ' 于 ' + latest.date + ' 使用农资，安全间隔期 ' + latest.days + ' 天，最早可采收日 ' + safeDate + '，批次 ' + b + ' 不满足安全间隔期' };
        }
      }
    }

    if (!opts.skipDuplicate) {
      var dup = certsOfBatch(b).filter(function (c) {
        return c.typeCode === (opts.typeCode || 'quality_cert') && c.status !== 'revoked';
      })[0];
      if (dup) {
        return { ok: false, message: '该批次已开具' + typeName(opts.typeCode || 'quality_cert') + '（' + dup.certNo + '），不可重复开具' };
      }
    }

    return { ok: true, message: '' };
  }

  /* ============================================================
   * 跨页同步
   * ============================================================ */

  function reload() {
    inMemory = null;
    ensure();
    notify('storage');
  }

  function bindStorageEvent() {
    if (global.__certStoreBound) return;
    global.__certStoreBound = true;
    try {
      global.addEventListener('storage', function (e) {
        if (!e.key || e.key === STORAGE_KEY) reload();
      });
    } catch (e) {}
  }

  bindStorageEvent();

  /* ============================================================
   * 对外 API
   * ============================================================ */

  var CertStore = {
    STORAGE_KEY: STORAGE_KEY,
    VERSION: VERSION,
    CERT_TYPES: CERT_TYPES,
    QUALIFICATION_TYPES: QUALIFICATION_TYPES,
    BATCH_TYPES: BATCH_TYPES,
    STATUS: STATUS,
    FLOW: FLOW,
    WARN_DAYS: WARN_DAYS,
    URGENT_DAYS: URGENT_DAYS,
    DEPARTMENTS: DEPARTMENTS,

    certs: certs,
    get: get,
    getByNo: getByNo,
    qualifications: qualifications,
    batchCerts: batchCerts,
    certsOfBatch: certsOfBatch,

    saveCert: saveCert,
    remove: remove,
    advance: advance,
    submit: submit,
    approve: approve,
    reject: reject,
    revoke: revoke,
    renew: renew,

    filter: filter,
    stats: stats,
    expiringList: expiringList,
    computeStatus: computeStatus,
    remainDays: remainDays,
    statusGroup: statusGroup,
    nextCertNo: nextCertNo,

    typeOf: typeOf,
    typeName: typeName,
    typeNameOf: typeNameOf,
    categoryOf: categoryOf,
    prefixOf: prefixOf,

    harvestGuard: harvestGuard,
    usageRecords: usageRecords,

    stampNow: stampNow,
    today: todayStr,
    shiftDate: shiftDate,
    esc: esc,
    lastError: function () { return lastError; },

    /**
     * 资质临期 → 预警中心同步（幂等）
     * 已过期或 ≤30 天 → 紧急；≤90 天 → 重要。续期后从清单消失，自动闭环。
     */
    syncCertAlerts: function () {
      var S = global.AlertStore;
      if (!S || typeof S.syncSource !== 'function') {
        return { ok: false, message: '预警数据层未加载' };
      }
      var items = [];
      expiringList(90).forEach(function (c) {
        if (c.status === 'draft' || c.status === 'revoked') return;
        var d = remainDays(c);
        if (d === null) return;
        var urgent = d <= 30;
        var level = urgent ? 'urgent' : 'important';
        var name = typeNameOf(c) || c.name || c.typeCode;
        items.push({
          dedupeKey: 'cert:' + c.id + ':expire',
          type: 'farming',
          category: 'quality',
          title: (d < 0 ? '资质已过期：' : '资质临期：') + name,
          desc: (c.certNo || '') + ' 有效期至 ' + (c.validEnd || '') +
            '，剩余 ' + d + ' 天' + (c.scope ? '；覆盖范围：' + c.scope : ''),
          level: level,
          base: '',
          plot: '',
          plotCode: '',
          targetType: 'cert',
          targetId: c.id,
          threshold: '≤90 天',
          value: d
        });
      });
      return S.syncSource('cert', items, 'cert:');
    },

    subscribe: function (fn) {
      subscribers.push(fn);
      try { fn('init'); } catch (e) {}
      return function () { subscribers = subscribers.filter(function (x) { return x !== fn; }); };
    },

    reset: function () {
      inMemory = defaults();
      save();
      notify('reset');
      return certs();
    }
  };

  global.CertStore = CertStore;
})(window);
