// 앱 초기화 및 공통 기능

console.log('[초기화] 앱 시작');

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

function submitLogin(event) {
  event.preventDefault();

  const loginId = document.getElementById('loginId')?.value.trim();
  const loginPassword = document.getElementById('loginPassword')?.value.trim();

  if (!loginId || !loginPassword) {
    alert('아이디와 비밀번호를 모두 입력해주세요.');
    return;
  }

  alert('로그인 기능은 현재 준비 중입니다.');
  closeLoginModal();
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeLoginModal();
  }
});
