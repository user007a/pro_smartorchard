/**
 * harvest-mapper.js — 采收模块「store 聚合对象 ↔ 4 张表」映射层
 * --------------------------------------------------------------
 * 策略 A（出入口映射）：HarvestStore 内部逻辑零改动，只在 load/save 出入口做双向转换。
 *
 * 本文件职责：
 *   1. rowToXxx(tableRow) —— 数据库表行 → store 对象（camelCase）
 *   2. xxxToRow(storeItem) —— store 对象 → 数据库表行（snake_case）
 *   3. 状态归一（store 状态 ↔ 表英文 code）
 *   4. 外键还原/解析（base/plot 名称或编号 ↔ 自增 id）
 *
 * 覆盖表（4 张）：
 *   sf_harvest_plan     采收计划（plans）
 *   sf_harvest_record   采收记录（records）
 *   sf_harvest_process  采后处理（processes）
 *   sf_harvest_post     采后发运（shipments，发货单）
 *
 * 说明：
 *   - store 的 storages（库位库存）为派生数据，不入库；
 *     由 processes + shipments 在加载后经 rebuildStorages() 重新推导；
 *   - 库位主数据 SLOTS 为前端硬编码静态字典，同样不入库；
 *   - 状态归一：store 与表均使用英文小写 code，仅做安全兜底映射。
 */
(function (global) {
  'use strict';

  /* ---------- 通用工具 ---------- */
  function text(v) { return String(v == null ? '' : v).trim(); }
  function num(v, def) { var n = parseFloat(v); return isNaN(n) ? (def === undefined ? 0 : def) : n; }
  function pad3(n) { return n < 10 ? '00' + n : (n < 100 ? '0' + n : '' + n); }

  /* ---------- 基地名归一化 ----------
   * store 用全名（如「天水麦积区基地」），sf_base.name 用短名（如「麦积基地」），
   * 通过归一化把两者对齐，保证 base_id 外键能正确解析。
   */
  function normalizeBaseName(name) {
    if (!name) return '';
    // 去掉「天水」前缀与「区/县」中缀，得到短名
    return String(name)
      .replace(/^天水/, '')
      .replace(/[区县]基地$/, '基地')
      .replace(/基地$/, '基地');
  }

  /* ---------- 状态归一（store 与表基本一致，做安全兜底） ---------- */
  var PLAN_STATUS = {
    pending: 'pending', executing: 'executing', completed: 'completed', cancelled: 'cancelled'
  };
  var RECORD_STATUS = {
    pending: 'pending', processing: 'processing', completed: 'completed'
  };
  var PROCESS_STATUS = {
    grading: 'grading', packaging: 'packaging', stored: 'stored', exported: 'exported', abnormal: 'abnormal'
  };
  var SHIPMENT_STATUS = {
    pending: 'pending', shipped: 'shipped', transit: 'transit', signed: 'signed', abnormal: 'abnormal'
  };

  /* ---------- 外键引用解析上下文（运行时构造） ---------- */
  function buildContext(refs) {
    var ctx = {
      baseIdByName: {},   // 基地名 → id
      baseNameById: {},   // id → 基地名
      plotIdByCode: {},   // 地块编号 → id
      plotCodeById: {},   // id → 地块编号
      planIdByCode: {},   // 计划编号 → id
      processIdByCode: {},// 处理单编号 → id
    };
    (refs && refs.bases || []).forEach(function (b) {
      ctx.baseIdByName[b.name] = b.id;
      ctx.baseIdByName[normalizeBaseName(b.name)] = b.id;
      ctx.baseNameById[b.id] = b.name;
    });
    (refs && refs.plots || []).forEach(function (p) {
      ctx.plotIdByCode[p.code] = p.id;
      ctx.plotCodeById[p.id] = p.code;
    });
    (refs && refs.plans || []).forEach(function (p) {
      ctx.planIdByCode[p.code] = p.id;
    });
    (refs && refs.processes || []).forEach(function (p) {
      ctx.processIdByCode[p.code] = p.id;
    });
    return ctx;
  }

  /* ============================================================
   * 1. 采收计划 sf_harvest_plan ↔ plans
   * ============================================================ */
  function rowToPlan(row, ctx) {
    ctx = ctx || {};
    return {
      id: row.plan_code,
      batchNo: row.batch_no || '',
      name: row.plan_name,
      base: row.base_id ? (ctx.baseNameById[row.base_id] || '') : '',
      plot: row.plot_code || '',
      plotName: row.plot_name || '',
      variety: row.variety || '',
      plannedQty: num(row.estimate_amount),
      actualQty: num(row.actual_amount),
      unit: row.unit || 'kg',
      manager: row.manager_name || '',
      startTime: row.start_time || '',
      endTime: row.end_time || '',
      status: PLAN_STATUS[row.status] || row.status || 'pending',
      remark: row.remark || '',
      createdAt: row.created_at || '',
      updatedAt: row.updated_at || '',
    };
  }
  function planToRow(item, ctx) {
    ctx = ctx || {};
    return {
      plan_code: item.id,
      batch_no: item.batchNo || null,
      plan_name: item.name,
      base_id: ctx.baseIdByName[item.base] || ctx.baseIdByName[normalizeBaseName(item.base)] || null,
      plot_code: item.plot || null,
      plot_name: item.plotName || null,
      variety: item.variety || null,
      estimate_amount: item.plannedQty,
      actual_amount: item.actualQty,
      unit: item.unit || 'kg',
      manager_id: null,
      manager_name: item.manager || null,
      start_time: item.startTime || null,
      end_time: item.endTime || null,
      status: PLAN_STATUS[item.status] || item.status || 'pending',
      remark: item.remark || null,
    };
  }

  /* ============================================================
   * 2. 采收记录 sf_harvest_record ↔ records
   * ============================================================ */
  function rowToRecord(row, ctx) {
    ctx = ctx || {};
    return {
      id: row.record_code,
      planId: row.plan_id ? (ctx.planCodeById ? (ctx.planCodeById[row.plan_id] || '') : '') : '',
      batchNo: row.batch_no || '',
      base: row.base_id ? (ctx.baseNameById[row.base_id] || '') : '',
      plot: row.plot_id ? (ctx.plotCodeById[row.plot_id] || '') : (row.plot_code || ''),
      plotName: row.plot_name || '',
      variety: row.variety || '',
      qty: num(row.amount),
      unit: row.unit || 'kg',
      level: row.grade || '',
      levelName: row.grade_name || gradeNameOf(row.grade),
      harvesters: row.harvest_user || '',
      startTime: row.start_time || (row.harvest_date ? row.harvest_date + ' 00:00' : ''),
      endTime: row.end_time || '',
      status: RECORD_STATUS[row.status] || row.status || 'pending',
      traceCode: row.trace_code || '',
      remark: row.remark || '',
      createdAt: row.created_at || '',
      updatedAt: row.updated_at || '',
    };
  }
  function recordToRow(item, ctx) {
    ctx = ctx || {};
    return {
      record_code: item.id,
      plan_id: ctx.planIdByCode[item.planId] || null,
      batch_no: item.batchNo || null,
      base_id: ctx.baseIdByName[item.base] || ctx.baseIdByName[normalizeBaseName(item.base)] || null,
      plot_id: ctx.plotIdByCode[item.plot] || null,
      plot_code: item.plot || null,
      plot_name: item.plotName || null,
      variety: item.variety || null,
      amount: item.qty,
      unit: item.unit || 'kg',
      grade: item.level || null,
      grade_name: item.levelName || null,
      harvest_user: item.harvesters || null,
      harvest_date: (item.startTime || '').slice(0, 10) || null,
      start_time: item.startTime || null,
      end_time: item.endTime || null,
      trace_code: item.traceCode || null,
      status: RECORD_STATUS[item.status] || item.status || 'pending',
      remark: item.remark || null,
    };
  }

  /* ============================================================
   * 3. 采后处理 sf_harvest_process ↔ processes
   * ============================================================ */
  function rowToProcess(row, ctx) {
    ctx = ctx || {};
    return {
      id: row.process_code,
      recordId: row.record_code || '',
      batchNo: row.batch_no || '',
      plot: row.plot_id ? (ctx.plotCodeById[row.plot_id] || '') : '',
      plotName: row.plot_name || '',
      variety: row.variety || '',
      grade: row.grade_name || gradeNameOf(row.grade) || '',
      qty: num(row.amount),
      unit: row.unit || 'kg',
      status: PROCESS_STATUS[row.status] || row.status || 'grading',
      location: row.location || '',
      operator: row.operator || '',
      remark: row.remark || '',
      inTime: row.in_time || '',
      createdAt: row.operate_time || row.created_at || '',
      updatedAt: row.updated_at || '',
    };
  }
  function processToRow(item, ctx) {
    ctx = ctx || {};
    return {
      process_code: item.id,
      record_code: item.recordId || null,
      batch_no: item.batchNo || null,
      plot_id: ctx.plotIdByCode[item.plot] || null,
      plot_name: item.plotName || null,
      variety: item.variety || null,
      grade: item.grade || null,
      amount: item.qty,
      unit: item.unit || 'kg',
      process_type: null,
      result: null,
      location: item.location || null,
      status: PROCESS_STATUS[item.status] || item.status || 'grading',
      operator: item.operator || null,
      operate_time: item.createdAt || null,
      in_time: item.inTime || null,
      remark: item.remark || null,
    };
  }

  /* ============================================================
   * 4. 采后发运 sf_harvest_post ↔ shipments
   * ============================================================ */
  function rowToShipment(row) {
    return {
      id: row.post_code,
      sourceId: row.source_code || '',
      batchNo: row.batch_no || '',
      customer: row.customer || '',
      phone: row.phone || '',
      address: row.address || '',
      orderNo: row.order_no || '',
      qty: num(row.amount),
      unit: row.unit || 'kg',
      logistics: row.logistics_co || '',
      tracking: row.logistics_no || '',
      date: row.post_date || '',
      status: SHIPMENT_STATUS[row.status] || row.status || 'pending',
      operator: row.operator || '',
      remark: row.remark || '',
      shippedAt: row.shipped_at || '',
      signPerson: row.sign_person || '',
      signTime: row.sign_time || '',
      createdAt: row.created_at || '',
      updatedAt: row.updated_at || '',
    };
  }
  function shipmentToRow(item) {
    return {
      post_code: item.id,
      source_batch: item.batchNo || null,
      source_code: item.sourceId || null,
      batch_no: item.batchNo || null,
      customer: item.customer || null,
      phone: item.phone || null,
      address: item.address || null,
      order_no: item.orderNo || null,
      amount: item.qty,
      unit: item.unit || 'kg',
      logistics_no: item.tracking || null,
      logistics_co: item.logistics || null,
      post_date: item.date || null,
      status: SHIPMENT_STATUS[item.status] || item.status || 'pending',
      operator: item.operator || null,
      shipped_at: item.shippedAt || null,
      sign_person: item.signPerson || null,
      sign_time: item.signTime || null,
      remark: item.remark || null,
    };
  }

  /* ---------- 等级名称兜底 ---------- */
  function gradeNameOf(code) {
    var map = { level1: '一级', level2: '二级', level3: '三级' };
    return map[code] || '';
  }

  /* ============================================================
   * 聚合转换：表行 → store 聚合对象（load 用）
   * ============================================================ */
  function toAggregate(data) {
    var ctx = buildContext(data.refs);
    return {
      plans: (data.plans || []).map(function (r) { return rowToPlan(r, ctx); }),
      records: (data.records || []).map(function (r) { return rowToRecord(r, ctx); }),
      processes: (data.processes || []).map(function (r) { return rowToProcess(r, ctx); }),
      shipments: (data.shipments || []).map(rowToShipment),
    };
  }

  /* ============================================================
   * 聚合转换：store 聚合对象 → 表行数组（save 用）
   * ============================================================ */
  function fromAggregate(agg, ctx) {
    ctx = ctx || {};
    return {
      plans: (agg.plans || []).map(function (p) { return planToRow(p, ctx); }),
      records: (agg.records || []).map(function (r) { return recordToRow(r, ctx); }),
      processes: (agg.processes || []).map(function (p) { return processToRow(p, ctx); }),
      shipments: (agg.shipments || []).map(shipmentToRow),
      deleted: agg.deleted || {},
    };
  }

  global.HarvestMapper = {
    buildContext: buildContext,
    toAggregate: toAggregate,
    fromAggregate: fromAggregate,
  };
})(window);
