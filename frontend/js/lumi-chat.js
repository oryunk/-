/**
 * 루미 AI 챗봇 — 좌측 하단, 스레드·GPT/FAQ
 * 비로그인: sessionStorage(탭·창 닫으면 삭제), 로그인: MySQL DB
 */
(function () {
  var GUEST_STORAGE_KEY = 'jurin:lumi-chat:v1';
  var ASSET_VER = '20260520a';
  var MOOD_IMAGES = {
    welcome: 'assets/mascot/mascot-welcome.png?v=' + ASSET_VER,
    info: 'assets/mascot/mascot-info.png?v=' + ASSET_VER,
    success: 'assets/mascot/mascot-success.png?v=' + ASSET_VER,
    caution: 'assets/mascot/mascot-caution.png?v=' + ASSET_VER,
    wink: 'assets/mascot/mascot-dock.png?v=' + ASSET_VER,
  };
  var DOCK_IMAGE = 'assets/mascot/mascot-dock.png?v=' + ASSET_VER;

  var state = {
    open: false,
    loggedIn: false,
    userId: null,
    threads: [],
    activeThreadId: null,
    intro: '',
    quickQuestions: ['주식 처음 시작하려면?', '분산투자가 뭐예요?', '손절 기준은 어떻게 잡나요?'],
    sending: false,
    thinking: false,
    thinkingHint: '',
    openThreadMenuId: null,
    currentMood: 'welcome',
    loadError: '',
  };

  function isLocalThreadId(id) {
    return String(id || '').indexOf('local-') === 0;
  }

  function isServerThreadId(id) {
    return /^\d+$/.test(String(id || ''));
  }

  function apiBase() {
    return typeof jurinApiBase === 'function' ? jurinApiBase() : 'http://localhost:5000';
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pageHint() {
    var t = document.title || '';
    var p = window.location.pathname || '';
    return (t + ' ' + p).trim().slice(0, 120);
  }

  /** 가이드·튜토리얼 중에는 사이트 챗봇 미표시(가이드 루미·MascotCoach만 사용) */
  function shouldSuppressSiteLumi() {
    if (window.JurinGuideLumi && typeof window.JurinGuideLumi.isActive === 'function') {
      if (window.JurinGuideLumi.isActive()) return true;
    }
    if (/guide\.html/i.test(window.location.pathname || '')) return true;
    try {
      var params = new URLSearchParams(window.location.search);
      var t = (params.get('tutorial') || '').trim().toLowerCase();
      if (
        t === 'step1' ||
        t === '1' ||
        t === 'step2' ||
        t === '2' ||
        t === 'step3' ||
        t === '3' ||
        t === 'step4' ||
        t === '4' ||
        t === 'step5' ||
        t === '5'
      ) {
        return true;
      }
    } catch (e) { /* ignore */ }
    if (
      document.body.classList.contains('simulation-step5-active') ||
      document.body.classList.contains('market-step1-active') ||
      document.body.classList.contains('market-step2-active') ||
      document.body.classList.contains('market-step3-active') ||
      document.body.classList.contains('market-step4-active') ||
      document.body.classList.contains('tutorial-step1-active') ||
      document.body.classList.contains('mascot-coach-spotlight-dim')
    ) {
      return true;
    }
    return false;
  }

  function newLocalId() {
    return 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  }

  function clearLegacyGuestLocalStorage() {
    try {
      localStorage.removeItem(GUEST_STORAGE_KEY);
    } catch (e) { /* ignore */ }
  }

  function clearGuestStore() {
    try {
      sessionStorage.removeItem(GUEST_STORAGE_KEY);
    } catch (e) { /* ignore */ }
  }

  function readGuestStore() {
    try {
      var raw = sessionStorage.getItem(GUEST_STORAGE_KEY);
      if (!raw) return { threads: [] };
      var data = JSON.parse(raw);
      return data && Array.isArray(data.threads) ? data : { threads: [] };
    } catch (e) {
      return { threads: [] };
    }
  }

  function writeGuestStore(data) {
    try {
      sessionStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  function normalizeMood(m) {
    var x = String(m || 'info').toLowerCase();
    return MOOD_IMAGES[x] ? x : 'info';
  }

  function guessMoodFromText(text) {
    var t = String(text || '').toLowerCase();
    if (/손절|손실|하락|위험|세금|무서|걱정|조심/.test(t)) return 'caution';
    if (/축하|잘했|화이팅|응원|좋아|괜찮|추천/.test(t)) return 'success';
    if (/안녕|반가|루미|소개|처음/.test(t)) return 'welcome';
    if (/ㅎ|헤|고마|친구|재미/.test(t)) return 'wink';
    return 'info';
  }

  /** FAB·헤더는 항상 도크 이미지(답변 대기 중에는 대화창에 생각중 말풍선 표시). */
  function syncChromeDockMascot() {
    ['lumiChatFabImg', 'lumiChatHeaderImg'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.src = DOCK_IMAGE;
    });
  }

  function setThinkingMood(mood) {
    state.currentMood = normalizeMood(mood);
  }

  function getActiveThread() {
    if (!state.activeThreadId) return null;
    for (var i = 0; i < state.threads.length; i++) {
      if (String(state.threads[i].id) === String(state.activeThreadId)) {
        return state.threads[i];
      }
    }
    return null;
  }

  function ensureWelcomeMessage(thread) {
    if (!thread.messages) thread.messages = [];
    if (thread.messages.length === 0) {
      thread.messages.push({
        id: 'intro',
        role: 'assistant',
        content: state.intro || '안녕! 나는 루미야. 궁금한 걸 물어봐!',
        mood: 'welcome',
        created_at: new Date().toISOString(),
      });
    }
  }

  function createLocalThread(title) {
    var t = {
      id: newLocalId(),
      title: (title || '').trim() || '새 대화',
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    ensureWelcomeMessage(t);
    state.threads.unshift(t);
    state.activeThreadId = t.id;
    persistGuest();
    return t;
  }

  function persistGuest() {
    if (state.loggedIn) return;
    writeGuestStore({ threads: state.threads });
  }

  function threadTitleFromMessage(msg) {
    var t = String(msg || '').trim().replace(/\s+/g, ' ');
    if (!t) return '새 대화';
    return t.length > 48 ? t.slice(0, 47) + '…' : t;
  }

  function closeThreadMenu() {
    state.openThreadMenuId = null;
    document.querySelectorAll('.lumi-chat-thread-menu').forEach(function (el) {
      el.hidden = true;
    });
    document.querySelectorAll('.lumi-chat-thread-menu-btn').forEach(function (btn) {
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  function renderThreadList() {
    var list = document.getElementById('lumiChatThreadList');
    if (!list) return;
    if (!state.threads.length) {
      list.innerHTML = '<div class="lumi-chat-empty-threads">대화 없음</div>';
      return;
    }
    var openId = state.openThreadMenuId;
    list.innerHTML = state.threads
      .map(function (th) {
        var active = String(th.id) === String(state.activeThreadId) ? ' is-active' : '';
        var tid = escapeHtml(String(th.id));
        var menuOpen = openId != null && String(openId) === String(th.id);
        return (
          '<div class="lumi-chat-thread-row">' +
          '<button type="button" class="lumi-chat-thread-item' +
          active +
          '" data-thread-id="' +
          tid +
          '">' +
          '<span class="lumi-chat-thread-title">' +
          escapeHtml(th.title || '새 대화') +
          '</span></button>' +
          '<div class="lumi-chat-thread-menu-wrap">' +
          '<button type="button" class="lumi-chat-thread-menu-btn" data-thread-id="' +
          tid +
          '" aria-label="대화 옵션" aria-haspopup="menu" aria-expanded="' +
          (menuOpen ? 'true' : 'false') +
          '">⋯</button>' +
          '<div class="lumi-chat-thread-menu" role="menu" data-thread-id="' +
          tid +
          '"' +
          (menuOpen ? '' : ' hidden') +
          '>' +
          '<button type="button" class="lumi-chat-thread-menu-item lumi-chat-thread-menu-item--delete" role="menuitem" data-thread-id="' +
          tid +
          '">삭제</button>' +
          '</div></div></div>'
        );
      })
      .join('');
  }

  function renderMessages() {
    var box = document.getElementById('lumiChatMessages');
    var quick = document.getElementById('lumiChatQuick');
    if (!box) return;
    if (state.loadError) {
      box.innerHTML =
        '<div class="lumi-chat-msg is-bot"><div class="lumi-chat-bubble">' +
        escapeHtml(state.loadError) +
        '</div></div>';
      if (quick) quick.hidden = true;
      return;
    }
    var thread = getActiveThread();
    if (!thread) {
      box.innerHTML = '';
      if (quick) quick.hidden = false;
      return;
    }
    ensureWelcomeMessage(thread);
    var html = '';
    (thread.messages || []).forEach(function (m) {
      var isUser = m.role === 'user';
      var mood = normalizeMood(m.mood || 'info');
      var avatar = isUser
        ? ''
        : '<img class="lumi-chat-avatar lumi-chat-avatar-bot" src="' +
          escapeHtml(MOOD_IMAGES[mood] || MOOD_IMAGES.info) +
          '" alt="루미">';
      html +=
        '<div class="lumi-chat-msg ' +
        (isUser ? 'is-user' : 'is-bot') +
        '">' +
        avatar +
        '<div class="lumi-chat-bubble">' +
        escapeHtml(m.content || '') +
        '</div></div>';
    });
    if (state.thinking) {
      var thinkMood = normalizeMood(guessMoodFromText(state.thinkingHint || ''));
      html +=
        '<div class="lumi-chat-msg is-bot is-thinking">' +
        '<img class="lumi-chat-avatar lumi-chat-avatar-bot lumi-mood-pop" src="' +
        escapeHtml(MOOD_IMAGES[thinkMood] || MOOD_IMAGES.info) +
        '" alt="루미">' +
        '<div class="lumi-chat-bubble lumi-chat-bubble-thinking">생각중…</div></div>';
    }
    box.innerHTML = html;
    if (quick) {
      quick.hidden = (thread.messages || []).length > 1;
    }
    box.scrollTop = box.scrollHeight;
  }

  function renderQuick() {
    var quick = document.getElementById('lumiChatQuick');
    if (!quick) return;
    var chips = (state.quickQuestions || [])
      .slice(0, 3)
      .map(function (q) {
        return (
          '<button type="button" class="lumi-chat-quick-btn" data-q="' +
          escapeHtml(q) +
          '">' +
          escapeHtml(q) +
          '</button>'
        );
      })
      .join('');
    quick.innerHTML =
      '<p class="lumi-chat-quick-label">자주 묻는 질문</p>' +
      '<div class="lumi-chat-quick-chips">' +
      chips +
      '</div>';
  }

  function setTyping(on, hintText) {
    state.thinking = !!on;
    state.thinkingHint = on ? String(hintText || '') : '';
    if (on) setThinkingMood(guessMoodFromText(state.thinkingHint));
    renderMessages();
  }

  async function fetchConfig() {
    try {
      var res = await fetch(apiBase() + '/api/lumi-chat/config');
      var data = await res.json().catch(function () {
        return {};
      });
      if (data.success) {
        if (data.intro) state.intro = data.intro;
        if (Array.isArray(data.quick_questions) && data.quick_questions.length) {
          state.quickQuestions = data.quick_questions;
        }
      }
    } catch (e) { /* ignore */ }
  }

  async function refreshAuth() {
    state.loggedIn = false;
    state.userId = null;
    try {
      var res = await fetch(apiBase() + '/api/auth/me', { credentials: 'include' });
      var data = await res.json().catch(function () {
        return {};
      });
      if (res.ok && data.success && data.user) {
        state.loggedIn = true;
        state.userId = data.user.user_id || data.user.id;
      }
    } catch (e) { /* ignore */ }
  }

  async function loadThreads() {
    state.loadError = '';
    if (state.loggedIn) {
      try {
        var res = await fetch(apiBase() + '/api/lumi-chat/threads', { credentials: 'include' });
        var data = await res.json().catch(function () {
          return {};
        });
        if (res.status === 401) {
          state.loadError = '로그인이 만료되었어요. 다시 로그인해 주세요.';
          state.threads = [];
          state.activeThreadId = null;
          return;
        }
        if (data.success && Array.isArray(data.threads)) {
          state.threads = data.threads.map(function (t) {
            return {
              id: t.id,
              title: t.title,
              updatedAt: t.updated_at,
              messages: null,
            };
          });
          if (!state.activeThreadId && state.threads.length) {
            state.activeThreadId = state.threads[0].id;
          }
          return;
        }
        state.loadError =
          (data && data.message) || '대화를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
        state.threads = [];
        state.activeThreadId = null;
        return;
      } catch (e) {
        state.loadError = '대화를 불러오지 못했어요. 서버 연결을 확인해 주세요.';
        state.threads = [];
        state.activeThreadId = null;
        return;
      }
    }
    var store = readGuestStore();
    state.threads = store.threads || [];
    if (!state.activeThreadId && state.threads.length) {
      state.activeThreadId = state.threads[0].id;
    }
  }

  async function loadThreadDetail(threadId) {
    if (state.loggedIn && String(threadId).match(/^\d+$/)) {
      try {
        var res = await fetch(apiBase() + '/api/lumi-chat/threads/' + encodeURIComponent(threadId), {
          credentials: 'include',
        });
        var data = await res.json().catch(function () {
          return {};
        });
        if (data.success && data.thread) {
          var th = data.thread;
          for (var i = 0; i < state.threads.length; i++) {
            if (String(state.threads[i].id) === String(th.id)) {
              state.threads[i].title = th.title;
              state.threads[i].messages = th.messages || [];
              state.threads[i].updatedAt = th.updated_at;
              return state.threads[i];
            }
          }
          state.threads.unshift({
            id: th.id,
            title: th.title,
            messages: th.messages || [],
            updatedAt: th.updated_at,
          });
          return state.threads[0];
        }
      } catch (e) { /* ignore */ }
    }
    return getActiveThread();
  }

  async function apiCreateThread(title) {
    var res = await fetch(apiBase() + '/api/lumi-chat/threads', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: (title || '').trim() || '새 대화' }),
    });
    var data = await res.json().catch(function () {
      return {};
    });
    if (!data.success || !data.thread) throw new Error(data.message || '스레드 생성 실패');
    return data.thread;
  }

  async function apiSendMessage(threadId, message) {
    var res = await fetch(
      apiBase() + '/api/lumi-chat/threads/' + encodeURIComponent(threadId) + '/messages',
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message, page_hint: pageHint() }),
      }
    );
    var data = await res.json().catch(function () {
      return {};
    });
    if (!data.success) throw new Error(data.message || '전송 실패');
    return data;
  }

  async function apiGuestReply(message, history) {
    var res = await fetch(apiBase() + '/api/lumi-chat/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message, history: history, page_hint: pageHint() }),
    });
    var data = await res.json().catch(function () {
      return {};
    });
    if (!data.success) throw new Error(data.message || '응답 실패');
    return data.assistant_message;
  }

  function appendUserMessage(thread, message) {
    ensureWelcomeMessage(thread);
    thread.messages.push({
      id: 'u-' + Date.now(),
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    });
    if (thread.title === '새 대화') thread.title = threadTitleFromMessage(message);
    thread.updatedAt = new Date().toISOString();
  }

  async function sendMessage(text) {
    var message = String(text || '').trim();
    if (!message || state.sending) return;

    var thread = getActiveThread();
    if (!thread) {
      thread = await startNewChat();
    }

    if (!state.loggedIn && !isLocalThreadId(thread.id)) {
      thread = createLocalThread();
    }

    if (state.loggedIn && isLocalThreadId(thread.id)) {
      thread = await startNewChat();
    }

    if (state.loggedIn && isServerThreadId(thread.id) && !thread.messages) {
      await loadThreadDetail(thread.id);
      thread = getActiveThread();
    }

    state.sending = true;
    var sendBtn = document.getElementById('lumiChatSend');
    if (sendBtn) sendBtn.disabled = true;

    appendUserMessage(thread, message);
    renderMessages();
    renderThreadList();
    if (!state.loggedIn) persistGuest();

    setTyping(true, message);

    try {
      if (state.loggedIn && isServerThreadId(thread.id)) {
        await apiSendMessage(thread.id, message);
        await loadThreadDetail(thread.id);
        thread = getActiveThread();
        if (thread) thread.updatedAt = new Date().toISOString();
      } else {
        if (state.loggedIn) {
          throw new Error('대화를 서버에 저장하지 못했어요. 다시 로그인 후 시도해 주세요.');
        }
        var history = (thread.messages || [])
          .filter(function (m) {
            return m.id !== 'intro' && m.role && String(m.id).indexOf('err-') !== 0;
          })
          .slice(0, -1)
          .slice(-8)
          .map(function (m) {
            return { role: m.role, content: m.content };
          });
        var assistant = await apiGuestReply(message, history);
        var replyMood = assistant.mood || guessMoodFromText(assistant.content);
        thread.messages.push({
          id: 'a-' + Date.now(),
          role: 'assistant',
          content: assistant.content,
          mood: replyMood,
          created_at: new Date().toISOString(),
        });
        thread.updatedAt = new Date().toISOString();
        persistGuest();
      }
    } catch (err) {
      thread = getActiveThread();
      if (thread) {
        thread.messages.push({
          id: 'err-' + Date.now(),
          role: 'assistant',
          content: (err && err.message) || '답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.',
          mood: 'caution',
          created_at: new Date().toISOString(),
        });
        if (!state.loggedIn) persistGuest();
      }
    }

    state.sending = false;
    setTyping(false);
    if (sendBtn) sendBtn.disabled = false;
    renderMessages();
    renderThreadList();
  }

  async function startNewChat() {
    if (state.loggedIn) {
      try {
        var th = await apiCreateThread();
        var entry = {
          id: th.id,
          title: th.title || '새 대화',
          messages: th.messages || [],
          updatedAt: th.updated_at,
        };
        ensureWelcomeMessage(entry);
        state.threads.unshift(entry);
        state.activeThreadId = entry.id;
        return entry;
      } catch (e) {
        state.loadError = (e && e.message) || '새 대화를 만들지 못했어요.';
        throw e;
      }
    }
    return createLocalThread();
  }


  async function deleteThread(threadId, ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    var id = String(threadId);
    if (state.loggedIn && /^\d+$/.test(id)) {
      try {
        var res = await fetch(
          apiBase() + '/api/lumi-chat/threads/' + encodeURIComponent(id),
          { method: 'DELETE', credentials: 'include' },
        );
        var data = await res.json().catch(function () {
          return {};
        });
        if (!res.ok || !data.success) return;
      } catch (e) {
        return;
      }
    }
    state.threads = state.threads.filter(function (t) {
      return String(t.id) !== id;
    });
    if (String(state.activeThreadId) === id) {
      if (state.threads.length) {
        state.activeThreadId = state.threads[0].id;
        var nxt = getActiveThread();
        if (nxt && !nxt.messages) await loadThreadDetail(state.activeThreadId);
      } else {
        state.activeThreadId = null;
        var created = await startNewChat();
        state.activeThreadId = created.id;
      }
    }
    closeThreadMenu();
    if (!state.loggedIn) persistGuest();
    renderThreadList();
    renderMessages();
  }

  async function selectThread(threadId) {
    state.activeThreadId = threadId;
    var thread = getActiveThread();
    if (thread && !thread.messages) {
      await loadThreadDetail(threadId);
    }
    renderThreadList();
    renderMessages();
  }

  function buildDom() {
    if (document.getElementById('lumiChatRoot')) return;

    var html =
      '<div class="lumi-chat-root" id="lumiChatRoot">' +
      '<button type="button" class="lumi-chat-fab" id="lumiChatFab" aria-label="루미챗봇">' +
      '<img id="lumiChatFabImg" src="' +
      DOCK_IMAGE +
      '" alt="루미">' +
      '<span class="lumi-chat-fab-label">루미챗봇</span></button>' +
      '<div class="lumi-chat-panel" id="lumiChatPanel" aria-hidden="true">' +
      '<div class="lumi-chat-header">' +
      '<div class="lumi-chat-header-left">' +
      '<img id="lumiChatHeaderImg" class="lumi-chat-header-img" src="' +
      DOCK_IMAGE +
      '" alt="루미">' +
      '<span class="lumi-chat-header-title">루미챗봇</span>' +
      '</div>' +
      '<div class="lumi-chat-header-actions">' +
      '<button type="button" id="lumiChatCloseBtn">닫기</button>' +
      '</div></div>' +
      '<div class="lumi-chat-body">' +
      '<aside class="lumi-chat-sidebar">' +
      '<div class="lumi-chat-sidebar-head">' +
      '<button type="button" class="lumi-chat-new-btn" id="lumiChatNewBtn">+ 새 대화</button>' +
      '</div>' +
      '<div class="lumi-chat-thread-list" id="lumiChatThreadList"></div>' +
      '</aside>' +
      '<div class="lumi-chat-main">' +
      '<div class="lumi-chat-messages" id="lumiChatMessages"></div>' +
      '<div class="lumi-chat-quick" id="lumiChatQuick"></div>' +
      '<div class="lumi-chat-compose">' +
      '<textarea id="lumiChatInput" rows="1" placeholder="루미한테 편하게 물어봐…"></textarea>' +
      '<button type="button" class="lumi-chat-send" id="lumiChatSend" aria-label="보내기">➤</button>' +
      '</div></div></div></div></div>';

    document.body.insertAdjacentHTML('beforeend', html);

    document.getElementById('lumiChatFab').addEventListener('click', function () {
      toggle(true);
    });
    document.getElementById('lumiChatCloseBtn').addEventListener('click', function () {
      toggle(false);
    });
    document.getElementById('lumiChatNewBtn').addEventListener('click', function () {
      startNewChat().then(function () {
        renderThreadList();
        renderMessages();
      });
    });
    document.getElementById('lumiChatSend').addEventListener('click', function () {
      var input = document.getElementById('lumiChatInput');
      var v = input ? input.value : '';
      if (input) input.value = '';
      sendMessage(v);
    });
    var inputEl = document.getElementById('lumiChatInput');
    if (inputEl) {
      inputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          var v = inputEl.value;
          inputEl.value = '';
          sendMessage(v);
        }
      });
    }
    document.getElementById('lumiChatThreadList').addEventListener('click', function (e) {
      var delBtn = e.target.closest('.lumi-chat-thread-menu-item--delete');
      if (delBtn) {
        var delId = delBtn.getAttribute('data-thread-id');
        if (delId) deleteThread(delId, e);
        return;
      }
      var menuBtn = e.target.closest('.lumi-chat-thread-menu-btn');
      if (menuBtn) {
        e.preventDefault();
        e.stopPropagation();
        var mid = menuBtn.getAttribute('data-thread-id');
        if (!mid) return;
        if (String(state.openThreadMenuId) === String(mid)) {
          closeThreadMenu();
        } else {
          state.openThreadMenuId = mid;
          renderThreadList();
        }
        return;
      }
      var btn = e.target.closest('.lumi-chat-thread-item');
      if (!btn) return;
      closeThreadMenu();
      var tid = btn.getAttribute('data-thread-id');
      if (tid) selectThread(tid);
    });
    document.addEventListener('click', function (e) {
      if (!state.openThreadMenuId) return;
      if (e.target.closest('.lumi-chat-thread-menu-wrap')) return;
      closeThreadMenu();
      renderThreadList();
    });
    document.getElementById('lumiChatQuick').addEventListener('click', function (e) {
      var b = e.target.closest('.lumi-chat-quick-btn');
      if (!b) return;
      sendMessage(b.getAttribute('data-q') || b.textContent);
    });
  }

  function toggle(open) {
    state.open = open !== undefined ? !!open : !state.open;
    var panel = document.getElementById('lumiChatPanel');
    var fab = document.getElementById('lumiChatFab');
    if (panel) {
      panel.classList.toggle('is-open', state.open);
      panel.setAttribute('aria-hidden', state.open ? 'false' : 'true');
    }
    if (fab) fab.setAttribute('aria-expanded', state.open ? 'true' : 'false');
    if (state.open) {
      var dock = document.getElementById('mascotCoachDock');
      if (dock) dock.style.display = 'none';
      syncChromeDockMascot();
      renderMessages();
    }
  }

  async function rehydrateThreadsAfterAuth(wasLoggedIn) {
    await refreshAuth();
    if (state.loggedIn && !wasLoggedIn) {
      clearGuestStore();
      clearLegacyGuestLocalStorage();
    } else if (!state.loggedIn && wasLoggedIn) {
      clearGuestStore();
      clearLegacyGuestLocalStorage();
    }
    state.activeThreadId = null;
    await loadThreads();
    if (!state.threads.length && !state.loadError) {
      if (state.loggedIn) {
        try {
          await startNewChat();
        } catch (e) { /* loadError may be set in startNewChat */ }
      } else {
        createLocalThread();
      }
    } else if (!state.activeThreadId && state.threads.length) {
      state.activeThreadId = state.threads[0].id;
    }
    var thread = getActiveThread();
    if (thread && !thread.messages) {
      await loadThreadDetail(thread.id);
    }
    renderThreadList();
    renderMessages();
  }

  async function init() {
    if (shouldSuppressSiteLumi()) {
      document.body.classList.add('guide-lumi-session');
      return;
    }
    buildDom();
    clearLegacyGuestLocalStorage();
    await fetchConfig();
    await rehydrateThreadsAfterAuth(false);
    renderQuick();
    syncChromeDockMascot();
    setTyping(false);
  }

  window.LumiChat = {
    init: init,
    open: function () {
      if (shouldSuppressSiteLumi()) return;
      if (!document.getElementById('lumiChatRoot')) init();
      if (!document.getElementById('lumiChatRoot')) return;
      toggle(true);
    },
    close: toggle.bind(null, false),
    refreshAuth: async function () {
      var wasLoggedIn = state.loggedIn;
      await rehydrateThreadsAfterAuth(wasLoggedIn);
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
