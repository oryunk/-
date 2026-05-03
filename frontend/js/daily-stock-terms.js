/**
 * 홈 「오늘의 주식 용어」 — 한국 날짜(KST) 기준으로 하루 동안 같은 4개가 나오도록 선택
 */
(function () {
  'use strict';

  var TERMINOLOGY_POOL = [
    { symbol: 'PER', word: '주가수익비율', def: '주가를 주당순이익(EPS)으로 나눈 값. 업종·성장성과 함께 봐야 해요.' },
    { symbol: 'PBR', word: '주가순자산비율', def: '주가를 1주당 순자산(BPS)으로 나눈 값. 자산주·금융주 볼 때 자주 써요.' },
    { symbol: 'EPS', word: '주당순이익', def: '순이익을 발행 주식 수로 나눈 값. 주주 1주당 귀속 이익이에요.' },
    { symbol: 'ROE', word: '자기자본이익률', def: '자기자본 대비 순이익 비율. 효율 지표지만 부채 구조도 같이 보세요.' },
    { symbol: 'PSR', word: '주가매출비율', def: '매출 대비 주가 수준. 적자인데 매출은 큰 기업 볼 때 PER 대신 참고해요.' },
    { symbol: 'BPS', word: '주당순자산', def: '1주당 장부상 순자산. PBR의 분모가 됩니다.' },
    { symbol: '시총', word: '시가총액', def: '주가 × 상장 주식 수에 가깝게 보면 돼요. 회사 규모 감각에 써요.' },
    { symbol: '등락률', word: '전일 대비 %', def: '어제 종가 대비 몇 % 올랐는지·내렸는지. 퍼센트로 한눈에 봐요.' },
    { symbol: '거래대금', word: '거래대금', def: '가격 × 거래량으로 본 “그날 얼마나 큰 돈이 움직였는지”예요.' },
    { symbol: '외인', word: '외국인 순매수', def: '외국인이 그날 순으로 더 샀는지 팔았는지. 수급 참고 지표예요.' },
    { symbol: '기관', word: '기관 순매수', def: '기관이 순으로 매수했는지 매도했는지. 수급 흐름을 볼 때 써요.' },
    { symbol: '배당률', word: '배당수익률', def: '주가 대비 배당이 몇 %인지. 현금 수익 감각으로 비교할 수 있어요.' },
    { symbol: 'VI', word: '변동성 완화', def: '주가가 급하게 움직이면 잠시 매매를 쉬게 하는 제도예요.' },
    { symbol: 'RSI', word: '상대강도지수', def: '최근 오름·내림으로 과매수·과매도 구간을 숫자로 보려는 지표예요.' },
    { symbol: '이평선', word: '이동평균선', def: '일정 기간 평균 주가를 이은 선. 추세를 볼 때 자주 봐요.' },
    { symbol: 'GC', word: '골든크로스', def: '단기 이평이 장기 이평을 아래에서 뚫고 올라갈 때 쓰는 말이에요. (맹신은 위험)' },
    { symbol: '유증', word: '유상증자', def: '돈을 받고 새 주식을 파는 일. 공시·목적을 같이 봐야 해요.' },
    { symbol: '무증', word: '무상증자', def: '돈 없이 주식 수만 늘리는 일. 주가는 보통 비례해 조정돼요.' },
    { symbol: '액분', word: '액면분할', def: '1주 가격을 쪼개는 일. 거래를 쉽게 하려는 경우가 많아요.' },
    { symbol: '부채비율', word: '부채비율', def: '빚이 자본 대비 얼마나 많은지. 업종 평균과 비교하는 편이 안전해요.' },
    { symbol: '영업익', word: '영업이익', def: '본업으로 벌어들인 이익. “장사 실력”에 가까운 지표예요.' },
    { symbol: '체결', word: '체결강도', def: '매수·매도 체결 중 어느 쪽이 더 셌는지 요약한 지표. 증권사마다 달라요.' },
    { symbol: '호가', word: '호가', def: '사려는 가격·팔려는 가격이 줄 서 있는 창이에요.' },
    { symbol: 'EV/EBITDA', word: 'EV/EBITDA', def: '빚까지 넣은 기업 가치를 이익으로 나눈 지표. 업종 비교에 쓰기도 해요.' },
  ];

  function koreaDateKey() {
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    var y = '';
    var m = '';
    var d = '';
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].type === 'year') y = parts[i].value;
      if (parts[i].type === 'month') m = parts[i].value;
      if (parts[i].type === 'day') d = parts[i].value;
    }
    return y + '-' + m + '-' + d;
  }

  /** 32비트 정수 시드 (같은 날짜 → 같은 시드) */
  function seedFromDateKey(dateKey) {
    var h = 2166136261;
    for (var i = 0; i < dateKey.length; i++) {
      h ^= dateKey.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) || 1;
  }

  /** Mulberry32 PRNG */
  function mulberry32(seed) {
    return function () {
      var t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickDailyTerms(pool, count, seed) {
    var n = pool.length;
    if (n === 0) return [];
    var rng = mulberry32(seed);
    var idx = new Array(n);
    var i;
    for (i = 0; i < n; i++) idx[i] = i;
    for (i = n - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = idx[i];
      idx[i] = idx[j];
      idx[j] = tmp;
    }
    var take = Math.min(count, n);
    var out = [];
    for (i = 0; i < take; i++) out.push(pool[idx[i]]);
    return out;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function render() {
    var grid = document.getElementById('dailyTermsGrid');
    if (!grid) return;
    var key = koreaDateKey();
    var seed = seedFromDateKey(key);
    var picked = pickDailyTerms(TERMINOLOGY_POOL, 4, seed);
    grid.innerHTML = picked
      .map(function (t) {
        return (
          '<div class="term-card">' +
          '<div class="term-symbol">' +
          escapeHtml(t.symbol) +
          '</div>' +
          '<div class="term-word">' +
          escapeHtml(t.word) +
          '</div>' +
          '<div class="term-def">' +
          escapeHtml(t.def) +
          '</div>' +
          '</div>'
        );
      })
      .join('');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
