/**
 * 溯源展示环节聚合读写接口
 * --------------------------------------------------------------
 * 环节（sf_trace_stage，唯一键 stage_code）由后台「溯源配置 › C 端展示配置」维护，
 * C 端溯源列表页（trace_h5.html）与详情页（h5_trace_detail.html）均读本表。
 *
 *   GET  /api/trace-stage/aggregate   读取全部环节
 *   POST /api/trace-stage/aggregate   按 stage_code upsert + 显式逻辑删除
 *
 * 为何不用通用 CRUD 写：
 *   通用 CRUD 的 POST 是纯 INSERT，而 stage_code 上有唯一键（uk_trace_stage_code）。
 *   环节被逻辑删除后该行仍在表里（铁律 6：一律逻辑删除），再建同编码会撞唯一键
 *   （ER_DUP_ENTRY）→ 同一编码被删后永远无法重建。
 *   本接口按 stage_code 做 upsert：命中已软删行时自动复活（is_deleted 归 0），
 *   语义与 utils/aggregate-sync 既有聚合路由一致。
 */
const express = require('express');
const { query } = require('../config/db');
const { hasSoftDelete } = require('../utils/table-meta');
const { syncTable, applyDeletes } = require('../utils/aggregate-sync');

const router = express.Router();
const TABLE = 'sf_trace_stage';
const KEY_COLUMN = ['stage_code'];

/* 允许写入的列白名单：防止前端提交任意列（含公共字段） */
const WRITABLE_COLS = new Set([
  'stage_code', 'stage_name', 'stage_icon', 'stage_desc', 'stage_detail',
  'stage_operator', 'stage_location', 'stage_tags', 'stage_img', 'day_offset',
  'sort_order', 'status',
]);

function cleanRow(row) {
  const data = {};
  for (const [k, v] of Object.entries(row || {})) {
    if (WRITABLE_COLS.has(k)) data[k] = v;
  }
  return data;
}

router.get('/aggregate', async (req, res, next) => {
  try {
    const where = (await hasSoftDelete(TABLE)) ? ' WHERE `is_deleted` = 0' : '';
    const stages = await query('SELECT * FROM `' + TABLE + '`' + where + ' ORDER BY `id` ASC');
    res.json({ ok: true, data: { stages } });
  } catch (e) { next(e); }
});

router.post('/aggregate', async (req, res, next) => {
  const body = req.body || {};
  try {
    let upserted = 0;
    let deleted = 0;
    if (Array.isArray(body.stages)) {
      // stage_code 是唯一键且为业务键，缺编码的行无法定位，一律跳过（避免脏行入库）
      const rows = body.stages
        .map(cleanRow)
        .filter((r) => String(r.stage_code || '').trim() !== '');
      upserted = (await syncTable(TABLE, KEY_COLUMN, rows)).upserted;
    }
    const del = body.deleted && body.deleted.stages;
    if (Array.isArray(del)) {
      deleted = await applyDeletes(TABLE, KEY_COLUMN, del);
    }
    res.json({ ok: true, data: { summary: { stages: { upserted, deleted } } } });
  } catch (e) { next(e); }
});

module.exports = router;
