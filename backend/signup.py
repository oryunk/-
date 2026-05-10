"""
인증 API 전용 최소 Flask 앱 (`/api/auth/*`).

회원가입·로그인·로그아웃·세션 조회·아이디/비밀번호 찾기 등 auth_api 블루프린트 전체를
같은 프로세스에서만 띄울 때 사용합니다. 파일명은 역사적 이유로 signup 이지만
「회원가입만」이 아닙니다.

- 일반 실행: `python app.py` (정적 프론트 + 모든 API)
- 인증만: `python signup.py` 또는 `python run_auth_server.py` (포트 `AUTH_PORT`)
"""

import os
from flask import Flask

from runtime_config import flask_secret_key
from auth_api import auth_bp
from cors_helpers import register_flask_cors

app = Flask(__name__)
app.secret_key = flask_secret_key()
register_flask_cors(app)
app.register_blueprint(auth_bp)

if __name__ == "__main__":
    port = int(os.getenv("AUTH_PORT", "5000"))
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    app.run(debug=True, host=host, port=port)
