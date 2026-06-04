/**
 * 닉네임 규칙 (백엔드 auth_api._validate_nickname 과 동일)
 * - 2~8자
 * - 한글 완성형, 영문, 숫자만
 * - 글자 사이 공백만 금지 (끝 공백은 입력 중 허용, 저장 시 trim)
 * - 특수문자·자음/모음 단독 금지
 * - 같은 문자 3회 이상 연속 금지 (예: bbb)
 */
(function (root) {
  var MIN_LENGTH = 2;
  var MAX_LENGTH = 8;
  var JAMO_RE = /[\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/;
  var ALLOWED_RE = /^[가-힣A-Za-z0-9]+$/;
  var INTERNAL_SPACE_RE = /\S\s+\S/;
  var CONSECUTIVE_SAME_CHAR_RE = /(.)\1{2,}/;

  function normalizeNickname(nickname) {
    return String(nickname == null ? '' : nickname).trim();
  }

  function validateNickname(nickname) {
    var n = String(nickname == null ? '' : nickname);
    var core = normalizeNickname(n);
    if (!core) {
      return { ok: false, message: '닉네임을 입력해주세요.' };
    }
    if (INTERNAL_SPACE_RE.test(n)) {
      return { ok: false, message: '닉네임에는 공백을 사용할 수 없습니다.' };
    }
    if (JAMO_RE.test(core)) {
      return { ok: false, message: '닉네임에는 한글 자음·모음만 단독으로 입력할 수 없습니다.' };
    }
    if (core.length < MIN_LENGTH) {
      return { ok: false, message: '닉네임은 2자 이상 입력해주세요.' };
    }
    if (core.length > MAX_LENGTH) {
      return { ok: false, message: '닉네임은 8자 이하로 입력해주세요.' };
    }
    if (!ALLOWED_RE.test(core)) {
      return { ok: false, message: '닉네임은 한글(완성형), 영문, 숫자만 사용할 수 있습니다.' };
    }
    if (CONSECUTIVE_SAME_CHAR_RE.test(core)) {
      return { ok: false, message: '닉네임에 같은 문자를 3번 이상 연속으로 사용할 수 없습니다.' };
    }
    return { ok: true, message: '' };
  }

  root.jurinValidateNickname = validateNickname;
  root.jurinNormalizeNickname = normalizeNickname;
  root.jurinNicknameMinLength = MIN_LENGTH;
  root.jurinNicknameMaxLength = MAX_LENGTH;
})(typeof window !== 'undefined' ? window : globalThis);
