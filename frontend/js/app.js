/**
 * 파일: 메인 홈(주린닷컴홈피) 전용 초기화
 * 설명( api-base → rss-loader → common-auth 다음에 로드. 로그인은 common-auth 가 담당한다. )
 */

// 페이드인 섹션 진입 시 .visible 부여
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) e.target.classList.add('visible');
    });
  },
  { threshold: 0.1 },
);
document.querySelectorAll('.fade-in').forEach((el) => observer.observe(el));

// 슬라이더·그리드 DOM과 rss-loader 함수가 준비될 때까지 폴링
function waitForRSSReady() {
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (
        typeof loadSliderNews === 'function' &&
        typeof loadNewsFromRSS === 'function' &&
        document.querySelector('#sliderContainer') &&
        document.querySelector('.news-grid')
      ) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);

    setTimeout(() => {
      clearInterval(checkInterval);
      resolve();
    }, 5000);
  });
}

// 인기 종목 테이블 행 클릭 시 시장 상세로 이동
function initHomePopularStockRows() {
  document.querySelectorAll('.market-table tbody tr[data-stock-code]').forEach((tr) => {
    tr.addEventListener('click', () => {
      const code = tr.getAttribute('data-stock-code');
      if (!code) return;
      window.location.href = `market.html?stock=${encodeURIComponent(code)}`;
    });
    tr.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        tr.click();
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initHomePopularStockRows();

  const params = new URLSearchParams(window.location.search);
  if (params.get('openLogin') === '1') {
    openLoginModal();
    params.delete('openLogin');
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', nextUrl);
  }

  await waitForRSSReady();

  if (typeof initializeRSSFeeds === 'function') {
    initializeRSSFeeds();
  } else {
    if (typeof loadSliderNews === 'function') {
      loadSliderNews();
    }
    if (typeof loadNewsFromRSS === 'function') {
      loadNewsFromRSS();
    }
  }
});
