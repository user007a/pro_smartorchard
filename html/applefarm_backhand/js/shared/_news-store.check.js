/**
 * 资讯数据层自检：MobileOpsStore 的 news 相关接口
 * 用法：node _news-store.check.js
 *   需在 Node 环境下提供 localStorage / sessionStorage / window 最小实现
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ---- 最小浏览器环境 ---- */
const mem = {};
const localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; }
};
const sess = {};
const sessionStorage = {
  getItem: (k) => (k in sess ? sess[k] : null),
  setItem: (k, v) => { sess[k] = String(v); },
  removeItem: (k) => { delete sess[k]; }
};
const listeners = [];
const win = {
  localStorage, sessionStorage,
  addEventListener: (t, fn) => { if (t === 'storage') listeners.push(fn); },
  removeEventListener: () => {}
};
win.window = win;
const ctx = vm.createContext(Object.assign(win, { console, Date, JSON, Math, Array, Object, String, Number, isFinite, parseInt, parseFloat, RegExp, Error }));

const storePath = path.join(__dirname, 'mobile-ops-store.js');
vm.runInContext(fs.readFileSync(storePath, 'utf8'), ctx, { filename: storePath });

const S = ctx.MobileOpsStore;
let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  → ' + extra : '')); }
}

console.log('\n== MobileOpsStore 资讯接口自检 ==\n');

/* 1. KEYS 新增 news */
ok(S.KEYS.news === 'mb_news', 'KEYS.news 指向 mb_news', S.KEYS.news);

/* 2. 分类字典 */
ok(Array.isArray(S.NEWS_CATEGORIES) && S.NEWS_CATEGORIES.length === 4, 'NEWS_CATEGORIES 4 类',
  JSON.stringify(S.NEWS_CATEGORIES));
ok(S.NEWS_CATEGORY_TEXT.notice === '公告' && S.NEWS_CATEGORY_TEXT.policy === '政策', '分类字典文案正确');

/* 3. 空列表时 newsList 返回空数组 */
ok(Array.isArray(S.newsList({ publishedOnly: true })) && S.newsList({ publishedOnly: true }).length === 0,
  '初始 newsList 为空');

/* 4. saveNews 校验：缺标题 / 缺正文 */
ok(S.saveNews({ content: '正文' }).ok === false, '缺标题被拒绝');
ok(S.saveNews({ title: '标题' }).ok === false, '缺正文被拒绝');
ok(S.saveNews({ title: 'x'.repeat(41), content: '正文' }).ok === false, '标题超 40 字被拒绝');

/* 5. 新增成功，编号符合 NEWS-YYYYMMDD-NNN */
const r1 = S.saveNews({
  category: 'notice', title: '关于加强秋采果园管理的通知',
  summary: '摘要', content: '正文内容\n第二行',
  author: '技术推广中心', source: '市农业农村局',
  publishTime: '2026-10-21 09:00', status: 'published', top: true
});
ok(r1.ok === true, '新增资讯成功', r1.msg);
ok(/^NEWS-\d{8}-\d{3}$/.test(r1.id), '编号符合 NEWS-YYYYMMDD-NNN', r1.id);

/* 6. 字段落库完整 */
const row = S.newsOf(r1.id);
ok(row.category === 'notice' && row.status === 'published' && row.top === true, '分类/状态/置顶落库正确');
ok(row.author === '技术推广中心' && row.source === '市农业农村局', '作者与来源落库正确');
ok(row.viewCount === 0, '初始阅读量为 0');
ok(!!row.publisher, '发布人已写入');

/* 7. 同日第二条编号递增 */
const r2 = S.saveNews({
  category: 'training', title: '2026年秋季采收与分级技术培训安排',
  content: '培训正文', publishTime: '2026-10-21 15:00'
});
ok(r2.id !== r1.id && r2.id > r1.id, '同日第二条编号递增', r1.id + ' / ' + r2.id);

/* 8. 置顶优先排序 */
const list = S.newsList({ publishedOnly: true });
ok(list[0].id === r1.id, '置顶资讯排在最前', list[0].id);
ok(list[1].id === r2.id, '其余按发布时间倒序', list[1].id);

/* 9. publishedOnly 过滤 */
S.saveNews({
  category: 'policy', title: '已下架的农资政策解读', content: '正文',
  publishTime: '2026-10-22 09:00', status: 'offline'
});
const pub = S.newsList({ publishedOnly: true });
const all = S.newsList({ publishedOnly: false });
ok(pub.length === 2 && all.length === 3, 'publishedOnly 过滤生效', pub.length + '/' + all.length);

/* 10. 分类筛选与关键词筛选 */
ok(S.newsList({ publishedOnly: true, category: 'training' }).length === 1, '分类筛选生效');
ok(S.newsList({ publishedOnly: true, keyword: '培训' }).length === 1, '关键词筛选生效');
ok(S.newsList({ publishedOnly: true, keyword: '不存在的词' }).length === 0, '无匹配返回空');

/* 11. limit 参数 */
ok(S.newsList({ publishedOnly: true, limit: 1 }).length === 1, 'limit 参数生效');

/* 12. 编辑更新 */
const up = S.saveNews({
  id: r2.id, category: 'technology', title: '2026年秋季采收与分级技术培训安排（改）',
  content: '更新后的正文', status: 'published'
});
ok(up.ok === true, '编辑资讯成功', up.msg);
const row2 = S.newsOf(r2.id);
ok(row2.title.indexOf('（改）') >= 0 && row2.category === 'technology', '编辑后字段已更新');
ok(row2.viewCount === 0, '编辑不清零阅读量');

/* 13. 编辑不存在的 id 被拒绝 */
ok(S.saveNews({ id: 'NEWS-99999999-999', title: 'x', content: 'y' }).ok === false, '编辑不存在的资讯被拒绝');

/* 14. 上下架流转 */
const tg = S.toggleNews(r2.id);
ok(tg.ok === true && tg.status === 'offline', '下架成功', tg.msg);
ok(S.newsList({ publishedOnly: true }).length === 1, '下架后不再对移动端可见');
const tg2 = S.toggleNews(r2.id);
ok(tg2.ok === true && tg2.status === 'published', '重新发布成功');

/* 15. 置顶开关 */
const tp = S.toggleNewsTop(r2.id);
ok(tp.ok === true && tp.top === true, '置顶成功');
ok(S.newsList({ publishedOnly: true })[0].id === r2.id, '置顶后排序到最前');
S.toggleNewsTop(r2.id);
ok(S.newsOf(r2.id).top === false, '取消置顶成功');

/* 16. 阅读量累加与会话去重 */
ok(S.increaseNewsView(r1.id) === true, '首次阅读累加成功');
ok(S.newsOf(r1.id).viewCount === 1, '阅读量为 1', S.newsOf(r1.id).viewCount);
ok(S.increaseNewsView(r1.id) === false, '同会话重复阅读不重复计数');
ok(S.newsOf(r1.id).viewCount === 1, '阅读量保持 1');
ok(S.increaseNewsView(r2.id) === true, '另一条可独立累加');
ok(S.newsOf(r2.id).viewCount === 1, '另一条阅读量为 1');

/* 17. 删除 */
const rm = S.removeNews(r2.id);
ok(rm.ok === true, '删除资讯成功', rm.msg);
ok(S.newsOf(r2.id) === null, '删除后查不到');
ok(S.removeNews(r2.id).ok === false, '重复删除返回失败');

/* 18. stats 派生指标 */
const st = S.stats();
ok(st.news.total === 2, 'stats.news.total 正确（r1 + 1 条已下架）', st.news.total);
ok(st.news.published === 1, 'stats.news.published 正确（仅 r1 已发布）', st.news.published);
ok(st.news.offline === 1, 'stats.news.offline 正确', st.news.offline);
ok(st.news.totalViews === 1, 'stats.news.totalViews 正确', st.news.totalViews);
ok(typeof st.news.monthNew === 'number', 'stats.news.monthNew 存在');

/* 19. 历史数据归一：缺字段自动补齐 */
localStorage.setItem('mb_news', JSON.stringify([
  { id: 'NEWS-20260101-001', title: '历史资讯', content: '正文' }
]));
const legacy = S.newsOf('NEWS-20260101-001');
ok(legacy.category === 'notice', '历史数据补齐分类');
ok(legacy.status === 'published', '历史数据补齐状态');
ok(legacy.top === false, '历史数据补齐置顶');
ok(legacy.viewCount === 0, '历史数据补齐阅读量');

/* 20. 损坏 JSON 不抛异常 */
localStorage.setItem('mb_news', '{ broken json');
let threw = false;
try { S.newsList({ publishedOnly: true }); } catch (e) { threw = true; }
ok(!threw, '损坏 JSON 时 newsList 不抛异常');
localStorage.setItem('mb_news', JSON.stringify([{ id: 'X', title: '恢复后', content: '正文' }]));
ok(S.newsList({ publishedOnly: true }).length === 1, '损坏数据被静默重建后仍可读');

console.log('\n== 结果：' + pass + ' 项通过 / ' + fail + ' 项失败 ==\n');
process.exit(fail ? 1 : 0);
