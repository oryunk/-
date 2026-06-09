/**
 * 차트연구소 「오늘의 명언」 — KST 날짜 시드로 같은 날 동일 인용
 */
(function () {
  'use strict';

  var QUOTE_POOL = [
    { text: '주식 시장은 인내심이 있는 사람에게 보상하고, 조급한 사람에게는 벌을 준다.', author: '워런 버핏' },
    { text: '시장이 틀렸다고 생각하지 마라. 시장이 맞고, 네 생각이 틀린 것일 수 있다.', author: '제시 리버모어' },
    { text: '투자에서 가장 중요한 것은 감정을 통제하는 것이다.', author: '벤저민 그레이엄' },
    { text: '단기적으로는 투표기, 장기적으로는 저울이다.', author: '벤저민 그레이엄' },
    { text: '위험은 자신이 무엇을 하고 있는지 모르는 데서 온다.', author: '워런 버핏' },
    { text: '시장을 예측하려 하지 말고, 시장에 대비하라.', author: '하워드 막스' },
    { text: '손실을 줄이는 것이 수익을 늘리는 것만큼 중요하다.', author: '폴 튜더 존스' },
    { text: '차트는 시장 참여자들의 심리를 반영한다.', author: '존 머피' },
    { text: '추세는 친구다. 추세에 역행하지 마라.', author: '제시 리버모어' },
    { text: '지지와 저항은 차트의 문법이다.', author: '스티브 니슨' },
    { text: '이동평균선은 추세의 나침반이다.', author: '존 머피' },
    { text: '패턴은 반복되지만, 맹신하면 위험하다.', author: '토마스 불코프스키' },
    { text: '작은 손실을 받아들이는 것이 큰 손실을 막는다.', author: '에드 시코타' },
    { text: '계획 없는 매매는 도박이다.', author: '마크 미너비니' },
    { text: '시장이 주는 기회는 준비된 자에게만 보인다.', author: '피터 린치' },
    { text: '두려움과 탐욕이 차트에 그려진다.', author: '존 템플턴' },
    { text: '확률에 유리한 자리만 기다리는 것이 핵심이다.', author: '에드 시코타' },
    { text: '차트는 과거를 말해 주지만, 미래를 보장하지는 않는다.', author: '존 머피' },
    { text: '돌파와 이탈을 구분하는 눈이 필요하다.', author: '스티브 니슨' },
    { text: '골든크로스와 데드크로스는 신호일 뿐, 확정이 아니다.', author: '존 머피' },
    { text: '박스권에서는 방향을 가늠하기 어렵다. 인내가 필요하다.', author: '제시 리버모어' },
    { text: '리스크를 먼저 생각하고, 수익은 그다음이다.', author: '폴 튜더 존스' },
    { text: '시장은 항상 옳다. 틀린 것은 내 해석일 수 있다.', author: '에드 시코타' },
    { text: '기술적 분석은 타이밍의 도구이지, 가치 판단의 대체가 아니다.', author: '피터 린치' },
    { text: '같은 실수를 반복하지 않는 것이 성장의 시작이다.', author: '레이 달리오' },
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

  function seedFromDateKey(dateKey) {
    var h = 2166136261;
    for (var i = 0; i < dateKey.length; i++) {
      h ^= dateKey.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) || 1;
  }

  function pickDailyQuote(pool, seed) {
    if (!pool.length) return null;
    var idx = seed % pool.length;
    return pool[idx];
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getDailyQuote() {
    var key = koreaDateKey();
    var seed = seedFromDateKey(key);
    return pickDailyQuote(QUOTE_POOL, seed);
  }

  function render(targetId) {
    var el = document.getElementById(targetId || 'chartLabDailyQuote');
    if (!el) return;
    var q = getDailyQuote();
    if (!q) return;
    el.innerHTML =
      '<blockquote class="chart-lab-quote-text">“' +
      escapeHtml(q.text) +
      '”</blockquote>' +
      '<cite class="chart-lab-quote-author">— ' +
      escapeHtml(q.author) +
      '</cite>';
  }

  window.JurinDailyStockQuote = {
    getDailyQuote: getDailyQuote,
    render: render,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      render('chartLabDailyQuote');
    });
  } else {
    render('chartLabDailyQuote');
  }
})();
