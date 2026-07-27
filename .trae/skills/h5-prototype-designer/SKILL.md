---
name: "h5-prototype-designer"
description: "H5移动端HTML原型设计器。用于创建移动端H5页面原型，生成符合数农智果设计规范的HTML页面，包含完整的CSS样式、组件和交互功能。当用户需要创建H5页面、设计移动端原型、生成HTML代码时使用。"
---

# H5 移动端原型设计器

基于数农智果有机苹果溯源平台设计规范的专业H5原型生成工具。

## 设计系统规范

### 1. 核心色系

```css
/* 主色系 - 自然绿色 */
--primary: #2e9e5a;
--primary-50: #f0faf4;
--primary-100: #d6f5dc;
--primary-200: #aeeab8;
--primary-700: #146c31;

/* 功能色 */
--success: #389e0d;
--warning: #d48806;
--error: #cf1322;
--info: #096dd9;

/* 中性色 */
--text: #1a1a1a;
--text-secondary: #595959;
--text-tertiary: #8c8c8c;
--bg: #f5f7fa;
--bg-white: #ffffff;
```

### 2. 字体系统

```css
/* 字号层级 (基准14px) */
--font-2xs: 11px;   /* 装饰标签 */
--font-xs: 12px;     /* 辅助文字 */
--font-sm: 13px;     /* 次要信息 */
--font-base: 14px;   /* 正文基准 */
--font-md: 16px;     /* 小标题 */
--font-lg: 18px;     /* 标题 */
--font-xl: 20px;     /* 大标题 */
--font-2xl: 24px;    /* 页面标题 */

/* 字重 */
--font-regular: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
--font-extrabold: 800;
```

### 3. 间距系统 (8px基准)

```css
--space-1: 4px;
--space-1.5: 6px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
```

### 4. 圆角系统

```css
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 14px;
--radius-xl: 18px;
--radius-2xl: 22px;
--radius-full: 9999px;
```

### 5. 阴影系统

```css
--shadow-xs: 0 1px 2px rgba(0,0,0,0.04);
--shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
--shadow-md: 0 2px 8px rgba(0,0,0,0.08);
--shadow-card: 0 2px 12px rgba(46,158,90,0.08);
--shadow-lg: 0 4px 16px rgba(0,0,0,0.12);
--shadow-float: 0 8px 24px rgba(0,0,0,0.15);
```

### 6. 渐变规范

```css
--gradient-header: linear-gradient(145deg, #1a6a38 0%, #2e9e5a 35%, #3eb87a 65%, #2e8a4e 100%);
--gradient-primary: linear-gradient(135deg, var(--primary) 0%, var(--primary-600) 100%);
```

## 页面结构模板

### 基础HTML模板

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>页面标题</title>
  <link rel="stylesheet" href="../applefarm_mobile/css/mobile-design-system.css">
  <style>
    /* 页面样式 */
  </style>
</head>
<body>
  <div class="mb-app">
    <!-- 页面内容 -->
    
    <!-- 底部导航 -->
    <nav class="mb-tab-bar">
      <div class="mb-tab-item active" onclick="navigateTo('index.html')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        </svg>
        <span>首页</span>
      </div>
      <div class="mb-tab-item" onclick="navigateTo('h5_store.html')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
        </svg>
        <span>商城</span>
      </div>
      <div class="mb-tab-item" onclick="navigateTo('trace_h5.html')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>溯源</span>
      </div>
      <div class="mb-tab-item" onclick="navigateTo('h5_member.html')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        <span>我的</span>
      </div>
    </nav>
  </div>
  
  <script>
    function navigateTo(page) { window.location.href = page; }
  </script>
</body>
</html>
```

## 组件库

### 1. 欢迎板块组件

```css
.welcome-section {
  background: var(--gradient-header);
  padding: calc(var(--safe-top) + 12px) var(--space-3) var(--space-5);
  color: var(--text-on-primary);
  border-radius: 0 0 var(--radius-xl) var(--radius-xl);
  position: relative;
  overflow: hidden;
}

.welcome-section::before {
  content: '';
  position: absolute;
  top: -30%; right: -15%;
  width: 60%; height: 100%;
  background: radial-gradient(ellipse, rgba(255,255,255,0.10) 0%, transparent 70%);
  pointer-events: none;
}

.welcome-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.welcome-brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.welcome-logo {
  width: 38px; height: 38px;
  background: rgba(255,255,255,0.18);
  backdrop-filter: blur(8px);
  border-radius: var(--radius-lg);
  display: flex; align-items: center; justify-content: center;
}

.welcome-user {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  background: rgba(255,255,255,0.12);
  backdrop-filter: blur(10px);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  cursor: pointer;
}
```

### 2. 快捷入口组件

```css
.quick-entry {
  margin: calc(-1 * var(--space-4)) var(--space-3) var(--space-4);
  background: var(--bg-white);
  border-radius: var(--radius-xl);
  padding: var(--space-4);
  position: relative;
  z-index: 2;
  box-shadow: 0 6px 24px rgba(0,0,0,0.06);
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
}

.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  cursor: pointer;
  transition: all var(--transition-fast);
  padding: var(--space-1);
  border-radius: var(--radius-md);
}

.quick-item:active { transform: scale(0.96); }

.quick-icon {
  width: 44px; height: 44px;
  border-radius: var(--radius-lg);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px;
}

.quick-icon.store {
  background: linear-gradient(135deg, var(--primary-50) 0%, var(--primary-100) 100%);
  color: var(--primary-700);
}

.quick-name {
  font-size: var(--font-xs);
  color: var(--text);
  font-weight: var(--font-medium);
  text-align: center;
}
```

### 3. 区块标题组件

```css
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.section-title {
  font-size: var(--font-md);
  font-weight: var(--font-semibold);
  color: var(--text);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.section-dot {
  width: 3px;
  height: 14px;
  background: var(--primary);
  border-radius: 2px;
}

.section-more {
  font-size: var(--font-xs);
  color: var(--text-secondary);
}
```

### 4. 商品卡片组件 (横向)

```css
.product-scroll {
  display: flex;
  gap: var(--space-3);
  overflow-x: auto;
  padding-bottom: var(--space-2);
  -webkit-overflow-scrolling: touch;
}

.product-scroll::-webkit-scrollbar { display: none; }

.product-card-h {
  flex-shrink: 0;
  width: 140px;
  background: var(--bg-white);
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.product-card-h:active { transform: scale(0.98); }

.product-img-h {
  width: 100%;
  height: 100px;
  background: var(--primary-50);
  position: relative;
}

.product-img-h img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-badge-h {
  position: absolute;
  top: var(--space-1);
  left: var(--space-1);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: var(--font-2xs);
  font-weight: var(--font-bold);
  color: var(--text-on-primary);
}

.product-info-h { padding: var(--space-2); }

.product-name-h {
  font-size: var(--font-sm);
  font-weight: var(--font-semibold);
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: var(--space-1);
}

.product-price-h {
  font-size: var(--font-base);
  font-weight: var(--font-extrabold);
  color: var(--error);
  font-family: var(--font-family-number);
}

.product-price-h .original {
  font-size: var(--font-xs);
  color: var(--text-tertiary);
  text-decoration: line-through;
  margin-left: var(--space-1);
}
```

### 5. 活动卡片组件

```css
.activity-card {
  background: var(--bg-white);
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--border);
  margin-bottom: var(--space-3);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.activity-card:active { transform: scale(0.99); }

.activity-img {
  width: 100%;
  height: 120px;
  position: relative;
}

.activity-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.activity-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0,0,0,0.6));
  padding: var(--space-3);
}

.activity-tag {
  display: inline-block;
  padding: 2px 8px;
  background: var(--error);
  color: var(--text-on-primary);
  border-radius: var(--radius-sm);
  font-size: var(--font-xs);
  font-weight: var(--font-bold);
}

.activity-info { padding: var(--space-3); }

.activity-title {
  font-size: var(--font-base);
  font-weight: var(--font-semibold);
  color: var(--text);
  margin-bottom: var(--space-1);
}

.activity-price {
  font-size: var(--font-lg);
  font-weight: var(--font-extrabold);
  color: var(--error);
}
```

### 6. 底部导航栏组件

```css
.mb-tab-bar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 750px;
  height: 60px;
  background: var(--bg-white);
  display: flex;
  justify-content: space-around;
  align-items: center;
  border-top: 1px solid var(--border);
  z-index: var(--z-tab-bar);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.mb-tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}

.mb-tab-item svg {
  width: 22px;
  height: 22px;
}

.mb-tab-item span {
  font-size: 10px;
  font-weight: 500;
}

.mb-tab-item.active {
  color: var(--primary);
}

.mb-tab-item:active {
  background: rgba(0,0,0,0.03);
}
```

### 7. 标签组件

```css
.mb-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: var(--font-2xs);
  font-weight: var(--font-bold);
  color: var(--text-on-primary);
}

.mb-tag.default { background: var(--primary); }
.mb-tag.success { background: var(--success); }
.mb-tag.warning { background: var(--warning); }
.mb-tag.error { background: var(--error); }
.mb-tag.info { background: var(--info); }
```

### 8. 区块容器组件

```css
.mb-section {
  padding: var(--space-4) var(--space-3);
}

.mb-section:last-child {
  padding-bottom: calc(var(--space-8) + 120px); /* 底部导航间距 */
}
```

## 常用功能模板

### 1. 图片加载失败处理

```javascript
function handleImageError(img) {
  img.onerror = null;
  img.src = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<rect fill="#f5f5f5" width="100" height="100"/>' +
    '<text fill="%23999" font-size="10" text-anchor="middle" x="50" y="50">图片加载失败</text>' +
    '<text fill="%23999" font-size="8" text-anchor="middle" x="50" y="65">请检查网络连接</text>' +
    '</svg>'
  );
}

// 页面加载后自动绑定
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('img').forEach(function(img) {
    img.onerror = function() { handleImageError(this); };
  });
});
```

### 2. 按钮防重复点击

```javascript
var clickLock = {};
function preventDoubleClick(btnId, callback, delay) {
  delay = delay || 1000;
  if (clickLock[btnId]) {
    showToast('请勿重复操作');
    return false;
  }
  clickLock[btnId] = true;
  setTimeout(function() { clickLock[btnId] = false; }, delay);
  callback();
  return true;
}
```

### 3. Toast提示

```javascript
function showToast(message) {
  var toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.75);color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;z-index:9999;animation:fadeInOut 2s ease;';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 2000);
}

// Toast动画样式
var style = document.createElement('style');
style.textContent = '@keyframes fadeInOut { 0%{opacity:0;transform:translate(-50%,-50%) scale(0.8)} 20%{opacity:1;transform:translate(-50%,-50%) scale(1)} 80%{opacity:1} 100%{opacity:0} }';
document.head.appendChild(style);
```

### 4. 页面跳转函数

```javascript
function navigateTo(page) { window.location.href = page; }
```

### 5. 弹窗关闭（点击外部）

```javascript
document.getElementById('modalOverlay').addEventListener('click', function(e) {
  if (e.target === this) {
    this.classList.remove('active');
  }
});
```

## 响应式图片资源

推荐使用 Unsplash 的实景图片，URL格式：

```html
<!-- 商品图片 -->
<img src="https://images.unsplash.com/photo-XXXXXXXX?w=300&h=200&fit=crop" alt="商品图片">

<!-- 活动大图 -->
<img src="https://images.unsplash.com/photo-XXXXXXXX?w=600&h=240&fit=crop" alt="活动图片">
```

### 推荐图片ID（苹果/水果类）

```javascript
// 苹果类
'photo-1570913149827-d2ac84ab3f9a'  // 红富士苹果
'photo-1560806887-1e4cd0b6cbd6'      // 嘎啦苹果
'photo-1633356122544-f134324a6cee'  // 苹果礼盒
'photo-1528825871115-3581a5387919'  // 果树
'photo-1459411552884-841db9b3cc2a'  // 苹果园
'photo-1573164574569-9094b0a297bd'  // 苹果拼团

// 其他水果
'photo-1619546813926-a78fa6372cd2'  // 新鲜水果
'photo-1502005097779-89243872144d'  // 果园风景
```

## 页面模板示例

### 1. 会员中心页面

```html
<!-- 会员中心头部 -->
<div class="member-header">
  <div class="member-avatar">
    <img src="默认头像" alt="头像">
  </div>
  <div class="member-info">
    <div class="member-name">用户名</div>
    <div class="member-level">VIP会员</div>
  </div>
</div>

<!-- 功能菜单 -->
<div class="member-menu">
  <div class="menu-item" onclick="navigateTo('h5_adoption.html')">
    <div class="menu-icon">🌱</div>
    <div class="menu-name">我的认养</div>
  </div>
  <div class="menu-item" onclick="navigateTo('h5_favorites.html')">
    <div class="menu-icon">❤️</div>
    <div class="menu-name">我的收藏</div>
  </div>
  <div class="menu-item" onclick="navigateTo('h5_profile.html')">
    <div class="menu-icon">👤</div>
    <div class="menu-name">个人信息</div>
  </div>
  <div class="menu-item" onclick="navigateTo('h5_messages.html')">
    <div class="menu-icon">📬</div>
    <div class="menu-name">我的消息</div>
  </div>
  <div class="menu-item" onclick="navigateTo('h5_settings.html')">
    <div class="menu-icon">⚙️</div>
    <div class="menu-name">设置</div>
  </div>
</div>
```

### 2. 溯源时间线

```html
<div class="trace-timeline">
  <div class="timeline-item">
    <div class="timeline-dot active"></div>
    <div class="timeline-content">
      <div class="timeline-title">种植管理</div>
      <div class="timeline-date">2026.03.15</div>
      <div class="timeline-desc">有机种植，全程无农药</div>
    </div>
  </div>
  <div class="timeline-item">
    <div class="timeline-dot"></div>
    <div class="timeline-content">
      <div class="timeline-title">施肥养护</div>
      <div class="timeline-date">2026.04.20</div>
      <div class="timeline-desc">有机肥料，绿色环保</div>
    </div>
  </div>
</div>
```

## 设计原则

1. **拇指友好**: 交互元素高度 ≥ 44px，间距合理
2. **清晰层次**: 字号层级分明，颜色对比度 ≥ 4.5:1
3. **一致风格**: 统一使用设计系统的颜色、间距、圆角
4. **流畅动效**: 使用 `var(--transition-fast)` 控制动画时长
5. **安全适配**: 考虑 iOS刘海屏和底部安全区域
6. **状态反馈**: 点击、悬停等状态有明显区分

## 使用流程

1. 确定页面类型（首页/列表/详情/表单等）
2. 选择合适的基础模板
3. 使用设计系统的CSS变量和组件
4. 添加必要的JavaScript功能
5. 测试页面在移动端的显示效果
