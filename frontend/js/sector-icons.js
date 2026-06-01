/**
 * 관심섹터 아이콘 — 주요종목과 동일한 stock-logo-wrap / stock-logo-img 마크업
 */
(function (global) {
  const VERSION = '20260603';
  const BASE = 'assets/sector-icons';

  const ICON_FILE_BY_SECTOR = {
    'IT 및 기술': 'it-tech',
    '전기/전자': 'electronics',
    '금융': 'finance',
    '제조': 'manufacturing',
    '바이오/제약': 'bio-pharma',
    '소비재': 'consumer',
    '통신': 'telecom',
    '에너지': 'energy',
    '부동산': 'real-estate',
    '유통': 'distribution',
    '화학': 'chemical',
    '서비스': 'service',
    '지수ETF': 'index-etf',
    '섹터ETF': 'sector-etf',
    IT: 'it-tech',
    'IT & Tech': 'it-tech',
    Electronics: 'electronics',
    Finance: 'finance',
    Manufacturing: 'manufacturing',
    'Bio & Pharma': 'bio-pharma',
    'Bio & Health': 'bio-pharma',
    Consumer: 'consumer',
    Telecom: 'telecom',
    Energy: 'energy',
    'Real Estate': 'real-estate',
    Distribution: 'distribution',
    Chemicals: 'chemical',
    Services: 'service',
    'Index ETF': 'index-etf',
    'Sector ETF': 'sector-etf',
  };

  function fileForSector(name) {
    const key = String(name || '').trim();
    if (!key) return '';
    return ICON_FILE_BY_SECTOR[key] || '';
  }

  function urlFor(name) {
    const file = fileForSector(name);
    if (!file) return '';
    return `${BASE}/${file}.png?v=${VERSION}`;
  }

  /** @param {string} name @param {'detail'|'compact'} [variant] */
  function imgHtml(name, variant) {
    const url = urlFor(name);
    if (!url) return '';
    const wrapClass = variant === 'detail'
      ? 'stock-logo-wrap stock-logo-wrap--detail'
      : 'stock-logo-wrap';
    return (
      `<span class="${wrapClass}">` +
      `<img class="stock-logo-img" src="${url}" alt="" loading="lazy" decoding="async">` +
      '</span>'
    );
  }

  /** 종목 목록과 같은 가로 배치(로고 + 텍스트) */
  function cellHtml(name, label) {
    const icon = imgHtml(name);
    const text = String(label || name || '').trim();
    if (!icon) return `<span class="sector-btn-label">${text}</span>`;
    return `<span class="stock-cell-toss sector-btn-cell">${icon}<span class="sector-btn-label">${text}</span></span>`;
  }

  global.JurinSectorIcons = {
    VERSION,
    urlFor,
    imgHtml,
    cellHtml,
    fileForSector,
  };
})(typeof window !== 'undefined' ? window : globalThis);
