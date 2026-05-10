"""종목 상세·라이브 시세 API."""

from flask import Blueprint

quotes_bp = Blueprint("quotes", __name__)


@quotes_bp.route("/api/stock-detail/<code>", methods=["GET"])
def stock_detail(code):
    import app as app_module

    return app_module.serve_stock_detail(code)


@quotes_bp.route("/api/live-prices", methods=["GET"])
def live_prices():
    import app as app_module

    return app_module.serve_live_prices()


@quotes_bp.route("/api/stocks/suggest", methods=["GET"])
def stocks_suggest():
    import app as app_module

    return app_module.serve_stock_suggest()
