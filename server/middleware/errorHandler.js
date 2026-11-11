/**
 * 统一错误处理中间件
 */
function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err.message);

  // 数据库唯一约束冲突
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ ok: false, message: '数据已存在（唯一约束冲突）' });
  }

  // 字段不存在
  if (err.code === 'ER_BAD_FIELD_ERROR') {
    return res.status(400).json({ ok: false, message: '请求包含非法字段：' + (err.sqlMessage || '') });
  }

  res.status(500).json({ ok: false, message: '服务器内部错误：' + err.message });
}

module.exports = errorHandler;
