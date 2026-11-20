/**
 * confirm.js — 跨端统一确认对话框
 * --------------------------------------------------------------
 * 为后台 / 移动端 / H5 三端提供一致的「二次确认」能力，
 * 替代浏览器原生 confirm()（原生弹窗在 iframe 内常被拦截、
 * 无法自定义文案与样式、且移动端体验割裂）。
 *
 * 用法：
 *   Confirm2.ask('确定删除吗？').then(function (ok) { if (!ok) return; ... });
 *   Confirm2.ask('确定删除吗？', { title: '删除确认', danger: true }).then(...)
 *   Confirm2.delete('确定删除「X」吗？').then(...)
 *
 * 挂载点：window.Confirm2（避免与 components/confirm.js 的 Confirm 冲突）。
 */
(function (global) {
  'use strict';

  var host = null;

  function ensureHost() {
    if (host && document.body.contains(host)) return host;
    host = document.createElement('div');
    host.setAttribute('data-confirm2', '1');
    host.style.cssText =
      'position:fixed;inset:0;z-index:100000;display:none;' +
      'align-items:center;justify-content:center;padding:20px;' +
      'background:rgba(0,0,0,.45);backdrop-filter:blur(2px);';
    host.innerHTML =
      '<div class="confirm2-box" style="background:var(--bg-card,#fff);border-radius:14px;' +
      'width:100%;max-width:360px;padding:20px 18px;box-shadow:0 20px 60px rgba(0,0,0,.2);">' +
      '<div class="confirm2-title" style="font-size:15px;font-weight:600;color:var(--text-primary,#1f2e1f);margin-bottom:10px;"></div>' +
      '<div class="confirm2-msg" style="font-size:13px;line-height:1.7;color:var(--text-secondary,#5b6b5b);"></div>' +
      '<div class="confirm2-actions" style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;">' +
      '<button type="button" class="confirm2-btn confirm2-cancel" style="padding:8px 16px;border-radius:8px;' +
      'border:1px solid var(--border-default,#e2e8e5);background:transparent;color:var(--text-secondary,#5b6b5b);' +
      'font-size:13px;cursor:pointer;">取消</button>' +
      '<button type="button" class="confirm2-btn confirm2-ok" style="padding:8px 16px;border-radius:8px;border:none;' +
      'background:var(--primary-500,#1890ff);color:#fff;font-size:13px;cursor:pointer;">确定</button>' +
      '</div></div>';
    (document.body || document.documentElement).appendChild(host);
    return host;
  }

  function ask(message, options) {
    var opts = options || {};
    return new Promise(function (resolve) {
      var el = ensureHost();
      var titleEl = el.querySelector('.confirm2-title');
      var msgEl = el.querySelector('.confirm2-msg');
      var okBtn = el.querySelector('.confirm2-ok');
      var cancelBtn = el.querySelector('.confirm2-cancel');

      titleEl.textContent = opts.title || (opts.danger ? '确认删除' : '确认操作');
      msgEl.textContent = message == null ? '' : String(message);
      okBtn.textContent = opts.confirmText || (opts.danger ? '删除' : '确定');
      okBtn.style.background = opts.danger
        ? 'var(--error,#cf1322)'
        : 'var(--primary-500,#1890ff)';

      function close(result) {
        el.style.display = 'none';
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        el.removeEventListener('click', onOverlay);
        document.removeEventListener('keydown', onKey);
        resolve(result);
      }
      function onOk() { close(true); }
      function onCancel() { close(false); }
      function onOverlay(e) { if (e.target === el) close(false); }
      function onKey(e) { if (e.key === 'Escape') close(false); }

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      el.addEventListener('click', onOverlay);
      document.addEventListener('keydown', onKey);

      el.style.display = 'flex';
      try { okBtn.focus(); } catch (e) { /* ignore */ }
    });
  }

  function del(message, options) {
    var opts = options || {};
    opts.danger = true;
    opts.title = opts.title || '确认删除';
    return ask(message, opts);
  }

  global.Confirm2 = {
    ask: ask,
    delete: del,
    confirm: ask,
    danger: del
  };
})(typeof window !== 'undefined' ? window : globalThis);
