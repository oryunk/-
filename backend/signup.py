"""단독 실행용 인증 서버 (app.py와 동일한 /api/auth/*). 보통은 app.py만 실행하면 됩니다."""

import os
from dotenv import load_dotenv
from flask import Flask, request

load_dotenv()

from auth_api import auth_bp

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "change-this-secret-key")


def _apply_cors_headers(response):
    origin = request.headers.get("Origin")
    response.headers.setdefault(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
    )
    response.headers.setdefault(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS",
    )
    if origin:
        try:
            origin.encode("latin-1")
        except UnicodeEncodeError:
            origin = None
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    else:
        response.headers["Access-Control-Allow-Origin"] = "*"
    return response


@app.after_request
def _cors_after_request(response):
    return _apply_cors_headers(response)


@app.before_request
def _cors_preflight():
    if request.method == "OPTIONS":
        return _apply_cors_headers(app.make_response(("", 204)))


app.register_blueprint(auth_bp)

if __name__ == "__main__":
    port = int(os.getenv("AUTH_PORT", "5000"))
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    app.run(debug=True, host=host, port=port)
