/**
 * 차트연구소 페이지 — 탭, 패턴 모달, 퀴즈, 명언
 */
(function () {
  'use strict';

  var data = window.ChartLabData;
  if (!data) return;

  var HISTORY_KEY = 'jurinChartLabHistory';
  var HISTORY_MAX = 1;

  var state = {
    tab: 'patterns',
    quiz: {
      active: false,
      questions: [],
      index: 0,
      score: 0,
      answered: false,
      pool: [],
    },
  };

  var QUIZ_LUMI_SUCCESS = 'assets/mascot2/success.png?v=20260607';
  var QUIZ_LUMI_STUDY = 'assets/mascot2/studying.png?v=20260607';

  var els = {};

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function cacheElements() {
    els.layout = document.querySelector('.chart-lab-layout');
    els.navBtns = document.querySelectorAll('.inquiry-side-link[data-tab]');
    els.mainTitle = document.getElementById('chartLabMainTitle');
    els.mainSub = document.getElementById('chartLabMainSub');
    els.lumiTip = document.getElementById('chartLabLumiTip');
    els.lumiBubble = document.getElementById('chartLabLumiBubble');
    els.panels = {
      patterns: document.getElementById('chartLabPanelPatterns'),
      support: document.getElementById('chartLabPanelSupport'),
      ma: document.getElementById('chartLabPanelMa'),
      quiz: document.getElementById('chartLabPanelQuiz'),
    };
    els.patternGrid = document.getElementById('chartLabPatternGrid');
    els.supportGrid = document.getElementById('chartLabSupportGrid');
    els.maGrid = document.getElementById('chartLabMaGrid');
    els.modal = document.getElementById('chartLabPatternModal');
    els.modalBadge = document.getElementById('chartLabModalBadge');
    els.modalTitle = document.getElementById('chartLabModalTitle');
    els.modalChart = document.getElementById('chartLabModalChart');
    els.modalDesc = document.getElementById('chartLabModalDesc');
    els.modalTip = document.getElementById('chartLabModalTip');
    els.modalTipText = document.getElementById('chartLabModalTipText');
    els.quizRoot = document.getElementById('chartLabQuizRoot');
    els.quizIntro = document.getElementById('chartLabQuizIntro');
    els.quizPlay = document.getElementById('chartLabQuizPlay');
    els.quizComplete = document.getElementById('chartLabQuizComplete');
    els.quizPrompt = document.getElementById('chartLabQuizPrompt');
    els.quizProgress = document.getElementById('chartLabQuizProgress');
    els.quizChart = document.getElementById('chartLabQuizChart');
    els.quizOptions = document.getElementById('chartLabQuizOptions');
    els.quizFeedback = document.getElementById('chartLabQuizFeedback');
    els.quizResultTitle = document.getElementById('chartLabQuizResultTitle');
    els.quizLumi = document.getElementById('chartLabQuizLumi');
    els.quizResultText = document.getElementById('chartLabQuizResultText');
    els.quizNextBtn = document.getElementById('chartLabQuizNextBtn');
    els.quizScoreText = document.getElementById('chartLabQuizScoreText');
    els.quizStartBtn = document.getElementById('chartLabQuizStartBtn');
    els.quizRetryBtn = document.getElementById('chartLabQuizRetryBtn');
    els.quizCtaBtn = document.getElementById('chartLabQuizCtaBtn');
    els.recentHistory = document.getElementById('chartLabRecentHistory');
  }

  function formatHistoryDate(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.';
  }

  function loadHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(arr) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
    } catch (e) {
      /* ignore */
    }
  }

  function normalizeHistoryEntry(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') {
      return { label: entry, at: Date.now(), kind: 'tab', ref: 'patterns' };
    }
    if (!entry.label) return null;
    return {
      label: entry.label,
      at: entry.at || Date.now(),
      kind: entry.kind || 'tab',
      ref: entry.ref || 'patterns',
    };
  }

  function getHistoryChartSvg(item) {
    if (!item) return '';
    if (item.kind === 'pattern' && item.ref) {
      var pattern = data.getPatternById(item.ref);
      if (pattern && pattern.svg) return pattern.svg;
    }
    if (item.kind === 'support' && item.ref && data.getSupportById) {
      var supportItem = data.getSupportById(item.ref);
      if (supportItem && supportItem.svg) return supportItem.svg;
    }
    if (item.kind === 'ma' && item.ref && data.getMaById) {
      var maItem = data.getMaById(item.ref);
      if (maItem && maItem.svg) return maItem.svg;
    }
    if (item.kind === 'tab') {
      if (item.ref === 'support' && data.SUPPORT_RESISTANCE && data.SUPPORT_RESISTANCE[0]) {
        return data.SUPPORT_RESISTANCE[0].svg;
      }
      if (item.ref === 'ma' && data.MA_SVG) return data.MA_SVG;
      if (item.ref === 'quiz') {
        var quizPattern = data.getPatternById('ascending-triangle');
        if (quizPattern && quizPattern.svg) return quizPattern.svg;
      }
      if (data.PATTERNS && data.PATTERNS[0] && data.PATTERNS[0].svg) {
        return data.PATTERNS[0].svg;
      }
    }
    if (item.kind === 'quiz') {
      var refPattern = data.getPatternById('ascending-triangle');
      if (refPattern && refPattern.svg) return refPattern.svg;
    }
    if (data.PATTERNS && data.PATTERNS[0] && data.PATTERNS[0].svg) {
      return data.PATTERNS[0].svg;
    }
    return '';
  }

  function recordHistory(entry) {
    var item = normalizeHistoryEntry(entry);
    if (!item) return;
    var arr = loadHistory();
    var now = Date.now();
    var top = arr.length > 0 ? arr[0] : null;
    if (top && top.label === item.label && top.kind === item.kind && top.ref === item.ref) {
      arr[0] = { label: item.label, at: now, kind: item.kind, ref: item.ref };
    } else {
      arr = [{ label: item.label, at: now, kind: item.kind, ref: item.ref }];
    }
    if (arr.length > HISTORY_MAX) arr = arr.slice(0, HISTORY_MAX);
    saveHistory(arr);
    renderRecentHistory();
  }

  function renderRecentHistory() {
    if (!els.recentHistory) return;
    var arr = loadHistory();
    if (!arr.length) {
      els.recentHistory.innerHTML =
        '<li><p class="chart-lab-history-empty">아직 학습 기록이 없어요. 패턴 도감부터 살펴보세요!</p></li>';
      return;
    }
    var item = arr[0];
    var chartSvg = getHistoryChartSvg(item);
    els.recentHistory.innerHTML =
      '<li class="chart-lab-history-item">' +
      (chartSvg
        ? '<div class="chart-lab-history-thumb" aria-hidden="true">' + chartSvg + '</div>'
        : '') +
      '<div class="chart-lab-history-body">' +
      '<span class="chart-lab-history-label">' +
      escapeHtml(item.label) +
      '</span>' +
      '<span class="chart-lab-history-date">' +
      escapeHtml(formatHistoryDate(item.at)) +
      '</span>' +
      '</div>' +
      '</li>';
  }

  function tabHistoryLabel(tabId) {
    var meta = data.TAB_META[tabId];
    return meta && meta.title ? meta.title + ' 학습' : '';
  }

  function setTab(tabId, opts) {
    opts = opts || {};
    if (!data.TAB_META[tabId]) return;

    if (tabId !== 'quiz' && state.tab === 'quiz') {
      resetQuizToIntro();
    }
    if (tabId === 'quiz' && !opts.preserveQuiz) {
      resetQuizToIntro();
    }

    state.tab = tabId;
    var meta = data.TAB_META[tabId];

    els.navBtns.forEach(function (btn) {
      var active = btn.getAttribute('data-tab') === tabId;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-current', active ? 'page' : 'false');
    });

    Object.keys(els.panels).forEach(function (key) {
      var panel = els.panels[key];
      if (!panel) return;
      var show = key === tabId;
      panel.classList.toggle('is-hidden', !show);
      if (show) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });

    if (els.mainTitle) els.mainTitle.textContent = meta.title;
    if (els.mainSub) els.mainSub.textContent = meta.subtitle;
    if (els.lumiBubble) els.lumiBubble.textContent = meta.lumiBubble || '';

    if (!opts.replace) {
      try {
        var url = new URL(window.location.href);
        url.searchParams.set('tab', tabId);
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      } catch (e) {
        /* ignore */
      }
    }

    if (tabId === 'quiz' && opts.scroll) {
      var mainEl = document.querySelector('.chart-lab-main');
      if (mainEl && mainEl.scrollIntoView) {
        mainEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  function padPatternIndex(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function getPatternBadge(p) {
    var tone = p.badgeTone || p.category;
    var badge = (data.CATEGORY_BADGE && data.CATEGORY_BADGE[tone]) || null;
    var label = p.badgeLabel || (data.CATEGORY_LABELS[p.category] || p.category);
    return {
      label: label,
      tone: badge ? badge.tone : tone,
      bg: badge ? badge.bg : '#f0f2f1',
      text: badge ? badge.text : '#5f6f66',
    };
  }

  function renderPatterns() {
    if (!els.patternGrid) return;
    els.patternGrid.innerHTML = data.PATTERNS.map(function (p, i) {
      var badge = getPatternBadge(p);
      return (
        '<article class="chart-lab-pattern-card chart-lab-pattern-card--interactive" data-pattern-id="' +
        escapeHtml(p.id) +
        '" role="button" tabindex="0" aria-label="' +
        escapeHtml(p.name) +
        ' 패턴 자세히 보기">' +
        '<div class="chart-lab-pattern-card-head">' +
        '<span class="chart-lab-pattern-index">' +
        padPatternIndex(i + 1) +
        '</span>' +
        '<h3 class="chart-lab-pattern-name">' +
        escapeHtml(p.name) +
        '</h3>' +
        '<span class="chart-lab-pattern-badge is-' +
        escapeHtml(badge.tone) +
        '" style="background:' +
        escapeHtml(badge.bg) +
        ';color:' +
        escapeHtml(badge.text) +
        '">' +
        escapeHtml(badge.label) +
        '</span>' +
        '</div>' +
        '<div class="chart-lab-pattern-chart">' +
        p.svg +
        '</div>' +
        '<p class="chart-lab-pattern-summary">' +
        escapeHtml(p.summary) +
        '</p>' +
        '</article>'
      );
    }).join('');

    els.patternGrid.querySelectorAll('[data-pattern-id]').forEach(function (card) {
      card.addEventListener('click', function () {
        openPatternModal(card.getAttribute('data-pattern-id'));
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPatternModal(card.getAttribute('data-pattern-id'));
        }
      });
    });
  }

  function getTopicBadge(item, badgeMap) {
    var type = item.badgeType || 'basic';
    var badge = (badgeMap && badgeMap[type]) || null;
    return {
      label: item.badgeLabel || (badge ? badge.label : type),
      tone: badge ? badge.tone : type,
      bg: badge ? badge.bg : '#f0f2f1',
      text: badge ? badge.text : '#5f6f66',
    };
  }

  function renderTopicGrid(gridEl, items, badgeMap, topicKind) {
    if (!gridEl || !items) return;
    gridEl.innerHTML = items
      .map(function (item, i) {
        var badge = getTopicBadge(item, badgeMap);
        return (
          '<article class="chart-lab-pattern-card chart-lab-pattern-card--interactive chart-lab-topic-card" data-topic-kind="' +
          escapeHtml(topicKind) +
          '" data-topic-id="' +
          escapeHtml(item.id) +
          '" role="button" tabindex="0" aria-label="' +
          escapeHtml(item.title) +
          ' 자세히 보기">' +
          '<div class="chart-lab-pattern-card-head">' +
          '<span class="chart-lab-pattern-index">' +
          padPatternIndex(i + 1) +
          '</span>' +
          '<h3 class="chart-lab-pattern-name">' +
          escapeHtml(item.title) +
          '</h3>' +
          '<span class="chart-lab-pattern-badge is-' +
          escapeHtml(badge.tone) +
          '" style="background:' +
          escapeHtml(badge.bg) +
          ';color:' +
          escapeHtml(badge.text) +
          '">' +
          escapeHtml(badge.label) +
          '</span>' +
          '</div>' +
          '<div class="chart-lab-pattern-chart">' +
          (item.svg || '') +
          '</div>' +
          '<p class="chart-lab-pattern-summary">' +
          escapeHtml(item.summary || item.desc || '') +
          '</p>' +
          '</article>'
        );
      })
      .join('');

    gridEl.querySelectorAll('[data-topic-id]').forEach(function (card) {
      card.addEventListener('click', function () {
        openTopicModal(card.getAttribute('data-topic-kind'), card.getAttribute('data-topic-id'));
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openTopicModal(card.getAttribute('data-topic-kind'), card.getAttribute('data-topic-id'));
        }
      });
    });
  }

  function renderSupport() {
    renderTopicGrid(els.supportGrid, data.SUPPORT_RESISTANCE, data.SR_BADGE, 'support');
  }

  function renderMa() {
    renderTopicGrid(els.maGrid, data.MOVING_AVERAGES, data.MA_BADGE, 'ma');
  }

  function setModalTip(tip) {
    if (!els.modalTip) return;
    if (tip) {
      if (els.modalTipText) els.modalTipText.textContent = tip;
      els.modalTip.removeAttribute('hidden');
    } else {
      if (els.modalTipText) els.modalTipText.textContent = '';
      els.modalTip.setAttribute('hidden', '');
    }
  }

  function openDetailModal(opts) {
    if (!opts || !els.modal) return;
    if (els.modalBadge) {
      els.modalBadge.textContent = opts.badgeLabel || '';
      els.modalBadge.style.background = opts.badgeBg || '#1e693b';
      els.modalBadge.style.color = opts.badgeColor || '#fff';
    }
    if (els.modalTitle) els.modalTitle.textContent = opts.title || '';
    if (els.modalChart) els.modalChart.innerHTML = opts.svg || '';
    if (els.modalDesc) els.modalDesc.textContent = opts.detail || '';
    setModalTip(opts.tip || '');
    els.modal.classList.add('is-open');
    els.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('chart-lab-modal-open');
    if (opts.history) recordHistory(opts.history);
  }

  function openPatternModal(id) {
    var p = data.getPatternById(id);
    if (!p) return;
    var catLabel = data.CATEGORY_LABELS[p.category] || p.category;
    var catColor = data.CATEGORY_COLORS[p.category] || '#1e693b';
    openDetailModal({
      badgeLabel: catLabel,
      badgeBg: catColor,
      badgeColor: '#fff',
      title: p.name,
      svg: p.svg,
      detail: p.detail,
      tip: p.tip,
      history: { label: p.name + ' 패턴', kind: 'pattern', ref: p.id },
    });
  }

  function openTopicModal(kind, id) {
    var item = null;
    var badge = null;
    if (kind === 'support' && data.getSupportById) {
      item = data.getSupportById(id);
      badge = item ? getTopicBadge(item, data.SR_BADGE) : null;
    } else if (kind === 'ma' && data.getMaById) {
      item = data.getMaById(id);
      badge = item ? getTopicBadge(item, data.MA_BADGE) : null;
    }
    if (!item) return;
    openDetailModal({
      badgeLabel: badge ? badge.label : '',
      badgeBg: badge ? badge.bg : '#f0f2f1',
      badgeColor: badge ? badge.text : '#5f6f66',
      title: item.title,
      svg: item.svg,
      detail: item.detail,
      tip: item.tip,
      history: { label: item.title, kind: kind, ref: item.id },
    });
  }

  function closePatternModal() {
    if (!els.modal) return;
    els.modal.classList.remove('is-open');
    els.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('chart-lab-modal-open');
  }

  function shuffleArray(arr) {
    var copy = arr.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function pickRandomItems(pool, count) {
    return shuffleArray(pool).slice(0, Math.min(count, pool.length));
  }

  function getQuizPrompt(kind) {
    if (data.QUIZ_PROMPTS && data.QUIZ_PROMPTS[kind]) return data.QUIZ_PROMPTS[kind];
    return '다음 차트의 이름은 무엇일까요?';
  }

  function buildQuestionOptions(item, pool) {
    var sameKind = pool.filter(function (p) {
      return p.kind === item.kind && p.id !== item.id;
    });
    var wrong = shuffleArray(sameKind).slice(0, 3);
    var options = [{ title: item.title }].concat(
      wrong.map(function (w) {
        return { title: w.title };
      })
    );
    options = shuffleArray(options);
    var correctIndex = 0;
    for (var i = 0; i < options.length; i++) {
      if (options[i].title === item.title) {
        correctIndex = i;
        break;
      }
    }
    return { options: options, correctIndex: correctIndex };
  }

  function buildQuizQuestions(pool, count) {
    var picked = pickRandomItems(pool, count);
    return picked.map(function (item) {
      var built = buildQuestionOptions(item, pool);
      return {
        item: item,
        prompt: getQuizPrompt(item.kind),
        options: built.options,
        correctIndex: built.correctIndex,
      };
    });
  }

  function setQuizView(view) {
    if (els.quizIntro) {
      if (view === 'intro') els.quizIntro.removeAttribute('hidden');
      else els.quizIntro.setAttribute('hidden', '');
    }
    if (els.quizPlay) {
      if (view === 'play') els.quizPlay.removeAttribute('hidden');
      else els.quizPlay.setAttribute('hidden', '');
    }
    if (els.quizComplete) {
      if (view === 'complete') els.quizComplete.removeAttribute('hidden');
      else els.quizComplete.setAttribute('hidden', '');
    }
  }

  function hideQuizFeedback() {
    if (!els.quizFeedback) return;
    els.quizFeedback.setAttribute('hidden', '');
    els.quizFeedback.classList.remove('is-wrong');
    if (els.quizPlay) els.quizPlay.classList.remove('is-feedback-visible');
  }

  function showQuizFeedback(isCorrect, q) {
    if (!els.quizFeedback) return;
    var item = q.item;
    if (els.quizResultTitle) {
      els.quizResultTitle.textContent = isCorrect ? '정답!' : '아쉬워요!';
    }
    if (els.quizLumi) {
      els.quizLumi.src = isCorrect ? QUIZ_LUMI_SUCCESS : QUIZ_LUMI_STUDY;
    }
    if (els.quizResultText) {
      var answerTitle = item.title || '';
      var explain = item.explanation || '';
      els.quizResultText.innerHTML =
        '<div class="chart-lab-quiz-answer-line">정답 : ' +
        escapeHtml(answerTitle) +
        '</div>' +
        '<div class="chart-lab-quiz-explain-line">해설 : ' +
        escapeHtml(explain) +
        '</div>';
    }
    els.quizFeedback.classList.toggle('is-wrong', !isCorrect);
    els.quizFeedback.removeAttribute('hidden');
    if (els.quizPlay) els.quizPlay.classList.add('is-feedback-visible');
    if (els.quizNextBtn) {
      var total = state.quiz.questions.length;
      els.quizNextBtn.textContent =
        state.quiz.index >= total - 1 ? '결과 보기' : '다음 문제';
    }
  }

  function renderQuizQuestion(index) {
    var q = state.quiz.questions[index];
    if (!q) return;
    state.quiz.answered = false;
    hideQuizFeedback();

    var total = state.quiz.questions.length;
    if (els.quizPrompt) els.quizPrompt.textContent = q.prompt;
    if (els.quizProgress) {
      els.quizProgress.textContent = index + 1 + ' / ' + total;
    }
    if (els.quizChart) els.quizChart.innerHTML = q.item.svg || '';

    if (!els.quizOptions) return;
    var labels = data.QUIZ_OPTION_LABELS || ['①', '②', '③', '④'];
    els.quizOptions.innerHTML = q.options
      .map(function (opt, i) {
        return (
          '<button type="button" class="chart-lab-quiz-option" data-option-index="' +
          i +
          '">' +
          '<span class="chart-lab-quiz-option-num">' +
          escapeHtml(labels[i] || String(i + 1)) +
          '</span>' +
          '<span class="chart-lab-quiz-option-text">' +
          escapeHtml(opt.title) +
          '</span>' +
          '</button>'
        );
      })
      .join('');

    els.quizOptions.querySelectorAll('[data-option-index]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        onQuizOptionClick(parseInt(btn.getAttribute('data-option-index'), 10));
      });
    });
  }

  function onQuizOptionClick(optionIndex) {
    if (state.quiz.answered) return;
    var q = state.quiz.questions[state.quiz.index];
    if (!q) return;

    state.quiz.answered = true;
    var isCorrect = optionIndex === q.correctIndex;
    if (isCorrect) state.quiz.score += 1;

    if (els.quizOptions) {
      els.quizOptions.querySelectorAll('[data-option-index]').forEach(function (btn) {
        var idx = parseInt(btn.getAttribute('data-option-index'), 10);
        btn.disabled = true;
        if (idx === optionIndex) btn.classList.add('is-selected');
        if (idx === q.correctIndex) btn.classList.add('is-correct');
        else if (idx === optionIndex) btn.classList.add('is-wrong');
      });
    }

    showQuizFeedback(isCorrect, q);
  }

  function finishQuiz() {
    state.quiz.active = false;
    var total = state.quiz.questions.length;
    if (els.quizScoreText) {
      els.quizScoreText.textContent =
        total + '문제 중 ' + state.quiz.score + '문제를 맞혔어요. 수고했어요!';
    }
    setQuizView('complete');
    recordHistory({ label: '실전 퀴즈 완료', kind: 'quiz', ref: 'quiz' });
  }

  function nextQuizQuestion() {
    var next = state.quiz.index + 1;
    if (next >= state.quiz.questions.length) {
      finishQuiz();
      return;
    }
    state.quiz.index = next;
    renderQuizQuestion(next);
  }

  function startQuiz() {
    if (!data.buildQuizPool) return;

    var pool = data.buildQuizPool();
    var count = data.QUIZ_COUNT || 10;
    state.quiz.pool = pool;
    state.quiz.questions = buildQuizQuestions(pool, count);
    state.quiz.index = 0;
    state.quiz.score = 0;
    state.quiz.active = true;
    state.quiz.answered = false;

    setTab('quiz', { preserveQuiz: true });
    setQuizView('play');
    renderQuizQuestion(0);
  }

  function resetQuizToIntro() {
    state.quiz.active = false;
    state.quiz.questions = [];
    state.quiz.pool = [];
    state.quiz.index = 0;
    state.quiz.score = 0;
    state.quiz.answered = false;
    hideQuizFeedback();
    if (els.quizChart) els.quizChart.innerHTML = '';
    if (els.quizOptions) els.quizOptions.innerHTML = '';
    if (els.quizPrompt) els.quizPrompt.textContent = '';
    if (els.quizProgress) els.quizProgress.textContent = '';
    if (els.quizResultTitle) els.quizResultTitle.textContent = '';
    if (els.quizResultText) els.quizResultText.textContent = '';
    if (els.quizScoreText) els.quizScoreText.textContent = '';
    setQuizView('intro');
  }

  function bindEvents() {
    els.navBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        setTab(btn.getAttribute('data-tab') || 'patterns');
      });
    });

    if (els.quizStartBtn) {
      els.quizStartBtn.addEventListener('click', startQuiz);
    }
    if (els.quizRetryBtn) {
      els.quizRetryBtn.addEventListener('click', resetQuizToIntro);
    }
    if (els.quizNextBtn) {
      els.quizNextBtn.addEventListener('click', nextQuizQuestion);
    }
    if (els.quizCtaBtn) {
      els.quizCtaBtn.addEventListener('click', function () {
        setTab('quiz', { scroll: true });
      });
    }
    if (els.modal) {
      els.modal.addEventListener('click', function (e) {
        if (e.target === els.modal) closePatternModal();
      });
      els.modal.querySelectorAll('[data-chart-lab-modal-close]').forEach(function (el) {
        el.addEventListener('click', closePatternModal);
      });
      var panel = els.modal.querySelector('.chart-lab-modal-panel');
      if (panel) {
        panel.addEventListener('click', function (e) {
          e.stopPropagation();
        });
      }
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && els.modal && els.modal.classList.contains('is-open')) {
        closePatternModal();
      }
    });
  }

  function readInitialTab() {
    try {
      var params = new URLSearchParams(window.location.search);
      var tab = (params.get('tab') || '').trim();
      if (data.TAB_META[tab]) return tab;
    } catch (e) {
      /* ignore */
    }
    return 'patterns';
  }

  function init() {
    if (data.TAB_META && data.TAB_META.quiz) {
      data.TAB_META.quiz.lumiBubble =
        '차트를 보고 4지선다로 맞춰 보세요. 틀려도 해설로 바로 복습할 수 있어요!';
    }
    cacheElements();
    if (els.lumiTip && data.LUMI_SIDEBAR_TIP) {
      els.lumiTip.textContent = data.LUMI_SIDEBAR_TIP;
    }
    renderPatterns();
    renderSupport();
    renderMa();
    bindEvents();
    renderRecentHistory();
    setTab(readInitialTab(), { replace: true });
  }

  window.ChartLabPage = {
    setTab: setTab,
    getTab: function () {
      return state.tab;
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
