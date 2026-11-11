/**
 * 预警管理模块聚合读写接口
 * --------------------------------------------------------------
 * alerts ↔ sf_alert_record（dedupe_key 唯一键）
 * rules  ↔ sf_alert_rule（rule_code 唯一键）
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
  alerts: { table: 'sf_alert_record', codeCol: 'dedupe_key' },
  rules: { table: 'sf_alert_rule', codeCol: 'rule_code' },
  reports: { table: 'sf_alert_report', codeCol: 'report_code' },
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
      if (Array.isArray(rows) && rows.length) summary[key] = await upsertByCode(cfg.table, cfg.codeCol, rows);
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
