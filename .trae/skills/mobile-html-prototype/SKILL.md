---
name: "mobile-html-prototype"
description: "快速生成移动端HTML原型页面，包含完整设计系统和组件模板。用于创建新的移动端H5页面、生成小程序原型、开发移动端UI。Invoke when user wants to create mobile HTML pages, prototypes, or H5 interfaces."
---

# 智慧果园移动端HTML原型设计系统

基于数农智果H5设计系统v2.0的移动端HTML快速生成工具。

## 使用方法

1. 复制下方模板代码到新HTML文件
2. 根据需求修改页面内容和样式
3. 引用统一的设计系统CSS文件

---

## 1. 页面基础模板

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>智慧果园 - 页面名称</title>
  <!-- 设计系统 -->
  <link rel="stylesheet" href="css/mobile-design-system.css">
  <style>
    /* 页面专属样式 */
    .content { padding: var(--space-4); padding-bottom: 80px; }
  </style>
</head>
<body>
  <div class="mb-app">
    <!-- 页面内容 -->
    
    <!-- 底部导航栏 -->
    <nav class="tab-bar">
      <a href="mb_home.html" class="tab-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        <span>首页</span>
      </a>
      <a href="mb_service.html" class="tab-item active">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        <span>服务</span>
      </a>
      <a href="#" class="tab-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        <span>消息</span>
      </a>
      <a href="mb_mine.html" class="tab-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span>我的</span>
      </a>
    </nav>
  </div>
  
  <script>
    // 页面脚本
    function navigateTo(page) {
      window.location.href = page;
    }
  </script>
</body>
</html>
```

---

## 2. Header组件（三种变体）

### 2.1 主页型Header（带背景渐变）

```html
<div class="page-header mb-header-home">
  <div class="header-brand">
    <span class="header-title">智慧果园</span>
  </div>
  <div class="header-subtitle">数字赋能 · 智慧管理</div>
</div>
```

### 2.2 详情页Header（带返回按钮）

```html
<div class="page-header mb-header-detail">
  <div class="header-nav">
    <div class="header-back" onclick="window.history.back()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
    </div>
    <div class="header-title">页面标题</div>
    <div class="header-actions">
      <!-- 可选操作按钮 -->
    </div>
  </div>
  <div class="header-content">
    <div class="header-sub">副标题说明</div>
  </div>
</div>
```

### 2.3 工具页Header（白色简洁）

```html
<div class="page-header mb-header-tool">
  <div class="header-nav">
    <div class="header-back" onclick="window.history.back()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
    </div>
    <div class="header-title">工具名称</div>
  </div>
</div>
```

---

## 3. 卡片组件

### 3.1 基础卡片

```html
<div class="card">
  <div class="card-title">卡片标题</div>
  <div class="card-content">
    <!-- 内容 -->
  </div>
</div>
```

### 3.2 统计数据卡片

```html
<div class="stat-card" onclick="navigateTo('target.html')">
  <div class="stat-value">98.5%</div>
  <div class="stat-label">数据指标</div>
</div>

<!-- 网格布局 -->
<div class="stats-grid">
  <div class="stat-card">...</div>
  <div class="stat-card">...</div>
</div>
```

### 3.3 服务卡片网格

```html
<div class="service-grid">
  <div class="service-item" onclick="openPage()">
    <div class="service-icon green">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <!-- 图标路径 -->
      </svg>
    </div>
    <div class="service-name">服务名称</div>
  </div>
</div>
```

---

## 4. 列表组件

### 4.1 通用列表项

```html
<div class="list-item" onclick="handleClick()">
  <div class="list-icon blue">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <!-- 图标 -->
    </svg>
  </div>
  <div class="list-content">
    <div class="list-title">标题</div>
    <div class="list-subtitle">副标题/描述</div>
  </div>
  <div class="list-arrow">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
  </div>
</div>
```

### 4.2 带状态的列表项

```html
<div class="list-item">
  <div class="list-icon green">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  </div>
  <div class="list-content">
    <div class="list-title">已完成</div>
    <div class="list-subtitle">状态描述</div>
  </div>
  <span class="tag tag-success">已处理</span>
</div>
```

---

## 5. 标签组件

```html
<span class="tag tag-primary">主要</span>
<span class="tag tag-success">成功</span>
<span class="tag tag-warning">警告</span>
<span class="tag tag-danger">危险</span>
<span class="tag tag-info">信息</span>
```

---

## 6. 按钮组件

### 6.1 主按钮

```html
<button class="btn btn-primary">主要按钮</button>
<button class="btn btn-success">成功按钮</button>
<button class="btn btn-warning">警告按钮</button>
<button class="btn btn-danger">危险按钮</button>
```

### 6.2 次要/幽灵按钮

```html
<button class="btn btn-outline">次要按钮</button>
```

### 6.3 块级按钮

```html
<button class="btn btn-block btn-primary">全宽按钮</button>
```

---

## 7. 弹窗组件

### 7.1 确认弹窗

```html
<div class="modal-overlay" id="confirmModal">
  <div class="modal">
    <div class="modal-header">
      <div class="modal-title">确认操作</div>
    </div>
    <div class="modal-body">
      确定要执行此操作吗？
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="confirmAction()">确定</button>
    </div>
  </div>
</div>
```

### 7.2 成功提示弹窗

```html
<div class="modal-overlay" id="successModal">
  <div class="modal modal-success">
    <div class="modal-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    </div>
    <div class="modal-title">操作成功</div>
    <div class="modal-body">提示信息内容</div>
    <div class="modal-footer">
      <button class="btn btn-primary btn-block" onclick="closeSuccessModal()">确 定</button>
    </div>
  </div>
</div>
```

### 7.3 底部操作弹窗

```html
<div class="action-sheet" id="actionSheet">
  <div class="action-sheet-mask" onclick="closeActionSheet()"></div>
  <div class="action-sheet-content">
    <div class="action-sheet-title">选择操作</div>
    <div class="action-sheet-item" onclick="handleAction(1)">操作一</div>
    <div class="action-sheet-item" onclick="handleAction(2)">操作二</div>
    <div class="action-sheet-item action-sheet-cancel" onclick="closeActionSheet()">取消</div>
  </div>
</div>
```

---

## 8. 表格/网格组件

### 8.1 2列网格

```html
<div class="mb-grid mb-grid-2">
  <div class="mb-grid-item">内容1</div>
  <div class="mb-grid-item">内容2</div>
</div>
```

### 8.2 3列网格

```html
<div class="mb-grid mb-grid-3">
  <div class="mb-grid-item">内容1</div>
  <div class="mb-grid-item">内容2</div>
  <div class="mb-grid-item">内容3</div>
</div>
```

### 8.3 4列网格（环境监测）

```html
<div class="mb-env-grid">
  <div class="env-item">
    <div class="env-icon">🌡️</div>
    <div class="env-value">25.6°C</div>
    <div class="env-label">温度</div>
  </div>
  <div class="env-item">...</div>
</div>
```

---

## 9. 滚动消息组件

```html
<div class="mb-marquee">
  <div class="mb-marquee-icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/>
    </svg>
  </div>
  <div class="mb-marquee-wrapper">
    <div class="mb-marquee-content" onclick="showMessageDetail(0)">
      <span>消息内容一</span>
      <span>消息内容二</span>
      <span>消息内容三</span>
    </div>
  </div>
</div>
```

### 滚动动画样式

```css
.mb-marquee-content {
  display: inline-flex;
  animation: marquee 20s linear infinite;
}

@keyframes marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
```

---

## 10. 表单组件

### 10.1 输入框

```html
<div class="form-item">
  <label class="form-label">标签名称</label>
  <input type="text" class="form-input" placeholder="请输入...">
</div>
```

### 10.2 选择器

```html
<div class="form-item">
  <label class="form-label">选择项</label>
  <div class="form-select" onclick="showPicker()">
    <span class="form-select-value">请选择</span>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
  </div>
</div>
```

---

## 11. 页面Header统一标准

所有详情页Header必须统一：

```css
.page-header {
  background: var(--gradient-primary);
  padding: 44px 16px 20px;
  color: var(--text-on-primary);
  position: relative;
}

.header-back {
  position: absolute;
  left: 12px;
  top: 44px;
  width: 36px;
  height: 36px;
  background: rgba(255,255,255,0.2);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.header-title {
  font-size: var(--font-xl);
  font-weight: var(--font-bold);
}

.header-sub {
  font-size: var(--font-sm);
  opacity: 0.85;
  margin-top: 4px;
}
```

---

## 12. 常用CSS变量速查

| 变量 | 用途 | 示例值 |
|------|------|--------|
| `--primary` | 主色 | `#2e9e5a` |
| `--primary-600` | 主色深 | `#1a8a3c` |
| `--success` | 成功色 | `#389e0d` |
| `--warning` | 警告色 | `#d48806` |
| `--danger` | 危险色 | `#e74c3c` |
| `--info` | 信息色 | `#096dd9` |
| `--text` | 正文色 | `#1a1a1a` |
| `--text-secondary` | 次要文字 | `#595959` |
| `--bg` | 背景色 | `#f5f7fa` |
| `--bg-white` | 白色背景 | `#ffffff` |
| `--radius-lg` | 大圆角 | `14px` |
| `--radius-xl` | 超大圆角 | `18px` |
| `--shadow-sm` | 小阴影 | `0 1px 3px rgba(0,0,0,0.06)` |
| `--shadow-md` | 中阴影 | `0 2px 8px rgba(0,0,0,0.08)` |
| `--space-4` | 标准间距 | `16px` |

---

## 13. 图标资源

使用内联SVG图标，保持视觉一致性：

### 常用图标SVG

```html
<!-- 返回箭头 -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>

<!-- 主页 -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>

<!-- 用户 -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>

<!-- 设置 -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>

<!-- 消息/通知 -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg>

<!-- 地图/定位 -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>

<!-- 日历 -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>

<!-- 相机/拍照 -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>

<!-- 无人机 -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>

<!-- 叶子/植物 -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
```

---

## 14. 页面跳转和导航

```javascript
// 跳转页面
function navigateTo(page) {
  window.location.href = page;
}

// 返回上一页
function goBack() {
  window.history.back();
}

// 返回服务中心（推荐用于详情页）
function goBack() {
  window.location.href = 'mb_service.html';
}

// 打开弹窗
function openModal(id) {
  document.getElementById(id).classList.add('show');
}

// 关闭弹窗
function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}
```

---

## 15. 完整示例页面

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>智慧果园 - 设备管理</title>
  <link rel="stylesheet" href="css/mobile-design-system.css">
  <style>
    .content { padding: var(--space-4); padding-bottom: 80px; }
    
    /* 设备卡片样式 */
    .device-list { display: flex; flex-direction: column; gap: var(--space-3); }
    
    .device-card {
      background: var(--bg-white);
      border-radius: var(--radius-xl);
      padding: var(--space-4);
      box-shadow: var(--shadow-sm);
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
    
    .device-icon {
      width: 48px; height: 48px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .device-icon.green { background: var(--success-bg); color: var(--success); }
    .device-icon.orange { background: var(--orange-bg); color: var(--orange); }
    
    .device-info { flex: 1; }
    .device-name { font-size: var(--font-md); font-weight: var(--font-semibold); }
    .device-status { font-size: var(--font-sm); color: var(--text-secondary); margin-top: 2px; }
  </style>
</head>
<body>
  <div class="mb-app">
    <!-- Header -->
    <div class="page-header mb-header-detail">
      <div class="header-nav">
        <div class="header-back" onclick="window.history.back()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        </div>
        <div class="header-title">设备管理</div>
      </div>
      <div class="header-content">
        <div class="header-sub">管理果园物联网设备</div>
      </div>
    </div>
    
    <!-- 内容区域 -->
    <div class="content">
      <div class="card">
        <div class="card-title">在线设备</div>
        <div class="device-list">
          <div class="device-card">
            <div class="device-icon green">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div class="device-info">
              <div class="device-name">环境监测站 #001</div>
              <div class="device-status">在线 · 最后更新: 2分钟前</div>
            </div>
          </div>
          <div class="device-card">
            <div class="device-icon orange">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
                <polyline points="17 2 12 7 7 2"/>
              </svg>
            </div>
            <div class="device-info">
              <div class="device-name">智能灌溉控制器</div>
              <div class="device-status">在线 · 工作正常</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 底部导航 -->
    <nav class="tab-bar">
      <a href="mb_home.html" class="tab-item"><span>首页</span></a>
      <a href="mb_service.html" class="tab-item active"><span>服务</span></a>
      <a href="#" class="tab-item"><span>消息</span></a>
      <a href="mb_mine.html" class="tab-item"><span>我的</span></a>
    </nav>
  </div>
</body>
</html>
```

---

## 附录：设计原则

1. **户外可读**：使用高对比度色彩，确保强光下可读
2. **拇指友好**：重要操作按钮放在屏幕下半部分
3. **自然鲜活**：使用绿色主色调，符合农业主题
4. **一目了然**：信息层次分明，关键数据突出显示
5. **流畅动效**：使用平滑过渡动画，提升用户体验
