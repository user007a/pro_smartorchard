/**
 * 商城模块聚合读写接口
 * --------------------------------------------------------------
 * GET  /api/mall/aggregate   一次性拉取商城全部表数据（store load 用）
 * POST /api/mall/aggregate   批量保存（store save 用）
 *
 * 保存策略（V7 修复）：「按业务键 upsert + 显式逻辑删除」（utils/aggregate-sync），
 * 取代旧的「整表 DELETE + 重灌」，避免抹掉 mapper 未回传的列（如会员 password）、
 * 重置自增 id / created_at，并改物理删除为逻辑删除（铁律4）。
 * 删除由前端 deleted 载荷显式声明，不做「快照缺失即删」（严格模式内存镜像可能不全，会误删）。
 * 覆盖表（18 张）见 TABLES；业务键见 KEY_COLUMN。
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

/**
 * 各表业务键（唯一列），数组表示复合键。
 * posts 无业务编号列，用物理 id（mapper 以 _dbId 回传）；
 * carts/addresses/favorites 由 H5 通用 CRUD 维护，store 不提交，故不参与同步。
 */
const KEY_COLUMN = {
  products: ['product_code'],
  promotions: ['promotion_name'],
  coupons: ['coupon_code'],
  claims: ['claim_code'],
  members: ['member_code'],
  orders: ['order_code'],
  afterSales: ['aftersale_code'],
  invoices: ['invoice_code'],
  posts: null,
  categories: ['category_code'],
  varieties: ['variety_code'],
  freight: ['template_name'],
  levelRules: ['level'],
  banners: ['name'],
  notices: ['trigger_scene', 'title'],
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