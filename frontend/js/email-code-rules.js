/**
 * 이메일 인증코드 형식 (회원가입, 백엔드 email_verification 과 동일 길이·메시지 구분)
 */
(function (root) {
  var CODE_LENGTH = 6;
  var MSG_EMPTY = '인증코드를 입력해주세요.';
  var MSG_INCOMPLETE = '인증코드 6자리를 다시 입력해주세요.';
  var MSG_WRONG = '인증코드가 올바르지 않습니다.';

  function validateEmailCode(code) {
    var c = String(code == null ? '' : code).trim();
    if (!c) {
      return { ok: false, message: MSG_EMPTY, kind: 'empty' };
    }
    if (!/^\d+$/.test(c) || c.length !== CODE_LENGTH) {
      return { ok: false, message: MSG_INCOMPLETE, kind: 'incomplete' };
    }
    return { ok: true, message: '', kind: 'ok' };
  }

  function isEmailCodeWrongMessage(msg) {
    var s = String(msg || '');
    return s.indexOf('올바르지 않') >= 0;
  }

  root.jurinEmailCodeLength = CODE_LENGTH;
  root.jurinEmailCodeMsgEmpty = MSG_EMPTY;
  root.jurinEmailCodeMsgIncomplete = MSG_INCOMPLETE;
  root.jurinEmailCodeMsgWrong = MSG_WRONG;
  root.jurinValidateEmailCode = validateEmailCode;
  root.jurinIsEmailCodeWrongMessage = isEmailCodeWrongMessage;
})(typeof window !== 'undefined' ? window : globalThis);
