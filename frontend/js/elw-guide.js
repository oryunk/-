/**
 * ELW beginner guide — 3 tabs for market-products.html?topic=elw
 */
(function (global) {
  var ACCENT = '#2f8f5f';

  var TABS = [
    { id: 'payoff', label: '콜·풋과 손익' },
    { id: 'use', label: '특징·활용' },
    { id: 'risk', label: '지표·주의' },
  ];

  var LEGACY_TAB_MAP = {
    guide: 'payoff',
    case: 'use',
    system: 'risk',
  };

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function payoffCallSvg() {
    return (
      '<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<rect width="320" height="200" fill="#fff" rx="8"/>' +
      '<line x1="48" y1="155" x2="292" y2="155" stroke="#ccc" stroke-width="1"/>' +
      '<line x1="48" y1="35" x2="48" y2="155" stroke="#ccc" stroke-width="1"/>' +
      '<text x="170" y="178" text-anchor="middle" font-size="11" fill="#666">기초자산 가격</text>' +
      '<text x="22" y="95" text-anchor="middle" font-size="11" fill="#666" transform="rotate(-90 22 95)">손익</text>' +
      '<line x1="0" y1="155" x2="320" y2="155" stroke="#ddd" stroke-width="0.5"/>' +
      '<line x1="125" y1="35" x2="125" y2="155" stroke="#bbb" stroke-dasharray="4 3"/>' +
      '<text x="125" y="28" text-anchor="middle" font-size="10" fill="#888">행사가</text>' +
      '<line x1="195" y1="35" x2="195" y2="155" stroke="#bbb" stroke-dasharray="4 3"/>' +
      '<text x="195" y="28" text-anchor="middle" font-size="10" fill="#888">손익분기점</text>' +
      '<polyline points="48,125 125,125 285,40" fill="none" stroke="' +
      ACCENT +
      '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>'
    );
  }

  function payoffPutSvg() {
    return (
      '<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<rect width="320" height="200" fill="#fff" rx="8"/>' +
      '<line x1="48" y1="155" x2="292" y2="155" stroke="#ccc" stroke-width="1"/>' +
      '<line x1="48" y1="35" x2="48" y2="155" stroke="#ccc" stroke-width="1"/>' +
      '<text x="170" y="178" text-anchor="middle" font-size="11" fill="#666">기초자산 가격</text>' +
      '<text x="22" y="95" text-anchor="middle" font-size="11" fill="#666" transform="rotate(-90 22 95)">손익</text>' +
      '<line x1="0" y1="155" x2="320" y2="155" stroke="#ddd" stroke-width="0.5"/>' +
      '<line x1="185" y1="35" x2="185" y2="155" stroke="#bbb" stroke-dasharray="4 3"/>' +
      '<text x="185" y="28" text-anchor="middle" font-size="10" fill="#888">행사가</text>' +
      '<line x1="115" y1="35" x2="115" y2="155" stroke="#bbb" stroke-dasharray="4 3"/>' +
      '<text x="115" y="28" text-anchor="middle" font-size="10" fill="#888">손익분기점</text>' +
      '<polyline points="48,40 115,125 185,125 285,125" fill="none" stroke="' +
      ACCENT +
      '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>'
    );
  }

  function footerLinksHtml() {
    var links = [
      { label: 'ELW 용어 보기', href: 'glossary.html?term=ELW' },
      { label: '만기 용어 보기', href: 'glossary.html?term=%EB%A7%8C%EA%B8%B0' },
      { label: '시간가치 보기', href: 'glossary.html?term=%EC%8B%9C%EA%B0%84%EA%B0%80%EC%B9%98' },
    ];
    return (
      '<div class="elw-footer-links">' +
      links
        .map(function (l) {
          return (
            '<a class="elw-footer-link" href="' +
            escapeHtml(l.href) +
            '">' +
            escapeHtml(l.label) +
            '</a>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function dirChipsHtml() {
    return (
      '<div class="elw-dir-chips" aria-label="ELW 방향">' +
      '<span class="elw-dir-chip">상승 예상 → 콜 ELW</span>' +
      '<span class="elw-dir-chip">하락 예상 → 풋 ELW</span>' +
      '</div>'
    );
  }

  function panelPayoffHtml() {
    return (
      '<div class="elw-type-grid">' +
      '<article class="elw-type-card">' +
      '<span class="elw-type-badge">CALL ELW</span>' +
      '<h3 class="elw-type-title">콜 ELW</h3>' +
      '<p class="elw-type-text">기초자산이 <strong>오를 것</strong> 같을 때 살펴봅니다.</p>' +
      '<div class="elw-type-example">삼성전자 상승 예상 → CALL 매수<br>상승할수록 수익이 커질 수 있습니다.</div>' +
      '</article>' +
      '<article class="elw-type-card is-put">' +
      '<span class="elw-type-badge">PUT ELW</span>' +
      '<h3 class="elw-type-title">풋 ELW</h3>' +
      '<p class="elw-type-text">기초자산이 <strong>내릴 것</strong> 같을 때 살펴봅니다.</p>' +
      '<div class="elw-type-example">삼성전자 하락 예상 → PUT 매수<br>하락할수록 수익이 커질 수 있습니다.</div>' +
      '</article></div>' +
      '<div class="elw-payoff-block">' +
      '<h3 class="elw-payoff-block-title">ELW 만기 예상 손익</h3>' +
      '<p class="elw-payoff-block-lead">' +
      '만기 시 기초자산 가격에 따라 손익이 정해집니다. 콜과 풋의 손익 구조를 비교해 보세요.' +
      '</p>' +
      '<div class="elw-payoff-grid">' +
      '<div class="elw-payoff-card">' +
      '<div class="elw-payoff-card-head"><span class="elw-payoff-pill">CALL (콜)</span></div>' +
      '<p class="elw-payoff-card-desc">기초자산 가격이 행사가를 초과하면 이익이 발생하는 구조입니다.</p>' +
      '<div class="elw-payoff-svg-wrap">' +
      payoffCallSvg() +
      '</div>' +
      '<div class="elw-payoff-note">' +
      '<p>행사가 이하 → 투자금 손실 가능</p>' +
      '<p>손익분기점 이상 → 수익 발생</p>' +
      '</div></div>' +
      '<div class="elw-payoff-card">' +
      '<div class="elw-payoff-card-head"><span class="elw-payoff-pill">PUT (풋)</span></div>' +
      '<p class="elw-payoff-card-desc">기초자산 가격이 행사가를 하회하면 이익이 발생하는 구조입니다.</p>' +
      '<div class="elw-payoff-svg-wrap">' +
      payoffPutSvg() +
      '</div>' +
      '<div class="elw-payoff-note">' +
      '<p>행사가 이상 → 투자금 손실 가능</p>' +
      '<p>손익분기점 이하 → 수익 발생</p>' +
      '</div></div></div>' +
      '<div class="elw-remember-box">' +
      '<p class="elw-remember-title">기억하세요!</p>' +
      '<p class="elw-remember-text">' +
      'ELW는 만기 시 기초자산의 가격 방향에 따라 손익이 달라집니다. 투자 전에 행사가와 손익분기점을 꼭 확인하세요.' +
      '</p></div></div>'
    );
  }

  function panelUseHtml() {
    return (
      '<h3 class="elw-section-head">ELW의 특징</h3>' +
      '<div class="elw-feature-grid">' +
      '<article class="elw-feature-card">' +
      '<h4 class="elw-feature-card-title">레버리지</h4>' +
      '<p class="elw-feature-card-text">적은 금액으로도 큰 가격 변화를 노릴 수 있습니다.</p>' +
      '</article>' +
      '<article class="elw-feature-card">' +
      '<h4 class="elw-feature-card-title">만기 존재</h4>' +
      '<p class="elw-feature-card-text">주식과 달리 만기가 있으며, 만기 이후에는 거래할 수 없습니다.</p>' +
      '</article>' +
      '<article class="elw-feature-card">' +
      '<h4 class="elw-feature-card-title">원금 전액 손실 가능</h4>' +
      '<p class="elw-feature-card-text">예상 방향이 틀리면 투자금 전부를 잃을 수 있습니다.</p>' +
      '</article></div>' +
      '<h3 class="elw-section-head">언제 보는 상품인가요?</h3>' +
      '<p class="elw-section-lead">단기 방향성이 분명할 때 함께 검토해 볼 수 있는 상품입니다.</p>' +
      '<div class="elw-scenario-grid">' +
      '<article class="elw-scenario-card">' +
      '<p class="elw-scenario-label">사용 예시 1</p>' +
      '<h4 class="elw-scenario-title">삼성전자 8만 원</h4>' +
      '<p class="elw-scenario-quote">「단기간에 9만 원 갈 것 같다」</p>' +
      '<p class="elw-scenario-arrow">↓</p>' +
      '<p class="elw-scenario-result">CALL ELW 검토</p>' +
      '</article>' +
      '<article class="elw-scenario-card">' +
      '<p class="elw-scenario-label">사용 예시 2</p>' +
      '<h4 class="elw-scenario-title">코스피 300</h4>' +
      '<p class="elw-scenario-quote">「이번 주 하락할 것 같다」</p>' +
      '<p class="elw-scenario-arrow">↓</p>' +
      '<p class="elw-scenario-result">PUT ELW 검토</p>' +
      '</article></div>'
    );
  }

  function panelRiskHtml() {
    return (
      '<h3 class="elw-section-head">핵심 투자지표</h3>' +
      '<p class="elw-section-lead">ELW 시세표를 볼 때 초보자가 먼저 확인하면 좋은 항목입니다.</p>' +
      '<div class="elw-indicator-grid">' +
      '<div class="elw-indicator-item">' +
      '<p class="elw-indicator-term">행사가</p>' +
      '<p class="elw-indicator-desc">권리를 행사할 수 있는 기준 가격</p></div>' +
      '<div class="elw-indicator-item">' +
      '<p class="elw-indicator-term">만기일</p>' +
      '<p class="elw-indicator-desc">ELW가 종료되는 날짜</p></div>' +
      '<div class="elw-indicator-item">' +
      '<p class="elw-indicator-term">패리티</p>' +
      '<p class="elw-indicator-desc">현재 가치 수준을 나타내는 지표</p></div>' +
      '<div class="elw-indicator-item">' +
      '<p class="elw-indicator-term">손익분기점</p>' +
      '<p class="elw-indicator-desc">수익과 손실이 갈리는 가격</p></div></div>' +
      '<div class="elw-warning-box">' +
      '<p class="elw-warning-title">ELW 투자 전 확인하세요</p>' +
      '<ul class="elw-warning-list">' +
      '<li>일반 주식보다 변동성이 큽니다.</li>' +
      '<li>만기가 가까워질수록 가치가 빠르게 감소할 수 있습니다.</li>' +
      '<li>투자 원금 전액 손실이 가능합니다.</li>' +
      '</ul></div>' +
      footerLinksHtml()
    );
  }

  function panelHtml(tabId) {
    if (tabId === 'use') return panelUseHtml();
    if (tabId === 'risk') return panelRiskHtml();
    return panelPayoffHtml();
  }

  function normalizeTab(tab) {
    var t = String(tab || 'payoff').toLowerCase();
    if (LEGACY_TAB_MAP[t]) return LEGACY_TAB_MAP[t];
    for (var i = 0; i < TABS.length; i++) {
      if (TABS[i].id === t) return t;
    }
    return 'payoff';
  }

  function setActiveTab(root, tabId, options) {
    options = options || {};
    var active = normalizeTab(tabId);
    root.querySelectorAll('.elw-tab-btn').forEach(function (btn) {
      var on = btn.getAttribute('data-tab') === active;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    root.querySelectorAll('.elw-tab-panel').forEach(function (panel) {
      var on = panel.getAttribute('data-tab') === active;
      panel.classList.toggle('is-active', on);
      panel.hidden = !on;
    });
    if (!options.skipHistory) {
      try {
        var url = new URL(window.location.href);
        url.searchParams.set('topic', 'elw');
        url.searchParams.set('tab', active);
        window.history.replaceState({}, '', url.toString());
      } catch (e) { /* ignore */ }
    }
  }

  function mount(containerId, options) {
    options = options || {};
    var root = document.getElementById(containerId);
    if (!root) return;

    var initialTab = normalizeTab(options.tab);

    var tabBar =
      '<div class="elw-tab-switch" role="tablist" aria-label="ELW 설명 탭">' +
      TABS.map(function (t) {
        var active = t.id === initialTab;
        return (
          '<button type="button" class="elw-tab-btn' +
          (active ? ' is-active' : '') +
          '" role="tab" data-tab="' +
          t.id +
          '" aria-selected="' +
          (active ? 'true' : 'false') +
          '" id="elw-tab-' +
          t.id +
          '">' +
          escapeHtml(t.label) +
          '</button>'
        );
      }).join('') +
      '</div>';

    var panels = TABS.map(function (t) {
      var active = t.id === initialTab;
      return (
        '<div class="elw-tab-panel' +
        (active ? ' is-active' : '') +
        '" role="tabpanel" data-tab="' +
        t.id +
        '" id="elw-panel-' +
        t.id +
        '" aria-labelledby="elw-tab-' +
        t.id +
        '"' +
        (active ? '' : ' hidden') +
        '>' +
        panelHtml(t.id) +
        '</div>'
      );
    }).join('');

    root.innerHTML = dirChipsHtml() + tabBar + panels;

    root.addEventListener('click', function (e) {
      var btn = e.target.closest('.elw-tab-btn');
      if (!btn || !root.contains(btn)) return;
      setActiveTab(root, btn.getAttribute('data-tab'));
    });
  }

  global.ElwGuide = {
    mount: mount,
    normalizeTab: normalizeTab,
  };
})(typeof window !== 'undefined' ? window : this);
