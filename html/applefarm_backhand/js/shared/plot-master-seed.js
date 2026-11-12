/**
 * 地块主数据 · 严格空库模式（播种器已停用）
 * --------------------------------------------------------------
 * 原文件是「生产指挥大屏」在尚未打开后台地块管理时的兜底播种器，
 * 会向 localStorage 写入 23 条演示地块，与「页面显示必须严格等于数据库」
 * 的目标冲突，因此整份种子数据已清空。
 *
 * 保留 global.PLOT_MASTER_SEED 这个空数组，只是为了兼容仍引用该脚本的
 * 旧页面（html/applefarm_dataanlye/da_dashboard.html 等），避免脚本报错；
 * 任何页面都不应再依据本文件播种地块数据。
 *
 * 地块数据一律通过 /api/enterprise/aggregate 或通用 CRUD 的 plot 资源读取，
 * 空库时列表为空，由业务操作产生数据。
 */
(function (global) {
  'use strict';
  global.PLOT_MASTER_SEED = [];
})(typeof window !== 'undefined' ? window : this);
