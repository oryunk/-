/**
 * 백엔드 URL: 브라우저가 열린 호스트(localhost / 127.0.0.1)와 맞춰야
 * 세션 쿠키가 로그인·/api/auth/me·모의투자 API에 일관되게 전달된다.
 *
 * 문서를 Flask(:5000)에서 직접 열면(예: python app.py 후 /simulation.html)
 * origin과 API가 같아져 세션이 끊기지 않는다.
 * Live Server 등 :5500 + API :5000 조합은 크로스 오리진이라 쿠키가 안 붙을 수 있다.
 */
(function () {
  try {
    var loc = window.location;
    if (loc && loc.hostname && loc.protocol && loc.protocol !== 'file:') {
      if (String(loc.port) === '5000') {
        window.JURIN_API_BASE = loc.origin;
        return;
      }
      window.JURIN_API_BASE = loc.protocol + '//' + loc.hostname + ':5000';
      return;
    }
  } catch (e) { /* ignore */ }
  window.JURIN_API_BASE = 'http://localhost:5000';
})();

/**
 * 모의투자 페이지 전체 URL (file://·다른 포트에서도 API 호스트 :5000 기준으로 통일)
 */
(function () {
  function jurinSimulationUrl() {
    try {
      var base = window.JURIN_API_BASE || 'http://127.0.0.1:5000';
      return String(base).replace(/\/$/, '') + '/simulation.html';
    } catch (e) {
      return 'http://127.0.0.1:5000/simulation.html';
    }
  }
  window.jurinSimulationUrl = jurinSimulationUrl;

  function upgradeSimulationLinks() {
    var links = document.querySelectorAll('a.jurin-simulation-link');
    for (var i = 0; i < links.length; i++) {
      links[i].setAttribute('href', jurinSimulationUrl());
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', upgradeSimulationLinks);
  } else {
    upgradeSimulationLinks();
  }
})();
