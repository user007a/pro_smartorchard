/**
 * trace-mapper.js — 溯源模块「store 聚合对象 ↔ 8 张表」映射层
 * --------------------------------------------------------------
 * 策略 A（出入口映射）：TraceStore 内部逻辑零改动，只在 load/save 出入口做双向转换。
 *
 * 覆盖表（8 张）：
 *   sf_trace_batch         ↔ batches
 *   sf_trace_code          ↔ codes
 *   sf_trace_blockchain    ↔ events
 *   sf_trace_query_log     ↔ scans
 *   sf_trace_template      ↔ labelTemplates
 *   sf_trace_inspection    ↔ inspections
 *   sf_trace_label_stock   ↔ labelStock（labelReservations 派生不入库）
 *   sf_trace_print_job     ↔ printJobs
 *   sf_trace_recall        ↔ recalls
 *
 * 不入库（派生/无权威表）：channelAlerts、regulatoryReports、apiKeys、
 *   codeSegments、auditLogs、config、labelReservations、stage 字典。
 */
(function (global) {
  'use strict';

  /* ---------- 通用工具 ---------- */
  function text(v) { return String(v == null ? '' : v).trim(); }
  function num(v, def) { var n = parseFloat(v); return isNaN(n) ? (def === undefined ? 0 : def) : n; }
  function nval(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
  function jparse(v, def) { try { return v ? JSON.parse(v) : def; } catch (e) { return def; } }

  /* ---------- 批次状态归一（store 用 pending/packed/stored/shipped，表同） ---------- */
  var BATCH_STATUS = { pending: 'pending', packed: 'packed', stored: 'stored', shipped: 'shipped' };

  /* ---------- 追溯码状态归一 ---------- */
  var CODE_STATUS = { inactive: 'inactive', active: 'active', expired: 'expired' };

  /* ---------- 检测报告状态归一 ---------- */
  var INSPECTION_STATUS = { valid: 'valid', expired: 'expired', revoked: 'revoked', invalid: 'invalid' };

  /* ============================================================
   * 1. 批次 sf_trace_batch ↔ batches
   * ============================================================ */
  function rowToBatch(row) {
    return {
      id: 'BAT-' + row.batch_no,
      batchNo: row.batch_no,
      sourceRecordId: row.source_record_code || '',
      planNo: '',
      processNo: row.process_code || '',
      plotCode: row.plot_code || '',
      plotName: row.plot_name || '',
      base: row.base_name || '',
      variety: row.variety || '',
      product: row.product_name || '',
      spec: row.spec || '',
      grade: row.grade || '',
      harvestDate: row.harvest_date ? String(row.harvest_date).slice(0, 10) : '',
      quantity: num(row.harvest_amount),
      status: row.status || 'pending',
      codeCount: num(row.code_count),
      traceCodes: [],
      remark: row.remark || '',
      shipment: null,
      createdAt: row.created_at ? String(row.created_at).slice(0, 19) : '',
      updatedAt: row.updated_at ? String(row.updated_at).slice(0, 19) : '',
    };
  }
  function batchToRow(item) {
    return {
      batch_no: item.batchNo,
      product_name: item.product || null,
      spec: item.spec || null,
      base_id: null,
      plot_id: null,
      plot_code: item.plotCode || null,
      plot_name: item.plotName || null,
      base_name: item.base || null,
      variety: item.variety || null,
      harvest_plan_id: null,
      harvest_date: item.harvestDate || null,
      grade: item.grade || null,
      harvest_amount: nval(item.quantity),
      process_code: item.processNo || null,
      trace_code: (item.traceCodes && item.traceCodes[0]) || null,
      code_count: num(item.codeCount),
      source_record_code: item.sourceRecordId || null,
      status: BATCH_STATUS[item.status] || 'pending',
      remark: item.remark || null,
    };
  }

  /* ============================================================
   * 2. 追溯码 sf_trace_code ↔ codes
   * ============================================================ */
  function rowToCode(row) {
    return {
      code: row.trace_code,
      shortCode: row.short_code || '',
      batch: row.batch_no || '',
      time: row.generate_time ? String(row.generate_time).slice(0, 19) : '',
      status: CODE_STATUS[row.status] || 'inactive',
      order: row.order_no || '',
      template: row.template_name || '',
      queries: num(row.queries),
      firstScanAt: row.first_scan_at ? String(row.first_scan_at).slice(0, 19) : '',
      lastQuery: row.last_query ? String(row.last_query).slice(0, 19) : '',
      createdAt: row.created_at ? String(row.created_at).slice(0, 19) : '',
      batchNo: row.batch_no || '',
      product: row.product_name || '',
      plotCode: row.plot_code || '',
    };
  }
  function codeToRow(item) {
    return {
      trace_code: item.code,
      short_code: item.shortCode || null,
      batch_no: item.batch || item.batchNo || null,
      product_name: item.product || null,
      spec: null,
      plot_code: item.plotCode || null,
      origin: null,
      encode_type: null,
      generate_count: null,
      queries: num(item.queries),
      first_scan_at: item.firstScanAt || null,
      last_query: item.lastQuery || null,
      order_id: null,
      order_no: item.order || null,
      template_id: null,
      template_name: item.template || null,
      status: CODE_STATUS[item.status] || 'inactive',
      generate_time: item.time || null,
      remark: null,
    };
  }

  /* ============================================================
   * 3. 事件链 sf_trace_blockchain ↔ events
   * ============================================================ */
  function rowToEvent(row) {
    var payload = {};
    try { payload = row.payload ? JSON.parse(row.payload) : {}; } catch (e) { payload = {}; }
    return {
      id: row.event && /^EV-\d+$/.test(row.event) ? row.event : '',
      batchNo: row.batch_no || '',
      code: row.trace_code || '',
      type: row.event_type || 'event',
      title: row.title || '',
      summary: row.summary || '',
      payload: payload,
      hash: row.tx_hash || '',
      prevHash: row.prev_hash || '',
      blockHeight: num(row.block_height),
      txId: row.tx_hash || '',
      chainTime: row.chain_time ? String(row.chain_time).slice(0, 19) : '',
      status: row.verify_status || 'confirmed',
      contract: row.contract || '',
      node: row.node || '',
      tsa: row.tsa || '',
    };
  }
  function eventToRow(item) {
    return {
      trace_code: item.code || null,
      batch_no: item.batchNo || null,
      event: item.id || null,
      event_type: item.type || 'event',
      title: item.title || null,
      summary: item.summary || null,
      payload: item.payload ? JSON.stringify(item.payload) : null,
      tx_hash: item.hash || item.txId || null,
      prev_hash: item.prevHash || null,
      block_height: item.blockHeight != null ? String(item.blockHeight) : null,
      node: item.node || null,
      contract: item.contract || null,
      tsa: item.tsa || null,
      chain_time: item.chainTime || null,
      verify_status: item.status || 'confirmed',
    };
  }

  /* ============================================================
   * 4. 扫码日志 sf_trace_query_log ↔ scans
   * ============================================================ */
  function rowToScan(row) {
    return {
      id: '',
      code: row.trace_code || '',
      at: row.query_time ? String(row.query_time).slice(0, 19) : '',
      source: row.source || row.channel || 'H5',
      region: row.region || '',
      device: row.device || '',
      result: row.result || 'normal',
      riskFlag: row.risk_flag || '',
      riskReason: row.risk_reason || '',
    };
  }
  function scanToRow(item) {
    return {
      trace_code: item.code || null,
      query_time: item.at || null,
      channel: item.source || 'H5',
      source: item.source || null,
      region: item.region || null,
      device: item.device || null,
      ip: null,
      result: item.result || 'normal',
      risk_flag: item.riskFlag || null,
      risk_reason: item.riskReason || null,
    };
  }

  /* ============================================================
   * 5. 标签模板 sf_trace_template ↔ labelTemplates
   * ============================================================ */
  function rowToTemplate(row) {
    var layout = {};
    try { layout = row.layout ? JSON.parse(row.layout) : {}; } catch (e) { layout = {}; }
    var versions = [];
    try { versions = row.versions ? JSON.parse(row.versions) : []; } catch (e) { versions = []; }
    return {
      id: row.template_code || row.template_name,
      name: row.template_name,
      version: num(row.version, 1),
      status: row.status === 'active' ? 'active' : 'inactive',
      layout: layout,
      versions: versions,
    };
  }
  function templateToRow(item) {
    return {
      template_code: item.id || null,
      template_name: item.name,
      applicable_product: null,
      version: num(item.version, 1),
      layout: item.layout ? JSON.stringify(item.layout) : null,
      show_modules: null,
      versions: item.versions ? JSON.stringify(item.versions) : null,
      bound_batch: null,
      status: item.status === 'inactive' ? 'inactive' : 'active',
    };
  }

  /* ============================================================
   * 6. 检测报告 sf_trace_inspection ↔ inspections
   * ============================================================ */
  function rowToInspection(row) {
    var items = [];
    try { items = row.items ? JSON.parse(row.items) : []; } catch (e) { items = []; }
    return {
      id: 'INS-' + (row.batch_no || '') + '-' + (row.report_no || ''),
      batchNo: row.batch_no || '',
      reportNo: row.report_no,
      institution: row.institution || '',
      reportType: row.report_type || '',
      sampleDate: row.sample_date ? String(row.sample_date).slice(0, 10) : '',
      issueDate: row.issue_date ? String(row.issue_date).slice(0, 10) : '',
      validUntil: row.valid_until ? String(row.valid_until).slice(0, 10) : '',
      conclusion: row.conclusion || '',
      items: items,
      attachment: row.attachment_name ? {
        name: row.attachment_name,
        size: num(row.attachment_size),
        type: 'application/pdf',
        uploadedAt: row.created_at ? String(row.created_at).slice(0, 19) : '',
      } : null,
      cma: row.cma || '',
      cnas: row.cnas || '',
      status: INSPECTION_STATUS[row.status] || 'valid',
      operator: row.operator || '',
      createdAt: row.created_at ? String(row.created_at).slice(0, 19) : '',
      updatedAt: row.updated_at ? String(row.updated_at).slice(0, 19) : '',
    };
  }
  function inspectionToRow(item) {
    var att = item.attachment || {};
    return {
      report_no: item.reportNo,
      batch_no: item.batchNo || null,
      institution: item.institution || null,
      report_type: item.reportType || null,
      sample_date: item.sampleDate || null,
      issue_date: item.issueDate || null,
      valid_until: item.validUntil || null,
      conclusion: item.conclusion || null,
      items: item.items ? JSON.stringify(item.items) : null,
      attachment_name: att.name || null,
      attachment_size: att.size != null ? att.size : null,
      cma: item.cma || null,
      cnas: item.cnas || null,
      status: INSPECTION_STATUS[item.status] || 'valid',
      operator: item.operator || null,
    };
  }

  /* ============================================================
   * 7. 标签库存 sf_trace_label_stock ↔ labelStock
   * ============================================================ */
  function rowToLabelStock(row) {
    return { name: row.label_name, stock: num(row.quantity) };
  }
  function labelStockToRow(item) {
    return {
      label_name: item.name,
      quantity: num(item.stock),
      reserved_qty: 0,
      unit: item.unit || '张',
    };
  }

  /* ============================================================
   * 8. 打印任务 sf_trace_print_job ↔ printJobs
   * ============================================================ */
  function rowToPrintJob(row) {
    var codes = [];
    try { codes = row.codes ? JSON.parse(row.codes) : []; } catch (e) { codes = []; }
    return {
      id: row.job_code || '',
      batchNo: row.batch_no || '',
      labelName: row.label_name || '',
      templateId: row.template_id || '',
      templateVersion: num(row.template_version),
      qty: num(row.qty),
      operator: row.operator || '',
      status: row.status || 'printed',
      reprintOf: row.reprint_of || '',
      reason: row.reason || '',
      createdAt: row.created_at ? String(row.created_at).slice(0, 19) : '',
      codes: codes,
    };
  }
  function printJobToRow(item) {
    return {
      job_code: item.id || null,
      batch_no: item.batchNo || null,
      label_name: item.labelName || null,
      template_id: item.templateId || null,
      template_version: num(item.templateVersion) || null,
      qty: num(item.qty),
      operator: item.operator || null,
      status: item.status || 'printed',
      reprint_of: item.reprintOf || null,
      reason: item.reason || null,
      codes: item.codes ? JSON.stringify(item.codes) : null,
    };
  }

  /* ============================================================
   * 9. 召回 sf_trace_recall ↔ recalls
   * ============================================================ */
  function rowToRecall(row) {
    return {
      id: row.recall_code || '',
      batchNo: row.batch_no || '',
      reason: row.reason || '',
      scope: row.scope || '',
      operator: row.operator || '',
      status: row.status || 'active',
      createdAt: row.created_at ? String(row.created_at).slice(0, 19) : '',
      closedAt: row.closed_at ? String(row.closed_at).slice(0, 19) : '',
    };
  }
  function recallToRow(item) {
    return {
      recall_code: item.id || null,
      batch_no: item.batchNo || null,
      reason: item.reason || null,
      scope: item.scope || null,
      operator: item.operator || null,
      status: item.status || 'active',
      closed_at: item.closedAt || null,
    };
  }

  /* ============================================================
   * 聚合转换：表行 → store 聚合对象（load 用）
   * ============================================================ */
  /* ============================================================
   * 9. 溯源展示模板 sf_trace_show_template ↔ showTemplates
   * ============================================================ */
  function rowToShowTemplate(row) {
    return {
      id: row.template_code || String(row.id),
      name: row.name,
      product: row.product || '',
      modules: jparse(row.modules, []),
      boundBatches: jparse(row.bound_batches, []),
      createTime: row.create_time ? String(row.create_time).slice(0, 10) : '',
      status: row.status || 'active',
      desc: row.desc || '',
    };
  }
  function showTemplateToRow(item) {
    return {
      template_code: item.id || null,
      name: item.name,
      product: item.product || null,
      modules: item.modules ? JSON.stringify(item.modules) : null,
      bound_batches: item.boundBatches ? JSON.stringify(item.boundBatches) : null,
      create_time: item.createTime || null,
      status: item.status || 'active',
      'desc': item.desc || null,
    };
  }

  function toAggregate(data) {
    var agg = {
      batches: (data.batches || []).map(rowToBatch),
      codes: (data.codes || []).map(rowToCode),
      events: (data.events || []).map(rowToEvent),
      scans: (data.scans || []).map(rowToScan),
      labelTemplates: (data.labelTemplates || []).map(rowToTemplate),
      inspections: (data.inspections || []).map(rowToInspection),
      printJobs: (data.printJobs || []).map(rowToPrintJob),
      recalls: (data.recalls || []).map(rowToRecall),
      showTemplates: (data.showTemplates || []).map(rowToShowTemplate),
    };

    // 回填批次的 traceCodes（从 codes 推导）
    var byBatch = {};
    for (var i = 0; i < agg.codes.length; i++) {
      var c = agg.codes[i];
      if (!c.batch) continue;
      if (!byBatch[c.batch]) byBatch[c.batch] = [];
      byBatch[c.batch].push(c.code);
    }
    for (var j = 0; j < agg.batches.length; j++) {
      agg.batches[j].traceCodes = byBatch[agg.batches[j].batchNo] || [];
      if (!agg.batches[j].codeCount) agg.batches[j].codeCount = agg.batches[j].traceCodes.length;
    }

    // labelStock 由表直接生成对象
    var stock = {};
    (data.labelStock || []).forEach(function (s) {
      stock[s.name] = s.stock;
    });
    agg.labelStock = stock;

    return agg;
  }

  /* ============================================================
   * 聚合转换：store 聚合对象 → 表行数组（save 用）
   * ============================================================ */
  function fromAggregate(agg) {
    // labelStock 是对象，转数组
    var labelStockArr = [];
    var stockKeys = Object.keys(agg.labelStock || {});
    for (var i = 0; i < stockKeys.length; i++) {
      labelStockArr.push({ name: stockKeys[i], stock: num(agg.labelStock[stockKeys[i]]) });
    }
    return {
      batches: (agg.batches || []).map(batchToRow),
      codes: (agg.codes || []).map(codeToRow),
      events: (agg.events || []).map(eventToRow),
      scans: (agg.scans || []).map(scanToRow),
      labelTemplates: (agg.labelTemplates || []).map(templateToRow),
      inspections: (agg.inspections || []).map(inspectionToRow),
      labelStock: labelStockArr.map(labelStockToRow),
      printJobs: (agg.printJobs || []).map(printJobToRow),
      recalls: (agg.recalls || []).map(recallToRow),
      showTemplates: (agg.showTemplates || []).map(showTemplateToRow),
      deleted: agg.deleted || {},
    };
  }

  global.TraceMapper = {
    toAggregate: toAggregate,
    fromAggregate: fromAggregate,
  };
})(window);
