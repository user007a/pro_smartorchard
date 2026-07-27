/**
 * 统一模态框组件 - Modal Component
 * 基于 design-system.css 的模态框样式
 * 使用方式:
 *   Modal.open({
 *     title: '标题',
 *     content: '<p>内容HTML</p>',
 *     footer: '<button>确定</button>',
 *     width: '560px',
 *     onClose: () => {}
 *   });
 */

const Modal = (function() {
  let currentModal = null;
  let modalStack = [];

  // 创建模态框容器
  function createModal(options) {
    const {
      title = '提示',
      content = '',
      footer = '',
      width = '560px',
      showClose = true,
      closeOnOverlay = true,
      closeOnEsc = true,
      onClose = null,
      animClass = 'modalIn'
    } = options;

    // 创建 overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.dataset.modal = 'true';

    // 创建 modal box
    const modalBox = document.createElement('div');
    modalBox.className = 'modal-box';
    modalBox.style.maxWidth = width;

    // 标题栏
    let headerHtml = `
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
    `;
    if (showClose) {
      headerHtml += `
        <button class="modal-close" data-action="close">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M4 4L12 12M12 4L4 12"/>
          </svg>
        </button>
      `;
    }
    headerHtml += '</div>';

    // 内容区
    const bodyHtml = `
      <div class="modal-body">${content}</div>
    `;

    // 底部区
    let footerHtml = '';
    if (footer) {
      footerHtml = `<div class="modal-footer">${footer}</div>`;
    }

    modalBox.innerHTML = headerHtml + bodyHtml + footerHtml;
    overlay.appendChild(modalBox);

    // 事件绑定
    const closeBtn = modalBox.querySelector('[data-action="close"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => close(onClose));
    }

    if (closeOnOverlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          close(onClose);
        }
      });
    }

    if (closeOnEsc) {
      overlay._escHandler = (e) => {
        if (e.key === 'Escape') {
          close(onClose);
        }
      };
      document.addEventListener('keydown', overlay._escHandler);
    }

    return overlay;
  }

  // 打开模态框
  function open(options) {
    // 如果已有模态框，先关闭
    if (currentModal) {
      close(null, false);
    }

    const overlay = createModal(options);
    document.body.appendChild(overlay);
    currentModal = overlay;
    modalStack.push(overlay);

    // 触发动画
    requestAnimationFrame(() => {
      overlay.classList.add('show');
    });

    // 禁止背景滚动
    document.body.style.overflow = 'hidden';

    return overlay;
  }

  // 关闭模态框
  function close(callback, animate = true) {
    if (!currentModal) return;

    const overlay = currentModal;
    const modalBox = overlay.querySelector('.modal-box');

    if (animate) {
      overlay.classList.remove('show');
      setTimeout(() => {
        destroy(overlay);
      }, 200);
    } else {
      destroy(overlay);
    }

    function destroy(overlay) {
      // 移除 ESC 监听
      if (overlay._escHandler) {
        document.removeEventListener('keydown', overlay._escHandler);
      }
      overlay.remove();
      modalStack = modalStack.filter(m => m !== overlay);
      currentModal = modalStack[modalStack.length - 1] || null;

      // 恢复背景滚动
      if (!currentModal) {
        document.body.style.overflow = '';
      }

      if (callback) callback();
    }

    return overlay;
  }

  // 显示加载状态
  function loading(text = '加载中...') {
    const content = `
      <div style="text-align: center; padding: 40px 20px;">
        <div class="loading-spinner" style="margin: 0 auto 16px;"></div>
        <p style="color: var(--text-secondary);">${text}</p>
      </div>
    `;
    return open({
      title: '请稍候',
      content: content,
      showClose: false,
      closeOnOverlay: false,
      closeOnEsc: false
    });
  }

  // 关闭加载状态
  function hideLoading() {
    close();
  }

  // 显示成功提示
  function success(message, duration = 2000) {
    Toast.show(message, 'success');
  }

  // 显示错误提示
  function error(message, duration = 3000) {
    Toast.show(message, 'error');
  }

  // 显示警告提示
  function warning(message, duration = 2500) {
    Toast.show(message, 'warning');
  }

  // 显示信息提示
  function info(message, duration = 2000) {
    Toast.show(message, 'info');
  }

  // 确认对话框
  function confirm(message, options = {}) {
    return new Promise((resolve) => {
      const {
        title = '确认操作',
        confirmText = '确定',
        cancelText = '取消',
        confirmClass = 'jg-btn-primary',
        cancelClass = 'jg-btn-secondary',
        danger = false
      } = options;

      const footer = `
        <button class="jg-btn ${cancelClass}" data-action="cancel">${cancelText}</button>
        <button class="jg-btn ${confirmClass}" data-action="confirm">${confirmText}</button>
      `;

      const modal = open({
        title: title,
        content: `<div style="text-align: center; padding: 20px 0;">
          <div style="font-size: 48px; margin-bottom: 16px;">${danger ? '⚠️' : '💡'}</div>
          <p style="font-size: 15px; color: var(--text-primary);">${message}</p>
        </div>`,
        footer: footer,
        width: '400px',
        onClose: () => resolve(false)
      });

      modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        close();
        resolve(false);
      });

      modal.querySelector('[data-action="confirm"]').addEventListener('click', () => {
        close();
        resolve(true);
      });
    });
  }

  // 显示表单模态框
  function form(options) {
    const {
      title = '表单',
      fields = [],
      values = {},
      submitText = '提交',
      cancelText = '取消',
      onSubmit = null,
      onCancel = null,
      width = '520px'
    } = options;

    // 生成表单HTML
    let formHtml = '<form id="modal-form" class="modal-form">';
    fields.forEach(field => {
      const value = values[field.name] || field.default || '';
      const required = field.required ? 'required' : '';
      const placeholder = field.placeholder || '';

      formHtml += `<div class="form-group">`;
      formHtml += `<label class="form-label ${field.required ? 'required' : ''}">${field.label}</label>`;

      switch (field.type) {
        case 'textarea':
          formHtml += `<textarea class="form-textarea" name="${field.name}" placeholder="${placeholder}" ${required}>${value}</textarea>`;
          break;
        case 'select':
          const options = field.options || [];
          let optionsHtml = `<option value="">请选择</option>`;
          options.forEach(opt => {
            const selected = opt.value === value ? 'selected' : '';
            optionsHtml += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
          });
          formHtml += `<select class="form-select" name="${field.name}" ${required}>${optionsHtml}</select>`;
          break;
        case 'checkbox':
          formHtml += `<input type="checkbox" name="${field.name}" value="1" ${value ? 'checked' : ''} />`;
          break;
        case 'switch':
          formHtml += `
            <label class="switch">
              <input type="checkbox" name="${field.name}" ${value ? 'checked' : ''} />
              <span class="slider"></span>
            </label>
          `;
          break;
        default:
          formHtml += `<input type="${field.type || 'text'}" class="form-input" name="${field.name}" value="${value}" placeholder="${placeholder}" ${required} />`;
      }

      if (field.hint) {
        formHtml += `<div class="form-hint">${field.hint}</div>`;
      }

      formHtml += `</div>`;
    });
    formHtml += '</form>';

    const footer = `
      <button type="button" class="jg-btn jg-btn-secondary" data-action="cancel">${cancelText}</button>
      <button type="submit" form="modal-form" class="jg-btn jg-btn-primary" data-action="submit">${submitText}</button>
    `;

    const modal = open({
      title: title,
      content: formHtml,
      footer: footer,
      width: width,
      onClose: () => {
        if (onCancel) onCancel();
      }
    });

    const formEl = modal.querySelector('#modal-form');

    // 取消按钮
    modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      close();
      if (onCancel) onCancel();
    });

    // 表单提交
    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(formEl);
      const data = {};
      formData.forEach((value, key) => {
        data[key] = value;
      });

      if (onSubmit) {
        const result = onSubmit(data);
        if (result !== false) {
          close();
        }
      } else {
        close();
      }
    });

    return modal;
  }

  // 打开详情模态框
  function detail(title, data, options = {}) {
    const {
      fields = [],
      width = '600px'
    } = options;

    let contentHtml = '<div class="detail-info">';
    fields.forEach(field => {
      const value = data[field.name] || '-';
      contentHtml += `
        <div class="detail-row">
          <span class="detail-label">${field.label}</span>
          <span class="detail-value">${field.render ? field.render(value, data) : value}</span>
        </div>
      `;
    });
    contentHtml += '</div>';

    return open({
      title: title,
      content: contentHtml,
      footer: '<button class="jg-btn jg-btn-secondary" data-action="close">关闭</button>',
      width: width,
      onClose: null
    });
  }

  return {
    open,
    close,
    loading,
    hideLoading,
    success,
    error,
    warning,
    info,
    confirm,
    form,
    detail
  };
})();

// Toast 提示组件（依赖 Modal）
const Toast = (function() {
  let container = null;

  function getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      container.style.cssText = `
        position: fixed;
        top: 24px;
        right: 24px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 8px;
      `;
      document.body.appendChild(container);
    }
    return container;
  }

  function show(message, type = 'info', duration = 2000) {
    const c = getContainer();
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    const toast = document.createElement('div');
    toast.className = `jg-toast ${type}`;
    toast.innerHTML = `
      <span class="jg-toast-icon">${icons[type]}</span>
      <span class="jg-toast-message">${message}</span>
    `;
    c.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  return { show };
})();

// 导出组件
window.Modal = Modal;
window.Toast = Toast;
