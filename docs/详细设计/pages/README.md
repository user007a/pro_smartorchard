# 批次 5 · 移动端 / H5 / 数据大屏 / 门户（60 页）

> **本章作用**：`applefarm_mobile` 33 页、`applefarm_h5` 16 页、`applefarm_dataanlye` 10 页、门户 1 页的逐页实现契约。
> **与批次 4 的关系**：批次 4 覆盖 `applefarm_backhand` 的 96 个 PC 后台页；本章覆盖其余 4 个端，共 60 页。两端通过 localStorage 键直接耦合，**同一键在两端各有一份读写实现**，这是本批次最主要的缺陷来源。
> **页面编号**：`MB-001~033` / `H5-001~016` / `DA-001~010` / `PORTAL-001`。

---

## 0. 批次总览

### 0.1 四端目录与页数

| 端 | 目录 | 页数 | 编号前缀 | 定位 |
| --- | --- | --- | --- | --- |
| 移动端作业端 | `html/applefarm_mobile/` | 33 | `MB-` | 田间作业人员手机端，最大宽度 750px |
| 消费者 H5 | `html/applefarm_h5/` | 16 | `H5-` | 商城 / 认养 / 溯源 / 社区 |
| 数据大屏 | `html/applefarm_dataanlye/` | 10 | `DA-` | 1920×1080 深色驾驶舱 |
| 门户 | `html/portal.html` | 1 | `PORTAL-` | 多端入口选择页 |

> **目录名注意 1**：数据大屏目录实际为 `applefarm_dataanlye`（拼写如此，非 `analysis`），文档与代码中一律沿用，**不得改名**，否则 10 个页面的相对路径全部失效。
>
> **目录名注意 2**：门户**没有独立目录**，直接位于 `html/portal.html`（349 行，纯静态、零脚本、零外部样式）。

### 0.2 与 PC 后台的键耦合

```
移动端 → PC 后台（后台读、移动端写）
  smartorchard_feedbacks         mb_feedback.html      → mb_feedback_review.html
  smartorchard_expert_questions  mb_expert.html        → mb_expert_reply.html
  mb_staff_accounts              mb_login.html         → mb_staff_account.html
  smartorchard_sync_queue        MobileStore.enqueue() → mb_sync_queue.html
  mb_messages                    mb_home.html          → mb_message.html
  mb_ai_config                   mb_ai_assistant.html  → mb_ai_config.html
  mb_disease_rules               mb_disease.html       → mb_disease_config.html
  mb_fault_kb                    mb_troubleshoot.html  → mb_fault_knowledge.html

H5 → PC 后台（后台读、H5 写）
  h5_orders                      h5_checkout.html      → mall_order.html / sales_order.html
  h5_invoices                    h5_order.html         → mall_invoice.html
  h5_community_posts/comments/likes  h5_community.html  → mall_community.html
  mall_products                  h5_store.html         ← mall_product.html（后台写、H5 读）
  mall_coupons                   h5_cart.html          ← mall_coupon.html
  mall_promotions                h5_store.html         ← mall_promotion.html
  mall_member_profiles           h5_member.html        ← mall_member.html

大屏 → 全端（只读）
  applefarm_biz_v1 / applefarm_data_ops_v1 / h5_orders / snzg_adoptions / AlertStore
```

### 0.3 本批次共性约束

```
① 移动端 33 页统一最大宽度 750px，含安全区适配（env(safe-area-inset-bottom)）；
   底部 TabBar 固定，页面内容需留出 TabBar 高度。
② H5 16 页为消费者端，无 TabBar 的页面需提供返回入口；金额一律「元」，保留两位小数。
③ 大屏 10 页固定 1920×1080，用 transform: scale() 适配，禁止响应式重排。
④ 四端均无构建工具，全部 <script src> 直引；跨端共享脚本只允许放在 html/common/ 或各端 js/shared/。
⑤ 移动端与 H5 均无分页组件，列表一律「加载更多」或全量渲染；大屏无分页。
⑥ 四端均无权限控制，权限只在 PC 后台侧栏生效（见 11-权限契约.md）。
```

---

## 1. 移动端作业端（33 页）

### 1.1 模块概述

移动端是**田间作业人员的唯一作业入口**，33 页覆盖登录、首页、农事、巡园、设备、认养、AI 助手、个人中心 8 个业务域。数据层由 `js/mobile-store.js`（`MobileStore`）统一封装，是四端中**唯一有 Store 抽象**的端。

| 编号 | 文件 | 中文名 | 业务域 |
| --- | --- | --- | --- |
| `MB-001` | `mb_login.html` | 登录 | 入口 |
| `MB-002` | `mb_home.html` | 首页 | 入口 |
| `MB-003` | `mb_mine.html` | 我的 | 入口 |
| `MB-004` | `mb_plan.html` | 农事计划 | 农事 |
| `MB-005` | `mb_record_task.html` | 农事记录 | 农事 |
| `MB-006` | `mb_material.html` | 农资领用 | 农事 |
| `MB-007` | `mb_plot.html` | 地块管理 | 农事 |
| `MB-008` | `mb_draw_plot.html` | 地块绘制 | 农事 |
| `MB-009` | `mb_patrol.html` | 巡园打卡 | 巡园 |
| `MB-010` | `mb_drone_patrol.html` | 无人机巡检 | 巡园 |
| `MB-011` | `mb_map.html` | 果园地图 | 巡园 |
| `MB-012` | `mb_device.html` | 设备管理 | 设备 |
| `MB-013` | `mb_troubleshoot.html` | 故障排查 | 设备 |
| `MB-014` | `mb_alert.html` | 预警中心 | 设备 |
| `MB-015` | `mb_label.html` | 标签打印 | 设备 |
| `MB-016` | `mb_disease.html` | 病害识别 | AI |
| `MB-017` | `mb_ai_assistant.html` | AI 助手 | AI |
| `MB-018` | `mb_expert.html` | 专家咨询 | AI |
| `MB-019` | `mb_feedback.html` | 意见反馈 | AI |
| `MB-020` | `mb_growth.html` | 生长模型 | 模型 |
| `MB-021` | `mb_pest_risk.html` | 病虫害风险 | 模型 |
| `MB-022` | `mb_weather_predict.html` | 气象预测 | 模型 |
| `MB-023` | `mb_yield.html` | 产量预估 | 模型 |
| `MB-024` | `mb_price.html` | 价格行情 | 模型 |
| `MB-025` | `mb_adoption.html` | 认养管理 | 认养 |
| `MB-026` | `mb_adoption_browse.html` | 认养浏览 | 认养 |
| `MB-027` | `mb_adoption_detail.html` | 认养详情 | 认养 |
| `MB-028` | `mb_adoption_cert.html` | 认养证书 | 认养 |
| `MB-029` | `mb_adoption_farming.html` | 认养农事 | 认养 |
| `MB-030` | `mb_adoption_harvest.html` | 认养采收 | 认养 |
| `MB-031` | `mb_adoption_tagging.html` | 认养挂牌 | 认养 |
| `MB-032` | `mb_service.html` | 服务大厅 | 入口 |
| `MB-033` | `vr_panorama.html` | VR 全景 | 入口 |

> 33 页逐页详设见 `pages/mobile/` 目录下 4 个文件（`01-入口与农事.md`、`02-巡园设备与AI.md`、`03-模型与认养.md`、`04-服务与全景.md`）。

---

## 2. 消费者 H5（16 页）

### 2.1 模块概述

H5 是**消费者端**，覆盖商城购物、认养、溯源、社区、会员 5 条主线。数据层无 Store 抽象，各页直接读写 localStorage，键名以 `h5_` 前缀为主。

| 编号 | 文件 | 中文名 | 主线 |
| --- | --- | --- | --- |
| `H5-001` | `index.html` | H5 首页 | 入口 |
| `H5-002` | `h5_login.html` | 登录注册 | 入口 |
| `H5-003` | `h5_store.html` | 商城首页 | 商城 |
| `H5-004` | `h5_cart.html` | 购物车 | 商城 |
| `H5-005` | `h5_checkout.html` | 结算下单 | 商城 |
| `H5-006` | `h5_order.html` | 我的订单 | 商城 |
| `H5-007` | `h5_favorites.html` | 我的收藏 | 商城 |
| `H5-008` | `h5_adoption.html` | 认养专区 | 认养 |
| `H5-009` | `h5_trace_detail.html` | 溯源详情 | 溯源 |
| `H5-010` | `trace_h5.html` | 溯源查询 | 溯源 |
| `H5-011` | `trace_intro.html` | 溯源介绍 | 溯源 |
| `H5-012` | `h5_community.html` | 社区 | 社区 |
| `H5-013` | `h5_messages.html` | 消息中心 | 会员 |
| `H5-014` | `h5_member.html` | 会员中心 | 会员 |
| `H5-015` | `h5_profile.html` | 个人资料 | 会员 |
| `H5-016` | `h5_settings.html` | 设置 | 会员 |

> 16 页逐页详设见 `pages/h5/01-商城与认养.md`、`pages/h5/02-溯源社区与会员.md`。

---

## 3. 数据大屏（10 页）

### 3.1 模块概述

数据大屏是**生产指挥驾驶舱**，固定 1920×1080 深色主题，10 页共用 `da_index.html` 作为外壳（iframe 或页签切换）。

| 编号 | 文件 | 中文名 | 主题 |
| --- | --- | --- | --- |
| `DA-001` | `da_index.html` | 大屏外壳 | 外壳 |
| `DA-002` | `da_dashboard.html` | 综合驾驶舱 | 总览 |
| `DA-003` | `da_overview.html` | 生产总览 | 总览 |
| `DA-004` | `da_growth.html` | 生长监测 | 生产 |
| `DA-005` | `da_iot.html` | 物联网设备 | 生产 |
| `DA-006` | `da_alert.html` | 预警指挥 | 生产 |
| `DA-007` | `da_trace.html` | 溯源链路 | 业务 |
| `DA-008` | `da_business.html` | 经营分析 | 业务 |
| `DA-009` | `da_results.html` | 成效展示 | 业务 |
| `DA-010` | `vr_panorama.html` | VR 全景大屏 | 展示 |

> 10 页逐页详设见 `pages/dashboard/01-大屏.md`。

---

## 4. 门户（1 页）

| 编号 | 文件 | 中文名 | 说明 |
| --- | --- | --- | --- |
| `PORTAL-001` | `html/portal.html` | 多端入口选择页 | 果园实景背景 + 透视弧形卡片群 + 三层六边形图标，4 张卡片分别跳转后台 / 移动端 / H5 / 大屏 |

> 逐页详设见 `pages/portal/01-门户.md`。

---

## 5. 编写进度

| 文件 | 覆盖 | 页数 | 规模 | 缺陷 | 任务卡 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| `pages/mobile/01-入口与农事.md` | MB-001~008 | 8 | 222 KB | `L-MB1-*` | 6 | ✅ 完成 |
| `pages/mobile/02-巡园设备与AI.md` | MB-009~019 | 11 | 336 KB | `L-MB2-*` | 14 | ✅ 完成 |
| `pages/mobile/03-模型与认养.md` | MB-020~031 | 12 | 183 KB | `L-MB3-*` | — | ✅ 完成 |
| `pages/mobile/04-服务与全景.md` | MB-032~033 | 2 | 49 KB | `L-MB4-*` | — | ✅ 完成 |
| `pages/h5/01-商城与认养.md` | H5-001~008 | 8 | 503 KB | `L-H5-01~78` | 9 | ✅ 完成 |
| `pages/h5/02-溯源社区与会员.md` | H5-009~016 | 8 | 302 KB | `L-H5B-01~36` | 10 | ✅ 完成 |
| `pages/dashboard/01-大屏.md` | DA-001~010 | 10 | 316 KB | `L-DA-*` | 13 | ✅ 完成 |
| `pages/portal/01-门户.md` | PORTAL-001 | 1 | 22 KB | `L-PT-*` | — | ✅ 完成 |

**批次 5 合计**：60 页全部完成，逐页详设 8 个文件、共约 1.63 MB。

> **编号隔离**：批次 5 各端使用互不重叠的缺陷前缀（`L-MB1`/`L-MB2`/`L-MB3`/`L-MB4`/`L-H5`/`L-H5B`/`L-DA`/`L-PT`），任务卡同理由 `TC-H5-` 与 `TC-H5B-` 区分。
