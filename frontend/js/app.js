// 앱 초기화 및 공통 기능

console.log('[초기화] 앱 시작');

function jurinApiBase() {
  if (typeof window !== 'undefined' && window.JURIN_API_BASE) {
    return window.JURIN_API_BASE;
  }
  return 'http://localhost:5000';
}

function displayNameFromUser(u) {
  if (!u) return null;
  const nickname = (u.nickname || '').trim();
  const loginId = (u.loginId || '').trim();
  const email = (u.email || '').trim();
  return nickname || loginId || email || null;
}

function displayNameFromSessionStorage() {
  const nickname = (sessionStorage.getItem('jurinUserNickname') || '').trim();
  const loginId = (sessionStorage.getItem('jurinUserLoginId') || '').trim();
  const email = (sessionStorage.getItem('jurinUserEmail') || '').trim();
  return nickname || loginId || email || null;
}

function setAuthNavVisible(displayName) {
  const loginBtn = document.getElementById('navLoginBtn');
  const logoutBtn = document.getElementById('navLogoutBtn');
  const emailEl = document.getElementById('navUserEmail');
  if (!loginBtn || !emailEl) return;
  if (displayName) {
    const welcomeText = `${displayName}님 환영합니다`;
    loginBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = '';
    emailEl.textContent = welcomeText;
    emailEl.style.display = 'inline-block';
    emailEl.title = welcomeText;
  } else {
    loginBtn.style.display = '';
    if (logoutBtn) logoutBtn.style.display = 'none';
    emailEl.style.display = 'none';
    emailEl.textContent = '';
    emailEl.removeAttribute('title');
  }
}

function updateBodyScrollLock() {
  const hasOpenModal = Boolean(document.querySelector('.login-modal.is-open, .news-modal.is-open'));
  document.body.style.overflow = hasOpenModal ? 'hidden' : '';
}

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
       (포트/쿠키 이슈로 세션 쿠키가 안 붙을 때 방금 로그인 정보가 날아가던 버그 수정) */
  } catch (_) {
    displayName = displayNameFromSessionStorage();
  }

  if (!displayName) displayName = displayNameFromSessionStorage();
  setAuthNavVisible(displayName);
}

// Intersection Observer - fade-in 애니메이션
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('visible');
  });
}, { threshold: 0.1 });

document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

// 모든 요소가 준비될 때까지 대기하는 함수
function waitForRSSReady() {
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (typeof loadSliderNews === 'function' && 
          typeof loadNewsFromRSS === 'function' &&
          document.querySelector('#sliderContainer') &&
          document.querySelector('.news-grid')) {
        clearInterval(checkInterval);
        console.log('[초기화] RSS 함수 준비 완료');
        resolve();
      }
    }, 100);
    
    // 최대 5초 대기
    setTimeout(() => {
      clearInterval(checkInterval);
      resolve();
    }, 5000);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[초기화] DOMContentLoaded 이벤트 발생');

  const logoutBtn = document.getElementById('navLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', submitLogout);
  }

  refreshAuthNav();

  const params = new URLSearchParams(window.location.search);
  if (params.get('openLogin') === '1') {
    openLoginModal();
    params.delete('openLogin');
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', nextUrl);
  }
  
  // RSS 함수가 준비될 때까지 대기
  await waitForRSSReady();

  // RSS 뉴스 로드 (rss-loader의 초기화 함수에 위임)
  console.log('[초기화] RSS 뉴스 로드 시작...');
  if (typeof initializeRSSFeeds === 'function') {
    initializeRSSFeeds();
  } else {
    if (typeof loadSliderNews === 'function') {
      loadSliderNews().then(() => console.log('[초기화] 슬라이더 완료'));
    } else {
      console.error('[초기화] loadSliderNews 함수를 찾을 수 없습니다.');
    }

    if (typeof loadNewsFromRSS === 'function') {
      loadNewsFromRSS().then(() => console.log('[초기화] 뉴스 그리드 완료'));
    } else {
      console.error('[초기화] loadNewsFromRSS 함수를 찾을 수 없습니다.');
    }
  }
});

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
      /* 응답 본문으로 즉시 네비 반영(다음 줄 refreshAuthNav의 /me 실패와 무관) */
      setAuthNavVisible(displayNameFromUser(data.user));
      await refreshAuthNav();
    } else {
      const hint = data && data.message ? data.message : '';
      const msg = hint || `로그인 실패 (HTTP ${res.status})`;
      showLoginError(msg);
    }
  } catch (err) {
    showLoginError(
      `서버에 연결할 수 없습니다. (${jurinApiBase()}) Flask가 실행 중인지, 주소가 맞는지 확인하세요.`
    );
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
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
  refreshAuthNav();
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

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeLoginModal();
  }
});
