"""인증 API 블루프린트 (/api/auth/*).

- 로컬 로그인·회원가입·세션
- Google Sign-In: google_auth (사용자 OAuth)
- KIS /oauth2/tokenP 는 app.py 서버 API 토큰 — 사용자 로그인과 무관
"""

from flask import Blueprint, request, jsonify, session
import re
import time
import pymysql
import pymysql.err
import bcrypt
from auth_login_id import (
    GOOGLE_ACCOUNT_FIND_ID_HELP,
    GOOGLE_ACCOUNT_HELP,
    find_user_by_login_identifier,
    is_google_only_account,
)
from runtime_config import load_env_files, mysql_config
from email_verification import (
    check_email_code,
    issue_and_send_code,
    is_missing_table_error,
    verify_email_code,
)

load_env_files()

auth_bp = Blueprint("auth", __name__)

LOGIN_ID_MIN = 6
LOGIN_ID_MAX = 12
LOGIN_ID_DUPLICATE_MSG = "이미 사용 중인 아이디입니다."
_LOGIN_ID_RE = re.compile(r"^[A-Za-z0-9]{6,12}$")
EMAIL_MAX = 100
NICKNAME_MIN = 2
NICKNAME_MAX = 8
NICKNAME_DUPLICATE_MSG = "중복된 닉네임입니다."
_JAMO_RE = re.compile(r"[\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]")
_NICKNAME_ALLOWED_RE = re.compile(r"^[가-힣A-Za-z0-9]+$")
_NICKNAME_INTERNAL_SPACE_RE = re.compile(r"\S\s+\S")
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_SPECIAL = 1
_PASSWORD_HAS_LETTER = re.compile(r"[A-Za-z]")
_PASSWORD_SPECIAL_RE = re.compile(r"[^A-Za-z0-9]")
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
_CONSECUTIVE_SAME_CHAR_RE = re.compile(r"(.)\1{2,}")

PROFILE_EDIT_TTL_SECONDS = 900


def get_connection():
    base = mysql_config()
    db_config = {
        "host": base["host"],
        "port": base["port"],
        "user": base["user"],
        "password": base["password"],
        "database": base["database"],
        "charset":  "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
        "init_command": "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
    }
    return pymysql.connect(**db_config)


def _db_error_message(exc: Exception) -> str:
    if isinstance(exc, pymysql.err.ProgrammingError) and exc.args:
        code = exc.args[0]
        if code == 1054:
            return (
                "DB에 필요한 컬럼이 없습니다(오류 1054). "
                "SQL/update.sql, SQL/add_google_oauth.sql 적용 여부를 확인하세요."
            )
    if isinstance(exc, pymysql.err.OperationalError) and exc.args:
        code = exc.args[0]
        if code == 1045:
            return (
                "MySQL 접속이 거절되었습니다(오류 1045). backend/.env의 MYSQL_PASSWORD가 "
                "MySQL 계정 비밀번호와 정확히 같은지 확인하세요."
            )
        if code == 1049:
            return "데이터베이스가 없습니다(오류 1049). SQL/schema.sql로 stock_db를 만든 뒤 다시 시도하세요."
        if code == 2003:
            return "MySQL 서버에 연결할 수 없습니다. 서비스가 실행 중인지 확인하세요."
    return f"서버 오류: {str(exc)}"


def _login_id_raw_from_body(data):
    if not data:
        return ""
    return data.get("loginId") or data.get("userId") or ""


def _login_id_from_body(data):
    return _normalize_login_id(_login_id_raw_from_body(data))


def _normalize_login_id(login_id: str) -> str:
    return (login_id or "").strip()


def _normalize_email(data):
    return (data.get("email") or "").strip()


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _has_consecutive_same_chars(value: str) -> bool:
    """동일 문자 3회 이상 연속(예: bbb) 여부."""
    return bool(_CONSECUTIVE_SAME_CHAR_RE.search(value or ""))


def _validate_email(email: str) -> str | None:
    """유효하면 None, 아니면 사용자용 오류 메시지."""
    e = (email or "").strip()
    if not e:
        return "이메일을 입력해주세요."
    if "@" not in e:
        return "올바른 이메일 형식이 아닙니다."
    local, sep, domain = e.partition("@")
    if sep and "@" in domain:
        return "올바른 이메일 형식이 아닙니다."
    if not local:
        return "이메일 @ 앞에 아이디를 입력해주세요."
    if not domain:
        return "@ 뒤에 메일 주소를 입력해주세요."
    if not _EMAIL_RE.match(e):
        return "올바른 이메일 형식이 아닙니다."
    return None


def _validate_login_id(login_id: str) -> str | None:
    raw = login_id or ""
    if not raw.strip():
        return "아이디를 입력해주세요."
    if _NICKNAME_INTERNAL_SPACE_RE.search(raw):
        return "아이디에는 공백을 사용할 수 없습니다."
    lid = raw.strip()
    if not _LOGIN_ID_RE.match(lid):
        return "아이디는 영문·숫자 6~12자로 입력해주세요."
    if _has_consecutive_same_chars(lid):
        return "아이디에 같은 문자를 3번 이상 연속으로 사용할 수 없습니다."
    return None


def _parse_exclude_user_id(data) -> int | None:
    if not data:
        return None
    raw = data.get("excludeUserId")
    if raw is None or raw == "":
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _login_id_exists(cursor, login_id: str, exclude_user_id: int | None = None) -> bool:
    if exclude_user_id is not None:
        cursor.execute(
            "SELECT user_id FROM users WHERE login_id = %s AND user_id != %s LIMIT 1",
            (login_id, exclude_user_id),
        )
    else:
        cursor.execute(
            "SELECT user_id FROM users WHERE login_id = %s LIMIT 1",
            (login_id,),
        )
    return cursor.fetchone() is not None


def _normalize_password(password: str) -> str:
    return (password or "").strip()


def _validate_password(password: str) -> str | None:
    """유효하면 None, 아니면 사용자용 오류 메시지."""
    raw = password or ""
    core = _normalize_password(raw)
    if not core:
        return "비밀번호를 입력해주세요."
    if _NICKNAME_INTERNAL_SPACE_RE.search(raw):
        return "비밀번호에는 공백을 사용할 수 없습니다."
    if len(core) < PASSWORD_MIN_LENGTH:
        return "비밀번호는 영문자를 포함해 8자 이상 입력해주세요."
    if not _PASSWORD_HAS_LETTER.search(core):
        return "비밀번호에 영문자를 포함해주세요."
    if len(_PASSWORD_SPECIAL_RE.findall(core)) > PASSWORD_MAX_SPECIAL:
        return "비밀번호에 특수문자는 2개 이상 사용할 수 없습니다."
    if _has_consecutive_same_chars(core):
        return "비밀번호에 같은 문자를 3번 이상 연속으로 사용할 수 없습니다."
    return None


def _normalize_nickname(nickname: str) -> str:
    return (nickname or "").strip()


def _validate_nickname(nickname: str) -> str | None:
    """유효하면 None, 아니면 사용자용 오류 메시지.

    글자 사이 공백(예: 헤 헤)만 금지. 끝 공백(예: 헤헤 )은 허용하며 저장 시 strip.
    """
    n = nickname or ""
    core = _normalize_nickname(n)
    if not core:
        return "닉네임을 입력해주세요."
    if _NICKNAME_INTERNAL_SPACE_RE.search(n):
        return "닉네임에는 공백을 사용할 수 없습니다."
    if _JAMO_RE.search(core):
        return "닉네임에는 한글 자음·모음만 단독으로 입력할 수 없습니다."
    if len(core) < NICKNAME_MIN:
        return "닉네임은 2자 이상 입력해주세요."
    if len(core) > NICKNAME_MAX:
        return "닉네임은 8자 이하로 입력해주세요."
    if not _NICKNAME_ALLOWED_RE.match(core):
        return "닉네임은 한글(완성형), 영문, 숫자만 사용할 수 있습니다."
    if _has_consecutive_same_chars(core):
        return "닉네임에 같은 문자를 3번 이상 연속으로 사용할 수 없습니다."
    return None


def _nickname_exists(cursor, nickname: str, exclude_user_id: int | None = None) -> bool:
    if exclude_user_id is not None:
        cursor.execute(
            "SELECT user_id FROM users WHERE nickname = %s AND user_id != %s LIMIT 1",
            (nickname, exclude_user_id),
        )
    else:
        cursor.execute(
            "SELECT user_id FROM users WHERE nickname = %s LIMIT 1",
            (nickname,),
        )
    return cursor.fetchone() is not None


def _require_session_user_id():
    uid = session.get("user_id")
    if uid is None:
        return None
    return int(uid)


def _is_profile_edit_verified() -> bool:
    until = session.get("profile_edit_verified_until")
    if until is None:
        return False
    try:
        return float(until) > time.time()
    except (TypeError, ValueError):
        return False


def _set_profile_edit_verified() -> None:
    session["profile_edit_verified_until"] = time.time() + PROFILE_EDIT_TTL_SECONDS


def _user_response_dict(user: dict) -> dict:
    provider = (user.get("auth_provider") or "local").strip().lower()
    has_password = bool(user.get("password_hash"))
    return {
        "userId": user["user_id"],
        "email": user["email"],
        "loginId": user["login_id"],
        "nickname": user.get("nickname") or "",
        "authProvider": provider,
        "canChangePassword": has_password and provider != "google",
    }


def _fetch_user_by_id(cursor, user_id: int):
    cursor.execute(
        """
        SELECT user_id, email, login_id, nickname, auth_provider, password_hash
        FROM users WHERE user_id = %s
        """,
        (user_id,),
    )
    return cursor.fetchone()


@auth_bp.route("/api/auth/check-login-id", methods=["POST"])
def check_login_id():
    data = request.get_json(silent=True) or {}
    login_id_raw = _login_id_raw_from_body(data)

    id_err = _validate_login_id(login_id_raw)
    if id_err:
        return jsonify({
            "success": False,
            "available": False,
            "message": id_err,
        }), 400

    login_id = _normalize_login_id(login_id_raw)
    exclude_user_id = _parse_exclude_user_id(data)

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            if _login_id_exists(cursor, login_id, exclude_user_id):
                return jsonify({
                    "success": False,
                    "available": False,
                    "message": LOGIN_ID_DUPLICATE_MSG,
                }), 200
        return jsonify({"success": True, "available": True}), 200
    except Exception as e:
        return jsonify({"success": False, "available": False, "message": _db_error_message(e)}), 500
    finally:
        if conn:
            conn.close()


@auth_bp.route("/api/auth/check-nickname", methods=["POST"])
def check_nickname():
    data = request.get_json(silent=True) or {}
    nickname = data.get("nickname") or ""

    nick_err = _validate_nickname(nickname)
    if nick_err:
        return jsonify({
            "success": False,
            "available": False,
            "message": nick_err,
        }), 400

    nickname = _normalize_nickname(nickname)
    exclude_user_id = _parse_exclude_user_id(data)

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            if _nickname_exists(cursor, nickname, exclude_user_id):
                return jsonify({
                    "success": False,
                    "available": False,
                    "message": NICKNAME_DUPLICATE_MSG,
                }), 200
        return jsonify({"success": True, "available": True}), 200
    except Exception as e:
        return jsonify({"success": False, "available": False, "message": _db_error_message(e)}), 500
    finally:
        if conn:
            conn.close()


@auth_bp.route("/api/auth/send-email-code", methods=["POST"])
def send_email_code():
    data = request.get_json(silent=True) or {}
    email = _normalize_email(data)

    email_err = _validate_email(email)
    if email_err:
        return jsonify({"success": False, "message": email_err}), 400

    conn = None
    try:
        conn = get_connection()
        err = issue_and_send_code(conn, email)
        if err:
            return jsonify({"success": False, "message": err}), 400
        return jsonify({
            "success": True,
            "message": "인증코드를 이메일로 발송했습니다.",
        })
    except Exception as e:
        if is_missing_table_error(e):
            return jsonify({
                "success": False,
                "message": "email_verification_codes 테이블이 없습니다. SQL/add_email_verification.sql을 적용하세요.",
            }), 500
        return jsonify({"success": False, "message": _db_error_message(e)}), 500
    finally:
        if conn:
            conn.close()


@auth_bp.route("/api/auth/check-email-code", methods=["POST"])
def check_email_code_route():
    """가입 전 인증코드 일치 여부만 확인 (DB 행은 삭제하지 않음)."""
    data = request.get_json(silent=True) or {}
    email = _normalize_email(data)
    email_code = (data.get("emailCode") or data.get("verificationCode") or "").strip()

    email_err = _validate_email(email)
    if email_err:
        return jsonify({"success": False, "message": email_err, "field": "email"}), 400

    conn = None
    try:
        conn = get_connection()
        code_err = check_email_code(conn, email, email_code)
        if code_err:
            return jsonify({
                "success": False,
                "message": code_err,
                "field": "emailCode",
            }), 400
        return jsonify({"success": True, "message": "인증코드가 확인되었습니다."}), 200
    except Exception as e:
        if is_missing_table_error(e):
            return jsonify({
                "success": False,
                "message": "email_verification_codes 테이블이 없습니다. SQL/add_email_verification.sql을 적용하세요.",
                "field": "form",
            }), 500
        return jsonify({
            "success": False,
            "message": _db_error_message(e),
            "field": "form",
        }), 500
    finally:
        if conn:
            conn.close()


@auth_bp.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    login_id_raw = _login_id_raw_from_body(data)
    email = _normalize_email(data)
    password = data.get("password", "")
    password_confirm = data.get("passwordConfirm", "")
    nickname = data.get("nickname") or ""
    email_code = (data.get("emailCode") or data.get("verificationCode") or "").strip()

    if not nickname or not login_id_raw.strip() or not email or not password or not password_confirm:
        return jsonify({"success": False, "message": "모든 항목을 입력해주세요."}), 400

    if not email_code:
        return jsonify({
            "success": False,
            "message": "인증코드를 입력해주세요.",
            "field": "emailCode",
        }), 400

    nick_err = _validate_nickname(nickname)
    if nick_err:
        return jsonify({"success": False, "message": nick_err}), 400

    nickname = _normalize_nickname(nickname)

    id_err = _validate_login_id(login_id_raw)
    if id_err:
        return jsonify({"success": False, "message": id_err}), 400

    login_id = _normalize_login_id(login_id_raw)

    if len(email) > EMAIL_MAX:
        return jsonify({"success": False, "message": f"이메일은 {EMAIL_MAX}자 이하로 입력해주세요."}), 400

    email_err = _validate_email(email)
    if email_err:
        return jsonify({"success": False, "message": email_err}), 400

    pw_err = _validate_password(password)
    if pw_err:
        return jsonify({"success": False, "message": pw_err}), 400

    password = _normalize_password(password)
    password_confirm = _normalize_password(password_confirm)

    if password != password_confirm:
        return jsonify({"success": False, "message": "비밀번호가 일치하지 않습니다."}), 400

    conn = None
    try:
        conn = get_connection()
        code_err = verify_email_code(conn, email, email_code)
        if code_err:
            return jsonify({
                "success": False,
                "message": code_err,
                "field": "emailCode",
            }), 400

        with conn.cursor() as cursor:
            sql_check = """
                SELECT user_id
                FROM users
                WHERE email = %s OR login_id = %s
            """
            cursor.execute(sql_check, (email, login_id))
            if cursor.fetchone():
                return jsonify({"success": False, "message": "이미 존재하는 아이디 또는 이메일입니다."}), 409

            if _nickname_exists(cursor, nickname):
                return jsonify({"success": False, "message": NICKNAME_DUPLICATE_MSG}), 409

            password_hash = _hash_password(password)
            sql_insert = """
                INSERT INTO users (
                    login_id, email, password_hash, nickname,
                    auth_provider, created_at, updated_at
                )
                VALUES (%s, %s, %s, %s, 'local', NOW(), NOW())
            """
            cursor.execute(sql_insert, (login_id, email, password_hash, nickname))
            conn.commit()

        return jsonify({
            "success": True,
            "message": "회원가입이 완료되었습니다.",
            "user": {"email": email, "loginId": login_id, "nickname": nickname},
        })

    except pymysql.err.IntegrityError:
        return jsonify({"success": False, "message": "이미 존재하는 아이디 또는 이메일입니다."}), 409
    except Exception as e:
        if is_missing_table_error(e):
            return jsonify({
                "success": False,
                "message": "email_verification_codes 테이블이 없습니다. SQL/add_email_verification.sql을 적용하세요.",
            }), 500
        return jsonify({"success": False, "message": _db_error_message(e)}), 500
    finally:
        if conn:
            conn.close()


@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    login_id_raw = _login_id_raw_from_body(data)
    password = data.get("password", "")

    if not login_id_raw.strip() or not password:
        return jsonify({"success": False, "message": "아이디와 비밀번호를 입력해주세요."}), 400

    id_err = _validate_login_id(login_id_raw)
    if id_err:
        return jsonify({"success": False, "message": id_err}), 400

    pw_err = _validate_password(password)
    if pw_err:
        return jsonify({"success": False, "message": pw_err}), 400

    login_id = _normalize_login_id(login_id_raw)
    password = _normalize_password(password)

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            user = find_user_by_login_identifier(cursor, login_id)

            if not user:
                return jsonify({"success": False, "message": "아이디 또는 비밀번호가 올바르지 않습니다."}), 401

            if not user.get("password_hash"):
                return jsonify({
                    "success": False,
                    "message": "구글 로그인으로 가입한 계정입니다. Google로 로그인하거나 비밀번호를 설정해주세요.",
                }), 401

            stored_hash = user["password_hash"].encode("utf-8")
            if not bcrypt.checkpw(password.encode("utf-8"), stored_hash):
                return jsonify({"success": False, "message": "아이디 또는 비밀번호가 올바르지 않습니다."}), 401

            session.clear()
            session["user_id"] = int(user["user_id"])

            return jsonify({
                "success": True,
                "message": "로그인 성공",
                "user": {
                    "email": user["email"],
                    "loginId": user["login_id"],
                    "nickname": user.get("nickname") or "",
                },
            })

    except Exception as e:
        return jsonify({"success": False, "message": _db_error_message(e)}), 500
    finally:
        if conn:
            conn.close()


@auth_bp.route("/api/auth/me", methods=["GET"])
def me():
    uid = session.get("user_id")
    if uid is None:
        return jsonify({"success": False, "message": "로그인되지 않았습니다."}), 401

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            user = _fetch_user_by_id(cursor, uid)
        if not user:
            session.clear()
            return jsonify({"success": False, "message": "로그인되지 않았습니다."}), 401

        return jsonify({
            "success": True,
            "user": _user_response_dict(user),
        })
    except Exception as e:
        return jsonify({"success": False, "message": _db_error_message(e)}), 500
    finally:
        if conn:
            conn.close()


@auth_bp.route("/api/auth/profile/status", methods=["GET"])
def profile_status():
    uid = _require_session_user_id()
    if uid is None:
        return jsonify({"success": False, "message": "로그인되지 않았습니다."}), 401

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            user = _fetch_user_by_id(cursor, uid)
        if not user:
            session.clear()
            return jsonify({"success": False, "message": "로그인되지 않았습니다."}), 401

        verified = _is_profile_edit_verified()
        until = session.get("profile_edit_verified_until")
        return jsonify({
            "success": True,
            "verified": verified,
            "verifiedUntil": until if verified else None,
            "user": _user_response_dict(user),
        })
    except Exception as e:
        return jsonify({"success": False, "message": _db_error_message(e)}), 500
    finally:
        if conn:
            conn.close()


@auth_bp.route("/api/auth/profile/send-code", methods=["POST"])
def profile_send_code():
    uid = _require_session_user_id()
    if uid is None:
        return jsonify({"success": False, "message": "로그인되지 않았습니다."}), 401

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            user = _fetch_user_by_id(cursor, uid)
        if not user:
            session.clear()
            return jsonify({"success": False, "message": "로그인되지 않았습니다."}), 401

        email = (user.get("email") or "").strip()
        err = issue_and_send_code(conn, email)
        if err:
            return jsonify({"success": False, "message": err}), 400
        return jsonify({
            "success": True,
            "message": "인증코드를 이메일로 발송했습니다.",
        })
    except Exception as e:
        if is_missing_table_error(e):
            return jsonify({
                "success": False,
                "message": "email_verification_codes 테이블이 없습니다. SQL/add_email_verification.sql을 적용하세요.",
            }), 500
        return jsonify({"success": False, "message": _db_error_message(e)}), 500
    finally:
        if conn:
            conn.close()


@auth_bp.route("/api/auth/profile/verify-code", methods=["POST"])
def profile_verify_code():
    uid = _require_session_user_id()
    if uid is None:
        return jsonify({"success": False, "message": "로그인되지 않았습니다."}), 401

    data = request.get_json(silent=True) or {}
    email_code = (data.get("emailCode") or data.get("verificationCode") or "").strip()

    if not email_code:
        return jsonify({
            "success": False,
            "message": "인증코드를 입력해주세요.",
            "field": "emailCode",
        }), 400

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            user = _fetch_user_by_id(cursor, uid)
        if not user:
            session.clear()
            return jsonify({"success": False, "message": "로그인되지 않았습니다."}), 401

        email = (user.get("email") or "").strip()
        code_err = verify_email_code(conn, email, email_code)
        if code_err:
            return jsonify({
                "success": False,
                "message": code_err,
                "field": "emailCode",
            }), 400

        _set_profile_edit_verified()
        return jsonify({
            "success": True,
            "message": "이메일 인증이 완료되었습니다. 프로필을 수정할 수 있습니다.",
        })
    except Exception as e:
        if is_missing_table_error(e):
            return jsonify({
                "success": False,
                "message": "email_verification_codes 테이블이 없습니다. SQL/add_email_verification.sql을 적용하세요.",
                "field": "form",
            }), 500
        return jsonify({
            "success": False,
            "message": _db_error_message(e),
            "field": "form",
        }), 500
    finally:
        if conn:
            conn.close()


@auth_bp.route("/api/auth/profile", methods=["PATCH"])
def profile_update():
    uid = _require_session_user_id()
    if uid is None:
        return jsonify({"success": False, "message": "로그인되지 않았습니다."}), 401

    if not _is_profile_edit_verified():
        return jsonify({
            "success": False,
            "message": "프로필 수정 전에 이메일 인증을 완료해 주세요.",
        }), 403

    data = request.get_json(silent=True) or {}
    login_id_raw = _login_id_raw_from_body(data)
    nickname = data.get("nickname") or ""
    password = data.get("password", "")
    password_confirm = data.get("passwordConfirm", "")

    if not login_id_raw.strip() or not nickname:
        return jsonify({"success": False, "message": "아이디와 닉네임을 입력해주세요."}), 400

    nick_err = _validate_nickname(nickname)
    if nick_err:
        return jsonify({"success": False, "message": nick_err, "field": "nickname"}), 400

    nickname = _normalize_nickname(nickname)

    id_err = _validate_login_id(login_id_raw)
    if id_err:
        return jsonify({"success": False, "message": id_err, "field": "loginId"}), 400

    login_id = _normalize_login_id(login_id_raw)

    password_raw = password or ""
    password_confirm_raw = password_confirm or ""
    password_provided = bool(str(password_raw).strip() or str(password_confirm_raw).strip())

    if password_provided:
        if not str(password_raw).strip() or not str(password_confirm_raw).strip():
            return jsonify({
                "success": False,
                "message": "비밀번호와 비밀번호 확인을 모두 입력해주세요.",
                "field": "password",
            }), 400
        pw_err = _validate_password(password_raw)
        if pw_err:
            return jsonify({"success": False, "message": pw_err, "field": "password"}), 400
        password_norm = _normalize_password(password_raw)
        password_confirm_norm = _normalize_password(password_confirm_raw)
        if password_norm != password_confirm_norm:
            return jsonify({
                "success": False,
                "message": "비밀번호가 일치하지 않습니다.",
                "field": "passwordConfirm",
            }), 400

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            user = _fetch_user_by_id(cursor, uid)
            if not user:
                session.clear()
                return jsonify({"success": False, "message": "로그인되지 않았습니다."}), 401

            is_google_only = is_google_only_account(user)

            if password_provided and is_google_only:
                return jsonify({
                    "success": False,
                    "message": "Google 로그인 계정은 비밀번호를 변경할 수 없습니다.",
                    "field": "password",
                }), 400

            if _login_id_exists(cursor, login_id, uid):
                return jsonify({
                    "success": False,
                    "message": LOGIN_ID_DUPLICATE_MSG,
                    "field": "loginId",
                }), 409

            if _nickname_exists(cursor, nickname, uid):
                return jsonify({
                    "success": False,
                    "message": NICKNAME_DUPLICATE_MSG,
                    "field": "nickname",
                }), 409

            if password_provided:
                password_hash = _hash_password(_normalize_password(password_raw))
                cursor.execute(
                    """
                    UPDATE users
                    SET login_id = %s, nickname = %s, password_hash = %s, updated_at = NOW()
                    WHERE user_id = %s
                    """,
                    (login_id, nickname, password_hash, uid),
                )
            else:
                cursor.execute(
                    """
                    UPDATE users
                    SET login_id = %s, nickname = %s, updated_at = NOW()
                    WHERE user_id = %s
                    """,
                    (login_id, nickname, uid),
                )
            conn.commit()
            updated = _fetch_user_by_id(cursor, uid)

        return jsonify({
            "success": True,
            "message": "프로필이 저장되었습니다.",
            "user": _user_response_dict(updated),
        })
    except pymysql.err.IntegrityError:
        return jsonify({"success": False, "message": "이미 사용 중인 아이디 또는 닉네임입니다."}), 409
    except Exception as e:
        return jsonify({"success": False, "message": _db_error_message(e)}), 500
    finally:
        if conn:
            conn.close()


@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"success": True, "message": "로그아웃 완료"})


@auth_bp.route("/api/auth/find-id", methods=["POST"])
def find_id():
    data = request.get_json(silent=True) or {}
    email = _normalize_email(data)

    if not email:
        return jsonify({"success": False, "message": "이메일을 입력해주세요."}), 400

    email_err = _validate_email(email)
    if email_err:
        return jsonify({"success": False, "message": email_err}), 400

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT user_id, login_id, email, auth_provider, password_hash, google_sub
                FROM users WHERE email = %s LIMIT 1
                """,
                (email,),
            )
            row = cursor.fetchone()

            if not row or not row.get("login_id"):
                return jsonify({"success": False, "message": "해당 이메일로 가입된 아이디가 없습니다."}), 404

            if is_google_only_account(row):
                return jsonify({"success": False, "message": GOOGLE_ACCOUNT_FIND_ID_HELP}), 400

        return jsonify({"success": True, "loginId": row["login_id"]})

    except Exception as e:
        return jsonify({"success": False, "message": _db_error_message(e)}), 500
    finally:
        if conn:
            conn.close()


@auth_bp.route("/api/auth/find-password", methods=["POST"])
def find_password():
    data = request.get_json(silent=True) or {}
    login_id = _login_id_from_body(data)
    email = _normalize_email(data)

    if not login_id or not email:
        return jsonify({"success": False, "message": "아이디와 이메일을 모두 입력해주세요."}), 400

    email_err = _validate_email(email)
    if email_err:
        return jsonify({"success": False, "message": email_err}), 400

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT user_id, login_id, email, auth_provider, password_hash, google_sub
                FROM users WHERE login_id = %s AND email = %s
                """,
                (login_id, email),
            )
            user = cursor.fetchone()

            if not user:
                return jsonify({
                    "success": False,
                    "message": "입력한 아이디와 이메일이 일치하는 계정을 찾을 수 없습니다.",
                }), 404

            if is_google_only_account(user):
                return jsonify({"success": False, "message": GOOGLE_ACCOUNT_HELP}), 400

        return jsonify({
            "success": True,
            "message": "일치하는 계정을 확인했습니다.",
            "loginId": user["login_id"],
            "email": user["email"],
        })

    except Exception as e:
        return jsonify({"success": False, "message": _db_error_message(e)}), 500
    finally:
        if conn:
            conn.close()


@auth_bp.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json(silent=True) or {}
    login_id_raw = _login_id_raw_from_body(data)
    email = _normalize_email(data)
    password = data.get("password", "")
    password_confirm = data.get("passwordConfirm", "")

    if not login_id_raw.strip() or not email or not password or not password_confirm:
        return jsonify({"success": False, "message": "모든 항목을 입력해주세요."}), 400

    id_err = _validate_login_id(login_id_raw)
    if id_err:
        return jsonify({"success": False, "message": id_err}), 400

    login_id = _normalize_login_id(login_id_raw)

    pw_err = _validate_password(password)
    if pw_err:
        return jsonify({"success": False, "message": pw_err}), 400

    password = _normalize_password(password)
    password_confirm = _normalize_password(password_confirm)

    if password != password_confirm:
        return jsonify({"success": False, "message": "비밀번호가 일치하지 않습니다."}), 400

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT user_id, login_id, email, auth_provider, password_hash, google_sub
                FROM users WHERE login_id = %s AND email = %s
                """,
                (login_id, email),
            )
            user = cursor.fetchone()

            if not user:
                return jsonify({"success": False, "message": "계정 정보를 다시 확인해주세요."}), 404

            if is_google_only_account(user):
                return jsonify({"success": False, "message": GOOGLE_ACCOUNT_HELP}), 400

            password_hash = _hash_password(password)
            cursor.execute(
                """
                UPDATE users SET password_hash = %s, updated_at = NOW() WHERE user_id = %s
                """,
                (password_hash, user["user_id"]),
            )
            conn.commit()

        return jsonify({"success": True, "message": "비밀번호가 변경되었습니다."})

    except Exception as e:
        return jsonify({"success": False, "message": _db_error_message(e)}), 500
    finally:
        if conn:
            conn.close()


from google_auth import register_google_auth_routes

register_google_auth_routes(auth_bp, get_connection=get_connection, db_error_message=_db_error_message)
