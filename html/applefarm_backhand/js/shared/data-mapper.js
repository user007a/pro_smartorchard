/**
 * data-mapper.js — 数据运营模块「store 子集合 ↔ 表」映射层
 * --------------------------------------------------------------
 * 入库：sources/collections/models/achievements/milestones/highlights
 * 派生不入库：collectionTrend/modelCalls/coverage/ops
 */
(function (global) {
  'use strict';

  function num(v, def) { var n = parseFloat(v); return isNaN(n) ? (def === undefined ? 0 : def) : n; }
  function nval(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
  function dstr(v) { return v ? String(v).replace('T', ' ').slice(0, 19) : ''; }

  /* ---------- 数据源 ---------- */
  function rowToSource(row) {
    return {
      id: row.source_code || row.name, name: row.name, type: row.type, protocol: row.protocol,
      endpoint: row.address, freq: row.frequency, status: row.status, statusText: '',
      updatedAt: dstr(row.updated_at), lastHeartbeatAt: dstr(row.heartbeat),
    };
  }
  function sourceToRow(item) {
    return {
      source_code: item.id, name: item.name, type: item.type, protocol: item.protocol,
      address: item.endpoint, frequency: item.freq, status: item.status, heartbeat: item.lastHeartbeatAt || null,
    };
  }

  /* ---------- 归集统计 ---------- */
  function rowToCollection(row) {
    return {
      id: row.category || row.source, source: row.source, amount: num(row.collect_amount),
      yoy: num(row.yoy), rate: num(row.qualified_rate), category: row.category || row.source,
    };
  }
  function collectionToRow(item) {
    return {
      source: item.source, collect_amount: nval(item.amount), qualified_rate: nval(item.rate),
      yoy: nval(item.yoy), category: item.category || item.source,
    };
  }

  /* ---------- 模型监控 ---------- */
  function rowToModel(row) {
    return {
      id: row.model_name, name: row.model_name, calls: num(row.call_count), hitRate: num(row.hit_rate),
      response: num(row.response_time), version: row.version, status: row.status, statusText: '',
    };
  }
  function modelToRow(item) {
    return {
      model_name: item.name, version: item.version, call_count: nval(item.calls),
      hit_rate: nval(item.hitRate), response_time: item.response != null ? String(item.response) : null,
      status: item.status,
    };
  }

  /* ---------- 成效 ---------- */
  function rowToAchievement(row) {
    return {
      id: row.item_name, item: row.item_name, before: num(row.before_value), after: num(row.after_value),
      unit: row.unit, delta: num(row.change_range), desc: row.description,
    };
  }
  function achievementToRow(item) {
    return {
      item_name: item.item, before_value: item.before != null ? String(item.before) : null,
      after_value: item.after != null ? String(item.after) : null,
      change_range: item.delta != null ? String(item.delta) : null, unit: item.unit, description: item.desc,
    };
  }

  /* ---------- 里程碑 ---------- */
  function rowToMilestone(row) {
    return { id: row.name, date: row.milestone_date, title: row.name, desc: row.description, status: row.status || 'done' };
  }
  function milestoneToRow(item) {
    return { name: item.title, milestone_date: item.date, description: item.desc, status: item.status || 'done' };
  }

  /* ---------- 亮点 ---------- */
  function rowToHighlight(row) {
    return { id: row.highlight_code || row.item, item: row.item, value: num(row.value), unit: row.unit, desc: row.description };
  }
  function highlightToRow(item) {
    return { highlight_code: item.id, item: item.item, value: item.value != null ? String(item.value) : null, unit: item.unit, description: item.desc };
  }

  function toAggregate(data) {
    return {
      sources: (data.sources || []).map(rowToSource),
      collections: (data.collections || []).map(rowToCollection),
      models: (data.models || []).map(rowToModel),
      achievements: (data.achievements || []).map(rowToAchievement),
      milestones: (data.milestones || []).map(rowToMilestone),
      highlights: (data.highlights || []).map(rowToHighlight),
    };
  }
  function fromAggregate(agg) {
    return {
      sources: (agg.sources || []).map(sourceToRow),
      collections: (agg.collections || []).map(collectionToRow),
      models: (agg.models || []).map(modelToRow),
      achievements: (agg.achievements || []).map(achievementToRow),
      milestones: (agg.milestones || []).map(milestoneToRow),
      highlights: (agg.highlights || []).map(highlightToRow),
      deleted: agg.deleted || {},
    };
  }

  global.DataMapper = { toAggregate: toAggregate, fromAggregate: fromAggregate };
})(window);
