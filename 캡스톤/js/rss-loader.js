// RSS 피드 설정
const rssFeeds = [
  'https://www.mk.co.kr/rss/50200011/'
];

// CORS 프록시 목록
const corsProxies = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://cors.bridged.cc/',
  'https://cors-anywhere.herokuapp.com/'
];

console.log('[RSS-LOADER] 파일 로드 시작 - loadSliderNews, loadNewsFromRSS 함수 정의 중...');

// 프록시를 통한 URL 요청 함수
async function fetchWithProxy(url) {
  for (let proxy of corsProxies) {
    try {
      let fetchUrl = proxy + encodeURIComponent(url);
      const response = await fetch(fetchUrl);
      if (response.ok) {
        return await response.text();
      }
    } catch (error) {
      continue;
    }
  }
  throw new Error('모든 프록시 실패');
}

// HTML 태그 제거 함수
function stripHTML(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

// 텍스트 자르기 함수
function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// 링크 값 정규화 (RSS별 공백/개행/상대경로 대응)
function normalizeNewsLink(rawLink) {
  if (!rawLink) return '#';
  const link = String(rawLink).trim();
  if (!link) return '#';
  if (link.startsWith('http://') || link.startsWith('https://')) {
    return link;
  }
  return '#';
}

// 시간 계산 함수
function getTimeAgo(dateString) {
  try {
    if (!dateString) return '최근';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '방금 전';
    if (minutes < 60) return minutes + '분 전';
    if (hours < 24) return hours + '시간 전';
    if (days < 7) return days + '일 전';
    return date.toLocaleDateString('ko-KR');
  } catch (e) {
    return '최근';
  }
}

// 뉴스 그리드 로드 함수
async function loadNewsFromRSS() {
  console.log('[RSS-NEWS] 시작');
  const newsGrid = document.querySelector('.news-grid');
  if (!newsGrid) {
    console.warn('[RSS-NEWS] newsGrid 요소를 찾을 수 없습니다.');
    loadDefaultNews();
    return;
  }
  
  for (let feedIdx = 0; feedIdx < rssFeeds.length; feedIdx++) {
    try {
      const feed = rssFeeds[feedIdx];
      console.log(`[RSS-NEWS] 피드 ${feedIdx + 1} 시도: ${feed}`);
      
      const data = await fetchWithProxy(feed);
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data, 'text/xml');
      
      if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('XML 파싱 실패');
      }
      
      const items = xmlDoc.querySelectorAll('item');
      if (items.length === 0) {
        continue;
      }
      
      console.log(`[RSS-NEWS] 성공! ${items.length}개 항목`);
      
      const newsCards = Array.from(items).slice(0, 6).map((item, index) => {
        const title = item.querySelector('title')?.textContent || '제목 없음';
        const description = item.querySelector('description')?.textContent || '내용 없음';
        const pubDate = item.querySelector('pubDate')?.textContent || '';
        const link = normalizeNewsLink(item.querySelector('link')?.textContent || '');
        const timeStr = getTimeAgo(pubDate);
        const categories = ['📱 기술', '💼 정책', '📈 시황', '🏦 금융', '🌐 글로벌', '⚡ 동향'];
        const tags = ['뉴스', '경제', '증시', '시장', '정책', '기술'];
        const category = categories[index % categories.length];
        const tag = tags[index % tags.length];
        
        return `
          <a class="news-card" href="${link}" target="_blank" rel="noopener noreferrer">
            <div class="news-card-cat">${category}</div>
            <div class="news-card-title">${truncateText(title, 50)}</div>
            <div class="news-card-desc">${truncateText(stripHTML(description), 100)}</div>
            <div class="news-card-footer">
              <div class="news-card-time">${timeStr}</div>
              <div class="news-tag">${tag}</div>
            </div>
          </a>
        `;
      });
      
      newsGrid.innerHTML = newsCards.join('');
      console.log('[RSS-NEWS] 완료');
      return;
    } catch (error) {
      console.error(`[RSS-NEWS] 피드 ${feedIdx + 1} 실패:`, error.message);
    }
  }
  
  console.error('[RSS-NEWS] 모든 피드 실패 → 뉴스 없음');
  // loadDefaultNews(); // 기본 뉴스 로드 제거
}

// 슬라이더 뉴스 로드 함수
async function loadSliderNews() {
  console.log('[RSS-SLIDER] 시작');
  const sliderContainer = document.getElementById('sliderContainer');
  if (!sliderContainer) {
    console.warn('[RSS-SLIDER] sliderContainer을 찾을 수 없습니다.');
    loadDefaultSliderNews();
    return;
  }
  
  for (let feedIdx = 0; feedIdx < rssFeeds.length; feedIdx++) {
    try {
      const feed = rssFeeds[feedIdx];
      console.log(`[RSS-SLIDER] 피드 ${feedIdx + 1} 시도: ${feed}`);
      
      const data = await fetchWithProxy(feed);
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data, 'text/xml');
      
      if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('XML 파싱 실패');
      }
      
      const items = xmlDoc.querySelectorAll('item');
      if (items.length === 0) {
        continue;
      }
      
      console.log(`[RSS-SLIDER] 성공! ${items.length}개 항목`);
      
      const categories = ['🔥 긴급', '📊 시황', '🤖 AI', '💡 투자팁', '⚡ 동향', '💰 시장'];
      const slides = Array.from(items).slice(0, 4).map((item, index) => {
        const title = item.querySelector('title')?.textContent || '제목 없음';
        const description = item.querySelector('description')?.textContent || '내용 없음';
        const pubDate = item.querySelector('pubDate')?.textContent || '';
        const link = normalizeNewsLink(item.querySelector('link')?.textContent || '');
        const timeStr = pubDate ? new Date(pubDate).toLocaleDateString('ko-KR') : '최근';
        const category = categories[index % categories.length];
        
        return `
          <div class="slide ${index === 0 ? 'active' : ''}">
            <div>
              <div class="slide-category">${category}</div>
              <div class="slide-title">${truncateText(title, 40)}</div>
              <div class="slide-desc">${truncateText(stripHTML(description), 80)}</div>
            </div>
            <div class="slide-footer">
              <div class="slide-time">${timeStr}</div>
              <a class="slide-more" href="${link}" target="_blank" rel="noopener noreferrer">자세히 보기 →</a>
            </div>
          </div>
        `;
      });
      
      sliderContainer.innerHTML = slides.join('');
      updateSliderDots();
      restartSliderAutoPlay();
      console.log('[RSS-SLIDER] 완료');
      return;
    } catch (error) {
      console.error(`[RSS-SLIDER] 피드 ${feedIdx + 1} 실패:`, error.message);
    }
  }
  
  console.error('[RSS-SLIDER] 모든 피드 실패 → 기본 슬라이더 표시');
  loadDefaultSliderNews();
}


// 기본 슬라이더 뉴스
function loadDefaultSliderNews() {
  console.log('[DEFAULT] 기본 슬라이더 로드');
  const sliderContainer = document.getElementById('sliderContainer');
  if (!sliderContainer) return;
  
  const defaultSlides = [
    { cat: '🔥 긴급', title: '삼성전자, 3분기 영업이익<br>9.1조 예상 상회 발표', desc: '반도체 업황 회복세가 본격화되며 시장 전망을 크게 웃도는 실적을 기록했습니다.', time: '2025.03.11 · 14:32', link: 'https://www.mk.co.kr/news/stock/' },
    { cat: '📊 시황', title: '미 연준, 기준금리 동결<br>국내 증시 영향은?', desc: '연준의 금리 동결 결정에 따라 국내 외국인 자금 흐름이 주목받고 있습니다.', time: '2025.03.11 · 11:05', link: 'https://www.hankyung.com/finance' },
    { cat: '🤖 AI', title: 'SK하이닉스 HBM4 양산<br>글로벌 AI 수요 급증', desc: '차세대 고대역폭 메모리 HBM4 본격 양산으로 수혜 전망이 높아지고 있습니다.', time: '2025.03.11 · 09:45', link: 'https://www.etnews.com/news/section.html?id1=02' },
    { cat: '💡 투자팁', title: '주린이가 꼭 알아야 할<br>PER · PBR 완전 정복', desc: '복잡한 주식 지표, 실제 사례와 함께 5분 만에 마스터해 보세요.', time: '2025.03.10 · 18:20', link: 'https://www.mk.co.kr/news/economy/' }
  ];
  
  const slides = defaultSlides.map((slide, index) => `
    <div class="slide ${index === 0 ? 'active' : ''}">
      <div>
        <div class="slide-category">${slide.cat}</div>
        <div class="slide-title">${slide.title}</div>
        <div class="slide-desc">${slide.desc}</div>
      </div>
      <div class="slide-footer">
        <div class="slide-time">${slide.time}</div>
        <a class="slide-more" href="${slide.link}" target="_blank" rel="noopener noreferrer">자세히 보기 →</a>
      </div>
    </div>
  `).join('');
  
  sliderContainer.innerHTML = slides;
  updateSliderDots();
  restartSliderAutoPlay();
}

// 기본 뉴스
function loadDefaultNews() {
  console.log('[DEFAULT] 기본 뉴스 로드');
  const newsGrid = document.querySelector('.news-grid');
  if (!newsGrid) return;
  
  const defaultNews = [
    { cat: '🏭 산업·종목', title: '반도체 슈퍼사이클 재개? 2025년 하반기 전망 분석', desc: '메모리 업황 회복세와 AI 수요 증가로 반도체 섹터에 대한 긍정 전망이 확산', time: '1시간 전', tag: '반도체' },
    { cat: '🌐 글로벌', title: '나스닥 사상 최고치 경신, 국내 증시 연동 여부는', desc: '나스닥이 연일 고점을 갱신하는 가운데 KOSPI와의 상관관계 분석이 주목', time: '2시간 전', tag: '글로벌' },
    { cat: '💰 ETF', title: '초보 투자자를 위한 ETF 포트폴리오 구성 전략', desc: '분산 투자의 기본인 ETF, 어떻게 골라야 할지 핵심만 정리했습니다.', time: '4시간 전', tag: 'ETF' },
    { cat: '📈 KOSPI', title: '외국인 순매수 5거래일 연속, 코스피 반등 신호?', desc: '외국인 매수세가 지속되며 KOSPI 2,600선 회복에 대한 기대감이 높아지고 있습니다.', time: '5시간 전', tag: 'KOSPI' },
    { cat: '🏦 정책', title: '한국은행 금리 결정 D-3, 시장 전망 종합', desc: '기준금리 동결 또는 인하 기대 속에 채권·증시 모두 촉각을 세우고 있습니다.', time: '어제', tag: '금리' },
    { cat: '🛢️ 원자재', title: '국제 유가 80달러 돌파, 에너지 관련주 수혜 종목', desc: 'WTI 원유가 80달러를 돌파하며 에너지 섹터에 대한 관심이 급증하고 있습니다.', time: '어제', tag: '원자재' }
  ];
  
  const newsCards = defaultNews.map(news => `
    <div class="news-card">
      <div class="news-card-cat">${news.cat}</div>
      <div class="news-card-title">${news.title}</div>
      <div class="news-card-desc">${news.desc}</div>
      <div class="news-card-footer">
        <div class="news-card-time">${news.time}</div>
        <div class="news-tag">${news.tag}</div>
      </div>
    </div>
  `).join('');
  
  newsGrid.innerHTML = newsCards;
}

// 슬라이더 닷 업데이트
function updateSliderDots() {
  const dots = document.querySelectorAll('.slider-dot');
  dots.forEach((dot, index) => {
    dot.onclick = () => goSlide(index);
  });
}

// 슬라이더 자동재생 재시작
function restartSliderAutoPlay() {
  const newSlides = document.querySelectorAll('.slide');
  if (newSlides.length > 0) {
    window.slides = newSlides;
    window.currentSlide = 0;
    if (typeof window.startSliderAutoPlay === 'function') {
      window.startSliderAutoPlay();
    }
    updateSliderDots();
  }
}

// 초기화 - RSS 뉴스 자동 로드
function initializeRSSFeeds() {
  console.log('[RSS-LOADER] 초기화 함수 호출 - 뉴스 로드 시작');
  loadSliderNews();
  loadNewsFromRSS();
}

// 페이지 로드 완료 후 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeRSSFeeds);
  console.log('[RSS-LOADER] DOMContentLoaded 리스너 등록');
} else {
  // 이미 로드된 경우
  initializeRSSFeeds();
  console.log('[RSS-LOADER] 즉시 초기화 실행');
}

console.log('[RSS-LOADER] 모든 함수 정의 완료. loadSliderNews와 loadNewsFromRSS 준비됨');
