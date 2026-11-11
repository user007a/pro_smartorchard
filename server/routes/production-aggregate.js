/**
 * 生产模块聚合读写接口
 * --------------------------------------------------------------
 * 支撑前端 ProductionStore 的「策略 A 出入口映射」：store 聚合对象 ↔ 10 张表。
 *
 *   GET  /api/production/aggregate   一次性拉取生产模块全部表数据（load 用）
 *   POST /api/production/aggregate   批量保存（按表拆分 upsert / 删除，save 用）
 *
 * 覆盖表（10 张）：
 *   sf_guide_standard   农事标准（standards）
 *   sf_farming_plan     农事计划（plans）
 *   sf_farming_task     农事任务（tasks）
 *   sf_farming_record   农事记录（records）
 *   sf_patrol_route     巡园路线（routeList，points 为 JSON）
 *   sf_patrol_plan      巡园计划（patrolPlans）
 *   sf_patrol_checkin   巡园打卡（checkins）
 *   sf_drone_patrol     无人机架次（sorties）
 *   sf_drone_flight_log 飞行日志（flightLogs）
 *   sf_patrol_abnormal  巡园异常（anomalies）
 *
 * 设计约定（与 device/enterprise/cert-aggregate 一致）：
 *   - store 字段（camelCase）↔ 表字段（snake_case），映射由前端负责，后端只透传表行；
 *   - 主键语义：store item.id（PL-/TK-/REC-/STD-/PP-/CK-/SO-/LOG-/AB- 前缀）
 *     ↔ 表 *_code 唯一列；物理主键自增 id；
 *   - 外键（base_id/plot_id/standard_id/route_id/plan_id/task_id）由前端映射层
 *     传已解析的自增 id（或业务 code），本接口仅透传数值/编号。
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
  standards:   { table: 'sf_guide_standard',   codeCol: 'standard_code' },
  plans:       { table: 'sf_farming_plan',      codeCol: 'plan_code' },
  tasks:       { table: 'sf_farming_task',      codeCol: 'task_code' },
  records:     { table: 'sf_farming_record',    codeCol: 'record_code' },
  routeList:   { table: 'sf_patrol_route',      codeCol: 'route_code' },
  patrolPlans: { table: 'sf_patrol_plan',       codeCol: 'plan_code' },
  checkins:    { table: 'sf_patrol_checkin',    codeCol: 'checkin_code' },
  sorties:     { table: 'sf_drone_patrol',      codeCol: 'task_code' },
  flightLogs:  { table: 'sf_drone_flight_log',  codeCol: 'log_code' },
  anomalies:   { table: 'sf_patrol_abnormal',   codeCol: 'abnormal_code' },
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

    // 组装 refs（供前端把基地/地块/路线等名称解析为自增 id）
    const [bases, plots, routes, standards, plans, tasks] = await Promise.all([
      fetchAll('sf_base'),
      fetchAll('sf_plot'),
      fetchAll('sf_patrol_route'),
      fetchAll('sf_guide_standard'),
      fetchAll('sf_farming_plan'),
      fetchAll('sf_farming_task'),
    ]);

    res.json({
      ok: true,
      data: {
        ...results,
        refs: {
          bases: bases.map((b) => ({ id: b.id, code: b.code, name: b.name })),
          plots: plots.map((p) => ({ id: p.id, code: p.code, name: p.name, base_id: p.base_id })),
          routes: routes.map((r) => ({ id: r.id, code: r.route_code, name: r.route_name })),
          standards: standards.map((s) => ({ id: s.id, code: s.standard_code, name: s.standard_name })),
          plans: plans.map((p) => ({ id: p.id, code: p.plan_code, name: p.plan_name })),
          tasks: tasks.map((t) => ({ id: t.id, code: t.task_code, name: t.task_name })),
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
 *   standards: [{ ...sf_guide_standard 表行 }],
 *   plans:     [{ ...sf_farming_plan 表行 }],
 *   tasks:     [{ ...sf_farming_task 表行 }],
 *   records:   [{ ...sf_farming_record 表行 }],
 *   routeList: [{ ...sf_patrol_route 表行 }],
 *   patrolPlans: [{ ...sf_patrol_plan 表行 }],
 *   checkins:  [{ ...sf_patrol_checkin 表行 }],
 *   sorties:   [{ ...sf_drone_patrol 表行 }],
 *   flightLogs:[{ ...sf_drone_flight_log 表行 }],
 *   anomalies: [{ ...sf_patrol_abnormal 表行 }],
 *   deleted:   { standards:[...], plans:[...], ... }
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
