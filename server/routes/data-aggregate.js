/**
 * 数据运营模块聚合读写接口
 * --------------------------------------------------------------
 * data 数据是维护型配置快照，采用「全量重建」策略。
 * 表（6 张）：
 *   sf_data_source      sources
 *   sf_data_collection  collections
 *   sf_model_monitor    models
 *   sf_achievement      achievements
 *   sf_milestone        milestones
 *   sf_highlight        highlights
 */
const express = require('express');
const { query, execute } = require('../config/db');
const { hasSoftDelete } = require('../utils/table-meta');

const router = express.Router();

function norm(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  return v;
}
function cleanRow(row) {
  const data = { ...row };
  delete data.id;
  delete data.created_at;
  delete data.updated_at;
  delete data.is_deleted;
  return data;
}
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
  try {
    const summary = {};
    for (const [key, table] of Object.entries(TABLES)) {
      const rows = body[key];
      if (!Array.isArray(rows) || !rows.length) continue;
      summary[key] = await rebuildTable(table, rows);
    }
    res.json({ ok: true, data: { summary } });
  } catch (e) { next(e); }
});

async function rebuildTable(table, rows) {
  await execute('DELETE FROM `' + table + '`');
  let n = 0;
  for (const row of rows) {
    const data = cleanRow(row);
    const keys = Object.keys(data);
    if (!keys.length) continue;
    await execute('INSERT INTO `' + table + '` (' + keys.map((c) => '`' + c + '`').join(', ') + ') VALUES (' + keys.map(() => '?').join(', ') + ')', keys.map((c) => norm(data[c])));
    n++;
  }
  return n;
}

module.exports = router;
