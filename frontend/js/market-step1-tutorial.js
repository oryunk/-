(function () {
  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  var interaction = {
    clickedFilter: false,
    clickedVolumeFilter: false,
    openedDetail: false,
  };

  var STEP_INDICES = 0;
  var STEP_FILTER = 1;
  var STEP_VOLUME = 2;
  var STEP_PICK = 3;
  var STEP_GRID_INTRO = 4;
  var STEP_TERM_OPEN = 5;
  var STEP_TERM_HIGH = 6;
  var STEP_TERM_LOW = 7;
  var STEP_TERM_PREVCLOSE = 8;
  var STEP_TERM_LIMITS = 9;
  var STEP_TERM_VOL = 10;
  var STEP_WRAP = 11;

  /** 가이드 「전체 튜토리얼」 5단계 중 1단계 클리어 시 비트 0 (guide.html 과 동일 키) */
  var TUTORIAL_MASK_KEY = 'jurinGuideTutorialBits';

  function filterUpDownButtons() {
    var wrap = document.getElementById('stocksFilterBtns');
    if (!wrap) return [];
    var up = wrap.querySelector('.filter-btn[data-filter="up"]');
    var down = wrap.querySelector('.filter-btn[data-filter="down"]');
    return [up, down].filter(Boolean);
  }

  function filterVolumeButton() {
    var wrap = document.getElementById('stocksFilterBtns');
    if (!wrap) return [];
    var v = wrap.querySelector('.filter-btn[data-filter="volume"]');
    return v ? [v] : [];
  }

  var STEPS = [
    {
      objective: '목표: 코스피·코스닥 지수로 오늘 시장 분위기를 봅니다.',
      mood: 'info',
      coach:
        '위쪽 지수 카드만 봐도 오늘 시장이 전체로 올랐는지 내렸는지 감이 와. 코스피는 대형주 비중이 크고, 코스닥은 성장·벤처 쪽이 많다고 보면 돼. 장은 보통 9시부터 3시 반까지 열려 있어.',
      targets: function () {
        var g = document.getElementById('indicesGrid');
        return g ? [g] : [];
      },
      done: function () {
        return true;
      },
    },
    {
      objective: '목표: 상승 또는 하락 필터로 오늘 움직인 종목만 골라봅니다.',
      mood: 'info',
      coach:
        '「상승」이나 「하락」을 눌러 봐. 전일 종가 대비로 오른 종목·내린 종목만 골라 볼 수 있어. 그게 오늘의 방향을 읽는 첫걸음이야.',
      targets: function () {
        return filterUpDownButtons();
      },
      done: function () {
        return interaction.clickedFilter;
      },
    },
    {
      objective: '목표: 거래량 순으로 오늘 관심 몰린 종목을 봅니다.',
      mood: 'info',
      coach:
        '이제 이 버튼만 보면 돼. 「거래량」을 눌러 봐. 거래량이 크다는 건 그날 주문이 많이 몰렸다는 뜻이야.',
      targets: function () {
        return filterVolumeButton();
      },
      done: function () {
        return interaction.clickedVolumeFilter;
      },
    },
    {
      objective: '목표: 종목 하나를 눌러 시세 카드가 있는 상세로 들어갑니다.',
      mood: 'info',
      coach:
        '목록에서 종목 하나를 눌러 상세로 들어가 봐. 곧 아래 카드들을 하나씩 짧게 설명해 줄게.',
      targets: function () {
        var row = document.querySelector('#marketOverviewView .stock-row');
        return row ? [row] : [];
      },
      done: function () {
        return interaction.openedDetail;
      },
    },
    {
      objective: '목표: 시세 카드 영역 한눈에 보기',
      mood: 'info',
      coach:
        '이 네모 칸들이 오늘 시세를 나눠 보여 주는 곳이야. 지금은 전체가 강조돼 있지? 다음부터는 한 칸씩만 밝게 보일 거야.',
      targets: function () {
        var g = document.getElementById('detailGrid');
        return g ? [g] : [];
      },
      done: function () {
        return true;
      },
    },
    {
      objective: '용어: 시가',
      mood: 'info',
      coach: '시가는 장이 열린 뒤 형성되는 첫 체결가 쪽을 말해. 오늘 장이 어디서 시작됐는지 감 잡을 때 봐.',
      targets: function () {
        var el = document.getElementById('detailCardOpen');
        return el ? [el] : [];
      },
      done: function () {
        return true;
      },
    },
    {
      objective: '용어: 고가',
      mood: 'info',
      coach: '고가는 오늘 장중에 지금까지 찍힌 가장 높은 체결가야. 위로 얼마나 올라갔는지 볼 때 쓰면 돼.',
      targets: function () {
        var el = document.getElementById('detailCardHigh');
        return el ? [el] : [];
      },
      done: function () {
        return true;
      },
    },
    {
      objective: '용어: 저가',
      mood: 'info',
      coach: '저가는 오늘 장중에 지금까지 찍힌 가장 낮은 체결가야. 아래로 얼마나 내려왔는지 볼 때 보면 돼.',
      targets: function () {
        var el = document.getElementById('detailCardLow');
        return el ? [el] : [];
      },
      done: function () {
        return true;
      },
    },
    {
      objective: '용어: 전일 종가',
      mood: 'info',
      coach:
        '전일 종가는 어제 장 마감 때의 가격이야. 오늘 오른지 내린지 비교할 때 기준이 되는 말이지.',
      targets: function () {
        var el = document.getElementById('detailCardPrevClose');
        return el ? [el] : [];
      },
      done: function () {
        return true;
      },
    },
    {
      objective: '용어: 상한가·하한가',
      mood: 'info',
      coach:
        '상한가는 하루에 오를 수 있는 끝값, 하한가는 내릴 수 있는 끝값이야. 보통 기준은 전일 종가고, 호가 단위까지 맞춰 정해져.',
      targets: function () {
        var u = document.getElementById('detailCardUpperLimit');
        var l = document.getElementById('detailCardLowerLimit');
        return [u, l].filter(Boolean);
      },
      done: function () {
        return true;
      },
    },
    {
      objective: '용어: 거래량 (카드)',
      mood: 'info',
      coach:
        '이 거래량은 오늘 그 종목이 얼마나 많이 거래됐는지 보여 줘. 아까 목록에서 본 거래량 순이랑 같은 맥락이야.',
      targets: function () {
        var el = document.getElementById('detailCardVolume');
        return el ? [el] : [];
      },
      done: function () {
        return true;
      },
    },
    {
      objective: '목표: 뉴스·수급으로 힌트 찾기',
      mood: 'success',
      coach:
        '여기까지가 시세 카드 핵심이야. 가격이 왜 움직였는지는 이유가 하나가 아니니까, 아래 관련 뉴스·투자자 동향도 같이 보면 좋아. 오늘은 숫자가 무슨 뜻인지만 잡아도 1단계 통과야!',
      targets: function () {
        var news = document.querySelector('#stockDetailView [data-jurin-section="news"]');
        if (news) return [news];
        var g = document.getElementById('detailGrid');
        return g ? [g] : [];
      },
      done: function () {
        return true;
      },
    },
  ];

  function getEl(id) {
    return document.getElementById(id);
  }

  function init() {
    var overlay = getEl('marketStep1Overlay');
    var questHud = getEl('marketStep1QuestHud');
    var panel = questHud ? questHud.querySelector('.market-step1-panel') : null;
    var bannerEl = questHud ? questHud.querySelector('.market-step1-banner') : null;
    var nowEl = getEl('marketStep1Now');
    var progressEl = getEl('marketStep1Progress');
    var clearEl = getEl('marketStep1Clear');
    var closeBtn = getEl('marketStep1Close');
    var questItems = panel ? panel.querySelectorAll('.market-step1-quest-item') : [];

    if (!overlay || !questHud || !panel || !nowEl || !progressEl || !clearEl || !closeBtn || questItems.length !== 3) return;

    var current = 0;
    var activeTargets = [];
    var started = false;
    var detailGuideShown = false;
    var filterPraiseShown = false;
    var volumePraiseShown = false;
    var pendingPersistStep1Complete = false;

    function markGuideTutorialStep1Cleared() {
      try {
        var m = parseInt(localStorage.getItem(TUTORIAL_MASK_KEY), 10);
        if (isNaN(m) || m < 0) m = 0;
        m |= 1;
        localStorage.setItem(TUTORIAL_MASK_KEY, String(m));
      } catch (e) { /* ignore */ }
    }

    function clearTargets() {
      activeTargets.forEach(function (el) {
        if (el && el.classList) el.classList.remove('tutorial-callout-target');
      });
      activeTargets = [];
    }

    function applyTargetsFromStep(step) {
      clearTargets();
      if (!step || typeof step.targets !== 'function') return;
      var raw = step.targets();
      if (!raw) return;
      var list = Array.isArray(raw) ? raw : [raw];
      list.filter(Boolean).forEach(function (el) {
        if (el && el.classList) {
          el.classList.add('tutorial-callout-target');
          activeTargets.push(el);
        }
      });
    }

    function updateQuestChecklist() {
      var clearPhase = document.body.classList.contains('market-step1-clear-phase');
      var q1Done = started && current >= STEP_PICK;
      var q2Done = started && current >= STEP_GRID_INTRO;
      var q3Done = started && (clearPhase || pendingPersistStep1Complete);
      var q1Current = started && !q1Done && current < STEP_PICK;
      var q2Current = started && q1Done && !q2Done && current >= STEP_PICK && current < STEP_GRID_INTRO;
      var q3Current = started && q2Done && !q3Done && current >= STEP_GRID_INTRO && !clearPhase;

      var states = [
        { done: q1Done, current: q1Current },
        { done: q2Done, current: q2Current },
        { done: q3Done, current: q3Current },
      ];
      var doneCount = (q1Done ? 1 : 0) + (q2Done ? 1 : 0) + (q3Done ? 1 : 0);
      progressEl.textContent = '완료 ' + doneCount + '/3';

      for (var i = 0; i < 3; i++) {
        var li = questItems[i];
        if (!li || !li.classList) continue;
        var st = states[i];
        li.classList.toggle('is-done', Boolean(st.done));
        li.classList.toggle('is-current', Boolean(st.current));
        li.setAttribute('aria-checked', st.done ? 'true' : 'false');
        if (st.current) {
          li.setAttribute('aria-current', 'step');
        } else {
          li.removeAttribute('aria-current');
        }
      }
    }

    function updateSpotlightClass() {
      var on = started && current === STEP_FILTER && !interaction.clickedFilter;
      document.body.classList.toggle('market-step1-spotlight', on);
    }

    function updateVolumeSpotlightClass() {
      var on = started && current === STEP_VOLUME && !interaction.clickedVolumeFilter;
      document.body.classList.toggle('market-step1-spotlight-volume', on);
    }

    function updateDetailBodyClass() {
      if (!started) {
        document.body.classList.remove('market-step1-detail-overview');
        document.body.classList.remove('market-step1-detail-term-mode');
        document.body.classList.remove('market-step1-detail-spotlight');
        return;
      }
      var inDetailSpotlight = current >= STEP_GRID_INTRO && current <= STEP_WRAP;
      document.body.classList.toggle('market-step1-detail-spotlight', inDetailSpotlight);
      if (current < STEP_GRID_INTRO) {
        document.body.classList.remove('market-step1-detail-overview');
        document.body.classList.remove('market-step1-detail-term-mode');
        return;
      }
      document.body.classList.toggle('market-step1-detail-overview', current === STEP_GRID_INTRO);
      document.body.classList.toggle(
        'market-step1-detail-term-mode',
        current >= STEP_TERM_OPEN && current <= STEP_TERM_VOL
      );
    }

    function showFilterMisclickCoach() {
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') return;
      window.MascotCoach.show({
        mood: 'caution',
        title: '루미 가이드',
        text: '앗, 그게 아니야! 「상승」이나 「하락」을 먼저 눌러줘.',
        confirmLabel: '확인',
        onConfirm: function () {
          showCoach(STEPS[STEP_FILTER]);
        },
      });
    }

    function showVolumeMisclickCoach() {
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') return;
      window.MascotCoach.show({
        mood: 'caution',
        title: '루미 가이드',
        text: '앗, 지금은 「거래량」버튼만 눌러 줘!',
        confirmLabel: '확인',
        onConfirm: function () {
          showCoach(STEPS[STEP_VOLUME]);
        },
      });
    }

    function showFilterPraiseThenGoVolume() {
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        render(STEP_VOLUME);
        return;
      }
      window.MascotCoach.show({
        mood: 'success',
        title: '루미 가이드',
        text: '와, 잘했어! 상승·하락으로 오늘 방향만 골라 보는 거, 딱이야. 이제 거래량으로 한 번 더 넓혀 보자.',
        confirmLabel: '확인',
        onConfirm: function () {
          render(STEP_VOLUME);
        },
      });
    }

    function showVolumePraiseThenPick() {
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        render(STEP_PICK);
        return;
      }
      window.MascotCoach.show({
        mood: 'success',
        title: '루미 가이드',
        text: '좋아! 거래량 순이면 오늘 어디에 관심이 쏠렸는지 감 잡기 좋지? 이제 종목 하나 골라서 상세로 들어가 보자.',
        confirmLabel: '확인',
        onConfirm: function () {
          render(STEP_PICK);
        },
      });
    }

    function filterStepAllowsClick(target) {
      if (!target || !target.closest) return false;
      if (target.closest('#mascotCoach')) return true;
      if (target.closest('#marketStep1QuestHud') && target.closest('.market-step1-panel')) return true;
      var btn = target.closest('.filter-btn[data-filter]');
      if (btn && (btn.dataset.filter === 'up' || btn.dataset.filter === 'down')) return true;
      return false;
    }

    function volumeStepAllowsClick(target) {
      if (!target || !target.closest) return false;
      if (target.closest('#mascotCoach')) return true;
      if (target.closest('#marketStep1QuestHud') && target.closest('.market-step1-panel')) return true;
      var btn = target.closest('.filter-btn[data-filter]');
      return Boolean(btn && btn.dataset.filter === 'volume');
    }

    document.addEventListener(
      'click',
      function (event) {
        if (!started || current !== STEP_FILTER || interaction.clickedFilter) return;
        if (!document.body.classList.contains('market-step1-spotlight')) return;
        if (filterStepAllowsClick(event.target)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        showFilterMisclickCoach();
      },
      true
    );

    document.addEventListener(
      'click',
      function (event) {
        if (!started || current !== STEP_VOLUME || interaction.clickedVolumeFilter) return;
        if (!document.body.classList.contains('market-step1-spotlight-volume')) return;
        if (volumeStepAllowsClick(event.target)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        showVolumeMisclickCoach();
      },
      true
    );

    document.querySelectorAll('.stocks-filter .filter-btn[data-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var f = btn.dataset.filter;
        if (f === 'up' || f === 'down') {
          if (!started) return;
          interaction.clickedFilter = true;
          if (current === STEP_FILTER && !filterPraiseShown) {
            filterPraiseShown = true;
            overlay.classList.remove('is-dim');
            clearTargets();
            updateSpotlightClass();
            updateVolumeSpotlightClass();
            showFilterPraiseThenGoVolume();
          }
          return;
        }
        if (f === 'volume') {
          if (!started) return;
          if (current === STEP_VOLUME) {
            interaction.clickedVolumeFilter = true;
            if (!volumePraiseShown) {
              volumePraiseShown = true;
              overlay.classList.remove('is-dim');
              clearTargets();
              updateSpotlightClass();
              updateVolumeSpotlightClass();
              showVolumePraiseThenPick();
            }
          }
        }
      });
    });

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
      nowEl.textContent = step.objective || '—';
      applyTargetsFromStep(step);
      var dimForFilter = current === STEP_FILTER && !interaction.clickedFilter;
      var dimForVolume = current === STEP_VOLUME && !interaction.clickedVolumeFilter;
      var dimForDetailSpotlight = current >= STEP_GRID_INTRO && current <= STEP_WRAP;
      overlay.classList.toggle('is-dim', dimForFilter || dimForVolume || dimForDetailSpotlight);
      updateSpotlightClass();
      updateVolumeSpotlightClass();
      updateDetailBodyClass();
      updateQuestChecklist();
      showCoach(step);
    }

    function showIntro() {
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') return;
      window.MascotCoach.show({
        mood: 'welcome',
        title: '안녕! 나는 루미야',
        text:
          '1단계는 시세 읽기로 시장 감을 잡는 단계야. 지수 → 상승·하락 → 거래량 → 상세 카드 순으로 하나씩 가 보자. 확인 누르면 시작!',
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
      if (current >= STEPS.length - 1) {
        clearTargets();
        pendingPersistStep1Complete = true;
        document.body.classList.add('market-step1-clear-phase');
        overlay.classList.remove('is-dim');
        overlay.classList.add('is-clear-dim');
        clearEl.classList.add('is-show');
        document.body.classList.remove('market-step1-detail-overview');
        document.body.classList.remove('market-step1-detail-term-mode');
        document.body.classList.remove('market-step1-detail-spotlight');
        updateQuestChecklist();
        setTimeout(function () {
          close(false);
        }, 1000);
        return;
      }
      render(current + 1);
    }

    function close(fromUserQuit) {
      if (pendingPersistStep1Complete) {
        markGuideTutorialStep1Cleared();
        pendingPersistStep1Complete = false;
        try {
          var u = new URL(window.location.href);
          if (u.searchParams.has('tutorial')) {
            u.searchParams.delete('tutorial');
            window.history.replaceState({}, '', u.pathname + u.search + u.hash);
          }
        } catch (e) { /* ignore */ }
      }
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      questHud.classList.remove('is-open');
      questHud.setAttribute('aria-hidden', 'true');
      clearEl.classList.remove('is-show');
      overlay.classList.remove('is-clear-dim');
      document.body.classList.remove('market-step1-clear-phase');
      document.body.classList.remove('market-step1-active');
      document.body.classList.remove('market-step1-spotlight');
      document.body.classList.remove('market-step1-spotlight-volume');
      document.body.classList.remove('market-step1-detail-overview');
      document.body.classList.remove('market-step1-detail-term-mode');
      document.body.classList.remove('market-step1-detail-spotlight');
      clearTargets();
      started = false;
      window.__marketStep1OnDetailClosed = null;
      overlay.classList.remove('is-dim');
      if (window.MascotCoach && typeof window.MascotCoach.close === 'function') {
        window.MascotCoach.close();
      }
      if (fromUserQuit === true && window.MascotCoach && typeof window.MascotCoach.hideDock === 'function') {
        window.MascotCoach.hideDock();
      }
    }

    function open() {
      started = true;
      interaction.clickedFilter = false;
      interaction.clickedVolumeFilter = false;
      interaction.openedDetail = false;
      detailGuideShown = false;
      filterPraiseShown = false;
      volumePraiseShown = false;
      window.__marketStep1OnDetailClosed = function () {
        if (!started) return;
        if (current === STEP_PICK) {
          interaction.openedDetail = false;
        }
      };
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      questHud.classList.add('is-open');
      questHud.setAttribute('aria-hidden', 'false');
      document.body.classList.add('market-step1-active');
      if (bannerEl) {
        bannerEl.classList.remove('is-hide');
        window.setTimeout(function () {
          if (bannerEl) bannerEl.classList.add('is-hide');
        }, 1400);
      }
      render(STEP_INDICES);
    }

    closeBtn.addEventListener('click', function () {
      close(true);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && overlay.classList.contains('is-open')) {
        close(true);
      }
    });

    var params = new URLSearchParams(window.location.search);
    var tutorial = (params.get('tutorial') || '').toLowerCase().trim();

    document.addEventListener('click', function (event) {
      var row = event.target && event.target.closest ? event.target.closest('.stock-row') : null;
      if (!row || !started) return;
      if (current !== STEP_PICK) return;
      if (!interaction.clickedFilter || !interaction.clickedVolumeFilter) return;
      if (detailGuideShown) return;
      detailGuideShown = true;
      interaction.openedDetail = true;
      window.setTimeout(function () {
        render(STEP_GRID_INTRO);
      }, 450);
    });

    if (tutorial === 'step1' || tutorial === '1') {
      showIntro();
    }

    window.__mascotDockReopenFilter = function (lastPayload, fromDock) {
      if (!fromDock) return null;
      if (document.body.classList.contains('market-step1-active')) return null;
      try {
        var m = parseInt(localStorage.getItem(TUTORIAL_MASK_KEY), 10);
        if (isNaN(m) || (m & 1) === 0) return null;
      } catch (e) {
        return null;
      }
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
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
