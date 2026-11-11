/**
 * 采收模块聚合读写接口
 * --------------------------------------------------------------
 * 支撑前端 HarvestStore 的「策略 A 出入口映射」：store 聚合对象 ↔ 4 张表。
 *
 *   GET  /api/harvest/aggregate   一次性拉取采收模块全部表数据（load 用）
 *   POST /api/harvest/aggregate   批量保存（按表拆分 upsert / 删除，save 用）
 *
 * 覆盖表（4 张）：
 *   sf_harvest_plan     采收计划（plans）
 *   sf_harvest_record   采收记录（records）
 *   sf_harvest_process  采后处理（processes）
 *   sf_harvest_post     采后发运（shipments，发货单）
 *
 * 说明：
 *   - store 的 storages（库位库存）为派生数据，不入库；
 *     前端加载后经 rebuildStorages() 由 processes + shipments 重新推导；
 *   - 库位主数据 SLOTS 为前端硬编码静态字典，同样不入库。
 *
 * 设计约定（与 device/enterprise/cert/production-aggregate 一致）：
 *   - store 字段（camelCase）↔ 表字段（snake_case），映射由前端负责，后端只透传表行；
 *   - 主键语义：store item.id（HS-/HSR-/PP-/FH- 前缀）↔ 表 *_code 唯一列；物理主键自增 id；
 *   - 外键（base_id/plot_id/plan_id）由前端映射层传已解析的自增 id，本接口仅透传。
 */
const express = require('express');
const { query, execute } = require('../config/db');
const { hasSoftDelete, softDeleteByCode } = require('../utils/table-meta');

const router = express.Router();

/* ---------- 工具 ---------- */

/** 空值归一：空字符串 → null（避免 DATE/DATETIME 列报错） */
function norm(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  return v;
}

/** 从对象中剔除系统托管字段，返回可写数据 */
function cleanRow(row) {
  const data = { ...row };
  delete data.id;
  delete data.created_at;
  delete data.updated_at;
  delete data.is_deleted;
  return data;
}

/** 批量查询某张表全部行（按 id 升序） */
async function fetchAll(table) {
  const where = (await hasSoftDelete(table)) ? ' WHERE `is_deleted` = 0' : '';
  return query('SELECT * FROM `' + table + '`' + where + ' ORDER BY `id` ASC');
}

/* ---------- 表配置：子数组 key → { table, codeCol } ---------- */
const TABLE_CONFIG = {
  plans:     { table: 'sf_harvest_plan',     codeCol: 'plan_code' },
  records:   { table: 'sf_harvest_record',   codeCol: 'record_code' },
  processes: { table: 'sf_harvest_process',  codeCol: 'process_code' },
  shipments: { table: 'sf_harvest_post',     codeCol: 'post_code' },
};

/* ---------- GET：聚合读取 ---------- */

router.get('/aggregate', async (req, res, next) => {
  try {
    const keys = Object.keys(TABLE_CONFIG);
    const results = {};
    await Promise.all(keys.map(async (key) => {
      const cfg = TABLE_CONFIG[key];
      results[key] = await fetchAll(cfg.table);
    }));

    // 组装 refs（供前端把基地/地块/计划/处理单名称或编号解析为自增 id）
    const [bases, plots, plans, processes] = await Promise.all([
      fetchAll('sf_base'),
      fetchAll('sf_plot'),
      fetchAll('sf_harvest_plan'),
      fetchAll('sf_harvest_process'),
    ]);

    res.json({
      ok: true,
      data: {
        ...results,
        refs: {
          bases: bases.map((b) => ({ id: b.id, code: b.code, name: b.name })),
          plots: plots.map((p) => ({ id: p.id, code: p.code, name: p.name, base_id: p.base_id })),
          plans: plans.map((p) => ({ id: p.id, code: p.plan_code, name: p.plan_name })),
          processes: processes.map((p) => ({ id: p.id, code: p.process_code })),
        },
      },
    });
  } catch (e) {
    next(e);
  }
});

/* ---------- POST：聚合保存 ---------- */

/**
 * 请求体结构（字段已由前端映射成 snake_case 表行）：
 * {
 *   plans:     [{ ...sf_harvest_plan 表行 }],
 *   records:   [{ ...sf_harvest_record 表行 }],
 *   processes: [{ ...sf_harvest_process 表行 }],
 *   shipments: [{ ...sf_harvest_post 表行 }],
 *   deleted:   { plans:[...], records:[...], ... }
 * }
 */
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
    delete data[codeCol]; // code 列不进 UPDATE SET（唯一键不变）
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

/** 逻辑删除（按业务编号软删，逐个子数组） */
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
