/**
 * 页面交互功能模块
 * 包含：数据模拟、表单操作、列表操作、分页、导入导出、扫码等功能
 */

const PageActions = (function() {
  // 模拟数据
  const mockData = {
    enterprises: [
      { id: 'ENT001', name: '烟台栖霞苹果基地', type: '种植基地', area: 1200, status: 'active', contact: '王经理', phone: '13800138001', address: '山东省烟台市栖霞市', createTime: '2026-01-15' },
      { id: 'ENT002', name: '陕西洛川苹果园', type: '种植基地', area: 850, status: 'active', contact: '李主任', phone: '13800138002', address: '陕西省延安市洛川县', createTime: '2026-02-20' },
      { id: 'ENT003', name: '甘肃静宁苹果基地', type: '种植基地', area: 2000, status: 'maintain', contact: '张厂长', phone: '13800138003', address: '甘肃省平凉市静宁县', createTime: '2025-11-10' },
      { id: 'ENT004', name: '山西吉县苹果园', type: '种植基地', area: 680, status: 'active', contact: '赵总', phone: '13800138004', address: '山西省临汾市吉县', createTime: '2026-03-05' },
      { id: 'ENT005', name: '河南灵宝苹果基地', type: '种植基地', area: 1500, status: 'inactive', contact: '孙经理', phone: '13800138005', address: '河南省三门峡市灵宝市', createTime: '2025-08-18' },
      { id: 'ENT006', name: '新疆阿克苏苹果园', type: '种植基地', area: 3000, status: 'active', contact: '周厂长', phone: '13800138006', address: '新疆阿克苏地区', createTime: '2026-04-22' },
    ],
    plots: [
      { id: 'PLOT001', name: '东区1号地', enterprise: '烟台栖霞苹果基地', variety: '红富士', area: 85, year: 2018, status: 'normal', manager: '刘师傅' },
      { id: 'PLOT002', name: '东区2号地', enterprise: '烟台栖霞苹果基地', variety: '红富士', area: 120, year: 2016, status: 'normal', manager: '陈师傅' },
      { id: 'PLOT003', name: '西区1号地', enterprise: '烟台栖霞苹果基地', variety: '金帅', area: 95, year: 2019, status: 'warning', manager: '赵师傅' },
      { id: 'PLOT004', name: '南区1号地', enterprise: '陕西洛川苹果园', variety: '红富士', area: 70, year: 2017, status: 'normal', manager: '马师傅' },
      { id: 'PLOT005', name: '北区1号地', enterprise: '甘肃静宁苹果基地', variety: '秦冠', area: 150, year: 2015, status: 'danger', manager: '王师傅' },
      { id: 'PLOT006', name: '中区1号地', enterprise: '山西吉县苹果园', variety: '红富士', area: 65, year: 2020, status: 'normal', manager: '张师傅' },
      { id: 'PLOT007', name: '南区2号地', enterprise: '陕西洛川苹果园', variety: '嘎啦', area: 88, year: 2018, status: 'normal', manager: '李师傅' },
      { id: 'PLOT008', name: '西区2号地', enterprise: '烟台栖霞苹果基地', variety: '红富士', area: 110, year: 2017, status: 'warning', manager: '刘师傅' },
      { id: 'PLOT009', name: '北区2号地', enterprise: '甘肃静宁苹果基地', variety: '红富士', area: 92, year: 2016, status: 'normal', manager: '王师傅' },
      { id: 'PLOT010', name: '东区3号地', enterprise: '烟台栖霞苹果基地', variety: '金帅', area: 78, year: 2021, status: 'danger', manager: '陈师傅' },
      { id: 'PLOT011', name: '南区3号地', enterprise: '陕西洛川苹果园', variety: '红富士', area: 105, year: 2019, status: 'normal', manager: '马师傅' },
      { id: 'PLOT012', name: '西区3号地', enterprise: '烟台栖霞苹果基地', variety: '秦冠', area: 82, year: 2022, status: 'normal', manager: '赵师傅' },
      { id: 'PLOT013', name: '北区3号地', enterprise: '甘肃静宁苹果基地', variety: '嘎啦', area: 75, year: 2018, status: 'warning', manager: '王师傅' },
      { id: 'PLOT014', name: '中区2号地', enterprise: '山西吉县苹果园', variety: '红富士', area: 98, year: 2017, status: 'normal', manager: '张师傅' },
      { id: 'PLOT015', name: '东区4号地', enterprise: '烟台栖霞苹果基地', variety: '红富士', area: 68, year: 2020, status: 'normal', manager: '刘师傅' },
      { id: 'PLOT016', name: '南区4号地', enterprise: '陕西洛川苹果园', variety: '金帅', area: 115, year: 2015, status: 'danger', manager: '李师傅' },
      { id: 'PLOT017', name: '西区4号地', enterprise: '烟台栖霞苹果基地', variety: '红富士', area: 89, year: 2019, status: 'normal', manager: '赵师傅' },
      { id: 'PLOT018', name: '北区4号地', enterprise: '甘肃静宁苹果基地', variety: '红富士', area: 96, year: 2021, status: 'warning', manager: '王师傅' },
      { id: 'PLOT019', name: '中区3号地', enterprise: '山西吉县苹果园', variety: '嘎啦', area: 72, year: 2018, status: 'normal', manager: '张师傅' },
      { id: 'PLOT020', name: '东区5号地', enterprise: '烟台栖霞苹果基地', variety: '秦冠', area: 102, year: 2016, status: 'normal', manager: '陈师傅' },
      { id: 'PLOT021', name: '南区5号地', enterprise: '陕西洛川苹果园', variety: '红富士', area: 86, year: 2022, status: 'normal', manager: '马师傅' },
      { id: 'PLOT022', name: '西区5号地', enterprise: '烟台栖霞苹果基地', variety: '红富士', area: 93, year: 2017, status: 'danger', manager: '刘师傅' },
      { id: 'PLOT023', name: '北区5号地', enterprise: '甘肃静宁苹果基地', variety: '金帅', area: 81, year: 2020, status: 'normal', manager: '王师傅' },
    ],
    certificates: [
      { id: 'CERT001', type: '质量合格证', batch: 'PC-20260601-001', customer: '北京华联超市', validStart: '2026-06-01', validEnd: '2027-06-01', status: 'enabled', issueTime: '2026-06-01' },
      { id: 'CERT002', type: '检测报告', batch: 'PC-20260605-003', customer: '上海果蔬配送中心', validStart: '2026-05-15', validEnd: '2027-05-15', status: 'enabled', issueTime: '2026-05-15' },
      { id: 'CERT003', type: '原产地证明', batch: 'PC-20260520-012', customer: '广州江南市场', validStart: '2025-05-20', validEnd: '2026-05-20', status: 'error', issueTime: '2025-05-20' },
      { id: 'CERT004', type: '质量合格证', batch: 'PC-20260510-008', customer: '深圳沃尔玛超市', validStart: '2025-05-10', validEnd: '2026-05-10', status: 'disabled', issueTime: '2025-05-10' },
      { id: 'CERT005', type: '质量合格证', batch: 'PC-20260602-004', customer: '天津家乐福', validStart: '2026-06-02', validEnd: '2027-06-02', status: 'enabled', issueTime: '2026-06-02' },
      { id: 'CERT006', type: '检测报告', batch: 'PC-20260603-005', customer: '重庆永辉超市', validStart: '2026-06-03', validEnd: '2027-06-03', status: 'enabled', issueTime: '2026-06-03' },
      { id: 'CERT007', type: '原产地证明', batch: 'PC-20260604-006', customer: '成都伊藤洋华堂', validStart: '2026-06-04', validEnd: '2027-06-04', status: 'enabled', issueTime: '2026-06-04' },
      { id: 'CERT008', type: '质量合格证', batch: 'PC-20260501-001', customer: '武汉中百仓储', validStart: '2026-05-01', validEnd: '2027-05-01', status: 'enabled', issueTime: '2026-05-01' },
      { id: 'CERT009', type: '检测报告', batch: 'PC-20260502-002', customer: '杭州世纪联华', validStart: '2026-05-02', validEnd: '2027-05-02', status: 'enabled', issueTime: '2026-05-02' },
      { id: 'CERT010', type: '质量合格证', batch: 'PC-20250401-001', customer: '南京苏果超市', validStart: '2025-04-01', validEnd: '2026-04-01', status: 'error', issueTime: '2025-04-01' },
      { id: 'CERT011', type: '原产地证明', batch: 'PC-20260405-003', customer: '苏州大润发', validStart: '2026-04-05', validEnd: '2027-04-05', status: 'enabled', issueTime: '2026-04-05' },
      { id: 'CERT012', type: '质量合格证', batch: 'PC-20260410-006', customer: '无锡欧尚', validStart: '2026-04-10', validEnd: '2027-04-10', status: 'enabled', issueTime: '2026-04-10' },
      { id: 'CERT013', type: '检测报告', batch: 'PC-20260315-002', customer: '宁波三江购物', validStart: '2026-03-15', validEnd: '2027-03-15', status: 'enabled', issueTime: '2026-03-15' },
      { id: 'CERT014', type: '质量合格证', batch: 'PC-20260320-004', customer: '温州人本超市', validStart: '2026-03-20', validEnd: '2027-03-20', status: 'enabled', issueTime: '2026-03-20' },
      { id: 'CERT015', type: '原产地证明', batch: 'PC-20260225-001', customer: '青岛利群集团', validStart: '2026-02-25', validEnd: '2027-02-25', status: 'enabled', issueTime: '2026-02-25' },
      { id: 'CERT016', type: '质量合格证', batch: 'PC-20260228-003', customer: '济南银座商城', validStart: '2026-02-28', validEnd: '2027-02-28', status: 'enabled', issueTime: '2026-02-28' },
      { id: 'CERT017', type: '检测报告', batch: 'PC-20260110-002', customer: '大连大商集团', validStart: '2026-01-10', validEnd: '2027-01-10', status: 'enabled', issueTime: '2026-01-10' },
      { id: 'CERT018', type: '质量合格证', batch: 'PC-20251215-001', customer: '沈阳兴隆大家庭', validStart: '2025-12-15', validEnd: '2026-12-15', status: 'error', issueTime: '2025-12-15' },
      { id: 'CERT019', type: '原产地证明', batch: 'PC-20260120-004', customer: '哈尔滨中央红', validStart: '2026-01-20', validEnd: '2027-01-20', status: 'enabled', issueTime: '2026-01-20' },
      { id: 'CERT020', type: '质量合格证', batch: 'PC-20251101-001', customer: '长春欧亚集团', validStart: '2025-11-01', validEnd: '2026-11-01', status: 'disabled', issueTime: '2025-11-01' },
      { id: 'CERT021', type: '检测报告', batch: 'PC-20260515-007', customer: '合肥百大集团', validStart: '2026-05-15', validEnd: '2027-05-15', status: 'enabled', issueTime: '2026-05-15' },
      { id: 'CERT022', type: '质量合格证', batch: 'PC-20260525-010', customer: '福州永辉超市', validStart: '2026-05-25', validEnd: '2027-05-25', status: 'enabled', issueTime: '2026-05-25' },
      { id: 'CERT023', type: '原产地证明', batch: 'PC-20260610-015', customer: '厦门夏商集团', validStart: '2026-06-10', validEnd: '2027-06-10', status: 'enabled', issueTime: '2026-06-10' },
    ],
    certRecords: [
      { id: 1, certId: 'SN202606130001', product: '红富士苹果', queryTime: '2026-06-13 14:30:00', ip: '192.168.1.100', status: 'success' },
      { id: 2, certId: 'SN202606130001', product: '红富士苹果', queryTime: '2026-06-13 11:20:00', ip: '10.0.0.55', status: 'success' },
      { id: 3, certId: 'SN202606130001', product: '红富士苹果', queryTime: '2026-06-13 10:30:00', ip: '172.16.0.88', status: 'success' },
      { id: 4, certId: 'SN202606120002', product: '金帅苹果', queryTime: '2026-06-12 16:45:00', ip: '192.168.1.101', status: 'success' },
      { id: 5, certId: 'SN202606120003', product: '嘎啦苹果', queryTime: '2026-06-12 15:20:00', ip: '10.0.0.56', status: 'success' },
      { id: 6, certId: 'SN202606120004', product: '红富士苹果', queryTime: '2026-06-12 14:10:00', ip: '172.16.0.89', status: 'failed' },
      { id: 7, certId: 'SN202606110005', product: '秦冠苹果', queryTime: '2026-06-11 13:30:00', ip: '192.168.1.102', status: 'success' },
      { id: 8, certId: 'SN202606110006', product: '红富士苹果', queryTime: '2026-06-11 11:15:00', ip: '10.0.0.57', status: 'success' },
      { id: 9, certId: 'SN202606110007', product: '金帅苹果', queryTime: '2026-06-11 09:45:00', ip: '172.16.0.90', status: 'success' },
      { id: 10, certId: 'SN202606100008', product: '红富士苹果', queryTime: '2026-06-10 17:00:00', ip: '192.168.1.103', status: 'success' },
      { id: 11, certId: 'SN202606100009', product: '嘎啦苹果', queryTime: '2026-06-10 14:20:00', ip: '10.0.0.58', status: 'success' },
      { id: 12, certId: 'SN202606100010', product: '红富士苹果', queryTime: '2026-06-10 10:30:00', ip: '172.16.0.91', status: 'failed' },
      { id: 13, certId: 'SN202606090011', product: '秦冠苹果', queryTime: '2026-06-09 16:15:00', ip: '192.168.1.104', status: 'success' },
      { id: 14, certId: 'SN202606090012', product: '红富士苹果', queryTime: '2026-06-09 13:40:00', ip: '10.0.0.59', status: 'success' },
      { id: 15, certId: 'SN202606090013', product: '金帅苹果', queryTime: '2026-06-09 11:00:00', ip: '172.16.0.92', status: 'success' },
      { id: 16, certId: 'SN202606080014', product: '红富士苹果', queryTime: '2026-06-08 15:30:00', ip: '192.168.1.105', status: 'success' },
      { id: 17, certId: 'SN202606080015', product: '嘎啦苹果', queryTime: '2026-06-08 12:20:00', ip: '10.0.0.60', status: 'success' },
      { id: 18, certId: 'SN202606080016', product: '红富士苹果', queryTime: '2026-06-08 09:15:00', ip: '172.16.0.93', status: 'failed' },
      { id: 19, certId: 'SN202606070017', product: '秦冠苹果', queryTime: '2026-06-07 16:45:00', ip: '192.168.1.106', status: 'success' },
      { id: 20, certId: 'SN202606070018', product: '红富士苹果', queryTime: '2026-06-07 14:00:00', ip: '10.0.0.61', status: 'success' },
      { id: 21, certId: 'SN202606070019', product: '金帅苹果', queryTime: '2026-06-07 11:30:00', ip: '172.16.0.94', status: 'success' },
      { id: 22, certId: 'SN202606060020', product: '红富士苹果', queryTime: '2026-06-06 15:20:00', ip: '192.168.1.107', status: 'success' },
      { id: 23, certId: 'SN202606060021', product: '嘎啦苹果', queryTime: '2026-06-06 10:15:00', ip: '10.0.0.62', status: 'success' },
    ]
  };

  // 当前页码和每页条数
  let currentPage = 1;
  let pageSize = 10;
  let totalPages = 1;

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
        active: '正常运营',
        inactive: '已停用',
        maintain: '维护中'
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
      }
    };
    return statusMap[type]?.[status] || statusMap.default[status] || status;
  }

  // 获取状态样式类
  function getStatusClass(status) {
    const classMap = {
      active: 'status-tag enabled',
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

    let html = '<thead><tr>';
    html += '<th style="width:60px;">序号</th>';
    columns.forEach(col => {
      html += `<th>${col.label}</th>`;
    });
    html += '<th>操作</th></tr></thead><tbody>';

    data.forEach((row, index) => {
      html += `<tr data-id="${row.id}" data-index="${index}">`;
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
    });

    html += '</tbody>';
    container.innerHTML = html;
  }

  // 渲染分页
  function renderPagination(total, current, containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    totalPages = Math.ceil(total / pageSize);

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
        data = mockData.enterprises.filter(e => 
          e.name.includes(keyword) || e.id.includes(keyword) || e.contact.includes(keyword)
        );
        break;
      case 'plot':
        data = mockData.plots.filter(p => 
          p.name.includes(keyword) || p.id.includes(keyword) || p.enterprise.includes(keyword)
        );
        break;
      case 'cert-manage':
        data = mockData.certificates.filter(c => 
          c.id.includes(keyword) || c.customer.includes(keyword) || c.batch.includes(keyword)
        );
        break;
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
        data = mockData.enterprises.find(e => e.id === id);
        fields = [
          { label: '企业编号', name: 'id' },
          { label: '企业名称', name: 'name' },
          { label: '企业类型', name: 'type' },
          { label: '占地面积', name: 'area', render: v => v + ' 亩' },
          { label: '联系人', name: 'contact' },
          { label: '联系电话', name: 'phone' },
          { label: '地址', name: 'address' },
          { label: '状态', name: 'status', render: v => `<span class="${getStatusClass(v)}">${getStatusText(v, 'enterprise')}</span>` },
          { label: '创建时间', name: 'createTime' },
        ];
        break;
      case 'plot':
        data = mockData.plots.find(p => p.id === id);
        fields = [
          { label: '地块编号', name: 'id' },
          { label: '地块名称', name: 'name' },
          { label: '所属基地', name: 'enterprise' },
          { label: '品种', name: 'variety' },
          { label: '面积', name: 'area', render: v => v + ' 亩' },
          { label: '种植年份', name: 'year' },
          { label: '负责人', name: 'manager' },
          { label: '状态', name: 'status', render: v => `<span class="${getStatusClass(v)}">${getStatusText(v, 'plot')}</span>` },
        ];
        break;
      case 'cert-manage':
        data = mockData.certificates.find(c => c.id === id);
        fields = [
          { label: '证书编号', name: 'id' },
          { label: '证书类型', name: 'type' },
          { label: '关联批次', name: 'batch' },
          { label: '客户名称', name: 'customer' },
          { label: '有效期开始', name: 'validStart' },
          { label: '有效期结束', name: 'validEnd' },
          { label: '状态', name: 'status', render: v => `<span class="${getStatusClass(v)}">${getStatusText(v, 'cert')}</span>` },
          { label: '签发时间', name: 'issueTime' },
        ];
        break;
    }

    if (data) {
      Modal.detail('详情', data, { fields, width: '560px' });
    }
  }

  // 显示编辑表单
  function showEdit(id) {
    const currentPage = document.body.dataset.activePage;
    let data = null;
    let fields = [];

    switch(currentPage) {
      case 'enterprise':
        data = mockData.enterprises.find(e => e.id === id);
        fields = [
          { name: 'name', label: '企业名称', type: 'text', required: true },
          { name: 'type', label: '企业类型', type: 'select', options: [
            { value: '种植基地', label: '种植基地' },
            { value: '加工厂', label: '加工厂' },
            { value: '销售公司', label: '销售公司' }
          ]},
          { name: 'area', label: '占地面积(亩)', type: 'number', required: true },
          { name: 'contact', label: '联系人', type: 'text', required: true },
          { name: 'phone', label: '联系电话', type: 'tel', required: true },
          { name: 'address', label: '地址', type: 'text', required: true },
        ];
        break;
      case 'plot':
        data = mockData.plots.find(p => p.id === id);
        fields = [
          { name: 'name', label: '地块名称', type: 'text', required: true },
          { name: 'enterprise', label: '所属基地', type: 'select', options: mockData.enterprises.map(e => ({ value: e.name, label: e.name })) },
          { name: 'variety', label: '品种', type: 'text', required: true },
          { name: 'area', label: '面积(亩)', type: 'number', required: true },
          { name: 'year', label: '种植年份', type: 'number', required: true },
          { name: 'manager', label: '负责人', type: 'text', required: true },
        ];
        break;
      case 'cert-manage':
        data = mockData.certificates.find(c => c.id === id);
        fields = [
          { name: 'type', label: '证书类型', type: 'select', options: [
            { value: '质量合格证', label: '质量合格证' },
            { value: '检测报告', label: '检测报告' },
            { value: '原产地证明', label: '原产地证明' }
          ]},
          { name: 'batch', label: '关联批次', type: 'text', required: true },
          { name: 'customer', label: '客户名称', type: 'text', required: true },
          { name: 'validStart', label: '有效期开始', type: 'date', required: true },
          { name: 'validEnd', label: '有效期结束', type: 'date', required: true },
        ];
        break;
    }

    if (data && fields.length > 0) {
      Modal.form({
        title: '编辑',
        fields: fields,
        values: data,
        submitText: '保存',
        onSubmit: (formData) => {
          Toast.show('修改成功', 'success');
          return true;
        }
      });
    }
  }

  // 删除项
  function deleteItem(id) {
    Confirm.delete().then((confirmed) => {
      if (confirmed) {
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
        title = '新建企业';
        fields = [
          { name: 'name', label: '企业名称', type: 'text', required: true },
          { name: 'type', label: '企业类型', type: 'select', options: [
            { value: '种植基地', label: '种植基地' },
            { value: '加工厂', label: '加工厂' },
            { value: '销售公司', label: '销售公司' }
          ]},
          { name: 'area', label: '占地面积(亩)', type: 'number', required: true },
          { name: 'contact', label: '联系人', type: 'text', required: true },
          { name: 'phone', label: '联系电话', type: 'tel', required: true },
          { name: 'address', label: '地址', type: 'text', required: true },
        ];
        break;
      case 'plot':
        title = '新建地块';
        fields = [
          { name: 'name', label: '地块名称', type: 'text', required: true },
          { name: 'enterprise', label: '所属基地', type: 'select', options: mockData.enterprises.map(e => ({ value: e.name, label: e.name })) },
          { name: 'variety', label: '品种', type: 'text', required: true },
          { name: 'area', label: '面积(亩)', type: 'number', required: true },
          { name: 'year', label: '种植年份', type: 'number', required: true },
          { name: 'manager', label: '负责人', type: 'text', required: true },
        ];
        break;
      case 'cert-manage':
        title = '新建证书';
        fields = [
          { name: 'type', label: '证书类型', type: 'select', options: [
            { value: '质量合格证', label: '质量合格证' },
            { value: '检测报告', label: '检测报告' },
            { value: '原产地证明', label: '原产地证明' }
          ]},
          { name: 'batch', label: '关联批次', type: 'text', required: true },
          { name: 'customer', label: '客户名称', type: 'text', required: true },
          { name: 'validStart', label: '有效期开始', type: 'date', required: true },
          { name: 'validEnd', label: '有效期结束', type: 'date', required: true },
        ];
        break;
      case 'cert-issue':
        title = '开具合格证';
        fields = [
          { name: 'template', label: '选择模板', type: 'select', options: [
            { value: '红富士合格证', label: '红富士合格证' },
            { value: '嘎啦苹果合格证', label: '嘎啦苹果合格证' },
            { value: '礼盒装合格证', label: '礼盒装合格证' }
          ]},
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
      onSubmit: (formData) => {
        Toast.show('创建成功', 'success');
        return true;
      }
    });
  }

  // 导出
  function exportData() {
    const currentPage = document.body.dataset.activePage;
    const data = currentPage === 'enterprise' ? mockData.enterprises : 
                 currentPage === 'plot' ? mockData.plots :
                 mockData.certificates;

    const headers = currentPage === 'enterprise' ? ['企业编号', '企业名称', '类型', '面积(亩)', '联系人', '电话', '地址', '状态', '创建时间'] :
                    currentPage === 'plot' ? ['地块编号', '地块名称', '所属基地', '品种', '面积(亩)', '种植年份', '负责人', '状态'] :
                    ['证书编号', '类型', '批次', '客户', '有效期开始', '有效期结束', '状态', '签发时间'];

    const rows = data.map(row => {
      if (currentPage === 'enterprise') {
        return [row.id, row.name, row.type, row.area, row.contact, row.phone, row.address, getStatusText(row.status, 'enterprise'), row.createTime];
      } else if (currentPage === 'plot') {
        return [row.id, row.name, row.enterprise, row.variety, row.area, row.year, row.manager, getStatusText(row.status, 'plot')];
      } else {
        return [row.id, row.type, row.batch, row.customer, row.validStart, row.validEnd, getStatusText(row.status, 'cert'), row.issueTime];
      }
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

  // 下载证书
  function downloadCert(id) {
    Modal.loading('正在生成证书...');
    setTimeout(() => {
      Modal.hideLoading();
      Toast.show('证书已下载', 'success');
    }, 1500);
  }

  // 作废证书
  function revokeCert(id) {
    Confirm.warning('确定要作废此证书吗？作废后证书将失效，此操作不可撤销。').then((confirmed) => {
      if (confirmed) {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) {
          const statusCell = row.querySelector('.status-tag');
          if (statusCell) {
            statusCell.className = 'status-tag disabled';
            statusCell.textContent = '已撤销';
          }
          const actionBtns = row.querySelector('.action-btns');
          if (actionBtns) {
            actionBtns.innerHTML = `
              <button class="action-btn" onclick="PageActions.showDetail('${id}')">查看</button>
              <button class="action-btn delete" onclick="PageActions.deleteItem('${id}')">删除</button>
            `;
          }
          Toast.show('证书已作废', 'success');
        }
      }
    });
  }

  // 续期证书
  function renewCert(id) {
    const data = mockData.certificates.find(c => c.id === id);
    if (!data) return;

    Modal.form({
      title: '证书续期',
      fields: [
        { name: 'validEnd', label: '新有效期截止日期', type: 'date', required: true }
      ],
      values: { validEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      submitText: '确认续期',
      onSubmit: (formData) => {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) {
          const cells = row.querySelectorAll('td');
          if (cells[5]) {
            cells[5].textContent = `${data.validStart} 至 ${formData.validEnd}`;
          }
          const statusCell = row.querySelector('.status-tag');
          if (statusCell) {
            statusCell.className = 'status-tag enabled';
            statusCell.textContent = '有效';
          }
          const actionBtns = row.querySelector('.action-btns');
          if (actionBtns) {
            actionBtns.innerHTML = `
              <button class="action-btn" onclick="PageActions.showDetail('${id}')">查看</button>
              <button class="action-btn" onclick="PageActions.downloadCert('${id}')">下载</button>
              <button class="action-btn delete" onclick="PageActions.revokeCert('${id}')">作废</button>
            `;
          }
        }
        Toast.show('续期成功', 'success');
        return true;
      }
    });
  }

  // 查询证书
  function queryCert(code) {
    if (!code.trim()) {
      Toast.show('请输入证书编号', 'warning');
      return;
    }

    Modal.loading('查询中...');
    setTimeout(() => {
      Modal.hideLoading();
      
      const certData = {
        id: code,
        product: '红富士苹果',
        batch: '20260613001',
        produceDate: '2026-06-13',
        netWeight: '500g/袋',
        grade: '特级',
        result: '合格',
        tester: '张三',
        queryCount: '第3次查询',
        firstQuery: '2026-06-13 10:30:00'
      };

      const fields = [
        { label: '合格证编号', name: 'id' },
        { label: '产品名称', name: 'product' },
        { label: '批次号', name: 'batch' },
        { label: '生产日期', name: 'produceDate' },
        { label: '净含量', name: 'netWeight' },
        { label: '等级', name: 'grade' },
        { label: '检测结论', name: 'result', render: v => `<span style="color: var(--success); font-weight: bold;">${v}</span>` },
        { label: '检测人', name: 'tester' },
        { label: '查询次数', name: 'queryCount' },
        { label: '首次查询时间', name: 'firstQuery' },
      ];

      Modal.detail('查询结果', certData, { fields, width: '560px' });
      document.querySelector('.modal-header').insertAdjacentHTML('beforeend', 
        '<span style="margin-left: auto; display: flex; align-items: center; gap: 8px; padding: 6px 14px; background: var(--success-bg); color: var(--success); border-radius: var(--radius-full); font-size: var(--font-size-sm); font-weight: medium;">\n          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n            <path d="M5 12l5 5L20 7"/>\n          </svg>\n          验证通过\n        </span>'
      );
    }, 1000);
  }

  // 分页切换
  function changePage(page) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    Toast.show(`切换到第 ${page} 页`, 'info');
  }

  // 开具证书
  function issueCert() {
    Modal.loading('正在生成合格证...');
    setTimeout(() => {
      Modal.hideLoading();
      Confirm.success('合格证已生成！', {
        confirmText: '下载证书',
        icon: '✅'
      }).then(() => {
        downloadCert('new');
      });
    }, 2000);
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
      issueBtn.addEventListener('click', issueCert);
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
    queryCert,
    changePage,
    issueCert,
    mockData
  };
})();

window.PageActions = PageActions;