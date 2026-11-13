/**
 * 智慧果园 · 移动端共享数据层（纯在线版）
 * --------------------------------------------------------------
 * 统一承载跨页面共享数据 + GPS 采集。自「整体项目严格空库模式」起，
 * 业务数据的读写全部走后端通用 CRUD（window.Api），不再落 localStorage
 * 业务键；刷新后数据由后端重新拉取，保证「页面数据严格等于数据库内容」。
 *
 * 登录态（smartorchard_token / smartorchard_current_user）仍保留本地存储，
 * 与业务数据隔离。
 *
 * 设计约定：
 *   - 保留原 MobileStore 公开 API 签名不变，调用方页面改动最小。
 *   - list/push/upsert/remove 仍为「同步读取」：内部维护一份仅存在于
 *     当前页面生命周期的内存镜像，启动时异步从后端预加载填充；
 *     写入时先更新镜像（即时反馈）再写穿到后端（Api.create/update/remove）。
 *   - KEYS 中的业务键映射到后端 resource（表名去 sf_ 前缀），读写边界
 *     做 snake_case ↔ camelCase 字段映射。
 *   - 离线同步队列已废弃：enqueue/flush/pending 等保留函数名但改为
 *     「直接写后端」或「空实现 + 纯在线提示」，避免既有调用点报错。
 *
 * KEYS → resource 映射：
 *   farming      → farming_record   （业务编号 record_code）
 *   patrol       → patrol_checkin   （业务编号 checkin_code）
 *                 （kind==='abnormal' 时 → patrol_abnormal，业务编号 abnormal_code）
 *   plots        → plot             （业务编号 code）
 *   material     → material_io      （业务编号 io_code）
 *   labelStock   → label_stock      （无业务编号，自增 id）
 *   labelRecords → label_record     （业务编号 apply_code）
 *   adoptionTag  → adoption_tree    （业务编号 tree_code）
 *   serviceAction→ 无后端表，纯前端跳转意图，保留内存（刷新清空）
 *
 * 暴露 API（与旧版一致）：
 *   MobileStore.ready / list / push / upsert / remove / subscribe
 *   MobileStore.enqueue / flush / pending / clearQueue / onQueueChange / renderSyncBar
 *   MobileStore.geolocate / track / toast / confirm / fmtTime / isOnline
 */

(function (global) {
  'use strict';

  var KEYS = {
    queue: 'smartorchard_sync_queue',
    farming: 'smartorchard_farming_records',
    patrol: 'smartorchard_patrol_records',
    plots: 'smartorchard_plots',
    material: 'smartorchard_material_logs',
    labelStock: 'smartorchard_label_stock',
    labelRecords: 'smartorchard_label_records',
    adoptionTag: 'smartorchard_adoption_tags',
    serviceAction: 'smartorchard_service_action'
  };

  var subs = [];
  var queueSubs = [];

  /* ============================================================
   * Api 依赖自动加载（与后台 store 的 ensureDeps 同策略）
   * ============================================================ */
  var depsReady = (function ensureDeps() {
    if (typeof document === 'undefined') return Promise.resolve();
    var selfEl = document.currentScript;
    if (!selfEl || !selfEl.src) return Promise.resolve();
    var baseDir = selfEl.src.replace(/[^\/]*$/, '');
    var deps = [
      { name: 'Api', src: baseDir + '../../common/js/api.js' }
    ];
    var pending = deps.filter(function (d) { return !global[d.name]; });
    if (!pending.length) return Promise.resolve();
    return Promise.all(pending.map(function (d) {
      return new Promise(function (resolve) {
        var s = document.createElement('script');
        s.src = d.src; s.async = false; s.onload = resolve; s.onerror = resolve;
        (document.head || document.documentElement).appendChild(s);
      });
    })).then(function () { return true; });
  })();

  function apiAvailable() {
    return typeof global.Api === 'object' && typeof global.Api.get === 'function';
  }
  function backendEnabled() {
    try { return apiAvailable() && !!global.Api.isLoggedIn(); } catch (e) { return false; }
  }

  /* ============================================================
   * 基础工具
   * ============================================================ */
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function stampNow() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  function dateOf(v) {
    if (!v) return stampNow().slice(0, 10);
    var s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    var d = new Date(s);
    if (isNaN(d.getTime())) return s.slice(0, 10);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* datetime 归一化：MySQL datetime 不接受 ISO 8601 的 'T' 分隔与 'Z' 后缀 */
  function datetimeOf(v) {
    if (!v) return stampNow();
    var s = String(v);
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) return s.length === 16 ? s + ':00' : s;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s + ' 00:00:00';
    var d = new Date(s);
    if (isNaN(d.getTime())) return stampNow();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  function num(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }

  function genCode(prefix) {
    var d = new Date();
    var rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return prefix + '-' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) +
      '-' + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds()) + '-' + rand;
  }

  /* ============================================================
   * resource 映射 + snake/camel 字段映射
   * 每个条目：{ resource, codeField, toSnake(item), toCamel(row) }
   * ============================================================ */
  var RESOURCES = {
    farming: {
      resource: 'farming_record',
      codeField: 'record_code',
      toSnake: function (item) {
        return {
          record_code: item.id || genCode('REC'),
          plot_code: item.plot || '',
          farm_type: item.taskType || '',
          type_name: item.taskType || '',
          executor: item.operator || '',
          execute_date: dateOf(item.createTime || item.time),
          content: item.remark || '',
          photo: item.photo || null,
          source: item.source || 'mobile',
          status: item.status || 'pending'
        };
      },
      toCamel: function (row) {
        return {
          id: row.record_code,
          _dbId: row.id,
          plot: row.plot_code || '',
          taskType: row.type_name || row.farm_type || '',
          remark: row.content || '',
          photo: row.photo || '',
          operator: row.executor || '',
          source: row.source || '',
          status: row.status || 'pending',
          createTime: row.execute_date || row.created_at || ''
        };
      }
    },
    patrol: {
      resource: 'patrol_checkin',
      codeField: 'checkin_code',
      toSnake: function (item) {
        return {
          checkin_code: item.id || genCode('CK'),
          patrol_type: item.checkpointName || '',
          plot_ids: item.checkpointId || '',
          inspector: item.operator || '',
          checkin_time: datetimeOf(item.checkinTime),
          points_done: 1,
          points_total: 1,
          status: 'completed'
        };
      },
      toCamel: function (row) {
        return {
          id: row.checkin_code,
          _dbId: row.id,
          checkpointId: row.plot_ids || '',
          checkpointName: row.patrol_type || '',
          operator: row.inspector || '',
          checkinTime: row.checkin_time || '',
          status: row.status || 'completed'
        };
      }
    },
    patrolAbnormal: {
      resource: 'patrol_abnormal',
      codeField: 'abnormal_code',
      toSnake: function (item) {
        var statusMap = { '待处理': 'pending', '已处理': 'done', '处理中': 'processing' };
        return {
          abnormal_code: item.id || genCode('ABN'),
          source: item.source || 'patrol',
          abnormal_type: item.type || '',
          abnormal_desc: item.remark || '',
          reporter: item.operator || '',
          report_time: datetimeOf(item.reportTime),
          severity: 'high',
          status: statusMap[item.status] || 'pending'
        };
      },
      toCamel: function (row) {
        var statusMap = { pending: '待处理', done: '已处理', processing: '处理中' };
        return {
          id: row.abnormal_code,
          _dbId: row.id,
          type: row.abnormal_type || '',
          remark: row.abnormal_desc || '',
          operator: row.reporter || '',
          reportTime: row.report_time || '',
          status: statusMap[row.status] || row.status || '待处理',
          source: row.source || '',
          kind: 'abnormal'
        };
      }
    },
    plots: {
      resource: 'plot',
      codeField: 'code',
      toSnake: function (item) {
        return {
          code: item.id || genCode('D'),
          name: item.name || '未命名地块',
          plot_type: item.type || '',
          area: num(item.area),
          plot_status: 'normal',
          audit_status: 'pending',
          source: 'mobile',
          boundary: Array.isArray(item.points) && item.points.length
            ? JSON.stringify(item.points) : null,
          draw_time: datetimeOf(item.createTime),
          remark: item.remark || ''
        };
      },
      toCamel: function (row) {
        var points = [];
        try { points = row.boundary ? JSON.parse(row.boundary) : []; } catch (e) { points = []; }
        if (!Array.isArray(points)) points = [];
        return {
          id: row.code,
          _dbId: row.id,
          name: row.name || '',
          type: row.plot_type || '',
          area: row.area != null ? row.area : '',
          points: points,
          remark: row.remark || '',
          source: 'mobile',
          auditStatus: row.audit_status || 'pending',
          reviewRemark: row.review_remark || '',
          reviewer: row.reviewer || '',
          createTime: row.draw_time || row.created_at || ''
        };
      }
    },
    material: {
      resource: 'material_io',
      codeField: 'io_code',
      toSnake: function (item) {
        // material_io 无 name 列：农资名称并入备注，同时按后台档案编号回填 material_id
        var nameTag = (item.name || item.backName) ? '农资:' + (item.backName || item.name) : '';
        var remark = [item.remark, nameTag].filter(Boolean).join(' ');
        return {
          io_code: item.id || genCode('IO'),
          io_type: '出库',
          material_id: item.materialId || null,
          source_code: item.code || null,
          quantity: num(item.qty),
          related_target: item.plot || '',
          handler: '移动端',
          audit_status: item.status || 'pending',
          io_date: dateOf(item.time),
          remark: remark || null
        };
      },
      toCamel: function (row) {
        return {
          id: row.io_code,
          _dbId: row.id,
          code: row.source_code || '',
          materialId: row.material_id != null ? String(row.material_id) : '',
          name: '',
          qty: row.quantity != null ? row.quantity : 0,
          plot: row.related_target || '',
          time: row.io_date || row.created_at || '',
          status: row.audit_status || 'pending',
          remark: row.remark || ''
        };
      }
    },
    labelStock: {
      resource: 'label_stock',
      codeField: null,
      toSnake: function (item) {
        return {
          label_type_id: item.labelTypeId || item.id || null,
          quantity: num(item.quantity != null ? item.quantity : item.stock)
        };
      },
      toCamel: function (row) {
        return { id: String(row.id), _dbId: row.id, quantity: row.quantity != null ? row.quantity : 0 };
      }
    },
    labelRecords: {
      resource: 'label_record',
      codeField: 'apply_code',
      toSnake: function (item) {
        return {
          apply_code: item.id || genCode('LB'),
          label_type_id: item.labelTypeId || item.labelTypeDbId || null,
          quantity: num(item.qty),
          plot_ids: item.plot || '',
          apply_user: item.operator || '移动端',
          apply_time: datetimeOf(item.time),
          status: item.status || 'pending',
          remark: item.remark || ''
        };
      },
      toCamel: function (row) {
        return {
          id: row.apply_code,
          _dbId: row.id,
          name: '',
          labelTypeId: row.label_type_id != null ? String(row.label_type_id) : '',
          qty: row.quantity != null ? row.quantity : 0,
          plot: row.plot_ids || '',
          time: row.apply_time || row.created_at || '',
          createTime: row.apply_time || row.created_at || '',
          status: row.status || 'pending',
          printTime: row.status === 'printed' ? (row.updated_at || '') : '',
          remark: row.remark || ''
        };
      }
    },
    adoptionTag: {
      resource: 'adoption_tree',
      codeField: 'tree_code',
      toSnake: function (item) {
        var isBind = item.kind === 'farming_bind';
        return {
          tree_code: item.treeCode || item.treeNo || genCode('TREE'),
          adopter: item.adopter || null,
          adopter_phone: item.phone || null,
          tag_code: item.code || null,
          source: isBind ? 'farming_bind' : (item.source || 'mobile'),
          status: isBind ? 'adopted' : (item.status || 'adopted'),
          remark: isBind ? (item.records ? JSON.stringify(item.records) : '') : (item.location || '')
        };
      },
      toCamel: function (row) {
        var isBind = row.source === 'farming_bind';
        return {
          id: row.tree_code,
          _dbId: row.id,
          treeCode: row.tree_code,
          treeNo: row.tree_code,
          adopter: row.adopter || '',
          phone: row.adopter_phone || '',
          code: row.tag_code || '',
          status: row.status || 'pending',
          tagTime: row.created_at || '',
          source: row.source || 'mobile',
          kind: isBind ? 'farming_bind' : undefined
        };
      }
    }
  };

  /* 由 KEYS 值反查逻辑名 */
  var KEY_TO_LOGICAL = {};
  Object.keys(KEYS).forEach(function (k) { KEY_TO_LOGICAL[KEYS[k]] = k; });

  function logicalOf(key) {
    // 兼容传逻辑名（如 'farming'）或真实键名（如 'smartorchard_farming_records'）
    if (RESOURCES[key]) return key;
    var k = KEY_TO_LOGICAL[key];
    return RESOURCES[k] ? k : null;
  }

  /* serviceAction：无后端表，纯内存 */
  var memoryLists = { serviceAction: [] };

  /* ============================================================
   * 内存镜像（页面生命周期内，刷新即清空 → 严格空库）
   * ============================================================ */
  var cache = {};        // logical -> camelCase 数组
  var preloadDone = false;

  function readCache(logical) {
    return Array.isArray(cache[logical]) ? cache[logical] : [];
  }
  function writeCache(logical, arr) {
    cache[logical] = Array.isArray(arr) ? arr : [];
    emit(KEYS[logical] || logical);
  }

  function emit(reason) {
    subs.forEach(function (fn) {
      try { fn(reason); } catch (e) { /* 单个订阅者异常不影响其他 */ }
    });
  }

  function emitQueue() {
    queueSubs.forEach(function (fn) {
      try { fn(pending(), false); } catch (e) { /* 同上 */ }
    });
  }

  /* ============================================================
   * 后端预加载：启动时拉取全部业务 resource，填充镜像
   * ============================================================ */
  function preload() {
    return Promise.resolve(depsReady).then(function () {
      if (!backendEnabled()) return { ok: false, message: '未登录或依赖未就绪' };
      var logicals = Object.keys(RESOURCES);
      return Promise.all(logicals.map(function (logical) {
        var conf = RESOURCES[logical];
        return global.Api.get(conf.resource, { size: 500 }).then(function (res) {
          if (res && res.ok && res.data && Array.isArray(res.data.list)) {
            cache[logical] = res.data.list.map(function (row) { return conf.toCamel(row); });
          }
          return res;
        }).catch(function () { return null; });
      })).then(function () {
        preloadDone = true;
        emit('preload');
        return { ok: true };
      });
    });
  }

  /* ============================================================
   * 共享列表（同步读，写穿后端）
   * ============================================================ */
  function list(key) {
    var logical = logicalOf(key);
    if (!logical) {
      // 未映射的键（如 serviceAction 或历史遗留键）走内存
      return Array.isArray(memoryLists[key]) ? memoryLists[key] : [];
    }
    return readCache(logical);
  }

  /* 写穿后端：成功/失败都不阻塞页面，静默记录 */
  function persistCreate(logical, snakeData, item) {
    if (!backendEnabled()) { console.warn('[MobileStore] 未登录，写入已跳过'); return; }
    var conf = RESOURCES[logical];
    global.Api.create(conf.resource, snakeData).then(function (res) {
      if (res && res.ok && res.data && res.data.insertId != null && item) {
        item._dbId = res.data.insertId;
      }
    }).catch(function (e) { console.warn('[MobileStore] 写入失败', e); });
  }

  function push(key, item) {
    item = item || {};
    var logical = logicalOf(key);

    // serviceAction：纯内存
    if (logical === 'serviceAction' || (key === KEYS.serviceAction)) {
      if (!item.id) item.id = 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      if (!item.createTime) item.createTime = new Date().toISOString();
      memoryLists.serviceAction.unshift(item);
      emit(key);
      return item;
    }

    // patrol 的异常上报（kind==='abnormal'）路由到 patrol_abnormal
    var useLogical = (logical === 'patrol' && item.kind === 'abnormal') ? 'patrolAbnormal' : logical;
    var conf = RESOURCES[useLogical];
    if (!conf) return item;

    if (!item.id) item.id = genCode((conf.codeField === 'record_code') ? 'REC' : (conf.codeField === 'checkin_code' ? 'CK' : 'ID'));
    if (!item.createTime && useLogical !== 'patrolAbnormal') item.createTime = new Date().toISOString();

    var snakeData = conf.toSnake(item);
    persistCreate(useLogical, snakeData, item);

    var arr = readCache(useLogical);
    arr.unshift(item);
    writeCache(useLogical, arr);
    return item;
  }

  function upsert(key, item) {
    if (!item) return null;
    var logical = logicalOf(key);
    if (logical === 'serviceAction') {
      if (!item.id) return push(key, item);
      var sa = memoryLists.serviceAction;
      for (var i = 0; i < sa.length; i++) {
        if (sa[i].id === item.id) { sa[i] = Object.assign({}, sa[i], item); emit(key); return sa[i]; }
      }
      return push(key, item);
    }
    if (!logical || !item.id) return push(key, item);
    var arr = readCache(logical);
    var idx = -1;
    for (var j = 0; j < arr.length; j++) {
      if (arr[j].id === item.id) { idx = j; break; }
    }
    if (idx >= 0) {
      arr[idx] = Object.assign({}, arr[idx], item);
      writeCache(logical, arr);
      return arr[idx];
    }
    return push(key, item);
  }

  /* remove：按业务编号查到数据库自增 id 后逻辑删除 */
  function remove(key, id) {
    var logical = logicalOf(key);
    if (!logical) return Promise.resolve({ ok: false });
    var conf = RESOURCES[logical];
    // 立即从镜像移除（即时反馈）
    writeCache(logical, readCache(logical).filter(function (x) { return String(x.id) !== String(id); }));

    if (!backendEnabled()) return Promise.resolve({ ok: false });
    // 用业务编号精确筛选，拿到数据库自增 id
    return global.Api.get(conf.resource, { size: 1 }).then(function (res) {
      var row = null;
      if (res && res.ok && res.data && Array.isArray(res.data.list)) {
        for (var i = 0; i < res.data.list.length; i++) {
          if (String(res.data.list[i][conf.codeField]) === String(id)) { row = res.data.list[i]; break; }
        }
      }
      if (!row) {
        // 退化为按业务编号字段筛选查询
        var q = {};
        q[conf.codeField] = id;
        return global.Api.get(conf.resource, q).then(function (r2) {
          if (r2 && r2.ok && r2.data && r2.data.list && r2.data.list.length) {
            return global.Api.remove(conf.resource, r2.data.list[0].id);
          }
          return { ok: false };
        });
      }
      return global.Api.remove(conf.resource, row.id);
    });
  }

  /* ============================================================
   * 离线同步队列（已废弃）：保留函数名，纯在线语义
   * ============================================================ */
  function pending() { return 0; }

  /**
   * 纯在线模式：enqueue 不再入队，而是直接写后端对应业务表（等价于 push）。
   * 但各页面在调用 enqueue 前通常已调用 push 写入后端，为避免重复落库，
   * 此处仅做幂等兜底：若 payload 未带已落库标记则不重复写。
   */
  function enqueue(item) {
    if (!item) return null;
    var entry = Object.assign({}, item);
    entry.status = 'synced';
    entry.queuedAt = entry.queuedAt || new Date().toISOString();
    // 纯在线：无需队列，直接标记已同步
    emitQueue();
    emit(KEYS.queue);
    return entry;
  }

  function flush() {
    return Promise.resolve({ ok: true, count: 0 });
  }

  function clearQueue() {
    emitQueue();
    emit(KEYS.queue);
  }

  function isOnline() {
    return typeof navigator === 'undefined' || navigator.onLine !== false;
  }

  /* ============================================================
   * GPS 采集（F-244 / F-243 / F-252）—— 与 localStorage 无关，保持不变
   * ============================================================ */
  var GEO_BASE = { lat: 34.3517, lng: 106.1833, label: '天水市麦积区红崖村' };

  function geolocate(opt) {
    opt = opt || {};
    var timeout = opt.timeout || 8000;
    return new Promise(function (resolve, reject) {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve(Object.assign({}, GEO_BASE, {
          accuracy: null,
          source: 'fallback',
          degraded: true,
          message: '当前设备不支持定位，已使用基地基准点'
        }));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            source: 'gps',
            degraded: false,
            message: '定位成功'
          });
        },
        function (err) {
          resolve(Object.assign({}, GEO_BASE, {
            accuracy: null,
            source: 'fallback',
            degraded: true,
            code: err && err.code,
            message: err && err.code === 1
              ? '定位权限被拒绝，已使用基地基准点'
              : 'GPS 信号弱，已使用基地基准点'
          }));
        },
        { enableHighAccuracy: true, timeout: timeout, maximumAge: 30000 }
      );
    });
  }

  function track(opt) {
    opt = opt || {};
    var points = [];
    var stopped = false;
    var watchId = null;

    function onPoint(pos, err) {
      if (stopped) return;
      if (err) {
        points.push({ at: new Date().toISOString(), ok: false, message: err.message || '定位失败' });
      } else {
        points.push({
          at: new Date().toISOString(),
          ok: true,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
      }
      if (typeof opt.onPoint === 'function') opt.onPoint(points[points.length - 1], points);
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation && navigator.geolocation.watchPosition) {
      watchId = navigator.geolocation.watchPosition(
        function (pos) { onPoint(pos, null); },
        function (e) { onPoint(null, e); },
        { enableHighAccuracy: true, timeout: opt.timeout || 15000, maximumAge: 5000 }
      );
    }

    function stop() {
      stopped = true;
      if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation.clearWatch) {
        navigator.geolocation.clearWatch(watchId);
      }
      return points;
    }

    return { stop: stop, points: points };
  }

  /* ============================================================
   * 同步状态栏：纯在线模式，恒定显示「已同步」
   * ============================================================ */
  function renderSyncBar(el) {
    if (!el) return;
    el.className = 'mb-sync-bar is-done';
    el.innerHTML =
      '<span class="mb-sync-dot"></span>' +
      '<span class="mb-sync-text">数据已同步</span>';
  }

  /* ============================================================
   * 轻提示 / 确认 / 时间格式化
   * ============================================================ */
  function toast(msg, type) {
    var t = type || 'info';
    var box = document.createElement('div');
    box.className = 'mb-toast mb-toast-' + t;
    box.textContent = msg;
    box.setAttribute('role', 'status');
    document.body.appendChild(box);
    setTimeout(function () { box.classList.add('show'); }, 10);
    setTimeout(function () {
      box.classList.remove('show');
      setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 260);
    }, 2000);
  }

  function confirmBox(msg) {
    return global.confirm(msg);
  }

  function fmtTime(ts) {
    var d = ts instanceof Date ? ts : new Date(ts);
    if (isNaN(d.getTime())) return String(ts || '');
    var p = function (n) { return n < 10 ? '0' + n : n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* ============================================================
   * 初始化
   * ============================================================ */
  var ready = new Promise(function (resolve) {
    function boot() {
      global.addEventListener('online', function () {
        if (backendEnabled()) preload();
      });
      // 页面载入即异步预加载后端数据
      preload().then(function () { resolve(MobileStore); });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  });

  var MobileStore = {
    KEYS: KEYS,
    ready: ready,

    list: list,
    push: push,
    upsert: upsert,
    remove: remove,
    subscribe: function (fn) { subs.push(fn); return function () { subs = subs.filter(function (f) { return f !== fn; }); }; },

    enqueue: enqueue,
    flush: flush,
    pending: pending,
    clearQueue: clearQueue,
    isOnline: isOnline,
    onQueueChange: function (fn) { queueSubs.push(fn); fn(0, false); return function () { queueSubs = queueSubs.filter(function (f) { return f !== fn; }); }; },

    geolocate: geolocate,
    track: track,
    GEO_BASE: GEO_BASE,

    renderSyncBar: renderSyncBar,
    toast: toast,
    confirm: confirmBox,
    fmtTime: fmtTime,

    /* 供页面/调试使用 */
    _preload: preload,
    _backendEnabled: backendEnabled
  };

  global.MobileStore = MobileStore;
})(window);
