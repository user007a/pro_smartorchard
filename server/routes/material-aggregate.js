/**
 * 农资模块聚合读写接口
 * --------------------------------------------------------------
 *   GET  /api/material/aggregate
 *   POST /api/material/aggregate
 * 单一数组 materials ↔ sf_material_info（唯一键 material_code）。
 */
const express = require('express');
const { query, execute } = require('../config/db');
const { hasSoftDelete, softDeleteByCode } = require('../utils/table-meta');

const router = express.Router();
const TABLE = 'sf_material_info';
const CODE_COL = 'material_code';

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
    const materials = await query('SELECT * FROM `' + TABLE + '`' + where + ' ORDER BY `id` ASC');
    res.json({ ok: true, data: { materials } });
  } catch (e) { next(e); }
});

router.post('/aggregate', async (req, res, next) => {
  const body = req.body || {};
  try {
    let n = 0;
    const rows = body.materials;
    if (Array.isArray(rows)) {
      for (const row of rows) {
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
    const deleted = body.deleted || {};
    if (Array.isArray(deleted.materials)) n += await softDeleteByCode(TABLE, CODE_COL, deleted.materials);
    res.json({ ok: true, data: { summary: { materials: n } } });
  } catch (e) { next(e); }
});

module.exports = router;
