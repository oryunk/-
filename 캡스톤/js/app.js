// 앱 초기화 및 공통 기능

console.log('[초기화] 앱 시작');

const API_BASE = 'http://localhost:5000';

async function refreshAuthNav() {
  const loginBtn = document.getElementById('navLoginBtn');
  const emailEl = document.getElementById('navUserEmail');
  if (!loginBtn || !emailEl) return;

  let email = null;
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success && data.user && data.user.email) {
      email = data.user.email;
    }
  } catch (_) {
    /* ignore */
  }

  if (!email) {
    email = sessionStorage.getItem('jurinUserEmail');
  }

  if (email) {
    loginBtn.style.display = 'none';
    emailEl.textContent = email;
    emailEl.style.display = 'inline-block';
    emailEl.title = email;
  } else {
    loginBtn.style.display = '';
    emailEl.style.display = 'none';
    emailEl.textContent = '';
    emailEl.removeAttribute('title');
  }
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

  refreshAuthNav();
  
  // RSS 함수가 준비될 때까지 대기
  await waitForRSSReady();
  
  // RSS 뉴스 로드
  console.log('[초기화] RSS 뉴스 로드 시작...');
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
});

function openLoginModal() {
  const loginModal = document.getElementById('loginModal');
  if (!loginModal) return;

  loginModal.classList.add('is-open');
  loginModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

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
  document.body.style.overflow = '';
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
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ loginId, password: loginPassword }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      const email = (data.user && data.user.email) ? data.user.email : '';
      sessionStorage.setItem('jurinUserEmail', email);
      closeLoginModal();
      refreshAuthNav();
    } else {
      const msg = (data && data.message) ? data.message : '아이디 또는 비밀번호가 일치하지 않습니다.';
      showLoginError(msg);
    }
  } catch (err) {
    showLoginError('서버(localhost:5000)에 연결할 수 없습니다. 백엔드를 실행했는지 확인하세요.');
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

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeLoginModal();
  }
});
