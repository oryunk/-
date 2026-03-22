"""회원가입·로그인 등 /api/auth/* (schema.sql users). app.py·Login.py에서 블루프린트로 등록."""

from flask import Blueprint, request, jsonify, session
import pymysql
import pymysql.err
import bcrypt
import os
from datetime import datetime

auth_bp = Blueprint("auth", __name__)

# ★ 수정: db_config를 모듈 로드 시점에 평가하지 않고 get_connection() 안으로 이동.
#   기존 코드는 auth_api.py import 시 os.getenv()가 즉시 실행되어
#   load_dotenv()가 그 이전에 호출되지 않으면 .env 값이 반영되지 않았습니다.

NICKNAME_MAX = 50
EMAIL_MAX = 100


def get_connection():
    """
    example.py와 동일한 원격 DB(49.170.46.148)로 연결합니다.
    .env 환경변수가 있으면 우선 적용, 없으면 example.py 기준값 사용.
    """
    db_config = {
        "host":     os.getenv("MYSQL_HOST",     "49.170.46.148"),
        "port":     int(os.getenv("MYSQL_PORT", "3306")),
        "user":     os.getenv("MYSQL_USER",     "stock_app"),
        "password": os.getenv("MYSQL_PASSWORD", "wnflsdl1324"),
        "database": os.getenv("MYSQL_DATABASE", "stock_db"),
        "charset":  "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
        "init_command": "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
    }
    return pymysql.connect(**db_config)


def _db_error_message(exc: Exception) -> str:
    if isinstance(exc, pymysql.err.OperationalError) and exc.args:
        code = exc.args[0]
        if code == 1045:
            return (
                "MySQL 접속이 거절되었습니다(오류 1045). backend/.env의 MYSQL_PASSWORD가 "
                "MySQL root(또는 MYSQL_USER) 비밀번호와 정확히 같은지 확인하세요. "
                "Workbench·mysql 명령줄로 접속할 때 쓰는 비밀번호와 같아야 합니다."
            )
        if code == 1049:
            return (
                "데이터베이스가 없습니다(오류 1049). SQL/schema.sql로 stock_db를 만든 뒤 다시 시도하세요."
            )
        if code == 2003:
            return "MySQL 서버에 연결할 수 없습니다. 서비스(예: MySQL80)가 실행 중인지 확인하세요."
    return f"서버 오류: {str(exc)}"


def _login_id_from_body(data):
    if not data:
        return ""
    return (data.get("loginId") or data.get("userId") or "").strip()


@auth_bp.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    login_id = _login_id_from_body(data)
    email = (data.get("email") or "").strip()
    password = data.get("password", "")
    password_confirm = data.get("passwordConfirm", "")

    if not login_id or not email or not password or not password_confirm:
        return jsonify({"success": False, "message": "모든 항목을 입력해주세요."}), 400

    if len(login_id) > NICKNAME_MAX:
        return jsonify({"success": False, "message": f"아이디는 {NICKNAME_MAX}자 이하로 입력해주세요."}), 400

    if len(email) > EMAIL_MAX:
        return jsonify({"success": False, "message": f"이메일은 {EMAIL_MAX}자 이하로 입력해주세요."}), 400

    if password != password_confirm:
        return jsonify({"success": False, "message": "비밀번호가 일치하지 않습니다."}), 400

    conn = None  # ★ 수정: finally에서 안전하게 닫을 수 있도록 미리 None으로 초기화
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            # 아이디(nickname) 또는 이메일 중복 확인
            sql_check = """
                SELECT user_id
                FROM users
                WHERE email = %s OR nickname = %s
            """
            cursor.execute(sql_check, (email, login_id))
            if cursor.fetchone():
                return jsonify({"success": False, "message": "이미 존재하는 아이디 또는 이메일입니다."}), 409

            password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            # ★ 수정: schema.sql의 실제 컬럼 구조에 맞는 INSERT
            #   users(email, password_hash, nickname, created_at, updated_at)
            sql_insert = """
                INSERT INTO users (email, password_hash, nickname, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s)
            """
            cursor.execute(sql_insert, (email, password_hash, login_id, now, now))
            conn.commit()

        return jsonify({
            "success": True,
            "message": "회원가입이 완료되었습니다.",
            "user": {"email": email, "loginId": login_id},
        })

    except pymysql.err.IntegrityError:
        return jsonify({"success": False, "message": "이미 존재하는 아이디 또는 이메일입니다."}), 409

    except Exception as e:
        return jsonify({"success": False, "message": _db_error_message(e)}), 500

    finally:
        if conn:  # ★ 수정: "conn" in locals() 대신 None 체크로 안전하게 처리
            conn.close()


@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    login_id = _login_id_from_body(data)
    password = data.get("password", "")

    if not login_id or not password:
        return jsonify({"success": False, "message": "아이디와 비밀번호를 입력해주세요."}), 400

    conn = None  # ★ 수정: 안전한 None 초기화
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            sql = """
                SELECT user_id, email, nickname, password_hash
                FROM users
                WHERE nickname = %s
            """
            cursor.execute(sql, (login_id,))
            user = cursor.fetchone()

            if not user:
                return jsonify({"success": False, "message": "아이디 또는 비밀번호가 올바르지 않습니다."}), 401

            stored_hash = user["password_hash"].encode("utf-8")
            if not bcrypt.checkpw(password.encode("utf-8"), stored_hash):
                return jsonify({"success": False, "message": "아이디 또는 비밀번호가 올바르지 않습니다."}), 401

            # 세션에는 숫자만 저장 (한글 닉네임·이메일은 Set-Cookie latin-1 제약 회피)
            session.clear()
            session["user_id"] = int(user["user_id"])

            return jsonify({
                "success": True,
                "message": "로그인 성공",
                "user": {
                    "email": user["email"],
                    "loginId": user["nickname"],
                },
            })

    except Exception as e:
        return jsonify({"success": False, "message": _db_error_message(e)}), 500

    finally:
        if conn:  # ★ 수정: None 체크
            conn.close()


@auth_bp.route("/api/auth/me", methods=["GET"])
def me():
    uid = session.get("user_id")
    if uid is None:
        return jsonify({"success": False, "message": "로그인되지 않았습니다."}), 401

    conn = None  # ★ 수정: 안전한 None 초기화
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT user_id, email, nickname FROM users WHERE user_id = %s",
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
                "loginId": user["nickname"],
            },
        })
    except Exception as e:
        return jsonify({"success": False, "message": _db_error_message(e)}), 500
    finally:
        if conn:  # ★ 수정: None 체크
            conn.close()


@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"success": True, "message": "로그아웃 완료"})
