/**
 * typography.js —— 全站统一字体排版的运行时辅助
 * 与 css/typography.css 配套：该文件负责静态样式，本文件负责
 *   1) 向 JS 暴露排版令牌（动态渲染的表格 / 弹窗 / 图表可直接引用）
 *   2) 图标尺寸与相邻正文对齐（demo 规范：图标跟随文本字号）
 *   3) 数字列启用等宽对齐
 * 依赖：无。可在任何页面独立引入。
 */
(function (window, document) {
  'use strict';

  /** 从 CSS 变量读取（带兜底，保证未加载 typography.css 时也不报错） */
  function token(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    v = (v || '').trim();
    return v || fallback;
  }

  var Typography = {
    /** 排版令牌（与 css/typography.css :root 一一对应） */
    tokens: function () {
      return {
        fontFamily: token('--u-font-sans', "'Inter', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif"),
        monoFamily: token('--u-font-mono', "Menlo, Consolas, monospace"),
        fs2xs: token('--u-fs-2xs', '12px'),
        fsXs: token('--u-fs-xs', '13px'),
        fsSm: token('--u-fs-sm', '14px'),
        fsMd: token('--u-fs-md', '16px'),
        fsLg: token('--u-fs-lg', '18px'),
        fsXl: token('--u-fs-xl', '20px'),
        fs2xl: token('--u-fs-2xl', '24px'),
        cText: token('--u-c-text', '#262626'),
        cText2: token('--u-c-text-2', '#595959'),
        cText3: token('--u-c-text-3', '#8c8c8c'),
        cPrimary: token('--u-c-primary', '#1890ff')
      };
    },

    /** 图表文字样式（ECharts 可直接使用，与 js/components/chart.js 一致） */
    chart: function () {
      var t = this.tokens();
      return {
        fontFamily: t.fontFamily,
        axis: { fontSize: 12, color: '#8c8c8c' },
        legend: { fontSize: 12, color: '#595959' },
        tooltip: { fontSize: 13, color: '#262626' },
        label: { fontSize: 12, color: '#262626' }
      };
    },

    /**
     * 图标与相邻正文对齐：
     * demo 中图标跟随文字（text-sm 正文配 16px 图标，text-xs 配 14px）
     * 规则：图标尺寸 = 相邻文本字号 + 2px，取值收敛到 14/16/18/20 四档
     */
    alignIcons: function (root) {
      var scope = root || document;
      var nodes = scope.querySelectorAll(
        '.iconify, [data-uicon], svg.u-icon, .icon'
      );
      var sizes = [14, 16, 18, 20];
      Array.prototype.forEach.call(nodes, function (el) {
        if (el.dataset && el.dataset.typoIconFixed === '1') return;
        var ref = el.parentElement;
        if (!ref) return;
        var fs = parseFloat(getComputedStyle(ref).fontSize) || 14;
        var want = fs + 2;
        var pick = sizes[0];
        for (var i = 0; i < sizes.length; i++) {
          if (sizes[i] <= want) pick = sizes[i];
        }
        el.style.width = pick + 'px';
        el.style.height = pick + 'px';
        el.style.fontSize = pick + 'px';
        el.style.flexShrink = '0';
        el.style.verticalAlign = 'middle';
        if (el.dataset) el.dataset.typoIconFixed = '1';
      });
      return nodes.length;
    },

    /** 数字列等宽对齐，避免金额/编号在翻页时左右跳动 */
    tabularNums: function (root) {
      var scope = root || document;
      var nodes = scope.querySelectorAll(
        '.stat-value, .metric-value, .num, .amount, .money, .percent, .code, .data-table td'
      );
      Array.prototype.forEach.call(nodes, function (el) {
        el.style.fontVariantNumeric = 'tabular-nums';
      });
      return nodes.length;
    },

    /** 对动态插入的内容（表格重绘 / 弹窗）重新应用排版 */
    refresh: function (root) {
      var a = this.alignIcons(root);
      var b = this.tabularNums(root);
      return { icons: a, nums: b };
    }
  };

  window.Typography = Typography;

  // 首次加载后自动应用一次
  function boot() {
    try {
      Typography.refresh(document);
      document.dispatchEvent(new CustomEvent('typography:ready'));
    } catch (e) {
      /* 静默失败，不影响页面主逻辑 */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // 表格 / 分页重绘后补一次（节流，避免高频抖动）
  var timer = null;
  document.addEventListener('click', function () {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      try { Typography.refresh(document); } catch (e) {}
    }, 120);
  }, true);
})(window, document);
