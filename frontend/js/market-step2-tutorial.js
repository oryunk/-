/**
 * 파일: market.html 2단계 차트 기초 튜토리얼
 * 설명( market.html 전용. 1단계 클리어 후 진행. )
 */
(function () {
  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  var TUTORIAL_MASK_KEY = 'jurinGuideTutorialBits';
  var STEP2_CHECK_KEY = 'jurinGuideStep2Checklist';
  var STEP2_EXPECTED_CODE = '005930';

  var STEP_PICK = 0;
  var STEP_CHART_INTRO = 1;
  var STEP_PERIOD = 2;
  var STEP_PERIOD_PRAISE = 3;
  var STEP_UPTREND = 4;
  var STEP_DOWNTREND = 5;
  var STEP_VOLUME = 6;
  var STEP_CANDLE = 7;
  var STEP_TREND_CHECK = 8;
  var STEP_GO_INDICES = 9;
  var STEP_KOSPI = 10;
  var STEP_INDICES = 11;
  var STEP_FINAL = 12;

  var INTRO_BEATS = [
    '좋아! 이제 차트를 보는 방법을 알아볼 차례야.',
    '주식을 처음 시작하면 차트가 복잡한 그래프처럼 보여서 어려워 보일 수 있어.',
    '근데 걱정하지 마! 오늘은 가장 기본적인 것들만 같이 살펴볼 거야.',
  ];

  var interaction = {
    openedDetail: false,
    stockCode: null,
    clickedPeriodBtn: false,
    returnedToOverview: false,
    clickedKospi: false,
  };

  var step2QuizActive = false;
  var pickHandled = false;

  var STEP2_QUIZ = [
    {
      text: '문제 1/5 (O/X)\n일봉 차트에서 봉 한 칸은 보통 하루치 가격을 나타낸다.',
      correct: 1,
      correctHint: '맞아! 일봉은 하루의 시가·고가·저가·종가를 한 봉에 담아.',
      wrongHint: '일봉은 하루 단위야. 주봉·월봉은 기간을 더 길게 묶은 봉이지.',
    },
    {
      text: '문제 2/5 (O/X)\n파란 봉 몸통은 그 기간에 종가가 시가보다 올랐을 때다.',
      correct: 2,
      correctHint: '맞아! 파란 몸통은 내려 마감, 빨간 몸통이 올라 마감이야.',
      wrongHint: '봉 색은 시가와 종가를 비교해. 파랑은 내려 마감, 빨강은 올라 마감이야.',
    },
    {
      text: '문제 3/5 (O/X)\n빨간 봉 몸통은 그 기간에 종가가 시가보다 올랐을 때다.',
      correct: 1,
      correctHint: '정답이야! 빨간 몸통 = 그 기간에 올라 마감, 파란 = 내려 마감이야.',
      wrongHint: '봉 색은 시가와 종가를 비교해. 빨강은 올라 마감, 파랑은 내려 마감이야.',
    },
    {
      text: '문제 4/5 (O/X)\n주봉은 하루치 가격만 한 봉에 담아서 보여 준다.',
      correct: 2,
      correctHint: '맞아! 주봉은 일주일을 한 봉으로 묶은 거야. 하루 단위는 일봉이지.',
      wrongHint: '주봉은 그 주 전체를 한 칸으로 보는 거야. 하루 단위는 일봉을 보면 돼.',
    },
    {
      text: '문제 5/5 (O/X)\n차트 아래 거래량 막대가 짧으면 그 기간 거래가 많았다는 뜻이다.',
      correct: 2,
      correctHint: '맞아! 막대가 길수록 거래가 많았다고 보면 돼. 짧으면 상대적으로 적은 편이야.',
      wrongHint: '거래량 막대는 길수록 거래가 활발했다는 뜻이야. 짧으면 적은 편으로 보면 돼.',
    },
  ];

  function getCoachBeats(step) {
    if (!step) return [''];
    if (step.coachBeats && step.coachBeats.length) return step.coachBeats;
    if (step.coach) return [step.coach];
    return [''];
  }

  function indexCard(key) {
    var el = document.querySelector('#indicesGrid .index-card[data-index-key="' + key + '"]');
    return el ? [el] : [];
  }

  function persistStep2AllComplete() {
    try {
      localStorage.setItem(
        STEP2_CHECK_KEY,
        JSON.stringify({ chart_range: true, chart_basics: true, chart_one_stock: true })
      );
      if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.markTutorialStepComplete === 'function') {
        window.JurinTutorialUtil.markTutorialStepComplete(2);
        return;
      }
      var m = parseInt(localStorage.getItem(TUTORIAL_MASK_KEY + ':anon'), 10);
      if (isNaN(m) || m < 0) m = 0;
      m |= 1 << 1;
      localStorage.setItem(TUTORIAL_MASK_KEY + ':anon', String(m));
    } catch (e) {
      /* ignore */
    }
  }

  function stripMdBold(s) {
    return String(s || '').replace(/\*\*/g, '');
  }

  function overviewVisible() {
    var ov = document.getElementById('marketOverviewView');
    var dv = document.getElementById('stockDetailView');
    return ov && !ov.classList.contains('hidden') && dv && dv.classList.contains('hidden');
  }

  function detailVisible() {
    var dv = document.getElementById('stockDetailView');
    return dv && !dv.classList.contains('hidden');
  }

  function inChartStep(idx) {
    return idx >= STEP_CHART_INTRO && idx <= STEP_TREND_CHECK;
  }

  function chartWrapperTarget() {
    var w = document.getElementById('chartWrapper');
    return w ? [w] : [];
  }

  function indexOverlayOpen() {
    var overlay = document.getElementById('indexDetailOverlay');
    return Boolean(overlay && !overlay.hidden);
  }

  function candleChartTarget() {
    var w = document.getElementById('stockChartWrap');
    if (w) return [w];
    return chartWrapperTarget();
  }

  function rangeToolbarTargets() {
    var toolbar = document.querySelector('#stockDetailView .detail-toolbar');
    if (toolbar) return [toolbar];
    var btns = document.querySelectorAll('#stockDetailView .detail-range-btn');
    return btns.length ? Array.prototype.slice.call(btns) : [];
  }

  function buildSteps() {
    return [
      {
        objective: '삼성전자 차트 열기',
        mood: 'excited',
        coachBeats: [
          '차트는 주가 흐름을 그림으로 보여주는 도구야.',
          '삼성전자(005930) 행을 눌러 상세·차트 화면으로 들어가 보자!',
        ],
        targets: function () {
          var row = document.querySelector('#row-' + STEP2_EXPECTED_CODE);
          return row ? [row] : [];
        },
        done: function () {
          return (
            Boolean(interaction.stockCode) &&
            detailVisible() &&
            window.__jurinSelectedStockCode === interaction.stockCode
          );
        },
      },
      {
        objective: '차트 영역 살펴보기',
        mood: 'chart',
        coachBeats: [
          '먼저 여기 보이는 게 주가 차트야.',
          '차트는 주가가 지금까지 어떻게 움직였는지 보여주는 그래프라고 생각하면 돼.',
          '숫자만 보는 것보다 흐름을 한눈에 볼 수 있다는 게 차트의 가장 큰 장점이야.',
        ],
        targets: chartWrapperTarget,
        done: function () {
          return true;
        },
      },
      {
        objective: '기간 버튼 눌러보기',
        mood: 'studying',
        coachBeats: [
          '차트 위를 보면 1일, 1주, 1개월, 1년 같은 기간 버튼이 보일 거야.',
          '이 버튼을 누르면 원하는 기간의 주가 흐름을 확인할 수 있어.',
          '한번 직접 눌러볼까?',
        ],
        targets: rangeToolbarTargets,
        done: function () {
          return interaction.clickedPeriodBtn;
        },
      },
      {
        objective: '기간별 다른 모습 이해하기',
        mood: 'happy',
        coachBeats: [
          '잘했어!',
          '같은 종목이라도 어떤 기간으로 보느냐에 따라 전혀 다른 모습으로 보일 수 있어.',
          '하루 차트는 짧은 움직임을, 1년 차트는 큰 흐름을 확인할 때 자주 사용해.',
        ],
        targets: chartWrapperTarget,
        done: function () {
          return true;
        },
      },
      {
        objective: '상승 추세 읽기',
        mood: 'chart',
        coachBeats: [
          '차트가 오른쪽 위로 점점 올라가는 모습이 보인다면 보통 상승 추세라고 불러.',
          '즉, 주가가 전반적으로 오르고 있는 흐름이라는 뜻이야.',
        ],
        targets: chartWrapperTarget,
        done: function () {
          return true;
        },
      },
      {
        objective: '하락 추세 읽기',
        mood: 'excited',
        coachBeats: [
          '반대로 차트가 아래 방향으로 움직이고 있다면 하락 추세라고 해.',
          '많은 투자자들이 지금 상승 추세인지, 하락 추세인지를 먼저 확인하고 투자 판단을 하곤 해.',
        ],
        targets: chartWrapperTarget,
        done: function () {
          return true;
        },
      },
      {
        objective: '거래량 막대 보기',
        mood: 'curious',
        coachBeats: [
          '차트 아래에 있는 막대그래프도 보이지? 이건 거래량이야.',
          '거래량은 얼마나 많은 사람들이 이 종목을 사고팔았는지 보여줘.',
          '차트와 거래량을 같이 보면 주가 움직임을 조금 더 이해하기 쉬워져.',
        ],
        targets: chartWrapperTarget,
        done: function () {
          return true;
        },
      },
      {
        objective: '캔들 이해하기',
        mood: 'idea',
        coachBeats: [
          '차트에 있는 빨간색과 파란색 막대를 캔들이라고 불러.',
          '캔들은 하루 동안 어디서 시작했고, 어디까지 올랐고, 어디까지 내려갔는지를 한 번에 보여주는 정보야.',
          '지금은 "하루의 움직임을 나타내는 막대" 정도로 기억해도 충분해.',
        ],
        targets: candleChartTarget,
        done: function () {
          return true;
        },
      },
      {
        objective: '차트 흐름 확인하기',
        mood: 'good_idea',
        coachBeats: [
          '그리고 흐름이 올라가는 것처럼 보이는지, 아니면 내려가는 것처럼 보이는지 직접 확인해보는 거야.',
        ],
        targets: chartWrapperTarget,
        done: function () {
          return true;
        },
      },
      {
        objective: '주요 지수 차트 보기',
        mood: 'happy',
        coachBeats: ['이제 주요 지수 차트도 같이 보러갈게!'],
        targets: function () {
          return [];
        },
        done: function () {
          return interaction.returnedToOverview;
        },
      },
      {
        objective: '코스피 카드 눌러보기',
        mood: 'excited',
        coachBeats: [
          '여기 보이는 게 코스피야.',
          '코스피 카드를 눌러서 오늘 시장 분위기를 한번 확인해보자!',
        ],
        targets: function () {
          return indexCard('kospi');
        },
        done: function () {
          return interaction.clickedKospi;
        },
      },
      {
        objective: '지수 종류 살펴보기',
        mood: 'curious',
        coachBeats: [
          '오른쪽 「다른 지수」를 보면 종류별로 나뉘어 있어.',
          '맨 위 주가지수는 코스피·코스닥처럼 시장 전체 흐름을 보여줘.',
          '그 아래 환율은 USD/KRW처럼 돈의 가치가 어떻게 변하는지 알려줘.',
          '맨 아래 원자재는 WTI·구리처럼 국제 상품 가격을 보여줘.',
          '종목 차트처럼 기간을 바꿔가며 시장 분위기를 한눈에 볼 수 있어.',
        ],
        targets: function () {
          return [];
        },
        done: function () {
          return true;
        },
      },
      {
        objective: '2단계 완료',
        mood: 'success',
        coachBeats: [
          '2단계를 완료했어!',
          '이제 차트가 단순한 그래프가 아니라 주가의 흐름을 보여주는 도구라는 걸 알게 되었네.',
          '다음 단계에서는 투자자들이 자주 사용하는 PER, PBR, ROE 같은 투자 지표를 같이 알아보자!',
        ],
        targets: function () {
          return [];
        },
        done: function () {
          return true;
        },
      },
    ];
  }

  var STEPS = buildSteps();

  function getEl(id) {
    return document.getElementById(id);
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
        var topMargin = 100;
        var bottomMargin = 40;
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
        if (clipped) {
          var block = opts.scrollBlock || 'center';
          if (pinBottom) block = 'nearest';
          try {
            primary.scrollIntoView({ behavior: 'smooth', block: block, inline: 'nearest' });
          } catch (e) {
            primary.scrollIntoView(true);
          }
        }
        if (pinBottom) {
          var reserve = typeof opts.coachBottomReserve === 'number' ? opts.coachBottomReserve : 220;
          var gap = typeof opts.pinGap === 'number' ? opts.pinGap : 14;
          var delay = typeof opts.pinDelay === 'number' ? opts.pinDelay : 500;
          window.setTimeout(function () {
            var r2 = primary.getBoundingClientRect();
            var vh2 = window.innerHeight || document.documentElement.clientHeight;
            var targetLine = vh2 - bottomMargin - reserve - gap;
            var delta = r2.bottom - targetLine;
            if (Math.abs(delta) > 5) {
              try {
                window.scrollBy({ top: delta, left: 0, behavior: 'smooth' });
              } catch (e) {
                window.scrollBy(0, delta);
              }
            }
          }, delay);
        }
      });
    });
  }

  function init() {
    var overlay = getEl('marketStep2Overlay');
    var clearEl = getEl('marketStep2Clear');

    if (!overlay || !clearEl) return;

    var current = 0;
    var dialogueBeatIndex = 0;
    var introBeatIndex = 0;
    var introPhaseActive = false;
    var activeTargets = [];
    var started = false;
    var pendingPersistStep2Complete = false;
    var calloutKeepAlive = null;

    function clearTargets() {
      activeTargets.forEach(function (el) {
        if (el && el.classList) {
          el.classList.remove('tutorial-callout-target');
          el.classList.remove('market-step2-lift');
        }
      });
      activeTargets = [];
    }

    function attachCalloutTarget(el) {
      if (!el || !el.classList) return false;
      var exists = false;
      for (var i = 0; i < activeTargets.length; i++) {
        if (activeTargets[i] === el) {
          exists = true;
          break;
        }
      }
      if (!exists) activeTargets.push(el);
      if (!el.classList.contains('tutorial-callout-target')) {
        el.classList.add('tutorial-callout-target');
      }
      if (!el.classList.contains('market-step2-lift')) {
        el.classList.add('market-step2-lift');
      }
      return true;
    }

    function syncIndexPopoverGuard() {
      if (started && (current === STEP_KOSPI || current === STEP_INDICES)) {
        window.__marketStep2BlockIndexPopover = function () {
          return true;
        };
      } else {
        window.__marketStep2BlockIndexPopover = null;
      }
    }

    function ensurePickTargetPulse() {
      if (!started || current !== STEP_PICK || pickHandled) return;
      var row = document.querySelector('#row-' + STEP2_EXPECTED_CODE);
      if (!row) return;
      attachCalloutTarget(row);
    }

    function ensureChartTargetPulse() {
      if (!started || !detailVisible() || !inChartStep(current)) return;
      if (current === STEP_PERIOD) {
        rangeToolbarTargets().forEach(attachCalloutTarget);
        return;
      }
      if (current === STEP_CANDLE) {
        candleChartTarget().forEach(attachCalloutTarget);
        return;
      }
      chartWrapperTarget().forEach(attachCalloutTarget);
    }

    function ensureIndexTargetPulse(key) {
      if (!started || !key) return;
      var card = document.querySelector('#indicesGrid .index-card[data-index-key="' + key + '"]');
      if (!card) return;
      var stale = false;
      for (var i = activeTargets.length - 1; i >= 0; i--) {
        var t = activeTargets[i];
        if (!t || !t.isConnected || !document.body.contains(t)) {
          if (t && t.classList) {
            t.classList.remove('tutorial-callout-target');
            t.classList.remove('market-step2-lift');
          }
          activeTargets.splice(i, 1);
          stale = true;
        }
      }
      if (stale && activeTargets.length === 0) attachCalloutTarget(card);
      else attachCalloutTarget(card);
    }

    function ensureCalloutTargetsPulse() {
      if (!started) return;
      if (current === STEP_PICK) ensurePickTargetPulse();
      else if (inChartStep(current)) ensureChartTargetPulse();
      else if (current === STEP_KOSPI && !interaction.clickedKospi) ensureIndexTargetPulse('kospi');
    }

    function applyTargetsFromStep(step) {
      clearTargets();
      if (!step || typeof step.targets !== 'function') return;
      if (current === STEP_PICK && !pickHandled) {
        var pickRow = document.querySelector('#row-' + STEP2_EXPECTED_CODE);
        if (pickRow) {
          attachCalloutTarget(pickRow);
          scrollTutorialTargetsIntoViewIfNeeded([pickRow]);
        }
        return;
      }
      var raw = step.targets();
      if (!raw || !raw.length) return;
      var list = Array.isArray(raw) ? raw : [raw];
      list.filter(Boolean).forEach(attachCalloutTarget);
    }

    function isChartLockStep() {
      if (!started || !detailVisible() || !inChartStep(current)) return false;
      if (current === STEP_PERIOD) return false;
      if (current === STEP_CANDLE) return false;
      return true;
    }

    function isIndexOverlayTutorialStep() {
      return (
        started &&
        indexOverlayOpen() &&
        current === STEP_KOSPI &&
        interaction.clickedKospi
      );
    }

    function updatePickLockClass() {
      document.body.classList.toggle(
        'market-step2-pick-lock',
        started && current === STEP_PICK && !pickHandled
      );
    }

    function updateChartLockClass() {
      document.body.classList.toggle('market-step2-chart-lock', isChartLockStep());
    }

    function updateIndexOverlayTutorialClass() {
      document.body.classList.toggle('market-step2-index-overlay-tutorial', isIndexOverlayTutorialStep());
    }

    function updateCandleLockClass() {
      document.body.classList.toggle(
        'market-step2-candle-lock',
        started && current === STEP_CANDLE && detailVisible()
      );
    }

    function updateIndexLockClass() {
      document.body.classList.toggle(
        'market-step2-index-lock',
        started &&
          current === STEP_KOSPI &&
          !interaction.clickedKospi &&
          overviewVisible() &&
          !indexOverlayOpen()
      );
    }

    function updateSpotlightBodyClasses() {
      if (!started) {
        document.body.classList.remove('market-step2-detail-spotlight');
        document.body.classList.remove('market-step2-overview-spotlight');
        document.body.classList.remove('market-step2-index-overlay-spotlight');
        document.body.classList.remove('market-step2-spotlight');
        document.body.classList.remove('tutorial-fx-spotlight');
        document.body.classList.remove('market-step2-pick-lock');
        document.body.classList.remove('market-step2-chart-lock');
        document.body.classList.remove('market-step2-candle-lock');
        document.body.classList.remove('market-step2-index-lock');
        document.body.classList.remove('market-step2-index-overlay-tutorial');
        document.body.classList.remove('market-step2-indices-quest-left');
        return;
      }
      var pickOverview = overviewVisible() && current === STEP_PICK && !pickHandled;
      var overviewSpot =
        overviewVisible() &&
        (current === STEP_GO_INDICES && !interaction.returnedToOverview ||
          (current === STEP_KOSPI && !interaction.clickedKospi));
      var indexOverlaySpot = isIndexOverlayTutorialStep();
      var detailSpot = detailVisible() && inChartStep(current) && current !== STEP_PERIOD;
      document.body.classList.toggle('market-step2-overview-spotlight', pickOverview || overviewSpot);
      document.body.classList.toggle('market-step2-index-overlay-spotlight', indexOverlaySpot);
      document.body.classList.toggle('market-step2-detail-spotlight', detailSpot);
      document.body.classList.toggle(
        'market-step2-spotlight',
        pickOverview || overviewSpot || detailSpot || indexOverlaySpot
      );
      document.body.classList.toggle(
        'tutorial-fx-spotlight',
        pickOverview || overviewSpot || detailSpot || indexOverlaySpot
      );
      updatePickLockClass();
      updateChartLockClass();
      updateCandleLockClass();
      updateIndexLockClass();
      updateIndexOverlayTutorialClass();
      document.body.classList.toggle(
        'market-step2-indices-quest-left',
        started && current === STEP_INDICES && indexOverlayOpen()
      );
    }

    function updateOverlayDim() {
      var inClear = document.body.classList.contains('market-step2-clear-phase');
      if (inClear || step2QuizActive) {
        overlay.classList.remove('is-dim');
        document.body.classList.remove('market-step2-dim-active');
        return;
      }
      var dimForPick = current === STEP_PICK && !pickHandled;
      var dimForKospi = current === STEP_KOSPI && !interaction.clickedKospi && !indexOverlayOpen();
      var dimOn = dimForPick || dimForKospi;
      overlay.classList.toggle('is-dim', dimOn);
      document.body.classList.toggle('market-step2-dim-active', dimOn);
    }

    function updateDetailBodyClass() {
      updateSpotlightBodyClasses();
    }

    function resetStep2ClearState() {
      overlay.classList.remove('is-clear-dim');
      overlay.classList.remove('is-dim');
      clearEl.classList.remove('is-show');
      document.body.classList.remove('market-step2-clear-phase');
      document.body.classList.remove('market-step2-dim-active');
      document.body.classList.remove('tutorial-fx-clear');
    }

    function showCoachMessage(opts) {
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') return;
      var payload = {
        mood: opts.mood || 'info',
        title: opts.title || '루미',
        text: opts.text || '',
        confirmLabel: opts.confirmLabel || '확인',
        onConfirm: opts.onConfirm || function () {},
      };
      if (opts.dismissLabel) payload.dismissLabel = opts.dismissLabel;
      if (opts.onDismiss) payload.onDismiss = opts.onDismiss;
      window.MascotCoach.show(payload);
      window.requestAnimationFrame(function () {
        ensureCalloutTargetsPulse();
      });
    }

    function showCoach(step, extra) {
      if (!step) return;
      ensureCalloutTargetsPulse();
      var beats = getCoachBeats(step);
      var text = beats[dialogueBeatIndex] || beats[0] || '';
      var payload = {
        mood: step.mood || 'info',
        title: '루미',
        text: text,
        confirmLabel: '확인',
        onConfirm: function () {
          if (dialogueBeatIndex < beats.length - 1) {
            dialogueBeatIndex += 1;
            showCoach(step, extra);
            return;
          }
          dialogueBeatIndex = 0;
          if (extra && typeof extra.onConfirm === 'function') {
            extra.onConfirm();
            return;
          }
          if (extra && typeof extra.onAfterBeats === 'function') {
            extra.onAfterBeats();
            return;
          }
          proceed();
        },
      };
      showCoachMessage(payload);
    }

    function showPeriodPraiseThenAdvance() {
      dialogueBeatIndex = 0;
      render(STEP_PERIOD_PRAISE);
    }

    function triggerReturnToOverview() {
      if (detailVisible() && typeof window.closeStockDetail === 'function') {
        window.closeStockDetail();
      }
    }

    function beginClearPhase() {
      current = STEP_FINAL;
      dialogueBeatIndex = 0;
      var finalStep = STEPS[STEP_FINAL];
      clearTargets();
      pendingPersistStep2Complete = true;
      persistStep2AllComplete();
      step2QuizActive = false;
      document.body.classList.add('market-step2-clear-phase');
      document.body.classList.add('tutorial-fx-clear');
      overlay.classList.remove('is-dim');
      overlay.classList.add('is-clear-dim');
      document.body.classList.remove('market-step2-dim-active');
      document.body.classList.remove('mascot-coach-spotlight-dim');
      window.__marketStep2BlockIndexPopover = null;
      if (window.IndexDetailOverlay && typeof window.IndexDetailOverlay.close === 'function') {
        window.IndexDetailOverlay.close();
      }
      clearEl.classList.add('is-show');
      document.body.classList.remove('market-step2-detail-spotlight');
      document.body.classList.remove('market-step2-overview-spotlight');
      document.body.classList.remove('market-step2-index-overlay-spotlight');
      document.body.classList.remove('market-step2-spotlight');
      document.body.classList.remove('market-step2-pick-lock');
      document.body.classList.remove('market-step2-chart-lock');
      document.body.classList.remove('market-step2-candle-lock');
      document.body.classList.remove('market-step2-index-lock');
      document.body.classList.remove('market-step2-index-overlay-tutorial');
      document.body.classList.remove('market-step2-indices-quest-left');

      function finishAndGoGuide() {
        pendingPersistStep2Complete = false;
        if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.restoreNormalSiteUi === 'function') {
          window.JurinTutorialUtil.restoreNormalSiteUi({ stripTutorial: true });
        }
        window.location.replace('guide.html');
      }

      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        finishAndGoGuide();
        return;
      }

      showCoach(finalStep, { onConfirm: finishAndGoGuide });
    }

    function runQuizThenFinal() {
      step2QuizActive = true;
      overlay.classList.remove('is-dim');
      document.body.classList.remove('market-step2-dim-active');
      window.__marketStep2BlockIndexPopover = null;
      if (window.IndexDetailOverlay && typeof window.IndexDetailOverlay.close === 'function') {
        window.IndexDetailOverlay.close();
      }
      clearTargets();
      updateDetailBodyClass();
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        step2QuizActive = false;
        beginClearPhase();
        return;
      }
      function finishQuizSuccess() {
        step2QuizActive = false;
        showCoachMessage({
          mood: 'success',
          text: '5문제 모두 확인했어! 차트 읽기 연습 수고했어.',
          onConfirm: function () {
            beginClearPhase();
          },
        });
      }
      function wrongThenNext(idx) {
        var q = STEP2_QUIZ[idx];
        showCoachMessage({
          mood: 'caution',
          text: '아쉽지만 오답이야.\n' + stripMdBold(q.wrongHint),
          confirmLabel: '다음 문제',
          onConfirm: function () {
            showQuizAt(idx + 1);
          },
        });
      }
      function rightThenNext(idx) {
        var q = STEP2_QUIZ[idx];
        showCoachMessage({
          mood: 'success',
          text: '정답이야!\n' + stripMdBold(q.correctHint || ''),
          confirmLabel: '다음 문제',
          onConfirm: function () {
            showQuizAt(idx + 1);
          },
        });
      }
      function showQuizAt(idx) {
        if (idx >= STEP2_QUIZ.length) {
          finishQuizSuccess();
          return;
        }
        var q = STEP2_QUIZ[idx];
        showCoachMessage({
          mood: 'info',
          title: '루미 퀴즈',
          text: stripMdBold(q.text),
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
      dialogueBeatIndex = 0;
      var step = STEPS[current];
      applyTargetsFromStep(step);
      updateOverlayDim();
      updateDetailBodyClass();
      syncTutorialGuard();
      syncIndexPopoverGuard();

      if (current === STEP_GO_INDICES) {
        if (overviewVisible()) {
          interaction.returnedToOverview = true;
          render(STEP_KOSPI);
          return;
        }
        showCoach(step, {
          onAfterBeats: function () {
            triggerReturnToOverview();
          },
        });
        return;
      }

      showCoach(step);
    }

    function proceed() {
      if (!started) return;
      var step = STEPS[current];
      if (!step || typeof step.done !== 'function') return;

      if (!step.done()) {
        var beats = getCoachBeats(step);
        dialogueBeatIndex = Math.max(0, beats.length - 1);
        updateOverlayDim();
        updateDetailBodyClass();
        showCoach(step);
        return;
      }

      if (current === STEP_INDICES) {
        runQuizThenFinal();
        return;
      }

      if (current >= STEPS.length - 1) {
        beginClearPhase();
        return;
      }

      render(current + 1);
    }

    function close(fromUserQuit) {
      step2QuizActive = false;
      dialogueBeatIndex = 0;
      introBeatIndex = 0;
      introPhaseActive = false;
      if (pendingPersistStep2Complete) {
        pendingPersistStep2Complete = false;
      }
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      resetStep2ClearState();
      document.body.classList.remove('market-step2-active');
      document.body.classList.remove('market-step2-pending');
      document.body.classList.remove('market-step2-dim-active');
      document.body.classList.remove('tutorial-fx-active');
      document.body.classList.remove('tutorial-fx-spotlight');
      document.body.classList.remove('market-step2-detail-spotlight');
      document.body.classList.remove('market-step2-overview-spotlight');
      document.body.classList.remove('market-step2-index-overlay-spotlight');
      document.body.classList.remove('market-step2-spotlight');
      document.body.classList.remove('market-step2-pick-lock');
      document.body.classList.remove('market-step2-chart-lock');
      document.body.classList.remove('market-step2-candle-lock');
      document.body.classList.remove('market-step2-index-lock');
      document.body.classList.remove('market-step2-index-overlay-tutorial');
      document.body.classList.remove('market-step2-indices-quest-left');
      clearTargets();
      started = false;
      interaction.openedDetail = false;
      interaction.stockCode = null;
      interaction.clickedPeriodBtn = false;
      interaction.returnedToOverview = false;
      interaction.clickedKospi = false;
      pickHandled = false;
      overlay.classList.remove('is-dim');
      if (calloutKeepAlive) {
        window.clearInterval(calloutKeepAlive);
        calloutKeepAlive = null;
      }
      if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.clearTutorialProgress === 'function') {
        window.JurinTutorialUtil.clearTutorialProgress(2);
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
      window.__marketStep2OnStocksRendered = null;
      window.__marketStep2OnDetailClosed = null;
      window.__marketStep2BlockIndexPopover = null;
      window.__marketStep2OnIndexDetailOpened = null;
      if (window.IndexDetailOverlay && typeof window.IndexDetailOverlay.close === 'function') {
        window.IndexDetailOverlay.close();
      }
    }

    function advanceToIndicesAfterKospi() {
      if (!started) return;
      dialogueBeatIndex = 0;
      current = STEP_INDICES;
      var step = STEPS[STEP_INDICES];
      if (typeof window.closeIndexHoverPopover === 'function') {
        window.closeIndexHoverPopover();
      }
      applyTargetsFromStep(step);
      updateOverlayDim();
      updateDetailBodyClass();
      syncTutorialGuard();
      syncIndexPopoverGuard();
      window.requestAnimationFrame(function () {
        if (!started || current !== STEP_INDICES) return;
        showCoach(step);
      });
    }

    function isActionStep() {
      if (step2QuizActive) return false;
      if (current === STEP_PICK && !pickHandled) return true;
      if (current === STEP_PERIOD && !interaction.clickedPeriodBtn) return true;
      if (current === STEP_KOSPI && !interaction.clickedKospi) return true;
      return false;
    }

    function isCoachOnlyStep() {
      if (introPhaseActive) return true;
      if (inChartStep(current)) {
        if (current === STEP_PERIOD && !interaction.clickedPeriodBtn) return false;
        return true;
      }
      if (current === STEP_GO_INDICES || current === STEP_INDICES || current === STEP_FINAL) {
        return true;
      }
      return false;
    }

    function getWrongMessageForStep(target) {
      if (introPhaseActive) {
        return '지금은 루미의 안내를 들어봐! 확인 버튼을 눌러 줘.';
      }
      if (window.JurinTutorialGuard.isBlockedChromeClick(target)) return null;
      if (inChartStep(current)) {
        if (current === STEP_PERIOD && !interaction.clickedPeriodBtn) {
          return '지금은 「1일」·「1주」 같은 기간 버튼을 눌러 줘!';
        }
        return '지금은 차트 설명을 들어봐! 확인을 눌러 줘.';
      }
      if (current === STEP_GO_INDICES || current === STEP_INDICES) {
        return '지금은 지수 설명을 들어봐! 확인을 눌러 줘.';
      }
      if (current === STEP_PICK) {
        return '지금은 삼성전자(005930) 행을 눌러 상세·차트로 들어가 줘!';
      }
      if (current === STEP_PERIOD) {
        return '지금은 「1일」·「1주」 같은 기간 버튼을 눌러 줘!';
      }
      if (current === STEP_KOSPI) {
        return '지금은 코스피 카드를 눌러 줘!';
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
                !document.body.classList.contains('market-step2-clear-phase'))) &&
            !step2QuizActive
          );
        },
        allowsClick: function (target) {
          var G = window.JurinTutorialGuard;
          if (G.allowsMascotAndQuest(target)) return true;
          if (G.isBlockedChromeClick(target)) return false;
          if (isCoachOnlyStep()) return false;
          if (!isActionStep()) return false;
          if (G.allowsSpotlightTargets(target)) return true;
          if (current === STEP_PICK && target.closest && target.closest('#row-' + STEP2_EXPECTED_CODE)) {
            return true;
          }
          if (current === STEP_PERIOD && target.closest && target.closest('.detail-range-btn')) {
            return true;
          }
          if (current === STEP_KOSPI && target.closest) {
            var card = target.closest('#indicesGrid .index-card[data-index-key="kospi"]');
            return Boolean(card);
          }
          return false;
        },
        getWrongMessage: getWrongMessageForStep,
        onAfterWrong: function () {
          if (step2QuizActive) return;
          window.JurinTutorialGuard.restoreDockOrFallback(function () {
            showCoach(STEPS[current]);
          });
        },
      });
    }

    function open() {
      started = true;
      interaction.openedDetail = false;
      interaction.stockCode = null;
      interaction.clickedPeriodBtn = false;
      interaction.returnedToOverview = false;
      interaction.clickedKospi = false;
      pickHandled = false;
      pendingPersistStep2Complete = false;
      step2QuizActive = false;
      dialogueBeatIndex = 0;
      if (calloutKeepAlive) window.clearInterval(calloutKeepAlive);
      calloutKeepAlive = window.setInterval(function () {
        ensureCalloutTargetsPulse();
      }, 350);
      resetStep2ClearState();
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.remove('market-step2-pending');
      document.body.classList.add('market-step2-active');
      document.body.classList.add('tutorial-fx-active');
      if (window.LumiChat && typeof window.LumiChat.close === 'function') {
        window.LumiChat.close();
      }
      syncIndexPopoverGuard();
      window.__marketStep2OnIndexDetailOpened = function (key) {
        if (!started || current !== STEP_KOSPI || interaction.clickedKospi) return;
        if (String(key || '').toLowerCase() !== 'kospi') return;
        interaction.clickedKospi = true;
        updateOverlayDim();
        updateDetailBodyClass();
        window.setTimeout(function () {
          if (!started) return;
          advanceToIndicesAfterKospi();
        }, 450);
      };
      window.__jurinGuideQuit = function () {
        close(true);
      };
      window.__marketStep2OnStocksRendered = function () {
        if (!started) return;
        updatePickLockClass();
        ensureCalloutTargetsPulse();
      };
      window.__marketStep2OnDetailClosed = function () {
        if (!started) return;
        if (current === STEP_GO_INDICES && !interaction.returnedToOverview) {
          interaction.returnedToOverview = true;
          updateOverlayDim();
          updateDetailBodyClass();
          window.setTimeout(function () {
            if (!started || current !== STEP_GO_INDICES) return;
            render(STEP_KOSPI);
          }, 350);
        }
      };
      syncTutorialGuard();
      render(STEP_PICK);
    }

    function showIntro() {
      var tutorialUtil2 = window.JurinTutorialUtil;
      if (
        tutorialUtil2 &&
        typeof tutorialUtil2.consumeTutorialFreshStart === 'function' &&
        tutorialUtil2.consumeTutorialFreshStart(2)
      ) {
        if (typeof tutorialUtil2.clearTutorialProgress === 'function') {
          tutorialUtil2.clearTutorialProgress(2);
        }
        introBeatIndex = 0;
        if (started) close(true);
      }
      introPhaseActive = true;
      document.body.classList.add('market-step2-pending');
      document.body.classList.add('tutorial-fx-active');
      if (window.LumiChat && typeof window.LumiChat.close === 'function') {
        window.LumiChat.close();
      }
      syncTutorialGuard();
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        introPhaseActive = false;
        open();
        return;
      }
      function showIntroBeat() {
        var text = INTRO_BEATS[introBeatIndex] || INTRO_BEATS[0];
        window.MascotCoach.show({
          mood: introBeatIndex === 0 ? 'welcome' : introBeatIndex === 1 ? 'excited' : 'happy',
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
        var code = row.id && row.id.indexOf('row-') === 0 ? row.id.slice(4) : null;
        if (!code) return;

        if (current === STEP_PICK) {
          if (pickHandled) return;
          if (code !== STEP2_EXPECTED_CODE) return;
          pickHandled = true;
          interaction.stockCode = code;
          interaction.openedDetail = true;
          window.setTimeout(function () {
            render(STEP_CHART_INTRO);
          }, 450);
        }
      },
      false
    );

    document.addEventListener(
      'click',
      function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('.detail-range-btn') : null;
        if (!btn || !started) return;
        if (current !== STEP_PERIOD || interaction.clickedPeriodBtn) return;
        interaction.clickedPeriodBtn = true;
        updateOverlayDim();
        updateDetailBodyClass();
        window.setTimeout(function () {
          if (!started) return;
          showPeriodPraiseThenAdvance();
        }, 120);
      },
      true
    );

    var params = new URLSearchParams(window.location.search);
    var tutorial = (params.get('tutorial') || '').toLowerCase().trim();
    if (tutorial === 'step2' || tutorial === '2') {
      showIntro();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
