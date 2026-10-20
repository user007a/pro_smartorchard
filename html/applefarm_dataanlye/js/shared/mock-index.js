/* ============================================================
 * 大屏门户 Mock 数据
 * 覆盖：8 主题入口矩阵、徽标数据
 * ============================================================ */

window.DashboardMock = window.DashboardMock || {};

window.DashboardMock.index = {
  brand: {
    name: '数农智果',
    sub:  'Apple Orchard Dashboard Center',
  },
  facts: {
    bases: 8,
    plots: 126,
    area: 2450,        // 亩
    group: '北大荒绿色集团',
  },
  cards: [
    { id:'overview',  href:'da_overview.html',  icon:'compass',  color:'#22A84A', en:'Orchard Overview',     cn:'果园管理驾驶舱',  desc:'对外参观 / 形象展示' },
    { id:'dashboard', href:'da_dashboard.html', icon:'radar',    color:'#2E8FE8', en:'Production Command', cn:'生产指挥驾驶舱',  desc:'实时生产 / 调度'   },
    { id:'business',  href:'da_business.html',  icon:'chart',     color:'#F2B33D', en:'Business Analytics', cn:'经营分析大屏',    desc:'营收 / 利润 / 成本' },
    { id:'trace',     href:'da_trace.html',     icon:'shield',    color:'#8B5CF6', en:'Traceability',       cn:'质量溯源大屏',    desc:'上链 / 扫码流向'   },
    { id:'alert',     href:'da_alert.html',     icon:'bell',      color:'#E5564B', en:'Intelligent Alerts', cn:'智能预警大屏',    desc:'设备 / 农事 / 灾害' },
    { id:'growth',    href:'da_growth.html',    icon:'leaf',      color:'#31C9E8', en:'Phenology & Growth', cn:'物候生长大屏',    desc:'物候期 / 生长曲线' },
    { id:'iot',       href:'da_iot.html',       icon:'chip',      color:'#14549F', en:'IoT Devices',        cn:'设备物联大屏',    desc:'设备台账 / IoT'   },
    { id:'results',   href:'da_results.html',   icon:'trophy',    color:'#38D6FF', en:'Digital Achievements', cn:'数字成果大屏',  desc:'数据归集 / 提质增效' },
  ],
};
