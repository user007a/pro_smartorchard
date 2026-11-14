/**
 * 资源注册表（通用 CRUD 的核心安全机制）
 * --------------------------------------------------------------
 * 作用：
 *   1. 用表名白名单校验「资源名(resource) → 表名(table)」，杜绝越权访问与 SQL 注入；
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
  'operation_log',   // 操作日志只读
  'device_log',      // 设备日志只读（追加型）
  'device_audit',    // 设备操作审计只读（追加型）
  'trace_query_log', // 溯源查询记录只读（追加型）
]);

// 表名白名单：完整取自 server/db/schema.sql 的全部 CREATE TABLE（共 143 张）。
// 通用 CRUD 只允许访问白名单内的表，杜绝登录用户拼接任意表名越权访问。
// 新增表时须同步在此登记，否则该表无法被通用 CRUD 访问。
const ALLOWED_TABLES = new Set([
  'sf_dict',
  'sf_file',
  'sf_operation_log',
  'sf_enterprise',
  'sf_enterprise_biz',
  'sf_enterprise_staff',
  'sf_enterprise_expert',
  'sf_enterprise_cert',
  'sf_enterprise_timeline',
  'sf_enterprise_operation',
  'sf_base',
  'sf_plot',
  'sf_soil_test',
  'sf_vr_scene',
  'sf_vr_hotspot',
  'sf_highlight',
  'sf_farming_plan',
  'sf_farming_task',
  'sf_farming_record',
  'sf_patrol_plan',
  'sf_patrol_route',
  'sf_patrol_abnormal',
  'sf_drone_patrol',
  'sf_guide_standard',
  'sf_drone_flight_log',
  'sf_patrol_checkin',
  'sf_harvest_plan',
  'sf_harvest_record',
  'sf_harvest_process',
  'sf_harvest_post',
  'sf_storage_location',
  'sf_storage_env_record',
  'sf_material_supplier',
  'sf_material_info',
  'sf_material_io',
  'sf_material_inventory',
  'sf_material_usage',
  'sf_material_return',
  'sf_material_warehouse',
  'sf_material_category',
  'sf_trace_batch',
  'sf_trace_code',
  'sf_trace_blockchain',
  'sf_trace_query_log',
  'sf_trace_template',
  'sf_trace_stage',
  'sf_label_type',
  'sf_label_stock',
  'sf_label_record',
  'sf_trace_show_template',
  'sf_trace_inspection',
  'sf_trace_recall',
  'sf_trace_print_job',
  'sf_trace_label_stock',
  'sf_adoption_tree',
  'sf_adoption_order',
  'sf_adoption_farming',
  'sf_adoption_harvest',
  'sf_adoption_photo',
  'sf_adoption_cert',
  'sf_adoption_cert_template',
  'sf_alert_record',
  'sf_alert_rule',
  'sf_alert_report',
  'sf_device',
  'sf_device_type',
  'sf_device_measure',
  'sf_device_asset',
  'sf_device_access',
  'sf_gateway',
  'sf_video_channel',
  'sf_device_maintain',
  'sf_device_calibration',
  'sf_device_spare',
  'sf_device_command',
  'sf_device_log',
  'sf_device_audit',
  'sf_cert',
  'sf_cert_stamp',
  'sf_biz_revenue_mix',
  'sf_biz_receivable',
  'sf_biz_metric',
  'sf_cost_item',
  'sf_plot_profit',
  'sf_performance_result',
  'sf_performance_task',
  'sf_sales_order',
  'sf_sales_shipment',
  'sf_sales_customer',
  'sf_sales_aftersale',
  'sf_sales_price_policy',
  'sf_sales_promotion',
  'sf_sales_target',
  'sf_sales_statement',
  'sf_sales_receipt',
  'sf_data_source',
  'sf_data_collection',
  'sf_model_monitor',
  'sf_achievement',
  'sf_milestone',
  'sf_model_config',
  'sf_model_threshold',
  'sf_phenology_stage',
  'sf_pest_risk',
  'sf_yield_forecast',
  'sf_mall_product',
  'sf_mall_category',
  'sf_mall_variety',
  'sf_mall_promotion',
  'sf_mall_coupon',
  'sf_mall_banner',
  'sf_mall_quick_entry',
  'sf_mall_order',
  'sf_mall_aftersale',
  'sf_mall_invoice',
  'sf_mall_freight',
  'sf_mall_member',
  'sf_mall_level_rule',
  'sf_mall_post',
  'sf_mall_notice',
  'sf_mall_coupon_claim',
  'sf_mall_cart',
  'sf_mall_address',
  'sf_mall_favorite',
  'sf_mb_staff_account',
  'sf_mb_feedback',
  'sf_mb_expert_consult',
  'sf_mb_message',
  'sf_mb_sync_queue',
  'sf_mb_news',
  'sf_mb_ai_category',
  'sf_mb_ai_question',
  'sf_mb_disease_rule',
  'sf_mb_fault_kb',
  'sf_dept',
  'sf_post',
  'sf_role',
  'sf_user',
  'sf_menu',
  'sf_role_menu',
  'sf_permission',
  'sf_system_config',
  'sf_notification',
  'sf_system_notice',
]);

/**
 * 校验资源名是否合法，返回对应表名；非法返回 null
 * 严格模式：除正则校验外，还必须命中 ALLOWED_TABLES 表名白名单。
 */
function resolveTable(resource) {
  if (!resource || typeof resource !== 'string') return null;
  // 资源名只允许小写字母、数字、下划线
  if (!/^[a-z0-9_]{1,64}$/.test(resource)) return null;
  const table = 'sf_' + resource;
  // 未登记的表一律拒绝，避免越权访问任意表
  if (!ALLOWED_TABLES.has(table)) return null;
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
