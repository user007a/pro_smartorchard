# 智慧果园管理平台

> 湖南数字农业科技有限公司 · 苹果种植企业数字化管理平台
>
> 本项目由 **HTML 高保真原型** 转化而来。界面与原型 1:1，数据全部落 MySQL。
>
> **开发者 / AI agent 开工前必读**：[AGENTS.md](AGENTS.md)（交接规则）→ [docs/数据设计约定.md](docs/数据设计约定.md)（数据铁律）→ [docs/审计台账.md](docs/审计台账.md)（模块进度与待修清单，进度的唯一事实源）。

---

## 一、这个系统有四端

| 端 | 目录 | 页面数 | 说明 |
|---|---|---|---|
| PC 管理后台 | `html/applefarm_backhand/` | 119 | 17 个一级菜单，89 个二级菜单 |
| 移动工作端 | `html/applefarm_mobile/` | 35 | 果园作业、人员、报修、AI 助手 |
| H5 消费者端 | `html/applefarm_h5/` | 16 | 商城、认养、溯源查询、会员中心 |
| 数据大屏 | `html/applefarm_dataanlye/` | 10 | 驾驶舱、溯源看板、模型可视化 |
| 统一门户 | `html/portal.html` | 1 | 四端入口导航 |

合计 **182 个页面**。

---

## 二、技术栈（刻意保持简单）

```
前端   原生 HTML / CSS / JavaScript（不引入 Vue 等框架，保证 1:1 复刻原型）
后端   Node.js + Express（单体服务，不拆微服务）
数据库 MySQL 8.0（143 张表，sf_ 前缀）
部署   Docker Compose（前端 + 后端 + MySQL 三容器）
```

---

## 三、一键启动（推荐：Docker）

### 你只需要一条命令

```bash
docker compose up -d
```

首次启动会自动完成：构建镜像 → 创建 MySQL 数据卷 → **建库建表（143 张表）→ 灌入基础系统数据（业务表为空）** → 启动后端与前端。

等待约 1~2 分钟后访问：

| 地址 | 内容 |
|---|---|
| **http://localhost:8080/portal.html** | **统一门户（四端入口，从这里进）** |
| http://localhost:8080/applefarm_backhand/login.html | 后台登录 |
| http://localhost:8080/applefarm_mobile/mb_login.html | 移动端登录 |
| http://localhost:8080/applefarm_h5/index.html | H5 消费者端 |
| http://localhost:8080/applefarm_dataanlye/da_dashboard.html | 数据大屏 |
| http://localhost:8080/api/health | 健康检查 |

> 页面与接口同源（都走 Nginx），前端无需任何配置。

### 常用命令

```bash
docker compose ps              # 查看三个容器状态
docker compose logs -f api     # 看后端日志
docker compose restart api     # 只重启后端
docker compose down            # 停止（保留数据）
docker compose down -v         # 停止并清空数据卷（无需备份，重建流程见下）
docker compose up -d --build   # 代码改了之后重新构建
```

### 重建空库流程（交付前 / 业务驱动测试）

> **严格空库模式**：本项目不使用任何本地业务数据兜底，页面数据 100% 来自真实数据库。
> `schema.sql` 建全部业务表，`seed.sql` 只灌基础系统数据，业务表初始全部为空，
> 由真实业务操作逐条产生数据。后端不可用或数据库未连接时，页面会明确报错并停留在登录页，
> **不会用本地假数据伪装成正常数据**。交付客户前请基于空库做业务驱动测试。

需要重建一套干净的空库时，按顺序执行：

```bash
# 1. 停止并清空数据卷（业务表本就为空，无需备份）
docker compose down -v
# 2. 重新启动容器
docker compose up -d
# 3. 导入表结构
docker exec -i so-mysql mysql -uroot -proot smartorchard < server/db/schema.sql
# 4. 导入基础系统数据（精简 seed，业务表保持为空）
docker exec -i so-mysql mysql -uroot -proot smartorchard < server/db/seed.sql
```

> 导入后访问 `/api/health`，或用 `docker compose logs api` 确认后端已连上数据库。
>
> 说明：MySQL 首次初始化会自动执行 `/docker-entrypoint-initdb.d` 下的 `01_schema.sql` 与 `02_seed.sql`，
> 因此上面第 3、4 步通常无需手工执行；仅当需要在已有数据卷上重建时，才用 `docker exec` 手动导入。

### 端口说明

| 容器 | 端口 | 说明 |
|---|---|---|
| so-web | **8080** | 前端入口（Nginx），日常用这个 |
| so-api | 3000 | 后端接口直连（一般不需要直接访问） |
| so-mysql | 3306 | 数据库，可用 Navicat 等工具连接 |

### 修改数据库密码

项目根目录建 `.env` 文件（已被 `.gitignore` 排除，不会入库）：

```
MYSQL_ROOT_PASSWORD=你的密码
MYSQL_DATABASE=smartorchard
JWT_SECRET=换成随机长字符串
```

改完执行 `docker compose up -d` 生效。**注意：已存在的数据卷不会被密码变更影响，需 `docker compose down -v` 重建。**

---

## 四、本地开发启动（不用 Docker）

适合改代码时用热重载调试。

### 第 1 步：准备 MySQL

```bash
docker run -d --name so-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root mysql:8.0
```

### 第 2 步：建库灌数据

```bash
docker exec -i so-mysql mysql -uroot -proot -e "CREATE DATABASE smartorchard_dev DEFAULT CHARSET utf8mb4;"
docker exec -i so-mysql mysql -uroot -proot smartorchard_dev < server/db/schema.sql
docker exec -i so-mysql mysql -uroot -proot smartorchard_dev < server/db/seed.sql
```

- `schema.sql` —— 143 张表结构（唯一数据源）
- `seed.sql` —— 严格空库初始化脚本，仅灌入系统基础数据（超级用户 admin、H5/移动端各 1 个演示账号、角色权限、菜单、数据字典、系统配置、通知偏好），其余业务表全空

### 第 3 步：启动后端

```bash
cd server
npm install
cp .env.example .env      # 按实际情况改 DB_PASSWORD / DB_NAME
npm run dev               # 或 npm start
```

启动后访问：

| 地址 | 内容 |
|---|---|
| http://127.0.0.1:3000/html/portal.html | 统一门户（四端入口） |
| http://127.0.0.1:3000/applefarm_backhand/login.html | 后台登录 |
| http://127.0.0.1:3000/api/health | 健康检查 |

> 后端同时托管前端静态文件，所以**页面和接口同源**，不需要额外起静态服务器。

---

## 五、初始账号（seed.sql 灌入）

| 端 | 入口 | 账号 | 密码 |
|---|---|---|---|
| PC 后台 | `html/applefarm_backhand/login.html` | `admin` | `admin123` |
| 移动端 | `html/applefarm_mobile/mb_login.html` | `zhangjg` | `123456` |
| H5 会员 | `html/applefarm_h5/` | `13800000001` | `admin123` |

> 以上账号由 `seed.sql` 作为系统基础数据灌入，可真实登录；除此之外所有业务表初始为空，
> 页面数据一律由后端接口从数据库读取，本地不保留任何业务数据。

---

## 六、目录结构

```
pro_smartorchard/
├── AGENTS.md      开发者 / AI agent 交接规则（开工必读）
├── docs/          需求与设计文档（不进入 Docker 镜像）
│   ├── 需求说明书.md              主文档 V2.8
│   ├── 数据设计约定.md            数据层铁律
│   ├── 审计台账.md                模块进度与待修清单（进度唯一事实源）
│   └── ...
├── html/          四端前端页面 + common 公共资源
│   ├── index.html  portal.html
│   ├── applefarm_backhand/        PC 后台（js/shared/ 下为各模块 store/mapper）
│   ├── applefarm_mobile/          移动工作端
│   ├── applefarm_h5/              H5 消费者端
│   ├── applefarm_dataanlye/       数据大屏
│   └── common/js/api.js           统一接口封装（四端共用）
├── server/        后端服务
│   ├── app.js                     入口
│   ├── config/db.js               数据库连接池
│   ├── middleware/                auth.js（JWT 鉴权）+ errorHandler.js（错误脱敏）
│   ├── routes/                    auth / crud / meta + 17 个模块聚合路由
│   ├── utils/table-meta.js        表结构元数据（动态判断列是否存在）
│   ├── resources.js               资源白名单与敏感字段保护
│   └── db/                        schema.sql + seed.sql（单一数据源）
├── docker/        Docker 镜像与配置
│   ├── Dockerfile.api             后端镜像（node:20-alpine）
│   ├── Dockerfile.web             前端镜像（nginx:1.27-alpine）
│   └── nginx.conf                 Nginx 配置（静态托管 + /api 反代）
├── docker-compose.yml             三容器编排（web + api + mysql）
└── .dockerignore                  构建上下文排除清单
```

---

## 七、数据层铁律（改代码前必读）

完整规则见 [`docs/数据设计约定.md`](docs/数据设计约定.md)，要点：

1. **表名** 统一 `sf_` 前缀；**字段名** 小写 + 下划线，避开 MySQL 保留字
2. **每张表必带公共字段**：`id` / `created_at` / `updated_at` / `is_deleted`
3. **枚举进字典表**，存 code 显示 label
4. **引用存 ID 不存文字**（基地存 `base_id`，不存基地名）
5. **图片存 file_id 不存 URL**（真实路径只在 `sf_file` 一张表）
6. **一律逻辑删除**，禁止物理删除
7. **不加物理外键约束**，只加唯一约束
8. **权限只做到模块级**（查看/新增/编辑/删除/导出）

---

## 八、前端如何接后端（策略 A：出入口映射）

界面代码**一行不改**，只把 store 的两个出入口换成 API：

```
页面同步调用 Store.xxx()        ← 内存数据，行为完全不变
        │
        ├─ load()  → 拉后端各表 → 组装成 store 聚合对象 → 替换内存
        └─ save()  → 拆分聚合对象 → 批量 upsert 到各表
```

- 本项目为**严格空库模式**，无任何本地业务数据兜底；后端不可用或鉴权失败时页面会明确报错，展示的数据一律来自真实数据库
---

## 九、后端接口一览

| 接口 | 说明 | 鉴权 |
|---|---|---|
| `GET /api/health` | 健康检查 | 否 |
| `POST /api/auth/login` | 后台登录 | 否 |
| `POST /api/auth/mobile-login` | 移动端登录 | 否 |
| `POST /api/auth/member-login` | H5 会员登录 | 否 |
| `GET /api/meta/dicts` | 字典列表 | 否 |
| `GET /api/:resource` | 列表（分页/搜索/筛选/排序） | 是 |
| `GET /api/:resource/:id` | 详情 | 是 |
| `POST /api/:resource` | 新增（支持批量） | 是 |
| `PUT /api/:resource/:id` | 更新 | 是 |
| `DELETE /api/:resource/:id` | 逻辑删除 | 是 |
| `GET /api/{module}/aggregate` | 模块聚合读取 | 是 |
| `POST /api/{module}/aggregate` | 模块聚合保存（upsert + 逻辑删除） | 是 |

`:resource` 为表名去掉 `sf_` 前缀，如 `sf_device` → `device`。

`{module}` 共 **17 个**，与前端 store 一一对应：

```
device  enterprise  cert  production  harvest  trace  sales  biz  mall
adoption  material  data  model  soil  mobile-ops  alert  vr
```

> 各模块「页面 → store → 路由 → 表」的对应关系与接通状态，见 [docs/审计台账.md](docs/审计台账.md)。

---

## 十、常见问题

**Q：改了 `schema.sql` 后页面没变化？**
A：需要重建数据库。`schema.sql` 里的 `DROP TABLE IF EXISTS` 会重建表，数据会被清空，需再跑一遍 `seed.sql`。
Docker 环境下执行 `docker compose down -v && docker compose up -d` 即可完成重建：MySQL 首次初始化会自动执行
`/docker-entrypoint-initdb.d` 下的 `01_schema.sql` 与 `02_seed.sql`，无需手工导入；若要在已有数据卷上手动重建，
仍可用 `docker exec -i so-mysql mysql -uroot -proot smartorchard < server/db/schema.sql` 导入。

**Q：页面提示"网络请求失败"？**
A：后端没启动，或数据库配置不对。先访问 `/api/health` 确认后端活着；
`docker compose logs api` 看后端日志。

**Q：数据没进数据库？**
A：检查浏览器控制台。若 `DeviceStore.isBackendReady()` 为 false，说明后端桥接未启用（通常是未登录或后端不可达），此时页面会明确报错。业务数据不在浏览器磁盘留存：本地写入已重定向为页面生命周期内的内存镜像，刷新即清空并由 API 重新拉取，不会留下任何本地业务数据。

**Q：接口报错但看不到原因？**
A：后端已做错误脱敏，不会暴露表名和 SQL。详细信息在 `docker compose logs api` 里。

**Q：密码字段安全吗？**
A：`sf_user` / `sf_mall_member` 用 bcrypt 哈希，`sf_mb_staff_account` 用 SHA-256 摘要。库中**不存明文**。

**Q：换了数据库密码，旧数据还在吗？**
A：在。密码由 MySQL 镜像的环境变量决定，只在首次创建数据卷时生效。需 `docker compose down -v` 重建（会清空数据）。

---

## 十一、当前进度

> 进度的**唯一事实源**是 [docs/审计台账.md](docs/审计台账.md)（2026-11-14 全量只读审计），本表仅为摘要。

| 阶段 | 状态 |
|---|---|
| 数据设计约定 / ER 图 / 目录规划 | ✅ 完成 |
| 143 张表建表 + 基础系统数据初始化 | ✅ 完成 |
| Node 后端骨架 + 三端登录 + 通用 CRUD | ✅ 完成 |
| **Docker 一键部署** | ✅ **完成**（自动建库灌数，页面与接口同源） |
| 前端数据层打通 | ✅ 17 个模块聚合接口 + store 全部接通（174/180 页；其余为 iframe 容器页与静态页） |
| 数据审计整改 | 🔄 5 项违规待修、5 项灰区待决策、字典迁移待启动，详见审计台账 |
| 验证层 | ⬜ 聚合路由契约测试 + 空库巡检待建 |
