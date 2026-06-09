/**
 * 루미콘 — 학습 가이드 보상 이모티콘 + 커뮤니티 댓글 삽입
 */
(function () {
  var STORAGE_KEY = 'jurinLumiconsUnlocked';
  var TUTORIAL_MASK_KEY = 'jurinGuideTutorialBits';
  var TOTAL_BEGINNER_STEPS = 5;
  var GUIDE_ASSUME_ALL_CLEAR = false;
  var GUIDE_FULL_CLEAR_MASK = 31;

  function applyTemporaryGuideFullClear() {
    if (!GUIDE_ASSUME_ALL_CLEAR) return;
    try {
      localStorage.setItem(TUTORIAL_MASK_KEY, String(GUIDE_FULL_CLEAR_MASK));
    } catch (e) { /* ignore */ }
  }
  var MASCOT2_VER = '20260608r';
  var LUMICONS_PER_STEP = 2;

  var CATALOG = [
    { id: 'happy', label: '기쁨', file: 'happy.png' },
    { id: 'excited', label: '신남', file: 'excited.png' },
    { id: 'curious', label: '궁금', file: 'curious.png' },
    { id: 'success', label: '성공', file: 'success.png' },
    { id: 'surprised', label: '놀람', file: 'surprised.png' },
    { id: 'sparkle', label: '반짝', file: 'sparkle.png' },
    { id: 'hello', label: '인사', file: 'hello.png' },
    { id: 'struggling', label: '힘듦', file: 'struggling.png' },
    { id: 'sleepy', label: '졸림', file: 'sleepy.png' },
    { id: 'thinking', label: '생각', file: 'thinking.png' },
  ];

  var catalogById = {};
  CATALOG.forEach(function (item) {
    catalogById[item.id] = item;
  });

  function mascot2Asset(name) {
    if (typeof jurinLumiconAsset === 'function') return jurinLumiconAsset(name);
    return 'assets/mascot2/' + name + '?v=' + MASCOT2_VER;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function lumiconApiFetch(path, options) {
    if (typeof jurinApiBase !== 'function') {
      return Promise.reject(new Error('api_unavailable'));
    }
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

  function readTutorialBitsMask() {
    if (window.JurinTutorialUtil && typeof window.JurinTutorialUtil.readTutorialBitsMask === 'function') {
      return window.JurinTutorialUtil.readTutorialBitsMask();
    }
    try {
      var raw = localStorage.getItem(TUTORIAL_MASK_KEY + ':anon');
      if (raw !== null && raw !== '') {
        var m = parseInt(raw, 10);
        return isNaN(m) ? 0 : Math.min(31, Math.max(0, m));
      }
      return 0;
    } catch (e) {
      return 0;
    }
  }

  function countClearedBeginnerSteps() {
    var mask = readTutorialBitsMask();
    var n = 0;
    for (var i = 0; i < TOTAL_BEGINNER_STEPS; i++) {
      if (mask & (1 << i)) n += 1;
    }
    return n;
  }

  function isGuideRewardEligible() {
    return countClearedBeginnerSteps() >= TOTAL_BEGINNER_STEPS;
  }

  function readUnlockedSet() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var list = JSON.parse(raw);
      if (!Array.isArray(list)) return {};
      var out = {};
      list.forEach(function (id) {
        if (catalogById[id]) out[id] = true;
      });
      return out;
    } catch (e) {
      return {};
    }
  }

  function writeUnlockedSet(set) {
    try {
      var ids = Object.keys(set).filter(function (id) {
        return !!catalogById[id] && set[id];
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch (e) { /* ignore */ }
  }

  function getUnlockedIds() {
    return Object.keys(readUnlockedSet()).filter(function (id) {
      return !!catalogById[id];
    });
  }

  function getProgressUnlockedCount() {
    return Math.min(CATALOG.length, countClearedBeginnerSteps() * LUMICONS_PER_STEP);
  }

  function getProgressUnlockedSet() {
    var n = getProgressUnlockedCount();
    var set = {};
    for (var i = 0; i < n; i++) {
      set[CATALOG[i].id] = true;
    }
    return set;
  }

  function getAllCatalogUnlockedSet() {
    var set = {};
    CATALOG.forEach(function (item) {
      set[item.id] = true;
    });
    return set;
  }

  function hasFullyClaimed() {
    return isGuideRewardEligible() && getUnlockedIds().length >= CATALOG.length;
  }

  function getEffectiveUnlockedSet() {
    if (hasFullyClaimed()) return getAllCatalogUnlockedSet();
    return getProgressUnlockedSet();
  }

  function getUsableIds() {
    return Object.keys(getEffectiveUnlockedSet()).filter(function (id) {
      return !!catalogById[id];
    });
  }

  function getDisplayUnlockedSet() {
    return getEffectiveUnlockedSet();
  }

  function isUnlocked(id) {
    return !!getEffectiveUnlockedSet()[id];
  }

  function hasAnyUnlocked() {
    return getUsableIds().length > 0;
  }

  function unlockAll() {
    var set = {};
    CATALOG.forEach(function (item) {
      set[item.id] = true;
    });
    writeUnlockedSet(set);
    return getUnlockedIds();
  }

  function tokenFor(id) {
    return ':lumi:' + id + ':';
  }

  function assetUrlForId(id) {
    var item = catalogById[id];
    return item ? mascot2Asset(item.file) : '';
  }

  function renderBodyHtml(text) {
    if (!text) return '';
    var re = /:lumi:([a-z0-9_-]+):/g;
    var parts = [];
    var last = 0;
    var match;
    while ((match = re.exec(text)) !== null) {
      parts.push(escapeHtml(text.slice(last, match.index)));
      var id = match[1];
      var item = catalogById[id];
      if (item) {
        parts.push(
          '<img class="lumi-con-inline" src="' +
            escapeHtml(assetUrlForId(id)) +
            '" alt="' +
            escapeHtml(item.label) +
            '" title="' +
            escapeHtml(item.label) +
            '" width="50" height="50" loading="lazy" decoding="async">'
        );
      } else {
        parts.push(escapeHtml(match[0]));
      }
      last = match.index + match[0].length;
    }
    parts.push(escapeHtml(text.slice(last)));
    return parts.join('').replace(/\n/g, '<br>');
  }

  function pickerIconSvg() {
    return (
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9"></circle>' +
      '<path d="M8 14s1.2 2 4 2 4-2 4-2"></path>' +
      '<line x1="9" y1="9" x2="9.01" y2="9"></line>' +
      '<line x1="15" y1="9" x2="15.01" y2="9"></line>' +
      '</svg>'
    );
  }

  function buildPickerButtonHtml() {
    return (
      '<button type="button" class="lumi-con-picker-btn" aria-label="루미콘" title="루미콘">' +
      pickerIconSvg() +
      '</button>'
    );
  }

  function closeAllPickers() {
    document.querySelectorAll('.lumi-con-picker-popover.is-open').forEach(function (el) {
      el.classList.remove('is-open');
    });
    document.querySelectorAll('.lumi-con-picker-btn[aria-expanded="true"]').forEach(function (btn) {
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  function buildPickerPopoverHtml() {
    var unlockedSet = getEffectiveUnlockedSet();
    var cells = CATALOG.map(function (item) {
      var locked = !unlockedSet[item.id];
      return (
        '<button type="button" class="lumi-con-picker-item' +
        (locked ? ' is-locked' : '') +
        '" data-lumicon-id="' +
        escapeHtml(item.id) +
        '"' +
        (locked ? ' disabled title="가이드 단계를 진행하면 해금됩니다"' : ' title="' + escapeHtml(item.label) + '"') +
        '>' +
        '<img src="' +
        escapeHtml(mascot2Asset(item.file)) +
        '" alt="" width="40" height="40" decoding="async">' +
        '<span class="lumi-con-picker-item-label">' +
        escapeHtml(item.label) +
        '</span>' +
        '</button>'
      );
    }).join('');
    return '<div class="lumi-con-picker-popover" hidden><div class="lumi-con-picker-grid">' + cells + '</div></div>';
  }

  function buildEditorHtml() {
    return (
      '<div class="lumi-con-editor community-comment-editor" contenteditable="true" role="textbox" aria-multiline="true" aria-label="댓글 입력" data-placeholder="댓글을 입력하세요"></div>'
    );
  }

  function createLumiconImgHtml(id) {
    var item = catalogById[id];
    if (!item) return '';
    return (
      '<img class="lumi-con-inline lumi-con-chip" contenteditable="false" data-lumicon-id="' +
      escapeHtml(id) +
      '" src="' +
      escapeHtml(assetUrlForId(id)) +
      '" alt="' +
      escapeHtml(item.label) +
      '" title="' +
      escapeHtml(item.label) +
      '" width="50" height="50" decoding="async">'
    );
  }

  function isEditorElement(el) {
    return !!(el && el.classList && el.classList.contains('lumi-con-editor'));
  }

  function getCommentInput(form) {
    if (!form) return null;
    return form.querySelector('.lumi-con-editor') || form.querySelector('textarea');
  }

  function serializeEditor(editor) {
    if (!editor) return '';
    var parts = [];
    function walk(node) {
      if (node.nodeType === 3) {
        parts.push(node.nodeValue || '');
        return;
      }
      if (node.nodeType !== 1) return;
      var tag = node.tagName;
      if (tag === 'IMG') {
        var lumiconId = node.getAttribute('data-lumicon-id');
        if (lumiconId && catalogById[lumiconId]) {
          parts.push(tokenFor(lumiconId));
        }
        return;
      }
      if (tag === 'BR') {
        parts.push('\n');
        return;
      }
      var child = node.firstChild;
      while (child) {
        walk(child);
        child = child.nextSibling;
      }
    }
    walk(editor);
    return parts.join('').replace(/\u200B/g, '').trim();
  }

  function readCommentValue(input) {
    if (!input) return '';
    if (isEditorElement(input)) return serializeEditor(input);
    return String(input.value || '').trim();
  }

  function clearCommentInput(input) {
    if (!input) return;
    if (isEditorElement(input)) {
      input.innerHTML = '';
      return;
    }
    input.value = '';
  }

  function renderEditorHtmlFromTokens(text) {
    if (!text) return '';
    var re = /:lumi:([a-z0-9_-]+):/g;
    var parts = [];
    var last = 0;
    var match;
    while ((match = re.exec(text)) !== null) {
      parts.push(escapeHtml(text.slice(last, match.index)));
      var id = match[1];
      if (catalogById[id]) {
        parts.push(createLumiconImgHtml(id));
      } else {
        parts.push(escapeHtml(match[0]));
      }
      last = match.index + match[0].length;
    }
    parts.push(escapeHtml(text.slice(last)));
    return parts.join('').replace(/\n/g, '<br>');
  }

  function setEditorFromTokens(editor, text) {
    if (!editor || !isEditorElement(editor)) return;
    editor.innerHTML = text ? renderEditorHtmlFromTokens(text) : '';
  }

  function insertIntoEditor(editor, id) {
    if (!editor || !catalogById[id] || !isUnlocked(id)) return;
    editor.focus();
    var sel = window.getSelection();
    if (!sel) return;
    var range = sel.rangeCount ? sel.getRangeAt(0) : null;
    if (!range || !editor.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    range.deleteContents();
    var holder = document.createElement('div');
    holder.innerHTML = createLumiconImgHtml(id);
    var img = holder.firstChild;
    var spacer = document.createTextNode('\u200B');
    range.insertNode(spacer);
    range.insertNode(img);
    range.setStartAfter(spacer);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function insertIntoInput(input, id) {
    if (!input) return;
    if (isEditorElement(input)) {
      insertIntoEditor(input, id);
      return;
    }
    var token = tokenFor(id);
    var start = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
    var end = typeof input.selectionEnd === 'number' ? input.selectionEnd : start;
    input.value = input.value.slice(0, start) + token + input.value.slice(end);
    var next = start + token.length;
    input.focus();
    if (typeof input.setSelectionRange === 'function') {
      input.setSelectionRange(next, next);
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function bindPicker(root, input) {
    if (!root || !input) return;
    var wrap = root.querySelector('.lumi-con-picker-wrap');
    if (!wrap || wrap.dataset.bound === '1') return;
    wrap.dataset.bound = '1';

    var btn = wrap.querySelector('.lumi-con-picker-btn');
    var popover = wrap.querySelector('.lumi-con-picker-popover');
    if (!btn || !popover) return;

    function refreshState() {
      var unlocked = getUsableIds();
      var unlockedSet = getEffectiveUnlockedSet();
      var enabled = unlocked.length > 0;
      btn.disabled = !enabled;
      btn.title = enabled ? '루미콘' : '학습 가이드를 완료하면 루미콘을 사용할 수 있어요';
      var cells = CATALOG.map(function (item) {
        var locked = !unlockedSet[item.id];
        return (
          '<button type="button" class="lumi-con-picker-item' +
          (locked ? ' is-locked' : '') +
          '" data-lumicon-id="' +
          escapeHtml(item.id) +
          '"' +
          (locked ? ' disabled title="가이드 단계를 진행하면 해금됩니다"' : ' title="' + escapeHtml(item.label) + '"') +
          '>' +
          '<img src="' +
          escapeHtml(mascot2Asset(item.file)) +
          '" alt="" width="40" height="40" decoding="async">' +
          '<span class="lumi-con-picker-item-label">' +
          escapeHtml(item.label) +
          '</span>' +
          '</button>'
        );
      }).join('');
      popover.innerHTML = '<div class="lumi-con-picker-grid">' + cells + '</div>';
      popover.querySelectorAll('.lumi-con-picker-item:not(.is-locked)').forEach(function (itemBtn) {
        itemBtn.addEventListener('click', function () {
          insertIntoInput(input, itemBtn.getAttribute('data-lumicon-id'));
          closeAllPickers();
        });
      });
    }

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (btn.disabled) return;
      var willOpen = !popover.classList.contains('is-open');
      closeAllPickers();
      if (willOpen) {
        refreshState();
        popover.hidden = false;
        popover.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });

    refreshState();
  }

  function ensureRewardModal() {
    var existing = document.getElementById('lumiConRewardModal');
    if (existing) return existing;
    var modal = document.createElement('div');
    modal.id = 'lumiConRewardModal';
    modal.className = 'lumi-con-reward-modal';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="lumi-con-reward-modal-backdrop" data-lumi-con-close="1"></div>' +
      '<div class="lumi-con-reward-modal-panel" role="dialog" aria-modal="true" aria-labelledby="lumiConRewardModalTitle">' +
      '<button type="button" class="lumi-con-reward-modal-close" data-lumi-con-close="1" aria-label="닫기">×</button>' +
      '<h2 class="lumi-con-reward-modal-title" id="lumiConRewardModalTitle">루미콘 보상</h2>' +
      '<p class="lumi-con-reward-modal-desc" id="lumiConRewardModalDesc"></p>' +
      '<div class="lumi-con-reward-grid" id="lumiConRewardGrid"></div>' +
      '<div class="lumi-con-reward-modal-actions" id="lumiConRewardModalActions"></div>' +
      '</div>';
    document.body.appendChild(modal);

    modal.addEventListener('click', function (e) {
      if (e.target.closest('[data-lumi-con-close]')) closeRewardPreviewModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) closeRewardPreviewModal();
    });
    return modal;
  }

  function rewardCellHtml(item, opts) {
    var unlocked = !!opts.unlockedSet[item.id];
    var cls = 'lumi-con-reward-cell';
    if (unlocked) cls += ' is-unlocked';
    else cls += ' is-locked';
    return (
      '<div class="' +
      cls +
      '">' +
      '<div class="lumi-con-reward-cell-img">' +
      '<img src="' +
      escapeHtml(mascot2Asset(item.file)) +
      '" alt="" width="56" height="56" decoding="async">' +
      (unlocked ? '<span class="lumi-con-reward-check" aria-hidden="true">✓</span>' : '') +
      (!unlocked ? '<span class="lumi-con-reward-lock" aria-hidden="true">🔒</span>' : '') +
      '</div>' +
      '<span class="lumi-con-reward-cell-label">' +
      escapeHtml(item.label) +
      '</span>' +
      '</div>'
    );
  }

  function renderRewardModalContent(opts) {
    var modal = ensureRewardModal();
    var descEl = modal.querySelector('#lumiConRewardModalDesc');
    var gridEl = modal.querySelector('#lumiConRewardGrid');
    var actionsEl = modal.querySelector('#lumiConRewardModalActions');
    if (!descEl || !gridEl || !actionsEl) return;

    var previewOnly = !!opts.previewOnly;
    var eligible = isGuideRewardEligible();
    var progressCount = getProgressUnlockedCount();
    var claimed = hasFullyClaimed();
    var unlockedSet = claimed ? getAllCatalogUnlockedSet() : getProgressUnlockedSet();

    if (claimed) {
      descEl.textContent = '모든 루미콘을 받았어요! 커뮤니티 댓글에서 사용해 보세요.';
    } else if (previewOnly) {
      descEl.textContent = '해금 상태: ' + progressCount + '개의 이미지 해금 완료';
    } else if (eligible) {
      descEl.textContent =
        '5단계 학습을 모두 마쳤어요. 보상 받기를 누른 뒤 받기를 눌러 주세요.';
    } else {
      descEl.textContent = '해금 상태: ' + progressCount + '개의 이미지 해금 완료';
    }

    gridEl.innerHTML = CATALOG.map(function (item) {
      return rewardCellHtml(item, { unlockedSet: unlockedSet });
    }).join('');

    actionsEl.innerHTML = '';
    if (previewOnly) {
      var previewBtn = document.createElement('button');
      previewBtn.type = 'button';
      previewBtn.className = 'btn-primary lumi-con-reward-close-btn';
      previewBtn.textContent = claimed ? '확인' : '닫기';
      previewBtn.addEventListener('click', function () {
        closeRewardPreviewModal();
      });
      actionsEl.appendChild(previewBtn);
    } else if (eligible && !claimed) {
      var claimBtn = document.createElement('button');
      claimBtn.type = 'button';
      claimBtn.className = 'btn-primary lumi-con-reward-claim-btn';
      claimBtn.textContent = '루미콘 보상 받기';
      claimBtn.addEventListener('click', function () {
        claimGuideReward().then(function (result) {
          renderRewardModalContent(opts);
          if (result && result.syncResult && !result.syncResult.ok && result.syncResult.reason === 'login' && descEl) {
            descEl.textContent =
              '루미콘을 받았어요! 커뮤니티에서 사용하려면 로그인 후 다시 보상 받기를 눌러 주세요.';
          }
        });
      });
      actionsEl.appendChild(claimBtn);
    } else if (claimed && typeof opts.onClaimed === 'function') {
      var receiveBtn = document.createElement('button');
      receiveBtn.type = 'button';
      receiveBtn.className = 'btn-primary lumi-con-reward-close-btn';
      receiveBtn.textContent = '받기';
      receiveBtn.addEventListener('click', function () {
        closeRewardPreviewModal();
        opts.onClaimed();
      });
      actionsEl.appendChild(receiveBtn);
    } else {
      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'btn-primary lumi-con-reward-close-btn';
      closeBtn.textContent = claimed ? '확인' : '닫기';
      closeBtn.addEventListener('click', function () {
        closeRewardPreviewModal();
      });
      actionsEl.appendChild(closeBtn);
    }
  }

  function openRewardPreviewModal(opts) {
    opts = opts || {};
    var modal = ensureRewardModal();
    renderRewardModalContent(opts);
    modal.hidden = false;
    document.body.classList.add('lumi-con-modal-open');
  }

  function closeRewardPreviewModal() {
    var modal = document.getElementById('lumiConRewardModal');
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('lumi-con-modal-open');
  }

  function syncToServer() {
    if (!isGuideRewardEligible() && getUnlockedIds().length === 0) {
      return Promise.resolve({ ok: false, reason: 'not_eligible' });
    }
    return lumiconApiFetch('/api/auth/lumicons/claim-guide-reward', { method: 'POST', body: {} })
      .then(function (result) {
        if (result.res.status === 401) return { ok: false, reason: 'login' };
        return { ok: !!(result.res.ok && result.data && result.data.success) };
      })
      .catch(function () {
        return { ok: false, reason: 'offline' };
      });
  }

  function ensureServerSynced() {
    if (!hasFullyClaimed()) {
      return Promise.resolve({ ok: false, reason: 'not_claimed' });
    }
    return syncToServer();
  }

  function syncFromServer() {
    return lumiconApiFetch('/api/auth/lumicons')
      .then(function (result) {
        if (!result.res.ok || !result.data || !result.data.success) return false;
        var ids = result.data.unlockedIds || [];
        if (!ids.length) return false;
        var set = readUnlockedSet();
        ids.forEach(function (id) {
          if (catalogById[id]) set[id] = true;
        });
        writeUnlockedSet(set);
        return true;
      })
      .catch(function () {
        return false;
      });
  }

  function claimGuideReward() {
    if (!isGuideRewardEligible()) {
      return Promise.resolve({ ids: getUnlockedIds(), syncResult: { ok: false } });
    }
    unlockAll();
    return syncToServer().then(function (syncResult) {
      return { ids: getUnlockedIds(), syncResult: syncResult || { ok: false } };
    });
  }

  function tryAutoClaimGuideReward() {
    if (!isGuideRewardEligible() || hasAnyUnlocked()) return false;
    return false;
  }

  function buildPickerWrapHtml() {
    return (
      '<div class="lumi-con-picker-wrap">' +
      buildPickerButtonHtml() +
      buildPickerPopoverHtml() +
      '</div>'
    );
  }

  function enhanceCommentFormMarkup(markup) {
    return markup.replace(
      '<button type="submit" class="btn-primary community-comment-submit">등록</button>',
      '<div class="community-comment-form-buttons">' +
        buildPickerWrapHtml() +
        '<button type="submit" class="btn-primary community-comment-submit">등록</button>' +
        '</div>'
    );
  }

  window.LumiCon = {
    catalog: CATALOG.slice(),
    countClearedBeginnerSteps: countClearedBeginnerSteps,
    getProgressUnlockedCount: getProgressUnlockedCount,
    hasFullyClaimed: hasFullyClaimed,
    isGuideRewardEligible: isGuideRewardEligible,
    getUnlockedIds: getUnlockedIds,
    getUsableIds: getUsableIds,
    isUnlocked: isUnlocked,
    hasAnyUnlocked: hasAnyUnlocked,
    ensureServerSynced: ensureServerSynced,
    buildEditorHtml: buildEditorHtml,
    getCommentInput: getCommentInput,
    readCommentValue: readCommentValue,
    clearCommentInput: clearCommentInput,
    setEditorFromTokens: setEditorFromTokens,
    claimGuideReward: claimGuideReward,
    tryAutoClaimGuideReward: tryAutoClaimGuideReward,
    syncFromServer: syncFromServer,
    tokenFor: tokenFor,
    assetUrlForId: assetUrlForId,
    renderBodyHtml: renderBodyHtml,
    bindPicker: bindPicker,
    buildPickerWrapHtml: buildPickerWrapHtml,
    enhanceCommentFormMarkup: enhanceCommentFormMarkup,
    openRewardPreviewModal: openRewardPreviewModal,
    closeRewardPreviewModal: closeRewardPreviewModal,
  };

  applyTemporaryGuideFullClear();

  syncFromServer().then(function () {
    if (hasFullyClaimed()) {
      return ensureServerSynced();
    }
    return null;
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.lumi-con-picker-wrap')) closeAllPickers();
  });
})();

