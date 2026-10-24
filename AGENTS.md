# AGENTS.md · 数农智果智慧果园平台 · AI 编程约束

> 本项目**最高优先级的常驻约束**，供 Cursor / Trae / Codex 等通用 AI 编程工具读取。
> 完整条款见 `docs/详细设计/`。本文件只放硬约束 + 禁止清单 + 路径导航，不复制详设全文。

## 0. 这是什么项目

「数农智果智慧果园平台」的前端部分。**纯静态：157 个 HTML、零构建、零框架、零后端。**
数据全在浏览器 `localStorage` / `sessionStorage`；源码即产物；页面必须双击以 `file://` 协议直接运行。
5 端共 156 页业务页面：PC 后台 96 + 移动作业端 33 + H5 消费者端 16 + 数据大屏 10 + 门户 1（另加根跳转页 `index.html`）。

**这是「在既有原型上定点改造」项目，不是「从零写页面」项目。** DOM 已由 `html/` 下的原型锁定，不可重设计。

## 1. 文档在哪、怎么用

契约文档在 `docs/详细设计/`（约 2.6 MB，登记 353 条缺陷与 172 张任务卡）。它是**实现契约**，不是叙述性设计说明。

**🔴 禁止通读 156 页详设。** 任务卡会告诉你本次只需哪 2~4 个契约文件 + 哪 1~2 页详设。

```
第 1 步  docs/详细设计/00-文档使用说明.md       必读 · AI 如何消费本套文档
第 2 步  docs/详细设计/01-技术栈与工程约束.md   必读 · 硬约束 + 禁止清单（优先级最高）
第 3 步  docs/详细设计/02-架构总览.md           必读 · 5 端分层 / Store 职责 / 依赖方向
第 4 步  docs/详细设计/13-任务卡集.md           领取任务卡（TC- 前缀，共 172 张）
第 5 步  按任务卡标注的契约编号按需加载，不读全量
```

编号前缀即加载指令：`§数字` 章节锚点 · `CT-` 数据 · `ST-` 存储 · `API-` 接口 · `EVT-` 事件 · `XC-` 跨端联动 · `UI-` 组件 · `TC-` 任务卡 · `AC-` 验收断言 · `L-` 缺陷 · `SR-` 静态规则（50 条） · `PC-`/`MB-`/`H5-`/`DA-`/`PORTAL-` 5 端页面编号。

**快速定位**（摘自 `docs/详细设计/README.md` §8）：

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
| 查某个 localStorage key / 错误码 | `appendix/C-存储键台账.md`（54 个键） / `appendix/B-错误码全表.md` |

## 2. 硬约束（从 `01` 章提取）

违反即视为交付失败，不接受「功能能跑」的辩解（`01` §3）。

| # | 硬约束 | 出处 |
| --- | --- | --- |
| H1 | 全部页面必须**双击即可运行**（`file://`），硬性产品要求 | `01` §1.2 |
| H2 | 只用 `<script>` 顺序加载，**全局变量即依赖**；无 ES Module | `01` §1.1 |
| H3 | 完全无构建：无 webpack/vite/rollup/parcel，源码即产物 | `01` §1.1 |
| H4 | 无后端、零运行时依赖（仅 `applefarm_backhand/vendor/tailwind.min.js`） | `01` §1.1 |
| H5 | ES 边界：ES5 全语法 + 箭头函数 + 模板字符串 + `let/const` + Array 扩展方法 | `01` §2.1 |
| H6 | 唯一入口：页面 → Store → localStorage，**业务数据读写必经 Store** | `01` §4.1 |
| H7 | Store 五铁律：禁止内存缓存 / 必须容错 / 禁止写坏数据 / 必须广播 / 读取只读快照 | `01` §4.2 |
| H8 | 两级回退：读权威源 → 失败回退种子 → **绝不回写权威源** | `01` §4.3 |
| H9 | 字段 `snake_case`；时间 ISO 8601；空值**禁止 null**；ID = `'id_'+Date.now()+'_'+random5` | `01` §4.4 |
| H10 | 存储键 `smartorchard_{域}_{对象}[_v版本]` 或 `applefarm_{域}_{对象}_v版本` | `01` §5.2 |
| H11 | 编码 **UTF-8 无 BOM**（`EF BB BF` 开头即 FAIL，双 BOM 同判） | `14` SR-13 |
| H12 | 登录守卫必须在 `<head>` **内联脚本**中（放 `<body>` 末尾会闪屏） | `01` §6.1 / SR-31 |
| H13 | 登录态必须 `sessionStorage`，**存储域冻结不得变更** | `01` §6.1 / SR-36 |
| H14 | 移动端必须给 GPS 失败降级路径；禁止假设 `navigator.onLine` 为 true；写操作支持离线暂存 | `01` §7.1 / SR-46 |
| H15 | 金额一律「元」+ `toFixed(2)`；统计卡数字必须由数据推导 | SR-07 / SR-50 |
| H16 | 改动范围严格限定在任务卡「允许改动文件」清单内 | `01` §8 / `00` §3.2 |
| H17 | 页面文件名 `snake_case.html`，与 `index.html` 导航 `href` 完全一致 | `01` §8 / SR-15 |
| H18 | 大屏固定 1920×1080 + `transform: scale()`，禁止响应式重排；大屏是**只读消费端** | `pages/README.md` §0.3③ / `02` §3.3 |

## 3. 🔴 禁止清单（最高效力）

**任何任务中均不得违反。即使任务卡或页面详设暗示了某做法，只要在此清单中，一律禁止。**

**3.1 禁止引入的技术（`01` §3.1，9 条）**
```
禁止 npm / yarn / pnpm 任何依赖            禁止任何打包器（webpack/vite/rollup/parcel）及配置
禁止任何前端框架（React/Vue/Angular/Svelte）  禁止 jQuery / Zepto 等类库
禁止 CSS 预处理器（sass/less/stylus）及 *.scss|less|styl  禁止 TypeScript / tsconfig.json
禁止 import / export / 动态 import() / CommonJS require
禁止 Service Worker                        禁止 WebSocket / SSE 长连接（除非任务卡明确授权）
```
**3.2 禁止引入的脚本与工具（`14` SR-11）**
```
禁止新增任何指向 CDN 的 <script src>（iconify CDN 为存量，不得新增）
禁止创建 package.json / node_modules/ / playwright.config.js / tsconfig.json
禁止 Jest / Vitest / Mocha / Jasmine / Playwright / Cypress / Puppeteer / jsdom
禁止 ESLint / Prettier / Stylelint        禁止 CI 流水线与覆盖率工具
```
> 🔴 **关于自动化测试**：本项目**无任何测试框架**，且**禁止引入**。`html/applefarm_mobile/` 下的 `package.json` + `package-lock.json` + `playwright.config.js` 已于 2026-10-23 作为死配置删除（其 `testDir: './tests'` 指向不存在的目录）。**不得声称本项目已有 E2E 能力，不得依赖，不得写进任何验收材料。** 被要求「跑测试」时正确回答是：本项目无自动化测试框架，验收走 PowerShell 静态扫描 + 浏览器控制台脚本（见 `14-测试与验收契约.md` §8）。

**3.3 禁止修改的文件（除任务卡明确授权，`01` §3.2）**

| 目录 / 文件 | 影响面 | 授权条件 |
| --- | --- | --- |
| `html/common/**` | **全部 157 个 HTML 共享** | 单独开卡，串行执行，回归全量页面 |
| `html/fonts/**` | 全局字体 | 原则禁止 |
| `css/design-system.css`（PC / mobile / dashboard 三份） | 全部对应端页面视觉 | 仅允许改 token **取值**，禁止改名与改结构 |
| `html/*/js/**`（Store 类文件） | 跨端数据一致性 | 单独卡 + 回归跨端链路 |
| `docs/**` 契约文档 | 全体开发者 | 走 `README.md` §7 变更流程 |

**3.4 禁止的代码行为（`01` §3.3，9 条）**

| # | 禁止行为 | 后果 |
| --- | --- | --- |
| 1 | **禁止同时引用 `js/common-functions.js` 与 `js/components/modal.js`** | 两者都 `const Modal` → `SyntaxError: Identifier 'Modal' has already been declared` → **该页全部弹窗静默失效** |
| 2 | 禁止页面直写业务 localStorage key | 绕过 Store，两级回退与跨端联动全部失效 |
| 3 | 禁止自创未在 `03-数据契约.md` 定义的字段名与枚举值 | 污染 schema，跨端读写断裂 |
| 4 | 禁止 Store 内存缓存 | 多标签页数据不一致（`MaterialStore` 已移除，**勿加回**） |
| 5 | 禁止 `alert()`/`confirm()` 替代 Toast/ConfirmDialog | UI 不统一；`window.confirm` 仅允许在 `MobileStore.confirm` 内 |
| 6 | 禁止 CSS 写死颜色十六进制（须 `var(--token)`） | 主题不一致，暗色模式失效 |
| 7 | 禁止提交 `console.log` | 生产代码污染 |
| 8 | 禁止 `localStorage` 存敏感信息（密码 / token / credential） | 凭据泄露，P0 阻断上线 |
| 9 | 禁止内联事件处理器写复杂逻辑 | 难以维护与测试 |

**3.5 禁止的语法与写法（`01` §2.1 / §5.3，SR-12）**
```
禁止空值合并 ??（本项目零使用，引入即风格分裂）
禁止新代码用 async / await（存量 28 处为特定场景，新代码用 Promise.then）
禁止无降级兜底的可选链 ?.
禁止 TODO / FIXME 注释（进任务卡，不留在代码里）      禁止注释掉的死代码（直接删）
禁止解释「这行代码做了什么」的注释                  禁止把内联 <style> 抽到公共 css（属结构重构）
```
**3.6 禁止污染全局命名空间（`01` §3.4）** — `html/` 下所有脚本共享同一个 `window`，**禁止在任何页面内联脚本中重新声明下列名字，即使是无害的局部变量**：
```
Modal  LegacyModal  Toast  LegacyToast  ConfirmDialog  LegacyConfirmDialog
Pagination  Search  PageActions  MaterialStore  BizStore  DataStore
TraceStatStore  AlertStore  MobileBridge  MobileStore  H5Auth  USER_OPTIONS
```
**3.7 禁止的依赖方向（`02` §3.2）**
```
禁止 Store → 页面            禁止 页面A → 页面B 的局部变量
禁止 大屏写入任何 Store（只读消费端，绝不调 setXxx）    禁止 大屏绕过 Store 直读 h5_* / snzg_*
禁止 PC 直读 smartorchard_*（须经 MobileBridge）      禁止 移动端读 applefarm_*    禁止 H5 读 PC / 移动端键
```
**3.8 禁止「顺手优化」与「折中」（`00` §3.3 / §4.2）**
```
禁止顺手 var→const/let · 格式化整文件 · 加调试输出 · 给别的页面「修个一样的问题」
禁止顺手删除「看起来没用」的变量/函数（删除前须全局搜索确认）· 禁止统一不同页面的同类写法
禁止折中妥协（如写成 stock ?? qty 让两种不兼容约定共存）—— 选一边执行 + 记录分歧
```

## 4. 代码标记制（只动目标标记）

| 标记 | 含义 | 动作 |
| --- | --- | --- |
| `【保留】` | 生产可用，原样不动 | **禁止改动**（不提及、不优化、不改格式） |
| `【改造】` | 结构可用，数据/逻辑为 mock 或硬编码 | 只改标记处指明部分，不动同一函数内其他逻辑 |
| `【替换】` | 纯演示桩，生产无意义 | 整段重写，保持外部调用签名不变 |
| `【补齐】` | 生产必需但原型缺失 | 新增，位置由详设指定 |
| `【缺口】` | 需求要求但原型未实现 | 新增 + **必须补齐验收断言** |

代码锚点格式 `file:///绝对路径#L起-L止`；**行号可能漂移，一律以实际文件内容为准**。详设每处须有 位置 / 现状 / 目标 / 约束 四要素。

## 5. 契约优先级（冲突逐级向下比对，命中即停）

```
优先级 1  docs/详细设计/01-技术栈与工程约束.md   硬约束与禁止清单（不可协商）
优先级 2  03 数据 · 04 存储 · 05 接口 · 06 事件 · 07 跨端联动 契约
优先级 3  08 设计系统 · 09 组件 · 10 工程化 · 11 权限 · 12 部署 规范
优先级 4  pages/ 页面详设   →   5. html/ 现有代码   →   6. docs/需求说明书.md V4.1
```
**三条铁律**：① 原型结构 > 一切文档描述；② 契约未覆盖的字段/状态/枚举禁止自行发明（挂起提问）；③ 禁止清单优先级最高。

## 6. 工作流

```
① 接卡   从 13-任务卡集.md 领取 TC- 卡（172 张，5 段：目标/输入/必做/禁止/验收）
         🔴 一次只做一张。禁止 10 张以上批量执行，禁止多卡并行写同一文件
② 加载   按卡内编号加载 2~4 个契约文件 + 1~2 页详设，不加载其他
③ 定位   按【标记】+ 代码锚点打开目标文件，确认现状
④ 改     只改「允许改动文件」清单内的文件，只改目标标记指明的片段
⑤ 自检   跑 §7 清单 + 任务卡 DoD（14 §2.1）
⑥ 回报   按 00 §3.4 六段格式，断言逐条 PASS / FAIL / 挂起
```
失败后：原锚点 + 错误信息**重试一次**；仍失败则**挂起转人工**，禁止第三次猜测式重改。

**不确定时挂起而非猜测（`00` §3.1，优先级高于任务卡本身）**：契约未定义的字段/枚举 → **挂起回报**；不确定能否编辑 → **保守按不可编辑实现并标注存疑**；不确定两处数据是否同源 → **挂起确认**；找不到样式类 → 先查 `08` 有无现成 token，确实没有才新增并说明。
判断标准：该决定是否影响其他页面或开发者？影响 ⇒ 挂起；完全局部且可轻易回退 ⇒ 可决定，但**必须在回报中标注**。

**回报格式（`00` §3.4）**：`任务卡 / 完成（改了哪些文件）/ 断言（逐条 PASS·FAIL·挂起）/ 实测（console 报错数 = 0）/ 存疑 / 静态（SR- 编号）`
🔴 **禁止回报「应该没问题」「大致完成」「看起来正常」。判定必须引用实际读到的值。**

## 7. 交付前自检清单

依据 `docs/详细设计/14-测试与验收契约.md` §5（50 条 SR 规则）+ §2.1（任务卡 DoD）。**本次改动涉及的文件上必须全 PASS：**

```
代码层  SR-01 未同时引用 common-functions.js 与 components/modal.js · SR-02 无内联 Pagination
       SR-32 未重声明任何全局对象名 · SR-33 无 console.log / TODO / 死代码
       SR-11 无 package.json / node_modules / 打包器 / 框架 / 测试框架配置
       SR-12 无 ?? · 无 import/export · 无新代码 async · 无无兜底 ?. · SR-13 UTF-8 无 BOM
       SR-15 文件名与 index.html 导航 href 一致 · SR-09 无硬编码色值 · SR-08 无 alert() 且 ConfirmDialog.show 显式写 danger
数据层  SR-04 业务读写走 Store（白名单：登录态 / 纯 UI 偏好 / h5_*）· SR-05 setItem 在 try/catch 内且 catch 有提示（禁空吞）
       SR-16 字段来自 03 · SR-17 新键匹配 ^(smartorchard|applefarm)_[a-z0-9_]+(_v\d+)?$ · SR-40 枚举来自 03 §2
       SR-18 Store 无内存缓存 · SR-26 回退不回写权威源 · SR-34 未在 Store 外新增页面级键
       SR-36 登录态仍写 sessionStorage · SR-42 Store 写入后派发自定义事件
安全层  SR-03 innerHTML 拼接的用户输入已转义 · SR-24 未把业务 id 拼进 onclick / 选择器
       SR-25 URL 参数经白名单校验 · SR-28 无硬编码真实手机号 / 身份证号 · SR-29 无敏感信息明文落盘 · SR-31 守卫在 <head> 内联
DOM 层  SR-06 分页容器 id=pagination-container，文案「‹ 1 2 3 › 第 X 页/共 Y 页，共 Z 条记录」（仅 PC 96 页）
       SR-10 iconify.min.js 早于 js/icons.js，js/iframe-hide.js 为最后一个 <script> · SR-27 有边界态且空态为兄弟节点
       SR-47 弹层可关闭（Esc/遮罩/关闭按钮）· SR-48 弹窗控件有 name · SR-23 渲染函数内不写存储 · SR-45 空态先清空再渲染
端特有  SR-07 金额 toFixed(2) · SR-50 统计卡由数据推导 · SR-21 金额与统计口径自洽 · SR-19 setInterval 有 clearInterval
       SR-20 大屏无 Math.random() 伪造值与 @media 重排 · SR-22 大屏不绕过 Store 直读 h5_/snzg_
       SR-35 上传已 canvas 压缩 + 4MB 容量估算 · SR-46 GPS 有 catch 降级 · SR-49 导出真实产出目标格式
收尾    PowerShell 静态扫描（14 §8.4.3，零依赖）→ 浏览器 Console 粘贴 14 §8.4.1 只读脚本
       → 本地 python -m http.server 验跨端 storage（不跨 file://）→ 打开改动页面，console 报错数 = 0
```

## 8. 目录地图

```
html/applefarm_backhand/    PC 后台 96 页 · PC- · 16 一级菜单 / 90 已注册导航页（另 4 页未注册：home + 设备接入三页）· index.html 为外壳（MENU_GROUP_MAP + 登录守卫）
                            css/design-system.css · js/（common-functions · page-actions · icons · iframe-hide
                            · material-store · components/ · shared/）· vendor/tailwind.min.js
html/applefarm_mobile/      移动作业端 33 页 · MB- · 5 底部 Tab · 最大宽 750px · js/mobile-store.js（MobileStore）
html/applefarm_h5/          消费者 H5 16 页 · H5- · 复用移动端设计系统 · js/h5-auth.js（H5Auth）
html/applefarm_dataanlye/   数据大屏 10 页 · DA- · 1920×1080 深色 · 只读端 · css/dashboard-design-system.css
html/portal.html            门户 PORTAL-001（无独立目录，1 页）· html/common/ 与 html/fonts/ 禁止改动
html/index.html             根跳转页（meta refresh → html/portal.html），非业务页面
docs/详细设计/             00 使用说明 · 01 工程约束 · 02 架构 · 03~07 契约层 · 08~12 规范层 · 13 任务卡 · 14 验收
                            appendix/（A 术语 · B 错误码 · C 存储键台账 · D 遗留问题台账 62 条）· pages/（156 页详设）
```
🔖 大屏目录实际名为 `applefarm_dataanlye`（**非 `analysis`**），一律沿用，**不得改名**，否则 10 个页面相对路径全部失效。

**6 个 PC Store 与广播事件**：`BizStore`/`DataStore`/`TraceStatStore`/`AlertStore`/`DeviceStore`（`js/shared/`）+ `MaterialStore`（`js/`，⚠️ 无订阅机制，`L-D07` 待整改，**不得为此加内存缓存**）。
Store 写入后必须派发 `bizStoreChange` / `dataStoreChange` / `traceStatStoreChange` / `alertStoreChange` / `deviceStoreChange`。
⚠️ `storage` 事件**不跨 iframe** ⇒ 只留 storage、删掉自定义事件会让 PC 后台跨 iframe 联动全面失效；页面订阅须用 Store 的 `subscribe()`，`storage` 回调用 `e.key === k` 精确匹配，**禁止前缀正则**。

## 9. 已知架构边界（不是 bug，不得「修复」）

| 编号 | 边界 | 解决时机 |
| --- | --- | --- |
| L-1 | 跨端联动依赖同源 localStorage + `storage` 事件，换设备/浏览器即失效 | 接后端替换 Store 的 `load`/`save`（`04` §8 替换点 1-3），**页面调用处无需改动** |
| L-9 | 离线队列「上传」由 `setTimeout` 模拟 | 接后端（`04` §8 替换点 3） |
| L-4 | 文件上传无法端到端自动化实测 | 按 `01` §3.5 坑 5：Node 内置 `vm` + 手写 DOM 桩直接调用处理函数（不引入 npm） |

**任何声称「修复跨端不生效」「让离线队列真的上传」的提交都应被拒绝——那是设计边界，不是缺陷。**