/**
 * simulation.html 5단계: 실전 모의투자 (클리어 문구·퀴즈 없음, 매수 실행 없이 방법 안내)
 */
(function () {
  var TUTORIAL_MASK_KEY = 'jurinGuideTutorialBits';
  var STEP_BIT = 1 << 4;

  var STEP_INTRO = 0;
  var STEP_PICK = 1;
  var STEP_CHART = 2;
  var STEP_QUOTE_INTRO = 3;
  var STEP_QUOTE_VOL = 4;
  var STEP_QUOTE_TV = 5;
  var STEP_QUOTE_EXEC = 6;
  var STEP_QUOTE_OPEN = 7;
  var STEP_QUOTE_HL = 8;
  var STEP_ORDERBOOK = 9;
  var STEP_DEPOSIT = 10;
  var STEP_TRADE_LIMIT = 11;
  var STEP_BUY_BTN = 12;
  var STEP_TRADE_SELL = 13;
  var STEP_FINAL = 14;

  var interaction = {
    stockCode: '',
    stockName: '',
    openPrice: 0,
    pickDone: false,
    buyPreviewDone: false,
  };

  function enterOrderTab() {
    if (typeof setSimHoldingSheetTab === 'function') {
      setSimHoldingSheetTab('order');
    } else {
      var tab = document.getElementById('simHoldingTabOrder');
      if (tab) tab.click();
    }
  }

  function enterChartTab() {
    if (typeof setSimHoldingSheetTab === 'function') {
      setSimHoldingSheetTab('chart');
    } else {
      var tab = document.getElementById('simHoldingTabChart');
      if (tab) tab.click();
    }
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

  function attachBuyModalPreviewWatcher() {
    var modal = document.getElementById('buyModal');
    if (!modal || modal.__simStep5BuyWatch) return;
    modal.__simStep5BuyWatch = true;
    var obs = new MutationObserver(function () {
      if (typeof window.__simStep5BuyPreviewCheck !== 'function') return;
      window.__simStep5BuyPreviewCheck(modal);
    });
    obs.observe(modal, { attributes: true, attributeFilter: ['class', 'aria-hidden'] });
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

  function quoteIntroTargets() {
    var panel = document.getElementById('simHoldingPanelOrder');
    if (panel && !panel.hasAttribute('hidden')) return [panel];
    return orderPanelTargets();
  }

  function pickRankTableTargets() {
    var table = document.querySelector('.market-sidebar .discovery-table');
    if (table) return [table];
    var wrap = document.querySelector('.market-sidebar .sim-rank-wrap');
    return wrap ? [wrap] : [];
  }

  function depositTargets() {
    var cash = document.getElementById('cashBalanceDisplay');
    if (cash) {
      var cell = cash.closest('.portfolio-split > div');
      if (cell) return [cell];
      var split = cash.closest('.portfolio-split');
      if (split) return [split];
    }
    var bal = document.querySelector('.portfolio-balance');
    return bal ? [bal] : [];
  }

  function getApiBase() {
    return typeof jurinApiBase === 'function' ? jurinApiBase() : window.JURIN_API_BASE || 'http://127.0.0.1:5000';
  }

  function persistStep5Complete() {
    try {
      var m = parseInt(localStorage.getItem(TUTORIAL_MASK_KEY), 10);
      if (isNaN(m) || m < 0) m = 0;
      m |= STEP_BIT;
      localStorage.setItem(TUTORIAL_MASK_KEY, String(m));
    } catch (e) { /* ignore */ }
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

  function holdingSheetOpen() {
    var sheet = document.getElementById('simHoldingDetailSheet');
    return sheet && !sheet.hasAttribute('hidden');
  }

  function buildSteps() {
    return [
      {
        objective: '시작',
        mood: 'welcome',
        coach:
          '드디어 실전이야! 차트를 보고 오를지 내릴지 생각한 뒤, 매수할지 매도할지 정해서 이익을 노려보자. 루미가 옆에서 같이 해볼게!',
        targets: function () {
          return [];
        },
        autoAdvance: true,
      },
      {
        objective: '종목 선택',
        mood: 'wink',
        coach:
          '왼쪽 거래대금 순위에서 보고 싶은 종목을 골라 봐. 누르면 차트랑 시세가 같이 열려.',
        targets: pickRankTableTargets,
        actionRequired: true,
      },
      {
        objective: '차트로 판단',
        mood: 'info',
        coach:
          '이 차트가 핵심이야. 봉이랑 거래량 보면서 「지금 살까, 팔까?」를 한번 스스로 생각해 봐. 감 맞히기보다 숫자로 근거 세우는 연습이야.',
        targets: chartTargets,
        onEnter: enterChartTab,
        autoAdvance: false,
      },
      {
        objective: '시세 탭',
        mood: 'info',
        coach:
          '이제 시세 탭이야. 오늘 장이 어떻게 움직였는지 숫자로 하나씩 볼 거야. 확인 누르면 다음으로 넘어가!',
        targets: quoteIntroTargets,
        onEnter: enterOrderTab,
      },
      {
        objective: '거래량',
        mood: 'info',
        coach:
          '거래량은 오늘 몇 주나 거래됐는지야. 많을수록 그날 관심이 몰린 종목—1단계에서 본 그거랑 같은 맥락이야.',
        targets: function () {
          return quoteStatTargets('simHoldingQuoteVolume');
        },
      },
      {
        objective: '거래대금',
        mood: 'info',
        coach:
          '거래대금은 가격×거래량. 거래량이 「몇 주」였다면, 거래대금은 「얼마어치 돈이 움직였는지」야.',
        targets: function () {
          return quoteStatTargets('simHoldingQuoteTradedValue');
        },
      },
      {
        objective: '체결강도',
        mood: 'success',
        coach:
          '체결강도는 (매수÷매도)×100%야. 100% 넘으면 매수 쪽이 더 세고, 밑이면 매도 쪽이 더 셀 때.',
        targets: function () {
          var exec = document.getElementById('simHoldingQuoteExec');
          if (exec && !exec.hasAttribute('hidden')) return [exec];
          return orderPanelTargets();
        },
      },
      {
        objective: '시가',
        mood: 'info',
        coach: '시가는 오늘 장이 시작할 때 가격이야. 하루의 출발점이라고 보면 돼.',
        targets: function () {
          var openV = document.getElementById('simHoldingQuoteOpen');
          if (openV) {
            var item = openV.closest('.sim-holding-quote-hl-item');
            if (item) return [item];
          }
          var hl = document.getElementById('simHoldingQuoteHL');
          return hl ? [hl] : orderPanelTargets();
        },
      },
      {
        objective: '고가·저가',
        mood: 'success',
        coach:
          '고가는 오늘 가장 비쌌던 가격, 저가는 가장 싸게 거래된 가격이야. 시가랑 같이 보면 하루 흐름이 잡혀.',
        targets: function () {
          var hl = document.getElementById('simHoldingQuoteHL');
          return hl ? [hl] : orderPanelTargets();
        },
      },
      {
        objective: '호가',
        mood: 'caution',
        coach:
          '여기 호가! 사고·팔고 싶은 가격을 적어 두는 곳이고 그걸 호가라고 해. 장이 닫힌 뒤 지정가 넣으면 바로 안 사지고 예약으로 대기했다가, 다음 장에 조건 맞으면 체결돼.',
        targets: function () {
          var ob = document.getElementById('orderbookOverlay');
          return ob && ob.classList.contains('is-open') ? [ob] : [];
        },
        onEnter: function () {
          if (interaction.stockCode && typeof window.openSimOrderbookForTutorial === 'function') {
            window.openSimOrderbookForTutorial(interaction.stockCode);
          }
        },
        autoAdvance: false,
      },
      {
        objective: '예수금',
        mood: 'welcome',
        coach:
          '호가는 여기까지! 모의투자 계좌 얘기할게. 주문에 쓸 수 있는 현금이 예수금이고, 처음엔 500만 원 들어 있으니 마음 편하게 연습해 봐.',
        targets: depositTargets,
        onEnter: function () {
          if (typeof closeOrderbookOverlay === 'function') closeOrderbookOverlay();
          var closeBtn = document.getElementById('simHoldingDetailClose');
          if (closeBtn && holdingSheetOpen()) closeBtn.click();
        },
      },
      {
        objective: '지정가·입력',
        mood: 'info',
        coach:
          '아래 구매 칸을 보면 돼. 지정가를 고르고, 사고 싶은 가격과 수량을 적어 두면 돼. 장이 닫혀 있으면 예약 주문으로 대기해.',
        targets: function () {
          var sec = document.getElementById('trading-section');
          return sec ? [sec] : [];
        },
        autoAdvance: false,
      },
      {
        objective: '매수 버튼',
        mood: 'info',
        coach:
          '빨간 매수 버튼을 한 번 눌러 봐! 확인 창이 뜨면 내용만 살펴보고 닫아도 돼. 지금은 실제 주문까지 하지 않아도 괜찮아.',
        targets: function () {
          var sec = document.getElementById('trading-section');
          if (!sec) return [];
          var buyBtn = sec.querySelector('button.btn-trade[onclick*="openBuyConfirmModal"]');
          return buyBtn ? [buyBtn] : [sec];
        },
        onEnter: function () {
          interaction.buyPreviewDone = false;
        },
        actionRequired: true,
        autoAdvance: false,
      },
      {
        objective: '매도',
        mood: 'info',
        coach:
          '파란 매도 버튼은 매수와 비슷한 흐름이야. 보유한 뒤 팔고 싶을 때 가격·수량을 정하고 매도를 누르면 돼.',
        targets: function () {
          var sec = document.getElementById('trading-section');
          return sec ? [sec] : [];
        },
        autoAdvance: false,
      },
      {
        objective: '5단계 완료',
        mood: 'success',
        coach:
          '잘했어! 이제 스스로 모의투자에서 차트·시세를 보며 실전 연습을 해봐. 루미가 옆에 있을게!',
        targets: function () {
          return [];
        },
        autoAdvance: true,
      },
    ];
  }

  function injectTutorialDom() {
    if (document.getElementById('simStep5Overlay')) return;
    var html =
      '<motion.div class="market-step5-overlay sim-step5-overlay" id="simStep5Overlay" aria-hidden="true"></motion.div>' +
      '<motion.div class="sim-step5-quest-hud" id="simStep5QuestHud" aria-hidden="true">' +
      '  <motion.div class="sim-step5-panel">' +
      '    <motion.div class="sim-step5-head">' +
      '      <span class="sim-step5-tag">5단계</span>' +
      '      <strong class="sim-step5-title">나의 첫 투자</strong>' +
      '    </motion.div>' +
      '    <p class="sim-step5-now" id="simStep5Now">시작</p>' +
      '  </motion.div>' +
      '</motion.div>' +
      '<motion.div class="sim-step5-confetti" id="simStep5Confetti" aria-hidden="true"></motion.div>';
    html = html.replace(/<\/?motion\.div/gi, function (tag) {
      return tag.replace(/motion\./gi, '');
    });
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function init() {
    var params = new URLSearchParams(window.location.search);
    var tutorial = (params.get('tutorial') || '').toLowerCase().trim();
    if (tutorial !== 'step5' && tutorial !== '5') return;

    injectTutorialDom();
    var overlay = document.getElementById('simStep5Overlay');
    var questHud = document.getElementById('simStep5QuestHud');
    var nowEl = document.getElementById('simStep5Now');
    var confetti = document.getElementById('simStep5Confetti');
    if (!overlay || !questHud || !nowEl) return;

    var STEPS = buildSteps();
    var current = 0;
    var started = false;
    var activeTargets = [];
    var completed = false;
    var waitingForLogin = false;

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

    function isTradeGuideStep(idx) {
      return idx >= STEP_TRADE_LIMIT && idx <= STEP_TRADE_SELL;
    }

    function isBuyPreviewStep(idx) {
      return idx === STEP_BUY_BTN;
    }

    function isTermModeStep(idx) {
      return idx >= STEP_QUOTE_VOL && idx <= STEP_QUOTE_HL;
    }

    function isOverviewStep(idx) {
      return idx === STEP_CHART || idx === STEP_QUOTE_INTRO;
    }

    function isDetailSpotlightStep(idx) {
      return idx >= STEP_CHART && idx <= STEP_ORDERBOOK;
    }

    function isHoldingSheetStep(idx) {
      return idx >= STEP_CHART && idx <= STEP_QUOTE_HL;
    }

    function usesSpotlightDim(idx) {
      return idx >= STEP_PICK && idx <= STEP_TRADE_SELL;
    }

    function syncSpotlightDim() {
      var on = started && !completed && usesSpotlightDim(current);
      overlay.classList.toggle('is-dim', on);
      document.body.classList.toggle('sim-step5-spotlight', on);
      document.body.classList.toggle('tutorial-fx-spotlight', on);
    }

    function isBlockedTradeClick(target) {
      if (!started || completed || !target || !target.closest) return false;
      if (isBuyPreviewStep(current)) {
        if (target.closest('#trading-section button.btn-trade[onclick*="openBuyConfirmModal"]')) {
          return false;
        }
        if (target.closest('#buyModal')) {
          if (target.closest('button[onclick*="confirmBuyFromModal"]')) return true;
          return false;
        }
      }
      if (target.closest('#trading-section .btn-trade')) return true;
      if (target.closest('#buyModal .btn-trade')) return true;
      if (target.closest('#sellModal .btn-trade')) return true;
      if (target.closest('button[onclick*="confirmBuyFromModal"]')) return true;
      if (target.closest('button[onclick*="confirmSellFromModal"]')) return true;
      return false;
    }

    function updateBodyClasses() {
      var active = started && !completed;
      document.body.classList.toggle('simulation-step5-active', active);
      document.body.classList.toggle('tutorial-fx-active', active);
      document.body.classList.toggle('sim-step5-detail-spotlight', active && isDetailSpotlightStep(current));
      document.body.classList.toggle('sim-step5-term-mode', active && isTermModeStep(current));
      document.body.classList.toggle('sim-step5-overview', active && isOverviewStep(current));
      syncSpotlightDim();
    }

    function needsCalloutRefresh(idx) {
      if (isDetailSpotlightStep(idx)) return true;
      if (idx === STEP_DEPOSIT || isTradeGuideStep(idx) || idx === STEP_ORDERBOOK) return true;
      return false;
    }

    function scheduleCalloutRefresh() {
      if (!needsCalloutRefresh(current)) return;
      var delays = isTermModeStep(current) || current === STEP_QUOTE_INTRO ? [420, 600] : [420];
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

    function updateHud() {
      var step = STEPS[current];
      if (step && nowEl) nowEl.textContent = step.objective || '';
    }

    function isActionStep(idx) {
      return idx === STEP_PICK;
    }

    function showCoach(step, onDone, opts) {
      opts = opts || {};
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        if (onDone) onDone();
        return;
      }
      var label = opts.confirmLabel;
      if (!label) label = step.actionRequired ? '알겠어' : '확인';
      window.MascotCoach.show({
        mood: opts.mood || step.mood || 'info',
        title: '루미',
        text: opts.text != null ? opts.text : step.coach || '',
        confirmLabel: label,
        onConfirm: function () {
          if (onDone) onDone();
        },
      });
    }

    function handleCoachConfirm(step) {
      if (current === STEP_PICK) {
        if (!interaction.pickDone) {
          showCoach(step, function () {
            handleCoachConfirm(step);
          }, {
            mood: 'wink',
            text:
              '아직 종목을 고르지 않았어! 왼쪽 거래대금 순위에서 관심 있는 종목 행을 다시 한 번 눌러 줘.',
          });
        }
        return;
      }
      if (current === STEP_BUY_BTN) {
        if (!interaction.buyPreviewDone) {
          showCoach(step, function () {
            handleCoachConfirm(step);
          }, {
            mood: 'info',
            text: '빨간 매수 버튼을 눌러 확인 창을 한번 열어 봐! 내용만 보고 닫아도 돼.',
          });
        } else {
          if (typeof closeBuyModal === 'function') closeBuyModal();
          proceed();
        }
        return;
      }
      if (current === STEP_ORDERBOOK) {
        proceed();
        return;
      }
      if (!step.actionRequired && !step.waitAfterCoach) {
        proceed();
      }
    }

    function render(idx) {
      current = idx;
      updateHud();
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

      if (step.autoAdvance) {
        showCoach(step, function () {
          proceed();
        });
        return;
      }

      showCoach(step, function () {
        handleCoachConfirm(step);
      });
    }

    function proceed() {
      if (current >= STEP_FINAL) {
        finishTutorial();
        return;
      }
      render(current + 1);
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

    function finishTutorial() {
      completed = true;
      started = false;
      clearTargets();
      overlay.classList.remove('is-open', 'is-dim');
      questHud.classList.remove('is-open');
      document.body.classList.remove(
        'simulation-step5-active',
        'tutorial-fx-active',
        'tutorial-fx-spotlight',
        'sim-step5-detail-spotlight',
        'sim-step5-term-mode',
        'sim-step5-overview',
        'sim-step5-spotlight'
      );
      showConfettiBrief();
      persistStep5Complete();
      stripTutorialParamFromUrl();
      window.__jurinGuideQuit = null;
      if (window.JurinTutorialGuard) window.JurinTutorialGuard.clear();
      if (window.JurinGuideLumi && typeof window.JurinGuideLumi.end === 'function') {
        window.JurinGuideLumi.end();
      }
      if (window.LumiChat && typeof window.LumiChat.init === 'function') {
        if (!document.getElementById('lumiChatRoot')) {
          window.LumiChat.init();
        }
      }
    }

    function closeTutorial() {
      finishTutorial();
    }

    window.__simStep5BuyPreviewCheck = function (modal) {
      if (!started || completed || current !== STEP_BUY_BTN) return;
      var m = modal || document.getElementById('buyModal');
      if (!m) return;
      if (m.classList.contains('is-open') || m.getAttribute('aria-hidden') === 'false') {
        interaction.buyPreviewDone = true;
      }
    };
    attachBuyModalPreviewWatcher();

    function openTutorial() {
      waitingForLogin = false;
      started = true;
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      questHud.classList.add('is-open');
      questHud.setAttribute('aria-hidden', 'false');
      updateBodyClasses();
      window.__jurinGuideQuit = function () {
        closeTutorial();
      };
      syncGuard();
      render(STEP_INTRO);
    }

    function syncGuard() {
      if (!window.JurinTutorialGuard) return;
      window.JurinTutorialGuard.set({
        isActive: function () {
          return started && !completed && overlay.classList.contains('is-open');
        },
        allowsClick: function (target) {
          var G = window.JurinTutorialGuard;
          if (G.allowsMascotAndQuest(target, 'simStep5QuestHud', '.sim-step5-panel')) return true;
          if (isBlockedTradeClick(target)) return false;
          if (G.allowsSpotlightTargets(target)) return true;
          if (current === STEP_PICK && target.closest && target.closest('tr.discovery-row')) return true;
          if (isHoldingSheetStep(current) && target.closest && target.closest('#simHoldingDetailSheet')) return true;
          if (current === STEP_ORDERBOOK && target.closest && target.closest('#orderbookOverlay')) return true;
          if (current === STEP_DEPOSIT && target.closest && target.closest('.portfolio-section')) return true;
          if (isBuyPreviewStep(current)) {
            if (target.closest && target.closest('#trading-section')) return true;
            if (target.closest && target.closest('#buyModal')) return true;
          }
          if (isTradeGuideStep(current) && target.closest && target.closest('#trading-section')) {
            if (isBuyPreviewStep(current)) return true;
            if (target.closest('.btn-trade')) return false;
            return true;
          }
          return !isActionStep(current);
        },
        getWrongMessage: function (target) {
          if (isBlockedTradeClick(target)) {
            if (isBuyPreviewStep(current) && target.closest('button[onclick*="confirmBuyFromModal"]')) {
              return '지금은 주문까지 하지 않아도 돼! 확인 창만 보고 닫은 뒤, 코치 확인을 눌러 줘.';
            }
            return '지금은 설명만 볼 거야! 확인을 눌러 다음으로 가자.';
          }
          if (!isActionStep(current)) return null;
          if (current === STEP_PICK) {
            return '앗, 그건 아니야! 왼쪽 목록에서 종목 행을 눌러 줘.';
          }
          return '지금은 안내한 곳만 눌러 줘!';
        },
        onAfterWrong: function () {
          var step = STEPS[current];
          if (step) showCoach(step);
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
          '5단계: 나의 첫 투자야! 모의투자 화면에서 차트·시세·호가를 보고, 매수하는 방법을 알아볼 거야. 확인 누르면 시작!',
        confirmLabel: '시작',
        onConfirm: function () {
          openTutorial();
        },
      });
    }

    function checkAuthThenStart() {
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
