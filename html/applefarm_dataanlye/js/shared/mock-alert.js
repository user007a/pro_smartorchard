/* ============================================================
 * 智能预警大屏 Mock 数据
 * 覆盖：四级统计、Top10 列表、升级链路、SLA、来源分布、趋势
 * 与 mock-dashboard 共用 PLOTS
 * ============================================================ */

window.DashboardMock = window.DashboardMock || {};

window.DashboardMock.alert = {
  /* 顶部事实 */
  facts: {
    pending: 20, processing: 11, closed: 15, todayNew: 14,
  },

  /* 四级 + 闭环指标 */
  levelKpis: [
    { k: '紧急', en: 'urgent',    pct: 17,  c: '#E5564B' },
    { k: '重要', en: 'important', pct: 41,  c: '#F2B33D' },
    { k: '提醒', en: 'reminder',  pct: 26,  c: '#FCD34D' },
    { k: '通知', en: 'notice',    pct: 16,  c: '#3E8EF0' },
  ],
  service: { closeRate24h: 92, avgHandleMin: 38 },

  /* 今日预警 Top10 */
  top10: [
    { level:'urgent',   title:'设备离线：水肥一体化设备离线超过 30 分钟', location:'天水麦积 · 地块 A1', time:'09-20 10:30' },
    { level:'urgent',   title:'病虫害预警：红蜘蛛虫害爆发风险',         location:'天水麦积 · 地块 A2', time:'09-20 11:00' },
    { level:'urgent',   title:'设备离线：灌溉控制器离线',                location:'天水麦积 · 地块 A2', time:'09-19 12:00' },
    { level:'urgent',   title:'气象预警：大风预警，检查防风设施',         location:'麦积阁基地 · 风口区域', time:'09-18 10:30' },
    { level:'important',title:'数据异常：土壤湿度传感器数值异常',         location:'天水荣成 · 地块 B3', time:'09-20 09:15' },
    { level:'important',title:'气象预警：暴雨将至，建议做好排水准备',     location:'天水荣成 · 全部地块', time:'09-20 09:30' },
    { level:'important',title:'土壤预警：地块 B3 土壤湿度超标',           location:'麦积阁基地 · 地块 B3', time:'09-20 08:00' },
    { level:'reminder', title:'土壤预警：地块 B4 pH 值偏低',              location:'天水荣成 · 地块 B4', time:'09-17 11:00' },
    { level:'reminder', title:'数据异常：光照传感器数值波动',            location:'天水荣成 · 地块 B2', time:'09-17 15:20' },
    { level:'notice',   title:'设备维护提醒：土壤传感器需要校准',         location:'天水麦积 · 地块 A3', time:'09-18 09:00' },
  ],

  /* 升级链路节点积压 */
  chain: [
    { node: '预警触发',     sla: '5min',  backlog:  4 },
    { node: '值班长确认',   sla: '15min', backlog:  7 },
    { node: '责任人处置',   sla: '2h',    backlog:  9 },
    { node: '复核闭环',     sla: '4h',    backlog:  3 },
    { node: '归档',         sla: '24h',   backlog:  1 },
  ],

  /* 类型分布 */
  typeMix: [
    { k: '设备故障', v: 38 }, { k: '环境异常', v: 22 },
    { k: '病虫害',   v: 18 }, { k: '农事逾期', v: 14 },
    { k: '质量',     v:  8 },
  ],

  /* SLA 完成率 */
  sla: { onTime: 84, overtime: 11, escalated: 5 },

  /* 来源分布 */
  source: [
    { k: '设备类', v: 46 }, { k: '农事类', v: 26 },
    { k: '灾害类', v: 18 }, { k: '质量类', v: 10 },
  ],

  /* 近 7 日趋势（按级别堆叠） */
  trend7: [
    { date:'09-14', urgent:1, important:3, reminder:2, notice:1, total:7 },
    { date:'09-15', urgent:3, important:2, reminder:1, notice:2, total:8 },
    { date:'09-16', urgent:1, important:3, reminder:2, notice:1, total:7 },
    { date:'09-17', urgent:0, important:3, reminder:3, notice:1, total:7 },
    { date:'09-18', urgent:1, important:3, reminder:1, notice:1, total:6 },
    { date:'09-19', urgent:2, important:2, reminder:1, notice:1, total:6 },
    { date:'09-20', urgent:2, important:3, reminder:1, notice:1, total:7 },
  ],

  /* SLA 时效表 */
  slaTime: { avgResp: 8, avgHandle: 38, avgClose: 124, overtimePct: 11 },

  /* 重点提示 */
  highlight: '麦积基地 2 号北 土壤墒情连续 4h 低于阈值，已升级至园区主任',
};
