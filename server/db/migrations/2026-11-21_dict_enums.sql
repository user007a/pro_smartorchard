-- ============================================================
-- 增量迁移 · 2026-11-21 · 补齐枚举字典（N9 / N10）
-- ------------------------------------------------------------
-- 背景：农事标准级别/状态、农资退库类型、数据归集类别、基地规模分档
--       此前在各页面写成硬编码 <option>，违反铁律 1（数据从库来）与
--       铁律 4（枚举进 sf_dict）。
--       本迁移把这些枚举写入 sf_dict，由前端统一按 dict_code 取数渲染。
--
-- 幂等：INSERT IGNORE 依赖唯一键 uk_dict_code，重复执行不会产生重复行；
--       FARMING_TYPE 仅当仍为初始值时追加缺失项，管理员已自定义则不覆盖。
-- 说明：schema.sql / seed.sql 已同步（全新建库无需再跑本迁移）。
-- ============================================================

SET NAMES utf8mb4;

INSERT IGNORE INTO `sf_dict`
  (`dict_type`, `dict_code`, `dict_name`, `dict_value`, `sort_order`, `dict_status`) VALUES
('标准级别', 'STANDARD_LEVEL', '农事标准级别',
 '[{"value":"国家标准","label":"国家标准"},{"value":"地方标准","label":"地方标准"},{"value":"企业标准","label":"企业标准"}]', 6, 'active'),
('标准状态', 'STANDARD_STATUS', '农事标准状态',
 '[{"value":"现行","label":"现行"},{"value":"试行","label":"试行"},{"value":"废止","label":"废止"}]', 7, 'active'),
('退库类型', 'MATERIAL_RETURN_TYPE', '农资退库单据类型',
 '[{"value":"internal","label":"内部退库","hint":"内部退库：库房之间调拨或退回中心仓库，不涉及供应商"},{"value":"supplier","label":"供应商退货","hint":"供应商退货：退回供应商并完成退款，需关联入库单号"},{"value":"scrap","label":"报废报损","hint":"报废报损：过期、失效或损坏无法使用，审核通过后直接报废"}]', 8, 'active'),
('归集类别', 'DATA_COLLECT_CATEGORY', '数据归集类别',
 '[{"value":"农事","label":"农事"},{"value":"设备","label":"设备"},{"value":"销售","label":"销售"},{"value":"溯源","label":"溯源"},{"value":"环境","label":"环境"},{"value":"其他","label":"其他"}]', 9, 'active'),
('基地规模', 'BASE_SCALE', '基地规模分档',
 '[{"value":"large","label":"大型（1000亩以上）"},{"value":"medium","label":"中型（500-1000亩）"},{"value":"small","label":"小型（500亩以下）"}]', 10, 'active');

-- 农事类型补齐农事标准页在用、但初版字典缺失的项（仅当字典未被自定义时）
UPDATE `sf_dict`
   SET `dict_value` = '疏果,套袋,喷药,灌溉,施肥,修剪,环剥,除草,授粉,疏花疏果,病虫害防治,采收'
 WHERE `dict_code` = 'FARMING_TYPE'
   AND `dict_value` = '疏果,套袋,喷药,灌溉,施肥,修剪,环剥,除草,授粉';

-- 结果校验
SELECT `dict_code`, `dict_name`, `sort_order`
  FROM `sf_dict`
 WHERE `is_deleted` = 0
   AND `dict_code` IN ('STANDARD_LEVEL','STANDARD_STATUS','MATERIAL_RETURN_TYPE',
                       'DATA_COLLECT_CATEGORY','BASE_SCALE','FARMING_TYPE')
 ORDER BY `sort_order`;
