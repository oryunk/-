/**
 * 파일: market.html 3단계 튜토리얼 (숫자 근거 · 재무 차트)
 */
(function () {
  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  var TUTORIAL_MASK_KEY = 'jurinGuideTutorialBits';
  var STEP3_EXPECTED_CODE = '005930';

  var PICK_COACH_TEXT =
    '목록에서 삼성전자(005930) 행을 눌러 줘. 상세로 들어가면 재무·가치 차트에서 PER·매출·부채를 왼쪽부터 볼 수 있어. 그게 이 단계의 시작이야.';

  var STEP_IDX = {
    welcome: -1,
    pick: -1,
    chartIntro: -1,
    mcap: -1,
    table: -1,
    final: -1,
  };

  var TAB_FIRST_COACH = {
    valuation: '가치 비교 탭이야. 왼쪽부터 ',
    performance: '재무 성과 탭이야. 왼쪽부터 ',
    balance: '재무상태표 탭이야. 왼쪽부터 ',
  };

  var VALUATION_METRICS = ['PER', 'PBR', 'PSR'];
  var PERFORMANCE_METRICS = ['매출', '영업이익', '순이익', 'EPS'];
  var BALANCE_METRICS = ['총자산', '총부채', '자본총계', '현금성자산'];

  var METRIC_COACH = {
    PER: {
      mood: 'info',
      coach: 'PER은 이익 대비 주가가 비싼지·싼지 보는 지표야.',
      coachPlain: '우리 종목 막대와 업종 평균 막대 길이를 비교해 봐.',
    },
    PBR: {
      mood: 'wink',
      coach: 'PBR은 자산 대비 주가 수준이야. PER과 같이 업종 평균과 비교하는 습관을 들이면 돼.',
    },
    PSR: {
      mood: 'info',
      coach: 'PSR은 매출 대비 주가 수준이야. 매출이 큰데 주가가 상대적으로 낮은지 볼 때 써.',
      coachPlain: '업종 평균과 함께 보면 「매출 대비 싼지」 감이 잡혀.',
    },
    매출: {
      mood: 'info',
      coach: '매출은 회사가 얼마나 팔았는지 보여 줘. 우상향이면 성장, 하락이면 위축 신호로 볼 수 있어.',
    },
    영업이익: {
      mood: 'success',
      coach: '영업이익은 본업에서 벌어들인 이익이야. 매출만 늘고 영업이익이 줄면 수익성이 나빠진 걸 수 있어.',
    },
    순이익: {
      mood: 'info',
      coach: '순이익은 모든 비용을 뺀 최종 이익이야. 주주 입장에서 「남는 돈」에 가깝게 보면 돼.',
    },
    EPS: {
      mood: 'wink',
      coach: 'EPS는 주식 1주당 순이익이야. PER 계산의 기초가 되기도 해.',
      coachPlain: 'EPS가 꾸준히 오르면 이익 창출력이 좋아진 신호로 볼 수 있어.',
    },
    총자산: {
      mood: 'info',
      coach: '총자산은 회사가 가진 자산 전체 규모야. 회사 「몸집」의 재무 버전이라고 보면 돼.',
    },
    총부채: {
      mood: 'caution',
      coach: '총부채는 회사가 갚아야 할 빚의 규모야.',
      coachPlain: '매출·이익이 좋아도 부채가 같이 늘었는지 꼭 확인해.',
    },
    자본총계: {
      mood: 'success',
      coach: '자본총계는 주주 몫 순자산이야. 부채를 뺀 「진짜 내 몫」에 가깝게 보면 돼.',
    },
    현금성자산: {
      mood: 'info',
      coach: '현금성자산은 당장 쓸 수 있는 현금·예금에 가까운 자산이야.',
      coachPlain: '위기 때 버티는 힘(유동성)을 볼 때 참고해.',
    },
  };

  var interaction = {
    openedDetail: false,
  };

  var STEP3_QUIZ = [
    {
      text: '문제 1/5 (O/X)\nPER은 이익 대비 현재 주가 수준을 볼 때 쓰는 지표다.',
      correct: 1,
      correctHint: '맞아! PER은 주가가 이익 대비 어느 수준인지 보는 대표 지표야.',
      wrongHint: 'PER은 이익 대비 주가 수준이야. 배당 비율과는 다른 개념이지.',
    },
    {
      text: '문제 2/5 (O/X)\nPBR이 낮으면 무조건 우량주라서 바로 매수해도 된다.',
      correct: 2,
      correctHint: '맞아! PBR 하나만으로는 결론을 못 내리고 다른 지표와 함께 봐야 해.',
      wrongHint: 'PBR은 참고 지표일 뿐이야. 단일 숫자로 바로 매수 결론을 내리면 위험해.',
    },
    {
      text: '문제 3/5 (O/X)\n시가총액(시총)은 회사 규모를 가늠할 때 쓴다.',
      correct: 1,
      correctHint: '정답이야! 시총은 주가 × 주식 수로 회사 크기 감각을 잡을 때 써.',
      wrongHint: '시가총액은 회사 규모 감각에 쓰는 지표야. PER과는 다른 정보지.',
    },
    {
      text: '문제 4/5 (O/X)\n매출이 늘면 항상 좋은 주식이다.',
      correct: 2,
      correctHint: '맞아! 매출만 보지 말고 이익·부채·밸류 지표도 같이 봐야 해.',
      wrongHint: '매출 증가는 긍정적일 수 있지만, 항상 매수 신호는 아니야.',
    },
    {
      text: '문제 5/5 (O/X)\n차트로 흐름을 보고, 자세한 숫자는 「표로 보기」에서 확인할 수 있다.',
      correct: 1,
      correctHint: '맞아! 그래프로 흐름을 보고, 표는 필요할 때 펼쳐 보면 돼.',
      wrongHint: '재무 차트가 한눈에 보기용이고, 표는 숫자를 꼼꼼히 볼 때 써.',
    },
  ];

  function isSamsungDetailOpen() {
    var view = document.getElementById('stockDetailView');
    if (!view || view.classList.contains('hidden') || view.getAttribute('aria-hidden') === 'true') {
      return false;
    }
    var logo = document.getElementById('detailLogoImg');
    if (logo && logo.getAttribute('data-logo-file') === STEP3_EXPECTED_CODE) return true;
    var name = document.getElementById('detailName');
    if (name) {
      var t = name.textContent || '';
      if (t.indexOf('삼성전자') >= 0 || t.indexOf('005930') >= 0) return true;
    }
    return false;
  }

  function metricCardByLabel(label) {
    var items = document.querySelectorAll('#indicatorGrid .metric-item');
    for (var i = 0; i < items.length; i++) {
      var lbl = items[i].querySelector('.metric-item-label');
      if (lbl && lbl.textContent.trim() === label) return items[i];
    }
    return null;
  }

  function finMetricChip(label) {
    var chips = document.querySelectorAll('#detailFinMetricChips .detail-fin-metric-chip');
    for (var i = 0; i < chips.length; i++) {
      if (chips[i].getAttribute('data-fin-metric') === label) return chips[i];
    }
    return null;
  }

  function finMetricTargets(metric) {
    var chip = metric ? finMetricChip(metric) : null;
    return chip ? [chip] : [];
  }

  function clickFinCategory(cat) {
    var btn = document.querySelector('.detail-fin-chart-seg[data-fin-cat="' + cat + '"]');
    if (btn && typeof btn.click === 'function') btn.click();
  }

  function clickFinMetric(label) {
    var chip = finMetricChip(label);
    if (chip && typeof chip.click === 'function') chip.click();
  }

  function ensureFinChartState(cat, metric, done) {
    if (typeof window.jurinSetFinChartState === 'function') {
      window.jurinSetFinChartState(cat, metric);
      window.setTimeout(function () {
        if (typeof done === 'function') done();
      }, 80);
      return;
    }
    var activeSeg = document.querySelector('.detail-fin-chart-seg.active');
    var currentCat = activeSeg ? activeSeg.getAttribute('data-fin-cat') : '';
    if (currentCat !== cat) clickFinCategory(cat);
    window.setTimeout(
      function () {
        if (metric) {
          var chip = finMetricChip(metric);
          if (chip) clickFinMetric(metric);
        }
        window.setTimeout(function () {
          if (typeof done === 'function') done();
        }, 120);
      },
      currentCat === cat ? 0 : 120
    );
  }

  function makeFinMetricStep(cat, metric, tabLabel, isFirstInTab) {
    var meta = METRIC_COACH[metric] || {
      mood: 'info',
      coach: tabLabel + ' 차트에서 「' + metric + '」 지표를 보고 있어.',
    };
    var coachText = meta.coach || '';
    if (isFirstInTab && TAB_FIRST_COACH[cat]) {
      coachText = TAB_FIRST_COACH[cat] + metric + '부터 보자. ' + coachText;
    }
    return {
      kind: 'fin-metric',
      finCat: cat,
      finMetric: metric,
      objective: metric + ' (' + tabLabel + ')',
      mood: meta.mood || 'info',
      coach: coachText,
      coachPlain: meta.coachPlain || '',
      onEnter: function (next) {
        ensureFinChartState(cat, metric, next);
      },
      targets: function () {
        return finMetricTargets(metric);
      },
      done: function () {
        return isSamsungDetailOpen();
      },
    };
  }

  function buildSteps() {
    var steps = [];
    function add(step) {
      steps.push(step);
      return steps.length - 1;
    }

    STEP_IDX.welcome = add({
      kind: 'welcome',
      objective: '목표: 숫자 근거로 종목 가치 보기',
      mood: 'welcome',
      coach: '3단계는 「좋아 보여서」가 아니라 숫자 근거로 보는 연습이야.',
      coachPlain:
        '가치 비교·재무 성과·재무상태표 칩을 왼쪽부터 보며, 숫자 근거로 종목 가치를 보는 연습이야.',
      targets: function () {
        var g = document.getElementById('indicesGrid');
        return g ? [g] : [];
      },
      done: function () {
        return true;
      },
    });

    STEP_IDX.pick = add({
      kind: 'pick',
      requiresPick: true,
      objective: '목표: 삼성전자 상세 열기',
      mood: 'info',
      coach: PICK_COACH_TEXT,
      targets: function () {
        var row = document.querySelector('#row-' + STEP3_EXPECTED_CODE);
        return row ? [row] : [];
      },
      done: function () {
        return isSamsungDetailOpen();
      },
    });

    STEP_IDX.chartIntro = add({
      kind: 'fin-intro',
      objective: '재무·가치 차트 구역',
      mood: 'welcome',
      coach:
        '여기 재무·가치 차트야. 가치 비교 → 재무 성과 → 재무상태표 순으로, 각 탭 칩을 왼쪽부터 차례로 볼 거야.',
      onEnter: function (next) {
        ensureFinChartState('valuation', 'PER', next);
      },
      targets: function () {
        return finMetricTargets('PER');
      },
      done: function () {
        return isSamsungDetailOpen();
      },
    });

    var vi;
    for (vi = 0; vi < VALUATION_METRICS.length; vi++) {
      add(makeFinMetricStep('valuation', VALUATION_METRICS[vi], '가치 비교', false));
    }

    var pi;
    for (pi = 0; pi < PERFORMANCE_METRICS.length; pi++) {
      add(makeFinMetricStep('performance', PERFORMANCE_METRICS[pi], '재무 성과', pi === 0));
    }

    var bi;
    for (bi = 0; bi < BALANCE_METRICS.length; bi++) {
      add(makeFinMetricStep('balance', BALANCE_METRICS[bi], '재무상태표', bi === 0));
    }

    STEP_IDX.mcap = add({
      kind: 'mcap',
      objective: '용어: 시가총액(시총)',
      mood: 'info',
      coach: '시가총액은 회사 전체 크기 감각이야. 주가 × 상장 주식 수에 가깝게 보면 돼.',
      coachPlain: '「이 회사가 시장에서 얼마나 큰지」를 가늠할 때 참고하면 좋아.',
      targets: function () {
        var card = metricCardByLabel('시가총액');
        if (card) return [card];
        var g = document.getElementById('indicatorGrid');
        return g ? [g] : [];
      },
      done: function () {
        return isSamsungDetailOpen();
      },
    });

    add({
      kind: 'roe',
      objective: 'ROE (투자 지표 카드)',
      mood: 'success',
      coach: 'ROE는 자본을 얼마나 효율적으로 이익으로 바꿨는지 보여 줘.',
      coachPlain: '수익성만 볼 때 자주 쓰는 지표야. PER·PBR과 함께 보면 균형이 좋아.',
      targets: function () {
        var card = metricCardByLabel('ROE');
        if (card) return [card];
        var g = document.getElementById('indicatorGrid');
        return g ? [g] : [];
      },
      done: function () {
        return isSamsungDetailOpen();
      },
    });

    add({
      kind: 'dividend',
      objective: '배당·안정성',
      mood: 'success',
      coach: '배당수익률은 주주에게 돌려준 현금 흐름 매력을 보여 줘.',
      coachPlain: '부채비율도 같이 보면, 이익만큼 빚이 무겁지 않은지 감 잡을 수 있어.',
      targets: function () {
        var el = document.getElementById('stabilityDividendGrid');
        return el ? [el] : [];
      },
      done: function () {
        return isSamsungDetailOpen();
      },
    });

    STEP_IDX.table = add({
      kind: 'table',
      triggersQuiz: true,
      objective: '표로 보기',
      mood: 'wink',
      coach:
        '지표 설명은 여기까지야. 숫자를 한눈에 표로 보려면 아래 「표로 보기」를 펼치면 돼.',
      targets: function () {
        var d = document.querySelector('details.detail-tables-details');
        return d ? [d] : [];
      },
      done: function () {
        return true;
      },
    });

    STEP_IDX.final = add({
      kind: 'final',
      objective: '3단계 클리어',
      mood: 'success',
      coach:
        '좋아! 가치 비교·재무 성과·재무상태표 지표를 차트로 읽는 루틴을 갖췄어. 다른 종목에도 같은 순서로 적용해 봐.',
      targets: function () {
        return [];
      },
      done: function () {
        return true;
      },
    });

    return steps;
  }

  var STEPS = buildSteps();

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
    } catch (e) {
      /* ignore */
    }
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
      var bottomMargin = 200;
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

  function isChartBrightStep(step) {
    if (!step || !step.kind) return false;
    var k = step.kind;
    return (
      k === 'mcap' ||
      k === 'roe' ||
      k === 'dividend' ||
      k === 'fin-intro' ||
      k === 'fin-metric'
    );
  }

  function init() {
    var overlay = getEl('marketStep3Overlay');
    var questHud = getEl('marketStep3QuestHud');
    var panel = questHud ? questHud.querySelector('.market-step3-panel') : null;
    var bannerEl = questHud ? questHud.querySelector('.market-step3-banner') : null;
    var nowEl = getEl('marketStep3Now');
    var progressEl = getEl('marketStep3Progress');
    var clearEl = getEl('marketStep3Clear');
    var questItems = panel ? panel.querySelectorAll('.market-step3-quest-item') : [];

    if (!overlay || !questHud || !panel || !nowEl || !progressEl || !clearEl || questItems.length !== 3) {
      return;
    }

    var current = 0;
    var activeTargets = [];
    var started = false;
    var pickHandled = false;
    var pendingStripTutorial = false;
    var step3QuizActive = false;
    var step3PickSweatMode = false;
    var pickPulseKeepAlive = null;

    function clearTargets() {
      activeTargets.forEach(function (el) {
        if (el && el.classList) el.classList.remove('tutorial-callout-target');
      });
      activeTargets = [];
    }

    function ensurePickTargetPulse() {
      if (!started || current !== STEP_IDX.pick || pickHandled) return;
      var row = document.querySelector('#row-' + STEP3_EXPECTED_CODE);
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
      var q1Done = started && current > STEP_IDX.pick;
      var q2Done = started && (current > STEP_IDX.table || step3QuizActive);
      var q3Done = started && clearPhase;
      var q1Current = started && !q1Done && current === STEP_IDX.pick;
      var q2Current =
        started &&
        q1Done &&
        !q2Done &&
        current >= STEP_IDX.chartIntro &&
        current <= STEP_IDX.table &&
        !step3QuizActive;
      var q3Current = started && q2Done && !q3Done && (step3QuizActive || current >= STEP_IDX.final);

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

    function updateDetailBodyClass(step) {
      if (!started) {
        document.body.classList.remove('market-step3-detail-overview');
        document.body.classList.remove('market-step3-detail-spotlight');
        document.body.classList.remove('market-step3-chart-bright');
        document.body.classList.remove('tutorial-fx-spotlight');
        return;
      }
      var inDetail =
        current >= STEP_IDX.chartIntro &&
        current <= STEP_IDX.table &&
        current !== STEP_IDX.pick;
      document.body.classList.toggle('market-step3-detail-spotlight', inDetail || current === STEP_IDX.final);
      document.body.classList.remove('market-step3-detail-overview');
      document.body.classList.toggle('market-step3-chart-bright', isChartBrightStep(step));
      document.body.classList.toggle(
        'tutorial-fx-spotlight',
        current === STEP_IDX.pick || inDetail || step.kind === 'table'
      );
    }

    function showPickBlockedCoach() {
      step3PickSweatMode = true;
      presentPickCoach();
    }

    function presentPickCoach() {
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        tryAdvanceFromCoach();
        return;
      }
      window.MascotCoach.show({
        mood: step3PickSweatMode ? 'caution' : 'info',
        title: '루미 가이드',
        text: PICK_COACH_TEXT,
        confirmLabel: '확인',
        instantText: false,
        onConfirm: function () {
          tryAdvanceFromCoach();
        },
      });
    }

    function presentStepCoach(step) {
      if (step && step.requiresPick) {
        presentPickCoach();
        return;
      }
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        if (step.triggersQuiz) runQuizThenFinal();
        else tryAdvanceFromCoach();
        return;
      }
      function advanceAfterPlain() {
        tryAdvanceFromCoach();
      }
      function openPlainModal() {
        window.MascotCoach.show({
          mood: step.moodPlain || step.mood || 'info',
          title: '루미 가이드',
          text: step.coachPlain || '',
          confirmLabel: '확인',
          instantText: false,
          onConfirm: advanceAfterPlain,
        });
      }
      window.MascotCoach.show({
        mood: step.mood || 'info',
        title: '루미 가이드',
        text: step.coach || '',
        confirmLabel: '확인',
        instantText: false,
        onConfirm: function () {
          if (step.coachPlain) openPlainModal();
          else advanceAfterPlain();
        },
      });
    }

    function tryAdvanceFromCoach() {
      var step = STEPS[current];
      if (step && typeof step.done === 'function' && !step.done()) {
        if (step.requiresPick) showPickBlockedCoach();
        else runStepCoach(step);
        return;
      }
      if (step && step.triggersQuiz) {
        runQuizThenFinal();
        return;
      }
      if (current >= STEP_IDX.final) {
        proceed();
        return;
      }
      render(current + 1);
    }

    function runStepCoach(step) {
      if (step && typeof step.onEnter === 'function') {
        step.onEnter(function () {
          applyTargetsFromStep(step);
          updateDetailBodyClass(step);
          updateQuestChecklist();
          presentStepCoach(step);
        });
        return;
      }
      presentStepCoach(step);
    }

    function runQuizThenFinal() {
      step3QuizActive = true;
      updateQuestChecklist();
      overlay.classList.add('is-dim');
      clearTargets();
      document.body.classList.remove('market-step3-chart-bright');
      updateDetailBodyClass(STEPS[current]);
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        step3QuizActive = false;
        render(STEP_IDX.final);
        return;
      }
      function finishQuizSuccess() {
        step3QuizActive = false;
        updateQuestChecklist();
        window.MascotCoach.show({
          mood: 'success',
          title: '루미 가이드',
          text: '5문제 모두 확인했어! 숫자 근거로 종목을 보는 연습 수고했어.',
          confirmLabel: '확인',
          onConfirm: function () {
            render(STEP_IDX.final);
          },
        });
      }
      function wrongThenNext(idx) {
        var q = STEP3_QUIZ[idx];
        window.MascotCoach.show({
          mood: 'caution',
          title: '루미 가이드',
          text: '아쉽지만 오답이야.\n' + q.wrongHint,
          confirmLabel: '다음 문제',
          onConfirm: function () {
            showQuizAt(idx + 1);
          },
        });
      }
      function rightThenNext(idx) {
        var q = STEP3_QUIZ[idx];
        window.MascotCoach.show({
          mood: 'success',
          title: '루미 가이드',
          text: '정답이야!\n' + (q.correctHint || ''),
          confirmLabel: '다음 문제',
          onConfirm: function () {
            showQuizAt(idx + 1);
          },
        });
      }
      function showQuizAt(idx) {
        if (idx >= STEP3_QUIZ.length) {
          finishQuizSuccess();
          return;
        }
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

      if (current === STEP_IDX.pick) {
        interaction.openedDetail = isSamsungDetailOpen();
        if (!interaction.openedDetail) pickHandled = false;
      }

      nowEl.textContent = step.objective || '—';

      applyTargetsFromStep(step);
      document.body.classList.toggle('market-step3-pick-lock', started && current === STEP_IDX.pick);
      document.body.classList.toggle('market-step3-pick-pulse', started && current === STEP_IDX.pick);
      document.body.classList.toggle('tutorial-fx-pick-pulse', started && current === STEP_IDX.pick);

      var chartBright = isChartBrightStep(step);
      var dim =
        started &&
        !document.body.classList.contains('market-step3-clear-phase') &&
        current !== STEP_IDX.pick &&
        !step3QuizActive &&
        !chartBright;
      overlay.classList.toggle('is-dim', Boolean(dim));

      updateDetailBodyClass(step);
      updateQuestChecklist();
      syncTutorialGuard();
      runStepCoach(step);
    }

    function proceed() {
      if (!started) return;
      var step = STEPS[current];
      if (!step || typeof step.done !== 'function') return;
      if (!step.done()) {
        if (step.requiresPick) showPickBlockedCoach();
        else runStepCoach(step);
        return;
      }

      if (current >= STEPS.length - 1) {
        clearTargets();
        if (window.MascotCoach && typeof window.MascotCoach.close === 'function') {
          window.MascotCoach.close();
        }
        pendingStripTutorial = true;
        document.body.classList.add('market-step3-clear-phase');
        document.body.classList.add('tutorial-fx-clear');
        overlay.classList.remove('is-dim');
        overlay.classList.add('is-clear-dim');
        clearEl.classList.add('is-show');
        document.body.classList.remove('market-step3-detail-spotlight');
        document.body.classList.remove('market-step3-chart-bright');
        updateQuestChecklist();
        setTimeout(function () {
          close(false);
        }, 1200);
        return;
      }

      render(current + 1);
    }

    function close(fromUserQuit) {
      step3QuizActive = false;
      step3PickSweatMode = false;
      if (pendingStripTutorial) {
        try {
          var m = parseInt(localStorage.getItem(TUTORIAL_MASK_KEY), 10);
          if (isNaN(m) || m < 0) m = 0;
          m |= 1 << 2;
          localStorage.setItem(TUTORIAL_MASK_KEY, String(m));
        } catch (e) {
          /* ignore */
        }
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
      document.body.classList.remove('market-step3-chart-bright');
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
      if (window.JurinTutorialGuard && typeof window.JurinTutorialGuard.clear === 'function') {
        window.JurinTutorialGuard.clear();
      }
      window.__jurinGuideQuit = null;
    }

    function isStrictMisclickStep() {
      if (step3QuizActive) return false;
      return current === STEP_IDX.pick && !pickHandled;
    }

    function syncTutorialGuard() {
      if (!window.JurinTutorialGuard || typeof window.JurinTutorialGuard.set !== 'function') return;
      window.JurinTutorialGuard.set({
        isActive: function () {
          return (
            started &&
            overlay.classList.contains('is-open') &&
            !document.body.classList.contains('market-step3-clear-phase') &&
            !step3QuizActive
          );
        },
        allowsClick: function (target) {
          var G = window.JurinTutorialGuard;
          if (G.allowsMascotAndQuest(target, 'marketStep3QuestHud', '.market-step3-panel')) return true;
          if (!isStrictMisclickStep()) return true;
          return pickStepAllowsClick(target);
        },
        getWrongMessage: function (target) {
          if (!isStrictMisclickStep()) return null;
          return '앗, 그건 아니야! 삼성전자(005930) 행을 눌러 상세 화면을 열어줘.';
        },
        onAfterWrong: function () {
          if (step3QuizActive) return;
          window.JurinTutorialGuard.restoreDockOrFallback(function () {
            step3PickSweatMode = true;
            presentPickCoach();
          });
        },
      });
    }

    function open() {
      started = true;
      interaction.openedDetail = false;
      pickHandled = false;
      pendingStripTutorial = false;
      step3QuizActive = false;
      step3PickSweatMode = false;
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
      window.__jurinGuideQuit = function () {
        close(true);
      };
      syncTutorialGuard();
      render(STEP_IDX.welcome);
    }

    function showIntro() {
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        open();
        return;
      }
      window.MascotCoach.show({
        mood: 'welcome',
        title: '루미',
        text: '3단계야! 숫자 근거로 종목 가치를 보는 연습을 같이 해 보자. 확인 누르면 시작!',
        confirmLabel: '확인',
        onConfirm: function () {
          open();
        },
      });
      window.__jurinGuideQuit = function () {
        close(true);
      };
    }

    function waitForSamsungDetailThenAdvance(attempt) {
      if (isSamsungDetailOpen()) {
        interaction.openedDetail = true;
        step3PickSweatMode = false;
        render(STEP_IDX.chartIntro);
        return;
      }
      if (attempt >= 30) {
        pickHandled = false;
        interaction.openedDetail = false;
        showPickBlockedCoach();
        return;
      }
      window.setTimeout(function () {
        waitForSamsungDetailThenAdvance(attempt + 1);
      }, 120);
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && overlay.classList.contains('is-open')) {
        close(true);
      }
    });

    function pickStepAllowsClick(target) {
      if (!target || !target.closest) return false;
      if (target.closest('#mascotCoach')) return true;
      if (target.closest('#marketStep3QuestHud') && target.closest('.market-step3-panel')) return true;
      var row = target.closest('#row-' + STEP3_EXPECTED_CODE);
      if (row) return true;
      return false;
    }

    document.addEventListener(
      'click',
      function (event) {
        var row = event.target && event.target.closest ? event.target.closest('.stock-row') : null;
        if (!row || !started) return;
        if (current !== STEP_IDX.pick) return;
        if (pickHandled) return;
        var code = row.id && row.id.indexOf('row-') === 0 ? row.id.slice(4) : '';
        if (code && code !== STEP3_EXPECTED_CODE) {
          step3PickSweatMode = true;
          presentPickCoach();
          return;
        }
        pickHandled = true;
        waitForSamsungDetailThenAdvance(0);
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
