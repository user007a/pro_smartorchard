/**
 * soil-mapper.js — 土壤检测模块「tests ↔ sf_soil_test」映射层
 * --------------------------------------------------------------
 * 后端表 sf_soil_test 的地块字段是外键 plot_id（指向 sf_plot.id），
 * 前端 store 需要的却是地块编号 plot_code。两者必须经 refs 字典换算，
 * 否则前端拿到的记录挂不上地块台账，列表会出现「库里有数据、页面查不到」。
 *
 * refs 由 /api/soil/aggregate 一并下发：{ plots: [{ id, code, name }] }
 */
(function (global) {
  'use strict';

  function num(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }

  /** 外键解析上下文：plot_id ↔ plot_code */
  function buildContext(refs) {
    var ctx = { plotCodeById: {}, plotIdByCode: {} };
    (refs && refs.plots || []).forEach(function (p) {
      if (p.id === undefined || p.id === null) return;
      ctx.plotCodeById[String(p.id)] = p.code || '';
      if (p.code) ctx.plotIdByCode[p.code] = p.id;
    });
    return ctx;
  }

  /** 地块编号：优先取后端快照里的 plot_code，其次用 refs 反查 */
  function resolvePlotCode(row, ctx) {
    if (row.plot_code) return String(row.plot_code);
    if (row.plot_id === undefined || row.plot_id === null) return '';
    return (ctx && ctx.plotCodeById[String(row.plot_id)]) || '';
  }

  function rowToTest(row, ctx) {
    return {
      id: row.test_code,
      plotCode: resolvePlotCode(row, ctx),
      sampleDate: row.sample_date ? String(row.sample_date).slice(0, 10) : '',
      lab: row.lab || '', organicMatter: num(row.organic_matter), availableN: num(row.available_n),
      availableP: num(row.available_p), availableK: num(row.available_k), ph: num(row.ph), ec: num(row.ec),
      source: row.source || 'seed', updatedAt: row.updated_at ? String(row.updated_at).slice(0, 19) : '',
    };
  }
  function testToRow(item, ctx) {
    var row = {
      test_code: item.id, sample_date: item.sampleDate || null, lab: item.lab,
      organic_matter: num(item.organicMatter), available_n: num(item.availableN),
      available_p: num(item.availableP), available_k: num(item.availableK), ph: num(item.ph), ec: num(item.ec),
      source: item.source || null,
    };
    // 落库时把地块编号换算回外键 plot_id
    if (item.plotCode) {
      if (ctx && ctx.plotIdByCode[item.plotCode] !== undefined) {
        row.plot_id = ctx.plotIdByCode[item.plotCode];
      } else {
        row.plot_id = null;
      }
    }
    return row;
  }

  function toAggregate(data) {
    var ctx = buildContext(data && data.refs);
    return { tests: (data.tests || []).map(function (r) { return rowToTest(r, ctx); }) };
  }
  function fromAggregate(agg) {
    var ctx = buildContext(agg && agg.refs);
    return {
      tests: (agg.tests || []).map(function (i) { return testToRow(i, ctx); }),
      deleted: agg.deleted || {},
    };
  }

  global.SoilMapper = {
    toAggregate: toAggregate,
    fromAggregate: fromAggregate,
    buildContext: buildContext,
  };
})(window);
