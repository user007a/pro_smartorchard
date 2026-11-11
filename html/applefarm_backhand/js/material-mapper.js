/**
 * material-mapper.js — 农资模块「store materials ↔ sf_material_info」映射层
 */
(function (global) {
  'use strict';

  function num(v, def) { var n = parseFloat(v); return isNaN(n) ? (def === undefined ? 0 : def) : n; }
  function nval(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }

  function rowToMaterial(row) {
    return {
      code: row.material_code, name: row.material_name,
      type: row.material_type, typeName: row.type_name || row.material_type,
      spec: row.spec || '', unit: row.unit || '',
      warehouse: row.warehouse_name || '', warehouseCode: row.warehouse_code || '',
      safety: num(row.safety_stock), stock: num(row.current_stock),
      dailyUse: num(row.daily_use), leadDays: num(row.lead_days),
    };
  }
  function materialToRow(item) {
    return {
      material_code: item.code, material_name: item.name,
      material_type: item.type, type_name: item.typeName || item.type,
      spec: item.spec, unit: item.unit,
      warehouse_name: item.warehouse, warehouse_code: item.warehouseCode,
      safety_stock: nval(item.safety), current_stock: nval(item.stock),
      daily_use: nval(item.dailyUse), lead_days: nval(item.leadDays),
    };
  }

  function toAggregate(data) {
    return { materials: (data.materials || []).map(rowToMaterial) };
  }
  function fromAggregate(agg) {
    return { materials: (agg.materials || []).map(materialToRow), deleted: agg.deleted || {} };
  }

  global.MaterialMapper = { toAggregate: toAggregate, fromAggregate: fromAggregate };
})(window);
