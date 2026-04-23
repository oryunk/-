"""Flask 응답에 CORS 헤더 추가 (app.py / signup.py 공용)."""


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
