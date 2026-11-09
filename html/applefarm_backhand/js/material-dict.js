/**
 * 物资管理共享字典
 * 仓库、农资分类、单据状态统一在此维护，供物资模块各页面引用。
 */
(function (global) {
  var KEY_WAREHOUSE = 'sz_material_warehouses_v1';
  var KEY_CATEGORY = 'sz_material_categories_v1';

  var DEFAULT_WAREHOUSES = [
    { id: 'wh1', name: '中心仓库', manager: '惠加宁', managerPhone: '13800001001', address: '园区北侧 1 号库', type: '常温库', capacity: '1200 ㎡', isDefault: true, status: 'enabled', remark: '成品与常用农资' },
    { id: 'wh2', name: '东区仓库', manager: '黄忠坚', managerPhone: '13800001002', address: '东区 3 号库', type: '常温库', capacity: '800 ㎡', isDefault: false, status: 'enabled', remark: '' },
    { id: 'wh3', name: '西区仓库', manager: '徐水应', managerPhone: '13800001003', address: '西区 1 号库', type: '危化品专库', capacity: '600 ㎡', isDefault: false, status: 'enabled', remark: '农药专库' }
  ];

  var DEFAULT_CATEGORIES = [
    { id: 'fertilizer', name: '肥料', parentId: '', defaultUnit: '袋', defaultWarehouse: '中心仓库', defaultLocation: 'A-01-01', dangerous: false, safetyInterval: '', licenseRequired: false, status: 'enabled', remark: '' },
    { id: 'pesticide', name: '农药', parentId: '', defaultUnit: '瓶', defaultWarehouse: '西区仓库', defaultLocation: 'C-01-01', dangerous: true, safetyInterval: '14', licenseRequired: true, status: 'enabled', remark: '需农药登记证号' },
    { id: 'tool', name: '工具', parentId: '', defaultUnit: '件', defaultWarehouse: '中心仓库', defaultLocation: 'B-01-01', dangerous: false, safetyInterval: '', licenseRequired: false, status: 'enabled', remark: '' },
    { id: 'seed', name: '种子', parentId: '', defaultUnit: '袋', defaultWarehouse: '中心仓库', defaultLocation: 'A-02-01', dangerous: false, safetyInterval: '', licenseRequired: false, status: 'enabled', remark: '' },
    { id: 'other', name: '其他', parentId: '', defaultUnit: '件', defaultWarehouse: '中心仓库', defaultLocation: 'B-02-01', dangerous: false, safetyInterval: '', licenseRequired: false, status: 'enabled', remark: '' }
  ];

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

  function read(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      if (!raw) return clone(fallback);
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length ? parsed : clone(fallback);
    } catch (e) {
      return clone(fallback);
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
    return read(KEY_WAREHOUSE, DEFAULT_WAREHOUSES);
  }

  function setWarehouses(list) {
    write(KEY_WAREHOUSE, list || []);
  }

  function getCategories() {
    return read(KEY_CATEGORY, DEFAULT_CATEGORIES);
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
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { initDictSelects(); });
    } else {
      initDictSelects();
    }
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
    reset: reset
  };
})(window);
