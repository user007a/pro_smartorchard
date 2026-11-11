/**
 * 表结构元数据（共享）
 * --------------------------------------------------------------
 * 作用：让后端不再硬编码「哪些表有 is_deleted / 哪些表有业务编号列」，
 *       而是运行时从 information_schema 读取，新增表无需改代码。
 *
 * 背景：《数据设计约定》铁律 7 —— 每张业务表都应带公共字段
 *      id / created_at / updated_at / is_deleted。
 *      本模块让接口在个别表缺列时也能优雅降级，而不是直接 500。
 */
const { query } = require('../config/db');

/** 表名 → 列名数组（带缓存，进程内只查一次） */
const columnsCache = new Map();

/**
 * 读取某张表的全部列名（ORDER BY ORDINAL_POSITION）
 * @param {string} table 表名（sf_xxx）
 * @returns {Promise<string[]>}
 */
async function getColumns(table) {
  if (columnsCache.has(table)) return columnsCache.get(table);
  const rows = await query(
    'SELECT COLUMN_NAME AS col FROM information_schema.COLUMNS ' +
      'WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
    [process.env.DB_NAME || 'smartorchard', table]
  );
  const cols = rows.map((r) => r.col);
  columnsCache.set(table, cols);
  return cols;
}

/**
 * 判断某表是否含指定列
 * @param {string} table
 * @param {string} column
 * @returns {Promise<boolean>}
 */
async function hasColumn(table, column) {
  const cols = await getColumns(table);
  return cols.indexOf(column) !== -1;
}

/**
 * 该表是否支持逻辑删除
 * @param {string} table
 * @returns {Promise<boolean>}
 */
async function hasSoftDelete(table) {
  return hasColumn(table, 'is_deleted');
}

/**
 * 生成「逻辑删除过滤条件」SQL 片段。
 * 有 is_deleted 列 → 返回 ' WHERE `is_deleted` = 0'（或带前缀的 AND 片段）
 * 无 is_deleted 列 → 返回 ''（追加型子表，只增不删）
 *
 * @param {string} table
 * @param {string} [prefix] 已有 WHERE 条件时传 'AND'，否则留空
 * @returns {Promise<string>}
 */
async function softDeleteFilter(table, prefix) {
  if (!(await hasSoftDelete(table))) return '';
  if (prefix) return ' AND `is_deleted` = 0';
  return ' WHERE `is_deleted` = 0';
}

/**
 * 逻辑删除语句：按业务编号列软删
 * @param {string} table
 * @param {string} codeCol 业务编号列（如 device_code）
 * @param {Array<string>} codes 业务编号数组
 * @returns {Promise<number>} 影响行数
 */
async function softDeleteByCode(table, codeCol, codes) {
  if (!codes || !codes.length) return 0;
  if (!(await hasSoftDelete(table))) {
    // 无逻辑删除列的表（如纯追加日志）不做删除，直接跳过
    return 0;
  }
  const { execute } = require('../config/db');
  let n = 0;
  for (const code of codes) {
    const r = await execute(
      'UPDATE `' + table + '` SET `is_deleted` = 1 WHERE `' + codeCol + '` = ? AND `is_deleted` = 0',
      [code]
    );
    n += r.affectedRows;
  }
  return n;
}

/** 清空缓存（改表结构后调用） */
function clearCache() {
  columnsCache.clear();
}

module.exports = {
  getColumns,
  hasColumn,
  hasSoftDelete,
  softDeleteFilter,
  softDeleteByCode,
  clearCache,
};
