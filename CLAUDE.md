# CLAUDE.md · 数农智果智慧果园平台

> Claude Code 在本项目中的**独立常驻约束**，自包含，不依赖 `AGENTS.md`。
> 完整条款见 `docs/详细设计/`。本文件只放硬约束 + 禁止清单 + 按需加载路径。

## 1. 项目性质（先确立认知，再动手）

「数农智果智慧果园平台」的前端部分。**纯静态：157 个 HTML、零构建、零框架、零后端。**
数据全在 `localStorage` / `sessionStorage`；源码即产物；页面必须双击以 `file://` 协议运行。
5 端 156 页：PC 后台 96 · 移动作业端 33 · H5 消费者端 16 · 数据大屏 10 · 门户 1（另加根跳转页）。

**工作形态是「在既有原型上定点改造」，不是「从零写页面」。** DOM 由 `html/` 下的原型锁定，契约不得要求重设计。

## 2. 契约文档体系：按需加载，禁止通读

`docs/详细设计/` 是**实现契约**（约 2.6 MB，353 条缺陷 + 172 张任务卡），不是叙述性设计说明。
它的价值在于消除歧义——最大失败模式不是写不出代码，而是**代码能跑但与预期不符，且偏差无人察觉**。

**2.1 单个会话的加载预算（硬性纪律，不是建议）**
```
🔴 每次只加载 2~4 个契约文件 + 1~2 页详设
🔴 禁止通读 156 页详设（pages/ 约 2.4 MB）——上下文被稀释后违反项概率上升
🔴 禁止一次性读 10 个以上契约文件
🔴 禁止把 10 张以上任务卡批量执行——错误会累积并互相污染上下文
```
**2.2 首次进入项目时的加载顺序（只此一次）**：`00-文档使用说明.md` → `01-技术栈与工程约束.md` → `02-架构总览.md`。之后每次会话只加载任务卡标注的编号。

**2.3 编号前缀 = 加载指令**
`§数字` 章节锚点 · `CT-` 数据 · `ST-` 存储 · `API-` 接口 · `EVT-` 事件 · `XC-` 跨端联动 · `UI-` 组件 · `TC-XXX-NNN` 任务卡 · `AC-` 验收断言 · `L-` 缺陷 · `SR-` 静态规则（50 条） · `PC-`/`MB-`/`H5-`/`DA-`/`PORTAL-` 5 端页面编号。

**2.4 按意图定位（摘自 `docs/详细设计/README.md` §8）**

| 我要做… | 只读这几份 |
| --- | --- |
| 判断某做法是否允许 | `01` 章禁止清单 |
| 改弹窗 / 确认框 / 提示 | `09` §0 选型决策表（**先看这个**） |
| 改列表页分页 | 该页详设「分页契约」区 + `09` §4（注意 28 份拷贝） |
| 让两端数据联动 | `07-跨端联动契约.md`（**先读，不要猜**） |
| 数据不刷新 / 跨页不同步 | `06-事件契约.md`（多半是只监听了 `storage`） |
| 换设计 token / 改配色 | `08-设计系统实现契约.md`（**只能改值不能改名**） |
| 新建页面 | `10` §2 script 顺序 + 最近似页面的详设 |
| 接后端接口 | `05` + `04` §8 生产替换点 |
| 查 key / 错误码 / 遗留问题 | `appendix/C-存储键台账.md`（54 键） / `B-错误码全表.md` / `D-遗留问题台账.md`（62 条） |

## 3. 硬约束（`01` 章提取）

违反即交付失败，不接受「功能能跑」的辩解。

| # | 硬约束 | 出处 |
| --- | --- | --- |
| H1 | 页面必须**双击即可运行**（`file://`），硬性产品要求 | `01` §1.2 |
| H2 | 只用 `<script>` 顺序加载，**全局变量即依赖**；无 ES Module | `01` §1.1 |
| H3 | 完全无构建：无 webpack/vite/rollup/parcel，源码即产物 | `01` §1.1 |
| H4 | 无后端、零运行时依赖（仅 `vendor/tailwind.min.js`） | `01` §1.1 |
| H5 | ES 边界：ES5 全语法 + 箭头函数 + 模板字符串 + `let/const` + Array 扩展方法 | `01` §2.1 |
| H6 | 唯一入口：页面 → Store → localStorage，**业务数据读写必经 Store** | `01` §4.1 |
| H7 | Store 五铁律：禁止内存缓存 / 必须容错 / 禁止写坏数据 / 必须广播 / 读取只读快照 | `01` §4.2 |
| H8 | 两级回退：读权威源 → 失败回退种子 → **绝不回写权威源** | `01` §4.3 |
| H9 | 字段 `snake_case`；时间 ISO 8601；空值**禁止 null**；ID = `'id_'+Date.now()+'_'+random5` | `01` §4.4 |
| H10 | 存储键 `smartorchard_{域}_{对象}[_v版本]` 或 `applefarm_{域}_{对象}_v版本` | `01` §5.2 |
| H11 | 编码 **UTF-8 无 BOM** | `14` SR-13 |
| H12 | 登录守卫必须在 `<head>` **内联脚本**中（放 `<body>` 末尾会闪屏） | `01` §6.1 / SR-31 |
| H13 | 登录态必须 `sessionStorage`，**存储域冻结** | `01` §6.1 / SR-36 |
| H14 | 移动端必须给 GPS 降级路径；禁止假设 `navigator.onLine` 为 true；写操作支持离线暂存 | `01` §7.1 / SR-46 |
| H15 | 金额一律「元」+ `toFixed(2)`；统计卡数字由数据推导 | SR-07 / SR-50 |
| H16 | 改动范围严格限定在任务卡「允许改动文件」清单内 | `01` §8 / `00` §3.2 |
| H17 | 页面文件名 `snake_case.html`，与 `index.html` 导航 `href` 一致 | `01` §8 / SR-15 |
| H18 | 大屏固定 1920×1080 + `transform: scale()`，禁止响应式重排；大屏**只读** | `pages/README.md` §0.3③ / `02` §3.3 |

## 4. 🔴 禁止清单（最高效力）

**任何任务中均不得违反。即使任务卡或页面详设暗示了某做法，只要在此清单中一律禁止。**

**4.1 禁止引入的技术（`01` §3.1，9 条）**
```
禁止 npm / yarn / pnpm 任何依赖            禁止任何打包器（webpack/vite/rollup/parcel）及配置
禁止任何前端框架（React/Vue/Angular/Svelte）  禁止 jQuery / Zepto 等类库
禁止 CSS 预处理器（sass/less/stylus）      禁止 TypeScript / tsconfig.json
禁止 import / export / 动态 import() / CommonJS require
禁止 Service Worker                        禁止 WebSocket / SSE 长连接（除非任务卡明确授权）
```
**4.2 禁止引入的脚本与工具（`14` SR-11）**
```
禁止新增任何指向 CDN 的 <script src>（iconify CDN 为存量，不得新增）
禁止创建 package.json / node_modules/ / playwright.config.js / tsconfig.json
禁止 Jest / Vitest / Mocha / Jasmine / Playwright / Cypress / Puppeteer / jsdom
禁止 ESLint / Prettier / Stylelint        禁止 CI 流水线与覆盖率工具
```
> 🔴 **你必须知道的事实**：本项目**无任何自动化测试框架**，且**禁止引入**。`html/applefarm_mobile/` 下的 `package.json` + `package-lock.json` + `playwright.config.js` 已于 2026-10-23 作为死配置删除（后者 `require('@playwright/test')`，其 `testDir: './tests'` 指向不存在的目录）。**不得声称本项目已有 E2E 能力，不得依赖，不得写进任何验收材料。** 若被要求「跑一下测试」，正确回答是：本项目无自动化测试框架，验收走 PowerShell 静态扫描 + 浏览器控制台脚本（见 `14-测试与验收契约.md` §8）。

**4.3 禁止修改的文件（除任务卡明确授权，`01` §3.2）**

| 目录 / 文件 | 影响面 | 授权条件 |
| --- | --- | --- |
| `html/common/**` | **全部 157 个 HTML 共享** | 单独开卡，串行执行，回归全量页面 |
| `html/fonts/**` | 全局字体 | 原则禁止 |
| 三份 `*-design-system.css`（PC / mobile / dashboard） | 全部对应端页面视觉 | 仅允许改 token **取值**，禁止改名与改结构 |
| `html/*/js/**`（Store 类文件） | 跨端数据一致性 | 单独卡 + 回归跨端链路 |
| `docs/**` 契约文档 | 全体开发者 | 走 `README.md` §7 变更流程 |

**4.4 禁止的代码行为（`01` §3.3，9 条）**

| # | 禁止行为 | 后果 |
| --- | --- | --- |
| 1 | **禁止同时引用 `js/common-functions.js` 与 `js/components/modal.js`** | 两者都 `const Modal` → `SyntaxError: Identifier 'Modal' has already been declared` → **该页全部弹窗静默失效** |
| 2 | 禁止页面直写业务 localStorage key | 绕过 Store，两级回退与跨端联动全部失效 |
| 3 | 禁止自创未在 `03-数据契约.md` 定义的字段名与枚举值 | 污染 schema，跨端读写断裂 |
| 4 | 禁止 Store 内存缓存 | 多标签页不一致（`MaterialStore` 已移除，**勿加回**） |
| 5 | 禁止 `alert()`/`confirm()` 替代 Toast/ConfirmDialog | `window.confirm` 仅允许在 `MobileStore.confirm` 内 |
| 6 | 禁止 CSS 写死颜色十六进制（须 `var(--token)`） | 主题不一致，暗色模式失效 |
| 7 | 禁止提交 `console.log` | 生产代码污染 |
| 8 | 禁止 `localStorage` 存敏感信息（密码 / token / credential） | 凭据泄露，P0 阻断上线 |
| 9 | 禁止内联事件处理器写复杂逻辑 | 难以维护与测试 |

**4.5 禁止的语法与写法（`01` §2.1 / §5.3）**
```
禁止空值合并 ??（本项目零使用，引入即风格分裂）
禁止新代码用 async / await（存量 28 处为特定场景，新代码用 Promise.then）    禁止无兜底的可选链 ?.
禁止 TODO / FIXME 注释    禁止注释掉的死代码    禁止解释「这行代码做了什么」的注释
```
**4.6 禁止污染全局命名空间（`01` §3.4）** — 所有脚本共享同一个 `window`，**禁止在任何页面内联脚本中重新声明下列名字，即使是无害的局部变量**：
```
Modal  LegacyModal  Toast  LegacyToast  ConfirmDialog  LegacyConfirmDialog
Pagination  Search  PageActions  MaterialStore  BizStore  DataStore
TraceStatStore  AlertStore  MobileBridge  MobileStore  H5Auth  USER_OPTIONS
```
**4.7 禁止的依赖方向（`02` §3.2）**
```
禁止 Store → 页面   禁止 页面A → 页面B 的局部变量   禁止 大屏写入任何 Store（只读消费端）
禁止 大屏绕过 Store 直读 h5_* / snzg_*   禁止 PC 直读 smartorchard_*（须经 MobileBridge）
禁止 移动端读 applefarm_*   禁止 H5 读 PC / 移动端键
```
**4.8 禁止「顺手优化」与「折中」（`00` §3.3 / §4.2）**
```
禁止顺手 var→const/let · 格式化整文件 · 加调试输出 · 给别的页面「修个一样的问题」
禁止顺手删除「看起来没用」的变量/函数（删除前须全局搜索确认）· 禁止统一不同页面的同类写法
禁止折中妥协（如写成 stock ?? qty）—— 选一边执行 + 记录分歧，禁止让两种不兼容约定共存
```

## 5. 代码标记制：只动目标标记

`【保留】` 生产可用，原样不动 → **禁止改动**（不提及、不优化、不改格式）
`【改造】` 结构可用，数据/逻辑为 mock 或硬编码 → 只改标记处指明部分，不动同一函数内其他逻辑
`【替换】` 纯演示桩 → 整段重写，保持外部调用签名不变
`【补齐】` 生产必需但原型缺失 → 新增，位置由详设指定
`【缺口】` 需求要求但原型未实现 → 新增 + **必须补齐验收断言**

代码锚点 `file:///路径#L起-L止`；**行号可能已漂移，一律以实际文件内容为准**。详设每处须有 位置 / 现状 / 目标 / 约束 四要素。

## 6. 冲突裁决顺序

```
优先级 1  01-技术栈与工程约束.md   优先级 2  03~07 契约层   优先级 3  08~12 规范层
优先级 4  pages/ 页面详设   →   优先级 5  html/ 现有代码   →   优先级 6  docs/需求说明书.md V4.1
```
**三条铁律**：① 原型结构 > 一切文档描述；② 契约未覆盖的字段/状态/枚举禁止自行发明（挂起提问）；③ 禁止清单优先级最高。
**禁止折中**：严禁取中间值。选一边、按优先级执行、在回报中记录分歧。

## 7. 标准工作流（每步产出可判定结果）

```
① 接卡   从 13-任务卡集.md 领取 TC- 卡（172 张，5 段：目标/输入/必做/禁止/验收，缺段即不合格卡）
         🔴 一次只做一张，禁止多卡并行写同一文件
② 加载   按卡内编号加载 2~4 个契约文件 + 1~2 页详设，不加载其他任何文件
③ 定位   按【标记】+ 锚点打开目标文件确认现状（以实际文件内容为准，不以行号为准）
④ 改     只改「允许改动文件」清单内的文件，只改目标标记指明的片段
⑤ 自检   跑 §8 清单 + 任务卡 DoD（14 §2.1）
⑥ 回报   按 §9 六段格式，断言逐条 PASS / FAIL / 挂起
```
**一次失败后的正确动作**：原锚点 + 错误信息**重试一次**；仍失败则**挂起转人工**，禁止第三次猜测式重改。

**挂起而非猜测（`00` §3.1，优先级高于任务卡本身）**

| 情形 | 正确做法 |
| --- | --- |
| 契约未定义某字段 | **挂起**，回报「契约缺 XX 字段定义」 |
| 契约未定义某枚举值 | **挂起**，列出已知同类枚举，请示是否同源 |
| 不确定某状态能否编辑 | **保守处理**：按不可编辑实现，回报中标注存疑 |
| 不确定两处数据是否同源 | **挂起**，确认是否应共用同一 Store key |
| 找不到任务卡要求的样式类 | 先查 `08` 有无现成 token；确实没有才新增并说明 |

判断标准：该决定是否影响**其他页面**或**其他开发者**？影响 ⇒ 挂起；完全局部且可轻易回退 ⇒ 可决定，但**必须在回报中标注**。

## 8. 交付前自检（`14` §5 的 50 条 SR 规则 + §2.1 DoD）

本次改动涉及的文件上必须全 PASS。完整 50 条见 `docs/详细设计/14-测试与验收契约.md` §5。

```
必查 12 条  SR-01 非双引用 modal · SR-11 无依赖与框架配置 · SR-12 无 ?? import async
        SR-13 无 BOM · SR-33 无 console.log 与死代码 · SR-03 innerHTML 已转义 · SR-04 走 Store
        SR-05 setItem 有 try-catch 且有提示（禁 catch(e){}）· SR-16 字段来自 03 · SR-40 枚举来自 03
        SR-18 无 Store 缓存 · SR-26 不回写权威源 · SR-29 无敏感信息落盘
DOM 层  SR-06 分页容器 id=pagination-container，文案「‹ 1 2 3 › 第 X 页/共 Y 页，共 Z 条记录」（仅 PC 96 页）
       SR-10 iconify.min.js 早于 js/icons.js、js/iframe-hide.js 为最后一个 script · SR-08 无 alert() 且 ConfirmDialog.show 显式写 danger
       SR-09 无硬编码色值 · SR-27 有边界态且空态为兄弟节点 · SR-47 弹层可关闭 · SR-48 控件有 name
       SR-23 渲染函数内不写存储 · SR-45 空态先清空再渲染 · SR-02/SR-32 无内联全局声明
端特有  SR-07 金额 toFixed(2) · SR-50 统计卡由数据推导 · SR-21 口径自洽 · SR-19 setInterval 有 clearInterval
       SR-20 大屏无 Math.random() 与 @media 重排 · SR-22 大屏不绕过 Store · SR-35 上传已压缩 + 4MB 估算
       SR-46 GPS 有 catch 降级 · SR-49 导出真实产出格式
```
**零依赖自检手段（`14` §8.2 —— 本项目没有测试框架，这是唯一合规路径）**：PowerShell 静态扫描（`14` §8.4.3 L0 脚本，零依赖，40~90 秒）→ 浏览器 Console 粘贴 `14` §8.4.1 只读脚本 → `python -m http.server`（仅用于验跨端 storage，storage 不跨 `file://`）→ 打开改动页面，console 报错数 = 0。
三条纪律：① 控制台脚本**只读不写**，除非断言的 Given 明确要求构造前置态；② 执行后**刷新页面**再做后续断言；③ 任何「看起来对」必须落到**一个数值或一段文本**上。

## 9. 回报格式（`00` §3.4，逐字遵守）

```
任务卡：TC-XXX-NNN
完成：  改动了哪些文件、各改了什么
断言：  AC-XXX-NNN-1 PASS（证据：JSON.parse(localStorage['h5_orders']).length === 1）
        AC-XXX-NNN-2 FAIL（期望 x / 实际 y / 缺陷 L-H5-03）
        AC-XXX-NNN-3 挂起（契约未覆盖 XX，按 YY 处理，请确认）
实测：  浏览器打开 xxx.html，控制台报错数 = 0
存疑：  契约未覆盖的 XX 点，我按 YY 方式处理，请确认
静态：  SR-01 PASS / SR-04 FAIL（...）
```
🔴 **禁止输出「大致完成」「应该没问题」「看起来正常」「符合预期」。判定必须引用实际读到的值。**

## 10. 目录地图与全局对象

```
html/applefarm_backhand/   PC 后台 96 页 · PC- · index.html 为外壳（MENU_GROUP_MAP + 登录守卫）
html/applefarm_mobile/     移动端 33 页 · MB- · 最大宽 750px · MobileStore
html/applefarm_h5/         H5 16 页 · H5- · H5Auth
html/applefarm_dataanlye/  大屏 10 页 · DA- · 1920×1080 只读端（目录名拼写为 dataanlye，不得改名）
html/portal.html           门户 1 页（无独立目录）· html/common/ 与 html/fonts/ 禁止改动
```
**全局对象**（写入前先确认是否已存在）：`PageActions`（18 个成员）· `Pagination` · `Search` · `Modal`/`Toast`/`ConfirmDialog`（二选一）· `MaterialStore` · `BizStore` · `DataStore` · `TraceStatStore` · `AlertStore` · `DeviceStore` · `MobileBridge` · `MobileStore` · `H5Auth`。
**Store 写入必须广播**（`06` §3.1）：`bizStoreChange` · `dataStoreChange` · `traceStatStoreChange` · `alertStoreChange` · `deviceStoreChange`。
⚠️ `storage` 事件**不跨 iframe** ⇒ 只留 storage、删掉自定义事件会让 PC 后台跨 iframe 联动全面失效；订阅须用 Store 的 `subscribe()`，`storage` 回调用 `e.key === k` 精确匹配，**禁止前缀正则**。

## 11. 已知架构边界（不是 bug，不得「修复」）

| 编号 | 边界 | 解决时机 |
| --- | --- | --- |
| L-1 | 跨端联动依赖同源 localStorage + `storage`，换设备/浏览器即失效 | 接后端替换 Store 的 `load`/`save`，**页面调用处无需改动**（`04` §8） |
| L-9 | 离线队列上传由 `setTimeout` 模拟 | 接后端（`04` §8 替换点 3） |
| L-4 | 文件上传无法端到端自动化实测 | 按 `01` §3.5 坑 5：Node 内置 `vm` + 手写 DOM 桩直接调用处理函数（不引入 npm） |

**任何声称「修复跨端不生效」「让离线队列真的上传」的提交都应被拒绝——那是设计边界，不是缺陷。**