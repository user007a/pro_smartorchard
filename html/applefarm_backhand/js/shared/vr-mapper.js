/**
 * vr-mapper.js — VR全景模块「scenes ↔ sf_vr_scene」映射层
 */
(function (global) {
  'use strict';

  function num(v, def) { var n = parseFloat(v); return isNaN(n) ? (def === undefined ? 0 : def) : n; }
  function nval(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
  function dstr(v) { return v ? String(v).replace('T', ' ').slice(0, 19) : ''; }
  function ddstr(v) { return v ? String(v).slice(0, 10) : ''; }

  function rowToScene(row) {
    return {
      id: row.scene_code || String(row.id), code: row.scene_code,
      name: row.name, base: row.base_name || '', plotCode: row.plot_code || '', plotName: row.plot_name || '',
      type: row.scene_type, status: row.scene_status, image: row.image || '',
      date: ddstr(row.shot_date), resolution: row.resolution || '', desc: row.desc || '',
      views: num(row.views),
    };
  }
  function sceneToRow(item) {
    return {
      scene_code: item.code || item.id, name: item.name, base_name: item.base || null,
      plot_code: item.plotCode || null, plot_name: item.plotName || null,
      scene_type: item.type, scene_status: item.status, image: item.image || null,
      resolution: item.resolution || null, 'desc': item.desc || null,
      views: nval(item.views), shot_date: item.date || null,
    };
  }

  function toAggregate(data) { return { scenes: (data.scenes || []).map(rowToScene) }; }
  function fromAggregate(agg) { return { scenes: (agg.scenes || []).map(sceneToRow), deleted: agg.deleted || {} }; }

  global.VrMapper = { toAggregate: toAggregate, fromAggregate: fromAggregate };
})(window);
