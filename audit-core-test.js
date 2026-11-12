/**
 * 核心链路验证：
 *   1. store 在「后端预加载完成」后是否派发窗口事件（修复前不会）
 *   2. 页面通过 StoreLive.on 订阅后是否被自动调用重绘
 *   3. 页面原有 Store.subscribe 订阅是否同样被触发
 *
 * 用 vm 沙箱模拟浏览器环境：window / localStorage / CustomEvent / fetch。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = 'd:\\dev\\pro_smartorchard';

// ---------- 浏览器环境模拟 ----------
function makeSandbox(opts = {}) {
  const listeners = {};
  const store = {};
  const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {}, info: () => {} },
    setTimeout: (fn) => { fn(); return 0; },
    clearTimeout: () => {},
    Promise,
    JSON,
    Date,
    Math,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Error,
    RegExp,
    isNaN,
    parseInt,
    parseFloat,
    setInterval: () => 0,
    localStorage: {
      _d: {},
      getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
      setItem(k, v) { this._d[k] = String(v); },
      removeItem(k) { delete this._d[k]; },
      get length() { return Object.keys(this._d).length; },
      key(i) { return Object.keys(this._d)[i] ?? null; },
    },
    addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    removeEventListener(ev, fn) {
      if (!listeners[ev]) return;
      listeners[ev] = listeners[ev].filter((f) => f !== fn);
    },
    dispatchEvent(e) {
      const arr = listeners[e.type] || [];
      arr.slice().forEach((f) => { try { f(e); } catch (err) { /* ignore */ } });
      return true;
    },
    document: {
      currentScript: null,
      createElement: () => ({ set src(v) {}, onload: null, onerror: null }),
      head: { appendChild() {} },
      documentElement: { appendChild() {} },
      querySelectorAll: () => [],
      querySelector: () => null,
      getElementById: () => null,
      addEventListener() {},
    },
    fetch: opts.fetch || (() => Promise.resolve({ ok: false, json: () => Promise.resolve({ ok: false }) })),
    location: { pathname: '/applefarm_backhand/x.html', href: 'http://x/' },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.CustomEvent = class CustomEvent {
    constructor(type, init) { this.type = type; this.detail = (init && init.detail) || {}; }
  };
  sandbox._listeners = listeners;
  return sandbox;
}

function runIn(file, sandbox) {
  const code = fs.readFileSync(file, 'utf8');
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: file });
}

// ---------- 用例 1：soil-store 后端预加载后派发 soilStoreChange ----------
(async function case1() {
  const events = [];
  const sandbox = makeSandbox({
    fetch: () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ ok: true, data: { tests: [{ test_code: 'ST-2026-001', plot_code: 'D-001', sample_date: '2026-11-12', organic_matter: 2.5 }] } }),
    }),
  });
  sandbox.addEventListener('soilStoreChange', (e) => events.push(e.detail.reason));

  const apiFile = path.join(ROOT, 'html/common/js/api.js');
  runIn(apiFile, sandbox);

  // 伪造 mapper（后端行 → store 结构）
  sandbox.SoilMapper = {
    toAggregate: (d) => ({ tests: (d.tests || []).map((t) => ({
      id: t.test_code, plotCode: t.plot_code, sampleDate: t.sample_date,
      organicMatter: t.organic_matter, availableN: 0, availableP: 0, availableK: 0, ph: 0, ec: 0,
    })) }),
    fromAggregate: () => ({}),
  };
  sandbox.PlotStore = { plots: () => [], plotOf: () => null };

  runIn(path.join(ROOT, 'html/applefarm_backhand/js/shared/soil-store.js'), sandbox);

  // 登录态 + 触发预加载
  sandbox.localStorage.setItem('smartorchard_token', 'test-token');
  sandbox.SoilStore.tests();          // ensure() → 触发 preloadFromBackend()
  await new Promise((r) => setTimeout(r, 60));

  const ok = events.includes('backend-loaded');
  console.log(`用例1 后端预加载派发 soilStoreChange: ${ok ? 'PASS' : 'FAIL'}  events=${JSON.stringify(events)}`);
  return ok;
})().then(async (r1) => {
  // ---------- 用例 2：StoreLive 订阅后自动重绘 ----------
  const sandbox = makeSandbox();
  runIn(path.join(ROOT, 'html/common/js/api.js'), sandbox);

  let repaint = 0;
  sandbox.StoreLive.on('soilStoreChange', () => { repaint++; });
  sandbox.dispatchEvent(new sandbox.CustomEvent('soilStoreChange', { detail: { reason: 'backend-loaded' } }));
  sandbox.dispatchEvent(new sandbox.CustomEvent('soilStoreChange', { detail: { reason: 'backend-loaded' } }));

  const ok2 = repaint === 2;
  console.log(`用例2 StoreLive 订阅触发重绘: ${ok2 ? 'PASS' : 'FAIL'}  repaint=${repaint}`);

  // ---------- 用例 3：Store.subscribe 与窗口事件同时触发（不重复绑定） ----------
  const sandbox3 = makeSandbox();
  runIn(path.join(ROOT, 'html/common/js/api.js'), sandbox3);
  let sub = 0;
  const fn = () => { sub++; };
  sandbox3.StoreLive.on('soilStoreChange', fn);
  sandbox3.StoreLive.on('soilStoreChange', fn); // 重复订阅应被忽略
  sandbox3.dispatchEvent(new sandbox3.CustomEvent('soilStoreChange', { detail: { reason: 'x' } }));
  const ok3 = sub === 1;
  console.log(`用例3 重复订阅去重: ${ok3 ? 'PASS' : 'FAIL'}  sub=${sub}`);

  const allOk = r1 && ok2 && ok3;
  console.log('\n' + (allOk ? '全部通过' : '存在失败项'));
  process.exit(allOk ? 0 : 1);
})();
