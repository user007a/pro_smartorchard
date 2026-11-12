-- ============================================================
-- 智慧果园平台 · 数据库建表脚本（全量 143 张表）
-- 来源：由运行中的容器数据库 so-mysql / `smartorchard` 反向导出生成
-- 说明：本文件与当前可用数据库结构完全一致；开发阶段以本文件为准。
--       首次部署由 docker 自动加载（挂载为 01_schema.sql）；
--       亦可手动执行：mysql -uroot -p smartorchard < server/db/schema.sql
-- 数据库：MySQL 8.x
-- ============================================================

-- ------------------------------------------------------

-- ============================================================
-- 【全局公共表（字典 / 文件 / 日志）】
-- ============================================================

SET NAMES utf8mb4;

DROP TABLE IF EXISTS `sf_dict`;
CREATE TABLE `sf_dict` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `dict_type` varchar(50) NOT NULL COMMENT '字典类型（如 产品等级/农事类型）',
  `dict_code` varchar(50) NOT NULL COMMENT '字典编码（如 GRADE_TYPE）',
  `dict_name` varchar(100) NOT NULL COMMENT '字典名称（如 苹果等级分类）',
  `dict_value` varchar(500) NOT NULL COMMENT '字典值（逗号分隔的枚举项，如 特级,一级,二级,等外）',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `dict_status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态：active/disabled',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除：0=正常 1=已删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dict_code` (`dict_code`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='数据字典';

DROP TABLE IF EXISTS `sf_file`;
CREATE TABLE `sf_file` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `file_name` varchar(255) NOT NULL COMMENT '原始文件名',
  `file_type` varchar(20) NOT NULL COMMENT '类型：image/video/document',
  `file_size` bigint NOT NULL DEFAULT '0' COMMENT '大小（字节）',
  `store_path` varchar(500) NOT NULL COMMENT '实际存储路径',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='文件';

DROP TABLE IF EXISTS `sf_operation_log`;
CREATE TABLE `sf_operation_log` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id` bigint DEFAULT NULL COMMENT '操作人（→ sf_user.id）',
  `module` varchar(50) NOT NULL COMMENT '模块',
  `action` varchar(20) NOT NULL COMMENT '动作：新增/修改/删除/导出/登录',
  `target_id` bigint DEFAULT NULL COMMENT '操作对象 ID',
  `detail` text COMMENT '详情',
  `ip` varchar(50) DEFAULT NULL COMMENT '来源 IP',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_log_user` (`user_id`),
  KEY `idx_log_module` (`module`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='操作日志';

-- ============================================================
-- 【企业管理（企业信息 / 基地 / 地块 / 土壤检测 / VR 全景）】
-- ============================================================

DROP TABLE IF EXISTS `sf_enterprise`;
CREATE TABLE `sf_enterprise` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name` varchar(200) NOT NULL COMMENT '企业名称',
  `credit_code` varchar(50) DEFAULT NULL COMMENT '统一信用代码',
  `legal_person` varchar(50) DEFAULT NULL COMMENT '法定代表人',
  `capital` decimal(16,2) DEFAULT NULL COMMENT '注册资本（万元）',
  `establish_date` date DEFAULT NULL COMMENT '成立日期',
  `enterprise_type` varchar(50) DEFAULT NULL COMMENT '企业类型（→ sf_dict）',
  `industry` varchar(100) DEFAULT NULL COMMENT '所属行业',
  `biz_status` varchar(50) DEFAULT NULL COMMENT '经营状态（→ sf_dict）',
  `address` varchar(300) DEFAULT NULL COMMENT '注册地址',
  `scope` text COMMENT '经营范围',
  `term_start` date DEFAULT NULL COMMENT '营业期限起',
  `term_end` date DEFAULT NULL COMMENT '营业期限止（长期为空）',
  `authority` varchar(100) DEFAULT NULL COMMENT '登记机关',
  `banner_file_id` bigint DEFAULT NULL COMMENT '横幅图（→ sf_file.id）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='企业基本信息';

DROP TABLE IF EXISTS `sf_enterprise_biz`;
CREATE TABLE `sf_enterprise_biz` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `enterprise_id` bigint DEFAULT NULL COMMENT '企业（→ sf_enterprise.id）',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `icon` varchar(20) DEFAULT NULL COMMENT '图标',
  `color` varchar(20) DEFAULT NULL COMMENT '色值标识',
  `name` varchar(100) NOT NULL COMMENT '业务名称',
  `description` text COMMENT '业务描述',
  `m1_label` varchar(50) DEFAULT NULL COMMENT '指标1名称',
  `m1_value` varchar(50) DEFAULT NULL COMMENT '指标1数值',
  `m2_label` varchar(50) DEFAULT NULL COMMENT '指标2名称',
  `m2_value` varchar(50) DEFAULT NULL COMMENT '指标2数值',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='企业业务结构';

DROP TABLE IF EXISTS `sf_enterprise_staff`;
CREATE TABLE `sf_enterprise_staff` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `enterprise_id` bigint DEFAULT NULL COMMENT '企业（→ sf_enterprise.id）',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `role_type` varchar(50) NOT NULL COMMENT '角色分类（→ sf_dict：管理/销售/技术/作业/后勤/其他）',
  `count` int NOT NULL DEFAULT '0' COMMENT '人员数量',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='企业人员规模';

DROP TABLE IF EXISTS `sf_enterprise_expert`;
CREATE TABLE `sf_enterprise_expert` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `enterprise_id` bigint DEFAULT NULL COMMENT '企业（→ sf_enterprise.id）',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `name` varchar(50) NOT NULL COMMENT '专家姓名',
  `avatar_file_id` bigint DEFAULT NULL COMMENT '头像（→ sf_file.id）',
  `role` varchar(50) DEFAULT NULL COMMENT '专家职务',
  `org` varchar(200) DEFAULT NULL COMMENT '所属机构',
  `join_date` date DEFAULT NULL COMMENT '加入日期',
  `description` text COMMENT '简介',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='企业专家团队';

DROP TABLE IF EXISTS `sf_enterprise_cert`;
CREATE TABLE `sf_enterprise_cert` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `enterprise_id` bigint DEFAULT NULL COMMENT '企业（→ sf_enterprise.id）',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `cert_type` varchar(50) DEFAULT NULL COMMENT '资质类型（→ sf_dict）',
  `cert_no` varchar(100) DEFAULT NULL COMMENT '证书编号',
  `org` varchar(200) DEFAULT NULL COMMENT '发证机构',
  `issue_date` date DEFAULT NULL COMMENT '发证日期',
  `expire_date` date DEFAULT NULL COMMENT '有效期至',
  `file_id` bigint DEFAULT NULL COMMENT '证书图片（→ sf_file.id）',
  `top_show` tinyint NOT NULL DEFAULT '0' COMMENT '顶部显示：0=否 1=是',
  `cert_status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态：active/expired/revoked',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_cert_enterprise` (`enterprise_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='企业资质证书';

DROP TABLE IF EXISTS `sf_enterprise_timeline`;
CREATE TABLE `sf_enterprise_timeline` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `enterprise_id` bigint DEFAULT NULL COMMENT '企业（→ sf_enterprise.id）',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `timeline_date` varchar(50) DEFAULT NULL COMMENT '时间（如"2010年10月"）',
  `title` varchar(100) NOT NULL COMMENT '标题',
  `description` text COMMENT '描述',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='企业发展历程';

DROP TABLE IF EXISTS `sf_enterprise_operation`;
CREATE TABLE `sf_enterprise_operation` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `enterprise_id` bigint DEFAULT NULL COMMENT '企业（→ sf_enterprise.id）',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `label` varchar(100) NOT NULL COMMENT '经营指标',
  `value` decimal(16,2) DEFAULT NULL COMMENT '经营数值',
  `unit` varchar(20) DEFAULT NULL COMMENT '单位（万元/吨/亩/项/户）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='企业经营数据';

DROP TABLE IF EXISTS `sf_base`;
CREATE TABLE `sf_base` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `code` varchar(50) DEFAULT NULL COMMENT '基地编号',
  `name` varchar(100) NOT NULL COMMENT '基地名称（唯一）',
  `base_status` varchar(20) NOT NULL DEFAULT 'planning' COMMENT '状态：planning/built/active/disabled',
  `address` varchar(255) DEFAULT NULL COMMENT '地址',
  `area` decimal(12,2) DEFAULT NULL COMMENT '面积（亩）',
  `manager_id` bigint DEFAULT NULL COMMENT '负责人（→ sf_user.id）',
  `manager_name` varchar(100) DEFAULT NULL COMMENT '负责人姓名',
  `phone` varchar(20) DEFAULT NULL COMMENT '联系电话',
  `base_images` varchar(2000) DEFAULT NULL COMMENT '基地图片JSON',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_base_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='基地';

DROP TABLE IF EXISTS `sf_plot`;
CREATE TABLE `sf_plot` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `code` varchar(50) DEFAULT NULL COMMENT '地块编号',
  `name` varchar(100) NOT NULL COMMENT '地块名称（唯一）',
  `plot_type` varchar(20) DEFAULT NULL COMMENT '地块类型（→ sf_dict）',
  `base_id` bigint DEFAULT NULL COMMENT '所属基地（→ sf_base.id）',
  `variety_code` varchar(50) DEFAULT NULL COMMENT '果树品种（→ sf_dict）',
  `manager_id` bigint DEFAULT NULL COMMENT '负责人（→ sf_user.id）',
  `area` decimal(12,2) DEFAULT NULL COMMENT '面积（亩）',
  `plant_year` varchar(10) DEFAULT NULL COMMENT '种植年份',
  `lng` decimal(10,6) DEFAULT NULL COMMENT '经度',
  `lat` decimal(10,6) DEFAULT NULL COMMENT '纬度',
  `plot_status` varchar(20) NOT NULL DEFAULT 'normal' COMMENT '状态：normal/warning/danger/fallow/maintain',
  `audit_status` varchar(20) DEFAULT NULL COMMENT '审核状态：pending/approved/rejected',
  `source` varchar(20) NOT NULL DEFAULT 'backend' COMMENT '来源：backend/mobile',
  `boundary` text COMMENT '边界多边形顶点JSON（移动端手绘）',
  `reviewer` varchar(100) DEFAULT NULL COMMENT '审核人',
  `review_remark` varchar(500) DEFAULT NULL COMMENT '审核意见',
  `review_time` datetime DEFAULT NULL COMMENT '审核时间',
  `draw_time` datetime DEFAULT NULL COMMENT '绘制时间',
  `remark` varchar(500) DEFAULT NULL COMMENT '绘制说明',
  `file_id` bigint DEFAULT NULL COMMENT '实景图（→ sf_file.id）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_plot_name` (`name`),
  KEY `idx_plot_base` (`base_id`),
  KEY `idx_plot_manager` (`manager_id`),
  KEY `idx_plot_audit` (`audit_status`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='地块';

DROP TABLE IF EXISTS `sf_soil_test`;
CREATE TABLE `sf_soil_test` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `test_code` varchar(50) DEFAULT NULL COMMENT '检测编号',
  `plot_id` bigint DEFAULT NULL COMMENT '地块（→ sf_plot.id）',
  `sample_date` date DEFAULT NULL COMMENT '采样日期',
  `lab` varchar(100) DEFAULT NULL COMMENT '化验室/检测机构',
  `organic_matter` decimal(5,2) DEFAULT NULL COMMENT '有机质(%)',
  `available_n` decimal(6,2) DEFAULT NULL COMMENT '速效氮(mg/kg)',
  `available_p` decimal(6,2) DEFAULT NULL COMMENT '速效磷(mg/kg)',
  `available_k` decimal(6,2) DEFAULT NULL COMMENT '速效钾(mg/kg)',
  `ph` decimal(4,2) DEFAULT NULL COMMENT 'pH',
  `ec` decimal(8,2) DEFAULT NULL COMMENT 'EC(μS/cm)',
  `source` varchar(20) DEFAULT NULL COMMENT '来源',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_soil_plot` (`plot_id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='土壤检测记录';

DROP TABLE IF EXISTS `sf_vr_scene`;
CREATE TABLE `sf_vr_scene` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `scene_code` varchar(50) DEFAULT NULL COMMENT '场景编码（如 scene_main）',
  `name` varchar(100) NOT NULL COMMENT '场景名称',
  `base_id` bigint DEFAULT NULL COMMENT '所属基地（→ sf_base.id）',
  `base_name` varchar(100) DEFAULT NULL COMMENT '基地名称',
  `plot_id` bigint DEFAULT NULL COMMENT '所属地块（→ sf_plot.id）',
  `plot_code` varchar(50) DEFAULT NULL COMMENT '地块编码',
  `plot_name` varchar(100) DEFAULT NULL COMMENT '地块名称',
  `scene_type` varchar(20) DEFAULT NULL COMMENT '场景类型：entrance/plot/...（→ sf_dict）',
  `scene_status` varchar(20) DEFAULT NULL COMMENT '状态：published/draft',
  `image_file_id` bigint DEFAULT NULL COMMENT '全景图（→ sf_file.id）',
  `image` varchar(500) DEFAULT NULL COMMENT '全景图URL',
  `resolution` varchar(50) DEFAULT NULL COMMENT '分辨率',
  `desc` varchar(500) DEFAULT NULL COMMENT '描述',
  `views` int DEFAULT '0' COMMENT '浏览量',
  `shot_date` date DEFAULT NULL COMMENT '拍摄日期',
  `yaw` decimal(6,2) DEFAULT '180.00' COMMENT '初始水平角',
  `pitch` decimal(6,2) DEFAULT '0.00' COMMENT '初始俯仰角',
  `hfov` decimal(6,2) DEFAULT '100.00' COMMENT '视场角',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='VR全景场景';

DROP TABLE IF EXISTS `sf_vr_hotspot`;
CREATE TABLE `sf_vr_hotspot` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `scene_id` bigint NOT NULL COMMENT '所属场景（→ sf_vr_scene.id）',
  `hotspot_code` varchar(50) DEFAULT NULL COMMENT '热点编码',
  `hotspot_type` varchar(20) DEFAULT NULL COMMENT '热点类型：plot/device/task/building/scene',
  `title` varchar(100) NOT NULL COMMENT '标题',
  `content` text COMMENT '内容（HTML）',
  `target_id` varchar(100) DEFAULT NULL COMMENT '关联目标（地块/设备/任务等）',
  `pitch` decimal(6,2) DEFAULT '0.00' COMMENT '俯仰角',
  `yaw` decimal(6,2) DEFAULT '0.00' COMMENT '水平角',
  `hotspot_status` varchar(20) DEFAULT 'normal' COMMENT '状态：normal/warning/danger',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_hotspot_scene` (`scene_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='VR全景热点';

DROP TABLE IF EXISTS `sf_highlight`;
CREATE TABLE `sf_highlight` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `highlight_code` varchar(50) DEFAULT NULL COMMENT '亮点编码',
  `item` varchar(100) DEFAULT NULL COMMENT '指标项',
  `value` varchar(100) DEFAULT NULL COMMENT '数值',
  `unit` varchar(20) DEFAULT NULL COMMENT '单位',
  `description` varchar(500) DEFAULT NULL COMMENT '描述',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_highlight_code` (`highlight_code`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='数据运营亮点';

-- ============================================================
-- 【生产管理（农事计划 / 任务 / 记录 / 巡园 / 无人机 / 标准）】
-- ============================================================

DROP TABLE IF EXISTS `sf_farming_plan`;
CREATE TABLE `sf_farming_plan` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `plan_code` varchar(50) NOT NULL COMMENT '计划编号（唯一）',
  `plan_name` varchar(100) NOT NULL COMMENT '计划名称',
  `plan_type` varchar(20) DEFAULT NULL COMMENT '类型（枚举→字典：年度/季度/月度等）',
  `base_id` bigint DEFAULT NULL COMMENT '所属基地（→ sf_base.id）',
  `plot_ids` varchar(500) DEFAULT NULL COMMENT '地块范围（多地块ID，逗号分隔）',
  `manager_id` bigint DEFAULT NULL COMMENT '负责人（→ sf_user.id）',
  `standard_id` bigint DEFAULT NULL COMMENT '引用标准（→ sf_guide_standard.id）',
  `start_date` date DEFAULT NULL COMMENT '开始日期',
  `end_date` date DEFAULT NULL COMMENT '结束日期',
  `status` varchar(20) NOT NULL DEFAULT 'draft' COMMENT '状态：draft/pending/approved/rejected/in_progress/done',
  `progress` decimal(5,2) DEFAULT NULL COMMENT '完成率（0-100）',
  `planned_qty` decimal(12,2) DEFAULT NULL COMMENT '计划量',
  `actual_qty` decimal(12,2) DEFAULT NULL COMMENT '实际量',
  `unit` varchar(20) DEFAULT NULL COMMENT '单位（亩/个）',
  `plot_range` varchar(500) DEFAULT NULL COMMENT '地块范围（描述）',
  `standard_name` varchar(100) DEFAULT NULL COMMENT '引用标准名称',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_farming_plan_code` (`plan_code`),
  KEY `idx_farming_plan_base` (`base_id`),
  KEY `idx_farming_plan_manager` (`manager_id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='农事计划';

DROP TABLE IF EXISTS `sf_farming_task`;
CREATE TABLE `sf_farming_task` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `task_code` varchar(50) NOT NULL COMMENT '任务编号（唯一）',
  `task_name` varchar(100) NOT NULL COMMENT '任务名称',
  `plan_id` bigint DEFAULT NULL COMMENT '来源计划（→ sf_farming_plan.id）',
  `category` varchar(20) DEFAULT NULL COMMENT '类别（枚举→字典）',
  `task_category` varchar(20) DEFAULT NULL COMMENT '任务大类：farming/patrol',
  `type_code` varchar(20) DEFAULT NULL COMMENT '农事类型编码',
  `priority` varchar(20) DEFAULT NULL COMMENT '优先级（枚举→字典：高/中/低）',
  `base_id` bigint DEFAULT NULL COMMENT '基地（→ sf_base.id）',
  `plot_ids` varchar(500) DEFAULT NULL COMMENT '地块（多地块ID，逗号分隔）',
  `plot_name` varchar(100) DEFAULT NULL COMMENT '地块名称（展示）',
  `manager_id` bigint DEFAULT NULL COMMENT '负责人（→ sf_user.id）',
  `team` varchar(100) DEFAULT NULL COMMENT '班组',
  `executor` varchar(200) DEFAULT NULL COMMENT '执行主体',
  `plan_time` datetime DEFAULT NULL COMMENT '计划时间',
  `deadline` datetime DEFAULT NULL COMMENT '截止时间',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/in_progress/done/overdue',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_farming_task_code` (`task_code`),
  KEY `idx_farming_task_plan` (`plan_id`),
  KEY `idx_farming_task_base` (`base_id`),
  KEY `idx_farming_task_manager` (`manager_id`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='农事任务';

DROP TABLE IF EXISTS `sf_farming_record`;
CREATE TABLE `sf_farming_record` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `record_code` varchar(50) NOT NULL COMMENT '记录编号（唯一）',
  `plan_id` bigint DEFAULT NULL COMMENT '关联计划（→ sf_farming_plan.id）',
  `task_id` bigint DEFAULT NULL COMMENT '关联任务（→ sf_farming_task.id）',
  `base_id` bigint DEFAULT NULL COMMENT '所属基地（→ sf_base.id）',
  `plot_ids` varchar(500) DEFAULT NULL COMMENT '地块范围',
  `farm_type` varchar(20) DEFAULT NULL COMMENT '农事类型（枚举→字典：施肥/喷药/修剪/灌溉/其他）',
  `type_code` varchar(20) DEFAULT NULL COMMENT '农事类型编码',
  `type_name` varchar(50) DEFAULT NULL COMMENT '农事类型名称',
  `material_type` varchar(20) DEFAULT NULL COMMENT '农资类型（枚举→字典：肥料/农药/工具）',
  `plot_code` varchar(50) DEFAULT NULL COMMENT '地块编号（D-001）',
  `executor` varchar(100) DEFAULT NULL COMMENT '执行人',
  `execute_date` date DEFAULT NULL COMMENT '执行日期',
  `complete_amount` decimal(12,2) DEFAULT NULL COMMENT '完成量',
  `unit` varchar(20) DEFAULT NULL COMMENT '单位（亩/个）',
  `area` decimal(12,2) DEFAULT NULL COMMENT '面积',
  `content` varchar(1000) DEFAULT NULL COMMENT '执行内容',
  `photo` varchar(500) DEFAULT NULL COMMENT '照片',
  `audit_remark` varchar(500) DEFAULT NULL COMMENT '审核备注',
  `source` varchar(20) DEFAULT NULL COMMENT '来源：pc/mobile',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_farming_record_code` (`record_code`),
  KEY `idx_farming_record_plan` (`plan_id`),
  KEY `idx_farming_record_task` (`task_id`),
  KEY `idx_farming_record_base` (`base_id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='农事记录';

DROP TABLE IF EXISTS `sf_patrol_plan`;
CREATE TABLE `sf_patrol_plan` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `plan_code` varchar(50) NOT NULL COMMENT '巡查编号（唯一）',
  `base_id` bigint DEFAULT NULL COMMENT '所属基地（→ sf_base.id）',
  `patrol_type` varchar(20) DEFAULT NULL COMMENT '巡查类型（枚举→字典：日常/专项/病虫害/气象/生长）',
  `plot_ids` varchar(500) DEFAULT NULL COMMENT '巡查地块',
  `route_id` bigint DEFAULT NULL COMMENT '巡园路线（→ sf_patrol_route.id）',
  `route_name` varchar(100) DEFAULT NULL COMMENT '巡园路线名称（展示）',
  `patrol_user` varchar(100) DEFAULT NULL COMMENT '巡查人员',
  `patrol_time` datetime DEFAULT NULL COMMENT '巡查时间',
  `frequency` varchar(20) DEFAULT NULL COMMENT '频次',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态',
  `problem` varchar(200) DEFAULT NULL COMMENT '发现问题',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_patrol_plan_code` (`plan_code`),
  KEY `idx_patrol_plan_base` (`base_id`),
  KEY `idx_patrol_plan_route` (`route_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='巡园计划';

DROP TABLE IF EXISTS `sf_patrol_route`;
CREATE TABLE `sf_patrol_route` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `route_code` varchar(50) NOT NULL COMMENT '路线编号（唯一）',
  `route_name` varchar(100) NOT NULL COMMENT '路线名称',
  `base_id` bigint DEFAULT NULL COMMENT '覆盖基地（→ sf_base.id）',
  `coverage` varchar(500) DEFAULT NULL COMMENT '覆盖区域',
  `point_count` int DEFAULT NULL COMMENT '点位数',
  `required_count` int DEFAULT NULL COMMENT '必巡点数',
  `points` text COMMENT '巡园点位（JSON 数组）',
  `enabled` tinyint NOT NULL DEFAULT '1' COMMENT '是否启用：0=否 1=是',
  `frequency` varchar(20) DEFAULT NULL COMMENT '频次',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_patrol_route_code` (`route_code`),
  KEY `idx_patrol_route_base` (`base_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='巡园路线';

DROP TABLE IF EXISTS `sf_patrol_abnormal`;
CREATE TABLE `sf_patrol_abnormal` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `abnormal_code` varchar(50) NOT NULL COMMENT '异常编号（唯一）',
  `source` varchar(20) DEFAULT NULL COMMENT '来源：patrol/drone',
  `base_id` bigint DEFAULT NULL COMMENT '所属基地（→ sf_base.id）',
  `plot_id` bigint DEFAULT NULL COMMENT '巡查地块（→ sf_plot.id）',
  `plot_code` varchar(50) DEFAULT NULL COMMENT '地块编号（D-006）',
  `route_id` bigint DEFAULT NULL COMMENT '关联巡园路线（→ sf_patrol_route.id）',
  `abnormal_type` varchar(20) DEFAULT NULL COMMENT '异常类型（枚举→字典）',
  `abnormal_desc` varchar(500) DEFAULT NULL COMMENT '异常说明',
  `reporter` varchar(100) DEFAULT NULL COMMENT '上报人',
  `report_time` datetime DEFAULT NULL COMMENT '上报时间',
  `severity` varchar(20) DEFAULT NULL COMMENT '严重程度：low/medium/high',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/processing/done',
  `handle_result` varchar(200) DEFAULT NULL COMMENT '处置结果',
  `handle_remark` varchar(500) DEFAULT NULL COMMENT '处置说明',
  `handle_time` datetime DEFAULT NULL COMMENT '处置时间',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_patrol_abnormal_code` (`abnormal_code`),
  KEY `idx_patrol_abnormal_base` (`base_id`),
  KEY `idx_patrol_abnormal_plot` (`plot_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='巡园异常上报';

DROP TABLE IF EXISTS `sf_drone_patrol`;
CREATE TABLE `sf_drone_patrol` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `task_code` varchar(50) NOT NULL COMMENT '任务编号（唯一）',
  `sortie` varchar(50) DEFAULT NULL COMMENT '架次',
  `drone_task_name` varchar(100) DEFAULT NULL COMMENT '任务名称（展示）',
  `base_id` bigint DEFAULT NULL COMMENT '所属基地（→ sf_base.id）',
  `drone` varchar(100) DEFAULT NULL COMMENT '无人机',
  `plot_ids` varchar(500) DEFAULT NULL COMMENT '巡查地块',
  `route_id` bigint DEFAULT NULL COMMENT '关联路线（→ sf_patrol_route.id）',
  `flight_area` decimal(12,2) DEFAULT NULL COMMENT '飞行面积（亩）',
  `progress` decimal(5,2) DEFAULT NULL COMMENT '进度（0-100）',
  `rtk` varchar(50) DEFAULT NULL COMMENT 'RTK',
  `flight_height` varchar(50) DEFAULT NULL COMMENT '航高',
  `speed` varchar(50) DEFAULT NULL COMMENT '速度',
  `route` varchar(500) DEFAULT NULL COMMENT '航线',
  `plan_time` datetime DEFAULT NULL COMMENT '计划时间',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态',
  `created_by` varchar(100) DEFAULT NULL COMMENT '创建人',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_drone_patrol_code` (`task_code`),
  KEY `idx_drone_patrol_base` (`base_id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='无人机巡检';

DROP TABLE IF EXISTS `sf_guide_standard`;
CREATE TABLE `sf_guide_standard` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `standard_code` varchar(50) NOT NULL COMMENT '标准编号（唯一）',
  `standard_name` varchar(100) NOT NULL COMMENT '标准名称',
  `farm_type` varchar(20) DEFAULT NULL COMMENT '农事类型（枚举→字典）',
  `level` varchar(20) DEFAULT NULL COMMENT '级别（枚举→字典）',
  `variety` varchar(100) DEFAULT NULL COMMENT '适用品种',
  `key_process` varchar(500) DEFAULT NULL COMMENT '关键工序',
  `dosage` varchar(200) DEFAULT NULL COMMENT '用量',
  `accept_index` varchar(200) DEFAULT NULL COMMENT '验收指标',
  `effective_date` date DEFAULT NULL COMMENT '生效日期',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态：active/inactive',
  `referenced` int DEFAULT '0' COMMENT '被引用次数',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_guide_standard_code` (`standard_code`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='农事标准';

DROP TABLE IF EXISTS `sf_drone_flight_log`;
CREATE TABLE `sf_drone_flight_log` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `log_code` varchar(50) NOT NULL COMMENT '日志编号（唯一）',
  `sortie_id` varchar(50) DEFAULT NULL COMMENT '架次编号（→ sf_drone_patrol.task_code）',
  `task_code` varchar(50) DEFAULT NULL COMMENT '关联任务（→ sf_drone_patrol.task_code）',
  `event` varchar(50) DEFAULT NULL COMMENT '事件（起飞/暂停/恢复/返航/降落）',
  `altitude` varchar(50) DEFAULT NULL COMMENT '航高',
  `speed` varchar(50) DEFAULT NULL COMMENT '速度',
  `battery` int DEFAULT NULL COMMENT '电量（%）',
  `event_time` datetime DEFAULT NULL COMMENT '事件时间',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_drone_flight_log_code` (`log_code`),
  KEY `idx_flight_log_sortie` (`sortie_id`)
) ENGINE=InnoDB AUTO_INCREMENT=63 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='无人机飞行日志';

DROP TABLE IF EXISTS `sf_patrol_checkin`;
CREATE TABLE `sf_patrol_checkin` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `checkin_code` varchar(50) NOT NULL COMMENT '打卡编号（唯一）',
  `patrol_plan_id` bigint DEFAULT NULL COMMENT '关联巡园计划（→ sf_patrol_plan.id）',
  `route_id` bigint DEFAULT NULL COMMENT '关联巡园路线（→ sf_patrol_route.id）',
  `base_id` bigint DEFAULT NULL COMMENT '所属基地（→ sf_base.id）',
  `patrol_type` varchar(20) DEFAULT NULL COMMENT '巡查类型',
  `plot_ids` varchar(500) DEFAULT NULL COMMENT '巡查地块（逗号分隔）',
  `inspector` varchar(100) DEFAULT NULL COMMENT '巡查人',
  `checkin_time` datetime DEFAULT NULL COMMENT '打卡时间',
  `issue_code` varchar(20) DEFAULT NULL COMMENT '问题码（normal/warning/danger）',
  `issue_name` varchar(200) DEFAULT NULL COMMENT '问题名称',
  `points_done` int DEFAULT '0' COMMENT '已完成点数',
  `points_total` int DEFAULT '0' COMMENT '总点数',
  `status` varchar(20) NOT NULL DEFAULT 'completed' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_patrol_checkin_code` (`checkin_code`),
  KEY `idx_checkin_plan` (`patrol_plan_id`),
  KEY `idx_checkin_route` (`route_id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='巡园打卡记录';

-- ============================================================
-- 【采收管理（采收计划 / 记录 / 采后 / 发货 / 储藏）】
-- ============================================================

DROP TABLE IF EXISTS `sf_harvest_plan`;
CREATE TABLE `sf_harvest_plan` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `plan_code` varchar(50) NOT NULL COMMENT '计划编号（唯一）',
  `batch_no` varchar(50) DEFAULT NULL COMMENT '批次号',
  `plot_code` varchar(50) DEFAULT NULL,
  `plot_name` varchar(100) DEFAULT NULL,
  `variety` varchar(100) DEFAULT NULL,
  `plan_name` varchar(100) NOT NULL COMMENT '计划名称',
  `base_id` bigint DEFAULT NULL COMMENT '基地（→ sf_base.id）',
  `estimate_amount` decimal(12,2) DEFAULT NULL COMMENT '预计采收量(kg)',
  `actual_amount` decimal(12,2) DEFAULT NULL COMMENT '实采量(kg)',
  `unit` varchar(20) DEFAULT 'kg',
  `manager_id` bigint DEFAULT NULL COMMENT '负责人（→ sf_user.id）',
  `manager_name` varchar(100) DEFAULT NULL,
  `start_time` datetime DEFAULT NULL COMMENT '计划开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '计划结束时间',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/in_progress/done',
  `remark` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_harvest_plan_code` (`plan_code`),
  KEY `idx_harvest_plan_base` (`base_id`),
  KEY `idx_harvest_plan_batch` (`batch_no`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='采收计划';

DROP TABLE IF EXISTS `sf_harvest_record`;
CREATE TABLE `sf_harvest_record` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `record_code` varchar(50) NOT NULL COMMENT '记录编号（唯一）',
  `plan_id` bigint DEFAULT NULL COMMENT '关联计划（→ sf_harvest_plan.id）',
  `batch_no` varchar(50) DEFAULT NULL COMMENT '批次号',
  `base_id` bigint DEFAULT NULL COMMENT '所属基地（→ sf_base.id）',
  `plot_id` bigint DEFAULT NULL COMMENT '地块（→ sf_plot.id）',
  `plot_code` varchar(50) DEFAULT NULL,
  `plot_name` varchar(100) DEFAULT NULL,
  `variety` varchar(100) DEFAULT NULL COMMENT '品种（枚举→字典）',
  `amount` decimal(12,2) DEFAULT NULL COMMENT '采收量(kg)',
  `unit` varchar(20) DEFAULT 'kg',
  `grade` varchar(20) DEFAULT NULL COMMENT '等级（枚举→字典：一级/二级/三级）',
  `grade_name` varchar(50) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/processing/done',
  `harvest_date` date DEFAULT NULL COMMENT '采收日期',
  `harvest_user` varchar(100) DEFAULT NULL COMMENT '采收人员',
  `start_time` datetime DEFAULT NULL,
  `end_time` datetime DEFAULT NULL,
  `trace_code` varchar(100) DEFAULT NULL,
  `remark` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_harvest_record_code` (`record_code`),
  KEY `idx_harvest_record_plan` (`plan_id`),
  KEY `idx_harvest_record_batch` (`batch_no`),
  KEY `idx_harvest_record_base` (`base_id`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='采收记录';

DROP TABLE IF EXISTS `sf_harvest_process`;
CREATE TABLE `sf_harvest_process` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `process_code` varchar(50) NOT NULL COMMENT '批次编号（唯一）',
  `record_code` varchar(50) DEFAULT NULL,
  `batch_no` varchar(50) DEFAULT NULL COMMENT '关联批次',
  `plot_id` bigint DEFAULT NULL COMMENT '地块（→ sf_plot.id）',
  `plot_name` varchar(100) DEFAULT NULL,
  `variety` varchar(100) DEFAULT NULL,
  `grade` varchar(20) DEFAULT NULL COMMENT '等级（枚举→字典）',
  `amount` decimal(12,2) DEFAULT NULL COMMENT '数量(kg)',
  `unit` varchar(20) DEFAULT 'kg',
  `process_type` varchar(20) DEFAULT NULL COMMENT '处理类型（枚举→字典：分级/包装/清洗/冷藏）',
  `result` varchar(20) DEFAULT NULL COMMENT '处理结果（枚举→字典：合格/返工/报废）',
  `location` varchar(50) DEFAULT NULL COMMENT '库位',
  `status` varchar(20) NOT NULL DEFAULT 'grading' COMMENT '状态：grading/packing/stored/shipped/abnormal',
  `operator` varchar(100) DEFAULT NULL COMMENT '操作人',
  `operate_time` datetime DEFAULT NULL COMMENT '操作时间',
  `in_time` datetime DEFAULT NULL,
  `remark` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_harvest_process_code` (`process_code`),
  KEY `idx_harvest_process_batch` (`batch_no`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='采后处理';

DROP TABLE IF EXISTS `sf_harvest_post`;
CREATE TABLE `sf_harvest_post` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `post_code` varchar(50) NOT NULL COMMENT '发货单号（唯一）',
  `source_batch` varchar(50) DEFAULT NULL COMMENT '来源批次',
  `source_code` varchar(50) DEFAULT NULL,
  `batch_no` varchar(50) DEFAULT NULL COMMENT '关联批次',
  `customer` varchar(100) DEFAULT NULL COMMENT '客户/收货方',
  `phone` varchar(50) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL COMMENT '收货地址',
  `order_no` varchar(100) DEFAULT NULL,
  `amount` decimal(12,2) DEFAULT NULL COMMENT '发货数量(kg)',
  `unit` varchar(20) DEFAULT 'kg',
  `logistics_no` varchar(100) DEFAULT NULL COMMENT '物流单号',
  `logistics_co` varchar(50) DEFAULT NULL COMMENT '物流公司（枚举→字典）',
  `post_date` date DEFAULT NULL COMMENT '发货日期',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/shipped/transit/received/abnormal',
  `operator` varchar(100) DEFAULT NULL,
  `shipped_at` datetime DEFAULT NULL,
  `sign_person` varchar(100) DEFAULT NULL,
  `sign_time` datetime DEFAULT NULL,
  `remark` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_harvest_post_code` (`post_code`),
  KEY `idx_harvest_post_batch` (`batch_no`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='采收发货';

DROP TABLE IF EXISTS `sf_storage_location`;
CREATE TABLE `sf_storage_location` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `location_code` varchar(50) NOT NULL COMMENT '库位编号（唯一）',
  `base_id` bigint DEFAULT NULL COMMENT '所属基地（→ sf_base.id）',
  `batch_no` varchar(50) DEFAULT NULL COMMENT '当前批次',
  `stock_amount` decimal(12,2) DEFAULT NULL COMMENT '在库数量(kg)',
  `temperature` decimal(6,2) DEFAULT NULL COMMENT '温度(℃)',
  `humidity` decimal(6,2) DEFAULT NULL COMMENT '湿度(%)',
  `in_time` datetime DEFAULT NULL COMMENT '入库时间',
  `status` varchar(20) NOT NULL DEFAULT 'normal' COMMENT '状态：normal/temp_alert/shipped',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_storage_location_code` (`location_code`),
  KEY `idx_storage_location_base` (`base_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='储藏库位';

DROP TABLE IF EXISTS `sf_storage_env_record`;
CREATE TABLE `sf_storage_env_record` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `location_id` bigint NOT NULL COMMENT '库位（→ sf_storage_location.id）',
  `collect_time` datetime DEFAULT NULL COMMENT '采集时间',
  `temperature` decimal(6,2) DEFAULT NULL COMMENT '温度(℃)',
  `humidity` decimal(6,2) DEFAULT NULL COMMENT '湿度(%)',
  `judge` varchar(20) DEFAULT NULL COMMENT '判定（正常/异常）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_storage_env_location` (`location_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='储藏温湿度记录';

-- ============================================================
-- 【物资管理（供应商 / 档案 / 出入库 / 库存 / 领用 / 退库）】
-- ============================================================

DROP TABLE IF EXISTS `sf_material_supplier`;
CREATE TABLE `sf_material_supplier` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `supplier_code` varchar(50) NOT NULL COMMENT '供应商编号（唯一）',
  `supplier_name` varchar(100) NOT NULL COMMENT '供应商名称',
  `contact` varchar(50) DEFAULT NULL COMMENT '联系人',
  `phone` varchar(20) DEFAULT NULL COMMENT '电话',
  `credit_code` varchar(50) DEFAULT NULL COMMENT '统一社会信用代码',
  `supply_type` varchar(50) DEFAULT NULL COMMENT '供应类型（枚举→字典：肥料/农药/工具/种子/其他）',
  `rating` varchar(20) DEFAULT NULL COMMENT '评级',
  `settle_way` varchar(50) DEFAULT NULL COMMENT '结算方式(账期)',
  `qualification_status` varchar(20) DEFAULT NULL COMMENT '资质状态',
  `coop_status` varchar(20) NOT NULL DEFAULT 'cooperating' COMMENT '合作状态：cooperating/pending/terminated',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_material_supplier_code` (`supplier_code`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='农资供应商';

DROP TABLE IF EXISTS `sf_material_info`;
CREATE TABLE `sf_material_info` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `material_code` varchar(50) NOT NULL COMMENT '农资编号（唯一）',
  `material_name` varchar(100) NOT NULL COMMENT '农资名称',
  `material_type` varchar(20) DEFAULT NULL COMMENT '类型（枚举→字典：肥料/农药/工具）',
  `type_name` varchar(20) DEFAULT NULL COMMENT '类型名称',
  `spec` varchar(100) DEFAULT NULL COMMENT '规格型号',
  `unit` varchar(20) DEFAULT NULL COMMENT '单位',
  `warehouse_name` varchar(100) DEFAULT NULL COMMENT '仓库名称',
  `warehouse_code` varchar(50) DEFAULT NULL COMMENT '仓库编码',
  `price` decimal(12,2) DEFAULT NULL COMMENT '单价(元)',
  `safety_stock` decimal(12,2) DEFAULT NULL COMMENT '安全库存',
  `current_stock` decimal(12,2) DEFAULT NULL COMMENT '当前库存',
  `daily_use` decimal(12,2) DEFAULT '0.00' COMMENT '日均消耗',
  `lead_days` int DEFAULT '0' COMMENT '采购提前期',
  `supplier_id` bigint DEFAULT NULL COMMENT '供应商（→ sf_material_supplier.id）',
  `purpose` varchar(200) DEFAULT NULL COMMENT '用途',
  `safety_interval` varchar(50) DEFAULT NULL COMMENT '安全间隔期',
  `file_status` varchar(20) DEFAULT NULL COMMENT '档案状态',
  `cert_status` varchar(20) DEFAULT NULL COMMENT '证照状态',
  `stock_status` varchar(20) DEFAULT NULL COMMENT '库存状态（正常/库存不足/库存充足）',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_material_info_code` (`material_code`),
  KEY `idx_material_info_supplier` (`supplier_id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='农资档案';

DROP TABLE IF EXISTS `sf_material_io`;
CREATE TABLE `sf_material_io` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `io_code` varchar(50) NOT NULL COMMENT '单号（唯一，IO-YYYYMMDD###）',
  `warehouse_id` bigint DEFAULT NULL COMMENT '仓库（→ sf_material_warehouse.id）',
  `io_type` varchar(20) NOT NULL COMMENT '类型（枚举→字典：入库/出库）',
  `material_id` bigint DEFAULT NULL COMMENT '农资（→ sf_material_info.id）',
  `batch_no` varchar(50) DEFAULT NULL COMMENT '批次号',
  `quantity` decimal(12,2) DEFAULT NULL COMMENT '数量',
  `price` decimal(12,2) DEFAULT NULL COMMENT '单价(元)',
  `amount` decimal(12,2) DEFAULT NULL COMMENT '金额(元)',
  `handler` varchar(100) DEFAULT NULL COMMENT '经手人',
  `supplier_id` bigint DEFAULT NULL COMMENT '供应商（→ sf_material_supplier.id）',
  `source_code` varchar(50) DEFAULT NULL COMMENT '来源单号',
  `related_target` varchar(200) DEFAULT NULL COMMENT '关联地块/任务',
  `pay_status` varchar(20) DEFAULT NULL COMMENT '付款状态',
  `audit_status` varchar(20) DEFAULT NULL COMMENT '审核状态',
  `auditor` varchar(100) DEFAULT NULL COMMENT '审核人',
  `expire_date` date DEFAULT NULL COMMENT '有效期至',
  `io_date` date DEFAULT NULL COMMENT '日期',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_material_io_code` (`io_code`),
  KEY `idx_material_io_material` (`material_id`),
  KEY `idx_material_io_warehouse` (`warehouse_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='农资出入库';

DROP TABLE IF EXISTS `sf_material_inventory`;
CREATE TABLE `sf_material_inventory` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `warehouse_id` bigint DEFAULT NULL COMMENT '仓库（→ sf_material_warehouse.id）',
  `material_id` bigint DEFAULT NULL COMMENT '农资（→ sf_material_info.id）',
  `batch_no` varchar(50) DEFAULT NULL COMMENT '批次号',
  `location` varchar(50) DEFAULT NULL COMMENT '货位',
  `stock_amount` decimal(12,2) DEFAULT NULL COMMENT '库存数量',
  `available_amount` decimal(12,2) DEFAULT NULL COMMENT '可用库存',
  `locked_amount` decimal(12,2) DEFAULT NULL COMMENT '锁定',
  `book_amount` decimal(12,2) DEFAULT NULL COMMENT '账面数量',
  `min_stock` decimal(12,2) DEFAULT NULL COMMENT '安全库存（最低库存）',
  `stock_value` decimal(12,2) DEFAULT NULL COMMENT '库存金额(元)',
  `avg_daily_use` decimal(12,2) DEFAULT NULL COMMENT '日均消耗',
  `cover_days` decimal(10,2) DEFAULT NULL COMMENT '可覆盖天数',
  `produce_date` date DEFAULT NULL COMMENT '生产日期',
  `expire_date` date DEFAULT NULL COMMENT '有效期至',
  `last_in_time` datetime DEFAULT NULL COMMENT '最近入库时间',
  `last_out_time` datetime DEFAULT NULL COMMENT '最近出库时间',
  `stock_status` varchar(20) DEFAULT NULL COMMENT '库存状态（正常/库存不足/库存充足）',
  `suggest_amount` decimal(12,2) DEFAULT NULL COMMENT '建议补货量',
  `suggest_date` date DEFAULT NULL COMMENT '建议采购日期',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_material_inventory_material` (`material_id`),
  KEY `idx_material_inventory_warehouse` (`warehouse_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='农资库存';

DROP TABLE IF EXISTS `sf_material_usage`;
CREATE TABLE `sf_material_usage` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `material_id` bigint DEFAULT NULL COMMENT '农资（→ sf_material_info.id）',
  `batch_no` varchar(50) DEFAULT NULL COMMENT '批次号',
  `quantity` decimal(12,2) DEFAULT NULL COMMENT '使用数量',
  `use_time` datetime DEFAULT NULL COMMENT '使用时间',
  `use_user` varchar(100) DEFAULT NULL COMMENT '使用人员',
  `task_id` bigint DEFAULT NULL COMMENT '关联任务（→ sf_farming_task.id）',
  `plot_ids` varchar(500) DEFAULT NULL COMMENT '关联地块/使用地块',
  `apply_user` varchar(100) DEFAULT NULL COMMENT '申领人',
  `apply_time` datetime DEFAULT NULL COMMENT '申领时间',
  `apply_way` varchar(50) DEFAULT NULL COMMENT '施药方式',
  `cost_amount` decimal(12,2) DEFAULT NULL COMMENT '成本金额(元)',
  `safety_harvest` varchar(100) DEFAULT NULL COMMENT '安全采收',
  `audit_status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '审核状态：pending/approved/rejected',
  `status` varchar(20) DEFAULT NULL COMMENT '状态',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_material_usage_material` (`material_id`),
  KEY `idx_material_usage_task` (`task_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='农资领用与使用';

DROP TABLE IF EXISTS `sf_material_return`;
CREATE TABLE `sf_material_return` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `return_code` varchar(50) NOT NULL COMMENT '退库单号（唯一）',
  `warehouse_id` bigint DEFAULT NULL COMMENT '仓库（→ sf_material_warehouse.id）',
  `return_type` varchar(20) DEFAULT NULL COMMENT '退库类型（枚举→字典：质量问题/批次过期/运输损坏/包装破损/其他）',
  `material_id` bigint DEFAULT NULL COMMENT '农资（→ sf_material_info.id）',
  `batch_no` varchar(50) DEFAULT NULL COMMENT '批次号',
  `quantity` decimal(12,2) DEFAULT NULL COMMENT '数量',
  `price` decimal(12,2) DEFAULT NULL COMMENT '单价(元)',
  `amount` decimal(12,2) DEFAULT NULL COMMENT '金额(元)',
  `reason` varchar(500) DEFAULT NULL COMMENT '原因类型/说明',
  `handler` varchar(100) DEFAULT NULL COMMENT '经手人',
  `supplier_id` bigint DEFAULT NULL COMMENT '供应商（→ sf_material_supplier.id）',
  `related_code` varchar(50) DEFAULT NULL COMMENT '关联单号',
  `auditor` varchar(100) DEFAULT NULL COMMENT '审核人',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/audited/refunded/done',
  `return_date` date DEFAULT NULL COMMENT '日期',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_material_return_code` (`return_code`),
  KEY `idx_material_return_material` (`material_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='农资退库';

DROP TABLE IF EXISTS `sf_material_warehouse`;
CREATE TABLE `sf_material_warehouse` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `warehouse_code` varchar(50) NOT NULL COMMENT '仓库编号（唯一）',
  `warehouse_name` varchar(100) NOT NULL COMMENT '仓库名称（唯一）',
  `warehouse_type` varchar(20) DEFAULT NULL COMMENT '仓库类型',
  `manager` varchar(100) DEFAULT NULL COMMENT '负责人',
  `manager_phone` varchar(20) DEFAULT NULL COMMENT '负责人电话',
  `capacity` decimal(12,2) DEFAULT NULL COMMENT '容量',
  `address` varchar(255) DEFAULT NULL COMMENT '地址',
  `is_default` tinyint NOT NULL DEFAULT '0' COMMENT '默认仓（0/1）',
  `is_danger` tinyint NOT NULL DEFAULT '0' COMMENT '危险品专库（0/1）',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_material_warehouse_code` (`warehouse_code`),
  UNIQUE KEY `uk_material_warehouse_name` (`warehouse_name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='农资仓库';

DROP TABLE IF EXISTS `sf_material_category`;
CREATE TABLE `sf_material_category` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `category_code` varchar(50) NOT NULL COMMENT '分类编码（唯一）',
  `category_name` varchar(100) NOT NULL COMMENT '分类名称（唯一）',
  `parent_id` bigint DEFAULT NULL COMMENT '上级分类（→ 自关联）',
  `default_unit` varchar(20) DEFAULT NULL COMMENT '默认单位',
  `default_warehouse_id` bigint DEFAULT NULL COMMENT '默认仓库（→ sf_material_warehouse.id）',
  `default_location` varchar(50) DEFAULT NULL COMMENT '默认货位',
  `is_danger` tinyint NOT NULL DEFAULT '0' COMMENT '危险品（0/1）',
  `safety_interval` varchar(50) DEFAULT NULL COMMENT '安全间隔期',
  `qualification` varchar(200) DEFAULT NULL COMMENT '资质要求',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_material_category_code` (`category_code`),
  UNIQUE KEY `uk_material_category_name` (`category_name`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='农资分类';

-- ============================================================
-- 【溯源管理（批次 / 编码 / 区块链 / 模板 / 标签）】
-- ============================================================

DROP TABLE IF EXISTS `sf_trace_batch`;
CREATE TABLE `sf_trace_batch` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `batch_no` varchar(50) NOT NULL COMMENT '批次号（唯一）',
  `product_name` varchar(100) DEFAULT NULL COMMENT '产品名称',
  `spec` varchar(100) DEFAULT NULL COMMENT '规格',
  `base_id` bigint DEFAULT NULL COMMENT '所属基地（→ sf_base.id）',
  `plot_id` bigint DEFAULT NULL COMMENT '地块（→ sf_plot.id）',
  `plot_code` varchar(50) DEFAULT NULL COMMENT '地块编码',
  `plot_name` varchar(100) DEFAULT NULL COMMENT '地块名称',
  `base_name` varchar(100) DEFAULT NULL COMMENT '基地名称',
  `variety` varchar(50) DEFAULT NULL COMMENT '品种',
  `harvest_plan_id` bigint DEFAULT NULL COMMENT '采收计划（→ sf_harvest_plan.id）',
  `harvest_date` date DEFAULT NULL COMMENT '采收日期',
  `grade` varchar(20) DEFAULT NULL COMMENT '等级（枚举→字典：特级/一级/二级）',
  `harvest_amount` decimal(12,2) DEFAULT NULL COMMENT '采收数量(kg)',
  `process_code` varchar(50) DEFAULT NULL COMMENT '采后处理单号',
  `trace_code` varchar(100) DEFAULT NULL COMMENT '追溯码',
  `code_count` int DEFAULT '0' COMMENT '追溯码数量',
  `source_record_code` varchar(50) DEFAULT NULL COMMENT '来源采收记录',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/packed/stored/shipped',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_trace_batch_no` (`batch_no`),
  KEY `idx_trace_batch_base` (`base_id`),
  KEY `idx_trace_batch_plot` (`plot_id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='溯源批次';

DROP TABLE IF EXISTS `sf_trace_code`;
CREATE TABLE `sf_trace_code` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `trace_code` varchar(100) NOT NULL COMMENT '追溯码（唯一）',
  `short_code` varchar(20) DEFAULT NULL COMMENT '短码',
  `batch_no` varchar(50) DEFAULT NULL COMMENT '批次号（→ sf_trace_batch.batch_no）',
  `product_name` varchar(100) DEFAULT NULL COMMENT '产品名称',
  `spec` varchar(100) DEFAULT NULL COMMENT '规格',
  `plot_code` varchar(50) DEFAULT NULL COMMENT '地块编码',
  `origin` varchar(200) DEFAULT NULL COMMENT '产地（基地/地块）',
  `encode_type` varchar(20) DEFAULT NULL COMMENT '编码规则（GS1/二维码/RFID）',
  `generate_count` int DEFAULT NULL COMMENT '生成数量',
  `queries` int DEFAULT '0' COMMENT '扫码次数',
  `first_scan_at` datetime DEFAULT NULL COMMENT '首次扫码时间',
  `last_query` datetime DEFAULT NULL COMMENT '最近查询时间',
  `order_id` bigint DEFAULT NULL COMMENT '关联订单',
  `order_no` varchar(100) DEFAULT NULL COMMENT '订单号',
  `template_id` bigint DEFAULT NULL COMMENT '展示模板（→ sf_trace_template.id）',
  `template_name` varchar(100) DEFAULT NULL COMMENT '模板名称',
  `status` varchar(20) NOT NULL DEFAULT 'inactive' COMMENT '状态：inactive/active/expired',
  `generate_time` datetime DEFAULT NULL COMMENT '生成时间',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_trace_code` (`trace_code`),
  KEY `idx_trace_code_batch` (`batch_no`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='溯源编码';

DROP TABLE IF EXISTS `sf_trace_blockchain`;
CREATE TABLE `sf_trace_blockchain` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `trace_code` varchar(100) DEFAULT NULL COMMENT '溯源码',
  `batch_no` varchar(50) DEFAULT NULL COMMENT '批次号',
  `event` varchar(200) DEFAULT NULL COMMENT '事件',
  `event_type` varchar(50) DEFAULT NULL COMMENT '事件类型',
  `title` varchar(200) DEFAULT NULL COMMENT '标题',
  `summary` varchar(500) DEFAULT NULL COMMENT '摘要',
  `payload` text COMMENT '事件载荷JSON',
  `tx_hash` varchar(200) DEFAULT NULL COMMENT '交易哈希',
  `prev_hash` varchar(200) DEFAULT NULL COMMENT '前序哈希',
  `block_height` varchar(50) DEFAULT NULL COMMENT '区块高度',
  `node` varchar(100) DEFAULT NULL COMMENT '链节点',
  `contract` varchar(100) DEFAULT NULL COMMENT '合约地址',
  `tsa` varchar(100) DEFAULT NULL COMMENT '时间戳来源',
  `chain_time` datetime DEFAULT NULL COMMENT '上链时间',
  `verify_status` varchar(20) DEFAULT NULL COMMENT '验证状态（通过/未通过/验证中）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_trace_blockchain_code` (`trace_code`)
) ENGINE=InnoDB AUTO_INCREMENT=65 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='区块链存证';

DROP TABLE IF EXISTS `sf_trace_query_log`;
CREATE TABLE `sf_trace_query_log` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `trace_code` varchar(100) DEFAULT NULL COMMENT '溯源码',
  `query_time` datetime DEFAULT NULL COMMENT '查询时间',
  `channel` varchar(50) DEFAULT NULL COMMENT '渠道',
  `source` varchar(50) DEFAULT NULL COMMENT '扫码来源',
  `device` varchar(100) DEFAULT NULL COMMENT '设备',
  `region` varchar(100) DEFAULT NULL COMMENT '地区',
  `result` varchar(20) DEFAULT NULL COMMENT '结果',
  `risk_flag` varchar(50) DEFAULT NULL COMMENT '风险标记',
  `risk_reason` varchar(200) DEFAULT NULL COMMENT '风险原因',
  `ip` varchar(50) DEFAULT NULL COMMENT 'IP',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_trace_query_code` (`trace_code`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='溯源查询记录';

DROP TABLE IF EXISTS `sf_trace_template`;
CREATE TABLE `sf_trace_template` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `template_name` varchar(100) NOT NULL COMMENT '模板名称',
  `template_code` varchar(50) DEFAULT NULL COMMENT '模板编码',
  `applicable_product` varchar(200) DEFAULT NULL COMMENT '适用产品',
  `version` int DEFAULT '1' COMMENT '版本号',
  `show_modules` varchar(500) DEFAULT NULL COMMENT '展示模块（多选）',
  `layout` varchar(500) DEFAULT NULL COMMENT '版式JSON',
  `versions` text COMMENT '版本历史JSON',
  `bound_batch` varchar(200) DEFAULT NULL COMMENT '绑定批次',
  `status` varchar(20) NOT NULL DEFAULT 'inactive' COMMENT '启用状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='溯源模板';

DROP TABLE IF EXISTS `sf_trace_stage`;
CREATE TABLE `sf_trace_stage` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `stage_code` varchar(50) NOT NULL COMMENT '环节编码（唯一，planting/pruning/bagging/fertilizer/testing/harvest/coldchain）',
  `stage_name` varchar(100) DEFAULT NULL COMMENT '环节名称',
  `stage_icon` varchar(100) DEFAULT NULL COMMENT '环节图标',
  `stage_desc` varchar(500) DEFAULT NULL COMMENT '环节说明',
  `sort_order` int DEFAULT '0' COMMENT '排序',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态（启停）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除：0=正常 1=已删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_trace_stage_code` (`stage_code`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='溯源展示环节';

DROP TABLE IF EXISTS `sf_label_type`;
CREATE TABLE `sf_label_type` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `label_code` varchar(50) NOT NULL COMMENT '标签编码（唯一）',
  `label_name` varchar(100) NOT NULL COMMENT '标签名称',
  `label_type` varchar(50) DEFAULT NULL COMMENT '标签类型',
  `template_name` varchar(100) DEFAULT NULL COMMENT '模板名称',
  `template_version` varchar(20) DEFAULT NULL COMMENT '模板版本',
  `spec` varchar(100) DEFAULT NULL COMMENT '规格',
  `layout` varchar(50) DEFAULT NULL COMMENT '版式',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_label_type_code` (`label_code`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='标签类型';

DROP TABLE IF EXISTS `sf_label_stock`;
CREATE TABLE `sf_label_stock` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `label_type_id` bigint DEFAULT NULL COMMENT '标签类型（→ sf_label_type.id）',
  `quantity` int DEFAULT NULL COMMENT '数量',
  `batch_no` varchar(50) DEFAULT NULL COMMENT '溯源批次号',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_label_stock_type` (`label_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='标签库存';

DROP TABLE IF EXISTS `sf_label_record`;
CREATE TABLE `sf_label_record` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `apply_code` varchar(50) DEFAULT NULL COMMENT '领用单号',
  `label_type_id` bigint DEFAULT NULL COMMENT '标签类型（→ sf_label_type.id）',
  `quantity` int DEFAULT NULL COMMENT '数量',
  `plot_ids` varchar(500) DEFAULT NULL COMMENT '使用地块',
  `apply_user` varchar(100) DEFAULT NULL COMMENT '申请人',
  `apply_time` datetime DEFAULT NULL COMMENT '领用时间',
  `print_user` varchar(100) DEFAULT NULL COMMENT '打印人',
  `batch_no` varchar(50) DEFAULT NULL COMMENT '溯源批次',
  `task_no` varchar(50) DEFAULT NULL COMMENT '任务号',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/printed/rejected',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_label_record_type` (`label_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='标签领用记录';

DROP TABLE IF EXISTS `sf_trace_show_template`;
CREATE TABLE `sf_trace_show_template` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `template_code` varchar(50) DEFAULT NULL COMMENT '模板编码',
  `name` varchar(100) NOT NULL COMMENT '模板名称',
  `product` varchar(100) DEFAULT NULL COMMENT '适用产品',
  `modules` varchar(1000) DEFAULT NULL COMMENT '展示模块JSON数组',
  `bound_batches` varchar(1000) DEFAULT NULL COMMENT '绑定批次JSON数组',
  `create_time` date DEFAULT NULL COMMENT '创建时间',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态',
  `desc` varchar(500) DEFAULT NULL COMMENT '描述',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_show_tpl_code` (`template_code`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='溯源展示模板';

DROP TABLE IF EXISTS `sf_trace_inspection`;
CREATE TABLE `sf_trace_inspection` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `report_no` varchar(100) NOT NULL COMMENT '报告编号',
  `batch_no` varchar(50) DEFAULT NULL COMMENT '批次号',
  `institution` varchar(200) DEFAULT NULL COMMENT '检测机构',
  `report_type` varchar(50) DEFAULT NULL COMMENT '报告类型',
  `sample_date` date DEFAULT NULL COMMENT '抽样日期',
  `issue_date` date DEFAULT NULL COMMENT '签发日期',
  `valid_until` date DEFAULT NULL COMMENT '有效期至',
  `conclusion` varchar(50) DEFAULT NULL COMMENT '结论',
  `items` text COMMENT '检测项目JSON',
  `attachment_name` varchar(200) DEFAULT NULL COMMENT '附件名',
  `attachment_size` bigint DEFAULT NULL COMMENT '附件大小',
  `cma` varchar(50) DEFAULT NULL COMMENT 'CMA',
  `cnas` varchar(50) DEFAULT NULL COMMENT 'CNAS',
  `status` varchar(20) DEFAULT NULL COMMENT '状态',
  `operator` varchar(100) DEFAULT NULL COMMENT '操作人',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_inspection_batch` (`batch_no`),
  KEY `idx_inspection_report` (`report_no`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='溯源检测报告';

DROP TABLE IF EXISTS `sf_trace_recall`;
CREATE TABLE `sf_trace_recall` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `recall_code` varchar(50) DEFAULT NULL COMMENT '召回编号',
  `batch_no` varchar(50) DEFAULT NULL COMMENT '批次号',
  `reason` varchar(500) DEFAULT NULL COMMENT '召回原因',
  `scope` varchar(200) DEFAULT NULL COMMENT '召回范围',
  `operator` varchar(100) DEFAULT NULL COMMENT '操作人',
  `status` varchar(20) DEFAULT 'active' COMMENT '状态',
  `closed_at` datetime DEFAULT NULL COMMENT '关闭时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_recall_batch` (`batch_no`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='溯源召回记录';

DROP TABLE IF EXISTS `sf_trace_print_job`;
CREATE TABLE `sf_trace_print_job` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `job_code` varchar(50) DEFAULT NULL COMMENT '任务编码',
  `batch_no` varchar(50) DEFAULT NULL COMMENT '批次号',
  `label_name` varchar(100) DEFAULT NULL COMMENT '标签名称',
  `template_id` varchar(50) DEFAULT NULL COMMENT '模板ID',
  `template_version` int DEFAULT NULL COMMENT '模板版本',
  `qty` int DEFAULT NULL COMMENT '数量',
  `operator` varchar(100) DEFAULT NULL COMMENT '操作人',
  `status` varchar(20) DEFAULT NULL COMMENT '状态',
  `reprint_of` varchar(50) DEFAULT NULL COMMENT '重打来源',
  `reason` varchar(200) DEFAULT NULL COMMENT '原因',
  `codes` text COMMENT '码列表JSON',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_print_batch` (`batch_no`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='溯源标签打印任务';

DROP TABLE IF EXISTS `sf_trace_label_stock`;
CREATE TABLE `sf_trace_label_stock` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `label_name` varchar(100) NOT NULL COMMENT '标签名称',
  `quantity` int DEFAULT '0' COMMENT '库存数量',
  `reserved_qty` int DEFAULT '0' COMMENT '预占数量',
  `unit` varchar(20) DEFAULT '张' COMMENT '单位',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_label_name` (`label_name`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='溯源标签库存';

-- ============================================================
-- 【认养管理（认养果树 / 订单 / 农事 / 采收 / 相册 / 证书）】
-- ============================================================

DROP TABLE IF EXISTS `sf_adoption_tree`;
CREATE TABLE `sf_adoption_tree` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `tree_code` varchar(50) NOT NULL COMMENT '果树编号（唯一）',
  `tree_name` varchar(100) DEFAULT NULL COMMENT '果树名称',
  `variety` varchar(50) DEFAULT NULL COMMENT '品种（枚举→字典：huaniu/gala/qinguang/xinredstar/jonagold）',
  `variety_name` varchar(50) DEFAULT NULL COMMENT '品种名称',
  `base_id` bigint DEFAULT NULL COMMENT '所属基地（→ sf_base.id）',
  `plot_id` bigint DEFAULT NULL COMMENT '地块ID',
  `plot_code` varchar(50) DEFAULT NULL COMMENT '地块编码',
  `plot_name` varchar(100) DEFAULT NULL COMMENT '地块名称',
  `base_name` varchar(100) DEFAULT NULL COMMENT '基地名称',
  `tree_age` int DEFAULT NULL COMMENT '树龄',
  `year_fee` decimal(12,2) DEFAULT NULL COMMENT '年费',
  `start_date` date DEFAULT NULL COMMENT '开始日期',
  `duration` int DEFAULT NULL COMMENT '认养年数',
  `growth_stage` varchar(20) DEFAULT NULL COMMENT '生长阶段',
  `progress` int DEFAULT NULL COMMENT '进度',
  `level` varchar(20) DEFAULT NULL COMMENT '级别',
  `source` varchar(20) DEFAULT NULL COMMENT '来源',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `status` varchar(20) NOT NULL DEFAULT 'available' COMMENT '认养状态：available/adopted/unavailable',
  `adopter` varchar(100) DEFAULT NULL COMMENT '认养人',
  `adopter_phone` varchar(20) DEFAULT NULL COMMENT '认养人电话',
  `customer_id` varchar(50) DEFAULT NULL COMMENT '客户ID',
  `order_code` varchar(50) DEFAULT NULL COMMENT '订单编码',
  `tag_code` varchar(50) DEFAULT NULL COMMENT '挂牌编号',
  `camera_id` bigint DEFAULT NULL COMMENT '关联摄像头',
  `open_scene` tinyint NOT NULL DEFAULT '0' COMMENT '开放实景（0/1）',
  `expire_time` date DEFAULT NULL COMMENT '到期时间',
  `archive_reason` varchar(200) DEFAULT NULL COMMENT '归档原因',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_adoption_tree_code` (`tree_code`),
  KEY `idx_adoption_tree_base` (`base_id`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='认养果树';

DROP TABLE IF EXISTS `sf_adoption_order`;
CREATE TABLE `sf_adoption_order` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_code` varchar(50) NOT NULL COMMENT '订单编号（唯一）',
  `adopter` varchar(100) DEFAULT NULL COMMENT '认养人',
  `adopter_phone` varchar(20) DEFAULT NULL COMMENT '认养人电话',
  `customer_id` varchar(50) DEFAULT NULL COMMENT '客户ID',
  `tree_id` bigint DEFAULT NULL COMMENT '认养果树（→ sf_adoption_tree.id）',
  `tree_code` varchar(50) DEFAULT NULL COMMENT '果树编码',
  `base_id` bigint DEFAULT NULL COMMENT '所属基地（→ sf_base.id）',
  `plot_id` bigint DEFAULT NULL COMMENT '地块ID',
  `plot_code` varchar(50) DEFAULT NULL COMMENT '地块编码',
  `plot_name` varchar(100) DEFAULT NULL COMMENT '地块名称',
  `amount` decimal(12,2) DEFAULT NULL COMMENT '认养金额',
  `term` varchar(20) DEFAULT NULL COMMENT '认养期限（枚举→字典：1年/2年/3年/5年）',
  `start_date` date DEFAULT NULL COMMENT '开始日期',
  `end_date` date DEFAULT NULL COMMENT '结束日期',
  `duration` int DEFAULT NULL COMMENT '认养年数',
  `prev_order_code` varchar(50) DEFAULT NULL COMMENT '续费前置单',
  `pay_method` varchar(50) DEFAULT NULL COMMENT '支付方式',
  `pay_txn_no` varchar(100) DEFAULT NULL COMMENT '支付流水',
  `invoice_no` varchar(50) DEFAULT NULL COMMENT '发票号',
  `invoice_status` varchar(20) DEFAULT NULL COMMENT '开票状态',
  `level` varchar(20) DEFAULT NULL COMMENT '级别',
  `renew_flag` tinyint NOT NULL DEFAULT '0' COMMENT '续费标记（0/1）',
  `renew_count` int DEFAULT '0' COMMENT '续费次数',
  `contract_code` varchar(50) DEFAULT NULL COMMENT '合同编号',
  `contract_status` varchar(20) DEFAULT NULL COMMENT '合同状态',
  `order_status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '订单状态：paid/pending/done/refunded/cancelled',
  `refund_reason` varchar(200) DEFAULT NULL COMMENT '退款原因',
  `refund_amount` decimal(14,2) DEFAULT NULL COMMENT '退款金额',
  `refund_status` varchar(20) DEFAULT NULL COMMENT '退款状态',
  `refund_operator` varchar(100) DEFAULT NULL COMMENT '退款操作人',
  `refund_time` datetime DEFAULT NULL COMMENT '退款时间',
  `refund_remark` varchar(500) DEFAULT NULL COMMENT '退款备注',
  `signer` varchar(100) DEFAULT NULL COMMENT '签署人',
  `sign_method` varchar(50) DEFAULT NULL COMMENT '签署方式',
  `signed_at` datetime DEFAULT NULL COMMENT '签署时间',
  `digest` varchar(200) DEFAULT NULL COMMENT '摘要',
  `order_time` datetime DEFAULT NULL COMMENT '下单时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_adoption_order_code` (`order_code`),
  KEY `idx_adoption_order_tree` (`tree_id`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='认养订单';

DROP TABLE IF EXISTS `sf_adoption_farming`;
CREATE TABLE `sf_adoption_farming` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `record_code` varchar(50) NOT NULL COMMENT '记录编号（唯一）',
  `source` varchar(50) DEFAULT NULL COMMENT '来源',
  `tree_id` bigint DEFAULT NULL COMMENT '认养果树（→ sf_adoption_tree.id）',
  `adopter` varchar(100) DEFAULT NULL COMMENT '认养人',
  `base_name` varchar(100) DEFAULT NULL COMMENT '基地名称',
  `farm_type` varchar(20) DEFAULT NULL COMMENT '农事类型（枚举→字典：施肥/浇水/修剪/套袋/病虫害防治）',
  `title` varchar(200) DEFAULT NULL COMMENT '标题',
  `batch_no` varchar(50) DEFAULT NULL COMMENT '批次号',
  `bind_time` datetime DEFAULT NULL COMMENT '绑定时间',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `production_plan_id` varchar(50) DEFAULT NULL COMMENT '生产计划ID',
  `execute_date` date DEFAULT NULL COMMENT '执行日期',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_adoption_farming_code` (`record_code`),
  KEY `idx_adoption_farming_tree` (`tree_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='认养农事记录';

DROP TABLE IF EXISTS `sf_adoption_harvest`;
CREATE TABLE `sf_adoption_harvest` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `record_code` varchar(50) NOT NULL COMMENT '记录编号（唯一）',
  `tree_id` bigint DEFAULT NULL COMMENT '认养果树（→ sf_adoption_tree.id）',
  `adopter` varchar(100) DEFAULT NULL COMMENT '认养人',
  `phone` varchar(20) DEFAULT NULL COMMENT '电话',
  `order_code` varchar(50) DEFAULT NULL COMMENT '订单编码',
  `estimate_amount` decimal(12,2) DEFAULT NULL COMMENT '预计采收量(斤)',
  `actual_amount` decimal(12,2) DEFAULT NULL COMMENT '实际采收量(斤)',
  `harvest_date` date DEFAULT NULL COMMENT '采收日期',
  `method` varchar(20) DEFAULT NULL COMMENT '采收方式',
  `source` varchar(20) DEFAULT NULL COMMENT '来源',
  `reservation_id` varchar(50) DEFAULT NULL COMMENT '预约ID',
  `harvest_batch_no` varchar(50) DEFAULT NULL COMMENT '采收批次',
  `trace_code` varchar(100) DEFAULT NULL COMMENT '追溯码',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/done/cancelled',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_adoption_harvest_code` (`record_code`),
  KEY `idx_adoption_harvest_tree` (`tree_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='认养采收记录';

DROP TABLE IF EXISTS `sf_adoption_photo`;
CREATE TABLE `sf_adoption_photo` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `tree_id` bigint DEFAULT NULL COMMENT '认养果树（→ sf_adoption_tree.id）',
  `file_id` bigint DEFAULT NULL COMMENT '照片（→ sf_file.id）',
  `stage` varchar(50) DEFAULT NULL COMMENT '成长阶段',
  `shoot_time` datetime DEFAULT NULL COMMENT '拍摄时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_adoption_photo_tree` (`tree_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='成长相册';

DROP TABLE IF EXISTS `sf_adoption_cert`;
CREATE TABLE `sf_adoption_cert` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `cert_code` varchar(50) NOT NULL COMMENT '证书编号（唯一）',
  `tree_id` bigint DEFAULT NULL COMMENT '果树（→ sf_adoption_tree.id）',
  `adopter` varchar(100) DEFAULT NULL COMMENT '认养人',
  `base_name` varchar(100) DEFAULT NULL COMMENT '基地名称',
  `plot_name` varchar(100) DEFAULT NULL COMMENT '地块名称',
  `term` varchar(20) DEFAULT NULL COMMENT '认养期限',
  `period_start` date DEFAULT NULL COMMENT '认养期开始',
  `period_end` date DEFAULT NULL COMMENT '认养期结束',
  `variety` varchar(50) DEFAULT NULL COMMENT '品种',
  `estimate_yield` decimal(12,2) DEFAULT NULL COMMENT '预估产量',
  `template_id` bigint DEFAULT NULL COMMENT '模板（→ sf_adoption_cert_template.id）',
  `template_code` varchar(50) DEFAULT NULL COMMENT '模板编码',
  `issuer` varchar(100) DEFAULT NULL COMMENT '签发人',
  `issue_date` date DEFAULT NULL COMMENT '签发日期',
  `issue_time` datetime DEFAULT NULL COMMENT '签发时间',
  `order_code` varchar(50) DEFAULT NULL COMMENT '订单编码',
  `amount` decimal(14,2) DEFAULT NULL COMMENT '金额',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/issued/revoked',
  `revoke_reason` varchar(200) DEFAULT NULL COMMENT '撤销原因',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_adoption_cert_code` (`cert_code`),
  KEY `idx_adoption_cert_tree` (`tree_id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='认养证书';

DROP TABLE IF EXISTS `sf_adoption_cert_template`;
CREATE TABLE `sf_adoption_cert_template` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `template_name` varchar(100) NOT NULL COMMENT '模板名称',
  `issue_org` varchar(100) DEFAULT NULL COMMENT '签发机构',
  `sign_unit` varchar(100) DEFAULT NULL COMMENT '落款单位',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='认养证书模板';

-- ============================================================
-- 【预警管理（预警记录 / 规则 / 内部报告）】
-- ============================================================

DROP TABLE IF EXISTS `sf_alert_record`;
CREATE TABLE `sf_alert_record` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `alert_title` varchar(200) NOT NULL COMMENT '预警标题',
  `dedupe_key` varchar(200) DEFAULT NULL COMMENT '幂等键',
  `rule_id` varchar(50) DEFAULT NULL COMMENT '规则ID',
  `source` varchar(20) NOT NULL COMMENT '预警来源：device/manual/model/inventory/system/cert',
  `category` varchar(20) DEFAULT NULL COMMENT '业务分类：设备/病虫害/气象/土壤/生长/环境/产量/库存/品质',
  `alert_type` varchar(20) DEFAULT NULL COMMENT '预警类型（病虫害/气象/土壤/生长/环境/产量/库存）',
  `level` varchar(20) NOT NULL DEFAULT 'notice' COMMENT '预警级别：urgent/important/reminder/notice',
  `device_id` bigint DEFAULT NULL COMMENT '关联设备（→ sf_device.id）',
  `device_name` varchar(100) DEFAULT NULL COMMENT '设备名称',
  `location` varchar(200) DEFAULT NULL COMMENT '安装位置',
  `plot_ids` varchar(500) DEFAULT NULL COMMENT '涉及地块',
  `threshold` varchar(200) DEFAULT NULL COMMENT '阈值设置',
  `current_value` varchar(100) DEFAULT NULL COMMENT '当前值',
  `alert_time` datetime DEFAULT NULL COMMENT '预警时间',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/processing/closed/ignored/to_workorder/cancelled',
  `response_deadline` datetime DEFAULT NULL COMMENT '响应时限',
  `handle_deadline` datetime DEFAULT NULL COMMENT '处置时限',
  `handle_action` varchar(200) DEFAULT NULL COMMENT '执行动作',
  `history` varchar(2000) DEFAULT NULL COMMENT '处理历史JSON',
  `assignee` varchar(100) DEFAULT NULL COMMENT '受理人',
  `operator` varchar(100) DEFAULT NULL COMMENT '操作人',
  `accepted_at` datetime DEFAULT NULL COMMENT '受理时间',
  `closed_at` datetime DEFAULT NULL COMMENT '关闭时间',
  `escalated` tinyint DEFAULT '0' COMMENT '是否升级',
  `target_type` varchar(20) DEFAULT NULL COMMENT '目标类型',
  `target_id` varchar(50) DEFAULT NULL COMMENT '目标ID',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_alert_record_source` (`source`),
  KEY `idx_alert_record_level` (`level`),
  KEY `idx_alert_record_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=48 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='预警记录';

DROP TABLE IF EXISTS `sf_alert_rule`;
CREATE TABLE `sf_alert_rule` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `rule_code` varchar(50) NOT NULL COMMENT '规则编号（唯一）',
  `rule_name` varchar(100) NOT NULL COMMENT '规则名称',
  `source` varchar(20) DEFAULT NULL COMMENT '预警来源（6类）',
  `category` varchar(20) DEFAULT NULL COMMENT '业务分类（9类）',
  `level` varchar(20) DEFAULT NULL COMMENT '预警级别（4级）',
  `threshold` varchar(500) DEFAULT NULL COMMENT '阈值设置（结构化：指标+比较符+数值+单位）',
  `scope` varchar(20) DEFAULT NULL COMMENT '作用范围：all/base/plot/device',
  `response_deadline` varchar(50) DEFAULT NULL COMMENT '响应时限',
  `handle_deadline` varchar(50) DEFAULT NULL COMMENT '处置时限',
  `notify_way` varchar(100) DEFAULT NULL COMMENT '通知方式',
  `assignees` varchar(500) DEFAULT NULL COMMENT '受理人列表JSON',
  `escalate_to` varchar(100) DEFAULT NULL COMMENT '升级人',
  `desc` varchar(500) DEFAULT NULL COMMENT '规则描述',
  `enabled` tinyint NOT NULL DEFAULT '1' COMMENT '启用状态（0/1）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_alert_rule_code` (`rule_code`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='预警规则';

DROP TABLE IF EXISTS `sf_alert_report`;
CREATE TABLE `sf_alert_report` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `report_code` varchar(50) DEFAULT NULL COMMENT '报告编号',
  `report_name` varchar(200) NOT NULL COMMENT '报告名称',
  `report_type` varchar(20) DEFAULT NULL COMMENT '报告类型（4类）',
  `type_text` varchar(20) DEFAULT NULL COMMENT '类型名称',
  `base_ids` varchar(500) DEFAULT NULL COMMENT '涉及基地',
  `stat_device` int DEFAULT '0' COMMENT '设备预警数',
  `stat_farming` int DEFAULT '0' COMMENT '农事预警数',
  `stat_urgent` int DEFAULT '0' COMMENT '紧急预警数',
  `stat_rate` varchar(10) DEFAULT NULL COMMENT '处理率',
  `content` text COMMENT '报告内容',
  `overview` text COMMENT '概述',
  `device_detail` text COMMENT '设备详情',
  `farming_detail` text COMMENT '农事详情',
  `suggestion` text COMMENT '建议',
  `generator` varchar(100) DEFAULT NULL COMMENT '生成人',
  `generate_time` datetime DEFAULT NULL COMMENT '生成时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='内部报告';

-- ============================================================
-- 【设备管理（台账 / 类型 / 资产 / 接入 / 网关 / 视频 / 维护等）】
-- ============================================================

DROP TABLE IF EXISTS `sf_device`;
CREATE TABLE `sf_device` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `device_code` varchar(50) NOT NULL COMMENT '设备编号（唯一，业务编号）',
  `device_name` varchar(100) NOT NULL COMMENT '设备名称',
  `device_type` varchar(50) DEFAULT NULL COMMENT '设备类型（21类字典）',
  `base_id` bigint DEFAULT NULL COMMENT '所属基地（→ sf_base.id）',
  `plot_id` bigint DEFAULT NULL COMMENT '所属地块（→ sf_plot.id）',
  `location` varchar(200) DEFAULT NULL COMMENT '安装位置',
  `run_status` varchar(20) DEFAULT NULL COMMENT '运行状态：online/maintain/offline',
  `asset_status` varchar(20) DEFAULT NULL COMMENT '资产状态（5态）',
  `vendor` varchar(100) DEFAULT NULL COMMENT '设备厂商',
  `model` varchar(100) DEFAULT NULL COMMENT '设备型号',
  `sn` varchar(100) DEFAULT NULL COMMENT 'SN 序列号',
  `firmware` varchar(50) DEFAULT NULL COMMENT '固件版本',
  `ip` varchar(50) DEFAULT NULL COMMENT 'IP 地址',
  `protocol` varchar(50) DEFAULT NULL COMMENT '通信协议',
  `power` varchar(50) DEFAULT NULL COMMENT '供电方式',
  `owner` varchar(50) DEFAULT NULL COMMENT '运维负责人',
  `supplier` varchar(100) DEFAULT NULL COMMENT '供应商',
  `disposal_way` varchar(50) DEFAULT NULL COMMENT '处置方式',
  `install_date` date DEFAULT NULL COMMENT '安装日期',
  `enable_date` date DEFAULT NULL COMMENT '启用日期',
  `warranty_until` date DEFAULT NULL COMMENT '质保到期日',
  `purchase_amount` decimal(14,2) DEFAULT NULL COMMENT '采购金额（元）',
  `useful_years` int DEFAULT NULL COMMENT '使用寿命（年）',
  `maintain_cycle` varchar(50) DEFAULT NULL COMMENT '维保周期',
  `next_maintain` date DEFAULT NULL COMMENT '下次保养',
  `last_maintain_date` date DEFAULT NULL COMMENT '最近维护日期',
  `calibrate_cycle` varchar(50) DEFAULT NULL COMMENT '校准周期',
  `last_calibrate_date` date DEFAULT NULL COMMENT '最近校准日期',
  `running_hours` decimal(14,1) DEFAULT NULL COMMENT '累计运行时长（h）',
  `fault_count` int DEFAULT '0' COMMENT '故障次数',
  `online_rate` decimal(6,2) DEFAULT NULL COMMENT '在线率（%）',
  `uptime_rate` decimal(6,2) DEFAULT NULL COMMENT '稼动率（%）',
  `collect_count` bigint DEFAULT '0' COMMENT '累计采集条数',
  `last_seen_at` datetime DEFAULT NULL COMMENT '最近上线时间',
  `collect_time` datetime DEFAULT NULL COMMENT '采集时间',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注信息',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_code` (`device_code`),
  KEY `idx_device_base` (`base_id`),
  KEY `idx_device_type` (`device_type`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='设备台账';

DROP TABLE IF EXISTS `sf_device_type`;
CREATE TABLE `sf_device_type` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `type_code` varchar(50) NOT NULL COMMENT '类型编码（唯一）',
  `type_name` varchar(100) NOT NULL COMMENT '类型名称',
  `category` varchar(50) DEFAULT NULL COMMENT '分类（12类）',
  `can_access` tinyint NOT NULL DEFAULT '1' COMMENT '可接入（0/1）',
  `can_control` tinyint NOT NULL DEFAULT '0' COMMENT '可控（0/1）',
  `is_asset` tinyint NOT NULL DEFAULT '1' COMMENT '资产（0/1）',
  `maintain_cycle` varchar(50) DEFAULT NULL COMMENT '维保周期',
  `calibrate_cycle` varchar(50) DEFAULT NULL COMMENT '校准周期',
  `measure_count` int DEFAULT '0' COMMENT '测点数',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_type_code` (`type_code`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='设备类型与物模型';

DROP TABLE IF EXISTS `sf_device_measure`;
CREATE TABLE `sf_device_measure` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `device_type_id` bigint NOT NULL COMMENT '设备类型（→ sf_device_type.id）',
  `measure_key` varchar(50) NOT NULL COMMENT '测点key',
  `measure_name` varchar(100) DEFAULT NULL COMMENT '测点名称',
  `unit` varchar(20) DEFAULT NULL COMMENT '单位',
  `step` decimal(12,4) DEFAULT NULL COMMENT '步长',
  `range_min` decimal(12,4) DEFAULT NULL COMMENT '下限',
  `range_max` decimal(12,4) DEFAULT NULL COMMENT '上限',
  `precision` varchar(20) DEFAULT NULL COMMENT '精度',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_measure_key` (`device_type_id`,`measure_key`)
) ENGINE=InnoDB AUTO_INCREMENT=117 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='物模型测点';

DROP TABLE IF EXISTS `sf_device_asset`;
CREATE TABLE `sf_device_asset` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `asset_code` varchar(50) NOT NULL COMMENT '盘点单号（唯一）',
  `asset_name` varchar(100) NOT NULL COMMENT '盘点名称',
  `start_date` date DEFAULT NULL COMMENT '开始日期',
  `end_date` date DEFAULT NULL COMMENT '结束日期',
  `checker` varchar(100) DEFAULT NULL COMMENT '盘点人',
  `should_count` int DEFAULT '0' COMMENT '应盘',
  `checked_count` int DEFAULT '0' COMMENT '已盘',
  `loss_count` int DEFAULT '0' COMMENT '盘亏/异常',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/checking/done/loss',
  `summary` varchar(1000) DEFAULT NULL COMMENT '盘点总结',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_asset_code` (`asset_code`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='资产盘点';

DROP TABLE IF EXISTS `sf_device_access`;
CREATE TABLE `sf_device_access` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `config_code` varchar(50) NOT NULL COMMENT '配置编号（唯一）',
  `device_id` bigint DEFAULT NULL COMMENT '设备（→ sf_device.id）',
  `base_id` bigint DEFAULT NULL COMMENT '所属基地（→ sf_base.id）',
  `access_way` varchar(50) DEFAULT NULL COMMENT '接入方式（MQTT/Modbus TCP/ONVIF/RTSP等）',
  `gateway_id` bigint DEFAULT NULL COMMENT '所属网关（→ sf_gateway.id）',
  `access_address` varchar(200) DEFAULT NULL COMMENT '接入地址',
  `collect_frequency` varchar(20) DEFAULT NULL COMMENT '采集频率',
  `timeout` int DEFAULT NULL COMMENT '超时(s)',
  `measure_points` varchar(500) DEFAULT NULL COMMENT '采集测点',
  `direction` varchar(20) DEFAULT NULL COMMENT '方向',
  `status` varchar(20) NOT NULL DEFAULT 'connected' COMMENT '状态：connected/abnormal/disconnected',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_access_code` (`config_code`),
  KEY `idx_device_access_device` (`device_id`),
  KEY `idx_device_access_gateway` (`gateway_id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='设备接入配置';

DROP TABLE IF EXISTS `sf_gateway`;
CREATE TABLE `sf_gateway` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `gateway_code` varchar(50) NOT NULL COMMENT '网关编号（唯一）',
  `gateway_name` varchar(100) NOT NULL COMMENT '网关名称',
  `model` varchar(100) DEFAULT NULL COMMENT '型号',
  `vendor` varchar(100) DEFAULT NULL COMMENT '厂商',
  `protocol` varchar(50) DEFAULT NULL COMMENT '通信协议（MQTT/Modbus TCP/ONVIF/WebSocket/RTSP/GB/T 28181）',
  `ip` varchar(50) DEFAULT NULL COMMENT 'IP',
  `port` varchar(20) DEFAULT NULL COMMENT '端口',
  `topic_prefix` varchar(100) DEFAULT NULL COMMENT 'Topic 前缀',
  `sn` varchar(100) DEFAULT NULL COMMENT 'SN序列号',
  `access_load` int DEFAULT NULL COMMENT '接入负载',
  `heartbeat` int DEFAULT NULL COMMENT '心跳(s)',
  `location` varchar(200) DEFAULT NULL COMMENT '安装位置',
  `max_device` int DEFAULT NULL COMMENT '最大接入设备数',
  `account` varchar(100) DEFAULT NULL COMMENT '账号',
  `password` varchar(200) DEFAULT NULL COMMENT '密码（脱敏存储）',
  `status` varchar(20) NOT NULL DEFAULT 'running' COMMENT '状态：running/unstable/offline',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_gateway_code` (`gateway_code`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='网关与协议';

DROP TABLE IF EXISTS `sf_video_channel`;
CREATE TABLE `sf_video_channel` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `channel_code` varchar(50) NOT NULL COMMENT '通道编号（唯一）',
  `channel_name` varchar(100) NOT NULL COMMENT '通道名称',
  `device_code` varchar(50) DEFAULT NULL COMMENT '设备编码',
  `channel_no` varchar(20) DEFAULT NULL COMMENT '通道号',
  `protocol` varchar(50) DEFAULT NULL COMMENT '取流协议（ONVIF/RTSP/GB/T 28181）',
  `rtsp_url` varchar(300) DEFAULT NULL COMMENT '取流地址',
  `platform` varchar(100) DEFAULT NULL COMMENT '接入平台',
  `resolution` varchar(50) DEFAULT NULL COMMENT '分辨率',
  `frame_rate` varchar(20) DEFAULT NULL COMMENT '帧率',
  `stream` varchar(50) DEFAULT NULL COMMENT '码流（主/子）',
  `has_ptz` tinyint NOT NULL DEFAULT '0' COMMENT '云台（0/1）',
  `night_vision` tinyint NOT NULL DEFAULT '0' COMMENT '夜视（0/1）',
  `retain_days` int DEFAULT NULL COMMENT '留存(天)',
  `form` varchar(50) DEFAULT NULL COMMENT '形态',
  `power` varchar(50) DEFAULT NULL COMMENT '供电方式',
  `protection` varchar(50) DEFAULT NULL COMMENT '防护等级',
  `bitrate` varchar(50) DEFAULT NULL COMMENT '码率',
  `has_audio` tinyint NOT NULL DEFAULT '0' COMMENT '音频（0/1）',
  `ai_ability` varchar(200) DEFAULT NULL COMMENT 'AI能力',
  `preset_count` int DEFAULT '0' COMMENT '预置位数量',
  `base_id` bigint DEFAULT NULL COMMENT '所属基地（→ sf_base.id）',
  `location` varchar(200) DEFAULT NULL COMMENT '安装位置',
  `status` varchar(20) NOT NULL DEFAULT 'online' COMMENT '状态：online/weak/offline',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_video_channel_code` (`channel_code`),
  KEY `idx_video_channel_base` (`base_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='视频监控通道';

DROP TABLE IF EXISTS `sf_device_maintain`;
CREATE TABLE `sf_device_maintain` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `maintain_code` varchar(50) NOT NULL COMMENT '维护编号（唯一）',
  `device_id` bigint DEFAULT NULL COMMENT '设备（→ sf_device.id）',
  `maintain_type` varchar(50) DEFAULT NULL COMMENT '维护类型',
  `fault_category` varchar(50) DEFAULT NULL COMMENT '故障分类',
  `content` varchar(1000) DEFAULT NULL COMMENT '维护内容',
  `fault_desc` varchar(500) DEFAULT NULL COMMENT '故障描述',
  `manager` varchar(100) DEFAULT NULL COMMENT '负责人',
  `plan_time` datetime DEFAULT NULL COMMENT '计划时间',
  `start_time` datetime DEFAULT NULL COMMENT '开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '结束时间',
  `work_hours` decimal(10,2) DEFAULT NULL COMMENT '工时(h)',
  `stop_hours` decimal(10,2) DEFAULT NULL COMMENT '停机(h)',
  `cost` decimal(12,2) DEFAULT NULL COMMENT '费用(元)',
  `result` varchar(1000) DEFAULT NULL COMMENT '处理结果',
  `parts` varchar(500) DEFAULT NULL COMMENT '更换配件',
  `acceptor` varchar(100) DEFAULT NULL COMMENT '验收人',
  `outsourced` varchar(200) DEFAULT NULL COMMENT '外包信息',
  `priority` varchar(20) DEFAULT 'normal' COMMENT '优先级：normal/high/urgent',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_maintain_code` (`maintain_code`),
  KEY `idx_device_maintain_device` (`device_id`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='设备维护工单';

DROP TABLE IF EXISTS `sf_device_calibration`;
CREATE TABLE `sf_device_calibration` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `calibration_code` varchar(50) NOT NULL COMMENT '校准编号（唯一）',
  `device_id` bigint DEFAULT NULL COMMENT '设备（→ sf_device.id）',
  `calibration_type` varchar(50) DEFAULT NULL COMMENT '校准类型',
  `plan_date` date DEFAULT NULL COMMENT '计划日期',
  `actual_date` date DEFAULT NULL COMMENT '实际日期',
  `executor` varchar(100) DEFAULT NULL COMMENT '执行人',
  `reviewer` varchar(100) DEFAULT NULL COMMENT '复核人',
  `result` varchar(20) DEFAULT NULL COMMENT '结果：pass/fail',
  `content` varchar(1000) DEFAULT NULL COMMENT '校准内容',
  `deviation` varchar(200) DEFAULT NULL COMMENT '偏差说明',
  `conclusion` varchar(20) DEFAULT NULL COMMENT '结论：qualified/unqualified/expired',
  `valid_until` date DEFAULT NULL COMMENT '有效期至',
  `cert_code` varchar(100) DEFAULT NULL COMMENT '证书编号',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_calibration_code` (`calibration_code`),
  KEY `idx_device_calibration_device` (`device_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='校准检定';

DROP TABLE IF EXISTS `sf_device_spare`;
CREATE TABLE `sf_device_spare` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `spare_code` varchar(50) NOT NULL COMMENT '备件编号（唯一）',
  `spare_name` varchar(100) NOT NULL COMMENT '备件名称',
  `spec` varchar(100) DEFAULT NULL COMMENT '规格型号',
  `vendor` varchar(100) DEFAULT NULL COMMENT '厂商',
  `supplier` varchar(100) DEFAULT NULL COMMENT '供应商',
  `applicable_type` varchar(100) DEFAULT NULL COMMENT '适用设备类型',
  `unit` varchar(20) DEFAULT NULL COMMENT '单位',
  `current_stock` decimal(12,2) DEFAULT NULL COMMENT '当前库存',
  `safety_stock` decimal(12,2) DEFAULT NULL COMMENT '安全库存',
  `used_amount` decimal(12,2) DEFAULT NULL COMMENT '已领用',
  `price` decimal(12,2) DEFAULT NULL COMMENT '单价(元)',
  `stock_value` decimal(12,2) DEFAULT NULL COMMENT '库存金额',
  `location` varchar(50) DEFAULT NULL COMMENT '库位',
  `status` varchar(20) NOT NULL DEFAULT 'enough' COMMENT '状态：shortage/low/enough',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_spare_code` (`spare_code`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='备品备件';

DROP TABLE IF EXISTS `sf_device_command`;
CREATE TABLE `sf_device_command` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `command_code` varchar(50) NOT NULL COMMENT '指令编号（唯一，CMD-YYYYMMDD-NNN）',
  `device_id` bigint DEFAULT NULL COMMENT '设备（→ sf_device.id）',
  `command_type` varchar(50) DEFAULT NULL COMMENT '指令类型（参数下发/远程重启/固件升级/校准/开关控制）',
  `content` varchar(1000) DEFAULT NULL COMMENT '指令内容',
  `operator` varchar(100) DEFAULT NULL COMMENT '操作人',
  `send_time` datetime DEFAULT NULL COMMENT '下发时间',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/sending/success/failed',
  `result` varchar(500) DEFAULT NULL COMMENT '结果摘要',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_command_code` (`command_code`),
  KEY `idx_device_command_device` (`device_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='远程指令';

DROP TABLE IF EXISTS `sf_device_log`;
CREATE TABLE `sf_device_log` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `log_time` datetime DEFAULT NULL COMMENT '日志时间',
  `device_id` bigint DEFAULT NULL COMMENT '设备（→ sf_device.id）',
  `log_level` varchar(20) DEFAULT NULL COMMENT '日志级别：INFO/WARN/ERROR/DEBUG',
  `log_type` varchar(20) DEFAULT NULL COMMENT '日志类型（数据采集/通信交互/异常事件/配置变更/控制指令/设备启停）',
  `source` varchar(50) DEFAULT NULL COMMENT '来源（设备/网关/平台/移动端）',
  `content` varchar(1000) DEFAULT NULL COMMENT '日志内容',
  `measure_key` varchar(50) DEFAULT NULL COMMENT '关联测点',
  `value` varchar(200) DEFAULT NULL COMMENT '数值',
  `trace_id` varchar(100) DEFAULT NULL COMMENT '追踪ID',
  `handle_status` varchar(20) DEFAULT NULL COMMENT '处理状态',
  `handler` varchar(100) DEFAULT NULL COMMENT '处理人',
  `handle_time` datetime DEFAULT NULL COMMENT '处理时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_device_log_device` (`device_id`),
  KEY `idx_device_log_time` (`log_time`)
) ENGINE=InnoDB AUTO_INCREMENT=61 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='设备日志';

DROP TABLE IF EXISTS `sf_device_audit`;
CREATE TABLE `sf_device_audit` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `operate_time` datetime DEFAULT NULL COMMENT '操作时间',
  `operate_type` varchar(20) DEFAULT NULL COMMENT '操作类型：新增/修改/删除/状态变更',
  `object_type` varchar(50) DEFAULT NULL COMMENT '对象类型',
  `object_code` varchar(100) DEFAULT NULL COMMENT '对象编号',
  `operator` varchar(100) DEFAULT NULL COMMENT '操作人',
  `summary` varchar(500) DEFAULT NULL COMMENT '操作摘要',
  `before_data` text COMMENT '变更前（JSON）',
  `after_data` text COMMENT '变更后（JSON）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_device_audit_time` (`operate_time`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='设备操作审计';

-- ============================================================
-- 【证书管理（证书 / 电子签章）】
-- ============================================================

DROP TABLE IF EXISTS `sf_cert`;
CREATE TABLE `sf_cert` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `cert_no` varchar(100) NOT NULL COMMENT '证书编号（唯一）',
  `cert_name` varchar(200) DEFAULT NULL COMMENT '证书名称',
  `cert_type` varchar(50) DEFAULT NULL COMMENT '证书类型（12类）',
  `type_code` varchar(50) DEFAULT NULL COMMENT '类型编码',
  `subject_type` varchar(20) DEFAULT NULL COMMENT '主体类型：enterprise/batch',
  `category` varchar(50) DEFAULT NULL COMMENT '分类（企业资质/批次凭证）',
  `batch_no` varchar(50) DEFAULT NULL COMMENT '关联批次（批次凭证必填）',
  `issuer` varchar(200) DEFAULT NULL COMMENT '发证机构',
  `customer_name` varchar(100) DEFAULT NULL COMMENT '客户名称（合格证采购方）',
  `product_name` varchar(100) DEFAULT NULL COMMENT '产品名称',
  `produce_date` date DEFAULT NULL COMMENT '生产日期',
  `net_weight` varchar(50) DEFAULT NULL COMMENT '净含量',
  `grade` varchar(20) DEFAULT NULL COMMENT '等级',
  `conclusion` varchar(50) DEFAULT NULL COMMENT '检测结论（合格/不合格）',
  `tester` varchar(100) DEFAULT NULL COMMENT '检测人',
  `promise` varchar(500) DEFAULT NULL COMMENT '承诺声明',
  `scope` varchar(500) DEFAULT NULL COMMENT '认证范围',
  `valid_start` date DEFAULT NULL COMMENT '有效期起',
  `valid_end` date DEFAULT NULL COMMENT '有效期至',
  `file_id` bigint DEFAULT NULL COMMENT '附件（→ sf_file.id）',
  `status` varchar(20) NOT NULL DEFAULT 'draft' COMMENT '状态：draft/pending/active/revoked',
  `revoke_reason` varchar(200) DEFAULT NULL COMMENT '作废/驳回原因',
  `issued_by` varchar(100) DEFAULT NULL COMMENT '签发人',
  `issued_at` datetime DEFAULT NULL COMMENT '签发时间',
  `source_no` varchar(100) DEFAULT NULL COMMENT '原证书号',
  `report_no` varchar(100) DEFAULT NULL COMMENT '检测报告号',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `owner` varchar(100) DEFAULT NULL COMMENT '负责部门',
  `variety` varchar(50) DEFAULT NULL COMMENT '品种',
  `stamp` varchar(100) DEFAULT NULL COMMENT '电子签章名称',
  `operator` varchar(100) DEFAULT NULL COMMENT '最后操作人',
  `trace_code` varchar(100) DEFAULT NULL COMMENT '溯源码',
  `qr_url` varchar(500) DEFAULT NULL COMMENT '二维码地址',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cert_no` (`cert_no`),
  KEY `idx_cert_batch` (`batch_no`),
  KEY `idx_cert_type` (`cert_type`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='证书台账';

DROP TABLE IF EXISTS `sf_cert_stamp`;
CREATE TABLE `sf_cert_stamp` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id` bigint DEFAULT NULL COMMENT '签章人（→ sf_user.id）',
  `stamp_name` varchar(100) DEFAULT NULL COMMENT '签章名称',
  `file_id` bigint DEFAULT NULL COMMENT '签章图片（→ sf_file.id）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_cert_stamp_user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='电子签章';

-- ============================================================
-- 【经营分析（收入 / 应收 / 指标 / 成本 / 利润 / 绩效）】
-- ============================================================

DROP TABLE IF EXISTS `sf_biz_revenue_mix`;
CREATE TABLE `sf_biz_revenue_mix` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `revenue_type` varchar(100) NOT NULL COMMENT '收入类型（鲜果销售/认养收入/农资服务/冷链代储）',
  `amount` decimal(14,2) DEFAULT NULL COMMENT '金额（万元）',
  `ratio` decimal(5,2) DEFAULT NULL COMMENT '占比%',
  `channel_desc` varchar(500) DEFAULT NULL COMMENT '渠道说明',
  `fiscal_year` varchar(20) DEFAULT NULL COMMENT '财年',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='经营收入构成';

DROP TABLE IF EXISTS `sf_biz_receivable`;
CREATE TABLE `sf_biz_receivable` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `customer_name` varchar(100) NOT NULL COMMENT '客户名称',
  `customer_type` varchar(50) DEFAULT NULL COMMENT '类型',
  `amount` decimal(14,2) DEFAULT NULL COMMENT '应收金额（万元）',
  `age_range` varchar(20) DEFAULT NULL COMMENT '账龄区间（30天以内/31-60/61-90/90天以上）',
  `fiscal_year` varchar(20) DEFAULT NULL COMMENT '财年',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='应收周转';

DROP TABLE IF EXISTS `sf_biz_metric`;
CREATE TABLE `sf_biz_metric` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `metric_name` varchar(100) NOT NULL COMMENT '指标名称',
  `current_value` varchar(100) DEFAULT NULL COMMENT '当前值',
  `unit` varchar(20) DEFAULT NULL COMMENT '单位',
  `change_rate` varchar(50) DEFAULT NULL COMMENT '环比变化',
  `better_direction` varchar(20) DEFAULT NULL COMMENT '向好方向',
  `eval_scope` varchar(200) DEFAULT NULL COMMENT '评价口径',
  `fiscal_year` varchar(20) DEFAULT NULL COMMENT '财年',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='经营指标';

DROP TABLE IF EXISTS `sf_cost_item`;
CREATE TABLE `sf_cost_item` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `cost_name` varchar(100) NOT NULL COMMENT '成本科目',
  `amount` decimal(14,2) DEFAULT NULL COMMENT '金额（万元/元）',
  `ratio` decimal(5,2) DEFAULT NULL COMMENT '占比%',
  `description` varchar(500) DEFAULT NULL COMMENT '说明',
  `fiscal_year` varchar(20) DEFAULT NULL COMMENT '财年',
  `sort_order` int DEFAULT '0' COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='成本科目';

DROP TABLE IF EXISTS `sf_plot_profit`;
CREATE TABLE `sf_plot_profit` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `plot_id` bigint DEFAULT NULL COMMENT '地块（→ sf_plot.id）',
  `base_name` varchar(100) DEFAULT NULL COMMENT '基地名称',
  `variety` varchar(50) DEFAULT NULL COMMENT '品种',
  `area` decimal(12,2) DEFAULT NULL COMMENT '面积(亩)',
  `tree_count` int DEFAULT NULL COMMENT '树木数量(棵)',
  `yield` decimal(12,2) DEFAULT NULL COMMENT '产量(吨)',
  `revenue` decimal(14,2) DEFAULT NULL COMMENT '收入(元)',
  `cost` decimal(14,2) DEFAULT NULL COMMENT '成本(元)',
  `profit` decimal(14,2) DEFAULT NULL COMMENT '利润(元)',
  `rate` decimal(5,2) DEFAULT NULL COMMENT '利润率%',
  `fiscal_year` varchar(20) DEFAULT NULL COMMENT '财年',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_plot_profit_plot` (`plot_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='地块经营数据';

DROP TABLE IF EXISTS `sf_performance_result`;
CREATE TABLE `sf_performance_result` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id` bigint DEFAULT NULL COMMENT '人员（→ sf_user.id）',
  `real_name` varchar(100) NOT NULL COMMENT '姓名',
  `team` varchar(50) DEFAULT NULL COMMENT '班组（一班/二班/三班）',
  `period` varchar(50) DEFAULT NULL COMMENT '周期',
  `complete_rate` decimal(5,2) DEFAULT NULL COMMENT '完成率(%)',
  `quality_score` decimal(5,2) DEFAULT NULL COMMENT '质量评分',
  `workload` decimal(12,2) DEFAULT NULL COMMENT '工作量',
  `composite` decimal(5,2) DEFAULT NULL COMMENT '综合评分',
  `rating` varchar(20) DEFAULT NULL COMMENT '评级',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_performance_user` (`user_id`),
  KEY `idx_performance_team` (`team`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='绩效结果';

DROP TABLE IF EXISTS `sf_performance_task`;
CREATE TABLE `sf_performance_task` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `performance_id` bigint DEFAULT NULL COMMENT '绩效结果（→ sf_performance_result.id）',
  `task_name` varchar(200) DEFAULT NULL COMMENT '任务名称',
  `plot_id` bigint DEFAULT NULL COMMENT '地块（→ sf_plot.id）',
  `task_type` varchar(50) DEFAULT NULL COMMENT '任务类型',
  `complete_time` datetime DEFAULT NULL COMMENT '完成时间',
  `quality_score` decimal(5,2) DEFAULT NULL COMMENT '质量评分',
  `status` varchar(20) DEFAULT NULL COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_performance_task_perf` (`performance_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='绩效任务明细';

-- ============================================================
-- 【销售管理（订单 / 发货 / 客户 / 售后 / 价格 / 目标 / 对账）】
-- ============================================================

DROP TABLE IF EXISTS `sf_sales_order`;
CREATE TABLE `sf_sales_order` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_code` varchar(50) NOT NULL COMMENT '订单编号（唯一）',
  `order_type` varchar(20) DEFAULT NULL COMMENT '订单类型（批发/零售）',
  `source` varchar(20) DEFAULT NULL COMMENT '来源（后台录入/H5商城）',
  `customer_name` varchar(100) DEFAULT NULL COMMENT '客户名称',
  `contact` varchar(50) DEFAULT NULL COMMENT '联系人',
  `phone` varchar(20) DEFAULT NULL COMMENT '电话',
  `address` varchar(255) DEFAULT NULL COMMENT '地址',
  `customer_id` bigint DEFAULT NULL COMMENT '客户（→ sf_sales_customer.id）',
  `product_info` varchar(1000) DEFAULT NULL COMMENT '商品明细',
  `quantity` decimal(12,2) DEFAULT NULL COMMENT '数量',
  `price` decimal(12,2) DEFAULT NULL COMMENT '单价',
  `amount` decimal(14,2) DEFAULT NULL COMMENT '金额',
  `received` decimal(14,2) DEFAULT NULL COMMENT '已收',
  `receivable` decimal(14,2) DEFAULT NULL COMMENT '应收/待收',
  `discount` decimal(14,2) DEFAULT '0.00' COMMENT '优惠金额',
  `freight` decimal(14,2) DEFAULT '0.00' COMMENT '运费',
  `deposit` decimal(14,2) DEFAULT '0.00' COMMENT '订金',
  `channel` varchar(50) DEFAULT NULL COMMENT '渠道',
  `pay_status` varchar(20) DEFAULT NULL COMMENT '付款状态',
  `pay_method` varchar(50) DEFAULT NULL COMMENT '支付方式',
  `batch_no` varchar(50) DEFAULT NULL COMMENT '批次号',
  `trace_code` varchar(100) DEFAULT NULL COMMENT '追溯码',
  `receiver` varchar(100) DEFAULT NULL COMMENT '收货人',
  `receiver_phone` varchar(20) DEFAULT NULL COMMENT '收货电话',
  `receiver_address` varchar(255) DEFAULT NULL COMMENT '收货地址',
  `expected_date` date DEFAULT NULL COMMENT '期望日期',
  `invoice_status` varchar(20) DEFAULT NULL COMMENT '开票状态',
  `ship_company` varchar(50) DEFAULT NULL COMMENT '物流公司',
  `ship_no` varchar(100) DEFAULT NULL COMMENT '物流单号',
  `shipped_at` datetime DEFAULT NULL COMMENT '发货时间',
  `received_at` datetime DEFAULT NULL COMMENT '收货时间',
  `cancelled_at` datetime DEFAULT NULL COMMENT '取消时间',
  `cancel_reason` varchar(500) DEFAULT NULL COMMENT '取消原因',
  `refunded_amount` decimal(14,2) DEFAULT '0.00' COMMENT '退款金额',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '订单状态（11态）',
  `operator` varchar(100) DEFAULT NULL COMMENT '经办人',
  `order_time` datetime DEFAULT NULL COMMENT '下单时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sales_order_code` (`order_code`),
  KEY `idx_sales_order_customer` (`customer_id`)
) ENGINE=InnoDB AUTO_INCREMENT=72 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='销售订单';

DROP TABLE IF EXISTS `sf_sales_shipment`;
CREATE TABLE `sf_sales_shipment` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `shipment_code` varchar(50) NOT NULL COMMENT '发货单号（唯一）',
  `order_code` varchar(50) DEFAULT NULL COMMENT '订单编码',
  `customer_name` varchar(100) DEFAULT NULL COMMENT '客户名称',
  `order_id` bigint DEFAULT NULL COMMENT '订单（→ sf_sales_order.id）',
  `product_info` varchar(1000) DEFAULT NULL COMMENT '商品明细',
  `quantity` decimal(12,2) DEFAULT NULL COMMENT '数量',
  `amount` decimal(14,2) DEFAULT NULL COMMENT '订单金额',
  `receiver` varchar(100) DEFAULT NULL COMMENT '收货人',
  `receiver_phone` varchar(20) DEFAULT NULL COMMENT '收货人电话',
  `address` varchar(255) DEFAULT NULL COMMENT '收货地址',
  `express_company` varchar(50) DEFAULT NULL COMMENT '快递公司',
  `tracking_no` varchar(100) DEFAULT NULL COMMENT '运单号',
  `ship_time` datetime DEFAULT NULL COMMENT '发货时间',
  `sign_time` datetime DEFAULT NULL COMMENT '签收时间',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态（在途/已签收）',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `source` varchar(20) DEFAULT 'manual' COMMENT '来源',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sales_shipment_code` (`shipment_code`),
  KEY `idx_sales_shipment_order` (`order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=58 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='发货与物流';

DROP TABLE IF EXISTS `sf_sales_customer`;
CREATE TABLE `sf_sales_customer` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `customer_code` varchar(50) NOT NULL COMMENT '客户编号（唯一）',
  `customer_name` varchar(100) NOT NULL COMMENT '客户名称',
  `contact` varchar(50) DEFAULT NULL COMMENT '联系人',
  `phone` varchar(20) DEFAULT NULL COMMENT '电话',
  `wechat` varchar(50) DEFAULT NULL COMMENT '微信',
  `email` varchar(100) DEFAULT NULL COMMENT '邮箱',
  `customer_type` varchar(20) DEFAULT NULL COMMENT '客户类型（认养用户/批发/零售）',
  `grade` varchar(20) DEFAULT NULL COMMENT '等级（VIP/黄金/白银）',
  `region` varchar(100) DEFAULT NULL COMMENT '所属区域',
  `address` varchar(255) DEFAULT NULL COMMENT '地址',
  `source` varchar(50) DEFAULT NULL COMMENT '客户来源',
  `channel` varchar(50) DEFAULT NULL COMMENT '渠道',
  `salesman` varchar(100) DEFAULT NULL COMMENT '业务员',
  `order_count` int DEFAULT '0' COMMENT '订单数',
  `deal_amount` decimal(14,2) DEFAULT NULL COMMENT '成交金额',
  `received_amount` decimal(14,2) DEFAULT NULL COMMENT '回款金额',
  `receivable_balance` decimal(14,2) DEFAULT NULL COMMENT '应收余额',
  `account_age` int DEFAULT NULL COMMENT '账龄（天）',
  `credit_limit` decimal(14,2) DEFAULT NULL COMMENT '信用额度',
  `account_period` varchar(50) DEFAULT NULL COMMENT '账期',
  `invoice_info` varchar(500) DEFAULT NULL COMMENT '开票信息',
  `tags` varchar(500) DEFAULT NULL COMMENT '标签JSON',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态：active/dormant',
  `last_order_time` datetime DEFAULT NULL COMMENT '最近下单',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sales_customer_code` (`customer_code`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='客户';

DROP TABLE IF EXISTS `sf_sales_aftersale`;
CREATE TABLE `sf_sales_aftersale` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `aftersale_code` varchar(50) NOT NULL COMMENT '售后单号（唯一）',
  `order_code` varchar(50) DEFAULT NULL COMMENT '订单编码',
  `order_id` bigint DEFAULT NULL COMMENT '订单（→ sf_sales_order.id）',
  `customer_name` varchar(100) DEFAULT NULL COMMENT '客户',
  `aftersale_type` varchar(20) DEFAULT NULL COMMENT '类型（仅退款/退货退款/换货）',
  `reason` varchar(500) DEFAULT NULL COMMENT '售后原因',
  `quantity` decimal(12,2) DEFAULT NULL COMMENT '数量',
  `apply_amount` decimal(14,2) DEFAULT NULL COMMENT '申请金额',
  `apply_time` datetime DEFAULT NULL COMMENT '申请时间',
  `handler` varchar(100) DEFAULT NULL COMMENT '处理人',
  `handled_at` datetime DEFAULT NULL COMMENT '处理时间',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态（8态）',
  `reject_reason` varchar(500) DEFAULT NULL COMMENT '驳回原因',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `restock` tinyint DEFAULT '0' COMMENT '是否回库',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sales_aftersale_code` (`aftersale_code`),
  KEY `idx_sales_aftersale_order` (`order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='售后与退款';

DROP TABLE IF EXISTS `sf_sales_price_policy`;
CREATE TABLE `sf_sales_price_policy` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `policy_code` varchar(50) NOT NULL COMMENT '政策编号（唯一）',
  `policy_name` varchar(100) NOT NULL COMMENT '政策名称',
  `product` varchar(100) DEFAULT NULL COMMENT '商品',
  `unit` varchar(20) DEFAULT NULL COMMENT '单位',
  `agreement_price` decimal(12,2) DEFAULT NULL COMMENT '协议单价',
  `min_order` decimal(12,2) DEFAULT NULL COMMENT '起订量',
  `applicable_object` varchar(100) DEFAULT NULL COMMENT '适用对象',
  `scope` varchar(200) DEFAULT NULL COMMENT '适用范围',
  `start_date` date DEFAULT NULL COMMENT '开始日期',
  `end_date` date DEFAULT NULL COMMENT '失效日期',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态（4态）',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sales_price_policy_code` (`policy_code`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='价格政策';

DROP TABLE IF EXISTS `sf_sales_promotion`;
CREATE TABLE `sf_sales_promotion` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `promotion_code` varchar(50) NOT NULL COMMENT '活动编号（唯一）',
  `promotion_name` varchar(100) NOT NULL COMMENT '活动名称',
  `promotion_type` varchar(20) DEFAULT NULL COMMENT '促销类型（4类）',
  `discount_type` varchar(20) DEFAULT NULL COMMENT '优惠类型',
  `discount_rule` varchar(500) DEFAULT NULL COMMENT '优惠规则',
  `product` varchar(100) DEFAULT NULL COMMENT '商品',
  `start_date` date DEFAULT NULL COMMENT '生效日期',
  `end_date` date DEFAULT NULL COMMENT '结束日期',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sales_promotion_code` (`promotion_code`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='促销活动';

DROP TABLE IF EXISTS `sf_sales_target`;
CREATE TABLE `sf_sales_target` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `target_code` varchar(50) DEFAULT NULL COMMENT '目标编码',
  `period` varchar(50) DEFAULT NULL COMMENT '目标期间',
  `manager` varchar(100) DEFAULT NULL COMMENT '负责人',
  `target_orders` int DEFAULT NULL COMMENT '目标订单',
  `target_amount` decimal(14,2) DEFAULT NULL COMMENT '目标金额',
  `actual_orders` int DEFAULT NULL COMMENT '实际订单',
  `actual_amount` decimal(14,2) DEFAULT NULL COMMENT '实际金额',
  `order_rate` decimal(5,2) DEFAULT NULL COMMENT '订单达成率',
  `amount_rate` decimal(5,2) DEFAULT NULL COMMENT '金额达成率',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='销售目标';

DROP TABLE IF EXISTS `sf_sales_statement`;
CREATE TABLE `sf_sales_statement` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `statement_code` varchar(50) NOT NULL COMMENT '对账单号（唯一）',
  `customer_code` varchar(50) DEFAULT NULL COMMENT '客户编码',
  `customer_name` varchar(100) DEFAULT NULL COMMENT '客户',
  `period` varchar(50) DEFAULT NULL COMMENT '对账期间',
  `channel` varchar(50) DEFAULT NULL COMMENT '渠道',
  `order_count` int DEFAULT '0' COMMENT '订单数',
  `order_ids` varchar(1000) DEFAULT NULL COMMENT '订单ID列表JSON',
  `amount` decimal(14,2) DEFAULT NULL COMMENT '对账金额',
  `received` decimal(14,2) DEFAULT NULL COMMENT '已收金额',
  `receivable_balance` decimal(14,2) DEFAULT NULL COMMENT '应收余额',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/confirmed/settled',
  `generate_time` datetime DEFAULT NULL COMMENT '生成时间',
  `confirmed_at` datetime DEFAULT NULL COMMENT '确认时间',
  `settled_at` datetime DEFAULT NULL COMMENT '结清时间',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sales_statement_code` (`statement_code`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='客户对账单';

DROP TABLE IF EXISTS `sf_sales_receipt`;
CREATE TABLE `sf_sales_receipt` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `receipt_code` varchar(50) NOT NULL COMMENT '收款单号（唯一）',
  `order_code` varchar(50) DEFAULT NULL COMMENT '订单编码',
  `order_id` bigint DEFAULT NULL COMMENT '订单（→ sf_sales_order.id）',
  `customer_name` varchar(100) DEFAULT NULL COMMENT '客户',
  `amount` decimal(14,2) DEFAULT NULL COMMENT '收款金额',
  `pay_way` varchar(50) DEFAULT NULL COMMENT '方式',
  `operator` varchar(100) DEFAULT NULL COMMENT '操作人',
  `voucher_no` varchar(100) DEFAULT NULL COMMENT '凭证号',
  `receipt_type` varchar(20) DEFAULT 'income' COMMENT '收支类型',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `receipt_time` datetime DEFAULT NULL COMMENT '收款时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sales_receipt_code` (`receipt_code`),
  KEY `idx_sales_receipt_order` (`order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=67 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='收款流水';

-- ============================================================
-- 【数据运营（数据源 / 归集 / 模型监控 / 成效 / 里程碑）】
-- ============================================================

DROP TABLE IF EXISTS `sf_data_source`;
CREATE TABLE `sf_data_source` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `source_code` varchar(50) DEFAULT NULL COMMENT '数据源编码',
  `name` varchar(100) NOT NULL COMMENT '数据源名称',
  `type` varchar(20) DEFAULT NULL COMMENT '类型（业务库/IoT网关/区块链/移动端）',
  `protocol` varchar(50) DEFAULT NULL COMMENT '协议（REST API/MQTT/WebSocket/HTTPS等）',
  `address` varchar(255) DEFAULT NULL COMMENT '接入地址',
  `frequency` varchar(20) DEFAULT NULL COMMENT '采集频率',
  `status` varchar(20) NOT NULL DEFAULT 'running' COMMENT '状态：running/delayed/offline',
  `heartbeat` datetime DEFAULT NULL COMMENT '最近心跳',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='数据源接入';

DROP TABLE IF EXISTS `sf_data_collection`;
CREATE TABLE `sf_data_collection` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `source` varchar(100) NOT NULL COMMENT '数据来源（农事/设备/销售/溯源/环境）',
  `category` varchar(50) DEFAULT NULL COMMENT '大类',
  `collect_amount` bigint DEFAULT NULL COMMENT '归集量（条）',
  `yoy` decimal(5,2) DEFAULT NULL COMMENT '同比%',
  `qualified_rate` decimal(5,2) DEFAULT NULL COMMENT '合格率(%)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_data_collection_source` (`source`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='数据归集';

DROP TABLE IF EXISTS `sf_model_monitor`;
CREATE TABLE `sf_model_monitor` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `model_name` varchar(100) NOT NULL COMMENT '模型名称',
  `version` varchar(50) DEFAULT NULL COMMENT '版本',
  `call_count` bigint DEFAULT '0' COMMENT '调用次数',
  `hit_rate` decimal(5,2) DEFAULT NULL COMMENT '命中率(%)',
  `response_time` varchar(50) DEFAULT NULL COMMENT '响应时长',
  `status` varchar(20) NOT NULL DEFAULT 'online' COMMENT '状态（在线/离线）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='模型监控';

DROP TABLE IF EXISTS `sf_achievement`;
CREATE TABLE `sf_achievement` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `item_name` varchar(100) NOT NULL COMMENT '成效项（节水/节肥/减药/增产/减损）',
  `before_value` varchar(50) DEFAULT NULL COMMENT '实施前',
  `after_value` varchar(50) DEFAULT NULL COMMENT '实施后',
  `change_range` varchar(50) DEFAULT NULL COMMENT '变化幅度',
  `unit` varchar(20) DEFAULT NULL COMMENT '单位',
  `description` varchar(500) DEFAULT NULL COMMENT '说明',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='成效记录';

DROP TABLE IF EXISTS `sf_milestone`;
CREATE TABLE `sf_milestone` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name` varchar(200) NOT NULL COMMENT '亮点名称',
  `milestone_date` varchar(20) DEFAULT NULL COMMENT '日期（YYYY-MM 或 YYYY-MM-DD）',
  `description` varchar(500) DEFAULT NULL COMMENT '说明',
  `status` varchar(20) DEFAULT 'done' COMMENT '状态',
  `sort_order` int DEFAULT '0' COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='数字化里程碑';

-- ============================================================
-- 【模型管理（模型配置 / 物候 / 病虫害 / 产量预估）】
-- ============================================================

DROP TABLE IF EXISTS `sf_model_config`;
CREATE TABLE `sf_model_config` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `model_code` varchar(50) NOT NULL COMMENT '模型编码（growth/weather/pest/phenology/yield/price）',
  `model_name` varchar(100) NOT NULL COMMENT '模型名称',
  `snapshot_json` longtext COMMENT '模型快照JSON',
  `enabled` tinyint NOT NULL DEFAULT '1' COMMENT '启用状态（0/1）',
  `version` varchar(50) DEFAULT NULL COMMENT '版本',
  `accuracy` decimal(5,2) DEFAULT NULL COMMENT '平均准确率(%)',
  `hit_rate` decimal(5,2) DEFAULT NULL COMMENT '命中率(%)',
  `call_count` bigint DEFAULT '0' COMMENT '调用次数',
  `response_time` varchar(50) DEFAULT NULL COMMENT '平均响应时长(ms)',
  `last_call_time` datetime DEFAULT NULL COMMENT '最近调用时间',
  `train_cycle` varchar(20) DEFAULT NULL COMMENT '训练周期（每周/每月/每季度/手动）',
  `data_range` varchar(20) DEFAULT NULL COMMENT '数据范围（最近1年/3年/5年/全部）',
  `last_train_time` datetime DEFAULT NULL COMMENT '最近训练时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_model_config_code` (`model_code`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='模型配置';

DROP TABLE IF EXISTS `sf_model_threshold`;
CREATE TABLE `sf_model_threshold` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `threshold_key` varchar(50) NOT NULL COMMENT '阈值键（pest_high/pest_mid/yield_confidence/temp_deviation/phenology_offset/price_fluctuation）',
  `threshold_name` varchar(100) DEFAULT NULL COMMENT '阈值名称',
  `threshold_value` varchar(50) DEFAULT NULL COMMENT '阈值',
  `unit` varchar(20) DEFAULT NULL COMMENT '单位',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_model_threshold_key` (`threshold_key`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='模型阈值配置';

DROP TABLE IF EXISTS `sf_phenology_stage`;
CREATE TABLE `sf_phenology_stage` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `stage_name` varchar(100) NOT NULL COMMENT '物候期名称',
  `variety` varchar(100) DEFAULT NULL COMMENT '适用品种',
  `start_date` varchar(20) DEFAULT NULL COMMENT '起始日期（MM-DD）',
  `end_date` varchar(20) DEFAULT NULL COMMENT '结束日期（MM-DD）',
  `sort_order` int DEFAULT '0' COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='物候期配置';

DROP TABLE IF EXISTS `sf_pest_risk`;
CREATE TABLE `sf_pest_risk` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `plot_id` bigint DEFAULT NULL COMMENT '地块（→ sf_plot.id）',
  `variety` varchar(100) DEFAULT NULL COMMENT '主栽品种',
  `pest_type` varchar(100) DEFAULT NULL COMMENT '病虫害类型',
  `risk_index` int DEFAULT NULL COMMENT '风险指数',
  `risk_level` varchar(20) DEFAULT NULL COMMENT '风险等级（高/中/低）',
  `manager` varchar(100) DEFAULT NULL COMMENT '责任人',
  `suggestion` varchar(500) DEFAULT NULL COMMENT '防治建议',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_pest_risk_plot` (`plot_id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='地块病虫害风险';

DROP TABLE IF EXISTS `sf_yield_forecast`;
CREATE TABLE `sf_yield_forecast` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `plot_id` bigint DEFAULT NULL COMMENT '地块（→ sf_plot.id）',
  `variety` varchar(100) DEFAULT NULL COMMENT '品种',
  `area` decimal(12,2) DEFAULT NULL COMMENT '面积',
  `forecast_yield` decimal(12,2) DEFAULT NULL COMMENT '预估产量',
  `last_year_yield` decimal(12,2) DEFAULT NULL COMMENT '上年度实采',
  `deviation_rate` decimal(5,2) DEFAULT NULL COMMENT '偏差率(%)',
  `confidence` decimal(5,2) DEFAULT NULL COMMENT '置信度(%)',
  `status` varchar(20) DEFAULT NULL COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_yield_forecast_plot` (`plot_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='产量预估';

-- ============================================================
-- 【商城管理（商品 / 促销 / 优惠券 / 订单 / 会员 / 社区等）】
-- ============================================================

DROP TABLE IF EXISTS `sf_mall_product`;
CREATE TABLE `sf_mall_product` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `product_code` varchar(50) NOT NULL COMMENT '商品编码（唯一）',
  `product_name` varchar(200) NOT NULL COMMENT '商品名称',
  `desc` varchar(500) DEFAULT NULL COMMENT '描述',
  `category_id` bigint DEFAULT NULL COMMENT '分类（→ sf_mall_category.id）',
  `variety` varchar(100) DEFAULT NULL COMMENT '品种',
  `spec` varchar(100) DEFAULT NULL COMMENT '规格',
  `unit` varchar(20) DEFAULT NULL COMMENT '单位',
  `tag` varchar(100) DEFAULT NULL COMMENT '标签',
  `price` decimal(12,2) DEFAULT NULL COMMENT '售价',
  `original` decimal(12,2) DEFAULT NULL COMMENT '原价',
  `cost_price` decimal(12,2) DEFAULT NULL COMMENT '成本价',
  `member_price` decimal(12,2) DEFAULT NULL COMMENT '会员价',
  `stock` int DEFAULT NULL COMMENT '库存',
  `safety_stock` int DEFAULT '0' COMMENT '安全库存',
  `sold_count` int DEFAULT '0' COMMENT '销量',
  `sort` int DEFAULT '0' COMMENT '排序',
  `service_tags` varchar(500) DEFAULT NULL COMMENT '服务标签JSON',
  `detail_html` mediumtext COMMENT '详情HTML',
  `file_id` bigint DEFAULT NULL COMMENT '商品图（→ sf_file.id）',
  `status` varchar(20) NOT NULL DEFAULT 'on' COMMENT '状态：on在售/off下架',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mall_product_code` (`product_code`),
  KEY `idx_mall_product_category` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商城商品';

DROP TABLE IF EXISTS `sf_mall_category`;
CREATE TABLE `sf_mall_category` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `category_code` varchar(50) NOT NULL COMMENT '分类编码（唯一）',
  `category_name` varchar(100) NOT NULL COMMENT '分类名称',
  `product_count` int DEFAULT '0' COMMENT '商品数',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态',
  `sort_order` int DEFAULT '0' COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mall_category_code` (`category_code`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商城商品分类';

DROP TABLE IF EXISTS `sf_mall_variety`;
CREATE TABLE `sf_mall_variety` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `variety_code` varchar(50) NOT NULL COMMENT '品种编码（唯一）',
  `variety_name` varchar(100) NOT NULL COMMENT '品种名称',
  `product_count` int DEFAULT '0' COMMENT '商品数',
  `sort` int DEFAULT '0' COMMENT '排序',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mall_variety_code` (`variety_code`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商城苹果品种';

DROP TABLE IF EXISTS `sf_mall_promotion`;
CREATE TABLE `sf_mall_promotion` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `promotion_name` varchar(100) NOT NULL COMMENT '活动名称',
  `subtitle` varchar(200) DEFAULT NULL COMMENT '副标题',
  `img` varchar(255) DEFAULT NULL COMMENT '图片',
  `tag` varchar(100) DEFAULT NULL COMMENT '标签',
  `scope` varchar(500) DEFAULT NULL COMMENT '范围',
  `channel` varchar(50) DEFAULT NULL COMMENT '渠道',
  `limit_per_user` int DEFAULT NULL COMMENT '每人限购',
  `total_stock` int DEFAULT NULL COMMENT '总库存',
  `used_stock` int DEFAULT '0' COMMENT '已售',
  `priority` int DEFAULT '0' COMMENT '优先级',
  `member_only` tinyint DEFAULT '0' COMMENT '仅会员',
  `target` varchar(500) DEFAULT NULL COMMENT '目标',
  `original` decimal(12,2) DEFAULT NULL COMMENT '原价',
  `promotion_type` varchar(20) DEFAULT NULL COMMENT '类型',
  `product_ids` varchar(500) DEFAULT NULL COMMENT '关联商品/范围',
  `price_range` varchar(100) DEFAULT NULL COMMENT '价格区间',
  `position` varchar(20) DEFAULT NULL COMMENT '展示位置（首页最新活动/商品页活动）',
  `start_date` date DEFAULT NULL COMMENT '开始日期',
  `end_date` date DEFAULT NULL COMMENT '结束日期',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态：active/stopped/ended',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商城促销活动';

DROP TABLE IF EXISTS `sf_mall_coupon`;
CREATE TABLE `sf_mall_coupon` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `coupon_name` varchar(100) NOT NULL COMMENT '优惠券名称',
  `coupon_code` varchar(50) DEFAULT NULL COMMENT '券码',
  `coupon_type` varchar(20) DEFAULT NULL COMMENT '类型（满减券/折扣券）',
  `desc` varchar(500) DEFAULT NULL COMMENT '描述',
  `threshold` varchar(100) DEFAULT NULL COMMENT '使用门槛',
  `discount` varchar(100) DEFAULT NULL COMMENT '优惠规则',
  `total_count` int DEFAULT NULL COMMENT '发放量',
  `issued_count` int DEFAULT '0' COMMENT '已发放',
  `used_count` int DEFAULT '0' COMMENT '核销量',
  `per_limit` int DEFAULT NULL COMMENT '每人限领',
  `scope` varchar(500) DEFAULT NULL COMMENT '适用范围',
  `sku_ids` varchar(1000) DEFAULT NULL COMMENT 'SKU列表',
  `stackable` tinyint DEFAULT '0' COMMENT '是否可叠加',
  `receive_type` varchar(20) DEFAULT NULL COMMENT '领取方式',
  `valid_start` date DEFAULT NULL COMMENT '有效期起',
  `valid_end` date DEFAULT NULL COMMENT '有效期止',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商城优惠券';

DROP TABLE IF EXISTS `sf_mall_banner`;
CREATE TABLE `sf_mall_banner` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name` varchar(100) DEFAULT NULL COMMENT '名称',
  `subtitle` varchar(200) DEFAULT NULL COMMENT '副标题',
  `file_id` bigint DEFAULT NULL COMMENT '图片（→ sf_file.id）',
  `jump_link` varchar(255) DEFAULT NULL COMMENT '跳转链接',
  `sort_order` int DEFAULT '0' COMMENT '排序',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='首页轮播图';

DROP TABLE IF EXISTS `sf_mall_quick_entry`;
CREATE TABLE `sf_mall_quick_entry` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name` varchar(100) DEFAULT NULL COMMENT '名称',
  `icon` varchar(100) DEFAULT NULL COMMENT '图标',
  `title` varchar(200) DEFAULT NULL COMMENT '标题/副标题',
  `badge` varchar(50) DEFAULT NULL COMMENT '角标',
  `jump_link` varchar(255) DEFAULT NULL COMMENT '跳转链接',
  `sort_order` int DEFAULT '0' COMMENT '排序',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='首页快捷入口';

DROP TABLE IF EXISTS `sf_mall_order`;
CREATE TABLE `sf_mall_order` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_code` varchar(50) NOT NULL COMMENT '订单号（唯一）',
  `member_id` bigint DEFAULT NULL COMMENT '会员（→ sf_mall_member.id）',
  `member_name` varchar(100) DEFAULT NULL COMMENT '会员昵称',
  `product_info` varchar(1000) DEFAULT NULL COMMENT '商品明细',
  `amount` decimal(14,2) DEFAULT NULL COMMENT '金额',
  `subtotal` decimal(14,2) DEFAULT NULL COMMENT '小计',
  `discount` decimal(14,2) DEFAULT '0.00' COMMENT '优惠',
  `coupon_code` varchar(50) DEFAULT NULL COMMENT '券码',
  `coupon_discount` decimal(14,2) DEFAULT '0.00' COMMENT '券优惠',
  `points_used` int DEFAULT '0' COMMENT '使用积分',
  `points_discount` decimal(14,2) DEFAULT '0.00' COMMENT '积分抵扣',
  `freight` decimal(14,2) DEFAULT '0.00' COMMENT '运费',
  `pay_way` varchar(50) DEFAULT NULL COMMENT '支付方式',
  `pay_txn_no` varchar(100) DEFAULT NULL COMMENT '支付流水',
  `pay_time` datetime DEFAULT NULL COMMENT '支付时间',
  `invoice_id` varchar(50) DEFAULT NULL COMMENT '发票ID',
  `address` varchar(255) DEFAULT NULL COMMENT '收货地址',
  `order_time` datetime DEFAULT NULL COMMENT '下单时间',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/to_ship/done/refunded/cancelled',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `after_sales_id` varchar(50) DEFAULT NULL COMMENT '售后ID',
  `logistics` varchar(1000) DEFAULT NULL COMMENT '物流JSON',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mall_order_code` (`order_code`),
  KEY `idx_mall_order_member` (`member_id`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商城C端订单';

DROP TABLE IF EXISTS `sf_mall_aftersale`;
CREATE TABLE `sf_mall_aftersale` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `aftersale_code` varchar(50) NOT NULL COMMENT '售后单号（唯一）',
  `order_code` varchar(50) DEFAULT NULL COMMENT '订单编码',
  `order_id` bigint DEFAULT NULL COMMENT '订单（→ sf_mall_order.id）',
  `member_name` varchar(100) DEFAULT NULL COMMENT '会员',
  `aftersale_type` varchar(20) DEFAULT NULL COMMENT '类型',
  `refund_amount` decimal(14,2) DEFAULT NULL COMMENT '退款金额',
  `reason` varchar(500) DEFAULT NULL COMMENT '原因',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/refunding/refunded/rejected',
  `handler` varchar(100) DEFAULT NULL COMMENT '处理人',
  `handle_at` datetime DEFAULT NULL COMMENT '处理时间',
  `apply_at` datetime DEFAULT NULL COMMENT '申请时间',
  `reject_reason` varchar(500) DEFAULT NULL COMMENT '驳回原因',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mall_aftersale_code` (`aftersale_code`),
  KEY `idx_mall_aftersale_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商城售后';

DROP TABLE IF EXISTS `sf_mall_invoice`;
CREATE TABLE `sf_mall_invoice` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `invoice_code` varchar(50) NOT NULL COMMENT '发票编号（唯一）',
  `order_id` bigint DEFAULT NULL COMMENT '关联订单（→ sf_mall_order.id）',
  `invoice_type` varchar(20) DEFAULT NULL COMMENT '类型（电子普通/增值税专用）',
  `content_type` varchar(20) DEFAULT NULL COMMENT '内容类型',
  `title` varchar(200) DEFAULT NULL COMMENT '发票抬头',
  `tax_no` varchar(50) DEFAULT NULL COMMENT '税号',
  `email` varchar(100) DEFAULT NULL COMMENT '邮箱',
  `phone` varchar(20) DEFAULT NULL COMMENT '电话',
  `company_address` varchar(255) DEFAULT NULL COMMENT '公司地址',
  `company_phone` varchar(20) DEFAULT NULL COMMENT '公司电话',
  `bank_name` varchar(100) DEFAULT NULL COMMENT '开户行',
  `bank_account` varchar(50) DEFAULT NULL COMMENT '银行账号',
  `title_type` varchar(20) DEFAULT NULL COMMENT '抬头类型',
  `amount` decimal(14,2) DEFAULT NULL COMMENT '金额',
  `invoice_no` varchar(50) DEFAULT NULL COMMENT '发票号码',
  `issue_time` datetime DEFAULT NULL COMMENT '开票时间',
  `reject_reason` varchar(500) DEFAULT NULL COMMENT '驳回原因',
  `void_reason` varchar(500) DEFAULT NULL COMMENT '作废原因',
  `reissue_of` varchar(50) DEFAULT NULL COMMENT '重开来源',
  `operator` varchar(100) DEFAULT NULL COMMENT '操作人',
  `apply_time` datetime DEFAULT NULL COMMENT '申请时间',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/issued/rejected',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mall_invoice_code` (`invoice_code`),
  KEY `idx_mall_invoice_order` (`order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商城发票';

DROP TABLE IF EXISTS `sf_mall_freight`;
CREATE TABLE `sf_mall_freight` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `template_name` varchar(100) NOT NULL COMMENT '模板名称',
  `cover_region` varchar(255) DEFAULT NULL COMMENT '覆盖区域',
  `first_count` int DEFAULT NULL COMMENT '首件数',
  `first_price` decimal(12,2) DEFAULT NULL COMMENT '首件价格',
  `continue_count` int DEFAULT NULL COMMENT '续件数',
  `continue_price` decimal(12,2) DEFAULT NULL COMMENT '续件价格',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商城运费模板';

DROP TABLE IF EXISTS `sf_mall_member`;
CREATE TABLE `sf_mall_member` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `member_code` varchar(50) NOT NULL COMMENT '会员编号（唯一）',
  `user_id` varchar(50) DEFAULT NULL COMMENT '用户ID',
  `nickname` varchar(100) DEFAULT NULL COMMENT '会员昵称',
  `avatar` varchar(255) DEFAULT NULL COMMENT '头像',
  `gender` varchar(10) DEFAULT NULL COMMENT '性别',
  `region` varchar(100) DEFAULT NULL COMMENT '地区',
  `phone` varchar(20) DEFAULT NULL COMMENT '手机号（登录账号）',
  `password` varchar(100) DEFAULT NULL COMMENT '密码哈希（bcrypt）',
  `level` varchar(20) NOT NULL DEFAULT 'normal' COMMENT '等级：vip/gold/normal',
  `points` int DEFAULT '0' COMMENT '积分',
  `growth` int DEFAULT '0' COMMENT '成长值',
  `tags` varchar(500) DEFAULT NULL COMMENT '标签JSON',
  `source` varchar(50) DEFAULT NULL COMMENT '来源',
  `address` varchar(255) DEFAULT NULL COMMENT '地址',
  `order_count` int DEFAULT '0' COMMENT '订单数',
  `total_consume` decimal(14,2) DEFAULT NULL COMMENT '消费总额',
  `favorite_count` int DEFAULT '0' COMMENT '收藏',
  `adoption_count` int DEFAULT '0' COMMENT '认养',
  `register_time` datetime DEFAULT NULL COMMENT '注册时间',
  `last_order_time` datetime DEFAULT NULL COMMENT '最近下单',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mall_member_code` (`member_code`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商城会员';

DROP TABLE IF EXISTS `sf_mall_level_rule`;
CREATE TABLE `sf_mall_level_rule` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `level` varchar(20) NOT NULL COMMENT '等级（vip/gold/normal）',
  `level_name` varchar(50) DEFAULT NULL COMMENT '等级名称',
  `threshold` decimal(14,2) DEFAULT NULL COMMENT '消费门槛',
  `points_ratio` decimal(5,2) DEFAULT NULL COMMENT '消费积分比例',
  `points_offset_ratio` decimal(5,2) DEFAULT NULL COMMENT '积分抵扣比例',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mall_level_rule_level` (`level`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='会员等级规则';

DROP TABLE IF EXISTS `sf_mall_post`;
CREATE TABLE `sf_mall_post` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `author` varchar(100) DEFAULT NULL COMMENT '作者',
  `member_id` varchar(50) DEFAULT NULL COMMENT '会员ID',
  `content` text COMMENT '动态内容',
  `images` varchar(1000) DEFAULT NULL COMMENT '图片JSON',
  `topic` varchar(100) DEFAULT NULL COMMENT '话题',
  `product_id` varchar(50) DEFAULT NULL COMMENT '商品ID',
  `like_count` int DEFAULT '0' COMMENT '点赞数',
  `comment_count` int DEFAULT '0' COMMENT '评论数',
  `publish_time` datetime DEFAULT NULL COMMENT '发布时间',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/published/rejected',
  `audit_by` varchar(100) DEFAULT NULL COMMENT '审核人',
  `audit_at` datetime DEFAULT NULL COMMENT '审核时间',
  `reject_reason` varchar(500) DEFAULT NULL COMMENT '驳回原因',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='社区内容';

DROP TABLE IF EXISTS `sf_mall_notice`;
CREATE TABLE `sf_mall_notice` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `trigger_scene` varchar(50) DEFAULT NULL COMMENT '触发场景（支付成功/订单发货/订单退款/活动开始/系统通知）',
  `title` varchar(200) DEFAULT NULL COMMENT '标题',
  `content` text COMMENT '内容',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='消息通知模板';

DROP TABLE IF EXISTS `sf_mall_coupon_claim`;
CREATE TABLE `sf_mall_coupon_claim` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `claim_code` varchar(50) DEFAULT NULL COMMENT '领取记录ID',
  `coupon_code` varchar(50) DEFAULT NULL COMMENT '券码',
  `member_key` varchar(100) DEFAULT NULL COMMENT '会员标识',
  `status` varchar(20) DEFAULT 'claimed' COMMENT '状态',
  `claimed_at` datetime DEFAULT NULL COMMENT '领取时间',
  `used_at` datetime DEFAULT NULL COMMENT '核销时间',
  `order_no` varchar(50) DEFAULT NULL COMMENT '核销订单',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_claim_coupon` (`coupon_code`),
  KEY `idx_claim_member` (`member_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商城领券核销记录';

DROP TABLE IF EXISTS `sf_mall_cart`;
CREATE TABLE `sf_mall_cart` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `cart_code` varchar(50) NOT NULL COMMENT '购物车项编号（唯一）',
  `member_id` bigint DEFAULT NULL COMMENT '会员（→ sf_mall_member.id）',
  `member_key` varchar(100) DEFAULT NULL COMMENT '会员标识（未登录游客用设备标识）',
  `product_code` varchar(50) DEFAULT NULL COMMENT '商品编号（→ sf_mall_product）',
  `product_name` varchar(200) DEFAULT NULL COMMENT '商品名',
  `product_img` varchar(500) DEFAULT NULL COMMENT '商品图',
  `spec` varchar(200) DEFAULT NULL COMMENT '规格',
  `price` decimal(14,2) DEFAULT NULL COMMENT '单价',
  `quantity` int NOT NULL DEFAULT '1' COMMENT '数量',
  `checked` tinyint NOT NULL DEFAULT '1' COMMENT '是否勾选结算：0/1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mall_cart_code` (`cart_code`),
  KEY `idx_mall_cart_member` (`member_id`),
  KEY `idx_mall_cart_member_key` (`member_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商城购物车';

DROP TABLE IF EXISTS `sf_mall_address`;
CREATE TABLE `sf_mall_address` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `address_code` varchar(50) NOT NULL COMMENT '地址编号（唯一）',
  `member_id` bigint DEFAULT NULL COMMENT '会员（→ sf_mall_member.id）',
  `member_key` varchar(100) DEFAULT NULL COMMENT '会员标识',
  `name` varchar(50) DEFAULT NULL COMMENT '收货人姓名',
  `phone` varchar(20) DEFAULT NULL COMMENT '收货人电话',
  `region` varchar(100) DEFAULT NULL COMMENT '所在地区',
  `detail` varchar(255) DEFAULT NULL COMMENT '详细地址',
  `is_default` tinyint NOT NULL DEFAULT '0' COMMENT '是否默认地址：0/1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mall_address_code` (`address_code`),
  KEY `idx_mall_address_member` (`member_id`),
  KEY `idx_mall_address_member_key` (`member_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商城收货地址';

DROP TABLE IF EXISTS `sf_mall_favorite`;
CREATE TABLE `sf_mall_favorite` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `favorite_code` varchar(50) NOT NULL COMMENT '收藏编号（唯一）',
  `member_id` bigint DEFAULT NULL COMMENT '会员（→ sf_mall_member.id）',
  `member_key` varchar(100) DEFAULT NULL COMMENT '会员标识',
  `product_code` varchar(50) DEFAULT NULL COMMENT '商品编号（→ sf_mall_product）',
  `product_name` varchar(200) DEFAULT NULL COMMENT '商品名',
  `product_img` varchar(500) DEFAULT NULL COMMENT '商品图',
  `price` decimal(14,2) DEFAULT NULL COMMENT '收藏时价格',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mall_favorite_code` (`favorite_code`),
  KEY `idx_mall_favorite_member` (`member_id`),
  KEY `idx_mall_favorite_member_key` (`member_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商城收藏';

-- ============================================================
-- 【移动端运营（作业账号 / 反馈 / 咨询 / 消息 / 资讯 / AI / 知识库）】
-- ============================================================

DROP TABLE IF EXISTS `sf_mb_staff_account`;
CREATE TABLE `sf_mb_staff_account` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `account` varchar(50) NOT NULL COMMENT '登录账号（唯一）',
  `password` varchar(200) NOT NULL COMMENT '密码（SHA-256摘要）',
  `real_name` varchar(100) DEFAULT NULL COMMENT '作业人员姓名',
  `phone` varchar(20) DEFAULT NULL COMMENT '手机号',
  `role` varchar(20) DEFAULT NULL COMMENT '角色（管理员/果农/访客）',
  `base_id` bigint DEFAULT NULL COMMENT '所属基地（→ sf_base.id）',
  `is_expert` tinyint NOT NULL DEFAULT '0' COMMENT '农技专家标识（0/1）',
  `expertise` varchar(200) DEFAULT NULL COMMENT '专长',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态：active/disabled',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mb_staff_account` (`account`),
  KEY `idx_mb_staff_base` (`base_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='作业人员账号';

DROP TABLE IF EXISTS `sf_mb_feedback`;
CREATE TABLE `sf_mb_feedback` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title` varchar(200) NOT NULL COMMENT '反馈标题',
  `content` text COMMENT '反馈内容',
  `feedback_type` varchar(20) DEFAULT NULL COMMENT '类型（3类）',
  `source` varchar(20) DEFAULT NULL COMMENT '来源端（移动端/H5消费者端）',
  `submitter` varchar(100) DEFAULT NULL COMMENT '提交人',
  `operator` varchar(100) DEFAULT NULL COMMENT '操作人',
  `operator_id` varchar(50) DEFAULT NULL COMMENT '操作人ID',
  `contact` varchar(100) DEFAULT NULL COMMENT '联系方式',
  `submit_time` datetime DEFAULT NULL COMMENT '提交时间',
  `review_time` datetime DEFAULT NULL COMMENT '审核时间',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态（4态）',
  `conclusion` varchar(20) DEFAULT NULL COMMENT '处理结论（3类）',
  `reply` text COMMENT '官方回复',
  `reject_reason` varchar(500) DEFAULT NULL COMMENT '驳回原因',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='意见反馈';

DROP TABLE IF EXISTS `sf_mb_expert_consult`;
CREATE TABLE `sf_mb_expert_consult` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title` varchar(200) NOT NULL COMMENT '问题标题',
  `content` text COMMENT '问题内容',
  `questioner` varchar(100) DEFAULT NULL COMMENT '提问人',
  `question_time` datetime DEFAULT NULL COMMENT '提问时间',
  `expert_id` bigint DEFAULT NULL COMMENT '指派专家（→ sf_mb_staff_account.id）',
  `expert_reply` text COMMENT '专家答复',
  `reply_time` datetime DEFAULT NULL COMMENT '回复时间',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/replied',
  `source` varchar(20) DEFAULT NULL COMMENT '来源',
  `operator` varchar(100) DEFAULT NULL COMMENT '操作人',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_mb_expert_consult_expert` (`expert_id`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='专家咨询';

DROP TABLE IF EXISTS `sf_mb_message`;
CREATE TABLE `sf_mb_message` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title` varchar(200) NOT NULL COMMENT '标题',
  `content` text COMMENT '内容',
  `category` varchar(50) DEFAULT NULL COMMENT '分类',
  `target` varchar(20) DEFAULT NULL COMMENT '面向对象（mobile/all）',
  `publisher` varchar(100) DEFAULT NULL COMMENT '发布人',
  `publish_time` datetime DEFAULT NULL COMMENT '发布时间',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '启用状态',
  `source` varchar(20) DEFAULT NULL COMMENT '来源',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='消息推送';

DROP TABLE IF EXISTS `sf_mb_sync_queue`;
CREATE TABLE `sf_mb_sync_queue` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `sync_type` varchar(50) DEFAULT NULL COMMENT '同步类型',
  `record_id` varchar(100) DEFAULT NULL COMMENT '关联记录ID',
  `payload` text COMMENT '载荷摘要',
  `enqueue_time` datetime DEFAULT NULL COMMENT '入队时间',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/synced/failed',
  `retry` int DEFAULT '0' COMMENT '重试次数',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_mb_sync_queue_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='同步队列';

DROP TABLE IF EXISTS `sf_mb_news`;
CREATE TABLE `sf_mb_news` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title` varchar(200) NOT NULL COMMENT '资讯标题',
  `category` varchar(50) DEFAULT NULL COMMENT '分类（公告/培训/技术/政策）',
  `summary` varchar(500) DEFAULT NULL COMMENT '摘要',
  `content` text COMMENT '正文',
  `cover_file_id` bigint DEFAULT NULL COMMENT '封面（→ sf_file.id）',
  `author` varchar(100) DEFAULT NULL COMMENT '作者',
  `source` varchar(100) DEFAULT NULL COMMENT '来源',
  `read_count` int DEFAULT '0' COMMENT '阅读量',
  `publisher` varchar(100) DEFAULT NULL COMMENT '发布人',
  `publish_time` datetime DEFAULT NULL COMMENT '发布时间',
  `is_top` tinyint NOT NULL DEFAULT '0' COMMENT '置顶（0/1）',
  `status` varchar(20) NOT NULL DEFAULT 'published' COMMENT '状态：published/offline',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='资讯';

DROP TABLE IF EXISTS `sf_mb_ai_category`;
CREATE TABLE `sf_mb_ai_category` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `category_name` varchar(100) NOT NULL COMMENT '分类名称',
  `category_id` varchar(50) DEFAULT NULL COMMENT '分类ID',
  `description` varchar(500) DEFAULT NULL COMMENT '描述',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI助手分类';

DROP TABLE IF EXISTS `sf_mb_ai_question`;
CREATE TABLE `sf_mb_ai_question` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `category_id` bigint DEFAULT NULL COMMENT '所属分类（→ sf_mb_ai_category.id）',
  `question` varchar(500) NOT NULL COMMENT '问题内容',
  `related_question` varchar(500) DEFAULT NULL COMMENT '关联问题',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_mb_ai_question_category` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI助手热门问题';

DROP TABLE IF EXISTS `sf_mb_disease_rule`;
CREATE TABLE `sf_mb_disease_rule` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `disease_name` varchar(100) NOT NULL COMMENT '病害名称',
  `match_keywords` varchar(500) DEFAULT NULL COMMENT '匹配关键字（任一命中）',
  `confidence` decimal(5,2) DEFAULT NULL COMMENT '置信度(%)',
  `risk_level` varchar(20) DEFAULT NULL COMMENT '风险等级（高/中/低）',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='病害识别规则';

DROP TABLE IF EXISTS `sf_mb_fault_kb`;
CREATE TABLE `sf_mb_fault_kb` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `fault_title` varchar(200) NOT NULL COMMENT '故障标题',
  `device_type` varchar(50) DEFAULT NULL COMMENT '设备类型',
  `category` varchar(50) DEFAULT NULL COMMENT '分类（灌溉/传感器/气象/摄像头/无人机/其他）',
  `urgency` varchar(20) DEFAULT NULL COMMENT '紧急程度（3档）',
  `step_count` int DEFAULT '0' COMMENT '步骤数',
  `steps` text COMMENT '排查步骤',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='设备故障知识库';

-- ============================================================
-- 【系统管理（部门 / 岗位 / 角色 / 用户 / 菜单 / 权限 / 配置 / 通知）】
-- ============================================================

DROP TABLE IF EXISTS `sf_dept`;
CREATE TABLE `sf_dept` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `parent_id` bigint NOT NULL DEFAULT '0' COMMENT '父部门（顶级为 0）',
  `dept_name` varchar(100) NOT NULL COMMENT '部门名称',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `manager` varchar(50) DEFAULT NULL COMMENT '负责人',
  `phone` varchar(20) DEFAULT NULL COMMENT '联系电话',
  `email` varchar(100) DEFAULT NULL COMMENT '邮箱',
  `dept_status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态：active/disabled',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除：0=正常 1=已删除',
  PRIMARY KEY (`id`),
  KEY `idx_dept_parent` (`parent_id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='部门';

DROP TABLE IF EXISTS `sf_post`;
CREATE TABLE `sf_post` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `post_code` varchar(50) NOT NULL COMMENT '岗位编码',
  `post_name` varchar(100) NOT NULL COMMENT '岗位名称',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '岗位顺序',
  `post_status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_post_code` (`post_code`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='岗位';

DROP TABLE IF EXISTS `sf_role`;
CREATE TABLE `sf_role` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `role_name` varchar(50) NOT NULL COMMENT '角色名称',
  `role_code` varchar(50) NOT NULL COMMENT '角色代码',
  `description` varchar(255) DEFAULT NULL COMMENT '描述',
  `role_status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_code` (`role_code`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='角色';

DROP TABLE IF EXISTS `sf_user`;
CREATE TABLE `sf_user` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `username` varchar(50) NOT NULL COMMENT '账号',
  `password` varchar(100) NOT NULL COMMENT '密码哈希（bcrypt）',
  `real_name` varchar(50) DEFAULT NULL COMMENT '姓名',
  `phone` varchar(11) DEFAULT NULL COMMENT '手机号',
  `avatar_file_id` bigint DEFAULT NULL COMMENT '头像（→ sf_file.id）',
  `dept_id` bigint DEFAULT NULL COMMENT '部门（→ sf_dept.id）',
  `post_id` bigint DEFAULT NULL COMMENT '岗位（→ sf_post.id）',
  `role_id` bigint DEFAULT NULL COMMENT '角色（→ sf_role.id）',
  `base_id` bigint DEFAULT NULL COMMENT '所属基地（→ sf_base.id）',
  `user_status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态：active/disabled',
  `last_login_at` datetime DEFAULT NULL COMMENT '最后登录时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_username` (`username`),
  UNIQUE KEY `uk_user_phone` (`phone`),
  KEY `idx_user_dept` (`dept_id`),
  KEY `idx_user_role` (`role_id`),
  KEY `idx_user_base` (`base_id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户';

DROP TABLE IF EXISTS `sf_menu`;
CREATE TABLE `sf_menu` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `parent_id` bigint NOT NULL DEFAULT '0' COMMENT '父菜单（顶级为 0）',
  `menu_name` varchar(100) NOT NULL COMMENT '菜单名称',
  `menu_type` varchar(20) NOT NULL DEFAULT 'menu' COMMENT '目录/菜单/按钮',
  `perm_code` varchar(100) DEFAULT NULL COMMENT '权限标识',
  `route` varchar(255) DEFAULT NULL COMMENT '路由地址',
  `menu_status` varchar(20) NOT NULL DEFAULT 'normal' COMMENT '状态',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_menu_parent` (`parent_id`)
) ENGINE=InnoDB AUTO_INCREMENT=104 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='菜单';

DROP TABLE IF EXISTS `sf_role_menu`;
CREATE TABLE `sf_role_menu` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `role_id` bigint NOT NULL COMMENT '角色',
  `menu_id` bigint NOT NULL COMMENT '菜单',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_rm_role` (`role_id`),
  KEY `idx_rm_menu` (`menu_id`)
) ENGINE=InnoDB AUTO_INCREMENT=104 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='角色-菜单关联';

DROP TABLE IF EXISTS `sf_permission`;
CREATE TABLE `sf_permission` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `menu_id` bigint DEFAULT NULL COMMENT '所属菜单',
  `perm_code` varchar(50) NOT NULL COMMENT '权限点：view/add/edit/delete/export',
  `perm_name` varchar(50) NOT NULL COMMENT '权限名',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_perm_menu` (`menu_id`)
) ENGINE=InnoDB AUTO_INCREMENT=58 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='权限点';

DROP TABLE IF EXISTS `sf_system_config`;
CREATE TABLE `sf_system_config` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `source_name` varchar(100) NOT NULL COMMENT '数据源名称',
  `source_type` varchar(50) DEFAULT NULL COMMENT '类型（→ sf_dict）',
  `protocol` varchar(50) DEFAULT NULL COMMENT '协议（如 mqtt/http）',
  `access_url` varchar(255) DEFAULT NULL COMMENT '接入地址',
  `collect_freq` varchar(50) DEFAULT NULL COMMENT '采集频率',
  `config_status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态：active/disabled',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='系统配置（数据源）';

DROP TABLE IF EXISTS `sf_notification`;
CREATE TABLE `sf_notification` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id` bigint NOT NULL COMMENT '用户（→ sf_user.id）',
  `notice_code` varchar(50) NOT NULL COMMENT '通知项编码：device_alert/farming_alert/daily_report/weekly_report/inbox/email/sms',
  `enabled` tinyint NOT NULL DEFAULT '1' COMMENT '是否开启：0=关 1=开',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notice_user_code` (`user_id`,`notice_code`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='通知设置';
