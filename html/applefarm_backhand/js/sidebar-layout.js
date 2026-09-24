/* ============================================
 * 数农智果 - 侧边栏布局交互脚本
 * 包含：SidebarManager + TabManager
 * 无框架依赖，纯原生 JS
 * ============================================ */

/**
 * SVG 图标集合
 * 18×18px, stroke-width:1.5, stroke:currentColor
 */
const MENU_ICONS = {
  home: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5L9 2.5L15 7.5V15C15 15.55 14.55 16 14 16H4C3.45 16 3 15.55 3 15V7.5Z"/><path d="M7 16V10H11V16"/></svg>',
  building: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="2" width="12" height="14" rx="1"/><path d="M6 5H8M10 5H12M6 8H8M10 8H12M6 11H8M10 11H12M7 16V14H11V16"/></svg>',
  sprout: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 16V9"/><path d="M9 9C9 9 9 3 14 3C14 3 14 9 9 9Z"/><path d="M9 12C9 12 9 7 4 7C4 7 4 12 9 12Z"/></svg>',
  package: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2L16 6V12L9 16L2 12V6L9 2Z"/><path d="M9 16V9"/><path d="M16 6L9 9L2 6"/><path d="M2 12L9 9L16 12"/></svg>',
  cpu: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="10" height="10" rx="1"/><rect x="7" y="7" width="4" height="4" rx="0.5"/><path d="M7 4V2M11 4V2M7 14V16M11 14V16M4 7H2M4 11H2M14 7H16M14 11H16"/></svg>',
  plane: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 2L8 10"/><path d="M16 2L11 16L8 10L2 7L16 2Z"/></svg>',
  'alert-triangle': '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5L1.5 14C1.1 14.7 1.6 15.5 2.3 15.5H15.7C16.4 15.5 16.9 14.7 16.5 14L10 2.5C9.6 1.8 8.4 1.8 8 2.5Z"/><path d="M9 7V10"/><circle cx="9" cy="13" r="0.5" fill="currentColor"/></svg>',
  shield: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2L3 5V9C3 13 5.8 15.7 9 16.5C12.2 15.7 15 13 15 9V5L9 2Z"/><path d="M7 9L8.5 10.5L11.5 7.5"/></svg>',
  'shopping-bag': '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6H15V15C15 15.55 14.55 16 14 16H4C3.45 16 3 15.55 3 15V6Z"/><path d="M6 6V4C6 2.9 6.9 2 8 2H10C11.1 2 12 2.9 12 4V6"/></svg>',
  heart: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 15.5C9 15.5 2 11 2 6.5C2 4 4 2 6.5 2C7.9 2 9 2.8 9 2.8C9 2.8 10.1 2 11.5 2C14 2 16 4 16 6.5C16 11 9 15.5 9 15.5Z"/></svg>',
  brain: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2C6.5 2 5 3.5 5 5.5C3.5 5.5 2 6.8 2 8.5C2 10 3 11.2 4.5 11.5C4.2 12.5 4.5 13.5 5 14C5.8 14.8 7 14.8 7.5 14"/><path d="M9 2C11.5 2 13 3.5 13 5.5C14.5 5.5 16 6.8 16 8.5C16 10 15 11.2 13.5 11.5C13.8 12.5 13.5 13.5 13 14C12.2 14.8 11 14.8 10.5 14"/><path d="M9 2V16"/><path d="M7 7H9M9 10H11"/></svg>',
  'trending-up': '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 14L7 9L10 12L16 4"/><path d="M12 4H16V8"/></svg>',
  'bar-chart': '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="10" width="3" height="6" rx="0.5"/><rect x="7.5" y="5" width="3" height="11" rx="0.5"/><rect x="13" y="2" width="3" height="14" rx="0.5"/></svg>',
  'file-text': '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2H11L15 6V15C15 15.55 14.55 16 14 16H5C4.45 16 4 15.55 4 15V3C4 2.45 4.45 2 5 2Z"/><path d="M11 2V6H15"/><path d="M7 9H11M7 12H10"/></svg>',
  award: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="5"/><path d="M6.5 11L5.5 16L9 14L12.5 16L11.5 11"/><path d="M9 5V7L10.5 8"/></svg>',
  clock: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="7"/><path d="M9 5V9L12 11"/></svg>',
  'book-open': '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3C4 2.5 6 2.5 9 4C12 2.5 14 2.5 16 3V14C14 13.5 12 13.5 9 15C6 13.5 4 13.5 2 14V3Z"/><path d="M9 4V15"/></svg>',
  settings: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="2.5"/><path d="M9 2V4M9 14V16M2 9H4M14 9H16M4.2 4.2L5.6 5.6M12.4 12.4L13.8 13.8M13.8 4.2L12.4 5.6M5.6 12.4L4.2 13.8"/></svg>',
  /* 通用图标 */
  chevronRight: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3L9 7L5 11"/></svg>',
  close: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3L11 11M11 3L3 11"/></svg>',
  bell: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2C7 2 5 4.5 5 7.5V12L3 14H17L15 12V7.5C15 4.5 13 2 10 2Z"/><path d="M8.5 16C8.5 17 9.2 18 10 18C10.8 18 11.5 17 11.5 16"/></svg>',
  chevronDown: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5L6 8L9 5"/></svg>',
  homeBreadcrumb: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5.5L7 1.5L12 5.5V12C12 12.55 11.55 13 11 13H3C2.45 13 2 12.55 2 12V5.5Z"/></svg>',
  collapseLeft: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 3L6 9L11 15"/><path d="M14 3V15"/></svg>',
  expandRight: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3L12 9L7 15"/><path d="M4 3V15"/></svg>',
  gear: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2L10 2L10.5 4L12.5 5L14.5 4L15.5 5.5L14 7.2L14.5 9.5L16.5 10V12L14.5 12.5L14 14.5L15.5 16L14.5 17.2L12.5 16.2L10.5 17L10 19H8L7.5 17L5.5 16.2L3.5 17.2L2.5 16L4 14.5L3.5 12.5L1.5 12V10L3.5 9.5L4 7.2L2.5 5.5L3.5 4L5.5 5L7.5 4L8 2Z"/><circle cx="9" cy="10.5" r="2.5"/></svg>',
};

/* ============================================
 * SidebarManager - 侧边栏管理器
 * ============================================ */
class SidebarManager {
  constructor(config) {
    this.menuConfig = config.menuConfig || [];
    this.sidebarEl = null;
    this.menuContainerEl = null;
    this.isCollapsed = false;
    this.isMobileOpen = false;
    this.activeMenuId = config.activeMenuId || 'home';
    this.onMenuSelect = config.onMenuSelect || null;

    /* 构建菜单ID到菜单项的映射 */
    this.menuMap = {};
    this._buildMenuMap(this.menuConfig);
  }

  /** 递归构建菜单映射 */
  _buildMenuMap(items) {
    items.forEach(item => {
      this.menuMap[item.id] = item;
      if (item.children) {
        item.children.forEach(child => {
          this.menuMap[child.id] = { ...child, parentId: item.id };
        });
      }
    });
  }

  /** 初始化侧边栏 */
  init() {
    this.sidebarEl = document.querySelector('.sidebar');
    this.menuContainerEl = document.querySelector('.sidebar-body');

    if (!this.sidebarEl || !this.menuContainerEl) {
      console.warn('SidebarManager: 未找到侧边栏容器元素');
      return;
    }

    this._renderMenu();
    this._bindEvents();
    this._restoreState();
    this._setActive(this.activeMenuId);
  }

  /** 渲染菜单 */
  _renderMenu() {
    let html = '';
    this.menuConfig.forEach(item => {
      if (item.children && item.children.length > 0) {
        html += this._renderMenuItemWithSubmenu(item);
      } else {
        html += this._renderMenuItem(item);
      }
    });
    this.menuContainerEl.innerHTML = html;
  }

  /** 渲染带子菜单的一级菜单项 */
  _renderMenuItemWithSubmenu(item) {
    const isActive = this._isParentActive(item);
    const isExpanded = this._isParentExpanded(item);
    const iconSvg = MENU_ICONS[item.icon] || '';

    return `
      <a class="sidebar-menu-item${isActive ? ' active' : ''}${isExpanded ? ' expanded' : ''}"
         data-id="${item.id}" href="javascript:void(0)" title="${item.label}">
        <span class="menu-icon">${iconSvg}</span>
        <span class="menu-text">${item.label}</span>
        <span class="menu-arrow">${MENU_ICONS.chevronRight}</span>
        <span class="sidebar-tooltip">${item.label}</span>
      </a>
      <div class="sidebar-submenu${isExpanded ? ' open' : ''}" data-parent="${item.id}">
        ${item.children.map(child => this._renderSubmenuItem(child)).join('')}
      </div>
    `;
  }

  /** 渲染无子菜单的一级菜单项 */
  _renderMenuItem(item) {
    const isActive = this.activeMenuId === item.id;
    const iconSvg = MENU_ICONS[item.icon] || '';

    return `
      <a class="sidebar-menu-item${isActive ? ' active' : ''}"
         data-id="${item.id}" href="${item.path || 'javascript:void(0)'}" title="${item.label}">
        <span class="menu-icon">${iconSvg}</span>
        <span class="menu-text">${item.label}</span>
        <span class="sidebar-tooltip">${item.label}</span>
      </a>
    `;
  }

  /** 渲染二级子菜单项 */
  _renderSubmenuItem(item) {
    const isActive = this.activeMenuId === item.id;

    return `
      <a class="sidebar-submenu-item${isActive ? ' active' : ''}"
         data-id="${item.id}" href="${item.path || 'javascript:void(0)'}" title="${item.label}">
        ${item.label}
      </a>
    `;
  }

  /** 绑定事件 */
  _bindEvents() {
    /* 菜单点击 */
    this.menuContainerEl.addEventListener('click', (e) => {
      const menuItem = e.target.closest('.sidebar-menu-item');
      const submenuItem = e.target.closest('.sidebar-submenu-item');

      if (submenuItem) {
        e.preventDefault();
        this._handleSubmenuClick(submenuItem);
      } else if (menuItem) {
        e.preventDefault();
        this._handleMenuClick(menuItem);
      }
    });

    /* 折叠按钮 */
    const collapseBtn = this.sidebarEl.querySelector('.sidebar-collapse-btn');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => this.toggleCollapse());
    }

    /* 移动端遮罩层点击关闭 */
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => this.closeMobile());
    }
  }

  /** 一级菜单点击 */
  _handleMenuClick(el) {
    const id = el.dataset.id;
    const menuData = this.menuMap[id];

    if (!menuData) return;

    if (menuData.children && menuData.children.length > 0) {
      /* 有子菜单：切换展开/折叠 */
      this._toggleSubmenu(id, el);
    } else {
      /* 无子菜单：选中并跳转 */
      this._setActive(id);
      if (this.onMenuSelect) {
        this.onMenuSelect(id, menuData);
      }
    }
  }

  /** 二级子菜单点击 */
  _handleSubmenuClick(el) {
    const id = el.dataset.id;
    const menuData = this.menuMap[id];

    if (!menuData) return;

    this._setActive(id);

    /* 移动端点击后自动关闭侧边栏 */
    if (window.innerWidth < 768) {
      this.closeMobile();
    }

    if (this.onMenuSelect) {
      this.onMenuSelect(id, menuData);
    }
  }

  /** 切换子菜单展开/折叠 */
  _toggleSubmenu(parentId, parentEl) {
    const isExpanded = parentEl.classList.contains('expanded');
    const submenu = this.menuContainerEl.querySelector(`.sidebar-submenu[data-parent="${parentId}"]`);

    if (isExpanded) {
      parentEl.classList.remove('expanded');
      if (submenu) submenu.classList.remove('open');
    } else {
      /* 折叠其他展开的子菜单 */
      this.menuContainerEl.querySelectorAll('.sidebar-menu-item.expanded').forEach(el => {
        if (el.dataset.id !== parentId) {
          el.classList.remove('expanded');
          const sub = this.menuContainerEl.querySelector(`.sidebar-submenu[data-parent="${el.dataset.id}"]`);
          if (sub) sub.classList.remove('open');
        }
      });

      parentEl.classList.add('expanded');
      if (submenu) submenu.classList.add('open');
    }
  }

  /** 设置活跃菜单项 */
  _setActive(id) {
    this.activeMenuId = id;
    const menuData = this.menuMap[id];

    /* 清除所有 active 状态 */
    this.menuContainerEl.querySelectorAll('.sidebar-menu-item.active').forEach(el => el.classList.remove('active'));
    this.menuContainerEl.querySelectorAll('.sidebar-submenu-item.active').forEach(el => el.classList.remove('active'));

    /* 判断是否为子菜单项 */
    if (menuData && menuData.parentId) {
      /* 子菜单项 active */
      const subItem = this.menuContainerEl.querySelector(`.sidebar-submenu-item[data-id="${id}"]`);
      if (subItem) subItem.classList.add('active');

      /* 确保父菜单展开 */
      const parentItem = this.menuContainerEl.querySelector(`.sidebar-menu-item[data-id="${menuData.parentId}"]`);
      const submenu = this.menuContainerEl.querySelector(`.sidebar-submenu[data-parent="${menuData.parentId}"]`);
      if (parentItem && !parentItem.classList.contains('expanded')) {
        /* 折叠其他子菜单 */
        this.menuContainerEl.querySelectorAll('.sidebar-menu-item.expanded').forEach(el => {
          el.classList.remove('expanded');
          const sub = this.menuContainerEl.querySelector(`.sidebar-submenu[data-parent="${el.dataset.id}"]`);
          if (sub) sub.classList.remove('open');
        });
        parentItem.classList.add('expanded');
        if (submenu) submenu.classList.add('open');
      }
    } else {
      /* 一级菜单项 active */
      const menuItem = this.menuContainerEl.querySelector(`.sidebar-menu-item[data-id="${id}"]`);
      if (menuItem) menuItem.classList.add('active');
    }

    /* 滚动到 active 项 */
    this._scrollToActive();

    /* 更新面包屑 */
    this._updateBreadcrumb(id);
  }

  /** 滚动到活跃菜单项 */
  _scrollToActive() {
    const activeEl = this.menuContainerEl.querySelector('.sidebar-submenu-item.active, .sidebar-menu-item.active');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /** 更新面包屑导航 */
  _updateBreadcrumb(id) {
    const breadcrumbEl = document.querySelector('.breadcrumb');
    if (!breadcrumbEl) return;

    const menuData = this.menuMap[id];
    if (!menuData) return;

    let items = [];

    /* 首页始终作为根 */
    items.push({ label: '首页', id: 'home' });

    if (menuData.parentId) {
      const parent = this.menuMap[menuData.parentId];
      if (parent) {
        items.push({ label: parent.label, id: parent.id });
      }
      items.push({ label: menuData.label, id: menuData.id });
    } else if (id !== 'home') {
      items.push({ label: menuData.label, id: menuData.id });
    }

    /* 渲染面包屑 */
    breadcrumbEl.innerHTML = items.map((item, index) => {
      const isLast = index === items.length - 1;
      const sep = isLast ? '' : '<span class="breadcrumb-sep">/</span>';

      if (isLast) {
        return `<span class="breadcrumb-item"><span class="breadcrumb-current">${item.label}</span></span>`;
      } else {
        return `<span class="breadcrumb-item"><a class="breadcrumb-link" data-id="${item.id}" href="javascript:void(0)">${item.label}</a>${sep}</span>`;
      }
    }).join('');

    /* 面包屑点击 */
    breadcrumbEl.querySelectorAll('.breadcrumb-link').forEach(link => {
      link.addEventListener('click', () => {
        const linkId = link.dataset.id;
        const linkData = this.menuMap[linkId];
        if (linkData && this.onMenuSelect) {
          this._setActive(linkId);
          this.onMenuSelect(linkId, linkData);
        }
      });
    });
  }

  /** 判断一级菜单是否有子项处于 active */
  _isParentActive(item) {
    if (!item.children) return false;
    return item.children.some(child => child.id === this.activeMenuId);
  }

  /** 判断一级菜单是否需要展开 */
  _isParentExpanded(item) {
    if (!item.children) return false;
    return item.children.some(child => child.id === this.activeMenuId);
  }

  /** 切换折叠状态 */
  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    this.sidebarEl.classList.toggle('collapsed', this.isCollapsed);

    const mainWrapper = document.querySelector('.main-wrapper');
    if (mainWrapper) {
      mainWrapper.classList.toggle('sidebar-collapsed', this.isCollapsed);
    }

    /* 更新折叠按钮图标 */
    const collapseBtn = this.sidebarEl.querySelector('.sidebar-collapse-btn');
    if (collapseBtn) {
      const iconEl = collapseBtn.querySelector('.collapse-icon');
      if (iconEl) {
        iconEl.innerHTML = this.isCollapsed ? MENU_ICONS.expandRight : MENU_ICONS.collapseLeft;
      }
    }

    /* 持久化折叠状态 */
    localStorage.setItem('sidebar-collapsed', this.isCollapsed ? '1' : '0');
  }

  /** 打开移动端侧边栏 */
  openMobile() {
    this.isMobileOpen = true;
    this.sidebarEl.classList.add('mobile-open');

    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) overlay.classList.add('show');
  }

  /** 关闭移动端侧边栏 */
  closeMobile() {
    this.isMobileOpen = false;
    this.sidebarEl.classList.remove('mobile-open');

    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) overlay.classList.remove('show');
  }

  /** 恢复持久化状态 */
  _restoreState() {
    /* 框架页模式：强制始终展开，不受 localStorage 残留影响 */
    const isFramePage = document.body.hasAttribute('data-frame');
    if (isFramePage) {
      this.isCollapsed = false;
      return;
    }

    /* 普通页：从 localStorage 恢复折叠状态 */
    const collapsed = localStorage.getItem('sidebar-collapsed');
    if (collapsed === '1' && window.innerWidth >= 1024) {
      this.isCollapsed = true;
      this.sidebarEl.classList.add('collapsed');

      const mainWrapper = document.querySelector('.main-wrapper');
      if (mainWrapper) mainWrapper.classList.add('sidebar-collapsed');

      const collapseBtn = this.sidebarEl.querySelector('.sidebar-collapse-btn');
      if (collapseBtn) {
        const iconEl = collapseBtn.querySelector('.collapse-icon');
        if (iconEl) iconEl.innerHTML = MENU_ICONS.expandRight;
      }
    }
  }

  /** 根据URL自动匹配活跃菜单 */
  setActiveByPath(path) {
    for (const [id, item] of Object.entries(this.menuMap)) {
      if (item.path && path.endsWith(item.path)) {
        this._setActive(id);
        return true;
      }
    }
    return false;
  }
}

/* ============================================
 * TabManager - Tab 标签页管理器
 * ============================================ */
class TabManager {
  constructor(config) {
    this.maxTabs = config.maxTabs || 15;
    this.tabBarEl = null;
    this.tabActionsEl = null;
    this.tabs = [];           /* { id, label, path, pinned } */
    this.activeTabId = null;
    this.onTabSwitch = config.onTabSwitch || null;
    this.onTabClose = config.onTabClose || null;
    this.contextMenuEl = null;
    this._contextTabId = null;

    /* 初始化：固定首页标签 */
    this._addPinnedHome();
  }

  /** 添加固定的首页标签 */
  _addPinnedHome() {
    this.tabs = [{
      id: 'home',
      label: '首页',
      path: 'home.html',
      pinned: true
    }];
    this.activeTabId = 'home';
  }

  /** 初始化 Tab 栏 */
  init() {
    this.tabBarEl = document.querySelector('.tab-bar');
    this.tabActionsEl = document.querySelector('.tab-bar-actions');

    if (!this.tabBarEl) {
      console.warn('TabManager: 未找到 Tab 栏容器');
      return;
    }

    this._createContextMenu();
    this._bindEvents();
    this._restoreState();
    this.render();
  }

  /** 创建右键菜单 */
  _createContextMenu() {
    const menu = document.createElement('div');
    menu.className = 'tab-context-menu';
    menu.innerHTML = `
      <div class="ctx-item" data-action="close-others">关闭其他</div>
      <div class="ctx-item" data-action="close-right">关闭右侧</div>
      <div class="ctx-divider"></div>
      <div class="ctx-item" data-action="close-all">关闭全部</div>
      <div class="ctx-item" data-action="refresh">刷新当前</div>
    `;
    document.body.appendChild(menu);
    this.contextMenuEl = menu;

    /* 右键菜单项点击 */
    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.ctx-item');
      if (!item || item.classList.contains('disabled')) return;

      const action = item.dataset.action;
      this._handleContextAction(action);
      this._hideContextMenu();
    });

    /* 点击其他区域关闭右键菜单 */
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target)) {
        this._hideContextMenu();
      }
    });
  }

  /** 绑定事件 */
  _bindEvents() {
    /* Tab 点击事件代理 */
    this.tabBarEl.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('.tab-tag-close');
      const tabTag = e.target.closest('.tab-tag');

      if (closeBtn) {
        e.stopPropagation();
        const tabId = closeBtn.closest('.tab-tag').dataset.id;
        this.closeTab(tabId);
      } else if (tabTag) {
        this.switchTab(tabTag.dataset.id);
      }
    });

    /* Tab 右键菜单 */
    this.tabBarEl.addEventListener('contextmenu', (e) => {
      const tabTag = e.target.closest('.tab-tag');
      if (tabTag) {
        e.preventDefault();
        this._showContextMenu(e, tabTag.dataset.id);
      }
    });

    /* 关闭全部按钮 */
    const closeAllBtn = this.tabActionsEl?.querySelector('.tab-close-all');
    if (closeAllBtn) {
      closeAllBtn.addEventListener('click', () => {
        this.closeAll();
      });
    }
  }

  /** 新增标签页 */
  addTab(id, label, path) {
    /* 如果已存在，直接切换 */
    const existing = this.tabs.find(t => t.id === id);
    if (existing) {
      this.switchTab(id);
      return;
    }

    /* 检查上限 */
    if (this.tabs.length >= this.maxTabs) {
      this._autoCloseOldest();
    }

    this.tabs.push({ id, label, path, pinned: false });
    this.switchTab(id);
    this._saveState();
  }

  /** 切换标签页 */
  switchTab(id) {
    const tab = this.tabs.find(t => t.id === id);
    if (!tab) return;

    this.activeTabId = id;
    this.render();

    if (this.onTabSwitch) {
      this.onTabSwitch(id, tab);
    }

    this._saveState();
  }

  /** 关闭标签页 */
  closeTab(id) {
    const tab = this.tabs.find(t => t.id === id);
    if (!tab || tab.pinned) return;

    const index = this.tabs.indexOf(tab);
    this.tabs.splice(index, 1);

    /* 如果关闭的是当前活跃标签，切换到相邻标签 */
    if (this.activeTabId === id) {
      const newIndex = Math.min(index, this.tabs.length - 1);
      this.activeTabId = this.tabs[newIndex]?.id || 'home';
    }

    this.render();
    this._saveState();

    if (this.onTabClose) {
      this.onTabClose(id, tab);
    }
  }

  /** 关闭其他标签 */
  closeOthers(keepId) {
    const targetId = keepId || this.activeTabId;
    this.tabs = this.tabs.filter(t => t.pinned || t.id === targetId);

    if (!this.tabs.find(t => t.id === this.activeTabId)) {
      this.activeTabId = targetId;
    }

    this.render();
    this._saveState();
  }

  /** 关闭右侧标签 */
  closeRight(id) {
    const targetId = id || this.activeTabId;
    const index = this.tabs.findIndex(t => t.id === targetId);
    if (index === -1) return;

    this.tabs = this.tabs.filter((t, i) => i <= index || t.pinned);

    if (!this.tabs.find(t => t.id === this.activeTabId)) {
      this.activeTabId = targetId;
    }

    this.render();
    this._saveState();
  }

  /** 关闭全部标签（保留固定） */
  closeAll() {
    this.tabs = this.tabs.filter(t => t.pinned);
    this.activeTabId = 'home';
    this.render();
    this._saveState();
  }

  /** 自动关闭最早的非活跃非固定标签 */
  _autoCloseOldest() {
    const closable = this.tabs.filter(t => !t.pinned && t.id !== this.activeTabId);
    if (closable.length > 0) {
      const idx = this.tabs.indexOf(closable[0]);
      this.tabs.splice(idx, 1);
    }
  }

  /** 渲染标签页 */
  render() {
    if (!this.tabBarEl) return;

    /* 保留操作区 */
    const actions = this.tabBarEl.querySelector('.tab-bar-actions');

    let html = '';
    this.tabs.forEach(tab => {
      const isActive = tab.id === this.activeTabId;
      html += `
        <div class="tab-tag${isActive ? ' active' : ''}${tab.pinned ? ' pinned' : ''}"
             data-id="${tab.id}" title="${tab.label}">
          <span class="tab-tag-label">${tab.label}</span>
          ${!tab.pinned ? `<span class="tab-tag-close">${MENU_ICONS.close}</span>` : ''}
        </div>
      `;
    });

    if (actions) {
      this.tabBarEl.innerHTML = html;
      this.tabBarEl.appendChild(actions);
    } else {
      this.tabBarEl.innerHTML = html + `
        <div class="tab-bar-actions">
          <button class="tab-close-all" title="关闭全部">${MENU_ICONS.close}</button>
        </div>
      `;
    }
  }

  /** 显示右键菜单 */
  _showContextMenu(e, tabId) {
    this._contextTabId = tabId;
    const menu = this.contextMenuEl;

    /* 禁用项处理 */
    const tab = this.tabs.find(t => t.id === tabId);
    const closeOthersItem = menu.querySelector('[data-action="close-others"]');
    const closeRightItem = menu.querySelector('[data-action="close-right"]');

    const tabIndex = this.tabs.indexOf(tab);
    const rightTabs = this.tabs.filter((t, i) => i > tabIndex && !t.pinned);

    closeOthersItem.classList.toggle('disabled', this.tabs.filter(t => !t.pinned).length <= 1);
    closeRightItem.classList.toggle('disabled', rightTabs.length === 0);

    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.classList.add('show');

    /* 边界检测 */
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
      }
      if (rect.bottom > window.innerHeight) {
        menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
      }
    });
  }

  /** 隐藏右键菜单 */
  _hideContextMenu() {
    if (this.contextMenuEl) {
      this.contextMenuEl.classList.remove('show');
    }
  }

  /** 处理右键菜单操作 */
  _handleContextAction(action) {
    switch (action) {
      case 'close-others':
        this.closeOthers(this._contextTabId);
        break;
      case 'close-right':
        this.closeRight(this._contextTabId);
        break;
      case 'close-all':
        this.closeAll();
        break;
      case 'refresh':
        /* 刷新当前标签对应的 iframe 或内容 */
        if (this.onTabSwitch) {
          const tab = this.tabs.find(t => t.id === this._contextTabId);
          if (tab) this.onTabSwitch(tab.id, tab);
        }
        break;
    }
  }

  /** 持久化标签页状态 */
  _saveState() {
    const state = {
      tabs: this.tabs.map(t => ({ id: t.id, label: t.label, path: t.path, pinned: t.pinned })),
      activeTabId: this.activeTabId
    };
    localStorage.setItem('sidebar-tabs', JSON.stringify(state));
  }

  /** 恢复标签页状态 */
  _restoreState() {
    try {
      const saved = localStorage.getItem('sidebar-tabs');
      if (saved) {
        const state = JSON.parse(saved);
        if (state.tabs && state.tabs.length > 0) {
          /* 确保首页标签始终存在 */
          const hasHome = state.tabs.some(t => t.id === 'home');
          if (!hasHome) {
            state.tabs.unshift({ id: 'home', label: '首页', path: 'home.html', pinned: true });
          }
          this.tabs = state.tabs;
          this.activeTabId = state.activeTabId || 'home';
        }
      }
    } catch (e) {
      console.warn('TabManager: 恢复标签页状态失败', e);
    }
  }
}

/* ============================================
 * 初始化逻辑
 * ============================================ */

/* 菜单配置数据 */
const MENU_CONFIG = [
  { id: 'home', icon: 'home', label: '首页', path: 'home.html' },

  { id: 'production', icon: 'sprout', label: '生产管理', children: [
    { id: 'farming-plan', label: '农事计划', path: 'farming_plan.html' },
    { id: 'farming-record', label: '农事记录', path: 'farming_record.html' },
    { id: 'farming-patrol', label: '巡园管理', path: 'farming_patrol.html' },
    { id: 'drone-patrol', label: '无人机巡检', path: 'drone_patrol.html' },
    { id: 'guide-standard', label: '农事标准', path: 'guide_standard.html' },
  ]},

  { id: 'harvest', icon: 'shopping-bag', label: '采收管理', children: [
    { id: 'harvest-plan', label: '采收计划', path: 'harvest_plan.html' },
    { id: 'harvest-record', label: '采收记录', path: 'harvest_record.html' },
    { id: 'harvest-process', label: '采后处理', path: 'harvest_process.html' },
    { id: 'harvest-post', label: '采收发货', path: 'harvest_post.html' },
    { id: 'harvest-storage', label: '储藏管理', path: 'harvest_storage.html' },
  ]},

  { id: 'material', icon: 'package', label: '物资管理', children: [
    { id: 'material-info', label: '农资信息', path: 'material_info.html' },
    { id: 'material-inventory', label: '农资库存', path: 'material_inventory.html' },
    { id: 'material-io', label: '农资出入库', path: 'material_io.html' },
    { id: 'material-return', label: '农资退货', path: 'material_return.html' },
    { id: 'material-supplier', label: '农资供应商', path: 'material_supplier.html' },
    { id: 'material-usage', label: '农资使用', path: 'material_usage.html' },
  ]},

  { id: 'device', icon: 'cpu', label: '设备管理', children: [
    { id: 'device-info', label: '设备信息', path: 'device_info.html' },
    { id: 'device-log', label: '设备日志', path: 'device_log.html' },
    { id: 'device-maintain', label: '设备维护', path: 'device_maintain.html' },
  ]},

  { id: 'alert', icon: 'alert-triangle', label: '预警管理', children: [
    { id: 'alert-overview', label: '预警总览', path: 'alert_overview.html' },
    { id: 'alert-device', label: '设备预警', path: 'alert_device.html' },
    { id: 'alert-farming', label: '农事预警', path: 'alert_farming.html' },
    { id: 'alert-internal', label: '内部报告', path: 'alert_internal_report.html' },
    { id: 'alert-settings', label: '预警设置', path: 'alert_settings.html' },
  ]},

  { id: 'trace', icon: 'shield', label: '溯源管理', children: [
    { id: 'trace-batch', label: '批次管理', path: 'trace_batch.html' },
    { id: 'trace-code', label: '溯源编码', path: 'trace_code.html' },
    { id: 'trace-query', label: '溯源查询', path: 'trace_query.html' },
    { id: 'trace-blockchain', label: '溯源区块链', path: 'trace_blockchain.html' },
    { id: 'trace-config', label: '溯源配置', path: 'trace_config.html' },
  ]},

  { id: 'sales', icon: 'trending-up', label: '销售运营', children: [
    { id: 'adoption-tree', label: '认养树木', path: 'adoption_tree.html' },
    { id: 'adoption-farming', label: '认养农事', path: 'adoption_farming.html' },
    { id: 'adoption-harvest', label: '认养采收', path: 'adoption_harvest.html' },
    { id: 'adoption-order', label: '认养订单', path: 'adoption_order.html' },
    { id: 'sales-order', label: '销售订单', path: 'sales_order.html' },
    { id: 'sales-customer', label: '客户管理', path: 'sales_customer.html' },
    { id: 'sales-statistics', label: '销售统计', path: 'sales_statistics.html' },
  ]},

  { id: 'model', icon: 'brain', label: 'AI模型', children: [
    { id: 'model-config', label: '模型配置', path: 'model_config.html' },
    { id: 'model-growth', label: '生长模型', path: 'model_growth.html' },
    { id: 'model-pest', label: '病虫害模型', path: 'model_pest.html' },
    { id: 'model-phenology', label: '物候模型', path: 'model_phenology.html' },
    { id: 'model-price', label: '价格模型', path: 'model_price.html' },
    { id: 'model-weather', label: '气象模型', path: 'model_weather.html' },
    { id: 'model-yield', label: '产量模型', path: 'model_yield.html' },
  ]},

  { id: 'report', icon: 'bar-chart', label: '报表统计', children: [
    { id: 'report-overview', label: '报表总览', path: 'report_overview.html' },
    { id: 'report-cost', label: '成本报表', path: 'report_cost.html' },
    { id: 'report-revenue', label: '营收报表', path: 'report_revenue.html' },
    { id: 'report-profit', label: '利润报表', path: 'report_profit.html' },
    { id: 'performance-dashboard', label: '绩效看板', path: 'performance_dashboard.html' },
    { id: 'performance-detail', label: '绩效详情', path: 'performance_detail.html' },
  ]},

  { id: 'enterprise', icon: 'building', label: '企业管理', children: [
    { id: 'enterprise-base', label: '企业基本信息', path: 'enterprise_base.html' },
    { id: 'enterprise-plot', label: '地块管理', path: 'enterprise_plot.html' },
    { id: 'vr-panorama', label: 'VR全景', path: 'vr_panorama.html' },
    { id: 'cert-manage', label: '证书管理', path: 'cert_manage.html' },
    { id: 'cert-issue', label: '农产品合格证', path: 'cert_issue.html' },
  ]},

  { id: 'system', icon: 'settings', label: '系统运维', children: [
    { id: 'system-settings', label: '系统设置', path: 'system_settings.html' },
    { id: 'user-settings', label: '用户设置', path: 'user_settings.html' },
    { id: 'task-assign', label: '任务分配', path: 'task_assign.html' },
  ]},

  { id: 'tools', icon: 'book-open', label: '农事工具', children: [
    { id: 'guide-calculator', label: '农事计算器', path: 'guide_calculator.html' },
  ]},
];

/* 全局实例 */
let sidebarManager = null;
let tabManager = null;

/** DOMContentLoaded 自动初始化 */
document.addEventListener('DOMContentLoaded', () => {
  /* 检测是否在 iframe 中（子页面被嵌入时，不初始化任何东西） */
  if (window.self !== window.top) {
    return;
  }

  const isFramePage = document.body.hasAttribute('data-frame');

  /* 初始化侧边栏 */
  let onMenuSelect;
  if (isFramePage) {
    onMenuSelect = (id, menuData) => {
      /* 框架页：通过 iframe 加载页面 + 同步 Tab */
      const iframe = document.getElementById('mainFrame');
      if (iframe && menuData.path) {
        iframe.src = menuData.path;
      }
      if (typeof window.syncTab === 'function') {
        window.syncTab(menuData.path || '', menuData.label || '');
      }
    };
  } else {
    onMenuSelect = (id, menuData) => {
      /* 普通页：同步 Tab 栏 + 页面导航 */
      if (tabManager) {
        const label = menuData.label;
        const path = menuData.path || '';
        tabManager.addTab(id, label, path);
      }
      if (menuData.path) {
        const currentPage = window.location.pathname.split('/').pop() || '';
        if (currentPage !== menuData.path) {
          window.location.href = menuData.path;
          return;
        }
      }
      const contentTitle = document.querySelector('.main-content .page-title');
      if (contentTitle) {
        contentTitle.textContent = menuData.label;
      }
    };
  }

  sidebarManager = new SidebarManager({
    menuConfig: MENU_CONFIG,
    activeMenuId: 'home',
    onMenuSelect: onMenuSelect,
  });
  sidebarManager.init();

  /* Tab 标签栏已按需求移除（2026-09-22）：不再初始化 TabManager，
     页面顶部不再加载与显示多标签导航。侧边栏为唯一导航入口。
     .tab-bar 容器由 sidebar-layout.css 统一 display:none 隐藏。 */

  /* 根据当前 URL 路径自动匹配菜单 */
  const currentPath = window.location.pathname;
  sidebarManager.setActiveByPath(currentPath);

  /* 移动端汉堡菜单 */
  const hamburgerBtn = document.querySelector('.topbar-hamburger');
  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', () => {
      if (sidebarManager) {
        if (sidebarManager.isMobileOpen) {
          sidebarManager.closeMobile();
        } else {
          sidebarManager.openMobile();
        }
      }
    });
  }

  /* 系统设置按钮事件 */
  const btnSettings = document.getElementById('btn-settings');
  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      if (sidebarManager) {
        sidebarManager._setActive('system-settings');
        if (tabManager) {
          tabManager.addTab('system-settings', '系统设置', 'system_settings.html');
        }
      }
    });
  }

  /* 用户下拉菜单 */
  const userBtn = document.querySelector('.topbar-user');
  const userDropdown = document.querySelector('.topbar-user-dropdown');
  if (userBtn && userDropdown) {
    userBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!userDropdown.contains(e.target)) {
        userDropdown.classList.remove('show');
      }
    });
  }

  /* 窗口 resize 时，平板/桌面切换重置移动端状态 */
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768 && sidebarManager) {
      sidebarManager.closeMobile();
    }
  });
});

/* 已通过质量审查（第2轮修正）- 严过审 2026-09-18 */
