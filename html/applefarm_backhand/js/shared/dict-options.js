/* ============================================================
 * 字典下拉统一数据源 window.DictOptions
 * ------------------------------------------------------------
 * 数据来源：GET /api/meta/dicts/:dictCode（表 sf_dict）
 * 用法：
 *   <select data-dict-source="STANDARD_LEVEL">
 *     <option value="">全部级别</option>
 *   </select>
 *  或显式：DictOptions.load('FARMING_TYPE').then(function (list) { ... });
 * list 结构：[{ value, label, hint }]
 * dict_value 支持两种格式：JSON 数组 [{value,label,hint}] 或逗号分隔的纯文本
 * 字典缺失时返回空数组（空库显示空，不内置兜底枚举）。
 * ============================================================ */
(function (global) {
  'use strict';

  var cache = {};

  function api() {
    return (global.Api && typeof global.Api.get === 'function') ? global.Api : null;
  }

  function toItems(raw) {
    var s = raw == null ? '' : String(raw).trim();
    if (!s) return [];
    if (s.charAt(0) === '[') {
      try {
        var arr = JSON.parse(s);
        if (!Array.isArray(arr)) return [];
        return arr.map(function (x) {
          if (x && typeof x === 'object') {
            var v = x.value != null ? String(x.value) : (x.label != null ? String(x.label) : '');
            return {
              value: v,
              label: x.label != null ? String(x.label) : v,
              hint: x.hint != null ? String(x.hint) : ''
            };
          }
          return { value: String(x), label: String(x), hint: '' };
        }).filter(function (x) { return x.value !== ''; });
      } catch (e) { return []; }
    }
    return s.split(',').map(function (x) { return x.trim(); })
      .filter(function (x) { return !!x; })
      .map(function (x) { return { value: x, label: x, hint: '' }; });
  }

  function load(code) {
    if (!code) return Promise.resolve([]);
    if (cache[code]) return Promise.resolve(cache[code]);
    return new Promise(function (resolve) {
      var tries = 0;
      (function attempt() {
        var a = api();
        if (!a) {
          if (++tries > 60) { resolve([]); return; }
          setTimeout(attempt, 100);
          return;
        }
        a.dict(code).then(function (res) {
          var row = (res && res.ok && res.data) ? res.data : null;
          var list = row ? toItems(row.dict_value) : [];
          cache[code] = list;
          resolve(list);
        }).catch(function () { resolve([]); });
      })();
    });
  }

  /* 填充下拉：保留首个占位项，替换其余选项；尽量保留当前选中值 */
  function fill(select, code) {
    if (!select) return Promise.resolve([]);
    if (select.dataset.dictFilled === '1') return Promise.resolve([]);
    select.dataset.dictFilled = '1';
    return load(code).then(function (list) {
      // dataset.want：页面在选项就绪前已指定的目标值，优先级高于当前选中项
      var current = select.dataset.want !== undefined ? select.dataset.want : select.value;
      var placeholder = select.querySelector('option');
      var phValue = placeholder ? placeholder.value : '';
      var phLabel = placeholder ? placeholder.textContent : '';
      select.innerHTML = '';
      if (placeholder) {
        var ph = document.createElement('option');
        ph.value = phValue;
        ph.textContent = phLabel;
        select.appendChild(ph);
      }
      list.forEach(function (it) {
        var opt = document.createElement('option');
        opt.value = it.value;
        opt.textContent = it.label;
        if (it.hint) opt.setAttribute('data-hint', it.hint);
        select.appendChild(opt);
      });
      if (current && Array.prototype.some.call(select.options, function (o) { return o.value === current; })) {
        select.value = current;
      }
      delete select.dataset.want;
      select.dispatchEvent(new CustomEvent('dict-options:ready', { bubbles: true }));
      return list;
    });
  }

  function fillAll(root) {
    var scope = root || document;
    return Promise.all(Array.prototype.map.call(
      scope.querySelectorAll('select[data-dict-source]'),
      function (sel) { return fill(sel, sel.dataset.dictSource); }
    ));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(fillAll, 0); });
  } else {
    setTimeout(fillAll, 0);
  }

  global.DictOptions = { load: load, fill: fill, fillAll: fillAll, toItems: toItems };
})(window);
