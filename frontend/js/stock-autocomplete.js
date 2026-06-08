/**
 * 파일: 종목·용어 입력 자동완성 (debounce + 드롭다운)
 * 설명( api-base.js 이후 로드. jurinApiBase / JURIN_API_BASE 사용. )
 */
(function (global) {
  'use strict';

  function debounce(fn, ms) {
    var t;
    return function () {
      var ctx = this;
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(ctx, args);
      }, ms);
    };
  }

  function escapeHtml(text) {
    if (text == null) return '';
    var d = document.createElement('div');
    d.textContent = String(text);
    return d.innerHTML;
  }

  function apiOrigin(opts) {
    if (opts && opts.apiBase) return String(opts.apiBase).replace(/\/$/, '');
    if (typeof jurinApiBase === 'function') return jurinApiBase();
    return String(global.JURIN_API_BASE || 'http://127.0.0.1:5000').replace(/\/$/, '');
  }

  /** input을 position 기준으로 감싼다( flex:1 유지 ). */
  function ensureWrap(input) {
    var p = input.parentElement;
    if (p && p.classList.contains('jurin-ac-wrap')) return p;
    var w = document.createElement('div');
    w.className = 'jurin-ac-wrap';
    input.parentNode.insertBefore(w, input);
    w.appendChild(input);
    return w;
  }

  function hideDropdown(dd) {
    if (!dd) return;
    dd.style.display = 'none';
    dd.innerHTML = '';
  }

  function scoreLocalTerm(term, qRaw) {
    var q = String(qRaw || '').trim();
    if (!q) return null;
    var t = String(term || '');
    var ql = q.toLowerCase();
    var tl = t.toLowerCase();
    if (t === q) return [0, 0];
    if (tl === ql) return [0, 1];
    if (tl.startsWith(ql)) return [1, t.length];
    var pos = tl.indexOf(ql);
    if (pos >= 0) return [2, pos, t.length];
    pos = t.indexOf(q);
    if (pos >= 0) return [3, pos];
    return null;
  }

  global.JurinStockAutocomplete = {
    /**
     * @param {HTMLInputElement} inputEl
     * @param {{ apiBase?: string, minChars?: number, limit?: number, debounceMs?: number, compact?: boolean, onSelect?: function(Object): void }} options
     */
    attachStock: function (inputEl, options) {
      if (!inputEl) return;
      var opts = options || {};
      var minChars = opts.minChars != null ? opts.minChars : 1;
      var limit = opts.limit != null ? opts.limit : 12;
      var debounceMs = opts.debounceMs != null ? opts.debounceMs : 200;
      var onSelect = opts.onSelect;
      var isActive =
        typeof opts.isActive === 'function'
          ? opts.isActive
          : function () {
              return true;
            };
      var origin = apiOrigin(opts);
      var wrap = ensureWrap(inputEl);
      if (inputEl.getAttribute('autocomplete') == null) inputEl.setAttribute('autocomplete', 'off');
      var dd = document.createElement('div');
      dd.className =
        'jurin-ac-dd' +
        (opts.compact ? ' jurin-ac-dd--compact' : '') +
        (opts.dropUp ? ' jurin-ac-dd--drop-up' : '');
      dd.setAttribute('role', 'listbox');
      wrap.appendChild(dd);
      var reqId = 0;

      var run = debounce(function () {
        if (!isActive()) {
          hideDropdown(dd);
          return;
        }
        var q = String(inputEl.value || '').trim();
        if (q.length < minChars) {
          hideDropdown(dd);
          return;
        }
        var id = ++reqId;
        fetch(
          origin +
            '/api/stocks/suggest?q=' +
            encodeURIComponent(q) +
            '&limit=' +
            encodeURIComponent(String(limit))
        )
          .then(function (r) {
            return r.json();
          })
          .then(function (data) {
            if (id !== reqId) return;
            var items =
              data && data.success && Array.isArray(data.items) ? data.items : [];
            if (!items.length) {
              hideDropdown(dd);
              return;
            }
            dd.innerHTML = items
              .map(function (it, idx) {
                var code = escapeHtml(String(it.code || ''));
                var name = escapeHtml(String(it.name || ''));
                return (
                  '<button type="button" class="jurin-ac-item" role="option" data-idx="' +
                  idx +
                  '"><span class="jurin-ac-name">' +
                  name +
                  '</span><span class="jurin-ac-code">' +
                  code +
                  '</span></button>'
                );
              })
              .join('');
            dd.style.display = 'block';
            dd.querySelectorAll('.jurin-ac-item').forEach(function (btn, idx) {
              btn.addEventListener('mousedown', function (e) {
                e.preventDefault();
              });
              btn.addEventListener('click', function () {
                var it = items[idx];
                inputEl.value = it.name || it.code || '';
                hideDropdown(dd);
                if (typeof onSelect === 'function') onSelect(it);
              });
            });
          })
          .catch(function () {
            hideDropdown(dd);
          });
      }, debounceMs);

      inputEl.addEventListener('input', run);
      inputEl.addEventListener('focus', function () {
        run();
      });
      document.addEventListener('click', function (e) {
        if (!wrap.contains(e.target)) hideDropdown(dd);
      });
    },

    /**
     * @param {HTMLInputElement} inputEl
     * @param {string[]} terms
     * @param {{ maxItems?: number, debounceMs?: number, onSelect?: function(string): void }} options
     */
    attachLocal: function (inputEl, terms, options) {
      if (!inputEl || !Array.isArray(terms)) return;
      var opts = options || {};
      var maxItems = opts.maxItems != null ? opts.maxItems : 14;
      var debounceMs = opts.debounceMs != null ? opts.debounceMs : 120;
      var onSelect = opts.onSelect;
      var isActive =
        typeof opts.isActive === 'function'
          ? opts.isActive
          : function () {
              return true;
            };
      var wrap = ensureWrap(inputEl);
      if (inputEl.getAttribute('autocomplete') == null) inputEl.setAttribute('autocomplete', 'off');
      var dd = document.createElement('div');
      dd.className =
        'jurin-ac-dd jurin-ac-dd--local' + (opts.dropUp ? ' jurin-ac-dd--drop-up' : '');
      dd.setAttribute('role', 'listbox');
      wrap.appendChild(dd);

      var run = debounce(function () {
        if (!isActive()) {
          hideDropdown(dd);
          return;
        }
        var q = String(inputEl.value || '').trim();
        if (q.length < 1) {
          hideDropdown(dd);
          return;
        }
        var scored = [];
        for (var i = 0; i < terms.length; i += 1) {
          var term = terms[i];
          var sc = scoreLocalTerm(term, q);
          if (sc) scored.push({ sc: sc, term: term });
        }
        scored.sort(function (a, b) {
          var x = a.sc;
          var y = b.sc;
          for (var j = 0; j < Math.max(x.length, y.length); j += 1) {
            var xv = x[j] != null ? x[j] : 0;
            var yv = y[j] != null ? y[j] : 0;
            if (xv !== yv) return xv - yv;
          }
          return String(a.term).localeCompare(String(b.term), 'ko');
        });
        var pick = scored.slice(0, maxItems);
        if (!pick.length) {
          hideDropdown(dd);
          return;
        }
        dd.innerHTML = pick
          .map(function (row, idx) {
            return (
              '<button type="button" class="jurin-ac-item jurin-ac-item--term" role="option" data-idx="' +
              idx +
              '"><span class="jurin-ac-name">' +
              escapeHtml(row.term) +
              '</span></button>'
            );
          })
          .join('');
        dd.style.display = 'block';
        dd.querySelectorAll('.jurin-ac-item').forEach(function (btn, idx) {
          btn.addEventListener('mousedown', function (e) {
            e.preventDefault();
          });
          btn.addEventListener('click', function () {
            var t = pick[idx].term;
            inputEl.value = t;
            hideDropdown(dd);
            if (typeof onSelect === 'function') onSelect(t);
          });
        });
      }, debounceMs);

      inputEl.addEventListener('input', run);
      inputEl.addEventListener('focus', function () {
        run();
      });
      document.addEventListener('click', function (e) {
        if (!wrap.contains(e.target)) hideDropdown(dd);
      });
    },
  };
})(typeof window !== 'undefined' ? window : this);
