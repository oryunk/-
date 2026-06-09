/**
 * 파일: market.html 1단계 시세 튜토리얼(퀘스트·스포트라이트)
 * 설명( market.html 에서만 로드. 가이드 진행 비트와 localStorage 연동. )
 */
(function () {
  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  var interaction = {
    clickedUpFilter: false,
    clickedDownFilter: false,
    clickedVolumeFilter: false,
    openedDetail: false,
  };

  var STEP_INDICES = 0;
  var STEP_UP = 1;
  var STEP_DOWN = 2;
  var STEP_VOLUME = 3;
  var STEP_PICK = 4;
  var STEP_GRID_INTRO = 5;
  var STEP_TERM_OPEN_PREV = 6;
  var STEP_TERM_HIGH_LOW = 7;
  var STEP_TERM_LIMITS = 8;
  var STEP_TERM_VOL_VALUE = 9;
  var STEP_TERM_DELTA_RATE = 10;
  var STEP_WRAP = 11;
  var STEP_FINAL = 12;
  var STEP1_PICK_CODE = '005930';

  /** 가이드 「전체 튜토리얼」 5단계 중 1단계 클리어 시 비트 0 (guide.html 과 동일 키) */
  var TUTORIAL_MASK_KEY = 'jurinGuideTutorialBits';

  var STEP1_QUIZ = [
    {
      text: '문제 1/5 (O/X)\n코스피는 대형주 비중이 큰 시장이라고 보면 된다.',
      correct: 1,
      correctHint: '맞아! 코스피는 대형주·우량주 비중이 상대적으로 커.',
      wrongHint: '코스피는 대형주 비중이 크다고 보면 돼. 코스닥은 성장·벤처 쪽이 많아.',
    },
    {
      text: '문제 2/5 (O/X)\n코스닥은 대형주만 모여 있는 시장이다.',
      correct: 2,
      correctHint: '맞아! 코스닥은 중소·성장 기업이 많은 편이야.',
      wrongHint: '코스닥은 성장·벤처 쪽 종목이 많다고 보면 돼.',
    },
    {
      text: '문제 3/5 (O/X)\n주식 시장은 보통 오전 9시부터 오후 3시 30분까지 열려 있다.',
      correct: 1,
      correctHint: '정답이야! 우리나라 정규장은 대략 9:00~15:30이야.',
      wrongHint: '정규장은 보통 9시부터 3시 반까지라고 보면 돼.',
    },
    {
      text: '문제 4/5 (O/X)\n전일 종가는 오늘 시가와 항상 똑같다.',
      correct: 2,
      correctHint: '맞아! 시가는 장 시작 후 첫 체결 쪽이라 전일 종가와 다를 수 있어.',
      wrongHint: '전일 종가는 어제 마감가고, 오늘 시가는 장이 열린 뒤 첫 체결 쪽이야.',
    },
    {
      text: '문제 5/5 (O/X)\n거래대금은 가격과 거래량을 곱해 본, 그날 시장에서 움직인 돈의 규모다.',
      correct: 1,
      correctHint: '맞아! 거래대금은 가격 × 거래량으로, 얼마나 큰 돈이 움직였는지 보여 줘.',
      wrongHint: '거래대금은 가격과 거래량을 곱한 값이야. 거래량만큼 주식 수가 항상 같은 건 아니야.',
    },
  ];

  function getCoachBeats(step) {
    if (!step) return [''];
    if (step.coachBeats && step.coachBeats.length) return step.coachBeats;
    if (step.coach) return [step.coach];
    return [''];
  }

  function indicesSectionTargets() {
    var sec = document.querySelector('.indices-section');
    var g = document.getElementById('indicesGrid');
    if (sec) return [sec];
    return g ? [g] : [];
  }

  function filterUpButton() {
    var wrap = document.getElementById('stocksFilterBtns');
    if (!wrap) return [];
    var up = wrap.querySelector('.filter-btn[data-filter="up"]');
    return up ? [up] : [];
  }

  function filterDownButton() {
    var wrap = document.getElementById('stocksFilterBtns');
    if (!wrap) return [];
    var down = wrap.querySelector('.filter-btn[data-filter="down"]');
    return down ? [down] : [];
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
      coachBeats: [
        '위쪽 지수 카드만 봐도 오늘 시장이 전체로 올랐는지 내렸는지 감이 와.',
        '코스피는 대형주 비중이 크고, 코스닥은 성장·벤처 쪽이 많다고 보면 돼.',
        '장은 보통 9시부터 3시 반까지 열려 있어.',
      ],
      targets: indicesSectionTargets,
      done: function () {
        return true;
      },
    },
    {
      objective: '상승 종목으로 오늘 방향 보기',
      mood: 'excited',
      coachBeats: [
        '이번엔 상승 종목을 한번 볼까?',
        '오늘 주가가 오른 종목들만 모아서 볼 수 있어. 근데 단순히 "많이 올랐네?"로 끝내기보다는, 왜 올랐는지 이유도 같이 확인하는 습관이 중요해.',
        '「상승」을 눌러봐!',
      ],
      targets: function () {
        return filterUpButton();
      },
      done: function () {
        return interaction.clickedUpFilter;
      },
    },
    {
      objective: '하락 종목도 꼭 확인하기',
      mood: 'info',
      coachBeats: [
        '하락 종목도 꼭 확인해보자.',
        '투자는 수익만 보는 게 아니라 위험을 이해하는 것도 정말 중요하거든. 생각보다 좋은 종목이 잠깐 하락해서 보이는 경우도 있어.',
        '「하락」을 눌러봐!',
      ],
      targets: function () {
        return filterDownButton();
      },
      done: function () {
        return interaction.clickedDownFilter;
      },
    },
    {
      objective: '거래량으로 관심 종목 찾기',
      mood: 'curious',
      coachBeats: [
        '이건 거래량이야.',
        '거래량은 얼마나 많은 사람들이 그 종목을 사고팔았는지를 보여줘.',
        '평소에는 조용하던 종목인데 갑자기 거래량이 크게 늘었다면, 뭔가 투자자들의 관심을 끄는 일이 생겼을 가능성이 있어.',
        '「거래량」을 눌러봐!',
      ],
      targets: function () {
        return filterVolumeButton();
      },
      done: function () {
        return interaction.clickedVolumeFilter;
      },
    },
    {
      objective: '종목 하나 직접 눌러보기',
      mood: 'happy',
      coachBeats: [
        '좋아! 이제 종목 하나를 직접 눌러보자.',
        '상세 페이지에서는 현재가, 기업 정보, 투자 지표 같은 실제 투자할 때 자주 보게 되는 정보들을 확인할 수 있어.',
        '삼성전자(005930)를 눌러서 상세 페이지로 들어가 보자!',
      ],
      targets: function () {
        var row =
          document.querySelector('#row-' + STEP1_PICK_CODE) ||
          document.querySelector('#marketOverviewView .stock-row');
        return row ? [row] : [];
      },
      done: function () {
        return interaction.openedDetail;
      },
    },
    {
      objective: '상세 화면 익숙해지기',
      mood: 'success',
      coachBeats: [
        '잘 들어왔어!',
        '처음에는 숫자가 많아 보여서 조금 복잡하게 느껴질 수 있어. 근데 걱정하지 마. 앞으로 하나씩 같이 볼 거니까 금방 익숙해질 거야.',
        '이 네모 칸들이 오늘 시세를 나눠 보여 주는 곳이야.',
      ],
      targets: function () {
        var g = document.getElementById('detailGrid');
        return g ? [g] : [];
      },
      done: function () {
        return true;
      },
    },
    {
      objective: '시가·전일 종가 알아보기',
      mood: 'studying',
      coachBeats: [
        '시가는 장이 열린 뒤 처음 거래된 가격 쪽을 말해. 오늘 장이 어디서 시작됐는지 감 잡을 때 보면 돼.',
        '전일 종가는 어제 장 마감 때의 가격이야. 오늘 오른지 내린지 비교할 때 기준이 되는 숫자라고 보면 돼.',
      ],
      targets: function () {
        var openEl = document.getElementById('detailCardOpen');
        var prevEl = document.getElementById('detailCardPrevClose');
        return [openEl, prevEl].filter(Boolean);
      },
      done: function () {
        return true;
      },
    },
    {
      objective: '고가·저가 알아보기',
      mood: 'studying',
      coachBeats: [
        '고가는 오늘 장중에 지금까지 찍힌 가장 높은 가격이야. 위로 얼마나 올라갔는지 볼 때 쓰면 돼.',
        '저가는 오늘 장중에 지금까지 찍힌 가장 낮은 가격이야. 아래로 얼마나 내려왔는지 볼 때 보면 돼.',
      ],
      targets: function () {
        var highEl = document.getElementById('detailCardHigh');
        var lowEl = document.getElementById('detailCardLow');
        return [highEl, lowEl].filter(Boolean);
      },
      done: function () {
        return true;
      },
    },
    {
      objective: '상한가·하한가 알아보기',
      mood: 'studying',
      coachBeats: [
        '상한가는 하루에 오를 수 있는 끝값, 하한가는 내릴 수 있는 끝값이야.',
        '보통 전일 종가를 기준으로 정해지고, 하루에 움직일 수 있는 범위를 보여줘.',
      ],
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
      objective: '거래량·거래대금 알아보기',
      mood: 'studying',
      coachBeats: [
        '이 거래량은 오늘 그 종목이 얼마나 많이 거래됐는지 보여줘. 아까 목록에서 본 거래량 순이랑 같은 맥락이야.',
        '거래대금은 가격 × 거래량으로, 그날 얼마나 큰 돈이 움직였는지 보여줘. 거래량이 "몇 주"였다면, 거래대금은 "얼마어치"에 가깝다고 보면 돼.',
      ],
      targets: function () {
        var volEl = document.getElementById('detailCardVolume');
        var valEl = document.getElementById('detailCardTradedValue');
        return [volEl, valEl].filter(Boolean);
      },
      done: function () {
        return true;
      },
    },
    {
      objective: '전일대비·등락률 알아보기',
      mood: 'studying',
      coachBeats: [
        '전일대비는 어제 종가와 오늘 가격 차이를 보여줘. ▲면 올랐고 ▼면 내렸다는 뜻이야.',
        '등락률은 그 차이를 퍼센트로 바꾼 값이야. 얼마나 크게 움직였는지 한눈에 비교할 때 보면 돼.',
      ],
      targets: function () {
        var deltaEl = document.getElementById('detailCardDelta');
        var rateEl = document.getElementById('detailCardRate');
        return [deltaEl, rateEl].filter(Boolean);
      },
      done: function () {
        return true;
      },
    },
    {
      objective: '뉴스·수급도 같이 보기',
      mood: 'success',
      coachBeats: [
        '여기까지가 시세 카드 핵심이야.',
        '가격이 왜 움직였는지는 이유가 하나가 아니니까, 아래 관련 뉴스·투자자 동향도 같이 보면 좋아.',
        '확인 누르면 짧은 퀴즈로 마무리할게!',
      ],
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
    {
      objective: '1단계 완료',
      mood: 'excited',
      coachBeats: [
        '1단계 완료!',
        '이제 시장 분위기와 종목 정보를 확인하는 방법을 알게 되었어.',
        '다음 단계에서는 차트가 어떤 의미를 가지고 있는지 같이 알아보자!',
      ],
      targets: function () {
        return [];
      },
      done: function () {
        return true;
      },
    },
  ];

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
              } catch (e) {
                window.scrollBy(0, delta);
              }
            }
          }, delay);
        }
      });
    });
  }

  function scrollIndicesChartsIntoView() {
    var grid = document.getElementById('indicesGrid');
    if (!grid) return;
    var chart =
      grid.querySelector('.index-inline-chart') ||
      grid.querySelector('.index-card');
    var anchor = chart || grid;
    scrollTutorialTargetsIntoViewIfNeeded([anchor], {
      scrollBlock: 'start',
      topMargin: 88,
      bottomMargin: 24,
      coachBottomReserve: 250,
      pinBottomAboveReserve: true,
      pinGap: 16,
      pinDelay: 520,
      alwaysNudge: true,
    });
  }

  function init() {
    var overlay = getEl('marketStep1Overlay');
    var clearEl = getEl('marketStep1Clear');

    if (!overlay || !clearEl) return;

    var current = 0;
    var dialogueBeatIndex = 0;
    var activeTargets = [];
    var started = false;
    var detailGuideShown = false;
    var upPraiseShown = false;
    var downPraiseShown = false;
    var volumePraiseShown = false;
    var pendingPersistStep1Complete = false;
    var step1QuizActive = false;
    var indicesScrollNudgeTimer = null;
    var indicesViewNudgeBound = false;
    var calloutKeepAlive = null;

    function markGuideTutorialStep1Cleared() {
      if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.markTutorialStepComplete === 'function') {
        window.JurinTutorialUtil.markTutorialStepComplete(1);
        return;
      }
      try {
        var m = parseInt(localStorage.getItem(TUTORIAL_MASK_KEY + ':anon'), 10);
        if (isNaN(m) || m < 0) m = 0;
        m |= 1;
        localStorage.setItem(TUTORIAL_MASK_KEY + ':anon', String(m));
      } catch (e) { /* ignore */ }
    }

    function clearTargets() {
      activeTargets.forEach(function (el) {
        if (el && el.classList) el.classList.remove('tutorial-callout-target');
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
      if (!exists) {
        activeTargets.push(el);
      }
      if (!el.classList.contains('tutorial-callout-target')) {
        el.classList.add('tutorial-callout-target');
      }
      return true;
    }

    function ensureCalloutTargetsPulse() {
      if (!started || current !== STEP_INDICES) return;
      var raw = indicesSectionTargets();
      if (!raw || !raw.length) return;
      var stale = false;
      for (var i = activeTargets.length - 1; i >= 0; i--) {
        var t = activeTargets[i];
        if (!t || !t.isConnected || !document.body.contains(t)) {
          if (t && t.classList) t.classList.remove('tutorial-callout-target');
          activeTargets.splice(i, 1);
          stale = true;
        }
      }
      if (stale && activeTargets.length === 0) {
        raw.filter(Boolean).forEach(attachCalloutTarget);
        return;
      }
      raw.filter(Boolean).forEach(attachCalloutTarget);
    }

    function updatePickLockClass() {
      document.body.classList.toggle(
        'market-step1-pick-lock',
        started && current === STEP_PICK && !interaction.openedDetail
      );
    }

    function applyTargetsFromStep(step) {
      clearTargets();
      if (!step || typeof step.targets !== 'function') return;
      if (current === STEP_PICK && !interaction.openedDetail) {
        var pickRow =
          document.querySelector('#row-' + STEP1_PICK_CODE) ||
          document.querySelector('#marketOverviewView .stock-row');
        if (pickRow) {
          scrollTutorialTargetsIntoViewIfNeeded([pickRow]);
        }
        return;
      }
      var raw = step.targets();
      if (!raw) return;
      var list = Array.isArray(raw) ? raw : [raw];
      list.filter(Boolean).forEach(function (el) {
        attachCalloutTarget(el);
      });
      if (current === STEP_INDICES) {
        scrollTutorialTargetsIntoViewIfNeeded(activeTargets, {
          scrollBlock: 'start',
          topMargin: 88,
          bottomMargin: 24,
          coachBottomReserve: 250,
          pinBottomAboveReserve: true,
          pinGap: 16,
          pinDelay: 480,
          alwaysNudge: true,
        });
        scrollIndicesChartsIntoView();
      } else {
        scrollTutorialTargetsIntoViewIfNeeded(activeTargets);
      }
      ensureCalloutTargetsPulse();
    }

    function ensureIndicesViewNudgeListener() {
      if (indicesViewNudgeBound) return;
      indicesViewNudgeBound = true;
      function onIndicesViewportChange() {
        if (!started || current !== STEP_INDICES) return;
        if (indicesScrollNudgeTimer) window.clearTimeout(indicesScrollNudgeTimer);
        indicesScrollNudgeTimer = window.setTimeout(function () {
          indicesScrollNudgeTimer = null;
          scrollIndicesChartsIntoView();
        }, 140);
      }
      window.addEventListener('scroll', onIndicesViewportChange, { passive: true });
      window.addEventListener('resize', onIndicesViewportChange, { passive: true });
    }

    function updateSpotlightClass() {
      var on =
        started &&
        (current === STEP_INDICES ||
          (current === STEP_PICK && !interaction.openedDetail) ||
          (current === STEP_UP && !interaction.clickedUpFilter) ||
          (current === STEP_DOWN && !interaction.clickedDownFilter));
      document.body.classList.toggle('market-step1-spotlight', on);
    }

    function updateVolumeSpotlightClass() {
      var on = started && current === STEP_VOLUME && !interaction.clickedVolumeFilter;
      document.body.classList.toggle('market-step1-spotlight-volume', on);
    }

    function updateOverlayDim() {
      var dimForIndices = current === STEP_INDICES;
      var dimForPick = current === STEP_PICK && !interaction.openedDetail;
      var dimForUp = current === STEP_UP && !interaction.clickedUpFilter;
      var dimForDown = current === STEP_DOWN && !interaction.clickedDownFilter;
      var dimForVolume = current === STEP_VOLUME && !interaction.clickedVolumeFilter;
      var dimForDetailSpotlight = current >= STEP_GRID_INTRO && current <= STEP_WRAP;
      overlay.classList.toggle(
        'is-dim',
        dimForIndices ||
          dimForPick ||
          dimForUp ||
          dimForDown ||
          dimForVolume ||
          dimForDetailSpotlight
      );
    }

    function updateDetailBodyClass() {
      if (!started) {
        document.body.classList.remove('market-step1-detail-overview');
        document.body.classList.remove('market-step1-detail-term-mode');
        document.body.classList.remove('market-step1-detail-spotlight');
        document.body.classList.remove('tutorial-fx-spotlight');
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
        current >= STEP_TERM_OPEN_PREV && current <= STEP_TERM_DELTA_RATE
      );
      var commonSpot =
        started &&
        (current === STEP_INDICES ||
          (current === STEP_PICK && !interaction.openedDetail) ||
          (current === STEP_UP && !interaction.clickedUpFilter) ||
          (current === STEP_DOWN && !interaction.clickedDownFilter) ||
          (current === STEP_VOLUME && !interaction.clickedVolumeFilter) ||
          (current >= STEP_GRID_INTRO && current <= STEP_WRAP));
      document.body.classList.toggle('tutorial-fx-spotlight', commonSpot);
    }

    function bootstrapCoachUi() {
      if (window.JurinGuideLumi && typeof window.JurinGuideLumi.start === 'function') {
        window.JurinGuideLumi.start();
      }
      document.body.classList.remove('mascot-coach-minimized');
      if (window.LumiChat && typeof window.LumiChat.close === 'function') {
        window.LumiChat.close();
      }
      if (window.MascotCoach) {
        if (typeof window.MascotCoach.close === 'function') {
          window.MascotCoach.close();
        }
        if (typeof window.MascotCoach.hideDock === 'function') {
          window.MascotCoach.hideDock();
        }
      }
    }

    function showCoachMessage(opts, retryCount) {
      retryCount = typeof retryCount === 'number' ? retryCount : 0;
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        if (retryCount < 2) {
          window.setTimeout(function () {
            showCoachMessage(opts, retryCount + 1);
          }, 80);
        }
        return;
      }
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
        var root = document.getElementById('mascotCoach');
        if (root && !root.classList.contains('is-open') && retryCount < 1) {
          window.setTimeout(function () {
            showCoachMessage(opts, retryCount + 1);
          }, 50);
        }
      });
    }

    function showCoach(step, extra) {
      if (!step) return;
      updatePickLockClass();
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
          if (extra && typeof extra.onAfterBeats === 'function') {
            extra.onAfterBeats();
            return;
          }
          proceed();
        },
      };
      if (extra && typeof extra === 'object') {
        if (extra.confirmLabel) payload.confirmLabel = extra.confirmLabel;
        if (extra.onConfirm) {
          var afterBeats = extra.onConfirm;
          payload.onConfirm = function () {
            if (dialogueBeatIndex < beats.length - 1) {
              dialogueBeatIndex += 1;
              showCoach(step, extra);
              return;
            }
            dialogueBeatIndex = 0;
            afterBeats();
          };
        }
      }
      showCoachMessage(payload);
    }

    function showUpPraiseThenGoDown() {
      dialogueBeatIndex = 0;
      showCoachMessage({
        mood: 'happy',
        text: '좋아! 오늘 오른 종목만 골라봤어. 이번엔 하락 종목도 같이 확인해보자.',
        onConfirm: function () {
          render(STEP_DOWN);
        },
      });
    }

    function showDownPraiseThenGoVolume() {
      dialogueBeatIndex = 0;
      showCoachMessage({
        mood: 'happy',
        text: '잘했어! 상승이랑 하락 둘 다 보면 오늘 시장 그림이 더 선명해져. 이제 거래량도 같이 볼까?',
        onConfirm: function () {
          render(STEP_VOLUME);
        },
      });
    }

    function showVolumePraiseThenPick() {
      dialogueBeatIndex = 0;
      showCoachMessage({
        mood: 'happy',
        text: '좋아! 거래량 순이면 오늘 어디에 관심이 쏠렸는지 감 잡기 좋지? 이제 종목 하나 골라서 상세로 들어가 보자.',
        onConfirm: function () {
          render(STEP_PICK);
        },
      });
    }

    function filterUpStepAllowsClick(target) {
      if (!target || !target.closest) return false;
      if (target.closest('#mascotCoach')) return true;
      var btn = target.closest('.filter-btn[data-filter]');
      return Boolean(btn && btn.dataset.filter === 'up');
    }

    function filterDownStepAllowsClick(target) {
      if (!target || !target.closest) return false;
      if (target.closest('#mascotCoach')) return true;
      var btn = target.closest('.filter-btn[data-filter]');
      return Boolean(btn && btn.dataset.filter === 'down');
    }

    function volumeStepAllowsClick(target) {
      if (!target || !target.closest) return false;
      if (target.closest('#mascotCoach')) return true;
      var btn = target.closest('.filter-btn[data-filter]');
      return Boolean(btn && btn.dataset.filter === 'volume');
    }

    function isGuardedStep() {
      if (step1QuizActive) return false;
      return true;
    }

    function isCoachOnlyStep(stepIdx) {
      if (stepIdx === STEP_INDICES) return true;
      if (stepIdx >= STEP_GRID_INTRO && stepIdx <= STEP_WRAP) return true;
      return false;
    }

    function stepAllowsClick(target) {
      if (!target || !target.closest) return false;
      if (current === STEP_UP && !interaction.clickedUpFilter) {
        return filterUpStepAllowsClick(target);
      }
      if (current === STEP_DOWN && !interaction.clickedDownFilter) {
        return filterDownStepAllowsClick(target);
      }
      if (current === STEP_VOLUME && !interaction.clickedVolumeFilter) {
        return volumeStepAllowsClick(target);
      }
      if (current === STEP_PICK && !interaction.openedDetail) {
        var samsungRow = document.querySelector('#row-' + STEP1_PICK_CODE);
        if (samsungRow && target.closest('#row-' + STEP1_PICK_CODE)) return true;
        if (!samsungRow && target.closest('.stock-row')) return true;
      }
      return false;
    }

    function step1NavWrongMessage(target) {
      if (!target || !target.closest) return null;
      var navLink = target.closest('.nav-menu a');
      if (!navLink) return null;
      var href = String(navLink.getAttribute('href') || '').toLowerCase();
      if (href.indexOf('market.html') >= 0) return null;
      if (href.indexOf('analysis.html') >= 0) {
        return '지금은 상단 메뉴에서 「AI 분석」이 아니야! 안내한 곳만 눌러 줘.';
      }
      if (href.indexOf('ai-chart') >= 0) {
        return '지금은 상단 메뉴에서 「AI 차트 예측」이 아니야! 안내한 곳만 눌러 줘.';
      }
      if (href.indexOf('guide.html') >= 0) {
        return '지금은 상단 메뉴에서 「가이드」가 아니야! 안내한 곳만 눌러 줘.';
      }
      if (href.indexOf('community.html') >= 0) {
        return '지금은 상단 메뉴에서 「커뮤니티」가 아니야! 안내한 곳만 눌러 줘.';
      }
      if (href.indexOf('topic=elw') >= 0) {
        return '지금은 상단 메뉴에서 「ELW」가 아니야! 안내한 곳만 눌러 줘.';
      }
      if (href.indexOf('topic=bonds') >= 0) {
        return '지금은 상단 메뉴에서 「채권」이 아니야! 안내한 곳만 눌러 줘.';
      }
      if (href.indexOf('chart-lab') >= 0) {
        return '지금은 상단 메뉴에서 「차트연구소」가 아니야! 안내한 곳만 눌러 줘.';
      }
      return '지금은 가이드에 집중하자! 안내한 곳만 눌러 줘.';
    }

    function getWrongMessageForStep(target) {
      if (!target || !target.closest) return null;
      var navMsg = step1NavWrongMessage(target);
      if (navMsg) return navMsg;
      if (window.JurinTutorialGuard.isBlockedChromeClick(target)) return null;
      if (current === STEP_INDICES) {
        if (target.closest && target.closest('.index-card')) {
          return '지금은 지수 카드를 누르지 말고 설명만 들어봐!';
        }
        return '지금은 위쪽 지수 카드에 집중해 줘!';
      }
      if (current === STEP_UP && !interaction.clickedUpFilter) {
        return '지금은 「상승」 버튼을 눌러 줘!';
      }
      if (current === STEP_DOWN && !interaction.clickedDownFilter) {
        return '지금은 「하락」 버튼을 눌러 줘!';
      }
      if (current === STEP_VOLUME && !interaction.clickedVolumeFilter) {
        return '지금은 「거래량」 버튼을 눌러 줘!';
      }
      if (current === STEP_PICK && !interaction.openedDetail) {
        return '지금은 삼성전자(' + STEP1_PICK_CODE + ') 행을 눌러 상세 화면을 열어 줘!';
      }
      if (current >= STEP_GRID_INTRO && current <= STEP_WRAP) {
        return '지금은 안내 중인 시세 카드에 집중해 줘!';
      }
      return null;
    }

    function syncTutorialGuard() {
      if (!window.JurinTutorialGuard || typeof window.JurinTutorialGuard.set !== 'function') return;
      window.JurinTutorialGuard.set({
        isActive: function () {
          return (
            started &&
            overlay.classList.contains('is-open') &&
            !document.body.classList.contains('market-step1-clear-phase') &&
            !step1QuizActive
          );
        },
        allowsClick: function (target) {
          var G = window.JurinTutorialGuard;
          if (G.allowsMascotAndQuest(target)) return true;
          if (G.isBlockedChromeClick(target)) return false;
          if (!isGuardedStep()) return false;
          if (!isCoachOnlyStep(current) && G.allowsSpotlightTargets(target)) return true;
          return stepAllowsClick(target);
        },
        getWrongMessage: getWrongMessageForStep,
        onAfterWrong: function () {
          if (step1QuizActive) return;
          window.JurinTutorialGuard.restoreDockOrFallback(function () {
            showCoach(STEPS[current]);
          });
        },
      });
    }

    document.querySelectorAll('.stocks-filter .filter-btn[data-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var f = btn.dataset.filter;
        if (f === 'up') {
          if (!started) return;
          if (current === STEP_UP && !upPraiseShown) {
            interaction.clickedUpFilter = true;
            upPraiseShown = true;
            overlay.classList.remove('is-dim');
            clearTargets();
            updateSpotlightClass();
            updateVolumeSpotlightClass();
            showUpPraiseThenGoDown();
          }
          return;
        }
        if (f === 'down') {
          if (!started) return;
          if (current === STEP_DOWN && !downPraiseShown) {
            interaction.clickedDownFilter = true;
            downPraiseShown = true;
            overlay.classList.remove('is-dim');
            clearTargets();
            updateSpotlightClass();
            updateVolumeSpotlightClass();
            showDownPraiseThenGoVolume();
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

    function beginClearPhase() {
      current = STEP_FINAL;
      dialogueBeatIndex = 0;
      var finalStep = STEPS[STEP_FINAL];
      clearTargets();
      pendingPersistStep1Complete = true;
      step1QuizActive = false;
      document.body.classList.add('market-step1-clear-phase');
      document.body.classList.add('tutorial-fx-clear');
      overlay.classList.remove('is-dim');
      overlay.classList.add('is-clear-dim');
      clearEl.classList.add('is-show');
      document.body.classList.remove('market-step1-detail-overview');
      document.body.classList.remove('market-step1-detail-term-mode');
      document.body.classList.remove('market-step1-detail-spotlight');
      function finishAndGoGuide() {
        markGuideTutorialStep1Cleared();
        pendingPersistStep1Complete = false;
        if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.restoreNormalSiteUi === 'function') {
          window.JurinTutorialUtil.restoreNormalSiteUi({ stripTutorial: true });
        }
        window.location.replace('guide.html');
      }

      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        finishAndGoGuide();
        return;
      }

      showCoach(finalStep, {
        onConfirm: finishAndGoGuide,
      });
    }

    function runQuizThenFinal() {
      step1QuizActive = true;
      overlay.classList.remove('is-dim');
      clearTargets();
      updateDetailBodyClass();
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        step1QuizActive = false;
        beginClearPhase();
        return;
      }
      function finishQuizSuccess() {
        step1QuizActive = false;
        showCoachMessage({
          mood: 'success',
          text: '5문제 모두 확인했어! 1단계 시세 읽기 수고했어.',
          onConfirm: function () {
            beginClearPhase();
          },
        });
      }
      function wrongThenNext(idx) {
        var q = STEP1_QUIZ[idx];
        showCoachMessage({
          mood: 'caution',
          text: '아쉽지만 오답이야.\n' + (q.wrongHint || ''),
          confirmLabel: '다음 문제',
          onConfirm: function () {
            showQuizAt(idx + 1);
          },
        });
      }
      function rightThenNext(idx) {
        var q = STEP1_QUIZ[idx];
        showCoachMessage({
          mood: 'success',
          text: '정답이야!\n' + (q.correctHint || ''),
          confirmLabel: '다음 문제',
          onConfirm: function () {
            showQuizAt(idx + 1);
          },
        });
      }
      function showQuizAt(idx) {
        if (idx >= STEP1_QUIZ.length) {
          finishQuizSuccess();
          return;
        }
        var q = STEP1_QUIZ[idx];
        showCoachMessage({
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
      dialogueBeatIndex = 0;
      var step = STEPS[current];
      applyTargetsFromStep(step);
      updatePickLockClass();
      updateOverlayDim();
      updateSpotlightClass();
      updateVolumeSpotlightClass();
      updateDetailBodyClass();
      if (current === STEP_INDICES) {
        ensureIndicesViewNudgeListener();
      }
      syncTutorialGuard();
      showCoach(step);
    }

    function proceed() {
      if (!started) return;
      var step = STEPS[current];
      if (!step || typeof step.done !== 'function') return;
      if (!step.done()) {
        var beats = getCoachBeats(step);
        dialogueBeatIndex = Math.max(0, beats.length - 1);
        updatePickLockClass();
        updateSpotlightClass();
        updateDetailBodyClass();
        updateOverlayDim();
        showCoach(step);
        return;
      }
      if (current === STEP_WRAP) {
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
      step1QuizActive = false;
      dialogueBeatIndex = 0;
      if (indicesScrollNudgeTimer) {
        window.clearTimeout(indicesScrollNudgeTimer);
        indicesScrollNudgeTimer = null;
      }
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
      clearEl.classList.remove('is-show');
      overlay.classList.remove('is-clear-dim');
      document.body.classList.remove('market-step1-clear-phase');
      document.body.classList.remove('market-step1-active');
      document.body.classList.remove('tutorial-fx-active');
      document.body.classList.remove('tutorial-fx-spotlight');
      document.body.classList.remove('tutorial-fx-clear');
      document.body.classList.remove('tutorial-fx-pick-pulse');
      document.body.classList.remove('market-step1-spotlight');
      document.body.classList.remove('market-step1-spotlight-volume');
      document.body.classList.remove('market-step1-detail-overview');
      document.body.classList.remove('market-step1-detail-term-mode');
      document.body.classList.remove('market-step1-detail-spotlight');
      document.body.classList.remove('market-step1-pick-lock');
      clearTargets();
      if (calloutKeepAlive) {
        window.clearInterval(calloutKeepAlive);
        calloutKeepAlive = null;
      }
      started = false;
      window.__marketStep1OnDetailClosed = null;
      window.__marketStep1OnStocksRendered = null;
      overlay.classList.remove('is-dim');
      if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.clearTutorialProgress === 'function') {
        window.JurinTutorialUtil.clearTutorialProgress(1);
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
    }

    function scheduleStep1Open() {
      function run() {
        open();
      }
      if (document.readyState === 'complete') {
        window.setTimeout(run, 0);
      } else {
        window.addEventListener('load', run, { once: true });
      }
    }

    function beginStep1FromUrl() {
      bootstrapCoachUi();
      var tutorialUtil1 = window.JurinTutorialUtil;
      var handoff = false;
      var freshStart = false;
      if (tutorialUtil1) {
        if (typeof tutorialUtil1.consumeTutorialHandoff === 'function') {
          handoff = tutorialUtil1.consumeTutorialHandoff(1);
        }
        if (!handoff && typeof tutorialUtil1.consumeTutorialFreshStart === 'function') {
          freshStart = tutorialUtil1.consumeTutorialFreshStart(1);
        }
        if (freshStart) {
          if (typeof tutorialUtil1.clearTutorialProgress === 'function') {
            tutorialUtil1.clearTutorialProgress(1);
          }
          if (overlay.classList.contains('is-open')) {
            close(true);
          }
        }
      }
      window.__jurinGuideQuit = function () {
        close(true);
      };
      scheduleStep1Open();
    }

    function open() {
      bootstrapCoachUi();
      started = true;
      interaction.clickedUpFilter = false;
      interaction.clickedDownFilter = false;
      interaction.clickedVolumeFilter = false;
      interaction.openedDetail = false;
      detailGuideShown = false;
      upPraiseShown = false;
      downPraiseShown = false;
      volumePraiseShown = false;
      step1QuizActive = false;
      dialogueBeatIndex = 0;
      if (calloutKeepAlive) {
        window.clearInterval(calloutKeepAlive);
      }
      calloutKeepAlive = window.setInterval(function () {
        ensureCalloutTargetsPulse();
      }, 350);
      window.__marketStep1OnDetailClosed = function () {
        if (!started) return;
        if (current === STEP_PICK) {
          interaction.openedDetail = false;
          updatePickLockClass();
        }
      };
      window.__marketStep1OnStocksRendered = function () {
        if (!started) return;
        updatePickLockClass();
      };
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('market-step1-active');
      document.body.classList.add('tutorial-fx-active');
      window.__jurinGuideQuit = function () {
        close(true);
      };
      syncTutorialGuard();
      render(STEP_INDICES);
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && overlay.classList.contains('is-open')) {
        close(true);
      }
    });

    var params = new URLSearchParams(window.location.search);
    var tutorial = (params.get('tutorial') || '').toLowerCase().trim();

    document.addEventListener('click', function (event) {
      if (!started || current !== STEP_PICK) return;
      var samsungRow = document.querySelector('#row-' + STEP1_PICK_CODE);
      var row = samsungRow
        ? event.target && event.target.closest
          ? event.target.closest('#row-' + STEP1_PICK_CODE)
          : null
        : event.target && event.target.closest
          ? event.target.closest('.stock-row')
          : null;
      if (!row) return;
      if (
        !interaction.clickedUpFilter ||
        !interaction.clickedDownFilter ||
        !interaction.clickedVolumeFilter
      ) {
        return;
      }
      if (detailGuideShown) return;
      detailGuideShown = true;
      interaction.openedDetail = true;
      updatePickLockClass();
      window.setTimeout(function () {
        render(STEP_GRID_INTRO);
      }, 450);
    });

    if (tutorial === 'step1' || tutorial === '1') {
      beginStep1FromUrl();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
