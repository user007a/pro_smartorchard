/**
 * 设备接入共享数据源（Device Store）
 * --------------------------------------------------------------
 * 承载「设备管理」下的设备接入配置、网关与协议配置、视频监控通道，
 * 供后台页面维护，并可通过 localStorage 供移动端与大屏端读取。
 *
 * 存储 key： applefarm_device_v1
 *
 * 暴露 API：
 *   DeviceStore.accessConfigs()        → 设备接入配置列表
 *   DeviceStore.gateways()             → 网关列表
 *   DeviceStore.cameras()              → 视频监控通道列表
 *   DeviceStore.accessSummary()        → 接入配置汇总指标
 *   DeviceStore.gatewaySummary()       → 网关汇总指标
 *   DeviceStore.upsertAccess(item)     → 新增/更新接入配置
 *   DeviceStore.removeAccess(id)       → 删除接入配置
 *   DeviceStore.upsertGateway(item)    → 新增/更新网关
 *   DeviceStore.removeGateway(id)      → 删除网关
 *   DeviceStore.upsertCamera(item)     → 新增/更新视频通道
 *   DeviceStore.removeCamera(id)       → 删除视频通道
 *   DeviceStore.dataPointsOf(type)     → 按设备类型返回可选数据点
 *   DeviceStore.subscribe(fn)          → 订阅变更，返回 unsubscribe
 *   DeviceStore.reset()                → 恢复默认数据
 */

(function (global) {
  'use strict';

  var STORAGE_KEY = 'applefarm_device_v1';

  /* ---------------- 设备类型与数据点字典 ---------------- */

  // 接入配置可选设备类型（与 device_info.html 台账类型保持一致）
  var DEVICE_TYPES = [
    '气象监测站', '土壤墒情仪', '虫情监测仪', '监控摄像头',
    '环境传感器', '智能网关', '水肥一体机'
  ];

  // 各设备类型的数据点（物模型测点），用于接入配置里勾选采集项
  var DATA_POINTS = {
    '气象监测站': [
      { key: 'airTemp',   name: '空气温度',   unit: '℃',   step: '0.1' },
      { key: 'airHum',    name: '空气湿度',   unit: '%RH', step: '0.1' },
      { key: 'windSpeed', name: '风速',       unit: 'm/s', step: '0.1' },
      { key: 'windDir',   name: '风向',       unit: '°',   step: '1'   },
      { key: 'rainfall',  name: '降雨量',     unit: 'mm',  step: '0.1' },
      { key: 'pressure',  name: '大气压',     unit: 'hPa', step: '0.1' },
      { key: 'light',     name: '光照强度',   unit: 'lx',  step: '1'   }
    ],
    '土壤墒情仪': [
      { key: 'soilTemp',  name: '土壤温度',   unit: '℃',   step: '0.1' },
      { key: 'soilMoist', name: '土壤湿度',   unit: '%',   step: '0.1' },
      { key: 'soilEc',    name: '电导率 EC',  unit: 'mS/cm', step: '0.01' },
      { key: 'soilPh',    name: '土壤 pH',    unit: 'pH',  step: '0.01' }
    ],
    '虫情监测仪': [
      { key: 'insectImg', name: '虫情图像',   unit: '张',  step: '1' },
      { key: 'insectCnt', name: '诱虫计数',   unit: '头',  step: '1' },
      { key: 'temp',      name: '灯内温度',   unit: '℃',   step: '0.1' }
    ],
    '监控摄像头': [
      { key: 'streamMain', name: '主码流',    unit: '',    step: '1' },
      { key: 'streamSub',  name: '子码流',    unit: '',    step: '1' },
      { key: 'snapshot',   name: '抓拍图片',  unit: '张',  step: '1' },
      { key: 'ptzCtrl',    name: '云台控制',  unit: '',    step: '1' }
    ],
    '环境传感器': [
      { key: 'airTemp',    name: '空气温度',  unit: '℃',   step: '0.1' },
      { key: 'airHum',     name: '空气湿度',  unit: '%RH', step: '0.1' },
      { key: 'co2',        name: 'CO₂ 浓度',  unit: 'ppm', step: '1'   },
      { key: 'light',      name: '光照强度',  unit: 'lx',  step: '1'   },
      { key: 'soilMoist',  name: '土壤湿度',  unit: '%',   step: '0.1' }
    ],
    '智能网关': [
      { key: 'heartbeat',  name: '心跳信号',  unit: '',    step: '1' },
      { key: 'rssi',       name: '信号强度',  unit: 'dBm', step: '1'   }
    ],
    '水肥一体机': [
      { key: 'flowRate',   name: '灌溉流量',  unit: 'm³/h', step: '0.1' },
      { key: 'ecOut',      name: '出液 EC',   unit: 'mS/cm', step: '0.01' },
      { key: 'phOut',      name: '出液 pH',   unit: 'pH',  step: '0.01' },
      { key: 'pressure',   name: '管路压力',  unit: 'MPa', step: '0.01' }
    ]
  };

  // 各设备类型推荐接入方式
  var ACCESS_WAYS = {
    '气象监测站': ['MQTT', 'Modbus TCP'],
    '土壤墒情仪': ['MQTT', 'Modbus TCP'],
    '虫情监测仪': ['MQTT', 'HTTPS 回调'],
    '监控摄像头': ['ONVIF', 'RTSP', 'GB/T 28181'],
    '环境传感器': ['MQTT', 'Modbus TCP'],
    '智能网关': ['MQTT', 'WebSocket'],
    '水肥一体机': ['Modbus TCP', 'MQTT']
  };

  /* ---------------- 默认数据 ---------------- */

  // 设备接入配置
  var DEFAULT_ACCESS = [
    {
      id: 'AC-001', deviceName: '东区气象监测站', deviceType: '气象监测站',
      base: '麦积区基地 A区', accessWay: 'MQTT', gatewayId: 'GW-001',
      endpoint: 'mqtt://iot-gw.maitian.com:1883/weather/east',
      freq: '10分钟', timeout: 90, points: ['airTemp', 'airHum', 'windSpeed', 'rainfall', 'light'],
      status: 'online', statusText: '已接入', remark: '服务 A/B/C 三区气象数据',
      updatedAt: '2026-10-22 09:12'
    },
    {
      id: 'AC-002', deviceName: '东区土壤墒情仪', deviceType: '土壤墒情仪',
      base: '麦积区基地 A区', accessWay: 'Modbus TCP', gatewayId: 'GW-001',
      endpoint: 'tcp://10.20.1.11:502',
      freq: '30分钟', timeout: 120, points: ['soilTemp', 'soilMoist', 'soilEc', 'soilPh'],
      status: 'online', statusText: '已接入', remark: '20cm/40cm/60cm 三层埋设',
      updatedAt: '2026-10-22 09:15'
    },
    {
      id: 'AC-003', deviceName: 'B区虫情测报灯', deviceType: '虫情监测仪',
      base: '麦积区基地 B区', accessWay: 'MQTT', gatewayId: 'GW-002',
      endpoint: 'mqtt://iot-gw.maitian.com:1883/pest/b',
      freq: '1小时', timeout: 180, points: ['insectImg', 'insectCnt', 'temp'],
      status: 'online', statusText: '已接入', remark: '拍照上传间隔 1 小时',
      updatedAt: '2026-10-22 08:40'
    },
    {
      id: 'AC-004', deviceName: 'A区监控摄像头', deviceType: '监控摄像头',
      base: '麦积区基地 A区', accessWay: 'ONVIF', gatewayId: 'GW-003',
      endpoint: 'rtsp://cam-a01.maitian.com:554/Streaming/Channels/101',
      freq: '实时', timeout: 60, points: ['streamMain', 'streamSub', 'snapshot', 'ptzCtrl'],
      status: 'online', statusText: '已接入', remark: '球机，支持云台',
      updatedAt: '2026-10-22 10:02'
    },
    {
      id: 'AC-005', deviceName: 'B区监控摄像头', deviceType: '监控摄像头',
      base: '麦积区基地 B区', accessWay: 'ONVIF', gatewayId: 'GW-003',
      endpoint: 'rtsp://cam-b02.maitian.com:554/Streaming/Channels/101',
      freq: '实时', timeout: 60, points: ['streamMain', 'snapshot'],
      status: 'warning', statusText: '接入异常', remark: '网络抖动，需现场排查',
      updatedAt: '2026-10-22 07:50'
    },
    {
      id: 'AC-006', deviceName: 'C区环境监测站', deviceType: '环境传感器',
      base: '麦积区基地 C区', accessWay: 'MQTT', gatewayId: 'GW-002',
      endpoint: 'mqtt://iot-gw.maitian.com:1883/env/c',
      freq: '15分钟', timeout: 120, points: ['airTemp', 'airHum', 'co2', 'light'],
      status: 'online', statusText: '已接入', remark: '',
      updatedAt: '2026-10-21 16:20'
    },
    {
      id: 'AC-007', deviceName: '中心机房智能网关', deviceType: '智能网关',
      base: '麦积区基地 A区', accessWay: 'MQTT', gatewayId: 'GW-001',
      endpoint: 'mqtt://iot-gw.maitian.com:1883/gateway/a',
      freq: '实时', timeout: 60, points: ['heartbeat', 'rssi'],
      status: 'online', statusText: '已接入', remark: '机房内，4G 上行',
      updatedAt: '2026-10-22 09:20'
    },
    {
      id: 'AC-008', deviceName: 'A区水肥一体机', deviceType: '水肥一体机',
      base: '麦积区基地 A区', accessWay: 'Modbus TCP', gatewayId: 'GW-004',
      endpoint: 'tcp://10.20.4.21:502',
      freq: '10分钟', timeout: 120, points: ['flowRate', 'ecOut', 'phOut', 'pressure'],
      status: 'offline', statusText: '未接入', remark: '待现场联网后启用',
      updatedAt: '2026-10-20 11:05'
    },
    {
      id: 'AC-009', deviceName: 'B区气象监测站', deviceType: '气象监测站',
      base: '麦积区基地 B区', accessWay: 'MQTT', gatewayId: 'GW-002',
      endpoint: 'mqtt://iot-gw.maitian.com:1883/weather/b',
      freq: '10分钟', timeout: 90, points: ['airTemp', 'airHum', 'windSpeed', 'rainfall'],
      status: 'online', statusText: '已接入', remark: '',
      updatedAt: '2026-10-21 14:30'
    },
    {
      id: 'AC-010', deviceName: 'C区监控摄像头', deviceType: '监控摄像头',
      base: '麦积区基地 C区', accessWay: 'RTSP', gatewayId: 'GW-003',
      endpoint: 'rtsp://cam-c03.maitian.com:554/live',
      freq: '实时', timeout: 60, points: ['streamMain', 'snapshot'],
      status: 'online', statusText: '已接入', remark: '枪机，固定视角',
      updatedAt: '2026-10-21 15:45'
    }
  ];

  // 网关与协议配置
  var DEFAULT_GATEWAYS = [
    {
      id: 'GW-001', name: 'A区边缘网关', model: 'EG-2000', vendor: '数农智果',
      ip: '10.20.1.1', port: 1883, protocol: 'MQTT',
      username: 'gw_a', password: '******', topicPrefix: 'farm/a',
      heartbeat: 60, maxDevices: 50, status: 'online', statusText: '运行中',
      location: 'A区中心机房', remark: '承载 A 区全部气象与墒情设备',
      updatedAt: '2026-10-22 09:20'
    },
    {
      id: 'GW-002', name: 'B区边缘网关', model: 'EG-2000', vendor: '数农智果',
      ip: '10.20.2.1', port: 1883, protocol: 'MQTT',
      username: 'gw_b', password: '******', topicPrefix: 'farm/b',
      heartbeat: 60, maxDevices: 50, status: 'online', statusText: '运行中',
      location: 'B区泵房', remark: '',
      updatedAt: '2026-10-22 08:40'
    },
    {
      id: 'GW-003', name: '视频接入平台', model: 'NVR-8000', vendor: '海康威视',
      ip: '10.20.3.1', port: 554, protocol: 'ONVIF',
      username: 'admin', password: '******', topicPrefix: 'video',
      heartbeat: 30, maxDevices: 64, status: 'online', statusText: '运行中',
      location: 'A区中心机房', remark: 'ONVIF 取流 + GB/T 28181 平台级联',
      updatedAt: '2026-10-22 10:02'
    },
    {
      id: 'GW-004', name: 'C区边缘网关', model: 'EG-1500', vendor: '数农智果',
      ip: '10.20.4.1', port: 502, protocol: 'Modbus TCP',
      username: '', password: '', topicPrefix: 'farm/c',
      heartbeat: 90, maxDevices: 30, status: 'warning', statusText: '连接不稳定',
      location: 'C区配电房', remark: '4G 信号弱，频繁重连',
      updatedAt: '2026-10-20 11:05'
    },
    {
      id: 'GW-005', name: '虫情测报网络', model: 'EDGE-A1', vendor: '中农博后',
      ip: '10.20.5.1', port: 1883, protocol: 'MQTT',
      username: 'gw_pest', password: '******', topicPrefix: 'farm/pest',
      heartbeat: 120, maxDevices: 20, status: 'offline', statusText: '已离线',
      location: 'B区虫情灯群', remark: '设备断电，待检修',
      updatedAt: '2026-10-19 17:30'
    }
  ];

  // 视频监控通道
  var DEFAULT_CAMERAS = [
    {
      id: 'VC-001', name: 'A区全景球机', code: 'CAM-A01', channel: '101',
      protocol: 'ONVIF', platform: '视频接入平台 NVR-8000',
      url: 'rtsp://cam-a01.maitian.com:554/Streaming/Channels/101',
      resolution: '1920×1080', fps: 25, stream: '主码流', ptz: true, ptzText: '支持',
      nightVision: true, nightVisionText: '红外夜视', storageDays: 30,
      base: '麦积区基地 A区', location: 'A区中心路口', status: 'online', statusText: '在线',
      remark: '覆盖 A 区主干道与分拣车间', updatedAt: '2026-10-22 10:02'
    },
    {
      id: 'VC-002', name: 'A区分拣车间', code: 'CAM-A02', channel: '102',
      protocol: 'ONVIF', platform: '视频接入平台 NVR-8000',
      url: 'rtsp://cam-a02.maitian.com:554/Streaming/Channels/102',
      resolution: '1920×1080', fps: 25, stream: '主码流', ptz: false, ptzText: '不支持',
      nightVision: true, nightVisionText: '红外夜视', storageDays: 30,
      base: '麦积区基地 A区', location: 'A区分拣车间', status: 'online', statusText: '在线',
      remark: '监控分拣包装作业', updatedAt: '2026-10-21 15:10'
    },
    {
      id: 'VC-003', name: 'B区主干道枪机', code: 'CAM-B02', channel: '202',
      protocol: 'ONVIF', platform: '视频接入平台 NVR-8000',
      url: 'rtsp://cam-b02.maitian.com:554/Streaming/Channels/202',
      resolution: '1280×720', fps: 20, stream: '主码流', ptz: false, ptzText: '不支持',
      nightVision: true, nightVisionText: '红外夜视', storageDays: 15,
      base: '麦积区基地 B区', location: 'B区主干道东侧', status: 'warning', statusText: '信号弱',
      remark: '网络抖动，画面偶发卡顿', updatedAt: '2026-10-22 07:50'
    },
    {
      id: 'VC-004', name: 'B区泵房球机', code: 'CAM-B03', channel: '203',
      protocol: 'ONVIF', platform: '视频接入平台 NVR-8000',
      url: 'rtsp://cam-b03.maitian.com:554/Streaming/Channels/203',
      resolution: '1920×1080', fps: 25, stream: '主码流', ptz: true, ptzText: '支持',
      nightVision: true, nightVisionText: '红外夜视', storageDays: 30,
      base: '麦积区基地 B区', location: 'B区泵房', status: 'online', statusText: '在线',
      remark: '', updatedAt: '2026-10-21 16:30'
    },
    {
      id: 'VC-005', name: 'C区仓库枪机', code: 'CAM-C03', channel: '303',
      protocol: 'RTSP', platform: '视频接入平台 NVR-8000',
      url: 'rtsp://cam-c03.maitian.com:554/live',
      resolution: '1280×720', fps: 20, stream: '主码流', ptz: false, ptzText: '不支持',
      nightVision: false, nightVisionText: '无夜视', storageDays: 15,
      base: '麦积区基地 C区', location: 'C区仓库门口', status: 'online', statusText: '在线',
      remark: '', updatedAt: '2026-10-21 15:45'
    },
    {
      id: 'VC-006', name: 'C区冷库门口', code: 'CAM-C04', channel: '304',
      protocol: 'ONVIF', platform: '视频接入平台 NVR-8000',
      url: 'rtsp://cam-c04.maitian.com:554/Streaming/Channels/304',
      resolution: '1280×720', fps: 20, stream: '主码流', ptz: false, ptzText: '不支持',
      nightVision: false, nightVisionText: '无夜视', storageDays: 15,
      base: '麦积区基地 C区', location: 'C区冷库门口', status: 'offline', statusText: '离线',
      remark: '离线 3 天，疑似电源故障', updatedAt: '2026-10-19 09:00'
    },
    {
      id: 'VC-007', name: 'A区虫情灯位', code: 'CAM-A03', channel: '103',
      protocol: 'GB/T 28181', platform: '视频接入平台 NVR-8000',
      url: 'rtsp://cam-a03.maitian.com:554/live',
      resolution: '1280×720', fps: 15, stream: '子码流', ptz: false, ptzText: '不支持',
      nightVision: true, nightVisionText: '红外夜视', storageDays: 15,
      base: '麦积区基地 A区', location: 'A区虫情灯位', status: 'online', statusText: '在线',
      remark: '虫情拍照现场复核', updatedAt: '2026-10-21 14:20'
    }
  ];

  /* ---------------- 读写与广播 ---------------- */

  var subscribers = [];
  var inMemory = null;

  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  function defaults() {
    return {
      access: deepClone(DEFAULT_ACCESS),
      gateways: deepClone(DEFAULT_GATEWAYS),
      cameras: deepClone(DEFAULT_CAMERAS)
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return null;
      return obj;
    } catch (e) { return null; }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemory)); } catch (e) { /* 忽略 */ }
  }

  function ensure() {
    if (inMemory) return inMemory;
    var stored = load();
    var base = defaults();
    if (stored) {
      Object.keys(base).forEach(function (k) { if (stored[k] === undefined) stored[k] = base[k]; });
      inMemory = stored;
    } else {
      inMemory = base;
      save();
    }
    return inMemory;
  }

  function notify(reason) {
    subscribers.forEach(function (fn) {
      try { fn(reason); } catch (e) { console.warn('[DeviceStore] subscriber error', e); }
    });
  }

  function broadcast(reason) {
    save();
    notify(reason);
    try {
      window.dispatchEvent(new CustomEvent('deviceStoreChange', { detail: { reason: reason } }));
    } catch (e) { /* 忽略 */ }
  }

  /* ---------------- 汇总计算 ---------------- */

  function accessSummary() {
    var d = ensure();
    var byType = {};
    d.access.forEach(function (x) { byType[x.deviceType] = (byType[x.deviceType] || 0) + 1; });
    return {
      total: d.access.length,
      online: d.access.filter(function (x) { return x.status === 'online'; }).length,
      warning: d.access.filter(function (x) { return x.status === 'warning'; }).length,
      offline: d.access.filter(function (x) { return x.status === 'offline'; }).length,
      typeCount: Object.keys(byType).length,
      pointTotal: d.access.reduce(function (s, x) { return s + (x.points || []).length; }, 0)
    };
  }

  function gatewaySummary() {
    var d = ensure();
    return {
      total: d.gateways.length,
      online: d.gateways.filter(function (x) { return x.status === 'online'; }).length,
      warning: d.gateways.filter(function (x) { return x.status === 'warning'; }).length,
      offline: d.gateways.filter(function (x) { return x.status === 'offline'; }).length,
      protocols: d.gateways.filter(function (x) { return x.protocol === 'MQTT'; }).length,
      capacity: d.gateways.reduce(function (s, x) { return s + (x.maxDevices || 0); }, 0)
    };
  }

  function cameraSummary() {
    var d = ensure();
    return {
      total: d.cameras.length,
      online: d.cameras.filter(function (x) { return x.status === 'online'; }).length,
      warning: d.cameras.filter(function (x) { return x.status === 'warning'; }).length,
      offline: d.cameras.filter(function (x) { return x.status === 'offline'; }).length,
      ptz: d.cameras.filter(function (x) { return x.ptz; }).length
    };
  }

  /* ---------------- 通用 upsert / remove ---------------- */

  function upsert(listName, item) {
    var d = ensure();
    var list = d[listName];
    var idx = list.findIndex(function (x) { return x.id === item.id; });
    if (idx >= 0) list[idx] = Object.assign({}, list[idx], item);
    else list.push(item);
    broadcast(listName + ':' + item.id);
    return true;
  }

  function remove(listName, id) {
    var d = ensure();
    d[listName] = d[listName].filter(function (x) { return x.id !== id; });
    broadcast(listName + '-remove:' + id);
    return true;
  }

  /* ---------------- 对外 API ---------------- */

  var DeviceStore = {
    STORAGE_KEY: STORAGE_KEY,
    DEVICE_TYPES: DEVICE_TYPES,
    DATA_POINTS: DATA_POINTS,
    ACCESS_WAYS: ACCESS_WAYS,

    accessConfigs: function () { return deepClone(ensure().access); },
    gateways: function () { return deepClone(ensure().gateways); },
    cameras: function () { return deepClone(ensure().cameras); },

    accessSummary: accessSummary,
    gatewaySummary: gatewaySummary,
    cameraSummary: cameraSummary,

    upsertAccess: function (item) { return upsert('access', item); },
    removeAccess: function (id) { return remove('access', id); },
    upsertGateway: function (item) { return upsert('gateways', item); },
    removeGateway: function (id) { return remove('gateways', id); },
    upsertCamera: function (item) { return upsert('cameras', item); },
    removeCamera: function (id) { return remove('cameras', id); },

    dataPointsOf: function (type) { return deepClone(DATA_POINTS[type] || []); },

    subscribe: function (fn) {
      subscribers.push(fn);
      try { fn('init'); } catch (e) { /* 忽略 */ }
      return function unsubscribe() {
        subscribers = subscribers.filter(function (x) { return x !== fn; });
      };
    },
    reset: function () {
      inMemory = defaults();
      save();
      broadcast('reset');
    },
    _syncFromExternal: function () {
      var stored = load();
      if (stored) { inMemory = stored; notify('sync'); }
    }
  };

  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY) DeviceStore._syncFromExternal();
  });

  global.DeviceStore = DeviceStore;
})(window);