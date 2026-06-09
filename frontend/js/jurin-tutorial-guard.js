/**
 * 파일: 튜토리얼 잘못된 클릭 가드(공통)
 * 설명( 가이드 중 허용 클릭 외에는 차단하고 angry 루미로 집중 유도. )
 */
(function () {
  var activeConfig = null;
  var TUTORIAL_MASK_KEY = 'jurinGuideTutorialBits';
  var TUTORIAL_MASK_USER_SESSION_KEY = 'jurin:tutorial-mask-user-id';

  function tutorialMaskStorageKey() {
    try {
      var uid = sessionStorage.getItem(TUTORIAL_MASK_USER_SESSION_KEY);
      if (uid !== null && uid !== '') return TUTORIAL_MASK_KEY + ':user:' + uid;
    } catch (e) { /* ignore */ }
    return TUTORIAL_MASK_KEY + ':anon';
  }

  function readTutorialBitsMask() {
    var key = tutorialMaskStorageKey();
    try {
      var raw = localStorage.getItem(key);
      if (raw !== null && raw !== '') {
        var m = parseInt(raw, 10);
        return isNaN(m) ? 0 : Math.min(31, Math.max(0, m));
      }
      localStorage.setItem(key, '0');
      return 0;
    } catch (e) {
      return 0;
    }
  }

  function writeTutorialBitsMask(mask) {
    var m = Math.min(31, Math.max(0, parseInt(mask, 10) || 0));
    try {
      localStorage.setItem(tutorialMaskStorageKey(), String(m));
    } catch (e) { /* ignore */ }
  }

  function markTutorialStepComplete(stepNum) {
    var n = normalizeStepNum(stepNum);
    if (!n || n < 1 || n > 5) return;
    var m = readTutorialBitsMask();
    m |= 1 << (n - 1);
    writeTutorialBitsMask(m);
  }

  function syncTutorialMaskUser(user) {
    try {
      localStorage.removeItem(TUTORIAL_MASK_KEY);
    } catch (e) { /* ignore legacy unscoped key */ }
    try {
      if (user && user.userId) {
        sessionStorage.setItem(TUTORIAL_MASK_USER_SESSION_KEY, String(user.userId));
      } else {
        sessionStorage.removeItem(TUTORIAL_MASK_USER_SESSION_KEY);
      }
    } catch (e) { /* ignore */ }
  }

  function allowsMascot(target) {
    if (!target || !target.closest) return false;
    if (target.closest('#mascotCoach')) return true;
    if (target.closest('#mascotCoachDock')) return true;
    return false;
  }

  function allowsMascotAndQuest(target) {
    return allowsMascot(target);
  }

  function allowsSpotlightTargets(target) {
    if (!target || !target.closest) return false;
    return Boolean(target.closest('.tutorial-callout-target'));
  }

  function isBlockedChromeClick(target) {
    if (!target || !target.closest) return false;
    return Boolean(
      target.closest('.nav-logo') ||
      target.closest('[data-auth-nav]') ||
      target.closest('.nav-menu a') ||
      target.closest('.btn-back') ||
      target.closest('.jurin-back-btn')
    );
  }

  function navMisclickMessage(target) {
    if (!target || !target.closest) return null;
    var navLink = target.closest('.nav-menu a');
    if (navLink) {
      var href = String(navLink.getAttribute('href') || '').toLowerCase();
      if (href.indexOf('market.html') >= 0) return null;
      if (href.indexOf('analysis.html') >= 0) {
        return '지금은 「AI 분석」이 아니야! 안내한 곳만 눌러줘.';
      }
      if (href.indexOf('ai-chart') >= 0) {
        return '지금은 「AI 차트 예측」이 아니야! 안내한 곳만 눌러줘.';
      }
      if (href.indexOf('guide.html') >= 0) {
        return '지금은 「가이드」가 아니야! 안내한 곳만 눌러줘.';
      }
      if (href.indexOf('community.html') >= 0) {
        return '지금은 「커뮤니티」가 아니야! 안내한 곳만 눌러줘.';
      }
      if (href.indexOf('topic=elw') >= 0) {
        return '지금은 그 메뉴가 아니야! 안내한 곳만 눌러줘.';
      }
      if (href.indexOf('topic=bonds') >= 0) {
        return '지금은 그 메뉴가 아니야! 안내한 곳만 눌러줘.';
      }
      return '지금은 그 메뉴가 아니야! 안내한 곳만 눌러줘.';
    }
    return null;
  }

  function defaultBlockedMessage(target) {
    if (!target || !target.closest) {
      return '지금은 가이드에 집중하자! 안내한 곳만 눌러줘.';
    }
    if (target.closest('.nav-logo')) {
      return '지금은 가이드에 집중해 줘! 홈으로 가려면 「튜토리얼 종료」를 눌러줘.';
    }
    if (target.closest('[data-auth-nav]')) {
      return '가이드 중엔 로그인은 잠시 미뤄도 돼! 먼저 안내를 따라와 줘.';
    }
    if (target.closest('.btn-back') || target.closest('.jurin-back-btn')) {
      return '지금은 뒤로 가지 말고, 안내를 이어가 보자!';
    }
    var navMsg = navMisclickMessage(target);
    if (navMsg) return navMsg;
    return '지금은 가이드에 집중하자! 안내한 곳만 눌러줘.';
  }

  function restoreDockOrFallback(fallback) {
    if (
      window.MascotCoach &&
      typeof window.MascotCoach.restoreLastDockPayload === 'function' &&
      window.MascotCoach.restoreLastDockPayload()
    ) {
      return;
    }
    if (typeof fallback === 'function') fallback();
  }

  function showWrongClickCoach(message, onAfterWrong, mood) {
    if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') return;
    window.MascotCoach.show({
      mood: mood || 'angry',
      title: '루미 가이드',
      text: message,
      confirmLabel: '확인',
      ephemeral: true,
      onConfirm: function () {
        restoreDockOrFallback(onAfterWrong);
      },
    });
  }

  document.addEventListener(
    'click',
    function (event) {
      if (!activeConfig) return;
      if (typeof activeConfig.isActive === 'function' && !activeConfig.isActive()) return;
      var target = event.target;
      if (typeof activeConfig.allowsClick === 'function' && activeConfig.allowsClick(target)) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      var message = null;
      if (typeof activeConfig.getWrongMessage === 'function') {
        message = activeConfig.getWrongMessage(target);
      }
      if (!message) {
        message = defaultBlockedMessage(target);
      }

      showWrongClickCoach(message, activeConfig.onAfterWrong, 'angry');
    },
    true
  );

  function stripTutorialParamFromUrl() {
    try {
      var u = new URL(window.location.href);
      if (!u.searchParams.has('tutorial')) return;
      u.searchParams.delete('tutorial');
      window.history.replaceState({}, '', u.pathname + u.search + u.hash);
    } catch (e) { /* ignore */ }
  }

  var FRESH_START_KEY = 'jurin:tutorial-fresh-start';
  var HANDOFF_PREFIX = 'jurin:tutorial-handoff-';
  var STEP4_STATE_KEY = 'jurinStep4State';

  function normalizeStepNum(stepNum) {
    var n = parseInt(String(stepNum || ''), 10);
    return isNaN(n) || n < 1 ? 0 : n;
  }

  function handoffKey(stepNum) {
    return HANDOFF_PREFIX + String(normalizeStepNum(stepNum));
  }

  function markTutorialFreshStart(stepNum) {
    var n = normalizeStepNum(stepNum);
    if (!n) return;
    try {
      sessionStorage.setItem(FRESH_START_KEY, String(n));
    } catch (e) { /* ignore */ }
  }

  function consumeTutorialFreshStart(stepNum) {
    var n = normalizeStepNum(stepNum);
    if (!n) return false;
    try {
      var raw = sessionStorage.getItem(FRESH_START_KEY);
      if (raw !== String(n)) return false;
      sessionStorage.removeItem(FRESH_START_KEY);
      return true;
    } catch (e) {
      return false;
    }
  }

  function markTutorialHandoff(stepNum) {
    var n = normalizeStepNum(stepNum);
    if (!n) return;
    try {
      sessionStorage.setItem(handoffKey(n), '1');
    } catch (e) { /* ignore */ }
  }

  function consumeTutorialHandoff(stepNum) {
    var n = normalizeStepNum(stepNum);
    if (!n) return false;
    try {
      var key = handoffKey(n);
      if (sessionStorage.getItem(key) !== '1') return false;
      sessionStorage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearTutorialProgress(stepNum) {
    var n = normalizeStepNum(stepNum);
    if (!n) return;
    try {
      sessionStorage.removeItem(handoffKey(n));
      if (n === 4) {
        sessionStorage.removeItem(STEP4_STATE_KEY);
      }
    } catch (e) { /* ignore */ }
  }

  function clearTutorialCompleteBit(stepNum) {
    var n = normalizeStepNum(stepNum);
    if (!n || n < 1 || n > 5) return;
    var m = readTutorialBitsMask();
    m &= ~(1 << (n - 1));
    writeTutorialBitsMask(m);
  }

  var EXPERT_TUTORIAL_MASK_KEY = 'jurinExpertTutorialBits';

  function expertMaskStorageKey() {
    try {
      var uid = sessionStorage.getItem(TUTORIAL_MASK_USER_SESSION_KEY);
      if (uid !== null && uid !== '') return EXPERT_TUTORIAL_MASK_KEY + ':user:' + uid;
    } catch (e) { /* ignore */ }
    return EXPERT_TUTORIAL_MASK_KEY + ':anon';
  }

  function readExpertBitsMask() {
    var key = expertMaskStorageKey();
    try {
      var raw = localStorage.getItem(key);
      if (raw !== null && raw !== '') {
        var m = parseInt(raw, 10);
        return isNaN(m) ? 0 : Math.min(3, Math.max(0, m));
      }
      localStorage.setItem(key, '0');
      return 0;
    } catch (e) {
      return 0;
    }
  }

  function writeExpertBitsMask(mask) {
    var m = Math.min(3, Math.max(0, parseInt(mask, 10) || 0));
    try {
      localStorage.setItem(expertMaskStorageKey(), String(m));
    } catch (e) { /* ignore */ }
  }

  function markExpertStepComplete(stepNum) {
    var n = parseInt(stepNum, 10);
    if (!n || n < 1 || n > 2) return;
    var m = readExpertBitsMask();
    m |= 1 << (n - 1);
    writeExpertBitsMask(m);
  }

  function isExpertStepCleared(stepNum) {
    var n = parseInt(stepNum, 10);
    if (!n || n < 1 || n > 2) return false;
    return (readExpertBitsMask() & (1 << (n - 1))) !== 0;
  }

  function countExpertClearedSteps() {
    var m = readExpertBitsMask();
    var c = 0;
    if (m & 1) c += 1;
    if (m & 2) c += 1;
    return c;
  }

  function parseTutorialStepFromHref(href) {
    try {
      var u = new URL(href, window.location.href);
      var t = (u.searchParams.get('tutorial') || '').toLowerCase().trim();
      if (t === 'step1' || t === '1') return 1;
      if (t === 'step2' || t === '2') return 2;
      if (t === 'step3' || t === '3') return 3;
      if (t === 'step4' || t === '4') return 4;
      if (t === 'step5' || t === '5') return 5;
      if (t === 'expert1') return 1;
      if (t === 'expert2') return 2;
    } catch (e) { /* ignore */ }
    return 0;
  }

  function restoreNormalSiteUi(options) {
    options = options || {};
    document.body.classList.remove('mascot-coach-minimized');
    document.body.classList.remove('mascot-coach-spotlight-dim');
    if (window.JurinGuideLumi && typeof window.JurinGuideLumi.end === 'function') {
      window.JurinGuideLumi.end();
    }
    if (window.MascotCoach) {
      if (typeof window.MascotCoach.close === 'function') {
        window.MascotCoach.close();
      }
      if (typeof window.MascotCoach.hideDock === 'function') {
        window.MascotCoach.hideDock();
      }
    }
    if (options.stripTutorial) {
      stripTutorialParamFromUrl();
    }
    if (options.initLumiChat !== false && window.LumiChat && typeof window.LumiChat.init === 'function') {
      if (!document.getElementById('lumiChatRoot')) {
        try {
          window.LumiChat.init();
        } catch (e) { /* ignore */ }
      }
    }
  }

  window.JurinTutorialUtil = {
    stripTutorialParamFromUrl: stripTutorialParamFromUrl,
    restoreNormalSiteUi: restoreNormalSiteUi,
    markTutorialFreshStart: markTutorialFreshStart,
    consumeTutorialFreshStart: consumeTutorialFreshStart,
    markTutorialHandoff: markTutorialHandoff,
    consumeTutorialHandoff: consumeTutorialHandoff,
    clearTutorialProgress: clearTutorialProgress,
    clearTutorialCompleteBit: clearTutorialCompleteBit,
    readTutorialBitsMask: readTutorialBitsMask,
    writeTutorialBitsMask: writeTutorialBitsMask,
    markTutorialStepComplete: markTutorialStepComplete,
    syncTutorialMaskUser: syncTutorialMaskUser,
    getTutorialMaskStorageKey: tutorialMaskStorageKey,
    parseTutorialStepFromHref: parseTutorialStepFromHref,
    readExpertBitsMask: readExpertBitsMask,
    writeExpertBitsMask: writeExpertBitsMask,
    markExpertStepComplete: markExpertStepComplete,
    isExpertStepCleared: isExpertStepCleared,
    countExpertClearedSteps: countExpertClearedSteps,
  };

  window.JurinTutorialGuard = {
    set: function (config) {
      activeConfig = config || null;
    },
    clear: function () {
      activeConfig = null;
    },
    allowsMascotAndQuest: allowsMascotAndQuest,
    allowsSpotlightTargets: allowsSpotlightTargets,
    isBlockedChromeClick: isBlockedChromeClick,
    navMisclickMessage: navMisclickMessage,
    defaultBlockedMessage: defaultBlockedMessage,
    restoreDockOrFallback: restoreDockOrFallback,
    showWrongClickCoach: showWrongClickCoach,
  };
})();
