/* ============================================================
 * 认养管理统一数据层 AdoptionStore
 * ------------------------------------------------------------
 * 设计约束（认养业务闭环）：
 *  1. 果树、认养订单、采收、认养农事统一由本数据层承载，页面禁止直接操作数据
 *  2. 统一主键：果树编号 A1-001 / 认养订单 AD-YYYYMMDD-NNNN / 合同 HT-YYYY-XXX
 *  3. 统一状态机：订单、果树、合同、退款四套流转，非法流转一律拒绝
 *  4. 跨端：移动端挂牌、H5 认养记录只读接入；本层写回移动端状态与 H5 认养记录
 *  5. 容错：读取损坏自动备份重建；写入失败记录错误并抛异常，不静默失败
 * ============================================================ */
(function (global) {
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
      { name: 'AdoptionMapper', src: baseDir + 'adoption-mapper.js' },
      { name: 'PlotStore', src: baseDir + 'plot-store.js' }
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

  function backendApi() {
    if (typeof global.Api !== 'object' && typeof global.Api !== 'function') return null;
    if (!global.Api.get || !global.Api.create) return null;
    if (typeof global.AdoptionMapper === 'undefined') return null;
    return global.Api;
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
      return api.get('adoption/aggregate');
    }).then(function (res) {
      if (res && res.ok && res.data) {
        // 严格模式：预加载在途期间用户保存过数据，保留本地结果，避免陈旧快照覆盖
        if (typeof global.__STRICT_DB_WRITES__ === "number" && global.__STRICT_DB_WRITES__ !== writeMark0) return res;
        var agg = global.AdoptionMapper.toAggregate(res.data);
        var e = ensure();
        ['trees', 'orders', 'harvests', 'farmings'].forEach(function (k) {
          e[k] = agg[k] || [];
        });
        save();
        notify('backend-loaded');
      }
      return res;
    }).catch(function (err) {
      console.warn('[AdoptionStore] 后端预加载失败，降级 localStorage', err);
      return { ok: false, message: err && err.message };
    });
  }
  function persistToBackend() {
    var api = backendApi();
    if (!api || !backendEnabled()) return Promise.resolve({ ok: false, message: '未登录或依赖未就绪' });
    var e = ensure();
    var agg = {
      trees: e.trees || [], orders: e.orders || [], harvests: e.harvests || [], farmings: e.farmings || [],
      certs: [], deleted: {},
    };
    var body = global.AdoptionMapper.fromAggregate(agg);
    return api.create('adoption/aggregate', body);
  }
  function schedulePersist(reason) {
    if (!backendEnabled()) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      persistTimer = null;
      persistToBackend().catch(function (e) { console.warn('[AdoptionStore] 后端持久化失败', e); });
    }, 300);
  }

  var STORAGE_KEY = 'applefarm_adoption_v1';
  var VERSION = 1;

  /* 跨端共用的既有 key（不迁移、不重命名，避免破坏移动端与 H5） */
  var CROSS = {
    adoptions: 'snzg_adoptions',
    tags: 'smartorchard_adoption_tags',
    tagArchive: 'smartorchard_adoption_tag_archive',
    tagPng: 'mb_adoption_tagging_png',
    reservations: 'smartorchard_harvest_reservations',
    photos: 'h5_adoption_photos',
    certs: 'adoption_certs',
    certTemplates: 'adoption_cert_templates',
    browseTrees: 'adoption_browse_trees',
    guide: 'adoption_guide',
    shipments: 'h5_sales_orders',
    h5Orders: 'h5_orders'
  };

  var TREE_STATUS = { AVAILABLE: 'available', ADOPTED: 'adopted', UNAVAILABLE: 'unavailable' };
  var ORDER_STATUS = { PENDING: 'pending', PAID: 'paid', COMPLETED: 'completed', REFUNDING: 'refunding', REFUNDED: 'refunded', CANCELLED: 'cancelled' };
  var CONTRACT_STATUS = { PENDING: 'pending', ACTIVE: 'active', EXPIRED: 'expired', TERMINATED: 'terminated' };
  var REFUND_STATUS = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' };
  var HARVEST_STATUS = { PENDING: 'pending', COMPLETED: 'completed', CANCELLED: 'cancelled' };
  var FARMING_STATUS = { PENDING: 'pending', PUSHED: 'pushed', FAILED: 'failed' };

  /* 合法流转表：只能是这些边，其余一律拒绝 */
  var FLOW = {
    order: {
      pending: ['paid', 'cancelled'],
      paid: ['completed', 'refunding'],
      completed: ['refunding'],
      refunding: ['refunded', 'paid'],
      refunded: [],
      cancelled: []
    },
    tree: {
      available: ['adopted', 'unavailable'],
      adopted: ['available'],
      unavailable: ['available']
    },
    contract: {
      pending: ['active', 'terminated'],
      active: ['expired', 'terminated'],
      expired: [],
      terminated: []
    },
    refund: {
      pending: ['approved', 'rejected'],
      approved: [],
      rejected: []
    }
  };

  var PAY_METHODS = { wechat: '微信支付', alipay: '支付宝', bank: '银行卡', offline: '线下转账' };
  var LEVELS = { single: '单株认养', mu: '按亩认养' };

  var VARIETY_CODE = {
    '花牛苹果': 'huaniu', '红富士': 'fuji', '金帅': 'jinshuai', '秦冠': 'qinguang',
    '嘎拉苹果': 'gala', '嘎拉': 'gala', '红星': 'redstar', '新红星': 'xinredstar',
    '国光': 'guoguang', '乔纳金': 'jonagold'
  };

  var subscribers = [];
  var inMemory = null;
  var lastError = '';

  /* ============================================================
   * 基础工具
   * ============================================================ */

  function pad(n, len) {
    var s = String(n);
    while (s.length < len) s = '0' + s;
    return s;
  }

  function todayStr(d) {
    var t = d || new Date();
    return t.getFullYear() + '-' + pad(t.getMonth() + 1, 2) + '-' + pad(t.getDate(), 2);
  }

  function dateStamp(d) {
    return todayStr(d).replace(/-/g, '');
  }

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function num(v, def) {
    var n = Number(v);
    return isFinite(n) ? n : (def == null ? 0 : def);
  }

  function fail(msg) {
    throw new Error(msg);
  }

  function need(v, msg) {
    if (v == null || String(v).trim() === '') fail(msg);
    return String(v).trim();
  }

  function readJSON(key, fallback) {
    var raw;
    try { raw = global.localStorage.getItem(key); } catch (e) { return fallback; }
    if (!raw) return fallback;
    try {
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      lastError = e && e.name === 'QuotaExceededError' ? '本地存储空间不足，数据未保存' : '数据保存失败';
      console.error('[AdoptionStore]', key, lastError, e);
      return false;
    }
  }

  /* ============================================================
   * 编号归一：全模块唯一入口，禁止页面各自猜测
   * 合法输出形如 A1-001 / G1-012
   * 接受输入：A1-001、AD-A1-001、A025、A1-025、花牛苹果 #A025
   * 无法识别一律返回空串，由调用方提示“编号待核”，不再静默错配
   * ============================================================ */

  function normalizeCode(raw) {
    var s = String(raw == null ? '' : raw).trim().toUpperCase();
    if (!s) return '';
    s = s.split('#').pop();
    s = s.replace(/\s+/g, '');
    s = s.replace(/^AD[-_]?/, '');
    var m = s.match(/^([A-Z]{1,2})(\d{1,2})-(\d{3})$/);
    if (m) return m[1] + String(parseInt(m[2], 10)) + '-' + m[3];
    m = s.match(/^([A-Z]{1,2})(\d{3})$/);
    if (m) return m[1] + '1-' + m[2];
    m = s.match(/^([A-Z]{1,2})(\d{1,2})(\d{3})$/);
    if (m) return m[1] + String(parseInt(m[2], 10)) + '-' + m[3];
    return '';
  }

  /* ============================================================
   * 种子数据：24 棵已认养 + 6 棵可认养池（与 H5/证书/相册编号一致）
   * ============================================================ */

  /* 严格空库模式：演示认养数据已清空，数据一律来自后端 API */
  var SEED_ADOPTED = [];

  /* 严格空库模式：演示认养数据已清空，数据一律来自后端 API */
  var SEED_POOL = [];

  function benefitsOf(variety, price) {
    var yieldMap = { '花牛苹果': 120, '嘎拉苹果': 100, '红富士': 130, '秦冠': 110, '乔纳金': 105, '新红星': 95 };
    return {
      expectedYield: yieldMap[variety] || 100,
      freePickupTimes: 2,
      deliveryIncluded: true,
      note: '全年产出归认养人所有，含冷链配送与专属证书'
    };
  }

  function addYears(dateStr, years) {
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    d.setFullYear(d.getFullYear() + num(years, 1));
    d.setDate(d.getDate() - 1);
    return todayStr(d);
  }

  /* ============================================================
   * 基地 / 地块主数据：统一来自 PlotStore（sf_plot）
   * 认养果树只存 plotId/plotCode 外键，基地名与地块名由主数据解析，避免各页各写一套
   * ============================================================ */
  function plotMaster() {
    if (!global.PlotStore) return [];
    return global.PlotStore.plots().filter(function (p) { return p.base; }).map(function (p) {
      return {
        id: String(p.id || ''),
        code: String(p.code || ''),
        name: String(p.name || ''),
        enterprise: String(p.base || ''),
        base: String(p.base || ''),
        area: num(p.area),
        variety: String(p.variety || '')
      };
    });
  }

  function bases() {
    var map = {};
    plotMaster().forEach(function (p) {
      map[p.enterprise] = (map[p.enterprise] || 0) + 1;
    });
    return Object.keys(map).map(function (name) {
      return { name: name, plotCount: map[name] };
    });
  }

  function plotsOfBase(base) {
    return plotMaster().filter(function (p) { return !base || p.enterprise === base; });
  }

  function plotOfId(id) {
    var key = String(id || '').trim();
    if (!key) return null;
    return plotMaster().filter(function (p) { return p.id === key || p.code === key; })[0] || null;
  }

  function defaults() {
    var trees = [];
    var orders = [];
    var harvests = [];
    var farmings = [];
    var stamp = new Date().toISOString();

    var plots = plotMaster();

    SEED_ADOPTED.forEach(function (r, i) {
      var code = r[0];
      var variety = r[1];
      var plot = plots.length ? plots[i % plots.length] : null;
      var start = r[6];
      var end = addYears(start, 3);
      var orderNo = 'AD-' + start.replace(/-/g, '') + '-' + pad(1001 + i, 4);
      var orderStatus = i < 20 ? ORDER_STATUS.PAID : ORDER_STATUS.COMPLETED;
      trees.push({
        id: 'T-' + code,
        treeCode: code,
        treeName: code + ' · ' + variety,
        variety: variety,
        varietyCode: VARIETY_CODE[variety] || 'huaniu',
        treeAge: r[9],
        baseName: plot.enterprise,
        plotName: plot.name,
        plotId: plot.id,
        plotCode: plot.code,
        price: r[7],
        level: 'single',
        benefits: benefitsOf(variety, r[7]),
        status: TREE_STATUS.ADOPTED,
        adopter: r[2],
        adopterPhone: r[3],
        customerId: 'U' + pad(1001 + i, 4),
        orderNo: orderNo,
        startDate: start,
        expireDate: end,
        duration: 3,
        growthStage: r[4],
        progress: r[5],
        cameraId: '',
        openMonitor: true,
        remark: '',
        source: 'seed',
        createdAt: stamp,
        updatedAt: stamp
      });
      orders.push({
        id: 'O-' + code,
        orderNo: orderNo,
        treeCode: code,
        treeName: code + ' · ' + variety,
        variety: variety,
        customerId: 'U' + pad(1001 + i, 4),
        adopter: r[2],
        phone: r[3],
        amount: r[7],
        duration: 3,
        startDate: start,
        endDate: end,
        renew: false,
        renewCount: 0,
        prevOrderNo: '',
        contractNo: 'HT-2026-' + pad(101 + i, 3),
        contractStatus: CONTRACT_STATUS.ACTIVE,
        payMethod: 'wechat',
        payTxnNo: '4200' + pad(70000000 + i * 137, 10),
        invoiceNo: '',
        invoiceStatus: 'none',
        level: 'single',
        benefits: benefitsOf(variety, r[7]),
        baseName: plot.enterprise,
        plotName: plot.name,
        plotId: plot.id,
        plotCode: plot.code,
        status: orderStatus,
        refund: { amount: 0, reason: '', remark: '', status: '', operator: '', time: '' },
        createdAt: stamp,
        updatedAt: stamp
      });
    });

    SEED_POOL.forEach(function (r, i) {
      var code = r[0];
      var plot = plots.length ? plots[(SEED_ADOPTED.length + i) % plots.length] : null;
      trees.push({
        id: 'T-' + code,
        treeCode: code,
        treeName: code + ' · ' + r[1],
        variety: r[1],
        varietyCode: VARIETY_CODE[r[1]] || 'huaniu',
        treeAge: r[2],
        baseName: plot.enterprise,
        plotName: plot.name,
        plotId: plot.id,
        plotCode: plot.code,
        price: r[3],
        level: 'single',
        benefits: benefitsOf(r[1], r[3]),
        status: r[4],
        adopter: '',
        adopterPhone: '',
        customerId: '',
        orderNo: '',
        startDate: '',
        expireDate: '',
        duration: 0,
        growthStage: 'idle',
        progress: 0,
        cameraId: '',
        openMonitor: !!r[5],
        remark: '',
        source: 'pool',
        createdAt: stamp,
        updatedAt: stamp
      });
    });

    /* 认养采收：历史已采 3 单 + 待采 1 单 */
    /* 严格空库模式：不播种任何演示采收记录 */
    var harvestSeed = [];
    harvestSeed.forEach(function (h, i) {
      var t = trees.filter(function (x) { return x.treeCode === h[0]; })[0];
      if (!t) return;
      harvests.push({
        id: 'HV-2026' + pad(i + 1, 3),
        treeCode: h[0],
        treeName: t.treeName,
        adopter: t.adopter,
        phone: t.adopterPhone,
        orderNo: t.orderNo,
        date: h[1],
        method: h[2],
        qty: h[3],
        status: h[4],
        source: 'backend',
        remark: '',
        createdAt: stamp,
        updatedAt: stamp
      });
    });

    /* 认养农事：3 条已推送 */
    [].forEach(function (code, i) {
      var t = trees.filter(function (x) { return x.treeCode === code; })[0];
      if (!t) return;
      farmings.push({
        id: 'FM-2026' + pad(i + 1, 3),
        treeCode: code,
        treeName: t.treeName,
        adopter: t.adopter,
        baseName: t.baseName,
        records: [
          { title: '春季修剪', type: '修剪', time: '2026-03-20' },
          { title: '花期授粉', type: '授粉', time: '2026-04-12' },
          { title: '套袋作业', type: '套袋', time: '2026-06-05' }
        ],
        count: 3,
        status: FARMING_STATUS.PUSHED,
        bindTime: '',
        source: 'backend',
        remark: '',
        createdAt: stamp,
        updatedAt: stamp
      });
    });

    return { version: VERSION, trees: trees, orders: orders, harvests: harvests, farmings: farmings };
  }

  /* ============================================================
   * 读写
   * ============================================================ */

  function load() {
    var raw;
    try { raw = global.localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    if (!raw) return null;
    try {
      var obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('数据结构异常');
      if (obj.version !== VERSION) return null;
      return obj;
    } catch (e) {
      try { global.localStorage.setItem(STORAGE_KEY + '_corrupt_' + Date.now(), raw); } catch (e2) {}
      console.warn('[AdoptionStore] 本地数据损坏，已备份并重新初始化', e);
      lastError = '本地认养数据损坏，已备份并重建';
      return null;
    }
  }

  function save() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemory));
      lastError = '';
      return true;
    } catch (e) {
      lastError = e && e.name === 'QuotaExceededError'
        ? '本地存储空间不足，数据未保存'
        : '数据保存失败：' + (e && e.message ? e.message : '浏览器存储不可用');
      console.error('[AdoptionStore]', lastError);
      return false;
    }
  }

  /* 旧数据没有地块外键时，按主数据顺序回填 plotId/plotCode 与基地地块名（只在首次升级时执行） */
  function migratePlots(state) {
    var plots = plotMaster();
    if (!plots.length) return false;
    var changed = false;
    var byCode = {};
    state.trees.forEach(function (t) { byCode[t.treeCode] = t; });
    state.trees.forEach(function (t, i) {
      if (t.plotId) return;
      var p = plots[i % plots.length];
      t.baseName = p.enterprise;
      t.plotName = p.name;
      t.plotId = p.id;
      t.plotCode = p.code;
      changed = true;
    });
    state.orders.forEach(function (o) {
      var t = byCode[o.treeCode];
      if (!t || o.plotId) return;
      o.baseName = t.baseName;
      o.plotName = t.plotName;
      o.plotId = t.plotId;
      o.plotCode = t.plotCode;
      changed = true;
    });
    return changed;
  }

  function ensure() {
    if (inMemory) return inMemory;
    var stored = load();
    var base = defaults();
    if (stored) {
      ['trees', 'orders', 'harvests', 'farmings'].forEach(function (k) {
        if (!Array.isArray(stored[k])) { stored[k] = base[k]; return; }
        var seen = {};
        stored[k] = stored[k].filter(function (x) {
          if (!x || typeof x !== 'object' || !x.id) return false;
          var id = String(x.id);
          if (seen[id]) return false;
          seen[id] = 1;
          return true;
        });
      });
      inMemory = stored;
      if (migratePlots(inMemory)) save();
    } else {
      inMemory = base;
      save();
      publishBrowsePool();
    }
    if (typeof depsReady !== 'undefined') preloadFromBackend();
    return inMemory;
  }

  function commit(reason) {
    var ok = save();
    if (ok) notify(reason || 'commit');
    if (typeof schedulePersist === 'function' && reason !== 'backend-loaded') schedulePersist(reason);
    return ok;
  }

  function notify(reason) {
    subscribers.forEach(function (fn) {
      try { fn(reason); } catch (e) { console.warn('[AdoptionStore]', e); }
    });
    // 窗口事件：页面在未持有 Store 引用时也能感知数据变化并重绘
    try {
      global.dispatchEvent(new CustomEvent('adoptionStoreChange', { detail: { reason: reason } }));
    } catch (e) { /* ignore */ }
  }

  function onChange(fn) {
    if (typeof fn === 'function') subscribers.push(fn);
  }

  function reload() {
    inMemory = null;
    ensure();
    notify('storage');
  }

  /* ============================================================
   * 查询
   * ============================================================ */

  function trees() { return ensure().trees; }
  function orders() { return ensure().orders; }
  function harvests() { return ensure().harvests; }
  function farmings() { return ensure().farmings; }
  function contracts() {
    return orders().map(function (o) {
      return {
        orderNo: o.orderNo,
        contractNo: o.contractNo,
        contractStatus: o.contractStatus,
        treeCode: o.treeCode,
        adopter: o.adopter,
        phone: o.phone,
        amount: o.amount,
        startDate: o.startDate,
        endDate: o.endDate,
        status: o.status
      };
    });
  }

  function findTree(raw) {
    var code = normalizeCode(raw);
    if (!code) return null;
    return trees().filter(function (t) { return t.treeCode === code; })[0] || null;
  }

  function findOrder(orderNo) {
    var key = String(orderNo || '').trim();
    if (!key) return null;
    return orders().filter(function (o) { return o.orderNo === key || o.id === key; })[0] || null;
  }

  function getTree(idOrCode) {
    var k = String(idOrCode || '');
    return trees().filter(function (t) { return t.id === k || t.treeCode === normalizeCode(k) || t.treeCode === k; })[0] || null;
  }

  /* ============================================================
   * 编号生成
   * ============================================================ */

  function nextOrderNo(date) {
    var stamp = dateStamp(date ? new Date(date + 'T00:00:00') : new Date());
    var used = {};
    orders().forEach(function (o) {
      var m = String(o.orderNo || '').match(/^AD-(\d{8})-(\d{4})$/);
      if (m && m[1] === stamp) used[Number(m[2])] = 1;
    });
    var n = 1;
    while (used[n]) n++;
    return 'AD-' + stamp + '-' + pad(n, 4);
  }

  function nextContractNo() {
    var year = new Date().getFullYear();
    var max = 0;
    contracts().forEach(function (c) {
      var m = String(c.contractNo || '').match(/^HT-(\d{4})-(\d{3})$/);
      if (m && Number(m[1]) === year) max = Math.max(max, Number(m[2]));
    });
    return 'HT-' + year + '-' + pad(max + 1, 3);
  }

  /* ============================================================
   * 果树
   * ============================================================ */

  function saveTree(payload) {
    var d = payload || {};
    var code = normalizeCode(d.treeCode || d.treeNo);
    if (!code) fail('果树编号格式不正确，请使用 A1-001 形式');
    var price = num(d.price, -1);
    if (price < 0) fail('认养价格不能为负数');
    var status = d.status || TREE_STATUS.AVAILABLE;
    if (!TREE_STATUS[String(status).toUpperCase()]) fail('果树状态不合法：' + status);

    var list = trees();
    var dup = list.filter(function (t) { return t.treeCode === code && t.id !== d.id; })[0];
    if (dup) fail('果树编号 ' + code + ' 已存在，请勿重复添加');

    var exist = d.id ? list.filter(function (t) { return t.id === d.id; })[0] : null;
    if (exist && exist.status !== status) {
      if (!(FLOW.tree[exist.status] || []).length) fail('果树当前状态不允许变更');
      if ((FLOW.tree[exist.status] || []).indexOf(status) < 0) {
        fail('果树状态不允许从「' + exist.status + '」直接变更为「' + status + '」');
      }
    }
    if (status === TREE_STATUS.ADOPTED && !String(d.adopter || '').trim()) fail('果树标记为已认养时必须填写认养人');
    if (d.adopterPhone && !/^1\d{10}$/.test(String(d.adopterPhone))) fail('认养人手机号格式不正确');

    /* 地块外键：有 plotId 时以主数据为准，禁止页面自造基地/地块名 */
    var plot = null;
    if (d.plotId) {
      plot = plotOfId(d.plotId);
      if (!plot) fail('所属地块不存在，请先在企业管理「地块总表」中维护');
    }

    var now = new Date().toISOString();
    var variety = String(d.variety || (exist && exist.variety) || '花牛苹果');
    var rec = {
      id: exist ? exist.id : 'T-' + code,
      treeCode: code,
      treeName: String(d.treeName || code + ' · ' + variety),
      variety: variety,
      varietyCode: VARIETY_CODE[variety] || 'huaniu',
      treeAge: num(d.treeAge, exist ? exist.treeAge : 8),
      baseName: plot ? plot.enterprise : String(d.baseName || (exist && exist.baseName) || ''),
      plotName: plot ? plot.name : String(d.plotName || (exist && exist.plotName) || ''),
      plotId: plot ? plot.id : String(d.plotId || (exist && exist.plotId) || ''),
      plotCode: plot ? plot.code : String(d.plotCode || (exist && exist.plotCode) || ''),
      price: price,
      level: d.level || (exist && exist.level) || 'single',
      benefits: d.benefits || (exist && exist.benefits) || benefitsOf(variety, price),
      status: status,
      adopter: status === TREE_STATUS.ADOPTED ? String(d.adopter || '').trim() : '',
      adopterPhone: status === TREE_STATUS.ADOPTED ? String(d.adopterPhone || '').trim() : '',
      customerId: d.customerId || (exist && exist.customerId) || '',
      orderNo: d.orderNo || (exist && exist.orderNo) || '',
      startDate: d.startDate || (exist && exist.startDate) || '',
      expireDate: d.expireDate || (exist && exist.expireDate) || '',
      duration: num(d.duration, exist ? exist.duration : 0),
      growthStage: d.growthStage || (exist && exist.growthStage) || 'idle',
      progress: num(d.progress, exist ? exist.progress : 0),
      cameraId: String(d.cameraId || (exist && exist.cameraId) || ''),
      openMonitor: d.openMonitor != null ? !!d.openMonitor : !!(exist && exist.openMonitor),
      remark: String(d.remark || (exist && exist.remark) || ''),
      source: exist ? exist.source : 'manual',
      createdAt: exist ? exist.createdAt : now,
      updatedAt: now
    };

    if (exist) {
      list[list.indexOf(exist)] = rec;
    } else {
      list.push(rec);
    }
    if (!commit('tree')) fail(lastError || '果树保存失败');
    publishBrowsePool();
    return clone(rec);
  }

  function removeTree(idOrCode) {
    var t = getTree(idOrCode);
    if (!t) fail('果树不存在或已被删除');
    var active = orders().filter(function (o) {
      return o.treeCode === t.treeCode && ['pending', 'paid', 'refunding'].indexOf(o.status) >= 0;
    });
    if (active.length) fail('该果树存在未完结的认养订单（' + active[0].orderNo + '），请先处理订单再删除');

    var s = ensure();
    s.trees = s.trees.filter(function (x) { return x.id !== t.id; });
    s.harvests = s.harvests.filter(function (x) { return x.treeCode !== t.treeCode; });
    s.farmings = s.farmings.filter(function (x) { return x.treeCode !== t.treeCode; });

    /* 级联：证书、成长相册、移动端挂牌 */
    var certs = readJSON(CROSS.certs, []);
    if (Array.isArray(certs)) {
      writeJSON(CROSS.certs, certs.filter(function (c) {
        return normalizeCode(c.treeNo || c.treeCode) !== t.treeCode;
      }));
    }
    var photos = readJSON(CROSS.photos, {});
    if (photos && typeof photos === 'object') {
      delete photos[t.treeCode];
      delete photos['AD-' + t.treeCode];
      writeJSON(CROSS.photos, photos);
    }
    var tags = readJSON(CROSS.tags, []);
    if (Array.isArray(tags)) {
      writeJSON(CROSS.tags, tags.filter(function (g) {
        return normalizeCode(g.treeCode || g.treeNo) !== t.treeCode;
      }));
    }

    if (!commit('tree-remove')) fail(lastError || '删除失败');
    publishBrowsePool();
    return true;
  }

  function setTreeStatus(idOrCode, status) {
    var t = getTree(idOrCode);
    if (!t) fail('果树不存在');
    if (t.status === status) return clone(t);
    if ((FLOW.tree[t.status] || []).indexOf(status) < 0) {
      fail('果树状态不允许从「' + t.status + '」变更为「' + status + '」');
    }
    t.status = status;
    t.updatedAt = new Date().toISOString();
    if (status !== TREE_STATUS.ADOPTED) {
      t.adopter = '';
      t.adopterPhone = '';
      t.orderNo = '';
    }
    commit('tree-status');
    publishBrowsePool();
    return clone(t);
  }

  /* ============================================================
   * 认养订单
   * ============================================================ */

  function saveOrder(payload) {
    var d = payload || {};
    var tree = findTree(d.treeCode || d.treeNo);
    if (!tree) fail('所选果树不存在，请先在认养果树中登记编号');
    var amount = num(d.amount, -1);
    if (amount <= 0) fail('认养金额必须大于 0');
    var duration = num(d.duration, 1);
    if (duration < 1 || duration > 10) fail('认养年限需在 1~10 年之间');
    var adopter = need(d.adopter, '请填写认养人姓名');
    if (d.phone && !/^1\d{10}$/.test(String(d.phone))) fail('认养人手机号格式不正确');
    var startDate = d.startDate || todayStr();
    var endDate = d.endDate || addYears(startDate, duration);
    if (new Date(endDate) <= new Date(startDate)) fail('认养截止日期必须晚于开始日期');

    var list = orders();
    var exist = d.orderNo ? findOrder(d.orderNo) : null;
    var status = d.status || ORDER_STATUS.PENDING;
    if (exist && exist.status !== status) {
      if ((FLOW.order[exist.status] || []).indexOf(status) < 0) {
        fail('订单状态不允许从「' + exist.status + '」变更为「' + status + '」');
      }
    }
    var validStatus = Object.keys(ORDER_STATUS).map(function (k) { return ORDER_STATUS[k]; });
    if (validStatus.indexOf(status) < 0) fail('订单状态不合法：' + status);

    /* 同一棵树只允许一个未完结订单 */
    var busy = list.filter(function (o) {
      return o.treeCode === tree.treeCode && o.orderNo !== (exist && exist.orderNo) &&
        ['pending', 'paid', 'refunding'].indexOf(o.status) >= 0;
    });
    if (busy.length) fail('该果树已有未完结订单（' + busy[0].orderNo + '），请先处理');

    var now = new Date().toISOString();
    var orderNo = exist ? exist.orderNo : (d.orderNo || nextOrderNo(startDate));
    var rec = {
      id: exist ? exist.id : 'O-' + orderNo,
      orderNo: orderNo,
      treeCode: tree.treeCode,
      treeName: tree.treeName,
      variety: tree.variety,
      customerId: String(d.customerId || (exist && exist.customerId) || ''),
      adopter: adopter,
      phone: String(d.phone || (exist && exist.phone) || ''),
      amount: amount,
      duration: duration,
      startDate: startDate,
      endDate: endDate,
      renew: !!(d.renew != null ? d.renew : (exist && exist.renew)),
      renewCount: num(d.renewCount, exist ? exist.renewCount : 0),
      prevOrderNo: String(d.prevOrderNo || (exist && exist.prevOrderNo) || ''),
      contractNo: String(d.contractNo || (exist && exist.contractNo) || nextContractNo()),
      contractStatus: d.contractStatus || (exist && exist.contractStatus) || CONTRACT_STATUS.PENDING,
      payMethod: String(d.payMethod || (exist && exist.payMethod) || ''),
      payTxnNo: String(d.payTxnNo || (exist && exist.payTxnNo) || ''),
      invoiceNo: String(d.invoiceNo || (exist && exist.invoiceNo) || ''),
      invoiceStatus: String(d.invoiceStatus || (exist && exist.invoiceStatus) || 'none'),
      level: d.level || tree.level || 'single',
      benefits: d.benefits || tree.benefits || benefitsOf(tree.variety, amount),
      baseName: tree.baseName,
      status: status,
      refund: exist ? exist.refund : { amount: 0, reason: '', remark: '', status: '', operator: '', time: '' },
      createdAt: exist ? exist.createdAt : now,
      updatedAt: now
    };

    if (exist) {
      list[list.indexOf(exist)] = rec;
    } else {
      list.push(rec);
    }
    if (!commit('order')) fail(lastError || '订单保存失败');

    if (status === ORDER_STATUS.PAID || status === ORDER_STATUS.COMPLETED) {
      bindTreeToOrder(rec);
    }
    return clone(rec);
  }

  function bindTreeToOrder(order) {
    var tree = findTree(order.treeCode);
    if (!tree) return;
    tree.status = TREE_STATUS.ADOPTED;
    tree.adopter = order.adopter;
    tree.adopterPhone = order.phone;
    tree.customerId = order.customerId;
    tree.orderNo = order.orderNo;
    tree.startDate = order.startDate;
    tree.expireDate = order.endDate;
    tree.duration = order.duration;
    tree.price = order.amount;
    tree.updatedAt = new Date().toISOString();
    save();
    publishBrowsePool();
    upsertH5Adoption(order, tree);
  }

  /** 支付成功：待支付 → 已支付，果树转已认养，合同生效，H5 认养记录落库 */
  function activateOrder(orderNo, payInfo) {
    var o = findOrder(orderNo);
    if (!o) fail('认养订单不存在');
    if (o.status === ORDER_STATUS.PAID || o.status === ORDER_STATUS.COMPLETED) {
      bindTreeToOrder(o);
      return clone(o);
    }
    if ((FLOW.order[o.status] || []).indexOf(ORDER_STATUS.PAID) < 0) {
      fail('订单当前状态（' + o.status + '）不可支付');
    }
    var info = payInfo || {};
    o.status = ORDER_STATUS.PAID;
    o.payMethod = String(info.payMethod || o.payMethod || 'wechat');
    o.payTxnNo = String(info.payTxnNo || o.payTxnNo || ('TXN' + Date.now()));
    o.updatedAt = new Date().toISOString();
    if (!commit('order-paid')) fail(lastError || '订单支付状态保存失败');

    /* 续费单支付生效：原订单置已完成，树有效期由新订单顺延 */
    if (o.renew && o.prevOrderNo) {
      var prev = findOrder(o.prevOrderNo);
      if (prev && prev.status !== ORDER_STATUS.COMPLETED &&
          (FLOW.order[prev.status] || []).indexOf(ORDER_STATUS.COMPLETED) >= 0) {
        prev.status = ORDER_STATUS.COMPLETED;
        if (prev.contractStatus === CONTRACT_STATUS.ACTIVE) prev.contractStatus = CONTRACT_STATUS.EXPIRED;
        prev.updatedAt = new Date().toISOString();
      }
    }
    bindTreeToOrder(o);
    return clone(o);
  }

  function completeOrder(orderNo) {
    var o = findOrder(orderNo);
    if (!o) fail('认养订单不存在');
    if ((FLOW.order[o.status] || []).indexOf(ORDER_STATUS.COMPLETED) < 0) {
      fail('仅已支付订单可标记为已完成');
    }
    o.status = ORDER_STATUS.COMPLETED;
    o.contractStatus = CONTRACT_STATUS.EXPIRED;
    o.updatedAt = new Date().toISOString();
    var tree = findTree(o.treeCode);
    if (tree) tree.status = TREE_STATUS.AVAILABLE;
    if (!commit('order-complete')) fail(lastError || '订单状态保存失败');
    publishBrowsePool();
    return clone(o);
  }

  function requestRefund(orderNo, payload) {
    var o = findOrder(orderNo);
    if (!o) fail('认养订单不存在');
    if ((FLOW.order[o.status] || []).indexOf(ORDER_STATUS.REFUNDING) < 0) {
      fail('仅已支付或已完成的订单可申请退款');
    }
    var d = payload || {};
    var amount = num(d.amount, 0);
    if (amount <= 0) fail('退款金额必须大于 0');
    if (amount > o.amount) fail('退款金额不能大于订单金额 ¥' + o.amount);
    var reason = need(d.reason, '请填写退款原因');

    o.status = ORDER_STATUS.REFUNDING;
    o.refund = {
      amount: amount,
      reason: reason,
      remark: String(d.remark || ''),
      status: REFUND_STATUS.PENDING,
      operator: '',
      time: new Date().toISOString()
    };
    o.updatedAt = new Date().toISOString();
    if (!commit('refund-request')) fail(lastError || '退款申请保存失败');
    return clone(o);
  }

  function reviewRefund(orderNo, approve, operator, remark) {
    var o = findOrder(orderNo);
    if (!o) fail('认养订单不存在');
    if (o.status !== ORDER_STATUS.REFUNDING) fail('该订单没有待审核的退款申请');
    var r = o.refund || {};
    if ((FLOW.refund[r.status] || []).indexOf(approve ? REFUND_STATUS.APPROVED : REFUND_STATUS.REJECTED) < 0) {
      fail('退款申请已审核，不能重复处理');
    }
    r.status = approve ? REFUND_STATUS.APPROVED : REFUND_STATUS.REJECTED;
    r.operator = String(operator || '');
    r.remark = String(remark || r.remark || '');
    r.time = new Date().toISOString();
    o.refund = r;
    o.updatedAt = new Date().toISOString();

    if (approve) {
      o.status = ORDER_STATUS.REFUNDED;
      o.contractStatus = CONTRACT_STATUS.TERMINATED;
      var tree = findTree(o.treeCode);
      if (tree) {
        tree.status = TREE_STATUS.AVAILABLE;
        tree.adopter = '';
        tree.adopterPhone = '';
        tree.customerId = '';
        tree.orderNo = '';
        tree.startDate = '';
        tree.expireDate = '';
        tree.duration = 0;
        tree.updatedAt = new Date().toISOString();
      }
      removeH5Adoption(o.treeCode);
    } else {
      o.status = ORDER_STATUS.PAID;
    }
    if (!commit('refund-review')) fail(lastError || '退款审核保存失败');
    publishBrowsePool();
    return clone(o);
  }

  function cancelOrder(orderNo) {
    var o = findOrder(orderNo);
    if (!o) fail('认养订单不存在');
    if ((FLOW.order[o.status] || []).indexOf(ORDER_STATUS.CANCELLED) < 0) {
      fail('当前状态不可取消');
    }
    o.status = ORDER_STATUS.CANCELLED;
    o.contractStatus = CONTRACT_STATUS.TERMINATED;
    o.updatedAt = new Date().toISOString();
    if (!commit('order-cancel')) fail(lastError || '订单取消失败');
    return clone(o);
  }

  /* ============================================================
   * 认养合同（电子签署）
   * ============================================================ */

  /** 简易摘要：仅用于页面留痕展示，不作为法律效力凭证 */
  function signDigest(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return 'D' + (h >>> 0).toString(16).toUpperCase() + pad(str.length, 4);
  }

  function contractOf(orderNo) {
    var o = findOrder(orderNo);
    if (!o) return null;
    return {
      orderNo: o.orderNo,
      contractNo: o.contractNo || '',
      contractStatus: o.contractStatus || CONTRACT_STATUS.PENDING,
      treeCode: o.treeCode,
      treeName: o.treeName,
      adopter: o.adopter,
      phone: o.phone,
      amount: o.amount,
      duration: o.duration,
      startDate: o.startDate,
      endDate: o.endDate,
      renew: !!o.renew,
      renewCount: num(o.renewCount),
      prevOrderNo: o.prevOrderNo || '',
      signedAt: o.signedAt || '',
      signer: o.signer || '',
      signMethod: o.signMethod || '',
      digest: o.digest || ''
    };
  }

  /** 合同签署：待签署 → 履约中；已签署幂等返回 */
  function signContract(orderNo, payload) {
    var o = findOrder(orderNo);
    if (!o) fail('认养订单不存在');
    if ([ORDER_STATUS.PAID, ORDER_STATUS.COMPLETED].indexOf(o.status) < 0) {
      fail('仅已支付或已完成的订单可签署合同');
    }
    if (o.contractStatus === CONTRACT_STATUS.ACTIVE) return contractOf(orderNo);
    if ((FLOW.contract[o.contractStatus] || []).indexOf(CONTRACT_STATUS.ACTIVE) < 0) {
      fail('合同当前状态不可签署');
    }
    var d = payload || {};
    var signer = need(d.signer != null ? d.signer : o.adopter, '请填写签署人');
    var method = String(d.method || 'esign');
    var signedAt = new Date().toISOString();
    o.contractStatus = CONTRACT_STATUS.ACTIVE;
    o.signedAt = signedAt;
    o.signer = signer;
    o.signMethod = method;
    o.digest = signDigest([o.contractNo, o.orderNo, o.adopter, o.amount, o.startDate, o.endDate, signer, signedAt].join('|'));
    o.updatedAt = signedAt;
    if (!commit('contract-sign')) fail(lastError || '合同签署保存失败');
    return contractOf(orderNo);
  }

  /* ============================================================
   * 在线续费
   * ============================================================ */

  /** 续费：原单为已支付/已完成，生成下一周期待支付订单 */
  function renewOrder(orderNo, payload) {
    var o = findOrder(orderNo);
    if (!o) fail('认养订单不存在');
    if ([ORDER_STATUS.PAID, ORDER_STATUS.COMPLETED].indexOf(o.status) < 0) {
      fail('仅已支付或已完成的订单可续费');
    }
    var d = payload || {};
    var years = num(d.duration, o.duration || 1);
    if (years < 1 || years > 10) fail('续费年限需在 1~10 年之间');
    var amount = num(d.amount, 0);
    if (amount <= 0) fail('续费金额必须大于 0');
    var tree = findTree(o.treeCode);
    if (!tree) fail('认养果树不存在，无法续费');
    var startDate = d.startDate || o.endDate || todayStr();
    var endDate = d.endDate || addYears(startDate, years);
    if (new Date(endDate) <= new Date(startDate)) fail('续费截止日期必须晚于开始日期');

    /* 直接生成续费单，跳过“同树仅一个未完结订单”校验（续费是原单的下一周期） */
    var now = new Date().toISOString();
    var no = nextOrderNo(startDate);
    var rec = {
      id: 'O-' + no,
      orderNo: no,
      treeCode: o.treeCode,
      treeName: o.treeName,
      variety: o.variety,
      customerId: o.customerId,
      adopter: String(d.adopter || o.adopter),
      phone: String(d.phone || o.phone || ''),
      amount: amount,
      duration: years,
      startDate: startDate,
      endDate: endDate,
      renew: true,
      renewCount: num(o.renewCount) + 1,
      prevOrderNo: o.orderNo,
      contractNo: nextContractNo(),
      contractStatus: CONTRACT_STATUS.PENDING,
      payMethod: '',
      payTxnNo: '',
      invoiceNo: '',
      invoiceStatus: 'none',
      level: o.level || tree.level || 'single',
      benefits: o.benefits || tree.benefits || benefitsOf(tree.variety, amount),
      baseName: o.baseName || tree.baseName,
      status: ORDER_STATUS.PENDING,
      refund: { amount: 0, reason: '', remark: '', status: '', operator: '', time: '' },
      createdAt: now,
      updatedAt: now
    };
    orders().push(rec);
    if (!commit('order-renew')) fail(lastError || '续费订单创建失败');
    return clone(rec);
  }

  /* ============================================================
   * H5 认养记录（跨端写回）
   * ============================================================ */

  function readAdoptions() {
    var list = readJSON(CROSS.adoptions, []);
    return Array.isArray(list) ? list : [];
  }

  function upsertH5Adoption(order, tree) {
    order = order || {};
    if (!tree) {
      var fallback = normalizeCode(order.treeCode || order.treeNo || order.id);
      tree = fallback ? findTree(fallback) : null;
    }
    if (!tree) fail('无法写入 H5 认养记录：果树不在认养台账中');
    var list = readAdoptions();
    var code = normalizeCode(tree.treeCode);
    var idx = -1;
    list.forEach(function (a, i) {
      if (normalizeCode(a.treeNo || a.id) === code) idx = i;
    });
    var rec = {
      id: 'AD-' + code,
      treeNo: code,
      treeName: tree.treeName,
      variety: tree.variety,
      adopter: order.adopter,
      phone: order.phone,
      user: order.customerId || '',
      userName: order.adopter,
      status: tree.growthStage === 'idle' ? 'growing' : tree.growthStage,
      progress: tree.progress,
      adoptDate: order.startDate,
      fee: order.amount,
      area: tree.baseName + ' ' + tree.plotName,
      period: order.duration + '年',
      startDate: order.startDate,
      expireDate: order.endDate,
      duration: order.duration,
      orderNo: order.orderNo,
      benefits: order.benefits,
      expectHarvest: '预计 2026-10 下旬可采',
      createTime: order.createdAt
    };
    if (idx >= 0) list[idx] = rec; else list.push(rec);
    writeJSON(CROSS.adoptions, list);
    return clone(rec);
  }

  function removeH5Adoption(treeCode) {
    var code = normalizeCode(treeCode);
    var list = readAdoptions().filter(function (a) { return normalizeCode(a.treeNo || a.id) !== code; });
    writeJSON(CROSS.adoptions, list);
  }

  function h5Adoptions() {
    return readAdoptions();
  }

  /* ============================================================
   * 认养采收
   * ============================================================ */

  function saveHarvest(payload) {
    var d = payload || {};
    var tree = findTree(d.treeCode);
    if (!tree) fail('所选果树不在认养台账中');
    var date = need(d.date, '请选择采收日期');
    var qty = num(d.qty, 0);
    if (qty <= 0) fail('采收数量必须大于 0');
    var order = orders().filter(function (o) {
      return o.treeCode === tree.treeCode && ['paid', 'completed'].indexOf(o.status) >= 0;
    })[0];
    if (!order) fail('该果树没有有效的认养订单，不能登记认养采收');

    var list = harvests();
    var exist = d.id ? list.filter(function (h) { return h.id === d.id; })[0] : null;
    var now = new Date().toISOString();
    var rec = {
      id: exist ? exist.id : 'HV-' + dateStamp(new Date(date + 'T00:00:00')) + '-' + pad(list.length + 1, 3),
      treeCode: tree.treeCode,
      treeName: tree.treeName,
      adopter: tree.adopter,
      phone: tree.adopterPhone,
      orderNo: order.orderNo,
      date: date,
      method: String(d.method || (exist && exist.method) || '到园采摘'),
      qty: qty,
      status: d.status || (exist && exist.status) || HARVEST_STATUS.PENDING,
      source: exist ? exist.source : 'backend',
      remark: String(d.remark || (exist && exist.remark) || ''),
      reservationId: d.reservationId || (exist && exist.reservationId) || '',
      createdAt: exist ? exist.createdAt : now,
      updatedAt: now
    };
    if (exist) list[list.indexOf(exist)] = rec; else list.push(rec);
    if (!commit('harvest')) fail(lastError || '采收记录保存失败');
    return clone(rec);
  }

  /** 采收确认后同步采收管理：自动建计划 + 采收记录 + 溯源批次 */
  function syncHarvestToStore(h) {
    var HS = global.HarvestStore;
    if (!HS || typeof HS.savePlan !== 'function' || typeof HS.saveRecord !== 'function') return;
    try {
      var tree = findTree(h.treeCode);
      if (!tree) return;
      var plist = typeof HS.plots === 'function' ? HS.plots() : [];
      var plot = plist.filter(function (p) { return p.code === tree.plotCode; })[0] ||
        plist.filter(function (p) { return p.base === tree.baseName; })[0];
      if (!plot) return;
      var qty = num(h.qty);
      if (!(qty > 0)) return;
      var day = h.date || todayStr();
      var start = day + ' 09:00';
      var end = day + ' 17:00';
      var operator = h.operator || tree.adopter || '认养管理员';
      var planRes = HS.savePlan({
        name: '认养采收 · ' + h.treeCode,
        manager: operator,
        base: tree.baseName,
        plot: plot.code,
        variety: tree.variety,
        plannedQty: qty,
        startTime: start,
        endTime: end,
        remark: '认养订单 ' + (h.orderNo || '-') + ' 自动同步'
      });
      if (!planRes || !planRes.ok) return;
      var recRes = HS.saveRecord({
        planId: planRes.item.id,
        base: tree.baseName,
        plot: plot.code,
        variety: tree.variety,
        qty: qty,
        level: 'level1',
        harvesters: operator,
        startTime: start,
        endTime: end,
        remark: '认养树 ' + h.treeCode + ' 自动同步'
      });
      if (!recRes || !recRes.ok) return;
      // 采收记录状态机：待处理 → 处理中 → 已完成，不能跨状态直达
      HS.advance('records', recRes.item.id, 'processing');
      HS.advance('records', recRes.item.id, 'completed');
      if (typeof HS.generateTraceCode === 'function') {
        HS.generateTraceCode(recRes.item.id);
      }
      var saved = typeof HS.get === 'function' ? HS.get('records', recRes.item.id) : null;
      h.harvestBatchNo = planRes.item.batchNo;
      h.traceCode = (saved && saved.traceCode) || recRes.item.traceCode || '';
    } catch (e) {
      console.warn('[AdoptionStore] 采收批次同步失败', e);
    }
  }

  /** 确认单条采收：只更新当前记录及其对应预约，不再批量误改其他预约 */
  function confirmHarvest(idOrCode, extra) {
    var key = String(idOrCode || '');
    var h = harvests().filter(function (x) { return x.id === key || x.treeCode === normalizeCode(key); })[0];
    if (!h) fail('采收记录不存在');
    if (h.status === HARVEST_STATUS.COMPLETED) fail('该采收记录已确认完成');
    if (h.status === HARVEST_STATUS.CANCELLED) fail('已取消的采收记录不可确认');

    var d = extra || {};
    if (d.qty != null && num(d.qty, 0) <= 0) fail('采收数量必须大于 0');
    h.status = HARVEST_STATUS.COMPLETED;
    if (d.qty != null) h.qty = num(d.qty, h.qty);
    if (d.date) h.date = String(d.date);
    if (d.method) h.method = String(d.method);
    h.updatedAt = new Date().toISOString();
    if (!commit('harvest-confirm')) fail(lastError || '采收确认失败');

    /* 同步采收管理：批次 / 采收记录 / 溯源码回写到认养采收记录 */
    syncHarvestToStore(h);
    if (h.harvestBatchNo || h.traceCode) commit('harvest-sync');

    /* 仅回写本条对应的移动端预约 */
    var reservations = readJSON(CROSS.reservations, []);
    if (Array.isArray(reservations)) {
      var changed = false;
      reservations.forEach(function (r) {
        var sameId = h.reservationId && r.id === h.reservationId;
        var sameTree = normalizeCode(r.treeId || r.treeName) === h.treeCode;
        if (sameId || (!h.reservationId && sameTree && r.status === 'pending')) {
          r.status = 'done';
          r.doneAt = h.updatedAt;
          changed = true;
        }
      });
      if (changed) writeJSON(CROSS.reservations, reservations);
    }

    /* 生成认养发货单（统一走 h5_sales_orders，与商城发货同源） */
    if (h.method === '冷链配送') {
      var ship = readJSON(CROSS.shipments, []);
      if (!Array.isArray(ship)) ship = [];
      if (!ship.filter(function (s) { return s.orderNo === h.orderNo; }).length) {
        ship.push({
          orderNo: h.orderNo,
          treeCode: h.treeCode,
          tracking: 'SF' + dateStamp(new Date()) + pad(ship.length + 1, 4),
          company: '顺丰冷链',
          shippedAt: h.updatedAt,
          source: 'adoption_harvest',
          status: '已发货'
        });
        writeJSON(CROSS.shipments, ship);
      }
    }
    return clone(h);
  }

  /* ============================================================
   * 跨端：移动端挂牌 / 农事绑定 / 采摘预约
   * ============================================================ */

  function mobileTags() {
    var list = readJSON(CROSS.tags, []);
    if (!Array.isArray(list)) return [];
    return list.filter(function (t) { return t && t.kind !== 'farming_bind'; });
  }

  function mobileFarmingBinds() {
    var list = readJSON(CROSS.tags, []);
    if (!Array.isArray(list)) return [];
    return list.filter(function (t) { return t && t.kind === 'farming_bind'; });
  }

  function reservations() {
    var list = readJSON(CROSS.reservations, []);
    return Array.isArray(list) ? list : [];
  }

  /** 移动端挂牌中编号未在果树池登记的记录，页面以“待建档”呈现，不再静默丢弃 */
  function unmatchedTags() {
    return mobileTags().filter(function (t) {
      return !findTree(t.treeCode || t.treeNo);
    });
  }

  function unmatchedH5Adoptions() {
    return h5Adoptions().filter(function (a) {
      return !findTree(a.treeNo || a.id);
    });
  }

  /** 新增后台认养农事记录 */
  function saveFarming(payload) {
    var d = payload || {};
    var tree = findTree(d.treeCode);
    if (!tree) fail('所选果树不在认养台账中');
    var records = Array.isArray(d.records) ? d.records : [];
    if (!records.length) fail('请至少填写一项农事记录');
    var now = new Date().toISOString();
    var list = farmings();
    var rec = {
      id: 'FM-' + dateStamp() + '-' + pad(list.length + 1, 3),
      treeCode: tree.treeCode,
      treeName: tree.treeName,
      adopter: tree.adopter,
      baseName: tree.baseName,
      records: records,
      count: records.length,
      status: d.status || FARMING_STATUS.PENDING,
      bindTime: d.bindTime || todayStr(),
      source: 'backend',
      remark: String(d.remark || ''),
      createdAt: now,
      updatedAt: now
    };
    list.push(rec);
    if (!commit('farming')) fail(lastError || '农事记录保存失败');
    return clone(rec);
  }

  /** 认养农事推送后同步生产管理：生成农事计划与待执行任务 */
  function syncFarmingToStore(f) {
    var PS = global.ProductionStore;
    if (!PS || typeof PS.upsert !== 'function' || typeof PS.plans !== 'function') return;
    try {
      var tree = findTree(f.treeCode);
      if (!tree || !tree.plotCode) return;
      var day = f.bindTime || todayStr();
      var manager = tree.adopter || f.adopter || '认养管理员';
      var plan = PS.plans().filter(function (p) {
        return p.source === 'adoption' && p.adoptionTreeCode === f.treeCode;
      })[0];
      if (!plan) {
        plan = PS.upsert('plans', {
          name: '认养农事 · ' + f.treeCode,
          base: tree.baseName,
          type: 'farming',
          manager: manager,
          startDate: day,
          endDate: day,
          plotRange: tree.plotCode,
          status: 'executing',
          source: 'adoption',
          adoptionTreeCode: f.treeCode,
          remark: '由认养农事推送自动生成'
        });
      }
      if (!plan) return;
      var tasks = PS.tasks();
      (f.records || []).forEach(function (r) {
        var title = r.title || r.type || '认养农事';
        var exists = tasks.some(function (t) {
          return t.source === 'adoption' && t.adoptionFarmingId === f.id && t.adoptionTitle === title;
        });
        if (exists) return;
        PS.upsert('tasks', {
          name: title + ' · ' + f.treeCode,
          base: tree.baseName,
          plot: tree.plotCode,
          person: manager,
          executorType: 'person',
          planId: plan.id,
          planTime: (r.time || day) + ' 09:00',
          deadline: r.time || day,
          status: 'pending',
          source: 'adoption',
          adoptionFarmingId: f.id,
          adoptionTitle: title,
          remark: '认养农事 ' + f.id + ' 自动同步'
        });
      });
      f.productionPlanId = plan.id;
    } catch (e) {
      console.warn('[AdoptionStore] 生产农事同步失败', e);
    }
  }

  /** 认养农事推送：状态写回本层与移动端同一条绑定记录 */
  function pushFarming(idOrCode) {
    var key = String(idOrCode || '');
    var f = farmings().filter(function (x) { return x.id === key || x.treeCode === normalizeCode(key); })[0];

    /* 移动端现场绑定：不在后台台账中，按绑定记录 id / 果树编号回写 */
    if (!f) {
      var tags = readJSON(CROSS.tags, []);
      if (!Array.isArray(tags)) tags = [];
      var target = tags.filter(function (t) {
        return t && t.kind === 'farming_bind' &&
          (t.id === key || (normalizeCode(key) && normalizeCode(t.treeCode || t.treeNo) === normalizeCode(key)));
      });
      if (!target.length) fail('农事记录不存在或已被删除');
      target.forEach(function (t) {
        t.status = 'pushed';
        t.pushedAt = new Date().toISOString();
      });
      if (!writeJSON(CROSS.tags, tags)) fail(lastError || '推送状态保存失败');
      notify('farming-push');
      return clone(target[0]);
    }

    f.status = FARMING_STATUS.PUSHED;
    f.updatedAt = new Date().toISOString();
    if (!commit('farming-push')) fail(lastError || '推送状态保存失败');

    /* 同步生产管理：农事计划 + 待执行任务 */
    syncFarmingToStore(f);
    if (f.productionPlanId) commit('farming-sync');

    var tags = readJSON(CROSS.tags, []);
    if (Array.isArray(tags)) {
      var changed = false;
      tags.forEach(function (t) {
        if (t.kind === 'farming_bind' && normalizeCode(t.treeCode || t.treeNo) === f.treeCode) {
          t.status = 'pushed';
          t.pushedAt = f.updatedAt;
          changed = true;
        }
      });
      if (changed) writeJSON(CROSS.tags, tags);
    }
    return clone(f);
  }

  /* ============================================================
   * 展示池同步：供移动端 mb_adoption_browse.html 读取
   * ============================================================ */

  function publishBrowsePool() {
    var list = trees().map(function (t) {
      return {
        treeNo: t.treeCode,
        variety: t.varietyCode,
        varietyName: t.variety,
        treeAge: t.treeAge,
        price: t.price,
        status: t.status,
        cameraId: t.cameraId,
        openMonitor: !!t.openMonitor,
        baseName: t.baseName,
        plotName: t.plotName,
        benefits: t.benefits,
        level: t.level,
        adopter: t.status === TREE_STATUS.ADOPTED ? t.adopter : ''
      };
    });
    writeJSON(CROSS.browseTrees, list);
    return list;
  }

  function browsePool() {
    var list = readJSON(CROSS.browseTrees, []);
    return Array.isArray(list) ? list : [];
  }

  /* ============================================================
   * 成长相册 / 证书（只读接入 + 级联）
   * ============================================================ */

  function photosOf(code) {
    var all = readJSON(CROSS.photos, {});
    var c = normalizeCode(code);
    if (!all || typeof all !== 'object') return [];
    return all[c] || all['AD-' + c] || [];
  }

  function certs() {
    var list = readJSON(CROSS.certs, []);
    return Array.isArray(list) ? list : [];
  }

  function certOf(code) {
    var c = normalizeCode(code);
    return certs().filter(function (x) { return normalizeCode(x.treeNo || x.treeCode) === c; })[0] || null;
  }

  function nextCertNo() {
    var prefix = 'AD' + new Date().getFullYear();
    var max = 0;
    certs().forEach(function (c) {
      var no = String(c.certNo || '');
      if (no.indexOf(prefix) !== 0) return;
      var n = parseInt(no.slice(prefix.length), 10);
      if (!isNaN(n)) max = Math.max(max, n);
    });
    return prefix + pad(max + 1, 6);
  }

  /** 认养证书签发 / 撤销后镜像到统一证书域（cert-store.js 存在时） */
  function syncCertToDomain(rec) {
    var CS = global.CertStore;
    if (!CS || typeof CS.saveCert !== 'function' || typeof CS.certs !== 'function') return;
    if (rec.status !== 'issued' && rec.status !== 'revoked') return;
    try {
      var sourceNo = 'ADOPTION:' + rec.certNo;
      var exist = CS.certs().filter(function (c) { return c.sourceNo === sourceNo; })[0] || null;
      var start = rec.periodStart || rec.issueDate || todayStr();
      var end = rec.periodEnd || addYears(start, 1);
      var res = CS.saveCert({
        id: exist ? exist.id : '',
        certNo: exist ? exist.certNo : '',
        typeCode: 'adoption',
        batchNo: rec.orderNo || rec.certNo,
        validStart: start,
        validEnd: end,
        status: rec.status === 'revoked' ? 'revoked' : 'active',
        issueDate: rec.issueDate || start,
        issueOrg: '天水花牛苹果（集团）有限责任公司',
        customer: rec.adopter || '',
        product: '认养权证书',
        variety: rec.variety || '',
        scope: '认养树 AD-' + rec.treeNo,
        owner: '认养管理',
        sourceNo: sourceNo,
        remark: '由认养证书 ' + rec.certNo + ' 自动同步'
      });
      if (res && res.ok && res.item) rec.domainCertNo = res.item.certNo;
    } catch (e) {
      console.warn('[AdoptionStore] 证书域同步失败', e);
    }
  }

  /** 证书保存：按果树编号归一 upsert，果树必须在认养台账中 */
  function saveCert(payload) {
    var d = payload || {};
    var code = normalizeCode(d.treeNo || d.treeCode);
    if (!code) fail('证书关联的果树编号格式不正确');
    var tree = findTree(code);
    if (!tree) fail('证书关联的果树不在认养台账中：' + code);

    var list = certs();
    var certNo = String(d.certNo || '').trim();
    if (certNo) {
      var dup = list.filter(function (c) {
        return c.certNo === certNo && normalizeCode(c.treeNo || c.treeCode) !== code;
      })[0];
      if (dup) fail('证书编号 ' + certNo + ' 已被其他果树使用');
    } else {
      certNo = nextCertNo();
    }

    var exist = list.filter(function (c) {
      return c.certNo === certNo || normalizeCode(c.treeNo || c.treeCode) === code;
    })[0] || null;
    var now = new Date().toISOString();
    var order = orders().filter(function (o) {
      return o.treeCode === code && [ORDER_STATUS.PAID, ORDER_STATUS.COMPLETED].indexOf(o.status) >= 0;
    })[0] || null;
    var rec = {
      certNo: certNo,
      treeNo: code,
      treeFull: 'AD-' + code,
      adopter: String(d.adopter || (exist && exist.adopter) || tree.adopter || ''),
      periodStart: String(d.periodStart || (exist && exist.periodStart) || (order ? order.startDate : '')),
      periodEnd: String(d.periodEnd || (exist && exist.periodEnd) || (order ? order.endDate : '')),
      variety: String(d.variety || (exist && exist.variety) || tree.variety || ''),
      expectedYield: String(d.expectedYield || (exist && exist.expectedYield) || ''),
      base: String(d.base || (exist && exist.base) || tree.baseName || ''),
      plot: String(d.plot || (exist && exist.plot) || tree.plotName || ''),
      issueDate: String(d.issueDate || (exist && exist.issueDate) || todayStr()),
      status: String(d.status || (exist && exist.status) || 'pending'),
      issuedBy: String(d.issuedBy || (exist && exist.issuedBy) || ''),
      issueTime: String(d.issueTime || (exist && exist.issueTime) || ''),
      revokeReason: String(d.revokeReason || (exist && exist.revokeReason) || ''),
      templateId: String(d.templateId || (exist && exist.templateId) || ''),
      orderNo: String(d.orderNo || (exist && exist.orderNo) || (order ? order.orderNo : '')),
      amount: num(d.amount, exist ? exist.amount : (order ? order.amount : 0)),
      createTime: String((exist && exist.createTime) || d.createTime || now),
      updatedAt: now
    };
    if (exist) list[list.indexOf(exist)] = rec; else list.unshift(rec);
    /* 签发 / 撤销时同步到统一证书域，证书管理页可统一检索 */
    syncCertToDomain(rec);
    if (!writeJSON(CROSS.certs, list)) fail(lastError || '证书保存失败');
    notify('cert');
    return clone(rec);
  }

  function removeCert(certNo) {
    var key = String(certNo || '').trim();
    if (!key) fail('请指定要删除的证书编号');
    var list = certs();
    var next = list.filter(function (c) { return c.certNo !== key; });
    if (next.length === list.length) fail('证书不存在或已被删除');
    if (!writeJSON(CROSS.certs, next)) fail(lastError || '证书删除失败');
    notify('cert');
    return true;
  }

  /** 成长相册新增：写入 CROSS.photos 对象结构 { treeCode: [{url,time,stage}] } */
  function addPhoto(treeCode, payload) {
    var raw = String(treeCode || '').trim();
    var code = normalizeCode(raw) || raw.toUpperCase();
    if (!code) fail('果树编号不能为空');
    var d = payload || {};
    var url = need(d.url, '照片地址不能为空');
    var rec = {
      url: url,
      time: String(d.time || todayStr()),
      stage: String(d.stage || '生长')
    };
    var all = readJSON(CROSS.photos, {});
    if (!all || typeof all !== 'object' || Array.isArray(all)) all = {};
    var arr = Array.isArray(all[code]) ? all[code] : (Array.isArray(all['AD-' + code]) ? all['AD-' + code] : []);
    arr.push(rec);
    all[code] = arr;
    if (all['AD-' + code]) delete all['AD-' + code];
    if (!writeJSON(CROSS.photos, all)) fail(lastError || '照片保存失败');
    notify('photo');
    return clone(rec);
  }

  /** 成长相册删除：按照片地址删除一条，编号同样归一 */
  function removePhoto(treeCode, url) {
    var raw = String(treeCode || '').trim();
    var code = normalizeCode(raw) || raw.toUpperCase();
    var target = String(url || '');
    if (!code || !target) fail('请指定要删除的照片');
    var all = readJSON(CROSS.photos, {});
    if (!all || typeof all !== 'object' || Array.isArray(all)) fail('照片数据不存在');
    var key = Array.isArray(all[code]) ? code : (Array.isArray(all['AD-' + code]) ? 'AD-' + code : '');
    if (!key) fail('该果树暂无成长照片');
    var arr = all[key];
    var idx = -1;
    arr.forEach(function (p, i) { if (i >= 0 && idx < 0 && p && String(p.url) === target) idx = i; });
    if (idx < 0) fail('照片不存在或已被删除');
    arr.splice(idx, 1);
    if (arr.length) all[code] = arr; else delete all[code];
    if (key !== code) delete all[key];
    if (!writeJSON(CROSS.photos, all)) fail(lastError || '照片删除失败');
    notify('photo');
    return true;
  }

  /* ============================================================
   * 统计
   * ============================================================ */

  function stats() {
    var ts = trees();
    var os = orders();
    var today = todayStr();
    var adopted = ts.filter(function (t) { return t.status === TREE_STATUS.ADOPTED; }).length;
    var available = ts.filter(function (t) { return t.status === TREE_STATUS.AVAILABLE; }).length;
    var expiring = os.filter(function (o) {
      return ['paid', 'completed'].indexOf(o.status) >= 0 && o.endDate && o.endDate >= today;
    }).filter(function (o) {
      var diff = (new Date(o.endDate) - new Date(today)) / 86400000;
      return diff >= 0 && diff <= 90;
    }).length;
    var revenue = os.filter(function (o) {
      return ['paid', 'completed'].indexOf(o.status) >= 0;
    }).reduce(function (s, o) { return s + num(o.amount); }, 0);
    var renewBase = os.filter(function (o) {
      return ['paid', 'completed', 'refunded'].indexOf(o.status) >= 0;
    });
    var renewed = renewBase.filter(function (o) { return o.renew || o.renewCount > 0; }).length;
    var refundedAmount = os.reduce(function (s, o) {
      return s + (o.refund && o.refund.status === REFUND_STATUS.APPROVED ? num(o.refund.amount) : 0);
    }, 0);
    return {
      treeTotal: ts.length,
      adopted: adopted,
      available: available,
      occupancy: ts.length ? Math.round(adopted / ts.length * 1000) / 10 : 0,
      orderTotal: os.length,
      orderPaid: os.filter(function (o) { return o.status === ORDER_STATUS.PAID; }).length,
      orderPending: os.filter(function (o) { return o.status === ORDER_STATUS.PENDING; }).length,
      orderRefunding: os.filter(function (o) { return o.status === ORDER_STATUS.REFUNDING; }).length,
      revenue: revenue,
      refundedAmount: refundedAmount,
      expiring: expiring,
      renewRate: renewBase.length ? Math.round(renewed / renewBase.length * 1000) / 10 : 0
    };
  }

  /* ============================================================
   * 生命周期
   * ============================================================ */

  function reset() {
    inMemory = defaults();
    save();
    publishBrowsePool();
    notify('reset');
    return inMemory;
  }

  function bindStorageEvent() {
    if (global.__adoptionStoreBound) return;
    global.__adoptionStoreBound = true;
    try {
      global.addEventListener('storage', function (e) {
        if (!e.key || e.key === STORAGE_KEY) reload();
      });
    } catch (e) {}
  }
  bindStorageEvent();

  var AdoptionStore = {
    STORAGE_KEY: STORAGE_KEY,
    VERSION: VERSION,
    CROSS: CROSS,
    TREE_STATUS: TREE_STATUS,
    ORDER_STATUS: ORDER_STATUS,
    CONTRACT_STATUS: CONTRACT_STATUS,
    REFUND_STATUS: REFUND_STATUS,
    HARVEST_STATUS: HARVEST_STATUS,
    FARMING_STATUS: FARMING_STATUS,
    FLOW: FLOW,
    PAY_METHODS: PAY_METHODS,
    LEVELS: LEVELS,

    normalizeCode: normalizeCode,
    trees: trees,
    orders: orders,
    harvests: harvests,
    farmings: farmings,
    contracts: contracts,
    stats: stats,

    findTree: findTree,
    getTree: getTree,
    findOrder: findOrder,

    saveTree: saveTree,
    removeTree: removeTree,
    setTreeStatus: setTreeStatus,
    plotMaster: plotMaster,
    bases: bases,
    plotsOfBase: plotsOfBase,
    plotOfId: plotOfId,

    saveOrder: saveOrder,
    activateOrder: activateOrder,
    completeOrder: completeOrder,
    requestRefund: requestRefund,
    reviewRefund: reviewRefund,
    cancelOrder: cancelOrder,
    renewOrder: renewOrder,
    contractOf: contractOf,
    signContract: signContract,

    saveHarvest: saveHarvest,
    confirmHarvest: confirmHarvest,

    mobileTags: mobileTags,
    mobileFarmingBinds: mobileFarmingBinds,
    reservations: reservations,
    unmatchedTags: unmatchedTags,
    unmatchedH5Adoptions: unmatchedH5Adoptions,
    pushFarming: pushFarming,
    saveFarming: saveFarming,
    h5Adoptions: h5Adoptions,
    upsertH5Adoption: upsertH5Adoption,

    publishBrowsePool: publishBrowsePool,
    browsePool: browsePool,
    photosOf: photosOf,
    certs: certs,
    certOf: certOf,
    saveCert: saveCert,
    removeCert: removeCert,
    addPhoto: addPhoto,
    removePhoto: removePhoto,
    nextCertNo: nextCertNo,

    nextOrderNo: nextOrderNo,
    nextContractNo: nextContractNo,
    addYears: addYears,
    benefitsOf: benefitsOf,

    onChange: onChange,
    reload: reload,
    reset: reset,
    get lastError() { return lastError; }
  };

  global.AdoptionStore = AdoptionStore;
})(window);
