/**
 * 智慧果园 - 通用功能函数
 * 包含模态框、分页、搜索等通用功能
 */

// 人员下拉选项（系统设置中的用户列表）
const USER_OPTIONS = [
  '惠加宁', '黄忠坚', '徐水应', '朱泉龙', '陈小忠',
  '廖春亮', '李建明', '李根', '张才孙', '刘全国',
  '毛定卫', '叶三东', '周才贵', '程名高', '邓小华',
  '周成友', '危红卫', '方超', '曹红英', '崔新根',
  '超级用户'
];
window.USER_OPTIONS = USER_OPTIONS;

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

// 模态框操作
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
      modal.classList.remove('show');
    });
    document.body.style.overflow = '';
  }
};

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

// 删除确认对话框
const ConfirmDialog = {
  show: function(options) {
    const { title, message, onConfirm, onCancel } = options;

    const dialog = document.createElement('div');
    dialog.className = 'modal-overlay show';
    dialog.innerHTML = `
      <div class="modal-box" style="max-width: 420px;">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" onclick="ConfirmDialog.hide(this)">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 4L12 12M12 4L4 12"/>
            </svg>
          </button>
        </div>
        <div class="modal-body" style="text-align: center;">
          <div style="font-size: 36px; margin-bottom: 12px;">⚠</div>
          <p style="color: var(--text-secondary);">${message}</p>
        </div>
        <div class="modal-footer">
          <button class="jg-btn" onclick="ConfirmDialog.hide(this); if (typeof onCancel === 'function') onCancel();">取消</button>
          <button class="jg-btn jg-btn-danger" onclick="ConfirmDialog.hide(this); if (typeof onConfirm === 'function') onConfirm();">确认删除</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);
  },

  hide: function(btn) {
    const overlay = btn.closest('.modal-overlay');
    if (overlay) {
      overlay.remove();
      document.body.style.overflow = '';
    }
  }
};

// 消息提示
const Toast = {
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
      e.target.classList.remove('show');
      document.body.style.overflow = '';
    }
  });

  // ESC键关闭模态框
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      Modal.hideAll();
    }
  });
});

// 导出为全局变量
window.Modal = Modal;
window.Pagination = Pagination;
window.Search = Search;
window.ConfirmDialog = ConfirmDialog;
window.Toast = Toast;;

