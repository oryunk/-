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
      '<div class="mock-cost-row"><span>매매수수료 (0.015%)</span><span>' + formatCurrency(c.fee) + '</span></div>'
    );
    if (s === 'SELL') {
      parts.push(
        '<div class="mock-cost-row"><span>증권거래세 (0.18%)</span><span>' + formatCurrency(c.tax) + '</span></div>'
      );
      parts.push(
        '<div class="mock-cost-row mock-cost-row--total"><span>예상 입금액</span><span>' +
          formatCurrency(c.netSell) +
          '</span></div>'
      );
    } else {
      parts.push(
        '<div class="mock-cost-row mock-cost-row--total"><span>총 결제 금액</span><span>' +
          formatCurrency(c.netBuy) +
          '</span></div>'
      );
    }
    el.innerHTML = parts.join('');
    el.style.display = '';
  }

  function formatTradeConfirmStockHtml(name, code) {
    var n = escapeHtml(String(name || '').trim());
    var c = String(code || '').trim();
    if (!n) return '—';
    if (c) return n + ' <span class="trade-confirm-code">' + escapeHtml(c) + '</span>';
    return n;
  }

  function setTradeConfirmStockLine(el, name, code) {
    if (!el) return;
    el.innerHTML = formatTradeConfirmStockHtml(name, code);
  }

  function formatMarketPriceConfirmLine() {
    return '시장가(' + MARKET_PRICE_LABEL + ')';
  }

  function setTradeConfirmPriceLine(el, amountText, tagLabel) {
    if (!el) return;
    var amt = String(amountText || '').trim();
    var tag = String(tagLabel || '').trim();
    if (!amt || amt === '—') {
      el.textContent = '—';
      return;
    }
    if (tag === '시장가' && amt === MARKET_PRICE_LABEL) {
      el.textContent = formatMarketPriceConfirmLine();
      return;
    }
    if (!tag) {
      el.textContent = amt;
      return;
    }
    el.innerHTML =
      '<span class="trade-confirm-value">' +
      escapeHtml(amt) +
      '<span class="trade-confirm-price-tag">' +
      escapeHtml(tag) +
      '</span></span>';
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
    var navLogoIcon = document.querySelector('nav .nav-logo .logo-icon');
    if (navLogoIcon && navLogoIcon.tagName !== 'IMG') setText('nav .nav-logo .logo-icon', '주');
    var logoText = document.querySelector('nav .nav-logo .logo-text');
    if (logoText) logoText.innerHTML = '주린<span>닷컴</span>';

    setText('nav .nav-menu a[href="guide.html"]', '가이드');
    var analysisLink = document.querySelector('nav .nav-menu a[href="analysis.html"]');
    if (analysisLink) analysisLink.innerHTML = 'AI 분석 <span class="nav-badge">AI</span>';
    var chartLink = document.querySelector('nav .nav-menu a[href="ai-chart-prediction.html"]');
    if (chartLink) chartLink.innerHTML = 'AI 차트 예측 <span class="nav-badge">AI</span>';
    setText('nav .nav-menu a[href="glossary.html"]', '용어 검색');
    var simLink = document.querySelector('nav .nav-menu a.jurin-simulation-link');
    if (simLink) simLink.textContent = '모의 투자';
    var marketLink = document.querySelector('nav .nav-menu a[href="market.html"]');
    if (marketLink) marketLink.innerHTML = '시장 <span class="nav-badge">LIVE</span>';
    setText('#navLoginBtn', '로그인');
    var startBtn = document.querySelector('nav .btn-primary');
    if (startBtn) startBtn.textContent = '회원가입';

    setText('.simulation-title', '모의 투자');
    setText('.simulation-sub', '실전처럼 매매를 연습해보세요');

    setText('.market-sidebar-title > span', '시장 종목');
    setAttr('#marketRankSearchInput', 'placeholder', '종목 검색');
    var mRef = document.querySelector('.market-sidebar-title .btn-trade');
    if (mRef) mRef.textContent = '새로고침';
    var obRef = document.getElementById('orderbookRefreshBtn');
    if (obRef) obRef.textContent = '새로고침';
    var obBack = document.getElementById('orderbookCloseBtn');
    if (obBack) obBack.textContent = '목록';
    setText('.orderbook-pane-title', '호가');

    var th = document.querySelectorAll('.discovery-table thead th');
    if (th.length >= 6) {
      th[1].textContent = '종목';
      th[2].textContent = '현재가';
      th[3].textContent = '시가';
      th[4].textContent = '거래량';
      th[5].textContent = '거래대금';
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
    setText('#orderStatusSummary', '오늘 체결·미체결 내역이 없습니다.');
    setText('.history-title', '거래 내역');
    setText('#historyPeriodLabel', '조회 기간');
    setText('#historyRangeFromLabel', '시작');
    setText('#historyRangeToLabel', '종료');
    setText('#historyClearDisplay', '초기화');
    setText('#historyRestoreDisplay', '복원');
    setText('[data-history-tab="all"]', '전체');
    setText('[data-history-tab="buy"]', '구매');
    setText('[data-history-tab="sell"]', '판매');

    setText('#sellModalHeading', '보유 종목 주문');
    setText('#holdingModalTabSell', '매도');
    setText('#holdingModalTabBuy', '매수');
    setText('label[for="sellModalQty"]', '수량');
    setText('label[for="sellModalLimitPrice"]', '주문 가격');
    setAttr('#sellModalLimitPrice', 'placeholder', '');
    setAttr('#sellModalLimitPricePlus', 'aria-label', '판매가 1틱 올리기');
    setAttr('#sellModalLimitPriceMinus', 'aria-label', '판매가 1틱 내리기');
    setText('#sellModalRefPriceLabel', '참고 시세');
    setText('#sellModalEstLabel', '예상 입금액');
    setText('label[for="holdingBuyQty"]', '수량');
    setText('label[for="holdingBuyLimitPrice"]', '주문 가격');
    setAttr('#holdingBuyLimitPrice', 'placeholder', '');
    setAttr('#holdingBuyLimitPricePlus', 'aria-label', '구매가 1틱 올리기');
    setAttr('#holdingBuyLimitPriceMinus', 'aria-label', '구매가 1틱 내리기');
    setText('#holdingBuyRefPriceLabel', '참고 시세');
    setText('#holdingBuyEstLabel', '예상 결제액');
    var sellExec = document.querySelector('.holding-modal-cta-sell');
    if (sellExec) sellExec.textContent = '매도하기';
    var holdingBuyExec = document.querySelector('.holding-modal-cta-buy');
    if (holdingBuyExec) holdingBuyExec.textContent = '매수하기';

    setText('#buyModalHeading', '매수 주문');
    setText('#buyModal .trade-confirm-row:nth-of-type(1) span:first-child', '종목');
    setText('#buyModal .trade-confirm-row:nth-of-type(2) span:first-child', '수량');
    setText('#buyModal .trade-confirm-row:nth-of-type(3) span:first-child', '예상가');
    var buyExec = document.querySelector('#buyModal .btn-trade');
    if (buyExec) buyExec.textContent = '구매하기';
    setText('#quickSellConfirmHeading', '매도 주문');
    var quickSellExec = document.querySelector('#quickSellConfirmModal .btn-trade.sell');
    if (quickSellExec) quickSellExec.textContent = '판매하기';

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
    setText('#simHoldingQuoteLblOpen', '시가');
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

  var MARKET_PRICE_LABEL = '가장 빠른 금액';

  function isMarketPriceLabelValue(v) {
    return String(v || '').trim() === MARKET_PRICE_LABEL;
  }

  function parseLimitPriceInput(inp) {
    if (!inp) return 0;
    var raw = String(inp.value || '').trim();
    if (!raw || isMarketPriceLabelValue(raw)) return 0;
    var n = parseInt(raw.replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function applyMarketPriceInputDisplay(inp, market) {
    if (!inp) return;
    if (market) {
      inp.readOnly = true;
      inp.disabled = false;
      inp.value = MARKET_PRICE_LABEL;
      inp.placeholder = '';
      inp.classList.add('price-input--market-label');
      inp.setAttribute('inputmode', 'none');
    } else {
      inp.readOnly = false;
      inp.disabled = false;
      if (isMarketPriceLabelValue(inp.value)) inp.value = '';
      inp.placeholder = '';
      inp.classList.remove('price-input--market-label');
      inp.setAttribute('inputmode', 'numeric');
    }
  }

  function priceOneTickAbove(ref) {
    var r = Math.floor(Number(ref) || 0);
    if (r <= 0) return 0;
    var tick = krxTickSize(r);
    return r + tick;
  }

  function priceOneTickBelow(ref) {
    var r = Math.floor(Number(ref) || 0);
    if (r <= 0) return 0;
    var tick = krxTickSize(r);
    return Math.max(tick, r - tick);
  }

  function defaultLimitPriceFromBook(side, refPx, orderbookData) {
    var ref = Math.floor(Number(refPx) || 0);
    var book = orderbookData || null;
    var asks = book && Array.isArray(book.asks) ? book.asks : [];
    var bids = book && Array.isArray(book.bids) ? book.bids : [];
    if (side === 'BUY') {
      if (asks.length > 0) {
        var askPx = Math.floor(Number(asks[0].price) || 0);
        if (askPx > 0) return askPx;
      }
      return ref > 0 ? priceOneTickAbove(ref) : 0;
    }
    if (bids.length > 0) {
      var bidPx = Math.floor(Number(bids[0].price) || 0);
      if (bidPx > 0) return bidPx;
    }
    return ref > 0 ? priceOneTickBelow(ref) : 0;
  }

  function referencePriceForTick() {
    var inp = document.getElementById('tradeLimitPrice');
    var v = inp ? parseLimitPriceInput(inp) : 0;
    if (v > 0) return v;
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
    var h = document.getElementById('tradeStockCode');
    var code = h && h.value ? String(h.value).trim() : '';
    if (!isSixDigitCode(code)) return;
    try {
      var d = await fetchAskingPriceWithGuard(code, { force: false });
      if (d && d.success) {
        var ep = Number(d.expected_exec_price || 0);
        if (ep > 0) rememberMarketQuote(code, '', ep);
        var inp = document.getElementById('tradeLimitPrice');
        if (inp && !isBuyMarketMode()) {
          applyLimitPriceIfEmpty(inp, 'BUY', buyReferencePrice(), code);
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
      if (plus) plus.disabled = !!market;
      if (minus) minus.disabled = !!market;
      if (cell) cell.classList.toggle('is-market-mode', !!market);
      if (market) {
        applyMarketPriceInputDisplay(inp, true);
      } else {
        applyMarketPriceInputDisplay(inp, false);
        var code = (document.getElementById('tradeStockCode') || {}).value || '';
        applyLimitPriceIfEmpty(inp, 'BUY', buyReferencePrice(), String(code).trim());
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

  function getSellStockCode() {
    var sel = document.getElementById('tradeSellStock');
    var key = sel && sel.value ? String(sel.value) : '';
    if (!key || !portfolio.holdings[key]) return '';
    var h = portfolio.holdings[key];
    var code = h.code && String(h.code).trim();
    return isSixDigitCode(code) ? code : '';
  }

  async function tryRefreshSellDisplayPriceAsync() {
    var code = getSellStockCode();
    if (!isSixDigitCode(code)) return;
    try {
      var d = await fetchAskingPriceWithGuard(code, { force: false });
      if (d && d.success) {
        var ep = Number(d.expected_exec_price || 0);
        if (ep > 0) rememberMarketQuote(code, '', ep);
        var inp = document.getElementById('tradeSellLimitPrice');
        if (inp && !isSellMarketMode()) {
          applyLimitPriceIfEmpty(inp, 'SELL', sellReferencePrice(), code);
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
      if (plus) plus.disabled = !!market;
      if (minus) minus.disabled = !!market;
      if (cell) cell.classList.toggle('is-market-mode', !!market);
      if (market) {
        applyMarketPriceInputDisplay(inp, true);
      } else {
        applyMarketPriceInputDisplay(inp, false);
        applyLimitPriceIfEmpty(inp, 'SELL', sellReferencePrice(), getSellStockCode());
      }
    }
  }

  function bumpTradeLimitPrice(direction) {
    if (isBuyMarketMode()) return;
    var inp = document.getElementById('tradeLimitPrice');
    if (!inp) return;
    var cur = parseLimitPriceInput(inp);
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

  function resetOrderbookOverlaySizing() {
    var el = document.getElementById('orderbookOverlay');
    if (!el) return;
    el.style.height = '';
    el.style.minHeight = '';
    el.style.maxHeight = '';
  }

  function syncOrderbookOverlayHeight() {
    var overlay = document.getElementById('orderbookOverlay');
    if (!overlay || !overlay.classList.contains('is-open')) return;
    var parent = overlay.closest('.sim-rank-wrap');
    if (!parent) return;

    var h = parent.clientHeight;
    if (h > 0) {
      overlay.style.height = h + 'px';
      overlay.style.minHeight = h + 'px';
      overlay.style.maxHeight = h + 'px';
    }
  }

  function renderOrderbookLoadingState() {
    var wrap = document.getElementById('orderbookTableWrap');
    if (!wrap) return;
    wrap.innerHTML = '<div class="orderbook-loading" role="status" aria-live="polite">호가 불러오는 중…</div>';
    syncOrderbookOverlayHeight();
  }

  function openOrderbookOverlay() {
    var el = document.getElementById('orderbookOverlay');
    if (el) {
      el.classList.add('is-open');
      el.setAttribute('aria-hidden', 'false');
      syncOrderbookOverlayHeight();
    }
  }

  window.openSimOrderbookForTutorial = function (code) {
    if (code && /^\d{6}$/.test(String(code).trim())) {
      loadOrderbookPanel(String(code).trim());
    }
  };

  function closeOrderbookOverlay() {
    var el = document.getElementById('orderbookOverlay');
    if (el) {
      el.classList.remove('is-open');
      el.setAttribute('aria-hidden', 'true');
      resetOrderbookOverlaySizing();
    }
    clearOrderbookPoll();
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
      reloadOrderStatusEventsFromStorage();
      var rawS = localStorage.getItem(LS_MOCK_PENDING_SEQ);
      if (rawS) {
        var n = parseInt(rawS, 10);
        if (!Number.isNaN(n) && n > 0) pendingOrderSeq = n;
      }
      pendingOrders.forEach(function (o) {
        if (o && typeof o.id === 'number' && o.id >= pendingOrderSeq) pendingOrderSeq = o.id + 1;
        ensurePendingOrderSessionFields(o);
      });
    } catch (e) { /* ignore */ }
    purgeStaleOrderBoardItems();
  }

  function reloadOrderStatusEventsFromStorage() {
    try {
      var evs = null;
      if (window.JurinMockOrderBoard && typeof window.JurinMockOrderBoard.readEvents === 'function') {
        evs = window.JurinMockOrderBoard.readEvents();
      } else {
        var rawE = localStorage.getItem(LS_MOCK_EVENTS);
        if (rawE) evs = JSON.parse(rawE);
      }
      if (!Array.isArray(evs)) return;
      var baseMs = Date.now();
      orderStatusEvents = evs.map(function (e, i) {
        if (!e || typeof e !== 'object') return e;
        if (typeof e.atMs !== 'number' || !Number.isFinite(e.atMs)) {
          e.atMs = baseMs - i * 60000;
        }
        return e;
      });
      renderOrderStatusBoard();
    } catch (e) { /* ignore */ }
  }

  function reloadPendingOrdersFromStorage() {
    try {
      if (window.JurinMockOrderBoard && typeof window.JurinMockOrderBoard.readPendingOrders === 'function') {
        pendingOrders = window.JurinMockOrderBoard.readPendingOrders();
        var seq = window.JurinMockOrderBoard.getPendingSeq();
        if (seq > pendingOrderSeq) pendingOrderSeq = seq;
        pendingOrders.forEach(function (o) {
          if (o && typeof o.id === 'number' && o.id >= pendingOrderSeq) pendingOrderSeq = o.id + 1;
          ensurePendingOrderSessionFields(o);
        });
        renderOrderStatusBoard();
      }
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
  const ASKING_PRICE_CACHE_MS = 15000;
  const ASKING_PRICE_COOLDOWN_MS = 18000;

  function isOrderbookOverlayOpen() {
    var el = document.getElementById('orderbookOverlay');
    return !!(el && el.classList.contains('is-open'));
  }

  function isAskingRateLimited(status, message) {
    if (Number(status) === 429) return true;
    var m = String(message || '');
    return /초당|한도|Too Many|429/i.test(m);
  }

  function applyAskingPriceCooldown(retryAfterSec) {
    var sec = Number(retryAfterSec);
    if (!Number.isFinite(sec) || sec <= 0) {
      sec = ASKING_PRICE_COOLDOWN_MS / 1000;
    }
    askingPriceCooldownUntilMs = Date.now() + Math.round(sec * 1000);
  }

  function getCachedOrderbookForCode(code) {
    var c = String(code || '').trim();
    if (!isSixDigitCode(c)) return null;
    var cached = askingPriceCacheByCode[c];
    return cached && cached.data ? cached.data : null;
  }

  function applyLimitPriceIfEmpty(inp, side, refPx, code) {
    if (!inp) return;
    if (parseLimitPriceInput(inp) > 0) return;
    var px = defaultLimitPriceFromBook(side, refPx, getCachedOrderbookForCode(code));
    if (px > 0) inp.value = String(px);
  }

  function isSixDigitCode(v) {
    return /^\d{6}$/.test(String(v || '').trim());
  }

  /** 체결·대기 UI용: 6자리 코드면 종목명으로 치환 */
  function resolveStockDisplayLabel(stockRef, hint) {
    var ref = String(stockRef || '').trim();
    var h = String(hint || '').trim();
    if (h && !isSixDigitCode(h)) return h;
    if (ref && !isSixDigitCode(ref)) return ref;

    var code = isSixDigitCode(ref) ? ref : isSixDigitCode(h) ? h : '';
    if (!code) return h || ref || '-';

    var row = document.querySelector('.discovery-row[data-code="' + code + '"]');
    if (row) {
      var enc = row.getAttribute('data-name') || '';
      if (enc) {
        try {
          var fromRow = decodeURIComponent(enc);
          if (fromRow && !isSixDigitCode(fromRow)) return fromRow;
        } catch (e) { /* ignore */ }
      }
    }

    if (portfolio && portfolio.holdings) {
      var fromHold = '';
      Object.keys(portfolio.holdings).forEach(function (k) {
        if (fromHold) return;
        var hd = portfolio.holdings[k];
        if (!hd) return;
        var hc = String(hd.code || '').trim();
        if (hc === code || k === code) {
          var nm = String(hd.name || k || '').trim();
          if (nm && !isSixDigitCode(nm)) fromHold = nm;
        }
      });
      if (fromHold) return fromHold;
    }

    if (sellModalState) {
      var sc = String(sellModalState.code || '').trim();
      var sn = String(sellModalState.name || '').trim();
      if (sc === code && sn && !isSixDigitCode(sn)) return sn;
    }

    var tradeInput = document.getElementById('tradeStock');
    var tradeCode = document.getElementById('tradeStockCode');
    var ti = tradeInput && tradeInput.value ? String(tradeInput.value).trim() : '';
    var tc = tradeCode && tradeCode.value ? String(tradeCode.value).trim() : '';
    if (tc === code && ti && !isSixDigitCode(ti)) return ti;

    return code;
  }

  function getTradeStockDisplayName() {
    var t = document.getElementById('tradeStock');
    var nameInput = t && t.value ? String(t.value).trim() : '';
    var h = document.getElementById('tradeStockCode');
    var code = h && h.value ? String(h.value).trim() : '';
    var apiRef = getTradeStockForApi();
    return resolveStockDisplayLabel(code || apiRef, nameInput);
  }

  function getHoldingModalBuyDisplayName() {
    var sn = String(sellModalState.name || '').trim();
    var sc = String(sellModalState.code || '').trim();
    return resolveStockDisplayLabel(sc || getHoldingModalBuyStockForApi(), sn);
  }

  var KR_MARKET_OPEN_HHMM = 900;
  var KR_MARKET_CLOSE_HHMM = 1530;

  /** 백엔드 _is_kr_regular_market_open_now 와 동일: 평일 09:00~15:30 */
  function isKrTradingDay(date) {
    var d = date instanceof Date ? date : new Date(date || Date.now());
    var dow = d.getDay();
    return dow !== 0 && dow !== 6;
  }

  function isKrRegularMarketOpenNow() {
    var now = new Date();
    if (!isKrTradingDay(now)) return false;
    var hhmm = now.getHours() * 100 + now.getMinutes();
    return hhmm >= KR_MARKET_OPEN_HHMM && hhmm <= KR_MARKET_CLOSE_HHMM;
  }

  function isKrRegularMarketClosedAfterHours(nowMs) {
    var now = new Date(nowMs == null ? Date.now() : nowMs);
    if (!isKrTradingDay(now)) return false;
    var hhmm = now.getHours() * 100 + now.getMinutes();
    return hhmm > KR_MARKET_CLOSE_HHMM;
  }

  /** 장외 예약의 첫 유효 정규장(등록일 다음 날부터 첫 평일) */
  function getNextKrTradingSessionYmd(fromMs) {
    fromMs = fromMs == null ? Date.now() : Number(fromMs);
    var d = new Date(fromMs);
    if (Number.isNaN(d.getTime())) d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    for (var i = 0; i < 14; i++) {
      if (isKrTradingDay(d)) return tradeLocalYmd(d.getTime());
      d.setDate(d.getDate() + 1);
    }
    return tradeLocalYmd(fromMs);
  }

  function resolvePendingOrderTargetSessionYmd(order) {
    if (!order) return '';
    var stored = String(order.targetSessionYmd || '').trim();
    if (stored) return stored;
    if (order.reason === 'off_hours') {
      return getNextKrTradingSessionYmd(Number(order.createdAt));
    }
    return tradeLocalYmd(Number(order.createdAt));
  }

  function ensurePendingOrderSessionFields(order) {
    if (!order || order.reason !== 'off_hours') return order;
    if (!order.targetSessionYmd) {
      order.targetSessionYmd = getNextKrTradingSessionYmd(Number(order.createdAt));
    }
    return order;
  }

  function resolveOrderStockCode(order) {
    if (!order) return '';
    var ref = String(order.stockRef || '').trim();
    var stock = String(order.stock || '').trim();
    if (isSixDigitCode(ref)) return ref;
    if (isSixDigitCode(stock)) return stock;
    return ref || stock;
  }

  function formatYmdDotWithWeekday(ymd) {
    var ms = ymdToLocalStartMs(ymd);
    if (!ms) return '—';
    var d = new Date(ms);
    var y = d.getFullYear();
    var mo = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var wd = d.toLocaleDateString('ko-KR', { weekday: 'short' });
    return y + '.' + mo + '.' + day + ' (' + wd + ')';
  }

  function formatPendingValidityRangeText(order) {
    ensurePendingOrderSessionFields(order);
    var startYmd = getNextKrTradingSessionYmd(Number(order.createdAt));
    var endYmd = resolvePendingOrderTargetSessionYmd(order);
    if (!endYmd) return '';
    var startTxt = formatYmdDotWithWeekday(startYmd);
    if (startYmd === endYmd) return startTxt + ' 장 마감';
    var endMs = ymdToLocalStartMs(endYmd);
    var endD = new Date(endMs);
    var endMo = String(endD.getMonth() + 1).padStart(2, '0');
    var endDay = String(endD.getDate()).padStart(2, '0');
    var endWd = endD.toLocaleDateString('ko-KR', { weekday: 'short' });
    return startTxt + ' ~ ' + endMo + '.' + endDay + ' (' + endWd + ') 장 마감';
  }

  function orderStatusLogoHtml(codeRaw, nameRaw) {
    var J = window.JurinStockLogos;
    var initial = escapeHtml((nameRaw && String(nameRaw).trim().charAt(0)) || '?');
    if (!J) {
      return (
        '<span class="stock-logo-wrap stock-logo-wrap--placeholder order-status-card-logo" aria-hidden="true">' +
        initial +
        '</span>'
      );
    }
    var url = J.stockLogoUrlForCode(codeRaw);
    if (url) {
      var fileCode = J.resolveStockLogoFileCode(codeRaw);
      var dataFile = fileCode ? ' data-logo-file="' + escapeHtmlAttr(fileCode) + '"' : '';
      return (
        '<span class="stock-logo-wrap order-status-card-logo"><img class="stock-logo-img"' +
        dataFile +
        ' src="' +
        escapeHtml(url) +
        '" alt="" loading="lazy" decoding="async"/></span>'
      );
    }
    return (
      '<span class="stock-logo-wrap stock-logo-wrap--placeholder order-status-card-logo" aria-hidden="true">' +
      initial +
      '</span>'
    );
  }

  function orderCompactFooterIcon(type) {
    if (type === 'calendar' || type === 'wait') {
      return (
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
        '<path d="M3 10h18M8 2v4M16 2v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
        '</svg>'
      );
    }
    if (type === 'done') {
      return (
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
        '<path d="M8 12.2l2.4 2.4L16 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>'
      );
    }
    if (type === 'fail') {
      return (
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
        '<path d="M9 9l6 6M15 9l-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
        '</svg>'
      );
    }
    return '';
  }

  function buildOrderCompactFooterItem(type, text) {
    return (
      '<span class="order-compact-footer-item order-compact-footer-item--' + type + '">' +
      '<span class="order-compact-footer-icon">' +
      orderCompactFooterIcon(type) +
      '</span>' +
      '<span class="order-compact-footer-text">' +
      text +
      '</span>' +
      '</span>'
    );
  }

  function buildTradeReceiptRow(label, value) {
    return (
      '<div class="trade-receipt-row">' +
      '<span class="trade-receipt-label">' +
      escapeHtml(label) +
      '</span>' +
      '<span class="trade-receipt-value">' +
      value +
      '</span>' +
      '</div>'
    );
  }

  function buildTradeReceiptHtml(opts) {
    opts = opts || {};
    var title = opts.title || '';
    var stockName = escapeHtml(opts.stockName || '—');
    var sideMeta = escapeHtml(
      (opts.sideKo || '') + ' · ' + Number(opts.quantity || 0).toLocaleString() + '주',
    );
    var priceLabel = escapeHtml(opts.priceLabel || '지정가');
    var priceValue = escapeHtml(opts.priceValue || '—');
    var refLabel = escapeHtml(opts.refLabel || '현재 기준가');
    var refValue = escapeHtml(opts.refValue || '—');
    var condLabel = escapeHtml(opts.condLabel || '자동 체결 조건');
    var condText = escapeHtml(opts.condText || '');
    return (
      '<div class="trade-receipt">' +
      '<div class="trade-receipt-head">' +
      '<span class="trade-receipt-head-icon">' +
      orderCompactFooterIcon('calendar') +
      '</span>' +
      '<strong class="trade-receipt-title">' +
      escapeHtml(title) +
      '</strong>' +
      '</div>' +
      '<div class="trade-receipt-body">' +
      buildTradeReceiptRow('종목', stockName) +
      buildTradeReceiptRow('구분', sideMeta) +
      buildTradeReceiptRow(priceLabel, priceValue) +
      buildTradeReceiptRow(refLabel, refValue) +
      buildTradeReceiptRow(condLabel, condText) +
      '</div>' +
      '</div>'
    );
  }

  function buildOrderStatusSummaryHtml(waitCnt, doneCnt, failCnt, lastTxt) {
    return (
      '<div class="order-status-stats">' +
      buildOrderCompactFooterItem('wait', '유효한 예약·대기 ' + waitCnt + '건') +
      '<span class="order-status-stat-sep" aria-hidden="true"></span>' +
      buildOrderCompactFooterItem('done', '체결완료 ' + doneCnt + '건') +
      '<span class="order-status-stat-sep" aria-hidden="true"></span>' +
      buildOrderCompactFooterItem('fail', '미체결 ' + failCnt + '건') +
      '</div>' +
      (lastTxt || '')
    );
  }

  function limitOrderNeedsPriceQueue(side, refPx, limPx) {
    if (!(limPx > 0) || !(refPx > 0)) return false;
    if (side === 'BUY') return refPx > limPx;
    return refPx < limPx;
  }

  /** 백엔드 _resolve_mock_execution_price 와 동일 — marketable 시 현재가, 아니면 0 */
  function resolveMockExecutionPrice(side, refPx, limPx) {
    var ref = Math.floor(Number(refPx) || 0);
    var lim = Math.floor(Number(limPx) || 0);
    if (ref <= 0) return lim > 0 ? lim : 0;
    if (lim <= 0) return ref;
    if (side === 'BUY') return lim >= ref ? ref : 0;
    return lim <= ref ? ref : 0;
  }

  function resolveSellUnitPrice(refPx, limPx) {
    var ref = Math.floor(Number(refPx) || 0);
    var lim = Math.floor(Number(limPx) || 0);
    if (lim <= 0) return ref;
    var exec = resolveMockExecutionPrice('SELL', ref, lim);
    return exec > 0 ? exec : lim;
  }

  function getOrderableCash() {
    var s = portfolio.summary;
    if (s && typeof s.cash_balance === 'number' && !Number.isNaN(s.cash_balance)) {
      return Math.max(0, Math.floor(s.cash_balance));
    }
    return Math.max(0, Math.floor(Number(portfolio.balance) || 0));
  }

  function sumPendingBuyReservation(excludeOrderId) {
    var sum = 0;
    var ex = excludeOrderId != null ? Number(excludeOrderId) : null;
    pendingOrders.forEach(function (o) {
      if (!o || o.side !== 'BUY') return;
      if (ex != null && Number.isFinite(ex) && o.id === ex) return;
      var q = Number(o.quantity) || 0;
      var px = Number(o.limitPrice) || 0;
      if (q <= 0 || px <= 0) return;
      sum += estimateMockTradeCosts('BUY', px * q).netBuy;
    });
    return sum;
  }

  async function resolveBuyUnitPrice(limPx, stockRef) {
    var lim = Number(limPx) || 0;
    var ref = await getLatestMarketPrice(stockRef);
    ref = Number(ref) > 0 ? Math.floor(ref) : 0;
    if (lim <= 0) return ref;
    var exec = resolveMockExecutionPrice('BUY', ref, lim);
    if (exec > 0) return exec;
    return Math.floor(lim);
  }

  function validateBuyAffordability(quantity, unitPx, excludePendingId) {
    var qty = Math.floor(Number(quantity) || 0);
    var px = Math.floor(Number(unitPx) || 0);
    if (qty <= 0) {
      return { ok: false, message: '수량은 1 이상이어야 합니다.' };
    }
    if (px <= 0) {
      return { ok: false, message: '체결 기준가를 확인할 수 없습니다. 가격을 확인해 주세요.' };
    }
    var required = estimateMockTradeCosts('BUY', px * qty).netBuy;
    var cash = getOrderableCash();
    var reserved = sumPendingBuyReservation(excludePendingId);
    var available = Math.max(0, cash - reserved);
    if (required <= available) {
      return {
        ok: true,
        required: required,
        available: available,
        orderableCash: cash,
        reserved: reserved,
      };
    }
    return {
      ok: false,
      required: required,
      available: available,
      orderableCash: cash,
      reserved: reserved,
    };
  }

  function isHoldingsQtyExceededMessage(msg) {
    return /보유\s*수량/.test(String(msg || ''));
  }

  function isBalanceInsufficientMessage(msg) {
    var s = String(msg || '');
    if (isHoldingsQtyExceededMessage(s)) return false;
    return s.indexOf('예수금') >= 0 || s.indexOf('잔액') >= 0 || s.indexOf('부족') >= 0;
  }

  function openSellQtyExceededModal(maxQty, message) {
    var lead =
      message ||
      '보유 수량(' + Number(maxQty || 0).toLocaleString() + '주)을 넘을 수 없습니다.';
    openSimTradeNoticeModal({
      variant: 'simple',
      title: '판매 수량을 확인해 주세요',
      lead: lead,
      showPrimary: false,
      showConfirm: true,
      confirmLabel: '확인',
    });
  }

  function showSellTradeError(err, fallbackMsg) {
    var msg = (err && err.message) || fallbackMsg || '판매 중 오류가 발생했습니다.';
    if (isHoldingsQtyExceededMessage(msg)) {
      openSellQtyExceededModal(null, msg);
      return;
    }
    alert(msg);
  }

  function openInsufficientCashModal(validation, ctx) {
    ctx = ctx || {};
    var modal = document.getElementById('insufficientCashModal');
    if (!modal || !validation) return;
    var required = Math.max(0, Math.floor(Number(validation.required) || 0));
    var available = Math.max(0, Math.floor(Number(validation.available) || 0));
    var shortfall = Math.max(0, required - available);
    var qty = Math.floor(Number(ctx.quantity) || 0);
    var unitPx = Math.floor(Number(ctx.unitPx) || 0);

    var stockLine = document.getElementById('insufficientCashStockLine');
    var qtyLine = document.getElementById('insufficientCashQtyLine');
    var unitLine = document.getElementById('insufficientCashUnitLine');
    var reqEl = document.getElementById('insufficientCashRequired');
    var availEl = document.getElementById('insufficientCashAvailable');
    var shortEl = document.getElementById('insufficientCashShortfall');
    if (stockLine) stockLine.textContent = ctx.stock || '—';
    if (qtyLine) qtyLine.textContent = qty > 0 ? qty.toLocaleString() + '주' : '—';
    if (unitLine) {
      if (unitPx > 0) {
        var unitSuffix = ctx.market ? ' (' + MARKET_PRICE_LABEL + ')' : ctx.limitLabel || '';
        unitLine.textContent = formatCurrency(unitPx) + unitSuffix;
      } else {
        unitLine.textContent = '—';
      }
    }
    if (reqEl) reqEl.textContent = formatCurrency(required);
    if (availEl) availEl.textContent = formatCurrency(available);
    if (shortEl) shortEl.textContent = formatCurrency(shortfall);

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeInsufficientCashModal() {
    var modal = document.getElementById('insufficientCashModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  var marketClosedUiTarget = 'trading-buy';
  var simTradeNoticePrimaryHandler = null;
  var simTradeNoticeFocusStockOnClose = false;

  function resolveMarketClosedUiTarget(side) {
    var holdingModal = document.getElementById('sellModal');
    if (holdingModal && holdingModal.classList.contains('is-open')) {
      var buyTab = document.getElementById('holdingModalTabBuy');
      if (buyTab && buyTab.classList.contains('active')) return 'holding-buy';
      return 'holding-sell';
    }
    if (document.getElementById('buyModal') && document.getElementById('buyModal').classList.contains('is-open')) {
      return 'trading-buy';
    }
    if (
      document.getElementById('quickSellConfirmModal') &&
      document.getElementById('quickSellConfirmModal').classList.contains('is-open')
    ) {
      return 'trading-sell';
    }
    return side === 'SELL' ? 'trading-sell' : 'trading-buy';
  }

  function dismissOrderConfirmModalsForMarketClosed() {
    closeBuyModal();
    if (typeof window.closeQuickSellConfirmModal === 'function') {
      window.closeQuickSellConfirmModal();
    }
    closeSellModal();
  }

  function openSimTradeNoticeModal(opts) {
    opts = opts || {};
    var modal = document.getElementById('simTradeNoticeModal');
    if (!modal) return;
    dismissOrderConfirmModalsForMarketClosed();

    var panelEl = document.getElementById('simTradeNoticePanel');
    var titleEl = document.getElementById('simTradeNoticeTitle');
    var leadEl = document.getElementById('simTradeNoticeLead');
    var summaryEl = document.getElementById('simTradeNoticeSummary');
    var tipEl = document.getElementById('simTradeNoticeTip');
    var extraEl = document.getElementById('simTradeNoticeExtra');
    var primaryBtn = document.getElementById('simTradeNoticePrimary');
    var confirmBtn = document.getElementById('simTradeNoticeConfirm');
    var actionsEl = document.getElementById('simTradeNoticeActions');
    var isSimple = opts.variant === 'simple';

    if (panelEl) panelEl.classList.toggle('sim-trade-notice-panel--simple', isSimple);

    if (titleEl) titleEl.textContent = opts.title || '';
    if (leadEl) leadEl.textContent = opts.lead || '';

    var hasSummary = !!(opts.tip || opts.extra);
    if (summaryEl) {
      if (hasSummary) {
        summaryEl.hidden = false;
        if (tipEl) tipEl.textContent = opts.tip || '';
        if (extraEl) {
          if (opts.extra) {
            extraEl.textContent = opts.extra;
            extraEl.hidden = false;
          } else {
            extraEl.textContent = '';
            extraEl.hidden = true;
          }
        }
      } else {
        summaryEl.hidden = true;
      }
    }

    simTradeNoticeFocusStockOnClose = !!opts.focusStockOnClose;
    simTradeNoticePrimaryHandler = typeof opts.onPrimary === 'function' ? opts.onPrimary : null;

    var showPrimary = !!opts.showPrimary;
    var showConfirm = opts.showConfirm !== false;

    if (primaryBtn) {
      if (showPrimary) {
        primaryBtn.hidden = false;
        primaryBtn.textContent = opts.primaryLabel || '확인';
      } else {
        primaryBtn.hidden = true;
      }
    }
    if (confirmBtn) {
      confirmBtn.hidden = !showConfirm;
      confirmBtn.textContent = opts.confirmLabel || '확인';
      confirmBtn.classList.toggle('sim-trade-notice-confirm-btn', isSimple);
      confirmBtn.classList.toggle('btn-ghost-modal', !isSimple);
    }
    if (actionsEl) {
      actionsEl.hidden = !showPrimary && !showConfirm;
      actionsEl.classList.toggle('sim-trade-notice-actions--simple', isSimple);
    }

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeSimTradeNoticeModal() {
    var modal = document.getElementById('simTradeNoticeModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    dismissOrderConfirmModalsForMarketClosed();
    simTradeNoticePrimaryHandler = null;
    if (simTradeNoticeFocusStockOnClose) {
      simTradeNoticeFocusStockOnClose = false;
      var stockInput = document.getElementById('tradeStock');
      if (stockInput) {
        try {
          stockInput.focus({ preventScroll: true });
        } catch (_) {
          stockInput.focus();
        }
      }
    }
  }

  function runSimTradeNoticePrimary() {
    if (simTradeNoticePrimaryHandler) simTradeNoticePrimaryHandler();
  }

  function openStockRequiredNoticeModal() {
    openSimTradeNoticeModal({
      variant: 'simple',
      title: '종목을 선택해 주세요',
      lead: '왼쪽 목록에서 종목을 선택하세요.',
      showPrimary: false,
      showConfirm: true,
      confirmLabel: '확인',
      focusStockOnClose: true,
    });
  }

  function openMarketClosedModal(side) {
    marketClosedUiTarget = resolveMarketClosedUiTarget(side === 'SELL' ? 'SELL' : 'BUY');
    openSimTradeNoticeModal({
      title: '장 마감 · 시장가 불가',
      lead:
        '장이 열려 있지 않아 시장가 주문을 넣을 수 없습니다. 지정가로 예약하거나 정규장(09:00~15:30)에 다시 시도해 주세요.',
      tip: '예약은 다음 정규장까지 유효하며, 해당 장(09:00~15:30)에서 지정가 조건이 맞으면 자동 체결됩니다.',
      extra: '정규장: 평일 09:00 ~ 15:30',
      showPrimary: true,
      primaryLabel: '지정가로 전환',
      onPrimary: switchToLimitFromMarketClosed,
    });
  }

  function switchToLimitFromMarketClosed() {
    var target = marketClosedUiTarget;
    if (target === 'trading-sell' || target === 'holding-sell') {
      setSellPriceType(false);
    } else {
      setBuyPriceType(false);
    }
    closeSimTradeNoticeModal();
  }

  /** 예수금 부족 매수 시도 → 주문/체결 현황에 미체결로 기록 */
  function recordInsufficientCashUnfilled(ctx) {
    ctx = ctx || {};
    var stockRef = String(ctx.stockRef || '').trim();
    var stockLabel = String(ctx.stock || ctx.stockLabel || stockRef || '').trim();
    if (!stockRef && !stockLabel) return;
    var unitPx = Math.floor(Number(ctx.unitPx != null ? ctx.unitPx : ctx.limPx || 0));
    pushOrderStatusEvent({
      stockRef: stockRef || stockLabel,
      stock: stockLabel,
      side: 'BUY',
      mode: ctx.mode || 'manual',
      status: 'failed',
      desiredPrice: unitPx,
      quantity: Math.floor(Number(ctx.quantity) || 0),
      note: ctx.note || '예수금 부족',
    });
  }

  async function showBuyInsufficientCashModal(quantity, limPx, stockRef, ctx) {
    var unitPx = await resolveBuyUnitPrice(limPx, stockRef);
    var v = validateBuyAffordability(quantity, unitPx);
    if (v.ok) return false;
    if (v.message) {
      alert(v.message);
      return true;
    }
    ctx = ctx || {};
    ctx.unitPx = unitPx;
    ctx.quantity = Math.floor(Number(quantity) || 0);
    ctx.stockRef = stockRef;
    if (ctx.stockLabel && !ctx.stock) ctx.stock = ctx.stockLabel;
    recordInsufficientCashUnfilled(ctx);
    openInsufficientCashModal(v, ctx);
    return true;
  }

  async function blockBuyIfInsufficient(quantity, limPx, stockRef, ctx) {
    var unitPx = await resolveBuyUnitPrice(limPx, stockRef);
    var v = validateBuyAffordability(quantity, unitPx);
    if (v.ok) return null;
    if (v.message) {
      alert(v.message);
      return v;
    }
    ctx = ctx || {};
    ctx.unitPx = unitPx;
    ctx.quantity = Math.floor(Number(quantity) || 0);
    ctx.stockRef = stockRef;
    if (ctx.recordUnfilled !== false) {
      recordInsufficientCashUnfilled(ctx);
    }
    openInsufficientCashModal(v, ctx);
    return v;
  }

  function registerPendingOrder(opts) {
    var o = opts || {};
    var createdAt = Date.now();
    var reason = o.reason === 'off_hours' ? 'off_hours' : 'price';
    var pending = {
      id: pendingOrderSeq++,
      side: o.side === 'SELL' ? 'SELL' : 'BUY',
      stock: o.stock,
      stockRef: o.stockRef,
      quantity: o.quantity,
      limitPrice: o.limitPrice,
      createdAt: createdAt,
      reason: reason,
    };
    if (reason === 'off_hours') {
      pending.targetSessionYmd = getNextKrTradingSessionYmd(createdAt);
    }
    pendingOrders.push(pending);
    saveOrderBoardState();
    renderOrderStatusBoard();
    showPendingOrderFeedback(pending, Number(o.refPx || 0));
    return pending;
  }

  function rejectMarketOrderOffHours(side) {
    openMarketClosedModal(side === 'SELL' ? 'SELL' : 'BUY');
  }

  /**
   * 지정가·시장가 제출 전 라우팅.
   * @returns {{ ok: boolean, execute?: boolean, pending?: object, blocked?: boolean }}
   */
  async function handleLimitOrderSubmission(params) {
    var side = params.side === 'SELL' ? 'SELL' : 'BUY';
    var stock = params.stock;
    var stockRef = params.stockRef || stock;
    var quantity = params.quantity;
    var limPx = Number(params.limPx || 0);

    async function ensureBuyCash() {
      if (side !== 'BUY') return true;
      var blocked = await blockBuyIfInsufficient(quantity, limPx, stockRef, {
        stock: stock,
        quantity: quantity,
        market: !(limPx > 0),
        limitLabel: limPx > 0 ? ' (지정가)' : '',
        recordUnfilled: false,
      });
      return !blocked;
    }

    if (!(limPx > 0)) {
      if (!isKrRegularMarketOpenNow()) {
        rejectMarketOrderOffHours(side);
        return { ok: false, blocked: true };
      }
      if (!(await ensureBuyCash())) return { ok: false, blocked: true };
      return { ok: true, execute: true };
    }

    if (!isKrRegularMarketOpenNow()) {
      if (!(await ensureBuyCash())) return { ok: false, blocked: true };
      var refOff = await getLatestMarketPrice(stockRef);
      var pOff = registerPendingOrder({
        side: side,
        stock: stock,
        stockRef: stockRef,
        quantity: quantity,
        limitPrice: limPx,
        reason: 'off_hours',
        refPx: refOff,
      });
      return { ok: true, pending: pOff };
    }

    var refPx = await getLatestMarketPrice(stockRef);
    if (limitOrderNeedsPriceQueue(side, refPx, limPx)) {
      if (!(await ensureBuyCash())) return { ok: false, blocked: true };
      var p = registerPendingOrder({
        side: side,
        stock: stock,
        stockRef: stockRef,
        quantity: quantity,
        limitPrice: limPx,
        reason: 'price',
        refPx: refPx,
      });
      return { ok: true, pending: p };
    }

    if (!(await ensureBuyCash())) return { ok: false, blocked: true };
    return { ok: true, execute: true };
  }

  function nowStamp() {
    return new Date().toLocaleTimeString('ko-KR', { hour12: false });
  }

  function pushOrderStatusEvent(evt) {
    if (!evt) return;
    var tsMs = typeof evt.atMs === 'number' && Number.isFinite(evt.atMs) ? evt.atMs : Date.now();
    var stockLabel = resolveStockDisplayLabel(
      evt.stockRef || evt.stock,
      evt.stockName != null ? evt.stockName : evt.stock
    );
    orderStatusEvents.unshift({
      at: evt.at || nowStamp(),
      atMs: tsMs,
      stock: stockLabel,
      stockRef: String(evt.stockRef || '').trim(),
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

  function formatTradeTimeOnly(ms) {
    var n = Number(ms);
    if (!Number.isFinite(n) || n <= 0) return '—';
    var d = new Date(n);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  function formatOrderStatusDateTimeCompact(ms) {
    var n = Number(ms);
    if (!Number.isFinite(n) || n <= 0) return '—';
    var d = new Date(n);
    if (Number.isNaN(d.getTime())) return '—';
    var y = d.getFullYear();
    var mo = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var wd = d.toLocaleDateString('ko-KR', { weekday: 'short' });
    var time = d.toLocaleTimeString('ko-KR', { hour12: false });
    return y + '.' + mo + '.' + day + ' (' + wd + ') ' + time;
  }

  function orderStatusCalendarIconHtml() {
    return (
      '<svg viewBox="0 0 24 24" focusable="false">' +
      '<rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/>' +
      '<path d="M3 10h18M8 2v4M16 2v4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' +
      '</svg>'
    );
  }

  function orderStatusClockIconHtml() {
    return (
      '<svg viewBox="0 0 24 24" focusable="false">' +
      '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/>' +
      '<path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>'
    );
  }

  function buildOrderStatusEventMetaHtml(evt) {
    var side = evt.side === 'SELL' ? '판매' : '구매';
    var actCls = evt.side === 'SELL' ? 'sell' : 'buy';
    var qty = Number(evt.quantity || 0).toLocaleString();
    var desired = Number(evt.desiredPrice || 0);
    var executed = Number(evt.executedPrice || 0);
    var isUnfilled = evt.status === 'failed';
    var pricePart = '';

    if (isUnfilled) {
      pricePart = desired > 0 ? '목표가 ' + formatCurrency(desired) : '시장가';
    } else if (executed > 0) {
      pricePart = '체결가 ' + formatCurrency(executed);
      if (desired <= 0) pricePart += ' (시장가)';
    } else if (desired > 0) {
      pricePart = '체결가 ' + formatCurrency(desired);
    }

    return (
      '<span class="order-status-action order-status-action--' + actCls + '">' + side + '</span>' +
      ' ' + qty + '주' +
      (pricePart ? ' <span class="order-status-card-meta-sep">|</span> ' + pricePart : '')
    );
  }

  function buildOrderStatusCardHtml(opts) {
    opts = opts || {};
    var cardCls = 'order-status-card order-status-card--pending';
    if (opts.variant === 'done') cardCls += ' order-status-card--done';
    else if (opts.variant === 'unfilled') cardCls += ' order-status-card--unfilled';

    var scheduleCol =
      '<div class="order-status-card-col order-status-card-col--schedule">' +
        '<span class="order-status-card-col-icon" aria-hidden="true">' +
          orderStatusClockIconHtml() +
        '</span>' +
        '<div class="order-status-card-col-body">' +
          '<span class="order-status-card-col-label">' + escapeHtml(opts.scheduleLabel || '') + '</span>' +
          (opts.scheduleValue
            ? '<span class="order-status-card-col-value">' + escapeHtml(opts.scheduleValue) + '</span>'
            : '') +
        '</div>' +
      '</div>';

    var actionsHtml = opts.actionsHtml
      ? '<div class="order-status-card-actions">' + opts.actionsHtml + '</div>'
      : '';

    return (
      '<div class="' + cardCls + '">' +
        '<div class="order-status-card-main">' +
          '<div class="order-status-card-identity">' +
            (opts.logoHtml || '') +
            '<div class="order-status-card-info">' +
              '<div class="order-status-card-title-row">' +
                '<span class="order-status-card-name">' + (opts.nameHtml || '') + '</span>' +
                '<span class="' + (opts.badgeCls || 'order-status-badge') + '">' + escapeHtml(opts.badgeTxt || '') + '</span>' +
              '</div>' +
              '<div class="order-status-card-meta">' + (opts.metaHtml || '') + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="order-status-card-col order-status-card-col--validity">' +
            '<span class="order-status-card-col-icon" aria-hidden="true">' +
              orderStatusCalendarIconHtml() +
            '</span>' +
            '<div class="order-status-card-col-body">' +
              '<span class="order-status-card-col-label">' + escapeHtml(opts.validityLabel || '') + '</span>' +
              '<span class="order-status-card-col-value">' + escapeHtml(opts.validityValue || '') + '</span>' +
            '</div>' +
          '</div>' +
          scheduleCol +
        '</div>' +
        actionsHtml +
      '</div>'
    );
  }

  function formatOrderStatusReason(note) {
    var s = String(note || '').trim();
    if (!s) return '주문이 체결되지 않았습니다.';
    if (isHoldingsQtyExceededMessage(s)) return '보유 수량 초과';
    if (isBalanceInsufficientMessage(s)) return '예수금 부족';
    if (s.indexOf('즉시 체결할 수 없') >= 0) {
      if (s.indexOf('지정가보다 높아') >= 0) return '현재가가 지정가보다 높아 즉시 체결 불가';
      if (s.indexOf('지정가보다 낮아') >= 0) return '현재가가 지정가보다 낮아 즉시 체결 불가';
      return '지정가 조건 미달로 즉시 체결 불가';
    }
    return s;
  }

  function buildOrderStatusReasonRow(reasonText) {
    var text = formatOrderStatusReason(reasonText);
    return (
      '<div class="order-status-reason">' +
        '<span class="order-status-reason-text">' +
        escapeHtml(text) +
        '</span>' +
      '</div>'
    );
  }

  function pendingOrderReasonText(order) {
    if (!order) return '';
    if (order.reason === 'off_hours') return '';
    if (order.side === 'BUY') {
      return '현재가가 목표가(지정가) 이하가 되면 체결됩니다.';
    }
    return '현재가가 목표가(지정가) 이상이 되면 체결됩니다.';
  }

  function cancelPendingOrder(orderId) {
    var id = Number(orderId);
    if (!Number.isFinite(id)) return;
    var removed = null;
    pendingOrders = pendingOrders.filter(function (o) {
      if (o && o.id === id) {
        removed = o;
        return false;
      }
      return true;
    });
    if (!removed) return;
    saveOrderBoardState();
    renderOrderStatusBoard();
    var fb = document.getElementById('tradeFeedback');
    if (fb) {
      var sideKo = removed.side === 'SELL' ? '판매' : '구매';
      var isReserve = removed.reason === 'off_hours';
      fb.className = 'trade-feedback trade-receipt-wrap';
      fb.style.display = 'block';
      fb.innerHTML = buildTradeReceiptHtml({
        title: isReserve ? '예약 주문 취소' : '주문 취소',
        stockName: resolveStockDisplayLabel(removed.stockRef || removed.stock, removed.stock),
        sideKo: sideKo,
        quantity: Number(removed.quantity || 0),
        priceLabel: '목표가',
        priceValue: formatCurrency(Number(removed.limitPrice || 0)),
        refLabel: '주문 유형',
        refValue: isReserve ? '장 마감 예약' : '장중 대기',
        condLabel: '처리 상태',
        condText: '주문이 취소되었습니다',
      });
    }
  }

  var pendingOrderEditState = { id: null };

  function findPendingOrderById(orderId) {
    var id = Number(orderId);
    if (!Number.isFinite(id)) return null;
    for (var i = 0; i < pendingOrders.length; i++) {
      var o = pendingOrders[i];
      if (o && o.id === id) return o;
    }
    return null;
  }

  function openPendingOrderEditModal(orderId) {
    var order = findPendingOrderById(orderId);
    if (!order) return;
    if (shouldExpirePendingOrder(order)) {
      renderOrderStatusBoard();
      return;
    }
    ensurePendingOrderSessionFields(order);
    pendingOrderEditState = { id: order.id };
    var modal = document.getElementById('pendingOrderEditModal');
    var panel = document.getElementById('pendingOrderEditPanel');
    var heading = document.getElementById('pendingOrderEditHeading');
    var stockLine = document.getElementById('pendingOrderEditStockLine');
    var qtyLine = document.getElementById('pendingOrderEditQtyLine');
    var typeLine = document.getElementById('pendingOrderEditTypeLine');
    var validLine = document.getElementById('pendingOrderEditValidLine');
    var inp = document.getElementById('pendingOrderEditLimitPrice');
    var saveBtn = document.getElementById('pendingOrderEditSaveBtn');
    var isReserve = order.reason === 'off_hours';
    var isSell = order.side === 'SELL';
    if (heading) heading.textContent = isReserve ? '예약 가격 수정' : '대기 가격 수정';
    if (panel) {
      panel.classList.remove('trade-confirm-panel--buy', 'trade-confirm-panel--sell');
      panel.classList.add(isSell ? 'trade-confirm-panel--sell' : 'trade-confirm-panel--buy');
    }
    if (saveBtn) {
      saveBtn.classList.toggle('sell', isSell);
      saveBtn.textContent = '저장';
    }
    var stockRef = order.stockRef || order.stock;
    var code = isSixDigitCode(String(stockRef || '').trim()) ? String(stockRef).trim() : '';
    var stockName = resolveStockDisplayLabel(stockRef, order.stock);
    if (stockLine) stockLine.innerHTML = formatTradeConfirmStockHtml(stockName, code);
    if (qtyLine) qtyLine.textContent = Number(order.quantity || 0).toLocaleString() + '주';
    if (typeLine) typeLine.textContent = isReserve ? '예약' : '장중 대기';
    if (validLine) {
      validLine.textContent = '';
      validLine.hidden = true;
    }
    if (inp) inp.value = String(Math.floor(Number(order.limitPrice) || 0));
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    try {
      if (inp) inp.focus({ preventScroll: true });
    } catch (_) {
      if (inp) inp.focus();
    }
  }

  function closePendingOrderEditModal() {
    var modal = document.getElementById('pendingOrderEditModal');
    if (modal) {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    }
    pendingOrderEditState = { id: null };
  }

  function bumpPendingOrderEditLimitPrice(direction) {
    var order = findPendingOrderById(pendingOrderEditState.id);
    var inp = document.getElementById('pendingOrderEditLimitPrice');
    if (!inp) return;
    var cur = inp.value !== '' ? parseInt(inp.value, 10) : NaN;
    var ref = !Number.isNaN(cur) && cur > 0 ? cur : order ? Number(order.limitPrice) || 0 : 0;
    if (!Number.isFinite(ref) || ref <= 0) ref = 50000;
    var tick = krxTickSize(ref);
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
  }

  async function confirmPendingOrderPriceEdit() {
    var order = findPendingOrderById(pendingOrderEditState.id);
    if (!order) {
      closePendingOrderEditModal();
      return;
    }
    var inp = document.getElementById('pendingOrderEditLimitPrice');
    var raw = inp && inp.value !== '' ? parseInt(inp.value, 10) : NaN;
    if (Number.isNaN(raw) || raw <= 0) {
      alert('가격을 올바르게 입력해 주세요.');
      return;
    }
    var tick = krxTickSize(raw);
    var px = Math.floor(raw / tick) * tick;
    if (px < tick) px = tick;
    var prevPx = Math.floor(Number(order.limitPrice) || 0);
    if (px === prevPx) {
      closePendingOrderEditModal();
      return;
    }
    if (order.side === 'BUY') {
      var unitPx = await resolveBuyUnitPrice(px, order.stockRef || order.stock);
      var v = validateBuyAffordability(order.quantity, unitPx, order.id);
      if (!v.ok) {
        if (v.message) {
          alert(v.message);
          return;
        }
        openInsufficientCashModal(v, {
          stock: order.stock,
          quantity: order.quantity,
          unitPx: unitPx,
          limitLabel: ' (지정가)',
        });
        return;
      }
    }
    order.limitPrice = px;
    saveOrderBoardState();
    closePendingOrderEditModal();
    renderOrderStatusBoard();
    var fb = document.getElementById('tradeFeedback');
    if (fb) {
      var sideKo = order.side === 'SELL' ? '판매' : '구매';
      var kind = order.reason === 'off_hours' ? '예약' : '대기';
      fb.className = 'trade-feedback';
      fb.style.display = 'block';
      fb.innerHTML =
        '<strong>' + kind + ' 가격 변경</strong>' +
        '<div class="trade-row"><span>종목</span><span>' +
        escapeHtml(resolveStockDisplayLabel(order.stockRef || order.stock, order.stock)) +
        '</span></div>' +
        '<div class="trade-row"><span>목표가</span><span>' +
        formatCurrency(prevPx) +
        ' → ' +
        formatCurrency(px) +
        '</span></div>' +
        '<div class="trade-row"><span>내용</span><span>' +
        sideKo +
        ' · ' +
        Number(order.quantity || 0).toLocaleString() +
        '주</span></div>';
    }
  }

  function isOrderBoardToday(ms) {
    return tradeLocalYmd(ms) === tradeLocalYmd(Date.now());
  }

  function pendingOrderExpiryNote(order) {
    if (!order) return '기간 만료 · 자동 취소';
    if (order.reason === 'price') return '당일 미체결 · 자동 취소';
    if (order.reason === 'off_hours') return '기간 만료 · 자동 취소';
    return '자동 취소';
  }

  /** 장중 대기: 당일만 유효. 예약: targetSessionYmd 정규장 마감 후 만료. */
  function shouldExpirePendingOrder(order, nowMs) {
    nowMs = nowMs == null ? Date.now() : nowMs;
    if (!order) return true;
    if (order.reason === 'price') {
      return !isOrderBoardToday(Number(order.createdAt));
    }
    if (order.reason === 'off_hours') {
      ensurePendingOrderSessionFields(order);
      var sessionYmd = resolvePendingOrderTargetSessionYmd(order);
      if (!sessionYmd) return false;
      var todayYmd = tradeLocalYmd(nowMs);
      if (todayYmd > sessionYmd) return true;
      if (todayYmd === sessionYmd) return isKrRegularMarketClosedAfterHours(nowMs);
      return false;
    }
    return !isOrderBoardToday(Number(order.createdAt));
  }

  function isPendingOrderVisibleToday(order) {
    return order && !shouldExpirePendingOrder(order);
  }

  function sumExpiredBuyReservation(orders) {
    var sum = 0;
    (orders || []).forEach(function (o) {
      if (!o || o.side !== 'BUY') return;
      var q = Number(o.quantity) || 0;
      var px = Number(o.limitPrice) || 0;
      if (q <= 0 || px <= 0) return;
      sum += estimateMockTradeCosts('BUY', px * q).netBuy;
    });
    return sum;
  }

  function recordPendingOrderExpiry(order) {
    if (!order) return;
    orderStatusEvents.unshift({
      at: nowStamp(),
      atMs: Date.now(),
      stock: resolveStockDisplayLabel(order.stockRef || order.stock, order.stock),
      side: order.side === 'SELL' ? 'SELL' : 'BUY',
      mode: 'auto',
      status: 'failed',
      desiredPrice: Number(order.limitPrice || 0),
      executedPrice: 0,
      quantity: Number(order.quantity || 0),
      note: pendingOrderExpiryNote(order),
    });
    if (orderStatusEvents.length > 40) orderStatusEvents = orderStatusEvents.slice(0, 40);
  }

  function showExpiredPendingOrdersFeedback(expiredPending) {
    if (!expiredPending || !expiredPending.length) return;
    var released = sumExpiredBuyReservation(expiredPending);
    var fb = document.getElementById('tradeFeedback');
    if (!fb) return;
    fb.className = 'trade-feedback';
    fb.style.display = 'block';
    var lines =
      '<strong>주문 자동 취소</strong>' +
      '<div class="trade-row"><span>처리</span><span>' +
      expiredPending.length.toLocaleString() +
      '건 · ' +
      pendingOrderExpiryNote(expiredPending[0]) +
      '</span></div>';
    if (released > 0) {
      lines +=
        '<div class="trade-row"><span>예수금 반환</span><span>' +
        formatCurrency(released) +
        ' (주문 예약 해제)</span></div>';
    }
    fb.innerHTML = lines;
  }

  function purgeStaleOrderBoardItems() {
    var changed = false;
    var expiredPending = pendingOrders.filter(function (o) {
      return shouldExpirePendingOrder(o);
    });
    if (expiredPending.length > 0) {
      expiredPending.forEach(recordPendingOrderExpiry);
      pendingOrders = pendingOrders.filter(function (o) {
        return !shouldExpirePendingOrder(o);
      });
      changed = true;
      showExpiredPendingOrdersFeedback(expiredPending);
      if (typeof updatePortfolio === 'function') updatePortfolio();
    }
    var nextEvents = orderStatusEvents.filter(function (e) {
      return e && isOrderBoardToday(e.atMs);
    });
    if (nextEvents.length !== orderStatusEvents.length) {
      orderStatusEvents = nextEvents;
      changed = true;
    }
    if (changed) saveOrderBoardState();
    return changed;
  }

  function renderOrderStatusBoard() {
    purgeStaleOrderBoardItems();
    var listEl = document.getElementById('orderStatusList');
    var sumEl = document.getElementById('orderStatusSummary');
    if (!listEl || !sumEl) {
      saveOrderBoardState();
      return;
    }

    var visiblePending = pendingOrders.filter(isPendingOrderVisibleToday);
    var visibleEvents = orderStatusEvents.filter(function (e) {
      return e && isOrderBoardToday(e.atMs);
    });

    var waitCnt = visiblePending.length;
    var doneCnt = visibleEvents.filter(function (e) { return e.status === 'executed'; }).length;
    var failCnt = visibleEvents.filter(function (e) { return e.status === 'failed'; }).length;
    var last = visibleEvents.length > 0 ? visibleEvents[0] : null;
    var lastTxt = '';
    if (last) {
      lastTxt =
        '<p class="order-status-last-meta">마지막: ' +
        (last.status === 'executed' ? '체결완료' : '미체결') +
        '</p>';
    }
    sumEl.innerHTML = buildOrderStatusSummaryHtml(waitCnt, doneCnt, failCnt, lastTxt);

    if (visibleEvents.length === 0 && waitCnt === 0) {
      listEl.innerHTML = '';
      sumEl.innerHTML = buildOrderStatusSummaryHtml(
        0,
        0,
        0,
        '<p class="order-status-empty-meta">오늘 체결·미체결 내역이 없습니다.</p>'
      );
      saveOrderBoardState();
      return;
    }

    var pendingRows = visiblePending.map(function (o) {
      ensurePendingOrderSessionFields(o);
      var side = o.side === 'SELL' ? '판매' : '구매';
      var actCls = o.side === 'SELL' ? 'sell' : 'buy';
      var qty = Number(o.quantity || 0).toLocaleString();
      var stockLabel = resolveStockDisplayLabel(o.stockRef || o.stock, o.stock);
      var stockCode = resolveOrderStockCode(o);
      var lp = formatCurrency(Number(o.limitPrice || 0));
      var isReserve = o.reason === 'off_hours';
      var badgeTxt = isReserve ? '예약중' : '대기중';
      var badgeCls = isReserve
        ? 'order-status-badge order-status-badge--pending-reserve'
        : 'order-status-badge order-status-badge--pending-open';
      var validityLabel = isReserve ? '유효기간' : '유효시간';
      var validityValue = isReserve
        ? formatPendingValidityRangeText(o)
        : '오늘 장중 · 당일 장 마감까지';
      var scheduleLabel = isReserve ? '자동 체결 예정' : '조건 충족 시 체결';
      var metaHtml =
        '<span class="order-status-action order-status-action--' + actCls + '">' + side + '</span>' +
        ' ' + qty + '주 <span class="order-status-card-meta-sep">|</span> 목표가 ' + lp;
      var actionsHtml =
        '<button type="button" class="order-status-edit-btn" data-pending-edit="' +
        escapeHtmlAttr(String(o.id)) +
        '" aria-label="' +
        escapeHtmlAttr((o.stock || o.stockRef || '종목') + ' 목표가 수정') +
        '">가격 수정</button>' +
        '<button type="button" class="order-status-cancel-btn" data-pending-cancel="' +
        escapeHtmlAttr(String(o.id)) +
        '" aria-label="' +
        escapeHtmlAttr((o.stock || o.stockRef || '종목') + ' 대기 주문 취소') +
        '">취소</button>';

      return buildOrderStatusCardHtml({
        variant: 'pending',
        logoHtml: orderStatusLogoHtml(stockCode, stockLabel),
        nameHtml: escapeHtml(stockLabel),
        badgeTxt: badgeTxt,
        badgeCls: badgeCls,
        metaHtml: metaHtml,
        validityLabel: validityLabel,
        validityValue: validityValue,
        scheduleLabel: scheduleLabel,
        actionsHtml: actionsHtml,
      });
    }).join('');

    var eventRows = visibleEvents.slice(0, 16).map(function (e) {
      var isUnfilled = e.status === 'failed';
      var stockLabel = resolveStockDisplayLabel(e.stockRef || e.stock, e.stock);
      var stockCode = resolveOrderStockCode({ stockRef: e.stockRef, stock: e.stock });
      var dateLine = formatOrderStatusDateTimeCompact(e.atMs);
      var badgeCls = isUnfilled
        ? 'order-status-badge order-status-badge--fail'
        : 'order-status-badge order-status-badge--done';
      var badgeTxt = isUnfilled ? '미체결' : '체결완료';
      var scheduleLabel = isUnfilled ? '미체결 사유' : '체결 완료';
      var scheduleValue = isUnfilled ? formatOrderStatusReason(e.note) : '';

      return buildOrderStatusCardHtml({
        variant: isUnfilled ? 'unfilled' : 'done',
        logoHtml: orderStatusLogoHtml(stockCode, stockLabel),
        nameHtml: escapeHtml(stockLabel),
        badgeTxt: badgeTxt,
        badgeCls: badgeCls,
        metaHtml: buildOrderStatusEventMetaHtml(e),
        validityLabel: isUnfilled ? '처리일시' : '체결일시',
        validityValue: dateLine,
        scheduleLabel: scheduleLabel,
        scheduleValue: scheduleValue,
      });
    }).join('');

    listEl.innerHTML = pendingRows + eventRows;
    bindStockLogosIn(listEl);
    saveOrderBoardState();
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
      var coolCached = askingPriceCacheByCode[codeStr];
      if (coolCached && coolCached.data) return coolCached.data;
      return {
        success: false,
        message: '요청이 많아 잠시 후 다시 시도해 주세요. (초당 한도)',
        status: 429,
        retryAfterSec: Math.max(1, Math.ceil((askingPriceCooldownUntilMs - now) / 1000)),
      };
    }

    var cached = askingPriceCacheByCode[codeStr];
    if (!force && cached && (now - cached.atMs) < ASKING_PRICE_CACHE_MS) {
      return cached.data;
    }

    if (askingPriceInflightByCode[codeStr]) {
      try {
        return await askingPriceInflightByCode[codeStr];
      } catch (e) {
        return {
          success: false,
          message: (e && e.message) || '호가를 불러오지 못했습니다.',
        };
      }
    }

    askingPriceInflightByCode[codeStr] = (async function () {
      var url = simApiBase() + '/api/mock/asking-price/' + encodeURIComponent(codeStr);
      if (force) url += (url.indexOf('?') >= 0 ? '&' : '?') + 'refresh=1';
      var res = await fetch(url);
      var data = await res.json().catch(function () { return {}; });
      if (isAskingRateLimited(res.status, data.message)) {
        applyAskingPriceCooldown(data.retry_after_sec);
      }
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.message || ('HTTP ' + res.status),
          status: res.status,
          retryAfterSec: data.retry_after_sec,
        };
      }
      askingPriceCacheByCode[codeStr] = {
        atMs: Date.now(),
        data: data,
      };
      return data;
    })();

    try {
      return await askingPriceInflightByCode[codeStr];
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
    const isReserve = order.reason === 'off_hours';
    const title = isReserve ? '장 마감 · 예약 주문' : '주문 대기 등록';
    el.className = 'trade-feedback trade-receipt-wrap';
    el.style.display = 'block';
    el.innerHTML = buildTradeReceiptHtml({
      title: title,
      stockName: resolveStockDisplayLabel(order.stockRef || order.stock, order.stock),
      sideKo: sideKo,
      quantity: order.quantity,
      priceLabel: '지정가',
      priceValue: formatCurrency(order.limitPrice),
      refLabel: '현재 기준가',
      refValue: refText,
      condText: cond,
    });
  }

  function tradeSubmitLockButtons() {
    return document.querySelectorAll(
      'button[onclick*="confirmBuyFromModal"],' +
        'button[onclick*="confirmSellFromModal"],' +
        'button[onclick*="confirmBuyFromHoldingModal"],' +
        'button[onclick*="confirmQuickSellFromModal"]',
    );
  }

  function setTradeSubmitBusyUI(busy) {
    tradeSubmitLockButtons().forEach(function (btn) {
      if (busy) {
        btn.dataset.tradePrevDisabled = btn.disabled ? '1' : '0';
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        var label = (btn.textContent || '').trim();
        if (label && !btn.dataset.tradeBusyLabel) {
          btn.dataset.tradeBusyLabel = label;
          if (/매수|매도|구매|판매/.test(label)) btn.textContent = '처리 중…';
        }
      } else {
        btn.disabled = btn.dataset.tradePrevDisabled === '1';
        delete btn.dataset.tradePrevDisabled;
        btn.removeAttribute('aria-busy');
        if (btn.dataset.tradeBusyLabel) {
          btn.textContent = btn.dataset.tradeBusyLabel;
          delete btn.dataset.tradeBusyLabel;
        }
      }
    });
  }

  function tryAcquireTradeSubmit() {
    if (tradeSubmitInFlight) return false;
    tradeSubmitInFlight = true;
    setTradeSubmitBusyUI(true);
    return true;
  }

  function releaseTradeSubmit() {
    tradeSubmitInFlight = false;
    setTradeSubmitBusyUI(false);
    if (typeof updateSellPanelSelect === 'function') updateSellPanelSelect();
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
    if (!isKrRegularMarketOpenNow()) return;
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
            var failNote = (rt.data && rt.data.message) || '';
            if (order.side === 'BUY' && isBalanceInsufficientMessage(failNote)) {
              pushOrderStatusEvent({
                stockRef: order.stockRef,
                stock: order.stock,
                side: 'BUY',
                mode: 'auto',
                status: 'failed',
                desiredPrice: order.limitPrice,
                quantity: order.quantity,
                note: failNote || '예수금 부족',
              });
              continue;
            }
            survivors.push(order);
            continue;
          }
          anyExecuted = true;
          var t = rt.data && rt.data.trade ? rt.data.trade : {};
          pushOrderStatusEvent({
            stockRef: order.stockRef,
            stock: t.name || order.stock,
            stockName: t.name || order.stock,
            side: order.side,
            mode: 'auto',
            status: 'executed',
            desiredPrice: order.limitPrice,
            executedPrice: Number(t.price || nowPx || order.limitPrice || 0),
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

  function refreshOrderbookPanel(options) {
    if (!isOrderbookOverlayOpen()) {
      clearOrderbookPoll();
      return;
    }
    if (selectedOrderbookCode && /^\d{6}$/.test(selectedOrderbookCode)) {
      var opts = options || {};
      if (opts.force === undefined) opts.force = true;
      loadOrderbookPanel(selectedOrderbookCode, opts);
    }
  }

  async function loadOrderbookPanel(code, options) {
    var opts = options || {};
    var silent = !!opts.silent;
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
      if (meta) meta.textContent = '시장 종목을 선택하면 호가가 표시됩니다.';
      resetOrderbookOverlaySizing();
      wrap.innerHTML = '';
      return;
    }
    selectedOrderbookCode = code;
    setOrderbookRefreshEnabled(true);
    openOrderbookOverlay();
    if (meta) meta.textContent = '';
    var cached = askingPriceCacheByCode[code];
    var hasVisibleTable = !!wrap.querySelector('.orderbook-table');
    if (silent && ((cached && cached.data) || hasVisibleTable)) {
      if (cached && cached.data && !hasVisibleTable) {
        renderOrderbookTable(cached.data);
      }
    } else if (cached && cached.data) {
      renderOrderbookTable(cached.data);
      if (meta) meta.textContent = '최근 호가를 먼저 표시했습니다. 최신값 확인 중...';
    } else {
      renderOrderbookLoadingState();
    }
    try {
      var data = await fetchAskingPriceWithGuard(code, { force: !!opts.force });
      if (shouldShowOrderbookMarketClosed(data)) {
        showOrderbookMarketClosedMessage();
        return;
      }
      if (!data || !data.success) {
        if ((cached && cached.data) || hasVisibleTable) {
          if (!silent && meta) {
            meta.textContent =
              (data && data.message) || '호가 서버 제한으로 최근 값 유지 중입니다.';
          }
          return;
        }
        throw new Error(
          (data && data.message) || '호가 서버 제한으로 잠시 후 다시 시도됩니다.',
        );
      }
      renderOrderbookTable(data);
      if (meta) meta.textContent = orderbookMetaFromResponse(data);
    } catch (err) {
      if (!silent && meta) {
        meta.textContent = (err && err.message) ? String(err.message) : '호가를 불러오지 못했습니다.';
      }
      if (!(cached && cached.data) && !hasVisibleTable) wrap.innerHTML = '';
    }
  }

  function isSyntheticOrderbookData(data) {
    if (!data) return false;
    var asks = Array.isArray(data.asks) ? data.asks : [];
    var bids = Array.isArray(data.bids) ? data.bids : [];
    if (asks.length !== 1 || bids.length !== 1) return false;
    var ap = Number(asks[0].price);
    var bp = Number(bids[0].price);
    var aq = Number(asks[0].quantity || 0);
    var bq = Number(bids[0].quantity || 0);
    return ap > 0 && ap === bp && aq === 0 && bq === 0;
  }

  function hasRealOrderbookData(data) {
    if (!data) return false;
    var asks = Array.isArray(data.asks) ? data.asks : [];
    var bids = Array.isArray(data.bids) ? data.bids : [];
    if (asks.length > 1 || bids.length > 1) return true;
    var totalQty = 0;
    asks.concat(bids).forEach(function (lv) {
      totalQty += Number(lv && lv.quantity || 0);
    });
    return totalQty > 0;
  }

  function shouldShowOrderbookMarketClosed(data) {
    if (data && data.market_closed === true) return true;
    if (!data || !data.success) return false;
    if (hasRealOrderbookData(data)) return false;
    if (data.market_open === false) return true;
    return !isKrRegularMarketOpenNow() && isSyntheticOrderbookData(data);
  }

  function orderbookMetaFromResponse(data) {
    if (!data || !data.success) return '';
    if (data.quote_stale) return '최근 호가를 표시 중입니다.';
    return '';
  }

  function showOrderbookMarketClosedMessage() {
    var wrap = document.getElementById('orderbookTableWrap');
    var meta = document.getElementById('orderbookMeta');
    var msg =
      '지금은 장시간이 아니어서 호가를 불러올 수 없습니다. 정규장(09:00~15:30)에 다시 확인해 주세요.';
    if (wrap) wrap.innerHTML = '';
    if (meta) meta.textContent = msg;
    resetOrderbookOverlaySizing();
  }

  function renderOrderbookTable(data) {
    var wrap = document.getElementById('orderbookTableWrap');
    if (!wrap) return;
    if (shouldShowOrderbookMarketClosed(data)) {
      showOrderbookMarketClosedMessage();
      return;
    }
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
    syncOrderbookOverlayHeight();
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

  /** 거래 내역 조회 기간: all | 7d | 30d | 90d | custom */
  let historyPeriodMode = 'all';

  function ymdToLocalStartMs(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
    if (!m) return 0;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0).getTime();
  }

  function ymdToLocalEndMs(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
    if (!m) return 0;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999).getTime();
  }

  function normalizeHistoryCustomRange() {
    var fromEl = document.getElementById('historyDateFrom');
    var toEl = document.getElementById('historyDateTo');
    if (!fromEl || !toEl) return;
    var today = tradeLocalYmd(Date.now());
    if (!fromEl.value) fromEl.value = today;
    if (!toEl.value) toEl.value = today;
    if (ymdToLocalStartMs(fromEl.value) > ymdToLocalEndMs(toEl.value)) {
      var tmp = fromEl.value;
      fromEl.value = toEl.value;
      toEl.value = tmp;
    }
  }

  function getMockAccountStartYmd() {
    var todayYmd = tradeLocalYmd(Date.now());
    var startMs = 0;
    if (portfolio.accountCreatedMs > 0) startMs = portfolio.accountCreatedMs;
    else if (portfolio.history && portfolio.history.length) {
      portfolio.history.forEach(function (h) {
        if (h.atMs > 0 && (!startMs || h.atMs < startMs)) startMs = h.atMs;
      });
    }
    if (startMs > 0) return tradeLocalYmd(startMs);
    return todayYmd;
  }

  function getHistoryPeriodBounds() {
    var todayYmd = tradeLocalYmd(Date.now());
    var mode = historyPeriodMode;
    var startYmd = todayYmd;
    var endYmd = todayYmd;

    if (mode === 'custom') {
      normalizeHistoryCustomRange();
      var fromEl = document.getElementById('historyDateFrom');
      var toEl = document.getElementById('historyDateTo');
      startYmd = fromEl && fromEl.value ? String(fromEl.value).trim() : todayYmd;
      endYmd = toEl && toEl.value ? String(toEl.value).trim() : todayYmd;
    } else if (mode === 'all') {
      startYmd = getMockAccountStartYmd();
      endYmd = todayYmd;
    } else if (mode === '7d' || mode === '30d' || mode === '90d') {
      var daysBack = mode === '7d' ? 6 : mode === '30d' ? 29 : 89;
      var startD = new Date();
      startD.setHours(0, 0, 0, 0);
      startD.setDate(startD.getDate() - daysBack);
      startYmd = tradeLocalYmd(startD.getTime());
      endYmd = todayYmd;
    } else {
      startYmd = getMockAccountStartYmd();
      endYmd = todayYmd;
    }

    return {
      mode: mode,
      startYmd: startYmd,
      endYmd: endYmd,
      startMs: ymdToLocalStartMs(startYmd),
      endMs: ymdToLocalEndMs(endYmd),
    };
  }

  function applyHistoryPeriodRangeDisplay() {
    var bounds = getHistoryPeriodBounds();
    var isCustom = historyPeriodMode === 'custom';
    var fromEl = document.getElementById('historyDateFrom');
    var toEl = document.getElementById('historyDateTo');
    var rangeWrap = document.getElementById('historyRangeWrap');
    if (rangeWrap) rangeWrap.hidden = false;

    if (fromEl) {
      if (!isCustom) fromEl.value = bounds.startYmd;
      fromEl.readOnly = !isCustom;
      fromEl.disabled = false;
      fromEl.classList.toggle('history-date-input--readonly', !isCustom);
      fromEl.title = isCustom ? '조회 시작일' : '선택한 조회 기간의 시작일(변경 불가)';
    }
    if (toEl) {
      if (!isCustom) toEl.value = bounds.endYmd;
      toEl.readOnly = !isCustom;
      toEl.disabled = false;
      toEl.classList.toggle('history-date-input--readonly', !isCustom);
      toEl.title = isCustom ? '조회 종료일' : '선택한 조회 기간의 종료일(변경 불가)';
    }
  }

  function syncHistoryPeriodChipUi() {
    document.querySelectorAll('[data-history-period]').forEach(function (btn) {
      var p = btn.getAttribute('data-history-period') || 'all';
      var on = p === historyPeriodMode;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    applyHistoryPeriodRangeDisplay();
  }

  function setHistoryPeriodMode(mode) {
    var allowed = ['all', '7d', '30d', '90d', 'custom'];
    historyPeriodMode = allowed.indexOf(mode) >= 0 ? mode : 'all';
    if (historyPeriodMode === 'custom') {
      var today = tradeLocalYmd(Date.now());
      var fromEl = document.getElementById('historyDateFrom');
      var toEl = document.getElementById('historyDateTo');
      if (fromEl && !fromEl.value) fromEl.value = today;
      if (toEl && !toEl.value) toEl.value = today;
    }
    syncHistoryPeriodChipUi();
    renderHistory();
  }

  function resetHistoryPeriodDefault() {
    historyPeriodMode = 'all';
    syncHistoryPeriodChipUi();
  }

  /** 등락·손익 색: 보합 flat, 상승 up(빨강), 하락 down(파랑) */
  function changeDirClass(n) {
    const x = Number(n);
    if (Number.isNaN(x)) return 'flat';
    if (x > 1e-9) return 'up';
    if (x < -1e-9) return 'down';
    return 'flat';
  }

  function formatMarketChangeRateStr(rate) {
    var r = Number(rate);
    if (!Number.isFinite(r)) return '—';
    var s = r.toFixed(2) + '%';
    if (r > 1e-9) return '+' + s;
    return s;
  }

  function getDiscoveryQuoteSnapshot(code) {
    var c = String(code || '').trim();
    if (!isSixDigitCode(c)) return null;
    var row = document.querySelector('.discovery-row[data-code="' + c + '"]');
    if (!row) return null;
    var enc = row.getAttribute('data-name') || '';
    var name = '';
    try {
      name = enc ? decodeURIComponent(enc) : '';
    } catch (e) {
      name = enc;
    }
    return {
      name: name,
      price: parseFloat(row.getAttribute('data-price') || '0', 10),
      changeRate: parseFloat(row.getAttribute('data-change-rate') || '0', 10),
    };
  }

  function updateSimHoldingDetailHead(opts) {
    opts = opts || {};
    var name = String(opts.name != null ? opts.name : '—').trim() || '—';
    var code = String(opts.code != null ? opts.code : '').trim();
    var price = Number(opts.price);
    var rate = Number(opts.changeRate);

    var nameEl = document.getElementById('simHoldingDetailName');
    var codeEl = document.getElementById('simHoldingDetailCode');
    var priceEl = document.getElementById('simHoldingDetailPrice');
    var changeEl = document.getElementById('simHoldingDetailChange');

    if (nameEl) nameEl.textContent = name;
    if (codeEl) {
      if (isSixDigitCode(code)) {
        codeEl.textContent = code;
        codeEl.hidden = false;
      } else if (code) {
        codeEl.textContent = code;
        codeEl.hidden = false;
      } else {
        codeEl.textContent = '';
        codeEl.hidden = true;
      }
    }
    if (priceEl) {
      priceEl.textContent = Number.isFinite(price) && price > 0 ? formatCurrency(price) : '—';
    }
    if (changeEl) {
      var dir = Number.isFinite(rate) ? changeDirClass(rate) : 'flat';
      changeEl.className = 'sim-holding-detail-change ' + dir;
      changeEl.textContent = Number.isFinite(rate) ? formatMarketChangeRateStr(rate) : '—';
    }

    if (Number.isFinite(price) && price > 0) simHoldingDetailState.quotePrice = price;
    if (Number.isFinite(rate)) simHoldingDetailState.quoteChangeRate = rate;
  }

  function refreshSimHoldingDetailHeadFromApi(code) {
    var c = String(code || '').trim();
    if (!isSixDigitCode(c)) return;
    fetch(simApiBase() + '/api/mock/traded-value-rank?limit=20&q=' + encodeURIComponent(c), {
      credentials: 'include',
    })
      .then(function (res) {
        return res.json().catch(function () {
          return {};
        });
      })
      .then(function (data) {
        if (!data.success || !Array.isArray(data.items)) return;
        var sheet = document.getElementById('simHoldingDetailSheet');
        if (!sheet || sheet.hasAttribute('hidden')) return;
        var stCode = String(simHoldingDetailState.code || '').trim();
        if (stCode !== c) return;
        var match = null;
        for (var i = 0; i < data.items.length; i++) {
          if (String(data.items[i].code || '').trim() === c) {
            match = data.items[i];
            break;
          }
        }
        if (!match) return;
        updateSimHoldingDetailHead({
          name: simHoldingDetailState.name || match.name,
          code: c,
          price: Number(match.price || simHoldingDetailState.quotePrice || 0),
          changeRate: Number(match.change_rate || 0),
        });
      })
      .catch(function () { /* ignore */ });
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

  async function simIsLoggedIn() {
    try {
      var res = await fetch(simApiBase() + '/api/auth/me', { credentials: 'include' });
      var data = await res.json().catch(function () {
        return {};
      });
      return !!(res.ok && data.success && data.user);
    } catch (e) {
      return false;
    }
  }

  var simPendingView = null;

  async function requireSimLogin(nextView) {
    var logged = await simIsLoggedIn();
    if (logged) return true;
    simPendingView = nextView || null;
    if (typeof openLoginModal === 'function') openLoginModal();
    return false;
  }

  function simHandleUnauthorized() {
    if (typeof openLoginModal === 'function') openLoginModal();
  }

  function renderSimPnlLoginRequired() {
    setMockPnlHint('');
    var listEl = document.getElementById('simPnlSalesList');
    if (listEl) {
      listEl.innerHTML = '<div class="sim-pnl-empty">로그인 후 이용할 수 있습니다.</div>';
    }
    var totalEl = document.getElementById('simPnlTotal');
    if (totalEl) {
      totalEl.textContent = '—';
      totalEl.className = 'sim-pnl-total';
    }
  }

  function navigateSimMainView(view) {
    var v = String(view || 'portfolio');
    if (v === 'pnl' || v === 'ranking' || v === 'reset') {
      requireSimLogin(v).then(function (ok) {
        if (ok) setSimMainView(v);
      });
      return;
    }
    setSimMainView(v);
  }

  async function simToggleWatchlist(code, name) {
    var logged = await simIsLoggedIn();
    if (!logged) {
      if (typeof openLoginModal === 'function') openLoginModal();
      return;
    }
    var c = String(code || '').trim();
    if (!/^\d{6}$/.test(c)) return;
    try {
      var res = await fetch(simApiBase() + '/api/watchlist/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: c }),
      });
      var data = await res.json().catch(function () {
        return {};
      });
      if (res.status === 401) {
        simHandleUnauthorized();
        return;
      }
      if (!res.ok || !data.success) {
        alert(data.message || '처리하지 못했습니다.');
        return;
      }
      if (data.in_watchlist) {
        var displayName = String(name || '').trim() || c;
        simWatchlistItems = simWatchlistItems.filter(function (i) {
          return String(i.code) !== c;
        });
        simWatchlistItems.unshift({ code: c, name: displayName, created_at: new Date().toISOString() });
      } else {
        simWatchlistItems = simWatchlistItems.filter(function (i) {
          return String(i.code) !== c;
        });
      }
      simRenderWatchlistChips();
    } catch (e) {
      alert('네트워크 오류입니다.');
    }
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
        '<div class="watchlist-chip watchlist-chip--aside" data-code="' +
          c +
          '"><button type="button" class="watchlist-chip-main" data-code="' +
          c +
          '"><div class="watchlist-chip-inner">' +
          logoBlock +
          '<span class="watchlist-chip-text"><span class="watchlist-chip-name">' +
          n +
          '</span><span class="watchlist-chip-code">' +
          c +
          '</span></span></div></button><button type="button" class="watch-heart-btn is-on watchlist-chip-heart" data-code="' +
          c +
          '" title="관심 해제" aria-label="관심 해제" aria-pressed="true">♥</button></div>',
      );
    }
    host.innerHTML = '<div class="watchlist-chip-scroller--aside" role="list">' + parts.join('') + '</div>';
    bindStockLogosIn(host);
    host.querySelectorAll('.watchlist-chip-main').forEach(function (btn) {
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
        var rateOpt = tr ? parseFloat(tr.getAttribute('data-change-rate') || '', 10) : NaN;
        var volOpt = null;
        var tvOpt = null;
        if (tr) {
          var vpv = parseFloat(tr.getAttribute('data-volume') || '', 10);
          var tpv = parseFloat(tr.getAttribute('data-traded-value') || '', 10);
          if (Number.isFinite(vpv)) volOpt = vpv;
          if (Number.isFinite(tpv)) tvOpt = tpv;
        }
        applyQuoteToTrade(cd, price, name || cd);
        openSimStockDetailFromDiscovery(
          cd,
          price,
          name || cd,
          volOpt,
          tvOpt,
          Number.isFinite(rateOpt) ? rateOpt : null
        );
      });
    });
    host.querySelectorAll('.watchlist-chip-heart').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var cd = btn.getAttribute('data-code');
        if (!cd || !/^\d{6}$/.test(cd)) return;
        var nm = '';
        for (var k = 0; k < simWatchlistItems.length; k++) {
          if (String(simWatchlistItems[k].code) === cd) {
            nm = String(simWatchlistItems[k].name || simWatchlistItems[k].code || cd);
            break;
          }
        }
        simToggleWatchlist(cd, nm);
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
      simPendingView = null;
      if (simMainView === 'pnl' || simMainView === 'ranking' || simMainView === 'reset') {
        setSimMainView('portfolio');
      }
      if (typeof window.simClearWatchlistUi === 'function') {
        window.simClearWatchlistUi();
      }
      clearMockOrderBoardLocal();
      loadPortfolioFromServer().then(function () {
        updatePortfolio();
        renderHoldings();
        renderHistory();
      });
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
      if (simPendingView) {
        var pending = simPendingView;
        simPendingView = null;
        setSimMainView(pending);
      } else {
        maybeRefreshRealizedPnl();
        maybeRefreshMockRanking();
      }
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
    accountCreatedMs: 0,
  };

  /** 거래 내역 탭: all | buy | sell */
  let historyViewFilter = 'all';

  /**
   * 비우기 이후: 서버에서 다시 받아도 이 시각(atMs) 이하 체결은 목록에 넣지 않음(새출발).
   * null이면 서버 체결 전부 표시. 복구 버튼으로 null로 되돌림.
   */
  let historyDisplayCutoffMs = null;

  /** 포트폴리오 | 수익분석 | 이달 랭킹 메인 뷰 */
  let simMainView = 'portfolio';
  let simRankingLoading = false;
  let simRankingCache = null;
  let simRankingExpanded = false;
  const SIM_RANKING_REST_PREVIEW = 5;
  const SIM_RANKING_MASCOT_SRC = 'assets/mascot2/success.png?v=20260607';
  let pnlGranularity = 'day';
  let pnlAnchorDate = new Date();
  let pnlCache = null;
  let pnlLoading = false;
  /** 매수/매도 API 처리 중 중복 클릭 방지 */
  let tradeSubmitInFlight = false;

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

  let simWorkspacePaneSyncBound = false;

  function syncSimWorkspacePaneHeight() {
    var workspace = document.querySelector('.sim-workspace');
    var main = document.querySelector('.simulation-main');
    var sidebar = document.querySelector('.market-sidebar');
    if (!workspace || !main || !sidebar) return;

    sidebar.style.height = '';
    sidebar.style.maxHeight = '';
    workspace.classList.remove('sim-workspace--pane-synced');
  }

  function bindSimWorkspacePaneSync() {
    if (simWorkspacePaneSyncBound) return;
    simWorkspacePaneSyncBound = true;
    var main = document.querySelector('.simulation-main');
    if (main && typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function () {
        syncSimWorkspacePaneHeight();
      });
      ro.observe(main);
    }
    window.addEventListener('resize', syncSimWorkspacePaneHeight);
  }

  function setSimMainView(view) {
    var v = String(view || 'portfolio');
    if (v === 'pnl' || v === 'ranking' || v === 'reset') simMainView = v;
    else simMainView = 'portfolio';
    var portPanel = document.getElementById('simViewPortfolio');
    var pnlPanel = document.getElementById('simViewRealizedPnl');
    var rankPanel = document.getElementById('simViewRanking');
    var resetPanel = document.getElementById('simViewReset');
    var tabPort = document.getElementById('simViewTabPortfolio');
    var tabPnl = document.getElementById('simViewTabPnl');
    var tabRank = document.getElementById('simViewTabRanking');
    var tabReset = document.getElementById('simViewTabReset');
    var isPort = simMainView === 'portfolio';
    var isPnl = simMainView === 'pnl';
    var isRank = simMainView === 'ranking';
    var isReset = simMainView === 'reset';
    if (portPanel) portPanel.hidden = !isPort;
    if (pnlPanel) pnlPanel.hidden = !isPnl;
    if (rankPanel) rankPanel.hidden = !isRank;
    if (resetPanel) resetPanel.hidden = !isReset;
    if (tabPort) {
      tabPort.classList.toggle('active', isPort);
      tabPort.setAttribute('aria-selected', isPort ? 'true' : 'false');
    }
    if (tabPnl) {
      tabPnl.classList.toggle('active', isPnl);
      tabPnl.setAttribute('aria-selected', isPnl ? 'true' : 'false');
    }
    if (tabRank) {
      tabRank.classList.toggle('active', isRank);
      tabRank.setAttribute('aria-selected', isRank ? 'true' : 'false');
    }
    if (tabReset) {
      tabReset.classList.toggle('active', isReset);
      tabReset.setAttribute('aria-selected', isReset ? 'true' : 'false');
    }
    if (isPnl) loadRealizedPnl();
    if (isRank) loadMockMonthlyRanking();
    if (isReset) setSimResetHint('');
    requestAnimationFrame(syncSimWorkspacePaneHeight);
  }

  function setSimRankingHint(html) {
    var el = document.getElementById('simRankingHint');
    if (!el) return;
    if (html) {
      el.style.display = 'block';
      el.innerHTML = html;
    } else {
      el.style.display = 'none';
      el.innerHTML = '';
    }
  }

  function formatRankingReturn(rate) {
    var n = Number(rate);
    if (!Number.isFinite(n)) return '—';
    var sign = n > 0 ? '+' : '';
    return sign + n.toFixed(2) + '%';
  }

  function rankingRateClass(rate) {
    var n = Number(rate);
    if (n > 0) return 'up';
    if (n < 0) return 'down';
    return 'flat';
  }

  function rankingRateHtml(rate, extraClass) {
    return (
      '<span class="sim-ranking-rate ' +
      rankingRateClass(rate) +
      (extraClass ? ' ' + extraClass : '') +
      '">' +
      escapeHtml(formatRankingReturn(rate)) +
      '</span>'
    );
  }

  function buildRankingPlaceholderRow(rank) {
    return {
      rank: rank,
      nickname: null,
      return_rate: null,
      is_me: false,
      _placeholder: true,
    };
  }

  function buildRankingDisplayItems(items, expanded) {
    items = Array.isArray(items) ? items : [];
    var byRank = {};
    items.forEach(function (it) {
      var r = Number(it.rank);
      if (r > 0) byRank[r] = it;
    });

    var maxRank;
    if (expanded) {
      maxRank = Math.max(
        3,
        items.reduce(function (max, it) {
          return Math.max(max, Number(it.rank) || 0);
        }, 0),
      );
    } else {
      maxRank = SIM_RANKING_REST_PREVIEW;
    }

    var rows = [];
    for (var r = 1; r <= maxRank; r++) {
      if (byRank[r]) {
        rows.push(byRank[r]);
      } else if (r <= 3 || !expanded) {
        rows.push(buildRankingPlaceholderRow(r));
      }
    }
    return rows;
  }

  function renderRankingSpeechBubble(first) {
    var hasFirst = first && String(first.nickname || '').trim();
    var name = hasFirst ? escapeHtml(String(first.nickname).trim()) : '—';
    var bubbleText = hasFirst
      ? '이번달 모의투자 1등은 <strong>' + name + '</strong>님입니다~! 축하합니다!'
      : '이번달 모의투자 1등은 <strong>—</strong> 님입니다~! 축하합니다!';
    var leaderAvatar = '';
    if (hasFirst && typeof jurinAvatarHtml === 'function') {
      leaderAvatar =
        '<div class="sim-ranking-bubble-avatar">' +
        jurinAvatarHtml({
          avatarUrl: first.avatarUrl,
          displayName: first.nickname,
          sizeClass: 'sim-ranking-avatar sim-ranking-avatar--bubble',
        }) +
        '</div>';
    }
    return (
      '<div class="sim-ranking-aside">' +
      '<div class="sim-ranking-bubble">' +
      leaderAvatar +
      '<p class="sim-ranking-bubble-text">' +
      bubbleText +
      '</p>' +
      '</div>' +
      '<div class="sim-ranking-mascot-wrap" aria-hidden="true">' +
      '<img src="' +
      SIM_RANKING_MASCOT_SRC +
      '" alt="" width="96" height="96" decoding="async" loading="lazy">' +
      '</div>' +
      '</div>'
    );
  }

  function renderRankingListRow(it) {
    var rank = Number(it.rank) || 0;
    var me = it.is_me ? ' sim-ranking-list-row--me' : '';
    var isPlaceholder =
      !!it._placeholder || !String(it.nickname || '').trim();
    var name = isPlaceholder ? '—' : escapeHtml(it.nickname || '주린이');
    var rateCell =
      isPlaceholder && !Number.isFinite(Number(it.return_rate))
        ? '<span class="sim-ranking-rate sim-ranking-rate--list flat">—</span>'
        : rankingRateHtml(it.return_rate, 'sim-ranking-rate--list');
    var topCls = rank >= 1 && rank <= 3 ? ' sim-ranking-list-row--top sim-ranking-list-row--top' + rank : '';
    var avatarHtml = '';
    if (!isPlaceholder && typeof jurinAvatarHtml === 'function') {
      avatarHtml = jurinAvatarHtml({
        avatarUrl: it.avatarUrl,
        displayName: it.nickname || '주린이',
        sizeClass: 'sim-ranking-avatar',
      });
    }
    return (
      '<li class="sim-ranking-list-row' +
      me +
      topCls +
      '">' +
      '<span class="sim-ranking-list-rank">' +
      rank +
      '위</span>' +
      '<span class="sim-ranking-list-name">' +
      avatarHtml +
      '<span class="sim-ranking-list-name-text">' +
      name +
      '</span></span>' +
      rateCell +
      '</li>'
    );
  }

  function renderRankingHybridBoard(first, listItems, totalCount) {
    var listHtml =
      '<ul class="sim-ranking-list">' +
      listItems.map(renderRankingListRow).join('') +
      '</ul>';
    return (
      '<div class="sim-ranking-hybrid">' +
      '<div class="sim-ranking-list-panel">' +
      listHtml +
      '</div>' +
      renderRankingSpeechBubble(first) +
      '</div>'
    );
  }

  function updateRankingFooter(totalCount, hiddenCount) {
    var footerEl = document.getElementById('simRankingFooter');
    var moreBtn = document.getElementById('simRankingMoreBtn');
    if (!footerEl || !moreBtn) return;
    if (totalCount <= SIM_RANKING_REST_PREVIEW || hiddenCount <= 0) {
      footerEl.hidden = true;
      return;
    }
    footerEl.hidden = false;
    moreBtn.textContent = simRankingExpanded ? '랭킹 접기 ∧' : '전체 랭킹 보기 ›';
    moreBtn.setAttribute('aria-expanded', simRankingExpanded ? 'true' : 'false');
    moreBtn.setAttribute(
      'aria-label',
      simRankingExpanded ? '랭킹 목록 접기' : '전체 랭킹 ' + hiddenCount + '명 더 보기',
    );
  }

  function renderMockMonthlyRanking(data) {
    var bodyEl = document.getElementById('simRankingBody');
    var periodEl = document.getElementById('simRankingPeriodLabel');
    var myEl = document.getElementById('simRankingMyRank');
    if (!bodyEl) return;
    if (periodEl) {
      periodEl.textContent = data.period_label || '이달의 랭킹';
    }
    if (myEl) {
      if (data.my_rank != null && Number(data.my_rank) > 0) {
        myEl.hidden = false;
        myEl.textContent = '내 순위: ' + data.my_rank + '위';
      } else if (data.my_rank === null && data.total_participants > 0) {
        myEl.hidden = false;
        myEl.textContent = '내 순위: —';
      } else {
        myEl.hidden = false;
        myEl.textContent = '내 순위: —';
      }
    }
    var items = Array.isArray(data.items) ? data.items : [];
    var first =
      items.find(function (it) {
        return Number(it.rank) === 1;
      }) || null;
    var displayItems = buildRankingDisplayItems(items, simRankingExpanded);
    var hiddenCount = items.length
      ? Math.max(0, items.length - (simRankingExpanded ? items.length : SIM_RANKING_REST_PREVIEW))
      : 0;

    bodyEl.innerHTML = renderRankingHybridBoard(first, displayItems, items.length);
    updateRankingFooter(items.length, hiddenCount);
  }

  async function loadMockMonthlyRanking(force) {
    if (simRankingLoading) return;
    if (!force && simRankingCache) {
      renderMockMonthlyRanking(simRankingCache);
      return;
    }
    simRankingExpanded = false;
    var bodyEl = document.getElementById('simRankingBody');
    if (bodyEl) {
      bodyEl.innerHTML = renderRankingHybridBoard(null, buildRankingDisplayItems([], false), 0);
    }
    var footerEl = document.getElementById('simRankingFooter');
    if (footerEl) footerEl.hidden = true;
    setSimRankingHint('');
    simRankingLoading = true;
    try {
      var res = await fetch(simApiBase() + '/api/mock/monthly-ranking', { credentials: 'include' });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok || !data.success) {
        setSimRankingHint(escapeHtml(data.message || '랭킹을 불러오지 못했습니다.'));
        if (bodyEl) {
          bodyEl.innerHTML = renderRankingHybridBoard(
            null,
            buildRankingDisplayItems([], false),
            0,
          );
        }
        return;
      }
      simRankingCache = data;
      renderMockMonthlyRanking(data);
    } catch (e) {
      setSimRankingHint('네트워크 오류입니다. 백엔드 연결을 확인해 주세요.');
      if (bodyEl) {
        bodyEl.innerHTML = renderRankingHybridBoard(
          null,
          buildRankingDisplayItems([], false),
          0,
        );
      }
    } finally {
      simRankingLoading = false;
    }
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

    var noteEl = document.getElementById('simPnlNote');
    if (noteEl && data.note) noteEl.textContent = data.note;

    var listEl = document.getElementById('simPnlSalesList');
    if (!listEl) return;

    var trades = Array.isArray(data.sales_trades) ? data.sales_trades : [];
    if (trades.length === 0) {
      listEl.innerHTML =
        '<div class="sim-pnl-empty">이 기간에 매도 체결이 없습니다.</div>';
      return;
    }

    listEl.innerHTML = trades
      .map(function (t) {
        var r = Number(t.realized || 0);
        var code = t.code || '';
        var name = t.name || code || '';
        var atMs = t.executed_at ? new Date(t.executed_at).getTime() : 0;
        var timeStr = formatTradeTimeOnly(atMs);
        var metaParts = [
          String(t.quantity || 0) + '주',
          '매도 ' + formatCurrency(Number(t.sell_price || 0)),
        ];
        if (timeStr && timeStr !== '—') metaParts.push(timeStr);
        return (
          '<div class="sim-pnl-trade">' +
          '<div class="sim-pnl-trade-main">' +
          '<div class="sim-pnl-trade-identity">' +
          orderStatusLogoHtml(code, name) +
          '<div class="sim-pnl-trade-text">' +
          '<div class="sim-pnl-trade-name">' +
          escapeHtml(name) +
          '</div>' +
          '<div class="sim-pnl-trade-meta">' +
          escapeHtml(metaParts.join(' · ')) +
          '</div>' +
          '</div></div></div>' +
          '<div class="sim-pnl-trade-amt ' +
          changeDirClass(r) +
          '">' +
          formatPnlSigned(r) +
          '</div></div>'
        );
      })
      .join('');
    bindStockLogosIn(listEl);
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
        renderSimPnlLoginRequired();
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
        navigateSimMainView(btn.getAttribute('data-sim-view'));
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
    var card = document.getElementById('realizedProfitCard');
    if (card) {
      card.addEventListener('click', function () {
        navigateSimMainView('pnl');
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigateSimMainView('pnl');
        }
      });
    }
    var rankingMoreBtn = document.getElementById('simRankingMoreBtn');
    if (rankingMoreBtn && rankingMoreBtn.getAttribute('data-ranking-more-bound') !== '1') {
      rankingMoreBtn.setAttribute('data-ranking-more-bound', '1');
      rankingMoreBtn.addEventListener('click', function () {
        simRankingExpanded = !simRankingExpanded;
        if (simRankingCache) renderMockMonthlyRanking(simRankingCache);
      });
    }
    var mockResetActionBtn = document.getElementById('simMockResetActionBtn');
    if (mockResetActionBtn && mockResetActionBtn.getAttribute('data-mock-reset-bound') !== '1') {
      mockResetActionBtn.setAttribute('data-mock-reset-bound', '1');
      mockResetActionBtn.addEventListener('click', async function () {
        if (!(await simIsLoggedIn())) {
          if (typeof openLoginModal === 'function') openLoginModal();
          return;
        }
        openMockResetConfirmModal();
      });
    }
    var mockResetConfirmBtn = document.getElementById('simMockResetConfirmBtn');
    if (mockResetConfirmBtn && mockResetConfirmBtn.getAttribute('data-mock-reset-bound') !== '1') {
      mockResetConfirmBtn.setAttribute('data-mock-reset-bound', '1');
      mockResetConfirmBtn.addEventListener('click', function () {
        resetMockAccount();
      });
    }
    syncPnlGranularityChips();
  }

  function maybeRefreshRealizedPnl() {
    if (simMainView === 'pnl') loadRealizedPnl();
  }

  function maybeRefreshMockRanking() {
    if (simMainView === 'ranking') {
      simRankingCache = null;
      loadMockMonthlyRanking(true);
    }
  }

  var simMockResetBusy = false;

  function setSimResetHint(html) {
    var el = document.getElementById('simResetHint');
    if (!el) return;
    if (html) {
      el.style.display = 'block';
      el.innerHTML = html;
    } else {
      el.style.display = 'none';
      el.innerHTML = '';
    }
  }

  function formatMockInitialCashLabel(amount) {
    var n = Number(amount || 0);
    if (n >= 10000 && n % 10000 === 0) {
      return (n / 10000).toLocaleString() + '만원';
    }
    return formatCurrency(n);
  }

  function openMockResetConfirmModal() {
    var initialLabel = formatMockInitialCashLabel(
      (portfolio && portfolio.initialCash) || 5000000,
    );
    var descEl = document.getElementById('simMockResetConfirmDesc');
    if (descEl) {
      descEl.textContent =
        '모든 내역(보유 종목, 거래·주문, 수익 분석)과 예수금이 ' +
        initialLabel +
        '으로 돌아갑니다.';
    }
    var modal = document.getElementById('simMockResetConfirmModal');
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    var submitBtn = document.getElementById('simMockResetConfirmBtn');
    if (submitBtn) submitBtn.focus();
  }

  function closeMockResetConfirmModal() {
    var modal = document.getElementById('simMockResetConfirmModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  async function resetMockAccount() {
    if (simMockResetBusy) return;
    closeMockResetConfirmModal();
    if (!(await simIsLoggedIn())) {
      if (typeof openLoginModal === 'function') openLoginModal();
      return;
    }

    var resetBtn = document.getElementById('simMockResetActionBtn');
    var resetConfirmBtn = document.getElementById('simMockResetConfirmBtn');
    simMockResetBusy = true;
    if (resetBtn) resetBtn.disabled = true;
    if (resetConfirmBtn) resetConfirmBtn.disabled = true;
    setSimResetHint('');

    try {
      var res = await fetch(simApiBase() + '/api/mock/reset', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok || !data.success) {
        setSimResetHint(escapeHtml(data.message || '초기화에 실패했습니다.'));
        return;
      }

      simRankingCache = null;
      simRankingExpanded = false;
      pnlCache = null;
      clearMockOrderBoardLocal();
      await loadPortfolioFromServer();
      updatePortfolio();
      renderHoldings();
      renderHistory();
      setSimMainView('portfolio');

      openSimTradeNoticeModal({
        variant: 'simple',
        title: '초기화 완료',
        lead:
          '모의투자 내역이 모두 삭제되었고, 예수금이 ' +
          formatMockInitialCashLabel(data.initial_cash || data.cash_balance || 5000000) +
          '으로 돌아갔습니다.',
        showPrimary: false,
        showConfirm: true,
        confirmLabel: '확인',
      });
    } catch (e) {
      setSimResetHint('네트워크 오류입니다. 백엔드 연결을 확인해 주세요.');
    } finally {
      simMockResetBusy = false;
      if (resetBtn) resetBtn.disabled = false;
      if (resetConfirmBtn) resetConfirmBtn.disabled = false;
    }
  }

  function wrapSimLoginModalClose() {
    if (window.__jurinSimCloseWrapped) return;
    var nativeClose = window.closeLoginModal;
    if (typeof nativeClose !== 'function') return;
    window.__jurinSimCloseWrapped = true;
    window.closeLoginModal = function () {
      nativeClose();
      simIsLoggedIn().then(function (logged) {
        if (!logged) {
          var base = simApiBase().replace(/\/$/, '');
          window.location.replace(base + '/주린닷컴홈피.html');
        }
      });
    };
  }

  // 페이지 로드 시 초기화 (미로그인 시 진입 즉시 로그인 모달)
  document.addEventListener('DOMContentLoaded', async function() {
    localizeSimulationUi();
    wrapSimLoginModalClose();
    if (typeof refreshAuthNav === 'function') refreshAuthNav();
    if (!(await simIsLoggedIn()) && typeof openLoginModal === 'function') {
      openLoginModal();
    }

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
    var sellQtyMinus = document.getElementById('sellModalQtyMinus');
    var sellQtyPlus = document.getElementById('sellModalQtyPlus');
    if (sellQtyMinus) sellQtyMinus.addEventListener('click', function () { bumpHoldingModalQty('sellModalQty', -1); });
    if (sellQtyPlus) sellQtyPlus.addEventListener('click', function () { bumpHoldingModalQty('sellModalQty', 1); });
    var buyQtyMinus = document.getElementById('holdingBuyQtyMinus');
    var buyQtyPlus = document.getElementById('holdingBuyQtyPlus');
    if (buyQtyMinus) buyQtyMinus.addEventListener('click', function () { bumpHoldingModalQty('holdingBuyQty', -1); });
    if (buyQtyPlus) buyQtyPlus.addEventListener('click', function () { bumpHoldingModalQty('holdingBuyQty', 1); });
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

    var orderStatusListEl = document.getElementById('orderStatusList');
    if (orderStatusListEl) {
      orderStatusListEl.addEventListener('click', function (e) {
        var editBtn = e.target.closest('[data-pending-edit]');
        if (editBtn) {
          e.preventDefault();
          var editId = parseInt(editBtn.getAttribute('data-pending-edit'), 10);
          if (!Number.isNaN(editId)) openPendingOrderEditModal(editId);
          return;
        }
        var cancelBtn = e.target.closest('[data-pending-cancel]');
        if (!cancelBtn) return;
        e.preventDefault();
        var pid = parseInt(cancelBtn.getAttribute('data-pending-cancel'), 10);
        if (!Number.isNaN(pid)) cancelPendingOrder(pid);
      });
    }
    var pendingEditPlus = document.getElementById('pendingOrderEditLimitPricePlus');
    var pendingEditMinus = document.getElementById('pendingOrderEditLimitPriceMinus');
    if (pendingEditPlus) {
      pendingEditPlus.addEventListener('click', function () {
        bumpPendingOrderEditLimitPrice(1);
      });
    }
    if (pendingEditMinus) {
      pendingEditMinus.addEventListener('click', function () {
        bumpPendingOrderEditLimitPrice(-1);
      });
    }

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

    resetHistoryPeriodDefault();
    document.querySelectorAll('[data-history-period]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        setHistoryPeriodMode(btn.getAttribute('data-history-period') || 'all');
      });
    });
    function onHistoryRangeChange() {
      if (historyPeriodMode !== 'custom') return;
      normalizeHistoryCustomRange();
      renderHistory();
    }
    var historyDateFrom = document.getElementById('historyDateFrom');
    var historyDateTo = document.getElementById('historyDateTo');
    if (historyDateFrom) {
      historyDateFrom.addEventListener('change', onHistoryRangeChange);
      historyDateFrom.addEventListener('input', onHistoryRangeChange);
    }
    if (historyDateTo) {
      historyDateTo.addEventListener('change', onHistoryRangeChange);
      historyDateTo.addEventListener('input', onHistoryRangeChange);
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
        var changeRate = parseFloat(tr.getAttribute('data-change-rate') || '0', 10);
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
          Number.isFinite(tvPre) ? tvPre : null,
          Number.isFinite(changeRate) ? changeRate : null
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
      var cashM = document.getElementById('insufficientCashModal');
      if (cashM && cashM.classList.contains('is-open')) {
        closeInsufficientCashModal();
        return;
      }
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
    bindSimWorkspacePaneSync();

    window.addEventListener('storage', function (e) {
      if (!e || !e.key) return;
      if (e.key === LS_MOCK_EVENTS) reloadOrderStatusEventsFromStorage();
      if (e.key === LS_MOCK_PENDING || e.key === LS_MOCK_PENDING_SEQ) reloadPendingOrdersFromStorage();
    });
    window.addEventListener('jurin-mock-order-board-updated', function (ev) {
      var t = ev && ev.detail ? ev.detail.type : '';
      if (t === 'pending') reloadPendingOrdersFromStorage();
      else reloadOrderStatusEventsFromStorage();
    });

    await simRefreshWatchlist();
    await loadPortfolioFromServer();
    updatePortfolio();
    renderHoldings();
    renderHistory();
    maybeRefreshRealizedPnl();
    if (isSellMarketMode()) setSellPriceType(true);
    renderOrderStatusBoard();
    loadTradedValueBoard();
    requestAnimationFrame(syncSimWorkspacePaneHeight);
    var sellLimInp = document.getElementById('sellModalLimitPrice');
    if (sellLimInp) sellLimInp.addEventListener('input', updateSellModalEst);
    setInterval(async function () {
      await loadPortfolioFromServer();
      updatePortfolio();
      renderHoldings();
      renderHistory();
      maybeRefreshRealizedPnl();
      maybeRefreshMockRanking();
      await loadTradedValueBoard({ silent: true });
      await processPendingOrders();
    }, 25000);
  });

  function discoveryTableStateRowHtml(message, extraClass) {
    var cls = 'discovery-table-state-cell' + (extraClass ? ' ' + extraClass : '');
    return (
      '<tr class="discovery-table-state-row">' +
      '<td aria-hidden="true"></td>' +
      '<td colspan="2" class="' + cls + '">' + message + '</td>' +
      '<td colspan="3" class="discovery-table-state-rest" aria-hidden="true"></td>' +
      '</tr>'
    );
  }

  function syncDiscoveryTableLayout() {
    var table = document.querySelector('.market-sidebar .discovery-table');
    var tbody = document.getElementById('discoveryTableBody');
    if (!table) return;
    table.classList.toggle('is-state-only', !!(tbody && tbody.querySelector('.discovery-table-state-row')));
  }

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
      tbody.innerHTML = discoveryTableStateRowHtml('시세를 불러오는 중...');
      syncDiscoveryTableLayout();
    }

    try {
      var rankUrl = `${simApiBase()}/api/mock/traded-value-rank?limit=100`;
      if (q) rankUrl += '&q=' + encodeURIComponent(q);
      const rankAbort = new AbortController();
      const rankTimer = setTimeout(function () {
        rankAbort.abort();
      }, 25000);
      const res = await fetch(rankUrl, { signal: rankAbort.signal });
      clearTimeout(rankTimer);
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
        const priceCell =
          '<div class="discovery-price-stack">' +
          '<div class="discovery-price">' +
          formatCurrency(Number(item.price || 0)) +
          '</div>' +
          '<div class="holding-change ' +
          dir +
          '">' +
          rateStr +
          '</div></div>';
        return `
          <tr class="discovery-row" data-code="${escapeHtmlAttr(codeStr)}" data-name="${encodeURIComponent(nameStr)}" data-price="${Number(item.price || 0)}" data-change-rate="${rate}" data-open-price="${openPx > 0 ? openPx : ''}" data-volume="${Number(item.volume || 0)}" data-traded-value="${Number(item.traded_value || 0)}">
            <td>${idx + 1}</td>
            <td>${nameCell}</td>
            <td class="discovery-col-price">${priceCell}</td>
            <td>${openCell}</td>
            <td>${formatLargeNumber(Number(item.volume || 0))}</td>
            <td>${formatLargeCurrency(Number(item.traded_value || 0))}</td>
          </tr>
        `;
      }).join('');

      tbody.innerHTML = rows || discoveryTableStateRowHtml('표시할 데이터가 없습니다.');
    } catch (err) {
      if (silent) return;
      var errMsg =
        err && err.name === 'AbortError'
          ? '시세 조회 시간이 초과되었습니다. 서버를 재시작한 뒤 다시 시도해 주세요.'
          : err.message || '시세를 불러오지 못했습니다.';
      tbody.innerHTML = discoveryTableStateRowHtml(escapeHtml(errMsg), 'discovery-table-state-cell--error');
    }
    syncDiscoveryTableLayout();
    var rankScroll = document.querySelector('.market-sidebar-scroll');
    if (rankScroll) rankScroll.scrollLeft = 0;
    requestAnimationFrame(syncSimWorkspacePaneHeight);
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
        if (!isOrderbookOverlayOpen()) {
          clearOrderbookPoll();
          return;
        }
        refreshOrderbookPanel({ silent: true });
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
          accountCreatedMs: 0,
        };
        clearMockOrderBoardLocal();
        setMockPortfolioHint('');
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
        accountCreatedMs: parseOrderTimestamp(data.account.created_at),
      };
      syncHistoryPeriodChipUi();
      if (!mockOrderBoardHydratedFromLs) {
        restoreOrderBoardState();
        mockOrderBoardHydratedFromLs = true;
      }
      maybeRefreshRealizedPnl();
      maybeRefreshMockRanking();
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

  async function openBuyConfirmModal() {
    const stockEl = document.getElementById('tradeStock');
    const qtyEl = document.getElementById('tradeQuantity');
    const stock = (stockEl && stockEl.value || '').trim();
    const apiStock = getTradeStockForApi();
    let quantity = parseInt(qtyEl && qtyEl.value, 10);
    if (!stock || !apiStock) {
      openStockRequiredNoticeModal();
      return;
    }
    if (!(await requireSimLogin())) return;
    if (Number.isNaN(quantity) || quantity < 1) {
      quantity = 1;
      if (qtyEl) qtyEl.value = '1';
    }
    var codeHPre = document.getElementById('tradeStockCode');
    var cPre = codeHPre && codeHPre.value ? String(codeHPre.value).trim() : '';
    var limElPre = document.getElementById('tradeLimitPrice');
    var limPPre = limElPre ? parseLimitPriceInput(limElPre) : 0;
    var limPxCheck = isBuyMarketMode() ? 0 : limPPre;
    var stockLinePre = cPre ? stock + ' (' + cPre + ')' : stock;
    if (
      await showBuyInsufficientCashModal(quantity, limPxCheck, apiStock, {
        stock: stockLinePre,
        stockLabel: stock,
        market: isBuyMarketMode(),
        limitLabel: !isBuyMarketMode() && limPPre > 0 ? ' (지정가)' : '',
      })
    ) {
      return;
    }
    buyModalState = { stock: apiStock, quantity };
    const line = document.getElementById('buyModalStockLine');
    const qtyLine = document.getElementById('buyModalQtyLine');
    const priceLine = document.getElementById('buyModalPriceLine');
    var codeH = document.getElementById('tradeStockCode');
    var c = codeH && codeH.value ? String(codeH.value).trim() : '';
    var limEl = document.getElementById('tradeLimitPrice');
    var limP = limEl ? parseLimitPriceInput(limEl) : 0;
    if (line) line.innerHTML = formatTradeConfirmStockHtml(stock, c);
    if (qtyLine) qtyLine.textContent = quantity.toLocaleString() + '주';
    var buyCostBox = document.getElementById('buyModalCostBreakdown');
    if (priceLine) {
      var refPx = buyReferencePrice() || referencePriceForTick();
      if (isBuyMarketMode()) {
        setTradeConfirmPriceLine(priceLine, MARKET_PRICE_LABEL, '시장가');
        if (buyCostBox) {
          buyCostBox.innerHTML = '';
          buyCostBox.style.display = 'none';
        }
      } else if (limP > 0) {
        var execPx = resolveMockExecutionPrice('BUY', refPx, limP);
        if (execPx > 0 && execPx < limP) {
          setTradeConfirmPriceLine(priceLine, formatCurrency(execPx), '현재가 체결 예상');
        } else if (execPx > 0) {
          setTradeConfirmPriceLine(priceLine, formatCurrency(execPx), '지정가');
        } else {
          setTradeConfirmPriceLine(priceLine, formatCurrency(limP), '지정가 (예약)');
        }
        var unitPxForCost = execPx > 0 ? execPx : limP;
        var grossBuyEst = unitPxForCost > 0 ? unitPxForCost * quantity : 0;
        renderMockCostBreakdown(buyCostBox, 'BUY', grossBuyEst);
      } else {
        setTradeConfirmPriceLine(priceLine, formatCurrency(refPx), '시세 기준');
        var grossRef = refPx > 0 ? refPx * quantity : 0;
        renderMockCostBreakdown(buyCostBox, 'BUY', grossRef);
      }
    }

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
    if (!tryAcquireTradeSubmit()) return;
    try {
    const stockEl = document.getElementById('tradeStock');
    const qtyEl = document.getElementById('tradeQuantity');
    const stockRef = getTradeStockForApi();
    const stockLabel = getTradeStockDisplayName();
    let quantity = parseInt(qtyEl && qtyEl.value, 10);
    if (!stockRef) {
      openStockRequiredNoticeModal();
      return;
    }
    if (Number.isNaN(quantity) || quantity < 1) {
      quantity = 1;
      if (qtyEl) qtyEl.value = '1';
    }
    buyModalState = { stock: stockRef, quantity };
    var limEl2 = document.getElementById('tradeLimitPrice');
    var limPx = limEl2 ? parseLimitPriceInput(limEl2) : 0;
    if (isBuyMarketMode()) limPx = 0;
    try {
      var routedBuy = await handleLimitOrderSubmission({
        side: 'BUY',
        stock: stockLabel,
        stockRef: stockRef,
        quantity: quantity,
        limPx: limPx,
      });
      if (!routedBuy.ok) return;
      if (routedBuy.pending) {
        closeBuyModal();
        return;
      }

      const out = await executeTradeRequest('BUY', stockRef, quantity, limPx);
      const res = out.res;
      const data = out.data;
      if (res.status === 401) {
        closeBuyModal();
        simHandleUnauthorized();
        return;
      }
      if (!res.ok || !data.success) {
        if (isBalanceInsufficientMessage(data.message)) {
          var unitPxApi = await resolveBuyUnitPrice(limPx, stockRef);
          openInsufficientCashModal(validateBuyAffordability(quantity, unitPxApi), {
            stock: stockLabel,
            quantity: quantity,
            unitPx: unitPxApi,
            market: isBuyMarketMode(),
          });
          return;
        }
        pushOrderStatusEvent({
          stockRef: stockRef,
          stock: stockLabel,
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
        stockRef: tr.code || stockRef,
        stock: tr.name || stockLabel,
        side: 'BUY',
        mode: 'manual',
        status: 'executed',
        desiredPrice: limPx,
        executedPrice: Number(tr.price || 0),
        quantity: Number(tr.quantity || quantity),
      });
      showTradeFeedback(data, 'buy');
    } catch (err) {
      if (isBalanceInsufficientMessage(err.message)) {
        var unitPxCatch = await resolveBuyUnitPrice(limPx, stockRef);
        openInsufficientCashModal(validateBuyAffordability(quantity, unitPxCatch), {
          stock: stockLabel,
          quantity: quantity,
          unitPx: unitPxCatch,
          market: isBuyMarketMode(),
        });
        return;
      }
      alert(err.message || '구매 처리 중 오류가 발생했습니다.');
    }
    } finally {
      releaseTradeSubmit();
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
    var code = String(sellModalState.code || '').trim();
    if (inp) {
      if (plus) plus.disabled = !!market;
      if (minus) minus.disabled = !!market;
      if (cell) cell.classList.toggle('is-market-mode', !!market);
      if (market) {
        applyMarketPriceInputDisplay(inp, true);
      } else {
        applyMarketPriceInputDisplay(inp, false);
        applyLimitPriceIfEmpty(inp, 'SELL', refPx, isSixDigitCode(code) ? code : '');
      }
    }
    syncHoldingSellMarketUi();
    updateSellModalEst();
  }

  function syncHoldingSellQtyMeta() {
    var el = document.getElementById('sellModalHoldingQtyMeta');
    var max = Number(sellModalState.maxQty) || 0;
    if (el) {
      el.innerHTML = '보유 수량 <strong>' + max.toLocaleString() + '</strong> 주';
    }
  }

  function syncHoldingSellMarketUi() {
    var market = isHoldingSellMarketMode();
    var hint = document.getElementById('sellModalMarketHint');
    var notice = document.getElementById('sellModalMarketNotice');
    if (hint) hint.hidden = !market;
    if (notice) notice.hidden = !market;
    updateSellModalCtaSub();
  }

  function updateSellModalCtaSub() {
    var sub = document.getElementById('sellModalCtaSub');
    var qtyEl = document.getElementById('sellModalQty');
    if (!sub) return;
    if (!isHoldingSellMarketMode()) {
      sub.textContent = '';
      return;
    }
    var qty = qtyEl ? parseInt(qtyEl.value, 10) : NaN;
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    sub.textContent = '시장가로 ' + qty.toLocaleString() + '주 매도';
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
    var code = String(sellModalState.code || '').trim();
    if (inp) {
      if (plus) plus.disabled = !!market;
      if (minus) minus.disabled = !!market;
      if (cell) cell.classList.toggle('is-market-mode', !!market);
      if (market) {
        applyMarketPriceInputDisplay(inp, true);
      } else {
        applyMarketPriceInputDisplay(inp, false);
        applyLimitPriceIfEmpty(inp, 'BUY', refPx, isSixDigitCode(code) ? code : '');
      }
    }
    updateHoldingBuyEst();
  }

  function updateHoldingBuyEst() {
    var qtyEl = document.getElementById('holdingBuyQty');
    var totalEl = document.getElementById('holdingBuyEstTotal');
    var hcb = document.getElementById('holdingBuyCostBreakdown');
    if (!qtyEl || !totalEl) return;

    var qty = parseInt(qtyEl.value, 10);
    if (Number.isNaN(qty) || qty < 1) qty = 1;
    var ref = Number(sellModalState.unitPrice) || 0;
    var unit = ref;
    if (!isHoldingBuyMarketMode()) {
      var limIn = document.getElementById('holdingBuyLimitPrice');
      var lv = limIn ? parseLimitPriceInput(limIn) : 0;
      if (lv > 0) {
        var exec = resolveMockExecutionPrice('BUY', ref, lv);
        unit = exec > 0 ? exec : lv;
      } else {
        unit = 0;
      }
    }
    var grossHb = Math.max(0, qty * unit);
    if (grossHb > 0 && unit > 0) {
      var costs = estimateMockTradeCosts('BUY', grossHb);
      totalEl.textContent = formatCurrency(costs.netBuy);
      renderMockCostBreakdown(hcb, 'BUY', grossHb);
    } else {
      totalEl.textContent = '—';
      if (hcb) {
        hcb.innerHTML = '';
        hcb.style.display = 'none';
      }
    }
  }

  function bumpHoldingBuyLimitPrice(direction) {
    if (isHoldingBuyMarketMode()) return;
    var inp = document.getElementById('holdingBuyLimitPrice');
    if (!inp) return;
    var cur = parseLimitPriceInput(inp);
    var ref = Number(sellModalState.unitPrice) || 0;
    if (!Number.isFinite(ref) || ref <= 0) ref = 50000;
    var tick = krxTickSize(cur > 0 ? cur : ref);
    var next;
    if (cur > 0) {
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

  function bumpHoldingModalQty(inputId, direction) {
    var inp = document.getElementById(inputId);
    if (!inp) return;
    var max = inp.max ? parseInt(inp.max, 10) : NaN;
    var cur = parseInt(inp.value, 10);
    if (Number.isNaN(cur) || cur < 1) cur = 1;
    var next = cur + direction;
    if (next < 1) next = 1;
    if (!Number.isNaN(max) && max > 0 && next > max) next = max;
    inp.value = String(next);
    if (inputId === 'sellModalQty') updateSellModalEst();
    else if (inputId === 'holdingBuyQty') updateHoldingBuyEst();
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
      line.innerHTML = formatTradeConfirmStockHtml(foundName, sellModalState.code);
    }
    var logoWrap = document.getElementById('holdingStockLogo');
    if (logoWrap) {
      logoWrap.innerHTML = orderStatusLogoHtml(sellModalState.code, foundName);
      bindStockLogosIn(logoWrap);
    }
    const qtyInput = document.getElementById('sellModalQty');
    qtyInput.max = sellModalState.maxQty;
    qtyInput.min = 1;
    qtyInput.value = sellModalState.maxQty;
    syncHoldingSellQtyMeta();
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
    const scb = document.getElementById('sellModalCostBreakdown');
    if (!totalEl || !qtyInput) return;

    let refPx = Number(st.unitPrice) || 0;
    let unit = refPx;
    if (!isHoldingSellMarketMode() && limIn) {
      var lv = parseLimitPriceInput(limIn);
      if (lv > 0) unit = resolveSellUnitPrice(refPx, lv);
    }
    let q = parseInt(qtyInput.value, 10) || 0;
    if (st.maxQty > 0) q = Math.min(Math.max(q, 0), st.maxQty);
    var grossSell = Math.max(0, q * unit);

    if (grossSell > 0 && unit > 0) {
      var costs = estimateMockTradeCosts('SELL', grossSell);
      totalEl.textContent = formatCurrency(costs.netSell);
      renderMockCostBreakdown(scb, 'SELL', grossSell);
    } else {
      totalEl.textContent = '—';
      if (scb) {
        scb.innerHTML = '';
        scb.style.display = 'none';
      }
    }

    syncHoldingSellMarketUi();
  }

  function bumpSellModalLimitPrice(direction) {
    if (isHoldingSellMarketMode()) return;
    var inp = document.getElementById('sellModalLimitPrice');
    if (!inp) return;
    var cur = parseLimitPriceInput(inp);
    var ref = Number(sellModalState.unitPrice) || 0;
    if (!Number.isFinite(ref) || ref <= 0) ref = 50000;
    var tick = krxTickSize(cur > 0 ? cur : ref);
    var next;
    if (cur > 0) {
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
    var cur = parseLimitPriceInput(inp);
    var ref = quickSellReferenceForTick();
    var tick = krxTickSize(cur > 0 ? cur : ref);
    var next;
    if (cur > 0) {
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
    if (!tryAcquireTradeSubmit()) return;
    try {
    var found = portfolio.holdings[key];
    if (!found || Number(found.quantity) <= 0) {
      throw new Error('보유 종목 정보를 다시 확인해주세요.');
    }
    var stockRef = found.code && String(found.code).trim() ? String(found.code).trim() : key;
    var routedQs = await handleLimitOrderSubmission({
      side: 'SELL',
      stock: key,
      stockRef: stockRef,
      quantity: qty,
      limPx: sellPx,
    });
    if (!routedQs.ok) return;
    if (routedQs.pending) return;

    const out = await executeTradeRequest('SELL', stockRef, qty, sellPx);
    const res = out.res;
    const data = out.data;
    if (res.status === 401) {
      simHandleUnauthorized();
      return;
    }
    if (!res.ok || !data.success) {
      pushOrderStatusEvent({
        stockRef: stockRef,
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
      stockRef: ts.code || stockRef,
      stock: ts.name || key,
      side: 'SELL',
      mode: 'manual',
      status: 'executed',
      desiredPrice: sellPx,
      executedPrice: Number(ts.price || 0),
      quantity: Number(ts.quantity || qty),
    });
    showTradeFeedback(data, 'sell');
    } finally {
      releaseTradeSubmit();
    }
  }

  window.openQuickSellConfirmModal = async function () {
    if (!(await requireSimLogin())) return;
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
      openSellQtyExceededModal(Number(found.quantity));
      return;
    }
    var sellPx = limEl ? parseLimitPriceInput(limEl) : 0;
    if (isSellMarketMode()) sellPx = 0;

    var refPx = Number(found.currentPrice || 0) || sellReferencePrice() || 0;
    var quickSellCostBox = document.getElementById('quickSellModalCostBreakdown');
    var stockRef = found.code && String(found.code).trim() ? String(found.code).trim() : key;
    var codeDisp = found.code ? String(found.code).trim() : '';
    var stockLine = document.getElementById('quickSellModalStockLine');
    var qtyLine = document.getElementById('quickSellModalQtyLine');
    var priceLine = document.getElementById('quickSellModalPriceLine');
    if (stockLine) stockLine.innerHTML = formatTradeConfirmStockHtml(key, codeDisp);
    if (qtyLine) qtyLine.textContent = qty.toLocaleString() + '주';
    if (priceLine) {
      if (isSellMarketMode()) {
        setTradeConfirmPriceLine(priceLine, MARKET_PRICE_LABEL, '시장가');
        if (quickSellCostBox) {
          quickSellCostBox.innerHTML = '';
          quickSellCostBox.style.display = 'none';
        }
      } else if (sellPx > 0) {
        var sellExec = resolveMockExecutionPrice('SELL', refPx, sellPx);
        if (sellExec > 0 && sellExec > sellPx) {
          setTradeConfirmPriceLine(priceLine, formatCurrency(sellExec), '현재가 체결 예상');
        } else if (sellExec > 0) {
          setTradeConfirmPriceLine(priceLine, formatCurrency(sellExec), '지정가');
        } else {
          setTradeConfirmPriceLine(priceLine, formatCurrency(sellPx), '지정가 (예약)');
        }
        var gross = Math.max(0, qty * (sellExec > 0 ? sellExec : sellPx));
        renderMockCostBreakdown(quickSellCostBox, 'SELL', gross);
      } else {
        priceLine.textContent = '—';
        if (quickSellCostBox) {
          quickSellCostBox.innerHTML = '';
          quickSellCostBox.style.display = 'none';
        }
      }
    }

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
      showSellTradeError(err);
    }
  };

  window.executeQuickSell = async function () {
    if (!(await requireSimLogin())) return;
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
      openSellQtyExceededModal(Number(found.quantity));
      return;
    }
    var sellPx = limEl ? parseLimitPriceInput(limEl) : 0;
    if (isSellMarketMode()) sellPx = 0;
    try {
      await performQuickSellTrade(key, qty, sellPx);
    } catch (err) {
      showSellTradeError(err);
    }
  };

  async function confirmSellFromModal() {
    if (!tryAcquireTradeSubmit()) return;
    try {
    const st = sellModalState;
    const qty = parseInt(document.getElementById('sellModalQty').value, 10);
    if (!st.name || !qty || qty < 1) {
      alert('판매 수량을 확인해주세요.');
      return;
    }
    if (qty > st.maxQty) {
      openSellQtyExceededModal(st.maxQty);
      return;
    }
    var sellLim = document.getElementById('sellModalLimitPrice');
    var sellPx = sellLim ? parseLimitPriceInput(sellLim) : 0;
    if (isHoldingSellMarketMode()) sellPx = 0;
    try {
      const stockRef = st.code && String(st.code).trim() ? st.code : st.name;
      var routedSell = await handleLimitOrderSubmission({
        side: 'SELL',
        stock: st.name || stockRef,
        stockRef: stockRef,
        quantity: qty,
        limPx: sellPx,
      });
      if (!routedSell.ok) return;
      if (routedSell.pending) {
        closeSellModal();
        return;
      }

      const out = await executeTradeRequest('SELL', stockRef, qty, sellPx);
      const res = out.res;
      const data = out.data;
      if (res.status === 401) {
        closeSellModal();
        simHandleUnauthorized();
        return;
      }
      if (!res.ok || !data.success) {
        pushOrderStatusEvent({
          stockRef: stockRef,
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
        stockRef: ts.code || stockRef,
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
      showSellTradeError(err);
    }
    } finally {
      releaseTradeSubmit();
    }
  }

  async function confirmBuyFromHoldingModal() {
    if (!tryAcquireTradeSubmit()) return;
    try {
    if (!(await requireSimLogin())) return;
    var stockRef = getHoldingModalBuyStockForApi();
    var stockLabel = getHoldingModalBuyDisplayName();
    if (!stockRef) {
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
    var limPx = limEl2 ? parseLimitPriceInput(limEl2) : 0;
    if (isHoldingBuyMarketMode()) limPx = 0;
    var limPxHbCheck = isHoldingBuyMarketMode() ? 0 : limPx;
    var limHbOk = limPx > 0;
    if (
      await showBuyInsufficientCashModal(quantity, limPxHbCheck, stockRef, {
        stock: stockLabel,
        market: isHoldingBuyMarketMode(),
        limitLabel: !isHoldingBuyMarketMode() && limHbOk ? ' (지정가)' : '',
      })
    ) {
      return;
    }
    try {
      var routedHb = await handleLimitOrderSubmission({
        side: 'BUY',
        stock: stockLabel,
        stockRef: stockRef,
        quantity: quantity,
        limPx: limPx,
      });
      if (!routedHb.ok) return;
      if (routedHb.pending) {
        closeSellModal();
        return;
      }

      const out = await executeTradeRequest('BUY', stockRef, quantity, limPx);
      const res = out.res;
      const data = out.data;
      if (res.status === 401) {
        closeSellModal();
        simHandleUnauthorized();
        return;
      }
      if (!res.ok || !data.success) {
        if (isBalanceInsufficientMessage(data.message)) {
          var unitPxHbApi = await resolveBuyUnitPrice(limPx, stockRef);
          openInsufficientCashModal(validateBuyAffordability(quantity, unitPxHbApi), {
            stock: stockLabel,
            quantity: quantity,
            unitPx: unitPxHbApi,
            market: isHoldingBuyMarketMode(),
          });
          return;
        }
        pushOrderStatusEvent({
          stockRef: stockRef,
          stock: stockLabel,
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
        stockRef: tr.code || stockRef,
        stock: tr.name || stockLabel,
        side: 'BUY',
        mode: 'manual',
        status: 'executed',
        desiredPrice: limPx,
        executedPrice: Number(tr.price || 0),
        quantity: Number(tr.quantity || quantity),
      });
      showTradeFeedback(data, 'buy');
    } catch (err) {
      if (isBalanceInsufficientMessage(err.message)) {
        var unitPxHbCatch = await resolveBuyUnitPrice(limPx, stockRef);
        openInsufficientCashModal(validateBuyAffordability(quantity, unitPxHbCatch), {
          stock: stockLabel,
          quantity: quantity,
          unitPx: unitPxHbCatch,
          market: isHoldingBuyMarketMode(),
        });
        return;
      }
      alert(err.message || '구매 처리 중 오류가 발생했습니다.');
    }
    } finally {
      releaseTradeSubmit();
    }
  }

  window.openBuyConfirmModal = openBuyConfirmModal;
  window.closeInsufficientCashModal = closeInsufficientCashModal;
  window.closePendingOrderEditModal = closePendingOrderEditModal;
  window.confirmPendingOrderPriceEdit = confirmPendingOrderPriceEdit;
  window.closeSimTradeNoticeModal = closeSimTradeNoticeModal;
  window.closeMockResetConfirmModal = closeMockResetConfirmModal;
  window.closeMarketClosedModal = closeSimTradeNoticeModal;
  window.runSimTradeNoticePrimary = runSimTradeNoticePrimary;
  window.switchToLimitFromMarketClosed = switchToLimitFromMarketClosed;
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
    const isAuto = target === 'auto' || String(source || '').toLowerCase() === 'auto';

    el.className = 'trade-feedback trade-receipt-wrap';
    el.style.display = 'block';
    el.innerHTML = buildTradeReceiptHtml({
      title: '체결 완료',
      stockName: nameLine,
      sideKo: sideKo,
      quantity: Number(t.quantity || 0),
      priceLabel: '체결가',
      priceValue: formatCurrency(Number(t.price || 0)),
      refLabel: '체결 방식',
      refValue: isAuto ? '조건 충족 체결' : '즉시 체결',
      condLabel: '처리 상태',
      condText: '주문이 체결되었습니다',
    });
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
    quoteChangeRate: null,
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
    var openEl = document.getElementById('simHoldingQuoteOpen');
    if (openEl) openEl.textContent = '—';
    var pctEl = document.getElementById('simHoldingQuoteExecPct');
    var capEl = document.getElementById('simHoldingQuoteExecCaption');
    var meterFill = document.getElementById('simHoldingQuoteExecMeterFill');
    if (pctEl) pctEl.textContent = '—';
    if (capEl) capEl.textContent = '';
    if (meterFill) meterFill.style.width = '0%';
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
    var qPrice = Number(data.price);
    var qRate = Number(data.change_rate);
    if (Number.isFinite(qPrice) && qPrice > 0) {
      updateSimHoldingDetailHead({
        name: simHoldingDetailState.name || data.name,
        code: data.code || simHoldingDetailState.code,
        price: qPrice,
        changeRate: Number.isFinite(qRate) ? qRate : simHoldingDetailState.quoteChangeRate,
      });
    } else if (Number.isFinite(qRate)) {
      updateSimHoldingDetailHead({
        name: simHoldingDetailState.name || data.name,
        code: data.code || simHoldingDetailState.code,
        price: simHoldingDetailState.quotePrice,
        changeRate: qRate,
      });
    }
    var dh = document.getElementById('simHoldingQuoteDayHigh');
    var dl = document.getElementById('simHoldingQuoteDayLow');
    var dhi = Number(data.day_high);
    var dlo = Number(data.day_low);
    if (dh) dh.textContent = Number.isFinite(dhi) && dhi > 0 ? formatCurrency(dhi) : '—';
    if (dl) dl.textContent = Number.isFinite(dlo) && dlo > 0 ? formatCurrency(dlo) : '—';
    var openEl = document.getElementById('simHoldingQuoteOpen');
    var opi = Number(data.open_price);
    if (openEl) {
      openEl.textContent =
        Number.isFinite(opi) && opi > 0 ? formatCurrency(opi) : '—';
    }

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
        if (ep > 100.5) exec.classList.add('sim-holding-quote-exec--high');
        else if (ep < 99.5) exec.classList.add('sim-holding-quote-exec--low');
        else exec.classList.add('sim-holding-quote-exec--mid');
      } else {
        exec.classList.add('sim-holding-quote-exec--mid');
      }
    }
    if (pctEl) pctEl.textContent = Number.isFinite(ep) ? String(Math.round(ep)) + '%' : '—';
    if (capEl) capEl.textContent = data.exec_strength_caption != null ? String(data.exec_strength_caption) : '';
    var meterFill = document.getElementById('simHoldingQuoteExecMeterFill');
    if (meterFill) {
      meterFill.style.width = Number.isFinite(ep)
        ? String(Math.min(100, Math.max(0, Math.round(ep / 2)))) + '%'
        : '0%';
    }
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
    var openEl0 = document.getElementById('simHoldingQuoteOpen');
    if (openEl0) openEl0.textContent = '—';
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
          updateSimHoldingDetailHead({
            name: st.name || match.name,
            code: chartCode,
            price: Number(match.price || st.quotePrice || 0),
            changeRate: Number(match.change_rate || 0),
          });
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

  function dismissOrderbookPanel() {
    loadOrderbookPanel('');
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
      quoteChangeRate: null,
      quoteVolume: null,
      quoteTradedValue: null,
      optionsAiLoadedCode: '',
      optionsAiText: '',
    };
    updateSimHoldingDetailHead({ name: '—', code: '', price: 0, changeRate: NaN });
    collapseSimStockHistoryPanel();
    if (simMainView === 'pnl' || simMainView === 'ranking' || simMainView === 'reset') {
      dismissOrderbookPanel();
    }
    requestAnimationFrame(syncSimWorkspacePaneHeight);
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

  function openSimStockDetailFromDiscovery(code, price, name, volOpt, tvOpt, changeRateOpt) {
    var rawCode = code != null ? String(code).trim() : '';
    var chartCode = /^\d{6}$/.test(rawCode) ? rawCode : '';
    var dispName = name != null ? String(name).trim() : '';
    var showName = dispName || chartCode || rawCode || '—';
    var qPrice = Number(price);
    if (!Number.isFinite(qPrice)) qPrice = 0;
    var qRate =
      changeRateOpt != null && Number.isFinite(Number(changeRateOpt)) ? Number(changeRateOpt) : NaN;
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
      quoteChangeRate: Number.isFinite(qRate) ? qRate : null,
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
    updateSimHoldingDetailHead({
      name: showName,
      code: chartCode || rawCode,
      price: qPrice,
      changeRate: qRate,
    });
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
    requestAnimationFrame(syncSimWorkspacePaneHeight);
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
    var name = h.name && String(h.name).trim() ? String(h.name).trim() : holdingKey;
    var headPrice = Number(h.currentPrice) || 0;
    var snap = chartCode ? getDiscoveryQuoteSnapshot(chartCode) : null;
    var headRate = snap && Number.isFinite(snap.changeRate) ? snap.changeRate : NaN;
    if (snap && snap.price > 0) headPrice = snap.price;
    if (snap && snap.name) name = snap.name;
    simHoldingDetailState = {
      key: holdingKey,
      code: code,
      name: name,
      range: '1d',
      quotePrice: headPrice,
      quoteChangeRate: Number.isFinite(headRate) ? headRate : null,
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
    updateSimHoldingDetailHead({
      name: name,
      code: chartCode || code,
      price: headPrice,
      changeRate: headRate,
    });
    var logoRef = chartCode || code;
    syncSimHoldingDetailLogo(logoRef, name);
    if (chartCode && !Number.isFinite(headRate)) {
      refreshSimHoldingDetailHeadFromApi(chartCode);
    }
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
    requestAnimationFrame(syncSimWorkspacePaneHeight);

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
    if (mode === 'buy' || mode === 'sell') {
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
    resetHistoryPeriodDefault();
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

  // 거래 내역 렌더링 (전체 / 구매 / 판매)
  function renderHistory() {
    const tradingHistory = document.getElementById('tradingHistory');
    if (!tradingHistory) return;

    applyHistoryPeriodRangeDisplay();

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

    var range = getHistoryPeriodBounds();
    items = items.filter(function (t) {
      var ms = t.atMs || 0;
      if (!ms) return false;
      return ms >= range.startMs && ms <= range.endMs;
    });

    if (items.length === 0) {
      tradingHistory.innerHTML =
        '<div style="text-align: center; color: var(--gray-400); padding: 28px;">선택한 기간에 체결 내역이 없습니다.</div>';
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
    var n = Number(amount);
    if (!Number.isFinite(n)) n = 0;
    if (n < 0) {
      return '-₩' + Math.abs(n).toLocaleString();
    }
    return '₩' + n.toLocaleString();
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
