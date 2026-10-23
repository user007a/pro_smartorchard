# 附录 A · 术语表

> 本表为 `docs/详细设计/` 全套文档的统一术语。**文档中出现的专有名词以此表为准。**

---

## 1. 业务术语

| 术语 | 英文 / 代码 | 说明 |
| --- | --- | --- |
| 地块 | Plot | 最小种植单位，编号形如 `D-001` |
| 果树 | Tree | 认养标的，编号统一为 `A001` 风格 |
| 基地 | Base / Org | 多个地块的集合，如「麦积区基地」 |
| 批次 | Batch | 溯源最小单位，编号形如 `PC-20260910-010` |
| 追溯码 | Trace Code | 消费者扫码查询的编码 |
| 农事计划 | Farming Plan | 预先安排的农事作业 |
| 农事记录 | Farming Record | 实际执行的农事作业（含移动端上报） |
| 农事类型 | Task Type | 疏果/套袋/喷药/灌溉/施肥 等15 种（见 `03-数据契约.md` XC-FARM-001） |
| 归一类型 | Type | 农事类型的4 类归并：`tool`/`pesticide`/`irrigation`/`fertilizer` |
| 物候期 | Phenology | 苹果生长的阶段性特征 |
| 巡园 | Patrol | 按路线巡查并打卡 |
| 巡园路线 | Patrol Route | 含基地、点位、半径、是否必到 |
| 打卡点 | Checkpoint | 巡园路线的具体点位，含经纬度与 `nearRadius` |
| 挂牌 | Tagging | 给认养果树挂物理铭牌 |
| 认养 | Adoption | 消费者购买「一棵树」权益 |
| 认养绑定 | Farming Bind | 把农事记录绑到认养树（`kind: 'farming_bind'`） |
| 溯源上链 | Anchoring | 把批次哈希写入区块链 |
| 成熟度检测 | Maturity | 采收前的成熟度评估 |
| 农资 | Material | 肥料/农药/工具，共 23 条 SKU |
| 安全库存 | safety | 库存下限，低于则 `status = danger` |
| 标签 | Label | 物理铭牌，库存以标签名为 key（L-D05） |
| 物模型 | Thing Model | 设备测点的抽象描述（`DATA_POINTS`） |
| 数据点 | Data Point | 设备的单个测点，含 `key`/`name`/`unit`/`step` |
| 网关 | Gateway | 设备接入的边缘网关（MQTT/ONVIF/Modbus TCP） |
| 视频通道 | Channel | 监控摄像头的取流通道 |
| 接入配置 | Access Config | 设备如何接入平台的配置 |
| 基地基准点 | GEO_BASE | GPS 失败时的降级坐标（天水麦积区红崖村） |
| 物候模型 | 6 大 AI 模型 | 生长/物候/气象/病虫害/产量/价格 |

---

## 2. 技术术语

| 术语 | 说明 |
| --- | --- |
| **Store** | 本地数据层，全局对象，负责读写 localStorage。本项目共 6 个 PC Store + `MobileStore` + `MobileBridge` + `H5Auth` |
| **契约（Contract）** | 本文档中一条可判定真伪的约定，含字段、规则、验收标准。编号前缀 `CT-`（数据）/ `ST-`（存储）/ `API-`（接口）/ `EVT-`（事件）/ `XC-`（跨端）/ `UI-`（页面）/ `TC-`（任务卡）/ `AC-`（验收断言） |
| **任务卡（Task Card）** | 一张自包含的 AI 编程会话输入，含目标、契约编号、代码锚点、允许改动文件、禁止事项、验收断言 |
| **代码标记** | `【保留】``【改造】``【替换】``【补齐】``【缺口】` 五级改造分类 |
| **代码锚点** | `file:///绝对路径#L起-L止`，点击可跳转，用于让 AI 精确定位改动位置 |
| **两级回退** | 读权威源 → 解析失败回退种子 → **绝不回写权威源** |
| **生产替换点** | 接入后端时需替换的代码位置，集中在 Store 内部，页面无需改动 |
| **死代码** | 无引用 / 无写入方 / 定义后从未调用的代码 |
| **架构边界** | 「无构建纯静态可双击打开」前提下固有、且不应修复的限制（如 L-1 / L-9） |
| **幂等键** | `Idempotency-Key` 请求头，相同键重复提交只生效一次 |
| **蛇形命名 / camelCase** | `snake_case`（目标态）/ `camelCase`（现状态），见 `03-数据契约.md` §1 |
| **gate way 广播三步式** | `save()` 落盘 → `notify()` 通知本页订阅者 → `dispatchEvent` 通知同窗口文档 |
| **iframe 外壳** | PC 后台 `index.html` 单页外壳 + iframe 容器的结构 |

---

## 3. 缩写

| 缩写 | 全称 | 说明 |
| --- | --- | --- |
| PC | Personal Computer | PC 管理后台（95 个 HTML） |
| H5 | HTML5 Mobile | 消费者端（16 个页面） |
| DA | Dashboard | 数据大屏（10 个页面） |
| MB | Mobile | 移动工作端（33 个页面） |
| DoD | Definition of Done | 完成定义，见 `14-测试与验收契约.md` |
| SLA | Service Level Agreement | 服务等级协议 |
| KPI | Key Performance Indicator | 关键绩效指标 |
| E2E | End to End | 端到端 |
| UAT | User Acceptance Test | 用户验收测试 |
| RBAC | Role-Based Access Control | 基于角色的访问控制 |
| ABAC | Attribute-Based Access Control | 基于属性的访问控制 |
| SSO | Single Sign-On | 单点登录 |
| JWT | JSON Web Token | 令牌格式 |
| MQTT | Message Queuing Telemetry Transport | IoT 设备消息协议 |
| ONVIF | Open Network Video Interface Forum | 视频接入协议 |
| PIPL | Personal Information Protection Law | 个人信息保护法 |
| WAF | Web Application Firewall | Web 应用防火墙 |
| OSS | Object Storage Service | 对象存储 |
| CDN | Content Delivery Network | 内容分发网络 |

---

## 4. 状态与枚举速查

完整枚举见 `03-数据契约.md` §2，常用项：

| 枚举 | 取值 |
| --- | --- |
| `record_status` | `pending` / `processing` / `completed` |
| `maintenance_status` | `pending` / `accepted` / `done` / `rejected` |
| `alert_level` | `urgent` / `important` / `reminder` / `notice` |
| `material_type` | `fertilizer` / `pesticide` / `tool` |
| `stock_status` | `high` / `normal` / `danger`（运行时计算） |
| `device_status` | `online` / `warning` / `offline` |
| `order_status` | `pending` / `paid` / `shipped` / `completed` / `cancelled` |
| `batch_status` | `pending` / `stored` / `packed` / `shipped` |
| `adoption_status` | `active` / `growing` / `harvest` |

---

## 5. 文档编号体系

```
00~02   约束层（使用说明 / 工程约束 / 架构）
03~07   契约层（数据 / 存储 / 接口 / 事件 / 跨端）
08~12   规范层（设计系统 / 组件 / 工程化 / 权限 / 部署）
13~14   交付层（任务卡 / 测试验收）
appendix A~D（术语 / 错误码 / 存储键台账 / 遗留问题）
```

**条目编号前缀**：

| 前缀 | 含义 | 示例 |
| --- | --- | --- |
| `CT-` | 数据契约 | `CT-MAT-001` |
| `ST-` | 存储契约 | `ST-PBIZ-001` |
| `API-` | 接口契约 | `API-FARMING-003` |
| `EVT-` | 事件契约 | `EVT-STORE-001` |
| `XC-` | 跨端联动 | `XC-PATROL-001` |
| `UI-` | 页面/组件契约 | `UI-PC-027` |
| `TC-` | 任务卡 | `TC-FARMING-003` |
| `AC-` | 验收断言 | `AC-FARMING-003-1` |
| `L-` | 遗留问题 | `L-D04` |
| `L-A` / `L-D` / `L-DEAD` | 遗留问题分类 |架构 / 数据 / 死代码 |

**页面编号前缀**：

| 前缀 | 端 | 示例 |
| --- | --- | --- |
| `PC-` | PC 管理后台 | `PC-FARMING-003` |
| `MB-` | 移动工作端 | `MB-PATROL-004` |
| `H5-` | H5 消费者端 | `H5-ORDER-002` |
| `DA-` | 数据大屏 | `DA-ALERT-001` |
| `PT-` | 门户 | `PT-001` |