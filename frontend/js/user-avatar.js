/**
 * 공통 사용자 프로필 아바타 렌더링
 */

const JURIN_DEFAULT_AVATAR = 'assets/profile/default-avatar.svg';

const JURIN_AVATAR_DISPLAY_SIZES = {
  'community-author-avatar': 40,
  'community-author-avatar--comment': 36,
  'community-author-avatar--detail': 48,
  'inquiry-author-avatar': 40,
  'inquiry-author-avatar--table': 36,
  'nav-user-avatar': 28,
};

const JURIN_AVATAR_PREVIEW_ORIGINAL = 0;

const JURIN_AVATAR_UPLOAD_MAX_SIDE = 1024;

function jurinDefaultAvatarUrl() {
  return JURIN_DEFAULT_AVATAR;
}

function jurinAvatarShouldClientCrop(file) {
  const type = String((file && file.type) || '').toLowerCase();
  return type === 'image/jpeg' || type === 'image/png' || type === 'image/webp';
}

function jurinCropAvatarFileToSquare(file, maxOutputSize) {
  const limit = Math.max(64, parseInt(maxOutputSize, 10) || JURIN_AVATAR_UPLOAD_MAX_SIDE);
  return new Promise(function (resolve, reject) {
    if (!file || !jurinAvatarShouldClientCrop(file)) {
      resolve(file || null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(objectUrl);
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (!width || !height) {
        reject(new Error('invalid_image'));
        return;
      }
      const side = Math.min(width, height);
      const sx = (width - side) / 2;
      const sy = (height - side) / 2;
      const outputSide = Math.min(limit, side);
      const canvas = document.createElement('canvas');
      canvas.width = outputSide;
      canvas.height = outputSide;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('crop_failed'));
        return;
      }
      ctx.drawImage(img, sx, sy, side, side, 0, 0, outputSide, outputSide);
      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(function (blob) {
        if (!blob) {
          reject(new Error('crop_failed'));
          return;
        }
        const cropped = new File([blob], file.name || 'avatar.jpg', {
          type: mimeType,
          lastModified: Date.now(),
        });
        resolve(cropped);
      }, mimeType, mimeType === 'image/png' ? undefined : 0.92);
    };
    img.onerror = function () {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('load_failed'));
    };
    img.src = objectUrl;
  });
}

function jurinAvatarDisplaySize(sizeClass) {
  const classes = String(sizeClass || '').split(/\s+/);
  for (let i = 0; i < classes.length; i += 1) {
    const size = JURIN_AVATAR_DISPLAY_SIZES[classes[i]];
    if (size) return size;
  }
  return null;
}

function jurinAvatarIsPreviewable(sizeClass) {
  const value = String(sizeClass || '');
  return value.indexOf('community-author-avatar') >= 0 || value.indexOf('inquiry-author-avatar') >= 0;
}

function jurinGoogleUrlCurrentSize(url) {
  const value = String(url || '');
  const sized = value.match(/=s(\d+)-c/) || value.match(/=s(\d+)/) || value.match(/[?&]sz=(\d+)/);
  return sized ? parseInt(sized[1], 10) : 0;
}

function jurinGoogleTargetSize(displaySizePx, options) {
  const opts = options || {};
  if (!displaySizePx) return JURIN_AVATAR_PREVIEW_ORIGINAL;
  const scaled = Math.ceil(displaySizePx * 4);
  if (opts.inlineAuthor) {
    return Math.max(384, Math.min(1024, scaled));
  }
  return Math.max(96, Math.min(1024, scaled));
}

function jurinAvatarSourceSize(displaySize, previewable) {
  if (!displaySize) return null;
  if (previewable) return jurinGoogleTargetSize(displaySize, { inlineAuthor: true });
  return displaySize;
}

function jurinEnhanceExternalAvatarUrl(url, displaySizePx, options) {
  const value = String(url || '').trim();
  if (!/^https?:\/\//i.test(value)) return value;
  const lowered = value.toLowerCase();
  if (lowered.indexOf('googleusercontent.com') < 0 && lowered.indexOf('ggpht.com') < 0) {
    return value;
  }

  const targetSize = jurinGoogleTargetSize(displaySizePx, options);
  if (targetSize === JURIN_AVATAR_PREVIEW_ORIGINAL) {
    if (/=s\d+-c/.test(value)) return value.replace(/=s\d+-c/, '=s0-c');
    if (/=s\d+/.test(value)) return value.replace(/=s\d+/, '=s0');
    if (/[?&]sz=\d+/.test(value)) return value.replace(/([?&])sz=\d+/, '$1sz=0');
    return value + '=s0-c';
  }

  const currentSize = jurinGoogleUrlCurrentSize(value);
  if (currentSize >= targetSize) return value;

  if (/=s\d+-c/.test(value)) return value.replace(/=s\d+-c/, '=s' + targetSize + '-c');
  if (/=s\d+/.test(value)) return value.replace(/=s\d+/, '=s' + targetSize);
  if (/[?&]sz=\d+/.test(value)) return value.replace(/([?&])sz=\d+/, '$1sz=' + targetSize);
  return value + '=s' + targetSize + '-c';
}

function jurinAvatarFullApiUrl(url) {
  let value = String(url || '').trim();
  if (!value) return value;
  value = value
    .replace(/([?&])size=thumb(&)?/g, function (_match, sep, hasNext) {
      return hasNext ? sep : '';
    })
    .replace(/[?&]$/, '');
  return value;
}

function jurinAvatarInlineApiUrl(url) {
  let value = String(url || '').trim();
  if (!value || value.indexOf('/api/users/') < 0) return value;
  if (value.indexOf('size=thumb') >= 0) return value;
  return value + (value.indexOf('?') >= 0 ? '&' : '?') + 'size=thumb';
}

function jurinAvatarPreviewSrc(avatarUrl) {
  const resolved = jurinResolveAvatarUrl(avatarUrl);
  if (/^https?:\/\//i.test(resolved)) {
    return jurinEnhanceExternalAvatarUrl(resolved, JURIN_AVATAR_PREVIEW_ORIGINAL);
  }
  let src = jurinAvatarFullApiUrl(resolved);
  if (src.charAt(0) === '/' && typeof jurinApiBase === 'function') {
    src = jurinApiBase() + src;
  }
  return src;
}

function jurinResolveAvatarUrl(avatarUrl) {
  const custom = (avatarUrl || '').trim();
  return custom || JURIN_DEFAULT_AVATAR;
}

function jurinAvatarSrc(avatarUrl, displaySizePx, options) {
  const resolved = jurinResolveAvatarUrl(avatarUrl);
  if (/^https?:\/\//i.test(resolved)) {
    return jurinEnhanceExternalAvatarUrl(resolved, displaySizePx, options);
  }
  let path = resolved;
  if (path.charAt(0) === '/' && path.indexOf('/api/users/') >= 0 && options && options.inlineAuthor) {
    path = jurinAvatarInlineApiUrl(path);
  }
  if (path.charAt(0) === '/' && typeof jurinApiBase === 'function') {
    return jurinApiBase() + path;
  }
  return path;
}

function jurinAvatarAbsoluteUrl(path) {
  let value = String(path || '').trim();
  if (!value) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.charAt(0) === '/' && typeof jurinApiBase === 'function') {
    return jurinApiBase() + value;
  }
  return value;
}

function jurinAvatarSrcsetAttrs(avatarUrl, displaySize, previewable) {
  if (!previewable || !displaySize) return '';
  const resolved = jurinResolveAvatarUrl(avatarUrl);

  if (/^https?:\/\//i.test(resolved)) {
    const opts = { inlineAuthor: true };
    const src1x = jurinEnhanceExternalAvatarUrl(resolved, displaySize, opts);
    const src2x = jurinEnhanceExternalAvatarUrl(resolved, displaySize * 2, opts);
    const src3x = jurinEnhanceExternalAvatarUrl(resolved, displaySize * 3, opts);
    if (src1x === src2x && src2x === src3x) return '';
    return (
      ' srcset="' + escapeHtml(src1x) + ' 1x, ' + escapeHtml(src2x) + ' 2x, ' + escapeHtml(src3x) + ' 3x"' +
      ' sizes="' + displaySize + 'px"'
    );
  }

  if (resolved.indexOf('/api/users/') < 0) return '';
  const thumb = jurinAvatarAbsoluteUrl(jurinAvatarInlineApiUrl(resolved));
  const full = jurinAvatarAbsoluteUrl(jurinAvatarFullApiUrl(resolved));
  if (!thumb || thumb === full) return '';
  return (
    ' srcset="' + escapeHtml(thumb) + ' 1x, ' + escapeHtml(full) + ' 2x"' +
    ' sizes="' + displaySize + 'px"'
  );
}

function jurinAvatarImgAttrs(avatarUrl, displayName, sizeClass) {
  const displaySize = jurinAvatarDisplaySize(sizeClass);
  const previewable = jurinAvatarIsPreviewable(sizeClass);
  const sourceSize = jurinAvatarSourceSize(displaySize, previewable);
  const srcOptions = previewable ? { inlineAuthor: true } : null;
  const src = jurinAvatarSrc(avatarUrl, sourceSize || displaySize, srcOptions);
  const alt = (displayName || '사용자').trim() + ' 프로필';
  const cls = ['jurin-user-avatar'];
  if (sizeClass) cls.push(sizeClass);
  if (previewable) cls.push('jurin-avatar-preview-trigger');
  return {
    className: cls.join(' '),
    src: src,
    avatarUrl: avatarUrl,
    alt: alt,
    width: previewable ? null : displaySize,
    height: previewable ? null : displaySize,
    displaySize: displaySize,
    previewable: previewable,
    previewSrc: previewable ? jurinAvatarPreviewSrc(avatarUrl) : '',
    onerror: "if(!this.dataset.avatarFallback){this.dataset.avatarFallback='1';var f=this.getAttribute('data-avatar-full-src');if(f){this.src=f;return;}}this.onerror=null;this.src='" + JURIN_DEFAULT_AVATAR + "';",
  };
}

function jurinAvatarSizeAttrs(attrs) {
  if (!attrs.width || !attrs.height) return '';
  return ' width="' + attrs.width + '" height="' + attrs.height + '"';
}

function jurinAvatarDecodingAttr(attrs) {
  return attrs.previewable ? ' decoding="sync"' : ' decoding="async"';
}

function jurinAvatarFullSrcAttr(attrs) {
  if (!attrs.previewable || !attrs.avatarUrl) return '';
  const resolved = jurinResolveAvatarUrl(attrs.avatarUrl);
  if (resolved.indexOf('/api/users/') < 0) return '';
  const full = jurinAvatarAbsoluteUrl(jurinAvatarFullApiUrl(resolved));
  if (!full) return '';
  return ' data-avatar-full-src="' + escapeHtml(full) + '"';
}

function jurinAvatarPreviewAttrs(attrs) {
  if (!attrs.previewable) return '';
  return (
    ' data-avatar-preview-src="' + escapeHtml(attrs.previewSrc) + '"' +
    jurinAvatarFullSrcAttr(attrs) +
    ' role="button" tabindex="0"' +
    ' title="프로필 사진 크게 보기"' +
    ' aria-label="' + escapeHtml(attrs.alt + ' 크게 보기') + '"'
  );
}

function jurinAvatarHtml(options) {
  const opts = options || {};
  const attrs = jurinAvatarImgAttrs(opts.avatarUrl, opts.displayName, opts.sizeClass);
  return (
    '<img class="' + attrs.className + '"' +
    ' src="' + attrs.src + '"' +
    ' alt="' + escapeHtml(attrs.alt) + '"' +
    jurinAvatarSizeAttrs(attrs) +
    jurinAvatarSrcsetAttrs(attrs.avatarUrl, attrs.displaySize, attrs.previewable) +
    jurinAvatarPreviewAttrs(attrs) +
    ' loading="lazy"' +
    jurinAvatarDecodingAttr(attrs) +
    ' onerror="' + attrs.onerror + '"' +
    '>'
  );
}

function jurinApplyAvatarToElement(el, avatarUrl, displayName) {
  if (!el) return;
  const alt = ((displayName || '사용자').trim()) + ' 프로필';
  const displaySize = jurinAvatarDisplaySize(el.className);
  if (el.tagName === 'IMG') {
    el.src = jurinAvatarSrc(avatarUrl, displaySize);
    el.alt = alt;
    if (displaySize) {
      el.width = displaySize;
      el.height = displaySize;
    } else {
      el.removeAttribute('width');
      el.removeAttribute('height');
    }
    el.onerror = function () {
      this.onerror = null;
      this.src = JURIN_DEFAULT_AVATAR;
    };
    return;
  }
  el.innerHTML = jurinAvatarHtml({
    avatarUrl: avatarUrl,
    displayName: displayName,
    sizeClass: el.className.contains && el.classList.contains('nav-user-avatar') ? 'nav-user-avatar' : '',
  });
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ensureJurinAvatarPreviewModal() {
  if (document.getElementById('jurinAvatarPreviewModal')) return;
  document.body.insertAdjacentHTML('beforeend',
    '<div class="jurin-avatar-preview-modal" id="jurinAvatarPreviewModal" aria-hidden="true">' +
      '<div class="jurin-avatar-preview-backdrop" data-avatar-preview-close="1"></div>' +
      '<div class="jurin-avatar-preview-panel" role="dialog" aria-modal="true" aria-label="프로필 사진 미리보기">' +
        '<button type="button" class="jurin-avatar-preview-close" data-avatar-preview-close="1" aria-label="닫기">×</button>' +
        '<img class="jurin-avatar-preview-image" src="" alt="">' +
        '<p class="jurin-avatar-preview-caption"></p>' +
      '</div>' +
    '</div>');
}

function openJurinAvatarPreview(src, alt) {
  const previewSrc = String(src || '').trim();
  if (!previewSrc) return;
  ensureJurinAvatarPreviewModal();
  const modal = document.getElementById('jurinAvatarPreviewModal');
  const img = modal.querySelector('.jurin-avatar-preview-image');
  const caption = modal.querySelector('.jurin-avatar-preview-caption');
  if (!img) return;
  img.removeAttribute('src');
  img.alt = alt || '프로필 사진';
  img.decoding = 'sync';
  img.src = previewSrc;
  if (caption) {
    caption.textContent = String(alt || '').replace(/ 프로필$/, '').trim();
  }
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeJurinAvatarPreview() {
  const modal = document.getElementById('jurinAvatarPreviewModal');
  if (!modal || !modal.classList.contains('is-open')) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  const img = modal.querySelector('.jurin-avatar-preview-image');
  if (img) img.removeAttribute('src');
  document.body.style.overflow = '';
}

function bindJurinAvatarPreviewInteractions() {
  if (window.__jurinAvatarPreviewBound) return;
  window.__jurinAvatarPreviewBound = true;

  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-avatar-preview-close="1"]')) {
      closeJurinAvatarPreview();
      return;
    }
    const trigger = event.target.closest('.jurin-avatar-preview-trigger');
    if (!trigger) return;
    event.preventDefault();
    event.stopPropagation();
    const src = trigger.getAttribute('data-avatar-preview-src') || trigger.currentSrc || trigger.src;
    openJurinAvatarPreview(src, trigger.alt);
  });

  document.addEventListener('keydown', function (event) {
    const modal = document.getElementById('jurinAvatarPreviewModal');
    if (modal && modal.classList.contains('is-open') && event.key === 'Escape') {
      closeJurinAvatarPreview();
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const trigger = event.target.closest('.jurin-avatar-preview-trigger');
    if (!trigger) return;
    event.preventDefault();
    const src = trigger.getAttribute('data-avatar-preview-src') || trigger.src;
    openJurinAvatarPreview(src, trigger.alt);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindJurinAvatarPreviewInteractions);
} else {
  bindJurinAvatarPreviewInteractions();
}

window.JURIN_DEFAULT_AVATAR = JURIN_DEFAULT_AVATAR;
window.jurinDefaultAvatarUrl = jurinDefaultAvatarUrl;
window.jurinCropAvatarFileToSquare = jurinCropAvatarFileToSquare;
window.jurinResolveAvatarUrl = jurinResolveAvatarUrl;
window.jurinAvatarSrc = jurinAvatarSrc;
window.jurinAvatarHtml = jurinAvatarHtml;
window.jurinApplyAvatarToElement = jurinApplyAvatarToElement;
window.openJurinAvatarPreview = openJurinAvatarPreview;
window.closeJurinAvatarPreview = closeJurinAvatarPreview;
