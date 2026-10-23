# 附录 D · 遗留问题台账

> **本章作用**：登记契约层核查中发现的**代码与契约不符**的存量问题。
> **核心原则**：登记而不静默忽略。每条问题都有编号、性质判定、处置方案。
> **⚠️ 不得在功能开发任务中顺手修复本章登记的问题**，必须单独开任务卡。

---

## 0. 性质分类

| 类别 | 含义 | 处置方式 |
| --- | --- | --- |
| 🔴 **设计缺陷** | 代码本身有bug 或安全隐患 | 必须修复，优先级高 |
| 🟡 **规范不一致** | 同一概念多种写法，影响可维护性 | snake_case 改造时统一 |
| ⚪ **死代码** | 无引用或无写入方 | 确认后删除 |
| 🔵 **架构边界** | 「无构建纯静态」前提下的固有约束 | **不修**，生产环境通过替换解决 |

---

## 1. 架构边界（不修）

| 编号 | 问题 | 性质 | 生产解决方案 |
| --- | --- | --- | --- |
| **L-1** | 跨端联动依赖同源 localStorage + `storage` 事件，换设备/浏览器/跨源即失效 | 🔵 架构边界 | 替换 6 个 PC Store 的 `read/write/subscribe`；替换 `MobileStore.simulateUpload` |
| **L-9** | 离线队列「上传」由 `setTimeout(400)` 模拟 | 🔵 架构边界 | 同上，替换点收敛在 1 处 |
| **L-10** | 品种代码语义在历史演进中不统一 | ✅ 已收敛 | 需求说明书 §30.13 已处理 |
| **L-12** | 巡园无「基地」维度 | ✅ 已修复 | 需求说明书 §30.14 已补齐，复合键隔离见 `07-跨端联动契约.md` XC-PATROL-001 |

> **这四条不得作为 bug 修复。** 任何"修复跨端不生效、离线队列不上传"的提交都应被拒绝。

---

## 2. 🔴 设计缺陷（必须修复）

### L-A01 页面绕过 Store 直写业务数据

| 项 | 内容 |
| --- | --- |
| **位置** | [mb_device.html](file:///d:/dev/pro_smartorchard/html/applefarm_mobile/mb_device.html) · [mb_drone_patrol.html](file:///d:/dev/pro_smartorchard/html/applefarm_mobile/mb_drone_patrol.html) |
| **涉及 key** | `smartorchard_maintenance_logs` / `smartorchard_drone_events` / `smartorchard_drone_abnormal` |
| **违反** | `01-技术栈与工程约束.md` §4.1 唯一入口原则 |
| **后果** | 这 3 个 key 未进入 `MobileStore.KEYS`；跨端回退与广播机制失效；`MobileStore.subscribe()` 收不到变更 |
| **处置** | ① 把 3 个 key 补进 `MobileStore.KEYS` ② 页面改用 `MobileStore.push()` / `upsert()` ③ 回归验证 3 条跨端链路 |
| **任务卡** | `TC-MIG-101` |
| **批次** | 2（收敛键归属） + 5（改页面） |

### L-D03 `plotCoverage` / `uptimeDays` 为硬编码常量

| 项 | 内容 |
| --- | --- |
| **位置** | [data-store.js](file:///d:/dev/pro_smartorchard/html/applefarm_backhand/js/shared/data-store.js#L186-L187) |
| **现状** | `plotCoverage: 126`、`uptimeDays: 386` 字面量，无任何推导 |
| **后果** | 大屏与后台长期展示错误数字，且无任何迹象表明是假的 |
| **处置** | 接入后端后由 `/api/v1/data/...` 返回真实统计；过渡期在页面上标注「示例数据」 |
| **任务卡** | `TC-API-020` |

### L-D04 AlertStore 空数组导致内存与持久化不一致

| 项 | 内容 |
| --- | --- |
| **位置** | [alert-data.js](file:///d:/dev/pro_smartorchard/html/applefarm_backhand/js/shared/alert-data.js) 加载逻辑 |
| **代码** | `inMemory = (stored && stored.length) ? stored : deepClone(DEFAULT_DATA)` |
| **后果** | 若盘上存 `[]`（`[]` 是 truthy）：<br>① 内存回退到 46 条默认数据<br>② `if (!stored)` 为假 → **不回写**<br>③ 结果：内存 46 条 / 盘上 0 条，**每次刷新都不一致** |
| **处置** | 加载时区分「键不存在」与「键为空」两种情况：<br>键不存在 → 落盘种子<br>键为空数组 → 落盘种子（视为初始化）或抛错，**禁止静默不一致** |
| **任务卡** | `TC-D01` |

### L-D06 `snzg_permissions` 双 key 空间共存

| 项 | 内容 |
| --- | --- |
| **位置** | [system_settings.html](file:///d:/dev/pro_smartorchard/html/applefarm_backhand/system_settings.html) · [index.html](file:///d:/dev/pro_smartorchard/html/applefarm_backhand/index.html#L816) |
| **现状** | 同一对象内并存两种格式的键：<br>① `'{roleCode}:{module}:{action}'` → boolean<br>② `'{roleCode}:{菜单名}[:{子菜单}]'` → boolean |
| **后果** | 删除某角色权限时需同时清理两种格式，**遗漏即残留脏数据**；无法判断某个键属于哪套体系 |
| **处置** | 拆分为两个键：`snzg_role_permissions`（操作级）+ `snzg_role_menus`（菜单级）；或改为扁平 `module:action` 结构（见 `05-接口契约.md` §3.1） |
| **任务卡** | `TC-PERM-002` |

### L-D07 MaterialStore 无订阅机制

| 项 | 内容 |
| --- | --- |
| **位置** | [material-store.js](file:///d:/dev/pro_smartorchard/html/applefarm_backhand/js/material-store.js) |
| **现状** | 唯一没有 `subscribe()` 与自定义事件的 Store（其余 5 个都有 `xxxStoreChange`） |
| **后果** | 修改库存后，其他已打开的页面不会自动刷新，只能靠用户手动刷新或页面自己 `setInterval` 重读 |
| **处置** | 补 `storage` 事件监听 + `materialStoreChange` 自定义事件 + `subscribe(fn)`，参照 `AlertStore` 实现 |
| **任务卡** | `TC-MAT-001` |
| **注意** | ⚠️ **不得为此加内存缓存**——加缓存会重现L-3 踩坑（多标签页数据不一致） |

### L-D09 网关凭据明文存储

| 项 | 内容 |
| --- | --- |
| **位置** | [device-store.js](file:///d:/dev/pro_smartorchard/html/applefarm_backhand/js/shared/device-store.js) `gateways[]` |
| **现状** | `username` / `password` 存localStorage（password 当前是 `******` 占位） |
| **后果** | 接入真实网关凭据后将明文暴露在前端 |
| **处置** | 新增 `GET /api/v1/iot/gateways/{id}/credentials` 独立接口（见 `05-接口契约.md` §3.6），前端仅用于表单展示不落盘；接口加 `iot:credential:read` 权限控制 |
| **任务卡** | `TC-API-030` |

### L-CERT-001 `cert_stamp_dataurl` 容量风险

| 项 | 内容 |
| --- | --- |
| **位置** | [cert_issue.html](file:///d:/dev/pro_smartorchard/html/applefarm_backhand/cert_issue.html) |
| **现状** | Canvas 签章 PNG 以base64 dataURL 存 localStorage，单张 50–200 KB |
| **后果** | base64 比原图大 33%；写满约 50 MB 时触发 `QuotaExceededError`，**该页面所有签章功能失效** |
| **处置** | 改为 `POST /api/v1/files/image` 上传，服务端返回 URL（见 `05-接口契约.md` §3.15）；过渡期限制只保留最近 N 张 |
| **任务卡** | `TC-CERT-002` |

### L-PERM-01 登录写入中文 role，超管豁免失效

| 项 | 内容 |
| --- | --- |
| **位置** | [login.html](file:///d:/dev/pro_smartorchard/html/applefarm_backhand/login.html#L741-L746) 写入 · [index.html](file:///d:/dev/pro_smartorchard/html/applefarm_backhand/index.html#L996-L1000) 读取 |
| **违反** | `11-权限契约.md` §1.3 |
| **现状** | 登录写 `snzg_user.role = '超级管理员'`（中文），**无 `roleCode`**；权限过滤读 `user.roleCode \|\| user.role` → 兜底为中文 → `!== 'admin'` → **超管豁免从未生效** |
| **后果** | 只因权限配置用英文 code 而侥幸未暴露；若有人用中文 role 配权限，超管会被误过滤 |
| **处置** | ① `USERS` 表增加 `code` 字段（英文）② 写入时同时写 `roleCode` ③ `farmer`/`worker` 是否映射到 `operator` 需业务确认 |
| **任务卡** | `TC-PERM-001` |

### L-PERM-02 子页面无守卫，可绕过菜单权限直访

| 项 | 内容 |
| --- | --- |
| **位置** | 全部 93 个导航页 |
| **现状** | 登录守卫只在 `index.html`；子页面无任何检查 |
| **后果** | 三条绕过路径：① 地址栏直接输入页面名 ② 控制台调 `parent.openPage()` ③ 页面内其他跳转入口 |
| **处置** | 在 `iframe-hide.js`（已在每页加载）追加轻量守卫 |
| **任务卡** | `TC-PERM-003` |
| **注意** | ⚠️ 该文件是 95 页共享，需单独任务卡 + 全量回归 |

### L-PERM-07 密码明文重复存储

| 项 | 内容 |
| --- | --- |
| **位置** | `system_settings.html` 的 `snzg_passwords` 与 `snzg_user_accounts.password` |
| **后果** | 安全风险 + 数据不一致（改一处另一处不变） |
| **处置** | 🔴 删除 `snzg_passwords`；接入后端后彻底移除本地存储 |
| **任务卡** | `TC-PERM-004` |

### L-DEP-01 CSS/JS 引用无版本号

| 项 | 内容 |
| --- | --- |
| **位置** | 全部 95 个页面的 `<link>` / `<script src>` |
| **现状** | `href="css/design-system.css"`，无 `?v=` 或 hash |
| **后果** | 更新 CSS 后用户可能拿旧缓存，导致「改了没生效」 |
| **处置** | ① 短期：URL 加版本 query ② 长期：引入构建做文件 hash |
| **任务卡** | `TC-DEP-001` |

### L-DEP-02 iconify CDN 无降级

| 项 | 内容 |
| --- | --- |
| **位置** | 几乎所有 PC 页面的 `<head>` |
| **后果** | 内网/离线环境图标全失效；CDN 被墙时阻塞渲染 |
| **处置** | 下载到 `vendor/iconify.min.js`，改本地引用 |
| **任务卡** | `TC-DEP-002` |

### L-DEP-05 五处敏感信息明文存储

| # | 位置 | 内容 |
| --- | --- | --- |
| 1 | `login.html:557-561` | 5 个演示账号密码明文 |
| 2 | `snzg_passwords` | 明文密码表 |
| 3 | `snzg_user_accounts.password` | 明文密码 |
| 4 | `rememberedPwd`（mb_login.html） | Base64 编码（非加密） |
| 5 | `device-store.js` `gateways[].password` | 网关凭据（当前 `******` 占位） |

**处置**：接入后端后全部移除本地存储，改为服务端校验 + 令牌。

---

## 3. 🟡 规范不一致（snake_case 改造时统一）

### L-D01 `normalizeLevel` / `LEVEL_MAP` 为死代码

| 项 | 内容 |
| --- | --- |
| **位置** | [alert-data.js](file:///d:/dev/pro_smartorchard/html/applefarm_backhand/js/shared/alert-data.js#L45-L62) |
| **现状** | `LEVEL_MAP`（9 键映射）与 `normalizeLevel()` 定义后**从未被调用**（全 js/html 目录搜索仅命中定义处） |
| **后果** | 种子数据已直接使用 4 级 code，运行时不会发生归一化。**接入真实数据源后（后端可能返回 `danger`/`critical`）级别显示会错乱** |
| **处置** | 二选一：① 删除该死代码；② 在 `load()` 中启用归一化（推荐，为后端预留） |
| **任务卡** | `TC-D02` |

### L-D02 状态值中英文混用（7 处）

| 存储键 | 写入方 | 写入值 | 应统一为 |
| --- | --- | --- | --- |
| `smartorchard_farming_records` | 移动端 | `'pending_sync'` | `record_status` |
| `smartorchard_farming_records` | PC 回写 | `'pending'` 或中文 | `record_status` |
| `smartorchard_patrol_records`（异常） | 移动端 | `'待处理'` **中文** | `record_status` |
| `smartorchard_label_records` | 移动端 | `'pending'` | — |
| `smartorchard_label_records` | PC 回写 | `'已打印'` / `'已驳回'` **中文** | `record_status` |
| `smartorchard_adoption_tags`（绑定） | 移动端 | `'pending'` | — |
| `orchard_farming_prefill` | farming_plan | 可能写中文状态 | `record_status` |

**处置**：全部改为 `03-数据契约.md` §2.1 的英文枚举，`status_text` 仅用于展示。**改动时必须全局搜索所有读写方**（含大屏）。

### L-D05 `smartorchard_label_stock` 以标签名为 key

| 项 | 内容 |
| --- | --- |
| **位置** | [mb_label.html](file:///d:/dev/pro_smartorchard/html/applefarm_mobile/mb_label.html#L197) · [mobile-bridge.js](file:///d:/dev/pro_smartorchard/html/applefarm_backhand/js/shared/mobile-bridge.js#L65) |
| **现状** | `{ "秦冠专用标签": 6800 }` —— key 是标签名本身 |
| **对照** | `smartorchard_label_types` 用 `id`（`LB-A`）作主键，**两套主键不一致** |
| **后果** | 标签改名 → 库存成为孤儿键，无清理机制 |
| **处置** | 统一为 id 主键 + 名称降级为普通字段；接口侧已按此设计（`05-接口契约.md` §3.5） |
| **任务卡** | `TC-LABEL-002` |

### L-D08 `orchard_farming_prefill` 数组/对象双形态

| 项 | 内容 |
| --- | --- |
| **位置** | 4 个 model 页（写数组）+ `farming_plan.html`（写对象） |
| **数组形态** | `{title, taskType, plotRange, priority}` |
| **对象形态** | `{name, base, type, manager, desc, startDate, endDate, date, content, plot, model, consumed}` |
| **后果** | 读取方必须 `Array.isArray` 兼容；两种形态字段完全不同，无法统一处理 |
| **处置** | 统一为数组形态，对象形态的字段补入数组元素 |
| **任务卡** | `TC-FARM-002` |

### L-D10 `AlertStore` 的 `reason` 格式不统一

| 项 | 内容 |
| --- | --- |
| **现状** | 状态变更时 `reason = 'status:<id>'`，历史追加时 `'history:<id>'`，其他为裸字符串 `'init'`/`'reset'`/`'sync'` |
| **后果** | 订阅方若按 reason 分支，必须用 `indexOf(':')` 解析，易漏 |
| **处置** | 统一为 `{action, id}` 结构 |
| **任务卡** | `TC-D02`（与 L-D01 同卡） |

### L-D11 同一数组内两种时间字段名

| 位置 | 字段 |
| --- | --- |
| `smartorchard_patrol_records`（打卡） | `checkinTime` |
| `smartorchard_patrol_records`（异常） | `reportTime` |
| `smartorchard_farming_records` | `createTime` |
| `smartorchard_material_logs` | `time`（本地文本） + `createTime`（ISO） |

**处置**：snake_case 目标统一为 `event_time` / `create_time`，`time` 字段的本地文本格式统一改为 ISO 8601。

### L-D12 遗留键 `plots`（无前缀）

| 项 | 内容 |
| --- | --- |
| **位置** | `mb_plot.html` 与 `MobileBridge.plots()` 双重兼容 |
| **现状** | 旧键 `plots`（无 `smartorchard_` 前缀）与新键 `smartorchard_plots` 并存，按 id 去重后合并 |
| **处置** | 统一到 `smartorchard_plots`，`plots` 仅保留只读兼容（一个版本后删除） |

### L-D13 `h5_favorites` 无 user 归属

| 项 | 内容 |
| --- | --- |
| **现状** | `h5_addresses` 有 `user` 字段，`h5_favorites` **没有** |
| **后果** | 切换账号后收藏会串数据 |
| **处置** | 补 `user` 字段，读写时按 `currentUser()` 过滤 |

---

## 4. ⚪ 死代码（确认后删除）

| 编号 | 对象 | 现状 | 处置 |
| --- | --- | --- | --- |
| **L-DEAD-01** | `api-mock.js`（32 KB） | 全仓库零引用，`VRAPI` 含 `buildings` 等本项目不存在的实体，字段与实际数据模型脱节 | 标记 `@deprecated`，不删文件但不再维护。**已决策**（见 `05-接口契约.md` §0.2） |
| **L-DEAD-02** | `sidebar-layout.js`（39 KB） | 需求说明书记载「历史遗留，当前未被任何页面引用」；其 `sidebar-tabs` / `sidebar-collapsed` 两个 key 也无页面使用 | 确认后删除 |
| **L-DEAD-03** | `h5_checkout_single` | 全项目仅一处 `removeItem`，**无任何写入/读取点** | 确认后删除该 key 与 removeItem 调用 |
| **L-DEAD-04** | `device_log_cleared_at` | 仅 `removeItem`，**写入方已丢失** | 确认后删除 |
| **L-DEAD-05** | `snzg_adoption_income` | 仅 `report_overview.html` 读 `amount`，**无写入方** | 确认：补写入方或删除该读取逻辑 |
| **L-DEAD-06** | `MobileBridge.droneEvents()` / `droneAbnormal()` | 方法已实现但**零调用**；PC 端无页面消费无人机事件 | 批次 4 详设 `drone_patrol.html` 时确认是否接入；不接入则连同 2 个 key 删除 |

> **删除前必须全局搜索确认**：包括 HTML 内联字符串（弹窗模板里可能有引用）、`demo-seed.js`（可能是这些 key 的 schema 权威源）。

---

## 5. 未接入的跨端链路

| 编号 | 链路 | 现状 | 处置 |
| --- | --- | --- | --- |
| **XC-DRONE-001** | 无人机事件 → PC | 移动端写 `smartorchard_drone_events` / `_abnormal`；PC 端 `MobileBridge` 方法已实现但零调用 | 批次 4 详设确认接入与否 |
| **L-DRONE-002** | 无人机 key 未进 KEYS | 同 L-A01 | 同 L-A01 |

---

## 6. 未提交到 git 的文件

| 文件 | 状态 | 说明 |
| --- | --- | --- |
| `html/applefarm_backhand/js/shared/device-store.js`（20.7 KB） | 未跟踪 | 第 6 个 Store，2026-10-23 新增 |
| `html/applefarm_backhand/device_access.html` | 未跟踪 | 设备接入配置页，已挂「设备管理」导航 |
| `html/applefarm_backhand/biz_receivable.html` | 已修改 | — |
| `html/applefarm_backhand/device_maintain.html` | 已修改 | — |
| `html/applefarm_backhand/home.html` | 已修改 | — |
| `html/applefarm_backhand/index.html` | 已修改 | 含 device_access 导航挂载 |
| `html/applefarm_backhand/system_settings.html` | 已修改 | — |
| `html/applefarm_backhand/user_settings.html` | 已修改 | — |

> **⚠️ 批次 4/5 开工前必须先提交这批改动**，否则详设的代码锚点行号会随提交漂移，导致 AI 定位错误。

---

## 7. 处置优先级

| 优先级 | 编号 | 理由 |
| --- | --- | --- |
| **P0** | L-A01 · L-D03 · L-D04 · L-D06 · L-D09 · L-PERM-01 · L-PERM-02 · L-DEP-01 · L-DEP-05 · L-ENG-04 | 安全/数据不一致 / 阻塞后续批次 |
| **P1** | L-CERT-001 · L-D07 · L-D01 · L-PERM-03 · L-PERM-04 · L-PERM-07 · L-ENG-01 · L-ENG-02 · L-ENG-03 · L-DEP-02 · L-DEP-03 · L-DEP-04 · L-DS-01 · L-DS-04 | 功能失效 / 接入后端前必须处理 / 阻塞页面改造 |
| **P2** | L-D02 · L-D05 · L-D08 · L-D10~L-D13 · L-PERM-05~L-PERM-10 · L-CMP-03~L-CMP-06 · L-ENG-05 · L-ENG-06 · L-DS-02 · L-DS-03 · L-DS-06 · L-DS-07 · L-DEP-06 · L-DEP-07 · L-DEP-09 | 规范不一致 / 影响可维护性 |
| **P3** | L-DEAD-01~06 · L-CMP-07~L-CMP-09 · L-ENG-07 · L-ENG-08 · L-DS-05 · L-DEP-08 | 死代码清理 |

**批次 4（页面详设）开始前必须完成**：

```
① L-ENG-04 提交 8 个未提交文件（否则代码锚点行号漂移）
② L-PERM-01 决定是否在详设中标注（超管豁免失效会影响权限相关页面的详设）
```

**接入后端前必须完成的 P0 项**：L-A01 · L-D03 · L-D04 · L-D06 · L-D09 · L-PERM-01 · L-PERM-02 · L-PERM-07 · L-DEP-01 · L-DEP-05

---

## 8. 遗留问题统计

| 类别 | 数量 | 登记位置 |
| --- | --- | --- |
| 🔵 架构边界（不修） | 4 | 本章 §1（L-1 · L-9 · L-10 · L-12） |
| 🔴 设计缺陷 | 15 | 本章 §2（15 条，均有完整条目） |
| 🟡 规范不一致 | 26 | 本章 §3（9 条）+ 各章末尾（17 条） |
| ⚪ 死代码 | 15 | 本章 §4（6 条）+ 各章末尾（9 条） |
| **合计** | **60** | — |

### 8.1 本章未展开条目的登记位置

以下编号在对应章节末尾有简表，本章只给编号与处置方向：

| 编号段 | 条数 | 登记位置 | 主题 |
| --- | --- | --- | --- |
| `L-PERM-03` `L-PERM-04` `L-PERM-05` | 3 | [11-权限契约.md](../11-权限契约.md) §9 | 权限双 key 拆分 · 模块名与菜单名不一致 · 权限矩阵覆盖不足 |
| `L-PERM-06` `L-PERM-08`~`L-PERM-10` | 4 | 同上 | 数据级权限未实现 · 状态字段重复 · `roles[].id` 类型 · `MENU_GROUP_MAP` 硬编码 |
| `L-CMP-01`~`L-CMP-09` | 9 | [09-组件与交互契约.md](../09-组件与交互契约.md) §9 | 分页 28 份拷贝 · Confirm danger 默认值 · Toast 双套 · 空态缺失 · 表单无校验 · 品种无共享常量 · 死代码 |
| `L-DS-01`~`L-DS-07` | 7 | [08-设计系统实现契约.md](../08-设计系统实现契约.md) §8 | 大屏 token 未引用 · `--bg-sidebar` 冲突 · 双 token 体系 · 41 个同名冲突 · 死 token · 安全区未生效 · H5 内联样式 |
| `L-ENG-01`~`L-ENG-08` | 8 | [10-前端工程化契约.md](../10-前端工程化契约.md) §8 | Pagination 重复声明 · 容器覆盖率 · 未提交文件 · 死代码 |
| `L-DEP-03` `L-DEP-04` `L-DEP-06`~`L-DEP-09` | 7 | [12-部署与配置契约.md](../12-部署与配置契约.md) §8 | 环境隔离 · `config.js` · 前端监控 · 回滚能力 · 字体冗余 · CI 缺失 |

**P0 条目清单**（共 10 条，全部在本章 §2 有完整条目）：

```
L-A01       页面绕过 Store 直写 3 个业务 key
L-D03       plotCoverage / uptimeDays 硬编码常量
L-D04       AlertStore 空数组导致内存与盘不一致
L-D06       snzg_permissions 双 key 空间（已决策拆分）
L-D09       网关凭据明文
L-PERM-01   登录写中文 role，超管豁免失效
L-PERM-02   子页面无守卫，可绕过菜单权限
L-DEP-01    CSS/JS 无版本号（接入生产前必改）
L-DEP-05    五处敏感信息明文
L-ENG-04    8 个文件未提交到 git（阻塞批次 4/5）
```

---

## 9. 新增问题的登记要求

任何契约与代码不符的问题，按下述格式追加到本章：

```
| 编号 | 问题 | 位置（file:///...#L行号） | 违反的契约 | 后果 | 处置 | 任务卡 | 优先级 |
```

**登记要求**：

```
① 必须有代码位置（file:/// 路径 + 行号）
② 必须说明「违反哪条契约」，不能只说「不规范」
③ 必须说明「后果」，区分「数据错误」「功能失效」「安全风险」「仅影响维护」
④ 必须给出处置方案与任务卡编号
⑤ ⚪ 死代码类必须注明「删除前需全局搜索确认」
```