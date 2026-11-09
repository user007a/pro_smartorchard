/**
 * harvest-store 逻辑自检（Node 环境，仅用于开发期验证，不参与页面运行）
 * 用法: node js/shared/_harvest-store.check.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const storePath = path.join(__dirname, 'harvest-store.js');
const code = fs.readFileSync(storePath, 'utf8');

const store = {};
const sandbox = {
  console,
  localStorage: {
    _data: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._data, k) ? this._data[k] : null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  },
  window: null,
  dispatchEvent() {}
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const H = sandbox.HarvestStore;
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  →  ' + extra : '')); }
}

console.log('\n=== 1. 种子数据完整性 ===');
const plans = H.plans();
const records = H.records();
const processes = H.processes();
const storages = H.storages();
const shipments = H.shipments();

check('计划 22 条', plans.length === 22, '实际 ' + plans.length);
check('记录 22 条', records.length === 22, '实际 ' + records.length);
check('处理单 22 条', processes.length === 22, '实际 ' + processes.length);

const recNoBatch = records.filter(r => !r.batchNo);
check('每条记录都有批次号', recNoBatch.length === 0,
  '缺失 ' + recNoBatch.length + ' 条：' + recNoBatch.slice(0,3).map(r=>r.id+'→'+JSON.stringify(r.planId)).join('; '));

const recBadPlan = records.filter(r => !H.get('plans', r.planId));
check('每条记录关联的计划都存在', recBadPlan.length === 0,
  '悬空 ' + recBadPlan.length + ' 条：' + recBadPlan.slice(0,3).map(r=>r.id+'→'+r.planId).join('; '));

const procNoBatch = processes.filter(p => !p.batchNo);
check('每条处理单都有批次号', procNoBatch.length === 0, '缺失 ' + procNoBatch.length);

const procBadRec = processes.filter(p => !H.get('records', p.recordId));
check('每条处理单关联的记录都存在', procBadRec.length === 0,
  '悬空 ' + procBadRec.length + ' 条：' + procBadRec.slice(0,3).map(p=>p.id+'→'+p.recordId).join('; '));

const shipBadProc = shipments.filter(s => !H.get('processes', s.sourceId));
check('每张发货单关联的处理单都存在', shipBadProc.length === 0, '悬空 ' + shipBadProc.length);

const storBadProc = storages.filter(s => !H.get('processes', s.batchId));
check('每个库位引用的处理单都存在', storBadProc.length === 0, '悬空 ' + storBadProc.length);

console.log('\n=== 2. 时序：采收 → 处理 不得倒挂 ===');
const badTime = processes.filter(p => {
  const r = H.get('records', p.recordId);
  return r && r.endTime && p.createdAt < r.endTime;
});
check('处理时间均不早于采收结束时间', badTime.length === 0,
  badTime.slice(0,3).map(p=>`${p.id} 采收结束${H.get('records',p.recordId).endTime} 处理${p.createdAt}`).join('; '));

console.log('\n=== 3. 数量守恒 ===');
const sumR = records.reduce((s,r)=>s+r.qty,0);
const sumP = processes.reduce((s,p)=>s+p.qty,0);
check('实采总量 = 处理总量', sumR === sumP, `${sumR} vs ${sumP}`);

const sumS = storages.reduce((s,x)=>s+x.qty,0);
const sumShipped = shipments.filter(x=>x.status!=='pending').reduce((s,x)=>s+x.qty,0);
const sumPendingShip = shipments.filter(x=>x.status==='pending').reduce((s,x)=>s+x.qty,0);
const inProcess = processes.filter(p=>p.status!=='stored'&&p.status!=='exported').reduce((s,p)=>s+p.qty,0);
check('在库 + 已发 + 处理中 = 处理总量', Math.abs(sumS + sumShipped + inProcess - sumP) <= 1,
  `在库${sumS} + 已发${sumShipped} + 处理中${inProcess} = ${sumS+sumShipped+inProcess}，处理总量 ${sumP}`);
check('待发货单数量不计入库存占用', sumPendingShip > 0, `待发 ${sumPendingShip} kg`);

const rec = H.reconcile();
const badDiff = rec.filter(r => r.pendingProcess !== 0);
check('每批次均已建立采后处理单（无待处理缺口）', badDiff.length === 0,
  badDiff.slice(0,3).map(r=>`${r.batchNo} 缺${r.pendingProcess}`).join('; '));

const badBalance = rec.filter(r => r.balance !== 0);
check('每批次处理量 = 在库 + 已发 + 处理中', badBalance.length === 0,
  badBalance.slice(0,3).map(r=>`${r.batchNo} 差${r.balance}`).join('; '));

const badAbnormal = rec.filter(r => r.abnormal);
check('对账无异常批次', badAbnormal.length === 0, `${badAbnormal.length} 个异常`);

console.log('\n=== 4. 枚举与主数据 ===');
const baseSet = new Set(H.bases());
check('基地集合非空且与地块归属一致', baseSet.size > 0 && baseSet.size <= 7, '数量 ' + baseSet.size);
const plotBad = records.filter(r => {
  const p = H.plotOf(r.plot);
  return !p || p.base !== r.base;
});
check('记录的基地与其地块归属一致', plotBad.length === 0,
  '不一致 ' + plotBad.length + ' 条：' + plotBad.slice(0,3).map(r=>`${r.id} ${r.plot}/${r.base}`).join('; '));

const gradeBad = records.filter(r => !H.gradeName(r.level));
check('等级取值都在字典内', gradeBad.length === 0, '异常 ' + gradeBad.length);

console.log('\n=== 5. 状态机守卫 ===');
const pending = plans.find(p => p.status === 'pending');
const exec = plans.find(p => p.status === 'executing');
const done = plans.find(p => p.status === 'completed');

let r1 = H.advance('plans', pending.id, 'completed');
check('待执行 → 已完成 被拒绝', !r1.ok, r1.message);
let r2 = H.advance('plans', pending.id, 'executing');
check('待执行 → 执行中 允许', r2.ok, r2.message);
let r3 = H.advance('plans', pending.id, 'completed');
check('执行中 → 已完成 无采收记录时被拦截', !r3.ok, r3.message);
let r4 = H.advance('plans', done.id, 'executing');
check('已完成 → 执行中 被拒绝', !r4.ok, r4.message);
let r5 = H.advance('plans', 'HS-2026-999', 'executing');
check('不存在的计划被拒绝', !r5.ok, r5.message);

const recPending = records.find(r => r.status === 'pending');
const recDone = records.find(r => r.status === 'completed');
if (recPending) {
  let r6 = H.advance('records', recPending.id, 'completed');
  check('待处理 → 已完成 被拒绝', !r6.ok, r6.message);
} else {
  check('存在待处理记录用于测试', false, '没有 pending 状态记录');
}
if (recDone) {
  let r7 = H.advance('records', recDone.id, 'processing');
  check('已完成 → 处理中 被拒绝', !r7.ok, r7.message);
}

console.log('\n=== 6. 新建计划自动补编号与批次号 ===');
const newPlan = H.savePlan({
  name: '自检计划', plot: 'D-021', plannedQty: 500,
  startTime: '2026-11-20T08:00', endTime: '2026-11-20T17:00',
  manager: '惠加宁', remark: ''
});
check('新建计划成功', newPlan.ok, newPlan.message);
check('自动生成计划编号', /^HS-2026-\d{3}$/.test(newPlan.item.id), newPlan.item.id);
check('自动生成批次号', /^PC-\d{8}-\d{3}$/.test(newPlan.item.batchNo), newPlan.item.batchNo);
check('基地随地块带出', newPlan.item.base === H.plotOf('D-021').base, newPlan.item.base);

console.log('\n=== 7. 记录保存与计划完成度回写 ===');
const planForRec = H.savePlan({
  name: '自检计划B', plot: 'D-022', plannedQty: 1000,
  startTime: '2026-11-21T08:00', endTime: '2026-11-21T17:00',
  manager: '徐水应', remark: ''
});
if (planForRec.ok) {
  const newRec = H.saveRecord({
    planId: planForRec.item.id, plot: 'D-022', base: planForRec.item.base,
    variety: planForRec.item.variety, qty: 300, level: 'level1',
    harvesters: '惠加宁', startTime: '2026-11-21T08:00', endTime: '2026-11-21T12:00',
    remark: ''
  });
  check('新建记录成功', newRec.ok, newRec.message);
  check('记录继承计划批次号', newRec.item.batchNo === planForRec.item.batchNo,
    `${newRec.item.batchNo} vs ${planForRec.item.batchNo}`);
  const afterCreate = H.get('plans', planForRec.item.id);
  check('有记录后计划自动转为执行中', afterCreate.status === 'executing', afterCreate.status);

  const before = H.get('plans', planForRec.item.id).actualQty;
  H.advance('records', newRec.item.id, 'processing');
  const mid = H.get('plans', planForRec.item.id).actualQty;
  H.advance('records', newRec.item.id, 'completed');
  const after = H.get('plans', planForRec.item.id).actualQty;
  check('记录完成后计划实采量回写 300kg', after === 300, `before=${before} mid=${mid} after=${after}`);
  const doneRes = H.advance('plans', planForRec.item.id, 'completed');
  check('有已完成记录后计划可完成', doneRes.ok, doneRes.message);
}

console.log('\n=== 8. 追溯码规则 ===');
const noTrace = H.records().find(r => !r.traceCode);
if (noTrace) {
  const t = H.generateTraceCode(noTrace.id);
  check('生成追溯码成功', t.ok, t.message);
  check('追溯码为 SNZG-YYYYMMDD-NNNN 格式', /^SNZG-\d{8}-\d{4}$/.test(t.code), t.code);
  const t2 = H.generateTraceCode(noTrace.id);
  check('重复生成被拒绝', !t2.ok, t2.message);
} else {
  check('存在无追溯码记录用于测试', false, '所有记录都已有追溯码');
}
const codes = JSON.parse(sandbox.localStorage.getItem('smartorchard_trace_codes') || '[]');
check('追溯码已回写溯源编码页存储', Array.isArray(codes) && codes.length > 0, '条数 ' + (codes || []).length);

console.log('\n=== 9. 时间归一化（datetime-local 的 T 分隔） ===');
const tPlan = H.savePlan({
  name: '时间归一化检查', plot: 'D-023', plannedQty: 100,
  startTime: '2026-11-22T08:00', endTime: '2026-11-22T17:00',
  manager: '朱泉龙', remark: ''
});
check('T 分隔的时间可正常保存', tPlan.ok, tPlan.message);
let tRec = null;
if (tPlan.ok) {
  check('落库时间统一为空格分隔', tPlan.item.startTime === '2026-11-22 08:00', tPlan.item.startTime);
  tRec = H.saveRecord({
    planId: tPlan.item.id, plot: 'D-023', base: tPlan.item.base,
    variety: tPlan.item.variety, qty: 50, level: 'level1', harvesters: '朱泉龙',
    startTime: '2026-11-22T08:00', endTime: '2026-11-22T12:00', remark: ''
  });
  check('T 分隔的采收时间可正常保存', tRec.ok, tRec.message);
}

console.log('\n=== 10. 删除守卫 ===');
const planWithRec = H.plans().find(p => H.records().some(r => r.planId === p.id));
const delRes = H.remove('plans', planWithRec.id);
check('有采收记录的计划不能删除', !delRes.ok, delRes.message);
const freePlan = H.plans().find(p => !H.records().some(r => r.planId === p.id) && p.status === 'pending');
if (freePlan) {
  const ok = H.remove('plans', freePlan.id);
  check('无采收记录的计划可删除', ok.ok, ok.message);
}

console.log('\n=== 11. 持久化 ===');
const raw = sandbox.localStorage.getItem('smartorchard_harvest_v1');
check('数据已落 localStorage', !!raw && raw.length > 100, '长度 ' + (raw || '').length);
const parsed = JSON.parse(raw);
check('落库结构含 5 个集合', ['plans','records','processes','storages','shipments'].every(k => Array.isArray(parsed[k])));

console.log('\n=== 12. 采后处理 / 储藏 / 发货链路 ===');
let chainRec = null;
if (tRec && tRec.ok) {
  H.advance('records', tRec.item.id, 'processing');
  H.advance('records', tRec.item.id, 'completed');
  chainRec = H.get('records', tRec.item.id);
}
check('存在已完成且无处理单的记录', !!chainRec && chainRec.status === 'completed',
  chainRec ? chainRec.id + ' ' + chainRec.status : '无');

const cp = chainRec ? H.createProcess(chainRec.id, { operator: '朱泉龙', remark: '链路测试' }) : { ok: false, message: '缺记录' };
check('可建立采后处理单', cp.ok, cp.message);
check('处理单初始状态为分级中', cp.ok && cp.item.status === 'grading', cp.item && cp.item.status);
check('处理单继承记录批次号', cp.ok && cp.item.batchNo === chainRec.batchNo, cp.item && cp.item.batchNo);

const cp2 = chainRec ? H.createProcess(chainRec.id, {}) : { ok: false };
check('同一记录不能重复建处理单', !cp2.ok, cp2.message);

const pid = cp.ok ? cp.item.id : '';
const badIn = H.inboundProcess(pid, { slot: 'A区-001', qty: 50, time: H.stampNow() });
check('分级中不能直接入库', !badIn.ok, badIn.message);
const toPack = H.advance('processes', pid, 'packaging');
check('分级中 → 包装中 允许', toPack.ok, toPack.message);

const occupied = H.storages().map(s => s.id);
const freeSlot = H.slots().find(s => occupied.indexOf(s.id) === -1);
check('存在空闲库位可用于入库', !!freeSlot, '已占用 ' + occupied.length + ' 个');
const inb = H.inboundProcess(pid, { slot: freeSlot ? freeSlot.id : '', qty: 50, time: H.stampNow(), operator: '朱泉龙' });
check('包装中可入库', inb.ok, inb.message);
let st = H.storages().find(s => s.batchId === pid);
check('入库后储藏页出现该批次', !!st && st.qty === 50, st ? st.id + ' ' + st.qty + 'kg' : '未找到');
check('入库后处理单为已入库', H.get('processes', pid).status === 'stored');

const dupIn = H.inboundProcess(pid, { slot: freeSlot ? freeSlot.id : '', qty: 50, time: H.stampNow() });
check('已入库不能重复入库', !dupIn.ok, dupIn.message);

const overShip = H.saveShipment({ sourceId: pid, qty: 999, customer: '测试客户', address: '测试地址' });
check('发货数量超可发量被拒绝', !overShip.ok, overShip.message);
const sh = H.saveShipment({ sourceId: pid, qty: 20, customer: '测试客户', phone: '13800000000', address: '天水市测试路1号', date: H.today() });
check('可新建待发货单', sh.ok && sh.item.status === 'pending', sh.message);
check('待发货单不扣减库存', H.storages().find(s => s.batchId === pid).qty === 50);

const badConfirm = H.confirmShipment(sh.item.id, {});
check('缺物流单号不能确认发货', !badConfirm.ok, badConfirm.message);
const conf = H.confirmShipment(sh.item.id, { logistics: '顺丰冷链', tracking: 'SF123456789' });
check('确认发货成功', conf.ok, conf.message);
check('已发货扣减库存 20kg', H.storages().find(s => s.batchId === pid).qty === 30);

const badSign = H.signShipment(sh.item.id, { person: '张三' });
check('已发货不能直接签收（需先运输中）', !badSign.ok, badSign.message);
H.advance('shipments', sh.item.id, 'transit');
const sign = H.signShipment(sh.item.id, { person: '张三', time: H.stampNow() });
check('运输中可签收', sign.ok, sign.message);
check('签收人/签收时间已落库', sign.ok && sign.item.signPerson === '张三' && !!sign.item.signTime);
check('签收后库存不再变化', H.storages().find(s => s.batchId === pid).qty === 30);

st = H.storages().find(s => s.batchId === pid);
const out1 = H.outboundStorage(st.id, { qty: 10, customer: '内部调拨', time: H.stampNow() });
check('储藏出库生成已发货单', out1.ok && out1.item.status === 'shipped', out1.message);
check('出库后库存扣减 10kg', H.storages().find(s => s.batchId === pid).qty === 20);
const out2 = H.outboundStorage(st.id, { qty: 999, customer: '内部调拨' });
check('出库数量超在库量被拒绝', !out2.ok, out2.message);

const rec2 = H.reconcile();
const chainRow = rec2.find(r => r.batchNo === chainRec.batchNo);
check('链路批次对账无缺口', !!chainRow && !chainRow.abnormal,
  chainRow ? JSON.stringify(chainRow) : '未找到对账行');

console.log(`\n===== 通过 ${pass} / 失败 ${fail} =====\n`);
process.exit(fail ? 1 : 0);
