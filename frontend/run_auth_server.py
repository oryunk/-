"""
인증 API 전용 개발 서버 진입점 (별칭).

`/api/auth/*` 만 제공합니다. 전체 앱은 `app.py` 를 실행하세요.
구현은 `signup.py` 와 동일하며, 습관에 따라 이 파일 또는 `signup.py` 를 쓰면 됩니다.
"""

import os

from signup import app

if __name__ == "__main__":
    port = int(os.getenv("AUTH_PORT", "5000"))
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    app.run(debug=True, host=host, port=port)
