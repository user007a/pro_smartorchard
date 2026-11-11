/**
 * 资源注册表（通用 CRUD 的核心安全机制）
 * --------------------------------------------------------------
 * 作用：
 *   1. 建立「资源名(resource) → 表名(table)」的显式映射，杜绝 SQL 注入；
 *   2. 维护每张表的「只读字段」「敏感字段」「查询字段」清单；
 *   3. 提供字段白名单校验，通用 CRUD 只操作白名单内的字段。
 *
 * 设计约定：
 *   - 资源名 = 去掉 `sf_` 前缀的表名（如 sf_device → device）；
 *   - 所有表统一包含公共字段：id / created_at / updated_at / is_deleted；
 *   - 这些公共字段由系统自动管理，前端不直接写入（is_deleted 由逻辑删除接口处理）；
 *   - 敏感字段（password 等）不进入通用 CRUD 的读写白名单，需走专用接口。
 */

// 公共字段：由系统自动维护，通用 CRUD 不接受前端写入
const COMMON_FIELDS = ['id', 'created_at', 'updated_at', 'is_deleted'];

// 敏感字段：不进入通用 CRUD 读写，需走专用接口（如 auth 登录）
const SENSITIVE_FIELDS = {
  sf_user: ['password'],
  sf_mb_staff_account: ['password'],
  sf_mall_member: ['password'],
};

// 允许的资源名列表（与表名一一对应，去 sf_ 前缀）
// 若需要额外限制某张表（如只读），可在这里做特殊标记
const READONLY_RESOURCES = new Set([
  'operation_log', // 操作日志只读
]);

/**
 * 校验资源名是否合法，返回对应表名；非法返回 null
 */
function resolveTable(resource) {
  if (!resource || typeof resource !== 'string') return null;
  // 资源名只允许小写字母、数字、下划线
  if (!/^[a-z0-9_]{1,64}$/.test(resource)) return null;
  const table = 'sf_' + resource;
  return table;
}

/**
 * 判断某表某字段是否可写（排除公共字段和敏感字段）
 */
function isWritableField(table, field) {
  if (COMMON_FIELDS.includes(field)) return false;
  const sensitive = SENSITIVE_FIELDS[table] || [];
  if (sensitive.includes(field)) return false;
  return true;
}

/**
 * 判断某表某字段是否可读（排除敏感字段）
 */
function isReadableField(table, field) {
  const sensitive = SENSITIVE_FIELDS[table] || [];
  if (sensitive.includes(field)) return false;
  return true;
}

module.exports = {
  COMMON_FIELDS,
  SENSITIVE_FIELDS,
  READONLY_RESOURCES,
  resolveTable,
  isWritableField,
  isReadableField,
};
