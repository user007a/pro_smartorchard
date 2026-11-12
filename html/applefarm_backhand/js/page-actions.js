/**
 * 页面交互功能模块
 * 包含：数据模拟、表单操作、列表操作、分页、导入导出、扫码等功能
 */

// 人员下拉选项（系统设置中的用户列表，与 common-functions.js 保持一致）
const USER_OPTIONS_LIST = [];
// 生成人员 select 字段的 options 数组（供 Modal.form 的 type:'select' 使用）
function buildUserOptions(selectedValue) {
  const opts = [{ value: '', label: '请选择负责人' }];
  USER_OPTIONS_LIST.forEach(function(name) {
    opts.push({ value: name, label: name });
  });
  return opts;
}
// 多选人员 select（用于采收人等场景）
function buildUserOptionsMulti(selectedValues) {
  const arr = Array.isArray(selectedValues) ? selectedValues : (selectedValues ? String(selectedValues).split(/[,，、]/) : []);
  const opts = [{ value: '', label: '请选择人员（可多选）' }];
  USER_OPTIONS_LIST.forEach(function(name) {
    opts.push({ value: name, label: name, selected: arr.indexOf(name) !== -1 });
  });
  return opts;
}

// 基地状态 4 态（筹建中 / 已建成 / 运营中 / 已停用）
const BASE_STATUS_OPTIONS = [
  { value: 'planning', label: '筹建中' },
  { value: 'built', label: '已建成' },
  { value: 'active', label: '运营中' },
  { value: 'disabled', label: '已停用' }
];
// 基地图片上传上限：4 张
const BASE_IMAGE_MAX = 4;

/* ============================================================
 * 证书相关辅助（数据源统一为共享数据层 CertStore）
 * ============================================================ */

/* ---------- 证书附件上传控件（企业资质扫描件 / 检测报告 PDF） ----------
 * 需同时被顶层字段构造器（certCreateFields / certEditFields）与
 * PageActions 内部的弹窗交互绑定逻辑使用，故定义在模块顶层。
 * options: { max 上限个数（默认 6）, hint 提示文案 }
 */
function buildCertAttachmentsUploader(files, options) {
  const opt = options || {};
  const max = opt.max || 6;
  const list = (Array.isArray(files) ? files : []).slice(0, max);
  const previews = list.map(f => {
    const url = f.url || '';
    const name = f.name || '附件';
    const inner = (f.type || '').indexOf('image') === 0
      ? `<img src="${url}" alt="${name}" />`
      : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-tertiary);font-size:20px;">📄</div>`;
    return `
      <div class="ent-upload-item" data-url="${url.replace(/"/g, '&quot;')}" data-name="${name.replace(/"/g, '&quot;')}" data-type="${(f.type || '').replace(/"/g, '&quot;')}" data-size="${f.size || 0}" data-source="preset">
        ${inner}
        <button type="button" class="ent-upload-remove" title="移除" aria-label="移除">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l6 6M9 3l-6 6"/></svg>
        </button>
      </div>
    `;
  }).join('');

  return `
    <div class="ent-upload" data-field="attachments" data-max="${max}">
      <div class="ent-upload-toolbar">
        <label class="ent-upload-btn">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3v10M3 8h10"/>
          </svg>
          添加附件
          <input type="file" accept="image/*,application/pdf" multiple class="ent-upload-input" />
        </label>
        <span class="ent-upload-count">已上传 <b class="ent-upload-num">${list.length}</b> / ${max} 个</span>
        <span class="ent-upload-hint">${opt.hint || '支持 JPG / PNG / PDF，单个不超过 5MB'}</span>
      </div>
      <div class="ent-upload-list">${previews}</div>
    </div>
  `;
}

function collectCertAttachments(modal) {
  const wrap = modal.querySelector('.ent-upload[data-field="attachments"]');
  if (!wrap) return [];
  const out = [];
  wrap.querySelectorAll('.ent-upload-item').forEach(item => {
    const url = item.dataset.url;
    if (!url) return;
    out.push({
      url: url,
      name: item.dataset.name || '附件',
      type: item.dataset.type || '',
      size: Number(item.dataset.size) || 0,
      uploadedAt: (window.CertStore ? CertStore.stampNow() : new Date().toISOString())
    });
  });
  return out;
}

// 刷新上传控件的计数与剩余空位占位卡
function updateUploadState(wrap) {
  const max = parseInt(wrap.dataset.max, 10) || 4;
  const count = wrap.querySelectorAll('.ent-upload-item').length;
  const num = wrap.querySelector('.ent-upload-num');
  if (num) num.textContent = count;
  const btn = wrap.querySelector('.ent-upload-btn');
  if (btn) btn.classList.toggle('is-disabled', count >= max);
  const fileInput = wrap.querySelector('.ent-upload-input');
  if (fileInput) fileInput.disabled = count >= max;

  const list = wrap.querySelector('.ent-upload-list');
  if (!list) return;
  // 移除旧的空位占位卡
  list.querySelectorAll('.ent-upload-slot').forEach(el => el.remove());
  // 按剩余额度补足占位卡
  for (let i = count; i < max; i++) {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'ent-upload-slot';
    slot.setAttribute('aria-label', '添加图片');
    slot.innerHTML = `
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 4v12M4 10h12"/>
      </svg>
      <span>${i + 1}</span>
    `;
    list.appendChild(slot);
  }
}

/* ---------- 弹窗表单上传交互（证书附件 / 基地图片） ----------
 * 需同时被顶层函数 openCertCreateForm 与 PageActions 内部使用，故定义在模块顶层。
 */
function addBaseImageItem(list, url, source, name) {
  const wrap = list.closest('.ent-upload');
  const max = wrap ? (parseInt(wrap.dataset.max, 10) || 4) : 4;
  const existingCount = list.querySelectorAll('.ent-upload-item').length;
  if (existingCount >= max) {
    window.Toast && window.Toast.show(`最多上传 ${max} 张图片`, 'warning');
    return;
  }
  // 重复检测
  const dup = Array.from(list.querySelectorAll('.ent-upload-item')).some(el => el.dataset.url === url);
  if (dup) {
    window.Toast && window.Toast.show('该图片已存在', 'warning');
    return;
  }
  const item = document.createElement('div');
  item.className = 'ent-upload-item';
  item.dataset.url = url;
  item.dataset.source = source;
  item.innerHTML = `
    <img src="${url}" alt="${name || '基地图片'}" />
    <button type="button" class="ent-upload-remove" title="移除" aria-label="移除">
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 3l6 6M9 3l-6 6"/></svg>
    </button>
  `;
  list.appendChild(item);
  if (wrap) updateUploadState(wrap);
}


function bindEnterpriseFormInteractions(modal) {
  // 证书附件上传（与图片上传结构一致，但记录文件名 / 类型 / 大小）
  const attachWrap = modal.querySelector('.ent-upload[data-field="attachments"]');
  if (attachWrap) {
    const aList = attachWrap.querySelector('.ent-upload-list');
    const aInput = attachWrap.querySelector('.ent-upload-input');
    const aMax = parseInt(attachWrap.dataset.max, 10) || 6;
    updateUploadState(attachWrap);
    aInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const remain = Math.max(0, aMax - aList.querySelectorAll('.ent-upload-item').length);
      files.slice(0, remain).forEach(file => {
        if (file.size > 5 * 1024 * 1024) {
          window.Toast && window.Toast.show(`${file.name} 超过 5MB，已跳过`, 'warning');
          return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
          const item = document.createElement('div');
          item.className = 'ent-upload-item';
          item.dataset.url = ev.target.result;
          item.dataset.name = file.name;
          item.dataset.type = file.type || '';
          item.dataset.size = file.size || 0;
          item.dataset.source = 'local';
          const isImg = (file.type || '').indexOf('image') === 0;
          item.innerHTML = `
            ${isImg ? `<img src="${ev.target.result}" alt="${file.name}" />` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-tertiary);font-size:20px;">📄</div>'}
            <button type="button" class="ent-upload-remove" title="移除" aria-label="移除">
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l6 6M9 3l-6 6"/></svg>
            </button>
          `;
          aList.appendChild(item);
          updateUploadState(attachWrap);
        };
        reader.readAsDataURL(file);
      });
      e.target.value = '';
    });
    aList.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.ent-upload-remove');
      if (removeBtn) {
        const item = removeBtn.closest('.ent-upload-item');
        if (item) item.remove();
        updateUploadState(attachWrap);
        return;
      }
      const slot = e.target.closest('.ent-upload-slot');
      if (slot) aInput.click();
    });
  }

  const uploadWrap = modal.querySelector('.ent-upload[data-field="baseImages"]');
  if (!uploadWrap) return;
  const list = uploadWrap.querySelector('.ent-upload-list');
  const fileInput = uploadWrap.querySelector('.ent-upload-input');
  const max = parseInt(uploadWrap.dataset.max, 10) || 4;

  updateUploadState(uploadWrap);

  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const existing = list.querySelectorAll('.ent-upload-item').length;
    const remain = Math.max(0, max - existing);
    if (files.length > remain) {
      window.Toast && window.Toast.show(`最多上传 ${max} 张图片，超出部分已忽略`, 'warning');
    }
    files.slice(0, remain).forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        window.Toast && window.Toast.show(`${file.name} 超过 5MB，已跳过`, 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        addBaseImageItem(list, ev.target.result, 'local');
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  });

  list.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.ent-upload-remove');
    if (removeBtn) {
      const item = removeBtn.closest('.ent-upload-item');
      if (item) item.remove();
      updateUploadState(uploadWrap);
      return;
    }
    const slot = e.target.closest('.ent-upload-slot');
    if (slot) fileInput.click();
  });
}


function certStore() {
  return (typeof window !== 'undefined' && window.CertStore) ? window.CertStore : null;
}
function enterpriseStore() {
  return (typeof window !== 'undefined' && window.EnterpriseStore) ? window.EnterpriseStore : null;
}
function baseLedgerList() {
  const S = enterpriseStore();
  if (!S) return [];
  if (typeof S.baseLedger === 'function') return S.baseLedger();
  return [];
}
// 地块列表：严格空库模式下地块业务数据一律由各页面经 Api.get('plot') 拉取，
// PageActions 不持有任何本地副本；此处返回空列表，供同步的搜索/详情/编辑逻辑使用。
function plotList() { return []; }
function getCert(id) {
  const S = certStore();
  return S ? S.get(id) : null;
}
function certTypeOptions() {
  const S = certStore();
  if (!S) return [];
  return S.CERT_TYPES.map(t => ({ value: t.code, label: t.name }));
}
function certDeptOptions() {
  const S = certStore();
  const list = S ? S.DEPARTMENTS : [];
  return [{ value: '', label: '请选择责任部门' }].concat(list.map(d => ({ value: d, label: d })));
}
function certStatusTag(cert) {
  const S = certStore();
  if (!S || !cert) return '';
  const sv = S.computeStatus(cert);
  return `<span class="status-tag ${sv.cls}">${sv.text}</span>`;
}
function certAttachList(files) {
  const S = certStore();
  const list = Array.isArray(files) ? files : [];
  if (!list.length) return '—';
  return '<div class="attach-list">' + list.map(f => {
    const url = f.url || '';
    const name = f.name || '附件';
    const body = url ? `<a href="${url}" target="_blank" rel="noopener">${S ? S.esc(name) : name}</a>` : (S ? S.esc(name) : name);
    const size = f.size ? ' · ' + Math.round(f.size / 1024) + ' KB' : '';
    return `<div class="attach-item">${body}<span>${size}</span></div>`;
  }).join('') + '</div>';
}
function certAuditList(logs) {
  const S = certStore();
  const list = Array.isArray(logs) ? logs : [];
  if (!list.length) return '—';
  return '<div class="attach-list">' + list.map(l => {
    const at = S ? S.esc(l.at) : l.at;
    const actor = S ? S.esc(l.actor) : l.actor;
    const action = S ? S.esc(l.action) : l.action;
    const detail = S ? S.esc(l.detail) : l.detail;
    return `<div class="attach-item"><span>${at}</span><span>${actor}</span><span>${action}</span><span>${detail}</span></div>`;
  }).join('') + '</div>';
}

/** 证书详情字段：按企业资质 / 批次凭证分别展示 */
function certDetailFields(cert) {
  const S = certStore();
  const isQual = S ? S.categoryOf(cert) === 'qualification' : false;
  const days = S ? S.remainDays(cert) : null;
  const remainText = days === null || days === undefined ? '—'
    : (days < 0 ? '已过期 ' + Math.abs(days) + ' 天' : '剩余 ' + days + ' 天');
  const fields = [
    { label: '证书编号', name: 'certNo' },
    { label: '证书类型', name: 'type' },
    { label: '分类', name: 'category', render: () => isQual ? '企业资质' : '批次凭证' },
    { label: '状态', name: 'status', render: () => certStatusTag(cert) }
  ];
  if (isQual) {
    fields.push(
      { label: '证书编号（发证方）', name: 'sourceNo' },
      { label: '发证机构', name: 'issueOrg' },
      { label: '发证日期', name: 'issueDate' },
      { label: '认证范围', name: 'scope' }
    );
  } else {
    fields.push(
      { label: '关联批次', name: 'batchNo' },
      { label: '客户名称', name: 'customer' },
      { label: '产品名称', name: 'product' },
      { label: '检测结论', name: 'conclusion' },
      { label: '检测人', name: 'tester' },
      { label: '报告编号', name: 'reportNo' }
    );
  }
  fields.push(
    { label: '有效期开始', name: 'validStart' },
    { label: '有效期截止', name: 'validEnd' },
    { label: '剩余天数', name: '__remain', render: () => remainText },
    { label: '责任部门', name: 'owner' },
    { label: '经办人', name: 'operator' },
    { label: '二维码链接', name: 'qrUrl', render: v => v ? `<a href="${v}" target="_blank" rel="noopener">${v}</a>` : '—' },
    { label: '附件', name: 'attachments', render: v => certAttachList(v) },
    { label: '作废原因', name: 'revokeReason' },
    { label: '操作留痕', name: 'auditLogs', render: v => certAuditList(v) },
    { label: '创建时间', name: 'createdAt' },
    { label: '更新时间', name: 'updatedAt' }
  );
  return fields;
}

/** 证书编辑字段：已生效证书的编号 / 类型 / 批次 / 发证日期锁定 */
function certEditFields(cert) {
  const S = certStore();
  const isQual = S ? S.categoryOf(cert) === 'qualification' : false;
  const locked = cert && (cert.status === 'active' || cert.status === 'revoked');
  const fields = [
    { name: 'certNo', label: '证书编号', type: 'text', required: true, hint: locked ? '已生效证书编号不可修改' : '留空则按规则自动生成' },
    { name: 'typeCode', label: '证书类型', type: 'select', required: true, options: certTypeOptions() }
  ];
  if (isQual) {
    fields.push(
      { name: 'sourceNo', label: '证书编号（发证方）', type: 'text' },
      { name: 'issueOrg', label: '发证机构', type: 'text', required: true },
      { name: 'issueDate', label: '发证日期', type: 'date', required: true },
      { name: 'scope', label: '认证范围', type: 'text', placeholder: '如：全域 / A1 区东区 1-8 号地' },
      { name: 'validStart', label: '有效期开始', type: 'date', required: true },
      { name: 'validEnd', label: '有效期截止', type: 'date', required: true },
      { name: 'owner', label: '责任部门', type: 'select', options: certDeptOptions() },
      { name: 'operator', label: '经办人', type: 'select', options: buildUserOptions(cert && cert.operator) },
      { name: 'attachments', label: '证书扫描件 / 附件', type: 'custom',
        html: buildCertAttachmentsUploader(cert && cert.attachments),
        collect: collectCertAttachments }
    );
  } else {
    fields.push(
      { name: 'batchNo', label: '关联批次', type: 'text', required: true },
      { name: 'customer', label: '客户名称', type: 'text' },
      { name: 'product', label: '产品名称', type: 'text' },
      { name: 'validStart', label: '有效期开始', type: 'date', required: true },
      { name: 'validEnd', label: '有效期截止', type: 'date', required: true },
      { name: 'owner', label: '责任部门', type: 'select', options: certDeptOptions() },
      { name: 'operator', label: '经办人', type: 'select', options: buildUserOptions(cert && cert.operator) },
      { name: 'attachments', label: '附件（检测报告等）', type: 'custom',
        html: buildCertAttachmentsUploader(cert && cert.attachments),
        collect: collectCertAttachments }
    );
  }
  return fields;
}

/** 新建证书字段：分类切换后由 openCertCreateForm 重绘 */
function certCreateFields(category) {
  const S = certStore();
  const cat = category || 'qualification';
  const typeList = S
    ? (cat === 'qualification' ? S.QUALIFICATION_TYPES : S.BATCH_TYPES)
    : [];
  const head = [
    { name: 'category', label: '证书分类', type: 'select', required: true, options: [
      { value: 'qualification', label: '企业资质', selected: cat === 'qualification' },
      { value: 'batch', label: '批次凭证', selected: cat === 'batch' }
    ]},
    { name: 'typeCode', label: '证书类型', type: 'select', required: true, options: typeList.map(t => ({ value: t.code, label: t.name })) }
  ];
  if (cat === 'qualification') {
    return head.concat([
      { name: 'certNo', label: '证书编号', type: 'text', hint: '留空则按规则自动生成' },
      { name: 'sourceNo', label: '证书编号（发证方）', type: 'text' },
      { name: 'issueOrg', label: '发证机构', type: 'text', required: true },
      { name: 'issueDate', label: '发证日期', type: 'date', required: true },
      { name: 'scope', label: '认证范围', type: 'text', placeholder: '如：全域 / A1 区东区 1-8 号地' },
      { name: 'validStart', label: '有效期开始', type: 'date', required: true },
      { name: 'validEnd', label: '有效期截止', type: 'date', required: true },
      { name: 'owner', label: '责任部门', type: 'select', options: certDeptOptions() },
      { name: 'operator', label: '经办人', type: 'select', options: buildUserOptions() },
      { name: 'attachments', label: '证书扫描件 / 附件', type: 'custom',
        html: buildCertAttachmentsUploader([]),
        collect: collectCertAttachments }
    ]);
  }
  return head.concat([
    { name: 'certNo', label: '证书编号', type: 'text', hint: '留空则按规则自动生成' },
    { name: 'batchNo', label: '关联批次', type: 'text', required: true },
    { name: 'customer', label: '客户名称', type: 'text' },
    { name: 'product', label: '产品名称', type: 'text' },
    { name: 'conclusion', label: '检测结论', type: 'select', options: [{ value: '合格', label: '合格' }] },
    { name: 'tester', label: '检测人', type: 'text' },
    { name: 'validStart', label: '有效期开始', type: 'date', required: true },
    { name: 'validEnd', label: '有效期截止', type: 'date', required: true },
    { name: 'owner', label: '责任部门', type: 'select', options: certDeptOptions() },
    { name: 'operator', label: '经办人', type: 'select', options: buildUserOptions() },
    { name: 'attachments', label: '附件（检测报告等）', type: 'custom',
      html: buildCertAttachmentsUploader([]),
      collect: collectCertAttachments }
  ]);
}

/**
 * 新建证书弹窗：分类切换时重建表单（按分类展示不同字段），保留已填内容
 */
function openCertCreateForm(preset) {
  let category = (preset && preset.category) || 'qualification';
  let keep = Object.assign({}, preset || {});

  function render() {
    const modal = Modal.form({
      title: '新建证书',
      fields: certCreateFields(category),
      values: keep,
      submitText: '创建',
      width: '640px',
      onRender: function (m) {
        bindEnterpriseFormInteractions(m);
        const sel = m.querySelector('select[name="category"]');
        if (sel) {
          sel.addEventListener('change', function () {
            // 保存当前已填内容，切换分类后回填
            const form = m.querySelector('#modal-form');
            if (form) {
              const fd = new FormData(form);
              fd.forEach(function (v, k) { if (keep[k] === undefined) keep[k] = v; });
            }
            keep.category = sel.value;
            category = sel.value;
            Modal.close();
            render();
          });
        }
      },
      onSubmit: function (formData) {
        const res = CertStore.saveCert(Object.assign({}, formData, { status: 'active' }));
        if (!res.ok) {
          Toast.show(res.message || '创建失败', 'error');
          return false;
        }
        Toast.show('证书已创建：' + res.item.certNo, 'success');
        return true;
      }
    });
    return modal;
  }

  render();
}

const PageActions = (function() {
  // 模拟数据
  const mockData = {
    // 产品源（证书签发 / 批次管理 / 溯源编码共用）
    products: ['花牛苹果', '金帅苹果', '秦冠苹果', '礼盒装苹果'],
    // VR 全景图片库（来源于原 VR 全景页，归并到基地管理使用）
    vrPanoramas: [
      { id: 1, name: '苹果园全景-入口', group: '苹果园', image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&h=300&fit=crop' },
      { id: 2, name: '苹果园全景-观景台', group: '苹果园', image: 'https://images.unsplash.com/photo-1570913149827-d2ac84ab3f9a?w=400&h=300&fit=crop' },
      { id: 3, name: '苹果园全景-采摘区', group: '苹果园', image: 'https://images.unsplash.com/photo-1584306670957-acf935f5033c?w=400&h=300&fit=crop' },
      { id: 4, name: '葡萄园全景-入口', group: '葡萄园', image: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=400&h=300&fit=crop' },
      { id: 5, name: '葡萄园全景-藤架区', group: '葡萄园', image: 'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=400&h=300&fit=crop' },
      { id: 6, name: '樱桃园全景-入口', group: '樱桃园', image: 'https://images.unsplash.com/photo-1528821128474-27f963b062bf?w=400&h=300&fit=crop' },
      { id: 7, name: '樱桃园全景-采摘区', group: '樱桃园', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop' },
      { id: 8, name: '樱桃园全景-观景台', group: '樱桃园', image: 'https://images.unsplash.com/photo-1515907007725-a1e3d70c6e73?w=400&h=300&fit=crop' }
    ],
    // 基地状态 4 态：planning 筹建中 / built 已建成 / active 运营中 / disabled 已停用
    enterprises: [],
    plots: [],
    // 证书数据已迁移至共享数据层 CertStore（js/shared/cert-store.js），此处不再保留副本
    certRecords: []
  };

  // 当前页码和每页条数
  let currentPage = 1;
  let pageSize = 10;
  let totalPages = 1;
  // 最近一次 renderPagination 的上下文，供 changePage 重绘复用
  let paginationContext = null;

  // 获取状态文本
  function getStatusText(status, type = 'default') {
    const statusMap = {
      default: {
        active: '正常运营',
        inactive: '已停用',
        maintain: '维护中',
        normal: '正常',
        warning: '待处理',
        danger: '需关注',
        enabled: '有效',
        disabled: '已撤销',
        error: '已过期',
        success: '验证通过'
      },
      enterprise: {
        planning: '筹建中',
        built: '已建成',
        active: '运营中',
        disabled: '已停用'
      },
      plot: {
        normal: '正常',
        warning: '待处理',
        danger: '需关注'
      },
      cert: {
        enabled: '有效',
        disabled: '已撤销',
        error: '已过期'
      },
      // 证书管理页状态由 CertStore 派生（草稿 / 待审核 / 已生效 / 已撤销 / 即将到期 / 已过期）
      certStore: {
        draft: '草稿',
        pending: '待审核',
        active: '已生效',
        revoked: '已撤销'
      }
    };
    return statusMap[type]?.[status] || statusMap.default[status] || status;
  }

  // 渲染图片集（基地图片）
  function renderImageGallery(images) {
    if (!images || !images.length) {
      return '<span style="color:var(--text-tertiary);font-size:13px;">暂无图片</span>';
    }
    return `
      <div class="ent-gallery">
        ${images.map(url => `
          <a href="${url}" target="_blank" rel="noopener" class="ent-gallery-item" title="点击查看大图">
            <img src="${url}" alt="基地图片" loading="lazy" />
          </a>
        `).join('')}
      </div>
      <div class="ent-gallery-meta">共 ${images.length} 张图片</div>
    `;
  }



  // ========== 新建/编辑表单中：图片多图上传 custom 字段 ==========
  // options: { max 上限张数（默认 9）, label 字段名, hint 辅助说明 }
  function buildBaseImagesUploader(images, options) {
    const opt = options || {};
    const max = opt.max || 9;
    const label = opt.label || '基地图片';
    const list = (Array.isArray(images) ? images : []).slice(0, max);
    const previews = list.map((url) => `
      <div class="ent-upload-item" data-url="${url.replace(/"/g, '&quot;')}" data-source="preset">
        <img src="${url}" alt="${label}" />
        <button type="button" class="ent-upload-remove" title="移除" aria-label="移除">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 3l6 6M9 3l-6 6"/></svg>
        </button>
      </div>
    `).join('');

    return `
      <div class="ent-upload" data-field="baseImages" data-max="${max}">
        <div class="ent-upload-toolbar">
          <label class="ent-upload-btn">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3v10M3 8h10"/>
            </svg>
            添加图片
            <input type="file" accept="image/*" multiple class="ent-upload-input" />
          </label>
          <span class="ent-upload-count">已上传 <b class="ent-upload-num">${list.length}</b> / ${max} 张</span>
          <span class="ent-upload-hint">${opt.hint || '支持 JPG / PNG，单张不超过 5MB'}</span>
        </div>
        <div class="ent-upload-list">${previews}</div>
      </div>
    `;
  }

  function collectBaseImages(modal) {
    const wrap = modal.querySelector('.ent-upload[data-field="baseImages"]');
    if (!wrap) return [];
    const urls = [];
    wrap.querySelectorAll('.ent-upload-item').forEach(item => {
      const url = item.dataset.url;
      if (url && urls.indexOf(url) === -1) urls.push(url);
    });
    return urls;
  }

  // 弹窗打开后为表单中的图片上传 custom 字段绑定交互事件
  // 获取状态样式类
  function getStatusClass(status) {
    const classMap = {
      planning: 'status-tag base-planning',
      built: 'status-tag base-built',
      active: 'status-tag base-active',
      normal: 'status-tag enabled',
      enabled: 'status-tag enabled',
      success: 'status-tag enabled',
      maintain: 'status-tag warning',
      warning: 'status-tag warning',
      inactive: 'status-tag disabled',
      disabled: 'status-tag disabled',
      danger: 'status-tag error',
      error: 'status-tag error'
    };
    return classMap[status] || 'status-tag disabled';
  }

  // 渲染表格数据
  function renderTable(data, columns, containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    currentColumns = columns || [];

    let html = '<thead><tr>';
    html += '<th style="width:60px;">序号</th>';
    columns.forEach(col => {
      html += `<th>${col.label}</th>`;
    });
    html += '<th>操作</th></tr></thead><tbody>';

    html += data.map((row, index) => renderRowHtml(row, index, currentColumns)).join('');

    html += '</tbody>';
    container.innerHTML = html;
  }

  // 渲染分页
  function renderPagination(total, current, containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    totalPages = Math.ceil(total / pageSize);
    paginationContext = { total, containerSelector };

    let html = '<div class="pagination">';
    html += `<button class="page-btn ${current === 1 ? 'disabled' : ''}" onclick="PageActions.changePage(${current - 1})">‹</button>`;
    
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="page-btn ${current === i ? 'active' : ''}" onclick="PageActions.changePage(${i})">${i}</button>`;
    }
    
    html += `<button class="page-btn ${current === totalPages ? 'disabled' : ''}" onclick="PageActions.changePage(${current + 1})">›</button>`;
    html += '</div>';

    container.innerHTML = html;
  }

  // 切换全选
  function toggleSelectAll(checkbox) {
    const checkboxes = document.querySelectorAll('input[name="rowItem"]');
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
  }

  // 获取选中的项
  function getSelectedItems() {
    const checkboxes = document.querySelectorAll('input[name="rowItem"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
  }

  // 搜索功能
  function search(keyword) {
    const currentPage = document.body.dataset.activePage;
    let data = [];
    
    switch(currentPage) {
      case 'enterprise':
        data = baseLedgerList().filter(e => 
          (e.name || '').includes(keyword) || (e.id || '').includes(keyword) || (e.code || '').includes(keyword) || (e.manager || '').includes(keyword)
        );
        break;
      case 'plot':
        data = plotList().filter(p => 
          p.name.includes(keyword) || p.id.includes(keyword) || p.enterprise.includes(keyword)
        );
        break;
      case 'cert-manage': {
        const S = certStore();
        data = S ? S.filter({ keyword: keyword }) : [];
        break;
      }
    }

    return data;
  }

  // 显示详情
  function showDetail(id) {
    const currentPage = document.body.dataset.activePage;
    let data = null;
    let fields = [];

    switch(currentPage) {
      case 'enterprise':
        data = baseLedgerList().find(e => e.id === id || e.code === id);
        fields = [
          { label: '基地编号', name: 'code' },
          { label: '基地名称', name: 'name' },
          { label: '地址', name: 'address' },
          { label: '面积（亩）', name: 'area', render: v => v + ' 亩' },
          { label: '负责人', name: 'manager' },
          { label: '联系电话', name: 'phone' },
          { label: '状态', name: 'status', render: v => `<span class="${getStatusClass(v)}">${getStatusText(v, 'enterprise')}</span>` },
          { label: '基地图片', name: 'baseImages', render: v => renderImageGallery(v) },
        ];
        break;
      case 'plot':
        data = plotList().find(p => p.id === id);
        fields = [
          { label: '地块编号', name: 'code' },
          { label: '地块名称', name: 'name' },
          { label: '所属基地', name: 'enterprise' },
          { label: '品种', name: 'variety' },
          { label: '面积', name: 'area', render: v => v + ' 亩' },
          { label: '种植年份', name: 'year' },
          { label: '负责人', name: 'manager' },
          { label: '状态', name: 'status', render: v => `<span class="${getStatusClass(v)}">${getStatusText(v, 'plot')}</span>` },
          { label: '地块图片', name: 'baseImages', render: v => renderImageGallery(v) },
        ];
        break;
      case 'cert-manage':
        data = getCert(id);
        fields = certDetailFields(data);
        break;
    }

    if (data) {
      Modal.detail('详情', data, { fields, width: currentPage === 'plot' ? '580px' : '620px' });
    }
  }

  // 显示编辑表单
  function showEdit(id) {
    const currentPage = document.body.dataset.activePage;
    let data = null;
    let fields = [];

    switch(currentPage) {
      case 'enterprise':
        data = baseLedgerList().find(e => e.id === id || e.code === id);
        fields = [
          { name: 'code', label: '基地编号', type: 'text', required: true },
          { name: 'name', label: '基地名称', type: 'text', required: true },
          { name: 'address', label: '地址', type: 'text' },
          { name: 'area', label: '面积（亩）', type: 'number' },
          { name: 'manager', label: '负责人', type: 'select', options: buildUserOptions(data && data.manager) },
          { name: 'phone', label: '联系电话', type: 'tel' },
          { name: 'status', label: '状态', type: 'select', options: BASE_STATUS_OPTIONS },
          { name: 'baseImages', label: '基地图片', type: 'custom',
            html: buildBaseImagesUploader(data && data.baseImages, { max: BASE_IMAGE_MAX, label: '基地图片' }),
            collect: collectBaseImages },
        ];
        break;
      case 'plot':
        data = plotList().find(p => p.id === id);
        fields = [
          { name: 'name', label: '地块名称', type: 'text', required: true },
          { name: 'enterprise', label: '所属基地', type: 'select', options: baseLedgerList().map(e => ({ value: e.name, label: e.name })) },
          { name: 'variety', label: '品种', type: 'select', required: true, options: [
            { value: '花牛苹果', label: '花牛苹果' },
            { value: '红富士', label: '红富士' },
            { value: '金帅', label: '金帅' },
            { value: '秦冠', label: '秦冠' },
            { value: '嘎啦', label: '嘎啦' },
            { value: '红星', label: '红星' },
            { value: '国光', label: '国光' }
          ]},
          { name: 'area', label: '面积(亩)', type: 'number', required: true },
          { name: 'year', label: '种植年份', type: 'number', required: true },
          { name: 'manager', label: '负责人', type: 'select', required: true, options: buildUserOptions(data && data.manager) },
          { name: 'baseImages', label: '地块图片', type: 'custom',
            html: buildBaseImagesUploader(data && data.baseImages),
            collect: collectBaseImages },
        ];
        break;
      case 'cert-manage':
        data = getCert(id);
        fields = certEditFields(data);
        break;
    }

    if (data && fields.length > 0) {
      Modal.form({
        title: '编辑',
        fields: fields,
        values: data,
        submitText: '保存',
        width: currentPage === 'plot' ? '580px' : '640px',
        onRender: bindEnterpriseFormInteractions,
        onSubmit: (formData) => {
          if (currentPage === 'cert-manage') {
            const res = CertStore.saveCert(Object.assign({}, data, formData));
            if (!res.ok) {
              Toast.show(res.message || '保存失败', 'error');
              return false;
            }
            Toast.show('修改成功', 'success');
            return true;
          }
          Toast.show('修改成功', 'success');
          return true;
        }
      });
    }
  }

  // 删除项
  function deleteItem(id) {
    if (document.body.dataset.activePage === 'cert-manage') {
      const cert = getCert(id);
      if (!cert) { Toast.show('证书不存在或已被删除', 'error'); return; }
      if (cert.status !== 'draft') {
        Toast.show('仅草稿状态证书可删除，已生效证书请使用「作废」', 'error');
        return;
      }
      Confirm.delete('确定要删除该草稿证书吗？此操作不可撤销。').then((confirmed) => {
        if (!confirmed) return;
        const res = CertStore.remove(id);
        if (!res.ok) { Toast.show(res.message || '删除失败', 'error'); return; }
        Toast.show('删除成功', 'success');
      });
      return;
    }
    Confirm.delete().then((confirmed) => {
      if (confirmed) {
        const currentPage = document.body.dataset.activePage;
        if (currentPage === 'enterprise') {
          const S = enterpriseStore();
          if (S && typeof S.removeBase === 'function') {
            const res = S.removeBase(id);
            if (!res.ok) { Toast.show(res.message || '删除失败', 'error'); return; }
          }
        }
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) {
          row.remove();
          Toast.show('删除成功', 'success');
        }
      }
    });
  }

  // 批量删除
  function batchDelete() {
    const selected = getSelectedItems();
    if (selected.length === 0) {
      Toast.show('请选择要删除的项', 'warning');
      return;
    }

    Confirm.batch('确定要删除选中的项吗？此操作不可撤销。', {
      count: selected.length,
      itemName: '项'
    }).then((confirmed) => {
      if (confirmed) {
        selected.forEach(id => {
          const row = document.querySelector(`tr[data-id="${id}"]`);
          if (row) row.remove();
        });
        document.getElementById('checkAll').checked = false;
        Toast.show(`成功删除 ${selected.length} 项`, 'success');
      }
    });
  }

  // 新建
  function showCreate() {
    const currentPage = document.body.dataset.activePage;
    let fields = [];
    let title = '新建';

    switch(currentPage) {
      case 'enterprise':
        title = '新建基地';
        fields = [
          { name: 'code', label: '基地编号', type: 'text', required: true },
          { name: 'name', label: '基地名称', type: 'text', required: true },
          { name: 'address', label: '地址', type: 'text' },
          { name: 'area', label: '面积（亩）', type: 'number' },
          { name: 'manager', label: '负责人', type: 'select', options: buildUserOptions() },
          { name: 'phone', label: '联系电话', type: 'tel' },
          { name: 'status', label: '状态', type: 'select', options: BASE_STATUS_OPTIONS },
          { name: 'baseImages', label: '基地图片', type: 'custom',
            html: buildBaseImagesUploader([], { max: BASE_IMAGE_MAX, label: '基地图片' }),
            collect: collectBaseImages },
        ];
        break;
      case 'plot':
        title = '新建地块';
        fields = [
          { name: 'name', label: '地块名称', type: 'text', required: true },
          { name: 'enterprise', label: '所属基地', type: 'select', options: baseLedgerList().map(e => ({ value: e.name, label: e.name })) },
          { name: 'variety', label: '品种', type: 'select', required: true, options: [
            { value: '花牛苹果', label: '花牛苹果' },
            { value: '红富士', label: '红富士' },
            { value: '金帅', label: '金帅' },
            { value: '秦冠', label: '秦冠' },
            { value: '嘎啦', label: '嘎啦' },
            { value: '红星', label: '红星' },
            { value: '国光', label: '国光' }
          ]},
          { name: 'area', label: '面积(亩)', type: 'number', required: true },
          { name: 'year', label: '种植年份', type: 'number', required: true },
          { name: 'manager', label: '负责人', type: 'select', required: true, options: buildUserOptions() },
          { name: 'baseImages', label: '地块图片', type: 'custom',
            html: buildBaseImagesUploader([]),
            collect: collectBaseImages },
        ];
        break;
      case 'cert-manage':
        // 证书新建走独立弹窗（分类切换需重绘字段）
        openCertCreateForm();
        return;
      case 'cert-issue':
        title = '开具合格证';
        fields = [
          { name: 'template', label: '选择模板', type: 'select', options: [
            { value: '花牛苹果合格证', label: '花牛苹果合格证' },
            { value: '红富士苹果合格证', label: '红富士苹果合格证' },
            { value: '礼盒装合格证', label: '礼盒装合格证' },
            { value: '原产地证明合格证', label: '原产地证明合格证' }
          ]},
          { name: 'product', label: '产品名称', type: 'select', options: mockData.products.map(p => ({ value: p, label: p })) },
          { name: 'batch', label: '批次号', type: 'text', required: true },
          { name: 'produceDate', label: '生产日期', type: 'date', required: true },
          { name: 'netWeight', label: '净含量', type: 'text', required: true },
          { name: 'grade', label: '等级', type: 'select', options: [
            { value: '特级', label: '特级' },
            { value: '一级', label: '一级' },
            { value: '二级', label: '二级' }
          ]},
          { name: 'tester', label: '检测人', type: 'text', required: true },
        ];
        break;
    }

    Modal.form({
      title: title,
      fields: fields,
      submitText: '创建',
      width: currentPage === 'plot' ? '580px' : '640px',
      onRender: bindEnterpriseFormInteractions,
      onSubmit: (formData) => {
        if (currentPage === 'enterprise') {
          const S = enterpriseStore();
          if (!S || typeof S.saveBase !== 'function') {
            Toast.show('数据层未就绪，请刷新页面后重试', 'error');
            return false;
          }
          const res = S.saveBase(formData);
          if (!res.ok) { Toast.show(res.message || '创建失败', 'error'); return false; }
          Toast.show('基地已创建：' + formData.name, 'success');
          return true;
        }
        Toast.show('创建成功', 'success');
        return true;
      }
    });
  }

  // 导出
  function exportData() {
    const currentPage = document.body.dataset.activePage;
    // 证书管理页由页面自身的 printCertList() 按当前筛选结果导出（列更贴合证书业务）
    if (currentPage === 'cert-manage') {
      if (typeof window.printCertList === 'function') window.printCertList();
      return;
    }

    const headers = currentPage === 'enterprise' ? ['基地编号', '基地名称', '地址', '面积(亩)', '负责人', '联系电话', '状态'] :
                    ['地块编号', '地块名称', '所属基地', '品种', '面积(亩)', '种植年份', '负责人', '状态'];

    function doExport(data) {
      // 严格空库：无数据明确提示，不静默导出空表假装成功
      if (!Array.isArray(data) || data.length === 0) {
        Toast.show('暂无数据可导出', 'warning');
        return;
      }
      const rows = data.map(row => {
        if (currentPage === 'enterprise') {
          return [row.code, row.name, row.address, row.area, row.manager, row.phone, getStatusText(row.status, 'enterprise')];
        }
        return [row.id, row.name, row.enterprise, row.variety, row.area, row.year, row.manager, getStatusText(row.status, 'plot')];
      });

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${currentPage}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      Toast.show('导出成功', 'success');
    }

    if (currentPage === 'plot') {
      // 地块导出走真实接口（与 enterprise_plot 页面同源的 sf_plot 数据）
      const Api = (typeof window !== 'undefined') ? window.Api : null;
      if (!Api || typeof Api.get !== 'function') {
        Toast.show('数据接口未就绪，暂无数据可导出', 'error');
        return;
      }
      Api.get('plot', { page: 1, size: 500, sort: 'id', order: 'asc' }).then(function (res) {
        if (!res || !res.ok) {
          Toast.show((res && res.message) || '地块数据加载失败，暂无数据可导出', 'error');
          return;
        }
        const list = (res.data && Array.isArray(res.data.list)) ? res.data.list : [];
        // 数据库行 -> CSV 列字段（扩展字段在 remark JSON 中，与页面 mapPlot 口径一致）
        doExport(list.map(function (r) {
          let ext = {};
          try { ext = JSON.parse(r.remark || '{}') || {}; } catch (e) { ext = {}; }
          if (typeof ext !== 'object' || ext === null) ext = {};
          return {
            id: r.id,
            name: r.name || '',
            enterprise: ext.enterprise || '',
            variety: r.variety_code || ext.variety || '',
            area: r.area == null ? '' : r.area,
            year: r.plant_year || '',
            manager: ext.manager || '',
            status: r.plot_status || 'normal'
          };
        }));
      }).catch(function (err) {
        Toast.show('地块数据加载失败：' + ((err && err.message) || '未知错误'), 'error');
      });
      return;
    }

    doExport(baseLedgerList());
  }

  // 批量导入
  function importData() {
    Modal.open({
      title: '批量导入',
      content: `
        <div style="padding: 20px;">
          <p style="margin-bottom: 16px; color: var(--text-secondary);">请选择要导入的CSV文件</p>
          <div class="upload-area" style="border: 2px dashed var(--border-default); border-radius: var(--radius-lg); padding: 32px; text-align: center; cursor: pointer;">
            <input type="file" id="importFile" accept=".csv" style="display: none;">
            <div style="font-size: 32px; margin-bottom: 8px;">📁</div>
            <div style="color: var(--text-primary); font-weight: medium;">点击选择文件</div>
            <div style="font-size: var(--font-size-sm); color: var(--text-tertiary); margin-top: 4px;">支持 CSV 格式</div>
          </div>
          <p style="margin-top: 16px; font-size: var(--font-size-xs); color: var(--text-tertiary);">
            下载模板：<a href="#" style="color: var(--primary-500);">点击下载</a>
          </p>
        </div>
      `,
      footer: '<button class="jg-btn jg-btn-secondary" data-action="cancel">取消</button><button class="jg-btn jg-btn-primary" data-action="confirm">开始导入</button>',
      width: '500px'
    });

    const modal = document.querySelector('.modal-overlay.show');
    if (modal) {
      const uploadArea = modal.querySelector('.upload-area');
      const importFile = modal.querySelector('#importFile');
      
      uploadArea.addEventListener('click', () => importFile.click());
      
      importFile.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          Toast.show(`已选择文件: ${e.target.files[0].name}`, 'info');
        }
      });

      modal.querySelector('[data-action="confirm"]').addEventListener('click', () => {
        Modal.close();
        Toast.show('导入成功', 'success');
      });

      modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        Modal.close();
      });
    }
  }

  // 扫码功能
  function scanQR() {
    Modal.open({
      title: '扫码查询',
      content: `
        <div style="padding: 20px; text-align: center;">
          <div style="width: 200px; height: 200px; margin: 0 auto 20px; background: #fff; border: 2px dashed var(--border-default); border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center;">
            <div style="font-size: 48px;">📷</div>
          </div>
          <p style="color: var(--text-secondary); margin-bottom: 16px;">将二维码对准扫描框</p>
          <button class="jg-btn" style="width: 100%; margin-bottom: 8px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:16px;height:16px;margin-right:8px;">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7z"/>
            </svg>
            打开摄像头
          </button>
          <button class="jg-btn jg-btn-secondary" style="width: 100%;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:16px;height:16px;margin-right:8px;">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" x2="12" y1="15" y2="3"/>
            </svg>
            从相册选择
          </button>
        </div>
      `,
      footer: '',
      width: '360px',
      closeOnOverlay: true
    });
  }

  // 下载证书：生成可打印的证书凭证（CSV 明细 + 打印视图），不再是假 Toast
  function downloadCert(id) {
    const cert = getCert(id);
    if (!cert) { Toast.show('证书不存在或已被删除', 'error'); return; }
    const S = certStore();
    const sv = S ? S.computeStatus(cert) : { text: '' };
    const isQual = S ? S.categoryOf(cert) === 'qualification' : false;
    const rows = [
      ['证书编号', cert.certNo],
      ['证书类型', cert.type],
      ['分类', isQual ? '企业资质' : '批次凭证'],
      ['发证机构', cert.issueOrg || ''],
      ['发证日期', cert.issueDate || ''],
      ['关联批次', cert.batchNo || ''],
      ['客户名称', cert.customer || ''],
      ['产品名称', cert.product || ''],
      ['检测结论', cert.conclusion || ''],
      ['检测人', cert.tester || ''],
      ['有效期开始', cert.validStart],
      ['有效期截止', cert.validEnd],
      ['当前状态', sv.text || ''],
      ['责任部门', cert.owner || ''],
      ['经办人', cert.operator || ''],
      ['二维码链接', cert.qrUrl || '']
    ];
    const csv = ['字段,值']
      .concat(rows.map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')))
      .join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${cert.certNo}_${cert.type}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    Toast.show('证书凭证已下载：' + cert.certNo, 'success');
  }

  // 作废证书：必须填原因并记录操作人（需求：撤销证书须填原因）
  function revokeCert(id) {
    const cert = getCert(id);
    if (!cert) { Toast.show('证书不存在或已被删除', 'error'); return; }

    Modal.form({
      title: '证书作废',
      fields: [
        { name: 'reason', label: '作废原因', type: 'textarea', required: true, placeholder: '请填写作废原因（必填）' },
        { name: 'operator', label: '作废人', type: 'select', required: true, options: buildUserOptions(cert.operator) }
      ],
      values: { operator: cert.operator || '' },
      submitText: '确认作废',
      width: '520px',
      onSubmit: (formData) => {
        const res = CertStore.revoke(id, formData.reason, formData.operator);
        if (!res.ok) {
          Toast.show(res.message || '作废失败', 'error');
          return false;
        }
        if (CertStore.syncCertAlerts) CertStore.syncCertAlerts();
        Toast.show('证书已作废', 'success');
        return true;
      }
    });
  }

  // 续期证书
  function renewCert(id) {
    const cert = getCert(id);
    if (!cert) { Toast.show('证书不存在或已被删除', 'error'); return; }
    const S = certStore();
    const defaultEnd = S ? S.shiftDate(S.today(), 365) : '';

    Modal.form({
      title: '证书续期',
      fields: [
        { name: 'validEnd', label: '新有效期截止日期', type: 'date', required: true },
        { name: 'note', label: '续期说明', type: 'text', placeholder: '如：已换发新证，原证到期作废' },
        { name: 'operator', label: '经办人', type: 'select', required: true, options: buildUserOptions(cert.operator) }
      ],
      values: { validEnd: defaultEnd, operator: cert.operator || '' },
      submitText: '确认续期',
      width: '520px',
      onSubmit: (formData) => {
        const res = CertStore.renew(id, formData.validEnd, formData.operator, formData.note);
        if (!res.ok) {
          Toast.show(res.message || '续期失败', 'error');
          return false;
        }
        if (CertStore.syncCertAlerts) CertStore.syncCertAlerts();
        Toast.show('续期成功，有效期至 ' + res.item.validEnd, 'success');
        return true;
      }
    });
  }

  // 提交审核：草稿 → 待审核
  function submitCert(id) {
    const cert = getCert(id);
    if (!cert) { Toast.show('证书不存在或已被删除', 'error'); return; }
    const res = CertStore.submit(id, cert.operator || '');
    if (!res.ok) { Toast.show(res.message || '提交失败', 'error'); return; }
    Toast.show('已提交审核', 'success');
  }

  // 审核通过：待审核 → 已生效
  function approveCert(id) {
    const cert = getCert(id);
    if (!cert) { Toast.show('证书不存在或已被删除', 'error'); return; }
    const res = CertStore.approve(id, cert.operator || '');
    if (!res.ok) { Toast.show(res.message || '审核失败', 'error'); return; }
    Toast.show('证书已生效', 'success');
  }

  // 驳回：待审核 → 草稿，必须填原因
  function rejectCert(id) {
    const cert = getCert(id);
    if (!cert) { Toast.show('证书不存在或已被删除', 'error'); return; }
    Modal.form({
      title: '证书驳回',
      fields: [
        { name: 'reason', label: '驳回原因', type: 'textarea', required: true, placeholder: '请填写驳回原因（必填）' },
        { name: 'operator', label: '审核人', type: 'select', required: true, options: buildUserOptions(cert.operator) }
      ],
      values: { operator: cert.operator || '' },
      submitText: '确认驳回',
      width: '520px',
      onSubmit: (formData) => {
        const res = CertStore.reject(id, formData.reason, formData.operator);
        if (!res.ok) {
          Toast.show(res.message || '驳回失败', 'error');
          return false;
        }
        Toast.show('已驳回，证书回到草稿状态', 'success');
        return true;
      }
    });
  }

  // 查询证书：按证书编号在共享数据层中真实查询
  function queryCert(code) {
    const no = String(code || '').trim();
    if (!no) {
      Toast.show('请输入证书编号', 'warning');
      return;
    }
    const S = certStore();
    if (!S) { Toast.show('证书数据层未加载', 'error'); return; }
    const cert = S.getByNo(no);
    if (!cert) {
      Modal.open({
        title: '查询结果',
        content: `<div style="padding:24px;text-align:center;">
          <div style="font-size:40px;margin-bottom:12px;">❌</div>
          <p style="font-size:15px;color:var(--text-primary);margin-bottom:6px;">未查询到该证书</p>
          <p style="font-size:13px;color:var(--text-tertiary);">证书编号：${S.esc(no)}</p>
        </div>`,
        footer: '<button class="jg-btn jg-btn-primary" data-action="close">知道了</button>',
        width: '420px'
      });
      const btn = document.querySelector('.modal-overlay.show [data-action="close"]');
      if (btn) btn.addEventListener('click', () => Modal.close());
      return;
    }
    const fields = certDetailFields(cert);
    const sv = S.computeStatus(cert);
    Modal.detail('证书查询结果', cert, { fields, width: '620px' });
    const header = document.querySelector('.modal-header');
    if (header) {
      const ok = sv.cls === 'enabled';
      header.insertAdjacentHTML('beforeend',
        `<span style="margin-left:auto;display:flex;align-items:center;gap:8px;padding:6px 14px;border-radius:var(--radius-full);font-size:var(--font-size-sm);font-weight:medium;background:${ok ? 'var(--success-bg)' : 'var(--warning-bg)'};color:${ok ? 'var(--success)' : '#ad8b00'};">${ok ? '证书有效' : '证书' + sv.text}</span>`);
    }
  }

  // 分页切换：真实生效——更新当前页并重绘分页条与数据表格
  function changePage(page) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    if (!paginationContext) {
      Toast.show('分页由列表组件统一接管，本页未启用通用分页', 'info');
      return;
    }
    // 列表数据源按当前页切片后重绘 tbody
    const rows = sliceByPage(mockData[document.body.dataset.activePage] || []);
    const tbody = document.querySelector('.data-table tbody');
    if (tbody && rows.length) {
      const columns = currentColumns || [];
      if (columns.length) {
        tbody.innerHTML = rows.map((row, i) => renderRowHtml(row, i + (currentPage - 1) * pageSize, columns)).join('');
      }
    }
    renderPagination(paginationContext.total, currentPage, paginationContext.containerSelector);
  }

  // 通用分页所用的列定义与行模板（由 renderTable 记录，供 changePage 复用）
  let currentColumns = [];
  function renderRowHtml(row, index, columns) {
    let html = `<tr data-id="${row.id}" data-index="${index}">`;
    html += `<td>${index + 1}</td>`;
    columns.forEach(col => {
      let value = row[col.field];
      if (col.type === 'status') {
        value = `<span class="${getStatusClass(value)}">${getStatusText(value, col.statusType)}</span>`;
      } else if (col.type === 'action') {
        value = col.render(row);
      } else if (col.render) {
        value = col.render(value, row);
      }
      html += `<td>${value}</td>`;
    });
    html += `<td><div class="action-btns">
      <button class="action-btn" onclick="PageActions.showDetail('${row.id}')">查看</button>
      <button class="action-btn" onclick="PageActions.showEdit('${row.id}')">编辑</button>
      <button class="action-btn delete" onclick="PageActions.deleteItem('${row.id}')">删除</button>
    </div></td></tr>`;
    return html;
  }

  function sliceByPage(list) {
    const arr = Array.isArray(list) ? list : [];
    const start = (currentPage - 1) * pageSize;
    return arr.slice(start, start + pageSize);
  }

  // 合格证开具已迁移到 cert_issue.html 页面自有实现（校验 / 真实二维码 / 完整落库），
  // 此处保留空实现以兼容旧调用入口，实际逻辑由页面级 certIssueSubmit() 承担。
  function issueCert() {
    if (typeof window.certIssueSubmit === 'function') {
      window.certIssueSubmit();
      return;
    }
    Toast.show('请在「农产品合格证」页面开具合格证', 'info');
  }

  // 初始化页面交互
  function init(pageType) {
    document.body.dataset.activePage = pageType;
    
    // 绑定新建按钮
    const createBtn = document.querySelector('.btn-create');
    if (createBtn) {
      createBtn.addEventListener('click', showCreate);
    }

    // 绑定搜索按钮
    const searchBtn = document.querySelector('.btn-search');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
          const results = search(searchInput.value);
          Toast.show(`找到 ${results.length} 条结果`, 'info');
        }
      });
    }

    // 绑定导出按钮
    const exportBtn = document.querySelector('.btn-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportData);
    }

    // 绑定导入按钮
    const importBtn = document.querySelector('.btn-import');
    if (importBtn) {
      importBtn.addEventListener('click', importData);
    }

    // 绑定批量删除按钮
    const batchDeleteBtn = document.querySelector('.btn-batch-delete');
    if (batchDeleteBtn) {
      batchDeleteBtn.addEventListener('click', batchDelete);
    }

    // 绑定扫码按钮
    const scanBtn = document.querySelector('.btn-scan');
    if (scanBtn) {
      scanBtn.addEventListener('click', scanQR);
    }

    // 绑定查询按钮
    const queryBtn = document.querySelector('.btn-query');
    if (queryBtn) {
      queryBtn.addEventListener('click', () => {
        const codeInput = document.querySelector('.cert-code-input');
        if (codeInput) {
          queryCert(codeInput.value);
        }
      });
    }

    // 绑定开具证书按钮
    const issueBtn = document.querySelector('.btn-issue');
    if (issueBtn) {
      issueBtn.addEventListener('click', () => {
        if (typeof window.certIssueSubmit === 'function') window.certIssueSubmit();
        else issueCert();
      });
    }

    // 绑定下载按钮
    document.querySelectorAll('.btn-download').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id || 'cert';
        downloadCert(id);
      });
    });

    // 绑定查询回车事件
    const codeInput = document.querySelector('.cert-code-input');
    if (codeInput) {
      codeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          queryCert(codeInput.value);
        }
      });
    }
  }

  return {
    init,
    toggleSelectAll,
    getSelectedItems,
    search,
    showDetail,
    showEdit,
    deleteItem,
    batchDelete,
    showCreate,
    exportData,
    importData,
    scanQR,
    downloadCert,
    revokeCert,
    renewCert,
    submitCert,
    approveCert,
    rejectCert,
    queryCert,
    changePage,
    issueCert,
    mockData
  };
})();

window.PageActions = PageActions;