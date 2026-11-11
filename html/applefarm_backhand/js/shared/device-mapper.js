/**
 * device-mapper.js — 设备模块「store 聚合对象 ↔ 13 张表」映射层
 * --------------------------------------------------------------
 * 策略 A（出入口映射）：store 内部逻辑零改动，只在 load/save 出入口做双向转换。
 *
 * 本文件职责：
 *   1. rowToXxx(tableRow) —— 数据库表行 → store 对象（camelCase）
 *   2. xxxToRow(storeItem) —— store 对象 → 数据库表行（snake_case）
 *   3. 枚举值归一（store 中文 ↔ 表英文 code）
 *   4. 外键还原/解析（base_id/plot_id/device_id/gateway_id/device_type_id ↔ 业务编号）
 *
 * 由 device-store.js 在 load()/save() 中调用，页面对此无感知。
 */
(function (global) {
  'use strict';

  /* ---------- 通用工具 ---------- */
  function text(v) { return String(v == null ? '' : v).trim(); }
  function num(v, def) { var n = parseFloat(v); return isNaN(n) ? (def === undefined ? 0 : def) : n; }
  function toInt(v) { var n = parseInt(v, 10); return isNaN(n) ? null : n; }
  function isDateStr(v) { return /^\d{4}-\d{2}-\d{2}$/.test(text(v)); }
  // 布尔 → 0/1
  function b2i(v) { return v ? 1 : 0; }
  function i2b(v) { return v === 1 || v === '1' || v === true; }
  // 数组 → 逗号串
  function arr2str(arr) {
    if (!Array.isArray(arr)) return text(arr);
    return arr.join(',');
  }
  function str2arr(s) {
    s = text(s);
    return s ? s.split(',') : [];
  }
  // 日期 → 去除时间部分（store 用 'YYYY-MM-DD'，表 DATE 字段）
  function dateOnly(v) {
    if (v == null) return null;
    var s = text(v);
    if (!s) return null;
    var m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }
  // 时间戳：store 'YYYY-MM-DD HH:mm[:ss]' 保留原样，表 DATETIME
  function dt(v) {
    if (v == null) return null;
    var s = text(v);
    return s || null;
  }

  /* ---------- 外键引用解析器（运行时构造，由 load/save 注入） ----------
   * 基地名称归一：store 全称「天水麦积区基地」↔ 表简称「麦积基地」
   * 规则：去掉「天水」前缀 + 去掉「区/县」后缀 → 匹配 sf_base.name
   */
  function normalizeBaseName(full) {
    var s = text(full);
    if (!s) return '';
    return s
      .replace(/^天水/, '')
      .replace(/[区县]基地$/, '基地')
      .replace(/基地$/, '基地');
  }

  /**
   * 构建映射上下文：基于后端聚合接口返回的 refs 建立 id↔编号 互查表。
   * refs = { bases:[{id,code,name}], plots:[{id,code,name,base_id}], ... }
   */
  function buildContext(refs) {
    var ctx = {
      baseIdByName: {},   // 简称/全称 → id
      baseNameById: {},   // id → 简称 name
      baseFullById: {},   // id → 全称（与原型 store 口径一致，供 rowToDevice 反解）
      plotIdByCode: {},   // code → id
      plotCodeById: {},   // id → code
    };
    (refs && refs.bases || []).forEach(function (b) {
      ctx.baseNameById[b.id] = b.name;
      ctx.baseIdByName[b.name] = b.id;
      ctx.baseIdByName[normalizeBaseName(b.name)] = b.id;
      // 简称 → 全称（去「天水」前缀 + 补「区/县」后缀的逆映射，用 code 反推区县）
      ctx.baseFullById[b.id] = b.fullName || fullNameOf(b);
    });
    (refs && refs.plots || []).forEach(function (p) {
      ctx.plotCodeById[p.id] = p.code;
      ctx.plotIdByCode[p.code] = p.id;
    });
    return ctx;
  }

  // 简称 → 全称：区县基地名补全（天水地区 8 基地，与原型 PLOT_FALLBACK 口径一致）
  var BASE_FULL_MAP = {
    '麦积基地': '天水麦积区基地', '秦州基地': '天水秦州区基地',
    '甘谷基地': '天水甘谷县基地', '秦安基地': '天水秦安县基地',
    '清水基地': '天水清水县基地', '武山基地': '天水武山县基地',
    '张川基地': '天水张家川县基地', '陇西基地': '天水陇西县基地',
  };
  function fullNameOf(b) {
    var short = b.name || '';
    if (BASE_FULL_MAP[short]) return BASE_FULL_MAP[short];
    if (/县基地$/.test(short) || /区基地$/.test(short)) return '天水' + short;
    return short;
  }

  /* ============================================================
   * 1. devices ↔ sf_device
   * ============================================================ */
  function rowToDevice(row, ctx) {
    return {
      id: row.device_code,                        // 业务编号
      name: row.device_name || '',
      type: row.device_type || '',
      base: ctx && row.base_id ? (ctx.baseFullById[row.base_id] || ctx.baseNameById[row.base_id] || '') : '',
      plotId: ctx && row.plot_id ? (ctx.plotCodeById[row.plot_id] || '') : '',
      location: row.location || '',
      status: row.run_status || 'offline',        // store 用 status，表用 run_status
      assetStatus: row.asset_status || '',
      vendor: row.vendor || '',
      model: row.model || '',
      sn: row.sn || '',
      firmware: row.firmware || '',
      ip: row.ip || '',
      protocol: row.protocol || '',
      power: row.power || '',
      owner: row.owner || '',
      supplier: row.supplier || '',
      disposalWay: row.disposal_way || '',
      installDate: row.install_date || '',
      enableDate: row.enable_date || '',
      warrantyUntil: row.warranty_until || '',
      purchaseAmount: row.purchase_amount != null ? num(row.purchase_amount) / 10000 : 0, // 元→万元
      usefulYears: row.useful_years != null ? num(row.useful_years) : 0,
      maintainCycle: row.maintain_cycle || '',
      nextMaintainDate: row.next_maintain || '',
      lastMaintainDate: row.last_maintain_date || '',
      calibrateCycle: row.calibrate_cycle || '',
      lastCalibrateDate: row.last_calibrate_date || '',
      runningHours: row.running_hours != null ? num(row.running_hours) : 0,
      faultCount: row.fault_count != null ? num(row.fault_count) : 0,
      onlineRate: row.online_rate != null ? num(row.online_rate) : 0,
      uptimeRate: row.uptime_rate != null ? num(row.uptime_rate) : 0,
      collectCount: row.collect_count != null ? num(row.collect_count) : 0,
      lastSeenAt: row.last_seen_at || '',
      remark: row.remark || '',
      retiredDate: '', disposalWay2: '',
      readings: null,                              // 运行时派生，不落库
      createdAt: row.created_at || '',
      updatedAt: row.updated_at || ''
    };
  }

  function deviceToRow(item, ctx) {
    var row = {
      device_code: item.id,
      device_name: item.name,
      device_type: item.type,
      location: item.location,
      run_status: item.status,
      asset_status: item.assetStatus,
      vendor: item.vendor, model: item.model, sn: item.sn, firmware: item.firmware,
      ip: item.ip, protocol: item.protocol, power: item.power, owner: item.owner,
      supplier: item.supplier, disposal_way: item.disposalWay,
      install_date: dateOnly(item.installDate), enable_date: dateOnly(item.enableDate),
      warranty_until: dateOnly(item.warrantyUntil),
      purchase_amount: item.purchaseAmount != null ? num(item.purchaseAmount) * 10000 : null, // 万元→元
      useful_years: item.usefulYears != null ? num(item.usefulYears) : null,
      maintain_cycle: item.maintainCycle, next_maintain: dateOnly(item.nextMaintainDate),
      last_maintain_date: dateOnly(item.lastMaintainDate), calibrate_cycle: item.calibrateCycle,
      last_calibrate_date: dateOnly(item.lastCalibrateDate),
      running_hours: item.runningHours != null ? num(item.runningHours) : null,
      fault_count: item.faultCount != null ? num(item.faultCount) : 0,
      online_rate: item.onlineRate != null ? num(item.onlineRate) : null,
      uptime_rate: item.uptimeRate != null ? num(item.uptimeRate) : null,
      collect_count: item.collectCount != null ? num(item.collectCount) : 0,
      last_seen_at: dt(item.lastSeenAt),
      remark: item.remark
    };
    // 外键：base 全称/简称 → id；plotId 地块编号 → id
    if (ctx) {
      row.base_id = ctx.baseIdByName[normalizeBaseName(item.base)] || ctx.baseIdByName[item.base] || null;
      row.plot_id = ctx.plotIdByCode[item.plotId] || null;
    }
    return row;
  }

  /* ============================================================
   * 2. accesses ↔ sf_device_access
   * ============================================================ */
  function rowToAccess(row, ctx) {
    return {
      id: row.config_code,
      deviceName: '',                              // 冗余，由 deviceId 关联查
      deviceType: '',
      base: ctx && row.base_id ? (ctx.baseFullById[row.base_id] || ctx.baseNameById[row.base_id] || '') : '',
      accessWay: row.access_way || '',
      gatewayId: '',                              // 由 gateway_id 反解（save 时再解析）
      endpoint: row.access_address || '',
      freq: row.collect_frequency || '',
      timeout: row.timeout != null ? num(row.timeout) : 0,
      points: str2arr(row.measure_points),
      status: mapAccessStatus(row.status),        // connected→online 等（store 语义）
      deviceId: '',                               // 由 device_id 反解
      direction: row.direction || '',
      auth: '', payload: '', model: '', sn: '',
      enabled: true,
      remark: row.remark || '',
      updatedAt: row.updated_at || ''
    };
  }

  function accessToRow(item, ctx) {
    var row = {
      config_code: item.id,
      access_way: item.accessWay,
      access_address: item.endpoint,
      collect_frequency: item.freq,
      timeout: item.timeout != null ? num(item.timeout) : null,
      measure_points: arr2str(item.points),
      status: mapAccessStatusReverse(item.status),
      direction: item.direction,
      remark: item.remark
    };
    if (ctx) {
      row.base_id = ctx.baseIdByName[normalizeBaseName(item.base)] || ctx.baseIdByName[item.base] || null;
      // deviceId / gatewayId 存的是业务编号字符串，由后端聚合接口解析为自增 id
      row.device_id = item.deviceId || null;
      row.gateway_id = item.gatewayId || null;
    }
    return row;
  }
  // 接入状态：store {online, warning, offline} ↔ 表 {connected, abnormal, disconnected}
  function mapAccessStatus(s) {
    return { connected: 'online', abnormal: 'warning', disconnected: 'offline', online: 'online', warning: 'warning', offline: 'offline' }[s] || s || 'offline';
  }
  function mapAccessStatusReverse(s) {
    return { online: 'connected', warning: 'abnormal', offline: 'disconnected', connected: 'connected', abnormal: 'abnormal', disconnected: 'disconnected' }[s] || s || 'disconnected';
  }

  /* ============================================================
   * 3. gateways ↔ sf_gateway
   * ============================================================ */
  function rowToGateway(row) {
    return {
      id: row.gateway_code,
      name: row.gateway_name || '',
      model: row.model || '',
      vendor: row.vendor || '',
      protocol: row.protocol || '',
      ip: row.ip || '',
      port: row.port || '',
      username: row.account || '',
      password: '******',
      topicPrefix: row.topic_prefix || '',
      heartbeat: row.heartbeat != null ? num(row.heartbeat) : 0,
      maxDevices: row.max_device != null ? num(row.max_device) : 0,
      status: mapGwStatus(row.status),
      location: row.location || '',
      remark: row.remark || '',
      sn: row.sn || '',
      firmware: '', uplink: '', spec: '', simCard: '', bandwidth: '', backupHours: '',
      updatedAt: row.updated_at || ''
    };
  }
  function gatewayToRow(item) {
    return {
      gateway_code: item.id,
      gateway_name: item.name,
      model: item.model, vendor: item.vendor, protocol: item.protocol,
      ip: item.ip, port: item.port, account: item.username, topic_prefix: item.topicPrefix,
      heartbeat: item.heartbeat != null ? num(item.heartbeat) : null,
      max_device: item.maxDevices != null ? num(item.maxDevices) : null,
      status: mapGwStatusReverse(item.status),
      location: item.location, remark: item.remark, sn: item.sn
    };
  }
  // 网关状态：store {online, warning, offline} ↔ 表 {running, unstable, offline}
  function mapGwStatus(s) {
    return { running: 'online', unstable: 'warning', offline: 'offline', online: 'online', warning: 'warning' }[s] || s || 'offline';
  }
  function mapGwStatusReverse(s) {
    return { online: 'running', warning: 'unstable', offline: 'offline', running: 'running', unstable: 'unstable' }[s] || s || 'offline';
  }

  /* ============================================================
   * 4. videos ↔ sf_video_channel
   * ============================================================ */
  function rowToVideo(row, ctx) {
    return {
      id: row.channel_code,
      name: row.channel_name || '',
      code: row.device_code || '',
      channel: row.channel_no || '',
      protocol: row.protocol || '',
      platform: row.platform || '',
      url: row.rtsp_url || '',
      resolution: row.resolution || '',
      fps: row.frame_rate || '',
      stream: row.stream || '',
      ptz: i2b(row.has_ptz),
      nightVision: i2b(row.night_vision),
      storageDays: row.retain_days != null ? num(row.retain_days) : 0,
      base: ctx && row.base_id ? (ctx.baseFullById[row.base_id] || ctx.baseNameById[row.base_id] || '') : '',
      location: row.location || '',
      status: mapCamStatus(row.status),
      deviceId: '',                              // 由 device_code 关联，需反查
      form: row.form || '',
      protection: row.protection || '',
      power: row.power || '',
      bitrate: row.bitrate || '',
      aiAbility: row.ai_ability || '',
      audio: i2b(row.has_audio),
      presetCount: row.preset_count != null ? num(row.preset_count) : 0,
      remark: '', updatedAt: row.updated_at || ''
    };
  }
  function videoToRow(item, ctx) {
    var row = {
      channel_code: item.id,
      channel_name: item.name,
      device_code: item.code,
      channel_no: item.channel,
      protocol: item.protocol,
      platform: item.platform,
      rtsp_url: item.url,
      resolution: item.resolution,
      frame_rate: item.fps,
      stream: item.stream,
      has_ptz: b2i(item.ptz),
      night_vision: b2i(item.nightVision),
      retain_days: item.storageDays != null ? num(item.storageDays) : null,
      location: item.location,
      status: mapCamStatusReverse(item.status),
      form: item.form, protection: item.protection, power: item.power, bitrate: item.bitrate,
      ai_ability: item.aiAbility, has_audio: b2i(item.audio),
      preset_count: item.presetCount != null ? num(item.presetCount) : 0
    };
    if (ctx) {
      row.base_id = ctx.baseIdByName[normalizeBaseName(item.base)] || ctx.baseIdByName[item.base] || null;
    }
    return row;
  }
  // 视频状态：store {online, warning, offline} ↔ 表 {online, weak, offline}
  function mapCamStatus(s) {
    return { online: 'online', weak: 'warning', offline: 'offline', warning: 'warning' }[s] || s || 'offline';
  }
  function mapCamStatusReverse(s) {
    return { online: 'online', warning: 'weak', offline: 'offline', weak: 'weak' }[s] || s || 'offline';
  }

  /* ============================================================
   * 5. maintains ↔ sf_device_maintain
   * ============================================================ */
  function rowToMaintain(row) {
    return {
      id: row.maintain_code,
      deviceId: '',                              // 由 device_id 反解（load 时统一回填）
      type: row.maintain_type || '',
      content: row.content || '',
      planDate: dateOnly(row.plan_time) || '',
      status: row.status || 'pending',
      manager: row.manager || '',
      faultType: row.fault_category || '',
      faultDesc: row.fault_desc || '',
      downtime: row.stop_hours != null ? num(row.stop_hours) : 0,
      workHours: row.work_hours != null ? num(row.work_hours) : 0,
      cost: row.cost != null ? num(row.cost) : 0,
      startTime: row.start_time || '',
      endTime: row.end_time || '',
      result: row.result || '',
      parts: row.parts || '',
      acceptor: row.acceptor || '',
      outsourced: row.outsourced || '',
      priority: row.priority || 'normal',
      remark: '', createdAt: row.created_at || ''
    };
  }
  function maintainToRow(item) {
    return {
      maintain_code: item.id,
      maintain_type: item.type,
      fault_category: item.faultType,
      content: item.content,
      fault_desc: item.faultDesc,
      manager: item.manager,
      plan_time: item.planDate ? dt(item.planDate) : null,
      start_time: dt(item.startTime),
      end_time: dt(item.endTime),
      work_hours: item.workHours != null ? num(item.workHours) : null,
      stop_hours: item.downtime != null ? num(item.downtime) : null,
      cost: item.cost != null ? num(item.cost) : null,
      result: item.result, parts: item.parts, acceptor: item.acceptor,
      outsourced: item.outsourced, priority: item.priority || 'normal',
      status: item.status || 'pending',
      device_id: item.deviceId || null   // 业务编号，后端解析
    };
  }

  /* ============================================================
   * 6. logs ↔ sf_device_log
   * ============================================================ */
  function rowToLog(row) {
    return {
      id: row.id != null ? 'L' + String(row.id).padStart(3, '0') : '',  // 无业务编号，用自增 id 伪编号
      _dbId: row.id,
      time: row.log_time || '',
      deviceId: '',                              // 由 device_id 反解
      level: (row.log_level || 'info').toLowerCase(),
      type: row.log_type || '',
      source: row.source || '',
      content: row.content || '',
      point: row.measure_key || '',
      value: row.value || '',
      traceId: row.trace_id || '',
      status: row.handle_status || 'pending',
      handler: row.handler || '', handleTime: row.handle_time || '', raw: ''
    };
  }
  function logToRow(item) {
    return {
      _dbId: item._dbId || null,
      log_time: dt(item.time),
      log_level: (item.level || 'info').toUpperCase(),
      log_type: item.type,
      source: item.source,
      content: item.content,
      measure_key: item.point,
      value: item.value,
      trace_id: item.traceId,
      handle_status: item.status,
      handler: item.handler,
      handle_time: dt(item.handleTime),
      device_id: item.deviceId || null
    };
  }

  /* ============================================================
   * 7. calibrations ↔ sf_device_calibration
   * ============================================================ */
  function rowToCalibration(row) {
    return {
      id: row.calibration_code,
      deviceId: '',
      type: row.calibration_type || '',
      planDate: row.plan_date || '',
      actualDate: row.actual_date || '',
      operator: row.executor || '',
      reviewer: row.reviewer || '',
      result: row.result || '',
      content: row.content || '',
      conclusion: row.conclusion || '',
      nextDate: row.valid_until || '',
      certificate: row.cert_code || '',
      deviation: row.deviation || '',
      remark: '', createdAt: row.created_at || ''
    };
  }
  function calibrationToRow(item) {
    return {
      calibration_code: item.id,
      calibration_type: item.type,
      plan_date: dateOnly(item.planDate),
      actual_date: dateOnly(item.actualDate),
      executor: item.operator, reviewer: item.reviewer,
      result: item.result, content: item.content,
      deviation: item.deviation, conclusion: item.conclusion,
      valid_until: dateOnly(item.nextDate), cert_code: item.certificate,
      device_id: item.deviceId || null
    };
  }

  /* ============================================================
   * 8. spares ↔ sf_device_spare
   * ============================================================ */
  function rowToSpare(row) {
    return {
      id: row.spare_code,
      name: row.spare_name || '',
      model: row.spec || '',
      vendor: row.vendor || '',
      unit: row.unit || '',
      stock: row.current_stock != null ? num(row.current_stock) : 0,
      safetyStock: row.safety_stock != null ? num(row.safety_stock) : 0,
      used: row.used_amount != null ? num(row.used_amount) : 0,
      price: row.price != null ? num(row.price) : 0,
      deviceType: row.applicable_type || '',
      location: row.location || '',
      supplier: row.supplier || '',
      remark: '', updatedAt: row.updated_at || ''
    };
  }
  function spareToRow(item) {
    return {
      spare_code: item.id,
      spare_name: item.name,
      spec: item.model, vendor: item.vendor, supplier: item.supplier,
      applicable_type: item.deviceType, unit: item.unit,
      current_stock: item.stock != null ? num(item.stock) : null,
      safety_stock: item.safetyStock != null ? num(item.safetyStock) : null,
      used_amount: item.used != null ? num(item.used) : null,
      price: item.price != null ? num(item.price) : null,
      location: item.location
    };
  }

  /* ============================================================
   * 9. assets ↔ sf_device_asset
   * ============================================================ */
  function rowToAsset(row) {
    return {
      id: row.asset_code,
      name: row.asset_name || '',
      startDate: row.start_date || '',
      endDate: row.end_date || '',
      status: mapAssetStatus(row.status),
      owner: row.checker || '',
      total: row.should_count != null ? num(row.should_count) : 0,
      checked: row.checked_count != null ? num(row.checked_count) : 0,
      abnormal: row.loss_count != null ? num(row.loss_count) : 0,
      summary: row.summary || '',
      remark: row.remark || '',
      details: [], createdAt: row.created_at || ''
    };
  }
  function assetToRow(item) {
    return {
      asset_code: item.id,
      asset_name: item.name,
      start_date: dateOnly(item.startDate),
      end_date: dateOnly(item.endDate),
      status: mapAssetStatusReverse(item.status),
      checker: item.owner,
      should_count: item.total != null ? num(item.total) : 0,
      checked_count: item.checked != null ? num(item.checked) : 0,
      loss_count: item.abnormal != null ? num(item.abnormal) : 0,
      summary: item.summary, remark: item.remark
    };
  }
  // 盘点状态：store {draft, checking, done, abnormal} ↔ 表 {pending, checking, done, loss}
  function mapAssetStatus(s) {
    return { pending: 'draft', checking: 'checking', done: 'done', loss: 'abnormal', draft: 'draft', abnormal: 'abnormal' }[s] || s || 'draft';
  }
  function mapAssetStatusReverse(s) {
    return { draft: 'pending', checking: 'checking', done: 'done', abnormal: 'loss', pending: 'pending', loss: 'loss' }[s] || s || 'pending';
  }

  /* ============================================================
   * 10. commands ↔ sf_device_command
   * ============================================================ */
  function rowToCommand(row) {
    return {
      id: row.command_code,
      deviceId: '',
      type: row.command_type || '',
      createTime: row.send_time || '',
      status: row.status || 'pending',
      operator: row.operator || '',
      content: row.content || '',
      remark: row.result || '',
      finishTime: ''
    };
  }
  function commandToRow(item) {
    return {
      command_code: item.id,
      command_type: item.type,
      content: item.content,
      operator: item.operator,
      send_time: dt(item.createTime),
      status: item.status || 'pending',
      result: item.remark,
      device_id: item.deviceId || null
    };
  }

  /* ============================================================
   * 11. models ↔ sf_device_type + sf_device_measure（物模型，1:N）
   * ============================================================ */
  function rowToModel(row) {
    return {
      code: row.type_code,
      name: row.type_name || '',
      category: row.category || '',
      categoryText: '',
      access: i2b(row.can_access),
      control: i2b(row.can_control),
      asset: i2b(row.is_asset),
      maintainCycle: row.maintain_cycle || '',
      calibrateCycle: row.calibrate_cycle || '',
      way: [], points: [], desc: '',
      enabled: row.status !== 'disabled',
      updatedAt: row.updated_at || ''
    };
  }
  function modelToRow(item) {
    return {
      type_code: item.code,
      type_name: item.name,
      category: item.category,
      can_access: b2i(item.access),
      can_control: b2i(item.control),
      is_asset: b2i(item.asset),
      maintain_cycle: item.maintainCycle,
      calibrate_cycle: item.calibrateCycle
    };
  }
  function rowToMeasure(row) {
    return {
      _typeId: row.device_type_id,
      key: row.measure_key,
      name: row.measure_name || '',
      unit: row.unit || '',
      step: row.step != null ? num(row.step) : 0,
      min: row.range_min != null ? num(row.range_min) : 0,
      max: row.range_max != null ? num(row.range_max) : 0
    };
  }
  function measureToRow(m, typeCode) {
    return {
      _typeCode: typeCode,
      measure_key: m.key,
      measure_name: m.name,
      unit: m.unit,
      step: m.step != null ? num(m.step) : null,
      range_min: m.min != null ? num(m.min) : null,
      range_max: m.max != null ? num(m.max) : null
    };
  }

  /* ============================================================
   * 12. audits ↔ sf_device_audit
   * ============================================================ */
  function rowToAudit(row) {
    return {
      id: row.id != null ? 'AUD-' + row.id : '',
      _dbId: row.id,
      time: row.operate_time || '',
      action: mapAuditType(row.operate_type),
      entity: row.object_type || '',
      entityId: row.object_code || '',
      operator: row.operator || '',
      summary: row.summary || '',
      before: row.before_data ? JSON.parse(row.before_data) : null,
      after: row.after_data ? JSON.parse(row.after_data) : null
    };
  }
  function auditToRow(item) {
    return {
      _dbId: item._dbId || null,
      operate_time: dt(item.time),
      operate_type: mapAuditTypeReverse(item.action),
      object_type: item.entity,
      object_code: item.entityId,
      operator: item.operator,
      summary: item.summary,
      before_data: item.before ? JSON.stringify(item.before) : null,
      after_data: item.after ? JSON.stringify(item.after) : null
    };
  }
  // 审计类型：store {create/update/delete/status} ↔ 表 {新增/修改/删除/状态变更}
  function mapAuditType(s) {
    return { '新增': 'create', '修改': 'update', '删除': 'delete', '状态变更': 'status', create: 'create', update: 'update', delete: 'delete', status: 'status' }[s] || s || 'update';
  }
  function mapAuditTypeReverse(s) {
    return { create: '新增', update: '修改', delete: '删除', status: '状态变更', '新增': '新增', '修改': '修改', '删除': '删除', '状态变更': '状态变更' }[s] || s || '修改';
  }

  /* ============================================================
   * 组装 / 拆解
   * ============================================================ */

  /**
   * 把聚合接口返回的表数据组装成 store 聚合对象。
   * @param {object} data 聚合接口 data 字段
   */
  function toAggregate(data) {
    var ctx = buildContext(data.refs);
    // 建立 device_id → device_code 反查、gateway_id → gateway_code 反查、type_id → type_code 反查
    var deviceCodeById = {}, gatewayCodeById = {}, typeCodeById = {};
    (data.devices || []).forEach(function (r) { deviceCodeById[r.id] = r.device_code; });
    (data.gateways || []).forEach(function (r) { gatewayCodeById[r.id] = r.gateway_code; });
    (data.device_types || []).forEach(function (r) { typeCodeById[r.id] = r.type_code; });

    // 物模型测点按 device_type_id 分组
    var measuresByType = {};
    (data.measures || []).forEach(function (m) {
      (measuresByType[m.device_type_id] = measuresByType[m.device_type_id] || []).push(m);
    });

    var devices = (data.devices || []).map(function (r) { return rowToDevice(r, ctx); });
    var gateways = (data.gateways || []).map(function (r) { return rowToGateway(r); });

    // access：回填 deviceId / gatewayId / deviceName / deviceType
    var accesses = (data.accesses || []).map(function (r) {
      var a = rowToAccess(r, ctx);
      a.deviceId = r.device_id ? (deviceCodeById[r.device_id] || '') : '';
      a.gatewayId = r.gateway_id ? (gatewayCodeById[r.gateway_id] || '') : '';
      var dev = a.deviceId ? devices.filter(function (d) { return d.id === a.deviceId; })[0] : null;
      if (dev) { a.deviceName = dev.name; a.deviceType = dev.type; }
      return a;
    });

    // video：回填 deviceId（device_code 可能重复，仅记录，不强关联）
    var videos = (data.videos || []).map(function (r) {
      var v = rowToVideo(r, ctx);
      v.deviceId = r.device_code || '';
      return v;
    });

    // maintain / log / calibration / command：回填 deviceId
    var maintains = (data.maintains || []).map(function (r) {
      var m = rowToMaintain(r);
      m.deviceId = r.device_id ? (deviceCodeById[r.device_id] || '') : '';
      return m;
    });
    var logs = (data.logs || []).map(function (r) {
      var l = rowToLog(r);
      l.deviceId = r.device_id ? (deviceCodeById[r.device_id] || '') : '';
      return l;
    });
    var calibrations = (data.calibrations || []).map(function (r) {
      var c = rowToCalibration(r);
      c.deviceId = r.device_id ? (deviceCodeById[r.device_id] || '') : '';
      return c;
    });
    var commands = (data.commands || []).map(function (r) {
      var c = rowToCommand(r);
      c.deviceId = r.device_id ? (deviceCodeById[r.device_id] || '') : '';
      return c;
    });

    var spares = (data.spares || []).map(rowToSpare);
    var assets = (data.assets || []).map(rowToAsset);

    // models：device_type 主表 + measure 子表合并
    var models = (data.device_types || []).map(function (r) {
      var m = rowToModel(r);
      var measures = (measuresByType[r.id] || []).map(rowToMeasure);
      m.points = measures.map(function (mm) {
        return { key: mm.key, name: mm.name, unit: mm.unit, step: mm.step, min: mm.min, max: mm.max };
      });
      return m;
    });

    var audits = (data.audits || []).map(rowToAudit);

    return {
      version: 4,
      access: accesses,
      gateways: gateways,
      cameras: videos,
      devices: devices,
      maintains: maintains,
      logs: logs,
      calibrations: calibrations,
      spares: spares,
      assets: assets,
      commands: commands,
      models: models,
      audits: audits,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * 把 store 聚合对象拆成聚合接口 POST 所需的表行数组。
   * @param {object} agg store 聚合对象（inMemory）
   */
  function fromAggregate(agg, ctx) {
    ctx = ctx || {};
    var out = {
      devices: (agg.devices || []).map(function (x) { return deviceToRow(x, ctx); }),
      accesses: (agg.access || []).map(function (x) { return accessToRow(x, ctx); }),
      gateways: (agg.gateways || []).map(gatewayToRow),
      videos: (agg.cameras || []).map(function (x) { return videoToRow(x, ctx); }),
      maintains: (agg.maintains || []).map(maintainToRow),
      logs: (agg.logs || []).map(logToRow),
      calibrations: (agg.calibrations || []).map(calibrationToRow),
      spares: (agg.spares || []).map(spareToRow),
      assets: (agg.assets || []).map(assetToRow),
      commands: (agg.commands || []).map(commandToRow),
      device_types: (agg.models || []).map(modelToRow),
      audits: (agg.audits || []).map(auditToRow),
      // 物模型测点：每个 model 的 points 拆成一条 measure（带 _typeCode）
      measures: [],
      // 待逻辑删除的业务编号（由 store 记录，缺失会导致删除不落库）
      deleted: agg.deleted || {}
    };
    (agg.models || []).forEach(function (m) {
      (m.points || []).forEach(function (p) {
        out.measures.push(measureToRow(p, m.code));
      });
    });
    return out;
  }

  // 导出
  var mapper = {
    toAggregate: toAggregate,
    fromAggregate: fromAggregate,
    buildContext: buildContext,
    normalizeBaseName: normalizeBaseName,
  };

  global.DeviceMapper = mapper;
  if (typeof module !== 'undefined' && module.exports) module.exports = mapper;
})(typeof window !== 'undefined' ? window : globalThis);
