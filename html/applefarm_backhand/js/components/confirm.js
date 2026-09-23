/**
 * 确认对话框组件 - Confirm Component
 * 基于 Modal 组件的确认对话框封装
 * 使用方式:
 *   Confirm.open('确定要删除吗？')
 *     .then(() => { // 用户确认 })
 *     .catch(() => { // 用户取消 });
 */

const Confirm = (function() {

  // 确认操作
  function open(message, options = {}) {
    const defaults = {
      title: '确认操作',
      confirmText: '确定',
      cancelText: '取消',
      confirmClass: 'jg-btn-primary',
      cancelClass: 'jg-btn-secondary',
      danger: false,
      icon: null,
      width: '400px'
    };

    const config = { ...defaults, ...options };

    // 危险操作使用 danger 样式
    if (config.danger) {
      config.confirmClass = 'jg-btn-danger';
    }

    // 图标
    let iconHtml = '';
    if (config.icon) {
      iconHtml = `<div style="font-size: 48px; margin-bottom: 16px;">${config.icon}</div>`;
    } else if (config.danger) {
      iconHtml = `<div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>`;
    } else {
      iconHtml = `<div style="font-size: 48px; margin-bottom: 16px;">💡</div>`;
    }

    const content = `
      <div style="text-align: center; padding: 20px 0;">
        ${iconHtml}
        <p style="font-size: 15px; color: var(--text-primary); line-height: 1.6;">${message}</p>
      </div>
    `;

    const footer = `
      ${config.cancelText ? `<button class="jg-btn ${config.cancelClass}" data-action="cancel">${config.cancelText}</button>` : ''}
      <button class="jg-btn ${config.confirmClass}" data-action="confirm">${config.confirmText}</button>
    `;

    return new Promise((resolve) => {
      const modal = Modal.open({
        title: config.title,
        content: content,
        footer: footer,
        width: config.width,
        closeOnOverlay: false,
        onClose: () => resolve(false)
      });

      const cancelBtn = modal.querySelector('[data-action="cancel"]');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          Modal.close();
          resolve(false);
        });
      }

      const confirmBtn = modal.querySelector('[data-action="confirm"]');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          Modal.close();
          resolve(true);
        });
      }
    });
  }

  // 删除确认（delete 为 JS 保留字，不能作函数名，2026-09-22 修复语法错误）
  function confirmDelete(message = '确定要删除吗？此操作不可撤销。') {
    return open(message, {
      title: '删除确认',
      confirmText: '删除',
      danger: true,
      icon: '🗑️'
    });
  }

  // 成功确认
  function success(message, options = {}) {
    return open(message, {
      title: options.title || '操作成功',
      confirmText: options.confirmText || '我知道了',
      cancelText: null,
      icon: '✅'
    });
  }

  // 警告确认
  function warning(message, options = {}) {
    return open(message, {
      title: options.title || '警告',
      confirmText: options.confirmText || '继续',
      cancelText: options.cancelText || '取消',
      danger: true
    });
  }

  // 批量操作确认
  function batch(message, options = {}) {
    const count = options.count || 0;
    const itemName = options.itemName || '项';
    return open(`${message}（共 ${count} ${itemName}）`, {
      title: options.title || '批量操作确认',
      confirmText: options.confirmText || '确认操作',
      cancelText: options.cancelText || '取消',
      icon: '📋'
    });
  }

  return {
    open,
    delete: confirmDelete,
    success,
    warning,
    batch
  };
})();

// 导出
window.Confirm = Confirm;

// 兼容别名：部分页面以 ConfirmDialog.show({title, message, onConfirm}) 形式调用
window.ConfirmDialog = {
  show: function(config) {
    config = config || {};
    Confirm.open(config.message || '', {
      title: config.title,
      confirmText: config.confirmText || '确定',
      danger: config.danger !== false
    }).then(function(ok) {
      if (ok && typeof config.onConfirm === 'function') config.onConfirm();
    });
  }
};
