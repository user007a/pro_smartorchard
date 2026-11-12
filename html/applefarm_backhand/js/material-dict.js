/**
 * 物资管理共享字典 · 严格空库模式
 * 仓库 / 农资分类一律来自真实接口 material_warehouse、material_category，
 * 不内置任何演示默认值；空库时字典为空，后端不可用时明确报错且不降级。
 * 单据状态 / 库存状态属于纯 UI 枚举，保留。
 */
(function (global) {
  var KEY_WAREHOUSE = 'sz_material_warehouses_v1';
  var KEY_CATEGORY = 'sz_material_categories_v1';

  /* 严格空库：不内置演示仓库 / 品类，全部由 API 返回 */
  var DEFAULT_WAREHOUSES = [];
  var DEFAULT_CATEGORIES = [];

  // 全模块统一单据状态机
  var BILL_STATUS = {
    draft: '草稿',
    pending: '待审核',
    approved: '已审核',
    rejected: '已驳回',
    refunded: '已退款',
    completed: '已完成',
    scrapped: '已报废',
    void: '已作废'
  };

  // 库存状态统一口径
  var STOCK_STATUS = {
    normal: '正常',
    low: '库存不足',
    high: '库存充足'
  };

  function clone(list) {
    return JSON.parse(JSON.stringify(list));
  }

  /* 严格空库：本地无数据就返回空数组，绝不用演示默认值兜底 */
  function read(key) {
    try {
      var raw = global.localStorage.getItem(key);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function write(key, list) {
    try {
      global.localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {
      /* 忽略隐私模式下的写入异常 */
    }
  }

  function getWarehouses() {
    return read(KEY_WAREHOUSE);
  }

  function setWarehouses(list) {
    write(KEY_WAREHOUSE, list || []);
  }

  function getCategories() {
    return read(KEY_CATEGORY);
  }

  function setCategories(list) {
    write(KEY_CATEGORY, list || []);
  }

  function enabledWarehouses() {
    return getWarehouses().filter(function (w) { return w.status !== 'disabled'; });
  }

  function enabledCategories() {
    return getCategories().filter(function (c) { return c.status !== 'disabled'; });
  }

  function warehouseNames() {
    return enabledWarehouses().map(function (w) { return w.name; });
  }

  function categoryNames() {
    return enabledCategories().map(function (c) { return c.name; });
  }

  function categoryMap() {
    var map = {};
    getCategories().forEach(function (c) { map[c.id] = c.name; });
    return map;
  }

  /**
   * 用字典填充下拉框
   * @param {HTMLSelectElement|string} select 元素或 id
   * @param {Array<string|{value:string,label:string}>} items
   * @param {string} placeholder 首项文案，传空则不加
   */
  function fillSelect(select, items, placeholder) {
    var el = typeof select === 'string' ? document.getElementById(select) : select;
    if (!el) return;
    var html = '';
    if (placeholder) html += '<option value="">' + placeholder + '</option>';
    (items || []).forEach(function (item) {
      if (typeof item === 'string') {
        html += '<option value="' + item + '">' + item + '</option>';
      } else {
        html += '<option value="' + item.value + '">' + item.label + '</option>';
      }
    });
    el.innerHTML = html;
  }

  function reset() {
    try {
      global.localStorage.removeItem(KEY_WAREHOUSE);
      global.localStorage.removeItem(KEY_CATEGORY);
    } catch (e) { /* ignore */ }
  }

  /**
   * 同步单个下拉框：沿用页面已有的取值编码（如 warehouse1 / center），
   * 仅按字典名称重建选项，新增字典项使用字典 id 作为值。
   */
  function syncSelect(el, items) {
    if (!el) return;
    var current = el.value;
    var oldOptions = Array.prototype.slice.call(el.options);
    var emptyOption = oldOptions.filter(function (o) { return o.value === ''; })[0];
    var valueByLabel = {};
    oldOptions.forEach(function (o) {
      valueByLabel[(o.textContent || '').trim()] = o.value;
    });
    el.innerHTML = '';
    if (emptyOption) {
      el.appendChild(new Option((emptyOption.textContent || '').trim(), ''));
    }
    items.forEach(function (item) {
      var label = typeof item === 'string' ? item : item.name;
      var value = valueByLabel[label] || (typeof item === 'string' ? label : item.id);
      el.appendChild(new Option(label, value));
    });
    el.value = current;
    if (el.value !== current) el.selectedIndex = 0;
  }

  function initDictSelects(root) {
    var scope = root || document;
    var warehouses = enabledWarehouses().map(function (w) {
      return { id: w.id, name: w.name };
    });
    var categories = enabledCategories().map(function (c) {
      return { id: c.id, name: c.name };
    });
    Array.prototype.forEach.call(scope.querySelectorAll('[data-dict="warehouse"]'), function (el) {
      syncSelect(el, warehouses);
    });
    Array.prototype.forEach.call(scope.querySelectorAll('[data-dict="category"]'), function (el) {
      syncSelect(el, categories);
    });
  }

  if (typeof document !== 'undefined') {
    var bootDict = function () { initDictSelects(); preloadFromBackend(); };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootDict);
    } else {
      bootDict();
    }
  }


  /* ---------- 严格空库：从真实接口加载字典 ---------- */
  function mapWarehouseRow(r) {
    return {
      id: r.warehouse_code || String(r.id),
      name: r.warehouse_name || '',
      manager: r.manager || '',
      managerPhone: r.manager_phone || '',
      address: r.address || '',
      type: r.warehouse_type || '',
      capacity: r.capacity == null ? '' : String(r.capacity),
      isDefault: !!r.is_default,
      status: r.status === 'disabled' ? 'disabled' : 'enabled',
      remark: r.remark || ''
    };
  }
  function mapCategoryRow(r) {
    return {
      id: r.category_code || String(r.id),
      name: r.category_name || '',
      parentId: r.parent_id == null ? '' : String(r.parent_id),
      defaultUnit: r.default_unit || '',
      defaultWarehouse: r.default_warehouse_id == null ? '' : String(r.default_warehouse_id),
      defaultLocation: r.default_location || '',
      dangerous: !!r.is_danger,
      safetyInterval: r.safety_interval || '',
      licenseRequired: !!r.qualification,
      status: r.status === 'disabled' ? 'disabled' : 'enabled',
      remark: ''
    };
  }
  function ensureApi() {
    if (global.Api && global.Api.get) return Promise.resolve(true);
    if (typeof document === 'undefined') return Promise.resolve(false);
    return new Promise(function (resolve) {
      var sc = document.createElement('script');
      sc.src = '../common/js/api.js';
      sc.async = false;
      sc.onload = function () { resolve(!!(global.Api && global.Api.get)); };
      sc.onerror = function () { resolve(false); };
      (document.head || document.documentElement).appendChild(sc);
    });
  }
  function preloadFromBackend() {
    return ensureApi().then(function (ready) {
      if (!ready) return null;
      var writeMark0 = global.__STRICT_DB_WRITES__ || 0;
      return Promise.all([
        global.Api.get('material_warehouse', { page: 1, size: 500 }),
        global.Api.get('material_category', { page: 1, size: 500 })
      ]).then(function (res) {
        if (typeof global.__STRICT_DB_WRITES__ === 'number' && global.__STRICT_DB_WRITES__ !== writeMark0) return;
        var wh = res[0], cat = res[1];
        if (wh && wh.ok && wh.data) write(KEY_WAREHOUSE, ((wh.data.list) || []).map(mapWarehouseRow));
        if (cat && cat.ok && cat.data) write(KEY_CATEGORY, ((cat.data.list) || []).map(mapCategoryRow));
        if (typeof initDictSelects === 'function') initDictSelects();
      });
    }).catch(function (err) {
      console.error('[MaterialDict] 数据服务未连接，字典保持为空，禁止降级到演示数据', err);
    });
  }

  global.MaterialDict = {
    KEY_WAREHOUSE: KEY_WAREHOUSE,
    KEY_CATEGORY: KEY_CATEGORY,
    DEFAULT_WAREHOUSES: DEFAULT_WAREHOUSES,
    DEFAULT_CATEGORIES: DEFAULT_CATEGORIES,
    BILL_STATUS: BILL_STATUS,
    STOCK_STATUS: STOCK_STATUS,
    getWarehouses: getWarehouses,
    setWarehouses: setWarehouses,
    getCategories: getCategories,
    setCategories: setCategories,
    enabledWarehouses: enabledWarehouses,
    enabledCategories: enabledCategories,
    warehouseNames: warehouseNames,
    categoryNames: categoryNames,
    categoryMap: categoryMap,
    fillSelect: fillSelect,
    syncSelect: syncSelect,
    initDictSelects: initDictSelects,
    preloadFromBackend: preloadFromBackend,
    reset: reset
  };
})(window);
