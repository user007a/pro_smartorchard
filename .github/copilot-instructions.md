# GitHub Copilot · 数农智果智慧果园平台

纯静态前端：**157 个 HTML，零构建、零框架、零后端**。数据全在浏览器 `localStorage` / `sessionStorage`。
源码即产物，页面必须双击以 `file://` 协议运行。5 端 156 页：PC 后台 96 / 移动端 33 / H5 16 / 大屏 10 / 门户 1。
**工作形态是「在既有原型上定点改造」，DOM 已锁定，不可重设计。**

完整实现契约在 `docs/详细设计/`。以下是最容易违反的硬规则。

## 🔴 禁止清单（违反即交付失败，不接受「功能能跑」的辩解）

```
禁止 npm / yarn / pnpm 任何依赖；禁止任何打包器（webpack/vite/rollup/parcel）及配置
禁止任何前端框架（React/Vue/Angular/Svelte）；禁止 jQuery / Zepto 等类库
禁止 CSS 预处理器（sass/less/stylus）；禁止 TypeScript
禁止 import / export / 动态 import() / CommonJS require
禁止 Service Worker、WebSocket / SSE 长连接（除非任务卡明确授权）
禁止新增任何指向 CDN 的 <script src>（iconify CDN 为存量，不得新增）
禁止创建 package.json / node_modules/ / playwright.config.js / tsconfig.json
禁止 Jest / Vitest / Mocha / Playwright / Cypress / Puppeteer / jsdom / ESLint / Prettier / Stylelint
禁止 ?? （本项目零使用，引入即风格分裂）
禁止新代码用 async / await（存量为特定场景，新代码用 Promise.then）；禁止无兜底的可选链 ?.
禁止同时引用 js/common-functions.js 与 js/components/modal.js
   （两者都 const Modal → SyntaxError: Identifier 'Modal' has already been declared → 该页全部弹窗静默失效）
禁止页面直写业务 localStorage key（白名单仅：登录态 / 纯 UI 偏好 / h5_* 系列）——必须走 Store
禁止自创未在 docs/详细设计/03-数据契约.md 定义的字段名与枚举值
禁止 Store 内存缓存（MaterialStore 已移除，勿加回）
禁止 alert() / confirm() 替代 Toast / ConfirmDialog
禁止 CSS 写死颜色十六进制（须 var(--token)，内嵌 SVG 的 fill/stroke 除外）
禁止 console.log、禁止 TODO/FIXME 注释、禁止注释掉的死代码
禁止 localStorage 存敏感信息（密码 / token / credential）
禁止重新声明全局名：Modal LegacyModal Toast LegacyToast ConfirmDialog LegacyConfirmDialog
  Pagination Search PageActions MaterialStore BizStore DataStore TraceStatStore AlertStore
  MobileBridge MobileStore H5Auth USER_OPTIONS
禁止修改 html/common/** 与 html/fonts/**（全部页面共享）
禁止改三份设计系统 CSS 的 token 名称与结构（仅允许改 token 取值）
禁止改 docs/** 契约文档（须走 README §7 变更流程）
禁止顺手 var→const/let、格式化整文件、给别的页面「修个一样的问题」
```

**PC 后台 96 页专属（`14` SR-06 / SR-10 / SR-27）**
```
分页容器 id 必须是 pagination-container，文案统一「‹ 1 2 3 › 第 X 页/共 Y 页，共 Z 条记录」
   （存量 14 页非标准由 TC-PAG-001 收口，新增页零容忍；移动端/H5/大屏不用分页）
script 顺序铁律：iconify.min.js 必须早于 js/icons.js；js/iframe-hide.js 必须是最后一个 <script>
列表必须有边界态（空数据 / 搜索无果），空态节点须为兄弟节点，不能放在会被 innerHTML='' 清空的容器内
```

> 🔴 **注意**：本项目**无自动化测试框架**，且禁止引入。`html/applefarm_mobile/` 下的 `package.json` + `package-lock.json` + `playwright.config.js` 已于 2026-10-23 作为死配置删除。**不得声称已有 E2E 能力，不得依赖。** 验收走 PowerShell 静态扫描 + 浏览器控制台脚本（见 `docs/详细设计/14-测试与验收契约.md` §8）。

## 硬约束

- **双击即开**（`file://`）⇒ 不用 ES Module、不用 fetch 读本地文件、不用打包器
- 数据流唯一入口：**页面 → Store → localStorage**。Store 五铁律：禁止内存缓存 / 必须容错 / 禁止写坏数据 / 必须广播 / 读取只读快照
- 两级回退：读权威源 → 失败回退种子 → **绝不回写权威源**
- 字段 `snake_case`；时间 ISO 8601；空值**禁止 null**；存储键 `smartorchard_{域}_{对象}[_v版本]`
- 编码 **UTF-8 无 BOM**；登录守卫在 `<head>` 内联脚本中；登录态必须 sessionStorage
- 金额 `toFixed(2)`；统计卡数字必须由数据推导，不得硬编码
- 改动范围严格限定在任务卡「允许改动文件」清单内

## 冲突裁决顺序

`01-技术栈与工程约束.md` → `03~07 契约层` → `08~12 规范层` → `pages/` 页面详设 → `html/` 现有代码 → `docs/需求说明书.md` V4.1

铁律：① 原型结构 > 一切文档描述；② 契约未覆盖的字段/状态/枚举禁止自行发明（挂起提问）；③ 禁止清单优先级最高。

## 工作流

1. 从 `docs/详细设计/13-任务卡集.md` 领取 `TC-` 卡（共 172 张），一次只做一张
2. 按卡内编号**只加载 2~4 个契约文件 + 1~2 页详设**；**不要通读 156 页详设**
3. 按【保留】/【改造】/【替换】/【补齐】/【缺口】标记定位，只动目标标记
4. 自检：`docs/详细设计/14-测试与验收契约.md` §5 的 50 条 SR 规则 + §2.1 任务卡 DoD
5. 回报：断言逐条给 `PASS / FAIL（期望 x / 实际 y / 缺陷 L-XXX-NN）/ 挂起`，**禁止「大致完成」「应该没问题」**

不确定时**挂起而非猜测**：契约没定义的字段/枚举必须挂起回报，不得推测后继续。

## 目录地图

```
html/applefarm_backhand/   PC 后台 96 页 · PC- · index.html 为外壳（MENU_GROUP_MAP + 登录守卫）
html/applefarm_mobile/     移动端 33 页 · MB- · 最大宽 750px · MobileStore
html/applefarm_h5/         H5 16 页 · H5- · H5Auth
html/applefarm_dataanlye/  大屏 10 页 · DA- · 1920×1080 只读端（目录名拼写为 dataanlye，不得改名）
html/portal.html           门户 1 页（无独立目录）· html/common/ · html/fonts/ 禁止改动
```

Store 写入必须广播：`bizStoreChange` / `dataStoreChange` / `traceStatStoreChange` / `alertStoreChange` / `deviceStoreChange`。
⚠️ `storage` 事件不跨 iframe；页面订阅须用 Store 的 `subscribe()`；`storage` 回调用 `e.key === k` 精确匹配，禁止前缀正则。

## 架构边界（不是 bug，不得「修复」）

`L-1` 跨端联动依赖同源 localStorage，换设备即失效 → 接后端时替换 Store 的 `load`/`save`，**页面无需改动**（`04-存储契约.md` §8 生产替换点）。
`L-9` 离线队列上传由 `setTimeout` 模拟 → 同上。任何声称「修复跨端不生效」的提交都应被拒绝。