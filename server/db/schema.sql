-- ============================================================
-- 智慧果园平台 · 数据库建表脚本（全量 131 张表）
-- 依据：《数据设计约定.md》 + 《核心数据模型.md》
-- 数据库：MySQL 8.x
-- 排序：按后台菜单（业务组织）顺序排列
--   全局公共表 → 企业管理 → 生产 → 采收 → 物资 → 溯源 → 认养
--   → 预警 → 设备 → 证书 → 经营分析 → 销售 → 数据运营
--   → 模型 → 商城 → 移动端运营 → 系统管理
-- 约定：

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 【全局公共表（字典 / 文件 / 日志）】
-- ============================================================
DROP TABLE IF EXISTS `sf_dict`;
CREATE TABLE `sf_dict` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `dict_type`   VARCHAR(50)  NOT NULL                COMMENT '字典类型（如 产品等级/农事类型）',
  `dict_code`   VARCHAR(50)  NOT NULL                COMMENT '字典编码（如 GRADE_TYPE）',
  `dict_name`   VARCHAR(100) NOT NULL                COMMENT '字典名称（如 苹果等级分类）',
  `dict_value`  VARCHAR(500) NOT NULL                COMMENT '字典值（逗号分隔的枚举项，如 特级,一级,二级,等外）',
  `sort_order`  INT          NOT NULL DEFAULT 0      COMMENT '排序',
  `dict_status` VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT '状态：active/disabled',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  `is_deleted`  TINYINT      NOT NULL DEFAULT 0      COMMENT '逻辑删除：0=正常 1=已删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dict_code` (`dict_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据字典';

DROP TABLE IF EXISTS `sf_file`;
CREATE TABLE `sf_file` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `file_name`   VARCHAR(255) NOT NULL                COMMENT '原始文件名',
  `file_type`   VARCHAR(20)  NOT NULL                COMMENT '类型：image/video/document',
  `file_size`   BIGINT       NOT NULL DEFAULT 0      COMMENT '大小（字节）',
  `store_path`  VARCHAR(500) NOT NULL                COMMENT '实际存储路径',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`  TINYINT      NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文件';

DROP TABLE IF EXISTS `sf_operation_log`;
CREATE TABLE `sf_operation_log` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`     BIGINT       DEFAULT NULL            COMMENT '操作人（→ sf_user.id）',
  `module`      VARCHAR(50)  NOT NULL                COMMENT '模块',
  `action`      VARCHAR(20)  NOT NULL                COMMENT '动作：新增/修改/删除/导出/登录',
  `target_id`   BIGINT       DEFAULT NULL            COMMENT '操作对象 ID',
  `detail`      TEXT                                 COMMENT '详情',
  `ip`          VARCHAR(50)  DEFAULT NULL            COMMENT '来源 IP',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`  TINYINT      NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_log_user` (`user_id`),
  KEY `idx_log_module` (`module`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志';

-- ============================================================
-- 【企业管理（企业信息 / 基地 / 地块 / 土壤检测 / VR 全景）】
-- ============================================================
DROP TABLE IF EXISTS `sf_enterprise`;
CREATE TABLE `sf_enterprise` (
  `id`              BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name`            VARCHAR(200) NOT NULL                COMMENT '企业名称',
  `credit_code`     VARCHAR(50)  DEFAULT NULL            COMMENT '统一信用代码',
  `legal_person`    VARCHAR(50)  DEFAULT NULL            COMMENT '法定代表人',
  `capital`         DECIMAL(16,2) DEFAULT NULL           COMMENT '注册资本（万元）',
  `establish_date`  DATE         DEFAULT NULL            COMMENT '成立日期',
  `enterprise_type` VARCHAR(50)  DEFAULT NULL            COMMENT '企业类型（→ sf_dict）',
  `industry`        VARCHAR(100) DEFAULT NULL            COMMENT '所属行业',
  `biz_status`      VARCHAR(50)  DEFAULT NULL            COMMENT '经营状态（→ sf_dict）',
  `address`         VARCHAR(300) DEFAULT NULL            COMMENT '注册地址',
  `scope`           TEXT                                 COMMENT '经营范围',
  `term_start`      DATE         DEFAULT NULL            COMMENT '营业期限起',
  `term_end`        DATE         DEFAULT NULL            COMMENT '营业期限止（长期为空）',
  `authority`       VARCHAR(100) DEFAULT NULL            COMMENT '登记机关',
  `banner_file_id`  BIGINT       DEFAULT NULL            COMMENT '横幅图（→ sf_file.id）',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`      TINYINT      NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业基本信息';

-- 对应：企业信息页 · 业务结构区块

DROP TABLE IF EXISTS `sf_enterprise_biz`;
CREATE TABLE `sf_enterprise_biz` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `enterprise_id` BIGINT     DEFAULT NULL            COMMENT '企业（→ sf_enterprise.id）',
  `sort_order`  INT          NOT NULL DEFAULT 0      COMMENT '排序',
  `icon`        VARCHAR(20)  DEFAULT NULL            COMMENT '图标',
  `color`       VARCHAR(20)  DEFAULT NULL            COMMENT '色值标识',
  `name`        VARCHAR(100) NOT NULL                COMMENT '业务名称',
  `description` TEXT                                 COMMENT '业务描述',
  `m1_label`    VARCHAR(50)  DEFAULT NULL            COMMENT '指标1名称',
  `m1_value`    VARCHAR(50)  DEFAULT NULL            COMMENT '指标1数值',
  `m2_label`    VARCHAR(50)  DEFAULT NULL            COMMENT '指标2名称',
  `m2_value`    VARCHAR(50)  DEFAULT NULL            COMMENT '指标2数值',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  `is_deleted`  TINYINT      NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业业务结构';

-- 对应：企业信息页 · 人员规模区块

DROP TABLE IF EXISTS `sf_enterprise_staff`;
CREATE TABLE `sf_enterprise_staff` (
  `id`            BIGINT      NOT NULL AUTO_INCREMENT COMMENT '主键',
  `enterprise_id` BIGINT      DEFAULT NULL            COMMENT '企业（→ sf_enterprise.id）',
  `sort_order`    INT         NOT NULL DEFAULT 0      COMMENT '排序',
  `role_type`     VARCHAR(50) NOT NULL                COMMENT '角色分类（→ sf_dict：管理/销售/技术/作业/后勤/其他）',
  `count`         INT         NOT NULL DEFAULT 0      COMMENT '人员数量',
  `created_at`    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  `is_deleted`    TINYINT     NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业人员规模';

-- 对应：企业信息页 · 专家团队区块

DROP TABLE IF EXISTS `sf_enterprise_expert`;
CREATE TABLE `sf_enterprise_expert` (
  `id`             BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `enterprise_id`  BIGINT       DEFAULT NULL            COMMENT '企业（→ sf_enterprise.id）',
  `sort_order`     INT          NOT NULL DEFAULT 0      COMMENT '排序',
  `name`           VARCHAR(50)  NOT NULL                COMMENT '专家姓名',
  `avatar_file_id` BIGINT       DEFAULT NULL            COMMENT '头像（→ sf_file.id）',
  `role`           VARCHAR(50)  DEFAULT NULL            COMMENT '专家职务',
  `org`            VARCHAR(200) DEFAULT NULL            COMMENT '所属机构',
  `join_date`      DATE         DEFAULT NULL            COMMENT '加入日期',
  `description`    TEXT                                 COMMENT '简介',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  `is_deleted`     TINYINT      NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业专家团队';

-- 对应：企业信息页 · 资质证书区块（原 CertStore）

DROP TABLE IF EXISTS `sf_enterprise_cert`;
CREATE TABLE `sf_enterprise_cert` (
  `id`             BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `enterprise_id`  BIGINT       DEFAULT NULL            COMMENT '企业（→ sf_enterprise.id）',
  `sort_order`     INT          NOT NULL DEFAULT 0      COMMENT '排序',
  `cert_type`      VARCHAR(50)  DEFAULT NULL            COMMENT '资质类型（→ sf_dict）',
  `cert_no`        VARCHAR(100) DEFAULT NULL            COMMENT '证书编号',
  `org`            VARCHAR(200) DEFAULT NULL            COMMENT '发证机构',
  `issue_date`     DATE         DEFAULT NULL            COMMENT '发证日期',
  `expire_date`    DATE         DEFAULT NULL            COMMENT '有效期至',
  `file_id`        BIGINT       DEFAULT NULL            COMMENT '证书图片（→ sf_file.id）',
  `top_show`       TINYINT      NOT NULL DEFAULT 0      COMMENT '顶部显示：0=否 1=是',
  `cert_status`    VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT '状态：active/expired/revoked',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  `is_deleted`     TINYINT      NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_cert_enterprise` (`enterprise_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业资质证书';

-- 对应：企业信息页 · 发展历程区块

DROP TABLE IF EXISTS `sf_enterprise_timeline`;
CREATE TABLE `sf_enterprise_timeline` (
  `id`            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `enterprise_id` BIGINT       DEFAULT NULL            COMMENT '企业（→ sf_enterprise.id）',
  `sort_order`    INT          NOT NULL DEFAULT 0      COMMENT '排序',
  `timeline_date` VARCHAR(50)  DEFAULT NULL            COMMENT '时间（如"2010年10月"）',
  `title`         VARCHAR(100) NOT NULL                COMMENT '标题',
  `description`   TEXT                                 COMMENT '描述',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  `is_deleted`    TINYINT      NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业发展历程';

-- 对应：企业信息页 · 经营数据区块

DROP TABLE IF EXISTS `sf_enterprise_operation`;
CREATE TABLE `sf_enterprise_operation` (
  `id`            BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `enterprise_id` BIGINT        DEFAULT NULL            COMMENT '企业（→ sf_enterprise.id）',
  `sort_order`    INT           NOT NULL DEFAULT 0      COMMENT '排序',
  `label`         VARCHAR(100)  NOT NULL                COMMENT '经营指标',
  `value`         DECIMAL(16,2) DEFAULT NULL            COMMENT '经营数值',
  `unit`          VARCHAR(20)   DEFAULT NULL            COMMENT '单位（万元/吨/亩/项/户）',
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  `is_deleted`    TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业经营数据';

-- 生产管理模块（farming_plan / task_assign / farming_record /
--              farming_patrol / drone_patrol / guide_standard）

-- 农事计划（farming_plan.html）

DROP TABLE IF EXISTS `sf_base`;
CREATE TABLE `sf_base` (
  `id`          BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `code`        VARCHAR(50)   DEFAULT NULL            COMMENT '基地编号',
  `name`        VARCHAR(100)  NOT NULL                COMMENT '基地名称（唯一）',
  `base_status` VARCHAR(20)   NOT NULL DEFAULT 'planning' COMMENT '状态：planning/built/active/disabled',
  `address`     VARCHAR(255)  DEFAULT NULL            COMMENT '地址',
  `area`        DECIMAL(12,2) DEFAULT NULL            COMMENT '面积（亩）',
  `manager_id`  BIGINT        DEFAULT NULL            COMMENT '负责人（→ sf_user.id）',
  `phone`       VARCHAR(20)   DEFAULT NULL            COMMENT '联系电话',
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`  TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_base_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='基地';

DROP TABLE IF EXISTS `sf_plot`;
CREATE TABLE `sf_plot` (
  `id`            BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `code`          VARCHAR(50)   DEFAULT NULL           COMMENT '地块编号',
  `name`          VARCHAR(100)  NOT NULL               COMMENT '地块名称（唯一）',
  `plot_type`     VARCHAR(20)   DEFAULT NULL           COMMENT '地块类型（→ sf_dict）',
  `base_id`       BIGINT        DEFAULT NULL           COMMENT '所属基地（→ sf_base.id）',
  `variety_code`  VARCHAR(50)   DEFAULT NULL           COMMENT '果树品种（→ sf_dict）',
  `manager_id`    BIGINT        DEFAULT NULL           COMMENT '负责人（→ sf_user.id）',
  `area`          DECIMAL(12,2) DEFAULT NULL           COMMENT '面积（亩）',
  `plant_year`    VARCHAR(10)   DEFAULT NULL           COMMENT '种植年份',
  `lng`           DECIMAL(10,6) DEFAULT NULL           COMMENT '经度',
  `lat`           DECIMAL(10,6) DEFAULT NULL           COMMENT '纬度',
  `plot_status`   VARCHAR(20)   NOT NULL DEFAULT 'normal' COMMENT '状态：normal/warning/danger/fallow/maintain',
  `audit_status`  VARCHAR(20)   DEFAULT NULL           COMMENT '审核状态（→ sf_dict）',
  `draw_time`     DATETIME      DEFAULT NULL           COMMENT '绘制时间',
  `remark`        VARCHAR(500)  DEFAULT NULL           COMMENT '绘制说明',
  `file_id`       BIGINT        DEFAULT NULL           COMMENT '实景图（→ sf_file.id）',
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT       NOT NULL DEFAULT 0     COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_plot_name` (`name`),
  KEY `idx_plot_base` (`base_id`),
  KEY `idx_plot_manager` (`manager_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='地块';

DROP TABLE IF EXISTS `sf_soil_test`;
CREATE TABLE `sf_soil_test` (
  `id`             BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `test_code`      VARCHAR(50)   DEFAULT NULL            COMMENT '检测编号',
  `plot_id`        BIGINT        DEFAULT NULL            COMMENT '地块（→ sf_plot.id）',
  `sample_date`    DATE          DEFAULT NULL            COMMENT '采样日期',
  `lab`            VARCHAR(100)  DEFAULT NULL            COMMENT '化验室/检测机构',
  `organic_matter` DECIMAL(5,2)  DEFAULT NULL            COMMENT '有机质(%)',
  `available_n`    DECIMAL(6,2)  DEFAULT NULL            COMMENT '速效氮(mg/kg)',
  `available_p`    DECIMAL(6,2)  DEFAULT NULL            COMMENT '速效磷(mg/kg)',
  `available_k`    DECIMAL(6,2)  DEFAULT NULL            COMMENT '速效钾(mg/kg)',
  `ph`             DECIMAL(4,2)  DEFAULT NULL            COMMENT 'pH',
  `ec`             DECIMAL(8,2)  DEFAULT NULL            COMMENT 'EC(μS/cm)',
  `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`     TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_soil_plot` (`plot_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='土壤检测记录';

-- 对应：企业管理 · 土壤检测页（soil_test_record.html）
-- 数据源：smartorchard_soil_tests_v1（后台/大屏/移动端同源）

-- 对应：企业管理 · VR 全景页（vr_panorama.html）
-- 数据源：vr-hotspots.js（3 场景 12 热点 5 类）

DROP TABLE IF EXISTS `sf_vr_scene`;
CREATE TABLE `sf_vr_scene` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `scene_code`  VARCHAR(50)  DEFAULT NULL            COMMENT '场景编码（如 scene_main）',
  `name`        VARCHAR(100) NOT NULL                COMMENT '场景名称',
  `base_id`     BIGINT       DEFAULT NULL            COMMENT '所属基地（→ sf_base.id）',
  `plot_id`     BIGINT       DEFAULT NULL            COMMENT '所属地块（→ sf_plot.id）',
  `scene_type`  VARCHAR(20)  DEFAULT NULL            COMMENT '场景类型：entrance/plot/...（→ sf_dict）',
  `scene_status` VARCHAR(20) DEFAULT NULL            COMMENT '状态：published/draft',
  `image_file_id` BIGINT     DEFAULT NULL            COMMENT '全景图（→ sf_file.id）',
  `yaw`         DECIMAL(6,2) DEFAULT 180             COMMENT '初始水平角',
  `pitch`       DECIMAL(6,2) DEFAULT 0               COMMENT '初始俯仰角',
  `hfov`        DECIMAL(6,2) DEFAULT 100             COMMENT '视场角',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  `is_deleted`  TINYINT      NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='VR全景场景';

DROP TABLE IF EXISTS `sf_vr_hotspot`;
CREATE TABLE `sf_vr_hotspot` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `scene_id`    BIGINT       NOT NULL                COMMENT '所属场景（→ sf_vr_scene.id）',
  `hotspot_code` VARCHAR(50) DEFAULT NULL            COMMENT '热点编码',
  `hotspot_type` VARCHAR(20) DEFAULT NULL            COMMENT '热点类型：plot/device/task/building/scene',
  `title`       VARCHAR(100) NOT NULL                COMMENT '标题',
  `content`     TEXT                                 COMMENT '内容（HTML）',
  `target_id`   VARCHAR(100) DEFAULT NULL            COMMENT '关联目标（地块/设备/任务等）',
  `pitch`       DECIMAL(6,2) DEFAULT 0               COMMENT '俯仰角',
  `yaw`         DECIMAL(6,2) DEFAULT 0               COMMENT '水平角',
  `hotspot_status` VARCHAR(20) DEFAULT 'normal'      COMMENT '状态：normal/warning/danger',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  `is_deleted`  TINYINT      NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_hotspot_scene` (`scene_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='VR全景热点';

-- 企业管理模块：企业信息页（enterprise_info.html）相关表

-- 对应：企业信息页 · 基本信息区块 + 横幅

-- ============================================================
-- 【生产管理（农事计划 / 任务 / 记录 / 巡园 / 无人机 / 标准）】
-- ============================================================
DROP TABLE IF EXISTS `sf_farming_plan`;
CREATE TABLE `sf_farming_plan` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `plan_code`    VARCHAR(50)   NOT NULL                COMMENT '计划编号（唯一）',
  `plan_name`    VARCHAR(100)  NOT NULL                COMMENT '计划名称',
  `plan_type`    VARCHAR(20)   DEFAULT NULL            COMMENT '类型（枚举→字典：年度/季度/月度等）',
  `base_id`      BIGINT        DEFAULT NULL            COMMENT '所属基地（→ sf_base.id）',
  `plot_ids`     VARCHAR(500)  DEFAULT NULL            COMMENT '地块范围（多地块ID，逗号分隔）',
  `manager_id`   BIGINT        DEFAULT NULL            COMMENT '负责人（→ sf_user.id）',
  `standard_id`  BIGINT        DEFAULT NULL            COMMENT '引用标准（→ sf_guide_standard.id）',
  `start_date`   DATE          DEFAULT NULL            COMMENT '开始日期',
  `end_date`     DATE          DEFAULT NULL            COMMENT '结束日期',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'draft' COMMENT '状态：draft/pending/approved/rejected/in_progress/done',
  `progress`     DECIMAL(5,2)  DEFAULT NULL            COMMENT '完成率（0-100）',
  `remark`       VARCHAR(500)  DEFAULT NULL            COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_farming_plan_code` (`plan_code`),
  KEY `idx_farming_plan_base` (`base_id`),
  KEY `idx_farming_plan_manager` (`manager_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农事计划';

-- 任务管理（task_assign.html）

DROP TABLE IF EXISTS `sf_farming_task`;
CREATE TABLE `sf_farming_task` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `task_code`    VARCHAR(50)   NOT NULL                COMMENT '任务编号（唯一）',
  `task_name`    VARCHAR(100)  NOT NULL                COMMENT '任务名称',
  `plan_id`      BIGINT        DEFAULT NULL            COMMENT '来源计划（→ sf_farming_plan.id）',
  `category`     VARCHAR(20)   DEFAULT NULL            COMMENT '类别（枚举→字典）',
  `priority`     VARCHAR(20)   DEFAULT NULL            COMMENT '优先级（枚举→字典：高/中/低）',
  `base_id`      BIGINT        DEFAULT NULL            COMMENT '基地（→ sf_base.id）',
  `plot_ids`     VARCHAR(500)  DEFAULT NULL            COMMENT '地块（多地块ID，逗号分隔）',
  `manager_id`   BIGINT        DEFAULT NULL            COMMENT '负责人（→ sf_user.id）',
  `team`         VARCHAR(100)  DEFAULT NULL            COMMENT '班组',
  `executor`     VARCHAR(200)  DEFAULT NULL            COMMENT '执行主体',
  `deadline`     DATETIME      DEFAULT NULL            COMMENT '截止时间',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态：pending/in_progress/done/overdue',
  `remark`       VARCHAR(500)  DEFAULT NULL            COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_farming_task_code` (`task_code`),
  KEY `idx_farming_task_plan` (`plan_id`),
  KEY `idx_farming_task_base` (`base_id`),
  KEY `idx_farming_task_manager` (`manager_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农事任务';

-- 农事记录（farming_record.html）

DROP TABLE IF EXISTS `sf_farming_record`;
CREATE TABLE `sf_farming_record` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `record_code`  VARCHAR(50)   NOT NULL                COMMENT '记录编号（唯一）',
  `plan_id`      BIGINT        DEFAULT NULL            COMMENT '关联计划（→ sf_farming_plan.id）',
  `task_id`      BIGINT        DEFAULT NULL            COMMENT '关联任务（→ sf_farming_task.id）',
  `base_id`      BIGINT        DEFAULT NULL            COMMENT '所属基地（→ sf_base.id）',
  `plot_ids`     VARCHAR(500)  DEFAULT NULL            COMMENT '地块范围',
  `farm_type`    VARCHAR(20)   DEFAULT NULL            COMMENT '农事类型（枚举→字典：施肥/喷药/修剪/灌溉/其他）',
  `material_type` VARCHAR(20)  DEFAULT NULL            COMMENT '农资类型（枚举→字典：肥料/农药/工具）',
  `executor`     VARCHAR(100)  DEFAULT NULL            COMMENT '执行人',
  `execute_date` DATE          DEFAULT NULL            COMMENT '执行日期',
  `complete_amount` DECIMAL(12,2) DEFAULT NULL         COMMENT '完成量',
  `content`      VARCHAR(1000) DEFAULT NULL            COMMENT '执行内容',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态',
  `remark`       VARCHAR(500)  DEFAULT NULL            COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_farming_record_code` (`record_code`),
  KEY `idx_farming_record_plan` (`plan_id`),
  KEY `idx_farming_record_task` (`task_id`),
  KEY `idx_farming_record_base` (`base_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农事记录';

-- 巡园计划（farming_patrol.html 计划Tab）

DROP TABLE IF EXISTS `sf_patrol_plan`;
CREATE TABLE `sf_patrol_plan` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `plan_code`    VARCHAR(50)   NOT NULL                COMMENT '巡查编号（唯一）',
  `base_id`      BIGINT        DEFAULT NULL            COMMENT '所属基地（→ sf_base.id）',
  `patrol_type`  VARCHAR(20)   DEFAULT NULL            COMMENT '巡查类型（枚举→字典：日常/专项/病虫害/气象/生长）',
  `plot_ids`     VARCHAR(500)  DEFAULT NULL            COMMENT '巡查地块',
  `route_id`     BIGINT        DEFAULT NULL            COMMENT '巡园路线（→ sf_patrol_route.id）',
  `patrol_user`  VARCHAR(100)  DEFAULT NULL            COMMENT '巡查人员',
  `patrol_time`  DATETIME      DEFAULT NULL            COMMENT '巡查时间',
  `frequency`    VARCHAR(20)   DEFAULT NULL            COMMENT '频次',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态',
  `problem`      VARCHAR(200)  DEFAULT NULL            COMMENT '发现问题',
  `remark`       VARCHAR(500)  DEFAULT NULL            COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_patrol_plan_code` (`plan_code`),
  KEY `idx_patrol_plan_base` (`base_id`),
  KEY `idx_patrol_plan_route` (`route_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='巡园计划';

-- 巡园路线（farming_patrol.html 路线配置）

DROP TABLE IF EXISTS `sf_patrol_route`;
CREATE TABLE `sf_patrol_route` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `route_code`   VARCHAR(50)   NOT NULL                COMMENT '路线编号（唯一）',
  `route_name`   VARCHAR(100)  NOT NULL                COMMENT '路线名称',
  `base_id`      BIGINT        DEFAULT NULL            COMMENT '覆盖基地（→ sf_base.id）',
  `coverage`     VARCHAR(500)  DEFAULT NULL            COMMENT '覆盖区域',
  `point_count`  INT           DEFAULT NULL            COMMENT '点位数',
  `frequency`    VARCHAR(20)   DEFAULT NULL            COMMENT '频次',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态',
  `remark`       VARCHAR(500)  DEFAULT NULL            COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_patrol_route_code` (`route_code`),
  KEY `idx_patrol_route_base` (`base_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='巡园路线';

-- 巡园异常上报（farming_patrol.html 异常Tab）

DROP TABLE IF EXISTS `sf_patrol_abnormal`;
CREATE TABLE `sf_patrol_abnormal` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `abnormal_code` VARCHAR(50)  NOT NULL                COMMENT '异常编号（唯一）',
  `base_id`      BIGINT        DEFAULT NULL            COMMENT '所属基地（→ sf_base.id）',
  `plot_id`      BIGINT        DEFAULT NULL            COMMENT '巡查地块（→ sf_plot.id）',
  `route_id`     BIGINT        DEFAULT NULL            COMMENT '关联巡园路线（→ sf_patrol_route.id）',
  `abnormal_type` VARCHAR(20)  DEFAULT NULL            COMMENT '异常类型（枚举→字典）',
  `abnormal_desc` VARCHAR(500) DEFAULT NULL            COMMENT '异常说明',
  `reporter`     VARCHAR(100)  DEFAULT NULL            COMMENT '上报人',
  `report_time`  DATETIME      DEFAULT NULL            COMMENT '上报时间',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态：pending/processing/done',
  `remark`       VARCHAR(500)  DEFAULT NULL            COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_patrol_abnormal_code` (`abnormal_code`),
  KEY `idx_patrol_abnormal_base` (`base_id`),
  KEY `idx_patrol_abnormal_plot` (`plot_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='巡园异常上报';

-- 无人机巡检（drone_patrol.html）

DROP TABLE IF EXISTS `sf_drone_patrol`;
CREATE TABLE `sf_drone_patrol` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `task_code`    VARCHAR(50)   NOT NULL                COMMENT '任务编号（唯一）',
  `sortie`       VARCHAR(50)   DEFAULT NULL            COMMENT '架次',
  `base_id`      BIGINT        DEFAULT NULL            COMMENT '所属基地（→ sf_base.id）',
  `drone`        VARCHAR(100)  DEFAULT NULL            COMMENT '无人机',
  `plot_ids`     VARCHAR(500)  DEFAULT NULL            COMMENT '巡查地块',
  `flight_area`  DECIMAL(12,2) DEFAULT NULL            COMMENT '飞行面积（亩）',
  `progress`     DECIMAL(5,2)  DEFAULT NULL            COMMENT '进度（0-100）',
  `rtk`          VARCHAR(50)   DEFAULT NULL            COMMENT 'RTK',
  `flight_height` VARCHAR(50)  DEFAULT NULL            COMMENT '航高',
  `speed`        VARCHAR(50)   DEFAULT NULL            COMMENT '速度',
  `route`        VARCHAR(500)  DEFAULT NULL            COMMENT '航线',
  `plan_time`    DATETIME      DEFAULT NULL            COMMENT '计划时间',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态',
  `remark`       VARCHAR(500)  DEFAULT NULL            COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_drone_patrol_code` (`task_code`),
  KEY `idx_drone_patrol_base` (`base_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='无人机巡检';

-- 农事标准（guide_standard.html）

DROP TABLE IF EXISTS `sf_guide_standard`;
CREATE TABLE `sf_guide_standard` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `standard_code` VARCHAR(50)  NOT NULL                COMMENT '标准编号（唯一）',
  `standard_name` VARCHAR(100) NOT NULL                COMMENT '标准名称',
  `farm_type`    VARCHAR(20)   DEFAULT NULL            COMMENT '农事类型（枚举→字典）',
  `level`        VARCHAR(20)   DEFAULT NULL            COMMENT '级别（枚举→字典）',
  `variety`      VARCHAR(100)  DEFAULT NULL            COMMENT '适用品种',
  `key_process`  VARCHAR(500)  DEFAULT NULL            COMMENT '关键工序',
  `dosage`       VARCHAR(200)  DEFAULT NULL            COMMENT '用量',
  `accept_index` VARCHAR(200)  DEFAULT NULL            COMMENT '验收指标',
  `effective_date` DATE        DEFAULT NULL            COMMENT '生效日期',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态：active/inactive',
  `referenced`   INT           DEFAULT 0               COMMENT '被引用次数',
  `remark`       VARCHAR(500)  DEFAULT NULL            COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_guide_standard_code` (`standard_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农事标准';

-- 采收管理模块（harvest_plan / harvest_record / harvest_report /
--              harvest_process / harvest_post / harvest_storage）

-- 采收计划（harvest_plan.html）

-- ============================================================
-- 【采收管理（采收计划 / 记录 / 采后 / 发货 / 储藏）】
-- ============================================================
DROP TABLE IF EXISTS `sf_harvest_plan`;
CREATE TABLE `sf_harvest_plan` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `plan_code`    VARCHAR(50)   NOT NULL                COMMENT '计划编号（唯一）',
  `batch_no`     VARCHAR(50)   DEFAULT NULL            COMMENT '批次号',
  `plan_name`    VARCHAR(100)  NOT NULL                COMMENT '计划名称',
  `base_id`      BIGINT        DEFAULT NULL            COMMENT '基地（→ sf_base.id）',
  `estimate_amount` DECIMAL(12,2) DEFAULT NULL         COMMENT '预计采收量(kg)',
  `actual_amount` DECIMAL(12,2) DEFAULT NULL           COMMENT '实采量(kg)',
  `manager_id`   BIGINT        DEFAULT NULL            COMMENT '负责人（→ sf_user.id）',
  `start_time`   DATETIME      DEFAULT NULL            COMMENT '计划开始时间',
  `end_time`     DATETIME      DEFAULT NULL            COMMENT '计划结束时间',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态：pending/in_progress/done',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_harvest_plan_code` (`plan_code`),
  KEY `idx_harvest_plan_base` (`base_id`),
  KEY `idx_harvest_plan_batch` (`batch_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采收计划';

-- 采收记录（harvest_record.html）

DROP TABLE IF EXISTS `sf_harvest_record`;
CREATE TABLE `sf_harvest_record` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `record_code`  VARCHAR(50)   NOT NULL                COMMENT '记录编号（唯一）',
  `plan_id`      BIGINT        DEFAULT NULL            COMMENT '关联计划（→ sf_harvest_plan.id）',
  `batch_no`     VARCHAR(50)   DEFAULT NULL            COMMENT '批次号',
  `base_id`      BIGINT        DEFAULT NULL            COMMENT '所属基地（→ sf_base.id）',
  `plot_id`      BIGINT        DEFAULT NULL            COMMENT '地块（→ sf_plot.id）',
  `variety`      VARCHAR(100)  DEFAULT NULL            COMMENT '品种（枚举→字典）',
  `amount`       DECIMAL(12,2) DEFAULT NULL            COMMENT '采收量(kg)',
  `grade`        VARCHAR(20)   DEFAULT NULL            COMMENT '等级（枚举→字典：一级/二级/三级）',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态：pending/processing/done',
  `harvest_date` DATE          DEFAULT NULL            COMMENT '采收日期',
  `harvest_user` VARCHAR(100)  DEFAULT NULL            COMMENT '采收人员',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_harvest_record_code` (`record_code`),
  KEY `idx_harvest_record_plan` (`plan_id`),
  KEY `idx_harvest_record_batch` (`batch_no`),
  KEY `idx_harvest_record_base` (`base_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采收记录';

-- 采后处理（harvest_process.html）

DROP TABLE IF EXISTS `sf_harvest_process`;
CREATE TABLE `sf_harvest_process` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `process_code` VARCHAR(50)   NOT NULL                COMMENT '批次编号（唯一）',
  `batch_no`     VARCHAR(50)   DEFAULT NULL            COMMENT '关联批次',
  `plot_id`      BIGINT        DEFAULT NULL            COMMENT '地块（→ sf_plot.id）',
  `grade`        VARCHAR(20)   DEFAULT NULL            COMMENT '等级（枚举→字典）',
  `amount`       DECIMAL(12,2) DEFAULT NULL            COMMENT '数量(kg)',
  `process_type` VARCHAR(20)   DEFAULT NULL            COMMENT '处理类型（枚举→字典：分级/包装/清洗/冷藏）',
  `result`       VARCHAR(20)   DEFAULT NULL            COMMENT '处理结果（枚举→字典：合格/返工/报废）',
  `location`     VARCHAR(50)   DEFAULT NULL            COMMENT '库位',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'grading' COMMENT '状态：grading/packing/stored/shipped/abnormal',
  `operator`     VARCHAR(100)  DEFAULT NULL            COMMENT '操作人',
  `operate_time` DATETIME      DEFAULT NULL            COMMENT '操作时间',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_harvest_process_code` (`process_code`),
  KEY `idx_harvest_process_batch` (`batch_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采后处理';

-- 采收发货（harvest_post.html）

DROP TABLE IF EXISTS `sf_harvest_post`;
CREATE TABLE `sf_harvest_post` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `post_code`    VARCHAR(50)   NOT NULL                COMMENT '发货单号（唯一）',
  `source_batch` VARCHAR(50)   DEFAULT NULL            COMMENT '来源批次',
  `batch_no`     VARCHAR(50)   DEFAULT NULL            COMMENT '关联批次',
  `customer`     VARCHAR(100)  DEFAULT NULL            COMMENT '客户/收货方',
  `address`      VARCHAR(255)  DEFAULT NULL            COMMENT '收货地址',
  `amount`       DECIMAL(12,2) DEFAULT NULL            COMMENT '发货数量(kg)',
  `logistics_no` VARCHAR(100)  DEFAULT NULL            COMMENT '物流单号',
  `logistics_co` VARCHAR(50)   DEFAULT NULL            COMMENT '物流公司（枚举→字典）',
  `post_date`    DATE          DEFAULT NULL            COMMENT '发货日期',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态：pending/shipped/transit/received/abnormal',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_harvest_post_code` (`post_code`),
  KEY `idx_harvest_post_batch` (`batch_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采收发货';

-- 储藏管理（harvest_storage.html）

DROP TABLE IF EXISTS `sf_storage_location`;
CREATE TABLE `sf_storage_location` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `location_code` VARCHAR(50)  NOT NULL                COMMENT '库位编号（唯一）',
  `base_id`      BIGINT        DEFAULT NULL            COMMENT '所属基地（→ sf_base.id）',
  `batch_no`     VARCHAR(50)   DEFAULT NULL            COMMENT '当前批次',
  `stock_amount` DECIMAL(12,2) DEFAULT NULL            COMMENT '在库数量(kg)',
  `temperature`  DECIMAL(6,2)  DEFAULT NULL            COMMENT '温度(℃)',
  `humidity`     DECIMAL(6,2)  DEFAULT NULL            COMMENT '湿度(%)',
  `in_time`      DATETIME      DEFAULT NULL            COMMENT '入库时间',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'normal' COMMENT '状态：normal/temp_alert/shipped',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_storage_location_code` (`location_code`),
  KEY `idx_storage_location_base` (`base_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='储藏库位';

-- 储藏温湿度记录（harvest_storage.html 详情）

DROP TABLE IF EXISTS `sf_storage_env_record`;
CREATE TABLE `sf_storage_env_record` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `location_id`  BIGINT        NOT NULL                COMMENT '库位（→ sf_storage_location.id）',
  `collect_time` DATETIME      DEFAULT NULL            COMMENT '采集时间',
  `temperature`  DECIMAL(6,2)  DEFAULT NULL            COMMENT '温度(℃)',
  `humidity`     DECIMAL(6,2)  DEFAULT NULL            COMMENT '湿度(%)',
  `judge`        VARCHAR(20)   DEFAULT NULL            COMMENT '判定（正常/异常）',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_storage_env_location` (`location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='储藏温湿度记录';

-- 物资管理模块（material_supplier / material_info / material_io /
--              material_inventory / material_usage / material_return /
--              material_config）

-- 农资供应商（material_supplier.html）

-- ============================================================
-- 【物资管理（供应商 / 档案 / 出入库 / 库存 / 领用 / 退库）】
-- ============================================================
DROP TABLE IF EXISTS `sf_material_supplier`;
CREATE TABLE `sf_material_supplier` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `supplier_code` VARCHAR(50)  NOT NULL                COMMENT '供应商编号（唯一）',
  `supplier_name` VARCHAR(100) NOT NULL                COMMENT '供应商名称',
  `contact`      VARCHAR(50)   DEFAULT NULL            COMMENT '联系人',
  `phone`        VARCHAR(20)   DEFAULT NULL            COMMENT '电话',
  `credit_code`  VARCHAR(50)   DEFAULT NULL            COMMENT '统一社会信用代码',
  `supply_type`  VARCHAR(50)   DEFAULT NULL            COMMENT '供应类型（枚举→字典：肥料/农药/工具/种子/其他）',
  `rating`       VARCHAR(20)   DEFAULT NULL            COMMENT '评级',
  `settle_way`   VARCHAR(50)   DEFAULT NULL            COMMENT '结算方式(账期)',
  `qualification_status` VARCHAR(20) DEFAULT NULL      COMMENT '资质状态',
  `coop_status`  VARCHAR(20)   NOT NULL DEFAULT 'cooperating' COMMENT '合作状态：cooperating/pending/terminated',
  `remark`       VARCHAR(500)  DEFAULT NULL            COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_material_supplier_code` (`supplier_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农资供应商';

-- 农资档案（material_info.html）

DROP TABLE IF EXISTS `sf_material_info`;
CREATE TABLE `sf_material_info` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `material_code` VARCHAR(50)  NOT NULL                COMMENT '农资编号（唯一）',
  `material_name` VARCHAR(100) NOT NULL                COMMENT '农资名称',
  `material_type` VARCHAR(20)  DEFAULT NULL            COMMENT '类型（枚举→字典：肥料/农药/工具）',
  `spec`         VARCHAR(100)  DEFAULT NULL            COMMENT '规格型号',
  `unit`         VARCHAR(20)   DEFAULT NULL            COMMENT '单位',
  `price`        DECIMAL(12,2) DEFAULT NULL            COMMENT '单价(元)',
  `safety_stock` DECIMAL(12,2) DEFAULT NULL            COMMENT '安全库存',
  `current_stock` DECIMAL(12,2) DEFAULT NULL           COMMENT '当前库存',
  `supplier_id`  BIGINT        DEFAULT NULL            COMMENT '供应商（→ sf_material_supplier.id）',
  `purpose`      VARCHAR(200)  DEFAULT NULL            COMMENT '用途',
  `safety_interval` VARCHAR(50) DEFAULT NULL           COMMENT '安全间隔期',
  `file_status`  VARCHAR(20)   DEFAULT NULL            COMMENT '档案状态',
  `cert_status`  VARCHAR(20)   DEFAULT NULL            COMMENT '证照状态',
  `stock_status` VARCHAR(20)   DEFAULT NULL            COMMENT '库存状态（正常/库存不足/库存充足）',
  `remark`       VARCHAR(500)  DEFAULT NULL            COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_material_info_code` (`material_code`),
  KEY `idx_material_info_supplier` (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农资档案';

-- 农资出入库（material_io.html）

DROP TABLE IF EXISTS `sf_material_io`;
CREATE TABLE `sf_material_io` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `io_code`      VARCHAR(50)   NOT NULL                COMMENT '单号（唯一，IO-YYYYMMDD###）',
  `warehouse_id` BIGINT        DEFAULT NULL            COMMENT '仓库（→ sf_material_warehouse.id）',
  `io_type`      VARCHAR(20)   NOT NULL                COMMENT '类型（枚举→字典：入库/出库）',
  `material_id`  BIGINT        DEFAULT NULL            COMMENT '农资（→ sf_material_info.id）',
  `batch_no`     VARCHAR(50)   DEFAULT NULL            COMMENT '批次号',
  `quantity`     DECIMAL(12,2) DEFAULT NULL            COMMENT '数量',
  `price`        DECIMAL(12,2) DEFAULT NULL            COMMENT '单价(元)',
  `amount`       DECIMAL(12,2) DEFAULT NULL            COMMENT '金额(元)',
  `handler`      VARCHAR(100)  DEFAULT NULL            COMMENT '经手人',
  `supplier_id`  BIGINT        DEFAULT NULL            COMMENT '供应商（→ sf_material_supplier.id）',
  `source_code`  VARCHAR(50)   DEFAULT NULL            COMMENT '来源单号',
  `related_target` VARCHAR(200) DEFAULT NULL           COMMENT '关联地块/任务',
  `pay_status`   VARCHAR(20)   DEFAULT NULL            COMMENT '付款状态',
  `audit_status` VARCHAR(20)   DEFAULT NULL            COMMENT '审核状态',
  `auditor`      VARCHAR(100)  DEFAULT NULL            COMMENT '审核人',
  `expire_date`  DATE          DEFAULT NULL            COMMENT '有效期至',
  `io_date`      DATE          DEFAULT NULL            COMMENT '日期',
  `remark`       VARCHAR(500)  DEFAULT NULL            COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_material_io_code` (`io_code`),
  KEY `idx_material_io_material` (`material_id`),
  KEY `idx_material_io_warehouse` (`warehouse_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农资出入库';

-- 农资库存（material_inventory.html）

DROP TABLE IF EXISTS `sf_material_inventory`;
CREATE TABLE `sf_material_inventory` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `warehouse_id` BIGINT        DEFAULT NULL            COMMENT '仓库（→ sf_material_warehouse.id）',
  `material_id`  BIGINT        DEFAULT NULL            COMMENT '农资（→ sf_material_info.id）',
  `batch_no`     VARCHAR(50)   DEFAULT NULL            COMMENT '批次号',
  `location`     VARCHAR(50)   DEFAULT NULL            COMMENT '货位',
  `stock_amount` DECIMAL(12,2) DEFAULT NULL            COMMENT '库存数量',
  `available_amount` DECIMAL(12,2) DEFAULT NULL        COMMENT '可用库存',
  `locked_amount` DECIMAL(12,2) DEFAULT NULL           COMMENT '锁定',
  `book_amount`  DECIMAL(12,2) DEFAULT NULL            COMMENT '账面数量',
  `min_stock`    DECIMAL(12,2) DEFAULT NULL            COMMENT '安全库存（最低库存）',
  `stock_value`  DECIMAL(12,2) DEFAULT NULL            COMMENT '库存金额(元)',
  `avg_daily_use` DECIMAL(12,2) DEFAULT NULL           COMMENT '日均消耗',
  `cover_days`   DECIMAL(10,2) DEFAULT NULL            COMMENT '可覆盖天数',
  `produce_date` DATE          DEFAULT NULL            COMMENT '生产日期',
  `expire_date`  DATE          DEFAULT NULL            COMMENT '有效期至',
  `last_in_time` DATETIME      DEFAULT NULL            COMMENT '最近入库时间',
  `last_out_time` DATETIME      DEFAULT NULL            COMMENT '最近出库时间',
  `stock_status` VARCHAR(20)   DEFAULT NULL            COMMENT '库存状态（正常/库存不足/库存充足）',
  `suggest_amount` DECIMAL(12,2) DEFAULT NULL          COMMENT '建议补货量',
  `suggest_date` DATE          DEFAULT NULL            COMMENT '建议采购日期',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_material_inventory_material` (`material_id`),
  KEY `idx_material_inventory_warehouse` (`warehouse_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农资库存';

-- 农资领用（material_usage.html）

DROP TABLE IF EXISTS `sf_material_usage`;
CREATE TABLE `sf_material_usage` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `material_id`  BIGINT        DEFAULT NULL            COMMENT '农资（→ sf_material_info.id）',
  `batch_no`     VARCHAR(50)   DEFAULT NULL            COMMENT '批次号',
  `quantity`     DECIMAL(12,2) DEFAULT NULL            COMMENT '使用数量',
  `use_time`     DATETIME      DEFAULT NULL            COMMENT '使用时间',
  `use_user`     VARCHAR(100)  DEFAULT NULL            COMMENT '使用人员',
  `task_id`      BIGINT        DEFAULT NULL            COMMENT '关联任务（→ sf_farming_task.id）',
  `plot_ids`     VARCHAR(500)  DEFAULT NULL            COMMENT '关联地块/使用地块',
  `apply_user`   VARCHAR(100)  DEFAULT NULL            COMMENT '申领人',
  `apply_time`   DATETIME      DEFAULT NULL            COMMENT '申领时间',
  `apply_way`    VARCHAR(50)   DEFAULT NULL            COMMENT '施药方式',
  `cost_amount`  DECIMAL(12,2) DEFAULT NULL            COMMENT '成本金额(元)',
  `safety_harvest` VARCHAR(100) DEFAULT NULL           COMMENT '安全采收',
  `audit_status` VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '审核状态：pending/approved/rejected',
  `status`       VARCHAR(20)   DEFAULT NULL            COMMENT '状态',
  `remark`       VARCHAR(500)  DEFAULT NULL            COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_material_usage_material` (`material_id`),
  KEY `idx_material_usage_task` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农资领用与使用';

-- 农资退库（material_return.html）

DROP TABLE IF EXISTS `sf_material_return`;
CREATE TABLE `sf_material_return` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `return_code`  VARCHAR(50)   NOT NULL                COMMENT '退库单号（唯一）',
  `warehouse_id` BIGINT        DEFAULT NULL            COMMENT '仓库（→ sf_material_warehouse.id）',
  `return_type`  VARCHAR(20)   DEFAULT NULL            COMMENT '退库类型（枚举→字典：质量问题/批次过期/运输损坏/包装破损/其他）',
  `material_id`  BIGINT        DEFAULT NULL            COMMENT '农资（→ sf_material_info.id）',
  `batch_no`     VARCHAR(50)   DEFAULT NULL            COMMENT '批次号',
  `quantity`     DECIMAL(12,2) DEFAULT NULL            COMMENT '数量',
  `price`        DECIMAL(12,2) DEFAULT NULL            COMMENT '单价(元)',
  `amount`       DECIMAL(12,2) DEFAULT NULL            COMMENT '金额(元)',
  `reason`       VARCHAR(500)  DEFAULT NULL            COMMENT '原因类型/说明',
  `handler`      VARCHAR(100)  DEFAULT NULL            COMMENT '经手人',
  `supplier_id`  BIGINT        DEFAULT NULL            COMMENT '供应商（→ sf_material_supplier.id）',
  `related_code` VARCHAR(50)   DEFAULT NULL            COMMENT '关联单号',
  `auditor`      VARCHAR(100)  DEFAULT NULL            COMMENT '审核人',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态：pending/audited/refunded/done',
  `return_date`  DATE          DEFAULT NULL            COMMENT '日期',
  `remark`       VARCHAR(500)  DEFAULT NULL            COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_material_return_code` (`return_code`),
  KEY `idx_material_return_material` (`material_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农资退库';

-- 农资仓库（material_config.html 仓库Tab）

DROP TABLE IF EXISTS `sf_material_warehouse`;
CREATE TABLE `sf_material_warehouse` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `warehouse_code` VARCHAR(50) NOT NULL                COMMENT '仓库编号（唯一）',
  `warehouse_name` VARCHAR(100) NOT NULL               COMMENT '仓库名称（唯一）',
  `warehouse_type` VARCHAR(20) DEFAULT NULL            COMMENT '仓库类型',
  `manager`      VARCHAR(100)  DEFAULT NULL            COMMENT '负责人',
  `manager_phone` VARCHAR(20)  DEFAULT NULL            COMMENT '负责人电话',
  `capacity`     DECIMAL(12,2) DEFAULT NULL            COMMENT '容量',
  `address`      VARCHAR(255)  DEFAULT NULL            COMMENT '地址',
  `is_default`   TINYINT       NOT NULL DEFAULT 0      COMMENT '默认仓（0/1）',
  `is_danger`    TINYINT       NOT NULL DEFAULT 0      COMMENT '危险品专库（0/1）',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态',
  `remark`       VARCHAR(500)  DEFAULT NULL            COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_material_warehouse_code` (`warehouse_code`),
  UNIQUE KEY `uk_material_warehouse_name` (`warehouse_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农资仓库';

-- 农资分类（material_config.html 分类Tab）

DROP TABLE IF EXISTS `sf_material_category`;
CREATE TABLE `sf_material_category` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `category_code` VARCHAR(50)  NOT NULL                COMMENT '分类编码（唯一）',
  `category_name` VARCHAR(100) NOT NULL                COMMENT '分类名称（唯一）',
  `parent_id`    BIGINT        DEFAULT NULL            COMMENT '上级分类（→ 自关联）',
  `default_unit` VARCHAR(20)   DEFAULT NULL            COMMENT '默认单位',
  `default_warehouse_id` BIGINT DEFAULT NULL           COMMENT '默认仓库（→ sf_material_warehouse.id）',
  `default_location` VARCHAR(50) DEFAULT NULL          COMMENT '默认货位',
  `is_danger`    TINYINT       NOT NULL DEFAULT 0      COMMENT '危险品（0/1）',
  `safety_interval` VARCHAR(50) DEFAULT NULL           COMMENT '安全间隔期',
  `qualification` VARCHAR(200) DEFAULT NULL            COMMENT '资质要求',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_material_category_code` (`category_code`),
  UNIQUE KEY `uk_material_category_name` (`category_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农资分类';

-- 溯源管理模块（trace_batch / trace_code / trace_query /
--              trace_config / trace_blockchain / material_label）

-- 溯源批次（trace_batch.html）

-- ============================================================
-- 【溯源管理（批次 / 编码 / 区块链 / 模板 / 标签）】
-- ============================================================
DROP TABLE IF EXISTS `sf_trace_batch`;
CREATE TABLE `sf_trace_batch` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `batch_no`     VARCHAR(50)   NOT NULL                COMMENT '批次号（唯一）',
  `product_name` VARCHAR(100)  DEFAULT NULL            COMMENT '产品名称',
  `spec`         VARCHAR(100)  DEFAULT NULL            COMMENT '规格',
  `base_id`      BIGINT        DEFAULT NULL            COMMENT '所属基地（→ sf_base.id）',
  `plot_id`      BIGINT        DEFAULT NULL            COMMENT '地块（→ sf_plot.id）',
  `harvest_plan_id` BIGINT     DEFAULT NULL            COMMENT '采收计划（→ sf_harvest_plan.id）',
  `harvest_date` DATE          DEFAULT NULL            COMMENT '采收日期',
  `grade`        VARCHAR(20)   DEFAULT NULL            COMMENT '等级（枚举→字典：特级/一级/二级）',
  `harvest_amount` DECIMAL(12,2) DEFAULT NULL          COMMENT '采收数量(kg)',
  `process_code` VARCHAR(50)   DEFAULT NULL            COMMENT '采后处理单号',
  `trace_code`   VARCHAR(100)  DEFAULT NULL            COMMENT '追溯码',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态：pending/packed/stored/shipped',
  `remark`       VARCHAR(500)  DEFAULT NULL            COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_trace_batch_no` (`batch_no`),
  KEY `idx_trace_batch_base` (`base_id`),
  KEY `idx_trace_batch_plot` (`plot_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='溯源批次';

-- 溯源编码（trace_code.html）

DROP TABLE IF EXISTS `sf_trace_code`;
CREATE TABLE `sf_trace_code` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `trace_code`   VARCHAR(100)  NOT NULL                COMMENT '追溯码（唯一）',
  `batch_no`     VARCHAR(50)   DEFAULT NULL            COMMENT '批次号（→ sf_trace_batch.batch_no）',
  `product_name` VARCHAR(100)  DEFAULT NULL            COMMENT '产品名称',
  `spec`         VARCHAR(100)  DEFAULT NULL            COMMENT '规格',
  `origin`       VARCHAR(200)  DEFAULT NULL            COMMENT '产地（基地/地块）',
  `encode_type`  VARCHAR(20)   DEFAULT NULL            COMMENT '编码规则（GS1/二维码/RFID）',
  `generate_count` INT         DEFAULT NULL            COMMENT '生成数量',
  `order_id`     BIGINT        DEFAULT NULL            COMMENT '关联订单',
  `template_id`  BIGINT        DEFAULT NULL            COMMENT '展示模板（→ sf_trace_template.id）',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'inactive' COMMENT '状态：inactive/active/expired',
  `generate_time` DATETIME     DEFAULT NULL            COMMENT '生成时间',
  `remark`       VARCHAR(500)  DEFAULT NULL            COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_trace_code` (`trace_code`),
  KEY `idx_trace_code_batch` (`batch_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='溯源编码';

-- 区块链存证（trace_blockchain.html）

DROP TABLE IF EXISTS `sf_trace_blockchain`;
CREATE TABLE `sf_trace_blockchain` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `trace_code`   VARCHAR(100)  DEFAULT NULL            COMMENT '溯源码',
  `event`        VARCHAR(200)  DEFAULT NULL            COMMENT '事件',
  `tx_hash`      VARCHAR(200)  DEFAULT NULL            COMMENT '交易哈希',
  `block_height` VARCHAR(50)   DEFAULT NULL            COMMENT '区块高度',
  `chain_time`   DATETIME      DEFAULT NULL            COMMENT '上链时间',
  `verify_status` VARCHAR(20)  DEFAULT NULL            COMMENT '验证状态（通过/未通过/验证中）',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_trace_blockchain_code` (`trace_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='区块链存证';

-- 溯源查询记录（trace_query.html 查询次数统计）

DROP TABLE IF EXISTS `sf_trace_query_log`;
CREATE TABLE `sf_trace_query_log` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `trace_code`   VARCHAR(100)  DEFAULT NULL            COMMENT '溯源码',
  `query_time`   DATETIME      DEFAULT NULL            COMMENT '查询时间',
  `channel`      VARCHAR(50)   DEFAULT NULL            COMMENT '渠道',
  `region`       VARCHAR(100)  DEFAULT NULL            COMMENT '地区',
  `ip`           VARCHAR(50)   DEFAULT NULL            COMMENT 'IP',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_trace_query_code` (`trace_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='溯源查询记录';

-- 溯源模板（trace_config.html 模板Tab）

DROP TABLE IF EXISTS `sf_trace_template`;
CREATE TABLE `sf_trace_template` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `template_name` VARCHAR(100) NOT NULL                COMMENT '模板名称',
  `applicable_product` VARCHAR(200) DEFAULT NULL       COMMENT '适用产品',
  `show_modules` VARCHAR(500)  DEFAULT NULL            COMMENT '展示模块（多选）',
  `bound_batch`  VARCHAR(200)  DEFAULT NULL            COMMENT '绑定批次',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'inactive' COMMENT '启用状态',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='溯源模板';

-- 溯源展示环节（trace_config.html C端环节Tab）

DROP TABLE IF EXISTS `sf_trace_stage`;
CREATE TABLE `sf_trace_stage` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `stage_code`   VARCHAR(50)   NOT NULL                COMMENT '环节编码（唯一，planting/pruning/bagging/fertilizer/testing/harvest/coldchain）',
  `stage_name`   VARCHAR(100)  DEFAULT NULL            COMMENT '环节名称',
  `stage_icon`   VARCHAR(100)  DEFAULT NULL            COMMENT '环节图标',
  `stage_desc`   VARCHAR(500)  DEFAULT NULL            COMMENT '环节说明',
  `sort_order`   INT           DEFAULT 0               COMMENT '排序',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态（启停）',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0               COMMENT '逻辑删除：0=正常 1=已删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_trace_stage_code` (`stage_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='溯源展示环节';

-- 标签类型（material_label.html 标签类型Tab）

DROP TABLE IF EXISTS `sf_label_type`;
CREATE TABLE `sf_label_type` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `label_code`   VARCHAR(50)   NOT NULL                COMMENT '标签编码（唯一）',
  `label_name`   VARCHAR(100)  NOT NULL                COMMENT '标签名称',
  `label_type`   VARCHAR(50)   DEFAULT NULL            COMMENT '标签类型',
  `template_name` VARCHAR(100) DEFAULT NULL            COMMENT '模板名称',
  `template_version` VARCHAR(20) DEFAULT NULL          COMMENT '模板版本',
  `spec`         VARCHAR(100)  DEFAULT NULL            COMMENT '规格',
  `layout`       VARCHAR(50)   DEFAULT NULL            COMMENT '版式',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_label_type_code` (`label_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='标签类型';

-- 标签库存（material_label.html 库存Tab）

DROP TABLE IF EXISTS `sf_label_stock`;
CREATE TABLE `sf_label_stock` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `label_type_id` BIGINT       DEFAULT NULL            COMMENT '标签类型（→ sf_label_type.id）',
  `quantity`     INT           DEFAULT NULL            COMMENT '数量',
  `batch_no`     VARCHAR(50)   DEFAULT NULL            COMMENT '溯源批次号',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_label_stock_type` (`label_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='标签库存';

-- 标签领用记录（material_label.html 领用审批Tab）

DROP TABLE IF EXISTS `sf_label_record`;
CREATE TABLE `sf_label_record` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `apply_code`   VARCHAR(50)   DEFAULT NULL            COMMENT '领用单号',
  `label_type_id` BIGINT       DEFAULT NULL            COMMENT '标签类型（→ sf_label_type.id）',
  `quantity`     INT           DEFAULT NULL            COMMENT '数量',
  `plot_ids`     VARCHAR(500)  DEFAULT NULL            COMMENT '使用地块',
  `apply_user`   VARCHAR(100)  DEFAULT NULL            COMMENT '申请人',
  `apply_time`   DATETIME      DEFAULT NULL            COMMENT '领用时间',
  `print_user`   VARCHAR(100)  DEFAULT NULL            COMMENT '打印人',
  `batch_no`     VARCHAR(50)   DEFAULT NULL            COMMENT '溯源批次',
  `task_no`      VARCHAR(50)   DEFAULT NULL            COMMENT '任务号',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态：pending/printed/rejected',
  `remark`       VARCHAR(500)  DEFAULT NULL            COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_label_record_type` (`label_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='标签领用记录';

-- 认养管理模块（adoption_tree / adoption_farming / adoption_harvest /
--              adoption_order / adoption_photo / adoption_cert /
--              adoption_browse）

-- 认养果树（adoption_tree.html / adoption_browse.html 果树池）

-- ============================================================
-- 【认养管理（认养果树 / 订单 / 农事 / 采收 / 相册 / 证书）】
-- ============================================================
DROP TABLE IF EXISTS `sf_adoption_tree`;
CREATE TABLE `sf_adoption_tree` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `tree_code`    VARCHAR(50)   NOT NULL                COMMENT '果树编号（唯一）',
  `tree_name`    VARCHAR(100)  DEFAULT NULL            COMMENT '果树名称',
  `variety`      VARCHAR(50)   DEFAULT NULL            COMMENT '品种（枚举→字典：huaniu/gala/qinguang/xinredstar/jonagold）',
  `base_id`      BIGINT        DEFAULT NULL            COMMENT '所属基地（→ sf_base.id）',
  `tree_age`     INT           DEFAULT NULL            COMMENT '树龄',
  `year_fee`     DECIMAL(12,2) DEFAULT NULL            COMMENT '年费',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'available' COMMENT '认养状态：available/adopted/unavailable',
  `adopter`      VARCHAR(100)  DEFAULT NULL            COMMENT '认养人',
  `tag_code`     VARCHAR(50)   DEFAULT NULL            COMMENT '挂牌编号',
  `camera_id`    BIGINT        DEFAULT NULL            COMMENT '关联摄像头',
  `open_scene`   TINYINT       NOT NULL DEFAULT 0      COMMENT '开放实景（0/1）',
  `expire_time`  DATE          DEFAULT NULL            COMMENT '到期时间',
  `archive_reason` VARCHAR(200) DEFAULT NULL           COMMENT '归档原因',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_adoption_tree_code` (`tree_code`),
  KEY `idx_adoption_tree_base` (`base_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='认养果树';

-- 认养订单（adoption_order.html）

DROP TABLE IF EXISTS `sf_adoption_order`;
CREATE TABLE `sf_adoption_order` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_code`   VARCHAR(50)   NOT NULL                COMMENT '订单编号（唯一）',
  `adopter`      VARCHAR(100)  DEFAULT NULL            COMMENT '认养人',
  `tree_id`      BIGINT        DEFAULT NULL            COMMENT '认养果树（→ sf_adoption_tree.id）',
  `base_id`      BIGINT        DEFAULT NULL            COMMENT '所属基地（→ sf_base.id）',
  `amount`       DECIMAL(12,2) DEFAULT NULL            COMMENT '认养金额',
  `term`         VARCHAR(20)   DEFAULT NULL            COMMENT '认养期限（枚举→字典：1年/2年/3年/5年）',
  `renew_flag`   TINYINT       NOT NULL DEFAULT 0      COMMENT '续费标记（0/1）',
  `renew_count`  INT           DEFAULT 0               COMMENT '续费次数',
  `contract_code` VARCHAR(50)  DEFAULT NULL            COMMENT '合同编号',
  `contract_status` VARCHAR(20) DEFAULT NULL           COMMENT '合同状态',
  `order_status` VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '订单状态：paid/pending/done/refunded/cancelled',
  `refund_reason` VARCHAR(200) DEFAULT NULL            COMMENT '退款原因',
  `order_time`   DATETIME      DEFAULT NULL            COMMENT '下单时间',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_adoption_order_code` (`order_code`),
  KEY `idx_adoption_order_tree` (`tree_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='认养订单';

-- 认养农事记录（adoption_farming.html）

DROP TABLE IF EXISTS `sf_adoption_farming`;
CREATE TABLE `sf_adoption_farming` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `record_code`  VARCHAR(50)   NOT NULL                COMMENT '记录编号（唯一）',
  `source`       VARCHAR(50)   DEFAULT NULL            COMMENT '来源',
  `tree_id`      BIGINT        DEFAULT NULL            COMMENT '认养果树（→ sf_adoption_tree.id）',
  `adopter`      VARCHAR(100)  DEFAULT NULL            COMMENT '认养人',
  `farm_type`    VARCHAR(20)   DEFAULT NULL            COMMENT '农事类型（枚举→字典：施肥/浇水/修剪/套袋/病虫害防治）',
  `execute_date` DATE          DEFAULT NULL            COMMENT '执行日期',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_adoption_farming_code` (`record_code`),
  KEY `idx_adoption_farming_tree` (`tree_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='认养农事记录';

-- 认养采收记录（adoption_harvest.html）

DROP TABLE IF EXISTS `sf_adoption_harvest`;
CREATE TABLE `sf_adoption_harvest` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `record_code`  VARCHAR(50)   NOT NULL                COMMENT '记录编号（唯一）',
  `tree_id`      BIGINT        DEFAULT NULL            COMMENT '认养果树（→ sf_adoption_tree.id）',
  `adopter`      VARCHAR(100)  DEFAULT NULL            COMMENT '认养人',
  `estimate_amount` DECIMAL(12,2) DEFAULT NULL         COMMENT '预计采收量(斤)',
  `actual_amount` DECIMAL(12,2) DEFAULT NULL           COMMENT '实际采收量(斤)',
  `harvest_date` DATE          DEFAULT NULL            COMMENT '采收日期',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态：pending/done/cancelled',
  `remark`       VARCHAR(500)  DEFAULT NULL            COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_adoption_harvest_code` (`record_code`),
  KEY `idx_adoption_harvest_tree` (`tree_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='认养采收记录';

-- 成长相册（adoption_photo.html）

DROP TABLE IF EXISTS `sf_adoption_photo`;
CREATE TABLE `sf_adoption_photo` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `tree_id`      BIGINT        DEFAULT NULL            COMMENT '认养果树（→ sf_adoption_tree.id）',
  `file_id`      BIGINT        DEFAULT NULL            COMMENT '照片（→ sf_file.id）',
  `stage`        VARCHAR(50)   DEFAULT NULL            COMMENT '成长阶段',
  `shoot_time`   DATETIME      DEFAULT NULL            COMMENT '拍摄时间',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_adoption_photo_tree` (`tree_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成长相册';

-- 认养证书（adoption_cert.html 证书Tab）

DROP TABLE IF EXISTS `sf_adoption_cert`;
CREATE TABLE `sf_adoption_cert` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `cert_code`    VARCHAR(50)   NOT NULL                COMMENT '证书编号（唯一）',
  `tree_id`      BIGINT        DEFAULT NULL            COMMENT '果树（→ sf_adoption_tree.id）',
  `adopter`      VARCHAR(100)  DEFAULT NULL            COMMENT '认养人',
  `term`         VARCHAR(20)   DEFAULT NULL            COMMENT '认养期限',
  `variety`      VARCHAR(50)   DEFAULT NULL            COMMENT '品种',
  `estimate_yield` DECIMAL(12,2) DEFAULT NULL          COMMENT '预估产量',
  `template_id`  BIGINT        DEFAULT NULL            COMMENT '模板（→ sf_adoption_cert_template.id）',
  `issuer`       VARCHAR(100)  DEFAULT NULL            COMMENT '签发人',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态：pending/issued/revoked',
  `revoke_reason` VARCHAR(200) DEFAULT NULL            COMMENT '撤销原因',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_adoption_cert_code` (`cert_code`),
  KEY `idx_adoption_cert_tree` (`tree_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='认养证书';

-- 认养证书模板（adoption_cert.html 模板Tab）

DROP TABLE IF EXISTS `sf_adoption_cert_template`;
CREATE TABLE `sf_adoption_cert_template` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `template_name` VARCHAR(100) NOT NULL                COMMENT '模板名称',
  `issue_org`    VARCHAR(100)  DEFAULT NULL            COMMENT '签发机构',
  `sign_unit`    VARCHAR(100)  DEFAULT NULL            COMMENT '落款单位',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='认养证书模板';

-- 预警管理模块（alert_overview / alert_device / alert_farming /
--              alert_internal_report / alert_settings）

-- 预警记录（alert_device.html / alert_farming.html 统一）

-- ============================================================
-- 【预警管理（预警记录 / 规则 / 内部报告）】
-- ============================================================
DROP TABLE IF EXISTS `sf_alert_record`;
CREATE TABLE `sf_alert_record` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `alert_title`  VARCHAR(200)  NOT NULL                COMMENT '预警标题',
  `source`       VARCHAR(20)   NOT NULL                COMMENT '预警来源：device/manual/model/inventory/system/cert',
  `category`     VARCHAR(20)   DEFAULT NULL            COMMENT '业务分类：设备/病虫害/气象/土壤/生长/环境/产量/库存/品质',
  `alert_type`   VARCHAR(20)   DEFAULT NULL            COMMENT '预警类型（病虫害/气象/土壤/生长/环境/产量/库存）',
  `level`        VARCHAR(20)   NOT NULL DEFAULT 'notice' COMMENT '预警级别：urgent/important/reminder/notice',
  `device_id`    BIGINT        DEFAULT NULL            COMMENT '关联设备（→ sf_device.id）',
  `device_name`  VARCHAR(100)  DEFAULT NULL            COMMENT '设备名称',
  `location`     VARCHAR(200)  DEFAULT NULL            COMMENT '安装位置',
  `plot_ids`     VARCHAR(500)  DEFAULT NULL            COMMENT '涉及地块',
  `threshold`    VARCHAR(200)  DEFAULT NULL            COMMENT '阈值设置',
  `current_value` VARCHAR(100) DEFAULT NULL            COMMENT '当前值',
  `alert_time`   DATETIME      DEFAULT NULL            COMMENT '预警时间',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态：pending/processing/closed/ignored/to_workorder/cancelled',
  `response_deadline` DATETIME DEFAULT NULL            COMMENT '响应时限',
  `handle_deadline` DATETIME   DEFAULT NULL            COMMENT '处置时限',
  `handle_action` VARCHAR(200) DEFAULT NULL            COMMENT '执行动作',
  `remark`       VARCHAR(500)  DEFAULT NULL            COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_alert_record_source` (`source`),
  KEY `idx_alert_record_level` (`level`),
  KEY `idx_alert_record_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预警记录';

-- 预警规则（alert_settings.html）

DROP TABLE IF EXISTS `sf_alert_rule`;
CREATE TABLE `sf_alert_rule` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `rule_code`    VARCHAR(50)   NOT NULL                COMMENT '规则编号（唯一）',
  `rule_name`    VARCHAR(100)  NOT NULL                COMMENT '规则名称',
  `source`       VARCHAR(20)   DEFAULT NULL            COMMENT '预警来源（6类）',
  `category`     VARCHAR(20)   DEFAULT NULL            COMMENT '业务分类（9类）',
  `level`        VARCHAR(20)   DEFAULT NULL            COMMENT '预警级别（4级）',
  `threshold`    VARCHAR(500)  DEFAULT NULL            COMMENT '阈值设置（结构化：指标+比较符+数值+单位）',
  `scope`        VARCHAR(20)   DEFAULT NULL            COMMENT '作用范围：all/base/plot/device',
  `response_deadline` VARCHAR(50) DEFAULT NULL         COMMENT '响应时限',
  `handle_deadline` VARCHAR(50) DEFAULT NULL           COMMENT '处置时限',
  `notify_way`   VARCHAR(100)  DEFAULT NULL            COMMENT '通知方式',
  `enabled`      TINYINT       NOT NULL DEFAULT 1      COMMENT '启用状态（0/1）',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_alert_rule_code` (`rule_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预警规则';

-- 内部报告（alert_internal_report.html）

DROP TABLE IF EXISTS `sf_alert_report`;
CREATE TABLE `sf_alert_report` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `report_name`  VARCHAR(200)  NOT NULL                COMMENT '报告名称',
  `report_type`  VARCHAR(20)   DEFAULT NULL            COMMENT '报告类型（4类）',
  `base_ids`     VARCHAR(500)  DEFAULT NULL            COMMENT '涉及基地',
  `content`      TEXT          DEFAULT NULL            COMMENT '报告内容',
  `generator`    VARCHAR(100)  DEFAULT NULL            COMMENT '生成人',
  `generate_time` DATETIME     DEFAULT NULL            COMMENT '生成时间',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='内部报告';

-- 设备管理模块（device_info / device_model / device_asset /
--              device_access / gateway_config / video_monitor /
--              device_maintain / device_calibration / device_spare /
--              device_control / device_command / device_stats /
--              device_log / device_audit）

-- 设备台账（device_info.html）

-- ============================================================
-- 【设备管理（台账 / 类型 / 资产 / 接入 / 网关 / 视频 / 维护等）】
-- ============================================================
DROP TABLE IF EXISTS `sf_device`;
CREATE TABLE `sf_device` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `device_code`  VARCHAR(50)   NOT NULL                COMMENT '设备编号（唯一，业务编号）',
  `device_name`  VARCHAR(100)  NOT NULL                COMMENT '设备名称',
  `device_type`  VARCHAR(50)   DEFAULT NULL            COMMENT '设备类型（21类字典）',
  `base_id`      BIGINT        DEFAULT NULL            COMMENT '所属基地（→ sf_base.id）',
  `plot_id`      BIGINT        DEFAULT NULL            COMMENT '所属地块（→ sf_plot.id）',
  `location`     VARCHAR(200)  DEFAULT NULL            COMMENT '安装位置',
  `run_status`   VARCHAR(20)   DEFAULT NULL            COMMENT '运行状态：online/maintain/offline',
  `asset_status` VARCHAR(20)   DEFAULT NULL            COMMENT '资产状态（5态）',
  `vendor`       VARCHAR(100)  DEFAULT NULL            COMMENT '设备厂商',
  `model`        VARCHAR(100)  DEFAULT NULL            COMMENT '设备型号',
  `sn`           VARCHAR(100)  DEFAULT NULL            COMMENT 'SN 序列号',
  `firmware`     VARCHAR(50)   DEFAULT NULL            COMMENT '固件版本',
  `ip`           VARCHAR(50)   DEFAULT NULL            COMMENT 'IP 地址',
  `protocol`     VARCHAR(50)   DEFAULT NULL            COMMENT '通信协议',
  `power`        VARCHAR(50)   DEFAULT NULL            COMMENT '供电方式',
  `owner`        VARCHAR(50)   DEFAULT NULL            COMMENT '运维负责人',
  `supplier`     VARCHAR(100)  DEFAULT NULL            COMMENT '供应商',
  `disposal_way` VARCHAR(50)   DEFAULT NULL            COMMENT '处置方式',
  `install_date` DATE          DEFAULT NULL            COMMENT '安装日期',
  `enable_date`  DATE          DEFAULT NULL            COMMENT '启用日期',
  `warranty_until` DATE        DEFAULT NULL            COMMENT '质保到期日',
  `purchase_amount` DECIMAL(14,2) DEFAULT NULL         COMMENT '采购金额（元）',
  `useful_years` INT           DEFAULT NULL            COMMENT '使用寿命（年）',
  `maintain_cycle` VARCHAR(50) DEFAULT NULL            COMMENT '维保周期',
  `next_maintain` DATE         DEFAULT NULL            COMMENT '下次保养',
  `last_maintain_date` DATE    DEFAULT NULL            COMMENT '最近维护日期',
  `calibrate_cycle` VARCHAR(50) DEFAULT NULL           COMMENT '校准周期',
  `last_calibrate_date` DATE   DEFAULT NULL            COMMENT '最近校准日期',
  `running_hours` DECIMAL(14,1) DEFAULT NULL           COMMENT '累计运行时长（h）',
  `fault_count`   INT          DEFAULT 0               COMMENT '故障次数',
  `online_rate`   DECIMAL(6,2) DEFAULT NULL            COMMENT '在线率（%）',
  `uptime_rate`   DECIMAL(6,2) DEFAULT NULL            COMMENT '稼动率（%）',
  `collect_count` BIGINT       DEFAULT 0               COMMENT '累计采集条数',
  `last_seen_at`  DATETIME     DEFAULT NULL            COMMENT '最近上线时间',
  `collect_time`  DATETIME     DEFAULT NULL            COMMENT '采集时间',
  `remark`        VARCHAR(500) DEFAULT NULL            COMMENT '备注信息',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT      NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_code` (`device_code`),
  KEY `idx_device_base` (`base_id`),
  KEY `idx_device_type` (`device_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备台账';

-- 设备类型与物模型（device_model.html）

DROP TABLE IF EXISTS `sf_device_type`;
CREATE TABLE `sf_device_type` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `type_code`    VARCHAR(50)   NOT NULL                COMMENT '类型编码（唯一）',
  `type_name`    VARCHAR(100)  NOT NULL                COMMENT '类型名称',
  `category`     VARCHAR(50)   DEFAULT NULL            COMMENT '分类（12类）',
  `can_access`   TINYINT       NOT NULL DEFAULT 1      COMMENT '可接入（0/1）',
  `can_control`  TINYINT       NOT NULL DEFAULT 0      COMMENT '可控（0/1）',
  `is_asset`     TINYINT       NOT NULL DEFAULT 1      COMMENT '资产（0/1）',
  `maintain_cycle` VARCHAR(50) DEFAULT NULL            COMMENT '维保周期',
  `calibrate_cycle` VARCHAR(50) DEFAULT NULL           COMMENT '校准周期',
  `measure_count` INT          DEFAULT 0               COMMENT '测点数',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_type_code` (`type_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备类型与物模型';

-- 物模型测点（device_model.html 测点弹窗）

DROP TABLE IF EXISTS `sf_device_measure`;
CREATE TABLE `sf_device_measure` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `device_type_id` BIGINT      NOT NULL                COMMENT '设备类型（→ sf_device_type.id）',
  `measure_key`  VARCHAR(50)   NOT NULL                COMMENT '测点key',
  `measure_name` VARCHAR(100)  DEFAULT NULL            COMMENT '测点名称',
  `unit`         VARCHAR(20)   DEFAULT NULL            COMMENT '单位',
  `step`         DECIMAL(12,4) DEFAULT NULL            COMMENT '步长',
  `range_min`    DECIMAL(12,4) DEFAULT NULL            COMMENT '下限',
  `range_max`    DECIMAL(12,4) DEFAULT NULL            COMMENT '上限',
  `precision`    VARCHAR(20)   DEFAULT NULL            COMMENT '精度',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_measure_key` (`device_type_id`, `measure_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='物模型测点';

-- 资产盘点（device_asset.html）

DROP TABLE IF EXISTS `sf_device_asset`;
CREATE TABLE `sf_device_asset` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `asset_code`   VARCHAR(50)   NOT NULL                COMMENT '盘点单号（唯一）',
  `asset_name`   VARCHAR(100)  NOT NULL                COMMENT '盘点名称',
  `start_date`   DATE          DEFAULT NULL            COMMENT '开始日期',
  `end_date`     DATE          DEFAULT NULL            COMMENT '结束日期',
  `checker`      VARCHAR(100)  DEFAULT NULL            COMMENT '盘点人',
  `should_count` INT           DEFAULT 0               COMMENT '应盘',
  `checked_count` INT          DEFAULT 0               COMMENT '已盘',
  `loss_count`   INT           DEFAULT 0               COMMENT '盘亏/异常',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态：pending/checking/done/loss',
  `summary`      VARCHAR(1000) DEFAULT NULL            COMMENT '盘点总结',
  `remark`       VARCHAR(500)  DEFAULT NULL            COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_asset_code` (`asset_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产盘点';

-- 接入配置（device_access.html）

DROP TABLE IF EXISTS `sf_device_access`;
CREATE TABLE `sf_device_access` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `config_code`  VARCHAR(50)   NOT NULL                COMMENT '配置编号（唯一）',
  `device_id`    BIGINT        DEFAULT NULL            COMMENT '设备（→ sf_device.id）',
  `base_id`      BIGINT        DEFAULT NULL            COMMENT '所属基地（→ sf_base.id）',
  `access_way`   VARCHAR(50)   DEFAULT NULL            COMMENT '接入方式（MQTT/Modbus TCP/ONVIF/RTSP等）',
  `gateway_id`   BIGINT        DEFAULT NULL            COMMENT '所属网关（→ sf_gateway.id）',
  `access_address` VARCHAR(200) DEFAULT NULL           COMMENT '接入地址',
  `collect_frequency` VARCHAR(20) DEFAULT NULL         COMMENT '采集频率',
  `timeout`      INT           DEFAULT NULL            COMMENT '超时(s)',
  `measure_points` VARCHAR(500) DEFAULT NULL           COMMENT '采集测点',
  `direction`    VARCHAR(20)   DEFAULT NULL            COMMENT '方向',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'connected' COMMENT '状态：connected/abnormal/disconnected',
  `remark`       VARCHAR(500)  DEFAULT NULL            COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_access_code` (`config_code`),
  KEY `idx_device_access_device` (`device_id`),
  KEY `idx_device_access_gateway` (`gateway_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备接入配置';

-- 网关与协议（gateway_config.html）

DROP TABLE IF EXISTS `sf_gateway`;
CREATE TABLE `sf_gateway` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `gateway_code` VARCHAR(50)   NOT NULL                COMMENT '网关编号（唯一）',
  `gateway_name` VARCHAR(100)  NOT NULL                COMMENT '网关名称',
  `model`        VARCHAR(100)  DEFAULT NULL            COMMENT '型号',
  `vendor`       VARCHAR(100)  DEFAULT NULL            COMMENT '厂商',
  `protocol`     VARCHAR(50)   DEFAULT NULL            COMMENT '通信协议（MQTT/Modbus TCP/ONVIF/WebSocket/RTSP/GB/T 28181）',
  `ip`           VARCHAR(50)   DEFAULT NULL            COMMENT 'IP',
  `port`         VARCHAR(20)   DEFAULT NULL            COMMENT '端口',
  `topic_prefix` VARCHAR(100)  DEFAULT NULL            COMMENT 'Topic 前缀',
  `sn`           VARCHAR(100)  DEFAULT NULL            COMMENT 'SN序列号',
  `access_load`  INT           DEFAULT NULL            COMMENT '接入负载',
  `heartbeat`    INT           DEFAULT NULL            COMMENT '心跳(s)',
  `location`     VARCHAR(200)  DEFAULT NULL            COMMENT '安装位置',
  `max_device`   INT           DEFAULT NULL            COMMENT '最大接入设备数',
  `account`      VARCHAR(100)  DEFAULT NULL            COMMENT '账号',
  `password`     VARCHAR(200)  DEFAULT NULL            COMMENT '密码（脱敏存储）',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'running' COMMENT '状态：running/unstable/offline',
  `remark`       VARCHAR(500)  DEFAULT NULL            COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_gateway_code` (`gateway_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='网关与协议';

-- 视频监控通道（video_monitor.html）

DROP TABLE IF EXISTS `sf_video_channel`;
CREATE TABLE `sf_video_channel` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `channel_code` VARCHAR(50)   NOT NULL                COMMENT '通道编号（唯一）',
  `channel_name` VARCHAR(100)  NOT NULL                COMMENT '通道名称',
  `device_code`  VARCHAR(50)   DEFAULT NULL            COMMENT '设备编码',
  `channel_no`   VARCHAR(20)   DEFAULT NULL            COMMENT '通道号',
  `protocol`     VARCHAR(50)   DEFAULT NULL            COMMENT '取流协议（ONVIF/RTSP/GB/T 28181）',
  `rtsp_url`     VARCHAR(300)  DEFAULT NULL            COMMENT '取流地址',
  `platform`     VARCHAR(100)  DEFAULT NULL            COMMENT '接入平台',
  `resolution`   VARCHAR(50)   DEFAULT NULL            COMMENT '分辨率',
  `frame_rate`   VARCHAR(20)   DEFAULT NULL            COMMENT '帧率',
  `stream`       VARCHAR(50)   DEFAULT NULL            COMMENT '码流（主/子）',
  `has_ptz`      TINYINT       NOT NULL DEFAULT 0      COMMENT '云台（0/1）',
  `night_vision` TINYINT       NOT NULL DEFAULT 0      COMMENT '夜视（0/1）',
  `retain_days`  INT           DEFAULT NULL            COMMENT '留存(天)',
  `form`         VARCHAR(50)   DEFAULT NULL            COMMENT '形态',
  `power`        VARCHAR(50)   DEFAULT NULL            COMMENT '供电方式',
  `protection`   VARCHAR(50)   DEFAULT NULL            COMMENT '防护等级',
  `bitrate`      VARCHAR(50)   DEFAULT NULL            COMMENT '码率',
  `has_audio`    TINYINT       NOT NULL DEFAULT 0      COMMENT '音频（0/1）',
  `ai_ability`   VARCHAR(200)  DEFAULT NULL            COMMENT 'AI能力',
  `preset_count` INT           DEFAULT 0               COMMENT '预置位数量',
  `base_id`      BIGINT        DEFAULT NULL            COMMENT '所属基地（→ sf_base.id）',
  `location`     VARCHAR(200)  DEFAULT NULL            COMMENT '安装位置',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'online' COMMENT '状态：online/weak/offline',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_video_channel_code` (`channel_code`),
  KEY `idx_video_channel_base` (`base_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='视频监控通道';

-- 维护工单（device_maintain.html）

DROP TABLE IF EXISTS `sf_device_maintain`;
CREATE TABLE `sf_device_maintain` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `maintain_code` VARCHAR(50)  NOT NULL                COMMENT '维护编号（唯一）',
  `device_id`    BIGINT        DEFAULT NULL            COMMENT '设备（→ sf_device.id）',
  `maintain_type` VARCHAR(50)  DEFAULT NULL            COMMENT '维护类型',
  `fault_category` VARCHAR(50) DEFAULT NULL            COMMENT '故障分类',
  `content`      VARCHAR(1000) DEFAULT NULL            COMMENT '维护内容',
  `fault_desc`   VARCHAR(500)  DEFAULT NULL            COMMENT '故障描述',
  `manager`      VARCHAR(100)  DEFAULT NULL            COMMENT '负责人',
  `plan_time`    DATETIME      DEFAULT NULL            COMMENT '计划时间',
  `start_time`   DATETIME      DEFAULT NULL            COMMENT '开始时间',
  `end_time`     DATETIME      DEFAULT NULL            COMMENT '结束时间',
  `work_hours`   DECIMAL(10,2) DEFAULT NULL            COMMENT '工时(h)',
  `stop_hours`   DECIMAL(10,2) DEFAULT NULL            COMMENT '停机(h)',
  `cost`         DECIMAL(12,2) DEFAULT NULL            COMMENT '费用(元)',
  `result`       VARCHAR(1000) DEFAULT NULL            COMMENT '处理结果',
  `parts`        VARCHAR(500)  DEFAULT NULL            COMMENT '更换配件',
  `acceptor`     VARCHAR(100)  DEFAULT NULL            COMMENT '验收人',
  `outsourced`   VARCHAR(200)  DEFAULT NULL            COMMENT '外包信息',
  `priority`     VARCHAR(20)   DEFAULT 'normal'        COMMENT '优先级：normal/high/urgent',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_maintain_code` (`maintain_code`),
  KEY `idx_device_maintain_device` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备维护工单';

-- 校准检定（device_calibration.html）

DROP TABLE IF EXISTS `sf_device_calibration`;
CREATE TABLE `sf_device_calibration` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `calibration_code` VARCHAR(50) NOT NULL              COMMENT '校准编号（唯一）',
  `device_id`    BIGINT        DEFAULT NULL            COMMENT '设备（→ sf_device.id）',
  `calibration_type` VARCHAR(50) DEFAULT NULL          COMMENT '校准类型',
  `plan_date`    DATE          DEFAULT NULL            COMMENT '计划日期',
  `actual_date`  DATE          DEFAULT NULL            COMMENT '实际日期',
  `executor`     VARCHAR(100)  DEFAULT NULL            COMMENT '执行人',
  `reviewer`     VARCHAR(100)  DEFAULT NULL            COMMENT '复核人',
  `result`       VARCHAR(20)   DEFAULT NULL            COMMENT '结果：pass/fail',
  `content`      VARCHAR(1000) DEFAULT NULL            COMMENT '校准内容',
  `deviation`    VARCHAR(200)  DEFAULT NULL            COMMENT '偏差说明',
  `conclusion`   VARCHAR(20)   DEFAULT NULL            COMMENT '结论：qualified/unqualified/expired',
  `valid_until`  DATE          DEFAULT NULL            COMMENT '有效期至',
  `cert_code`    VARCHAR(100)  DEFAULT NULL            COMMENT '证书编号',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_calibration_code` (`calibration_code`),
  KEY `idx_device_calibration_device` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='校准检定';

-- 备品备件（device_spare.html）

DROP TABLE IF EXISTS `sf_device_spare`;
CREATE TABLE `sf_device_spare` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `spare_code`   VARCHAR(50)   NOT NULL                COMMENT '备件编号（唯一）',
  `spare_name`   VARCHAR(100)  NOT NULL                COMMENT '备件名称',
  `spec`         VARCHAR(100)  DEFAULT NULL            COMMENT '规格型号',
  `vendor`       VARCHAR(100)  DEFAULT NULL            COMMENT '厂商',
  `supplier`     VARCHAR(100)  DEFAULT NULL            COMMENT '供应商',
  `applicable_type` VARCHAR(100) DEFAULT NULL          COMMENT '适用设备类型',
  `unit`         VARCHAR(20)   DEFAULT NULL            COMMENT '单位',
  `current_stock` DECIMAL(12,2) DEFAULT NULL           COMMENT '当前库存',
  `safety_stock` DECIMAL(12,2) DEFAULT NULL            COMMENT '安全库存',
  `used_amount`  DECIMAL(12,2) DEFAULT NULL            COMMENT '已领用',
  `price`        DECIMAL(12,2) DEFAULT NULL            COMMENT '单价(元)',
  `stock_value`  DECIMAL(12,2) DEFAULT NULL            COMMENT '库存金额',
  `location`     VARCHAR(50)   DEFAULT NULL            COMMENT '库位',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'enough' COMMENT '状态：shortage/low/enough',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_spare_code` (`spare_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='备品备件';

-- 远程指令（device_control.html / device_command.html）

DROP TABLE IF EXISTS `sf_device_command`;
CREATE TABLE `sf_device_command` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `command_code` VARCHAR(50)   NOT NULL                COMMENT '指令编号（唯一，CMD-YYYYMMDD-NNN）',
  `device_id`    BIGINT        DEFAULT NULL            COMMENT '设备（→ sf_device.id）',
  `command_type` VARCHAR(50)   DEFAULT NULL            COMMENT '指令类型（参数下发/远程重启/固件升级/校准/开关控制）',
  `content`      VARCHAR(1000) DEFAULT NULL            COMMENT '指令内容',
  `operator`     VARCHAR(100)  DEFAULT NULL            COMMENT '操作人',
  `send_time`    DATETIME      DEFAULT NULL            COMMENT '下发时间',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态：pending/sending/success/failed',
  `result`       VARCHAR(500)  DEFAULT NULL            COMMENT '结果摘要',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_command_code` (`command_code`),
  KEY `idx_device_command_device` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='远程指令';

-- 设备日志（device_log.html）

DROP TABLE IF EXISTS `sf_device_log`;
CREATE TABLE `sf_device_log` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `log_time`     DATETIME      DEFAULT NULL            COMMENT '日志时间',
  `device_id`    BIGINT        DEFAULT NULL            COMMENT '设备（→ sf_device.id）',
  `log_level`    VARCHAR(20)   DEFAULT NULL            COMMENT '日志级别：INFO/WARN/ERROR/DEBUG',
  `log_type`     VARCHAR(20)   DEFAULT NULL            COMMENT '日志类型（数据采集/通信交互/异常事件/配置变更/控制指令/设备启停）',
  `source`       VARCHAR(50)   DEFAULT NULL            COMMENT '来源（设备/网关/平台/移动端）',
  `content`      VARCHAR(1000) DEFAULT NULL            COMMENT '日志内容',
  `measure_key`  VARCHAR(50)   DEFAULT NULL            COMMENT '关联测点',
  `value`        VARCHAR(200)  DEFAULT NULL            COMMENT '数值',
  `trace_id`     VARCHAR(100)  DEFAULT NULL            COMMENT '追踪ID',
  `handle_status` VARCHAR(20)  DEFAULT NULL            COMMENT '处理状态',
  `handler`      VARCHAR(100)  DEFAULT NULL            COMMENT '处理人',
  `handle_time`  DATETIME      DEFAULT NULL            COMMENT '处理时间',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_device_log_device` (`device_id`),
  KEY `idx_device_log_time` (`log_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备日志';

-- 操作审计（device_audit.html）

DROP TABLE IF EXISTS `sf_device_audit`;
CREATE TABLE `sf_device_audit` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `operate_time` DATETIME      DEFAULT NULL            COMMENT '操作时间',
  `operate_type` VARCHAR(20)   DEFAULT NULL            COMMENT '操作类型：新增/修改/删除/状态变更',
  `object_type`  VARCHAR(50)   DEFAULT NULL            COMMENT '对象类型',
  `object_code`  VARCHAR(100)  DEFAULT NULL            COMMENT '对象编号',
  `operator`     VARCHAR(100)  DEFAULT NULL            COMMENT '操作人',
  `summary`      VARCHAR(500)  DEFAULT NULL            COMMENT '操作摘要',
  `before_data`  TEXT          DEFAULT NULL            COMMENT '变更前（JSON）',
  `after_data`   TEXT          DEFAULT NULL            COMMENT '变更后（JSON）',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_device_audit_time` (`operate_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备操作审计';

-- 证书管理模块（cert_manage / cert_issue）

-- 证书台账（cert_manage.html，含企业资质9类 + 批次凭证3类）

-- ============================================================
-- 【证书管理（证书 / 电子签章）】
-- ============================================================
DROP TABLE IF EXISTS `sf_cert`;
CREATE TABLE `sf_cert` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `cert_no`      VARCHAR(100)  NOT NULL                COMMENT '证书编号（唯一）',
  `cert_name`    VARCHAR(200)  DEFAULT NULL            COMMENT '证书名称',
  `cert_type`    VARCHAR(50)   DEFAULT NULL            COMMENT '证书类型（12类）',
  `type_code`    VARCHAR(50)   DEFAULT NULL            COMMENT '类型编码',
  `subject_type` VARCHAR(20)   DEFAULT NULL            COMMENT '主体类型：enterprise/batch',
  `category`     VARCHAR(50)   DEFAULT NULL            COMMENT '分类（企业资质/批次凭证）',
  `batch_no`     VARCHAR(50)   DEFAULT NULL            COMMENT '关联批次（批次凭证必填）',
  `issuer`       VARCHAR(200)  DEFAULT NULL            COMMENT '发证机构',
  `customer_name` VARCHAR(100) DEFAULT NULL            COMMENT '客户名称（合格证采购方）',
  `product_name` VARCHAR(100)  DEFAULT NULL            COMMENT '产品名称',
  `produce_date` DATE          DEFAULT NULL            COMMENT '生产日期',
  `net_weight`   VARCHAR(50)   DEFAULT NULL            COMMENT '净含量',
  `grade`        VARCHAR(20)   DEFAULT NULL            COMMENT '等级',
  `conclusion`   VARCHAR(50)   DEFAULT NULL            COMMENT '检测结论（合格/不合格）',
  `tester`       VARCHAR(100)  DEFAULT NULL            COMMENT '检测人',
  `promise`      VARCHAR(500)  DEFAULT NULL            COMMENT '承诺声明',
  `scope`        VARCHAR(500)  DEFAULT NULL            COMMENT '认证范围',
  `valid_start`  DATE          DEFAULT NULL            COMMENT '有效期起',
  `valid_end`    DATE          DEFAULT NULL            COMMENT '有效期至',
  `file_id`      BIGINT        DEFAULT NULL            COMMENT '附件（→ sf_file.id）',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'draft' COMMENT '状态：draft/pending/active/revoked',
  `revoke_reason` VARCHAR(200) DEFAULT NULL            COMMENT '作废/驳回原因',
  `issued_by`    VARCHAR(100)  DEFAULT NULL            COMMENT '签发人',
  `issued_at`    DATETIME      DEFAULT NULL            COMMENT '签发时间',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cert_no` (`cert_no`),
  KEY `idx_cert_batch` (`batch_no`),
  KEY `idx_cert_type` (`cert_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='证书台账';

-- 电子签章（cert_issue.html 手写签章）

DROP TABLE IF EXISTS `sf_cert_stamp`;
CREATE TABLE `sf_cert_stamp` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`      BIGINT        DEFAULT NULL            COMMENT '签章人（→ sf_user.id）',
  `stamp_name`   VARCHAR(100)  DEFAULT NULL            COMMENT '签章名称',
  `file_id`      BIGINT        DEFAULT NULL            COMMENT '签章图片（→ sf_file.id）',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_cert_stamp_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='电子签章';

-- 经营分析模块（report_overview / report_revenue / report_cost /
--              report_profit / biz_revenue_mix / biz_receivable /
--              biz_metrics / performance_dashboard / performance_detail）

-- 经营收入构成（biz_revenue_mix.html）

-- ============================================================
-- 【经营分析（收入 / 应收 / 指标 / 成本 / 利润 / 绩效）】
-- ============================================================
DROP TABLE IF EXISTS `sf_biz_revenue_mix`;
CREATE TABLE `sf_biz_revenue_mix` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `revenue_type` VARCHAR(100)  NOT NULL                COMMENT '收入类型（鲜果销售/认养收入/农资服务/冷链代储）',
  `amount`       DECIMAL(14,2) DEFAULT NULL            COMMENT '金额（万元）',
  `channel_desc` VARCHAR(500)  DEFAULT NULL            COMMENT '渠道说明',
  `fiscal_year`  VARCHAR(20)   DEFAULT NULL            COMMENT '财年',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='经营收入构成';

-- 应收周转（biz_receivable.html）

DROP TABLE IF EXISTS `sf_biz_receivable`;
CREATE TABLE `sf_biz_receivable` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `customer_name` VARCHAR(100) NOT NULL                COMMENT '客户名称',
  `customer_type` VARCHAR(50)  DEFAULT NULL            COMMENT '类型',
  `amount`       DECIMAL(14,2) DEFAULT NULL            COMMENT '应收金额（万元）',
  `age_range`    VARCHAR(20)   DEFAULT NULL            COMMENT '账龄区间（30天以内/31-60/61-90/90天以上）',
  `fiscal_year`  VARCHAR(20)   DEFAULT NULL            COMMENT '财年',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='应收周转';

-- 经营指标（biz_metrics.html）

DROP TABLE IF EXISTS `sf_biz_metric`;
CREATE TABLE `sf_biz_metric` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `metric_name`  VARCHAR(100)  NOT NULL                COMMENT '指标名称',
  `current_value` VARCHAR(100) DEFAULT NULL            COMMENT '当前值',
  `change_rate`  VARCHAR(50)   DEFAULT NULL            COMMENT '环比变化',
  `better_direction` VARCHAR(20) DEFAULT NULL          COMMENT '向好方向',
  `eval_scope`   VARCHAR(200)  DEFAULT NULL            COMMENT '评价口径',
  `fiscal_year`  VARCHAR(20)   DEFAULT NULL            COMMENT '财年',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='经营指标';

-- 成本科目（report_cost.html）

DROP TABLE IF EXISTS `sf_cost_item`;
CREATE TABLE `sf_cost_item` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `cost_name`    VARCHAR(100)  NOT NULL                COMMENT '成本科目',
  `amount`       DECIMAL(14,2) DEFAULT NULL            COMMENT '金额（万元/元）',
  `description`  VARCHAR(500)  DEFAULT NULL            COMMENT '说明',
  `fiscal_year`  VARCHAR(20)   DEFAULT NULL            COMMENT '财年',
  `sort_order`   INT           DEFAULT 0               COMMENT '排序',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成本科目';

-- 地块经营数据（report_profit.html 品种/地块利润明细）

DROP TABLE IF EXISTS `sf_plot_profit`;
CREATE TABLE `sf_plot_profit` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `plot_id`      BIGINT        DEFAULT NULL            COMMENT '地块（→ sf_plot.id）',
  `variety`      VARCHAR(50)   DEFAULT NULL            COMMENT '品种',
  `area`         DECIMAL(12,2) DEFAULT NULL            COMMENT '面积(亩)',
  `tree_count`   INT           DEFAULT NULL            COMMENT '树木数量(棵)',
  `yield`        DECIMAL(12,2) DEFAULT NULL            COMMENT '产量(吨)',
  `revenue`      DECIMAL(14,2) DEFAULT NULL            COMMENT '收入(元)',
  `cost`         DECIMAL(14,2) DEFAULT NULL            COMMENT '成本(元)',
  `profit`       DECIMAL(14,2) DEFAULT NULL            COMMENT '利润(元)',
  `fiscal_year`  VARCHAR(20)   DEFAULT NULL            COMMENT '财年',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_plot_profit_plot` (`plot_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='地块经营数据';

-- 绩效结果（performance_dashboard.html）

DROP TABLE IF EXISTS `sf_performance_result`;
CREATE TABLE `sf_performance_result` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`      BIGINT        DEFAULT NULL            COMMENT '人员（→ sf_user.id）',
  `real_name`    VARCHAR(100)  NOT NULL                COMMENT '姓名',
  `team`         VARCHAR(50)   DEFAULT NULL            COMMENT '班组（一班/二班/三班）',
  `period`       VARCHAR(50)   DEFAULT NULL            COMMENT '周期',
  `complete_rate` DECIMAL(5,2) DEFAULT NULL            COMMENT '完成率(%)',
  `quality_score` DECIMAL(5,2) DEFAULT NULL            COMMENT '质量评分',
  `workload`     DECIMAL(12,2) DEFAULT NULL            COMMENT '工作量',
  `composite`    DECIMAL(5,2)  DEFAULT NULL            COMMENT '综合评分',
  `rating`       VARCHAR(20)   DEFAULT NULL            COMMENT '评级',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_performance_user` (`user_id`),
  KEY `idx_performance_team` (`team`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='绩效结果';

-- 绩效任务明细（performance_detail.html）

DROP TABLE IF EXISTS `sf_performance_task`;
CREATE TABLE `sf_performance_task` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `performance_id` BIGINT      DEFAULT NULL            COMMENT '绩效结果（→ sf_performance_result.id）',
  `task_name`    VARCHAR(200)  DEFAULT NULL            COMMENT '任务名称',
  `plot_id`      BIGINT        DEFAULT NULL            COMMENT '地块（→ sf_plot.id）',
  `task_type`    VARCHAR(50)   DEFAULT NULL            COMMENT '任务类型',
  `complete_time` DATETIME     DEFAULT NULL            COMMENT '完成时间',
  `quality_score` DECIMAL(5,2) DEFAULT NULL            COMMENT '质量评分',
  `status`       VARCHAR(20)   DEFAULT NULL            COMMENT '状态',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_performance_task_perf` (`performance_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='绩效任务明细';

-- 销售管理模块（sales_order / sales_shipment / sales_customer /
--              sales_aftersale / sales_price / sales_target /
--              sales_statement / sales_statistics）

-- 销售订单（sales_order.html）

-- ============================================================
-- 【销售管理（订单 / 发货 / 客户 / 售后 / 价格 / 目标 / 对账）】
-- ============================================================
DROP TABLE IF EXISTS `sf_sales_order`;
CREATE TABLE `sf_sales_order` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_code`   VARCHAR(50)   NOT NULL                COMMENT '订单编号（唯一）',
  `order_type`   VARCHAR(20)   DEFAULT NULL            COMMENT '订单类型（批发/零售）',
  `source`       VARCHAR(20)   DEFAULT NULL            COMMENT '来源（后台录入/H5商城）',
  `customer_name` VARCHAR(100) DEFAULT NULL            COMMENT '客户名称',
  `customer_id`  BIGINT        DEFAULT NULL            COMMENT '客户（→ sf_sales_customer.id）',
  `product_info` VARCHAR(1000) DEFAULT NULL           COMMENT '商品明细',
  `quantity`     DECIMAL(12,2) DEFAULT NULL            COMMENT '数量',
  `price`        DECIMAL(12,2) DEFAULT NULL            COMMENT '单价',
  `amount`       DECIMAL(14,2) DEFAULT NULL            COMMENT '金额',
  `received`     DECIMAL(14,2) DEFAULT NULL            COMMENT '已收',
  `receivable`   DECIMAL(14,2) DEFAULT NULL            COMMENT '应收/待收',
  `channel`      VARCHAR(50)   DEFAULT NULL            COMMENT '渠道',
  `pay_status`   VARCHAR(20)   DEFAULT NULL            COMMENT '付款状态',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '订单状态（11态）',
  `operator`     VARCHAR(100)  DEFAULT NULL            COMMENT '经办人',
  `order_time`   DATETIME      DEFAULT NULL            COMMENT '下单时间',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sales_order_code` (`order_code`),
  KEY `idx_sales_order_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售订单';

-- 发货与物流（sales_shipment.html）

DROP TABLE IF EXISTS `sf_sales_shipment`;
CREATE TABLE `sf_sales_shipment` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `shipment_code` VARCHAR(50)  NOT NULL                COMMENT '发货单号（唯一）',
  `order_id`     BIGINT        DEFAULT NULL            COMMENT '订单（→ sf_sales_order.id）',
  `product_info` VARCHAR(1000) DEFAULT NULL           COMMENT '商品明细',
  `quantity`     DECIMAL(12,2) DEFAULT NULL            COMMENT '数量',
  `amount`       DECIMAL(14,2) DEFAULT NULL            COMMENT '订单金额',
  `receiver`     VARCHAR(100)  DEFAULT NULL            COMMENT '收货人',
  `receiver_phone` VARCHAR(20) DEFAULT NULL            COMMENT '收货人电话',
  `address`      VARCHAR(255)  DEFAULT NULL            COMMENT '收货地址',
  `express_company` VARCHAR(50) DEFAULT NULL           COMMENT '快递公司',
  `tracking_no`  VARCHAR(100)  DEFAULT NULL            COMMENT '运单号',
  `ship_time`    DATETIME      DEFAULT NULL            COMMENT '发货时间',
  `sign_time`    DATETIME      DEFAULT NULL            COMMENT '签收时间',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态（在途/已签收）',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sales_shipment_code` (`shipment_code`),
  KEY `idx_sales_shipment_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='发货与物流';

-- 客户管理（sales_customer.html）

DROP TABLE IF EXISTS `sf_sales_customer`;
CREATE TABLE `sf_sales_customer` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `customer_code` VARCHAR(50)  NOT NULL                COMMENT '客户编号（唯一）',
  `customer_name` VARCHAR(100) NOT NULL                COMMENT '客户名称',
  `contact`      VARCHAR(50)   DEFAULT NULL            COMMENT '联系人',
  `phone`        VARCHAR(20)   DEFAULT NULL            COMMENT '电话',
  `customer_type` VARCHAR(20)  DEFAULT NULL            COMMENT '客户类型（认养用户/批发/零售）',
  `grade`        VARCHAR(20)   DEFAULT NULL            COMMENT '等级（VIP/黄金/白银）',
  `region`       VARCHAR(100)  DEFAULT NULL            COMMENT '所属区域',
  `source`       VARCHAR(50)   DEFAULT NULL            COMMENT '客户来源',
  `channel`      VARCHAR(50)   DEFAULT NULL            COMMENT '渠道',
  `salesman`     VARCHAR(100)  DEFAULT NULL            COMMENT '业务员',
  `order_count`  INT           DEFAULT 0               COMMENT '订单数',
  `deal_amount`  DECIMAL(14,2) DEFAULT NULL            COMMENT '成交金额',
  `received_amount` DECIMAL(14,2) DEFAULT NULL         COMMENT '回款金额',
  `receivable_balance` DECIMAL(14,2) DEFAULT NULL      COMMENT '应收余额',
  `account_age`  INT           DEFAULT NULL            COMMENT '账龄（天）',
  `credit_limit` DECIMAL(14,2) DEFAULT NULL            COMMENT '信用额度',
  `account_period` VARCHAR(50) DEFAULT NULL            COMMENT '账期',
  `invoice_info` VARCHAR(500)  DEFAULT NULL            COMMENT '开票信息',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态：active/dormant',
  `last_order_time` DATETIME   DEFAULT NULL            COMMENT '最近下单',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sales_customer_code` (`customer_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户';

-- 售后与退款（sales_aftersale.html）

DROP TABLE IF EXISTS `sf_sales_aftersale`;
CREATE TABLE `sf_sales_aftersale` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `aftersale_code` VARCHAR(50) NOT NULL                COMMENT '售后单号（唯一）',
  `order_id`     BIGINT        DEFAULT NULL            COMMENT '订单（→ sf_sales_order.id）',
  `customer_name` VARCHAR(100) DEFAULT NULL            COMMENT '客户',
  `aftersale_type` VARCHAR(20) DEFAULT NULL            COMMENT '类型（仅退款/退货退款/换货）',
  `reason`       VARCHAR(500)  DEFAULT NULL            COMMENT '售后原因',
  `quantity`     DECIMAL(12,2) DEFAULT NULL            COMMENT '数量',
  `apply_amount` DECIMAL(14,2) DEFAULT NULL            COMMENT '申请金额',
  `apply_time`   DATETIME      DEFAULT NULL            COMMENT '申请时间',
  `handler`      VARCHAR(100)  DEFAULT NULL            COMMENT '处理人',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态（8态）',
  `reject_reason` VARCHAR(500) DEFAULT NULL            COMMENT '驳回原因',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sales_aftersale_code` (`aftersale_code`),
  KEY `idx_sales_aftersale_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='售后与退款';

-- 价格政策（sales_price.html 价格政策Tab）

DROP TABLE IF EXISTS `sf_sales_price_policy`;
CREATE TABLE `sf_sales_price_policy` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `policy_code`  VARCHAR(50)   NOT NULL                COMMENT '政策编号（唯一）',
  `policy_name`  VARCHAR(100)  NOT NULL                COMMENT '政策名称',
  `product`      VARCHAR(100)  DEFAULT NULL            COMMENT '商品',
  `agreement_price` DECIMAL(12,2) DEFAULT NULL         COMMENT '协议单价',
  `min_order`    DECIMAL(12,2) DEFAULT NULL            COMMENT '起订量',
  `applicable_object` VARCHAR(100) DEFAULT NULL        COMMENT '适用对象',
  `scope`        VARCHAR(200)  DEFAULT NULL            COMMENT '适用范围',
  `start_date`   DATE          DEFAULT NULL            COMMENT '开始日期',
  `end_date`     DATE          DEFAULT NULL            COMMENT '失效日期',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态（4态）',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sales_price_policy_code` (`policy_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='价格政策';

-- 促销活动（sales_price.html 促销活动Tab）

DROP TABLE IF EXISTS `sf_sales_promotion`;
CREATE TABLE `sf_sales_promotion` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `promotion_code` VARCHAR(50) NOT NULL                COMMENT '活动编号（唯一）',
  `promotion_name` VARCHAR(100) NOT NULL               COMMENT '活动名称',
  `promotion_type` VARCHAR(20) DEFAULT NULL            COMMENT '促销类型（4类）',
  `discount_type` VARCHAR(20)  DEFAULT NULL            COMMENT '优惠类型',
  `discount_rule` VARCHAR(500) DEFAULT NULL            COMMENT '优惠规则',
  `product`      VARCHAR(100)  DEFAULT NULL            COMMENT '商品',
  `start_date`   DATE          DEFAULT NULL            COMMENT '生效日期',
  `end_date`     DATE          DEFAULT NULL            COMMENT '结束日期',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sales_promotion_code` (`promotion_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='促销活动';

-- 销售目标（sales_target.html）

DROP TABLE IF EXISTS `sf_sales_target`;
CREATE TABLE `sf_sales_target` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `period`       VARCHAR(50)   DEFAULT NULL            COMMENT '目标期间',
  `manager`      VARCHAR(100)  DEFAULT NULL            COMMENT '负责人',
  `target_orders` INT          DEFAULT NULL            COMMENT '目标订单',
  `target_amount` DECIMAL(14,2) DEFAULT NULL           COMMENT '目标金额',
  `actual_orders` INT          DEFAULT NULL            COMMENT '实际订单',
  `actual_amount` DECIMAL(14,2) DEFAULT NULL           COMMENT '实际金额',
  `order_rate`   DECIMAL(5,2)  DEFAULT NULL            COMMENT '订单达成率',
  `amount_rate`  DECIMAL(5,2)  DEFAULT NULL            COMMENT '金额达成率',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售目标';

-- 客户对账单（sales_statement.html）

DROP TABLE IF EXISTS `sf_sales_statement`;
CREATE TABLE `sf_sales_statement` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `statement_code` VARCHAR(50) NOT NULL                COMMENT '对账单号（唯一）',
  `customer_name` VARCHAR(100) DEFAULT NULL            COMMENT '客户',
  `period`       VARCHAR(50)   DEFAULT NULL            COMMENT '对账期间',
  `channel`      VARCHAR(50)   DEFAULT NULL            COMMENT '渠道',
  `order_count`  INT           DEFAULT 0               COMMENT '订单数',
  `amount`       DECIMAL(14,2) DEFAULT NULL            COMMENT '对账金额',
  `received`     DECIMAL(14,2) DEFAULT NULL            COMMENT '已收金额',
  `receivable_balance` DECIMAL(14,2) DEFAULT NULL      COMMENT '应收余额',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态：pending/confirmed/settled',
  `generate_time` DATETIME     DEFAULT NULL            COMMENT '生成时间',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sales_statement_code` (`statement_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户对账单';

-- 收款流水（销售订单/客户 收款记录）

DROP TABLE IF EXISTS `sf_sales_receipt`;
CREATE TABLE `sf_sales_receipt` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `receipt_code` VARCHAR(50)   NOT NULL                COMMENT '收款单号（唯一）',
  `order_id`     BIGINT        DEFAULT NULL            COMMENT '订单（→ sf_sales_order.id）',
  `customer_name` VARCHAR(100) DEFAULT NULL            COMMENT '客户',
  `amount`       DECIMAL(14,2) DEFAULT NULL            COMMENT '收款金额',
  `pay_way`      VARCHAR(50)   DEFAULT NULL            COMMENT '方式',
  `receipt_time` DATETIME      DEFAULT NULL            COMMENT '收款时间',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sales_receipt_code` (`receipt_code`),
  KEY `idx_sales_receipt_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收款流水';

-- 数据运营模块（data_source / data_collection / model_monitor /
--              achievement_record）

-- 数据源接入（data_source.html）

-- ============================================================
-- 【数据运营（数据源 / 归集 / 模型监控 / 成效 / 里程碑）】
-- ============================================================
DROP TABLE IF EXISTS `sf_data_source`;
CREATE TABLE `sf_data_source` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name`         VARCHAR(100)  NOT NULL                COMMENT '数据源名称',
  `type`         VARCHAR(20)   DEFAULT NULL            COMMENT '类型（业务库/IoT网关/区块链/移动端）',
  `protocol`     VARCHAR(50)   DEFAULT NULL            COMMENT '协议（REST API/MQTT/WebSocket/HTTPS等）',
  `address`      VARCHAR(255)  DEFAULT NULL            COMMENT '接入地址',
  `frequency`    VARCHAR(20)   DEFAULT NULL            COMMENT '采集频率',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'running' COMMENT '状态：running/delayed/offline',
  `heartbeat`    DATETIME      DEFAULT NULL            COMMENT '最近心跳',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据源接入';

-- 数据归集（data_collection.html）

DROP TABLE IF EXISTS `sf_data_collection`;
CREATE TABLE `sf_data_collection` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `source`       VARCHAR(100)  NOT NULL                COMMENT '数据来源（农事/设备/销售/溯源/环境）',
  `collect_amount` BIGINT      DEFAULT NULL            COMMENT '归集量（条）',
  `qualified_rate` DECIMAL(5,2) DEFAULT NULL           COMMENT '合格率(%)',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_data_collection_source` (`source`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据归集';

-- 模型监控（model_monitor.html，数据运营）

DROP TABLE IF EXISTS `sf_model_monitor`;
CREATE TABLE `sf_model_monitor` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `model_name`   VARCHAR(100)  NOT NULL                COMMENT '模型名称',
  `version`      VARCHAR(50)   DEFAULT NULL            COMMENT '版本',
  `call_count`   BIGINT        DEFAULT 0               COMMENT '调用次数',
  `hit_rate`     DECIMAL(5,2)  DEFAULT NULL            COMMENT '命中率(%)',
  `response_time` VARCHAR(50)  DEFAULT NULL            COMMENT '响应时长',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'online' COMMENT '状态（在线/离线）',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模型监控';

-- 成效记录（achievement_record.html 成效Tab）

DROP TABLE IF EXISTS `sf_achievement`;
CREATE TABLE `sf_achievement` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `item_name`    VARCHAR(100)  NOT NULL                COMMENT '成效项（节水/节肥/减药/增产/减损）',
  `before_value` VARCHAR(50)   DEFAULT NULL            COMMENT '实施前',
  `after_value`  VARCHAR(50)   DEFAULT NULL            COMMENT '实施后',
  `change_range` VARCHAR(50)   DEFAULT NULL            COMMENT '变化幅度',
  `unit`         VARCHAR(20)   DEFAULT NULL            COMMENT '单位',
  `description`  VARCHAR(500)  DEFAULT NULL            COMMENT '说明',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成效记录';

-- 数字化里程碑（achievement_record.html 里程碑Tab）

DROP TABLE IF EXISTS `sf_milestone`;
CREATE TABLE `sf_milestone` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name`         VARCHAR(200)  NOT NULL                COMMENT '亮点名称',
  `milestone_date` VARCHAR(20) DEFAULT NULL            COMMENT '日期（YYYY-MM 或 YYYY-MM-DD）',
  `description`  VARCHAR(500)  DEFAULT NULL            COMMENT '说明',
  `sort_order`   INT           DEFAULT 0               COMMENT '排序',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数字化里程碑';

-- 模型管理模块（model_config / model_growth / model_phenology /
--              model_weather / model_pest / model_yield / model_price）

-- 模型配置（model_config.html 模型开关 + 阈值）

-- ============================================================
-- 【模型管理（模型配置 / 物候 / 病虫害 / 产量预估）】
-- ============================================================
DROP TABLE IF EXISTS `sf_model_config`;
CREATE TABLE `sf_model_config` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `model_code`   VARCHAR(50)   NOT NULL                COMMENT '模型编码（growth/weather/pest/phenology/yield/price）',
  `model_name`   VARCHAR(100)  NOT NULL                COMMENT '模型名称',
  `enabled`      TINYINT       NOT NULL DEFAULT 1      COMMENT '启用状态（0/1）',
  `version`      VARCHAR(50)   DEFAULT NULL            COMMENT '版本',
  `accuracy`     DECIMAL(5,2)  DEFAULT NULL            COMMENT '平均准确率(%)',
  `hit_rate`     DECIMAL(5,2)  DEFAULT NULL            COMMENT '命中率(%)',
  `call_count`   BIGINT        DEFAULT 0               COMMENT '调用次数',
  `response_time` VARCHAR(50)  DEFAULT NULL            COMMENT '平均响应时长(ms)',
  `last_call_time` DATETIME    DEFAULT NULL            COMMENT '最近调用时间',
  `train_cycle`  VARCHAR(20)   DEFAULT NULL            COMMENT '训练周期（每周/每月/每季度/手动）',
  `data_range`   VARCHAR(20)   DEFAULT NULL            COMMENT '数据范围（最近1年/3年/5年/全部）',
  `last_train_time` DATETIME   DEFAULT NULL            COMMENT '最近训练时间',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_model_config_code` (`model_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模型配置';

-- 模型阈值配置（model_config.html 阈值Tab）

DROP TABLE IF EXISTS `sf_model_threshold`;
CREATE TABLE `sf_model_threshold` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `threshold_key` VARCHAR(50)  NOT NULL                COMMENT '阈值键（pest_high/pest_mid/yield_confidence/temp_deviation/phenology_offset/price_fluctuation）',
  `threshold_name` VARCHAR(100) DEFAULT NULL           COMMENT '阈值名称',
  `threshold_value` VARCHAR(50) DEFAULT NULL           COMMENT '阈值',
  `unit`         VARCHAR(20)   DEFAULT NULL            COMMENT '单位',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_model_threshold_key` (`threshold_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模型阈值配置';

-- 物候期配置（model_phenology.html）

DROP TABLE IF EXISTS `sf_phenology_stage`;
CREATE TABLE `sf_phenology_stage` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `stage_name`   VARCHAR(100)  NOT NULL                COMMENT '物候期名称',
  `variety`      VARCHAR(100)  DEFAULT NULL            COMMENT '适用品种',
  `start_date`   VARCHAR(20)   DEFAULT NULL            COMMENT '起始日期（MM-DD）',
  `end_date`     VARCHAR(20)   DEFAULT NULL            COMMENT '结束日期（MM-DD）',
  `sort_order`   INT           DEFAULT 0               COMMENT '排序',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='物候期配置';

-- 地块病虫害风险（model_pest.html）

DROP TABLE IF EXISTS `sf_pest_risk`;
CREATE TABLE `sf_pest_risk` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `plot_id`      BIGINT        DEFAULT NULL            COMMENT '地块（→ sf_plot.id）',
  `variety`      VARCHAR(100)  DEFAULT NULL            COMMENT '主栽品种',
  `pest_type`    VARCHAR(100)  DEFAULT NULL            COMMENT '病虫害类型',
  `risk_index`   INT           DEFAULT NULL            COMMENT '风险指数',
  `risk_level`   VARCHAR(20)   DEFAULT NULL            COMMENT '风险等级（高/中/低）',
  `manager`      VARCHAR(100)  DEFAULT NULL            COMMENT '责任人',
  `suggestion`   VARCHAR(500)  DEFAULT NULL            COMMENT '防治建议',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_pest_risk_plot` (`plot_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='地块病虫害风险';

-- 产量预估（model_yield.html）

DROP TABLE IF EXISTS `sf_yield_forecast`;
CREATE TABLE `sf_yield_forecast` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `plot_id`      BIGINT        DEFAULT NULL            COMMENT '地块（→ sf_plot.id）',
  `variety`      VARCHAR(100)  DEFAULT NULL            COMMENT '品种',
  `area`         DECIMAL(12,2) DEFAULT NULL            COMMENT '面积',
  `forecast_yield` DECIMAL(12,2) DEFAULT NULL          COMMENT '预估产量',
  `last_year_yield` DECIMAL(12,2) DEFAULT NULL         COMMENT '上年度实采',
  `deviation_rate` DECIMAL(5,2) DEFAULT NULL           COMMENT '偏差率(%)',
  `confidence`   DECIMAL(5,2)  DEFAULT NULL            COMMENT '置信度(%)',
  `status`       VARCHAR(20)   DEFAULT NULL            COMMENT '状态',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_yield_forecast_plot` (`plot_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产量预估';

-- 商城管理模块（mall_product / mall_promotion / mall_coupon /
--              mall_category / mall_decoration / mall_order /
--              mall_aftersale / mall_invoice / mall_freight /
--              mall_member / mall_points / mall_community /
--              mall_notice）

-- 商品（mall_product.html）

-- ============================================================
-- 【商城管理（商品 / 促销 / 优惠券 / 订单 / 会员 / 社区等）】
-- ============================================================
DROP TABLE IF EXISTS `sf_mall_product`;
CREATE TABLE `sf_mall_product` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `product_code` VARCHAR(50)   NOT NULL                COMMENT '商品编码（唯一）',
  `product_name` VARCHAR(200)  NOT NULL                COMMENT '商品名称',
  `category_id`  BIGINT        DEFAULT NULL            COMMENT '分类（→ sf_mall_category.id）',
  `variety`      VARCHAR(100)  DEFAULT NULL            COMMENT '品种',
  `spec`         VARCHAR(100)  DEFAULT NULL            COMMENT '规格',
  `price`        DECIMAL(12,2) DEFAULT NULL            COMMENT '售价',
  `stock`        INT           DEFAULT NULL            COMMENT '库存',
  `file_id`      BIGINT        DEFAULT NULL            COMMENT '商品图（→ sf_file.id）',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'on'   COMMENT '状态：on在售/off下架',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mall_product_code` (`product_code`),
  KEY `idx_mall_product_category` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商城商品';

-- 商品分类（mall_category.html 分类Tab）

DROP TABLE IF EXISTS `sf_mall_category`;
CREATE TABLE `sf_mall_category` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `category_code` VARCHAR(50)  NOT NULL                COMMENT '分类编码（唯一）',
  `category_name` VARCHAR(100) NOT NULL                COMMENT '分类名称',
  `product_count` INT          DEFAULT 0               COMMENT '商品数',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态',
  `sort_order`   INT           DEFAULT 0               COMMENT '排序',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mall_category_code` (`category_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商城商品分类';

-- 苹果品种（mall_category.html 品种Tab）

DROP TABLE IF EXISTS `sf_mall_variety`;
CREATE TABLE `sf_mall_variety` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `variety_code` VARCHAR(50)   NOT NULL                COMMENT '品种编码（唯一）',
  `variety_name` VARCHAR(100)  NOT NULL                COMMENT '品种名称',
  `product_count` INT          DEFAULT 0               COMMENT '商品数',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mall_variety_code` (`variety_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商城苹果品种';

-- 促销活动（mall_promotion.html）

DROP TABLE IF EXISTS `sf_mall_promotion`;
CREATE TABLE `sf_mall_promotion` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `promotion_name` VARCHAR(100) NOT NULL               COMMENT '活动名称',
  `promotion_type` VARCHAR(20) DEFAULT NULL            COMMENT '类型',
  `product_ids`  VARCHAR(500)  DEFAULT NULL            COMMENT '关联商品/范围',
  `price_range`  VARCHAR(100)  DEFAULT NULL            COMMENT '价格区间',
  `position`     VARCHAR(20)   DEFAULT NULL            COMMENT '展示位置（首页最新活动/商品页活动）',
  `start_date`   DATE          DEFAULT NULL            COMMENT '开始日期',
  `end_date`     DATE          DEFAULT NULL            COMMENT '结束日期',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态：active/stopped/ended',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商城促销活动';

-- 优惠券（mall_coupon.html）

DROP TABLE IF EXISTS `sf_mall_coupon`;
CREATE TABLE `sf_mall_coupon` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `coupon_name`  VARCHAR(100)  NOT NULL                COMMENT '优惠券名称',
  `coupon_type`  VARCHAR(20)   DEFAULT NULL            COMMENT '类型（满减券/折扣券）',
  `threshold`    VARCHAR(100)  DEFAULT NULL            COMMENT '使用门槛',
  `discount`     VARCHAR(100)  DEFAULT NULL            COMMENT '优惠规则',
  `total_count`  INT           DEFAULT NULL            COMMENT '发放量',
  `used_count`   INT           DEFAULT 0               COMMENT '核销量',
  `per_limit`    INT           DEFAULT NULL            COMMENT '每人限领',
  `valid_start`  DATE          DEFAULT NULL            COMMENT '有效期起',
  `valid_end`    DATE          DEFAULT NULL            COMMENT '有效期止',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商城优惠券';

-- 首页装修-轮播图（mall_decoration.html）

DROP TABLE IF EXISTS `sf_mall_banner`;
CREATE TABLE `sf_mall_banner` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name`         VARCHAR(100)  DEFAULT NULL            COMMENT '名称',
  `file_id`      BIGINT        DEFAULT NULL            COMMENT '图片（→ sf_file.id）',
  `jump_link`    VARCHAR(255)  DEFAULT NULL            COMMENT '跳转链接',
  `sort_order`   INT           DEFAULT 0               COMMENT '排序',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='首页轮播图';

-- 首页装修-快捷入口（mall_decoration.html）

DROP TABLE IF EXISTS `sf_mall_quick_entry`;
CREATE TABLE `sf_mall_quick_entry` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name`         VARCHAR(100)  DEFAULT NULL            COMMENT '名称',
  `icon`         VARCHAR(100)  DEFAULT NULL            COMMENT '图标',
  `title`        VARCHAR(200)  DEFAULT NULL            COMMENT '标题/副标题',
  `badge`        VARCHAR(50)   DEFAULT NULL            COMMENT '角标',
  `jump_link`    VARCHAR(255)  DEFAULT NULL            COMMENT '跳转链接',
  `sort_order`   INT           DEFAULT 0               COMMENT '排序',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='首页快捷入口';

-- C端订单（mall_order.html）

DROP TABLE IF EXISTS `sf_mall_order`;
CREATE TABLE `sf_mall_order` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_code`   VARCHAR(50)   NOT NULL                COMMENT '订单号（唯一）',
  `member_id`    BIGINT        DEFAULT NULL            COMMENT '会员（→ sf_mall_member.id）',
  `member_name`  VARCHAR(100)  DEFAULT NULL            COMMENT '会员昵称',
  `product_info` VARCHAR(1000) DEFAULT NULL           COMMENT '商品明细',
  `amount`       DECIMAL(14,2) DEFAULT NULL            COMMENT '金额',
  `pay_way`      VARCHAR(50)   DEFAULT NULL            COMMENT '支付方式',
  `address`      VARCHAR(255)  DEFAULT NULL            COMMENT '收货地址',
  `order_time`   DATETIME      DEFAULT NULL            COMMENT '下单时间',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态：pending/to_ship/done/refunded/cancelled',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mall_order_code` (`order_code`),
  KEY `idx_mall_order_member` (`member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商城C端订单';

-- 商城售后（mall_aftersale.html）

DROP TABLE IF EXISTS `sf_mall_aftersale`;
CREATE TABLE `sf_mall_aftersale` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `aftersale_code` VARCHAR(50) NOT NULL                COMMENT '售后单号（唯一）',
  `order_id`     BIGINT        DEFAULT NULL            COMMENT '订单（→ sf_mall_order.id）',
  `member_name`  VARCHAR(100)  DEFAULT NULL            COMMENT '会员',
  `aftersale_type` VARCHAR(20) DEFAULT NULL            COMMENT '类型',
  `refund_amount` DECIMAL(14,2) DEFAULT NULL           COMMENT '退款金额',
  `reason`       VARCHAR(500)  DEFAULT NULL            COMMENT '原因',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态：pending/refunding/refunded/rejected',
  `reject_reason` VARCHAR(500) DEFAULT NULL            COMMENT '驳回原因',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mall_aftersale_code` (`aftersale_code`),
  KEY `idx_mall_aftersale_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商城售后';

-- 发票（mall_invoice.html）

DROP TABLE IF EXISTS `sf_mall_invoice`;
CREATE TABLE `sf_mall_invoice` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `invoice_code` VARCHAR(50)   NOT NULL                COMMENT '发票编号（唯一）',
  `order_id`     BIGINT        DEFAULT NULL            COMMENT '关联订单（→ sf_mall_order.id）',
  `invoice_type` VARCHAR(20)   DEFAULT NULL            COMMENT '类型（电子普通/增值税专用）',
  `title`        VARCHAR(200)  DEFAULT NULL            COMMENT '发票抬头',
  `title_type`   VARCHAR(20)   DEFAULT NULL            COMMENT '抬头类型',
  `amount`       DECIMAL(14,2) DEFAULT NULL            COMMENT '金额',
  `apply_time`   DATETIME      DEFAULT NULL            COMMENT '申请时间',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态：pending/issued/rejected',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mall_invoice_code` (`invoice_code`),
  KEY `idx_mall_invoice_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商城发票';

-- 运费模板（mall_freight.html）

DROP TABLE IF EXISTS `sf_mall_freight`;
CREATE TABLE `sf_mall_freight` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `template_name` VARCHAR(100) NOT NULL                COMMENT '模板名称',
  `cover_region` VARCHAR(255)  DEFAULT NULL            COMMENT '覆盖区域',
  `first_count`  INT           DEFAULT NULL            COMMENT '首件数',
  `first_price`  DECIMAL(12,2) DEFAULT NULL            COMMENT '首件价格',
  `continue_count` INT         DEFAULT NULL            COMMENT '续件数',
  `continue_price` DECIMAL(12,2) DEFAULT NULL          COMMENT '续件价格',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商城运费模板';

-- 会员（mall_member.html / mall_points.html）

DROP TABLE IF EXISTS `sf_mall_member`;
CREATE TABLE `sf_mall_member` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `member_code`  VARCHAR(50)   NOT NULL                COMMENT '会员编号（唯一）',
  `nickname`     VARCHAR(100)  DEFAULT NULL            COMMENT '会员昵称',
  `phone`        VARCHAR(20)   DEFAULT NULL            COMMENT '手机号（登录账号）',
  `password`     VARCHAR(100)  DEFAULT NULL            COMMENT '密码哈希（bcrypt）',
  `level`        VARCHAR(20)   NOT NULL DEFAULT 'normal' COMMENT '等级：vip/gold/normal',
  `points`       INT           DEFAULT 0               COMMENT '积分',
  `order_count`  INT           DEFAULT 0               COMMENT '订单数',
  `total_consume` DECIMAL(14,2) DEFAULT NULL           COMMENT '消费总额',
  `favorite_count` INT         DEFAULT 0               COMMENT '收藏',
  `adoption_count` INT         DEFAULT 0               COMMENT '认养',
  `register_time` DATETIME     DEFAULT NULL            COMMENT '注册时间',
  `last_order_time` DATETIME   DEFAULT NULL            COMMENT '最近下单',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mall_member_code` (`member_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商城会员';

-- 会员等级规则（mall_points.html 等级规则）

DROP TABLE IF EXISTS `sf_mall_level_rule`;
CREATE TABLE `sf_mall_level_rule` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `level`        VARCHAR(20)   NOT NULL                COMMENT '等级（vip/gold/normal）',
  `level_name`   VARCHAR(50)   DEFAULT NULL            COMMENT '等级名称',
  `threshold`    DECIMAL(14,2) DEFAULT NULL            COMMENT '消费门槛',
  `points_ratio` DECIMAL(5,2)  DEFAULT NULL            COMMENT '消费积分比例',
  `points_offset_ratio` DECIMAL(5,2) DEFAULT NULL      COMMENT '积分抵扣比例',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mall_level_rule_level` (`level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员等级规则';

-- 社区内容（mall_community.html）

DROP TABLE IF EXISTS `sf_mall_post`;
CREATE TABLE `sf_mall_post` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `author`       VARCHAR(100)  DEFAULT NULL            COMMENT '作者',
  `content`      TEXT          DEFAULT NULL            COMMENT '动态内容',
  `like_count`   INT           DEFAULT 0               COMMENT '点赞数',
  `comment_count` INT          DEFAULT 0               COMMENT '评论数',
  `publish_time` DATETIME      DEFAULT NULL            COMMENT '发布时间',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态：pending/published/rejected',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='社区内容';

-- 消息通知模板（mall_notice.html）

DROP TABLE IF EXISTS `sf_mall_notice`;
CREATE TABLE `sf_mall_notice` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `trigger_scene` VARCHAR(50)  DEFAULT NULL            COMMENT '触发场景（支付成功/订单发货/订单退款/活动开始/系统通知）',
  `title`        VARCHAR(200)  DEFAULT NULL            COMMENT '标题',
  `content`      TEXT          DEFAULT NULL            COMMENT '内容',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息通知模板';

-- 移动端运营模块（mb_staff_account / mb_feedback_review /
--               mb_expert_reply / mb_message / mb_sync_queue /
--               mb_news / mb_ai_config / mb_disease_config /
--               mb_fault_knowledge）

-- 作业人员账号（mb_staff_account.html）

-- ============================================================
-- 【移动端运营（作业账号 / 反馈 / 咨询 / 消息 / 资讯 / AI / 知识库）】
-- ============================================================
DROP TABLE IF EXISTS `sf_mb_staff_account`;
CREATE TABLE `sf_mb_staff_account` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `account`      VARCHAR(50)   NOT NULL                COMMENT '登录账号（唯一）',
  `password`     VARCHAR(200)  NOT NULL                COMMENT '密码（SHA-256摘要）',
  `real_name`    VARCHAR(100)  DEFAULT NULL            COMMENT '作业人员姓名',
  `phone`        VARCHAR(20)   DEFAULT NULL            COMMENT '手机号',
  `role`         VARCHAR(20)   DEFAULT NULL            COMMENT '角色（管理员/果农/访客）',
  `base_id`      BIGINT        DEFAULT NULL            COMMENT '所属基地（→ sf_base.id）',
  `is_expert`    TINYINT       NOT NULL DEFAULT 0      COMMENT '农技专家标识（0/1）',
  `expertise`    VARCHAR(200)  DEFAULT NULL            COMMENT '专长',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态：active/disabled',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mb_staff_account` (`account`),
  KEY `idx_mb_staff_base` (`base_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='作业人员账号';

-- 意见反馈（mb_feedback_review.html）

DROP TABLE IF EXISTS `sf_mb_feedback`;
CREATE TABLE `sf_mb_feedback` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title`        VARCHAR(200)  NOT NULL                COMMENT '反馈标题',
  `content`      TEXT          DEFAULT NULL            COMMENT '反馈内容',
  `feedback_type` VARCHAR(20)  DEFAULT NULL            COMMENT '类型（3类）',
  `source`       VARCHAR(20)   DEFAULT NULL            COMMENT '来源端（移动端/H5消费者端）',
  `submitter`    VARCHAR(100)  DEFAULT NULL            COMMENT '提交人',
  `submit_time`  DATETIME      DEFAULT NULL            COMMENT '提交时间',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态（4态）',
  `conclusion`   VARCHAR(20)   DEFAULT NULL            COMMENT '处理结论（3类）',
  `reply`        TEXT          DEFAULT NULL            COMMENT '官方回复',
  `reject_reason` VARCHAR(500) DEFAULT NULL            COMMENT '驳回原因',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='意见反馈';

-- 专家咨询（mb_expert_reply.html）

DROP TABLE IF EXISTS `sf_mb_expert_consult`;
CREATE TABLE `sf_mb_expert_consult` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title`        VARCHAR(200)  NOT NULL                COMMENT '问题标题',
  `content`      TEXT          DEFAULT NULL            COMMENT '问题内容',
  `questioner`   VARCHAR(100)  DEFAULT NULL            COMMENT '提问人',
  `question_time` DATETIME     DEFAULT NULL            COMMENT '提问时间',
  `expert_id`    BIGINT        DEFAULT NULL            COMMENT '指派专家（→ sf_mb_staff_account.id）',
  `expert_reply` TEXT          DEFAULT NULL            COMMENT '专家答复',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态：pending/replied',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_mb_expert_consult_expert` (`expert_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='专家咨询';

-- 消息推送（mb_message.html）

DROP TABLE IF EXISTS `sf_mb_message`;
CREATE TABLE `sf_mb_message` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title`        VARCHAR(200)  NOT NULL                COMMENT '标题',
  `content`      TEXT          DEFAULT NULL            COMMENT '内容',
  `category`     VARCHAR(50)   DEFAULT NULL            COMMENT '分类',
  `target`       VARCHAR(20)   DEFAULT NULL            COMMENT '面向对象（mobile/all）',
  `publisher`    VARCHAR(100)  DEFAULT NULL            COMMENT '发布人',
  `publish_time` DATETIME      DEFAULT NULL            COMMENT '发布时间',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '启用状态',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息推送';

-- 同步队列（mb_sync_queue.html）

DROP TABLE IF EXISTS `sf_mb_sync_queue`;
CREATE TABLE `sf_mb_sync_queue` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `sync_type`    VARCHAR(50)   DEFAULT NULL            COMMENT '同步类型',
  `record_id`    VARCHAR(100)  DEFAULT NULL            COMMENT '关联记录ID',
  `payload`      TEXT          DEFAULT NULL            COMMENT '载荷摘要',
  `enqueue_time` DATETIME      DEFAULT NULL            COMMENT '入队时间',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态：pending/synced/failed',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_mb_sync_queue_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='同步队列';

-- 资讯（mb_news.html）

DROP TABLE IF EXISTS `sf_mb_news`;
CREATE TABLE `sf_mb_news` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title`        VARCHAR(200)  NOT NULL                COMMENT '资讯标题',
  `category`     VARCHAR(50)   DEFAULT NULL            COMMENT '分类（公告/培训/技术/政策）',
  `summary`      VARCHAR(500)  DEFAULT NULL            COMMENT '摘要',
  `content`      TEXT          DEFAULT NULL            COMMENT '正文',
  `cover_file_id` BIGINT       DEFAULT NULL            COMMENT '封面（→ sf_file.id）',
  `author`       VARCHAR(100)  DEFAULT NULL            COMMENT '作者',
  `source`       VARCHAR(100)  DEFAULT NULL            COMMENT '来源',
  `read_count`   INT           DEFAULT 0               COMMENT '阅读量',
  `publisher`    VARCHAR(100)  DEFAULT NULL            COMMENT '发布人',
  `publish_time` DATETIME      DEFAULT NULL            COMMENT '发布时间',
  `is_top`       TINYINT       NOT NULL DEFAULT 0      COMMENT '置顶（0/1）',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'published' COMMENT '状态：published/offline',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资讯';

-- AI助手分类（mb_ai_config.html）

DROP TABLE IF EXISTS `sf_mb_ai_category`;
CREATE TABLE `sf_mb_ai_category` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `category_name` VARCHAR(100) NOT NULL                COMMENT '分类名称',
  `category_id`  VARCHAR(50)   DEFAULT NULL            COMMENT '分类ID',
  `description`  VARCHAR(500)  DEFAULT NULL            COMMENT '描述',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI助手分类';

-- AI助手热门问题（mb_ai_config.html）

DROP TABLE IF EXISTS `sf_mb_ai_question`;
CREATE TABLE `sf_mb_ai_question` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `category_id`  BIGINT        DEFAULT NULL            COMMENT '所属分类（→ sf_mb_ai_category.id）',
  `question`     VARCHAR(500)  NOT NULL                COMMENT '问题内容',
  `related_question` VARCHAR(500) DEFAULT NULL         COMMENT '关联问题',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_mb_ai_question_category` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI助手热门问题';

-- 识别规则配置（mb_disease_config.html）

DROP TABLE IF EXISTS `sf_mb_disease_rule`;
CREATE TABLE `sf_mb_disease_rule` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `disease_name` VARCHAR(100)  NOT NULL                COMMENT '病害名称',
  `match_keywords` VARCHAR(500) DEFAULT NULL           COMMENT '匹配关键字（任一命中）',
  `confidence`   DECIMAL(5,2)  DEFAULT NULL            COMMENT '置信度(%)',
  `risk_level`   VARCHAR(20)   DEFAULT NULL            COMMENT '风险等级（高/中/低）',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='病害识别规则';

-- 设备故障知识库（mb_fault_knowledge.html）

DROP TABLE IF EXISTS `sf_mb_fault_kb`;
CREATE TABLE `sf_mb_fault_kb` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `fault_title`  VARCHAR(200)  NOT NULL                COMMENT '故障标题',
  `device_type`  VARCHAR(50)   DEFAULT NULL            COMMENT '设备类型',
  `category`     VARCHAR(50)   DEFAULT NULL            COMMENT '分类（灌溉/传感器/气象/摄像头/无人机/其他）',
  `urgency`      VARCHAR(20)   DEFAULT NULL            COMMENT '紧急程度（3档）',
  `step_count`   INT           DEFAULT 0               COMMENT '步骤数',
  `steps`        TEXT          DEFAULT NULL            COMMENT '排查步骤',
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备故障知识库';

-- ============================================================
-- 【系统管理（部门 / 岗位 / 角色 / 用户 / 菜单 / 权限 / 配置 / 通知）】
-- ============================================================
DROP TABLE IF EXISTS `sf_dept`;
CREATE TABLE `sf_dept` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `parent_id`   BIGINT       NOT NULL DEFAULT 0      COMMENT '父部门（顶级为 0）',
  `dept_name`   VARCHAR(100) NOT NULL                COMMENT '部门名称',
  `sort_order`  INT          NOT NULL DEFAULT 0      COMMENT '排序',
  `manager`     VARCHAR(50)  DEFAULT NULL            COMMENT '负责人',
  `phone`       VARCHAR(20)  DEFAULT NULL            COMMENT '联系电话',
  `email`       VARCHAR(100) DEFAULT NULL            COMMENT '邮箱',
  `dept_status` VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT '状态：active/disabled',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  `is_deleted`  TINYINT      NOT NULL DEFAULT 0      COMMENT '逻辑删除：0=正常 1=已删除',
  PRIMARY KEY (`id`),
  KEY `idx_dept_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部门';

DROP TABLE IF EXISTS `sf_post`;
CREATE TABLE `sf_post` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `post_code`   VARCHAR(50)  NOT NULL                COMMENT '岗位编码',
  `post_name`   VARCHAR(100) NOT NULL                COMMENT '岗位名称',
  `sort_order`  INT          NOT NULL DEFAULT 0      COMMENT '岗位顺序',
  `post_status` VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT '状态',
  `remark`      VARCHAR(255) DEFAULT NULL            COMMENT '备注',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  `is_deleted`  TINYINT      NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_post_code` (`post_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='岗位';

DROP TABLE IF EXISTS `sf_role`;
CREATE TABLE `sf_role` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `role_name`   VARCHAR(50)  NOT NULL                COMMENT '角色名称',
  `role_code`   VARCHAR(50)  NOT NULL                COMMENT '角色代码',
  `description` VARCHAR(255) DEFAULT NULL            COMMENT '描述',
  `role_status` VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  `is_deleted`  TINYINT      NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_code` (`role_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色';

DROP TABLE IF EXISTS `sf_user`;
CREATE TABLE `sf_user` (
  `id`            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `username`      VARCHAR(50)  NOT NULL                COMMENT '账号',
  `password`      VARCHAR(100) NOT NULL                COMMENT '密码哈希（bcrypt）',
  `real_name`     VARCHAR(50)  DEFAULT NULL            COMMENT '姓名',
  `phone`         VARCHAR(11)  DEFAULT NULL            COMMENT '手机号',
  `avatar_file_id` BIGINT      DEFAULT NULL            COMMENT '头像（→ sf_file.id）',
  `dept_id`       BIGINT       DEFAULT NULL            COMMENT '部门（→ sf_dept.id）',
  `post_id`       BIGINT       DEFAULT NULL            COMMENT '岗位（→ sf_post.id）',
  `role_id`       BIGINT       DEFAULT NULL            COMMENT '角色（→ sf_role.id）',
  `base_id`       BIGINT       DEFAULT NULL            COMMENT '所属基地（→ sf_base.id）',
  `user_status`   VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT '状态：active/disabled',
  `last_login_at` DATETIME     DEFAULT NULL            COMMENT '最后登录时间',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT      NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_username` (`username`),
  UNIQUE KEY `uk_user_phone` (`phone`),
  KEY `idx_user_dept` (`dept_id`),
  KEY `idx_user_role` (`role_id`),
  KEY `idx_user_base` (`base_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户';

DROP TABLE IF EXISTS `sf_menu`;
CREATE TABLE `sf_menu` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `parent_id`   BIGINT       NOT NULL DEFAULT 0      COMMENT '父菜单（顶级为 0）',
  `menu_name`   VARCHAR(100) NOT NULL                COMMENT '菜单名称',
  `menu_type`   VARCHAR(20)  NOT NULL DEFAULT 'menu' COMMENT '目录/菜单/按钮',
  `perm_code`   VARCHAR(100) DEFAULT NULL            COMMENT '权限标识',
  `route`       VARCHAR(255) DEFAULT NULL            COMMENT '路由地址',
  `menu_status` VARCHAR(20)  NOT NULL DEFAULT 'normal' COMMENT '状态',
  `sort_order`  INT          NOT NULL DEFAULT 0      COMMENT '排序',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  `is_deleted`  TINYINT      NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_menu_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='菜单';

DROP TABLE IF EXISTS `sf_role_menu`;
CREATE TABLE `sf_role_menu` (
  `id`          BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `role_id`     BIGINT NOT NULL                COMMENT '角色',
  `menu_id`     BIGINT NOT NULL                COMMENT '菜单',
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`  TINYINT  NOT NULL DEFAULT 0    COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_rm_role` (`role_id`),
  KEY `idx_rm_menu` (`menu_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色-菜单关联';

DROP TABLE IF EXISTS `sf_permission`;
CREATE TABLE `sf_permission` (
  `id`          BIGINT      NOT NULL AUTO_INCREMENT COMMENT '主键',
  `menu_id`     BIGINT      DEFAULT NULL            COMMENT '所属菜单',
  `perm_code`   VARCHAR(50) NOT NULL                COMMENT '权限点：view/add/edit/delete/export',
  `perm_name`   VARCHAR(50) NOT NULL                COMMENT '权限名',
  `created_at`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`  TINYINT     NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  KEY `idx_perm_menu` (`menu_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='权限点';

-- 对应页面：系统设置 · 系统配置 Tab
-- 表列：序号 / 数据源名称 / 类型 / 协议 / 接入地址 / 采集频率 / 状态

DROP TABLE IF EXISTS `sf_system_config`;
CREATE TABLE `sf_system_config` (
  `id`            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `source_name`   VARCHAR(100) NOT NULL                COMMENT '数据源名称',
  `source_type`   VARCHAR(50)  DEFAULT NULL            COMMENT '类型（→ sf_dict）',
  `protocol`      VARCHAR(50)  DEFAULT NULL            COMMENT '协议（如 mqtt/http）',
  `access_url`    VARCHAR(255) DEFAULT NULL            COMMENT '接入地址',
  `collect_freq`  VARCHAR(50)  DEFAULT NULL            COMMENT '采集频率',
  `config_status` VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT '状态：active/disabled',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT      NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置（数据源）';

-- 对应页面：用户设置 · 通知设置 Tab
-- 通知项：设备预警 / 农事预警 / 运营日报 / 运营周报 / 站内消息 / 邮件 / 短信

DROP TABLE IF EXISTS `sf_notification`;
CREATE TABLE `sf_notification` (
  `id`         BIGINT      NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`    BIGINT      NOT NULL                COMMENT '用户（→ sf_user.id）',
  `notice_code` VARCHAR(50) NOT NULL               COMMENT '通知项编码：device_alert/farming_alert/daily_report/weekly_report/inbox/email/sms',
  `enabled`    TINYINT     NOT NULL DEFAULT 1      COMMENT '是否开启：0=关 1=开',
  `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` TINYINT     NOT NULL DEFAULT 0      COMMENT '逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notice_user_code` (`user_id`, `notice_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知设置';

SET FOREIGN_KEY_CHECKS = 1;
