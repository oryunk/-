/**
 * chart-lab.html 고수 가이드 (expert1 · expert2) — 퀴즈 없음, 스포트라이트만
 */
(function () {
  'use strict';

  var EXPERT1 = 'expert1';
  var EXPERT2 = 'expert2';

  var INTRO_BEATS_EXPERT1 = [
    '이번엔 차트에서 자주 보이는 대표 패턴들을 같이 살펴볼 거야.',
    '패턴은 주가가 움직이면서 만들어내는 반복적인 모양이야. 처음부터 다 외울 필요는 없어.',
    '「이런 모양이 나오면 사람들이 이런 식으로 해석하는구나」 정도로 보면 충분해!',
  ];
  var INTRO_MOODS_EXPERT1 = ['welcome', 'chart', 'excited'];

  var INTRO_BEATS_EXPERT2 = [
    '이제 패턴만 보는 단계에서 한 걸음 더 들어가 볼게.',
    '실제 투자자들은 패턴 하나만 보고 판단하지 않아. 지지선·저항선·이동평균선도 같이 봐.',
    '세 가지를 함께 보면 차트를 훨씬 입체적으로 읽을 수 있어!',
  ];
  var INTRO_MOODS_EXPERT2 = ['welcome', 'chart', 'happy'];

  var current = -1;
  var dialogueBeatIndex = 0;
  var introBeatIndex = 0;
  var introActive = false;
  var started = false;
  var completed = false;
  var inClearPhase = false;
  var tutorialMode = '';
  var overlay = null;
  var clearEl = null;

  function moodImage(mood) {
    if (!window.JURIN_LUMI_MOODS || typeof window.jurinLumiconAsset !== 'function') return '';
    var file = window.JURIN_LUMI_MOODS[mood];
    return file ? window.jurinLumiconAsset(file) : '';
  }

  function showCoachMessage(opts) {
    if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
      if (opts && typeof opts.onConfirm === 'function') opts.onConfirm();
      return;
    }
    var mood = opts.mood || 'info';
    var payload = {
      mood: mood,
      title: opts.title || '루미',
      text: opts.text || '',
      confirmLabel: opts.confirmLabel || '확인',
      onConfirm: opts.onConfirm || function () {},
    };
    var img = moodImage(mood);
    if (img) payload.image = img;
    if (opts.ephemeral) payload.ephemeral = true;
    window.MascotCoach.show(payload);
  }

  function parseTutorialMode() {
    try {
      var t = (new URLSearchParams(window.location.search).get('tutorial') || '')
        .toLowerCase()
        .trim();
      if (t === EXPERT1 || t === '1') return EXPERT1;
      if (t === EXPERT2 || t === '2') return EXPERT2;
    } catch (e) {
      /* ignore */
    }
    return '';
  }

  function isExpert1() {
    return tutorialMode === EXPERT1;
  }

  function coachBeats(step) {
    return step && step.coachBeats ? step.coachBeats : step && step.coach ? [step.coach] : [''];
  }

  function coachMoods(step) {
    return step && step.coachMoods ? step.coachMoods : ['info'];
  }

  function clearTargets() {
    document.querySelectorAll('.tutorial-callout-target').forEach(function (el) {
      el.classList.remove('tutorial-callout-target');
    });
  }

  function applyTargets(step) {
    clearTargets();
    var list = step && step.targets ? step.targets() : [];
    list.forEach(function (el) {
      if (el) el.classList.add('tutorial-callout-target');
    });
  }

  function runStepHooks(step) {
    if (step && typeof step.onEnter === 'function') step.onEnter();
  }

  function bootstrapCoachUi() {
    if (window.JurinGuideLumi && typeof window.JurinGuideLumi.start === 'function') {
      window.JurinGuideLumi.start();
    }
    document.body.classList.remove('mascot-coach-minimized');
    if (window.LumiChat && typeof window.LumiChat.close === 'function') {
      window.LumiChat.close();
    }
    if (window.MascotCoach) {
      if (typeof window.MascotCoach.close === 'function') {
        window.MascotCoach.close();
      }
      if (typeof window.MascotCoach.hideDock === 'function') {
        window.MascotCoach.hideDock();
      }
    }
  }

  function showCoach(step, opts) {
    opts = opts || {};
    if (!step) return;
    var beats = coachBeats(step);
    var moods = coachMoods(step);
    var text = beats[dialogueBeatIndex] || beats[0] || '';
    var mood =
      moods[dialogueBeatIndex] ||
      moods[moods.length - 1] ||
      step.mood ||
      'info';
    showCoachMessage({
      mood: mood,
      title: '루미',
      text: text,
      confirmLabel: '확인',
      onConfirm: function () {
        if (dialogueBeatIndex < beats.length - 1) {
          dialogueBeatIndex += 1;
          showCoach(step, opts);
          return;
        }
        dialogueBeatIndex = 0;
        if (opts.onConfirm) opts.onConfirm();
      },
    });
  }

  function buildExpert1Steps() {
    return [
      {
        mood: 'chart',
        coachBeats: [
          '먼저 상승삼각형이야. 고점은 비슷한 위치에서 막히는데, 저점은 점점 높아지는 모양이야.',
          '위로 뚫으려는 힘이 점점 쌓이는 형태라고 볼 수 있어.',
          '많은 투자자들이 위쪽 돌파를 기대하는 패턴으로 보기도 해.',
          '다만 패턴이 보인다고 무조건 오르는 건 아니야. 거래량이나 시장 분위기도 같이 봐야 해.',
        ],
        coachMoods: ['chart', 'studying', 'curious', 'caution'],
        targets: function () {
          return [document.querySelector('[data-pattern-id="ascending-triangle"]')];
        },
      },
      {
        mood: 'studying',
        coachBeats: [
          '쌍바닥은 차트가 W 모양처럼 두 번 바닥을 만들고 다시 올라가려는 모습을 말해.',
          '첫 번째 바닥에서 반등했다가 다시 내려오지만, 두 번째 바닥이 첫 바닥 근처에서 버티면 관심이 쏠리기도 해.',
          '많은 투자자들이 「하락이 끝나고 반등할 수도 있겠다」라고 생각하는 경우가 있어.',
          '이때 거래량이 줄었다가 다시 늘어나는지도 같이 보면 해석에 도움이 돼.',
        ],
        coachMoods: ['chart', 'studying', 'happy', 'idea'],
        targets: function () {
          return [document.querySelector('[data-pattern-id="double-bottom"]')];
        },
      },
      {
        mood: 'excited',
        coachBeats: [
          '상승플래그는 주가가 한 번 크게 오른 뒤 잠깐 쉬어가는 것처럼 보이는 패턴이야.',
          '급등 뒤 살짝 눌리면서 깃발 모양처럼 보여서 플래그라고 불러.',
          '조정 구간이 너무 깊지 않고, 이전 상승 추세가 유지되는 느낌이면 추세 지속 신호로 보기도 해.',
          '역시 참고용일 뿐이야. 다른 지표 없이 플래그만 보고 판단하진 않아.',
        ],
        coachMoods: ['excited', 'chart', 'studying', 'caution'],
        targets: function () {
          return [document.querySelector('[data-pattern-id="bullish-flag"]')];
        },
      },
      {
        mood: 'curious',
        coachBeats: [
          '컵앤핸들은 컵과 손잡이처럼 생긴 패턴이야.',
          '둥글게 바닥을 만들고, 살짝 눌렸다가 다시 올라가는 「손잡이」 구간이 이어져.',
          '장기 차트에서 종종 보이고, 중기 바닥을 다지고 다시 올라가려는 흐름으로 해석되기도 해.',
          '완성까지 시간이 걸리는 패턴이라, 단기 차트보다 주봉·월봉에서 더 자주 언급돼.',
        ],
        coachMoods: ['curious', 'chart', 'studying', 'idea'],
        targets: function () {
          return [document.querySelector('[data-pattern-id="cup-handle"]')];
        },
      },
      {
        mood: 'success',
        coachBeats: [
          '정리해볼게. 쌍바닥은 W 모양, 상승삼각형은 위로 뚫으려는 모양이야.',
          '상승플래그는 오른 뒤 잠깐 쉬는 모양, 컵앤핸들은 둥근 바닥을 만드는 모양이지.',
          '패턴을 외우는 것보다 「왜 사람들이 이 모양을 의미 있게 보는지」를 이해하는 게 더 중요해.',
          '다음 단계에서는 지지선과 이동평균선까지 함께 보면서 실전 차트 읽기를 알아보자!',
        ],
        coachMoods: ['happy', 'chart', 'good_idea', 'excited'],
        targets: function () {
          return [document.querySelector('#chartLabPatternGrid')];
        },
      },
    ];
  }

  function buildExpert2Steps() {
    return [
      {
        mood: 'chart',
        coachBeats: [
          '지지선은 주가가 내려오다가 더 이상 쉽게 떨어지지 않고 버티는 가격대야.',
          '예를 들어 어떤 종목이 계속 비슷한 가격에서 반등한다면, 그 구간을 지지선으로 보는 경우가 많아.',
          '지지선이 여러 번 테스트될수록 그 가격대에 대한 관심이 쌓인다고 볼 수 있어.',
          '다만 지지선이 깨지면, 그 아래로 추가 하락이 이어질 수도 있다는 점도 기억해 둬.',
        ],
        coachMoods: ['chart', 'studying', 'curious', 'caution'],
        onEnter: function () {
          if (window.ChartLabPage) window.ChartLabPage.setTab('support', { replace: true });
        },
        targets: function () {
          return [document.querySelector('[data-topic-id="horizontal-support"]')];
        },
      },
      {
        mood: 'studying',
        coachBeats: [
          '반대로 저항선은 주가가 올라가다가 자주 막히는 가격대야.',
          '지지선은 바닥 역할, 저항선은 천장 역할을 한다고 생각하면 돼.',
          '같은 가격대에서 여러 번 막히면, 그 위로 올라가기 전까지는 부담이 크다고 보는 경우가 많아.',
          '저항선을 뚫으면 그 가격대가 새로운 지지선이 될 수도 있어. 이걸 돌파·지지 전환이라고도 해.',
        ],
        coachMoods: ['chart', 'studying', 'curious', 'idea'],
        targets: function () {
          return [document.querySelector('[data-topic-id="horizontal-resistance"]')];
        },
      },
      {
        mood: 'curious',
        coachBeats: [
          '20일선은 최근 20일 동안의 평균 가격 흐름을 보여줘.',
          '단기 추세를 파악할 때 자주 쓰는 기준선 중 하나야.',
          '현재 주가가 20일선 위에 있으면 단기 흐름이 비교적 괜찮다고 보는 경우가 많아.',
          '반대로 20일선 아래에 오래 머물면 단기 조정을 받고 있다고 해석하기도 해.',
        ],
        coachMoods: ['curious', 'chart', 'happy', 'caution'],
        onEnter: function () {
          if (window.ChartLabPage) window.ChartLabPage.setTab('ma', { replace: true });
        },
        targets: function () {
          return [document.querySelector('[data-topic-id="ma20"]')];
        },
      },
      {
        mood: 'idea',
        coachBeats: [
          '골든크로스는 짧은 기간의 이동평균선이 긴 기간의 이동평균선을 위로 돌파하는 상황이야.',
          '예를 들어 5일선이 20일선을 위로 뚫으면, 최근 흐름이 과거보다 좋아지고 있다는 신호로 보기도 해.',
          '추세 전환 초기에 자주 언급되지만, 횡보장에서는 잦은 크로스로 속을 수도 있어.',
          '골든크로스 하나만으로 매수·매도를 결정하진 않아. 지지선이나 패턴과 같이 봐야 해.',
        ],
        coachMoods: ['chart', 'studying', 'caution', 'good_idea'],
        targets: function () {
          return [document.querySelector('[data-topic-id="golden-cross"]')];
        },
      },
      {
        mood: 'good_idea',
        coachBeats: [
          '차트를 볼 때는 이렇게 생각보면 돼.',
          '패턴이 보이는가? 지지선·저항선 근처인가? 이동평균선 흐름은 어떤가?',
          '이 세 가지를 같이 보면 차트를 훨씬 입체적으로 볼 수 있어.',
          '대표 패턴을 보고, 중요한 가격대를 확인하고, 평균선 흐름을 참고하는 습관만으로도 차트 읽기가 한층 나아질 거야!',
        ],
        coachMoods: ['idea', 'chart', 'studying', 'success'],
        targets: function () {
          return [document.querySelector('.chart-lab-main')];
        },
      },
    ];
  }

  function getIntroBeats() {
    return isExpert1() ? INTRO_BEATS_EXPERT1 : INTRO_BEATS_EXPERT2;
  }

  function getIntroMoods() {
    return isExpert1() ? INTRO_MOODS_EXPERT1 : INTRO_MOODS_EXPERT2;
  }

  function getSteps() {
    return isExpert1() ? buildExpert1Steps() : buildExpert2Steps();
  }

  function wrongTabMessage() {
    if (isExpert1()) return '지금은 「패턴 도감」만 보면 돼!';
    return '지금은 「지지·저항」이나 「이동평균선」 탭만 보면 돼!';
  }

  function resetClearState() {
    inClearPhase = false;
    if (overlay) {
      overlay.classList.remove('is-clear-dim', 'is-dim');
    }
    if (clearEl) {
      clearEl.classList.remove('is-show');
      clearEl.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('chart-lab-step-clear-phase', 'tutorial-fx-clear');
  }

  function syncGuard() {
    if (!window.JurinTutorialGuard) return;
    window.JurinTutorialGuard.set({
      isActive: function () {
        return started && !completed;
      },
      allowsClick: function (target) {
        var G = window.JurinTutorialGuard;
        if (G.allowsMascotAndQuest(target)) return true;
        if (inClearPhase) {
          if (G.isBlockedChromeClick(target)) return false;
          return true;
        }
        if (G.isBlockedChromeClick(target)) return false;
        if (G.allowsSpotlightTargets(target)) return true;
        if (target.closest && target.closest('#chartLabStepOverlay')) return false;
        if (target.closest && target.closest('[data-chart-lab-modal-close]')) return true;
        var patternModal = document.getElementById('chartLabPatternModal');
        if (
          patternModal &&
          patternModal.classList.contains('is-open') &&
          target === patternModal
        ) {
          return true;
        }
        if (target.closest && target.closest('.chart-lab-modal')) return false;
        if (isExpert1()) {
          if (target.closest && target.closest('.inquiry-side-link[data-tab="patterns"]')) {
            return true;
          }
        }
        if (!isExpert1()) {
          var tab = target.closest && target.closest('.inquiry-side-link[data-tab]');
          if (tab) {
            var id = tab.getAttribute('data-tab');
            if (id === 'support' || id === 'ma') return true;
          }
        }
        return false;
      },
      getWrongMessage: function (target) {
        if (target.closest && target.closest('.inquiry-side-link[data-tab="quiz"]')) {
          return '지금은 퀴즈가 아니야! 가이드를 따라와줘.';
        }
        if (target.closest && target.closest('#chartLabQuizCtaBtn')) {
          return '지금은 퀴즈가 아니야! 가이드를 따라와줘.';
        }
        if (
          target.closest &&
          (target.closest('.chart-lab-pattern-card') || target.closest('.chart-lab-topic-card'))
        ) {
          return '카드를 누를 필요 없어! 루미 설명만 들어봐.';
        }
        if (target.closest && target.closest('.inquiry-side-link[data-tab]')) {
          return wrongTabMessage();
        }
        if (target.closest && target.closest('.nav-menu a')) {
          var href = String(
            (target.closest('.nav-menu a') || {}).getAttribute('href') || ''
          ).toLowerCase();
          if (href.indexOf('chart-lab') >= 0) return null;
          if (href.indexOf('guide.html') >= 0) {
            return '지금은 「가이드」가 아니야! 안내한 곳만 눌러줘.';
          }
          if (href.indexOf('market.html') >= 0) {
            return '지금은 「시장」이 아니야! 안내한 곳만 눌러줘.';
          }
          if (href.indexOf('analysis.html') >= 0) {
            return '지금은 「AI 분석」이 아니야! 안내한 곳만 눌러줘.';
          }
        }
        return '지금은 가이드만 따라와줘!';
      },
      onAfterWrong: function () {
        if (inClearPhase) return;
        if (introActive) {
          resumeIntroBeat();
          return;
        }
        var steps = getSteps();
        var step = steps[current];
        if (step) showCoach(step, {});
      },
    });
  }

  function beginClearPhase() {
    inClearPhase = true;
    dialogueBeatIndex = 0;
    clearTargets();
    document.body.classList.add('chart-lab-step-clear-phase', 'tutorial-fx-clear');
    if (overlay) {
      overlay.classList.remove('is-dim');
      overlay.classList.add('is-clear-dim');
    }
    if (clearEl) {
      clearEl.classList.add('is-show');
      clearEl.setAttribute('aria-hidden', 'false');
    }
    var finalBeats = isExpert1()
      ? [
          '1단계를 완료했어! 이제 차트에서 자주 보이는 대표 패턴들이 어떤 의미를 가지는지 알게 됐네.',
          '상승삼각형, 쌍바닥, 상승플래그, 컵앤핸들 — 네 가지 모양의 핵심을 짚어봤어.',
          '다음 단계에서는 지지선과 이동평균선까지 함께 보면서 실전 차트 읽기를 알아보자!',
        ]
      : [
          '2단계를 완료했어! 차트 패턴과 지지·저항·이동평균선을 함께 보는 방법을 알게 됐네.',
          '패턴, 가격대, 평균선 흐름 — 세 가지를 같이 보면 차트가 훨씬 선명해져.',
          '이제 차트연구소에서도 실전처럼 차트를 읽어보는 연습을 이어가 보자!',
        ];
    showCoach(
      {
        coachBeats: finalBeats,
        coachMoods: ['success', 'happy', 'excited'],
      },
      {
        onConfirm: finishTutorial,
      }
    );
    syncGuard();
  }

  function finishTutorial() {
    completed = true;
    started = false;
    inClearPhase = false;
    clearTargets();
    if (overlay) {
      overlay.classList.remove('is-open', 'is-clear-dim', 'is-dim');
      overlay.setAttribute('aria-hidden', 'true');
    }
    resetClearState();
    document.body.classList.remove(
      'chart-lab-step-active',
      'tutorial-fx-active',
      'tutorial-fx-spotlight'
    );
    var stepNum = isExpert1() ? 1 : 2;
    if (window.JurinTutorialUtil && window.JurinTutorialUtil.markExpertStepComplete) {
      window.JurinTutorialUtil.markExpertStepComplete(stepNum);
    }
    if (window.JurinTutorialGuard) window.JurinTutorialGuard.clear();
    window.__jurinGuideQuit = null;
    if (window.MascotCoach && typeof window.MascotCoach.close === 'function') {
      window.MascotCoach.close();
    }
    if (window.JurinTutorialUtil && window.JurinTutorialUtil.restoreNormalSiteUi) {
      window.JurinTutorialUtil.restoreNormalSiteUi({ stripTutorial: true });
    }
    window.location.replace('guide.html?track=expert');
  }

  function quitTutorial(fromUserQuit) {
    started = false;
    completed = false;
    inClearPhase = false;
    clearTargets();
    if (overlay) {
      overlay.classList.remove('is-open', 'is-clear-dim', 'is-dim');
      overlay.setAttribute('aria-hidden', 'true');
    }
    resetClearState();
    document.body.classList.remove(
      'chart-lab-step-active',
      'tutorial-fx-active',
      'tutorial-fx-spotlight'
    );
    if (window.JurinTutorialGuard) window.JurinTutorialGuard.clear();
    window.__jurinGuideQuit = null;
    if (window.JurinTutorialUtil && window.JurinTutorialUtil.restoreNormalSiteUi) {
      window.JurinTutorialUtil.restoreNormalSiteUi({
        stripTutorial: fromUserQuit === true,
      });
    }
    if (fromUserQuit === true) {
      window.location.replace('guide.html?track=expert');
    }
  }

  function render(idx) {
    introActive = false;
    var steps = getSteps();
    if (idx >= steps.length) {
      beginClearPhase();
      return;
    }
    current = idx;
    dialogueBeatIndex = 0;
    var step = steps[idx];
    runStepHooks(step);
    applyTargets(step);
    showCoach(step, {
      onConfirm: function () {
        render(idx + 1);
      },
    });
    syncGuard();
  }

  function injectDom() {
    var legacyClear = document.getElementById('chartLabStepClear');
    if (legacyClear && legacyClear.parentElement !== document.getElementById('chartLabStepOverlay')) {
      legacyClear.parentElement.removeChild(legacyClear);
    }
    if (!document.getElementById('chartLabStepOverlay')) {
      var ov = document.createElement('div');
      ov.id = 'chartLabStepOverlay';
      ov.className = 'chart-lab-step-overlay';
      ov.setAttribute('aria-hidden', 'true');
      var cl = document.createElement('div');
      cl.id = 'chartLabStepClear';
      cl.className = 'chart-lab-step-clear';
      cl.setAttribute('aria-hidden', 'true');
      cl.textContent = 'CLEAR';
      ov.appendChild(cl);
      document.body.appendChild(ov);
    }
    overlay = document.getElementById('chartLabStepOverlay');
    clearEl = document.getElementById('chartLabStepClear');
    if (overlay && !clearEl) {
      var clNew = document.createElement('div');
      clNew.id = 'chartLabStepClear';
      clNew.className = 'chart-lab-step-clear';
      clNew.setAttribute('aria-hidden', 'true');
      clNew.textContent = 'CLEAR';
      overlay.appendChild(clNew);
      clearEl = clNew;
    }
    if (clearEl) {
      clearEl.textContent = 'CLEAR';
      clearEl.className = 'chart-lab-step-clear';
    }
  }

  function resumeIntroBeat() {
    if (!introActive) return;
    var beats = getIntroBeats();
    var moods = getIntroMoods();
    showCoachMessage({
      mood: moods[introBeatIndex] || 'welcome',
      title: '루미',
      text: beats[introBeatIndex] || beats[0],
      confirmLabel: '확인',
      onConfirm: function () {
        if (introBeatIndex < beats.length - 1) {
          introBeatIndex += 1;
          resumeIntroBeat();
          return;
        }
        introBeatIndex = 0;
        introActive = false;
        render(0);
      },
    });
  }

  function showIntro() {
    introBeatIndex = 0;
    introActive = true;
    current = -1;
    if (!window.MascotCoach || typeof window.MascotCoach.show !== 'function') {
      introActive = false;
      render(0);
      return;
    }
    resumeIntroBeat();
    syncGuard();
  }

  function openTutorial() {
    if (tutorialMode === EXPERT2) {
      var cleared1 =
        window.JurinTutorialUtil &&
        window.JurinTutorialUtil.isExpertStepCleared &&
        window.JurinTutorialUtil.isExpertStepCleared(1);
      if (!cleared1) {
        window.location.href = 'guide.html?track=expert';
        return;
      }
    }
    injectDom();
    bootstrapCoachUi();
    started = true;
    completed = false;
    inClearPhase = false;
    document.body.classList.add(
      'chart-lab-step-active',
      'tutorial-fx-active',
      'tutorial-fx-spotlight'
    );
    if (overlay) {
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
    }
    if (isExpert1() && window.ChartLabPage) {
      window.ChartLabPage.setTab('patterns', { replace: true });
    }
    window.__jurinGuideQuit = function () {
      quitTutorial(true);
    };
    syncGuard();
    window.setTimeout(function () {
      showIntro();
    }, 120);
  }

  function boot() {
    tutorialMode = parseTutorialMode();
    if (!tutorialMode) return;
    if (window.JurinTutorialUtil && window.JurinTutorialUtil.restoreNormalSiteUi) {
      window.JurinTutorialUtil.restoreNormalSiteUi({ stripTutorial: false, initLumiChat: false });
    }
    openTutorial();
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && started && !completed) {
      quitTutorial(true);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      window.setTimeout(boot, 80);
    });
  } else {
    window.setTimeout(boot, 80);
  }
})();
