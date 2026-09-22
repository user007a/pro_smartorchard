/**
 * 图表组件 - Chart Component
 * 基于 ECharts 5.x 的图表封装
 * 使用方式:
 *   Chart.line('#chart-container', data, options);
 *   Chart.bar('#chart-container', data, options);
 *   Chart.pie('#chart-container', data, options);
 */

const Chart = (function() {
  // ECharts 实例缓存
  const instances = new Map();

  // 默认配色方案（分类色板，需保证各色可区分）
  const COLORS = [
    '#1890ff', // primary blue
    '#52c41a', // success green
    '#ff6b35', // accent orange
    '#722ed1', // purple
    '#13c2c2', // cyan
    '#faad14', // warning yellow
    '#ff4d4f', // error red
    '#eb2f96'  // magenta
  ];

  // 默认主题配置
  // 统一字体排版（与 css/typography.css 保持一致；demo 图表沿用 ECharts 12px 基线）
  const FONT_FAMILY = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', " +
    "'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif";
  const FS_AXIS = 12;    // 轴标签 / 图例
  const FS_TIP = 13;     // 悬浮提示
  const FS_LABEL = 12;   // 图形上数据标签
  const C_AXIS = '#8c8c8c';   // 弱化的坐标轴文字
  const C_TEXT = '#595959';   // 图例 / 常规
  const C_STRONG = '#262626'; // 提示主文字

  const BASE_OPTONS = {
    grid: {
      containLabel: true,
      top: 20,
      right: 20,
      bottom: 40,
      left: 50
    },
    legend: {
      bottom: 0,
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 16,
      textStyle: {
        color: C_TEXT,
        fontSize: FS_AXIS,
        fontFamily: FONT_FAMILY,
        lineHeight: 16
      }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.96)',
      borderColor: '#e8e8e8',
      borderWidth: 1,
      padding: [8, 12],
      textStyle: {
        color: C_STRONG,
        fontSize: FS_TIP,
        fontFamily: FONT_FAMILY
      },
      axisPointer: {
        type: 'cross',
        lineStyle: { color: '#1890ff', width: 1, type: 'dashed' },
        crossStyle: { color: '#1890ff', width: 1, type: 'dashed' },
        label: {
          backgroundColor: '#1890ff',
          fontSize: FS_AXIS,
          fontFamily: FONT_FAMILY
        }
      }
    },
    textStyle: {
      fontFamily: FONT_FAMILY,
      fontSize: FS_AXIS,
      color: C_TEXT
    }
  };

  // 坐标轴文字统一（各图表可用 options 覆盖）
  function axisCommon() {
    return {
      axisLine: { lineStyle: { color: '#e8e8e8' } },
      axisTick: { show: false },
      axisLabel: { color: C_AXIS, fontSize: FS_AXIS, fontFamily: FONT_FAMILY },
      nameTextStyle: { color: C_AXIS, fontSize: FS_AXIS, fontFamily: FONT_FAMILY }
    };
  }

  // 加载 ECharts
  function loadECharts() {
    return new Promise((resolve, reject) => {
      if (window.echarts) {
        resolve(window.echarts);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js';
      script.onload = () => resolve(window.echarts);
      script.onerror = () => reject(new Error('ECharts 加载失败'));
      document.head.appendChild(script);
    });
  }

  // 初始化图表实例
  async function initChart(container, options = {}) {
    const echarts = await loadECharts();

    // 获取 DOM 元素
    let dom;
    if (typeof container === 'string') {
      dom = document.querySelector(container);
    } else {
      dom = container;
    }

    if (!dom) {
      console.error('Chart container not found:', container);
      return null;
    }

    // 如果已存在实例，先销毁
    if (instances.has(dom)) {
      instances.get(dom).dispose();
    }

    // 创建实例
    const chart = echarts.init(dom);
    instances.set(dom, chart);

    // 响应式
    const resizeHandler = () => chart.resize();
    window.addEventListener('resize', resizeHandler);
    dom._resizeHandler = resizeHandler;

    return chart;
  }

  // 通用配置合并
  function mergeOptions(defaults, options) {
    return Object.assign({}, defaults, options);
  }

  // 折线图
  async function line(container, data, options = {}) {
    const chart = await initChart(container);
    if (!chart) return null;

    const defaultOptions = {
      ...BASE_OPTONS,
      xAxis: {
        type: 'category',
        data: data.categories || [],
        axisLine: { lineStyle: { color: '#d9d9d9' } },
        ...axisCommon(),
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        ...axisCommon(),
        splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } }
      },
      series: (data.series || []).map((s, i) => {
        const color = s.color || COLORS[i % COLORS.length];
        // 单系列默认开启渐变面积（demo 范式）；多系列避免填充叠加糊成一团，需显式传 area
        const useArea = s.area !== undefined ? s.area : (data.series || []).length === 1;
        return {
          name: s.name,
          type: 'line',
          data: s.data || [],
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          showSymbol: false,
          lineStyle: { width: 2.5, color: color },
          itemStyle: { color: color },
          areaStyle: useArea ? {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: color + '26' },
                { offset: 1, color: color + '00' }
              ]
            }
          } : null
        };
      })
    };

    chart.setOption(mergeOptions(defaultOptions, options), true);
    return chart;
  }

  /** demo 规范渐变：#1890FF → #69c0ff（自上而下） */
  function primaryGradient() {
    if (typeof echarts !== 'undefined' && echarts.graphic && echarts.graphic.LinearGradient) {
      return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: '#1890FF' },
        { offset: 1, color: '#69c0ff' }
      ]);
    }
    return '#1890ff';
  }

  // 柱状图
  async function bar(container, data, options = {}) {
    const chart = await initChart(container);
    if (!chart) return null;

    const defaultOptions = {
      ...BASE_OPTONS,
      xAxis: {
        type: 'category',
        data: data.categories || [],
        axisLine: { lineStyle: { color: '#d9d9d9' } },
        ...axisCommon(),
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        ...axisCommon(),
        splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } }
      },
      series: (data.series || []).map((s, i) => ({
        name: s.name,
        type: 'bar',
        data: s.data || [],
        barWidth: '40%',
        itemStyle: {
          // demo 规范：单系列柱图使用 #1890FF → #69c0ff 竖向渐变
          color: s.color || ((data.series || []).length === 1 ? primaryGradient() : COLORS[i % COLORS.length]),
          borderRadius: s.radius === false ? 0 : [4, 4, 0, 0]
        }
      }))
    };

    chart.setOption(mergeOptions(defaultOptions, options), true);
    return chart;
  }

  // 饼图
  async function pie(container, data, options = {}) {
    const chart = await initChart(container);
    if (!chart) return null;

    const defaultOptions = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        right: 20,
        top: 'center',
        textStyle: { color: '#595959' }
      },
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false
        },
        emphasis: {
          label: {
            show: true,
            fontSize: FS_LABEL,
            fontWeight: '600',
            fontFamily: FONT_FAMILY,
            color: '#262626'
          }
        },
        data: (data.series || []).map((s, i) => ({
          name: s.name,
          value: s.value,
          itemStyle: { color: s.color || COLORS[i % COLORS.length] }
        }))
      }]
    };

    chart.setOption(mergeOptions(defaultOptions, options), true);
    return chart;
  }

  // 环形图
  async function donut(container, data, options = {}) {
    const chart = await initChart(container);
    if (!chart) return null;

    const defaultOptions = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        bottom: 0,
        textStyle: { color: '#595959' }
      },
      series: [{
        type: 'pie',
        radius: ['55%', '80%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false
        },
        emphasis: {
          label: {
            show: true,
            fontSize: FS_LABEL,
            fontWeight: '600',
            fontFamily: FONT_FAMILY,
            color: '#262626'
          }
        },
        data: (data.series || []).map((s, i) => ({
          name: s.name,
          value: s.value,
          itemStyle: { color: s.color || COLORS[i % COLORS.length] }
        }))
      }]
    };

    chart.setOption(mergeOptions(defaultOptions, options), true);
    return chart;
  }

  // 仪表盘
  async function gauge(container, data, options = {}) {
    const chart = await initChart(container);
    if (!chart) return null;

    const defaultOptions = {
      series: [{
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: data.min || 0,
        max: data.max || 100,
        splitNumber: 8,
        radius: '90%',
        center: ['50%', '60%'],
        itemStyle: {
          color: data.color || COLORS[0]
        },
        progress: {
          show: true,
          width: 18
        },
        pointer: {
          show: false
        },
        axisLine: {
          lineStyle: {
            width: 18,
            color: [[1, '#f0f0f0']]
          }
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        title: {
          show: !!data.name,
          offsetCenter: [0, '20%'],
          fontSize: 13,
          color: '#595959'
        },
        detail: {
          valueAnimation: true,
          fontSize: 28,
          fontWeight: 'bold',
          offsetCenter: [0, '-10%'],
          formatter: data.value + (data.unit || ''),
          color: '#1f1f1f'
        },
        data: [{ value: data.value, name: data.name }]
      }]
    };

    chart.setOption(mergeOptions(defaultOptions, options), true);
    return chart;
  }

  // 堆叠柱状图
  async function stackedBar(container, data, options = {}) {
    const chart = await initChart(container);
    if (!chart) return null;

    const defaultOptions = {
      ...BASE_OPTONS,
      xAxis: {
        type: 'category',
        data: data.categories || [],
        axisLine: { lineStyle: { color: '#d9d9d9' } },
        ...axisCommon(),
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        ...axisCommon(),
        splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } }
      },
      series: (data.series || []).map((s, i) => ({
        name: s.name,
        type: 'bar',
        stack: s.stack || 'total',
        data: s.data || [],
        barWidth: '60%',
        itemStyle: {
          color: s.color || COLORS[i % COLORS.length],
          borderRadius: s.radius ? [4, 4, 0, 0] : 0
        }
      }))
    };

    chart.setOption(mergeOptions(defaultOptions, options), true);
    return chart;
  }

  // 多轴图表
  async function multipleAxes(container, data, options = {}) {
    const chart = await initChart(container);
    if (!chart) return null;

    const yAxes = (data.axes || []).map((axis, i) => ({
      type: 'value',
      name: axis.name,
      position: axis.position || (i === 0 ? 'left' : 'right'),
      axisLine: { show: true, lineStyle: { color: axis.color || COLORS[i] } },
      axisLabel: {
        color: '#595959',
        formatter: axis.formatter || '{value}'
      },
      splitLine: { show: i === 0, lineStyle: { color: '#f0f0f0', type: 'dashed' } }
    }));

    const defaultOptions = {
      ...BASE_OPTONS,
      xAxis: {
        type: 'category',
        data: data.categories || [],
        axisLine: { lineStyle: { color: '#d9d9d9' } },
        ...axisCommon(),
        axisTick: { show: false }
      },
      yAxis: yAxes,
      series: (data.series || []).map((s, i) => ({
        name: s.name,
        type: s.type || 'line',
        yAxisIndex: s.yAxisIndex || 0,
        data: s.data || [],
        smooth: true,
        itemStyle: { color: s.color || COLORS[i % COLORS.length] },
        lineStyle: { width: 2 },
        areaStyle: s.area ? {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: (s.color || COLORS[i % COLORS.length]) + '30' },
              { offset: 1, color: (s.color || COLORS[i % COLORS.length]) + '05' }
            ]
          }
        } : null
      }))
    };

    chart.setOption(mergeOptions(defaultOptions, options), true);
    return chart;
  }

  // 销毁图表
  function dispose(container) {
    let dom;
    if (typeof container === 'string') {
      dom = document.querySelector(container);
    } else {
      dom = container;
    }

    if (dom && instances.has(dom)) {
      const chart = instances.get(dom);
      if (dom._resizeHandler) {
        window.removeEventListener('resize', dom._resizeHandler);
      }
      chart.dispose();
      instances.delete(dom);
    }
  }

  // 获取图表实例
  function getInstance(container) {
    let dom;
    if (typeof container === 'string') {
      dom = document.querySelector(container);
    } else {
      dom = container;
    }
    return instances.get(dom);
  }

  // 更新图表数据
  function update(container, data, options = {}) {
    const chart = getInstance(container);
    if (chart && data) {
      if (data.categories) {
        chart.setOption({
          xAxis: { data: data.categories }
        }, { replaceMerge: ['series'] });
      }
      if (data.series) {
        chart.setOption({
          series: data.series
        }, { replaceMerge: ['xAxis'] });
      }
      if (Object.keys(options).length > 0) {
        chart.setOption(options);
      }
    }
  }

  // 显示 loading
  function showLoading(container, text = '加载中...') {
    const chart = getInstance(container);
    if (chart) {
      chart.showLoading({
        text: text,
        color: '#1890ff',
        textColor: '#595959',
        maskColor: 'rgba(255, 255, 255, 0.8)',
        fontSize: 14
      });
    }
  }

  // 隐藏 loading
  function hideLoading(container) {
    const chart = getInstance(container);
    if (chart) {
      chart.hideLoading();
    }
  }

  // 导出图表
  function exportImage(container, filename = 'chart') {
    const chart = getInstance(container);
    if (chart) {
      const url = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
      const link = document.createElement('a');
      link.download = filename + '.png';
      link.href = url;
      link.click();
    }
  }

  return {
    loadECharts,
    initChart,
    line,
    bar,
    pie,
    donut,
    gauge,
    stackedBar,
    multipleAxes,
    dispose,
    getInstance,
    update,
    showLoading,
    hideLoading,
    exportImage,
    COLORS
  };
})();

// 导出
window.Chart = Chart;
