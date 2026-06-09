/**
 * 모의투자 주문/체결 현황 — 시장정보·모의투자 페이지 간 localStorage 동기화
 */
(function (global) {
  var LS_MOCK_EVENTS = 'jurinMockOrderStatusEventsV1';
  var LS_MOCK_PENDING = 'jurinMockPendingOrdersV1';
  var LS_MOCK_PENDING_SEQ = 'jurinMockPendingOrderSeqV1';
  var MAX_EVENTS = 40;

  function nowStamp() {
    return new Date().toLocaleTimeString('ko-KR', { hour12: false });
  }

  function readEvents() {
    try {
      var raw = global.localStorage.getItem(LS_MOCK_EVENTS);
      if (!raw) return [];
      var evs = JSON.parse(raw);
      return Array.isArray(evs) ? evs : [];
    } catch (_) {
      return [];
    }
  }

  function writeEvents(events) {
    try {
      global.localStorage.setItem(LS_MOCK_EVENTS, JSON.stringify(events));
    } catch (_) { /* ignore */ }
  }

  function readPendingOrders() {
    try {
      var raw = global.localStorage.getItem(LS_MOCK_PENDING);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function writePendingOrders(orders, seq) {
    try {
      global.localStorage.setItem(LS_MOCK_PENDING, JSON.stringify(orders));
      if (seq != null) global.localStorage.setItem(LS_MOCK_PENDING_SEQ, String(seq));
    } catch (_) { /* ignore */ }
  }

  function getPendingSeq() {
    try {
      var raw = global.localStorage.getItem(LS_MOCK_PENDING_SEQ);
      var n = parseInt(raw, 10);
      return !Number.isNaN(n) && n > 0 ? n : 1;
    } catch (_) {
      return 1;
    }
  }

  function notifyUpdated(detail) {
    try {
      global.dispatchEvent(
        new CustomEvent('jurin-mock-order-board-updated', {
          detail: detail || { type: 'event' },
        })
      );
    } catch (_) { /* ignore */ }
  }

  function pushMockOrderStatusEvent(evt) {
    if (!evt) return;
    var tsMs =
      typeof evt.atMs === 'number' && Number.isFinite(evt.atMs) ? evt.atMs : Date.now();
    var stockRef = String(evt.stockRef || '').trim();
    var stock = String(evt.stock || evt.stockName || stockRef || '').trim();
    var events = readEvents();
    events.unshift({
      at: evt.at || nowStamp(),
      atMs: tsMs,
      stock: stock,
      stockRef: stockRef,
      side: evt.side === 'SELL' ? 'SELL' : 'BUY',
      mode: evt.mode || 'manual',
      status: evt.status || 'executed',
      desiredPrice: Number(evt.desiredPrice || 0),
      executedPrice: Number(evt.executedPrice || 0),
      quantity: Number(evt.quantity || 0),
      note: String(evt.note || ''),
    });
    if (events.length > MAX_EVENTS) events = events.slice(0, MAX_EVENTS);
    writeEvents(events);
    notifyUpdated({ type: 'event' });
  }

  function registerPendingOrder(opts) {
    var o = opts || {};
    var createdAt = Date.now();
    var reason = o.reason === 'off_hours' ? 'off_hours' : 'price';
    var seq = getPendingSeq();
    var pending = {
      id: seq,
      side: o.side === 'SELL' ? 'SELL' : 'BUY',
      stock: o.stock,
      stockRef: o.stockRef,
      quantity: o.quantity,
      limitPrice: o.limitPrice,
      createdAt: createdAt,
      reason: reason,
    };
    if (reason === 'off_hours' && typeof o.targetSessionYmd === 'string' && o.targetSessionYmd) {
      pending.targetSessionYmd = o.targetSessionYmd;
    }
    var list = readPendingOrders();
    list.push(pending);
    writePendingOrders(list, seq + 1);
    notifyUpdated({ type: 'pending' });
    return pending;
  }

  global.JurinMockOrderBoard = {
    LS_MOCK_EVENTS: LS_MOCK_EVENTS,
    LS_MOCK_PENDING: LS_MOCK_PENDING,
    LS_MOCK_PENDING_SEQ: LS_MOCK_PENDING_SEQ,
    readEvents: readEvents,
    writeEvents: writeEvents,
    readPendingOrders: readPendingOrders,
    writePendingOrders: writePendingOrders,
    getPendingSeq: getPendingSeq,
    pushMockOrderStatusEvent: pushMockOrderStatusEvent,
    registerPendingOrder: registerPendingOrder,
  };
})(typeof window !== 'undefined' ? window : globalThis);
