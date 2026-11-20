-- ============================================================
-- 增量迁移 · 2026-11-20 · 合格证电子签章列扩容
-- ------------------------------------------------------------
-- 背景：后台「证书管理 › 农产品合格证」(cert_issue.html) 支持在 Canvas 上
--       手绘电子签章，签章以 PNG 的 base64 dataURL 形式随证书一起落库。
--       但 sf_cert.stamp 是 varchar(100)，而一张 160×70 的手绘 PNG
--       转 base64 后约 8～40 KB → 写入必然报
--       "Data too long for column 'stamp' at row 1"
--       → POST /api/cert/aggregate 整条 500
--       → 页面表现：签完章点「开具合格证」/「保存草稿」毫无反应或报保存失败，
--         且该批次全部证书都无法落库。
--
-- 变更方式：**增量迁移（ALTER TABLE MODIFY COLUMN 扩列）**，
--            只放大列宽、不删列、不动既有行数据
--            （符合《数据设计约定》决策 0 与铁律 6）。
--
-- 说明：schema.sql 已同步为 text，新��建库（docker compose down -v）
--       无需再跑本迁移；本文件供「既有数据卷」重新部署时自动执行。
--
-- 后续演进（不在本次范围）：按铁律 4，图片/附件应上传到文件系统，
--       业务表只存 file_id（sf_cert.file_id 已预留）。待文件上传接口就绪后，
--       可将签章改为 file_id 引用并把本列收回为 varchar。
-- ============================================================

SET NAMES utf8mb4;

-- ---------- sf_cert.stamp：varchar(100) → text ----------
-- 幂等：列已是 text 时跳过（用 information_schema 判断 DATA_TYPE）
SET @sql := (
  SELECT IF(DATA_TYPE = 'text',
    'DO 0',
    'ALTER TABLE `sf_cert` MODIFY COLUMN `stamp` text DEFAULT NULL COMMENT ''电子签章（PNG base64 dataURL）'''
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_cert' AND COLUMN_NAME = 'stamp'
  LIMIT 1
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- 结果校验 ----------
SELECT `column_name`, `data_type`, `character_maximum_length`
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_cert' AND COLUMN_NAME = 'stamp';
