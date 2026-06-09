/**
 * 파일: 주린닷컴 홈에서 시장 튜토리얼(step1) 진입 유도
 * 설명( mascot-coach 와 tutorialOverlay 로 시장 탭 클릭을 안내한다. )
 */
(function () {
  var HOME_INTRO_BEATS = [
    '안녕! 나는 루미야.',
    '주식을 처음 시작하면 어떤 종목을 사야 할지부터 고민하게 되는데, 사실 그 전에 시장 분위기를 먼저 보는 습관이 중요해.',
    '오늘은 시장을 보는 방법부터 같이 알아보자! 먼저 시장 탭으로 이동해볼까?',
  ];

  function initStep1Tutorial() {
    const startBtn = document.getElementById('tutorialStep1Start');
    const overlay = document.getElementById('tutorialOverlay');
    const marketLink = document.querySelector('.nav-menu a[href="market.html"]');

    if (!overlay || !marketLink) return;

    var homeBeatIndex = 0;

    function applyHomeSpotlight() {
      document.body.classList.add('tutorial-step1-spotlight');
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      marketLink.classList.add('tutorial-callout-target');
    }

    function removeHomeSpotlight() {
      document.body.classList.remove('tutorial-step1-spotlight');
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      marketLink.classList.remove('tutorial-callout-target');
    }

    function navigateToMarketTutorial() {
      if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.markTutorialHandoff === 'function') {
        window.JurinTutorialUtil.markTutorialHandoff(1);
      }
      const url = new URL(marketLink.getAttribute('href'), window.location.href);
      url.searchParams.set('tutorial', 'step1');
      window.location.href = url.toString();
    }

    function showMarketTabHint() {
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') return;
      var isLast = homeBeatIndex >= HOME_INTRO_BEATS.length - 1;
      if (isLast) {
        applyHomeSpotlight();
      } else {
        removeHomeSpotlight();
      }
      syncHomeTutorialGuard();
      window.MascotCoach.show({
        mood: 'welcome',
        title: '루미',
        text: HOME_INTRO_BEATS[homeBeatIndex] || '',
        confirmLabel: isLast ? '시장 탭 가기' : '확인',
        onConfirm: function () {
          if (!isLast) {
            homeBeatIndex += 1;
            showMarketTabHint();
            return;
          }
          navigateToMarketTutorial();
        },
      });
    }

    function isHomeSpotlightPhase() {
      return homeBeatIndex >= HOME_INTRO_BEATS.length - 1 && overlay.classList.contains('is-open');
    }

    function homeNavWrongMessage(target) {
      if (!target || !target.closest) return null;
      var navLink = target.closest('.nav-menu a');
      if (!navLink) return null;
      var href = String(navLink.getAttribute('href') || '').toLowerCase();
      if (href.indexOf('market.html') >= 0) return null;
      if (href.indexOf('analysis.html') >= 0) {
        return '지금은 상단 메뉴에서 「AI 분석」이 아니야! 안내한 곳만 눌러 줘.';
      }
      if (href.indexOf('ai-chart') >= 0) {
        return '지금은 상단 메뉴에서 「AI 차트 예측」이 아니야! 안내한 곳만 눌러 줘.';
      }
      if (href.indexOf('guide.html') >= 0) {
        return '지금은 상단 메뉴에서 「가이드」가 아니야! 안내한 곳만 눌러 줘.';
      }
      if (href.indexOf('community.html') >= 0) {
        return '지금은 상단 메뉴에서 「커뮤니티」가 아니야! 안내한 곳만 눌러 줘.';
      }
      if (href.indexOf('topic=elw') >= 0) {
        return '지금은 상단 메뉴에서 「ELW」가 아니야! 안내한 곳만 눌러 줘.';
      }
      if (href.indexOf('topic=bonds') >= 0) {
        return '지금은 상단 메뉴에서 「채권」이 아니야! 안내한 곳만 눌러 줘.';
      }
      if (href.indexOf('chart-lab') >= 0) {
        return '지금은 상단 메뉴에서 「차트연구소」가 아니야! 안내한 곳만 눌러 줘.';
      }
      if (href.indexOf('glossary') >= 0) {
        return '지금은 상단 메뉴에서 「용어 검색」이 아니야! 안내한 곳만 눌러 줘.';
      }
      if (href.indexOf('simulation') >= 0) {
        return '지금은 상단 메뉴에서 「모의 투자」가 아니야! 안내한 곳만 눌러 줘.';
      }
      return '지금은 상단 메뉴에서 「시장」을 눌러 줘!';
    }

    function syncHomeTutorialGuard() {
      if (!window.JurinTutorialGuard || typeof window.JurinTutorialGuard.set !== 'function') return;
      window.JurinTutorialGuard.set({
        isActive: function () {
          return document.body.classList.contains('tutorial-step1-active');
        },
        allowsClick: function (target) {
          var G = window.JurinTutorialGuard;
          if (G.allowsMascotAndQuest(target, null, null)) return true;
          if (G.isBlockedChromeClick(target)) return false;
          if (isHomeSpotlightPhase() && G.allowsSpotlightTargets(target)) return true;
          return false;
        },
        getWrongMessage: function (target) {
          if (target.closest && target.closest('.tutorial-callout-target')) return null;
          var navMsg = homeNavWrongMessage(target);
          if (navMsg) return navMsg;
          if (isHomeSpotlightPhase()) {
            return '지금은 상단 메뉴에서 「시장」을 눌러 줘!';
          }
          return '지금은 루미의 안내를 들어봐! 확인 버튼을 눌러 줘.';
        },
        onAfterWrong: function () {
          window.JurinTutorialGuard.restoreDockOrFallback(showMarketTabHint);
        },
      });
    }

    function openStep1() {
      homeBeatIndex = 0;
      document.body.classList.add('tutorial-step1-active');
      removeHomeSpotlight();
      window.__jurinGuideQuit = function () {
        closeStep1(true);
      };
      syncHomeTutorialGuard();
      showMarketTabHint();
    }

    function closeStep1(fromUserQuit) {
      homeBeatIndex = 0;
      document.body.classList.remove('tutorial-step1-active');
      removeHomeSpotlight();
      if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.clearTutorialProgress === 'function') {
        window.JurinTutorialUtil.clearTutorialProgress(1);
      }
      if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.restoreNormalSiteUi === 'function') {
        window.JurinTutorialUtil.restoreNormalSiteUi({
          stripTutorial: fromUserQuit === true,
        });
      }
      if (window.JurinTutorialGuard && typeof window.JurinTutorialGuard.clear === 'function') {
        window.JurinTutorialGuard.clear();
      }
      window.__jurinGuideQuit = null;
    }

    if (startBtn) startBtn.addEventListener('click', openStep1);
    marketLink.addEventListener('click', function (event) {
      if (!document.body.classList.contains('tutorial-step1-active')) return;
      event.preventDefault();
      if (overlay.classList.contains('is-open')) {
        closeStep1();
      }
      navigateToMarketTutorial();
    });

    const params = new URLSearchParams(window.location.search);
    const tutorialParam = (params.get('tutorial') || '').trim().toLowerCase();
    if (tutorialParam === 'step1' || tutorialParam === '1') {
      var tutorialUtilHome = window.JurinTutorialUtil;
      if (
        tutorialUtilHome &&
        typeof tutorialUtilHome.consumeTutorialFreshStart === 'function' &&
        tutorialUtilHome.consumeTutorialFreshStart(1)
      ) {
        if (typeof tutorialUtilHome.clearTutorialProgress === 'function') {
          tutorialUtilHome.clearTutorialProgress(1);
        }
        if (overlay.classList.contains('is-open')) closeStep1(true);
      }
      openStep1();
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && overlay.classList.contains('is-open')) {
        closeStep1(true);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStep1Tutorial);
  } else {
    initStep1Tutorial();
  }
})();
