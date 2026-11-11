/**
 * JWT 鉴权中间件
 * --------------------------------------------------------------
 * 从 Authorization: Bearer <token> 中解析 JWT，
 * 校验通过后把用户信息挂到 req.user。
 */
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'smartorchard-dev-secret-change-me';

/**
 * 签发 token
 * @param {object} payload  { id, username, role, type }
 * @returns {string}
 */
function sign(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

/**
 * 校验 token，返回 payload；失败返回 null
 */
function verify(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

/**
 * 鉴权中间件：强制要求有效 token
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = verify(token);
  if (!payload) {
    return res.status(401).json({ ok: false, message: '未登录或登录已过期' });
  }
  req.user = payload;
  next();
}

/**
 * 可选鉴权：有 token 就解析，无 token 也放行（用于游客可读接口）
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = verify(token);
  if (payload) req.user = payload;
  next();
}

module.exports = { sign, verify, requireAuth, optionalAuth };
