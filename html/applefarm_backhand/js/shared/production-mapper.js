/**
 * production-mapper.js — 生产模块「store 聚合对象 ↔ 10 张表」映射层
 * --------------------------------------------------------------
 * 策略 A（出入口映射）：ProductionStore 内部逻辑零改动，只在 load/save 出入口做双向转换。
 *
 * 本文件职责：
 *   1. rowToXxx(tableRow) —— 数据库表行 → store 对象（camelCase）
 *   2. xxxToRow(storeItem) —— store 对象 → 数据库表行（snake_case）
 *   3. 状态归一（store 中文/状态 ↔ 表英文 code）
 *   4. 外键还原/解析（base/plot/standard/route/plan/task 编号 ↔ 自增 id）
 *
 * 覆盖表（10 张）：见 production-aggregate.js 的 TABLE_CONFIG。
 *
 * 说明：
 *   - 派生字段（farmingStats/todoTasks 等统计值）不入库；
 *   - route.points 序列化为 JSON 字符串存 sf_patrol_route.points；
 *   - 状态归一映射见下方 STATUS_* 常量。
 */
(function (global) {
  'use strict';

  /* ---------- 通用工具 ---------- */
  function text(v) { return String(v == null ? '' : v).trim(); }
  function num(v, def) { var n = parseFloat(v); return isNaN(n) ? (def === undefined ? 0 : def) : n; }
  function b2i(v) { return v ? 1 : 0; }
  function i2b(v) { return v === 1 || v === '1' || v === true; }
  function pad3(n) { return n < 10 ? '00' + n : (n < 100 ? '0' + n : '' + n); }

  /* ---------- 状态归一（表 → store） ---------- */
  var PLAN_STATUS_REV = { done: 'completed', in_progress: 'executing', pending: 'pending', delayed: 'delayed', cancelled: 'cancelled', draft: 'pending' };
  var TASK_STATUS_REV = { done: 'completed', in_progress: 'processing', pending: 'pending', cancelled: 'cancelled', overdue: 'overdue' };
  var SORTIE_STATUS_REV = { done: '已完成', in_progress: '执行中', pending: '待执行', cancelled: '已取消' };
  var ABNORMAL_STATUS_REV = { pending: 'waitHandle', processing: 'handling', done: 'closed' };
  var PATROL_STATUS_REV = { in_progress: 'executing', pending: 'pending', done: 'completed' };
  var STANDARD_STATUS_REV = { active: '现行', inactive: '废止' };

  /* ---------- 状态归一（store → 表） ---------- */
  var PLAN_STATUS = { completed: 'done', executing: 'in_progress', pending: 'pending', delayed: 'delayed', cancelled: 'cancelled' };
  var TASK_STATUS = { completed: 'done', processing: 'in_progress', pending: 'pending', cancelled: 'cancelled', overdue: 'overdue' };
  var SORTIE_STATUS = { '已完成': 'done', '执行中': 'in_progress', '待执行': 'pending', '已取消': 'cancelled' };
  var ABNORMAL_STATUS = { waitHandle: 'pending', handling: 'processing', closed: 'done' };
  var PATROL_STATUS = { executing: 'in_progress', pending: 'pending', completed: 'done' };
  var STANDARD_STATUS = { '现行': 'active', '试行': 'active', '废止': 'inactive' };

  /* ---------- 外键引用解析上下文（运行时构造） ---------- */
  function buildContext(refs) {
    var ctx = {
      baseIdByName: {},   // 基地名 → id
      baseNameById: {},   // id → 基地名
      plotIdByCode: {},   // 地块编号 → id
      plotCodeById: {},   // id → 地块编号
      routeIdByCode: {},  // 路线编号 → id
      routeCodeById: {},  // id → 路线编号
      stdIdByCode: {},    // 标准编号 → id
      planIdByCode: {},   // 计划编号 → id
      taskIdByCode: {},   // 任务编号 → id
    };
    (refs && refs.bases || []).forEach(function (b) {
      ctx.baseIdByName[b.name] = b.id;
      ctx.baseNameById[b.id] = b.name;
    });
    (refs && refs.plots || []).forEach(function (p) {
      ctx.plotIdByCode[p.code] = p.id;
      ctx.plotCodeById[p.id] = p.code;
    });
    (refs && refs.routes || []).forEach(function (r) {
      ctx.routeIdByCode[r.code] = r.id;
      ctx.routeCodeById[r.id] = r.code;
    });
    (refs && refs.standards || []).forEach(function (s) {
      ctx.stdIdByCode[s.code] = s.id;
    });
    (refs && refs.plans || []).forEach(function (p) {
      ctx.planIdByCode[p.code] = p.id;
    });
    (refs && refs.tasks || []).forEach(function (t) {
      ctx.taskIdByCode[t.code] = t.id;
    });
    return ctx;
  }

  /* ============================================================
   * 1. 农事标准 sf_guide_standard ↔ standards
   * ============================================================ */
  function rowToStandard(row) {
    return {
      id: row.standard_code,
      code: row.standard_code,
      name: row.standard_name,
      level: row.level,
      type: row.farm_type,
      variety: row.variety,
      date: row.effective_date,
      status: STANDARD_STATUS_REV[row.status] || '现行',
      process: row.key_process || '按标准作业流程执行',
      dosage: row.dosage || '—',
      accept: row.accept_index || '—',
      refCount: num(row.referenced),
    };
  }
  function standardToRow(item) {
    return {
      standard_code: item.code || item.id,
      standard_name: item.name,
      level: item.level,
      farm_type: item.type,
      variety: item.variety,
      effective_date: item.date,
      status: STANDARD_STATUS[item.status] || 'active',
      key_process: item.process,
      dosage: item.dosage,
      accept_index: item.accept,
      referenced: num(item.refCount),
    };
  }

  /* ============================================================
   * 2. 农事计划 sf_farming_plan ↔ plans
   * ============================================================ */
  function rowToPlan(row, ctx) {
    ctx = ctx || {};
    return {
      id: row.plan_code,
      name: row.plan_name,
      base: row.base_id ? (ctx.baseNameById[row.base_id] || '') : '',
      type: row.plan_type,
      typeName: row.plan_type,
      startDate: row.start_date,
      endDate: row.end_date,
      manager: '',
      status: PLAN_STATUS_REV[row.status] || 'pending',
      plannedQty: num(row.planned_qty),
      actualQty: num(row.actual_qty),
      unit: row.unit,
      desc: row.remark,
      plotRange: row.plot_range || '',
      standardId: '',
      standardName: row.standard_name || '',
      createdAt: row.start_date,
    };
  }
  function planToRow(item, ctx) {
    ctx = ctx || {};
    return {
      plan_code: item.id,
      plan_name: item.name,
      plan_type: item.type || item.typeName,
      base_id: ctx.baseIdByName[item.base] || null,
      manager_id: null,
      standard_id: ctx.stdIdByCode[item.standardId] || null,
      start_date: item.startDate,
      end_date: item.endDate,
      status: PLAN_STATUS[item.status] || 'pending',
      progress: item.plannedQty > 0 ? Math.round(item.actualQty / item.plannedQty * 1000) / 10 : 0,
      planned_qty: item.plannedQty,
      actual_qty: item.actualQty,
      unit: item.unit,
      plot_range: item.plotRange,
      standard_name: item.standardName,
      remark: item.desc,
    };
  }

  /* ============================================================
   * 3. 农事任务 sf_farming_task ↔ tasks
   * ============================================================ */
  function rowToTask(row, ctx) {
    ctx = ctx || {};
    return {
      id: row.task_code,
      planId: row.plan_id ? (ctx.planIdByCode[row.plan_id] || ctx.planIdByCode['PL-' + row.plan_id] || '') : '',
      name: row.task_name,
      base: row.base_id ? (ctx.baseNameById[row.base_id] || '') : '',
      plot: row.plot_name || '',
      plotId: row.plot_ids || '',
      type: row.category || '',
      typeCode: row.type_code || '',
      taskCategory: row.task_category || 'farming',
      executorType: 'person',
      priority: row.priority === '高' ? 'high' : (row.priority === '中' ? 'medium' : 'low'),
      person: '',
      worker: row.executor || '',
      team: row.team || '',
      planTime: row.plan_time,
      deadline: row.deadline,
      status: TASK_STATUS_REV[row.status] || 'pending',
      desc: row.remark,
      targetQty: 0,
      createdBy: '系统',
      createdAt: row.plan_time,
    };
  }
  function taskToRow(item, ctx) {
    ctx = ctx || {};
    return {
      task_code: item.id,
      task_name: item.name,
      plan_id: ctx.planIdByCode[item.planId] || null,
      category: item.type || item.typeName,
      task_category: item.taskCategory,
      type_code: item.typeCode,
      priority: item.priority === 'high' ? '高' : (item.priority === 'medium' ? '中' : '低'),
      base_id: ctx.baseIdByName[item.base] || null,
      plot_ids: item.plotId,
      plot_name: item.plot,
      manager_id: null,
      team: item.team,
      executor: item.worker || item.person,
      plan_time: item.planTime,
      deadline: item.deadline,
      status: TASK_STATUS[item.status] || 'pending',
      remark: item.desc,
    };
  }

  /* ============================================================
   * 4. 农事记录 sf_farming_record ↔ records
   * ============================================================ */
  function rowToRecord(row, ctx) {
    ctx = ctx || {};
    return {
      id: row.record_code,
      planId: row.plan_id ? '' : '',
      taskId: row.task_id ? '' : '',
      base: row.base_id ? (ctx.baseNameById[row.base_id] || '') : '',
      plot: row.plot_code || '',
      type: row.type_code || '',
      typeName: row.type_name || row.farm_type || '',
      executor: row.executor,
      date: row.execute_date,
      time: '',
      status: row.status,
      qty: num(row.complete_amount),
      unit: row.unit,
      area: num(row.area),
      content: row.content,
      photo: row.photo || '',
      gps: null,
      auditRemark: row.audit_remark || '',
      source: row.source || 'pc',
    };
  }
  function recordToRow(item, ctx) {
    ctx = ctx || {};
    return {
      record_code: item.id,
      plan_id: ctx.planIdByCode[item.planId] || null,
      task_id: ctx.taskIdByCode[item.taskId] || null,
      base_id: ctx.baseIdByName[item.base] || null,
      plot_ids: item.plot,
      farm_type: item.typeName,
      type_code: item.type,
      type_name: item.typeName,
      material_type: null,
      plot_code: item.plot,
      executor: item.executor,
      execute_date: item.date,
      complete_amount: item.qty,
      unit: item.unit,
      area: item.area,
      content: item.content,
      photo: item.photo || null,
      audit_remark: item.auditRemark,
      source: item.source,
      status: item.status,
      remark: (item.base ? item.base + ' ' : '') + (item.plot || ''),
    };
  }

  /* ============================================================
   * 5. 巡园路线 sf_patrol_route ↔ routeList
   * ============================================================ */
  function rowToRoute(row) {
    var points = [];
    try { points = row.points ? JSON.parse(row.points) : []; } catch (e) { points = []; }
    return {
      id: row.route_code,
      routeId: row.route_code,
      routeName: row.route_name,
      base: row.coverage || '',
      pointCount: num(row.point_count, points.length),
      requiredCount: num(row.required_count, 0),
      enabled: i2b(row.enabled),
      remark: row.remark || '',
      updatedAt: row.updated_at,
      points: points,
    };
  }
  function routeToRow(item) {
    return {
      route_code: item.routeId || item.id,
      route_name: item.routeName,
      base_id: null,
      coverage: item.base,
      point_count: item.pointCount,
      required_count: item.requiredCount,
      points: JSON.stringify(item.points || []),
      enabled: b2i(item.enabled),
      frequency: '每日',
      status: item.enabled ? 'active' : 'inactive',
      remark: item.remark,
    };
  }

  /* ============================================================
   * 6. 巡园计划 sf_patrol_plan ↔ patrolPlans
   * ============================================================ */
  function rowToPatrolPlan(row, ctx) {
    ctx = ctx || {};
    return {
      id: row.plan_code,
      name: row.patrol_type ? (row.patrol_type + '巡园') : '巡园计划',
      base: row.base_id ? (ctx.baseNameById[row.base_id] || '') : '',
      routeId: row.route_id ? (ctx.routeCodeById[row.route_id] || '') : '',
      routeName: row.route_name || '',
      freq: row.frequency || '',
      inspector: row.patrol_user || '',
      startDate: '',
      endDate: '',
      status: PATROL_STATUS_REV[row.status] || 'pending',
      remark: row.remark || '',
    };
  }
  function patrolPlanToRow(item, ctx) {
    ctx = ctx || {};
    return {
      plan_code: item.id,
      base_id: ctx.baseIdByName[item.base] || null,
      patrol_type: (item.name || '').replace('巡园', '').replace('巡查', '') || '日常',
      plot_ids: null,
      route_id: ctx.routeIdByCode[item.routeId] || null,
      route_name: item.routeName,
      patrol_user: item.inspector,
      patrol_time: null,
      frequency: item.freq,
      status: PATROL_STATUS[item.status] || 'pending',
      problem: null,
      remark: item.remark,
    };
  }

  /* ============================================================
   * 7. 巡园打卡 sf_patrol_checkin ↔ checkins
   * ============================================================ */
  function rowToCheckin(row, ctx) {
    ctx = ctx || {};
    return {
      id: row.checkin_code,
      patrolPlanId: row.patrol_plan_id ? '' : '',
      routeId: row.route_id ? (ctx.routeCodeById[row.route_id] || '') : '',
      base: row.base_id ? (ctx.baseNameById[row.base_id] || '') : '',
      type: row.patrol_type || '',
      plots: (row.plot_ids || '').replace(/,/g, ', '),
      inspector: row.inspector || '',
      time: row.checkin_time,
      issue: row.issue_code || 'normal',
      issueName: row.issue_name || '',
      pointsDone: num(row.points_done),
      pointsTotal: num(row.points_total),
      status: row.status || 'completed',
    };
  }
  function checkinToRow(item, ctx) {
    ctx = ctx || {};
    return {
      checkin_code: item.id,
      patrol_plan_id: null,
      route_id: ctx.routeIdByCode[item.routeId] || null,
      base_id: ctx.baseIdByName[item.base] || null,
      patrol_type: item.type,
      plot_ids: (item.plots || '').replace(/, /g, ','),
      inspector: item.inspector,
      checkin_time: item.time,
      issue_code: item.issue,
      issue_name: item.issueName,
      points_done: item.pointsDone,
      points_total: item.pointsTotal,
      status: item.status,
    };
  }

  /* ============================================================
   * 8. 无人机架次 sf_drone_patrol ↔ sorties
   * ============================================================ */
  function rowToSortie(row) {
    return {
      id: row.task_code,
      sortieNo: row.sortie,
      taskId: '',
      planId: '',
      routeId: '',
      droneTaskName: row.drone_task_name || '',
      base: row.base_id ? '' : '',
      drone: row.drone,
      plot: row.plot_ids || '',
      area: num(row.flight_area),
      progress: num(row.progress),
      rtk: row.rtk,
      altitude: row.flight_height,
      speed: row.speed,
      time: row.plan_time,
      status: SORTIE_STATUS_REV[row.status] || '待执行',
      createdBy: row.created_by || '',
    };
  }
  function sortieToRow(item) {
    return {
      task_code: item.id,
      sortie: item.sortieNo,
      drone_task_name: item.droneTaskName,
      base_id: null,
      drone: item.drone,
      plot_ids: item.plot,
      route_id: null,
      flight_area: item.area,
      progress: item.progress,
      rtk: item.rtk,
      flight_height: item.altitude,
      speed: item.speed,
      route: null,
      plan_time: item.time,
      status: SORTIE_STATUS[item.status] || 'pending',
      created_by: item.createdBy,
      remark: null,
    };
  }

  /* ============================================================
   * 9. 飞行日志 sf_drone_flight_log ↔ flightLogs
   * ============================================================ */
  function rowToFlightLog(row) {
    return {
      id: row.log_code,
      sortieId: row.sortie_id || '',
      sortieNo: row.sortie_id || '',
      taskId: row.task_code || '',
      base: '',
      plot: '',
      event: row.event,
      altitude: row.altitude,
      speed: row.speed,
      battery: num(row.battery),
      time: row.event_time,
      remark: row.remark || '',
    };
  }
  function flightLogToRow(item) {
    return {
      log_code: item.id,
      sortie_id: item.sortieId,
      task_code: item.taskId,
      event: item.event,
      altitude: item.altitude,
      speed: item.speed,
      battery: item.battery,
      event_time: item.time,
      remark: item.remark,
    };
  }

  /* ============================================================
   * 10. 巡园异常 sf_patrol_abnormal ↔ anomalies
   * ============================================================ */
  function rowToAbnormal(row, ctx) {
    ctx = ctx || {};
    return {
      id: row.abnormal_code,
      source: row.source || 'patrol',
      type: row.abnormal_type,
      plot: row.plot_code || '',
      remark: row.abnormal_desc,
      operator: row.reporter,
      status: ABNORMAL_STATUS_REV[row.status] || 'waitHandle',
      severity: row.severity,
      reportTime: row.report_time,
      photo: '',
      lat: 0, lng: 0,
      handleResult: row.handle_result || '',
      handleRemark: row.handle_remark || '',
      handleTime: row.handle_time || '',
      taskId: '',
    };
  }
  function abnormalToRow(item, ctx) {
    ctx = ctx || {};
    return {
      abnormal_code: item.id,
      source: item.source,
      base_id: ctx.baseIdByName[item.base] || null,
      plot_id: ctx.plotIdByCode[item.plot] || null,
      plot_code: item.plot,
      route_id: null,
      abnormal_type: item.type,
      abnormal_desc: item.remark,
      reporter: item.operator,
      report_time: item.reportTime,
      severity: item.severity,
      status: ABNORMAL_STATUS[item.status] || 'pending',
      handle_result: item.handleResult || null,
      handle_remark: item.handleRemark || null,
      handle_time: item.handleTime || null,
      remark: null,
    };
  }

  /* ============================================================
   * 聚合转换：表行 → store 聚合对象（load 用）
   * ============================================================ */
  function toAggregate(data) {
    var ctx = buildContext(data.refs);
    return {
      standards: (data.standards || []).map(rowToStandard),
      plans: (data.plans || []).map(function (r) { return rowToPlan(r, ctx); }),
      tasks: (data.tasks || []).map(function (r) { return rowToTask(r, ctx); }),
      records: (data.records || []).map(function (r) { return rowToRecord(r, ctx); }),
      routeList: (data.routeList || []).map(rowToRoute),
      patrolPlans: (data.patrolPlans || []).map(function (r) { return rowToPatrolPlan(r, ctx); }),
      checkins: (data.checkins || []).map(function (r) { return rowToCheckin(r, ctx); }),
      sorties: (data.sorties || []).map(rowToSortie),
      flightLogs: (data.flightLogs || []).map(rowToFlightLog),
      anomalies: (data.anomalies || []).map(function (r) { return rowToAbnormal(r, ctx); }),
    };
  }

  /* ============================================================
   * 聚合转换：store 聚合对象 → 表行数组（save 用）
   * ============================================================ */
  function fromAggregate(agg, ctx) {
    ctx = ctx || {};
    return {
      standards: (agg.standards || []).map(standardToRow),
      plans: (agg.plans || []).map(function (p) { return planToRow(p, ctx); }),
      tasks: (agg.tasks || []).map(function (t) { return taskToRow(t, ctx); }),
      records: (agg.records || []).map(function (r) { return recordToRow(r, ctx); }),
      routeList: (agg.routeList || []).map(routeToRow),
      patrolPlans: (agg.patrolPlans || []).map(function (p) { return patrolPlanToRow(p, ctx); }),
      checkins: (agg.checkins || []).map(function (c) { return checkinToRow(c, ctx); }),
      sorties: (agg.sorties || []).map(sortieToRow),
      flightLogs: (agg.flightLogs || []).map(flightLogToRow),
      anomalies: (agg.anomalies || []).map(function (a) { return abnormalToRow(a, ctx); }),
      deleted: agg.deleted || {},
    };
  }

  global.ProductionMapper = {
    buildContext: buildContext,
    toAggregate: toAggregate,
    fromAggregate: fromAggregate,
  };
})(window);
