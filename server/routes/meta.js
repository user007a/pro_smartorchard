/**
 * 元数据路由
 * --------------------------------------------------------------
 * 提供字典、菜单、下拉联动等轻量元数据接口。
 *
 *   GET /api/meta/dicts                    全部字典
 *   GET /api/meta/dicts/:dictCode          单个字典（按编码）
 *   GET /api/meta/menus                    菜单树（后台导航）
 */
const express = require('express');
const { query } = require('../config/db');

const router = express.Router();

// 全部字典
router.get('/dicts', async (req, res, next) => {
  try {
    const rows = await query(
      'SELECT * FROM `sf_dict` WHERE `is_deleted` = 0 AND `dict_status` = \'active\' ORDER BY `sort_order` ASC'
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    next(e);
  }
});

// 单个字典
router.get('/dicts/:dictCode', async (req, res, next) => {
  try {
    const rows = await query(
      'SELECT * FROM `sf_dict` WHERE `dict_code` = ? AND `is_deleted` = 0',
      [req.params.dictCode]
    );
    if (!rows.length) return res.status(404).json({ ok: false, message: '字典不存在' });
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    next(e);
  }
});

// 菜单列表（后台导航）
router.get('/menus', async (req, res, next) => {
  try {
    const rows = await query(
      'SELECT * FROM `sf_menu` WHERE `is_deleted` = 0 AND `menu_status` = \'normal\' ORDER BY `sort_order` ASC'
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
