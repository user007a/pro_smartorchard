-- ============================================================
-- 增量迁移：认养指南文案表 sf_adoption_guide
-- 背景：后台「认养浏览 · 展示配置」可编辑认养指南文案，原仅写 localStorage
--       （api.js 严格闸门下业务键不跨刷新持久），移动端 mb_adoption_browse 读不到。
--       本表统一承载指南文案，后台编辑写库、移动端读库渲染。
-- 幂等：CREATE TABLE IF NOT EXISTS，已有库重复执行安全。
-- 日期：2026-11-19
-- ============================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `sf_adoption_guide` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `guide_code` varchar(50) NOT NULL COMMENT '指南编码（唯一，默认 default）',
  `title` varchar(200) DEFAULT NULL COMMENT '指南标题',
  `content` text COMMENT '指南正文（纯文本，移动端按行解析为步骤/权益）',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '最后编辑人',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除：0=正常 1=已删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_adoption_guide_code` (`guide_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='认养指南文案';
