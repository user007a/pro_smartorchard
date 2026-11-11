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

## 三、本地启动（三步）

### 第 1 步：准备 MySQL

任选一种：

- **用 Docker（推荐）**
  ```bash
  docker run -d --name so-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root mysql:8.0
  ```
- 已有 MySQL 8.0 则跳过，记住账号密码即可。

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
npm start
```

启动后访问：

| 地址 | 内容 |
|---|---|
| http://127.0.0.1:3000/html/portal.html | 统一门户（四端入口） |
| http://127.0.0.1:3000/html/applefarm_backhand/login.html | 后台登录 |
| http://127.0.0.1:3000/api/health | 健康检查 |

> 后端同时托管前端静态文件，所以**页面和接口同源**，不需要额外起静态服务器。

---

## 四、演示账号

| 端 | 入口 | 账号 | 密码 |
|---|---|---|---|
| PC 后台 | `html/applefarm_backhand/login.html` | `admin` | `admin123` |
| 移动端 | `html/applefarm_mobile/mb_login.html` | `zhangjg` | `123456` |
| H5 会员 | `html/applefarm_h5/` | `13800000001` | `admin123` |

---

## 五、目录结构

```
pro_smartorchard/
├── docs/          需求与设计文档（不进入 Docker 镜像）
│   ├── 需求说明书.md              主文档 V2.7
│   ├── 数据设计约定.md            数据层铁律（开发必读）
│   ├── 核心数据模型.md            ER 图与表结构
│   ├── store与数据表映射规范.md   前后端打通模板
│   └── ...
├── html/          四端前端页面 + common 公共资源
│   ├── portal.html
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
└── docker/        Docker 编排（开发中）
```

---

## 六、数据层铁律（改代码前必读）

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

## 七、前端如何接后端（策略 A：出入口映射）

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

## 八、后端接口一览

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

## 九、常见问题

**Q：改了 `schema.sql` 后页面没变化？**
A：需要重新导库。`schema.sql` 里的 `DROP TABLE IF EXISTS` 会重建表，数据会被清空，需再跑一遍 `seed.sql`。

**Q：页面提示"网络请求失败"？**
A：后端没启动，或 `.env` 里数据库配置不对。先访问 `/api/health` 确认后端活着。

**Q：数据没进数据库？**
A：检查浏览器控制台。若 `DeviceStore.isBackendReady()` 为 false，说明后端桥接未启用（通常是未登录），此时数据仍存 localStorage。

**Q：密码字段安全吗？**
A：`sf_user` / `sf_mall_member` 用 bcrypt 哈希，`sf_mb_staff_account` 用 SHA-256 摘要。库中**不存明文**。

---

## 十、当前进度

| 阶段 | 状态 |
|---|---|
| 数据设计约定 / ER 图 / 目录规划 | ✅ 完成 |
| 131 张表建表 + 种子数据 | ✅ 完成 |
| Node 后端骨架 + 三端登录 + 通用 CRUD | ✅ 完成 |
| 前端数据层打通 | 🔄 设备模块样板已完成，其余模块待铺开 |
| Docker 一键部署 | 🔄 待完成 |
