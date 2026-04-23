/**
 * 홈 상단 티커: 주요 종목 + KOSPI/KOSDAQ + USD/KRW (시장 페이지보다 느린 주기로 갱신)
 */
(function () {
  const BACKEND = window.JURIN_API_BASE || 'http://localhost:5000';
  const POLL_MS = 20000;

  const TICKER_STOCKS = [
    { code: '005930', name: '삼성전자' },
    { code: '000660', name: 'SK하이닉스' },
    { code: '035420', name: 'NAVER' },
    { code: '035720', name: '카카오' },
    { code: '005380', name: '현대차' },
  ];

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function namesQuery() {
    return encodeURIComponent(
      TICKER_STOCKS.map((x) => `${x.code}:${x.name}`).join('|')
    );
  }

  function rowHtml(name, priceText, direction, pctAbs, signChar) {
    const dir = direction === 'up' ? 'up' : direction === 'down' ? 'down' : 'flat';
    const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '±';
    const sign = signChar != null ? signChar : (direction === 'down' ? '-' : direction === 'up' ? '+' : '');
    const pctPart = pctAbs != null && !Number.isNaN(pctAbs)
      ? `${sign}${Number(pctAbs).toFixed(2)}%`
      : '—';
    return (
      '<div class="ticker-item">' +
      `<span class="ticker-name">${esc(name)}</span>` +
      `<span class="ticker-price">${esc(priceText)}</span>` +
      `<span class="ticker-change ${dir}">${arrow} ${esc(pctPart)}</span>` +
      '</div>'
    );
  }

  function stockRow(stock) {
    if (!stock || stock.loading) {
      return rowHtml(stock && stock.name ? stock.name : '종목', '…', 'flat', null, '');
    }
    if (stock.error && (stock.price == null || stock.price === '')) {
      return rowHtml(stock.name || stock.code, '—', 'flat', null, '');
    }
    const dir = stock.direction || 'flat';
    const rate = Number(stock.rate || 0);
    const sign = dir === 'down' ? '-' : dir === 'up' ? '+' : '';
    const priceText = Number(stock.price || 0).toLocaleString('ko-KR');
    return rowHtml(stock.name || stock.code, priceText, dir, Math.abs(rate), sign);
  }

  function indexRow(idx) {
    if (!idx || idx.error) {
      return rowHtml(idx && idx.name ? idx.name : '지수', '—', 'flat', null, '');
    }
    const dir = idx.direction || 'flat';
    const sign = dir === 'down' ? '-' : dir === 'up' ? '+' : '';
    const priceText = Number(idx.value).toLocaleString('ko-KR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return rowHtml(idx.name, priceText, dir, Math.abs(Number(idx.change_pct || 0)), sign);
  }

  function fxRow(fx) {
    if (!fx || !fx.success) {
      return rowHtml('USD/KRW', '—', 'flat', null, '');
    }
    const dir = fx.direction || 'flat';
    const sign = dir === 'down' ? '-' : dir === 'up' ? '+' : '';
    const priceText = Number(fx.value).toLocaleString('ko-KR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    });
    return rowHtml('USD/KRW', priceText, dir, Math.abs(Number(fx.change_pct || 0)), sign);
  }

  async function loadTickerStrip() {
    const wrap = document.getElementById('tickerStripWrap');
    if (!wrap) return;

    const codes = TICKER_STOCKS.map((s) => s.code).join(',');
    const stocksUrl =
      `${BACKEND}/api/live-prices?codes=${encodeURIComponent(codes)}&names=${namesQuery()}` +
      `&page=1&page_size=${TICKER_STOCKS.length}&filter=all`;

    let stocksPayload = { stocks: [] };
    let indicesPayload = { indices: [] };
    let fxPayload = { success: false };

    try {
      const [sr, ir, fr] = await Promise.all([
        fetch(stocksUrl).then((r) => r.json()).catch(() => ({})),
        fetch(`${BACKEND}/api/market-indices`).then((r) => r.json()).catch(() => ({})),
        fetch(`${BACKEND}/api/fx-usd-krw`).then((r) => r.json()).catch(() => ({ success: false })),
      ]);
      if (sr && sr.success) stocksPayload = sr;
      if (ir && ir.success) indicesPayload = ir;
      if (fr && fr.success) fxPayload = fr;
    } catch (e) {
      console.warn('[ticker-strip]', e.message);
    }

    const byCode = {};
    (stocksPayload.stocks || []).forEach((s) => {
      if (s && s.code) byCode[s.code] = s;
    });

    const stockRows = TICKER_STOCKS.map((spec) => stockRow(byCode[spec.code] || { ...spec, loading: true }));

    const wantIdx = new Set(['KOSPI', 'KOSDAQ']);
    const idxList = (indicesPayload.indices || []).filter((x) => x && wantIdx.has(x.name));
    const kospi = idxList.find((x) => x.name === 'KOSPI');
    const kosdaq = idxList.find((x) => x.name === 'KOSDAQ');
    const indexRows = [indexRow(kospi || { name: 'KOSPI', error: true }), indexRow(kosdaq || { name: 'KOSDAQ', error: true })];

    const fxRows = [fxRow(fxPayload)];

    const onePass = [...stockRows, ...indexRows, ...fxRows].join('');
    wrap.innerHTML = onePass + onePass;
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('tickerStripWrap')) return;
    loadTickerStrip();
    setInterval(loadTickerStrip, POLL_MS);
  });
})();
