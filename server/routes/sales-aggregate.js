/**
 * 销售模块聚合读写接口
 * --------------------------------------------------------------
 *   GET  /api/sales/aggregate   一次性拉取销售模块全部表数据
 *   POST /api/sales/aggregate   批量保存（按表拆分 upsert / 删除）
 *
 * 覆盖表（9 张）：见 TABLE_CONFIG。
 */
const express = require('express');
const { query, execute } = require('../config/db');
const { hasSoftDelete, softDeleteByCode } = require('../utils/table-meta');

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

const TABLE_CONFIG = {
  customers:    { table: 'sf_sales_customer',     codeCol: 'customer_code' },
  orders:       { table: 'sf_sales_order',        codeCol: 'order_code' },
  payments:     { table: 'sf_sales_receipt',      codeCol: 'receipt_code' },
  shipments:    { table: 'sf_sales_shipment',     codeCol: 'shipment_code' },
  afterSales:   { table: 'sf_sales_aftersale',    codeCol: 'aftersale_code' },
  pricePolicies:{ table: 'sf_sales_price_policy', codeCol: 'policy_code' },
  promotions:   { table: 'sf_sales_promotion',    codeCol: 'promotion_code' },
  targets:      { table: 'sf_sales_target',       codeCol: 'target_code' },
  statements:   { table: 'sf_sales_statement',    codeCol: 'statement_code' },
};

router.get('/aggregate', async (req, res, next) => {
  try {
    const results = {};
    await Promise.all(Object.keys(TABLE_CONFIG).map(async (key) => {
      results[key] = await fetchAll(TABLE_CONFIG[key].table);
    }));
    res.json({ ok: true, data: results });
  } catch (e) { next(e); }
});

router.post('/aggregate', async (req, res, next) => {
  const body = req.body || {};
  try {
    const summary = {};
    for (const [key, cfg] of Object.entries(TABLE_CONFIG)) {
      const rows = body[key];
      if (Array.isArray(rows) && rows.length) {
        summary[key] = await upsertByCode(cfg.table, cfg.codeCol, rows);
      }
    }
    summary.deleted = await applyDeletes(body.deleted || {});
    res.json({ ok: true, data: { summary } });
  } catch (e) { next(e); }
});

async function upsertByCode(table, codeCol, rows) {
  let n = 0;
  for (const row of rows) {
    const code = norm(row[codeCol]);
    if (!code) continue;
    const data = cleanRow(row);
    delete data[codeCol];
    const existing = await query('SELECT `id` FROM `' + table + '` WHERE `' + codeCol + '` = ? LIMIT 1', [code]);
    if (existing.length) {
      const id = existing[0].id;
      const sets = [], vals = [];
      for (const [k, v] of Object.entries(data)) { sets.push('`' + k + '` = ?'); vals.push(norm(v)); }
      if (await hasSoftDelete(table)) { sets.push('`is_deleted` = ?'); vals.push(0); }
      if (sets.length) { await execute('UPDATE `' + table + '` SET ' + sets.join(', ') + ' WHERE `id` = ?', [...vals, id]); n++; }
    } else {
      const keys = Object.keys(data);
      if (keys.length) {
        await execute('INSERT INTO `' + table + '` (' + keys.map((c) => '`' + c + '`').join(', ') + ', `' + codeCol + '`) VALUES (' + keys.map(() => '?').join(', ') + ', ?)', [...keys.map((c) => norm(data[c])), code]);
        n++;
      }
    }
  }
  return n;
}

async function applyDeletes(deleted) {
  let n = 0;
  for (const [key, codes] of Object.entries(deleted)) {
    const cfg = TABLE_CONFIG[key];
    if (!cfg || !Array.isArray(codes) || !codes.length) continue;
    n += await softDeleteByCode(cfg.table, cfg.codeCol, codes);
  }
  return n;
}

module.exports = router;
