-- ============================================================
-- 增量迁移 · 2026-11-19 · 农资档案主数据补列
-- ------------------------------------------------------------
-- 背景：后台「农资管理 › 农资档案」(material_info.html) 的编辑表单包含
--       农药合规、储运、批次等字段，但 sf_material_info 没有对应列，
--       导致这些信息无处落库（表单填了刷新即失）。
--
-- 变更方式：**增量迁移（ALTER TABLE ADD COLUMN）**，只加不删，
--            不 DROP 表、不动既有行数据（符合《数据设计约定》决策 0）。
--
-- 执行方式（已有数据卷的运行库）：
--   docker exec -i so-mysql mysql -uroot -proot --default-character-set=utf8mb4 \
--     smartorchard < server/db/migrations/2026-11-19_material_info_compliance.sql
--
-- 说明：全新建库（docker compose down -v && docker compose up -d）无需手动执行，
--       schema.sql 已包含同样的列定义。
-- ============================================================

SET NAMES utf8mb4;

-- ---------- sf_material_info：增列 ----------
-- 幂等：列已存在时跳过（MySQL 不支持 IF NOT EXISTS，用 information_schema 判断）

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `sf_material_info` ADD COLUMN `manufacturer` varchar(200) DEFAULT NULL COMMENT ''生产厂家'' AFTER `supplier_id`',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_material_info' AND COLUMN_NAME = 'manufacturer'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `sf_material_info` ADD COLUMN `registration_no` varchar(100) DEFAULT NULL COMMENT ''农药登记证号'' AFTER `manufacturer`',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_material_info' AND COLUMN_NAME = 'registration_no'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `sf_material_info` ADD COLUMN `production_license_no` varchar(100) DEFAULT NULL COMMENT ''生产许可证号'' AFTER `registration_no`',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_material_info' AND COLUMN_NAME = 'production_license_no'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `sf_material_info` ADD COLUMN `registration_valid_until` date DEFAULT NULL COMMENT ''农药登记证有效期'' AFTER `production_license_no`',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_material_info' AND COLUMN_NAME = 'registration_valid_until'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `sf_material_info` ADD COLUMN `active_ingredient` varchar(200) DEFAULT NULL COMMENT ''有效成分及含量'' AFTER `registration_valid_until`',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_material_info' AND COLUMN_NAME = 'active_ingredient'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `sf_material_info` ADD COLUMN `toxicity` varchar(50) DEFAULT NULL COMMENT ''毒性等级'' AFTER `active_ingredient`',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_material_info' AND COLUMN_NAME = 'toxicity'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `sf_material_info` ADD COLUMN `shelf_life` int DEFAULT NULL COMMENT ''保质期（月）'' AFTER `toxicity`',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_material_info' AND COLUMN_NAME = 'shelf_life'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `sf_material_info` ADD COLUMN `expiry_date` date DEFAULT NULL COMMENT ''有效期至'' AFTER `shelf_life`',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_material_info' AND COLUMN_NAME = 'expiry_date'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `sf_material_info` ADD COLUMN `storage_condition` varchar(100) DEFAULT NULL COMMENT ''储存条件'' AFTER `expiry_date`',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_material_info' AND COLUMN_NAME = 'storage_condition'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `sf_material_info` ADD COLUMN `barcode` varchar(100) DEFAULT NULL COMMENT ''条形码'' AFTER `storage_condition`',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_material_info' AND COLUMN_NAME = 'barcode'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `sf_material_info` ADD COLUMN `default_location` varchar(100) DEFAULT NULL COMMENT ''默认库位'' AFTER `warehouse_name`',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_material_info' AND COLUMN_NAME = 'default_location'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `sf_material_info` ADD COLUMN `batch_rule` varchar(20) DEFAULT NULL COMMENT ''批次规则：fifo/batch'' AFTER `default_location`',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_material_info' AND COLUMN_NAME = 'batch_rule'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
