/* ============================================================
 * 数农智果 · 数据大屏端共享 Mock 数据聚合入口
 * ----------------------------------------------------------
 * 该文件作为中央聚合层，对外暴露 window.DashboardMock。
 * 已经按照 9 个大屏拆分成 9 份 mock 文件，逐一注入后整体
 * 挂载到 window.DashboardMock。<dashboard>.get() /
 * window.DashboardMock.<dashboard>.<...> 即可访问。
 *
 * 在每个大屏 HTML 中，按需引用本文件与对应 mock 文件即可：
 *   <script src="js/shared/mock-<name>.js"></script>
 *   <script src="js/shared/dashboards-mock.js"></script>
 *
 * 数据一致性约束：
 *   · 地块总数 126 = 8 基地 plots 之和
 *   · 员工总数 286 = 管理/技术/作业/销售之和
 *   · 品种产量构成比例之和 = 100
 *   · PLOTS 坐标在 dashboard / alert / iot / growth 中复用
 * ============================================================ */

(function () {
  if (!window.DashboardMock) window.DashboardMock = {};
  if (typeof window.__dashboardsMockReady === 'function') {
    window.__dashboardsMockReady(window.DashboardMock);
  }
  // 标记完成，便于一次性绑定渲染
  window.__dashboardsMockVersion = '1.0.0';
  // console.info('[dashboards-mock] ready', Object.keys(window.DashboardMock));
})();
