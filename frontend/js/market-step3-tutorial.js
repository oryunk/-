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
    '지금은 목록에서 삼성전자(005930) 행을 눌러 상세 화면을 열어줘.';

  var INTRO_BEATS = [
    '좋아! 이제 차트 보는 방법은 알게 됐어. 주가가 오를지 내릴만 보는 것보다 「이 회사가 지금 비싼지 싼지」 판단하는 것도 정말 중요해.',
    '이번 단계에서는 기업의 가치를 숫자로 확인하는 방법을 배워보자!',
    '주식은 결국 회사의 일부를 사는 거야. 투자할 때는 「이 회사가 어떤 회사인지」 확인해야 해.',
    'PER, PBR, ROE 같은 지표로 기업 가치를 숫자로 살펴볼 수 있어.',
    '시가총액은 주가 × 상장 주식 수로, 시장에서 평가하는 회사의 전체 가격이야.',
    '동네 편의점 1개와 전국 수천 매장 회사는 규모가 다르지? 시가총액은 그 규모를 한눈에 보여 줘.',
    'PER은 주가를 주당순이익(EPS)으로 나눈 값이야. 현재 이익 기준으로 몇 년치 가치를 인정받는지 보여 줘.',
    'PER이 10이면 10년치 이익 가치를 인정받는다는 뜻이야. 무조건 낮다고 좋은 건 아니고, 같은 업종끼리 비교하는 게 중요해!',
    'PBR은 주가를 순자산가치(BPS)로 나눈 값이야. 회사가 가진 자산 대비 주가 수준을 보여 줘.',
    'ROE는 자기자본 대비 이익을 보여 줘. 회사가 돈을 얼마나 효율적으로 벌었는지 확인하는 수치야.',
    '이제 상세 화면에서 직접 숫자를 확인해 보자! 확인을 누르면 삼성전자 상세로 들어갈 준비를 할게.',
  ];

  var INTRO_MOODS = [
    'welcome',
    'happy',
    'info',
    'info',
    'info',
    'wink',
    'curious',
    'info',
    'wink',
    'success',
    'excited',
  ];

  var STEP_IDX = {
    pick: -1,
    indicatorMission: -1,
    chartIntro: -1,
    termsStart: -1,
    termsEnd: -1,
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

  var INDICATOR_TERM_DEFS = [
    {
      label: '시가총액',
      mood: 'info',
      coach: '시가총액은 주가 × 상장 주식 수로 계산돼. 시장에서 평가하는 회사의 전체 가격이라고 보면 돼.',
      coachPlain: '「이 회사가 시장에서 얼마나 큰지」를 가늠할 때 참고하면 좋아.',
    },
    {
      label: '배당수익률',
      mood: 'success',
      coach: '배당수익률은 주주에게 돌려준 현금 흐름의 매력을 보여 줘.',
      coachPlain: '배당 정책이 있는 회사를 볼 때 자주 확인하는 지표야.',
    },
    {
      label: 'PER',
      mood: 'curious',
      coach: 'PER은 주가를 EPS로 나눈 값이야. 현재 이익 기준으로 몇 년치 가치를 인정받는지 보여 줘.',
      coachPlain: '같은 업종 평균과 비교하는 습관을 들이면 돼. 무조건 낮다고 좋은 건 아니야!',
    },
    {
      label: 'PBR',
      mood: 'wink',
      coach: 'PBR은 주가를 순자산가치(BPS)로 나눈 값이야. 자산 대비 주가 수준을 보여 줘.',
      coachPlain: '자산 가치보다 주가가 낮으면 저평가로 보는 경우도 있어. 업종과 함께 봐.',
    },
    {
      label: 'ROE',
      mood: 'success',
      coach: 'ROE는 자기자본 대비 이익을 보여 줘. 돈을 얼마나 효율적으로 벌었는지 확인하는 수치야.',
      coachPlain: 'ROE가 높을수록 수익성이 좋은 기업으로 평가받는 경우가 많아.',
    },
  ];

  var STABILITY_TERM_DEFS = [
    {
      label: '부채비율',
      mood: 'caution',
      coach: '부채비율은 빚이 자본 대비 얼마나 큰지 보여 줘.',
      coachPlain: '매출·이익이 좋아도 부채가 같이 늘었는지 꼭 확인해.',
    },
    {
      label: '유동비율',
      mood: 'info',
      coach: '유동비율은 단기 채무를 갚을 수 있는 능력에 가까운 지표야.',
      coachPlain: '당장 갚아야 할 빚 대비 현금·자산이 충분한지 볼 때 써.',
    },
    {
      label: '배당 지급 횟수',
      mood: 'info',
      coach: '배당 지급 횟수는 최근 몇 번 배당했는지 보여 줘.',
      coachPlain: '꾸준히 배당하는 회사인지 감 잡을 때 참고해.',
    },
    {
      label: '1주당 배당금',
      mood: 'wink',
      coach: '1주당 배당금은 내가 가진 주식 1주당 받은 배당 금액이야.',
      coachPlain: '배당수익률과 함께 보면 현금 흐름 감이 잡혀.',
    },
    {
      label: '배당수익률',
      mood: 'success',
      coach: '안정성/배당 구역의 배당수익률은 배당 정책 관점에서 다시 한번 볼 수 있어.',
      coachPlain: '투자 지표의 배당수익률과 숫자가 다를 수 있으니, 둘 다 맥락을 확인해.',
    },
  ];

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

  function metricCardByLabel(label, gridId) {
    var root = document.getElementById(gridId || 'indicatorGrid');
    if (!root) return null;
    var items = root.querySelectorAll('.metric-item');
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

  function finChartSectionTarget() {
    var sec = document.querySelector('[data-jurin-section="fin-chart"]');
    return sec ? [sec] : [];
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

  function makeTermStep(def, gridId) {
    return {
      kind: 'term',
      termLabel: def.label,
      termGridId: gridId,
      objective: '용어: ' + def.label,
      mood: def.mood || 'info',
      coach: def.coach || '',
      coachPlain: def.coachPlain || '',
      targets: function () {
        var card = metricCardByLabel(def.label, gridId);
        return card ? [card] : [];
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

    STEP_IDX.indicatorMission = add({
      kind: 'indicator-mission',
      objective: '투자 지표 확인하기',
      mood: 'curious',
      coach:
        '상세에 들어왔네! 위 투자 지표에서 PER, PBR, ROE 숫자를 찾아봐. 방금 배운 뜻을 떠올리면서 각 숫자가 어떤 의미인지 확인해 보자.',
      coachPlain: '이번 미션: 삼성전자 투자 지표에서 PER, PBR, ROE를 눈으로 확인하기!',
      targets: function () {
        var cards = ['PER', 'PBR', 'ROE']
          .map(function (l) {
            return metricCardByLabel(l, 'indicatorGrid');
          })
          .filter(Boolean);
        return cards;
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
        '이제 재무·가치 차트야. 가치 비교 → 재무 성과 → 재무상태표 순으로, 각 탭 칩을 왼쪽부터 차례로 볼 거야.',
      onEnter: function (next) {
        ensureFinChartState('valuation', 'PER', next);
      },
      targets: function () {
        return finChartSectionTarget();
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

    var ti;
    STEP_IDX.termsStart = -1;
    for (ti = 0; ti < INDICATOR_TERM_DEFS.length; ti++) {
      var idx = add(makeTermStep(INDICATOR_TERM_DEFS[ti], 'indicatorGrid'));
      if (STEP_IDX.termsStart < 0) STEP_IDX.termsStart = idx;
      STEP_IDX.termsEnd = idx;
    }
    for (ti = 0; ti < STABILITY_TERM_DEFS.length; ti++) {
      var sidx = add(makeTermStep(STABILITY_TERM_DEFS[ti], 'stabilityDividendGrid'));
      if (STEP_IDX.termsStart < 0) STEP_IDX.termsStart = sidx;
      STEP_IDX.termsEnd = sidx;
    }

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
        '잘했어! 이제 단순히 주가만 보는 게 아니라 기업 가치를 숫자로 해석하는 방법도 알게 됐네.',
      coachPlain:
        'PER, PBR, ROE 같은 지표를 함께 확인하는 습관을 들여 보자. 다음 단계에서는 ETF, ELW, 채권 같은 다양한 투자 상품을 알아볼 거야!',
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

  function isChartBrightStep() {
    return false;
  }

  function isFinChartStep(step) {
    return step && (step.kind === 'fin-intro' || step.kind === 'fin-metric');
  }

  function isTermStep(step) {
    return step && step.kind === 'term';
  }

  function isGuidedActionStep(step) {
    if (!step) return false;
    return (
      step.kind === 'pick' ||
      step.kind === 'indicator-mission' ||
      step.kind === 'fin-intro' ||
      step.kind === 'fin-metric' ||
      step.kind === 'term' ||
      step.kind === 'table'
    );
  }

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

  function getDetailJurinSection(key) {
    return document.querySelector('#stockDetailView [data-jurin-section="' + key + '"]');
  }

  function scrollTutorialRegionIntoView(topAnchor, bottomAnchor, opts) {
    opts = opts || {};
    if (!bottomAnchor || typeof bottomAnchor.getBoundingClientRect !== 'function') return;
    topAnchor = topAnchor || bottomAnchor;

    function run() {
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          var topRect = topAnchor.getBoundingClientRect();
          var bottomRect = bottomAnchor.getBoundingClientRect();
          var vh = window.innerHeight || document.documentElement.clientHeight;
          var topMargin = typeof opts.topMargin === 'number' ? opts.topMargin : 88;
          var bottomMargin = typeof opts.bottomMargin === 'number' ? opts.bottomMargin : 24;
          var coachReserve = typeof opts.coachBottomReserve === 'number' ? opts.coachBottomReserve : 240;
          var viewTop = topMargin;
          var viewBottom = vh - bottomMargin - coachReserve;
          var viewHeight = Math.max(120, viewBottom - viewTop);
          var scrollY = window.scrollY || document.documentElement.scrollTop || 0;
          var regionTop = topRect.top + scrollY;
          var regionBottom = bottomRect.bottom + scrollY;
          var regionHeight = regionBottom - regionTop;
          var targetScrollY;
          var align = opts.align || 'start';

          if (regionHeight <= viewHeight) {
            targetScrollY = regionTop - viewTop;
          } else if (align === 'fit-end') {
            targetScrollY = regionBottom - viewBottom;
            var minScroll = regionTop - viewTop;
            if (targetScrollY < minScroll) targetScrollY = minScroll;
          } else {
            targetScrollY = regionTop - viewTop;
          }

          targetScrollY = Math.max(0, targetScrollY);
          if (!opts.alwaysNudge && Math.abs(targetScrollY - scrollY) <= 5) return;
          try {
            window.scrollTo({ top: targetScrollY, left: 0, behavior: 'smooth' });
          } catch (e) {
            window.scrollTo(0, targetScrollY);
          }
        });
      });
    }

    if (opts.measureDelay) {
      window.setTimeout(run, opts.measureDelay);
    } else {
      run();
    }
  }

  function scrollStep3CompositeViewport(step) {
    var commonOpts = {
      topMargin: 88,
      bottomMargin: 24,
      coachBottomReserve: 240,
      alwaysNudge: true,
    };
    if (!step) return false;

    if (step.kind === 'fin-intro') {
      scrollTutorialRegionIntoView(
        getDetailJurinSection('indicators'),
        getDetailJurinSection('fin-chart'),
        Object.assign({ align: 'start', measureDelay: 160 }, commonOpts)
      );
      return true;
    }

    if (step.kind === 'term' && step.termGridId === 'stabilityDividendGrid') {
      var plot = document.getElementById('detailFinancialChart');
      var finSec = getDetailJurinSection('fin-chart');
      var stabSec = getDetailJurinSection('stability');
      scrollTutorialRegionIntoView(
        plot || finSec,
        stabSec,
        Object.assign({ align: 'fit-end' }, commonOpts)
      );
      return true;
    }

    return false;
  }

  function scrollTutorialTargetsIntoViewIfNeeded(elements, opts) {
    opts = opts || {};
    if (!elements || !elements.length) return;
    var primary = elements[0];
    if (!primary || typeof primary.getBoundingClientRect !== 'function') return;
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        var r = primary.getBoundingClientRect();
        var vh = window.innerHeight || document.documentElement.clientHeight;
        var vw = window.innerWidth || document.documentElement.clientWidth;
        var topMargin = typeof opts.topMargin === 'number' ? opts.topMargin : 100;
        var bottomMargin = typeof opts.bottomMargin === 'number' ? opts.bottomMargin : 40;
        var coachReserve = typeof opts.coachBottomReserve === 'number' ? opts.coachBottomReserve : 0;
        var sideMargin = 8;
        var viewBottom = vh - bottomMargin - coachReserve;
        var clipped =
          r.top < topMargin ||
          r.bottom > viewBottom ||
          r.left < sideMargin ||
          r.right > vw - sideMargin;
        var pinBottom = Boolean(opts.pinBottomAboveReserve);
        if (!pinBottom && !clipped && !opts.alwaysNudge) return;
        if (clipped || opts.alwaysNudge) {
          var block = opts.scrollBlock || 'center';
          if (pinBottom) block = 'nearest';
          try {
            primary.scrollIntoView({ behavior: 'smooth', block: block, inline: 'nearest' });
          } catch (e) {
            primary.scrollIntoView(true);
          }
        }
        if (pinBottom) {
          var reserve = typeof opts.coachBottomReserve === 'number' ? opts.coachBottomReserve : 240;
          var gap = typeof opts.pinGap === 'number' ? opts.pinGap : 14;
          var delay = typeof opts.pinDelay === 'number' ? opts.pinDelay : 480;
          window.setTimeout(function () {
            var r2 = primary.getBoundingClientRect();
            var vh2 = window.innerHeight || document.documentElement.clientHeight;
            var targetLine = vh2 - bottomMargin - reserve - gap;
            var delta = r2.bottom - targetLine;
            if (Math.abs(delta) > 5) {
              try {
                window.scrollBy({ top: delta, left: 0, behavior: 'smooth' });
              } catch (e2) {
                window.scrollBy(0, delta);
              }
            }
          }, delay);
        }
      });
    });
  }

  function init() {
    var overlay = getEl('marketStep3Overlay');
    var clearEl = getEl('marketStep3Clear');

    if (!overlay || !clearEl) {
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
    var introBeatIndex = 0;
    var introPhaseActive = false;

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

    function shouldAutoScrollForStep(step) {
      if (!step) return false;
      if (step.kind === 'pick') return !pickHandled;
      if (
        step.kind === 'indicator-mission' ||
        step.kind === 'fin-intro' ||
        step.kind === 'term'
      ) {
        return true;
      }
      return false;
    }

    function getAutoScrollOpts(step) {
      if (!step) return { topMargin: 88, bottomMargin: 24 };
      if (step.kind === 'pick') {
        return { topMargin: 88, bottomMargin: 24 };
      }
      var opts = {
        topMargin: 88,
        bottomMargin: 24,
        coachBottomReserve: 240,
        alwaysNudge: true,
      };
      if (step.kind === 'fin-intro') {
        opts.scrollBlock = 'start';
      } else {
        opts.scrollBlock = 'center';
      }
      return opts;
    }

    function applyTargetsFromStep(step, applyOpts) {
      applyOpts = applyOpts || {};
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
      if (!applyOpts.skipScroll && shouldAutoScrollForStep(step) && activeTargets.length) {
        if (!scrollStep3CompositeViewport(step)) {
          scrollTutorialTargetsIntoViewIfNeeded(activeTargets, getAutoScrollOpts(step));
        }
      }
    }

    function isCoachOnlyKind(step) {
      if (!step) return false;
      return step.kind === 'indicator-mission' || step.kind === 'term';
    }

    function updateDetailBodyClass(step) {
      if (!started) {
        document.body.classList.remove('market-step3-detail-overview');
        document.body.classList.remove('market-step3-detail-spotlight');
        document.body.classList.remove('market-step3-chart-bright');
        document.body.classList.remove('tutorial-fx-spotlight');
        return;
      }
      var finDetail =
        current >= STEP_IDX.indicatorMission &&
        current <= STEP_IDX.table &&
        current !== STEP_IDX.pick &&
        (isFinChartStep(step) || step.kind === 'indicator-mission' || step.kind === 'table');
      var termDetail =
        isTermStep(step) &&
        current >= STEP_IDX.termsStart &&
        current <= STEP_IDX.termsEnd;
      var inDetail = finDetail || termDetail || current === STEP_IDX.final;
      document.body.classList.toggle('market-step3-detail-spotlight', inDetail);
      document.body.classList.remove('market-step3-detail-overview');
      document.body.classList.remove('market-step3-chart-bright');
      document.body.classList.toggle(
        'tutorial-fx-spotlight',
        current === STEP_IDX.pick || inDetail
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
        mood: step3PickSweatMode ? 'angry' : 'info',
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
        beginClearPhase();
        return;
      }
      render(current + 1);
    }

    function runStepCoach(step) {
      if (step && typeof step.onEnter === 'function') {
        step.onEnter(function () {
          applyTargetsFromStep(step);
          updateDetailBodyClass(step);
          presentStepCoach(step);
        });
        return;
      }
      applyTargetsFromStep(step);
      updateDetailBodyClass(step);
      presentStepCoach(step);
    }

    function showFinalClearCoach(onDone) {
      var finalStep = STEPS[STEP_IDX.final];
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        if (typeof onDone === 'function') onDone();
        return;
      }
      window.MascotCoach.show({
        mood: finalStep.mood || 'success',
        title: '루미 가이드',
        text: finalStep.coach || '',
        confirmLabel: '확인',
        instantText: false,
        onConfirm: function () {
          if (finalStep.coachPlain) {
            window.MascotCoach.show({
              mood: finalStep.moodPlain || finalStep.mood || 'info',
              title: '루미 가이드',
              text: finalStep.coachPlain,
              confirmLabel: '확인',
              instantText: false,
              onConfirm: onDone,
            });
            return;
          }
          if (typeof onDone === 'function') onDone();
        },
      });
    }

    function beginClearPhase() {
      if (document.body.classList.contains('market-step3-clear-phase')) return;
      current = STEP_IDX.final;
      step3QuizActive = false;
      step3PickSweatMode = false;
      clearTargets();
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.remove('is-dim');
      overlay.classList.add('is-clear-dim');
      document.body.classList.add('market-step3-clear-phase');
      document.body.classList.add('tutorial-fx-clear');
      document.body.classList.remove('market-step3-detail-spotlight');
      document.body.classList.remove('market-step3-detail-overview');
      document.body.classList.remove('market-step3-chart-bright');
      document.body.classList.remove('tutorial-fx-spotlight');
      document.body.classList.remove('market-step3-pick-pulse');
      document.body.classList.remove('market-step3-pick-lock');
      document.body.classList.remove('tutorial-fx-pick-pulse');
      if (pickPulseKeepAlive) {
        window.clearInterval(pickPulseKeepAlive);
        pickPulseKeepAlive = null;
      }
      clearEl.classList.add('is-show');
      syncTutorialGuard();

      function finishAndGoGuide() {
        pendingStripTutorial = true;
        if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.markTutorialStepComplete === 'function') {
          window.JurinTutorialUtil.markTutorialStepComplete(3);
        } else {
          try {
            var m = parseInt(localStorage.getItem(TUTORIAL_MASK_KEY + ':anon'), 10);
            if (isNaN(m) || m < 0) m = 0;
            m |= 1 << 2;
            localStorage.setItem(TUTORIAL_MASK_KEY + ':anon', String(m));
          } catch (e) {
            /* ignore */
          }
        }
        pendingStripTutorial = false;
        stripTutorialParamFromUrl();
        if (window.JurinTutorialGuard && typeof window.JurinTutorialGuard.clear === 'function') {
          window.JurinTutorialGuard.clear();
        }
        window.__jurinGuideQuit = null;
        window.__marketStep3OnStocksRendered = null;
        if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.restoreNormalSiteUi === 'function') {
          window.JurinTutorialUtil.restoreNormalSiteUi({ stripTutorial: true });
        }
        window.location.replace('guide.html');
      }

      showFinalClearCoach(finishAndGoGuide);
    }

    function runQuizThenFinal() {
      step3QuizActive = true;
      overlay.classList.remove('is-dim');
      clearTargets();
      document.body.classList.remove('market-step3-chart-bright');
      updateDetailBodyClass(STEPS[current]);
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        step3QuizActive = false;
        beginClearPhase();
        return;
      }
      function finishQuizSuccess() {
        step3QuizActive = false;
        window.MascotCoach.show({
          mood: 'success',
          title: '루미 가이드',
          text: '5문제 모두 확인했어! 숫자 근거로 종목을 보는 연습 수고했어.',
          confirmLabel: '확인',
          onConfirm: beginClearPhase,
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

    function updatePickLockClass() {
      document.body.classList.toggle(
        'market-step3-pick-lock',
        started && current === STEP_IDX.pick && !pickHandled
      );
    }

    function render(stepIndex) {
      current = clamp(stepIndex, 0, STEPS.length - 1);
      var step = STEPS[current];

      if (current === STEP_IDX.pick) {
        interaction.openedDetail = isSamsungDetailOpen();
        if (!interaction.openedDetail) pickHandled = false;
      }

      applyTargetsFromStep(step, {
        skipScroll: step && typeof step.onEnter === 'function',
      });
      updatePickLockClass();
      document.body.classList.toggle('market-step3-pick-pulse', started && current === STEP_IDX.pick);
      document.body.classList.toggle('tutorial-fx-pick-pulse', started && current === STEP_IDX.pick);

      /* 상세·퀴즈 딤 없음 — 클리어 연출만 is-clear-dim */
      overlay.classList.remove('is-dim');

      updateDetailBodyClass(step);
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
        beginClearPhase();
        return;
      }

      render(current + 1);
    }

    function close(fromUserQuit) {
      step3QuizActive = false;
      step3PickSweatMode = false;
      introBeatIndex = 0;
      introPhaseActive = false;
      if (pendingStripTutorial) {
        if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.markTutorialStepComplete === 'function') {
          window.JurinTutorialUtil.markTutorialStepComplete(3);
        } else {
          try {
            var m = parseInt(localStorage.getItem(TUTORIAL_MASK_KEY + ':anon'), 10);
            if (isNaN(m) || m < 0) m = 0;
            m |= 1 << 2;
            localStorage.setItem(TUTORIAL_MASK_KEY + ':anon', String(m));
          } catch (e) {
            /* ignore */
          }
        }
        pendingStripTutorial = false;
        stripTutorialParamFromUrl();
      }
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
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
      if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.clearTutorialProgress === 'function') {
        window.JurinTutorialUtil.clearTutorialProgress(3);
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
      window.__marketStep3OnStocksRendered = null;
    }

    function finStepAllowsClick(target, step) {
      if (!target || !target.closest || !step) return false;
      if (step.kind === 'fin-intro') {
        if (target.closest('[data-jurin-section="fin-chart"]')) return true;
        return false;
      }
      if (step.kind === 'fin-metric') {
        if (step.finCat && target.closest('.detail-fin-chart-seg[data-fin-cat="' + step.finCat + '"]')) {
          return true;
        }
        if (
          step.finMetric &&
          target.closest('.detail-fin-metric-chip[data-fin-metric="' + step.finMetric + '"]')
        ) {
          return true;
        }
        return false;
      }
      return false;
    }

    function guidedStepAllowsClick(target) {
      var step = STEPS[current];
      if (!step) return false;
      if (step.kind === 'pick') return pickStepAllowsClick(target);
      if (step.kind === 'indicator-mission' || step.kind === 'term') {
        return false;
      }
      if (step.kind === 'fin-intro' || step.kind === 'fin-metric') {
        return finStepAllowsClick(target, step);
      }
      if (step.kind === 'table') {
        return Boolean(target.closest && target.closest('details.detail-tables-details'));
      }
      return false;
    }

    function isGuardedStep() {
      if (step3QuizActive) return false;
      if (introPhaseActive) return true;
      return isGuidedActionStep(STEPS[current]);
    }

    function getWrongMessageForStep(target) {
      if (introPhaseActive) {
        return '지금은 루미의 안내를 들어봐! 확인 버튼을 눌러 줘.';
      }
      var step = STEPS[current];
      if (!step) return null;
      if (window.JurinTutorialGuard.isBlockedChromeClick(target)) return null;
      if (step.kind === 'pick') {
        return '지금은 삼성전자(005930) 행을 눌러 상세 화면을 열어줘.';
      }
      if (step.kind === 'indicator-mission') {
        return '지금은 PER, PBR, ROE 투자 지표를 눈으로 확인한 뒤 코치 확인을 눌러 줘.';
      }
      if (step.kind === 'fin-intro' || step.kind === 'fin-metric') {
        return '지금은 안내한 차트 칩·탭만 눌러줘.';
      }
      if (step.kind === 'term') {
        return '지금은 설명 중인 지표 카드에 집중해 줘.';
      }
      if (step.kind === 'table') {
        return '지금은 「표로 보기」만 펼쳐 보면 돼.';
      }
      return null;
    }

    function syncTutorialGuard() {
      if (!window.JurinTutorialGuard || typeof window.JurinTutorialGuard.set !== 'function') return;
      window.JurinTutorialGuard.set({
        isActive: function () {
          return (
            (introPhaseActive ||
              (started &&
                overlay.classList.contains('is-open') &&
                !document.body.classList.contains('market-step3-clear-phase'))) &&
            !step3QuizActive
          );
        },
        allowsClick: function (target) {
          var G = window.JurinTutorialGuard;
          if (G.allowsMascotAndQuest(target)) return true;
          if (G.isBlockedChromeClick(target)) return false;
          if (!isGuardedStep()) return false;
          if (introPhaseActive) return false;
          var step = STEPS[current];
          if (!isCoachOnlyKind(step) && G.allowsSpotlightTargets(target)) return true;
          return guidedStepAllowsClick(target);
        },
        getWrongMessage: getWrongMessageForStep,
        onAfterWrong: function () {
          if (step3QuizActive) return;
          window.JurinTutorialGuard.restoreDockOrFallback(function () {
            if (current === STEP_IDX.pick) {
              step3PickSweatMode = true;
              presentPickCoach();
            } else {
              runStepCoach(STEPS[current]);
            }
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
      window.__marketStep3OnStocksRendered = function () {
        if (!started) return;
        updatePickLockClass();
      };
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('market-step3-active');
      document.body.classList.add('tutorial-fx-active');
      if (window.JurinGuideLumi && typeof window.JurinGuideLumi.start === 'function') {
        window.JurinGuideLumi.start();
      }
      window.__jurinGuideQuit = function () {
        close(true);
      };
      syncTutorialGuard();
      render(STEP_IDX.pick);
    }

    function showIntro() {
      var tutorialUtil3 = window.JurinTutorialUtil;
      if (
        tutorialUtil3 &&
        typeof tutorialUtil3.consumeTutorialFreshStart === 'function' &&
        tutorialUtil3.consumeTutorialFreshStart(3)
      ) {
        if (typeof tutorialUtil3.clearTutorialProgress === 'function') {
          tutorialUtil3.clearTutorialProgress(3);
        }
        introBeatIndex = 0;
        if (started) close(true);
      }
      introPhaseActive = true;
      document.body.classList.add('tutorial-fx-active');
      syncTutorialGuard();
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        introPhaseActive = false;
        open();
        return;
      }
      function showIntroBeat() {
        var text = INTRO_BEATS[introBeatIndex] || INTRO_BEATS[0];
        window.MascotCoach.show({
          mood: INTRO_MOODS[introBeatIndex] || 'info',
          title: '루미',
          text: text,
          confirmLabel: '확인',
          onConfirm: function () {
            if (introBeatIndex < INTRO_BEATS.length - 1) {
              introBeatIndex += 1;
              showIntroBeat();
              return;
            }
            introBeatIndex = 0;
            introPhaseActive = false;
            open();
          },
        });
      }
      showIntroBeat();
      window.__jurinGuideQuit = function () {
        introPhaseActive = false;
        close(true);
      };
    }

    function waitForSamsungDetailThenAdvance(attempt) {
      if (isSamsungDetailOpen()) {
        interaction.openedDetail = true;
        step3PickSweatMode = false;
        render(STEP_IDX.indicatorMission);
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
      if (target.closest('#mascotCoachDock')) return true;
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
