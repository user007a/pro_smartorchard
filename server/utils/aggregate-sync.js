/**
 * aggregate-sync.js — 聚合路由通用「按业务键 upsert + 显式逻辑删除」
 * --------------------------------------------------------------
 * 取代「整表 DELETE + 重灌」：旧策略会抹掉 mapper 未回传的列（如密码哈希）、
 * 重置自增 id / created_at，且物理删除违反铁律4。本工具：
 *   - 命中业务键 → 仅 UPDATE 本次提交的列（未提交列原样保留）；
 *   - 未命中 → INSERT；
 *   - 删除由前端显式提交 deleted 载荷触发（applyDeletes），不做「快照缺失即删」。
 *
 * 为何不做「缺失即删」：严格模式下业务数据存于各页内存镜像，预加载竞态可能使
 * 镜像只含部分表；若按全量快照缺失即删，会把未加载表的真实数据误删（曾误删种子账号）。
 * 故删除必须显式声明，与 adoption 模块一致。
 *
 * keyCols 取值：
 *   - 字符串数组：业务键列（复合键按数组顺序），如 ['product_code']、['trigger_scene','title']；
 *   - null：按物理 id 匹配，id 取自 row._dbId（mapper 回传）或 row.id（原始行透传）。
 */
const { query, execute } = require('../config/db');
const { hasSoftDelete } = require('./table-meta');

function norm(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  return v;
}
function cleanRow(row) {
  const data = { ...row };
  delete data.id;
  delete data._dbId;
  delete data.created_at;
  delete data.updated_at;
  delete data.is_deleted;
  return data;
}
function rowKey(row, keyCols) {
  if (!keyCols) return null;
  const parts = keyCols.map((c) => {
    const v = row[c];
    return v === undefined || v === null ? '' : String(v);
  });
  if (parts.every((p) => p === '')) return null;
  return parts.join('\u0001');
}

/**
 * 单表同步。返回 { upserted, deleted }。
 * @param {string} table 表名（含 sf_ 前缀）
 * @param {string[]|null} keyCols 业务键列；null 表示按物理 id
 * @param {Array<object>} rows 前端提交的全量快照（snake_case 表行）
 */
async function syncTable(table, keyCols, rows) {
  const soft = await hasSoftDelete(table);
  // 匹配含已软删行（避免唯一键冲突，命中即复活）
  const all = await query('SELECT * FROM `' + table + '` ORDER BY `id` ASC');
  const byKey = new Map();
  const byId = new Map();
  all.forEach((r) => {
    byId.set(String(r.id), r);
    const k = rowKey(r, keyCols);
    if (k !== null) byKey.set(k, r);
  });

  const keptIds = new Set();
  let upserted = 0;

  for (const row of rows) {
    const data = cleanRow(row);
    let existing = null;
    if (keyCols) {
      const k = rowKey(row, keyCols);
      if (k !== null && byKey.has(k)) existing = byKey.get(k);
    } else {
      const raw = row._dbId != null ? row._dbId : row.id;
      const dbId = raw != null ? String(raw) : '';
      if (/^\d+$/.test(dbId) && byId.has(dbId)) existing = byId.get(dbId);
    }

    if (existing) {
      keptIds.add(String(existing.id));
      const keys = Object.keys(data);
      if (!keys.length) continue;
      const sets = keys.map((c) => '`' + c + '` = ?');
      const vals = keys.map((c) => norm(data[c]));
      if (soft) { sets.push('`is_deleted` = ?'); vals.push(0); }
      await execute('UPDATE `' + table + '` SET ' + sets.join(', ') + ' WHERE `id` = ?', [...vals, existing.id]);
      upserted++;
    } else {
      const keys = Object.keys(data);
      if (!keys.length) continue;
      const colSql = keys.map((c) => '`' + c + '`').join(', ');
      const ph = keys.map(() => '?').join(', ');
      const result = await execute(
        'INSERT INTO `' + table + '` (' + colSql + ') VALUES (' + ph + ')',
        keys.map((c) => norm(data[c]))
      );
      if (result && result.insertId) keptIds.add(String(result.insertId));
      upserted++;
    }
  }

  return { upserted, deleted: 0 };
}

/**
 * 显式逻辑删除。keys 为前端声明的待删行：
 *   - keyCols 非空：单键传标量数组（如 ['P001']），复合键传对象数组（如 [{age_range:'0-30',customer_name:'',fiscal_year:'2026'}]）；
 *   - keyCols 为 null：传物理 id 数组。
 * 仅作用于当前存活行，返回删除条数。
 */
async function applyDeletes(table, keyCols, keys) {
  if (!Array.isArray(keys) || !keys.length) return 0;
  const soft = await hasSoftDelete(table);
  if (!soft) return 0;
  const all = await query('SELECT * FROM `' + table + '` WHERE `is_deleted` = 0');
  const ids = [];
  for (const item of keys) {
    let matched = null;
    if (!keyCols) {
      const dbId = String(item);
      matched = all.find((r) => String(r.id) === dbId);
    } else if (keyCols.length === 1 && (item === null || typeof item !== 'object')) {
      const col = keyCols[0];
      matched = all.find((r) => String(r[col] == null ? '' : r[col]) === String(item == null ? '' : item));
    } else {
      const obj = item || {};
      matched = all.find((r) => keyCols.every((c) => String(r[c] == null ? '' : r[c]) === String(obj[c] == null ? '' : obj[c])));
    }
    if (matched) ids.push(matched.id);
  }
  if (!ids.length) return 0;
  const ph = ids.map(() => '?').join(', ');
  const result = await execute('UPDATE `' + table + '` SET `is_deleted` = 1 WHERE `id` IN (' + ph + ')', ids);
  return (result && result.affectedRows) || ids.length;
}

module.exports = { syncTable, applyDeletes, norm, cleanRow };