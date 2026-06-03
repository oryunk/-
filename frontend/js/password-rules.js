/**
 * 회원가입·비밀번호 재설정 공통 비밀번호 규칙 (백엔드 auth_api._validate_password 와 동일)
 * - 8자 이상
 * - 영문자(A–Z, a–z) 1자 이상 포함
 * - 글자 사이 공백만 금지 (끝 공백은 입력 중 허용, 저장·로그인 시 trim)
 * - 특수문자(영문·숫자 외)는 최대 1개
 */
(function (root) {
  var MIN_LENGTH = 8;
  var MAX_SPECIAL = 1;
  var HAS_LETTER = /[A-Za-z]/;
  var INTERNAL_SPACE_RE = /\S\s+\S/;
  var SPECIAL_CHAR_RE = /[^A-Za-z0-9]/g;

  function normalizePassword(password) {
    return String(password == null ? '' : password).trim();
  }

  function countSpecialChars(core) {
    var matches = String(core).match(SPECIAL_CHAR_RE);
    return matches ? matches.length : 0;
  }

  function validatePassword(password) {
    var raw = String(password == null ? '' : password);
    var core = normalizePassword(raw);
    if (!core) {
      return { ok: false, message: '비밀번호를 입력해주세요.' };
    }
    if (INTERNAL_SPACE_RE.test(raw)) {
      return { ok: false, message: '비밀번호에는 공백을 사용할 수 없습니다.' };
    }
    if (core.length < MIN_LENGTH) {
      return { ok: false, message: '비밀번호는 영문자를 포함해 8자 이상 입력해주세요.' };
    }
    if (!HAS_LETTER.test(core)) {
      return { ok: false, message: '비밀번호에 영문자를 포함해주세요.' };
    }
    if (countSpecialChars(core) > MAX_SPECIAL) {
      return { ok: false, message: '비밀번호에 특수문자는 2개 이상 사용할 수 없습니다.' };
    }
    return { ok: true, message: '' };
  }

  root.jurinValidatePassword = validatePassword;
  root.jurinNormalizePassword = normalizePassword;
})(typeof window !== 'undefined' ? window : globalThis);
