/**
 * 数据库增量迁移自动执行器
 * --------------------------------------------------------------
 * 背景：MySQL 的 /docker-entrypoint-initdb.d/ 只在「数据卷首次初始化」
 *       时执行 schema.sql / seed.sql。后续拉取新代码重新部署（docker compose
 *       up -d --build，但未带 -v）时，既有数据库不会再跑建表脚本，导致新增的
 *       列 / 表缺失，前端写入时报 "Unknown column / table doesn't exist"，
 *       表现为「后台页面编辑后不能保存」。
 *
 * 做法：API 服务启动时，自动按文件名顺序执行 server/db/migrations/*.sql。
 *       所有迁移均为幂等写法（CREATE TABLE IF NOT EXISTS、基于
 *       information_schema 的条件 ALTER），重复执行安全。
 *
 * 注意：单个迁移文件内可能用到会话变量（如 @sql + PREPARE/EXECUTE），
 *       因此同一文件的所有语句必须在同一条连接上顺序执行，以保证会话状态连续。
 */
const fs = require('fs');
const path = require('path');

// 仅执行「增量迁移」子目录下的 .sql；绝不触碰同级的 schema.sql / seed.sql
// （它们含 DROP TABLE IF EXISTS，只能在首次建库时由 MySQL init 机制执行）。
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * 把一段 SQL 文本拆成多条语句（忽略字符串字面量与行注释中的分号）
 * @param {string} text
 * @returns {string[]}
 */
function splitStatements(text) {
  const stmts = [];
  let buf = '';
  let inStr = false;
  let inLineComment = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inLineComment) {
      buf += c;
      if (c === '\n') inLineComment = false;
      continue;
    }
    if (!inStr && c === '-' && next === '-') {
      inLineComment = true;
      buf += c;
      continue;
    }
    if (c === "'") {
      inStr = !inStr;
      buf += c;
      continue;
    }
    if (c === ';' && !inStr) {
      stmts.push(buf);
      buf = '';
      continue;
    }
    buf += c;
  }
  if (buf.trim()) stmts.push(buf);
  return stmts.filter((s) => s.trim().length > 0);
}

/**
 * 执行所有增量迁移（幂等）
 * @param {import('mysql2/promise').Pool} pool
 * @param {(msg:string)=>void} [log]
 * @returns {Promise<{applied:number, skipped:number, errors:Array<{file:string,message:string}>}>}
 */
async function runMigrations(pool, log) {
  const logger = log || ((m) => console.log(m));
  const result = { applied: 0, skipped: 0, errors: [] };

  let files = [];
  try {
    files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => /\.sql$/i.test(f))
      .sort();
  } catch (e) {
    logger(`[migrate] 无法读取迁移目录 ${MIGRATIONS_DIR}: ${e.message}`);
    return result;
  }

  if (!files.length) {
    logger('[migrate] 未发现增量迁移文件，跳过');
    return result;
  }

  let conn = null;
  try {
    conn = await pool.getConnection();
  } catch (e) {
    logger(`[migrate] 获取数据库连接失败，跳过自动迁移: ${e.message}`);
    return result;
  }

  for (const file of files) {
    const full = path.join(MIGRATIONS_DIR, file);
    let sql = '';
    try {
      sql = fs.readFileSync(full, 'utf8');
    } catch (e) {
      result.errors.push({ file, message: e.message });
      logger(`[migrate] 读取失败 ${file}: ${e.message}`);
      continue;
    }
    const stmts = splitStatements(sql);
    try {
      for (const stmt of stmts) {
        await conn.query(stmt);
      }
      result.applied += 1;
      logger(`[migrate] 已执行 ${file}（${stmts.length} 条语句，幂等）`);
    } catch (e) {
      // 幂等迁移在已应用时本不应报错；若报错则记录但不中断服务启动
      result.errors.push({ file, message: e.message });
      logger(`[migrate] 执行失败 ${file}: ${e.message}`);
    }
  }

  try { conn.release(); } catch (e) { /* ignore */ }

  logger(
    `[migrate] 完成：applied=${result.applied} errors=${result.errors.length}` +
    (result.errors.length ? '（详见上方日志，未影响服务启动）' : '')
  );
  return result;
}

module.exports = { runMigrations, splitStatements };
