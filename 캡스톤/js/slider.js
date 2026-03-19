// Slider 제어 관련 로직
let currentSlide = 0;
let slides = document.querySelectorAll('.slide');
const dots = document.querySelectorAll('.slider-dot');

function goSlide(n) {
  slides = document.querySelectorAll('.slide');  // 최신 슬라이드 요소 가져오기
  if (slides.length === 0) return;
  
  // 이전 슬라이드 비활성화
  if (slides[currentSlide]) {
    slides[currentSlide].classList.remove('active');
  }
  
  const dotsArray = document.querySelectorAll('.slider-dot');
  if (dotsArray[currentSlide]) {
    dotsArray[currentSlide].classList.remove('active');
  }
  
  currentSlide = n;
  
  // 새 슬라이드 활성화
  if (slides.length > 0) {
    slides[currentSlide].classList.add('active');
    if (dotsArray[currentSlide]) {
      dotsArray[currentSlide].classList.add('active');
    }
  }
  
  console.log(`[SLIDER] 슬라이드 변경: ${currentSlide + 1}/${slides.length}`);
}

let sliderInterval;
function startSliderAutoPlay() {
  if (sliderInterval) clearInterval(sliderInterval);
  
  sliderInterval = setInterval(() => {
    slides = document.querySelectorAll('.slide');  // 매번 최신 요소 가져오기
    if (slides && slides.length > 0) {
      goSlide((currentSlide + 1) % slides.length);
    }
  }, 4000);
  
  console.log('[SLIDER] 자동재생 시작');
}

function updateSliderDots() {
  const dotsArray = document.querySelectorAll('.slider-dot');
  dotsArray.forEach((dot, index) => {
    dot.onclick = () => goSlide(index);
  });
  console.log(`[SLIDER] 닷 업데이트 완료: ${dotsArray.length}개`);
}

function restartSliderAutoPlay() {
  slides = document.querySelectorAll('.slide');
  currentSlide = 0;
  console.log(`[SLIDER] 슬라이더 재시작: ${slides.length}개 슬라이드`);
  startSliderAutoPlay();
  updateSliderDots();
}

// 초기 슬라이더 시작
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[SLIDER] DOMContentLoaded - 초기 슬라이더 시작');
    startSliderAutoPlay();
  });
} else {
  console.log('[SLIDER] 즉시 슬라이더 시작');
  startSliderAutoPlay();
}
