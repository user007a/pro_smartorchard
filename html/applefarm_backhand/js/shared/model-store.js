/**
 * 智慧果园 · 六大模型统一数据源
 * --------------------------------------------------------------
 * 承载后台「模型中心」中生长、物候、气象、病虫害、产量、价格 六个模型页
 * 的顶部 KPI、图表数据与列表数据，作为上述模型数据的唯一来源。
 *
 * 存储 key： applefarm_models_v1
 *
 * 暴露 API：
 *   ModelStore.KEYS                 → 模型键名数组 ['growth','phenology','weather','pest','yield','price']
 *   ModelStore.all()                → 全部模型深拷贝（对象，按 KEYS 归位）
 *   ModelStore.get(key)             → 单个模型深拷贝，key 非法时返回 null
 *   ModelStore.patch(key, partial)  → 浅合并顶层字段后写回并广播，返回最新模型深拷贝
 *   ModelStore.replace(key, obj)    → 整体替换指定模型并广播
 *   ModelStore.field(path)          → 按点号路径取标量值，如 'yield.kpi.0.value'
 *   ModelStore.subscribe(fn)        → 订阅变更，返回 unsubscribe（fn 会先收到一次 'init'）
 *   ModelStore.reset()              → 恢复六个模型的默认数据
 *
 * 模型对象统一结构：
 *   { key, name, statusText, updatedAt, kpi:[], charts:{}, lists:{}, meta:{} }
 *   - kpi[] 项：{ label, value, unit, trend:{ text, tone, color }, tone }
 *     value 保留页面原始数字字符串，unit 为单独拆分的单位文本，trend 保留原文案与颜色语义
 *   - 折线/柱状图统一为 { categories:[], series:[{ name, data:[] }] }
 *   - 饼图/环图统一为 { items:[{ name, value }] }
 *
 * 约定：后台为唯一数据源，移动端 / H5 / 大屏等其余端只读本 store，
 * 不得再各自硬编码模型数据；如需写入，仅允许后台页面调用 patch / replace。
 */

(function(global){
  'use strict';

  /* ============================================================
   * 后端桥接依赖自动加载（策略 A：出入口映射）
   * ============================================================ */
  var depsReady = (function ensureDeps() {
    if (typeof document === 'undefined') return Promise.resolve();
    var selfEl = document.currentScript;
    if (!selfEl || !selfEl.src) return Promise.resolve();
    var baseDir = selfEl.src.replace(/[^\/]*$/, '');
    var deps = [
      { name: 'Api', src: baseDir + '../../../common/js/api.js' },
      { name: 'ModelMapper', src: baseDir + 'model-mapper.js' }
    ];
    var pending = deps.filter(function (d) { return !global[d.name]; });
    if (!pending.length) return Promise.resolve();
    return Promise.all(pending.map(function (d) {
      return new Promise(function (resolve) {
        var s = document.createElement('script');
        s.src = d.src; s.async = false; s.onload = resolve; s.onerror = resolve;
        (document.head || document.documentElement).appendChild(s);
      });
    })).then(function () { return true; });
  })();

  var backendLoadPromise = null;
  var persistTimer = null;

  function backendApi() {
    if (typeof global.Api !== 'object' && typeof global.Api !== 'function') return null;
    if (!global.Api.get || !global.Api.create) return null;
    if (typeof global.ModelMapper === 'undefined') return null;
    return global.Api;
  }
  function backendEnabled() {
    var api = backendApi();
    if (!api) return false;
    try { return !!api.isLoggedIn(); } catch (e) { return false; }
  }
  function preloadFromBackend() {
    if (backendLoadPromise) return backendLoadPromise;
    backendLoadPromise = Promise.resolve(depsReady).then(function () {
      var api = backendApi();
      if (!api || !api.isLoggedIn || !api.isLoggedIn()) return { ok: false, message: '未登录或依赖未就绪' };
      return api.get('model/aggregate');
    }).then(function (res) {
      if (res && res.ok && res.data) {
        var models = global.ModelMapper.toAggregate(res.data);
        var e = ensure();
        KEYS.forEach(function (k) {
          if (models[k]) e[k] = models[k];
        });
        save();
        notify('backend-loaded');
      }
      return res;
    }).catch(function (err) {
      console.warn('[ModelStore] 后端预加载失败，降级 localStorage', err);
      return { ok: false, message: err && err.message };
    });
  }
  function persistToBackend() {
    var api = backendApi();
    if (!api || !backendEnabled()) return Promise.resolve({ ok: false, message: '未登录或依赖未就绪' });
    var e = ensure();
    var body = { models: global.ModelMapper.fromAggregate(e) };
    return api.create('model/aggregate', body);
  }
  function schedulePersist(reason) {
    if (!backendEnabled()) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      persistTimer = null;
      persistToBackend().catch(function (e) { console.warn('[ModelStore] 后端持久化失败', e); });
    }, 300);
  }

  var STORAGE_KEY = 'applefarm_models_v1';
  var KEYS = ['growth', 'phenology', 'weather', 'pest', 'yield', 'price'];
  var UPDATED_AT = '2026-09-24 14:30';
  /* 种子版本：演示数据按月滚动维护，版本号变化时把「已随时间失效」的数据块刷新到新种子
     （当前只刷新气象口径与地块关联字段，其余模型保留后台已保存的编辑结果） */
  var SEED_VERSION = '2026-11-10';

  var TONE_COLOR = {
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--error)',
    muted: 'var(--text-tertiary)'
  };

  /* ---------------- 通用小工具 ---------------- */

  function deepClone(o){ return JSON.parse(JSON.stringify(o)); }

  // 生成顶部 KPI 项，trend 保留原始文案与颜色语义
  function kpi(label, value, unit, trendText, trendTone, tone, extra){
    var t = trendTone || 'muted';
    var item = {
      label: label,
      value: value,
      unit: unit || '',
      trend: { text: trendText, tone: t, color: TONE_COLOR[t] || TONE_COLOR.muted },
      tone: tone
    };
    if (extra) {
      Object.keys(extra).forEach(function(k){ item[k] = extra[k]; });
    }
    return item;
  }

  var MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

  // MM-DD → 月份小数（与 model_phenology.html 同一换算口径）
  function mmddToMonthFloat(text, fallback){
    var m = /^(\d{1,2})-(\d{1,2})$/.exec(String(text || '').trim());
    if (!m) return fallback;
    var month = Math.min(12, Math.max(1, parseInt(m[1], 10)));
    var day = Math.min(31, Math.max(1, parseInt(m[2], 10)));
    return month - 1 + (day - 1) / 30;
  }

  /* ---------------- 1. 生长模型 ---------------- */

  var GROWTH_STAGES = [
    { name: '休眠期', data: [0, 0, 0, 0, 0], color: '#d5dbd5', stack: 'stage' },
    { name: '萌芽期', data: [1, 1, 1, 1, 1], color: '#d4f4dd', stack: 'stage' },
    { name: '花期',   data: [1, 1, 1, 1, 1], color: '#ffe6f0', stack: 'stage' },
    { name: '幼果期', data: [1.5, 1.5, 1.5, 1.5, 1], color: '#ffe7ba', stack: 'stage' },
    { name: '膨大期', data: [3.5, 3.5, 2.5, 2.5, 1], color: '#91d5ff', stack: 'stage' },
    { name: '着色期', data: [1.5, 1.5, 1.5, 1.5, 1], color: '#d3adf7', stack: 'stage' },
    { name: '采收期', data: [1.5, 1.5, 2, 1.5, 1.5], color: '#ffa39e', stack: 'stage' }
  ];

  var DEFAULT_GROWTH = {
    key: 'growth',
    name: '生长模型',
    statusText: '运行中',
    updatedAt: UPDATED_AT,
    kpi: [
      kpi('监测地块总数', '126', '', '覆盖率 100%', 'success', 'green'),
      kpi('膨大期地块', '98', '', '占比 77.8%', 'muted', 'blue'),
      kpi('生长异常地块', '5', '', '↑ 1 较上周', 'danger', 'red'),
      kpi('本周农事建议', '12', '', '采纳率 88%', 'success', 'orange')
    ],
    charts: {
      tempTrend: {
        categories: ['3月','4月','5月','6月','7月','8月','9月'],
        series: [
          { name: '积温 (°C·日)', data: [180, 420, 720, 1080, 1480, 1900, 2280], color: '#1890ff', area: true }
        ]
      },
      stageDistribution: {
        items: [
          { name: '休眠期', value: 8 },
          { name: '萌芽期', value: 5 },
          { name: '花期', value: 3 },
          { name: '膨大期', value: 98 },
          { name: '着色期', value: 8 },
          { name: '采收期', value: 4 }
        ]
      },
      gantt: {
        categories: ['天水A区-1号','天水A区-2号','麦积区B区-1号','麦积区C区-1号','招远E区-1号'],
        series: deepClone(GROWTH_STAGES)
      }
    },
    lists: {
      advice: [
        { title: '膨大期灌溉', desc: '每3天一次灌溉，单次30-40m³/亩，确保果实正常膨大', meta: ['98块','高优','7天'], plotRange: '98块', action: '采纳' },
        { title: '追施高钾肥', desc: '追施高钾复合肥0.5-1kg/株，促进果实膨大与糖分积累', meta: ['98块','高优','5天'], plotRange: '98块', action: '采纳' },
        { title: '轮纹病防治', desc: '喷施代森锰锌或甲基硫菌灵，间隔10-15天，叶片正反面均匀周到', meta: ['全部','中优','10天'], plotRange: '全部', action: '采纳' },
        { title: '夏季修剪', desc: '疏除徒长枝、背上枝，改善树冠通风透光条件', meta: ['65块','中优','14天'], plotRange: '65块', action: '采纳' }
      ],
      alerts: [
        { plot: '麦积区C区-1号', title: '麦积区C区-1号', desc: '积温偏差-15% · 30分钟前', level: 'red' },
        { plot: '龙口F区-2号', title: '龙口F区-2号', desc: '土壤水分不足 · 1小时前', level: 'red' },
        { plot: '青岛G区-1号', title: '青岛G区-1号', desc: '营养指标偏低 · 2小时前', level: 'orange' },
        { plot: '天水H区-1号', title: '天水H区-1号', desc: '光照不足 · 3小时前', level: 'orange' },
        { plot: '招远E区-3号', title: '招远E区-3号', desc: '叶片发黄 · 昨天', level: 'orange' }
      ],
      alertCount: 5
    },
    /* 大屏物候生长驾驶舱所需的生长看板数据（后台唯一数据源） */
    dashboard: {
      vigorIndex: 90,            /* 长势指数 0-100 */
      maturityHitRate: 94,       /* 成熟度预测吻合率 % */
      lastSampledAt: '2026-10-21'
    },
    gdd: {
      unit: '℃·d',
      cumulative: 3120,          /* 生育期积温累计 */
      weeklyAvg: 62,             /* 近 12 周周均增量 */
      compareNormal: '+4%',      /* 较常年同期 */
      weeks: ['-11','-10','-9','-8','-7','-6','-5','-4','-3','-2','-1','本周'],
      weekly: [1810,1930,2060,2190,2320,2450,2590,2730,2860,2970,3060,3120]
    },
    keyMetrics: [
      { key: 'fruitWeight',  name: '平均单果重',     value: 268,  unit: 'g',      delta: '+6.4%', trend: 'up',   grade: '良好', gradeTone: 'ok' },
      { key: 'solubleSolid', name: '可溶性固形物',   value: 13.6, unit: '%',      delta: '+0.8',  trend: 'up',   grade: '达标', gradeTone: 'ok' },
      { key: 'coloring',     name: '着色度',         value: 82,   unit: '%',      delta: '+5.1%', trend: 'up',   grade: '良好', gradeTone: 'ok' },
      { key: 'firmness',     name: '果实硬度',       value: 7.8,  unit: 'kg/cm²', delta: '-0.3',  trend: 'down', grade: '正常', gradeTone: 'nor' }
    ],
    growthCurves: {
      weeks: ['-11','-10','-9','-8','-7','-6','-5','-4','-3','-2','-1','本周'],
      metrics: [
        { key: 'diameter', name: '果实横径', unit: 'mm',     ylab: '果实横径' },
        { key: 'height',   name: '株高',     unit: 'cm',     ylab: '株高' },
        { key: 'firmness', name: '果实硬度', unit: 'kg/cm²', ylab: '果实硬度' }
      ],
      series: [
        { plotId: 'A1', plot: '1号东', variety: '富士', values: {
          diameter: [48.1,50.6,52.8,55.1,57.9,60.4,63.2,66.0,68.7,71.3,73.9,76.2],
          height:   [204,207,210,213,216,219,222,226,229,232,236,240],
          firmness: [8.6,8.5,8.4,8.3,8.2,8.1,8.0,7.9,7.9,7.8,7.8,7.8]
        } },
        { plotId: 'B2', plot: '2号北', variety: '王林', values: {
          diameter: [46.3,48.4,50.9,53.2,55.8,58.6,61.1,63.7,66.4,69.0,71.9,74.5],
          height:   [199,202,205,208,211,214,217,220,223,226,229,232],
          firmness: [8.4,8.3,8.2,8.1,8.1,8.0,7.9,7.8,7.8,7.7,7.7,7.7]
        } },
        { plotId: 'C3', plot: '3号西', variety: '花牛苹果', values: {
          diameter: [50.2,52.9,55.4,58.0,60.7,63.5,66.2,69.0,71.8,74.4,76.6,78.6],
          height:   [212,215,218,221,224,227,230,233,236,239,242,245],
          firmness: [8.8,8.7,8.6,8.5,8.4,8.3,8.2,8.1,8.0,8.0,7.9,7.9]
        } },
        { plotId: 'D1', plot: '1号南', variety: '富士', values: {
          diameter: [47.4,49.8,52.1,54.6,57.2,59.9,62.5,65.2,67.9,70.5,73.0,75.4],
          height:   [207,210,213,216,219,222,225,228,231,234,237,240],
          firmness: [8.5,8.4,8.3,8.2,8.2,8.1,8.0,7.9,7.9,7.8,7.8,7.8]
        } }
      ]
    },
    meta: {
      title: '生长模型',
      subtitle: '积温驱动 · 生育期跟踪与农事建议',
      icon: 'plant',
      badge: '模型运行中',
      tabs: [
        { key: 'monitor', label: '生长监测' },
        { key: 'gantt', label: '生育期甘特' },
        { key: 'advice', label: '建议与报警' }
      ]
    }
  };

  /* ---------------- 2. 物候模型 ---------------- */

  var DEFAULT_STAGES = [
    { name: '休眠期', start: '01-01', end: '01-15', color: '#d5dbd5', varieties: '花牛苹果（早熟）/ 花牛苹果（晚熟）/ 金帅' },
    { name: '萌芽期', start: '01-15', end: '02-15', color: '#b7eb8f', varieties: '花牛苹果（早熟）/ 花牛苹果（晚熟）/ 金帅' },
    { name: '花期',   start: '02-15', end: '03-15', color: '#ffadd2', varieties: '花牛苹果（早熟）/ 花牛苹果（晚熟）/ 金帅' },
    { name: '幼果期', start: '03-15', end: '04-15', color: '#ffd591', varieties: '花牛苹果（早熟）/ 花牛苹果（晚熟）/ 金帅' },
    { name: '膨大期', start: '04-15', end: '08-15', color: '#91d5ff', varieties: '花牛苹果（早熟）/ 花牛苹果（晚熟）/ 金帅' },
    { name: '着色期', start: '08-15', end: '10-01', color: '#d3adf7', varieties: '花牛苹果（早熟）/ 花牛苹果（晚熟）/ 金帅' },
    { name: '采收期', start: '10-01', end: '12-31', color: '#ffa39e', varieties: '花牛苹果（早熟）/ 花牛苹果（晚熟）/ 金帅' }
  ];

  var PHENOLOGY_VARIETIES = ['花牛苹果（早熟）', '花牛苹果（晚熟）', '金帅'];
  var PHENOLOGY_OFFSETS = { '花牛苹果（早熟）': -0.3, '花牛苹果（晚熟）': 0, '金帅': 0.2 };

  // 年历图系列由物候期配置 + 品种偏移换算（与页面渲染逻辑一致）
  function buildCalendarSeries(stages){
    return stages.map(function(s){
      var start = mmddToMonthFloat(s.start, 0);
      var end = mmddToMonthFloat(s.end, 12);
      return {
        name: s.name,
        color: s.color,
        data: PHENOLOGY_VARIETIES.map(function(v){
          var off = PHENOLOGY_OFFSETS[v] || 0;
          return [Math.max(0, start + off), Math.min(12, end + off)];
        })
      };
    });
  }

  var DEFAULT_PHENOLOGY = {
    key: 'phenology',
    name: '物候模型',
    statusText: '运行中',
    updatedAt: UPDATED_AT,
    kpi: [
      kpi('花牛苹果·晚熟', '膨大期', '', '98块地块', 'muted', 'green'),
      kpi('花牛苹果·早熟', '着色期', '', '8块地块', 'muted', 'purple'),
      kpi('金帅·中熟', '采收期', '', '4块地块', 'muted', 'orange'),
      kpi('品种跟踪', '3', '', '本周全预测', 'success', 'blue')
    ],
    charts: {
      calendar: {
        categories: MONTHS.slice(),
        series: buildCalendarSeries(DEFAULT_STAGES)
      }
    },
    lists: {
      stages: deepClone(DEFAULT_STAGES),
      deviations: [
        { title: '早熟·盛花期', desc: '推迟5天，关注授粉', value: '推迟5天', tone: 'delay' },
        { title: '晚熟·幼果期', desc: '推迟3天，加强营养', value: '推迟3天', tone: 'delay' },
        { title: '早熟·着色期', desc: '提前2天，控水促色', value: '提前2天', tone: 'advance' },
        { title: '金帅·采收期', desc: '常年持平', value: '正常', tone: 'normal' }
      ],
      tasks: [
        { title: '膨大期灌溉任务', desc: '花牛苹果膨大期关键阶段，建议增加灌溉频率', variety: '花牛苹果', action: '发布' },
        { title: '膨大期追肥任务', desc: '追施高钾复合肥 0.5-1kg/株', variety: '花牛苹果', action: '发布' },
        { title: '着色期病虫害防治', desc: '注意防治炭疽病和轮纹病', variety: '花牛苹果', action: '发布' }
      ]
    },
    meta: {
      title: '物候模型',
      subtitle: '物候年历 · 期配置与农时偏差预警',
      icon: 'seed',
      badge: '模型运行中',
      today: '09-24',
      todayMarker: 8.6,
      months: MONTHS.slice(),
      varieties: PHENOLOGY_VARIETIES.slice(),
      offsets: deepClone(PHENOLOGY_OFFSETS),
      storageKey: 'snzg_phenology_stages',
      tabs: [
        { key: 'calendar', label: '物候年历' },
        { key: 'config', label: '物候期配置' },
        { key: 'task', label: '农时与任务' }
      ]
    }
  };

  /* ---------------- 3. 气象模型 ---------------- */

  var DEFAULT_WEATHER = {
    key: 'weather',
    name: '气象模型',
    statusText: '运行中',
    updatedAt: UPDATED_AT,
    /* 11 月口径（采收期）：与设备测点 D-001 读数对齐，避免大屏 / 移动端各说一套 */
    kpi: [
      kpi('当前温度', '18.6', '°C', '设备测点均值', 'success', 'blue'),
      kpi('相对湿度', '54.2', '%', '适宜', 'muted', 'green'),
      kpi('风速·东南风', '2.8', 'm/s', '2级', 'muted', 'orange'),
      kpi('今日降雨', '0', 'mm', '晴朗', 'success', 'purple')
    ],
    charts: {
      tempTrend: {
        categories: ['今天','明天','周四','周五','周六','周日'],
        series: [
          { name: '最高温', data: [19, 18, 17, 15, 14, 16], color: '#fa8c16', smooth: true },
          { name: '最低温', data: [6, 5, 4, 2, 1, 3], color: '#1890ff', smooth: true }
        ]
      }
    },
    lists: {
      forecast: [
        { date: '今天', icon: '☀️', high: '19°', low: '6°', rain: 0, active: true },
        { date: '明天', icon: '⛅', high: '18°', low: '5°', rain: 0, active: false },
        { date: '周四', icon: '☁', high: '17°', low: '4°', rain: 0.4, active: false },
        { date: '周五', icon: '🌧', high: '15°', low: '2°', rain: 2.6, active: false },
        { date: '周六', icon: '🌧', high: '14°', low: '1°', rain: 3.1, active: false },
        { date: '周日', icon: '⛅', high: '16°', low: '3°', rain: 0.2, active: false },
        { date: '周一', icon: '☀️', high: '17°', low: '4°', rain: 0, active: false }
      ],
      riskProbability: [
        { name: '高温热害', value: '12%', percent: 12, level: 'low' },
        { name: '低温冻害', value: '5%', percent: 5, level: 'low' },
        { name: '干旱风险', value: '35%', percent: 35, level: 'medium' },
        { name: '洪涝风险', value: '8%', percent: 8, level: 'low' }
      ],
      indexes: [
        { name: '开花冻害', value: '低', warning: false },
        { name: '果实日烧', value: '中', warning: true },
        { name: '着色适宜', value: '高', warning: false }
      ],
      historyCompare: [
        { label: '2025年', percent: 75, value: '22.5°', tone: 'blue' },
        { label: '2024年', percent: 70, value: '21.0°', tone: 'green' },
        { label: '2023年', percent: 68, value: '20.4°', tone: 'orange' },
        { label: '2022年', percent: 65, value: '19.5°', tone: 'blue' },
        { label: '2021年', percent: 72, value: '21.6°', tone: 'green' }
      ],
      extremeWarnings: [
        { icon: '❄️', name: '霜冻风险', time: '--', unit: '暂无风险' },
        { icon: '💨', name: '大风预警', time: '72', unit: '小时后' },
        { icon: '🌧', name: '暴雨预警', time: '96', unit: '小时后' }
      ]
    },
    meta: {
      title: '气象模型',
      subtitle: '天气预报 · 气象风险与极端天气预警',
      icon: 'sun',
      badge: '模型运行中',
      /* P1-03：补齐大屏气象趋势所需字段（11 月口径），缺失时大屏显示“暂无数据” */
      extended: {
        observedAt: '2026-11-10 08:12',
        precipitation: 0,        /* 今日降水量 mm */
        sunshineHours: 5.6,      /* 今日日照时数 h */
        rainProbability: 20,     /* 明日降水概率 % */
        tempDrop: 4,             /* 未来 48h 降温幅度 ℃ */
        humidity: 54.2,
        windSpeed: 2.8,
        rainfall: 0
      },
      tabs: [
        { key: 'forecast', label: '实时与预报' },
        { key: 'index', label: '指数与预警' }
      ]
    }
  };

  /* ---------------- 4. 病虫害模型 ---------------- */

  /* plotCode 为地块主数据（smartorchard_plot_master）主键，模型地块必须可回链台账 */
  var PEST_PLOTS = [
    { id: 'A1', plotCode: 'D-001', name: '1号东', pts: [[258,58],[448,46],[452,182],[300,190],[256,172]], variety: '富士', area: 9.2, level: 'low', riskIndex: 18, pest: '无', manager: '张建国', updated: '09-23 14:30', yieldL: '高', health: 92 },
    { id: 'A2', plotCode: 'D-002', name: '2号东', pts: [[462,44],[652,52],[656,184],[466,188]], variety: '王林', area: 8.6, level: 'low', riskIndex: 22, pest: '无', manager: '张建国', updated: '09-23 14:30', yieldL: '高', health: 90 },
    { id: 'A3', plotCode: 'D-003', name: '3号东', pts: [[666,50],[702,44],[794,184],[700,190],[662,180]], variety: '花牛苹果', area: 7.8, level: 'medium', riskIndex: 52, pest: '早期落叶病', manager: '李红', updated: '09-24 09:15', yieldL: '中', health: 74 },
    { id: 'A4', plotCode: 'D-004', name: '4号东', pts: [[714,46],[888,52],[894,186],[800,182],[708,120]], variety: '红星', area: 8.1, level: 'low', riskIndex: 15, pest: '无', manager: '李红', updated: '09-23 14:30', yieldL: '高', health: 91 },
    { id: 'B1', plotCode: 'D-005', name: '1号北', pts: [[254,206],[446,200],[450,376],[300,384],[254,360]], variety: '富士', area: 9.0, level: 'low', riskIndex: 20, pest: '无', manager: '王强', updated: '09-23 14:30', yieldL: '高', health: 93 },
    { id: 'B2', plotCode: 'D-006', name: '2号北', pts: [[460,198],[648,204],[652,380],[464,382]], variety: '王林', area: 8.4, level: 'medium', riskIndex: 58, pest: '蚜虫', manager: '王强', updated: '09-24 08:50', yieldL: '低', health: 61 },
    { id: 'B3', plotCode: 'D-007', name: '3号北', pts: [[660,204],[772,200],[776,378],[664,380]], variety: '花牛苹果', area: 8.0, level: 'high', riskIndex: 82, pest: '轮纹病', manager: '赵敏', updated: '09-24 11:20', yieldL: '中', health: 89 },
    { id: 'B4', plotCode: 'D-008', name: '4号北', pts: [[788,210],[892,206],[896,378],[790,374]], variety: '红星', area: 7.9, level: 'medium', riskIndex: 47, pest: '红蜘蛛', manager: '赵敏', updated: '09-24 10:05', yieldL: '中', health: 77 },
    { id: 'C1', plotCode: 'D-009', name: '1号西', pts: [[256,398],[448,392],[452,552],[270,560],[256,530]], variety: '富士', area: 8.7, level: 'low', riskIndex: 25, pest: '无', manager: '孙磊', updated: '09-23 14:30', yieldL: '高', health: 90 },
    { id: 'C2', plotCode: 'D-010', name: '2号西', pts: [[462,392],[650,396],[654,556],[466,558]], variety: '王林', area: 8.2, level: 'low', riskIndex: 28, pest: '无', manager: '孙磊', updated: '09-23 14:30', yieldL: '中', health: 88 },
    { id: 'C3', plotCode: 'D-011', name: '3号西', pts: [[664,396],[888,390],[892,556],[672,560]], variety: '花牛苹果', area: 7.6, level: 'high', riskIndex: 76, pest: '炭疽病', manager: '周涛', updated: '09-24 11:00', yieldL: '低', health: 58 },
    { id: 'D1', plotCode: 'D-012', name: '1号南', pts: [[258,578],[632,566],[640,684],[300,692],[262,640]], variety: '富士', area: 8.3, level: 'low', riskIndex: 19, pest: '无', manager: '周涛', updated: '09-23 14:30', yieldL: '高', health: 91 }
  ];

  var PEST_BASE_PLOTS = [
    { id: 'TS', name: '天水基地', pts: [[40,150],[180,140],[200,300],[60,310]], area: 105.0, level: 'medium', riskIndex: 63, pest: '轮纹病', manager: '陈志强', updated: '09-24 09:45', yieldL: '中', health: 76 },
    { id: 'LK', name: '龙口基地', pts: [[740,260],[880,270],[870,400],[740,400]], area: 88.0, level: 'low', riskIndex: 24, pest: '无', manager: '刘海涛', updated: '09-23 14:30', yieldL: '高', health: 89 },
    { id: 'QD', name: '青岛基地', pts: [[60,400],[200,400],[220,560],[70,580]], area: 72.0, level: 'low', riskIndex: 21, pest: '无', manager: '王福生', updated: '09-23 14:30', yieldL: '高', health: 87 },
    { id: 'ZY', name: '招远基地', pts: [[710,420],[880,430],[870,560],[720,560]], area: 62.0, level: 'medium', riskIndex: 44, pest: '红蜘蛛', manager: '孙明德', updated: '09-24 10:30', yieldL: '中', health: 79 }
  ];

  var DEFAULT_PEST = {
    key: 'pest',
    name: '病虫害模型',
    statusText: '运行中',
    updatedAt: UPDATED_AT,
    kpi: [
      kpi('高风险地块', '3', '', '需立即处理', 'danger', 'red', { domId: 'statHighRisk' }),
      kpi('中风险地块', '18', '', '监测中', 'warning', 'orange', { domId: 'statMidRisk' }),
      kpi('低风险地块', '105', '', '安全', 'success', 'green', { domId: 'statLowRisk' }),
      kpi('今日防治建议', '6', '', '已生成', 'muted', 'blue')
    ],
    charts: {
      riskTrend3: {
        categories: ['今天', '明天', '后天'],
        series: [
          { name: '综合风险指数', data: [68, 35, 22], color: '#ff4d4f', area: true }
        ]
      },
      riskTrend7: {
        categories: ['今天', '明天', '周四', '周五', '周六', '周日', '下周一'],
        series: [
          { name: '综合风险指数', data: [68, 35, 22, 25, 12, 18, 30], color: '#ff4d4f', area: true }
        ]
      }
    },
    lists: {
      pestTypes: ['轮纹病', '炭疽病', '早期落叶病', '蚜虫', '红蜘蛛'],
      factors: [
        { name: '温度条件', value: '25-28°C', status: '适宜发病', tone: 'danger' },
        { name: '相对湿度', value: '75-85%', status: '较适宜', tone: 'warning' },
        { name: '未来降雨量', value: '15mm', status: '利于传播', tone: 'warning' },
        { name: '发病概率', value: '68%', status: '高风险', tone: 'danger' }
      ],
      treatment: {
        title: '⚠ 防治建议',
        desc: '降雨前喷施代森锰锌或甲基硫菌灵进行预防，间隔10-15天再喷一次，叶片正反面均匀周到。',
        meta: ['窗口：未来3天', '有效期：10-15天'],
        action: '采纳建议',
        pestName: '轮纹病防治'
      },
      plots: deepClone(PEST_PLOTS),
      basePlots: deepClone(PEST_BASE_PLOTS),
      riskLegend: [
        { label: '高风险', color: '#ff5d63' },
        { label: '中风险', color: '#f5b53d' },
        { label: '低风险', color: '#2bd46e' },
        { label: '蓄水池', color: '#9fd0ff' }
      ]
    },
    meta: {
      title: '病虫害模型',
      subtitle: '风险地图 · 模型推演与防治建议',
      icon: 'bug',
      badge: '模型运行中',
      mapViewBox: '0 0 900 720',
      mapImage: 'images/gis_base.jpg',
      baseBoundary: '238,30 892,34 896,688 430,704 210,652 182,470 228,290 214,130',
      water: { cx: 186, cy: 606, rx: 38, ry: 24, label: '蓄水池' },
      facility: { x: 40, y: 50, width: 96, height: 46, rx: 10, label: '分选中心' },
      riskLevelRule: '风险等级由指数推导：≥70 高 · 40-69 中 · <40 低',
      tabs: [
        { key: 'map', label: '风险地图' },
        { key: 'trend', label: '趋势与清单' }
      ]
    }
  };

  /* ---------------- 5. 产量模型 ---------------- */

  var DEFAULT_YIELD = {
    key: 'yield',
    name: '产量模型',
    statusText: '运行中',
    updatedAt: UPDATED_AT,
    kpi: [
      kpi('预估总产量', '450', '吨', '↑ 7.1% 较去年', 'success', 'green'),
      kpi('天水基地', '168', '吨', '占37.3%', 'success', 'blue'),
      kpi('麦积区基地', '95', '吨', '占21.1%', 'success', 'orange'),
      kpi('花牛苹果品种', '315', '吨', '70% 占比', 'muted', 'purple')
    ],
    charts: {
      baseYield: {
        categories: ['天水','麦积区','龙口','招远','青岛'],
        series: [
          { name: '预估产量(吨)', data: [168, 95, 72, 62, 53], color: '#1890ff', itemStyle: { borderRadius: [4, 4, 0, 0] } }
        ]
      },
      yieldCompare: {
        categories: ['天水','麦积区','龙口','招远','青岛'],
        series: [
          { name: '模型预估(吨)', data: [168, 95, 72, 62, 53], color: '#1890ff' },
          { name: '上年度实采(吨)', data: [162.4, 89.6, 76.8, 59.3, 57.9], color: '#52c41a' }
        ]
      },
      fruitSize: {
        categories: ['65mm','70mm','75mm','80mm','85mm'],
        series: [
          { name: '占比 %', data: [12, 22, 35, 22, 9], color: '#52c41a', itemStyle: { borderRadius: [4, 4, 0, 0] } }
        ]
      }
    },
    lists: {
      baseYield: [
        { base: '天水', predict: 168, actual: 162.4 },
        { base: '麦积区', predict: 95, actual: 89.6 },
        { base: '龙口', predict: 72, actual: 76.8 },
        { base: '招远', predict: 62, actual: 59.3 },
        { base: '青岛', predict: 53, actual: 57.9 }
      ],
      factors: [
        { name: '光照充足', desc: '日照较常年多12%', impact: '+8%', tone: 'positive' },
        { name: '灌溉及时', desc: '水肥一体化提升', impact: '+5%', tone: 'positive' },
        { name: '病虫害影响', desc: '部分地块轮纹病发生', impact: '-3%', tone: 'negative' },
        { name: '高温影响', desc: '7月高温天数较多', impact: '-2%', tone: 'negative' }
      ],
      plots: [
        { plot: '天水A区-1号', variety: '花牛苹果', area: '25亩', predict: '32.5吨', actual: '31.2吨', deviation: '↑ 4.2%', deviationTone: 'up', confidence: '92%', confidenceTone: 'success', status: '↑ 稳定', statusTone: 'success' },
        { plot: '天水A区-2号', variety: '花牛苹果', area: '22亩', predict: '27.8吨', actual: '27.4吨', deviation: '↑ 1.5%', deviationTone: 'flat', confidence: '89%', confidenceTone: 'success', status: '↑ 稳定', statusTone: 'success' },
        { plot: '麦积区B区-1号', variety: '花牛苹果', area: '18亩', predict: '22.6吨', actual: '20.8吨', deviation: '↑ 8.7%', deviationTone: 'up', confidence: '91%', confidenceTone: 'success', status: '↑ 稳定', statusTone: 'success' },
        { plot: '龙口F区-2号', variety: '花牛苹果', area: '20亩', predict: '24.8吨', actual: '26.9吨', deviation: '↓ 7.8%', deviationTone: 'down', confidence: '85%', confidenceTone: 'warning', status: '- 略低', statusTone: 'warning' },
        { plot: '招远E区-1号', variety: '金帅', area: '18亩', predict: '19.2吨', actual: '18.6吨', deviation: '↑ 3.2%', deviationTone: 'flat', confidence: '88%', confidenceTone: 'success', status: '↑ 稳定', statusTone: 'success' },
        { plot: '青岛G区-1号', variety: '红富士', area: '16亩', predict: '17.5吨', actual: '19.1吨', deviation: '↓ 8.4%', deviationTone: 'down', confidence: '83%', confidenceTone: 'warning', status: '- 略低', statusTone: 'warning' }
      ],
      deviationNote: {
        formula: '偏差率 =（模型预估 − 上年度实采）÷ 上年度实采 × 100%。',
        rule: '着色口径：|偏差| ≤ 3% 绿色（模型可信）、3% ~ 7% 黄色（需复核）、> 7% 红色（建议校准模型参数）。'
      }
    },
    meta: {
      title: '产量模型',
      subtitle: '多因子融合 · 产量预估与偏差复核',
      icon: 'chartBar',
      badge: '模型运行中',
      deviationThresholds: { success: 3, warning: 7 },
      tabs: [
        { key: 'overview', label: '产量总览' },
        { key: 'compare', label: '预估与偏差' },
        { key: 'plot', label: '地块下钻' }
      ]
    }
  };

  /* ---------------- 6. 价格模型 ---------------- */

  var DEFAULT_PRICE = {
    key: 'price',
    name: '价格模型',
    statusText: '运行中',
    updatedAt: UPDATED_AT,
    kpi: [
      kpi('当前均价', '5.2', '元/斤', '↑ 0.3 较上周', 'success', 'green'),
      kpi('预测趋势', '上涨', '', '11月达峰', 'muted', 'blue', { valueColor: 'var(--primary-500)' }),
      kpi('预测高价', '8.5', '元/斤', '11月上旬', 'muted', 'orange'),
      kpi('最佳销售窗口', '10月中旬', '', '21天后', 'success', 'purple')
    ],
    charts: {
      priceTrend: {
        categories: ['6月','7月','8月','9月','10月','11月','12月'],
        series: [
          { name: '预测价', data: [5.2, 5.3, 5.5, 6.5, 8.0, 8.5, 7.2], color: '#1890ff', area: true, smooth: true },
          { name: '历史同期', data: [4.8, 5.0, 5.2, 5.5, 6.2, 6.5, 5.8], color: '#d9d9d9', smooth: true }
        ]
      }
    },
    lists: {
      varieties: ['花牛苹果（晚熟）', '花牛苹果（早熟）', '金帅'],
      simulate: {
        title: '🎮 调整参数查看预测',
        basePrice: 5.2,
        params: [
          { label: '产量变化', min: -30, max: 30, value: 0, text: '+0%' },
          { label: '市场供给', min: -30, max: 30, value: -10, text: '-10%' },
          { label: '消费需求', min: -30, max: 30, value: 15, text: '+15%' }
        ],
        elasticity: { yield: -0.03, supply: -0.05, demand: 0.04 },
        result: '5.60 元/斤',
        resultLabel: '模拟预测价格',
        hint: '基于弹性系数 · 实时计算'
      },
      saleWindow: {
        title: '⚠ 销售建议',
        time: '10月中旬',
        desc: '预计价格峰值，建议在此时段集中销售',
        countdown: [
          { value: '21', label: '天' },
          { value: '8', label: '时' },
          { value: '30', label: '分' }
        ]
      },
      specs: [
        { label: '85mm+', width: 90, price: '9.5元', gradient: 'linear-gradient(90deg,#1890ff,#52c41a)' },
        { label: '80-85mm', width: 75, price: '7.8元', gradient: 'linear-gradient(90deg,#1890ff,#40a9ff)' },
        { label: '75-80mm', width: 60, price: '6.2元', gradient: 'linear-gradient(90deg,#fa8c16,#ffc53d)' },
        { label: '70-75mm', width: 45, price: '4.8元', gradient: 'linear-gradient(90deg,#722ed1,#9254de)' }
      ],
      factors: [
        { arrow: '↑', tone: 'positive', text: '市场供给减少，利好价格上涨' },
        { arrow: '↑', tone: 'positive', text: '节日消费需求增加' },
        { arrow: '→', tone: 'warning', text: '期货市场平稳，现货稳定' },
        { arrow: '↓', tone: 'negative', text: '进口苹果增加，竞争加剧' }
      ]
    },
    meta: {
      title: '价格模型',
      subtitle: '价格趋势 · 情景模拟与销售时机建议',
      icon: 'wallet',
      badge: '模型运行中',
      tabs: [
        { key: 'trend', label: '价格预测' },
        { key: 'strategy', label: '销售策略' }
      ]
    }
  };

  /* ---------------- 读写与广播 ---------------- */

  var subscribers = [];
  var inMemory = null;

  function defaults(){
    return {
      growth: deepClone(DEFAULT_GROWTH),
      phenology: deepClone(DEFAULT_PHENOLOGY),
      weather: deepClone(DEFAULT_WEATHER),
      pest: deepClone(DEFAULT_PEST),
      yield: deepClone(DEFAULT_YIELD),
      price: deepClone(DEFAULT_PRICE)
    };
  }

  // localStorage 读写容错：不可用或数据损坏时不抛错
  function safeGet(key){
    try { return localStorage.getItem(key); } catch(e){ return null; }
  }

  function safeSet(key, value){
    try { localStorage.setItem(key, value); return true; } catch(e){ return false; }
  }

  function load(){
    var raw = safeGet(STORAGE_KEY);
    if (!raw) return null;
    try {
      var obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
      return obj;
    } catch(e){ return null; }
  }

  function save(){
    safeSet(STORAGE_KEY, JSON.stringify(inMemory));
  }

  // 单个模型容错合并：缺失字段补默认值，类型损坏的数据块整体回落
  function mergeModel(base, item){
    var out = Object.assign({}, base, item);
    if (!Array.isArray(out.kpi)) out.kpi = base.kpi;
    ['charts', 'lists', 'meta'].forEach(function(f){
      var v = out[f];
      if (!v || typeof v !== 'object' || Array.isArray(v)) out[f] = base[f];
    });
    if (!out.key) out.key = base.key;
    if (!out.name) out.name = base.name;
    return out;
  }

  function ensure(){
    if (inMemory) return inMemory;
    var base = defaults();
    var stored = load();
    if (stored) {
      // 逐键校正：缺失或结构损坏的模型回落到默认值，新增字段自动补齐
      KEYS.forEach(function(k){
        var item = stored[k];
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          stored[k] = base[k];
        } else {
          stored[k] = mergeModel(base[k], item);
        }
      });
      // 种子版本升级：把随时间失效的数据块（气象口径）刷新到新种子，其余保留用户编辑结果
      if (stored.__seedVersion !== SEED_VERSION) {
        stored.weather = base.weather;
        stored.__seedVersion = SEED_VERSION;
      }
      inMemory = stored;
    } else {
      inMemory = base;
      save();
    }
    if (typeof depsReady !== 'undefined') preloadFromBackend();
    return inMemory;
  }

  function notify(reason){
    subscribers.forEach(function(fn){
      try { fn(reason); } catch(e){ console.warn('[ModelStore] subscriber error', e); }
    });
  }

  function broadcast(reason){
    save();
    notify(reason);
    try {
      window.dispatchEvent(new CustomEvent('modelStoreChange', { detail:{ reason: reason } }));
    } catch(e){}
    if (typeof schedulePersist === 'function') schedulePersist(reason);
  }

  function isKey(key){
    return KEYS.indexOf(key) >= 0;
  }

  /* ---------------- 派生计算：物候期快照 / 病虫害风险等级 ---------------- */

  // MM-DD → 月日序数（月×100+日），同年内可直接比较大小
  function mmddOrdinal(text){
    var m = /^(\d{1,2})-(\d{1,2})$/.exec(String(text || '').trim());
    if (!m) return null;
    var mo = Math.min(12, Math.max(1, parseInt(m[1], 10)));
    var d = Math.min(31, Math.max(1, parseInt(m[2], 10)));
    return mo * 100 + d;
  }

  function ordinalToUtc(year, ord){
    return Date.UTC(year, Math.floor(ord / 100) - 1, ord % 100);
  }

  function pad2(n){ return ('0' + n).slice(-2); }

  /* ---------------- 对外 API ---------------- */

  var ModelStore = {
    STORAGE_KEY: STORAGE_KEY,
    KEYS: KEYS.slice(),

    /**
     * 物候期快照：以 phenology.lists.stages 为唯一真源派生
     * 大屏、移动端、后台首页统一读取本方法，禁止各自硬编码当前物候期
     * @param {Date|string} [date] 传入日期时按该日期计算，缺省为今天
     * @returns {object|null} { today, currentStage, stageStart, stageEnd, progress, nextStage, harvestWindow }
     */
    phenologySnapshot: function(date){
      var model = ensure().phenology;
      var stages = (model.lists && model.lists.stages) || [];
      if (!stages.length) return null;

      var dt = date ? new Date(date) : new Date();
      if (isNaN(dt.getTime())) dt = new Date();
      var year = dt.getFullYear();
      var now = (dt.getMonth() + 1) * 100 + dt.getDate();

      var idx = -1;
      for (var i = 0; i < stages.length; i++) {
        var s = mmddOrdinal(stages[i].start);
        var e = mmddOrdinal(stages[i].end);
        if (s === null || e === null) continue;
        if (now >= s && now <= e) { idx = i; break; }
      }
      if (idx < 0) {
        // 落在配置空档时，取最近一个已开始的物候期
        idx = 0;
        for (var j = 0; j < stages.length; j++) {
          var sj = mmddOrdinal(stages[j].start);
          if (sj !== null && sj <= now) idx = j;
        }
      }

      var st = stages[idx];
      var start = mmddOrdinal(st.start);
      var end = mmddOrdinal(st.end);
      var progress = 0;
      if (start !== null && end !== null && end > start) {
        var t0 = ordinalToUtc(year, start);
        var t1 = ordinalToUtc(year, end);
        var tn = Date.UTC(year, dt.getMonth(), dt.getDate());
        progress = Math.max(0, Math.min(100, Math.round((tn - t0) / (t1 - t0) * 100)));
      }

      var harvestIndex = -1;
      for (var k = 0; k < stages.length; k++) {
        if (String(stages[k].name).indexOf('采收') >= 0) { harvestIndex = k; break; }
      }
      var harvestWindow = { start: '', end: '', isOpen: false, daysLeft: 0 };
      if (harvestIndex >= 0) {
        var hs = mmddOrdinal(stages[harvestIndex].start);
        var he = mmddOrdinal(stages[harvestIndex].end);
        var daysLeft = 0;
        if (he !== null) {
          var todayUtc = Date.UTC(year, dt.getMonth(), dt.getDate());
          daysLeft = Math.max(0, Math.round((ordinalToUtc(year, he) - todayUtc) / 86400000));
        }
        harvestWindow = {
          start: stages[harvestIndex].start || '',
          end: stages[harvestIndex].end || '',
          isOpen: hs !== null && he !== null && now >= hs && now <= he,
          daysLeft: daysLeft
        };
      }

      return {
        today: pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate()),
        year: year,
        currentStage: st.name,
        stageStart: st.start,
        stageEnd: st.end,
        progress: progress,
        nextStage: (stages[(idx + 1) % stages.length] || {}).name || '',
        harvestWindow: harvestWindow
      };
    },

    /**
     * 病虫害风险等级归一：兼容 level 字符串与 riskIndex 数值
     * 规则与 pest.meta.riskLevelRule 一致：≥70 高 · 40-69 中 · <40 低
     */
    riskLevelOf: function(value){
      if (value === 'low' || value === 'medium' || value === 'high') return value;
      var n = Number(value);
      if (isNaN(n)) return 'low';
      return n >= 70 ? 'high' : (n >= 40 ? 'medium' : 'low');
    },

    /**
     * 综合健康指数：Σ(地块 health × 面积) / Σ面积
     * 口径版本 v1（面积加权），仅统计已建模地块，返回值带样本数，供大屏直接展示
     * @returns {{value:number, sampleCount:number, totalArea:number, updatedAt:string, method:string}}
     */
    healthIndex: function(){
      var model = ensure().pest;
      var plots = (model.lists && model.lists.plots) || [];
      var wsum = 0, asum = 0, updatedAt = '';
      plots.forEach(function(p){
        var a = Number(p.area) || 0;
        var h = Number(p.health);
        if (!a || isNaN(h)) return;
        wsum += h * a;
        asum += a;
        if (p.updated && p.updated > updatedAt) updatedAt = p.updated;
      });
      return {
        value: asum ? Math.round(wsum / asum * 10) / 10 : 0,
        sampleCount: plots.length,
        totalArea: Math.round(asum * 10) / 10,
        updatedAt: updatedAt || model.updatedAt || '',
        method: 'area-weighted'
      };
    },

    /**
     * 四维健康评分（P1-01）：长势 / 水分 / 养分 / 病虫
     * 每项均可追溯到模型或原始检测数据；无数据的维度返回 available=false（前端显示“未检测”）
     * 权重版本 v1：长势 30% / 水分 20% / 养分 20% / 病虫 30%
     * @param {{soilMoist?:number}} [opts] 土壤含水率原始读数（来自 DeviceStore）
     */
    healthDimensions: function(opts){
      var o = opts || {};
      var g = ensure().growth;
      var p = ensure().pest;
      var plots = (p.lists && p.lists.plots) || [];
      var soil = (typeof global.SoilStore !== 'undefined' && global.SoilStore) ? global.SoilStore.summary() : null;

      var growth = g && g.dashboard && typeof g.dashboard.vigorIndex === 'number'
        ? g.dashboard.vigorIndex : null;

      var water = (typeof o.soilMoist === 'number' && isFinite(o.soilMoist))
        ? Math.max(0, Math.min(100, Math.round(o.soilMoist / 60 * 100))) : null;

      function cap(v, max){ return Math.max(0, Math.min(1, v / max)); }
      var nutrient = null;
      if (soil && soil.sampleCount > 0) {
        nutrient = Math.round(100 * (
          0.4 * cap(Number(soil.organicMatter) || 0, 2.5) +
          0.2 * cap(Number(soil.availableN) || 0, 80) +
          0.2 * cap(Number(soil.availableP) || 0, 30) +
          0.2 * cap(Number(soil.availableK) || 0, 200)
        ));
      }

      var pest = null;
      if (plots.length) {
        var wsum = 0, asum = 0;
        plots.forEach(function(x){
          var a = Number(x.area) || 0;
          var r = Number(x.riskIndex);
          if (!a || isNaN(r)) return;
          wsum += r * a; asum += a;
        });
        if (asum) pest = Math.max(0, Math.min(100, Math.round(100 - wsum / asum)));
      }

      function item(key, name, value, source){
        return { key: key, name: name, value: value, source: source, available: value !== null };
      }
      return {
        version: 'v1',
        weights: { growth: 0.3, water: 0.2, nutrient: 0.2, pest: 0.3 },
        items: [
          item('growth', '长势', growth, '生长模型 · 长势指数'),
          item('water', '水分', water, '土壤墒情仪 · 含水率/60%'),
          item('nutrient', '养分', nutrient, '土壤检测报告 · 有机质与速效氮磷钾'),
          item('pest', '病虫', pest, '病虫害模型 · 100−面积加权风险指数')
        ]
      };
    },

    all: function(){ return deepClone(ensure()); },

    get: function(key){
      if (!isKey(key)) return null;
      return deepClone(ensure()[key]);
    },

    patch: function(key, partial){
      if (!isKey(key) || !partial || typeof partial !== 'object') return null;
      var d = ensure();
      d[key] = Object.assign({}, d[key], partial);
      broadcast('patch:' + key);
      return deepClone(d[key]);
    },

    replace: function(key, obj){
      if (!isKey(key) || !obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
      var d = ensure();
      d[key] = Object.assign({ key: key, name: d[key].name }, obj);
      broadcast('replace:' + key);
      return deepClone(d[key]);
    },

    /**
     * 点号路径取值：'yield.kpi.0.value' → '450'
     * 为保持模型结构统一，顶层未命中时会依次到 lists / charts 下再找一次，
     * 因此 'price.saleWindow.title' 与 'price.lists.saleWindow.title' 等效。
     */
    field: function(path){
      if (!path || typeof path !== 'string') return undefined;
      var parts = path.split('.');
      var key = parts[0];
      if (!isKey(key)) return undefined;
      var model = ensure()[key];
      var rest = parts.slice(1);

      function walk(node, segs){
        var cur = node;
        for (var i = 0; i < segs.length; i++) {
          if (cur === null || cur === undefined) return undefined;
          cur = cur[segs[i]];
        }
        return cur;
      }

      var found = walk(model, rest);
      if (found !== undefined) return found;
      var inLists = walk(model.lists || {}, rest);
      if (inLists !== undefined) return inLists;
      var inCharts = walk(model.charts || {}, rest);
      if (inCharts !== undefined) return inCharts;
      return undefined;
    },

    subscribe: function(fn){
      subscribers.push(fn);
      try { fn('init'); } catch(e){}
      return function unsubscribe(){
        subscribers = subscribers.filter(function(x){ return x !== fn; });
      };
    },

    reset: function(){
      inMemory = defaults();
      save();
      broadcast('reset');
    },

    _syncFromExternal: function(){
      inMemory = null;
      ensure();
      notify('sync');
    },

    /**
     * 视图辅助：把模型 KPI 渲染到页面顶部指标带
     * @param {string} selector 指标带容器选择器，如 '.patrol-stats'
     * @param {string} key 模型键名
     * 只覆盖 stat-value / stat-label / stat-trend 的文本，不动卡片结构与内联样式
     */
    hydrateKpi: function(selector, key){
      var model = ModelStore.get(key);
      if (!model) return;
      var root = document.querySelector(selector);
      if (!root) return;
      var cards = root.querySelectorAll('.patrol-stat-card');
      model.kpi.forEach(function(item, i){
        var card = cards[i];
        if (!card) return;
        var value = card.querySelector('.stat-value');
        var label = card.querySelector('.stat-label');
        var trend = card.querySelector('.stat-trend');
        if (value) {
          value.innerHTML = String(item.value) +
            (item.unit ? '<small style="font-size:16px;font-weight:400;">' + item.unit + '</small>' : '');
        }
        if (label) label.textContent = item.label;
        if (trend && item.trend && item.trend.text) {
          trend.textContent = item.trend.text;
          if (item.trend.color) trend.style.color = item.trend.color;
        }
      });
    }
  };

  window.addEventListener('storage', function(e){
    if (e.key === STORAGE_KEY) ModelStore._syncFromExternal();
  });

  global.ModelStore = ModelStore;
})(window);
