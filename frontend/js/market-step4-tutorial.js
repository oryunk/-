/**
 * market.html + market-products.html 4단계: ETF·ELW·채권
 */
(function () {
  var TUTORIAL_MASK_KEY = 'jurinGuideTutorialBits';
  var STATE_KEY = 'jurinStep4State';

  var STEP_WELCOME = 0;
  var STEP_ETF_CONCEPT = 1;
  var STEP_ETF_BOTH = 2;
  var STEP_SECTOR_ETF = 3;
  var STEP_SECTOR_EXPLAIN = 4;
  var STEP_THEME = 5;
  var STEP_NAV_ELW = 6;
  var STEP_ELW_INTRO = 7;
  var STEP_ELW_PAYOFF = 8;
  var STEP_ELW_USE = 9;
  var STEP_ELW_RISK = 10;
  var STEP_NAV_BONDS = 11;
  var STEP_BONDS_FLOW = 12;
  var STEP_BONDS_TYPES = 13;
  var STEP_BONDS_RISK = 14;
  var STEP_WRAP_UP = 15;
  var STEP_FINAL = 16;

  var STEP4_QUIZ = [
    {
      text: '문제 1/5 (O/X)\nETF는 여러 종목을 한 바구니에 담아 분산 투자하는 상품이다.',
      correct: 1,
      correctHint: '맞아! 한 종목만 고르기 어려울 때 ETF로 묶어서 볼 수 있어.',
      wrongHint: 'ETF는 여러 종목·자산을 묶은 상품이야.',
    },
    {
      text: '문제 2/5 (O/X)\n섹터는 AI·로봇처럼 이슈로 묶인 테마와 같은 뜻이다.',
      correct: 2,
      correctHint: '맞아! 섹터는 산업 묶음, 테마는 이슈·관심사 묶음이야.',
      wrongHint: '섹터는 반도체·바이오 같은 산업, 테마는 AI·우주산업 같은 이슈야.',
    },
    {
      text: '문제 3/5 (O/X)\n콜 ELW는 기초자산 가격이 오를 것 같을 때 살펴보는 편이다.',
      correct: 1,
      correctHint: '정답! 상승 예상 → 콜, 하락 예상 → 풋이야.',
      wrongHint: '콜은 오를 때, 풋은 내릴 때 연결해서 기억해 봐.',
    },
    {
      text: '문제 4/5 (O/X)\n채권은 주식처럼 회사의 주인이 되는 투자다.',
      correct: 2,
      correctHint: '맞아! 채권은 돈을 빌려주고 이자를 받는 구조에 가까워.',
      wrongHint: '채권은 빌려주는 입장, 주식은 지분을 사는 입장이야.',
    },
    {
      text: '문제 5/5 (O/X)\nELW는 변동성이 작아 초보에게 가장 안전한 상품이다.',
      correct: 2,
      correctHint: '맞아! ELW는 레버리지·만기 특성 때문에 위험이 클 수 있어.',
      wrongHint: 'ELW는 수익·손실 폭이 클 수 있는 상품이야. 주의가 필요해.',
    },
  ];

  var interaction = {
    clickedElwNav: false,
    clickedBondsNav: false,
  };

  function getEl(id) {
    return document.getElementById(id);
  }

  function scrollTutorialTargetsIntoViewIfNeeded(elements, opts) {
    opts = opts || {};
    if (!elements || !elements.length) return;
    var primary = elements[0];
    if (!primary || typeof primary.getBoundingClientRect !== 'function') return;
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        var r = primary.getBoundingClientRect();
        var vh = window.innerHeight || document.documentElement.clientHeight;
        var vw = window.innerWidth || document.documentElement.clientWidth;
        var topMargin = typeof opts.topMargin === 'number' ? opts.topMargin : 100;
        var bottomMargin = typeof opts.bottomMargin === 'number' ? opts.bottomMargin : 40;
        var coachReserve = typeof opts.coachBottomReserve === 'number' ? opts.coachBottomReserve : 0;
        var sideMargin = 8;
        var viewBottom = vh - bottomMargin - coachReserve;
        var clipped =
          r.top < topMargin ||
          r.bottom > viewBottom ||
          r.left < sideMargin ||
          r.right > vw - sideMargin;
        var pinBottom = Boolean(opts.pinBottomAboveReserve);
        if (!pinBottom && !clipped && !opts.alwaysNudge) return;
        if (clipped || opts.alwaysNudge) {
          var block = opts.scrollBlock || 'center';
          if (pinBottom) block = 'nearest';
          try {
            primary.scrollIntoView({ behavior: 'smooth', block: block, inline: 'nearest' });
          } catch (e) {
            primary.scrollIntoView(true);
          }
        }
        if (pinBottom) {
          var reserve = typeof opts.coachBottomReserve === 'number' ? opts.coachBottomReserve : 240;
          var gap = typeof opts.pinGap === 'number' ? opts.pinGap : 14;
          var delay = typeof opts.pinDelay === 'number' ? opts.pinDelay : 480;
          window.setTimeout(function () {
            var r2 = primary.getBoundingClientRect();
            var vh2 = window.innerHeight || document.documentElement.clientHeight;
            var targetLine = vh2 - bottomMargin - reserve - gap;
            var delta = r2.bottom - targetLine;
            if (Math.abs(delta) > 5) {
              try {
                window.scrollBy({ top: delta, left: 0, behavior: 'smooth' });
              } catch (e2) {
                window.scrollBy(0, delta);
              }
            }
          }, delay);
        }
      });
    });
  }

  function isSectorStep(stepIndex) {
    return stepIndex >= STEP_ETF_CONCEPT && stepIndex <= STEP_SECTOR_EXPLAIN;
  }

  function isMarketPage() {
    var p = window.location.pathname || '';
    return /market\.html/i.test(p) && !/market-products/i.test(p);
  }

  function isProductsPage() {
    return /market-products\.html/i.test(window.location.pathname || '');
  }

  function pageContext() {
    if (!isProductsPage()) return 'market';
    var topic = (new URLSearchParams(window.location.search).get('topic') || 'elw').toLowerCase();
    return topic === 'bonds' ? 'products-bonds' : 'products-elw';
  }

  function stepPage(step) {
    if (step <= STEP_THEME) return 'market';
    if (step <= STEP_ELW_RISK) return 'products-elw';
    if (step === STEP_NAV_BONDS) return 'products-elw';
    if (step <= STEP_BONDS_RISK) return 'products-bonds';
    return 'products';
  }

  function sectorBtn(key) {
    var el = document.querySelector('#sectorBtnGrid button[data-sector="' + key + '"]');
    return el ? [el] : [];
  }

  function sectorSectionTarget() {
    var sec = document.querySelector('.sector-section');
    return sec ? [sec] : [];
  }

  function elwNavTargets() {
    var a = document.querySelector('nav a[href*="topic=elw"]');
    return a ? [a] : [];
  }

  function bondsNavTargets() {
    var a = document.querySelector('nav a[href*="topic=bonds"]');
    return a ? [a] : [];
  }

  function activateElwTab(tabId) {
    var root = getEl('elwGuideRoot');
    if (!root || root.hidden) return;
    if (!window.ElwGuide || typeof window.ElwGuide.setActiveTab !== 'function') return;
    var normalized = window.ElwGuide.normalizeTab(tabId);
    var activeBtn = root.querySelector('.elw-tab-btn.is-active');
    if (activeBtn && activeBtn.getAttribute('data-tab') === normalized) return;
    window.ElwGuide.setActiveTab(root, tabId, { skipHistory: true });
  }

  function activateBondsTab(tabId) {
    var root = getEl('bondsGuideRoot');
    if (!root || root.hidden) return;
    if (!window.BondsGuide || typeof window.BondsGuide.setActiveTab !== 'function') return;
    var normalized = window.BondsGuide.normalizeTab(tabId);
    var activeBtn = root.querySelector('.bonds-tab-btn.is-active');
    if (activeBtn && activeBtn.getAttribute('data-tab') === normalized) return;
    window.BondsGuide.setActiveTab(root, tabId, { skipHistory: true });
  }

  function buildSteps() {
    return [
      {
        objective: '4단계 시작',
        mood: 'excited',
        coachBeats: [
          '좋아! 이제 주식 말고도 어떤 투자 상품들이 있는지 알아볼 차례야.',
          'ETF, ELW, 채권 같은 용어를 자주 보게 될 텐데, 오늘은 각각 어떤 상품인지 쉽게 알아보자!',
        ],
        targets: function () { return []; },
        done: function () { return true; },
      },
      {
        objective: 'ETF 개념 익히기',
        mood: 'happy',
        coachBeats: [
          '먼저 ETF야. 여러 종목을 한 번에 담아 놓은 상품이라고 생각하면 돼.',
          '한 종목만 고르기 어려울 때 시장·산업 흐름을 넓게 보는 데 자주 쓰여.',
        ],
        targets: sectorSectionTarget,
        done: function () { return true; },
      },
      {
        objective: '지수·섹터 ETF 보기',
        mood: 'curious',
        coachBeats: [
          '시장 화면 아래 「관심 섹터」에 지수ETF와 섹터ETF 버튼이 있어.',
          '지수ETF는 코스피·코스닥처럼 시장 전체 흐름, 섹터ETF는 특정 산업 묶음에 가깝게 투자할 때 살펴봐.',
        ],
        targets: function () {
          return sectorBtn('지수ETF').concat(sectorBtn('섹터ETF'));
        },
        done: function () { return true; },
      },
      {
        objective: '섹터 ETF 집중 보기',
        mood: 'idea',
        coachBeats: [
          '섹터ETF는 반도체·바이오·2차전지처럼 비슷한 산업끼리 묶은 ETF야.',
          '「어떤 산업이 좋아 보이는데 종목 고르기 어렵다」면 섹터ETF로 넓게 볼 수 있어.',
        ],
        targets: function () { return sectorBtn('섹터ETF'); },
        done: function () { return true; },
      },
      {
        objective: '섹터 이해하기',
        mood: 'studying',
        coachBeats: [
          '섹터는 산업별 분류라고 기억하면 돼. 반도체, 금융, 바이오처럼 비슷한 기업들이 한 그룹이야.',
          '옆의 다른 섹터 버튼들도 같은 맥락으로 산업별 묶음을 보여줘.',
        ],
        targets: function () {
          var etf = sectorBtn('섹터ETF');
          var semi = document.querySelector('#sectorBtnGrid button[data-sector="전기/전자"]');
          return etf.concat(semi ? [semi] : []);
        },
        done: function () { return true; },
      },
      {
        objective: '테마와 섹터 차이',
        mood: 'good_idea',
        coachBeats: [
          '테마는 섹터와 조금 달라. AI, 로봇, 우주산업처럼 특정 이슈·관심사로 묶인 그룹이야.',
          '같은 기업도 상황에 따라 여러 테마에 함께 언급되기도 해.',
        ],
        targets: function () { return []; },
        done: function () { return true; },
      },
      {
        objective: 'ELW 페이지로 이동',
        mood: 'happy',
        coachBeats: [
          '이제 ELW를 보러 갈게! 상단 메뉴의 ELW 링크를 눌러줘.',
        ],
        targets: elwNavTargets,
        done: function () { return interaction.clickedElwNav; },
      },
      {
        objective: 'ELW 개념',
        mood: 'curious',
        coachBeats: [
          'ELW는 적은 금액으로 더 큰 변동을 기대할 수 있는 상품이야.',
          '대신 위험도 커서, 구조를 이해한 뒤에 살펴보는 게 좋아.',
        ],
        targets: function () {
          var h = getEl('productHero');
          return h ? [h] : [];
        },
        done: function () { return true; },
      },
      {
        objective: '콜·풋과 손익',
        mood: 'chart',
        coachBeats: [
          '「콜·풋과 손익」 탭을 보면 콜 ELW와 풋 ELW 카드가 나와.',
          '콜은 오를 때, 풋은 내릴 때 살펴보는 쪽이고, 아래 그래프는 만기 예상 손익 구조를 보여줘.',
        ],
        targets: function () {
          activateElwTab('payoff');
          var cards = document.querySelectorAll('#elwGuideRoot .elw-type-card');
          return Array.prototype.slice.call(cards);
        },
        done: function () { return true; },
      },
      {
        objective: 'ELW 특징·활용',
        mood: 'info',
        coachBeats: [
          '「특징·활용」 탭에서는 ELW를 언제 참고하는지, 어떤 점을 유의하는지 정리돼 있어.',
          '레버리지·만기 같은 키워드를 같이 봐 두면 좋아.',
        ],
        targets: function () {
          activateElwTab('use');
          var tab = getEl('elw-tab-use');
          var panel = getEl('elw-panel-use');
          return [tab, panel].filter(Boolean);
        },
        done: function () { return true; },
      },
      {
        objective: 'ELW 지표·주의',
        mood: 'caution',
        coachBeats: [
          '「지표·주의」 탭의 지표 카드와 경고 문구를 확인해 봐.',
          '행사가·손익분기점·만기 같은 용어는 나중에 실전에서도 자주 보게 될 거야.',
        ],
        targets: function () {
          activateElwTab('risk');
          var tab = getEl('elw-tab-risk');
          var indicators = document.querySelector('#elwGuideRoot .elw-indicator-grid');
          return [tab].concat(indicators ? [indicators] : []).filter(Boolean);
        },
        done: function () { return true; },
      },
      {
        objective: '채권 페이지로 이동',
        mood: 'happy',
        coachBeats: [
          '이번엔 채권! 상단 메뉴의 채권 링크를 눌러줘.',
        ],
        targets: bondsNavTargets,
        done: function () { return interaction.clickedBondsNav; },
      },
      {
        objective: '채권 돈 흐름',
        mood: 'happy',
        coachBeats: [
          '「돈 흐름과 예시」 탭의 도식을 보면 투자자가 돈을 빌려주고 이자를 받는 흐름이 그려져 있어.',
          '만기에 원금을 돌려받는 구조라고 이해하면 쉬워.',
        ],
        targets: function () {
          activateBondsTab('flow');
          var tab = getEl('bonds-tab-flow');
          var panel = getEl('bonds-panel-flow');
          return [tab, panel].filter(Boolean);
        },
        done: function () { return true; },
      },
      {
        objective: '채권 종류·금리',
        mood: 'studying',
        coachBeats: [
          '「종류·금리」 탭에서는 국채·회사채 같은 종류와 금리 개념을 정리해 둔 부분이야.',
          '주식보다 변동이 작은 편이라 안정적 자산으로도 많이 언급돼.',
        ],
        targets: function () {
          activateBondsTab('types');
          var tab = getEl('bonds-tab-types');
          var panel = getEl('bonds-panel-types');
          return [tab, panel].filter(Boolean);
        },
        done: function () { return true; },
      },
      {
        objective: '채권 용어·주의',
        mood: 'info',
        coachBeats: [
          '「용어·주의」 탭에서 YTM·듀레이션 같은 용어와 투자 시 확인할 점을 볼 수 있어.',
          '채권도 이자·가격 변동 이슈가 있으니 주의 문구를 같이 읽어 보자.',
        ],
        targets: function () {
          activateBondsTab('risk');
          var tab = getEl('bonds-tab-risk');
          var panel = getEl('bonds-panel-risk');
          return [tab, panel].filter(Boolean);
        },
        done: function () { return true; },
      },
      {
        objective: '마무리 안내',
        mood: 'info',
        coachBeats: [
          '오늘은 ETF, ELW, 채권을 간략하게 살펴봤어.',
          '이 가이드가 끝난 뒤 더 보고 싶으면 상단 ELW·채권 탭에서 천천히 다시 훑어봐도 좋아.',
          '이제 퀴즈로 오늘 내용을 확인해 보자!',
        ],
        targets: function () { return []; },
        done: function () { return true; },
        triggersQuiz: true,
      },
      {
        objective: '4단계 완료',
        mood: 'success',
        coachBeats: [
          '4단계를 완료했어! ETF, ELW, 채권이 어떤 차이를 가지는지 이해하게 됐네.',
          '앞으로 투자 정보를 볼 때도 상품 성격을 먼저 확인하면 훨씬 쉽게 이해할 수 있을 거야.',
          '이제 마지막 단계인 모의투자를 직접 체험해보자!',
        ],
        targets: function () { return []; },
        done: function () { return true; },
      },
    ];
  }

  function persistStep4Complete() {
    if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.markTutorialStepComplete === 'function') {
      window.JurinTutorialUtil.markTutorialStepComplete(4);
      return;
    }
    try {
      var m = parseInt(localStorage.getItem(TUTORIAL_MASK_KEY + ':anon'), 10);
      if (isNaN(m) || m < 0) m = 0;
      m |= 1 << 3;
      localStorage.setItem(TUTORIAL_MASK_KEY + ':anon', String(m));
    } catch (e) { /* ignore */ }
  }

  function init() {
    var overlay = getEl('marketStep4Overlay');
    var clearEl = getEl('marketStep4Clear');
    if (!overlay || !clearEl) return;

    var STEPS = buildSteps();
    var current = 0;
    var dialogueBeatIndex = 0;
    var activeTargets = [];
    var started = false;
    var step4QuizActive = false;
    var pendingPersist = false;
    var calloutKeepAlive = null;

    function saveState() {
      try {
        sessionStorage.setItem(
          STATE_KEY,
          JSON.stringify({
            current: current,
            started: started,
            interaction: interaction,
            step4QuizActive: step4QuizActive,
          })
        );
      } catch (e) { /* ignore */ }
    }

    function loadState() {
      try {
        var raw = sessionStorage.getItem(STATE_KEY);
        if (!raw) return;
        var s = JSON.parse(raw);
        if (typeof s.current === 'number') current = s.current;
        if (s.started) started = true;
        if (s.interaction) {
          interaction.clickedElwNav = Boolean(s.interaction.clickedElwNav);
          interaction.clickedBondsNav = Boolean(s.interaction.clickedBondsNav);
        }
        step4QuizActive = Boolean(s.step4QuizActive);
      } catch (e) { /* ignore */ }
    }

    function markStep4Handoff() {
      if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.markTutorialHandoff === 'function') {
        window.JurinTutorialUtil.markTutorialHandoff(4);
      }
    }

    function ensurePageForStep() {
      if (!started) return;
      var need = stepPage(current);
      var here = pageContext();
      if (need === 'market' && here !== 'market') {
        markStep4Handoff();
        saveState();
        window.location.replace('market.html?tutorial=step4');
        return false;
      }
      if (need === 'products-elw' && here !== 'products-elw') {
        markStep4Handoff();
        saveState();
        window.location.replace('market-products.html?topic=elw&tutorial=step4');
        return false;
      }
      if (need === 'products-bonds' && here !== 'products-bonds') {
        markStep4Handoff();
        saveState();
        window.location.replace('market-products.html?topic=bonds&tutorial=step4');
        return false;
      }
      return true;
    }

    function clearTargets() {
      activeTargets.forEach(function (el) {
        if (el && el.classList) {
          el.classList.remove('tutorial-callout-target');
          el.classList.remove('market-step4-lift');
        }
      });
      activeTargets = [];
      document.querySelectorAll('nav.market-step4-nav-lift').forEach(function (nav) {
        nav.classList.remove('market-step4-nav-lift');
      });
    }

    function attachCalloutTarget(el) {
      if (!el || !el.classList) return false;
      var exists = false;
      for (var i = 0; i < activeTargets.length; i++) {
        if (activeTargets[i] === el) {
          exists = true;
          break;
        }
      }
      if (!exists) activeTargets.push(el);
      if (!el.classList.contains('tutorial-callout-target')) {
        el.classList.add('tutorial-callout-target');
      }
      if (!el.classList.contains('market-step4-lift')) {
        el.classList.add('market-step4-lift');
      }
      return true;
    }

    function sectorScrollAnchor() {
      return document.getElementById('sectorBtnGrid') || document.querySelector('.sector-section');
    }

    function ensureSectorInView() {
      var sectorAnchor = sectorScrollAnchor();
      if (!sectorAnchor) return;
      scrollTutorialTargetsIntoViewIfNeeded([sectorAnchor], {
        alwaysNudge: true,
        scrollBlock: 'center',
        coachBottomReserve: 240,
      });
    }

    function scrollTargetsForCurrentStep(skipScroll) {
      if (isSectorStep(current)) {
        if (!skipScroll) {
          ensureSectorInView();
          window.setTimeout(ensureSectorInView, 400);
          window.setTimeout(ensureSectorInView, 900);
        }
        return;
      }
      if (skipScroll) return;
      if (current === STEP_NAV_ELW || current === STEP_NAV_BONDS) {
        var navLink = activeTargets[0];
        if (navLink) {
          scrollTutorialTargetsIntoViewIfNeeded([navLink], {
            alwaysNudge: true,
            scrollBlock: 'start',
            topMargin: 0,
          });
        }
        return;
      }
      if (current === STEP_ELW_PAYOFF) {
        var firstCard = document.querySelector('#elwGuideRoot .elw-type-card');
        if (firstCard) {
          window.setTimeout(function () {
            if (!started || current !== STEP_ELW_PAYOFF) return;
            scrollTutorialTargetsIntoViewIfNeeded([firstCard], {
              scrollBlock: 'center',
              coachBottomReserve: 240,
            });
          }, 100);
        }
        return;
      }
      if (activeTargets.length) {
        scrollTutorialTargetsIntoViewIfNeeded(activeTargets, { coachBottomReserve: 240 });
      }
    }

    function updateNavSpotlight() {
      var navSpot = started && (current === STEP_NAV_ELW || current === STEP_NAV_BONDS);
      document.body.classList.toggle('market-step4-nav-spotlight', navSpot);
      if (navSpot && activeTargets.length) {
        var navEl = activeTargets[0].closest && activeTargets[0].closest('nav');
        if (navEl && !navEl.classList.contains('market-step4-nav-lift')) {
          navEl.classList.add('market-step4-nav-lift');
        }
      }
    }

    function applyTargetsFromStep(step, opts) {
      opts = opts || {};
      clearTargets();
      if (!step || typeof step.targets !== 'function') {
        updateNavSpotlight();
        return;
      }
      var raw = step.targets();
      if (!raw || !raw.length) {
        updateNavSpotlight();
        return;
      }
      var list = Array.isArray(raw) ? raw : [raw];
      list.filter(Boolean).forEach(attachCalloutTarget);
      scrollTargetsForCurrentStep(opts.skipScroll);
      updateNavSpotlight();
    }

    function startCalloutKeepAlive() {
      if (calloutKeepAlive) window.clearInterval(calloutKeepAlive);
      calloutKeepAlive = window.setInterval(function () {
        if (!started || step4QuizActive || document.body.classList.contains('market-step4-clear-phase')) {
          return;
        }
        applyTargetsFromStep(STEPS[current], { skipScroll: true });
        if (isSectorStep(current)) ensureSectorInView();
      }, 350);
    }

    function stopCalloutKeepAlive() {
      if (calloutKeepAlive) {
        window.clearInterval(calloutKeepAlive);
        calloutKeepAlive = null;
      }
    }

    function updateOverlayDim() {
      var inClear = document.body.classList.contains('market-step4-clear-phase');
      if (inClear || step4QuizActive) {
        overlay.classList.remove('is-dim');
        document.body.classList.remove('market-step4-dim-active', 'market-step4-nav-spotlight');
        return;
      }
      var dimOn = started && (current === STEP_NAV_ELW || current === STEP_NAV_BONDS);
      overlay.classList.toggle('is-dim', dimOn);
      document.body.classList.toggle('market-step4-dim-active', dimOn);
      updateNavSpotlight();
    }

    function showCoachMessage(opts) {
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') return;
      window.MascotCoach.show({
        mood: opts.mood || 'info',
        title: opts.title || '루미',
        text: opts.text || '',
        confirmLabel: opts.confirmLabel || '확인',
        onConfirm: opts.onConfirm || function () {},
        dismissLabel: opts.dismissLabel,
        onDismiss: opts.onDismiss,
      });
    }

    function getCoachBeats(step) {
      if (!step) return [''];
      if (step.coachBeats && step.coachBeats.length) return step.coachBeats;
      if (step.coach) return [step.coach];
      return [''];
    }

    function showCoach(step, extra) {
      if (!step) return;
      var beats = getCoachBeats(step);
      var text = beats[dialogueBeatIndex] || beats[0] || '';
      showCoachMessage({
        mood: step.mood || 'info',
        text: text,
        onConfirm: function () {
          if (dialogueBeatIndex < beats.length - 1) {
            dialogueBeatIndex += 1;
            showCoach(step, extra);
            return;
          }
          dialogueBeatIndex = 0;
          if (extra && typeof extra.onConfirm === 'function') {
            extra.onConfirm();
            return;
          }
          if (extra && typeof extra.onAfterBeats === 'function') {
            extra.onAfterBeats();
            return;
          }
          proceed();
        },
      });
    }

    function beginClearPhase() {
      current = STEP_FINAL;
      dialogueBeatIndex = 0;
      pendingPersist = true;
      persistStep4Complete();
      step4QuizActive = false;
      document.body.classList.add('market-step4-clear-phase');
      document.body.classList.add('tutorial-fx-clear');
      overlay.classList.remove('is-dim');
      overlay.classList.add('is-clear-dim');
      document.body.classList.remove('market-step4-dim-active', 'market-step4-nav-spotlight');
      stopCalloutKeepAlive();
      clearTargets();
      clearEl.classList.add('is-show');
      saveState();
      try {
        sessionStorage.removeItem(STATE_KEY);
      } catch (e) { /* ignore */ }

      function finishAndGoGuide() {
        pendingPersist = false;
        if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.restoreNormalSiteUi === 'function') {
          window.JurinTutorialUtil.restoreNormalSiteUi({ stripTutorial: true });
        }
        window.location.replace('guide.html');
      }

      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        finishAndGoGuide();
        return;
      }
      showCoach(STEPS[STEP_FINAL], { onConfirm: finishAndGoGuide });
    }

    function runQuizThenFinal() {
      step4QuizActive = true;
      overlay.classList.remove('is-dim');
      document.body.classList.remove('market-step4-dim-active', 'market-step4-nav-spotlight');
      stopCalloutKeepAlive();
      clearTargets();
      saveState();
      if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
        step4QuizActive = false;
        beginClearPhase();
        return;
      }
      function finishQuizSuccess() {
        step4QuizActive = false;
        showCoachMessage({
          mood: 'success',
          text: '5문제 모두 확인했어! 상품 종류 살펴보기 수고했어.',
          onConfirm: beginClearPhase,
        });
      }
      function showQuizAt(idx) {
        if (idx >= STEP4_QUIZ.length) {
          finishQuizSuccess();
          return;
        }
        var q = STEP4_QUIZ[idx];
        showCoachMessage({
          mood: 'info',
          title: '루미 퀴즈',
          text: q.text,
          confirmLabel: 'O',
          dismissLabel: 'X',
          onConfirm: function () {
            showCoachMessage({
              mood: q.correct === 1 ? 'success' : 'caution',
              text: q.correct === 1 ? '정답이야!\n' + q.correctHint : '아쉽지만 오답이야.\n' + q.wrongHint,
              confirmLabel: '다음 문제',
              onConfirm: function () { showQuizAt(idx + 1); },
            });
          },
          onDismiss: function () {
            showCoachMessage({
              mood: q.correct === 2 ? 'success' : 'caution',
              text: q.correct === 2 ? '정답이야!\n' + q.correctHint : '아쉽지만 오답이야.\n' + q.wrongHint,
              confirmLabel: '다음 문제',
              onConfirm: function () { showQuizAt(idx + 1); },
            });
          },
        });
      }
      showQuizAt(0);
    }

    function render(stepIndex) {
      if (!ensurePageForStep()) return;
      current = stepIndex;
      dialogueBeatIndex = 0;
      var step = STEPS[current];
      applyTargetsFromStep(step);
      updateOverlayDim();
      saveState();
      showCoach(step);
    }

    function proceed() {
      if (!started) return;
      var step = STEPS[current];
      if (!step || typeof step.done !== 'function') return;
      if (!step.done()) {
        showCoach(step);
        return;
      }
      if (step.triggersQuiz) {
        runQuizThenFinal();
        return;
      }
      if (current >= STEPS.length - 1) {
        beginClearPhase();
        return;
      }
      render(current + 1);
    }

    function openTutorial() {
      started = true;
      interaction.clickedElwNav = false;
      interaction.clickedBondsNav = false;
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.remove('market-step4-pending');
      document.body.classList.add('market-step4-active');
      document.body.classList.add('tutorial-fx-active');
      if (window.JurinGuideLumi && typeof window.JurinGuideLumi.start === 'function') {
        window.JurinGuideLumi.start();
      }
      window.__jurinGuideQuit = function () { closeTutorial(true); };
      syncGuard();
      startCalloutKeepAlive();
      render(STEP_WELCOME);
    }

    function closeTutorial(fromUserQuit) {
      started = false;
      step4QuizActive = false;
      stopCalloutKeepAlive();
      clearTargets();
      overlay.classList.remove('is-open', 'is-dim', 'is-clear-dim');
      overlay.setAttribute('aria-hidden', 'true');
      clearEl.classList.remove('is-show');
      document.body.classList.remove(
        'market-step4-active',
        'market-step4-pending',
        'market-step4-dim-active',
        'market-step4-nav-spotlight',
        'market-step4-clear-phase',
        'tutorial-fx-active',
        'tutorial-fx-clear'
      );
      if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.clearTutorialProgress === 'function') {
        window.JurinTutorialUtil.clearTutorialProgress(4);
      } else {
        try {
          sessionStorage.removeItem(STATE_KEY);
        } catch (e) { /* ignore */ }
      }
      if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.restoreNormalSiteUi === 'function') {
        window.JurinTutorialUtil.restoreNormalSiteUi({
          stripTutorial: fromUserQuit === true,
        });
      }
      if (window.JurinTutorialGuard) window.JurinTutorialGuard.clear();
      window.__jurinGuideQuit = null;
    }

    function isActionRequiredStep() {
      if (step4QuizActive) return false;
      if (current === STEP_NAV_ELW && !interaction.clickedElwNav) return true;
      if (current === STEP_NAV_BONDS && !interaction.clickedBondsNav) return true;
      return false;
    }

    function isCoachOnlyStep() {
      return current >= STEP_WELCOME && current <= STEP_THEME;
    }

    function getCoachOnlyWrongMessage(target) {
      if (window.JurinTutorialGuard.isBlockedChromeClick(target)) return null;
      if (current >= STEP_ETF_CONCEPT && current <= STEP_ETF_BOTH) {
        return '지금은 ETF 설명을 들어봐! 확인을 눌러 줘.';
      }
      if (current >= STEP_SECTOR_ETF && current <= STEP_SECTOR_EXPLAIN) {
        return '지금은 안내한 섹터만 봐! 다른 버튼은 누르지 마.';
      }
      if (current === STEP_THEME) {
        return '지금은 테마 설명을 들어봐! 확인을 눌러 줘.';
      }
      return '지금은 루미의 안내를 들어봐! 확인 버튼을 눌러 줘.';
    }

    function allowsActionStepClick(target) {
      if (!isActionRequiredStep() || !target || !target.closest) return false;
      var G = window.JurinTutorialGuard;
      if (G.allowsSpotlightTargets(target)) return true;
      if (current === STEP_NAV_ELW && target.closest('a[href*="topic=elw"]')) {
        interaction.clickedElwNav = true;
        saveState();
        return true;
      }
      if (current === STEP_NAV_BONDS && target.closest('a[href*="topic=bonds"]')) {
        interaction.clickedBondsNav = true;
        saveState();
        return true;
      }
      return false;
    }

    function syncGuard() {
      if (!window.JurinTutorialGuard) return;
      window.JurinTutorialGuard.set({
        isActive: function () {
          return (
            started &&
            overlay.classList.contains('is-open') &&
            !document.body.classList.contains('market-step4-clear-phase') &&
            !step4QuizActive
          );
        },
        allowsClick: function (target) {
          var G = window.JurinTutorialGuard;
          if (G.allowsMascotAndQuest(target)) return true;
          if (allowsActionStepClick(target)) return true;
          if (G.isBlockedChromeClick(target)) return false;
          if (isCoachOnlyStep()) return false;
          if (!isActionRequiredStep()) {
            if (G.allowsSpotlightTargets(target)) return true;
            return false;
          }
          return false;
        },
        getWrongMessage: function (target) {
          if (isCoachOnlyStep()) {
            return getCoachOnlyWrongMessage(target);
          }
          if (!isActionRequiredStep()) return null;
          if (current === STEP_NAV_ELW) {
            if (target.closest && target.closest('a[href*="topic=elw"]')) return null;
            return '지금은 상단 메뉴에서 「ELW」를 눌러 줘!';
          }
          if (current === STEP_NAV_BONDS) {
            if (target.closest && target.closest('a[href*="topic=bonds"]')) return null;
            return '지금은 상단 메뉴에서 「채권」을 눌러 줘!';
          }
          if (window.JurinTutorialGuard.isBlockedChromeClick(target)) return null;
          return null;
        },
        onAfterWrong: function () {
          window.JurinTutorialGuard.restoreDockOrFallback(function () {
            showCoach(STEPS[current]);
          });
        },
      });
    }

    document.addEventListener('click', function (e) {
      if (!started) return;
      var elwLink = e.target.closest && e.target.closest('a[href*="topic=elw"]');
      if (current === STEP_NAV_ELW && elwLink) {
        e.preventDefault();
        interaction.clickedElwNav = true;
        markStep4Handoff();
        saveState();
        window.location.href = 'market-products.html?topic=elw&tutorial=step4';
        return;
      }
      var bondsLink = e.target.closest && e.target.closest('a[href*="topic=bonds"]');
      if (current === STEP_NAV_BONDS && bondsLink) {
        e.preventDefault();
        interaction.clickedBondsNav = true;
        markStep4Handoff();
        saveState();
        window.location.href = 'market-products.html?topic=bonds&tutorial=step4';
      }
    }, true);

    var params = new URLSearchParams(window.location.search);
    var tutorial = (params.get('tutorial') || '').toLowerCase().trim();
    if (tutorial !== 'step4' && tutorial !== '4') return;

    var tutorialUtil = window.JurinTutorialUtil;
    var freshStart =
      tutorialUtil && typeof tutorialUtil.consumeTutorialFreshStart === 'function'
        ? tutorialUtil.consumeTutorialFreshStart(4)
        : false;
    var handoff =
      !freshStart &&
      tutorialUtil &&
      typeof tutorialUtil.consumeTutorialHandoff === 'function'
        ? tutorialUtil.consumeTutorialHandoff(4)
        : false;
    if (freshStart && tutorialUtil && typeof tutorialUtil.clearTutorialProgress === 'function') {
      tutorialUtil.clearTutorialProgress(4);
    } else if (handoff) {
      loadState();
    } else {
      try {
        sessionStorage.removeItem(STATE_KEY);
      } catch (e) { /* ignore */ }
    }
    if (started && interaction.clickedElwNav && current === STEP_NAV_ELW && pageContext() === 'products-elw') {
      current = STEP_ELW_INTRO;
    }
    if (started && interaction.clickedBondsNav && current === STEP_NAV_BONDS && pageContext() === 'products-bonds') {
      current = STEP_BONDS_FLOW;
    }
    if (started) {
      if (!ensurePageForStep()) return;
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('market-step4-active');
      document.body.classList.add('tutorial-fx-active');
      if (window.JurinGuideLumi && typeof window.JurinGuideLumi.start === 'function') {
        window.JurinGuideLumi.start();
      }
      window.__jurinGuideQuit = function () { closeTutorial(true); };
      syncGuard();
      startCalloutKeepAlive();
      if (step4QuizActive) {
        runQuizThenFinal();
        return;
      }
      if (document.body.classList.contains('market-step4-clear-phase')) return;
      var step = STEPS[current];
      applyTargetsFromStep(step);
      updateOverlayDim();
      window.setTimeout(function () {
        showCoach(step);
      }, 350);
      return;
    }

    document.body.classList.add('market-step4-pending');
    window.setTimeout(openTutorial, 120);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
