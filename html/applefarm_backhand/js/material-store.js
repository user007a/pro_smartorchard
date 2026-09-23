/**
 * 农资共享仓库（农资管理模块）
 * ------------------------------------------------------------
 * 让"农资信息 / 农资库存 / 农资出入库 / 农资退货 / 农资使用"共享同一份
 * 农资库存数据，实现出入库、退货、使用对库存的联动，并持久化到浏览器
 * localStorage，跨页面刷新后仍保持同步。
 *
 * 用法：
 *   MaterialStore.all()                     获取农资主数据（含当前库存）
 *   MaterialStore.get('M-001' | 'NPK复合肥') 按编号或名称查询单个农资
 *   MaterialStore.stockOf(identifier)       查询当前库存（未登记返回 null）
 *   MaterialStore.statusOf(identifier)      查询库存状态 normal/danger/high
 *   MaterialStore.applyDelta(identifier, ±n) 增减库存，不足时为 ok:false
 *   MaterialStore.setStock(identifier, n)   直接设置库存（盘点用）
 *   MaterialStore.reset()                   恢复初始数据
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'smartorchard_material_store_v1';
  var VERSION = 1;

  // 农资主数据 + 初始库存（以农资库存页为权威来源，作为全模块共享数据）
  var SEED = [
    { code:'M-001', name:'NPK复合肥',   type:'fertilizer', typeName:'肥料', spec:'40kg/袋',    unit:'袋', warehouse:'一号仓库', warehouseCode:'warehouse1', safety:100, stock:150 },
    { code:'M-002', name:'高效杀虫剂',  type:'pesticide',  typeName:'农药', spec:'500ml/瓶',  unit:'瓶', warehouse:'一号仓库', warehouseCode:'warehouse1', safety:50,  stock:25  },
    { code:'M-003', name:'有机肥料',    type:'fertilizer', typeName:'肥料', spec:'25kg/袋',   unit:'袋', warehouse:'二号仓库', warehouseCode:'warehouse2', safety:50,  stock:80  },
    { code:'M-004', name:'疏花疏果剪',  type:'tool',       typeName:'工具', spec:'SK-5材质',  unit:'把', warehouse:'一号仓库', warehouseCode:'warehouse1', safety:30,  stock:200 },
    { code:'M-005', name:'杀菌剂',      type:'pesticide',  typeName:'农药', spec:'1L/瓶',     unit:'瓶', warehouse:'二号仓库', warehouseCode:'warehouse2', safety:30,  stock:15  },
    { code:'M-006', name:'磷酸二铵',    type:'fertilizer', typeName:'肥料', spec:'50kg/袋',   unit:'袋', warehouse:'一号仓库', warehouseCode:'warehouse1', safety:120, stock:200 },
    { code:'M-007', name:'除草剂',      type:'pesticide',  typeName:'农药', spec:'200ml/瓶',  unit:'瓶', warehouse:'二号仓库', warehouseCode:'warehouse2', safety:80,  stock:95  },
    { code:'M-008', name:'修枝剪',      type:'tool',       typeName:'工具', spec:'铝合金手柄', unit:'把', warehouse:'一号仓库', warehouseCode:'warehouse1', safety:40,  stock:150 },
    { code:'M-009', name:'叶面肥',      type:'fertilizer', typeName:'肥料', spec:'500ml/瓶',  unit:'瓶', warehouse:'二号仓库', warehouseCode:'warehouse2', safety:150, stock:180 },
    { code:'M-010', name:'生物农药',    type:'pesticide',  typeName:'农药', spec:'1L/瓶',     unit:'瓶', warehouse:'一号仓库', warehouseCode:'warehouse1', safety:40,  stock:25  },
    { code:'M-011', name:'授粉器',      type:'tool',       typeName:'工具', spec:'电动型',    unit:'个', warehouse:'二号仓库', warehouseCode:'warehouse2', safety:20,  stock:18  },
    { code:'M-012', name:'钾肥',        type:'fertilizer', typeName:'肥料', spec:'50kg/袋',   unit:'袋', warehouse:'一号仓库', warehouseCode:'warehouse1', safety:90,  stock:150 },
    { code:'M-013', name:'杀螨剂',      type:'pesticide',  typeName:'农药', spec:'300ml/瓶',  unit:'瓶', warehouse:'二号仓库', warehouseCode:'warehouse2', safety:70,  stock:30  },
    { code:'M-014', name:'嫁接刀',      type:'tool',       typeName:'工具', spec:'不锈钢',    unit:'把', warehouse:'一号仓库', warehouseCode:'warehouse1', safety:100, stock:200 },
    { code:'M-015', name:'尿素',        type:'fertilizer', typeName:'肥料', spec:'50kg/袋',   unit:'袋', warehouse:'二号仓库', warehouseCode:'warehouse2', safety:200, stock:250 },
    { code:'M-016', name:'保鲜剂',      type:'pesticide',  typeName:'农药', spec:'500ml/瓶',  unit:'瓶', warehouse:'一号仓库', warehouseCode:'warehouse1', safety:35,  stock:45  },
    { code:'M-017', name:'喷雾器',      type:'tool',       typeName:'工具', spec:'手动型 16L', unit:'个', warehouse:'二号仓库', warehouseCode:'warehouse2', safety:25,  stock:20  },
    { code:'M-018', name:'微量元素肥',  type:'fertilizer', typeName:'肥料', spec:'1kg/袋',    unit:'袋', warehouse:'一号仓库', warehouseCode:'warehouse1', safety:60,  stock:80  },
    { code:'M-019', name:'生长调节剂',  type:'pesticide',  typeName:'农药', spec:'100ml/瓶',  unit:'瓶', warehouse:'二号仓库', warehouseCode:'warehouse2', safety:45,  stock:55  },
    { code:'M-020', name:'绑枝机',      type:'tool',       typeName:'工具', spec:'手动绑枝机', unit:'个', warehouse:'一号仓库', warehouseCode:'warehouse1', safety:30,  stock:25  },
    { code:'M-021', name:'钙肥',        type:'fertilizer', typeName:'肥料', spec:'25kg/袋',   unit:'袋', warehouse:'二号仓库', warehouseCode:'warehouse2', safety:50,  stock:20  },
    { code:'M-022', name:'杀虫灯',      type:'tool',       typeName:'工具', spec:'太阳能型',  unit:'盏', warehouse:'一号仓库', warehouseCode:'warehouse1', safety:15,  stock:12  },
    { code:'M-023', name:'土壤改良剂',  type:'fertilizer', typeName:'肥料', spec:'20kg/袋',   unit:'袋', warehouse:'二号仓库', warehouseCode:'warehouse2', safety:40,  stock:35  }
  ];

  var materials = null;

  function clone(list) {
    return list.map(function (m) { return Object.assign({}, m); });
  }

  function persist() {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, materials: materials }));
      }
    } catch (e) { /* 隐私模式 / file:// 场景下忽略持久化失败 */ }
  }

  function load() {
    if (materials) return materials;
    var raw = null;
    try { raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.version === VERSION && Array.isArray(parsed.materials) && parsed.materials.length) {
          materials = parsed.materials;
          return materials;
        }
      } catch (e) { /* 数据损坏则重新初始化 */ }
    }
    materials = clone(SEED);
    persist();
    return materials;
  }

  function find(identifier) {
    if (identifier === null || identifier === undefined) return null;
    var key = String(identifier).trim();
    if (!key) return null;
    var list = load();
    for (var i = 0; i < list.length; i++) {
      if (list[i].code === key || list[i].name === key) return list[i];
    }
    return null;
  }

  function statusOfStock(stock, safety) {
    if (stock > safety * 1.5) return 'high';
    if (stock <= safety) return 'danger';
    return 'normal';
  }

  var MaterialStore = {
    all: function () { return load(); },
    get: function (identifier) { return find(identifier); },
    stockOf: function (identifier) { var m = find(identifier); return m ? m.stock : null; },
    safetyOf: function (identifier) { var m = find(identifier); return m ? m.safety : null; },
    statusOf: function (identifier) { var m = find(identifier); return m ? statusOfStock(m.stock, m.safety) : null; },

    /** 增减库存；库存不足时返回 ok:false 且不改动数据 */
    applyDelta: function (identifier, delta) {
      var m = find(identifier);
      if (!m) return { ok: false, stock: null, message: '未找到该农资，库存未变动' };
      var next = m.stock + delta;
      if (next < 0) return { ok: false, stock: m.stock, message: '库存不足，当前库存：' + m.stock + m.unit };
      m.stock = next;
      persist();
      return { ok: true, stock: m.stock };
    },

    /** 直接设置库存（库存盘点用） */
    setStock: function (identifier, value) {
      var m = find(identifier);
      if (!m) return { ok: false, stock: null, message: '未找到该农资' };
      m.stock = Math.max(0, parseInt(value, 10) || 0);
      persist();
      return { ok: true, stock: m.stock };
    },

    reset: function () { materials = clone(SEED); persist(); return materials; }
  };

  global.MaterialStore = MaterialStore;
})(window);
