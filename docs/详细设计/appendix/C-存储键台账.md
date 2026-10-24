# 附录 C · 存储键台账

> **本章是 `04-存储契约.md` §2 的速查索引**，按 key 字母序排列，供快速定位。
> **字段定义见 `03-数据契约.md`，schema/读写/容量/回退见 `04-存储契约.md` §2。**

---

## 1. 总览

| 类别 | 数量 | 管理方 |
| --- | --- | --- |
| PC Store 键 | 6 | 6 个 PC Store |
| 移动端共享键 | 9 | `MobileStore` |
| 桥接读取键 | 11 | `MobileBridge` |
| PC 后台散落键 | 19 | ⚠️ 无 Store，页面直写 |
| H5 端键 | 21 | 部分有数据层脚本 |
| UI 偏好键 | 4 | 页面直写（允许） |
| **localStorage 合计** | **54**（去重后） | — |
| sessionStorage 键 | 5–7 | 登录态 |

---

## 2. 按字母序索引

| key | 类型 | 管理方 | 契约号 | 遗留 |
| --- | --- | --- | --- | --- |
| `DSEED_DISABLED` | 字符串 | `demo-seed.js` | §2.6 | — |
| `aiHistory` | 数组 | 页面直写 | — | 🟡 |
| `applefarm_alert_state_v1` | **数组** | `AlertStore` | ST-PALERT-001 | L-D01 L-D04 |
| `applefarm_biz_v1` | 对象 | `BizStore` | ST-PBIZ-001 | — |
| `applefarm_data_ops_v1` | 对象 | `DataStore` | ST-PDDATA-001 | L-D03 |
| `applefarm_device_v1` | 对象 | `DeviceStore` | ST-PDEVICE-001 | ⚠️ 未提交 · L-D09 |
| `applefarm_trace_stats_v1` | 对象 | `TraceStatStore` | ST-PTRACE-001 | — |
| `cert_stamp_dataurl` | 字符串 | 页面直写 | ST-CERT-002 | 🔴 L-CERT-001 |
| `device_log_cleared_at` | 字符串 | 页面直写 | ST-DEV-001 | ⚪ L-DEAD-04 |
| `h5_addresses` | 数组 | 页面直写 | ST-H5-003 | — |
| `h5_adoption_photos` | **对象** | 页面直写 + `adoption_photo` | ST-H5-011 | 🟡 双键并存 |
| `h5_browser_cache_v` | 字符串 | `h5_settings` | ST-H5-015 | — |
| `h5_cart` | 数组 | 页面直写 | ST-H5-001 | 🟡 无 user |
| `h5_checkout_draft` | 对象 | 页面直写 | ST-H5-013 | — |
| `h5_checkout_single` | — | 仅 `removeItem` | ST-H5-014 | ⚪ L-DEAD-03 |
| `h5_community_comments` | **对象** | 页面直写 | ST-H5-009 | — |
| `h5_community_likes` | **对象** | 页面直写 | ST-H5-010 | — |
| `h5_community_posts` | 数组 | 页面直写 | ST-H5-008 | — |
| `h5_coupon_code` | 字符串 | 页面直写 | ST-H5-020 | — |
| `h5_favorites` | 数组 | 页面直写 | ST-H5-004 | 🟡 L-D13 无 user |
| `h5_invoices` | 数组 | 页面直写 | ST-H5-005 | — |
| `h5_messages_read` | 数组 | 页面直写 | ST-H5-020 | — |
| `h5_orders` | 数组 | 页面直写 | ST-H5-002 | 🟡 双状态字段 |
| `h5_points` | 数组 | 页面直写 | ST-H5-006 | — |
| `h5_points_used` | **字符串** | 页面直写 | ST-H5-007 | — |
| `h5_sales_orders` | 数组 | 页面直写 + **移动端** | ST-H5-012 | ⚠️ 唯一 C 端与移动端共写 |
| `h5_trace_stages` | 数组 | `trace-stages.js`（读）← `trace_config.html`（写） | ST-H5-021 | ⚠️ 本轮补登（原台账遗漏） |
| `mall_coupons` | 数组 | `mall-coupons.js` | ST-H5-017 | — |
| `mall_products` | 数组 | `mall-products.js` | ST-H5-016 | — |
| `mall_promotions` | 数组 | `mall-promotions.js` | ST-H5-018 | 🟡 空数组不回填 |
| `material_approval_logs` | 数组 | 页面直写 | ST-MAT-101 | 🟡 建议并入 MaterialStore |
| `material_refund_logs` | 数组 | 页面直写 | ST-MAT-102 | 🟡 建议并入 MaterialStore |
| `mb_ai_config` | 对象 | 页面直写 | — | — |
| `mb_disease_rules` | 数组 | 页面直写 | — | — |
| `mb_patrol_base` | 字符串 | 页面直写 | — | — |
| `mb_patrol_routes` | 数组 | `patrol_route` | ST-MOB-010 | — |
| `mb_staff_accounts` | 数组 | 页面直写 | — | 🔴 含明文 pwd |
| `orchard_farming_prefill` | **数组/对象双形态** | 5 个页面 | ST-FARM-001 | 🔴 L-D08 |
| `plots` | 数组 | 遗留 | — | ⚪ L-D12 |
| `rememberedPwd` | 字符串 | `mb_login` | §2.7 | 🔴 Base64 非加密 |
| `rememberedUser` | 字符串 | `mb_login` | §2.7 | — |
| `sidebar-collapsed` | 字符串 | `sidebar-layout.js` | §2.6 | ⚪ L-DEAD-02 |
| `sidebar-tabs` | 字符串 | `sidebar-layout.js` | §2.6 | ⚪ L-DEAD-02 |
| `smartorchard_adoption_shipments` | 数组 | 页面直写 | ST-SHIP-001 | — |
| `smartorchard_adoption_tag_archive` | 数组 | 移动端 | — | 🟡 容量（已防护） |
| `smartorchard_adoption_tags` | 数组 | `MobileStore` | ST-MOB-008 | — |
| `smartorchard_current_user` | 对象 | 移动端 + H5 | §2.7 | 🟡 两端字段不同 |
| `smartorchard_drone_abnormal` | 数组 | ⚠️ 页面直写 | ST-XEND-011 | 🔴 L-A01 · L-DEAD-06 |
| `smartorchard_drone_events` | 数组 | ⚠️ 页面直写 | ST-XEND-010 | 🔴 L-A01 · L-DEAD-06 |
| `smartorchard_farming_records` | 数组 | `MobileStore` | ST-MOB-002 | 🟡 L-D02 |
| `smartorchard_harvest_reservations` | — | 移动端 | ST-HARV-001 | ⚠️ 结构未明确 |
| `smartorchard_issued_certs` | 数组 | 页面直写 | ST-CERT-001 | 🟡 建议建 Store |
| `smartorchard_label_records` | 数组 | `MobileStore` + PC | ST-MOB-007 | 🟡 L-D02 中文状态 |
| `smartorchard_label_stock` | **对象** | PC 写 / 移动端读 | ST-MOB-006 | 🟡 L-D05 |
| `smartorchard_label_types` | 数组 | 页面直写 | — | 🟡 与 stock 主键不一致 |
| `smartorchard_maintenance_logs` | 数组 | ⚠️ 页面直写 | ST-XEND-009 | 🔴 L-A01 |
| `smartorchard_material_logs` | 数组 | `MobileStore` | ST-MOB-005 | 🟡 L-D11 时间格式 |
| `smartorchard_material_store_v1` | 对象 | `MaterialStore` | ST-PMAT-001 | 🟡 L-D07 无订阅 |
| `smartorchard_patrol_records` | 数组 | `MobileStore` | ST-MOB-003 | 🟡 L-D02 L-D11 |
| `smartorchard_plots` | 数组 | `MobileStore` | ST-MOB-004 | 🟡 area 为字符串 |
| `smartorchard_service_action` | 数组 | `MobileStore` | ST-MOB-009 | — |
| `smartorchard_sync_queue` | 数组 | `MobileStore` | ST-MOB-001 | — |
| `smartorchard_trace_batches` | 数组 | 页面直写 | ST-TRACE-101 | 🟡 建议建 Store |
| `snzg_adoption_income` | 数组 | **无写入方** | ST-ADOPT-002 | ⚪ L-DEAD-05 |
| `snzg_adoptions` | 数组 | 页面直写 | ST-ADOPT-001 | 🟡 6 个别名 · 编号双格式 |
| `snzg_logged_in` | 字符串 | `login.html` | §2.7 | — |
| `snzg_passwords` | 对象 | 页面直写 | ST-USER-004 | 🔴 明文密码 |
| `snzg_permissions` | 对象 | 页面直写 | ST-USER-003 | 🔴 L-D06 双 key |
| `snzg_performance_results` | 数组 | 页面直写 | ST-PERF-001 | — |
| `snzg_roles` | 数组 | 页面直写 | ST-USER-002 | 🟡 id 类型不统一 |
| `snzg_sales_query` | 对象 | 页面直写 | ST-SALES-001 | — |
| `snzg_user` | 对象 | `login.html` | §2.7 | — |
| `snzg_user_accounts` | 对象 | 页面直写 | ST-USER-001 | 🔴 密码明文 |
| `snzg_user_states` | 对象 | 页面直写 | ST-USER-005 | 🟡 与 disabled 重复 |
| `smartorchard_menus` | 数组 | `menu_settings.html` | — | ⚠️ 本轮补登 · 菜单真源，但侧栏 `MENU_GROUP_MAP` 未读它（见 D 台账 L-MENU-01） |

### sessionStorage

| key | 端 | 类型 | 契约号 |
| --- | --- | --- | --- |
| `isLoggedIn` | 移动端 + H5 | 字符串 `'true'` | §2.7 |
| `loginRole` | 移动端 + H5 | 字符串 | §2.7 |
| `loginUser` | 移动端 + H5 | 字符串 | §2.7 |
| `loginUserProfile` | H5 | 对象 | §2.7 |
| `snzg_logged_in` | PC | 字符串 `'1'` | §2.7 |
| `snzg_user` | PC | 对象 | §2.7 |
| `trace_batch_cache` | H5 | 对象 | — |

---

## 3. 对象型 key 清单（易错点）

**用数组方法处理会解析失败**：

| key | 结构 | 读取方法 |
| --- | --- | --- |
| `smartorchard_label_stock` | `{ [标签名]: number }` | `MobileBridge` 的 `readObj()` |
| `h5_adoption_photos` | `{ [果树编号]: Array }` | 需自定义读取 |
| `h5_community_comments` | `{ [postId]: Array }` | 需自定义读取 |
| `h5_community_likes` | `{ [postId]: number }` | 需自定义读取 |
| `h5_checkout_draft` | 对象 | 需自定义读取 |
| `h5_trace_stages` | `Array<{key,name,title,icon,img,desc,enabled,order}>` | `TraceStages.all()` / `onSale()` |
| `snzg_user_accounts` | `{ [username]: {...} }` | 需自定义读取 |
| `snzg_permissions` | `{ [key]: boolean }` | 需自定义读取 |
| `snzg_passwords` | `{ [username]: string }` | 需自定义读取 |
| `snzg_user_states` | `{ [username]: string }` | 需自定义读取 |
| `mb_ai_config` | 对象 | 需自定义读取 |

**纯字符串值（非 JSON）**：

| key | 说明 |
| --- | --- |
| `cert_stamp_dataurl` | PNG dataURL |
| `h5_points_used` | 积分抵扣数 |
| `rememberedUser` / `rememberedPwd` | 明文 / Base64 |
| `device_log_cleared_at` | 时间戳 |
| `h5_browser_cache_v` | `String(Date.now())` |
| `mb_patrol_base` | 基地名 |
| `DSEED_DISABLED` | `'1'` |
| `sidebar-collapsed` / `sidebar-tabs` | UI 状态 |

---

## 4. 无引用/死键

见 `appendix/D-遗留问题台账.md` §4。共 6 项：`api-mock.js` 的 `VRAPI`、`sidebar-layout.js` 的 2 个 key、`h5_checkout_single`、`device_log_cleared_at`、`snzg_adoption_income`。

---

## 5. 新增 key 登记模板

```
| key | 类型 | 管理方 | 契约号 | 遗留 |
```

新增时必须同时更新：

```
□ 本台账（按字母序插入）
□ 04-存储契约.md §2 的分类台账
□ 03-数据契约.md 的字段定义（CT- / ST- 编号）
□ 若跨端：07-跨端联动契约.md 的链路表
```