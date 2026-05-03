(function () {
  var typingTimer = null;
  var typingToken = 0;
  var confirmHandler = null;
  var backHandler = null;
  var dismissHandler = null;
  var lastPayload = null;
  var MASCOT_ASSET_VERSION = '20260430q';
  var dockImage = 'assets/mascot/mascot-dock.png?v=' + MASCOT_ASSET_VERSION;

  var DEFAULT_IMAGES = {
    success: 'assets/mascot/mascot-success.png?v=' + MASCOT_ASSET_VERSION,
    caution: 'assets/mascot/mascot-caution.png?v=' + MASCOT_ASSET_VERSION,
    welcome: 'assets/mascot/mascot-welcome.png?v=' + MASCOT_ASSET_VERSION,
    info: 'assets/mascot/mascot-info.png?v=' + MASCOT_ASSET_VERSION,
    /* 클리어 후 돌아갈까 대화: 도크와 동일 눈웃음 일러스트 */
    wink: 'assets/mascot/mascot-dock.png?v=' + MASCOT_ASSET_VERSION,
  };

  var FALLBACK_EMOJI = {
    success: '✨',
    caution: '⚠️',
    welcome: '👋',
    info: '💡',
    wink: '😉',
  };

  function innerCloseCoach() {
    var root = document.getElementById('mascotCoach');
    var dock = document.getElementById('mascotCoachDock');
    var dh = dismissHandler;
    dismissHandler = null;
    confirmHandler = null;
    backHandler = null;
    if (root) {
      root.classList.remove('is-open');
      root.classList.remove('mascot-coach--spotlight');
    }
    document.body.classList.remove('mascot-coach-spotlight-dim');
    if (dock) dock.style.display = '';
    var backBtn = document.getElementById('mascotCoachBack');
    if (backBtn) {
      backBtn.className = 'tutorial-btn-ghost mascot-coach-back';
      backBtn.innerHTML = '';
      backBtn.style.display = 'none';
      backBtn.setAttribute('aria-hidden', 'true');
    }
    typingToken += 1;
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
    if (typeof dh === 'function') {
      try {
        dh();
      } catch (e) { /* ignore */ }
    }
  }

  function ensureCoachRoot() {
    var root = document.getElementById('mascotCoach');
    if (root) return root;
    var html =
      '<aside class="mascot-coach" id="mascotCoach" aria-live="polite">' +
      '  <div class="mascot-coach-body">' +
      '    <div class="mascot-coach-image-wrap" id="mascotCoachImageWrap">' +
      '      <img id="mascotCoachImage" alt="마스코트" />' +
      '      <span class="mascot-coach-fallback" id="mascotCoachFallback" style="display:none;"></span>' +
      '    </div>' +
      '    <div class="mascot-coach-bubble">' +
      '      <button type="button" class="mascot-coach-close-inline" id="mascotCoachClose" aria-label="닫기">×</button>' +
      '      <div class="mascot-coach-bubble-top">' +
      '        <span class="mascot-coach-name">루미</span>' +
      '        <span class="mascot-coach-badge info" id="mascotCoachBadge">정보/똑똑이</span>' +
      '      </div>' +
      '      <div class="mascot-coach-title" id="mascotCoachTitle">안녕? 반가워! 나는 주린이 가이드 담당 루미야.</div>' +
      '      <div class="mascot-coach-text" id="mascotCoachText">설명을 표시할 수 있어요.</div>' +
      '      <div class="mascot-coach-actions">' +
      '        <button type="button" class="tutorial-btn-ghost mascot-coach-back" id="mascotCoachBack" style="display:none" aria-hidden="true">돌아가기</button>' +
      '        <button type="button" class="tutorial-btn-ghost" id="mascotCoachConfirm">확인</button>' +
      '        <button type="button" class="tutorial-btn-ghost" id="mascotCoachDismiss">닫기</button>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</aside>' +
      '<div class="mascot-coach-dock" id="mascotCoachDock" style="display:none;">' +
      '  <img src="' + dockImage + '" alt="루미" class="mascot-coach-dock-image" />' +
      '  <button type="button" class="mascot-coach-dock-btn" id="mascotCoachDockBtn">루미 대화</button>' +
      '</div>';
    document.body.insertAdjacentHTML('beforeend', html);
    root = document.getElementById('mascotCoach');
    var closeBtn = document.getElementById('mascotCoachClose');
    var dismissBtn = document.getElementById('mascotCoachDismiss');
    var confirmBtn = document.getElementById('mascotCoachConfirm');
    var backBtn = document.getElementById('mascotCoachBack');
    var dock = document.getElementById('mascotCoachDock');
    var dockBtn = document.getElementById('mascotCoachDockBtn');
    if (closeBtn) closeBtn.addEventListener('click', innerCloseCoach);
    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        if (typeof confirmHandler === 'function') {
          confirmHandler();
          return;
        }
        innerCloseCoach();
      });
    }
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        if (typeof backHandler === 'function') {
          backHandler();
          return;
        }
      });
    }
    if (dismissBtn) {
      dismissBtn.addEventListener('click', innerCloseCoach);
    }
    if (dockBtn) {
      dockBtn.addEventListener('click', function () {
        var alt = tryDockReopenPayload();
        if (alt) {
          show(alt, true);
          return;
        }
        if (lastPayload) {
          show(lastPayload, true);
        }
      });
    }
    return root;
  }

  function resolveMood(mood) {
    var m = String(mood || '').toLowerCase();
    if (m === 'success' || m === 'caution' || m === 'welcome' || m === 'info' || m === 'wink') return m;
    return 'info';
  }

  function tryDockReopenPayload() {
    if (typeof window.__mascotDockReopenFilter !== 'function') return null;
    try {
      return window.__mascotDockReopenFilter(lastPayload, true);
    } catch (e) {
      return null;
    }
  }

  function typewrite(textEl, fullText) {
    typingToken += 1;
    var token = typingToken;
    if (!textEl) return;
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
    window.__mascotFullText = fullText;
    textEl.textContent = '';
    var index = 0;
    function tick() {
      if (token !== typingToken) return;
      index += 1;
      textEl.textContent = fullText.slice(0, index);
      if (index < fullText.length) {
        typingTimer = setTimeout(tick, 32);
      } else {
        typingTimer = null;
      }
    }
    tick();
  }

  function show(payload, fromDock) {
    var root = ensureCoachRoot();
    var mood = resolveMood(payload && payload.mood);
    var images = (window.MASCOT_IMAGES && typeof window.MASCOT_IMAGES === 'object')
      ? window.MASCOT_IMAGES
      : DEFAULT_IMAGES;
    var title = (payload && payload.title) ? String(payload.title) : '안녕? 반가워! 나는 주린이 가이드 담당 루미야.';
    var text = (payload && payload.text) ? String(payload.text) : '지금부터 기초적인 시세 보는 법을 같이 알아보자.';
    var imageSrc = images[mood] || DEFAULT_IMAGES[mood];

    var badge = document.getElementById('mascotCoachBadge');
    var titleEl = document.getElementById('mascotCoachTitle');
    var textEl = document.getElementById('mascotCoachText');
    var img = document.getElementById('mascotCoachImage');
    var fallback = document.getElementById('mascotCoachFallback');
    var confirmBtn = document.getElementById('mascotCoachConfirm');
    var backBtn = document.getElementById('mascotCoachBack');
    var dismissBtn = document.getElementById('mascotCoachDismiss');
    var dock = document.getElementById('mascotCoachDock');

    if (payload && payload.layout === 'spotlight') {
      root.classList.add('mascot-coach--spotlight');
      document.body.classList.add('mascot-coach-spotlight-dim');
    } else {
      root.classList.remove('mascot-coach--spotlight');
      document.body.classList.remove('mascot-coach-spotlight-dim');
    }

    if (badge) {
      badge.className = 'mascot-coach-badge ' + mood;
      badge.textContent = {
        success: '성취/이득',
        caution: '주의/위험',
        welcome: '기본/환영',
        info: '정보/똑똑이',
        wink: '응원/눈웃음',
      }[mood];
    }
    if (titleEl) titleEl.textContent = title;
    if (textEl) typewrite(textEl, text);
    lastPayload = payload ? Object.assign({}, payload) : null;
    dismissHandler = (payload && typeof payload.onDismiss === 'function') ? payload.onDismiss : null;
    confirmHandler = (payload && typeof payload.onConfirm === 'function') ? payload.onConfirm : null;
    backHandler = (payload && typeof payload.onBack === 'function') ? payload.onBack : null;
    if (confirmBtn) {
      confirmBtn.textContent = (payload && payload.confirmLabel) ? String(payload.confirmLabel) : '확인';
    }
    if (backBtn) {
      backBtn.className = 'tutorial-btn-ghost mascot-coach-back';
      backBtn.innerHTML = '';
      if (payload && payload.backLabel) {
        backBtn.textContent = String(payload.backLabel);
        backBtn.style.display = '';
        backBtn.setAttribute('aria-hidden', 'false');
      } else {
        backBtn.style.display = 'none';
        backBtn.setAttribute('aria-hidden', 'true');
      }
    }
    if (dismissBtn) {
      dismissBtn.textContent = (payload && payload.dismissLabel) ? String(payload.dismissLabel) : '닫기';
    }

    if (img && fallback) {
      fallback.style.display = 'none';
      img.style.display = '';
      img.onerror = function () {
        img.style.display = 'none';
        fallback.style.display = '';
        fallback.textContent = FALLBACK_EMOJI[mood] || '💡';
      };
      img.src = imageSrc;
    }

    if (dock) dock.style.display = 'none';
    root.classList.add('is-open');
    if (!fromDock) {
      var dockBtn = document.getElementById('mascotCoachDockBtn');
      if (dockBtn) dockBtn.textContent = '루미 대화';
    }
  }

  function hideDock() {
    var dock = document.getElementById('mascotCoachDock');
    if (dock) dock.style.display = 'none';
  }

  window.MascotCoach = {
    show: show,
    reopen: function () {
      var alt = tryDockReopenPayload();
      if (alt) {
        show(alt, true);
        return;
      }
      if (lastPayload) show(lastPayload, true);
    },
    close: innerCloseCoach,
    hideDock: hideDock,
  };
})();
