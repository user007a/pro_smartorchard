/**
 * 后台演示数据播种器（Demo Seed）
 * --------------------------------------------------------------
 * 12 个原本依赖 localStorage 才有数据的菜单页，在空环境下只能看到空态。
 * 本文件集中提供各页的示意数据，并在页面首次访问时写入各自的存储键，
 * 使这些页面开箱即有 23~25 条可读、可筛选、可操作的记录。
 *
 * 设计约定：
 *   1. 幂等：仅在目标键「缺失或为空数组」时写入，绝不覆盖用户已产生的真实数据；
 *   2. 复用既有结构：字段名严格对齐各页读取逻辑与写入方（H5 / 移动端），
 *      不引入各页不认识的字段；
 *   3. 单一开关：DSEED_DISABLED 置为 '1' 可整体关闭播种。
 *
 * 播种范围（键 → 消费页面）：
 *   smartorchard_drone_events      飞行事件        drone_log.html
 *   smartorchard_drone_abnormal    巡检异常        drone_log.html
 *   mb_patrol_routes               巡园路线        patrol_route.html
 *   smartorchard_label_records     标签领用        material_label.html
 *   h5_adoption_photos             成长相册        adoption_photo.html
 *   snzg_adoptions                 认养果树        adoption_cert / adoption_photo / 会员 / H5
 *   adoption_certs                 认养证书        adoption_cert.html
 *   applefarm_data_ops_v1.sources  数据源接入      data_source.html
 *   mall_member_profiles           会员档案        mall_member.html
 *   h5_orders / h5_sales_orders    C 端订单        mall_order.html
 *   h5_community_*                 社区动态        mall_community.html
 *   h5_invoices                    发票申请        mall_invoice.html
 *   smartorchard_expert_questions  专家咨询        mb_expert_reply.html
 *   smartorchard_sync_queue        离线同步队列    mb_sync_queue.html
 *
 * 暴露 API：
 *   DemoSeed.ensure(keys)  播种指定场景（不传则全部播种）
 *   DemoSeed.clear()       清除本播种器写入的所有键
 *   DemoSeed.version       数据版本号，便于演示数据升级时整体刷新
 */

(function (global) {
  'use strict';

  var VERSION = '2026-10-22-v1';

  /* ============================================================
   * 通用工具
   * ============================================================ */

  function isDisabled() {
    try { return localStorage.getItem('DSEED_DISABLED') === '1'; } catch (e) { return true; }
  }

  /** 判断键是否「尚无可用数据」（不存在 / 损坏 / 空数组 / 空对象） */
  function isVacant(key) {
    try {
      var raw = localStorage.getItem(key);
      if (raw === null || raw === undefined) return true;
      var v = JSON.parse(raw);
      if (Array.isArray(v)) return v.length === 0;
      if (v && typeof v === 'object') return Object.keys(v).length === 0;
      return !v;
    } catch (e) {
      return true;   // 损坏数据视为可播种
    }
  }

  /** 仅当键为空时写入，绝不覆盖已有数据 */
  function seed(key, value) {
    if (!isVacant(key)) return false;
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('[DemoSeed] 写入失败：' + key, e);
      return false;
    }
  }

  /** 对象型存储（如 data-store 的 sources）按子键判断是否为空 */
  function seedObjectField(storageKey, field, value) {
    var obj = {};
    try {
      var raw = localStorage.getItem(storageKey);
      obj = raw ? (JSON.parse(raw) || {}) : {};
    } catch (e) { obj = {}; }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) obj = {};

    var cur = obj[field];
    var has = Array.isArray(cur) ? cur.length > 0 : !!cur;
    if (has) return false;

    obj[field] = value;
    try {
      localStorage.setItem(storageKey, JSON.stringify(obj));
      return true;
    } catch (e) {
      console.warn('[DemoSeed] 写入失败：' + storageKey + '.' + field, e);
      return false;
    }
  }

  /** 生成 ISO 时间串，便于 H5 / 后台统一用 new Date() 解析 */
  function iso(y, m, d, hh, mm) {
    return new Date(y, m - 1, d, hh, mm, 0).toISOString();
  }

  /** 生成 'YYYY-MM-DD HH:mm' 本地时间文本（用于按原文展示的表格） */
  function pad2(n) { return String(n).padStart(2, '0'); }
  function ymdhm(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate()) +
      ' ' + pad2(date.getHours()) + ':' + pad2(date.getMinutes());
  }

  /* ============================================================
   * 场景 1：无人机飞行事件（24 条）
   * 结构：{ type:'pause'|'resume'|'return', taskId, progress, text, id, createTime }
   * ============================================================ */
  function droneEvents() {
    var rows = [
      ['pause', 'TASK-001', 32, '检测到阵风超阈值，自动悬停暂停巡检'],
      ['resume', 'TASK-001', 32, '风速回落至安全区间，恢复巡检'],
      ['pause', 'TASK-001', 58, '低电量预警（剩余 22%），暂停等待换电'],
      ['resume', 'TASK-001', 58, '电池更换完成，恢复巡检'],
      ['pause', 'TASK-002', 45, '前方有鸟类聚集，暂停避让'],
      ['return', 'TASK-002', 46, '单电机温度异常，一键返航结束任务'],
      ['pause', 'TASK-003', 15, 'GNSS 信号弱（卫星数 6），暂停悬停搜星'],
      ['resume', 'TASK-003', 16, '卫星数恢复至 12，定位精度达标'],
      ['pause', 'TASK-004', 67, '气象风速达 8 级，超出作业条件暂停'],
      ['return', 'TASK-004', 68, '剩余电量不足 15%，返航至起点充电'],
      ['pause', 'TASK-005', 25, '路径被新增障碍物阻挡，暂停等待重规划'],
      ['resume', 'TASK-005', 26, '航线已重新规划，继续执行'],
      ['pause', 'TASK-006', 80, '摄像头存储写入超时，暂停采集'],
      ['resume', 'TASK-006', 81, '存储链路恢复，继续采集'],
      ['pause', 'TASK-007', 12, '遥控链路信号中断，暂停等待重连'],
      ['return', 'TASK-007', 13, '链路持续丢失，触发失联返航策略'],
      ['pause', 'TASK-008', 55, '温度传感器读数异常（-40℃），暂停核验'],
      ['resume', 'TASK-008', 56, '确认传感器故障并已隔离，继续巡检'],
      ['pause', 'TASK-009', 38, '作业区域有人员进入，暂停避让'],
      ['resume', 'TASK-009', 39, '人员已撤离，恢复巡检'],
      ['pause', 'TASK-010', 71, '电池电量低于返航阈值，暂停'],
      ['return', 'TASK-010', 72, '触发低电量自动返航'],
      ['pause', 'TASK-011', 5, '起飞后自检发现云台未归位，暂停校准'],
      ['resume', 'TASK-011', 6, '云台校准完成，开始正式巡检']
    ];
    return rows.map(function (r, i) {
      // createTime 递减排列，越靠前越新（近 3 天内）
      var base = new Date(2026, 9, 22, 16, 30);
      base.setMinutes(base.getMinutes() - i * 165);
      return {
        id: 'DE' + String(i + 1).padStart(3, '0'),
        type: r[0],
        taskId: r[1],
        progress: r[2],
        text: r[3],
        // 本地时间文本：drone_log 按原文展示，且 isToday() 仍能正确解析
        createTime: ymdhm(base)
      };
    });
  }

  /* ============================================================
   * 场景 2：无人机巡检异常（24 条）
   * 结构：{ id, plot, type, decision, decisionText, createTime }
   * decision：ignore 已忽略 / confirm 已确认·处理中
   * ============================================================ */
  function droneAbnormal() {
    var rows = [
      ['麦积区基地 3号地块', '发现成片红蜘蛛危害，叶面失绿呈斑驳状', 'confirm', '已确认', '严重'],
      ['白水基地 5号地块', '局部叶片出现轮纹病疑似症状', 'confirm', '已确认', '中等'],
      ['宜川基地 2号地块', '果树负载量偏低，坐果率不足三成', 'confirm', '已确认', '中等'],
      ['麦积区基地 7号地块', '行间杂草高度超 30cm，影响通风透光', 'ignore', '已忽略', '轻微'],
      ['招远基地 1号地块', '发现疑似青储虫蛀孔，数量约 12 处', 'confirm', '已确认', '严重'],
      ['招远基地 4号地块', '滴灌带局部破损，末端出水不足', 'confirm', '已确认', '中等'],
      ['天水秦州基地 6号地块', '树势不均，东侧行较西侧行明显偏弱', 'confirm', '已确认', '中等'],
      ['天水福山基地 3号地块', '地面有零星落果，疑似早期落果', 'ignore', '已忽略', '轻微'],
      ['青岛崂山基地 2号地块', '果实日灼斑较多，向阳面果面灼伤', 'confirm', '已确认', '中等'],
      ['潍坊寿光基地 5号地块', '发现疑似炭疽病病斑，已拍照留存', 'confirm', '已确认', '严重'],
      ['临沂沂水基地 1号地块', '行间出现机械碾压痕迹', 'ignore', '已忽略', '轻微'],
      ['泰安肥城基地 4号地块', '园区道路积水，通行受阻', 'ignore', '已忽略', '轻微'],
      ['济宁曲阜基地 3号地块', '树冠郁闭度偏高，内膛枝徒长', 'confirm', '已确认', '中等'],
      ['济南历城基地 6号地块', '部分果实个头偏小，低于预期规格', 'confirm', '已确认', '中等'],
      ['淄博临淄基地 2号地块', '支撑竹竿倾斜，需重新扶正', 'ignore', '已忽略', '轻微'],
      ['东营河口基地 5号地块', '发现果实表面药斑，存在药害风险', 'confirm', '已确认', '严重'],
      ['滨州无棣基地 1号地块', '行间土壤板结，建议深翻松土', 'confirm', '已确认', '中等'],
      ['德州乐陵基地 3号地块', '边界围栏破损，野生动物可能进入', 'confirm', '已确认', '严重'],
      ['聊城高唐基地 4号地块', '部分滴灌带老化开裂', 'ignore', '已忽略', '轻微'],
      ['菏泽曹县基地 2号地块', '果实套袋脱落较多，需重新套袋', 'confirm', '已确认', '中等'],
      ['枣庄滕州基地 6号地块', '发现鸟害啄食痕迹，果面有划伤', 'confirm', '已确认', '中等'],
      ['天水甘谷基地 7号地块', '园区监控设备角度偏移，需现场调整', 'ignore', '已忽略', '轻微'],
      ['金昌城北基地 1号地块', '土壤含水量偏低，建议及时补水', 'confirm', '已确认', '中等'],
      ['天水麦积区基地 8号地块', '新栽品种长势弱，需核查苗木质量', 'confirm', '已确认', '中等']
    ];
    return rows.map(function (r, i) {
      var base = new Date(2026, 9, 22, 15, 10);
      base.setMinutes(base.getMinutes() - i * 190);
      return {
        id: 'DA' + String(i + 1).padStart(3, '0'),
        plot: r[0],
        type: r[1],
        decision: r[2],
        decisionText: r[3],
        severity: r[4],
        createTime: ymdhm(base)
      };
    });
  }

  /* ============================================================
   * 场景 3：巡园路线（24 条）
   * 结构：{ routeId, routeName, base, points[], enabled, remark, updatedAt }
   * base 需落在 patrol_route.html 的下拉选项内
   * ============================================================ */
  function patrolRoutes() {
    var bases = ['麦积区基地 A区', '麦积区基地 B区', '麦积区基地 C区', '白水基地 A区', '宜川基地 A区'];
    var names = [
      '主干道日常巡园', '果实膨大期专项巡检', '病虫害抽检路线', '水肥一体化管段巡查',
      '采收前成熟度巡检', '仓库与冷库安全巡查', '边界围栏巡查', '灾后倒伏排查路线',
      '授粉期坐果率巡检', '疏果作业质量巡查', '套袋质量抽检路线', '农资仓库领用巡查',
      '新栽苗木长势巡查', '滴灌管网泄漏排查', '草生管理效果评估', '土壤墒情监测路线',
      '极端天气后巡查', '采收通道清理巡查', '分级分选线巡查', '冷链温控巡查',
      '认养区块挂牌巡查', '绿色防控示范區巡查', '坡地梯田边界巡查', '全场夜间值守巡查'
    ];
    var remarks = [
      '覆盖三个作业小区，每日必巡', '果实膨大期重点关注果径', '叶片正反面均需拍照留存',
      '检查滴头出水与压力表读数', '按成熟度分级标准抽检', '冷库温控须在 0-4℃',
      '检查围栏完整性与破损点', '重点排查枝干折损与倒伏', '记录花序量与坐果率',
      '抽查疏果负载是否均匀', '检查果袋是否破损脱落', '核对领用台账与实物',
      '关注缓苗期长势差异', '分段测压排查漏点', '评估割草覆盖与天敌数量',
      '每点记录 10cm 与 30cm 墒情', '关注风倒雨后损伤', '保证运输通道畅通',
      '检查设备清洁与人员分工', '记录库温波动曲线', '核对挂牌信息与认养人一致',
      '观察黄板诱杀虫数量变化', '检查梯田护坡与排水', '值守时段重点巡看'
    ];

    var out = [];
    for (var i = 0; i < 24; i++) {
      var base = bases[i % bases.length];
      // 点位数 1~4，部分路线含必到点
      var ptCount = (i % 4) + 1;
      var points = [];
      for (var j = 0; j < ptCount; j++) {
        points.push({
          id: base.charAt(0) + (i + 1) + '-' + (j + 1),
          name: base.replace('基地', '') + ' ' + (i + 1) + '号巡园点' + (j > 0 ? '（' + (j + 1) + '）' : ''),
          lat: Number((34.34800 + i * 0.0021 + j * 0.0018).toFixed(5)),
          lng: Number((106.17900 + i * 0.0024 + j * 0.0020).toFixed(5)),
          nearRadius: [60, 80, 100, 120][(i + j) % 4],
          required: (i + j) % 3 !== 1,
          order: j + 1
        });
      }
      out.push({
        routeId: 'RT-' + String(i + 1).padStart(3, '0'),
        routeName: names[i],
        base: base,
        points: points,
        enabled: i % 6 !== 5,   // 每 6 条停用 1 条，保证启用/停用两种筛选都有数据
        remark: remarks[i],
        updatedAt: '2026-10-' + String(22 - (i % 20)).padStart(2, '0') + ' ' +
          String(8 + (i % 10)).padStart(2, '0') + ':' + String((i * 7) % 60).padStart(2, '0')
      });
    }
    return out;
  }

  /* ============================================================
   * 场景 4：标签领用记录（24 条）
   * 结构：{ name, qty, time, plot, status, remark, id, createTime }
   * name 须与 material_label.html 的 TYPE_SEED 保持一致，
   * 否则打印环节无法扣减库存
   * ============================================================ */
  var LABEL_TYPES = [
    { name: '花牛苹果专用标签（双层纸袋型）', qty: [2000, 1500, 3000, 800], plots: ['麦积区 A区 3号地块', '麦积区 A区 5号地块', '白水 A区 2号地块', '宜川 A区 1号地块'] },
    { name: '花牛苹果专用标签（透气膜袋型）', qty: [1200, 900, 1800, 600], plots: ['麦积区 B区 2号地块', '麦积区 B区 4号地块', '招远 1号地块', '天水秦州 6号地块'] },
    { name: '秦冠专用标签', qty: [800, 600, 1200, 400], plots: ['青岛崂山 2号地块', '潍坊寿光 3号地块', '临沂沂水 5号地块', '泰安肥城 4号地块'] }
  ];

  function labelRecords() {
    var plots = [];
    LABEL_TYPES.forEach(function (t) { plots = plots.concat(t.plots); });
    var remarks = [
      '秋季套袋批次，认养区块优先',
      '出口级果面标识，需加溯源二维码',
      '普通批次，套袋作业队领用',
      '礼盒配套使用，单独编号段',
      '示范园推广批次',
      '补发上次打印损耗部分',
      '',
      '早熟品种专用，标签颜色不同',
      ''
    ];
    var out = [];
    for (var i = 0; i < 24; i++) {
      var t = LABEL_TYPES[i % LABEL_TYPES.length];
      // 状态分布：待打印 / 已打印 / 已驳回 三种筛选均有数据
      var status = i % 8 === 0 ? '已驳回' : (i % 3 === 0 ? '待打印' : '已打印');
      var day = 22 - (i % 21);
      var hh = String(8 + (i % 10)).padStart(2, '0');
      var mm = String((i * 13) % 60).padStart(2, '0');
      var timeText = '2026-10-' + String(day).padStart(2, '0') + ' ' + hh + ':' + mm;
      var row = {
        id: 'LR' + String(i + 1).padStart(4, '0'),
        name: t.name,
        qty: t.qty[i % 4],
        plot: plots[i % plots.length],
        time: timeText,
        status: status,
        remark: remarks[i % remarks.length],
        createTime: timeText
      };
      if (status === '已打印') {
        row.printTime = timeText;
        row.printBatch = 'PB-2026' + String(1010 + (i % 40));
      }
      if (status === '已驳回') {
        row.approveRemark = i % 16 === 0 ? '数量超出本批次配额，请与仓库核对库存后重新提交' : '地块信息填写有误，请补充完整地块编号';
        row.approveTime = timeText;
      }
      out.push(row);
    }
    return out;
  }

  /* ============================================================
   * 场景 5：认养果树（25 条）
   * 结构：H5「我的认养」与后台认养管理共用
   * id 为 AD-A1-001 形式，展示时统一去掉 AD- 前缀
   * ============================================================ */
  var ADOPT_TREE_SEED = [
    // [区号-序号, 品种, 认养人, 手机号, 状态, 进度, 认养日, 费用, 面积]
    ['A1-001', '花牛苹果', '刘友宝', '15111480531', 'harvest', 85, '2026-03-15', 1888, '麦积区 A区 3号地块'],
    ['A1-002', '花牛苹果', '陈晓梅', '13907312876', 'growing', 62, '2026-04-02', 1888, '麦积区 A区 3号地块'],
    ['A1-003', '花牛苹果', '王志强', '13607315290', 'active', 24, '2026-09-18', 1888, '麦积区 A区 4号地块'],
    ['A1-004', '花牛苹果', '李文博', '15807316621', 'growing', 58, '2026-05-11', 1888, '麦积区 A区 4号地块'],
    ['A1-005', '嘎拉苹果', '周雅琴', '18907312245', 'harvest', 88, '2026-03-28', 2188, '麦积区 B区 2号地块'],
    ['A1-006', '嘎拉苹果', '吴国栋', '13707318890', 'growing', 66, '2026-04-19', 2188, '麦积区 B区 2号地块'],
    ['A1-007', '花牛苹果', '郑小雨', '15116320984', 'active', 18, '2026-09-25', 1888, '麦积区 B区 5号地块'],
    ['A1-008', '秦冠', '孙建国', '13307312567', 'growing', 71, '2026-04-30', 1588, '白水 A区 1号地块'],
    ['A1-009', '秦冠', '马丽娟', '18007314472', 'harvest', 91, '2026-03-08', 1588, '白水 A区 1号地块'],
    ['A1-010', '花牛苹果', '胡海洋', '15907315530', 'active', 12, '2026-10-06', 1888, '白水 A区 3号地块'],
    ['A2-001', '花牛苹果', '徐丽华', '13707316618', 'growing', 64, '2026-05-22', 1888, '宜川 A区 2号地块'],
    ['A2-002', '嘎拉苹果', '高志远', '13907312209', 'harvest', 86, '2026-03-21', 2188, '宜川 A区 2号地块'],
    ['A2-003', '花牛苹果', '林美玲', '18807313371', 'active', 20, '2026-09-28', 1888, '宜川 A区 4号地块'],
    ['A2-004', '红富士', '罗建军', '13407319965', 'growing', 55, '2026-06-08', 2488, '宜川 A区 4号地块'],
    ['A2-005', '红富士', '梁雪梅', '15207310042', 'growing', 59, '2026-05-30', 2488, '宜川 A区 6号地块'],
    ['A3-001', '花牛苹果', '宋佳琪', '15907314458', 'harvest', 90, '2026-03-12', 1888, '招远 1号地块'],
    ['A3-002', '花牛苹果', '唐国华', '13807317763', 'growing', 60, '2026-05-16', 1888, '招远 1号地块'],
    ['A3-003', '嘎拉苹果', '冯雅静', '13707315590', 'active', 15, '2026-10-09', 2188, '招远 3号地块'],
    ['A3-004', '秦冠', '邓卫东', '18107312237', 'growing', 68, '2026-04-24', 1588, '天水秦州 6号地块'],
    ['A3-005', '花牛苹果', '彭晓燕', '13507318846', 'growing', 57, '2026-06-15', 1888, '天水秦州 6号地块'],
    ['A3-006', '红富士', '蒋宏伟', '18907310073', 'harvest', 84, '2026-03-25', 2488, '天水福山 2号地块'],
    ['A4-001', '花牛苹果', '谢文轩', '13307316628', 'active', 22, '2026-09-21', 1888, '青岛崂山 2号地块'],
    ['A4-002', '嘎拉苹果', '韩雪梅', '13707312296', 'growing', 61, '2026-05-07', 2188, '潍坊寿光 3号地块'],
    ['A4-003', '秦冠', '曹立军', '15907315564', 'growing', 65, '2026-04-30', 1588, '临沂沂水 5号地块'],
    ['A4-004', '花牛苹果', '袁淑芬', '15207318830', 'active', 16, '2026-10-03', 1888, '泰安肥城 4号地块']
  ];

  function adoptions() {
    return ADOPT_TREE_SEED.map(function (r, i) {
      return {
        id: 'AD-' + r[0],
        treeNo: r[0],
        treeName: r[0].split('-')[0] + '区 ' + r[0].split('-')[1] + '号 ' + r[1],
        variety: r[1],
        adopter: r[2],
        phone: r[3],
        status: r[4],
        progress: r[5],
        adoptDate: r[6],
        fee: r[7],
        area: r[8],
        period: '3年',
        expectHarvest: '预计 2026-10 下旬可采',
        createTime: new Date(2026, 2, 1 + i, 9 + (i % 8), (i * 11) % 60).toISOString()
      };
    });
  }

  /* ============================================================
   * 场景 6：成长相册（24 张，覆盖 12 棵果树，5 个成长阶段）
   * 结构：{ [果树编号]: [{ url, time, stage }] }
   * url 使用 applefarm_h5/images/ 下真实存在的图片，相对 applefarm_h5/
   * ============================================================ */
  var PHOTO_LIB = [
    'images/apple_spring_orchard.jpg',    // 花期
    'images/apple_orchard_banner.jpg',
    'images/apple_tree_orchard.jpg',
    'images/trace_planting.jpg',
    'images/thumb_red_hanging.jpg',       // 结果期
    'images/thumb_picked.jpg',            // 采摘
    'images/apple_redfuji_box.jpg',
    'images/trace_harvest.jpg'
  ];

  function growthPhotos() {
    var stageNames = ['生长', '开花', '结果', '成熟', '采摘'];
    // 12 棵果树，取自认养数据（去 AD- 前缀），与 snzg_adoptions 编号一一对应
    var treeCodes = ADOPT_TREE_SEED.slice(0, 12).map(function (r) { return r[0]; });
    // 每棵 2 张，合计 24 张；阶段按序号轮转，保证 5 个阶段全部出现
    var map = {};
    treeCodes.forEach(function (code, ti) {
      map[code] = [];
      for (var k = 0; k < 2; k++) {
        var idx = ti * 2 + k;          // 0..23 全局序号
        map[code].push({
          url: PHOTO_LIB[idx % PHOTO_LIB.length],
          time: iso(2026, 4 + (idx % 6), 2 + (idx % 26), 9 + (idx % 8), (idx * 17) % 60),
          stage: stageNames[idx % stageNames.length]
        });
      }
    });
    return map;
  }

  /* ============================================================
   * 场景 7：认养证书（24 条）
   * 结构：adoption_cert.html 的 DEFAULT_CERTS 同构
   * ============================================================ */
  function adoptionCerts() {
    var bases = ['麦积区基地 A区', '麦积区基地 B区', '白水基地 A区', '宜川基地 A区', '招远基地'];
    var plots = ['3号地块', '2号地块', '5号地块', '1号地块', '4号地块'];
    var yields = ['约 80 斤', '约 75 斤', '约 90 斤', '约 70 斤', '约 85 斤'];
    var out = [];
    for (var i = 0; i < 24; i++) {
      var tree = ADOPT_TREE_SEED[i % ADOPT_TREE_SEED.length];
      var code = tree[0];
      var variety = tree[1];
      var adopter = tree[2];
      // 状态分布：待签发 / 已签发 / 已撤销
      var status = i % 9 === 0 ? 'pending' : (i % 11 === 0 ? 'revoked' : 'issued');
      var yy = 2026;
      var mm = 3 + (i % 7);          // 3~9 月签发
      var dd = 1 + (i * 3) % 27;
      var issueDate = yy + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
      var row = {
        certNo: 'AD' + yy + String(1000 + i * 7).padStart(6, '0'),
        treeNo: code,
        treeFull: 'AD-' + code,
        adopter: adopter,
        periodStart: issueDate,
        periodEnd: (yy + 3) + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0'),
        variety: variety,
        expectedYield: yields[i % yields.length],
        base: bases[i % bases.length],
        plot: plots[i % plots.length],
        issueDate: status === 'pending' ? '' : issueDate,
        status: status,
        issuedBy: status === 'pending' ? '' : '管理员',
        issueTime: status === 'pending' ? '' : issueDate + ' 10:' + String((i * 7) % 60).padStart(2, '0'),
        revokeReason: status === 'revoked' ? '认养人主动申请解除认养关系，证书作废' : '',
        templateId: 'TPL-00' + ((i % 2) + 1),
        createTime: new Date(yy, mm - 1, dd, 9 + (i % 8), (i * 11) % 60).toISOString()
      };
      out.push(row);
    }
    return out;
  }

  /* ============================================================
   * 场景 8：数据源接入（25 条）
   * 写入 data-store 的 applefarm_data_ops_v1.sources
   * type/protocol/freq/status 需落在 data_source.html 的枚举内
   * ============================================================ */
  function dataSources() {
    var names = [
      '农事记录', '设备实时', '销售订单', '溯源批次', '环境气象', '移动端回传',
      '农资库存', '采收记录', '会员档案', '订单发票', '认养关系', '专家咨询',
      '社区动态', '优惠券核销', '仓储出入库', '地块档案', '企业资质', '溯源上链存证',
      '质检报告', '冷链温控', '包装物料', '供应商档案', '价格指数', '产量模型输入',
      '病虫害图像'
    ];
    var typeByIdx = function (i) {
      var t = ['业务库', 'IoT 网关', '区块链', '移动端'];
      return t[i % t.length];
    };
    var protoByIdx = function (i) {
      var p = ['REST API', 'MQTT', 'WebSocket', 'HTTPS'];
      return p[i % p.length];
    };
    var freqByIdx = function (i) {
      var f = ['实时', '5分钟', '10分钟', '15分钟', '30分钟', '1小时', '每日'];
      return f[i % f.length];
    };
    // endpoint 按 type 拼出不同形态，语义自洽
    function endpointOf(type, name) {
      var slug = name.replace(/[^\w一-龥]/g, '');
      if (type === 'IoT 网关') return 'mqtt://iot-gw:1883/' + slug;
      if (type === '区块链') return 'wss://chain-gw/blocks/' + slug;
      if (type === '移动端') return '/api/v1/mobile/upload/' + slug;
      return '/api/v1/' + slug.toLowerCase();
    }
    var statusByIdx = function (i) {
      // 少量告警与离线，其余运行中，保证三种状态筛选均有数据
      if (i % 11 === 0) return 'offline';
      if (i % 7 === 0) return 'warning';
      return 'online';
    };
    var statusTextMap = { online: '运行中', warning: '延迟偏高', offline: '已离线' };

    var out = [];
    for (var i = 0; i < 25; i++) {
      var name = names[i];
      var type = typeByIdx(i);
      var status = statusByIdx(i);
      out.push({
        id: 'DS' + String(i + 1).padStart(2, '0'),
        name: name + '数据源',
        type: type,
        protocol: protoByIdx(i),
        endpoint: endpointOf(type, name),
        freq: freqByIdx(i),
        status: status,
        statusText: statusTextMap[status],
        updatedAt: '2026-10-22 ' + String(8 + (i % 10)).padStart(2, '0') + ':' + String((i * 7) % 60).padStart(2, '0')
      });
    }
    return out;
  }

  /* ============================================================
   * 场景 9：会员档案（25 条）
   * 结构：{ id, nickname, phone, level, regDate, address }
   * level 与 mall_member.html 的 LEVEL_TEXT 一致（vip/gold/normal）
   * ============================================================ */
  function memberProfiles() {
    var nicknames = [
      '刘友宝', '陈晓梅', '王志强', '李文博', '周雅琴', '吴国栋', '郑小雨', '孙建国', '马丽娟', '胡海洋',
      '徐丽华', '高志远', '林美玲', '罗建军', '梁雪梅', '宋佳琪', '唐国华', '冯雅静', '邓卫东', '彭晓燕',
      '蒋宏伟', '谢文轩', '韩雪梅', '曹立军', '袁淑芬'
    ];
    var regions = [
      '湖南省长沙市', '广东省深圳市', '北京市海淀区', '上海市浦东新区',
      '浙江省杭州市', '江苏省南京市', '四川省成都市', '山东省青岛市',
      '河南省郑州市', '陕西省西安市'
    ];
    var streets = ['麓云路', '科技园南路', '中关村大街', '张杨路', '文一西路', '中山路', '天府大道', '香港中路'];
    var out = [];
    for (var i = 0; i < 25; i++) {
      var level = i % 7 === 0 ? 'vip' : (i % 3 === 0 ? 'gold' : 'normal');
      out.push({
        id: 'M' + String(i + 1).padStart(4, '0'),
        nickname: nicknames[i],
        phone: '15' + String(1100000000 + i * 1234567).slice(0, 9),
        level: level,
        regDate: '2026-' + String(1 + (i % 10)).padStart(2, '0') + '-' + String(1 + (i * 3) % 27).padStart(2, '0'),
        address: regions[i % regions.length] + streets[i % streets.length] + (10 + i) + '号' + (1 + (i % 20)) + '栋' + (101 + i * 3) + '室'
      });
    }
    return out;
  }

  /* ============================================================
   * 场景 10：C 端订单（25 条）+ 5 条发货记录（h5_sales_orders）
   * 结构：与 h5_checkout.html 下单结构一致
   * 状态分布：pending/paid/shipped/completed/cancelled 各 tab 均有数据
   * ============================================================ */
  var ORDER_PRODUCTS = [
    { name: '花牛苹果 5斤装', spec: '5斤装', price: 68, img: 'images/thumb_redfuji.jpg' },
    { name: '嘎拉苹果 5斤装', spec: '5斤装', price: 58, img: 'images/thumb_gala.jpg' },
    { name: '精品礼盒装 8斤', spec: '8斤装', price: 168, img: 'images/thumb_giftbox.jpg' },
    { name: '花牛苹果认养1棵', spec: '1棵/3年', price: 1888, img: 'images/thumb_tree.jpg' },
    { name: '认养果树3年套餐', spec: '3年套餐', price: 1888, img: 'images/thumb_tree.jpg' }
  ];

  var ORDER_STATUS_CYCLE = [
    'pending', 'paid', 'shipped', 'completed', 'cancelled',
    'completed', 'paid', 'shipped', 'completed', 'pending',
    'completed', 'shipped', 'paid', 'completed', 'cancelled',
    'completed', 'completed', 'paid', 'shipped', 'completed',
    'pending', 'completed', 'paid', 'completed', 'shipped'
  ];
  var STATUS_TEXT_CN = { pending: '待付款', paid: '待发货', shipped: '待收货', completed: '已完成', cancelled: '已取消' };
  var COMPANIES = ['sf', 'jd', 'zt', 'yt', 'yd'];

  function cOrders() {
    var names = [
      '刘友宝', '陈晓梅', '王志强', '李文博', '周雅琴', '吴国栋', '郑小雨', '孙建国', '马丽娟', '胡海洋',
      '徐丽华', '高志远', '林美玲', '罗建军', '梁雪梅', '宋佳琪', '唐国华', '冯雅静', '邓卫东', '彭晓燕',
      '蒋宏伟', '谢文轩', '韩雪梅', '曹立军', '袁淑芬'
    ];
    var regions = [
      '湖南省长沙市', '广东省深圳市', '北京市海淀区', '上海市浦东新区',
      '浙江省杭州市', '江苏省南京市', '四川省成都市', '山东省青岛市'
    ];
    var streets = ['麓云路', '科技园南路', '中关村大街', '张杨路', '文一西路', '中山路', '天府大道', '香港中路'];
    var payments = ['微信支付', '支付宝', '银行卡', '在线支付'];

    var orders = [];
    for (var i = 0; i < 25; i++) {
      var p1 = ORDER_PRODUCTS[i % ORDER_PRODUCTS.length];
      var p2 = i % 3 === 0 ? ORDER_PRODUCTS[(i + 2) % ORDER_PRODUCTS.length] : null;
      var qty = (i % 4) + 1;
      var items = [{ name: p1.name, spec: p1.spec, price: p1.price, qty: qty, img: p1.img }];
      if (p2 && p2.id !== p1.id) {
        items.push({ name: p2.name, spec: p2.spec, price: p2.price, qty: 1, img: p2.img });
      }
      var subtotal = items.reduce(function (s, x) { return s + x.price * x.qty; }, 0);
      // 折扣：小额给满减，大额给 9 折，保持与优惠券规则自洽
      var discount = subtotal >= 200 ? 30 : (subtotal >= 100 ? 10 : 0);
      if (subtotal >= 3000) discount = Math.round(subtotal * 0.1 * 100) / 100;
      var total = Math.round((subtotal - discount) * 100) / 100;
      var status = ORDER_STATUS_CYCLE[i];
      var month = 9 + Math.floor(i / 15);   // 9~10 月，避免出现未来日期
      var day = 1 + (i * 5) % 27;
      var createdAt = new Date(2026, month - 1, day, 9 + (i % 10), (i * 17) % 60).toISOString();

      orders.push({
        id: 'ORD2026' + String(10000 + i * 37),
        no: 'ORD2026' + String(10000 + i * 37),
        items: items,
        subtotal: subtotal,
        discount: discount,
        total: total,
        payment: payments[i % payments.length],
        invoice: i % 5 === 0,
        invoiceNo: '',
        address: {
          name: names[i],
          phone: '15' + String(1100000000 + i * 1234567).slice(0, 9),
          region: regions[i % regions.length],
          detail: streets[i % streets.length] + (10 + i) + '号' + (1 + (i % 20)) + '栋' + (101 + i * 3) + '室'
        },
        couponCode: discount > 0 ? (subtotal >= 200 ? 'cash30' : 'cash10') : '',
        status: STATUS_TEXT_CN[status],
        statusCode: status,
        createdAt: createdAt,
        logistics: []
      });
    }
    return orders;
  }

  function salesOrders() {
    // 为 shipped 状态生成运单，与 cOrders 的订单号一一对应
    var orders = cOrders();
    var ships = [];
    orders.forEach(function (o) {
      if (o.statusCode === 'shipped') {
        var shippedAt = new Date(new Date(o.createdAt).getTime() + 2 * 24 * 3600 * 1000).toISOString();
        ships.push({
          orderNo: o.no,
          tracking: 'SF' + String(100000000 + Math.floor(Math.random() * 899999999)),
          company: COMPANIES[ships.length % COMPANIES.length],
          shippedAt: shippedAt
        });
      }
    });
    return ships;
  }

  /* ============================================================
   * 场景 11：社区动态（24 条）+ 点赞/评论
   * 结构：{ id, author, content, time } + likes/comments 两个映射
   * ============================================================ */
  function communityPosts() {
    var rows = [
      ['刘友宝', '我家认养的花牛苹果今年挂果特别多，预计能收 80 斤左右！'],
      ['陈晓梅', '上周去基地采摘，孩子第一次见到苹果长在树上，特别兴奋'],
      ['王志强', '收到认养证书了，做工精致，扫码就能看到这棵树的所有农事记录'],
      ['李文博', '请教一下，我的苹果出现几个黑斑，是什么情况？'],
      ['周雅琴', '礼盒装的苹果包装很用心，送给客户的反响很好'],
      ['吴国栋', '果园的环境真不错，鸟语花香的周末一日游'],
      ['郑小雨', '今天刚下单，什么时候可以发货呀？'],
      ['孙建国', '摘下来的苹果个头大，甜度不错，口感很好'],
      ['马丽娟', '客服回复很及时，问题很快就解决了，点赞'],
      ['胡海洋', '我家果树开了花，满树白花特别美，拍了很多照片'],
      ['徐丽华', '有没有人一起去基地旅游的？'],
      ['高志远', '认养果树比自己买水果有意思多了，能看到它一点点长大'],
      ['林美玲', '配送很快，昨天下的单今天就到了，箱子包装很结实'],
      ['罗建军', '红富士的口感确实不错，脆甜'],
      ['梁雪梅', '希望多上一些早熟品种，现在买到的都是晚熟'],
      ['宋佳琪', '积分换的优惠券很好用，感谢商家'],
      ['唐国华', '第一次吃到这么新鲜的苹果，一口下去都是汁水'],
      ['冯雅静', '推荐大家尝尝他家的小苹果，孩子一口气吃了三个'],
      ['邓卫东', '认养流程很顺畅，下单后工作人员就联系我了'],
      ['彭晓燕', '这周的果园周报很详细，能看出果园管理很用心'],
      ['蒋宏伟', '朋友送的礼盒 apples 包装很上档次'],
      ['谢文轩', '有谁知道怎么查询这棵树的溯源信息吗？'],
      ['韩雪梅', '客服说发货前会短信通知，服务很到位'],
      ['袁淑芬', '期待今年的新苹果上市！']
    ];
    var posts = [];
    for (var i = 0; i < 24; i++) {
      var base = new Date(2026, 9, 22, 14, 0);
      base.setMinutes(base.getMinutes() - i * 210);
      posts.push({
        id: 'P' + (202610220000 + i * 1000),
        author: rows[i][0],
        content: rows[i][1],
        // 用本地时间文本而非 ISO：后台与 H5 都按原文展示，
        // ISO 会让表格直接显示一长串 "2026-10-22T06:00:00.000Z"
        time: ymdhm(base)
      });
    }
    return posts;
  }

  function communityLikes(posts) {
    var map = {};
    posts.forEach(function (p, i) {
      map[p.id] = (i * 7) % 45;   // 0~44 区间，制造明显差异
    });
    return map;
  }

  function communityComments(posts) {
    var map = {};
    var replies = [
      '同问，楼上是怎么处理的？', '我也遇到过，后来联系技术员解决了',
      '同款，品质确实不错', '支持！', '太棒了', '已下单，坐等收货',
      '感谢分享', '学到了，感谢'
    ];
    posts.forEach(function (p, i) {
      if (i % 3 === 0) return;   // 部分动态无评论
      var n = (i % 3) + 1;
      var arr = [];
      for (var j = 0; j < n; j++) {
        var base = new Date(new Date(p.time).getTime() + (j + 1) * 3600 * 1000);
        arr.push({
          text: replies[(i + j) % replies.length],
          time: ymdhm(base)
        });
      }
      map[p.id] = arr;
    });
    return map;
  }

  /* ============================================================
   * 场景 12：发票申请（24 条）
   * 结构：{ id, title, amount, type, orderNo, applyTime, status, invoiceNo, issueTime, rejectReason }
   * ============================================================ */
  function invoices() {
    var titles = [
      '个人', '湖南省长沙市天心区个体工商户', '长沙市麓云路科技有限公司',
      '深圳市南山区数码有限公司', '北京中关村软件有限公司', '上海张杨路贸易有限公司',
      '杭州市文一西路电子商务有限公司', '南京中山路文化传媒有限公司'
    ];
    var orderNos = [];
    var orders = cOrders();
    for (var i = 0; i < 12; i++) {
      orderNos.push(orders[i * 2 % orders.length].no);
    }
    var out = [];
    for (var i = 0; i < 24; i++) {
      // 状态分布：pending/issued/rejected
      var status = i % 7 === 0 ? 'pending' : (i % 11 === 0 ? 'rejected' : 'issued');
      var month = 9 + Math.floor(i / 12);
      var day = 1 + (i * 5) % 27;
      var applyTime = new Date(2026, month - 1, day, 10 + (i % 8), (i * 19) % 60).toISOString();
      var type = i % 4 === 0 ? '增值税专用发票' : '电子普通发票';
      var row = {
        id: 'INV' + String(20261000000 + i * 31),
        title: titles[i % titles.length],
        amount: 68 * ((i % 4) + 1) * (i % 6 === 0 ? 2 : 1),
        type: type,
        orderNo: orderNos[i % orderNos.length],
        applyTime: applyTime,
        status: status,
        invoiceNo: '',
        issueTime: '',
        rejectReason: ''
      };
      if (status === 'issued') {
        row.invoiceNo = '0' + String(25162000000 + i * 137);
        row.issueTime = new Date(new Date(applyTime).getTime() + 24 * 3600 * 1000).toISOString();
      } else if (status === 'rejected') {
        row.rejectReason = i % 22 === 0 ? '开票抬头信息不完整，请补充纳税人识别号后重新申请' : '订单金额与开票金额不一致，请核对后重新提交';
      }
      out.push(row);
    }
    return out;
  }

  /* ============================================================
   * 场景 13：专家咨询（25 条）
   * 结构：{ id, title, desc, status, time, reply?, expert?, replyTime? }
   * 专家仅两个：王教授 / 李农艺师（与 mb_expert_reply.html 下拉一致）
   * ============================================================ */
  function expertQuestions() {
    var rows = [
      ['果树叶子发黄怎么办？', '我家认养的苹果树最近叶子开始发黄，叶尖有点焦，不知道是不是缺肥或者病害'],
      ['苹果什么时候套袋最合适？', '看到邻居已经在套袋了，想问一下花牛苹果一般什么时候开始套袋比较好'],
      ['红蜘蛛怎么防治？', '叶面上出现很多小黄点，怀疑是红蜘蛛，用什么药比较安全'],
      ['疏果什么时候做？', '树上的果子太多了，怕影响品质，想问疏果一般保留多少个合适'],
      ['我的苹果有个黑斑', '收到货的苹果表面有几个黑斑，担心是坏果，请问怎么处理'],
      ['冬天果树怎么修剪？', '苹果树冬天要修剪吗？现在修剪合适吗，怎么剪'],
      ['果实小是什么原因？', '今年的果子明显偏小，是施肥不够还是疏果不彻底'],
      ['果园里发现蚜虫', '嫩梢上很多蚜虫，抹药会影响果实吗'],
      ['浇水多少合适？', '几天浇一次水，每次浇多少量比较合适'],
      ['苹果什么时候能采摘？', '果子看着颜色差不多了，但摸着还硬，什么时候摘口感最好'],
      ['什么是水肥一体化？', '基地说的水肥一体化具体是怎么操作的，家庭果园能用吗'],
      ['我的树有轮纹病', '叶片上有同心轮纹状的病斑，需要怎么处理'],
      ['苹果怎么授粉？', '园子里只种了一种品种，需要授粉树吗'],
      ['雨季裂果怎么办', '去年下雨多的时候很多果子裂开了，今年怎么预防'],
      ['施肥用哪种肥好？', '想用有机肥，不知道什么时候施、施多少合适'],
      ['果实上色不均匀', '一边红一边青，卖相不好，有什么办法改善'],
      ['树干有裂口怎么办', '树主干上有一道纵向裂口，树还在流胶，要紧吗'],
      ['打药后多久能摘', '刚打了药，多久之后采摘的苹果才能吃'],
      ['怎么判断果子成熟', '除了看颜色，还有什么方法判断成熟度'],
      ['果园排水怎么做', '我的地块下雨就积水，需要怎么整改'],
      ['新栽的树怎么管理', '今年春天栽的小苗，现在长势还可以，需要注意什么'],
      ['套袋后还有虫吗', '套袋可以防虫吗，还需要打药吗'],
      ['苹果什么时候疏花', '花开得很多，需要人工疏花吗'],
      ['叶子卷曲怎么回事', '最近天气热，叶子边缘往里卷，是不是缺水'],
      ['有机肥怎么腐熟', '鸡粪直接施可以吗，还是要腐熟过再用']
    ];
    var out = [];
    for (var i = 0; i < 25; i++) {
      // 状态分布：pending 待回复 / replied 已回复
      var status = i % 3 === 0 ? 'pending' : 'replied';
      var month = 9 + Math.floor(i / 12);
      var day = 1 + (i * 4) % 27;
      // 本地时间文本：mb_expert_reply 表格按原文展示
      var time = ymdhm(new Date(2026, month - 1, day, 9 + (i % 9), (i * 13) % 60));
      var row = {
        id: 'EQ' + String(1000 + i * 7),
        title: rows[i][0],
        desc: rows[i][1],
        status: status,
        time: time
      };
      if (status === 'replied') {
        var expert = i % 2 === 0 ? '王教授' : '李农艺师';
        row.expert = expert;
        row.reply = expert === '王教授'
          ? '建议先补充叶面追肥一次（硫酸钾型复合肥 3% 浓度），同时检查根区土壤湿度。若叶尖焦枯明显，优先排查灌溉水量与根系通气状况。近期注意轮纹病高发，必要时间隔 7-10 天喷一次保护性杀菌剂。'
          : '该问题属于水肥管理范畴。建议采用滴灌按需供水，花期与膨大期各追一次水溶肥；成熟前 30 天控水有利于提高糖度。建议结合当地农技站测土配方数据调整施肥方案。';
        row.replyTime = ymdhm(new Date(new Date(time).getTime() + 8 * 3600 * 1000));
      }
      out.push(row);
    }
    return out;
  }

  /* ============================================================
   * 场景 14：离线同步队列（24 条）
   * 结构：{ id, type, payload, refId, queuedAt, retry, status }
   * type：farming_record / patrol_checkin / patrol_abnormal
   * ============================================================ */
  function syncQueue() {
    var farmingTypes = ['疏果', '套袋', '喷药', '灌溉', '施肥', '修剪', '环剥', '除草'];
    var plots = ['麦积区 A区 3号地块', '麦积区 B区 2号地块', '白水 A区 1号地块', '宜川 A区 4号地块', '招远 3号地块'];
    var checkpoints = ['A区1号巡园点', 'B区1号巡园点', 'C区1号巡园点', 'A区3号巡园点', 'B区4号巡园点'];
    var out = [];
    for (var i = 0; i < 24; i++) {
      // 三种类型按 2:2:1 分布，保证各统计卡均有数据
      var type = i % 5 === 4 ? 'patrol_abnormal' : (i % 2 === 0 ? 'farming_record' : 'patrol_checkin');
      var base = new Date(2026, 9, 22, 12, 0);
      base.setMinutes(base.getMinutes() - i * 45);
      var payload, refId;
      if (type === 'farming_record') {
        payload = {
          plot: plots[i % plots.length],
          taskType: farmingTypes[i % farmingTypes.length],
          remark: i % 4 === 0 ? '作业面积约 3 亩' : '',
          gps: { lat: 34.34800 + (i % 10) * 0.0012, lng: 106.17900 + (i % 10) * 0.0015 },
          photo: i % 3 === 0
        };
        refId = 'MOB-' + (3001 + i);
      } else if (type === 'patrol_checkin') {
        payload = {
          checkpointName: checkpoints[i % checkpoints.length],
          note: i % 5 === 0 ? '果树长势正常' : '',
          gps: { lat: 34.34800 + (i % 8) * 0.0011, lng: 106.17900 + (i % 8) * 0.0014 }
        };
        refId = 'CHK-' + (4001 + i);
      } else {
        payload = {
          level: ['一般', '较急', '紧急'][i % 3],
          desc: ['发现杂草过高', '滴灌带破损', '发现病斑'][i % 3],
          gps: { lat: 34.34800 + (i % 6) * 0.0013, lng: 106.17900 + (i % 6) * 0.0016 }
        };
        refId = 'ABN-' + (5001 + i);
      }
      out.push({
        id: 'q_seed_' + String(1000 + i),
        type: type,
        payload: payload,
        refId: refId,
        queuedAt: base.toISOString(),
        retry: i % 4,          // 0~3 次重试，体现重试统计
        status: 'pending'
      });
    }
    return out;
  }

  /* ============================================================
   * 移动端报修（24 条）
   * 结构：{ device, urgency, urgencyText, reason, status, statusText, id, createTime }
   * ============================================================ */
  function maintenanceLogs() {
    var devices = [
      '温湿度传感器S003', '土壤墒情仪S007', '摄像头C02', '气象站W01',
      '智能水肥机I05', '无人机D01', '虫情测报灯L02', '网关GW01',
      '冷库温控器R03', '分选线称重秤M02', '配电柜P01', '泵站控制柜B02'
    ];
    var reasons = [
      '设备离线，数据已 6 小时未上报',
      '传感器读数异常，湿度长期显示 0',
      '摄像头画面模糊，镜头有水雾遮挡',
      '电池电量不足，无法正常上报',
      '水肥机连接管路漏水',
      '桨叶磨损，建议检修更换',
      '虫情灯高压电网故障',
      '网关信号弱，频繁掉线',
      '冷库温度波动超过阈值',
      '称重秤显示跳动，数值不稳',
      '配电柜有异响，存在安全隐患',
      '泵站控制柜启动失败'
    ];
    var out = [];
    for (var i = 0; i < 24; i++) {
      // 状态分布：pending/accepted/done/rejected 四种筛选均有数据
      var status = i % 7 === 0 ? 'rejected' : (i % 5 === 0 ? 'pending' : (i % 3 === 0 ? 'accepted' : 'done'));
      var statusTextMap = { pending: '待受理', accepted: '已受理', done: '已完成', rejected: '已驳回' };
      var urgency = ['low', 'normal', 'high'][i % 3];
      var urgencyTextMap = { low: '一般', normal: '较急', high: '紧急' };
      var month = 9 + Math.floor(i / 12);
      var day = 1 + (i * 4) % 27;
      var createTime = ymdhm(new Date(2026, month - 1, day, 8 + (i % 10), (i * 17) % 60));
      var row = {
        id: 'MT' + String(2000 + i * 13),
        device: devices[i % devices.length],
        urgency: urgency,
        urgencyText: urgencyTextMap[urgency],
        reason: reasons[i % reasons.length],
        status: status,
        statusText: statusTextMap[status],
        createTime: createTime
      };
      if (status === 'done') row.handleTime = ymdhm(new Date(new Date(createTime).getTime() + 6 * 3600 * 1000));
      if (status === 'rejected') row.handleRemark = '经核查设备处于正常维护周期内，无需现场维修';
      out.push(row);
    }
    return out;
  }

  /* ============================================================
   * 场景 15：会员积分与收藏（供「会员管理」统计卡读取）
   * 商城统计取 h5_orders / h5_points / h5_favorites / snzg_adoptions 四份数据，
   * 其中积分与收藏原本只能由 H5 端页面首次访问时播种，
   * 后台直接打开会统计为 0，这里补齐。
   * ============================================================ */
  function memberPoints() {
    return [{ amount: 1280, source: '消费返积分' }];
  }

  function memberFavorites() {
    return [
      { id: 'redFuji', name: '花牛苹果 5斤装', desc: '脆甜多汁 · 新鲜采摘', price: 68, img: 'images/thumb_red_hanging.jpg', date: '2026.10.15' },
      { id: 'giftBox', name: '精品礼盒装 8斤', desc: '送礼佳品 · 品质保证', price: 168, img: 'images/thumb_giftbox.jpg', date: '2026.10.10' },
      { id: 'adopt3yr', name: '认养果树3年套餐', desc: '专属果树 · 全程溯源', price: 1888, img: 'images/thumb_picked.jpg', date: '2026.10.05' }
    ];
  }

  /* ============================================================
   * 播种入口
   * ============================================================ */
  var SCENES = {
    'drone-events':    function () { return seed('smartorchard_drone_events', droneEvents()); },
    'drone-abnormal':  function () { return seed('smartorchard_drone_abnormal', droneAbnormal()); },
    'patrol-routes':   function () { return seed('mb_patrol_routes', patrolRoutes()); },
    'label-records':   function () { return seed('smartorchard_label_records', labelRecords()); },
    'adoptions':       function () { return seed('snzg_adoptions', adoptions()); },
    'growth-photos':   function () { return seed('h5_adoption_photos', growthPhotos()); },
    'adoption-certs':  function () { return seed('adoption_certs', adoptionCerts()); },
    'data-sources':    function () { return seedObjectField('applefarm_data_ops_v1', 'sources', dataSources()); },
    'members':         function () {
      var a = seed('mall_member_profiles', memberProfiles());
      var b = seed('h5_points', memberPoints());
      var c = seed('h5_favorites', memberFavorites());
      return a || b || c;
    },
    'c-orders':        function () {
      var a = seed('h5_orders', cOrders());
      var b = seed('h5_sales_orders', salesOrders());
      return a || b;
    },
    'community':       function () {
      var posts = communityPosts();
      var a = seed('h5_community_posts', posts);
      var b = seed('h5_community_likes', communityLikes(posts));
      var c = seed('h5_community_comments', communityComments(posts));
      return a || b || c;
    },
    'invoices':        function () { return seed('h5_invoices', invoices()); },
    'expert-questions':function () { return seed('smartorchard_expert_questions', expertQuestions()); },
    'sync-queue':      function () { return seed('smartorchard_sync_queue', syncQueue()); },
    'maintenance':     function () { return seed('smartorchard_maintenance_logs', maintenanceLogs()); }
  };

  /** 页面调用：确保某场景有数据 */
  function ensure(scenes) {
    if (isDisabled()) return;
    var list = Array.isArray(scenes) ? scenes : (scenes ? [scenes] : Object.keys(SCENES));
    list.forEach(function (name) {
      var fn = SCENES[name];
      if (fn) fn();
    });
  }

  /** 清除本播种器写入的全部键（用于演示数据重置） */
  function clear() {
    [
      'smartorchard_drone_events', 'smartorchard_drone_abnormal', 'mb_patrol_routes',
      'smartorchard_label_records', 'snzg_adoptions', 'h5_adoption_photos',
      'adoption_certs', 'mall_member_profiles', 'h5_orders', 'h5_sales_orders',
      'h5_community_posts', 'h5_community_likes', 'h5_community_comments',
      'h5_invoices', 'smartorchard_expert_questions', 'smartorchard_sync_queue',
      'smartorchard_maintenance_logs', 'h5_points', 'h5_favorites'
    ].forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) { /* 忽略 */ }
    });
  }

  global.DemoSeed = {
    VERSION: VERSION,
    ensure: ensure,
    clear: clear,
    _scenes: Object.keys(SCENES)
  };
})(window);