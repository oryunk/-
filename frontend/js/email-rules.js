/**
 * 이메일 형식 검사 (회원가입·아이디/비밀번호 찾기, 백엔드 auth_api._validate_email 과 동일)
 */
(function (root) {
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function validateEmail(email) {
    var e = String(email || '').trim();
    if (!e) {
      return { ok: false, message: '이메일을 입력해주세요.' };
    }
    var at = e.indexOf('@');
    if (at < 0) {
      return { ok: false, message: '올바른 이메일 형식이 아닙니다.' };
    }
    var local = e.slice(0, at);
    var domain = e.slice(at + 1);
    if (!local) {
      return { ok: false, message: '이메일 @ 앞에 아이디를 입력해주세요.' };
    }
    if (!domain) {
      return { ok: false, message: '@ 뒤에 메일 주소를 입력해주세요.' };
    }
    if (e.indexOf('@', at + 1) >= 0) {
      return { ok: false, message: '올바른 이메일 형식이 아닙니다.' };
    }
    if (!EMAIL_RE.test(e)) {
      return { ok: false, message: '올바른 이메일 형식이 아닙니다.' };
    }
    return { ok: true, message: '' };
  }

  root.jurinValidateEmail = validateEmail;
})(typeof window !== 'undefined' ? window : globalThis);
