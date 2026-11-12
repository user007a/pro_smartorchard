/**
 * 商城模块聚合读写接口
 * --------------------------------------------------------------
 * mall 数据采用「全量重建」策略（POST 清空表再重灌），避免复杂唯一键。
 * 覆盖表（19 张）见 TABLES。
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
  products: 'sf_mall_product',
  promotions: 'sf_mall_promotion',
  coupons: 'sf_mall_coupon',
  claims: 'sf_mall_coupon_claim',
  members: 'sf_mall_member',
  orders: 'sf_mall_order',
  afterSales: 'sf_mall_aftersale',
  invoices: 'sf_mall_invoice',
  posts: 'sf_mall_post',
  categories: 'sf_mall_category',
  varieties: 'sf_mall_variety',
  freight: 'sf_mall_freight',
  levelRules: 'sf_mall_level_rule',
  banners: 'sf_mall_banner',
  notices: 'sf_mall_notice',
  carts: 'sf_mall_cart',
  addresses: 'sf_mall_address',
  favorites: 'sf_mall_favorite',
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
    await execute(
      'INSERT INTO `' + table + '` (' + keys.map((c) => '`' + c + '`').join(', ') + ') VALUES (' + keys.map(() => '?').join(', ') + ')',
      keys.map((c) => norm(data[c]))
    );
    n++;
  }
  return n;
}

module.exports = router;
