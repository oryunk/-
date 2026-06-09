(function () {
  'use strict';

  var state = {
    view: 'board',
    boardPage: 1,
    minePage: 1,
    detailId: null,
    detailFrom: 'board',
    categories: [],
    statuses: [],
    faqItems: [],
    loggedIn: false,
    userId: null,
    pendingView: null,
    attachmentPreviewUrl: null,
    editingInquiryId: null,
    currentInquiryItem: null,
  };

  var CATEGORY_CLASS = {
    investment: 'inquiry-badge--investment',
    service: 'inquiry-badge--service',
    payment: 'inquiry-badge--payment',
    account: 'inquiry-badge--account',
    other: 'inquiry-badge--other',
  };

  function $(id) {
    return document.getElementById(id);
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
    var timeoutMs = options.timeoutMs != null ? options.timeoutMs : 20000;
    delete options.timeoutMs;
    var fetchPromise;
    if (typeof AbortController !== 'undefined' && timeoutMs > 0) {
      var controller = new AbortController();
      options.signal = controller.signal;
      var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
      fetchPromise = fetch(jurinApiBase() + path, options).finally(function () {
        clearTimeout(timer);
      });
    } else {
      fetchPromise = fetch(jurinApiBase() + path, options);
    }
    return fetchPromise.then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { res: res, data: data };
      });
    }).catch(function (err) {
      if (err && err.name === 'AbortError') {
        return {
          res: { ok: false, status: 0 },
          data: { success: false, message: '서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.' },
        };
      }
      return {
        res: { ok: false, status: 0 },
        data: { success: false, message: '서버에 연결할 수 없습니다. 백엔드와 DB 연결을 확인해 주세요.' },
      };
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

  function renderDetailHero(item) {
    var hero = $('detailHero');
    if (!hero) return;
    hero.innerHTML =
      '<div class="inquiry-detail-badges">' +
        statusHtml(item.status, item.statusLabel) +
        badgeHtml(item.category, item.categoryLabel) +
      '</div>' +
      '<div class="inquiry-detail-meta-line">' +
        '<span class="inquiry-author-chip">' +
        (typeof jurinAvatarHtml === 'function'
          ? jurinAvatarHtml({ avatarUrl: item.authorAvatarUrl, displayName: item.authorNickname || '회원', sizeClass: 'inquiry-author-avatar' })
          : '') +
        '<span class="inquiry-author-info">' +
        '<span class="inquiry-author-name" title="' + escapeHtml(item.authorNickname || '회원') + '">' + escapeHtml(item.authorNickname || '회원') + '</span>' +
        '<span class="inquiry-author-date">' + formatDateTime(item.createdAt) + '</span>' +
        '</span></span>' +
        '<span class="inquiry-detail-meta-extra">' +
        '<span>조회수 ' + (item.viewCount || 0) + '</span>' +
        (item.isPrivate ? '<span class="inquiry-visibility inquiry-visibility--private">비공개</span>' : '<span class="inquiry-visibility inquiry-visibility--public">공개</span>') +
        '</span>' +
      '</div>' +
      '<h2 class="inquiry-detail-title">' + escapeHtml(item.title || '') + '</h2>';
  }

  function closeAllReplyMenus() {
    document.querySelectorAll('.inquiry-answer-menu').forEach(function (menu) {
      menu.hidden = true;
    });
    document.querySelectorAll('.inquiry-answer-more-btn').forEach(function (btn) {
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  function buildReplyMenu(replyId) {
    return (
      '<div class="inquiry-answer-menu-wrap">' +
        '<button type="button" class="inquiry-answer-more-btn" data-reply-more="' + replyId + '" aria-label="답변 메뉴" aria-haspopup="menu" aria-expanded="false">' +
          '<svg class="inquiry-answer-more-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
            '<circle cx="12" cy="5" r="1.8"/>' +
            '<circle cx="12" cy="12" r="1.8"/>' +
            '<circle cx="12" cy="19" r="1.8"/>' +
          '</svg>' +
        '</button>' +
        '<div class="inquiry-answer-menu" data-reply-menu="' + replyId + '" role="menu" hidden>' +
          '<button type="button" class="inquiry-answer-menu-item" data-reply-edit="' + replyId + '" role="menuitem">수정</button>' +
          '<div class="inquiry-answer-menu-divider" role="separator"></div>' +
          '<button type="button" class="inquiry-answer-menu-item inquiry-answer-menu-item--danger" data-reply-delete="' + replyId + '" role="menuitem">삭제</button>' +
        '</div>' +
      '</div>'
    );
  }

  function renderAdminReplyCompose(item) {
    var composeEl = $('detailAdminReplyCompose');
    var input = $('detailAdminReplyInput');
    var msgEl = $('detailAdminReplyMsg');
    var canAdminReply = !!(item && item.canEditReply && !(item.replies || []).length);
    if (composeEl) composeEl.hidden = !canAdminReply;
    if (msgEl) {
      msgEl.hidden = true;
      msgEl.textContent = '';
      msgEl.className = 'inquiry-admin-reply-msg';
    }
    if (input && canAdminReply) input.value = '';
  }

  function renderDetailReplies(item) {
    var replies = item.replies || [];
    var section = $('detailAnswerSection');
    var repliesEl = $('detailReplies');
    if (!section || !repliesEl) return;

    var canAdminReply = !!(item && item.canEditReply);
    if (!replies.length && !canAdminReply) {
      section.hidden = true;
      repliesEl.innerHTML = '';
      renderAdminReplyCompose(item);
      return;
    }

    section.hidden = false;
    renderAdminReplyCompose(item);
    repliesEl.innerHTML = replies.map(function (r) {
      var cardMenu = item.canEditReply ? buildReplyMenu(r.replyId) : '';
      return (
        '<article class="inquiry-answer-card" data-reply-id="' + r.replyId + '">' +
          '<div class="inquiry-answer-head">' +
            '<div class="inquiry-answer-brand">' +
              '<img src="assets/brand/jurin-logo-icon.png?v=20260607" alt="" width="36" height="36" decoding="async">' +
              '<div>' +
                '<strong>' + escapeHtml(r.adminName || '주린닷컴 고객센터') + '</strong>' +
                '<span class="inquiry-answer-sub">JURIN.COM SUPPORT</span>' +
              '</div>' +
            '</div>' +
            '<div class="inquiry-answer-head-right">' +
              '<div class="inquiry-answer-head-meta">' +
                statusHtml('answered', '완료') +
                '<time class="inquiry-answer-time">' + formatDateTime(r.createdAt) + '</time>' +
              '</div>' +
              cardMenu +
            '</div>' +
          '</div>' +
          '<div class="inquiry-answer-body" data-reply-body="' + r.replyId + '">' + escapeHtml(r.body || '') + '</div>' +
          '<div class="inquiry-answer-edit-form" data-reply-form="' + r.replyId + '" hidden>' +
            '<textarea data-reply-input="' + r.replyId + '">' + escapeHtml(r.body || '') + '</textarea>' +
            '<div class="inquiry-answer-edit-actions">' +
              '<button type="button" class="inquiry-answer-edit-cancel" data-reply-cancel="' + r.replyId + '">취소</button>' +
              '<button type="button" class="inquiry-answer-edit-save" data-reply-save="' + r.replyId + '">저장</button>' +
            '</div>' +
          '</div>' +
        '</article>'
      );
    }).join('');

    if (!replies.length) {
      repliesEl.innerHTML = '';
    }

    bindReplyEditEvents(item);
  }

  function submitAdminReply() {
    if (!state.detailId) return;
    var input = $('detailAdminReplyInput');
    var msgEl = $('detailAdminReplyMsg');
    var submitBtn = $('detailAdminReplySubmit');
    var body = input && input.value ? input.value.trim() : '';
    if (!body || body.length < 5) {
      if (msgEl) {
        msgEl.hidden = false;
        msgEl.className = 'inquiry-admin-reply-msg is-error';
        msgEl.textContent = '답변 내용을 5자 이상 입력해 주세요.';
      }
      return;
    }
    if (submitBtn) submitBtn.disabled = true;
    apiFetch('/api/support/inquiries/' + state.detailId + '/replies', {
      method: 'POST',
      body: { body: body },
    }).then(function (result) {
      if (submitBtn) submitBtn.disabled = false;
      if (!result.res.ok || !result.data.success) {
        if (msgEl) {
          msgEl.hidden = false;
          msgEl.className = 'inquiry-admin-reply-msg is-error';
          msgEl.textContent = result.data.message || '답변 등록에 실패했습니다.';
        }
        return;
      }
      openDetail(state.detailId, state.detailFrom);
    });
  }

  function bindReplyEditEvents(item) {
    document.querySelectorAll('.inquiry-answer-menu-wrap').forEach(function (wrap) {
      wrap.addEventListener('click', function (event) {
        event.stopPropagation();
      });
    });

    document.querySelectorAll('[data-reply-more]').forEach(function (btn) {
      btn.addEventListener('click', function (event) {
        event.stopPropagation();
        var replyId = btn.getAttribute('data-reply-more');
        var menu = document.querySelector('[data-reply-menu="' + replyId + '"]');
        var willOpen = menu && menu.hidden;
        closeAllReplyMenus();
        if (menu && willOpen) {
          menu.hidden = false;
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });

    document.querySelectorAll('[data-reply-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        closeAllReplyMenus();
        var replyId = btn.getAttribute('data-reply-edit');
        var form = document.querySelector('[data-reply-form="' + replyId + '"]');
        var bodyEl = document.querySelector('[data-reply-body="' + replyId + '"]');
        var card = btn.closest('.inquiry-answer-card');
        var moreWrap = card && card.querySelector('.inquiry-answer-menu-wrap');
        if (form) form.hidden = false;
        if (bodyEl) bodyEl.hidden = true;
        if (moreWrap) moreWrap.hidden = true;
      });
    });

    document.querySelectorAll('[data-reply-cancel]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var replyId = btn.getAttribute('data-reply-cancel');
        var form = document.querySelector('[data-reply-form="' + replyId + '"]');
        var bodyEl = document.querySelector('[data-reply-body="' + replyId + '"]');
        var card = btn.closest('.inquiry-answer-card');
        var moreWrap = card && card.querySelector('.inquiry-answer-menu-wrap');
        var originalBody = '';
        (item.replies || []).forEach(function (r) {
          if (String(r.replyId) === String(replyId)) originalBody = r.body || '';
        });
        var input = document.querySelector('[data-reply-input="' + replyId + '"]');
        if (input) input.value = originalBody;
        if (form) form.hidden = true;
        if (bodyEl) bodyEl.hidden = false;
        if (moreWrap) moreWrap.hidden = false;
      });
    });

    document.querySelectorAll('[data-reply-save]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var replyId = parseInt(btn.getAttribute('data-reply-save'), 10);
        var input = document.querySelector('[data-reply-input="' + replyId + '"]');
        if (!input || !state.detailId) return;
        var body = input.value.trim();
        if (body.length < 5) {
          openInquiryModal({
            type: 'alert',
            title: '입력 확인',
            message: '답변 내용을 5자 이상 입력해 주세요.',
          });
          return;
        }
        apiFetch('/api/support/inquiries/' + state.detailId + '/replies/' + replyId, {
          method: 'PUT',
          body: { body: body },
        }).then(function (result) {
          if (result.res.status === 403) {
            openInquiryModal({
              type: 'alert',
              title: '권한 없음',
              message: result.data.message || '답변 수정 권한이 없습니다.',
            });
            return;
          }
          if (!result.res.ok || !result.data.success) {
            openInquiryModal({
              type: 'alert',
              title: '수정 실패',
              message: result.data.message || '답변 수정에 실패했습니다.',
            });
            return;
          }
          openDetail(state.detailId, state.detailFrom);
        });
      });
    });

    document.querySelectorAll('[data-reply-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        closeAllReplyMenus();
        var replyId = parseInt(btn.getAttribute('data-reply-delete'), 10);
        if (!state.detailId || !replyId) return;
        openInquiryModal({
          type: 'confirm',
          title: '답변 삭제',
          message: '이 답변을 삭제할까요?\n삭제 후에는 복구할 수 없습니다.',
          confirmText: '삭제',
          cancelText: '취소',
          onConfirm: function () {
            apiFetch('/api/support/inquiries/' + state.detailId + '/replies/' + replyId, {
              method: 'DELETE',
            }).then(function (result) {
              if (result.res.status === 403) {
                openInquiryModal({
                  type: 'alert',
                  title: '권한 없음',
                  message: result.data.message || '답변 삭제 권한이 없습니다.',
                });
                return;
              }
              if (!result.res.ok || !result.data.success) {
                openInquiryModal({
                  type: 'alert',
                  title: '삭제 실패',
                  message: result.data.message || '답변 삭제에 실패했습니다.',
                });
                return;
              }
              openDetail(state.detailId, state.detailFrom);
            });
          },
        });
      });
    });
  }

  function formatDate(iso) {
    if (!iso) return '-';
    var s = String(iso).slice(0, 10);
    return s.replace(/-/g, '.');
  }

  function visibilityCellHtml(item) {
    if (item.isPrivate) {
      return '<span class="inquiry-visibility inquiry-visibility--private">비공개</span>';
    }
    return '<span class="inquiry-visibility inquiry-visibility--public">공개</span>';
  }

  function privateLockIconHtml() {
    return (
      '<span class="inquiry-lock" aria-hidden="true">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>' +
      '<path d="M7 11V7a5 5 0 0 1 10 0v4"/>' +
      '</svg></span>'
    );
  }

  function showPrivateInquiryBlockedModal() {
    openInquiryModal({
      type: 'alert',
      title: '비공개 문의',
      message: '비공개로 등록된 문의입니다.\n작성자 본인만 내용을 확인할 수 있어요.',
      confirmText: '확인',
    });
  }

  function inquiryCanViewDetail(item) {
    if (!item) return false;
    if (item.canView === false) return false;
    if (item.isPrivate && !item.isOwner && item.canView !== true) {
      return false;
    }
    return true;
  }

  function displayStatusLabel(status, label) {
    if (status === 'waiting') return '대기';
    if (status === 'answered' || status === 'resolved') return '완료';
    return label || status;
  }

  function badgeHtml(category, label) {
    var cls = CATEGORY_CLASS[category] || 'inquiry-badge--other';
    return '<span class="inquiry-badge ' + cls + '">' + escapeHtml(label || category) + '</span>';
  }

  function statusHtml(status, label) {
    var text = displayStatusLabel(status, label);
    var tone = status === 'resolved' ? 'answered' : status;
    return '<span class="inquiry-status inquiry-status--' + escapeHtml(tone) + '">' + escapeHtml(text) + '</span>';
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function populateSelect(selectEl, items, allLabel) {
    if (!selectEl) return;
    var html = '<option value="">' + escapeHtml(allLabel) + '</option>';
    items.forEach(function (item) {
      html += '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(item.label) + '</option>';
    });
    selectEl.innerHTML = html;
  }

  function populateStatusSelect(selectEl, allLabel) {
    if (!selectEl) return;
    selectEl.innerHTML =
      '<option value="">' + escapeHtml(allLabel) + '</option>' +
      '<option value="waiting">대기</option>' +
      '<option value="answered">완료</option>';
  }

  function populateWriteCategory() {
    var sel = $('writeCategory');
    if (!sel) return;
    var html = '<option value="" disabled selected>카테고리 선택</option>';
    state.categories.forEach(function (item) {
      html += '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(item.label) + '</option>';
    });
    sel.innerHTML = html;
  }

  function setActiveSideNav(view) {
    document.querySelectorAll('.inquiry-side-link').forEach(function (btn) {
      var target = btn.getAttribute('data-view');
      var active = target === view
        || (view === 'detail' && target === state.detailFrom)
        || (view === 'faq' && target === 'board');
      btn.classList.toggle('is-active', !!active);
    });
  }

  function showView(view) {
    state.view = view;
    document.body.classList.toggle('is-board-view', view === 'board');
    document.body.classList.toggle(
      'is-plain-view',
      view === 'mine' || view === 'write' || view === 'detail' || view === 'faq'
    );
    document.querySelectorAll('[data-view-panel]').forEach(function (panel) {
      var show = panel.getAttribute('data-view-panel') === view;
      panel.classList.toggle('is-hidden', !show);
      panel.hidden = !show;
    });
    setActiveSideNav(view);

    var hash = view === 'detail' && state.detailId ? 'detail/' + state.detailId : view;
    if (location.hash.replace(/^#/, '') !== hash) {
      history.replaceState(null, '', 'inquiry.html?view=' + encodeURIComponent(view) + (state.detailId ? '&id=' + state.detailId : '') + '#' + hash);
    }
  }

  function renderTableRow(item, index, total, page, pageSize) {
    index = index || 0;
    total = total || 0;
    page = page || 1;
    pageSize = pageSize || 10;
    var displayNo = item.inquiryId;
    if (total > 0) {
      displayNo = total - ((page - 1) * pageSize + index);
    }
    var locked = item.isPrivate && !inquiryCanViewDetail(item);
    var lock = locked ? privateLockIconHtml() : '';
    var rowClass = locked ? ' inquiry-table-row--private-locked' : '';
    var btnClass = 'inquiry-row-btn' + (locked ? ' inquiry-row-btn--locked' : '');
    return (
      '<tr class="' + rowClass.trim() + '">' +
        '<td class="inquiry-col-no">' + displayNo + '</td>' +
        '<td class="inquiry-col-cat">' + badgeHtml(item.category, item.categoryLabel) + '</td>' +
        '<td class="inquiry-col-title"><button type="button" class="' + btnClass + '" data-inquiry-id="' + item.inquiryId + '" data-can-view="' + (locked ? '0' : '1') + '">' + lock + escapeHtml(item.title) + '</button></td>' +
        '<td class="inquiry-col-author"><span class="inquiry-author-chip inquiry-author-chip--table">' +
        (typeof jurinAvatarHtml === 'function'
          ? jurinAvatarHtml({ avatarUrl: item.authorAvatarUrl, displayName: item.authorNickname || '회원', sizeClass: 'inquiry-author-avatar inquiry-author-avatar--table' })
          : '') +
        '<span class="inquiry-author-name" title="' + escapeHtml(item.authorNickname || '회원') + '">' + escapeHtml(item.authorNickname || '회원') + '</span></span></td>' +
        '<td class="inquiry-col-date">' + formatDate(item.createdAt) + '</td>' +
        '<td class="inquiry-col-status">' + statusHtml(item.status, item.statusLabel) + '</td>' +
        '<td class="inquiry-col-reply">' + visibilityCellHtml(item) + '</td>' +
      '</tr>'
    );
  }

  function renderPagination(container, page, totalPages, onPage) {
    if (!container) return;
    if (totalPages <= 1) {
      container.hidden = true;
      container.innerHTML = '';
      return;
    }
    container.hidden = false;
    var html = '';
    html += '<button type="button" class="inquiry-page-btn" data-page="' + (page - 1) + '" ' + (page <= 1 ? 'disabled' : '') + '>&lt;</button>';
    for (var i = 1; i <= totalPages; i += 1) {
      if (totalPages > 7 && Math.abs(i - page) > 2 && i !== 1 && i !== totalPages) {
        if (i === 2 || i === totalPages - 1) html += '<span>...</span>';
        continue;
      }
      html += '<button type="button" class="inquiry-page-btn' + (i === page ? ' is-active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    html += '<button type="button" class="inquiry-page-btn" data-page="' + (page + 1) + '" ' + (page >= totalPages ? 'disabled' : '') + '>&gt;</button>';
    container.innerHTML = html;
    container.querySelectorAll('[data-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = parseInt(btn.getAttribute('data-page'), 10);
        if (!next || next < 1 || next > totalPages || btn.disabled) return;
        onPage(next);
      });
    });
  }

  function closeInquiryModal() {
    var modal = $('inquiryModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }

  function openInquiryModal(opts) {
    opts = opts || {};
    var modal = $('inquiryModal');
    var titleEl = $('inquiryModalTitle');
    var msgEl = $('inquiryModalMessage');
    var actionsEl = $('inquiryModalActions');
    if (!modal || !titleEl || !msgEl || !actionsEl) return;

    titleEl.textContent = opts.title || '알림';
    msgEl.textContent = opts.message || '';
    actionsEl.innerHTML = '';

    if (opts.type === 'confirm') {
      var cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'inquiry-modal-btn inquiry-modal-btn--ghost';
      cancelBtn.textContent = opts.cancelText || '취소';
      cancelBtn.addEventListener('click', closeInquiryModal);

      var confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'inquiry-modal-btn inquiry-modal-btn--primary';
      confirmBtn.textContent = opts.confirmText || '확인';
      confirmBtn.addEventListener('click', function () {
        closeInquiryModal();
        if (typeof opts.onConfirm === 'function') opts.onConfirm();
      });

      actionsEl.appendChild(cancelBtn);
      actionsEl.appendChild(confirmBtn);
    } else {
      var okBtn = document.createElement('button');
      okBtn.type = 'button';
      okBtn.className = 'inquiry-modal-btn inquiry-modal-btn--primary';
      okBtn.textContent = opts.confirmText || '확인';
      okBtn.addEventListener('click', closeInquiryModal);
      actionsEl.appendChild(okBtn);
    }

    modal.hidden = false;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function deleteInquiry(id, onDeleted) {
    openInquiryModal({
      type: 'confirm',
      title: '문의 삭제',
      message: '이 문의를 삭제할까요?\n삭제 후에는 복구할 수 없습니다.',
      confirmText: '삭제',
      cancelText: '취소',
      onConfirm: function () {
        apiFetch('/api/support/inquiries/' + id, { method: 'DELETE' }).then(function (result) {
          if (result.res.status === 401) {
            openInquiryModal({
              type: 'alert',
              title: '로그인 필요',
              message: '로그인 후 다시 시도해 주세요.',
            });
            requireLogin('mine');
            return;
          }
          if (!result.res.ok || !result.data.success) {
            openInquiryModal({
              type: 'alert',
              title: '삭제 실패',
              message: result.data.message || '문의 삭제에 실패했습니다.',
            });
            return;
          }
          if (typeof onDeleted === 'function') {
            onDeleted();
            return;
          }
          navigateTo(state.detailFrom || 'mine');
          if (state.detailFrom === 'board') {
            loadBoard(state.boardPage);
          } else {
            loadMine(state.minePage);
          }
        });
      },
    });
  }

  function bindRowClicks(tbody, from) {
    if (!tbody) return;
    tbody.querySelectorAll('[data-inquiry-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.getAttribute('data-can-view') === '0') {
          showPrivateInquiryBlockedModal();
          return;
        }
        var id = parseInt(btn.getAttribute('data-inquiry-id'), 10);
        if (id) openDetail(id, from);
      });
    });
  }

  function loadBoard(page) {
    state.boardPage = page || 1;
    var params = new URLSearchParams({
      page: String(state.boardPage),
      page_size: '10',
    });
    var cat = $('boardFilterCategory') && $('boardFilterCategory').value;
    var st = $('boardFilterStatus') && $('boardFilterStatus').value;
    var q = $('boardSearchInput') && $('boardSearchInput').value.trim();
    if (cat) params.set('category', cat);
    if (st) params.set('status', st);
    if (q) params.set('q', q);

    var tbody = $('boardTableBody');
    var empty = $('boardEmpty');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5"><p class="inquiry-empty">불러오는 중…</p></td></tr>';
    }
    if (empty) empty.hidden = true;

    return apiFetch('/api/support/inquiries?' + params.toString()).then(function (result) {
      if (!result.res.ok || !result.data.success) {
        if (tbody) tbody.innerHTML = '';
        if (empty) { empty.hidden = false; empty.textContent = result.data.message || '목록을 불러오지 못했습니다.'; }
        return;
      }
      var items = result.data.items || [];
      var total = result.data.total || 0;
      var currentPage = result.data.page || 1;
      var pageSize = result.data.pageSize || 10;
      if (tbody) {
        tbody.innerHTML = items.map(function (item, idx) {
          return renderTableRow(item, idx, total, currentPage, pageSize);
        }).join('');
      }
      if (empty) empty.hidden = items.length > 0;
      bindRowClicks(tbody, 'board');
      renderPagination($('boardPagination'), result.data.page, result.data.totalPages, loadBoard);
    });
  }

  function loadMine(page) {
    return refreshLoginState().then(function () {
      if (!state.loggedIn) {
        var tbody = $('mineTableBody');
        var empty = $('mineEmpty');
        if (tbody) tbody.innerHTML = '';
        if (empty) { empty.hidden = false; empty.textContent = '로그인 후 이용할 수 있습니다.'; }
        return;
      }
      state.minePage = page || 1;
      var params = new URLSearchParams({
        page: String(state.minePage),
        page_size: '10',
      });
      var cat = $('mineFilterCategory') && $('mineFilterCategory').value;
      var st = $('mineFilterStatus') && $('mineFilterStatus').value;
      var q = $('mineSearchInput') && $('mineSearchInput').value.trim();
      if (cat) params.set('category', cat);
      if (st) params.set('status', st);
      if (q) params.set('q', q);

      return apiFetch('/api/support/inquiries/mine?' + params.toString()).then(function (result) {
        var tbody = $('mineTableBody');
        var empty = $('mineEmpty');
        if (result.res.status === 401) {
          if (tbody) tbody.innerHTML = '';
          if (empty) { empty.hidden = false; empty.textContent = '로그인 후 이용할 수 있습니다.'; }
          return;
        }
        if (!result.res.ok || !result.data.success) {
          if (tbody) tbody.innerHTML = '';
          if (empty) { empty.hidden = false; empty.textContent = result.data.message || '목록을 불러오지 못했습니다.'; }
          return;
        }
        var items = result.data.items || [];
        var total = result.data.total || 0;
        var currentPage = result.data.page || 1;
        var pageSize = result.data.pageSize || 10;
        if (tbody) {
          tbody.innerHTML = items.map(function (item, idx) {
            return renderTableRow(item, idx, total, currentPage, pageSize);
          }).join('');
        }
        if (empty) empty.hidden = items.length > 0;
        bindRowClicks(tbody, 'mine');
        renderPagination($('minePagination'), result.data.page, result.data.totalPages, loadMine);
      });
    });
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

  function onAttachmentSelected() {
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
      if (msg) {
        msg.textContent = '첨부 이미지는 10MB 이하여야 합니다.';
        msg.className = 'inquiry-form-msg is-error';
      }
      resetWriteAttachment();
      return;
    }
    if (!/^image\/(jpeg|png|gif|webp)$/i.test(file.type)) {
      if (msg) {
        msg.textContent = 'JPEG, PNG, GIF, WEBP 이미지만 첨부할 수 있습니다.';
        msg.className = 'inquiry-form-msg is-error';
      }
      resetWriteAttachment();
      return;
    }
    if (msg) {
      msg.textContent = '';
      msg.className = 'inquiry-form-msg';
    }
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

  function renderDetailAttachments(attachments) {
    var container = $('detailAttachments');
    if (!container) return;
    var items = attachments || [];
    if (!items.length) {
      container.innerHTML = '';
      container.hidden = true;
      return;
    }
    container.hidden = false;
    container.innerHTML = items.map(function (item) {
      return (
        '<div class="inquiry-detail-attach" data-attachment-id="' + item.attachmentId + '">' +
          '<div class="inquiry-detail-attach-loading">이미지 불러오는 중...</div>' +
        '</div>'
      );
    }).join('');

    items.forEach(function (item) {
      var block = container.querySelector('[data-attachment-id="' + item.attachmentId + '"]');
      if (!block) return;
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
          block.innerHTML = '<p class="inquiry-empty">첨부 이미지를 불러오지 못했습니다.</p>';
        });
    });
  }

  function openDetail(id, from) {
    state.detailId = id;
    state.detailFrom = from || 'board';
    apiFetch('/api/support/inquiries/' + id).then(function (result) {
      if (result.res.status === 403) {
        showPrivateInquiryBlockedModal();
        return;
      }
      if (!result.res.ok || !result.data.success) {
        openInquiryModal({
          type: 'alert',
          title: '불러오기 실패',
          message: result.data.message || '문의를 불러오지 못했습니다.',
        });
        return;
      }
      var item = result.data.inquiry;
      var replies = item.replies || [];
      state.currentInquiryItem = item;

      renderDetailHero(item);
      $('detailBody').textContent = item.body || '';
      var qTime = $('detailQuestionTime');
      if (qTime) qTime.textContent = formatDateTime(item.createdAt);
      renderDetailAttachments(item.attachments || []);
      renderDetailReplies(item);

      var ownerActions = $('detailOwnerActions');
      var editBtn = $('detailEditBtn');
      if (ownerActions) ownerActions.hidden = !item.isOwner;
      if (editBtn) editBtn.hidden = !(item.isOwner && replies.length === 0);

      var feedbackBox = $('detailFeedback');
      var helpfulBtn = $('feedbackHelpfulBtn');
      var notHelpfulBtn = $('feedbackNotHelpfulBtn');
      if (feedbackBox) {
        var showFeedback = replies.length > 0 && isLoggedIn() && !item.feedback;
        feedbackBox.hidden = !showFeedback;
        if (helpfulBtn) helpfulBtn.disabled = false;
        if (notHelpfulBtn) notHelpfulBtn.disabled = false;
      }

      showView('detail');
    });
  }

  function submitFeedback(helpful) {
    if (!state.detailId) return;
    apiFetch('/api/support/inquiries/' + state.detailId + '/feedback', {
      method: 'POST',
      body: { helpful: helpful },
    }).then(function (result) {
      if (!result.res.ok || !result.data.success) {
        openInquiryModal({
          type: 'alert',
          title: '피드백 실패',
          message: result.data.message || '피드백 저장에 실패했습니다.',
        });
        return;
      }
      var feedbackBox = $('detailFeedback');
      if (feedbackBox) feedbackBox.hidden = true;
    });
  }

  function renderFaq() {
    var list = $('faqList');
    if (!list) return;
    list.innerHTML = (state.faqItems || []).map(function (item, idx) {
      return (
        '<div class="inquiry-faq-item" data-faq-idx="' + idx + '">' +
          '<button type="button" class="inquiry-faq-q">' + escapeHtml(item.question) + '</button>' +
          '<div class="inquiry-faq-a">' + escapeHtml(item.answer) + '</div>' +
        '</div>'
      );
    }).join('');
    list.querySelectorAll('.inquiry-faq-q').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.closest('.inquiry-faq-item');
        if (item) item.classList.toggle('is-open');
      });
    });
  }

  function loadMeta() {
    return apiFetch('/api/support/faq').then(function (result) {
      if (!result.res.ok || !result.data.success) return;
      state.categories = result.data.categories || [];
      state.statuses = result.data.statuses || [];
      state.faqItems = result.data.items || [];
      populateSelect($('boardFilterCategory'), state.categories, '전체 카테고리');
      populateStatusSelect($('boardFilterStatus'), '전체 상태');
      populateSelect($('mineFilterCategory'), state.categories, '전체 카테고리');
      populateStatusSelect($('mineFilterStatus'), '전체 상태');
      populateWriteCategory();
      renderFaq();
    });
  }

  function resetInquiryEditState() {
    state.editingInquiryId = null;
    var titleEl = document.querySelector('#inquiryViewWrite .inquiry-card-title');
    var subEl = document.querySelector('#inquiryViewWrite .inquiry-card-sub');
    var submitBtn = document.querySelector('#inquiryWriteForm .inquiry-submit-btn');
    var attachBlock = document.querySelector('#inquiryWriteForm .inquiry-attach');
    if (titleEl) titleEl.textContent = '문의 작성하기';
    if (subEl) {
      subEl.textContent = '궁금한 내용을 자세히 입력해주시면 더 빠르고 정확한 답변을 드릴 수 있어요.';
    }
    if (submitBtn) submitBtn.textContent = '등록하기';
    if (attachBlock) attachBlock.hidden = false;
    var extras = $('inquiryWriteEditExtras');
    if (extras) extras.hidden = true;
    var attachExisting = $('inquiryEditExistingAttach');
    if (attachExisting) attachExisting.hidden = true;
    if ($('writeAttachRemove')) $('writeAttachRemove').checked = false;
    if ($('inquiryEditAttachPreview')) $('inquiryEditAttachPreview').innerHTML = '';
  }

  function openEditInquiry(item) {
    if (!item) return;
    requireLogin('write').then(function (ok) {
      if (!ok) return;
      var form = $('inquiryWriteForm');
      if (form) form.reset();
      resetWriteAttachment();
      resetInquiryEditState();
      state.editingInquiryId = item.inquiryId;
      populateWriteCategory();
      if ($('writeCategory')) $('writeCategory').value = item.category || '';
      if ($('writeTitle')) $('writeTitle').value = item.title || '';
      if ($('writeBody')) $('writeBody').value = item.body || '';
      if ($('writePrivate')) $('writePrivate').checked = !!item.isPrivate;
      var titleEl = document.querySelector('#inquiryViewWrite .inquiry-card-title');
      var subEl = document.querySelector('#inquiryViewWrite .inquiry-card-sub');
      var submitBtn = document.querySelector('#inquiryWriteForm .inquiry-submit-btn');
      var attachBlock = document.querySelector('#inquiryWriteForm .inquiry-attach');
      if (titleEl) titleEl.textContent = '문의 수정하기';
      if (subEl) subEl.textContent = '답변 등록 전까지 내용을 수정할 수 있어요.';
      if (submitBtn) submitBtn.textContent = '저장하기';
      if (attachBlock) attachBlock.hidden = false;

      var extras = $('inquiryWriteEditExtras');
      if (extras) extras.hidden = false;
      var attachments = item.attachments || [];
      var attachExisting = $('inquiryEditExistingAttach');
      var attachPreview = $('inquiryEditAttachPreview');
      if (attachExisting) attachExisting.hidden = !attachments.length;
      if (attachments.length && attachPreview) {
        var att = attachments[0];
        var src = att.url || '';
        if (src && src.charAt(0) === '/') {
          src = jurinApiBase() + src;
        }
        attachPreview.innerHTML = '<img src="' + escapeHtml(src) + '" alt="현재 첨부 이미지">';
      } else if (attachPreview) {
        attachPreview.innerHTML = '';
      }
      if ($('writeAttachRemove')) $('writeAttachRemove').checked = false;

      clearWriteFormMessage();
      showView('write');
    });
  }

  function navigateTo(view) {
    if (view === 'mine') {
      requireLogin('mine').then(function (ok) {
        if (!ok) {
          showView('board');
          loadBoard(state.boardPage || 1);
          return;
        }
        showView('mine');
        loadMine(1);
      });
      return;
    }
    if (view === 'write') {
      requireLogin('write').then(function (ok) {
        if (!ok) {
          showView('board');
          loadBoard(state.boardPage || 1);
          return;
        }
        var form = $('inquiryWriteForm');
        if (form) form.reset();
        resetInquiryEditState();
        showView('write');
        resetWriteAttachment();
        var msg = $('writeFormMsg');
        if (msg) { msg.textContent = ''; msg.className = 'inquiry-form-msg'; }
      });
      return;
    }
    showView(view);
    if (view === 'board') loadBoard(state.boardPage);
    if (view === 'faq') renderFaq();
  }

  function showWriteFormError(message) {
    var msg = $('writeFormMsg');
    if (!msg) return;
    msg.textContent = message;
    msg.className = 'inquiry-form-msg is-error';
  }

  function clearWriteFormMessage() {
    var msg = $('writeFormMsg');
    if (!msg) return;
    msg.textContent = '';
    msg.className = 'inquiry-form-msg';
  }

  function validateWriteForm(category, title, body) {
    if (!category) {
      return '카테고리를 선택해 주세요.';
    }
    if (!title || title.length > 200) {
      return '제목을 1~200자로 입력해 주세요.';
    }
    if (!body || body.length < 10) {
      return '내용을 10자 이상 입력해 주세요.';
    }
    return '';
  }

  function submitWriteForm(event) {
    event.preventDefault();
    clearWriteFormMessage();

    var category = $('writeCategory') && $('writeCategory').value;
    var title = $('writeTitle') && $('writeTitle').value.trim();
    var body = $('writeBody') && $('writeBody').value.trim();
    var validationError = validateWriteForm(category, title, body);
    if (validationError) {
      showWriteFormError(validationError);
      return;
    }

    var msg = $('writeFormMsg');
    var isPrivate = $('writePrivate') && $('writePrivate').checked;
    var editingId = state.editingInquiryId;

    if (editingId) {
      var removeAttachment = !!($('writeAttachRemove') && $('writeAttachRemove').checked);
      var editPayload;
      if (fileInput && fileInput.files && fileInput.files[0]) {
        editPayload = new FormData();
        editPayload.append('category', category || '');
        editPayload.append('title', title || '');
        editPayload.append('body', body || '');
        editPayload.append('isPrivate', isPrivate ? 'true' : 'false');
        editPayload.append('attachment', fileInput.files[0]);
      } else {
        editPayload = {
          category: category,
          title: title,
          body: body,
          isPrivate: isPrivate,
          removeAttachment: removeAttachment,
        };
      }
      apiFetch('/api/support/inquiries/' + editingId, {
        method: 'PATCH',
        body: editPayload,
      }).then(function (result) {
        if (result.res.status === 401) {
          requireLogin('write');
          return;
        }
        if (!result.res.ok || !result.data.success) {
          showWriteFormError(result.data.message || '수정에 실패했습니다.');
          return;
        }
        if (msg) {
          msg.textContent = '문의가 수정되었습니다.';
          msg.className = 'inquiry-form-msg is-success';
        }
        var form = $('inquiryWriteForm');
        if (form) form.reset();
        resetWriteAttachment();
        resetInquiryEditState();
        setTimeout(function () {
          openDetail(editingId, state.detailFrom || 'mine');
        }, 400);
      });
      return;
    }

    var fileInput = $('writeAttachment');
    var payload;
    if (fileInput && fileInput.files && fileInput.files[0]) {
      payload = new FormData();
      payload.append('category', category || '');
      payload.append('title', title || '');
      payload.append('body', body || '');
      payload.append('isPrivate', isPrivate ? 'true' : 'false');
      payload.append('attachment', fileInput.files[0]);
    } else {
      payload = { category: category, title: title, body: body, isPrivate: isPrivate };
    }

    apiFetch('/api/support/inquiries', {
      method: 'POST',
      body: payload,
    }).then(function (result) {
      if (result.res.status === 401) {
        requireLogin('write');
        return;
      }
      if (!result.res.ok || !result.data.success) {
        showWriteFormError(result.data.message || '등록에 실패했습니다.');
        return;
      }
      if (msg) {
        msg.textContent = '문의가 등록되었습니다.';
        msg.className = 'inquiry-form-msg is-success';
      }
      var form = $('inquiryWriteForm');
      if (form) form.reset();
      resetWriteAttachment();
      setTimeout(function () {
        navigateTo('mine');
      }, 600);
    });
  }

  function parseInitialRoute() {
    var params = new URLSearchParams(location.search);
    var view = params.get('view') || 'board';
    var id = parseInt(params.get('id') || '', 10);
    if (view === 'detail' && id) {
      state.detailId = id;
      openDetail(id, 'board');
      return;
    }
    navigateTo(view);
  }

  function bindEvents() {
    document.querySelectorAll('.inquiry-side-link, [data-view-jump]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var view = btn.getAttribute('data-view') || btn.getAttribute('data-view-jump');
        if (view) navigateTo(view);
      });
    });

    $('inquiryWriteBtn') && $('inquiryWriteBtn').addEventListener('click', function () { navigateTo('write'); });
    $('mineWriteBtn') && $('mineWriteBtn').addEventListener('click', function () { navigateTo('write'); });

    $('detailEditBtn') && $('detailEditBtn').addEventListener('click', function () {
      if (state.currentInquiryItem) openEditInquiry(state.currentInquiryItem);
    });

    $('detailDeleteBtn') && $('detailDeleteBtn').addEventListener('click', function () {
      if (state.detailId) {
        deleteInquiry(state.detailId, function () {
          navigateTo(state.detailFrom || 'mine');
          if (state.detailFrom === 'board') {
            loadBoard(state.boardPage);
          } else {
            loadMine(state.minePage);
          }
        });
      }
    });

    document.addEventListener('click', function () {
      closeAllReplyMenus();
    });

    $('inquiryModalBackdrop') && $('inquiryModalBackdrop').addEventListener('click', closeInquiryModal);

    function bindSearchEnter(inputId, loadFn) {
      var input = $(inputId);
      if (!input) return;
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          loadFn(1);
        }
      });
    }

    $('boardSearchBtn') && $('boardSearchBtn').addEventListener('click', function () { loadBoard(1); });
    $('mineSearchBtn') && $('mineSearchBtn').addEventListener('click', function () { loadMine(1); });
    bindSearchEnter('boardSearchInput', loadBoard);
    bindSearchEnter('mineSearchInput', loadMine);
    $('boardFilterCategory') && $('boardFilterCategory').addEventListener('change', function () { loadBoard(1); });
    $('boardFilterStatus') && $('boardFilterStatus').addEventListener('change', function () { loadBoard(1); });
    $('mineFilterCategory') && $('mineFilterCategory').addEventListener('change', function () { loadMine(1); });
    $('mineFilterStatus') && $('mineFilterStatus').addEventListener('change', function () { loadMine(1); });

    $('inquiryWriteForm') && $('inquiryWriteForm').addEventListener('submit', submitWriteForm);
    $('writeAttachBtn') && $('writeAttachBtn').addEventListener('click', function () {
      var input = $('writeAttachment');
      if (input) input.click();
    });
    $('writeAttachment') && $('writeAttachment').addEventListener('change', onAttachmentSelected);
    $('writeAttachClear') && $('writeAttachClear').addEventListener('click', resetWriteAttachment);
    $('writeAttachRemove') && $('writeAttachRemove').addEventListener('change', function () {
      if (this.checked) resetWriteAttachment();
    });
    $('feedbackHelpfulBtn') && $('feedbackHelpfulBtn').addEventListener('click', function () { submitFeedback(true); });
    $('feedbackNotHelpfulBtn') && $('feedbackNotHelpfulBtn').addEventListener('click', function () { submitFeedback(false); });
    $('detailAdminReplySubmit') && $('detailAdminReplySubmit').addEventListener('click', submitAdminReply);
  }

  window.afterJurinLogin = function () {
    refreshLoginState().then(function () {
      if (state.pendingView) {
        var pending = state.pendingView;
        state.pendingView = null;
        navigateTo(pending);
      } else if (state.view === 'mine' || state.view === 'write') {
        navigateTo(state.view);
      } else {
        loadBoard(state.boardPage);
      }
    });
  };

  window.afterJurinLogout = function () {
    state.loggedIn = false;
    state.userId = null;
    if (state.view === 'mine' || state.view === 'write') {
      navigateTo('board');
    } else if (state.view === 'board') {
      loadBoard(state.boardPage);
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    bindEvents();
    refreshLoginState().catch(function () { /* public board works without login */ });
    loadMeta()
      .catch(function () { /* faq meta optional */ })
      .then(function () { return parseInitialRoute(); })
      .catch(function () {
        showView('board');
        loadBoard(1);
      });
  });
})();
