/**
 * ELW · 채권 초보 가이드 공통 탭 UI (market-products.html)
 */
(function (global) {
  var ACCENT = '#2f8f5f';

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function createProductsTabGuide(cfg) {
    var prefix = cfg.prefix;
    var topic = cfg.topic;
    var tabs = cfg.tabs;
    var defaultTab = cfg.defaultTab;
    var legacyTabMap = cfg.legacyTabMap || {};
    var tabBtnClass = prefix + '-tab-btn';
    var tabPanelClass = prefix + '-tab-panel';
    var tabSwitchClass = prefix + '-tab-switch';

    function normalizeTab(tab) {
      var t = String(tab || defaultTab).toLowerCase();
      if (legacyTabMap[t]) return legacyTabMap[t];
      for (var i = 0; i < tabs.length; i++) {
        if (tabs[i].id === t) return t;
      }
      return defaultTab;
    }

    function setActiveTab(root, tabId, options) {
      options = options || {};
      var active = normalizeTab(tabId);
      root.querySelectorAll('.' + tabBtnClass).forEach(function (btn) {
        var on = btn.getAttribute('data-tab') === active;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      root.querySelectorAll('.' + tabPanelClass).forEach(function (panel) {
        var on = panel.getAttribute('data-tab') === active;
        panel.classList.toggle('is-active', on);
        panel.hidden = !on;
      });
      if (!options.skipHistory) {
        try {
          var url = new URL(window.location.href);
          url.searchParams.set('topic', topic);
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
        '<div class="' +
        tabSwitchClass +
        '" role="tablist" aria-label="' +
        escapeHtml(cfg.tablistAriaLabel) +
        '">' +
        tabs
          .map(function (t) {
            var active = t.id === initialTab;
            return (
              '<button type="button" class="' +
              tabBtnClass +
              (active ? ' is-active' : '') +
              '" role="tab" data-tab="' +
              t.id +
              '" aria-selected="' +
              (active ? 'true' : 'false') +
              '" id="' +
              prefix +
              '-tab-' +
              t.id +
              '">' +
              escapeHtml(t.label) +
              '</button>'
            );
          })
          .join('') +
        '</div>';

      var panels = tabs
        .map(function (t) {
          var active = t.id === initialTab;
          return (
            '<div class="' +
            tabPanelClass +
            (active ? ' is-active' : '') +
            '" role="tabpanel" data-tab="' +
            t.id +
            '" id="' +
            prefix +
            '-panel-' +
            t.id +
            '" aria-labelledby="' +
            prefix +
            '-tab-' +
            t.id +
            '"' +
            (active ? '' : ' hidden') +
            '>' +
            cfg.panelHtml(t.id) +
            '</div>'
          );
        })
        .join('');

      root.innerHTML = cfg.dirChipsHtml() + tabBar + panels;

      root.addEventListener('click', function (e) {
        var btn = e.target.closest('.' + tabBtnClass);
        if (!btn || !root.contains(btn)) return;
        setActiveTab(root, btn.getAttribute('data-tab'));
      });
    }

    return {
      mount: mount,
      normalizeTab: normalizeTab,
      setActiveTab: setActiveTab,
    };
  }

  /* —— ELW —— */
  function elwPayoffCallSvg() {
    return (
      '<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<rect width="320" height="200" fill="#fff" rx="8"/>' +
      '<line x1="48" y1="155" x2="292" y2="155" stroke="#ccc" stroke-width="1"/>' +
      '<line x1="48" y1="35" x2="48" y2="155" stroke="#ccc" stroke-width="1"/>' +
      '<text x="170" y="178" text-anchor="middle" font-size="11" fill="#666">기초자산 가격</text>' +
      '<text x="22" y="95" text-anchor="middle" font-size="11" fill="#666" transform="rotate(-90 22 95)">손익</text>' +
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

  function elwPayoffPutSvg() {
    return (
      '<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<rect width="320" height="200" fill="#fff" rx="8"/>' +
      '<line x1="48" y1="155" x2="292" y2="155" stroke="#ccc" stroke-width="1"/>' +
      '<line x1="48" y1="35" x2="48" y2="155" stroke="#ccc" stroke-width="1"/>' +
      '<text x="170" y="178" text-anchor="middle" font-size="11" fill="#666">기초자산 가격</text>' +
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

  function elwFooterLinksHtml() {
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

  function elwPanelHtml(tabId) {
    if (tabId === 'use') {
      return (
        '<h3 class="elw-section-head">ELW의 특징</h3>' +
        '<div class="elw-feature-grid">' +
        '<article class="elw-feature-card"><h4 class="elw-feature-card-title">레버리지</h4><p class="elw-feature-card-text">적은 금액으로도 큰 가격 변화를 노릴 수 있습니다.</p></article>' +
        '<article class="elw-feature-card"><h4 class="elw-feature-card-title">만기 존재</h4><p class="elw-feature-card-text">주식과 달리 만기가 있으며, 만기 이후에는 거래할 수 없습니다.</p></article>' +
        '<article class="elw-feature-card"><h4 class="elw-feature-card-title">원금 전액 손실 가능</h4><p class="elw-feature-card-text">예상 방향이 틀리면 투자금 전부를 잃을 수 있습니다.</p></article></div>' +
        '<h3 class="elw-section-head">언제 보는 상품인가요?</h3>' +
        '<p class="elw-section-lead">단기 방향성이 분명할 때 함께 검토해 볼 수 있는 상품입니다.</p>' +
        '<div class="elw-scenario-grid">' +
        '<article class="elw-scenario-card"><p class="elw-scenario-label">사용 예시 1</p><h4 class="elw-scenario-title">삼성전자 8만 원</h4><p class="elw-scenario-quote">「단기간에 9만 원 갈 것 같다」</p><p class="elw-scenario-arrow">↓</p><p class="elw-scenario-result">CALL ELW 검토</p></article>' +
        '<article class="elw-scenario-card"><p class="elw-scenario-label">사용 예시 2</p><h4 class="elw-scenario-title">코스피 300</h4><p class="elw-scenario-quote">「이번 주 하락할 것 같다」</p><p class="elw-scenario-arrow">↓</p><p class="elw-scenario-result">PUT ELW 검토</p></article></div>'
      );
    }
    if (tabId === 'risk') {
      return (
        '<h3 class="elw-section-head">핵심 투자지표</h3>' +
        '<p class="elw-section-lead">ELW 시세표를 볼 때 초보자가 먼저 확인하면 좋은 항목입니다.</p>' +
        '<div class="elw-indicator-grid">' +
        '<div class="elw-indicator-item"><p class="elw-indicator-term">행사가</p><p class="elw-indicator-desc">권리를 행사할 수 있는 기준 가격</p></div>' +
        '<div class="elw-indicator-item"><p class="elw-indicator-term">만기일</p><p class="elw-indicator-desc">ELW가 종료되는 날짜</p></div>' +
        '<div class="elw-indicator-item"><p class="elw-indicator-term">패리티</p><p class="elw-indicator-desc">현재 가치 수준을 나타내는 지표</p></div>' +
        '<div class="elw-indicator-item"><p class="elw-indicator-term">손익분기점</p><p class="elw-indicator-desc">수익과 손실이 갈리는 가격</p></div></div>' +
        '<div class="elw-warning-box"><p class="elw-warning-title">ELW 투자 전 확인하세요</p><ul class="elw-warning-list">' +
        '<li>일반 주식보다 변동성이 큽니다.</li><li>만기가 가까워질수록 가치가 빠르게 감소할 수 있습니다.</li><li>투자 원금 전액 손실이 가능합니다.</li></ul></div>' +
        elwFooterLinksHtml()
      );
    }
    return (
      '<div class="elw-type-grid">' +
      '<article class="elw-type-card"><span class="elw-type-badge">CALL ELW</span><h3 class="elw-type-title">콜 ELW</h3><p class="elw-type-text">기초자산이 <strong>오를 것</strong> 같을 때 살펴봅니다.</p><div class="elw-type-example">삼성전자 상승 예상 → CALL 매수<br>상승할수록 수익이 커질 수 있습니다.</div></article>' +
      '<article class="elw-type-card is-put"><span class="elw-type-badge">PUT ELW</span><h3 class="elw-type-title">풋 ELW</h3><p class="elw-type-text">기초자산이 <strong>내릴 것</strong> 같을 때 살펴봅니다.</p><div class="elw-type-example">삼성전자 하락 예상 → PUT 매수<br>하락할수록 수익이 커질 수 있습니다.</div></article></div>' +
      '<div class="elw-payoff-block"><h3 class="elw-payoff-block-title">ELW 만기 예상 손익</h3><p class="elw-payoff-block-lead">만기 시 기초자산 가격에 따라 손익이 정해집니다. 콜과 풋의 손익 구조를 비교해 보세요.</p>' +
      '<div class="elw-payoff-grid"><div class="elw-payoff-card"><div class="elw-payoff-card-head"><span class="elw-payoff-pill">CALL (콜)</span></div><p class="elw-payoff-card-desc">기초자산 가격이 행사가를 초과하면 이익이 발생하는 구조입니다.</p><div class="elw-payoff-svg-wrap">' +
      elwPayoffCallSvg() +
      '</div><div class="elw-payoff-note"><p>행사가 이하 → 투자금 손실 가능</p><p>손익분기점 이상 → 수익 발생</p></div></div>' +
      '<div class="elw-payoff-card"><div class="elw-payoff-card-head"><span class="elw-payoff-pill">PUT (풋)</span></div><p class="elw-payoff-card-desc">기초자산 가격이 행사가를 하회하면 이익이 발생하는 구조입니다.</p><div class="elw-payoff-svg-wrap">' +
      elwPayoffPutSvg() +
      '</div><div class="elw-payoff-note"><p>행사가 이상 → 투자금 손실 가능</p><p>손익분기점 이하 → 수익 발생</p></div></div></div>' +
      '<div class="elw-remember-box"><p class="elw-remember-title">기억하세요!</p><p class="elw-remember-text">ELW는 만기 시 기초자산의 가격 방향에 따라 손익이 달라집니다. 투자 전에 행사가와 손익분기점을 꼭 확인하세요.</p></div></div>'
    );
  }

  /* —— Bonds —— */
  function bondsMoneyFlowSvg() {
    return (
      '<svg viewBox="0 0 280 360" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="bonds-flow-svg">' +
      '<rect width="280" height="360" fill="#fafdfb" rx="12"/>' +
      '<circle cx="140" cy="42" r="22" fill="rgba(47,143,95,0.12)" stroke="' +
      ACCENT +
      '" stroke-width="1.5"/>' +
      '<text x="140" y="47" text-anchor="middle" font-size="11" font-weight="700" fill="#1a2e24">투자자</text>' +
      '<line x1="140" y1="64" x2="140" y2="88" stroke="' +
      ACCENT +
      '" stroke-width="2"/><polygon points="140,88 134,78 146,78" fill="' +
      ACCENT +
      '"/>' +
      '<rect x="70" y="92" width="140" height="28" rx="8" fill="#fff" stroke="rgba(47,143,95,0.2)"/>' +
      '<text x="140" y="110" text-anchor="middle" font-size="11" fill="#416a54">100만원 투자</text>' +
      '<rect x="55" y="152" width="170" height="36" rx="8" fill="rgba(47,143,95,0.08)" stroke="' +
      ACCENT +
      '" stroke-width="1.5"/>' +
      '<text x="140" y="174" text-anchor="middle" font-size="11" font-weight="700" fill="#1a2e24">정부 또는 기업</text>' +
      '<rect x="62" y="320" width="156" height="32" rx="8" fill="rgba(47,143,95,0.12)" stroke="' +
      ACCENT +
      '" stroke-width="1.5"/>' +
      '<text x="140" y="340" text-anchor="middle" font-size="11" font-weight="700" fill="' +
      ACCENT +
      '">만기 · 원금 100만원 반환</text></svg>'
    );
  }

  function bondsFooterLinksHtml() {
    var links = [
      { label: '채권 용어 보기', href: 'glossary.html?term=%EC%B1%84%EA%B6%8C' },
      { label: 'YTM 보기', href: 'glossary.html?term=YTM' },
      { label: '듀레이션 보기', href: 'glossary.html?term=%EB%93%80%EB%A0%88%EC%9D%B4%EC%85%98' },
    ];
    return (
      '<div class="bonds-footer-links">' +
      links
        .map(function (l) {
          return (
            '<a class="bonds-footer-link" href="' +
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

  function bondsPanelHtml(tabId) {
    if (tabId === 'types') {
      return (
        '<h3 class="bonds-section-head">채권 종류</h3>' +
        '<p class="bonds-section-lead">발행 주체에 따라 안정성과 수익률 성격이 달라집니다.</p>' +
        '<div class="bonds-type-grid">' +
        '<article class="bonds-type-card"><span class="bonds-type-badge">국채</span><h4 class="bonds-type-title">정부 발행</h4><p class="bonds-type-text">안정성이 상대적으로 높습니다.</p></article>' +
        '<article class="bonds-type-card"><span class="bonds-type-badge">금융채</span><h4 class="bonds-type-title">은행 발행</h4><p class="bonds-type-text">국채와 회사채 중간 수준입니다.</p></article>' +
        '<article class="bonds-type-card"><span class="bonds-type-badge">회사채</span><h4 class="bonds-type-title">기업 발행</h4><p class="bonds-type-text">수익률은 높을 수 있으나 위험도도 증가합니다.</p></article></div>' +
        '<details class="bonds-more-types"><summary>지방채·특수채 더보기</summary>' +
        '<p><strong>지방채</strong> — 지방자치단체가 발행하는 채권입니다.</p>' +
        '<p><strong>특수채</strong> — 특정 목적을 위해 발행하는 채권입니다. 초보 단계에서는 우선순위가 낮습니다.</p></details>' +
        '<h3 class="bonds-section-head">채권 가격은 왜 움직이나요?</h3>' +
        '<p class="bonds-section-lead">시장 금리와 채권 가격은 반대 방향으로 움직이는 경우가 많습니다.</p>' +
        '<div class="bonds-rate-grid">' +
        '<article class="bonds-rate-card is-down"><h4 class="bonds-rate-title">금리 상승</h4><p class="bonds-rate-line">시장 금리 <strong>↑</strong></p><p class="bonds-rate-line">기존 채권 매력 <strong>↓</strong></p><p class="bonds-rate-line">채권 가격 <strong>↓</strong></p></article>' +
        '<article class="bonds-rate-card is-up"><h4 class="bonds-rate-title">금리 하락</h4><p class="bonds-rate-line">시장 금리 <strong>↓</strong></p><p class="bonds-rate-line">기존 채권 매력 <strong>↑</strong></p><p class="bonds-rate-line">채권 가격 <strong>↑</strong></p></article></div>' +
        '<h3 class="bonds-section-head">위험도 한눈에</h3>' +
        '<div class="bonds-risk-gauge">' +
        '<div class="bonds-risk-row"><span class="bonds-risk-label">국채</span><div class="bonds-risk-bar"><span class="bonds-risk-fill is-low" style="width:25%"></span></div><span class="bonds-risk-tag is-green">안정성 높음</span></div>' +
        '<div class="bonds-risk-row"><span class="bonds-risk-label">금융채</span><div class="bonds-risk-bar"><span class="bonds-risk-fill is-mid" style="width:55%"></span></div><span class="bonds-risk-tag is-yellow">중간</span></div>' +
        '<div class="bonds-risk-row"><span class="bonds-risk-label">회사채</span><div class="bonds-risk-bar"><span class="bonds-risk-fill is-high" style="width:85%"></span></div><span class="bonds-risk-tag is-red">상대적 위험</span></div></div>'
      );
    }
    if (tabId === 'risk') {
      return (
        '<h3 class="bonds-section-head">핵심 용어</h3>' +
        '<p class="bonds-section-lead">채권 시세표를 볼 때 초보자가 먼저 확인하면 좋은 항목입니다.</p>' +
        '<div class="bonds-indicator-grid">' +
        '<div class="bonds-indicator-item"><p class="bonds-indicator-term">만기일</p><p class="bonds-indicator-desc">원금을 돌려받는 날짜</p></div>' +
        '<div class="bonds-indicator-item"><p class="bonds-indicator-term">표면금리</p><p class="bonds-indicator-desc">채권에 적힌 약속 이자율</p></div>' +
        '<div class="bonds-indicator-item"><p class="bonds-indicator-term">수익률</p><p class="bonds-indicator-desc">현재 가격 기준 실제 기대 수익</p></div>' +
        '<div class="bonds-indicator-item"><p class="bonds-indicator-term">신용등급</p><p class="bonds-indicator-desc">발행자의 상환 능력을 평가한 등급</p></div></div>' +
        '<div class="bonds-rating-scale"><p class="bonds-rating-title">신용등급 예시 (높을수록 안정적)</p>' +
        '<div class="bonds-rating-track"><span class="bonds-rating-item is-best">AAA</span><span class="bonds-rating-arrow">→</span><span class="bonds-rating-item">AA</span><span class="bonds-rating-arrow">→</span><span class="bonds-rating-item">A</span><span class="bonds-rating-arrow">→</span><span class="bonds-rating-item is-low">BBB</span></div></div>' +
        '<div class="bonds-warning-box"><p class="bonds-warning-title">채권 투자 전 확인하세요</p><ul class="bonds-warning-list">' +
        '<li>금리가 오르면 채권 가격은 하락할 수 있습니다.</li><li>발행 기업·기관의 부도 위험이 존재합니다.</li><li>만기 전 매도하면 손실이 발생할 수 있습니다.</li></ul></div>' +
        bondsFooterLinksHtml()
      );
    }
    return (
      '<div class="bonds-flow-block">' +
      '<h3 class="bonds-section-head">채권은 어떻게 돈을 버나요?</h3>' +
      '<p class="bonds-section-lead">채권은 돈을 빌려주고, 정해진 기간 동안 이자를 받다가 만기에 원금을 돌려받는 구조입니다.</p>' +
      '<div class="bonds-flow-card"><div class="bonds-flow-svg-wrap">' +
      bondsMoneyFlowSvg() +
      '</div><div class="bonds-flow-steps">' +
      '<div class="bonds-flow-step"><span class="bonds-flow-step-num">1</span><p>투자자가 정부·기업에 돈을 빌려줍니다.</p></div>' +
      '<div class="bonds-flow-step"><span class="bonds-flow-step-num">2</span><p>발행자가 약속한 이자를 정기적으로 지급합니다.</p></div>' +
      '<div class="bonds-flow-step"><span class="bonds-flow-step-num">3</span><p>만기일에 원금을 돌려받습니다.</p></div></div></div>' +
      '<h3 class="bonds-section-head">예금 vs 채권</h3>' +
      '<p class="bonds-section-lead">구조는 비슷하지만, 돈을 맡기는 상대와 거래 방식이 다릅니다.</p>' +
      '<div class="bonds-compare-grid">' +
      '<article class="bonds-compare-card"><span class="bonds-compare-badge">예금</span><h4 class="bonds-compare-title">은행에 돈 맡김</h4><p class="bonds-compare-arrow">↓</p><p class="bonds-compare-text">이자 받음</p><p class="bonds-compare-arrow">↓</p><p class="bonds-compare-text">만기 원금</p></article>' +
      '<article class="bonds-compare-card is-bond"><span class="bonds-compare-badge">채권</span><h4 class="bonds-compare-title">정부·기업에 돈 빌려줌</h4><p class="bonds-compare-arrow">↓</p><p class="bonds-compare-text">이자 받음</p><p class="bonds-compare-arrow">↓</p><p class="bonds-compare-text">만기 원금</p></article></div></div>'
    );
  }

  global.ElwGuide = createProductsTabGuide({
    prefix: 'elw',
    topic: 'elw',
    defaultTab: 'payoff',
    legacyTabMap: { guide: 'payoff', case: 'use', system: 'risk' },
    tablistAriaLabel: 'ELW 설명 탭',
    tabs: [
      { id: 'payoff', label: '콜·풋과 손익' },
      { id: 'use', label: '특징·활용' },
      { id: 'risk', label: '지표·주의' },
    ],
    dirChipsHtml: function () {
      return (
        '<div class="elw-dir-chips" aria-label="ELW 방향">' +
        '<span class="elw-dir-chip">상승 예상 → 콜 ELW</span>' +
        '<span class="elw-dir-chip">하락 예상 → 풋 ELW</span></div>'
      );
    },
    panelHtml: elwPanelHtml,
  });

  global.BondsGuide = createProductsTabGuide({
    prefix: 'bonds',
    topic: 'bonds',
    defaultTab: 'flow',
    tablistAriaLabel: '채권 설명 탭',
    tabs: [
      { id: 'flow', label: '돈 흐름과 예시' },
      { id: 'types', label: '종류·금리' },
      { id: 'risk', label: '용어·주의' },
    ],
    dirChipsHtml: function () {
      return (
        '<div class="bonds-dir-chips" aria-label="채권 특징">' +
        '<span class="bonds-dir-chip">이자 수익</span>' +
        '<span class="bonds-dir-chip">만기 존재</span>' +
        '<span class="bonds-dir-chip">상대적으로 안정적</span></div>'
      );
    },
    panelHtml: bondsPanelHtml,
  });
})(typeof window !== 'undefined' ? window : this);
