# PC 管理后台 · 逐页详细设计（96 页）

> **本章作用**：提供 96 个页面的详设**统一模板**、**共性结构**、**页面清单与索引**。
> **每个页面一节，格式见 §2 模板。** 各页详设分批写入本目录，按一级菜单分文件。

---

## 1. 文件索引

| 文件 | 覆盖范围 | 页数 |
| --- | --- | --- |
| `README.md` | 本文件：模板 + 共性 + 清单 | — |
| `01-企业管理.md` | 企业信息 / 基地管理 / 地块管理 / VR全景 | 4 |
| `02-生产管理.md` | 农事计划 / 任务分配 / 农事记录 / 农事标准 / 巡园管理 / 无人机巡检 / 飞行日志 / 巡园路线 | 8 |
| `03-采收物资溯源.md` | 采收 5 页 + 物资 7 页 + 溯源 6 页 | 18 |
| `04-认养预警设备.md` | 认养 7 页 + 预警 5 页 + 设备 7 页 + 证书 2 页 | 21 |
| `05-经营销售数据模型.md` | 经营分析 9 页 + 销售 3 页 + 数据运营 4 页 + 模型管理 7 页 | 23 |
| `06-商城移动端系统.md` | 商城 7 页 + 移动端运营 8 页 + 系统管理 4 页 + 首页/登录/外壳 | 22 |

---

## 2. 页面详设模板（12 区块）

每个页面用以下 12 个区块。**AI 处理任务时只关注标记为 `【改造】``【替换】``【补齐】``【缺口】` 的条目。**

```markdown
### PC-XXX-NNN · 页面中文名 · xxx.html

#### 1 入口与导航
侧边栏「一级菜单 > 二项名」；面包屑三级；有父子页关系时说明

#### 2 依赖资产【保留】
css: design-system.css / unified-theme.css / typography.css / page-content.css
js:  common-functions.js 或 components/modal.js（二选一）/ page-actions.js / icons.js
特殊：<列出该页独有的依赖>

#### 3 DOM 骨架【保留】
<缩进树，标注每个容器的 class/id>

#### 4 数据绑定
读：<Store / localStorage key / mock 变量>
写：<Store 方法 / localStorage.setItem>
字段：<列出实际字段名，标注是否走 snake_case>

#### 5 表格列契约
| # | 表头 | 字段 | 渲染 | 空值占位 |

#### 6 筛选区契约
| 控件 | 类型 | id | 默认 | 数据源 |

#### 7 操作栏契约
| 按钮 | class | 绑定函数 | 是否显示记录条数 |

#### 8 分页契约
容器 id/class · 每页条数 · 实现方式（全局/内联副本/自写）· 分页文案

#### 9 弹窗契约
| 弹窗 id | 类型 | 字段清单 | 提交函数 | 校验 |

#### 10 边界态
空数据 · 搜索无果 · 字段超长 · 并发写冲突 · 权限不足

#### 11 代码标记
【改造】<位置 file:///…#L起-L止> 现状 → 目标 + 契约编号
【替换】…
【补齐】…
【缺口】…

#### 12 验收断言
Given-When-Then × 4
```

---

## 3. 共性结构（96 页实测统计）

### 3.1 外壳与容器

| 结构 | 出现页数 | 说明 |
| --- | --- | --- |
| `body[data-active-menu][data-active-submenu]` | 91 | ⚠️ **纯占位属性，无任何 JS/CSS 消费** |
| `div.main-wrapper` | 92 | 主内容容器，CSS `margin-left: var(--sidebar-width)` |
| `div.app-layout` | 70 | 部分页面有外层 flex 容器 |
| `div.tab-bar` + `button.tab-close-all` | 91 | ⚠️ **空壳**，`sidebar-layout.css:380` 强制 `display:none` |
| `<style id="standalone-fix">` | 91 | 独立打开时 `.main-wrapper{margin-left:0}` |
| `main.main-content` | — | 主内容 |
| `div.content-wrapper` | 57 | 部分页面有 |

### 3.2 区块三段式

```
page-header（33 页）→ 统计卡 → .page-section.search-section
                              → .page-section.action-bar（26 页）
                              → .page-section.data-section（64 页）→ 弹窗
```

### 3.3 表格统一形态

```html
<div class="data-table-wrapper">
  <table class="data-table">
    <thead><tr><th>…</th></tr></thead>
    <tbody id="xxxBody"></tbody>
  </table>
</div>
```

**操作列统一**：

```html
<td>
  <div class="action-btns">
    <button class="action-btn detail">查看</button>
    <button class="action-btn edit">编辑</button>
    <button class="action-btn danger">删除</button>
  </div>
</td>
```

**状态标签统一**：`<span class="status-tag {语义}">文本</span>`

语义后缀（定义在 `page-content.css:660-757` + `design-system.css:853-884` + `unified-theme.css:334-337`）：
`normal` `active` `warning` `danger` `inactive` `high` `urgent` `important` `reminder` `notice` `on` `off` `success` `disabled` `error`

### 3.4 筛选区统一形态

```html
<div class="search-bar">
  <select class="search-select" id="xxxSelect">…</select>
  <select class="search-select">…</select>
  <input class="search-input" id="xxxInput" placeholder="…">
  <div class="search-actions">
    <button class="jg-btn jg-btn-primary">搜索</button>
    <button class="jg-btn">重置</button>
  </div>
</div>
```

出现 71 页。重置有两种：37 页用 `search-helper.js` 的 `smartReset()`，其余自写 `resetSearch()`。

### 3.5 弹窗统一形态

```html
<div class="modal-overlay" id="xxxModal">
  <div class="modal-box">        ← 114 页
  <!-- 或 -->
  <div class="modal-container">  ← 27 页（⚠️ 两种命名并存）
    <div class="modal-header">
      <h3 class="modal-title">标题</h3>
      <button class="modal-close" onclick="closeXxxModal()">×</button>
    </div>
    <div class="modal-body">…</div>
    <div class="modal-footer">
      <button class="jg-btn" onclick="closeXxxModal()">取消</button>
      <button class="jg-btn jg-btn-primary" onclick="saveXxx()">确定</button>
    </div>
  </div>
</div>
```

**⚠️ 两种命名并存**：`modal-box`（114 处）vs `modal-container`（27 处）。改造时统一为 `modal-box`。

### 3.6 表单字段容器（两种命名并存）

| 命名 | 出现次数 |
| --- | --- |
| `.form-row` + `.form-item` | 161 |
| `.form-field` | 118 |

### 3.7 统计卡（两种命名并存）

| 命名 | 出现次数 |
| --- | --- |
| `.stat-row` + `.stat-card` | 22 / 154 |
| `.patrol-stats` + `.patrol-stat-card` | 14 / 61 |

### 3.8 反馈与确认

| 方式 | 次数 | 说明 |
| --- | --- | --- |
| `Toast.success()` | 150 | 主要反馈方式 |
| `Toast.error()` | 88 | — |
| `Toast.warning()` | 84 | — |
| `alert()` | 辅 | ⚠️ 应替换为 Toast |
| `ConfirmDialog.show()` | 34 | ⚠️ danger 默认 true（见 `09` 章 §3.2） |
| `Confirm.delete()` | 6 | Promise 式，推荐 |

### 3.9 🔴 分页三形态（统一任务 TC-PAG-001）

| 形态 | 页数 | 说明 |
| --- | --- | --- |
| **全局 `Pagination`** | 26 | `common-functions.js:82`，容器约定 `pagination-container` |
| **内联 `const Pagination` 副本** | 11 | 见 `09` 章 §4.3 清单；这些页面**不引 common-functions.js** |
| **完全自写** | 其余 | 两种子类：<br>① 带 input 跳页框（`material_inventory`），文案「第 X 页 / 共 N 页，共 M 条记录」<br>② 轻量版（`patrol_route`），文案「共 N 条记录」，无页码收敛 |

**⚠️ 分页文案三种不一致**：

```
全局版：      第 X 页/共 Y 页，共 Z 条记录
自写①：       第 X 页 / 共 Y 页，共 Z 条记录   （斜杠前后有空格）
自写②：       共 Z 条记录                      （无页码信息）
```

**目标格式**（`02-架构总览.md` §4.1 已定）：

```
‹ 1 2 3 › 第 X 页/共 Y 页，共 Z 条记录
```

### 3.10 数据层两种形态

| 形态 | 代表 | 说明 |
| --- | --- | --- |
| **走 Store** | `material_inventory` → `MaterialStore` | 6 个 PC Store |
| **直读 localStorage** | `patrol_route` → `readJSON/writeJSON` 自实现 | ⚠️ 违反 `01` 章 §4.1 唯一入口原则 |

> 改造原则：**统一走 Store**。直读型页面需逐页建 Store 或归入已有 Store。

---

## 4. 依赖引用统计

| 文件 | 引用页数 |
| --- | --- |
| `css/design-system.css` | 94 |
| `css/unified-theme.css` | 94 |
| `css/typography.css` | 94 |
| `css/page-content.css` | 93 |
| `css/sidebar-layout.css` | 70 |
| `iconify CDN` | 94 |
| `js/icons.js` | 93 |
| `js/typography.js` | 71 |
| `js/common-functions.js` | 65 |
| `js/search-helper.js` | 50 |
| `js/components/modal.js` | 24 |
| `js/components/confirm.js` | 16 |
| `js/shared/demo-seed.js` | 14 |
| `js/shared/device-store.js` | 3 |
| `js/material-store.js` | 7 |

---

## 5. 页面清单（96 页）

### 5.1 外壳与公共页（3 页，不挂导航）

| 页面编号 | 文件 | 中文名 | 说明 |
| --- | --- | --- | --- |
| `PC-SHELL-001` | `index.html` | 后台外壳 | iframe 容器 + 侧栏 + 顶栏 + 面包屑 + 权限过滤 |
| `PC-SHELL-002` | `login.html` | 登录页 | 5 个演示账号 |
| `PC-HOME-001` | `home.html` | 系统首页 | 顶部单列一级菜单 |

### 5.2 企业管理（4 页）

| 页面编号 | 文件 | 中文名 |
| --- | --- | --- |
| `PC-ENT-001` | `enterprise_info.html` | 企业信息 |
| `PC-ENT-002` | `enterprise_base.html` | 基地管理 |
| `PC-ENT-003` | `enterprise_plot.html` | 地块管理 |
| `PC-ENT-004` | `vr_panorama.html` | VR全景 |

### 5.3 生产管理（8 页）

| 页面编号 | 文件 | 中文名 |
| --- | --- | --- |
| `PC-FARM-001` | `farming_plan.html` | 农事计划 |
| `PC-FARM-002` | `task_assign.html` | 任务分配 |
| `PC-FARM-003` | `farming_record.html` | 农事记录 |
| `PC-FARM-004` | `guide_standard.html` | 农事标准 |
| `PC-FARM-005` | `farming_patrol.html` | 巡园管理 |
| `PC-FARM-006` | `drone_patrol.html` | 无人机巡检 |
| `PC-FARM-007` | `drone_log.html` | 飞行日志 |
| `PC-FARM-008` | `patrol_route.html` | 巡园路线 |

### 5.4 采收管理（5 页）

| 页面编号 | 文件 | 中文名 |
| --- | --- | --- |
| `PC-HARV-001` | `harvest_plan.html` | 采收计划 |
| `PC-HARV-002` | `harvest_record.html` | 采收记录 |
| `PC-HARV-003` | `harvest_process.html` | 采后处理 |
| `PC-HARV-004` | `harvest_post.html` | 采收发货 |
| `PC-HARV-005` | `harvest_storage.html` | 储藏管理 |

### 5.5 物资管理（7 页）

| 页面编号 | 文件 | 中文名 |
| --- | --- | --- |
| `PC-MAT-001` | `material_info.html` | 农资信息 |
| `PC-MAT-002` | `material_inventory.html` | 农资库存 |
| `PC-MAT-003` | `material_io.html` | 农资出入库 |
| `PC-MAT-004` | `material_return.html` | 农资退货 |
| `PC-MAT-005` | `material_supplier.html` | 农资供应商 |
| `PC-MAT-006` | `material_usage.html` | 农资使用 |
| `PC-MAT-007` | `material_label.html` | 标签管理 |

### 5.6 溯源管理（6 页）

| 页面编号 | 文件 | 中文名 |
| --- | --- | --- |
| `PC-TRACE-001` | `trace_batch.html` | 批次管理 |
| `PC-TRACE-002` | `trace_code.html` | 溯源编码 |
| `PC-TRACE-003` | `trace_query.html` | 溯源查询 |
| `PC-TRACE-004` | `trace_config.html` | 溯源配置 |
| `PC-TRACE-005` | `trace_statistics.html` | 溯源统计 |
| `PC-TRACE-006` | `trace_blockchain.html` | 区块链存证 |

### 5.7 认养管理（7 页）

| 页面编号 | 文件 | 中文名 |
| --- | --- | --- |
| `PC-ADOPT-001` | `adoption_tree.html` | 认养果树 |
| `PC-ADOPT-002` | `adoption_farming.html` | 认养农事 |
| `PC-ADOPT-003` | `adoption_harvest.html` | 认养采收 |
| `PC-ADOPT-004` | `adoption_order.html` | 认养订单 |
| `PC-ADOPT-005` | `adoption_photo.html` | 成长相册 |
| `PC-ADOPT-006` | `adoption_cert.html` | 认养证书 |
| `PC-ADOPT-007` | `adoption_browse.html` | 认养展示配置 |

### 5.8 预警管理（5 页）

| 页面编号 | 文件 | 中文名 |
| --- | --- | --- |
| `PC-ALERT-001` | `alert_overview.html` | 预警总览 |
| `PC-ALERT-002` | `alert_device.html` | 设备预警 |
| `PC-ALERT-003` | `alert_farming.html` | 农事预警 |
| `PC-ALERT-004` | `alert_internal_report.html` | 内部报告 |
| `PC-ALERT-005` | `alert_settings.html` | 预警设置 |

### 5.9 设备管理（7 页）

| 页面编号 | 文件 | 中文名 |
| --- | --- | --- |
| `PC-DEV-001` | `device_access.html` | 设备接入配置 |
| `PC-DEV-002` | `gateway_config.html` | 网关与协议 |
| `PC-DEV-003` | `video_monitor.html` | 视频监控 |
| `PC-DEV-004` | `device_info.html` | 设备信息 |
| `PC-DEV-005` | `device_log.html` | 设备日志 |
| `PC-DEV-006` | `device_maintain.html` | 设备维护 |
| `PC-DEV-007` | `mb_device_maintain.html` | 移动端报修 |

### 5.10 证书管理（2 页）

| 页面编号 | 文件 | 中文名 |
| --- | --- | --- |
| `PC-CERT-001` | `cert_manage.html` | 证书管理 |
| `PC-CERT-002` | `cert_issue.html` | 农产品合格证 |

### 5.11 经营分析（9 页）

| 页面编号 | 文件 | 中文名 | 数据源 |
| --- | --- | --- | --- |
| `PC-BIZ-001` | `report_overview.html` | 报表总览 | 多源聚合 |
| `PC-BIZ-002` | `report_revenue.html` | 营收报表 | `h5_orders` |
| `PC-BIZ-003` | `report_cost.html` | 成本报表 | mock |
| `PC-BIZ-004` | `report_profit.html` | 利润报表 | `h5_orders` |
| `PC-BIZ-005` | `biz_revenue_mix.html` | 收入构成 | `BizStore` |
| `PC-BIZ-006` | `biz_receivable.html` | 应收周转 | `BizStore` |
| `PC-BIZ-007` | `biz_metrics.html` | 经营指标 | `BizStore` |
| `PC-BIZ-008` | `performance_dashboard.html` | 绩效看板 | `snzg_performance_results` |
| `PC-BIZ-009` | `performance_detail.html` | 绩效详情 | mock |

### 5.12 销售管理（3 页）

| 页面编号 | 文件 | 中文名 | 数据源 |
| --- | --- | --- | --- |
| `PC-SALES-001` | `sales_order.html` | 销售订单 | `h5_orders` / `h5_sales_orders` |
| `PC-SALES-002` | `sales_customer.html` | 客户管理 | mock |
| `PC-SALES-003` | `sales_statistics.html` | 销售统计 | `snzg_sales_query` |

### 5.13 数据运营（4 页）

| 页面编号 | 文件 | 中文名 | 数据源 |
| --- | --- | --- | --- |
| `PC-DATA-001` | `data_source.html` | 数据源接入 | `DataStore` |
| `PC-DATA-002` | `data_collection.html` | 数据归集 | `DataStore` |
| `PC-DATA-003` | `model_monitor.html` | 模型监控 | `DataStore` |
| `PC-DATA-004` | `achievement_record.html` | 成效记录 | `DataStore` |

### 5.14 模型管理（7 页）

| 页面编号 | 文件 | 中文名 | 特殊 |
| --- | --- | --- | --- |
| `PC-MODEL-001` | `model_config.html` | 模型配置 | — |
| `PC-MODEL-002` | `model_growth.html` | 生长模型 | 写 `orchard_farming_prefill` |
| `PC-MODEL-003` | `model_phenology.html` | 物候模型 | 同上 |
| `PC-MODEL-004` | `model_weather.html` | 气象模型 | 同上 |
| `PC-MODEL-005` | `model_pest.html` | 病虫害模型 | 同上（2 处写入） |
| `PC-MODEL-006` | `model_yield.html` | 产量模型 | — |
| `PC-MODEL-007` | `model_price.html` | 价格模型 | — |

> ⚠️ 5 个 model 页向 `orchard_farming_prefill` 写入**数组形态**，而 `farming_plan` 写**对象形态** → 见 `03-数据契约.md` L-D08。

### 5.15 商城管理（7 页）

| 页面编号 | 文件 | 中文名 | 数据源 |
| --- | --- | --- | --- |
| `PC-MALL-001` | `mall_product.html` | 商品管理 | `mall_products` |
| `PC-MALL-002` | `mall_coupon.html` | 优惠券管理 | `mall_coupons` |
| `PC-MALL-003` | `mall_member.html` | 会员管理 | mock |
| `PC-MALL-004` | `mall_promotion.html` | 促销活动 | `mall_promotions` |
| `PC-MALL-005` | `mall_order.html` | C端订单 | `h5_orders` |
| `PC-MALL-006` | `mall_community.html` | 社区审核 | `h5_community_*` |
| `PC-MALL-007` | `mall_invoice.html` | 发票管理 | `h5_invoices` |

### 5.16 移动端运营（8 页）

| 页面编号 | 文件 | 中文名 | 数据源 |
| --- | --- | --- | --- |
| `PC-MB-001` | `mb_feedback_review.html` | 意见反馈审核 | mock |
| `PC-MB-002` | `mb_expert_reply.html` | 专家咨询回复 | mock |
| `PC-MB-003` | `mb_staff_account.html` | 作业人员账号 | `mb_staff_accounts` |
| `PC-MB-004` | `mb_message.html` | 消息推送 | mock |
| `PC-MB-005` | `mb_sync_queue.html` | 同步队列 | `smartorchard_sync_queue` |
| `PC-MB-006` | `mb_ai_config.html` | AI助手配置 | `mb_ai_config` |
| `PC-MB-007` | `mb_disease_config.html` | 识别规则配置 | `mb_disease_rules` |
| `PC-MB-008` | `mb_fault_knowledge.html` | 设备故障知识库 | mock |

### 5.17 系统管理（4 页）

| 页面编号 | 文件 | 中文名 | 特殊 |
| --- | --- | --- | --- |
| `PC-SYS-001` | `system_settings.html` | 系统设置 | 🔴 权限矩阵写入方（104 KB，最大页面） |
| `PC-SYS-002` | `guide_calculator.html` | 用肥计算 | 工具页 |
| `PC-SYS-003` | `user_settings.html` | 用户设置 | 写 `snzg_user_accounts` |
| `PC-SYS-004` | `menu_settings.html` | 菜单设置 | ⚠️ 批次 4 后补登（附录 D `L-DEAD-07`）；写 `smartorchard_menus`，但侧栏不读（`L-MENU-01`） |

**合计**：3 + 4 + 8 + 5 + 7 + 6 + 7 + 5 + 7 + 2 + 9 + 3 + 4 + 7 + 7 + 8 + 4 = **96 页** ✅

---

## 6. 跨页面统一改造任务

以下改造**同时影响多个页面**，需单独开任务卡，串行执行：

| 任务卡 | 任务 | 影响页数 | 优先级 |
| --- | --- | --- | --- |
| `TC-PAG-001` | **统一分页**：4 种 id 变体 → `pagination-container`；3 种文案 → 统一格式；11 页内联 Pagination 副本 → 删 | ~28 | **P1** |
| `TC-CMP-001` | **统一弹窗容器名**：`modal-container`（27 处）→ `modal-box` | 27 | P2 |
| `TC-CMP-002` | **统一表单字段容器名**：`form-field`（118 处）→ `form-item` | ~40 | P2 |
| `TC-CMP-003` | **统一统计卡命名**：`patrol-stat-*` → `stat-*` | ~14 | P3 |
| `TC-CMP-004` | **替换 `alert()` 为 `Toast`** | 全站 | P2 |
| `TC-CMP-005` | **统一空态**：`<div class="empty-state">` + `hidden` 属性 | ~40 | P2 |
| `TC-CMP-006` | **补 `data-section` 容器**：23 页缺 | 23 | P2 |
| `TC-CMP-007` | **品种下拉共享常量**：4 处硬编码 → `VARIETY_OPTIONS` | 4+ | P2 |
| `TC-SEC-001` | **删除 `data-active-menu` / `data-active-submenu` 占位属性**（无消费） | 91 | P3 |
| `TC-SEC-002` | **删除 `.tab-bar` 空壳**（CSS 强制隐藏） | 91 | P3 |

---

## 7. 详设编写进度

| 文件 | 页数 | 状态 |
| --- | --- | --- |
| `README.md` | — | ✅ 完成 |
| `01-企业管理.md` | 4 | ✅ 完成 |
| `02-生产管理.md` | 8 | ✅ 完成 |
| `03-采收物资溯源.md` | 18 | ✅ 完成 |
| `04-认养预警设备.md` | 21 | ✅ 完成 |
| `05-经营销售数据模型.md` | 23 | ✅ 完成 |
| `06-商城移动端系统.md` | 21 | ✅ 完成 |

---

## 下一步

**批次 4 已完成**：6 个文件覆盖 96 页（4 + 8 + 18 + 21 + 23 + 22 = 96），每页 12 区块齐全。其中 `PC-SYS-004 菜单设置` 为批次 4 后补登（见附录 D `L-DEAD-07`）。

下一步进入**批次 5**：mobile 33 页 + h5 16 页 + dashboard 10 页 + portal 1 页，共 60 页，按端拆分为独立目录与文件。