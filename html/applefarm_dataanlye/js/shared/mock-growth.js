/* ============================================================
 * 物候生长大屏 Mock 数据
 * 覆盖：物候日历、生长曲线（果实横径）、产量预估 vs 实采、
 *       病虫害风险热力、积温趋势
 * ============================================================ */

window.DashboardMock = window.DashboardMock || {};

window.DashboardMock.growth = {
  /* 北极星 */
  northStar: [
    { k: '当前物候期',       v: '膨大期/着色期', big: true, sub: '自 06-15 始 · 预计采收 10-15' },
    { k: '距采收',           v: 28, unit: '天'   },
    { k: '平均果实横径',     v: 76.2, unit: 'mm'  },
    { k: '长势指数',         v: 90, unit: '/100' },
    { k: '生育期积温',       v: 3120, unit: '℃·d' },
    { k: '成熟度预测吻合率', v: 94, unit: '%'    },
  ],

  /* 年物候日历（近 12 月，每月 1 行） */
  calendar: [
    { m: 3, label: '萌芽期',   start: '03-22', end: '04-05' },
    { m: 4, label: '花期',     start: '04-18', end: '05-02' },
    { m: 5, label: '坐果期',   start: '05-08', end: '05-22' },
    { m: 6, label: '幼果期',   start: '06-01', end: '06-25' },
    { m: 7, label: '膨大期',   start: '06-26', end: '09-10' },
    { m: 9, label: '着色期',   start: '09-05', end: '10-12' },
    { m: 10,label: '成熟期',   start: '10-12', end: '10-25' },
  ],

  /* 各地块生长曲线（果实横径 mm，12 周） */
  /* W1..W12 */
  curves: [
    { id: 'A1', name: '1号东', data: [22, 28, 34, 42, 50, 58, 64, 70, 74, 78, 81, 84] },
    { id: 'B1', name: '1号北', data: [24, 30, 36, 44, 52, 60, 66, 72, 76, 80, 83, 86] },
    { id: 'C1', name: '1号西', data: [20, 26, 32, 40, 48, 56, 62, 68, 72, 76, 79, 82] },
    { id: 'B2', name: '2号北', data: [22, 28, 34, 40, 46, 52, 58, 62, 66, 69, 71, 73] },
    { id: 'D1', name: '1号南', data: [23, 29, 35, 43, 51, 59, 65, 71, 75, 79, 82, 85] },
  ],

  /* 产量预估 vs 实采（按基地，单位 吨） */
  yieldCompare: [
    { base: '麦积', pred: 1260, act: 1248 },
    { base: '秦州', pred:  920, act:  942 },
    { base: '秦安', pred:  680, act:  652 },
    { base: '甘谷', pred:  500, act:  498 },
    { base: '武山', pred:  210, act:  220 },
  ],

  /* 物候期进度 */
  phase: {
    name: '膨大期/着色期',
    pct: 68,
    milestones: [
      { k: '着色完成日',   days: 12 },
      { k: '采收窗口',     days: 28 },
      { k: '套袋结束',     days: -2, expired: true },
    ],
  },

  /* 病虫害风险地图（与 mock-dashboard PLOTS 对齐） */
  pestRisk: [
    { id:'A1', risk:'l', note:'锈病 · 蚜虫' },
    { id:'A2', risk:'l', note:'蚜虫' },
    { id:'A3', risk:'h', note:'轮纹病' },
    { id:'A4', risk:'m', note:'蚜虫' },
    { id:'B1', risk:'h', note:'锈病' },
    { id:'B2', risk:'m', note:'根腐' },
    { id:'B3', risk:'l', note:'健康' },
    { id:'B4', risk:'m', note:'红蜘蛛' },
    { id:'C1', risk:'l', note:'健康' },
    { id:'C2', risk:'m', note:'轮纹病' },
    { id:'C3', risk:'h', note:'设备故障 + 锈病' },
    { id:'D1', risk:'l', note:'健康' },
  ],

  /* 近 12 周积温趋势 */
  gdd12: [180, 220, 280, 340, 420, 500, 600, 720, 840, 1000, 1180, 1300],

  /* 关键生长指标表 */
  growthKpi: {
    fruitWeight: 218,
    solubleSolid: 14.6,
    colorRatio: 72,
    spad: 52,
  },

  /* 模型建议 */
  advice: '未来 7 天昼夜温差 10-12℃，利于着色；继续控水；北 1 锈病风险上升，建议预防性喷药',
};
