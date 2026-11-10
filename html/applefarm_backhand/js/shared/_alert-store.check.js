/**
 * AlertStore 自检脚本（Node 环境运行）
 * 用法：node html/applefarm_backhand/js/shared/_alert-store.check.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------- 极简 localStorage / window 模拟 ----------
const store = {};
const sandbox = {
  console,
  Date,
  JSON,
  Math,
  setTimeout,
  clearTimeout,
  localStorage: {
    getItem: (k) => (store[k] === undefined ? null : store[k]),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  },
  addEventListener() {},
  dispatchEvent() {},
  CustomEvent: function () {}
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const src = fs.readFileSync(path.join(__dirname, 'alert-data.js'), 'utf8');
vm.runInContext(src, sandbox, { filename: 'alert-data.js' });

const AlertStore = sandbox.AlertStore;

let pass = 0, fail = 0;
function check(name, fn) {
  try {
    const r = fn();
    if (r === true || r === undefined) { pass++; console.log('  OK  ' + name); }
    else { fail++; console.log('  FAIL ' + name + ' -> ' + r); }
  } catch (e) {
    fail++;
    console.log('  FAIL ' + name + ' -> ' + e.message);
  }
}
function assert(cond, msg) { if (!cond) return msg || 'assert failed'; return true; }

console.log('\n== 1. 初始化与字典 ==');
check('AlertStore 存在', () => assert(!!AlertStore));
check('SOURCES 6 类', () => assert(AlertStore.SOURCES.length === 6, 'len=' + AlertStore.SOURCES.length));
check('STATUS 六态', () => assert(Object.keys(AlertStore.STATUS_TEXT).length === 6));
check('种子 46 条', () => assert(AlertStore.all().length === 46, 'len=' + AlertStore.all().length));
check('rules 25 条', () => assert(AlertStore.rules().length === 25, 'len=' + AlertStore.rules().length));

console.log('\n== 2. 状态迁移（v1 / v2 → v3）==');
check('历史 completed 迁移为 closed', () => {
  const closed = AlertStore.all().filter(a => a.status === 'closed');
  return assert(closed.length === 18, 'closed=' + closed.length);
});
check('无遗留 completed 状态', () => assert(AlertStore.all().every(a => a.status !== 'completed')));
check('全部记录有 source', () => assert(AlertStore.all().every(a => !!a.source)));
check('全部记录有 category', () => assert(AlertStore.all().every(a => !!a.category)));
check('全部记录有 base', () => assert(AlertStore.all().every(a => a.base !== undefined && a.base !== null)));

console.log('\n== 2.1 时间戳与时效口径 ==');
check('种子均有 respondDue / handleDue', () => AlertStore.all().every(a => !!a.respondDue));
check('种子均有 plotSlot 字段', () => AlertStore.all().every(a => a.plotSlot !== undefined));
check('闭环记录均有 closedAt', () => {
  const closed = AlertStore.all().filter(a => a.status === 'closed');
  return assert(closed.length > 0 && closed.every(a => !!a.closedAt), 'closed=' + closed.length);
});
check('时间戳顺序 time ≤ acceptedAt ≤ closedAt', () => {
  const bad = AlertStore.all().filter(a => {
    if (!a.acceptedAt) return false;
    if (a.acceptedAt < a.time) return true;
    return !!(a.closedAt && a.closedAt < a.acceptedAt);
  });
  return assert(bad.length === 0, 'bad=' + bad.map(a => a.id).join(','));
});
check('种子时间均在最近 30 天内且不晚于今天 23:59', () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0).getTime();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
  const bad = AlertStore.all().filter(a => {
    const t = new Date(a.time.replace(/-/g, '/')).getTime();
    return !isFinite(t) || t < start || t > end;
  });
  return assert(bad.length === 0, 'bad=' + bad.map(a => a.id + '@' + a.time).join(','));
});
check('slaMetrics 三项时长均有样本', () => {
  const m = AlertStore.slaMetrics();
  return assert(m.sampleResp > 0 && m.sampleHandle > 0 && m.sampleClose > 0 && m.avgResp !== null && m.avgHandle !== null && m.avgClose !== null, JSON.stringify(m));
});


console.log('\n== 3. 六态流转校验 ==');
check('pending → processing 允许', () => {
  const r = AlertStore.transition('DEV001', 'processing', { action: '受理' });
  return assert(r.ok === true, r.message);
});
check('processing → closed 允许', () => {
  const r = AlertStore.transition('DEV001', 'closed', { action: '处置完成' });
  return assert(r.ok === true, r.message);
});
check('closed → processing 禁止', () => {
  const r = AlertStore.transition('DEV001', 'processing', { action: '非法' });
  return assert(r.ok === false && r.message.indexOf('不允许') >= 0, r.message);
});
check('pending → ignored 允许', () => {
  const r = AlertStore.transition('DEV003', 'ignored', { action: '误报' });
  return assert(r.ok === true, r.message);
});
check('ignored → pending 允许（重开）', () => {
  const r = AlertStore.transition('DEV003', 'pending', { action: '重新打开' });
  return assert(r.ok === true, r.message);
});
check('pending → transferred 允许', () => {
  const r = AlertStore.transition('DEV006', 'transferred', { action: '转维修单', assignee: '运维组' });
  return assert(r.ok === true, r.message);
});
check('transferred → closed 允许', () => {
  const r = AlertStore.transition('DEV006', 'closed', { action: '工单完成' });
  return assert(r.ok === true, r.message);
});
check('不存在的 ID 报错', () => {
  const r = AlertStore.transition('NOPE', 'closed', {});
  return assert(r.ok === false && r.message === '预警不存在', r.message);
});
check('未知状态报错', () => {
  const r = AlertStore.transition('DEV010', 'xxx', {});
  return assert(r.ok === false && r.message.indexOf('未知状态') >= 0, r.message);
});
check('流转后写历史', () => {
  AlertStore.transition('DEV011', 'processing', { action: '受理' });
  const a = AlertStore.byId('DEV011');
  return assert(a.history.length >= 2, 'history=' + a.history.length);
});
check('流转写 acceptedAt', () => {
  AlertStore.transition('DEV015', 'processing', { action: '受理' });
  const a = AlertStore.byId('DEV015');
  return assert(!!a.acceptedAt, 'acceptedAt empty');
});
check('流转写 closedAt', () => {
  AlertStore.transition('DEV015', 'closed', { action: '完成' });
  const a = AlertStore.byId('DEV015');
  return assert(!!a.closedAt, 'closedAt empty');
});

console.log('\n== 4. 兼容旧调用 updateStatus ==');
check('updateStatus pending→completed 成功', () => {
  const ok = AlertStore.updateStatus('DEV017', 'completed', '已处理', '2026-01-01 10:00 已处理');
  return assert(ok === true);
});
check('updateStatus 后状态为 closed', () => {
  const a = AlertStore.byId('DEV017');
  return assert(a.status === 'closed', a.status);
});
check('updateStatus 非法流转返回 false 但不崩', () => {
  const ok = AlertStore.updateStatus('DEV017', 'processing', '处理中', '2026-01-01 11:00 尝试回退');
  return assert(ok === false);
});
check('updateStatus 非法流转保留原状态', () => {
  const a = AlertStore.byId('DEV017');
  return assert(a.status === 'closed', a.status);
});

console.log('\n== 5. 新建预警 / 幂等 ==');
check('create 成功', () => {
  const r = AlertStore.create({ source:'manual', category:'pest', title:'人工上报：红蜘蛛', base:'天水麦积区基地', plot:'地块A1' });
  return assert(r.ok === true && !!r.id, r.message);
});
check('create 自动补 status/source/category', () => {
  const a = AlertStore.all()[0];
  return assert(a.status === 'pending' && !!a.source && !!a.category);
});
check('create 自动算 respondDue', () => {
  const a = AlertStore.all()[0];
  return assert(!!a.respondDue, 'respondDue empty');
});
check('dedupeKey 幂等（不重复创建）', () => {
  const before = AlertStore.all().length;
  AlertStore.create({ source:'inventory', category:'inventory', title:'库存低', dedupeKey:'inventory:M-001:stock' });
  const mid = AlertStore.all().length;
  AlertStore.create({ source:'inventory', category:'inventory', title:'库存低', dedupeKey:'inventory:M-001:stock' });
  const after = AlertStore.all().length;
  return assert(mid === before + 1 && after === mid, 'before=' + before + ' mid=' + mid + ' after=' + after);
});
check('assign 写入受理人', () => {
  const r = AlertStore.assign('DEV019', '张才孙');
  return assert(r.ok === true && AlertStore.byId('DEV019').assignee === '张才孙', r.message);
});

console.log('\n== 6. 统计 ==');
check('stats 含六态字段', () => {
  const s = AlertStore.stats();
  return assert(['pending','processing','closed','ignored','transferred','voided'].every(k => typeof s[k] === 'number'));
});
check('stats.completed 是 closed 别名', () => {
  const s = AlertStore.stats();
  return assert(s.completed === s.closed, 'completed=' + s.completed + ' closed=' + s.closed);
});
check('stats.bySource 六类齐全', () => {
  const s = AlertStore.stats();
  return assert(Object.keys(s.bySource).length === 6, 'len=' + Object.keys(s.bySource).length);
});
check('statsBySource 计数与总量一致', () => {
  const s = AlertStore.statsBySource('device');
  const all = AlertStore.bySource('device').length;
  return assert(s.total === all, 'stats=' + s.total + ' all=' + all);
});
check('statsBySource avgResponseMinutes 可算', () => {
  const s = AlertStore.statsBySource('device');
  return assert(s.respondedCount > 0 && typeof s.avgResponseMinutes === 'number', 'responded=' + s.respondedCount);
});
check('levelDistribution 按来源过滤', () => {
  const d = AlertStore.levelDistribution('device');
  const all = AlertStore.bySource('device').length;
  const sum = d.urgent + d.important + d.reminder + d.notice;
  return assert(sum === all, 'sum=' + sum + ' all=' + all);
});
check('typeTrend 近 30 天返回 30 个分箱', () => {
  const t = AlertStore.typeTrend(30);
  return assert(t.length === 30, 'len=' + t.length);
});
check('bySourceAndCategory 过滤正确', () => {
  const l = AlertStore.bySourceAndCategory('device', 'device');
  return assert(l.length > 0 && l.every(a => a.source === 'device' && a.category === 'device'), 'len=' + l.length);
});

console.log('\n== 6.1 时间窗 / 字典 / 地块解析 ==');
check('sourceMeta 6 类且含 cert', () => {
  const m = AlertStore.sourceMeta();
  return assert(m.length === 6 && m.some(x => x.key === 'cert' && x.color), 'len=' + m.length);
});
check('categoryMeta 10 类且含 manual', () => {
  const m = AlertStore.categoryMeta();
  return assert(m.length === 10 && m.some(x => x.key === 'manual' && x.color), 'len=' + m.length);
});
check('slaMinutes urgent/respond = 15', () => assert(AlertStore.slaMinutes('urgent', 'respond') === 15));
check('slaMinutes notice/handle 无时限返回 null', () => assert(AlertStore.slaMinutes('notice', 'handle') === null));
check('windowAlerts(24) 为全量真子集', () => {
  const w = AlertStore.windowAlerts(24);
  const all = AlertStore.all();
  const since = Date.now() - 24 * 3600 * 1000;
  return assert(w.length <= all.length && w.every(a => new Date(a.time.replace(/-/g, '/')).getTime() >= since), 'win=' + w.length + ' all=' + all.length);
});
check('statsWindow.total 与 windowAlerts 一致', () => {
  const w = AlertStore.windowAlerts(24);
  return assert(AlertStore.statsWindow(24).total === w.length);
});
check('topToday 只含今日未闭环', () => {
  const today = (() => {
    const d = new Date();
    const p = n => (n < 10 ? '0' + n : '' + n);
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  })();
  const t = AlertStore.topToday(10);
  return assert(t.every(a => a.time.slice(0, 10) === today && ['pending','processing','transferred'].includes(a.status)), 'len=' + t.length);
});
check('dailyTrend(7) 长度 7 且日期连续', () => {
  const t = AlertStore.dailyTrend(7);
  if (t.length !== 7) return 'len=' + t.length;
  for (let i = 1; i < t.length; i++) {
    const prev = new Date(t[i - 1].date.replace(/-/g, '/')).getTime();
    const cur = new Date(t[i].date.replace(/-/g, '/')).getTime();
    if (cur - prev !== 86400000) return 'gap at ' + i;
  }
  return true;
});
check('plotSlots 返回 12 个槽位', () => {
  store['smartorchard_plot_master'] = JSON.stringify([
    { code:'D-001', name:'东区1号地', enterprise:'天水麦积区基地', variety:'花牛苹果', manager:'惠加宁' },
    { code:'D-002', name:'东区2号地', enterprise:'天水麦积区基地', variety:'红富士', manager:'马开明' },
    { code:'D-003', name:'西区1号地', enterprise:'天水麦积区基地', variety:'黄元帅', manager:'贾建平' },
    { code:'D-004', name:'北区1号地', enterprise:'天水秦州区基地', variety:'花牛苹果', manager:'周春林' },
    { code:'D-005', name:'南区1号地', enterprise:'天水甘谷县基地', variety:'红富士', manager:'马明' }
  ]);
  const slots = AlertStore.plotSlots();
  return assert(slots.length === 12 && slots[0].slot === 'A1' && slots[0].plotCode === 'D-001', JSON.stringify(slots[0]));
});
check('resolvePlot 按基地别名 + 槽位匹配', () => {
  const r = AlertStore.resolvePlot({ base:'天水麦积区基地', plotSlot:'A1' });
  return assert(r.matched === true && r.plotCode === 'D-001' && r.plot.manager === '惠加宁', JSON.stringify(r).substring(0, 160));
});
check('resolvePlot 别名基地归一', () => {
  const r = AlertStore.resolvePlot({ base:'天水秦州基地', plotSlot:'B1' });
  return assert(r.matched === true && r.base === '天水秦州区基地' && r.plotCode === 'D-004', JSON.stringify(r).substring(0, 160));
});
check('resolvePlot 外部基地标记未匹配', () => {
  const r = AlertStore.resolvePlot({ base:'青岛莱西基地', plotSlot:'C1' });
  return assert(r.matched === false && r.reason === 'external', JSON.stringify(r));
});
check('aggregateByPlot 总数守恒', () => {
  const all = AlertStore.all();
  const g = AlertStore.aggregateByPlot(all);
  return assert(g.total === all.length && g.matchedCount + g.unmatchedCount === all.length, JSON.stringify({ total:g.total, m:g.matchedCount, u:g.unmatchedCount }));
});

console.log('\n== 7. 规则引擎 ==');
check('evaluate 命中规则并生成预警', () => {
  const r = AlertStore.evaluate({
    source:'model', category:'weather', metric:'temperature', value: 38, unit:'°C',
    title:'气象预警：高温', base:'天水麦积区基地', dedupeKey:'model:weather:temperature'
  });
  return assert(r.hit === true && !!r.alertId, JSON.stringify(r));
});
check('evaluate 未命中返回 hit:false', () => {
  const r = AlertStore.evaluate({ source:'model', category:'weather', metric:'temperature', value: 20 });
  return assert(r.hit === false, JSON.stringify(r));
});
check('evaluate 命中后写 ruleId', () => {
  const r = AlertStore.evaluate({
    source:'model', category:'weather', metric:'temperature', value: 39, unit:'°C',
    title:'气象预警：高温2', base:'天水秦州基地', dedupeKey:'model:weather:temperature2'
  });
  const a = AlertStore.byId(r.alertId);
  return assert(a.ruleId === 'W007', 'ruleId=' + a.ruleId);
});
check('规则停用后不再命中', () => {
  AlertStore.toggleRule('W007', 'inactive');
  const r = AlertStore.evaluate({
    source:'model', category:'weather', metric:'temperature', value: 40, unit:'°C',
    title:'气象预警：高温3', dedupeKey:'model:weather:temperature3'
  });
  AlertStore.toggleRule('W007', 'active');
  return assert(r.hit === false, JSON.stringify(r));
});
check('规则保存/删除', () => {
  const r = AlertStore.saveRule({ name:'测试规则', source:'inventory', category:'inventory', level:'reminder', threshold:{ metric:'stock', op:'lt', value:10, unit:'kg' } });
  if (!r.ok) return r.message;
  const id = r.id;
  const code = AlertStore.rule(id).code;
  const del = AlertStore.removeRule(id);
  return assert(del.ok === true && !AlertStore.rule(id) && /^W\d{3}$/.test(code), 'code=' + code);
});
check('新规则编号不撞号', () => {
  const r1 = AlertStore.saveRule({ name:'规则A', source:'system', category:'growth', level:'notice' });
  const r2 = AlertStore.saveRule({ name:'规则B', source:'system', category:'growth', level:'notice' });
  const c1 = AlertStore.rule(r1.id).code, c2 = AlertStore.rule(r2.id).code;
  AlertStore.removeRule(r1.id); AlertStore.removeRule(r2.id);
  return assert(c1 !== c2, c1 + ' vs ' + c2);
});
check('规则编号格式 Wxxx', () => {
  return assert(AlertStore.rules().every(r => /^W\d{3}$/.test(r.code)));
});

console.log('\n== 8. syncSource 幂等同步 ==');
check('syncSource 首次创建', () => {
  const r = AlertStore.syncSource('inventory', [
    { dedupeKey:'inventory:M-002:stock', title:'库存低：杀虫剂', category:'inventory', level:'reminder' }
  ]);
  return assert(r.created === 1, JSON.stringify(r));
});
check('syncSource 重复调用不重复创建', () => {
  const before = AlertStore.bySource('inventory').length;
  AlertStore.syncSource('inventory', [
    { dedupeKey:'inventory:M-002:stock', title:'库存低：杀虫剂', category:'inventory', level:'reminder' }
  ]);
  const after = AlertStore.bySource('inventory').length;
  return assert(before === after, 'before=' + before + ' after=' + after);
});
check('syncSource 清单消失则自动关闭', () => {
  AlertStore.syncSource('inventory', []);
  const a = AlertStore.all().find(x => x.dedupeKey === 'inventory:M-002:stock');
  return assert(a && a.status === 'closed', 'status=' + (a && a.status));
});
check('syncSource 关闭写历史', () => {
  const a = AlertStore.all().find(x => x.dedupeKey === 'inventory:M-002:stock');
  return assert(a.history.some(h => h.indexOf('自动关闭') >= 0), JSON.stringify(a.history));
});

console.log('\n== 9. 配置（静默 / SLA）==');
check('config 默认静默 22:00-07:00', () => {
  const c = AlertStore.config();
  return assert(c.silence.start === '22:00' && c.silence.end === '07:00', JSON.stringify(c.silence));
});
check('saveConfig 写静默', () => {
  AlertStore.saveConfig({ silence: { start:'23:00', end:'06:00', scope:'all' } });
  const c = AlertStore.config();
  return assert(c.silence.start === '23:00' && c.silence.end === '06:00', JSON.stringify(c.silence));
});
check('slaOf 返回级别 SLA', () => {
  const s = AlertStore.slaOf('urgent');
  return assert(s.respond === '15 分钟' && s.handle === '2 小时', JSON.stringify(s));
});
check('isSilenced 可调用', () => {
  const v = AlertStore.isSilenced('urgent');
  return assert(typeof v === 'boolean');
});
check('config 默认看板阈值', () => {
  const t = AlertStore.config().targets;
  return assert(t.avgRespond === 30 && t.avgHandle === 120 && t.avgClose === 1440 && t.overdueRate === 10, JSON.stringify(t));
});
check('saveConfig 写看板阈值', () => {
  const r = AlertStore.saveConfig({ targets: { avgRespond: 20 } });
  return assert(r.ok === true && AlertStore.config().targets.avgRespond === 20, JSON.stringify(r));
});
check('saveConfig 拒绝非法阈值', () => {
  const r = AlertStore.saveConfig({ targets: { avgRespond: -5 } });
  return assert(r.ok === false && AlertStore.config().targets.avgRespond === 20, JSON.stringify(r));
});

console.log('\n== 10. 持久化与迁移 ==');
check('存储为 v3 对象结构', () => {
  const raw = JSON.parse(store['applefarm_alert_state_v1']);
  return assert(raw.version === 3 && Array.isArray(raw.alerts) && Array.isArray(raw.rules), 'version=' + raw.version);
});
check('v1 裸数组可被迁移', () => {
  store['applefarm_alert_state_v1'] = JSON.stringify([
    { id:'DEV001', type:'device', title:'旧数据', level:'danger', levelText:'高', status:'completed', statusText:'已处理', time:'2026-09-01 10:00', location:'天水麦积区基地 - 地块A1', history:['系统自动生成预警'] }
  ]);
  AlertStore._syncFromExternal();
  const a = AlertStore.all()[0];
  return assert(a.status === 'closed' && a.level === 'urgent' && !!a.source && !!a.category, JSON.stringify(a).substring(0,200));
});
check('迁移前已备份旧数据', () => {
  return assert(!!store['applefarm_alert_state_v1_backup_v1']);
});
check('JSON 损坏时回退种子不崩', () => {
  store['applefarm_alert_state_v1'] = '{ broken json';
  AlertStore.reset();
  return assert(AlertStore.all().length === 46, 'len=' + AlertStore.all().length);
});

console.log('\n== 11. 订阅广播 ==');
check('subscribe 立即回调 init', () => {
  let called = false;
  const un = AlertStore.subscribe(function(reason){ if (reason === 'init') called = true; });
  un();
  return assert(called === true);
});
check('变更后触发订阅', () => {
  let fired = null;
  const un = AlertStore.subscribe(function(reason){ fired = reason; });
  AlertStore.create({ source:'system', category:'growth', title:'订阅测试' });
  un();
  return assert(fired && fired.indexOf('created:') === 0, String(fired));
});

console.log('\n---------------------------------------------');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
console.log('---------------------------------------------\n');
process.exit(fail ? 1 : 0);
