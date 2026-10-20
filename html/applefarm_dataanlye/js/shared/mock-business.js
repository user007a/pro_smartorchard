/* ============================================================
 * 经营分析大屏 Mock 数据
 * 覆盖：营收 12 月、北极星 KPI、收入构成、成本结构、
 *       各基地利润、销售渠道、Top10 排行
 * ============================================================ */

window.DashboardMock = window.DashboardMock || {};

window.DashboardMock.business = {
  year: 2025,

  /* 顶部事实 */
  facts: {
    revenue: 2656,     // 万
    profit:  428,
    adoption: 3260,
    repurchase: '62%',
  },

  /* 北极星 */
  northStar: [
    { k: '年度营收完成率', v: 108, unit: '%', target: '目标 2460 万', trend: '+8.2',  up: true,  big: true },
    { k: '净利润',         v: 428, unit: '万', trend: '+7.5%',        up: true  },
    { k: '净利率',         v: 18.5, unit: '%', trend: '+0.6 pt 同比', up: true  },
    { k: '客单价',         v: 328, currency: '￥', trend: '-2.1%',     up: false },
    { k: '复购率',         v: 62, unit: '%', trend: '+4.3 pt 同比',  up: true  },
    { k: '认养订单',       v: 3260, unit: '单', trend: '+21.4% 同比', up: true  },
  ],

  /* 营收趋势（近 12 月） */
  revenue12: [186, 178, 196, 215, 234, 256, 268, 292, 318, 372, 512, 486],

  /* 收入构成（合计 = 2656 万） */
  revenueMix: [
    { k: '鲜果销售', pct: 46, value: 1221.8, c: '#2E8FE8' },
    { k: '认养收入', pct: 26, value:  690.6, c: '#38D6FF' },
    { k: '农资服务', pct: 16, value:  425.0, c: '#31C9E8' },
    { k: '冷链代储', pct: 12, value:  318.6, c: '#F2B33D' },
  ],

  /* 成本结构 */
  costMix: [
    { k: '农资', pct: 32 }, { k: '人工', pct: 28 },
    { k: '物流', pct: 16 }, { k: '包装', pct: 12 }, { k: '其他', pct: 12 },
  ],

  /* 各基地利润（万） */
  baseProfit: [
    { k: '麦积', v: 124.6 }, { k: '秦州', v: 100.0 },
    { k: '秦安', v:  78.4 }, { k: '甘谷', v:  62.0 },
    { k: '张川', v:  35.8 }, { k: '清水', v:  18.2 },
    { k: '陇西', v:   6.8 }, { k: '武山', v:   2.2 },
  ],

  /* 销售渠道 */
  channels: [
    { k: '线上商城', pct: 32 }, { k: '团购', pct: 24 },
    { k: '认养',   pct: 26 }, { k: '商超', pct: 10 },
    { k: '批发',   pct:  8 },
  ],

  /* 认养指标 */
  adoption: {
    order: 3260,
    revenue: 690.6,
    renewalRate: 78,
    avgPrice: 268,
  },

  /* Top10 排行（客户 / 渠道合并显示） */
  top10: [
    { rank:  1, name: '陕西天禾农业',     tag: '团体认养 · 战略客户',     amt: 132.4, hit: true  },
    { rank:  2, name: '天水邮政电商',     tag: '团购分销 · 长期合作',     amt: 108.6, hit: true  },
    { rank:  3, name: '麦积高端会员 TOP',  tag: '个人认养 · 高净值',       amt:  92.0 },
    { rank:  4, name: '京东自营',          tag: '鲜果分销 · 头部渠道',     amt:  78.5 },
    { rank:  5, name: '甘肃农垦集团',     tag: 'G2B 集采',                 amt:  64.8 },
    { rank:  6, name: '本来生活网',       tag: '鲜果分销 · 重点渠道',     amt:  56.3 },
    { rank:  7, name: '天水建行集团采购',  tag: '员工福利',                 amt:  44.0 },
    { rank:  8, name: '拼多多店铺',       tag: '分销批发',                 amt:  36.5 },
    { rank:  9, name: '盒马鲜生',         tag: '直供合作',                 amt:  31.2 },
    { rank: 10, name: '认养个人会员 TOP',  tag: '果树认养 · 高净值会员',   amt:  24.0 },
  ],

  /* 经营指标（底部） */
  kpiTable: {
    grossMargin: 42,
    receivableDays: 38,
    inventoryTurns: 12,
    yuanPerMu: 1.02,
  },

  /* 近 5 年营收 / 净利 */
  revenue5Years: [
    { y: 2022, rev: 1580, profit: 215 },
    { y: 2023, rev: 1795, profit: 268 },
    { y: 2024, rev: 2040, profit: 326 },
    { y: 2025, rev: 2231, profit: 388 },
    { y: 2026, rev: 2512, profit: 428 },
  ],

  /* 风险提示 */
  riskNotes: [
    { level: 'warn', text: 'Q4 冷链代储成本上升 8%，建议提前锁定运力' },
    { level: 'info', text: '认养业务续费率 78%，建议加大老客权益投放'   },
  ],
};
