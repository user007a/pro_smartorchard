-- ============================================================
-- 增量迁移 · 2026-11-20 · JSON 列统一改为 text（消除 Data too long 500）
-- ------------------------------------------------------------
-- 背景：本项目若干业务列存的是「前端 JSON.stringify 后的字符串」
--       （商品明细行 / SKU 列表 / 通知方式 / 环节配置 / 订单地址 …），
--       但建表时一律声明成定长 varchar(N)。
--       当业务数据超过 N 字节时，MySQL 抛
--       "Data too long for column 'xxx' at row 1"
--       → POST /api/{module}/aggregate 整条 500
--       → 页面表现：新增 / 编辑点「保存」毫无反应或报「保存失败」，
--         且该模块当次保存的数据一条都没落库。
--
--       实测（2026-11-20，真实 Docker + MySQL 8.0）：
--         sf_sales_order.product_info  12 个商品行(1459 字节) → HTTP 500
--         sf_mall_coupon.sku_ids       90 个 SKU(1701 字节)  → HTTP 500
--
-- 变更方式：**增量迁移（ALTER TABLE MODIFY COLUMN）**，把列类型从
--            varchar(N) 改为 text。只放宽上限、不删列、不动既有行数据
--            （符合《数据设计约定》决策 0 与铁律 6）。
--
-- 说明：schema.sql 已同步为 text；全新建库
--       （docker compose down -v && docker compose up -d）无需再跑本迁移。
--
-- 备注（铁律 4 的方向）：铁律要求「图片/附件存 file_id、JSON 结构化内容
--       存 text 或独立子表」。本迁移先把 JSON 文本列的容量放开，
--       保证保存不再失败；后续如需按 JSON 字段检索，再拆独立子表。
-- ============================================================

SET NAMES utf8mb4;

-- ---------- 幂等改列工具：把指定表/列改为 text ----------
-- 用 information_schema 判断当前 DATA_TYPE，已是 text 则跳过。

-- sf_alert_record.threshold
SET @sql := (SELECT CASE
  WHEN COUNT(*) = 0 THEN 'DO 0'
  WHEN MAX(DATA_TYPE) = 'text' THEN 'DO 0'
  ELSE 'ALTER TABLE `sf_alert_record` MODIFY COLUMN `threshold` text COMMENT ''触发阈值(JSON)'''
END FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_alert_record' AND COLUMN_NAME = 'threshold' LIMIT 1);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sf_alert_record.history
SET @sql := (SELECT CASE
  WHEN COUNT(*) = 0 THEN 'DO 0'
  WHEN MAX(DATA_TYPE) = 'text' THEN 'DO 0'
  ELSE 'ALTER TABLE `sf_alert_record` MODIFY COLUMN `history` text COMMENT ''处理历史(JSON)'''
END FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_alert_record' AND COLUMN_NAME = 'history' LIMIT 1);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sf_alert_rule.threshold
SET @sql := (SELECT CASE
  WHEN COUNT(*) = 0 THEN 'DO 0'
  WHEN MAX(DATA_TYPE) = 'text' THEN 'DO 0'
  ELSE 'ALTER TABLE `sf_alert_rule` MODIFY COLUMN `threshold` text COMMENT ''触发阈值(JSON)'''
END FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_alert_rule' AND COLUMN_NAME = 'threshold' LIMIT 1);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sf_alert_rule.notify_way
SET @sql := (SELECT CASE
  WHEN COUNT(*) = 0 THEN 'DO 0'
  WHEN MAX(DATA_TYPE) = 'text' THEN 'DO 0'
  ELSE 'ALTER TABLE `sf_alert_rule` MODIFY COLUMN `notify_way` text COMMENT ''通知方式(JSON)'''
END FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_alert_rule' AND COLUMN_NAME = 'notify_way' LIMIT 1);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sf_alert_rule.assignees
SET @sql := (SELECT CASE
  WHEN COUNT(*) = 0 THEN 'DO 0'
  WHEN MAX(DATA_TYPE) = 'text' THEN 'DO 0'
  ELSE 'ALTER TABLE `sf_alert_rule` MODIFY COLUMN `assignees` text COMMENT ''责任人列表(JSON)'''
END FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_alert_rule' AND COLUMN_NAME = 'assignees' LIMIT 1);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sf_base.base_images
SET @sql := (SELECT CASE
  WHEN COUNT(*) = 0 THEN 'DO 0'
  WHEN MAX(DATA_TYPE) = 'text' THEN 'DO 0'
  ELSE 'ALTER TABLE `sf_base` MODIFY COLUMN `base_images` text COMMENT ''基地图片(JSON)'''
END FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_base' AND COLUMN_NAME = 'base_images' LIMIT 1);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sf_sales_customer.invoice_info
SET @sql := (SELECT CASE
  WHEN COUNT(*) = 0 THEN 'DO 0'
  WHEN MAX(DATA_TYPE) = 'text' THEN 'DO 0'
  ELSE 'ALTER TABLE `sf_sales_customer` MODIFY COLUMN `invoice_info` text COMMENT ''开票信息'''
END FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_sales_customer' AND COLUMN_NAME = 'invoice_info' LIMIT 1);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sf_sales_customer.tags
SET @sql := (SELECT CASE
  WHEN COUNT(*) = 0 THEN 'DO 0'
  WHEN MAX(DATA_TYPE) = 'text' THEN 'DO 0'
  ELSE 'ALTER TABLE `sf_sales_customer` MODIFY COLUMN `tags` text COMMENT ''客户标签(JSON)'''
END FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_sales_customer' AND COLUMN_NAME = 'tags' LIMIT 1);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sf_sales_order.product_info
SET @sql := (SELECT CASE
  WHEN COUNT(*) = 0 THEN 'DO 0'
  WHEN MAX(DATA_TYPE) = 'text' THEN 'DO 0'
  ELSE 'ALTER TABLE `sf_sales_order` MODIFY COLUMN `product_info` text COMMENT ''商品明细(JSON)'''
END FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_sales_order' AND COLUMN_NAME = 'product_info' LIMIT 1);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sf_sales_shipment.product_info
SET @sql := (SELECT CASE
  WHEN COUNT(*) = 0 THEN 'DO 0'
  WHEN MAX(DATA_TYPE) = 'text' THEN 'DO 0'
  ELSE 'ALTER TABLE `sf_sales_shipment` MODIFY COLUMN `product_info` text COMMENT ''商品明细(JSON)'''
END FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_sales_shipment' AND COLUMN_NAME = 'product_info' LIMIT 1);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sf_sales_statement.order_ids
SET @sql := (SELECT CASE
  WHEN COUNT(*) = 0 THEN 'DO 0'
  WHEN MAX(DATA_TYPE) = 'text' THEN 'DO 0'
  ELSE 'ALTER TABLE `sf_sales_statement` MODIFY COLUMN `order_ids` text COMMENT ''订单号列表(JSON)'''
END FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_sales_statement' AND COLUMN_NAME = 'order_ids' LIMIT 1);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sf_sales_target.order_ids
SET @sql := (SELECT CASE
  WHEN COUNT(*) = 0 THEN 'DO 0'
  WHEN MAX(DATA_TYPE) = 'text' THEN 'DO 0'
  ELSE 'ALTER TABLE `sf_sales_target` MODIFY COLUMN `order_ids` text COMMENT ''订单号列表(JSON)'''
END FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_sales_target' AND COLUMN_NAME = 'order_ids' LIMIT 1);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sf_performance_result.order_ids
SET @sql := (SELECT CASE
  WHEN COUNT(*) = 0 THEN 'DO 0'
  WHEN MAX(DATA_TYPE) = 'text' THEN 'DO 0'
  ELSE 'ALTER TABLE `sf_performance_result` MODIFY COLUMN `order_ids` text COMMENT ''订单号列表(JSON)'''
END FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_performance_result' AND COLUMN_NAME = 'order_ids' LIMIT 1);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sf_mall_coupon.sku_ids
SET @sql := (SELECT CASE
  WHEN COUNT(*) = 0 THEN 'DO 0'
  WHEN MAX(DATA_TYPE) = 'text' THEN 'DO 0'
  ELSE 'ALTER TABLE `sf_mall_coupon` MODIFY COLUMN `sku_ids` text COMMENT ''适用SKU列表(JSON)'''
END FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_mall_coupon' AND COLUMN_NAME = 'sku_ids' LIMIT 1);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sf_mall_order.product_info
SET @sql := (SELECT CASE
  WHEN COUNT(*) = 0 THEN 'DO 0'
  WHEN MAX(DATA_TYPE) = 'text' THEN 'DO 0'
  ELSE 'ALTER TABLE `sf_mall_order` MODIFY COLUMN `product_info` text COMMENT ''商品明细(JSON)'''
END FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_mall_order' AND COLUMN_NAME = 'product_info' LIMIT 1);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sf_mall_order.logistics
SET @sql := (SELECT CASE
  WHEN COUNT(*) = 0 THEN 'DO 0'
  WHEN MAX(DATA_TYPE) = 'text' THEN 'DO 0'
  ELSE 'ALTER TABLE `sf_mall_order` MODIFY COLUMN `logistics` text COMMENT ''物流轨迹(JSON)'''
END FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_mall_order' AND COLUMN_NAME = 'logistics' LIMIT 1);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sf_mall_order.address（收货地址对象 JSON）
SET @sql := (SELECT CASE
  WHEN COUNT(*) = 0 THEN 'DO 0'
  WHEN MAX(DATA_TYPE) = 'text' THEN 'DO 0'
  ELSE 'ALTER TABLE `sf_mall_order` MODIFY COLUMN `address` text COMMENT ''收货地址(JSON)'''
END FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_mall_order' AND COLUMN_NAME = 'address' LIMIT 1);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sf_mall_member.tags
SET @sql := (SELECT CASE
  WHEN COUNT(*) = 0 THEN 'DO 0'
  WHEN MAX(DATA_TYPE) = 'text' THEN 'DO 0'
  ELSE 'ALTER TABLE `sf_mall_member` MODIFY COLUMN `tags` text COMMENT ''会员标签(JSON)'''
END FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_mall_member' AND COLUMN_NAME = 'tags' LIMIT 1);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sf_mall_post.images
SET @sql := (SELECT CASE
  WHEN COUNT(*) = 0 THEN 'DO 0'
  WHEN MAX(DATA_TYPE) = 'text' THEN 'DO 0'
  ELSE 'ALTER TABLE `sf_mall_post` MODIFY COLUMN `images` text COMMENT ''图片列表(JSON)'''
END FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_mall_post' AND COLUMN_NAME = 'images' LIMIT 1);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sf_trace_template.layout
SET @sql := (SELECT CASE
  WHEN COUNT(*) = 0 THEN 'DO 0'
  WHEN MAX(DATA_TYPE) = 'text' THEN 'DO 0'
  ELSE 'ALTER TABLE `sf_trace_template` MODIFY COLUMN `layout` text COMMENT ''标签版式(JSON)'''
END FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_trace_template' AND COLUMN_NAME = 'layout' LIMIT 1);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sf_label_type.layout
SET @sql := (SELECT CASE
  WHEN COUNT(*) = 0 THEN 'DO 0'
  WHEN MAX(DATA_TYPE) = 'text' THEN 'DO 0'
  ELSE 'ALTER TABLE `sf_label_type` MODIFY COLUMN `layout` text COMMENT ''标签版式(JSON)'''
END FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_label_type' AND COLUMN_NAME = 'layout' LIMIT 1);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sf_trace_show_template.modules
SET @sql := (SELECT CASE
  WHEN COUNT(*) = 0 THEN 'DO 0'
  WHEN MAX(DATA_TYPE) = 'text' THEN 'DO 0'
  ELSE 'ALTER TABLE `sf_trace_show_template` MODIFY COLUMN `modules` text COMMENT ''展示环节(JSON)'''
END FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_trace_show_template' AND COLUMN_NAME = 'modules' LIMIT 1);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sf_trace_show_template.bound_batches
SET @sql := (SELECT CASE
  WHEN COUNT(*) = 0 THEN 'DO 0'
  WHEN MAX(DATA_TYPE) = 'text' THEN 'DO 0'
  ELSE 'ALTER TABLE `sf_trace_show_template` MODIFY COLUMN `bound_batches` text COMMENT ''绑定批次(JSON)'''
END FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_trace_show_template' AND COLUMN_NAME = 'bound_batches' LIMIT 1);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- 结果校验 ----------
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND DATA_TYPE = 'text'
  AND (TABLE_NAME, COLUMN_NAME) IN (
    ('sf_alert_record','threshold'),('sf_alert_record','history'),
    ('sf_alert_rule','threshold'),('sf_alert_rule','notify_way'),('sf_alert_rule','assignees'),
    ('sf_base','base_images'),
    ('sf_sales_customer','invoice_info'),('sf_sales_customer','tags'),
    ('sf_sales_order','product_info'),('sf_sales_shipment','product_info'),
    ('sf_sales_statement','order_ids'),('sf_sales_target','order_ids'),
    ('sf_performance_result','order_ids'),
    ('sf_mall_coupon','sku_ids'),('sf_mall_order','product_info'),('sf_mall_order','logistics'),
    ('sf_mall_order','address'),
    ('sf_mall_member','tags'),('sf_mall_post','images'),
    ('sf_trace_template','layout'),('sf_label_type','layout'),
    ('sf_trace_show_template','modules'),('sf_trace_show_template','bound_batches')
  )
ORDER BY TABLE_NAME, COLUMN_NAME;
