/**
 * 预警管理共享数据源
 * --------------------------------------------------------------
 * 统一管理设备预警 + 农事预警数据，提供跨端（后台、大屏、移动端）读取、写入与同步能力。
 *
 * 数据存储：
 *   - 首次加载时初始化 46 条默认 mockData
 *   - 状态变更通过 localStorage 持久化（key: applefarm_alert_state_v1）
 *   - 跨标签 / 跨 iframe 同步：监听 'storage' 事件
 *
 * 暴露 API：
 *   AlertStore.all()                          → 全部预警数组
 *   AlertStore.byType(type)                   → 按类型筛选 (device | farming)
 *   AlertStore.byStatus(status)               → 按状态筛选 (pending | processing | completed)
 *   AlertStore.byLevel(level)                 → 按级别筛选 (urgent | important | reminder | notice)
 *   AlertStore.byId(id)                       → 按 id 查询
 *   AlertStore.updateStatus(id, status, text, historyLine) → 更新状态并广播
 *   AlertStore.appendHistory(id, line)        → 追加处理历史并广播
 *   AlertStore.subscribe(fn)                  → 订阅变更，返回 unsubscribe
 *
 * 内部数据格式（统一字段）：
 *   {
 *     id: string,                  // 唯一 ID（DEV001 / FAR001）
 *     type: 'device'|'farming',    // 预警类型
 *     title: string,
 *     level: 'urgent'|'important'|'reminder'|'notice',     // 标准化四级
 *     levelText: string,            // 中文（紧急/重要/提醒/通知）
 *     location: string,
 *     time: string,                 // 触发时间
 *     status: 'pending'|'processing'|'completed',
 *     statusText: string,
 *     desc: string,
 *     history: string[],            // 处理历史（时间 + 内容）
 *     device?: string,              // 仅设备预警
 *     threshold?: {current,limit,trend} // 仅农事预警
 *     srcType?: string,             // 原始 type 字段（disease/weather/soil/growth/...）
 *     srcTypeText?: string
 *   }
 */

(function(global){
  'use strict';

  // 标准化级别映射
  var LEVEL_MAP = {
    danger:    { key:'urgent',    text:'紧急' },
    critical:  { key:'urgent',    text:'紧急' },
    warning:   { key:'important', text:'重要' },
    medium:    { key:'reminder',  text:'提醒' },
    info:      { key:'notice',    text:'通知' },
    notice:    { key:'notice',    text:'通知' },
    reminder:  { key:'reminder',  text:'提醒' },
    important: { key:'important', text:'重要' },
    urgent:    { key:'urgent',    text:'紧急' }
  };

  function normalizeLevel(level, levelText){
    if (LEVEL_MAP[level]) {
      return { level: LEVEL_MAP[level].key, levelText: LEVEL_MAP[level].text };
    }
    return { level: level || 'notice', levelText: levelText || '通知' };
  }

  // 初始化默认数据（从 alert_device.html + alert_farming.html 合并）
  var DEFAULT_DATA = (function(){
    var out = [];

    // 设备预警 23 条
    out.push({ id:'DEV001', type:'device', title:'设备离线：水肥一体化设备离线超过30分钟', level:'urgent', levelText:'紧急', device:'水肥一体化控制器-A01', location:'天水麦积区基地 - 地块A1', time:'2026-09-20 10:30', status:'pending', statusText:'待处理', desc:'设备已离线超过30分钟，请检查设备连接状态和网络状况。建议立即联系现场运维人员进行排查。', history:['系统自动生成预警'] });
    out.push({ id:'DEV002', type:'device', title:'数据异常：土壤湿度传感器数值异常', level:'important', levelText:'重要', device:'土壤湿度传感器-S05', location:'天水荣成基地 - 地块B3', time:'2026-09-20 09:15', status:'processing', statusText:'处理中', desc:'传感器数值超出正常范围，请检查传感器是否损坏或需要校准。', history:['系统自动生成预警','技术员已接单处理'] });
    out.push({ id:'DEV003', type:'device', title:'设备离线：气象站设备离线', level:'important', levelText:'重要', device:'气象站-M02', location:'麦积区阁基地 - 中心区域', time:'2026-09-20 08:45', status:'pending', statusText:'待处理', desc:'气象站设备通讯中断，可能影响气象数据采集。', history:['系统自动生成预警'] });
    out.push({ id:'DEV004', type:'device', title:'设备维护提醒：摄像头C03需要清洁', level:'notice', levelText:'通知', device:'监控摄像头-C03', location:'青岛莱西基地 - 地块C2', time:'2026-09-19 17:00', status:'completed', statusText:'已处理', desc:'摄像头镜头积尘过多，建议安排清洁维护。', history:['系统自动生成预警','已完成清洁维护'] });
    out.push({ id:'DEV005', type:'device', title:'数据异常：虫情灯识别异常', level:'reminder', levelText:'提醒', device:'虫情灯-I01', location:'龙口南山基地 - 地块D1', time:'2026-09-19 14:30', status:'completed', statusText:'已处理', desc:'虫情识别准确率下降，建议检查设备状态。', history:['系统自动生成预警','已完成设备检查'] });
    out.push({ id:'DEV006', type:'device', title:'设备离线：灌溉控制器离线', level:'urgent', levelText:'紧急', device:'灌溉控制器-I02', location:'天水麦积区基地 - 地块A2', time:'2026-09-19 12:00', status:'pending', statusText:'待处理', desc:'灌溉控制器离线，可能影响灌溉计划执行。', history:['系统自动生成预警'] });
    out.push({ id:'DEV007', type:'device', title:'电池电量低：太阳能板供电不足', level:'important', levelText:'重要', device:'太阳能板-SP01', location:'天水荣成基地 - 地块B1', time:'2026-09-19 10:20', status:'processing', statusText:'处理中', desc:'太阳能板发电量不足，电池电量低于20%。', history:['系统自动生成预警','已安排检查太阳能板'] });
    out.push({ id:'DEV008', type:'device', title:'设备离线：温湿度传感器离线', level:'important', levelText:'重要', device:'温湿度传感器-T03', location:'青岛莱西基地 - 地块C1', time:'2026-09-18 16:45', status:'completed', statusText:'已处理', desc:'传感器已恢复正常连接。', history:['系统自动生成预警','已恢复连接'] });
    out.push({ id:'DEV009', type:'device', title:'数据异常：风速传感器读数异常', level:'reminder', levelText:'提醒', device:'风速传感器-W01', location:'麦积区阁基地 - 风口区域', time:'2026-09-18 14:30', status:'completed', statusText:'已处理', desc:'风速读数出现异常波动，已完成校准。', history:['系统自动生成预警','已完成校准'] });
    out.push({ id:'DEV010', type:'device', title:'设备维护提醒：土壤传感器需要校准', level:'notice', levelText:'通知', device:'土壤传感器-S01', location:'天水麦积区基地 - 地块A3', time:'2026-09-18 09:00', status:'pending', statusText:'待处理', desc:'土壤传感器已运行超过6个月，建议进行校准。', history:['系统自动生成预警'] });
    out.push({ id:'DEV011', type:'device', title:'设备离线：无人机基站离线', level:'urgent', levelText:'紧急', device:'无人机基站-DJ01', location:'龙口南山基地 - 停机坪', time:'2026-09-17 18:30', status:'pending', statusText:'待处理', desc:'无人机基站通讯中断，影响无人机作业。', history:['系统自动生成预警'] });
    out.push({ id:'DEV012', type:'device', title:'数据异常：光照传感器数值波动', level:'reminder', levelText:'提醒', device:'光照传感器-L01', location:'天水荣成基地 - 地块B2', time:'2026-09-17 15:20', status:'processing', statusText:'处理中', desc:'光照传感器数值波动较大，需要检查。', history:['系统自动生成预警','技术员正在处理'] });
    out.push({ id:'DEV013', type:'device', title:'设备离线：CO2传感器离线', level:'important', levelText:'重要', device:'CO2传感器-C01', location:'青岛莱西基地 - 温室大棚', time:'2026-09-17 11:00', status:'completed', statusText:'已处理', desc:'CO2传感器已恢复正常。', history:['系统自动生成预警','已恢复正常'] });
    out.push({ id:'DEV014', type:'device', title:'设备维护提醒：摄像头C05镜头需要清洁', level:'notice', levelText:'通知', device:'监控摄像头-C05', location:'麦积区阁基地 - 东门区域', time:'2026-09-16 17:30', status:'completed', statusText:'已处理', desc:'摄像头镜头已清洁完毕。', history:['系统自动生成预警','已完成清洁'] });
    out.push({ id:'DEV015', type:'device', title:'数据异常：土壤pH值传感器异常', level:'important', levelText:'重要', device:'pH传感器-P02', location:'天水麦积区基地 - 地块A4', time:'2026-09-16 14:15', status:'pending', statusText:'待处理', desc:'pH传感器读数异常，需要检查校准。', history:['系统自动生成预警'] });
    out.push({ id:'DEV016', type:'device', title:'设备离线：土壤水分传感器离线', level:'important', levelText:'重要', device:'土壤水分传感器-M01', location:'天水荣成基地 - 地块B4', time:'2026-09-16 10:00', status:'processing', statusText:'处理中', desc:'土壤水分传感器离线，正在排查原因。', history:['系统自动生成预警','正在排查'] });
    out.push({ id:'DEV017', type:'device', title:'设备维护提醒：气象站需要维护', level:'notice', levelText:'通知', device:'气象站-M01', location:'天水麦积区基地 - 中心区域', time:'2026-09-15 16:00', status:'pending', statusText:'待处理', desc:'气象站设备运行时间过长，需要进行常规维护。', history:['系统自动生成预警'] });
    out.push({ id:'DEV018', type:'device', title:'数据异常：雨量传感器数值异常', level:'reminder', levelText:'提醒', device:'雨量传感器-R01', location:'麦积区阁基地 - 南门区域', time:'2026-09-15 13:30', status:'completed', statusText:'已处理', desc:'雨量传感器已校准完毕。', history:['系统自动生成预警','已完成校准'] });
    out.push({ id:'DEV019', type:'device', title:'设备离线：摄像头C01离线', level:'urgent', levelText:'紧急', device:'监控摄像头-C01', location:'青岛莱西基地 - 北门区域', time:'2026-09-15 09:45', status:'pending', statusText:'待处理', desc:'监控摄像头离线，影响区域监控。', history:['系统自动生成预警'] });
    out.push({ id:'DEV020', type:'device', title:'设备维护提醒：灌溉控制器需要检修', level:'notice', levelText:'通知', device:'灌溉控制器-I01', location:'龙口南山基地 - 地块D2', time:'2026-09-14 17:00', status:'completed', statusText:'已处理', desc:'灌溉控制器已完成检修。', history:['系统自动生成预警','已完成检修'] });
    out.push({ id:'DEV021', type:'device', title:'数据异常：空气湿度传感器波动', level:'reminder', levelText:'提醒', device:'空气湿度传感器-H01', location:'天水麦积区基地 - 地块A5', time:'2026-09-14 14:20', status:'completed', statusText:'已处理', desc:'空气湿度传感器波动已恢复正常。', history:['系统自动生成预警','已恢复正常'] });
    out.push({ id:'DEV022', type:'device', title:'设备离线：温度传感器离线', level:'important', levelText:'重要', device:'温度传感器-T01', location:'天水荣成基地 - 地块B5', time:'2026-09-14 10:30', status:'processing', statusText:'处理中', desc:'温度传感器离线，正在恢复连接。', history:['系统自动生成预警','正在恢复'] });
    out.push({ id:'DEV023', type:'device', title:'设备维护提醒：虫情灯需要清理', level:'notice', levelText:'通知', device:'虫情灯-I02', location:'青岛莱西基地 - 地块C3', time:'2026-09-13 16:30', status:'pending', statusText:'待处理', desc:'虫情灯收集盒已满，需要清理。', history:['系统自动生成预警'] });

    // 农事预警 23 条
    out.push({ id:'FAR001', type:'farming', title:'病虫害预警：红蜘蛛虫害爆发风险', level:'urgent', levelText:'紧急', location:'天水麦积区基地 - 地块A1、A2、A3', time:'2026-09-20 11:00', status:'pending', statusText:'待处理', desc:'根据监测数据，红蜘蛛虫口密度已达到防治阈值（>5头/叶），预计未来3天内将进入爆发期。建议立即采取防治措施。', srcType:'disease', srcTypeText:'病虫害预警', history:['系统自动生成预警'], threshold:{ current:'8头/叶', limit:'5头/叶', trend:'呈上升趋势' } });
    out.push({ id:'FAR002', type:'farming', title:'气象预警：暴雨将至，建议做好排水准备', level:'important', levelText:'重要', location:'天水荣成基地 - 全部地块', time:'2026-09-20 09:30', status:'processing', statusText:'处理中', desc:'预计未来24小时内将有暴雨，降雨量预计达到50-80mm。请做好果园排水设施检查和加固工作。', srcType:'weather', srcTypeText:'气象预警', history:['系统自动生成预警','已通知现场准备'], threshold:{ current:'80mm', limit:'50mm', trend:'即将发生' } });
    out.push({ id:'FAR003', type:'farming', title:'土壤预警：地块B3土壤湿度超标', level:'important', levelText:'重要', location:'麦积区阁基地 - 地块B3', time:'2026-09-20 08:00', status:'pending', statusText:'待处理', desc:'地块B3土壤湿度超过85%，长期高湿可能导致根系腐烂。建议及时排水降湿。', srcType:'soil', srcTypeText:'土壤预警', history:['系统自动生成预警'], threshold:{ current:'88%', limit:'85%', trend:'持续偏高' } });
    out.push({ id:'FAR004', type:'farming', title:'病虫害预警：白粉病高发期提醒', level:'reminder', levelText:'提醒', location:'青岛莱西基地 - 地块C1、C2', time:'2026-09-19 16:30', status:'completed', statusText:'已处理', desc:'当前气候条件适宜白粉病发生，建议加强监测并及时预防。', srcType:'disease', srcTypeText:'病虫害预警', history:['系统自动生成预警','已完成预防喷施'], threshold:{ current:'3级', limit:'5级', trend:'风险中等' } });
    out.push({ id:'FAR005', type:'farming', title:'生长预警：苹果果实膨大期需加强施肥', level:'notice', levelText:'通知', location:'龙口南山基地 - 地块D1、D2', time:'2026-09-19 14:00', status:'completed', statusText:'已处理', desc:'当前处于苹果果实快速膨大期，需及时补充钾肥和钙肥，促进果实发育。', srcType:'growth', srcTypeText:'生长预警', history:['系统自动生成预警','已完成追肥'], threshold:{ current:'正常', limit:'-', trend:'需关注' } });
    out.push({ id:'FAR006', type:'farming', title:'气象预警：高温预警，请注意防暑降温', level:'important', levelText:'重要', location:'天水麦积区基地 - 全部地块', time:'2026-09-19 11:30', status:'pending', statusText:'待处理', desc:'预计今日最高气温将达到35°C以上，请安排工作人员错峰作业，做好防暑降温措施。', srcType:'weather', srcTypeText:'气象预警', history:['系统自动生成预警'], threshold:{ current:'36°C', limit:'35°C', trend:'持续升高' } });
    out.push({ id:'FAR007', type:'farming', title:'病虫害预警：蚜虫数量超标', level:'important', levelText:'重要', location:'天水荣成基地 - 地块B1、B2', time:'2026-09-18 17:00', status:'processing', statusText:'处理中', desc:'蚜虫监测数据显示数量已超过防治阈值，建议及时喷洒农药进行防治。', srcType:'disease', srcTypeText:'病虫害预警', history:['系统自动生成预警','已安排喷药'], threshold:{ current:'15头/叶', limit:'10头/叶', trend:'快速上升' } });
    out.push({ id:'FAR008', type:'farming', title:'土壤预警：地块A4氮肥含量偏低', level:'notice', levelText:'通知', location:'天水麦积区基地 - 地块A4', time:'2026-09-18 15:00', status:'completed', statusText:'已处理', desc:'土壤检测显示氮肥含量低于适宜范围，建议追施氮肥。', srcType:'soil', srcTypeText:'土壤预警', history:['系统自动生成预警','已完成追肥'], threshold:{ current:'120mg/kg', limit:'150mg/kg', trend:'偏低' } });
    out.push({ id:'FAR009', type:'farming', title:'气象预警：大风预警，检查防风设施', level:'urgent', levelText:'紧急', location:'麦积区阁基地 - 风口区域', time:'2026-09-18 10:30', status:'pending', statusText:'待处理', desc:'预计今日有6-7级大风，阵风可达8级。请检查并加固果园防风设施。', srcType:'weather', srcTypeText:'气象预警', history:['系统自动生成预警'], threshold:{ current:'15m/s', limit:'12m/s', trend:'风速增大' } });
    out.push({ id:'FAR010', type:'farming', title:'生长预警：果树修剪周期提醒', level:'notice', levelText:'通知', location:'青岛莱西基地 - 地块C3', time:'2026-09-17 16:00', status:'pending', statusText:'待处理', desc:'当前是夏季修剪的最佳时期，建议及时进行夏剪，改善通风透光条件。', srcType:'growth', srcTypeText:'生长预警', history:['系统自动生成预警'], threshold:{ current:'正常', limit:'-', trend:'适时进行' } });
    out.push({ id:'FAR011', type:'farming', title:'病虫害预警：斑点落叶病风险', level:'important', levelText:'重要', location:'龙口南山基地 - 地块D1', time:'2026-09-17 14:30', status:'completed', statusText:'已处理', desc:'根据气象条件预测，未来一周斑点落叶病发生风险较高，建议提前预防。', srcType:'disease', srcTypeText:'病虫害预警', history:['系统自动生成预警','已完成预防'], threshold:{ current:'中风险', limit:'高风险', trend:'风险上升' } });
    out.push({ id:'FAR012', type:'farming', title:'土壤预警：地块B4pH值偏低', level:'reminder', levelText:'提醒', location:'天水荣成基地 - 地块B4', time:'2026-09-17 11:00', status:'completed', statusText:'已处理', desc:'土壤pH值为5.2，低于苹果树适宜范围(6.0-7.0)，建议施用石灰进行改良。', srcType:'soil', srcTypeText:'土壤预警', history:['系统自动生成预警','已施石灰改良'], threshold:{ current:'5.2', limit:'6.0', trend:'偏低' } });
    out.push({ id:'FAR013', type:'farming', title:'气象预警：低温预警，做好防寒措施', level:'urgent', levelText:'紧急', location:'天水麦积区基地 - 地块A5', time:'2026-09-16 18:00', status:'pending', statusText:'待处理', desc:'预计夜间最低气温将降至5°C以下，新梢可能受到冻害。请做好防寒保温措施。', srcType:'weather', srcTypeText:'气象预警', history:['系统自动生成预警'], threshold:{ current:'4°C', limit:'5°C', trend:'气温下降' } });
    out.push({ id:'FAR014', type:'farming', title:'病虫害预警：金龟子成虫活跃期', level:'reminder', levelText:'提醒', location:'麦积区阁基地 - 地块B1、B2', time:'2026-09-16 15:30', status:'processing', statusText:'处理中', desc:'金龟子成虫开始活跃，注意监测并采取诱杀措施。', srcType:'disease', srcTypeText:'病虫害预警', history:['系统自动生成预警','正在诱杀'], threshold:{ current:'12头/株', limit:'20头/株', trend:'逐渐增加' } });
    out.push({ id:'FAR015', type:'farming', title:'生长预警：疏果期提醒', level:'notice', levelText:'通知', location:'青岛莱西基地 - 地块C1、C2', time:'2026-09-16 10:00', status:'completed', statusText:'已处理', desc:'当前是疏果的关键时期，请及时进行疏果，保证果实品质。', srcType:'growth', srcTypeText:'生长预警', history:['系统自动生成预警','已完成疏果'], threshold:{ current:'正常', limit:'-', trend:'适时进行' } });
    out.push({ id:'FAR016', type:'farming', title:'土壤预警：地块A1有机质含量偏低', level:'reminder', levelText:'提醒', location:'天水麦积区基地 - 地块A1', time:'2026-09-15 16:30', status:'pending', statusText:'待处理', desc:'土壤有机质含量为1.2%，低于适宜范围(>2.0%)，建议增施有机肥。', srcType:'soil', srcTypeText:'土壤预警', history:['系统自动生成预警'], threshold:{ current:'1.2%', limit:'2.0%', trend:'偏低' } });
    out.push({ id:'FAR017', type:'farming', title:'气象预警：冰雹预警，做好防护准备', level:'urgent', levelText:'紧急', location:'天水荣成基地 - 全部地块', time:'2026-09-15 14:00', status:'completed', statusText:'已处理', desc:'预计未来2小时内有冰雹天气，请立即做好防雹准备。', srcType:'weather', srcTypeText:'气象预警', history:['系统自动生成预警','已过冰雹天气'], threshold:{ current:'有冰雹', limit:'-', trend:'已过' } });
    out.push({ id:'FAR018', type:'farming', title:'病虫害预警：叶螨防治提醒', level:'important', levelText:'重要', location:'龙口南山基地 - 地块D2', time:'2026-09-15 09:30', status:'pending', statusText:'待处理', desc:'叶螨监测数据接近防治阈值，建议及时防治。', srcType:'disease', srcTypeText:'病虫害预警', history:['系统自动生成预警'], threshold:{ current:'4头/叶', limit:'5头/叶', trend:'接近阈值' } });
    out.push({ id:'FAR019', type:'farming', title:'土壤预警：地块C3钾元素缺乏', level:'important', levelText:'重要', location:'青岛莱西基地 - 地块C3', time:'2026-09-14 17:00', status:'processing', statusText:'处理中', desc:'土壤钾元素含量偏低，影响果实品质和抗病能力。建议追施钾肥。', srcType:'soil', srcTypeText:'土壤预警', history:['系统自动生成预警','已追施钾肥'], threshold:{ current:'80mg/kg', limit:'120mg/kg', trend:'偏低' } });
    out.push({ id:'FAR020', type:'farming', title:'生长预警：套袋期提醒', level:'notice', levelText:'通知', location:'天水麦积区基地 - 地块A2、A3', time:'2026-09-14 14:30', status:'completed', statusText:'已处理', desc:'苹果幼果已进入套袋适宜期，请及时安排套袋工作。', srcType:'growth', srcTypeText:'生长预警', history:['系统自动生成预警','已完成套袋'], threshold:{ current:'正常', limit:'-', trend:'适时进行' } });
    out.push({ id:'FAR021', type:'farming', title:'病虫害预警：炭疽病预防提醒', level:'reminder', levelText:'提醒', location:'麦积区阁基地 - 地块B3', time:'2026-09-14 10:00', status:'completed', statusText:'已处理', desc:'当前气候条件适宜炭疽病发生，建议及时喷施保护性药剂。', srcType:'disease', srcTypeText:'病虫害预警', history:['系统自动生成预警','已喷施药剂'], threshold:{ current:'低风险', limit:'中风险', trend:'风险上升' } });
    out.push({ id:'FAR022', type:'farming', title:'气象预警：干旱预警，建议灌溉', level:'important', levelText:'重要', location:'天水荣成基地 - 地块B5', time:'2026-09-13 16:00', status:'pending', statusText:'待处理', desc:'连续10天无有效降雨，土壤墒情不足。建议及时灌溉。', srcType:'weather', srcTypeText:'气象预警', history:['系统自动生成预警'], threshold:{ current:'25%', limit:'35%', trend:'持续下降' } });
    out.push({ id:'FAR023', type:'farming', title:'土壤预警：地块D1盐分累积超标', level:'important', levelText:'重要', location:'龙口南山基地 - 地块D1', time:'2026-09-13 13:30', status:'processing', statusText:'处理中', desc:'土壤盐分含量达到3.5g/kg，超过安全阈值，建议进行冲洗改良。', srcType:'soil', srcTypeText:'土壤预警', history:['系统自动生成预警','正在冲洗'], threshold:{ current:'3.5g/kg', limit:'3.0g/kg', trend:'持续累积' } });

    return out;
  })();

  var STORAGE_KEY = 'applefarm_alert_state_v1';
  var subscribers = [];
  var inMemory = null;

  function deepClone(obj){ return JSON.parse(JSON.stringify(obj)); }

  function loadFromStorage(){
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return null;
      return arr;
    } catch(e){ return null; }
  }

  function saveToStorage(arr){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); } catch(e){}
  }

  function ensureLoaded(){
    if (inMemory) return inMemory;
    var stored = loadFromStorage();
    inMemory = stored && stored.length ? stored : deepClone(DEFAULT_DATA);
    if (!stored) saveToStorage(inMemory);
    return inMemory;
  }

  function notify(reason){
    subscribers.forEach(function(fn){
      try { fn(reason, inMemory); } catch(e){ console.warn('[AlertStore] subscriber error', e); }
    });
  }

  function broadcast(reason){
    // 触发 storage 事件供其它标签 / 页面监听
    try {
      saveToStorage(inMemory);
      // 同一窗口内手动通知（storage 事件不会在当前窗口触发）
      notify(reason);
      // 跨 iframe（同 origin）通过自定义事件
      try {
        var evt = new CustomEvent('alertStoreChange', { detail: { reason: reason } });
        window.dispatchEvent(evt);
      } catch(e){}
    } catch(e){ console.warn('[AlertStore] broadcast error', e); }
  }

  var AlertStore = {
    LEVEL: { URGENT:'urgent', IMPORTANT:'important', REMINDER:'reminder', NOTICE:'notice' },
    STATUS: { PENDING:'pending', PROCESSING:'processing', COMPLETED:'completed' },
    STORAGE_KEY: STORAGE_KEY,

    all: function(){
      return deepClone(ensureLoaded());
    },
    byType: function(type){
      return ensureLoaded().filter(function(x){ return x.type === type; }).map(deepClone);
    },
    byStatus: function(status){
      return ensureLoaded().filter(function(x){ return x.status === status; }).map(deepClone);
    },
    byLevel: function(level){
      return ensureLoaded().filter(function(x){ return x.level === level; }).map(deepClone);
    },
    byId: function(id){
      var item = ensureLoaded().find(function(x){ return x.id === id; });
      return item ? deepClone(item) : null;
    },
    stats: function(){
      var arr = ensureLoaded();
      var stats = { total: arr.length, pending:0, processing:0, completed:0,
                    urgent:0, important:0, reminder:0, notice:0,
                    device:0, farming:0, devicePending:0, farmingPending:0 };
      arr.forEach(function(x){
        if (stats[x.status] !== undefined) stats[x.status]++;
        if (stats[x.level] !== undefined) stats[x.level]++;
        if (x.type === 'device') stats.device++;
        if (x.type === 'farming') stats.farming++;
        if (x.type === 'device' && x.status === 'pending') stats.devicePending++;
        if (x.type === 'farming' && x.status === 'pending') stats.farmingPending++;
      });
      stats.closed = stats.completed;
      stats.rate = stats.total ? Math.round(stats.completed / stats.total * 100) : 0;
      stats.todayTotal = stats.devicePending + stats.farmingPending;
      return stats;
    },
    topN: function(n, filter){
      n = n || 3;
      var arr = ensureLoaded().slice();
      if (filter === 'pending') arr = arr.filter(function(x){ return x.status === 'pending'; });
      arr.sort(function(a,b){
        // 按级别（紧急>重要>提醒>通知）排序，再按时间倒序
        var lvOrder = { urgent:0, important:1, reminder:2, notice:3 };
        var la = lvOrder[a.level] !== undefined ? lvOrder[a.level] : 9;
        var lb = lvOrder[b.level] !== undefined ? lvOrder[b.level] : 9;
        if (la !== lb) return la - lb;
        return (b.time || '').localeCompare(a.time || '');
      });
      return arr.slice(0, n).map(deepClone);
    },
    levelDistribution: function(){
      var arr = ensureLoaded();
      var dist = { urgent:0, important:0, reminder:0, notice:0 };
      arr.forEach(function(x){ if (dist[x.level] !== undefined) dist[x.level]++; });
      return dist;
    },
    typeTrend: function(){
      // 按时间分布统计每日新增（按 mockData 9月日期分组）
      var arr = ensureLoaded();
      var days = {};
      arr.forEach(function(x){
        var d = (x.time || '').substring(0, 10); // YYYY-MM-DD
        if (!d) return;
        if (!days[d]) days[d] = { date:d, device:0, farming:0, total:0 };
        days[d][x.type]++;
        days[d].total++;
      });
      return Object.values(days).sort(function(a,b){ return a.date.localeCompare(b.date); });
    },
    updateStatus: function(id, status, statusText, historyLine){
      var arr = ensureLoaded();
      var item = arr.find(function(x){ return x.id === id; });
      if (!item) return false;
      item.status = status;
      if (statusText) item.statusText = statusText;
      if (historyLine) {
        item.history = item.history || [];
        item.history.push(historyLine);
      }
      broadcast('status:' + id);
      return true;
    },
    appendHistory: function(id, line){
      var arr = ensureLoaded();
      var item = arr.find(function(x){ return x.id === id; });
      if (!item) return false;
      item.history = item.history || [];
      item.history.push(line);
      broadcast('history:' + id);
      return true;
    },
    subscribe: function(fn){
      subscribers.push(fn);
      // 立即回调一次（推送当前快照）
      try { fn('init', ensureLoaded()); } catch(e){}
      return function unsubscribe(){
        subscribers = subscribers.filter(function(x){ return x !== fn; });
      };
    },
    reset: function(){
      inMemory = deepClone(DEFAULT_DATA);
      saveToStorage(inMemory);
      broadcast('reset');
    },
    _syncFromExternal: function(){
      var stored = loadFromStorage();
      if (stored && stored.length) {
        inMemory = stored;
        notify('sync');
      }
    }
  };

  // 跨标签页同步：监听 storage 事件
  window.addEventListener('storage', function(e){
    if (e.key === STORAGE_KEY) AlertStore._syncFromExternal();
  });

  global.AlertStore = AlertStore;
})(typeof window !== 'undefined' ? window : this);
