/**
 * adoption-mapper.js — 认养模块「store 子集合 ↔ 表」映射层
 * --------------------------------------------------------------
 * 覆盖表：
 *   sf_adoption_tree    ↔ trees
 *   sf_adoption_order   ↔ orders
 *   sf_adoption_harvest ↔ harvests
 *   sf_adoption_farming ↔ farmings
 *   sf_adoption_cert    ↔ certs
 *   sf_adoption_photo   ↔ photos（扁平化）
 */
(function (global) {
  'use strict';

  function text(v) { return String(v == null ? '' : v).trim(); }
  function num(v, def) { var n = parseFloat(v); return isNaN(n) ? (def === undefined ? 0 : def) : n; }
  function nval(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
  function dstr(v) { return v ? String(v).replace('T', ' ').slice(0, 19) : ''; }
  function ddstr(v) { return v ? String(v).slice(0, 10) : ''; }
  function b2i(v) { return v ? 1 : 0; }
  function i2b(v) { return v === 1 || v === '1' || v === true; }

  /* ---------- 果树 ---------- */
  function rowToTree(row) {
    return {
      id: row.tree_code, treeCode: row.tree_code, treeName: row.tree_name,
      variety: row.variety_name || row.variety, varietyCode: row.variety,
      treeAge: num(row.tree_age), baseName: row.base_name || '', plotName: row.plot_name || '',
      plotId: '', plotCode: row.plot_code || '',
      price: num(row.year_fee), level: row.level || 'single',
      benefits: {}, status: row.status, adopter: row.adopter || '',
      adopterPhone: row.adopter_phone || '', customerId: row.customer_id || '', orderNo: row.order_code || '',
      startDate: ddstr(row.start_date), expireDate: ddstr(row.expire_time), duration: num(row.duration),
      growthStage: row.growth_stage || '', progress: num(row.progress), cameraId: row.camera_id ? String(row.camera_id) : '',
      openMonitor: i2b(row.open_scene), remark: row.remark || '', source: row.source || 'seed',
      createdAt: dstr(row.created_at), updatedAt: dstr(row.updated_at),
    };
  }
  function treeToRow(item) {
    return {
      tree_code: item.treeCode || item.id, tree_name: item.treeName, variety: item.varietyCode || item.variety,
      variety_name: item.variety, tree_age: nval(item.treeAge), year_fee: nval(item.price),
      adopter: item.adopter || null, adopter_phone: item.adopterPhone || null, customer_id: item.customerId || null,
      order_code: item.orderNo || null, plot_code: item.plotCode || null, plot_name: item.plotName || null,
      base_name: item.baseName || null, start_date: item.startDate || null, expire_time: item.expireDate || null,
      duration: nval(item.duration), growth_stage: item.growthStage || null, progress: nval(item.progress),
      level: item.level || null, source: item.source || null, remark: item.remark || null,
      open_scene: b2i(item.openMonitor), status: item.status,
    };
  }

  /* ---------- 订单 ---------- */
  function rowToOrder(row) {
    return {
      id: row.order_code, orderNo: row.order_code, treeCode: row.tree_code || '', treeName: '',
      variety: '', customerId: row.customer_id || '', adopter: row.adopter, phone: row.adopter_phone || '',
      amount: num(row.amount), duration: num(row.duration) || num(row.term), startDate: ddstr(row.start_date), endDate: ddstr(row.end_date),
      renew: i2b(row.renew_flag), renewCount: num(row.renew_count), prevOrderNo: row.prev_order_code || '',
      contractNo: row.contract_code || '', contractStatus: row.contract_status || 'pending',
      payMethod: row.pay_method || '', payTxnNo: row.pay_txn_no || '', invoiceNo: row.invoice_no || '', invoiceStatus: row.invoice_status || 'none',
      level: row.level || '', baseName: '', plotName: row.plot_name || '', plotId: '', plotCode: row.plot_code || '',
      status: row.order_status, refund: row.refund_amount != null ? {
        amount: num(row.refund_amount), reason: row.refund_reason || '', status: row.refund_status || '',
        operator: row.refund_operator || '', time: dstr(row.refund_time), remark: row.refund_remark || '',
      } : null,
      signedAt: dstr(row.signed_at), signer: row.signer || '', signMethod: row.sign_method || '', digest: row.digest || '',
      createdAt: dstr(row.order_time || row.created_at), updatedAt: dstr(row.updated_at),
    };
  }
  function orderToRow(item) {
    var rf = item.refund || {};
    return {
      order_code: item.orderNo || item.id, adopter: item.adopter, adopter_phone: item.phone || null,
      customer_id: item.customerId || null, tree_code: item.treeCode || null, amount: nval(item.amount),
      term: item.duration ? String(item.duration) + '年' : null, duration: nval(item.duration),
      renew_flag: b2i(item.renew), renew_count: nval(item.renewCount), prev_order_code: item.prevOrderNo || null,
      contract_code: item.contractNo || null, contract_status: item.contractStatus || 'pending',
      pay_method: item.payMethod || null, pay_txn_no: item.payTxnNo || null,
      invoice_no: item.invoiceNo || null, invoice_status: item.invoiceStatus || null,
      level: item.level || null, start_date: item.startDate || null, end_date: item.endDate || null,
      plot_code: item.plotCode || null, plot_name: item.plotName || null,
      order_status: item.status, refund_reason: rf.reason || null, refund_amount: nval(rf.amount),
      refund_status: rf.status || null, refund_operator: rf.operator || null, refund_time: rf.time || null, refund_remark: rf.remark || null,
      signer: item.signer || null, sign_method: item.signMethod || null, signed_at: item.signedAt || null, digest: item.digest || null,
      order_time: item.createdAt || null,
    };
  }

  /* ---------- 采收 ---------- */
  function rowToHarvest(row) {
    return {
      id: row.record_code, treeCode: '', treeName: '', adopter: row.adopter, phone: row.phone || '',
      orderNo: row.order_code || '', date: ddstr(row.harvest_date), method: row.method || '', qty: num(row.actual_amount),
      status: row.status, source: row.source || 'seed', remark: row.remark || '',
      reservationId: row.reservation_id || '', harvestBatchNo: row.harvest_batch_no || '', traceCode: row.trace_code || '',
      createdAt: dstr(row.created_at), updatedAt: dstr(row.updated_at),
    };
  }
  function harvestToRow(item) {
    return {
      record_code: item.id, adopter: item.adopter, phone: item.phone || null, order_code: item.orderNo || null,
      actual_amount: nval(item.qty), harvest_date: item.date || null, method: item.method || null,
      source: item.source || null, reservation_id: item.reservationId || null,
      harvest_batch_no: item.harvestBatchNo || null, trace_code: item.traceCode || null,
      status: item.status === 'completed' ? 'done' : item.status, remark: item.remark || null,
    };
  }

  /* ---------- 农事 ---------- */
  function rowToFarming(row) {
    var title = row.title || row.farm_type || '';
    return {
      id: row.record_code, treeCode: '', treeName: '', adopter: row.adopter, baseName: row.base_name || '',
      records: [{ title: title, type: row.farm_type || '', time: ddstr(row.execute_date) }],
      count: 1, status: row.status, bindTime: dstr(row.bind_time),
      source: row.source || 'seed', remark: row.remark || '', productionPlanId: row.production_plan_id || '',
      createdAt: dstr(row.created_at), updatedAt: dstr(row.updated_at),
    };
  }
  function farmingToRow(item) {
    var rec = (item.records && item.records[0]) || {};
    return {
      record_code: item.id, source: item.source || null, adopter: item.adopter,
      base_name: item.baseName || null, farm_type: rec.type || null, title: rec.title || null,
      execute_date: rec.time || null, batch_no: item.batchNo || item.id || null,
      bind_time: item.bindTime || null, status: item.status, remark: item.remark || null,
      production_plan_id: item.productionPlanId || null,
    };
  }

  /* ---------- 证书 ---------- */
  function rowToCert(row) {
    return {
      certNo: row.cert_code, treeNo: row.tree_id ? String(row.tree_id) : '', adopter: row.adopter,
      term: row.term, variety: row.variety, expectedYield: num(row.estimate_yield),
      templateId: row.template_id ? String(row.template_id) : '', issuedBy: row.issuer || '',
      status: row.status, revokeReason: row.revoke_reason || '',
      periodStart: ddstr(row.period_start), periodEnd: ddstr(row.period_end),
      baseName: row.base_name || '', plotName: row.plot_name || '',
      issueDate: ddstr(row.issue_date), issueTime: dstr(row.issue_time), orderNo: row.order_code || '', amount: num(row.amount),
      createTime: dstr(row.created_at), updatedAt: dstr(row.updated_at),
    };
  }
  function certToRow(item) {
    return {
      cert_code: item.certNo, adopter: item.adopter, term: item.term, variety: item.variety,
      estimate_yield: nval(item.expectedYield),
      template_code: item.templateId || null, template_id: /^\d+$/.test(String(item.templateId || '')) ? String(item.templateId) : null,
      issuer: item.issuedBy || null, status: item.status, revoke_reason: item.revokeReason || null,
      period_start: item.periodStart || null, period_end: item.periodEnd || null,
      base_name: item.baseName || null, plot_name: item.plotName || null,
      issue_date: item.issueDate || null, issue_time: item.issueTime || null,
      order_code: item.orderNo || null, amount: nval(item.amount),
    };
  }

  /* ---------- 照片（扁平） ---------- */
  function rowToPhoto(row) {
    return { treeCode: row.tree_id ? String(row.tree_id) : '', url: row.file_id ? String(row.file_id) : '', stage: row.stage, time: dstr(row.shoot_time) };
  }
  function photoToRow(item) {
    return { tree_id: item.treeCode || null, file_id: item.url || null, stage: item.stage, shoot_time: item.time || null };
  }

  /* ---------- 聚合转换 ---------- */
  function toAggregate(data) {
    return {
      trees: (data.trees || []).map(rowToTree),
      orders: (data.orders || []).map(rowToOrder),
      harvests: (data.harvests || []).map(rowToHarvest),
      farmings: (data.farmings || []).map(rowToFarming),
      certs: (data.certs || []).map(rowToCert),
    };
  }

  function fromAggregate(agg) {
    return {
      trees: (agg.trees || []).map(treeToRow),
      orders: (agg.orders || []).map(orderToRow),
      harvests: (agg.harvests || []).map(harvestToRow),
      farmings: (agg.farmings || []).map(farmingToRow),
      certs: (agg.certs || []).map(certToRow),
      deleted: agg.deleted || {},
    };
  }

  global.AdoptionMapper = { toAggregate: toAggregate, fromAggregate: fromAggregate };
})(window);
