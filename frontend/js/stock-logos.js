/**
 * 종목 로고: assets/stock-logos/{6자리}.png (market.html 과 동기)
 * simulation / market 등에서 공통 사용.
 */
(function () {
  var STOCK_LOGO_FILE_CODES = new Set([
    '000100', '000270', '000660', '004020', '005380', '005490', '005930', '010130', '010950', '011170', '011200',
    '012330', '015760', '030200', '033780', '034020', '035420', '035720', '036570', '042670', '055550', '066570',
    '068270', '078930', '086790', '090430', '105560', '161390', '251270', '259960', '271560', '316140', '352820',
  ]);

  var STOCK_LOGO_ALIAS_TO_FILE = {
    '005935': '005930', '000810': '005930', '028260': '005930', '009150': '005930', '010140': '005930',
    '032830': '005930', '018260': '005930', '016360': '005930', '207940': '005930', '006400': '005930',
    '003550': '066570', '051910': '066570', '034220': '066570', '373220': '066570', '011070': '066570', '032640': '066570',
    '003670': '005490', '047050': '005490',
    '329180': '042670', '267250': '042670',
    '096770': '000660', '017670': '000660', '302440': '000660', '034730': '000660',
    '001740': '000660', '018670': '000660', '326030': '000660', '285130': '000660',
    '000150': '034020',
  };

  function resolveStockLogoFileCode(code) {
    var c = String(code || '').trim();
    if (!c || c.length !== 6) return '';
    var mapped = STOCK_LOGO_ALIAS_TO_FILE[c] || c;
    return STOCK_LOGO_FILE_CODES.has(mapped) ? mapped : '';
  }

  function stockLogoUrlForCode(code) {
    var fileCode = resolveStockLogoFileCode(code);
    if (!fileCode) return '';
    return 'assets/stock-logos/' + fileCode + '.png';
  }

  function bindStockLogoIntrinsicFit(img) {
    if (!img || !img.classList.contains('stock-logo-img')) return;
    var run = function () {
      img.classList.remove('stock-logo-img--squareish');
      if (img.getAttribute('data-logo-file') === '005930') return;
      var w = img.naturalWidth;
      var h = img.naturalHeight;
      if (!w || !h) return;
      var r = w / h;
      if (r >= 0.88 && r <= 1.14) img.classList.add('stock-logo-img--squareish');
    };
    if (img.complete && img.naturalWidth) run();
    else img.addEventListener('load', run, { once: true });
  }

  window.JurinStockLogos = {
    resolveStockLogoFileCode: resolveStockLogoFileCode,
    stockLogoUrlForCode: stockLogoUrlForCode,
    bindStockLogoIntrinsicFit: bindStockLogoIntrinsicFit,
  };
})();
