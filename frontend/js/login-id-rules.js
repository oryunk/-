/**
 * 로그인 아이디 규칙 (백엔드 auth_api._validate_login_id 와 동일)
 * - 6~12자
 * - 영문 대·소문자·숫자만
 * - 글자 사이 공백만 금지 (끝 공백은 입력 중 허용, 저장 시 trim)
 */
(function (root) {
  var MIN_LENGTH = 6;
  var MAX_LENGTH = 12;
  var LOGIN_ID_RE = /^[A-Za-z0-9]{6,12}$/;
  var INTERNAL_SPACE_RE = /\S\s+\S/;

  function validateLoginId(loginId) {
    var raw = String(loginId == null ? '' : loginId);
    if (!raw.trim()) {
      return { ok: false, message: '아이디를 입력해주세요.' };
    }
    if (INTERNAL_SPACE_RE.test(raw)) {
      return { ok: false, message: '아이디에는 공백을 사용할 수 없습니다.' };
    }
    if (!LOGIN_ID_RE.test(raw.trim())) {
      return { ok: false, message: '아이디는 영문·숫자 6~12자로 입력해주세요.' };
    }
    return { ok: true, message: '' };
  }

  function normalizeLoginId(loginId) {
    return String(loginId == null ? '' : loginId).trim();
  }

  root.jurinValidateLoginId = validateLoginId;
  root.jurinNormalizeLoginId = normalizeLoginId;
  root.jurinLoginIdMinLength = MIN_LENGTH;
  root.jurinLoginIdMaxLength = MAX_LENGTH;
})(typeof window !== 'undefined' ? window : globalThis);
