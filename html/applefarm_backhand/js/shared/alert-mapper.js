/**
 * alert-mapper.js — 预警管理模块「alerts/rules ↔ sf_alert_record/sf_alert_rule」映射层
 */
(function (global) {
  'use strict';

  function num(v, def) { var n = parseFloat(v); return isNaN(n) ? (def === undefined ? 0 : def) : n; }
  function nval(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
  function dstr(v) { return v ? String(v).replace('T', ' ').slice(0, 19) : ''; }
  function b2i(v) { return v ? 1 : 0; }
  function i2b(v) { return v === 1 || v === '1' || v === true; }
  function jparse(v, def) { try { return v ? JSON.parse(v) : def; } catch (e) { return def; } }

  /* ---------- 预警记录 ---------- */
  function rowToAlert(row) {
    return {
      id: row.dedupe_key || row.alert_title, type: row.alert_type, title: row.alert_title,
      level: row.level, levelText: row.level, location: row.location || '',
      time: dstr(row.alert_time), status: row.status, statusText: row.status,
      desc: row.remark || '', srcType: row.category || '', srcTypeText: row.category || '',
      history: jparse(row.history, []),
      threshold: jparse(row.threshold, {}),
      respondDue: dstr(row.response_deadline), handleDue: dstr(row.handle_deadline),
      category: row.category || '', source: row.source || '', base: '', plot: '', plotSlot: '',
      plotCode: row.plot_ids || '', assignee: row.assignee || '', operator: row.operator || '',
      escalated: i2b(row.escalated), targetType: row.target_type || '', targetId: row.target_id || '',
      ruleId: row.rule_id || '', dedupeKey: row.dedupe_key || '',
      value: row.current_value || '', deviceId: row.device_id ? String(row.device_id) : '', device: row.device_name || '',
      acceptedAt: dstr(row.accepted_at), closedAt: dstr(row.closed_at),
    };
  }
  function alertToRow(item) {
    return {
      alert_title: item.title, dedupe_key: item.dedupeKey || item.id || null, rule_id: item.ruleId || null,
      source: item.source || 'model', category: item.category || item.srcType || null, alert_type: item.type,
      level: item.level, device_name: item.device || null,
      location: item.location || null, plot_ids: item.plotCode || item.plot || null,
      threshold: item.threshold ? JSON.stringify(item.threshold) : null, current_value: item.value || null,
      alert_time: item.time || null, status: item.status,
      response_deadline: item.respondDue || null, handle_deadline: item.handleDue || null,
      handle_action: null, remark: item.desc || null,
      history: item.history ? JSON.stringify(item.history) : null,
      assignee: item.assignee || null, operator: item.operator || null,
      accepted_at: item.acceptedAt || null, closed_at: item.closedAt || null,
      escalated: b2i(item.escalated), target_type: item.targetType || null, target_id: item.targetId || null,
    };
  }

  /* ---------- 规则 ---------- */
  function rowToRule(row) {
    return {
      id: row.rule_code, code: row.rule_code, name: row.rule_name,
      source: row.source, category: row.category, level: row.level, levelText: row.level,
      threshold: jparse(row.threshold, {}),
      scope: { type: row.scope || 'all', ids: [] },
      notify: jparse(row.notify_way, {}),
      assignees: jparse(row.assignees, []),
      respondSla: row.response_deadline || '', handleSla: row.handle_deadline || '',
      escalateTo: row.escalate_to || '', status: row.enabled === 1 ? 'active' : 'inactive',
      statusText: row.enabled === 1 ? '启用' : '停用', desc: row.desc || '',
    };
  }
  function ruleToRow(item) {
    return {
      rule_code: item.code || item.id, rule_name: item.name,
      source: item.source, category: item.category, level: item.level,
      threshold: item.threshold ? JSON.stringify(item.threshold) : null,
      scope: (item.scope && item.scope.type) || 'all',
      response_deadline: item.respondSla || null, handle_deadline: item.handleSla || null,
      notify_way: item.notify ? JSON.stringify(item.notify) : null,
      assignees: item.assignees ? JSON.stringify(item.assignees) : null,
      escalate_to: item.escalateTo || null, desc: item.desc || null,
      enabled: item.status === 'inactive' ? 0 : 1,
    };
  }

  /* ---------- 预警报告 ---------- */
  function rowToReport(row) {
    return {
      id: row.report_code || row.report_name, title: row.report_name, type: row.report_type,
      typeText: row.type_text || row.report_type, time: dstr(row.generate_time),
      base: row.base_ids || '', author: row.generator || '',
      statDevice: String(row.stat_device || 0), statFarming: String(row.stat_farming || 0),
      statUrgent: String(row.stat_urgent || 0), statRate: row.stat_rate || '',
      overview: row.overview || row.content || '', deviceDetail: row.device_detail || '',
      farmingDetail: row.farming_detail || '', suggestion: row.suggestion || '',
    };
  }
  function reportToRow(item) {
    return {
      report_code: item.id, report_name: item.title, report_type: item.type,
      type_text: item.typeText || null, base_ids: item.base || null,
      generator: item.author || null, generate_time: item.time || null,
      stat_device: parseInt(item.statDevice, 10) || 0, stat_farming: parseInt(item.statFarming, 10) || 0,
      stat_urgent: parseInt(item.statUrgent, 10) || 0, stat_rate: item.statRate || null,
      overview: item.overview || null, device_detail: item.deviceDetail || null,
      farming_detail: item.farmingDetail || null, suggestion: item.suggestion || null,
    };
  }

  function toAggregate(data) {
    return {
      alerts: (data.alerts || []).map(rowToAlert),
      rules: (data.rules || []).map(rowToRule),
      reports: (data.reports || []).map(rowToReport),
    };
  }
  function fromAggregate(agg) {
    return {
      alerts: (agg.alerts || []).map(alertToRow),
      rules: (agg.rules || []).map(ruleToRow),
      reports: (agg.reports || []).map(reportToRow),
      deleted: agg.deleted || {},
    };
  }

  global.AlertMapper = { toAggregate: toAggregate, fromAggregate: fromAggregate };
})(window);
