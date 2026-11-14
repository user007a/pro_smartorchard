/**
 * mall-mapper.js — 商城模块「store 子集合 ↔ 表」映射层
 * --------------------------------------------------------------
 * 入库：products/promotions/coupons/claims/members/orders/afterSales/
 *      invoices/posts + settings(categories/varieties/freight/levelRules/banners/notices)
 * 派生不入库：comments/likes/points/salesOrders
 */
(function (global) {
  'use strict';

  function text(v) { return String(v == null ? '' : v).trim(); }
  function num(v, def) { var n = parseFloat(v); return isNaN(n) ? (def === undefined ? 0 : def) : n; }
  function nval(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
  function dstr(v) { return v ? String(v).replace('T', ' ').slice(0, 19) : ''; }
  function ddstr(v) { return v ? String(v).slice(0, 10) : ''; }
  function jparse(v, def) { try { return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function b2i(v) { return v ? 1 : 0; }
  function i2b(v) { return v === 1 || v === '1' || v === true; }

  /* ---------- 商品 ---------- */
  function rowToProduct(row) {
    return {
      id: row.product_code, name: row.product_name, desc: row.desc || '',
      price: num(row.price), original: num(row.original), costPrice: num(row.cost_price), memberPrice: num(row.member_price),
      img: '', cat: '', variety: row.variety || '', spec: row.spec || '', unit: row.unit || '',
      tag: row.tag || '', stock: num(row.stock), safetyStock: num(row.safety_stock), soldCount: num(row.sold_count),
      sort: num(row.sort), serviceTags: jparse(row.service_tags, []), detailHtml: row.detail_html || '',
      status: row.status === 'off' ? 'off' : 'on', createdAt: dstr(row.created_at), updatedAt: dstr(row.updated_at),
    };
  }
  function productToRow(item) {
    return {
      product_code: item.id, product_name: item.name, 'desc': item.desc,
      price: nval(item.price), original: nval(item.original), cost_price: nval(item.costPrice), member_price: nval(item.memberPrice),
      variety: item.variety, spec: item.spec, unit: item.unit, tag: item.tag,
      stock: nval(item.stock), safety_stock: nval(item.safetyStock), sold_count: nval(item.soldCount),
      sort: nval(item.sort), service_tags: item.serviceTags ? JSON.stringify(item.serviceTags) : null,
      detail_html: item.detailHtml || null, status: item.status === 'off' ? 'off' : 'on',
    };
  }

  /* ---------- 订单 ---------- */
  function rowToOrder(row) {
    var addr = {};
    try { addr = row.address ? JSON.parse(row.address) : {}; } catch (e) { addr = {}; }
    return {
      id: row.order_code, no: row.order_code, memberId: '', userId: '',
      items: jparse(row.product_info, []),
      subtotal: num(row.subtotal, num(row.amount)), discount: num(row.discount),
      couponCode: row.coupon_code || '', couponDiscount: num(row.coupon_discount),
      pointsUsed: num(row.points_used), pointsDiscount: num(row.points_discount),
      freight: num(row.freight), total: num(row.amount), payment: row.pay_way || '',
      payTxnNo: row.pay_txn_no || '', payTime: dstr(row.pay_time),
      invoice: '', invoiceId: row.invoice_id || '', address: addr, remark: row.remark || '',
      statusCode: row.status, status: row.status, afterSalesId: row.after_sales_id || '',
      createdAt: dstr(row.order_time || row.created_at), logistics: jparse(row.logistics, []),
    };
  }
  function orderToRow(item) {
    var items = item.items || [];
    return {
      order_code: item.id || item.no, member_name: null,
      product_info: JSON.stringify(items), amount: nval(item.total),
      subtotal: nval(item.subtotal), discount: nval(item.discount),
      coupon_code: item.couponCode || null, coupon_discount: nval(item.couponDiscount),
      points_used: nval(item.pointsUsed), points_discount: nval(item.pointsDiscount),
      freight: nval(item.freight), pay_way: item.payment,
      pay_txn_no: item.payTxnNo || null, pay_time: item.payTime || null,
      invoice_id: item.invoiceId || null, address: item.address ? JSON.stringify(item.address) : null,
      status: item.statusCode || item.status, remark: item.remark, after_sales_id: item.afterSalesId || null,
      logistics: item.logistics ? JSON.stringify(item.logistics) : null,
      order_time: item.createdAt || null,
    };
  }

  /* ---------- 会员 ---------- */
  function rowToMember(row) {
    return {
      id: row.member_code, userId: row.user_id || '', nickname: row.nickname, phone: row.phone,
      avatar: row.avatar || '', gender: row.gender || '', region: row.region || '',
      level: row.level, growth: num(row.growth), points: num(row.points),
      regDate: dstr(row.register_time), lastOrderAt: dstr(row.last_order_time),
      tags: jparse(row.tags, []), source: row.source || '', status: row.status,
      address: row.address || '',
    };
  }
  function memberToRow(item) {
    return {
      member_code: item.id, user_id: item.userId || null, nickname: item.nickname, phone: item.phone,
      avatar: item.avatar || null, gender: item.gender || null, region: item.region || null,
      level: item.level, points: nval(item.points), growth: nval(item.growth),
      tags: item.tags ? JSON.stringify(item.tags) : null, source: item.source || null,
      address: item.address || null, status: item.status,
      register_time: item.regDate || null, last_order_time: item.lastOrderAt || null,
    };
  }

  /* ---------- 优惠券 ---------- */
  function rowToCoupon(row) {
    return {
      code: row.coupon_code || row.coupon_name, name: row.coupon_name, desc: row.desc || '',
      type: row.coupon_type, value: num(row.discount), min: num(row.threshold),
      validFrom: ddstr(row.valid_start), validTo: ddstr(row.valid_end),
      totalQty: num(row.total_count), issuedQty: num(row.issued_count), usedQty: num(row.used_count),
      perUserLimit: num(row.per_limit), scope: row.scope || '', skuIds: jparse(row.sku_ids, []),
      stackable: i2b(row.stackable), receiveType: row.receive_type || '',
      status: row.status === 'off' ? 'off' : 'on',
    };
  }
  function couponToRow(item) {
    return {
      coupon_code: item.code, coupon_name: item.name, 'desc': item.desc,
      coupon_type: item.type, discount: nval(item.value), threshold: nval(item.min),
      total_count: nval(item.totalQty), issued_count: nval(item.issuedQty), used_count: nval(item.usedQty),
      per_limit: nval(item.perUserLimit), scope: item.scope || null,
      sku_ids: item.skuIds ? JSON.stringify(item.skuIds) : null, stackable: b2i(item.stackable),
      receive_type: item.receiveType || null, valid_start: item.validFrom || null, valid_end: item.validTo || null,
      status: item.status === 'off' ? 'off' : 'on',
    };
  }

  /* ---------- 领券 ---------- */
  function rowToClaim(row) {
    return {
      id: row.claim_code, code: row.coupon_code, memberKey: row.member_key,
      status: row.status, claimedAt: dstr(row.claimed_at), usedAt: dstr(row.used_at), orderNo: row.order_no || '',
    };
  }
  function claimToRow(item) {
    return {
      claim_code: item.id, coupon_code: item.code, member_key: item.memberKey,
      status: item.status, claimed_at: item.claimedAt || null, used_at: item.usedAt || null, order_no: item.orderNo || null,
    };
  }

  /* ---------- 售后 ---------- */
  function rowToAfterSale(row) {
    return {
      id: row.aftersale_code, orderNo: row.order_code || '', memberId: '',
      type: row.aftersale_type, reason: row.reason, amount: num(row.refund_amount),
      status: row.status, applyAt: dstr(row.apply_at || row.created_at),
      handleAt: dstr(row.handle_at), handler: row.handler || '', remark: row.remark || '',
    };
  }
  function afterSaleToRow(item) {
    return {
      aftersale_code: item.id, order_code: item.orderNo || null, aftersale_type: item.type,
      refund_amount: nval(item.amount), reason: item.reason, status: item.status,
      handler: item.handler || null, handle_at: item.handleAt || null, apply_at: item.applyAt || null,
      remark: item.remark || null,
    };
  }

  /* ---------- 发票 ---------- */
  function rowToInvoice(row) {
    return {
      id: row.invoice_code, titleType: row.title_type || '', title: row.title, taxNo: row.tax_no || '',
      email: row.email || '', phone: row.phone || '', companyAddress: row.company_address || '',
      companyPhone: row.company_phone || '', bankName: row.bank_name || '', bankAccount: row.bank_account || '',
      amount: num(row.amount), type: row.invoice_type, contentType: row.content_type || '',
      orderNo: '', applyTime: dstr(row.apply_time), status: row.status,
      invoiceNo: row.invoice_no || '', issueTime: dstr(row.issue_time), rejectReason: row.reject_reason || '',
      voidReason: row.void_reason || '', reissueOf: row.reissue_of || '', operator: row.operator || '',
    };
  }
  function invoiceToRow(item) {
    return {
      invoice_code: item.id, title_type: item.titleType, title: item.title, tax_no: item.taxNo,
      email: item.email || null, phone: item.phone || null, company_address: item.companyAddress || null,
      company_phone: item.companyPhone || null, bank_name: item.bankName || null, bank_account: item.bankAccount || null,
      invoice_type: item.type, content_type: item.contentType || null, amount: nval(item.amount),
      apply_time: item.applyTime || null, status: item.status, invoice_no: item.invoiceNo || null,
      issue_time: item.issueTime || null, reject_reason: item.rejectReason || null,
      void_reason: item.voidReason || null, reissue_of: item.reissueOf || null, operator: item.operator || null,
    };
  }

  /* ---------- 帖子 ---------- */
  function rowToPost(row) {
    return {
      id: String(row.id), author: row.author, memberId: row.member_id || '', content: row.content,
      images: jparse(row.images, []), topic: row.topic || '', productId: row.product_id || '',
      status: row.status, time: dstr(row.publish_time), auditBy: row.audit_by || '',
      auditAt: dstr(row.audit_at), rejectReason: row.reject_reason || '',
    };
  }
  function postToRow(item) {
    return {
      _dbId: item.id,
      author: item.author, member_id: item.memberId || null, content: item.content,
      images: item.images ? JSON.stringify(item.images) : null, topic: item.topic || null,
      product_id: item.productId || null, status: item.status, publish_time: item.time || null,
      audit_by: item.auditBy || null, audit_at: item.auditAt || null, reject_reason: item.rejectReason || null,
    };
  }

  /* ---------- 促销 ---------- */
  function rowToPromotion(row) {
    return {
      id: row.promotion_name, title: row.promotion_name, subTitle: row.subtitle || '',
      type: row.promotion_type, price: num(row.price_range), original: num(row.original),
      img: row.img || '', tag: row.tag || '', scope: row.scope || '',
      skuIds: (row.product_ids || '').split(',').filter(Boolean), channel: row.channel || '',
      limitPerUser: num(row.limit_per_user), totalStock: num(row.total_stock), usedStock: num(row.used_stock),
      priority: num(row.priority), memberOnly: i2b(row.member_only),
      startDate: ddstr(row.start_date), endDate: ddstr(row.end_date), target: row.target || '',
      status: row.status,
    };
  }
  function promotionToRow(item) {
    return {
      promotion_name: item.title || item.id, subtitle: item.subTitle || null,
      promotion_type: item.type, product_ids: item.skuIds ? item.skuIds.join(',') : null,
      price_range: nval(item.price) != null ? String(item.price) : null, original: nval(item.original),
      img: item.img || null, tag: item.tag || null, scope: item.scope || null, channel: item.channel || null,
      limit_per_user: nval(item.limitPerUser), total_stock: nval(item.totalStock), used_stock: nval(item.usedStock),
      priority: nval(item.priority), member_only: b2i(item.memberOnly), target: item.target || null,
      start_date: item.startDate || null, end_date: item.endDate || null, status: item.status,
    };
  }

  /* ---------- settings 子项 ---------- */
  function rowToCategory(row) {
    return { code: row.category_code, name: row.category_name, sort: num(row.sort_order), status: row.status };
  }
  function categoryToRow(item) {
    return { category_code: item.code, category_name: item.name, sort_order: nval(item.sort), status: item.status };
  }
  function rowToVariety(row) {
    return { code: row.variety_code, name: row.variety_name, sort: num(row.sort), status: row.status };
  }
  function varietyToRow(item) {
    return { variety_code: item.code, variety_name: item.name, sort: nval(item.sort), status: item.status };
  }
  function rowToFreight(row) {
    return { name: row.template_name, region: row.cover_region, firstQty: num(row.first_count), firstFee: num(row.first_price), extraQty: num(row.continue_count), extraFee: num(row.continue_price) };
  }
  function freightToRow(item) {
    return { template_name: item.name, cover_region: item.region, first_count: nval(item.firstQty), first_price: nval(item.firstFee), continue_count: nval(item.extraQty), continue_price: nval(item.extraFee), status: 'active' };
  }
  function rowToLevelRule(row) {
    return { level: row.level, name: row.level_name, min: num(row.threshold) };
  }
  function levelRuleToRow(item) {
    return { level: item.level, level_name: item.name, threshold: nval(item.min) };
  }
  function rowToBanner(row) {
    return { title: row.name, subtitle: row.subtitle || '', img: '', link: row.jump_link || '', status: row.status };
  }
  function bannerToRow(item) {
    return { name: item.title, subtitle: item.subtitle || null, jump_link: item.link || null, status: item.status };
  }
  function rowToNotice(row) {
    return { scene: row.trigger_scene, title: row.title, content: row.content, status: row.status };
  }
  function noticeToRow(item) {
    return { trigger_scene: item.scene, title: item.title, content: item.content, status: item.status };
  }

  /* ---------- 聚合转换 ---------- */
  function toAggregate(data) {
    var st = data.settings || {};
    return {
      products: (data.products || []).map(rowToProduct),
      promotions: (data.promotions || []).map(rowToPromotion),
      coupons: (data.coupons || []).map(rowToCoupon),
      claims: (data.claims || []).map(rowToClaim),
      members: (data.members || []).map(rowToMember),
      orders: (data.orders || []).map(rowToOrder),
      afterSales: (data.afterSales || []).map(rowToAfterSale),
      invoices: (data.invoices || []).map(rowToInvoice),
      posts: (data.posts || []).map(rowToPost),
      categories: (data.categories || []).map(rowToCategory),
      varieties: (data.varieties || []).map(rowToVariety),
      freight: (data.freight || []).map(rowToFreight),
      levelRules: (data.levelRules || []).map(rowToLevelRule),
      banners: (data.banners || []).map(rowToBanner),
      notices: (data.notices || []).map(rowToNotice),
    };
  }

  function fromAggregate(agg) {
    return {
      products: (agg.products || []).map(productToRow),
      promotions: (agg.promotions || []).map(promotionToRow),
      coupons: (agg.coupons || []).map(couponToRow),
      claims: (agg.claims || []).map(claimToRow),
      members: (agg.members || []).map(memberToRow),
      orders: (agg.orders || []).map(orderToRow),
      afterSales: (agg.afterSales || []).map(afterSaleToRow),
      invoices: (agg.invoices || []).map(invoiceToRow),
      posts: (agg.posts || []).map(postToRow),
      categories: (agg.categories || []).map(categoryToRow),
      varieties: (agg.varieties || []).map(varietyToRow),
      freight: (agg.freight || []).map(freightToRow),
      levelRules: (agg.levelRules || []).map(levelRuleToRow),
      banners: (agg.banners || []).map(bannerToRow),
      notices: (agg.notices || []).map(noticeToRow),
      deleted: agg.deleted || {},
    };
  }

  global.MallMapper = { toAggregate: toAggregate, fromAggregate: fromAggregate };
})(window);
