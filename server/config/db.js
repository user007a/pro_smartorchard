/**
 * 数据库连接池配置
 * --------------------------------------------------------------
 * 统一从环境变量读取连接信息，提供 promise 化的 mysql2 连接池。
 * 环境变量未设置时使用本地开发默认值。
 */
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'smartorchard',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: '+08:00',
  dateStrings: true, // 日期字段以字符串返回，避免时区偏移
});

/**
 * 执行 SQL 查询
 * @param {string} sql
 * @param {Array} [params]
 * @returns {Promise<Array>} 查询结果行
 */
async function query(sql, params) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * 执行 SQL（返回结果集元信息，适合 INSERT/UPDATE/DELETE）
 *
 * 注意：这里刻意用 pool.query 而非 pool.execute（预处理语句）。
 * mysql2 的 execute 会对 BIGINT 等类型做预处理类型推断，number 参数
 * 在「WHERE id = ?」等场景下会匹配不到行（affectedRows=0 但实际未生效），
 * 属于 mysql2 3.x 的已知坑。query 走文本插值转义，类型安全、行为一致，
 * 返回结构（affectedRows/insertId）与 execute 相同，对调用方无感知。
 */
async function execute(sql, params) {
  const [result] = await pool.query(sql, params);
  return result;
}

module.exports = { pool, query, execute };
