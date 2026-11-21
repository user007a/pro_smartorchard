-- ============================================================
-- 增量迁移 · 2026-11-21 · 模型数据来源映射表（N7）
-- ------------------------------------------------------------
-- 背景：模型配置页「数据来源映射」6 行原为写死 HTML（模型/数据类型/
--       数据来源/更新频率），违反铁律 1。改为独立配置表，页面按库渲染，
--       空库显示「暂无数据」。
-- 幂等：CREATE TABLE IF NOT EXISTS + INSERT IGNORE（唯一键 source_code）。
-- 说明：schema.sql / seed.sql 已同步（全新建库无需再跑本迁移）。
-- ============================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `sf_model_data_source` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `source_code` varchar(50) NOT NULL COMMENT '映射编码',
  `model_name` varchar(100) NOT NULL COMMENT '模型名称',
  `data_type` varchar(100) NOT NULL COMMENT '数据类型',
  `source_name` varchar(100) NOT NULL COMMENT '数据来源',
  `update_freq` varchar(50) NOT NULL COMMENT '更新频率',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除：0=正常 1=已删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_model_data_source_code` (`source_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='模型数据来源映射';

INSERT IGNORE INTO `sf_model_data_source`
  (`source_code`, `model_name`, `data_type`, `source_name`, `update_freq`, `sort_order`) VALUES
('MDS01', '生长模型',     '积温数据', '气象站传感器', '每小时',   1),
('MDS02', '气象模型',     '气象预报', '气象局API',    '每6小时',  2),
('MDS03', '病虫害模型',   '虫情数据', '虫情灯设备',   '每天',     3),
('MDS04', '物候期模型',   '历史记录', '系统数据库',   '每周',     4),
('MDS05', '产量预估模型', '果径抽样', '人工录入',     '每周',     5),
('MDS06', '价格预测模型', '市场价格', '市场数据API',  '每天',     6);

-- 结果校验
SELECT `source_code`, `model_name`, `data_type`, `source_name`, `update_freq`
  FROM `sf_model_data_source`
 WHERE `is_deleted` = 0
 ORDER BY `sort_order`;
