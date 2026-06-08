"""프론트엔드 정적 HTML/CSS/JS 제공."""

import os

from flask import Blueprint, abort, send_from_directory

from app_state import FRONTEND_DIR

static_site_bp = Blueprint("static_site", __name__)


@static_site_bp.route("/", defaults={"filename": "주린닷컴홈피.html"})
@static_site_bp.route("/<path:filename>")
def serve_capstone(filename):
    """frontend 정적 파일."""
    if not filename or ".." in filename:
        abort(404)
    if filename in {"주린닷컴.html", "jurin.html", "index.html"}:
        filename = "주린닷컴홈피.html"
    safe = os.path.normpath(filename).replace("\\", "/")
    if safe.startswith(".."):
        abort(404)
    full = os.path.abspath(os.path.join(FRONTEND_DIR, safe))
    if not full.startswith(FRONTEND_DIR + os.sep) and full != FRONTEND_DIR:
        abort(404)
    if not os.path.isfile(full):
        abort(404)
    directory, basename = os.path.split(full)
    return send_from_directory(directory, basename)
