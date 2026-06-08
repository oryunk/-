/**
 * 파일: 튜토리얼 잘못된 클릭 가드(공통)
 * 설명( 클릭 유도 단계에서만 caution 코치. 설명·퀴즈 중에는 이탈 클릭만 조용히 차단. )
 */
(function () {
  var activeConfig = null;

  function allowsMascotAndQuest(target, questHudId, panelSelector) {
    if (!target || !target.closest) return false;
    if (target.closest('#mascotCoach')) return true;
    if (questHudId && panelSelector) {
      var hud = document.getElementById(questHudId);
      if (hud && target.closest('#' + questHudId) && target.closest(panelSelector)) return true;
    }
    return false;
  }

  function allowsSpotlightTargets(target) {
    if (!target || !target.closest) return false;
    return Boolean(target.closest('.tutorial-callout-target'));
  }

  function isTutorialLeaveClick(target) {
    return navMisclickMessage(target) != null;
  }

  function navMisclickMessage(target) {
    if (!target || !target.closest) return null;
    var navLink = target.closest('.nav-menu a');
    if (navLink) {
      var href = String(navLink.getAttribute('href') || '').toLowerCase();
      if (href.indexOf('market.html') >= 0) return null;
      if (href.indexOf('analysis.html') >= 0) {
        return '앗, 그건 아니야! 지금은 「AI 분석」이 아니야. 안내한 곳만 눌러줘.';
      }
      if (href.indexOf('ai-chart') >= 0) {
        return '앗, 그건 아니야! 지금은 「AI 차트 예측」이 아니야. 안내한 곳만 눌러줘.';
      }
      if (href.indexOf('guide.html') >= 0) {
        return '앗, 그건 아니야! 지금은 「가이드」가 아니야. 안내한 곳만 눌러줘.';
      }
      return '앗, 그건 아니야! 지금은 안내한 곳만 눌러줘.';
    }
    if (target.closest('.nav-logo') || target.closest('.btn-back') || target.closest('.jurin-back-btn')) {
      return '앗, 그건 아니야! 지금 가이드를 진행 중이야. 안내한 곳만 눌러줘.';
    }
    return null;
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

  function showWrongClickCoach(message, onAfterWrong) {
    if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') return;
    window.MascotCoach.show({
      mood: 'caution',
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

      var message = null;
      if (typeof activeConfig.getWrongMessage === 'function') {
        message = activeConfig.getWrongMessage(target);
      }

      if (message) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showWrongClickCoach(message, activeConfig.onAfterWrong);
        return;
      }

      if (isTutorialLeaveClick(target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  window.JurinTutorialGuard = {
    set: function (config) {
      activeConfig = config || null;
    },
    clear: function () {
      activeConfig = null;
    },
    allowsMascotAndQuest: allowsMascotAndQuest,
    allowsSpotlightTargets: allowsSpotlightTargets,
    isTutorialLeaveClick: isTutorialLeaveClick,
    navMisclickMessage: navMisclickMessage,
    restoreDockOrFallback: restoreDockOrFallback,
    showWrongClickCoach: showWrongClickCoach,
  };
})();
