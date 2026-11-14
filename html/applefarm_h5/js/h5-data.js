/**
 * h5-data.js — H5 消费者端统一后端数据桥接层
 * --------------------------------------------------------------
 * 严格空库模式下，H5 端所有业务数据读写一律走后端 REST（window.Api），
 * 不再读写 localStorage 业务键。本文件负责：
 *   1. 自动加载 ../common/js/api.js；
 *   2. 提供 snake_case（后端）↔ camelCase（前端页面）字段映射；
 *   3. 提供按会员归属过滤的 list/create/update/remove 封装；
 *   4. 提供当前登录会员上下文（从 smartorchard_token 解析）。
 *
 * 暴露：window.H5Data
 *   H5Data.ready                     Promise（依赖加载完成）
 *   H5Data.currentMember()           当前会员 { id, phone, nickname, level } | null
 *   H5Data.memberKey()               会员标识（会员 id 或会话设备标识）
 *   H5Data.list(resource)            Promise<camelCase[]>
 *   H5Data.create(resource, data)    Promise<res>（camelCase → snake_case + 归属注入）
 *   H5Data.update(resource, id, data)
 *   H5Data.remove(resource, id)
 *   H5Data.cart / H5Data.address / H5Data.favorite / H5Data.order 便捷子模块
 * ============================================================ */
(function (global) {
  'use strict';

  /* ============================================================
   * 依赖自动加载（策略：注入 script，与后台 mall-store.js 一致）
   * ============================================================ */
  var depsReady = (function ensureDeps() {
    if (typeof document === 'undefined') return Promise.resolve();
    var selfEl = document.currentScript;
    if (!selfEl || !selfEl.src) return Promise.resolve();
    var baseDir = selfEl.src.replace(/[^\/]*$/, '');
    var deps = [
      { name: 'Api', src: baseDir + '../../common/js/api.js' }
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

  /* ============================================================
   * 基础工具
   * ============================================================ */
  function str(v) { return v == null ? '' : String(v).trim(); }
  function num(v, d) { var n = Number(v); return isNaN(n) ? (d == null ? 0 : d) : n; }
  function nval(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
  function jparse(v, d) { try { return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function dstr(v) { return v ? String(v).replace('T', ' ').slice(0, 19) : ''; }
  /* 写库 datetime 统一为 'YYYY-MM-DD HH:MM:SS'（MySQL 拒绝 ISO 的 T/Z 与本地化格式） */
  function sqlDt(v) {
    if (!v) return null;
    var d = (v instanceof Date) ? v : new Date(v);
    if (isNaN(d.getTime())) return null;
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function ddstr(v) { return v ? String(v).slice(0, 10) : ''; }
  function i2b(v) { return v === 1 || v === '1' || v === true; }
  function b2i(v) { return v ? 1 : 0; }
  function toCamelKey(k) { return k.replace(/_([a-z0-9])/g, function (m, c) { return c.toUpperCase(); }); }
  function toCamel(row) {
    var o = {};
    Object.keys(row || {}).forEach(function (k) { o[toCamelKey(k)] = row[k]; });
    return o;
  }
  function nowIso() { return new Date().toISOString(); }
  function uid(prefix) { return (prefix || 'ID') + Date.now() + Math.floor(Math.random() * 900 + 100); }

  /* ============================================================
   * 会员上下文（从 smartorchard_token 解析 JWT payload）
   * ============================================================ */
  function decodeToken() {
    var t = '';
    try { t = (global.Api && typeof Api.getToken === 'function') ? Api.getToken() : ''; } catch (e) { t = ''; }
    if (!t) return null;
    try {
      var parts = String(t).split('.');
      if (parts.length < 2) return null;
      var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      var json = decodeURIComponent(escape(global.atob(b64)));
      return JSON.parse(json);
    } catch (e) { return null; }
  }
  function currentMember() {
    var p = decodeToken();
    if (!p || p.type !== 'member') return null;
    return { id: p.id, phone: p.phone, nickname: p.nickname, level: p.level };
  }
  function deviceKey() {
    try {
      var k = 'h5_device_key';
      var v = global.sessionStorage.getItem(k);
      if (!v) { v = 'DEV' + Date.now() + Math.floor(Math.random() * 900 + 100); global.sessionStorage.setItem(k, v); }
      return v;
    } catch (e) { return 'guest'; }
  }
  function memberKey() {
    var m = currentMember();
    return m ? String(m.id) : deviceKey();
  }

  /* ============================================================
   * 字段映射：snake_case（后端）↔ camelCase（前端）
   * ============================================================ */
  var MAPS = {};

  MAPS.product = {
    row: function (r) {
      return {
        id: str(r.product_code), name: str(r.product_name), desc: str(r.desc),
        price: num(r.price), original: num(r.original), costPrice: num(r.cost_price), memberPrice: num(r.member_price),
        variety: str(r.variety), spec: str(r.spec), unit: str(r.unit), tag: str(r.tag),
        stock: num(r.stock), safetyStock: num(r.safety_stock), soldCount: num(r.sold_count),
        sort: num(r.sort), serviceTags: jparse(r.service_tags, []), detailHtml: str(r.detail_html),
        img: '', cat: '', status: r.status === 'off' ? 'off' : 'on',
        createdAt: dstr(r.created_at), updatedAt: dstr(r.updated_at)
      };
    },
    toRow: function (p) {
      return {
        product_code: p.id, product_name: p.name, desc: p.desc,
        price: nval(p.price), original: nval(p.original), cost_price: nval(p.costPrice), member_price: nval(p.memberPrice),
        variety: p.variety, spec: p.spec, unit: p.unit, tag: p.tag,
        stock: nval(p.stock), safety_stock: nval(p.safetyStock), sold_count: nval(p.soldCount),
        sort: nval(p.sort), service_tags: p.serviceTags ? JSON.stringify(p.serviceTags) : null,
        detail_html: p.detailHtml || null, status: p.status === 'off' ? 'off' : 'on'
      };
    }
  };

  MAPS.promotion = {
    row: function (r) {
      return {
        id: str(r.promotion_name), title: str(r.promotion_name), subTitle: str(r.subtitle),
        type: str(r.promotion_type), price: num(r.price_range), original: num(r.original),
        img: str(r.img), tag: str(r.tag), scope: str(r.scope),
        skuIds: str(r.product_ids).split(',').filter(Boolean), channel: str(r.channel),
        limitPerUser: num(r.limit_per_user), totalStock: num(r.total_stock), usedStock: num(r.used_stock),
        priority: num(r.priority), memberOnly: i2b(r.member_only),
        startDate: ddstr(r.start_date), endDate: ddstr(r.end_date), target: str(r.target),
        status: r.status
      };
    },
    toRow: function (p) {
      return {
        promotion_name: p.title || p.id, subtitle: p.subTitle || null,
        promotion_type: p.type, product_ids: p.skuIds ? p.skuIds.join(',') : null,
        price_range: p.price != null ? String(p.price) : null, original: nval(p.original),
        img: p.img || null, tag: p.tag || null, scope: p.scope || null, channel: p.channel || null,
        limit_per_user: nval(p.limitPerUser), total_stock: nval(p.totalStock), used_stock: nval(p.usedStock),
        priority: nval(p.priority), member_only: b2i(p.memberOnly), target: p.target || null,
        start_date: p.startDate || null, end_date: p.endDate || null, status: p.status || 'active'
      };
    }
  };

  MAPS.coupon = {
    row: function (r) {
      return {
        code: str(r.coupon_code || r.coupon_name), name: str(r.coupon_name), desc: str(r.desc),
        type: str(r.coupon_type), value: num(r.discount), min: num(r.threshold),
        validFrom: ddstr(r.valid_start), validTo: ddstr(r.valid_end),
        totalQty: num(r.total_count), issuedQty: num(r.issued_count), usedQty: num(r.used_count),
        perUserLimit: num(r.per_limit, 1), scope: str(r.scope), skuIds: jparse(r.sku_ids, []),
        stackable: i2b(r.stackable), receiveType: str(r.receive_type),
        status: r.status === 'off' ? 'off' : 'on', createdAt: dstr(r.created_at), updatedAt: dstr(r.updated_at)
      };
    },
    toRow: function (c) {
      return {
        coupon_code: c.code, coupon_name: c.name, desc: c.desc,
        coupon_type: c.type, discount: c.value != null ? String(c.value) : null, threshold: c.min != null ? String(c.min) : null,
        total_count: nval(c.totalQty), issued_count: nval(c.issuedQty), used_count: nval(c.usedQty),
        per_limit: nval(c.perUserLimit), scope: c.scope || null,
        sku_ids: c.skuIds ? JSON.stringify(c.skuIds) : null, stackable: b2i(c.stackable),
        receive_type: c.receiveType || null, valid_start: c.validFrom || null, valid_end: c.validTo || null,
        status: c.status === 'off' ? 'off' : 'on'
      };
    }
  };

  MAPS.claim = {
    row: function (r) {
      return {
        id: str(r.claim_code), code: str(r.coupon_code), memberKey: str(r.member_key),
        status: str(r.status), claimedAt: dstr(r.claimed_at), usedAt: dstr(r.used_at), orderNo: str(r.order_no)
      };
    },
    toRow: function (c) {
      return {
        claim_code: c.id || uid('CLM'), coupon_code: c.code, member_key: c.memberKey || memberKey(),
        status: c.status, claimed_at: sqlDt(c.claimedAt), used_at: sqlDt(c.usedAt), order_no: c.orderNo || null
      };
    }
  };

  MAPS.member = {
    row: function (r) {
      return {
        id: str(r.member_code), _id: r.id, userId: str(r.user_id), nickname: str(r.nickname), phone: str(r.phone),
        avatar: str(r.avatar), gender: str(r.gender), region: str(r.region),
        level: str(r.level) || 'normal', growth: num(r.growth), points: num(r.points),
        regDate: dstr(r.register_time), lastOrderAt: dstr(r.last_order_time),
        tags: jparse(r.tags, []), source: str(r.source), status: str(r.status), address: str(r.address)
      };
    },
    toRow: function (m) {
      return {
        member_code: m.id, user_id: m.userId || null, nickname: m.nickname, phone: m.phone,
        avatar: m.avatar || null, gender: m.gender || null, region: m.region || null,
        level: m.level, points: nval(m.points), growth: nval(m.growth),
        tags: m.tags ? JSON.stringify(m.tags) : null, source: m.source || null,
        address: m.address || null, status: m.status,
        register_time: m.regDate || null, last_order_time: m.lastOrderAt || null
      };
    }
  };

  MAPS.post = {
    row: function (r) {
      return {
        id: str(r.id), author: str(r.author), memberId: str(r.member_id), content: str(r.content),
        images: jparse(r.images, []), topic: str(r.topic), productId: str(r.product_id),
        likeCount: num(r.like_count), commentCount: num(r.comment_count),
        status: str(r.status), time: dstr(r.publish_time), auditBy: str(r.audit_by),
        auditAt: dstr(r.audit_at), rejectReason: str(r.reject_reason)
      };
    },
    toRow: function (p) {
      return {
        author: p.author, member_id: p.memberId || null, content: p.content,
        images: p.images ? JSON.stringify(p.images) : null, topic: p.topic || null,
        product_id: p.productId || null, like_count: nval(p.likeCount), comment_count: nval(p.commentCount),
        status: p.status || 'pending', publish_time: sqlDt(p.time),
        audit_by: p.auditBy || null, audit_at: sqlDt(p.auditAt), reject_reason: p.rejectReason || null
      };
    }
  };

  MAPS.notice = {
    row: function (r) {
      return {
        id: str(r.id), scene: str(r.trigger_scene), title: str(r.title), content: str(r.content),
        status: str(r.status), createdAt: dstr(r.created_at), updatedAt: dstr(r.updated_at)
      };
    },
    toRow: function (n) {
      return { trigger_scene: n.scene, title: n.title, content: n.content, status: n.status || 'active' };
    }
  };

  MAPS.invoice = {
    row: function (r) {
      return {
        id: str(r.invoice_code), titleType: str(r.title_type) || 'personal', title: str(r.title), taxNo: str(r.tax_no),
        email: str(r.email), phone: str(r.phone), companyAddress: str(r.company_address),
        companyPhone: str(r.company_phone), bankName: str(r.bank_name), bankAccount: str(r.bank_account),
        amount: num(r.amount), type: str(r.invoice_type), contentType: str(r.content_type),
        orderNo: str(r.order_id) || str(r.invoice_code), applyTime: dstr(r.apply_time), status: str(r.status),
        invoiceNo: str(r.invoice_no), issueTime: dstr(r.issue_time), rejectReason: str(r.reject_reason),
        voidReason: str(r.void_reason), reissueOf: str(r.reissue_of), operator: str(r.operator)
      };
    },
    toRow: function (v) {
      return {
        invoice_code: v.id, title_type: v.titleType, title: v.title, tax_no: v.taxNo,
        email: v.email || null, phone: v.phone || null, company_address: v.companyAddress || null,
        company_phone: v.companyPhone || null, bank_name: v.bankName || null, bank_account: v.bankAccount || null,
        invoice_type: v.type, content_type: v.contentType || null, amount: nval(v.amount),
        apply_time: sqlDt(v.applyTime), status: v.status, invoice_no: v.invoiceNo || null,
        issue_time: sqlDt(v.issueTime), reject_reason: v.rejectReason || null,
        void_reason: v.voidReason || null, reissue_of: v.reissueOf || null, operator: v.operator || null
      };
    }
  };

  MAPS.feedback = {
    row: function (r) {
      return {
        _id: r.id, id: str(r.id), title: str(r.title), content: str(r.content),
        type: str(r.feedback_type) || 'suggestion', status: str(r.status) || 'pending',
        createTime: dstr(r.submit_time || r.created_at), source: str(r.source) || 'h5',
        operator: str(r.submitter || r.operator), operatorId: str(r.operator_id),
        contact: str(r.contact), reply: str(r.reply), rejectReason: str(r.reject_reason)
      };
    },
    toRow: function (f) {
      return {
        title: f.title, content: f.content, feedback_type: f.type || 'suggestion',
        submitter: f.operator || null, operator_id: f.operatorId || null,
        submit_time: sqlDt(f.createTime || nowIso()), status: f.status || 'pending',
        source: f.source || 'h5', contact: f.contact || null
      };
    }
  };

  /* ---------- 订单状态映射 ---------- */
  var ORDER_STATUS_CN = { pending: '待付款', to_ship: '待发货', shipped: '待收货', done: '已完成', cancelled: '已取消', refunded: '已退款' };
  function normalizeOrderStatusCode(code) {
    var c = str(code);
    if (c === 'paid') return 'to_ship';
    if (c === 'completed') return 'done';
    return c || 'pending';
  }

  MAPS.order = {
    row: function (r) {
      var addr = jparse(r.address, {});
      var logistics = jparse(r.logistics, []);
      var statusCode = normalizeOrderStatusCode(r.status);
      var status = ORDER_STATUS_CN[statusCode] || statusCode;
      if (logistics.length && statusCode === 'to_ship') { statusCode = 'shipped'; status = '待收货'; }
      return {
        id: str(r.order_code), no: str(r.order_code), _id: r.id,
        memberId: r.member_id == null ? '' : String(r.member_id),
        items: jparse(r.product_info, []),
        subtotal: num(r.subtotal, num(r.amount)), discount: num(r.discount),
        couponCode: str(r.coupon_code), couponDiscount: num(r.coupon_discount),
        pointsUsed: num(r.points_used), pointsDiscount: num(r.points_discount),
        freight: num(r.freight), total: num(r.amount),
        payment: str(r.pay_way), payTxnNo: str(r.pay_txn_no), payTime: dstr(r.pay_time),
        invoice: !!r.invoice_id, invoiceId: str(r.invoice_id),
        address: addr, remark: str(r.remark),
        status: status, statusCode: statusCode,
        afterSalesId: str(r.after_sales_id), createdAt: dstr(r.order_time || r.created_at),
        logistics: logistics
      };
    },
    toRow: function (o) {
      return {
        order_code: o.id || o.no, member_name: null,
        product_info: o.items ? JSON.stringify(o.items) : null, amount: nval(o.total),
        subtotal: nval(o.subtotal), discount: nval(o.discount),
        coupon_code: o.couponCode || null, coupon_discount: nval(o.couponDiscount),
        points_used: nval(o.pointsUsed), points_discount: nval(o.pointsDiscount),
        freight: nval(o.freight), pay_way: o.payment,
        pay_txn_no: o.payTxnNo || null, pay_time: sqlDt(o.payTime),
        invoice_id: o.invoiceId || (o.invoice ? (o.id || o.no) : null), address: o.address ? JSON.stringify(o.address) : null,
        status: normalizeOrderStatusCode(o.statusCode || o.status), remark: o.remark,
        after_sales_id: o.afterSalesId || null, logistics: o.logistics ? JSON.stringify(o.logistics) : null,
        order_time: sqlDt(o.createdAt)
      };
    }
  };

  MAPS.cart = {
    row: function (r) {
      return {
        _id: r.id, id: str(r.product_code), name: str(r.product_name),
        spec: str(r.spec), price: num(r.price), qty: num(r.quantity, 1),
        checked: i2b(r.checked), img: str(r.product_img)
      };
    },
    toRow: function (i) {
      return {
        product_code: i.id, product_name: i.name,
        product_img: i.img || null, spec: i.spec, price: nval(i.price),
        quantity: nval(i.qty, 1), checked: b2i(i.checked !== false)
      };
    }
  };

  MAPS.address = {
    row: function (r) {
      return {
        _id: r.id, id: str(r.address_code), name: str(r.name), phone: str(r.phone),
        region: str(r.region), detail: str(r.detail), default: i2b(r.is_default)
      };
    },
    toRow: function (a) {
      return {
        name: a.name, phone: a.phone,
        region: a.region, detail: a.detail, is_default: b2i(a.default)
      };
    }
  };

  MAPS.favorite = {
    row: function (r) {
      return {
        _id: r.id, id: str(r.product_code), name: str(r.product_name),
        desc: '', price: num(r.price), img: str(r.product_img), date: ddstr(r.created_at)
      };
    },
    toRow: function (f) {
      return {
        product_code: f.id, product_name: f.name,
        product_img: f.img || null, price: nval(f.price)
      };
    }
  };

  /* ============================================================
   * 通用 CRUD 封装
   * ============================================================ */
  function apiRef() {
    return (typeof global.Api === 'object' || typeof global.Api === 'function') ? global.Api : null;
  }

  /* 逻辑资源名 → 真实表名（通用 CRUD 的 resolveTable 会补 sf_ 前缀） */
  var TABLE_OF = {
    cart: 'mall_cart', address: 'mall_address', favorite: 'mall_favorite',
    order: 'mall_order', member: 'mall_member',
    product: 'mall_product', promotion: 'mall_promotion', coupon: 'mall_coupon',
    post: 'mall_post', notice: 'mall_notice', invoice: 'mall_invoice',
    feedback: 'mb_feedback'
  };
  function actual(res) { return TABLE_OF[res] || res; }

  function list(resource) {
    return depsReady.then(function () {
      var api = apiRef();
      if (!api) return [];
      var params = { size: 500 };
      if (resource === 'cart' || resource === 'address' || resource === 'favorite' || resource === 'order') {
        var m = currentMember();
        if (m) params.member_id = m.id;
        else if (resource !== 'order') params.member_key = deviceKey();
      }
      return api.get(actual(resource), params);
    }).then(function (res) {
      if (!res || !res.ok || !res.data) return [];
      var arr = res.data.list || res.data;
      if (!Array.isArray(arr)) arr = [];
      var m = MAPS[resource];
      return arr.map(function (r) { return m && m.row ? m.row(r) : toCamel(r); });
    }).catch(function () { return []; });
  }

  /* 各资源「唯一编码」字段：仅新增时自动生成，更新时不改写 */
  var CODE_FIELD = { cart: 'cart_code', address: 'address_code', favorite: 'favorite_code' };

  function create(resource, data) {
    return depsReady.then(function () {
      var api = apiRef();
      if (!api) return { ok: false, message: 'Api 未就绪' };
      var m = MAPS[resource];
      var row = (m && m.toRow) ? m.toRow(data) : data;
      var cm = currentMember();
      if (resource === 'cart' || resource === 'address' || resource === 'favorite') {
        if (row.member_id == null && cm) row.member_id = cm.id;
        if (row.member_key == null) row.member_key = cm ? String(cm.id) : deviceKey();
        var cf = CODE_FIELD[resource];
        if (cf && !row[cf]) row[cf] = uid(cf.replace(/_/g, '').toUpperCase());
      }
      if (resource === 'order') {
        if (row.member_id == null && cm) row.member_id = cm.id;
        if (row.member_name == null && cm) row.member_name = cm.nickname;
      }
      return api.create(actual(resource), row);
    });
  }

  function update(resource, id, data) {
    return depsReady.then(function () {
      var api = apiRef();
      if (!api) return { ok: false, message: 'Api 未就绪' };
      var m = MAPS[resource];
      var row = (m && m.toRow) ? m.toRow(data) : data;
      var cf = CODE_FIELD[resource];
      if (cf) delete row[cf]; // 更新不改写唯一编码
      return api.update(actual(resource), id, row);
    });
  }

  function remove(resource, id) {
    return depsReady.then(function () {
      var api = apiRef();
      if (!api) return { ok: false, message: 'Api 未就绪' };
      return api.remove(actual(resource), id);
    });
  }

  /* ---------- 便捷子模块：购物车 / 地址 / 收藏 ---------- */
  function cartList() { return list('cart'); }
  function cartAdd(item) { return create('cart', item); }
  function cartUpdate(item) {
    var id = item && item._id;
    if (!id) return create('cart', item);
    return update('cart', id, item);
  }
  function cartRemove(id) { return remove('cart', id); }

  function addressList() { return list('address'); }
  function addressSave(a) {
    if (a && a._id) return update('address', a._id, a);
    return create('address', a);
  }
  function addressRemove(id) { return remove('address', id); }

  function favoriteList() { return list('favorite'); }
  function favoriteAdd(f) { return create('favorite', f); }
  function favoriteRemove(id) { return remove('favorite', id); }

  /* 当前登录会员的后端档案（按 token id 匹配主键） */
  function currentMemberRow() {
    var cm = currentMember();
    if (!cm) return Promise.resolve(null);
    return list('member').then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (String(list[i]._id) === String(cm.id)) return list[i];
      }
      return null;
    }).catch(function () { return null; });
  }

  global.H5Data = {
    ready: depsReady,
    currentMember: currentMember,
    currentMemberRow: currentMemberRow,
    memberKey: memberKey,
    deviceKey: deviceKey,
    list: list,
    create: create,
    update: update,
    remove: remove,
    map: MAPS,
    orderStatusCn: ORDER_STATUS_CN,
    normalizeOrderStatusCode: normalizeOrderStatusCode,
    cart: { list: cartList, add: cartAdd, update: cartUpdate, remove: cartRemove },
    address: { list: addressList, save: addressSave, remove: addressRemove },
    favorite: { list: favoriteList, add: favoriteAdd, remove: favoriteRemove }
  };
})(window);
