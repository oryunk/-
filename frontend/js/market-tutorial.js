/**
 * 파일: 주린닷컴 홈에서 시장 튜토리얼(step1) 진입 유도
 * 설명( mascot-coach 와 tutorialOverlay 로 시장 탭 클릭을 안내한다. )
 */
(function () {
  function initStep1Tutorial() {
    const startBtn = document.getElementById('tutorialStep1Start');
    const overlay = document.getElementById('tutorialOverlay');
    const marketLink = document.querySelector('.nav-menu a[href="market.html"]');

    if (!overlay || !marketLink) return;

    function showMarketTabHint() {
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') return;
      window.MascotCoach.show({
        mood: 'info',
        title: '안녕? 나는 루미야!',
        text: '반가워! 지금부터 기초 시세 보는 법을 같이 해보자. 먼저 시장 탭으로 이동해볼까?',
        confirmLabel: '시장 탭 가기',
        onConfirm: function () {
          const url = new URL(marketLink.getAttribute('href'), window.location.href);
          url.searchParams.set('tutorial', 'step1');
          window.location.href = url.toString();
        },
      });
    }

    function syncHomeTutorialGuard() {
      if (!window.JurinTutorialGuard || typeof window.JurinTutorialGuard.set !== 'function') return;
      window.JurinTutorialGuard.set({
        isActive: function () {
          return (
            overlay.classList.contains('is-open') &&
            document.body.classList.contains('tutorial-step1-spotlight')
          );
        },
        allowsClick: function (target) {
          var G = window.JurinTutorialGuard;
          if (target.closest && target.closest('#mascotCoach')) return true;
          if (G.allowsSpotlightTargets(target)) return true;
          return false;
        },
        getWrongMessage: function (target) {
          if (target.closest && target.closest('.tutorial-callout-target')) return null;
          return '앗, 그건 아니야! 위 메뉴에서 「시장」을 눌러줘.';
        },
        onAfterWrong: function () {
          window.JurinTutorialGuard.restoreDockOrFallback(showMarketTabHint);
        },
      });
    }

    function openStep1() {
      document.body.classList.add('tutorial-step1-active');
      document.body.classList.add('tutorial-step1-spotlight');
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      marketLink.classList.add('tutorial-callout-target');
      window.__jurinGuideQuit = function () {
        closeStep1(true);
      };
      syncHomeTutorialGuard();
      showMarketTabHint();
    }

    function closeStep1(fromUserQuit) {
      document.body.classList.remove('tutorial-step1-active');
      document.body.classList.remove('tutorial-step1-spotlight');
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      marketLink.classList.remove('tutorial-callout-target');
      if (window.MascotCoach && typeof window.MascotCoach.close === 'function') {
        window.MascotCoach.close();
      }
      if (fromUserQuit === true && window.MascotCoach && typeof window.MascotCoach.hideDock === 'function') {
        window.MascotCoach.hideDock();
      }
      if (window.JurinTutorialGuard && typeof window.JurinTutorialGuard.clear === 'function') {
        window.JurinTutorialGuard.clear();
      }
      window.__jurinGuideQuit = null;
    }

    if (startBtn) startBtn.addEventListener('click', openStep1);
    marketLink.addEventListener('click', function (event) {
      if (!overlay.classList.contains('is-open')) return;
      event.preventDefault();
      closeStep1();
      const url = new URL(marketLink.getAttribute('href'), window.location.href);
      url.searchParams.set('tutorial', 'step1');
      window.location.href = url.toString();
    });

    const params = new URLSearchParams(window.location.search);
    const tutorialParam = (params.get('tutorial') || '').trim().toLowerCase();
    if (tutorialParam === 'step1' || tutorialParam === '1') {
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
