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
  var STEP2_EXPECTED_CODE = '005930';
  var STEP2_CLEAR_HOLD_MS = 1500;

  var STEP_PICK = 0;
  var STEP_R1D = 1;
  var STEP_CANDLE = 2;
  var STEP_WICK = 3;
  var STEP_VOLUME = 4;
  var STEP_R1W = 5;
  var STEP_R1W_READ = 6;
  var STEP_R1M = 7;
  var STEP_R1M_READ = 8;
  var STEP_R1Y = 9;
  var STEP_R1Y_READ = 10;
  var STEP_FINAL = 11;

  var interaction = {
    openedDetail: false,
    stockCode: null,
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

  function persistStep2AllComplete() {
    try {
      localStorage.setItem(
        STEP2_CHECK_KEY,
        JSON.stringify({ chart_range: true, chart_basics: true, chart_one_stock: true })
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
    return idx >= STEP_R1D && idx <= STEP_R1Y_READ;
  }

  function isCoreActionStep(idx) {
    return idx === STEP_PICK;
  }

  function chartWrapperTarget() {
    var w = document.getElementById('chartWrapper');
    return w ? [w] : [];
  }

  function isClickGuideStep(step, idx) {
    if (isCoreActionStep(idx)) return true;
    return Boolean(step && step.requiredRange);
  }

  function buildSteps() {
    return [
      {
        objective: '삼성전자 차트 열기',
        mood: 'welcome',
        coach:
          '차트는 주가를 그림으로 그린 지도야. 숫자만 보면 헷갈려도, 봉만 익히면 읽기 쉬워져. 삼성전자(005930) 행을 눌러 상세·차트로 들어가 줘.',
        targets: function () {
          var row = document.querySelector('#row-' + STEP2_EXPECTED_CODE);
          var sec = document.querySelector('#marketOverviewView .stocks-section');
          if (row) return [row];
          return sec ? [sec] : [];
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
        objective: '일봉: 오늘 하루 읽기',
        mood: 'info',
        moodPlain: 'welcome',
        coach: '지금은 일봉이야. 보이는 한 칸이 오늘 하루의 성적표야.',
        coachPlain:
          '시가·고가·저가·종가(OHLC)가 한 봉에 들어 있어. 장이 끝나면 이 모양으로 남아.',
        targets: chartWrapperTarget,
        done: function () {
          return false;
        },
      },
      {
        objective: '봉 색 읽기',
        mood: 'wink',
        moodPlain: 'info',
        coach: '빨간 몸통은 그 기간에 종가가 시가보다 올랐을 때야. 파란 몸통은 내렸을 때고.',
        coachPlain: '몸통이 길수록 그 기간 움직임이 컸다는 뜻이야. 색만 먼저 보면 돼.',
        targets: chartWrapperTarget,
        done: function () {
          return false;
        },
      },
      {
        objective: '봉 꼬리 읽기',
        mood: 'caution',
        moodPlain: 'info',
        coach: '위·아래 얇은 선은 꼬리야. 그 기간 안에 잠깐 찍은 최고가·최저가야.',
        coachPlain: '몸통이 진짜 마감(종가) 쪽이고, 꼬리는 장중에 잠깐만 갔던 가격이야.',
        targets: chartWrapperTarget,
        done: function () {
          return false;
        },
      },
      {
        objective: '거래량 막대 읽기',
        mood: 'success',
        moodPlain: 'info',
        coach: '차트 아래 막대가 거래량이야. 1단계에서 본 「오늘 거래량」이 막대로 그려진 거야.',
        coachPlain:
          '막대가 길수록 그날(그 기간) 거래가 많았다고 보면 돼. 가격이 움직일 때 힘이 실렸는지 볼 때 써.',
        targets: chartWrapperTarget,
        done: function () {
          return false;
        },
      },
      {
        objective: '1주 봉 누르기',
        mood: 'welcome',
        requiredRange: '1w',
        coach: '차트 위쪽에서 「1주」를 눌러 봐.',
        targets: function () {
          var b = document.querySelector('#stockDetailView .detail-range-btn[data-range="1w"]');
          return b ? [b] : [];
        },
        done: function () {
          return (window.__jurinCurrentChartRange || '') === '1w';
        },
      },
      {
        objective: '주봉: 이번 주 읽기',
        mood: 'info',
        moodPlain: 'wink',
        coach: '주봉은 이번 주를 한 칸으로 묶은 거야. 하루 잡음은 줄어.',
        coachPlain: '「이번 주 전체로 위로 갔나, 아래로 갔나」에 초점을 맞춰 봐.',
        targets: chartWrapperTarget,
        done: function () {
          return false;
        },
      },
      {
        objective: '1개월 봉 누르기',
        mood: 'wink',
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
        objective: '월봉: 한 달 읽기',
        mood: 'success',
        moodPlain: 'info',
        coach: '월봉은 한 달을 한 봉으로 본 화면이야. 봉 개수가 더 줄어.',
        coachPlain: '그달에 어디서 열리고 어디서 닫혔는지만 먼저 보면 돼.',
        targets: chartWrapperTarget,
        done: function () {
          return false;
        },
      },
      {
        objective: '1년 봉 누르기',
        mood: 'welcome',
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
        objective: '년봉: 큰 그림 읽기',
        mood: 'success',
        moodPlain: 'wink',
        coach:
          '년봉은 큰 그림용이야. 출렁임은 줄고, 지금 가격이 예전보다 높은 편인지 낮은 편인지 대략만 보면 돼. 지금까지는 간단한 차트 읽기를 연습했어.',
        coachPlain:
          '심화적으로 차트를 해석하는 추세·지지·저항은 고수 코스에서 이어가자!',
        targets: chartWrapperTarget,
        done: function () {
          return false;
        },
      },
      {
        objective: '튜토리얼 완료',
        mood: 'success',
        coach:
          '삼성전자 차트로 일·주·월·년 봉과 봉 색·꼬리·거래량까지 봤어. 같은 화면이라도 기간만 바꿔도 보이는 게 달라져!',
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
    var questItems = panel ? panel.querySelectorAll('.market-step2-quest-item') : [];

    if (!overlay || !questHud || !panel || !nowEl || !progressEl || !clearEl || questItems.length !== 3) return;

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
      if (current !== STEP_PICK) return;
      var code = STEP2_EXPECTED_CODE;
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
      var q1Done = started && current >= STEP_R1D;
      var q2Done = started && (current > STEP_R1Y_READ || step2QuizActive);
      var q3Done = started && clearPhase;
      var q1Current = started && !q1Done && current === STEP_PICK;
      var q2Current =
        started &&
        q1Done &&
        !q2Done &&
        current >= STEP_R1D &&
        current <= STEP_R1Y_READ &&
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
      var pickOverview = overviewVisible() && current === STEP_PICK;
      document.body.classList.toggle('market-step2-overview-spotlight', pickOverview);
      var spot = detailVisible() && inChartStep(current);
      document.body.classList.toggle('market-step2-detail-spotlight', spot);
      document.body.classList.toggle('tutorial-fx-spotlight', pickOverview || spot);
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
        if (current === STEP_R1Y_READ) {
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
        if (current === STEP_R1Y_READ) {
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
          mood: step.moodPlain || step.mood || 'info',
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
          text: '5문제 모두 확인했어! 차트 읽기 연습 수고했어. 이제 3단계로 이어가 보자.',
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
      syncTutorialGuard();

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
      interaction.stockCode = null;
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

    function rangeMisclickLabel(range) {
      if (range === '1w') return '1주';
      if (range === '1m') return '1개월';
      if (range === '1y') return '1년';
      return range || '';
    }

    function isStrictMisclickStep() {
      if (step2QuizActive) return false;
      if (current === STEP_PICK && !pickHandled) return true;
      var step = STEPS[current];
      if (step && step.requiredRange) {
        var range = window.__jurinCurrentChartRange || '';
        return range !== step.requiredRange;
      }
      return false;
    }

    function syncTutorialGuard() {
      if (!window.JurinTutorialGuard || typeof window.JurinTutorialGuard.set !== 'function') return;
      window.JurinTutorialGuard.set({
        isActive: function () {
          return (
            started &&
            overlay.classList.contains('is-open') &&
            !document.body.classList.contains('market-step2-clear-phase') &&
            !step2QuizActive
          );
        },
        allowsClick: function (target) {
          var G = window.JurinTutorialGuard;
          if (G.allowsMascotAndQuest(target, 'marketStep2QuestHud', '.market-step2-panel')) return true;
          if (!isStrictMisclickStep()) return true;
          if (G.allowsSpotlightTargets(target)) return true;
          if (current === STEP_PICK && target.closest && target.closest('#row-' + STEP2_EXPECTED_CODE)) {
            return true;
          }
          var step = STEPS[current];
          if (step && step.requiredRange && target.closest) {
            return Boolean(
              target.closest('.detail-range-btn[data-range="' + step.requiredRange + '"]')
            );
          }
          return false;
        },
        getWrongMessage: function (target) {
          if (!isStrictMisclickStep()) return null;
          if (current === STEP_PICK) {
            return '앗, 그건 아니야! 삼성전자(005930) 행을 눌러 상세·차트로 들어가 줘.';
          }
          var step = STEPS[current];
          if (step && step.requiredRange) {
            var label = rangeMisclickLabel(step.requiredRange);
            return '앗, 그건 아니야! 차트 위쪽에서 「' + label + '」를 눌러줘.';
          }
          return null;
        },
        onAfterWrong: function () {
          if (step2QuizActive) return;
          window.JurinTutorialGuard.restoreDockOrFallback(function () {
            var step = STEPS[current];
            if (!step) return;
            if (step.dynamicTrend) showCoachTrend(step);
            else if (step.coachPlain) presentStepCoach(step);
            else showCoach(step);
          });
        },
      });
    }

    function open() {
      started = true;
      interaction.openedDetail = false;
      interaction.stockCode = null;
      pickHandled = false;
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
      window.__jurinGuideQuit = function () {
        close(true);
      };
      syncTutorialGuard();
      render(STEP_PICK);
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
          '2단계 시작! 삼성전자(005930) 차트로 일·주·월·년 봉과 봉·거래량을 같이 볼 거야. 확인 누르면 시작!',
        confirmLabel: '확인',
        onConfirm: function () {
          open();
        },
      });
      window.__jurinGuideQuit = function () {
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
            render(STEP_R1D);
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
