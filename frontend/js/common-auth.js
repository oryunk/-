/** api-base.js가 늦게 로드되어도 되도록 매 요청 시점에 호스트를 읽는다. */
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
    loginBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = '';
    emailEl.textContent = displayName;
    emailEl.style.display = 'inline-block';
    emailEl.title = displayName;
  } else {
    loginBtn.style.display = '';
    if (logoutBtn) logoutBtn.style.display = 'none';
    emailEl.style.display = 'none';
    emailEl.textContent = '';
    emailEl.removeAttribute('title');
  }
}

function updateBodyScrollLock() {
  const loginModal = document.getElementById('loginModal');
  const isOpen = Boolean(loginModal && loginModal.classList.contains('is-open'));
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

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
        <div class="login-links">
          <a href="signup.html" target="_blank" rel="noopener noreferrer">회원가입</a>
          <a href="find-id.html" target="_blank" rel="noopener noreferrer">아이디 찾기</a>
          <a href="find-password.html" target="_blank" rel="noopener noreferrer">비밀번호 찾기</a>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
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
  } catch (_) {
    displayName = displayNameFromSessionStorage();
  }

  if (!displayName) displayName = displayNameFromSessionStorage();
  setAuthNavVisible(displayName);
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
      `서버에 연결할 수 없습니다. (${jurinApiBase()}) Flask가 실행 중인지, 주소가 맞는지 확인하세요.`
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

function setupAuthNav() {
  const navRight = document.querySelector('.nav-right');
  if (!navRight) return;

  let loginBtn = document.getElementById('navLoginBtn') || navRight.querySelector('.btn-ghost');
  if (!loginBtn) return;

  loginBtn.id = 'navLoginBtn';
  loginBtn.type = 'button';
  loginBtn.removeAttribute('onclick');
  loginBtn.addEventListener('click', openLoginModal);

  let emailEl = document.getElementById('navUserEmail');
  if (!emailEl) {
    emailEl = document.createElement('span');
    emailEl.id = 'navUserEmail';
    emailEl.className = 'nav-user-email';
    emailEl.style.display = 'none';
    emailEl.setAttribute('aria-live', 'polite');
    const primaryBtn = navRight.querySelector('.btn-primary');
    navRight.insertBefore(emailEl, primaryBtn || null);
  }

  let logoutBtn = document.getElementById('navLogoutBtn');
  if (!logoutBtn) {
    logoutBtn = document.createElement('button');
    logoutBtn.id = 'navLogoutBtn';
    logoutBtn.type = 'button';
    logoutBtn.className = 'btn-ghost';
    logoutBtn.style.display = 'none';
    logoutBtn.textContent = '로그아웃';
    const primaryBtn = navRight.querySelector('.btn-primary');
    navRight.insertBefore(logoutBtn, primaryBtn || null);
  }

  logoutBtn.removeEventListener('click', submitLogout);
  logoutBtn.addEventListener('click', submitLogout);
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeLoginModal();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  ensureLoginModal();
  setupAuthNav();
  refreshAuthNav();
});
