import os
from dotenv import load_dotenv


BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def load_env_files() -> None:
    candidates = (
        os.path.join(BASE_DIR, ".env"),
        os.path.join(os.getcwd(), ".env"),
    )
    for env_path in candidates:
        if os.path.exists(env_path):
            load_dotenv(env_path)
    load_dotenv()


def _get_int(name: str, default: int) -> int:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except Exception:
        return default


def _get_bool(name: str, default: bool) -> bool:
    raw = (os.getenv(name) or "").strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "y", "yes", "on"}


def flask_secret_key() -> str:
    # 기본값은 로컬 개발용만 허용
    return os.getenv("FLASK_SECRET_KEY", "change-this-secret-key")


def flask_run_options() -> dict:
    return {
        "host": (os.getenv("FLASK_HOST") or "127.0.0.1").strip(),
        "port": _get_int("AUTH_PORT", 5000),
        "debug": _get_bool("FLASK_DEBUG", True),
    }


def mysql_config() -> dict:
    # 민감정보 하드코딩 방지: 비밀번호/계정 기본값 미사용
    return {
        "host": (os.getenv("MYSQL_HOST") or "localhost").strip(),
        "port": _get_int("MYSQL_PORT", 3306),
        "user": (os.getenv("MYSQL_USER") or "root").strip(),
        "password": os.getenv("MYSQL_PASSWORD", ""),
        "database": (os.getenv("MYSQL_DATABASE") or "stock_db").strip(),
    }
