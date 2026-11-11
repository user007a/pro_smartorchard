/**
 * 统一错误处理中间件
 * --------------------------------------------------------------
 * 职责：
 *   1. 把底层异常翻译成业务人员看得懂的提示；
 *   2. 隐藏数据库表名 / SQL 片段等内部实现细节（安全要求，
 *      不向客户端泄露 schema 结构）；
 *   3. 详细堆栈只写服务端日志，不返回给前端。
 */
function errorHandler(err, req, res, next) {
  // 服务端日志保留完整信息，便于排查
  console.error('[ERROR]', req.method, req.originalUrl, '→', err.message);

  // 唯一约束冲突
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ ok: false, message: '数据已存在，请检查唯一字段是否重复' });
  }

  // 字段不存在
  if (err.code === 'ER_BAD_FIELD_ERROR') {
    return res.status(400).json({ ok: false, message: '请求包含非法字段' });
  }

  // 表不存在
  if (err.code === 'ER_NO_SUCH_TABLE') {
    return res.status(404).json({ ok: false, message: '数据表不存在，请确认后端已正确初始化数据库' });
  }

  // 表或字段不存在（MySQL 8 的 ER_BAD_TABLE_ERROR）
  if (err.code === 'ER_BAD_TABLE_ERROR' || err.code === 'ER_NO_SUCH_TABLE') {
    return res.status(404).json({ ok: false, message: '数据表不存在，请确认后端已正确初始化数据库' });
  }

  // SQL 语法错误
  if (err.code === 'ER_PARSE_ERROR') {
    return res.status(400).json({ ok: false, message: '请求参数格式错误' });
  }

  // 连接错误
  if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ER_CON_COUNT_ERROR') {
    return res.status(503).json({ ok: false, message: '数据库暂时不可用，请稍后重试' });
  }

  // 其余异常：不暴露内部细节
  res.status(500).json({ ok: false, message: '服务器内部错误，请联系管理员' });
}

module.exports = errorHandler;
