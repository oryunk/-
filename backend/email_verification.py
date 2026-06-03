"""회원가입 이메일 인증코드 발송·검증 (SMTP + MySQL)."""

from __future__ import annotations

import os
import random
import smtplib
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import bcrypt
import pymysql

CODE_LENGTH = 6
DEFAULT_TTL_MIN = 10
DEFAULT_RESEND_SEC = 60


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return max(1, int(raw))
    except ValueError:
        return default


def smtp_configured() -> bool:
    host = os.getenv("SMTP_HOST", "").strip()
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "").strip()
    from_addr = os.getenv("SMTP_FROM", "").strip() or user
    return bool(host and user and password and from_addr)


def generate_code() -> str:
    return "".join(str(random.randint(0, 9)) for _ in range(CODE_LENGTH))


def hash_code(code: str) -> str:
    return bcrypt.hashpw(code.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_code(plain: str, code_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), code_hash.encode("utf-8"))
    except ValueError:
        return False


def send_verification_email(to_email: str, code: str) -> None:
    if not smtp_configured():
        raise RuntimeError(
            "SMTP가 설정되지 않았습니다. backend/.env에 SMTP_HOST, SMTP_USER, "
            "SMTP_PASSWORD, SMTP_FROM을 설정해 주세요."
        )

    host = os.getenv("SMTP_HOST", "").strip()
    port = _int_env("SMTP_PORT", 587)
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "").strip()
    from_addr = os.getenv("SMTP_FROM", "").strip() or user
    use_tls = os.getenv("SMTP_USE_TLS", "true").strip().lower() not in ("0", "false", "no")

    subject = "[주린닷컴] 이메일 인증코드"
    body = (
        f"회원가입 인증코드: {code}\n\n"
        f"이 코드는 {_int_env('EMAIL_CODE_TTL_MIN', DEFAULT_TTL_MIN)}분간 유효합니다.\n"
        "본인이 요청하지 않았다면 이 메일을 무시해 주세요."
    )

    msg = MIMEMultipart()
    msg["From"] = from_addr
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain", "utf-8"))

    if use_tls:
        with smtplib.SMTP(host, port, timeout=30) as server:
            server.starttls()
            server.login(user, password)
            server.sendmail(from_addr, [to_email], msg.as_string())
    else:
        with smtplib.SMTP_SSL(host, port, timeout=30) as server:
            server.login(user, password)
            server.sendmail(from_addr, [to_email], msg.as_string())


def _seconds_since_last_send(cursor, email: str) -> float | None:
    cursor.execute(
        """
        SELECT created_at FROM email_verification_codes
        WHERE email = %s
        ORDER BY id DESC LIMIT 1
        """,
        (email,),
    )
    row = cursor.fetchone()
    if not row or not row.get("created_at"):
        return None
    created = row["created_at"]
    if isinstance(created, datetime):
        delta = datetime.now() - created
        return delta.total_seconds()
    return None


def issue_and_send_code(conn, email: str) -> str | None:
    """
    인증코드 발급·저장·메일 발송.
    성공 시 None, 실패 시 사용자용 메시지.
    """
    resend_sec = _int_env("EMAIL_CODE_RESEND_SEC", DEFAULT_RESEND_SEC)
    ttl_min = _int_env("EMAIL_CODE_TTL_MIN", DEFAULT_TTL_MIN)

    with conn.cursor() as cursor:
        elapsed = _seconds_since_last_send(cursor, email)
        if elapsed is not None and elapsed < resend_sec:
            wait = int(resend_sec - elapsed) + 1
            return f"{wait}초 후에 다시 발송할 수 있습니다."

        code = generate_code()
        code_hash = hash_code(code)
        expires_at = datetime.now() + timedelta(minutes=ttl_min)

        cursor.execute(
            """
            INSERT INTO email_verification_codes (email, code_hash, expires_at, created_at)
            VALUES (%s, %s, %s, NOW())
            """,
            (email, code_hash, expires_at),
        )

    try:
        send_verification_email(email, code)
    except Exception as e:
        conn.rollback()
        msg = str(e)
        if "SMTP" in msg or "설정" in msg:
            return msg
        return "인증 메일을 보내지 못했습니다. SMTP 설정을 확인해 주세요."

    conn.commit()
    return None


def check_email_code(conn, email: str, plain_code: str) -> str | None:
    """DB와 대조만 함(삭제 없음). 유효하면 None, 아니면 오류 메시지."""
    code = (plain_code or "").strip()
    if not code:
        return "인증코드를 입력해주세요."
    if not code.isdigit() or len(code) != CODE_LENGTH:
        return "인증코드 6자리를 다시 입력해주세요."

    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, code_hash,
                   (expires_at > NOW()) AS not_expired
            FROM email_verification_codes
            WHERE email = %s
            ORDER BY id DESC
            LIMIT 1
            """,
            (email,),
        )
        row = cursor.fetchone()
        if not row:
            return "인증코드를 먼저 발송해 주세요."

        not_expired = row.get("not_expired")
        if not_expired in (0, False, "0"):
            return "인증코드가 만료되었습니다. 다시 발송해 주세요."

        if not verify_code(code, row["code_hash"]):
            return "인증코드가 올바르지 않습니다."

    return None


def verify_email_code(conn, email: str, plain_code: str) -> str | None:
    """유효하면 None, 아니면 오류 메시지. 성공 시 인증 행 삭제."""
    err = check_email_code(conn, email, plain_code)
    if err:
        return err

    with conn.cursor() as cursor:
        cursor.execute(
            "DELETE FROM email_verification_codes WHERE email = %s",
            (email,),
        )
    conn.commit()
    return None


def is_missing_table_error(exc: Exception) -> bool:
    return isinstance(exc, pymysql.err.ProgrammingError) and bool(
        exc.args and exc.args[0] == 1146
    )
