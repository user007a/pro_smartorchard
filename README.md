# 智慧果园管理平台

> 湖南智农数果科技有限公司 · 苹果种植企业数字化管理平台
>
> 本项目由 **HTML 高保真原型** 转化而来。界面与原型 1:1，数据全部落 MySQL。

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
数据库 MySQL 8.0（131 张表，sf_ 前缀）
部署   Docker Compose（前端 + 后端 + MySQL 三容器）
```

> **为什么不用 Vue**：验收标准就是原型。保留原生界面代码，只替换数据读写层，
> 是唯一能保证"界面与原型 1:1"的方式。

---

## 三、一键启动（推荐：Docker）

### 你只需要一条命令

```bash
docker compose up -d
```

首次启动会自动完成：构建镜像 → 创建 MySQL 数据卷 → **建库建表（131 张表）→ 灌入种子数据** → 启动后端与前端。

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
docker compose down -v         # 停止并清空数据（下次启动会重新灌种子）
docker compose up -d --build   # 代码改了之后重新构建
```

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

- `schema.sql` —— 131 张表结构（唯一数据源）
- `seed.sql` —— 演示种子数据，所有表都有数据

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

## 五、演示账号

| 端 | 入口 | 账号 | 密码 |
|---|---|---|---|
| PC 后台 | `html/applefarm_backhand/login.html` | `admin` | `admin123` |
| 移动端 | `html/applefarm_mobile/mb_login.html` | `zhangjg` | `123456` |
| H5 会员 | `html/applefarm_h5/` | `13800000001` | `admin123` |

---

## 六、目录结构

```
pro_smartorchard/
├── docs/          需求与设计文档（不进入 Docker 镜像）
│   ├── 需求说明书.md              主文档 V2.7
│   ├── 数据设计约定.md            数据层铁律（开发必读）
│   ├── 核心数据模型.md            ER 图与表结构
│   ├── store与数据表映射规范.md   前后端打通模板
│   └── ...
├── html/          四端前端页面 + common 公共资源
│   ├── index.html  portal.html
│   ├── applefarm_backhand/        PC 后台
│   ├── applefarm_mobile/          移动工作端
│   ├── applefarm_h5/              H5 消费者端
│   ├── applefarm_dataanlye/       数据大屏
│   └── common/js/api.js           统一接口封装（四端共用）
├── server/        后端服务
│   ├── app.js                     入口
│   ├── config/db.js               数据库连接池
│   ├── middleware/auth.js         JWT 鉴权
│   ├── routes/                    路由（auth / crud / meta / 各模块聚合）
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

- 后端不可用或未登录时，**自动回退 localStorage**，原型仍可运行
- 每个模块的映射层写法见 [`docs/store与数据表映射规范.md`](docs/store与数据表映射规范.md)
- 已完成样板：**设备模块**（13 张表，见 `docs/设备模块出入口映射改造记录.md`）

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
| `GET /api/device/aggregate` | 设备模块聚合读取（13 表） | 是 |
| `POST /api/device/aggregate` | 设备模块聚合保存 | 是 |

`:resource` 为表名去掉 `sf_` 前缀，如 `sf_device` → `device`。

---

## 十、常见问题

**Q：改了 `schema.sql` 后页面没变化？**
A：需要重新导库。`schema.sql` 里的 `DROP TABLE IF EXISTS` 会重建表，数据会被清空，需再跑一遍 `seed.sql`。
Docker 环境下执行 `docker compose down -v && docker compose up -d` 即可重建。

**Q：页面提示"网络请求失败"？**
A：后端没启动，或数据库配置不对。先访问 `/api/health` 确认后端活着；
`docker compose logs api` 看后端日志。

**Q：数据没进数据库？**
A：检查浏览器控制台。若 `DeviceStore.isBackendReady()` 为 false，说明后端桥接未启用（通常是未登录），此时数据仍存 localStorage。

**Q：接口报错但看不到原因？**
A：后端已做错误脱敏，不会暴露表名和 SQL。详细信息在 `docker compose logs api` 里。

**Q：密码字段安全吗？**
A：`sf_user` / `sf_mall_member` 用 bcrypt 哈希，`sf_mb_staff_account` 用 SHA-256 摘要。库中**不存明文**。

**Q：换了数据库密码，旧数据还在吗？**
A：在。密码由 MySQL 镜像的环境变量决定，只在首次创建数据卷时生效。需 `docker compose down -v` 重建（会清空数据）。

---

## 十一、当前进度

| 阶段 | 状态 |
|---|---|
| 数据设计约定 / ER 图 / 目录规划 | ✅ 完成 |
| 131 张表建表 + 种子数据 | ✅ 完成 |
| Node 后端骨架 + 三端登录 + 通用 CRUD | ✅ 完成 |
| **Docker 一键部署** | ✅ **完成**（自动建库灌数，页面与接口同源） |
| 前端数据层打通 | 🔄 设备模块样板已完成，其余 15 个模块待铺开 |
