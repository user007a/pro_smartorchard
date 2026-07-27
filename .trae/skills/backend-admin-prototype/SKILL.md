---
name: "backend-admin-prototype"
description: "Generates backend admin HTML prototypes with sidebar navigation, tab switching, and iframe content area. Invoke when user asks to create a backend management page, admin dashboard, or any admin panel with sidebar menu and tab navigation."
---

# Backend Admin HTML Prototype Generator

生成企业级后台管理端的 HTML 原型页面，包含：左侧深色侧边栏导航、顶部 Tab 标签页切换、iframe 内容区、响应式布局支持。

## 目录结构

```
backend-admin-prototype/
├── SKILL.md              # 本文件
├── template.html         # 完整模板
├── sidebar-layout.css    # 布局样式（内联）
└── sidebar-layout.js     # 交互脚本（内联）
```

---

## 1. 核心模板（完整HTML）

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>管理后台</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://code.iconify.design/3/3.1.1/iconify.min.js"></script>
    <style>
        * { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif; }
        @keyframes tabSlideIn { from { transform: translateX(-10px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .tab-animate { animation: tabSlideIn 0.2s ease-out; }
        .tab-scroll::-webkit-scrollbar { display: none; }
        .tab-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        .menu-arrow { transition: transform 0.2s ease; display: inline-block; }
        .menu-arrow.expanded { transform: rotate(90deg); }
        /* 侧边栏菜单 active 状态 */
        .sidebar-nav a.menu-item-active,
        .sidebar-nav a.menu-item-active:hover {
            background: rgba(34,168,74,0.15) !important;
            color: #22a84a !important;
            border-right: 3px solid #22a84a;
        }
        /* 侧边栏滚动条 */
        .sidebar-nav::-webkit-scrollbar { width: 4px; }
        .sidebar-nav::-webkit-scrollbar-track { background: transparent; }
        .sidebar-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
        .sidebar-nav::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.20); }
    </style>
</head>
<body class="h-screen flex overflow-hidden bg-[#F0F2F5]">
    <!-- ========== 侧边栏 ========== -->
    <aside id="sidebar" class="w-64 bg-[#1b2a41] flex flex-col flex-shrink-0 h-screen transition-all duration-300">
        <!-- 品牌区 -->
        <div class="h-16 flex items-center px-6 gap-3 border-b border-white/10 flex-shrink-0">
            <div class="w-8 h-8 bg-[#22a84a] rounded-lg flex items-center justify-center">
                <span class="iconify text-white text-lg" data-icon="ri:apple-line"></span>
            </div>
            <span id="brandText" class="text-white font-bold text-base whitespace-nowrap">系统名称</span>
        </div>
        <!-- 菜单区 -->
        <nav class="sidebar-nav flex-1 overflow-y-auto py-4 px-3 space-y-1">
            <!-- 首页（一级菜单无子菜单） -->
            <a href="home.html" target="mainFrame" onclick="openPage('home.html','首页')" class="flex items-center px-4 py-3 text-sm text-gray-300 hover:bg-white/10 rounded-md transition-all">
                <span class="iconify mr-3 text-lg" data-icon="ri:home-4-line"></span><span class="menu-text">系统首页</span>
            </a>

            <!-- 一级菜单（带子菜单） -->
            <div class="menu-group">
                <button class="menu-toggle w-full flex items-center justify-between px-4 py-3 text-sm text-gray-300 hover:bg-white/10 rounded-md transition-all">
                    <div class="flex items-center"><span class="iconify mr-3 text-lg text-gray-300" data-icon="ri:seedling-line"></span><span class="menu-text">生产管理</span></div>
                    <span class="menu-arrow text-gray-400">›</span>
                </button>
                <div class="menu-items pl-6" style="display:none;">
                    <a href="page1.html" target="mainFrame" onclick="openPage('page1.html','页面1')" class="flex items-center px-4 py-3 text-sm text-gray-300 hover:bg-white/10 rounded-md transition-all">
                        <span class="iconify mr-3 text-lg" data-icon="ri:calendar-line"></span><span>页面1</span>
                    </a>
                    <a href="page2.html" target="mainFrame" onclick="openPage('page2.html','页面2')" class="flex items-center px-4 py-3 text-sm text-gray-300 hover:bg-white/10 rounded-md transition-all">
                        <span class="iconify mr-3 text-lg" data-icon="ri:clipboard-line"></span><span>页面2</span>
                    </a>
                </div>
            </div>

            <!-- 更多一级菜单... -->
        </nav>
    </aside>

    <!-- ========== 右侧主区域 ========== -->
    <div class="flex-1 flex flex-col min-w-0 h-screen">
        <!-- 顶栏 -->
        <header class="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
            <div class="flex items-center gap-2 flex-1 min-w-0">
                <button id="sidebarToggle" class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
                    <span class="iconify text-xl" data-icon="ri:menu-fold-line"></span>
                </button>
                <div id="tabBar" class="tab-scroll flex items-center gap-1 overflow-x-auto min-w-0">
                </div>
            </div>
            <div class="flex items-center gap-4 flex-shrink-0 ml-4">
                <button class="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
                    <span class="iconify text-xl" data-icon="ri:notification-3-line"></span>
                    <span class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
                <div class="h-6 w-px bg-gray-200"></div>
                <div class="relative">
                    <div id="adminDropdown" class="flex items-center gap-3 cursor-pointer hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">
                        <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <span class="text-green-600 text-sm font-bold">管</span>
                        </div>
                        <span class="text-sm text-gray-700">管理员</span>
                        <span class="iconify text-gray-400" data-icon="ri:arrow-down-s-line"></span>
                    </div>
                    <div id="adminMenu" class="hidden absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                        <a href="javascript:void(0)" class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                            <span class="iconify mr-2 text-gray-400" data-icon="ri:user-line"></span>个人信息
                        </a>
                        <a href="javascript:void(0)" class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                            <span class="iconify mr-2 text-gray-400" data-icon="ri:lock-line"></span>修改密码
                        </a>
                        <div class="h-px bg-gray-100 my-1"></div>
                        <a href="login.html" class="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                            <span class="iconify mr-2" data-icon="ri:logout-circle-line"></span>退出登录
                        </a>
                    </div>
                </div>
            </div>
        </header>
        <!-- iframe 内容区 -->
        <main class="flex-1 overflow-hidden bg-[#F0F2F5]">
            <iframe name="mainFrame" id="mainFrame" src="home.html" class="w-full h-full border-none"></iframe>
        </main>
    </div>

    <script>
        // ========== 菜单展开/收起 ==========
        document.querySelectorAll('.menu-toggle').forEach(toggle => {
            toggle.addEventListener('click', function() {
                const menuItems = this.nextElementSibling;
                const arrow = this.querySelector('.menu-arrow');
                if (menuItems.style.display === 'none' || menuItems.style.display === '') {
                    menuItems.style.display = 'block';
                    arrow.classList.add('expanded');
                } else {
                    menuItems.style.display = 'none';
                    arrow.classList.remove('expanded');
                }
            });
        });

        // ========== Tab 管理 ==========
        const tabs = [];
        const tabBar = document.getElementById('tabBar');
        const mainFrame = document.getElementById('mainFrame');

        function openPage(url, title) {
            const existingTab = tabs.find(tab => tab.url === url);
            if (existingTab) {
                selectTab(existingTab);
                return;
            }
            const newTab = { id: Date.now(), url: url, title: title, element: null };
            const tabElement = document.createElement('div');
            tabElement.className = 'flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-600 rounded-t-md cursor-pointer hover:bg-gray-200 transition-colors tab-animate';
            tabElement.innerHTML = '<span class="text-sm whitespace-nowrap">' + title + '</span><button class="tab-close ml-1 p-0.5 hover:bg-black/10 rounded transition-colors"><span class="iconify text-xs" data-icon="ri:close-line"></span></button>';
            tabElement.dataset.tabId = newTab.id;
            tabElement.addEventListener('click', (e) => {
                if (!e.target.closest('.tab-close')) selectTab(newTab);
            });
            tabElement.querySelector('.tab-close').addEventListener('click', (e) => {
                e.stopPropagation();
                closeTab(newTab);
            });
            tabBar.appendChild(tabElement);
            newTab.element = tabElement;
            tabs.push(newTab);
            selectTab(newTab);
            mainFrame.src = url;
            highlightMenu(url);
        }

        function selectTab(tab) {
            tabs.forEach(t => {
                t.element.classList.remove('bg-white', 'text-gray-900', 'border-b-2', 'border-green-500');
                t.element.classList.add('bg-gray-100', 'text-gray-600');
            });
            tab.element.classList.remove('bg-gray-100', 'text-gray-600');
            tab.element.classList.add('bg-white', 'text-gray-900', 'border-b-2', 'border-green-500');
        }

        function closeTab(tab) {
            const index = tabs.indexOf(tab);
            if (index === -1) return;
            tab.element.remove();
            tabs.splice(index, 1);
            if (tabs.length > 0) {
                const newIndex = index > 0 ? index - 1 : 0;
                selectTab(tabs[newIndex]);
                mainFrame.src = tabs[newIndex].url;
                highlightMenu(tabs[newIndex].url);
            }
        }

        // ========== 菜单高亮 ==========
        function highlightMenu(url) {
            document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('menu-item-active'));
            const target = document.querySelector('.sidebar-nav a[href="' + url + '"]');
            if (target) {
                target.classList.add('menu-item-active');
                const parentItems = target.closest('.menu-items');
                if (parentItems && parentItems.style.display === 'none') {
                    parentItems.style.display = 'block';
                    const toggle = parentItems.previousElementSibling;
                    if (toggle) {
                        const arrow = toggle.querySelector('.menu-arrow');
                        if (arrow) arrow.classList.add('expanded');
                    }
                }
            }
        }

        // ========== 管理员下拉菜单 ==========
        const adminDropdown = document.getElementById('adminDropdown');
        const adminMenu = document.getElementById('adminMenu');
        adminDropdown.addEventListener('click', () => { adminMenu.classList.toggle('hidden'); });
        document.addEventListener('click', (e) => {
            if (!adminDropdown.contains(e.target)) adminMenu.classList.add('hidden');
        });

        // ========== 侧边栏折叠 ==========
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        const brandText = document.getElementById('brandText');
        let sidebarCollapsed = false;
        sidebarToggle.addEventListener('click', () => {
            sidebarCollapsed = !sidebarCollapsed;
            if (sidebarCollapsed) {
                sidebar.classList.remove('w-64');
                sidebar.classList.add('w-16');
                brandText.style.display = 'none';
                document.querySelectorAll('.menu-text, .menu-arrow').forEach(el => el.style.display = 'none');
                document.querySelectorAll('.menu-items').forEach(item => item.style.display = 'none');
                sidebarToggle.querySelector('.iconify').setAttribute('data-icon', 'ri:menu-unfold-line');
            } else {
                sidebar.classList.remove('w-16');
                sidebar.classList.add('w-64');
                brandText.style.display = '';
                document.querySelectorAll('.menu-text, .menu-arrow').forEach(el => el.style.display = '');
                sidebarToggle.querySelector('.iconify').setAttribute('data-icon', 'ri:menu-fold-line');
            }
        });

        // ========== 默认打开首页 ==========
        openPage('home.html', '首页');
    </script>
</body>
</html>
```

---

## 2. 设计规范

### 2.1 色彩系统

| Token | HEX | 用途 |
|-------|-----|------|
| `--sidebar-bg` | `#1b2a41` | 侧边栏背景（藏青色） |
| `--sidebar-bg-hover` | `rgba(255,255,255,0.10)` | 菜单项 hover |
| `--sidebar-bg-active` | `rgba(34,168,74,0.15)` | 菜单项 active |
| `--primary-500` | `#22a84a` | 苹果绿主色（强调色） |
| `--primary-400` | `#46c365` | 苹果绿亮色 |
| `--text-primary` | `#1f2937` | 主要文字 |
| `--text-secondary` | `#6b7280` | 次要文字 |
| `--border-color` | `#e5e7eb` | 边框色 |

### 2.2 尺寸规范

| Token | Value | 用途 |
|-------|-------|------|
| `--sidebar-width` | 256px | 侧边栏展开宽度 |
| `--sidebar-collapsed` | 64px | 侧边栏折叠宽度 |
| `--topbar-height` | 56px | 顶栏高度 |
| `--menu-item-height` | 48px | 一级菜单项高度 |
| `--submenu-item-height` | 44px | 二级菜单项高度 |

### 2.3 图标库

使用 [Iconify](https://icon-sets.iconify.design/)，通过 `data-icon` 属性引用：

```html
<span class="iconify" data-icon="ri:home-4-line"></span>
<span class="iconify" data-icon="ri:seedling-line"></span>
<span class="iconify" data-icon="ri:settings-3-line"></span>
```

常用图标对照：

| 模块 | 图标 |
|------|------|
| 首页 | `ri:home-4-line` |
| 生产管理 | `ri:seedling-line` |
| 物资管理 | `ri:flask-line` |
| 设备管理 | `ri:cpu-line` |
| 预警管理 | `ri:alarm-warning-line` |
| 产品溯源 | `ri:shield-check-line` |
| 销售运营 | `ri:shopping-cart-line` |
| AI模型 | `ri:brain-line` |
| 报表统计 | `ri:bar-chart-line` |
| 企业管理 | `ri:building-2-line` |
| 系统运维 | `ri:settings-3-line` |
| 农事工具 | `ri:book-open-line` |
| 菜单展开 | `ri:arrow-right-s-line`（旋转90°） |

---

## 3. 菜单配置模板

### 3.1 一级菜单（无子菜单）

```html
<a href="page.html" target="mainFrame" onclick="openPage('page.html','页面标题')" class="flex items-center px-4 py-3 text-sm text-gray-300 hover:bg-white/10 rounded-md transition-all">
    <span class="iconify mr-3 text-lg" data-icon="ri:icon-name"></span>
    <span class="menu-text">页面标题</span>
</a>
```

### 3.2 一级菜单（带子菜单）

```html
<!-- 父菜单 -->
<div class="menu-group">
    <button class="menu-toggle w-full flex items-center justify-between px-4 py-3 text-sm text-gray-300 hover:bg-white/10 rounded-md transition-all">
        <div class="flex items-center">
            <span class="iconify mr-3 text-lg text-gray-300" data-icon="ri:icon-name"></span>
            <span class="menu-text">父菜单名称</span>
        </div>
        <span class="menu-arrow text-gray-400">›</span>
    </button>
    <!-- 子菜单容器，默认隐藏 -->
    <div class="menu-items pl-6" style="display:none;">
        <!-- 子菜单项 -->
        <a href="child1.html" target="mainFrame" onclick="openPage('child1.html','子页面1')" class="flex items-center px-4 py-3 text-sm text-gray-300 hover:bg-white/10 rounded-md transition-all">
            <span class="iconify mr-3 text-lg" data-icon="ri:child-icon1"></span>
            <span>子页面1</span>
        </a>
        <a href="child2.html" target="mainFrame" onclick="openPage('child2.html','子页面2')" class="flex items-center px-4 py-3 text-sm text-gray-300 hover:bg-white/10 rounded-md transition-all">
            <span class="iconify mr-3 text-lg" data-icon="ri:child-icon2"></span>
            <span>子页面2</span>
        </a>
    </div>
</div>
```

---

## 4. Tab 标签页规范

### 4.1 Tab 结构

```html
<div id="tabBar" class="tab-scroll flex items-center gap-1 overflow-x-auto min-w-0">
    <!-- Tab 由 JS 动态生成 -->
</div>
```

### 4.2 Tab 样式

| 状态 | 样式 |
|------|------|
| 默认 | `bg-gray-100 text-gray-600` |
| Hover | `bg-gray-200` |
| Active | `bg-white text-gray-900 border-b-2 border-green-500` |
| 关闭按钮 | 红色圆圈 × 图标 |

### 4.3 Tab 操作

- **打开新页面**：调用 `openPage(url, title)`
- **切换 Tab**：调用 `selectTab(tab)`
- **关闭 Tab**：调用 `closeTab(tab)`
- **自动去重**：已打开的页面不会重复创建 Tab

---

## 5. 内容页面模板

内容页面（如 `home.html`）只需包含业务内容，无需包含侧边栏和顶栏：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>首页</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://code.iconify.design/3/3.1.1/iconify.min.js"></script>
    <style>
        * { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif; }
    </style>
</head>
<body class="bg-[#F0F2F5] p-6">
    <div class="max-w-7xl mx-auto">
        <!-- 页面标题区 -->
        <div class="mb-6">
            <h1 class="text-2xl font-bold text-gray-800">页面标题</h1>
            <p class="text-gray-500 mt-1">页面描述说明</p>
        </div>
        
        <!-- 内容区 -->
        <div class="bg-white rounded-xl shadow-sm p-6">
            <!-- 业务内容 -->
        </div>
    </div>
</body>
</html>
```

---

## 6. 响应式断点

| 屏幕宽度 | 侧边栏行为 |
|----------|-----------|
| ≥1024px | 展开 256px / 可折叠至 64px |
| <1024px | 默认折叠 64px |
| <768px | 隐藏，需点击汉堡菜单唤出 |

---

## 7. 使用示例

### 示例：生成一个设备管理后台原型

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>设备管理系统</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://code.iconify.design/3/3.1.1/iconify.min.js"></script>
    <style>
        * { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif; }
        @keyframes tabSlideIn { from { transform: translateX(-10px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .tab-animate { animation: tabSlideIn 0.2s ease-out; }
        .tab-scroll::-webkit-scrollbar { display: none; }
        .tab-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        .menu-arrow { transition: transform 0.2s ease; display: inline-block; }
        .menu-arrow.expanded { transform: rotate(90deg); }
        .sidebar-nav a.menu-item-active, .sidebar-nav a.menu-item-active:hover {
            background: rgba(34,168,74,0.15) !important;
            color: #22a84a !important;
            border-right: 3px solid #22a84a;
        }
        .sidebar-nav::-webkit-scrollbar { width: 4px; }
        .sidebar-nav::-webkit-scrollbar-track { background: transparent; }
        .sidebar-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
        .sidebar-nav::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.20); }
    </style>
</head>
<body class="h-screen flex overflow-hidden bg-[#F0F2F5]">
    <!-- 侧边栏 -->
    <aside id="sidebar" class="w-64 bg-[#1b2a41] flex flex-col flex-shrink-0 h-screen transition-all duration-300">
        <div class="h-16 flex items-center px-6 gap-3 border-b border-white/10 flex-shrink-0">
            <div class="w-8 h-8 bg-[#22a84a] rounded-lg flex items-center justify-center">
                <span class="iconify text-white text-lg" data-icon="ri:apple-line"></span>
            </div>
            <span id="brandText" class="text-white font-bold text-base whitespace-nowrap">设备管理</span>
        </div>
        <nav class="sidebar-nav flex-1 overflow-y-auto py-4 px-3 space-y-1">
            <a href="device_overview.html" target="mainFrame" onclick="openPage('device_overview.html','设备概览')" class="flex items-center px-4 py-3 text-sm text-gray-300 hover:bg-white/10 rounded-md transition-all">
                <span class="iconify mr-3 text-lg" data-icon="ri:dashboard-3-line"></span><span class="menu-text">设备概览</span>
            </a>
            <div class="menu-group">
                <button class="menu-toggle w-full flex items-center justify-between px-4 py-3 text-sm text-gray-300 hover:bg-white/10 rounded-md transition-all">
                    <div class="flex items-center"><span class="iconify mr-3 text-lg text-gray-300" data-icon="ri:cpu-line"></span><span class="menu-text">设备监控</span></div>
                    <span class="menu-arrow text-gray-400">›</span>
                </button>
                <div class="menu-items pl-6" style="display:none;">
                    <a href="device_camera.html" target="mainFrame" onclick="openPage('device_camera.html','摄像头')" class="flex items-center px-4 py-3 text-sm text-gray-300 hover:bg-white/10 rounded-md transition-all">
                        <span class="iconify mr-3 text-lg" data-icon="ri:camera-line"></span><span>摄像头</span>
                    </a>
                    <a href="device_sensor.html" target="mainFrame" onclick="openPage('device_sensor.html','传感器')" class="flex items-center px-4 py-3 text-sm text-gray-300 hover:bg-white/10 rounded-md transition-all">
                        <span class="iconify mr-3 text-lg" data-icon="ri:temp-hot-line"></span><span>传感器</span>
                    </a>
                    <a href="device_drone.html" target="mainFrame" onclick="openPage('device_drone.html','无人机')" class="flex items-center px-4 py-3 text-sm text-gray-300 hover:bg-white/10 rounded-md transition-all">
                        <span class="iconify mr-3 text-lg" data-icon="ri:plane-line"></span><span>无人机</span>
                    </a>
                </div>
            </div>
        </nav>
    </aside>

    <!-- 主区域 -->
    <div class="flex-1 flex flex-col min-w-0 h-screen">
        <header class="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
            <div class="flex items-center gap-2 flex-1 min-w-0">
                <button id="sidebarToggle" class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
                    <span class="iconify text-xl" data-icon="ri:menu-fold-line"></span>
                </button>
                <div id="tabBar" class="tab-scroll flex items-center gap-1 overflow-x-auto min-w-0"></div>
            </div>
            <div class="flex items-center gap-4 flex-shrink-0 ml-4">
                <button class="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
                    <span class="iconify text-xl" data-icon="ri:notification-3-line"></span>
                    <span class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
                <div class="h-6 w-px bg-gray-200"></div>
                <div class="relative">
                    <div id="adminDropdown" class="flex items-center gap-3 cursor-pointer hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">
                        <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <span class="text-green-600 text-sm font-bold">管</span>
                        </div>
                        <span class="text-sm text-gray-700">管理员</span>
                        <span class="iconify text-gray-400" data-icon="ri:arrow-down-s-line"></span>
                    </div>
                    <div id="adminMenu" class="hidden absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                        <a href="javascript:void(0)" class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                            <span class="iconify mr-2 text-gray-400" data-icon="ri:user-line"></span>个人信息
                        </a>
                        <a href="javascript:void(0)" class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                            <span class="iconify mr-2 text-gray-400" data-icon="ri:lock-line"></span>修改密码
                        </a>
                        <div class="h-px bg-gray-100 my-1"></div>
                        <a href="login.html" class="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                            <span class="iconify mr-2" data-icon="ri:logout-circle-line"></span>退出登录
                        </a>
                    </div>
                </div>
            </div>
        </header>
        <main class="flex-1 overflow-hidden bg-[#F0F2F5]">
            <iframe name="mainFrame" id="mainFrame" src="device_overview.html" class="w-full h-full border-none"></iframe>
        </main>
    </div>

    <script>
        document.querySelectorAll('.menu-toggle').forEach(toggle => {
            toggle.addEventListener('click', function() {
                const menuItems = this.nextElementSibling;
                const arrow = this.querySelector('.menu-arrow');
                if (menuItems.style.display === 'none' || menuItems.style.display === '') {
                    menuItems.style.display = 'block';
                    arrow.classList.add('expanded');
                } else {
                    menuItems.style.display = 'none';
                    arrow.classList.remove('expanded');
                }
            });
        });
        const tabs = [];
        const tabBar = document.getElementById('tabBar');
        const mainFrame = document.getElementById('mainFrame');
        function openPage(url, title) {
            const existingTab = tabs.find(tab => tab.url === url);
            if (existingTab) { selectTab(existingTab); return; }
            const newTab = { id: Date.now(), url: url, title: title, element: null };
            const tabElement = document.createElement('div');
            tabElement.className = 'flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-600 rounded-t-md cursor-pointer hover:bg-gray-200 transition-colors tab-animate';
            tabElement.innerHTML = '<span class="text-sm whitespace-nowrap">' + title + '</span><button class="tab-close ml-1 p-0.5 hover:bg-black/10 rounded transition-colors"><span class="iconify text-xs" data-icon="ri:close-line"></span></button>';
            tabElement.dataset.tabId = newTab.id;
            tabElement.addEventListener('click', (e) => { if (!e.target.closest('.tab-close')) selectTab(newTab); });
            tabElement.querySelector('.tab-close').addEventListener('click', (e) => { e.stopPropagation(); closeTab(newTab); });
            tabBar.appendChild(tabElement);
            newTab.element = tabElement;
            tabs.push(newTab);
            selectTab(newTab);
            mainFrame.src = url;
            highlightMenu(url);
        }
        function selectTab(tab) {
            tabs.forEach(t => { t.element.classList.remove('bg-white', 'text-gray-900', 'border-b-2', 'border-green-500'); t.element.classList.add('bg-gray-100', 'text-gray-600'); });
            tab.element.classList.remove('bg-gray-100', 'text-gray-600');
            tab.element.classList.add('bg-white', 'text-gray-900', 'border-b-2', 'border-green-500');
        }
        function closeTab(tab) {
            const index = tabs.indexOf(tab);
            if (index === -1) return;
            tab.element.remove();
            tabs.splice(index, 1);
            if (tabs.length > 0) { const newIndex = index > 0 ? index - 1 : 0; selectTab(tabs[newIndex]); mainFrame.src = tabs[newIndex].url; highlightMenu(tabs[newIndex].url); }
        }
        function highlightMenu(url) {
            document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('menu-item-active'));
            const target = document.querySelector('.sidebar-nav a[href="' + url + '"]');
            if (target) { target.classList.add('menu-item-active'); const parentItems = target.closest('.menu-items'); if (parentItems && parentItems.style.display === 'none') { parentItems.style.display = 'block'; const toggle = parentItems.previousElementSibling; if (toggle) { const arrow = toggle.querySelector('.menu-arrow'); if (arrow) arrow.classList.add('expanded'); } } }
        }
        const adminDropdown = document.getElementById('adminDropdown');
        const adminMenu = document.getElementById('adminMenu');
        adminDropdown.addEventListener('click', () => { adminMenu.classList.toggle('hidden'); });
        document.addEventListener('click', (e) => { if (!adminDropdown.contains(e.target)) adminMenu.classList.add('hidden'); });
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        const brandText = document.getElementById('brandText');
        let sidebarCollapsed = false;
        sidebarToggle.addEventListener('click', () => {
            sidebarCollapsed = !sidebarCollapsed;
            if (sidebarCollapsed) {
                sidebar.classList.remove('w-64'); sidebar.classList.add('w-16'); brandText.style.display = 'none';
                document.querySelectorAll('.menu-text, .menu-arrow').forEach(el => el.style.display = 'none');
                document.querySelectorAll('.menu-items').forEach(item => item.style.display = 'none');
                sidebarToggle.querySelector('.iconify').setAttribute('data-icon', 'ri:menu-unfold-line');
            } else {
                sidebar.classList.remove('w-16'); sidebar.classList.add('w-64'); brandText.style.display = '';
                document.querySelectorAll('.menu-text, .menu-arrow').forEach(el => el.style.display = '');
                sidebarToggle.querySelector('.iconify').setAttribute('data-icon', 'ri:menu-fold-line');
            }
        });
        openPage('device_overview.html', '设备概览');
    </script>
</body>
</html>
```

---

## 8. 注意事项

1. **Tab 数量限制**：建议不超过 15 个Tab，超出后应关闭最早的非活跃Tab
2. **iframe 命名**：所有菜单链接的 `target` 必须为 `mainFrame`，且 `onclick` 调用 `openPage(url, title)`
3. **图标引用**：使用 [Iconify 图标库](https://icon-sets.iconify.design/)，以 `ri:` 前缀开头
4. **侧边栏折叠**：折叠时保留图标，隐藏文字，子菜单自动隐藏
5. **内容页面**：iframe 内嵌的页面只需包含业务内容，无需完整 HTML 结构
