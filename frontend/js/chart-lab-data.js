/**
 * 차트연구소 정적 콘텐츠 — 패턴, 지지·저항, 이평선, 퀴즈
 */
(function () {
  'use strict';

  var CATEGORY_LABELS = {
    bullish: '상승 지속',
    'bullish-reversal': '상승 전환',
    bearish: '하락 지속',
    'bearish-reversal': '하락 전환',
    neutral: '중립',
  };

  var CATEGORY_COLORS = {
    bullish: '#2DB473',
    'bullish-reversal': '#1e7a45',
    bearish: '#E15241',
    'bearish-reversal': '#c62828',
    neutral: '#78909c',
  };

  var CATEGORY_BADGE = {
    bullish: { bg: '#e8f7ee', text: '#1e7a45', tone: 'bullish' },
    'bullish-reversal': { bg: '#e8f7ee', text: '#1e7a45', tone: 'bullish-reversal' },
    bearish: { bg: '#fdecea', text: '#c62828', tone: 'bearish' },
    'bearish-reversal': { bg: '#fdecea', text: '#c62828', tone: 'bearish-reversal' },
    neutral: { bg: '#f0f2f1', text: '#5f6f66', tone: 'neutral' },
  };

  var BULL_LINE = '#2DB473';
  var BEAR_LINE = '#E15241';
  var NEUTRAL_LINE = '#78909c';
  var SUPPORT_COLOR = '#64b5f6';
  var RESIST_COLOR = '#ef9a9a';

  function isBullishCategory(cat) {
    return cat === 'bullish' || cat === 'bullish-reversal';
  }

  function pathRole(p) {
    return p && p.role ? p.role : 'price';
  }

  function renderPath(parts, p, mainColor, markerId, useArrow) {
    var role = pathRole(p);
    var stroke = p.color || (role === 'ma' ? p.color : role === 'pole' ? mainColor : mainColor);
    var width = p.w || (role === 'pole' ? 3 : role === 'ma' ? 2 : 2.5);
    parts.push(
      '<path d="',
      p.d,
      '" fill="none" stroke="',
      stroke,
      '" stroke-width="',
      width,
      '" stroke-linecap="round" stroke-linejoin="round"',
      useArrow ? ' marker-end="url(#' + markerId + ')"' : '',
      '/>'
    );
  }

  function patternCardSvg(patternId, category, config) {
    config = config || {};
    var neutral = config.neutral || category === 'neutral';
    var mainColor = neutral ? NEUTRAL_LINE : isBullishCategory(category) ? BULL_LINE : BEAR_LINE;
    var markerId = 'clArr-' + patternId;
    var fillColor = config.fillColor || mainColor;
    var parts = [
      '<defs><marker id="',
      markerId,
      '" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">',
      '<path d="M0,0 L6,3 L0,6 Z" fill="',
      mainColor,
      '"/></marker></defs>',
    ];

    (config.fills || []).forEach(function (f) {
      parts.push(
        '<polygon points="',
        f.points,
        '" fill="',
        f.color || fillColor,
        '" opacity="',
        f.opacity == null ? 0.08 : f.opacity,
        '"/>'
      );
    });

    (config.silhouettes || []).forEach(function (s) {
      parts.push(
        '<path d="',
        s.d,
        '" fill="',
        s.color || fillColor,
        '" fill-opacity="',
        s.fillOpacity == null ? 0.14 : s.fillOpacity,
        '" stroke="none"/>'
      );
    });

    (config.sr || []).forEach(function (s) {
      var color = s.type === 'support' ? SUPPORT_COLOR : RESIST_COLOR;
      var label = s.type === 'support' ? '지지선' : '저항선';
      var srDash = s.solid ? '' : ' stroke-dasharray="4 3"';
      var srWidth = s.solid ? 2 : 1.4;
      parts.push(
        '<line x1="',
        s.x1,
        '" y1="',
        s.y,
        '" x2="',
        s.x2,
        '" y2="',
        s.y,
        '" stroke="',
        color,
        '" stroke-width="',
        srWidth,
        '"',
        srDash,
        '/>'
      );
      if (!s.hideLabel) {
        parts.push(
          '<text x="',
          s.x2 - 2,
          '" y="',
          s.y - 4,
          '" font-size="8" fill="',
          color,
          '" text-anchor="end" font-family="Pretendard,sans-serif">',
          label,
          '</text>'
        );
      }
    });

    (config.trends || []).forEach(function (t) {
      var trendDash = t.solid ? '' : ' stroke-dasharray="4 3"';
      var trendWidth = t.solid ? 2 : 1.4;
      parts.push(
        '<line x1="',
        t.x1,
        '" y1="',
        t.y1,
        '" x2="',
        t.x2,
        '" y2="',
        t.y2,
        '" stroke="',
        t.color || '#90a4ae',
        '" stroke-width="',
        trendWidth,
        '"',
        trendDash,
        '/>'
      );
    });

    (config.trendLabels || []).forEach(function (l) {
      parts.push(
        '<text x="',
        l.x,
        '" y="',
        l.y,
        '" font-size="8" fill="',
        l.color || '#90a4ae',
        '" font-family="Pretendard,sans-serif">',
        l.text,
        '</text>'
      );
    });

    (config.outlines || []).forEach(function (o) {
      var outlineDash = o.solid ? '' : ' stroke-dasharray="5 4"';
      parts.push(
        '<path d="',
        o.d,
        '" fill="none" stroke="',
        o.color || mainColor,
        '" stroke-width="',
        o.w || 2.2,
        '" stroke-opacity="',
        o.opacity == null ? 0.38 : o.opacity,
        '" stroke-linecap="round" stroke-linejoin="round"',
        outlineDash,
        '/>'
      );
    });

    var allPaths = config.paths || [];
    var auxPaths = [];
    var pricePaths = [];
    allPaths.forEach(function (p) {
      if (pathRole(p) === 'price') pricePaths.push(p);
      else auxPaths.push(p);
    });

    auxPaths.forEach(function (p) {
      renderPath(parts, p, mainColor, markerId, false);
    });

    pricePaths.forEach(function (p, i) {
      var useArrow = p.arrow || (config.arrowOnLast && i === pricePaths.length - 1);
      renderPath(parts, p, mainColor, markerId, useArrow);
    });

    (config.touchDots || []).forEach(function (d) {
      parts.push(
        '<circle cx="',
        d.x,
        '" cy="',
        d.y,
        '" r="',
        d.r || 2.5,
        '" fill="',
        d.color || mainColor,
        '" opacity="',
        d.opacity == null ? 0.9 : d.opacity,
        '"/>'
      );
    });

    (config.labels || []).forEach(function (l) {
      parts.push(
        '<text x="',
        l.x,
        '" y="',
        l.y,
        '" font-size="8" fill="',
        l.color || '#8a9e94',
        '" font-family="Pretendard,sans-serif">',
        l.text,
        '</text>'
      );
    });

    return (
      '<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      parts.join('') +
      '</svg>'
    );
  }

  function svgWrap(paths, lines, extras) {
    var lineStr = (lines || [])
      .map(function (l) {
        return (
          '<line x1="' +
          l.x1 +
          '" y1="' +
          l.y1 +
          '" x2="' +
          l.x2 +
          '" y2="' +
          l.y2 +
          '" stroke="' +
          (l.color || '#333') +
          '" stroke-width="' +
          (l.w || 1.5) +
          '" stroke-dasharray="' +
          (l.dash || '') +
          '"/>'
        );
      })
      .join('');
    var pathStr = (paths || [])
      .map(function (p) {
        return (
          '<path d="' +
          p.d +
          '" fill="none" stroke="' +
          (p.color || '#111') +
          '" stroke-width="' +
          (p.w || 2) +
          '"/>'
        );
      })
      .join('');
    return (
      '<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      lineStr +
      pathStr +
      (extras || '') +
      '</svg>'
    );
  }

  var PATTERNS = [
    {
      id: 'ascending-triangle',
      name: '상승삼각형',
      category: 'bullish',
      summary: '고점은 비슷하고 저점이 올라가는 수렴',
      detail:
        '고점이 수평 저항선에 막히고 저점은 점점 높아지는 패턴이에요. 매수세가 점차 강해지는 모습으로, 상단 돌파 시 상승을 기대하는 경우가 많아요.',
      tip: '거래량이 돌파 때 함께 늘었는지 확인해 보세요.',
      svg: patternCardSvg('ascending-triangle', 'bullish', {
        silhouettes: [{ d: 'M18,74 L118,30 L18,30 Z', fillOpacity: 0.14 }],
        sr: [{ type: 'resistance', y: 30, x1: 18, x2: 118, solid: false }],
        trends: [{ x1: 18, y1: 74, x2: 118, y2: 30, color: SUPPORT_COLOR, solid: false }],
        trendLabels: [{ x: 16, y: 78, text: '지지선', color: SUPPORT_COLOR }],
        paths: [
          {
            role: 'price',
            d: 'M10,52 L26,30 L38,65 L58,30 L78,48 L98,30 L114,30 L136,8',
            arrow: true,
            w: 3,
          },
        ],
        touchDots: [
          { x: 26, y: 30 },
          { x: 38, y: 65 },
          { x: 58, y: 30 },
          { x: 78, y: 48 },
          { x: 98, y: 30 },
        ],
      }),
    },
    {
      id: 'bullish-flag',
      name: '상승플래그',
      category: 'bullish',
      summary: '급등 뒤 짧은 조정 채널',
      detail:
        '강한 상승(깃대) 이후 하향 또는 횡보 채널에서 쉬어 가는 모양이에요. 조정이 끝나고 이전 추세가 이어질 수 있다고 봐요.',
      tip: '깃대 구간의 거래량이 풍부했는지 같이 보면 좋아요.',
      svg: patternCardSvg('bullish-flag', 'bullish', {
        fills: [{ points: '36,24 146,14 146,46 36,36', opacity: 0.08 }],
        trends: [
          { x1: 36, y1: 24, x2: 146, y2: 14, color: '#333', solid: true },
          { x1: 36, y1: 36, x2: 146, y2: 46, color: '#333', solid: true },
        ],
        paths: [
          { role: 'pole', d: 'M12,78 L36,24', w: 3 },
          { role: 'price', d: 'M36,24 L56,36 L76,28 L96,38 L116,30 L142,16', arrow: true, w: 3 },
        ],
        touchDots: [
          { x: 56, y: 36 },
          { x: 96, y: 38 },
        ],
      }),
    },
    {
      id: 'cup-handle',
      name: '컵 앤 핸들',
      category: 'bullish',
      summary: 'U자 바닥 뒤 짧은 눌림',
      detail:
        '가격이 U자 형태로 바닥을 다지고, 오른쪽에서 작은 핸들(조정)을 만든 뒤 재상승하는 패턴이에요. 중기 상승 전환 신호로 자주 소개돼요.',
      tip: '컵의 깊이가 너무 깊지 않을 때 신뢰도를 높게 보는 편이에요.',
      svg: patternCardSvg('cup-handle', 'bullish', {
        sr: [{ type: 'support', y: 70, x1: 16, x2: 108, solid: true }],
        outlines: [{ d: 'M16,38 Q42,72 68,38 Q94,22 108,34 L108,52', solid: true, w: 2.2 }],
        paths: [
          { role: 'price', d: 'M16,38 Q42,72 68,38 Q94,22 108,34 L108,52 L142,16', arrow: true, w: 3 },
        ],
        labels: [
          { x: 48, y: 76, text: '컵' },
          { x: 102, y: 58, text: '핸들' },
        ],
        touchDots: [{ x: 68, y: 70 }, { x: 108, y: 52 }],
      }),
    },
    {
      id: 'double-bottom',
      name: '쌍바닥',
      category: 'bullish-reversal',
      summary: '비슷한 저점 두 번 후 반등',
      detail:
        '하락 추세 끝에서 비슷한 가격대에 두 번 지지를 받고 올라가는 W자 패턴이에요. 넥라인 돌파 시 추세 반전을 기대할 수 있어요.',
      tip: '두 바닥 사이 반등 고점(넥라인)을 함께 표시해 보세요.',
      svg: patternCardSvg('double-bottom', 'bullish-reversal', {
        sr: [
          { type: 'support', y: 68, x1: 18, x2: 104, solid: true },
          { type: 'resistance', y: 36, x1: 18, x2: 128, hideLabel: true, solid: true },
        ],
        trendLabels: [{ x: 16, y: 32, text: '넥라인', color: RESIST_COLOR }],
        outlines: [{ d: 'M20,36 L42,68 L62,36 L82,68 L102,36', solid: true, w: 2.2 }],
        paths: [
          { role: 'price', d: 'M18,36 L42,68 L62,36 L82,68 L102,36 L140,12', arrow: true, w: 3 },
        ],
        labels: [
          { x: 34, y: 76, text: '바닥' },
          { x: 74, y: 76, text: '바닥' },
        ],
        touchDots: [
          { x: 42, y: 68 },
          { x: 82, y: 68 },
          { x: 62, y: 36 },
        ],
      }),
    },
    {
      id: 'inverse-hs',
      name: '역 헤드앤숄더',
      category: 'bullish-reversal',
      summary: '세 번째 저점이 가장 깊은 반전',
      detail:
        '왼어깨·머리·오른어깨 형태가 거꾸로 나타나는 패턴이에요. 하락이 멈추고 상승으로 전환될 수 있다는 신호로 봐요.',
      tip: '넥라인 돌파와 거래량 증가를 같이 확인하세요.',
      svg: patternCardSvg('inverse-hs', 'bullish-reversal', {
        fills: [{ points: '18,38 104,38 104,74 18,74', opacity: 0.06 }],
        silhouettes: [
          { d: 'M20,28 L40,50 L60,74 L80,50 L100,28 L100,74 L20,74 Z', fillOpacity: 0.16 },
        ],
        sr: [{ type: 'resistance', y: 38, x1: 18, x2: 128, hideLabel: true }],
        trendLabels: [{ x: 16, y: 34, text: '넥라인', color: RESIST_COLOR }],
        outlines: [{ d: 'M20,28 L40,50 L60,74 L80,50 L100,28' }],
        paths: [{ role: 'price', d: 'M20,28 L40,50 L60,74 L80,50 L100,28 L146,14', arrow: true }],
        labels: [
          { x: 36, y: 56, text: '어깨' },
          { x: 56, y: 82, text: '머리' },
          { x: 78, y: 56, text: '어깨' },
        ],
        touchDots: [
          { x: 40, y: 50 },
          { x: 60, y: 74 },
          { x: 80, y: 50 },
        ],
      }),
    },
    {
      id: 'falling-wedge',
      name: '하락쐐기',
      category: 'bullish-reversal',
      summary: '하락하며 좁아지는 쐐기',
      detail:
        '고점과 저점이 모두 낮아지지만 범위가 줄어드는 패턴이에요. 매도 압력이 약해지며 상승 반전이 나올 수 있어요.',
      tip: '상단 추세선 돌파 여부를 관찰해 보세요.',
      svg: patternCardSvg('falling-wedge', 'bullish-reversal', {
        fills: [{ points: '18,22 128,48 18,58', opacity: 0.08 }],
        trends: [
          { x1: 18, y1: 22, x2: 128, y2: 48, color: '#333', solid: true },
          { x1: 18, y1: 58, x2: 128, y2: 48, color: '#333', solid: true },
        ],
        trendLabels: [
          { x: 16, y: 20, text: '하단선', color: RESIST_COLOR },
          { x: 16, y: 64, text: '상단선', color: SUPPORT_COLOR },
        ],
        paths: [{ role: 'price', d: 'M22,24 L48,44 L72,50 L96,46 L122,48 L146,22', arrow: true }],
        touchDots: [
          { x: 48, y: 48 },
          { x: 78, y: 52 },
        ],
      }),
    },
    {
      id: 'descending-triangle',
      name: '하락삼각형',
      category: 'bearish',
      summary: '저점은 비슷하고 고점이 낮아짐',
      detail:
        '저점이 수평 지지에 닿고 고점만 낮아지는 패턴이에요. 매도 우위가 강해지는 모습으로, 하단 이탈 시 추가 하락을 경계해요.',
      tip: '지지선 이탈 시 손절 기준을 미리 정해 두면 좋아요.',
      svg: patternCardSvg('descending-triangle', 'bearish', {
        silhouettes: [{ d: 'M18,28 L118,68 L18,68 Z', color: BEAR_LINE, fillOpacity: 0.14 }],
        sr: [{ type: 'support', y: 68, x1: 18, x2: 118, solid: false }],
        trends: [{ x1: 18, y1: 28, x2: 118, y2: 68, color: RESIST_COLOR, solid: false }],
        trendLabels: [{ x: 16, y: 24, text: '저항선', color: RESIST_COLOR }],
        paths: [
          {
            role: 'price',
            d: 'M10,42 L28,32 L40,68 L48,40 L62,68 L68,48 L88,56 L100,68 L112,64 L136,86',
            arrow: true,
            w: 3,
          },
        ],
        touchDots: [
          { x: 28, y: 32 },
          { x: 48, y: 40 },
          { x: 40, y: 68 },
          { x: 62, y: 68 },
          { x: 68, y: 48 },
          { x: 88, y: 56 },
          { x: 100, y: 68 },
        ],
      }),
    },
    {
      id: 'bearish-flag',
      name: '하락플래그',
      category: 'bearish',
      summary: '급락 뒤 짧은 반등 채널',
      detail:
        '급락(깃대) 이후 위쪽으로 기울어진 짧은 채널에서 반등하는 패턴이에요. 조정 후 하락 추세가 이어질 수 있어요.',
      tip: '반등 시 거래량이 줄었는지 확인해 보세요.',
      svg: patternCardSvg('bearish-flag', 'bearish', {
        fills: [{ points: '36,66 146,56 146,36 36,46', color: BEAR_LINE, opacity: 0.08 }],
        trends: [
          { x1: 36, y1: 46, x2: 146, y2: 36, color: '#333', solid: true },
          { x1: 36, y1: 66, x2: 146, y2: 56, color: '#333', solid: true },
        ],
        paths: [
          { role: 'pole', d: 'M12,22 L36,66', w: 3 },
          { role: 'price', d: 'M36,66 L56,46 L76,56 L96,46 L116,54 L142,76', arrow: true, w: 3 },
        ],
        touchDots: [
          { x: 56, y: 46 },
          { x: 96, y: 46 },
        ],
      }),
    },
    {
      id: 'rising-wedge',
      name: '상승쐐기',
      category: 'bearish',
      summary: '상승하며 좁아지는 쐐기',
      detail:
        '고점과 저점이 모두 올라가지만 폭이 줄어드는 패턴이에요. 상승 탄력이 약해지며 하락 전환 신호로 보기도 해요.',
      tip: '하단 추세선 이탈에 주목해 보세요.',
      svg: patternCardSvg('rising-wedge', 'bearish', {
        fills: [{ points: '18,68 128,42 18,28', color: BEAR_LINE, opacity: 0.08 }],
        trends: [
          { x1: 18, y1: 68, x2: 128, y2: 42, color: '#333', solid: true },
          { x1: 18, y1: 28, x2: 128, y2: 42, color: '#333', solid: true },
        ],
        trendLabels: [
          { x: 16, y: 66, text: '하단선', color: SUPPORT_COLOR },
          { x: 16, y: 10, text: '상단선', color: RESIST_COLOR },
        ],
        paths: [{ role: 'price', d: 'M22,64 L48,48 L72,36 L96,40 L122,42 L146,70', arrow: true }],
        touchDots: [
          { x: 48, y: 42 },
          { x: 78, y: 28 },
        ],
      }),
    },
    {
      id: 'double-top',
      name: '쌍봉',
      category: 'bearish-reversal',
      summary: '비슷한 고점 두 번 후 하락',
      detail:
        '상승 추세 끝에서 비슷한 고점을 두 번 찍고 내려오는 M자 패턴이에요. 넥라인 이탈 시 하락 반전을 기대할 수 있어요.',
      tip: '두 봉우리 높이가 비슷한지 비교해 보세요.',
      svg: patternCardSvg('double-top', 'bearish-reversal', {
        fills: [{ points: '18,30 104,30 104,54 18,54', opacity: 0.06 }],
        silhouettes: [
          { d: 'M20,58 L40,30 L60,54 L80,30 L100,54 L100,30 L20,30 Z', fillOpacity: 0.16, color: BEAR_LINE },
        ],
        sr: [
          { type: 'resistance', y: 30, x1: 18, x2: 104, hideLabel: true },
          { type: 'support', y: 54, x1: 18, x2: 128, hideLabel: true },
        ],
        trendLabels: [{ x: 16, y: 50, text: '넥라인', color: SUPPORT_COLOR }],
        outlines: [{ d: 'M20,58 L40,30 L60,54 L80,30 L100,54', color: BEAR_LINE }],
        paths: [{ role: 'price', d: 'M20,58 L40,30 L60,54 L80,30 L100,54 L146,80', arrow: true }],
        labels: [
          { x: 36, y: 24, text: '봉우리' },
          { x: 76, y: 24, text: '봉우리' },
        ],
        touchDots: [
          { x: 40, y: 30 },
          { x: 80, y: 30 },
          { x: 60, y: 54 },
          { x: 100, y: 54 },
        ],
      }),
    },
    {
      id: 'head-shoulders',
      name: '헤드앤숄더',
      category: 'bearish-reversal',
      summary: '가운데 봉우리가 가장 높은 반전',
      detail:
        '왼어깨·머리·오른어깨로 이어지는 패턴이에요. 상승 추세의 종말 신호로 알려져 있고, 넥라인 이탈이 핵심 포인트예요.',
      tip: '오른어깨가 왼어깨보다 낮게 나오는 경우가 많아요.',
      svg: patternCardSvg('head-shoulders', 'bearish-reversal', {
        fills: [{ points: '18,40 104,40 104,58 18,58', opacity: 0.06, color: BEAR_LINE }],
        silhouettes: [
          { d: 'M20,58 L40,40 L60,14 L80,40 L100,58 L100,40 L20,40 Z', fillOpacity: 0.16, color: BEAR_LINE },
        ],
        sr: [{ type: 'support', y: 40, x1: 18, x2: 128, hideLabel: true }],
        trendLabels: [{ x: 16, y: 44, text: '넥라인', color: SUPPORT_COLOR }],
        outlines: [{ d: 'M20,58 L40,40 L60,14 L80,40 L100,58', color: BEAR_LINE }],
        paths: [{ role: 'price', d: 'M20,58 L40,40 L60,14 L80,40 L100,58 L146,82', arrow: true }],
        labels: [
          { x: 36, y: 44, text: '어깨' },
          { x: 56, y: 10, text: '머리' },
          { x: 78, y: 44, text: '어깨' },
        ],
        touchDots: [
          { x: 40, y: 40 },
          { x: 60, y: 14 },
          { x: 80, y: 40 },
        ],
      }),
    },
    {
      id: 'symmetrical-triangle',
      name: '삼각수렴',
      category: 'bearish-reversal',
      badgeLabel: '중립',
      badgeTone: 'neutral',
      summary: '고점↓ 저점↑으로 좁아짐',
      detail:
        '고점은 낮아지고 저점은 높아지며 가격 범위가 줄어드는 패턴이에요. 방향은 돌파 쪽에 따라 결정된다고 봐요.',
      tip: '돌파 방향과 거래량을 함께 보는 습관이 중요해요.',
      svg: patternCardSvg('symmetrical-triangle', 'neutral', {
        neutral: true,
        silhouettes: [{ d: 'M18,26 L124,50 L18,70 Z', color: NEUTRAL_LINE, fillOpacity: 0.14 }],
        outlines: [{ d: 'M18,26 L124,50 L18,70 Z', color: NEUTRAL_LINE, solid: true, w: 2 }],
        trends: [
          { x1: 18, y1: 26, x2: 124, y2: 50, color: RESIST_COLOR, solid: false },
          { x1: 18, y1: 70, x2: 124, y2: 50, color: SUPPORT_COLOR, solid: false },
        ],
        trendLabels: [
          { x: 20, y: 22, text: '상단선', color: RESIST_COLOR },
          { x: 20, y: 74, text: '하단선', color: SUPPORT_COLOR },
        ],
        paths: [
          {
            role: 'price',
            d: 'M22,30 L42,46 L62,38 L82,46 L102,38 L118,48 L124,50 L146,26',
            arrow: true,
          },
        ],
        touchDots: [
          { x: 42, y: 46 },
          { x: 62, y: 38 },
          { x: 82, y: 46 },
          { x: 102, y: 38 },
        ],
      }),
    },
  ];

  var SR_BADGE = {
    basic: { bg: '#e8f7ee', text: '#1e7a45', label: '기본', tone: 'sr-basic' },
    trend: { bg: '#e3f2fd', text: '#1565c0', label: '추세선', tone: 'sr-trend' },
    price: { bg: '#f3e8fd', text: '#7b1fa2', label: '가격기반', tone: 'sr-price' },
    range: { bg: '#fff8e1', text: '#e65100', label: '구간', tone: 'sr-range' },
    ma: { bg: '#e8eaf6', text: '#3949ab', label: '이평선', tone: 'sr-ma' },
    flip: { bg: '#f0f2f1', text: '#5f6f66', label: '전환', tone: 'sr-flip' },
  };

  var MA_BADGE = {
    basic: { bg: '#e8f7ee', text: '#1e7a45', label: '기본', tone: 'ma-basic' },
    buy: { bg: '#e3f2fd', text: '#1565c0', label: '매수 신호', tone: 'ma-buy' },
    sell: { bg: '#fdecea', text: '#c62828', label: '매도 신호', tone: 'ma-sell' },
    uptrend: { bg: '#e8f7ee', text: '#1e7a45', label: '상승 추세', tone: 'ma-uptrend' },
    downtrend: { bg: '#fdecea', text: '#c62828', label: '하락 추세', tone: 'ma-downtrend' },
    apply: { bg: '#e3f2fd', text: '#1565c0', label: '활용', tone: 'ma-apply' },
  };

  function eduCardSvg(cardId, tone, config) {
    return patternCardSvg(cardId, tone, config);
  }

  var SUPPORT_RESISTANCE = [
    {
      id: 'horizontal-support',
      title: '수평 지지선',
      badgeType: 'basic',
      summary: '같은 가격대에서 여러 번 반등하는 수평 바닥',
      detail:
        '가격이 특정 수준까지 내려올 때마다 매수세가 들어와 반등하는 수평 지지선이에요. 여러 번 테스트된 지지는 심리적으로 더 강한 바닥으로 인식되는 경우가 많아요.',
      tip: '지지선이 깨졌다가 다시 올라오면, 그 선이 여전히 유효한지 거래량과 함께 확인해 보세요.',
      svg: eduCardSvg('sr-h-support', 'bullish', {
        sr: [{ type: 'support', y: 66, x1: 14, x2: 146, solid: true }],
        paths: [
          { role: 'price', d: 'M14,40 L38,66 L58,46 L78,66 L98,46 L118,66 L146,22', arrow: true, w: 3 },
        ],
        touchDots: [
          { x: 38, y: 66 },
          { x: 78, y: 66 },
          { x: 118, y: 66 },
        ],
      }),
    },
    {
      id: 'horizontal-resistance',
      title: '수평 저항선',
      badgeType: 'basic',
      summary: '같은 가격대에서 여러 번 막히는 수평 천장',
      detail:
        '가격이 같은 가격대에 닿을 때마다 매도 압력으로 막히는 수평 저항선이에요. 여러 번 막힌 구간은 돌파 시 강한 상승 또는 재차 저항으로 작용할 수 있어요.',
      tip: '저항선 돌파 후 다시 내려오면, 그 가격대가 지지로 바뀌었는지(SR FLIP) 살펴보세요.',
      svg: eduCardSvg('sr-h-resist', 'bearish', {
        sr: [{ type: 'resistance', y: 34, x1: 14, x2: 146, solid: true }],
        paths: [
          { role: 'price', d: 'M14,60 L38,34 L58,54 L78,34 L98,54 L118,34 L146,78', arrow: true, w: 3 },
        ],
        touchDots: [
          { x: 38, y: 34 },
          { x: 78, y: 34 },
          { x: 118, y: 34 },
        ],
      }),
    },
    {
      id: 'uptrend',
      title: '상승 추세선',
      badgeType: 'trend',
      summary: '저점이 높아지며 이어지는 대각 지지 추세',
      detail:
        '저점을 연결한 대각선이 상승 방향으로 이어지는 추세 지지선이에요. 가격이 이 선 위에서 움직이면 상승 추세가 유지된다고 보는 경우가 많아요.',
      tip: '저점이 최소 두 번 이상 선에 닿았는지 확인하면 추세선 신뢰도를 높일 수 있어요.',
      svg: eduCardSvg('sr-uptrend', 'bullish', {
        trends: [
          { x1: 14, y1: 72, x2: 146, y2: 28, color: SUPPORT_COLOR, solid: true },
          { x1: 14, y1: 50, x2: 146, y2: 6, color: RESIST_COLOR, solid: true },
        ],
        trendLabels: [
          { x: 16, y: 78, text: '지지', color: SUPPORT_COLOR },
          { x: 16, y: 8, text: '저항', color: RESIST_COLOR },
        ],
        paths: [
          { role: 'price', d: 'M14,62 L34,50 L54,58 L74,42 L94,50 L114,36 L146,12', arrow: true, w: 3 },
        ],
        touchDots: [
          { x: 34, y: 50 },
          { x: 54, y: 58 },
          { x: 74, y: 42 },
          { x: 94, y: 50 },
        ],
      }),
    },
    {
      id: 'downtrend',
      title: '하락 추세선',
      badgeType: 'trend',
      summary: '고점이 낮아지며 이어지는 대각 저항 추세',
      detail:
        '고점을 연결한 대각선이 하락 방향으로 이어지는 추세 저항선이에요. 가격이 이 선 아래에서 움직이면 하락 추세가 이어진다고 보는 경우가 많아요.',
      tip: '고점이 선에 여러 번 닿았는지, 이탈 시 거래량이 늘었는지 함께 확인해 보세요.',
      svg: eduCardSvg('sr-downtrend', 'bearish', {
        trends: [
          { x1: 14, y1: 28, x2: 146, y2: 72, color: RESIST_COLOR, solid: true },
          { x1: 14, y1: 50, x2: 146, y2: 94, color: SUPPORT_COLOR, solid: true },
        ],
        trendLabels: [
          { x: 16, y: 24, text: '저항', color: RESIST_COLOR },
          { x: 16, y: 96, text: '지지', color: SUPPORT_COLOR },
        ],
        paths: [
          { role: 'price', d: 'M14,34 L34,48 L54,40 L74,54 L94,44 L114,58 L146,82', arrow: true, w: 3 },
        ],
        touchDots: [
          { x: 34, y: 48 },
          { x: 54, y: 40 },
          { x: 74, y: 54 },
          { x: 94, y: 44 },
        ],
      }),
    },
    {
      id: 'prev-high',
      title: '이전 고점 저항',
      badgeType: 'price',
      summary: '과거 고점이 새로운 저항선이 되는 경우',
      detail:
        '이전에 형성된 고점 가격대가 이후 차트에서 다시 저항으로 작용하는 패턴이에요. 과거에 매도가 몰렸던 구간은 심리적 저항이 될 수 있어요.',
      tip: '고점이 한 번이 아니라 여러 번 형성된 구간일수록 저항으로 더 강하게 인식되는 편이에요.',
      svg: eduCardSvg('sr-prev-high', 'bearish', {
        sr: [{ type: 'resistance', y: 34, x1: 14, x2: 146 }],
        paths: [
          { role: 'price', d: 'M14,58 L46,34 L74,58 L104,34 L146,68', arrow: true },
        ],
        labels: [{ x: 42, y: 30, text: '이전 고점' }],
        touchDots: [
          { x: 46, y: 34 },
          { x: 104, y: 34 },
        ],
      }),
    },
    {
      id: 'prev-low',
      title: '이전 저점 지지',
      badgeType: 'price',
      summary: '과거 저점이 새로운 지지선이 되는 경우',
      detail:
        '이전에 형성된 저점 가격대가 이후 차트에서 다시 지지로 작용하는 패턴이에요. 과거에 매수가 들어왔던 구간은 심리적 지지가 될 수 있어요.',
      tip: '저점에서 반등했던 거래량이 컸는지 함께 보면 지지 강도를 가늠하는 데 도움이 돼요.',
      svg: eduCardSvg('sr-prev-low', 'bullish', {
        sr: [{ type: 'support', y: 66, x1: 14, x2: 146 }],
        paths: [
          { role: 'price', d: 'M14,28 L46,66 L74,42 L104,66 L146,20', arrow: true },
        ],
        labels: [{ x: 42, y: 74, text: '이전 저점' }],
        touchDots: [
          { x: 46, y: 66 },
          { x: 104, y: 66 },
        ],
      }),
    },
    {
      id: 'range',
      title: '박스권',
      badgeType: 'range',
      summary: '위는 저항, 아래는 지지인 횡보 구간',
      detail:
        '가격이 일정 범위 안에서 오르내리며 방향을 못 정하는 횡보 구간이에요. 위쪽은 저항, 아래쪽은 지지로 읽고 돌파 방향을 주시해요.',
      tip: '박스권에서 위·아래를 여러 번 왕복했다면, 돌파 시 변동성이 커질 수 있어요.',
      svg: eduCardSvg('sr-range', 'neutral', {
        neutral: true,
        fills: [{ points: '14,36 146,36 146,64 14,64', color: NEUTRAL_LINE, opacity: 0.06 }],
        sr: [
          { type: 'resistance', y: 36, x1: 14, x2: 146, solid: true },
          { type: 'support', y: 64, x1: 14, x2: 146, solid: true },
        ],
        paths: [
          {
            role: 'price',
            d: 'M14,50 L30,64 L50,36 L70,64 L90,36 L110,64 L130,36 L146,50',
            w: 3,
          },
        ],
        touchDots: [
          { x: 30, y: 64 },
          { x: 50, y: 36 },
          { x: 70, y: 64 },
          { x: 90, y: 36 },
          { x: 110, y: 64 },
          { x: 130, y: 36 },
        ],
      }),
    },
    {
      id: 'ma-sr',
      title: '이평선 지지·저항',
      badgeType: 'ma',
      summary: '이동평균선이 가격의 지지·저항 역할을 하는 경우',
      detail:
        '이동평균선 자체가 지지선이나 저항선처럼 작용하는 경우예요. 상승 추세에서는 이평선이 지지, 하락 추세에서는 저항으로 자주 활용돼요.',
      tip: '20일·60일 이평선처럼 많이 쓰는 기간일수록 지지·저항 역할이 뚜렷한 경우가 많아요.',
      svg: eduCardSvg('sr-ma', 'bullish', {
        paths: [
          { role: 'ma', d: 'M14,58 L146,40', color: '#f57c00', w: 2.5 },
          { role: 'price', d: 'M14,46 L38,40 L64,48 L90,40 L116,48 L146,18', arrow: true, w: 3 },
        ],
        labels: [{ x: 128, y: 36, text: 'MA20' }],
        touchDots: [
          { x: 38, y: 40, r: 3 },
          { x: 90, y: 40, r: 3 },
          { x: 116, y: 48, r: 3 },
        ],
      }),
    },
    {
      id: 'sr-flip',
      title: 'SR FLIP',
      badgeType: 'flip',
      summary: '깨진 지지선이 이후 저항선으로 바뀌는 전환',
      detail:
        '지지선이 깨진 뒤 가격이 다시 그 가격대까지 올라왔을 때, 이전 지지가 저항으로 바뀌는 SR FLIP(전환) 개념이에요. 추세 전환을 읽는 데 자주 쓰여요.',
      tip: '깨진 지지선에서 반등이 약하고 거래량이 줄면, 저항 전환이 유효할 가능성이 높아요.',
      svg: eduCardSvg('sr-flip', 'bearish', {
        sr: [{ type: 'support', y: 50, x1: 14, x2: 80, hideLabel: true }],
        trends: [{ x1: 80, y1: 50, x2: 146, y2: 50, color: RESIST_COLOR }],
        trendLabels: [{ x: 16, y: 44, text: '저항선', color: RESIST_COLOR }],
        paths: [
          { role: 'price', d: 'M14,30 L40,50 L64,36 L88,50 L112,50 L146,72', arrow: true },
        ],
        labels: [{ x: 28, y: 58, text: '지지' }],
        touchDots: [
          { x: 40, y: 50 },
          { x: 88, y: 50 },
          { x: 112, y: 50 },
        ],
      }),
    },
  ];

  var MOVING_AVERAGES = [
    {
      id: 'ma5',
      title: '5일 이동평균선',
      badgeType: 'basic',
      summary: '단기 추세를 빠르게 반영하는 초단기 이평',
      detail:
        '최근 5일 종가의 평균을 이은 선이에요. 가격 변화에 민감하게 반응해 단기 추세를 빠르게 보여 주지만, 잦은 꺾임(노이즈)도 함께 나타날 수 있어요.',
      tip: '단기 매매 감각을 익힐 때 참고하되, 신호만으로 판단하지 말고 추세 전체를 함께 보세요.',
      svg: eduCardSvg('ma5', 'bullish', {
        paths: [
          { role: 'ma', d: 'M14,54 L146,34', color: '#9c27b0', w: 2 },
          { role: 'price', d: 'M14,48 L40,36 L66,44 L92,32 L118,40 L146,18', arrow: true },
        ],
        labels: [{ x: 128, y: 30, text: 'MA5' }],
        touchDots: [{ x: 92, y: 32 }],
      }),
    },
    {
      id: 'ma20',
      title: '20일 이동평균선',
      badgeType: 'basic',
      summary: '단기 추세 확인에 자주 쓰는 기준선',
      detail:
        '최근 20일 종가의 평균을 이은 선으로, 단기 추세를 확인하는 데 가장 널리 쓰이는 이평선이에요. 지지·저항 역할도 자주 합니다.',
      tip: '20일선 위에서 가격이 유지되면 단기 상승 추세로 보는 경우가 많아요.',
      svg: eduCardSvg('ma20', 'bullish', {
        paths: [
          { role: 'ma', d: 'M14,52 L146,36', color: '#f57c00', w: 2 },
          { role: 'price', d: 'M14,46 L42,34 L70,42 L98,30 L126,38 L146,20', arrow: true },
        ],
        labels: [{ x: 128, y: 32, text: 'MA20' }],
        touchDots: [{ x: 98, y: 30 }],
      }),
    },
    {
      id: 'ma60',
      title: '60일 이동평균선',
      badgeType: 'basic',
      summary: '중기 추세를 읽는 대표 이평선',
      detail:
        '최근 60일(약 3개월) 종가의 평균을 이은 선이에요. 중기 추세를 파악하는 기준선으로 많이 활용되며, 20일선과 함께 비교해 보는 경우가 많아요.',
      tip: '60일선을 돌파하거나 이탈할 때 추세 변화 신호로 보는 투자자도 많아요.',
      svg: eduCardSvg('ma60', 'bullish', {
        paths: [
          { role: 'ma', d: 'M14,50 L146,38', color: '#1e88e5', w: 2 },
          { role: 'price', d: 'M14,44 L42,32 L70,40 L98,28 L126,36 L146,18', arrow: true },
        ],
        labels: [{ x: 128, y: 34, text: 'MA60' }],
        touchDots: [{ x: 98, y: 28 }],
      }),
    },
    {
      id: 'ma120',
      title: '120일 이동평균선',
      badgeType: 'basic',
      summary: '장기 추세와 시장 방향을 보는 기준선',
      detail:
        '최근 120일(약 6개월) 종가의 평균을 이은 선이에요. 장기 추세와 시장의 큰 방향을 읽는 데 쓰이며, 변동이 상대적으로 완만해요.',
      tip: '120일선 아래에 오래 머물면 장기 약세, 위에 있으면 장기 강세로 해석하는 경우가 있어요.',
      svg: eduCardSvg('ma120', 'bullish', {
        paths: [
          { role: 'ma', d: 'M14,48 L146,40', color: '#3949ab', w: 2 },
          { role: 'price', d: 'M14,42 L42,30 L70,38 L98,26 L126,34 L146,16', arrow: true },
        ],
        labels: [{ x: 124, y: 36, text: 'MA120' }],
        touchDots: [{ x: 98, y: 26 }],
      }),
    },
    {
      id: 'golden-cross',
      title: '골든크로스',
      badgeType: 'buy',
      summary: '단기 이평이 장기 이평을 상향 돌파하는 매수 신호',
      detail:
        '단기 이동평균선이 장기 이동평균선을 아래에서 위로 뚫고 올라가는 교차 신호예요. 상승 전환 또는 매수 관심 구간으로 자주 언급돼요.',
      tip: '거래량이 함께 늘면 신호 신뢰도를 높게 보는 편이에요. 횡보장에서는 잦은 오신호가 나올 수 있어요.',
      svg: eduCardSvg('ma-golden', 'bullish', {
        paths: [
          { role: 'ma', d: 'M14,58 L70,50 L146,28', color: '#f57c00', w: 3 },
          { role: 'ma', d: 'M14,46 L70,50 L146,42', color: '#1e88e5', w: 1.5 },
          { role: 'price', d: 'M70,51 L92,36 L116,24', arrow: true, w: 3 },
        ],
        labels: [
          { x: 18, y: 60, text: '단기' },
          { x: 18, y: 48, text: '장기' },
        ],
        touchDots: [{ x: 70, y: 50, r: 4, color: '#f57c00' }],
      }),
    },
    {
      id: 'death-cross',
      title: '데드크로스',
      badgeType: 'sell',
      summary: '단기 이평이 장기 이평을 하향 이탈하는 매도 신호',
      detail:
        '단기 이동평균선이 장기 이동평균선을 위에서 아래로 뚫고 내려가는 교차 신호예요. 하락 전환 또는 매도 관심 구간으로 자주 언급돼요.',
      tip: '골든크로스와 마찬가지로, 추세가 뚜렷할 때 신호가 더 의미 있을 수 있어요.',
      svg: eduCardSvg('ma-death', 'bearish', {
        paths: [
          { role: 'ma', d: 'M14,28 L70,42 L146,62', color: '#f57c00', w: 3 },
          { role: 'ma', d: 'M14,44 L70,42 L146,48', color: '#1e88e5', w: 1.5 },
          { role: 'price', d: 'M70,40 L92,54 L116,66', arrow: true, w: 3 },
        ],
        labels: [
          { x: 18, y: 30, text: '단기' },
          { x: 18, y: 46, text: '장기' },
        ],
        touchDots: [{ x: 70, y: 42, r: 4, color: '#f57c00' }],
      }),
    },
    {
      id: 'alignment',
      title: '정배열',
      badgeType: 'uptrend',
      summary: '단기→장기 순으로 위에 쌓인 상승 추세 배열',
      detail:
        '단기 이평선이 중·장기 이평선 위에 순서대로 쌓인 상태예요. 가격과 이평선이 함께 위로 향하는 상승 추세에서 자주 나타나요.',
      tip: '정배열이 유지되는 동안은 추세 추종 관점에서 상승 흐름을 읽기 쉬워요.',
      svg: eduCardSvg('ma-align', 'bullish', {
        paths: [
          { role: 'ma', d: 'M14,52 L146,20', color: '#9c27b0', w: 3 },
          { role: 'ma', d: 'M14,60 L146,34', color: '#f57c00', w: 2 },
          { role: 'ma', d: 'M14,68 L146,48', color: '#1e88e5', w: 1.5 },
        ],
        labels: [
          { x: 16, y: 50, text: 'MA5' },
          { x: 16, y: 58, text: 'MA20' },
          { x: 16, y: 66, text: 'MA60' },
        ],
      }),
    },
    {
      id: 'reverse-alignment',
      title: '역배열',
      badgeType: 'downtrend',
      summary: '장기→단기 순으로 위에 쌓인 하락 추세 배열',
      detail:
        '장기 이평선이 단기 이평선 위에 있는 상태로, 가격과 이평선이 함께 아래로 향하는 하락 추세에서 자주 나타나요.',
      tip: '역배열이 이어지면 하락 압력이 강하다고 보는 경우가 많아요. 반등 시에도 장기 이평이 저항이 될 수 있어요.',
      svg: eduCardSvg('ma-reverse', 'bearish', {
        paths: [
          { role: 'ma', d: 'M14,24 L146,52', color: '#1e88e5', w: 1.5 },
          { role: 'ma', d: 'M14,36 L146,58', color: '#f57c00', w: 2 },
          { role: 'ma', d: 'M14,48 L146,68', color: '#9c27b0', w: 3 },
        ],
        labels: [
          { x: 16, y: 22, text: 'MA60' },
          { x: 16, y: 34, text: 'MA20' },
          { x: 16, y: 46, text: 'MA5' },
        ],
      }),
    },
    {
      id: 'ma-pullback',
      title: '이평 눌림목',
      badgeType: 'apply',
      summary: '상승 중 이평선까지 눌림 후 반등하는 활용 패턴',
      detail:
        '상승 추세 중 가격이 이동평균선까지 내려왔다가 다시 반등하는 눌림목 패턴이에요. 추세가 유지되는지 확인하는 데 활용할 수 있어요.',
      tip: '이평선에서 지지받고 거래량이 줄었다가 반등할 때, 추세 지속 신호로 보는 경우가 있어요.',
      svg: eduCardSvg('ma-pullback', 'bullish', {
        paths: [
          { role: 'ma', d: 'M14,58 L146,44', color: '#f57c00', w: 2.5 },
          { role: 'price', d: 'M14,66 L40,28 L68,48 L96,44 L122,50 L146,14', arrow: true, w: 3 },
        ],
        labels: [{ x: 92, y: 52, text: '눌림' }],
        touchDots: [
          { x: 68, y: 48, r: 3 },
          { x: 96, y: 44, r: 3 },
        ],
      }),
    },
  ];

  var MA_SVG = MOVING_AVERAGES[1].svg;

  var QUIZ_COUNT = 10;
  var QUIZ_OPTION_LABELS = ['①', '②', '③', '④'];

  var QUIZ_PROMPTS = {
    pattern: '다음 차트 패턴의 이름은 무엇일까요?',
    support: '다음 지지·저항 개념은 무엇일까요?',
    ma: '다음 이동평균선 개념은 무엇일까요?',
  };

  function buildQuizPool() {
    var pool = [];
    PATTERNS.forEach(function (p) {
      pool.push({
        kind: 'pattern',
        id: p.id,
        title: p.name,
        svg: p.svg,
        explanation: p.detail || p.summary || '',
      });
    });
    SUPPORT_RESISTANCE.forEach(function (s) {
      pool.push({
        kind: 'support',
        id: s.id,
        title: s.title,
        svg: s.svg,
        explanation: s.detail || s.summary || '',
      });
    });
    MOVING_AVERAGES.forEach(function (m) {
      pool.push({
        kind: 'ma',
        id: m.id,
        title: m.title,
        svg: m.svg,
        explanation: m.detail || m.summary || '',
      });
    });
    return pool;
  }

  var LUMI_SIDEBAR_TIP = '이제 실전 차트 패턴을 배워볼 시간이에요!';

  var TAB_META = {
    patterns: {
      title: '패턴 도감',
      subtitle: '대표적인 차트 패턴을 익히고 실전 감각을 키워 보세요.',
      lumiBubble: '패턴 이름만 외우기보다, 어떤 추세에서 자주 나오는지 같이 보면 좋아요!',
    },
    support: {
      title: '지지·저항',
      subtitle: '추세와 가격이 멈추는 구간을 읽는 기본기예요.',
      lumiBubble: '선 하나에 집착하지 말고, 가격이 여러 번 멈춘 구간을 찾아보세요.',
    },
    ma: {
      title: '이동평균선',
      subtitle: '추세를 한눈에 보는 대표 지표예요.',
      lumiBubble: '골든크로스만 보지 말고, 전체 배열(정배열/역배열)도 함께 확인해요.',
    },
    quiz: {
      title: '실전 퀴즈',
      subtitle: '차트를 보고 4지선다로 맞춰 보세요. 매번 랜덤 10문제가 나와요.',
      lumiBubble: '틀려도 괜찮아요! 해설 보면서 다시 도감을 살보면 돼요.',
    },
  };

  var LUMI_INTRO =
    '차트연구소는 패턴·지지·저항·이동평균을 차근차근 익히는 공간이에요. 부담 없이 하나씩 살펴보세요!';

  window.ChartLabData = {
    CATEGORY_LABELS: CATEGORY_LABELS,
    CATEGORY_COLORS: CATEGORY_COLORS,
    CATEGORY_BADGE: CATEGORY_BADGE,
    SR_BADGE: SR_BADGE,
    MA_BADGE: MA_BADGE,
    PATTERNS: PATTERNS,
    SUPPORT_RESISTANCE: SUPPORT_RESISTANCE,
    MOVING_AVERAGES: MOVING_AVERAGES,
    MA_SVG: MA_SVG,
    QUIZ_COUNT: QUIZ_COUNT,
    QUIZ_OPTION_LABELS: QUIZ_OPTION_LABELS,
    QUIZ_PROMPTS: QUIZ_PROMPTS,
    buildQuizPool: buildQuizPool,
    TAB_META: TAB_META,
    LUMI_SIDEBAR_TIP: LUMI_SIDEBAR_TIP,
    LUMI_INTRO: LUMI_INTRO,
    getPatternById: function (id) {
      for (var i = 0; i < PATTERNS.length; i++) {
        if (PATTERNS[i].id === id) return PATTERNS[i];
      }
      return null;
    },
    getSupportById: function (id) {
      for (var i = 0; i < SUPPORT_RESISTANCE.length; i++) {
        if (SUPPORT_RESISTANCE[i].id === id) return SUPPORT_RESISTANCE[i];
      }
      return null;
    },
    getMaById: function (id) {
      for (var i = 0; i < MOVING_AVERAGES.length; i++) {
        if (MOVING_AVERAGES[i].id === id) return MOVING_AVERAGES[i];
      }
      return null;
    },
  };
})();
