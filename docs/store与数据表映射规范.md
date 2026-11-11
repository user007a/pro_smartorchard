# Store 与数据表映射规范（前后端打通参照模板）

> 本文档是「前端 store 数据模型 ↔ 数据库表」字段映射的统一规范，是后续打通后端、替换 localStorage 的**唯一权威参照**。
>
> 以「设备模块」为样板，其他 16 个模块照此模板执行。

---

## 一、核心原则（策略 A：出入口映射）

1. **保留 store 内部逻辑零改动**：store 里的验证、派生计算、联动、审计、通知（`broadcast`/`subscribe`）全部保留。
2. **只在两个出入口替换**：
   - `load()`：原「读 localStorage」→ 改为「调后端 API 拉取各表数据 → 组装成 store 聚合对象」
   - `save()`：原「写 localStorage」→ 改为「把 store 聚合对象拆成各表 → 调后端 API 批量保存」
3. **字段命名转换**：store 字段（驼峰 `camelCase`）↔ 表字段（下划线 `snake_case`），由 store 内的映射函数负责，**不改表名、不改列名**。
4. **主键语义**：数据库表用自增 `id` 做物理主键，store 里的业务编号（如 `D-001`）映射到表里的 `*_code` 业务编码列（唯一约束）。store 的 `item.id` ↔ 表的 `*_code`。
5. **引用存 ID**：store 里存名称/编号的引用字段，入库时优先存外键 ID（已有 ID 则存 ID，无 ID 则存业务编码字符串，见「引用三分法」）。

---

## 二、设备模块映射总表（12 子数组 ↔ 13 张表）

| store 子数组 | 数据库表 | 说明 |
|---|---|---|
| `access` | `sf_device_access` | 接入配置 |
| `gateways` | `sf_gateway` | 网关与协议 |
| `cameras` | `sf_video_channel` | 视频监控通道 |
| `devices` | `sf_device` | 设备台账 |
| `maintains` | `sf_device_maintain` | 维护工单 |
| `logs` | `sf_device_log` | 设备日志 |
| `calibrations` | `sf_device_calibration` | 校准检定 |
| `spares` | `sf_device_spare` | 备品备件 |
| `assets` | `sf_device_asset` | 资产盘点 |
| `commands` | `sf_device_command` | 远程指令 |
| `models` | `sf_device_type` + `sf_device_measure` | 物模型（主表 + 测点子表） |
| `audits` | `sf_device_audit` | 操作审计 |

> 注意：`models` 子数组是「物模型字典」，对应数据库两张表——`sf_device_type`（类型主表）+ `sf_device_measure`（每个类型的测点明细）。store 里一个 model 对象含 `points` 数组，入库时拆成 1 条 type + N 条 measure。

---

## 三、逐表字段映射（store 字段 → 表字段）

### 3.1 `devices` → `sf_device`（设备台账）

| store 字段（camelCase） | 表字段（snake_case） | 类型/说明 |
|---|---|---|
| `id`（如 D-001） | `device_code` | 业务编号，唯一约束 `uk_device_code` |
| `name` | `device_name` | 设备名称 |
| `type`（code） | `device_type` | 设备类型 code（21 类字典） |
| `base`（基地名） | `base_id` | 外键 → sf_base.id（入库时按名称查 ID） |
| `plotId` | `plot_id` | 外键 → sf_plot.id |
| `location` | `location` | 安装位置 |
| `status` | `run_status` | online/maintain/offline |
| `assetStatus` | `asset_status` | 资产状态 |
| `vendor` | `vendor` | 厂商 |
| `model` | `model` | 型号 |
| `sn` | `sn` | 序列号 |
| `firmware` | `firmware` | 固件 |
| `ip` | `ip` | IP |
| `protocol` | `protocol` | 协议 |
| `power` | `power` | 供电 |
| `owner` | `owner` | 负责人 |
| `supplier` | `supplier` | 供应商 |
| `disposalWay` | `disposal_way` | 处置方式 |
| `installDate` | `install_date` | 安装日期 |
| `enableDate` | `enable_date` | 启用日期 |
| `warrantyUntil` | `warranty_until` | 质保到期 |
| `purchaseAmount`（万元） | `purchase_amount`（元） | **单位换算：×10000** |
| `usefulYears` | `useful_years` | 使用寿命 |
| `maintainCycle` | `maintain_cycle` | 维保周期 |
| `nextMaintainDate` | `next_maintain` | 下次保养 |
| `lastMaintainDate` | `last_maintain_date` | 最近维护 |
| `calibrateCycle` | `calibrate_cycle` | 校准周期 |
| `lastCalibrateDate` | `last_calibrate_date` | 最近校准 |
| `runningHours` | `running_hours` | 运行时长 |
| `faultCount` | `fault_count` | 故障次数 |
| `onlineRate` | `online_rate` | 在线率 |
| `uptimeRate` | `uptime_rate` | 稼动率 |
| `collectCount` | `collect_count` | 采集条数 |
| `lastSeenAt` | `last_seen_at` | 最近上线 |
| `remark` | `remark` | 备注 |
| `createdAt`/`updatedAt` | `created_at`/`updated_at` | 由后端自动管理 |
| `readings`（实时读数） | **不落库** | 运行时派生，由设备上报，不入表 |

### 3.2 `access` → `sf_device_access`（接入配置）

| store 字段 | 表字段 | 说明 |
|---|---|---|
| `id` | `config_code` | 配置编号 |
| `deviceName` | —（冗余） | 由 `device_id` 关联查询 |
| `deviceId` | `device_id` | 外键 → sf_device.id |
| `base`（基地名） | `base_id` | 外键 |
| `accessWay` | `access_way` | 接入方式 |
| `gatewayId` | `gateway_id` | 外键 → sf_gateway.id |
| `endpoint` | `access_address` | 接入地址 |
| `freq` | `collect_frequency` | 采集频率 |
| `timeout` | `timeout` | 超时 |
| `points`（数组） | `measure_points`（逗号串） | **数组 → 逗号分隔字符串** |
| `direction` | `direction` | 方向 |
| `status` | `status` | connected/abnormal/disconnected |
| `remark` | `remark` | 备注 |

### 3.3 `gateways` → `sf_gateway`（网关）

| store 字段 | 表字段 | 说明 |
|---|---|---|
| `id` | `gateway_code` | 网关编号 |
| `name` | `gateway_name` | 名称 |
| `model` | `model` | 型号 |
| `vendor` | `vendor` | 厂商 |
| `protocol` | `protocol` | 协议 |
| `ip` | `ip` | IP |
| `port` | `port` | 端口 |
| `username` | `account` | 账号 |
| `password` | `password` | 密码（脱敏） |
| `topicPrefix` | `topic_prefix` | Topic 前缀 |
| `heartbeat` | `heartbeat` | 心跳 |
| `maxDevices` | `max_device` | 最大接入 |
| `status` | `status` | running/unstable/offline |
| `location` | `location` | 位置 |
| `sn` | `sn` | 序列号 |
| `remark` | —（表无独立字段，可并入 location 或忽略） | 备注 |

### 3.4 `cameras` → `sf_video_channel`（视频通道）

| store 字段 | 表字段 | 说明 |
|---|---|---|
| `id` | `channel_code` | 通道编号 |
| `name` | `channel_name` | 通道名 |
| `code` | `device_code` | 设备编码 |
| `channel` | `channel_no` | 通道号 |
| `protocol` | `protocol` | 取流协议 |
| `resolution` | `resolution` | 分辨率 |
| `fps` | `frame_rate` | 帧率 |
| `stream` | `stream` | 码流 |
| `ptz` | `has_ptz` | 云台（bool→0/1） |
| `nightVision` | `night_vision` | 夜视 |
| `storageDays` | `retain_days` | 留存天数 |
| `form` | `form` | 形态 |
| `base`（基地名） | `base_id` | 外键 |
| `location` | `location` | 位置 |
| `status` | `status` | online/weak/offline |
| `url`/`platform`/`power`/`protection`/`bitrate`/`aiAbility`/`audio`/`presetCount` | **表中无** | 需评估是否补列或丢弃（见 §五） |

### 3.5 `maintains` → `sf_device_maintain`（维护工单）

| store 字段 | 表字段 | 说明 |
|---|---|---|
| `id` | `maintain_code` | 维护编号 |
| `deviceId` | `device_id` | 外键 |
| `type` | `maintain_type` | 维护类型 |
| `faultType` | `fault_category` | 故障分类 |
| `content` | `content` | 内容 |
| `manager` | `manager` | 负责人 |
| `planDate` | `plan_time` | 计划时间 |
| `workHours` | `work_hours` | 工时 |
| `downtime` | `stop_hours` | 停机 |
| `cost` | `cost` | 费用 |
| `status` | `status` | 状态 |
| `faultDesc`/`startTime`/`endTime`/`result`/`parts`/`acceptor`/`outsourced`/`priority` | **表中无** | 需评估（见 §五） |

### 3.6 `logs` → `sf_device_log`（设备日志）

| store 字段 | 表字段 | 说明 |
|---|---|---|
| `id` | —（自增） | store 的 L001 可丢弃或用 traceId |
| `time` | `log_time` | 日志时间 |
| `deviceId` | `device_id` | 外键 |
| `level` | `log_level` | info→INFO 等 |
| `type` | `log_type` | 日志类型 |
| `source` | `source` | 来源 |
| `content` | —（表无，需补） | 日志内容 |
| `point` | `measure_key` | 测点 |
| `value` | `value` | 数值 |
| `traceId` | `trace_id` | 追踪 ID |
| `status` | `handle_status` | 处理状态 |

> ⚠️ `sf_device_log` 表**缺 `content`（日志内容）字段**，需补列（见 §五）。

### 3.7 `calibrations` → `sf_device_calibration`（校准）

| store 字段 | 表字段 | 说明 |
|---|---|---|
| `id` | `calibration_code` | 校准编号 |
| `deviceId` | `device_id` | 外键 |
| `type` | `calibration_type` | 校准类型 |
| `planDate` | `plan_date` | 计划日期 |
| `actualDate` | `actual_date` | 实际日期 |
| `operator` | `executor` | 执行人 |
| `reviewer` | `reviewer` | 复核人 |
| `conclusion` | `conclusion` | 结论 |
| `nextDate` | `valid_until` | 有效期 |
| `certificate` | `cert_code` | 证书编号 |
| `result`/`content`/`deviation` | **表中无** | 需评估 |

### 3.8 `spares` → `sf_device_spare`（备件）

| store 字段 | 表字段 | 说明 |
|---|---|---|
| `id` | `spare_code` | 备件编号 |
| `name` | `spare_name` | 名称 |
| `model` | `spec` | 规格型号 |
| `deviceType` | `applicable_type` | 适用设备类型 |
| `unit` | `unit` | 单位 |
| `stock` | `current_stock` | 当前库存 |
| `safetyStock` | `safety_stock` | 安全库存 |
| `used` | `used_amount` | 已领用 |
| `price` | `price` | 单价 |
| — | `stock_value` | 库存金额（=stock×price，派生） |
| `location` | `location` | 库位 |
| — | `status` | shortage/low/enough（派生：stock<safe→shortage） |
| `vendor`/`supplier` | —（表无） | 需评估 |

### 3.9 `assets` → `sf_device_asset`（资产盘点）

| store 字段 | 表字段 | 说明 |
|---|---|---|
| `id` | `asset_code` | 盘点单号 |
| `name` | `asset_name` | 盘点名称 |
| `startDate` | `start_date` | 开始 |
| `endDate` | `end_date` | 结束 |
| `owner` | `checker` | 盘点人 |
| `total` | `should_count` | 应盘 |
| `checked` | `checked_count` | 已盘 |
| `abnormal` | `loss_count` | 盘亏 |
| `status` | `status` | done→done, abnormal→loss |
| `summary`/`remark` | —（表无） | 需评估 |
| `details`（数组） | **无对应表** | 盘点明细，需新建子表或丢弃 |

### 3.10 `commands` → `sf_device_command`（远程指令）

| store 字段 | 表字段 | 说明 |
|---|---|---|
| `id` | `command_code` | 指令编号 |
| `deviceId` | `device_id` | 外键 |
| `type` | `command_type` | 指令类型 |
| `content` | `content` | 内容 |
| `operator` | `operator` | 操作人 |
| `createTime` | `send_time` | 下发时间 |
| `status` | `status` | pending/sending/success/failed |
| `remark` | `result` | 结果摘要 |

### 3.11 `models` → `sf_device_type` + `sf_device_measure`（物模型）

| store 字段 | 表字段 | 说明 |
|---|---|---|
| `code` | `type_code` | 类型编码 |
| `name` | `type_name` | 类型名称 |
| `category` | `category` | 分类 |
| `access` | `can_access` | bool→0/1 |
| `control` | `can_control` | bool→0/1 |
| `asset` | `is_asset` | bool→0/1 |
| `maintainCycle` | `maintain_cycle` | 维保周期 |
| `calibrateCycle` | `calibrate_cycle` | 校准周期 |
| `points`（数组） | `sf_device_measure` 每条一行 | 拆成测点子表 |
| `points[].key` | `measure_key` | 测点 key |
| `points[].name` | `measure_name` | 测点名 |
| `points[].unit` | `unit` | 单位 |
| — | `range_min`/`range_max`/`step`/`precision` | 测点详情（store 里 points 有对应字段） |

### 3.12 `audits` → `sf_device_audit`（操作审计）

| store 字段 | 表字段 | 说明 |
|---|---|---|
| `time` | `operate_time` | 操作时间 |
| `action` | `operate_type` | create→新增/update→修改/delete→删除 |
| `targetType` | `object_type` | 对象类型 |
| `targetId` | `object_code` | 对象编号 |
| `operator` | `operator` | 操作人 |
| `summary` | `summary` | 摘要 |
| `before`/`after` | `before_data`/`after_data` | JSON 序列化 |

---

## 四、出入口改造伪代码

### 4.1 `load()` 改造

```js
function load() {
  // 原来：localStorage.getItem(STORAGE_KEY) → JSON.parse
  // 改为：异步拉取后端各表 → 组装聚合对象
  return Api.loadResource('device').then(function (data) {
    return {
      version: 4,
      access: data.access.map(rowToAccess),      // 表行 → store 对象
      gateways: data.gateways.map(rowToGateway),
      cameras: data.cameras.map(rowToCamera),
      devices: data.devices.map(rowToDevice),
      maintains: data.maintains.map(rowToMaintain),
      logs: data.logs.map(rowToLog),
      calibrations: data.calibrations.map(rowToCalibration),
      spares: data.spares.map(rowToSpare),
      assets: data.assets.map(rowToAsset),
      commands: data.commands.map(rowToCommand),
      models: data.models.map(rowToModel),        // 含 points 子表
      audits: data.audits.map(rowToAudit),
      updatedAt: data.updatedAt
    };
  });
}
```

### 4.2 `save()` 改造

```js
function save() {
  // 原来：localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemory))
  // 改为：拆分聚合对象 → 批量写各表
  Api.saveResource('device', {
    access: inMemory.access.map(accessToRow),
    gateways: inMemory.gateways.map(gatewayToRow),
    // ... 其余子数组
  });
}
```

---

## 五、待决策：表字段缺口清单（设备模块）

以下 store 字段**数据库表没有对应列**，需要逐项决定「补列」还是「丢弃」：

| 表 | 缺失的 store 字段 | 建议 |
|---|---|---|
| `sf_video_channel` | `url`、`platform`、`power`、`protection`、`bitrate`、`aiAbility`、`audio`、`presetCount` | 页面若展示则补列，否则丢弃 |
| `sf_device_maintain` | `faultDesc`、`startTime`、`endTime`、`result`、`parts`、`acceptor`、`outsourced`、`priority` | 同上 |
| `sf_device_log` | `content`（日志内容，**核心字段，必须补**） | 补列 |
| `sf_device_calibration` | `result`、`content`、`deviation` | 页面展示则补 |
| `sf_device_spare` | `vendor`、`supplier` | 评估 |
| `sf_device_asset` | `summary`、`remark`、`details`（明细） | summary/remark 补列，details 需新建子表 |

> **执行顺序建议**：先逐表核对页面实际展示/录入字段，确定「补列清单」，再统一改 schema + seed，最后写映射代码。

---

## 六、通用规则（适用于所有模块）

1. **数组字段**：store 里 `points: [...]` 数组字段，入库要么拆子表（1:N），要么转逗号分隔字符串。判断标准：**该数组是否要独立增删改查**。要独立操作 → 子表；仅展示 → 逗号串。
2. **布尔字段**：store `true/false` → 表 `TINYINT 0/1`。
3. **金额单位**：注意 store 与表的单位是否一致（如设备采购金额：store 万元 → 表元）。
4. **枚举值归一**：store 中文枚举值 → 表英文 code（如 `status: 'online'`、`conclusion: 'pass'` → `qualified`）。需建立枚举映射表。
5. **派生字段不落库**：`readings`（实时读数）、`healthOf`（健康度）、`stats`/`summary`（统计汇总）等运行时计算的字段，不入表。
6. **时间戳**：store 的 `createdAt`/`updatedAt` 由后端自动填充，前端不必传。
7. **逻辑删除**：所有删除操作走 `is_deleted=1`，查询统一过滤 `is_deleted=0`。

---

## 七、模块推进清单

后续按此模板逐模块执行：

| # | 模块 | store 文件 | 状态 |
|---|---|---|---|
| 1 | 设备 | `device-store.js` | ✅ 本模板已梳理 |
| 2 | 证书 | `cert-store.js` | 待梳理 |
| 3 | 生产 | `production-store.js`（若有） | 待梳理 |
| 4 | 采收 | — | 待梳理 |
| 5 | 物资 | — | 待梳理 |
| 6 | 溯源 | — | 待梳理 |
| 7 | 认养 | — | 待梳理 |
| 8 | 预警 | — | 待梳理 |
| 9 | 销售 | `sales-store.js` | 待梳理 |
| 10 | 经营分析 | `biz-store.js` | 待梳理 |
| 11 | 数据运营 | `data-store.js` | 待梳理 |
| 12 | 模型 | `model-store.js` | 待梳理 |
| 13 | 商城 | `mall-store.js` + H5 端 | 待梳理 |
| 14 | 移动端 | `mobile-ops-store.js` | 待梳理 |
| 15 | 系统管理 | — | 待梳理 |

---

> 本文档持续更新。每梳理完一个模块，将对应字段映射追加为独立章节，保持与 `schema.sql`、`seed.sql` 同步。
