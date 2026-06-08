/**
 * jurin-alert-modal.js — 초록·하얀 확인 알림 모달
 */
(function () {
  var MODAL_ID = 'jurinAlertModal';
  var wired = false;

  function ensureModal() {
    var modal = document.getElementById(MODAL_ID);
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'jurin-alert-modal';
    modal.id = MODAL_ID;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML =
      '<div class="jurin-alert-modal-backdrop" id="jurinAlertModalBackdrop"></div>' +
      '<div class="jurin-alert-modal-panel" role="alertdialog" aria-modal="true" aria-labelledby="jurinAlertModalTitle">' +
      '<h3 class="jurin-alert-modal-title" id="jurinAlertModalTitle">알림</h3>' +
      '<p class="jurin-alert-modal-message" id="jurinAlertModalMessage"></p>' +
      '<div class="jurin-alert-modal-actions">' +
      '<button type="button" class="jurin-alert-modal-btn jurin-alert-modal-btn--primary" id="jurinAlertModalConfirm">확인</button>' +
      '</div></div>';
    document.body.appendChild(modal);
    wireEvents();
    return modal;
  }

  function wireEvents() {
    if (wired) return;
    wired = true;

    document.addEventListener('click', function (e) {
      if (e.target && e.target.id === 'jurinAlertModalBackdrop') {
        closeJurinAlert();
      }
      if (e.target && e.target.id === 'jurinAlertModalConfirm') {
        closeJurinAlert();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var modal = document.getElementById(MODAL_ID);
      if (modal && modal.classList.contains('is-open')) {
        closeJurinAlert();
      }
    });
  }

  function closeJurinAlert() {
    var modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }

  function openJurinAlert(message, title) {
    ensureModal();
    var modal = document.getElementById(MODAL_ID);
    var titleEl = document.getElementById('jurinAlertModalTitle');
    var msgEl = document.getElementById('jurinAlertModalMessage');
    if (!modal || !titleEl || !msgEl) return;
    titleEl.textContent = title || '알림';
    msgEl.textContent = message || '';
    modal.hidden = false;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    var confirmBtn = document.getElementById('jurinAlertModalConfirm');
    if (confirmBtn) confirmBtn.focus();
  }

  window.openJurinAlert = openJurinAlert;
  window.closeJurinAlert = closeJurinAlert;
  window.JurinAlertModal = {
    open: openJurinAlert,
    close: closeJurinAlert,
  };
})();
