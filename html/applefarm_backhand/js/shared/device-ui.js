/**
 * 设备管理页面通用 UI 助手（Device UI）
 * --------------------------------------------------------------
 * 为设备管理各页面提供一致的表格渲染、分页、详情弹窗、导出与下拉填充能力，
 * 避免每个页面重复实现分页、导出 CSV、状态标签等样板代码。
 *
 * 使用前提：页面已引入 components/modal.js（提供 Modal / Toast）与
 *           components/confirm.js（提供 Confirm）。
 * 注意：本文件不声明 Modal / Pagination 等全局同名变量，
 *       因此可与 common-functions.js、components/modal.js 同时引用。
 *
 * 暴露 API：
 *   DeviceUI.pagination(options)   → 返回一个分页控制器（内联 Pagination 风格）
 *   DeviceUI.statusTag(status, map) → 状态标签 HTML
 *   DeviceUI.detailModal(title, rows) → 打开详情弹窗
 *   DeviceUI.confirmDelete(msg)   → 删除确认 Promise
 *   DeviceUI.toast(msg, type)      → Toast 包装
 *   DeviceUI.exportCsv(filename, headers, rows) → 导出 CSV
 *   DeviceUI.fillSelect(selectId, options, placeholder) → 填充下拉
 *   DeviceUI.esc(s)                → HTML 转义
 *   DeviceUI.operators()           → 人员下拉
 */

(function (global) {
  'use strict';

  var OPERATORS = [
    '惠加宁', '黄忠坚', '徐水应', '朱泉龙', '陈小忠',
    '廖春亮', '李建明', '李根', '张才孙', '刘全国',
    '毛定卫', '叶三东', '周才贵', '程名高', '邓小华',
    '周成友', '危红卫', '方超', '曹红英', '崔新根',
    '超级用户'
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function toast(msg, type) {
    if (typeof Toast !== 'undefined' && Toast.show) Toast.show(msg, type || 'info');
  }

  /**
   * 内联分页控制器（与农事计划 / 基地管理一致：‹ 1 2 3 › 第 X 页/共 Y 页，共 Z 条记录）
   * 不声明全局 Pagination，避免与 common-functions.js 冲突。
   */
  function pagination(options) {
    var opt = options || {};
    var ctrl = {
      currentPage: 1,
      pageSize: 10,
      filteredData: [],
      containerId: opt.containerId || 'pagination-container',
      tbodyId: opt.tbodyId || 'dataTableBody',
      renderRow: opt.renderRow || null,
      onRender: opt.onRender || null,

      init: function (o) {
        if (o) {
          if (o.currentPage) this.currentPage = o.currentPage;
          if (o.pageSize) this.pageSize = o.pageSize;
          if (o.containerId) this.containerId = o.containerId;
          if (o.tbodyId) this.tbodyId = o.tbodyId;
          if (o.renderRow) this.renderRow = o.renderRow;
        }
        this.filteredData = opt.data || [];
        this.render();
      },

      renderTable: function () {
        var tbody = document.getElementById(this.tbodyId);
        if (!tbody) return;
        if (!this.filteredData.length) {
          var cols = opt.emptyCols || 8;
          tbody.innerHTML = '<tr class="empty-row"><td colspan="' + cols + '" style="text-align:center;color:var(--text-tertiary);padding:40px 0;">暂无符合条件的数据</td></tr>';
          return;
        }
        var start = (this.currentPage - 1) * this.pageSize;
        var pageData = this.filteredData.slice(start, start + this.pageSize);
        tbody.innerHTML = pageData.map(function (item, i) {
          return this.renderRow(item, start + i + 1);
        }, this).join('');
      },

      render: function () {
        var container = document.getElementById(this.containerId);
        if (!container) return;
        var totalPages = Math.ceil(this.filteredData.length / this.pageSize);
        if (totalPages === 0) totalPages = 1;
        var html = '<div class="pagination">';
        html += '<button class="page-btn ' + (this.currentPage <= 1 ? 'disabled' : '') + '" onclick="DeviceUI.page(this,' + (this.currentPage - 1) + ')">‹</button>';
        for (var i = 1; i <= totalPages; i++) {
          if (i === 1 || i === totalPages || (i >= this.currentPage - 1 && i <= this.currentPage + 1)) {
            html += '<button class="page-btn ' + (i === this.currentPage ? 'active' : '') + '" onclick="DeviceUI.page(this,' + i + ')">' + i + '</button>';
          } else if (i === this.currentPage - 2 || i === this.currentPage + 2) {
            html += '<span class="page-ellipsis" style="padding:0 8px;color:#6b7b6b;">...</span>';
          }
        }
        html += '<button class="page-btn ' + (this.currentPage >= totalPages ? 'disabled' : '') + '" onclick="DeviceUI.page(this,' + (this.currentPage + 1) + ')">›</button>';
        html += '<span style="margin-left:16px;font-size:13px;color:#6b7b6b;">第 ' + this.currentPage + ' 页/共 ' + totalPages + ' 页，共 ' + this.filteredData.length + ' 条记录</span>';
        html += '</div>';
        container.innerHTML = html;
        this.renderTable();
        if (this.onRender) this.onRender();
      },

      goToPage: function (page) {
        var totalPages = Math.ceil(this.filteredData.length / this.pageSize);
        if (totalPages === 0) totalPages = 1;
        if (page < 1 || page > totalPages) return;
        this.currentPage = page;
        this.render();
      },

      updateData: function (data) {
        this.filteredData = data || [];
        this.currentPage = 1;
        this.render();
      },

      refresh: function () {
        this.render();
      }
    };
    // 暴露单例控制器，供 onclick 调用
    DeviceUI.current = ctrl;
    return ctrl;
  }

  /** 供 onclick="DeviceUI.page(this,N)" 调用 */
  function page(ctrl, n) {
    var c = ctrl || DeviceUI.current;
    if (c && c.goToPage) c.goToPage(n);
  }

  var TAG_CLASSES = {
    online: 'online', maintain: 'maintain', offline: 'offline',
    running: 'online', warning: 'warning', pending: 'warning',
    completed: 'online', cancelled: 'offline', processing: 'processing',
    idle: 'warning', inuse: 'online', repair: 'processing',
    scrapped: 'offline', transferred: 'processing',
    done: 'online', abnormal: 'offline', checking: 'processing',
    draft: 'warning', success: 'online', failed: 'offline',
    accepted: 'processing', rejected: 'offline', sent: 'processing',
    pass: 'online', expired: 'offline', in_stock: 'online',
    low: 'warning', out: 'offline'
  };

  function statusTag(status, text, extraClass) {
    var cls = TAG_CLASSES[status] || 'offline';
    if (extraClass) cls += ' ' + extraClass;
    return '<span class="status-tag ' + cls + '">' + esc(text || status || '-') + '</span>';
  }

  /**
   * 打开详情弹窗
   * rows: [[label, valueHtml], ...]
   */
  function detailModal(title, rows, options) {
    var opt = options || {};
    var html = '<div class="detail-info">' + rows.map(function (r) {
      return '<div class="detail-row"><span class="detail-label">' + esc(r[0]) + '</span>' +
        '<span class="detail-value">' + (r[2] === 'raw' ? r[1] : esc(r[1])) + '</span></div>';
    }).join('') + '</div>';
    if (opt.extra) html += opt.extra;
    var footer = '<button class="jg-btn" onclick="Modal.close()">关闭</button>';
    if (opt.editId) {
      footer += '<button class="jg-btn jg-btn-primary" onclick="Modal.close();' +
        opt.editFn + '(' + JSON.stringify(opt.editId) + ')">编辑</button>';
    }
    Modal.open({
      title: title,
      content: html,
      footer: footer,
      width: opt.width || '640px'
    });
  }

  function confirmDelete(msg) {
    if (typeof Confirm !== 'undefined') {
      return Confirm.delete(msg || '确定要删除吗？此操作不可撤销。');
    }
    return Promise.resolve(window.confirm(msg));
  }

  /**
   * 通用二次确认（非删除类操作，避免误用「删除」文案与红色危险按钮）
   * opts: { title, confirmText, icon }
   */
  function confirmAction(msg, opts) {
    opts = opts || {};
    if (typeof Confirm !== 'undefined') {
      return Confirm.open(msg, {
        title: opts.title || '确认操作',
        confirmText: opts.confirmText || '确定',
        icon: opts.icon || '💡'
      });
    }
    return Promise.resolve(window.confirm(msg));
  }

  function exportCsv(filename, headers, rows) {
    try {
      var csv = [headers.join(',')].concat(rows.map(function (r) {
        return r.map(function (c) {
          var s = String(c == null ? '' : c);
          return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }).join(',');
      })).join('\n');
      var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename + '_' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
      toast('导出成功，共 ' + rows.length + ' 条', 'success');
      return true;
    } catch (e) {
      toast('导出失败', 'error');
      return false;
    }
  }

  /**
   * 填充下拉
   * options: [{value, label}] 或 字符串数组
   */
  function fillSelect(selectId, options, placeholder) {
    var sel = document.getElementById(selectId);
    if (!sel) return;
    var cur = sel.value;
    sel.innerHTML = '';
    if (placeholder !== null && placeholder !== undefined) {
      var o0 = document.createElement('option');
      o0.value = '';
      o0.textContent = placeholder;
      sel.appendChild(o0);
    }
    (options || []).forEach(function (op) {
      var o = document.createElement('option');
      if (typeof op === 'string') { o.value = op; o.textContent = op; }
      else { o.value = op.value; o.textContent = op.label; }
      sel.appendChild(o);
    });
    if (cur) sel.value = cur;
  }

  function operators() {
    return OPERATORS.slice();
  }

  function operatorOptions() {
    return OPERATORS.map(function (n) { return { value: n, label: n }; });
  }

  global.DeviceUI = {
    esc: esc,
    toast: toast,
    pagination: pagination,
    page: page,
    statusTag: statusTag,
    detailModal: detailModal,
    confirmDelete: confirmDelete,
    confirmAction: confirmAction,
    exportCsv: exportCsv,
    fillSelect: fillSelect,
    operators: operators,
    operatorOptions: operatorOptions,
    current: null
  };
})(window);
