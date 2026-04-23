  function simApiBase() {
    if (typeof window !== 'undefined' && window.JURIN_API_BASE) {
      return window.JURIN_API_BASE;
    }
    try {
      var loc = window.location;
      if (loc && String(loc.port) === '5000' && loc.protocol && loc.protocol.indexOf('http') === 0) {
        return loc.origin;
      }
    } catch (e) { /* ignore */ }
    return 'http://127.0.0.1:5000';
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

    setText('nav .nav-menu li:nth-child(1) a', 'AI 분석');
    setText('nav .nav-menu li:nth-child(2) a', 'AI 차트 예측 ');
    var aiBadge = document.querySelector('nav .nav-menu li:nth-child(2) a .nav-badge');
    if (aiBadge) aiBadge.textContent = 'AI';
    setText('nav .nav-menu li:nth-child(3) a', '용어 검색');
    setText('nav .nav-menu li:nth-child(4) a', '모의 투자 ');
    var newBadge = document.querySelector('nav .nav-menu li:nth-child(4) a .nav-badge');
    if (newBadge) newBadge.textContent = 'NEW';
    setText('nav .nav-menu li:nth-child(5) a', '시장');
    setText('#navLoginBtn', '로그인');
    var startBtn = document.querySelector('nav .btn-primary');
    if (startBtn) startBtn.textContent = '무료 시작하기';

    setText('.simulation-header .btn-back', '← 돌아가기');
    setText('.simulation-title', '모의 투자');
    setText('.simulation-sub', '실전처럼 매매를 연습해보세요');

    setText('.market-sidebar-title > span', '시장 종목');
    var mRef = document.querySelector('.market-sidebar-title .btn-trade');
    if (mRef) mRef.textContent = '새로고침';
    var obRef = document.getElementById('orderbookRefreshBtn');
    if (obRef) obRef.textContent = '새로고침';
    var obBack = document.getElementById('orderbookCloseBtn');
    if (obBack) obBack.textContent = '시장 목록';
    setText('.orderbook-pane-title', '호가');

    var th = document.querySelectorAll('.discovery-table thead th');
    if (th.length >= 6) {
      th[1].textContent = '종목';
      th[2].textContent = '현재가';
      th[3].textContent = '등락';
      th[4].textContent = '거래량';
      th[5].textContent = '거래대금';
    }

    setText('.portfolio-title', '내 자산 현황');
    var bal = document.querySelectorAll('.portfolio-balance .balance-label');
    if (bal.length >= 3) {
      bal[0].textContent = '총 자산 (예수금 + 주식 평가액)';
      bal[1].textContent = '예수금';
      bal[2].textContent = '주식 평가액';
    }
    var stat = document.querySelectorAll('.portfolio-stats .stat-label');
    if (stat.length >= 4) {
      stat[0].textContent = '총 수익률';
      stat[1].textContent = '총 수익금';
      stat[2].textContent = '보유 종목';
      stat[3].textContent = '평가 손익';
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

    setText('.trading-title', '매수 / 매도');
    setText('label[for="tradeStock"]', '매수 종목');
    setAttr('#tradeStock', 'placeholder', '종목명 또는 코드');
    setText('label[for="tradeQuantity"]', '매수 수량');
    setAttr('#tradeQuantity', 'placeholder', '수량');
    setText('label[for="tradeLimitPrice"]', '매수 가격');
    setAttr('#tradeLimitPrice', 'placeholder', '비우면 시세 체결');
    setAttr('#tradeLimitPricePlus', 'aria-label', '가격 한 단계 올림');
    setAttr('#tradeLimitPriceMinus', 'aria-label', '가격 한 단계 내림');
    var buyBtn = document.querySelector('.trading-form .btn-trade');
    if (buyBtn) buyBtn.textContent = '매수';

    setText('label[for="tradeSellStock"]', '매도 종목');
    setText('label[for="tradeSellQuantity"]', '매도 수량');
    setAttr('#tradeSellQuantity', 'placeholder', '수량');
    setText('label[for="tradeSellLimitPrice"]', '매도 가격');
    setAttr('#tradeSellLimitPrice', 'placeholder', '비우면 시세 체결');
    setAttr('#tradeSellLimitPricePlus', 'aria-label', '매도가격 한 단계 올림');
    setAttr('#tradeSellLimitPriceMinus', 'aria-label', '매도가격 한 단계 내림');
    var sellBtn = document.getElementById('tradeSellBtn');
    if (sellBtn) sellBtn.textContent = '매도';

    setText('.order-status-title', '주문/체결 현황');
    setText('#orderStatusSummary', '아직 주문 상태가 없습니다.');
    setText('.order-status-empty', '주문 상태가 여기에 표시됩니다.');
    setText('.history-title', '체결 내역');
    setText('.history-date-label', '날짜');
    setText('#historyClearDisplay', '비우기');
    setText('#historyRestoreDisplay', '복구');
    setText('[data-history-tab="all"]', '전체');
    setText('[data-history-tab="buy"]', '매수');
    setText('[data-history-tab="sell"]', '매도');

    setText('#sellModalHeading', '매도');
    setText('label[for="sellModalQty"]', '수량');
    setText('label[for="sellModalLimitPrice"]', '지정가');
    setAttr('#sellModalLimitPrice', 'placeholder', '지정가');
    setText('#sellModal .sell-modal-row:nth-of-type(1) span:first-child', '참고 시세');
    setText('#sellModal .sell-modal-row:nth-of-type(2) span:first-child', '예상 매도대금');
    var sellExec = document.querySelector('#sellModal .btn-trade.sell');
    if (sellExec) sellExec.textContent = '매도 실행';
    var sellCancel = document.querySelector('#sellModal .btn-ghost-modal');
    if (sellCancel) sellCancel.textContent = '취소';

    setText('#buyModalHeading', '매수');
    setText('#buyModal .sell-modal-row:nth-of-type(1) span:first-child', '종목');
    setText('#buyModal .sell-modal-row:nth-of-type(2) span:first-child', '수량');
    setText('#buyModal .sell-modal-row:nth-of-type(3) span:first-child', '체결가');
    setText('#buyModal .trade-confirm-note', '위 내용으로 매수를 진행합니다.');
    var buyExec = document.querySelector('#buyModal .btn-trade');
    if (buyExec) buyExec.textContent = '매수 실행';
    var buyCancel = document.querySelector('#buyModal .btn-ghost-modal');
    if (buyCancel) buyCancel.textContent = '취소';
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

  function bumpTradeLimitPrice(direction) {
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
  /** 호가 행 클릭 시 종목·가격 보관 — 매도 모달을 나중에 열어도 지정가 반영 */
  let lastOrderbookPick = { code: '', price: 0, atMs: 0 };
  const ORDERBOOK_PICK_TTL_MS = 3 * 60 * 1000;
  let orderbookPollTimer = null;
  let pendingOrders = [];
  let pendingOrderSeq = 1;
  let pendingOrderProcessing = false;
  let orderStatusEvents = [];
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
    orderStatusEvents.unshift({
      at: evt.at || nowStamp(),
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

  function renderOrderStatusBoard() {
    var listEl = document.getElementById('orderStatusList');
    var sumEl = document.getElementById('orderStatusSummary');
    if (!listEl || !sumEl) return;

    var waitCnt = pendingOrders.length;
    var doneCnt = orderStatusEvents.filter(function (e) { return e.status === 'executed'; }).length;
    var last = orderStatusEvents.length > 0 ? orderStatusEvents[0] : null;
    var lastTxt = '';
    if (last) {
      lastTxt = ' · 마지막: ' + (last.status === 'executed' ? '체결완료' : '체결실패');
    }
    sumEl.textContent = '미체결 ' + waitCnt + '건 · 체결완료 ' + doneCnt + '건' + lastTxt;

    if (orderStatusEvents.length === 0 && waitCnt === 0) {
      listEl.innerHTML = '<div class="order-status-empty">주문을 넣으면 대기/체결 상태가 여기에 표시됩니다.</div>';
      return;
    }

    var pendingRows = pendingOrders.map(function (o) {
      var side = o.side === 'SELL' ? '매도' : '매수';
      return (
        '<div class="order-status-item">' +
          '<div class="order-status-top">' +
            '<span class="order-status-stock">' + escapeHtml(o.stock || o.stockRef || '-') + ' · ' + side + ' ' + Number(o.quantity || 0).toLocaleString() + '주</span>' +
            '<span class="order-status-badge wait">미체결</span>' +
          '</div>' +
          '<div class="order-status-detail">' +
            '<span>목표가 ' + formatCurrency(Number(o.limitPrice || 0)) + '</span>' +
            '<span>조건 충족 시 자동체결</span>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    var eventRows = orderStatusEvents.slice(0, 16).map(function (e) {
      var side = e.side === 'SELL' ? '매도' : '매수';
      var badgeCls = e.status === 'failed' ? 'fail' : 'manual';
      var badgeTxt = e.status === 'failed' ? '체결실패' : '체결완료';
      var modeTxt = e.mode === 'auto' ? '자동' : '수동';
      var desired = e.desiredPrice > 0 ? formatCurrency(e.desiredPrice) : '시세';
      var executed = e.executedPrice > 0 ? formatCurrency(e.executedPrice) : '-';
      var note = e.note ? '<span>' + escapeHtml(e.note) + '</span>' : '';
      return (
        '<div class="order-status-item">' +
          '<div class="order-status-top">' +
            '<span class="order-status-stock">' + escapeHtml(e.stock) + ' · ' + side + ' ' + Number(e.quantity || 0).toLocaleString() + '주</span>' +
            '<span class="order-status-badge ' + badgeCls + '">' + badgeTxt + '</span>' +
          '</div>' +
          '<div class="order-status-detail">' +
            '<span>주문가 ' + desired + '</span>' +
            '<span>체결가 ' + executed + '</span>' +
            '<span>방식 ' + modeTxt + '</span>' +
            '<span>' + e.at + '</span>' +
            note +
          '</div>' +
        '</div>'
      );
    }).join('');

    listEl.innerHTML = pendingRows + eventRows;
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
    const sideKo = order.side === 'BUY' ? '매수' : '매도';
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
      if (meta) meta.textContent = '호가를 눌러 지정가를 빠르게 입력할 수 있습니다.';
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
        '<td>매도</td><td>' + formatCurrency(p) + '</td><td>' + formatLargeNumber(q) + '</td></tr>'
      );
    }
    for (var j = 0; j < bids.length; j++) {
      var b = bids[j];
      var bp = Number(b.price);
      var bq = Number(b.quantity || 0);
      rows.push(
        '<tr class="orderbook-row bid" role="button" tabindex="0" data-price="' + bp + '" data-side="buy">' +
        '<td>매수</td><td>' + formatCurrency(bp) + '</td><td>' + formatLargeNumber(bq) + '</td></tr>'
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
      var inp = document.getElementById('tradeLimitPrice');
      if (inp) inp.value = String(p);
      updateTradeTickHint();
    }
    var code = String(selectedOrderbookCode || '').trim();
    if (isSixDigitCode(code)) {
      lastOrderbookPick = { code: code, price: p, atMs: Date.now() };
    }
    if (sd === 'sell') {
      var quickSellInp = document.getElementById('tradeSellLimitPrice');
      if (quickSellInp) quickSellInp.value = String(p);
      var sellLim = document.getElementById('sellModalLimitPrice');
      if (sellLim) {
        sellLim.value = String(p);
        var sellM = document.getElementById('sellModal');
        if (sellM && sellM.classList.contains('is-open')) updateSellModalEst();
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

  /* 로그인 성공 시 전체 새로고침 대신 서버 포트폴리오만 다시 로드 (게이트·reload로 인한 오류 방지) */
  window.afterJurinLogin = function () {
    loadPortfolioFromServer().then(function () {
      updatePortfolio();
      renderHoldings();
      renderHistory();
    });
  };

  // 초기 데이터
  let portfolio = {
    initialCash: 0,
    balance: 0,
    holdings: {},
    history: [],
    summary: null,
  };

  /** 체결 내역 탭: all | buy | sell */
  let historyViewFilter = 'all';

  /**
   * 비우기 이후: 서버에서 다시 받아도 이 시각(atMs) 이하 체결은 목록에 넣지 않음(새출발).
   * null이면 서버 체결 전부 표시. 복구 버튼으로 null로 되돌림.
   */
  let historyDisplayCutoffMs = null;

  // 페이지 로드 시 초기화 (로그인 여부와 관계없이 화면 표시; 미로그인 시 API는 빈 자산·매매 시 로그인 필요 안내)
  document.addEventListener('DOMContentLoaded', async function() {
    localizeSimulationUi();
    if (typeof refreshAuthNav === 'function') refreshAuthNav();

    document.querySelectorAll('.history-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setHistoryViewFilter(this.getAttribute('data-history-tab') || 'all');
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
        if (pEl && !pEl.value) {
          var cp = Number(h.currentPrice || 0);
          if (cp > 0) pEl.value = String(Math.round(cp));
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
    var qslm = document.getElementById('tradeSellLimitPriceMinus');
    var qslpu = document.getElementById('tradeSellLimitPricePlus');
    if (qslm) qslm.addEventListener('click', function () { bumpQuickSellLimitPrice(-1); });
    if (qslpu) qslpu.addEventListener('click', function () { bumpQuickSellLimitPrice(1); });
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
        applyQuoteToTrade(code, price, name);
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var buyM = document.getElementById('buyModal');
      if (buyM && buyM.classList.contains('is-open')) {
        closeBuyModal();
        return;
      }
      var ob = document.getElementById('orderbookOverlay');
      if (ob && ob.classList.contains('is-open')) {
        closeOrderbookOverlay();
        return;
      }
      closeSellModal();
    });

    await loadPortfolioFromServer();
    updatePortfolio();
    renderHoldings();
    renderHistory();
    renderOrderStatusBoard();
    loadTradedValueBoard();
    setInterval(loadTradedValueBoard, 25000);
    var sellLimInp = document.getElementById('sellModalLimitPrice');
    if (sellLimInp) sellLimInp.addEventListener('input', updateSellModalEst);
    setInterval(async function () {
      await loadPortfolioFromServer();
      updatePortfolio();
      renderHoldings();
      await loadTradedValueBoard({ silent: true });
      await processPendingOrders();
    }, 25000);
  });

  async function loadTradedValueBoard(options) {
    var opts = options || {};
    var silent = !!opts.silent;
    const tbody = document.getElementById('discoveryTableBody');
    if (!tbody) return;

    if (!silent) {
      tbody.innerHTML = '<tr><td colspan="6" style="color: var(--gray-400);">시세를 불러오는 중...</td></tr>';
    }

    try {
      const res = await fetch(`${simApiBase()}/api/mock/traded-value-rank?limit=30`);
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
        return `
          <tr class="discovery-row" data-code="${escapeHtmlAttr(codeStr)}" data-name="${encodeURIComponent(nameStr)}" data-price="${Number(item.price || 0)}">
            <td>${idx + 1}</td>
            <td>
              <div>${item.name || '-'}</div>
              <div class="discovery-code">${item.code || '-'}</div>
            </td>
            <td>${formatCurrency(Number(item.price || 0))}</td>
            <td class="holding-change ${dir}">${rateStr}</td>
            <td>${formatLargeNumber(Number(item.volume || 0))}</td>
            <td>${formatLargeCurrency(Number(item.traded_value || 0))}</td>
          </tr>
        `;
      }).join('');

      tbody.innerHTML = rows || '<tr><td colspan="6" style="color: var(--gray-400);">표시할 데이터가 없습니다.</td></tr>';
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="color: #ff8e8e;">${err.message || '시세를 불러오지 못했습니다.'}</td></tr>`;
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
      tlpEl.value = String(Math.round(pNum));
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
            '<a href="' + openUrl + '" style="color:#7ec8ff;font-weight:700;">' + openUrl + '</a>';
        } else {
          msg = '이 페이지가 <strong>포트 ' + (port || '기본') + '</strong>에서 열려 있어 로그인 쿠키가 API(:5000)에 전달되지 않을 수 있습니다. ' +
            'Flask 실행 후 아래 주소로 접속하세요.<br />' +
            '<a href="' + openUrl + '" style="color:#7ec8ff;font-weight:600;">' + openUrl + '</a>';
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
      var effPx = limOk ? limP : referencePriceForTick();
      priceLine.textContent = formatCurrency(effPx) + (limOk ? ' (지정가)' : ' (시세 기준)');
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
          '로그인 세션이 없어 매수할 수 없습니다. Flask(<code>:5000</code>)에서 이 페이지를 연 뒤 상단에서 로그인하세요.<br />' +
          '<a href="' + openUrl + '" style="color:#7ec8ff;font-weight:600;">' + openUrl + '</a>';
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
          note: data.message || '매수 처리 실패',
        });
        throw new Error(data.message || '매수 처리에 실패했습니다.');
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
      alert(err.message || '매수 처리 중 오류가 발생했습니다.');
    }
  }

  let sellModalState = { name: '', code: '', maxQty: 0, unitPrice: 0 };

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
    var sl = document.getElementById('sellModalLimitPrice');
    const up = Number(sellModalState.unitPrice) || 0;
    var holdCode = String(sellModalState.code || '').trim();
    var pick = lastOrderbookPick;
    var pickOk = pick && isSixDigitCode(holdCode) && pick.code === holdCode &&
      pick.price > 0 && (Date.now() - pick.atMs) <= ORDERBOOK_PICK_TTL_MS;
    if (sl) {
      if (pickOk) sl.value = String(Math.round(pick.price));
      else if (up > 0) sl.value = String(Math.round(up));
      else sl.value = '';
    }
    updateSellModalEst();
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
    sellModalState = { name: '', code: '', maxQty: 0, unitPrice: 0 };
  }

  function updateSellModalEst() {
    const st = sellModalState;
    const totalEl = document.getElementById('sellModalEstTotal');
    const qtyInput = document.getElementById('sellModalQty');
    const limIn = document.getElementById('sellModalLimitPrice');
    if (!totalEl || !qtyInput) return;
    let unit = Number(st.unitPrice) || 0;
    if (limIn && limIn.value) {
      var lv = parseInt(limIn.value, 10);
      if (!Number.isNaN(lv) && lv > 0) unit = lv;
    }
    let q = parseInt(qtyInput.value, 10) || 0;
    if (st.maxQty > 0) q = Math.min(Math.max(q, 0), st.maxQty);
    totalEl.textContent = formatCurrency(q * unit);
  }

  function bumpSellModalLimitPrice(direction) {
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

  function bumpQuickSellLimitPrice(direction) {
    var inp = document.getElementById('tradeSellLimitPrice');
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
      if (direction > 0) next = rounded <= 0 ? tick : rounded + tick;
      else next = Math.max(tick, rounded - tick);
    }
    inp.value = String(next);
  }

  window.executeQuickSell = async function () {
    var sel = document.getElementById('tradeSellStock');
    var qtyEl = document.getElementById('tradeSellQuantity');
    var limEl = document.getElementById('tradeSellLimitPrice');
    if (!sel || sel.disabled || !sel.value) {
      alert('매도할 보유 종목을 선택해주세요.');
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

    var stockRef = found.code && String(found.code).trim() ? String(found.code).trim() : key;
    try {
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
          note: data.message || '매도 처리 실패',
        });
        throw new Error(data.message || '매도 처리에 실패했습니다.');
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
    } catch (err) {
      alert(err.message || '매도 중 오류가 발생했습니다.');
    }
  };

  async function confirmSellFromModal() {
    const st = sellModalState;
    const qty = parseInt(document.getElementById('sellModalQty').value, 10);
    if (!st.name || !qty || qty < 1) {
      alert('매도 수량을 확인해주세요.');
      return;
    }
    if (qty > st.maxQty) {
      alert('보유 수량(' + st.maxQty + '주)을 넘을 수 없습니다.');
      return;
    }
    var sellLim = document.getElementById('sellModalLimitPrice');
    var sellPx = sellLim && sellLim.value ? parseInt(sellLim.value, 10) : 0;
    if (Number.isNaN(sellPx) || sellPx < 0) sellPx = 0;
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
          note: data.message || '매도 처리 실패',
        });
        throw new Error(data.message || '매도 처리에 실패했습니다.');
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
      alert(err.message || '매도 중 오류가 발생했습니다.');
    }
  }

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
    const sideKo = String(t.side || '').toUpperCase() === 'BUY' ? '매수' : '매도';
    const fee = Number(t.fee != null ? t.fee : 0);
    const cashBefore = data.cash_before != null ? Number(data.cash_before) : null;
    const cashAfter = data.cash_after != null ? Number(data.cash_after) : null;
    const totalAssets = totalAssetsFromPortfolioState();

    const rows = [
      `<div class="trade-row"><span>종목</span><span>${(t.name || '—') + (t.code ? ' (' + t.code + ')' : '')}</span></div>`,
      `<div class="trade-row"><span>구분</span><span>${sideKo} · ${Number(t.quantity || 0).toLocaleString()}주</span></div>`,
      `<div class="trade-row"><span>체결가</span><span>${formatCurrency(Number(t.price || 0))}</span></div>`,
      `<div class="trade-row"><span>거래금액</span><span>${formatCurrency(Number(t.total || 0))}</span></div>`,
      `<div class="trade-row"><span>수수료(모의)</span><span>${formatCurrency(fee)}</span></div>`,
    ];
    if (cashBefore != null && !Number.isNaN(cashBefore)) {
      rows.push(`<div class="trade-row"><span>현금(거래 전)</span><span>${formatCurrency(cashBefore)}</span></div>`);
    }
    if (cashAfter != null && !Number.isNaN(cashAfter)) {
      rows.push(`<div class="trade-row"><span>현금(거래 후)</span><span>${formatCurrency(cashAfter)}</span></div>`);
    }
    rows.push(`<div class="trade-row"><span>총자산(현금+평가·갱신 후)</span><span>${formatCurrency(totalAssets)}</span></div>`);

    el.style.display = 'block';
    el.innerHTML = `<strong>체결 완료</strong>${rows.join('')}`;
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
    let stockEvalDisplay = stockEval;
    let totalValue = cashDisplay + stockEval;

    if (s && typeof s.total_asset === 'number' && !Number.isNaN(s.total_asset)) {
      totalValue = s.total_asset;
    }
    if (s && typeof s.cash_balance === 'number' && !Number.isNaN(s.cash_balance)) {
      cashDisplay = s.cash_balance;
    }
    if (s && typeof s.holding_asset === 'number' && !Number.isNaN(s.holding_asset)) {
      stockEvalDisplay = s.holding_asset;
    }

    const baseCash = Number(portfolio.initialCash || 0);
    const totalReturn = baseCash > 0 ? ((totalValue - baseCash) / baseCash * 100) : 0;
    const totalProfit = totalValue - baseCash;
    const holdingCount = Object.keys(portfolio.holdings).length;
    const unrealizedProfit = Object.values(portfolio.holdings).reduce((sum, h) => {
      return sum + ((h.currentPrice - h.avgPrice) * h.quantity);
    }, 0);

    const cashEl = document.getElementById('cashBalanceDisplay');
    const stockEl = document.getElementById('stockEvalDisplay');
    if (cashEl) cashEl.textContent = formatCurrency(cashDisplay);
    if (stockEl) stockEl.textContent = formatCurrency(stockEvalDisplay);

    document.getElementById('totalBalance').textContent = formatCurrency(totalValue);
    document.getElementById('totalReturn').textContent = (totalReturn >= 0 ? '+' : '') + totalReturn.toFixed(2) + '%';
    document.getElementById('totalReturn').className = 'stat-value ' + changeDirClass(totalReturn);
    document.getElementById('totalProfit').textContent = formatCurrency(totalProfit);
    document.getElementById('totalProfit').className = 'stat-value ' + changeDirClass(totalProfit);
    document.getElementById('holdingCount').textContent = holdingCount + '개';
    document.getElementById('unrealizedProfit').textContent = formatCurrency(unrealizedProfit);
    document.getElementById('unrealizedProfit').className = 'stat-value ' + changeDirClass(unrealizedProfit);
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

  // 보유 종목 렌더링 (행 클릭 → 매도 모달, 이벤트는 holdingsTable에 위임)
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
        <tr class="holding-row" data-holding-key="${keyAttr}" title="클릭하면 매도 창이 열립니다">
          <td class="holding-name">${stock}</td>
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
    historyViewFilter = mode === 'buy' || mode === 'sell' ? mode : 'all';
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

  // 거래 내역 렌더링 (전체 / 매수 / 매도)
  function renderHistory() {
    const tradingHistory = document.getElementById('tradingHistory');
    if (!tradingHistory) return;

    if (portfolio.history.length === 0) {
      tradingHistory.innerHTML = '<div style="text-align: center; color: var(--gray-400); padding: 40px;">아직 체결 내역이 없습니다.</div>';
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
      tradingHistory.innerHTML = '<div style="text-align: center; color: var(--gray-400); padding: 28px;">이 구분에 해당하는 체결이 없습니다.</div>';
      return;
    }

    const historyHtml = items.map(trade => {
      const badgeClass = trade.type === 'buy' ? 'buy' : 'sell';
      const badgeText = trade.type === 'buy' ? '매수' : '매도';
      const tip = trade.code ? escapeHtmlAttr(trade.code) : '';
      return `
      <div class="history-item"${tip ? ' title="' + tip + '"' : ''}>
        <div class="history-info">
          <div class="history-stock"><span>${escapeHtml(trade.stock)}</span><span class="history-badge ${badgeClass}">${badgeText}</span></div>
        </div>
        <div class="history-amount">
          <div class="history-price">${formatCurrency(trade.total)}</div>
          <div class="history-time">${escapeHtml(trade.time)}</div>
        </div>
      </div>
    `;
    }).join('');

    tradingHistory.innerHTML = historyHtml;
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
