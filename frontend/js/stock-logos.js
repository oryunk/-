/**
 * 종목 로고: assets/stock-logos/{6자리}.png (market.html 과 동기)
 * simulation / market 등에서 공통 사용.
 */
(function () {
  var STOCK_LOGO_ASSET_VERSION = '20260512h';
  var STOCK_LOGO_NO_SQUAREISH_CODES = {
    '005930': true,
    '011170': true,
    '068270': true,
    '071050': true,
  };
  var STOCK_LOGO_FILE_CODES = new Set([
    '000080', '000100', '000250', '000270', '000660', '000720', '001040', '004020', '004370', '005380', '005490',
    '005930', '005940', '006800', '007310', '007660', '007810', '008060', '009410', '010130', '010950', '011170',
    '011200', '012330', '012510', '015760', '028300', '030200', '030520', '033780', '034020', '035420', '035720',
    '036570', '039200', '042670', '047040', '055550', '066570', '068270', '071050', '078930', '086790', '090430', '090460',
    '091160', '091700', '101400', '105560', '128940', '161390', '161890', '196170', '222800', '251270', '259960',
    '271560', '294870', '298380', '305720', '316140', '352820', '357880', '365550', '375500',
  ]);

  var STOCK_LOGO_ALIAS_TO_FILE = {
    '005935': '005930', '000810': '005930', '028260': '005930', '009150': '005930', '010140': '005930',
    '032830': '005930', '018260': '005930', '016360': '005930', '207940': '005930', '006400': '005930',
    '003550': '066570', '051910': '066570', '034220': '066570', '373220': '066570', '011070': '066570', '032640': '066570',
    '051900': '066570',
    '003670': '005490', '047050': '005490',
    '329180': '042670', '267250': '042670',
    '096770': '000660', '017670': '000660', '302440': '000660', '034730': '000660',
    '001740': '000660', '018670': '000660', '326030': '000660', '285130': '000660', '395400': '000660',
    '000150': '034020',
    '000120': '001040', '097950': '001040',
    '377300': '035720', '323410': '035720',
    '293940': '055550',
    '006360': '078930',
    '005300': '011170', '330590': '011170',
    '244580': '091160', '396500': '091160', '396510': '091160', '091170': '091160',
    '357870': '305720', '381170': '305720', '381180': '305720', '143860': '305720',
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
    return 'assets/stock-logos/' + fileCode + '.png?v=' + STOCK_LOGO_ASSET_VERSION;
  }

  function bindStockLogoIntrinsicFit(img) {
    if (!img || !img.classList.contains('stock-logo-img')) return;
    var run = function () {
      img.classList.remove('stock-logo-img--squareish');
      var fileCode = img.getAttribute('data-logo-file') || '';
      if (STOCK_LOGO_NO_SQUAREISH_CODES[fileCode]) return;
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
