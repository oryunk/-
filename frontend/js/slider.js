/**
 * 파일: 홈 히어로 뉴스 슬라이더 자동 재생·닷 네비
 * 설명( rss-loader 가 DOM을 채운 뒤 전역 goSlide/startSliderAutoPlay 를 호출한다. )
 */
let currentSlide = 0;
let slides = document.querySelectorAll('.slide');
const dots = document.querySelectorAll('.slider-dot');

function goSlide(n) {
  slides = document.querySelectorAll('.slide');
  if (slides.length === 0) return;

  if (slides[currentSlide]) {
    slides[currentSlide].classList.remove('active');
  }

  const dotsArray = document.querySelectorAll('.slider-dot');
  if (dotsArray[currentSlide]) {
    dotsArray[currentSlide].classList.remove('active');
  }

  currentSlide = n;

  if (slides.length > 0) {
    slides[currentSlide].classList.add('active');
    if (dotsArray[currentSlide]) {
      dotsArray[currentSlide].classList.add('active');
    }
  }
}

let sliderInterval;

function startSliderAutoPlay() {
  if (sliderInterval) clearInterval(sliderInterval);

  sliderInterval = setInterval(() => {
    slides = document.querySelectorAll('.slide');
    if (slides && slides.length > 0) {
      goSlide((currentSlide + 1) % slides.length);
    }
  }, 4000);
}

function updateSliderDots() {
  const dotsArray = document.querySelectorAll('.slider-dot');
  dotsArray.forEach((dot, index) => {
    dot.onclick = () => goSlide(index);
  });
}

function restartSliderAutoPlay() {
  slides = document.querySelectorAll('.slide');
  currentSlide = 0;
  startSliderAutoPlay();
  updateSliderDots();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    startSliderAutoPlay();
  });
} else {
  startSliderAutoPlay();
}
