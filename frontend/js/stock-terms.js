/**
 * 주린이용 주식 용어 — 시장 종목 상세·용어 사전 공용
 * 증권사 화면 흐름에 맞춘 섹션 설명 + 지표별 한 줄 힌트
 */
(function (global) {
  'use strict';

  /** 섹션 제목 아래 리드 — 가이드/용어 사전에서 설명하므로 비움 */
  var SECTIONS = {
    investor: { lead: '' },
    indicators: { lead: '' },
    valuation: { lead: '' },
    performance: { lead: '' },
    balance: { lead: '' },
    stability: { lead: '' },
    news: { lead: '' },
    disclosure: { lead: '' },
    chart: { lead: '' },
  };

  /** 상세 그리드 카드(거래량 등) — 가이드에서 설명; 힌트 미삽입 */
  var CARD_LABELS = {};

  /** 투자 지표 그리드 — 라벨 정확히 일치 */
  var INDICATOR_HINTS = {
    시가총액: {
      hint: '주가 × 상장 주식 수에 가깝게 보면 돼요. 회사 “덩치”를 나타냅니다.',
      term: '시가총액',
    },
    배당수익률: {
      hint: '주가 대비 배당이 몇 %인지. 은행 이자와 비슷하게 “현금 수익” 감각으로 볼 수 있어요.',
      term: '배당수익률',
    },
    PER: {
      hint: '주가를 주당순이익(EPS)으로 나눈 값. 낮다고 무조건 싼 건 아니고, 성장·업종을 같이 봐야 해요.',
      term: 'PER',
    },
    PBR: {
      hint: '주가를 주당순자산(BPS)으로 나눈 값. 순자산 대비 주가가 몇 배인지 봅니다.',
      term: 'PBR',
    },
    ROE: {
      hint: '자기자본으로 얼마나 이익을 냈는지(효율). 높을수록 좋다고만 보면 안 되고 부채 구조도 같이 봐요.',
      term: 'ROE',
    },
    PSR: {
      hint: '매출 대비 주가 수준. 적자인 성장주를 볼 때 PER 대신 참고하는 경우가 많아요.',
      term: 'PSR',
    },
    '외국인 소진율': {
      hint: '외국인이 상장 주식 중 얼마나 갖고 있는지 비율. 수급·관심 지표 중 하나예요.',
      term: '외국인 소진율',
    },
  };

  /** 안정성/배당 그리드 */
  var STABILITY_HINTS = {
    부채비율: {
      hint: '빚이 자본 대비 얼마나 많은지. 업종·회계 기준에 따라 다르니 숫자만으로 “건강/불건강” 단정은 피해요.',
      term: '부채비율',
    },
    유동비율: {
      hint: '단기 자산으로 단기 빚을 얼마나 갚을 수 있는지에 가까운 지표예요. (표시는 %일 수 있어 출처를 확인하세요.)',
      term: '유동비율',
    },
    '배당 지급 횟수': { hint: '최근 몇 차례 배당했는지. 정기 배당 여부를 가늠하는 참고 값이에요.', term: '배당' },
    '1주당 배당금': { hint: '주 1주당 현금으로 받은 배당(또는 예정).', term: '배당금' },
    배당수익률: INDICATOR_HINTS['배당수익률'],
    '최근 배당일': { hint: '마지막으로 배당 기준일이 잡힌 날(또는 지급일). 증권사마다 표기가 달라요.', term: '배당락일' },
  };

  /**
   * 용어 사전 브라우즈용 카테고리 (정적 설명 + 필요 시 AI 검색으로 확장)
   */
  var GLOSSARY_CATEGORIES = [
    {
      id: 'mood',
      title: '1. 지금 분위기는? (실시간·수급)',
      subtitle: '“지금 이 종목, 시장에서 어떻게 보이나?”에 가까운 지표들',
      items: [
        { name: '현재가', desc: '지금 거래 기준 가격이에요. 장중에는 계속 변해요.' },
        { name: '전일대비', desc: '어제 마지막 가격보다 얼마나 올랐는지·내렸는지예요.' },
        { name: '등락률', desc: '전일 대비 몇 % 움직였는지. 퍼센트로 한눈에 보기 좋아요.' },
        { name: '거래량', desc: '주식이 몇 주나 바뀌었는지. 관심이 많을수록 거래가 붙어요.' },
        { name: '거래대금', desc: '가격 × 거래량으로 본 “얼마나 큰 돈이 움직였는지”예요.' },
        { name: '체결강도', desc: '매수 체결과 매도 체결 중 어느 쪽이 더 셌는지 요약한 지표예요. 증권사마다 살짝 달라요.' },
        { name: '외인 순매수', desc: '외국인이 그날 순으로 샀는지 팔았는지예요.' },
        { name: '기관 순매수', desc: '기관 투자자가 순으로 샀는지 팔았는지예요.' },
        { name: '호가', desc: '사려는 가격·팔려는 가격이 줄 서 있는 창이에요. 잔량은 그 가격에 얼마나 물량이 있는지예요.' },
        { name: 'VI', desc: '변동성 완화 장치. 주가가 급하게 움직이면 잠시 매매를 쉬게 해요.' },
      ],
    },
    {
      id: 'value',
      title: '2. 가성비 체크 (밸류에이션)',
      subtitle: '“이 가격, 싼 거야 비싼 거야?”에 가까운 지표들',
      items: [
        { name: '시가총액', desc: '회사 전체 가치를 주가로 곱해 본 규모예요. “덩치” 감각으로 써요.' },
        { name: 'PER', desc: '주가가 1주당 이익의 몇 배인지. 성장주는 PER이 높게 나올 수 있어요.' },
        { name: 'PBR', desc: '주가가 장부상 순자산의 몇 배인지. 자산주·금융주 볼 때 자주 봐요.' },
        { name: 'PSR', desc: '매출 대비 주가. 적자인데 매출은 크게 나는 기업을 볼 때 참고해요.' },
        { name: 'EV/EBITDA', desc: '빚까지 포함한 기업 가치를 이익으로 나눈 지표예요. M&A·밸류 비교에 쓰기도 해요.' },
        { name: 'EPS', desc: '주 1주당 벌어들인 순이익이에요. PER의 분모가 됩니다.' },
        { name: 'BPS', desc: '주 1주당 순자산(장부상). PBR의 분모가 됩니다.' },
        { name: '52주 최고가', desc: '최근 1년 사이 가장 비쌌던 가격이에요.' },
        { name: '52주 최저가', desc: '최근 1년 사이 가장 쌌던 가격이에요.' },
      ],
    },
    {
      id: 'fundamentals',
      title: '3. 건강검진 (실적·재무)',
      subtitle: '“돈은 잘 벌고, 빚은 괜찮나?”에 가까운 지표들',
      items: [
        { name: '매출액', desc: '물건·서비스를 팔아 번 총액. 회사 규모의 출발점이에요.' },
        { name: '영업이익', desc: '본업으로 벌어들인 이익. “장사 실력”에 가까워요.' },
        { name: '당기순이익', desc: '세금·이자 등을 반영한 최종 이익이에요.' },
        { name: 'ROE', desc: '자기자본으로 이익을 얼마나 효율적으로 냈는지 봐요.' },
        { name: '부채비율', desc: '빚이 자본 대비 얼마나 많은지. 업종마다 평균이 많이 달라요.' },
        { name: '유보율', desc: '벌어들인 돈 중 얼마를 회사에 쌓아두었는지와 관련된 개념이에요.' },
        { name: '유동비율', desc: '단기 갚을 능력과 관련된 지표로 자주 써요.' },
      ],
    },
    {
      id: 'shareholder',
      title: '4. 주주 보너스 (배당·환원)',
      subtitle: '“주주한테 뭐 해줘?”에 가까운 이야기',
      items: [
        { name: '배당금', desc: '주주에게 나눠 주는 현금이에요.' },
        { name: '배당수익률', desc: '지금 주가 기준으로 배당이 몇 %인지. 이자와 비슷하게 생각할 수 있어요.' },
        { name: '배당성향', desc: '벌어들인 이익 중 몇 %를 배당으로 줄지 비율로 본 거예요.' },
        { name: '자사주 매입', desc: '회사가 시장에서 자기 주식을 사들이는 일이에요. 주식 수가 줄면 주당 가치에 영향을 줄 수 있어요.' },
        { name: '소각', desc: '사들인 주식을 없애 버리는 일이에요. (해석은 공시·맥락을 같이 봐야 해요.)' },
      ],
    },
    {
      id: 'chart',
      title: '5. 차트·심화 (기술적 분석)',
      subtitle: '“추세·과열”을 숫자로 보려는 도구들',
      items: [
        { name: '이동평균선', desc: '일정 기간 동안 주가 평균을 이어 만든 선. 추세를 볼 때 써요.' },
        { name: '골든크로스', desc: '단기 이평선이 장기 이평선을 아래에서 뚫고 올라갈 때 쓰는 말이에요. (신호로만 믿으면 위험해요.)' },
        { name: 'RSI', desc: '최근 오름·내림 속도로 과매수·과매도 구간을 숫자로 보려는 지표예요.' },
        { name: '유상증자', desc: '돈을 받고 새 주식을 파는 일이에요. 시장 반응은 경우마다 달라요.' },
        { name: '무상증자', desc: '돈 없이 주식 수를 늘리는 일이에요. 주가는 보통 비례해서 조정돼요.' },
        { name: '액면분할', desc: '주식 1주 가격을 쪼개는 일이에요. 거래를 쉽게 하려는 목적이 많아요.' },
      ],
    },
  ];

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function glossaryLink(term) {
    var q = encodeURIComponent(term);
    return 'glossary.html?term=' + q;
  }

  /** metric-grid 한 칸 HTML */
  function metricItemHtml(label, valueDisplay) {
    var pack = INDICATOR_HINTS[label] || STABILITY_HINTS[label];
    var hint = pack && pack.hint ? pack.hint : '';
    var term = pack && pack.term ? pack.term : label;
    var hintBlock = hint
      ? '<div class="metric-item-hint">' + escapeHtml(hint) + '</div>'
      : '';
    var link = '<a class="metric-term-link" href="' + glossaryLink(term) + '" target="_blank" rel="noopener">용어사전</a>';
    return (
      '<div class="metric-item">' +
      '<div class="metric-item-label-row">' +
      '<span class="metric-item-label">' +
      escapeHtml(label) +
      '</span>' +
      link +
      '</div>' +
      hintBlock +
      '<div class="metric-item-value">' +
      valueDisplay +
      '</div>' +
      '</div>'
    );
  }

  function initSectionLeads() {
    document.querySelectorAll('section.detail-section[data-jurin-section]').forEach(function (sec) {
      var key = sec.getAttribute('data-jurin-section');
      var meta = SECTIONS[key];
      if (!meta) return;
      var el = sec.querySelector('.detail-section-lead');
      if (el) {
        var t = meta.lead || '';
        el.textContent = t;
        el.style.display = t ? '' : 'none';
      }
    });
    var chartEl = document.getElementById('chartTermLead');
    if (chartEl && SECTIONS.chart) {
      var ct = SECTIONS.chart.lead || '';
      chartEl.textContent = ct;
      chartEl.style.display = ct ? '' : 'none';
    }
  }

  function initDetailCardHints() {
    document.querySelectorAll('.detail-grid .detail-card').forEach(function (card) {
      var lab = card.querySelector('.detail-label');
      if (!lab) return;
      var text = (lab.textContent || '').trim();
      var hint = CARD_LABELS[text];
      if (!hint) return;
      if (card.querySelector('.detail-card-hint')) return;
      var d = document.createElement('div');
      d.className = 'detail-card-hint';
      d.textContent = hint;
      lab.insertAdjacentElement('afterend', d);
    });
  }

  function mountGlossaryBrowse(containerId) {
    var root = document.getElementById(containerId);
    if (!root) return;
    var html = GLOSSARY_CATEGORIES.map(function (cat) {
      var items = cat.items
        .map(function (it) {
          return (
            '<div class="glossary-browse-item">' +
            '<div class="glossary-browse-name">' +
            escapeHtml(it.name) +
            '</div>' +
            '<div class="glossary-browse-desc">' +
            escapeHtml(it.desc) +
            '</div>' +
            '<button type="button" class="glossary-browse-ai" data-term="' +
            escapeHtml(it.name) +
            '">AI로 자세히</button>' +
            '</div>'
          );
        })
        .join('');
      return (
        '<section class="glossary-browse-block" id="glossary-cat-' +
        escapeHtml(cat.id) +
        '">' +
        '<h3 class="glossary-browse-title">' +
        escapeHtml(cat.title) +
        '</h3>' +
        '<p class="glossary-browse-sub">' +
        escapeHtml(cat.subtitle) +
        '</p>' +
        '<div class="glossary-browse-grid">' +
        items +
        '</div>' +
        '</section>'
      );
    }).join('');
    root.innerHTML = html;
    root.querySelectorAll('.glossary-browse-ai').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var t = btn.getAttribute('data-term') || '';
        var input = document.getElementById('termInput');
        if (input) input.value = t;
        if (typeof global.searchTerm === 'function') global.searchTerm();
        else if (typeof global.searchPopularTerm === 'function') global.searchPopularTerm(t);
      });
    });
  }

  global.JurinStockTerms = {
    SECTIONS: SECTIONS,
    CARD_LABELS: CARD_LABELS,
    INDICATOR_HINTS: INDICATOR_HINTS,
    GLOSSARY_CATEGORIES: GLOSSARY_CATEGORIES,
    metricItemHtml: metricItemHtml,
    initMarketDetailHints: function () {
      initSectionLeads();
      initDetailCardHints();
    },
    mountGlossaryBrowse: mountGlossaryBrowse,
    escapeHtml: escapeHtml,
  };
})(typeof window !== 'undefined' ? window : this);
