/**
 * 生产管理共享数据层
 * --------------------------------------------------------------
 * 打通「农事计划 → 任务 → 农事记录 / 巡园打卡 / 无人机架次 / 异常」
 * 的主键链路，让后台各页面共用同一份数据，形成业务闭环。
 *
 * 主键链：
 *   planId(PL-YYYYMM-NNN)
 *     ├─ taskId(TK-YYYYMM-NNN)
 *     │    ├─ recordId(REC-YYYYMM-NNN)     农事记录
 *     │    └─ sortieNo(SO-NNN)             无人机架次
 *     ├─ patrolPlanId(PP-YYYYMM-NNN) → checkinId(CK-YYYYMM-NNN)
 *     └─ anomalyId(AB-NNN)
 *
 * 存储 key： applefarm_production_v1
 *
 * 暴露 API：
 *   ProductionStore.plans() / tasks() / records() / standards()
 *   ProductionStore.routeList() / patrolPlans() / checkins()
 *   ProductionStore.sorties() / flightLogs() / anomalies()
 *   ProductionStore.get(entity, id) / upsert(entity, item) / remove(entity, id)
 *   ProductionStore.nextId(entity)
 *   ProductionStore.tasksByPlan(planId) / recordsByTask(taskId) / planStats(planId)
 *   ProductionStore.taskStats(taskId)
 *   ProductionStore.generateTasks(planId)
 *   ProductionStore.recompute()
 *   ProductionStore.importMobile()
 *   ProductionStore.reset()
 *   ProductionStore.TYPES / PLOTS / STATUS_TEXT
 */

(function (global) {
  'use strict';

  var STORAGE_KEY = 'applefarm_production_v1';

  /* ============================================================
   * 后端桥接依赖自动加载（策略 A：出入口映射）
   * ------------------------------------------------------------
   * 依赖：common/js/api.js（统一请求）与 production-mapper.js（映射层）。
   * 基于 document.currentScript.src 计算本脚本目录再拼接，避免跨层级 404。
   * ============================================================ */
  var depsReady = (function ensureDeps() {
    if (typeof document === 'undefined') return Promise.resolve();
    var selfEl = document.currentScript;
    if (!selfEl || !selfEl.src) return Promise.resolve();
    var baseDir = selfEl.src.replace(/[^\/]*$/, ''); // 去掉文件名，保留目录
    var deps = [
      { name: 'Api', src: baseDir + '../../../common/js/api.js' },
      { name: 'ProductionMapper', src: baseDir + 'production-mapper.js' }
    ];
    var pending = deps.filter(function (d) { return !global[d.name]; });
    if (!pending.length) return Promise.resolve();
    return Promise.all(pending.map(function (d) {
      return new Promise(function (resolve) {
        var s = document.createElement('script');
        s.src = d.src;
        s.async = false;
        s.onload = resolve;
        s.onerror = resolve; // 依赖加载失败不阻塞原型运行
        (document.head || document.documentElement).appendChild(s);
      });
    })).then(function () { return true; });
  })();

  /* 后端桥接状态 */
  var backendReady = false;
  var backendLoadPromise = null;
  var persistTimer = null;

  function backendApi() {
    if (typeof global.Api !== 'object' && typeof global.Api !== 'function') return null;
    if (!global.Api.get || !global.Api.create) return null;
    if (typeof global.ProductionMapper === 'undefined') return null;
    return global.Api;
  }

  function backendEnabled() {
    var api = backendApi();
    if (!api) return false;
    try { return !!api.isLoggedIn(); } catch (e) { return false; }
  }

  /** 从后端聚合接口拉取生产数据，成功后合并进内存并通知 */
  function preloadFromBackend() {
    if (backendLoadPromise) return backendLoadPromise;
    backendLoadPromise = Promise.resolve(depsReady).then(function () {
      var api = backendApi();
      if (!api || !api.isLoggedIn || !api.isLoggedIn()) return { ok: false, message: '未登录或依赖未就绪' };
      return api.get('production/aggregate');
    }).then(function (res) {
      if (res && res.ok && res.data) {
        var agg = global.ProductionMapper.toAggregate(res.data);
        // 后端数据合并进 store 内存（空数组时保留默认种子兜底）
        var base = defaults();
        var keys = ['standards', 'plans', 'tasks', 'records', 'routeList', 'patrolPlans', 'checkins', 'sorties', 'flightLogs', 'anomalies'];
        var merged = {};
        keys.forEach(function (k) {
          var backList = agg[k];
          merged[k] = (backList && backList.length) ? backList : base[k];
        });
        inMemory = merged;
        save();
        notify('backend-loaded');
        backendReady = true;
      }
      return res;
    }).catch(function (e) {
      console.warn('[ProductionStore] 后端预加载失败，降级 localStorage', e);
      return { ok: false, message: e && e.message };
    });
  }

  /** 持久化到后端：防抖 300ms，全量 upsert 10 张表 */
  function persistToBackend() {
    var api = backendApi();
    if (!api || !backendEnabled()) return Promise.resolve({ ok: false, message: '未登录或依赖未就绪' });
    var ctx = { baseIdByName: {}, plotIdByCode: {}, routeIdByCode: {}, stdIdByCode: {}, planIdByCode: {}, taskIdByCode: {} };
    var agg = {
      standards: clone(ensure().standards || []),
      plans: clone(ensure().plans || []),
      tasks: clone(ensure().tasks || []),
      records: clone(ensure().records || []),
      routeList: clone(ensure().routeList || []),
      patrolPlans: clone(ensure().patrolPlans || []),
      checkins: clone(ensure().checkins || []),
      sorties: clone(ensure().sorties || []),
      flightLogs: clone(ensure().flightLogs || []),
      anomalies: clone(ensure().anomalies || []),
      deleted: {},
    };
    var body = global.ProductionMapper.fromAggregate(agg, ctx);
    return api.create('production/aggregate', body);
  }

  /** 调度后端持久化（防抖） */
  function schedulePersist(reason) {
    if (!backendEnabled()) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      persistTimer = null;
      persistToBackend().catch(function (e) {
        console.warn('[ProductionStore] 后端持久化失败', e);
      });
    }, 300);
  }

  /* ---------------- 基础工具 ---------------- */

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function pad3(n) { return n < 10 ? '00' + n : (n < 100 ? '0' + n : '' + n); }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function stampNow() {
    var d = new Date();
    return todayStr() + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function num(v, def) { var n = parseFloat(v); return isNaN(n) ? (def || 0) : n; }

  /* 地块主数据：统一 D-001 格式 */
  var PLOTS = [];
  var PLOT_NAMES = ['东区1号地', '东区2号地', '西区1号地', '北区1号地', '南区1号地', '中区1号地',
    '南区2号地', '西区2号地', '北区2号地', '东区3号地', '南区3号地', '西区3号地',
    '北区3号地', '中区2号地', '东区4号地', '南区4号地', '西区4号地', '北区4号地',
    '中区3号地', '东区5号地', '南区5号地', '西区5号地', '北区5号地'];
  for (var pi = 1; pi <= 23; pi++) PLOTS.push('D-' + pad3(pi));
  function plotOf(n) { return PLOTS[(n - 1) % PLOTS.length]; }
  function plotLabel(code) {
    var idx = PLOTS.indexOf(code);
    return idx >= 0 ? code + ' · ' + PLOT_NAMES[idx] : code;
  }

  var TYPES = {
    farming: '农事', patrol: '巡园', drone: '飞巡'
  };
  var EXECUTOR_TYPES = { person: '个人', team: '班组', drone: '无人机' };
  var STATUS_TEXT = {
    draft: '草稿', pending: '待执行', executing: '执行中', completed: '已完成',
    delayed: '已延期', cancelled: '已取消', accepted: '已接收', processing: '进行中',
    reviewing: '待验收', rejected: '已驳回', overdue: '已超期',
    approved: '已通过', waitHandle: '待处理', handling: '处理中', closed: '已关闭'
  };

  var TYPE_BY_NAME = {
    '施肥': 'fertilizer', '追肥': 'fertilizer', '基肥': 'fertilizer',
    '施药': 'pesticide', '喷药': 'pesticide', '病虫害防治': 'pesticide',
    '灌溉': 'irrigation', '浇水': 'irrigation',
    '修剪': 'pruning', '疏果': 'thinning', '疏花疏果': 'thinning',
    '套袋': 'bagging', '除草': 'weeding', '清园': 'weeding',
    '采收': 'harvest'
  };
  function typeCode(name) { return TYPE_BY_NAME[name] || 'other'; }

  function typeTagClass(type) {
    if (type === 'fertilizer') return 'fertilizer';
    if (type === 'pesticide') return 'pesticide';
    if (type === 'irrigation') return 'irrigation';
    return 'tool';
  }

  /* 农事类型色板：日历图 / 甘特图共用 */
  var TYPE_COLORS = {
    fertilizer: '#1890ff', pesticide: '#ff6b35', irrigation: '#13c2c2',
    pruning: '#52c41a', thinning: '#722ed1', bagging: '#faad14',
    weeding: '#8c8c8c', harvest: '#eb2f96', other: '#bfbfbf'
  };
  var TYPE_NAMES = {
    fertilizer: '施肥', pesticide: '喷药', irrigation: '灌溉', pruning: '修剪',
    thinning: '疏花疏果', bagging: '套袋', weeding: '除草', harvest: '采收', other: '其他'
  };
  function typeColor(code) { return TYPE_COLORS[code] || TYPE_COLORS.other; }

  /* ---------------- 种子数据 ---------------- */

  var STANDARD_PROCESS = {
    '施肥': { process: '开沟 → 撒施 → 覆土 → 浇水', dosage: '有机肥 2000kg/亩 + 复合肥 50kg/亩', accept: '施肥均匀度≥95%，无裸露肥料' },
    '病虫害防治': { process: '配药 → 喷施 → 记录', dosage: '药剂 1:800 稀释，60kg/亩', accept: '叶片正反面覆盖率≥90%' },
    '灌溉': { process: '检查管路 → 分区灌溉 → 复核含水率', dosage: '20m³/亩', accept: '土壤含水率 60%~70%' },
    '修剪': { process: '疏枝 → 短截 → 清园', dosage: '每亩留枝量约 8 万条', accept: '通风透光率≥30%' },
    '套袋': { process: '疏果 → 套袋 → 固定', dosage: '每果 1 袋', accept: '套袋率≥98%' },
    '疏花疏果': { process: '疏花 → 定果 → 复查', dosage: '每 20cm 留 1 果', accept: '留果量 1.2 万个/亩' },
    '采收': { process: '分批采摘 → 预冷 → 分级', dosage: '按成熟度分批采收', accept: '果实着色率≥80%' }
  };

  var STANDARD_SEED = [
    ['GB/T 17420-2024', '苹果园施肥技术规范', '国家标准', '施肥', '通用', '2026-03-01', '现行'],
    ['GB/T 8321-2023', '农药合理使用准则', '国家标准', '病虫害防治', '通用', '2023-06-01', '现行'],
    ['GB/T 10651-2024', '鲜苹果采收技术规范', '国家标准', '采收', '通用', '2026-09-01', '现行'],
    ['NY/T 441-2023', '苹果生产技术规程', '地方标准', '施肥', '红富士', '2023-01-15', '现行'],
    ['NY/T 1086-2023', '苹果病虫害综合防治技术', '地方标准', '病虫害防治', '通用', '2023-04-01', '现行'],
    ['NY/T 1505-2024', '水果套袋技术规程', '地方标准', '套袋', '花牛苹果', '2026-05-01', '现行'],
    ['DB62/T 1234-2023', '花牛苹果修剪技术规范', '地方标准', '修剪', '花牛苹果', '2023-12-01', '现行'],
    ['DB62/T 1235-2023', '苹果园灌溉管理规范', '地方标准', '灌溉', '通用', '2023-07-01', '现行'],
    ['DB62/T 1236-2024', '苹果疏花疏果操作规程', '地方标准', '疏花疏果', '花牛苹果', '2026-04-01', '试行'],
    ['Q/HN 001-2024', '花牛苹果采收作业标准', '企业标准', '采收', '花牛苹果', '2026-09-15', '现行'],
    ['Q/HN 002-2024', '果园春季施肥作业标准', '企业标准', '施肥', '花牛苹果', '2026-03-01', '现行'],
    ['Q/HN 003-2023', '苹果树冬季修剪规范', '企业标准', '修剪', '红富士', '2023-12-15', '现行'],
    ['Q/HN 004-2024', '苹果套袋技术操作标准', '企业标准', '套袋', '红富士', '2026-06-01', '现行'],
    ['Q/HN 005-2023', '果园病虫害防治作业标准', '企业标准', '病虫害防治', '通用', '2023-05-01', '现行'],
    ['Q/HN 006-2024', '苹果园灌溉作业标准', '企业标准', '灌溉', '通用', '2026-06-01', '试行'],
    ['Q/HN 007-2023', '苹果分级包装标准', '企业标准', '采收', '花牛苹果', '2023-10-01', '现行'],
    ['Q/HN 008-2022', '果园土壤改良作业规范', '企业标准', '施肥', '通用', '2022-09-01', '废止'],
    ['Q/HN 009-2024', '苹果疏花疏果作业标准', '企业标准', '疏花疏果', '红富士', '2026-04-15', '现行']
  ];

  var STANDARD_BY_TYPE = {
    fertilizer: 'STD-011', pesticide: 'STD-014', irrigation: 'STD-015',
    pruning: 'STD-012', thinning: 'STD-018', bagging: 'STD-013',
    harvest: 'STD-010', weeding: 'STD-004', other: 'STD-004'
  };

  /* 计划种子：[名称, 基地, 类型码, 类型名, 开始, 结束, 负责人, 状态, 计划量, 实际量, 单位, 描述] */
  var PLAN_SEED = [
    ['春季施肥计划', '天水麦积区基地', 'fertilizer', '施肥', '2026-03-01', '2026-03-15', '惠加宁', 'completed', 320, 320, '亩', '春季基肥，促进根系生长'],
    ['春季修剪计划', '天水麦积区基地', 'pruning', '修剪', '2026-03-10', '2026-03-25', '黄忠坚', 'completed', 280, 268, '亩', '去除病枯枝与过密枝'],
    ['病虫害防治计划', '天水秦州基地', 'pesticide', '喷药', '2026-09-01', '2026-09-10', '徐水应', 'completed', 450, 450, '亩', '红蜘蛛与蚜虫统防统治'],
    ['疏花疏果计划', '青岛莱西基地', 'thinning', '疏花疏果', '2026-04-15', '2026-05-01', '朱泉龙', 'completed', 380, 362, '亩', '控制负载量，提升果品等级'],
    ['夏季追肥计划', '天水麦积区基地', 'fertilizer', '施肥', '2026-06-01', '2026-06-10', '陈小忠', 'completed', 300, 300, '亩', '果实膨大期追肥'],
    ['灌溉计划', '天水秦州基地', 'irrigation', '灌溉', '2026-07-15', '2026-07-20', '廖春亮', 'completed', 260, 248, '亩', '旱情应急灌溉'],
    ['套袋计划', '青岛莱西基地', 'bagging', '套袋', '2026-06-15', '2026-06-30', '李建明', 'completed', 12000, 11850, '个', '花牛苹果套袋'],
    ['夏季修剪计划', '招远基地', 'pruning', '修剪', '2026-07-15', '2026-07-30', '李根', 'completed', 210, 198, '亩', '夏季拉枝与疏枝'],
    ['病虫害防治计划', '天水甘谷基地', 'pesticide', '喷药', '2026-09-05', '2026-09-15', '张才孙', 'executing', 340, 224, '亩', '秋季病虫害统防'],
    ['秋季施肥计划', '天水麦积区基地', 'fertilizer', '施肥', '2026-09-15', '2026-09-30', '刘全国', 'executing', 320, 186, '亩', '秋施基肥'],
    ['采收准备计划', '天水秦州基地', 'harvest', '采收', '2026-10-01', '2026-10-25', '毛定卫', 'pending', 500, 0, '亩', '采前清园与工具准备'],
    ['冬季修剪计划', '青岛莱西基地', 'pruning', '修剪', '2026-12-15', '2027-01-15', '叶三东', 'pending', 380, 0, '亩', '冬季整形修剪'],
    ['清园计划', '招远基地', 'weeding', '除草', '2026-12-05', '2026-12-15', '周才贵', 'pending', 210, 0, '亩', '落叶与病枝集中清理'],
    ['春季灌溉计划', '天水甘谷基地', 'irrigation', '灌溉', '2026-03-20', '2026-03-25', '程名高', 'completed', 340, 340, '亩', '萌芽水'],
    ['病虫害防治计划', '天水麦积区基地', 'pesticide', '喷药', '2026-09-15', '2026-09-20', '邓小华', 'executing', 320, 243, '亩', '轮换用药防治'],
    ['夏季灌溉计划', '天水秦州基地', 'irrigation', '灌溉', '2026-07-20', '2026-07-25', '周成友', 'completed', 260, 255, '亩', '高温期补水'],
    ['套袋计划', '招远基地', 'bagging', '套袋', '2026-06-20', '2026-06-30', '危红卫', 'completed', 8000, 7760, '个', '红富士套袋'],
    ['病虫害防治计划', '青岛莱西基地', 'pesticide', '喷药', '2026-09-10', '2026-09-15', '方超', 'executing', 380, 296, '亩', '叶部病害防治'],
    ['秋季病虫害防治', '天水甘谷基地', 'pesticide', '喷药', '2026-09-20', '2026-09-30', '曹红英', 'executing', 340, 211, '亩', '采前安全用药'],
    ['冬季施肥计划', '天水麦积区基地', 'fertilizer', '施肥', '2026-12-10', '2026-12-20', '崔新根', 'pending', 300, 0, '亩', '越冬基肥'],
    ['春季病虫害防治', '天水秦州基地', 'pesticide', '喷药', '2026-03-20', '2026-03-25', '惠加宁', 'completed', 450, 441, '亩', '萌芽前清园喷药'],
    ['夏季施肥计划', '招远基地', 'fertilizer', '施肥', '2026-06-10', '2026-06-15', '黄忠坚', 'completed', 210, 210, '亩', '叶面喷肥'],
    ['秋季灌溉计划', '青岛莱西基地', 'irrigation', '灌溉', '2026-10-15', '2026-10-20', '徐水应', 'pending', 380, 0, '亩', '采后补水']
  ];

  /* 任务种子：[名称, 基地, 地块中文, 类型名, 优先级, 负责人, 执行人, 班组, 计划时间, 截止, 状态, 描述] */
  var TASK_SEED = [
    ['春季施肥作业', '天水麦积区基地', '东区1号地', '施肥', 'high', '惠加宁', '惠加宁', '一班', '2026-03-01T08:00', '2026-03-15', 'completed', '对A1区果园进行春季追肥，使用复合肥，每亩用量50kg'],
    ['春季修剪计划', '天水麦积区基地', '东区2号地', '修剪', 'medium', '黄忠坚', '黄忠坚', '一班', '2026-03-10T09:00', '2026-03-25', 'completed', '春季修剪整形，去除病枯枝和过密枝'],
    ['病虫害防治', '天水秦州基地', '东区2号地', '施药', 'high', '徐水应', '徐水应', '二班', '2026-09-01T14:00', '2026-09-10', 'completed', '喷洒杀虫剂防治红蜘蛛和蚜虫'],
    ['疏花疏果作业', '青岛莱西基地', '西区1号地', '疏果', 'medium', '朱泉龙', '陈小忠', '二班', '2026-04-15T08:00', '2026-05-01', 'completed', '疏除过多花果，保证果实品质'],
    ['夏季追肥计划', '天水麦积区基地', '东区1号地', '施肥', 'high', '廖春亮', '廖春亮', '一班', '2026-06-01T08:00', '2026-06-10', 'completed', '夏季追肥，使用复合肥'],
    ['夏季灌溉调度', '天水秦州基地', '北区1号地', '灌溉', 'low', '李建明', '李建明', '三班', '2026-07-15T06:00', '2026-07-20', 'completed', '根据土壤湿度自动灌溉'],
    ['果实套袋作业', '青岛莱西基地', '南区1号地', '套袋', 'high', '李根', '张才孙', '二班', '2026-06-15T08:00', '2026-06-30', 'completed', '对花牛苹果进行套袋作业'],
    ['夏季修剪整形', '招远基地', '东区2号地', '修剪', 'medium', '刘全国', '毛定卫', '三班', '2026-07-15T09:00', '2026-07-30', 'completed', '夏季修剪整形'],
    ['秋季病虫害防治', '天水甘谷基地', '北区1号地', '施药', 'high', '叶三东', '周才贵', '二班', '2026-09-05T14:00', '2026-09-15', 'processing', '病虫害定期监测记录'],
    ['秋季施肥计划', '天水麦积区基地', '南区1号地', '施肥', 'medium', '程名高', '邓小华', '二班', '2026-09-15T08:00', '2026-09-30', 'processing', '施用腐熟有机肥'],
    ['采收准备计划', '天水秦州基地', '东区1号地', '采收', 'high', '周成友', '危红卫', '一班', '2026-10-01T07:00', '2026-10-10', 'pending', '采收前准备工作'],
    ['冬季修剪计划', '青岛莱西基地', '西区2号地', '修剪', 'medium', '方超', '曹红英', '一班', '2026-12-15T09:00', '2027-01-15', 'pending', '冬季修剪，去除病枯枝'],
    ['清园计划', '招远基地', '东区2号地', '除草', 'low', '崔新根', '惠加宁', '三班', '2026-12-05T08:00', '2026-12-15', 'pending', '清理果园杂草和落叶'],
    ['春季灌溉计划', '天水甘谷基地', '北区1号地', '灌溉', 'medium', '黄忠坚', '徐水应', '一班', '2026-03-20T06:00', '2026-03-25', 'completed', '春季干旱期浇水灌溉'],
    ['秋季病虫害防治', '天水麦积区基地', '东区1号地', '施药', 'high', '朱泉龙', '陈小忠', '二班', '2026-09-15T14:00', '2026-09-20', 'processing', '综合防治病虫害'],
    ['夏季灌溉作业', '天水秦州基地', '西区1号地', '灌溉', 'medium', '廖春亮', '李建明', '三班', '2026-07-20T06:00', '2026-07-25', 'completed', '定时灌溉'],
    ['套袋作业', '招远基地', '南区1号地', '套袋', 'medium', '李根', '张才孙', '二班', '2026-06-20T08:00', '2026-06-30', 'completed', '果实套袋'],
    ['病虫害监测', '青岛莱西基地', '西区2号地', '施药', 'high', '刘全国', '毛定卫', '二班', '2026-09-10T09:00', '2026-09-15', 'processing', '病虫害定期监测'],
    ['秋季病虫害防治', '天水甘谷基地', '北区1号地', '施药', 'high', '叶三东', '周才贵', '三班', '2026-09-20T10:00', '2026-09-30', 'processing', '综合防治方案'],
    ['冬季施肥计划', '天水麦积区基地', '东区1号地', '施肥', 'low', '程名高', '邓小华', '一班', '2026-12-10T08:00', '2026-12-20', 'pending', '冬季基肥施用'],
    ['春季病虫害防治', '天水秦州基地', '东区2号地', '施药', 'medium', '周成友', '危红卫', '二班', '2026-03-20T14:00', '2026-03-25', 'completed', '病害预防'],
    ['夏季施肥计划', '招远基地', '西区1号地', '施肥', 'low', '方超', '曹红英', '一班', '2026-06-10T08:00', '2026-06-15', 'completed', '叶面喷肥'],
    ['秋季灌溉计划', '青岛莱西基地', '北区1号地', '灌溉', 'medium', '崔新根', '惠加宁', '三班', '2026-10-15T06:00', '2026-10-20', 'pending', '智能灌溉系统调度'],
    ['设备检修任务', '天水麦积区基地', '西区2号地', '灌溉', 'low', '黄忠坚', '徐水应', '一班', '2026-09-25T14:00', '2026-09-26', 'pending', '检修喷灌设备'],
    ['果园巡视', '青岛莱西基地', '西区1号地', '除草', 'low', '朱泉龙', '陈小忠', '一班', '2026-09-23T08:00', '2026-09-23', 'cancelled', '日常果园巡视检查']
  ];

  /* 记录种子：[基地, 地块, 类型码, 类型名, 执行人, 日期, 状态, 完成量, 面积] */
  var RECORD_SEED = [
    ['天水麦积区基地', 'D-001', 'fertilizer', '施肥', '惠加宁', '2026-09-05', 'approved', 68, 68],
    ['天水麦积区基地', 'D-002', 'tool', '修剪', '黄忠坚', '2026-09-15', 'approved', 54, 54],
    ['天水荣成基地', 'D-004', 'pesticide', '喷药', '徐水应', '2026-09-03', 'pending', 42, 42],
    ['天水荣成基地', 'D-005', 'pesticide', '病虫害防治', '朱泉龙', '2026-09-08', 'processing', 36, 36],
    ['青岛莱西基地', 'D-006', 'irrigation', '灌溉', '陈小忠', '2026-09-10', 'approved', 48, 48],
    ['天水麦积区基地', 'D-003', 'tool', '疏花疏果', '廖春亮', '2026-09-12', 'rejected', 30, 30],
    ['天水荣成基地', 'D-007', 'fertilizer', '施肥', '李建明', '2026-09-15', 'approved', 55, 55],
    ['青岛莱西基地', 'D-008', 'tool', '套袋', '李根', '2026-09-20', 'approved', 1200, 40],
    ['招远基地', 'D-009', 'pesticide', '病虫害防治', '张才孙', '2026-09-18', 'pending', 64, 64],
    ['麦积区阁基地', 'D-010', 'irrigation', '灌溉', '刘全国', '2026-09-01', 'approved', 50, 50],
    ['天水麦积区基地', 'D-011', 'tool', '修剪', '毛定卫', '2026-09-05', 'approved', 46, 46],
    ['天水荣成基地', 'D-012', 'fertilizer', '追肥', '叶三东', '2026-09-10', 'approved', 58, 58],
    ['青岛莱西基地', 'D-013', 'pesticide', '喷药', '周才贵', '2026-09-15', 'approved', 52, 52],
    ['招远基地', 'D-014', 'irrigation', '灌溉', '程名高', '2026-09-20', 'approved', 44, 44],
    ['麦积区阁基地', 'D-015', 'tool', '套袋', '邓小华', '2026-09-19', 'approved', 900, 32],
    ['天水麦积区基地', 'D-016', 'fertilizer', '施肥', '周成友', '2026-09-01', 'approved', 62, 62],
    ['天水荣成基地', 'D-017', 'pesticide', '病虫害防治', '危红卫', '2026-09-05', 'approved', 40, 40],
    ['青岛莱西基地', 'D-018', 'tool', '修剪', '方超', '2026-09-10', 'approved', 38, 38],
    ['招远基地', 'D-019', 'irrigation', '灌溉', '曹红英', '2026-09-15', 'approved', 47, 47],
    ['麦积区阁基地', 'D-020', 'fertilizer', '追肥', '崔新根', '2026-09-20', 'approved', 53, 53],
    ['天水麦积区基地', 'D-021', 'pesticide', '喷药', '惠加宁', '2026-09-20', 'approved', 56, 56],
    ['天水荣成基地', 'D-022', 'tool', '疏花疏果', '黄忠坚', '2026-09-21', 'approved', 34, 34],
    ['青岛莱西基地', 'D-023', 'irrigation', '灌溉', '徐水应', '2026-09-05', 'approved', 45, 45]
  ];

  /* 巡园计划种子 */
  var PATROL_PLAN_SEED = [
    ['麦积区日常巡园', '天水麦积区基地', 'RT-001', '每日', '惠加宁', '2026-09-01', '2026-09-30', 'executing'],
    ['秦州区病虫害专项巡查', '天水秦州基地', 'RT-002', '每周', '黄忠坚', '2026-09-01', '2026-09-30', 'executing'],
    ['莱西基地果实期巡查', '青岛莱西基地', 'RT-003', '每周', '徐水应', '2026-09-01', '2026-09-30', 'pending'],
    ['招远基地仓储安全巡查', '招远基地', 'RT-003', '每月', '朱泉龙', '2026-09-01', '2026-12-31', 'pending'],
    ['甘谷基地秋季例行巡园', '天水甘谷基地', 'RT-001', '每日', '陈小忠', '2026-09-01', '2026-10-31', 'completed']
  ];

  /* 打卡记录种子：[基地, 类型, 地块串, 巡查人, 时间, 问题码, 问题名, 已完成点数, 总点数, 巡园计划号] */
  var CHECKIN_SEED = [
    ['天水麦积区基地', '日常巡园', 'D-001, D-002, D-003', '惠加宁', '2026-09-15 08:30', 'normal', '无异常', 3, 3, 1],
    ['天水麦积区基地', '日常巡园', 'D-004, D-005', '黄忠坚', '2026-09-15 14:00', 'warning', '发现病虫害', 2, 2, 1],
    ['天水秦州基地', '专项检查', 'D-006, D-007', '徐水应', '2026-09-15 09:00', 'danger', '设备异常', 2, 2, 2],
    ['青岛莱西基地', '日常巡园', 'D-008, D-009', '朱泉龙', '2026-09-16 08:00', 'normal', '无异常', 2, 2, 3],
    ['招远基地', '专项检查', 'D-010, D-011', '陈小忠', '2026-09-16 10:30', 'warning', '发现病虫害', 1, 2, 4],
    ['天水甘谷基地', '日常巡园', 'D-012, D-013', '廖春亮', '2026-09-16 14:00', 'normal', '无异常', 2, 2, 5],
    ['天水麦积区基地', '专项检查', 'D-014, D-015', '李建明', '2026-09-17 08:30', 'normal', '无异常', 2, 2, 1],
    ['天水秦州基地', '日常巡园', 'D-016, D-017', '李根', '2026-09-17 09:00', 'warning', '发现病虫害', 2, 2, 2],
    ['青岛莱西基地', '专项检查', 'D-018, D-019', '张才孙', '2026-09-17 14:30', 'normal', '无异常', 2, 2, 3],
    ['招远基地', '日常巡园', 'D-020, D-021', '刘全国', '2026-09-18 08:00', 'normal', '无异常', 2, 2, 4],
    ['天水甘谷基地', '专项检查', 'D-022, D-023', '毛定卫', '2026-09-18 10:00', 'danger', '设备异常', 2, 2, 5],
    ['天水麦积区基地', '日常巡园', 'D-001, D-002', '叶三东', '2026-09-18 14:00', 'normal', '无异常', 2, 2, 1],
    ['天水秦州基地', '专项检查', 'D-003, D-004', '周才贵', '2026-09-19 08:30', 'warning', '发现病虫害', 2, 2, 2],
    ['青岛莱西基地', '日常巡园', 'D-005, D-006', '程名高', '2026-09-19 09:30', 'normal', '无异常', 2, 2, 3],
    ['招远基地', '专项检查', 'D-007, D-008', '邓小华', '2026-09-19 14:00', 'normal', '无异常', 2, 2, 4],
    ['天水甘谷基地', '日常巡园', 'D-009, D-010', '周成友', '2026-09-20 08:00', 'normal', '无异常', 2, 2, 5],
    ['天水麦积区基地', '专项检查', 'D-011, D-012', '危红卫', '2026-09-20 10:30', 'warning', '发现病虫害', 2, 2, 1],
    ['天水秦州基地', '日常巡园', 'D-013, D-014', '方超', '2026-09-20 14:30', 'normal', '无异常', 2, 2, 2],
    ['青岛莱西基地', '专项检查', 'D-015, D-016', '曹红英', '2026-09-21 08:30', 'normal', '无异常', 2, 2, 3],
    ['招远基地', '日常巡园', 'D-017, D-018', '崔新根', '2026-09-21 09:00', 'danger', '设备异常', 2, 2, 4],
    ['天水甘谷基地', '专项检查', 'D-019, D-020', '惠加宁', '2026-09-21 14:00', 'normal', '无异常', 2, 2, 5],
    ['天水麦积区基地', '日常巡园', 'D-021, D-022', '黄忠坚', '2026-09-22 08:00', 'normal', '无异常', 2, 2, 1],
    ['天水秦州基地', '专项检查', 'D-023, D-001', '徐水应', '2026-09-22 10:00', 'warning', '发现病虫害', 2, 2, 2]
  ];

  var ROUTE_SEED = [
    {
      id: 'RT-001', routeId: 'RT-001', routeName: 'A区日常巡园路线', base: '麦积区基地 A区',
      pointCount: 3, requiredCount: 3, enabled: true, remark: '覆盖 A/B/C 三区主干道，每日必巡',
      updatedAt: '2026-10-21 10:00',
      points: [
        { id: 'A1', name: 'A区1号巡园点', lat: 34.34900, lng: 106.18000, nearRadius: 100, required: true, order: 1 },
        { id: 'B1', name: 'B区1号巡园点', lat: 34.35200, lng: 106.18365, nearRadius: 100, required: true, order: 2 },
        { id: 'C1', name: 'C区1号巡园点', lat: 34.35500, lng: 106.18600, nearRadius: 100, required: true, order: 3 }
      ]
    },
    {
      id: 'RT-002', routeId: 'RT-002', routeName: 'B区专项巡检路线', base: '麦积区基地 B区',
      pointCount: 1, requiredCount: 1, enabled: true, remark: '果树长势抽检',
      updatedAt: '2026-10-21 10:00',
      points: [
        { id: 'B1', name: 'B区1号巡园点', lat: 34.35200, lng: 106.18365, nearRadius: 60, required: true, order: 1 }
      ]
    },
    {
      id: 'RT-003', routeId: 'RT-003', routeName: 'C区仓储巡园路线', base: '麦积区基地 C区',
      pointCount: 1, requiredCount: 1, enabled: false, remark: '仓库周边安全巡查',
      updatedAt: '2026-10-21 10:00',
      points: [
        { id: 'C1', name: 'C区1号巡园点', lat: 34.35500, lng: 106.18600, nearRadius: 80, required: true, order: 1 }
      ]
    }
  ];

  var SORTIE_SEED = [
    ['#014', '天水麦积区基地', 'DJI-01', 'D-001 · 东区1号地', 120, 100, '固定解', 120, 8.5, '2026-09-20 08:00', '已完成', 1],
    ['#015', '天水秦州基地', 'DJI-02', 'D-006 · 中区1号地', 95, 100, '固定解', 110, 8.2, '2026-09-20 10:00', '已完成', 2],
    ['#016', '天水麦积区基地', 'DJI-03', 'D-005 · 南区1号地', 80, 62, '固定解', 100, 9.1, '2026-09-23 08:30', '执行中', 3],
    ['#017', '青岛莱西基地', 'DJI-04', 'D-010 · 东区3号地', 150, 100, '固定解', 130, 8.8, '2026-09-22 09:00', '已完成', 4],
    ['#018', '招远基地', 'DJI-01', 'D-015 · 东区4号地', 110, 100, '浮点解', 105, 7.6, '2026-09-21 14:00', '已完成', 5],
    ['#019', '天水麦积区基地', 'DJI-02', 'D-003 · 西区1号地', 90, 0, '固定解', 115, 0, '2026-09-23 14:00', '待执行', 6],
    ['#020', '天水秦州基地', 'DJI-03', 'D-008 · 西区2号地', 75, 0, '固定解', 100, 0, '2026-09-23 15:30', '待执行', 7],
    ['#021', '青岛莱西基地', 'DJI-04', 'D-012 · 西区3号地', 130, 100, '固定解', 125, 8.4, '2026-09-19 08:00', '已完成', 8],
    ['#022', '招远基地', 'DJI-01', 'D-020 · 东区5号地', 105, 100, '固定解', 112, 8.0, '2026-09-18 10:00', '已完成', 9],
    ['#023', '天水麦积区基地', 'DJI-02', 'D-007 · 南区2号地', 88, 100, '固定解', 108, 8.6, '2026-09-17 08:30', '已完成', 10],
    ['#024', '天水秦州基地', 'DJI-03', 'D-013 · 北区3号地', 72, 0, '浮点解', 100, 0, '2026-09-16 09:00', '已取消', 11],
    ['#025', '青岛莱西基地', 'DJI-04', 'D-016 · 南区4号地', 140, 100, '固定解', 128, 8.9, '2026-09-15 14:00', '已完成', 12],
    ['#026', '招远基地', 'DJI-01', 'D-022 · 西区5号地', 98, 100, '固定解', 106, 8.3, '2026-09-14 08:00', '已完成', 13],
    ['#027', '天水麦积区基地', 'DJI-04', 'D-009 · 北区2号地', 86, 100, '固定解', 118, 8.1, '2026-09-13 10:30', '已完成', 14],
    ['#028', '天水秦州基地', 'DJI-01', 'D-017 · 西区4号地', 115, 100, '固定解', 116, 8.7, '2026-09-12 08:00', '已完成', 15],
    ['#029', '青岛莱西基地', 'DJI-02', 'D-019 · 中区3号地', 102, 100, '浮点解', 112, 7.9, '2026-09-11 14:00', '已完成', 16],
    ['#030', '招远基地', 'DJI-03', 'D-023 · 北区5号地', 90, 0, '固定解', 105, 0, '2026-09-24 08:00', '待执行', 17],
    ['#031', '天水麦积区基地', 'DJI-04', 'D-011 · 南区3号地', 78, 0, '固定解', 100, 0, '2026-09-10 09:00', '已取消', 18]
  ];

  /* ---------------- 种子构造 ---------------- */

  function buildStandards() {
    var plans = buildPlans();
    return STANDARD_SEED.map(function (s, i) {
      var extra = STANDARD_PROCESS[s[3]] || { process: '按标准作业流程执行', dosage: '—', accept: '—' };
      var id = 'STD-' + pad3(i + 1);
      var refCount = plans.filter(function (p) { return p.standardId === id; }).length;
      return {
        id: id, code: s[0], name: s[1], level: s[2], type: s[3], variety: s[4],
        date: s[5], status: s[6], process: extra.process, dosage: extra.dosage,
        accept: extra.accept, refCount: refCount
      };
    });
  }

  function buildPlans() {
    return PLAN_SEED.map(function (p, i) {
      var no = i + 1;
      var startPlot = plotOf(no);
      var endPlot = plotOf(no + 1);
      var stdId = STANDARD_BY_TYPE[p[2]] || 'STD-004';
      var stdName = STANDARD_SEED[parseInt(stdId.replace('STD-', ''), 10) - 1][1];
      return {
        id: 'PL-202609-' + pad3(no),
        name: p[0], base: p[1], type: p[2], typeName: p[3],
        startDate: p[4], endDate: p[5], manager: p[6], status: p[7],
        plannedQty: p[8], actualQty: p[9], unit: p[10], desc: p[11],
        plotRange: startPlot + ',' + endPlot,
        standardId: stdId, standardName: stdName,
        createdAt: p[4]
      };
    });
  }

  function buildTasks() {
    return TASK_SEED.map(function (t, i) {
      var no = i + 1;
      var planId = i < 23 ? 'PL-202609-' + pad3(no) : '';
      var plotId = plotOf(no);
      var status = t[10];
      // 原始状态映射到新状态机
      if (status === 'pending') status = 'pending';
      var category = (t[3] === '除草' && /巡视/.test(t[0])) ? 'patrol' : 'farming';
      return {
        id: 'TK-202609-' + pad3(no),
        planId: planId,
        name: t[0], base: t[1], plot: t[2], plotId: plotId,
        type: t[3], typeCode: typeCode(t[3]),
        taskCategory: category,
        executorType: 'person',
        priority: t[4], person: t[5], worker: t[6], team: t[7],
        planTime: t[8], deadline: t[9], status: status, desc: t[11],
        targetQty: 0, createdBy: '系统', createdAt: t[8] ? t[8].replace('T', ' ') : ''
      };
    });
  }

  function buildRecords() {
    var planList = buildPlans();
    return RECORD_SEED.map(function (r, i) {
      var no = i + 1;
      var status = r[6] === 'approved' ? 'approved' : (r[6] === 'rejected' ? 'rejected' : 'pending');
      var plan = planList[i] || {};
      var planUnit = plan.unit || (r[2] === 'tool' ? '亩' : '亩');
      return {
        id: 'REC-202609-' + pad3(no),
        planId: 'PL-202609-' + pad3(no),
        taskId: 'TK-202609-' + pad3(no),
        base: r[0], plot: r[1], type: r[2], typeName: r[3], executor: r[4],
        date: r[5], time: '', status: status,
        // 已通过记录的量即该计划当前已审核完成量
        qty: status === 'approved' ? num(plan.actualQty, r[7]) : r[7],
        unit: /套袋/.test(r[3]) ? '个' : planUnit,
        area: r[8],
        content: r[3] + '作业完成', photo: '', gps: null,
        auditRemark: '', source: 'pc'
      };
    });
  }

  function buildPatrolPlans() {
    return PATROL_PLAN_SEED.map(function (p, i) {
      return {
        id: 'PP-202609-' + pad3(i + 1),
        name: p[0], base: p[1], routeId: p[2],
        routeName: (ROUTE_SEED.filter(function (r) { return r.routeId === p[2]; })[0] || {}).routeName || '',
        freq: p[3], inspector: p[4], startDate: p[5], endDate: p[6], status: p[7],
        remark: ''
      };
    });
  }

  function buildCheckins() {
    return CHECKIN_SEED.map(function (c, i) {
      var no = i + 1;
      return {
        id: 'CK-202609-' + pad3(no),
        patrolPlanId: 'PP-202609-' + pad3(c[10]),
        routeId: 'RT-' + pad3(((i % 3) + 1)),
        base: c[0], type: c[1], plots: c[2], inspector: c[3], time: c[4],
        issue: c[5], issueName: c[6],
        pointsDone: c[7], pointsTotal: c[8], status: 'completed'
      };
    });
  }

  function buildSorties() {
    return SORTIE_SEED.map(function (s, i) {
      var no = i + 1;
      return {
        id: 'SO-2026-' + pad3(no),
        sortieNo: s[0], taskId: 'TK-202609-' + pad3(no),
        planId: 'PL-202609-' + pad3(no),
        routeId: 'RT-' + pad3(((i % 3) + 1)),
        droneTaskName: '第' + no + '架次巡检',
        base: s[1], drone: s[2], plot: s[3], area: s[4], progress: s[5],
        rtk: s[6], altitude: s[7], speed: s[8], time: s[9], status: s[10],
        createdBy: '飞控中心'
      };
    });
  }

  function buildFlightLogs(sorties) {
    var logs = [];
    var seq = 0;
    sorties.forEach(function (s) {
      if (s.status === '已完成' || s.status === '执行中') {
        var base = s.time;
        var events = s.status === '已完成' ? ['起飞', '暂停', '恢复', '返航', '降落'] : ['起飞', '暂停'];
        events.forEach(function (ev, k) {
          seq++;
          logs.push({
            id: 'LOG-2026-' + pad3(seq),
            sortieId: s.id, sortieNo: s.sortieNo, taskId: s.taskId,
            base: s.base, plot: s.plot, event: ev,
            altitude: s.altitude, speed: ev === '暂停' ? 0 : s.speed,
            battery: Math.max(12, 96 - k * 18 - (s.progress < 100 ? 20 : 0)),
            time: base ? (base.slice(0, 10) + ' ' + pad2(8 + k) + ':' + pad2((k * 7) % 60)) : '',
            remark: ev === '暂停' ? '作业区临时避让' : (ev === '返航' ? '电量低于阈值自动返航' : '')
          });
        });
      }
    });
    return logs;
  }

  var ANOMALY_SEED = [
    { source: 'patrol', type: '病虫害', plot: 'D-006', remark: '中区1号地发现红蜘蛛聚集，叶片失绿', operator: '黄忠坚', status: 'waitHandle', severity: 'medium', reportTime: '2026-09-15 14:10' },
    { source: 'patrol', type: '设备故障', plot: 'D-008', remark: '西区2号地灌溉电磁阀无法开启', operator: '徐水应', status: 'handling', severity: 'high', reportTime: '2026-09-16 09:20' },
    { source: 'drone', type: '疑似病害', plot: 'D-012', remark: '航拍影像识别到疑似褐斑病斑块 3 处', operator: '飞控中心', status: 'waitHandle', severity: 'medium', reportTime: '2026-09-19 10:05' },
    { source: 'drone', type: '树势异常', plot: 'D-020', remark: '多光谱显示该地块 NDVI 明显低于周边', operator: '飞控中心', status: 'closed', severity: 'low', reportTime: '2026-09-18 11:30' },
    { source: 'patrol', type: '其他', plot: 'D-015', remark: '地头堆放未清运的修剪枝条', operator: '邓小华', status: 'closed', severity: 'low', reportTime: '2026-09-19 15:00' }
  ];

  function buildAnomalies() {
    return ANOMALY_SEED.map(function (a, i) {
      return {
        id: 'AB-2026-' + pad3(i + 1),
        source: a.source, type: a.type, plot: a.plot, remark: a.remark,
        operator: a.operator, status: a.status, severity: a.severity,
        reportTime: a.reportTime, photo: '', lat: 34.58 + i * 0.001, lng: 105.72 + i * 0.001,
        handleResult: a.status === 'closed' ? '已处置' : '',
        handleRemark: a.status === 'closed' ? '现场已处理并复核' : '',
        handleTime: a.status === 'closed' ? '2026-09-20 09:00' : '',
        taskId: ''
      };
    });
  }

  /* ---------------- 读写 ---------------- */

  var inMemory = null;
  var subscribers = [];
  var lastError = '';

  function defaults() {
    var plans = buildPlans();
    var tasks = buildTasks();
    var records = buildRecords();
    var sorties = buildSorties();
    return {
      plans: plans,
      tasks: tasks,
      records: records,
      standards: buildStandards(),
      routeList: ROUTE_SEED.map(function (r) { return Object.assign({}, r); }),
      patrolPlans: buildPatrolPlans(),
      checkins: buildCheckins(),
      sorties: sorties,
      flightLogs: buildFlightLogs(sorties),
      anomalies: buildAnomalies()
    };
  }

  function load() {
    var raw;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    if (!raw) return null;
    try {
      var obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('数据结构异常');
      return obj;
    } catch (e) {
      // 数据损坏：备份原始内容后重新初始化，避免整页白屏
      try { localStorage.setItem(STORAGE_KEY + '_corrupt', raw); } catch (e2) {}
      console.warn('[ProductionStore] 本地数据损坏，已备份并重新初始化', e);
      return null;
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemory));
      lastError = '';
      return true;
    } catch (e) {
      lastError = e && e.name === 'QuotaExceededError'
        ? '本地存储空间不足，数据未保存'
        : '数据保存失败：' + (e && e.message ? e.message : '浏览器存储不可用');
      console.error('[ProductionStore]', lastError);
      return false;
    }
  }

  function ensure() {
    if (inMemory) return inMemory;
    var stored = load();
    var base = defaults();
    if (stored) {
      Object.keys(base).forEach(function (k) {
        if (!Array.isArray(stored[k])) { stored[k] = base[k]; return; }
        // 去除空项与重复主键，防止脏数据导致渲染异常
        var seen = {};
        stored[k] = stored[k].filter(function (x) {
          if (!x || typeof x !== 'object') return false;
          // 路线集合以 routeId 为主键，其余集合使用 id
          if (!x.id && k === 'routeList' && x.routeId) x.id = x.routeId;
          if (!x.id) return false;
          var id = String(x.id);
          if (seen[id]) return false;
          seen[id] = 1;
          return true;
        });
      });
      inMemory = stored;
    } else {
      inMemory = base;
      save();
    }
    // 触发后端预加载（异步，不阻塞首次渲染；未登录时静默降级）
    preloadFromBackend();
    return inMemory;
  }

  function notify(reason) {
    subscribers.forEach(function (fn) {
      try { fn(reason); } catch (e) { console.warn('[ProductionStore]', e); }
    });
  }

  function commit(reason) {
    try { recompute(); } catch (e) { console.warn('[ProductionStore] recompute 失败', e); }
    var ok = save();
    notify(reason);
    // 后端持久化（防抖，未登录/依赖未就绪时静默跳过）
    schedulePersist(reason);
    try { window.dispatchEvent(new CustomEvent('productionStoreChange', { detail: { reason: reason, saved: ok } })); } catch (e) {}
    return ok;
  }

  /* ---------------- 主键与派生 ---------------- */

  var ID_PREFIX = {
    plans: ['PL-202609-', 3], tasks: ['TK-202609-', 3], records: ['REC-202609-', 3],
    standards: ['STD-', 3], patrolPlans: ['PP-202609-', 3], checkins: ['CK-202609-', 3],
    sorties: ['SO-2026-', 3], flightLogs: ['LOG-2026-', 3], anomalies: ['AB-2026-', 3]
  };

  function nextId(entity) {
    var cfg = ID_PREFIX[entity];
    if (!cfg) return String(Date.now());
    var list = ensure()[entity] || [];
    var max = 0;
    list.forEach(function (x) {
      var m = String(x.id || '').match(/(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return cfg[0] + pad3(max + 1);
  }

  function tasksByPlan(planId) {
    if (!planId) return [];
    return ensure().tasks.filter(function (t) { return t.planId === planId; });
  }

  function recordsByTask(taskId) {
    if (!taskId) return [];
    return ensure().records.filter(function (r) { return r.taskId === taskId; });
  }

  /** 计划统计：任务数、完成数、已审核完成量 */
  function planStats(planId) {
    var tasks = tasksByPlan(planId);
    var records = ensure().records.filter(function (r) { return r.planId === planId && r.status === 'approved'; });
    var approvedQty = records.reduce(function (s, r) { return s + num(r.qty); }, 0);
    var plan = get('plans', planId);
    var planned = plan ? num(plan.plannedQty) : 0;
    return {
      taskCount: tasks.length,
      completedTasks: tasks.filter(function (t) { return t.status === 'completed'; }).length,
      approvedQty: approvedQty,
      rate: planned > 0 ? Math.round(approvedQty / planned * 100) : 0
    };
  }

  /** 任务统计：已审核记录产量 */
  function taskStats(taskId) {
    var records = recordsByTask(taskId);
    return {
      recordCount: records.length,
      approved: records.filter(function (r) { return r.status === 'approved'; }).length,
      qty: records.filter(function (r) { return r.status === 'approved'; }).reduce(function (s, r) { return s + num(r.qty); }, 0)
    };
  }

  /** 计划状态由任务与记录推导 */
  function derivePlanStatus(plan) {
    var tasks = tasksByPlan(plan.id);
    var today = todayStr();
    var st = plan.status;
    if (st === 'cancelled' || st === 'draft') return st;
    if (tasks.length) {
      if (tasks.every(function (t) { return t.status === 'completed' || t.status === 'cancelled'; })) {
        return tasks.some(function (t) { return t.status === 'completed'; }) ? 'completed' : st;
      }
      if (tasks.some(function (t) { return ['accepted', 'processing', 'reviewing', 'overdue', 'rejected'].indexOf(t.status) >= 0; })) st = 'executing';
      else if (st !== 'completed') st = 'pending';
    }
    if (st !== 'completed' && plan.endDate && plan.endDate < today) st = 'delayed';
    return st;
  }

  /** 重算超期任务与计划状态，并同步计划实际量 */
  function recompute() {
    var d = ensure();
    var today = todayStr();
    d.tasks.forEach(function (t) {
      if (['completed', 'cancelled', 'rejected'].indexOf(t.status) >= 0) return;
      if (t.deadline && t.deadline < today) {
        t.status = 'overdue';
        t.overdueDays = Math.max(1, Math.round((new Date(today) - new Date(t.deadline)) / 86400000));
      }
    });
    d.plans.forEach(function (p) {
      p.status = derivePlanStatus(p);
      var approved = d.records
        .filter(function (r) { return r.planId === p.id && r.status === 'approved'; })
        .reduce(function (s, r) { return s + num(r.qty); }, 0);
      // 已审核记录汇总优先；尚无审核记录时保留种子实际量，避免演示数据归零
      p.actualQty = approved > 0 ? approved : num(p.actualQty);
    });
    return d;
  }

  /* ---------------- 生成任务 ---------------- */

  /**
   * 按计划的地块范围拆分任务
   * @returns {number} 新建任务数
   */
  function generateTasks(planId) {
    var d = ensure();
    var invalid = validateGenerateTasks(planId);
    if (invalid) { lastError = invalid; return 0; }
    lastError = '';
    var plan = get('plans', planId);
    var plots = String(plan.plotRange || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var exist = tasksByPlan(planId).map(function (t) { return t.plotId || t.plot; });
    var share = num(plan.plannedQty) > 0 ? Math.round(num(plan.plannedQty) / plots.length) : 0;
    var created = 0;
    plots.forEach(function (plotId, i) {
      if (exist.indexOf(plotId) >= 0) return;
      d.tasks.push({
        id: nextId('tasks'),
        planId: plan.id,
        name: plan.name + ' · ' + plotLabel(plotId).split(' · ')[1],
        base: plan.base,
        plot: plotLabel(plotId).split(' · ')[1],
        plotId: plotId,
        type: plan.typeName, typeCode: plan.type,
        taskCategory: 'farming', executorType: i % 2 === 0 ? 'person' : 'team',
        priority: i === 0 ? 'high' : 'medium',
        person: plan.manager, worker: plan.manager, team: i % 2 === 0 ? '一班' : '二班',
        planTime: (plan.startDate || todayStr()) + 'T08:00',
        deadline: plan.endDate || todayStr(),
        status: 'pending', desc: plan.desc || '',
        targetQty: share, unit: plan.unit || '亩',
        standardId: plan.standardId || '',
        createdBy: '计划生成', createdAt: stampNow()
      });
      created++;
    });
    commit('generate-tasks:' + planId);
    return created;
  }

  /* ---------------- 移动端数据接入 ---------------- */

  /** 把移动端异常上报 / 无人机异常并入共享异常池（幂等） */
  function importMobile() {
    if (typeof global.MobileBridge === 'undefined') return 0;
    var d = ensure();
    var added = 0;
    var push = function (item) {
      if (!item || !item.id) return;
      if (d.anomalies.some(function (a) { return a.id === item.id; })) return;
      d.anomalies.push(item);
      added++;
    };
    try {
      var reports = (typeof global.MobileBridge.abnormalReports === 'function') ? global.MobileBridge.abnormalReports() : [];
      (Array.isArray(reports) ? reports : []).forEach(function (r) {
        if (!r || r.id == null) return;
        push({
          id: 'AB-P-' + r.id,
          source: 'patrol', type: r.type || '其他', plot: r.plot || 'D-001',
          remark: r.remark || '', operator: r.operator || '现场人员',
          status: r.status === '已处理' ? 'closed' : 'waitHandle',
          severity: 'medium', reportTime: r.reportTime || r.createTime || '',
          photo: r.photo || '', lat: r.lat, lng: r.lng,
          handleResult: r.handleResult || '', handleRemark: r.handleRemark || '',
          handleTime: r.handleTime || '', mobileId: r.id, taskId: ''
        });
      });
      var droneList = (typeof global.MobileBridge.droneAbnormal === 'function') ? global.MobileBridge.droneAbnormal() : [];
      (Array.isArray(droneList) ? droneList : []).forEach(function (r) {
        if (!r || r.id == null) return;
        push({
          id: 'AB-D-' + r.id,
          source: 'drone', type: r.type || '巡检异常', plot: r.plot || 'D-001',
          remark: r.decisionText || r.remark || '无人机巡检发现异常',
          operator: '飞控中心', status: r.decision === 'confirm' ? 'handling' : 'closed',
          severity: 'medium', reportTime: r.createTime || '',
          photo: '', lat: null, lng: null,
          handleResult: r.decision === 'confirm' ? '确认处理' : '已忽略',
          handleRemark: '', handleTime: r.createTime || '',
          mobileId: r.id, taskId: ''
        });
      });
    } catch (e) {
      lastError = '移动端异常数据接入失败：' + (e && e.message ? e.message : '未知错误');
      console.warn('[ProductionStore]', lastError);
    }
    if (added) commit('import-mobile');
    return added;
  }

  /* ---------------- 对外 API ---------------- */

  function all(entity) { return clone(ensure()[entity] || []); }

  function get(entity, id) {
    var list = ensure()[entity] || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return clone(list[i]);
    }
    return null;
  }

  function upsert(entity, item) {
    if (!item || typeof item !== 'object') { lastError = '写入数据为空'; return null; }
    var d = ensure();
    var list = d[entity];
    if (!Array.isArray(list)) { lastError = '未知的数据集合：' + entity; return null; }
    if (!item.id) item.id = nextId(entity);
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(item.id)) { idx = i; break; }
    }
    if (idx >= 0) list[idx] = Object.assign({}, list[idx], item);
    else list.unshift(item);
    commit(entity + ':' + item.id);
    return clone(item);
  }

  function remove(entity, id) {
    var d = ensure();
    if (!Array.isArray(d[entity])) { lastError = '未知的数据集合：' + entity; return false; }
    var exists = d[entity].some(function (x) { return String(x.id) === String(id); });
    if (!exists) { lastError = '数据不存在或已被删除'; return false; }
    // 关闭闭环上的悬空引用，避免出现「关联计划/任务不存在」
    if (entity === 'plans') {
      var approved = d.records.some(function (r) { return String(r.planId) === String(id) && r.status === 'approved'; });
      if (approved) { lastError = '该计划已有审核通过的记录，不能删除'; return false; }
      d.tasks.forEach(function (t) { if (String(t.planId) === String(id)) t.planId = ''; });
    }
    if (entity === 'tasks') {
      if (d.records.some(function (r) { return String(r.taskId) === String(id); })) { lastError = '该任务已有农事记录，不能删除'; return false; }
      if (d.sorties.some(function (s) { return String(s.taskId) === String(id); })) { lastError = '该任务已有无人机架次，不能删除'; return false; }
    }
    if (entity === 'patrolPlans') {
      d.tasks.forEach(function (t) { if (String(t.patrolPlanId) === String(id)) t.patrolPlanId = ''; });
    }
    if (entity === 'sorties') {
      d.flightLogs = d.flightLogs.filter(function (l) { return String(l.sortieId) !== String(id); });
    }
    d[entity] = d[entity].filter(function (x) { return String(x.id) !== String(id); });
    commit(entity + '-remove:' + id);
    return true;
  }

  /* ---------------- 巡园路线（含移动端同步） ---------------- */

  var MOBILE_ROUTE_KEY = 'mb_patrol_routes';

  /** 规范化点位数据，供保存与移动端同步复用 */
  function routePoints(route) {
    return (route && Array.isArray(route.points) ? route.points : []).map(function (p) {
      return {
        id: String(p.id || '').trim(),
        name: String(p.name || '').trim(),
        lat: num(p.lat),
        lng: num(p.lng),
        nearRadius: Math.max(1, Math.round(num(p.nearRadius, 100))),
        required: p.required !== false,
        order: Math.max(1, Math.round(num(p.order, 1)))
      };
    });
  }

  function validateRoute(route) {
    if (!route || !String(route.routeName || '').trim()) return '请填写路线名称';
    if (!String(route.base || '').trim()) return '请选择覆盖基地';
    var pts = (route && Array.isArray(route.points)) ? route.points : [];
    if (!pts.length) return '请至少添加一个巡园点位';
    var seen = {};
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i] || {};
      var pid = String(p.id || '').trim();
      if (!pid) return '第 ' + (i + 1) + ' 个点位未填写点位ID';
      if (seen[pid]) return '点位ID重复：' + pid;
      seen[pid] = 1;
      if (!String(p.name || '').trim()) return '第 ' + (i + 1) + ' 个点位未填写名称';
      var lat = parseFloat(p.lat), lng = parseFloat(p.lng);
      if (isNaN(lat) || lat < -90 || lat > 90) return '第 ' + (i + 1) + ' 个点位纬度不合法';
      if (isNaN(lng) || lng < -180 || lng > 180) return '第 ' + (i + 1) + ' 个点位经度不合法';
    }
    return '';
  }

  /** 新增 / 编辑巡园路线，并同步到移动端 mb_patrol_routes */
  function saveRoute(route) {
    var invalid = validateRoute(route);
    if (invalid) { lastError = invalid; return null; }
    var list = ensure().routeList;
    var id = String(route.routeId || route.id || '').trim();
    if (!id) {
      var max = 0;
      list.forEach(function (r) {
        var m = String(r.routeId || '').match(/(\d+)$/);
        if (m) max = Math.max(max, parseInt(m[1], 10));
      });
      id = 'RT-' + pad3(max + 1);
    }
    var points = routePoints(route);
    var item = {
      id: id, routeId: id,
      routeName: String(route.routeName).trim(),
      base: String(route.base).trim(),
      points: points,
      pointCount: points.length,
      requiredCount: points.filter(function (p) { return p.required; }).length,
      enabled: route.enabled !== false,
      remark: String(route.remark || '').trim(),
      updatedAt: stampNow()
    };
    var saved = upsert('routeList', item);
    if (!saved) return null;
    syncRoutesToMobile();
    return saved;
  }

  function removeRoute(id) {
    if (!remove('routeList', id)) return false;
    syncRoutesToMobile();
    return true;
  }

  /** 全量写入移动端 route key（含停用路线，移动端据此展示基地选项） */
  function syncRoutesToMobile() {
    var list = ensure().routeList.map(function (r) {
      return {
        routeId: r.routeId || r.id,
        routeName: r.routeName || '',
        base: r.base || '',
        points: routePoints(r),
        enabled: r.enabled !== false,
        remark: r.remark || '',
        updatedAt: r.updatedAt || ''
      };
    });
    try {
      localStorage.setItem(MOBILE_ROUTE_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      lastError = e && e.name === 'QuotaExceededError'
        ? '本地存储空间不足，巡园路线未同步到移动端'
        : '巡园路线同步失败：' + (e && e.message ? e.message : '浏览器存储不可用');
      console.warn('[ProductionStore]', lastError);
      return false;
    }
  }

  /**
   * 初始化路线：
   * - 移动端已有路线时以其为初始真相，补齐共享层缺失的路线与点位；
   * - 移动端无数据时用共享层种子生成移动端数据。
   */
  function initRoutes() {
    var mobile = [];
    try {
      var raw = localStorage.getItem(MOBILE_ROUTE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) mobile = parsed.filter(function (r) { return r && r.routeId; });
      }
    } catch (e) { mobile = []; }

    if (!mobile.length) {
      if (!ensure().routeList.length) {
        // 旧版本 routeList 主键问题导致数据被清空时，用种子恢复
        ensure().routeList = defaults().routeList;
        commit('init-routes-seed');
      }
      syncRoutesToMobile();
      return ensure().routeList.length;
    }

    var d = ensure();
    var changed = false;
    mobile.forEach(function (r) {
      var idx = -1;
      d.routeList.forEach(function (x, i) {
        if (String(x.routeId || x.id) === String(r.routeId)) idx = i;
      });
      if (idx < 0) {
        var pts = routePoints(r);
        d.routeList.push({
          id: r.routeId, routeId: r.routeId, routeName: r.routeName || '',
          base: r.base || '', points: pts, pointCount: pts.length,
          requiredCount: pts.filter(function (p) { return p.required; }).length,
          enabled: r.enabled !== false, remark: r.remark || '', updatedAt: r.updatedAt || ''
        });
        changed = true;
      } else if (!Array.isArray(d.routeList[idx].points) || !d.routeList[idx].points.length) {
        // 共享层仅有摘要时，用移动端点位补齐
        var full = routePoints(r);
        d.routeList[idx] = Object.assign({}, d.routeList[idx], {
          points: full, pointCount: full.length,
          requiredCount: full.filter(function (p) { return p.required; }).length
        });
        changed = true;
      }
    });
    if (changed) commit('init-routes');
    return d.routeList.length;
  }

  /* ---------------- 校验（返回空串表示通过，否则为错误提示） ---------------- */

  var TASK_FLOW = {
    pending: ['accepted', 'reviewing', 'cancelled'],
    accepted: ['processing', 'reviewing', 'cancelled'],
    processing: ['reviewing', 'cancelled'],
    overdue: ['processing', 'reviewing', 'cancelled'],
    rejected: ['accepted', 'reviewing', 'cancelled'],
    reviewing: ['completed', 'rejected'],
    completed: [],
    cancelled: []
  };

  function isDate(v) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))) return false;
    return !isNaN(Date.parse(String(v) + 'T00:00:00'));
  }

  function isDateTime(v) {
    if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(String(v || ''))) return false;
    return !isNaN(Date.parse(String(v).replace('T', ' ')));
  }

  function datePart(v) { return String(v || '').slice(0, 10); }

  function normalizePlot(v) {
    return String(v || '').split(' · ')[0].trim();
  }

  /** 记录涉及的地块列表：优先取 plotRange（多地块），兼容旧数据的单地块 plot */
  function recordPlots(rec) {
    if (!rec) return [];
    var raw = (rec.plotRange != null && String(rec.plotRange).trim() !== '')
      ? String(rec.plotRange)
      : (rec.plot != null ? String(rec.plot) : '');
    var out = [];
    String(raw).split(/[,，]/).forEach(function (s) {
      var p = normalizePlot(s);
      if (p && out.indexOf(p) < 0) out.push(p);
    });
    return out;
  }

  function requireField(errors, label, value) {
    if (!String(value == null ? '' : value).trim()) errors.push('请填写' + label);
  }

  function validatePlan(plan) {
    var e = [];
    if (!plan || typeof plan !== 'object') return '计划数据为空';
    requireField(e, '计划名称', plan.name);
    requireField(e, '所属基地', plan.base);
    requireField(e, '计划类型', plan.type);
    requireField(e, '负责人', plan.manager);
    if (!isDate(plan.startDate)) e.push('开始日期格式不正确');
    if (!isDate(plan.endDate)) e.push('结束日期格式不正确');
    if (isDate(plan.startDate) && isDate(plan.endDate) && plan.startDate > plan.endDate) e.push('结束日期不能早于开始日期');
    if (plan.plannedQty !== undefined && plan.plannedQty !== '' && (isNaN(parseFloat(plan.plannedQty)) || parseFloat(plan.plannedQty) < 0)) {
      e.push('计划量必须为不小于 0 的数字');
    }
    var plots = String(plan.plotRange || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!plots.length) e.push('请至少选择一个地块');
    var bad = plots.filter(function (p) { return PLOTS.indexOf(p) < 0; });
    if (bad.length) e.push('地块编号无效：' + bad.join('、'));
    if (plan.standardId) {
      var std = get('standards', plan.standardId);
      if (!std) e.push('引用的农事标准不存在');
      else if (std.status === '废止') e.push('引用的农事标准已废止，请重新选择');
    }
    return e[0] || '';
  }

  function validateTask(task) {
    var e = [];
    if (!task || typeof task !== 'object') return '任务数据为空';
    requireField(e, '任务名称', task.name);
    requireField(e, '所属基地', task.base);
    if (PLOTS.indexOf(normalizePlot(task.plotId || task.plot)) < 0) e.push('地块编号无效');
    if (!task.person && task.executorType !== 'drone') e.push('请指定负责人');
    if (task.planId && !get('plans', task.planId)) e.push('来源计划不存在');
    var plan = task.planId ? get('plans', task.planId) : null;
    if (plan && plan.status === 'cancelled') e.push('来源计划已取消，无法继续操作任务');
    if (!isDate(datePart(task.planTime))) e.push('计划开始时间格式不正确');
    if (!isDate(task.deadline)) e.push('截止日期格式不正确');
    if (isDate(datePart(task.planTime)) && isDate(task.deadline) && task.deadline < datePart(task.planTime)) {
      e.push('截止日期不能早于计划开始日期');
    }
    if (task.targetQty !== undefined && task.targetQty !== '' && isNaN(parseFloat(task.targetQty))) e.push('目标量必须为数字');
    if (parseFloat(task.targetQty) < 0) e.push('目标量不能为负数');
    return e[0] || '';
  }

  function canTransitionTask(from, to) {
    if (!from || !to || from === to) return true;
    var allow = TASK_FLOW[from];
    return !!allow && allow.indexOf(to) >= 0;
  }

  function validateRecord(rec) {
    var e = [];
    if (!rec || typeof rec !== 'object') return '农事记录为空';
    requireField(e, '所属基地', rec.base);
    var plots = recordPlots(rec);
    if (!plots.length) e.push('请选择地块');
    else {
      for (var i = 0; i < plots.length; i++) {
        if (PLOTS.indexOf(plots[i]) < 0) { e.push('地块编号无效：' + plots[i]); break; }
      }
    }
    requireField(e, '农事类型', rec.type);
    requireField(e, '执行人', rec.executor);
    if (!isDate(rec.date)) e.push('执行日期格式不正确');
    else if (rec.date > todayStr()) e.push('执行日期不能晚于今天');
    if (!(parseFloat(rec.qty) > 0) && !(parseFloat(rec.area) > 0)) e.push('完成量或完成面积必须大于 0');
    var task = rec.taskId ? get('tasks', rec.taskId) : null;
    if (rec.taskId && !task) e.push('关联任务不存在，请重新选择');
    if (task) {
      var taskPlot = normalizePlot(task.plotId || task.plot);
      // 关联任务时，所选地块必须覆盖任务地块
      if (plots.length && taskPlot && plots.indexOf(taskPlot) < 0) e.push('地块与关联任务不一致');
      if (isDate(rec.date) && isDate(datePart(task.planTime)) && rec.date < datePart(task.planTime)) {
        e.push('执行日期不能早于任务计划开始日期');
      }
    }
    return e[0] || '';
  }

  function validateStandard(std) {
    var e = [];
    if (!std || typeof std !== 'object') return '标准数据为空';
    requireField(e, '标准编号', std.code);
    requireField(e, '标准名称', std.name);
    requireField(e, '标准级别', std.level);
    requireField(e, '农事类型', std.type);
    if (!isDate(std.date)) e.push('生效日期格式不正确');
    if (std.code) {
      var dup = ensure().standards.some(function (x) {
        return String(x.id) !== String(std.id || '') && String(x.code).trim() === String(std.code).trim();
      });
      if (dup) e.push('标准编号已存在：' + std.code);
    }
    return e[0] || '';
  }

  function validatePatrolPlan(plan) {
    var e = [];
    if (!plan || typeof plan !== 'object') return '巡园计划为空';
    requireField(e, '计划名称', plan.name);
    requireField(e, '所属基地', plan.base);
    requireField(e, '负责人', plan.inspector);
    if (!isDate(plan.startDate)) e.push('开始日期格式不正确');
    if (!isDate(plan.endDate)) e.push('结束日期格式不正确');
    if (isDate(plan.startDate) && isDate(plan.endDate) && plan.startDate > plan.endDate) e.push('结束日期不能早于开始日期');
    if (plan.routeId && !ensure().routeList.some(function (r) { return r.routeId === plan.routeId; })) e.push('巡园路线不存在');
    return e[0] || '';
  }

  function validateSortie(sortie) {
    var e = [];
    if (!sortie || typeof sortie !== 'object') return '架次数据为空';
    if (!sortie.taskId || !get('tasks', sortie.taskId)) e.push('关联巡检任务不存在');
    requireField(e, '无人机', sortie.drone);
    if (PLOTS.indexOf(normalizePlot(sortie.plot)) < 0) e.push('地块编号无效');
    if (!(parseFloat(sortie.area) > 0)) e.push('飞行面积必须大于 0');
    if (!isDateTime(sortie.time)) e.push('计划时间格式不正确');
    return e[0] || '';
  }

  function validateGenerateTasks(planId) {
    var plan = get('plans', planId);
    if (!plan) return '计划不存在或已被删除';
    if (plan.status === 'cancelled') return '计划已取消，无法生成任务';
    if (plan.status === 'completed') return '计划已完成，无需再生成任务';
    var plots = String(plan.plotRange || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!plots.length) return '请先为计划配置地块范围';
    var bad = plots.filter(function (p) { return PLOTS.indexOf(p) < 0; });
    if (bad.length) return '计划地块编号无效：' + bad.join('、');
    return '';
  }

  function validateAudit(recordId) {
    var rec = get('records', recordId);
    if (!rec) return '农事记录不存在或已被删除';
    if (rec.status === 'approved') return '该记录已审核通过，不能重复审核';
    if (rec.status === 'rejected') return '该记录已退回，请修改后重新提交';
    if (!(parseFloat(rec.qty) > 0) && !(parseFloat(rec.area) > 0)) return '完成量与完成面积均为 0，不能审核通过';
    if (rec.taskId && !get('tasks', rec.taskId)) return '关联任务不存在，无法回写任务状态';
    return '';
  }

  var ProductionStore = {
    STORAGE_KEY: STORAGE_KEY,
    PLOTS: PLOTS,
    TYPES: TYPES,
    EXECUTOR_TYPES: EXECUTOR_TYPES,
    STATUS_TEXT: STATUS_TEXT,
    STANDARDS_BY_TYPE: STANDARD_BY_TYPE,
    plotLabel: plotLabel,
    recordPlots: recordPlots,
    typeCode: typeCode,
    typeTagClass: typeTagClass,
    typeColor: typeColor,
    TYPE_COLORS: TYPE_COLORS,
    TYPE_NAMES: TYPE_NAMES,
    stampNow: stampNow,
    today: todayStr,

    plans: function () { return all('plans'); },
    tasks: function () { return all('tasks'); },
    records: function () { return all('records'); },
    standards: function () { return all('standards'); },
    routeList: function () { return all('routeList'); },
    patrolPlans: function () { return all('patrolPlans'); },
    checkins: function () { return all('checkins'); },
    sorties: function () { return all('sorties'); },
    flightLogs: function () { return all('flightLogs'); },
    anomalies: function () { return all('anomalies'); },

    /**
     * 农事执行统计（P0-03 统一口径）
     * - 计划口径：plans；任务口径：tasks
     * - 达成率 = 完成计划数 /（计划总数 − 已取消计划数）
     * - 逾期：状态为 overdue，或截止日期早于今天且未完成/未取消/未退回
     */
    farmingStats: function () {
      var planList = all('plans');
      var taskList = all('tasks');
      var today = todayStr();
      var completed = 0, executing = 0, pending = 0, cancelled = 0, delayed = 0;
      planList.forEach(function (x) {
        switch (x.status) {
          case 'completed': completed++; break;
          case 'executing': executing++; break;
          case 'cancelled': cancelled++; break;
          case 'delayed': delayed++; break;
          default: pending++;
        }
      });
      var effective = planList.length - cancelled;
      var overdue = taskList.filter(function (x) {
        if (['completed', 'cancelled', 'rejected'].indexOf(x.status) >= 0) return false;
        if (x.status === 'overdue') return true;
        return !!(x.deadline && x.deadline < today);
      }).length;
      return {
        planTotal: planList.length,
        planCompleted: completed,
        planExecuting: executing,
        planPending: pending,
        planCancelled: cancelled,
        planDelayed: delayed,
        planRate: effective > 0 ? Math.round(completed / effective * 1000) / 10 : 0,
        taskTotal: taskList.length,
        taskOverdue: overdue,
        today: today,
        updatedAt: stampNow()
      };
    },

    /** 农事待办：未完成且按截止时间升序（逾期优先），供大屏与移动端复用 */
    todoTasks: function (n) {
      return all('tasks').filter(function (x) {
        return x.status === 'pending' || x.status === 'processing' || x.status === 'overdue';
      }).sort(function (a, b) {
        var ad = a.deadline || '9999-12-31';
        var bd = b.deadline || '9999-12-31';
        return ad < bd ? -1 : (ad > bd ? 1 : 0);
      }).slice(0, n || 3);
    },

    get: get,
    upsert: upsert,
    remove: remove,
    saveRoute: saveRoute,
    removeRoute: removeRoute,
    syncRoutesToMobile: syncRoutesToMobile,
    initRoutes: initRoutes,
    nextId: nextId,
    save: save,
    lastError: function () { return lastError; },
    validate: {
      plan: validatePlan,
      task: validateTask,
      record: validateRecord,
      standard: validateStandard,
      patrolPlan: validatePatrolPlan,
      route: validateRoute,
      sortie: validateSortie,
      generateTasks: validateGenerateTasks,
      audit: validateAudit,
      canTransitionTask: canTransitionTask,
      isDate: isDate,
      isDateTime: isDateTime
    },

    tasksByPlan: function (planId) { return clone(tasksByPlan(planId)); },
    recordsByTask: function (taskId) { return clone(recordsByTask(taskId)); },
    recordsByPlan: function (planId) {
      return clone(ensure().records.filter(function (r) { return r.planId === planId; }));
    },
    planStats: planStats,
    taskStats: taskStats,
    generateTasks: generateTasks,
    recompute: function () { recompute(); save(); },
    importMobile: importMobile,

    subscribe: function (fn) {
      subscribers.push(fn);
      try { fn('init'); } catch (e) {}
      return function () { subscribers = subscribers.filter(function (x) { return x !== fn; }); };
    },
    reset: function () {
      inMemory = defaults();
      commit('reset');
    },
    _defaults: defaults
  };

  global.ProductionStore = ProductionStore;
})(window);
