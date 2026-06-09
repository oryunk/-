/**
 * 시장정보·모의투자 공통 매매 안내/오류 모달 (초록·흰색)
 */
(function (global) {
  var primaryHandler = null;

  function $(id) {
    return global.document.getElementById(id);
  }

  function formatCurrency(v) {
    if (global.JurinMockTradeEngine && typeof global.JurinMockTradeEngine.formatCurrency === 'function') {
      return global.JurinMockTradeEngine.formatCurrency(v);
    }
    var n = Math.floor(Number(v) || 0);
    return '₩' + n.toLocaleString('ko-KR');
  }

  function openMarketTradeNoticeModal(opts) {
    opts = opts || {};
    var modal = $('marketTradeNoticeModal');
    if (!modal) return;

    var panelEl = $('marketTradeNoticePanel');
    var titleEl = $('marketTradeNoticeTitle');
    var leadEl = $('marketTradeNoticeLead');
    var summaryEl = $('marketTradeNoticeSummary');
    var tipEl = $('marketTradeNoticeTip');
    var extraEl = $('marketTradeNoticeExtra');
    var primaryBtn = $('marketTradeNoticePrimary');
    var confirmBtn = $('marketTradeNoticeConfirm');
    var actionsEl = $('marketTradeNoticeActions');
    var isSimple = opts.variant === 'simple';

    if (panelEl) panelEl.classList.toggle('mock-trade-notice-panel--simple', isSimple);
    if (titleEl) titleEl.textContent = opts.title || '';
    if (leadEl) leadEl.textContent = opts.lead || opts.message || '';

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

    primaryHandler = typeof opts.onPrimary === 'function' ? opts.onPrimary : null;

    var showPrimary = !!opts.showPrimary;
    var showConfirm = opts.showConfirm !== false;

    if (primaryBtn) {
      primaryBtn.hidden = !showPrimary;
      if (showPrimary) primaryBtn.textContent = opts.primaryLabel || '확인';
    }
    if (confirmBtn) {
      confirmBtn.hidden = !showConfirm;
      confirmBtn.textContent = opts.confirmLabel || '확인';
      confirmBtn.classList.toggle('mock-trade-notice-confirm-btn', isSimple);
      confirmBtn.classList.toggle('mock-trade-dialog-ghost', !isSimple);
    }
    if (actionsEl) {
      actionsEl.hidden = !showPrimary && !showConfirm;
      actionsEl.classList.toggle('mock-trade-notice-actions--simple', isSimple);
    }

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeMarketTradeNoticeModal() {
    var modal = $('marketTradeNoticeModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    primaryHandler = null;
  }

  function runMarketTradeNoticePrimary() {
    if (primaryHandler) primaryHandler();
  }

  function openMarketTradeErrorModal(title, message) {
    openMarketTradeNoticeModal({
      variant: 'simple',
      title: title || '주문 안내',
      lead: message || '',
      showPrimary: false,
      showConfirm: true,
      confirmLabel: '확인',
    });
  }

  function openMarketClosedModal(side, onSwitchLimit) {
    openMarketTradeNoticeModal({
      title: '장 마감 · 시장가 불가',
      lead:
        '장이 열려 있지 않아 시장가 주문을 넣을 수 없습니다. 지정가로 예약하거나 정규장(09:00~15:30)에 다시 시도해 주세요.',
      tip: '예약은 다음 정규장까지 유효하며, 해당 장(09:00~15:30)에서 지정가 조건이 맞으면 자동 체결됩니다.',
      extra: '정규장: 평일 09:00 ~ 15:30',
      showPrimary: true,
      primaryLabel: '지정가로 전환',
      showConfirm: true,
      confirmLabel: '닫기',
      onPrimary: function () {
        if (typeof onSwitchLimit === 'function') onSwitchLimit(side);
        closeMarketTradeNoticeModal();
      },
    });
  }

  function openMarketInsufficientCashModal(validation, ctx) {
    ctx = ctx || {};
    var modal = $('marketInsufficientCashModal');
    if (!modal || !validation) return;

    var required = Math.max(0, Math.floor(Number(validation.required) || 0));
    var available = Math.max(0, Math.floor(Number(validation.available) || 0));
    var shortfall = Math.max(0, required - available);
    var qty = Math.floor(Number(ctx.quantity) || 0);
    var unitPx = Math.floor(Number(ctx.unitPx) || 0);
    var label =
      global.JurinMockTradeEngine && global.JurinMockTradeEngine.MARKET_PRICE_LABEL
        ? global.JurinMockTradeEngine.MARKET_PRICE_LABEL
        : '가장 빠른 금액';

    var stockLine = $('marketInsufficientCashStockLine');
    var qtyLine = $('marketInsufficientCashQtyLine');
    var unitLine = $('marketInsufficientCashUnitLine');
    var reqEl = $('marketInsufficientCashRequired');
    var availEl = $('marketInsufficientCashAvailable');
    var shortEl = $('marketInsufficientCashShortfall');

    if (stockLine) stockLine.textContent = ctx.stock || '—';
    if (qtyLine) qtyLine.textContent = qty > 0 ? qty.toLocaleString() + '주' : '—';
    if (unitLine) {
      if (unitPx > 0) {
        var unitSuffix = ctx.market ? ' (' + label + ')' : ctx.limitLabel || '';
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

  function closeMarketInsufficientCashModal() {
    var modal = $('marketInsufficientCashModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  global.JurinMockTradeModals = {
    openMarketTradeNoticeModal: openMarketTradeNoticeModal,
    closeMarketTradeNoticeModal: closeMarketTradeNoticeModal,
    openMarketTradeErrorModal: openMarketTradeErrorModal,
    openMarketClosedModal: openMarketClosedModal,
    openMarketInsufficientCashModal: openMarketInsufficientCashModal,
    closeMarketInsufficientCashModal: closeMarketInsufficientCashModal,
  };

  global.closeMarketTradeNoticeModal = closeMarketTradeNoticeModal;
  global.closeMarketInsufficientCashModal = closeMarketInsufficientCashModal;
  global.runMarketTradeNoticePrimary = runMarketTradeNoticePrimary;
})(typeof window !== 'undefined' ? window : globalThis);
