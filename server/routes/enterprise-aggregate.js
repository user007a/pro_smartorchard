/**
 * 企业模块聚合读写接口
 * --------------------------------------------------------------
 * 支撑前端 EnterpriseStore 的「策略 A 出入口映射」：store 聚合对象 ↔ 8 张表。
 *
 *   GET  /api/enterprise/aggregate   一次性拉取企业模块全部表数据（load 用）
 *   POST /api/enterprise/aggregate   批量保存（按表拆分 upsert / 删除，save 用）
 *
 * 覆盖表（8 张）：
 *   主表： sf_enterprise（企业基本信息，单行）
 *   子表： sf_enterprise_biz / sf_enterprise_staff / sf_enterprise_expert
 *          sf_enterprise_timeline / sf_enterprise_operation
 *   台账： sf_base（基地）/ sf_plot（地块）
 *
 * 说明：
 *   - sf_enterprise_cert（企业资质证书）由 cert 模块（CertStore）负责落库，
 *     本接口不接管，避免「一张表被两个聚合接口重复写」。
 *   - 派生字段（产值同比、亩产、逐年曲线等 metrics() 计算值）不入库。
 *
 * 设计约定（与 device-aggregate 一致）：
 *   - store 字段（camelCase）↔ 表字段（snake_case），映射由前端负责，后端只透传表行；
 *   - 主键语义：store item.id（业务编号）↔ 表 *_code 唯一列；物理主键自增 id；
 *   - sf_enterprise 单行主表按固定 id=1 upsert（单租户，全局唯一企业）。
 */
const express = require('express');
const { query, execute } = require('../config/db');
const { hasSoftDelete, softDeleteByCode } = require('../utils/table-meta');

const router = express.Router();

/* ---------- 工具 ---------- */

/** 批量查询某张表全部行（按 id 升序，保证稳定顺序） */
async function fetchAll(table) {
  const where = (await hasSoftDelete(table)) ? ' WHERE `is_deleted` = 0' : '';
  return query('SELECT * FROM `' + table + '`' + where + ' ORDER BY `id` ASC');
}

/** 空值归一：空字符串 → null（避免 DATE/DECIMAL 列报错） */
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

/* ---------- GET：聚合读取 ---------- */

router.get('/aggregate', async (req, res, next) => {
  try {
    const [enterprise, biz, staff, experts, timelines, operations, bases, plots] =
      await Promise.all([
        fetchAll('sf_enterprise'),
        fetchAll('sf_enterprise_biz'),
        fetchAll('sf_enterprise_staff'),
        fetchAll('sf_enterprise_expert'),
        fetchAll('sf_enterprise_timeline'),
        fetchAll('sf_enterprise_operation'),
        fetchAll('sf_base'),
        fetchAll('sf_plot'),
      ]);

    res.json({
      ok: true,
      data: {
        enterprise: enterprise[0] || null,
        biz,
        staff,
        experts,
        timelines,
        operations,
        bases,
        plots,
        refs: {
          // 基地名称 → 基地（供前端把基地名称/编号解析为自增 id）
          bases: bases.map((b) => ({ id: b.id, code: b.code, name: b.name })),
          plots: plots.map((p) => ({ id: p.id, code: p.code, name: p.name, base_id: p.base_id })),
        },
      },
    });
  } catch (e) {
    next(e);
  }
});

/* ---------- POST：聚合保存 ---------- */

/**
 * 请求体结构（与 store 聚合对象对应，字段已由前端映射成 snake_case 表行）：
 * {
 *   enterprise: { ...sf_enterprise 表行 },          // 单对象（非数组）
 *   biz:        [{ ...sf_enterprise_biz 表行 }],
 *   staff:      [{ ...sf_enterprise_staff 表行 }],
 *   experts:    [{ ...sf_enterprise_expert 表行 }],
 *   timelines:  [{ ...sf_enterprise_timeline 表行 }],
 *   operations: [{ ...sf_enterprise_operation 表行 }],
 *   bases:      [{ ...sf_base 表行, _code }],
 *   plots:      [{ ...sf_plot 表行, _code }],
 *   deleted: { bases: [...codes], plots: [...codes], ... }
 * }
 */
router.post('/aggregate', async (req, res, next) => {
  const body = req.body || {};
  try {
    const summary = {};

    /* 外键解析器 */
    const resolveBase = makeIdResolver('sf_base', 'code');
    const resolvePlot = makeIdResolver('sf_plot', 'code');

    /* 1. 企业主表：单行，固定按 id=1 upsert（单租户） */
    summary.enterprise = await upsertEnterprise(body.enterprise);

    /* 2. 子表：多行，按 id 判断（seed 已固定 id，upsertById 语义） */
    const subTables = [
      ['sf_enterprise_biz', 'biz'],
      ['sf_enterprise_staff', 'staff'],
      ['sf_enterprise_expert', 'experts'],
      ['sf_enterprise_timeline', 'timelines'],
      ['sf_enterprise_operation', 'operations'],
    ];
    for (const [table, key] of subTables) {
      const rows = body[key];
      summary[key] = await upsertRows(table, rows, null);
    }

    /* 3. 台账：基地 / 地块，按业务编号 *_code 判断 */
    summary.bases = await upsertByCode('sf_base', 'code', body.bases, {});
    summary.plots = await upsertByCode('sf_plot', 'code', body.plots, {
      base_id: resolveBase,
    });

    /* 4. 逻辑删除 */
    const deleted = body.deleted || {};
    summary.deleted = await applyDeletes(deleted);

    res.json({ ok: true, data: { summary } });
  } catch (e) {
    next(e);
  }
});

/** 企业主表 upsert：单行，固定 id=1 */
async function upsertEnterprise(enterprise) {
  if (!enterprise || typeof enterprise !== 'object') return 0;
  const data = cleanRow(enterprise);
  const existing = await query('SELECT `id` FROM `sf_enterprise` WHERE `id` = 1 LIMIT 1');
  if (existing.length) {
    const sets = [];
    const vals = [];
    for (const [k, v] of Object.entries(data)) {
      sets.push('`' + k + '` = ?');
      vals.push(norm(v));
    }
    if (await hasSoftDelete('sf_enterprise')) {
      sets.push('`is_deleted` = ?');
      vals.push(0);
    }
    if (sets.length) {
      await execute('UPDATE `sf_enterprise` SET ' + sets.join(', ') + ' WHERE `id` = 1', vals);
      return 1;
    }
    return 0;
  }
  // 首次无记录则插入（id 显式置 1）
  const keys = Object.keys(data);
  if (keys.length) {
    await execute(
      'INSERT INTO `sf_enterprise` (`id`, ' + keys.map((c) => '`' + c + '`').join(', ') + ') VALUES (1, ' +
        keys.map(() => '?').join(', ') + ')',
      keys.map((c) => norm(data[c]))
    );
    return 1;
  }
  return 0;
}

/** 通用「按 id upsert」：id 存在则更新，否则插入（子表 seed 已带 id） */
async function upsertRows(table, rows, extraResolvers) {
  if (!Array.isArray(rows) || !rows.length) return 0;
  let n = 0;
  for (const row of rows) {
    const data = cleanRow(row);
    const id = row.id;
    if (extraResolvers) {
      for (const [field, resolver] of Object.entries(extraResolvers)) {
        if (data[field] !== undefined && data[field] !== null && typeof data[field] !== 'number') {
          data[field] = await resolver(data[field]);
        } else if (data[field] === '' || data[field] === null) {
          data[field] = null;
        }
      }
    }
    if (id) {
      const existing = await query('SELECT `id` FROM `' + table + '` WHERE `id` = ? LIMIT 1', [id]);
      if (existing.length) {
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
        continue;
      }
    }
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

/** 通用「按业务编号 upsert」（基地/地块台账） */
async function upsertByCode(table, codeCol, rows, extraResolvers) {
  if (!Array.isArray(rows) || !rows.length) return 0;
  let n = 0;
  for (const row of rows) {
    const code = norm(row[codeCol]);
    if (!code) continue;
    const data = cleanRow(row);
    delete data[codeCol]; // code 列不进 UPDATE SET（唯一键不变）
    if (extraResolvers) {
      for (const [field, resolver] of Object.entries(extraResolvers)) {
        if (data[field] !== undefined && data[field] !== null && typeof data[field] !== 'number') {
          data[field] = await resolver(data[field]);
        } else if (data[field] === '' || data[field] === null) {
          data[field] = null;
        }
      }
    }
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

/** 解析「业务编号字符串 → 自增 id」，带内存缓存 */
function makeIdResolver(table, codeCol) {
  const cache = new Map();
  return async function resolve(code) {
    if (code === null || code === undefined || code === '') return null;
    const key = String(code);
    if (cache.has(key)) return cache.get(key);
    const filter = (await hasSoftDelete(table)) ? ' AND `is_deleted` = 0' : '';
    const rows = await query(
      'SELECT `id` FROM `' + table + '` WHERE `' + codeCol + '` = ?' + filter + ' LIMIT 1',
      [key]
    );
    const id = rows.length ? rows[0].id : null;
    cache.set(key, id);
    return id;
  };
}

/** 逻辑删除（按业务编号软删） */
async function applyDeletes(deleted) {
  const map = {
    bases: ['sf_base', 'code'],
    plots: ['sf_plot', 'code'],
  };
  let n = 0;
  for (const [key, [table, codeCol]] of Object.entries(map)) {
    const codes = deleted[key];
    if (!Array.isArray(codes) || !codes.length) continue;
    n += await softDeleteByCode(table, codeCol, codes);
  }
  return n;
}

module.exports = router;
