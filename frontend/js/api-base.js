/**
 * 파일: Flask API 베이스 URL·모의투자 링크 href 보정
 * 설명( 반드시 먼저 로드한다. window.JURIN_API_BASE 설정 후 jurinApiBase()로 읽는다. )
 *
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
      if (String(loc.port) === '5000' || loc.port === '' || loc.port === '80' || loc.port === '443') {
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
 * 현재 페이지 기준 API 오리진 (끝 슬래시 제거).
 * 설명( api-base IIFE 실행 뒤에만 호출할 것. file:// 등에서는 폴백 URL. )
 */
function jurinApiBase() {
  if (typeof window !== 'undefined' && window.JURIN_API_BASE) {
    return String(window.JURIN_API_BASE).replace(/\/$/, '');
  }
  return 'http://localhost:5000';
}

/** Google OAuth redirect_uri 와 동일 origin 으로 /start 이동 (localhost·127.0.0.1 세션 불일치 방지) */
var _googleOAuthApiOrigin = null;

function jurinGoogleOAuthStartUrl() {
  var base = _googleOAuthApiOrigin || jurinApiBase();
  return String(base).replace(/\/$/, '') + '/api/auth/google/start';
}

function jurinPrefetchGoogleOAuthOrigin() {
  if (_googleOAuthApiOrigin) {
    return Promise.resolve(_googleOAuthApiOrigin);
  }
  return fetch(jurinApiBase() + '/api/auth/google/status', { credentials: 'include' })
    .then(function (res) {
      return res.ok ? res.json() : {};
    })
    .then(function (data) {
      if (data && data.redirect_uri) {
        try {
          _googleOAuthApiOrigin = new URL(data.redirect_uri).origin;
          if (typeof window !== 'undefined') {
            window.JURIN_API_BASE = _googleOAuthApiOrigin;
          }
        } catch (e) { /* ignore */ }
      }
      return _googleOAuthApiOrigin || jurinApiBase();
    })
    .catch(function () {
      return jurinApiBase();
    });
}

function jurinNavigateGoogleOAuthStart(event) {
  if (event && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
  var topWin = window.top && window.top !== window ? window.top : window;
  jurinPrefetchGoogleOAuthOrigin().then(function () {
    topWin.location.href = jurinGoogleOAuthStartUrl();
  });
}

if (typeof window !== 'undefined') {
  window.jurinGoogleOAuthStartUrl = jurinGoogleOAuthStartUrl;
  window.jurinPrefetchGoogleOAuthOrigin = jurinPrefetchGoogleOAuthOrigin;
  window.jurinNavigateGoogleOAuthStart = jurinNavigateGoogleOAuthStart;
  jurinPrefetchGoogleOAuthOrigin();
}

/**
 * 모의투자 페이지 전체 URL (file://·다른 포트에서도 API 호스트 :5000 기준으로 통일)
 */
(function () {
  // simulation.html 절대 URL (모의투자 진입 링크용)
  function jurinSimulationUrl() {
    try {
      var base = window.JURIN_API_BASE || 'http://127.0.0.1:5000';
      return String(base).replace(/\/$/, '') + '/simulation.html';
    } catch (e) {
      return 'http://127.0.0.1:5000/simulation.html';
    }
  }
  window.jurinSimulationUrl = jurinSimulationUrl;

  // a.jurin-simulation-link 의 href 를 API 호스트 기준으로 맞춘다.
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

// Inject mobile/tablet hamburger nav behavior for pages that use the shared nav markup.
(function () {
  function normalizeNavSignupButton() {
    var buttons = document.querySelectorAll('nav > .nav-right[data-auth-nav] .btn-primary, nav .nav-right[data-auth-nav] .btn-primary');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      btn.textContent = '회원가입';
      if (btn.tagName === 'BUTTON') {
        btn.type = 'button';
        if (!btn.hasAttribute('onclick') && !btn.getAttribute('data-signup-bound')) {
          btn.setAttribute('data-signup-bound', '1');
          btn.addEventListener('click', function () {
            if (typeof window.openSignupModal === 'function') {
              window.openSignupModal('home');
            } else {
              window.location.href = 'signup.html';
            }
          });
        }
      } else if (btn.tagName === 'A' && !btn.getAttribute('href')) {
        btn.setAttribute('href', 'signup.html');
      }
    }
  }

  function initResponsiveNav() {
    var nav = document.querySelector('nav');
    if (!nav || nav.getAttribute('data-nav-mobile-ready') === '1') return;

    var menu = nav.querySelector('.nav-menu');
    var right = nav.querySelector('.nav-right');
    if (!menu || !right) return;

    nav.setAttribute('data-nav-mobile-ready', '1');

    menu.id = menu.id || 'globalNavMenu';

    var panel = document.createElement('div');
    panel.className = 'nav-mobile-panel';

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nav-hamburger';
    toggle.setAttribute('aria-label', '메뉴 열기');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', menu.id);
    toggle.innerHTML = '<span class="nav-hamburger-lines" aria-hidden="true"></span>';

    var backdrop = document.createElement('div');
    backdrop.className = 'nav-mobile-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');

    panel.appendChild(menu);
    nav.insertBefore(panel, right);
    nav.insertBefore(toggle, right);
    nav.insertAdjacentElement('afterend', backdrop);

    function isMobileWidth() {
      return window.matchMedia('(max-width: 1024px) and (pointer: coarse)').matches;
    }

    function setOpen(open) {
      var shouldOpen = !!open && isMobileWidth();
      nav.classList.toggle('nav-open', shouldOpen);
      toggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
      toggle.setAttribute('aria-label', shouldOpen ? '메뉴 닫기' : '메뉴 열기');
    }

    toggle.addEventListener('click', function () {
      setOpen(!nav.classList.contains('nav-open'));
    });

    backdrop.addEventListener('click', function () {
      setOpen(false);
    });

    nav.addEventListener('click', function (event) {
      var link = event.target.closest('.nav-menu a, .nav-right button, .nav-right a');
      if (link && isMobileWidth()) {
        setOpen(false);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    });

    window.addEventListener('resize', function () {
      if (!isMobileWidth()) setOpen(false);
    });
  }

  function runNavEnhancements() {
    normalizeNavSignupButton();
    initResponsiveNav();
  }

  if (document.body) {
    normalizeNavSignupButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runNavEnhancements);
  } else {
    runNavEnhancements();
  }
})();
