/* ============================================================
 * 生产指挥驾驶舱 Mock 数据（沿用现有 da_dashboard.html 字段）
 * 与 mock-overview / mock-alert / mock-iot 共用 PLOTS 坐标
 * ============================================================ */

window.DashboardMock = window.DashboardMock || {};

window.DashboardMock.dashboard = {
  /* 顶部事实 */
  facts: {
    bases: 8,
    plots: 126,
    area: 2450,
    output: 2512,        // 万
    traceRate: 78.3,     // %
  },

  /* 北极星 6 项 */
  northStar: {
    health: { score: 86, label: '综合健康指数 · 多因子加权' },
    phase:  { name: '膨大期/着色期', since: '06-15', harvest: '10-15' },
    dims: [
      { k: '长势', v: 90 }, { k: '水分', v: 72 },
      { k: '养分', v: 84 }, { k: '病虫', v: 74 },
    ],
    kpis: [
      { k: '待处理告警', v: 8,  level: 'risk' },
      { k: '农事达成率', v: 75, unit: '%' },
      { k: '设备在线率', v: 93, unit: '%' },
      { k: '农资保障率', v: 79, unit: '%', level: 'warn' },
    ],
  },

  /* 环境实况 */
  env: [
    { k: '气温',       v: 18.5,  unit: '℃',  trend: '↑ +1.2' },
    { k: '空气湿度',   v: 62,    unit: '%',  trend: '适宜' },
    { k: '光照',       v: 3.2,   unit: '万lx', trend: '↑ +8%' },
    { k: '土壤墒情',   v: 58,    unit: '%',  trend: '偏低', warn: true },
  ],

  /* 农事执行 */
  farming: {
    total: 128, done: 96, doing: 22, overdue: 3,
    list: [
      { plot: '东2', name: '滴灌作业', person: '张建国', desc: '水肥一体', eta: '4h' },
      { plot: '北1', name: '疏果定果', person: '李红',   desc: '树体管理', eta: '6h' },
      { plot: '西3', name: '防病喷药', person: '王强',   desc: '病虫防治', eta: '逾期1h', urg: true },
    ],
  },

  /* 地块（含 GIS 多边形坐标，900×720 视图框） */
  plots: [
    { id:'A1', pts:[[258,58],[448,46],[452,182],[300,190],[256,172]], name:'1号东', variety:'富士',     area:9.2, status:'h', yieldL:'高', pest:'h', health:92, manager:'张建国', task:'滴灌巡检' },
    { id:'A2', pts:[[462,44],[652,52],[656,184],[466,188]],          name:'2号东', variety:'王林',     area:8.6, status:'h', yieldL:'高', pest:'h', health:90, manager:'张建国', task:'常规管护' },
    { id:'A3', pts:[[666,50],[702,44],[794,184],[700,190],[662,180]],name:'3号东', variety:'花牛苹果', area:7.8, status:'w', yieldL:'中', pest:'w', health:74, manager:'李红',   task:'喷药防护' },
    { id:'A4', pts:[[714,46],[888,52],[894,186],[800,182],[708,120]],name:'4号东', variety:'红星',     area:8.1, status:'h', yieldL:'高', pest:'h', health:91, manager:'李红',   task:'常规管护' },
    { id:'B1', pts:[[254,206],[446,200],[450,376],[300,384],[254,360]],name:'1号北', variety:'富士',     area:9.0, status:'h', yieldL:'高', pest:'h', health:93, manager:'王强',   task:'疏果定果' },
    { id:'B2', pts:[[460,198],[648,204],[652,380],[464,382]],        name:'2号北', variety:'王林',     area:8.4, status:'r', yieldL:'低', pest:'w', health:61, manager:'王强',   task:'滴灌+补工' },
    { id:'B3', pts:[[660,204],[772,200],[776,378],[664,380]],        name:'3号北', variety:'花牛苹果', area:8.0, status:'h', yieldL:'中', pest:'h', health:89, manager:'赵敏',   task:'生物防治' },
    { id:'B4', pts:[[788,210],[892,206],[896,378],[790,374]],        name:'4号北', variety:'红星',     area:7.9, status:'w', yieldL:'中', pest:'w', health:77, manager:'赵敏',   task:'蚜虫防治' },
    { id:'C1', pts:[[256,398],[448,392],[452,552],[270,560],[256,530]],name:'1号西', variety:'富士',   area:8.7, status:'h', yieldL:'高', pest:'h', health:90, manager:'孙磊',   task:'常规管护' },
    { id:'C2', pts:[[462,392],[650,396],[654,556],[466,558]],        name:'2号西', variety:'王林',     area:8.2, status:'h', yieldL:'中', pest:'h', health:88, manager:'孙磊',   task:'常规管护' },
    { id:'C3', pts:[[664,396],[888,390],[892,556],[672,560]],        name:'3号西', variety:'花牛苹果', area:7.6, status:'r', yieldL:'低', pest:'r', health:58, manager:'周涛',   task:'设备抢修' },
    { id:'D1', pts:[[258,578],[632,566],[640,684],[300,692],[262,640]],name:'1号南', variety:'富士',   area:8.3, status:'h', yieldL:'高', pest:'h', health:91, manager:'周涛',   task:'常规管护' },
  ],

  /* 设备 */
  devices: [
    { type:'感知设备', total: '—',    onlineRate: 92, note: '土壤 / 气象' },
    { type:'气象站',   total:'8/8 在线', onlineRate: 100 },
    { type:'水肥一体机', total:'西3 离线 · 数据中断', onlineRate: 88, stale: true },
    { type:'植保无人机', total:'2 架飞行中', onlineRate: 100, raw: '2/2' },
    { type:'监控摄像头', total:'北4 离线',     onlineRate: 95 },
    { type:'杀虫灯',     total:'54 / 60 在线', onlineRate: 90 },
  ],

  /* 气象趋势（近 7 日） */
  weather7: {
    todayTemp: 18.5,
    tomorrowNote: '明日小雨 · 降水概率 70% · 降温 6℃',
    factors: [
      { k: '降水 mm', v: 12.4 }, { k: '相对湿度', v: 62, unit: '%' },
      { k: '日照 h',  v: 6.8 },  { k: '风速 m/s', v: 1.2 },
    ],
  },

  /* 土壤养分 */
  soil: [
    { k: 'pH',          v: 6.8 },
    { k: 'EC mS/cm',    v: 1.2 },
    { k: '有机质',      v: '2.4%' },
    { k: '速效氮 mg/kg', v: 62 },
    { k: '速效磷 mg/kg', v: 28 },
    { k: '速效钾 mg/kg', v: 186 },
    { k: '土温 ℃',      v: 16.8 },
    { k: '土壤含水率',  v: '58%', low: true },
  ],

  /* 农资库存 */
  agriInventory: [
    { k: '化肥',     sub: '复合肥', days: 9,  pct: 68 },
    { k: '农药',     sub: '杀菌/杀虫', days: 4,  pct: 41, warn: true },
    { k: '农膜',     sub: '地布/棚膜', days: 20, pct: 85 },
    { k: '套袋',     sub: '幼果套袋',   days: 2,  pct: 23, crit: true },
  ],
};
