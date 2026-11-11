/*!
 * h5-back.js — H5 消费者端统一「返回上一级」导航
 *
 * 用法：
 *   <script src="js/h5-back.js"></script>
 *   <body>
 *     <div class="mb-app">
 *       <div class="mb-back-bar">
 *         <button class="mb-back-arrow" type="button" onclick="H5Back.go('h5_member.html')">…</button>
 *         <div class="mb-back-title">页面标题</div>
 *       </div>
 *       …
 *     </div>
 *
 * H5Back.go(fallback)：
 *   - 由站内其他页面跳转而来时 history.back()；
 *   - 直接打开（无来路）时跳转 fallback（默认 h5_member.html「我的」）。
 */
(function (global) {
  'use strict';

  var DEFAULT_FALLBACK = 'h5_member.html';

  function sameOrigin(url) {
    try {
      var target = new URL(url, global.location.href);
      var here = global.location;
      if (target.protocol === 'file:' && here.protocol === 'file:') return true;
      return target.protocol === here.protocol && target.host === here.host;
    } catch (e) {
      return false;
    }
  }

  function go(fallback) {
    var target = fallback || DEFAULT_FALLBACK;
    var referrer = document.referrer;
    var canGoBack = referrer && sameOrigin(referrer) && global.history && global.history.length > 1;

    if (canGoBack) {
      global.history.back();
    } else {
      global.location.href = target;
    }
  }

  global.H5Back = {
    go: go,
    DEFAULT_FALLBACK: DEFAULT_FALLBACK
  };
})(window);
