/**
 * 经营分析模块聚合读写接口
 * --------------------------------------------------------------
 * biz 数据是维护型配置快照（金额万元），采用「全量重建」策略：
 * POST 时清空对应表再重灌（配置数据无历史留存需求）。
 *
 * 表（5 张）：
 *   sf_biz_revenue_mix  revenueMix
 *   sf_cost_item        costStructure
 *   sf_plot_profit      baseProfit
 *   sf_biz_metric       metrics
 *   sf_biz_receivable   receivable.aging + customerRank
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
  revenueMix: 'sf_biz_revenue_mix',
  costStructure: 'sf_cost_item',
  baseProfit: 'sf_plot_profit',
  metrics: 'sf_biz_metric',
  receivable: 'sf_biz_receivable',
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

/** 全量重建：清空表（物理删除）再插入 */
async function rebuildTable(table, rows) {
  const conn = await query('DELETE FROM `' + table + '`'); // 触发连接，确保可执行
  await execute('DELETE FROM `' + table + '`');
  let n = 0;
  for (const row of rows) {
    const data = cleanRow(row);
    const keys = Object.keys(data);
    if (!keys.length) continue;
    await execute(
      'INSERT INTO `' + table + '` (' + keys.map((c) => '`' + c + '`').join(', ') + ') VALUES (' + keys.map(() => '?').join(', ') + ')',
      keys.map((c) => norm(data[c]))
    );
    n++;
  }
  return n;
}

module.exports = router;
