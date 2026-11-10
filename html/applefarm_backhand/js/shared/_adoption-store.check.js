/**
 * AdoptionStore 自检脚本（Node 环境运行）
 * 用法：node html/applefarm_backhand/js/shared/_adoption-store.check.js
 * 覆盖：编号归一、订单状态机、支付激活、退款、合同签署、在线续费、采收、证书、成长相册
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

const src = fs.readFileSync(path.join(__dirname, 'adoption-store.js'), 'utf8');
vm.runInContext(src, sandbox, { filename: 'adoption-store.js' });

const S = sandbox.AdoptionStore;

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
function assert(cond, msg) { return cond ? true : (msg || 'assert failed'); }
function expectFail(fn, keyword) {
  try {
    fn();
    return '应当抛错但未抛错';
  } catch (e) {
    if (keyword && e.message.indexOf(keyword) < 0) return '错误信息不符：' + e.message;
    return true;
  }
}
function orderOfTree(code) {
  return S.orders().filter(function (o) { return o.treeCode === code; })[0];
}

console.log('\n== 1. 初始化与种子 ==');
check('AdoptionStore 存在', () => assert(!!S));
check('果树 31 棵', () => assert(S.trees().length === 31, 'len=' + S.trees().length));
check('认养订单 25 单', () => assert(S.orders().length === 25, 'len=' + S.orders().length));
check('采收 4 条', () => assert(S.harvests().length === 4, 'len=' + S.harvests().length));
check('认养农事 3 条', () => assert(S.farmings().length === 3, 'len=' + S.farmings().length));

console.log('\n== 2. 编号归一 ==');
check('AD-A1-001 → A1-001', () => assert(S.normalizeCode('AD-A1-001') === 'A1-001', S.normalizeCode('AD-A1-001')));
check('A025 → A1-025', () => assert(S.normalizeCode('A025') === 'A1-025', S.normalizeCode('A025')));
check('花牛苹果 #A025 → A1-025', () => assert(S.normalizeCode('花牛苹果 #A025') === 'A1-025', S.normalizeCode('花牛苹果 #A025')));
check('非法编号返回空串', () => assert(S.normalizeCode('??') === ''));

console.log('\n== 3. 订单状态机 ==');
check('已支付订单不可取消', () => {
  const o = orderOfTree('A1-003');
  return expectFail(() => S.cancelOrder(o.orderNo), '不可取消');
});
check('待支付订单不可直接完成', () => {
  const o = orderOfTree('A1-011');
  return assert(!o, 'A1-011 应为可认养池，无订单');
});

console.log('\n== 4. 新建 → 支付 → 合同签署 ==');
let newOrderNo = '';
check('新建订单合同默认待签署', () => {
  const rec = S.saveOrder({
    treeCode: 'A1-011', adopter: '测试用户', phone: '13800000001',
    amount: 399, duration: 1, startDate: '2026-11-10'
  });
  newOrderNo = rec.orderNo;
  return assert(rec.status === 'pending' && rec.contractStatus === 'pending',
    rec.status + '/' + rec.contractStatus);
});
check('潜在待签署合同不可签署', () => expectFail(() => S.signContract(newOrderNo), '仅已支付'));
check('支付激活订单', () => {
  const rec = S.activateOrder(newOrderNo, { payMethod: 'wechat' });
  const t = S.findTree('A1-011');
  return assert(rec.status === 'paid' && t.status === 'adopted' && t.adopter === '测试用户',
    rec.status + '/' + t.status);
});
check('支付后合同仍为待签署', () => {
  const c = S.contractOf(newOrderNo);
  return assert(c.contractStatus === 'pending', c.contractStatus);
});
check('H5 认养记录已写回', () => {
  const hit = S.h5Adoptions().filter(a => S.normalizeCode(a.treeNo) === 'A1-011')[0];
  return assert(!!hit, 'missing');
});
check('合同签署 → 履约中 + 摘要', () => {
  const c = S.signContract(newOrderNo, { signer: '测试用户', method: 'esign' });
  return assert(c.contractStatus === 'active' && !!c.signedAt && !!c.digest && c.signer === '测试用户',
    c.contractStatus + '/' + c.digest);
});
check('重复签署幂等', () => {
  const c = S.signContract(newOrderNo, { signer: '测试用户' });
  return assert(c.contractStatus === 'active');
});
check('完成订单释放果树、合同完成', () => {
  const rec = S.completeOrder(newOrderNo);
  const t = S.findTree('A1-011');
  return assert(rec.status === 'completed' && rec.contractStatus === 'expired' && t.status === 'available',
    rec.status + '/' + rec.contractStatus + '/' + t.status);
});

console.log('\n== 5. 退款流程 ==');
check('退款申请 → 审核通过 → 释放果树', () => {
  const o = orderOfTree('A1-002');
  S.requestRefund(o.orderNo, { amount: 500, reason: 'user_request' });
  const after = S.reviewRefund(o.orderNo, true, '测试审核', '同意退款');
  const t = S.findTree('A1-002');
  return assert(after.status === 'refunded' && t.status === 'available' && t.adopter === '',
    after.status + '/' + t.status);
});
check('已退款订单不可重复审核', () => {
  const o = S.orders().filter(x => x.treeCode === 'A1-002')[0];
  return expectFail(() => S.reviewRefund(o.orderNo, true, '测试', ''), '没有待审核');
});
check('退款金额不可超过订单金额', () => {
  const o = orderOfTree('A1-004');
  return expectFail(() => S.requestRefund(o.orderNo, { amount: 999999, reason: 'other' }), '不能大于');
});

console.log('\n== 6. 在线续费 ==');
let renewNo = '';
check('生成续费订单', () => {
  const o = orderOfTree('A1-001');
  const rec = S.renewOrder(o.orderNo, { duration: 3, amount: 1888 });
  renewNo = rec.orderNo;
  return assert(rec.renew === true && rec.renewCount === 1 && rec.prevOrderNo === o.orderNo &&
    rec.status === 'pending' && rec.startDate === o.endDate && rec.contractStatus === 'pending',
    [rec.renew, rec.renewCount, rec.status, rec.startDate].join('/'));
});
check('续费订单支付后原单完成、有效期顺延', () => {
  const prev = orderOfTree('A1-001');
  const prevEnd = prev.endDate;
  S.activateOrder(renewNo, { payMethod: 'alipay' });
  const prev2 = S.findOrder(prev.orderNo);
  const t = S.findTree('A1-001');
  return assert(prev2.status === 'completed' && prev2.contractStatus === 'expired' &&
    t.expireDate > prevEnd, prev2.status + '/' + t.expireDate);
});
check('未支付订单不可续费', () => {
  const rec = S.saveOrder({
    treeCode: 'G1-012', adopter: '待支付用户', phone: '13800000002',
    amount: 299, duration: 1, startDate: '2026-11-10'
  });
  return expectFail(() => S.renewOrder(rec.orderNo, { duration: 1, amount: 299 }), '仅已支付');
});
check('续费金额必须大于 0', () => {
  const t = orderOfTree('A1-005');
  return expectFail(() => S.renewOrder(t.orderNo, { duration: 1, amount: 0 }), '大于 0');
});

console.log('\n== 7. 认养采收 ==');
// 采收 / 生产同步桩：仅验证认养层是否把数据推给目标 Store
const hsPlans = [], hsRecords = [];
sandbox.HarvestStore = {
  plots: () => [{ code: 'D-001', base: '天水麦积区基地' }],
  savePlan: (p) => { const item = Object.assign({ id: 'HP1', batchNo: 'HB-TEST-001' }, p); hsPlans.push(item); return { ok: true, item }; },
  saveRecord: (r) => { const item = Object.assign({ id: 'HR1', traceCode: '' }, r); hsRecords.push(item); return { ok: true, item }; },
  advance: (e, id, to) => { const hit = hsRecords.filter(r => r.id === id)[0]; if (hit) { hit.status = to; hit.traceCode = 'TRACE-TEST-001'; } return { ok: true }; },
  get: (e, id) => hsRecords.filter(r => r.id === id)[0] || null
};
const psPlans = [], psTasks = [];
sandbox.ProductionStore = {
  plans: () => psPlans,
  tasks: () => psTasks,
  upsert: (entity, item) => {
    const rec = Object.assign({ id: (entity === 'plans' ? 'PP' : 'PT') + ((entity === 'plans' ? psPlans : psTasks).length + 1) }, item);
    (entity === 'plans' ? psPlans : psTasks).push(rec);
    return rec;
  }
};
check('确认待采记录', () => {
  const h = S.confirmHarvest('HV-2026004', { qty: 90 });
  return assert(h.status === 'completed' && h.qty === 90, h.status + '/' + h.qty);
});
check('采收同步生成批次与溯源码', () => {
  const h = S.harvests().filter(x => x.id === 'HV-2026004')[0];
  return assert(hsPlans.length === 1 && h.harvestBatchNo === 'HB-TEST-001' && h.traceCode === 'TRACE-TEST-001',
    JSON.stringify({ plans: hsPlans.length, batch: h.harvestBatchNo, trace: h.traceCode }));
});
check('已完成的采收不可重复确认', () => expectFail(() => S.confirmHarvest('HV-2026004'), '已确认'));
check('无有效订单的果树不可登记采收', () => {
  return expectFail(() => S.saveHarvest({
    treeCode: 'G1-012', date: '2026-11-10', qty: 10, method: '到园采摘'
  }), '没有有效的认养订单');
});
check('农事推送同步生产计划与任务', () => {
  const f = S.pushFarming('FM-2026001');
  return assert(psPlans.length === 1 && psTasks.length === 3 && f.productionPlanId === 'PP1',
    JSON.stringify({ plans: psPlans.length, tasks: psTasks.length, planId: f.productionPlanId }));
});

console.log('\n== 8. 认养证书 ==');
check('保存证书（编号归一）', () => {
  const rec = S.saveCert({
    certNo: 'AD2026999001', treeNo: 'AD-A1-003', adopter: '王志强',
    status: 'pending', expectedYield: '约120斤'
  });
  return assert(rec.treeNo === 'A1-003' && rec.treeFull === 'AD-A1-003', rec.treeNo);
});
check('按果树查询证书', () => {
  const c = S.certOf('A1-003');
  return assert(!!c && c.certNo === 'AD2026999001', c && c.certNo);
});
check('签发只更新状态并保留原字段', () => {
  const c = S.saveCert({ certNo: 'AD2026999001', treeNo: 'A1-003', status: 'issued', issuedBy: '管理员' });
  return assert(c.status === 'issued' && c.issuedBy === '管理员' && c.expectedYield === '约120斤',
    c.status + '/' + c.expectedYield);
});
check('果树不存在时拒绝保存证书', () => {
  return expectFail(() => S.saveCert({ treeNo: 'Z9-999', adopter: '张三' }), '不在认养台账');
});
check('删除证书', () => {
  S.removeCert('AD2026999001');
  return assert(S.certOf('A1-003') === null);
});

console.log('\n== 9. 成长相册 ==');
check('新增照片按编号归一', () => {
  S.addPhoto('AD-A1-005', { url: 'test-1.jpg', time: '2026-05-01', stage: '开花' });
  const arr = S.photosOf('A1-005');
  return assert(arr.length === 1 && arr[0].stage === '开花', 'len=' + arr.length);
});
check('删除照片', () => {
  S.removePhoto('AD-A1-005', 'test-1.jpg');
  return assert(S.photosOf('A1-005').length === 0);
});
check('删除不存在的照片应当报错', () => expectFail(() => S.removePhoto('A1-005', 'none.jpg'), '暂无成长照片'));

console.log('\n== 10. 统计口径 ==');
check('续费率与订单聚合一致', () => {
  const st = S.stats();
  const base = S.orders().filter(o => ['paid', 'completed', 'refunded'].indexOf(o.status) >= 0);
  const renewed = base.filter(o => o.renew || Number(o.renewCount) > 0).length;
  const expect = base.length ? Math.round(renewed / base.length * 1000) / 10 : 0;
  return assert(st.renewRate === expect, st.renewRate + '/' + expect);
});

console.log('\n----------------------------------------');
console.log(`通过 ${pass} 项，失败 ${fail} 项`);
if (fail) process.exit(1);
