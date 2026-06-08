"""관심 종목 API (/api/watchlist*)."""

from flask import Blueprint

watchlist_bp = Blueprint("watchlist", __name__)


@watchlist_bp.route("/api/watchlist", methods=["GET"])
def watchlist_list():
    import app as app_module

    return app_module.serve_watchlist_list()


@watchlist_bp.route("/api/watchlist/toggle", methods=["POST"])
def watchlist_toggle():
    import app as app_module

    return app_module.serve_watchlist_toggle()
