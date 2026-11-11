/**
 * store-loader.js — 在 Node 沙箱中加载浏览器 store，抽取 seed 数据
 * --------------------------------------------------------------
 * mock window/localStorage/document，执行 store 源码后返回其 global 导出对象。
 *
 * 用法：
 *   const { loadStore } = require('./store-loader');
 *   const s = loadStore('html/applefarm_backhand/js/shared/sales-store.js', 'SalesStore');
 *   const data = s.customers(); // 或 s 暴露的任意方法
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createSandbox() {
  const store = {};
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
  const sandbox = {
    window: {},
    document: undefined,
    localStorage,
    console,
    Date,
    JSON,
    Math,
    Promise,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    parseFloat,
    parseInt,
    isNaN,
    Number,
    String,
    Boolean,
    Array,
    Object,
    RegExp,
    encodeURIComponent,
    decodeURIComponent,
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  sandbox.self = sandbox;
  sandbox.addEventListener = function () {};
  sandbox.removeEventListener = function () {};
  sandbox.dispatchEvent = function () { return true; };
  sandbox.CustomEvent = function CustomEvent(type, opts) { this.type = type; this.detail = (opts && opts.detail) || null; };
  sandbox.globalThis = sandbox;
  sandbox._context = vm.createContext(sandbox);
  return sandbox;
}

/** 在独立沙箱中加载单个 store */
function loadStore(relPath, globalName) {
  const abs = path.join(__dirname, '..', relPath);
  const src = fs.readFileSync(abs, 'utf8');
  const sandbox = createSandbox();
  vm.runInContext(src, sandbox._context, { filename: abs });
  return sandbox[globalName];
}

/** 在同一沙箱中依次加载多个 store（共享 localStorage），返回 { sandbox, globals } */
function loadStores(list) {
  const sandbox = createSandbox();
  const globals = {};
  list.forEach(function (item) {
    const abs = path.join(__dirname, '..', item.path);
    const src = fs.readFileSync(abs, 'utf8');
    vm.runInContext(src, sandbox._context, { filename: abs });
    globals[item.name] = sandbox[item.name];
  });
  return { sandbox, globals };
}

module.exports = { loadStore, loadStores };
