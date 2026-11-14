/**
 * 系统通知模块聚合读写接口
 * --------------------------------------------------------------
 * notices ↔ sf_system_notice（唯一键 notice_code）。
 * 系统设置「系统通知」tab 维护，首页「系统通知」面板展示。
 */
const express = require('express');
const { query, execute } = require('../config/db');
const { hasSoftDelete, softDeleteByCode } = require('../utils/table-meta');

const router = express.Router();
const TABLE = 'sf_system_notice';
const CODE_COL = 'notice_code';

function norm(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  return v;
}
const WRITABLE_COLS = new Set(['title', 'content', 'notice_type', 'notice_status']);
function cleanRow(row) {
  const data = {};
  for (const [k, v] of Object.entries(row)) {
    if (WRITABLE_COLS.has(k)) data[k] = v;
  }
  return data;
}

router.get('/aggregate', async (req, res, next) => {
  try {
    const where = (await hasSoftDelete(TABLE)) ? ' WHERE `is_deleted` = 0' : '';
    const notices = await query('SELECT * FROM `' + TABLE + '`' + where + ' ORDER BY `id` DESC');
    res.json({ ok: true, data: { notices } });
  } catch (e) { next(e); }
});

router.post('/aggregate', async (req, res, next) => {
  const body = req.body || {};
  try {
    let n = 0;
    if (Array.isArray(body.notices)) {
      for (const row of body.notices) {
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
    if (Array.isArray(body.deleted && body.deleted.notices)) n += await softDeleteByCode(TABLE, CODE_COL, body.deleted.notices);
    res.json({ ok: true, data: { summary: { notices: n } } });
  } catch (e) { next(e); }
});

module.exports = router;