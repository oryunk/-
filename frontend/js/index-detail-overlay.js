/**
 * 지수 상세 전체 화면 오버레이 (홈 티커 KOSPI 등) — 시장 종목 차트 UI와 동일
 */
(function () {
  const BACKEND = window.JURIN_API_BASE || 'http://localhost:5000';

  const RANGES = [
    { id: '1d', label: '1일' },
    { id: '1w', label: '1주' },
    { id: '1m', label: '1개월' },
    { id: '1y', label: '1년' },
  ];

  const INDEX_KEY_BY_NAME = { KOSPI: 'kospi', KOSDAQ: 'kosdaq', 'KOSPI 200': 'kospi200' };

  const RAIL_GROUPS = [
    { id: 'index', label: '주가지수' },
    { id: 'fx', label: '환율' },
    { id: 'commodity', label: '원자재' },
  ];

  const RAIL_KEY_ORDER = [
    'kospi', 'kosdaq', 'kospi200', 'nasdaq', 'sp500', 'sox', 'vix', 'usdkrw', 'wti', 'copper',
  ];

  let activeKey = 'kospi';
  let activeRange = '1d';
  let historyCache = new Map();
  let indicesSnapshot = [];
  let loadSeq = 0;
  let indexChartInstance = null;
  let chartResizeObserver = null;

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function el(id) {
    return document.getElementById(id);
  }

  function formatIndexPrice(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return n.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatVolume(n) {
    const x = Number(n);
    if (!Number.isFinite(x) || x < 0) return '—';
    if (x === 0) return '0';
    if (x >= 100000000) return (x / 100000000).toFixed(1) + '억';
    if (x >= 10000) return (x / 10000).toFixed(1) + '만';
    return Math.round(x).toLocaleString('ko-KR');
  }

  function destroyIndexChart() {
    if (chartResizeObserver) {
      chartResizeObserver.disconnect();
      chartResizeObserver = null;
    }
    if (indexChartInstance) {
      indexChartInstance.remove();
      indexChartInstance = null;
    }
  }

  function applyDefaultChartViewport(candles, intraday, rangeId) {
    if (!indexChartInstance || !candles || candles.length < 2) {
      indexChartInstance?.timeScale().fitContent();
      return;
    }
    if (rangeId === '1d' && intraday) {
      // 최근 1~2거래일 분봉이 꽉 차 보이도록 (전체 1개월은 좌우 스크롤)
      const showBars = Math.min(candles.length, 96);
      const from = Math.max(0, candles.length - showBars);
      indexChartInstance.timeScale().setVisibleLogicalRange({
        from,
        to: candles.length - 1,
      });
      return;
    }
    indexChartInstance.timeScale().fitContent();
  }

  function renderIndexChart(candles, ma5, ma20, intraday, rangeId) {
    const container = el('indexDetailChart');
    const wrap = el('indexDetailChartWrap');
    const skeleton = el('indexDetailChartSkeleton');
    const note = el('indexDetailChartNote');
    if (!container || typeof LightweightCharts === 'undefined') {
      if (note) {
        note.textContent = '차트 라이브러리를 불러오지 못했습니다.';
        note.style.display = '';
      }
      if (skeleton) skeleton.style.display = 'none';
      return;
    }

    destroyIndexChart();
    if (skeleton) skeleton.style.display = 'none';
    if (note) note.style.display = 'none';
    if (wrap) wrap.style.display = '';

    indexChartInstance = LightweightCharts.createChart(container, {
      width: container.clientWidth,
      height: 220,
      layout: {
        background: { color: 'transparent' },
        textColor: '#8899aa',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.05)' },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
      },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        timeVisible: !!intraday,
        secondsVisible: false,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    const candleSeries = indexChartInstance.addCandlestickSeries({
      upColor: '#ef5350',
      downColor: '#42a5f5',
      borderUpColor: '#ef5350',
      borderDownColor: '#42a5f5',
      wickUpColor: '#ef5350',
      wickDownColor: '#42a5f5',
    });
    candleSeries.setData(candles);

    if (ma5 && ma5.length > 0) {
      const s = indexChartInstance.addLineSeries({
        color: '#d97706',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      s.setData(ma5);
    }
    if (ma20 && ma20.length > 0) {
      const s = indexChartInstance.addLineSeries({
        color: '#ce93d8',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      s.setData(ma20);
    }

    applyDefaultChartViewport(candles, !!intraday, rangeId || activeRange);

    chartResizeObserver = new ResizeObserver(() => {
      if (indexChartInstance && container) {
        indexChartInstance.applyOptions({ width: container.clientWidth });
      }
    });
    chartResizeObserver.observe(container);
  }

  async function fetchHistory(key, range) {
    const cacheId = `${key}:${range}`;
    const hit = historyCache.get(cacheId);
    if (hit && Date.now() - hit.ts < 60000) return hit.payload;
    const res = await fetch(
      `${BACKEND}/api/market-indices/history/${encodeURIComponent(key)}?range=${encodeURIComponent(range)}`
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.message || '지수 차트 조회 실패');
    historyCache.set(cacheId, { payload: data, ts: Date.now() });
    return data;
  }

  function regionIcon(region, kind) {
    if (kind === 'fx') return '💱';
    if (region === 'US') return '🇺🇸';
    if (region === 'GLOBAL') return '🌐';
    return '🇰🇷';
  }

  function railKind(idx) {
    const k = String((idx && idx.kind) || 'index').toLowerCase();
    if (k === 'fx' || k === 'commodity') return k;
    return 'index';
  }

  function sortByRailOrder(items) {
    const orderMap = {};
    RAIL_KEY_ORDER.forEach((key, i) => {
      orderMap[key] = i;
    });
    return items.slice().sort((a, b) => {
      const ka = String(a.key || '').toLowerCase();
      const kb = String(b.key || '').toLowerCase();
      return (orderMap[ka] ?? 999) - (orderMap[kb] ?? 999);
    });
  }

  function groupIndicesForRail(cards) {
    const buckets = { index: [], fx: [], commodity: [] };
    (cards || []).forEach((c) => {
      buckets[railKind(c)].push(c);
    });
    return RAIL_GROUPS.map((g) => ({
      id: g.id,
      label: g.label,
      items: sortByRailOrder(buckets[g.id] || []),
    })).filter((g) => g.items.length > 0);
  }

  async function fetchIndices() {
    const res = await fetch(`${BACKEND}/api/market-indices`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.message || '지수 조회 실패');
    const cards = Array.isArray(data.cards)
      ? data.cards
      : [...(Array.isArray(data.indices) ? data.indices : []), ...(Array.isArray(data.global) ? data.global : [])];
    return cards.filter(
      (x) => x && x.key && x.interactive !== false && x.kind !== 'breadth'
    );
  }

  function renderHeader(payload) {
    const name = payload.name || activeKey.toUpperCase();
    const dir = payload.direction || 'flat';
    const sign = dir === 'up' ? '+' : dir === 'down' ? '-' : '';
    const changePct = Math.abs(Number(payload.change_pct || 0)).toFixed(2);
    const changeAbs = Math.abs(Number(payload.change_abs || 0)).toFixed(2);
    const refLabel = payload.reference_label || '전일 종가';
    const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '±';

    el('indexDetailName').textContent = name;
    const regionTag = el('indexDetailRegionTag');
    const regionIconEl = el('indexDetailRegionIcon');
    if (regionTag) regionTag.textContent = payload.region_label || '한국';
    if (regionIconEl) regionIconEl.textContent = regionIcon(payload.region || 'KR', payload.kind);
    el('indexDetailMeta').textContent = `${refLabel} · ${payload.range_label || activeRange}${payload.ts ? ' · ' + payload.ts : ''}`;
    el('indexDetailPrice').textContent = formatIndexPrice(payload.value);
    const ch = el('indexDetailChange');
    ch.className = 'detail-price-sub ' + dir;
    ch.textContent = `${arrow} ${sign}${changePct}% (${sign}${changeAbs})`;
  }

  function renderStats(payload) {
    const stats = payload.stats || {};
    const volLabel = payload.volume_label || '거래량';
    const map = [
      ['시가', stats.open, false],
      ['고가', stats.high, false],
      ['저가', stats.low, false],
      [volLabel, stats.volume, true],
    ];
    const grid = el('indexDetailStats');
    if (!grid) return;
    grid.innerHTML = map
      .map(([label, val, isVol]) => {
        const text = isVol ? formatVolume(val) : formatIndexPrice(val);
        return (
          '<div class="detail-card">' +
          `<div class="detail-label">${esc(label)}</div>` +
          `<div class="detail-value">${esc(text)}</div>` +
          '</div>'
        );
      })
      .join('');
  }

  function showChartLoading() {
    const wrap = el('indexDetailChartWrap');
    const skeleton = el('indexDetailChartSkeleton');
    const note = el('indexDetailChartNote');
    destroyIndexChart();
    if (wrap) wrap.style.display = 'none';
    if (note) note.style.display = 'none';
    if (skeleton) skeleton.style.display = '';
  }

  function renderChart(payload) {
    const wrap = el('indexDetailChartWrap');
    const skeleton = el('indexDetailChartSkeleton');
    const note = el('indexDetailChartNote');
    const candles = payload.candles || [];

    if (!candles.length) {
      destroyIndexChart();
      if (wrap) wrap.style.display = 'none';
      if (skeleton) skeleton.style.display = 'none';
      if (note) {
        note.textContent = '차트 데이터가 부족합니다.';
        note.style.display = '';
      }
      return;
    }

    renderIndexChart(
      candles,
      payload.ma5 || [],
      payload.ma20 || [],
      payload.intraday,
      payload.range || activeRange
    );
  }

  function railSparklineColor(dir) {
    if (dir === 'up') return '#ef5350';
    if (dir === 'down') return '#42a5f5';
    return '#9ca3af';
  }

  let railSparkGradSeq = 0;

  function buildRailSparklineSvg(points, direction) {
    const values = Array.isArray(points)
      ? points.map((p) => Number(p.value)).filter(Number.isFinite)
      : [];
    if (values.length < 2) return railSparklinePlaceholder(direction);
    const w = 56;
    const h = 32;
    const pad = 3;
    const min = Math.min.apply(null, values);
    const max = Math.max.apply(null, values);
    const span = Math.max(1e-9, max - min);
    const color = railSparklineColor(direction);
    const coords = values.map((v, i) => ({
      x: pad + ((w - pad * 2) * i) / Math.max(1, values.length - 1),
      y: pad + ((h - pad * 2) * (max - v)) / span,
    }));
    const path = coords
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
    const last = coords[coords.length - 1];
    const first = coords[0];
    const baseY = (h - pad).toFixed(1);
    const area = `${path} L ${last.x.toFixed(1)} ${baseY} L ${first.x.toFixed(1)} ${baseY} Z`;
    railSparkGradSeq += 1;
    const gradId = `railSparkGrad${railSparkGradSeq}`;
    return (
      `<svg viewBox="0 0 ${w} ${h}" class="index-detail-overlay__rail-spark-svg" aria-hidden="true" preserveAspectRatio="none">` +
      `<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="${color}" stop-opacity="0.32"></stop>` +
      `<stop offset="100%" stop-color="${color}" stop-opacity="0"></stop></linearGradient></defs>` +
      `<path d="${area}" fill="url(#${gradId})"></path>` +
      `<path d="${path}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path>` +
      '</svg>'
    );
  }

  function railSparklinePlaceholder(direction) {
    const color = railSparklineColor(direction);
    return (
      '<svg viewBox="0 0 56 32" class="index-detail-overlay__rail-spark-svg index-detail-overlay__rail-spark-svg--placeholder" aria-hidden="true">' +
      `<line x1="6" y1="16" x2="50" y2="16" stroke="${color}" stroke-width="1.5" stroke-dasharray="3 3" stroke-opacity="0.45"></line>` +
      '</svg>'
    );
  }

  function railSparklineHtml(idx, direction) {
    const svg = buildRailSparklineSvg((idx && idx.points) || [], direction || 'flat');
    return `<span class="index-detail-overlay__rail-spark">${svg}</span>`;
  }

  function renderTabs() {
    const tabs = el('indexDetailTabs');
    if (!tabs) return;
    tabs.innerHTML = RANGES.map((r) => {
      const cls = r.id === activeRange ? ' active' : '';
      return `<button type="button" class="detail-range-btn${cls}" data-range="${r.id}" role="tab" aria-selected="${r.id === activeRange}">${r.label}</button>`;
    }).join('');
    tabs.querySelectorAll('[data-range]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.getAttribute('data-range');
        if (!next || next === activeRange) return;
        activeRange = next;
        renderTabs();
        loadDetail();
      });
    });
  }

  function railItemHtml(idx) {
    const key = String(idx.key || INDEX_KEY_BY_NAME[idx.name] || '').toLowerCase();
    const name = esc(idx.name || key.toUpperCase());
    const activeClass = key === activeKey ? ' is-active' : '';

    const dir = idx.error ? 'flat' : idx.direction || 'flat';
    const spark = railSparklineHtml(idx, dir);

    if (idx.error) {
      return (
        `<button type="button" class="index-detail-overlay__rail-item flat${activeClass}" data-rail-key="${esc(key)}">` +
        spark +
        `<span class="index-detail-overlay__rail-name">${name}</span>` +
        '<span class="index-detail-overlay__rail-value">—</span>' +
        '<span class="index-detail-overlay__rail-change flat">—</span>' +
        '</button>'
      );
    }

    const sign = dir === 'up' ? '+' : dir === 'down' ? '-' : '';
    const val = formatIndexPrice(idx.value);
    const pct = Math.abs(Number(idx.change_pct || 0)).toFixed(2);

    return (
      `<button type="button" class="index-detail-overlay__rail-item ${dir}${activeClass}" data-rail-key="${esc(key)}">` +
      spark +
      `<span class="index-detail-overlay__rail-name">${name}</span>` +
      `<span class="index-detail-overlay__rail-value">${esc(val)}</span>` +
      `<span class="index-detail-overlay__rail-change ${dir}">${sign}${pct}%</span>` +
      '</button>'
    );
  }

  function renderRail() {
    const list = el('indexDetailRailList');
    if (!list) return;
    if (!indicesSnapshot.length) {
      list.innerHTML = '<div class="index-detail-overlay__rail-state">지수 목록 불러오는 중…</div>';
      return;
    }
    const groups = groupIndicesForRail(indicesSnapshot);
    if (!groups.length) {
      list.innerHTML = '<div class="index-detail-overlay__rail-state">표시할 지수가 없습니다.</div>';
      return;
    }
    list.innerHTML = groups
      .map(
        (g) =>
          '<div class="index-detail-overlay__rail-group">' +
          `<div class="index-detail-overlay__rail-group-title">${esc(g.label)}</div>` +
          g.items.map((idx) => railItemHtml(idx)).join('') +
          '</div>'
      )
      .join('');
    list.querySelectorAll('[data-rail-key]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-rail-key');
        if (!key || key === activeKey) return;
        activeKey = key;
        renderRail();
        loadDetail();
      });
    });
  }

  async function loadDetail() {
    const seq = ++loadSeq;
    showChartLoading();

    try {
      const payload = await fetchHistory(activeKey, activeRange);
      if (seq !== loadSeq) return;
      renderHeader(payload);
      renderChart(payload);
      renderStats(payload);
    } catch (e) {
      if (seq !== loadSeq) return;
      destroyIndexChart();
      const note = el('indexDetailChartNote');
      const skeleton = el('indexDetailChartSkeleton');
      if (skeleton) skeleton.style.display = 'none';
      if (note) {
        note.textContent = e.message || '조회 실패';
        note.style.display = '';
      }
    }
  }

  function bindOverlayEvents() {
    const overlay = el('indexDetailOverlay');
    if (!overlay || overlay.dataset.bound === '1') return;
    overlay.dataset.bound = '1';

    el('indexDetailClose')?.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay && !overlay.hidden) close();
    });
  }

  function open(key) {
    const overlay = el('indexDetailOverlay');
    if (!overlay) return;
    activeKey = String(key || 'kospi').toLowerCase();
    activeRange = '1d';
    bindOverlayEvents();
    renderTabs();
    renderRail();
    overlay.hidden = false;
    document.body.classList.add('index-detail-overlay-open');
    loadSeq++;

    Promise.all([fetchIndices(), loadDetail()])
      .then(([list]) => {
        indicesSnapshot = list;
        renderRail();
      })
      .catch(() => {
        indicesSnapshot = [];
        renderRail();
      });
  }

  function close() {
    const overlay = el('indexDetailOverlay');
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove('index-detail-overlay-open');
    destroyIndexChart();
    loadSeq++;
  }

  window.IndexDetailOverlay = { open, close };

  document.addEventListener('DOMContentLoaded', bindOverlayEvents);
})();
