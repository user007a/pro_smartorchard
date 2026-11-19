-- ============================================================
-- 增量迁移 · 2026-11-19 · N1 溯源详情页接库
-- ------------------------------------------------------------
-- 背景：H5 溯源详情页（h5_trace_detail.html）整页硬编码环节内容，
--       与「溯源配置 › C 端展示配置」（sf_trace_stage）没有关联。
--       本迁移给 sf_trace_stage 增列，承载环节详情正文 / 负责人 / 标签等配置。
--
-- 变更方式：**增量迁移（ALTER TABLE ADD COLUMN）**，只加不删，
--            不 DROP 表、不动既有行数据（符合《数据设计约定》决策 0）。
--
-- 执行方式（已有数据卷的运行库）：
--   docker exec -i so-mysql mysql -uroot -proot --default-character-set=utf8mb4 \
--     smartorchard < server/db/migrations/2026-11-19_trace_stage_detail.sql
--
-- 说明：全新建库（docker compose down -v && docker compose up -d）无需手动执行，
--       schema.sql 已包含同样的列定义。
-- ============================================================

SET NAMES utf8mb4;

-- ---------- sf_trace_stage：增列 ----------
-- 幂等：列已存在时跳过（MySQL 不支持 IF NOT EXISTS，用 information_schema 判断）
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `sf_trace_stage` ADD COLUMN `stage_detail` text COMMENT ''环节详情正文（C 端溯源详情页）'' AFTER `stage_desc`',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_trace_stage' AND COLUMN_NAME = 'stage_detail'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `sf_trace_stage` ADD COLUMN `stage_operator` varchar(100) DEFAULT NULL COMMENT ''环节负责人/作业方'' AFTER `stage_detail`',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_trace_stage' AND COLUMN_NAME = 'stage_operator'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `sf_trace_stage` ADD COLUMN `stage_location` varchar(200) DEFAULT NULL COMMENT ''环节作业地点（留空则用批次基地+地块）'' AFTER `stage_operator`',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_trace_stage' AND COLUMN_NAME = 'stage_location'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `sf_trace_stage` ADD COLUMN `stage_tags` varchar(500) DEFAULT NULL COMMENT ''环节标签（逗号分隔）'' AFTER `stage_location`',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_trace_stage' AND COLUMN_NAME = 'stage_tags'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `sf_trace_stage` ADD COLUMN `stage_img` varchar(200) DEFAULT NULL COMMENT ''环节配图文件名（相对 applefarm_h5/images/）'' AFTER `stage_tags`',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_trace_stage' AND COLUMN_NAME = 'stage_img'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `sf_trace_stage` ADD COLUMN `day_offset` int DEFAULT ''0'' COMMENT ''相对批次采收日期的天数偏移（负数=采收前）'' AFTER `stage_img`',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_trace_stage' AND COLUMN_NAME = 'day_offset'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- 初始化 7 个固定环节的基础配置 ----------
-- 环节编码固定 7 值（uk_trace_stage_code 唯一键）；只在此表为空时插入，
-- 已有配置不覆盖（生产库由后台「溯源配置 › C 端展示配置」维护）。
INSERT INTO `sf_trace_stage`
  (`stage_code`, `stage_name`, `stage_icon`, `stage_desc`, `stage_detail`, `stage_operator`, `stage_tags`, `stage_img`, `day_offset`, `sort_order`, `status`)
SELECT * FROM (
  SELECT 'planting'   AS c, '种植管理' AS n, '🌱' AS i, '果园种植与定植管理' AS d, '按有机种植标准完成地块整理、苗木定植与前期养护，全程记录投入品使用情况。' AS det, '' AS op, '有机认证,绿色种植' AS tg, 'images/trace_planting.jpg' AS img, -35 AS off, 1 AS so, 'active' AS st
  UNION ALL SELECT 'pruning',    '修剪疏果', '✂️', '树形修剪与疏花疏果', '采用开心形整形方式修剪，去除过密枝条与徒长枝，并按负载量疏花疏果，保证通风透光与坐果均匀。', '', '专业修剪,科学疏果', 'images/trace_pruning.jpg', -25, 2, 'active'
  UNION ALL SELECT 'bagging',    '套袋保护', '🛡️', '果实套袋与防护', '采用双层纸袋套袋，外层棕色木浆纸、内层红色涂蜡纸，有效阻隔病虫害并降低农药残留。', '', '双层纸袋,减少农残', 'images/trace_bagging.jpg', -15, 3, 'active'
  UNION ALL SELECT 'fertilizer', '施肥喷药', '🌿', '追肥与植保作业', '使用生物有机肥配合叶面肥追施，植保采用绿色防控与生物防治措施，记录投入品批次与用量。', '', '生物有机肥,绿色防控', 'images/trace_fertilizer.jpg', -3, 4, 'active'
  UNION ALL SELECT 'testing',    '农残检测', '🔬', '第三方农残检测', '由具备资质的第三方检测机构进行农残检测，出具检测报告并记录检测项目与结论。', '第三方检测机构', '第三方检测,检测合格', 'images/trace_testing.jpg', -1, 5, 'active'
  UNION ALL SELECT 'harvest',    '采摘入库', '🍎', '采摘与入库分级', '人工采摘并按分级标准挑选，预冷后入库，记录采摘时间、批次重量与等级。', '', '人工采摘,冷链入库', 'images/trace_harvest.jpg', 0, 6, 'active'
  UNION ALL SELECT 'coldchain',  '冷链配送', '🚚', '冷链运输与配送', '全程冷链配送，运输车厢温度维持在 2-8℃，记录发运与签收信息。', '', '全程冷链,实时追踪', 'images/trace_coldchain.jpg', 2, 7, 'active'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM `sf_trace_stage` WHERE `is_deleted` = 0);

-- ---------- 结果校验 ----------
SELECT `stage_code`, `stage_name`, `stage_img`, `day_offset`, `sort_order`, `status`
FROM `sf_trace_stage` WHERE `is_deleted` = 0 ORDER BY `sort_order` ASC;
