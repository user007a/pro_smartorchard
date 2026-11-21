-- ============================================================
-- 增量迁移 · 2026-11-21 · 农资供应商详情字段补列
-- ------------------------------------------------------------
-- 背景：material_supplier.html 的「查看详情」与导出包含
--       供应商类别/供货物资数/账期天数/开户行/银行账号/合作起始日/
--       资质有效期/最近合作时间/累计采购额/资质附件/地址 共 11 项，
--       但 sf_material_supplier 没有对应列：
--       - 详情弹窗这些字段恒显示「-」；
--       - 新增/编辑表单原无输入项，用户无法维护；
--       - 导出 CSV 对应列为空。
--
-- 变更方式：**增量迁移（ADD COLUMN）**，只加列，不改既有列、不动数据。
--           每列先查 information_schema，已存在则跳过（幂等）。
--           schema.sql 已同步；全新库无需执行本脚本。
-- ============================================================

SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS `sp_add_supplier_col`;
DELIMITER //
CREATE PROCEDURE `sp_add_supplier_col`(IN p_col VARCHAR(64), IN p_ddl TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_material_supplier' AND COLUMN_NAME = p_col
  ) THEN
    SET @s = CONCAT('ALTER TABLE `sf_material_supplier` ADD COLUMN ', p_ddl);
    PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  END IF;
END //
DELIMITER ;

CALL `sp_add_supplier_col`('qualifications', '`qualifications` varchar(255) DEFAULT NULL COMMENT ''已具备资质证照（逗号分隔）'' AFTER `qualification_status`');
CALL `sp_add_supplier_col`('supplier_category', '`supplier_category` varchar(20) DEFAULT NULL COMMENT ''供应商类别：企业/合作社/个体户'' AFTER `qualifications`');
CALL `sp_add_supplier_col`('supplied_material_count', '`supplied_material_count` int DEFAULT NULL COMMENT ''供货物资数（项）'' AFTER `supplier_category`');
CALL `sp_add_supplier_col`('settle_days', '`settle_days` int DEFAULT NULL COMMENT ''账期天数'' AFTER `settle_way`');
CALL `sp_add_supplier_col`('bank_name', '`bank_name` varchar(100) DEFAULT NULL COMMENT ''开户行'' AFTER `settle_days`');
CALL `sp_add_supplier_col`('bank_account', '`bank_account` varchar(64) DEFAULT NULL COMMENT ''银行账号'' AFTER `bank_name`');
CALL `sp_add_supplier_col`('cooperate_date', '`cooperate_date` date DEFAULT NULL COMMENT ''合作起始日'' AFTER `bank_account`');
CALL `sp_add_supplier_col`('qual_expire', '`qual_expire` date DEFAULT NULL COMMENT ''资质有效期至'' AFTER `cooperate_date`');
CALL `sp_add_supplier_col`('last_coop_date', '`last_coop_date` date DEFAULT NULL COMMENT ''最近合作时间'' AFTER `qual_expire`');
CALL `sp_add_supplier_col`('total_purchase_amount', '`total_purchase_amount` decimal(14,2) DEFAULT NULL COMMENT ''累计采购额（元）'' AFTER `last_coop_date`');
CALL `sp_add_supplier_col`('qualification_file', '`qualification_file` varchar(255) DEFAULT NULL COMMENT ''资质附件（文件名/地址）'' AFTER `total_purchase_amount`');
CALL `sp_add_supplier_col`('address', '`address` varchar(255) DEFAULT NULL COMMENT ''供应商地址'' AFTER `qualification_file`');

DROP PROCEDURE IF EXISTS `sp_add_supplier_col`;

-- ---------- 结果校验 ----------
SELECT `column_name`, `data_type`
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sf_material_supplier'
  AND `column_name` IN ('qualifications','supplier_category','supplied_material_count','settle_days','bank_name','bank_account',
                        'cooperate_date','qual_expire','last_coop_date','total_purchase_amount','qualification_file','address')
ORDER BY `ordinal_position`;
