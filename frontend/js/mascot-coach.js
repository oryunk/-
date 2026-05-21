/**
 * 파일: 루미 마스코트 코치(모달·도크·튜토리얼 연동)
 * 설명( 여러 페이지에서 로드. Dock 필터 체인으로 튜토리얼 완료 문구를 우선한다. )
 */
(function () {
  var typingTimer = null;
  var typingToken = 0;
  var confirmHandler = null;
  var backHandler = null;
  var dismissHandler = null;
  var lastPayload = null;
  /** ×로 최소화 후 「루미 대화」 복원용 — ephemeral(잘못 클릭 caution 등)은 덮어쓰지 않음 */
  var lastDockPayload = null;

  /** 도크 재오픈 시 여러 모듈이 덮어쓰지 않도록 우선순위 체인 (숫자 클수록 먼저 시도) */
  var dockFilterEntries = [];
  var DOCK_TUTORIAL_MASK_KEY = 'jurinGuideTutorialBits';
  var GUIDE_LUMI_SESSION_KEY = 'jurin:guide-lumi-session';

  function isGuideLumiSession() {
    if (/guide\.html/i.test(window.location.pathname || '')) return true;
    try {
      if (sessionStorage.getItem(GUIDE_LUMI_SESSION_KEY) === '1') return true;
    } catch (e) { /* ignore */ }
    return isTutorialSessionActive();
  }

  function startGuideLumiSession() {
    try {
      sessionStorage.setItem(GUIDE_LUMI_SESSION_KEY, '1');
    } catch (e) { /* ignore */ }
    document.body.classList.add('guide-lumi-session');
  }

  function endGuideLumiSession() {
    try {
      sessionStorage.removeItem(GUIDE_LUMI_SESSION_KEY);
    } catch (e) { /* ignore */ }
    document.body.classList.remove('guide-lumi-session');
  }

  function syncGuideDockLabel() {
    var dockBtn = document.getElementById('mascotCoachDockBtn');
    if (!dockBtn) return;
    dockBtn.textContent = '루미 대화';
  }

  if (isGuideLumiSession()) {
    document.body.classList.add('guide-lumi-session');
  }

  function registerDockFilter(id, fn, priority) {
    if (!id || typeof fn !== 'function') return;
    var p = typeof priority === 'number' ? priority : 0;
    unregisterDockFilter(id);
    dockFilterEntries.push({ id: String(id), fn: fn, priority: p });
  }

  function unregisterDockFilter(id) {
    if (!id) return;
    var s = String(id);
    dockFilterEntries = dockFilterEntries.filter(function (e) {
      return e.id !== s;
    });
  }

  function tryDockFiltersChained(lastPl, fromDock) {
    if (!fromDock) return null;
    var list = dockFilterEntries.slice().sort(function (a, b) {
      return b.priority - a.priority;
    });
    for (var i = 0; i < list.length; i++) {
      try {
        var r = list[i].fn(lastPl, fromDock);
        if (r != null) return r;
      } catch (e) { /* ignore */ }
    }
    return null;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatCoachHtml(text) {
    var raw = String(text || '');
    var parts = raw.split(/(\*\*[^*]+\*\*)/g);
    var html = '';
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.indexOf('**') === 0 && p.lastIndexOf('**') === p.length - 2 && p.length > 4) {
        html +=
          '<strong class="mascot-coach-kw">' +
          escapeHtml(p.slice(2, -2)) +
          '</strong>';
      } else {
        html += escapeHtml(p);
      }
    }
    return html.replace(/\n/g, '<br />');
  }

  function coachPlainText(text) {
    return String(text || '').replace(/\*\*/g, '');
  }

  function isTutorialSessionActive() {
    if (typeof window.__jurinGuideQuit === 'function') return true;
    if (
      document.body.classList.contains('market-step1-active') ||
      document.body.classList.contains('market-step2-active') ||
      document.body.classList.contains('market-step3-active') ||
      document.body.classList.contains('simulation-step5-active') ||
      document.body.classList.contains('tutorial-step1-active')
    ) {
      return true;
    }
    try {
      var params = new URLSearchParams(window.location.search);
      var t = (params.get('tutorial') || '').trim().toLowerCase();
      if (
        t === 'step1' ||
        t === '1' ||
        t === 'step2' ||
        t === '2' ||
        t === 'step3' ||
        t === '3' ||
        t === 'step5' ||
        t === '5'
      ) {
        return true;
      }
    } catch (e) { /* ignore */ }
    var o1 = document.getElementById('marketStep1Overlay');
    var o2 = document.getElementById('marketStep2Overlay');
    var o3 = document.getElementById('marketStep3Overlay');
    var o5 = document.getElementById('simStep5Overlay');
    var homeOv = document.getElementById('tutorialOverlay');
    if (o1 && o1.classList.contains('is-open')) return true;
    if (o2 && o2.classList.contains('is-open')) return true;
    if (o3 && o3.classList.contains('is-open')) return true;
    if (o5 && o5.classList.contains('is-open')) return true;
    if (homeOv && homeOv.classList.contains('is-open')) return true;
    return false;
  }

  function registerDefaultMarketDockCompletion() {
    registerDockFilter(
      'jurin-market-tutorial-completion',
      function (lastPl, fromDock) {
        if (!fromDock) return null;
        if (isTutorialSessionActive()) return null;
        var m = 0;
        try {
          m = parseInt(localStorage.getItem(DOCK_TUTORIAL_MASK_KEY), 10);
          if (isNaN(m) || m < 0) m = 0;
        } catch (e) {
          m = 0;
        }
        if ((m & (1 << 2)) !== 0) {
          return {
            mood: 'wink',
            title: '루미',
            text: '3단계 종목 가치 루틴까지 연습했구나! 가이드로 돌아갈까?',
            confirmLabel: '돌아가기',
            dismissLabel: '취소',
            onConfirm: function () {
              window.location.href = 'guide.html';
            },
          };
        }
        if ((m & (1 << 1)) !== 0) {
          return {
            mood: 'wink',
            title: '루미',
            text: '2단계 차트 기초까지 해봤구나! 가이드로 돌아갈까?',
            confirmLabel: '돌아가기',
            dismissLabel: '취소',
            onConfirm: function () {
              window.location.href = 'guide.html';
            },
          };
        }
        if ((m & 1) !== 0) {
          return {
            mood: 'wink',
            title: '루미',
            text: '고생했어 이제 돌아갈까?',
            confirmLabel: '돌아가기',
            dismissLabel: '취소',
            onConfirm: function () {
              window.location.href = 'guide.html';
            },
          };
        }
        return null;
      },
      0
    );
  }
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

  function handleDismissClick() {
    if (typeof dismissHandler === 'function') {
      innerCloseCoach();
      return;
    }
    if (typeof window.__jurinGuideQuit === 'function') {
      try {
        window.__jurinGuideQuit();
      } catch (e) { /* ignore */ }
      endGuideLumiSession();
      return;
    }
    innerCloseCoach();
  }

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
    if (dock) {
      /* 가이드 페이지: 튜토리얼 설명 후 좌하단 「루미 대화」 도크 미표시 */
      dock.style.display = document.body.classList.contains('guide-page') ? 'none' : '';
    }
    syncGuideDockLabel();
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
    if (root) {
      var existingDismiss = document.getElementById('mascotCoachDismiss');
      if (existingDismiss && existingDismiss.getAttribute('data-jurin-dismiss-bound') !== '1') {
        existingDismiss.addEventListener('click', handleDismissClick);
        existingDismiss.setAttribute('data-jurin-dismiss-bound', '1');
      }
      return root;
    }
    var html =
      '<aside class="mascot-coach" id="mascotCoach" aria-live="polite">' +
      '  <div class="mascot-coach-body">' +
      '    <div class="mascot-coach-image-wrap" id="mascotCoachImageWrap">' +
      '      <img id="mascotCoachImage" alt="마스코트" />' +
      '      <span class="mascot-coach-fallback" id="mascotCoachFallback" style="display:none;"></span>' +
      '    </div>' +
      '    <div class="mascot-coach-bubble">' +
      '      <button type="button" class="mascot-coach-close-inline" id="mascotCoachClose" aria-label="창 닫기">×</button>' +
      '      <div class="mascot-coach-bubble-top">' +
      '        <span class="mascot-coach-name">루미</span>' +
      '        <span class="mascot-coach-badge info" id="mascotCoachBadge">정보/똑똑이</span>' +
      '      </div>' +
      '      <div class="mascot-coach-title" id="mascotCoachTitle">안녕? 반가워! 나는 주린이 가이드 담당 루미야.</div>' +
      '      <div class="mascot-coach-text" id="mascotCoachText">설명을 표시할 수 있어요.</div>' +
      '      <div class="mascot-coach-actions">' +
      '        <button type="button" class="tutorial-btn-ghost mascot-coach-back" id="mascotCoachBack" style="display:none" aria-hidden="true">돌아가기</button>' +
      '        <button type="button" class="tutorial-btn-ghost" id="mascotCoachConfirm">확인</button>' +
      '        <button type="button" class="tutorial-btn-ghost mascot-coach-btn-exit" id="mascotCoachDismiss" aria-label="종료">종료</button>' +
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
      dismissBtn.addEventListener('click', handleDismissClick);
    }
    if (dockBtn) {
      syncGuideDockLabel();
      dockBtn.addEventListener('click', function () {
        if (
          window.LumiChat &&
          typeof window.LumiChat.open === 'function' &&
          !isGuideLumiSession() &&
          !isTutorialSessionActive()
        ) {
          window.LumiChat.open();
          return;
        }
        reopenFromDock();
      });
    }
    return root;
  }

  function reopenFromDock() {
    if (lastDockPayload) {
      var pl = Object.assign({}, lastDockPayload);
      pl.instantText = true;
      show(pl, true);
      return;
    }
    var alt = tryDockReopenPayload();
    if (alt) show(alt, true);
  }

  function restoreLastDockPayload() {
    if (!lastDockPayload) return false;
    var pl = Object.assign({}, lastDockPayload);
    pl.instantText = true;
    show(pl, false);
    return true;
  }

  function resolveMood(mood) {
    var m = String(mood || '').toLowerCase();
    if (m === 'success' || m === 'caution' || m === 'welcome' || m === 'info' || m === 'wink') return m;
    return 'info';
  }

  function tryDockReopenPayload() {
    try {
      return tryDockFiltersChained(lastDockPayload, true);
    } catch (e) {
      return null;
    }
  }

  function typewrite(textEl, fullText, htmlFull) {
    typingToken += 1;
    var token = typingToken;
    if (!textEl) return;
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
    var plain = coachPlainText(fullText);
    window.__mascotFullText = plain;
    textEl.textContent = '';
    var index = 0;
    function finishType() {
      if (htmlFull) textEl.innerHTML = htmlFull;
    }
    function tick() {
      if (token !== typingToken) return;
      index += 1;
      textEl.textContent = plain.slice(0, index);
      if (index < plain.length) {
        typingTimer = setTimeout(tick, 32);
      } else {
        typingTimer = null;
        finishType();
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
    if (textEl) {
      var textHtml = formatCoachHtml(text);
      if (payload && payload.instantText) {
        typingToken += 1;
        if (typingTimer) {
          clearTimeout(typingTimer);
          typingTimer = null;
        }
        textEl.innerHTML = textHtml;
      } else {
        typewrite(textEl, text, textHtml);
      }
    }
    lastPayload = payload ? Object.assign({}, payload) : null;
    if (payload && payload.ephemeral !== true) {
      lastDockPayload = Object.assign({}, payload);
    }
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
      var dismissText = (payload && payload.dismissLabel) ? String(payload.dismissLabel) : '종료';
      dismissBtn.textContent = dismissText;
      dismissBtn.setAttribute('aria-label', dismissText);
      dismissBtn.classList.toggle('mascot-coach-btn-exit', dismissText === '종료');
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
      syncGuideDockLabel();
    }
  }

  function hideDock() {
    var dock = document.getElementById('mascotCoachDock');
    if (dock) dock.style.display = 'none';
    lastDockPayload = null;
  }

  registerDefaultMarketDockCompletion();

  window.MascotCoach = {
    show: show,
    reopen: function () {
      reopenFromDock();
    },
    restoreLastDockPayload: restoreLastDockPayload,
    close: innerCloseCoach,
    hideDock: hideDock,
    registerDockFilter: registerDockFilter,
    unregisterDockFilter: unregisterDockFilter,
  };

  window.JurinGuideLumi = {
    start: startGuideLumiSession,
    end: endGuideLumiSession,
    isActive: isGuideLumiSession,
  };
})();
