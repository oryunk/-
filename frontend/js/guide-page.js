/**
 * guide.html — 학습 가이드 대시보드 UI
 */
(function () {
  var TUTORIAL_MASK_KEY = 'jurinGuideTutorialBits';
  var GUIDE_LUMI_SESSION_KEY = 'jurin:guide-lumi-session';
  var TOTAL_BEGINNER_STEPS = 5;
  // 4단계 튜토리얼 미구현 — 임시로 5단계까지 완료·해금 처리
  var GUIDE_ASSUME_ALL_CLEAR = true;
  var GUIDE_FULL_CLEAR_MASK = 31;

  function applyTemporaryGuideFullClear() {
    if (!GUIDE_ASSUME_ALL_CLEAR) return;
    try {
      localStorage.setItem(TUTORIAL_MASK_KEY, String(GUIDE_FULL_CLEAR_MASK));
    } catch (e) { /* ignore */ }
  }
  var TOTAL_EXPERT_STEPS = 2;
  function mascot2LumiconAsset(name) {
    if (typeof jurinLumiconAsset === 'function') return jurinLumiconAsset(name);
    return 'assets/mascot2/' + name + '?v=20260608r';
  }

  function mascot2MiscAsset(name) {
    if (typeof jurinMascot2MiscAsset === 'function') return jurinMascot2MiscAsset(name);
    return 'assets/mascot2/misc/' + name + '?v=20260608r';
  }

  var LUMICON_FILES = {
    'happy.png': true,
    'excited.png': true,
    'curious.png': true,
    'success.png': true,
    'surprised.png': true,
    'sparkle.png': true,
    'hello.png': true,
    'struggling.png': true,
    'sleepy.png': true,
    'thinking.png': true,
    'angry.png': true,
    'chart-analysis.png': true,
    'good-idea.png': true,
    'idea.png': true,
    'studying.png': true,
  };

  function mascot2Asset(name) {
    if (typeof jurinMascot2Asset === 'function') return jurinMascot2Asset(name);
    return (LUMICON_FILES[name] ? 'assets/mascot2/' : 'assets/mascot2/misc/') + name + '?v=20260608r';
  }

  var MASCOT_IMAGES = {
    welcome: mascot2LumiconAsset('hello.png'),
    info: mascot2LumiconAsset('thinking.png'),
    success: mascot2LumiconAsset('success.png'),
    caution: mascot2LumiconAsset('surprised.png'),
  };

  var BEGINNER_STEPS = [
    {
      id: 1,
      shortTitle: '시세 읽기',
      title: '1단계: 시세 읽기',
      subtitle: '지수·필터로 오늘 시장을 보고 거래량·거래대금까지 익혀요.',
      summary: '지수·필터로 오늘 시장 흐름 읽기',
      duration: '약 5분',
      learn: '지수·필터, 상세 카드의 거래량·거래대금, 뉴스·수급 연결',
      goal: '오늘 시장이 어떤 분위기인지 스스로 파악하기',
      tip: '처음엔 지수만 봐도 괜찮아요. 익숙해지면 거래대금 순위로 핫한 종목을 찾아보세요.',
      startHref: '주린닷컴홈피.html?tutorial=step1',
      startLabel: '학습 시작하기',
      btnClass: 'btn-primary',
      timelineLabel: '시세',
      lumiMood: 'welcome',
      lumiImage: 'curious.png',
    },
    {
      id: 2,
      shortTitle: '차트 기초',
      title: '2단계: 차트 기초',
      subtitle: '삼성전자 차트로 봉·거래량 읽는 법을 배워요.',
      summary: '일·주·월·년 봉과 거래량 읽기',
      duration: '약 7분',
      learn: '일·주·월·년 봉 전환, 봉 색·몸통·거래량 막대 의미',
      goal: '차트 화면에서 가격 흐름과 거래량을 함께 읽기',
      tip: '봉 하나만 봐도 “오늘 올랐는지 내렸는지” 알 수 있어요. 거래량은 함께 보면 더 확실해져요.',
      startHref: 'market.html?tutorial=step2',
      startLabel: '학습 시작하기',
      btnClass: 'btn-primary',
      timelineLabel: '차트',
      lumiMood: 'info',
      lumiImage: 'idea.png',
    },
    {
      id: 3,
      shortTitle: '종목 가치',
      title: '3단계: 종목 가치',
      subtitle: 'PER·매출·부채 등 숫자 근거로 종목 가치를 봐요.',
      summary: '재무 칩과 차트로 가치 비교',
      duration: '약 8분',
      learn: '가치 비교·재무 성과·재무상태표 칩, PER·매출·부채 해석',
      goal: '감이 아닌 숫자 근거로 종목을 비교하기',
      tip: '칩을 왼쪽부터 순서대로 눌러보면 “이 회사가 돈을 잘 버는지” 감이 와요.',
      startHref: 'market.html?tutorial=step3',
      startLabel: '학습 시작하기',
      btnClass: 'btn-primary',
      timelineLabel: '가치',
      lumiMood: 'info',
      lumiImage: 'excited.png',
    },
    {
      id: 4,
      shortTitle: '시장 종류',
      title: '4단계: 시장 종류',
      subtitle: 'ETF·섹터·ELW·채권 등 상품 성격의 차이를 익혀요.',
      summary: 'ETF·ELW·채권 기초 개념',
      duration: '약 6분',
      learn: 'ETF·섹터·테마 차이, ELW·채권 기초 개념',
      goal: '상품 성격에 맞는 선택 기준 만들기',
      tip: 'ETF는 “한 바구니”, ELW는 “레버리지”라고만 기억해도 시작하기 충분해요.',
      startHref: 'market-products.html?topic=elw',
      startLabel: 'ELW 알아보기',
      btnClass: 'btn-ghost',
      timelineLabel: '상품',
      lumiMood: 'info',
      lumiImage: 'good-idea.png',
    },
    {
      id: 5,
      shortTitle: '첫 투자',
      title: '5단계: 나의 첫 투자',
      subtitle: '모의투자로 차트·시세·호가와 지정가 매수를 연습해요.',
      summary: '모의투자 지정가 매수 흐름',
      duration: '약 10분',
      learn: '차트·시세·호가 확인, 지정가 매수 주문 흐름',
      goal: '실전 전 모의투자로 매수까지 직접 해보기',
      tip: '로그인 후 시작해요. 실수해도 괜찮아요 — 모의투자는 연습용이니까요!',
      startHref: 'simulation.html?tutorial=step5',
      startLabel: '학습 시작하기',
      btnClass: 'btn-primary',
      timelineLabel: '모의투자',
      lumiMood: 'success',
      lumiImage: 'success.png',
    },
  ];

  var EXPERT_STEPS = [
    {
      id: 1,
      shortTitle: '심화 전략',
      title: '1단계: 심화 전략',
      subtitle: '차트·그래프 심화 학습',
      summary: '차트·그래프 심화 학습',
      duration: '약 10분',
      learn: '심화 차트 해석, 추세·지지·저항 개념',
      goal: '고급 차트 분석 기초 익히기',
      tip: '차트 화면에서 심화 내용을 단계별로 익혀 보세요.',
      startHref: 'market.html',
      startLabel: '학습 시작하기',
      btnClass: 'btn-primary',
      timelineLabel: '심화',
      lumiMood: 'success',
      lumiImage: 'good-idea.png',
    },
    {
      id: 2,
      shortTitle: '추세·지지·저항',
      title: '2단계: 추세·지지·저항',
      subtitle: '차트 핵심 심화 개념 (준비 중)',
      summary: '추세선·지지·저항 해석',
      duration: '준비 중',
      learn: '추세선 그리기, 지지·저항 구간 읽기, 돌파·이탈 판단',
      goal: '차트에서 매수·매도 참고 구간 스스로 찾기',
      tip: '1단계를 마친 뒤 이어서 학습할 수 있어요.',
      startHref: '#',
      startLabel: '준비 중',
      btnClass: 'btn-primary',
      timelineLabel: '차트',
      lockedPlaceholder: true,
      lumiMood: 'info',
      lumiImage: 'thinking.png',
    },
  ];

  var state = {
    track: null,
    selectedStepId: 1,
  };

  var introIdx = 0;
  var introActive = false;

  var landingEl = document.getElementById('guideModeLanding');
  var mainContentEl = document.getElementById('guideMainContent');
  var backToModeBtn = document.getElementById('guideBackToMode');
  var pickBeginnerBtn = document.getElementById('guidePickBeginner');
  var pickExpertBtn = document.getElementById('guidePickExpert');
  var beginnerPanel = document.getElementById('guideBeginnerPanel');
  var expertPanel = document.getElementById('guideExpertPanel');
  var titleEl = document.getElementById('guideTrackTitle');
  var subtitleEl = document.getElementById('guideTrackSubtitle');
  var explainBtn = document.getElementById('guideTutorialExplainBtn');

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function guideInfoSvgHtml(svgInner, extraClass) {
    var cls = 'guide-info-icon guide-info-icon--svg';
    if (extraClass) cls += ' ' + extraClass;
    return '<span class="' + cls + '" aria-hidden="true">' + svgInner + '</span>';
  }

  var GUIDE_INFO_SVG_ATTR =
    ' width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

  var GUIDE_CONTENT_ICONS = {
    learn:
      '<svg' +
      GUIDE_INFO_SVG_ATTR +
      '>' +
      '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>' +
      '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>' +
      '<line x1="9" y1="7" x2="16" y2="7"/>' +
      '<line x1="9" y1="11" x2="14" y2="11"/>' +
      '</svg>',
    goal:
      '<svg' +
      GUIDE_INFO_SVG_ATTR +
      '>' +
      '<circle cx="12" cy="12" r="10"/>' +
      '<circle cx="12" cy="12" r="6"/>' +
      '<circle cx="12" cy="12" r="2"/>' +
      '</svg>',
    time:
      '<svg' +
      GUIDE_INFO_SVG_ATTR +
      '>' +
      '<circle cx="12" cy="12" r="10"/>' +
      '<polyline points="12 6 12 12 16 14"/>' +
      '</svg>',
  };

  var GUIDE_TIMELINE_IMAGES = {
    1: 'sprout.png',
    2: 'growth-2.png',
    3: 'growth-3.png',
    4: 'growth-4.png',
    5: 'growth-5.png',
  };

  function guideTimelineBeginnerIconHtml(stage) {
    var file = GUIDE_TIMELINE_IMAGES[stage] || GUIDE_TIMELINE_IMAGES[1];
    return (
      '<img class="guide-timeline-step-img guide-timeline-step-img--stage-' +
      stage +
      '" src="' +
      escapeHtml(mascot2MiscAsset(file)) +
      '" alt="" width="40" height="40" decoding="async"/>'
    );
  }

  function getGuideDetailInfoIcons() {
    return {
      learn: guideInfoSvgHtml(GUIDE_CONTENT_ICONS.learn),
      goal: guideInfoSvgHtml(GUIDE_CONTENT_ICONS.goal),
      time: guideInfoSvgHtml(GUIDE_CONTENT_ICONS.time),
    };
  }

  function mascotImageForMood(mood) {
    return MASCOT_IMAGES[mood] || MASCOT_IMAGES.info;
  }

  function repaintGuideImages(root) {
    if (!root) return;
    root.querySelectorAll('img').forEach(function (img) {
      if (!img.getAttribute('src') && !img.getAttribute('data-lumi')) return;
      if (img.decode) {
        img.decode().catch(function () { /* ignore */ });
      }
    });
  }

  function initLumiImages() {
    document.querySelectorAll('img[data-lumi="intro-landing"]').forEach(function (img) {
      img.src = MASCOT_IMAGES.welcome;
    });
    document.querySelectorAll('img[data-lumi="intro-hero"]').forEach(function (img) {
      img.src = mascot2LumiconAsset('thinking.png');
    });
    document.querySelectorAll('img[data-lumi="intro"]').forEach(function (img) {
      img.src = MASCOT_IMAGES.welcome;
    });
    document.querySelectorAll('img[data-lumi="study"]').forEach(function (img) {
      var mood = img.getAttribute('data-lumi-mood') || 'info';
      img.src = mascotImageForMood(mood);
    });
    document.querySelectorAll('img[data-lumi="tip"]').forEach(function (img) {
      img.src = MASCOT_IMAGES.caution;
    });
    document.querySelectorAll('img[data-lumi="growth"]').forEach(function (img) {
      img.src = MASCOT_IMAGES.success;
    });
  }

  function setGuideSessionFlag() {
    try {
      sessionStorage.setItem(GUIDE_LUMI_SESSION_KEY, '1');
    } catch (e) { /* ignore */ }
  }

  function readTutorialBitsMask() {
    try {
      var raw = localStorage.getItem(TUTORIAL_MASK_KEY);
      if (raw !== null && raw !== '') {
        var m = parseInt(raw, 10);
        return isNaN(m) ? 0 : Math.min(31, Math.max(0, m));
      }
      localStorage.setItem(TUTORIAL_MASK_KEY, '0');
      return 0;
    } catch (e) {
      return 0;
    }
  }

  function isStepCleared(stepId) {
    var mask = readTutorialBitsMask();
    return !!(mask & (1 << (stepId - 1)));
  }

  function countClearedSteps(total) {
    var mask = readTutorialBitsMask();
    var n = 0;
    for (var i = 0; i < total; i++) {
      if (mask & (1 << i)) n += 1;
    }
    return n;
  }

  function isStepUnlocked(stepId, total) {
    if (stepId <= 1) return true;
    return isStepCleared(stepId - 1);
  }

  function getFirstOpenStepId(total) {
    for (var i = 1; i <= total; i++) {
      if (!isStepCleared(i)) return i;
    }
    return total;
  }

  function getNavStepsForTrack() {
    if (state.track === 'expert') {
      return EXPERT_STEPS.slice();
    }
    return BEGINNER_STEPS;
  }

  function getStepsForTrack() {
    return state.track === 'expert' ? EXPERT_STEPS : BEGINNER_STEPS;
  }

  function getTotalStepsForTrack() {
    return state.track === 'expert' ? TOTAL_EXPERT_STEPS : TOTAL_BEGINNER_STEPS;
  }

  function syncGuidePageScroll() {
    var onLanding = landingEl && !landingEl.classList.contains('is-hidden');
    document.body.classList.toggle('guide-showing-landing', !!onLanding);
    document.body.classList.toggle('guide-showing-dashboard', !onLanding);
  }

  function showModeLanding() {
    state.track = null;
    if (landingEl) {
      landingEl.classList.remove('is-hidden');
      landingEl.removeAttribute('hidden');
      landingEl.setAttribute('aria-hidden', 'false');
    }
    if (mainContentEl) {
      mainContentEl.classList.add('is-hidden');
      mainContentEl.setAttribute('hidden', '');
      mainContentEl.setAttribute('aria-hidden', 'true');
    }
    syncGuidePageScroll();
  }

  function renderTimeline(container, steps, totalSlots) {
    if (!container) return;
    var parts = [];
    for (var slot = 1; slot <= totalSlots; slot++) {
      var stepMeta = null;
      for (var j = 0; j < steps.length; j++) {
        if (steps[j].id === slot) {
          stepMeta = steps[j];
          break;
        }
      }
      var label = stepMeta ? stepMeta.timelineLabel || String(slot) : String(slot);
      var locked =
        state.track === 'beginner'
          ? !isStepUnlocked(slot, totalSlots)
          : slot > 1 || !!(stepMeta && stepMeta.lockedPlaceholder);
      var clickable =
        (state.track === 'beginner' && !locked) ||
        (state.track === 'expert' && slot === 1 && !locked);
      var cls = 'guide-timeline-step';
      if (state.track === 'beginner' || state.track === 'expert') {
        cls += ' guide-timeline-step--growth guide-timeline-step--stage-' + slot;
      }
      if (locked) cls += ' is-locked';
      if (clickable) cls += ' is-clickable';

      var circleInner;
      if (state.track === 'beginner' || state.track === 'expert') {
        circleInner = guideTimelineBeginnerIconHtml(slot);
      } else {
        circleInner = escapeHtml(String(slot));
      }

      var stepTitle = stepMeta ? stepMeta.shortTitle : label;
      parts.push(
        '<button type="button" class="' +
          cls +
          '" data-timeline-step="' +
          slot +
          '"' +
          (clickable ? '' : ' disabled') +
          ' aria-label="' +
          escapeHtml(label + (locked ? ' 잠금' : '')) +
          '">' +
          '<span class="guide-timeline-circle">' +
          circleInner +
          '</span>' +
          '<span class="guide-timeline-label">' +
          '<span class="guide-timeline-label-line">' +
          escapeHtml(String(slot) + '단계') +
          '</span>' +
          '<span class="guide-timeline-label-line">' +
          escapeHtml(stepTitle) +
          '</span>' +
          '</span></button>'
      );
    }
    container.innerHTML = parts.join('');

    container.querySelectorAll('.guide-timeline-step.is-clickable').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = parseInt(btn.getAttribute('data-timeline-step'), 10);
        if (!id) return;
        state.selectedStepId = id;
        renderDashboard();
      });
    });
  }

  function renderStepNav(container, steps) {
    if (!container) return;
    var navSteps = state.track === 'expert' ? getNavStepsForTrack() : steps;
    var firstOpen = state.track === 'beginner' ? getFirstOpenStepId(TOTAL_BEGINNER_STEPS) : 1;
    var html = navSteps
      .map(function (step) {
        var isPlaceholder = !!step.lockedPlaceholder;
        var done = !isPlaceholder && state.track === 'beginner' && isStepCleared(step.id);
        var locked =
          isPlaceholder ||
          (state.track === 'beginner' && !isStepUnlocked(step.id, TOTAL_BEGINNER_STEPS));
        var active = step.id === state.selectedStepId;
        var current = !done && !locked && step.id === firstOpen;
        var cls = 'guide-lesson';
        if (done) cls += ' is-done';
        if (active) cls += ' is-active';
        if (locked) cls += ' is-locked';

        var num = done ? '✓' : String(step.id);
        var arrow = '›';
        var badge = current && active ? ' <span class="guide-lesson-badge">진행중</span>' : '';

        return (
          '<li><button type="button" class="' +
          cls +
          '" data-nav-step="' +
          step.id +
          '"' +
          (locked ? ' disabled' : '') +
          '>' +
          '<span class="guide-lesson-num">' +
          num +
          '</span>' +
          '<span class="guide-lesson-body">' +
          '<span class="guide-lesson-title">' +
          escapeHtml(String(step.id) + '단계') +
          '<br>' +
          escapeHtml(step.shortTitle) +
          badge +
          '</span>' +
          '<p class="guide-lesson-desc">' +
          escapeHtml(step.summary) +
          '</p></span>' +
          '<span class="guide-lesson-arrow">' +
          arrow +
          '</span></button></li>'
        );
      })
      .join('');
    container.innerHTML = html;

    container.querySelectorAll('.guide-lesson:not(.is-locked)').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = parseInt(btn.getAttribute('data-nav-step'), 10);
        if (!id) return;
        state.selectedStepId = id;
        renderDashboard();
      });
    });
  }

  function renderStepDetail(container, steps) {
    if (!container) return;
    var step = null;
    for (var i = 0; i < steps.length; i++) {
      if (steps[i].id === state.selectedStepId) {
        step = steps[i];
        break;
      }
    }
    if (!step) step = steps[0];
    if (!step) {
      container.innerHTML = '';
      return;
    }

    var locked = state.track === 'beginner' ? !isStepUnlocked(step.id, TOTAL_BEGINNER_STEPS) : step.id > 1;
    var studyMood = step.lumiMood || 'info';
    var studyImgHtml = step.lumiImage
      ? '<img class="guide-lumi-study" src="' +
        escapeHtml(mascot2Asset(step.lumiImage)) +
        '" alt="" width="220" height="220" decoding="sync" loading="eager"/>'
      : '<img class="guide-lumi-study" data-lumi="study" data-lumi-mood="' +
        escapeHtml(studyMood) +
        '" alt="" width="220" height="220" decoding="sync" loading="eager"/>';
    var infoIcons = getGuideDetailInfoIcons();

    container.innerHTML =
      '<div class="guide-detail-top">' +
      '<div class="guide-detail-head">' +
      '<span class="guide-detail-badge">현재 학습 중</span>' +
      '<h2 class="guide-detail-title">' +
      escapeHtml(step.title.replace(/^(\d+단계):\s*/, '$1. ')) +
      '</h2>' +
      '<p class="guide-detail-subtitle">' +
      escapeHtml(step.subtitle) +
      '</p></div>' +
      '<div class="guide-lumi-slot guide-lumi-slot--study">' +
      studyImgHtml +
      '</div></div>' +
      '<div class="guide-detail-info-grid">' +
      '<div class="guide-detail-info-box">' +
      '<div class="guide-detail-info-label">' +
      infoIcons.learn +
      '배울 내용</div>' +
      '<p class="guide-detail-info-text">' +
      escapeHtml(step.learn) +
      '</p></div>' +
      '<div class="guide-detail-info-box">' +
      '<div class="guide-detail-info-label">' +
      infoIcons.goal +
      '학습 목표</div>' +
      '<p class="guide-detail-info-text">' +
      escapeHtml(step.goal) +
      '</p></div>' +
      '<div class="guide-detail-info-box">' +
      '<div class="guide-detail-info-label">' +
      infoIcons.time +
      '예상 시간</div>' +
      '<p class="guide-detail-info-text">' +
      escapeHtml(step.duration) +
      '</p></div></div>' +
      '<div class="guide-detail-tip">' +
      '<img class="guide-detail-tip-lumi" data-lumi="tip" alt="" width="78" height="78" decoding="async"/>' +
      '<div class="guide-detail-tip-body">' +
      '<strong class="guide-detail-tip-label">루미의 한마디</strong>' +
      '<p class="guide-detail-tip-text">' +
      escapeHtml(step.tip) +
      '</p></div></div>' +
      '<div class="guide-detail-actions guide-detail-actions--single">' +
      (locked
        ? '<button type="button" class="guide-btn-start is-disabled" disabled>이전 단계를 먼저 완료해 주세요</button>'
        : '<button type="button" class="' +
          (step.btnClass === 'btn-ghost' ? 'guide-btn-outline' : 'guide-btn-start') +
          '" id="guideStartStepBtn" data-href="' +
          escapeHtml(step.startHref) +
          '">' +
          escapeHtml(step.startLabel) +
          '</button>') +
      '</div>';

    initLumiImages();
    repaintGuideImages(container);

    var startBtn = container.querySelector('#guideStartStepBtn');
    if (startBtn) {
      startBtn.addEventListener('click', function () {
        setGuideSessionFlag();
        window.location.href = startBtn.getAttribute('data-href') || '#';
      });
    }
  }

  function renderProgress(panelPrefix) {
    var isBeginner = state.track === 'beginner';
    var total = getTotalStepsForTrack();
    var total = isBeginner ? TOTAL_BEGINNER_STEPS : TOTAL_EXPERT_STEPS;
    var cleared = isBeginner ? countClearedSteps(TOTAL_BEGINNER_STEPS) : 0;
    var percent = total > 0 ? Math.round((cleared / total) * 100) : 0;

    var pctEl = document.getElementById(panelPrefix + 'ProgressPercent');
    var countEl = document.getElementById(panelPrefix + 'ProgressCount');
    if (pctEl) pctEl.textContent = percent + '%';
    if (countEl) {
      countEl.textContent = cleared + ' / ' + total + ' 단계 완료';
    }
  }

  function updateRewardPreviewButton() {
    var btn = document.getElementById('guideRewardPreviewBtn');
    if (!btn || !window.LumiCon) return;
    var claimed = window.LumiCon.hasAnyUnlocked();
    var eligible = window.LumiCon.isGuideRewardEligible();
    btn.disabled = false;
    btn.removeAttribute('title');
    if (claimed) {
      btn.textContent = '루미콘 보기 →';
    } else if (eligible) {
      btn.textContent = '보상 받기 →';
    } else {
      btn.textContent = '보상 미리보기 →';
    }
  }

  function renderDashboard() {
    if (state.track === 'beginner') {
      renderProgress('guideBeginner');
      renderTimeline(document.getElementById('guideBeginnerTimeline'), BEGINNER_STEPS, TOTAL_BEGINNER_STEPS);
      renderStepNav(document.getElementById('guideBeginnerStepNav'), BEGINNER_STEPS);
      renderStepDetail(document.getElementById('guideBeginnerStepDetail'), BEGINNER_STEPS);
      updateRewardPreviewButton();
    } else if (state.track === 'expert') {
      renderProgress('guideExpert');
      renderTimeline(document.getElementById('guideExpertTimeline'), EXPERT_STEPS, TOTAL_EXPERT_STEPS);
      renderStepNav(document.getElementById('guideExpertStepNav'), EXPERT_STEPS);
      renderStepDetail(document.getElementById('guideExpertStepDetail'), EXPERT_STEPS);
    }
  }

  function setGuideTrack(track) {
    state.track = track;
    var isBeginner = track === 'beginner';
    state.selectedStepId = isBeginner ? getFirstOpenStepId(TOTAL_BEGINNER_STEPS) : 1;

    if (beginnerPanel) {
      beginnerPanel.classList.toggle('is-hidden', !isBeginner);
      if (isBeginner) {
        beginnerPanel.removeAttribute('hidden');
        beginnerPanel.setAttribute('aria-hidden', 'false');
      } else {
        beginnerPanel.setAttribute('hidden', '');
        beginnerPanel.setAttribute('aria-hidden', 'true');
      }
    }
    if (expertPanel) {
      expertPanel.classList.toggle('is-hidden', isBeginner);
      if (isBeginner) {
        expertPanel.setAttribute('hidden', '');
        expertPanel.setAttribute('aria-hidden', 'true');
      } else {
        expertPanel.removeAttribute('hidden');
        expertPanel.setAttribute('aria-hidden', 'false');
      }
    }
    if (titleEl) titleEl.textContent = isBeginner ? '초급 학습 가이드' : '고급 학습 가이드';
    if (subtitleEl) {
      subtitleEl.textContent = '';
      subtitleEl.classList.add('is-hidden');
      subtitleEl.setAttribute('hidden', '');
    }
    if (explainBtn) explainBtn.style.display = '';
    renderDashboard();
    var activePanel = isBeginner ? beginnerPanel : expertPanel;
    if (activePanel) {
      requestAnimationFrame(function () {
        initLumiImages();
        repaintGuideImages(activePanel);
      });
    }
  }

  function openGuideTrack(track) {
    if (landingEl) {
      landingEl.classList.add('is-hidden');
      landingEl.setAttribute('hidden', '');
      landingEl.setAttribute('aria-hidden', 'true');
    }
    if (mainContentEl) {
      mainContentEl.classList.remove('is-hidden');
      mainContentEl.removeAttribute('hidden');
      mainContentEl.setAttribute('aria-hidden', 'false');
    }
    setGuideTrack(track);
    syncGuidePageScroll();
  }

  var tutorialIntroSteps = [
    {
      mood: 'welcome',
      title: '주린이 웹이 뭐예요?',
      text:
        '「주린이」는 주식 초보를 뜻하는 말이에요. 주린닷컴은 주린이도 부담 없이 시세·용어·분석을 익히도록 만든 웹 서비스예요. 지금 설명하는 건 이 사이트에서 튜토리얼이 어떻게 돌아가는지만 짧게 알려 주는 거예요.',
    },
    {
      mood: 'success',
      title: '가이드 탭은 뭐 하는 곳이에요?',
      text:
        '지금 보고 있는 이 가이드 메뉴는 단계별로 무엇을 배우면 좋은지 정리해 둔 공간이에요. 각 단계에서 바로 연습으로 이어지거나, 글만 읽어도 흐름을 잡을 수 있어요.',
    },
    {
      mood: 'info',
      title: '튜토리얼은 어떻게 진행되나요?',
      text:
        '1단계는 시황판·거래량·거래대금, 2단계는 삼성전자 차트, 3단계는 종목 가치, 4단계는 시장 종류(ETF·ELW·채권), 5단계는 모의투자로 차트·시세·호가와 지정가 매수를 연습해요. 고수 코스는 심화 전략과 추세·지지·저항 2단계예요.',
    },
    {
      mood: 'success',
      title: '설명은 여기까지!',
      text:
        '이제 가이드 페이지에서 원하는 단계를 골라 학습하면 돼요. 막히면 다시 이 버튼으로 설명을 들어도 되고, 시장·용어 메뉴와도 자연스럽게 이어져요. 화이팅!',
    },
  ];

  function resetTutorialIntro() {
    introIdx = 0;
    introActive = false;
  }

  function showTutorialIntroStep() {
    if (!introActive || !window.MascotCoach || typeof window.MascotCoach.show !== 'function') return;
    if (introIdx >= tutorialIntroSteps.length) {
      resetTutorialIntro();
      window.MascotCoach.close();
      if (window.MascotCoach.hideDock) window.MascotCoach.hideDock();
      return;
    }
    var step = tutorialIntroSteps[introIdx];
    var last = introIdx === tutorialIntroSteps.length - 1;
    window.MascotCoach.show({
      layout: 'spotlight',
      mood: step.mood,
      title: step.title,
      text: step.text,
      confirmLabel: last ? '알겠어요' : '확인',
      onConfirm: function () {
        introIdx += 1;
        if (last) {
          resetTutorialIntro();
          window.MascotCoach.close();
          if (window.MascotCoach.hideDock) window.MascotCoach.hideDock();
          return;
        }
        showTutorialIntroStep();
      },
      onDismiss: function () {
        resetTutorialIntro();
        if (window.MascotCoach.hideDock) window.MascotCoach.hideDock();
      },
    });
  }

  function openTutorialExplain() {
    introIdx = 0;
    introActive = true;
    showTutorialIntroStep();
  }

  if (pickBeginnerBtn) pickBeginnerBtn.addEventListener('click', function () { openGuideTrack('beginner'); });
  if (pickExpertBtn) pickExpertBtn.addEventListener('click', function () { openGuideTrack('expert'); });
  if (backToModeBtn) backToModeBtn.addEventListener('click', showModeLanding);
  if (explainBtn) explainBtn.addEventListener('click', openTutorialExplain);

  var rewardPreviewBtn = document.getElementById('guideRewardPreviewBtn');
  if (rewardPreviewBtn && window.LumiCon) {
    rewardPreviewBtn.addEventListener('click', function () {
      window.LumiCon.openRewardPreviewModal({
        onClaimed: function () {
          updateRewardPreviewButton();
        },
      });
    });
    updateRewardPreviewButton();
  }

  applyTemporaryGuideFullClear();
  showModeLanding();
  syncGuidePageScroll();
  initLumiImages();

  window.addEventListener('storage', function (e) {
    if (e.key === TUTORIAL_MASK_KEY && state.track) renderDashboard();
  });
  window.addEventListener('pageshow', function () {
    if (state.track) {
      state.selectedStepId =
        state.track === 'beginner' ? getFirstOpenStepId(TOTAL_BEGINNER_STEPS) : state.selectedStepId;
      renderDashboard();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var root = document.getElementById('mascotCoach');
    if (!root || !root.classList.contains('mascot-coach--spotlight')) return;
    if (window.MascotCoach && typeof window.MascotCoach.close === 'function') {
      window.MascotCoach.close();
    }
  });
})();
