(function () {
  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  var interaction = {
    clickedFilter: false,
    openedDetail: false,
  };
  var GUIDE_STEP1_DONE_KEY = 'jurinGuideStep1Done';

  var STEPS = [
    {
      objective: '목표: 상승/하락 버튼 중 하나를 눌러 필터를 바꿔보세요.',
      mood: 'info',
      coach: '먼저 위쪽 「상승」 또는 「하락」을 눌러 주세요. 그다음에 종목을 눌러요.',
      target: function () {
        return document.getElementById('stocksFilterBtns') || document.querySelector('.stocks-filter');
      },
      done: function () {
        return interaction.clickedFilter;
      },
    },
    {
      objective: '목표: 종목 1개를 눌러 상세 화면을 열기',
      mood: 'info',
      coach: '이제 아래 목록에서 종목 하나를 눌러 상세 화면으로 들어가 보자. 들어가면 현재가랑 시가도 같이 보면 좋아.',
      target: function () {
        return document.querySelector('.stock-row') || document.getElementById('detailOpen');
      },
      done: function () {
        return interaction.openedDetail;
      },
    },
    {
      objective: '목표: 현재가·시가·거래량 카드 확인',
      mood: 'success',
      coach: '좋아! 현재가, 시가, 거래량 카드만 보면 기본 시세 읽기는 완료야.',
      target: function () { return document.getElementById('detail-grid') || document.querySelector('.detail-grid'); },
      done: function () { return true; },
    },
  ];

  function getEl(id) {
    return document.getElementById(id);
  }

  function init() {
    var overlay = getEl('marketStep1Overlay');
    var panel = overlay ? overlay.querySelector('.market-step1-panel') : null;
    var bannerEl = overlay.querySelector('.market-step1-banner');
    var objectiveEl = getEl('marketStep1Objective');
    var progressEl = getEl('marketStep1Progress');
    var clearEl = getEl('marketStep1Clear');
    var closeBtn = getEl('marketStep1Close');

    if (!overlay || !panel || !objectiveEl || !progressEl || !clearEl || !closeBtn) return;

    var current = 0;
    var activeTarget = null;
    var started = false;
    var detailGuideShown = false;
    var step0PraiseShown = false;

    function updateSpotlightClass() {
      var on = started && current === 0 && !interaction.clickedFilter;
      document.body.classList.toggle('market-step1-spotlight', on);
    }

    function showStep0MisclickCoach() {
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') return;
      window.MascotCoach.show({
        mood: 'caution',
        title: '루미 가이드',
        text: '앗, 그게 아니야! 「상승」이나 「하락」을 먼저 눌러줘.',
        confirmLabel: '확인',
        onConfirm: function () {
          showCoach(STEPS[0]);
        },
      });
    }

    function showFilterPraiseThenGoDetail() {
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        render(1);
        return;
      }
      window.MascotCoach.show({
        mood: 'success',
        title: '루미 가이드',
        text: '와, 잘했어! 상승·하락 필터 누른 거 딱이야. 이렇게 하면 목록이 바뀌는 것도 바로 보이지? 루미도 기분 최고야!',
        confirmLabel: '확인',
        onConfirm: function () {
          render(1);
        },
      });
    }

    function step0AllowsClick(target) {
      if (!target || !target.closest) return false;
      if (target.closest('#mascotCoach')) return true;
      if (target.closest('#marketStep1Overlay') && target.closest('.market-step1-panel')) return true;
      var btn = target.closest('.filter-btn[data-filter]');
      if (btn && (btn.dataset.filter === 'up' || btn.dataset.filter === 'down')) return true;
      return false;
    }

    document.addEventListener(
      'click',
      function (event) {
        if (!started || current !== 0 || interaction.clickedFilter) return;
        if (!document.body.classList.contains('market-step1-spotlight')) return;
        if (step0AllowsClick(event.target)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        showStep0MisclickCoach();
      },
      true
    );

    document.querySelectorAll('.stocks-filter .filter-btn[data-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.dataset.filter === 'up' || btn.dataset.filter === 'down') {
          interaction.clickedFilter = true;
          if (current === 0 && !step0PraiseShown) {
            step0PraiseShown = true;
            overlay.classList.remove('is-dim');
            clearTarget();
            updateSpotlightClass();
            showFilterPraiseThenGoDetail();
          }
        }
      });
    });

    function clearTarget() {
      if (activeTarget) {
        activeTarget.classList.remove('tutorial-callout-target');
        activeTarget = null;
      }
    }

    function showCoach(step) {
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') return;
      window.MascotCoach.show({
        mood: step.mood || 'info',
        title: '루미 가이드',
        text: step.coach || '',
        confirmLabel: '확인',
        onConfirm: function () {
          proceed();
        },
      });
    }

    function render(stepIndex) {
      current = clamp(stepIndex, 0, STEPS.length - 1);
      var step = STEPS[current];
      objectiveEl.textContent = step.objective || '';
      progressEl.textContent = (current + 1) + '/' + STEPS.length;
      clearTarget();
      var target = step.target ? step.target() : null;
      if (target) {
        activeTarget = target;
        activeTarget.classList.add('tutorial-callout-target');
      }
      overlay.classList.toggle('is-dim', current === 0 && !interaction.clickedFilter);
      updateSpotlightClass();
      showCoach(step);
    }

    function showIntro() {
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') return;
      window.MascotCoach.show({
        mood: 'welcome',
        title: '안녕! 나는 루미야',
        text: '여긴 시장 탭이야. 지금부터 1단계 시세 읽기를 같이 해보자! 확인을 누르면 시작해.',
        confirmLabel: '확인',
        onConfirm: function () {
          open();
        },
      });
    }

    function proceed() {
      if (!started) return;
      var step = STEPS[current];
      if (!step || typeof step.done !== 'function') return;
      if (!step.done()) {
        showCoach(step);
        return;
      }
      clearTarget();
      if (current >= STEPS.length - 1) {
        try {
          localStorage.setItem(GUIDE_STEP1_DONE_KEY, '1');
        } catch (e) { /* ignore */ }
        document.body.classList.add('market-step1-clear-phase');
        overlay.classList.remove('is-dim');
        overlay.classList.add('is-clear-dim');
        clearEl.classList.add('is-show');
        setTimeout(close, 1000);
        return;
      }
      if (current === 1) {
        if (window.MascotCoach && typeof window.MascotCoach.show === 'function') {
          window.MascotCoach.show({
            mood: 'info',
            title: '상세정보 안내',
            text: '상세 화면에서는 현재가, 시가, 거래량을 먼저 보면 흐름을 빠르게 읽을 수 있어.',
            confirmLabel: '확인',
            onConfirm: function () {
              render(current + 1);
            },
          });
          return;
        }
      }
      render(current + 1);
    }

    function close() {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      clearEl.classList.remove('is-show');
      overlay.classList.remove('is-clear-dim');
      document.body.classList.remove('market-step1-clear-phase');
      document.body.classList.remove('market-step1-active');
      document.body.classList.remove('market-step1-spotlight');
      clearTarget();
      started = false;
      window.__marketStep1OnDetailClosed = null;
      overlay.classList.remove('is-dim');
      if (window.MascotCoach && typeof window.MascotCoach.close === 'function') {
        window.MascotCoach.close();
      }
    }

    function open() {
      started = true;
      interaction.clickedFilter = false;
      interaction.openedDetail = false;
      detailGuideShown = false;
      step0PraiseShown = false;
      window.__marketStep1OnDetailClosed = function () {
        if (!started) return;
        if (current === 1) {
          interaction.openedDetail = false;
        }
      };
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('market-step1-active');
      if (bannerEl) {
        bannerEl.classList.remove('is-hide');
        window.setTimeout(function () {
          if (bannerEl) bannerEl.classList.add('is-hide');
        }, 1400);
      }
      render(0);
    }

    closeBtn.addEventListener('click', function () {
      close();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && overlay.classList.contains('is-open')) {
        close();
      }
    });

    var params = new URLSearchParams(window.location.search);
    var tutorial = (params.get('tutorial') || '').toLowerCase().trim();

    document.addEventListener('click', function (event) {
      var row = event.target && event.target.closest ? event.target.closest('.stock-row') : null;
      if (!row || !started) return;
      if (current === 0 && !interaction.clickedFilter) return;
      interaction.openedDetail = true;
      if (current === 1 && !detailGuideShown && window.MascotCoach && typeof window.MascotCoach.show === 'function') {
        detailGuideShown = true;
        setTimeout(function () {
          window.MascotCoach.show({
            mood: 'info',
            title: '상세정보 기본 보는 법',
            text: '좋아! 여기서는 현재가, 시가, 거래량 카드 3개를 먼저 보면 기본 흐름을 빠르게 읽을 수 있어.',
            confirmLabel: '확인',
            onConfirm: function () {
              if (current === 1) {
                render(2);
              }
            },
          });
        }, 420);
      }
    });

    if (tutorial === 'step1' || tutorial === '1') {
      showIntro();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
