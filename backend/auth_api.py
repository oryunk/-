"""인증 API 블루프린트 (/api/auth/*)."""

from flask import Blueprint, request, jsonify, session
import pymysql
import pymysql.err
import bcrypt
from runtime_config import load_env_files, mysql_config

load_env_files()

auth_bp = Blueprint("auth", __name__)

LOGIN_ID_MAX = 50
EMAIL_MAX = 100
PASSWORD_MIN_LENGTH = 4


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
                "DB에 login_id 등 필요한 컬럼이 없습니다(오류 1054). "
                "SQL/update.sql을 stock_db에 적용했는지 확인하세요."
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


def _login_id_from_body(data):
    if not data:
        return ""
    return (data.get("loginId") or data.get("userId") or "").strip()


def _normalize_email(data):
    return (data.get("email") or "").strip()


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


@auth_bp.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    login_id = _login_id_from_body(data)
    email = _normalize_email(data)
    password = data.get("password", "")
    password_confirm = data.get("passwordConfirm", "")
    nickname = (data.get("nickname") or "").strip()

    if not login_id or not email or not password or not password_confirm:
        return jsonify({"success": False, "message": "모든 항목을 입력해주세요."}), 400

    if len(login_id) > LOGIN_ID_MAX:
        return jsonify({"success": False, "message": f"아이디는 {LOGIN_ID_MAX}자 이하로 입력해주세요."}), 400

    if len(email) > EMAIL_MAX:
        return jsonify({"success": False, "message": f"이메일은 {EMAIL_MAX}자 이하로 입력해주세요."}), 400

    if len(password) < PASSWORD_MIN_LENGTH:
        return jsonify({"success": False, "message": f"비밀번호는 {PASSWORD_MIN_LENGTH}자 이상 입력해주세요."}), 400

    if password != password_confirm:
        return jsonify({"success": False, "message": "비밀번호가 일치하지 않습니다."}), 400

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            sql_check = """
                SELECT user_id
                FROM users
                WHERE email = %s OR login_id = %s
            """
            cursor.execute(sql_check, (email, login_id))
            if cursor.fetchone():
                return jsonify({"success": False, "message": "이미 존재하는 아이디 또는 이메일입니다."}), 409

            password_hash = _hash_password(password)
            sql_insert = """
                INSERT INTO users (login_id, email, password_hash, nickname, created_at, updated_at)
                VALUES (%s, %s, %s, %s, NOW(), NOW())
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
        return jsonify({"success": False, "message": _db_error_message(e)}), 500
    finally:
        if conn:
            conn.close()


@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    login_id = _login_id_from_body(data)
    password = data.get("password", "")

    if not login_id or not password:
        return jsonify({"success": False, "message": "아이디와 비밀번호를 입력해주세요."}), 400

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            sql = """
                SELECT user_id, email, login_id, password_hash, nickname
                FROM users
                WHERE login_id = %s OR email = %s
            """
            cursor.execute(sql, (login_id, login_id))
            user = cursor.fetchone()

            if not user:
                return jsonify({"success": False, "message": "아이디 또는 비밀번호가 올바르지 않습니다."}), 401

            stored_hash = (user.get("password_hash") or "").encode("utf-8")
            if not stored_hash or not bcrypt.checkpw(password.encode("utf-8"), stored_hash):
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
            cursor.execute(
                "SELECT user_id, email, login_id, nickname FROM users WHERE user_id = %s",
                (uid,),
            )
            user = cursor.fetchone()
        if not user:
            session.clear()
            return jsonify({"success": False, "message": "로그인되지 않았습니다."}), 401

        return jsonify({
            "success": True,
            "user": {
                "userId": user["user_id"],
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

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT login_id FROM users WHERE email = %s",
                (email,),
            )
            row = cursor.fetchone()

        if not row or not row.get("login_id"):
            return jsonify({"success": False, "message": "해당 이메일로 가입된 아이디가 없습니다."}), 404

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

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT user_id, login_id, email FROM users WHERE login_id = %s AND email = %s",
                (login_id, email),
            )
            user = cursor.fetchone()

        if not user:
            return jsonify({"success": False, "message": "입력한 아이디와 이메일이 일치하는 계정을 찾을 수 없습니다."}), 404

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
    login_id = _login_id_from_body(data)
    email = _normalize_email(data)
    password = data.get("password", "")
    password_confirm = data.get("passwordConfirm", "")

    if not login_id or not email or not password or not password_confirm:
        return jsonify({"success": False, "message": "모든 항목을 입력해주세요."}), 400

    if len(password) < PASSWORD_MIN_LENGTH:
        return jsonify({"success": False, "message": f"비밀번호는 {PASSWORD_MIN_LENGTH}자 이상 입력해주세요."}), 400

    if password != password_confirm:
        return jsonify({"success": False, "message": "비밀번호가 일치하지 않습니다."}), 400

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT user_id FROM users WHERE login_id = %s AND email = %s",
                (login_id, email),
            )
            user = cursor.fetchone()

            if not user:
                return jsonify({"success": False, "message": "계정 정보를 다시 확인해주세요."}), 404

            password_hash = _hash_password(password)
            cursor.execute(
                "UPDATE users SET password_hash = %s, updated_at = NOW() WHERE user_id = %s",
                (password_hash, user["user_id"]),
            )
            conn.commit()

        return jsonify({"success": True, "message": "비밀번호가 변경되었습니다."})

    except Exception as e:
        return jsonify({"success": False, "message": _db_error_message(e)}), 500
    finally:
        if conn:
            conn.close()
