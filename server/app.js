/**
 * 智慧果园平台后端服务入口
 * --------------------------------------------------------------
 * 启动：node app.js（或 npm start）
 * 依赖：MySQL（先执行 server/db/schema.sql 再执行 seed.sql 建库灌数）
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const authRouter = require('./routes/auth');
const crudRouter = require('./routes/crud');
const metaRouter = require('./routes/meta');
const deviceAggregateRouter = require('./routes/device-aggregate');
const { requireAuth } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ ok: true, data: { status: 'up', time: new Date().toISOString() } });
});

// 路由挂载
app.use('/api/auth', authRouter);          // 鉴权（公开）
app.use('/api/meta', metaRouter);          // 元数据（字典/菜单，公开）
app.use('/api/device', requireAuth, deviceAggregateRouter); // 设备聚合读写（需登录）
app.use('/api', requireAuth, crudRouter);  // 通用 CRUD（需登录）

// 静态资源（上传文件）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 前端静态资源（原型 HTML，与 API 同源，便于开发验证）
const htmlRoot = path.join(__dirname, '..', 'html');
app.use(express.static(htmlRoot));

// 404
app.use((req, res) => {
  res.status(404).json({ ok: false, message: '接口不存在' });
});

// 统一错误处理
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[smartorchard-server] 已启动，端口 ${PORT}`);
  console.log(`  数据库: ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || 'smartorchard'}`);
});
