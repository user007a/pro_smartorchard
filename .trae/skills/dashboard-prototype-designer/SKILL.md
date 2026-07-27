---
name: "dashboard-prototype-designer"
description: "Generates data dashboard HTML prototypes with enterprise management cockpit style. Use when user asks to create a big screen/dashboard page, data visualization, or management dashboard."
---

# Dashboard Prototype Designer

大屏端数据可视化HTML原型设计Skill - 基于数农智果智慧果园企业管理驾驶舱设计系统

## 1. 设计系统概述

### 1.1 核心特点
- **主题**: 苹果绿配色，清晰专业的数据可视化风格
- **布局**: 三栏布局（左侧数据面板 + 中间地图/核心区 + 右侧数据面板）
- **字号**: 大屏增强版，字号较标准版放大1.33倍
- **圆角**: 大圆角设计，营造现代感

### 1.2 色彩系统

```css
/* 主色系 — 苹果绿 */
--ds-primary-25: #f7fdf9;
--ds-primary-50: #f0faf3;
--ds-primary-100: #d6f5dc;
--ds-primary-200: #aeeab8;
--ds-primary-300: #76d88c;
--ds-primary-400: #46c365;
--ds-primary-500: #22a84a;
--ds-primary-600: #1a8a3c;
--ds-primary-700: #146c31;
--ds-primary-800: #0f5628;
--ds-primary-900: #0a4622;

/* 功能色 */
--ds-success: #52c41a;
--ds-warning: #faad14;
--ds-error: #ff4d4f;
--ds-info: #1890ff;

/* 数据可视化色板 */
--ds-chart-green: #2b6e3c;
--ds-chart-blue: #3b82f6;
--ds-chart-amber: #f59e0b;
--ds-chart-red: #ef4444;
--ds-chart-violet: #8b5cf6;
--ds-chart-cyan: #06b6d4;
```

### 1.3 间距系统

```css
--ds-space-xs: 6px;
--ds-space-sm: 10px;
--ds-space-md: 16px;
--ds-space-lg: 20px;
--ds-space-xl: 28px;
--ds-space-2xl: 32px;
--ds-space-3xl: 40px;
--ds-space-4xl: 64px;
```

### 1.4 圆角系统

```css
--ds-radius-sm: 8px;
--ds-radius-md: 12px;
--ds-radius-lg: 16px;
--ds-radius-xl: 20px;
--ds-radius-2xl: 24px;
--ds-radius-3xl: 28px;
--ds-radius-full: 9999px;
```

### 1.5 阴影系统

```css
--ds-shadow-xs: 0 1px 3px rgba(43,110,60,0.04);
--ds-shadow-sm: 0 2px 6px rgba(0,0,0,0.04);
--ds-shadow-card: 0 4px 16px rgba(43,110,60,0.06), 0 1px 4px rgba(0,0,0,0.03);
--ds-shadow-card-hover: 0 12px 28px rgba(43,110,60,0.10), 0 4px 12px rgba(0,0,0,0.04);
--ds-shadow-md: 0 8px 24px rgba(43,110,60,0.08), 0 2px 8px rgba(0,0,0,0.04);
--ds-shadow-lg: 0 16px 40px rgba(43,110,60,0.12), 0 4px 16px rgba(0,0,0,0.06);
```

---

## 2. 标准页面结构

### 2.1 HTML模板

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>页面标题</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <style>
        /* CSS变量定义 */
        :root {
            /* 主色系 */
            --primary-700: #146c31;
            --primary-600: #1a8a3c;
            --primary-500: #22a84a;
            --primary-100: #d6f5dc;

            /* 功能色 */
            --success: #52c41a;
            --warning: #faad14;
            --error: #ff4d4f;
            --info: #1890ff;

            /* 背景色 */
            --bg-base: #f0f4f2;
            --bg-white: #ffffff;
            --bg-section: #f5f8f6;

            /* 文字色 */
            --text: #1a2332;
            --text-secondary: #434343;
            --text-muted: #64748b;

            /* 间距 */
            --space-xs: 6px;
            --space-sm: 10px;
            --space-md: 16px;
            --space-lg: 20px;
            --space-xl: 28px;
            --space-2xl: 32px;

            /* 圆角 */
            --radius-md: 12px;
            --radius-lg: 16px;
            --radius-xl: 20px;
            --radius-2xl: 24px;
            --radius-full: 9999px;

            /* 阴影 */
            --shadow-sm: 0 2px 6px rgba(0,0,0,0.04);
            --shadow-card: 0 4px 16px rgba(43,110,60,0.06), 0 1px 4px rgba(0,0,0,0.03);
            --shadow-card-hover: 0 12px 28px rgba(43,110,60,0.10), 0 4px 12px rgba(0,0,0,0.04);

            /* 字体 */
            --font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            background: var(--bg-base);
            font-family: var(--font-family);
            padding: var(--space-2xl) var(--space-lg);
            color: var(--text);
        }

        .dashboard-container {
            max-width: 1600px;
            margin: 0 auto;
        }
    </style>
</head>
<body>
    <div class="dashboard-container">
        <!-- 页面内容 -->
    </div>
</body>
</html>
```

---

## 3. 组件库

### 3.1 页面头部 (Header)

```html
<div class="header">
    <div class="title-section">
        <h1>
            <i class="fas fa-apple-alt" style="color:#2b6e3c;"></i>
            主标题
        </h1>
        <p>副标题描述</p>
    </div>
    <div class="platform-entries">
        <!-- 平台入口按钮 -->
    </div>
    <div class="date-badge">
        <i class="far fa-calendar-alt"></i>
        <span id="currentDate">2026年6月15日</span> · 当前时期
    </div>
</div>
```

```css
.header {
    margin-bottom: 24px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 16px;
}

.title-section h1 {
    font-size: 28px;
    font-weight: 600;
    background: linear-gradient(135deg, var(--primary-700), var(--primary-500));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
}

.title-section p {
    color: var(--text-secondary);
    margin-top: var(--space-xs);
    font-size: 20px;
}
```

### 3.2 平台入口按钮 (Platform Entry)

```html
<div class="platform-entries">
    <a href="#" class="platform-entry" onclick="openModelBoard(); return false;" title="进入模型预测">
        <i class="fas fa-brain"></i> 模型预测
    </a>
    <a href="vr_panorama.html" class="platform-entry" title="进入果园实景展示">
        <i class="fas fa-vr-cardboard"></i> 果园实景
    </a>
    <a href="../applefarm_backhand/login.html" class="platform-entry" title="进入电脑端系统">
        <i class="fas fa-desktop"></i> 电脑端
    </a>
    <a href="../applefarm_mobile/mb_login.html" class="platform-entry" title="进入移动端系统">
        <i class="fas fa-mobile-alt"></i> 移动端
    </a>
    <a href="../applefarm_h5/index.html" class="platform-entry" title="进入消费者端系统">
        <i class="fas fa-user"></i> 消费者端
    </a>
</div>
```

```css
.platform-entries {
    display: flex;
    gap: 12px;
    align-items: center;
}

.platform-entry {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: white;
    padding: 8px 16px;
    border-radius: 40px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.04);
    font-weight: 500;
    color: #2c6e3c;
    text-decoration: none;
    transition: all 0.2s;
    border: 1px solid #e2e8f0;
}

.platform-entry:hover {
    background: #2b6e3c;
    color: white;
    border-color: #2b6e3c;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(43,110,60,0.2);
}

.platform-entry i { font-size: 0.9rem; }
```

### 3.3 日期徽章 (Date Badge)

```css
.date-badge {
    background: var(--bg-white);
    padding: var(--space-sm) var(--space-xl);
    border-radius: var(--radius-full);
    box-shadow: var(--shadow-sm);
    font-weight: 500;
    color: var(--primary-700);
    display: flex;
    align-items: center;
    gap: var(--space-sm);
}
```

### 3.4 筛选面板 (Drill Panel)

```html
<div class="drill-panel">
    <div class="drill-item">
        <label>基地:</label>
        <select>
            <option>全部基地</option>
            <option>基地A</option>
        </select>
    </div>
    <div class="drill-item">
        <label>时间:</label>
        <select>
            <option>2026年</option>
        </select>
    </div>
    <div class="breadcrumb">
        <i class="fas fa-home"></i> 全部
    </div>
</div>
```

```css
.drill-panel {
    background: white;
    border-radius: var(--radius-2xl);
    padding: 1rem 1.5rem;
    margin-bottom: 28px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.03);
    border: 1px solid #eef2f6;
}

.drill-item {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #f8fafc;
    padding: 6px 18px;
    border-radius: 40px;
}

.drill-item label {
    font-weight: 600;
    color: #2c6e3c;
}

.drill-item select {
    padding: 8px 14px;
    border-radius: 32px;
    border: 1px solid #cbd5e1;
    background: white;
    font-weight: 500;
    cursor: pointer;
    outline: none;
}

.breadcrumb {
    background: #eef2ef;
    padding: 6px 16px;
    border-radius: 40px;
    font-size: 0.85rem;
    font-weight: 500;
}
```

### 3.5 KPI卡片网格 (KPI Grid)

```html
<div class="kpi-grid">
    <div class="kpi-card">
        <div class="kpi-info">
            <h4>企业人员</h4>
            <div class="kpi-number">846</div>
            <span class="trend-badge">人</span>
        </div>
        <div class="kpi-icon"><i class="fas fa-users"></i></div>
    </div>
    <div class="kpi-card">
        <div class="kpi-info">
            <h4>基地总数</h4>
            <div class="kpi-number">8</div>
            <span class="trend-badge">个</span>
        </div>
        <div class="kpi-icon"><i class="fas fa-building"></i></div>
    </div>
    <!-- 更多KPI卡片 -->
</div>
```

```css
.kpi-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 16px;
    margin-bottom: 28px;
}

.kpi-card {
    background: white;
    border-radius: var(--radius-2xl);
    padding: 12px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 2px 8px rgba(0,0,0,0.02);
    border: 1px solid #eef2f6;
    transition: all 0.2s ease;
    cursor: pointer;
}

.kpi-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(43,110,60,0.1);
    border-color: #d1fae5;
}

.kpi-info h4 {
    font-size: 14px;
    color: #5b6e8c;
    margin-bottom: 4px;
}

.kpi-number {
    font-size: 1.5rem;
    font-weight: 700;
    color: #2b6e3c;
}

.kpi-icon {
    width: 44px;
    height: 44px;
    background: #eef6ef;
    border-radius: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    color: #2b6e3c;
}

.trend-badge {
    font-size: 0.7rem;
    background: #e6f7e6;
    display: inline-block;
    padding: 2px 8px;
    border-radius: 20px;
    margin-top: 5px;
    color: #1f7840;
}

/* 双列KPI */
.kpi-double {
    grid-column: span 2;
    justify-content: space-around;
}
```

### 3.6 卡片组件 (Card)

```html
<div class="card">
    <div class="card-header">
        <span>卡片标题</span>
        <span class="header-extra">额外信息</span>
    </div>
    <div class="card-body">
        <!-- 卡片内容 -->
    </div>
</div>
```

```css
.card {
    background: white;
    border-radius: var(--radius-2xl);
    box-shadow: 0 8px 20px rgba(0,0,0,0.03);
    padding: 1rem;
    border: 1px solid rgba(0,0,0,0.03);
    transition: all 0.2s;
}

.card:hover {
    box-shadow: 0 12px 28px rgba(0,0,0,0.06);
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.8rem;
    font-weight: 600;
    font-size: 0.95rem;
    border-left: 4px solid #2b6e3c;
    padding-left: 12px;
}

.header-extra {
    font-size: var(--text-xs, 0.75rem);
    color: var(--text-muted);
    font-weight: 400;
}
```

### 3.7 三栏布局 (Map Core Grid)

```css
.map-core-grid {
    display: grid;
    grid-template-columns: 1fr 2.2fr 1fr;
    gap: 20px;
    margin-bottom: 28px;
}

.side-col {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.side-card {
    display: flex;
    flex-direction: column;
    min-height: 260px;
}
```

---

## 4. 常用图标 (FontAwesome)

```html
<!-- 平台入口图标 -->
<i class="fas fa-brain"></i>           <!-- 模型预测 -->
<i class="fas fa-vr-cardboard"></i>     <!-- 果园实景 -->
<i class="fas fa-desktop"></i>          <!-- 电脑端 -->
<i class="fas fa-mobile-alt"></i>      <!-- 移动端 -->
<i class="fas fa-user"></i>             <!-- 消费者端 -->

<!-- 通用图标 -->
<i class="fas fa-apple-alt"></i>        <!-- Logo -->
<i class="fas fa-users"></i>            <!-- 人员 -->
<i class="fas fa-building"></i>         <!-- 基地 -->
<i class="fas fa-map-pin"></i>          <!-- 地块 -->
<i class="fas fa-chart-line"></i>       <!-- 图表 -->
<i class="fas fa-leaf"></i>              <!-- 种植 -->
<i class="fas fa-seedling"></i>          <!-- 生长 -->
<i class="fas fa-temperature-half"></i>  <!-- 温度 -->
<i class="fas fa-droplet"></i>           <!-- 湿度 -->
<i class="fas fa-sun"></i>               <!-- 天气 -->
<i class="fas fa-cloud-rain"></i>        <!-- 降雨 -->
<i class="fas fa-wind"></i>              <!-- 风力 -->
<i class="fas fa-camera"></i>             <!-- 监控 -->
<i class="fas fa-bell"></i>               <!-- 告警 -->
<i class="fas fa-cog"></i>               <!-- 设置 -->
<i class="fas fa-search"></i>             <!-- 搜索 -->
<i class="fas fa-filter"></i>            <!-- 筛选 -->
<i class="fas fa-download"></i>          <!-- 导出 -->
<i class="fas fa-calendar-alt"></i>      <!-- 日历 -->
```

---

## 5. 动画效果

```css
/* 卡片悬停 */
.kpi-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(43,110,60,0.1);
}

/* 按钮悬停 */
.platform-entry:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(43,110,60,0.2);
}

/* 卡片进入动画 */
@keyframes cardEnter {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
}

.card-enter {
    animation: cardEnter 0.5s cubic-bezier(0.4, 0, 0.2, 1) both;
}
```

---

## 6. 响应式断点

```css
/* 大屏 */
@media (min-width: 1200px) {
    .kpi-grid { grid-template-columns: repeat(8, 1fr); }
    .map-core-grid { grid-template-columns: 1fr 2.2fr 1fr; }
}

/* 中屏 */
@media (max-width: 1199px) {
    .kpi-grid { grid-template-columns: repeat(4, 1fr); }
    .map-core-grid { grid-template-columns: 1fr; }
}

/* 小屏 */
@media (max-width: 768px) {
    .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    .header { flex-direction: column; align-items: flex-start; }
}
```

---

## 7. 使用示例

### 生成大屏首页
当用户要求生成大屏端页面时，按照以下顺序构建：
1. 引用CSS设计系统
2. 构建页面头部（标题 + 平台入口 + 日期）
3. 构建筛选面板
4. 构建KPI网格
5. 构建三栏布局（左侧面板 + 中间地图 + 右侧面板）
6. 添加图表和交互

### 配色应用
- 主色调: `#2b6e3c` (苹果绿)
- 成功色: `#52c41a`
- 警告色: `#faad14`
- 错误色: `#ff4d4f`
- 信息色: `#1890ff`
