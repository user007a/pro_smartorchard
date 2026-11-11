/**
 * model-mapper.js — 模型中心模块「6 模型快照 ↔ sf_model_config」映射层
 * --------------------------------------------------------------
 * 策略：每个模型对象整体序列化为 snapshot_json 存一行（model_code=key）。
 */
(function (global) {
  'use strict';

  function rowToModel(row) {
    var snap = null;
    try { snap = row.snapshot_json ? JSON.parse(row.snapshot_json) : null; } catch (e) { snap = null; }
    return snap;
  }
  function modelToRow(key, item) {
    return {
      model_code: key,
      model_name: (item && item.name) || key,
      enabled: 1,
      snapshot_json: JSON.stringify(item),
    };
  }

  function toAggregate(data) {
    var models = {};
    (data.models || []).forEach(function (row) {
      var snap = rowToModel(row);
      if (snap && snap.key) models[snap.key] = snap;
    });
    return models;
  }
  function fromAggregate(models) {
    var rows = [];
    Object.keys(models || {}).forEach(function (key) {
      rows.push(modelToRow(key, models[key]));
    });
    return rows;
  }

  global.ModelMapper = { toAggregate: toAggregate, fromAggregate: fromAggregate };
})(window);
