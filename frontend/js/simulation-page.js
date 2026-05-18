/**
 * 파일: simulation.html 모의 투자 UI·주문·포트폴리오 API 연동
 * 설명( api-base.js → common-auth.js 다음 로드. simApiBase 는 jurinApiBase 와 동일 호스트. )
 */

  /** 백엔드 API 오리진 (api-base 와 동일 규칙) */
  function simApiBase() {
    return typeof jurinApiBase === 'function'
      ? jurinApiBase()
      : (window.JURIN_API_BASE || 'http://127.0.0.1:5000');
  }

  /** 백엔드 모의 체결과 동일: 수수료 약 0.015%. 증권거래세는 현물 매도에만(약 0.18%) — 매수에는 부과하지 않음. */
  var MOCK_TRADE_COMMISSION_RATE = 0.00015;
  var MOCK_SECURITIES_TAX_RATE_SELL = 0.0018;

  function estimateMockTradeCosts(side, grossWon) {
    var g = Math.max(0, Math.floor(Number(grossWon) || 0));
    if (g <= 0) {
      return { gross: 0, fee: 0, tax: 0, netBuy: 0, netSell: 0 };
    }
    var fee = Math.round(g * MOCK_TRADE_COMMISSION_RATE);
    if (fee < 1) fee = 1;
    var tax = 0;
    if (String(side || '').toUpperCase() === 'SELL') {
      tax = Math.round(g * MOCK_SECURITIES_TAX_RATE_SELL);
    }
    return {
      gross: g,
      fee: fee,
      tax: tax,
      netBuy: g + fee,
      netSell: g - fee - tax,
    };
  }

  function renderMockCostBreakdown(el, side, gross) {
    if (!el) return;
    var s = String(side || '').toUpperCase();
    var g = Math.max(0, Math.floor(Number(gross) || 0));
    if (g <= 0) {
      el.innerHTML = '';
      el.style.display = 'none';
      return;
    }
    var c = estimateMockTradeCosts(s, g);
    var parts = [];
    parts.push('<div class="mock-cost-row"><span>거래금액</span><span>' + formatCurrency(c.gross) + '</span></div>');
    parts.push(
      '<div class="mock-cost-row"><span>매매수수료(약 0.015%)</span><span>' + formatCurrency(c.fee) + '</span></div>'
    );
    if (s === 'SELL') {
      parts.push(
        '<div class="mock-cost-row"><span>증권거래세(약 0.18%)</span><span>' + formatCurrency(c.tax) + '</span></div>'
      );
      parts.push(
        '<div class="mock-cost-row mock-cost-row--emph"><span>예상 입금액</span><span>' +
          formatCurrency(c.netSell) +
          '</span></div>'
      );
    } else {
      parts.push(
        '<div class="mock-cost-row mock-cost-row--emph"><span>예상 결제액</span><span>' +
          formatCurrency(c.netBuy) +
          '</span></div>'
      );
    }
    el.innerHTML = parts.join('');
    el.style.display = '';
  }

  function localizeSimulationUi() {
    function setText(sel, txt) {
      var el = document.querySelector(sel);
      if (el) el.textContent = txt;
    }
    function setAttr(sel, key, val) {
      var el = document.querySelector(sel);
      if (el) el.setAttribute(key, val);
    }

    document.title = '모의 투자 - 주린닷컴';
    setText('nav .nav-logo .logo-icon', '주');
    var logoText = document.querySelector('nav .nav-logo .logo-text');
    if (logoText) logoText.innerHTML = '주린<span>닷컴</span>';

    setText('nav .nav-menu a[href="guide.html"]', '가이드');
    setText('nav .nav-menu a[href="analysis.html"]', 'AI 분석');
    setText('nav .nav-menu a[href="ai-chart-prediction.html"]', 'AI 차트 예측 ');
    var aiBadge = document.querySelector('nav .nav-menu a[href="ai-chart-prediction.html"] .nav-badge');
    if (aiBadge) aiBadge.textContent = 'AI';
    setText('nav .nav-menu a[href="glossary.html"]', '용어 검색');
    setText('nav .nav-menu a[href="simulation.html"]', '모의 투자 ');
    var newBadge = document.querySelector('nav .nav-menu a[href="simulation.html"] .nav-badge');
    if (newBadge) newBadge.textContent = 'NEW';
    setText('nav .nav-menu a[href="market.html"]', '시장');
    setText('#navLoginBtn', '로그인');
    var startBtn = document.querySelector('nav .btn-primary');
    if (startBtn) startBtn.textContent = '무료 시작하기';

    setText('.simulation-header .btn-back', '← 돌아가기');
    setText('.simulation-title', '모의 투자');
    setText('.simulation-sub', '실전처럼 매매를 연습해보세요');

    setText('.market-sidebar-title > span', '시장 종목');
    setAttr('#marketRankSearchInput', 'placeholder', '종목 검색');
    var mRef = document.querySelector('.market-sidebar-title .btn-trade');
    if (mRef) mRef.textContent = '새로고침';
    var obRef = document.getElementById('orderbookRefreshBtn');
    if (obRef) obRef.textContent = '새로고침';
    var obBack = document.getElementById('orderbookCloseBtn');
    if (obBack) obBack.textContent = '시장 목록';
    setText('.orderbook-pane-title', '호가');

    var th = document.querySelectorAll('.discovery-table thead th');
    if (th.length >= 7) {
      th[1].textContent = '종목';
      th[2].textContent = '현재가';
      th[3].textContent = '시가';
      th[4].textContent = '등락';
      th[5].textContent = '거래량';
      th[6].textContent = '거래대금';
    }

    setText('.portfolio-title', '내 자산 현황');
    var balRoot = document.querySelector('.portfolio-balance');
    if (balRoot) {
      var bls = balRoot.querySelectorAll('.balance-label');
      if (bls[0]) bls[0].textContent = '총 자산';
      if (bls[1]) bls[1].textContent = '예수금';
      if (bls[2]) bls[2].textContent = '손익';
    }
    var stat = document.querySelectorAll('.portfolio-stats .stat-label');
    if (stat.length >= 4) {
      stat[0].textContent = '총 수익률';
      stat[1].textContent = '총 수익금';
      stat[2].textContent = '보유 종목';
      stat[3].textContent = '실현 손익';
    }
    var hh = document.querySelectorAll('#holdingsTable thead th');
    if (hh.length >= 6) {
      hh[0].textContent = '종목명';
      hh[1].textContent = '보유수량';
      hh[2].textContent = '평균단가';
      hh[3].textContent = '현재가';
      hh[4].textContent = '평가손익';
      hh[5].textContent = '수익률';
    }

    setText('.trading-title', '구매 / 판매');
    setText('label[for="tradeStock"]', '구매 종목');
    setAttr('#tradeStock', 'placeholder', '종목명 또는 코드');
    setText('label[for="tradeQuantity"]', '구매 수량');
    setAttr('#tradeQuantity', 'placeholder', '수량');
    setText('label[for="tradeLimitPrice"]', '구매 가격');
    setAttr('#tradeLimitPrice', 'placeholder', '');
    setAttr('#tradeLimitPricePlus', 'aria-label', '구매가 1틱 올리기');
    setAttr('#tradeLimitPriceMinus', 'aria-label', '구매가 1틱 내리기');
    var buyBtn = document.querySelector('.trading-form .btn-trade');
    if (buyBtn) buyBtn.textContent = '매수';

    setText('label[for="tradeSellStock"]', '판매 종목');
    setText('label[for="tradeSellQuantity"]', '판매 수량');
    setAttr('#tradeSellQuantity', 'placeholder', '수량');
    setText('label[for="tradeSellLimitPrice"]', '판매 가격');
    setAttr('#tradeSellLimitPrice', 'placeholder', '');
    setAttr('#tradeSellLimitPricePlus', 'aria-label', '판매가 1틱 올리기');
    setAttr('#tradeSellLimitPriceMinus', 'aria-label', '판매가 1틱 내리기');
    var sellBtn = document.getElementById('tradeSellBtn');
    if (sellBtn) sellBtn.textContent = '매도';

    setText('.order-status-title', '주문/체결 현황');
    setText('#orderStatusSummary', '아직 주문 상태가 없습니다.');
    setText('.history-title', '거래 내역');
    setText('.history-date-label', '날짜');
    setText('#historyClearDisplay', '초기화');
    setText('#historyRestoreDisplay', '복원');
    setText('[data-history-tab="all"]', '전체');
    setText('[data-history-tab="buy"]', '구매');
    setText('[data-history-tab="sell"]', '판매');
    setText('[data-history-tab="pending"]', '대기');

    setText('#sellModalHeading', '보유 종목 주문');
    setText('#holdingModalTabSell', '매도');
    setText('#holdingModalTabBuy', '매수');
    setText('label[for="sellModalQty"]', '수량');
    setText('label[for="sellModalLimitPrice"]', '판매 가격');
    setAttr('#sellModalLimitPrice', 'placeholder', '');
    setAttr('#sellModalLimitPricePlus', 'aria-label', '판매가 1틱 올리기');
    setAttr('#sellModalLimitPriceMinus', 'aria-label', '판매가 1틱 내리기');
    setText('#sellModalRefPriceLabel', '참고 시세');
    setText('#sellModalEstLabel', '예상 체결금');
    setText('label[for="holdingBuyQty"]', '수량');
    setText('label[for="holdingBuyLimitPrice"]', '구매 가격');
    setAttr('#holdingBuyLimitPrice', 'placeholder', '');
    setAttr('#holdingBuyLimitPricePlus', 'aria-label', '구매가 1틱 올리기');
    setAttr('#holdingBuyLimitPriceMinus', 'aria-label', '구매가 1틱 내리기');
    setText('#holdingBuyRefPriceLabel', '참고 시세');
    setText('#holdingBuyEstLabel', '예상 구매금액');
    var sellExec = document.querySelector('.holding-modal-cta-sell');
    if (sellExec) sellExec.textContent = '매도';
    var holdingBuyExec = document.querySelector('.holding-modal-cta-buy');
    if (holdingBuyExec) holdingBuyExec.textContent = '매수';

    setText('#buyModalHeading', '매수');
    setText('#buyModal .sell-modal-row:nth-of-type(1) span:first-child', '종목');
    setText('#buyModal .sell-modal-row:nth-of-type(2) span:first-child', '수량');
    setText('#buyModal .sell-modal-row:nth-of-type(3) span:first-child', '예상가');
    setText('#buyModal .trade-confirm-note', '위 내용으로 매수를 진행합니다.');
    var buyExec = document.querySelector('#buyModal .btn-trade');
    if (buyExec) buyExec.textContent = '매수';
    setText('#quickSellConfirmHeading', '매도');
    var quickSellExec = document.querySelector('#quickSellConfirmModal .btn-trade.sell');
    if (quickSellExec) quickSellExec.textContent = '매도';

    setText('#simHoldingTabChart', '차트');
    setText('#simHoldingTabInfo', '종목정보');
    setText('#simHoldingTabHistory', '거래내역');
    setText('#simHoldingTabOrder', '시세');
    setText('#simHoldingTabOptions', 'AI 의견');
    setText('#simHoldingOptionsAiTitle', '종목 AI 의견');
    var oSk = document.getElementById('simHoldingOptionsAiSkeleton');
    if (oSk) oSk.textContent = '종목 의견 불러오는 중…';
    setText(
      '#simHoldingOptionsAiDisclaimer',
      'AI가 생성한 종목 참고용 요약이며, 투자 조언이나 매매 권유가 아닙니다.'
    );
    setText('#simHoldingStockHistoryTitle', '거래내역');
    var qSk = document.getElementById('simHoldingQuoteSkeleton');
    if (qSk) qSk.textContent = '시세 불러오는 중…';
    setText('#simHoldingQuoteLblHigh', '고가');
    setText('#simHoldingQuoteLblLow', '저가');
    setText('#simHoldingQuoteExecLabel', '체결강도');
    setText('#simHoldingQuoteLblVolume', '거래량');
    setText('#simHoldingQuoteLblTradedVal', '거래대금');
    setText('.sim-holding-metric-btn[data-sim-metric="per"]', 'PER');
    setText('.sim-holding-metric-btn[data-sim-metric="pbr"]', 'PBR');
    setText('.sim-holding-metric-btn[data-sim-metric="psr"]', 'PSR');
    setText('.sim-holding-metric-btn[data-sim-metric="net"]', '순이익');
    setText('.sim-holding-metric-btn[data-sim-metric="revenue"]', '매출');
    setText('.sim-holding-range-btn[data-range="1d"]', '1일');
    setText('.sim-holding-range-btn[data-range="1w"]', '1주');
    setText('.sim-holding-range-btn[data-range="1m"]', '1개월');
    setText('.sim-holding-range-btn[data-range="1y"]', '1년');
    var skel = document.getElementById('simHoldingChartSkeleton');
    if (skel) skel.textContent = '차트 불러오는 중…';
    setAttr('#simHoldingDetailClose', 'aria-label', '종목 상세 닫기');
  }

  window.lastDiscoveryQuotePrice = 0;

  /** KRX 현물 호가 단위(구간별) — ± 조절에 사용 */
  function krxTickSize(p) {
    var x = Number(p);
    if (!Number.isFinite(x) || x <= 0) x = 10000;
    if (x < 2000) return 1;
    if (x < 5000) return 5;
    if (x < 20000) return 10;
    if (x < 50000) return 50;
    if (x < 200000) return 100;
    if (x < 500000) return 500;
    return 1000;
  }

  function referencePriceForTick() {
    var inp = document.getElementById('tradeLimitPrice');
    var v = inp && inp.value !== '' ? parseInt(inp.value, 10) : NaN;
    if (!Number.isNaN(v) && v > 0) return v;
    if (typeof window.lastDiscoveryQuotePrice === 'number' && window.lastDiscoveryQuotePrice > 0) {
      return window.lastDiscoveryQuotePrice;
    }
    return 50000;
  }

  function updateTradeTickHint() {}

  function isBuyMarketMode() {
    var b = document.getElementById('tradeBuyPriceTypeMarket');
    return !!(b && b.classList.contains('active'));
  }

  function buyReferencePrice() {
    var h = document.getElementById('tradeStockCode');
    var code = h && h.value ? String(h.value).trim() : '';
    if (/^\d{6}$/.test(code)) {
      var byCode = Number(marketPriceByCode[code]);
      if (byCode > 0) return byCode;
    }
    if (typeof window.lastDiscoveryQuotePrice === 'number' && window.lastDiscoveryQuotePrice > 0) {
      return window.lastDiscoveryQuotePrice;
    }
    return 0;
  }

  async function tryRefreshBuyDisplayPriceAsync() {
    if (!isBuyMarketMode()) return;
    var h = document.getElementById('tradeStockCode');
    var code = h && h.value ? String(h.value).trim() : '';
    if (!isSixDigitCode(code)) return;
    try {
      var d = await fetchAskingPriceWithGuard(code, { force: false });
      if (d && d.success) {
        var ep = Number(d.expected_exec_price || 0);
        if (ep > 0) {
          rememberMarketQuote(code, '', ep);
          var inp = document.getElementById('tradeLimitPrice');
          if (inp && isBuyMarketMode()) inp.value = String(Math.round(ep));
        }
      }
    } catch (e) { /* ignore */ }
  }

  function setBuyPriceType(market) {
    var mBtn = document.getElementById('tradeBuyPriceTypeMarket');
    var lBtn = document.getElementById('tradeBuyPriceTypeLimit');
    var inp = document.getElementById('tradeLimitPrice');
    var plus = document.getElementById('tradeLimitPricePlus');
    var minus = document.getElementById('tradeLimitPriceMinus');
    var cell = document.getElementById('tradeLimitPriceCell');
    if (mBtn && lBtn) {
      mBtn.classList.toggle('active', market);
      lBtn.classList.toggle('active', !market);
      mBtn.setAttribute('aria-pressed', market ? 'true' : 'false');
      lBtn.setAttribute('aria-pressed', market ? 'false' : 'true');
    }
    if (inp) {
      inp.disabled = !!market;
      if (plus) plus.disabled = !!market;
      if (minus) minus.disabled = !!market;
      if (cell) cell.classList.toggle('is-market-mode', !!market);
      if (market) {
        var rpM = buyReferencePrice();
        if (rpM > 0) {
          inp.value = String(Math.round(rpM));
        } else {
          inp.value = '';
          void tryRefreshBuyDisplayPriceAsync();
        }
      } else {
        var cur = inp.value !== '' ? parseInt(inp.value, 10) : NaN;
        if (Number.isNaN(cur) || cur <= 0) {
          var rp = buyReferencePrice();
          if (rp > 0) inp.value = String(Math.round(rp));
        }
      }
    }
    updateTradeTickHint();
  }

  function isSellMarketMode() {
    var b = document.getElementById('tradeSellPriceTypeMarket');
    return !!(b && b.classList.contains('active'));
  }

  function sellReferencePrice() {
    var sel = document.getElementById('tradeSellStock');
    var key = sel && sel.value ? String(sel.value) : '';
    if (!key || !portfolio.holdings[key]) return 0;
    var h = portfolio.holdings[key];
    var cp = Number(h.currentPrice || 0);
    if (cp > 0) return cp;
    var code = h.code && String(h.code).trim();
    if (code && marketPriceByCode[code]) return Number(marketPriceByCode[code]);
    return 0;
  }

  async function tryRefreshSellDisplayPriceAsync() {
    if (!isSellMarketMode()) return;
    var sel = document.getElementById('tradeSellStock');
    var key = sel && sel.value ? String(sel.value) : '';
    if (!key || !portfolio.holdings[key]) return;
    var code = portfolio.holdings[key].code && String(portfolio.holdings[key].code).trim();
    if (!isSixDigitCode(code)) return;
    try {
      var d = await fetchAskingPriceWithGuard(code, { force: false });
      if (d && d.success) {
        var ep = Number(d.expected_exec_price || 0);
        if (ep > 0) {
          rememberMarketQuote(code, '', ep);
          var inp = document.getElementById('tradeSellLimitPrice');
          if (inp && isSellMarketMode()) inp.value = String(Math.round(ep));
        }
      }
    } catch (e) { /* ignore */ }
  }

  function setSellPriceType(market) {
    var mBtn = document.getElementById('tradeSellPriceTypeMarket');
    var lBtn = document.getElementById('tradeSellPriceTypeLimit');
    var inp = document.getElementById('tradeSellLimitPrice');
    var plus = document.getElementById('tradeSellLimitPricePlus');
    var minus = document.getElementById('tradeSellLimitPriceMinus');
    var cell = document.getElementById('tradeSellLimitPriceCell');
    if (mBtn && lBtn) {
      mBtn.classList.toggle('active', market);
      lBtn.classList.toggle('active', !market);
      mBtn.setAttribute('aria-pressed', market ? 'true' : 'false');
      lBtn.setAttribute('aria-pressed', market ? 'false' : 'true');
    }
    if (inp) {
      inp.disabled = !!market;
      if (plus) plus.disabled = !!market;
      if (minus) minus.disabled = !!market;
      if (cell) cell.classList.toggle('is-market-mode', !!market);
      if (market) {
        var rpM = sellReferencePrice();
        if (rpM > 0) {
          inp.value = String(Math.round(rpM));
        } else {
          inp.value = '';
          void tryRefreshSellDisplayPriceAsync();
        }
      } else {
        var cur = inp.value !== '' ? parseInt(inp.value, 10) : NaN;
        if (Number.isNaN(cur) || cur <= 0) {
          var rp = sellReferencePrice();
          if (rp > 0) inp.value = String(Math.round(rp));
        }
      }
    }
  }

  function bumpTradeLimitPrice(direction) {
    if (isBuyMarketMode()) return;
    var inp = document.getElementById('tradeLimitPrice');
    if (!inp) return;
    var cur = inp.value !== '' ? parseInt(inp.value, 10) : NaN;
    var ref = referencePriceForTick();
    var tick = krxTickSize(!Number.isNaN(cur) && cur > 0 ? cur : ref);
    var next;
    if (!Number.isNaN(cur) && cur > 0) {
      next = cur + direction * tick;
      if (next < tick) next = tick;
    } else {
      var rounded = Math.floor(ref / tick) * tick;
      if (direction > 0) {
        next = rounded <= 0 ? tick : rounded + tick;
      } else {
        next = Math.max(tick, rounded - tick);
      }
    }
    inp.value = String(next);
    updateTradeTickHint();
  }

  function openOrderbookOverlay() {
    var el = document.getElementById('orderbookOverlay');
    if (el) {
      el.classList.add('is-open');
      el.setAttribute('aria-hidden', 'false');
    }
  }

  function closeOrderbookOverlay() {
    var el = document.getElementById('orderbookOverlay');
    if (el) {
      el.classList.remove('is-open');
      el.setAttribute('aria-hidden', 'true');
    }
  }

  let selectedOrderbookCode = '';
  /** 호가 행 클릭 시 종목·가격 보관 — 판매 모달을 나중에 열어도 지정가 반영 */
  let lastOrderbookPick = { code: '', price: 0, atMs: 0 };
  const ORDERBOOK_PICK_TTL_MS = 3 * 60 * 1000;
  let orderbookPollTimer = null;
  let pendingOrders = [];
  let pendingOrderSeq = 1;
  let pendingOrderProcessing = false;
  let orderStatusEvents = [];
  const LS_MOCK_PENDING = 'jurinMockPendingOrdersV1';
  const LS_MOCK_EVENTS = 'jurinMockOrderStatusEventsV1';
  const LS_MOCK_PENDING_SEQ = 'jurinMockPendingOrderSeqV1';
  let mockOrderBoardHydratedFromLs = false;

  function saveOrderBoardState() {
    try {
      localStorage.setItem(LS_MOCK_PENDING, JSON.stringify(pendingOrders));
      localStorage.setItem(LS_MOCK_EVENTS, JSON.stringify(orderStatusEvents));
      localStorage.setItem(LS_MOCK_PENDING_SEQ, String(pendingOrderSeq));
    } catch (e) { /* ignore */ }
  }

  function restoreOrderBoardState() {
    try {
      var rawP = localStorage.getItem(LS_MOCK_PENDING);
      if (rawP) {
        var arr = JSON.parse(rawP);
        if (Array.isArray(arr)) pendingOrders = arr;
      }
      var rawE = localStorage.getItem(LS_MOCK_EVENTS);
      if (rawE) {
        var evs = JSON.parse(rawE);
        if (Array.isArray(evs)) {
          var baseMs = Date.now();
          orderStatusEvents = evs.map(function (e, i) {
            if (!e || typeof e !== 'object') return e;
            if (typeof e.atMs !== 'number' || !Number.isFinite(e.atMs)) {
              e.atMs = baseMs - i * 60000;
            }
            return e;
          });
        }
      }
      var rawS = localStorage.getItem(LS_MOCK_PENDING_SEQ);
      if (rawS) {
        var n = parseInt(rawS, 10);
        if (!Number.isNaN(n) && n > 0) pendingOrderSeq = n;
      }
      pendingOrders.forEach(function (o) {
        if (o && typeof o.id === 'number' && o.id >= pendingOrderSeq) pendingOrderSeq = o.id + 1;
      });
    } catch (e) { /* ignore */ }
  }

  /** 미로그인·로그아웃 시: 로컬 주문/체결 UI는 다른 사용자·이전 세션과 섞이지 않도록 제거 */
  function clearMockOrderBoardLocal() {
    mockOrderBoardHydratedFromLs = false;
    pendingOrders = [];
    orderStatusEvents = [];
    pendingOrderSeq = 1;
    try {
      localStorage.removeItem(LS_MOCK_PENDING);
      localStorage.removeItem(LS_MOCK_EVENTS);
      localStorage.removeItem(LS_MOCK_PENDING_SEQ);
    } catch (e) { /* ignore */ }
    renderOrderStatusBoard();
  }

  let marketPriceByCode = Object.create(null);
  let marketPriceByName = Object.create(null);
  let askingPriceCacheByCode = Object.create(null);
  let askingPriceInflightByCode = Object.create(null);
  let askingPriceCooldownUntilMs = 0;
  const ASKING_PRICE_CACHE_MS = 3000;
  const ASKING_PRICE_COOLDOWN_MS = 18000;

  function isSixDigitCode(v) {
    return /^\d{6}$/.test(String(v || '').trim());
  }

  function nowStamp() {
    return new Date().toLocaleTimeString('ko-KR', { hour12: false });
  }

  function pushOrderStatusEvent(evt) {
    if (!evt) return;
    var tsMs = typeof evt.atMs === 'number' && Number.isFinite(evt.atMs) ? evt.atMs : Date.now();
    orderStatusEvents.unshift({
      at: evt.at || nowStamp(),
      atMs: tsMs,
      stock: String(evt.stock || '-'),
      side: evt.side === 'SELL' ? 'SELL' : 'BUY',
      mode: evt.mode || 'manual',
      status: evt.status || 'executed',
      desiredPrice: Number(evt.desiredPrice || 0),
      executedPrice: Number(evt.executedPrice || 0),
      quantity: Number(evt.quantity || 0),
      note: String(evt.note || ''),
    });
    if (orderStatusEvents.length > 40) orderStatusEvents = orderStatusEvents.slice(0, 40);
    renderOrderStatusBoard();
  }

  function formatOrderStatusDateLine(ms) {
    var n = Number(ms);
    if (!Number.isFinite(n) || n <= 0) return '—';
    var d = new Date(n);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  }

  function renderOrderStatusBoard() {
    var listEl = document.getElementById('orderStatusList');
    var sumEl = document.getElementById('orderStatusSummary');
    if (!listEl || !sumEl) {
      saveOrderBoardState();
      return;
    }

    var waitCnt = pendingOrders.length;
    var doneCnt = orderStatusEvents.filter(function (e) { return e.status === 'executed'; }).length;
    var failCnt = orderStatusEvents.filter(function (e) { return e.status === 'failed'; }).length;
    var last = orderStatusEvents.length > 0 ? orderStatusEvents[0] : null;
    var lastTxt = '';
    if (last) {
      lastTxt =
        '<span class="order-status-sum-meta"> · 마지막: ' +
        (last.status === 'executed' ? '체결완료' : '체결실패') +
        '</span>';
    }
    sumEl.innerHTML =
      '<span class="order-status-sum order-status-sum--done">체결완료 ' +
      doneCnt +
      '건</span><span class="order-status-sum-sep"> · </span>' +
      '<span class="order-status-sum order-status-sum--wait">대기 ' +
      waitCnt +
      '건</span><span class="order-status-sum-sep"> · </span>' +
      '<span class="order-status-sum order-status-sum--failcount">미체결 ' +
      failCnt +
      '건</span>' +
      lastTxt;

    if (orderStatusEvents.length === 0 && waitCnt === 0) {
      listEl.innerHTML = '';
      sumEl.innerHTML =
        '<span class="order-status-sum order-status-sum--done">체결완료 0건</span>' +
        '<span class="order-status-sum-sep"> · </span>' +
        '<span class="order-status-sum order-status-sum--wait">대기 0건</span>' +
        '<span class="order-status-sum-sep"> · </span>' +
        '<span class="order-status-sum order-status-sum--failcount">미체결 0건</span>';
      saveOrderBoardState();
      return;
    }

    var pendingRows = pendingOrders.map(function (o) {
      var side = o.side === 'SELL' ? '판매' : '구매';
      var actCls = o.side === 'SELL' ? 'sell' : 'buy';
      var qty = Number(o.quantity || 0).toLocaleString();
      var name = escapeHtml(o.stock || o.stockRef || '-');
      var dateLine = formatOrderStatusDateLine(Number(o.createdAt));
      var lp = formatCurrency(Number(o.limitPrice || 0));
      return (
        '<div class="order-status-item order-status-item--pending-open">' +
          '<div class="order-status-top">' +
            '<div class="order-status-stockblock">' +
              '<div class="order-status-name order-status-name--pending">' +
                name +
                '<span class="order-status-wait-suffix">(대기)</span>' +
              '</div>' +
              '<div class="order-status-sideqty order-status-sideqty--pending">' +
                '<span class="order-status-action order-status-action--' + actCls + '">' + side + '</span>' +
                ' <span class="order-status-qtyparen">(' + qty + '주)</span>' +
                ' · <span class="order-status-limit-label">목표 ' + lp + '</span>' +
              '</div>' +
            '</div>' +
            '<span class="order-status-badge order-status-badge--pending-open">미체결</span>' +
          '</div>' +
          '<div class="order-status-detail order-status-detail--dateonly">' +
            '<span>' + escapeHtml(dateLine) + '</span>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    var eventRows = orderStatusEvents.slice(0, 16).map(function (e) {
      var side = e.side === 'SELL' ? '판매' : '구매';
      var actCls = e.side === 'SELL' ? 'sell' : 'buy';
      var badgeCls = e.status === 'failed' ? 'fail' : 'done';
      var badgeTxt = e.status === 'failed' ? '체결실패' : '체결완료';
      var qty = Number(e.quantity || 0).toLocaleString();
      var name = escapeHtml(e.stock);
      var dateLine = formatOrderStatusDateLine(e.atMs);
      var failNote =
        e.status === 'failed' && e.note
          ? '<span class="order-status-fail-note">' + escapeHtml(e.note) + '</span>'
          : '';
      return (
        '<div class="order-status-item">' +
          '<div class="order-status-top">' +
            '<div class="order-status-stockblock">' +
              '<div class="order-status-name">' + name + '</div>' +
              '<div class="order-status-sideqty">' +
                '<span class="order-status-action order-status-action--' + actCls + '">' + side + '</span>' +
                ' <span class="order-status-qtyparen">(' + qty + '주)</span>' +
              '</div>' +
            '</div>' +
            '<span class="order-status-badge ' + badgeCls + '">' + badgeTxt + '</span>' +
          '</div>' +
          '<div class="order-status-detail order-status-detail--dateonly">' +
            '<span>' + escapeHtml(dateLine) + '</span>' +
            failNote +
          '</div>' +
        '</div>'
      );
    }).join('');

    listEl.innerHTML = pendingRows + eventRows;
    saveOrderBoardState();
    if (historyViewFilter === 'pending') {
      renderHistory();
    }
  }

  function rememberMarketQuote(code, name, price) {
    var p = Number(price);
    if (!Number.isFinite(p) || p <= 0) return;
    var codeStr = String(code || '').trim();
    var nameStr = String(name || '').trim();
    if (isSixDigitCode(codeStr)) marketPriceByCode[codeStr] = p;
    if (nameStr) marketPriceByName[nameStr] = p;
  }

  async function fetchAskingPriceWithGuard(code, options) {
    var opts = options || {};
    var force = !!opts.force;
    var codeStr = String(code || '').trim();
    if (!isSixDigitCode(codeStr)) return null;

    var now = Date.now();
    if (!force && now < askingPriceCooldownUntilMs) {
      var cool = askingPriceCacheByCode[codeStr];
      if (cool && cool.data) return cool.data;
      return null;
    }

    var cached = askingPriceCacheByCode[codeStr];
    if (!force && cached && (now - cached.atMs) < ASKING_PRICE_CACHE_MS) {
      return cached.data;
    }

    if (askingPriceInflightByCode[codeStr]) {
      try {
        return await askingPriceInflightByCode[codeStr];
      } catch (e) {
        return null;
      }
    }

    askingPriceInflightByCode[codeStr] = (async function () {
      var res = await fetch(simApiBase() + '/api/mock/asking-price/' + encodeURIComponent(codeStr));
      var data = await res.json().catch(function () { return {}; });
      if (res.status === 429) {
        askingPriceCooldownUntilMs = Date.now() + ASKING_PRICE_COOLDOWN_MS;
      }
      if (!res.ok || !data.success) {
        throw new Error(data.message || ('HTTP ' + res.status));
      }
      askingPriceCacheByCode[codeStr] = {
        atMs: Date.now(),
        data: data,
      };
      return data;
    })();

    try {
      return await askingPriceInflightByCode[codeStr];
    } catch (e) {
      return null;
    } finally {
      delete askingPriceInflightByCode[codeStr];
    }
  }

  async function getLatestMarketPrice(stockRef) {
    var ref = String(stockRef || '').trim();
    if (!ref) return 0;

    if (isSixDigitCode(ref)) {
      try {
        var data = await fetchAskingPriceWithGuard(ref);
        if (data && data.success) {
          var exp = Number(data.expected_exec_price || 0);
          if (exp > 0) {
            rememberMarketQuote(ref, '', exp);
            return exp;
          }
        }
      } catch (e) { /* ignore quote fetch failures */ }
      return Number(marketPriceByCode[ref] || 0);
    }

    return Number(marketPriceByName[ref] || 0);
  }

  function showPendingOrderFeedback(order, refPrice) {
    const el = document.getElementById('tradeFeedback');
    if (!el || !order) return;
    const sideKo = order.side === 'BUY' ? '구매' : '판매';
    const cond = order.side === 'BUY' ? '현재가가 지정가 이하' : '현재가가 지정가 이상';
    const rp = Number(refPrice || 0);
    const refText = rp > 0 ? formatCurrency(rp) : '확인 불가';
    el.style.display = 'block';
    el.innerHTML =
      '<strong>주문 대기 등록</strong>' +
      '<div class="trade-row"><span>종목</span><span>' + escapeHtml(order.stock) + '</span></div>' +
      '<div class="trade-row"><span>구분</span><span>' + sideKo + ' · ' + Number(order.quantity).toLocaleString() + '주</span></div>' +
      '<div class="trade-row"><span>지정가</span><span>' + formatCurrency(order.limitPrice) + '</span></div>' +
      '<div class="trade-row"><span>현재 기준가</span><span>' + refText + '</span></div>' +
      '<div class="trade-row"><span>자동 체결 조건</span><span>' + cond + '</span></div>';
  }

  async function executeTradeRequest(side, stock, quantity, price) {
    const res = await fetch(simApiBase() + '/api/mock/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        side: side,
        stock: stock,
        quantity: quantity,
        price: price > 0 ? price : 0,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  async function processPendingOrders() {
    if (pendingOrderProcessing || pendingOrders.length === 0) return;
    pendingOrderProcessing = true;
    try {
      var survivors = [];
      var anyExecuted = false;
      for (var i = 0; i < pendingOrders.length; i++) {
        var order = pendingOrders[i];
        var nowPx = await getLatestMarketPrice(order.stockRef);
        if (!(nowPx > 0)) {
          survivors.push(order);
          continue;
        }
        var trigger = order.side === 'BUY'
          ? nowPx <= order.limitPrice
          : nowPx >= order.limitPrice;
        if (!trigger) {
          survivors.push(order);
          continue;
        }
        try {
          var rt = await executeTradeRequest(order.side, order.stockRef, order.quantity, order.limitPrice);
          if (!rt.res.ok || !rt.data.success) {
            survivors.push(order);
            continue;
          }
          anyExecuted = true;
          var t = rt.data && rt.data.trade ? rt.data.trade : {};
          pushOrderStatusEvent({
            stock: t.name || order.stock || order.stockRef,
            side: order.side,
            mode: 'auto',
            status: 'executed',
            desiredPrice: order.limitPrice,
            executedPrice: Number(t.price || order.limitPrice || 0),
            quantity: Number(t.quantity || order.quantity || 0),
            note: '목표가 조건 도달',
          });
          showTradeFeedback(rt.data, 'auto');
        } catch (e) {
          survivors.push(order);
        }
      }
      pendingOrders = survivors;
      renderOrderStatusBoard();
      if (anyExecuted) {
        await loadPortfolioFromServer();
        updatePortfolio();
        renderHoldings();
        renderHistory();
      }
    } finally {
      pendingOrderProcessing = false;
    }
  }

  function clearOrderbookPoll() {
    if (orderbookPollTimer) {
      clearInterval(orderbookPollTimer);
      orderbookPollTimer = null;
    }
  }

  function setOrderbookRefreshEnabled(on) {
    var btn = document.getElementById('orderbookRefreshBtn');
    if (btn) btn.disabled = !on;
  }

  function refreshOrderbookPanel() {
    if (selectedOrderbookCode && /^\d{6}$/.test(selectedOrderbookCode)) {
      loadOrderbookPanel(selectedOrderbookCode);
    }
  }

  async function loadOrderbookPanel(code, options) {
    var opts = options || {};
    var paneTitle = document.querySelector('.orderbook-pane-title');
    if (paneTitle) paneTitle.textContent = '호가';
    var meta = document.getElementById('orderbookMeta');
    var wrap = document.getElementById('orderbookTableWrap');
    if (!wrap) return;
    code = String(code || '').trim();
    if (!/^\d{6}$/.test(code)) {
      selectedOrderbookCode = '';
      setOrderbookRefreshEnabled(false);
      clearOrderbookPoll();
      closeOrderbookOverlay();
      if (meta) meta.textContent = '시장 종목을 선택하면 호가 창이 목록 위에 겹쳐 표시됩니다.';
      wrap.innerHTML = '';
      return;
    }
    selectedOrderbookCode = code;
    setOrderbookRefreshEnabled(true);
    openOrderbookOverlay();
    if (meta) meta.textContent = '불러오는중...';
    var cached = askingPriceCacheByCode[code];
    if (cached && cached.data) {
      renderOrderbookTable(cached.data);
      if (meta) meta.textContent = '최근 호가를 먼저 표시했습니다. 최신값 확인 중...';
    }
    try {
      var data = await fetchAskingPriceWithGuard(code, { force: !!opts.force });
      if (!data || !data.success) {
        if (cached && cached.data) {
          if (meta) meta.textContent = '호가 서버 제한으로 최근 값 유지 중입니다.';
          return;
        }
        throw new Error('호가 서버 제한으로 잠시 후 다시 시도됩니다.');
      }
      renderOrderbookTable(data);
      if (meta) meta.textContent = '';
    } catch (err) {
      if (meta) meta.textContent = (err && err.message) ? String(err.message) : '호가를 불러오지 못했습니다.';
      if (!(cached && cached.data)) wrap.innerHTML = '';
    }
  }

  function renderOrderbookTable(data) {
    var wrap = document.getElementById('orderbookTableWrap');
    if (!wrap) return;
    var asks = Array.isArray(data.asks) ? data.asks : [];
    var bids = Array.isArray(data.bids) ? data.bids : [];
    var rows = [];
    rows.push('<table class="orderbook-table" role="grid"><thead><tr><th>구분</th><th>호가</th><th>잔량</th></tr></thead><tbody>');
    for (var i = asks.length - 1; i >= 0; i--) {
      var a = asks[i];
      var p = Number(a.price);
      var q = Number(a.quantity || 0);
      rows.push(
        '<tr class="orderbook-row ask" role="button" tabindex="0" data-price="' + p + '" data-side="sell">' +
        '<td>판매</td><td>' + formatCurrency(p) + '</td><td>' + formatLargeNumber(q) + '</td></tr>'
      );
    }
    for (var j = 0; j < bids.length; j++) {
      var b = bids[j];
      var bp = Number(b.price);
      var bq = Number(b.quantity || 0);
      rows.push(
        '<tr class="orderbook-row bid" role="button" tabindex="0" data-price="' + bp + '" data-side="buy">' +
        '<td>구매</td><td>' + formatCurrency(bp) + '</td><td>' + formatLargeNumber(bq) + '</td></tr>'
      );
    }
    rows.push('</tbody></table>');
    wrap.innerHTML = rows.join('');
    wrap.querySelectorAll('.orderbook-row').forEach(function (tr) {
      tr.addEventListener('click', function () {
        var pr = parseInt(tr.getAttribute('data-price'), 10);
        var side = String(tr.getAttribute('data-side') || '');
        if (!Number.isNaN(pr) && pr > 0) applyPriceFromOrderbook(pr, side);
      });
      tr.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        var pr = parseInt(tr.getAttribute('data-price'), 10);
        var side = String(tr.getAttribute('data-side') || '');
        if (!Number.isNaN(pr) && pr > 0) applyPriceFromOrderbook(pr, side);
      });
    });
  }

  function applyPriceFromOrderbook(price, side) {
    var p = parseInt(price, 10);
    if (Number.isNaN(p) || p <= 0) return;
    var sd = String(side || '').toLowerCase();
    if (sd === 'buy') {
      setBuyPriceType(false);
      var inp = document.getElementById('tradeLimitPrice');
      if (inp) inp.value = String(p);
      updateTradeTickHint();
    }
    var code = String(selectedOrderbookCode || '').trim();
    if (isSixDigitCode(code)) {
      lastOrderbookPick = { code: code, price: p, atMs: Date.now() };
    }
    if (sd === 'sell') {
      setSellPriceType(false);
      var quickSellInp = document.getElementById('tradeSellLimitPrice');
      if (quickSellInp) quickSellInp.value = String(p);
      var sellLim = document.getElementById('sellModalLimitPrice');
      var sellM = document.getElementById('sellModal');
      if (sellLim && sellM && sellM.classList.contains('is-open')) {
        setHoldingSellPriceType(false);
        sellLim.value = String(p);
        updateSellModalEst();
        updateHoldingBuyEst();
      } else if (sellLim) {
        sellLim.value = String(p);
      }
    }
  }

  /** 목록에서 고른 종목이면 숨은 코드(6자리) 우선, 없으면 입력란 그대로 */
  function getTradeStockForApi() {
    var h = document.getElementById('tradeStockCode');
    var code = h && h.value ? String(h.value).trim() : '';
    if (/^\d{6}$/.test(code)) return code;
    var t = document.getElementById('tradeStock');
    return (t && t.value || '').trim();
  }

  function escapeHtmlAttr(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** analysis.html 의 요약 강조와 동일: 마크다운 래퍼 제거 후 문장별 important-line */
  function normalizeSimAiDisplayText(raw) {
    var s = String(raw || '')
      .replace(/\r\n/g, '\n')
      .replace(/^\s+/gm, '')
      .trim();
    var i;
    for (i = 0; i < 4; i += 1) {
      if (s.length >= 6 && s.slice(0, 3) === '"""' && s.slice(-3) === '"""') {
        s = s.slice(3, -3).trim();
        continue;
      }
      if (s.length >= 6 && s.slice(0, 3) === "'''" && s.slice(-3) === "'''") {
        s = s.slice(3, -3).trim();
        continue;
      }
      break;
    }
    s = s.replace(/^```(?:\w+)?\s*/i, '').replace(/```$/i, '').trim();
    return s.replace(/\n{3,}/g, '\n\n').trim();
  }

  function escapeHtmlForSimAiSummary(text) {
    if (text == null) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderSimHoldingImportantSummaryHtml(raw) {
    var text = normalizeSimAiDisplayText(raw);
    if (!text) return '';
    var brushClass = ['brush-1', 'brush-2', 'brush-3', 'brush-4'];
    var keywordPattern = /(매수|보유|약세|강세|목표가|리스크|위험|변동성|상승|하락|추세|저항|지지|실적|수급|거래량|현재가|%|원)/;
    var sentenceRegex = /[^.!?\n]+(?:[.!?…]+|$)/g;
    var lines = text.split('\n').map(function (line) {
      var rawSents = line.match(sentenceRegex) || [line];
      var sentences = rawSents
        .map(function (st) {
          return st.trim();
        })
        .filter(Boolean);
      if (!sentences.length) return '';
      var pickCount = Math.min(3, Math.max(1, Math.round(sentences.length / 3)));
      var ranked = sentences.map(function (sentence, idx) {
        var score = 0;
        if (keywordPattern.test(sentence)) score += 3;
        if (/\d/.test(sentence)) score += 2;
        if (sentence.length >= 24 && sentence.length <= 80) score += 1;
        return { idx: idx, score: score, rand: Math.random() };
      });
      ranked.sort(function (a, b) {
        return b.score - a.score || a.rand - b.rand;
      });
      var selected = {};
      ranked.slice(0, pickCount).forEach(function (r) {
        selected[r.idx] = true;
      });
      return sentences
        .map(function (sentence, idx) {
          var safe = escapeHtmlForSimAiSummary(sentence);
          if (!selected[idx]) return safe;
          var cls = brushClass[Math.floor(Math.random() * brushClass.length)];
          return '<span class="important-line ' + cls + '">' + safe + '</span>';
        })
        .join(' ');
    });
    return lines.join('<br>');
  }

  function bindStockLogosIn(container) {
    var J = window.JurinStockLogos;
    if (!J || !container || !container.querySelectorAll) return;
    container.querySelectorAll('img.stock-logo-img').forEach(J.bindStockLogoIntrinsicFit);
  }

  function tradeLocalYmd(ms) {
    if (!ms) return '';
    var d = new Date(ms);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  /** Flask/MySQL 등에서 오는 시각 문자열을 로컬 Date로 안정적으로 파싱 */
  function parseOrderTimestamp(ts) {
    if (ts == null || ts === '') return 0;
    if (typeof ts === 'number' && !Number.isNaN(ts)) return ts;
    var s = String(ts).trim();
    if (!s) return 0;
    if (/^\d{4}-\d{2}-\d{2} \d/.test(s)) s = s.replace(' ', 'T');
    var d = new Date(s);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }

  /** 체결 내역 날짜 필터 값(비어 있으면 오늘 로컬일) */
  function getHistoryFilterYmd() {
    var dateEl = document.getElementById('historyDateFilter');
    var v = dateEl && dateEl.value ? String(dateEl.value).trim() : '';
    if (v) return v;
    return tradeLocalYmd(Date.now());
  }

  function setHistoryDateToToday() {
    var el = document.getElementById('historyDateFilter');
    if (el) el.value = tradeLocalYmd(Date.now());
  }

  /** 등락·손익 색: 보합 flat, 상승 up(빨강), 하락 down(파랑) */
  function changeDirClass(n) {
    const x = Number(n);
    if (Number.isNaN(x)) return 'flat';
    if (x > 1e-9) return 'up';
    if (x < -1e-9) return 'down';
    return 'flat';
  }

  var simWatchlistItems = [];

  function simWatchlistChipLogoHtml(codeRaw, nameRaw) {
    var J = window.JurinStockLogos;
    var initial = escapeHtml((nameRaw && String(nameRaw).trim().charAt(0)) || '?');
    if (!J) {
      return (
        '<span class="stock-logo-wrap stock-logo-wrap--placeholder watchlist-chip-logo" aria-hidden="true">' + initial + '</span>'
      );
    }
    var url = J.stockLogoUrlForCode(codeRaw);
    if (url) {
      var fileCode = J.resolveStockLogoFileCode(codeRaw);
      var dataFile = fileCode ? ' data-logo-file="' + escapeHtmlAttr(fileCode) + '"' : '';
      return (
        '<span class="stock-logo-wrap watchlist-chip-logo"><img class="stock-logo-img"' +
        dataFile +
        ' src="' +
        escapeHtml(url) +
        '" alt="" loading="lazy" decoding="async"/></span>'
      );
    }
    return (
      '<span class="stock-logo-wrap stock-logo-wrap--placeholder watchlist-chip-logo" aria-hidden="true">' + initial + '</span>'
    );
  }

  function simRenderWatchlistChips() {
    var host = document.getElementById('simWatchlistPanel');
    var aside = document.querySelector('.sim-watchlist-aside');
    if (!host) return;
    if (!simWatchlistItems.length) {
      host.innerHTML = '';
      if (aside) aside.hidden = true;
      return;
    }
    if (aside) aside.hidden = false;
    var parts = [];
    for (var i = 0; i < simWatchlistItems.length; i++) {
      var it = simWatchlistItems[i];
      var codeRaw = String(it.code || '').trim();
      var nameRaw = String(it.name || it.code || '').trim();
      var c = escapeHtml(codeRaw);
      var n = escapeHtml(nameRaw);
      var logoBlock = simWatchlistChipLogoHtml(codeRaw, nameRaw);
      parts.push(
        '<button type="button" class="watchlist-chip watchlist-chip--aside" data-code="' +
          c +
          '"><div class="watchlist-chip-inner">' +
          logoBlock +
          '<span class="watchlist-chip-text"><span class="watchlist-chip-name">' +
          n +
          '</span><span class="watchlist-chip-code">' +
          c +
          '</span></span></div></button>',
      );
    }
    host.innerHTML = '<div class="watchlist-chip-scroller--aside" role="list">' + parts.join('') + '</div>';
    bindStockLogosIn(host);
    host.querySelectorAll('.watchlist-chip--aside').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cd = btn.getAttribute('data-code');
        if (!cd || !/^\d{6}$/.test(cd)) return;
        var tr = document.querySelector('tr.discovery-row[data-code="' + escapeHtmlAttr(cd) + '"]');
        var name = '';
        if (tr) {
          var enc = tr.getAttribute('data-name') || '';
          try {
            name = enc ? decodeURIComponent(enc) : '';
          } catch (err) {
            name = enc;
          }
        }
        if (!name) {
          for (var j = 0; j < simWatchlistItems.length; j++) {
            if (String(simWatchlistItems[j].code) === cd) {
              name = String(simWatchlistItems[j].name || simWatchlistItems[j].code || cd);
              break;
            }
          }
        }
        var price = tr ? parseFloat(tr.getAttribute('data-price') || '0', 10) : 0;
        var volOpt = null;
        var tvOpt = null;
        if (tr) {
          var vpv = parseFloat(tr.getAttribute('data-volume') || '', 10);
          var tpv = parseFloat(tr.getAttribute('data-traded-value') || '', 10);
          if (Number.isFinite(vpv)) volOpt = vpv;
          if (Number.isFinite(tpv)) tvOpt = tpv;
        }
        applyQuoteToTrade(cd, price, name || cd);
        openSimStockDetailFromDiscovery(cd, price, name || cd, volOpt, tvOpt);
      });
    });
  }

  async function simRefreshWatchlist() {
    try {
      var res = await fetch(simApiBase() + '/api/watchlist', { credentials: 'include' });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok || !data.success) {
        simWatchlistItems = [];
      } else {
        simWatchlistItems = Array.isArray(data.items) ? data.items.slice() : [];
      }
    } catch (e) {
      simWatchlistItems = [];
    }
    simRenderWatchlistChips();
  }

  window.simClearWatchlistUi = function () {
    simWatchlistItems = [];
    simRenderWatchlistChips();
  };

  (function chainSimLogout() {
    var prevLogout = typeof window.afterJurinLogout === 'function' ? window.afterJurinLogout : null;
    window.afterJurinLogout = function () {
      if (typeof window.simClearWatchlistUi === 'function') {
        window.simClearWatchlistUi();
      }
      clearMockOrderBoardLocal();
      if (prevLogout) {
        try {
          prevLogout();
        } catch (e) {
          /* ignore */
        }
      }
    };
  })();

  /* 로그인 성공 시 전체 새로고침 대신 서버 포트폴리오만 다시 로드 (게이트·reload로 인한 오류 방지) */
  window.afterJurinLogin = function () {
    loadPortfolioFromServer().then(function () {
      updatePortfolio();
      renderHoldings();
      renderHistory();
      maybeRefreshRealizedPnl();
    });
    simRefreshWatchlist().catch(function () {});
  };

  // 초기 데이터
  let portfolio = {
    initialCash: 0,
    balance: 0,
    holdings: {},
    history: [],
    summary: null,
  };

  /** 거래 내역 탭: all | buy | sell | pending */
  let historyViewFilter = 'all';

  /**
   * 비우기 이후: 서버에서 다시 받아도 이 시각(atMs) 이하 체결은 목록에 넣지 않음(새출발).
   * null이면 서버 체결 전부 표시. 복구 버튼으로 null로 되돌림.
   */
  let historyDisplayCutoffMs = null;

  /** 포트폴리오 | 수익분석 메인 뷰 */
  let simMainView = 'portfolio';
  let pnlGranularity = 'day';
  let pnlAnchorDate = new Date();
  let pnlDetailTab = 'sales';
  let pnlCache = null;
  let pnlLoading = false;

  function pnlAnchorYmd() {
    var d = pnlAnchorDate;
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function parsePnlAnchorYmd(ymd) {
    if (!ymd) return new Date();
    var p = String(ymd).slice(0, 10).split('-');
    if (p.length < 3) return new Date();
    var dt = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return Number.isNaN(dt.getTime()) ? new Date() : dt;
  }

  function setMockPnlHint(html) {
    var el = document.getElementById('mockPnlHint');
    if (!el) return;
    if (html) {
      el.style.display = 'block';
      el.innerHTML = html;
    } else {
      el.style.display = 'none';
      el.innerHTML = '';
    }
  }

  function setSimMainView(view) {
    simMainView = view === 'pnl' ? 'pnl' : 'portfolio';
    var portPanel = document.getElementById('simViewPortfolio');
    var pnlPanel = document.getElementById('simViewRealizedPnl');
    var tabPort = document.getElementById('simViewTabPortfolio');
    var tabPnl = document.getElementById('simViewTabPnl');
    var isPnl = simMainView === 'pnl';
    if (portPanel) portPanel.hidden = isPnl;
    if (pnlPanel) pnlPanel.hidden = !isPnl;
    if (tabPort) {
      tabPort.classList.toggle('active', !isPnl);
      tabPort.setAttribute('aria-selected', !isPnl ? 'true' : 'false');
    }
    if (tabPnl) {
      tabPnl.classList.toggle('active', isPnl);
      tabPnl.setAttribute('aria-selected', isPnl ? 'true' : 'false');
    }
    if (isPnl) loadRealizedPnl();
  }

  function syncPnlGranularityChips() {
    document.querySelectorAll('.sim-pnl-chip[data-pnl-gran]').forEach(function (btn) {
      var g = btn.getAttribute('data-pnl-gran');
      var on = g === pnlGranularity;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var nav = document.getElementById('simPnlNav');
    if (nav) nav.classList.toggle('is-disabled', pnlGranularity === 'all');
  }

  function syncPnlDetailTabs() {
    document.querySelectorAll('.sim-pnl-detail-tab[data-pnl-detail]').forEach(function (btn) {
      var t = btn.getAttribute('data-pnl-detail');
      var on = t === pnlDetailTab;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function formatPnlSigned(n) {
    var v = Math.round(Number(n) || 0);
    if (v > 0) return '+' + formatCurrency(v);
    if (v < 0) return formatCurrency(v);
    return formatCurrency(0);
  }

  function renderRealizedPnlView(data) {
    if (!data || !data.success) return;
    pnlCache = data;
    var period = data.period || {};
    if (period.anchor) pnlAnchorDate = parsePnlAnchorYmd(period.anchor);

    var labelEl = document.getElementById('simPnlPeriodLabel');
    if (labelEl) labelEl.textContent = period.label || '실현수익';

    var prevBtn = document.getElementById('simPnlPrev');
    var nextBtn = document.getElementById('simPnlNext');
    if (prevBtn) prevBtn.disabled = !period.prev_anchor;
    if (nextBtn) nextBtn.disabled = !period.next_anchor;

    var total = Number(data.total_realized || 0);
    var totalEl = document.getElementById('simPnlTotal');
    if (totalEl) {
      totalEl.textContent = formatPnlSigned(total);
      totalEl.className = 'sim-pnl-total ' + changeDirClass(total);
    }

    var bd = data.breakdown || {};
    function setBd(id, key) {
      var el = document.getElementById(id);
      if (!el) return;
      var val = Number(bd[key] || 0);
      el.textContent = formatCurrency(val);
      el.classList.remove('up', 'down', 'muted');
      if (key === 'sales') el.classList.add(changeDirClass(val));
      else el.classList.add('muted');
    }
    setBd('simPnlSales', 'sales');
    setBd('simPnlDividend', 'dividend');
    setBd('simPnlLending', 'lending');
    setBd('simPnlBond', 'bond');
    setBd('simPnlInterest', 'interest');

    var noteEl = document.getElementById('simPnlNote');
    if (noteEl && data.note) noteEl.textContent = data.note;

    var listEl = document.getElementById('simPnlSalesList');
    if (!listEl) return;

    if (pnlDetailTab === 'dividend') {
      listEl.innerHTML =
        '<div class="sim-pnl-empty">모의투자에서는 배당금이 발생하지 않습니다.</div>';
      return;
    }
    if (pnlDetailTab === 'interest') {
      listEl.innerHTML =
        '<div class="sim-pnl-empty">모의투자에서는 계좌이자가 발생하지 않습니다.</div>';
      return;
    }

    var trades = Array.isArray(data.sales_trades) ? data.sales_trades : [];
    if (trades.length === 0) {
      listEl.innerHTML =
        '<div class="sim-pnl-empty">이 기간에 매도 체결이 없습니다.</div>';
      return;
    }

    listEl.innerHTML = trades
      .map(function (t) {
        var r = Number(t.realized || 0);
        var dt = t.executed_at ? new Date(t.executed_at) : null;
        var dtStr = dt && !Number.isNaN(dt.getTime())
          ? dt.toLocaleString('ko-KR', {
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '';
        return (
          '<div class="sim-pnl-trade">' +
          '<div><div class="sim-pnl-trade-name">' +
          escapeHtml(t.name || t.code || '') +
          '</div><div class="sim-pnl-trade-meta">' +
          escapeHtml(String(t.quantity || 0)) +
          '주 · 매도 ' +
          formatCurrency(Number(t.sell_price || 0)) +
          (dtStr ? ' · ' + escapeHtml(dtStr) : '') +
          '</div></div>' +
          '<div class="sim-pnl-trade-amt ' +
          changeDirClass(r) +
          '">' +
          formatPnlSigned(r) +
          '</div></div>'
        );
      })
      .join('');
  }

  async function loadRealizedPnl() {
    if (simMainView !== 'pnl' || pnlLoading) return;
    pnlLoading = true;
    try {
      setMockPnlHint('');
      var url =
        simApiBase() +
        '/api/mock/realized-pnl?granularity=' +
        encodeURIComponent(pnlGranularity) +
        '&anchor=' +
        encodeURIComponent(pnlAnchorYmd());
      var res = await fetch(url, { credentials: 'include' });
      var data = await res.json().catch(function () {
        return {};
      });
      if (res.status === 401) {
        var loc = window.location;
        var openUrl = urlToOpenSimulationOnFlask();
        var msg;
        if (String(loc.port || '') === '5000') {
          msg = '로그인 세션이 없습니다. 상단에서 <strong>로그인</strong>한 뒤 새로고침하세요.';
        } else {
          msg =
            '로그인이 필요합니다. Flask 서버 주소로 접속해 로그인하세요.<br /><a href="' +
            openUrl +
            '">' +
            openUrl +
            '</a>';
        }
        setMockPnlHint(msg);
        renderRealizedPnlView({
          success: true,
          total_realized: 0,
          breakdown: { sales: 0, dividend: 0, lending: 0, bond: 0, interest: 0 },
          sales_trades: [],
          period: { label: '실현수익', prev_anchor: null, next_anchor: null },
        });
        return;
      }
      if (!res.ok || !data.success) {
        setMockPnlHint('실현수익을 불러오지 못했습니다. ' + (data.message || 'HTTP ' + res.status));
        return;
      }
      syncPnlGranularityChips();
      renderRealizedPnlView(data);
    } catch (e) {
      console.warn('[mock-realized-pnl]', e.message);
      setMockPnlHint('실현수익을 불러오지 못했습니다.');
    } finally {
      pnlLoading = false;
    }
  }

  function pnlNavigatePrev() {
    if (pnlGranularity === 'all') return;
    var p = pnlCache && pnlCache.period ? pnlCache.period.prev_anchor : null;
    if (p) {
      pnlAnchorDate = parsePnlAnchorYmd(p);
      loadRealizedPnl();
    }
  }

  function pnlNavigateNext() {
    if (pnlGranularity === 'all') return;
    var n = pnlCache && pnlCache.period ? pnlCache.period.next_anchor : null;
    if (n) {
      pnlAnchorDate = parsePnlAnchorYmd(n);
      loadRealizedPnl();
    }
  }

  function bindSimPnlUi() {
    document.querySelectorAll('.sim-view-tab[data-sim-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setSimMainView(btn.getAttribute('data-sim-view'));
      });
    });
    document.querySelectorAll('.sim-pnl-chip[data-pnl-gran]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        pnlGranularity = btn.getAttribute('data-pnl-gran') || 'day';
        pnlAnchorDate = new Date();
        syncPnlGranularityChips();
        loadRealizedPnl();
      });
    });
    var prevBtn = document.getElementById('simPnlPrev');
    var nextBtn = document.getElementById('simPnlNext');
    if (prevBtn) prevBtn.addEventListener('click', pnlNavigatePrev);
    if (nextBtn) nextBtn.addEventListener('click', pnlNavigateNext);
    document.querySelectorAll('.sim-pnl-detail-tab[data-pnl-detail]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        pnlDetailTab = btn.getAttribute('data-pnl-detail') || 'sales';
        syncPnlDetailTabs();
        if (pnlCache) renderRealizedPnlView(pnlCache);
        else loadRealizedPnl();
      });
    });
    document.querySelectorAll('.sim-pnl-filter-chip[data-pnl-market]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.sim-pnl-filter-chip').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        if (pnlCache) renderRealizedPnlView(pnlCache);
      });
    });
    var card = document.getElementById('realizedProfitCard');
    if (card) {
      card.addEventListener('click', function () {
        setSimMainView('pnl');
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setSimMainView('pnl');
        }
      });
    }
    syncPnlGranularityChips();
    syncPnlDetailTabs();
  }

  function maybeRefreshRealizedPnl() {
    if (simMainView === 'pnl') loadRealizedPnl();
  }

  // 페이지 로드 시 초기화 (로그인 여부와 관계없이 화면 표시; 미로그인 시 API는 빈 자산·매매 시 로그인 필요 안내)
  document.addEventListener('DOMContentLoaded', async function() {
    localizeSimulationUi();
    if (typeof refreshAuthNav === 'function') refreshAuthNav();

    var holdingTabSell = document.getElementById('holdingModalTabSell');
    var holdingTabBuy = document.getElementById('holdingModalTabBuy');
    if (holdingTabSell) {
      holdingTabSell.addEventListener('click', function () {
        setHoldingModalMode('sell');
      });
    }
    if (holdingTabBuy) {
      holdingTabBuy.addEventListener('click', function () {
        setHoldingModalMode('buy');
      });
    }
    var holdingBuyQty = document.getElementById('holdingBuyQty');
    if (holdingBuyQty) holdingBuyQty.addEventListener('input', updateHoldingBuyEst);
    var holdingBuyLp = document.getElementById('holdingBuyLimitPrice');
    if (holdingBuyLp) {
      holdingBuyLp.addEventListener('input', function () {
        if (holdingBuyLp) {
          var v = String(holdingBuyLp.value).replace(/[^\d]/g, '');
          if (holdingBuyLp.value !== v) holdingBuyLp.value = v;
        }
        updateHoldingBuyEst();
      });
    }
    var hbLm = document.getElementById('holdingBuyLimitPriceMinus');
    var hbLp = document.getElementById('holdingBuyLimitPricePlus');
    if (hbLm) hbLm.addEventListener('click', function () { bumpHoldingBuyLimitPrice(-1); });
    if (hbLp) hbLp.addEventListener('click', function () { bumpHoldingBuyLimitPrice(1); });
    var hbTypM = document.getElementById('holdingBuyPriceTypeMarket');
    var hbTypL = document.getElementById('holdingBuyPriceTypeLimit');
    if (hbTypM) hbTypM.addEventListener('click', function () { setHoldingBuyPriceType(true); });
    if (hbTypL) hbTypL.addEventListener('click', function () { setHoldingBuyPriceType(false); });

    document.querySelectorAll('.history-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setHistoryViewFilter(this.getAttribute('data-history-tab') || 'all');
      });
    });

    document.querySelectorAll('.sim-holding-sheet-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var t = btn.getAttribute('data-sim-holding-tab');
        if (t) setSimHoldingSheetTab(t);
      });
    });
    document.querySelectorAll('.sim-holding-metric-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var m = btn.getAttribute('data-sim-metric');
        if (m) setSimHoldingInfoMetric(m);
      });
    });

    var historyDateFilter = document.getElementById('historyDateFilter');
    if (historyDateFilter) {
      setHistoryDateToToday();
      function onHistoryDateChange() {
        renderHistory();
      }
      historyDateFilter.addEventListener('change', onHistoryDateChange);
      historyDateFilter.addEventListener('input', onHistoryDateChange);
    }
    var historyClearDisplay = document.getElementById('historyClearDisplay');
    if (historyClearDisplay) {
      historyClearDisplay.addEventListener('click', function () {
        clearHistoryDisplayOnly();
      });
    }
    var historyRestoreDisplay = document.getElementById('historyRestoreDisplay');
    if (historyRestoreDisplay) {
      historyRestoreDisplay.addEventListener('click', function () {
        restoreHistoryFromServer();
      });
    }

    var holdingsTable = document.getElementById('holdingsTable');
    if (holdingsTable) {
      holdingsTable.addEventListener('click', function (e) {
        var tr = e.target.closest('tr[data-holding-key]');
        if (!tr) return;
        var key = tr.getAttribute('data-holding-key');
        if (key) openSellModalFromHoldingKey(key);
      });
    }
    var simDetailClose = document.getElementById('simHoldingDetailClose');
    if (simDetailClose) simDetailClose.addEventListener('click', closeSimHoldingDetailSheet);
    initSimHistoryPanelResizer();
    document.querySelectorAll('.sim-holding-range-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        onSimHoldingRangeClick(btn);
      });
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      var sellM = document.getElementById('sellModal');
      if (sellM && sellM.classList.contains('is-open')) return;
      var buyM = document.getElementById('buyModal');
      if (buyM && buyM.classList.contains('is-open')) return;
      var qsm = document.getElementById('quickSellConfirmModal');
      if (qsm && qsm.classList.contains('is-open')) return;
      var sheet = document.getElementById('simHoldingDetailSheet');
      if (sheet && !sheet.hasAttribute('hidden')) closeSimHoldingDetailSheet();
    });
    var smQty = document.getElementById('sellModalQty');
    if (smQty) smQty.addEventListener('input', updateSellModalEst);
    var tradeStockEl = document.getElementById('tradeStock');
    if (tradeStockEl) {
      tradeStockEl.addEventListener('input', function () {
        var h = document.getElementById('tradeStockCode');
        if (h) h.value = '';
        updateTradeTickHint();
      });
    }
    var quickSellSel = document.getElementById('tradeSellStock');
    if (quickSellSel) {
      quickSellSel.addEventListener('change', function () {
        var key = quickSellSel.value;
        var qEl = document.getElementById('tradeSellQuantity');
        var pEl = document.getElementById('tradeSellLimitPrice');
        var h = key ? portfolio.holdings[key] : null;
        if (!h) return;
        if (qEl) {
          qEl.max = String(Number(h.quantity || 0));
          if (!qEl.value || Number(qEl.value) < 1) qEl.value = '1';
        }
        if (pEl) {
          if (isSellMarketMode()) {
            setSellPriceType(true);
          } else if (!pEl.value) {
            var cp = Number(h.currentPrice || 0);
            if (cp > 0) pEl.value = String(Math.round(cp));
          }
        }
      });
    }
    function sanitizePriceDigits(inp) {
      if (!inp) return;
      var v = String(inp.value).replace(/[^\d]/g, '');
      if (inp.value !== v) inp.value = v;
    }
    var tlp = document.getElementById('tradeLimitPrice');
    if (tlp) {
      tlp.addEventListener('input', function () {
        sanitizePriceDigits(tlp);
        updateTradeTickHint();
      });
      tlp.addEventListener('change', updateTradeTickHint);
    }
    var sellLp = document.getElementById('sellModalLimitPrice');
    if (sellLp) {
      sellLp.addEventListener('input', function () {
        sanitizePriceDigits(sellLp);
      });
    }
    var quickSellLp = document.getElementById('tradeSellLimitPrice');
    if (quickSellLp) {
      quickSellLp.addEventListener('input', function () {
        sanitizePriceDigits(quickSellLp);
      });
    }
    var tlm = document.getElementById('tradeLimitPriceMinus');
    var tlpu = document.getElementById('tradeLimitPricePlus');
    if (tlm) tlm.addEventListener('click', function () { bumpTradeLimitPrice(-1); });
    if (tlpu) tlpu.addEventListener('click', function () { bumpTradeLimitPrice(1); });
    var slm = document.getElementById('sellModalLimitPriceMinus');
    var slpu = document.getElementById('sellModalLimitPricePlus');
    if (slm) slm.addEventListener('click', function () { bumpSellModalLimitPrice(-1); });
    if (slpu) slpu.addEventListener('click', function () { bumpSellModalLimitPrice(1); });
    var hsTypM = document.getElementById('holdingSellPriceTypeMarket');
    var hsTypL = document.getElementById('holdingSellPriceTypeLimit');
    if (hsTypM) hsTypM.addEventListener('click', function () { setHoldingSellPriceType(true); });
    if (hsTypL) hsTypL.addEventListener('click', function () { setHoldingSellPriceType(false); });
    var qslm = document.getElementById('tradeSellLimitPriceMinus');
    var qslpu = document.getElementById('tradeSellLimitPricePlus');
    if (qslm) qslm.addEventListener('click', function () { bumpQuickSellLimitPrice(-1); });
    if (qslpu) qslpu.addEventListener('click', function () { bumpQuickSellLimitPrice(1); });
    var typM = document.getElementById('tradeBuyPriceTypeMarket');
    var typL = document.getElementById('tradeBuyPriceTypeLimit');
    if (typM) typM.addEventListener('click', function () { setBuyPriceType(true); });
    if (typL) typL.addEventListener('click', function () { setBuyPriceType(false); });
    setBuyPriceType(true);
    var sellTypM = document.getElementById('tradeSellPriceTypeMarket');
    var sellTypL = document.getElementById('tradeSellPriceTypeLimit');
    if (sellTypM) sellTypM.addEventListener('click', function () { setSellPriceType(true); });
    if (sellTypL) sellTypL.addEventListener('click', function () { setSellPriceType(false); });
    setSellPriceType(true);
    var obClose = document.getElementById('orderbookCloseBtn');
    if (obClose) obClose.addEventListener('click', closeOrderbookOverlay);
    updateTradeTickHint();
    var discBody = document.getElementById('discoveryTableBody');
    if (discBody && !discBody.dataset.discoveryBound) {
      discBody.dataset.discoveryBound = '1';
      discBody.addEventListener('click', function (e) {
        var tr = e.target.closest('tr.discovery-row');
        if (!tr) return;
        var code = tr.getAttribute('data-code');
        if (!code) return;
        var enc = tr.getAttribute('data-name') || '';
        var name = '';
        try {
          name = enc ? decodeURIComponent(enc) : '';
        } catch (err) {
          name = enc;
        }
        var price = parseFloat(tr.getAttribute('data-price') || '0', 10);
        var volAttr = tr.getAttribute('data-volume');
        var tvAttr = tr.getAttribute('data-traded-value');
        var volPre = volAttr != null && volAttr !== '' ? parseFloat(volAttr, 10) : NaN;
        var tvPre = tvAttr != null && tvAttr !== '' ? parseFloat(tvAttr, 10) : NaN;
        applyQuoteToTrade(code, price, name);
        openSimStockDetailFromDiscovery(
          code,
          price,
          name,
          Number.isFinite(volPre) ? volPre : null,
          Number.isFinite(tvPre) ? tvPre : null
        );
      });
    }
    var rankSearch = document.getElementById('marketRankSearchInput');
    if (rankSearch && !rankSearch.dataset.rankSearchBound) {
      rankSearch.dataset.rankSearchBound = '1';
      var rankDeb = null;
      function scheduleRankLoad() {
        if (rankDeb) clearTimeout(rankDeb);
        rankDeb = setTimeout(function () {
          loadTradedValueBoard({ silent: false });
        }, 340);
      }
      rankSearch.addEventListener('input', scheduleRankLoad);
      rankSearch.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (rankDeb) clearTimeout(rankDeb);
          loadTradedValueBoard({ silent: false });
        }
      });
    }
    if (rankSearch && typeof JurinStockAutocomplete !== 'undefined' && !rankSearch.dataset.stockSuggestAc) {
      rankSearch.dataset.stockSuggestAc = '1';
      JurinStockAutocomplete.attachStock(rankSearch, {
        compact: true,
        onSelect: function (item) {
          var q = item && (item.code || item.name) ? String(item.code || item.name).trim() : '';
          loadTradedValueBoard({ silent: false, q: q });
        },
      });
    }
    var tradeStockEl = document.getElementById('tradeStock');
    if (tradeStockEl && !tradeStockEl.dataset.stockAcBound && typeof JurinStockAutocomplete !== 'undefined') {
      tradeStockEl.dataset.stockAcBound = '1';
      JurinStockAutocomplete.attachStock(tradeStockEl, {
        onSelect: function (item) {
          var codeHidden = document.getElementById('tradeStockCode');
          var code = item && item.code ? String(item.code).trim() : '';
          var name = item && (item.name || item.code) ? String(item.name || item.code).trim() : '';
          if (tradeStockEl) tradeStockEl.value = name || code;
          if (codeHidden) codeHidden.value = /^\d{6}$/.test(code) ? code : '';
          updateTradeTickHint();
          if (/^\d{6}$/.test(code)) {
            tryRefreshBuyDisplayPriceAsync();
            loadOrderbookPanel(code);
          }
        },
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var buyM = document.getElementById('buyModal');
      if (buyM && buyM.classList.contains('is-open')) {
        closeBuyModal();
        return;
      }
      var qsm = document.getElementById('quickSellConfirmModal');
      if (qsm && qsm.classList.contains('is-open')) {
        closeQuickSellConfirmModal();
        return;
      }
      var ob = document.getElementById('orderbookOverlay');
      if (ob && ob.classList.contains('is-open')) {
        closeOrderbookOverlay();
        return;
      }
      closeSellModal();
    });

    bindSimPnlUi();

    await simRefreshWatchlist();
    await loadPortfolioFromServer();
    updatePortfolio();
    renderHoldings();
    renderHistory();
    maybeRefreshRealizedPnl();
    if (isSellMarketMode()) setSellPriceType(true);
    renderOrderStatusBoard();
    loadTradedValueBoard();
    setInterval(loadTradedValueBoard, 25000);
    var sellLimInp = document.getElementById('sellModalLimitPrice');
    if (sellLimInp) sellLimInp.addEventListener('input', updateSellModalEst);
    setInterval(async function () {
      await loadPortfolioFromServer();
      updatePortfolio();
      renderHoldings();
      renderHistory();
      maybeRefreshRealizedPnl();
      await loadTradedValueBoard({ silent: true });
      await processPendingOrders();
    }, 25000);
  });

  async function loadTradedValueBoard(options) {
    var opts = options || {};
    var silent = !!opts.silent;
    var qOpt = opts.q != null ? String(opts.q).trim() : '';
    const tbody = document.getElementById('discoveryTableBody');
    if (!tbody) return;

    var rankInp = document.getElementById('marketRankSearchInput');
    var q = qOpt;
    if (!q && rankInp) q = String(rankInp.value || '').trim();

    if (!silent) {
      tbody.innerHTML = '<tr><td colspan="7" style="color: var(--gray-400);">시세를 불러오는 중...</td></tr>';
    }

    try {
      var rankUrl = `${simApiBase()}/api/mock/traded-value-rank?limit=100`;
      if (q) rankUrl += '&q=' + encodeURIComponent(q);
      const res = await fetch(rankUrl);
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success || !Array.isArray(data.items)) {
        throw new Error(data.message || '시세 조회 실패');
      }

      const rows = data.items.map((item, idx) => {
        const rate = Number(item.change_rate || 0);
        const dir = changeDirClass(rate);
        let rateStr = rate.toFixed(2) + '%';
        if (dir === 'up') rateStr = '+' + rateStr;
        const codeStr = String(item.code || '');
        const nameStr = String(item.name || '');
        rememberMarketQuote(codeStr, nameStr, Number(item.price || 0));
        const openPx = Number(item.open_price || 0);
        const openCell = openPx > 0 ? formatCurrency(openPx) : '—';
        const nameCell =
          '<div><strong>' +
          escapeHtml(nameStr) +
          '</strong></div><div class="discovery-code">' +
          escapeHtml(codeStr) +
          '</div>';
        return `
          <tr class="discovery-row" data-code="${escapeHtmlAttr(codeStr)}" data-name="${encodeURIComponent(nameStr)}" data-price="${Number(item.price || 0)}" data-volume="${Number(item.volume || 0)}" data-traded-value="${Number(item.traded_value || 0)}">
            <td>${idx + 1}</td>
            <td>${nameCell}</td>
            <td>${formatCurrency(Number(item.price || 0))}</td>
            <td>${openCell}</td>
            <td class="holding-change ${dir}">${rateStr}</td>
            <td>${formatLargeNumber(Number(item.volume || 0))}</td>
            <td>${formatLargeCurrency(Number(item.traded_value || 0))}</td>
          </tr>
        `;
      }).join('');

      tbody.innerHTML = rows || '<tr><td colspan="7" style="color: var(--gray-400);">표시할 데이터가 없습니다.</td></tr>';
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="color: #ff8e8e;">${err.message || '시세를 불러오지 못했습니다.'}</td></tr>`;
    }
  }

  function applyQuoteToTrade(code, price, name) {
    const stockInput = document.getElementById('tradeStock');
    const codeHidden = document.getElementById('tradeStockCode');
    const qtyInput = document.getElementById('tradeQuantity');
    const codeStr = (code != null ? String(code) : '').trim();
    const nameStr = (name != null ? String(name) : '').trim();
    window.lastDiscoveryQuotePrice = Number(price) > 0 ? Number(price) : 0;
    if (codeHidden) codeHidden.value = /^\d{6}$/.test(codeStr) ? codeStr : '';
    if (stockInput) stockInput.value = nameStr || codeStr;
    if (qtyInput) qtyInput.value = '1';
    var tlpEl = document.getElementById('tradeLimitPrice');
    var pNum = Number(price);
    if (tlpEl && Number.isFinite(pNum) && pNum > 0) {
      var rounded = Math.round(pNum);
      tlpEl.value = String(rounded);
      if (isBuyMarketMode() && /^\d{6}$/.test(codeStr)) {
        rememberMarketQuote(codeStr, nameStr, rounded);
      }
    }
    updateTradeTickHint();
    var buyBlock = document.querySelector('.trading-section .trading-form');
    if (buyBlock) buyBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (/^\d{6}$/.test(codeStr)) {
      loadOrderbookPanel(codeStr);
      clearOrderbookPoll();
      orderbookPollTimer = setInterval(function () {
        refreshOrderbookPanel();
      }, 30000);
    }
  }

  /** file://·Live Server 등에서는 쿠키가 API(:5000)에 안 붙음 → 항상 http URL로 안내 */
  function urlToOpenSimulationOnFlask() {
    var loc = window.location;
    if (loc.protocol === 'file:' || !loc.hostname) {
      return 'http://127.0.0.1:5000/simulation.html';
    }
    if (String(loc.port) === '5000') {
      var p = loc.pathname || '/simulation.html';
      if (!p.endsWith('.html')) p = '/simulation.html';
      return loc.origin + p;
    }
    return loc.protocol + '//' + loc.hostname + ':5000/simulation.html';
  }

  function setMockPortfolioHint(html) {
    const el = document.getElementById('mockPortfolioHint');
    if (!el) return;
    if (html) {
      el.style.display = 'block';
      el.innerHTML = html;
    } else {
      el.style.display = 'none';
      el.innerHTML = '';
    }
  }

  async function loadPortfolioFromServer() {
    try {
      setMockPortfolioHint('');
      const res = await fetch(`${simApiBase()}/api/mock/portfolio`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        portfolio = {
          initialCash: 0,
          balance: 0,
          holdings: {},
          history: [],
          summary: null,
        };
        clearMockOrderBoardLocal();
        var loc = window.location;
        var port = String(loc.port || '');
        var onApiPort = port === '5000';
        var openUrl = urlToOpenSimulationOnFlask();
        var fromFile = loc.protocol === 'file:' || !loc.hostname;
        var msg;
        if (onApiPort) {
          msg = '로그인 세션이 없습니다. 상단에서 <strong>로그인</strong>한 뒤 새로고침하세요.';
        } else if (fromFile) {
          msg = '지금은 <strong>파일을 직접 연 방식(file://)</strong>이라 로그인 쿠키가 서버에 전달되지 않습니다. ' +
            '<code>backend</code> 폴더에서 Flask를 켠 뒤(<code>python app.py</code>), 주소창에 아래를 입력해 접속하세요.<br />' +
            '<a href="' + openUrl + '">' + openUrl + '</a>';
        } else {
          msg = '이 페이지가 <strong>포트 ' + (port || '기본') + '</strong>에서 열려 있어 로그인 쿠키가 API(:5000)에 전달되지 않을 수 있습니다. ' +
            'Flask 실행 후 아래 주소로 접속하세요.<br />' +
            '<a href="' + openUrl + '">' + openUrl + '</a>';
        }
        setMockPortfolioHint(msg);
        console.warn('[mock-portfolio] 401 — file:// 이 아닌 http://127.0.0.1:5000/simulation.html 로 열고 로그인하세요.');
        return;
      }
      if (!res.ok || !data.success || !data.account) {
        if (data.message) console.warn('[mock-portfolio]', data.message);
        setMockPortfolioHint('자산을 불러오지 못했습니다. ' + (data.message || ('HTTP ' + res.status)));
        return;
      }

      const holdings = {};
      (data.holdings || []).forEach(item => {
        const key = item.name || item.code;
        holdings[key] = {
          code: item.code,
          quantity: Number(item.quantity || 0),
          avgPrice: Number(item.avg_price || 0),
          currentPrice: Number(item.current_price || item.avg_price || 0),
        };
      });

      let history = (data.orders || []).map(order => {
        const ts = order.executed_at || order.created_at;
        const atMs = parseOrderTimestamp(ts);
        const timeText = atMs
          ? new Date(atMs).toLocaleString('ko-KR', {
              year: 'numeric',
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })
          : '-';
        return {
          order_id: order.order_id,
          stock: order.name || order.code,
          code: order.code || '',
          type: String(order.side || '').toUpperCase() === 'BUY' ? 'buy' : 'sell',
          quantity: Number(order.quantity || 0),
          price: Number(order.price || 0),
          total: Number(order.total || 0),
          time: timeText,
          atMs,
        };
      });
      if (typeof historyDisplayCutoffMs === 'number' && !Number.isNaN(historyDisplayCutoffMs)) {
        history = history.filter(function (h) {
          return h.atMs > historyDisplayCutoffMs;
        });
      }

      portfolio = {
        initialCash: Number(data.account.initial_cash || 0),
        balance: Number(data.account.cash_balance || 0),
        holdings,
        history,
        summary: data.summary || null,
      };
      if (!mockOrderBoardHydratedFromLs) {
        restoreOrderBoardState();
        mockOrderBoardHydratedFromLs = true;
      }
      maybeRefreshRealizedPnl();
    } catch (e) {
      console.warn('[mock-portfolio]', e.message);
    }
  }

  function totalAssetsFromPortfolioState() {
    const s = portfolio.summary;
    if (s && typeof s.total_asset === 'number' && !Number.isNaN(s.total_asset)) {
      return s.total_asset;
    }
    let total = portfolio.balance;
    Object.values(portfolio.holdings).forEach(h => {
      total += h.quantity * h.currentPrice;
    });
    return total;
  }

  let buyModalState = { stock: '', quantity: 0 };
  var quickSellConfirmState = null;

  function openBuyConfirmModal() {
    const stockEl = document.getElementById('tradeStock');
    const qtyEl = document.getElementById('tradeQuantity');
    const stock = (stockEl && stockEl.value || '').trim();
    const apiStock = getTradeStockForApi();
    let quantity = parseInt(qtyEl && qtyEl.value, 10);
    if (!stock || !apiStock) {
      alert('종목을 입력하거나 왼쪽 목록에서 종목을 선택해주세요.');
      return;
    }
    if (Number.isNaN(quantity) || quantity < 1) {
      quantity = 1;
      if (qtyEl) qtyEl.value = '1';
    }
    buyModalState = { stock: apiStock, quantity };
    const line = document.getElementById('buyModalStockLine');
    const qtyLine = document.getElementById('buyModalQtyLine');
    const priceLine = document.getElementById('buyModalPriceLine');
    var codeH = document.getElementById('tradeStockCode');
    var c = codeH && codeH.value ? String(codeH.value).trim() : '';
    var limEl = document.getElementById('tradeLimitPrice');
    var limP = limEl && limEl.value ? parseInt(limEl.value, 10) : 0;
    if (line) line.textContent = c ? stock + ' (' + c + ')' : stock;
    if (qtyLine) qtyLine.textContent = quantity.toLocaleString() + '주';
    if (priceLine) {
      var limOk = limP > 0 && !Number.isNaN(limP);
      if (isBuyMarketMode()) {
        var refM = limOk ? limP : buyReferencePrice();
        priceLine.textContent =
          refM > 0 ? formatCurrency(refM) + ' (시장가)' : '현재 시세 부근 체결 예상 (시장가)';
      } else {
        var effPx = limOk ? limP : referencePriceForTick();
        priceLine.textContent = formatCurrency(effPx) + (limOk ? ' (지정가)' : ' (시세 기준)');
      }
    }
    var limOk2 = limP > 0 && !Number.isNaN(limP);
    var unitPxForCost = 0;
    if (isBuyMarketMode()) {
      unitPxForCost = limOk2 ? limP : buyReferencePrice();
    } else {
      unitPxForCost = limOk2 ? limP : referencePriceForTick();
    }
    var grossBuyEst = unitPxForCost > 0 ? unitPxForCost * quantity : 0;
    renderMockCostBreakdown(document.getElementById('buyModalCostBreakdown'), 'BUY', grossBuyEst);

    const modal = document.getElementById('buyModal');
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeBuyModal() {
    const modal = document.getElementById('buyModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    buyModalState = { stock: '', quantity: 0 };
    var bc = document.getElementById('buyModalCostBreakdown');
    if (bc) {
      bc.innerHTML = '';
      bc.style.display = 'none';
    }
  }

  async function confirmBuyFromModal() {
    const stockEl = document.getElementById('tradeStock');
    const qtyEl = document.getElementById('tradeQuantity');
    const stock = getTradeStockForApi();
    let quantity = parseInt(qtyEl && qtyEl.value, 10);
    if (!stock) {
      alert('종목을 입력해주세요.');
      return;
    }
    if (Number.isNaN(quantity) || quantity < 1) {
      quantity = 1;
      if (qtyEl) qtyEl.value = '1';
    }
    buyModalState = { stock, quantity };
    var limEl2 = document.getElementById('tradeLimitPrice');
    var limPx = limEl2 && limEl2.value ? parseInt(limEl2.value, 10) : 0;
    if (Number.isNaN(limPx) || limPx < 0) limPx = 0;
    if (isBuyMarketMode()) limPx = 0;
    try {
      if (limPx > 0) {
        const refPx = await getLatestMarketPrice(stock);
        if (refPx > 0 && refPx > limPx) {
          const pending = {
            id: pendingOrderSeq++,
            side: 'BUY',
            stock: stock,
            stockRef: stock,
            quantity: quantity,
            limitPrice: limPx,
            createdAt: Date.now(),
          };
          pendingOrders.push(pending);
          renderOrderStatusBoard();
          closeBuyModal();
          showPendingOrderFeedback(pending, refPx);
          return;
        }
      }

      const out = await executeTradeRequest('BUY', stock, quantity, limPx);
      const res = out.res;
      const data = out.data;
      if (res.status === 401) {
        closeBuyModal();
        var loc = window.location;
        var openUrl = urlToOpenSimulationOnFlask();
        var hint =
          '로그인 세션이 없어 구매할 수 없습니다. Flask(<code>:5000</code>)에서 이 페이지를 연 뒤 상단에서 로그인하세요.<br />' +
          '<a href="' + openUrl + '">' + openUrl + '</a>';
        setMockPortfolioHint(hint);
        alert(data.message || '로그인이 필요합니다.');
        return;
      }
      if (!res.ok || !data.success) {
        pushOrderStatusEvent({
          stock: stock,
          side: 'BUY',
          mode: 'manual',
          status: 'failed',
          desiredPrice: limPx,
          quantity: quantity,
          note: data.message || '구매 처리 실패',
        });
        throw new Error(data.message || '구매 처리에 실패했습니다.');
      }
      closeBuyModal();
      await loadPortfolioFromServer();
      updatePortfolio();
      renderHoldings();
      renderHistory();

      document.getElementById('tradeStock').value = '';
      var tsc = document.getElementById('tradeStockCode');
      if (tsc) tsc.value = '';
      document.getElementById('tradeQuantity').value = '';
      var tlp = document.getElementById('tradeLimitPrice');
      if (tlp) tlp.value = '';

      var tr = data && data.trade ? data.trade : {};
      pushOrderStatusEvent({
        stock: tr.name || stock,
        side: 'BUY',
        mode: 'manual',
        status: 'executed',
        desiredPrice: limPx,
        executedPrice: Number(tr.price || 0),
        quantity: Number(tr.quantity || quantity),
      });
      showTradeFeedback(data, 'buy');
    } catch (err) {
      alert(err.message || '구매 처리 중 오류가 발생했습니다.');
    }
  }

  let sellModalState = { name: '', code: '', maxQty: 0, unitPrice: 0 };

  function isHoldingSellMarketMode() {
    var b = document.getElementById('holdingSellPriceTypeMarket');
    return !!(b && b.classList.contains('active'));
  }

  function setHoldingSellPriceType(market) {
    var mBtn = document.getElementById('holdingSellPriceTypeMarket');
    var lBtn = document.getElementById('holdingSellPriceTypeLimit');
    var inp = document.getElementById('sellModalLimitPrice');
    var plus = document.getElementById('sellModalLimitPricePlus');
    var minus = document.getElementById('sellModalLimitPriceMinus');
    var cell = document.getElementById('sellModalLimitPriceCell');
    if (mBtn && lBtn) {
      mBtn.classList.toggle('active', market);
      lBtn.classList.toggle('active', !market);
      mBtn.setAttribute('aria-pressed', market ? 'true' : 'false');
      lBtn.setAttribute('aria-pressed', market ? 'false' : 'true');
    }
    var refPx = Number(sellModalState.unitPrice) || 0;
    if (inp) {
      inp.disabled = !!market;
      if (plus) plus.disabled = !!market;
      if (minus) minus.disabled = !!market;
      if (cell) cell.classList.toggle('is-market-mode', !!market);
      if (market) {
        if (refPx > 0) inp.value = String(Math.round(refPx));
        else inp.value = '';
      } else {
        var cur = inp.value !== '' ? parseInt(inp.value, 10) : NaN;
        if (Number.isNaN(cur) || cur <= 0) {
          if (refPx > 0) inp.value = String(Math.round(refPx));
        }
      }
    }
    updateSellModalEst();
  }

  function getHoldingModalBuyStockForApi() {
    var c = String(sellModalState.code || '').trim();
    if (/^\d{6}$/.test(c)) return c;
    return String(sellModalState.name || '').trim();
  }

  function isHoldingBuyMarketMode() {
    var b = document.getElementById('holdingBuyPriceTypeMarket');
    return !!(b && b.classList.contains('active'));
  }

  function setHoldingBuyPriceType(market) {
    var mBtn = document.getElementById('holdingBuyPriceTypeMarket');
    var lBtn = document.getElementById('holdingBuyPriceTypeLimit');
    var inp = document.getElementById('holdingBuyLimitPrice');
    var plus = document.getElementById('holdingBuyLimitPricePlus');
    var minus = document.getElementById('holdingBuyLimitPriceMinus');
    var cell = document.getElementById('holdingBuyLimitPriceCell');
    if (mBtn && lBtn) {
      mBtn.classList.toggle('active', market);
      lBtn.classList.toggle('active', !market);
      mBtn.setAttribute('aria-pressed', market ? 'true' : 'false');
      lBtn.setAttribute('aria-pressed', market ? 'false' : 'true');
    }
    var refPx = Number(sellModalState.unitPrice) || 0;
    if (inp) {
      inp.disabled = !!market;
      if (plus) plus.disabled = !!market;
      if (minus) minus.disabled = !!market;
      if (cell) cell.classList.toggle('is-market-mode', !!market);
      if (market) {
        if (refPx > 0) inp.value = String(Math.round(refPx));
        else inp.value = '';
      } else {
        var cur = inp.value !== '' ? parseInt(inp.value, 10) : NaN;
        if (Number.isNaN(cur) || cur <= 0) {
          if (refPx > 0) inp.value = String(Math.round(refPx));
        }
      }
    }
    updateHoldingBuyEst();
  }

  function updateHoldingBuyEst() {
    var qtyEl = document.getElementById('holdingBuyQty');
    var totalEl = document.getElementById('holdingBuyEstTotal');
    if (!qtyEl || !totalEl) return;
    var qty = parseInt(qtyEl.value, 10);
    if (Number.isNaN(qty) || qty < 1) qty = 1;
    var ref = Number(sellModalState.unitPrice) || 0;
    var unit = ref;
    if (!isHoldingBuyMarketMode()) {
      var limIn = document.getElementById('holdingBuyLimitPrice');
      var lv = limIn && limIn.value ? parseInt(limIn.value, 10) : NaN;
      unit = !Number.isNaN(lv) && lv > 0 ? lv : 0;
    }
    var grossHb = Math.max(0, qty * unit);
    totalEl.textContent = formatCurrency(grossHb);
    renderMockCostBreakdown(document.getElementById('holdingBuyCostBreakdown'), 'BUY', grossHb);
  }

  function bumpHoldingBuyLimitPrice(direction) {
    if (isHoldingBuyMarketMode()) return;
    var inp = document.getElementById('holdingBuyLimitPrice');
    if (!inp) return;
    var cur = inp.value !== '' ? parseInt(inp.value, 10) : NaN;
    var ref = Number(sellModalState.unitPrice) || 0;
    if (!Number.isFinite(ref) || ref <= 0) ref = 50000;
    var tick = krxTickSize(!Number.isNaN(cur) && cur > 0 ? cur : ref);
    var next;
    if (!Number.isNaN(cur) && cur > 0) {
      next = cur + direction * tick;
      if (next < tick) next = tick;
    } else {
      var rounded = Math.floor(ref / tick) * tick;
      if (direction > 0) {
        next = rounded <= 0 ? tick : rounded + tick;
      } else {
        next = Math.max(tick, rounded - tick);
      }
    }
    inp.value = String(next);
    updateHoldingBuyEst();
  }

  function initHoldingBuyPanelInModal() {
    var hbq = document.getElementById('holdingBuyQty');
    if (hbq) {
      hbq.value = '1';
      hbq.min = 1;
    }
    var hub = document.getElementById('holdingBuyUnitPrice');
    if (hub) hub.textContent = formatCurrency(sellModalState.unitPrice);
    setHoldingBuyPriceType(true);
  }

  function setHoldingModalMode(mode, opts) {
    var skipFocus = opts && opts.skipFocus;
    var sellTab = document.getElementById('holdingModalTabSell');
    var buyTab = document.getElementById('holdingModalTabBuy');
    var sellBody = document.getElementById('holdingModalSellBody');
    var buyBody = document.getElementById('holdingModalBuyBody');
    var isSell = mode === 'sell';
    if (sellTab) {
      sellTab.classList.toggle('active', isSell);
      sellTab.setAttribute('aria-selected', isSell ? 'true' : 'false');
    }
    if (buyTab) {
      buyTab.classList.toggle('active', !isSell);
      buyTab.setAttribute('aria-selected', !isSell ? 'true' : 'false');
    }
    if (sellBody) {
      if (isSell) sellBody.removeAttribute('hidden');
      else sellBody.setAttribute('hidden', '');
    }
    if (buyBody) {
      if (isSell) buyBody.setAttribute('hidden', '');
      else buyBody.removeAttribute('hidden');
    }
    if (skipFocus) return;
    var modal = document.getElementById('sellModal');
    if (!modal || !modal.classList.contains('is-open')) return;
    if (isSell) {
      var q = document.getElementById('sellModalQty');
      if (q) {
        try {
          q.focus({ preventScroll: true });
        } catch (_) {
          q.focus();
        }
      }
    } else {
      var bq = document.getElementById('holdingBuyQty');
      if (bq) {
        try {
          bq.focus({ preventScroll: true });
        } catch (_) {
          bq.focus();
        }
      }
    }
  }

  function openSellModalFromHoldingKey(holdingKey) {
    const foundName = holdingKey;
    const found = portfolio.holdings[foundName];
    if (!found || Number(found.quantity) <= 0) {
      alert('보유 종목을 찾을 수 없습니다. 새로고침 후 다시 시도해주세요.');
      return;
    }
    sellModalState = {
      name: foundName,
      code: found.code != null ? String(found.code) : '',
      maxQty: Number(found.quantity),
      unitPrice: Number(found.currentPrice || 0),
    };
    const line = document.getElementById('sellModalStockLine');
    if (line) {
      line.textContent = foundName + (sellModalState.code ? ' · ' + sellModalState.code : '');
    }
    const qtyInput = document.getElementById('sellModalQty');
    qtyInput.max = sellModalState.maxQty;
    qtyInput.min = 1;
    qtyInput.value = sellModalState.maxQty;
    document.getElementById('sellModalUnitPrice').textContent = formatCurrency(sellModalState.unitPrice);
    var slInpReset = document.getElementById('sellModalLimitPrice');
    if (slInpReset) slInpReset.value = '';
    var holdCode = String(sellModalState.code || '').trim();
    var pick = lastOrderbookPick;
    var pickOk = pick && isSixDigitCode(holdCode) && pick.code === holdCode &&
      pick.price > 0 && (Date.now() - pick.atMs) <= ORDERBOOK_PICK_TTL_MS;
    if (pickOk) {
      setHoldingSellPriceType(false);
      var slPick = document.getElementById('sellModalLimitPrice');
      if (slPick) slPick.value = String(Math.round(pick.price));
      updateSellModalEst();
    } else {
      setHoldingSellPriceType(true);
    }
    initHoldingBuyPanelInModal();
    setHoldingModalMode('sell');
    const modal = document.getElementById('sellModal');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    qtyInput.focus();
  }

  function closeSellModal() {
    const modal = document.getElementById('sellModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    setHoldingModalMode('sell', { skipFocus: true });
    sellModalState = { name: '', code: '', maxQty: 0, unitPrice: 0 };
    var scb = document.getElementById('sellModalCostBreakdown');
    if (scb) {
      scb.innerHTML = '';
      scb.style.display = 'none';
    }
    var hcb = document.getElementById('holdingBuyCostBreakdown');
    if (hcb) {
      hcb.innerHTML = '';
      hcb.style.display = 'none';
    }
  }

  function updateSellModalEst() {
    const st = sellModalState;
    const totalEl = document.getElementById('sellModalEstTotal');
    const qtyInput = document.getElementById('sellModalQty');
    const limIn = document.getElementById('sellModalLimitPrice');
    if (!totalEl || !qtyInput) return;
    let unit = Number(st.unitPrice) || 0;
    if (!isHoldingSellMarketMode() && limIn && limIn.value) {
      var lv = parseInt(limIn.value, 10);
      if (!Number.isNaN(lv) && lv > 0) unit = lv;
    }
    let q = parseInt(qtyInput.value, 10) || 0;
    if (st.maxQty > 0) q = Math.min(Math.max(q, 0), st.maxQty);
    var grossSell = Math.max(0, q * unit);
    totalEl.textContent = formatCurrency(grossSell);
    renderMockCostBreakdown(document.getElementById('sellModalCostBreakdown'), 'SELL', grossSell);
  }

  function bumpSellModalLimitPrice(direction) {
    if (isHoldingSellMarketMode()) return;
    var inp = document.getElementById('sellModalLimitPrice');
    if (!inp) return;
    var cur = inp.value !== '' ? parseInt(inp.value, 10) : NaN;
    var ref = Number(sellModalState.unitPrice) || 0;
    if (!Number.isFinite(ref) || ref <= 0) ref = 50000;
    var tick = krxTickSize(!Number.isNaN(cur) && cur > 0 ? cur : ref);
    var next;
    if (!Number.isNaN(cur) && cur > 0) {
      next = cur + direction * tick;
      if (next < tick) next = tick;
    } else {
      var rounded = Math.floor(ref / tick) * tick;
      if (direction > 0) {
        next = rounded <= 0 ? tick : rounded + tick;
      } else {
        next = Math.max(tick, rounded - tick);
      }
    }
    inp.value = String(next);
    updateSellModalEst();
  }

  function quickSellReferenceForTick() {
    var rp = sellReferencePrice();
    if (rp > 0) return rp;
    return 50000;
  }

  function bumpQuickSellLimitPrice(direction) {
    if (isSellMarketMode()) return;
    var inp = document.getElementById('tradeSellLimitPrice');
    if (!inp) return;
    var cur = inp.value !== '' ? parseInt(inp.value, 10) : NaN;
    var ref = quickSellReferenceForTick();
    var tick = krxTickSize(!Number.isNaN(cur) && cur > 0 ? cur : ref);
    var next;
    if (!Number.isNaN(cur) && cur > 0) {
      next = cur + direction * tick;
      if (next < tick) next = tick;
    } else {
      var rounded = Math.floor(ref / tick) * tick;
      if (direction > 0) next = rounded <= 0 ? tick : rounded + tick;
      else next = Math.max(tick, rounded - tick);
    }
    inp.value = String(next);
  }

  async function performQuickSellTrade(key, qty, sellPx) {
    var found = portfolio.holdings[key];
    if (!found || Number(found.quantity) <= 0) {
      throw new Error('보유 종목 정보를 다시 확인해주세요.');
    }
    var stockRef = found.code && String(found.code).trim() ? String(found.code).trim() : key;
    if (sellPx > 0) {
      var refPx = await getLatestMarketPrice(stockRef);
      if (refPx > 0 && refPx < sellPx) {
        const pending = {
          id: pendingOrderSeq++,
          side: 'SELL',
          stock: key,
          stockRef: stockRef,
          quantity: qty,
          limitPrice: sellPx,
          createdAt: Date.now(),
        };
        pendingOrders.push(pending);
        renderOrderStatusBoard();
        showPendingOrderFeedback(pending, refPx);
        return;
      }
    }
    const out = await executeTradeRequest('SELL', stockRef, qty, sellPx);
    const res = out.res;
    const data = out.data;
    if (!res.ok || !data.success) {
      pushOrderStatusEvent({
        stock: key,
        side: 'SELL',
        mode: 'manual',
        status: 'failed',
        desiredPrice: sellPx,
        quantity: qty,
        note: data.message || '판매 처리 실패',
      });
      throw new Error(data.message || '판매 처리에 실패했습니다.');
    }
    await loadPortfolioFromServer();
    updatePortfolio();
    renderHoldings();
    renderHistory();
    var ts = data && data.trade ? data.trade : {};
    pushOrderStatusEvent({
      stock: ts.name || key,
      side: 'SELL',
      mode: 'manual',
      status: 'executed',
      desiredPrice: sellPx,
      executedPrice: Number(ts.price || 0),
      quantity: Number(ts.quantity || qty),
    });
    showTradeFeedback(data, 'sell');
  }

  window.openQuickSellConfirmModal = function () {
    var sel = document.getElementById('tradeSellStock');
    var qtyEl = document.getElementById('tradeSellQuantity');
    var limEl = document.getElementById('tradeSellLimitPrice');
    if (!sel || sel.disabled || !sel.value) {
      alert('판매할 보유 종목을 선택해주세요.');
      return;
    }
    var key = sel.value;
    var found = portfolio.holdings[key];
    if (!found || Number(found.quantity) <= 0) {
      alert('보유 종목 정보를 다시 확인해주세요.');
      return;
    }
    var qty = parseInt(qtyEl && qtyEl.value, 10);
    if (Number.isNaN(qty) || qty < 1) qty = 1;
    if (qty > Number(found.quantity)) {
      alert('보유 수량(' + Number(found.quantity) + '주)을 넘을 수 없습니다.');
      return;
    }
    var sellPx = limEl && limEl.value ? parseInt(limEl.value, 10) : 0;
    if (Number.isNaN(sellPx) || sellPx < 0) sellPx = 0;
    if (isSellMarketMode()) sellPx = 0;

    var unit = 0;
    if (isSellMarketMode()) {
      unit = Number(found.currentPrice || 0) || sellReferencePrice() || 0;
    } else {
      var lv = limEl && limEl.value ? parseInt(limEl.value, 10) : NaN;
      unit = !Number.isNaN(lv) && lv > 0 ? lv : (Number(found.currentPrice || 0) || 0);
    }
    var gross = Math.max(0, qty * unit);

    var stockRef = found.code && String(found.code).trim() ? String(found.code).trim() : key;
    var codeDisp = found.code ? String(found.code).trim() : '';
    var stockLine = document.getElementById('quickSellModalStockLine');
    var qtyLine = document.getElementById('quickSellModalQtyLine');
    var priceLine = document.getElementById('quickSellModalPriceLine');
    if (stockLine) stockLine.textContent = codeDisp ? key + ' (' + codeDisp + ')' : key;
    if (qtyLine) qtyLine.textContent = qty.toLocaleString() + '주';
    if (priceLine) {
      if (isSellMarketMode()) {
        priceLine.textContent =
          unit > 0 ? formatCurrency(unit) + ' (시장가)' : '현재 시세 부근 체결 예상 (시장가)';
      } else {
        priceLine.textContent = unit > 0 ? formatCurrency(unit) + ' (지정가)' : '—';
      }
    }
    renderMockCostBreakdown(document.getElementById('quickSellModalCostBreakdown'), 'SELL', gross);

    quickSellConfirmState = { key: key, qty: qty, sellPx: sellPx };

    var modal = document.getElementById('quickSellConfirmModal');
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  };

  window.closeQuickSellConfirmModal = function () {
    var modal = document.getElementById('quickSellConfirmModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    quickSellConfirmState = null;
    var cb = document.getElementById('quickSellModalCostBreakdown');
    if (cb) {
      cb.innerHTML = '';
      cb.style.display = 'none';
    }
  };

  window.confirmQuickSellFromModal = async function () {
    var st = quickSellConfirmState;
    if (!st) return;
    var key = st.key;
    var qty = st.qty;
    var sellPx = st.sellPx;
    window.closeQuickSellConfirmModal();
    try {
      await performQuickSellTrade(key, qty, sellPx);
    } catch (err) {
      alert(err.message || '판매 중 오류가 발생했습니다.');
    }
  };

  window.executeQuickSell = async function () {
    var sel = document.getElementById('tradeSellStock');
    var qtyEl = document.getElementById('tradeSellQuantity');
    var limEl = document.getElementById('tradeSellLimitPrice');
    if (!sel || sel.disabled || !sel.value) {
      alert('판매할 보유 종목을 선택해주세요.');
      return;
    }
    var key = sel.value;
    var found = portfolio.holdings[key];
    if (!found || Number(found.quantity) <= 0) {
      alert('보유 종목 정보를 다시 확인해주세요.');
      return;
    }
    var qty = parseInt(qtyEl && qtyEl.value, 10);
    if (Number.isNaN(qty) || qty < 1) qty = 1;
    if (qty > Number(found.quantity)) {
      alert('보유 수량(' + Number(found.quantity) + '주)을 넘을 수 없습니다.');
      return;
    }
    var sellPx = limEl && limEl.value ? parseInt(limEl.value, 10) : 0;
    if (Number.isNaN(sellPx) || sellPx < 0) sellPx = 0;
    if (isSellMarketMode()) sellPx = 0;
    try {
      await performQuickSellTrade(key, qty, sellPx);
    } catch (err) {
      alert(err.message || '판매 중 오류가 발생했습니다.');
    }
  };

  async function confirmSellFromModal() {
    const st = sellModalState;
    const qty = parseInt(document.getElementById('sellModalQty').value, 10);
    if (!st.name || !qty || qty < 1) {
      alert('판매 수량을 확인해주세요.');
      return;
    }
    if (qty > st.maxQty) {
      alert('보유 수량(' + st.maxQty + '주)을 넘을 수 없습니다.');
      return;
    }
    var sellLim = document.getElementById('sellModalLimitPrice');
    var sellPx = sellLim && sellLim.value ? parseInt(sellLim.value, 10) : 0;
    if (Number.isNaN(sellPx) || sellPx < 0) sellPx = 0;
    if (isHoldingSellMarketMode()) sellPx = 0;
    try {
      const stockRef = st.code && String(st.code).trim() ? st.code : st.name;
      if (sellPx > 0) {
        const refPx = await getLatestMarketPrice(stockRef);
        if (refPx > 0 && refPx < sellPx) {
          const pending = {
            id: pendingOrderSeq++,
            side: 'SELL',
            stock: st.name || stockRef,
            stockRef: stockRef,
            quantity: qty,
            limitPrice: sellPx,
            createdAt: Date.now(),
          };
          pendingOrders.push(pending);
          renderOrderStatusBoard();
          closeSellModal();
          showPendingOrderFeedback(pending, refPx);
          return;
        }
      }

      const out = await executeTradeRequest('SELL', stockRef, qty, sellPx);
      const res = out.res;
      const data = out.data;
      if (!res.ok || !data.success) {
        pushOrderStatusEvent({
          stock: st.name || stockRef,
          side: 'SELL',
          mode: 'manual',
          status: 'failed',
          desiredPrice: sellPx,
          quantity: qty,
          note: data.message || '판매 처리 실패',
        });
        throw new Error(data.message || '판매 처리에 실패했습니다.');
      }
      closeSellModal();
      await loadPortfolioFromServer();
      updatePortfolio();
      renderHoldings();
      renderHistory();
      var ts = data && data.trade ? data.trade : {};
      pushOrderStatusEvent({
        stock: ts.name || st.name || stockRef,
        side: 'SELL',
        mode: 'manual',
        status: 'executed',
        desiredPrice: sellPx,
        executedPrice: Number(ts.price || 0),
        quantity: Number(ts.quantity || qty),
      });
      showTradeFeedback(data, 'sell');
    } catch (err) {
      alert(err.message || '판매 중 오류가 발생했습니다.');
    }
  }

  async function confirmBuyFromHoldingModal() {
    var stock = getHoldingModalBuyStockForApi();
    if (!stock) {
      alert('종목을 확인할 수 없습니다.');
      return;
    }
    var qtyEl = document.getElementById('holdingBuyQty');
    var quantity = parseInt(qtyEl && qtyEl.value, 10);
    if (Number.isNaN(quantity) || quantity < 1) {
      quantity = 1;
      if (qtyEl) qtyEl.value = '1';
    }
    var limEl2 = document.getElementById('holdingBuyLimitPrice');
    var limPx = limEl2 && limEl2.value ? parseInt(limEl2.value, 10) : 0;
    if (Number.isNaN(limPx) || limPx < 0) limPx = 0;
    if (isHoldingBuyMarketMode()) limPx = 0;
    try {
      if (limPx > 0) {
        const refPx = await getLatestMarketPrice(stock);
        if (refPx > 0 && refPx > limPx) {
          const pending = {
            id: pendingOrderSeq++,
            side: 'BUY',
            stock: stock,
            stockRef: stock,
            quantity: quantity,
            limitPrice: limPx,
            createdAt: Date.now(),
          };
          pendingOrders.push(pending);
          renderOrderStatusBoard();
          closeSellModal();
          showPendingOrderFeedback(pending, refPx);
          return;
        }
      }

      const out = await executeTradeRequest('BUY', stock, quantity, limPx);
      const res = out.res;
      const data = out.data;
      if (res.status === 401) {
        closeSellModal();
        var openUrl401 = urlToOpenSimulationOnFlask();
        var hint401 =
          '로그인 세션이 없어 구매할 수 없습니다. Flask(<code>:5000</code>)에서 이 페이지를 연 뒤 상단에서 로그인하세요.<br />' +
          '<a href="' + openUrl401 + '">' + openUrl401 + '</a>';
        setMockPortfolioHint(hint401);
        alert(data.message || '로그인이 필요합니다.');
        return;
      }
      if (!res.ok || !data.success) {
        pushOrderStatusEvent({
          stock: stock,
          side: 'BUY',
          mode: 'manual',
          status: 'failed',
          desiredPrice: limPx,
          quantity: quantity,
          note: data.message || '구매 처리 실패',
        });
        throw new Error(data.message || '구매 처리에 실패했습니다.');
      }
      closeSellModal();
      await loadPortfolioFromServer();
      updatePortfolio();
      renderHoldings();
      renderHistory();

      var tr = data && data.trade ? data.trade : {};
      pushOrderStatusEvent({
        stock: tr.name || stock,
        side: 'BUY',
        mode: 'manual',
        status: 'executed',
        desiredPrice: limPx,
        executedPrice: Number(tr.price || 0),
        quantity: Number(tr.quantity || quantity),
      });
      showTradeFeedback(data, 'buy');
    } catch (err) {
      alert(err.message || '구매 처리 중 오류가 발생했습니다.');
    }
  }

  window.confirmBuyFromHoldingModal = confirmBuyFromHoldingModal;

  function showTradeFeedback(data, source) {
    if (!data) return;
    const t = data.trade || {};
    const side = String(t.side || '').toUpperCase();
    var target = String(source || '').toLowerCase();
    if (target !== 'buy' && target !== 'sell') {
      target = side === 'SELL' ? 'sell' : 'buy';
    }
    const el = document.getElementById(target === 'sell' ? 'sellTradeFeedback' : 'tradeFeedback');
    const other = document.getElementById(target === 'sell' ? 'tradeFeedback' : 'sellTradeFeedback');
    if (!el) return;
    const sideKo = String(t.side || '').toUpperCase() === 'BUY' ? '구매' : '판매';
    const nameLine = (t.name || '—') + (t.code ? ' (' + t.code + ')' : '');
    const summary =
      `<div class="trade-row"><span>종목</span><span>${nameLine}</span></div>` +
      `<div class="trade-row"><span>체결</span><span>${sideKo} · ${Number(t.quantity || 0).toLocaleString()}주 · ${formatCurrency(Number(t.price || 0))}</span></div>`;

    el.style.display = 'block';
    el.innerHTML = '<strong>체결 완료</strong>' + summary;
    if (other) other.style.display = 'none';
  }

  // 포트폴리오 업데이트
  function updatePortfolio() {
    const s = portfolio.summary;
    let stockEval = 0;
    Object.values(portfolio.holdings).forEach(holding => {
      stockEval += holding.quantity * holding.currentPrice;
    });

    let cashDisplay = portfolio.balance;
    let totalValue = cashDisplay + stockEval;

    if (s && typeof s.total_asset === 'number' && !Number.isNaN(s.total_asset)) {
      totalValue = s.total_asset;
    }
    if (s && typeof s.cash_balance === 'number' && !Number.isNaN(s.cash_balance)) {
      cashDisplay = s.cash_balance;
    }

    const baseCash = Number(portfolio.initialCash || 0);
    let totalReturn = baseCash > 0 ? ((totalValue - baseCash) / baseCash * 100) : 0;
    let totalProfit = totalValue - baseCash;
    if (s && typeof s.total_profit === 'number' && !Number.isNaN(s.total_profit)) {
      totalProfit = s.total_profit;
    }
    if (s && typeof s.total_return === 'number' && !Number.isNaN(s.total_return)) {
      totalReturn = s.total_return;
    }
    const holdingCount = Object.keys(portfolio.holdings).length;
    const unrealizedProfit = Object.values(portfolio.holdings).reduce((sum, h) => {
      return sum + ((h.currentPrice - h.avgPrice) * h.quantity);
    }, 0);

    let realizedProfit = totalProfit - unrealizedProfit;
    if (s && typeof s.total_profit === 'number' && !Number.isNaN(s.total_profit) &&
        typeof s.unrealized_profit === 'number' && !Number.isNaN(s.unrealized_profit)) {
      realizedProfit = s.total_profit - s.unrealized_profit;
    }

    const cashEl = document.getElementById('cashBalanceDisplay');
    if (cashEl) cashEl.textContent = formatCurrency(cashDisplay);

    var balPlEl = document.getElementById('balanceHoldingPlDisplay');
    if (balPlEl) {
      var up = unrealizedProfit;
      var upStr;
      if (up > 1e-9) upStr = '+' + formatCurrency(up);
      else if (up < -1e-9) upStr = formatCurrency(up);
      else upStr = formatCurrency(0);
      balPlEl.textContent = upStr;
      balPlEl.className = 'balance-sub balance-holding-pl ' + changeDirClass(unrealizedProfit);
      balPlEl.setAttribute('title', '보유 종목 평가 손익');
    }

    const totalBalEl = document.getElementById('totalBalance');
    if (totalBalEl) totalBalEl.textContent = formatCurrency(totalValue);

    const plEl = document.getElementById('totalAssetPlLine');
    if (plEl) {
      const pf = totalProfit;
      const rf = totalReturn;
      const profitStr =
        (pf > 0 ? '+' : '') + formatCurrency(pf);
      const pctStr = (rf > 0 ? '+' : '') + rf.toFixed(2) + '%';
      plEl.textContent = profitStr + ' (' + pctStr + ')';
      plEl.className = 'balance-pl ' + changeDirClass(pf);
    }
    document.getElementById('totalReturn').textContent = (totalReturn >= 0 ? '+' : '') + totalReturn.toFixed(2) + '%';
    document.getElementById('totalReturn').className = 'stat-value ' + changeDirClass(totalReturn);
    document.getElementById('totalProfit').textContent = formatCurrency(totalProfit);
    document.getElementById('totalProfit').className = 'stat-value ' + changeDirClass(totalProfit);
    document.getElementById('holdingCount').textContent = holdingCount + '개';
    var realizedEl = document.getElementById('realizedProfit');
    if (realizedEl) {
      realizedEl.textContent = formatCurrency(realizedProfit);
      realizedEl.className = 'stat-value ' + changeDirClass(realizedProfit);
    }
  }

  function htmlAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function updateSellPanelSelect() {
    const sel = document.getElementById('sellHoldingSelect');
    const quickSel = document.getElementById('tradeSellStock');
    const btn = document.getElementById('openSellPanelBtn');
    const quickBtn = document.getElementById('tradeSellBtn');
    const emptyHint = document.getElementById('sellPanelEmptyHint');
    const formRow = document.getElementById('portfolioSellForm');
    if (!sel && !quickSel) return;

    const entries = Object.entries(portfolio.holdings || {}).filter(function (e) {
      return e[1] && Number(e[1].quantity) > 0;
    });

    if (sel) sel.innerHTML = '';
    if (quickSel) quickSel.innerHTML = '';
    if (entries.length === 0) {
      if (sel) {
        var opt0 = document.createElement('option');
        opt0.value = '';
        opt0.textContent = '보유 종목 없음';
        sel.appendChild(opt0);
        sel.disabled = true;
      }
      if (quickSel) {
        var q0 = document.createElement('option');
        q0.value = '';
        q0.textContent = '보유 종목 없음';
        quickSel.appendChild(q0);
        quickSel.disabled = true;
      }
      if (btn) btn.disabled = true;
      if (quickBtn) quickBtn.disabled = true;
      if (emptyHint) emptyHint.hidden = false;
      if (formRow) formRow.classList.add('is-disabled');
      return;
    }

    if (emptyHint) emptyHint.hidden = true;
    if (formRow) formRow.classList.remove('is-disabled');

    entries.forEach(function ([stock, data]) {
      var q = Number(data.quantity) || 0;
      var txt = stock + ' (' + q.toLocaleString() + '주)';
      if (sel) {
        var opt = document.createElement('option');
        opt.value = stock;
        opt.textContent = txt;
        sel.appendChild(opt);
      }
      if (quickSel) {
        var qopt = document.createElement('option');
        qopt.value = stock;
        qopt.textContent = txt;
        quickSel.appendChild(qopt);
      }
    });
    if (sel) sel.disabled = false;
    if (quickSel) quickSel.disabled = false;
    if (btn) btn.disabled = false;
    if (quickBtn) quickBtn.disabled = false;
    if (quickSel && quickSel.options.length > 0) {
      var qEl = document.getElementById('tradeSellQuantity');
      var pEl = document.getElementById('tradeSellLimitPrice');
      var picked = portfolio.holdings[quickSel.value];
      if (picked) {
        if (qEl) qEl.max = String(Number(picked.quantity || 0));
        if (pEl && !pEl.value) {
          var cp = Number(picked.currentPrice || 0);
          if (cp > 0) pEl.value = String(Math.round(cp));
        }
      }
    }
  }

  window.openSellFromAssetPanel = function () {
    var sel = document.getElementById('sellHoldingSelect');
    if (!sel || sel.disabled) return;
    var key = sel.value;
    if (!key) return;
    openSellModalFromHoldingKey(key);
  };

  var simHoldingDetailState = {
    key: '',
    code: '',
    name: '',
    range: '1d',
    quotePrice: 0,
    quoteVolume: null,
    quoteTradedValue: null,
    optionsAiLoadedCode: '',
    optionsAiText: '',
  };
  var simHoldingChartInstance = null;
  var simHoldingChartFetchAbort = null;
  var simHoldingChartResizeObs = null;
  var simHoldingFundChartInstance = null;
  var simHoldingFundResizeObs = null;
  var simHoldingSheetTab = 'chart';
  var simHoldingInfoMetric = 'per';
  var simStockDetailCache = Object.create(null);
  var SIM_STOCK_DETAIL_TTL_MS = 120000;
  var simHoldingInfoLastDetail = null;
  var simHoldingInfoFetchAbort = null;
  var simHoldingQuoteFetchAbort = null;
  var simHoldingOptionsFetchAbort = null;
  var _simHistoryLayoutHooksBound = false;

  function disconnectSimHoldingChartResize() {
    if (simHoldingChartResizeObs) {
      try {
        simHoldingChartResizeObs.disconnect();
      } catch (_) { /* ignore */ }
      simHoldingChartResizeObs = null;
    }
  }

  function destroySimHoldingChart() {
    disconnectSimHoldingChartResize();
    var leg = document.getElementById('simHoldingChartOhlcLegend');
    if (leg) {
      leg.hidden = true;
      leg.innerHTML = '';
    }
    if (simHoldingChartInstance) {
      try {
        simHoldingChartInstance.remove();
      } catch (_) { /* ignore */ }
      simHoldingChartInstance = null;
    }
  }

  function disconnectSimHoldingFundResize() {
    if (simHoldingFundResizeObs) {
      try {
        simHoldingFundResizeObs.disconnect();
      } catch (_) { /* ignore */ }
      simHoldingFundResizeObs = null;
    }
  }

  function destroySimHoldingFundChart() {
    disconnectSimHoldingFundResize();
    if (simHoldingFundChartInstance) {
      try {
        simHoldingFundChartInstance.remove();
      } catch (_) { /* ignore */ }
      simHoldingFundChartInstance = null;
    }
    var fc = document.getElementById('simHoldingFundamentalsChart');
    if (fc) fc.innerHTML = '';
  }

  function triggerSimHoldingChartResize() {
    var container = document.getElementById('simHoldingStockChart');
    if (!simHoldingChartInstance || !container || container.style.display === 'none') return;
    var nh = simHoldingChartPixelHeight(container);
    simHoldingChartInstance.applyOptions({
      width: container.clientWidth,
      height: nh,
    });
  }

  function quarterColToChartTime(col) {
    var s = String(col || '').trim();
    var m = /^(\d{4})-(\d{2})$/.exec(s);
    if (m) return m[1] + '-' + m[2] + '-01';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return s;
  }

  function formatValuationMultiple(n) {
    if (n == null) return '—';
    var x = Number(n);
    if (!Number.isFinite(x)) return '—';
    return x.toFixed(2) + '배';
  }

  function simHoldingValuationApiLabel() {
    if (simHoldingInfoMetric === 'pbr') return 'PBR';
    if (simHoldingInfoMetric === 'psr') return 'PSR';
    return 'PER';
  }

  function renderSimHoldingValuationBars(vc) {
    var host = document.getElementById('simHoldingPerBars');
    if (!host) return;
    host.innerHTML = '';
    if (!vc || !vc.rows || !vc.rows.length) {
      host.innerHTML = '<div class="sim-holding-per-empty">배수 비교 데이터가 없습니다.</div>';
      return;
    }
    var apiLabel = simHoldingValuationApiLabel();
    var row = vc.rows.find(function (r) { return r && String(r.label) === apiLabel; });
    if (!row) {
      host.innerHTML =
        '<div class="sim-holding-per-empty">' + escapeHtml(apiLabel) + ' 데이터가 없습니다.</div>';
      return;
    }
    var v = row.value;
    var avg = row.industry_avg;
    if (v == null && avg == null) {
      host.innerHTML =
        '<div class="sim-holding-per-empty">' +
        escapeHtml(apiLabel) +
        ' 수치를 표시할 수 없습니다.</div>';
      return;
    }
    var max = Math.max(
      v != null && Number.isFinite(Number(v)) ? Math.abs(Number(v)) : 0,
      avg != null && Number.isFinite(Number(avg)) ? Math.abs(Number(avg)) : 0,
      1e-6
    );
    function barPct(num) {
      if (num == null || !Number.isFinite(Number(num))) return 0;
      return Math.min(100, Math.round((Math.abs(Number(num)) / max) * 100));
    }
    var sp = barPct(v);
    var ap = barPct(avg);
    host.innerHTML =
      '<div class="sim-holding-per-row">' +
        '<div class="sim-holding-per-label"><span>이 종목</span><span>' + formatValuationMultiple(v) + '</span></div>' +
        '<div class="sim-holding-per-track"><div class="sim-holding-per-fill sim-holding-per-fill--stock" style="width:' + sp + '%"></div></div>' +
      '</div>' +
      '<div class="sim-holding-per-row">' +
        '<div class="sim-holding-per-label"><span>업종 평균</span><span>' + formatValuationMultiple(avg) + '</span></div>' +
        '<div class="sim-holding-per-track"><div class="sim-holding-per-fill sim-holding-per-fill--avg" style="width:' + ap + '%"></div></div>' +
      '</div>';
  }

  function renderSimHoldingFundLine(rowLabel, detail) {
    var container = document.getElementById('simHoldingFundamentalsChart');
    var foot = document.getElementById('simHoldingFundFootnote');
    destroySimHoldingFundChart();
    if (!container || typeof LightweightCharts === 'undefined') {
      if (foot) foot.textContent = '차트 라이브러리를 불러오지 못했습니다.';
      return;
    }
    var perf = detail && detail.financials && detail.financials.performance;
    if (!perf || !perf.rows || !perf.columns) {
      if (foot) foot.textContent = '이 종목은 분기 실적 그래프를 불러오지 못했습니다.';
      return;
    }
    var row = perf.rows.find(function (r) { return r && r.label === rowLabel; });
    if (!row || !row.values) {
      if (foot) foot.textContent = '이 종목은 분기 실적 그래프를 불러오지 못했습니다.';
      return;
    }
    var points = [];
    for (var i = 0; i < perf.columns.length; i++) {
      var val = row.values[i];
      if (val == null || !Number.isFinite(Number(val))) continue;
      points.push({
        time: quarterColToChartTime(perf.columns[i]),
        value: Number(val),
      });
    }
    points.sort(function (a, b) {
      return String(a.time).localeCompare(String(b.time));
    });
    if (points.length === 0) {
      if (foot) foot.textContent = '이 종목은 분기 실적 그래프를 불러오지 못했습니다.';
      return;
    }
    var cur = (detail.meta && detail.meta.currency) ? String(detail.meta.currency) : 'KRW';
    if (foot) foot.textContent = rowLabel + ' 분기 추이 · 단위 ' + cur;

    var chartH = Math.max(200, container.clientHeight || 240);
    simHoldingFundChartInstance = LightweightCharts.createChart(container, {
      width: container.clientWidth || 400,
      height: chartH,
      layout: {
        background: { color: 'transparent' },
        textColor: '#6b7280',
      },
      grid: {
        vertLines: { color: 'rgba(0,0,0,0.06)' },
        horzLines: { color: 'rgba(0,0,0,0.06)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(0,0,0,0.08)',
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
      timeScale: { borderColor: 'rgba(0,0,0,0.08)' },
    });
    var line = simHoldingFundChartInstance.addLineSeries({
      color: rowLabel === '매출' ? '#2563eb' : '#059669',
      lineWidth: 2,
      priceLineVisible: false,
    });
    line.setData(points);
    simHoldingFundChartInstance.timeScale().fitContent();

    disconnectSimHoldingFundResize();
    simHoldingFundResizeObs = new ResizeObserver(function () {
      if (simHoldingFundChartInstance && container) {
        var nh = Math.max(200, container.clientHeight || 240);
        simHoldingFundChartInstance.applyOptions({
          width: container.clientWidth,
          height: nh,
        });
      }
    });
    simHoldingFundResizeObs.observe(container);
  }

  function renderSimHoldingInfoEmpty(msg) {
    var sk = document.getElementById('simHoldingInfoSkeleton');
    var note = document.getElementById('simHoldingInfoNote');
    if (sk) sk.style.display = 'none';
    if (note) {
      note.style.display = '';
      note.textContent = msg || '';
    }
    var pb = document.getElementById('simHoldingPerBars');
    if (pb) pb.innerHTML = '';
  }

  function applySimHoldingInfoMetricUI() {
    var perB = document.getElementById('simHoldingPerBlock');
    var fundB = document.getElementById('simHoldingFundBlock');
    var isValuation =
      simHoldingInfoMetric === 'per' ||
      simHoldingInfoMetric === 'pbr' ||
      simHoldingInfoMetric === 'psr';
    if (perB) perB.style.display = isValuation ? '' : 'none';
    if (fundB) fundB.style.display = isValuation ? 'none' : '';
    if (isValuation) {
      destroySimHoldingFundChart();
      var foot = document.getElementById('simHoldingFundFootnote');
      if (foot) foot.textContent = '';
      if (simHoldingInfoLastDetail && simHoldingInfoLastDetail.valuation_comparison) {
        renderSimHoldingValuationBars(simHoldingInfoLastDetail.valuation_comparison);
      }
    } else if (simHoldingInfoLastDetail) {
      renderSimHoldingFundLine(simHoldingInfoMetric === 'net' ? '순이익' : '매출', simHoldingInfoLastDetail);
    }
  }

  function setSimHoldingInfoMetric(metric) {
    if (metric === 'net' || metric === 'revenue') {
      simHoldingInfoMetric = metric;
    } else if (metric === 'pbr' || metric === 'psr') {
      simHoldingInfoMetric = metric;
    } else {
      simHoldingInfoMetric = 'per';
    }
    document.querySelectorAll('.sim-holding-metric-btn').forEach(function (b) {
      var on = b.getAttribute('data-sim-metric') === simHoldingInfoMetric;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    applySimHoldingInfoMetricUI();
  }

  function renderSimHoldingInfoFromDetail(detail) {
    var note = document.getElementById('simHoldingInfoNote');
    if (note) {
      note.style.display = 'none';
      note.textContent = '';
    }
    applySimHoldingInfoMetricUI();
  }

  function loadSimHoldingStockDetailIfNeeded() {
    if (simHoldingSheetTab !== 'info') return;
    var code = simHoldingDetailState.code != null ? String(simHoldingDetailState.code).trim() : '';
    if (!/^\d{6}$/.test(code)) {
      renderSimHoldingInfoEmpty('6자리 종목 코드가 없어 종목정보를 불러올 수 없습니다.');
      return;
    }
    var name = simHoldingDetailState.name != null ? String(simHoldingDetailState.name).trim() : '';
    var cacheKey = code;
    var now = Date.now();
    var cached = simStockDetailCache[cacheKey];
    if (cached && (now - cached.atMs) < SIM_STOCK_DETAIL_TTL_MS) {
      simHoldingInfoLastDetail = cached.data;
      renderSimHoldingInfoFromDetail(cached.data);
      return;
    }
    if (simHoldingInfoFetchAbort) {
      try {
        simHoldingInfoFetchAbort.abort();
      } catch (_) { /* ignore */ }
    }
    simHoldingInfoFetchAbort = new AbortController();
    var signal = simHoldingInfoFetchAbort.signal;
    var sk = document.getElementById('simHoldingInfoSkeleton');
    var noteEl = document.getElementById('simHoldingInfoNote');
    if (sk) sk.style.display = '';
    if (noteEl) {
      noteEl.style.display = 'none';
      noteEl.textContent = '';
    }

    fetch(
      simApiBase() + '/api/stock-detail/' + encodeURIComponent(code) + '?name=' + encodeURIComponent(name),
      { credentials: 'include', signal: signal }
    )
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (simHoldingSheetTab !== 'info') return;
        if (sk) sk.style.display = 'none';
        if (!data.success || !data.detail) {
          renderSimHoldingInfoEmpty(data.message || '종목정보를 불러오지 못했습니다.');
          return;
        }
        simStockDetailCache[cacheKey] = { atMs: Date.now(), data: data.detail };
        simHoldingInfoLastDetail = data.detail;
        renderSimHoldingInfoFromDetail(data.detail);
      })
      .catch(function (e) {
        if (e.name === 'AbortError') return;
        if (sk) sk.style.display = 'none';
        renderSimHoldingInfoEmpty('종목정보 요청 중 오류가 발생했습니다.');
      });
  }

  function clearSimHoldingQuoteExtras() {
    var exec = document.getElementById('simHoldingQuoteExec');
    var disc = document.getElementById('simHoldingQuoteDisclaimer');
    if (exec) {
      exec.hidden = true;
      exec.classList.remove(
        'sim-holding-quote-exec--sell',
        'sim-holding-quote-exec--buy',
        'sim-holding-quote-exec--neutral',
        'sim-holding-quote-exec--high',
        'sim-holding-quote-exec--mid',
        'sim-holding-quote-exec--low',
      );
    }
    if (disc) {
      disc.hidden = true;
      disc.textContent = '';
    }
    var hi = document.getElementById('simHoldingQuoteDayHigh');
    var lo = document.getElementById('simHoldingQuoteDayLow');
    if (hi) hi.textContent = '—';
    if (lo) lo.textContent = '—';
    var pctEl = document.getElementById('simHoldingQuoteExecPct');
    var capEl = document.getElementById('simHoldingQuoteExecCaption');
    if (pctEl) pctEl.textContent = '—';
    if (capEl) capEl.textContent = '';
    var volSide = document.getElementById('simHoldingQuoteVolSide');
    if (volSide) {
      volSide.textContent = '';
      volSide.hidden = true;
      volSide.classList.remove(
        'sim-holding-quote-stat-side--up',
        'sim-holding-quote-stat-side--down',
        'sim-holding-quote-stat-side--flat',
      );
    }
    var rankSide = document.getElementById('simHoldingQuoteRankSide');
    if (rankSide) {
      rankSide.innerHTML = '';
      rankSide.hidden = true;
    }
  }

  function applySimHoldingQuoteFromDetail(data) {
    if (!data || !data.success) return;
    var dh = document.getElementById('simHoldingQuoteDayHigh');
    var dl = document.getElementById('simHoldingQuoteDayLow');
    var dhi = Number(data.day_high);
    var dlo = Number(data.day_low);
    if (dh) dh.textContent = Number.isFinite(dhi) && dhi > 0 ? formatCurrency(dhi) : '—';
    if (dl) dl.textContent = Number.isFinite(dlo) && dlo > 0 ? formatCurrency(dlo) : '—';

    var exec = document.getElementById('simHoldingQuoteExec');
    var pctEl = document.getElementById('simHoldingQuoteExecPct');
    var capEl = document.getElementById('simHoldingQuoteExecCaption');
    var disc = document.getElementById('simHoldingQuoteDisclaimer');
    var ep = Number(data.exec_strength_pct);
    if (exec) {
      exec.hidden = false;
      exec.classList.remove(
        'sim-holding-quote-exec--sell',
        'sim-holding-quote-exec--buy',
        'sim-holding-quote-exec--neutral',
        'sim-holding-quote-exec--high',
        'sim-holding-quote-exec--mid',
        'sim-holding-quote-exec--low',
      );
      if (Number.isFinite(ep)) {
        if (ep >= 70) exec.classList.add('sim-holding-quote-exec--high');
        else if (ep >= 45) exec.classList.add('sim-holding-quote-exec--mid');
        else exec.classList.add('sim-holding-quote-exec--low');
      } else {
        exec.classList.add('sim-holding-quote-exec--mid');
      }
    }
    if (pctEl) pctEl.textContent = Number.isFinite(ep) ? String(Math.round(ep)) + '%' : '—';
    if (capEl) capEl.textContent = data.exec_strength_caption != null ? String(data.exec_strength_caption) : '';
    if (disc) {
      var dq = data.disclaimer != null ? String(data.disclaimer).trim() : '';
      if (dq) {
        disc.textContent = dq;
        disc.hidden = false;
      } else {
        disc.textContent = '';
        disc.hidden = true;
      }
    }

    var volSide = document.getElementById('simHoldingQuoteVolSide');
    if (volSide) {
      var ratioVol = data.volume_vs_prev_ratio;
      var rv = ratioVol != null ? Number(ratioVol) : NaN;
      volSide.classList.remove(
        'sim-holding-quote-stat-side--up',
        'sim-holding-quote-stat-side--down',
        'sim-holding-quote-stat-side--flat',
      );
      if (Number.isFinite(rv) && rv >= 0) {
        var chg = (rv - 1) * 100;
        var sign = chg > 0 ? '+' : '';
        volSide.textContent = '전일대비 ' + sign + chg.toFixed(0) + '%';
        volSide.hidden = false;
        if (chg > 0) volSide.classList.add('sim-holding-quote-stat-side--up');
        else if (chg < 0) volSide.classList.add('sim-holding-quote-stat-side--down');
        else volSide.classList.add('sim-holding-quote-stat-side--flat');
      } else {
        volSide.textContent = '';
        volSide.hidden = true;
      }
    }

    var rankSide = document.getElementById('simHoldingQuoteRankSide');
    if (rankSide) {
      var ir = Number(data.traded_value_rank);
      var it = Number(data.traded_value_rank_total);
      if (Number.isFinite(ir) && ir > 0) {
        rankSide.hidden = false;
        var ri = Math.round(ir);
        var numCls = 'sim-holding-quote-rank-num';
        if (ri === 1) numCls += ' sim-holding-quote-rank-num--gold';
        else if (ri === 2) numCls += ' sim-holding-quote-rank-num--silver';
        else if (ri === 3) numCls += ' sim-holding-quote-rank-num--bronze';
        var tail = '';
        if (Number.isFinite(it) && it > 0) {
          tail =
            '<span class="sim-holding-quote-rank-sep">/</span><span class="sim-holding-quote-rank-total">' +
            String(Math.round(it)) +
            '</span>';
        }
        rankSide.innerHTML =
          '<span class="' +
          numCls +
          '">' +
          String(ri) +
          '</span><span class="sim-holding-quote-rank-suffix">위</span>' +
          tail;
      } else {
        rankSide.innerHTML = '';
        rankSide.hidden = true;
      }
    }
  }

  function resetSimHoldingQuoteUi() {
    if (simHoldingQuoteFetchAbort) {
      try {
        simHoldingQuoteFetchAbort.abort();
      } catch (_) { /* ignore */ }
      simHoldingQuoteFetchAbort = null;
    }
    var block = document.getElementById('simHoldingQuoteBlock');
    var sk = document.getElementById('simHoldingQuoteSkeleton');
    var note = document.getElementById('simHoldingQuoteNote');
    var volEl = document.getElementById('simHoldingQuoteVolume');
    var tvEl = document.getElementById('simHoldingQuoteTradedValue');
    if (block) block.hidden = true;
    if (sk) {
      sk.style.display = 'none';
      sk.textContent = '시세 불러오는 중…';
    }
    if (note) {
      note.style.display = 'none';
      note.textContent = '';
    }
    if (volEl) volEl.textContent = '—';
    if (tvEl) tvEl.textContent = '—';
    clearSimHoldingQuoteExtras();
  }

  function loadSimHoldingQuoteIfNeeded() {
    if (simHoldingSheetTab !== 'order') return;
    var st = simHoldingDetailState;
    var rawCode = st.code != null ? String(st.code).trim() : '';
    var chartCode = /^\d{6}$/.test(rawCode) ? rawCode : isSixDigitCode(st.key) ? String(st.key).trim() : '';

    function showQuoteStats(vol, tv) {
      var block = document.getElementById('simHoldingQuoteBlock');
      var sk = document.getElementById('simHoldingQuoteSkeleton');
      var note = document.getElementById('simHoldingQuoteNote');
      var volEl = document.getElementById('simHoldingQuoteVolume');
      var tvEl = document.getElementById('simHoldingQuoteTradedValue');
      if (note) {
        note.style.display = 'none';
        note.textContent = '';
      }
      if (sk) sk.style.display = 'none';
      if (block) block.hidden = false;
      if (volEl) volEl.textContent = formatLargeNumber(Number(vol) || 0);
      if (tvEl) tvEl.textContent = formatLargeCurrency(Number(tv) || 0);
      var volSide2 = document.getElementById('simHoldingQuoteVolSide');
      var rankSide2 = document.getElementById('simHoldingQuoteRankSide');
      if (volSide2) {
        volSide2.textContent = '';
        volSide2.hidden = true;
        volSide2.classList.remove(
          'sim-holding-quote-stat-side--up',
          'sim-holding-quote-stat-side--down',
          'sim-holding-quote-stat-side--flat',
        );
      }
      if (rankSide2) {
        rankSide2.innerHTML = '';
        rankSide2.hidden = true;
      }
    }

    function showQuoteError(msg) {
      var block = document.getElementById('simHoldingQuoteBlock');
      var sk = document.getElementById('simHoldingQuoteSkeleton');
      var note = document.getElementById('simHoldingQuoteNote');
      if (block) block.hidden = true;
      if (sk) sk.style.display = 'none';
      clearSimHoldingQuoteExtras();
      if (note) {
        note.style.display = '';
        note.textContent = msg || '';
      }
    }

    function fetchRankFallback() {
      clearSimHoldingQuoteExtras();
      return fetch(
        simApiBase() + '/api/mock/traded-value-rank?limit=50&q=' + encodeURIComponent(chartCode),
        { signal: signal },
      )
        .then(function (res) {
          return res.json().catch(function () {
            return {};
          });
        })
        .then(function (data) {
          if (simHoldingSheetTab !== 'order') return;
          if (signal.aborted) return;
          if (!data.success || !Array.isArray(data.items)) {
            if (!hasPreview) {
              showQuoteError(data.message || '시세 조회 실패');
            }
            return;
          }
          var match = null;
          for (var i = 0; i < data.items.length; i++) {
            if (String(data.items[i].code || '').trim() === chartCode) {
              match = data.items[i];
              break;
            }
          }
          if (!match) {
            if (!hasPreview) {
              showQuoteError('시세 정보를 찾지 못했습니다.');
            }
            return;
          }
          var v = Number(match.volume || 0);
          var tv = Number(match.traded_value || 0);
          st.quoteVolume = v;
          st.quoteTradedValue = tv;
          showQuoteStats(v, tv);
        })
        .catch(function () {
          if (!hasPreview) {
            showQuoteError('시세를 불러오지 못했습니다.');
          }
        });
    }

    if (!chartCode) {
      showQuoteError('6자리 종목 코드가 없어 시세를 불러올 수 없습니다.');
      return;
    }

    var volPre = Number(st.quoteVolume);
    var tvPre = Number(st.quoteTradedValue);
    var hasPreview = Number.isFinite(volPre) && Number.isFinite(tvPre);
    if (hasPreview) {
      showQuoteStats(volPre, tvPre);
    } else {
      var block0 = document.getElementById('simHoldingQuoteBlock');
      var sk0 = document.getElementById('simHoldingQuoteSkeleton');
      var note0 = document.getElementById('simHoldingQuoteNote');
      if (block0) block0.hidden = true;
      if (note0) {
        note0.style.display = 'none';
        note0.textContent = '';
      }
      if (sk0) sk0.style.display = '';
    }

    if (simHoldingQuoteFetchAbort) {
      try {
        simHoldingQuoteFetchAbort.abort();
      } catch (_) { /* ignore */ }
    }
    var ac = new AbortController();
    simHoldingQuoteFetchAbort = ac;
    var signal = ac.signal;

    fetch(simApiBase() + '/api/mock/sim-holding-quote-detail/' + encodeURIComponent(chartCode), {
      signal: signal,
    })
      .then(function (res) {
        return res.json().catch(function () {
          return {};
        });
      })
      .then(function (data) {
        if (simHoldingSheetTab !== 'order') return;
        if (signal.aborted) return;
        if (data && data.success && data.code) {
          var v = Number(data.volume || 0);
          var tv = Number(data.traded_value || 0);
          st.quoteVolume = v;
          st.quoteTradedValue = tv;
          showQuoteStats(v, tv);
          applySimHoldingQuoteFromDetail(data);
          return;
        }
        return fetchRankFallback();
      })
      .catch(function (e) {
        if (e.name === 'AbortError') return undefined;
        if (simHoldingSheetTab !== 'order') return undefined;
        return fetchRankFallback();
      })
      .finally(function () {
        if (simHoldingQuoteFetchAbort === ac) {
          simHoldingQuoteFetchAbort = null;
        }
      });
  }

  function resetSimHoldingOptionsAiUi() {
    if (simHoldingOptionsFetchAbort) {
      try {
        simHoldingOptionsFetchAbort.abort();
      } catch (_) { /* ignore */ }
      simHoldingOptionsFetchAbort = null;
    }
    simHoldingDetailState.optionsAiLoadedCode = '';
    simHoldingDetailState.optionsAiText = '';
    var sk = document.getElementById('simHoldingOptionsAiSkeleton');
    var note = document.getElementById('simHoldingOptionsAiNote');
    var tx = document.getElementById('simHoldingOptionsAiText');
    if (sk) {
      sk.style.display = 'none';
      sk.textContent = '종목 의견 불러오는 중…';
    }
    if (note) {
      note.style.display = 'none';
      note.textContent = '';
    }
    if (tx) {
      tx.textContent = '';
      tx.innerHTML = '';
      tx.hidden = true;
    }
  }

  function loadSimHoldingOptionsAiIfNeeded() {
    if (simHoldingSheetTab !== 'options') return;
    var st = simHoldingDetailState;
    var rawCode = st.code != null ? String(st.code).trim() : '';
    var chartCode = /^\d{6}$/.test(rawCode) ? rawCode : isSixDigitCode(st.key) ? String(st.key).trim() : '';
    var sk = document.getElementById('simHoldingOptionsAiSkeleton');
    var note = document.getElementById('simHoldingOptionsAiNote');
    var tx = document.getElementById('simHoldingOptionsAiText');

    function showOptsAiError(msg) {
      if (sk) sk.style.display = 'none';
      if (tx) {
        tx.textContent = '';
        tx.innerHTML = '';
        tx.hidden = true;
      }
      if (note) {
        note.style.display = '';
        note.textContent = msg || '';
      }
    }

    function showOptsAiText(text) {
      if (sk) sk.style.display = 'none';
      if (note) {
        note.style.display = 'none';
        note.textContent = '';
      }
      if (tx) {
        var html = renderSimHoldingImportantSummaryHtml(text);
        tx.textContent = '';
        tx.innerHTML = html;
        tx.hidden = !html;
      }
    }

    if (!chartCode) {
      showOptsAiError('6자리 종목 코드가 없어 의견을 불러올 수 없습니다.');
      return;
    }

    if (st.optionsAiLoadedCode === chartCode && String(st.optionsAiText || '').trim()) {
      showOptsAiText(st.optionsAiText);
      return;
    }

    if (simHoldingOptionsFetchAbort) {
      try {
        simHoldingOptionsFetchAbort.abort();
      } catch (_) { /* ignore */ }
    }
    var ac = new AbortController();
    simHoldingOptionsFetchAbort = ac;
    var signal = ac.signal;

    if (sk) sk.style.display = '';
    if (note) {
      note.style.display = 'none';
      note.textContent = '';
    }
    if (tx) {
      tx.textContent = '';
      tx.innerHTML = '';
      tx.hidden = true;
    }

    var dispName = st.name != null ? String(st.name).trim() : '';
    fetch(simApiBase() + '/api/mock/sim-options-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: chartCode, name: dispName }),
      signal: signal,
    })
      .then(function (res) {
        return res.json().catch(function () {
          return {};
        });
      })
      .then(function (data) {
        if (simHoldingSheetTab !== 'options') return;
        if (signal.aborted) return;
        if (data && data.success && data.text) {
          var t = String(data.text).trim();
          st.optionsAiLoadedCode = chartCode;
          st.optionsAiText = t;
          showOptsAiText(t);
          return;
        }
        showOptsAiError(
          (data && data.message) || 'AI 의견을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
        );
      })
      .catch(function (e) {
        if (e.name === 'AbortError') return undefined;
        if (simHoldingSheetTab !== 'options') return undefined;
        showOptsAiError('AI 의견을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      })
      .finally(function () {
        if (simHoldingOptionsFetchAbort === ac) {
          simHoldingOptionsFetchAbort = null;
        }
      });
  }

  function setSimHoldingSheetTab(tab, silent) {
    var valid = { chart: 1, info: 1, history: 1, order: 1, options: 1 };
    var t = valid[tab] ? tab : 'chart';
    simHoldingSheetTab = t;
    if (t !== 'options' && simHoldingOptionsFetchAbort) {
      try {
        simHoldingOptionsFetchAbort.abort();
      } catch (_) { /* ignore */ }
      simHoldingOptionsFetchAbort = null;
    }
    document.querySelectorAll('.sim-holding-sheet-tab').forEach(function (btn) {
      var id = btn.getAttribute('data-sim-holding-tab');
      var on = id === t;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var pc = document.getElementById('simHoldingPanelChart');
    var pi = document.getElementById('simHoldingPanelInfo');
    var ph = document.getElementById('simHoldingPanelHistory');
    var pord = document.getElementById('simHoldingPanelOrder');
    var po = document.getElementById('simHoldingPanelOptions');
    if (pc) pc.toggleAttribute('hidden', t !== 'chart');
    if (pi) pi.toggleAttribute('hidden', t !== 'info');
    if (ph) ph.toggleAttribute('hidden', t !== 'history');
    if (pord) pord.toggleAttribute('hidden', t !== 'order');
    if (po) po.toggleAttribute('hidden', t !== 'options');

    if (t === 'history') {
      expandSimStockHistoryForTab();
    } else {
      collapseSimStockHistoryPanel();
    }

    if (t === 'chart' && !silent) {
      triggerSimHoldingChartResize();
      requestAnimationFrame(triggerSimHoldingChartResize);
    } else if (t === 'info' && !silent) {
      loadSimHoldingStockDetailIfNeeded();
    } else if (t === 'order' && !silent) {
      loadSimHoldingQuoteIfNeeded();
    } else if (t === 'options' && !silent) {
      loadSimHoldingOptionsAiIfNeeded();
    }
    if (t !== 'info') {
      destroySimHoldingFundChart();
    }
  }

  function resetSimHoldingDetailUi() {
    simHoldingInfoMetric = 'per';
    document.querySelectorAll('.sim-holding-metric-btn').forEach(function (b) {
      var on = b.getAttribute('data-sim-metric') === 'per';
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var perB = document.getElementById('simHoldingPerBlock');
    var fundB = document.getElementById('simHoldingFundBlock');
    if (perB) perB.style.display = '';
    if (fundB) fundB.style.display = 'none';
    simHoldingInfoLastDetail = null;
    var pb = document.getElementById('simHoldingPerBars');
    if (pb) pb.innerHTML = '';
    var sk = document.getElementById('simHoldingInfoSkeleton');
    var note = document.getElementById('simHoldingInfoNote');
    if (sk) sk.style.display = 'none';
    if (note) {
      note.style.display = 'none';
      note.textContent = '';
    }
    var foot = document.getElementById('simHoldingFundFootnote');
    if (foot) foot.textContent = '';
    destroySimHoldingFundChart();
    if (simHoldingInfoFetchAbort) {
      try {
        simHoldingInfoFetchAbort.abort();
      } catch (_) { /* ignore */ }
      simHoldingInfoFetchAbort = null;
    }
    resetSimHoldingQuoteUi();
    resetSimHoldingOptionsAiUi();
    setSimHoldingSheetTab('chart', true);
  }

  function syncSimHoldingDetailLogo(codeForLogo, displayName) {
    var J = window.JurinStockLogos;
    var img = document.getElementById('simHoldingDetailLogoImg');
    var ph = document.getElementById('simHoldingDetailLogoPh');
    if (!img || !ph) return;
    if (!J) {
      img.style.display = 'none';
      ph.style.display = 'flex';
      ph.textContent = (displayName && String(displayName).trim().charAt(0)) || '?';
      return;
    }
    var url = J.stockLogoUrlForCode(codeForLogo);
    if (url) {
      var fileCode = J.resolveStockLogoFileCode(codeForLogo);
      img.classList.remove('stock-logo-img--squareish');
      if (fileCode) img.setAttribute('data-logo-file', fileCode);
      else img.removeAttribute('data-logo-file');
      img.src = url;
      img.style.display = 'block';
      ph.style.display = 'none';
      ph.textContent = '';
      J.bindStockLogoIntrinsicFit(img);
    } else {
      img.removeAttribute('src');
      img.removeAttribute('data-logo-file');
      img.classList.remove('stock-logo-img--squareish');
      img.style.display = 'none';
      ph.style.display = 'flex';
      ph.textContent = (displayName && String(displayName).trim().charAt(0)) || '?';
    }
  }

  function collapseSimStockHistoryPanel() {
    var panel = document.getElementById('simHoldingStockHistoryPanel');
    if (panel) panel.setAttribute('hidden', '');
    var el = document.getElementById('simStockHistoryList');
    if (el) el.innerHTML = '';
  }

  function expandSimStockHistoryForTab() {
    var panel = document.getElementById('simHoldingStockHistoryPanel');
    if (!panel) return;
    panel.removeAttribute('hidden');
    renderSimHoldingStockHistory();
    requestAnimationFrame(function () {
      syncSimHistoryPanelHeightCap();
      requestAnimationFrame(syncSimHistoryPanelHeightCap);
    });
  }

  /** 차트·리사이저 아래 뷰포트 여유만큼 거래내역 최대 높이 (시트가 auto 높이일 때도 유효) */
  function computeSimHistoryMaxHeightPx() {
    var panel = document.getElementById('simHoldingStockHistoryPanel');
    if (!panel || panel.hasAttribute('hidden')) {
      return Math.min(560, Math.floor(window.innerHeight * 0.65));
    }
    var host = document.getElementById('simHoldingPanelHistory');
    var top = 0;
    if (host && !host.hasAttribute('hidden')) {
      top = host.getBoundingClientRect().top;
    } else {
      top = panel.getBoundingClientRect().top;
    }
    var margin = 36;
    var room = window.innerHeight - top - margin;
    var winCap = Math.min(560, Math.floor(window.innerHeight * 0.65));
    return Math.max(160, Math.min(winCap, room));
  }

  function syncSimHistoryPanelHeightCap() {
    var panel = document.getElementById('simHoldingStockHistoryPanel');
    if (!panel || panel.hasAttribute('hidden')) return;
    var maxPx = computeSimHistoryMaxHeightPx();
    panel.style.setProperty('--sim-history-max', maxPx + 'px');
    var prefStr = panel.style.getPropertyValue('--sim-history-h').trim();
    var pref = prefStr ? parseFloat(prefStr) : NaN;
    if (!Number.isFinite(pref) || pref < 1) pref = 260;
    var capped = Math.max(140, Math.min(pref, maxPx));
    panel.style.setProperty('--sim-history-h', capped + 'px');
  }

  function initSimHistoryPanelResizer() {
    if (_simHistoryLayoutHooksBound) return;
    _simHistoryLayoutHooksBound = true;
    var mainEl = document.querySelector('.sim-holding-detail-main');
    if (mainEl && typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function () {
        syncSimHistoryPanelHeightCap();
      });
      ro.observe(mainEl);
    }
    window.addEventListener('resize', function () {
      syncSimHistoryPanelHeightCap();
    });
  }

  function closeSimHoldingDetailSheet() {
    var sheet = document.getElementById('simHoldingDetailSheet');
    if (!sheet) return;
    sheet.setAttribute('hidden', '');
    sheet.setAttribute('aria-hidden', 'true');
    if (simHoldingChartFetchAbort) {
      try {
        simHoldingChartFetchAbort.abort();
      } catch (_) { /* ignore */ }
      simHoldingChartFetchAbort = null;
    }
    if (simHoldingInfoFetchAbort) {
      try {
        simHoldingInfoFetchAbort.abort();
      } catch (_) { /* ignore */ }
      simHoldingInfoFetchAbort = null;
    }
    if (simHoldingQuoteFetchAbort) {
      try {
        simHoldingQuoteFetchAbort.abort();
      } catch (_) { /* ignore */ }
      simHoldingQuoteFetchAbort = null;
    }
    if (simHoldingOptionsFetchAbort) {
      try {
        simHoldingOptionsFetchAbort.abort();
      } catch (_) { /* ignore */ }
      simHoldingOptionsFetchAbort = null;
    }
    destroySimHoldingChart();
    destroySimHoldingFundChart();
    setSimHoldingSheetTab('chart', true);
    var sk = document.getElementById('simHoldingChartSkeleton');
    var note = document.getElementById('simHoldingChartNote');
    var cd = document.getElementById('simHoldingStockChart');
    var wrap = document.getElementById('simHoldingChartWrap');
    var ohlcLegend = document.getElementById('simHoldingChartOhlcLegend');
    if (sk) {
      sk.style.display = '';
      sk.textContent = '차트 불러오는 중…';
    }
    if (note) note.style.display = 'none';
    if (wrap) wrap.style.display = 'none';
    if (ohlcLegend) {
      ohlcLegend.hidden = true;
      ohlcLegend.innerHTML = '';
    }
    if (cd) cd.style.display = '';
    resetSimHoldingQuoteUi();
    resetSimHoldingOptionsAiUi();
    simHoldingDetailState = {
      key: '',
      code: '',
      name: '',
      range: '1d',
      quotePrice: 0,
      quoteVolume: null,
      quoteTradedValue: null,
      optionsAiLoadedCode: '',
      optionsAiText: '',
    };
    collapseSimStockHistoryPanel();
  }

  function scrollSimHoldingDetailIntoView() {
    var sheet = document.getElementById('simHoldingDetailSheet');
    if (!sheet || sheet.hasAttribute('hidden')) return;
    var card = sheet.closest('.portfolio-section');
    var el = card || sheet;
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (_) { /* ignore */ }
  }

  function openSimStockDetailFromDiscovery(code, price, name, volOpt, tvOpt) {
    var rawCode = code != null ? String(code).trim() : '';
    var chartCode = /^\d{6}$/.test(rawCode) ? rawCode : '';
    var dispName = name != null ? String(name).trim() : '';
    var showName = dispName || chartCode || rawCode || '—';
    var qPrice = Number(price);
    if (!Number.isFinite(qPrice)) qPrice = 0;
    var qv =
      volOpt != null && Number.isFinite(Number(volOpt)) ? Number(volOpt) : null;
    var qtv =
      tvOpt != null && Number.isFinite(Number(tvOpt)) ? Number(tvOpt) : null;
    simHoldingDetailState = {
      key: '',
      code: chartCode || rawCode,
      name: showName,
      range: '1d',
      quotePrice: qPrice,
      quoteVolume: qv,
      quoteTradedValue: qtv,
      optionsAiLoadedCode: '',
      optionsAiText: '',
    };
    resetSimHoldingDetailUi();
    var sheet = document.getElementById('simHoldingDetailSheet');
    if (!sheet) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[모의투자] 종목 상세(#simHoldingDetailSheet)가 없습니다.');
      }
      return;
    }
    document.getElementById('simHoldingDetailName').textContent = showName;
    document.getElementById('simHoldingDetailCode').textContent = chartCode || rawCode || '—';
    syncSimHoldingDetailLogo(chartCode || rawCode, showName);
    collapseSimStockHistoryPanel();

    document.querySelectorAll('.sim-holding-range-btn').forEach(function (b) {
      var on = b.getAttribute('data-range') === '1d';
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    sheet.removeAttribute('hidden');
    sheet.setAttribute('aria-hidden', 'false');
    loadSimHoldingChart(chartCode, '1d');
    scrollSimHoldingDetailIntoView();
    var closeBtn = document.getElementById('simHoldingDetailClose');
    if (closeBtn) {
      try {
        closeBtn.focus();
      } catch (_) { /* ignore */ }
    }
  }

  function openSimHoldingDetailSheet(holdingKey) {
    var rawKey = holdingKey != null ? String(holdingKey).trim() : '';
    var h = rawKey ? portfolio.holdings[rawKey] : null;
    if (!h) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[모의투자] 보유 종목을 찾을 수 없습니다. 키:', rawKey, '보유:', Object.keys(portfolio.holdings || {}));
      }
      return;
    }
    holdingKey = rawKey;
    var rawCode = h.code != null ? String(h.code).trim() : '';
    var code = /^\d{6}$/.test(rawCode) ? rawCode : '';
    var chartCode = code || (isSixDigitCode(holdingKey) ? String(holdingKey).trim() : '');
    var name = holdingKey;
    simHoldingDetailState = {
      key: holdingKey,
      code: code,
      name: name,
      range: '1d',
      quotePrice: Number(h.currentPrice) || 0,
      quoteVolume: null,
      quoteTradedValue: null,
      optionsAiLoadedCode: '',
      optionsAiText: '',
    };
    resetSimHoldingDetailUi();
    var sheet = document.getElementById('simHoldingDetailSheet');
    if (!sheet) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[모의투자] 종목 상세 시트(#simHoldingDetailSheet)가 페이지에 없습니다. simulation.html을 강력 새로고침(Ctrl+Shift+R)했는지 확인하세요.');
      }
      return;
    }
    document.getElementById('simHoldingDetailName').textContent = name;
    document.getElementById('simHoldingDetailCode').textContent = code || '—';
    var logoRef = chartCode || code;
    syncSimHoldingDetailLogo(logoRef, name);
    collapseSimStockHistoryPanel();

    document.querySelectorAll('.sim-holding-range-btn').forEach(function (b) {
      var on = b.getAttribute('data-range') === '1d';
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    sheet.removeAttribute('hidden');
    sheet.setAttribute('aria-hidden', 'false');
    loadSimHoldingChart(chartCode, '1d');
    scrollSimHoldingDetailIntoView();

    var closeBtn = document.getElementById('simHoldingDetailClose');
    if (closeBtn) {
      try {
        closeBtn.focus();
      } catch (_) { /* ignore */ }
    }
  }

  function onSimHoldingRangeClick(btn) {
    var r = btn && btn.getAttribute('data-range');
    if (!r) return;
    document.querySelectorAll('.sim-holding-range-btn').forEach(function (b) {
      var on = b.getAttribute('data-range') === r;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    simHoldingDetailState.range = r;
    var rawCode = simHoldingDetailState.code;
    var chartCode = /^\d{6}$/.test(rawCode) ? rawCode : (isSixDigitCode(simHoldingDetailState.key) ? String(simHoldingDetailState.key).trim() : '');
    loadSimHoldingChart(chartCode, r);
  }

  function loadSimHoldingChart(code, range) {
    var chartDiv = document.getElementById('simHoldingStockChart');
    var chartWrap = document.getElementById('simHoldingChartWrap');
    var ohlcLegend = document.getElementById('simHoldingChartOhlcLegend');
    var skeleton = document.getElementById('simHoldingChartSkeleton');
    var note = document.getElementById('simHoldingChartNote');
    if (!chartDiv || !skeleton || !note) return;

    if (!code) {
      skeleton.style.display = 'none';
      if (chartWrap) chartWrap.style.display = 'none';
      if (ohlcLegend) {
        ohlcLegend.hidden = true;
        ohlcLegend.innerHTML = '';
      }
      note.textContent = '종목 코드가 없어 차트를 불러올 수 없습니다.';
      note.style.display = '';
      destroySimHoldingChart();
      return;
    }

    if (typeof LightweightCharts === 'undefined') {
      skeleton.style.display = 'none';
      if (chartWrap) chartWrap.style.display = 'none';
      if (ohlcLegend) {
        ohlcLegend.hidden = true;
        ohlcLegend.innerHTML = '';
      }
      note.textContent = '차트 라이브러리를 불러오지 못했습니다.';
      note.style.display = '';
      return;
    }

    if (simHoldingChartFetchAbort) {
      try {
        simHoldingChartFetchAbort.abort();
      } catch (_) { /* ignore */ }
    }
    simHoldingChartFetchAbort = new AbortController();
    var signal = simHoldingChartFetchAbort.signal;

    if (chartWrap) chartWrap.style.display = 'none';
    if (ohlcLegend) {
      ohlcLegend.hidden = true;
      ohlcLegend.innerHTML = '';
    }
    chartDiv.style.display = '';
    note.style.display = 'none';
    skeleton.style.display = '';
    destroySimHoldingChart();

    var raw = String(range || '1d').trim().toLowerCase();
    var q = ['1d', '1w', '1m', '1y'].indexOf(raw) >= 0 ? raw : '1d';
    var base = simApiBase();

    fetch(base + '/api/chart-data/' + encodeURIComponent(code) + '?range=' + encodeURIComponent(q), {
      credentials: 'include',
      signal: signal,
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        skeleton.style.display = 'none';
        if (!data.success || !data.candles || data.candles.length === 0) {
          note.textContent = '차트 데이터를 불러올 수 없습니다.';
          note.style.display = '';
          if (chartWrap) chartWrap.style.display = 'none';
          return;
        }
        if (chartWrap) chartWrap.style.display = '';
        chartDiv.style.display = '';
        renderSimHoldingChart(data.candles, data.ma5 || [], data.ma20 || [], data.intraday);
      })
      .catch(function (e) {
        if (e.name === 'AbortError') return;
        skeleton.style.display = 'none';
        note.textContent = '차트 로드 중 오류가 발생했습니다.';
        note.style.display = '';
        var wrapErr = document.getElementById('simHoldingChartWrap');
        if (wrapErr) wrapErr.style.display = 'none';
      });
  }

  function formatChartCrosshairTimeSim(time, intraday) {
    if (time == null || time === undefined) return '';
    if (typeof time === 'object' && time !== null && 'year' in time && 'month' in time && 'day' in time) {
      var y = time.year;
      var mo = String(time.month).padStart(2, '0');
      var da = String(time.day).padStart(2, '0');
      return y + '-' + mo + '-' + da;
    }
    if (typeof time === 'number' && Number.isFinite(time)) {
      var d = new Date(time * 1000);
      if (intraday) {
        return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    var s = String(time);
    return s.length ? s : '';
  }

  function candleBarFromSeriesDataSim(seriesData, seriesApi) {
    if (!seriesData || typeof seriesData.get !== 'function') return null;
    var bar = seriesData.get(seriesApi);
    if (!bar || typeof bar !== 'object') return null;
    var o = Number(bar.open);
    var h = Number(bar.high);
    var l = Number(bar.low);
    var c = Number(bar.close);
    if (![o, h, l, c].every(function (x) { return Number.isFinite(x); })) return null;
    return { open: o, high: h, low: l, close: c };
  }

  function bindSimHoldingChartOhlcLegend(chart, candleSeries, intraday) {
    var legend = document.getElementById('simHoldingChartOhlcLegend');
    if (!legend || !chart || !candleSeries) return;
    chart.subscribeCrosshairMove(function (param) {
      var map =
        param.seriesData && typeof param.seriesData.get === 'function'
          ? param.seriesData
          : param.seriesPrices && typeof param.seriesPrices.get === 'function'
            ? param.seriesPrices
            : null;
      var bar = map ? candleBarFromSeriesDataSim(map, candleSeries) : null;
      if (!bar || param.time == null) {
        legend.hidden = true;
        return;
      }
      legend.hidden = false;
      var t = formatChartCrosshairTimeSim(param.time, intraday);
      legend.innerHTML =
        '<div class="chart-ohlc-hover-time">' + escapeHtml(t) + '</div>' +
        '<div class="chart-ohlc-hover-grid">' +
        '<span><b>시</b> ' + escapeHtml(formatCurrency(bar.open)) + '</span>' +
        '<span><b>고</b> ' + escapeHtml(formatCurrency(bar.high)) + '</span>' +
        '<span><b>저</b> ' + escapeHtml(formatCurrency(bar.low)) + '</span>' +
        '<span><b>종</b> ' + escapeHtml(formatCurrency(bar.close)) + '</span>' +
        '</div>';
    });
  }

  function simHoldingChartPixelHeight(container) {
    if (!container) return 300;
    var ch = container.clientHeight;
    if (ch >= 200) return Math.round(ch);
    return 300;
  }

  function renderSimHoldingChart(candles, ma5, ma20, intraday) {
    var container = document.getElementById('simHoldingStockChart');
    if (!container || typeof LightweightCharts === 'undefined') return;

    destroySimHoldingChart();

    var chartH = simHoldingChartPixelHeight(container);
    simHoldingChartInstance = LightweightCharts.createChart(container, {
      width: container.clientWidth || 400,
      height: chartH,
      layout: {
        background: { color: 'transparent' },
        textColor: '#6b7280',
      },
      grid: {
        vertLines: { color: 'rgba(0,0,0,0.06)' },
        horzLines: { color: 'rgba(0,0,0,0.06)' },
      },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: 'rgba(0,0,0,0.08)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(0,0,0,0.08)',
        timeVisible: !!intraday,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    var candleSeries = simHoldingChartInstance.addCandlestickSeries({
      upColor: '#ef5350',
      downColor: '#42a5f5',
      borderUpColor: '#ef5350',
      borderDownColor: '#42a5f5',
      wickUpColor: '#ef5350',
      wickDownColor: '#42a5f5',
    });
    candleSeries.setData(candles);

    if (ma5.length > 0) {
      var s5 = simHoldingChartInstance.addLineSeries({
        color: '#d97706',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      s5.setData(ma5);
    }

    if (ma20.length > 0) {
      var s20 = simHoldingChartInstance.addLineSeries({
        color: '#ce93d8',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      s20.setData(ma20);
    }

    simHoldingChartInstance.timeScale().fitContent();

    bindSimHoldingChartOhlcLegend(simHoldingChartInstance, candleSeries, !!intraday);

    disconnectSimHoldingChartResize();
    simHoldingChartResizeObs = new ResizeObserver(function () {
      if (simHoldingChartInstance && container) {
        var nh = simHoldingChartPixelHeight(container);
        simHoldingChartInstance.applyOptions({
          width: container.clientWidth,
          height: nh,
        });
      }
    });
    simHoldingChartResizeObs.observe(container);
    requestAnimationFrame(function () {
      syncSimHistoryPanelHeightCap();
    });
  }

  // 보유 종목 렌더링 (행 클릭 → 보유 주문 모달 매수·매도, 종목 차트·정보는 왼쪽 거래대금 목록 클릭)
  function renderHoldings() {
    const holdingsTableBody = document.getElementById('holdingsTableBody');

    const holdingsHtml = Object.entries(portfolio.holdings).map(([stock, data]) => {
      const profit = (data.currentPrice - data.avgPrice) * data.quantity;
      const profitRate = ((data.currentPrice - data.avgPrice) / data.avgPrice * 100);
      const keyAttr = htmlAttr(stock);
      const pDir = changeDirClass(profit);
      const rDir = changeDirClass(profitRate);
      const profitStr = pDir === 'flat'
        ? formatCurrency(0)
        : (profit > 0 ? '+' : '') + formatCurrency(Math.abs(profit));
      let rateStr = profitRate.toFixed(2) + '%';
      if (rDir === 'up') rateStr = '+' + rateStr;

      return `
        <tr class="holding-row" data-holding-key="${keyAttr}" title="클릭하면 매수·매도 주문 창이 열립니다. 차트·종목정보는 왼쪽 거래대금 순위에서 해당 종목을 누르세요.">
          <td class="holding-name">${escapeHtml(stock)}</td>
          <td>${data.quantity.toLocaleString()}주</td>
          <td>${formatCurrency(data.avgPrice)}</td>
          <td class="holding-price">${formatCurrency(data.currentPrice)}</td>
          <td class="holding-change ${pDir}">${profitStr}</td>
          <td class="holding-change ${rDir}">${rateStr}</td>
        </tr>
      `;
    }).join('');

    holdingsTableBody.innerHTML = holdingsHtml;
    updateSellPanelSelect();
  }

  function setHistoryViewFilter(mode) {
    if (mode === 'buy' || mode === 'sell' || mode === 'pending') {
      historyViewFilter = mode;
    } else {
      historyViewFilter = 'all';
    }
    document.querySelectorAll('.history-tab').forEach(function (btn) {
      const tab = btn.getAttribute('data-history-tab') || 'all';
      const on = tab === historyViewFilter;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var d = document.getElementById('historyDateFilter');
    var wrap = document.getElementById('historyDateFilterWrap');
    if (d) {
      d.disabled = historyViewFilter === 'pending';
      d.title =
        historyViewFilter === 'pending'
          ? '대기 탭에서는 날짜 필터가 적용되지 않습니다.'
          : '날짜를 선택하세요. 해당 날짜 기록만 표시됩니다.';
    }
    if (wrap) wrap.classList.toggle('history-date-muted', historyViewFilter === 'pending');
    renderHistory();
  }

  /** 체결 목록만 화면에서 비움. 이후 서버 갱신 시에도 비우기 시점 이전 체결은 목록에 넣지 않음(복구로 전체 표시). */
  function clearHistoryDisplayOnly() {
    if (portfolio.history.length > 0) {
      var maxAt = 0;
      portfolio.history.forEach(function (h) {
        if (h.atMs > maxAt) maxAt = h.atMs;
      });
      historyDisplayCutoffMs = maxAt;
    } else if (historyDisplayCutoffMs == null) {
      historyDisplayCutoffMs = Date.now() - 1;
    }
    portfolio.history = [];
    setHistoryDateToToday();
    renderHistory();
  }

  /** 서버에서 포트폴리오·체결 내역 다시 불러와 화면 갱신. 비우기로 둔 새출발 제한도 해제. */
  async function restoreHistoryFromServer() {
    var btn = document.getElementById('historyRestoreDisplay');
    if (btn) {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
    }
    try {
      historyDisplayCutoffMs = null;
      await loadPortfolioFromServer();
      updatePortfolio();
      renderHoldings();
      renderHistory();
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
      }
    }
  }

  function formatHistorySectionDateLabel(ymd) {
    if (!ymd || typeof ymd !== 'string') return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!m) return ymd;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (Number.isNaN(d.getTime())) return ymd;
    try {
      return d.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      });
    } catch (_) {
      return ymd;
    }
  }

  function tradeMatchesSimHoldingDetail(trade) {
    var st = simHoldingDetailState;
    if (!trade || !st) return false;
    var codeNeed = st.code != null ? String(st.code).trim() : '';
    var nameNeed = st.name != null ? String(st.name).trim() : '';
    var keyNeed = st.key != null ? String(st.key).trim() : '';
    var tCode = trade.code != null ? String(trade.code).trim() : '';
    var tStock = trade.stock != null ? String(trade.stock).trim() : '';
    if (codeNeed && /^\d{6}$/.test(codeNeed) && tCode === codeNeed) return true;
    if (keyNeed && (tStock === keyNeed || tCode === keyNeed)) return true;
    if (nameNeed && tStock === nameNeed) return true;
    if (nameNeed && /^\d{6}$/.test(nameNeed) && tCode === nameNeed) return true;
    return false;
  }

  /** 종목 상세 거래내역 패널용 목록 HTML */
  function buildSimHoldingStockHistoryListHtml() {
    if (!portfolio.history || portfolio.history.length === 0) {
      return '<div class="sim-stock-history-empty">이 종목의 체결 내역이 없습니다.</div>';
    }
    var rows = portfolio.history.filter(tradeMatchesSimHoldingDetail);
    if (rows.length === 0) {
      return '<div class="sim-stock-history-empty">이 종목의 체결 내역이 없습니다.</div>';
    }
    rows.sort(function (a, b) {
      return (b.atMs || 0) - (a.atMs || 0);
    });
    var dateOrder = [];
    var map = Object.create(null);
    rows.forEach(function (t) {
      var ymd = t.atMs ? tradeLocalYmd(t.atMs) : '';
      if (!ymd) ymd = '_';
      if (!map[ymd]) {
        map[ymd] = [];
        dateOrder.push(ymd);
      }
      map[ymd].push(t);
    });
    var html = '';
    dateOrder.forEach(function (ymd) {
      var label = ymd === '_' ? '날짜 미상' : formatHistorySectionDateLabel(ymd);
      html += '<div class="sim-stock-history-group">';
      html += '<div class="sim-stock-history-date" role="separator">' + escapeHtml(label) + '</div>';
      map[ymd].sort(function (a, b) {
        return (b.atMs || 0) - (a.atMs || 0);
      });
      map[ymd].forEach(function (trade) {
        var badgeClass = trade.type === 'buy' ? 'buy' : 'sell';
        var badgeText = trade.type === 'buy' ? '구매' : '판매';
        var qty = Number(trade.quantity || 0);
        var px = Number(trade.price || 0);
        var detailParts = [];
        if (qty > 0) detailParts.push(qty.toLocaleString() + '주');
        if (px > 0) detailParts.push(formatCurrency(px));
        var detail = detailParts.join(' · ');
        html += '<div class="sim-stock-history-item">';
        html += '<div class="sim-stock-history-row sim-stock-history-row--inline">';
        html += '<span class="history-badge ' + badgeClass + '">' + badgeText + '</span>';
        if (detail) {
          html += '<span class="sim-stock-history-sub">' + escapeHtml(detail) + '</span>';
        }
        html += '</div>';
        html += '<div class="sim-stock-history-amt">';
        html += '<div class="sim-stock-history-total">' + formatCurrency(trade.total) + '</div>';
        html += '<div class="sim-stock-history-time">' + escapeHtml(trade.time) + '</div>';
        html += '</div></div>';
      });
      html += '</div>';
    });
    return html;
  }

  /** 종목 상세 시트 안: 현재 종목만, 날짜 구역별 체결 (하단 전체 내역·날짜 필터와 무관) */
  function renderSimHoldingStockHistory() {
    var el = document.getElementById('simStockHistoryList');
    if (!el) return;
    var sheet = document.getElementById('simHoldingDetailSheet');
    if (!sheet || sheet.hasAttribute('hidden')) {
      el.innerHTML = '';
      return;
    }
    var panel = document.getElementById('simHoldingStockHistoryPanel');
    if (!panel || panel.hasAttribute('hidden')) {
      return;
    }
    el.innerHTML = buildSimHoldingStockHistoryListHtml();
  }

  // 거래 내역 렌더링 (전체 / 구매 / 판매 / 대기)
  function renderHistory() {
    const tradingHistory = document.getElementById('tradingHistory');
    if (!tradingHistory) return;

    if (historyViewFilter === 'pending') {
      if (!pendingOrders.length) {
        tradingHistory.innerHTML =
          '<div style="text-align: center; color: var(--gray-400); padding: 28px;">대기 중인 주문이 없습니다.</div>';
      } else {
        var pendRows = pendingOrders
          .slice()
          .sort(function (a, b) {
            return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
          })
          .map(function (o) {
            var side = o.side === 'SELL' ? '판매' : '구매';
            var actClass = o.side === 'SELL' ? 'sell' : 'buy';
            var t = o.createdAt ? new Date(o.createdAt).toLocaleString('ko-KR') : '—';
            var stk = escapeHtml(o.stock || o.stockRef || '—');
            var qty = Number(o.quantity || 0).toLocaleString();
            var lp = formatCurrency(Number(o.limitPrice || 0));
            return (
              '<div class="history-item history-item--pending">' +
              '<div class="history-info">' +
              '<div class="history-stock">' +
              '<span class="history-pending-title">' +
              stk +
              '<span class="history-pending-suffix">(대기)</span></span>' +
              '</div>' +
              '<div class="history-details history-pending-sub">' +
              '<span class="history-action history-action--' +
              actClass +
              '">' +
              side +
              '</span> ' +
              '<span>' +
              qty +
              '주</span> · <span>목표 ' +
              lp +
              '</span>' +
              '</div></div>' +
              '<div class="history-amount">' +
              '<div class="history-price history-pending-value">' +
              lp +
              '</div>' +
              '<div class="history-time">' +
              escapeHtml(t) +
              '</div></div></div>'
            );
          });
        tradingHistory.innerHTML = pendRows.join('');
      }
      renderSimHoldingStockHistory();
      return;
    }

    if (portfolio.history.length === 0) {
      tradingHistory.innerHTML =
        '<div style="text-align: center; color: var(--gray-400); padding: 40px;">아직 체결 내역이 없습니다.</div>';
      renderSimHoldingStockHistory();
      return;
    }

    let items = portfolio.history.slice();
    if (historyViewFilter === 'buy') {
      items = items.filter(t => t.type === 'buy');
    } else if (historyViewFilter === 'sell') {
      items = items.filter(t => t.type === 'sell');
    }

    var dateVal = getHistoryFilterYmd();
    items = items.filter(function (t) {
      return t.atMs && tradeLocalYmd(t.atMs) === dateVal;
    });

    if (items.length === 0) {
      tradingHistory.innerHTML =
        '<div style="text-align: center; color: var(--gray-400); padding: 28px;">이 구분에 해당하는 체결이 없습니다.</div>';
      renderSimHoldingStockHistory();
      return;
    }

    items.sort(function (a, b) {
      return (b.atMs || 0) - (a.atMs || 0);
    });
    var dateOrder = [];
    var byDate = Object.create(null);
    items.forEach(function (t) {
      var ymd = t.atMs ? tradeLocalYmd(t.atMs) : '_';
      if (!byDate[ymd]) {
        byDate[ymd] = [];
        dateOrder.push(ymd);
      }
      byDate[ymd].push(t);
    });

    var historyHtml = '';
    dateOrder.forEach(function (ymd) {
      var label = ymd === '_' ? '날짜 미상' : formatHistorySectionDateLabel(ymd);
      historyHtml += '<div class="sim-stock-history-group">';
      historyHtml += '<div class="sim-stock-history-date" role="separator">' + escapeHtml(label) + '</div>';
      byDate[ymd]
        .slice()
        .sort(function (a, b) {
          return (b.atMs || 0) - (a.atMs || 0);
        })
        .forEach(function (trade) {
          var badgeText = trade.type === 'buy' ? '구매' : '판매';
          var actClass = trade.type === 'buy' ? 'buy' : 'sell';
          var tip = trade.code ? escapeHtmlAttr(trade.code) : '';
          var qty = Number(trade.quantity || 0).toLocaleString();
          historyHtml +=
            '<div class="history-item"' +
            (tip ? ' title="' + tip + '"' : '') +
            '>' +
            '<div class="history-info">' +
            '<div class="history-stock history-stock--stacked">' +
            '<span class="history-stock-name">' +
            escapeHtml(trade.stock) +
            '</span>' +
            '<span class="history-side-line">' +
            '<span class="history-action history-action--' +
            actClass +
            '">' +
            badgeText +
            '</span>' +
            ' <span class="history-qtyparen">(' +
            qty +
            '주)</span>' +
            '</span>' +
            '</div></div>' +
            '<div class="history-amount">' +
            '<div class="history-price">' +
            formatCurrency(trade.total) +
            '</div>' +
            '<div class="history-time">' +
            escapeHtml(trade.time) +
            '</div></div></div>';
        });
      historyHtml += '</div>';
    });

    tradingHistory.innerHTML = historyHtml;
    renderSimHoldingStockHistory();
  }

  // 통화 포맷팅
  function formatCurrency(amount) {
    return '₩' + amount.toLocaleString();
  }

  function formatLargeCurrency(amount) {
    if (amount >= 1000000000000) {
      return `₩${(amount / 1000000000000).toFixed(2)}조`;
    }
    if (amount >= 100000000) {
      return `₩${(amount / 100000000).toFixed(1)}억`;
    }
    return formatCurrency(amount);
  }

  function formatLargeNumber(num) {
    if (num >= 100000000) {
      return `${(num / 100000000).toFixed(2)}억`;
    }
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}만`;
    }
    return Number(num || 0).toLocaleString();
  }
