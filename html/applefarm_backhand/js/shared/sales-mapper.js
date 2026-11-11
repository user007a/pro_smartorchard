/**
 * sales-mapper.js — 销售模块「store 聚合对象 ↔ 9 张表」映射层
 * --------------------------------------------------------------
 * 覆盖表：
 *   sf_sales_customer      ↔ customers
 *   sf_sales_order         ↔ orders
 *   sf_sales_receipt       ↔ payments
 *   sf_sales_shipment      ↔ shipments
 *   sf_sales_aftersale     ↔ afterSales
 *   sf_sales_price_policy  ↔ pricePolicies
 *   sf_sales_promotion     ↔ promotions
 *   sf_sales_target        ↔ targets
 *   sf_sales_statement     ↔ statements
 * 金额单位：全部「元」。
 */
(function (global) {
  'use strict';

  function text(v) { return String(v == null ? '' : v).trim(); }
  function num(v, def) { var n = parseFloat(v); return isNaN(n) ? (def === undefined ? 0 : def) : n; }
  function nval(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
  function dstr(v) { return v ? String(v).replace('T', ' ').slice(0, 19) : ''; }
  function ddstr(v) { return v ? String(v).slice(0, 10) : ''; }
  function jparse(v, def) { try { return v ? JSON.parse(v) : def; } catch (e) { return def; } }

  /* ---------- 客户 ---------- */
  function rowToCustomer(row) {
    return {
      id: row.customer_code, code: row.customer_code, name: row.customer_name,
      contact: row.contact, phone: row.phone, wechat: row.wechat || '', email: row.email || '',
      type: row.customer_type, level: row.grade, region: row.region, address: row.address || '',
      status: row.status, source: row.source, owner: row.salesman || '',
      creditLimit: num(row.credit_limit), creditDays: num(row.account_period) || num(row.account_age),
      invoiceTitle: row.customer_name, taxNo: '', bankInfo: '',
      tags: jparse(row.tags, []), remark: row.remark || '',
      createdAt: dstr(row.created_at), updatedAt: dstr(row.updated_at),
    };
  }
  function customerToRow(item) {
    return {
      customer_code: item.code || item.id, customer_name: item.name, contact: item.contact,
      phone: item.phone, wechat: item.wechat, email: item.email,
      customer_type: item.type, grade: item.level, region: item.region, address: item.address,
      source: item.source, channel: item.type, salesman: item.owner,
      credit_limit: nval(item.creditLimit), account_period: item.creditDays ? String(item.creditDays) : null,
      invoice_info: item.invoiceTitle || item.name, tags: item.tags ? JSON.stringify(item.tags) : null,
      remark: item.remark, status: item.status,
    };
  }

  /* ---------- 订单 ---------- */
  function rowToOrder(row) {
    return {
      id: row.order_code, no: row.order_code, code: row.order_code,
      type: row.order_type, channel: row.channel, source: row.source,
      customerId: '', customerName: row.customer_name, contact: row.contact,
      phone: row.phone, address: row.address,
      items: jparse(row.product_info, []),
      goodsAmount: num(row.amount), discount: num(row.discount), freight: num(row.freight),
      payableAmount: num(row.amount), paidAmount: num(row.received), deposit: num(row.deposit),
      payMethod: row.pay_method || '', payStatus: row.pay_status,
      status: row.status, batchNo: row.batch_no || '', traceCode: row.trace_code || '',
      receiver: row.receiver || '', receiverPhone: row.receiver_phone || '', receiverAddress: row.receiver_address || '',
      expectedDate: ddstr(row.expected_date), owner: row.operator || '',
      remark: row.remark || '', invoiceStatus: row.invoice_status || 'none',
      shipCompany: row.ship_company || '', shipNo: row.ship_no || '',
      shippedAt: dstr(row.shipped_at), receivedAt: dstr(row.received_at),
      cancelledAt: dstr(row.cancelled_at), cancelReason: row.cancel_reason || '',
      createdAt: dstr(row.order_time || row.created_at), updatedAt: dstr(row.updated_at),
    };
  }
  function orderToRow(item) {
    var items = item.items || [];
    var qty = 0, price = 0;
    items.forEach(function (it) { qty += num(it.qty); price += num(it.price); });
    return {
      order_code: item.code || item.id, order_type: item.type, source: item.source,
      customer_name: item.customerName, contact: item.contact, phone: item.phone, address: item.address,
      product_info: JSON.stringify(items), quantity: qty, price: price,
      amount: nval(item.payableAmount != null ? item.payableAmount : item.goodsAmount),
      received: nval(item.paidAmount), receivable: nval((item.payableAmount || item.goodsAmount || 0) - (item.paidAmount || 0)),
      channel: item.channel, pay_status: item.payStatus, status: item.status,
      discount: nval(item.discount), freight: nval(item.freight), deposit: nval(item.deposit),
      pay_method: item.payMethod, batch_no: item.batchNo, trace_code: item.traceCode,
      receiver: item.receiver, receiver_phone: item.receiverPhone, receiver_address: item.receiverAddress,
      expected_date: item.expectedDate || null, invoice_status: item.invoiceStatus,
      ship_company: item.shipCompany, ship_no: item.shipNo,
      shipped_at: item.shippedAt || null, received_at: item.receivedAt || null,
      cancelled_at: item.cancelledAt || null, cancel_reason: item.cancelReason,
      refunded_amount: nval(item.refundedAmount), operator: item.owner, remark: item.remark,
      order_time: item.createdAt || null,
    };
  }

  /* ---------- 收款 ---------- */
  function rowToPayment(row) {
    return {
      id: row.receipt_code, orderId: row.order_code || '', orderNo: row.order_code || '',
      customerId: '', customerName: row.customer_name, amount: num(row.amount),
      method: row.pay_way, paidAt: dstr(row.receipt_time), operator: row.operator || '',
      voucherNo: row.voucher_no || '', remark: row.remark || '', type: row.receipt_type || 'income',
    };
  }
  function paymentToRow(item) {
    return {
      receipt_code: item.id, order_code: item.orderNo || item.orderId || null, customer_name: item.customerName,
      amount: nval(item.amount), pay_way: item.method, receipt_time: item.paidAt || null,
      operator: item.operator, voucher_no: item.voucherNo, receipt_type: item.type || 'income', remark: item.remark,
    };
  }

  /* ---------- 发货 ---------- */
  function rowToShipment(row) {
    return {
      id: row.shipment_code, orderId: row.order_code || '', orderNo: row.order_code || '',
      customerId: '', customerName: row.customer_name || '', company: row.express_company,
      trackingNo: row.tracking_no, shippedAt: dstr(row.ship_time), status: row.status,
      signedAt: dstr(row.sign_time), receiver: row.receiver || '', receiverPhone: row.receiver_phone || '',
      address: row.address || '', remark: row.remark || '', source: row.source || 'manual',
    };
  }
  function shipmentToRow(item) {
    return {
      shipment_code: item.id, order_code: item.orderNo || item.orderId || null, customer_name: item.customerName,
      product_info: null, quantity: null, amount: null,
      receiver: item.receiver, receiver_phone: item.receiverPhone, address: item.address,
      express_company: item.company, tracking_no: item.trackingNo,
      ship_time: item.shippedAt || null, sign_time: item.signedAt || null,
      status: item.status, remark: item.remark, source: item.source,
    };
  }

  /* ---------- 售后 ---------- */
  function rowToAfterSale(row) {
    return {
      id: row.aftersale_code, no: row.aftersale_code, orderId: row.order_code || '', orderNo: row.order_code || '',
      customerId: '', customerName: row.customer_name, type: row.aftersale_type, reason: row.reason,
      amount: num(row.apply_amount), qty: num(row.quantity), status: row.status,
      applyAt: dstr(row.apply_time), handler: row.handler || '', handledAt: dstr(row.handled_at),
      remark: row.remark || '', restock: row.restock === 1,
    };
  }
  function afterSaleToRow(item) {
    return {
      aftersale_code: item.id || item.no, order_code: item.orderNo || item.orderId || null, customer_name: item.customerName,
      aftersale_type: item.type, reason: item.reason, quantity: nval(item.qty),
      apply_amount: nval(item.amount), apply_time: item.applyAt || null, handler: item.handler,
      status: item.status, handled_at: item.handledAt || null, remark: item.remark,
      restock: item.restock ? 1 : 0,
    };
  }

  /* ---------- 价格策略 ---------- */
  function rowToPricePolicy(row) {
    return {
      id: row.policy_code, name: row.policy_name, customerId: '', customerType: row.applicable_object || '',
      product: row.product, unit: row.unit || '', price: num(row.agreement_price), minQty: num(row.min_order),
      startDate: ddstr(row.start_date), endDate: ddstr(row.end_date), status: row.status, remark: row.remark || '',
    };
  }
  function pricePolicyToRow(item) {
    return {
      policy_code: item.id, policy_name: item.name, product: item.product, unit: item.unit,
      agreement_price: nval(item.price), min_order: nval(item.minQty),
      applicable_object: item.customerType || item.customerId || '', scope: item.customerId || '',
      start_date: item.startDate || null, end_date: item.endDate || null, status: item.status, remark: item.remark,
    };
  }

  /* ---------- 促销 ---------- */
  function rowToPromotion(row) {
    return {
      id: row.promotion_code, name: row.promotion_name, type: row.promotion_type || row.discount_type,
      scope: row.product || '', rule: row.discount_rule || '',
      startDate: ddstr(row.start_date), endDate: ddstr(row.end_date), status: row.status, remark: row.remark || '',
    };
  }
  function promotionToRow(item) {
    return {
      promotion_code: item.id, promotion_name: item.name, promotion_type: item.type,
      discount_type: item.type, discount_rule: item.rule, product: item.scope,
      start_date: item.startDate || null, end_date: item.endDate || null, status: item.status, remark: item.remark,
    };
  }

  /* ---------- 目标 ---------- */
  function rowToTarget(row) {
    return {
      id: row.target_code || ('TG-' + row.period + '-' + row.manager), period: row.period,
      owner: row.manager || '', targetAmount: num(row.target_amount), targetOrders: num(row.target_orders),
      remark: row.remark || '',
    };
  }
  function targetToRow(item) {
    return {
      target_code: item.id, period: item.period, manager: item.owner,
      target_orders: nval(item.targetOrders), target_amount: nval(item.targetAmount), remark: item.remark,
    };
  }

  /* ---------- 对账单 ---------- */
  function rowToStatement(row) {
    return {
      id: row.statement_code, no: row.statement_code, customerId: row.customer_code || '', customerName: row.customer_name,
      period: row.period, orderIds: jparse(row.order_ids, []), orderCount: num(row.order_count),
      amount: num(row.amount), paid: num(row.received), balance: num(row.receivable_balance),
      status: row.status, createdAt: dstr(row.generate_time), confirmedAt: dstr(row.confirmed_at),
      settledAt: dstr(row.settled_at), remark: row.remark || '',
    };
  }
  function statementToRow(item) {
    return {
      statement_code: item.id || item.no, customer_code: item.customerId || null, customer_name: item.customerName,
      period: item.period, order_ids: item.orderIds ? JSON.stringify(item.orderIds) : null,
      order_count: nval(item.orderCount), amount: nval(item.amount), received: nval(item.paid),
      receivable_balance: nval(item.balance), status: item.status,
      generate_time: item.createdAt || null, confirmed_at: item.confirmedAt || null,
      settled_at: item.settledAt || null, remark: item.remark,
    };
  }

  /* ---------- 聚合转换 ---------- */
  function toAggregate(data) {
    return {
      customers: (data.customers || []).map(rowToCustomer),
      orders: (data.orders || []).map(rowToOrder),
      payments: (data.payments || []).map(rowToPayment),
      shipments: (data.shipments || []).map(rowToShipment),
      afterSales: (data.afterSales || []).map(rowToAfterSale),
      pricePolicies: (data.pricePolicies || []).map(rowToPricePolicy),
      promotions: (data.promotions || []).map(rowToPromotion),
      targets: (data.targets || []).map(rowToTarget),
      statements: (data.statements || []).map(rowToStatement),
    };
  }

  function fromAggregate(agg) {
    return {
      customers: (agg.customers || []).map(customerToRow),
      orders: (agg.orders || []).map(orderToRow),
      payments: (agg.payments || []).map(paymentToRow),
      shipments: (agg.shipments || []).map(shipmentToRow),
      afterSales: (agg.afterSales || []).map(afterSaleToRow),
      pricePolicies: (agg.pricePolicies || []).map(pricePolicyToRow),
      promotions: (agg.promotions || []).map(promotionToRow),
      targets: (agg.targets || []).map(targetToRow),
      statements: (agg.statements || []).map(statementToRow),
      deleted: agg.deleted || {},
    };
  }

  global.SalesMapper = { toAggregate: toAggregate, fromAggregate: fromAggregate };
})(window);
