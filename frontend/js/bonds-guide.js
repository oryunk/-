/**
 * Bonds beginner guide — 3 tabs for market-products.html?topic=bonds
 */
(function (global) {
  var ACCENT = '#2f8f5f';

  var TABS = [
    { id: 'flow', label: '돈 흐름과 예시' },
    { id: 'types', label: '종류·금리' },
    { id: 'risk', label: '용어·주의' },
  ];

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function moneyFlowSvg() {
    return (
      '<svg viewBox="0 0 280 360" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="bonds-flow-svg">' +
      '<rect width="280" height="360" fill="#fafdfb" rx="12"/>' +
      '<circle cx="140" cy="42" r="22" fill="rgba(47,143,95,0.12)" stroke="' +
      ACCENT +
      '" stroke-width="1.5"/>' +
      '<text x="140" y="47" text-anchor="middle" font-size="11" font-weight="700" fill="#1a2e24">투자자</text>' +
      '<line x1="140" y1="64" x2="140" y2="88" stroke="' +
      ACCENT +
      '" stroke-width="2"/>' +
      '<polygon points="140,88 134,78 146,78" fill="' +
      ACCENT +
      '"/>' +
      '<rect x="70" y="92" width="140" height="28" rx="8" fill="#fff" stroke="rgba(47,143,95,0.2)"/>' +
      '<text x="140" y="110" text-anchor="middle" font-size="11" fill="#416a54">100만원 투자</text>' +
      '<line x1="140" y1="120" x2="140" y2="148" stroke="' +
      ACCENT +
      '" stroke-width="2"/>' +
      '<polygon points="140,148 134,138 146,138" fill="' +
      ACCENT +
      '"/>' +
      '<rect x="55" y="152" width="170" height="36" rx="8" fill="rgba(47,143,95,0.08)" stroke="' +
      ACCENT +
      '" stroke-width="1.5"/>' +
      '<text x="140" y="174" text-anchor="middle" font-size="11" font-weight="700" fill="#1a2e24">정부 또는 기업</text>' +
      '<line x1="140" y1="188" x2="140" y2="208" stroke="#bbb" stroke-width="1.5"/>' +
      '<rect x="88" y="212" width="104" height="24" rx="6" fill="#fff" stroke="rgba(47,143,95,0.18)"/>' +
      '<text x="140" y="228" text-anchor="middle" font-size="10" fill="#416a54">이자 지급</text>' +
      '<rect x="88" y="242" width="104" height="24" rx="6" fill="#fff" stroke="rgba(47,143,95,0.18)"/>' +
      '<text x="140" y="258" text-anchor="middle" font-size="10" fill="#416a54">이자 지급</text>' +
      '<rect x="88" y="272" width="104" height="24" rx="6" fill="#fff" stroke="rgba(47,143,95,0.18)"/>' +
      '<text x="140" y="288" text-anchor="middle" font-size="10" fill="#416a54">이자 지급</text>' +
      '<line x1="140" y1="296" x2="140" y2="316" stroke="' +
      ACCENT +
      '" stroke-width="2"/>' +
      '<polygon points="140,316 134,306 146,306" fill="' +
      ACCENT +
      '"/>' +
      '<rect x="62" y="320" width="156" height="32" rx="8" fill="rgba(47,143,95,0.12)" stroke="' +
      ACCENT +
      '" stroke-width="1.5"/>' +
      '<text x="140" y="340" text-anchor="middle" font-size="11" font-weight="700" fill="' +
      ACCENT +
      '">만기 · 원금 100만원 반환</text>' +
      '</svg>'
    );
  }

  function footerLinksHtml() {
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

  function dirChipsHtml() {
    return (
      '<div class="bonds-dir-chips" aria-label="채권 특징">' +
      '<span class="bonds-dir-chip">이자 수익</span>' +
      '<span class="bonds-dir-chip">만기 존재</span>' +
      '<span class="bonds-dir-chip">상대적으로 안정적</span>' +
      '</div>'
    );
  }

  function panelFlowHtml() {
    return (
      '<div class="bonds-flow-block">' +
      '<h3 class="bonds-section-head">채권은 어떻게 돈을 버나요?</h3>' +
      '<p class="bonds-section-lead">' +
      '채권은 돈을 빌려주고, 정해진 기간 동안 이자를 받다가 만기에 원금을 돌려받는 구조입니다.' +
      '</p>' +
      '<div class="bonds-flow-card">' +
      '<div class="bonds-flow-svg-wrap">' +
      moneyFlowSvg() +
      '</div>' +
      '<div class="bonds-flow-steps">' +
      '<div class="bonds-flow-step"><span class="bonds-flow-step-num">1</span><p>투자자가 정부·기업에 돈을 빌려줍니다.</p></div>' +
      '<div class="bonds-flow-step"><span class="bonds-flow-step-num">2</span><p>발행자가 약속한 이자를 정기적으로 지급합니다.</p></div>' +
      '<div class="bonds-flow-step"><span class="bonds-flow-step-num">3</span><p>만기일에 원금을 돌려받습니다.</p></div>' +
      '</div></div>' +
      '<h3 class="bonds-section-head">예금 vs 채권</h3>' +
      '<p class="bonds-section-lead">구조는 비슷하지만, 돈을 맡기는 상대와 거래 방식이 다릅니다.</p>' +
      '<div class="bonds-compare-grid">' +
      '<article class="bonds-compare-card">' +
      '<span class="bonds-compare-badge">예금</span>' +
      '<h4 class="bonds-compare-title">은행에 돈 맡김</h4>' +
      '<p class="bonds-compare-arrow">↓</p>' +
      '<p class="bonds-compare-text">이자 받음</p>' +
      '<p class="bonds-compare-arrow">↓</p>' +
      '<p class="bonds-compare-text">만기 원금</p>' +
      '</article>' +
      '<article class="bonds-compare-card is-bond">' +
      '<span class="bonds-compare-badge">채권</span>' +
      '<h4 class="bonds-compare-title">정부·기업에 돈 빌려줌</h4>' +
      '<p class="bonds-compare-arrow">↓</p>' +
      '<p class="bonds-compare-text">이자 받음</p>' +
      '<p class="bonds-compare-arrow">↓</p>' +
      '<p class="bonds-compare-text">만기 원금</p>' +
      '</article></div>' +
      '<h3 class="bonds-section-head">예시로 이해하기</h3>' +
      '<article class="bonds-example-card">' +
      '<span class="bonds-example-badge">국채 예시</span>' +
      '<div class="bonds-example-meta">' +
      '<div class="bonds-example-row"><span>투자금</span><strong>100만원</strong></div>' +
      '<div class="bonds-example-row"><span>금리</span><strong>연 3%</strong></div>' +
      '<div class="bonds-example-row"><span>만기</span><strong>3년</strong></div>' +
      '</div>' +
      '<p class="bonds-compare-arrow">↓</p>' +
      '<p class="bonds-example-highlight">매년 <strong>3만원</strong> 이자</p>' +
      '<p class="bonds-compare-arrow">↓</p>' +
      '<p class="bonds-example-highlight">3년 후 원금 <strong>100만원</strong> 반환</p>' +
      '</article></div>'
    );
  }

  function panelTypesHtml() {
    return (
      '<h3 class="bonds-section-head">채권 종류</h3>' +
      '<p class="bonds-section-lead">발행 주체에 따라 안정성과 수익률 성격이 달라집니다.</p>' +
      '<div class="bonds-type-grid">' +
      '<article class="bonds-type-card">' +
      '<span class="bonds-type-badge">국채</span>' +
      '<h4 class="bonds-type-title">정부 발행</h4>' +
      '<p class="bonds-type-text">안정성이 상대적으로 높습니다.</p>' +
      '</article>' +
      '<article class="bonds-type-card">' +
      '<span class="bonds-type-badge">금융채</span>' +
      '<h4 class="bonds-type-title">은행 발행</h4>' +
      '<p class="bonds-type-text">국채와 회사채 중간 수준입니다.</p>' +
      '</article>' +
      '<article class="bonds-type-card">' +
      '<span class="bonds-type-badge">회사채</span>' +
      '<h4 class="bonds-type-title">기업 발행</h4>' +
      '<p class="bonds-type-text">수익률은 높을 수 있으나 위험도도 증가합니다.</p>' +
      '</article></div>' +
      '<details class="bonds-more-types">' +
      '<summary>지방채·특수채 더보기</summary>' +
      '<p><strong>지방채</strong> — 지방자치단체가 발행하는 채권입니다.</p>' +
      '<p><strong>특수채</strong> — 특정 목적을 위해 발행하는 채권입니다. 초보 단계에서는 우선순위가 낮습니다.</p>' +
      '</details>' +
      '<h3 class="bonds-section-head">채권 가격은 왜 움직이나요?</h3>' +
      '<p class="bonds-section-lead">시장 금리와 채권 가격은 반대 방향으로 움직이는 경우가 많습니다.</p>' +
      '<div class="bonds-rate-grid">' +
      '<article class="bonds-rate-card is-down">' +
      '<h4 class="bonds-rate-title">금리 상승</h4>' +
      '<p class="bonds-rate-line">시장 금리 <strong>↑</strong></p>' +
      '<p class="bonds-rate-line">기존 채권 매력 <strong>↓</strong></p>' +
      '<p class="bonds-rate-line">채권 가격 <strong>↓</strong></p>' +
      '<div class="bonds-rate-example">' +
      '연 3% 채권 보유 중 새 채권이 5%로 발행 → 기존 채권 인기 감소 → 가격 하락' +
      '</div></article>' +
      '<article class="bonds-rate-card is-up">' +
      '<h4 class="bonds-rate-title">금리 하락</h4>' +
      '<p class="bonds-rate-line">시장 금리 <strong>↓</strong></p>' +
      '<p class="bonds-rate-line">기존 채권 매력 <strong>↑</strong></p>' +
      '<p class="bonds-rate-line">채권 가격 <strong>↑</strong></p>' +
      '<div class="bonds-rate-example">' +
      '기존 채권의 약속 이자가 상대적으로 유리해지면 수요가 늘어 가격이 오를 수 있습니다.' +
      '</div></article></div>' +
      '<h3 class="bonds-section-head">위험도 한눈에</h3>' +
      '<div class="bonds-risk-gauge">' +
      '<div class="bonds-risk-row">' +
      '<span class="bonds-risk-label">국채</span>' +
      '<div class="bonds-risk-bar"><span class="bonds-risk-fill is-low" style="width:25%"></span></div>' +
      '<span class="bonds-risk-tag is-green">안정성 높음</span></div>' +
      '<div class="bonds-risk-row">' +
      '<span class="bonds-risk-label">금융채</span>' +
      '<div class="bonds-risk-bar"><span class="bonds-risk-fill is-mid" style="width:55%"></span></div>' +
      '<span class="bonds-risk-tag is-yellow">중간</span></div>' +
      '<div class="bonds-risk-row">' +
      '<span class="bonds-risk-label">회사채</span>' +
      '<div class="bonds-risk-bar"><span class="bonds-risk-fill is-high" style="width:85%"></span></div>' +
      '<span class="bonds-risk-tag is-red">상대적 위험</span></div>' +
      '</div>'
    );
  }

  function panelRiskHtml() {
    return (
      '<h3 class="bonds-section-head">핵심 용어</h3>' +
      '<p class="bonds-section-lead">채권 시세표를 볼 때 초보자가 먼저 확인하면 좋은 항목입니다.</p>' +
      '<div class="bonds-indicator-grid">' +
      '<div class="bonds-indicator-item">' +
      '<p class="bonds-indicator-term">만기일</p>' +
      '<p class="bonds-indicator-desc">원금을 돌려받는 날짜</p></div>' +
      '<div class="bonds-indicator-item">' +
      '<p class="bonds-indicator-term">표면금리</p>' +
      '<p class="bonds-indicator-desc">채권에 적힌 약속 이자율</p></div>' +
      '<div class="bonds-indicator-item">' +
      '<p class="bonds-indicator-term">수익률</p>' +
      '<p class="bonds-indicator-desc">현재 가격 기준 실제 기대 수익</p></div>' +
      '<div class="bonds-indicator-item">' +
      '<p class="bonds-indicator-term">신용등급</p>' +
      '<p class="bonds-indicator-desc">발행자의 상환 능력을 평가한 등급</p></div></div>' +
      '<div class="bonds-rating-scale">' +
      '<p class="bonds-rating-title">신용등급 예시 (높을수록 안정적)</p>' +
      '<div class="bonds-rating-track">' +
      '<span class="bonds-rating-item is-best">AAA</span>' +
      '<span class="bonds-rating-arrow">→</span>' +
      '<span class="bonds-rating-item">AA</span>' +
      '<span class="bonds-rating-arrow">→</span>' +
      '<span class="bonds-rating-item">A</span>' +
      '<span class="bonds-rating-arrow">→</span>' +
      '<span class="bonds-rating-item is-low">BBB</span>' +
      '</div></div>' +
      '<div class="bonds-warning-box">' +
      '<p class="bonds-warning-title">채권 투자 전 확인하세요</p>' +
      '<ul class="bonds-warning-list">' +
      '<li>금리가 오르면 채권 가격은 하락할 수 있습니다.</li>' +
      '<li>발행 기업·기관의 부도 위험이 존재합니다.</li>' +
      '<li>만기 전 매도하면 손실이 발생할 수 있습니다.</li>' +
      '</ul></div>' +
      footerLinksHtml()
    );
  }

  function panelHtml(tabId) {
    if (tabId === 'types') return panelTypesHtml();
    if (tabId === 'risk') return panelRiskHtml();
    return panelFlowHtml();
  }

  function normalizeTab(tab) {
    var t = String(tab || 'flow').toLowerCase();
    for (var i = 0; i < TABS.length; i++) {
      if (TABS[i].id === t) return t;
    }
    return 'flow';
  }

  function setActiveTab(root, tabId, options) {
    options = options || {};
    var active = normalizeTab(tabId);
    root.querySelectorAll('.bonds-tab-btn').forEach(function (btn) {
      var on = btn.getAttribute('data-tab') === active;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    root.querySelectorAll('.bonds-tab-panel').forEach(function (panel) {
      var on = panel.getAttribute('data-tab') === active;
      panel.classList.toggle('is-active', on);
      panel.hidden = !on;
    });
    if (!options.skipHistory) {
      try {
        var url = new URL(window.location.href);
        url.searchParams.set('topic', 'bonds');
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
      '<div class="bonds-tab-switch" role="tablist" aria-label="채권 설명 탭">' +
      TABS.map(function (t) {
        var active = t.id === initialTab;
        return (
          '<button type="button" class="bonds-tab-btn' +
          (active ? ' is-active' : '') +
          '" role="tab" data-tab="' +
          t.id +
          '" aria-selected="' +
          (active ? 'true' : 'false') +
          '" id="bonds-tab-' +
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
        '<div class="bonds-tab-panel' +
        (active ? ' is-active' : '') +
        '" role="tabpanel" data-tab="' +
        t.id +
        '" id="bonds-panel-' +
        t.id +
        '" aria-labelledby="bonds-tab-' +
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
      var btn = e.target.closest('.bonds-tab-btn');
      if (!btn || !root.contains(btn)) return;
      setActiveTab(root, btn.getAttribute('data-tab'));
    });
  }

  global.BondsGuide = {
    mount: mount,
    normalizeTab: normalizeTab,
  };
})(typeof window !== 'undefined' ? window : this);
