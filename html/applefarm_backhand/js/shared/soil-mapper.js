/**
 * soil-mapper.js — 土壤检测模块「tests ↔ sf_soil_test」映射层
 */
(function (global) {
  'use strict';

  function num(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }

  function rowToTest(row) {
    return {
      id: row.test_code, plotCode: '', sampleDate: row.sample_date ? String(row.sample_date).slice(0, 10) : '',
      lab: row.lab || '', organicMatter: num(row.organic_matter), availableN: num(row.available_n),
      availableP: num(row.available_p), availableK: num(row.available_k), ph: num(row.ph), ec: num(row.ec),
      source: row.source || 'seed', updatedAt: row.updated_at ? String(row.updated_at).slice(0, 19) : '',
    };
  }
  function testToRow(item) {
    return {
      test_code: item.id, sample_date: item.sampleDate || null, lab: item.lab,
      organic_matter: num(item.organicMatter), available_n: num(item.availableN),
      available_p: num(item.availableP), available_k: num(item.availableK), ph: num(item.ph), ec: num(item.ec),
      source: item.source || null,
    };
  }

  function toAggregate(data) { return { tests: (data.tests || []).map(rowToTest) }; }
  function fromAggregate(agg) { return { tests: (agg.tests || []).map(testToRow), deleted: agg.deleted || {} }; }

  global.SoilMapper = { toAggregate: toAggregate, fromAggregate: fromAggregate };
})(window);
