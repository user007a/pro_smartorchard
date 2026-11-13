/**
 * 土壤检测模块聚合读写接口
 * --------------------------------------------------------------
 * tests ↔ sf_soil_test（唯一键 test_code）。
 */
const express = require('express');
const { query, execute } = require('../config/db');
const { hasSoftDelete, softDeleteByCode } = require('../utils/table-meta');

const router = express.Router();
const TABLE = 'sf_soil_test';
const CODE_COL = 'test_code';

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

router.get('/aggregate', async (req, res, next) => {
  try {
    const where = (await hasSoftDelete(TABLE)) ? ' WHERE `is_deleted` = 0' : '';
    const tests = await query('SELECT * FROM `' + TABLE + '`' + where + ' ORDER BY `id` ASC');

    // refs：供前端把 plot_id（外键）解析回地块编号 plot_code。
    // 缺少这一步，前端拿到的记录只有 plot_id，无法与地块台账关联，
    // 会导致「数据已到库但列表查不出来」。
    const plots = await query('SELECT `id`, `code`, `name` FROM `sf_plot` ORDER BY `id` ASC');

    res.json({
      ok: true,
      data: {
        tests,
        refs: {
          plots: plots.map((p) => ({ id: p.id, code: p.code, name: p.name })),
        },
      },
    });
  } catch (e) { next(e); }
});

router.post('/aggregate', async (req, res, next) => {
  const body = req.body || {};
  try {
    let n = 0;
    if (Array.isArray(body.tests)) {
      for (const row of body.tests) {
        const code = norm(row[CODE_COL]);
        if (!code) continue;
        const data = cleanRow(row);
        delete data[CODE_COL];
        const existing = await query('SELECT `id` FROM `' + TABLE + '` WHERE `' + CODE_COL + '` = ? LIMIT 1', [code]);
        if (existing.length) {
          const id = existing[0].id;
          const sets = [], vals = [];
          for (const [k, v] of Object.entries(data)) { sets.push('`' + k + '` = ?'); vals.push(norm(v)); }
          if (await hasSoftDelete(TABLE)) { sets.push('`is_deleted` = ?'); vals.push(0); }
          if (sets.length) { await execute('UPDATE `' + TABLE + '` SET ' + sets.join(', ') + ' WHERE `id` = ?', [...vals, id]); n++; }
        } else {
          const keys = Object.keys(data);
          if (keys.length) {
            await execute('INSERT INTO `' + TABLE + '` (' + keys.map((c) => '`' + c + '`').join(', ') + ', `' + CODE_COL + '`) VALUES (' + keys.map(() => '?').join(', ') + ', ?)', [...keys.map((c) => norm(data[c])), code]);
            n++;
          }
        }
      }
    }
    if (Array.isArray(body.deleted && body.deleted.tests)) n += await softDeleteByCode(TABLE, CODE_COL, body.deleted.tests);
    res.json({ ok: true, data: { summary: { tests: n } } });
  } catch (e) { next(e); }
});

module.exports = router;
