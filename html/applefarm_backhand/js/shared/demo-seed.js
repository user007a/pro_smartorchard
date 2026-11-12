/**
 * 后台演示数据播种器（Demo Seed）
 * --------------------------------------------------------------
 * 【严格空库模式】演示数据播种已彻底停用。
 * 交付前的业务驱动测试基于空数据库进行，所有页面数据必须严格来自
 * 后端真实 API，禁止任何本地演示数据 / 假数据兜底，也不再向
 * localStorage 写入任何业务数据。
 *
 * 本文件仅保留全局 DemoSeed 对象及原有 API 签名（ensure / clear /
 * version / _scenes），所有方法均为空操作（no-op）：
 *   - ensure(keys)  直接返回，不播种、不写任何存储键；
 *   - clear()       直接返回，不做任何清除；
 *   - version       标记为 disabled。
 * 保留空壳仅为兼容历史页面里对 DemoSeed 的引用，避免脚本报错。
 */

(function (global) {
  'use strict';

  // 严格空库模式：所有方法均为空操作，不写数据、不做播种
  function noop() {}

  global.DemoSeed = {
    VERSION: 'disabled',
    version: 'disabled',
    ensure: noop,
    clear: noop,
    _scenes: []
  };
})(window);
