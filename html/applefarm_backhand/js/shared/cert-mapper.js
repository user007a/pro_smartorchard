/**
 * cert-mapper.js — 证书模块「store 聚合对象 ↔ sf_cert 表」映射层
 * --------------------------------------------------------------
 * 策略 A（出入口映射）：CertStore 内部逻辑零改动，只在 load/save 出入口做双向转换。
 *
 * 本文件职责：
 *   1. rowToCert(tableRow)  —— 数据库表行 → store cert 对象（camelCase）
 *   2. certToRow(certItem)  —— store cert 对象 → 数据库表行（snake_case）
 *   3. 枚举值归一（category 中英映射、status 直接透传）
 *
 * 覆盖表（1 张）：
 *   sf_cert（证书台账，含企业资质 qualification + 批次凭证 batch 两类）
 *
 * 字段对照要点：
 *   store.certNo      ↔ 表 cert_no（唯一键 uk_cert_no）
 *   store.type        ↔ 表 cert_type / cert_name
 *   store.typeCode    ↔ 表 type_code
 *   store.category    ↔ 表 category（qualification/batch）
 *   store.issueOrg    ↔ 表 issuer
 *   store.issueDate   ↔ 表 issued_at（签发时间）/ 无独立 issue_date 列，落 valid_start
 *   store.validStart  ↔ 表 valid_start
 *   store.validEnd    ↔ 表 valid_end
 *   store.status      ↔ 表 status（draft/pending/active/revoked）
 *   store.batchNo     ↔ 表 batch_no
 *   store.customer    ↔ 表 customer_name
 *   store.product     ↔ 表 product_name
 *   store.sourceNo    ↔ 表 source_no
 *   store.reportNo    ↔ 表 report_no
 *   store.sort        ↔ 表 sort_order
 *   store.owner       ↔ 表 owner
 *   store.variety     ↔ 表 variety
 *   store.stamp       ↔ 表 stamp
 *   store.operator    ↔ 表 operator
 *   store.traceCode   ↔ 表 trace_code
 *   store.qrUrl       ↔ 表 qr_url
 *   store.netWeight   ↔ 表 net_weight
 *   store.grade       ↔ 表 grade
 *   store.conclusion  ↔ 表 conclusion
 *   store.tester      ↔ 表 tester
 *   store.scope       ↔ 表 scope
 *   store.revokeReason↔ 表 revoke_reason
 *
 * 派生/不落库字段（store 有、表无）：
 *   auditLogs（审计日志数组，后续由 sf_operation_log 统一承载）
 *   attachments / topShow / id / createdAt / updatedAt（前端运行时维护）
 */
(function (global) {
  'use strict';

  /* ---------- 通用工具 ---------- */
  function text(v) { return String(v == null ? '' : v).trim(); }
  function num(v, def) { var n = parseFloat(v); return isNaN(n) ? (def === undefined ? 0 : def) : n; }

  /* ============================================================
   * 表行 → store cert 对象（load 用）
   * ============================================================ */

  function rowToCert(row, idx) {
    if (!row) return null;
    var cat = text(row.category) === 'qualification' ? 'qualification' : 'batch';
    return {
      // 前端 id：优先用 cert_no 稳定派生（CERT-Q/CERT-B 前缀），避免依赖自增 id 漂移
      id: cat === 'qualification' ? ('CERT-Q' + pad(idx + 1, 3)) : ('CERT-B' + pad(idx + 1, 3)),
      certNo: row.cert_no,
      category: cat,
      typeCode: row.type_code,
      type: text(row.cert_name) || text(row.cert_type),
      sourceNo: row.source_no,
      issueOrg: row.issuer,
      issueDate: row.valid_start,          // 无独立 issue_date，落 valid_start 兜底
      validStart: row.valid_start,
      validEnd: row.valid_end,
      status: text(row.status) || 'active',
      scope: row.scope,
      owner: row.owner,
      topShow: false,                       // 展示位状态由 store 运行时维护，不落库
      sort: num(row.sort_order, idx + 1),
      batchNo: row.batch_no,
      customer: row.customer_name,
      product: row.product_name,
      variety: row.variety,
      netWeight: row.net_weight,
      grade: row.grade,
      conclusion: row.conclusion,
      tester: row.tester,
      reportNo: row.report_no,
      qrUrl: row.qr_url,
      traceCode: row.trace_code,
      stamp: row.stamp,
      renewNote: row.revoke_reason,        // 复用：驳回原因 / 续期备注
      revokeReason: row.revoke_reason,
      operator: row.operator,
      attachments: [],                     // 附件由前端按 file_id 另行加载，运行时维护
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      auditLogs: [],                       // 审计日志不落库
    };
  }

  /* ============================================================
   * store cert 对象 → 表行（save 用）
   * ============================================================ */

  function certToRow(item) {
    if (!item) return null;
    return {
      cert_no: item.certNo,
      cert_name: item.type,
      cert_type: item.type,
      type_code: item.typeCode,
      subject_type: item.category === 'qualification' ? 'enterprise' : 'batch',
      category: item.category,
      batch_no: item.batchNo,
      issuer: item.issueOrg,
      customer_name: item.customer,
      product_name: item.product,
      net_weight: item.netWeight,
      grade: item.grade,
      conclusion: item.conclusion,
      tester: item.tester,
      scope: item.scope,
      valid_start: item.validStart,
      valid_end: item.validEnd,
      status: item.status,
      revoke_reason: item.revokeReason || item.renewNote,
      issued_by: item.operator,
      source_no: item.sourceNo,
      report_no: item.reportNo,
      sort_order: num(item.sort, 0),
      owner: item.owner,
      variety: item.variety,
      stamp: item.stamp,
      operator: item.operator,
      trace_code: item.traceCode,
      qr_url: item.qrUrl,
    };
  }

  /* ============================================================
   * 聚合转换
   * ============================================================ */

  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }

  /** 表行数组 → store certs 数组 */
  function toAggregate(data) {
    var certs = (data.certs || []).map(function (r, i) { return rowToCert(r, i); });
    return {
      version: 2,
      certs: certs,
      updatedAt: new Date().toISOString(),
    };
  }

  /** store certs 数组 → 表行数组 */
  function fromAggregate(agg) {
    var certs = (agg.certs || []).map(certToRow).filter(Boolean);
    return {
      certs: certs,
      deleted: agg.deleted || {},
    };
  }

  global.CertMapper = {
    rowToCert: rowToCert,
    certToRow: certToRow,
    toAggregate: toAggregate,
    fromAggregate: fromAggregate,
  };
})(window);
