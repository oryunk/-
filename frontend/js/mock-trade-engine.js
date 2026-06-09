/**
 * 모의투자 매수/매도 공통 라우팅 — simulation-page.js 와 동일 규칙
 */
(function (global) {
  var MOCK_TRADE_COMMISSION_RATE = 0.00015;
  var MOCK_SECURITIES_TAX_RATE_SELL = 0.0018;
  var KR_MARKET_OPEN_HHMM = 900;
  var KR_MARKET_CLOSE_HHMM = 1530;
  var MARKET_PRICE_LABEL = '가장 빠른 금액';

  function apiBase() {
    return typeof global.jurinApiBase === 'function'
      ? global.jurinApiBase()
      : global.JURIN_API_BASE || 'http://127.0.0.1:5000';
  }

  function formatCurrency(v) {
    var n = Math.floor(Number(v) || 0);
    return '₩' + n.toLocaleString('ko-KR');
  }

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

  function tradeLocalYmd(ms) {
    if (!ms) return '';
    var d = new Date(ms);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

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

  function estimateMockTradeCosts(side, grossWon) {
    var g = Math.max(0, Math.floor(Number(grossWon) || 0));
    if (g <= 0) return { gross: 0, fee: 0, tax: 0, netBuy: 0, netSell: 0 };
    var fee = Math.round(g * MOCK_TRADE_COMMISSION_RATE);
    if (fee < 1) fee = 1;
    var tax = 0;
    if (String(side || '').toUpperCase() === 'SELL') {
      tax = Math.round(g * MOCK_SECURITIES_TAX_RATE_SELL);
    }
    return { gross: g, fee: fee, tax: tax, netBuy: g + fee, netSell: g - fee - tax };
  }

  function limitOrderNeedsPriceQueue(side, refPx, limPx) {
    if (!(limPx > 0) || !(refPx > 0)) return false;
    if (side === 'BUY') return refPx > limPx;
    return refPx < limPx;
  }

  function resolveMockExecutionPrice(side, refPx, limPx) {
    var ref = Math.floor(Number(refPx) || 0);
    var lim = Math.floor(Number(limPx) || 0);
    if (ref <= 0) return lim > 0 ? lim : 0;
    if (lim <= 0) return ref;
    if (side === 'BUY') return lim >= ref ? ref : 0;
    return lim <= ref ? ref : 0;
  }

  function isBalanceInsufficientMessage(msg) {
    var s = String(msg || '');
    return s.indexOf('부족') >= 0 || s.indexOf('잔액') >= 0;
  }

  function board() {
    return global.JurinMockOrderBoard || null;
  }

  function sumPendingBuyReservation(excludeOrderId) {
    var sum = 0;
    var ex = excludeOrderId != null ? Number(excludeOrderId) : null;
    var list = board() ? board().readPendingOrders() : [];
    list.forEach(function (o) {
      if (!o || o.side !== 'BUY') return;
      if (ex != null && Number.isFinite(ex) && o.id === ex) return;
      var q = Number(o.quantity) || 0;
      var px = Number(o.limitPrice) || 0;
      if (q <= 0 || px <= 0) return;
      sum += estimateMockTradeCosts('BUY', px * q).netBuy;
    });
    return sum;
  }

  async function fetchPortfolioCash() {
    try {
      var res = await fetch(apiBase() + '/api/mock/portfolio', { credentials: 'include' });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok || !data.success) return 0;
      var acct = data.account || {};
      var cash = Number(acct.cash_balance);
      if (Number.isFinite(cash)) return Math.max(0, Math.floor(cash));
      return 0;
    } catch (_) {
      return 0;
    }
  }

  async function fetchLatestMarketPrice(stockRef) {
    var ref = String(stockRef || '').trim();
    if (!/^\d{6}$/.test(ref)) return 0;
    try {
      var url =
        apiBase() +
        '/api/live-prices?codes=' +
        encodeURIComponent(ref) +
        '&page_size=1';
      var res = await fetch(url);
      var data = await res.json().catch(function () {
        return {};
      });
      if (res.ok && data && Array.isArray(data.stocks) && data.stocks[0]) {
        var p = Number(data.stocks[0].price || 0);
        if (p > 0) return Math.floor(p);
      }
    } catch (_) { /* ignore */ }
    return 0;
  }

  async function resolveBuyUnitPrice(limPx, stockRef) {
    var lim = Number(limPx) || 0;
    var ref = await fetchLatestMarketPrice(stockRef);
    ref = ref > 0 ? Math.floor(ref) : 0;
    if (lim <= 0) return ref;
    var exec = resolveMockExecutionPrice('BUY', ref, lim);
    if (exec > 0) return exec;
    return Math.floor(lim);
  }

  function validateBuyAffordability(quantity, unitPx, cashBalance) {
    var qty = Math.floor(Number(quantity) || 0);
    var px = Math.floor(Number(unitPx) || 0);
    if (qty <= 0) return { ok: false, message: '수량은 1 이상이어야 합니다.' };
    if (px <= 0) {
      return { ok: false, message: '체결 기준가를 확인할 수 없습니다. 가격을 확인해 주세요.' };
    }
    var required = estimateMockTradeCosts('BUY', px * qty).netBuy;
    var cash = Math.max(0, Math.floor(Number(cashBalance) || 0));
    var reserved = sumPendingBuyReservation();
    var available = Math.max(0, cash - reserved);
    if (required <= available) {
      return { ok: true, required: required, available: available, orderableCash: cash, reserved: reserved };
    }
    return { ok: false, required: required, available: available, orderableCash: cash, reserved: reserved };
  }

  async function executeTradeRequest(side, stock, quantity, price) {
    var res = await fetch(apiBase() + '/api/mock/trade', {
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
    var data = await res.json().catch(function () {
      return {};
    });
    return { res: res, data: data };
  }

  function recordInsufficientCashUnfilled(ctx) {
    ctx = ctx || {};
    var b = board();
    if (!b || typeof b.pushMockOrderStatusEvent !== 'function') return;
    var stockRef = String(ctx.stockRef || '').trim();
    var stockLabel = String(ctx.stock || ctx.stockLabel || stockRef || '').trim();
    if (!stockRef && !stockLabel) return;
    b.pushMockOrderStatusEvent({
      stockRef: stockRef || stockLabel,
      stock: stockLabel,
      side: 'BUY',
      mode: ctx.mode || 'manual',
      status: 'failed',
      desiredPrice: Math.floor(Number(ctx.unitPx != null ? ctx.unitPx : ctx.limPx || 0)),
      quantity: Math.floor(Number(ctx.quantity) || 0),
      note: ctx.note || '예수금 부족',
    });
  }

  async function blockBuyIfInsufficient(quantity, limPx, stockRef, ctx, hooks) {
    var unitPx = await resolveBuyUnitPrice(limPx, stockRef);
    var cash = await fetchPortfolioCash();
    var v = validateBuyAffordability(quantity, unitPx, cash);
    if (v.ok) return null;
    if (v.message) {
      if (hooks && hooks.onError) hooks.onError('주문 안내', v.message);
      return v;
    }
    ctx = ctx || {};
    ctx.unitPx = unitPx;
    ctx.quantity = Math.floor(Number(quantity) || 0);
    ctx.stockRef = stockRef;
    if (ctx.recordUnfilled !== false) recordInsufficientCashUnfilled(ctx);
    if (hooks && hooks.onInsufficientCash) hooks.onInsufficientCash(v, ctx);
    return v;
  }

  async function handleLimitOrderSubmission(params) {
    var side = params.side === 'SELL' ? 'SELL' : 'BUY';
    var stock = params.stock;
    var stockRef = params.stockRef || stock;
    var quantity = params.quantity;
    var limPx = Number(params.limPx || 0);
    var hooks = params.hooks || {};

    async function ensureBuyCash(recordUnfilled) {
      if (side !== 'BUY') return true;
      var blocked = await blockBuyIfInsufficient(quantity, limPx, stockRef, {
        stock: stock,
        quantity: quantity,
        market: !(limPx > 0),
        limitLabel: limPx > 0 ? ' (지정가)' : '',
        recordUnfilled: recordUnfilled !== false,
        mode: params.mode || 'manual',
      }, hooks);
      return !blocked;
    }

    if (!(limPx > 0)) {
      if (!isKrRegularMarketOpenNow()) {
        if (hooks.onMarketClosed) hooks.onMarketClosed(side);
        return { ok: false, blocked: true };
      }
      if (!(await ensureBuyCash(false))) return { ok: false, blocked: true };
      return { ok: true, execute: true };
    }

    if (!isKrRegularMarketOpenNow()) {
      if (!(await ensureBuyCash(false))) return { ok: false, blocked: true };
      var refOff = await fetchLatestMarketPrice(stockRef);
      var b = board();
      if (!b || typeof b.registerPendingOrder !== 'function') {
        if (hooks.onError) hooks.onError('주문 안내', '예약 주문을 저장할 수 없습니다.');
        return { ok: false, blocked: true };
      }
      var pOff = b.registerPendingOrder({
        side: side,
        stock: stock,
        stockRef: stockRef,
        quantity: quantity,
        limitPrice: limPx,
        reason: 'off_hours',
        targetSessionYmd: getNextKrTradingSessionYmd(Date.now()),
        refPx: refOff,
      });
      return { ok: true, pending: pOff };
    }

    var refPx = await fetchLatestMarketPrice(stockRef);
    if (limitOrderNeedsPriceQueue(side, refPx, limPx)) {
      if (!(await ensureBuyCash(false))) return { ok: false, blocked: true };
      var b2 = board();
      if (!b2 || typeof b2.registerPendingOrder !== 'function') {
        if (hooks.onError) hooks.onError('주문 안내', '대기 주문을 저장할 수 없습니다.');
        return { ok: false, blocked: true };
      }
      var p = b2.registerPendingOrder({
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

    if (!(await ensureBuyCash(false))) return { ok: false, blocked: true };
    return { ok: true, execute: true };
  }

  async function submitMockTrade(params) {
    params = params || {};
    var hooks = params.hooks || {};
    var side = params.side === 'SELL' ? 'SELL' : 'BUY';
    var stock = params.stock;
    var stockRef = params.stockRef || stock;
    var quantity = Math.floor(Number(params.quantity) || 0);
    var limPx = Math.floor(Number(params.limPx) || 0);
    var mode = params.mode || 'manual';

    if (quantity < 1) {
      if (hooks.onError) hooks.onError('주문 안내', '수량은 1 이상이어야 합니다.');
      return { ok: false };
    }

    var routed = await handleLimitOrderSubmission({
      side: side,
      stock: stock,
      stockRef: stockRef,
      quantity: quantity,
      limPx: limPx,
      mode: mode,
      hooks: hooks,
    });
    if (!routed.ok) return { ok: false, blocked: routed.blocked };
    if (routed.pending) return { ok: true, pending: routed.pending };

    var out = await executeTradeRequest(side, stockRef, quantity, limPx);
    var res = out.res;
    var data = out.data;

    if (res.status === 401) {
      if (hooks.onUnauthorized) hooks.onUnauthorized(data.message || '로그인이 필요합니다.');
      return { ok: false, unauthorized: true };
    }

    if (!res.ok || !data.success) {
      var msg = (data && data.message) || '주문 처리에 실패했습니다.';
      if (side === 'BUY' && isBalanceInsufficientMessage(msg)) {
        var unitPx = await resolveBuyUnitPrice(limPx, stockRef);
        var cash = await fetchPortfolioCash();
        var v = validateBuyAffordability(quantity, unitPx, cash);
        recordInsufficientCashUnfilled({
          stockRef: stockRef,
          stock: stock,
          quantity: quantity,
          unitPx: unitPx,
          limPx: limPx,
          mode: mode,
        });
        if (hooks.onInsufficientCash) hooks.onInsufficientCash(v, { stock: stock, quantity: quantity, unitPx: unitPx, market: !(limPx > 0) });
      } else {
        var b = board();
        if (b && typeof b.pushMockOrderStatusEvent === 'function') {
          b.pushMockOrderStatusEvent({
            stockRef: stockRef,
            stock: stock,
            side: side,
            mode: mode,
            status: 'failed',
            desiredPrice: limPx,
            quantity: quantity,
            note: msg,
          });
        }
        if (hooks.onError) hooks.onError('주문 실패', msg);
      }
      return { ok: false, error: msg };
    }

    var tr = (data && data.trade) || {};
    var bOk = board();
    if (bOk && typeof bOk.pushMockOrderStatusEvent === 'function') {
      bOk.pushMockOrderStatusEvent({
        stockRef: tr.code || stockRef,
        stock: tr.name || stock,
        side: side,
        mode: mode,
        status: 'executed',
        desiredPrice: limPx,
        executedPrice: Number(tr.price || 0),
        quantity: Number(tr.quantity || quantity),
      });
    }
    return { ok: true, executed: true, data: data };
  }

  global.JurinMockTradeEngine = {
    MARKET_PRICE_LABEL: MARKET_PRICE_LABEL,
    formatCurrency: formatCurrency,
    isKrRegularMarketOpenNow: isKrRegularMarketOpenNow,
    handleLimitOrderSubmission: handleLimitOrderSubmission,
    executeTradeRequest: executeTradeRequest,
    submitMockTrade: submitMockTrade,
    fetchLatestMarketPrice: fetchLatestMarketPrice,
    fetchPortfolioCash: fetchPortfolioCash,
    isBalanceInsufficientMessage: isBalanceInsufficientMessage,
    resolveBuyUnitPrice: resolveBuyUnitPrice,
    validateBuyAffordability: validateBuyAffordability,
  };
})(typeof window !== 'undefined' ? window : globalThis);
