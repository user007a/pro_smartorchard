/**
 * 经营分析模块聚合读写接口
 * --------------------------------------------------------------
 * 保存策略（V7 修复）：「按业务键 upsert + 显式逻辑删除」（utils/aggregate-sync），
 * 取代旧的「整表 DELETE + 重灌」，保留物理 id / created_at 与未映射列，删除改逻辑删除。
 * 删除由前端 deleted 载荷显式声明，不做「快照缺失即删」（严格模式内存镜像可能不全，会误删）。
 * 金额单位：store「万元」↔ 表「元」由 biz-mapper 换算；fiscal_year 恒 '2026'。
 * 表（5 张）：
 *   sf_biz_revenue_mix  revenueMix     键 revenue_type+fiscal_year
 *   sf_cost_item        costStructure  键 cost_name+fiscal_year
 *   sf_plot_profit      baseProfit     键 base_name+fiscal_year
 *   sf_biz_metric       metrics        键 metric_name+fiscal_year
 *   sf_biz_receivable   receivable     键 age_range+customer_name+fiscal_year
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
  revenueMix: 'sf_biz_revenue_mix',
  costStructure: 'sf_cost_item',
  baseProfit: 'sf_plot_profit',
  metrics: 'sf_biz_metric',
  receivable: 'sf_biz_receivable',
};

const KEY_COLUMN = {
  revenueMix: ['revenue_type', 'fiscal_year'],
  costStructure: ['cost_name', 'fiscal_year'],
  baseProfit: ['base_name', 'fiscal_year'],
  metrics: ['metric_name', 'fiscal_year'],
  receivable: ['age_range', 'customer_name', 'fiscal_year'],
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