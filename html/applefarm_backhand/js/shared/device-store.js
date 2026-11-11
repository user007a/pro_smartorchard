/**
 * 设备管理共享数据层（Device Store）
 * --------------------------------------------------------------
 * 承载「设备管理」全域数据，是后台设备相关页面 + 移动端 + 大屏的唯一权威源。
 *
 * 覆盖范围：
 *   1. 接入层：设备接入配置 / 网关与协议 / 视频监控通道
 *   2. 资产层：设备台账 / 校准检定 / 备品备件 / 资产盘点
 *   3. 运维层：设备日志 / 维护工单 / 移动端报修 / 远程指令
 *   4. 统计层：运行统计（在线率 / 完好率 / 稼动率 / MTBF / MTTR）
 *   5. 治理层：设备类型与物模型字典 / 操作审计日志
 *
 * 关键设计：
 *   - DEVICE_TYPE_DICT 为全模块唯一设备类型字典（台账类型 ⊇ 接入类型），
 *     接入层的 deviceType 只能是字典中 access: true 的子集，杜绝三套枚举并存。
 *   - 设备台账为唯一权威实体，接入配置 / 视频通道通过 deviceId 关联台账编号，
 *     实现「配置了设备就能在台账看到、台账里的设备能接进来」。
 *   - 基地 / 地块外键统一取自地块主数据 smartorchard_plot_master，与企业管理、地块管理一致。
 *
 * 存储 key： applefarm_device_v1
 *
 * 暴露 API：
 *   DeviceStore.DEVICE_TYPE_DICT / DEVICE_TYPES / DATA_POINTS / ACCESS_WAYS
 *   DeviceStore.accessConfigs() / gateways() / cameras() / devices()
 *   DeviceStore.maintains() / logs() / calibrations() / spares() / assets()
 *   DeviceStore.commands() / audits() / models()
 *   DeviceStore.accessSummary() / gatewaySummary() / cameraSummary()
 *   DeviceStore.deviceSummary() / maintainSummary() / logSummary()
 *   DeviceStore.stats() / healthOf(deviceId)
 *   DeviceStore.upsertAccess/removeAccess/upsertGateway/removeGateway/upsertCamera/removeCamera
 *   DeviceStore.upsertDevice/removeDevice/upsertMaintain/removeMaintain
 *   DeviceStore.appendLog/clearLogs/upsertCalibration/removeCalibration
 *   DeviceStore.upsertSpare/removeSpare/upsertAsset/removeAsset
 *   DeviceStore.upsertCommand/upsertAudit/upsertModel/removeModel
 *   DeviceStore.dataPointsOf(type) / typeOf(code) / typeName(code)
 *   DeviceStore.bases() / plots() / plotLabel(code) / nextId(entity)
 *   DeviceStore.validate(entity, item, id) / subscribe(fn) / reset()
 */

(function (global) {
  'use strict';

  /* 依赖自动加载：api.js（统一后端请求）与 device-mapper.js（字段映射层）
   * 若页面尚未引入，则自动注入，保证后端桥接可用、页面零改动。
   *
   * 关键：注入 script 的 src 是相对【文档 URL】解析的，不是相对本脚本位置。
   * 本文件被 25 个不同层级的页面引用（后台/移动/H5/大屏），若写死相对路径，
   * 换到另一层级就会 404，导致后端桥接静默失效、回退 localStorage。
   * 因此这里基于 document.currentScript.src 算出本脚本所在目录再拼接。 */
  var depsReady = (function ensureDeps() {
    if (typeof document === 'undefined') return Promise.resolve();
    var selfEl = document.currentScript;
    if (!selfEl || !selfEl.src) return Promise.resolve();
    var baseDir = selfEl.src.replace(/[^\/]*$/, ''); // 去掉文件名，保留目录
    var deps = [
      { name: 'Api', src: baseDir + '../../../common/js/api.js' },
      { name: 'DeviceMapper', src: baseDir + 'device-mapper.js' }
    ];
    var pending = deps.filter(function (d) { return !global[d.name]; });
    if (!pending.length) return Promise.resolve();
    return Promise.all(pending.map(function (d) {
      return new Promise(function (resolve) {
        var s = document.createElement('script');
        s.src = d.src;
        s.async = false;
        s.onload = resolve;
        s.onerror = resolve; // 依赖加载失败不阻塞原型运行
        (document.head || document.documentElement).appendChild(s);
      });
    })).then(function () { return true; });
  })();

  var STORAGE_KEY = 'applefarm_device_v1';
  var PLOT_MASTER_KEY = 'smartorchard_plot_master';

  /**
   * 待同步到后端的删除清单
   * --------------------------------------------------------------
   * store 的删除动作是「从内存数组里移除」，若不做记录，
   * 后端收到的就是一份「少了一条」的完整数据，无法区分
   * 「删除了」与「本来就没有」，逻辑删除就永远触发不了。
   *
   * key 为聚合对象的子数组名（devices / accesses / gateways …），
   * value 为被删记录的业务编号数组。
   */
  var pendingDeletes = {};

  /** 记录一次删除（供持久化时输出到后端 deleted 字段） */
  function markDeleted(listName, id) {
    if (!id) return;
    (pendingDeletes[listName] = pendingDeletes[listName] || []).push(id);
  }

  /** 取走删除清单（持久化成功后调用 clearDeleted 真正清空） */
  function takeDeleted() {
    var out = {};
    Object.keys(pendingDeletes).forEach(function (k) {
      if (pendingDeletes[k] && pendingDeletes[k].length) out[k] = pendingDeletes[k].slice();
    });
    return out;
  }

  /** 持久化成功后清空已处理的删除清单，避免重复删除 */
  function clearDeleted(sent) {
    Object.keys(sent || {}).forEach(function (k) {
      pendingDeletes[k] = (pendingDeletes[k] || []).filter(function (id) {
        return sent[k].indexOf(id) === -1;
      });
      if (!pendingDeletes[k].length) delete pendingDeletes[k];
    });
  }

  /* ============================================================
   * 1. 设备类型与物模型字典（全模块唯一权威）
   * ============================================================ */

  /**
   * 设备类型字典
   *   code        唯一编码
   *   name        中文名（台账展示用）
   *   category    分类：weather / soil / video / pest / drone / storage / control / infra / sensor / security / power
   *   access      是否支持 IoT 接入（决定能否出现在接入配置页）
   *   control     是否具备下行控制能力
   *   asset       是否纳入资产台账管理
   *   maintainCycle 建议维保周期（月），0 表示不需例行维保
   *   calibrateCycle 建议校准/检定周期（月），0 表示无需计量检定
   *   way         推荐接入方式
   *   points      物模型测点（key/name/unit/step/min/max）
   */
  var DEVICE_TYPE_DICT = [
    {
      code: 'weather_station', name: '气象监测站', category: 'weather',
      access: true, control: false, asset: true, maintainCycle: 6, calibrateCycle: 12,
      way: ['MQTT', 'Modbus TCP'], desc: '园区级自动气象站，含温湿度、风、降雨、辐射等要素',
      points: [
        { key: 'airTemp', name: '空气温度', unit: '℃', step: '0.1', min: -30, max: 55 },
        { key: 'airHum', name: '空气湿度', unit: '%RH', step: '0.1', min: 0, max: 100 },
        { key: 'windSpeed', name: '风速', unit: 'm/s', step: '0.1', min: 0, max: 40 },
        { key: 'windDir', name: '风向', unit: '°', step: '1', min: 0, max: 360 },
        { key: 'rainfall', name: '降雨量', unit: 'mm', step: '0.1', min: 0, max: 300 },
        { key: 'pressure', name: '大气压', unit: 'hPa', step: '0.1', min: 800, max: 1100 },
        { key: 'light', name: '光照强度', unit: 'lx', step: '1', min: 0, max: 150000 },
        { key: 'radiation', name: '太阳总辐射', unit: 'W/m²', step: '1', min: 0, max: 1400 },
        { key: 'evaporation', name: '蒸发量', unit: 'mm/d', step: '0.1', min: 0, max: 30 },
        { key: 'visibility', name: '能见度', unit: 'km', step: '0.1', min: 0, max: 30 },
        { key: 'surfaceTemp', name: '地表温度', unit: '℃', step: '0.1', min: -30, max: 70 }
      ]
    },
    {
      code: 'weather_sensor', name: '气象传感器', category: 'weather',
      access: true, control: false, asset: true, maintainCycle: 6, calibrateCycle: 12,
      way: ['MQTT', 'Modbus TCP'], desc: '单要素气象传感器（风速、雨量、辐射等）',
      points: [
        { key: 'windSpeed', name: '风速', unit: 'm/s', step: '0.1', min: 0, max: 40 },
        { key: 'windDir', name: '风向', unit: '°', step: '1', min: 0, max: 360 },
        { key: 'rainfall', name: '降雨量', unit: 'mm', step: '0.1', min: 0, max: 300 },
        { key: 'radiation', name: '太阳总辐射', unit: 'W/m²', step: '1', min: 0, max: 1400 },
        { key: 'surfaceTemp', name: '地表温度', unit: '℃', step: '0.1', min: -30, max: 70 }
      ]
    },
    {
      code: 'soil_sensor', name: '土壤墒情仪', category: 'soil',
      access: true, control: false, asset: true, maintainCycle: 3, calibrateCycle: 6,
      way: ['MQTT', 'Modbus TCP'], desc: '多层土壤水分温度监测，含 EC、pH',
      points: [
        { key: 'soilTemp', name: '土壤温度', unit: '℃', step: '0.1', min: -10, max: 60 },
        { key: 'soilMoist', name: '土壤湿度', unit: '%', step: '0.1', min: 0, max: 100 },
        { key: 'soilEc', name: '电导率 EC', unit: 'mS/cm', step: '0.01', min: 0, max: 20 },
        { key: 'soilPh', name: '土壤 pH', unit: 'pH', step: '0.01', min: 3, max: 12 },
        { key: 'soilTempDeep', name: '深层土壤温度', unit: '℃', step: '0.1', min: -10, max: 50 },
        { key: 'soilMoistDeep', name: '深层土壤湿度', unit: '%', step: '0.1', min: 0, max: 100 },
        { key: 'frozen', name: '土壤结冰状态', unit: '', step: '1', min: 0, max: 1 }
      ]
    },
    {
      code: 'pest_monitor', name: '虫情测报仪', category: 'pest',
      access: true, control: false, asset: true, maintainCycle: 3, calibrateCycle: 0,
      way: ['MQTT', 'HTTPS 回调'], desc: '拍照识虫的虫情测报设备，含集虫盒负载与识别准确率',
      points: [
        { key: 'insectImg', name: '虫情图像', unit: '张', step: '1', min: 0, max: 500 },
        { key: 'insectCnt', name: '诱虫计数', unit: '头', step: '1', min: 0, max: 5000 },
        { key: 'temp', name: '灯内温度', unit: '℃', step: '0.1', min: -20, max: 60 },
        { key: 'collectLoad', name: '集虫盒负载', unit: '%', step: '1', min: 0, max: 100 },
        { key: 'accuracy', name: '识别准确率', unit: '%', step: '0.1', min: 0, max: 100 },
        { key: 'baitRemain', name: '诱捕剂剩余天数', unit: '天', step: '1', min: 0, max: 90 }
      ]
    },
    {
      code: 'insect_lamp', name: '杀虫灯', category: 'pest',
      access: true, control: true, asset: true, maintainCycle: 3, calibrateCycle: 0,
      way: ['MQTT'], desc: '频振式杀虫灯，支持光控/时控与诱虫计数',
      points: [
        { key: 'trapCnt', name: '诱虫数量', unit: '只', step: '1', min: 0, max: 10000 },
        { key: 'trapDays', name: '累计诱捕天数', unit: '天', step: '1', min: 0, max: 365 },
        { key: 'lampPower', name: '灯管功率', unit: 'W', step: '1', min: 0, max: 100 },
        { key: 'solarVolt', name: '太阳能电压', unit: 'V', step: '0.1', min: 0, max: 24 },
        { key: 'switchState', name: '开关灯状态', unit: '', step: '1', min: 0, max: 1 }
      ]
    },
    {
      code: 'camera', name: '监控摄像头', category: 'video',
      access: true, control: true, asset: true, maintainCycle: 6, calibrateCycle: 0,
      way: ['ONVIF', 'RTSP', 'GB/T 28181'], desc: '球机/枪机/半球，支持云台与录像回放',
      points: [
        { key: 'streamMain', name: '主码流', unit: '', step: '1', min: 0, max: 1 },
        { key: 'streamSub', name: '子码流', unit: '', step: '1', min: 0, max: 1 },
        { key: 'snapshot', name: '抓拍图片', unit: '张', step: '1', min: 0, max: 1 },
        { key: 'ptzCtrl', name: '云台控制', unit: '', step: '1', min: 0, max: 1 },
        { key: 'bitrate', name: '视频码率', unit: 'Mbps', step: '0.1', min: 0, max: 30 },
        { key: 'fps', name: '画面帧率', unit: 'fps', step: '1', min: 0, max: 60 },
        { key: 'storageUsed', name: '存储占用', unit: '%', step: '1', min: 0, max: 100 }
      ]
    },
    {
      code: 'security_device', name: '安防设备', category: 'security',
      access: true, control: true, asset: true, maintainCycle: 6, calibrateCycle: 12,
      way: ['MQTT', 'Modbus TCP'], desc: '门禁、烟感、周界报警等安防装置',
      points: [
        { key: 'deviceTemp', name: '设备温度', unit: '℃', step: '0.1', min: -20, max: 80 },
        { key: 'alarmCnt', name: '告警次数', unit: '次', step: '1', min: 0, max: 9999 },
        { key: 'onlineHours', name: '在线时长', unit: 'h', step: '1', min: 0, max: 100000 }
      ]
    },
    {
      code: 'env_sensor', name: '环境传感器', category: 'sensor',
      access: true, control: false, asset: true, maintainCycle: 6, calibrateCycle: 12,
      way: ['MQTT', 'Modbus TCP'], desc: '温湿度、CO₂、光照等环境要素监测',
      points: [
        { key: 'airTemp', name: '空气温度', unit: '℃', step: '0.1', min: -30, max: 60 },
        { key: 'airHum', name: '空气湿度', unit: '%RH', step: '0.1', min: 0, max: 100 },
        { key: 'co2', name: 'CO₂ 浓度', unit: 'ppm', step: '1', min: 0, max: 5000 },
        { key: 'light', name: '光照强度', unit: 'lx', step: '1', min: 0, max: 150000 },
        { key: 'soilMoist', name: '土壤湿度', unit: '%', step: '0.1', min: 0, max: 100 }
      ]
    },
    {
      code: 'water_fertilizer', name: '水肥一体化控制机', category: 'control',
      access: true, control: true, asset: true, maintainCycle: 3, calibrateCycle: 6,
      way: ['Modbus TCP', 'MQTT'], desc: '水肥一体机，含 EC/pH 控制、阀控回路与灌溉施肥配方',
      points: [
        { key: 'flowRate', name: '灌溉流量', unit: 'm³/h', step: '0.1', min: 0, max: 100 },
        { key: 'ecOut', name: '出液 EC', unit: 'mS/cm', step: '0.01', min: 0, max: 10 },
        { key: 'phOut', name: '出液 pH', unit: 'pH', step: '0.01', min: 0, max: 14 },
        { key: 'pressure', name: '管路压力', unit: 'MPa', step: '0.01', min: 0, max: 2.5 },
        { key: 'targetEc', name: '目标 EC', unit: 'mS/cm', step: '0.01', min: 0, max: 10 },
        { key: 'targetPh', name: '目标 pH', unit: 'pH', step: '0.01', min: 0, max: 14 },
        { key: 'valveOpen', name: '阀门开度', unit: '%', step: '1', min: 0, max: 100 },
        { key: 'fertRemain', name: '肥料余量', unit: 'kg', step: '0.1', min: 0, max: 1000 },
        { key: 'pumpState', name: '泵组状态', unit: '', step: '1', min: 0, max: 1 },
        { key: 'filterState', name: '过滤器状态', unit: '', step: '1', min: 0, max: 1 },
        { key: 'recycleRate', name: '余液回收率', unit: '%', step: '1', min: 0, max: 100 },
        { key: 'runMode', name: '运行模式', unit: '', step: '1', min: 0, max: 1 }
      ]
    },
    {
      code: 'irrigation_controller', name: '灌溉控制器', category: 'control',
      access: true, control: true, asset: true, maintainCycle: 6, calibrateCycle: 12,
      way: ['Modbus TCP', 'MQTT'], desc: '电磁阀/变频泵分区灌溉控制器',
      points: [
        { key: 'pressure', name: '管道压力', unit: 'MPa', step: '0.01', min: 0, max: 2.5 },
        { key: 'flowRate', name: '瞬时流量', unit: 'm³/h', step: '0.1', min: 0, max: 100 },
        { key: 'totalVolume', name: '累计灌溉量', unit: 'm³', step: '0.1', min: 0, max: 100000 },
        { key: 'valveOpen', name: '阀门开度', unit: '%', step: '1', min: 0, max: 100 }
      ]
    },
    {
      code: 'cold_storage', name: '冷库温控仪', category: 'storage',
      access: true, control: true, asset: true, maintainCycle: 3, calibrateCycle: 6,
      way: ['MQTT', 'Modbus TCP'], desc: '冷库/预冷库温湿度控制柜，含压缩机、除霜、门禁联动',
      points: [
        { key: 'storeTemp', name: '库内温度', unit: '℃', step: '0.1', min: -25, max: 45 },
        { key: 'storeHum', name: '库内湿度', unit: '%', step: '1', min: 0, max: 100 },
        { key: 'co2', name: 'CO₂ 浓度', unit: 'ppm', step: '1', min: 0, max: 10000 },
        { key: 'compressState', name: '压缩机状态', unit: '', step: '1', min: 0, max: 1 },
        { key: 'defrostState', name: '除霜状态', unit: '', step: '1', min: 0, max: 1 },
        { key: 'doorState', name: '库门开关', unit: '', step: '1', min: 0, max: 1 },
        { key: 'setTemp', name: '设定温度', unit: '℃', step: '0.1', min: -25, max: 20 },
        { key: 'power', name: '总功耗', unit: 'kW', step: '0.1', min: 0, max: 500 }
      ]
    },
    {
      code: 'store_sensor', name: '仓储环境传感器', category: 'storage',
      access: true, control: false, asset: true, maintainCycle: 6, calibrateCycle: 12,
      way: ['MQTT'], desc: '常温库/分拣车间温湿度与粉尘监测',
      points: [
        { key: 'storeTemp', name: '库内温度', unit: '℃', step: '0.1', min: -25, max: 60 },
        { key: 'storeHum', name: '库内湿度', unit: '%', step: '1', min: 0, max: 100 },
        { key: 'dust', name: '粉尘浓度', unit: 'mg/m³', step: '0.1', min: 0, max: 100 }
      ]
    },
    {
      code: 'drone', name: '植保无人机', category: 'drone',
      access: true, control: true, asset: true, maintainCycle: 3, calibrateCycle: 6,
      way: ['MQTT', 'WebSocket'], desc: '多旋翼植保无人机，含电池、机务与作业统计',
      points: [
        { key: 'sortieCnt', name: '飞行架次', unit: '架次', step: '1', min: 0, max: 10000 },
        { key: 'workArea', name: '累计作业面积', unit: '亩', step: '0.1', min: 0, max: 100000 },
        { key: 'batteryLevel', name: '电池电量', unit: '%', step: '1', min: 0, max: 100 },
        { key: 'batteryCycle', name: '电池循环次数', unit: '次', step: '1', min: 0, max: 1000 },
        { key: 'flightHours', name: '累计飞行时长', unit: 'h', step: '0.1', min: 0, max: 10000 },
        { key: 'rtkRate', name: 'RTK 固定解占比', unit: '%', step: '0.1', min: 0, max: 100 },
        { key: 'sprayVolume', name: '累计喷洒量', unit: 'L', step: '0.1', min: 0, max: 100000 }
      ]
    },
    {
      code: 'drone_hangar', name: '无人机机库', category: 'drone',
      access: true, control: true, asset: true, maintainCycle: 6, calibrateCycle: 12,
      way: ['MQTT', 'WebSocket'], desc: '自动机库，含充电桩、空调与舱门状态',
      points: [
        { key: 'hangarState', name: '机库状态', unit: '', step: '1', min: 0, max: 1 },
        { key: 'chargeState', name: '充电状态', unit: '', step: '1', min: 0, max: 1 },
        { key: 'hangarTemp', name: '舱内温度', unit: '℃', step: '0.1', min: -20, max: 60 },
        { key: 'doorState', name: '舱门状态', unit: '', step: '1', min: 0, max: 1 }
      ]
    },
    {
      code: 'gateway', name: '智能网关', category: 'infra',
      access: true, control: true, asset: true, maintainCycle: 12, calibrateCycle: 0,
      way: ['MQTT', 'WebSocket'], desc: '边缘接入网关，负责协议转换与上行',
      points: [
        { key: 'heartbeat', name: '心跳信号', unit: '', step: '1', min: 0, max: 1 },
        { key: 'rssi', name: '信号强度', unit: 'dBm', step: '1', min: -120, max: 0 },
        { key: 'cpuUsed', name: 'CPU 占用', unit: '%', step: '1', min: 0, max: 100 },
        { key: 'onlineDevices', name: '在线终端数', unit: '台', step: '1', min: 0, max: 500 }
      ]
    },
    {
      code: 'ipc', name: '工控主机', category: 'infra',
      access: true, control: true, asset: true, maintainCycle: 6, calibrateCycle: 0,
      way: ['MQTT', 'WebSocket'], desc: '机房边缘计算工控机',
      points: [
        { key: 'cpuUsed', name: 'CPU 占用', unit: '%', step: '1', min: 0, max: 100 },
        { key: 'memUsed', name: '内存占用', unit: '%', step: '1', min: 0, max: 100 },
        { key: 'diskFree', name: '磁盘剩余', unit: 'GB', step: '0.1', min: 0, max: 10000 },
        { key: 'netDelay', name: '网络延迟', unit: 'ms', step: '1', min: 0, max: 5000 },
        { key: 'runHours', name: '运行时长', unit: 'h', step: '1', min: 0, max: 100000 }
      ]
    },
    {
      code: 'data_terminal', name: '数据采集终端', category: 'infra',
      access: true, control: false, asset: true, maintainCycle: 6, calibrateCycle: 0,
      way: ['MQTT', 'Modbus TCP'], desc: '田间边缘数据采集与回传终端',
      points: [
        { key: 'collectCnt', name: '采集条数', unit: '条', step: '1', min: 0, max: 1000000 },
        { key: 'uploadRate', name: '上传成功率', unit: '%', step: '0.1', min: 0, max: 100 },
        { key: 'netDelay', name: '网络延迟', unit: 'ms', step: '1', min: 0, max: 5000 },
        { key: 'cacheUsed', name: '缓存占用', unit: '%', step: '1', min: 0, max: 100 }
      ]
    },
    {
      code: 'power_supply', name: '供电设备', category: 'power',
      access: true, control: false, asset: true, maintainCycle: 3, calibrateCycle: 12,
      way: ['MQTT', 'Modbus TCP'], desc: '太阳能供电、UPS 备电与配电柜',
      points: [
        { key: 'batteryVolt', name: '电池电压', unit: 'V', step: '0.1', min: 0, max: 60 },
        { key: 'batteryLevel', name: '剩余电量', unit: '%', step: '1', min: 0, max: 100 },
        { key: 'outputPower', name: '输出功率', unit: 'W', step: '0.1', min: 0, max: 5000 },
        { key: 'chargeCurrent', name: '充电电流', unit: 'A', step: '0.1', min: 0, max: 100 },
        { key: 'backupHours', name: '备电时长', unit: 'h', step: '0.1', min: 0, max: 72 }
      ]
    },
    {
      code: 'water_quality', name: '水质监测仪', category: 'sensor',
      access: true, control: false, asset: true, maintainCycle: 3, calibrateCycle: 6,
      way: ['MQTT', 'Modbus TCP'], desc: '灌溉水质（pH / EC / 浊度）在线监测',
      points: [
        { key: 'ph', name: 'pH', unit: 'pH', step: '0.01', min: 0, max: 14 },
        { key: 'ec', name: '电导率', unit: 'μS/cm', step: '1', min: 0, max: 20000 },
        { key: 'turbidity', name: '浊度', unit: 'NTU', step: '0.1', min: 0, max: 1000 },
        { key: 'waterTemp', name: '水温', unit: '℃', step: '0.1', min: 0, max: 60 }
      ]
    },
    {
      code: 'air_quality', name: '空气质量监测仪', category: 'sensor',
      access: true, control: false, asset: true, maintainCycle: 6, calibrateCycle: 12,
      way: ['MQTT', 'Modbus TCP'], desc: 'PM2.5 / PM10 / 温室气体监测',
      points: [
        { key: 'pm25', name: 'PM2.5', unit: 'μg/m³', step: '0.1', min: 0, max: 1000 },
        { key: 'pm10', name: 'PM10', unit: 'μg/m³', step: '0.1', min: 0, max: 1000 },
        { key: 'o3', name: '臭氧', unit: 'μg/m³', step: '0.1', min: 0, max: 1000 },
        { key: 'no2', name: '二氧化氮', unit: 'μg/m³', step: '0.1', min: 0, max: 1000 }
      ]
    },
    {
      code: 'weighing', name: '分选线称重设备', category: 'storage',
      access: true, control: false, asset: true, maintainCycle: 6, calibrateCycle: 12,
      way: ['Modbus TCP'], desc: '采后分选线电子秤，用于分级与产量计量',
      points: [
        { key: 'weight', name: '当前重量', unit: 'kg', step: '0.1', min: 0, max: 5000 },
        { key: 'throughput', name: '分选产量', unit: 'kg/h', step: '0.1', min: 0, max: 20000 },
        { key: 'accuracy', name: '计量偏差', unit: '%', step: '0.01', min: -5, max: 5 }
      ]
    }
  ];

  // 兼容：接入层可用类型（deviceType code 列表）
  var ACCESS_TYPES = DEVICE_TYPE_DICT.filter(function (t) { return t.access; });

  // 兼容：旧字典 key（按中文名反查 code）
  var TYPE_BY_NAME = {};
  DEVICE_TYPE_DICT.forEach(function (t) { TYPE_BY_NAME[t.name] = t.code; });
  // 历史别名 → 标准 code，保证旧数据平滑迁移
  var TYPE_ALIAS = {
    '气象监测站': 'weather_station',
    '气象传感器': 'weather_sensor',
    '土壤墒情仪': 'soil_sensor',
    '土壤传感器': 'soil_sensor',
    '虫情监测仪': 'pest_monitor',
    '虫情测报仪': 'pest_monitor',
    '虫情测报灯': 'pest_monitor',
    '杀虫灯': 'insect_lamp',
    '监控摄像头': 'camera',
    '摄像头': 'camera',
    '安防设备': 'security_device',
    '环境传感器': 'env_sensor',
    '水肥一体机': 'water_fertilizer',
    '水肥一体化控制机': 'water_fertilizer',
    '灌溉设备': 'water_fertilizer',
    '灌溉控制器': 'irrigation_controller',
    '冷库温控仪': 'cold_storage',
    '仓储环境传感器': 'store_sensor',
    '植保无人机': 'drone',
    '无人机': 'drone',
    '无人机机库': 'drone_hangar',
    '智能网关': 'gateway',
    '工控主机': 'ipc',
    '数据采集终端': 'data_terminal',
    '供电设备': 'power_supply',
    '水质监测仪': 'water_quality',
    '空气质量监测仪': 'air_quality',
    '分选线称重设备': 'weighing'
  };

  var TYPE_CATEGORY_TEXT = {
    weather: '气象监测', soil: '土壤墒情', video: '视频监控', pest: '虫情测报',
    drone: '无人机作业', storage: '仓储冷链', control: '灌溉控制',
    infra: '基础设施', sensor: '环境监测', security: '安防', power: '供电'
  };

  /* 设备类型分类色板 */
  var CATEGORY_COLOR = {
    weather: '#1890ff', soil: '#13c2c2', video: '#722ed1', pest: '#fa8c16',
    drone: '#eb2f96', storage: '#13c2c2', control: '#52c41a',
    infra: '#8c8c8c', sensor: '#2f54eb', security: '#f5222d', power: '#faad14'
  };

  /* ============================================================
   * 2. 状态机与枚举
   * ============================================================ */

  // 设备运行状态（在线状态）3 态
  var RUN_STATUS_TEXT = { online: '在线', maintain: '维护中', offline: '离线' };
  // 设备资产状态 5 态
  var ASSET_STATUS_TEXT = {
    inuse: '在用', idle: '闲置', repair: '维修中', scrapped: '已报废', transferred: '已调拨'
  };
  // 接入状态 3 态
  var ACCESS_STATUS_TEXT = { online: '已接入', warning: '接入异常', offline: '未接入' };
  // 网关运行状态 3 态
  var GW_STATUS_TEXT = { online: '运行中', warning: '连接不稳定', offline: '已离线' };
  // 视频通道状态 3 态
  var CAM_STATUS_TEXT = { online: '在线', warning: '信号弱', offline: '离线' };
  // 维护工单状态 4 态
  var MAINTAIN_STATUS_TEXT = {
    pending: '待处理', processing: '进行中', completed: '已完成', cancelled: '已取消'
  };
  // 维护类型 6 类
  var MAINTAIN_TYPES = ['例行维护', '故障维修', '升级更新', '巡检', '校准检定', '报废处置'];
  // 故障分类 5 类
  var FAULT_TYPES = ['硬件故障', '网络通信', '供电异常', '配置错误', '人为操作'];
  // 日志级别 4 级
  var LOG_LEVELS = ['info', 'warn', 'error', 'debug'];
  var LOG_LEVEL_TEXT = { info: 'INFO', warn: 'WARN', error: 'ERROR', debug: 'DEBUG' };
  // 日志类型 6 类
  var LOG_TYPES = ['数据采集', '通信交互', '配置变更', '固件升级', '控制指令', '异常事件'];
  // 日志来源 3 类
  var LOG_SOURCES = ['设备', '网关', '平台'];
  // 备件状态 3 态
  var SPARE_STATUS_TEXT = { in_stock: '有库存', low: '库存不足', out: '已用完' };
  // 盘点状态 4 态
  var ASSET_CHECK_STATUS_TEXT = {
    draft: '草稿', checking: '盘点中', done: '已完成', abnormal: '有差异'
  };
  // 指令状态 4 态
  var COMMAND_STATUS_TEXT = {
    pending: '待下发', sending: '下发中', success: '执行成功', failed: '执行失败'
  };
  // 指令类型 6 类
  var COMMAND_TYPES = ['参数下发', '远程重启', '采集指令', '固件升级', '校准指令', '开关控制'];
  // 处置方式 4 类（资产处置）
  var DISPOSAL_WAYS = ['报废销毁', '转售', '调拨', '封存'];

  /* ============================================================
   * 3. 工具函数
   * ============================================================ */

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function pad3(n) { return n < 10 ? '00' + n : (n < 100 ? '0' + n : '' + n); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function text(v) { return String(v == null ? '' : v).trim(); }
  function num(v, def) { var n = parseFloat(v); return isNaN(n) ? (def || 0) : n; }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function stampNow() {
    var d = new Date();
    return todayStr() + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function stampFull() {
    var d = new Date();
    return todayStr() + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }
  function isDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(text(v)) && !isNaN(Date.parse(text(v) + 'T00:00:00')); }
  function daysBetween(a, b) {
    if (!isDate(a) || !isDate(b)) return 0;
    return Math.round((Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / 86400000);
  }

  /* ============================================================
   * 4. 基地 / 地块外键（与企业管理、地块管理一致）
   * ============================================================ */

  var PLOT_FALLBACK = [
    ['D-001', '东区1号地', '天水麦积区基地', '花牛苹果'],
    ['D-002', '东区2号地', '天水麦积区基地', '花牛苹果'],
    ['D-003', '西区1号地', '天水麦积区基地', '金帅'],
    ['D-004', '北区1号地', '天水秦州区基地', '花牛苹果'],
    ['D-005', '南区1号地', '天水甘谷县基地', '花牛苹果'],
    ['D-006', '中区1号地', '天水秦安县基地', '花牛苹果'],
    ['D-007', '南区2号地', '天水清水县基地', '花牛苹果'],
    ['D-008', '西区2号地', '天水武山县基地', '花牛苹果'],
    ['D-009', '北区2号地', '天水张家川县基地', '花牛苹果'],
    ['D-010', '东区3号地', '天水麦积区基地', '金帅'],
    ['D-011', '南区3号地', '天水秦州区基地', '花牛苹果'],
    ['D-012', '西区3号地', '天水甘谷县基地', '秦冠'],
    ['D-013', '北区3号地', '天水清水县基地', '花牛苹果'],
    ['D-014', '中区2号地', '天水武山县基地', '花牛苹果'],
    ['D-015', '东区4号地', '天水张家川县基地', '花牛苹果'],
    ['D-016', '南区4号地', '天水麦积区基地', '金帅'],
    ['D-017', '西区4号地', '天水秦州区基地', '花牛苹果'],
    ['D-018', '北区4号地', '天水甘谷县基地', '花牛苹果'],
    ['D-019', '中区3号地', '天水秦安县基地', '花牛苹果'],
    ['D-020', '东区5号地', '天水清水县基地', '秦冠'],
    ['D-021', '南区5号地', '天水武山县基地', '花牛苹果'],
    ['D-022', '西区5号地', '天水张家川县基地', '花牛苹果'],
    ['D-023', '北区5号地', '天水麦积区基地', '金帅']
  ];

  function readPlotMaster() {
    try {
      var raw = localStorage.getItem(PLOT_MASTER_KEY);
      if (!raw) return null;
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : null;
    } catch (e) { return null; }
  }

  /** 地块列表：优先地块管理页落库数据，其次兜底种子 */
  function plots() {
    var master = readPlotMaster();
    if (master && master.length) {
      return master.map(function (p) {
        return {
          code: p.code || '', name: p.name || '', base: p.enterprise || '',
          variety: p.variety || '', lng: p.lng, lat: p.lat, manager: p.manager || ''
        };
      }).filter(function (p) { return !!p.code; });
    }
    return PLOT_FALLBACK.map(function (p) {
      return { code: p[0], name: p[1], base: p[2], variety: p[3] };
    });
  }

  /** 基地列表：取自地块实际归属，与企业管理基地档案口径一致 */
  function bases() {
    var seen = {}, out = [];
    plots().forEach(function (p) {
      if (p.base && !seen[p.base]) { seen[p.base] = 1; out.push(p.base); }
    });
    return out.sort();
  }

  function plotLabel(code) {
    var c = text(code);
    if (!c) return '';
    var hit = plots().filter(function (p) { return p.code === c; })[0];
    return hit ? c + ' · ' + hit.name : c;
  }

  /* ============================================================
   * 5. 种子数据
   * ============================================================ */

  /* ---- 5.1 设备台账 ---- */
  var DEVICE_SEED = [
    ['D-001', '东区气象监测站', 'weather_station', '天水麦积区基地', 'D-001', 'A区中心路口', 'online', 'inuse', '托普云农', 'AWS-800', 'T50W', '10.20.1.11', 'MQTT', '太阳能/市电', '惠加宁', 6, 12, '2024-03-15', '2024-03-20', 2.5, 12.4, 3250, 18, '2026-11-10 08:12', 98.6, '12240', 96.2, 'D-001 · 东区1号地', '园区级气象站，服务 A 区 12 个地块'],
    ['D-002', '东区土壤墒情仪', 'soil_sensor', '天水麦积区基地', 'D-002', 'A区中心路口', 'online', 'inuse', '托普云农', 'TS-300', 'V3.2.1', '10.20.1.12', 'MQTT', '太阳能/市电', '黄忠坚', 3, 6, '2024-04-02', '2024-04-05', 2.2, 12.2, 1860, 22, '2026-11-10 07:42', 97.8, '4860', 95.4, 'D-002 · 东区2号地', '20cm/40cm/60cm 三层埋设'],
    ['D-003', 'B区虫情测报仪', 'pest_monitor', '天水秦州区基地', 'D-011', 'B区虫情灯位', 'online', 'inuse', '中农博后', 'IPC-3000', 'V2.8.0', '10.20.2.21', 'MQTT', '市电', '徐水应', 3, 0, '2024-05-18', '2024-05-20', 3.0, 12.0, 2980, 14, '2026-11-10 06:30', 99.1, '15360', 97.8, 'D-011 · 南区3号地', '拍照上传间隔 1 小时'],
    ['D-004', 'A区全景球机', 'camera', '天水麦积区基地', '', 'A区中心路口', 'online', 'inuse', '海康威视', 'DS-2DE7A', 'V5.3.2', '10.20.3.21', 'ONVIF', 'POE', '朱泉龙', 6, 0, '2024-03-10', '2024-03-12', 4.0, 12.0, 8600, 12, '2026-11-10 08:20', 99.5, '8760', 98.9, '', '球机，支持云台，覆盖主干道与分拣车间'],
    ['D-005', 'B区主干道枪机', 'camera', '天水秦州区基地', '', 'B区主干道东侧', 'warning', 'inuse', '海康威视', 'DS-2CD3T', 'V5.3.2', '10.20.3.22', 'ONVIF', 'POE', '陈小忠', 6, 0, '2024-03-10', '2024-03-12', 3.2, 12.0, 8600, 15, '2026-11-09 22:05', 94.2, '7020', 92.1, '', '网络抖动，画面偶发卡顿'],
    ['D-006', 'C区环境监测站', 'env_sensor', '天水甘谷县基地', 'D-013', 'C区中心区域', 'online', 'inuse', '数农智果', 'ENV-500', 'V1.9.3', '10.20.4.31', 'MQTT', '市电', '廖春亮', 6, 12, '2024-06-22', '2024-06-25', 2.8, 12.0, 1420, 10, '2026-11-10 07:55', 97.4, '3640', 94.6, 'D-013 · 北区3号地', ''],
    ['D-007', '中心机房智能网关', 'gateway', '天水麦积区基地', '', 'A区中心机房', 'online', 'inuse', '数农智果', 'EG-2000', 'V4.1.0', '10.20.1.1', 'MQTT', '市电', '惠加宁', 12, 0, '2023-11-08', '2023-11-10', 4.5, 12.0, 4800, 30, '2026-11-10 08:00', 99.9, '43800', 99.7, '', '机房内，4G 上行，承载 A 区全部设备'],
    ['D-008', 'A区水肥一体化控制机', 'water_fertilizer', '天水麦积区基地', 'D-001', 'A区泵房', 'offline', 'inuse', '大疆农业', 'WF-2000', 'V2.0.6', '10.20.1.45', 'Modbus TCP', '市电', '李建明', 3, 6, '2024-04-18', '2024-04-22', 6.0, 12.0, 12800, 9, '2026-11-07 16:20', 88.5, '2180', 83.2, 'D-001 · 东区1号地', '待现场联网后启用'],
    ['D-009', 'B区气象监测站', 'weather_station', '天水秦州区基地', 'D-011', 'B区中心区域', 'online', 'inuse', '托普云农', 'AWS-800', 'T50W', '10.20.2.11', 'MQTT', '太阳能/市电', '黄忠坚', 6, 12, '2024-03-20', '2024-03-24', 2.5, 12.4, 2980, 16, '2026-11-10 08:05', 98.1, '9860', 95.8, 'D-011 · 南区3号地', ''],
    ['D-010', 'C区仓库枪机', 'camera', '天水甘谷县基地', '', 'C区仓库门口', 'online', 'inuse', '海康威视', 'DS-2CD3T', 'V5.3.2', '10.20.4.23', 'RTSP', 'POE', '李根', 6, 0, '2024-05-06', '2024-05-08', 3.0, 12.0, 8600, 11, '2026-11-10 07:40', 99.2, '8120', 98.4, '', ''],
    ['D-011', 'C区冷库温控仪', 'cold_storage', '天水甘谷县基地', '', 'C区冷库', 'online', 'inuse', '数农智果', 'CS-800', 'V3.4.0', '10.20.4.51', 'MQTT', '市电', '张才孙', 3, 6, '2024-07-01', '2024-07-05', 5.5, 12.0, 9800, 20, '2026-11-10 08:10', 99.0, '17520', 98.2, '', '冷库适温 0~4℃，适湿 85%~95%'],
    ['D-012', 'C区分拣车间温湿度仪', 'store_sensor', '天水甘谷县基地', '', 'C区分拣车间', 'online', 'inuse', '数农智果', 'ES-200', 'V1.5.2', '10.20.4.52', 'MQTT', 'POE', '刘全国', 6, 12, '2024-07-05', '2024-07-08', 2.0, 12.0, 1680, 13, '2026-11-10 08:02', 98.7, '6240', 96.1, '', '监测分拣包装作业环境'],
    ['D-013', 'A区植保无人机 T50', 'drone', '天水麦积区基地', '', 'A区停机坪', 'maintain', 'inuse', '大疆农业', 'T50', 'V01.00.09', '10.20.1.66', 'WebSocket', '锂电', '毛定卫', 3, 6, '2024-02-14', '2024-02-18', 4.8, 12.0, 5200, 8, '2026-11-10 07:30', 95.6, '1280', 93.8, '', '桨叶磨损待更换'],
    ['D-014', 'A区无人机机库', 'drone_hangar', '天水麦积区基地', '', 'A区停机坪', 'online', 'inuse', '大疆农业', 'DJI Dock 2', 'V01.00.05', '10.20.1.67', 'WebSocket', '市电', '毛定卫', 6, 12, '2024-02-14', '2024-02-18', 5.0, 12.0, 4800, 6, '2026-11-10 08:00', 99.4, '10920', 99.0, '', ''],
    ['D-015', 'B区杀虫灯', 'insect_lamp', '天水秦州区基地', '', 'B区林带东侧', 'online', 'inuse', '数农智果', 'IL-100', 'V2.2.1', '10.20.2.35', 'MQTT', '太阳能', '叶三东', 3, 0, '2024-08-12', '2024-08-15', 1.2, 12.0, 640, 19, '2026-11-10 05:00', 96.8, '1440', 94.0, '', '光控开关，日落自动开启'],
    ['D-016', 'A区配电柜', 'power_supply', '天水麦积区基地', '', 'A区配电房', 'online', 'inuse', '正泰电器', 'CDZ-800', 'V1.0', '10.20.1.9', 'Modbus TCP', '市电', '周才贵', 3, 12, '2023-09-20', '2023-09-22', 6.0, 12.0, 380, 34, '2026-11-10 08:00', 98.2, '43800', 97.5, '', '园区总配电，含三相电表'],
    ['D-017', 'A区工控主机', 'ipc', '天水麦积区基地', '', 'A区中心机房', 'online', 'inuse', '研华科技', 'IPC-610', 'V1.2', '10.20.1.5', 'MQTT', '市电', '惠加宁', 6, 0, '2023-11-08', '2023-11-10', 4.2, 12.0, 3200, 36, '2026-11-10 08:00', 99.8, '26280', 99.4, '', '机房边缘计算，模型推理节点'],
    ['D-018', 'A区数据采集终端', 'data_terminal', '天水麦积区基地', '', 'A区中心机房', 'online', 'inuse', '数农智果', 'DT-100', 'V1.4.0', '10.20.1.6', 'MQTT', '市电', '程名高', 6, 0, '2024-01-10', '2024-01-12', 2.2, 12.0, 760, 24, '2026-11-10 08:00', 98.9, '8760', 97.6, '', '田间数据回传汇聚'],
    ['D-019', 'C区冷库门禁控制器', 'security_device', '天水甘谷县基地', '', 'C区冷库门口', 'offline', 'inuse', '海康威视', 'DS-K2604', 'V3.3.1', '10.20.4.61', 'MQTT', 'POE', '邓小华', 6, 12, '2024-07-08', '2024-07-10', 1.6, 12.0, 320, 21, '2026-11-07 09:15', 91.5, '4320', 88.4, '', '离线 3 天，疑似电源故障'],
    ['D-020', 'A区分选线电子秤', 'weighing', '天水麦积区基地', '', 'A区分选车间', 'online', 'inuse', '托利多', 'IND-570', 'V2.1', '10.20.1.77', 'Modbus TCP', '市电', '周成友', 6, 12, '2024-05-20', '2024-05-22', 1.8, 12.0, 860, 17, '2026-11-10 08:08', 98.4, '3480', 96.8, '', '采后分级计量'],
    ['D-021', 'A区灌溉控制器', 'irrigation_controller', '天水麦积区基地', 'D-003', 'A区泵房', 'online', 'inuse', '大疆农业', 'IC-8', 'V1.8', '10.20.1.48', 'Modbus TCP', '市电', '危红卫', 6, 12, '2024-04-25', '2024-04-28', 2.8, 12.0, 1180, 14, '2026-11-10 07:50', 97.9, '3960', 95.2, 'D-003 · 西区1号地', '8 路电磁阀分区控制'],
    ['D-022', 'A区水质监测仪', 'water_quality', '天水麦积区基地', 'D-008', 'A区泵房进水口', 'online', 'inuse', '数农智果', 'WQ-300', 'V1.6.3', '10.20.1.49', 'Modbus TCP', '市电', '方超', 3, 6, '2024-06-08', '2024-06-12', 2.0, 12.0, 960, 12, '2026-11-10 07:45', 97.2, '4320', 94.9, 'D-008 · 西区2号地', '灌溉水质在线监测'],
    ['D-023', 'B区空气质量监测仪', 'air_quality', '天水秦州区基地', '', 'B区中心区域', 'offline', 'inuse', '数农智果', 'AQ-600', 'V2.0.1', '10.20.2.41', 'MQTT', '市电', '曹红英', 6, 12, '2024-02-20', '2024-02-24', 2.6, 12.0, 1240, 12, '2026-11-05 11:20', 89.6, '3120', 85.7, '', '通信故障待修'],
    ['D-024', 'A区太阳能供电系统', 'power_supply', '天水麦积区基地', '', 'A区气象站旁', 'online', 'inuse', '数农智果', 'SP-300', 'V1.3', '10.20.1.12', 'Modbus TCP', '太阳能', '崔新根', 3, 12, '2024-04-22', '2024-04-25', 1.6, 12.0, 520, 26, '2026-11-10 07:30', 96.1, '4360', 93.4, '', '供电 D-001/D-002 两台设备'],
    ['D-025', '旧版土壤传感器', 'soil_sensor', '天水清水县基地', 'D-007', '旧园区温室', 'idle', 'scrapped', '托普云农', 'TS-200', 'V1.2', '10.20.7.11', 'MQTT', '市电', '邓小华', 3, 6, '2019-04-10', '2019-04-12', 1.0, 12.0, 420, 30, '2026-06-30 18:00', 72.4, '2160', 68.2, 'D-007 · 南区2号地', '2026 年停用并计划报废'],
    ['D-026', 'B区植保无人机 Mavic 3M', 'drone', '天水秦州区基地', '', 'B区停机坪', 'online', 'inuse', '大疆农业', 'Mavic 3M', 'V01.00.09', '10.20.2.66', 'WebSocket', '锂电', '毛定卫', 3, 6, '2024-05-12', '2024-05-16', 4.6, 10.0, 4600, 22, '2026-11-10 07:20', 96.4, '980', 94.2, '', '多光谱巡检，B 区轮飞'],
    ['D-027', 'C区植保无人机 Mavic 3M', 'drone', '天水甘谷县基地', '', 'C区停机坪', 'online', 'inuse', '大疆农业', 'Mavic 3M', 'V01.00.09', '10.20.4.66', 'WebSocket', '锂电', '毛定卫', 3, 6, '2024-06-18', '2024-06-22', 4.6, 10.0, 4600, 16, '2026-11-10 07:05', 97.1, '860', 95.0, '', '多光谱巡检，C 区轮飞'],
    ['D-028', '清水园区测绘无人机 Mavic 3E', 'drone', '天水清水县基地', '', '清水园区机库', 'online', 'inuse', '大疆农业', 'Mavic 3E', 'V01.00.07', '10.20.7.66', 'WebSocket', '锂电', '毛定卫', 3, 6, '2024-08-02', '2024-08-06', 4.2, 10.0, 3800, 12, '2026-11-10 06:40', 96.8, '640', 94.6, '', '测绘建模用，非植保作业'],
    ['D-029', '麦积区应急巡检无人机 Mavic 3E', 'drone', '天水麦积区基地', '', 'A区停机坪', 'idle', 'inuse', '大疆农业', 'Mavic 3E', 'V01.00.07', '10.20.1.68', 'WebSocket', '锂电', '毛定卫', 3, 6, '2024-09-10', '2024-09-14', 4.2, 10.0, 3800, 9, '2026-11-03 15:30', 93.2, '420', 91.0, '', '雨季应急巡检备用机'],
    ['D-030', 'C区水肥一体化控制机', 'water_fertilizer', '天水甘谷县基地', '', 'C区泵房', 'online', 'inuse', '大疆农业', 'WF-2000', 'V2.1.0', '10.20.4.45', 'Modbus TCP', '市电', '李建明', 3, 6, '2024-09-01', '2024-09-05', 6.0, 12.0, 12800, 4, '2026-11-10 08:05', 98.6, '1120', 96.4, '', 'C区 12 个地块水肥一体控制']
  ];

  /**
   * 台账补充字段（最近维护 / 最近校准 / 质保到期）
   * 单独成表，避免主种子数组过长难维护
   */
  var DEVICE_EXTRA = {
    'D-001': { lastMaintain: '2026-09-18', lastCalibrate: '2026-09-18', warrantyUntil: '2027-03-15',
      readings: { airTemp: 18.6, airHum: 54.2, windSpeed: 2.8, windDir: 142, rainfall: 0,
        pressure: 862.4, light: 42600, radiation: 486, evaporation: 2.4, visibility: 21.5, surfaceTemp: 16.8 } },
    'D-002': { lastMaintain: '2026-08-20', lastCalibrate: '2026-08-20', warrantyUntil: '2027-04-02',
      readings: { soilTemp: 14.6, soilMoist: 32.8, soilEc: 1.24, soilPh: 6.82,
        soilTempDeep: 12.8, soilMoistDeep: 36.4, frozen: 0 } },
    'D-003': { lastMaintain: '2026-09-02', lastCalibrate: '2025-11-20', warrantyUntil: '2027-05-18',
      readings: { insectImg: 36, insectCnt: 128, temp: 26.4, collectLoad: 62, accuracy: 93.5, baitRemain: 24 } },
    'D-004': { lastMaintain: '2026-11-04', warrantyUntil: '2027-03-10' },
    'D-005': { lastMaintain: '2026-11-05', warrantyUntil: '2027-03-10' },
    'D-006': { lastMaintain: '2026-06-25', lastCalibrate: '2026-06-25', warrantyUntil: '2027-06-22' },
    'D-007': { lastMaintain: '2026-11-01', warrantyUntil: '2026-11-08' },
    'D-008': { lastMaintain: '2026-11-07', warrantyUntil: '2027-04-18' },
    'D-009': { lastMaintain: '2026-10-08', lastCalibrate: '2026-10-08', warrantyUntil: '2027-03-20' },
    'D-010': { lastMaintain: '2026-11-05', warrantyUntil: '2027-05-06' },
    'D-011': { lastMaintain: '2026-09-02', lastCalibrate: '2026-09-02', warrantyUntil: '2027-07-01', readings: { storeTemp: 2.4, storeHum: 91, compressState: '运行', defrostState: '待机', doorState: '关闭' } },
    'D-030': { lastMaintain: '2026-08-26', lastCalibrate: '2026-09-01', warrantyUntil: '2027-09-01',
      readings: { targetEc: 1.8, actualEc: 1.82, targetPh: 6.2, actualPh: 6.15, valveOpen: 3, valveTotal: 8,
        fertRemain: 68, pumpState: '运行', filterState: '正常', recycleRate: 82, runMode: '自动',
        flowRate: 42.6, pressure: 0.32, irrigatedToday: 186 } },
    'D-012': { lastMaintain: '2026-08-10', warrantyUntil: '2027-07-05' },
    'D-013': { lastMaintain: '2026-11-10', warrantyUntil: '2027-02-14' },
    'D-014': { lastMaintain: '2026-11-01', warrantyUntil: '2027-02-14' },
    'D-015': { lastMaintain: '2026-08-12', warrantyUntil: '2027-08-12',
      readings: { trapCnt: 386, trapDays: 92, lampPower: 18, solarVolt: 13.4, switchState: 1 } },
    'D-016': { lastMaintain: '2026-11-18', warrantyUntil: '2026-09-20' },
    'D-017': { lastMaintain: '2026-10-30', warrantyUntil: '2026-11-08' },
    'D-018': { lastMaintain: '2026-07-25', warrantyUntil: '2027-01-10' },
    'D-019': { lastMaintain: '2026-11-09', warrantyUntil: '2027-07-08' },
    'D-020': { lastMaintain: '2026-07-15', lastCalibrate: '2026-07-15', warrantyUntil: '2027-05-20' },
    'D-021': { lastMaintain: '2026-11-08', warrantyUntil: '2027-04-25' },
    'D-022': { lastMaintain: '2026-08-10', lastCalibrate: '2026-08-10', warrantyUntil: '2027-06-08' },
    'D-023': { lastMaintain: '2026-11-05', warrantyUntil: '2027-02-20' },
    'D-024': { lastMaintain: '2026-11-11', warrantyUntil: '2027-04-22' },
    'D-025': { lastMaintain: '2026-06-30', lastCalibrate: '2026-06-30', warrantyUntil: '2026-04-10' }
  };

  function buildDeviceSeed() {
    return DEVICE_SEED.map(function (r) {
      var cycle = r[15];
      var extra = DEVICE_EXTRA[r[0]] || {};
      var lastMaintain = extra.lastMaintain || '';
      var nextMaintain = '';
      if (cycle > 0) {
        var baseDate = lastMaintain || r[17];
        if (isDate(baseDate)) {
          var due = new Date(baseDate + 'T00:00:00');
          due.setMonth(due.getMonth() + cycle);
          nextMaintain = due.getFullYear() + '-' + pad2(due.getMonth() + 1) + '-' + pad2(due.getDate());
        }
      }
      return {
        id: r[0], name: r[1], type: r[2], base: r[3], plotId: r[4],
        location: r[5], status: r[6], assetStatus: r[7],
        vendor: r[8], model: r[9], firmware: r[10], ip: r[11],
        protocol: r[12], power: r[13], owner: r[14],
        maintainCycle: r[15], calibrateCycle: r[16],
        installDate: r[17], enableDate: r[18],
        purchaseAmount: r[19], usefulYears: r[20],
        runningHours: r[21], faultCount: r[22],
        lastSeenAt: r[23], onlineRate: r[24],
        collectCount: r[25], uptimeRate: r[26],
        accessId: r[27], remark: r[28],
        sn: 'SN' + r[0].slice(2) + '-' + r[9].replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase(),
        lastMaintainDate: lastMaintain, nextMaintainDate: nextMaintain,
        lastCalibrateDate: extra.lastCalibrate || '',
        retiredDate: '', disposalWay: '', supplier: r[8], warrantyUntil: extra.warrantyUntil || '',
        readings: extra.readings || null,
        createdAt: r[17], updatedAt: stampNow()
      };
    });
  }

  /* ---- 5.2 接入配置 ---- */
  var ACCESS_SEED = [
    ['AC-001', '东区气象监测站', 'weather_station', '天水麦积区基地', 'MQTT', 'GW-001', 'mqtt://iot-gw.maitian.com:1883/weather/east', '10分钟', 90, ['airTemp', 'airHum', 'windSpeed', 'windDir', 'rainfall', 'pressure', 'light', 'radiation', 'evaporation', 'visibility', 'surfaceTemp'], 'online', 'D-001', '上报', 'QoS 1', 'JSON', '服务 A/B/C 三区气象数据'],
    ['AC-002', '东区土壤墒情仪', 'soil_sensor', '天水麦积区基地', 'Modbus TCP', 'GW-001', 'tcp://10.20.1.12:502', '30分钟', 120, ['soilTemp', 'soilMoist', 'soilEc', 'soilPh', 'soilTempDeep', 'soilMoistDeep', 'frozen'], 'online', 'D-002', '上报', '03 读保持寄存器', '二进制', '20cm/40cm/60cm 三层埋设'],
    ['AC-003', 'B区虫情测报仪', 'pest_monitor', '天水秦州区基地', 'MQTT', 'GW-002', 'mqtt://iot-gw.maitian.com:1883/pest/b', '1小时', 180, ['insectImg', 'insectCnt', 'temp', 'collectLoad', 'accuracy', 'baitRemain'], 'online', 'D-003', '上报', 'QoS 1', 'JSON', '拍照上传间隔 1 小时'],
    ['AC-004', 'A区全景球机', 'camera', '天水麦积区基地', 'ONVIF', 'GW-003', 'rtsp://cam-a01.maitian.com:554/Streaming/Channels/101', '实时', 60, ['streamMain', 'streamSub', 'snapshot', 'ptzCtrl'], 'online', 'D-004', '双向', 'ONVIF', 'RTSP', '球机，支持云台'],
    ['AC-005', 'B区主干道枪机', 'camera', '天水秦州区基地', 'ONVIF', 'GW-003', 'rtsp://cam-b02.maitian.com:554/Streaming/Channels/101', '实时', 60, ['streamMain', 'snapshot'], 'warning', 'D-005', '双向', 'ONVIF', 'RTSP', '网络抖动，需现场排查'],
    ['AC-006', 'C区环境监测站', 'env_sensor', '天水甘谷县基地', 'MQTT', 'GW-002', 'mqtt://iot-gw.maitian.com:1883/env/c', '15分钟', 120, ['airTemp', 'airHum', 'co2', 'light'], 'online', 'D-006', '上报', 'QoS 0', 'JSON', ''],
    ['AC-007', '中心机房智能网关', 'gateway', '天水麦积区基地', 'MQTT', 'GW-001', 'mqtt://iot-gw.maitian.com:1883/gateway/a', '实时', 60, ['heartbeat', 'rssi'], 'online', 'D-007', '双向', 'QoS 1', 'JSON', '机房内，4G 上行'],
    ['AC-008', 'A区水肥一体化控制机', 'water_fertilizer', '天水麦积区基地', 'Modbus TCP', 'GW-004', 'tcp://10.20.1.45:502', '10分钟', 120, ['flowRate', 'ecOut', 'phOut', 'pressure', 'valveOpen'], 'offline', 'D-008', '双向', '06 写单寄存器', '二进制', '待现场联网后启用'],
    ['AC-009', 'B区气象监测站', 'weather_station', '天水秦州区基地', 'MQTT', 'GW-002', 'mqtt://iot-gw.maitian.com:1883/weather/b', '10分钟', 90, ['airTemp', 'airHum', 'windSpeed', 'rainfall'], 'online', 'D-009', '上报', 'QoS 1', 'JSON', ''],
    ['AC-010', 'C区仓库枪机', 'camera', '天水甘谷县基地', 'RTSP', 'GW-003', 'rtsp://cam-c03.maitian.com:554/live', '实时', 60, ['streamMain', 'snapshot'], 'online', 'D-010', '单向', 'RTSP', 'RTSP', '枪机，固定视角'],
    ['AC-011', 'C区冷库温控仪', 'cold_storage', '天水甘谷县基地', 'MQTT', 'GW-005', 'mqtt://iot-gw.maitian.com:1883/cold/c', '5分钟', 60, ['storeTemp', 'storeHum', 'compressState', 'defrostState', 'doorState'], 'online', 'D-011', '双向', 'QoS 1', 'JSON', '冷库适温 0~4℃'],
    ['AC-012', 'A区植保无人机 T50', 'drone', '天水麦积区基地', 'WebSocket', 'GW-001', 'ws://iot-gw.maitian.com:8080/drone/t50', '实时', 60, ['batteryLevel', 'rtkRate', 'flightHours'], 'warning', 'D-013', '双向', 'WebSocket', 'JSON', '桨叶磨损待更换'],
    ['AC-013', 'A区土壤墒情仪', 'soil_sensor', '天水麦积区基地', 'MQTT', 'GW-001', 'mqtt://iot-gw.maitian.com:1883/soil/a2', '30分钟', 120, ['soilTemp', 'soilMoist'], 'online', 'D-025', '上报', 'QoS 1', 'JSON', '旧园区，设备已停用待报废']
  ];

  function buildAccessSeed() {
    return ACCESS_SEED.map(function (r) {
      return {
        id: r[0], deviceName: r[1], deviceType: r[2], base: r[3],
        accessWay: r[4], gatewayId: r[5], endpoint: r[6], freq: r[7],
        timeout: r[8], points: r[9], status: r[10],
        deviceId: r[11], direction: r[12], auth: r[13], payload: r[14],
        model: '', sn: '', enabled: true, remark: r[15],
        updatedAt: stampNow()
      };
    });
  }

  /* ---- 5.3 网关 ---- */
  var GATEWAY_SEED = [
    ['GW-001', 'A区边缘网关', 'EG-2000', '数农智果', 'MQTT', '10.20.1.1', 1883, 'gw_a', 'farm/a', 60, 50, 'online', 'A区中心机房', '4G 上行', '10.20.1.1', 'V4.1.0', '4G', 'CPU 四核 / 内存 8GB'],
    ['GW-002', 'B区边缘网关', 'EG-2000', '数农智果', 'MQTT', '10.20.2.1', 1883, 'gw_b', 'farm/b', 60, 50, 'online', 'B区泵房', '', '10.20.2.1', 'V4.1.0', '4G', ''],
    ['GW-003', '视频接入平台', 'NVR-8000', '海康威视', 'ONVIF', '10.20.3.1', 554, 'admin', 'video', 30, 64, 'online', 'A区中心机房', 'ONVIF 取流 + GB/T 28181 平台级联', '10.20.3.1', 'V5.3.2', '以太网', '录像存储 32TB'],
    ['GW-004', 'C区边缘网关', 'EG-1500', '数农智果', 'Modbus TCP', '10.20.4.1', 502, '', 'farm/c', 90, 30, 'warning', 'C区配电房', '4G 信号弱，频繁重连', '10.20.4.1', 'V3.0.8', '4G', ''],
    ['GW-005', '虫情与冷链网关', 'EDGE-A1', '中农博后', 'MQTT', '10.20.5.1', 1883, 'gw_pest', 'farm/pest', 120, 20, 'offline', 'B区虫情灯群', '设备断电，待检修', '10.20.5.1', 'V1.8.0', '4G', '']
  ];

  function buildGatewaySeed() {
    return GATEWAY_SEED.map(function (r) {
      return {
        id: r[0], name: r[1], model: r[2], vendor: r[3], protocol: r[4],
        ip: r[5], port: r[6], username: r[7], password: '******', topicPrefix: r[8],
        heartbeat: r[9], maxDevices: r[10], status: r[11], location: r[12],
        remark: r[13], sn: 'GW-SN-' + r[0].slice(3), firmware: r[15],
        uplink: r[16], spec: r[17], simCard: '', bandwidth: '',
        backupHours: '', updatedAt: stampNow()
      };
    });
  }

  /* ---- 5.4 视频通道 ---- */
  var CAMERA_SEED = [
    ['VC-001', 'A区全景球机', 'CAM-A01', '101', 'ONVIF', 'rtsp://cam-a01.maitian.com:554/Streaming/Channels/101', '1920×1080', 25, '主码流', true, true, 30, '天水麦积区基地', 'A区中心路口', 'online', 'D-004', '球机', 'IP66', 'POE', '4Mbps'],
    ['VC-002', 'A区分拣车间', 'CAM-A02', '102', 'ONVIF', 'rtsp://cam-a02.maitian.com:554/Streaming/Channels/102', '1920×1080', 25, '主码流', false, true, 30, '天水麦积区基地', 'A区分拣车间', 'online', '', '半球', 'IP66', 'POE', '4Mbps'],
    ['VC-003', 'B区主干道枪机', 'CAM-B02', '202', 'ONVIF', 'rtsp://cam-b02.maitian.com:554/Streaming/Channels/202', '1280×720', 20, '主码流', false, true, 15, '天水秦州区基地', 'B区主干道东侧', 'warning', 'D-005', '枪机', 'IP67', 'POE', '2Mbps'],
    ['VC-004', 'B区泵房球机', 'CAM-B03', '203', 'ONVIF', 'rtsp://cam-b03.maitian.com:554/Streaming/Channels/203', '1920×1080', 25, '主码流', true, true, 30, '天水秦州区基地', 'B区泵房', 'online', '', '球机', 'IP66', 'POE', '4Mbps'],
    ['VC-005', 'C区仓库枪机', 'CAM-C03', '303', 'RTSP', 'rtsp://cam-c03.maitian.com:554/live', '1280×720', 20, '主码流', false, false, 15, '天水甘谷县基地', 'C区仓库门口', 'online', 'D-010', '枪机', 'IP66', 'POE', '2Mbps'],
    ['VC-006', 'C区冷库门口', 'CAM-C04', '304', 'ONVIF', 'rtsp://cam-c04.maitian.com:554/Streaming/Channels/304', '1280×720', 20, '主码流', false, false, 15, '天水甘谷县基地', 'C区冷库门口', 'offline', '', '半球', 'IP65', 'POE', '2Mbps'],
    ['VC-007', 'A区虫情灯位', 'CAM-A03', '103', 'GB/T 28181', 'rtsp://cam-a03.maitian.com:554/live', '1280×720', 15, '子码流', false, true, 15, '天水麦积区基地', 'A区虫情灯位', 'online', 'D-003', '枪机', 'IP65', '太阳能', '1Mbps']
  ];

  function buildCameraSeed() {
    return CAMERA_SEED.map(function (r) {
      return {
        id: r[0], name: r[1], code: r[2], channel: r[3], protocol: r[4],
        platform: '视频接入平台 NVR-8000', url: r[5], resolution: r[6], fps: r[7],
        stream: r[8], ptz: r[9], nightVision: r[10], storageDays: r[11],
        base: r[12], location: r[13], status: r[14], deviceId: r[15],
        form: r[16], protection: r[17], power: r[18], bitrate: r[19],
        aiAbility: '', audio: false, presetCount: 0,
        remark: '', updatedAt: stampNow()
      };
    });
  }

  /* ---- 5.5 维护工单 ---- */
  var MAINTAIN_SEED = [
    ['M-001', 'D-002', '例行维护', '传感器校准与清洁', '2026-11-12', 'pending', '黄忠坚', '例行维护', '', '', 0, 0, '', '', '', '', ''],
    ['M-002', 'D-021', '故障维修', '阀门故障排查与修复', '2026-11-08', 'processing', '徐水应', '硬件故障', '电磁阀无法开启', '', 2, 0, '', '', '已更换 2 路电磁阀线圈', '', ''],
    ['M-003', 'D-001', '例行维护', '气象站传感器校准', '2026-11-06', 'completed', '朱泉龙', '例行维护', '', '', 3, 320, '2026-11-06 09:00', '2026-11-06 12:30', '校准后与人工观测偏差 < 0.3℃', '', '朱泉龙'],
    ['M-004', 'D-017', '升级更新', '系统升级与安全补丁安装', '2026-10-30', 'completed', '惠加宁', '升级更新', '', '', 1, 180, '2026-10-30 20:00', '2026-10-30 23:00', '固件升级至 V1.3', '', '惠加宁'],
    ['M-005', 'D-005', '故障维修', '通信模块更换', '2026-11-14', 'pending', '陈小忠', '网络通信', '画面偶发卡顿', '', 0, 0, '', '', '', '', ''],
    ['M-006', 'D-024', '故障维修', '光伏组件局部遮挡清理', '2026-11-11', 'processing', '廖春亮', '供电异常', '电池电量下降过快', '', 4, 0, '', '', '清理光伏板积尘', '', ''],
    ['M-007', 'D-023', '故障维修', '通信故障排查', '2026-11-16', 'pending', '李建明', '网络通信', '设备通信失败', '', 0, 0, '', '', '', '', ''],
    ['M-008', 'D-016', '故障维修', 'UPS 电池组更换', '2026-11-18', 'pending', '李根', '硬件故障', 'UPS 故障，主电源已切换', '', 0, 0, '', '', '', '', ''],
    ['M-009', 'D-004', '巡检', '镜头清洁与 OSD 检查', '2026-11-04', 'completed', '张才孙', '巡检', '', '', 1, 60, '2026-11-04 14:00', '2026-11-04 15:00', '画面正常', '', '张才孙'],
    ['M-010', 'D-003', '例行维护', '镜头清洁与诱捕剂更换', '2026-11-15', 'pending', '刘全国', '例行维护', '', '', 0, 0, '', '', '', '', ''],
    ['M-011', 'D-002', '校准检定', '三层土壤探头零点标定', '2026-11-20', 'pending', '毛定卫', '配置错误', '', '', 0, 0, '', '', '', '', ''],
    ['M-012', 'D-006', '例行维护', 'CO₂ 传感器校准', '2026-11-19', 'pending', '叶三东', '例行维护', '', '', 0, 0, '', '', '', '', ''],
    ['M-013', 'D-019', '故障维修', '冷库门禁电源故障处理', '2026-11-09', 'processing', '周才贵', '供电异常', '离线 3 天，疑似电源故障', '', 3, 0, '', '', '', '', ''],
    ['M-014', 'D-007', '升级更新', '网关固件升级', '2026-11-01', 'completed', '周成友', '升级更新', '', '', 2, 120, '2026-11-01 22:00', '2026-11-01 23:30', '升级至 V4.1.0', '', '周成友'],
    ['M-015', 'D-011', '例行维护', '冷库温控仪精度校准', '2026-11-22', 'pending', '危红卫', '例行维护', '', '', 0, 0, '', '', '', '', ''],
    ['M-016', 'D-010', '巡检', '设备状态检查', '2026-11-05', 'completed', '方超', '巡检', '', '', 1, 45, '2026-11-05 10:00', '2026-11-05 10:45', '录像正常', '', '方超'],
    ['M-017', 'D-008', '故障维修', '水肥机连接管路漏水', '2026-11-13', 'pending', '曹红英', '硬件故障', '管路接头渗水', '', 0, 0, '', '', '', '', ''],
    ['M-018', 'D-025', '报废处置', '停用设备报废送修', '2026-11-25', 'pending', '崔新根', '硬件故障', '传感器读数长期漂移', '', 0, 0, '', '', '', '', ''],
    ['M-019', 'D-013', '故障维修', '桨叶磨损检修更换', '2026-11-10', 'processing', '邓小华', '硬件故障', '桨叶磨损振动异常', '', 5, 0, '2026-11-10 08:30', '', '已领用备用桨叶 2 对', '', ''],
    ['M-020', 'D-020', '校准检定', '电子秤计量检定', '2026-11-21', 'pending', '程名高', '配置错误', '', '', 0, 0, '', '', '', '', ''],
    /* 已闭环故障维修（用于 MTBF / MTTR / 可用率口径统计） */
    ['M-021', 'D-001', '故障维修', '风向传感器轴承卡滞更换', '2026-08-14', 'completed', '朱泉龙', '硬件故障', '风向数据长时间不变', 6, 6, 240, '2026-08-14 09:10', '2026-08-14 15:10', '更换风向传感器轴承，数据恢复', '风向传感器轴承 ×1', '惠加宁'],
    ['M-022', 'D-005', '故障维修', '网络交换机端口更换', '2026-09-22', 'completed', '陈小忠', '网络通信', '画面偶发卡顿', 4, 4, 150, '2026-09-22 10:00', '2026-09-22 14:00', '更换交换机端口，码流稳定', '千兆交换机 ×1', '黄忠坚'],
    ['M-023', 'D-023', '故障维修', '通信模块更换', '2026-07-08', 'completed', '李建明', '网络通信', '设备通信失败', 8, 8, 360, '2026-07-08 08:40', '2026-07-08 16:40', '更换 4G 通信模块，恢复在线', '4G 通信模块 ×1', '徐水应'],
    ['M-024', 'D-019', '故障维修', '门禁控制器电源更换', '2026-06-16', 'completed', '周才贵', '供电异常', '门禁间歇性掉线', 3, 3, 120, '2026-06-16 13:20', '2026-06-16 16:20', '更换 12V 电源适配器', '电源适配器 ×1', '刘全国'],
    ['M-025', 'D-017', '故障维修', '工控机硬盘更换与系统恢复', '2026-05-09', 'completed', '惠加宁', '硬件故障', '磁盘空间不足且出现坏道', 12, 12, 480, '2026-05-09 08:00', '2026-05-09 20:00', '更换 1TB SSD，系统与模型重建', 'SSD 1TB ×1', '惠加宁'],
    ['M-026', 'D-029', '故障维修', '图传天线更换', '2026-10-12', 'completed', '毛定卫', '硬件故障', '图传信号弱，架次频繁中断', 2, 2, 90, '2026-10-12 14:00', '2026-10-12 16:00', '更换图传天线，链路恢复正常', '图传天线 ×1', '邓小华']
  ];

  function buildMaintainSeed() {
    return MAINTAIN_SEED.map(function (r) {
      return {
        id: r[0], deviceId: r[1], type: r[2], content: r[3], planDate: r[4],
        status: r[5], manager: r[6], faultType: r[7], faultDesc: r[8],
        downtime: r[9], workHours: r[10], cost: r[11],
        startTime: r[12], endTime: r[13], result: r[14],
        parts: r[15], acceptor: r[16], outsourced: '',
        priority: 'normal', remark: '', createdAt: stampNow()
      };
    });
  }

  /* ---- 5.6 设备日志 ---- */
  var LOG_SEED = [
    ['L001', '2026-11-10 08:12:15', 'D-001', 'info', '数据采集', '设备', '数据采集完成，湿度值：28.5%', 'airHum', '28.5', 'TR-20261110-0001'],
    ['L002', '2026-11-10 08:10:05', 'D-021', 'warn', '异常事件', '设备', '灌溉流量低于预期，当前值：35L/min', 'flowRate', '35', 'TR-20261110-0002'],
    ['L003', '2026-11-10 08:02:40', 'D-001', 'info', '数据采集', '设备', '气象数据同步完成，温度：22.5℃，湿度：65%', 'airTemp', '22.5', 'TR-20261110-0003'],
    ['L004', '2026-11-10 07:58:12', 'D-017', 'error', '异常事件', '设备', '磁盘空间不足，剩余空间：2.3GB', 'diskFree', '2.3', 'TR-20261110-0004'],
    ['L005', '2026-11-10 07:45:30', 'D-004', 'info', '通信交互', '网关', '录像存储正常，剩余空间：500GB', '', '', 'TR-20261110-0005'],
    ['L006', '2026-11-10 07:30:22', 'D-003', 'debug', '数据采集', '设备', '图像处理完成，识别到 12 只害虫', 'insectCnt', '12', 'TR-20261110-0006'],
    ['L007', '2026-11-10 07:22:11', 'D-002', 'info', '数据采集', '设备', '数据上报完成，土壤温度：19.8℃', 'soilTemp', '19.8', 'TR-20261110-0007'],
    ['L008', '2026-11-09 22:05:18', 'D-005', 'error', '异常事件', '设备', '设备离线，通信中断', '', '', 'TR-20261109-0031'],
    ['L009', '2026-11-09 18:40:02', 'D-006', 'info', '数据采集', '设备', 'CO₂ 浓度监测正常：420ppm', 'co2', '420', 'TR-20261109-0028'],
    ['L010', '2026-11-09 16:22:44', 'D-009', 'info', '数据采集', '设备', '风速数据更新：8.2m/s', 'windSpeed', '8.2', 'TR-20261109-0024'],
    ['L011', '2026-11-09 14:10:05', 'D-010', 'warn', '异常事件', '设备', '传感器校准偏差，建议检查', '', '', 'TR-20261109-0019'],
    ['L012', '2026-11-09 11:35:50', 'D-019', 'error', '异常事件', '设备', '设备离线，无法获取数据', '', '', 'TR-20261109-0012'],
    ['L013', '2026-11-09 10:02:33', 'D-002', 'info', '数据采集', '设备', 'pH 值检测完成：6.5', 'soilPh', '6.5', 'TR-20261109-0009'],
    ['L014', '2026-11-09 08:14:20', 'D-007', 'debug', '通信交互', '网关', '网络连接状态检查完成，正常', '', '', 'TR-20261109-0004'],
    ['L015', '2026-11-09 08:00:02', 'D-013', 'info', '控制指令', '平台', '任务下发成功，架次 SO-20261109-001', '', '', 'TR-20261109-0003'],
    ['L016', '2026-11-09 07:44:16', 'D-011', 'info', '数据采集', '设备', '库内温度采集完成：2.4℃', 'storeTemp', '2.4', 'TR-20261109-0002'],
    ['L017', '2026-11-08 20:15:30', 'D-024', 'warn', '异常事件', '设备', '电池电量低于 50%，当前：45%', 'batteryLevel', '45', 'TR-20261108-0026'],
    ['L018', '2026-11-08 16:05:41', 'D-008', 'info', '控制指令', '平台', '水肥配比完成，开始灌溉', '', '', 'TR-20261108-0019'],
    ['L019', '2026-11-08 09:22:12', 'D-023', 'error', '异常事件', '设备', '设备通信失败，重试中…', '', '', 'TR-20261108-0007'],
    ['L020', '2026-11-07 12:00:00', 'D-016', 'info', '配置变更', '平台', '自检完成，设备正常', '', '', 'TR-20261107-0015']
  ];

  function buildLogSeed() {
    return LOG_SEED.map(function (r) {
      return {
        id: r[0], time: r[1], deviceId: r[2], level: r[3], type: r[4],
        source: r[5], content: r[6], point: r[7], value: r[8], traceId: r[9],
        status: 'pending', handler: '', handleTime: '', raw: ''
      };
    });
  }

  /* ---- 5.7 校准检定 ---- */
  var CALIBRATION_SEED = [
    ['CAL-001', 'D-001', '例行校准', '2026-09-18', '2026-09-18', '张才孙', '惠加宁', 'pass', '温度 / 湿度 / 风速三要素校准', '合格', '2027-09-18', ''],
    ['CAL-002', 'D-002', '计量检定', '2026-08-20', '2026-08-20', '刘全国', '黄忠坚', 'pass', '三层土壤水分探头标定 + 第三方检定证书', '合格', '2027-08-20', 'CAL-JS-2026-0812'],
    ['CAL-003', 'D-011', '计量检定', '2026-09-02', '2026-09-02', '叶三东', '黄忠坚', 'pass', '冷库温度计精度检定', '合格', '2027-09-02', 'CAL-JS-2026-0907'],
    ['CAL-004', 'D-020', '计量检定', '2026-07-15', '2026-07-15', '程名高', '黄忠坚', 'pass', '电子秤第三方计量检定', '合格', '2027-07-15', 'CAL-JS-2026-0711'],
    ['CAL-005', 'D-022', '例行校准', '2026-08-10', '2026-08-10', '方超', '李建明', 'pass', 'pH / EC 电极校准', '合格', '2027-08-10', ''],
    ['CAL-006', 'D-006', '例行校准', '2026-06-25', '2026-06-25', '曹红英', '李建明', 'pass', 'CO₂ 传感器零点校准', '合格', '2027-06-25', ''],
    ['CAL-007', 'D-003', '例行校准', '2025-11-20', '2025-11-20', '邓小华', '徐水应', 'expired', '虫情识别相机标定', '不合格', '2026-11-20', ''],
    ['CAL-008', 'D-009', '例行校准', '2026-10-08', '2026-10-08', '周成友', '黄忠坚', 'pass', '风速风向传感器校准', '合格', '2027-10-08', '']
  ];

  function buildCalibrationSeed() {
    return CALIBRATION_SEED.map(function (r) {
      return {
        id: r[0], deviceId: r[1], type: r[2], planDate: r[3], actualDate: r[4],
        operator: r[5], reviewer: r[6], result: r[7], content: r[8],
        conclusion: r[9], nextDate: r[10], certificate: r[11],
        deviation: '', remark: '', createdAt: stampNow()
      };
    });
  }

  /* ---- 5.8 备品备件 ---- */
  var SPARE_SEED = [
    ['SP-001', '土壤水分探头', 'TS-PROBE-300', '托普云农', '个', 12, 8, 5, 480, '土壤墒情仪'],
    ['SP-002', 'pH 电极', 'PH-ELEC-200', '托普云农', '个', 8, 5, 3, 620, '土壤墒情仪'],
    ['SP-003', 'EC 电极', 'EC-ELEC-200', '托普云农', '个', 6, 4, 2, 580, '土壤墒情仪'],
    ['SP-004', '蓄电池 12V 100Ah', 'BAT-12V100', '南都电源', '块', 10, 6, 4, 780, '供电设备'],
    ['SP-005', '太阳能板 100W', 'SP-100W', '数农智果', '块', 6, 4, 2, 320, '供电设备'],
    ['SP-006', '摄像机球机', 'DS-2DE7A', '海康威视', '台', 3, 2, 1, 2380, '监控摄像头'],
    ['SP-007', '电磁阀 2 寸', 'SV-2INCH', '大疆农业', '个', 20, 12, 8, 180, '灌溉控制器'],
    ['SP-008', '过滤器滤芯', 'FLT-75M', '大疆农业', '个', 15, 10, 6, 220, '水肥一体化控制机'],
    ['SP-009', '无人机桨叶', 'T50-PROPS', '大疆农业', '对', 8, 4, 2, 260, '植保无人机'],
    ['SP-010', '无人机智能电池', 'T50-BAT-2', '大疆农业', '块', 6, 3, 2, 1580, '植保无人机'],
    ['SP-011', '温湿度探头', 'TH-200', '数农智果', '个', 10, 7, 5, 260, '仓储环境传感器'],
    ['SP-012', '杀虫灯灯管', 'IL-TUBE-18W', '数农智果', '支', 14, 9, 6, 48, '杀虫灯'],
    ['SP-013', '网关心跳天线', 'ANT-4G-700', '数农智果', '个', 5, 3, 2, 180, '智能网关'],
    ['SP-014', '水肥机泵体密封圈', 'WF-SEAL-KIT', '大疆农业', '套', 9, 6, 4, 340, '水肥一体化控制机']
  ];

  function buildSpareSeed() {
    return SPARE_SEED.map(function (r) {
      var unit = r[4], stock = r[5], safe = r[6], used = r[7];
      return {
        id: r[0], name: r[1], model: r[2], vendor: r[3], unit: unit,
        stock: stock, safetyStock: safe, used: used, price: r[8],
        deviceType: r[9], location: '中心仓库', supplier: r[3],
        remark: '', updatedAt: stampNow()
      };
    });
  }

  /* ---- 5.9 资产盘点 ---- */
  var ASSET_SEED = [
    ['AC-20261101', '2026 年 11 月设备盘点', '2026-11-01', '2026-11-05', 'done', '惠加宁', 25, 25, 0, '全部设备账实相符', ''],
    ['AC-20261001', '2026 年 10 月设备盘点', '2026-10-01', '2026-10-04', 'abnormal', '黄忠坚', 25, 23, 2, 'D-005、D-019 现场未找到，疑似已拆除', '待核实']
  ];

  function buildAssetSeed() {
    return ASSET_SEED.map(function (r) {
      return {
        id: r[0], name: r[1], startDate: r[2], endDate: r[3], status: r[4],
        owner: r[5], total: r[6], checked: r[7], abnormal: r[8],
        summary: r[9], remark: r[10],
        details: [], createdAt: stampNow()
      };
    });
  }

  /* ---- 5.10 远程指令 ---- */
  var COMMAND_SEED = [
    ['CMD-20261110-001', 'D-008', '参数下发', '2026-11-10 08:40', 'success', '惠加宁', '目标 EC 下调至 1.8mS/cm', '设备离线，指令未送达'],
    ['CMD-20261109-003', 'D-013', '采集指令', '2026-11-09 08:00', 'success', '毛定卫', '执行机库晨间自检并上传飞参', ''],
    ['CMD-20261108-002', 'D-021', '远程重启', '2026-11-08 16:20', 'failed', '危红卫', '控制器异常重启', '网关链路抖动，指令超时'],
    ['CMD-20261107-001', 'D-007', '固件升级', '2026-11-07 23:00', 'success', '惠加宁', '网关固件升级至 V4.1.0', ''],
    ['CMD-20261106-004', 'D-011', '参数下发', '2026-11-06 10:15', 'success', '张才孙', '冷库设定温度调整为 2℃', '']
  ];

  function buildCommandSeed() {
    return COMMAND_SEED.map(function (r) {
      return {
        id: r[0], deviceId: r[1], type: r[2], createTime: r[3], status: r[4],
        operator: r[5], content: r[6], remark: r[7],
        finishTime: r[4] === 'pending' ? '' : stampNow()
      };
    });
  }

  /* ---- 5.11 物模型字典（可在后台维护，默认取自 DEVICE_TYPE_DICT） ---- */
  function buildModelSeed() {
    return DEVICE_TYPE_DICT.map(function (t) {
      return {
        code: t.code, name: t.name, category: t.category, categoryText: TYPE_CATEGORY_TEXT[t.category] || '其他',
        access: t.access, control: t.control, asset: t.asset,
        maintainCycle: t.maintainCycle, calibrateCycle: t.calibrateCycle,
        way: t.way.slice(), points: clone(t.points), desc: t.desc,
        enabled: true, updatedAt: stampNow()
      };
    });
  }

  /* ============================================================
   * 6. 读写与广播
   * ============================================================ */

  var subscribers = [];
  var inMemory = null;
  var preloadTriggered = false;   // 是否已触发过后端预加载

  function defaults() {
    return {
      version: 4,
      access: buildAccessSeed(),
      gateways: buildGatewaySeed(),
      cameras: buildCameraSeed(),
      devices: buildDeviceSeed(),
      maintains: buildMaintainSeed(),
      logs: buildLogSeed(),
      calibrations: buildCalibrationSeed(),
      spares: buildSpareSeed(),
      assets: buildAssetSeed(),
      commands: buildCommandSeed(),
      models: buildModelSeed(),
      audits: [],
      updatedAt: new Date().toISOString()
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return null;
      return obj;
    } catch (e) {
      // 数据损坏：备份后回落到种子数据，避免整页白屏
      try { localStorage.setItem(STORAGE_KEY + '_corrupt_' + Date.now(), localStorage.getItem(STORAGE_KEY) || ''); } catch (e2) { /* ignore */ }
      return null;
    }
  }

  function save() {
    try {
      if (inMemory) inMemory.updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemory));
      // 后端持久化（异步、不阻塞 UI；失败静默，下次 load 时以库为准）
      persistToBackend(inMemory);
      return true;
    } catch (e) {
      console.warn('[DeviceStore] 保存失败', e);
      return false;
    }
  }

  function ensure() {
    if (inMemory) return inMemory;
    var stored = load();
    var base = defaults();
    // 种子结构变更时提升版本号，旧缓存整体重置，避免新增字段/记录不生效
    if (stored && num(stored.version) >= 4) {
      Object.keys(base).forEach(function (k) {
        if (stored[k] === undefined) stored[k] = base[k];
      });
      stored.version = 4;
      inMemory = stored;
      migrate();
    } else {
      inMemory = base;
      save();
    }
    // 首次加载后，异步从后端预加载真实数据（后端可用时覆盖内存）
    if (!preloadTriggered) {
      preloadTriggered = true;
      setTimeout(function () { preloadFromBackend(); }, 0);
    }
    return inMemory;
  }

  /** 旧版本数据迁移：把中文设备类型归一到标准 code */
  function migrate() {
    var changed = false;
    var d = ensure();
    (d.devices || []).forEach(function (x) {
      if (x.type && TYPE_BY_NAME[x.type] && x.type !== TYPE_BY_NAME[x.type]) {
        x.type = TYPE_BY_NAME[x.type]; changed = true;
      }
      if (x.type && !typeOf(x.type)) { x.type = 'env_sensor'; changed = true; }
    });
    (d.access || []).forEach(function (x) {
      if (x.deviceType && TYPE_BY_NAME[x.deviceType] && x.deviceType !== TYPE_BY_NAME[x.deviceType]) {
        x.deviceType = TYPE_BY_NAME[x.deviceType]; changed = true;
      }
    });
    if (changed) save();
  }

  /* ============================================================
   * 6.1 后端桥接层（策略 A 出入口映射）
   * --------------------------------------------------------------
   * 把 localStorage 持久化替换为 MySQL（经 server/ 聚合接口）。
   * 页面调用的同步 API（devices()/upsertDevice() 等）保持不变；
   * 本层只负责两件事：
   *   - preloadFromBackend()：启动时异步拉取 13 张表 → 组装 → 替换 inMemory
   *   - persistToBackend()：save() 时异步把聚合对象推送到后端（全量 upsert）
   * 后端不可用或未登录时自动回退到 localStorage，保证原型仍可运行。
   * ============================================================ */

  var backendReady = false;      // 后端桥接是否已启用
  var backendLoadPromise = null; // 预加载 Promise（防重入）

  function backendApi() {
    // 依赖全局 Api（common/js/api.js）与 DeviceMapper（device-mapper.js）
    if (typeof global.Api !== 'function' && typeof global.Api !== 'object') return null;
    if (!global.Api.get || !global.Api.create) return null;
    if (typeof global.DeviceMapper === 'undefined') return null;
    return global.Api;
  }

  /** 是否应启用后端持久化：已登录 + api.js 可用 */
  function backendEnabled() {
    var api = backendApi();
    if (!api) return false;
    try { return !!api.isLoggedIn(); } catch (e) { return false; }
  }

  /** 预加载：从后端拉取聚合数据，成功后替换内存并通知
   *  必须等依赖（Api / DeviceMapper）加载完成后再发起，否则映射层未就绪会静默失败。 */
  function preloadFromBackend() {
    if (backendLoadPromise) return backendLoadPromise;
    backendLoadPromise = Promise.resolve(depsReady).then(function () {
      var api = backendApi();
      if (!api || !api.isLoggedIn || !api.isLoggedIn()) return { ok: false, message: '未登录或依赖未就绪' };
      return api.get('device/aggregate');
    }).then(function (res) {
      if (res && res.ok && res.data) {
        var agg = global.DeviceMapper.toAggregate(res.data);
        inMemory = agg;
        backendReady = true;
        // 缓存外键字典（base/plot），供后续保存时把名称解析为自增 id
        global.DeviceStore._refs = res.data.refs || null;
        // 同步写回 localStorage，保持离线兜底
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemory)); } catch (e) { /* ignore */ }
        notify('backend-sync');
      } else if (res && res._unauthorized) {
        backendReady = false;
      }
      return res;
    }).catch(function (err) {
      console.warn('[DeviceStore] 后端预加载失败，回退本地缓存', err);
      backendReady = false;
      return { ok: false, message: err && err.message };
    }).finally(function () {
      backendLoadPromise = null;
    });
    return backendLoadPromise;
  }

  /** 持久化：把聚合对象全量推送到后端（防抖，合并连续写） */
  var persistTimer = null;
  var persistPending = null;
  function persistToBackend(agg) {
    // 记录待持久化对象（浅引用即可，持久化时再序列化）
    persistPending = agg;
    if (persistTimer) return; // 已排队，等待合并
    persistTimer = setTimeout(function () {
      persistTimer = null;
      var snapshot = persistPending;
      persistPending = null;
      if (!snapshot) return;
      // 等依赖（Api / DeviceMapper）就绪后再推送，避免映射层缺失导致写入丢失
      Promise.resolve(depsReady).then(function () {
        var api = backendApi();
        if (!api || !api.isLoggedIn || !api.isLoggedIn()) return null;
        var ctx = global.DeviceMapper.buildContext(global.DeviceStore._refs);
        var payload = global.DeviceMapper.fromAggregate(snapshot, ctx);
        // 带上待删除清单（业务编号数组），后端据此做逻辑删除
        var deletedPayload = takeDeleted();
        payload.deleted = deletedPayload;
        return api.create('device/aggregate', payload).then(function (res) {
          if (res && res.ok) {
            backendReady = true;
            clearDeleted(deletedPayload);
            // 持久化成功后，重新拉取 refs 供后续外键解析（base/plot 可能新增）
            refreshRefs();
          } else if (res && res._unauthorized) {
            backendReady = false;
          } else {
            console.warn('[DeviceStore] 后端持久化失败', res && res.message);
          }
        });
      }).catch(function (err) {
        console.warn('[DeviceStore] 后端持久化异常', err);
      });
    }, 300);
  }

  /** 拉取并缓存外键 refs（base/plot），供 save 时解析外键 */
  function refreshRefs() {
    Promise.resolve(depsReady).then(function () {
      var api = backendApi();
      if (!api || !api.get) return null;
      return api.get('device/aggregate').then(function (res) {
        if (res && res.ok && res.data && res.data.refs) {
          global.DeviceStore._refs = res.data.refs;
        }
      });
    }).catch(function () { /* ignore */ });
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
    } catch (e) { /* ignore */ }
  }

  /* ============================================================
   * 7. 类型字典查询
   * ============================================================ */

  function typeOf(code) {
    var c = text(code);
    if (!c) return null;
    var hit = DEVICE_TYPE_DICT.filter(function (t) { return t.code === c; })[0];
    if (hit) return hit;
    var alias = TYPE_ALIAS[c];
    if (alias) return DEVICE_TYPE_DICT.filter(function (t) { return t.code === alias; })[0];
    var byName = TYPE_BY_NAME[c];
    if (byName) return DEVICE_TYPE_DICT.filter(function (t) { return t.code === byName; })[0];
    return null;
  }

  function typeName(code) {
    var t = typeOf(code);
    return t ? t.name : (text(code) || '未知类型');
  }

  function typeList(onlyAccess) {
    var d = ensure();
    var models = d.models || [];
    var src = models.length ? models : DEVICE_TYPE_DICT;
    return src.filter(function (m) { return !onlyAccess || m.access; })
      .map(function (m) {
        return {
          code: m.code, name: m.name, category: m.category,
          categoryText: m.categoryText || (TYPE_CATEGORY_TEXT[m.category] || '其他'),
          access: m.access, control: m.control, asset: m.asset,
          maintainCycle: m.maintainCycle, calibrateCycle: m.calibrateCycle,
          way: (m.way || []).slice(), points: clone(m.points || []), desc: m.desc || '',
          enabled: m.enabled !== false
        };
      });
  }

  function dataPointsOf(type) {
    var t = typeOf(type);
    if (!t) return [];
    var d = ensure();
    var m = (d.models || []).filter(function (x) { return x.code === t.code; })[0];
    return clone(m && m.points && m.points.length ? m.points : t.points);
  }

  function accessWaysOf(type) {
    var t = typeOf(type);
    if (!t) return ['MQTT'];
    return (t.way || []).slice();
  }

  /* ============================================================
   * 8. 汇总计算
   * ============================================================ */

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
      pointTotal: d.access.reduce(function (s, x) { return s + (x.points || []).length; }, 0),
      linked: d.access.filter(function (x) { return !!x.deviceId; }).length
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
      capacity: d.gateways.reduce(function (s, x) { return s + (x.maxDevices || 0); }, 0),
      used: d.access.filter(function (x) { return !!x.gatewayId; }).length
    };
  }

  function cameraSummary() {
    var d = ensure();
    return {
      total: d.cameras.length,
      online: d.cameras.filter(function (x) { return x.status === 'online'; }).length,
      warning: d.cameras.filter(function (x) { return x.status === 'warning'; }).length,
      offline: d.cameras.filter(function (x) { return x.status === 'offline'; }).length,
      ptz: d.cameras.filter(function (x) { return x.ptz; }).length,
      linked: d.cameras.filter(function (x) { return !!x.deviceId; }).length
    };
  }

  function deviceSummary() {
    var d = ensure();
    var byType = {};
    var byBase = {};
    d.devices.forEach(function (x) {
      byType[x.type] = (byType[x.type] || 0) + 1;
      byBase[x.base] = (byBase[x.base] || 0) + 1;
    });
    var inuse = d.devices.filter(function (x) { return x.assetStatus === 'inuse'; });
    return {
      total: d.devices.length,
      online: d.devices.filter(function (x) { return x.status === 'online'; }).length,
      maintain: d.devices.filter(function (x) { return x.status === 'maintain'; }).length,
      offline: d.devices.filter(function (x) { return x.status === 'offline'; }).length,
      inuse: inuse.length,
      idle: d.devices.filter(function (x) { return x.assetStatus === 'idle'; }).length,
      repair: d.devices.filter(function (x) { return x.assetStatus === 'repair'; }).length,
      scrapped: d.devices.filter(function (x) { return x.assetStatus === 'scrapped'; }).length,
      typeCount: Object.keys(byType).length,
      baseCount: Object.keys(byBase).length,
      byType: byType,
      byBase: byBase,
      totalAmount: d.devices.reduce(function (s, x) { return s + num(x.purchaseAmount); }, 0),
      avgOnlineRate: d.devices.length
        ? Math.round(d.devices.reduce(function (s, x) { return s + num(x.onlineRate); }, 0) / d.devices.length * 10) / 10
        : 0
    };
  }

  function maintainSummary() {
    var d = ensure();
    return {
      total: d.maintains.length,
      pending: d.maintains.filter(function (x) { return x.status === 'pending'; }).length,
      processing: d.maintains.filter(function (x) { return x.status === 'processing'; }).length,
      completed: d.maintains.filter(function (x) { return x.status === 'completed'; }).length,
      cancelled: d.maintains.filter(function (x) { return x.status === 'cancelled'; }).length,
      cost: d.maintains.reduce(function (s, x) { return s + num(x.cost); }, 0),
      workHours: d.maintains.reduce(function (s, x) { return s + num(x.workHours); }, 0),
      downtime: d.maintains.reduce(function (s, x) { return s + num(x.downtime); }, 0)
    };
  }

  function logSummary() {
    var d = ensure();
    var byLevel = { info: 0, warn: 0, error: 0, debug: 0 };
    d.logs.forEach(function (x) { byLevel[x.level] = (byLevel[x.level] || 0) + 1; });
    var byType = {};
    d.logs.forEach(function (x) { byType[x.type] = (byType[x.type] || 0) + 1; });
    return {
      total: d.logs.length,
      byLevel: byLevel, byType: byType,
      error: byLevel.error || 0,
      warn: byLevel.warn || 0,
      pending: d.logs.filter(function (x) { return x.status === 'pending'; }).length
    };
  }

  function calibrationSummary() {
    var d = ensure();
    var today = todayStr();
    return {
      total: d.calibrations.length,
      pass: d.calibrations.filter(function (x) { return x.result === 'pass'; }).length,
      failed: d.calibrations.filter(function (x) { return x.result === 'failed'; }).length,
      expired: d.calibrations.filter(function (x) { return x.result === 'expired'; }).length,
      dueSoon: d.calibrations.filter(function (x) {
        return x.nextDate && daysBetween(today, x.nextDate) >= 0 && daysBetween(today, x.nextDate) <= 30;
      }).length,
      overdue: d.calibrations.filter(function (x) {
        return x.nextDate && daysBetween(x.nextDate, today) > 0;
      }).length
    };
  }

  function spareSummary() {
    var d = ensure();
    return {
      total: d.spares.length,
      inStock: d.spares.filter(function (x) { return num(x.stock) > num(x.safetyStock); }).length,
      low: d.spares.filter(function (x) {
        return num(x.stock) <= num(x.safetyStock) && num(x.stock) > 0;
      }).length,
      out: d.spares.filter(function (x) { return num(x.stock) <= 0; }).length,
      value: d.spares.reduce(function (s, x) { return s + num(x.stock) * num(x.price); }, 0)
    };
  }

  /* ============================================================
   * 9. 运行统计（在线率 / 完好率 / 稼动率 / MTBF / MTTR）
   * ============================================================ */

  function healthOf(deviceId) {
    var d = ensure();
    var dev = d.devices.filter(function (x) { return x.id === deviceId; })[0];
    if (!dev) return null;
    var t = typeOf(dev.type);
    var ms = d.maintains.concat(mobileMaintains(d)).filter(function (x) { return x.deviceId === deviceId; });
    var completed = ms.filter(function (x) { return x.status === 'completed'; });
    var repairMs = completed.filter(function (x) { return x.type === '故障维修'; });
    var totalDowntime = ms.reduce(function (s, x) { return s + num(x.downtime); }, 0);
    var totalHours = num(dev.runningHours);
    var avail = totalHours + totalDowntime > 0
      ? (totalHours / (totalHours + totalDowntime)) * 100 : 0;
    var mttr = repairMs.length
      ? Math.round(repairMs.reduce(function (s, x) { return s + num(x.downtime); }, 0) / repairMs.length * 10) / 10
      : 0;
    var mtbf = repairMs.length && totalHours > 0
      ? Math.round(totalHours / repairMs.length * 10) / 10 : 0;
    // 完好率：设备无未闭环故障即视为完好
    var openFault = ms.filter(function (x) {
      return (x.status === 'pending' || x.status === 'processing') && x.type === '故障维修';
    }).length;
    var intact = openFault === 0 ? 100 : Math.max(60, 100 - openFault * 12);
    // 下次保养到期天数
    var nextMaintain = dev.nextMaintainDate || '';
    var dueIn = nextMaintain ? daysBetween(todayStr(), nextMaintain) : null;
    return {
      deviceId: deviceId,
      name: dev.name,
      type: dev.type,
      typeName: typeName(dev.type),
      status: dev.status,
      statusText: RUN_STATUS_TEXT[dev.status] || dev.status,
      onlineRate: num(dev.onlineRate),
      uptimeRate: num(dev.uptimeRate),
      availability: Math.round(avail * 10) / 10,
      intact: intact,
      mtbf: mtbf,
      mttr: mttr,
      faultCount: num(dev.faultCount),
      maintainCount: ms.length,
      completedCount: completed.length,
      totalDowntime: totalDowntime,
      workHours: ms.reduce(function (s, x) { return s + num(x.workHours); }, 0),
      cost: ms.reduce(function (s, x) { return s + num(x.cost); }, 0),
      openFault: openFault,
      maintainCycle: t ? t.maintainCycle : 0,
      calibrateCycle: t ? t.calibrateCycle : 0,
      nextMaintainDate: nextMaintain,
      dueInDays: dueIn,
      overdue: dueIn !== null && dueIn < 0
    };
  }

  /** 合并移动端维护申请（smartorchard_maintenance_logs），避免移动端报修游离在维保台账之外 */
  function mobileMaintains(d) {
    var logs = [];
    try { logs = JSON.parse(localStorage.getItem('smartorchard_maintenance_logs') || '[]'); } catch (e) { logs = []; }
    if (!Array.isArray(logs) || !logs.length) return [];
    var known = {};
    (d.maintains || []).forEach(function (x) { known[x.id] = true; });
    return logs.map(function (l) {
      var id = 'MB-' + (l.id || l.createTime || '');
      if (known[id]) return null;
      var dev = (d.devices || []).filter(function (x) { return x.name === l.device || x.id === l.device; })[0];
      return {
        id: id, deviceId: dev ? dev.id : '', type: '故障维修',
        content: l.reason || '移动端报修',
        planDate: String(l.createTime || '').slice(0, 10),
        status: 'pending', manager: '待派单',
        faultType: l.urgencyText || '移动端提交', faultDesc: l.reason || '',
        downtime: 0, workHours: 0, cost: 0,
        startTime: '', endTime: '', result: '',
        source: 'mobile', mobileId: l.id || ''
      };
    }).filter(Boolean);
  }

  function stats() {
    var d = ensure();
    var devices = d.devices;
    var total = devices.length;
    var online = devices.filter(function (x) { return x.status === 'online'; }).length;
    var maintain = devices.filter(function (x) { return x.status === 'maintain'; }).length;
    var offline = devices.filter(function (x) { return x.status === 'offline'; }).length;
    var inuse = devices.filter(function (x) { return x.assetStatus === 'inuse'; });
    var avgOnlineRate = total ? devices.reduce(function (s, x) { return s + num(x.onlineRate); }, 0) / total : 0;
    var avgUptimeRate = total ? devices.reduce(function (s, x) { return s + num(x.uptimeRate); }, 0) / total : 0;
    var ms = d.maintains.concat(mobileMaintains(d));
    var completed = ms.filter(function (x) { return x.status === 'completed'; });
    var repairs = completed.filter(function (x) { return x.type === '故障维修'; });
    var totalDowntime = ms.reduce(function (s, x) { return s + num(x.downtime); }, 0);
    var totalHours = devices.reduce(function (s, x) { return s + num(x.runningHours); }, 0);
    var mttr = repairs.length
      ? Math.round(repairs.reduce(function (s, x) { return s + num(x.downtime); }, 0) / repairs.length * 10) / 10 : 0;
    var mtbf = repairs.length && totalHours > 0
      ? Math.round(totalHours / repairs.length * 10) / 10 : 0;
    var intactDevices = devices.filter(function (x) {
      return !ms.some(function (m) {
        return m.deviceId === x.id && (m.status === 'pending' || m.status === 'processing') && m.type === '故障维修';
      });
    }).length;
    var byType = {};
    devices.forEach(function (x) {
      var k = x.type;
      if (!byType[k]) byType[k] = { type: k, name: typeName(k), total: 0, online: 0, fault: 0, hours: 0 };
      byType[k].total++;
      if (x.status === 'online') byType[k].online++;
      byType[k].fault += num(x.faultCount);
      byType[k].hours += num(x.runningHours);
    });
    var byBase = {};
    devices.forEach(function (x) {
      if (!byBase[x.base]) byBase[x.base] = { base: x.base, total: 0, online: 0, fault: 0, amount: 0 };
      byBase[x.base].total++;
      if (x.status === 'online') byBase[x.base].online++;
      byBase[x.base].fault += num(x.faultCount);
      byBase[x.base].amount += num(x.purchaseAmount);
    });
    return {
      total: total, online: online, maintain: maintain, offline: offline,
      inuse: inuse.length,
      onlineRate: total ? Math.round(online / total * 1000) / 10 : 0,
      avgOnlineRate: Math.round(avgOnlineRate * 10) / 10,
      avgUptimeRate: Math.round(avgUptimeRate * 10) / 10,
      availability: (totalHours + totalDowntime) > 0
        ? Math.round(totalHours / (totalHours + totalDowntime) * 1000) / 10 : 0,
      intactRate: total ? Math.round(intactDevices / total * 1000) / 10 : 0,
      mtbf: mtbf, mttr: mttr,
      maintainTotal: ms.length,
      maintainCompleted: completed.length,
      totalDowntime: totalDowntime,
      totalCost: ms.reduce(function (s, x) { return s + num(x.cost); }, 0),
      totalAmount: devices.reduce(function (s, x) { return s + num(x.purchaseAmount); }, 0),
      byType: Object.keys(byType).map(function (k) { return byType[k]; })
        .sort(function (a, b) { return b.total - a.total; }),
      byBase: Object.keys(byBase).map(function (k) { return byBase[k]; })
        .sort(function (a, b) { return b.total - a.total; })
    };
  }

  /* 驾驶舱分类：大屏 7 类 + 其他，统一由设备类型字典派生 */
  var DASHBOARD_CATEGORIES = [
    { key: 'weather', name: '气象站', types: ['weather_station', 'env_sensor', 'air_quality'] },
    { key: 'lamp', name: '杀虫灯', types: ['insect_lamp'] },
    { key: 'water', name: '水肥一体机', types: ['water_fertilizer', 'irrigation_controller'] },
    { key: 'camera', name: '监控摄像头', types: ['camera', 'ipc'] },
    { key: 'drone', name: '植保无人机', types: ['drone', 'drone_hangar'] },
    { key: 'soil', name: '土壤传感器', types: ['soil_sensor', 'store_sensor'] },
    { key: 'pest', name: '虫情测报灯', types: ['pest_monitor'] }
  ];

  /**
   * 驾驶舱分类汇总：在线/总数/在线率，最后追加“其他设备”保证分项合计等于台账总数
   * @returns {Array<{key,name,types,total,online,rate}>}
   */
  function dashboardSummary() {
    var list = ensure().devices;
    var mapped = {};
    var out = DASHBOARD_CATEGORIES.map(function (c) {
      c.types.forEach(function (t) { mapped[t] = 1; });
      var items = list.filter(function (x) { return c.types.indexOf(x.type) >= 0; });
      var online = items.filter(function (x) { return x.status === 'online'; }).length;
      return {
        key: c.key, name: c.name, types: c.types.slice(),
        total: items.length, online: online,
        rate: items.length ? Math.round(online / items.length * 1000) / 10 : 0
      };
    });
    var rest = list.filter(function (x) { return !mapped[x.type]; });
    if (rest.length) {
      var restOnline = rest.filter(function (x) { return x.status === 'online'; }).length;
      out.push({
        key: 'other', name: '其他设备', types: [],
        total: rest.length, online: restOnline,
        rate: Math.round(restOnline / rest.length * 1000) / 10
      });
    }
    return out;
  }

  /* ---------------- 环境 / 土壤实况汇总（大屏、移动端共用） ---------------- */

  var ENV_TYPES = ['weather_station', 'env_sensor', 'air_quality'];
  var SOIL_TYPES = ['soil_sensor'];

  /**
   * 环境实况：取气象站/环境站测点均值
   * @returns {{airTemp,airHum,light,rainfall,windSpeed,surfaceTemp,sampleCount,stationTotal,updatedAt,bases}}
   */
  function envSummary() {
    var all = ensure().devices;
    var stations = all.filter(function (x) { return ENV_TYPES.indexOf(x.type) >= 0; });
    var valid = stations.filter(function (x) { return x.readings && typeof x.readings === 'object'; });
    var keys = ['airTemp', 'airHum', 'light', 'rainfall', 'windSpeed', 'surfaceTemp'];
    var sum = {}, cnt = {};
    keys.forEach(function (k) { sum[k] = 0; cnt[k] = 0; });
    var updatedAt = '', bases = {};
    valid.forEach(function (d) {
      var r = d.readings || {};
      keys.forEach(function (k) {
        var v = Number(r[k]);
        if (isFinite(v)) { sum[k] += v; cnt[k]++; }
      });
      if (d.lastSeenAt && d.lastSeenAt > updatedAt) updatedAt = d.lastSeenAt;
      if (d.base) bases[d.base] = 1;
    });
    function avg(k) { return cnt[k] ? Math.round(sum[k] / cnt[k] * 10) / 10 : null; }
    return {
      airTemp: avg('airTemp'), airHum: avg('airHum'), light: avg('light'),
      rainfall: avg('rainfall'), windSpeed: avg('windSpeed'), surfaceTemp: avg('surfaceTemp'),
      sampleCount: valid.length, stationTotal: stations.length,
      updatedAt: updatedAt,
      bases: Object.keys(bases)
    };
  }

  /**
   * 土壤实况：取土壤传感器测点均值（EC 保持 mS/cm 原始读数）
   * @returns {{soilTemp,soilMoist,soilEc,soilPh,sampleCount,sensorTotal,updatedAt,bases}}
   */
  function soilSummary() {
    var all = ensure().devices;
    var sensors = all.filter(function (x) { return SOIL_TYPES.indexOf(x.type) >= 0; });
    var valid = sensors.filter(function (x) { return x.readings && typeof x.readings === 'object'; });
    var keys = ['soilTemp', 'soilMoist', 'soilEc', 'soilPh'];
    var sum = {}, cnt = {};
    keys.forEach(function (k) { sum[k] = 0; cnt[k] = 0; });
    var updatedAt = '', bases = {};
    valid.forEach(function (d) {
      var r = d.readings || {};
      keys.forEach(function (k) {
        var v = Number(r[k]);
        if (isFinite(v)) { sum[k] += v; cnt[k]++; }
      });
      if (d.lastSeenAt && d.lastSeenAt > updatedAt) updatedAt = d.lastSeenAt;
      if (d.base) bases[d.base] = 1;
    });
    function avg(k, p) {
      if (!cnt[k]) return null;
      var f = Math.pow(10, p == null ? 1 : p);
      return Math.round(sum[k] / cnt[k] * f) / f;
    }
    return {
      soilTemp: avg('soilTemp'), soilMoist: avg('soilMoist'),
      soilEc: avg('soilEc', 2), soilPh: avg('soilPh', 2),
      sampleCount: valid.length, sensorTotal: sensors.length,
      updatedAt: updatedAt,
      bases: Object.keys(bases)
    };
  }

  /* ============================================================
   * 10. 校验器
   * ============================================================ */

  /**
   * 通用校验：返回 { ok, message }
   * entity: device / access / gateway / camera / maintain / log / calibration / spare / asset / command
   */
  function validate(entity, item, id) {
    var d = ensure();
    var e = text(entity);
    var name = text(item && item.name);
    var idVal = text(id || (item && item.id));

    function dupIn(listName, field, value, excludeId) {
      return (d[listName] || []).some(function (x) {
        return x.id !== excludeId && text(x[field]) === text(value);
      });
    }

    if (e === 'device') {
      if (!name) return { ok: false, message: '请填写设备名称' };
      if (!item.type || !typeOf(item.type)) return { ok: false, message: '请选择有效的设备类型' };
      if (!item.base) return { ok: false, message: '请选择所属基地' };
      if (item.plotId && !plots().some(function (p) { return p.code === item.plotId; })) {
        return { ok: false, message: '所属地块不存在，请重新选择' };
      }
      if (item.plotId) {
        var p = plots().filter(function (x) { return x.code === item.plotId; })[0];
        if (p && p.base && item.base && p.base !== item.base) {
          return { ok: false, message: '地块「' + plotLabel(item.plotId) + '」不属于基地「' + item.base + '」' };
        }
      }
      if (dupIn('devices', 'name', name, idVal)) return { ok: false, message: '设备名称「' + name + '」已存在' };
      if (item.id && dupIn('devices', 'id', item.id, idVal)) return { ok: false, message: '设备编号「' + item.id + '」已存在' };
      if (item.sn && dupIn('devices', 'sn', item.sn, idVal)) return { ok: false, message: '设备 SN「' + item.sn + '」已存在' };
      if (item.installDate && !isDate(item.installDate)) return { ok: false, message: '安装日期格式不正确' };
      if (item.enableDate && item.installDate && isDate(item.installDate) && isDate(item.enableDate)
        && Date.parse(item.enableDate) < Date.parse(item.installDate)) {
        return { ok: false, message: '启用日期不能早于安装日期' };
      }
      if (item.assetStatus === 'scrapped' && !item.disposalWay) {
        return { ok: false, message: '报废设备必须选择处置方式' };
      }
      if (item.purchaseAmount !== undefined && num(item.purchaseAmount) < 0) {
        return { ok: false, message: '采购金额不能为负数' };
      }
    }

    if (e === 'access') {
      if (!name) return { ok: false, message: '请填写设备名称' };
      if (!item.deviceType || !typeOf(item.deviceType)) return { ok: false, message: '请选择有效的设备类型' };
      var t = typeOf(item.deviceType);
      if (t && !t.access) return { ok: false, message: '设备类型「' + t.name + '」不支持 IoT 接入' };
      if (!item.base) return { ok: false, message: '请选择所属基地' };
      if (!item.endpoint) return { ok: false, message: '请填写接入地址' };
      if (!item.freq) return { ok: false, message: '请选择采集频率' };
      var timeout = num(item.timeout);
      if (timeout <= 0) return { ok: false, message: '心跳超时必须大于 0 秒' };
      // 采集频率不得慢于超时时间，否则必然误判离线
      var freqMin = { '实时': 0, '1分钟': 1, '10分钟': 10, '15分钟': 15, '30分钟': 30, '1小时': 60, '每日': 1440 }[item.freq];
      if (freqMin !== undefined && freqMin > timeout / 60) {
        return { ok: false, message: '采集频率「' + item.freq + '」慢于心跳超时（' + timeout + ' 秒），请调高超时或降低频率' };
      }
      if (!item.points || !item.points.length) return { ok: false, message: '请至少勾选 1 个采集测点' };
      var valid = dataPointsOf(item.deviceType).map(function (p) { return p.key; });
      var bad = (item.points || []).filter(function (k) { return valid.indexOf(k) === -1; });
      if (bad.length) return { ok: false, message: '存在不属于「' + typeName(item.deviceType) + '」的测点：' + bad.join('、') };
      if (item.gatewayId && !d.gateways.some(function (g) { return g.id === item.gatewayId; })) {
        return { ok: false, message: '所属网关不存在，请重新选择' };
      }
      if (item.deviceId && !d.devices.some(function (x) { return x.id === item.deviceId; })) {
        return { ok: false, message: '关联的台账设备编号不存在：' + item.deviceId };
      }
      if (item.deviceId && dupIn('access', 'deviceId', item.deviceId, idVal)) {
        return { ok: false, message: '该台账设备已存在接入配置，请直接编辑' };
      }
    }

    if (e === 'gateway') {
      if (!name) return { ok: false, message: '请填写网关名称' };
      if (!item.ip) return { ok: false, message: '请填写 IP 地址' };
      var port = num(item.port);
      if (port <= 0 || port > 65535) return { ok: false, message: '端口需在 1~65535 之间' };
      if (!item.topicPrefix) return { ok: false, message: '请填写 Topic 前缀' };
      if (num(item.heartbeat) <= 0) return { ok: false, message: '心跳周期必须大于 0 秒' };
      if (num(item.maxDevices) <= 0) return { ok: false, message: '最大接入设备数必须大于 0' };
      var used = d.access.filter(function (x) { return x.gatewayId === idVal; }).length;
      if (used > num(item.maxDevices)) {
        return { ok: false, message: '当前已挂载 ' + used + ' 个设备，超出最大接入数 ' + item.maxDevices };
      }
    }

    if (e === 'camera') {
      if (!name) return { ok: false, message: '请填写通道名称' };
      if (!item.code) return { ok: false, message: '请填写设备编码' };
      if (!item.url) return { ok: false, message: '请填写取流地址' };
      if (!/^rtsp:\/\/|^rtmp:\/\/|^https:\/\//.test(text(item.url))) {
        return { ok: false, message: '取流地址需以 rtsp:// / rtmp:// / https:// 开头' };
      }
      if (!item.base) return { ok: false, message: '请选择所属基地' };
      if (dupIn('cameras', 'code', item.code, idVal)) return { ok: false, message: '设备编码「' + item.code + '」已存在' };
      if (item.deviceId && !d.devices.some(function (x) { return x.id === item.deviceId; })) {
        return { ok: false, message: '关联的台账设备编号不存在：' + item.deviceId };
      }
    }

    if (e === 'maintain') {
      if (!item.deviceId) return { ok: false, message: '请选择设备' };
      if (!d.devices.some(function (x) { return x.id === item.deviceId; })) {
        return { ok: false, message: '所选设备不存在' };
      }
      if (!item.type) return { ok: false, message: '请选择维护类型' };
      if (!item.content) return { ok: false, message: '请填写维护内容' };
      if (!isDate(item.planDate)) return { ok: false, message: '请选择计划时间' };
      if (!item.manager) return { ok: false, message: '请选择负责人' };
      if (item.type === '故障维修' && !item.faultType) {
        return { ok: false, message: '故障维修必须选择故障分类' };
      }
      if (item.status === 'completed') {
        if (!isDate(item.planDate)) return { ok: false, message: '缺少计划时间' };
        if (!item.result) return { ok: false, message: '已完成的工单必须填写处理结果' };
        if (!item.acceptor) return { ok: false, message: '已完成的工单必须填写验收人' };
      }
      if (item.status === 'processing' && !item.startTime) {
        return { ok: false, message: '进行中的工单必须填写实际开始时间' };
      }
    }

    if (e === 'calibration') {
      if (!item.deviceId) return { ok: false, message: '请选择设备' };
      if (!d.devices.some(function (x) { return x.id === item.deviceId; })) {
        return { ok: false, message: '所选设备不存在' };
      }
      if (!isDate(item.planDate)) return { ok: false, message: '请选择计划校准日期' };
      if (!item.operator) return { ok: false, message: '请填写校准人' };
      if (item.result && item.result !== 'pending' && !item.conclusion) {
        return { ok: false, message: '请填写校准结论' };
      }
    }

    if (e === 'spare') {
      if (!name) return { ok: false, message: '请填写备件名称' };
      if (!item.model) return { ok: false, message: '请填写备件型号' };
      if (num(item.stock) < 0) return { ok: false, message: '库存数量不能为负数' };
      if (num(item.safetyStock) < 0) return { ok: false, message: '安全库存不能为负数' };
      if (num(item.price) < 0) return { ok: false, message: '单价不能为负数' };
      if (dupIn('spares', 'model', item.model, idVal)) return { ok: false, message: '备件型号「' + item.model + '」已存在' };
    }

    if (e === 'command') {
      if (!item.deviceId) return { ok: false, message: '请选择目标设备' };
      if (!d.devices.some(function (x) { return x.id === item.deviceId; })) {
        return { ok: false, message: '所选设备不存在' };
      }
      if (!item.type) return { ok: false, message: '请选择指令类型' };
      if (!item.content) return { ok: false, message: '请填写指令内容' };
      var dev = d.devices.filter(function (x) { return x.id === item.deviceId; })[0];
      var dt = dev ? typeOf(dev.type) : null;
      if (dt && !dt.control && item.type !== '固件升级' && item.type !== '采集指令') {
        return { ok: false, message: '设备类型「' + dt.name + '」不支持控制类指令' };
      }
      if (dt && !dt.control && item.type === '固件升级') {
        return { ok: false, message: '设备类型「' + dt.name + '」不支持固件升级' };
      }
    }

    if (e === 'asset') {
      if (!name) return { ok: false, message: '请填写盘点单名称' };
      if (!isDate(item.startDate)) return { ok: false, message: '请选择盘点开始日期' };
      if (isDate(item.endDate) && isDate(item.startDate) && Date.parse(item.endDate) < Date.parse(item.startDate)) {
        return { ok: false, message: '盘点结束日期不能早于开始日期' };
      }
    }

    return { ok: true, message: '' };
  }

  /* ============================================================
   * 11. 通用 upsert / remove
   * ============================================================ */

  /**
   * 实体名 → (列表键, ID 前缀)
   * 列表键必须与 defaults() 中的实际键一致，否则取不到种子数据会生成重复 ID。
   */
  var ID_PREFIX = {
    access:     { list: 'access',     prefix: 'AC-' },
    gateway:    { list: 'gateways',   prefix: 'GW-' },
    camera:     { list: 'cameras',    prefix: 'VC-' },
    device:     { list: 'devices',    prefix: 'D-' },
    maintain:   { list: 'maintains',  prefix: 'M-' },
    log:        { list: 'logs',       prefix: 'L' },
    calibration:{ list: 'calibrations', prefix: 'CAL-' },
    spare:      { list: 'spares',     prefix: 'SP-' },
    asset:      { list: 'assets',     prefix: 'AC-' },
    command:    { list: 'commands',   prefix: 'CMD-' }
  };

  function nextId(entity) {
    var d = ensure();
    var cfg = ID_PREFIX[entity];
    if (!cfg) return '';
    var list = d[cfg.list] || [];

    // 日期型编号：在固定前缀后追加序号，序号只统计同前缀的记录
    function seqOf(head, width) {
      var max = 0;
      list.forEach(function (x) {
        var s = String(x.id || '');
        if (s.indexOf(head) !== 0) return;
        var n = parseInt(s.slice(head.length), 10);
        if (!isNaN(n) && n > max) max = n;
      });
      return head + String(max + 1).padStart(width, '0');
    }

    if (entity === 'command') {
      return seqOf('CMD-' + todayStr().replace(/-/g, '') + '-', 3);
    }
    if (entity === 'asset') {
      // 资产盘点单号按「年月 + 序号」，避免与门禁接入编号 AC-001 冲突
      return seqOf('AC-' + todayStr().replace(/-/g, '').slice(0, 6), 2);
    }

    var max = 0;
    list.forEach(function (x) {
      var m = String(x.id || '').match(/(\d+)\s*$/);
      if (m) { var n = parseInt(m[1], 10); if (n > max) max = n; }
    });
    return cfg.prefix + String(max + 1).padStart(3, '0');
  }

  function upsert(listName, item) {
    var d = ensure();
    var list = d[listName];
    if (!list) return false;
    var idx = list.findIndex(function (x) { return x.id === item.id; });
    if (idx >= 0) list[idx] = Object.assign({}, list[idx], item);
    else list.push(item);
    broadcast(listName + ':' + item.id);
    return true;
  }

  function remove(listName, id) {
    var d = ensure();
    var existed = d[listName].some(function (x) { return x.id === id; });
    if (!existed) return false;
    d[listName] = d[listName].filter(function (x) { return x.id !== id; });
    markDeleted(listName, id);
    broadcast(listName + '-remove:' + id);
    return true;
  }

  /* ============================================================
   * 12. 审计日志
   * ============================================================ */

  function addAudit(action, entity, entityId, summary, before, after) {
    var d = ensure();
    d.audits.unshift({
      id: 'AUD-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      time: stampFull(),
      action: action,          // create / update / delete / status
      entity: entity,          // device / access / gateway / camera / maintain ...
      entityId: entityId || '',
      operator: '当前用户',
      summary: summary || '',
      before: before || null,
      after: after || null
    });
    if (d.audits.length > 500) d.audits = d.audits.slice(0, 500);
    save();
    notify('audit');
  }

  /* ============================================================
   * 13. 对外 API
   * ============================================================ */

  var DeviceStore = {
    STORAGE_KEY: STORAGE_KEY,

    /* 字典 */
    DEVICE_TYPE_DICT: DEVICE_TYPE_DICT,
    TYPE_CATEGORY_TEXT: TYPE_CATEGORY_TEXT,
    CATEGORY_COLOR: CATEGORY_COLOR,
    ACCESS_TYPES: ACCESS_TYPES,

    RUN_STATUS_TEXT: RUN_STATUS_TEXT,
    ASSET_STATUS_TEXT: ASSET_STATUS_TEXT,
    ACCESS_STATUS_TEXT: ACCESS_STATUS_TEXT,
    GW_STATUS_TEXT: GW_STATUS_TEXT,
    CAM_STATUS_TEXT: CAM_STATUS_TEXT,
    MAINTAIN_STATUS_TEXT: MAINTAIN_STATUS_TEXT,
    MAINTAIN_TYPES: MAINTAIN_TYPES,
    FAULT_TYPES: FAULT_TYPES,
    LOG_LEVELS: LOG_LEVELS,
    LOG_LEVEL_TEXT: LOG_LEVEL_TEXT,
    LOG_TYPES: LOG_TYPES,
    LOG_SOURCES: LOG_SOURCES,
    SPARE_STATUS_TEXT: SPARE_STATUS_TEXT,
    ASSET_CHECK_STATUS_TEXT: ASSET_CHECK_STATUS_TEXT,
    COMMAND_STATUS_TEXT: COMMAND_STATUS_TEXT,
    COMMAND_TYPES: COMMAND_TYPES,
    DISPOSAL_WAYS: DISPOSAL_WAYS,

    /* 类型查询 */
    typeOf: typeOf,
    typeName: typeName,
    typeList: typeList,
    dataPointsOf: dataPointsOf,
    accessWaysOf: accessWaysOf,

    /* 读取 */
    lastUpdatedAt: function () { return ensure().updatedAt || ''; },
    accessConfigs: function () { return clone(ensure().access); },
    gateways: function () { return clone(ensure().gateways); },
    cameras: function () { return clone(ensure().cameras); },
    devices: function () { return clone(ensure().devices); },
    maintains: function () { return clone(ensure().maintains.concat(mobileMaintains(ensure()))); },
    logs: function () { return clone(ensure().logs); },
    calibrations: function () { return clone(ensure().calibrations); },
    spares: function () { return clone(ensure().spares); },
    assets: function () { return clone(ensure().assets); },
    commands: function () { return clone(ensure().commands); },
    models: function () { return clone(ensure().models); },
    audits: function () { return clone(ensure().audits); },

    deviceOf: function (id) {
      var hit = ensure().devices.filter(function (x) { return x.id === id; })[0];
      return hit ? clone(hit) : null;
    },
    /* 设备最近一次上报值（目前用于冷库温控仪派生仓储温湿度） */
    readingsOf: function (id) {
      var hit = ensure().devices.filter(function (x) { return x.id === id; })[0];
      if (!hit || !hit.readings) return null;
      if (hit.status === 'offline') return null;
      return clone(hit.readings);
    },
    /* 按设备类型取第一台在线且有上报值的设备 */
    readingDeviceOfType: function (type) {
      var hit = ensure().devices.filter(function (x) {
        return x.type === type && x.status === 'online' && !!x.readings;
      })[0];
      return hit ? { device: clone(hit), readings: clone(hit.readings) } : null;
    },
    accessOfDevice: function (deviceId) {
      var hit = ensure().access.filter(function (x) { return x.deviceId === deviceId; })[0];
      return hit ? clone(hit) : null;
    },
    cameraOfDevice: function (deviceId) {
      var hit = ensure().cameras.filter(function (x) { return x.deviceId === deviceId; })[0];
      return hit ? clone(hit) : null;
    },
    maintainsOfDevice: function (deviceId) {
      return clone(ensure().maintains.filter(function (x) { return x.deviceId === deviceId; }));
    },

    /* 汇总 */
    accessSummary: accessSummary,
    gatewaySummary: gatewaySummary,
    cameraSummary: cameraSummary,
    deviceSummary: deviceSummary,
    maintainSummary: maintainSummary,
    logSummary: logSummary,
    calibrationSummary: calibrationSummary,
    spareSummary: spareSummary,
    stats: stats,
    dashboardSummary: dashboardSummary,
    envSummary: envSummary,
    soilSummary: soilSummary,
    dashboardCategories: DASHBOARD_CATEGORIES,
    healthOf: healthOf,

    /* 外键 */
    bases: bases,
    plots: plots,
    plotLabel: plotLabel,
    nextId: nextId,

    /* 写入 */
    upsertAccess: function (item) { return upsert('access', item); },
    removeAccess: function (id) { return remove('access', id); },
    upsertGateway: function (item) { return upsert('gateways', item); },
    removeGateway: function (id) { return remove('gateways', id); },
    upsertCamera: function (item) { return upsert('cameras', item); },
    removeCamera: function (id) { return remove('cameras', id); },

    upsertDevice: function (item) {
      var d = ensure();
      var idx = d.devices.findIndex(function (x) { return x.id === item.id; });
      var before = idx >= 0 ? clone(d.devices[idx]) : null;
      if (idx >= 0) d.devices[idx] = Object.assign({}, d.devices[idx], item);
      else d.devices.push(item);
      addAudit(idx >= 0 ? 'update' : 'create', 'device', item.id,
        (idx >= 0 ? '修改设备「' : '新增设备「') + item.name + '」', before, clone(item));
      broadcast('device:' + item.id);
      return true;
    },
    removeDevice: function (id) {
      var d = ensure();
      var hit = d.devices.filter(function (x) { return x.id === id; })[0];
      if (!hit) return false;
      d.devices = d.devices.filter(function (x) { return x.id !== id; });
      // 联动清理接入配置与视频通道引用
      var removedAccess = d.access.filter(function (x) { return x.deviceId === id; });
      var removedCamera = d.cameras.filter(function (x) { return x.deviceId === id; });
      d.access = d.access.filter(function (x) { return x.deviceId !== id; });
      d.cameras = d.cameras.filter(function (x) { return x.deviceId !== id; });
      // 记录删除清单，供持久化时通知后端做逻辑删除
      markDeleted('devices', id);
      removedAccess.forEach(function (x) { markDeleted('accesses', x.id); });
      removedCamera.forEach(function (x) { markDeleted('videos', x.id); });
      addAudit('delete', 'device', id, '删除设备「' + hit.name + '」', clone(hit), null);
      broadcast('device-remove:' + id);
      return true;
    },

    upsertMaintain: function (item) {
      var d = ensure();
      var idx = d.maintains.findIndex(function (x) { return x.id === item.id; });
      var before = idx >= 0 ? clone(d.maintains[idx]) : null;
      if (idx >= 0) d.maintains[idx] = Object.assign({}, d.maintains[idx], item);
      else d.maintains.push(item);
      // 回写设备最近维护日期、下次保养日期与故障次数
      var dev = d.devices.filter(function (x) { return x.id === item.deviceId; })[0];
      if (dev) {
        if (item.status === 'completed') {
          dev.lastMaintainDate = item.planDate;
          if (item.type === '故障维修') dev.faultCount = num(dev.faultCount) + 1;
          // 按维保周期推导下次保养日期
          var cycle = num(dev.maintainCycle);
          if (cycle > 0 && isDate(item.planDate)) {
            var due = new Date(item.planDate + 'T00:00:00');
            due.setMonth(due.getMonth() + cycle);
            dev.nextMaintainDate = due.getFullYear() + '-' +
              pad2(due.getMonth() + 1) + '-' + pad2(due.getDate());
          }
        }
        if (item.status === 'processing') dev.status = 'maintain';
        if (item.status === 'completed' && dev.status === 'maintain') dev.status = 'online';
      }
      addAudit(idx >= 0 ? 'update' : 'create', 'maintain', item.id,
        (idx >= 0 ? '修改维护工单「' : '新建维护工单「') + item.id + '」', before, clone(item));
      broadcast('maintain:' + item.id);
      return true;
    },
    removeMaintain: function (id) {
      var d = ensure();
      var hit = d.maintains.filter(function (x) { return x.id === id; })[0];
      d.maintains = d.maintains.filter(function (x) { return x.id !== id; });
      addAudit('delete', 'maintain', id, '删除维护工单「' + id + '」', hit ? clone(hit) : null, null);
      broadcast('maintain-remove:' + id);
      return true;
    },

    appendLog: function (log) {
      var d = ensure();
      var item = Object.assign({
        id: nextId('log'), time: stampFull(), level: 'info', type: '数据采集',
        source: '设备', content: '', point: '', value: '', traceId: '',
        status: 'pending', handler: '', handleTime: '', raw: ''
      }, log || {});
      d.logs.unshift(item);
      if (d.logs.length > 1000) d.logs = d.logs.slice(0, 1000);
      broadcast('log:' + item.id);
      return item;
    },
    clearLogs: function () {
      var d = ensure();
      var n = d.logs.length;
      d.logs = [];
      try { localStorage.setItem('device_log_cleared_at', stampFull()); } catch (e) { /* ignore */ }
      addAudit('delete', 'log', '', '清空设备日志 ' + n + ' 条', null, null);
      broadcast('log-clear');
      return n;
    },
    upsertLog: function (item) { return upsert('logs', item); },

    upsertCalibration: function (item) {
      var d = ensure();
      var idx = d.calibrations.findIndex(function (x) { return x.id === item.id; });
      if (idx >= 0) d.calibrations[idx] = Object.assign({}, d.calibrations[idx], item);
      else d.calibrations.push(item);
      var dev = d.devices.filter(function (x) { return x.id === item.deviceId; })[0];
      if (dev && item.actualDate) dev.lastCalibrateDate = item.actualDate;
      addAudit(idx >= 0 ? 'update' : 'create', 'calibration', item.id,
        '校准记录「' + item.id + '」', null, clone(item));
      broadcast('calibration:' + item.id);
      return true;
    },
    removeCalibration: function (id) {
      remove('calibrations', id);
      addAudit('delete', 'calibration', id, '删除校准记录「' + id + '」', null, null);
      return true;
    },

    upsertSpare: function (item) {
      var d = ensure();
      var idx = d.spares.findIndex(function (x) { return x.id === item.id; });
      if (idx >= 0) d.spares[idx] = Object.assign({}, d.spares[idx], item);
      else d.spares.push(item);
      addAudit(idx >= 0 ? 'update' : 'create', 'spare', item.id,
        (idx >= 0 ? '修改备件「' : '新增备件「') + item.name + '」', null, clone(item));
      broadcast('spare:' + item.id);
      return true;
    },
    removeSpare: function (id) {
      remove('spares', id);
      addAudit('delete', 'spare', id, '删除备件「' + id + '」', null, null);
      return true;
    },
    /** 备件消耗（关联故障维修工单） */
    consumeSpare: function (id, qty, deviceId) {
      var d = ensure();
      var sp = d.spares.filter(function (x) { return x.id === id; })[0];
      if (!sp) return { ok: false, message: '备件不存在' };
      if (num(sp.stock) < num(qty)) {
        return { ok: false, message: '备件「' + sp.name + '」库存不足（当前 ' + sp.stock + ' ' + sp.unit + '）' };
      }
      sp.stock = num(sp.stock) - num(qty);
      sp.used = num(sp.used) + num(qty);
      addAudit('update', 'spare', id, '领用备件「' + sp.name + '」' + qty + ' ' + sp.unit
        + (deviceId ? '（设备 ' + deviceId + '）' : ''), null, clone(sp));
      broadcast('spare:' + id);
      return { ok: true, message: '备件领用成功' };
    },

    upsertAsset: function (item) {
      var d = ensure();
      var idx = d.assets.findIndex(function (x) { return x.id === item.id; });
      if (idx >= 0) d.assets[idx] = Object.assign({}, d.assets[idx], item);
      else d.assets.push(item);
      addAudit(idx >= 0 ? 'update' : 'create', 'asset', item.id,
        (idx >= 0 ? '修改盘点单「' : '新建盘点单「') + item.name + '」', null, clone(item));
      broadcast('asset:' + item.id);
      return true;
    },
    removeAsset: function (id) {
      remove('assets', id);
      addAudit('delete', 'asset', id, '删除盘点单「' + id + '」', null, null);
      return true;
    },

    upsertCommand: function (item) {
      var d = ensure();
      var idx = d.commands.findIndex(function (x) { return x.id === item.id; });
      if (idx >= 0) d.commands[idx] = Object.assign({}, d.commands[idx], item);
      else d.commands.push(item);
      addAudit(idx >= 0 ? 'update' : 'create', 'command', item.id,
        (idx >= 0 ? '修改指令「' : '下发指令「') + item.id + '」', null, clone(item));
      broadcast('command:' + item.id);
      return true;
    },
    removeCommand: function (id) {
      remove('commands', id);
      addAudit('delete', 'command', id, '删除指令记录「' + id + '」', null, null);
      return true;
    },

    upsertModel: function (item) {
      var d = ensure();
      var idx = d.models.findIndex(function (x) { return x.code === item.code; });
      if (idx >= 0) d.models[idx] = Object.assign({}, d.models[idx], item);
      else d.models.push(item);
      addAudit(idx >= 0 ? 'update' : 'create', 'model', item.code,
        (idx >= 0 ? '修改设备类型「' : '新增设备类型「') + item.name + '」', null, clone(item));
      broadcast('model:' + item.code);
      return true;
    },
    removeModel: function (code) {
      var d = ensure();
      var used = d.devices.filter(function (x) { return x.type === code; }).length;
      if (used > 0) {
        return { ok: false, message: '该设备类型已被 ' + used + ' 台设备引用，禁止删除' };
      }
      d.models = d.models.filter(function (x) { return x.code !== code; });
      addAudit('delete', 'model', code, '删除设备类型「' + code + '」', null, null);
      broadcast('model-remove:' + code);
      return { ok: true, message: '已删除' };
    },

    /** 追加审计（供页面调用） */
    audit: function (action, entity, entityId, summary, before, after) {
      addAudit(action, entity, entityId, summary, before, after);
    },

    validate: validate,
    todayStr: todayStr,
    stampNow: stampNow,

    /**
     * 设备状态 → 预警中心同步（幂等）
     * offline → 重要（离线超 24h → 紧急）；maintain / assetStatus=repair → 提醒；
     * 未闭环的故障维修单 → 提醒 / 重要。设备恢复后从清单消失，由 AlertStore 自动闭环。
     */
    syncDeviceAlerts: function () {
      var S = global.AlertStore;
      if (!S || typeof S.syncSource !== 'function') {
        return { ok: false, message: '预警数据层未加载' };
      }
      var now = Date.now();
      var items = [];
      ensure().devices.forEach(function (d) {
        if (d.assetStatus === 'scrapped') return;
        var reason = '', level = '', title = '';
        if (d.status === 'offline') {
          reason = 'offline';
          var seen = d.lastSeenAt ? new Date(String(d.lastSeenAt).replace(/-/g, '/')).getTime() : 0;
          var over24 = seen > 0 && (now - seen > 24 * 3600 * 1000);
          level = over24 ? 'urgent' : 'important';
          title = '设备离线：' + d.name + (over24 ? ' 离线超过 24 小时' : ' 离线');
        } else if (d.status === 'maintain') {
          reason = 'maintain'; level = 'reminder';
          title = '设备维护中：' + d.name;
        } else if (d.assetStatus === 'repair') {
          reason = 'repair'; level = 'reminder';
          title = '设备维修中：' + d.name;
        }
        if (!reason) return;
        items.push({
          dedupeKey: 'device:' + d.id + ':' + reason,
          type: 'device',
          category: 'device',
          title: title,
          desc: (d.base || '') + ' ' + (d.plotId ? ('地块' + d.plotId) : (d.location || '')) +
            '；运行状态：' + (RUN_STATUS_TEXT[d.status] || d.status) +
            '；资产状态：' + (ASSET_STATUS_TEXT[d.assetStatus] || d.assetStatus || ''),
          level: level,
          base: d.base || '',
          plot: d.plotId ? ('地块' + d.plotId) : (d.location || ''),
          plotCode: d.plotId || '',
          device: d.name,
          deviceId: d.id,
          targetType: 'device',
          targetId: d.id
        });
      });
      var devMap = {};
      ensure().devices.forEach(function (d) { devMap[d.id] = d; });
      ensure().maintains.forEach(function (m) {
        if (m.type !== '故障维修') return;
        if (m.status !== 'pending' && m.status !== 'processing') return;
        var d = devMap[m.deviceId] || {};
        items.push({
          dedupeKey: 'device:' + m.deviceId + ':repair-order:' + m.id,
          type: 'device',
          category: 'device',
          title: '设备故障维修：' + (d.name || m.deviceId) + ' - ' + (m.content || m.faultDesc || ''),
          desc: (d.base || '') + ' ' + (d.plotId ? ('地块' + d.plotId) : '') +
            '；维修单 ' + m.id + ' 状态：' + (MAINTAIN_STATUS_TEXT[m.status] || m.status) +
            (m.faultDesc ? '；故障：' + m.faultDesc : ''),
          level: m.status === 'processing' ? 'important' : 'reminder',
          base: d.base || '',
          plot: d.plotId ? ('地块' + d.plotId) : '',
          plotCode: d.plotId || '',
          device: d.name || m.deviceId,
          deviceId: m.deviceId,
          targetType: 'device',
          targetId: m.deviceId
        });
      });
      return S.syncSource('device', items, 'device:');
    },

    subscribe: function (fn) {
      subscribers.push(fn);
      try { fn('init'); } catch (e) { /* ignore */ }
      return function unsubscribe() {
        subscribers = subscribers.filter(function (x) { return x !== fn; });
      };
    },

    reset: function () {
      inMemory = defaults();
      save();
      broadcast('reset');
    },

    /* ---- 后端桥接（策略 A）---- */
    _refs: null,
    preloadFromBackend: preloadFromBackend,
    isBackendReady: function () { return backendReady; },
    persistNow: function () {
      // 立即把当前内存持久化到后端（供测试/手动触发）
      if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
      var snapshot = inMemory;
      if (!snapshot || !backendEnabled()) return Promise.resolve({ ok: false, message: '后端未启用' });
      var api = backendApi();
      var ctx = global.DeviceMapper.buildContext(global.DeviceStore._refs);
      var payload = global.DeviceMapper.fromAggregate(snapshot, ctx);
      return api.create('device/aggregate', payload).then(function (res) {
        if (res && res.ok) { backendReady = true; refreshRefs(); }
        return res;
      });
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
