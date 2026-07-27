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

  // 默认配色方案
  const COLORS = [
    '#22a84a', // primary green
    '#1890ff', // info blue
    '#ff6b35', // accent orange
    '#722ed1', // purple
    '#13c2c2', // cyan
    '#faad14', // warning yellow
    '#ff4d4f', // error red
    '#52c41a'  // success green
  ];

  // 默认主题配置
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
      textStyle: {
        color: '#595959',
        fontSize: 13
      }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e8e8e8',
      borderWidth: 1,
      textStyle: {
        color: '#1f1f1f',
        fontSize: 13
      },
      axisPointer: {
        type: 'shadow',
        shadowStyle: {
          color: 'rgba(34, 168, 74, 0.05)'
        }
      }
    },
    textStyle: {
      fontFamily: "'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    }
  };

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
        axisLabel: { color: '#595959' },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: '#595959' },
        splitLine: { lineStyle: { color: '#f0f0f0' } }
      },
      series: (data.series || []).map((s, i) => ({
        name: s.name,
        type: 'line',
        data: s.data || [],
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2 },
        itemStyle: { color: s.color || COLORS[i % COLORS.length] },
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
        axisLabel: { color: '#595959' },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: '#595959' },
        splitLine: { lineStyle: { color: '#f0f0f0' } }
      },
      series: (data.series || []).map((s, i) => ({
        name: s.name,
        type: 'bar',
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
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
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
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 3
        },
        label: {
          show: false
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
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
        axisLabel: { color: '#595959' },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: '#595959' },
        splitLine: { lineStyle: { color: '#f0f0f0' } }
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
      splitLine: { show: i === 0 }
    }));

    const defaultOptions = {
      ...BASE_OPTONS,
      xAxis: {
        type: 'category',
        data: data.categories || [],
        axisLine: { lineStyle: { color: '#d9d9d9' } },
        axisLabel: { color: '#595959' },
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
        color: '#22a84a',
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
