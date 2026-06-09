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

function authNavPrefix(navRight) {
  const scope = navRight && navRight.getAttribute('data-auth-nav-scope');
  return scope === 'index-overlay' ? 'indexNav' : 'nav';
}

function authElId(navRight, suffix) {
  return authNavPrefix(navRight) + suffix;
}

function navSignupButton(navRight) {
  if (navRight) {
    return navRight.querySelector('[data-auth-signup]') || navRight.querySelector('.btn-primary');
  }
  return document.getElementById('navSignupBtn')
    || document.querySelector('nav > .nav-right[data-auth-nav] .btn-primary');
}

function userAvatarInitial(displayName) {
  const name = (displayName || '').trim();
  if (!name) return '';
  return name.charAt(0).toUpperCase();
}

function avatarUrlFromUser(u) {
  if (!u) return null;
  if (u.hasCustomAvatar === false && u.defaultAvatarUrl) {
    return (u.defaultAvatarUrl || '').trim() || null;
  }
  return (u.avatarUrl || '').trim() || null;
}

function avatarUrlFromSessionStorage() {
  return (sessionStorage.getItem('jurinUserAvatarUrl') || '').trim() || null;
}

function persistUserAvatarUrl(avatarUrl) {
  const url = (avatarUrl || '').trim();
  if (url) sessionStorage.setItem('jurinUserAvatarUrl', url);
  else sessionStorage.removeItem('jurinUserAvatarUrl');
}

let authNavMenusBound = false;

function closeAuthUserMenu(navRight) {
  const profiles = navRight
    ? [document.getElementById(authElId(navRight, 'UserProfile'))].filter(Boolean)
    : Array.from(document.querySelectorAll('.nav-user-profile.is-open'));
  profiles.forEach((profile) => {
    const trigger = profile.querySelector('.nav-user-trigger');
    const menu = profile.querySelector('.nav-user-menu');
    if (!trigger || !menu) return;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    profile.classList.remove('is-open');
  });
}

function closeUserMenu() {
  closeAuthUserMenu(null);
}

function openAuthUserMenu(profile) {
  if (!profile || profile.hidden) return;
  const trigger = profile.querySelector('.nav-user-trigger');
  const menu = profile.querySelector('.nav-user-menu');
  if (!trigger || !menu) return;
  document.querySelectorAll('.nav-user-profile.is-open').forEach((openProfile) => {
    if (openProfile !== profile) closeAuthUserMenu(openProfile.closest('[data-auth-nav]'));
  });
  menu.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  profile.classList.add('is-open');
}

function toggleAuthUserMenu(event, profile) {
  if (event) event.stopPropagation();
  if (!profile) return;
  const menu = profile.querySelector('.nav-user-menu');
  if (!menu) return;
  if (menu.hidden) openAuthUserMenu(profile);
  else closeAuthUserMenu(profile.closest('[data-auth-nav]'));
}

function ensureUserProfileDropdown(navRight) {
  const profileId = authElId(navRight, 'UserProfile');
  let profile = document.getElementById(profileId);
  if (profile) return profile;

  navRight.querySelector('[data-auth-email]')?.remove();
  navRight.querySelector('[data-auth-logout]')?.remove();
  if (authNavPrefix(navRight) === 'nav') {
    navRight.querySelector('#navUserEmail')?.remove();
    navRight.querySelector('#navLogoutBtn')?.remove();
    navRight.querySelector('#navMyPageBtn')?.remove();
  }

  const triggerId = authElId(navRight, 'UserTrigger');
  const menuId = authElId(navRight, 'UserMenu');
  const emailId = authElId(navRight, 'UserEmail');
  const avatarId = authElId(navRight, 'UserAvatar');
  const myPageId = authElId(navRight, 'MyPageBtn');
  const logoutId = authElId(navRight, 'LogoutBtn');

  profile = document.createElement('div');
  profile.id = profileId;
  profile.className = 'nav-user-profile';
  profile.hidden = true;
  profile.innerHTML = `
    <button type="button" class="nav-user-trigger" id="${triggerId}" aria-expanded="false" aria-haspopup="menu" aria-controls="${menuId}">
      <img class="nav-user-avatar jurin-user-avatar" id="${avatarId}" src="assets/profile/default-avatar.svg" alt="" width="28" height="28" decoding="async">
      <span class="nav-user-name" id="${emailId}" aria-live="polite"></span>
      <svg class="nav-user-chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
        <path d="M2.5 4.5 6 8 9.5 4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    </button>
    <div class="nav-user-menu" id="${menuId}" role="menu" hidden>
      <button type="button" class="nav-user-menu-item" id="${myPageId}" role="menuitem">
        <svg class="nav-user-menu-icon" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <circle cx="10" cy="7" r="3.25" fill="none" stroke="currentColor" stroke-width="1.5"></circle>
          <path d="M5 16.5c0-2.8 2.2-5 5-5s5 2.2 5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
        </svg>
        <span>마이페이지</span>
      </button>
      <div class="nav-user-menu-divider" role="separator"></div>
      <button type="button" class="nav-user-menu-item nav-user-menu-item--logout" id="${logoutId}" role="menuitem">
        <svg class="nav-user-menu-icon nav-user-menu-icon--logout" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <path d="M8 4H4v12h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
          <path d="M12 10H7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
          <path d="M10 7.5 12.5 10 10 12.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
        <span>로그아웃</span>
      </button>
    </div>
  `;

  const signupBtn = navSignupButton(navRight);
  navRight.insertBefore(profile, signupBtn || null);
  return profile;
}

function bindAuthNavMenusOnce() {
  if (authNavMenusBound) return;
  authNavMenusBound = true;

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('.nav-user-trigger');
    if (trigger) {
      const profile = trigger.closest('.nav-user-profile');
      toggleAuthUserMenu(event, profile);
      return;
    }
    document.querySelectorAll('.nav-user-profile.is-open').forEach((profile) => {
      if (!profile.contains(event.target)) {
        closeAuthUserMenu(profile.closest('[data-auth-nav]'));
      }
    });
  });
}

function setAuthNavVisibleInContainer(navRight, displayName, avatarUrl) {
  const loginBtn = document.getElementById(authElId(navRight, 'LoginBtn'));
  const profile = document.getElementById(authElId(navRight, 'UserProfile'));
  const emailEl = document.getElementById(authElId(navRight, 'UserEmail'));
  const avatarEl = document.getElementById(authElId(navRight, 'UserAvatar'));
  const signupBtn = navSignupButton(navRight);
  if (!loginBtn || !emailEl) return;
  if (displayName) {
    loginBtn.hidden = true;
    if (signupBtn) signupBtn.hidden = true;
    if (profile) profile.hidden = false;
    emailEl.textContent = displayName;
    if (avatarEl) {
      const resolvedAvatar = avatarUrl || avatarUrlFromSessionStorage();
      if (typeof jurinApplyAvatarToElement === 'function') {
        jurinApplyAvatarToElement(avatarEl, resolvedAvatar, displayName);
      } else {
        avatarEl.src = resolvedAvatar || 'assets/profile/default-avatar.svg';
        avatarEl.alt = displayName + ' 프로필';
        avatarEl.onerror = function () {
          this.onerror = null;
          this.src = 'assets/profile/default-avatar.svg';
        };
      }
    }
  } else {
    loginBtn.hidden = false;
    if (signupBtn) signupBtn.hidden = false;
    if (profile) {
      profile.hidden = true;
      closeAuthUserMenu(navRight);
    }
    emailEl.textContent = '';
    if (avatarEl) {
      avatarEl.src = 'assets/profile/default-avatar.svg';
      avatarEl.alt = '';
    }
  }
}

// 로그인/로그아웃에 따라 상단 버튼·프로필 드롭다운 토글
function setAuthNavVisible(displayName, avatarUrl) {
  const mainNav = document.querySelector('nav > .nav-right[data-auth-nav]');
  if (mainNav) setAuthNavVisibleInContainer(mainNav, displayName, avatarUrl);
}

function bootstrapAuthNavSync() {
  setupAuthNav();
  const cachedName = displayNameFromSessionStorage();
  const cachedAvatar = avatarUrlFromSessionStorage();
  document.querySelectorAll('[data-auth-nav]').forEach((navRight) => {
    setAuthNavVisibleInContainer(navRight, cachedName, cachedAvatar);
  });
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
    persistUserAvatarUrl(avatarUrlFromUser(user));
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
    persistUserAvatarUrl(avatarUrlFromUser(user));
  }
  const modal = document.getElementById('mypageModal');
  const frame = document.getElementById('mypageModalFrame');
  if (modal) {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }
  if (frame) frame.src = 'about:blank';
  updateBodyScrollLock();
  refreshAuthNav().catch(function () {});
}

function isTrustedMypageMessageOrigin(origin) {
  if (!origin || origin === 'null') return true;
  if (origin === window.location.origin) return true;
  try {
    const incoming = new URL(origin);
    const current = new URL(window.location.href);
    if (incoming.protocol === current.protocol && incoming.hostname === current.hostname) {
      return true;
    }
    const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
    if (localHosts.has(incoming.hostname) && localHosts.has(current.hostname)) {
      return true;
    }
  } catch (_) {
    return false;
  }
  return false;
}

function bindMypageEmbedBridge() {
  if (window.__jurinMypageEmbedBridgeBound) return;
  window.__jurinMypageEmbedBridgeBound = true;
  window.addEventListener('message', (event) => {
    if (!isTrustedMypageMessageOrigin(event.origin)) return;
    const data = event.data;
    if (!data || data.type !== 'jurin:mypage-saved') return;
    finishMypageSuccess(data.user || null);
  });
}

function bindNavMypageOpeners(navRight) {
  const mypageBtn = document.getElementById(authElId(navRight, 'MyPageBtn'));
  if (!mypageBtn || mypageBtn.getAttribute('data-mypage-bound') === '1') return;
  mypageBtn.setAttribute('data-mypage-bound', '1');
  mypageBtn.addEventListener('click', () => {
    closeAuthUserMenu(navRight);
    openMypageModal();
  });
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
        <form class="login-form" onsubmit="submitLogin(event)" novalidate>
          <label class="login-field">
            <span>아이디</span>
            <input type="text" id="loginId" name="loginId" placeholder="아이디를 입력하세요" autocomplete="username">
          </label>
          <label class="login-field">
            <span>비밀번호</span>
            <input type="password" id="loginPassword" name="loginPassword" placeholder="비밀번호를 입력하세요" autocomplete="current-password">
          </label>
          <p class="login-error-msg" id="loginErrorMsg" role="alert" hidden></p>
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
  bindLoginFormValidation();
}

// /api/auth/me 로 세션 반영, 실패 시 sessionStorage 폴백
async function refreshAuthNav() {
  const navContainers = document.querySelectorAll('[data-auth-nav]');
  if (!navContainers.length) return;

  let displayName = null;
  let avatarUrl = null;
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
      persistUserAvatarUrl(avatarUrlFromUser(u));
      displayName = displayNameFromUser(u);
      avatarUrl = avatarUrlFromUser(u);
      if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.syncTutorialMaskUser === 'function') {
        window.JurinTutorialUtil.syncTutorialMaskUser(u);
      }
    } else if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.syncTutorialMaskUser === 'function') {
      window.JurinTutorialUtil.syncTutorialMaskUser(null);
    }
    /* 로그인 직후 /api/auth/me가 401이어도 sessionStorage를 지우지 않음.
       설명( 포트/쿠키 이슈로 세션 쿠키가 안 붙을 때 방금 로그인 정보가 날아가던 버그 방지 ) */
  } catch (_) {
    displayName = displayNameFromSessionStorage();
  }

  if (!displayName) displayName = displayNameFromSessionStorage();
  if (!avatarUrl) avatarUrl = avatarUrlFromSessionStorage();
  navContainers.forEach((navRight) => {
    setAuthNavVisibleInContainer(navRight, displayName, avatarUrl);
  });
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
  sessionStorage.removeItem('jurinUserAvatarUrl');
  if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.syncTutorialMaskUser === 'function') {
    window.JurinTutorialUtil.syncTutorialMaskUser(null);
  }
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

function clearLoginError() {
  const errEl = document.getElementById('loginErrorMsg');
  if (!errEl) return;
  errEl.textContent = '';
  errEl.hidden = true;
}

function bindLoginFormValidation() {
  const form = document.querySelector('#loginModal .login-form');
  if (!form || form.getAttribute('data-login-validation-bound') === '1') return;
  form.setAttribute('data-login-validation-bound', '1');
  form.setAttribute('novalidate', 'novalidate');
  const loginIdInput = document.getElementById('loginId');
  const loginPasswordInput = document.getElementById('loginPassword');
  if (loginIdInput) {
    loginIdInput.removeAttribute('required');
    loginIdInput.addEventListener('input', clearLoginError);
  }
  if (loginPasswordInput) {
    loginPasswordInput.removeAttribute('required');
    loginPasswordInput.addEventListener('input', clearLoginError);
  }
}

function openLoginModal() {
  const loginModal = document.getElementById('loginModal');
  if (!loginModal) return;

  bindLoginFormValidation();
  clearLoginError();
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

  clearLoginError();
  loginModal.classList.remove('is-open');
  loginModal.setAttribute('aria-hidden', 'true');
  updateBodyScrollLock();

  if (window.__jurinPendingNavUrl) {
    window.__jurinPendingNavUrl = '';
  }
}

async function submitLogin(event) {
  event.preventDefault();
  clearLoginError();

  const loginId = document.getElementById('loginId')?.value.trim();
  const loginPassword = document.getElementById('loginPassword')?.value ?? '';

  if (!loginId) {
    showLoginError('아이디를 입력해주세요.');
    document.getElementById('loginId')?.focus();
    return;
  }
  if (!loginPassword) {
    showLoginError('비밀번호를 입력해주세요.');
    document.getElementById('loginPassword')?.focus();
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
      persistUserAvatarUrl(avatarUrlFromUser(data.user));
      closeLoginModal();
      setAuthNavVisible(displayNameFromUser(data.user), avatarUrlFromUser(data.user));
      await refreshAuthNav();
      if (window.LumiChat && typeof window.LumiChat.refreshAuth === 'function') {
        try {
          await window.LumiChat.refreshAuth();
        } catch (e) {
          /* ignore */
        }
      }
      if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.syncTutorialMaskUser === 'function') {
        window.JurinTutorialUtil.syncTutorialMaskUser(data.user || null);
      }
      if (typeof window.afterJurinLogin === 'function') {
        try {
          window.afterJurinLogin();
        } catch (e) {
          /* ignore */
        }
      }
      const pendingUrl = window.__jurinPendingNavUrl;
      if (pendingUrl) {
        window.__jurinPendingNavUrl = '';
        window.location.href = pendingUrl;
        return;
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
  const form = document.querySelector('#loginModal .login-form');
  let errEl = document.getElementById('loginErrorMsg');
  if (!errEl && form) {
    errEl = document.createElement('p');
    errEl.id = 'loginErrorMsg';
    errEl.className = 'login-error-msg';
    errEl.setAttribute('role', 'alert');
    const submitBtn = form.querySelector('.login-submit');
    if (submitBtn) {
      form.insertBefore(errEl, submitBtn);
    } else {
      form.appendChild(errEl);
    }
  }
  if (!errEl) return;
  errEl.textContent = message;
  errEl.hidden = !message;
}

function jurinNavigateSignup() {
  openSignupModal('home');
}

async function jurinIsLoggedIn() {
  try {
    const res = await fetch(`${jurinApiBase()}/api/auth/me`, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    return !!(res.ok && data.success && data.user);
  } catch (_) {
    return false;
  }
}

function jurinAbsoluteUrl(pathOrUrl) {
  const raw = String(pathOrUrl || '').trim();
  if (!raw || raw === '#') return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = String(jurinApiBase() || '').replace(/\/$/, '');
  return `${base}/${raw.replace(/^\//, '')}`;
}

function jurinResolveSimulationUrl(link) {
  if (link && link.href) return link.href;
  if (typeof window.jurinSimulationUrl === 'function') return window.jurinSimulationUrl();
  return jurinAbsoluteUrl('simulation.html');
}

async function jurinNavigateSimulation(event, urlOptional) {
  if (event && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
  let url = urlOptional || jurinResolveSimulationUrl(event && event.currentTarget);
  if (url && !/^https?:\/\//i.test(url)) {
    url = jurinAbsoluteUrl(url);
  }
  if (await jurinIsLoggedIn()) {
    window.location.href = url;
    return;
  }
  window.__jurinPendingNavUrl = url;
  ensureLoginModal();
  injectGoogleLoginIntoModal();
  openLoginModal();
}

function bindSimulationNavLinks() {
  document.querySelectorAll('.jurin-simulation-link, .jurin-simulation-start').forEach((el) => {
    if (el.getAttribute('data-sim-nav-bound') === '1') return;
    el.setAttribute('data-sim-nav-bound', '1');
    el.addEventListener('click', (event) => {
      jurinNavigateSimulation(event);
    });
  });
}

window.jurinNavigateSimulation = jurinNavigateSimulation;
window.jurinIsLoggedIn = jurinIsLoggedIn;

function setupAuthNavContainer(navRight) {
  if (!navRight || navRight.dataset.authBound === '1') return;

  let loginBtn = document.getElementById(authElId(navRight, 'LoginBtn'))
    || navRight.querySelector('[data-auth-login]')
    || navRight.querySelector('.btn-ghost');
  if (!loginBtn) return;

  navRight.dataset.authBound = '1';
  loginBtn.id = authElId(navRight, 'LoginBtn');
  loginBtn.type = 'button';
  loginBtn.removeAttribute('onclick');
  loginBtn.addEventListener('click', openLoginModal);

  const signupBtn = navSignupButton(navRight);
  if (signupBtn) {
    signupBtn.id = authElId(navRight, 'SignupBtn');
    signupBtn.type = 'button';
    if (authNavPrefix(navRight) === 'nav') signupBtn.textContent = '회원가입';
    signupBtn.removeAttribute('onclick');
    signupBtn.removeEventListener('click', jurinNavigateSignup);
    signupBtn.addEventListener('click', jurinNavigateSignup);
  }

  ensureUserProfileDropdown(navRight);
  bindAuthNavMenusOnce();

  const logoutBtn = document.getElementById(authElId(navRight, 'LogoutBtn'));
  if (logoutBtn && logoutBtn.getAttribute('data-logout-bound') !== '1') {
    logoutBtn.setAttribute('data-logout-bound', '1');
    logoutBtn.addEventListener('click', () => {
      closeAuthUserMenu(navRight);
      submitLogout();
    });
  }

  bindNavMypageOpeners(navRight);
}

// .nav-right 버튼에 id·리스너 부여 (인라인 onclick 제거)
function setupAuthNav() {
  document.querySelectorAll('[data-auth-nav]').forEach(setupAuthNavContainer);
  bindSimulationNavLinks();
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
  const openMenu = document.querySelector('.nav-user-profile.is-open .nav-user-menu:not([hidden])');
  if (openMenu) {
    closeUserMenu();
    return;
  }
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

bindMypageEmbedBridge();

document.addEventListener('DOMContentLoaded', () => {
  ensureLoginModal();
  bindLoginFormValidation();
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
window.refreshAuthNav = refreshAuthNav;
window.setupAuthNavContainer = setupAuthNavContainer;
window.updateBodyScrollLock = updateBodyScrollLock;
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
