/* ============================================================
 * 销售管理统一数据层 SalesStore
 * ------------------------------------------------------------
 * 覆盖：客户、销售订单、收款、发货物流、售后、价格政策、
 *       促销活动、销售目标、客户对账单、统计口径。
 * 约定：
 *   1) 所有金额统一以「元」存储，展示层再决定元/万元；
 *   2) 订单主键统一 XS-YYYYMMDD-NNNN，订单必须绑定客户；
 *   3) 所有写操作返回 { ok, data } 或 { ok:false, message }；
 *   4) H5 商城订单只读镜像（h5_orders / h5_sales_orders），
 *      C 端发货仍归商城管理，销售订单页不重复发货。
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
      { name: 'SalesMapper', src: baseDir + 'sales-mapper.js' }
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
    if (typeof global.SalesMapper === 'undefined') return null;
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
      return api.get('sales/aggregate');
    }).then(function (res) {
      if (res && res.ok && res.data) {
        // 严格模式：预加载在途期间用户保存过数据，保留本地结果，避免陈旧快照覆盖
        if (typeof global.__STRICT_DB_WRITES__ === "number" && global.__STRICT_DB_WRITES__ !== writeMark0) return res;
        var agg = global.SalesMapper.toAggregate(res.data);
        var e = ensure();
        var keys = ['customers', 'orders', 'payments', 'shipments', 'afterSales', 'pricePolicies', 'promotions', 'targets', 'statements'];
        keys.forEach(function (k) {
          e[k] = agg[k] || [];
        });
        writeJSON(STORAGE_KEY, e);
        notify('backend-loaded');
      }
      return res;
    }).catch(function (err) {
      console.warn('[SalesStore] 后端预加载失败，降级 localStorage', err);
      return { ok: false, message: err && err.message };
    });
  }
  function persistToBackend() {
    var api = backendApi();
    if (!api || !backendEnabled()) return Promise.resolve({ ok: false, message: '未登录或依赖未就绪' });
    var e = ensure();
    var agg = {
      customers: e.customers || [], orders: e.orders || [], payments: e.payments || [],
      shipments: e.shipments || [], afterSales: e.afterSales || [], pricePolicies: e.pricePolicies || [],
      promotions: e.promotions || [], targets: e.targets || [], statements: e.statements || [], deleted: {},
    };
    var body = global.SalesMapper.fromAggregate(agg);
    return api.create('sales/aggregate', body);
  }
  function schedulePersist(reason) {
    if (!backendEnabled()) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      persistTimer = null;
      persistToBackend().catch(function (e) { console.warn('[SalesStore] 后端持久化失败', e); });
    }, 300);
  }

  var STORAGE_KEY = 'applefarm_sales_v1';
  var VERSION = 1;
  var DAY = 86400000;
  var NOW_REF = new Date();

  /* ---------------- 枚举 ---------------- */
  var ORDER_STATUS = {
    confirm: 'confirm',
    pending: 'pending',
    paid: 'paid',
    shipped: 'shipped',
    completed: 'completed',
    cancelled: 'cancelled',
    refunding: 'refunding',
    refunded: 'refunded',
    returning: 'returning',
    returned: 'returned',
    closed: 'closed'
  };

  var ORDER_STATUS_TEXT = {
    confirm: '待确认',
    pending: '待付款',
    paid: '待发货',
    shipped: '已发货',
    completed: '已完成',
    cancelled: '已取消',
    refunding: '退款中',
    refunded: '已退款',
    returning: '退货中',
    returned: '已退货',
    closed: '已关闭'
  };

  var PAY_STATUS_TEXT = {
    unpaid: '未付款',
    partial: '部分付款',
    paid: '已付清',
    refunded: '已退款'
  };

  var TYPE_TEXT = {
    wholesale: '批发订单',
    retail: '零售订单',
    adoption: '认养订单',
    tour: '观光采摘'
  };

  var CHANNEL_TEXT = {
    wholesale: '批发渠道',
    retail: '零售渠道',
    adoption: '认养渠道',
    tour: '观光采摘'
  };

  var CUSTOMER_TYPE_TEXT = {
    wholesale: '批发客户',
    retail: '零售客户',
    adoption: '认养用户'
  };

  var LEVEL_TEXT = {
    vip: 'VIP客户',
    gold: '黄金客户',
    silver: '白银客户'
  };

  var SOURCE_TEXT = {
    manual: '手工录入',
    h5: 'H5 商城',
    contract: '合同订单',
    phone: '电话订单'
  };

  var PAY_METHOD_TEXT = {
    wechat: '微信支付',
    alipay: '支付宝',
    bank: '银行转账',
    cash: '现金',
    offline: '线下结算'
  };

  var SHIP_COMPANIES = ['顺丰速运', '京东物流', '圆通速递', '韵达快递', '中通快递'];

  var AS_TYPE_TEXT = { refund: '仅退款', return: '退货退款', exchange: '换货' };
  var AS_STATUS_TEXT = {
    pending: '待审核',
    processing: '处理中',
    refunding: '退款中',
    returning: '退货中',
    refunded: '已退款',
    returned: '已退货',
    rejected: '已驳回',
    completed: '已完成'
  };

  var TARGET_STATUS_TEXT = { pending: '未开始', ongoing: '进行中', done: '已达成', missed: '未达成' };
  var STATEMENT_STATUS_TEXT = { draft: '待确认', confirmed: '已确认', settled: '已结清' };
  var POLICY_STATUS_TEXT = { upcoming: '即将生效', active: '生效中', expired: '已失效', disabled: '已停用' };
  var PROMO_STATUS_TEXT = { upcoming: '未开始', active: '进行中', ended: '已结束', disabled: '已停用' };

  var FLOW = {
    confirm: ['pending', 'cancelled'],
    pending: ['paid', 'cancelled'],
    paid: ['shipped', 'refunding', 'cancelled'],
    shipped: ['completed', 'returning', 'refunding'],
    completed: ['returning', 'closed'],
    refunding: ['refunded', 'paid'],
    returning: ['returned'],
    refunded: [],
    returned: [],
    cancelled: [],
    closed: []
  };

  /* ---------------- 通用工具 ---------------- */
  var db = null;
  var listeners = [];

  function pad(n, len) {
    var s = String(n);
    while (s.length < (len || 2)) s = '0' + s;
    return s;
  }

  function clone(obj) {
    try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return obj; }
  }

  function toNum(v) {
    var n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  function round2(n) {
    return Math.round((toNum(n) + Number.EPSILON) * 100) / 100;
  }

  function parseDate(v) {
    if (!v) return null;
    var d = v instanceof Date ? v : new Date(String(v).replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d;
  }

  function ymd(d) {
    d = parseDate(d) || new Date();
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  }

  function ym(d) {
    d = parseDate(d) || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }

  function nowIso() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
      pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function fmtDate(v) {
    var d = parseDate(v);
    if (!d) return '—';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function fmtTime(v) {
    var d = parseDate(v);
    if (!d) return '—';
    return fmtDate(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function fmtMoney(n) {
    var v = round2(n);
    return '¥' + v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtWan(n) {
    return (toNum(n) / 10000).toFixed(1) + ' 万';
  }

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var val = JSON.parse(raw);
      return val == null ? fallback : val;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      console.error('[SalesStore] 写入失败：' + key, e);
      return false;
    }
  }

  function ok(data) { return { ok: true, data: data }; }
  function fail(message) { return { ok: false, message: message }; }

  function persist(reason) {
    if (!writeJSON(STORAGE_KEY, db)) return false;
    notify(reason || 'change');
    if (typeof schedulePersist === 'function') schedulePersist(reason);
    return true;
  }

  function notify(reason) {
    listeners.slice().forEach(function (fn) {
      try { fn(reason); } catch (e) { console.error('[SalesStore] 订阅回调异常', e); }
    });
    // 窗口事件：页面在未持有 Store 引用时也能感知数据变化并重绘
    try {
      global.dispatchEvent(new CustomEvent('salesStoreChange', { detail: { reason: reason } }));
    } catch (e) { /* ignore */ }
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  /* ---------------- 种子数据 ---------------- */
  var CUSTOMER_SEED = [];

  var PRODUCTS = {
    wholesale: [
      { sku: 'SKU-HN-01', name: '花牛苹果', spec: '75mm 以上 / 10kg 箱', unit: 'kg', price: 0 },
      { sku: 'SKU-FJ-01', name: '红富士苹果', spec: '80mm 以上 / 10kg 箱', unit: 'kg', price: 0 },
      { sku: 'SKU-JS-01', name: '金帅苹果', spec: '70mm 以上 / 10kg 箱', unit: 'kg', price: 0 },
      { sku: 'SKU-QG-01', name: '秦冠苹果', spec: '70mm 以上 / 10kg 箱', unit: 'kg', price: 0 }
    ],
    retail: [
      { sku: 'SKU-GIFT-01', name: '精品礼盒装苹果', spec: '12 枚 / 盒', unit: '盒', price: 0 },
      { sku: 'SKU-FAM-01', name: '家庭装苹果', spec: '10 斤 / 箱', unit: '箱', price: 0 },
      { sku: 'SKU-GIFT-02', name: '花牛苹果礼盒', spec: '9 枚 / 盒', unit: '盒', price: 0 }
    ],
    adoption: [
      { sku: 'SKU-ADOPT-01', name: '认养果树（红富士·1年）', spec: '含全年管护与 20kg 配送', unit: '棵', price: 0 },
      { sku: 'SKU-ADOPT-02', name: '认养果树（花牛·1年）', spec: '含全年管护与 15kg 配送', unit: '棵', price: 0 },
      { sku: 'SKU-GIFT-02', name: '花牛苹果礼盒', spec: '9 枚 / 盒', unit: '盒', price: 0 }
    ],
    tour: [
      { sku: 'SKU-TOUR-01', name: '观光采摘套餐', spec: '2 大 1 小 / 份', unit: '份', price: 0 }
    ]
  };

  var BASELINE_2025 = {};

  function buildCustomers() {
    return CUSTOMER_SEED.map(function (c, i) {
      return {
        id: c.code,
        code: c.code,
        name: c.name,
        contact: c.contact,
        phone: c.phone,
        wechat: '',
        email: '',
        type: c.type,
        level: c.level,
        region: c.region,
        address: c.address,
        status: c.status,
        source: c.source,
        owner: c.owner,
        creditLimit: c.creditLimit,
        creditDays: c.creditDays,
        invoiceTitle: c.name,
        taxNo: '',
        bankInfo: '',
        tags: c.tags || [],
        remark: '',
        createdAt: '2025-' + pad((i % 12) + 1) + '-' + pad((i % 27) + 1) + ' 09:00:00',
        updatedAt: '2026-10-20 18:00:00'
      };
    });
  }

  function buildSeedOrders(customers) {
    return [];
  }

  function buildSeedPayments(orders) {
    return [];
  }

  function buildSeedShipments(orders) {
    return [];
  }

  function buildSeedAfterSales(orders) {
    return [];
  }

  function buildSeedStatements(customers, orders, payments) {
    return [];
  }

  function buildSeedTargets() {
    return [];
  }

  function buildSeedPolicies() {
    return [];
  }

  function buildSeedPromotions() {
    return [];
  }

  function buildSeedState() {
    return {
      version: VERSION,
      seededAt: '',
      customers: [],
      orders: [],
      payments: [],
      shipments: [],
      afterSales: [],
      pricePolicies: [],
      promotions: [],
      targets: [],
      statements: []
    };
  }

  function ensure() {
    if (db) return db;
    var raw = readJSON(STORAGE_KEY, null);
    if (raw && raw.version === VERSION && Array.isArray(raw.customers) && Array.isArray(raw.orders)) {
      db = raw;
      if (!Array.isArray(db.payments)) db.payments = [];
      if (!Array.isArray(db.shipments)) db.shipments = [];
      if (!Array.isArray(db.afterSales)) db.afterSales = [];
      if (!Array.isArray(db.pricePolicies)) db.pricePolicies = [];
      if (!Array.isArray(db.promotions)) db.promotions = [];
      if (!Array.isArray(db.targets)) db.targets = [];
      if (!Array.isArray(db.statements)) db.statements = [];
      return db;
    }
    if (raw) {
      writeJSON(STORAGE_KEY + '_corrupt_' + Date.now(), raw);
    }
    db = buildSeedState();
    writeJSON(STORAGE_KEY, db);
    if (typeof depsReady !== 'undefined') preloadFromBackend();
    return db;
  }

  /* ---------------- 主键与查找 ---------------- */
  function nextId(kind, dateInput) {
    var e = ensure();
    var d = parseDate(dateInput) || new Date();
    var prefix = '';
    var list = [];
    if (kind === 'customer') {
      var max = 0;
      e.customers.forEach(function (c) {
        var n = parseInt(String(c.code || c.id || '').replace(/[^0-9]/g, ''), 10);
        if (!isNaN(n) && n > max) max = n;
      });
      return 'C' + pad(max + 1, 3);
    }
    if (kind === 'order') { prefix = 'XS-' + ymd(d) + '-'; list = e.orders; }
    else if (kind === 'payment') { prefix = 'SK-' + ymd(d) + '-'; list = e.payments; }
    else if (kind === 'shipment') { prefix = 'FH-' + ymd(d) + '-'; list = e.shipments; }
    else if (kind === 'aftersale') { prefix = 'AS-' + ymd(d) + '-'; list = e.afterSales; }
    else if (kind === 'statement') { prefix = 'DZ-' + ym(d).replace('-', '') + '-'; list = e.statements; }
    else if (kind === 'price') { prefix = 'PR-' + d.getFullYear() + '-'; list = e.pricePolicies; }
    else if (kind === 'promotion') { prefix = 'PM-' + d.getFullYear() + '-'; list = e.promotions; }
    else { prefix = 'ID-' + ymd(d) + '-'; list = []; }

    var maxSeq = 0;
    list.forEach(function (item) {
      var id = String(item.id || item.no || '');
      if (id.indexOf(prefix) === 0) {
        var n = parseInt(id.slice(prefix.length), 10);
        if (!isNaN(n) && n > maxSeq) maxSeq = n;
      }
    });
    return prefix + pad(maxSeq + 1, 4);
  }

  function findCustomer(id) {
    var list = ensure().customers;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id || list[i].code === id) return list[i];
    }
    return null;
  }

  function findStoreOrder(id) {
    var list = ensure().orders;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id || list[i].no === id || list[i].code === id) return list[i];
    }
    return null;
  }

  /* ---------------- H5 只读镜像 ---------------- */
  function h5Orders() {
    var arr = readJSON('h5_orders', []);
    var ships = readJSON('h5_sales_orders', []);
    if (!Array.isArray(arr)) return [];
    var codeMap = { pending: 'pending', paid: 'paid', shipped: 'shipped', completed: 'completed', cancelled: 'cancelled' };
    return arr.filter(function (o) { return o && typeof o === 'object'; }).map(function (o) {
      var no = o.no || o.id || '';
      var ship = null;
      ships.forEach(function (s) {
        if (s && (s.orderNo === no || s.orderNo === o.id)) ship = s;
      });
      var status = codeMap[o.statusCode] || 'pending';
      if (ship && status === 'paid') status = 'shipped';
      var addr = o.address && typeof o.address === 'object' ? o.address : {};
      var items = Array.isArray(o.items) ? o.items.filter(function (x) { return x && typeof x === 'object'; }).map(function (x) {
        var qty = toNum(x.qty) || 1;
        var price = toNum(x.price);
        return {
          sku: x.sku || '',
          name: x.name || '商品',
          spec: x.spec || '',
          unit: x.unit || '件',
          qty: qty,
          price: price,
          amount: round2(qty * price)
        };
      }) : [];
      var total = toNum(o.total);
      if (!total) total = items.reduce(function (s, x) { return s + x.amount; }, 0);
      var companyCode = ship ? ship.company : '';
      var companyMap = { sf: '顺丰速运', jd: '京东物流', yd: '圆通速递', yt: '韵达快递', zt: '中通快递' };
      return {
        id: no,
        no: no,
        code: no,
        type: 'retail',
        channel: 'retail',
        source: 'h5',
        customerId: 'H5',
        customerName: 'H5 商城消费者',
        contact: addr.name || '',
        phone: addr.phone || '',
        address: [addr.region, addr.detail].filter(Boolean).join(' '),
        items: items,
        goodsAmount: toNum(o.subtotal) || total,
        discount: toNum(o.discount),
        freight: 0,
        payableAmount: total,
        paidAmount: (status === 'pending' || status === 'cancelled') ? 0 : total,
        deposit: 0,
        payMethod: o.payment || '在线支付',
        payStatus: status === 'pending' ? 'unpaid' : (status === 'cancelled' ? 'unpaid' : 'paid'),
        status: status,
        batchNo: '',
        traceCode: '',
        receiver: addr.name || '',
        receiverPhone: addr.phone || '',
        receiverAddress: [addr.region, addr.detail].filter(Boolean).join(' '),
        expectedDate: '',
        owner: '线上自营',
        remark: o.invoice ? '需要发票' : '',
        invoiceStatus: o.invoice ? 'pending' : 'none',
        shipCompany: ship ? (companyMap[companyCode] || companyCode) : '',
        shipNo: ship ? (ship.tracking || '') : '',
        shippedAt: ship ? (ship.shippedAt || '') : '',
        receivedAt: status === 'completed' ? (o.createdAt || '') : '',
        createdAt: o.createdAt || '',
        updatedAt: ship ? (ship.shippedAt || o.createdAt || '') : (o.createdAt || ''),
        isMirror: true
      };
    }).sort(function (a, b) {
      return (parseDate(b.createdAt) || 0) - (parseDate(a.createdAt) || 0);
    });
  }

  function ordersAll() {
    var list = ensure().orders.concat(h5Orders());
    list.sort(function (a, b) {
      return (parseDate(b.createdAt) || 0) - (parseDate(a.createdAt) || 0);
    });
    return list;
  }

  function findOrder(id) {
    var o = findStoreOrder(id);
    if (o) return o;
    var list = h5Orders();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id || list[i].no === id) return list[i];
    }
    return null;
  }

  function payments() {
    var e = ensure();
    var list = clone(e.payments);
    var seen = {};
    list.forEach(function (p) { seen[p.orderId] = true; });
    h5Orders().forEach(function (o) {
      if (o.paidAmount > 0 && !seen[o.id]) {
        list.push({
          id: 'H5PAY-' + o.id,
          orderId: o.id,
          orderNo: o.no,
          customerId: o.customerId,
          customerName: o.customerName,
          amount: o.paidAmount,
          method: 'wechat',
          paidAt: o.createdAt,
          operator: '线上支付',
          voucherNo: '',
          remark: 'H5 在线支付',
          type: 'income'
        });
      }
    });
    list.sort(function (a, b) {
      return (parseDate(b.paidAt) || 0) - (parseDate(a.paidAt) || 0);
    });
    return list;
  }

  function shipments() {
    var e = ensure();
    var list = clone(e.shipments);
    var seen = {};
    list.forEach(function (s) { seen[s.orderId] = true; });
    var mirrors = readJSON('h5_sales_orders', []);
    if (Array.isArray(mirrors)) {
      mirrors.forEach(function (s, i) {
        if (!s || seen[s.orderNo]) return;
        var companyMap = { sf: '顺丰速运', jd: '京东物流', yd: '圆通速递', yt: '韵达快递', zt: '中通快递' };
        list.push({
          id: 'H5FH-' + (s.orderNo || i),
          orderId: s.orderNo || '',
          orderNo: s.orderNo || '',
          customerId: 'H5',
          customerName: 'H5 商城消费者',
          company: companyMap[s.company] || s.company || '未填写',
          trackingNo: s.tracking || '',
          shippedAt: s.shippedAt || '',
          status: 'shipped',
          signedAt: '',
          receiver: '',
          receiverPhone: '',
          address: '',
          remark: '商城管理发货',
          source: 'h5'
        });
      });
    }
    list.sort(function (a, b) {
      return (parseDate(b.shippedAt) || 0) - (parseDate(a.shippedAt) || 0);
    });
    return list;
  }

  /* ---------------- 过滤与统计 ---------------- */
  function applyFilters(list, f) {
    f = f || {};
    var start = f.startDate ? parseDate(f.startDate + 'T00:00:00') : null;
    var end = f.endDate ? parseDate(f.endDate + 'T23:59:59') : null;
    var kw = String(f.keyword || '').trim().toLowerCase();
    return list.filter(function (o) {
      var d = parseDate(o.createdAt);
      if (!d) return false;
      if (f.year && d.getFullYear() !== Number(f.year)) return false;
      if (f.month && (d.getMonth() + 1) !== Number(f.month)) return false;
      if (start && d < start) return false;
      if (end && d > end) return false;
      if (f.channel && f.channel !== 'all' && o.channel !== f.channel) return false;
      if (f.owner && f.owner !== 'all' && o.owner !== f.owner) return false;
      if (f.status && f.status !== 'all' && o.status !== f.status) return false;
      if (f.customerId && o.customerId !== f.customerId) return false;
      if (kw) {
        var hay = (o.no + ' ' + o.customerName + ' ' + o.receiver + ' ' +
          o.items.map(function (x) { return x.name + ' ' + x.spec; }).join(' ')).toLowerCase();
        if (hay.indexOf(kw) === -1) return false;
      }
      return true;
    });
  }

  function orderRefundAmount(orderId, afterSalesList) {
    var total = 0;
    afterSalesList.forEach(function (a) {
      if (a.orderId === orderId && (a.status === 'refunded' || a.status === 'returned')) {
        total += toNum(a.amount);
      }
    });
    return total;
  }

  function summary(f) {
    var e = ensure();
    var list = applyFilters(ordersAll(), f);
    var valid = list.filter(function (o) { return o.status !== 'cancelled'; });
    var amount = 0;
    var paid = 0;
    var refund = 0;
    valid.forEach(function (o) {
      amount += toNum(o.payableAmount);
      paid += toNum(o.paidAmount);
      refund += orderRefundAmount(o.id, e.afterSales);
    });
    var count = valid.length;
    var target = resolveTarget(f);
    var rate = target && target.targetAmount > 0 ? amount / target.targetAmount : 0;
    return {
      count: count,
      total: list.length,
      amount: round2(amount),
      paid: round2(paid),
      refund: round2(refund),
      net: round2(amount - refund),
      avg: count ? round2(amount / count) : 0,
      balance: round2(amount - paid),
      targetAmount: target ? toNum(target.targetAmount) : 0,
      targetOrders: target ? toNum(target.targetOrders) : 0,
      achievement: rate,
      pendingPay: valid.filter(function (o) { return o.status === 'confirm' || o.status === 'pending'; }).length,
      pendingShip: valid.filter(function (o) { return o.status === 'paid'; }).length,
      shipping: valid.filter(function (o) { return o.status === 'shipped'; }).length,
      afterSale: e.afterSales.filter(function (a) { return a.status === 'pending' || a.status === 'processing' || a.status === 'refunding' || a.status === 'returning'; }).length
    };
  }

  function resolveTarget(f) {
    f = f || {};
    var e = ensure();
    var period = f.year ? String(f.year) : '2026';
    if (f.month) period += '-' + pad(f.month, 2);
    var owner = f.owner && f.owner !== 'all' ? f.owner : '';
    var match = null;
    e.targets.forEach(function (t) {
      if (t.period === period && (t.owner || '') === owner) match = t;
    });
    if (!match && owner) {
      e.targets.forEach(function (t) {
        if (t.period === String(f.year || '2026') && (t.owner || '') === owner) match = t;
      });
    }
    return match;
  }

  function monthlyStats(f) {
    f = f || {};
    var year = Number(f.year) || 2026;
    var rows = [];
    var startMonth = f.month ? Number(f.month) : 1;
    var endMonth = f.month ? Number(f.month) : 12;
    var e = ensure();
    for (var m = startMonth; m <= endMonth; m++) {
      var sub = {};
      Object.keys(f).forEach(function (k) { sub[k] = f[k]; });
      sub.year = year;
      sub.month = m;
      var list = applyFilters(ordersAll(), sub).filter(function (o) { return o.status !== 'cancelled'; });
      var row = {
        month: m,
        label: year + '-' + pad(m, 2),
        count: list.length,
        wholesale: 0,
        retail: 0,
        adoption: 0,
        tour: 0,
        total: 0,
        refund: 0,
        net: 0,
        baseline: BASELINE_2025[m] || 0,
        yoy: 0
      };
      list.forEach(function (o) {
        var v = toNum(o.payableAmount);
        row.total += v;
        if (row[o.channel] != null) row[o.channel] += v;
        row.refund += orderRefundAmount(o.id, e.afterSales);
      });
      row.total = round2(row.total);
      row.refund = round2(row.refund);
      row.net = round2(row.total - row.refund);
      row.yoy = row.baseline ? (row.total - row.baseline) / row.baseline : 0;
      rows.push(row);
    }
    return rows;
  }

  function dimensionStats(dim, f) {
    dim = dim || 'month';
    var list = applyFilters(ordersAll(), f).filter(function (o) { return o.status !== 'cancelled'; });
    var e = ensure();
    var map = {};
    function keyOf(o) {
      if (dim === 'channel') return o.channel;
      if (dim === 'owner') return o.owner || '未分配';
      if (dim === 'customer') return o.customerId + '|' + o.customerName;
      if (dim === 'region') {
        var c = findCustomer(o.customerId);
        return c ? c.region : '线上';
      }
      if (dim === 'variety') return o.items[0] ? o.items[0].name : '其他';
      return (o.createdAt || '').slice(0, 7);
    }
    function labelOf(o, key) {
      if (dim === 'channel') return CHANNEL_TEXT[key] || key;
      if (dim === 'customer') return o.customerName;
      return key;
    }
    list.forEach(function (o) {
      var k = keyOf(o);
      if (!map[k]) map[k] = { key: k, label: labelOf(o, k), count: 0, amount: 0, paid: 0, refund: 0, net: 0 };
      map[k].count++;
      map[k].amount += toNum(o.payableAmount);
      map[k].paid += toNum(o.paidAmount);
      map[k].refund += orderRefundAmount(o.id, e.afterSales);
    });
    var total = 0;
    var rows = Object.keys(map).map(function (k) {
      var r = map[k];
      r.amount = round2(r.amount);
      r.paid = round2(r.paid);
      r.refund = round2(r.refund);
      r.net = round2(r.amount - r.refund);
      total += r.amount;
      return r;
    });
    rows.forEach(function (r) { r.ratio = total ? r.amount / total : 0; });
    rows.sort(function (a, b) { return b.amount - a.amount; });
    return rows;
  }

  function customerRank(f, limit) {
    f = f || {};
    var year = Number(f.year) || 2026;
    var month = f.month ? Number(f.month) : null;
    var map = {};
    payments().forEach(function (p) {
      if (p.type === 'refund') return;
      var d = parseDate(p.paidAt);
      if (!d) return;
      if (d.getFullYear() !== year) return;
      if (month && d.getMonth() + 1 !== month) return;
      var order = findOrder(p.orderId);
      var name = order ? order.customerName : (p.customerName || '未知客户');
      var cid = order ? order.customerId : (p.customerId || '');
      if (!map[cid]) map[cid] = { customerId: cid, customerName: name, amount: 0, orders: {} };
      map[cid].amount += toNum(p.amount);
      map[cid].orders[p.orderId] = true;
    });
    var rows = Object.keys(map).map(function (k) {
      var r = map[k];
      return {
        customerId: r.customerId,
        customerName: r.customerName,
        amount: round2(r.amount),
        orderCount: Object.keys(r.orders).length
      };
    });
    rows.sort(function (a, b) { return b.amount - a.amount; });
    return rows.slice(0, limit || 10);
  }

  function aging(f) {
    f = f || {};
    var list = applyFilters(ordersAll(), f).filter(function (o) {
      return o.status !== 'cancelled' && toNum(o.payableAmount) - toNum(o.paidAmount) > 0.01;
    });
    var buckets = [
      { key: 'd0', label: '30 天内', count: 0, amount: 0 },
      { key: 'd30', label: '31-60 天', count: 0, amount: 0 },
      { key: 'd60', label: '61-90 天', count: 0, amount: 0 },
      { key: 'd90', label: '90 天以上', count: 0, amount: 0 }
    ];
    var total = 0;
    var weighted = 0;
    list.forEach(function (o) {
      var d = parseDate(o.createdAt) || NOW_REF;
      var days = Math.max(0, Math.floor((NOW_REF.getTime() - d.getTime()) / DAY));
      var balance = toNum(o.payableAmount) - toNum(o.paidAmount);
      var idx = days <= 30 ? 0 : (days <= 60 ? 1 : (days <= 90 ? 2 : 3));
      buckets[idx].count++;
      buckets[idx].amount += balance;
      total += balance;
      weighted += balance * days;
    });
    buckets.forEach(function (b) { b.amount = round2(b.amount); });
    return {
      buckets: buckets,
      total: round2(total),
      over60: round2(buckets[2].amount + buckets[3].amount),
      avgDays: total > 0 ? Math.round(weighted / total) : 0
    };
  }

  function receivableOf(customerId) {
    var list = ordersAll().filter(function (o) {
      return o.customerId === customerId && o.status !== 'cancelled';
    });
    var amount = 0;
    var paid = 0;
    list.forEach(function (o) {
      amount += toNum(o.payableAmount);
      paid += toNum(o.paidAmount);
    });
    return round2(amount - paid);
  }

  function customerStats(customerId) {
    var list = ordersAll().filter(function (o) {
      return o.customerId === customerId && o.status !== 'cancelled';
    });
    var amount = 0;
    var paid = 0;
    var last = '';
    list.forEach(function (o) {
      amount += toNum(o.payableAmount);
      paid += toNum(o.paidAmount);
      if (!last || (parseDate(o.createdAt) || 0) > (parseDate(last) || 0)) last = o.createdAt;
    });
    var lastD = parseDate(last);
    return {
      orderCount: list.length,
      amount: round2(amount),
      paid: round2(paid),
      balance: round2(amount - paid),
      avgOrder: list.length ? round2(amount / list.length) : 0,
      lastOrderAt: last,
      daysSinceLast: lastD ? Math.floor((NOW_REF.getTime() - lastD.getTime()) / DAY) : null,
      orders: list
    };
  }

  /* ---------------- 客户写操作 ---------------- */
  function saveCustomer(input) {
    /* 用户主动写入：计入预加载竞态计数 */
    global.__STRICT_DB_WRITES__ = (global.__STRICT_DB_WRITES__ || 0) + 1;
    var e = ensure();
    input = input || {};
    var name = String(input.name || '').trim();
    if (!name) return fail('请填写客户名称');
    var phone = String(input.phone || '').trim();
    if (phone && !/^1\d{10}$/.test(phone)) return fail('联系电话需为 11 位手机号');
    var isNew = !input.id;
    var exist = null;
    if (!isNew) exist = findCustomer(input.id);
    var dup = e.customers.filter(function (c) {
      return c.id !== (exist && exist.id) && (c.name === name || (phone && c.phone === phone));
    })[0];
    if (dup) return fail('已存在同名或同手机号客户：' + dup.name);

    var entity = exist || {
      id: nextId('customer'),
      code: nextId('customer'),
      createdAt: nowIso()
    };
    /* nextId 连续调用会拿到同一个号，这里修正 code */
    if (!exist) entity.code = entity.id;

    entity.name = name;
    entity.contact = String(input.contact || '').trim();
    entity.phone = phone;
    entity.wechat = String(input.wechat || '').trim();
    entity.email = String(input.email || '').trim();
    entity.type = input.type || 'retail';
    entity.level = input.level || 'silver';
    entity.region = String(input.region || '').trim();
    entity.address = String(input.address || '').trim();
    entity.status = input.status || 'active';
    entity.source = String(input.source || '').trim();
    entity.owner = String(input.owner || '').trim();
    entity.creditLimit = toNum(input.creditLimit);
    entity.creditDays = toNum(input.creditDays);
    entity.invoiceTitle = String(input.invoiceTitle || '').trim();
    entity.taxNo = String(input.taxNo || '').trim();
    entity.bankInfo = String(input.bankInfo || '').trim();
    entity.tags = Array.isArray(input.tags) ? input.tags : String(input.tags || '').split(/[,，]/).filter(Boolean);
    entity.remark = String(input.remark || '').trim();
    entity.updatedAt = nowIso();

    if (!exist) e.customers.push(entity);
    persist(isNew ? 'customer-add' : 'customer-update');
    return ok(clone(entity));
  }

  function removeCustomer(id) {
    var e = ensure();
    var c = findCustomer(id);
    if (!c) return fail('客户不存在');
    var hasOrder = e.orders.some(function (o) { return o.customerId === c.id; });
    if (hasOrder) return fail('该客户已有销售订单，禁止删除；可改为「停用」');
    var hasStatement = e.statements.some(function (s) { return s.customerId === c.id; });
    if (hasStatement) return fail('该客户已有对账单，禁止删除');
    e.customers = e.customers.filter(function (x) { return x.id !== c.id; });
    persist('customer-remove');
    return ok(true);
  }

  function setCustomerStatus(id, status) {
    var e = ensure();
    var c = findCustomer(id);
    if (!c) return fail('客户不存在');
    if (['active', 'inactive'].indexOf(status) === -1) return fail('客户状态不合法');
    c.status = status;
    c.updatedAt = nowIso();
    persist('customer-status');
    return ok(clone(c));
  }

  /* ---------------- 订单写操作 ---------------- */
  function normalizeItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map(function (it) {
      it = it || {};
      var qty = toNum(it.qty);
      var price = toNum(it.price);
      return {
        sku: String(it.sku || ''),
        name: String(it.name || '').trim(),
        spec: String(it.spec || ''),
        unit: String(it.unit || '件'),
        qty: qty,
        price: price,
        amount: round2(qty * price)
      };
    }).filter(function (it) { return it.name && it.qty > 0; });
  }

  function saveOrder(input) {

    /* 用户主动写入：计入预加载竞态计数 */

    global.__STRICT_DB_WRITES__ = (global.__STRICT_DB_WRITES__ || 0) + 1;
    var e = ensure();
    input = input || {};
    var customer = findCustomer(input.customerId);
    if (!customer) return fail('请选择有效客户');
    var items = normalizeItems(input.items);
    if (!items.length) return fail('请至少添加一条有效商品明细');
    var goods = round2(items.reduce(function (s, it) { return s + it.amount; }, 0));
    var discount = toNum(input.discount);
    var freight = toNum(input.freight);
    if (discount < 0 || freight < 0) return fail('优惠金额与运费不能为负数');
    var payable = round2(goods - discount + freight);
    if (payable < 0) return fail('优惠金额不能大于商品金额');

    var isNew = !input.id;
    var order;
    if (isNew) {
      var id = nextId('order');
      order = {
        id: id,
        no: id,
        code: id,
        source: 'manual',
        paidAmount: 0,
        payStatus: 'unpaid',
        status: 'confirm',
        createdAt: nowIso(),
        cancelledAt: '',
        cancelReason: '',
        shippedAt: '',
        receivedAt: '',
        refundedAmount: 0
      };
      e.orders.push(order);
    } else {
      order = findStoreOrder(input.id);
      if (!order) return fail('订单不存在');
      if (['shipped', 'completed', 'cancelled', 'refunded', 'returned', 'closed'].indexOf(order.status) >= 0) {
        return fail('当前状态订单不可编辑');
      }
      if (toNum(order.paidAmount) > payable) return fail('已收金额大于修改后的订单金额，请先处理退款');
    }

    var channel = input.channel || input.type || customer.type;
    order.type = channel;
    order.channel = channel;
    order.customerId = customer.id;
    order.customerName = customer.name;
    order.contact = customer.contact;
    order.phone = customer.phone;
    order.address = customer.address;
    order.items = items;
    order.goodsAmount = goods;
    order.discount = round2(discount);
    order.freight = round2(freight);
    order.payableAmount = payable;
    order.deposit = toNum(input.deposit);
    order.payMethod = String(input.payMethod || order.payMethod || '');
    order.batchNo = String(input.batchNo || '');
    order.traceCode = String(input.traceCode || '');
    order.receiver = String(input.receiver || customer.contact || '');
    order.receiverPhone = String(input.receiverPhone || customer.phone || '');
    order.receiverAddress = String(input.receiverAddress || customer.address || '');
    order.expectedDate = String(input.expectedDate || '');
    order.owner = String(input.owner || customer.owner || '');
    order.remark = String(input.remark || '');
    order.invoiceStatus = input.invoiceStatus || order.invoiceStatus || 'none';
    order.updatedAt = nowIso();
    order.payStatus = order.paidAmount <= 0 ? 'unpaid' : (order.paidAmount >= payable ? 'paid' : 'partial');

    persist(isNew ? 'order-add' : 'order-update');
    return ok(clone(order));
  }

  function confirmOrder(id) {
    var o = findStoreOrder(id);
    if (!o) return fail('订单不存在');
    if (o.status !== 'confirm') return fail('只有待确认订单可以确认');
    o.status = toNum(o.paidAmount) > 0 ? 'paid' : 'pending';
    o.updatedAt = nowIso();
    persist('order-confirm');
    return ok(clone(o));
  }

  function cancelOrder(id, reason) {
    var e = ensure();
    var o = findStoreOrder(id);
    if (!o) return fail('订单不存在');
    if (['confirm', 'pending'].indexOf(o.status) === -1) {
      return fail(o.paidAmount > 0 ? '订单已收款，请通过「售后与退款」处理' : '当前状态订单不可取消');
    }
    if (toNum(o.paidAmount) > 0) return fail('订单已收款，请通过「售后与退款」处理');
    o.status = 'cancelled';
    o.cancelledAt = nowIso();
    o.cancelReason = String(reason || '');
    o.updatedAt = nowIso();
    persist('order-cancel');
    return ok(clone(o));
  }

  function confirmPayment(orderId, payload) {
    var e = ensure();
    payload = payload || {};
    var o = findStoreOrder(orderId);
    if (!o) return fail('订单不存在');
    if (['cancelled', 'refunded', 'returned', 'closed'].indexOf(o.status) >= 0) return fail('当前状态订单不可收款');
    var payable = toNum(o.payableAmount);
    var paid = toNum(o.paidAmount);
    var outstanding = round2(payable - paid);
    var amount = round2(payload.amount);
    if (amount <= 0) return fail('收款金额必须大于 0');
    if (amount > outstanding + 0.01) return fail('收款金额不能超过待收金额 ' + fmtMoney(outstanding));
    var method = payload.method || 'bank';
    if (!PAY_METHOD_TEXT[method] && method !== '其他') return fail('请选择有效的收款方式');

    var id = nextId('payment');
    e.payments.push({
      id: id,
      orderId: o.id,
      orderNo: o.no,
      customerId: o.customerId,
      customerName: o.customerName,
      amount: amount,
      method: method,
      paidAt: payload.paidAt || nowIso(),
      operator: payload.operator || '财务',
      voucherNo: String(payload.voucherNo || ''),
      remark: String(payload.remark || ''),
      type: 'income'
    });

    o.paidAmount = round2(paid + amount);
    o.payMethod = method;
    o.payStatus = o.paidAmount >= payable ? 'paid' : 'partial';
    if (o.status === 'confirm') o.status = 'pending';
    if (o.paidAmount >= payable && (o.status === 'pending')) o.status = 'paid';
    o.updatedAt = nowIso();
    persist('order-payment');
    return ok(clone(o));
  }

  function createShipment(orderId, payload) {

    /* 用户主动写入：计入预加载竞态计数 */

    global.__STRICT_DB_WRITES__ = (global.__STRICT_DB_WRITES__ || 0) + 1;
    var e = ensure();
    payload = payload || {};
    var o = findOrder(orderId);
    if (!o) return fail('订单不存在');
    if (o.status !== 'paid') return fail('只有待发货订单可以发货');
    var company = String(payload.company || '').trim();
    var trackingNo = String(payload.trackingNo || '').trim();
    if (!company) return fail('请选择快递公司');
    if (!trackingNo) return fail('请填写运单号');
    var dup = shipments().filter(function (s) { return s.trackingNo === trackingNo; })[0];
    if (dup) return fail('运单号已存在：' + trackingNo);
    var shippedAt = payload.shippedAt || nowIso();
    var id = nextId('shipment');

    if (o.isMirror) {
      /* H5 订单：发货仍由商城管理维护，这里只做只读校验 */
      return fail('H5 商城订单请在「商城管理 › C端订单」发货');
    }

    var ship = {
      id: id,
      orderId: o.id,
      orderNo: o.no,
      customerId: o.customerId,
      customerName: o.customerName,
      company: company,
      trackingNo: trackingNo,
      shippedAt: shippedAt,
      status: 'shipped',
      signedAt: '',
      receiver: o.receiver,
      receiverPhone: o.receiverPhone,
      address: o.receiverAddress,
      remark: String(payload.remark || ''),
      source: 'manual'
    };
    e.shipments.push(ship);
    o.status = 'shipped';
    o.shipCompany = company;
    o.shipNo = trackingNo;
    o.shippedAt = shippedAt;
    o.updatedAt = nowIso();
    persist('order-ship');
    return ok(clone(ship));
  }

  function signShipment(shipId) {

    /* 用户主动写入：计入预加载竞态计数 */

    global.__STRICT_DB_WRITES__ = (global.__STRICT_DB_WRITES__ || 0) + 1;
    var e = ensure();
    var ship = null;
    e.shipments.forEach(function (s) { if (s.id === shipId) ship = s; });
    if (!ship) return fail('发货单不存在');
    if (ship.status === 'signed') return fail('该发货单已签收');
    ship.status = 'signed';
    ship.signedAt = nowIso();
    var o = findStoreOrder(ship.orderId);
    if (o && ['shipped', 'returning'].indexOf(o.status) >= 0) {
      o.status = o.status === 'returning' ? 'returning' : 'completed';
      o.receivedAt = ship.signedAt;
      o.updatedAt = nowIso();
    }
    persist('shipment-sign');
    return ok(clone(ship));
  }

  function confirmReceive(orderId) {
    var o = findStoreOrder(orderId);
    if (!o) return fail('订单不存在');
    if (o.status !== 'shipped') return fail('只有已发货订单可以确认收货');
    var e = ensure();
    var ship = null;
    e.shipments.forEach(function (s) { if (s.orderId === o.id && s.status !== 'signed') ship = s; });
    if (ship) {
      ship.status = 'signed';
      ship.signedAt = nowIso();
    }
    o.status = 'completed';
    o.receivedAt = nowIso();
    o.updatedAt = nowIso();
    persist('order-receive');
    return ok(clone(o));
  }

  function removeOrder(id) {
    var e = ensure();
    var o = findStoreOrder(id);
    if (!o) return fail('订单不存在');
    if (['confirm', 'pending', 'cancelled'].indexOf(o.status) === -1) return fail('只有待确认、待付款或已取消订单可以删除');
    if (toNum(o.paidAmount) > 0) return fail('订单已有收款记录，不可删除');
    var hasAs = e.afterSales.some(function (a) { return a.orderId === o.id; });
    if (hasAs) return fail('订单已有售后记录，不可删除');
    e.orders = e.orders.filter(function (x) { return x.id !== o.id; });
    persist('order-remove');
    return ok(true);
  }

  /* ---------------- 售后 ---------------- */
  function afterSales() {
    var list = clone(ensure().afterSales);
    list.sort(function (a, b) {
      return (parseDate(b.applyAt) || 0) - (parseDate(a.applyAt) || 0);
    });
    return list;
  }

  function saveAfterSale(input) {

    /* 用户主动写入：计入预加载竞态计数 */

    global.__STRICT_DB_WRITES__ = (global.__STRICT_DB_WRITES__ || 0) + 1;
    var e = ensure();
    input = input || {};
    var o = findOrder(input.orderId);
    if (!o) return fail('请选择关联订单');
    if (['cancelled', 'pending', 'confirm'].indexOf(o.status) >= 0) return fail('该订单尚未完成收款，不能发起售后');
    var type = input.type || 'refund';
    if (!AS_TYPE_TEXT[type]) return fail('售后类型不合法');
    var reason = String(input.reason || '').trim();
    if (!reason) return fail('请填写售后原因');
    var amount = type === 'exchange' ? 0 : round2(input.amount);
    if (type !== 'exchange' && amount <= 0) return fail('请填写申请金额');
    if (amount > toNum(o.paidAmount) + 0.01) return fail('申请金额不能超过已收金额 ' + fmtMoney(o.paidAmount));
    var qty = toNum(input.qty);
    if ((type === 'return' || type === 'exchange') && qty <= 0) return fail('请填写退货/换货数量');
    var open = e.afterSales.some(function (a) {
      return a.orderId === o.id && ['pending', 'processing', 'refunding', 'returning'].indexOf(a.status) >= 0;
    });
    if (open) return fail('该订单已有未完成的售后单');

    var id = nextId('aftersale');
    var entity = {
      id: id,
      no: id,
      orderId: o.id,
      orderNo: o.no,
      customerId: o.customerId,
      customerName: o.customerName,
      type: type,
      reason: reason,
      amount: amount,
      qty: qty,
      status: 'pending',
      applyAt: nowIso(),
      handler: '',
      handledAt: '',
      remark: String(input.remark || ''),
      restock: type === 'return' ? !!input.restock : false
    };
    e.afterSales.push(entity);
    persist('aftersale-add');
    return ok(clone(entity));
  }

  function handleAfterSale(id, action, payload) {

    /* 用户主动写入：计入预加载竞态计数 */

    global.__STRICT_DB_WRITES__ = (global.__STRICT_DB_WRITES__ || 0) + 1;
    var e = ensure();
    payload = payload || {};
    var a = null;
    e.afterSales.forEach(function (x) { if (x.id === id) a = x; });
    if (!a) return fail('售后单不存在');
    var o = findStoreOrder(a.orderId);
    if (!o) return fail('关联订单不存在或为 H5 订单，请在商城管理处理');
    var operator = String(payload.operator || '售后专员');

    if (action === 'approve') {
      if (a.status !== 'pending') return fail('只有待审核售后单可以审核');
      a.handler = operator;
      a.handledAt = nowIso();
      if (a.type === 'refund') {
        a.status = 'refunding';
        if (o.status !== 'refunding') o.prevStatus = o.status;
        o.status = 'refunding';
      } else if (a.type === 'return') {
        a.status = 'returning';
        if (o.status !== 'returning') o.prevStatus = o.status;
        o.status = 'returning';
      } else {
        a.status = 'processing';
        if (o.status !== 'refunding') o.prevStatus = o.status;
      }
      o.updatedAt = nowIso();
      persist('aftersale-approve');
      return ok(clone(a));
    }

    if (action === 'reject') {
      if (a.status !== 'pending' && a.status !== 'processing') return fail('当前售后单不可驳回');
      a.status = 'rejected';
      a.handler = operator;
      a.handledAt = nowIso();
      a.remark = String(payload.remark || a.remark || '');
      if (o.prevStatus) {
        o.status = o.prevStatus;
        delete o.prevStatus;
      }
      o.updatedAt = nowIso();
      persist('aftersale-reject');
      return ok(clone(a));
    }

    if (action === 'complete') {
      if (a.status === 'pending') return fail('请先审核通过');
      if (a.status === 'refunded' || a.status === 'returned' || a.status === 'completed') return fail('售后单已完成');
      a.handler = operator;
      a.handledAt = nowIso();
      if (a.type === 'refund') {
        if (a.status !== 'refunding') return fail('当前售后单不在退款中');
        a.status = 'refunded';
        o.refundedAmount = round2(toNum(o.refundedAmount) + a.amount);
        o.paidAmount = round2(Math.max(0, toNum(o.paidAmount) - a.amount));
        o.payStatus = o.paidAmount <= 0 ? 'refunded' : (o.paidAmount >= o.payableAmount ? 'paid' : 'partial');
        o.status = o.paidAmount <= 0 ? 'refunded' : 'completed';
        e.payments.push({
          id: nextId('payment'),
          orderId: o.id,
          orderNo: o.no,
          customerId: o.customerId,
          customerName: o.customerName,
          amount: -a.amount,
          method: 'bank',
          paidAt: nowIso(),
          operator: operator,
          voucherNo: '',
          remark: '售后退款：' + a.reason,
          type: 'refund'
        });
      } else if (a.type === 'return') {
        if (a.status !== 'returning') return fail('当前售后单不在退货中');
        a.status = 'returned';
        o.status = 'returned';
        o.returnedAt = nowIso();
        if (a.restock) o.restockedAt = nowIso();
      } else {
        a.status = 'completed';
        o.status = o.prevStatus || 'completed';
        delete o.prevStatus;
      }
      o.updatedAt = nowIso();
      persist('aftersale-complete');
      return ok(clone(a));
    }

    return fail('不支持的售后操作');
  }

  /* ---------------- 价格与促销 ---------------- */
  function policyState(p) {
    var today = fmtDate(new Date());
    if (p.status === 'disabled') return 'disabled';
    if (p.startDate && today < p.startDate) return 'upcoming';
    if (p.endDate && today > p.endDate) return 'expired';
    return 'active';
  }

  function pricePolicies() {
    return clone(ensure().pricePolicies).map(function (p) {
      p.computedStatus = policyState(p);
      return p;
    });
  }

  function savePricePolicy(input) {

    /* 用户主动写入：计入预加载竞态计数 */

    global.__STRICT_DB_WRITES__ = (global.__STRICT_DB_WRITES__ || 0) + 1;
    var e = ensure();
    input = input || {};
    var name = String(input.name || '').trim();
    if (!name) return fail('请填写政策名称');
    if (toNum(input.price) <= 0) return fail('协议单价必须大于 0');
    if (input.startDate && input.endDate && input.startDate > input.endDate) return fail('生效日期不能晚于失效日期');
    if (!input.customerId && !input.customerType) return fail('请选择适用客户或客户类型');
    var isNew = !input.id;
    var entity = null;
    if (!isNew) {
      e.pricePolicies.forEach(function (p) { if (p.id === input.id) entity = p; });
      if (!entity) return fail('价格政策不存在');
    } else {
      entity = { id: nextId('price') };
      e.pricePolicies.push(entity);
    }
    entity.name = name;
    entity.customerId = String(input.customerId || '');
    entity.customerType = String(input.customerType || '');
    entity.product = String(input.product || '').trim();
    entity.unit = String(input.unit || 'kg');
    entity.price = round2(input.price);
    entity.minQty = toNum(input.minQty);
    entity.startDate = input.startDate || '';
    entity.endDate = input.endDate || '';
    entity.status = input.status === 'disabled' ? 'disabled' : 'active';
    entity.remark = String(input.remark || '');
    persist(isNew ? 'policy-add' : 'policy-update');
    return ok(clone(entity));
  }

  function removePricePolicy(id) {

    /* 用户主动写入：计入预加载竞态计数 */

    global.__STRICT_DB_WRITES__ = (global.__STRICT_DB_WRITES__ || 0) + 1;
    var e = ensure();
    var before = e.pricePolicies.length;
    e.pricePolicies = e.pricePolicies.filter(function (p) { return p.id !== id; });
    if (e.pricePolicies.length === before) return fail('价格政策不存在');
    persist('policy-remove');
    return ok(true);
  }

  function promoState(p) {
    var today = fmtDate(new Date());
    if (p.status === 'disabled') return 'disabled';
    if (p.startDate && today < p.startDate) return 'upcoming';
    if (p.endDate && today > p.endDate) return 'ended';
    return 'active';
  }

  function promotions() {
    return clone(ensure().promotions).map(function (p) {
      p.computedStatus = promoState(p);
      return p;
    });
  }

  function savePromotion(input) {

    /* 用户主动写入：计入预加载竞态计数 */

    global.__STRICT_DB_WRITES__ = (global.__STRICT_DB_WRITES__ || 0) + 1;
    var e = ensure();
    input = input || {};
    var name = String(input.name || '').trim();
    if (!name) return fail('请填写活动名称');
    if (!String(input.rule || '').trim()) return fail('请填写优惠规则');
    if (input.startDate && input.endDate && input.startDate > input.endDate) return fail('开始日期不能晚于结束日期');
    var isNew = !input.id;
    var entity = null;
    if (!isNew) {
      e.promotions.forEach(function (p) { if (p.id === input.id) entity = p; });
      if (!entity) return fail('促销活动不存在');
    } else {
      entity = { id: nextId('promotion') };
      e.promotions.push(entity);
    }
    entity.name = name;
    entity.type = input.type || 'discount';
    entity.scope = String(input.scope || '').trim();
    entity.rule = String(input.rule || '').trim();
    entity.startDate = input.startDate || '';
    entity.endDate = input.endDate || '';
    entity.status = input.status === 'disabled' ? 'disabled' : 'active';
    entity.remark = String(input.remark || '');
    persist(isNew ? 'promo-add' : 'promo-update');
    return ok(clone(entity));
  }

  function removePromotion(id) {

    /* 用户主动写入：计入预加载竞态计数 */

    global.__STRICT_DB_WRITES__ = (global.__STRICT_DB_WRITES__ || 0) + 1;
    var e = ensure();
    var before = e.promotions.length;
    e.promotions = e.promotions.filter(function (p) { return p.id !== id; });
    if (e.promotions.length === before) return fail('促销活动不存在');
    persist('promo-remove');
    return ok(true);
  }

  /* ---------------- 销售目标 ---------------- */
  function targets() {
    return clone(ensure().targets);
  }

  function saveTarget(input) {

    /* 用户主动写入：计入预加载竞态计数 */

    global.__STRICT_DB_WRITES__ = (global.__STRICT_DB_WRITES__ || 0) + 1;
    var e = ensure();
    input = input || {};
    var period = String(input.period || '').trim();
    if (!/^\d{4}(-\d{2})?$/.test(period)) return fail('目标期间格式应为 YYYY 或 YYYY-MM');
    var owner = String(input.owner || '').trim();
    if (toNum(input.targetAmount) <= 0) return fail('目标金额必须大于 0');
    var isNew = !input.id;
    var entity = null;
    if (!isNew) {
      e.targets.forEach(function (t) { if (t.id === input.id) entity = t; });
      if (!entity) return fail('销售目标不存在');
    } else {
      var dup = e.targets.filter(function (t) { return t.period === period && (t.owner || '') === owner; })[0];
      if (dup) return fail('该期间与负责人的目标已存在');
      entity = {
        id: 'TG-' + period + '-' + (owner || 'ALL'),
        period: period,
        owner: owner,
        targetAmount: 0,
        targetOrders: 0,
        remark: ''
      };
      e.targets.push(entity);
    }
    entity.period = period;
    entity.owner = owner;
    entity.targetAmount = round2(input.targetAmount);
    entity.targetOrders = toNum(input.targetOrders);
    entity.remark = String(input.remark || '');
    persist(isNew ? 'target-add' : 'target-update');
    return ok(clone(entity));
  }

  function removeTarget(id) {

    /* 用户主动写入：计入预加载竞态计数 */

    global.__STRICT_DB_WRITES__ = (global.__STRICT_DB_WRITES__ || 0) + 1;
    var e = ensure();
    var before = e.targets.length;
    e.targets = e.targets.filter(function (t) { return t.id !== id; });
    if (e.targets.length === before) return fail('销售目标不存在');
    persist('target-remove');
    return ok(true);
  }

  function targetProgress(period, owner) {
    var e = ensure();
    period = String(period || '2026');
    owner = owner || '';
    var isMonth = /^\d{4}-\d{2}$/.test(period);
    var list = applyFilters(ordersAll(), {
      year: period.slice(0, 4),
      month: isMonth ? Number(period.slice(5, 7)) : null,
      owner: owner || 'all'
    }).filter(function (o) { return o.status !== 'cancelled'; });
    var actualAmount = 0;
    var actualOrders = list.length;
    list.forEach(function (o) { actualAmount += toNum(o.payableAmount); });
    var target = e.targets.filter(function (t) {
      return t.period === period && (t.owner || '') === owner;
    })[0] || null;
    var targetAmount = target ? toNum(target.targetAmount) : 0;
    return {
      period: period,
      owner: owner,
      targetAmount: targetAmount,
      targetOrders: target ? toNum(target.targetOrders) : 0,
      actualAmount: round2(actualAmount),
      actualOrders: actualOrders,
      amountRate: targetAmount ? actualAmount / targetAmount : 0,
      orderRate: target && toNum(target.targetOrders) ? actualOrders / toNum(target.targetOrders) : 0
    };
  }

  /* ---------------- 对账单 ---------------- */
  function statements() {
    var list = clone(ensure().statements);
    list.sort(function (a, b) {
      return (parseDate(b.createdAt) || 0) - (parseDate(a.createdAt) || 0);
    });
    return list;
  }

  function generateStatement(customerId, period) {

    /* 用户主动写入：计入预加载竞态计数 */

    global.__STRICT_DB_WRITES__ = (global.__STRICT_DB_WRITES__ || 0) + 1;
    var e = ensure();
    var c = findCustomer(customerId);
    if (!c) return fail('请选择有效客户');
    if (!/^\d{4}-\d{2}$/.test(String(period || ''))) return fail('对账期间格式应为 YYYY-MM');
    var exist = e.statements.filter(function (s) {
      return s.customerId === c.id && s.period === period;
    })[0];
    if (exist) return ok(clone(exist));

    var list = ordersAll().filter(function (o) {
      return o.customerId === c.id && o.status !== 'cancelled' && (o.createdAt || '').slice(0, 7) === period;
    });
    if (!list.length) return fail('该客户在 ' + period + ' 没有有效订单');
    var amount = 0;
    var paid = 0;
    list.forEach(function (o) {
      amount += toNum(o.payableAmount);
      paid += toNum(o.paidAmount);
    });
    var balance = round2(amount - paid);
    var d = parseDate(period + '-01T10:00:00') || new Date();
    var id = nextId('statement', fmtDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)));
    var entity = {
      id: id,
      no: id,
      customerId: c.id,
      customerName: c.name,
      period: period,
      orderIds: list.map(function (o) { return o.id; }),
      orderCount: list.length,
      amount: round2(amount),
      paid: round2(paid),
      balance: balance,
      status: balance <= 0 ? 'settled' : 'draft',
      createdAt: nowIso(),
      confirmedAt: '',
      settledAt: balance <= 0 ? nowIso() : '',
      remark: ''
    };
    e.statements.push(entity);
    persist('statement-generate');
    return ok(clone(entity));
  }

  function setStatementStatus(id, action) {
    var e = ensure();
    var s = null;
    e.statements.forEach(function (x) { if (x.id === id) s = x; });
    if (!s) return fail('对账单不存在');
    if (action === 'confirm') {
      if (s.status !== 'draft') return fail('只有待确认对账单可以确认');
      s.status = 'confirmed';
      s.confirmedAt = nowIso();
    } else if (action === 'settle') {
      if (s.status !== 'confirmed') return fail('只有已确认对账单可以结清');
      if (s.balance > 0) return fail('仍有应收余额 ' + fmtMoney(s.balance) + '，请先登记收款');
      s.status = 'settled';
      s.settledAt = nowIso();
    } else {
      return fail('不支持的对账操作');
    }
    persist('statement-' + action);
    return ok(clone(s));
  }

  function statementDetail(id) {
    var e = ensure();
    var s = null;
    e.statements.forEach(function (x) { if (x.id === id) s = x; });
    if (!s) return null;
    var map = {};
    s.orderIds.forEach(function (oid) { map[oid] = true; });
    return {
      statement: clone(s),
      orders: ordersAll().filter(function (o) { return map[o.id]; })
    };
  }

  function removeStatement(id) {

    /* 用户主动写入：计入预加载竞态计数 */

    global.__STRICT_DB_WRITES__ = (global.__STRICT_DB_WRITES__ || 0) + 1;
    var e = ensure();
    var s = null;
    e.statements.forEach(function (x) { if (x.id === id) s = x; });
    if (!s) return fail('对账单不存在');
    if (s.status !== 'draft') return fail('只有待确认对账单可以删除');
    e.statements = e.statements.filter(function (x) { return x.id !== id; });
    persist('statement-remove');
    return ok(true);
  }

  /* ---------------- 导出与维护 ---------------- */
  function csvCell(v) {
    return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  }

  function downloadCsv(filename, headers, rows) {
    var content = '\ufeff' + headers.map(csvCell).join(',') + '\n' +
      rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n');
    try {
      var blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
        document.body.removeChild(a);
      }, 200);
      return true;
    } catch (e) {
      console.error('[SalesStore] 导出失败', e);
      return false;
    }
  }

  function reset() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    db = buildSeedState();
    writeJSON(STORAGE_KEY, db);
    notify('reset');
    return true;
  }

  function exportAll() {
    return clone(ensure());
  }

  /* ---------------- 导出 API ---------------- */
  var API = {
    VERSION: VERSION,
    STORAGE_KEY: STORAGE_KEY,

    ORDER_STATUS: ORDER_STATUS,
    ORDER_STATUS_TEXT: ORDER_STATUS_TEXT,
    PAY_STATUS_TEXT: PAY_STATUS_TEXT,
    TYPE_TEXT: TYPE_TEXT,
    CHANNEL_TEXT: CHANNEL_TEXT,
    CUSTOMER_TYPE_TEXT: CUSTOMER_TYPE_TEXT,
    LEVEL_TEXT: LEVEL_TEXT,
    SOURCE_TEXT: SOURCE_TEXT,
    PAY_METHOD_TEXT: PAY_METHOD_TEXT,
    SHIP_COMPANIES: SHIP_COMPANIES,
    AS_TYPE_TEXT: AS_TYPE_TEXT,
    AS_STATUS_TEXT: AS_STATUS_TEXT,
    TARGET_STATUS_TEXT: TARGET_STATUS_TEXT,
    STATEMENT_STATUS_TEXT: STATEMENT_STATUS_TEXT,
    POLICY_STATUS_TEXT: POLICY_STATUS_TEXT,
    PROMO_STATUS_TEXT: PROMO_STATUS_TEXT,
    FLOW: FLOW,
    PRODUCTS: PRODUCTS,

    subscribe: subscribe,
    reset: reset,
    exportAll: exportAll,

    customers: function () { return clone(ensure().customers); },
    customer: findCustomer,
    customerStats: customerStats,
    receivableOf: receivableOf,
    saveCustomer: saveCustomer,
    removeCustomer: removeCustomer,
    setCustomerStatus: setCustomerStatus,

    orders: ordersAll,
    order: findOrder,
    h5Orders: h5Orders,
    saveOrder: saveOrder,
    confirmOrder: confirmOrder,
    cancelOrder: cancelOrder,
    removeOrder: removeOrder,
    confirmPayment: confirmPayment,
    confirmReceive: confirmReceive,

    payments: payments,
    paymentsOf: function (orderId) {
      return payments().filter(function (p) { return p.orderId === orderId; });
    },

    shipments: shipments,
    shipmentOf: function (orderId) {
      return shipments().filter(function (s) { return s.orderId === orderId; })[0] || null;
    },
    createShipment: createShipment,
    signShipment: signShipment,

    afterSales: afterSales,
    saveAfterSale: saveAfterSale,
    handleAfterSale: handleAfterSale,

    pricePolicies: pricePolicies,
    savePricePolicy: savePricePolicy,
    removePricePolicy: removePricePolicy,

    promotions: promotions,
    savePromotion: savePromotion,
    removePromotion: removePromotion,

    targets: targets,
    saveTarget: saveTarget,
    removeTarget: removeTarget,
    targetProgress: targetProgress,

    statements: statements,
    generateStatement: generateStatement,
    confirmStatement: function (id) { return setStatementStatus(id, 'confirm'); },
    settleStatement: function (id) { return setStatementStatus(id, 'settle'); },
    removeStatement: removeStatement,
    statementDetail: statementDetail,

    summary: summary,
    monthlyStats: monthlyStats,
    dimensionStats: dimensionStats,
    customerRank: customerRank,
    aging: aging,

    fmtDate: fmtDate,
    fmtTime: fmtTime,
    fmtMoney: fmtMoney,
    fmtWan: fmtWan,
    downloadCsv: downloadCsv
  };

  global.SalesStore = API;
})(window);
