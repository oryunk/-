"""Flask 응답에 CORS 헤더 추가 (app.py / signup.py 공용)."""

from flask import request


def apply_cors_headers(request, response):
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
    if origin == "null":
        response.headers["Access-Control-Allow-Origin"] = "null"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    elif origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    else:
        response.headers["Access-Control-Allow-Origin"] = "*"
    return response


def register_flask_cors(app):
    """앱에 CORS after_request 및 OPTIONS preflight before_request 를 등록한다."""

    @app.after_request
    def _cors_after_request(response):
        return apply_cors_headers(request, response)

    @app.before_request
    def _cors_preflight():
        if request.method == "OPTIONS":
            return apply_cors_headers(request, app.make_response(("", 204)))
