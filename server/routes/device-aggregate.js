/**
 * 设备模块聚合读写接口
 * --------------------------------------------------------------
 * 支撑前端 DeviceStore 的「策略 A 出入口映射」：store 聚合对象 ↔ 13 张表。
 *
 *   GET  /api/device/aggregate        一次性拉取设备模块全部表数据（load 用）
 *   POST /api/device/aggregate        批量保存（按表拆分 upsert / 删除，save 用）
 *
 * 设计约定：
 *   - store 字段（camelCase）↔ 表字段（snake_case），映射由前端负责，后端只透传表行；
 *   - 主键语义：store item.id（业务编号）↔ 表 *_code 唯一列；物理主键自增 id；
 *   - 引用存 ID：device_id / base_id / plot_id / gateway_id / device_type_id 存自增 id，
 *     POST 时由本接口按业务编号（*_code）解析为自增 id。
 */
const express = require('express');
const { query, execute } = require('../config/db');
const { hasSoftDelete, softDeleteByCode } = require('../utils/table-meta');

const router = express.Router();

/* ---------- 工具 ---------- */

/** 每张表的业务编号列（唯一键），用于「业务编号 ↔ 自增 id」互查 */
const CODE_COLUMN = {
  device: 'device_code',
  device_type: 'type_code',
  device_access: 'config_code',
  gateway: 'gateway_code',
  video_channel: 'channel_code',
  device_maintain: 'maintain_code',
  device_calibration: 'calibration_code',
  device_spare: 'spare_code',
  device_asset: 'asset_code',
  device_command: 'command_code',
};

/**
 * 批量查询某张表全部行（按 id 升序，保证稳定顺序）
 * 逻辑删除过滤条件由表结构动态决定（utils/table-meta），新增表无需改代码。
 */
async function fetchAll(table) {
  const where = (await hasSoftDelete(table)) ? ' WHERE `is_deleted` = 0' : '';
  return query('SELECT * FROM `' + table + '`' + where + ' ORDER BY `id` ASC');
}

/** 解析「业务编号字符串 → 自增 id」，带内存缓存 */
function makeIdResolver(table, codeCol) {
  const cache = new Map(); // code -> id
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

/**
 * 基地名称解析器：支持全称「天水麦积区基地」→ 简称「麦积基地」归一后再匹配。
 * sf_base 无 code 列，用 name（简称）作业务键。
 */
function makeBaseResolver() {
  const cache = new Map(); // 任意名称变体 -> id
  return async function resolve(name) {
    if (name === null || name === undefined || name === '') return null;
    const key = String(name);
    if (cache.has(key)) return cache.get(key);
    // 归一化：去掉「天水」前缀，去掉「区/县」后缀
    const variants = [key];
    const normed = key.replace(/^天水/, '').replace(/[区县]基地$/, '基地');
    if (normed !== key) variants.push(normed);
    let id = null;
    for (const v of variants) {
      const rows = await query(
        'SELECT `id` FROM `sf_base` WHERE `name` = ? AND `is_deleted` = 0 LIMIT 1', [v]
      );
      if (rows.length) { id = rows[0].id; break; }
    }
    cache.set(key, id);
    return id;
  };
}

/** 空值归一：空字符串 → null（避免 DATE/DECIMAL 列报错） */
function norm(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  return v;
}

/** 从对象中挑选指定列的键值对（只保留已定义的字段） */
function pick(row, cols) {
  const out = {};
  cols.forEach(function (c) {
    if (Object.prototype.hasOwnProperty.call(row, c)) out[c] = row[c];
  });
  return out;
}

/* ---------- GET：聚合读取 ---------- */

router.get('/aggregate', async (req, res, next) => {
  try {
    const [devices, deviceTypes, measures, accesses, gateways, videos,
      maintains, logs, calibrations, spares, assets, commands, audits] =
      await Promise.all([
        fetchAll('sf_device'),
        fetchAll('sf_device_type'),
        fetchAll('sf_device_measure'),
        fetchAll('sf_device_access'),
        fetchAll('sf_gateway'),
        fetchAll('sf_video_channel'),
        fetchAll('sf_device_maintain'),
        fetchAll('sf_device_log'),
        fetchAll('sf_device_calibration'),
        fetchAll('sf_device_spare'),
        fetchAll('sf_device_asset'),
        fetchAll('sf_device_command'),
        fetchAll('sf_device_audit'),
      ]);

    // 外键反查映射：id -> 业务编号/名称，供前端把 BIGINT 还原成 store 里的编号/名称
    const bases = await query('SELECT `id`, `code`, `name` FROM `sf_base` WHERE `is_deleted` = 0');
    const plots = await query('SELECT `id`, `code`, `name`, `base_id` FROM `sf_plot` WHERE `is_deleted` = 0');
    const baseById = {}; const baseCodeByName = {};
    bases.forEach(function (b) { baseById[b.id] = b; baseCodeByName[b.name] = b.code; });
    const plotById = {};
    plots.forEach(function (p) { plotById[p.id] = p; });

    res.json({
      ok: true,
      data: {
        devices,
        device_types: deviceTypes,
        measures,
        accesses,
        gateways,
        videos,
        maintains,
        logs,
        calibrations,
        spares,
        assets,
        commands,
        audits,
        // 外键字典（供前端还原 store 字段）
        refs: {
          bases,           // [{id, code, name}]
          plots,           // [{id, code, name, base_id}]
          baseById,
          plotById,
        },
      },
    });
  } catch (e) {
    next(e);
  }
});

/* ---------- POST：聚合保存 ---------- */

/**
 * 请求体结构（与 store 聚合对象一一对应，字段已由前端映射成 snake_case 表行）：
 * {
 *   devices:      [{...表行, _code, _deviceId?}],
 *   device_types: [{...}],
 *   measures:     [{...}],           // 物模型测点（key 含 device_type_id）
 *   accesses:     [{...}],
 *   gateways:     [{...}],
 *   videos:       [{...}],
 *   maintains:    [{...}],
 *   logs:         [{...}],
 *   calibrations: [{...}],
 *   spares:       [{...}],
 *   assets:       [{...}],
 *   commands:     [{...}],
 *   audits:       [{...}],
 *   deleted: { devices: [...codes], ... }   // 需要逻辑删除的业务编号
 * }
 *
 * 约定：每行必须携带对应 *_code 业务编号列（前端映射时补上），
 * 本接口按「存在即更新、不存在即插入」处理；外键列（*_id）由前端
 * 传业务编号字符串，本接口统一解析为自增 id。
 */
router.post('/aggregate', async (req, res, next) => {
  const body = req.body || {};
  try {
    const summary = {};

    /* 外键解析器 */
    const resolveDevice = makeIdResolver('sf_device', 'device_code');
    const resolveGateway = makeIdResolver('sf_gateway', 'gateway_code');
    const resolveType = makeIdResolver('sf_device_type', 'type_code');
    const resolveBase = makeBaseResolver();          // base 用 name 作业务键（支持全称归一）
    const resolvePlot = makeIdResolver('sf_plot', 'code');

    /**
     * 通用 upsert：按 codeCol 判断存在性
     * 返回写入条数。
     */
    async function upsertByCode(table, codeCol, rows, extraResolvers) {
      if (!Array.isArray(rows) || !rows.length) return 0;
      let n = 0;
      for (const row of rows) {
        const code = norm(row[codeCol]);
        if (!code) continue;
        const existing = await query(
          'SELECT `id` FROM `' + table + '` WHERE `' + codeCol + '` = ? LIMIT 1', [code]
        );

        // 解析外键字段（若存在 *_id 且传的是业务编号字符串）
        const data = { ...row };
        delete data[codeCol]; // code 列不进 UPDATE SET（唯一键不变）
        delete data.id;
        delete data.created_at;
        delete data.updated_at;
        delete data.is_deleted;
        const soft = await hasSoftDelete(table);
        if (extraResolvers) {
          for (const [field, resolver] of Object.entries(extraResolvers)) {
            if (data[field] !== undefined && data[field] !== null && typeof data[field] !== 'number') {
              data[field] = await resolver(data[field]);
            } else if (data[field] === '' || data[field] === null) {
              data[field] = null;
            }
          }
        }

        if (existing.length) {
          const id = existing[0].id;
          const sets = [];
          const vals = [];
          for (const [k, v] of Object.entries(data)) {
            sets.push('`' + k + '` = ?');
            vals.push(norm(v));
          }
          // 逻辑删除表：记录被软删后重新入库时自动恢复（is_deleted 归 0）
          if (soft) {
            sets.push('`is_deleted` = ?');
            vals.push(0);
          }
          if (sets.length) {
            await execute('UPDATE `' + table + '` SET ' + sets.join(', ') + ' WHERE `id` = ?', [...vals, id]);
            n++;
          }
        } else {
          const cols = Object.keys(data);
          if (cols.length) {
            const colSql = cols.map((c) => '`' + c + '`').join(', ');
            const ph = cols.map(() => '?').join(', ');
            const vals = cols.map((c) => norm(data[c]));
            await execute(
              'INSERT INTO `' + table + '` (' + colSql + ', `' + codeCol + '`) VALUES (' + ph + ', ?)',
              [...vals, code]
            );
            n++;
          }
        }
      }
      return n;
    }

    /* 各表外键字段映射（key 与 tables 的 key 一致） */
    const resolvers = {
      devices: {
        base_id: resolveBase,
        plot_id: resolvePlot,
      },
      accesses: {
        device_id: resolveDevice,
        base_id: resolveBase,
        gateway_id: resolveGateway,
      },
      videos: {
        base_id: resolveBase,
      },
      maintains: { device_id: resolveDevice },
      logs: { device_id: resolveDevice },
      calibrations: { device_id: resolveDevice },
      commands: { device_id: resolveDevice },
    };

    const tables = [
      ['sf_device', 'device_code', 'devices'],
      ['sf_device_access', 'config_code', 'accesses'],
      ['sf_gateway', 'gateway_code', 'gateways'],
      ['sf_video_channel', 'channel_code', 'videos'],
      ['sf_device_maintain', 'maintain_code', 'maintains'],
      ['sf_device_log', null, 'logs'],                 // log 无业务编号列，用自增 id
      ['sf_device_calibration', 'calibration_code', 'calibrations'],
      ['sf_device_spare', 'spare_code', 'spares'],
      ['sf_device_asset', 'asset_code', 'assets'],
      ['sf_device_command', 'command_code', 'commands'],
      ['sf_device_type', 'type_code', 'device_types'],
      ['sf_device_audit', null, 'audits'],
    ];

    for (const [table, codeCol, key] of tables) {
      const rows = body[key];
      if (!Array.isArray(rows)) continue;
      if (codeCol) {
        summary[key] = await upsertByCode(table, codeCol, rows, resolvers[key]);
      } else {
        // 无业务编号列（log/audit）：按 id 判断，id 存在则更新，否则插入
        summary[key] = await upsertById(table, rows, resolvers[key]);
      }
    }

    /* 物模型测点：先保证 device_type 存在，再按 (device_type_id, measure_key) upsert */
    summary.measures = await upsertMeasures(body.measures, body.device_types, resolveType);

    /* 逻辑删除 */
    const deleted = body.deleted || {};
    summary.deleted = await applyDeletes(deleted);

    res.json({ ok: true, data: { summary } });
  } catch (e) {
    next(e);
  }
});

/** 无业务编号列的表：按 id 判断（log/audit 由前端映射出 _dbId） */
async function upsertById(table, rows, extraResolvers) {
  if (!Array.isArray(rows) || !rows.length) return 0;
  let n = 0;
  for (const row of rows) {
    const id = row._dbId || row.id;
    const data = { ...row };
    delete data._dbId;
    delete data.id;
    delete data.created_at;
    delete data.updated_at;
    delete data.is_deleted;
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
        const sets = []; const vals = [];
        for (const [k, v] of Object.entries(data)) {
          sets.push('`' + k + '` = ?'); vals.push(norm(v));
        }
        // 逻辑删除表：记录被软删后重新入库时自动恢复（is_deleted 归 0）
        if (await hasSoftDelete(table)) {
          sets.push('`is_deleted` = ?'); vals.push(0);
        }
        if (sets.length) {
          await execute('UPDATE `' + table + '` SET ' + sets.join(', ') + ' WHERE `id` = ?', [...vals, id]);
          n++;
        }
        continue;
      }
    }
    const cols = Object.keys(data);
    if (cols.length) {
      const colSql = cols.map((c) => '`' + c + '`').join(', ');
      const ph = cols.map(() => '?').join(', ');
      await execute('INSERT INTO `' + table + '` (' + colSql + ') VALUES (' + ph + ')', cols.map((c) => norm(data[c])));
      n++;
    }
  }
  return n;
}

/** 物模型测点 upsert */
async function upsertMeasures(measures, deviceTypes, resolveType) {
  if (!Array.isArray(measures) || !measures.length) return 0;
  let n = 0;
  for (const m of measures) {
    const typeCode = m._typeCode;
    if (!typeCode) continue;
    const typeId = await resolveType(typeCode);
    if (!typeId) continue;
    const key = m.measure_key;
    if (!key) continue;
    const existing = await query(
      'SELECT `id` FROM `sf_device_measure` WHERE `device_type_id` = ? AND `measure_key` = ? LIMIT 1',
      [typeId, key]
    );
    const data = { ...m };
    delete data._typeCode;
    delete data.id;
    delete data.device_type_id;
    if (existing.length) {
      const sets = []; const vals = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push('`' + k + '` = ?'); vals.push(norm(v));
      }
      if (sets.length) {
        await execute('UPDATE `sf_device_measure` SET ' + sets.join(', ') + ' WHERE `id` = ?', [...vals, existing[0].id]);
        n++;
      }
    } else {
      const cols = Object.keys(data);
      const colSql = ['`device_type_id`'].concat(cols.map((c) => '`' + c + '`')).join(', ');
      const ph = ['?'].concat(cols.map(() => '?')).join(', ');
      await execute(
        'INSERT INTO `sf_device_measure` (' + colSql + ') VALUES (' + ph + ')',
        [typeId].concat(cols.map((c) => norm(data[c])))
      );
      n++;
    }
  }
  return n;
}

/** 逻辑删除（按业务编号软删，逻辑删除列是否存在由表结构动态决定） */
async function applyDeletes(deleted) {
  const map = {
    devices: ['sf_device', 'device_code'],
    device_types: ['sf_device_type', 'type_code'],
    accesses: ['sf_device_access', 'config_code'],
    gateways: ['sf_gateway', 'gateway_code'],
    videos: ['sf_video_channel', 'channel_code'],
    maintains: ['sf_device_maintain', 'maintain_code'],
    calibrations: ['sf_device_calibration', 'calibration_code'],
    spares: ['sf_device_spare', 'spare_code'],
    assets: ['sf_device_asset', 'asset_code'],
    commands: ['sf_device_command', 'command_code'],
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
