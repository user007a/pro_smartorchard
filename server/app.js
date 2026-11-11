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
const enterpriseAggregateRouter = require('./routes/enterprise-aggregate');
const certAggregateRouter = require('./routes/cert-aggregate');
const productionAggregateRouter = require('./routes/production-aggregate');
const harvestAggregateRouter = require('./routes/harvest-aggregate');
const traceAggregateRouter = require('./routes/trace-aggregate');
const salesAggregateRouter = require('./routes/sales-aggregate');
const bizAggregateRouter = require('./routes/biz-aggregate');
const mallAggregateRouter = require('./routes/mall-aggregate');
const adoptionAggregateRouter = require('./routes/adoption-aggregate');
const materialAggregateRouter = require('./routes/material-aggregate');
const dataAggregateRouter = require('./routes/data-aggregate');
const modelAggregateRouter = require('./routes/model-aggregate');
const soilAggregateRouter = require('./routes/soil-aggregate');
const mobileOpsAggregateRouter = require('./routes/mobile-ops-aggregate');
const alertAggregateRouter = require('./routes/alert-aggregate');
const vrAggregateRouter = require('./routes/vr-aggregate');
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
app.use('/api/enterprise', requireAuth, enterpriseAggregateRouter); // 企业聚合读写（需登录）
app.use('/api/cert', requireAuth, certAggregateRouter); // 证书聚合读写（需登录）
app.use('/api/production', requireAuth, productionAggregateRouter); // 生产聚合读写（需登录）
app.use('/api/harvest', requireAuth, harvestAggregateRouter); // 采收聚合读写（需登录）
app.use('/api/trace', requireAuth, traceAggregateRouter); // 溯源聚合读写（需登录）
app.use('/api/sales', requireAuth, salesAggregateRouter); // 销售聚合读写（需登录）
app.use('/api/biz', requireAuth, bizAggregateRouter); // 经营聚合读写（需登录）
app.use('/api/mall', requireAuth, mallAggregateRouter); // 商城聚合读写（需登录）
app.use('/api/adoption', requireAuth, adoptionAggregateRouter); // 认养聚合读写（需登录）
app.use('/api/material', requireAuth, materialAggregateRouter); // 农资聚合读写（需登录）
app.use('/api/data', requireAuth, dataAggregateRouter); // 数据运营聚合读写（需登录）
app.use('/api/model', requireAuth, modelAggregateRouter); // 模型中心聚合读写（需登录）
app.use('/api/soil', requireAuth, soilAggregateRouter); // 土壤检测聚合读写（需登录）
app.use('/api/mobile-ops', requireAuth, mobileOpsAggregateRouter); // 移动端运营聚合读写（需登录）
app.use('/api/alert', requireAuth, alertAggregateRouter); // 预警管理聚合读写（需登录）
app.use('/api/vr', requireAuth, vrAggregateRouter); // VR全景聚合读写（需登录）
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
