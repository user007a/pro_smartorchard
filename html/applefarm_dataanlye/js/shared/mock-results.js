/* ============================================================
 * 数字成果大屏 Mock 数据
 * 覆盖：数据归集、人员效率、设备归集、提质增效、模型运转、里程碑
 * ============================================================ */

window.DashboardMock = window.DashboardMock || {};

window.DashboardMock.results = {
  /* 北极星（硕果） */
  northStar: [
    { k: '累计归集数据量', v: '2.86 亿', unit: '条', big: true },
    { k: '设备接入',       v:  186, unit: '台' },
    { k: 'AI 模型调用',    v: '128.4 万', unit: '次' },
    { k: '数字化覆盖地块', v:  126 },
    { k: '数据质量合格率', v:   99.2, unit: '%' },
    { k: '系统稳定运行',   v:  386, unit: '天' },
  ],

  /* 数据归集（5 类，含同比增长 / 合格率） */
  collection: [
    { type: '农事记录', qty: 92.6, yoy:  +18.2, qual: 99.4 },
    { type: '设备数据', qty: 128.0, yoy: +24.6, qual: 99.7 },
    { type: '销售数据', qty:  6.4, yoy:  +12.0, qual: 99.1 },
    { type: '溯源数据', qty: 38.2, yoy:  +86.4, qual: 99.9 },
    { type: '环境数据', qty: 21.0, yoy:  +15.8, qual: 99.6 },
  ],

  /* 近 12 月数据增长 */
  collectionTrend: [120, 138, 162, 184, 210, 232, 248, 260, 258, 274, 280, 286],

  /* 模型运转 */
  models: [
    { name: '产量预测', calls: '38.2 万', hit: 92.4, resp: 0.62, ver: 'v2.4' },
    { name: '价格预测', calls: '26.6 万', hit: 88.0, resp: 0.58, ver: 'v2.1' },
    { name: '物候预测', calls: '18.4 万', hit: 94.0, resp: 0.48, ver: 'v1.8' },
    { name: '病虫害识别', calls: '32.0 万', hit: 91.2, resp: 0.74, ver: 'v3.0' },
    { name: '气象预测', calls: '13.2 万', hit: 89.6, resp: 0.42, ver: 'v2.0' },
  ],

  /* 模型版本分布 */
  modelVersions: [
    { v: 'v3.0', pct: 28 }, { v: 'v2.x', pct: 46 },
    { v: 'v1.x', pct: 20 }, { v: '实验版', pct:  6 },
  ],

  /* 模型调用每日分布（近 14 日） */
  modelDaily: [8200, 9100, 9600, 10200, 10800, 11200, 10900, 11400, 12100, 12600, 13200, 12860, 13100, 13620],

  /* 人员效率 */
  peopleEfficiency: {
    avgRecordPer: 486,
    taskRate: 94,
    expertRespMin: 12,
    rank: [
      { role: '作业', v: 96 }, { role: '技术', v: 92 },
      { role: '管理', v: 88 }, { role: '销售', v: 84 },
    ],
  },

  /* 设备归集 */
  deviceCollection: {
    types: [
      { k: '土壤传感器', v: 32 }, { k: '杀虫灯', v: 60 },
      { k: '气象站',     v:  8 }, { k: '监控',   v: 10 },
      { k: '水肥一体机', v:  6 }, { k: '无人机', v:  2 },
      { k: '虫情灯',     v:  6 },
    ],
    utilization: 87,
    avgMaintRespHr: 6.2,
  },

  /* 提质增效 */
  benefits: {
    water:  { before: 26800, after: 18248, delta: -32, label: '节水' },
    fert:   { before: 130,   after:  96,   delta: -26, label: '节肥' },
    pest:   { before: 4.8,   after:  2.98, delta: -38, label: '减药' },
    yield:  { before: 2790,  after: 3260,  delta: +15, label: '增产' },
    loss:   { before: 6.4,   after:  5.05, delta: -21, label: '减损' },
  },

  /* 里程碑 */
  milestones: [
    { date: '2026-09', text: '数据大屏矩阵升级（8 屏互通）' },
    { date: '2026-08', text: '溯源上链突破 10 万批次' },
    { date: '2026-06', text: 'AI 病虫害识别 v3.0 上线' },
    { date: '2026-03', text: '认养业务全面数字化' },
    { date: '2025-12', text: '通过数字农业验收' },
  ],

  /* 综合文案 */
  summary: '通过数字化管理，全年节水 8600 吨、节肥 42 吨、减药 1.8 吨，综合成本下降 12%，优质果率提升至 86%',
};
