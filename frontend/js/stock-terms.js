/**
 * 파일: 시장 상세·용어 사전 공용 용어/힌트 데이터
 * 설명( market.html, glossary.html 등에서 로드. 카드 라벨과 도움말 텍스트를 채운다. )
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
      tabLabel: '시세·호가',
      title: '1. 시세·호가·수급',
      subtitle: '현재가·등락, 거래량·거래대금, 투자자별 매매동향, 호가창·주문 유형 등',
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
        { name: '지정가', desc: '내가 원하는 가격을 직접 정해 주문하는 방식이에요. 해당 가격에 상대 주문이 있어야 체결돼요.' },
        { name: '시장가', desc: '가격보다 빠른 체결을 우선하는 주문 방식이에요. 체결가는 예상과 다를 수 있어요.' },
        { name: '스프레드', desc: '매수호가와 매도호가 사이 차이를 말해요. 넓을수록 체결가 오차가 커질 수 있어요.' },
        { name: '미체결', desc: '주문이 아직 전부 체결되지 않고 남아 있는 상태예요.' },
        { name: '부분체결', desc: '주문 수량 중 일부만 먼저 체결된 상태예요.' },
        { name: '정정주문', desc: '낸 주문의 가격/수량을 바꿔 다시 대기시키는 기능이에요.' },
        { name: '취소주문', desc: '대기 중인 주문을 취소해 체결 대기를 끝내는 기능이에요.' },
        { name: 'VI', desc: '변동성 완화 장치. 주가가 급하게 움직이면 잠시 매매를 쉬게 해요.' },
      ],
    },
    {
      id: 'value',
      tabLabel: '밸류',
      title: '2. 밸류에이션 (기업가치평가)',
      subtitle: 'PER·PBR·PSR, EV/EBITDA, EPS·BPS, 시가총액·52주 가격대 등',
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
      tabLabel: '실적',
      title: '3. 실적·재무제표',
      subtitle: '매출·손익, ROE, 부채비율·유동비율·유보율 등 재무 지표',
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
      tabLabel: '배당',
      title: '4. 배당·주주환원',
      subtitle: '배당금·배당수익률·배당성향, 자사주 매입·소각 등',
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
      tabLabel: '차트',
      title: '5. 기술적 분석·차트',
      subtitle: '이동평균선·RSI 등 지표, 유상·무상증자·액면분할 등 관련 용어',
      items: [
        { name: '이동평균선', desc: '일정 기간 동안 주가 평균을 이어 만든 선. 추세를 볼 때 써요.' },
        { name: '골든크로스', desc: '단기 이평선이 장기 이평선을 아래에서 뚫고 올라갈 때 쓰는 말이에요. (신호로만 믿으면 위험해요.)' },
        { name: 'RSI', desc: '최근 오름·내림 속도로 과매수·과매도 구간을 숫자로 보려는 지표예요.' },
        { name: '유상증자', desc: '돈을 받고 새 주식을 파는 일이에요. 시장 반응은 경우마다 달라요.' },
        { name: '무상증자', desc: '돈 없이 주식 수를 늘리는 일이에요. 주가는 보통 비례해서 조정돼요.' },
        { name: '액면분할', desc: '주식 1주 가격을 쪼개는 일이에요. 거래를 쉽게 하려는 목적이 많아요.' },
      ],
    },
    {
      id: 'derivatives',
      tabLabel: '파생',
      title: '6. 파생상품',
      subtitle: 'ELW, 레버리지·인버스, 만기·시간가치 등 (구조·위험도 사전 이해 필요)',
      items: [
        { name: 'ELW', desc: '정해진 기간 안에 특정 가격으로 사고팔 수 있는 권리형 상품이에요. 만기와 변동성 영향이 큽니다.' },
        { name: '레버리지', desc: '지수 움직임을 2배 등으로 확대 추종하는 구조예요. 방향이 틀리면 손실도 빨라질 수 있어요.' },
        { name: '인버스', desc: '기초지수가 하락할 때 수익이 나도록 설계된 상품이에요. 상승장에서는 불리할 수 있어요.' },
        { name: '만기', desc: '상품의 유효기간 종료 시점이에요. 파생상품은 만기 전에 가치가 크게 변할 수 있어요.' },
        { name: '시간가치', desc: '만기까지 남은 시간 때문에 붙는 가치예요. 만기가 가까워질수록 줄어드는 경향이 있어요.' },
      ],
    },
    {
      id: 'bonds',
      tabLabel: '채권',
      title: '7. 채권',
      subtitle: '표면금리, YTM, 듀레이션, 신용등급, 금리민감도 등',
      items: [
        { name: '표면금리', desc: '채권 발행 시 정해진 이자율이에요. 실제 수익률(YTM)과는 다를 수 있어요.' },
        { name: 'YTM', desc: '만기까지 보유했을 때 기대되는 연환산 수익률이에요. 채권 비교의 핵심 지표예요.' },
        { name: '듀레이션', desc: '금리 변화에 채권 가격이 얼마나 민감한지 보여주는 길이 개념이에요.' },
        { name: '신용등급', desc: '발행자가 이자와 원금을 갚을 능력을 등급으로 표시한 값이에요.' },
        { name: '금리민감도', desc: '시장금리 변화에 따라 가격이 얼마나 크게 흔들리는지 보는 관점이에요.' },
      ],
    },
    {
      id: 'funds',
      tabLabel: 'ETF',
      title: '8. 집합투자·ETF',
      subtitle: '총보수, 추적오차, 괴리율, 환매·분배금 등',
      items: [
        { name: '총보수', desc: '펀드 운용에 드는 연간 비용 비율이에요. 장기투자에서 누적 영향이 커요.' },
        { name: '추적오차', desc: 'ETF 수익률이 기초지수를 얼마나 정확히 따라갔는지의 오차예요.' },
        { name: '괴리율', desc: 'ETF 시장가격과 실제 순자산가치(NAV) 차이를 퍼센트로 본 값이에요.' },
        { name: '환매', desc: '펀드를 되팔아 현금화하는 절차예요. 처리일과 기준가 반영 시점이 중요해요.' },
        { name: '분배금', desc: 'ETF/펀드가 투자자에게 나눠주는 현금 지급분이에요.' },
      ],
    },
    {
      id: 'ipo',
      tabLabel: '공모',
      title: '9. 공모·청약',
      subtitle: '청약증거금, 균등·비례 배정, 의무보유확약, 환불일 등',
      items: [
        { name: '청약증거금', desc: '공모주 청약 신청 시 미리 넣는 보증금이에요. 경쟁률에 따라 배정이 달라져요.' },
        { name: '균등배정', desc: '청약자에게 최소 수량을 비슷하게 나누는 방식이에요.' },
        { name: '비례배정', desc: '넣은 증거금 비율에 따라 더 많이 배정받는 방식이에요.' },
        { name: '의무보유확약', desc: '기관투자자가 일정 기간 팔지 않겠다고 약속한 비율이에요. 수급 안정 지표로 봅니다.' },
        { name: '환불일', desc: '배정 후 남은 증거금이 계좌로 돌아오는 날짜예요.' },
      ],
    },
    {
      id: 'macro',
      tabLabel: '거시',
      title: '10. 거시·시장 환경',
      subtitle: '환율, 금리, 물가 등 전체 시장에 영향을 주는 요인',
      items: [
        { name: '환율', desc: '원화와 외화(주로 달러)를 바꿀 때 쓰는 가격이에요. 수출·수입 기업 실적과 주가에 영향을 줄 수 있어요.' },
        { name: '금리', desc: '빌릴 때·맡길 때 붙는 이자 비율이에요. 올라가면 성장주·채권 가격에 부담이 될 수 있어요.' },
        { name: '물가', desc: '생활비·상품 가격 수준이에요. 빠르게 오르면 금리 인상 압력이 커질 수 있어요.' },
        { name: '인플레이션', desc: '물가가 지속적으로 오르는 현상이에요. 실질 구매력과 투자 심리에 영향을 줘요.' },
        { name: '디플레이션', desc: '물가 상승이 둔화되거나 내려가는 현상이에요. 기업 이익·경기 기대에 부담이 될 수 있어요.' },
        { name: '경기침체', desc: '경제 활동이 줄어드는 구간이에요. 실적·고용·주가 변동성이 커질 수 있어요.' },
      ],
    },
  ];

  /** 용어 검색 자동완성 후보 (카테고리 밖 표기) */
  var GLOSSARY_POPULAR_TERMS = [
    'PER',
    'ROE',
    '배당주',
    '시가총액',
    '변동성',
    '포트폴리오',
    '체결강도',
    '호가',
    'EPS',
    'BPS',
    '배당성향',
    '공매도',
    '공시',
    '실적발표',
  ];

  /** 핵심 용어: 공공/거래소 계열 정의 기반 "공식 설명 3줄" 프리셋 */
  var OFFICIAL_SUMMARY_PRESETS = (function () {
    function n(s) {
      return String(s || '').trim().toLowerCase().replace(/\s+/g, '');
    }
    return {
      [n('채권')]: {
        summary:
          '채권은 중앙정부·지방정부·공기업·금융기관·기타 법인 등이 자금 조달을 위해 발행하며, 정해진 기한 후 투자자에게 원금과 함께 이자를 상환하는 채무증서로 증권화된 금융상품입니다.',
        sourceLabel: '공공·거래소 계열 용어 정의(요약)',
      },
      [n('ELW')]: {
        summary:
          'ELW(주식워런트증권)는 개별 주식 또는 주가지수를 기초자산으로 하며, 기초자산 가격 변동에 따라 투자수익이 결정되는 권리증서(파생결합증권)입니다. 만기에 정해진 행사가로 기초자산을 매수(콜)하거나 매도(풋)할 수 있는 권리를 부여합니다.',
        sourceLabel: '공공·거래소 계열 용어 정의(요약)',
      },
      [n('PER')]: {
        summary:
          'PER(주가수익비율)은 주가를 주당순이익(EPS)으로 나눈 값으로, 주가가 이익 대비 얼마나 비싼지/싼지를 나타냅니다. 투자에서는 성장성·업종·이익의 질과 함께 비교해 해석합니다.',
        sourceLabel: '투자지표 표준 정의(요약)',
      },
      [n('PBR')]: {
        summary:
          'PBR(주가순자산비율)은 주가를 주당순자산(BPS)으로 나눈 값입니다. 자산 대비 주가 수준을 비교할 때 사용합니다.',
        sourceLabel: '투자지표 표준 정의(요약)',
      },
      [n('ROE')]: {
        summary:
          'ROE(자기자본이익률)는 당기순이익을 자기자본으로 나눈 값으로, 자본을 얼마나 효율적으로 운용했는지 보여줍니다. 부채 구조 등과 함께 봐야 왜곡 해석을 줄일 수 있습니다.',
        sourceLabel: '투자지표 표준 정의(요약)',
      },
      [n('시가총액')]: {
        summary:
          '시가총액은 현재 주가에 발행주식 수를 곱한 기업의 규모(가치)입니다. 시장에서 기업 크기를 비교하는 대표 지표로 활용됩니다.',
        sourceLabel: '시장 대표 지표 정의(요약)',
      },
      [n('배당수익률')]: {
        summary:
          '배당수익률은 연간 배당금을 현재 주가로 나눈 값(%)입니다. 주가 대비 현금 수익의 크기를 비교하는 데 사용합니다.',
        sourceLabel: '배당 지표 표준 정의(요약)',
      },
      [n('YTM')]: {
        summary:
          'YTM(만기수익률)은 채권을 만기까지 보유했을 때 기대되는 연환산 수익률입니다. 시장가격과 수익·상환 구조를 반영해 실제 기대수익을 보여줍니다.',
        sourceLabel: '채권 지표 표준 정의(요약)',
      },
      [n('듀레이션')]: {
        summary:
          '듀레이션은 금리 변화에 따른 채권 가격의 변동 민감도를 나타내는 지표입니다. 기간이 길수록 금리 영향이 커지는 경향이 있습니다.',
        sourceLabel: '채권 지표 표준 정의(요약)',
      },
      [n('신용등급')]: {
        summary:
          '신용등급은 채권 발행자의 원리금 상환 능력을 평가해 부여하는 등급입니다. 등급이 높을수록 상대적으로 상환 위험이 낮다고 봅니다.',
        sourceLabel: '신용평가 지표 정의(요약)',
      },
    };
  })();

  function normalizePresetKey(termName) {
    return String(termName || '').trim().toLowerCase().replace(/\s+/g, '');
  }

  function getOfficialSummaryPreset(termName) {
    var key = normalizePresetKey(termName);
    return OFFICIAL_SUMMARY_PRESETS[key] || null;
  }

  /** 금융 용어 자동완성 후보 목록 (이름·지표 라벨·인기 용어 통합) */
  function collectGlossaryAutocompleteTerms() {
    var seen = Object.create(null);
    var out = [];
    function add(term) {
      var s = String(term || '').trim();
      if (!s || seen[s]) return;
      seen[s] = true;
      out.push(s);
    }
    GLOSSARY_CATEGORIES.forEach(function (cat) {
      (cat.items || []).forEach(function (it) {
        if (it && it.name) add(it.name);
      });
    });
    Object.keys(INDICATOR_HINTS).forEach(add);
    Object.keys(STABILITY_HINTS).forEach(add);
    Object.keys(CARD_LABELS).forEach(add);
    GLOSSARY_POPULAR_TERMS.forEach(add);
    return out;
  }

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

  var TAB_LABEL_FALLBACK = {
    mood: '시세·호가',
    value: '밸류',
    fundamentals: '실적',
    shareholder: '배당',
    chart: '차트',
    derivatives: '파생',
    bonds: '채권',
    funds: 'ETF',
    ipo: '공모',
    macro: '거시'
  };

  function searchTermFromBrowse(term) {
    var input = document.getElementById('termInput');
    if (input) input.value = term;
    if (typeof global.searchTerm === 'function') global.searchTerm();
    else if (typeof global.searchPopularTerm === 'function') global.searchPopularTerm(term);
  }

  function shortTabLabel(cat) {
    if (!cat) return '';
    if (cat.tabLabel) return cat.tabLabel;
    if (cat.id && TAB_LABEL_FALLBACK[cat.id]) return TAB_LABEL_FALLBACK[cat.id];
    var t = String(cat.title || '');
    return t.replace(/^\d+\.\s*/, '').split('(')[0].trim().slice(0, 8);
  }

  function findCategoryById(catId) {
    for (var i = 0; i < GLOSSARY_CATEGORIES.length; i++) {
      if (GLOSSARY_CATEGORIES[i].id === catId) return GLOSSARY_CATEGORIES[i];
    }
    return GLOSSARY_CATEGORIES[0] || null;
  }

  function renderCategoryBlock(cat) {
    var items = (cat.items || [])
      .map(function (it) {
        return (
          '<div class="glossary-browse-item" role="button" tabindex="0" data-term="' +
          escapeHtml(it.name) +
          '">' +
          '<div class="glossary-browse-name">' +
          escapeHtml(it.name) +
          '</div>' +
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
  }

  function renderCategoryPanel(cat) {
    if (!cat) return '';
    return renderCategoryBlock(cat);
  }

  function bindBrowseActions(root) {
    if (!root) return;
    root.querySelectorAll('.glossary-browse-item').forEach(function (item) {
      function activate() {
        var t = item.getAttribute('data-term') || '';
        if (t) searchTermFromBrowse(t);
      }
      item.addEventListener('click', function (e) {
        activate();
      });
      item.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      });
    });
  }

  function mountGlossaryTabs(tabsId, panelId) {
    var tabsEl = document.getElementById(tabsId);
    var panelEl = document.getElementById(panelId);
    if (!tabsEl || !panelEl) return;

    var activeId = GLOSSARY_CATEGORIES[0] ? GLOSSARY_CATEGORIES[0].id : '';

    function setActiveTab(catId) {
      activeId = catId;
      tabsEl.querySelectorAll('.glossary-cat-tab').forEach(function (btn) {
        var on = btn.getAttribute('data-cat-id') === catId;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
        btn.tabIndex = on ? 0 : -1;
      });
      var cat = findCategoryById(catId);
      panelEl.innerHTML = renderCategoryPanel(cat);
      bindBrowseActions(panelEl);
    }

    tabsEl.innerHTML = '';
    tabsEl.setAttribute('role', 'tablist');
    GLOSSARY_CATEGORIES.forEach(function (cat, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'glossary-cat-tab' + (idx === 0 ? ' active' : '');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('data-cat-id', cat.id);
      btn.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
      btn.tabIndex = idx === 0 ? 0 : -1;
      btn.textContent = shortTabLabel(cat);
      btn.addEventListener('click', function () {
        setActiveTab(cat.id);
      });
      btn.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        var ids = GLOSSARY_CATEGORIES.map(function (c) {
          return c.id;
        });
        var pos = ids.indexOf(activeId);
        if (pos < 0) pos = 0;
        if (e.key === 'ArrowRight') pos = (pos + 1) % ids.length;
        else pos = (pos - 1 + ids.length) % ids.length;
        setActiveTab(ids[pos]);
        var nextBtn = tabsEl.querySelector('[data-cat-id="' + ids[pos] + '"]');
        if (nextBtn) nextBtn.focus();
      });
      tabsEl.appendChild(btn);
    });

    panelEl.setAttribute('role', 'tabpanel');
    setActiveTab(activeId);
  }

  /** @deprecated use mountGlossaryTabs */
  function mountGlossaryBrowse(containerId) {
    mountGlossaryTabs('glossaryCategoryTabs', 'glossaryCategoryPanel');
  }

  global.JurinStockTerms = {
    SECTIONS: SECTIONS,
    CARD_LABELS: CARD_LABELS,
    INDICATOR_HINTS: INDICATOR_HINTS,
    GLOSSARY_CATEGORIES: GLOSSARY_CATEGORIES,
    GLOSSARY_POPULAR_TERMS: GLOSSARY_POPULAR_TERMS,
    OFFICIAL_SUMMARY_PRESETS: OFFICIAL_SUMMARY_PRESETS,
    getOfficialSummaryPreset: getOfficialSummaryPreset,
    collectGlossaryAutocompleteTerms: collectGlossaryAutocompleteTerms,
    metricItemHtml: metricItemHtml,
    initMarketDetailHints: function () {
      initSectionLeads();
      initDetailCardHints();
    },
    mountGlossaryBrowse: mountGlossaryBrowse,
    mountGlossaryTabs: mountGlossaryTabs,
    renderCategoryPanel: renderCategoryPanel,
    shortTabLabel: shortTabLabel,
    searchTermFromBrowse: searchTermFromBrowse,
    escapeHtml: escapeHtml,
  };
})(typeof window !== 'undefined' ? window : this);
