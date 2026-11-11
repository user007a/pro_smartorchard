/**
 * 溯源模块聚合读写接口
 * --------------------------------------------------------------
 * 支撑前端 TraceStore 的「策略 A 出入口映射」：store 聚合对象 ↔ 8 张表。
 *
 *   GET  /api/trace/aggregate   一次性拉取溯源模块全部表数据（load 用）
 *   POST /api/trace/aggregate   批量保存（按表拆分 upsert / 删除，save 用）
 *
 * 覆盖表（8 张）：
 *   sf_trace_batch         批次（batches）
 *   sf_trace_code          追溯码（codes）
 *   sf_trace_blockchain    事件链（events）
 *   sf_trace_query_log     扫码日志（scans，追加型）
 *   sf_trace_template      标签模板（labelTemplates）
 *   sf_trace_inspection    检测报告（inspections）
 *   sf_trace_label_stock   标签库存（labelStock）
 *   sf_trace_print_job     打印任务（printJobs）
 *   sf_trace_recall        召回（recalls）
 *
 * 设计约定（与 device/enterprise/cert/production-aggregate 一致）：
 *   - store 字段（camelCase）↔ 表字段（snake_case），映射由前端负责，后端透传表行；
 *   - 主键语义：store item.id（BAT-/SNZG-/EV-/INS-/TPL-/PJ-/RC- 前缀）
 *     ↔ 表 *_code/唯一列；物理主键自增 id；
 *   - scans 为追加型日志，无稳定业务键，POST 时按 trace_code+query_time 判重追加。
 */
const express = require('express');
const { query, execute } = require('../config/db');
const { hasSoftDelete, softDeleteByCode } = require('../utils/table-meta');

const router = express.Router();

/* ---------- 工具 ---------- */

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

/* ---------- 表配置：子数组 key → { table, codeCol } ---------- */
const TABLE_CONFIG = {
  batches:       { table: 'sf_trace_batch',       codeCol: 'batch_no' },
  codes:         { table: 'sf_trace_code',        codeCol: 'trace_code' },
  events:        { table: 'sf_trace_blockchain',  codeCol: 'event' },
  scans:         { table: 'sf_trace_query_log',   codeCol: null },  // 追加型
  labelTemplates:{ table: 'sf_trace_template',    codeCol: 'template_name' },
  inspections:   { table: 'sf_trace_inspection',  codeCol: 'report_no' },
  printJobs:     { table: 'sf_trace_print_job',   codeCol: 'job_code' },
  recalls:       { table: 'sf_trace_recall',      codeCol: 'recall_code' },
  showTemplates: { table: 'sf_trace_show_template', codeCol: 'template_code' },
};

// labelStock 是对象（name → 数量），单独表 sf_trace_label_stock，唯一键 label_name
const LABEL_STOCK_TABLE = 'sf_trace_label_stock';

/* ---------- GET：聚合读取 ---------- */

router.get('/aggregate', async (req, res, next) => {
  try {
    const keys = Object.keys(TABLE_CONFIG);
    const results = {};
    await Promise.all(keys.map(async (key) => {
      const cfg = TABLE_CONFIG[key];
      results[key] = await fetchAll(cfg.table);
    }));
    results.labelStock = await fetchAll(LABEL_STOCK_TABLE);

    res.json({
      ok: true,
      data: results,
    });
  } catch (e) {
    next(e);
  }
});

/* ---------- POST：聚合保存 ---------- */

/**
 * 请求体结构（字段已由前端映射成 snake_case 表行）：
 * {
 *   batches:       [{ ...sf_trace_batch 表行 }],
 *   codes:         [{ ...sf_trace_code 表行 }],
 *   events:        [{ ...sf_trace_blockchain 表行 }],
 *   scans:         [{ ...sf_trace_query_log 表行 }],
 *   labelTemplates:[{ ...sf_trace_template 表行 }],
 *   inspections:   [{ ...sf_trace_inspection 表行 }],
 *   labelStock:    [{ label_name, quantity, unit }],
 *   printJobs:     [{ ...sf_trace_print_job 表行 }],
 *   recalls:       [{ ...sf_trace_recall 表行 }],
 *   deleted:       { batches:[...], codes:[...], ... }
 * }
 */
router.post('/aggregate', async (req, res, next) => {
  const body = req.body || {};
  try {
    const summary = {};

    for (const [key, cfg] of Object.entries(TABLE_CONFIG)) {
      const rows = body[key];
      if (!Array.isArray(rows) || !rows.length) continue;
      if (cfg.codeCol === null) {
        summary[key] = await appendScans(cfg.table, rows);
      } else {
        summary[key] = await upsertByCode(cfg.table, cfg.codeCol, rows);
      }
    }

    // labelStock 单独处理（对象数组，唯一键 label_name）
    if (Array.isArray(body.labelStock) && body.labelStock.length) {
      summary.labelStock = await upsertByCode(LABEL_STOCK_TABLE, 'label_name', body.labelStock);
    }

    const deleted = body.deleted || {};
    summary.deleted = await applyDeletes(deleted);

    res.json({ ok: true, data: { summary } });
  } catch (e) {
    next(e);
  }
});

/** 按业务编号唯一键 upsert */
async function upsertByCode(table, codeCol, rows) {
  if (!Array.isArray(rows) || !rows.length) return 0;
  let n = 0;
  for (const row of rows) {
    const code = norm(row[codeCol]);
    if (!code) continue;
    const data = cleanRow(row);
    delete data[codeCol];
    const existing = await query(
      'SELECT `id` FROM `' + table + '` WHERE `' + codeCol + '` = ? LIMIT 1', [code]
    );
    if (existing.length) {
      const id = existing[0].id;
      const sets = [];
      const vals = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push('`' + k + '` = ?');
        vals.push(norm(v));
      }
      if (await hasSoftDelete(table)) {
        sets.push('`is_deleted` = ?');
        vals.push(0);
      }
      if (sets.length) {
        await execute('UPDATE `' + table + '` SET ' + sets.join(', ') + ' WHERE `id` = ?', [...vals, id]);
        n++;
      }
    } else {
      const keys = Object.keys(data);
      if (keys.length) {
        await execute(
          'INSERT INTO `' + table + '` (' + keys.map((c) => '`' + c + '`').join(', ') + ', `' + codeCol + '`) VALUES (' +
            keys.map(() => '?').join(', ') + ', ?)',
          [...keys.map((c) => norm(data[c])), code]
        );
        n++;
      }
    }
  }
  return n;
}

/** 追加扫码日志（按 trace_code + query_time 判重） */
async function appendScans(table, rows) {
  let n = 0;
  for (const row of rows) {
    const code = norm(row.trace_code);
    const t = norm(row.query_time);
    if (!code) continue;
    const dup = await query(
      'SELECT `id` FROM `' + table + '` WHERE `trace_code` = ? AND `query_time` = ? LIMIT 1',
      [code, t]
    );
    if (dup.length) continue; // 已存在则跳过
    const data = cleanRow(row);
    const keys = Object.keys(data);
    if (keys.length) {
      await execute(
        'INSERT INTO `' + table + '` (' + keys.map((c) => '`' + c + '`').join(', ') + ') VALUES (' +
          keys.map(() => '?').join(', ') + ')',
        keys.map((c) => norm(data[c]))
      );
      n++;
    }
  }
  return n;
}

/** 逻辑删除（按业务编号软删，逐个子数组） */
async function applyDeletes(deleted) {
  let n = 0;
  for (const [key, codes] of Object.entries(deleted)) {
    const cfg = TABLE_CONFIG[key];
    if (!cfg || cfg.codeCol === null || !Array.isArray(codes) || !codes.length) continue;
    n += await softDeleteByCode(cfg.table, cfg.codeCol, codes);
  }
  return n;
}

module.exports = router;
