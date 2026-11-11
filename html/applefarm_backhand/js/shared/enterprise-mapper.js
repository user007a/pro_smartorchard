/**
 * enterprise-mapper.js — 企业模块「store 聚合对象 ↔ 8 张表」映射层
 * --------------------------------------------------------------
 * 策略 A（出入口映射）：store 内部逻辑零改动，只在 load/save 出入口做双向转换。
 *
 * 本文件职责：
 *   1. rowToXxx(tableRow) —— 数据库表行 → store 对象（camelCase）
 *   2. xxxToRow(storeItem) —— store 对象 → 数据库表行（snake_case）
 *   3. 枚举值归一（store 中文 ↔ 表英文 code）
 *   4. 外键还原/解析（base_id/plot_id ↔ 业务编号）
 *
 * 覆盖表（8 张）：
 *   sf_enterprise（单行主表）
 *   sf_enterprise_biz / sf_enterprise_staff / sf_enterprise_expert
 *   sf_enterprise_timeline / sf_enterprise_operation
 *   sf_base / sf_plot（台账）
 *
 * 说明：sf_enterprise_cert 由 cert 模块（CertStore）负责，本文件不处理。
 */
(function (global) {
  'use strict';

  /* ---------- 通用工具 ---------- */
  function text(v) { return String(v == null ? '' : v).trim(); }
  function num(v, def) { var n = parseFloat(v); return isNaN(n) ? (def === undefined ? 0 : def) : n; }
  function b2i(v) { return v ? 1 : 0; }
  function i2b(v) { return v === 1 || v === '1' || v === true; }

  /* ---------- 外键引用解析上下文（运行时构造） ---------- */
  function buildContext(refs) {
    var ctx = {
      baseIdByCode: {},   // code → id
      baseCodeById: {},   // id → code
      baseNameById: {},   // id → name
      plotIdByCode: {},   // code → id
      plotCodeById: {},   // id → code
    };
    (refs && refs.bases || []).forEach(function (b) {
      ctx.baseIdByCode[b.code] = b.id;
      ctx.baseCodeById[b.id] = b.code;
      ctx.baseNameById[b.id] = b.name;
    });
    (refs && refs.plots || []).forEach(function (p) {
      ctx.plotIdByCode[p.code] = p.id;
      ctx.plotCodeById[p.id] = p.code;
    });
    return ctx;
  }

  /* ============================================================
   * 企业基本信息（sf_enterprise ↔ store.profile + store.enterprise）
   * ============================================================ */

  function rowToEnterprise(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      creditCode: row.credit_code,
      legalPerson: row.legal_person,
      capital: num(row.capital),
      establishDate: row.establish_date,
      enterpriseType: row.enterprise_type,
      industry: row.industry,
      bizStatus: row.biz_status,
      address: row.address,
      scope: row.scope,
      termStart: row.term_start,
      termEnd: row.term_end,
      authority: row.authority,
      bannerFileId: row.banner_file_id,
    };
  }

  function enterpriseToRow(item) {
    return {
      name: item.name,
      credit_code: item.creditCode,
      legal_person: item.legalPerson,
      capital: item.capital,
      establish_date: item.establishDate,
      enterprise_type: item.enterpriseType,
      industry: item.industry,
      biz_status: item.bizStatus,
      address: item.address,
      scope: item.scope,
      term_start: item.termStart,
      term_end: item.termEnd,
      authority: item.authority,
      banner_file_id: item.bannerFileId || null,
    };
  }

  /* ============================================================
   * 业务结构（sf_enterprise_biz ↔ store.business）
   * ============================================================ */

  function rowToBiz(row) {
    return {
      id: row.id,
      icon: row.icon,
      name: row.name,
      description: row.description,
      m1Label: row.m1_label,
      m1Value: row.m1_value,
      m2Label: row.m2_label,
      m2Value: row.m2_value,
      color: row.color,
    };
  }

  function bizToRow(item) {
    return {
      id: item.id,
      icon: item.icon,
      name: item.name,
      description: item.description,
      m1_label: item.m1Label,
      m1_value: item.m1Value,
      m2_label: item.m2Label,
      m2_value: item.m2Value,
      color: item.color,
    };
  }

  /* ============================================================
   * 人员规模（sf_enterprise_staff ↔ store.staff）
   * ============================================================ */

  function rowToStaff(row) {
    return {
      id: row.id,
      role: row.role_type,   // 表 role_type（管理/技术/作业/销售）→ store k
      count: num(row.count),
    };
  }

  function staffToRow(item) {
    return {
      id: item.id,
      role_type: item.role || item.k || item.roleType,
      count: item.count || item.v,
    };
  }

  /* ============================================================
   * 专家团队（sf_enterprise_expert ↔ store.experts）
   * ============================================================ */

  function rowToExpert(row) {
    return {
      id: row.id,
      name: row.name,
      title: row.role,      // 表 role（职务）→ store title
      org: row.org,
      joinDate: row.join_date,
      description: row.description,
    };
  }

  function expertToRow(item) {
    return {
      id: item.id,
      name: item.name,
      role: item.title || item.role,
      org: item.org,
      join_date: item.joinDate,
      description: item.description,
    };
  }

  /* ============================================================
   * 发展历程（sf_enterprise_timeline ↔ store.timeline）
   * ============================================================ */

  function rowToTimeline(row) {
    return {
      id: row.id,
      year: row.timeline_date,   // 表 timeline_date（"2010年10月"）→ store year
      title: row.title,
      short: row.description,    // 表 description → store short
    };
  }

  function timelineToRow(item) {
    return {
      id: item.id,
      timeline_date: item.year || item.timelineDate,
      title: item.title,
      description: item.short || item.description,
    };
  }

  /* ============================================================
   * 经营数据（sf_enterprise_operation ↔ store.operation）
   * ============================================================ */

  function rowToOperation(row) {
    return {
      id: row.id,
      label: row.label,
      value: num(row.value),
      unit: row.unit,
    };
  }

  function operationToRow(item) {
    return {
      id: item.id,
      label: item.label,
      value: item.value,
      unit: item.unit,
    };
  }

  /* ============================================================
   * 基地台账（sf_base ↔ store.bases）
   * store.bases: { id(code), name, area, plots(派生), x, y, star }
   * 表 sf_base:  { code, name, base_status, address, area, manager_id, phone }
   * ============================================================ */

  function rowToBase(row) {
    return {
      id: row.code || String(row.id),   // 业务编号（MJ/QZ...）
      name: row.name,
      area: num(row.area),
      plots: 0,                          // 派生：地块数，由 plots 数组回填
      baseStatus: row.base_status,
      address: row.address,
      managerId: row.manager_id,
      managerName: row.manager_name || '',
      phone: row.phone,
      baseImages: (function () { try { return row.base_images ? JSON.parse(row.base_images) : []; } catch (e) { return []; } })(),
      // 地图坐标：表无此列，从 store 兜底值保留（不落库）
      x: 0, y: 0, star: 0,
    };
  }

  function baseToRow(item) {
    return {
      code: item.id || item.code,
      name: item.name,
      area: item.area,
      base_status: item.baseStatus || 'active',
      address: item.address,
      manager_id: item.managerId || null,
      manager_name: item.managerName || null,
      phone: item.phone,
      base_images: item.baseImages && item.baseImages.length ? JSON.stringify(item.baseImages) : null,
    };
  }

  /* ============================================================
   * 地块台账（sf_plot ↔ store.plots）
   * ============================================================ */

  function rowToPlot(row, ctx) {
    ctx = ctx || {};
    return {
      id: row.code || String(row.id),
      name: row.name,
      baseId: row.base_id ? (ctx.baseCodeById[row.base_id] || '') : '',
      baseName: row.base_id ? (ctx.baseNameById[row.base_id] || '') : '',
      plotType: row.plot_type,
      varietyCode: row.variety_code,
      managerId: row.manager_id,
      area: num(row.area),
      plantYear: row.plant_year,
      lng: num(row.lng, null),
      lat: num(row.lat, null),
      plotStatus: row.plot_status,
      auditStatus: row.audit_status,
      remark: row.remark,
    };
  }

  function plotToRow(item, ctx) {
    ctx = ctx || {};
    return {
      code: item.id || item.code,
      name: item.name,
      base_id: ctx.baseIdByCode[item.baseId] || null,
      plot_type: item.plotType,
      variety_code: item.varietyCode,
      manager_id: item.managerId || null,
      area: item.area,
      plant_year: item.plantYear,
      lng: item.lng,
      lat: item.lat,
      plot_status: item.plotStatus || 'normal',
      audit_status: item.auditStatus,
      remark: item.remark,
    };
  }

  /* ============================================================
   * 聚合转换：表行 → store 聚合对象（load 用）
   * ============================================================ */

  function toAggregate(data) {
    var ctx = buildContext(data.refs);

    var enterprise = rowToEnterprise(data.enterprise);
    var biz = (data.biz || []).map(rowToBiz);
    var staff = (data.staff || []).map(rowToStaff);
    var experts = (data.experts || []).map(rowToExpert);
    var timelines = (data.timelines || []).map(rowToTimeline);
    var operations = (data.operations || []).map(rowToOperation);
    var bases = (data.bases || []).map(rowToBase);
    var plots = (data.plots || []).map(function (r) { return rowToPlot(r, ctx); });

    // 回填基地地块数（派生）
    var plotCountByBase = {};
    plots.forEach(function (p) {
      if (p.baseId) plotCountByBase[p.baseId] = (plotCountByBase[p.baseId] || 0) + 1;
    });
    bases.forEach(function (b) {
      b.plots = plotCountByBase[b.id] || 0;
    });

    return {
      version: 2,
      enterprise: enterprise,
      business: biz,
      staff: staff,
      experts: experts,
      timelines: timelines,
      operations: operations,
      bases: bases,
      plots: plots,
      updatedAt: new Date().toISOString(),
    };
  }

  /* ============================================================
   * 聚合转换：store 聚合对象 → 表行数组（save 用）
   * ============================================================ */

  function fromAggregate(agg, ctx) {
    ctx = ctx || {};
    return {
      enterprise: agg.enterprise ? enterpriseToRow(agg.enterprise) : null,
      biz: (agg.business || []).map(bizToRow),
      staff: (agg.staff || []).map(staffToRow),
      experts: (agg.experts || []).map(expertToRow),
      timelines: (agg.timelines || []).map(timelineToRow),
      operations: (agg.operations || []).map(operationToRow),
      bases: (agg.bases || []).map(baseToRow),
      plots: (agg.plots || []).map(function (p) { return plotToRow(p, ctx); }),
      deleted: agg.deleted || {},
    };
  }

  global.EnterpriseMapper = {
    buildContext: buildContext,
    toAggregate: toAggregate,
    fromAggregate: fromAggregate,
  };
})(window);
