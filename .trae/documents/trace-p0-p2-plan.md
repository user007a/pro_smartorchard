# 溯源管理 P0 / P1 / P2 实施计划

## Context

当前溯源管理 8 个页面（批次、编码、查询、配置、统计、区块链、标签、H5）各自维护静态 mock，存在以下核心问题：

- 批次、追溯码、H5、查询页存在多份真源，同批次基地名 / 产品名不一致。
- 批次手工建批，未与采收记录、采后处理单打通。
- 没有检测报告实体与门禁，`trace_config` 还能关闭农残检测。
- 二维码下载是前端画的假矩阵，不可扫；落地地址依赖本地路径。
- 区块链存证哈希只算 `code + time`，验证只看静态状态，无原文、无链式关系。
- 标签管理缺模板 / 版式 / 版本 / 打印任务 / 重打 / 报废 / 库存预占。
- H5 只有 7 段静态文案，没有检测报告、基地实景、视频、气象、墒情、首查提示。

目标：以「批次 → 检测报告 → 追溯码 → 扫码 / 存证 → 标签」为主线建立单一真源，按 P0 → P1 → P2 分阶段落地，不做多语言，保持现有 Ant Design 蓝白 PC 风格与 H5 风格。

已确认约束：

1. 检测报告由检测机构出具，可上传附件，**不强制 CMA / CNAS**。
2. 没有公网 HTTPS 域名，**允许使用短链**；短链域名做成可配置项。
3. **允许展示视频**。

---

## 一、总体设计

### 1. 新增唯一数据源 `html/applefarm_backhand/js/shared/trace-store.js`

`window.TraceStore`，localStorage key：`smartorchard_trace_v1`，VERSION = 3。所有溯源页面与 H5 只读写这一份数据。

数据结构：

```
{
  version, batches[], inspections[], codes[], labelTemplates[],
  labelStock{}, labelReservations[], printJobs[], events[], scans[],
  auditLogs[], recalls[], channelAlerts[], regulatoryReports[],
  apiKeys[], codeSegments[], config{}
}
```

关键字段：

- `batches[]`：`batchNo / sourceRecordId / planNo / processNo / plotCode / plotName / base / variety / product / spec / grade / harvestDate / quantity / status / codeCount / shipment / createdAt`
- `inspections[]`：`batchNo / reportNo / institution / reportType / sampleDate / issueDate / validUntil / conclusion / items[] / attachment{name,size,type,dataUrl?} / cma / cnas / status`
- `codes[]`：`code / shortCode / batch / time / status / order / template / queries / firstScanAt / lastQuery`
- `events[]`：`id / batchNo / code / type / title / summary / payload / hash / prevHash / blockHeight / txId / chainTime / status`
- `printJobs[]`：`id / batchNo / labelName / templateId / templateVersion / qty / operator / status / reprintOf / reason / createdAt / codes[]`
- `scans[]`：`code / at / source / region / device / result / riskFlag / riskReason`

核心 API：

- 批次：`batches() / batch() / saveBatch() / removeBatch() / harvestCandidates() / createBatchFromHarvest(recordId)`
- 检测：`inspectionsOf() / saveInspection() / removeInspection() / inspectionState(batchNo)` → `{required:true, hasValid, canCode, latest, message}`
- 追溯码：`codes() / code() / codeByShort() / generateCodes(batchNo,count,opts)`（内部检测门禁）/ `updateCode()`
- 短链：`shortUrlOf(code)`，`config.shortLinkBase` 默认 `https://t.snzg.cn`，短码由 trace code 稳定生成。
- 扫码：`recordScan(code, meta)` → 自增查询次数、写首查时间、写扫码日志、首查/异常时追加事件。
- 存证：`events() / appendEvent() / verifyChain() / verifyEvent(id)`，SHA-256(prevHash + 规范化 payload) 链式哈希。
- 标签：`templates() / saveTemplate() / printJobs() / createPrintJob() / reprintJob() / scrapJob() / stock() / reserveStock() / releaseReservation() / consumeStock()`
- 风控监管：`recalls() / createRecall() / channelAlerts() / regulatoryReports() / apiKeys() / codeSegments()`
- 基地环境：`environmentOf(batchNo)` → `{vrUrl, videoUrl, weather{temp,humidity,rainfall,wind,updatedAt}, soil{temp,moisture,ph,ec,updatedAt}, captures[]}`
- 通用：`config() / saveConfig() / audit() / auditLogs() / subscribe() / reset()`

种子策略：

- 若 `HarvestStore` 已加载：读取采收记录、采后处理、储藏、发货，按采收日期生成 `PC-YYYYMMDD-NNN` 批次，自动带出地块 / 基地 / 品种 / 数量 / 处理单 / 发货状态。保留 20 条现有 `PC-202609xx` 编号，保证存量追溯码不断链。
- 若未加载：使用内置 20 条批次兜底。
- 检测报告：20 个批次中播种有效、过期、撤销、缺失四种状态，用于演示门禁；`PC-20260903/004/010/018/020` 为非有效，`PC-20260907` 无报告。
- 追溯码：迁入现有 23 条样例，补齐短码、首查时间、最后查询。
- 事件：按「建批 / 检测报告 / 赋码 / 激活 / 首查 / 出库」生成链式事件。
- 标签：迁入现有 3 种标签库存，生成 3 条打印任务样例。
- 配置：`inspectionRequired` 强制为 `true`，页面只读展示，不提供关闭入口。

### 2. 数据流

```
采收记录(HarvestStore)
  → TraceStore.batches
  → 检测报告上传 / 有效性校验
  → 生成追溯码（无有效报告则拒绝）
  → 短链 + 真实二维码
  → H5 / 查询页扫码
  → 扫码日志 + 首查提示 + 异常预警
  → 事件级链式存证
  → 标签打印任务 / 重打 / 报废
  → 统计 / 监管报送 / 召回
```

---

## 二、P0：单一真源 + 检测门禁 + 可扫码 + 数据一致

### 2.1 批次管理 `trace_batch.html`

- 引入 `harvest-store.js`、`trace-store.js`，删除页面内 `mockBatchData` / `BATCH_STORE_KEY` 读写。
- 批次列表改为 `TraceStore.batches()`；状态、基地、产品、地块、码数统一来自 Store。
- 新增「从采收记录建批」：弹窗选择 `TraceStore.harvestCandidates()`，自动带出批次号、基地、地块、品种、采收日期、数量、采后处理单，调用 `createBatchFromHarvest`。
- 表格增加「检测报告」列：`有效 / 过期 / 已撤销 / 缺失`，颜色区分；码数列显示已生成数量。
- 新增「检测报告」弹窗：
  - 报告编号、检测机构、报告类型、抽样日期、出具日期、有效期至、结论（合格 / 不合格）。
  - 检测项目可编辑（农残 / 重金属），显示项目、结果、单位、限量、是否合格。
  - 附件上传：`input[type=file]`，≤300KB 存 dataURL 便于预览 / 下载，超出只存文件元数据。
  - CMA / CNAS 为选填，不作为必填校验。
- 批次详情增加：检测报告摘要、检测门禁状态、基地环境摘要（VR / 视频 / 气象 / 墒情）、存证状态。
- 「生成追溯码」前调用 `inspectionState`，无有效报告时提示并禁止跳转 / 生成。

### 2.2 溯源编码 `trace_code.html`

- 批次、追溯码全部改为 `TraceStore`。
- 生成弹窗选择批次后显示检测报告状态；无有效报告时禁用「确认生成」并提示去批次管理补录。
- `confirmGenerate` 调用 `TraceStore.generateCodes()`，由 Store 二次校验门禁。
- 二维码改为真实可扫：
  - 引入 `qrcodejs`（CDN），优先本地生成 QR；失败时回退 `api.qrserver.com`。
  - 编码内容使用短链 `TraceStore.shortUrlOf(code)`。
  - 下载二维码改为从 QR canvas 导出真实 PNG，不再画假矩阵。
- 详情增加：检测报告、短链、H5 预览链接、首次扫码时间、存证哈希。
- 打印标签改为调用 `TraceStore.createPrintJob()`，扣减库存同时生成打印任务，供标签管理页查看。

### 2.3 溯源查询 `trace_query.html`

- 追溯码、批次、检测、事件全部改为 `TraceStore`。
- 详情增加：
  - 检测报告卡片：机构、编号、结论、有效期、附件名称 / 下载。
  - 基地实景卡片：VR 入口、视频 / 监控快照、气象、墒情，全部带更新时间。
  - 首查提示：展示「首次查询 / 已查询 N 次 / 最后查询时间」。
  - 存证卡片：事件哈希、区块高度、验证结果。
- 扫码时调用 `TraceStore.recordScan()`，写扫码日志；异常扫码标红提示。

### 2.4 H5 溯源 `html/applefarm_h5/trace_h5.html`

- 引入 `../applefarm_backhand/js/shared/harvest-store.js` 与 `trace-store.js`。
- 批次、码、模板全部来自 `TraceStore`；保留旧 `CODE_MAP` 仅作兜底。
- 支持 `?code=` 与短链 `?c=` 两种入口。
- 新增固定模块（不受模板模块开关影响）：
  - 检测报告：机构、报告编号、结论、有效期、附件。
  - 基地实景：VR 入口、视频播放器（有 `videoUrl` 时播放，无则展示监控快照 + 更新时间）、气象、墒情。
  - 首查提示：首次查询展示防伪提示；重复查询展示次数与最后查询时间。
- 区块链存证改为读取 `TraceStore` 真实事件哈希与链信息，链上验证重算哈希。
- 页面加载调用 `recordScan(code,{source:'H5'})`。

### 2.5 菜单统一

- `index.html` 与 `js/sidebar-layout.js` 的溯源管理统一为 7 项：
  批次管理 / 溯源编码 / 溯源查询 / 溯源配置 / 溯源统计 / 区块链存证 / 标签管理。
- 统一命名：`区块链存证`（不再使用「溯源区块链」）。
- 统一 `data-active-menu="trace"` 与 `data-active-submenu`。

---

## 三、P1：链式存证 + 标签全生命周期 + 基地实景 + 物资追溯

### 3.1 区块链存证 `trace_blockchain.html`

- 列表改为 `TraceStore.events()`：事件类型、批次 / 追溯码、摘要、交易哈希、区块高度、上链时间、验证状态。
- 详情展示：原文摘要、`prevHash`、`hash`、合约地址、节点、可信时间戳（TSA）。
- 验证逻辑：重算 `sha256(prevHash + payload)` 与存储 hash 对比，并校验 `prevHash` 是否等于上一条事件 hash；支持「验证全链」。
- 新增事件时自动链式追加，不允许前端直接改历史 hash。

### 3.2 标签管理 `material_label.html`

- 保留现有领用审批表，新增两个入口：
  - 「标签模板」：模板名称、版式字段、版本号、状态；支持新建版本 / 停用版本。
  - 「打印任务」：打印批次、标签、模板版本、数量、操作人、状态；支持重打 / 报废。
- 库存改为 `TraceStore.stock()`：返回 `{stock, reserved, available}`。
- 审批通过时 `reserveStock()` 预占库存；驳回释放；打印任务 `consumeStock()` 实际扣减并释放预占。
- 打印任务记录到 `printJobs`，`trace_code.html` 打印时同步生成任务。
- 重打必须填写原因并记录 `reprintOf`；报废记录数量与操作人。
- 与 `cert_issue.html` 的合格证保持字段级可关联（批次号、标签号），本阶段先打通批次与码，不新增外部流程。

### 3.3 基地环境

- `TraceStore.environmentOf()` 按基地生成：
  - `vrUrl`：指向现有 `vr_panorama.html`。
  - `videoUrl`：可配置；未配置时展示监控快照与「视频流未接入」状态，不伪造视频。
  - `weather` / `soil`：温度、湿度、降雨、风速、土壤温湿度、pH、EC，`updatedAt` 在 30 分钟内。
  - `captures[]`：使用现有 `trace_planting / pruning / bagging / fertilizer / testing / harvest` 图片，带时间戳。
- PC 查询详情与 H5 都展示，带「数据更新时间」与「设备来源」。

### 3.4 物资追溯字段

- 在 `trace_query.html` 的农资投入轨迹中补充：登记证号、有效成分、安全间隔期、最后一次施药日期。
- 数据暂由页面 mock 增强，不改造物资页面；后续可由物资 Store 提供。

### 3.5 配置 `trace_config.html`

- 模块「农残检测」改为强制勾选、不可取消，标注「必需，不可关闭」。
- C 端展示配置中 `testing` 环节强制启用，`toggleCStage` 禁止关闭。
- 新增只读卡片「检测报告管控」：必须上传、结论必须合格、有效期必须覆盖采收日期；`inspectionRequired` 不可关闭。
- 新增展示开关：基地视频、VR 实景、气象墒情，写入 `TraceStore.config()`。

---

## 四、P2：风控与监管

在 `trace_statistics.html` 新增「风控与监管」区块（不新建页面）：

- **召回管理**：按批次发起召回，记录原因、范围、状态；列表来自 `TraceStore.recalls()`。
- **窜货 / 异常扫码预警**：展示 `channelAlerts` 与 `scans` 中的异地、高频、重复扫码，标红。
- **监管报送**：按批次生成报送包（批次、检测报告、事件链、扫码统计），记录 `regulatoryReports` 状态。
- **开放 API**：展示 `apiKeys`（脱敏）与调用统计，提供「生成 Key」原型操作。
- **码段风控**：展示 `codeSegments` 已用 / 总量 / 异常码段，支持冻结码段。

证据包：`TraceStore.exportEvidence(batchNo)` 输出 JSON（批次、检测报告、事件链、扫码日志、标签任务），PC 与 H5 均可下载。

---

## 五、涉及文件

新增：

- `html/applefarm_backhand/js/shared/trace-store.js`

修改：

- `html/applefarm_backhand/trace_batch.html`
- `html/applefarm_backhand/trace_code.html`
- `html/applefarm_backhand/trace_query.html`
- `html/applefarm_backhand/trace_config.html`
- `html/applefarm_backhand/trace_blockchain.html`
- `html/applefarm_backhand/trace_statistics.html`
- `html/applefarm_backhand/material_label.html`
- `html/applefarm_backhand/index.html`
- `html/applefarm_backhand/js/sidebar-layout.js`
- `html/applefarm_h5/trace_h5.html`

不新建多语言文件，不改造物资主数据页面。

---

## 六、验收方式

1. 在 `d:\dev\pro_smartorchard` 启动静态服务（如 `python -m http.server 8000`），打开 `http://localhost:8000/html/applefarm_backhand/index.html`。
2. 菜单：溯源管理 7 项一致，命名统一。
3. 批次：
   - 列表数据与采收记录一致；「从采收记录建批」可成功创建。
   - `PC-20260907-007` 无报告，状态显示「缺失」，生成追溯码被拒绝。
   - 上传报告并填写合格结论后，门禁放行。
4. 编码：
   - 有效报告批次可生成码；短链与二维码可扫描（用手机或浏览器扫码工具验证短链内容）。
   - 下载二维码为真实 PNG，可被识别。
5. 查询 / H5：
   - 同一批次在批次、编码、查询、H5 中基地 / 产品 / 地块完全一致。
   - H5 展示检测报告、VR / 视频 / 气象 / 墒情、首查提示。
6. 区块链：验证单条与全链；篡改 `payload` 后验证失败。
7. 标签：审批预占、打印扣减、重打、报废、模板版本均能在打印任务中看到。
8. 统计：召回、异常扫码、监管报送、API Key、码段风控可操作。
9. 浏览器 Console 无报错；localStorage 仅保留 `smartorchard_trace_v1` 作为溯源主数据。
