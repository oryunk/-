/**
 * 파일: 공통 로그인 모달·네비 세션 표시 (/api/auth/*)
 * 설명( api-base.js 다음에 로드. 홈은 주린닷컴홈피.html 에서도 이 파일을 포함한다. )
 * Google Sign-In 은 /api/auth/google/* (사용자 OAuth). KIS tokenP 는 서버 API 토큰과 별개.
 */

const GOOGLE_LOGIN_ERROR_MESSAGES = {
  google: 'Google 로그인에 실패했습니다. 다시 시도해주세요.',
  google_not_configured: 'Google 로그인이 설정되지 않았습니다. 관리자에게 문의하세요.',
  google_state: '로그인 요청이 만료되었거나 올바르지 않습니다. 다시 시도해주세요.',
  google_token: 'Google 인증 토큰을 받지 못했습니다.',
  google_profile: 'Google 계정 정보를 가져오지 못했습니다.',
  google_account: '이 이메일은 다른 방식으로 가입되어 있거나 연동할 수 없습니다.',
  google_db: 'DB 마이그레이션이 필요합니다. SQL/add_google_oauth.sql 을 적용해주세요.',
  google_network: 'Google 서버에 연결할 수 없습니다. 네트워크를 확인해주세요.',
  access_denied: 'Google 로그인이 취소되었습니다.',
};

function googleLoginStartUrl() {
  return `${jurinApiBase()}/api/auth/google/start`;
}

function googleLoginBlockHtml() {
  return `
    <span class="login-divider" aria-hidden="true">또는</span>
    <a class="login-google-btn" href="${googleLoginStartUrl()}">Google로 로그인</a>
  `;
}

function googleLoginErrorMessage(code) {
  if (!code) return GOOGLE_LOGIN_ERROR_MESSAGES.google;
  return GOOGLE_LOGIN_ERROR_MESSAGES[code] || GOOGLE_LOGIN_ERROR_MESSAGES.google;
}

function injectGoogleLoginIntoModal() {
  const modal = document.getElementById('loginModal');
  if (!modal || modal.querySelector('.login-google-btn')) return;
  const links = modal.querySelector('.login-links');
  const anchor = links || modal.querySelector('.login-form');
  if (!anchor) return;
  anchor.insertAdjacentHTML('beforebegin', googleLoginBlockHtml());
}

function handleGoogleLoginRedirect() {
  const params = new URLSearchParams(window.location.search);
  const err = params.get('login_error');
  if (!err) return;

  const msg = googleLoginErrorMessage(err);
  ensureLoginModal();
  injectGoogleLoginIntoModal();
  openLoginModal();
  showLoginError(msg);

  params.delete('login_error');
  const qs = params.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash || ''}`;
  window.history.replaceState({}, '', next);
}

// 사용자 객체에서 네비에 쓸 표시 이름 추출
function displayNameFromUser(u) {
  if (!u) return null;
  const nickname = (u.nickname || '').trim();
  const loginId = (u.loginId || '').trim();
  const email = (u.email || '').trim();
  return nickname || loginId || email || null;
}

// /me 실패 시에도 직전 로그인 표시를 유지하기 위한 sessionStorage 백업
function displayNameFromSessionStorage() {
  const nickname = (sessionStorage.getItem('jurinUserNickname') || '').trim();
  const loginId = (sessionStorage.getItem('jurinUserLoginId') || '').trim();
  const email = (sessionStorage.getItem('jurinUserEmail') || '').trim();
  return nickname || loginId || email || null;
}

function markAuthNavReady() {
  document.documentElement.classList.remove('auth-nav-pending');
  document.documentElement.classList.add('auth-nav-ready');
}

function navSignupButton() {
  return document.getElementById('navSignupBtn')
    || document.querySelector('nav > .nav-right[data-auth-nav] .btn-primary');
}

// 로그인/로그아웃에 따라 상단 버튼·닉네임·마이페이지 토글
function setAuthNavVisible(displayName) {
  const loginBtn = document.getElementById('navLoginBtn');
  const logoutBtn = document.getElementById('navLogoutBtn');
  const mypageBtn = document.getElementById('navMyPageBtn');
  const emailEl = document.getElementById('navUserEmail');
  const signupBtn = navSignupButton();
  if (!loginBtn || !emailEl) return;
  if (displayName) {
    loginBtn.hidden = true;
    if (logoutBtn) logoutBtn.hidden = false;
    if (mypageBtn) mypageBtn.hidden = false;
    if (signupBtn) signupBtn.hidden = true;
    emailEl.textContent = displayName;
    emailEl.hidden = false;
    emailEl.title = `마이페이지 (${displayName})`;
  } else {
    loginBtn.hidden = false;
    if (logoutBtn) logoutBtn.hidden = true;
    if (mypageBtn) mypageBtn.hidden = true;
    if (signupBtn) signupBtn.hidden = false;
    emailEl.hidden = true;
    emailEl.textContent = '';
    emailEl.removeAttribute('title');
  }
}

function bootstrapAuthNavSync() {
  setupAuthNav();
  setAuthNavVisible(displayNameFromSessionStorage());
  markAuthNavReady();
}

// 로그인·뉴스 오버레이 열릴 때 body 스크롤 잠금
let signupReturnTo = null;

function updateBodyScrollLock() {
  const hasOpen = Boolean(
    document.querySelector(
      '.login-modal.is-open, .signup-modal.is-open, .mypage-modal.is-open, .news-modal.is-open',
    ),
  );
  document.body.style.overflow = hasOpen ? 'hidden' : '';
}

function ensureSignupModal() {
  if (document.getElementById('signupModal')) return;

  const modalHtml = `
    <div class="signup-modal" id="signupModal" aria-hidden="true">
      <div class="signup-modal-backdrop" onclick="closeSignupModal()"></div>
      <div class="signup-modal-panel" role="dialog" aria-modal="true" aria-label="회원가입">
        <button class="signup-close login-close" type="button" onclick="closeSignupModal()" aria-label="회원가입 창 닫기">×</button>
        <iframe id="signupModalFrame" class="signup-modal-frame" title="회원가입" src="about:blank"></iframe>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function openSignupModal(returnTo) {
  signupReturnTo = returnTo === 'login' ? 'login' : null;
  ensureSignupModal();
  const modal = document.getElementById('signupModal');
  const frame = document.getElementById('signupModalFrame');
  if (!modal || !frame) return;

  if (signupReturnTo === 'login') {
    closeLoginModal();
  }

  const embedSrc = new URL('signup.html?embed=1', window.location.href).href;
  if (frame.src !== embedSrc) {
    frame.src = embedSrc;
  }

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  updateBodyScrollLock();
}

function closeSignupModal() {
  const modal = document.getElementById('signupModal');
  const frame = document.getElementById('signupModalFrame');
  if (!modal) return;

  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  if (frame) frame.src = 'about:blank';

  const reopenLogin = signupReturnTo === 'login';
  signupReturnTo = null;
  updateBodyScrollLock();

  if (reopenLogin) {
    openLoginModal();
  }
}

async function finishSignupSuccess(user) {
  if (user) {
    const email = (user.email || '').trim();
    const nickname = (user.nickname || '').trim();
    const loginId = (user.loginId || '').trim();
    if (email) sessionStorage.setItem('jurinUserEmail', email);
    if (nickname) sessionStorage.setItem('jurinUserNickname', nickname);
    if (loginId) sessionStorage.setItem('jurinUserLoginId', loginId);
  }
  signupReturnTo = null;
  const modal = document.getElementById('signupModal');
  const frame = document.getElementById('signupModalFrame');
  if (modal) {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }
  if (frame) frame.src = 'about:blank';
  updateBodyScrollLock();
  await refreshAuthNav();
}

function openSignupFromLogin(event) {
  if (event) event.preventDefault();
  openSignupModal('login');
}

function ensureMypageModal() {
  if (document.getElementById('mypageModal')) return;

  const modalHtml = `
    <div class="mypage-modal" id="mypageModal" aria-hidden="true">
      <div class="mypage-modal-backdrop" onclick="closeMypageModal()"></div>
      <div class="mypage-modal-panel" role="dialog" aria-modal="true" aria-label="마이페이지">
        <button class="mypage-close login-close" type="button" onclick="closeMypageModal()" aria-label="마이페이지 창 닫기">×</button>
        <iframe id="mypageModalFrame" class="mypage-modal-frame" title="마이페이지" src="about:blank"></iframe>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function openMypageModal() {
  ensureMypageModal();
  const modal = document.getElementById('mypageModal');
  const frame = document.getElementById('mypageModalFrame');
  if (!modal || !frame) return;

  closeLoginModal();
  closeSignupModal();

  const embedSrc = new URL('mypage.html?embed=1', window.location.href).href;
  frame.src = embedSrc;

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  updateBodyScrollLock();
}

function closeMypageModal() {
  const modal = document.getElementById('mypageModal');
  const frame = document.getElementById('mypageModalFrame');
  if (!modal) return;

  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  if (frame) frame.src = 'about:blank';
  updateBodyScrollLock();
}

function finishMypageSuccess(user) {
  if (user) {
    const email = (user.email || '').trim();
    const nickname = (user.nickname || '').trim();
    const loginId = (user.loginId || '').trim();
    if (email) sessionStorage.setItem('jurinUserEmail', email);
    if (nickname) sessionStorage.setItem('jurinUserNickname', nickname);
    if (loginId) sessionStorage.setItem('jurinUserLoginId', loginId);
  }
  const modal = document.getElementById('mypageModal');
  const frame = document.getElementById('mypageModalFrame');
  if (modal) {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }
  if (frame) frame.src = 'about:blank';
  updateBodyScrollLock();
  refreshAuthNav();
}

function bindNavMypageOpeners() {
  const emailEl = document.getElementById('navUserEmail');
  const mypageBtn = document.getElementById('navMyPageBtn');

  if (emailEl && emailEl.getAttribute('data-mypage-bound') !== '1') {
    emailEl.setAttribute('data-mypage-bound', '1');
    emailEl.classList.add('nav-user-nickname-btn');
    emailEl.setAttribute('role', 'button');
    emailEl.setAttribute('tabindex', '0');
    emailEl.addEventListener('click', openMypageModal);
    emailEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openMypageModal();
      }
    });
  }

  if (mypageBtn && mypageBtn.getAttribute('data-mypage-bound') !== '1') {
    mypageBtn.setAttribute('data-mypage-bound', '1');
    mypageBtn.addEventListener('click', openMypageModal);
  }
}

// HTML에 모달이 없을 때만 주입 (홈은 이미 마크업 있음)
function ensureLoginModal() {
  if (document.getElementById('loginModal')) return;

  const modalHtml = `
    <div class="login-modal" id="loginModal" aria-hidden="true">
      <div class="login-modal-backdrop" onclick="closeLoginModal()"></div>
      <div class="login-modal-panel" role="dialog" aria-modal="true" aria-labelledby="loginModalTitle">
        <button class="login-close" type="button" onclick="closeLoginModal()" aria-label="로그인 창 닫기">x</button>
        <div class="login-modal-header">
          <div class="login-eyebrow">JURIN.COM</div>
          <h2 id="loginModalTitle">로그인</h2>
          <p>아이디와 비밀번호를 입력해 서비스를 이용하세요.</p>
        </div>
        <form class="login-form" onsubmit="submitLogin(event)">
          <label class="login-field">
            <span>아이디</span>
            <input type="text" id="loginId" name="loginId" placeholder="아이디를 입력하세요" autocomplete="username" required>
          </label>
          <label class="login-field">
            <span>비밀번호</span>
            <input type="password" id="loginPassword" name="loginPassword" placeholder="비밀번호를 입력하세요" autocomplete="current-password" required>
          </label>
          <button class="login-submit" type="submit">로그인</button>
        </form>
        ${googleLoginBlockHtml()}
        <div class="login-links">
          <a href="#" id="loginModalSignupLink">회원가입</a>
          <a href="find-id.html" target="_blank" rel="noopener noreferrer">아이디 찾기</a>
          <a href="find-password.html" target="_blank" rel="noopener noreferrer">비밀번호 찾기</a>
        </div>
        <p class="login-google-hint">Google 가입 계정은 Google로 로그인하세요.</p>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// /api/auth/me 로 세션 반영, 실패 시 sessionStorage 폴백
async function refreshAuthNav() {
  const loginBtn = document.getElementById('navLoginBtn');
  const emailEl = document.getElementById('navUserEmail');
  if (!loginBtn || !emailEl) return;

  let displayName = null;
  try {
    const res = await fetch(`${jurinApiBase()}/api/auth/me`, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success && data.user) {
      const u = data.user;
      const email = (u.email || '').trim();
      const nickname = (u.nickname || '').trim();
      const loginId = (u.loginId || '').trim();
      if (email) sessionStorage.setItem('jurinUserEmail', email);
      if (nickname) sessionStorage.setItem('jurinUserNickname', nickname);
      if (loginId) sessionStorage.setItem('jurinUserLoginId', loginId);
      displayName = displayNameFromUser(u);
    }
    /* 로그인 직후 /api/auth/me가 401이어도 sessionStorage를 지우지 않음.
       설명( 포트/쿠키 이슈로 세션 쿠키가 안 붙을 때 방금 로그인 정보가 날아가던 버그 방지 ) */
  } catch (_) {
    displayName = displayNameFromSessionStorage();
  }

  if (!displayName) displayName = displayNameFromSessionStorage();
  setAuthNavVisible(displayName);
  markAuthNavReady();
}

async function submitLogout() {
  try {
    await fetch(`${jurinApiBase()}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (_) {
    /* ignore */
  }

  sessionStorage.removeItem('jurinUserEmail');
  sessionStorage.removeItem('jurinUserNickname');
  sessionStorage.removeItem('jurinUserLoginId');
  if (typeof window.afterJurinLogout === "function") {
    try {
      window.afterJurinLogout();
    } catch (_) {
      /* ignore */
    }
  }
  await refreshAuthNav();
  if (window.LumiChat && typeof window.LumiChat.refreshAuth === 'function') {
    try {
      await window.LumiChat.refreshAuth();
    } catch (_) {
      /* ignore */
    }
  }
}

function openLoginModal() {
  const loginModal = document.getElementById('loginModal');
  if (!loginModal) return;

  loginModal.classList.add('is-open');
  loginModal.setAttribute('aria-hidden', 'false');
  updateBodyScrollLock();

  const loginIdInput = document.getElementById('loginId');
  if (loginIdInput) {
    setTimeout(() => loginIdInput.focus(), 50);
  }
}

function closeLoginModal() {
  const loginModal = document.getElementById('loginModal');
  if (!loginModal) return;

  loginModal.classList.remove('is-open');
  loginModal.setAttribute('aria-hidden', 'true');
  updateBodyScrollLock();
}

async function submitLogin(event) {
  event.preventDefault();

  const loginId = document.getElementById('loginId')?.value.trim();
  const loginPassword = document.getElementById('loginPassword')?.value;

  if (!loginId || !loginPassword) {
    showLoginError('아이디와 비밀번호를 모두 입력해주세요.');
    return;
  }

  const submitBtn = event.target.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await fetch(`${jurinApiBase()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ loginId, password: loginPassword }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      const email = (data.user && data.user.email) ? data.user.email : '';
      const nickname = (data.user && data.user.nickname) ? data.user.nickname : '';
      const loginIdSaved = (data.user && data.user.loginId) ? data.user.loginId : '';
      sessionStorage.setItem('jurinUserEmail', email);
      sessionStorage.setItem('jurinUserNickname', nickname);
      sessionStorage.setItem('jurinUserLoginId', loginIdSaved);
      closeLoginModal();
      setAuthNavVisible(displayNameFromUser(data.user));
      await refreshAuthNav();
      if (window.LumiChat && typeof window.LumiChat.refreshAuth === 'function') {
        try {
          await window.LumiChat.refreshAuth();
        } catch (e) {
          /* ignore */
        }
      }
      if (typeof window.afterJurinLogin === 'function') {
        try {
          window.afterJurinLogin();
        } catch (e) {
          /* ignore */
        }
      }
    } else {
      const hint = data && data.message ? data.message : '';
      const msg = hint || `로그인 실패 (HTTP ${res.status})`;
      showLoginError(msg);
    }
  } catch (err) {
    showLoginError(
      `서버에 연결할 수 없습니다. (${jurinApiBase()}) Flask가 실행 중인지, 주소가 맞는지 확인하세요.`,
    );
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function showLoginError(message) {
  let errEl = document.getElementById('loginErrorMsg');
  if (!errEl) {
    errEl = document.createElement('div');
    errEl.id = 'loginErrorMsg';
    errEl.style.cssText = 'color:#ff8e8e; font-size:13px; font-weight:600; margin-top:8px; text-align:center;';
    const form = document.querySelector('.login-form');
    if (form) form.appendChild(errEl);
  }
  errEl.textContent = message;
}

function jurinNavigateSignup() {
  openSignupModal('home');
}

// .nav-right 버튼에 id·리스너 부여 (인라인 onclick 제거)
function setupAuthNav() {
  const navRight = document.querySelector('nav > .nav-right[data-auth-nav]');
  if (!navRight) return;

  const primaryBtn = navRight.querySelector('.btn-primary');
  const oldProfile = document.getElementById('navUserProfile');
  if (oldProfile) oldProfile.remove();

  let loginBtn = document.getElementById('navLoginBtn') || navRight.querySelector('.btn-ghost');
  if (!loginBtn) return;

  loginBtn.id = 'navLoginBtn';
  loginBtn.type = 'button';
  loginBtn.removeAttribute('onclick');
  loginBtn.addEventListener('click', openLoginModal);

  const signupBtn = navSignupButton();
  if (signupBtn) {
    signupBtn.id = signupBtn.id || 'navSignupBtn';
    signupBtn.type = 'button';
    signupBtn.textContent = '회원가입';
    signupBtn.removeAttribute('onclick');
    signupBtn.removeEventListener('click', jurinNavigateSignup);
    signupBtn.addEventListener('click', jurinNavigateSignup);
  }

  let emailEl = document.getElementById('navUserEmail');
  if (!emailEl) {
    emailEl = document.createElement('span');
    emailEl.id = 'navUserEmail';
    emailEl.className = 'nav-user-email';
    emailEl.hidden = true;
    emailEl.setAttribute('aria-live', 'polite');
    const primaryBtn = navSignupButton();
    navRight.insertBefore(emailEl, primaryBtn || null);
  }

  let mypageBtn = document.getElementById('navMyPageBtn');
  if (!mypageBtn) {
    mypageBtn = document.createElement('button');
    mypageBtn.id = 'navMyPageBtn';
    mypageBtn.type = 'button';
    mypageBtn.className = 'btn-ghost';
    mypageBtn.hidden = true;
    mypageBtn.textContent = '마이페이지';
    const logoutAnchor = document.getElementById('navLogoutBtn');
    if (logoutAnchor) {
      navRight.insertBefore(mypageBtn, logoutAnchor);
    } else {
      const primaryBtn = navSignupButton();
      navRight.insertBefore(mypageBtn, primaryBtn || null);
    }
  }

  let logoutBtn = document.getElementById('navLogoutBtn');
  if (!logoutBtn) {
    logoutBtn = document.createElement('button');
    logoutBtn.id = 'navLogoutBtn';
    logoutBtn.type = 'button';
    logoutBtn.className = 'btn-ghost';
    logoutBtn.hidden = true;
    logoutBtn.textContent = '로그아웃';
    const primaryBtn = navSignupButton();
    navRight.insertBefore(logoutBtn, primaryBtn || null);
  }

  logoutBtn.removeEventListener('click', submitLogout);
  logoutBtn.addEventListener('click', submitLogout);

  bindNavMypageOpeners();
}

function bindSignupLinkInLoginModal() {
  const link = document.getElementById('loginModalSignupLink')
    || document.querySelector('#loginModal .login-links a[href*="signup"]');
  if (!link || link.getAttribute('data-signup-bound') === '1') return;
  link.setAttribute('data-signup-bound', '1');
  link.setAttribute('href', '#');
  link.removeAttribute('target');
  link.removeAttribute('rel');
  link.addEventListener('click', openSignupFromLogin);
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const mypageModal = document.getElementById('mypageModal');
  if (mypageModal && mypageModal.classList.contains('is-open')) {
    closeMypageModal();
    return;
  }
  const signupModal = document.getElementById('signupModal');
  if (signupModal && signupModal.classList.contains('is-open')) {
    closeSignupModal();
    return;
  }
  closeLoginModal();
});

if (document.body) {
  bootstrapAuthNavSync();
}

document.addEventListener('DOMContentLoaded', () => {
  ensureLoginModal();
  ensureSignupModal();
  ensureMypageModal();
  injectGoogleLoginIntoModal();
  bindSignupLinkInLoginModal();
  bootstrapAuthNavSync();
  refreshAuthNav();
  handleGoogleLoginRedirect();
});

window.markAuthNavReady = markAuthNavReady;
window.bootstrapAuthNavSync = bootstrapAuthNavSync;

window.openSignupModal = openSignupModal;
window.closeSignupModal = closeSignupModal;
window.finishSignupSuccess = finishSignupSuccess;
window.openSignupFromLogin = openSignupFromLogin;
window.openMypageModal = openMypageModal;
window.closeMypageModal = closeMypageModal;
window.finishMypageSuccess = finishMypageSuccess;
