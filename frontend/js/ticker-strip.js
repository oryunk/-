/**
 * 파일: 홈 상단 티커(투자 참고 지수)
 * 설명: /api/market-indices 기반 KOSPI·글로벌·원자재 지수 스크롤. 클릭 시 지수 상세 오버레이.
 */
(function () {
  const BACKEND = window.JURIN_API_BASE || 'http://localhost:5000';
  const POLL_MS_SLOW = 20000;
  const POLL_MS_WITH_POPULAR_TABLE = 5000;

  /** 홈 인기 종목 표 갱신용 (티커에는 미표시) */
  const POPULAR_TABLE_STOCKS = [
    { code: '005930', name: '삼성전자' },
    { code: '000660', name: 'SK하이닉스' },
    { code: '035420', name: 'NAVER' },
    { code: '035720', name: '카카오' },
    { code: '005380', name: '현대차' },
  ];

  const DEFAULT_TICKER_ORDER = [
    'kospi', 'kosdaq', 'nasdaq', 'sp500', 'sox', 'usdkrw', 'vix', 'wti', 'copper',
  ];

  const TICKER_LABELS = {
    kospi: 'KOSPI',
    kosdaq: 'KOSDAQ',
    nasdaq: 'NASDAQ',
    sp500: 'S&P 500',
    sox: 'SOX',
    usdkrw: 'USD/KRW',
    vix: 'VIX',
    wti: 'WTI',
    copper: '구리',
  };

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function namesQuery() {
    return encodeURIComponent(
      POPULAR_TABLE_STOCKS.map((x) => `${x.code}:${x.name}`).join('|')
    );
  }

  function rowHtml(name, priceText, direction, pctAbs, signChar, opts) {
    const dir = direction === 'up' ? 'up' : direction === 'down' ? 'down' : 'flat';
    const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '±';
    const sign = signChar != null ? signChar : (direction === 'down' ? '-' : direction === 'up' ? '+' : '');
    const pctPart = pctAbs != null && !Number.isNaN(pctAbs)
      ? `${sign}${Number(pctAbs).toFixed(2)}%`
      : '—';
    const indexKey = opts && opts.indexKey ? String(opts.indexKey) : '';
    const clickable = indexKey ? ' ticker-item--clickable' : '';
    const attrs = indexKey
      ? ` role="button" tabindex="0" data-index-key="${esc(indexKey)}" aria-label="${esc(name)} 상세 보기"`
      : '';
    return (
      `<div class="ticker-item${clickable}"${attrs}>` +
      `<span class="ticker-name">${esc(name)}</span>` +
      `<span class="ticker-price">${esc(priceText)}</span>` +
      `<span class="ticker-change ${dir}">${arrow} ${esc(pctPart)}</span>` +
      '</div>'
    );
  }

  function quoteDirection(stock) {
    if (!stock || stock.loading) return 'flat';
    const d = String(stock.direction || '').toLowerCase();
    if (d === 'up' || d === 'down' || d === 'flat') return d;
    const ch = Number(stock.change);
    if (Number.isFinite(ch)) {
      if (ch > 0) return 'up';
      if (ch < 0) return 'down';
    }
    const r = Number(stock.rate);
    if (Number.isFinite(r)) {
      if (r > 0) return 'up';
      if (r < 0) return 'down';
    }
    return 'flat';
  }

  function formatHomeTableVolume(n) {
    const x = Number(n);
    if (!Number.isFinite(x) || x < 0) return '—';
    if (x === 0) return '0';
    if (x >= 100000000) return (x / 100000000).toFixed(1) + '억';
    if (x >= 10000) return (x / 10000).toFixed(1) + '만';
    return Math.round(x).toLocaleString('ko-KR');
  }

  function updateHomePopularStocksTable(byCode) {
    const rows = document.querySelectorAll('.market-table tbody tr[data-stock-code]');
    if (!rows.length) return;

    rows.forEach((tr) => {
      const code = tr.getAttribute('data-stock-code');
      if (!code) return;
      const stock = byCode[code];
      const priceEl = tr.querySelector('.stock-price');
      const volEl = tr.querySelector('.volume');
      const badgeEl = tr.querySelector('td:nth-child(4) span');
      if (!priceEl || !badgeEl) return;

      if (!stock || stock.loading) {
        priceEl.textContent = '…';
        if (volEl) volEl.textContent = '…';
        badgeEl.className = 'badge-flat';
        badgeEl.textContent = '…';
        return;
      }
      if (stock.error && (stock.price == null || stock.price === '')) {
        priceEl.textContent = '—';
        if (volEl) volEl.textContent = '—';
        badgeEl.className = 'badge-flat';
        badgeEl.textContent = '—';
        return;
      }

      const dir = quoteDirection(stock);
      const rate = Number(stock.rate || 0);
      const absRate = Math.abs(rate).toFixed(2);
      let badgeClass = 'badge-flat';
      let badgeText = `± ${absRate}%`;
      if (dir === 'up') {
        badgeClass = 'badge-up';
        badgeText = `▲ +${absRate}%`;
      } else if (dir === 'down') {
        badgeClass = 'badge-down';
        badgeText = `▼ -${absRate}%`;
      }

      priceEl.textContent = Number(stock.price || 0).toLocaleString('ko-KR');
      if (volEl) volEl.textContent = formatHomeTableVolume(stock.volume);
      badgeEl.className = badgeClass;
      badgeEl.textContent = badgeText;
    });
  }

  function formatMacroPrice(idx) {
    if (idx && idx.value_text) return String(idx.value_text);
    const v = Number(idx && idx.value);
    if (!Number.isFinite(v)) return '—';
    return v.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function tickerDisplayName(idx, key) {
    if (idx && idx.name) return String(idx.name);
    return TICKER_LABELS[key] || key.toUpperCase();
  }

  function indexRow(idx, keyFallback) {
    const key = String((idx && idx.key) || keyFallback || '').trim();
    const name = tickerDisplayName(idx, key);
    const interactive = !!(idx && idx.interactive !== false && key && idx.kind !== 'breadth');
    const clickableOpts = interactive ? { indexKey: key } : null;
    if (!idx || idx.error) {
      return rowHtml(name, '—', 'flat', null, '', clickableOpts);
    }
    const dir = idx.direction || 'flat';
    const sign = dir === 'down' ? '-' : dir === 'up' ? '+' : '';
    const priceText = formatMacroPrice(idx);
    return rowHtml(name, priceText, dir, Math.abs(Number(idx.change_pct || 0)), sign, clickableOpts);
  }

  function buildTickerMacroRows(indicesPayload) {
    const cards = Array.isArray(indicesPayload.cards)
      ? indicesPayload.cards
      : [
          ...(Array.isArray(indicesPayload.indices) ? indicesPayload.indices : []),
          ...(Array.isArray(indicesPayload.global) ? indicesPayload.global : []),
        ];
    const order = Array.isArray(indicesPayload.ticker_order)
      ? indicesPayload.ticker_order
      : DEFAULT_TICKER_ORDER;
    const byKey = {};
    cards.forEach((c) => {
      if (c && c.key && c.kind !== 'breadth') byKey[c.key] = c;
    });
    return order.map((key) => {
      const row = byKey[key];
      if (!row) {
        const label = TICKER_LABELS[key] || key.toUpperCase();
        return rowHtml(label, '…', 'flat', null, '', { indexKey: key });
      }
      return indexRow(row, key);
    });
  }

  function bindTickerIndexClicks(wrap) {
    if (!wrap) return;
    wrap.querySelectorAll('.ticker-item--clickable[data-index-key]').forEach((item) => {
      if (item.dataset.bound === '1') return;
      item.dataset.bound = '1';
      const openDetail = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const key = item.getAttribute('data-index-key');
        if (key && window.IndexDetailOverlay && typeof window.IndexDetailOverlay.open === 'function') {
          window.IndexDetailOverlay.open(key);
        }
      };
      item.addEventListener('click', openDetail);
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDetail(e);
        }
      });
    });
  }

  async function fetchPopularTablePrices() {
    const rows = document.querySelectorAll('.market-table tbody tr[data-stock-code]');
    if (!rows.length) return;

    const codes = POPULAR_TABLE_STOCKS.map((s) => s.code).join(',');
    const url =
      `${BACKEND}/api/live-prices?codes=${encodeURIComponent(codes)}&names=${namesQuery()}` +
      `&page=1&page_size=${POPULAR_TABLE_STOCKS.length}&filter=all`;

    try {
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!data || !data.success) return;
      const byCode = {};
      (data.stocks || []).forEach((s) => {
        if (s && s.code) byCode[s.code] = s;
      });
      updateHomePopularStocksTable(byCode);
    } catch (e) {
      console.warn('[ticker-strip] popular table', e.message);
    }
  }

  async function loadTickerStrip() {
    const wrap = document.getElementById('tickerStripWrap');
    if (!wrap) return;

    let indicesPayload = { cards: [], ticker_order: DEFAULT_TICKER_ORDER };

    try {
      const res = await fetch(`${BACKEND}/api/market-indices`);
      const data = await res.json().catch(() => ({}));
      if (data && data.success) indicesPayload = data;
    } catch (e) {
      console.warn('[ticker-strip]', e.message);
    }

    const macroRows = buildTickerMacroRows(indicesPayload);
    const onePass = macroRows.join('');
    wrap.innerHTML = onePass + onePass;
    bindTickerIndexClicks(wrap);

    await fetchPopularTablePrices();
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('tickerStripWrap')) return;
    const pollMs = document.querySelector('.market-table tbody tr[data-stock-code]')
      ? POLL_MS_WITH_POPULAR_TABLE
      : POLL_MS_SLOW;
    loadTickerStrip();
    setInterval(loadTickerStrip, pollMs);
  });
})();
