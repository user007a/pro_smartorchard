/* ============================================================
 * 商城统一数据层 window.MallStore
 * ------------------------------------------------------------
 * 设计原则：
 * 1. 继续沿用 H5 端既有 localStorage key（商品/促销/券/订单/发票/社区），
 *    H5 页面无需改存储路径即可与后台互通；
 * 2. 新增会员扩展、领券核销、售后、商城配置等独立 key；
 * 3. 所有读写统一走安全读写，JSON 损坏时自动备份原始值并回落默认值；
 * 4. 返回统一结构 { ok, data, error }，禁止页面静默失败。
 * ============================================================ */
(function (window) {
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
      { name: 'MallMapper', src: baseDir + 'mall-mapper.js' }
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
    if (typeof window.MallMapper === 'undefined') return null;
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
      return api.get('mall/aggregate');
    }).then(function (res) {
      if (res && res.ok && res.data) {
        // 严格模式：预加载在途期间用户保存过数据，保留本地结果，避免陈旧快照覆盖
        if (typeof global.__STRICT_DB_WRITES__ === "number" && global.__STRICT_DB_WRITES__ !== writeMark0) return res;
        var agg = window.MallMapper.toAggregate(res.data);
        safeWrite(KEYS.products, agg.products || []);
        safeWrite(KEYS.promotions, agg.promotions || []);
        safeWrite(KEYS.coupons, agg.coupons || []);
        safeWrite(KEYS.claims, agg.claims || []);
        safeWrite(KEYS.members, agg.members || []);
        safeWrite(KEYS.orders, agg.orders || []);
        safeWrite(KEYS.afterSales, agg.afterSales || []);
        safeWrite(KEYS.invoices, agg.invoices || []);
        safeWrite(KEYS.posts, agg.posts || []);
        var st = settings();
        st.categories = agg.categories || [];
        st.varieties = agg.varieties || [];
        st.freight = agg.freight || [];
        st.levelRules = agg.levelRules || [];
        st.home = st.home || {}; st.home.banners = agg.banners || [];
        st.notices = agg.notices || [];
        safeWrite(KEYS.settings, st);
      }
      return res;
    }).catch(function (err) {
      console.warn('[MallStore] 后端预加载失败，降级 localStorage', err);
      return { ok: false, message: err && err.message };
    });
  }
  function persistToBackend() {
    var api = backendApi();
    if (!api || !backendEnabled()) return Promise.resolve({ ok: false, message: '未登录或依赖未就绪' });
    var st = settings();
    var agg = {
      products: products(), promotions: promotions(), coupons: coupons(), claims: claims(),
      members: members(), orders: orders(), afterSales: afterSales(), invoices: invoices(), posts: posts(),
      categories: st.categories || [], varieties: st.varieties || [], freight: st.freight || [],
      levelRules: st.levelRules || [], banners: (st.home && st.home.banners) || [], notices: st.notices || [],
      deleted: {},
    };
    var body = window.MallMapper.fromAggregate(agg);
    return api.create('mall/aggregate', body);
  }
  function schedulePersist(reason) {
    if (!backendEnabled()) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      persistTimer = null;
      persistToBackend().catch(function (e) { console.warn('[MallStore] 后端持久化失败', e); });
    }, 300);
  }

  var VERSION = 2;
  var KEYS = {
    products: 'mall_products',
    promotions: 'mall_promotions',
    coupons: 'mall_coupons',
    claims: 'mall_coupon_claims',
    members: 'mall_member_profiles',
    orders: 'h5_orders',
    salesOrders: 'h5_sales_orders',
    invoices: 'h5_invoices',
    posts: 'h5_community_posts',
    comments: 'h5_community_comments',
    likes: 'h5_community_likes',
    afterSales: 'mall_after_sales',
    settings: 'mall_settings',
    points: 'h5_points'
  };

  function nowIso() { return new Date().toISOString(); }
  function clone(v) { return JSON.parse(JSON.stringify(v == null ? null : v)); }
  function num(v, d) { var n = Number(v); return isNaN(n) ? (d == null ? 0 : d) : n; }
  function str(v) { return v == null ? '' : String(v).trim(); }
  function uid(prefix) { return (prefix || 'ID') + Date.now() + Math.floor(Math.random() * 900 + 100); }

  function safeRead(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw == null || raw === '') return clone(fallback);
      return JSON.parse(raw);
    } catch (e) {
      try {
        var bad = localStorage.getItem(key);
        if (bad) localStorage.setItem(key + '_bak_' + Date.now(), bad);
      } catch (ignore) {}
      try { localStorage.removeItem(key); } catch (ignore2) {}
      return clone(fallback);
    }
  }

  function safeWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      if (typeof schedulePersist === 'function') schedulePersist(key);
      // 窗口事件：页面在未持有 Store 引用时也能感知数据变化并重绘
      try {
        window.dispatchEvent(new CustomEvent('mallStoreChange', { detail: { reason: key } }));
      } catch (e) { /* ignore */ }
      return { ok: true, data: value };
    } catch (e) {
      try { console.error('[MallStore] 写入失败', key, e); } catch (ignore) {}
      return { ok: false, error: '本地存储写入失败，请检查浏览器存储空间或隐私模式' };
    }
  }

  function asArray(v) { return Array.isArray(v) ? v : []; }
  function fail(msg) { return { ok: false, error: msg }; }
  function done(data) { return { ok: true, data: data }; }

  /* ---------------- 商品 ---------------- */
  function normalizeProduct(p, i) {
    p = p || {};
    return {
      id: str(p.id),
      name: str(p.name),
      desc: str(p.desc),
      price: Math.max(0, num(p.price)),
      original: Math.max(0, num(p.original)),
      costPrice: Math.max(0, num(p.costPrice)),
      memberPrice: Math.max(0, num(p.memberPrice)),
      img: str(p.img),
      cat: str(p.cat) || 'fruit',
      variety: str(p.variety) || 'huaniu',
      spec: str(p.spec) || '标准装',
      unit: str(p.unit) || '斤',
      tag: str(p.tag),
      stock: p.stock == null ? 500 : Math.max(0, num(p.stock)),
      safetyStock: p.safetyStock == null ? 20 : Math.max(0, num(p.safetyStock)),
      soldCount: Math.max(0, num(p.soldCount)),
      sort: p.sort == null ? (i + 1) : num(p.sort, i + 1),
      serviceTags: Array.isArray(p.serviceTags) ? p.serviceTags : [],
      detailHtml: str(p.detailHtml),
      status: p.status === 'off' ? 'off' : 'on',
      createdAt: p.createdAt || nowIso(),
      updatedAt: p.updatedAt || nowIso()
    };
  }

  function products() {
    return asArray(safeRead(KEYS.products, [])).map(normalizeProduct)
      .sort(function (a, b) { return a.sort - b.sort; });
  }

  function saveProduct(item) {
    var list = products();
    var p = normalizeProduct(item, list.length);
    if (!p.id) return fail('请填写 SKU 编码');
    if (!p.name) return fail('请填写商品名称');
    var idx = -1;
    for (var i = 0; i < list.length; i++) { if (list[i].id === p.id) { idx = i; break; } }
    if (idx >= 0) {
      p.createdAt = list[idx].createdAt;
      p.soldCount = list[idx].soldCount;
      p.updatedAt = nowIso();
      list[idx] = p;
    } else {
      list.push(p);
    }
    var w = safeWrite(KEYS.products, list);
    if (!w.ok) return w;
    return done(p);
  }

  function removeProduct(id) {
    var list = products().filter(function (p) { return p.id !== id; });
    return safeWrite(KEYS.products, list);
  }

  function replaceProducts(list) {
    return safeWrite(KEYS.products, asArray(list).map(normalizeProduct));
  }

  /* ---------------- 促销 ---------------- */
  function normalizePromotion(p, i) {
    p = p || {};
    var status = str(p.status) || 'ready';
    return {
      id: str(p.id) || ('PM' + String(i + 1).padStart(3, '0')),
      title: str(p.title),
      subTitle: str(p.subTitle),
      type: str(p.type) || 'discount',
      price: Math.max(0, num(p.price)),
      original: Math.max(0, num(p.original)),
      img: str(p.img),
      tag: str(p.tag),
      scope: str(p.scope) || 'all',
      skuIds: Array.isArray(p.skuIds) ? p.skuIds.map(str).filter(Boolean) : [],
      channel: str(p.channel) || 'h5',
      limitPerUser: Math.max(0, num(p.limitPerUser, 0)),
      totalStock: p.totalStock == null ? 1000 : Math.max(0, num(p.totalStock)),
      usedStock: Math.max(0, num(p.usedStock)),
      priority: num(p.priority, 10),
      memberOnly: !!p.memberOnly,
      startDate: str(p.startDate),
      endDate: str(p.endDate),
      target: str(p.target) || 'order',
      status: status,
      createdAt: p.createdAt || nowIso(),
      updatedAt: p.updatedAt || nowIso()
    };
  }

  function promotions() {
    return asArray(safeRead(KEYS.promotions, [])).map(normalizePromotion)
      .sort(function (a, b) { return b.priority - a.priority; });
  }

  function savePromotion(item) {
    var list = promotions();
    var p = normalizePromotion(item, list.length);
    if (!p.title) return fail('请填写活动名称');
    var idx = -1;
    for (var i = 0; i < list.length; i++) { if (list[i].id === p.id) { idx = i; break; } }
    if (idx >= 0) { p.createdAt = list[idx].createdAt; p.updatedAt = nowIso(); list[idx] = p; }
    else { list.push(p); }
    var w = safeWrite(KEYS.promotions, list);
    if (!w.ok) return w;
    return done(p);
  }

  function removePromotion(id) {
    return safeWrite(KEYS.promotions, promotions().filter(function (p) { return p.id !== id; }));
  }

  function activePromotions(target) {
    var today = new Date().toISOString().slice(0, 10);
    return promotions().filter(function (p) {
      if (target && p.target !== target) return false;
      if (p.status === 'end' || p.status === 'off') return false;
      if (p.startDate && today < p.startDate) return false;
      if (p.endDate && today > p.endDate) return false;
      return true;
    });
  }

  /* ---------------- 优惠券 ---------------- */
  function todayIso() { return new Date().toISOString().slice(0, 10); }
  function addDays(days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function normalizeCoupon(c, i) {
    c = c || {};
    return {
      code: str(c.code) || ('CP' + String(i + 1).padStart(3, '0')),
      name: str(c.name) || str(c.desc) || '优惠券',
      desc: str(c.desc),
      type: str(c.type) || 'cash',
      value: Math.max(0, num(c.value)),
      min: Math.max(0, num(c.min)),
      validFrom: str(c.validFrom) || todayIso(),
      validTo: str(c.validTo) || addDays(30),
      totalQty: c.totalQty == null ? 1000 : Math.max(0, num(c.totalQty)),
      issuedQty: Math.max(0, num(c.issuedQty)),
      usedQty: Math.max(0, num(c.usedQty)),
      perUserLimit: Math.max(1, num(c.perUserLimit, 1)),
      scope: str(c.scope) || 'all',
      skuIds: Array.isArray(c.skuIds) ? c.skuIds.map(str).filter(Boolean) : [],
      stackable: !!c.stackable,
      receiveType: str(c.receiveType) || 'public',
      status: str(c.status) || 'on',
      createdAt: c.createdAt || nowIso(),
      updatedAt: c.updatedAt || nowIso()
    };
  }

  function coupons() {
    return asArray(safeRead(KEYS.coupons, [])).map(normalizeCoupon);
  }

  function saveCoupon(item) {
    var list = coupons();
    var c = normalizeCoupon(item, list.length);
    if (!c.name) return fail('请填写优惠券名称');
    if (c.type === 'percent' && (c.value <= 0 || c.value >= 10)) return fail('折扣券面值需在 0~10 之间，如 9 表示 9 折');
    if (c.type === 'cash' && c.value <= 0) return fail('满减券面值必须大于 0');
    if (c.validFrom && c.validTo && c.validFrom > c.validTo) return fail('有效期开始日期不能晚于结束日期');
    var idx = -1;
    for (var i = 0; i < list.length; i++) { if (list[i].code === c.code) { idx = i; break; } }
    if (idx >= 0) { c.createdAt = list[idx].createdAt; c.issuedQty = list[idx].issuedQty; c.usedQty = list[idx].usedQty; c.updatedAt = nowIso(); list[idx] = c; }
    else { list.push(c); }
    var w = safeWrite(KEYS.coupons, list);
    if (!w.ok) return w;
    return done(c);
  }

  function removeCoupon(code) {
    return safeWrite(KEYS.coupons, coupons().filter(function (c) { return c.code !== code; }));
  }

  function claims() { return asArray(safeRead(KEYS.claims, [])); }
  function writeClaims(list) { return safeWrite(KEYS.claims, list); }

  function couponUsable(c, subtotal, memberKey) {
    var today = todayIso();
    if (!c || c.status !== 'on') return false;
    if (c.validFrom && today < c.validFrom) return false;
    if (c.validTo && today > c.validTo) return false;
    if (c.totalQty > 0 && c.issuedQty >= c.totalQty) return false;
    if (subtotal > 0 && subtotal < c.min) return false;
    if (memberKey) {
      var used = claims().filter(function (x) { return x.code === c.code && x.memberKey === memberKey && x.status === 'used'; }).length;
      if (used >= c.perUserLimit) return false;
    }
    return true;
  }

  function couponDiscount(c, subtotal) {
    if (!c) return 0;
    if (c.type === 'percent') return Math.max(0, subtotal * (1 - c.value / 10));
    return Math.min(subtotal, c.value);
  }

  function bestCoupon(subtotal, memberKey) {
    var best = null, bestVal = 0;
    coupons().forEach(function (c) {
      if (!couponUsable(c, subtotal, memberKey)) return;
      var v = couponDiscount(c, subtotal);
      if (v > bestVal) { best = c; bestVal = v; }
    });
    return best ? { coupon: best, discount: Math.round(bestVal * 100) / 100 } : null;
  }

  function claimCoupon(code, memberKey) {
    var c = null;
    coupons().forEach(function (x) { if (x.code === code) c = x; });
    if (!c) return fail('优惠券不存在');
    if (!couponUsable(c, 0, '')) return fail('该优惠券已失效或已领完');
    var list = claims();
    var mine = list.filter(function (x) { return x.code === code && x.memberKey === memberKey; });
    if (mine.length >= c.perUserLimit) return fail('已达到该券每人限领数量');
    list.push({ id: uid('CLM'), code: code, memberKey: memberKey || 'guest', status: 'claimed', claimedAt: nowIso(), usedAt: '', orderNo: '' });
    var listAll = coupons();
    for (var i = 0; i < listAll.length; i++) { if (listAll[i].code === code) { listAll[i].issuedQty += 1; break; } }
    var w = safeWrite(KEYS.coupons, listAll);
    if (!w.ok) return w;
    var wc = writeClaims(list);
    if (!wc.ok) return wc;
    return done(c);
  }

  function consumeCoupon(code, memberKey, orderNo) {
    if (!code) return done(null);
    var list = claims();
    var claim = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].code === code && list[i].memberKey === (memberKey || 'guest') && list[i].status === 'claimed') { claim = list[i]; break; }
    }
    if (claim) { claim.status = 'used'; claim.usedAt = nowIso(); claim.orderNo = orderNo || ''; }
    var all = coupons();
    for (var j = 0; j < all.length; j++) { if (all[j].code === code) { all[j].usedQty += 1; break; } }
    var w1 = safeWrite(KEYS.coupons, all);
    if (!w1.ok) return w1;
    return writeClaims(list);
  }

  /* ---------------- 会员 ---------------- */
  function normalizeMember(m, i) {
    m = m || {};
    return {
      id: str(m.id) || ('M' + String(i + 1).padStart(4, '0')),
      userId: str(m.userId),
      nickname: str(m.nickname) || str(m.name) || '会员',
      phone: str(m.phone),
      avatar: str(m.avatar),
      gender: str(m.gender) || '未知',
      region: str(m.region),
      level: str(m.level) || 'normal',
      growth: Math.max(0, num(m.growth)),
      points: Math.max(0, num(m.points)),
      regDate: str(m.regDate) || todayIso(),
      lastOrderAt: str(m.lastOrderAt),
      tags: Array.isArray(m.tags) ? m.tags : [],
      source: str(m.source) || 'H5商城',
      status: str(m.status) || 'active',
      address: str(m.address)
    };
  }

  function members() {
    return asArray(safeRead(KEYS.members, [])).map(normalizeMember);
  }

  function saveMember(item) {
    var list = members();
    var m = normalizeMember(item, list.length);
    if (!m.nickname) return fail('请填写会员昵称');
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === m.id || (m.phone && list[i].phone === m.phone)) { idx = i; break; }
    }
    if (idx >= 0) { m.id = list[idx].id; list[idx] = m; } else { list.push(m); }
    var w = safeWrite(KEYS.members, list);
    if (!w.ok) return w;
    return done(m);
  }

  function removeMember(id) {
    return safeWrite(KEYS.members, members().filter(function (m) { return m.id !== id; }));
  }

  function orderBelongsTo(order, member) {
    if (!order || !member) return false;
    if (order.memberId && order.memberId === member.id) return true;
    if (order.userId && member.userId && order.userId === member.userId) return true;
    var phone = member.phone;
    if (phone && order.address && order.address.phone === phone) return true;
    if (phone && order.phone === phone) return true;
    var names = [member.nickname];
    if (order.address && order.address.name && names.indexOf(order.address.name) >= 0) return true;
    if (order.user && names.indexOf(order.user) >= 0) return true;
    if (order.userName && names.indexOf(order.userName) >= 0) return true;
    return false;
  }

  function memberOrders(member) {
    return orders().filter(function (o) { return orderBelongsTo(o, member); });
  }

  function memberStats(member) {
    var list = memberOrders(member);
    var valid = list.filter(function (o) { return o.statusCode !== 'cancelled'; });
    var spend = valid.reduce(function (s, o) { return s + num(o.total); }, 0);
    var last = '';
    valid.forEach(function (o) { if (!last || String(o.createdAt || '') > last) last = String(o.createdAt || ''); });
    return {
      orderCount: valid.length,
      totalSpend: Math.round(spend * 100) / 100,
      lastOrderAt: last,
      points: member.points || 0
    };
  }

  /* ---------------- 订单 ---------------- */
  var STATUS_CN = {
    pending: '待付款', paid: '待发货', shipped: '待收货', completed: '已完成',
    cancelled: '已取消', refunding: '退款中', refunded: '已退款'
  };
  var STATUS_CODE = {
    '待付款': 'pending', '待发货': 'paid', '待收货': 'shipped', '已完成': 'completed',
    '已取消': 'cancelled', '退款中': 'refunding', '已退款': 'refunded'
  };

  function normalizeOrder(o) {
    o = o || {};
    var code = str(o.statusCode);
    if (!code) code = STATUS_CODE[str(o.status)] || 'pending';
    return {
      id: str(o.id) || str(o.no),
      no: str(o.no) || str(o.id),
      memberId: str(o.memberId),
      userId: str(o.userId || o.user || o.userName),
      items: asArray(o.items),
      subtotal: num(o.subtotal),
      discount: num(o.discount),
      couponCode: str(o.couponCode),
      couponDiscount: num(o.couponDiscount),
      pointsUsed: num(o.pointsUsed),
      pointsDiscount: num(o.pointsDiscount),
      freight: num(o.freight),
      total: num(o.total),
      payment: str(o.payment),
      payTxnNo: str(o.payTxnNo),
      payTime: str(o.payTime),
      invoice: !!o.invoice,
      invoiceId: str(o.invoiceId),
      address: o.address || {},
      remark: str(o.remark),
      status: STATUS_CN[code] || str(o.status) || '待付款',
      statusCode: code,
      afterSalesId: str(o.afterSalesId),
      createdAt: o.createdAt || nowIso(),
      logistics: asArray(o.logistics)
    };
  }

  function orders() {
    return asArray(safeRead(KEYS.orders, [])).map(normalizeOrder)
      .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  }

  function saveOrder(order) {
    var list = orders();
    var o = normalizeOrder(order);
    if (!o.no) return fail('订单号不能为空');
    var idx = -1;
    for (var i = 0; i < list.length; i++) { if (list[i].no === o.no) { idx = i; break; } }
    if (idx >= 0) list[idx] = o; else list.unshift(o);
    var w = safeWrite(KEYS.orders, list);
    if (!w.ok) return w;
    return done(o);
  }

  function updateOrder(no, patch) {
    var list = orders();
    var target = null;
    for (var i = 0; i < list.length; i++) { if (list[i].no === no) { target = list[i]; break; } }
    if (!target) return fail('订单不存在');
    Object.keys(patch || {}).forEach(function (k) { target[k] = patch[k]; });
    if (patch && patch.statusCode && !patch.status) target.status = STATUS_CN[patch.statusCode] || target.status;
    var w = safeWrite(KEYS.orders, list);
    if (!w.ok) return w;
    return done(target);
  }

  function cancelOrder(no, reason) {
    return updateOrder(no, { statusCode: 'cancelled', status: '已取消', cancelReason: reason || '' });
  }

  function shipOrder(no, company, tracking) {
    var list = orders();
    var target = null;
    for (var i = 0; i < list.length; i++) { if (list[i].no === no) { target = list[i]; break; } }
    if (!target) return fail('订单不存在');
    if (target.statusCode !== 'paid') return fail('仅待发货订单可以发货');
    target.statusCode = 'shipped';
    target.status = '待收货';
    target.logistics = asArray(target.logistics).concat([{ company: company, tracking: tracking, shippedAt: nowIso() }]);
    var w = safeWrite(KEYS.orders, list);
    if (!w.ok) return w;
    var ships = asArray(safeRead(KEYS.salesOrders, []));
    ships.unshift({ orderNo: target.no, tracking: tracking, company: company, shippedAt: nowIso() });
    safeWrite(KEYS.salesOrders, ships);
    return done(target);
  }

  /* ---------------- 售后 ---------------- */
  function normalizeAfterSale(a) {
    a = a || {};
    return {
      id: str(a.id) || uid('AS'),
      orderNo: str(a.orderNo),
      memberId: str(a.memberId),
      type: str(a.type) || 'refund',
      reason: str(a.reason),
      amount: Math.max(0, num(a.amount)),
      status: str(a.status) || 'pending',
      applyAt: a.applyAt || nowIso(),
      handleAt: str(a.handleAt),
      handler: str(a.handler),
      remark: str(a.remark)
    };
  }
  function afterSales() { return asArray(safeRead(KEYS.afterSales, [])).map(normalizeAfterSale); }
  function saveAfterSale(item) {
    var list = afterSales();
    var a = normalizeAfterSale(item);
    if (!a.orderNo) return fail('请选择关联订单');
    var idx = -1;
    for (var i = 0; i < list.length; i++) { if (list[i].id === a.id) { idx = i; break; } }
    if (idx >= 0) list[idx] = a; else list.unshift(a);
    var w = safeWrite(KEYS.afterSales, list);
    if (!w.ok) return w;
    return done(a);
  }
  function updateAfterSale(id, patch) {
    var list = afterSales();
    var a = null;
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { a = list[i]; break; } }
    if (!a) return fail('售后单不存在');
    Object.keys(patch || {}).forEach(function (k) { a[k] = patch[k]; });
    a.handleAt = a.handleAt || nowIso();
    var w = safeWrite(KEYS.afterSales, list);
    if (!w.ok) return w;
    if (a.status === 'approved' || a.status === 'refunded') {
      updateOrder(a.orderNo, {
        statusCode: a.status === 'refunded' ? 'refunded' : 'refunding',
        status: a.status === 'refunded' ? '已退款' : '退款中',
        afterSalesId: a.id
      });
    }
    return done(a);
  }

  /* ---------------- 发票 ---------------- */
  function normalizeInvoice(v) {
    v = v || {};
    return {
      id: str(v.id) || uid('INV'),
      titleType: str(v.titleType) || 'personal',
      title: str(v.title) || '个人',
      taxNo: str(v.taxNo),
      email: str(v.email),
      phone: str(v.phone),
      companyAddress: str(v.companyAddress),
      companyPhone: str(v.companyPhone),
      bankName: str(v.bankName),
      bankAccount: str(v.bankAccount),
      amount: num(v.amount),
      type: str(v.type) || '电子普通发票',
      contentType: str(v.contentType) || '商品明细',
      orderNo: str(v.orderNo),
      applyTime: v.applyTime || nowIso(),
      status: str(v.status) || 'pending',
      invoiceNo: str(v.invoiceNo),
      issueTime: str(v.issueTime),
      rejectReason: str(v.rejectReason),
      voidReason: str(v.voidReason),
      reissueOf: str(v.reissueOf),
      operator: str(v.operator)
    };
  }
  function invoices() { return asArray(safeRead(KEYS.invoices, [])).map(normalizeInvoice); }
  function saveInvoice(item) {
    var list = invoices();
    var v = normalizeInvoice(item);
    if (!v.amount || v.amount <= 0) return fail('开票金额必须大于 0');
    if (v.titleType === 'company' && !v.taxNo) return fail('企业抬头必须填写税号');
    var idx = -1;
    for (var i = 0; i < list.length; i++) { if (list[i].id === v.id) { idx = i; break; } }
    if (idx >= 0) list[idx] = v; else list.unshift(v);
    var w = safeWrite(KEYS.invoices, list);
    if (!w.ok) return w;
    return done(v);
  }
  function updateInvoice(id, patch) {
    var list = invoices();
    var v = null;
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { v = list[i]; break; } }
    if (!v) return fail('发票申请不存在');
    Object.keys(patch || {}).forEach(function (k) { v[k] = patch[k]; });
    if (patch && patch.status === 'issued' && !v.issueTime) v.issueTime = nowIso();
    var w = safeWrite(KEYS.invoices, list);
    if (!w.ok) return w;
    return done(v);
  }

  /* ---------------- 社区 ---------------- */
  function posts() { return asArray(safeRead(KEYS.posts, [])); }
  function normalizePost(p) {
    p = p || {};
    return {
      id: str(p.id) || uid('P'),
      author: str(p.author) || '匿名用户',
      memberId: str(p.memberId),
      content: str(p.content),
      images: Array.isArray(p.images) ? p.images : [],
      topic: str(p.topic),
      productId: str(p.productId),
      status: str(p.status) || 'pending',
      time: p.time || nowIso(),
      auditBy: str(p.auditBy),
      auditAt: str(p.auditAt),
      rejectReason: str(p.rejectReason)
    };
  }
  function savePost(post) {
    var list = posts();
    var p = normalizePost(post);
    if (!p.content) return fail('动态内容不能为空');
    var idx = -1;
    for (var i = 0; i < list.length; i++) { if (list[i].id === p.id) { idx = i; break; } }
    if (idx >= 0) list[idx] = p; else list.unshift(p);
    var w = safeWrite(KEYS.posts, list);
    if (!w.ok) return w;
    return done(p);
  }
  function reviewPost(id, status, reason, auditor) {
    var list = posts();
    var p = null;
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { p = list[i]; break; } }
    if (!p) return fail('动态不存在');
    p.status = status;
    p.auditBy = auditor || '后台管理员';
    p.auditAt = nowIso();
    p.rejectReason = status === 'rejected' ? (reason || '') : '';
    var w = safeWrite(KEYS.posts, list);
    if (!w.ok) return w;
    return done(p);
  }
  function removePost(id) {
    var w = safeWrite(KEYS.posts, posts().filter(function (p) { return p.id !== id; }));
    if (!w.ok) return w;
    var comments = safeRead(KEYS.comments, {});
    var likes = safeRead(KEYS.likes, {});
    delete comments[id];
    delete likes[id];
    safeWrite(KEYS.comments, comments);
    safeWrite(KEYS.likes, likes);
    return done(true);
  }

  /* ---------------- 配置 ---------------- */
  var DEFAULT_SETTINGS = {
    version: VERSION,
    levelRules: [
      { level: 'vip', name: 'VIP会员', min: 3000 },
      { level: 'gold', name: '金卡会员', min: 1000 },
      { level: 'normal', name: '普通会员', min: 0 }
    ],
    points: { rate: 1, deductRate: 100 },
    freight: [
      { id: 'FT-DEFAULT', name: '默认冷链配送', firstQty: 1, firstFee: 12, extraQty: 1, extraFee: 5, region: '全国（除偏远）' }
    ],
    invoice: { defaultType: '电子普通发票', emailNotify: true },
    categories: [
      { code: 'fruit', name: '水果', sort: 1, status: 'on' },
      { code: 'gift', name: '礼盒', sort: 2, status: 'on' },
      { code: 'adopt', name: '认养', sort: 3, status: 'on' }
    ],
    varieties: [
      { code: 'huaniu', name: '花牛苹果', sort: 1, status: 'on' },
      { code: 'redfuji', name: '红富士', sort: 2, status: 'on' },
      { code: 'gala', name: '嘎啦', sort: 3, status: 'on' },
      { code: 'qinguan', name: '秦冠', sort: 4, status: 'on' },
      { code: 'jinshuai', name: '金帅', sort: 5, status: 'on' },
      { code: 'hongxing', name: '红星', sort: 6, status: 'on' },
      { code: 'guoguang', name: '国光', sort: 7, status: 'on' },
      { code: 'mixed', name: '混合装', sort: 8, status: 'on' }
    ],
    home: {
      banners: [
        { id: 'BN-01', title: '新品上市', subtitle: '花牛苹果新鲜采摘 · 限量抢购', img: 'images/apple_orchard_banner.jpg', link: 'h5_store.html', status: 'on' }
      ],
      quickEntries: ['商城', '认养', '溯源', '我的']
    },
    notices: [
      { id: 'NT-01', scene: 'order_paid', title: '支付成功', content: '您的订单已支付成功，我们将尽快为您发货', status: 'on' },
      { id: 'NT-02', scene: 'order_shipped', title: '宝贝已发货', content: '您的订单已发货，请注意查收', status: 'on' }
    ]
  };

  function settings() {
    var s = safeRead(KEYS.settings, null);
    if (!s || typeof s !== 'object') return clone(DEFAULT_SETTINGS);
    var merged = clone(DEFAULT_SETTINGS);
    Object.keys(s).forEach(function (k) { merged[k] = s[k]; });
    return merged;
  }
  function saveSettings(patch) {
    var s = settings();
    Object.keys(patch || {}).forEach(function (k) { s[k] = patch[k]; });
    return safeWrite(KEYS.settings, s);
  }

  /* ---------------- 指标 ---------------- */
  function metrics() {
    var os = orders();
    var valid = os.filter(function (o) { return o.statusCode !== 'cancelled' && o.statusCode !== 'pending' && o.statusCode !== 'refunded'; });
    var gmv = valid.reduce(function (s, o) { return s + num(o.total); }, 0);
    var memberList = members();
    var perMember = {};
    valid.forEach(function (o) {
      var key = o.memberId || o.userId || (o.address && (o.address.phone || o.address.name)) || o.no;
      perMember[key] = (perMember[key] || 0) + 1;
    });
    var buyers = Object.keys(perMember).length;
    var repeat = Object.keys(perMember).filter(function (k) { return perMember[k] >= 2; }).length;
    var couponList = coupons();
    var issued = couponList.reduce(function (s, c) { return s + c.issuedQty; }, 0);
    var used = couponList.reduce(function (s, c) { return s + c.usedQty; }, 0);
    var skuMap = {};
    valid.forEach(function (o) {
      asArray(o.items).forEach(function (it) {
        var key = it.id || it.name || '未知商品';
        if (!skuMap[key]) skuMap[key] = { id: key, name: it.name || key, qty: 0, amount: 0 };
        skuMap[key].qty += num(it.qty, 1);
        skuMap[key].amount += num(it.price) * num(it.qty, 1);
      });
    });
    var topSkus = Object.keys(skuMap).map(function (k) { return skuMap[k]; })
      .sort(function (a, b) { return b.amount - a.amount; }).slice(0, 5);
    var monthMap = {};
    valid.forEach(function (o) {
      var m = String(o.createdAt || '').slice(0, 7);
      if (!m) return;
      if (!monthMap[m]) monthMap[m] = { month: m, gmv: 0, orders: 0 };
      monthMap[m].gmv += num(o.total);
      monthMap[m].orders += 1;
    });
    var monthly = Object.keys(monthMap).sort().map(function (k) { return monthMap[k]; });
    return {
      gmv: Math.round(gmv * 100) / 100,
      orderCount: valid.length,
      aov: valid.length ? Math.round(gmv / valid.length * 100) / 100 : 0,
      buyerCount: buyers,
      repurchaseRate: buyers ? Math.round(repeat / buyers * 1000) / 10 : 0,
      memberCount: memberList.length,
      couponIssued: issued,
      couponUsed: used,
      couponRedemption: issued ? Math.round(used / issued * 1000) / 10 : 0,
      invoicePending: invoices().filter(function (v) { return v.status === 'pending'; }).length,
      afterSalesPending: afterSales().filter(function (a) { return a.status === 'pending'; }).length,
      topSkus: topSkus,
      monthly: monthly,
      channelMix: [
        { name: 'H5 商城', value: valid.length },
        { name: '线下/其他', value: 0 }
      ]
    };
  }

  /* ---------------- 迁移 ---------------- */
  function migrate() {
    var changed = false;
    var ms = members();
    var os = asArray(safeRead(KEYS.orders, []));
    os.forEach(function (o) {
      if (o && !o.memberId) {
        var matched = null;
        for (var i = 0; i < ms.length; i++) {
          var m = ms[i];
          if ((m.phone && o.address && m.phone === o.address.phone) || (m.nickname && o.address && m.nickname === o.address.name)) { matched = m; break; }
        }
        if (matched) { o.memberId = matched.id; changed = true; }
      }
      if (o && !o.statusCode) {
        var code = STATUS_CODE[o.status];
        if (code) { o.statusCode = code; changed = true; }
      }
    });
    if (changed) safeWrite(KEYS.orders, os);
    // 历史社区动态默认视为已通过，避免上线后全部消失
    var ps = posts();
    var postChanged = false;
    ps.forEach(function (p) { if (p && !p.status) { p.status = 'approved'; postChanged = true; } });
    if (postChanged) safeWrite(KEYS.posts, ps);
    try { localStorage.setItem('mall_store_version', String(VERSION)); } catch (e) {}
    return { ok: true, data: { version: VERSION, ordersChanged: changed, postsChanged: postChanged } };
  }

  window.MallStore = {
    VERSION: VERSION,
    KEYS: KEYS,
    STATUS_CN: STATUS_CN,
    migrate: migrate,
    products: products,
    saveProduct: saveProduct,
    removeProduct: removeProduct,
    replaceProducts: replaceProducts,
    promotions: promotions,
    savePromotion: savePromotion,
    removePromotion: removePromotion,
    activePromotions: activePromotions,
    coupons: coupons,
    saveCoupon: saveCoupon,
    removeCoupon: removeCoupon,
    claims: claims,
    couponUsable: couponUsable,
    couponDiscount: couponDiscount,
    bestCoupon: bestCoupon,
    claimCoupon: claimCoupon,
    consumeCoupon: consumeCoupon,
    members: members,
    saveMember: saveMember,
    removeMember: removeMember,
    memberOrders: memberOrders,
    memberStats: memberStats,
    orders: orders,
    saveOrder: saveOrder,
    updateOrder: updateOrder,
    cancelOrder: cancelOrder,
    shipOrder: shipOrder,
    afterSales: afterSales,
    saveAfterSale: saveAfterSale,
    updateAfterSale: updateAfterSale,
    invoices: invoices,
    saveInvoice: saveInvoice,
    updateInvoice: updateInvoice,
    posts: posts,
    savePost: savePost,
    reviewPost: reviewPost,
    removePost: removePost,
    settings: settings,
    saveSettings: saveSettings,
    metrics: metrics
  };
  window.MallMetrics = window.MallStore.metrics;

  try { migrate(); } catch (e) { try { console.warn('[MallStore] 迁移失败', e); } catch (ignore) {} }
  if (typeof depsReady !== 'undefined') preloadFromBackend();
})(window);
