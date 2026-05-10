/**
 * 파일: market.html 2단계 차트·체크리스트 튜토리얼
 * 설명( market.html 전용. 1단계 클리어 후 진행. )
 */
(function () {
  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  var TUTORIAL_MASK_KEY = 'jurinGuideTutorialBits';
  var STEP2_CHECK_KEY = 'jurinGuideStep2Checklist';
  var STEP2_EXPECTED_A = '005930';
  var STEP2_EXPECTED_B = '035420';
  var STEP2_CLEAR_HOLD_MS = 1500;

  var STEP_PICK_A = 0;
  var STEP_A_R1D = 1;
  var STEP_A_R1W = 2;
  var STEP_A_R1W_READ = 3;
  var STEP_A_R1M = 4;
  var STEP_A_R1M_READ = 5;
  var STEP_A_R1Y = 6;
  var STEP_A_R1Y_READ = 7;
  var STEP_A_BACK = 8;
  var STEP_PICK_B = 9;
  var STEP_B_R1D = 10;
  var STEP_B_R1W = 11;
  var STEP_B_R1W_READ = 12;
  var STEP_B_R1M = 13;
  var STEP_B_R1M_READ = 14;
  var STEP_B_R1Y = 15;
  var STEP_B_R1Y_READ = 16;
  var STEP_FINAL = 17;

  var interaction = {
    openedDetail: false,
    firstCode: null,
    secondCode: null,
  };

  var step2QuizActive = false;
  var pickHandledA = false;
  var pickHandledB = false;

  var STEP2_QUIZ = [
    {
      text:
        '문제 1/3 (O/X)\n봉 차트에서 추세를 읽을 때 고점·저점이 시간에 따라 어떻게 이어지는지를 함께 본다.',
      correct: 1,
      correctHint: '맞아! 추세는 고점·저점의 방향이 이어지는지 먼저 보는 게 기본이야.',
      wrongHint: '추세는 보통 고점·저점의 방향을 묶어서 읽어. 뉴스만으로는 차트 맥락이 부족할 수 있어.',
    },
    {
      text:
        '문제 2/3 (O/X)\n지지·저항은 가격이 자주 막히거나 튕기는 구간으로 본다.',
      correct: 1,
      correctHint: '정답이야! 지지·저항은 반복적으로 반응이 나온 가격대를 뜻해.',
      wrongHint: '지지·저항은 과거에 매물·매수가 몰리던 가격대로, 자주 반복되는 반응을 볼 때가 많아.',
    },
    {
      text:
        '문제 3/3 (O/X)\n이동평균선은 지나간 종가들의 평균을 이어 추세·위치 감각을 보조한다.',
      correct: 1,
      correctHint: '맞아! 이평선은 과거 평균 흐름이라 추세와 현재 위치를 읽는 데 도움을 줘.',
      wrongHint: '이평은 과거 가격의 평균 궤적이야. 방향·가격과의 거리를 볼 때 쓰지, 미래를 보장하진 않아.',
    },
  ];

  function persistStep2AllComplete() {
    try {
      localStorage.setItem(
        STEP2_CHECK_KEY,
        JSON.stringify({ chart_range: true, chart_trend_sr_ma: true, chart_two_stocks: true })
      );
      var m = parseInt(localStorage.getItem(TUTORIAL_MASK_KEY), 10);
      if (isNaN(m) || m < 0) m = 0;
      m |= 1 << 1;
      localStorage.setItem(TUTORIAL_MASK_KEY, String(m));
    } catch (e) {
      /* ignore */
    }
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

  function getApiBase() {
    return window.JURIN_API_BASE || 'http://localhost:5000';
  }

  function stripMdBold(s) {
    return String(s || '').replace(/\*\*/g, '');
  }

  function shortenBlurb(text, maxLen) {
    maxLen = typeof maxLen === 'number' ? maxLen : 110;
    var t = stripMdBold(text).replace(/\s+/g, ' ').trim();
    if (!t || t.length <= maxLen) return t;
    var cut = t.slice(0, maxLen);
    var dot = cut.lastIndexOf('.');
    if (dot >= 35) return cut.slice(0, dot + 1);
    return cut + '…';
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
    return (
      (idx >= STEP_A_R1D && idx <= STEP_A_R1Y_READ) ||
      (idx >= STEP_B_R1D && idx <= STEP_B_R1Y_READ)
    );
  }

  function isCoreActionStep(idx) {
    return idx === STEP_PICK_A || idx === STEP_A_BACK || idx === STEP_PICK_B;
  }

  function isClickGuideStep(step, idx) {
    if (isCoreActionStep(idx)) return true;
    return Boolean(step && step.requiredRange);
  }

  function buildSteps() {
    return [
      {
        objective: '삼성전자 골라 차트 보기',
        mood: 'welcome',
        coach:
          '먼저 용어 한 줄만 잡고 갈게. 한 봉은 한 기간 가격 묶음이고, OHLC는 시가·고가·저가·종가야. 이제 주요 종목 목록에서 삼성전자(005930) 행을 눌러 상세·차트로 들어가 줘.',
        targets: function () {
          var row = document.querySelector('#row-' + STEP2_EXPECTED_A);
          var sec = document.querySelector('#marketOverviewView .stocks-section');
          if (row) return [row];
          return sec ? [sec] : [];
        },
        done: function () {
          return (
            Boolean(interaction.firstCode) &&
            detailVisible() &&
            window.__jurinSelectedStockCode === interaction.firstCode
          );
        },
      },
      {
        objective: '첫 종목: 1일 봉 보기',
        mood: 'info',
        coach:
          '지금은 일봉이야. 한 봉에 하루치 시가·고가·저가·종가(OHLC)가 들어 있어.',
        coachPlain:
          '하루 장이 끝날 때까지 움직임이 한 덩어리로 찍힌 거야. 변동이 작으면 봉 몸통이 짧게 보이기도 해.',
        targets: function () {
          var b = document.querySelector('#stockDetailView .detail-range-btn[data-range="1d"]');
          return b ? [b] : [];
        },
        done: function () {
          return false;
        },
      },
      {
        objective: '첫 종목: 1주 누르기',
        mood: 'info',
        requiredRange: '1w',
        coach: '차트 위쪽에서 「1주」만 눌러 봐.',
        targets: function () {
          var b = document.querySelector('#stockDetailView .detail-range-btn[data-range="1w"]');
          return b ? [b] : [];
        },
        done: function () {
          return (window.__jurinCurrentChartRange || '') === '1w';
        },
      },
      {
        objective: '첫 종목: 주봉 화면 읽기',
        mood: 'info',
        coach:
          '지금은 주봉이야. 한 봉이 그 주의 시가·고가·저가·종가를 묶어서 보여 줘. 일봉보다 봉 개수는 적고, 한 봉이 곧 일주일치야.',
        coachPlain:
          '하루 단위 잡음은 덜 보이고, 일주일마다 한 칸씩만 정리된 그림에 가깝게 보이는 거야.',
        targets: function () {
          var w = document.getElementById('chartWrapper');
          return w ? [w] : [];
        },
        done: function () {
          return false;
        },
      },
      {
        objective: '첫 종목: 1개월 누르기',
        mood: 'info',
        requiredRange: '1m',
        coach: '이제 「1개월」을 눌러.',
        targets: function () {
          var b = document.querySelector('#stockDetailView .detail-range-btn[data-range="1m"]');
          return b ? [b] : [];
        },
        done: function () {
          return (window.__jurinCurrentChartRange || '') === '1m';
        },
      },
      {
        objective: '첫 종목: 월봉 화면 읽기',
        mood: 'info',
        coach:
          '지금은 월봉이야. 한 봉이 한 달 동안의 OHLC를 한 덩어리로 보여 줘. 중기 흐름이나 박스권 볼 때 쓰는 단위지.',
        coachPlain:
          '봉 개수는 더 줄어. 한 칸이 한 달이라서, 그달에 어디서 열리고 어디서 닫혔는지만 먼저 보면 돼.',
        targets: function () {
          var w = document.getElementById('chartWrapper');
          return w ? [w] : [];
        },
        done: function () {
          return false;
        },
      },
      {
        objective: '첫 종목: 1년 누르기',
        mood: 'info',
        requiredRange: '1y',
        coach: '마지막으로 「1년」을 눌러.',
        targets: function () {
          var b = document.querySelector('#stockDetailView .detail-range-btn[data-range="1y"]');
          return b ? [b] : [];
        },
        done: function () {
          return (window.__jurinCurrentChartRange || '') === '1y';
        },
      },
      {
        objective: '첫 종목: 장기봉 화면 읽기',
        mood: 'info',
        coach:
          '지금은 연간에 가깝게 긴 간격으로 묶인 봉이야. 몇 년 단위 박스나 큰 추세를 볼 때 쓰는 화면이지.',
        coachPlain:
          '짧은 출렁임은 덜 보이고, 몇 년 치 큰 방향만 보고 싶을 때 쓴다고 보면 돼.',
        targets: function () {
          var w = document.getElementById('chartWrapper');
          return w ? [w] : [];
        },
        done: function () {
          return false;
        },
      },
      {
        objective: '주요 종목으로 돌아가기',
        mood: 'info',
        coach:
          '이제 「주요 종목으로 돌아가기」 버튼을 눌러 목록으로 이동해 줘.',
        targets: function () {
          var back = document.querySelector('#stockDetailView .btn-back');
          return back ? [back] : [];
        },
        done: function () {
          return overviewVisible();
        },
      },
      {
        objective: 'NAVER 골라 두 번째 종목 보기',
        mood: 'info',
        coach:
          '목록으로 돌아왔으면 NAVER(035420) 행을 눌러 상세·차트로 들어가 줘.',
        targets: function () {
          var row = document.querySelector('#row-' + STEP2_EXPECTED_B);
          var sec = document.querySelector('#marketOverviewView .stocks-section');
          if (row) return [row];
          return sec ? [sec] : [];
        },
        done: function () {
          return (
            Boolean(interaction.secondCode) &&
            detailVisible() &&
            window.__jurinSelectedStockCode === interaction.secondCode
          );
        },
      },
      {
        objective: '두 번째 종목: 1일 봉 보기',
        mood: 'info',
        coach:
          '지금은 일봉이야. 한 봉에 하루치 시가·고가·저가·종가(OHLC)가 들어 있어.',
        coachPlain:
          '하루 장이 끝날 때까지 움직임이 한 덩어리로 찍힌 거야. 변동이 작으면 봉 몸통이 짧게 보이기도 해.',
        targets: function () {
          var b = document.querySelector('#stockDetailView .detail-range-btn[data-range="1d"]');
          return b ? [b] : [];
        },
        done: function () {
          return false;
        },
      },
      {
        objective: '두 번째 종목: 1주 누르기',
        mood: 'info',
        requiredRange: '1w',
        coach: '차트 위쪽에서 「1주」만 눌러 봐.',
        targets: function () {
          var b = document.querySelector('#stockDetailView .detail-range-btn[data-range="1w"]');
          return b ? [b] : [];
        },
        done: function () {
          return (window.__jurinCurrentChartRange || '') === '1w';
        },
      },
      {
        objective: '두 번째 종목: 주봉 화면 읽기',
        mood: 'info',
        coach:
          '지금은 주봉이야. 한 봉이 그 주의 시가·고가·저가·종가를 묶어서 보여 줘. 일봉보다 봉 개수는 적고, 한 봉이 곧 일주일치야.',
        coachPlain:
          '하루 단위 잡음은 덜 보이고, 일주일마다 한 칸씩만 정리된 그림에 가깝게 보이는 거야.',
        targets: function () {
          var w = document.getElementById('chartWrapper');
          return w ? [w] : [];
        },
        done: function () {
          return false;
        },
      },
      {
        objective: '두 번째 종목: 1개월 누르기',
        mood: 'info',
        requiredRange: '1m',
        coach: '이제 「1개월」을 눌러.',
        targets: function () {
          var b = document.querySelector('#stockDetailView .detail-range-btn[data-range="1m"]');
          return b ? [b] : [];
        },
        done: function () {
          return (window.__jurinCurrentChartRange || '') === '1m';
        },
      },
      {
        objective: '두 번째 종목: 월봉 화면 읽기',
        mood: 'info',
        coach:
          '지금은 월봉이야. 한 봉이 한 달 동안의 OHLC를 한 덩어리로 보여 줘. 중기 흐름이나 박스권 볼 때 쓰는 단위지.',
        coachPlain:
          '봉 개수는 더 줄어. 한 칸이 한 달이라서, 그달에 어디서 열리고 어디서 닫혔는지만 먼저 보면 돼.',
        targets: function () {
          var w = document.getElementById('chartWrapper');
          return w ? [w] : [];
        },
        done: function () {
          return false;
        },
      },
      {
        objective: '두 번째 종목: 1년 누르기',
        mood: 'info',
        requiredRange: '1y',
        coach: '마지막으로 「1년」을 눌러.',
        targets: function () {
          var b = document.querySelector('#stockDetailView .detail-range-btn[data-range="1y"]');
          return b ? [b] : [];
        },
        done: function () {
          return (window.__jurinCurrentChartRange || '') === '1y';
        },
      },
      {
        objective: '두 번째 종목: 장기봉 화면 읽기',
        mood: 'info',
        coach:
          '지금은 연간에 가깝게 긴 간격으로 묶인 봉이야. 몇 년 단위 박스나 큰 추세를 볼 때 쓰는 화면이지.',
        coachPlain:
          '짧은 출렁임은 덜 보이고, 몇 년 치 큰 방향만 보고 싶을 때 쓴다고 보면 돼.',
        targets: function () {
          var w = document.getElementById('chartWrapper');
          return w ? [w] : [];
        },
        done: function () {
          return false;
        },
      },
      {
        objective: '튜토리얼 완료',
        mood: 'success',
        coach:
          '두 종목으로 일·주·월·연 단위를 모두 봤어. 같은 차트라도 봉 단위만 바꿔도 보이는 게 달라지니, 앞으로도 자주 바꿔 보면서 익숙해지면 돼.',
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
        var nudge = typeof opts.nudgeDown === 'number' ? opts.nudgeDown : 0;
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
          return;
        }
        if (nudge > 0 && opts.alwaysNudge) {
          window.setTimeout(function () {
            try {
              window.scrollBy({ top: nudge, left: 0, behavior: 'smooth' });
            } catch (e) {
              window.scrollBy(0, nudge);
            }
          }, 380);
        }
      });
    });
  }

  function fetchChartCoachExtra(callback) {
    var code = window.__jurinSelectedStockCode || '';
    var range = window.__jurinCurrentChartRange || '1d';
    var nameEl = document.getElementById('detailName');
    var stock_name = nameEl ? nameEl.textContent.trim() : '';
    if (!code) {
      callback(null);
      return;
    }
    fetch(getApiBase() + '/api/tutorial/chart-coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code, range: range, stock_name: stock_name }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data && data.success && data.text) callback(String(data.text).trim());
        else callback(null);
      })
      .catch(function () {
        callback(null);
      });
  }

  function init() {
    var overlay = getEl('marketStep2Overlay');
    var questHud = getEl('marketStep2QuestHud');
    var panel = questHud ? questHud.querySelector('.market-step2-panel') : null;
    var bannerEl = questHud ? questHud.querySelector('.market-step2-banner') : null;
    var nowEl = getEl('marketStep2Now');
    var progressEl = getEl('marketStep2Progress');
    var clearEl = getEl('marketStep2Clear');
    var closeBtn = getEl('marketStep2Close');
    var questItems = panel ? panel.querySelectorAll('.market-step2-quest-item') : [];

    if (!overlay || !questHud || !panel || !nowEl || !progressEl || !clearEl || !closeBtn || questItems.length !== 3)
      return;

    var current = 0;
    var activeTargets = [];
    var started = false;
    var pendingPersistStep2Complete = false;
    var pickPulseKeepAlive = null;

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
      var scrollOpts = {};
      if (inChartStep(current)) {
        scrollOpts = {
          coachBottomReserve: 220,
          pinBottomAboveReserve: true,
          pinGap: 14,
          pinDelay: 520,
        };
      }
      scrollTutorialTargetsIntoViewIfNeeded(activeTargets, scrollOpts);
    }

    function ensurePickTargetPulse() {
      if (!started) return;
      if (current === STEP_A_BACK) {
        var back = document.querySelector('#stockDetailView .btn-back');
        if (!back || !back.classList) return;
        var backExists = false;
        for (var j = 0; j < activeTargets.length; j++) {
          if (activeTargets[j] === back) {
            backExists = true;
            break;
          }
        }
        if (!backExists) {
          clearTargets();
          back.classList.add('tutorial-callout-target');
          activeTargets.push(back);
        } else if (!back.classList.contains('tutorial-callout-target')) {
          back.classList.add('tutorial-callout-target');
        }
        return;
      }
      if (current !== STEP_PICK_A && current !== STEP_PICK_B) return;
      var code = current === STEP_PICK_A ? STEP2_EXPECTED_A : STEP2_EXPECTED_B;
      var row = document.querySelector('#row-' + code);
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

    function updateQuestChecklist() {
      var clearPhase = document.body.classList.contains('market-step2-clear-phase');
      var q1Done = started && current >= STEP_PICK_B;
      var q2Done = started && (current > STEP_B_R1Y_READ || step2QuizActive);
      var q3Done = started && clearPhase;
      var q1Current = started && !q1Done && current >= STEP_PICK_A && current < STEP_PICK_B;
      var q2Current =
        started &&
        q1Done &&
        !q2Done &&
        current >= STEP_PICK_B &&
        current <= STEP_B_R1Y_READ &&
        !step2QuizActive;
      var q3Current = started && q2Done && !q3Done && (step2QuizActive || current === STEP_FINAL);

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
        document.body.classList.remove('market-step2-detail-overview');
        document.body.classList.remove('market-step2-detail-term-mode');
        document.body.classList.remove('market-step2-detail-spotlight');
        document.body.classList.remove('market-step2-overview-spotlight');
        document.body.classList.remove('tutorial-fx-spotlight');
        return;
      }
      var pickOverview =
        overviewVisible() && (current === STEP_PICK_A || current === STEP_PICK_B);
      var backSpot = detailVisible() && current === STEP_A_BACK;
      document.body.classList.toggle('market-step2-overview-spotlight', pickOverview);
      var spot = detailVisible() && inChartStep(current);
      document.body.classList.toggle('market-step2-detail-spotlight', spot || backSpot);
      document.body.classList.toggle('tutorial-fx-spotlight', pickOverview || spot || backSpot);
      document.body.classList.remove('market-step2-detail-overview');
      document.body.classList.remove('market-step2-detail-term-mode');
    }

    function ensureStep2DimGate(inClearPhase) {
      if (!started) return;
      document.body.classList.add('market-step2-active');
      document.body.classList.add('tutorial-fx-active');
      if (inClearPhase) {
        document.body.classList.add('tutorial-fx-clear');
      } else {
        document.body.classList.remove('tutorial-fx-clear');
      }
      if (!overlay.classList.contains('is-open')) {
        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
      }
    }

    function enforceStep2VisualState() {
      if (!started) return;
      var inClearPhase = document.body.classList.contains('market-step2-clear-phase');
      ensureStep2DimGate(inClearPhase);
      if (inClearPhase) {
        questHud.classList.remove('is-open');
        questHud.setAttribute('aria-hidden', 'true');
        overlay.classList.remove('is-dim');
        overlay.classList.add('is-clear-dim');
        overlay.style.background = 'rgba(2, 6, 4, 0.9)';
        overlay.style.zIndex = '1200';
        clearEl.classList.add('is-show');
      } else {
        overlay.classList.remove('is-clear-dim');
        clearEl.classList.remove('is-show');
        if (!overlay.classList.contains('is-dim')) {
          overlay.classList.add('is-dim');
        }
        overlay.style.background = 'rgba(4, 8, 6, 0.68)';
        overlay.style.zIndex = '400';
      }
    }

    function enterStep2ClearPhase() {
      document.body.classList.add('market-step2-clear-phase');
      ensureStep2DimGate(true);
      questHud.classList.remove('is-open');
      questHud.setAttribute('aria-hidden', 'true');
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.remove('is-dim');
      overlay.classList.add('is-clear-dim');
      overlay.style.background = 'rgba(2, 6, 4, 0.9)';
      overlay.style.zIndex = '1200';
      clearEl.classList.add('is-show');
      document.body.classList.remove('tutorial-fx-pick-pulse');
      document.body.classList.remove('market-step2-action-spotlight');
      document.body.classList.remove('market-step2-detail-overview');
      document.body.classList.remove('market-step2-detail-term-mode');
      document.body.classList.remove('market-step2-detail-spotlight');
      document.body.classList.remove('market-step2-overview-spotlight');
      updateQuestChecklist();
    }

    function resetStep2ClearState() {
      overlay.classList.remove('is-clear-dim');
      overlay.classList.remove('is-dim');
      overlay.style.background = '';
      overlay.style.zIndex = '';
      clearEl.classList.remove('is-show');
      document.body.classList.remove('market-step2-clear-phase');
      document.body.classList.remove('tutorial-fx-clear');
    }

    function showCoach(step, after) {
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        if (typeof after === 'function') after();
        return;
      }
      var onConfirmCb = function () {
        if (typeof after === 'function') after();
        else proceed();
      };
      window.MascotCoach.show({
        mood: step.mood || 'info',
        title: '루미 가이드',
        text: stripMdBold(step.coach || ''),
        confirmLabel: '확인',
        instantText: false,
        onConfirm: onConfirmCb,
      });
    }

    function showCoachTrend(step, after) {
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        if (typeof after === 'function') after();
        return;
      }
      var base = step.coach || '';
      var plain = step.coachPlain || '';
      function finishTrend() {
        if (typeof after === 'function') after();
        else proceed();
      }
      function openPlainModal() {
        window.MascotCoach.show({
          mood: step.mood || 'info',
          title: '루미 가이드',
          text: stripMdBold(plain),
          confirmLabel: '확인',
          instantText: false,
          onConfirm: finishTrend,
        });
      }
      function openFirstModal(text) {
        window.MascotCoach.show({
          mood: step.mood || 'info',
          title: '루미 가이드',
          text: text,
          confirmLabel: '확인',
          instantText: true,
          onConfirm: function () {
            if (plain) openPlainModal();
            else finishTrend();
          },
        });
      }
      fetchChartCoachExtra(function (extra) {
        var line = extra ? shortenBlurb(extra, 62) : '';
        var tail = line
          ? '\n' + line
          : '\n(참고 없음 — 고점·저점 방향만 짚어 봐도 돼.)';
        openFirstModal(stripMdBold(base) + tail);
      });
    }

    function presentStepCoach(step) {
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        if (current === STEP_B_R1Y_READ) {
          ensureStep2DimGate(false);
          clearTargets();
          overlay.classList.add('is-dim');
          updateQuestChecklist();
          runQuizThenFinal();
        } else {
          render(current + 1);
        }
        return;
      }
      function advanceAfterPlain() {
        if (current === STEP_B_R1Y_READ) {
          ensureStep2DimGate(false);
          clearTargets();
          overlay.classList.add('is-dim');
          updateQuestChecklist();
          runQuizThenFinal();
          return;
        }
        render(current + 1);
      }
      function openPlainModal() {
        window.MascotCoach.show({
          mood: step.mood || 'info',
          title: '루미 가이드',
          text: stripMdBold(step.coachPlain || ''),
          confirmLabel: '확인',
          instantText: false,
          onConfirm: advanceAfterPlain,
        });
      }
      window.MascotCoach.show({
        mood: step.mood || 'info',
        title: '루미 가이드',
        text: stripMdBold(step.coach || ''),
        confirmLabel: '확인',
        instantText: false,
        onConfirm: function () {
          if (step.coachPlain) openPlainModal();
          else advanceAfterPlain();
        },
      });
    }

    function runQuizThenFinal() {
      step2QuizActive = true;
      updateQuestChecklist();
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        step2QuizActive = false;
        render(STEP_FINAL);
        return;
      }
      function finishQuizSuccess() {
        step2QuizActive = false;
        updateQuestChecklist();
        window.MascotCoach.show({
          mood: 'success',
          title: '루미 가이드',
          text: '3문제 모두 확인했어! 차트 읽기 연습 수고했어.',
          confirmLabel: '확인',
          onConfirm: function () {
            render(STEP_FINAL);
          },
        });
      }
      function wrongThenNext(idx) {
        var q = STEP2_QUIZ[idx];
        window.MascotCoach.show({
          mood: 'caution',
          title: '루미 가이드',
          text: '아쉽지만 오답이야.\n' + stripMdBold(q.wrongHint),
          confirmLabel: '다음 문제',
          onConfirm: function () {
            showQuizAt(idx + 1);
          },
        });
      }
      function rightThenNext(idx) {
        var q = STEP2_QUIZ[idx];
        window.MascotCoach.show({
          mood: 'success',
          title: '루미 가이드',
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
        window.MascotCoach.show({
          mood: 'info',
          title: '루미 퀴즈',
          text: stripMdBold(q.text),
          confirmLabel: 'O',
          dismissLabel: 'X',
          onConfirm: function () {
            if (q.correct === 1) {
              rightThenNext(idx);
            } else {
              wrongThenNext(idx);
            }
          },
          onDismiss: function () {
            if (q.correct === 2) {
              rightThenNext(idx);
            } else {
              wrongThenNext(idx);
            }
          },
        });
      }
      showQuizAt(0);
    }

    function render(stepIndex) {
      current = clamp(stepIndex, 0, STEPS.length - 1);
      var step = STEPS[current];
      nowEl.textContent = step.objective || '—';
      ensureStep2DimGate(false);

      applyTargetsFromStep(step);
      document.body.classList.toggle(
        'tutorial-fx-pick-pulse',
        started && isClickGuideStep(step, current)
      );
      document.body.classList.toggle('market-step2-action-spotlight', started && isCoreActionStep(current));
      var dim = started && !document.body.classList.contains('market-step2-clear-phase');
      overlay.classList.toggle('is-dim', Boolean(dim));
      updateDetailBodyClass();
      updateQuestChecklist();

      if (step.dynamicTrend) {
        showCoachTrend(step);
      } else if (step.coachPlain) {
        presentStepCoach(step);
      } else {
        showCoach(step);
      }
    }

    function proceed() {
      if (!started) return;
      var step = STEPS[current];
      if (!step || typeof step.done !== 'function') return;

      if (!step.done()) {
        if (step.dynamicTrend) {
          showCoachTrend(step);
        } else if (step.coachPlain) {
          presentStepCoach(step);
        } else {
          showCoach(step);
        }
        return;
      }

      if (current >= STEPS.length - 1) {
        clearTargets();
        if (window.MascotCoach && typeof window.MascotCoach.close === 'function') {
          window.MascotCoach.close();
        }
        pendingPersistStep2Complete = true;
        persistStep2AllComplete();
        enterStep2ClearPhase();
        setTimeout(function () {
          close(false);
        }, STEP2_CLEAR_HOLD_MS);
        return;
      }

      render(current + 1);
    }

    function close(fromUserQuit) {
      step2QuizActive = false;
      if (pendingPersistStep2Complete) {
        pendingPersistStep2Complete = false;
        stripTutorialParamFromUrl();
      }
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      questHud.classList.remove('is-open');
      questHud.setAttribute('aria-hidden', 'true');
      resetStep2ClearState();
      document.body.classList.remove('market-step2-active');
      document.body.classList.remove('tutorial-fx-active');
      document.body.classList.remove('tutorial-fx-spotlight');
      document.body.classList.remove('tutorial-fx-pick-pulse');
      document.body.classList.remove('market-step2-detail-overview');
      document.body.classList.remove('market-step2-detail-term-mode');
      document.body.classList.remove('market-step2-detail-spotlight');
      document.body.classList.remove('market-step2-overview-spotlight');
      document.body.classList.remove('market-step2-action-spotlight');
      clearTargets();
      started = false;
      interaction.openedDetail = false;
      interaction.firstCode = null;
      interaction.secondCode = null;
      pickHandledA = false;
      pickHandledB = false;
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
      interaction.firstCode = null;
      interaction.secondCode = null;
      pickHandledA = false;
      pickHandledB = false;
      pendingPersistStep2Complete = false;
      step2QuizActive = false;
      if (pickPulseKeepAlive) {
        window.clearInterval(pickPulseKeepAlive);
      }
      pickPulseKeepAlive = window.setInterval(function () {
        ensurePickTargetPulse();
        enforceStep2VisualState();
      }, 350);
      resetStep2ClearState();
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      questHud.classList.add('is-open');
      questHud.setAttribute('aria-hidden', 'false');
      document.body.classList.add('market-step2-active');
      document.body.classList.add('tutorial-fx-active');
      enforceStep2VisualState();
      if (bannerEl) {
        bannerEl.classList.remove('is-hide');
        window.setTimeout(function () {
          if (bannerEl) bannerEl.classList.add('is-hide');
        }, 1400);
      }
      render(STEP_PICK_A);
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
          '2단계 시작! 삼성전자(005930)와 NAVER(035420)로 기간별 차트를 눌러 보자. 확인 누르면 시작!',
        confirmLabel: '확인',
        onConfirm: function () {
          open();
        },
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
        var code = row.id && row.id.indexOf('row-') === 0 ? row.id.slice(4) : null;
        if (!code) return;

        if (current === STEP_PICK_A) {
          if (pickHandledA) return;
          if (code !== STEP2_EXPECTED_A) {
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
          pickHandledA = true;
          interaction.firstCode = code;
          interaction.openedDetail = true;
          window.setTimeout(function () {
            render(STEP_A_R1D);
          }, 450);
          return;
        }
        if (current === STEP_PICK_B) {
          if (code !== STEP2_EXPECTED_B) {
            if (window.MascotCoach && typeof window.MascotCoach.show === 'function') {
              window.MascotCoach.show({
                mood: 'caution',
                title: '루미 가이드',
                text: 'NAVER(035420) 행을 눌러 줘.',
                confirmLabel: '확인',
                onConfirm: function () {},
              });
            }
            return;
          }
          if (pickHandledB) return;
          pickHandledB = true;
          interaction.secondCode = code;
          interaction.openedDetail = true;
          window.setTimeout(function () {
            render(STEP_B_R1D);
          }, 450);
          return;
        }
      },
      false
    );

    function tryAutoAdvanceAfterRangeClick(clickedRange) {
      if (!started || !clickedRange) return;
      var step = STEPS[current];
      if (!step || !step.requiredRange || step.requiredRange !== clickedRange) return;
      window.setTimeout(function () {
        if (!started) return;
        var st = STEPS[current];
        if (!st || st.requiredRange !== clickedRange) return;
        if (typeof st.done === 'function' && !st.done()) return;
        render(current + 1);
      }, 120);
    }

    function tryAutoAdvanceBackStep() {
      if (!started || current !== STEP_A_BACK) return;
      window.setTimeout(function () {
        if (!started || current !== STEP_A_BACK) return;
        var step = STEPS[current];
        if (!step || typeof step.done !== 'function' || !step.done()) return;
        pickHandledB = false;
        render(STEP_PICK_B);
      }, 120);
    }

    document.addEventListener(
      'click',
      function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('.detail-range-btn') : null;
        if (!btn || !started) return;
        var r = btn.getAttribute('data-range') || '';
        if (!r) return;
        tryAutoAdvanceAfterRangeClick(r);
      },
      true
    );

    document.addEventListener(
      'click',
      function (e) {
        var back = e.target && e.target.closest ? e.target.closest('#stockDetailView .btn-back') : null;
        if (!back || !started) return;
        tryAutoAdvanceBackStep();
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
