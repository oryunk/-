/**
 * head에서 동기 로드 — 본문 nav가 그려지기 전에 auth-nav-pending 적용(로그인 UI 깜빡임 방지)
 */
(function () {
  document.documentElement.classList.add('auth-nav-pending');
})();
