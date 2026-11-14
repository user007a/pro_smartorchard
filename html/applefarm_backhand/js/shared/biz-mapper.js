/**
 * biz-mapper.js — 经营分析模块「store 对象 ↔ 5 张表」映射层
 * --------------------------------------------------------------
 * 覆盖表：
 *   sf_biz_revenue_mix  ↔ revenueMix
 *   sf_cost_item        ↔ costStructure
 *   sf_plot_profit      ↔ baseProfit
 *   sf_biz_metric       ↔ metrics
 *   sf_biz_receivable   ↔ receivable.aging + customerRank
 * 金额单位：store「万元」↔ 表「元」，映射时 ×10000。
 * 派生不入库：revenueTrend/channelMix/yearly/adoption/summary 标量。
 */
(function (global) {
  'use strict';

  function text(v) { return String(v == null ? '' : v).trim(); }
  function num(v, def) { var n = parseFloat(v); return isNaN(n) ? (def === undefined ? 0 : def) : n; }
  function wan2yuan(v) { var n = parseFloat(v); return isNaN(n) ? null : Math.round(n * 10000); }
  function yuan2wan(v) { var n = parseFloat(v); return isNaN(n) ? 0 : Math.round(n / 100) / 100; }

  /* ---------- 收入构成 ---------- */
  function rowToRevenueMix(row) {
    return {
      name: row.revenue_type, value: yuan2wan(row.amount), ratio: num(row.ratio),
      channel: row.channel_desc || '',
    };
  }
  function revenueMixToRow(item) {
    return { revenue_type: item.name, amount: wan2yuan(item.value), ratio: num(item.ratio), channel_desc: item.channel, fiscal_year: '2026' };
  }

  /* ---------- 成本结构 ---------- */
  function rowToCostItem(row) {
    return { name: row.cost_name, value: yuan2wan(row.amount), ratio: num(row.ratio) };
  }
  function costItemToRow(item) {
    return { cost_name: item.name, amount: wan2yuan(item.value), ratio: num(item.ratio), fiscal_year: '2026' };
  }

  /* ---------- 基地利润 ---------- */
  function rowToBaseProfit(row) {
    return {
      base: row.base_name || '', profit: yuan2wan(row.profit), revenue: yuan2wan(row.revenue),
      cost: yuan2wan(row.cost), rate: num(row.rate),
    };
  }
  function baseProfitToRow(item) {
    return { base_name: item.base, profit: wan2yuan(item.profit), revenue: wan2yuan(item.revenue), cost: wan2yuan(item.cost), rate: num(item.rate), fiscal_year: '2026' };
  }

  /* ---------- 经营指标 ---------- */
  function rowToMetric(row) {
    return { name: row.metric_name, value: num(row.current_value), unit: row.unit || '', qoq: num(row.change_rate), better: row.better_direction || 'up' };
  }
  function metricToRow(item) {
    return { metric_name: item.name, current_value: item.value != null ? String(item.value) : null, unit: item.unit, change_rate: item.qoq != null ? String(item.qoq) : null, better_direction: item.better, fiscal_year: '2026' };
  }

  /* ---------- 应收账款（aging + customerRank 合并） ---------- */
  function rowsToReceivable(rows) {
    var aging = [];
    var rank = [];
    rows.forEach(function (r) {
      if (r.age_range) {
        aging.push({ name: r.age_range, value: yuan2wan(r.amount), ratio: 0 });
      } else {
        rank.push({ rank: 0, name: r.customer_name, amount: yuan2wan(r.amount), type: r.customer_type || '' });
      }
    });
    return { aging: aging, rank: rank };
  }
  function receivableToRows(recv) {
    var rows = [];
    (recv.aging || []).forEach(function (a) {
      rows.push({ age_range: a.name, customer_name: '', customer_type: null, amount: wan2yuan(a.value), fiscal_year: '2026' });
    });
    (recv.rank || []).forEach(function (r) {
      rows.push({ age_range: null, customer_name: r.name, customer_type: r.type, amount: wan2yuan(r.amount), fiscal_year: '2026' });
    });
    return rows;
  }

  /* ---------- 聚合转换 ---------- */
  function toAggregate(data) {
    var agg = {
      revenueMix: (data.revenueMix || []).map(rowToRevenueMix),
      costStructure: (data.costStructure || []).map(rowToCostItem),
      baseProfit: (data.baseProfit || []).map(rowToBaseProfit),
      metrics: (data.metrics || []).map(rowToMetric),
    };
    var recv = rowsToReceivable(data.receivable || []);
    agg.receivable = {
      aging: recv.aging,
      balance: 0, over60: 0, turnoverDays: 0, badDebt: 0,
    };
    agg.customerRank = recv.rank;
    return agg;
  }

  function fromAggregate(agg) {
    return {
      revenueMix: (agg.revenueMix || []).map(revenueMixToRow),
      costStructure: (agg.costStructure || []).map(costItemToRow),
      baseProfit: (agg.baseProfit || []).map(baseProfitToRow),
      metrics: (agg.metrics || []).map(metricToRow),
      receivable: receivableToRows({ aging: (agg.receivable && agg.receivable.aging) || [], rank: agg.customerRank || [] }),
      deleted: agg.deleted || {},
    };
  }

  global.BizMapper = { toAggregate: toAggregate, fromAggregate: fromAggregate };
})(window);
