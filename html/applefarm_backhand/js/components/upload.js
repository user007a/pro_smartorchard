/**
 * 文件上传组件 - Upload Component
 * 支持图片和文件上传，预览和进度显示
 * 使用方式:
 *   Upload.open({
 *     type: 'image', // image | file
 *     accept: '.jpg,.png',
 *     maxSize: 5 * 1024 * 1024, // 5MB
 *     multiple: false,
 *     onChange: (files) => {}
 *   });
 */

const Upload = (function() {

  // 创建上传组件
  function create(options) {
    const defaults = {
      type: 'image', // image | file
      accept: '',
      maxSize: 10 * 1024 * 1024, // 10MB
      multiple: false,
      maxFiles: 9,
      value: [], // 初始值
      onChange: null,
      onError: null
    };

    const config = { ...defaults, ...options };
    const container = document.createElement('div');
    container.className = 'upload-component';
    container.innerHTML = createUploadArea(config);

    // 事件绑定
    initEvents(container, config);

    return container;
  }

  // 创建上传区域HTML
  function createUploadArea(config) {
    const isMultiple = config.multiple;
    const acceptAttr = config.accept ? `accept="${config.accept}"` : '';
    const maxFilesAttr = config.multiple ? `data-max-files="${config.maxFiles}"` : '';

    let previewList = '';
    if (config.value && config.value.length > 0) {
      config.value.forEach((url, index) => {
        previewList += createPreviewItem(url, config.type, index);
      });
    }

    return `
      <div class="upload-area ${config.value.length > 0 ? 'has-files' : ''}" data-type="${config.type}">
        <input type="file"
          class="upload-input"
          ${acceptAttr}
          ${isMultiple ? 'multiple' : ''}
          ${maxFilesAttr}
          data-type="${config.type}" />
        <div class="upload-content">
          <div class="upload-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 16V4M12 4L9 7M12 4L15 7"/>
              <path d="M4 17V19C4 20.1 4.9 21 6 21H18C19.1 21 20 20.1 20 19V17"/>
            </svg>
          </div>
          <div class="upload-text">
            <span class="upload-title">点击上传</span>
            <span class="upload-hint">或拖拽文件到此处</span>
          </div>
          <div class="upload-limit">
            ${config.type === 'image' ? '支持 JPG、PNG 格式' : '支持常见文件格式'}
            ${config.maxSize < 1024 * 1024 * 1024 ? `，大小不超过 ${formatSize(config.maxSize)}` : ''}
          </div>
        </div>
      </div>
      <div class="upload-preview-list" data-type="${config.type}">
        ${previewList}
      </div>
    `;
  }

  // 创建预览项
  function createPreviewItem(url, type, index) {
    if (type === 'image') {
      return `
        <div class="upload-preview-item" data-index="${index}" data-url="${url}">
          <img src="${url}" alt="预览" class="upload-preview-image" />
          <button type="button" class="upload-preview-remove" title="移除">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4L12 12M12 4L4 12"/>
            </svg>
          </button>
        </div>
      `;
    } else {
      const fileName = url.split('/').pop() || '文件';
      return `
        <div class="upload-preview-item" data-index="${index}" data-url="${url}">
          <div class="upload-preview-file">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6C5.4 2 5 2.4 5 3V21C5 21.6 5.4 22 6 22H18C18.6 22 19 21.6 19 21V7L14 2Z"/>
              <path d="M14 2V7H19"/>
            </svg>
          </div>
          <span class="upload-preview-name">${fileName}</span>
          <button type="button" class="upload-preview-remove" title="移除">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4L12 12M12 4L4 12"/>
            </svg>
          </button>
        </div>
      `;
    }
  }

  // 初始化事件
  function initEvents(container, config) {
    const input = container.querySelector('.upload-input');
    const area = container.querySelector('.upload-area');
    const previewList = container.querySelector('.upload-preview-list');

    // 点击上传
    area.addEventListener('click', () => {
      input.click();
    });

    // 文件选择
    input.addEventListener('change', (e) => {
      handleFiles(e.target.files, config, container, previewList);
      input.value = ''; // 允许重复选择同一文件
    });

    // 拖拽上传
    area.addEventListener('dragover', (e) => {
      e.preventDefault();
      area.classList.add('dragover');
    });

    area.addEventListener('dragleave', () => {
      area.classList.remove('dragover');
    });

    area.addEventListener('drop', (e) => {
      e.preventDefault();
      area.classList.remove('dragover');
      handleFiles(e.dataTransfer.files, config, container, previewList);
    });

    // 移除预览
    previewList.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.upload-preview-remove');
      if (removeBtn) {
        const item = removeBtn.closest('.upload-preview-item');
        const index = parseInt(item.dataset.index);
        removePreviewItem(item, index, config, container, previewList);
      }
    });
  }

  // 处理文件
  function handleFiles(files, config, container, previewList) {
    const fileArray = Array.from(files);
    const existingCount = previewList.children.length;
    const allowedCount = config.multiple ? config.maxFiles - existingCount : 1;

    if (allowedCount <= 0) {
      Toast.show(`最多只能上传 ${config.maxFiles} 个文件`, 'warning');
      return;
    }

    const validFiles = [];
    const errors = [];

    fileArray.slice(0, allowedCount).forEach(file => {
      // 检查文件类型
      if (config.accept && config.accept.length > 0) {
        const acceptTypes = config.accept.split(',').map(t => t.trim());
        const fileExt = '.' + file.name.split('.').pop().toLowerCase();
        const mimeType = file.type;

        const isValid = acceptTypes.some(type => {
          if (type.startsWith('.')) {
            return type.toLowerCase() === fileExt;
          } else if (type.includes('/*')) {
            return mimeType.startsWith(type.replace('/*', '/'));
          } else {
            return mimeType === type;
          }
        });

        if (!isValid) {
          errors.push(`${file.name}：文件类型不支持`);
          return;
        }
      }

      // 检查文件大小
      if (file.size > config.maxSize) {
        errors.push(`${file.name}：文件大小超过限制`);
        return;
      }

      validFiles.push(file);
    });

    if (errors.length > 0) {
      Toast.show(errors[0], 'error');
      if (config.onError) config.onError(errors);
    }

    if (validFiles.length === 0) return;

    // 处理有效文件
    validFiles.forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target.result;
        addPreviewItem(url, file.name, config.type, previewList, container);

        // 触发回调
        if (config.onChange) {
          const allFiles = getFiles(container);
          config.onChange(allFiles, file);
        }
      };

      if (config.type === 'image') {
        reader.readAsDataURL(file);
      } else {
        reader.readAsDataURL(file);
      }
    });
  }

  // 添加预览项
  function addPreviewItem(url, name, type, previewList, container) {
    const index = previewList.children.length;
    const item = document.createElement('div');
    item.className = 'upload-preview-item';
    item.dataset.index = index;
    item.dataset.url = url;
    item.dataset.name = name;

    if (type === 'image') {
      item.innerHTML = `
        <img src="${url}" alt="预览" class="upload-preview-image" />
        <button type="button" class="upload-preview-remove" title="移除">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4L12 12M12 4L4 12"/>
          </svg>
        </button>
      `;
    } else {
      item.innerHTML = `
        <div class="upload-preview-file">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6C5.4 2 5 2.4 5 3V21C5 21.6 5.4 22 6 22H18C18.6 22 19 21.6 19 21V7L14 2Z"/>
            <path d="M14 2V7H19"/>
          </svg>
        </div>
        <span class="upload-preview-name">${name}</span>
        <button type="button" class="upload-preview-remove" title="移除">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4L12 12M12 4L4 12"/>
          </svg>
        </button>
      `;
    }

    previewList.appendChild(item);
    container.querySelector('.upload-area').classList.add('has-files');
  }

  // 移除预览项
  function removePreviewItem(item, index, config, container, previewList) {
    item.remove();

    // 重新索引
    Array.from(previewList.children).forEach((el, i) => {
      el.dataset.index = i;
    });

    if (previewList.children.length === 0) {
      container.querySelector('.upload-area').classList.remove('has-files');
    }

    // 触发回调
    if (config.onChange) {
      const allFiles = getFiles(container);
      config.onChange(allFiles);
    }
  }

  // 获取所有文件
  function getFiles(container) {
    const previewList = container.querySelector('.upload-preview-list');
    const files = [];
    Array.from(previewList.children).forEach(item => {
      files.push({
        url: item.dataset.url,
        name: item.dataset.name || '未命名文件',
        index: parseInt(item.dataset.index)
      });
    });
    return files;
  }

  // 格式化文件大小
  function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // 打开上传弹窗
  function open(options = {}) {
    const config = {
      type: options.type || 'image',
      accept: options.accept || (options.type === 'image' ? 'image/*' : ''),
      maxSize: options.maxSize || 10 * 1024 * 1024,
      multiple: options.multiple !== false,
      maxFiles: options.maxFiles || 9,
      title: options.title || '上传文件',
      onUpload: options.onUpload || null
    };

    const content = `
      <div class="upload-wrapper">
        ${createUploadArea(config).replace('upload-area', 'upload-area in-modal')}
      </div>
    `;

    Modal.open({
      title: config.title,
      content: content,
      footer: '<button class="jg-btn jg-btn-secondary" data-action="cancel">取消</button><button class="jg-btn jg-btn-primary" data-action="confirm">完成</button>',
      width: '600px',
      onClose: () => {
        if (options.onClose) options.onClose();
      }
    });

    const modal = document.querySelector('.modal-overlay.show');
    const container = modal.querySelector('.upload-wrapper');

    // 初始化事件
    initEvents(container, config);

    // 按钮事件
    modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      Modal.close();
      if (options.onClose) options.onClose();
    });

    modal.querySelector('[data-action="confirm"]').addEventListener('click', () => {
      const files = getFiles(container);
      Modal.close();
      if (config.onUpload) {
        config.onUpload(files);
      }
    });
  }

  return {
    create,
    open
  };
})();

// 导出
window.Upload = Upload;
