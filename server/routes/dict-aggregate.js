/**
 * 数据字典聚合读写接口
 * --------------------------------------------------------------
 * 字典（sf_dict，唯一键 dict_code）由后台「系统设置 › 数据字典」维护，
 * 并被各端枚举消费（移动端农事类型九宫格读 FARMING_TYPE、通知类型/状态读
 * NOTICE_TYPE / NOTICE_STATUS）。
 *
 *   GET  /api/dict/aggregate   读取全部字典
 *   POST /api/dict/aggregate   按 dict_code upsert + 显式逻辑删除
 *
 * 为何不用通用 CRUD 写：
 *   通用 CRUD 的 POST 是纯 INSERT，而 dict_code 上有唯一键。字典被逻辑删除后
 *   该行仍在表里（铁律 6：一律逻辑删除），再建同编码会撞唯一键
 *   （ER_DUP_ENTRY）→ 同一编码被删后永远无法重建。
 *   本接口按 dict_code 做 upsert：命中已软删行时自动复活（is_deleted 归 0），
 *   语义与 utils/aggregate-sync 既有聚合路由一致。
 */
const express = require('express');
const { query } = require('../config/db');
const { hasSoftDelete } = require('../utils/table-meta');
const { syncTable, applyDeletes } = require('../utils/aggregate-sync');

const router = express.Router();
const TABLE = 'sf_dict';
const KEY_COLUMN = ['dict_code'];

router.get('/aggregate', async (req, res, next) => {
  try {
    const where = (await hasSoftDelete(TABLE)) ? ' WHERE `is_deleted` = 0' : '';
    const dicts = await query('SELECT * FROM `' + TABLE + '`' + where + ' ORDER BY `id` ASC');
    res.json({ ok: true, data: { dicts } });
  } catch (e) { next(e); }
});

router.post('/aggregate', async (req, res, next) => {
  const body = req.body || {};
  try {
    let upserted = 0;
    let deleted = 0;
    if (Array.isArray(body.dicts)) {
      // dict_code 是唯一键且为业务键，缺编码的行无法定位，一律跳过（避免脏行入库）
      const rows = body.dicts.filter((r) => r && String(r.dict_code || '').trim() !== '');
      upserted = (await syncTable(TABLE, KEY_COLUMN, rows)).upserted;
    }
    const del = body.deleted && body.deleted.dicts;
    if (Array.isArray(del)) {
      deleted = await applyDeletes(TABLE, KEY_COLUMN, del);
    }
    res.json({ ok: true, data: { summary: { dicts: { upserted, deleted } } } });
  } catch (e) { next(e); }
});

module.exports = router;
