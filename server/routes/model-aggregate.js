/**
 * 模型中心模块聚合读写接口
 * --------------------------------------------------------------
 * 6 模型快照 ↔ sf_model_config（model_code 唯一键，snapshot_json 存完整对象）。
 */
const express = require('express');
const { query, execute } = require('../config/db');
const { hasSoftDelete } = require('../utils/table-meta');

const router = express.Router();
const TABLE = 'sf_model_config';

function norm(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  return v;
}

router.get('/aggregate', async (req, res, next) => {
  try {
    const where = (await hasSoftDelete(TABLE)) ? ' WHERE `is_deleted` = 0' : '';
    const models = await query('SELECT * FROM `' + TABLE + '`' + where + ' ORDER BY `id` ASC');
    res.json({ ok: true, data: { models } });
  } catch (e) { next(e); }
});

router.post('/aggregate', async (req, res, next) => {
  const body = req.body || {};
  const rows = body.models;
  try {
    let n = 0;
    if (Array.isArray(rows)) {
      for (const row of rows) {
        const code = norm(row.model_code);
        if (!code) continue;
        const data = { model_name: row.model_name, enabled: row.enabled, snapshot_json: row.snapshot_json };
        const existing = await query('SELECT `id` FROM `' + TABLE + '` WHERE `model_code` = ? LIMIT 1', [code]);
        if (existing.length) {
          const sets = [], vals = [];
          for (const [k, v] of Object.entries(data)) { sets.push('`' + k + '` = ?'); vals.push(norm(v)); }
          if (await hasSoftDelete(TABLE)) { sets.push('`is_deleted` = ?'); vals.push(0); }
          await execute('UPDATE `' + TABLE + '` SET ' + sets.join(', ') + ' WHERE `id` = ?', [...vals, existing[0].id]);
          n++;
        } else {
          await execute('INSERT INTO `' + TABLE + '` (`model_code`, `model_name`, `enabled`, `snapshot_json`) VALUES (?, ?, ?, ?)',
            [code, row.model_name, row.enabled != null ? row.enabled : 1, norm(row.snapshot_json)]);
          n++;
        }
      }
    }
    res.json({ ok: true, data: { summary: { models: n } } });
  } catch (e) { next(e); }
});

module.exports = router;
