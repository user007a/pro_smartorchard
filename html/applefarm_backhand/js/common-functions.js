/**
 * 智慧果园 - 通用功能函数
 * 包含模态框、分页、搜索等通用功能
 */

// 人员下拉选项（严格空库模式：不再硬编码虚构人名，改为从真实用户表取数）
const USER_OPTIONS = [];
window.USER_OPTIONS = USER_OPTIONS;

// 从真实用户表（sf_user）加载人员下拉选项，填充到 USER_OPTIONS
function loadUserOptions() {
  if (typeof window.Api !== 'object' && typeof window.Api !== 'function') return Promise.resolve([]);
  if (!window.Api.get) return Promise.resolve([]);
  return window.Api.get('user', { size: 500 }).then(function (res) {
    var list = (res && res.data && res.data.list) || [];
    var names = [];
    list.forEach(function (u) {
      var n = u && (u.real_name || u.username || u.name);
      n = n == null ? '' : String(n).trim();
      if (n && names.indexOf(n) === -1) names.push(n);
    });
    // 原地更新 USER_OPTIONS，保持 window.USER_OPTIONS 引用一致
    USER_OPTIONS.length = 0;
    names.forEach(function (n) { USER_OPTIONS.push(n); });
    return names;
  }).catch(function (e) {
    console.warn('[common-functions] 加载用户列表失败', e);
    return [];
  });
}
window.loadUserOptions = loadUserOptions;

// 生成人员下拉框 HTML（包含请选择占位项）
function buildUserOptionsHtml(selectedValue) {
  const placeholder = '<option value="">请选择负责人</option>';
  const options = USER_OPTIONS.map(function(name) {
    const selected = name === selectedValue ? ' selected' : '';
    return '<option value="' + name + '"' + selected + '>' + name + '</option>';
  }).join('');
  return placeholder + options;
}
// 生成人员下拉框 HTML（多选版本）
function buildUserOptionsHtmlMulti(selectedValues) {
  const selectedArr = Array.isArray(selectedValues) ? selectedValues : (selectedValues ? String(selectedValues).split(/[,，、]/) : []);
  const placeholder = '<option value="">请选择人员（可多选）</option>';
  const options = USER_OPTIONS.map(function(name) {
    const selected = selectedArr.indexOf(name) !== -1 ? ' selected' : '';
    return '<option value="' + name + '"' + selected + '>' + name + '</option>';
  }).join('');
  return placeholder + options;
}
window.buildUserOptionsHtml = buildUserOptionsHtml;
window.buildUserOptionsHtmlMulti = buildUserOptionsHtmlMulti;

/* ============================================================
 * 全局命名空间防冲突
 * ------------------------------------------------------------
 * 本文件与 js/components/modal.js、js/components/confirm.js
 * 存在同名全局对象（Modal / Toast / ConfirmDialog），但两套
 * API 签名不同：
 *   components/modal.js   → Modal.open/close/form/detail/confirm，Toast 默认 info
 *   common-functions.js   → Modal.show/hide/hideAll，          Toast 默认 success
 *
 * 直接 `window.X = X` 会互相覆盖，导致跨页面复制代码时行为不一致。
 * 策略：components/* 为权威实现（API 更完整）；
 *      本文件仅在权威实现「尚未加载」时补充挂载，并保留自身实现
 *      到独立命名的 LegacyModal / LegacyToast 等，避免破坏既有调用。
 * ============================================================ */
const Modal = {
  // 显示模态框
  show: function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
  },

  // 隐藏模态框
  hide: function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('show');
      document.body.style.overflow = '';
    }
  },

  // 隐藏所有模态框
  hideAll: function() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      // 动态创建的弹层（如确认框）直接移除，静态弹层只隐藏
      if (modal.getAttribute('data-dynamic') === '1') modal.remove();
      else modal.classList.remove('show');
    });
    document.body.style.overflow = '';
  }
};
const LegacyModal = Modal;

// 分页操作 - 完整版
const Pagination = {
  currentPage: 1,
  pageSize: 10,
  totalRecords: 0,
  filteredData: [],
  containerId: 'pagination-container',
  tbodyId: 'dataTableBody',
  renderRow: null,

  // 初始化分页
  init: function(options) {
    this.currentPage = options.currentPage || 1;
    this.pageSize = options.pageSize || 10;
    this.totalRecords = options.totalRecords || 0;
    this.filteredData = options.data || [];
    this.containerId = options.containerId || 'pagination-container';
    this.tbodyId = options.tbodyId || 'dataTableBody';
    this.renderRow = options.renderRow || null;

    this.render();
  },

  // 渲染表格
  renderTable: function() {
    const tbody = document.getElementById(this.tbodyId);
    if (!tbody || !this.renderRow) return;

    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    const pageData = this.filteredData.slice(start, end);

    tbody.innerHTML = pageData.map((item, index) => this.renderRow(item, start + index)).join('');
  },

  // 渲染分页控件
  render: function() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const totalPages = Math.ceil(this.filteredData.length / this.pageSize);

    let html = '<div class="pagination">';

    // 上一页按钮
    html += `<button class="page-btn ${this.currentPage <= 1 ? 'disabled' : ''}" onclick="Pagination.goToPage(${this.currentPage - 1})">‹</button>`;

    // 页码按钮
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= this.currentPage - 1 && i <= this.currentPage + 1)) {
        html += `<button class="page-btn ${i === this.currentPage ? 'active' : ''}" onclick="Pagination.goToPage(${i})">${i}</button>`;
      } else if (i === this.currentPage - 2 || i === this.currentPage + 2) {
        html += '<span class="page-ellipsis" style="padding:0 8px;color:#6b7b6b;">...</span>';
      }
    }

    // 下一页按钮
    html += `<button class="page-btn ${this.currentPage >= totalPages ? 'disabled' : ''}" onclick="Pagination.goToPage(${this.currentPage + 1})">›</button>`;

    // 页码信息
    html += `<span style="margin-left:16px;font-size:13px;color:#6b7b6b;">第 ${this.currentPage} 页/共 ${totalPages} 页，共 ${this.filteredData.length} 条记录</span>`;

    html += '</div>';

    container.innerHTML = html;

    // 渲染表格
    this.renderTable();
  },

  // 跳转到指定页
  goToPage: function(page) {
    const totalPages = Math.ceil(this.filteredData.length / this.pageSize);
    if (page < 1 || page > totalPages) return;

    this.currentPage = page;
    this.render();
  },

  // 更新数据
  updateData: function(data) {
    this.filteredData = data;
    this.currentPage = 1;
    this.render();
  },

  // 搜索过滤
  filter: function(keyword, fields) {
    if (!keyword) {
      this.filteredData = this._originalData || [];
    } else {
      this.filteredData = (this._originalData || []).filter(item => {
        return fields.some(field => {
          const value = item[field];
          return value && String(value).toLowerCase().includes(keyword.toLowerCase());
        });
      });
    }
    this.currentPage = 1;
    this.render();
  }
};

// 搜索操作
const Search = {
  // 执行搜索
  execute: function(options) {
    const { searchInput, filters, onSearch } = options;
    const keyword = searchInput.value.trim().toLowerCase();

    const filterValues = {};
    filters.forEach(filter => {
      filterValues[filter.id] = filter.value;
    });

    if (onSearch) {
      onSearch({ keyword, filters: filterValues });
    }
  },

  // 获取表单数据
  getFormData: function(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};

    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => {
      data[key] = value;
    });
    return data;
  },

  // 重置表单
  resetForm: function(formId) {
    const form = document.getElementById(formId);
    if (form) {
      form.reset();
    }
  }
};

// 删除确认对话框（独立命名，避免覆盖 components/confirm.js 的 ConfirmDialog）
const LegacyConfirmDialog = {
  show: function(options) {
    const opts = options || {};
    const title = opts.title || '确认操作';
    const message = opts.message || '';
    const onConfirm = opts.onConfirm;
    const onCancel = opts.onCancel;

    const dialog = document.createElement('div');
    dialog.className = 'modal-overlay show';
    // 标记为动态弹层：关闭时需整体移除，否则会在 body 里残留空节点
    dialog.setAttribute('data-dynamic', '1');
    dialog.innerHTML = `
      <div class="modal-box" style="max-width: 420px;">
        <div class="modal-header">
          <h3 class="modal-title"></h3>
          <button class="modal-close" type="button" data-action="close">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 4L12 12M12 4L4 12"/>
            </svg>
          </button>
        </div>
        <div class="modal-body" style="text-align: center;">
          <div style="font-size: 36px; margin-bottom: 12px;">⚠</div>
          <p style="color: var(--text-secondary);"></p>
        </div>
        <div class="modal-footer">
          <button class="jg-btn" type="button" data-action="cancel">取消</button>
          <button class="jg-btn jg-btn-danger" type="button" data-action="confirm">确认删除</button>
        </div>
      </div>
    `;
    // 文本走 textContent，避免标题/提示里的特殊字符被当作 HTML 解析
    dialog.querySelector('.modal-title').textContent = title;
    dialog.querySelector('.modal-body p').textContent = message;

    // 回调必须以闭包方式绑定：内联 onclick 里的 onConfirm 是局部变量，作用域外取不到
    const close = () => LegacyConfirmDialog.hide(dialog);
    dialog.querySelector('[data-action="close"]').addEventListener('click', close);
    dialog.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      close();
      if (typeof onCancel === 'function') onCancel();
    });
    dialog.querySelector('[data-action="confirm"]').addEventListener('click', () => {
      close();
      if (typeof onConfirm === 'function') onConfirm();
    });
    // 点击遮罩空白处等同取消
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) close();
    });

    document.body.appendChild(dialog);
  },

  hide: function(btn) {
    const overlay = btn.closest ? btn.closest('.modal-overlay') : btn;
    if (overlay) {
      overlay.remove();
      document.body.style.overflow = '';
    }
  }
};

// 消息提示（独立命名，默认 success；components/modal.js 的 Toast 默认 info）
const LegacyToast = {
  show: function(message, type = 'success', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon">
        ${type === 'success' ? '✓' : type === 'error' ? '✗' : type === 'warning' ? '⚠' : 'ℹ'}
      </div>
      <span class="toast-message">${message}</span>
    `;

    document.body.appendChild(toast);

    // 添加动画类
    setTimeout(() => toast.classList.add('show'), 10);

    // 自动关闭
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success: function(message) {
    this.show(message, 'success');
  },

  error: function(message) {
    this.show(message, 'error');
  },

  warning: function(message) {
    this.show(message, 'warning');
  },

  info: function(message) {
    this.show(message, 'info');
  }
};

// 初始化事件绑定
document.addEventListener('DOMContentLoaded', function() {
  // 绑定模态框关闭按钮
  document.addEventListener('click', function(e) {
    // 点击关闭按钮
    if (e.target.closest('.modal-close')) {
      const overlay = e.target.closest('.modal-overlay');
      if (overlay) {
        overlay.classList.remove('show');
        document.body.style.overflow = '';
      }
    }

    // 点击遮罩层关闭
    if (e.target.classList.contains('modal-overlay')) {
      if (e.target.getAttribute('data-dynamic') === '1') e.target.remove();
      else e.target.classList.remove('show');
      document.body.style.overflow = '';
    }
  });

  // ESC键关闭模态框
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      LegacyModal.hideAll();
    }
  });
});

/* ============================================================
 * 导出为全局变量（仅在权威实现缺席时补挂，避免互相覆盖）
 * ============================================================ */
window.LegacyModal = LegacyModal;
window.LegacyConfirmDialog = LegacyConfirmDialog;
window.LegacyToast = LegacyToast;
window.Pagination = Pagination;
window.Search = Search;

if (typeof window.Modal === 'undefined') {
  window.Modal = LegacyModal;
}
if (typeof window.ConfirmDialog === 'undefined') {
  window.ConfirmDialog = LegacyConfirmDialog;
}
if (typeof window.Toast === 'undefined') {
  window.Toast = LegacyToast;
}

/* ============================================================
 * 兼容层：静态 .modal-overlay 统一补齐 Esc / 点击遮罩关闭
 * 动态弹层（components/modal.js 创建，带 data-modal）已自行处理，跳过。
 * ============================================================ */
(function bindStaticModalDismiss() {
  if (window.__soStaticModalDismissBound) return;
  window.__soStaticModalDismissBound = true;

  function closeOverlay(overlay) {
    if (!overlay) return;
    if (overlay.getAttribute('data-dynamic') === '1') overlay.remove();
    else overlay.classList.remove('show');
    if (!document.querySelector('.modal-overlay.show')) document.body.style.overflow = '';
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    var open = Array.prototype.filter.call(document.querySelectorAll('.modal-overlay.show'), function (m) {
      return m.dataset.modal !== 'true';
    });
    if (!open.length) return;
    closeOverlay(open[open.length - 1]);
  });

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.classList || !t.classList.contains('modal-overlay')) return;
    if (t.dataset.modal === 'true' || !t.classList.contains('show')) return;
    closeOverlay(t);
  });
})();

/* ============================================================
 * 基地下拉统一数据源
 * ------------------------------------------------------------
 * 农事 / 预警等页面的「基地」下拉统一从 sf_base 动态加载，
 * 不再在 HTML 里写死基地名称。使用方式：
 *   <select data-base-source data-base-all-label="全部基地">…</select>
 * 首个 option 作为占位项（保留其 value），其余选项由本模块重建；
 * 基地名称同时作为 value 与显示文本，便于各页按名称筛选。
 * ============================================================ */
var BaseOptions = (function () {
  var bases = null;
  var loading = null;

  function api() {
    return (window.Api && typeof window.Api.get === 'function') ? window.Api : null;
  }

  function load() {
    if (bases) return Promise.resolve(bases);
    if (loading) return loading;
    loading = new Promise(function (resolve) {
      var tries = 0;
      (function attempt() {
        var a = api();
        if (!a) {
          // api.js 由部分页面的 store 懒加载，最多等待约 5 秒
          if (++tries > 50) { loading = null; resolve([]); return; }
          setTimeout(attempt, 100);
          return;
        }
        a.get('base', { page: 1, size: 500, sort: 'code', order: 'asc' }).then(function (res) {
          var list = (res && res.ok && res.data && Array.isArray(res.data.list)) ? res.data.list : [];
          bases = list.filter(function (b) { return b && b.name; }).map(function (b) {
            return { id: b.id, code: b.code || '', name: String(b.name).trim() };
          });
          loading = null;
          resolve(bases);
        }).catch(function () {
          loading = null;
          resolve([]);
        });
      })();
    });
    return loading;
  }

  function fill(sel) {
    if (!sel || sel.dataset.baseFilled === '1') return;
    sel.dataset.baseFilled = '1';
    load().then(function (list) {
      // dataset.want：页面在选项就绪前已指定的目标值，优先级高于当前选中项
      var current = sel.dataset.want !== undefined ? sel.dataset.want : sel.value;
      var first = sel.querySelector('option');
      var keepValue = first ? first.value : '';
      var label = sel.dataset.baseAllLabel || (first ? first.textContent : '全部基地');

      sel.innerHTML = '';
      var allOpt = document.createElement('option');
      allOpt.value = keepValue;
      allOpt.textContent = label;
      sel.appendChild(allOpt);

      var seen = {};
      var useId = sel.dataset.baseValue === 'id';
      list.forEach(function (b) {
        if (seen[b.name]) return;
        seen[b.name] = true;
        var opt = document.createElement('option');
        opt.value = useId ? String(b.id) : b.name;
        opt.textContent = b.name;
        sel.appendChild(opt);
      });

      if (current && Array.prototype.some.call(sel.options, function (o) { return o.value === current; })) {
        sel.value = current;
      }
      delete sel.dataset.want;
      sel.dispatchEvent(new CustomEvent('base-options:ready', { bubbles: true }));
    });
  }

  function nameOf(value) {
    if (!bases || value === undefined || value === null || value === '') return '';
    var v = String(value);
    for (var i = 0; i < bases.length; i++) {
      if (String(bases[i].id) === v || bases[i].name === v) return bases[i].name;
    }
    return '';
  }

  function fillAll() {
    Array.prototype.forEach.call(document.querySelectorAll('select[data-base-source]'), fill);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fillAll);
  } else {
    setTimeout(fillAll, 0);
  }

  return { load: load, fill: fill, fillAll: fillAll, nameOf: nameOf };
})();

window.BaseOptions = BaseOptions;

/* ============================================================
 * 品种下拉统一数据源：取自 sf_plot.variety_code 的去重结果
 * 使用方式：
 *   <select data-variety-source data-variety-all-label="全部品种">…</select>
 * ============================================================ */
var VarietyOptions = (function () {
  var names = null;
  var loading = null;

  function api() {
    return (window.Api && typeof window.Api.get === 'function') ? window.Api : null;
  }

  function load() {
    if (names) return Promise.resolve(names);
    if (loading) return loading;
    loading = new Promise(function (resolve) {
      var tries = 0;
      (function attempt() {
        var a = api();
        if (!a) {
          if (++tries > 50) { loading = null; resolve([]); return; }
          setTimeout(attempt, 100);
          return;
        }
        a.get('plot', { page: 1, size: 1000 }).then(function (res) {
          var list = (res && res.ok && res.data && Array.isArray(res.data.list)) ? res.data.list : [];
          names = [];
          list.forEach(function (p) {
            var v = p && p.variety_code ? String(p.variety_code).trim() : '';
            if (v && names.indexOf(v) < 0) names.push(v);
          });
          loading = null;
          resolve(names);
        }).catch(function () {
          loading = null;
          resolve([]);
        });
      })();
    });
    return loading;
  }

  function fill(sel) {
    if (!sel || sel.dataset.varietyFilled === '1') return;
    sel.dataset.varietyFilled = '1';
    load().then(function (list) {
      // dataset.want：页面在选项就绪前已指定的目标值，优先级高于当前选中项
      var current = sel.dataset.want !== undefined ? sel.dataset.want : sel.value;
      var first = sel.querySelector('option');
      var keepValue = first ? first.value : '';
      var label = sel.dataset.varietyAllLabel || (first ? first.textContent : '全部品种');
      sel.innerHTML = '';
      var allOpt = document.createElement('option');
      allOpt.value = keepValue;
      allOpt.textContent = label;
      sel.appendChild(allOpt);
      list.forEach(function (name) {
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
      });
      if (current && Array.prototype.some.call(sel.options, function (o) { return o.value === current; })) {
        sel.value = current;
      }
      delete sel.dataset.want;
      sel.dispatchEvent(new CustomEvent('variety-options:ready', { bubbles: true }));
    });
  }

  function fillAll() {
    Array.prototype.forEach.call(document.querySelectorAll('select[data-variety-source]'), fill);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fillAll);
  } else {
    setTimeout(fillAll, 0);
  }

  return { load: load, fill: fill, fillAll: fillAll };
})();

window.VarietyOptions = VarietyOptions;

