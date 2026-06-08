/**
 * community.html — 커뮤니티 피드·글쓰기·상세
 */
(function () {
  'use strict';

  var BOARD_SUBTITLES = {
    all: '주린이들의 투자 이야기를 모았어요',
    popular: '최근 7일 추천 TOP 5',
    qna: '궁금한 점을 물어보고 답변을 나눠요',
    free: '일반 게시글입니다',
  };

  var SIDEBAR_ITEMS = [
    { id: 'all', label: '전체 게시글' },
    { id: 'popular', label: '인기글' },
    { id: 'free', label: '일반' },
    { id: 'qna', label: '질문/답변' },
  ];

  var SIDE_ICON_SVG =
    ' width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

  var SIDE_ICONS = {
    all:
      '<svg' + SIDE_ICON_SVG + '>' +
      '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>' +
      '<rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>' +
      '<line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>' +
      '</svg>',
    popular:
      '<svg' + SIDE_ICON_SVG + '>' +
      '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' +
      '</svg>',
    qna:
      '<svg' + SIDE_ICON_SVG + '>' +
      '<circle cx="12" cy="12" r="10"/>' +
      '<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>' +
      '<line x1="12" y1="17" x2="12.01" y2="17"/>' +
      '</svg>',
    free:
      '<svg' + SIDE_ICON_SVG + '>' +
      '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
      '</svg>',
  };

  var VALID_BOARD_IDS = ['all', 'popular', 'free', 'qna'];
  var GENERAL_BOARD_IDS = ['free', 'stock', 'proof'];

  var state = {
    view: 'feed',
    board: 'all',
    sort: 'latest',
    page: 1,
    q: '',
    stockCode: null,
    stockName: null,
    detailId: null,
    boards: [],
    sidebar: [],
    loggedIn: false,
    userId: null,
    pendingView: null,
    lastDetailStats: null,
    feedTotal: null,
    attachmentPreviewUrl: null,
    editingPostId: null,
    editingPostSnapshot: null,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function likeIconHtml(size) {
    size = size || 16;
    return (
      '<span class="community-like-icon" aria-hidden="true">' +
      '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M7 10v12"/>' +
      '<path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>' +
      '</svg></span>'
    );
  }

  function deleteIconHtml(size) {
    size = size || 16;
    return (
      '<span class="community-delete-icon" aria-hidden="true">' +
      '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<polyline points="3 6 5 6 21 6"/>' +
      '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
      '<line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>' +
      '</svg></span>'
    );
  }

  function editIconHtml(size) {
    size = size || 16;
    return (
      '<span class="community-edit-icon" aria-hidden="true">' +
      '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 20h9"/>' +
      '<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>' +
      '</svg></span>'
    );
  }

  function apiFetch(path, options) {
    options = options || {};
    options.credentials = 'include';
    if (!options.method || options.method === 'GET') {
      options.cache = 'no-store';
    }
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      options.headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
      options.body = JSON.stringify(options.body);
    }
    return fetch(jurinApiBase() + path, options).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { res: res, data: data };
      });
    });
  }

  function isLoggedIn() {
    return !!state.loggedIn;
  }

  function refreshLoginState() {
    return fetch(jurinApiBase() + '/api/auth/me', { credentials: 'include' })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (payload) {
        if (payload.ok && payload.data && payload.data.success && payload.data.user) {
          state.loggedIn = true;
          state.userId = payload.data.user.userId != null
            ? parseInt(payload.data.user.userId, 10)
            : null;
          return true;
        }
        state.loggedIn = false;
        state.userId = null;
        return false;
      })
      .catch(function () {
        state.loggedIn = false;
        state.userId = null;
        return false;
      });
  }

  function requireLogin(nextView) {
    if (isLoggedIn()) return Promise.resolve(true);
    state.pendingView = nextView || null;
    if (typeof openLoginModal === 'function') openLoginModal();
    return Promise.resolve(false);
  }

  function formatDateTime(iso) {
    if (!iso) return '-';
    var s = String(iso);
    var date = s.slice(0, 10).replace(/-/g, '.');
    var time = s.length >= 16 ? s.slice(11, 16) : '';
    return time ? date + ' ' + time : date;
  }

  function formatRelative(iso) {
    if (!iso) return '';
    var d = new Date(iso.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return formatDateTime(iso);
    var diff = Date.now() - d.getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금';
    if (mins < 60) return mins + '분 전';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + '시간 전';
    var days = Math.floor(hrs / 24);
    if (days < 7) return days + '일 전';
    return formatDateTime(iso);
  }

  function excerpt(text, max) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    return t.slice(0, max) + '…';
  }

  function syncUrl() {
    var params = new URLSearchParams();
    if (state.board && state.board !== 'all') params.set('board', state.board);
    if (state.view === 'detail' && state.detailId) {
      params.set('view', 'detail');
      params.set('id', String(state.detailId));
    } else if (state.view === 'write') {
      params.set('view', 'write');
    }
    if (state.q) params.set('q', state.q);
    if (state.stockCode) params.set('stock_code', state.stockCode);
    if (state.stockName) params.set('stock_name', state.stockName);
    if (state.board !== 'popular' && state.sort && state.sort !== 'latest') {
      params.set('sort', state.sort);
    }
    var qs = params.toString();
    history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : ''));
  }

  function showView(view) {
    state.view = view;
    var panels = document.querySelectorAll('.community-view[data-view-panel]');
    panels.forEach(function (panel) {
      var on = panel.getAttribute('data-view-panel') === view;
      panel.classList.toggle('is-hidden', !on);
      if (on) {
        panel.removeAttribute('hidden');
        panel.setAttribute('aria-hidden', 'false');
      } else {
        panel.setAttribute('hidden', '');
        panel.setAttribute('aria-hidden', 'true');
      }
    });
    if (view === 'feed') {
      var detailBox = $('communityDetail');
      if (detailBox) detailBox.innerHTML = '';
    }
    if (view === 'write') {
      initCommunityStockAutocomplete();
    }
    syncUrl();
  }

  function normalizeBoardId(board) {
    board = String(board || 'all').trim().toLowerCase();
    return VALID_BOARD_IDS.indexOf(board) >= 0 ? board : 'all';
  }

  function setBoard(board, highlight) {
    var prevBoard = state.board;
    state.board = normalizeBoardId(board);
    state.page = 1;
    if (prevBoard !== state.board) {
      state.stockCode = null;
      state.stockName = null;
      state.feedTotal = null;
    }
    if (state.board === 'popular') {
      state.sort = 'likes';
      if ($('communitySortSelect')) $('communitySortSelect').value = 'likes';
    } else if (state.sort === 'likes' && state.board !== 'popular') {
      state.sort = 'latest';
      if ($('communitySortSelect')) $('communitySortSelect').value = 'latest';
    }
    updateBoardUi(highlight || 'sidebar');
    if (state.view === 'feed') loadFeed();
    syncUrl();
  }

  function isBoardMatch(elBoard, board) {
    return elBoard === board;
  }

  function normalizeStockCode(code) {
    code = String(code || '').trim();
    if (!code) return null;
    if (/^\d+$/.test(code)) return code.padStart(6, '0');
    return code;
  }

  function updateBoardUi(highlight) {
    highlight = highlight || 'none';
    var title = '전체 게시글';
    var sub = BOARD_SUBTITLES.all;

    if (state.stockCode || state.stockName) {
      var stockLabel = state.stockName || state.stockCode || '종목';
      title = stockLabel + ' 관련 글';
      if (state.feedTotal != null) {
        sub = stockLabel + ' 관련 글 ' + state.feedTotal + '건';
      } else if (state.stockCode) {
        sub = stockLabel + ' · ' + state.stockCode;
      } else {
        sub = stockLabel + ' 관련 게시글만 표시 중입니다';
      }
    } else {
      getSidebarItems().forEach(function (item) {
        if (item.id === state.board) title = item.label;
      });
      sub = BOARD_SUBTITLES[state.board] || BOARD_SUBTITLES.all;
    }

    if ($('communityFeedTitle')) $('communityFeedTitle').textContent = title;
    if ($('communityFeedSub')) $('communityFeedSub').textContent = sub;

    var isPopularBoard = state.board === 'popular' && !state.stockCode && !state.stockName;
    var toolbar = document.querySelector('.community-toolbar');
    if (toolbar) toolbar.classList.toggle('is-popular-board', isPopularBoard);
    var sortWrap = document.querySelector('.community-sort-wrap');
    if (sortWrap) {
      sortWrap.hidden = isPopularBoard;
      sortWrap.setAttribute('aria-hidden', isPopularBoard ? 'true' : 'false');
    }

    var stockFilter = $('communityStockFilter');
    var stockLabel = $('communityStockFilterLabel');
    if (stockFilter && stockLabel) {
      if (state.stockCode || state.stockName) {
        stockFilter.hidden = false;
        var chipLabel = state.stockName || state.stockCode || '종목';
        stockLabel.textContent =
          chipLabel +
          (state.stockCode ? ' (' + state.stockCode + ')' : '') +
          ' 관련 글 필터';
      } else {
        stockFilter.hidden = true;
        stockLabel.textContent = '';
      }
    }

    document.querySelectorAll('#communitySideNav .inquiry-side-link').forEach(function (btn) {
      var active = isBoardMatch(btn.getAttribute('data-board'), state.board);
      btn.classList.toggle('is-active', active);
    });

    syncWriteTypesFromFilter();
  }

  function getSidebarItems() {
    if (!state.sidebar.length) return SIDEBAR_ITEMS.slice();
    var byId = {};
    state.sidebar.forEach(function (item) {
      byId[item.id] = item;
    });
    return SIDEBAR_ITEMS.map(function (fallback) {
      return byId[fallback.id] || fallback;
    });
  }

  function renderSideNav() {
    var nav = $('communitySideNav');
    if (!nav) return;
    var items = getSidebarItems();
    nav.innerHTML = items.map(function (item) {
      return (
        '<button type="button" class="inquiry-side-link' +
        (item.id === state.board ? ' is-active' : '') +
        '" data-board="' + escapeHtml(item.id) + '">' +
        '<span class="inquiry-side-icon" aria-hidden="true">' + (SIDE_ICONS[item.id] || '') + '</span>' +
        '<span>' + escapeHtml(item.label) + '</span>' +
        '</button>'
      );
    }).join('');

    nav.querySelectorAll('.inquiry-side-link').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showView('feed');
        setBoard(btn.getAttribute('data-board'), 'sidebar');
      });
    });
  }

  function normalizeWriteBoard(board) {
    return board === 'qna' ? 'qna' : 'free';
  }

  function getWriteBoardFromScope(scopeEl) {
    if (!scopeEl) return 'free';
    var active = scopeEl.querySelector('.community-write-type-btn.is-active');
    var board = active && active.getAttribute('data-write-board');
    return normalizeWriteBoard(board);
  }

  function setWriteBoardInScope(scopeEl, type) {
    if (!scopeEl) return;
    var board = normalizeWriteBoard(type);
    scopeEl.querySelectorAll('.community-write-type-btn').forEach(function (btn) {
      var on = btn.getAttribute('data-write-board') === board;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function resolveWriteTypeFromFilter() {
    return state.board === 'qna' ? 'qna' : 'free';
  }

  function syncWriteTypesFromFilter() {
    var type = resolveWriteTypeFromFilter();
    var quickForm = $('communityQuickWriteForm');
    var writeForm = $('communityWriteForm');
    if (quickForm) setWriteBoardInScope(quickForm, type);
    if (writeForm) setWriteBoardInScope(writeForm, type);
  }

  function resetWriteTypeInScope(scopeEl) {
    setWriteBoardInScope(scopeEl, 'free');
  }

  function bindWriteTypeInScope(scopeEl) {
    if (!scopeEl || scopeEl.dataset.writeTypeBound === '1') return;
    scopeEl.dataset.writeTypeBound = '1';
    scopeEl.querySelectorAll('.community-write-type-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var board = btn.getAttribute('data-write-board') || 'free';
        setWriteBoardInScope(scopeEl, board);
        if (scopeEl.id === 'communityQuickWriteForm') {
          filterByBoard(board);
        }
      });
    });
  }

  function initCommunityStockAutocomplete() {
    var nameInput = $('writeStockName');
    if (!nameInput || nameInput.dataset.acBound === '1') return;
    if (typeof JurinStockAutocomplete === 'undefined') return;
    nameInput.dataset.acBound = '1';
    var selectingStock = false;
    JurinStockAutocomplete.attachStock(nameInput, {
      onSelect: function (it) {
        selectingStock = true;
        var codeEl = $('writeStockCode');
        if (codeEl) codeEl.value = it.code || '';
        nameInput.value = it.name || it.code || '';
        selectingStock = false;
      },
    });
    nameInput.addEventListener('input', function () {
      if (selectingStock) return;
      var codeEl = $('writeStockCode');
      if (codeEl) codeEl.value = '';
    });
  }

  function setFormMsg(msgEl, text, kind) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.className = 'community-form-msg';
    if (kind === 'error') msgEl.classList.add('is-error');
    else if (kind === 'success') msgEl.classList.add('is-success');
  }

  function validateWriteForm() {
    var title = $('writeTitle') && $('writeTitle').value.trim();
    var body = $('writeBody') && $('writeBody').value.trim();
    var stockName = $('writeStockName') && $('writeStockName').value.trim();
    var stockCode = $('writeStockCode') && $('writeStockCode').value.trim();

    if (!title) return '제목을 입력해 주세요.';
    if (title.length > 200) return '제목을 1~200자로 입력해 주세요.';
    if (!body || body.length < 2) return '내용을 2자 이상 입력해 주세요.';
    if (stockName && !stockCode) {
      return '등록할 수 없는 종목명입니다. 자동검색 목록에서 종목을 선택해 주세요.';
    }
    if (!state.editingPostId && isWritePollEnabled()) {
      var pollOptionError = validateWritePollOptions();
      if (pollOptionError) return pollOptionError;
      var pollTitle = $('writePollTitle') && $('writePollTitle').value.trim();
      if (!pollTitle) return '투표 제목을 입력해 주세요.';
      if (pollTitle.length > 100) return '투표 제목을 1~100자로 입력해 주세요.';
      var endsAt = $('writePollEndsAt') && $('writePollEndsAt').value;
      if (!endsAt) return '투표 마감 시간을 선택해 주세요.';
      var endsDate = new Date(endsAt);
      if (Number.isNaN(endsDate.getTime()) || endsDate.getTime() <= Date.now()) {
        return '투표 마감 시간은 현재 이후로 설정해 주세요.';
      }
    }
    return '';
  }

  function validateQuickWriteForm() {
    var title = $('quickTitle') && $('quickTitle').value.trim();
    var body = $('quickBody') && $('quickBody').value.trim();

    if (!title) return '제목을 입력해 주세요.';
    if (title.length > 200) return '제목을 1~200자로 입력해 주세요.';
    if (!body || body.length < 2) return '내용을 2자 이상 입력해 주세요.';
    return '';
  }

  function clearWriteStockFields() {
    var nameInput = $('writeStockName');
    var codeEl = $('writeStockCode');
    if (nameInput) nameInput.value = '';
    if (codeEl) codeEl.value = '';
  }

  var WRITE_POLL_MAX_OPTIONS = 5;
  var WRITE_POLL_MIN_OPTIONS = 2;
  var WRITE_POLL_DEFAULT_TITLE = '여러분의 생각은?';
  var DEFAULT_WRITE_POLL_OPTIONS = [
    { label: '상승', iconType: 'rise' },
    { label: '하락', iconType: 'fall' },
  ];

  function isWritePollEnabled() {
    var el = $('writePollEnabled');
    return !!(el && el.checked);
  }

  function setWritePollOptionsError(message) {
    var el = $('writePollOptionsError');
    if (!el) return;
    if (message) {
      el.textContent = message;
      el.hidden = false;
    } else {
      el.textContent = '';
      el.hidden = true;
    }
  }

  function renderWritePollOptionsList(options) {
    var list = $('writePollOptionsList');
    var addBtn = $('writePollAddOption');
    if (!list) return;
    list.innerHTML = (options || []).map(function (option, index) {
      return (
        '<li class="community-write-poll-option-row" data-icon-type="' +
        escapeHtml(option.iconType || 'custom') +
        '">' +
        '<input type="text" class="community-write-poll-option-input" maxlength="50" value="' +
        escapeHtml(option.label || '') +
        '" aria-label="투표 선택지 ' +
        (index + 1) +
        '">' +
        '<button type="button" class="community-write-poll-option-remove" data-option-index="' +
        index +
        '" aria-label="선택지 삭제">삭제</button>' +
        '</li>'
      );
    }).join('');
    if (addBtn) addBtn.disabled = (options || []).length >= WRITE_POLL_MAX_OPTIONS;
  }

  function getWritePollOptionsFromDom() {
    var list = $('writePollOptionsList');
    if (!list) return [];
    return Array.prototype.map.call(list.querySelectorAll('.community-write-poll-option-row'), function (row) {
      var input = row.querySelector('.community-write-poll-option-input');
      var iconType = row.getAttribute('data-icon-type') || 'custom';
      return {
        label: input ? input.value.trim() : '',
        iconType: iconType,
      };
    });
  }

  function initWritePollOptions() {
    renderWritePollOptionsList(DEFAULT_WRITE_POLL_OPTIONS.slice());
    setWritePollOptionsError('');
  }

  function collectWritePollOptions() {
    return getWritePollOptionsFromDom()
      .map(function (option) {
        if (option.iconType === 'rise' && !option.label) {
          return { label: '상승', iconType: 'rise' };
        }
        if (option.iconType === 'fall' && !option.label) {
          return { label: '하락', iconType: 'fall' };
        }
        return option;
      })
      .filter(function (option) {
        return !!option.label;
      });
  }

  function validateWritePollOptions() {
    if (!isWritePollEnabled()) {
      setWritePollOptionsError('');
      return '';
    }
    var options = collectWritePollOptions();
    if (options.length < WRITE_POLL_MIN_OPTIONS) {
      var msg = '투표 선택지는 2개 이상 필요합니다.';
      setWritePollOptionsError(msg);
      return msg;
    }
    setWritePollOptionsError('');
    return '';
  }

  function addWritePollOption() {
    var options = getWritePollOptionsFromDom();
    if (options.length >= WRITE_POLL_MAX_OPTIONS) return;
    options.push({ label: '', iconType: 'custom' });
    renderWritePollOptionsList(options);
    setWritePollOptionsError('');
    var list = $('writePollOptionsList');
    if (list) {
      var lastInput = list.querySelector('.community-write-poll-option-row:last-child .community-write-poll-option-input');
      if (lastInput) lastInput.focus();
    }
  }

  function removeWritePollOption(index) {
    var options = getWritePollOptionsFromDom();
    if (options.length <= WRITE_POLL_MIN_OPTIONS) {
      setWritePollOptionsError('투표 선택지는 2개 이상 필요합니다.');
      return;
    }
    options.splice(index, 1);
    renderWritePollOptionsList(options);
    setWritePollOptionsError('');
  }

  function formatDatetimeLocalValue(date) {
    var pad = function (n) {
      return String(n).padStart(2, '0');
    };
    return (
      date.getFullYear() +
      '-' +
      pad(date.getMonth() + 1) +
      '-' +
      pad(date.getDate()) +
      'T' +
      pad(date.getHours()) +
      ':' +
      pad(date.getMinutes())
    );
  }

  function applyPollPresetHours(hours) {
    var endsAt = $('writePollEndsAt');
    if (!endsAt) return;
    endsAt.value = formatDatetimeLocalValue(new Date(Date.now() + hours * 3600000));
  }

  function syncWritePollSettings() {
    var enabled = $('writePollEnabled');
    var settings = $('writePollSettings');
    if (!settings) return;
    var on = !!(enabled && enabled.checked);
    settings.hidden = !on;
    if (on) {
      var list = $('writePollOptionsList');
      if (!list || !list.children.length) {
        initWritePollOptions();
      }
      var pollTitle = $('writePollTitle');
      if (pollTitle && !pollTitle.value.trim()) {
        pollTitle.value = WRITE_POLL_DEFAULT_TITLE;
      }
      var endsAt = $('writePollEndsAt');
      if (endsAt && !endsAt.value) applyPollPresetHours(24);
    } else {
      setWritePollOptionsError('');
    }
  }

  function resetWritePoll() {
    var enabled = $('writePollEnabled');
    var settings = $('writePollSettings');
    var endsAt = $('writePollEndsAt');
    var pollTitle = $('writePollTitle');
    if (enabled) enabled.checked = false;
    if (settings) settings.hidden = true;
    if (endsAt) endsAt.value = '';
    if (pollTitle) pollTitle.value = '';
    initWritePollOptions();
  }

  function appendPollFieldsToPayload(payload, isFormData) {
    if (!isWritePollEnabled()) {
      if (isFormData) payload.append('pollEnabled', '0');
      else payload.pollEnabled = false;
      return payload;
    }
    var endsAt = $('writePollEndsAt') && $('writePollEndsAt').value;
    var pollTitle = $('writePollTitle') && $('writePollTitle').value.trim();
    var pollOptions = collectWritePollOptions();
    if (isFormData) {
      payload.append('pollEnabled', '1');
      if (endsAt) payload.append('pollEndsAt', endsAt);
      if (pollTitle) payload.append('pollTitle', pollTitle);
      payload.append('pollOptions', JSON.stringify(pollOptions));
    } else {
      payload.pollEnabled = true;
      payload.pollEndsAt = endsAt || '';
      payload.pollTitle = pollTitle || '';
      payload.pollOptions = pollOptions;
    }
    return payload;
  }

  function resetWriteAttachment() {
    var input = $('writeAttachment');
    var nameEl = $('writeAttachName');
    var preview = $('writeAttachPreview');
    var clearBtn = $('writeAttachClear');
    if (state.attachmentPreviewUrl) {
      URL.revokeObjectURL(state.attachmentPreviewUrl);
      state.attachmentPreviewUrl = null;
    }
    if (input) input.value = '';
    if (nameEl) nameEl.textContent = '선택된 파일 없음';
    if (preview) {
      preview.innerHTML = '';
      preview.hidden = true;
    }
    if (clearBtn) clearBtn.hidden = true;
  }

  function onWriteAttachmentSelected() {
    var input = $('writeAttachment');
    var nameEl = $('writeAttachName');
    var preview = $('writeAttachPreview');
    var clearBtn = $('writeAttachClear');
    var msg = $('writeFormMsg');
    if (!input || !input.files || !input.files[0]) {
      resetWriteAttachment();
      return;
    }
    var file = input.files[0];
    if (file.size > 10 * 1024 * 1024) {
      setFormMsg(msg, '첨부 이미지는 10MB 이하여야 합니다.', 'error');
      resetWriteAttachment();
      return;
    }
    if (!/^image\/(jpeg|png|gif|webp)$/i.test(file.type)) {
      setFormMsg(msg, 'JPEG, PNG, GIF, WEBP 이미지만 첨부할 수 있습니다.', 'error');
      resetWriteAttachment();
      return;
    }
    setFormMsg(msg, '', '');
    if ($('writeAttachRemove')) $('writeAttachRemove').checked = false;
    if (nameEl) nameEl.textContent = file.name;
    if (clearBtn) clearBtn.hidden = false;
    if (preview) {
      if (state.attachmentPreviewUrl) URL.revokeObjectURL(state.attachmentPreviewUrl);
      state.attachmentPreviewUrl = URL.createObjectURL(file);
      preview.hidden = false;
      preview.innerHTML = '<img src="' + state.attachmentPreviewUrl + '" alt="첨부 미리보기">';
    }
  }

  function resetWriteEditState() {
    state.editingPostId = null;
    state.editingPostSnapshot = null;
    var titleEl = document.querySelector('#communityViewWrite .community-panel-title');
    var submitBtn = document.querySelector('#communityWriteForm .community-submit-btn');
    if (titleEl) titleEl.textContent = '글쓰기';
    if (submitBtn) submitBtn.textContent = '등록하기';
    var pollBlock = $('communityWritePoll');
    if (pollBlock) pollBlock.hidden = false;
    var attachBlock = document.querySelector('#communityWriteForm .community-write-attach');
    if (attachBlock) attachBlock.hidden = false;
    var extras = $('communityWriteEditExtras');
    if (extras) extras.hidden = true;
    var pollExisting = $('communityEditExistingPoll');
    if (pollExisting) pollExisting.hidden = true;
    var attachExisting = $('communityEditExistingAttach');
    if (attachExisting) attachExisting.hidden = true;
    if ($('writePollRemove')) $('writePollRemove').checked = false;
    if ($('writeAttachRemove')) $('writeAttachRemove').checked = false;
    if ($('communityEditAttachPreview')) $('communityEditAttachPreview').innerHTML = '';
  }

  function buildWritePostEditPayload(writeForm) {
    var board = getWriteBoardFromScope(writeForm);
    var title = $('writeTitle') && $('writeTitle').value.trim();
    var body = $('writeBody') && $('writeBody').value.trim();
    var stockCode = $('writeStockCode') && $('writeStockCode').value.trim();
    var stockName = $('writeStockName') && $('writeStockName').value.trim();
    var removeAttachment = !!($('writeAttachRemove') && $('writeAttachRemove').checked);
    var removePoll = !!($('writePollRemove') && $('writePollRemove').checked);
    var fileInput = $('writeAttachment');
    var hasNewFile = fileInput && fileInput.files && fileInput.files[0];

    if (hasNewFile) {
      var formData = new FormData();
      formData.append('board', board || 'free');
      formData.append('title', title || '');
      formData.append('body', body || '');
      if (stockCode) {
        formData.append('stockCode', stockCode);
        if (stockName) formData.append('stockName', stockName);
      }
      formData.append('attachment', fileInput.files[0]);
      if (removePoll) formData.append('removePoll', 'true');
      return formData;
    }

    return {
      board: board,
      title: title,
      body: body,
      stockCode: stockCode || '',
      stockName: stockCode ? stockName : '',
      removeAttachment: removeAttachment,
      removePoll: removePoll,
    };
  }

  function populateWriteFormForEdit(item) {
    var writeForm = $('communityWriteForm');
    if (!writeForm) return;
    var board = item.board === 'qna' ? 'qna' : 'free';
    setWriteBoardInScope(writeForm, board);
    if ($('writeTitle')) $('writeTitle').value = item.title || '';
    if ($('writeBody')) $('writeBody').value = item.body || '';
    if ($('writeStockCode')) $('writeStockCode').value = item.stockCode || '';
    if ($('writeStockName')) $('writeStockName').value = item.stockName || '';
    state.editingPostId = item.postId;
    state.editingPostSnapshot = item;
    var titleEl = document.querySelector('#communityViewWrite .community-panel-title');
    var submitBtn = document.querySelector('#communityWriteForm .community-submit-btn');
    if (titleEl) titleEl.textContent = '글 수정';
    if (submitBtn) submitBtn.textContent = '저장하기';

    var extras = $('communityWriteEditExtras');
    if (extras) extras.hidden = false;

    var pollBlock = $('communityWritePoll');
    if (pollBlock) pollBlock.hidden = true;

    var pollExisting = $('communityEditExistingPoll');
    var pollSummary = $('communityEditPollSummary');
    var hasPoll = !!(item.poll && item.poll.options && item.poll.options.length);
    if (pollExisting) pollExisting.hidden = !hasPoll;
    if (hasPoll && pollSummary) {
      pollSummary.textContent = '참여 ' + (item.poll.totalVotes || 0) + '명';
    }
    if ($('writePollRemove')) $('writePollRemove').checked = false;

    var attachments = item.attachments || [];
    var attachExisting = $('communityEditExistingAttach');
    var attachPreview = $('communityEditAttachPreview');
    if (attachExisting) attachExisting.hidden = !attachments.length;
    if (attachments.length && attachPreview) {
      var att = attachments[0];
      var src = att.url || '';
      if (src && src.charAt(0) === '/' && typeof jurinApiBase === 'function') {
        src = jurinApiBase() + src;
      }
      attachPreview.innerHTML = '<img src="' + escapeHtml(src) + '" alt="현재 첨부 이미지">';
    } else if (attachPreview) {
      attachPreview.innerHTML = '';
    }
    if ($('writeAttachRemove')) $('writeAttachRemove').checked = false;

    var attachBlock = document.querySelector('#communityWriteForm .community-write-attach');
    if (attachBlock) attachBlock.hidden = false;
  }

  function navigateToEditPost(item) {
    requireLogin('write').then(function (ok) {
      if (!ok || !item) return;
      var writeForm = $('communityWriteForm');
      if (!writeForm) return;
      writeForm.reset();
      resetWriteAttachment();
      resetWritePoll();
      clearWriteStockFields();
      populateWriteFormForEdit(item);
      setFormMsg($('writeFormMsg'), '', '');
      showView('write');
      initCommunityStockAutocomplete();
    });
  }

  function buildWritePostPayload(writeForm) {
    var board = getWriteBoardFromScope(writeForm);
    var title = $('writeTitle') && $('writeTitle').value.trim();
    var body = $('writeBody') && $('writeBody').value.trim();
    var stockCode = $('writeStockCode') && $('writeStockCode').value.trim();
    var stockName = $('writeStockName') && $('writeStockName').value.trim();
    var fileInput = $('writeAttachment');
    if (fileInput && fileInput.files && fileInput.files[0]) {
      var payload = new FormData();
      payload.append('board', board || 'free');
      payload.append('title', title || '');
      payload.append('body', body || '');
      if (stockCode) {
        payload.append('stockCode', stockCode);
        if (stockName) payload.append('stockName', stockName);
      }
      payload.append('attachment', fileInput.files[0]);
      appendPollFieldsToPayload(payload, true);
      return payload;
    }
    var jsonPayload = {
      board: board,
      title: title,
      body: body,
      stockCode: stockCode || '',
      stockName: stockCode ? stockName : '',
    };
    return appendPollFieldsToPayload(jsonPayload, false);
  }

  function renderPollBlock(item, mode) {
    var poll = item.poll;
    if (!poll || !poll.options || !poll.options.length) return '';
    mode = mode || 'feed';
    var compactClass = mode === 'feed' ? ' community-poll-block--compact' : '';
    var closedClass = poll.isClosed ? ' is-closed' : '';
    var votedClass = poll.myVoteOptionId ? ' is-voted' : '';
    var canSelect = !poll.isClosed;
    var rows = poll.options
      .map(function (opt) {
        var selected =
          poll.myVoteOptionId && String(poll.myVoteOptionId) === String(opt.optionId)
            ? ' is-selected is-voted-option'
            : '';
        var selectable = canSelect ? ' is-selectable' : '';
        return (
          '<button type="button" class="community-poll-option-row' +
          selected +
          selectable +
          '" data-option-id="' +
          opt.optionId +
          '" data-icon-type="' +
          escapeHtml(opt.iconType || 'custom') +
          '" data-post-id="' +
          item.postId +
          '">' +
          '<span class="community-poll-option-label">' +
          escapeHtml(opt.label || '') +
          '</span>' +
          '<span class="community-poll-option-bar" aria-hidden="true"><span style="width:' +
          (opt.percent || 0) +
          '%"></span></span>' +
          '<span class="community-poll-option-stat">' +
          (opt.percent || 0) +
          '% (' +
          (opt.voteCount || 0) +
          '명)</span>' +
          '</button>'
        );
      })
      .join('');
    var submitDisabled = poll.isClosed;
    var submitLabel = poll.isClosed ? '마감됨' : poll.myVoteOptionId ? '투표 수정' : '투표하기';
    var pollHeading = escapeHtml(poll.title || WRITE_POLL_DEFAULT_TITLE);
    var myVoteAttr = poll.myVoteOptionId ? ' data-my-vote-option-id="' + poll.myVoteOptionId + '"' : '';
    var selectedAttr =
      poll.myVoteOptionId && !poll.isClosed ? ' data-selected-option-id="' + poll.myVoteOptionId + '"' : '';

    return (
      '<div class="community-poll-block' +
      compactClass +
      closedClass +
      votedClass +
      '" data-post-id="' +
      item.postId +
      '"' +
      myVoteAttr +
      selectedAttr +
      '">' +
      '<h4 class="community-poll-heading">' +
      pollHeading +
      '</h4>' +
      '<div class="community-poll-options">' +
      rows +
      '</div>' +
      '<div class="community-poll-foot">' +
      '<span class="community-poll-meta">참여 ' +
      (poll.totalVotes || 0) +
      '명</span>' +
      '<button type="button" class="community-poll-submit-btn"' +
      (submitDisabled ? ' disabled' : '') +
      ' data-post-id="' +
      item.postId +
      '">' +
      submitLabel +
      '</button>' +
      '</div>' +
      '</div>'
    );
  }

  function patchPollForPost(postId, poll) {
    document.querySelectorAll('.community-poll-block[data-post-id="' + postId + '"]').forEach(function (block) {
      var mode = block.classList.contains('community-poll-block--compact') ? 'feed' : 'detail';
      var card = block.closest('.community-post-card') || block.closest('.community-detail-post');
      var titleEl =
        card && (card.querySelector('.community-post-title') || card.querySelector('.community-detail-title'));
      var stockTag = card && card.querySelector('.community-tag--stock');
      var item = {
        postId: postId,
        title: titleEl ? titleEl.textContent : '',
        stockName: stockTag ? stockTag.textContent.trim() : '',
        poll: poll,
      };
      var tmp = document.createElement('div');
      tmp.innerHTML = renderPollBlock(item, mode);
      var newBlock = tmp.firstElementChild;
      if (!newBlock) return;
      block.replaceWith(newBlock);
      bindPollBlock(newBlock.parentElement || document);
    });
  }

  function updatePollSubmitState(block) {
    var submitBtn = block.querySelector('.community-poll-submit-btn');
    if (!submitBtn) return;
    if (block.classList.contains('is-closed')) {
      submitBtn.disabled = true;
      submitBtn.textContent = '마감됨';
      return;
    }
    var myVote = block.getAttribute('data-my-vote-option-id') || '';
    var selected = block.getAttribute('data-selected-option-id') || '';
    if (myVote) {
      submitBtn.textContent = '투표 수정';
      submitBtn.disabled = !selected || selected === myVote;
      return;
    }
    submitBtn.textContent = '투표하기';
    submitBtn.disabled = !selected;
  }

  function submitPollVote(postId, optionId, block) {
    requireLogin('vote').then(function (ok) {
      if (!ok) return;
      apiFetch('/api/community/posts/' + postId + '/poll/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId: optionId }),
      }).then(function (result) {
        if (!result.res.ok || !result.data.success) {
          if (result.data && result.data.message) alert(result.data.message);
          return;
        }
        patchPollForPost(postId, result.data.poll);
      });
    });
  }

  function bindPollBlock(root) {
    if (!root) return;
    root.querySelectorAll('.community-poll-block').forEach(function (block) {
      if (block.dataset.bound === '1') return;
      block.dataset.bound = '1';
      var postId = parseInt(block.getAttribute('data-post-id'), 10);
      if (Number.isNaN(postId)) return;

      block.querySelectorAll('.community-poll-option-row.is-selectable').forEach(function (row) {
        row.addEventListener('click', function (e) {
          e.stopPropagation();
          block.querySelectorAll('.community-poll-option-row').forEach(function (other) {
            other.classList.remove('is-selected', 'is-voted-option');
          });
          row.classList.add('is-selected');
          block.setAttribute('data-selected-option-id', row.getAttribute('data-option-id') || '');
          updatePollSubmitState(block);
        });
      });

      updatePollSubmitState(block);

      var submitBtn = block.querySelector('.community-poll-submit-btn');
      if (submitBtn && !block.classList.contains('is-closed')) {
        submitBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          var optionId = parseInt(block.getAttribute('data-selected-option-id') || '', 10);
          if (Number.isNaN(optionId)) {
            alert('투표할 선택지를 선택해 주세요.');
            return;
          }
          submitPollVote(postId, optionId, block);
        });
      }
    });
  }

  function renderDetailAttachments(attachments) {
    var items = attachments || [];
    if (!items.length) return '';
    return (
      '<div class="inquiry-detail-attachments community-detail-attachments">' +
      items.map(function (item) {
        return (
          '<div class="inquiry-detail-attach" data-attachment-id="' + item.attachmentId + '">' +
            '<div class="inquiry-detail-attach-loading">이미지 불러오는 중...</div>' +
          '</div>'
        );
      }).join('') +
      '</div>'
    );
  }

  function renderPostCardAttachmentPreview(item) {
    var att = item.attachments && item.attachments[0];
    if (!att || !att.url) return '';
    return (
      '<div class="community-post-attach-preview" data-attachment-url="' + escapeHtml(att.url) + '">' +
      '<span class="community-post-attach-loading">이미지 불러오는 중…</span>' +
      '</div>'
    );
  }

  function bindFeedAttachmentPreviews(root) {
    if (!root) return;
    root.querySelectorAll('.community-post-attach-preview').forEach(function (block) {
      if (block.dataset.loaded === '1') return;
      var url = block.getAttribute('data-attachment-url');
      if (!url) return;
      block.dataset.loaded = '1';
      fetch(jurinApiBase() + url, { credentials: 'include' })
        .then(function (res) {
          if (!res.ok) throw new Error('load_failed');
          return res.blob();
        })
        .then(function (blob) {
          var objectUrl = URL.createObjectURL(blob);
          block.innerHTML = '<img src="' + objectUrl + '" alt="첨부 이미지">';
        })
        .catch(function () {
          block.innerHTML = '';
          block.hidden = true;
        });
    });
  }

  function bindDetailAttachments(root, attachments) {
    if (!root) return;
    var items = attachments || [];
    if (!items.length) return;
    items.forEach(function (item) {
      var block = root.querySelector('[data-attachment-id="' + item.attachmentId + '"]');
      if (!block || !item.url) return;
      fetch(jurinApiBase() + item.url, { credentials: 'include' })
        .then(function (res) {
          if (!res.ok) throw new Error('load_failed');
          return res.blob();
        })
        .then(function (blob) {
          var url = URL.createObjectURL(blob);
          block.innerHTML = '<img src="' + url + '" alt="첨부 이미지">';
        })
        .catch(function () {
          block.innerHTML = '<p class="community-feed-empty">첨부 이미지를 불러오지 못했습니다.</p>';
        });
    });
  }

  function clearStockFilter(reload) {
    state.stockCode = null;
    state.stockName = null;
    state.feedTotal = null;
    updateBoardUi('sidebar');
    syncUrl();
    if (reload !== false && state.view === 'feed') loadFeed(1);
  }

  function filterByStock(code, name) {
    code = normalizeStockCode(code);
    name = String(name || '').trim();
    if (!code && !name) return;
    state.stockCode = code || null;
    state.stockName = name || null;
    state.feedTotal = null;
    state.page = 1;
    state.board = 'all';
    updateBoardUi('sidebar');
    showView('feed');
    loadFeed(1);
    syncUrl();
  }

  function boardToFilterId(board) {
    board = String(board || 'free').trim().toLowerCase();
    if (board === 'qna') return 'qna';
    if (GENERAL_BOARD_IDS.indexOf(board) >= 0) return 'free';
    return 'all';
  }

  function filterByBoard(board) {
    var filterId = boardToFilterId(board);
    if (filterId === 'all') return;
    setBoard(filterId, 'sidebar');
    showView('feed');
  }

  function renderBoardTag(item) {
    var filterId = boardToFilterId(item.board);
    var label = item.boardLabel || item.board || '일반';
    if (filterId === 'all') {
      return '<span class="community-tag community-tag--board">' + escapeHtml(label) + '</span>';
    }
    return (
      '<button type="button" class="community-tag community-tag--board community-tag--link" ' +
      'data-board-filter="' + escapeHtml(filterId) + '" ' +
      'aria-label="' + escapeHtml(label + ' 게시글 보기') + '">' +
      escapeHtml(label) +
      '</button>'
    );
  }

  function renderStockTag(item) {
    if (!item.stockName && !item.stockCode) return '';
    var label = escapeHtml(item.stockName || item.stockCode || '');
    if (item.stockCode && item.stockName) label += ' ' + escapeHtml(item.stockCode);
    else if (item.stockCode && !item.stockName) label = escapeHtml(item.stockCode);
    return (
      '<button type="button" class="community-tag community-tag--stock community-tag--link" ' +
      'data-stock-code="' + escapeHtml(item.stockCode || '') + '" ' +
      'data-stock-name="' + escapeHtml(item.stockName || item.stockCode || '') + '" ' +
      'aria-label="' + escapeHtml((item.stockName || item.stockCode) + ' 관련 글 보기') + '">' +
      label +
      '</button>'
    );
  }

  function bindStockTagClicks(root) {
    if (!root) return;
    root.querySelectorAll('.community-tag--stock.community-tag--link').forEach(function (btn) {
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        filterByStock(btn.getAttribute('data-stock-code'), btn.getAttribute('data-stock-name'));
      });
    });
  }

  function bindBoardTagClicks(root) {
    if (!root) return;
    root.querySelectorAll('.community-tag--board.community-tag--link').forEach(function (btn) {
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        filterByBoard(btn.getAttribute('data-board-filter'));
      });
    });
  }

  function updateViewCountDisplay(root, count) {
    if (!root) return;
    root.querySelectorAll('.community-view-count').forEach(function (el) {
      el.textContent = String(count || 0);
    });
  }

  function setLikeButtonState(btn, liked, likeCount) {
    if (!btn) return;
    var countEl = btn.querySelector('.community-like-count');
    if (countEl != null && likeCount != null) countEl.textContent = String(likeCount);
    btn.classList.toggle('is-liked', !!liked);
    btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
    btn.setAttribute('aria-label', liked ? '추천 취소' : '추천');
  }

  function syncLikeButtonsForPost(postId, liked, likeCount) {
    document.querySelectorAll('.community-stat-btn--like[data-post-id="' + postId + '"]').forEach(function (btn) {
      setLikeButtonState(btn, liked, likeCount);
    });
  }

  function patchFeedPostStats(stats) {
    if (!stats || !stats.postId) return;
    var card = document.querySelector('.community-post-card[data-post-id="' + stats.postId + '"]');
    if (!card) return;
    if (stats.viewCount != null) updateViewCountDisplay(card, stats.viewCount);
    card.querySelectorAll('.community-stat-btn--like').forEach(function (btn) {
      setLikeButtonState(btn, stats.likedByMe, stats.likeCount);
    });
  }

  function goBackToFeed() {
    var stats = state.lastDetailStats;
    showView('feed');
    if (stats) patchFeedPostStats(stats);
    return loadFeed(state.page);
  }

  function animateLikeCount(countEl, nextCount) {
    if (!countEl) return;
    countEl.textContent = String(nextCount);
    countEl.classList.remove('is-bump');
    void countEl.offsetWidth;
    countEl.classList.add('is-bump');
  }

  function bindLikeButton(btn) {
    if (!btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var postId = parseInt(btn.getAttribute('data-post-id'), 10);
      if (Number.isNaN(postId)) return;
      var countEl = btn.querySelector('.community-like-count');
      requireLogin('like').then(function (ok) {
        if (!ok) return;
        apiFetch('/api/community/posts/' + postId + '/like', { method: 'POST' }).then(function (result) {
          if (!result.res.ok || !result.data.success) {
            if (result.data && result.data.message) alert(result.data.message);
            return;
          }
          var liked = !!result.data.likedByMe || !!result.data.liked;
          animateLikeCount(countEl, result.data.likeCount);
          syncLikeButtonsForPost(postId, liked, result.data.likeCount);
          if (state.lastDetailStats && state.lastDetailStats.postId === postId) {
            state.lastDetailStats.likeCount = result.data.likeCount;
            state.lastDetailStats.likedByMe = liked;
          }
          patchFeedPostStats({
            postId: postId,
            likeCount: result.data.likeCount,
            likedByMe: liked,
          });
        });
      });
    });
  }

  function renderCommentBody(text) {
    if (window.LumiCon && typeof window.LumiCon.renderBodyHtml === 'function') {
      return window.LumiCon.renderBodyHtml(text || '');
    }
    return escapeHtml(text || '');
  }

  function renderCommentsSectionMarkup(commentCount) {
    var formTail =
      '<div class="community-comment-form-actions">' +
      '<p class="community-form-msg"></p>' +
      '<button type="submit" class="btn-primary community-comment-submit">등록</button>' +
      '</div>';
    if (window.LumiCon && typeof window.LumiCon.enhanceCommentFormMarkup === 'function') {
      formTail = window.LumiCon.enhanceCommentFormMarkup(formTail);
    }
    var inputHtml =
      window.LumiCon && typeof window.LumiCon.buildEditorHtml === 'function'
        ? window.LumiCon.buildEditorHtml()
        : '<textarea rows="3" maxlength="2000" placeholder="댓글을 입력하세요" aria-label="댓글 입력"></textarea>';
    return (
      '<section class="community-comments" aria-label="댓글">' +
      '<h3 class="community-comments-title">댓글 <span class="community-comment-count">' + (commentCount || 0) + '</span></h3>' +
      '<ul class="community-comment-list"></ul>' +
      '<form class="community-comment-form">' +
      '<label class="community-comment-field">' +
      inputHtml +
      '</label>' +
      formTail +
      '</form>' +
      '</section>'
    );
  }

  function updateCommentCount(root, count) {
    if (!root) return;
    var countEl = root.querySelector('.community-comment-count');
    var btn = root.querySelector('.community-stat-btn--comment');
    if (countEl) countEl.textContent = String(count || 0);
    if (btn) {
      btn.textContent = (btn.closest('.community-detail-foot') ? '💬 댓글 ' : '💬 ') + (count || 0);
    }
  }

  function renderPostCard(item) {
    var tags = renderBoardTag(item);
    tags += renderStockTag(item);
    var liked = !!item.likedByMe;
    return (
      '<article class="community-post-card" data-post-id="' + item.postId + '">' +
      '<div class="community-post-tags">' + tags + '</div>' +
      '<h3 class="community-post-title">' + escapeHtml(item.title) + '</h3>' +
      '<div class="community-post-meta">' +
      '<span class="community-author-chip">' +
      (typeof jurinAvatarHtml === 'function'
        ? jurinAvatarHtml({ avatarUrl: item.authorAvatarUrl, displayName: item.authorNickname || '회원', sizeClass: 'community-author-avatar' })
        : '') +
      '<span class="community-author-info">' +
      '<span class="community-author-name" title="' + escapeHtml(item.authorNickname || '회원') + '">' + escapeHtml(item.authorNickname || '회원') + '</span>' +
      '<span class="community-author-date">' + escapeHtml(formatRelative(item.createdAt)) + '</span>' +
      '</span></span>' +
      '</div>' +
      '<p class="community-post-excerpt">' + escapeHtml(excerpt(item.bodyPreview || item.body || item.title, 120)) + '</p>' +
      renderPollBlock(item, 'feed') +
      renderPostCardAttachmentPreview(item) +
      '<div class="community-post-body-full" hidden></div>' +
      '<div class="community-post-foot">' +
      '<button type="button" class="community-stat community-stat-btn community-stat-btn--like' +
        (liked ? ' is-liked' : '') +
        '" data-post-id="' + item.postId + '" aria-label="' + (liked ? '추천 취소' : '추천') + '"' +
        ' aria-pressed="' + (liked ? 'true' : 'false') + '"' +
        '> ' + likeIconHtml(16) + '<span class="community-like-count">' + (item.likeCount || 0) + '</span></button>' +
      '<button type="button" class="community-stat community-stat-btn community-stat-btn--comment" data-post-id="' + item.postId + '" aria-label="댓글 보기" aria-expanded="false">💬 ' + (item.commentCount || 0) + '</button>' +
      '<span class="community-stat community-stat--view">조회수 <span class="community-view-count">' + (item.viewCount || 0) + '</span></span>' +
      '</div>' +
      '<div class="community-post-comments-panel" hidden>' +
      renderCommentsSectionMarkup(item.commentCount) +
      '</div>' +
      '</article>'
    );
  }

  function closeFeedComments(card) {
    if (!card) return;
    card.classList.remove('is-comments-open');
    var panel = card.querySelector('.community-post-comments-panel');
    var excerpt = card.querySelector('.community-post-excerpt');
    var fullBody = card.querySelector('.community-post-body-full');
    var btn = card.querySelector('.community-stat-btn--comment');
    if (panel) panel.hidden = true;
    if (excerpt) excerpt.hidden = false;
    if (fullBody) fullBody.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function toggleFeedComments(postId, card) {
    var panel = card.querySelector('.community-post-comments-panel');
    if (!panel) return;

    if (card.classList.contains('is-comments-open')) {
      closeFeedComments(card);
      return;
    }

    document.querySelectorAll('.community-post-card.is-comments-open').forEach(function (other) {
      if (other !== card) closeFeedComments(other);
    });

    card.classList.add('is-comments-open');
    panel.hidden = false;
    var btn = card.querySelector('.community-stat-btn--comment');
    if (btn) btn.setAttribute('aria-expanded', 'true');

    bindCommentEvents(postId, card);
    loadComments(postId, card).then(function () {
      var input =
        window.LumiCon && typeof window.LumiCon.getCommentInput === 'function'
          ? window.LumiCon.getCommentInput(panel.querySelector('.community-comment-form'))
          : panel.querySelector('.community-comment-form textarea');
      if (input) input.focus({ preventScroll: true });
    });
  }

  function bindFeedClicks() {
    var list = $('communityFeedList');
    if (!list) return;
    list.querySelectorAll('.community-post-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('.community-stat-btn--comment')) return;
        if (e.target.closest('.community-stat-btn--like')) return;
        if (e.target.closest('.community-tag--link')) return;
        if (e.target.closest('.community-poll-block')) return;
        if (e.target.closest('.community-post-comments-panel')) return;
        if (card.classList.contains('is-comments-open')) return;
        var id = parseInt(card.getAttribute('data-post-id'), 10);
        if (!Number.isNaN(id)) openDetail(id);
      });

      bindStockTagClicks(card);
      bindBoardTagClicks(card);
      bindFeedAttachmentPreviews(card);
      bindPollBlock(card);
      card.querySelectorAll('.community-stat-btn--like').forEach(bindLikeButton);

      var panel = card.querySelector('.community-post-comments-panel');
      if (panel) {
        panel.addEventListener('click', function (e) {
          e.stopPropagation();
        });
      }

      card.querySelectorAll('.community-stat-btn--comment').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var id = parseInt(btn.getAttribute('data-post-id'), 10);
          if (!Number.isNaN(id)) toggleFeedComments(id, card);
        });
      });
    });
  }

  function renderPagination(container, page, totalPages, onPage) {
    if (!container) return;
    if (totalPages <= 1) {
      container.innerHTML = '';
      container.hidden = true;
      return;
    }
    container.hidden = false;
    var parts = [];
    parts.push(
      '<button type="button" class="community-page-btn" data-page="' +
        (page - 1) +
        '"' +
        (page <= 1 ? ' disabled' : '') +
        '>‹</button>'
    );
    for (var p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) {
        parts.push(
          '<button type="button" class="community-page-btn' +
            (p === page ? ' is-active' : '') +
            '" data-page="' +
            p +
            '">' +
            p +
            '</button>'
        );
      } else if (p === page - 2 || p === page + 2) {
        parts.push('<span class="community-page-btn" style="border:none;background:transparent">…</span>');
      }
    }
    parts.push(
      '<button type="button" class="community-page-btn" data-page="' +
        (page + 1) +
        '"' +
        (page >= totalPages ? ' disabled' : '') +
        '>›</button>'
    );
    container.innerHTML = parts.join('');
    container.querySelectorAll('.community-page-btn[data-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        var next = parseInt(btn.getAttribute('data-page'), 10);
        if (!Number.isNaN(next)) onPage(next);
      });
    });
  }

  function filterFeedItemsByBoard(items) {
    if (!items || !items.length) return items || [];
    if (state.board === 'qna') {
      return items.filter(function (item) { return item.board === 'qna'; });
    }
    if (state.board === 'free') {
      return items.filter(function (item) {
        var board = item.board || 'free';
        return GENERAL_BOARD_IDS.indexOf(board) >= 0;
      });
    }
    return items;
  }

  function loadFeed(page) {
    state.page = page || state.page || 1;
    var params = new URLSearchParams({
      page: String(state.page),
      page_size: '10',
      sort: state.sort || 'latest',
    });
    if (state.board === 'popular') {
      params.set('sort', 'likes');
      params.set('page_size', '5');
      params.set('page', '1');
      state.page = 1;
    } else if (state.board === 'free' || state.board === 'qna') {
      params.set('board', state.board);
    }
    if (state.stockCode) params.set('stock_code', state.stockCode);
    if (state.stockName) params.set('stock_name', state.stockName);
    if (state.q) params.set('q', state.q);

    var list = $('communityFeedList');
    if (list) list.innerHTML = '<p class="community-feed-empty">불러오는 중…</p>';

    return apiFetch('/api/community/posts?' + params.toString()).then(function (result) {
      if (!result.res.ok || !result.data.success) {
        if (list) {
          list.innerHTML =
            '<p class="community-feed-empty">' +
            escapeHtml(result.data.message || '목록을 불러오지 못했습니다.') +
            '</p>';
        }
        renderPagination($('communityPagination'), 1, 1, loadFeed);
        return;
      }
      var items = filterFeedItemsByBoard(result.data.items || []);
      state.feedTotal = result.data.total != null ? result.data.total : items.length;
      updateBoardUi('sidebar');
      if (list) {
        list.innerHTML = items.length
          ? items.map(renderPostCard).join('')
          : '<p class="community-feed-empty">게시글이 없습니다.</p>';
        if (items.length) bindFeedClicks();
      }
      renderPagination(
        $('communityPagination'),
        result.data.page,
        state.board === 'popular' ? 1 : result.data.totalPages,
        loadFeed
      );
    });
  }

  function loadPopular() {
    return apiFetch('/api/community/posts/popular?limit=5').then(function (result) {
      var list = $('communityPopularList');
      if (!list) return;
      if (!result.res.ok || !result.data.success) {
        list.innerHTML = '<li class="community-empty" style="padding:12px">인기글을 불러오지 못했습니다.</li>';
        return;
      }
      var items = result.data.items || [];
      if (!items.length) {
        list.innerHTML = '<li class="community-empty" style="padding:12px">인기글이 없습니다.</li>';
        return;
      }
      list.innerHTML = items.map(function (item, idx) {
        return (
          '<li class="community-popular-item">' +
          '<span class="community-popular-rank">' + (idx + 1) + '</span>' +
          '<button type="button" class="community-popular-link" data-post-id="' + item.postId + '">' +
          escapeHtml(item.title) +
          '</button>' +
          '<span class="community-popular-likes">' + likeIconHtml(14) + '<span>' + (item.likeCount || 0) + '</span></span>' +
          '</li>'
        );
      }).join('');

      list.querySelectorAll('.community-popular-link').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = parseInt(btn.getAttribute('data-post-id'), 10);
          if (!Number.isNaN(id)) openDetail(id);
        });
      });
    });
  }

  function openDetail(postId) {
    state.detailId = postId;
    showView('detail');
    var box = $('communityDetail');
    if (box) box.innerHTML = '<p class="community-empty">불러오는 중…</p>';

    return apiFetch('/api/community/posts/' + postId).then(function (result) {
      if (!result.res.ok || !result.data.success || !result.data.item) {
        if (box) box.innerHTML = '<p class="community-empty">' + escapeHtml(result.data.message || '글을 찾을 수 없습니다.') + '</p>';
        return;
      }
      var item = result.data.item;
      state.lastDetailStats = {
        postId: item.postId,
        viewCount: item.viewCount,
        likeCount: item.likeCount,
        likedByMe: !!item.likedByMe,
      };
      renderDetail(item);
    });
  }

  function closeAllCommentMenus() {
    document.querySelectorAll('.community-comment-menu').forEach(function (menu) {
      menu.hidden = true;
    });
    document.querySelectorAll('.community-comment-more-btn').forEach(function (btn) {
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  function buildCommentMenu(commentId) {
    return (
      '<div class="community-comment-menu-wrap">' +
        '<button type="button" class="community-comment-more-btn" data-comment-more="' + commentId + '" aria-label="댓글 메뉴" aria-haspopup="menu" aria-expanded="false">' +
          '<svg class="community-comment-more-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
            '<circle cx="12" cy="5" r="1.8"/>' +
            '<circle cx="12" cy="12" r="1.8"/>' +
            '<circle cx="12" cy="19" r="1.8"/>' +
          '</svg>' +
        '</button>' +
        '<div class="community-comment-menu" data-comment-menu="' + commentId + '" role="menu" hidden>' +
          '<button type="button" class="community-comment-menu-item" data-comment-edit="' + commentId + '" role="menuitem">수정</button>' +
          '<div class="community-comment-menu-divider" role="separator"></div>' +
          '<button type="button" class="community-comment-menu-item community-comment-menu-item--danger" data-comment-delete="' + commentId + '" role="menuitem">삭제</button>' +
        '</div>' +
      '</div>'
    );
  }

  function renderCommentItem(comment) {
    var commentMenu = comment.isOwner ? buildCommentMenu(comment.commentId) : '';
    return (
      '<li class="community-comment-item" data-comment-id="' + comment.commentId + '">' +
      '<div class="community-comment-head">' +
      '<span class="community-author-chip">' +
      (typeof jurinAvatarHtml === 'function'
        ? jurinAvatarHtml({ avatarUrl: comment.authorAvatarUrl, displayName: comment.authorNickname || '회원', sizeClass: 'community-author-avatar community-author-avatar--comment' })
        : '') +
      '<span class="community-author-info">' +
      '<strong class="community-author-name community-comment-author" title="' + escapeHtml(comment.authorNickname || '회원') + '">' + escapeHtml(comment.authorNickname || '회원') + '</strong>' +
      '<span class="community-author-date community-comment-date">' + escapeHtml(formatRelative(comment.createdAt)) + '</span>' +
      '</span></span>' +
      (commentMenu ? '<div class="community-comment-head-right">' + commentMenu + '</div>' : '') +
      '</div>' +
      '<p class="community-comment-body" data-comment-body="' + comment.commentId + '">' + renderCommentBody(comment.body) + '</p>' +
      '<div class="community-comment-edit-form" data-comment-form="' + comment.commentId + '" hidden>' +
      '<textarea data-comment-input="' + comment.commentId + '">' + escapeHtml(comment.body || '') + '</textarea>' +
      '<div class="community-comment-edit-actions">' +
      '<button type="button" class="community-comment-edit-cancel" data-comment-cancel="' + comment.commentId + '">취소</button>' +
      '<button type="button" class="community-comment-edit-save" data-comment-save="' + comment.commentId + '">저장</button>' +
      '</div>' +
      '</div>' +
      '</li>'
    );
  }

  function refreshPostCommentCount(postId, root) {
    return apiFetch('/api/community/posts/' + postId + '?count_view=0').then(function (detailRes) {
      if (detailRes.res.ok && detailRes.data.success && detailRes.data.item) {
        updateCommentCount(root, detailRes.data.item.commentCount);
      }
    });
  }

  function bindCommentEvents(postId, root) {
    if (!root) return;
    var form = root.querySelector('.community-comment-form');
    if (!form || form.dataset.bound === '1') return;
    form.dataset.bound = '1';

    var input =
      window.LumiCon && typeof window.LumiCon.getCommentInput === 'function'
        ? window.LumiCon.getCommentInput(form)
        : form.querySelector('textarea');
    if (window.LumiCon && typeof window.LumiCon.bindPicker === 'function') {
      window.LumiCon.bindPicker(form, input);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input =
        window.LumiCon && typeof window.LumiCon.getCommentInput === 'function'
          ? window.LumiCon.getCommentInput(form)
          : form.querySelector('textarea');
      var msg = form.querySelector('.community-form-msg');
      var body =
        window.LumiCon && typeof window.LumiCon.readCommentValue === 'function'
          ? window.LumiCon.readCommentValue(input)
          : input && input.value.trim();
      if (!body) {
        if (msg) {
          msg.textContent = '댓글 내용을 입력해 주세요.';
          msg.className = 'community-form-msg is-error';
        }
        return;
      }
      requireLogin('comment').then(function (ok) {
        if (!ok) return;
        if (msg) {
          msg.textContent = '등록 중…';
          msg.className = 'community-form-msg';
        }
        var syncPromise = Promise.resolve();
        if (window.LumiCon && typeof window.LumiCon.ensureServerSynced === 'function') {
          syncPromise = window.LumiCon.ensureServerSynced();
        }
        syncPromise.then(function () {
          return apiFetch('/api/community/posts/' + postId + '/comments', {
            method: 'POST',
            body: { body: body },
          });
        }).then(function (result) {
          if (!result.res.ok || !result.data.success) {
            if (msg) {
              msg.textContent = result.data.message || '댓글을 등록하지 못했습니다.';
              msg.className = 'community-form-msg is-error';
            }
            return;
          }
          if (window.LumiCon && typeof window.LumiCon.clearCommentInput === 'function') {
            window.LumiCon.clearCommentInput(input);
          } else if (input) {
            input.value = '';
          }
          if (msg) {
            msg.textContent = '댓글이 등록되었습니다.';
            msg.className = 'community-form-msg is-success';
          }
          loadComments(postId, root);
          refreshPostCommentCount(postId, root);
        });
      });
    });

    var commentBtn = root.querySelector('.community-detail-foot .community-stat-btn--comment');
    if (commentBtn && !commentBtn.dataset.bound) {
      commentBtn.dataset.bound = '1';
      commentBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var section = root.querySelector('.community-comments');
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        var input =
          window.LumiCon && typeof window.LumiCon.getCommentInput === 'function'
            ? window.LumiCon.getCommentInput(root.querySelector('.community-comment-form'))
            : root.querySelector('.community-comment-form textarea');
        if (input) input.focus();
      });
    }
  }

  function bindCommentListActions(postId, root) {
    if (!root) return;
    var list = root.querySelector('.community-comment-list');
    if (!list) return;

    list.querySelectorAll('.community-comment-menu-wrap').forEach(function (wrap) {
      wrap.addEventListener('click', function (event) {
        event.stopPropagation();
      });
    });

    list.querySelectorAll('[data-comment-more]').forEach(function (btn) {
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function (event) {
        event.stopPropagation();
        var commentId = btn.getAttribute('data-comment-more');
        var menu = root.querySelector('[data-comment-menu="' + commentId + '"]');
        var willOpen = menu && menu.hidden;
        closeAllCommentMenus();
        if (menu && willOpen) {
          menu.hidden = false;
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });

    list.querySelectorAll('[data-comment-edit]').forEach(function (btn) {
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        closeAllCommentMenus();
        var commentId = btn.getAttribute('data-comment-edit');
        var item = root.querySelector('.community-comment-item[data-comment-id="' + commentId + '"]');
        if (!item) return;
        var form = item.querySelector('[data-comment-form="' + commentId + '"]');
        var bodyEl = item.querySelector('[data-comment-body="' + commentId + '"]');
        var menuWrap = item.querySelector('.community-comment-menu-wrap');
        var input = item.querySelector('[data-comment-input="' + commentId + '"]');
        if (input) input.dataset.originalBody = input.value;
        if (form) form.hidden = false;
        if (bodyEl) bodyEl.hidden = true;
        if (menuWrap) menuWrap.hidden = true;
      });
    });

    list.querySelectorAll('[data-comment-cancel]').forEach(function (btn) {
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        var commentId = btn.getAttribute('data-comment-cancel');
        var item = root.querySelector('.community-comment-item[data-comment-id="' + commentId + '"]');
        if (!item) return;
        var form = item.querySelector('[data-comment-form="' + commentId + '"]');
        var bodyEl = item.querySelector('[data-comment-body="' + commentId + '"]');
        var menuWrap = item.querySelector('.community-comment-menu-wrap');
        var input = item.querySelector('[data-comment-input="' + commentId + '"]');
        if (input && input.dataset.originalBody != null) input.value = input.dataset.originalBody;
        if (form) form.hidden = true;
        if (bodyEl) bodyEl.hidden = false;
        if (menuWrap) menuWrap.hidden = false;
      });
    });

    list.querySelectorAll('[data-comment-save]').forEach(function (btn) {
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        var commentId = parseInt(btn.getAttribute('data-comment-save'), 10);
        var item = root.querySelector('.community-comment-item[data-comment-id="' + commentId + '"]');
        if (!item) return;
        var input = item.querySelector('[data-comment-input="' + commentId + '"]');
        var body = input && input.value.trim();
        if (!body) {
          openCommunityConfirmModal({
            type: 'alert',
            title: '입력 확인',
            message: '댓글 내용을 입력해 주세요.',
          });
          return;
        }
        var syncPromise = Promise.resolve();
        if (window.LumiCon && typeof window.LumiCon.ensureServerSynced === 'function') {
          syncPromise = window.LumiCon.ensureServerSynced();
        }
        syncPromise.then(function () {
          return apiFetch('/api/community/posts/' + postId + '/comments/' + commentId, {
            method: 'PATCH',
            body: { body: body },
          });
        }).then(function (result) {
          if (!result.res.ok || !result.data.success) {
            openCommunityConfirmModal({
              type: 'alert',
              title: '수정 실패',
              message: result.data.message || '댓글을 수정하지 못했습니다.',
            });
            return;
          }
          loadComments(postId, root);
        });
      });
    });

    list.querySelectorAll('[data-comment-delete]').forEach(function (btn) {
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        closeAllCommentMenus();
        var commentId = parseInt(btn.getAttribute('data-comment-delete'), 10);
        if (Number.isNaN(commentId)) return;
        openCommunityConfirmModal({
          type: 'confirm',
          title: '댓글 삭제',
          message: '이 댓글을 삭제할까요?\n삭제 후에는 복구할 수 없습니다.',
          confirmText: '삭제',
          cancelText: '취소',
          onConfirm: function () {
            apiFetch('/api/community/posts/' + postId + '/comments/' + commentId, {
              method: 'DELETE',
            }).then(function (result) {
              if (!result.res.ok || !result.data.success) {
                openCommunityConfirmModal({
                  type: 'alert',
                  title: '삭제 실패',
                  message: result.data.message || '댓글을 삭제하지 못했습니다.',
                });
                return;
              }
              loadComments(postId, root);
              refreshPostCommentCount(postId, root);
            });
          },
        });
      });
    });
  }

  function loadComments(postId, root) {
    if (!root) return Promise.resolve();
    var list = root.querySelector('.community-comment-list');
    if (list) list.innerHTML = '<li class="community-comment-empty">불러오는 중…</li>';

    return apiFetch('/api/community/posts/' + postId + '/comments').then(function (result) {
      if (!list) return;
      if (!result.res.ok || !result.data.success) {
        list.innerHTML = '<li class="community-comment-empty">' + escapeHtml(result.data.message || '댓글을 불러오지 못했습니다.') + '</li>';
        return;
      }
      var items = result.data.items || [];
      list.innerHTML = items.length
        ? items.map(renderCommentItem).join('')
        : '<li class="community-comment-empty">첫 댓글을 남겨 보세요.</li>';
      bindCommentListActions(postId, root);
    });
  }

  function renderDetail(item) {
    var box = $('communityDetail');
    if (!box) return;
    var tags = renderBoardTag(item);
    tags += renderStockTag(item);
    var ownerActions = item.isOwner
      ? '<div class="community-detail-owner-actions">' +
        '<button type="button" class="community-detail-edit" id="communityEditPostBtn" aria-label="수정">' +
        editIconHtml(16) + '</button>' +
        '<button type="button" class="community-detail-delete" id="communityDeletePostBtn" aria-label="삭제">' +
        deleteIconHtml(16) + '</button>' +
        '</div>'
      : '';
    var liked = !!item.likedByMe;

    box.innerHTML =
      '<div class="community-detail-post">' +
      '<div class="community-post-tags">' + tags + '</div>' +
      '<h2 class="community-detail-title">' + escapeHtml(item.title) + '</h2>' +
      '<div class="community-detail-meta">' +
      '<span class="community-author-chip">' +
      (typeof jurinAvatarHtml === 'function'
        ? jurinAvatarHtml({ avatarUrl: item.authorAvatarUrl, displayName: item.authorNickname || '회원', sizeClass: 'community-author-avatar community-author-avatar--detail' })
        : '') +
      '<span class="community-author-info">' +
      '<span class="community-author-name" title="' + escapeHtml(item.authorNickname || '회원') + '">' + escapeHtml(item.authorNickname || '회원') + '</span>' +
      '<span class="community-author-date">' + escapeHtml(formatDateTime(item.createdAt)) + '</span>' +
      '</span></span>' +
      '<span class="community-stat--view">조회수 <span class="community-view-count">' + (item.viewCount || 0) + '</span></span>' +
      '</div>' +
      '<div class="community-detail-body">' + escapeHtml(item.body || '') + '</div>' +
      renderPollBlock(item, 'detail') +
      renderDetailAttachments(item.attachments) +
      '<div class="community-detail-foot">' +
      '<button type="button" class="community-stat community-stat-btn community-stat-btn--like' +
        (liked ? ' is-liked' : '') +
        '" data-post-id="' + item.postId + '" aria-label="' + (liked ? '추천 취소' : '추천') + '"' +
        ' aria-pressed="' + (liked ? 'true' : 'false') + '"' +
        '> ' + likeIconHtml(16) + '<span class="community-like-count">' + (item.likeCount || 0) + '</span></button>' +
      '<button type="button" class="community-stat community-stat-btn community-stat-btn--comment">💬 댓글 ' + (item.commentCount || 0) + '</button>' +
      ownerActions +
      '</div>' +
      '</div>' +
      renderCommentsSectionMarkup(item.commentCount);

    bindStockTagClicks(box);
    bindBoardTagClicks(box);
    bindPollBlock(box);
    bindDetailAttachments(box, item.attachments);
    box.querySelectorAll('.community-stat-btn--like').forEach(bindLikeButton);

    var editBtn = $('communityEditPostBtn');
    if (editBtn) {
      editBtn.addEventListener('click', function () {
        navigateToEditPost(item);
      });
    }

    var delBtn = $('communityDeletePostBtn');
    if (delBtn) {
      delBtn.addEventListener('click', function () {
        openCommunityConfirmModal({
          type: 'confirm',
          title: '게시글 삭제',
          message: '이 게시글을 삭제할까요?\n삭제 후에는 복구할 수 없습니다.',
          confirmText: '삭제',
          cancelText: '취소',
          onConfirm: function () {
            apiFetch('/api/community/posts/' + item.postId, { method: 'DELETE' }).then(function (res) {
              if (res.res.ok && res.data.success) {
                showView('feed');
                loadFeed(1);
                loadPopular();
              } else {
                openCommunityConfirmModal({
                  type: 'alert',
                  title: '삭제 실패',
                  message: res.data.message || '삭제하지 못했습니다.',
                });
              }
            });
          },
        });
      });
    }

    bindCommentEvents(item.postId, box);
    loadComments(item.postId, box);
  }

  function closeCommunityConfirmModal() {
    var modal = $('communityConfirmModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }

  function openCommunityConfirmModal(opts) {
    opts = opts || {};
    var modal = $('communityConfirmModal');
    var titleEl = $('communityConfirmModalTitle');
    var msgEl = $('communityConfirmModalMessage');
    var actionsEl = $('communityConfirmModalActions');
    if (!modal || !titleEl || !msgEl || !actionsEl) return;

    titleEl.textContent = opts.title || '알림';
    msgEl.textContent = opts.message || '';
    actionsEl.innerHTML = '';

    if (opts.type === 'confirm') {
      var cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'community-confirm-modal-btn community-confirm-modal-btn--ghost';
      cancelBtn.textContent = opts.cancelText || '취소';
      cancelBtn.addEventListener('click', closeCommunityConfirmModal);

      var confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'community-confirm-modal-btn community-confirm-modal-btn--primary';
      confirmBtn.textContent = opts.confirmText || '확인';
      confirmBtn.addEventListener('click', function () {
        closeCommunityConfirmModal();
        if (typeof opts.onConfirm === 'function') opts.onConfirm();
      });

      actionsEl.appendChild(cancelBtn);
      actionsEl.appendChild(confirmBtn);
    } else {
      var okBtn = document.createElement('button');
      okBtn.type = 'button';
      okBtn.className = 'community-confirm-modal-btn community-confirm-modal-btn--primary';
      okBtn.textContent = opts.confirmText || '확인';
      okBtn.addEventListener('click', closeCommunityConfirmModal);
      actionsEl.appendChild(okBtn);
    }

    modal.hidden = false;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function navigateToWrite() {
    requireLogin('write').then(function (ok) {
      if (!ok) return;
      resetWriteEditState();
      showView('write');
      syncWriteTypesFromFilter();
      initCommunityStockAutocomplete();
      resetWriteAttachment();
      resetWritePoll();
      setFormMsg($('writeFormMsg'), '', '');
    });
  }

  function submitPost(payload, msgEl, onSuccess) {
    return apiFetch('/api/community/posts', { method: 'POST', body: payload }).then(function (result) {
      if (!result.res.ok || !result.data.success) {
        setFormMsg(msgEl, result.data.message || '등록하지 못했습니다.', 'error');
        return false;
      }
      setFormMsg(msgEl, '등록되었습니다.', 'success');
      if (onSuccess) onSuccess(result.data.item);
      return true;
    });
  }

  function updatePost(postId, payload, msgEl, onSuccess) {
    return apiFetch('/api/community/posts/' + postId, { method: 'PATCH', body: payload }).then(function (result) {
      if (!result.res.ok || !result.data.success) {
        setFormMsg(msgEl, result.data.message || '수정하지 못했습니다.', 'error');
        return false;
      }
      setFormMsg(msgEl, '수정되었습니다.', 'success');
      if (onSuccess) onSuccess(result.data.item);
      return true;
    });
  }

  function loadMeta() {
    return apiFetch('/api/community/meta').then(function (result) {
      if (result.res.ok && result.data.success) {
        state.boards = result.data.boards || [];
        state.sidebar = result.data.sidebar || [];
      }
      renderSideNav();
      updateBoardUi('sidebar');
    });
  }

  function parseInitialRoute() {
    var params = new URLSearchParams(window.location.search);
    var board = params.get('board');
    if (board) state.board = normalizeBoardId(board);
    var stockCode = params.get('stock_code') || params.get('stock');
    if (stockCode) state.stockCode = stockCode;
    var stockName = params.get('stock_name');
    if (stockName) state.stockName = stockName;
    var sort = params.get('sort');
    if (sort) state.sort = sort;
    if (state.board === 'popular') state.sort = 'likes';
    var q = params.get('q');
    if (q) {
      state.q = q;
      if ($('communitySearchInput')) $('communitySearchInput').value = q;
    }
    if ($('communitySortSelect')) $('communitySortSelect').value = state.sort;

    var view = params.get('view');
    var id = parseInt(params.get('id'), 10);
    if (view === 'write') {
      return requireLogin('write').then(function (ok) {
        if (ok) {
          showView('write');
          syncWriteTypesFromFilter();
          initCommunityStockAutocomplete();
        } else {
          showView('feed');
        }
      });
    }
    if (view === 'detail' && !Number.isNaN(id)) {
      return openDetail(id);
    }
    updateBoardUi('sidebar');
    showView('feed');
    return loadFeed(1);
  }

  function bindEvents() {
    if ($('communityWriteBtn')) $('communityWriteBtn').addEventListener('click', navigateToWrite);
    if ($('communityWriteCancel')) {
      $('communityWriteCancel').addEventListener('click', function () {
        var editingId = state.editingPostId;
        resetWriteEditState();
        if (editingId) {
          openDetail(editingId);
        } else {
          showView('feed');
        }
      });
    }
    if ($('communityStockFilterClear')) {
      $('communityStockFilterClear').addEventListener('click', function () { clearStockFilter(true); });
    }

    if ($('communitySortSelect')) {
      $('communitySortSelect').addEventListener('change', function () {
        state.sort = $('communitySortSelect').value || 'latest';
        loadFeed(1);
        syncUrl();
      });
    }

    function runCommunitySearch() {
      var searchInput = $('communitySearchInput');
      state.q = searchInput ? searchInput.value.trim() : '';
      loadFeed(1);
      syncUrl();
    }

    var searchInput = $('communitySearchInput');
    if (searchInput) {
      searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          runCommunitySearch();
        }
      });
    }
    if ($('communitySearchBtn')) {
      $('communitySearchBtn').addEventListener('click', runCommunitySearch);
    }

    if ($('writeAttachBtn')) {
      $('writeAttachBtn').addEventListener('click', function () {
        var input = $('writeAttachment');
        if (input) input.click();
      });
    }
    if ($('writeAttachment')) {
      $('writeAttachment').addEventListener('change', onWriteAttachmentSelected);
    }
    if ($('writeAttachClear')) {
      $('writeAttachClear').addEventListener('click', resetWriteAttachment);
    }
    if ($('writeAttachRemove')) {
      $('writeAttachRemove').addEventListener('change', function () {
        if (this.checked) resetWriteAttachment();
      });
    }

    if ($('writePollEnabled')) {
      $('writePollEnabled').addEventListener('change', syncWritePollSettings);
    }
    if ($('writePollAddOption')) {
      $('writePollAddOption').addEventListener('click', addWritePollOption);
    }
    if ($('writePollOptionsList')) {
      $('writePollOptionsList').addEventListener('click', function (e) {
        var btn = e.target.closest('.community-write-poll-option-remove');
        if (!btn) return;
        e.preventDefault();
        var index = parseInt(btn.getAttribute('data-option-index'), 10);
        if (Number.isNaN(index)) return;
        removeWritePollOption(index);
      });
      $('writePollOptionsList').addEventListener('input', function () {
        if (isWritePollEnabled()) validateWritePollOptions();
      });
    }
    document.querySelectorAll('.community-poll-preset-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var hours = parseInt(btn.getAttribute('data-poll-hours'), 10);
        if (Number.isNaN(hours)) return;
        var enabled = $('writePollEnabled');
        if (enabled) enabled.checked = true;
        syncWritePollSettings();
        applyPollPresetHours(hours);
      });
    });

    var writeForm = $('communityWriteForm');
    if (writeForm) {
      bindWriteTypeInScope(writeForm);
      writeForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var msg = $('writeFormMsg');
        var validationError = validateWriteForm();
        if (validationError) {
          setFormMsg(msg, validationError, 'error');
          return;
        }
        setFormMsg(msg, '', '');
        var editingId = state.editingPostId;
        var onDone = function (item) {
          writeForm.reset();
          resetWriteTypeInScope(writeForm);
          clearWriteStockFields();
          resetWriteAttachment();
          resetWritePoll();
          resetWriteEditState();
          if (editingId && item && item.postId) {
            openDetail(item.postId);
          } else {
            showView('feed');
            loadFeed(1);
            loadPopular();
          }
        };
        if (editingId) {
          updatePost(editingId, buildWritePostEditPayload(writeForm), msg, onDone);
        } else {
          submitPost(buildWritePostPayload(writeForm), msg, onDone);
        }
      });
    }

    var quickForm = $('communityQuickWriteForm');
    if (quickForm) {
      bindWriteTypeInScope(quickForm);

      quickForm.addEventListener('submit', function (e) {
        e.preventDefault();
        requireLogin('write').then(function (ok) {
          if (!ok) return;
          var msg = $('quickFormMsg');
          var validationError = validateQuickWriteForm();
          if (validationError) {
            setFormMsg(msg, validationError, 'error');
            return;
          }
          setFormMsg(msg, '', '');
          submitPost({
            board: getWriteBoardFromScope(quickForm),
            title: $('quickTitle') && $('quickTitle').value.trim(),
            body: $('quickBody') && $('quickBody').value.trim(),
          }, msg, function () {
            quickForm.reset();
            resetWriteTypeInScope(quickForm);
            updateQuickCount();
            loadFeed(1);
            loadPopular();
          });
        });
      });
    }

    var quickBody = $('quickBody');
    if (quickBody) {
      quickBody.addEventListener('input', updateQuickCount);
    }

    if ($('communityGuideBtn')) {
      $('communityGuideBtn').addEventListener('click', openGuideModal);
    }
    document.querySelectorAll('[data-community-modal-close]').forEach(function (el) {
      el.addEventListener('click', closeGuideModal);
    });
    if ($('communityConfirmModalBackdrop')) {
      $('communityConfirmModalBackdrop').addEventListener('click', closeCommunityConfirmModal);
    }

    if (!window.__jurinCommunityCommentMenuBound) {
      window.__jurinCommunityCommentMenuBound = true;
      document.addEventListener('click', function () {
        closeAllCommentMenus();
      });
    }
  }

  function updateQuickCount() {
    var body = $('quickBody');
    var countEl = $('quickBodyCount');
    if (!body || !countEl) return;
    countEl.textContent = String(body.value.length);
  }

  function openGuideModal() {
    var modal = $('communityGuideModal');
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeGuideModal() {
    var modal = $('communityGuideModal');
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }

  (function chainCommunityAuthHooks() {
    var prevLogin = typeof window.afterJurinLogin === 'function' ? window.afterJurinLogin : null;
    var prevLogout = typeof window.afterJurinLogout === 'function' ? window.afterJurinLogout : null;
    window.afterJurinLogin = function () {
      if (prevLogin) {
        try { prevLogin(); } catch (e) { /* ignore */ }
      }
      refreshLoginState().then(function () {
        if (state.pendingView === 'write') {
          state.pendingView = null;
          showView('write');
          syncWriteTypesFromFilter();
          initCommunityStockAutocomplete();
        } else if (state.view === 'feed') {
          loadFeed(state.page);
        }
        loadPopular();
      });
    };
    window.afterJurinLogout = function () {
      state.loggedIn = false;
      state.userId = null;
      if (state.view === 'write') showView('feed');
      if (prevLogout) {
        try { prevLogout(); } catch (e) { /* ignore */ }
      }
    };
  })();

  document.addEventListener('DOMContentLoaded', function () {
    bindEvents();
    initWritePollOptions();
    initCommunityStockAutocomplete();
    updateQuickCount();
    refreshLoginState()
      .then(loadMeta)
      .then(function () { return loadPopular(); })
      .then(parseInitialRoute)
      .catch(function () {
        showView('feed');
        loadFeed(1);
      });
  });
})();
