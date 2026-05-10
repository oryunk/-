/**
 * 파일: market.html 3단계 튜토리얼
 * 설명( 시장 화면 후속 퀘스트·OX 퀴즈. )
 */
(function () {
  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  var TUTORIAL_MASK_KEY = 'jurinGuideTutorialBits';
  var STEP3_EXPECTED_CODE = '005930';

  var STEP_WELCOME = 0;
  var STEP_PICK = 1;
  var STEP_CHART = 2;
  var STEP_VOLUME = 3;
  var STEP_INVESTOR = 4;
  var STEP_CTA = 5;
  var STEP_FINAL = 6;

  var interaction = {
    openedDetail: false,
  };

  var STEP3_QUIZ = [
    {
      text:
        '문제 1/3 (O/X)\nPER은 이익 대비 현재 주가 수준을 볼 때 쓰는 지표다.',
      correct: 1,
      correctHint: '정답이야! PER은 주가가 이익 대비 어느 수준인지 보는 대표 지표야.',
      wrongHint: 'PER은 주가가 이익 대비 어느 수준인지 보는 지표야. 배당 비율과는 다른 개념이야.',
    },
    {
      text:
        '문제 2/3 (O/X)\nPBR이 낮으면 무조건 우량주라서 바로 매수해도 된다.',
      correct: 2,
      correctHint: '맞아! PBR 하나만으로는 결론을 못 내리고 다른 지표와 함께 봐야 해.',
      wrongHint: 'PBR은 참고 지표일 뿐이야. 단일 숫자로 즉시 매수 결론을 내리면 위험해.',
    },
    {
      text:
        '문제 3/3 (O/X)\n배당수익률과 ROE를 함께 보면 현금흐름 매력과 수익성을 같이 볼 수 있다.',
      correct: 1,
      correctHint: '정답이야! 배당과 ROE를 함께 보면 환원 매력과 수익성을 균형 있게 볼 수 있어.',
      wrongHint: '배당수익률과 ROE는 서로 다른 정보를 줘. 함께 보면 판단이 더 균형 잡혀.',
    },
  ];

  var STEPS = [
    {
      objective: '목표: 종목 가치 지표(PER·PBR·ROE·배당) 읽는 루틴 익히기.',
      mood: 'welcome',
      coach:
        '좋아, 3단계는 “좋아 보여서”가 아니라 숫자 근거로 판단하는 연습이야. 오늘은 PER·PBR·ROE·배당을 순서대로 보고 마지막에 한 줄 결론까지 만드는 루틴으로 갈게. 각 단계에서 내가 무엇을 먼저 보고, 왜 그렇게 읽는지 짚어 줄게.',
      targets: function () {
        var g = document.getElementById('indicesGrid');
        return g ? [g] : [];
      },
      done: function () { return true; },
    },
    {
      objective: '목표: 종목 상세로 들어가 판단 화면을 열기.',
      mood: 'info',
      coach:
        '목록에서 삼성전자(005930)를 눌러 상세 화면으로 들어가 줘. 상세로 들어가면 지표 카드·비교표·배당/안정성 구역이 한 흐름으로 보일 거야. 이제부터는 “숫자 확인 → 해석 → 결론” 순서로 실제 루틴을 같이 따라가 볼게.',
      targets: function () {
        var row = document.querySelector('#row-' + STEP3_EXPECTED_CODE);
        if (!row) row = document.querySelector('#marketOverviewView .stock-row');
        return row ? [row] : [];
      },
      done: function () { return interaction.openedDetail; },
    },
    {
      objective: '목표: 투자 지표(PER·PBR·ROE) 카드 먼저 확인하기.',
      mood: 'info',
      coach:
        '먼저 투자 지표 영역을 보자. PER은 이익 대비 가격 수준, PBR은 자산 대비 가격 수준, ROE는 자본을 얼마나 효율적으로 이익으로 바꾸는지 보는 지표야. 지금 단계에선 “절대값”보다 각 지표가 무엇을 말해 주는지 의미를 정확히 잡는 게 핵심이야.',
      targets: function () {
        var el = document.getElementById('indicatorGrid');
        return el ? [el] : [];
      },
      done: function () { return true; },
    },
    {
      objective: '목표: 가치평가 비교(PER·PBR 상대 비교)로 가성비 확인하기.',
      mood: 'success',
      coach:
        '이제 가치평가 비교 표를 보자. 같은 업종 평균/중앙값과 비교해서 지금 종목 PER·PBR이 상대적으로 높은지 낮은지를 확인해. 같은 숫자라도 업종이 다르면 의미가 달라지기 때문에, 이 구간은 “비교 기준을 두고 읽는 습관”을 만드는 단계야.',
      targets: function () {
        var el = document.getElementById('valuationTableWrap');
        return el ? [el] : [];
      },
      done: function () { return true; },
    },
    {
      objective: '목표: 안정성/배당 지표로 현금흐름·안정성 확인하기.',
      mood: 'info',
      coach:
        '다음은 안정성/배당 구간이야. 배당수익률·배당금은 주주환원과 현금흐름 매력을, 부채비율 같은 안정성 지표는 리스크를 보여 줘. 여기서는 “수익성(ROE)만 좋다고 끝이 아니라, 재무 안정성과 환원까지 같이 본다”는 균형 감각을 잡으면 돼.',
      targets: function () {
        var el = document.getElementById('stabilityDividendGrid');
        return el ? [el] : [];
      },
      done: function () { return true; },
    },
    {
      objective: '목표: 지표를 한 줄 결론으로 요약해보기.',
      mood: 'info',
      coach:
        '마지막으로 결론 문장을 만들어 보자. 예를 들면 “PER/PBR은 업종 대비 보통~다소 높고, ROE는 견조하며, 배당은 무난하다”처럼 한 줄로 요약하면 돼. 지표 해석은 숫자를 많이 보는 것보다, 판단 근거를 짧고 분명하게 정리하는 게 훨씬 중요해.',
      targets: function () {
        var p1 = document.getElementById('indicatorGrid');
        var p2 = document.getElementById('valuationTableWrap');
        var p3 = document.getElementById('stabilityDividendGrid');
        return [p1, p2, p3].filter(Boolean);
      },
      done: function () { return true; },
    },
    {
      objective: '3단계 클리어!',
      mood: 'success',
      coach:
        '좋아! 이제 PER·PBR·ROE·배당을 근거로 종목 가치를 읽는 기본 루틴을 갖췄어. 다음부터는 같은 순서로 다른 종목에도 적용해서, 감이 아니라 근거 기반으로 비교·판단하는 습관을 계속 가져가면 돼.',
      targets: function () {
        var g = document.getElementById('detailGrid');
        return g ? [g] : [];
      },
      done: function () { return true; },
    },
  ];

  function getEl(id) {
    return document.getElementById(id);
  }

  function stripTutorialParamFromUrl() {
    try {
      var u = new URL(window.location.href);
      if (u.searchParams.has('tutorial')) {
        u.searchParams.delete('tutorial');
        window.history.replaceState({}, '', u.pathname + u.search + u.hash);
      }
    } catch (e) { /* ignore */ }
  }

  function scrollTutorialTargetsIntoViewIfNeeded(elements) {
    if (!elements || !elements.length) return;
    var primary = elements[0];
    if (!primary || typeof primary.getBoundingClientRect !== 'function') return;
    window.requestAnimationFrame(function () {
      var r = primary.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var vw = window.innerWidth || document.documentElement.clientWidth;
      var topMargin = 100;
      var bottomMargin = 180;
      var sideMargin = 8;
      var clipped =
        r.top < topMargin ||
        r.bottom > vh - bottomMargin ||
        r.left < sideMargin ||
        r.right > vw - sideMargin;
      if (!clipped) return;
      try {
        primary.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      } catch (e) {
        primary.scrollIntoView(true);
      }
    });
  }

  function init() {
    var overlay = getEl('marketStep3Overlay');
    var questHud = getEl('marketStep3QuestHud');
    var panel = questHud ? questHud.querySelector('.market-step3-panel') : null;
    var bannerEl = questHud ? questHud.querySelector('.market-step3-banner') : null;
    var nowEl = getEl('marketStep3Now');
    var progressEl = getEl('marketStep3Progress');
    var clearEl = getEl('marketStep3Clear');
    var closeBtn = getEl('marketStep3Close');
    var questItems = panel ? panel.querySelectorAll('.market-step3-quest-item') : [];

    if (!overlay || !questHud || !panel || !nowEl || !progressEl || !clearEl || !closeBtn || questItems.length !== 3) return;

    var current = 0;
    var activeTargets = [];
    var started = false;
    var pickHandled = false;
    var pendingStripTutorial = false;
    var pickPulseKeepAlive = null;

    function clearTargets() {
      activeTargets.forEach(function (el) {
        if (el && el.classList) el.classList.remove('tutorial-callout-target');
      });
      activeTargets = [];
    }

    function ensurePickTargetPulse() {
      if (!started || current !== STEP_PICK || pickHandled) return;
      var row = document.querySelector('#row-' + STEP3_EXPECTED_CODE);
      if (!row) row = document.querySelector('#marketOverviewView .stock-row');
      if (!row || !row.classList) return;
      var exists = false;
      for (var i = 0; i < activeTargets.length; i++) {
        if (activeTargets[i] === row) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        clearTargets();
        row.classList.add('tutorial-callout-target');
        activeTargets.push(row);
      } else if (!row.classList.contains('tutorial-callout-target')) {
        row.classList.add('tutorial-callout-target');
      }
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
      scrollTutorialTargetsIntoViewIfNeeded(activeTargets);
    }

    function updateQuestChecklist() {
      var clearPhase = document.body.classList.contains('market-step3-clear-phase');
      var q1Done = started && current > STEP_CHART;
      var q2Done = started && current > STEP_INVESTOR;
      var q3Done = started && (current > STEP_CTA || clearPhase);
      var q1Current = started && !q1Done && current === STEP_CHART;
      var q2Current = started && !q2Done && current === STEP_INVESTOR;
      var q3Current = started && !q3Done && current === STEP_CTA;

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
        if (st.current) li.setAttribute('aria-current', 'step');
        else li.removeAttribute('aria-current');
      }
    }

    function updateDetailBodyClass() {
      if (!started) {
        document.body.classList.remove('market-step3-detail-overview');
        document.body.classList.remove('market-step3-detail-spotlight');
        document.body.classList.remove('tutorial-fx-spotlight');
        return;
      }
      var inDetail = current >= STEP_CHART && current <= STEP_INVESTOR;
      document.body.classList.toggle('market-step3-detail-spotlight', inDetail || current === STEP_FINAL);
      document.body.classList.toggle('market-step3-detail-overview', current === STEP_CHART);
      document.body.classList.toggle('tutorial-fx-spotlight', current === STEP_PICK || inDetail || current === STEP_FINAL);
    }

    function showCoach(step, after) {
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        if (typeof after === 'function') after();
        return;
      }
      window.MascotCoach.show({
        mood: step.mood || 'info',
        title: '루미 가이드',
        text: step.coach || '',
        confirmLabel: '확인',
        onConfirm: function () {
          if (typeof after === 'function') after();
          else proceed();
        },
      });
    }

    function runQuizThenFinal() {
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        render(STEP_FINAL);
        return;
      }
      function finishQuizSuccess() {
        window.MascotCoach.show({
          mood: 'success',
          title: '루미 가이드',
          text: '좋아! 판단 순서를 잘 잡았어. 3단계 완료!',
          confirmLabel: '확인',
          onConfirm: function () { render(STEP_FINAL); },
        });
      }
      function wrongThenNext(idx) {
        var q = STEP3_QUIZ[idx];
        window.MascotCoach.show({
          mood: 'caution',
          title: '루미 가이드',
          text: '아쉽지만 오답이야.\n' + q.wrongHint,
          confirmLabel: '다음 문제',
          onConfirm: function () { showQuizAt(idx + 1); },
        });
      }
      function rightThenNext(idx) {
        var q = STEP3_QUIZ[idx];
        window.MascotCoach.show({
          mood: 'success',
          title: '루미 가이드',
          text: '정답이야!\n' + (q.correctHint || ''),
          confirmLabel: '다음 문제',
          onConfirm: function () { showQuizAt(idx + 1); },
        });
      }
      function showQuizAt(idx) {
        if (idx >= STEP3_QUIZ.length) return finishQuizSuccess();
        var q = STEP3_QUIZ[idx];
        window.MascotCoach.show({
          mood: 'info',
          title: '루미 퀴즈',
          text: q.text,
          confirmLabel: 'O',
          dismissLabel: 'X',
          onConfirm: function () {
            if (q.correct === 1) rightThenNext(idx);
            else wrongThenNext(idx);
          },
          onDismiss: function () {
            if (q.correct === 2) rightThenNext(idx);
            else wrongThenNext(idx);
          },
        });
      }
      showQuizAt(0);
    }

    function render(stepIndex) {
      current = clamp(stepIndex, 0, STEPS.length - 1);
      var step = STEPS[current];
      nowEl.textContent = step.objective || '—';

      applyTargetsFromStep(step);
      document.body.classList.toggle('market-step3-pick-lock', started && current === STEP_PICK);
      document.body.classList.toggle('market-step3-pick-pulse', started && current === STEP_PICK);
      document.body.classList.toggle('tutorial-fx-pick-pulse', started && current === STEP_PICK);
      var dim = started && !document.body.classList.contains('market-step3-clear-phase') && current !== STEP_PICK;
      overlay.classList.toggle('is-dim', Boolean(dim));
      updateDetailBodyClass();
      updateQuestChecklist();
      showCoach(step);
    }

    function proceed() {
      if (!started) return;
      var step = STEPS[current];
      if (!step || typeof step.done !== 'function') return;
      if (!step.done()) {
        showCoach(step);
        return;
      }

      if (current === STEP_CTA) {
        clearTargets();
        overlay.classList.add('is-dim');
        updateQuestChecklist();
        runQuizThenFinal();
        return;
      }

      if (current >= STEPS.length - 1) {
        clearTargets();
        pendingStripTutorial = true;
        document.body.classList.add('market-step3-clear-phase');
        document.body.classList.add('tutorial-fx-clear');
        overlay.classList.remove('is-dim');
        overlay.classList.add('is-clear-dim');
        clearEl.classList.add('is-show');
        document.body.classList.remove('market-step3-detail-overview');
        document.body.classList.remove('market-step3-detail-spotlight');
        updateQuestChecklist();
        setTimeout(function () {
          close(false);
        }, 1200);
        return;
      }

      render(current + 1);
    }

    function close(fromUserQuit) {
      if (pendingStripTutorial) {
        try {
          var m = parseInt(localStorage.getItem(TUTORIAL_MASK_KEY), 10);
          if (isNaN(m) || m < 0) m = 0;
          m |= 1 << 2;
          localStorage.setItem(TUTORIAL_MASK_KEY, String(m));
        } catch (e) { /* ignore */ }
        pendingStripTutorial = false;
        stripTutorialParamFromUrl();
      }
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      questHud.classList.remove('is-open');
      questHud.setAttribute('aria-hidden', 'true');
      clearEl.classList.remove('is-show');
      overlay.classList.remove('is-clear-dim');
      document.body.classList.remove('market-step3-clear-phase');
      document.body.classList.remove('market-step3-active');
      document.body.classList.remove('tutorial-fx-active');
      document.body.classList.remove('tutorial-fx-spotlight');
      document.body.classList.remove('tutorial-fx-clear');
      document.body.classList.remove('tutorial-fx-pick-pulse');
      document.body.classList.remove('market-step3-detail-overview');
      document.body.classList.remove('market-step3-detail-spotlight');
      document.body.classList.remove('market-step3-pick-pulse');
      document.body.classList.remove('market-step3-pick-lock');
      clearTargets();
      started = false;
      interaction.openedDetail = false;
      pickHandled = false;
      overlay.classList.remove('is-dim');
      if (pickPulseKeepAlive) {
        window.clearInterval(pickPulseKeepAlive);
        pickPulseKeepAlive = null;
      }
      if (window.MascotCoach && typeof window.MascotCoach.close === 'function') {
        window.MascotCoach.close();
      }
      if (fromUserQuit === true && window.MascotCoach && typeof window.MascotCoach.hideDock === 'function') {
        window.MascotCoach.hideDock();
      }
    }

    function open() {
      started = true;
      interaction.openedDetail = false;
      pickHandled = false;
      pendingStripTutorial = false;
      if (pickPulseKeepAlive) {
        window.clearInterval(pickPulseKeepAlive);
      }
      pickPulseKeepAlive = window.setInterval(ensurePickTargetPulse, 350);
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      questHud.classList.add('is-open');
      questHud.setAttribute('aria-hidden', 'false');
      document.body.classList.add('market-step3-active');
      document.body.classList.add('tutorial-fx-active');
      if (bannerEl) {
        bannerEl.classList.remove('is-hide');
        window.setTimeout(function () {
          if (bannerEl) bannerEl.classList.add('is-hide');
        }, 1400);
      }
      render(STEP_WELCOME);
    }

    function showIntro() {
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        open();
        return;
      }
      window.MascotCoach.show({
        mood: 'welcome',
        title: '루미',
        text:
          '이제 3단계야! 차트·거래량·수급을 순서대로 보고 판단하는 루틴을 같이 연습해 보자.',
        confirmLabel: '확인',
        onConfirm: function () { open(); },
      });
    }

    closeBtn.addEventListener('click', function () {
      close(true);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && overlay.classList.contains('is-open')) {
        close(true);
      }
    });

    document.addEventListener(
      'click',
      function (event) {
        var row = event.target && event.target.closest ? event.target.closest('.stock-row') : null;
        if (!row || !started) return;
        if (current !== STEP_PICK) return;
        if (pickHandled) return;
        var code = row.id && row.id.indexOf('row-') === 0 ? row.id.slice(4) : '';
        if (code && code !== STEP3_EXPECTED_CODE) {
          if (window.MascotCoach && typeof window.MascotCoach.show === 'function') {
            window.MascotCoach.show({
              mood: 'caution',
              title: '루미 가이드',
              text: '삼성전자(005930) 행을 눌러 줘.',
              confirmLabel: '확인',
              onConfirm: function () {},
            });
          }
          return;
        }
        pickHandled = true;
        interaction.openedDetail = true;
        window.setTimeout(function () {
          render(STEP_CHART);
        }, 420);
      },
      false
    );

    var params = new URLSearchParams(window.location.search);
    var tutorial = (params.get('tutorial') || '').toLowerCase().trim();
    if (tutorial === 'step3' || tutorial === '3') {
      showIntro();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
