"""인증 API(/api/auth/*)만 올리는 Flask 앱. (평소에는 app.py 실행. auth 단독 디버깅 시 python signup.py, 포트는 AUTH_PORT.)"""

import os
from dotenv import load_dotenv
from flask import Flask, request

load_dotenv()

from auth_api import auth_bp
from cors_helpers import apply_cors_headers

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "change-this-secret-key")


@app.after_request
def _cors_after_request(response):
    return apply_cors_headers(request, response)


@app.before_request
def _cors_preflight():
    if request.method == "OPTIONS":
        return apply_cors_headers(request, app.make_response(("", 204)))


app.register_blueprint(auth_bp)

if __name__ == "__main__":
    port = int(os.getenv("AUTH_PORT", "5000"))
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    app.run(debug=True, host=host, port=port)
