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

    function showHomeWrongClickCoach() {
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') return;
      window.MascotCoach.show({
        mood: 'caution',
        title: '루미 가이드',
        text: '앗, 그건 아니야! 위 메뉴에서 「시장」을 눌러줘.',
        confirmLabel: '확인',
        onConfirm: function () {
          showMarketTabHint();
        },
      });
    }

    function isSpotlightBlocking() {
      return document.body.classList.contains('tutorial-step1-spotlight') && overlay.classList.contains('is-open');
    }

    function spotlightAllowsClick(target) {
      if (!target || !target.closest) return false;
      if (target.closest('#mascotCoach')) return true;
      if (target.closest('.tutorial-callout-target')) return true;
      return false;
    }

    document.addEventListener(
      'click',
      function (event) {
        if (!isSpotlightBlocking()) return;
        if (spotlightAllowsClick(event.target)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        showHomeWrongClickCoach();
      },
      true
    );

    function openStep1() {
      document.body.classList.add('tutorial-step1-active');
      document.body.classList.add('tutorial-step1-spotlight');
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      marketLink.classList.add('tutorial-callout-target');
      showMarketTabHint();
    }

    function closeStep1() {
      document.body.classList.remove('tutorial-step1-active');
      document.body.classList.remove('tutorial-step1-spotlight');
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      marketLink.classList.remove('tutorial-callout-target');
      if (window.MascotCoach && typeof window.MascotCoach.close === 'function') {
        window.MascotCoach.close();
      }
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
        closeStep1();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStep1Tutorial);
  } else {
    initStep1Tutorial();
  }
})();
