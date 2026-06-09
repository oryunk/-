/**
 * simulation.html 5단계: 모의투자 전체 흐름 안내 (퀴즈 없음, 실제 주문 없음)
 */
(function () {
  var TUTORIAL_MASK_KEY = 'jurinGuideTutorialBits';
  var STEP_BIT = 1 << 4;

  var STEP_INTRO = 0;
  var STEP_WHY = 1;
  var STEP_PICK = 2;
  var STEP_CHART = 3;
  var STEP_INFO = 4;
  var STEP_STOCK_HISTORY = 5;
  var STEP_QUOTE_INTRO = 6;
  var STEP_QUOTE_OPEN = 7;
  var STEP_QUOTE_HL = 8;
  var STEP_QUOTE_VOL = 9;
  var STEP_QUOTE_TV = 10;
  var STEP_QUOTE_EXEC = 11;
  var STEP_AI = 12;
  var STEP_CLOSE_SHEET = 13;
  var STEP_PORTFOLIO = 14;
  var STEP_TRADE_INTRO = 15;
  var STEP_MARKET_ORDER = 16;
  var STEP_LIMIT_ORDER = 17;
  var STEP_BUY_HOW = 18;
  var STEP_SELL_HOW = 19;
  var STEP_ORDER_STATUS = 20;
  var STEP_TRADE_HISTORY = 21;
  var STEP_PNL = 22;
  var STEP_RANKING = 23;
  var STEP_RESET = 24;
  var STEP_FINAL = 25;

  var interaction = {
    stockCode: '',
    stockName: '',
    openPrice: 0,
    pickDone: false,
    closeSheetDone: false,
  };

  function getCoachBeats(step) {
    if (!step) return [''];
    if (step.coachBeats && step.coachBeats.length) return step.coachBeats;
    if (step.coach) return [step.coach];
    return [''];
  }

  function getCoachMoods(step) {
    if (!step) return ['info'];
    if (step.coachMoods && step.coachMoods.length) return step.coachMoods;
    if (step.mood) return [step.mood];
    return ['info'];
  }

  function enterMainView(view) {
    if (typeof navigateSimMainView === 'function') {
      navigateSimMainView(view);
      return;
    }
    if (typeof setSimMainView === 'function') {
      setSimMainView(view);
      return;
    }
    var tabId =
      view === 'portfolio'
        ? 'simViewTabPortfolio'
        : view === 'pnl'
          ? 'simViewTabPnl'
          : view === 'ranking'
            ? 'simViewTabRanking'
            : view === 'reset'
              ? 'simViewTabReset'
              : '';
    var tab = tabId ? document.getElementById(tabId) : null;
    if (tab) tab.click();
  }

  function holdingSheetOpen() {
    var sheet = document.getElementById('simHoldingDetailSheet');
    return sheet && !sheet.hasAttribute('hidden');
  }

  function closeHoldingSheet() {
    var closeBtn = document.getElementById('simHoldingDetailClose');
    if (closeBtn && holdingSheetOpen()) closeBtn.click();
  }

  function reopenPickedHolding() {
    if (holdingSheetOpen()) return;
    if (!interaction.stockCode) return;
    var code = String(interaction.stockCode).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    var row = document.querySelector('tr.discovery-row[data-code="' + code + '"]');
    if (row) {
      row.click();
      return;
    }
    if (typeof openSimHoldingDetailSheet === 'function') {
      openSimHoldingDetailSheet(interaction.stockCode);
    }
  }

  function enterHoldingTab(tab) {
    if (typeof setSimHoldingSheetTab === 'function') {
      setSimHoldingSheetTab(tab);
      return;
    }
    var idMap = {
      chart: 'simHoldingTabChart',
      info: 'simHoldingTabInfo',
      history: 'simHoldingTabHistory',
      order: 'simHoldingTabOrder',
      options: 'simHoldingTabOptions',
    };
    var tabEl = document.getElementById(idMap[tab] || '');
    if (tabEl) tabEl.click();
  }

  function detailSheetTargets() {
    var sheet = document.getElementById('simHoldingDetailSheet');
    if (sheet && !sheet.hasAttribute('hidden')) return [sheet];
    return [];
  }

  function orderPanelTargets() {
    var panel = document.getElementById('simHoldingPanelOrder');
    if (panel && !panel.hasAttribute('hidden')) return [panel];
    return detailSheetTargets();
  }

  function quoteStatTargets(id) {
    var el = document.getElementById(id);
    if (el) {
      var stat = el.closest('.sim-holding-quote-stat');
      if (stat) return [stat];
      return [el];
    }
    return orderPanelTargets();
  }

  function chartTargets() {
    var panel = document.getElementById('simHoldingPanelChart');
    if (panel && !panel.hasAttribute('hidden')) return [panel];
    var wrap = document.getElementById('simHoldingChartWrap');
    if (wrap && wrap.style.display !== 'none') return [wrap];
    var chart = document.getElementById('simHoldingStockChart');
    if (chart) return [chart];
    return detailSheetTargets();
  }

  function infoTargets() {
    var panel = document.getElementById('simHoldingPanelInfo');
    if (panel && !panel.hasAttribute('hidden')) return [panel];
    return detailSheetTargets();
  }

  function stockHistoryTargets() {
    var panel = document.getElementById('simHoldingPanelHistory');
    if (panel && !panel.hasAttribute('hidden')) return [panel];
    return detailSheetTargets();
  }

  function aiTargets() {
    var panel = document.getElementById('simHoldingPanelOptions');
    if (panel && !panel.hasAttribute('hidden')) return [panel];
    return detailSheetTargets();
  }

  function pickSidebarTargets() {
    var wrap = document.querySelector('.market-sidebar .sim-rank-wrap');
    if (wrap) return [wrap];
    var table = document.querySelector('.market-sidebar .discovery-table');
    return table ? [table] : [];
  }

  function closeSheetTargets() {
    var btn = document.getElementById('simHoldingDetailClose');
    if (btn && holdingSheetOpen()) return [btn];
    var sheet = document.getElementById('simHoldingDetailSheet');
    return sheet && !sheet.hasAttribute('hidden') ? [sheet] : [];
  }

  function scrollToElement(el) {
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function scrollToTradingSection() {
    var wrap = document.getElementById('tradingFormsWrap');
    var sec = document.getElementById('trading-section');
    scrollToElement(wrap || sec);
  }

  function scrollToOrderStatusSection() {
    var el = document.querySelector('.order-status-board');
    scrollToElement(el);
  }

  function scrollToTradeHistorySection() {
    var el = document.querySelector('.trading-history');
    scrollToElement(el);
  }

  function portfolioTargets() {
    var sec = document.querySelector('.portfolio-section');
    if (sec) return [sec];
    var bal = document.getElementById('totalBalance');
    if (bal) {
      var wrap = bal.closest('.portfolio-balance');
      if (wrap) return [wrap];
      return [bal];
    }
    return [];
  }

  function tradingFormsTargets() {
    var wrap = document.getElementById('tradingFormsWrap');
    if (wrap) return [wrap];
    var sec = document.getElementById('trading-section');
    return sec ? [sec] : [];
  }

  function orderStatusTargets() {
    var el = document.querySelector('.order-status-board');
    return el ? [el] : [];
  }

  function tradeHistoryTargets() {
    var el = document.querySelector('.trading-history');
    return el ? [el] : [];
  }

  function pnlTargets() {
    var el = document.getElementById('simViewRealizedPnl');
    return el && !el.hasAttribute('hidden') ? [el] : [];
  }

  function rankingTargets() {
    var el = document.getElementById('simViewRanking');
    return el && !el.hasAttribute('hidden') ? [el] : [];
  }

  function resetTargets() {
    var el = document.getElementById('simViewReset');
    return el && !el.hasAttribute('hidden') ? [el] : [];
  }

  function getApiBase() {
    return typeof jurinApiBase === 'function' ? jurinApiBase() : window.JURIN_API_BASE || 'http://127.0.0.1:5000';
  }

  function persistStep5Complete() {
    if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.markTutorialStepComplete === 'function') {
      window.JurinTutorialUtil.markTutorialStepComplete(5);
      return;
    }
    try {
      var m = parseInt(localStorage.getItem(TUTORIAL_MASK_KEY + ':anon'), 10);
      if (isNaN(m) || m < 0) m = 0;
      m |= STEP_BIT;
      localStorage.setItem(TUTORIAL_MASK_KEY + ':anon', String(m));
    } catch (e) { /* ignore */ }
  }

  function buildSteps() {
    return [
      {
        objective: '모의투자 시작',
        mood: 'excited',
        coachMoods: ['welcome', 'excited'],
        coachBeats: [
          '드디어 마지막이야!',
          '지금까지 배운 걸 모의투자 화면에서 한번에 연결해 볼 거야.',
        ],
        targets: function () {
          return [];
        },
        autoAdvance: true,
      },
      {
        objective: '모의투자란?',
        mood: 'happy',
        coachMoods: ['happy', 'wink'],
        coachBeats: [
          '모의투자는 실제 돈 대신 가상 돈으로 연습하는 거야.',
          '실수해도 괜찮으니까 편하게 눌러 보면서 익혀 보자!',
        ],
        targets: function () {
          return [];
        },
        autoAdvance: true,
      },
      {
        objective: '종목 선택',
        mood: 'curious',
        coachMoods: ['curious', 'chart'],
        coachBeats: [
          '왼쪽 거래대금 순위에서 보고 싶은 종목을 골라 봐.',
          '각 종목 오른쪽에 현재가랑 등락률이 보여. 마음에 드는 종목을 골라 봐!',
        ],
        targets: pickSidebarTargets,
        actionRequired: true,
      },
      {
        objective: '차트',
        mood: 'chart',
        coachMoods: ['chart', 'curious'],
        coachBeats: [
          '종목을 누르면 상세가 열려. 차트 탭에서 가격 흐름을 볼 수 있어.',
          '오를지 내릴지 감 잡을 때 여기를 자주 볼 거야!',
        ],
        targets: chartTargets,
        onEnter: function () {
          reopenPickedHolding();
          enterHoldingTab('chart');
        },
      },
      {
        objective: '종목정보',
        mood: 'good_idea',
        coachMoods: ['good_idea', 'studying'],
        coachBeats: [
          '종목정보 탭은 3단계에서 본 기업 정보랑 연결돼.',
          '회사가 뭘 하는지 다시 확인할 수 있어.',
        ],
        targets: infoTargets,
        onEnter: function () {
          reopenPickedHolding();
          enterHoldingTab('info');
        },
      },
      {
        objective: '종목 거래내역',
        mood: 'chart',
        coachMoods: ['chart'],
        coachBeats: ['이 종목으로 내가 한 거래만 모아 보는 탭이야.'],
        targets: stockHistoryTargets,
        onEnter: function () {
          reopenPickedHolding();
          enterHoldingTab('history');
        },
      },
      {
        objective: '시세 탭',
        mood: 'info',
        coachMoods: ['info'],
        coachBeats: [
          '시세 탭이야. 오늘 장이 어떻게 움직였는지 숫자로 하나씩 볼 거야.',
        ],
        targets: orderPanelTargets,
        onEnter: function () {
          reopenPickedHolding();
          enterHoldingTab('order');
        },
      },
      {
        objective: '시가',
        mood: 'studying',
        coachMoods: ['studying'],
        coachBeats: ['시가는 오늘 장이 시작할 때 가격이야. 하루의 출발점이라고 보면 돼.'],
        targets: orderPanelTargets,
      },
      {
        objective: '고가·저가',
        mood: 'success',
        coachMoods: ['success', 'chart'],
        coachBeats: [
          '고가는 오늘 가장 비쌌던 가격, 저가는 가장 싸게 거래된 가격이야.',
          '시가랑 같이 보면 하루 흐름이 잡혀.',
        ],
        targets: orderPanelTargets,
      },
      {
        objective: '거래량',
        mood: 'curious',
        coachMoods: ['curious'],
        coachBeats: [
          '거래량은 오늘 몇 주나 거래됐는지야. 많을수록 그날 관심이 몰린 종목이야.',
        ],
        targets: orderPanelTargets,
      },
      {
        objective: '거래대금',
        mood: 'idea',
        coachMoods: ['idea'],
        coachBeats: [
          '거래대금은 가격×거래량. 거래량이 「몇 주」였다면, 거래대금은 「얼마어치 돈이 움직였는지」야.',
        ],
        targets: orderPanelTargets,
      },
      {
        objective: '체결강도',
        mood: 'good_idea',
        coachMoods: ['good_idea'],
        coachBeats: [
          '체결강도는 (매수÷매도)×100%야. 100% 넘으면 매수 쪽이 더 세고, 밑이면 매도 쪽이 더 셀 때.',
        ],
        targets: orderPanelTargets,
      },
      {
        objective: 'AI 의견',
        mood: 'idea',
        coachMoods: ['idea', 'curious'],
        coachBeats: [
          'AI 의견 탭에서는 이 종목에 대한 참고 의견을 볼 수 있어.',
          '혼자 판단하기 전에 한번 훑어 보는 용도야!',
        ],
        targets: aiTargets,
        onEnter: function () {
          reopenPickedHolding();
          enterHoldingTab('options');
        },
      },
      {
        objective: '상세 닫기',
        mood: 'info',
        coachMoods: ['info'],
        coachBeats: ['종목 상세는 여기서 닫으면 돼. 오른쪽 위 × 버튼을 눌러 줘.'],
        targets: closeSheetTargets,
        actionRequired: true,
        onEnter: function () {
          interaction.closeSheetDone = false;
          reopenPickedHolding();
        },
      },
      {
        objective: '내 자산',
        mood: 'studying',
        coachMoods: ['studying', 'happy'],
        coachBeats: [
          '이제 포트폴리오 탭을 설명할게. 총 자산이랑 예수금, 보유 종목을 한눈에 볼 수 있어.',
          '처음엔 가상 돈이 들어 있으니까 마음 편하게 연습해!',
        ],
        targets: portfolioTargets,
        onEnter: function () {
          closeHoldingSheet();
          enterMainView('portfolio');
        },
      },
      {
        objective: '구매·판매 영역',
        mood: 'idea',
        coachMoods: ['idea'],
        coachBeats: ['아래 구매·판매 영역이야. 여기서 매수랑 매도 주문을 넣어.'],
        targets: tradingFormsTargets,
        onEnter: function () {
          enterMainView('portfolio');
          scrollToTradingSection();
        },
      },
      {
        objective: '시장가',
        mood: 'excited',
        coachMoods: ['excited', 'idea'],
        coachBeats: [
          '시장가는 지금 시장에서 바로 체결되는 가격이야.',
          '급하게 사고팔 때 쓰는 방식이야. 주문하면 바로 체결될 수 있어.',
        ],
        targets: tradingFormsTargets,
      },
      {
        objective: '지정가',
        mood: 'studying',
        coachMoods: ['studying', 'idea'],
        coachBeats: [
          '지정가는 내가 원하는 가격을 직접 적어 두는 거야.',
          '그 가격에 맞는 상대가 나타나야 체결돼.',
        ],
        targets: tradingFormsTargets,
      },
      {
        objective: '매수 방법',
        mood: 'excited',
        coachMoods: ['excited', 'caution'],
        coachBeats: [
          '매수는 종목·수량·가격을 정한 뒤 빨간 매수 버튼을 누르면 돼.',
          '구매 칸 아래쪽 빨간 매수 버튼을 찾아 봐!',
        ],
        targets: tradingFormsTargets,
      },
      {
        objective: '매도 방법',
        mood: 'chart',
        coachMoods: ['chart', 'info'],
        coachBeats: [
          '매도는 보유 종목을 골라 수량·가격을 정하고 파란 매도 버튼을 눌러.',
          '매수랑 비슷한 흐름이야!',
        ],
        targets: tradingFormsTargets,
      },
      {
        objective: '주문·체결',
        mood: 'studying',
        coachMoods: ['studying', 'success'],
        coachBeats: [
          '주문·체결 현황판이야. 대기 중·체결·취소 상태가 카드로 보여.',
          '주문을 넣은 뒤 여기서 체결됐는지 확인하면 돼.',
        ],
        targets: orderStatusTargets,
        onEnter: function () {
          enterMainView('portfolio');
          scrollToOrderStatusSection();
        },
      },
      {
        objective: '거래 내역',
        mood: 'chart',
        coachMoods: ['chart', 'studying'],
        coachBeats: [
          '거래 내역에는 날짜·종목·매수/매도·체결 가격이 쌓여.',
          '나중에 내 매매를 돌아볼 때 자주 쓰는 곳이야.',
        ],
        targets: tradeHistoryTargets,
        onEnter: function () {
          enterMainView('portfolio');
          scrollToTradeHistorySection();
        },
      },
      {
        objective: '수익분석',
        mood: 'studying',
        coachMoods: ['studying', 'success'],
        coachBeats: [
          '수익분석 탭에서 실현 손익을 모아 볼 수 있어.',
          '어떤 매매가 이익이었는지 정리해 보는 데 쓰여.',
        ],
        targets: pnlTargets,
        onEnter: function () {
          closeHoldingSheet();
          enterMainView('pnl');
        },
      },
      {
        objective: '이달의 랭킹',
        mood: 'excited',
        coachMoods: ['excited'],
        coachBeats: [
          '이달의 랭킹에서 다른 사용자들이랑 수익을 비교해 볼 수 있어.',
        ],
        targets: rankingTargets,
        onEnter: function () {
          enterMainView('ranking');
        },
      },
      {
        objective: '초기화',
        mood: 'caution',
        coachMoods: ['caution', 'welcome'],
        coachBeats: [
          '초기화 탭은 계좌를 처음 상태로 되돌릴 때 써.',
          '연습 끝나고 새로 시작하고 싶을 때 찾아오면 돼!',
        ],
        targets: resetTargets,
        onEnter: function () {
          enterMainView('reset');
        },
      },
      {
        objective: '5단계 완료',
        mood: 'success',
        coachMoods: ['success', 'happy', 'wink'],
        coachBeats: [
          '5단계 완료!',
          '이제 1~4단계에서 배운 걸 모의투자에서 스스로 연결할 수 있어.',
          '필요할 때 다시 찾아와 — 루미가 옆에 있을게!',
        ],
        targets: function () {
          return [];
        },
      },
    ];
  }

  function injectTutorialDom() {
    if (!document.getElementById('simStep5Overlay')) {
      var html =
        '<motion.div class="market-step5-overlay sim-step5-overlay" id="simStep5Overlay" aria-hidden="true"></motion.div>' +
        '<motion.div class="sim-step5-confetti" id="simStep5Confetti" aria-hidden="true"></motion.div>';
      html = html.replace(/<\/?motion\.div/gi, function (tag) {
        return tag.replace(/motion\./gi, '');
      });
      document.body.insertAdjacentHTML('beforeend', html);
    }
    if (!document.getElementById('simStep5Clear')) {
      document.body.insertAdjacentHTML(
        'beforeend',
        '<div class="sim-step5-clear" id="simStep5Clear" aria-hidden="true">CLEAR</div>'
      );
    }
  }

  function init() {
    var params = new URLSearchParams(window.location.search);
    var tutorial = (params.get('tutorial') || '').toLowerCase().trim();
    if (tutorial !== 'step5' && tutorial !== '5') return;

    injectTutorialDom();
    var overlay = document.getElementById('simStep5Overlay');
    var confetti = document.getElementById('simStep5Confetti');
    var clearEl = document.getElementById('simStep5Clear');
    if (!overlay) return;

    var STEPS = buildSteps();
    var current = 0;
    var started = false;
    var activeTargets = [];
    var completed = false;
    var giftPhaseActive = false;
    var waitingForLogin = false;
    var dialogueBeatIndex = 0;

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
      var list = Array.isArray(raw) ? raw : raw ? [raw] : [];
      list.filter(Boolean).forEach(function (el) {
        if (el && el.classList) {
          el.classList.add('tutorial-callout-target');
          activeTargets.push(el);
        }
      });
    }

    var STEP5_BODY_CLASSES = [
      'sim-step5-spotlight',
      'tutorial-fx-spotlight',
      'sim-step5-detail-spotlight',
      'sim-step5-sidebar-spotlight',
      'sim-step5-sheet-spotlight',
      'sim-step5-portfolio-spotlight',
      'sim-step5-trade-only',
      'sim-step5-overview',
      'sim-step5-pick-lock',
    ];

    function removeStep5BodyClasses() {
      STEP5_BODY_CLASSES.forEach(function (cls) {
        document.body.classList.remove(cls);
      });
    }

    function isHoldingSheetStep(idx) {
      return idx >= STEP_CHART && idx <= STEP_AI;
    }

    function isTradeBlockStep(idx) {
      return idx >= STEP_TRADE_INTRO && idx <= STEP_SELL_HOW;
    }

    function isPortfolioTradeStep(idx) {
      return idx >= STEP_PORTFOLIO && idx <= STEP_TRADE_HISTORY;
    }

    function isMainViewStep(idx) {
      return idx >= STEP_PNL && idx <= STEP_RESET;
    }

    function isCloseSheetStep(idx) {
      return idx === STEP_CLOSE_SHEET;
    }

    function isSheetSpotlightStep(idx) {
      return isHoldingSheetStep(idx) || (isCloseSheetStep(idx) && holdingSheetOpen());
    }

    function isDetailSpotlightStep(idx) {
      return isSheetSpotlightStep(idx);
    }

    function isClearPhase() {
      return document.body.classList.contains('sim-step5-clear-phase');
    }

    function usesSpotlightDim(idx) {
      if (idx < STEP_PICK || idx > STEP_CLOSE_SHEET) return false;
      if (idx === STEP_CLOSE_SHEET) return holdingSheetOpen();
      return true;
    }

    function syncSpotlightDim() {
      var on = started && !completed && !isClearPhase() && usesSpotlightDim(current);
      overlay.classList.toggle('is-dim', on);
      document.body.classList.toggle('sim-step5-spotlight', on);
      document.body.classList.toggle('tutorial-fx-spotlight', on);
    }

    function isBlockedTradeClick(target) {
      if (!started || completed || !target || !target.closest) return false;
      if (target.closest('#trading-section .btn-trade')) return true;
      if (target.closest('#buyModal .btn-trade')) return true;
      if (target.closest('#sellModal .btn-trade')) return true;
      if (target.closest('button[onclick*="confirmBuyFromModal"]')) return true;
      if (target.closest('button[onclick*="confirmSellFromModal"]')) return true;
      if (target.closest('button[onclick*="confirmBuyFromHoldingModal"]')) return true;
      if (target.closest('button[onclick*="confirmQuickSellFromModal"]')) return true;
      return false;
    }

    function updatePickLockClass() {
      var active = started && !completed;
      document.body.classList.toggle(
        'sim-step5-pick-lock',
        active && current === STEP_PICK && !interaction.pickDone
      );
    }

    function updateBodyClasses() {
      var active = started && !completed;
      document.body.classList.toggle('simulation-step5-active', active);
      document.body.classList.toggle('tutorial-fx-active', active);
      document.body.classList.toggle('sim-step5-detail-spotlight', active && isDetailSpotlightStep(current));
      document.body.classList.toggle('sim-step5-sidebar-spotlight', active && current === STEP_PICK);
      document.body.classList.toggle('sim-step5-sheet-spotlight', active && isSheetSpotlightStep(current));
      document.body.classList.toggle(
        'sim-step5-portfolio-spotlight',
        active && isPortfolioTradeStep(current)
      );
      document.body.classList.toggle('sim-step5-trade-only', active && isTradeBlockStep(current));
      document.body.classList.toggle(
        'sim-step5-overview',
        active && (isPortfolioTradeStep(current) || isMainViewStep(current))
      );
      updatePickLockClass();
      syncSpotlightDim();
    }

    function needsCalloutRefresh(idx) {
      if (isHoldingSheetStep(idx)) return true;
      if (isDetailSpotlightStep(idx)) return true;
      if (isTradeBlockStep(idx)) return true;
      if (idx === STEP_ORDER_STATUS || idx === STEP_TRADE_HISTORY) return true;
      if (isPortfolioTradeStep(idx) || isMainViewStep(idx) || isCloseSheetStep(idx)) return true;
      if (idx === STEP_PICK) return true;
      return false;
    }

    function scheduleCalloutRefresh() {
      if (!needsCalloutRefresh(current)) return;
      var delays = [420, 700];
      if (
        isCloseSheetStep(current) ||
        isHoldingSheetStep(current) ||
        isTradeBlockStep(current) ||
        current === STEP_ORDER_STATUS ||
        current === STEP_TRADE_HISTORY
      ) {
        delays = [420, 700, 900];
      }
      delays.forEach(function (ms) {
        window.setTimeout(function () {
          if (!started || completed) return;
          var step = STEPS[current];
          if (!step) return;
          applyTargetsFromStep(step);
          updateBodyClasses();
        }, ms);
      });
    }

    function isActionStep(idx) {
      return idx === STEP_PICK || idx === STEP_CLOSE_SHEET;
    }

    function isCoachOnlyStep(idx) {
      if (idx === STEP_INTRO || idx === STEP_WHY) return true;
      if (isHoldingSheetStep(idx)) return true;
      if (isPortfolioTradeStep(idx)) return true;
      if (isMainViewStep(idx)) return true;
      return false;
    }

    function holdingTabLabel(idx) {
      if (idx === STEP_CHART) return '차트';
      if (idx === STEP_INFO) return '종목정보';
      if (idx === STEP_STOCK_HISTORY) return '거래내역';
      if (idx >= STEP_QUOTE_INTRO && idx <= STEP_QUOTE_EXEC) return '시세';
      if (idx === STEP_AI) return 'AI 의견';
      return '종목 상세';
    }

    function getWrongMessageForStep(target) {
      if (window.JurinTutorialGuard.isBlockedChromeClick(target)) return null;
      if (isBlockedTradeClick(target)) {
        return '지금은 설명만 볼 거야! 확인을 눌러 다음으로 가자.';
      }
      if (isHoldingSheetStep(current)) {
        if (target.closest && target.closest('#simHoldingDetailClose')) {
          return '아직 닫으라고 안 했어! 안내를 따라온 뒤에 × 버튼을 눌러 줘.';
        }
        if (target.closest && target.closest('.sim-holding-sheet-tabs')) {
          return '지금은 「' + holdingTabLabel(current) + '」 탭 설명 중이야! 다른 탭은 누르지 마.';
        }
        return '지금은 「' + holdingTabLabel(current) + '」 탭 설명을 들어봐! 확인을 눌러 줘.';
      }
      if (isPortfolioTradeStep(current)) {
        if (target.closest && target.closest('.sim-view-tabs')) {
          return '지금은 포트폴리오 설명을 들어봐! 확인을 눌러 줘.';
        }
        return '지금은 구매·판매 영역 설명 중이야! 다른 버튼은 누르지 마.';
      }
      if (isMainViewStep(current)) {
        return '지금은 안내를 들어봐! 확인을 눌러 줘.';
      }
      if (current === STEP_INTRO || current === STEP_WHY) {
        return '지금은 루미의 안내를 들어봐! 확인 버튼을 눌러 줘.';
      }
      if (current === STEP_PICK) {
        return '지금은 왼쪽 목록에서 종목 행을 눌러 줘.';
      }
      if (current === STEP_CLOSE_SHEET) {
        if (target.closest && target.closest('#simHoldingDetailClose')) return null;
        return '오른쪽 위 × 버튼을 눌러 종목 상세를 닫아 줘!';
      }
      return '지금은 안내한 곳만 눌러 줘!';
    }

    function showCoach(step, extra) {
      if (!step) return;
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        if (extra && typeof extra.onAfterBeats === 'function') extra.onAfterBeats();
        else if (!step.actionRequired && step.autoAdvance) proceed();
        return;
      }
      var beats = getCoachBeats(step);
      var moods = getCoachMoods(step);
      var text = beats[dialogueBeatIndex] || beats[0] || '';
      var mood = moods[dialogueBeatIndex] || moods[moods.length - 1] || step.mood || 'info';
      var label = '확인';
      if (step.actionRequired) label = '알겠어';
      var payload = {
        mood: mood,
        title: '루미',
        text: text,
        confirmLabel: label,
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
          handleCoachConfirm(step);
        },
      };
      if (extra && typeof extra === 'object') {
        if (extra.confirmLabel) payload.confirmLabel = extra.confirmLabel;
        if (extra.mood) payload.mood = extra.mood;
        if (extra.text != null) payload.text = extra.text;
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
      window.MascotCoach.show(payload);
    }

    function handleCoachConfirm(step) {
      if (current === STEP_PICK) {
        if (!interaction.pickDone) {
          showCoach(step, {
            mood: 'wink',
            text: '아직 종목을 고르지 않았어! 왼쪽 거래대금 순위에서 관심 있는 종목 행을 다시 한 번 눌러 줘.',
            onConfirm: function () {
              handleCoachConfirm(step);
            },
          });
        }
        return;
      }
      if (current === STEP_CLOSE_SHEET) {
        if (!interaction.closeSheetDone && holdingSheetOpen()) {
          showCoach(step, {
            mood: 'wink',
            text: '종목 상세를 닫으려면 오른쪽 위 × 버튼을 눌러 줘!',
            onConfirm: function () {
              handleCoachConfirm(step);
            },
          });
        }
        return;
      }
      if (!step.actionRequired) {
        proceed();
      }
    }

    function render(idx) {
      current = idx;
      dialogueBeatIndex = 0;
      var step = STEPS[current];
      if (!step) return;

      if (step.onEnter) {
        try {
          step.onEnter();
        } catch (e) { /* ignore */ }
      }

      applyTargetsFromStep(step);
      updateBodyClasses();
      scheduleCalloutRefresh();
      showCoach(step);
    }

    function proceed() {
      if (current === STEP_RESET) {
        beginClearPhase();
        return;
      }
      if (current >= STEP_FINAL) {
        finishTutorial();
        return;
      }
      render(current + 1);
    }

    function beginClearPhase() {
      current = STEP_FINAL;
      dialogueBeatIndex = 0;
      var finalStep = STEPS[STEP_FINAL];
      clearTargets();
      document.body.classList.add('sim-step5-clear-phase');
      document.body.classList.add('tutorial-fx-clear');
      removeStep5BodyClasses();
      overlay.classList.remove('is-dim');
      overlay.classList.add('is-clear-dim');
      if (clearEl) {
        clearEl.classList.add('is-show');
        clearEl.setAttribute('aria-hidden', 'false');
      }
      showCoach(finalStep, {
        onConfirm: function () {
          beginGiftPhase();
        },
      });
    }

    function beginGiftPhase() {
      giftPhaseActive = true;
      document.body.classList.remove('sim-step5-clear-phase', 'tutorial-fx-clear');
      overlay.classList.remove('is-clear-dim');
      if (clearEl) {
        clearEl.classList.remove('is-show');
        clearEl.setAttribute('aria-hidden', 'true');
      }
      persistStep5Complete();

      var giftFinished = false;
      function completeGiftFlow(withConfetti) {
        if (giftFinished) return;
        giftFinished = true;
        if (withConfetti) showConfettiBrief();
        window.setTimeout(finishTutorial, withConfetti ? 2800 : 0);
      }

      if (!window.LumiCon || typeof window.LumiCon.openRewardPreviewModal !== 'function') {
        completeGiftFlow(true);
        return;
      }

      window.LumiCon.openRewardPreviewModal({
        onClaimed: function () {
          if (window.LumiCon.closeRewardPreviewModal) {
            window.LumiCon.closeRewardPreviewModal();
          }
          completeGiftFlow(true);
        },
      });
      syncGuard();

      var rewardModal = document.getElementById('lumiConRewardModal');
      if (rewardModal) {
        var modalObs = new MutationObserver(function () {
          if (!rewardModal.hidden && !giftFinished) return;
          if (giftFinished) {
            modalObs.disconnect();
            return;
          }
          modalObs.disconnect();
          completeGiftFlow(false);
        });
        modalObs.observe(rewardModal, { attributes: true, attributeFilter: ['hidden'] });
      }
    }

    function showConfettiBrief() {
      if (!confetti) return;
      confetti.classList.add('is-active');
      confetti.setAttribute('aria-hidden', 'false');
      window.setTimeout(function () {
        confetti.classList.remove('is-active');
        confetti.setAttribute('aria-hidden', 'true');
      }, 2800);
    }

    function quitTutorial(fromUserQuit) {
      giftPhaseActive = false;
      started = false;
      clearTargets();
      overlay.classList.remove('is-open', 'is-dim');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove(
        'simulation-step5-active',
        'tutorial-fx-active',
        'tutorial-fx-clear',
        'sim-step5-clear-phase'
      );
      removeStep5BodyClasses();
      overlay.classList.remove('is-clear-dim');
      if (clearEl) {
        clearEl.classList.remove('is-show');
        clearEl.setAttribute('aria-hidden', 'true');
      }
      window.__jurinGuideQuit = null;
      if (window.JurinTutorialGuard) window.JurinTutorialGuard.clear();
      if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.clearTutorialProgress === 'function') {
        window.JurinTutorialUtil.clearTutorialProgress(5);
      }
      if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.restoreNormalSiteUi === 'function') {
        window.JurinTutorialUtil.restoreNormalSiteUi({
          stripTutorial: fromUserQuit === true,
        });
      }
    }

    function finishTutorial() {
      giftPhaseActive = false;
      completed = true;
      started = false;
      clearTargets();
      overlay.classList.remove('is-open', 'is-dim', 'is-clear-dim');
      document.body.classList.remove(
        'simulation-step5-active',
        'tutorial-fx-active',
        'tutorial-fx-clear',
        'sim-step5-clear-phase'
      );
      removeStep5BodyClasses();
      if (clearEl) {
        clearEl.classList.remove('is-show');
        clearEl.setAttribute('aria-hidden', 'true');
      }
      persistStep5Complete();
      window.__jurinGuideQuit = null;
      if (window.JurinTutorialGuard) window.JurinTutorialGuard.clear();
      if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.restoreNormalSiteUi === 'function') {
        window.JurinTutorialUtil.restoreNormalSiteUi({ stripTutorial: true });
      }
    }

    function closeTutorial() {
      quitTutorial(true);
    }

    function openTutorial() {
      waitingForLogin = false;
      started = true;
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      updateBodyClasses();
      window.__jurinGuideQuit = function () {
        quitTutorial(true);
      };
      syncGuard();
      render(STEP_INTRO);
    }

    function allowsMainViewTab(target, view) {
      if (!target.closest) return false;
      var tabId =
        view === 'portfolio'
          ? 'simViewTabPortfolio'
          : view === 'pnl'
            ? 'simViewTabPnl'
            : view === 'ranking'
              ? 'simViewTabRanking'
              : view === 'reset'
                ? 'simViewTabReset'
                : '';
      if (tabId && target.closest('#' + tabId)) return true;
      var panelId =
        view === 'portfolio'
          ? 'simViewPortfolio'
          : view === 'pnl'
            ? 'simViewRealizedPnl'
            : view === 'ranking'
              ? 'simViewRanking'
              : view === 'reset'
                ? 'simViewReset'
                : '';
      return panelId ? !!target.closest('#' + panelId) : false;
    }

    function syncGuard() {
      if (!window.JurinTutorialGuard) return;
      window.JurinTutorialGuard.set({
        isActive: function () {
          return (
            (started && !completed && overlay.classList.contains('is-open')) || giftPhaseActive
          );
        },
        allowsClick: function (target) {
          var G = window.JurinTutorialGuard;
          if (giftPhaseActive && target.closest && target.closest('#lumiConRewardModal')) {
            return true;
          }
          if (G.allowsMascotAndQuest(target)) return true;
          if (G.isBlockedChromeClick(target)) return false;
          if (isBlockedTradeClick(target)) return false;
          if (isCoachOnlyStep(current)) return false;
          if (current === STEP_PICK && target.closest && target.closest('tr.discovery-row')) {
            return true;
          }
          if (
            isCloseSheetStep(current) &&
            target.closest &&
            target.closest('#simHoldingDetailClose')
          ) {
            return true;
          }
          if (
            isHoldingSheetStep(current) &&
            target.closest &&
            target.closest('#simHoldingDetailClose')
          ) {
            return false;
          }
          return false;
        },
        getWrongMessage: getWrongMessageForStep,
        onAfterWrong: function () {
          var step = STEPS[current];
          if (step) {
            dialogueBeatIndex = 0;
            showCoach(step);
          }
        },
      });
    }

    function showLoginRequiredCoach() {
      waitingForLogin = true;
      if (!window.MascotCoach) {
        alert('5단계 모의투자는 로그인 후 이용할 수 있어요.');
        if (typeof openLoginModal === 'function') openLoginModal();
        return;
      }
      window.MascotCoach.show({
        mood: 'caution',
        title: '루미',
        text: '5단계 모의투자는 로그인 후에 할 수 있어. 로그인하면 바로 이어서 시작할 수 있어!',
        confirmLabel: '로그인',
        dismissLabel: '나중에',
        onConfirm: function () {
          if (typeof openLoginModal === 'function') openLoginModal();
        },
        onDismiss: function () {
          waitingForLogin = false;
        },
      });
    }

    function showIntroLoggedIn() {
      waitingForLogin = false;
      window.MascotCoach.show({
        mood: 'welcome',
        title: '루미',
        text:
          '5단계: 모의투자 전체 흐름이야! 종목 고르기 → 상세 탭 → 포트폴리오·주문 → 수익분석·랭킹까지 차근차근 볼 거야. 확인 누르면 시작!',
        confirmLabel: '시작',
        onConfirm: function () {
          openTutorial();
        },
      });
    }

    function checkAuthThenStart() {
      var tutorialUtil5 = window.JurinTutorialUtil;
      if (
        tutorialUtil5 &&
        typeof tutorialUtil5.consumeTutorialFreshStart === 'function' &&
        tutorialUtil5.consumeTutorialFreshStart(5)
      ) {
        if (typeof tutorialUtil5.clearTutorialProgress === 'function') {
          tutorialUtil5.clearTutorialProgress(5);
        }
        if (typeof tutorialUtil5.clearTutorialCompleteBit === 'function') {
          tutorialUtil5.clearTutorialCompleteBit(5);
        }
        if (started) quitTutorial(true);
        completed = false;
        current = 0;
        waitingForLogin = false;
      }
      fetch(getApiBase() + '/api/auth/me', { credentials: 'include' })
        .then(function (r) {
          return r.json().catch(function () {
            return {};
          });
        })
        .then(function (data) {
          if (started || completed) return;
          if (data && data.success && data.user) {
            showIntroLoggedIn();
            return;
          }
          showLoginRequiredCoach();
        })
        .catch(function () {
          alert('로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
        });
    }

    function retryAuthAfterLogin() {
      if (started || completed || !waitingForLogin) return;
      fetch(getApiBase() + '/api/auth/me', { credentials: 'include' })
        .then(function (r) {
          return r.json().catch(function () {
            return {};
          });
        })
        .then(function (data) {
          if (started || completed) return;
          if (data && data.success && data.user) {
            showIntroLoggedIn();
          }
        })
        .catch(function () { /* ignore */ });
    }

    var prevAfterJurinLogin = window.afterJurinLogin;
    window.afterJurinLogin = function () {
      if (typeof prevAfterJurinLogin === 'function') {
        try {
          prevAfterJurinLogin();
        } catch (e) { /* ignore */ }
      }
      retryAuthAfterLogin();
    };

    var discoveryBody = document.getElementById('discoveryTableBody');
    if (discoveryBody) {
      discoveryBody.addEventListener(
        'click',
        function (e) {
          if (!started || completed || current !== STEP_PICK) return;
          var tr = e.target.closest('tr.discovery-row');
          if (!tr) return;
          interaction.stockCode = String(tr.getAttribute('data-code') || '').trim();
          interaction.stockName = '';
          try {
            var enc = tr.getAttribute('data-name') || '';
            interaction.stockName = enc ? decodeURIComponent(enc) : '';
          } catch (err) {
            interaction.stockName = tr.getAttribute('data-name') || '';
          }
          var op = parseFloat(tr.getAttribute('data-open-price') || '', 10);
          interaction.openPrice = Number.isFinite(op) && op > 0 ? op : 0;
          interaction.pickDone = true;
          clearTargets();
          updateBodyClasses();
          window.setTimeout(function () {
            if (current !== STEP_PICK) return;
            var openEl = document.getElementById('simHoldingQuoteOpen');
            if (openEl && interaction.openPrice > 0 && typeof formatCurrency === 'function') {
              openEl.textContent = formatCurrency(interaction.openPrice);
            }
            proceed();
          }, 500);
        },
        true
      );
    }

    var holdingSheet = document.getElementById('simHoldingDetailSheet');
    if (holdingSheet) {
      var sheetObs = new MutationObserver(function () {
        if (!started || completed || current !== STEP_CLOSE_SHEET) return;
        if (!holdingSheetOpen()) {
          interaction.closeSheetDone = true;
          clearTargets();
          updateBodyClasses();
          window.setTimeout(function () {
            if (current === STEP_CLOSE_SHEET && interaction.closeSheetDone) {
              proceed();
            }
          }, 80);
        }
      });
      sheetObs.observe(holdingSheet, { attributes: true, attributeFilter: ['hidden', 'aria-hidden'] });
    }

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && started && !completed) closeTutorial();
    });

    checkAuthThenStart();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
