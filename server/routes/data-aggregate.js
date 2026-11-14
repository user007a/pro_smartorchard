/**
 * 数据运营模块聚合读写接口
 * --------------------------------------------------------------
 * 保存策略（V7 修复）：「按业务键 upsert + 显式逻辑删除」（utils/aggregate-sync），
 * 取代旧的「整表 DELETE + 重灌」，保留物理 id / created_at 与未映射列，删除改逻辑删除。
 * 删除由前端 deleted 载荷显式声明，不做「快照缺失即删」（严格模式内存镜像可能不全，会误删）。
 * 表（6 张）：
 *   sf_data_source      sources       键 source_code
 *   sf_data_collection  collections   键 source+category
 *   sf_model_monitor    models        键 model_name
 *   sf_achievement      achievements  键 item_name
 *   sf_milestone        milestones    键 name
 *   sf_highlight        highlights    键 highlight_code
 */
const express = require('express');
const { query } = require('../config/db');
const { hasSoftDelete } = require('../utils/table-meta');
const { syncTable, applyDeletes } = require('../utils/aggregate-sync');

const router = express.Router();

async function fetchAll(table) {
  const where = (await hasSoftDelete(table)) ? ' WHERE `is_deleted` = 0' : '';
  return query('SELECT * FROM `' + table + '`' + where + ' ORDER BY `id` ASC');
}

const TABLES = {
  sources: 'sf_data_source',
  collections: 'sf_data_collection',
  models: 'sf_model_monitor',
  achievements: 'sf_achievement',
  milestones: 'sf_milestone',
  highlights: 'sf_highlight',
};

const KEY_COLUMN = {
  sources: ['source_code'],
  collections: ['source', 'category'],
  models: ['model_name'],
  achievements: ['item_name'],
  milestones: ['name'],
  highlights: ['highlight_code'],
};

router.get('/aggregate', async (req, res, next) => {
  try {
    const results = {};
    await Promise.all(Object.keys(TABLES).map(async (key) => {
      results[key] = await fetchAll(TABLES[key]);
    }));
    res.json({ ok: true, data: results });
  } catch (e) { next(e); }
});

router.post('/aggregate', async (req, res, next) => {
  const body = req.body || {};
  const deleted = body.deleted || {};
  try {
    const summary = {};
    for (const [key, table] of Object.entries(TABLES)) {
      let upserted = 0, del = 0;
      if (Array.isArray(body[key])) upserted = (await syncTable(table, KEY_COLUMN[key], body[key])).upserted;
      if (Array.isArray(deleted[key])) del = await applyDeletes(table, KEY_COLUMN[key], deleted[key]);
      if (upserted || del) summary[key] = { upserted, deleted: del };
    }
    res.json({ ok: true, data: { summary } });
  } catch (e) { next(e); }
});

module.exports = router;